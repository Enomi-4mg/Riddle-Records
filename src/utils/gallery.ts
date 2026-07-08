import { getCollection } from "astro:content";
import { galleryItems, type GalleryItem } from "../data/gallery";

export type GalleryItemSource = "data" | "collection";

export type GalleryItemView = {
  source: GalleryItemSource;
  slug: string;
  detail: boolean;
  title: string;
  date: string;
  image: string;
  imageAlt: string;
  description: string;
  body: string;
  tags: readonly string[];
  article_url?: string;
  making_article_url?: string;
  thumbnail: boolean | string;
  thumbnail_alt?: string;
  thumbnail_class?: string;
};

const normalizeDate = (value: Date | string) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
};

const normalizeDataItem = (item: GalleryItem): GalleryItemView => ({
  source: "data",
  slug: item.slug,
  detail: item.detail === true,
  title: item.title,
  date: item.date,
  image: item.cloudinary_id,
  imageAlt: item.title,
  description: item.description,
  body: item.body ?? item.description,
  tags: item.categories,
  article_url: item.article_url || undefined,
  making_article_url: item.making_article_url,
  thumbnail: item.thumbnail ?? true,
  thumbnail_alt: item.title,
  thumbnail_class: item.thumbnail_class
});

type GalleryCollectionEntry = Awaited<ReturnType<typeof getCollection<"gallery">>>[number];

const normalizeCollectionItem = (entry: GalleryCollectionEntry): GalleryItemView => {
  const image = entry.data.image ?? entry.data.cloudinary_id ?? "";
  return {
    source: "collection",
    slug: entry.data.slug || entry.slug,
    detail: entry.data.detail === true,
    title: entry.data.title,
    date: normalizeDate(entry.data.date),
    image,
    imageAlt: entry.data.thumbnail_alt ?? entry.data.title,
    description: entry.data.description ?? "",
    body: entry.body?.trim() || entry.data.description || "",
    tags: entry.data.tags ?? entry.data.categories ?? [],
    article_url: entry.data.article_url,
    making_article_url: entry.data.making_article_url,
    thumbnail: entry.data.thumbnail ?? true,
    thumbnail_alt: entry.data.thumbnail_alt ?? entry.data.title,
    thumbnail_class: entry.data.thumbnail_class
  };
};

const validateGalleryViews = (items: readonly GalleryItemView[]) => {
  const owners = new Map<string, GalleryItemView>();
  const errors: string[] = [];

  items.forEach((item) => {
    if (!item.slug.trim()) {
      errors.push(`Gallery item "${item.title}" has no slug.`);
    }
    if (item.detail && !item.slug.trim()) {
      errors.push(`Gallery item "${item.title}" has detail: true but no slug.`);
    }
    if (!item.image.trim()) {
      errors.push(`Gallery item "${item.title}" has no image.`);
    }

    const owner = owners.get(item.slug);
    if (owner) {
      errors.push(`Duplicate slug "${item.slug}" from ${owner.source}:${owner.title} and ${item.source}:${item.title}.`);
      return;
    }
    owners.set(item.slug, item);
  });

  if (errors.length) {
    throw new Error(`Invalid Gallery items:\n${errors.join("\n")}`);
  }
};

export const getGalleryDetailPath = (item: Pick<GalleryItemView, "slug">) => `/gallery/${item.slug}/`;

export const hasGalleryDetail = (item: Pick<GalleryItemView, "detail">) => item.detail === true;

export const getGalleryItems = async (): Promise<readonly GalleryItemView[]> => {
  const showDrafts = !import.meta.env.PROD;
  const collectionItems = (await getCollection("gallery"))
    .filter((entry) => showDrafts || !entry.data.draft)
    .map(normalizeCollectionItem);
  const items = [...galleryItems.map(normalizeDataItem), ...collectionItems];
  validateGalleryViews(items);
  return items;
};

export const getSortedGalleryItems = async () =>
  [...await getGalleryItems()].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

export const getGalleryDetailItems = async () => (await getGalleryItems()).filter(hasGalleryDetail);

export const getLatestGalleryItems = async (count: number) => (await getSortedGalleryItems()).slice(0, count);
