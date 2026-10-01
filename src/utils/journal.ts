import { getJournalPermalink } from "../../shared/contentRoutes";
import type { GalleryItemView } from "./gallery";
import { resolveImageUrl } from "./images";


const normalizeJournalPath = (path: string) => path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/^journal\//, "");

export { getJournalPermalink } from "../../shared/contentRoutes";

export const getJournalRoutePath = (entry: { data: { date: Date; permalink?: string; type?: string; slug?: string } }) =>
  normalizeJournalPath(getJournalPermalink(entry));

export const toJournalRoutePath = normalizeJournalPath;

type JournalThumbnailEntry = {
  data: {
    title: string;
    date: Date;
    permalink?: string;
    type?: string;
    slug?: string;
    thumbnail?: string;
    thumbnail_alt?: string;
    thumbnail_class?: string;
    image?: string;
  };
};

export const getJournalThumbnail = (
  entry: JournalThumbnailEntry,
  galleryItems: readonly GalleryItemView[],
  fallbackIconUrl: string
) => {
  const explicitThumbnail = resolveImageUrl(entry.data.thumbnail, "w_400,h_400,c_fill,q_auto,f_auto");
  if (explicitThumbnail) {
    return {
      src: explicitThumbnail,
      alt: entry.data.thumbnail_alt ?? entry.data.title
    };
  }

  const journalPath = getJournalRoutePath(entry);
  const galleryThumbnail = entry.data.thumbnail_class
    ? galleryItems.find((item) => item.thumbnail_class === entry.data.thumbnail_class && item.thumbnail !== false)
    : galleryItems.find((item) => {
      if (item.thumbnail === false) {
        return false;
      }

      return (
        (item.article_url && toJournalRoutePath(item.article_url) === journalPath) ||
        (item.making_article_url && toJournalRoutePath(item.making_article_url) === journalPath)
      );
    });

  if (galleryThumbnail) {
    return {
      src: resolveImageUrl(galleryThumbnail.image, "w_400,h_400,c_fill,q_auto,f_auto")!,
      alt: galleryThumbnail.imageAlt
    };
  }

  const legacyImage = resolveImageUrl(entry.data.image, "w_400,h_400,c_fill,q_auto,f_auto");
  if (legacyImage) {
    return {
      src: legacyImage,
      alt: entry.data.thumbnail_alt ?? entry.data.title
    };
  }

  return {
    src: fallbackIconUrl,
    alt: entry.data.title
  };
};

/** Reject collisions before Astro can overwrite a generated article. */
export function assertUniqueJournalRoutes(entries: readonly { id: string; data: { date: Date; permalink?: string; type?: string; slug?: string } }[]) {
  const routes = new Map<string, string>();
  for (const entry of entries) {
    const route = getJournalRoutePath(entry);
    const previous = routes.get(route);
    if (previous !== undefined) throw new Error(`Journal URL collision: /journal/${route}/ (${previous}, ${entry.id}). Use one report per month or set a unique permalink.`);
    routes.set(route, entry.id);
  }
}
