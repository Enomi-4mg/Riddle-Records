import { articleTypes, defaultBody, defaultFrontmatter, today, type ArticleType, type DraftOverrides, type FrontmatterForm, type StoredDraft } from "../types/journal";
import { buildFrontmatter, joinList } from "./frontmatter";
import { generatedFilename } from "./permalink";
import { parseYamlFrontmatter } from "./yamlFrontmatter";

export function nowIso() {
  return new Date().toISOString();
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEditorDraft(overrides: DraftOverrides = {}): StoredDraft {
  const createdAt = overrides.createdAt ?? nowIso();
  return {
    id: overrides.id ?? createId(),
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    importedAt: overrides.importedAt,
    editedAt: overrides.editedAt,
    source: overrides.source ?? "manual",
    sourcePath: overrides.sourcePath,
    sourceFileName: overrides.sourceFileName,
    loadedFilePath: overrides.loadedFilePath,
    loadedFileMtime: overrides.loadedFileMtime,
    kind: overrides.kind ?? "journal",
    frontmatter: { ...defaultFrontmatter, ...overrides.frontmatter },
    body: overrides.body ?? defaultBody
  };
}

function joinLinks(value: unknown, externalUrl: unknown, sourceUrl: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!item || typeof item !== "object") return "";
      const label = "label" in item && typeof item.label === "string" ? item.label : "";
      const url = "url" in item && typeof item.url === "string" ? item.url : "";
      return label && url ? `${label} | ${url}` : "";
    }).filter(Boolean).join("\n");
  }
  return [
    typeof externalUrl === "string" && externalUrl ? `Website | ${externalUrl}` : "",
    typeof sourceUrl === "string" && sourceUrl ? `GitHub | ${sourceUrl}` : ""
  ].filter(Boolean).join("\n");
}

export function buildMarkdown(draft: StoredDraft) {
  return `${buildFrontmatter(draft.frontmatter, draft.kind)}\n\n${draft.body.trimEnd()}\n`;
}

export function parseImportedMarkdown(markdown: string, overrides: DraftOverrides = {}) {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const imported: Record<string, unknown> = {};
  let body = normalized;
  if (match) {
    body = match[2] || "";
    Object.assign(imported, parseYamlFrontmatter(match[1]));
  }

  const frontmatter: Partial<FrontmatterForm> = {
    title: typeof imported.title === "string" ? imported.title : "",
    date: typeof imported.date === "string" ? imported.date.slice(0, 10) : today,
    type: articleTypes.includes(imported.type as ArticleType) ? imported.type as ArticleType : "journal",
    slug: typeof imported.slug === "string" ? imported.slug : "",
    description: typeof imported.description === "string" ? imported.description : "",
    youtube_id: typeof imported.youtube_id === "string" ? imported.youtube_id : "",
    credits: typeof imported.credits === "string" ? imported.credits : joinList(imported.credits).replace(/,\s*/g, "\n"),
    lyrics: typeof imported.lyrics === "string" ? imported.lyrics : "",
    cloudinary_id: typeof imported.cloudinary_id === "string" ? imported.cloudinary_id : "",
    categories: joinList(imported.categories),
    detail: typeof imported.detail === "boolean" ? imported.detail : false,
    article_url: typeof imported.article_url === "string" ? imported.article_url : "",
    making_article_url: typeof imported.making_article_url === "string" ? imported.making_article_url : "",
    comparison_group: typeof imported.comparison_group === "string" ? imported.comparison_group : "",
    comparison_label: typeof imported.comparison_label === "string" ? imported.comparison_label : "",
    subtitle: typeof imported.subtitle === "string" ? imported.subtitle : "",
    heroImage: typeof imported.heroImage === "string" ? imported.heroImage : "",
    hero: typeof imported.hero === "string" ? imported.hero : typeof imported.heroImage === "string" ? imported.heroImage : "",
    status: typeof imported.status === "string" ? imported.status : "active",
    links: joinLinks(imported.links, imported.externalUrl, imported.sourceUrl),
    externalUrl: typeof imported.externalUrl === "string" ? imported.externalUrl : "",
    sourceUrl: typeof imported.sourceUrl === "string" ? imported.sourceUrl : "",
    features: joinList(imported.features),
    tags: joinList(imported.tags),
    draft: typeof imported.draft === "boolean" ? imported.draft : false,
    thumbnail: typeof imported.thumbnail === "string" ? imported.thumbnail : typeof imported.thumbnail === "boolean" ? String(imported.thumbnail) : "",
    thumbnail_alt: typeof imported.thumbnail_alt === "string" ? imported.thumbnail_alt : "",
    thumbnail_fit: typeof imported.thumbnail_fit === "string" ? imported.thumbnail_fit : "",
    thumbnail_position: typeof imported.thumbnail_position === "string" ? imported.thumbnail_position : "",
    og_image: typeof imported.og_image === "string" ? imported.og_image : "",
    featured_related: joinList(imported.featured_related),
    use_math: Boolean(imported.use_math),
    permalink: typeof imported.permalink === "string" ? imported.permalink : "",
    og_description: typeof imported.og_description === "string" ? imported.og_description : "",
    image: typeof imported.image === "string" ? imported.image : typeof imported.cloudinary_id === "string" ? imported.cloudinary_id : "",
    thumbnail_class: typeof imported.thumbnail_class === "string" ? imported.thumbnail_class : ""
  };

  const importedBody = body.trimStart();
  const fallbackBody = overrides.kind === "journal" || !overrides.kind ? defaultBody : "";
  return createEditorDraft({ ...overrides, frontmatter: { ...frontmatter, ...overrides.frontmatter }, body: importedBody || fallbackBody });
}

export function downloadDraft(draft: StoredDraft) {
  const blob = new Blob([buildMarkdown(draft)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = generatedFilename(draft.frontmatter, draft.kind) || `${draft.kind}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
