import { createMarkdownProcessor } from "@astrojs/markdown-remark";

const processor = createMarkdownProcessor({ syntaxHighlight: false });

export async function renderContentMarkdown(markdown: string) {
  return (await (await processor).render(markdown)).code;
}
