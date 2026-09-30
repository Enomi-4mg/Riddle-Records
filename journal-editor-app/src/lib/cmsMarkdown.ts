import { dump, load } from "js-yaml";
import { createPlacement, type ContentDocument, type ContentKind } from "../types/content";
import { slugify } from "./permalink";

const knownKeys = new Set(["title", "date", "description", "tags", "draft", "type", "slug", "thumbnail", "thumbnail_alt", "thumbnail_fit", "thumbnail_position", "og_image", "og_description", "featured_related", "use_math", "permalink", "image", "thumbnail_class", "youtube_id", "credits", "lyrics", "detail", "article_url", "making_article_url", "hero", "heroImage", "status", "links", "features", "externalUrl", "sourceUrl", "cloudinary_id", "categories", "subtitle"]);
const list = (value: unknown) => Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(",").map((part) => part.trim()).filter(Boolean) : [];
export const parseTagInput = (value: string) => value.split(",").map((tag) => tag.trim()).filter(Boolean);
const text = (value: unknown) => typeof value === "string" ? value : "";
const dateText = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : text(value).slice(0, 10);
export function normalizeYouTubeId(value: string) {
  const candidate = value.trim();
  if (/^[\w-]{11}$/.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.pathname === "/watch" ? url.searchParams.get("v") || "" : url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1] || "";
      return /^[\w-]{11}$/.test(id) ? id : "";
    }
  } catch { /* Invalid URL. */ }
  return "";
}

export function createContentDocument(kind: ContentKind): ContentDocument {
  const timestamp = new Date().toISOString();
  return { id: crypto.randomUUID(), common: { title: "", date: timestamp.slice(0, 10), description: "", tags: [], publication: "draft" }, placement: createPlacement(kind), body: "", unknownFrontmatter: {}, createdAt: timestamp, updatedAt: timestamp, source: "manual" };
}

