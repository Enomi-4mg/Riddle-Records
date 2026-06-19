import { z } from "zod";
import { articleTypes, type FrontmatterForm } from "../types/journal";
import { splitList } from "./frontmatter";
import { slugify } from "./permalink";

export const frontmatterSchema = z.object({
  title: z.string().min(1, "title is required"),
  date: z.string().min(1, "date is required"),
  type: z.enum(articleTypes).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().optional(),
  thumbnail: z.string().optional(),
  thumbnail_alt: z.string().optional(),
  thumbnail_fit: z.string().optional(),
  thumbnail_position: z.string().optional(),
  og_image: z.string().optional(),
  featured_related: z.array(z.string()).optional(),
  use_math: z.boolean().optional(),
  permalink: z.string().optional(),
  og_description: z.string().optional(),
  image: z.string().optional(),
  thumbnail_class: z.string().optional()
});

export function publishChecks(frontmatter: FrontmatterForm) {
  return [
    { ok: Boolean(frontmatter.title.trim()), label: "title が入力されている" },
    { ok: Boolean(frontmatter.date.trim()), label: "date が入力されている" },
    { ok: Boolean(frontmatter.description.trim()), label: "description が入力されている" },
    { ok: frontmatter.type !== "making" || Boolean(slugify(frontmatter.slug)), label: "making 記事に slug がある" },
    { ok: !frontmatter.thumbnail.trim() || Boolean(frontmatter.thumbnail_alt.trim()), label: "thumbnail 使用時に thumbnail_alt がある" }
  ];
}

export function toFrontmatterObject(frontmatter: FrontmatterForm) {
  const tags = splitList(frontmatter.tags);
  const related = splitList(frontmatter.featured_related);
  return {
    title: frontmatter.title.trim(),
    date: frontmatter.date,
    type: frontmatter.type,
    slug: slugify(frontmatter.slug) || undefined,
    description: frontmatter.description.trim() || undefined,
    tags: tags.length ? tags : undefined,
    draft: frontmatter.draft || undefined,
    thumbnail: frontmatter.thumbnail.trim() || undefined,
    thumbnail_alt: frontmatter.thumbnail_alt.trim() || undefined,
    thumbnail_fit: frontmatter.thumbnail_fit.trim() || undefined,
    thumbnail_position: frontmatter.thumbnail_position.trim() || undefined,
    og_image: frontmatter.og_image.trim() || undefined,
    featured_related: related.length ? related : undefined,
    use_math: frontmatter.use_math || undefined,
    permalink: frontmatter.permalink.trim() || undefined,
    og_description: frontmatter.og_description.trim() || undefined,
    image: frontmatter.image.trim() || undefined,
    thumbnail_class: frontmatter.thumbnail_class.trim() || undefined
  };
}
