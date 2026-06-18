import { defineCollection, z } from "astro:content";

const journalCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    og_description: z.string().optional(),
    description: z.string().optional(),
    credits: z.union([z.string(), z.array(z.string())]).optional(),
    lyrics: z.string().optional(),
    image: z.string().optional(),
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

export const collections = {
  journal: journalCollection,
  songs: songsCollection
};
