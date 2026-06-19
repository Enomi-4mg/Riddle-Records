import { articleTypes, defaultBody, today, type ArticleType, type DraftOverrides, type FrontmatterForm, type StoredDraft } from "../types/journal";
import { createDraft } from "./storage";
import { buildFrontmatter, joinList } from "./frontmatter";
import { generatedFilename } from "./permalink";

export function buildMarkdown(draft: StoredDraft) {
  return `${buildFrontmatter(draft.frontmatter)}\n\n${draft.body.trimEnd()}\n`;
}

function parseScalar(value: string) {
  const trimmed = value.trim().replace(/\s+#.*$/, "").trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

export function parseImportedMarkdown(markdown: string, overrides: DraftOverrides = {}) {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const imported: Record<string, unknown> = {};
  let body = normalized;
  if (match) {
    body = match[2] || "";
    const lines = match[1].split("\n");
    let arrayKey = "";
    for (const line of lines) {
      const arrayItem = line.match(/^\s*-\s+(.+)$/);
      if (arrayKey && arrayItem) {
        const current = Array.isArray(imported[arrayKey]) ? imported[arrayKey] as string[] : [];
        imported[arrayKey] = [...current, String(parseScalar(arrayItem[1]))];
        continue;
      }
      const keyValue = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (!keyValue) continue;
      const [, key, value] = keyValue;
      arrayKey = value ? "" : key;
      imported[key] = value ? parseScalar(value) : [];
    }
  }

  const frontmatter: Partial<FrontmatterForm> = {
    title: typeof imported.title === "string" ? imported.title : "",
    date: typeof imported.date === "string" ? imported.date.slice(0, 10) : today,
    type: articleTypes.includes(imported.type as ArticleType) ? imported.type as ArticleType : "journal",
    slug: typeof imported.slug === "string" ? imported.slug : "",
    description: typeof imported.description === "string" ? imported.description : "",
    tags: joinList(imported.tags),
    draft: typeof imported.draft === "boolean" ? imported.draft : false,
    thumbnail: typeof imported.thumbnail === "string" ? imported.thumbnail : "",
    thumbnail_alt: typeof imported.thumbnail_alt === "string" ? imported.thumbnail_alt : "",
    thumbnail_fit: typeof imported.thumbnail_fit === "string" ? imported.thumbnail_fit : "",
    thumbnail_position: typeof imported.thumbnail_position === "string" ? imported.thumbnail_position : "",
    og_image: typeof imported.og_image === "string" ? imported.og_image : "",
    featured_related: joinList(imported.featured_related),
    use_math: Boolean(imported.use_math),
    permalink: typeof imported.permalink === "string" ? imported.permalink : "",
    og_description: typeof imported.og_description === "string" ? imported.og_description : "",
    image: typeof imported.image === "string" ? imported.image : "",
    thumbnail_class: typeof imported.thumbnail_class === "string" ? imported.thumbnail_class : ""
  };

  return createDraft({ ...overrides, frontmatter: { ...frontmatter, ...overrides.frontmatter }, body: body.trimStart() || defaultBody });
}

export function downloadDraft(draft: StoredDraft) {
  const blob = new Blob([buildMarkdown(draft)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = generatedFilename(draft.frontmatter) || "journal.md";
  anchor.click();
  URL.revokeObjectURL(url);
}
