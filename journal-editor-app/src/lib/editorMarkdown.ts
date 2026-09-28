import { marked } from "marked";
import TurndownService from "turndown";

const encode = (value: string) => encodeURIComponent(value);
const decode = (value: string) => decodeURIComponent(value);

function protectRawBlocks(markdown: string) {
  const lines = markdown.split("\n"); const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const start = lines[index].trimStart().match(/^<(div|figure|iframe|video|audio)\b/i);
    if (!start) { output.push(lines[index]); continue; }
    const tag = start[1].toLowerCase(); const block = [lines[index]]; let depth = 0;
    const count = (line: string) => { depth += (line.match(new RegExp(`<${tag}\\b`, "gi")) || []).length; depth -= (line.match(new RegExp(`</${tag}>`, "gi")) || []).length; };
    count(lines[index]);
    while (depth > 0 && index + 1 < lines.length) { index += 1; block.push(lines[index]); count(lines[index]); }
    if (depth === 0) output.push("", `<div data-raw-html=\"${encode(block.join("\n"))}\"></div>`, ""); else output.push(...block);
  }
  return output.join("\n");
}

export function markdownToEditorHtml(markdown: string) {
  const protectedMarkdown = protectRawBlocks(markdown);
  return marked.parse(protectedMarkdown, { gfm: true }) as string;
}

export function editorHtmlToMarkdown(html: string) {
  const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
  turndown.addRule("rawHtml", {
    filter: (node) => node instanceof HTMLElement && node.hasAttribute("data-raw-html"),
    replacement: (_content, node) => `\n\n${decode((node as HTMLElement).getAttribute("data-raw-html") || "")}\n\n`
  });
  return turndown.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
}
