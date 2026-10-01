export function galleryBodySections(body: string) {
  const match = body.match(/(?:^|\n)## 関連記事\s*\n([\s\S]*?)(?=\n## |$)/);
  if (!match) return { body: body.trim(), articleUrl: undefined, makingArticleUrl: undefined };
  let articleUrl: string | undefined; let makingArticleUrl: string | undefined;
  const remaining = match[1].split("\n").filter((line) => {
    const link = line.match(/^\s*[-*] \[(作品記事|メイキング)\]\(([^)]+)\)\s*$/);
    if (!link) return true;
    if (link[1] === "作品記事") articleUrl = link[2]; else makingArticleUrl = link[2];
    return false;
  }).join("\n").trim();
  // Preserve embedded cards and custom text in the section; extract only legacy links.
  const replacement = remaining ? `\n## 関連記事\n\n${remaining}\n` : "";
  return { body: body.replace(match[0], replacement).trim(), articleUrl, makingArticleUrl };
}
