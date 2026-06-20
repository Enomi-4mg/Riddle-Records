import { defineCollection, z } from "astro:content";

const journalCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    type: z.enum(["journal", "making", "report"]).optional().default("journal"),
    slug: z.string().optional(),
    og_description: z.string().optional(),
    description: z.string().optional(),
    credits: z.union([z.string(), z.array(z.string())]).optional(),
    lyrics: z.string().optional(),
    image: z.string().optional(),
    thumbnail: z.string().optional(),
    thumbnail_alt: z.string().optional(),
    thumbnail_fit: z.string().optional(),
    thumbnail_position: z.string().optional(),
    og_image: z.string().optional(),
    permalink: z.string().optional(),
    featured_related: z.array(z.string()).nullable().optional(),
    use_math: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    thumbnail_class: z.string().optional(),
    draft: z.boolean().optional()
  })
});

const songsCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    youtube_id: z.string(),
    credits: z.union([z.string(), z.array(z.string())]).optional(),
    description: z.string().optional(),
    lyrics: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
});

const galleryCollection = defineCollection({
  type: "content",
  schema: z.object({
    slug: z.string().optional(),
    detail: z.boolean().optional(),
    title: z.string(),
    date: z.coerce.date(),
    image: z.string().optional(),
    cloudinary_id: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    article_url: z.string().optional(),
    making_article_url: z.string().optional(),
    thumbnail: z.union([z.boolean(), z.string()]).optional(),
    thumbnail_alt: z.string().optional(),
    thumbnail_class: z.string().optional(),
    draft: z.boolean().optional(),
    comparison_group: z.string().optional(),
    comparison_label: z.string().optional(),
    comparison_order: z.number().optional()
  })
});

const projectsCollection = defineCollection({
  type: "content",
  schema: z.object({
    slug: z.string().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.coerce.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    hero: z.string().optional(),
    status: z.enum(["active", "paused", "archived", "completed"]).optional(),
    links: z.array(z.object({
      label: z.string(),
      url: z.string()
    })).optional(),
    draft: z.boolean().optional(),
    heroImage: z.string().optional(),
    externalUrl: z.string().optional(),
    sourceUrl: z.string().optional(),
    features: z.array(z.string()).optional()
  })
});

export const collections = {
  journal: journalCollection,
  songs: songsCollection,
  gallery: galleryCollection,
  projects: projectsCollection
};
