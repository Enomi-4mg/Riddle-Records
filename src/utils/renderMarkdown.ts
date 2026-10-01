import { createMarkdownProcessor, type MarkdownProcessor, type RemarkPlugin } from "@astrojs/markdown-remark";
import { parseEmbed, renderEmbed, type CardResolver } from "../../shared/embeds";

type MarkdownNode = { type: string; lang?: string; value?: string; children?: MarkdownNode[] };
type EmbedContext = { resolve?: CardResolver; origin: string; base: string };
const embeds: RemarkPlugin = () => (tree, file) => {
  // Per-render context keeps the shared processor safe for concurrent page builds.
  const context = file.data.astro?.frontmatter?.riddleEmbedContext as EmbedContext;
  const visit = (node: MarkdownNode) => {
    if (node.type === "code" && node.lang === "riddle-embed") {
      const embed = parseEmbed(node.value || "");
      if (embed) { node.type = "html"; node.value = renderEmbed(embed, context.resolve, context.origin, context.base); delete node.lang; }
    }
    node.children?.forEach(visit);
  };
  visit(tree);
};
const processors = new Map<boolean, Promise<MarkdownProcessor>>();
export async function renderContentMarkdown(markdown: string, resolve?: CardResolver, origin = "https://4mg.dev", base = "/", highlight = false) {
  if (!processors.has(highlight)) processors.set(highlight, createMarkdownProcessor({ syntaxHighlight: highlight ? "shiki" : false, remarkPlugins: [embeds] }));
  const processor = await processors.get(highlight)!;
  return (await processor.render(markdown, { frontmatter: { riddleEmbedContext: { resolve, origin, base } satisfies EmbedContext } })).code;
}
