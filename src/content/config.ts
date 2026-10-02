import { aboutProfileErrors, readAboutProfile } from "../../shared/aboutProfile";
import { normalizeUndatedDraft } from "../../shared/publicationDate";
import { normalizeContentTags } from "../../shared/contentTags";
import { defineCollection, z } from "astro:content";

const withDraftDate = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(normalizeUndatedDraft, schema);

const publicationDate = z.preprocess((value) => value == null || value === "" ? undefined : value, z.coerce.date());

const contentTags = z.array(z.string()).transform(normalizeContentTags).optional();

const journalCollection = defineCollection({
  type: "content",
  schema: withDraftDate(z.object({
    title: z.string(),
    date: publicationDate,
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
    tags: contentTags,
    thumbnail_class: z.string().optional(),
    draft: z.boolean().optional()
  }))
});

const songsCollection = defineCollection({
  type: "content",
  schema: withDraftDate(z.object({
    title: z.string(),
    date: publicationDate,
    youtube_id: z.string(),
    credits: z.union([z.string(), z.array(z.string())]).optional(),
    description: z.string().optional(),
    lyrics: z.string().optional(),
    tags: contentTags,
    draft: z.boolean().optional()
  }))
});

const galleryCollection = defineCollection({
  type: "content",
  schema: withDraftDate(z.object({
    slug: z.string().optional(),
    detail: z.boolean().optional(),
    title: z.string(),
    date: publicationDate,
    image: z.string().optional(),
    cloudinary_id: z.string().optional(),
    description: z.string().optional(),
    tags: contentTags,
    categories: contentTags,
    article_url: z.string().optional(),
    making_article_url: z.string().optional(),
    thumbnail: z.union([z.boolean(), z.string()]).optional(),
    thumbnail_alt: z.string().optional(),
    thumbnail_class: z.string().optional(),
    draft: z.boolean().optional()
  }))
});

const projectsCollection = defineCollection({
  type: "content",
  schema: withDraftDate(z.object({
    slug: z.string().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    date: publicationDate,
    description: z.string().optional(),
    tags: contentTags,
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
  }))
});

const aboutCollection = defineCollection({
  type: "content",
  schema: z.object({
    icon: z.string().default(""), name: z.string(), bio: z.string().default(""),
    birthday: z.string().default(""), motto: z.string().default(""),
    hobbies: z.array(z.string()).default([]), skills: z.array(z.string()).default([]), likes: z.array(z.string()).default([]),
    sns: z.array(z.object({ service: z.string(), url: z.string(), label: z.string().optional() })).default([]),
    featured_works: z.array(z.string()).default([])
  }).transform(readAboutProfile).superRefine((profile, context) => {
    for (const message of aboutProfileErrors(profile)) context.addIssue({ code: "custom", message });
  })
});

export const collections = {
  about: aboutCollection,
  journal: journalCollection,
  songs: songsCollection,
  gallery: galleryCollection,
  projects: projectsCollection
};
