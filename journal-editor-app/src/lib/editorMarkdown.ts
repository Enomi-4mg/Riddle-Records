import { embedMarkdown, parseEmbed } from "../../../shared/embeds";
import { marked } from "marked";
import TurndownService from "turndown";

export const encodeRawHtml = (value: string) => `uri:${encodeURIComponent(value)}`;
export const decodeRawHtml = (value: string) => value.startsWith("uri:") ? decodeURIComponent(value.slice(4)) : value;

function protectRawBlocks(markdown: string) {
  const lines = markdown.split("\n"); const output: string[] = [];
  let fence: { char: string; length: number } | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const fenced = lines[index].match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (fenced && !fence) { fence = { char: fenced[1][0], length: fenced[1].length }; output.push(lines[index]); continue; }
    if (fence) {
      if (fenced && fenced[1][0] === fence.char && fenced[1].length >= fence.length && !fenced[2].trim()) fence = undefined;
      output.push(lines[index]); continue;
    }
    const start = lines[index].trimStart().match(/^<(div|figure|iframe|video|audio|img)\b/i);
    if (!start) { output.push(lines[index]); continue; }
    const tag = start[1].toLowerCase(); const block = [lines[index]]; let depth = 0;
    if (tag === "img") { output.push("", `<div data-raw-html=\"${encodeRawHtml(block.join("\n"))}\"></div>`, ""); continue; }
    const count = (line: string) => { depth += (line.match(new RegExp(`<${tag}\\b`, "gi")) || []).length; depth -= (line.match(new RegExp(`</${tag}>`, "gi")) || []).length; };
    count(lines[index]);
    while (depth > 0 && index + 1 < lines.length) { index += 1; block.push(lines[index]); count(lines[index]); }
    if (depth === 0) output.push("", `<div data-raw-html=\"${encodeRawHtml(block.join("\n"))}\"></div>`, ""); else output.push(...block);
  }
  return output.join("\n");
}

export function markdownToEditorHtml(markdown: string) {
  const protectedMarkdown = protectRawBlocks(markdown);
  const renderer = new marked.Renderer();
  renderer.code = (token) => {
    const { text, lang } = token;
    const embed = lang === "riddle-embed" ? parseEmbed(text) : undefined;
    return embed ? `<div data-riddle-embed="${encodeURIComponent(JSON.stringify(embed))}"></div>` : new marked.Renderer().code(token);
  };
  let html = marked.parse(protectedMarkdown, { gfm: true, renderer }) as string;
  html = html.replace(/<li><input([^>]*)type=\"checkbox\"([^>]*)>\s*([\s\S]*?)<\/li>/g, (_match, before, after, content) => {
    const checked = `${before}${after}`.includes("checked");
    return `<li data-checked=\"${checked ? "true" : "false"}\"><label><input type=\"checkbox\" ${checked ? "checked" : ""}><span></span></label><div><p>${content}</p></div></li>`;
  });
  html = html.replace(/<ul>(\s*<li data-checked=[\s\S]*?<\/li>\s*)<\/ul>/g, '<ul data-type="taskList">$1</ul>');
  return html;
}

export function editorHtmlToMarkdown(html: string) {
  const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced", blankReplacement: (_content, node) => {
    const element = node as HTMLElement;
    if (node.nodeType === 1 && element.hasAttribute("data-riddle-embed")) {
      try { const embed = parseEmbed(decodeURIComponent(element.getAttribute("data-riddle-embed") || "")); if (embed) return `\n\n${embedMarkdown(embed)}\n\n`; } catch { /* Keep invalid input out of generated embeds. */ }
    }
    return node.nodeType === 1 && element.hasAttribute("data-raw-html") ? `\n\n${decodeRawHtml(element.getAttribute("data-raw-html") || "")}\n\n` : (node as HTMLElement & { isBlock?: boolean }).isBlock ? "\n\n" : "";
  } });
  turndown.addRule("embed", {
    filter: (node) => node.nodeType === 1 && (node as HTMLElement).hasAttribute("data-riddle-embed"),
    replacement: (_content, node) => {
      try { const raw = decodeURIComponent((node as HTMLElement).getAttribute("data-riddle-embed") || ""); const embed = parseEmbed(raw); return embed ? `\n\n${embedMarkdown(embed)}\n\n` : ""; } catch { return ""; }
    }
  });
  turndown.addRule("strike", { filter: (node) => ["S", "STRIKE", "DEL"].includes(node.nodeName), replacement: (content) => `~~${content}~~` });
  turndown.addRule("rawHtml", {
    filter: (node) => node.nodeType === 1 && (node as HTMLElement).hasAttribute("data-raw-html"),
    replacement: (_content, node) => `\n\n${decodeRawHtml((node as HTMLElement).getAttribute("data-raw-html") || "")}\n\n`
  });
  turndown.addRule("taskItem", {
    filter: (node) => node.nodeName === "LI" && (node as HTMLElement).hasAttribute("data-checked"),
    replacement: (content, node) => `\n- [${(node as HTMLElement).getAttribute("data-checked") === "true" ? "x" : " "}] ${content.trim()}\n`
  });
  turndown.addRule("table", {
    filter: "table",
    replacement: (_content, node) => {
      const rows = Array.from((node as HTMLElement).querySelectorAll("tr")).map((row) => Array.from(row.querySelectorAll("th,td")).map((cell) => (cell.textContent || "").trim().replace(/\|/g, "\\|")));
      if (!rows.length) return "";
      const width = Math.max(...rows.map((row) => row.length));
      const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
      return `\n\n| ${normalized[0].join(" | ")} |\n| ${normalized[0].map(() => "---").join(" | ")} |\n${normalized.slice(1).map((row) => `| ${row.join(" | ")} |`).join("\n")}\n\n`;
    }
  });
  return turndown.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
}
