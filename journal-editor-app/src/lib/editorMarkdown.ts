import { marked } from "marked";
import TurndownService from "turndown";

const encode = (value: string) => encodeURIComponent(value);
const decode = (value: string) => decodeURIComponent(value);

function protectRawBlocks(markdown: string) {
  const lines = markdown.split("\n"); const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const start = lines[index].trimStart().match(/^<(div|figure|iframe|video|audio|img)\b/i);
    if (!start) { output.push(lines[index]); continue; }
    const tag = start[1].toLowerCase(); const block = [lines[index]]; let depth = 0;
    if (tag === "img") { output.push("", `<div data-raw-html=\"${encode(block.join("\n"))}\"></div>`, ""); continue; }
    const count = (line: string) => { depth += (line.match(new RegExp(`<${tag}\\b`, "gi")) || []).length; depth -= (line.match(new RegExp(`</${tag}>`, "gi")) || []).length; };
    count(lines[index]);
    while (depth > 0 && index + 1 < lines.length) { index += 1; block.push(lines[index]); count(lines[index]); }
    if (depth === 0) output.push("", `<div data-raw-html=\"${encode(block.join("\n"))}\"></div>`, ""); else output.push(...block);
  }
  return output.join("\n");
}

export function markdownToEditorHtml(markdown: string) {
  const protectedMarkdown = protectRawBlocks(markdown);
  let html = marked.parse(protectedMarkdown, { gfm: true }) as string;
  html = html.replace(/<li><input([^>]*)type=\"checkbox\"([^>]*)>\s*([\s\S]*?)<\/li>/g, (_match, before, after, content) => {
    const checked = `${before}${after}`.includes("checked");
    return `<li data-checked=\"${checked ? "true" : "false"}\"><label><input type=\"checkbox\" ${checked ? "checked" : ""}><span></span></label><div><p>${content}</p></div></li>`;
  });
  html = html.replace(/<ul>(\s*<li data-checked=[\s\S]*?<\/li>\s*)<\/ul>/g, '<ul data-type="taskList">$1</ul>');
  return html;
}

export function editorHtmlToMarkdown(html: string) {
  const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
  turndown.addRule("rawHtml", {
    filter: (node) => node instanceof HTMLElement && node.hasAttribute("data-raw-html"),
    replacement: (_content, node) => `\n\n${decode((node as HTMLElement).getAttribute("data-raw-html") || "")}\n\n`
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
