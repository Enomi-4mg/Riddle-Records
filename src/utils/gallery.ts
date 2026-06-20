import { getCollection } from "astro:content";
import { galleryItems, type GalleryItem } from "../data/gallery";

export type GalleryItemSource = "data" | "collection";

export type GalleryItemView = {
  source: GalleryItemSource;
  slug: string;
  hasFrontmatterSlug: boolean;
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
  comparison_group?: string;
  comparison_label?: string;
};

const rawGalleryFiles = import.meta.glob("../content/gallery/*.md", {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>;

const normalizeDate = (value: Date | string) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
};

const getRawGalleryFile = (entry: GalleryCollectionEntry) => {
  const candidates = [`../content/gallery/${entry.id}`, `../content/gallery/${entry.slug}.md`];
  const directMatch = candidates.find((candidate) => rawGalleryFiles[candidate]);
  if (directMatch) return rawGalleryFiles[directMatch];
  return Object.entries(rawGalleryFiles).find(([path]) => path.endsWith(`/${entry.id}`) || path.endsWith(`/${entry.slug}.md`))?.[1] ?? "";
};

const hasFrontmatterKey = (markdown: string, key: string) => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return false;
  return new RegExp(`^${key}:`, "m").test(match[1]);
};

const getFrontmatterStringValue = (markdown: string, key: string) => {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;
  const valueMatch = match[1].match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
  if (!valueMatch) return undefined;
  return valueMatch[1].replace(/^['"]|['"]$/g, "").trim();
};

const getFrontmatterBooleanValue = (markdown: string, key: string) => {
  const value = getFrontmatterStringValue(markdown, key);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const validateRawGalleryFiles = () => {
  const owners = new Map<string, string>();
  const errors: string[] = [];

  Object.entries(rawGalleryFiles).forEach(([path, markdown]) => {
    const title = getFrontmatterStringValue(markdown, "title") || path;
    const slug = getFrontmatterStringValue(markdown, "slug");
    const detail = getFrontmatterBooleanValue(markdown, "detail") === true;
    const image = getFrontmatterStringValue(markdown, "image") || getFrontmatterStringValue(markdown, "cloudinary_id");

    if (!slug) {
      errors.push(`Gallery file "${path}" has no frontmatter slug.`);
    }
    if (detail && !slug) {
      errors.push(`Gallery file "${path}" has detail: true but no frontmatter slug.`);
    }
    if (!image) {
      errors.push(`Gallery file "${path}" has no image.`);
    }

    if (!slug) return;
    const owner = owners.get(slug);
    if (owner) {
      errors.push(`Duplicate gallery slug "${slug}" from ${owner} and ${path}.`);
      return;
    }
    owners.set(slug, `${path} (${title})`);
  });

  if (errors.length) {
    throw new Error(`Invalid Gallery source files:\n${errors.join("\n")}`);
  }
};

const normalizeDataItem = (item: GalleryItem): GalleryItemView => ({
  source: "data",
  slug: item.slug,
  hasFrontmatterSlug: true,
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
  thumbnail_class: item.thumbnail_class,
  comparison_group: item.comparison_group,
  comparison_label: item.comparison_label
});

type GalleryCollectionEntry = Awaited<ReturnType<typeof getCollection<"gallery">>>[number];

const normalizeCollectionItem = (entry: GalleryCollectionEntry): GalleryItemView => {
  const image = entry.data.image ?? entry.data.cloudinary_id ?? "";
  const rawFile = getRawGalleryFile(entry);
  const frontmatterSlug = getFrontmatterStringValue(rawFile, "slug");
  const slug = frontmatterSlug || entry.data.slug || entry.slug;
  return {
    source: "collection",
    slug,
    hasFrontmatterSlug: hasFrontmatterKey(rawFile, "slug"),
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
    thumbnail_class: entry.data.thumbnail_class,
    comparison_group: entry.data.comparison_group,
    comparison_label: entry.data.comparison_label
  };
};

const validateGalleryViews = (items: readonly GalleryItemView[]) => {
  const owners = new Map<string, GalleryItemView>();
  const errors: string[] = [];

  items.forEach((item) => {
    if (!item.slug.trim()) {
      errors.push(`Gallery item "${item.title}" has no slug.`);
    }
    if (item.source === "collection" && !item.hasFrontmatterSlug) {
      errors.push(`Gallery collection item "${item.title}" has no frontmatter slug.`);
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
  validateRawGalleryFiles();
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