export function parseContentMarkdown(markdown: string, kind: ContentKind, file?: { path: string; revision?: string }): ContentDocument {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const raw = (match ? load(match[1]) : {}) as Record<string, unknown> || {};
  const doc = createContentDocument(kind);
  doc.id = file ? `file:${kind}:${file.path}` : doc.id; doc.source = file ? "imported" : "uploaded"; doc.file = file;
  doc.common = { title: text(raw.title), date: dateText(raw.date) || doc.common.date, description: text(raw.description), tags: list(raw.tags), publication: raw.draft === true ? "draft" : "published" };
  doc.body = match ? match[2] : normalized;
  doc.unknownFrontmatter = Object.fromEntries(Object.entries(raw).filter(([key]) => !knownKeys.has(key)));
  if (kind === "journal") doc.placement = { kind, data: { articleType: ["making", "report"].includes(text(raw.type)) ? text(raw.type) as "making" | "report" : "journal", slug: text(raw.slug), thumbnail: typeof raw.thumbnail === "boolean" ? String(raw.thumbnail) : text(raw.thumbnail), thumbnailAlt: text(raw.thumbnail_alt), thumbnailFit: text(raw.thumbnail_fit), thumbnailPosition: text(raw.thumbnail_position), ogImage: text(raw.og_image), ogDescription: text(raw.og_description), relatedContent: list(raw.featured_related), useMath: raw.use_math === true, permalink: text(raw.permalink), image: text(raw.image), thumbnailClass: text(raw.thumbnail_class) } };
  if (kind === "songs") doc.placement = { kind, data: { youtubeId: text(raw.youtube_id), credits: Array.isArray(raw.credits) ? raw.credits.join("\n") : text(raw.credits), lyrics: text(raw.lyrics) } };
  if (kind === "gallery") {
    const articleUrl = text(raw.article_url), makingArticleUrl = text(raw.making_article_url);
    if ((articleUrl || makingArticleUrl) && !/^## 関連記事\s*$/m.test(doc.body)) doc.body = `${doc.body.trimEnd()}\n\n## 関連記事\n${articleUrl ? `\n- [作品記事](${articleUrl})` : ""}${makingArticleUrl ? `\n- [メイキング](${makingArticleUrl})` : ""}\n`;
    doc.placement = { kind, data: { slug: text(raw.slug) || (file?.path.replace(/\.md$/, "") ?? ""), detail: raw.detail === true, image: text(raw.image) || text(raw.cloudinary_id), thumbnail: typeof raw.thumbnail === "boolean" ? String(raw.thumbnail) : text(raw.thumbnail), thumbnailAlt: text(raw.thumbnail_alt), articleUrl: "", makingArticleUrl: "" } };
  }
  if (kind === "projects") {
    const features = list(raw.features);
    if (features.length && !/^## 主な機能\s*$/m.test(doc.body)) doc.body = `${doc.body.trimEnd()}\n\n## 主な機能\n\n${features.map((feature) => `- ${feature}`).join("\n")}\n`;
    doc.placement = { kind, data: { slug: text(raw.slug) || (file?.path.replace(/\.md$/, "") ?? ""), hero: text(raw.hero) || text(raw.heroImage), status: ["paused", "completed", "archived"].includes(text(raw.status)) ? text(raw.status) as "paused" | "completed" | "archived" : "active", links: Array.isArray(raw.links) ? raw.links.flatMap((item) => item && typeof item === "object" && "label" in item && "url" in item ? [{ label: String(item.label), url: String(item.url) }] : []) : [], features: [] } };
  }
  return doc;
}

export function contentFrontmatter(doc: ContentDocument) {
  const value: Record<string, unknown> = { ...doc.unknownFrontmatter, title: doc.common.title || "Untitled", date: doc.common.date };
  if (doc.placement.kind === "journal") Object.assign(value, { type: doc.placement.data.articleType, ...(doc.placement.data.slug && { slug: slugify(doc.placement.data.slug) }), ...(doc.placement.data.thumbnail && { thumbnail: doc.placement.data.thumbnail }), ...(doc.placement.data.thumbnailAlt && { thumbnail_alt: doc.placement.data.thumbnailAlt }), ...(doc.placement.data.thumbnailFit && { thumbnail_fit: doc.placement.data.thumbnailFit }), ...(doc.placement.data.thumbnailPosition && { thumbnail_position: doc.placement.data.thumbnailPosition }), ...(doc.placement.data.ogImage && { og_image: doc.placement.data.ogImage }), ...(doc.placement.data.ogDescription && { og_description: doc.placement.data.ogDescription }), ...(doc.placement.data.relatedContent.length && { featured_related: doc.placement.data.relatedContent }), ...(doc.placement.data.useMath && { use_math: true }), ...(doc.placement.data.permalink && { permalink: doc.placement.data.permalink }), ...(doc.placement.data.image && { image: doc.placement.data.image }), ...(doc.placement.data.thumbnailClass && { thumbnail_class: doc.placement.data.thumbnailClass }) });
  if (doc.placement.kind === "songs") Object.assign(value, { youtube_id: normalizeYouTubeId(doc.placement.data.youtubeId), ...(doc.placement.data.credits && { credits: doc.placement.data.credits }), ...(doc.placement.data.lyrics && { lyrics: doc.placement.data.lyrics }) });
  if (doc.placement.kind === "gallery") Object.assign(value, { slug: slugify(doc.placement.data.slug), detail: doc.placement.data.detail, image: doc.placement.data.image, ...(doc.placement.data.thumbnail && { thumbnail: doc.placement.data.thumbnail === "true" ? true : doc.placement.data.thumbnail === "false" ? false : doc.placement.data.thumbnail }), ...(doc.placement.data.thumbnailAlt && { thumbnail_alt: doc.placement.data.thumbnailAlt }) });
  if (doc.placement.kind === "projects") Object.assign(value, { slug: slugify(doc.placement.data.slug), ...(doc.placement.data.hero && { hero: doc.placement.data.hero }), status: doc.placement.data.status, ...(doc.placement.data.links.length && { links: doc.placement.data.links }) });
  if (doc.common.description) value.description = doc.common.description;
  if (doc.common.tags.length) value.tags = doc.common.tags;
  value.draft = doc.common.publication === "draft";
  return value;
}

export function buildContentMarkdown(doc: ContentDocument) { return `---\n${dump(contentFrontmatter(doc), { noRefs: true, lineWidth: -1 }).trimEnd()}\n---\n\n${doc.body.trimEnd()}\n`; }
export function generatedContentFilename(doc: ContentDocument) {
  if (doc.file?.path) return doc.file.path;
  if (doc.placement.kind === "songs") return doc.common.date ? `${doc.common.date}.md` : "";
  const slug = "slug" in doc.placement.data ? slugify(doc.placement.data.slug) : "";
  if ((doc.placement.kind === "gallery" || doc.placement.kind === "projects") && slug) return `${slug}.md`;
  return doc.common.date ? `${doc.common.date}${slug ? `-${slug}` : ""}.md` : "";
}

export function publicationChecks(doc: ContentDocument) {
  const checks = [{ ok: Boolean(doc.common.title.trim()), label: "タイトル" }, { ok: Boolean(doc.common.date), label: "日付" }];
  if (doc.placement.kind === "songs") checks.push({ ok: Boolean(normalizeYouTubeId(doc.placement.data.youtubeId)), label: "YouTube URL または ID" });
  if (doc.placement.kind === "gallery") checks.push({ ok: Boolean(slugify(doc.placement.data.slug)), label: "slug" }, { ok: Boolean(doc.placement.data.image.trim()), label: "メイン画像" });
  if (doc.placement.kind === "projects") checks.push({ ok: Boolean(slugify(doc.placement.data.slug)), label: "slug" });
  if (doc.placement.kind === "journal" && doc.placement.data.articleType === "making") checks.push({ ok: Boolean(slugify(doc.placement.data.slug)), label: "making記事のslug" });
  return checks;
}
