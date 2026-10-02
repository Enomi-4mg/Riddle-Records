import { getCollection } from "astro:content";
import { hasVisiblePublicationDate } from "../../shared/publicationDate";
import { normalizeContentTags } from "../../shared/contentTags";
import { galleryWorkPath, workReference, type WorkPreview } from "../../shared/workIdentity";
import { getGalleryDetailPath, getGalleryItems, hasGalleryDetail } from "./gallery";
import { resolveImageUrl } from "./images";

export type ViewingWork = WorkPreview & {
  date: string; description: string; tags: readonly string[]; image: string; imageAlt: string;
  legacyHash?: string; youtubeId?: string; credits?: string; links: Array<{ label: string; url: string }>;
};
export { galleryWorkPath };
export async function getViewingWorks(): Promise<ViewingWork[]> {
  const visuals: ViewingWork[] = (await getGalleryItems()).map((item) => ({
    id: workReference("gallery", item.slug), kind: "visual", title: item.title,
    legacyHash: item.image.replace(/\./g, "-"), date: item.date, description: item.description, tags: item.tags,
    image: resolveImageUrl(item.image, "w_1920,q_auto,f_auto"), imageAlt: item.imageAlt,
    thumbnail: resolveImageUrl(item.image, "w_600,h_400,c_fill,q_auto,f_auto"),
    links: [
      ...(hasGalleryDetail(item) ? [{ label: "詳細記事", url: getGalleryDetailPath(item) }] : []),
      ...(item.article_url ? [{ label: "作品記事", url: item.article_url }] : []),
      ...(item.making_article_url ? [{ label: "メイキング", url: item.making_article_url }] : [])
    ]
  }));
  const music: ViewingWork[] = (await getCollection("songs"))
    .filter((entry) => hasVisiblePublicationDate(entry.data, !import.meta.env.PROD))
    .map((entry) => ({
      id: workReference("songs", entry.slug), kind: "music", title: entry.data.title,
      date: entry.data.date.toISOString().slice(0, 10), description: entry.data.description ?? "",
      tags: normalizeContentTags(entry.data.tags ?? []), image: "", imageAlt: entry.data.title,
      thumbnail: `https://img.youtube.com/vi/${entry.data.youtube_id}/sddefault.jpg`,
      youtubeId: entry.data.youtube_id,
      credits: Array.isArray(entry.data.credits) ? entry.data.credits.join("\n") : entry.data.credits,
      links: [{ label: "歌詞・詳細ページ", url: `/disco/${entry.slug}/` }]
    }));
  const works = [...visuals, ...music].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.title.localeCompare(b.title, "ja"));
  if (new Set(works.map((work) => work.id)).size !== works.length) throw new Error("Duplicate Gallery work reference");
  return works;
}
