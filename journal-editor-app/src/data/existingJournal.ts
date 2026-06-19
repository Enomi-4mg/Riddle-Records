const modules = import.meta.glob("../../../src/content/journal/*.md", {
  eager: true,
  query: "?raw",
  import: "default"
});

export const existingJournalArticles = Object.entries(modules)
  .map(([path, markdown]) => ({
    id: `imported:${path.split("/").pop() ?? path}`,
    sourcePath: path,
    filename: path.split("/").pop() ?? "journal.md",
    markdown: String(markdown)
  }))
  .sort((a, b) => a.filename.localeCompare(b.filename));
