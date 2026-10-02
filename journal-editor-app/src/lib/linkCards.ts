import { normalizeYouTubeId, documentSummary } from "./cmsMarkdown";
import type { ContentDocument } from "../types/content";
import { getJournalPermalink } from "../../../shared/contentRoutes";
import { resolveImageUrl } from "../../../src/utils/images";
import { internalPath, type InternalCard } from "../../../shared/embeds";

export function documentCard(doc: ContentDocument): InternalCard | undefined {
  const { kind, data } = doc.placement;
  let url = ""; let image = "";
  if (kind === "journal" && "articleType" in data) {
    if (!doc.common.date || !Number.isFinite(new Date(doc.common.date).getTime())) return;
    url = getJournalPermalink({ data: { date: new Date(doc.common.date), type: data.articleType, slug: data.slug, permalink: data.permalink } });
    image = resolveImageUrl(data.thumbnail || data.image || data.ogImage) || "";
  } else if (kind === "songs" && "youtubeId" in data) {
    const slug = doc.file?.path.replace(/\.md$/, "") || doc.common.date;
    url = `/disco/${slug}/`; image = `https://img.youtube.com/vi/${normalizeYouTubeId(data.youtubeId)}/mqdefault.jpg`;
  } else if (kind === "gallery" && "detail" in data) {
    if (!data.detail || !data.slug) return;
    url = `/gallery/${data.slug}/`; image = resolveImageUrl(data.image) || "";
  } else if (kind === "projects" && "hero" in data) {
    if (!data.slug) return;
    url = `/project/${data.slug}/`; image = resolveImageUrl(data.hero) || "";
  }
  if (!url) return;
  return { url, image, title: doc.common.title, description: documentSummary(doc) };
}
export function publishedCards(documents: ContentDocument[]) {
  return documents.filter((doc) => doc.common.publication === "published").flatMap((doc) => { const card = documentCard(doc); return card ? [card] : []; });
}
export function resolveDocumentCard(documents: ContentDocument[], url: string) {
  const path = internalPath(url);
  return publishedCards(documents).find((card) => internalPath(card.url) === path);
}
