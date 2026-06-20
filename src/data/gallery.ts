export type GalleryItem = {
  slug: string;
  detail?: boolean;
  title: string;
  date: string;
  cloudinary_id: string;
  description: string;
  body?: string;
  categories: readonly string[];
  article_url?: string;
  making_article_url?: string;
  thumbnail?: boolean;
  thumbnail_class?: string;
  comparison_group?: string;
  comparison_label?: string;
};

export const getGalleryDetailPath = (item: Pick<GalleryItem, "slug">) => `/gallery/${item.slug}/`;

export const hasGalleryDetail = (item: GalleryItem) => item.detail === true;

export const validateGalleryItems = (items: readonly GalleryItem[]) => {
  const errors: string[] = [];
  const slugOwners = new Map<string, string>();

  items.forEach((item) => {
    const slug = item.slug?.trim();

    if (item.detail === true && !slug) {
      errors.push(`Gallery item "${item.title}" has detail: true but no slug.`);
    }

    if (!slug) {
      return;
    }

    const owner = slugOwners.get(slug);
    if (owner) {
      errors.push(`Gallery slug "${slug}" is duplicated by "${owner}" and "${item.title}".`);
      return;
    }

    slugOwners.set(slug, item.title);
  });

  if (errors.length) {
    throw new Error(`Invalid galleryItems:\n${errors.join("\n")}`);
  }
};

export const galleryItems: readonly GalleryItem[] = [] as const;

validateGalleryItems(galleryItems);
