import type { GalleryItemView } from "./gallery";
import { resolveImageUrl } from "./images";

const cloudinaryBase = "https://res.cloudinary.com/dzq8y9qes/image/upload";

const normalizeJournalPath = (path: string) => path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/^journal\//, "");

const dateParts = (date: Date) => {
  const isoDate = date.toISOString().slice(0, 10);
  const [year, month, day] = isoDate.split("-");
  return { isoDate, year, month, day };
};

export const getJournalPermalink = (entry: { data: { date: Date; permalink?: string; type?: string; slug?: string } }) => {
  if (entry.data.permalink) {
    return entry.data.permalink;
  }

  const { isoDate, year, month, day } = dateParts(entry.data.date);
  const type = entry.data.type ?? "journal";
  const slug = entry.data.slug?.trim();

  if (type === "making") {
    return slug ? `/journal/${year}/${month}/${day}/${slug}/` : `/journal/${isoDate}/`;
  }

  if (type === "report") {
    return `/journal/${year}-${month}/`;
  }

  return `/journal/${isoDate}/`;
};

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
      src: `${cloudinaryBase}/w_400,h_400,c_fill,q_auto,f_auto/v1/${galleryThumbnail.image}`,
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
