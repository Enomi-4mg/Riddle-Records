import { z } from "zod";
import { articleTypes, type FrontmatterForm } from "../types/journal";
import type { ContentKind } from "../types/content";
import { contentKindSchemas } from "../types/content";
import { splitList } from "./frontmatter";
import { slugify } from "./permalink";

export const frontmatterSchema = z.object({
  title: z.string().min(1, "title is required"),
  date: z.string().min(1, "date is required"),
  type: z.enum(articleTypes).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  youtube_id: z.string().optional(),
  credits: z.string().optional(),
  lyrics: z.string().optional(),
  cloudinary_id: z.string().optional(),
  categories: z.array(z.string()).optional(),
  detail: z.boolean().optional(),
  article_url: z.string().optional(),
  making_article_url: z.string().optional(),
  comparison_group: z.string().optional(),
  comparison_label: z.string().optional(),
  subtitle: z.string().optional(),
  heroImage: z.string().optional(),
  hero: z.string().optional(),
  status: z.string().optional(),
  links: z.string().optional(),
  externalUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
  features: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  draft: z.boolean().optional(),
  thumbnail: z.union([z.string(), z.boolean()]).optional(),
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

export function publishChecks(frontmatter: FrontmatterForm, kind: ContentKind = "journal") {
  const valueOf = (key: string) => {
    const value = frontmatter[key as keyof FrontmatterForm];
    return typeof value === "string" ? value.trim() : value;
  };
  const checks = [
    { ok: Boolean(frontmatter.title.trim()), label: "title が入力されている" },
    { ok: Boolean(frontmatter.date.trim()), label: "date が入力されている" },
    { ok: Boolean(frontmatter.description.trim()), label: "description が入力されている" }
  ];
  contentKindSchemas[kind].fields
    .filter((field) => field.required && !["title", "date"].includes(field.key))
    .forEach((field) => {
      checks.push({ ok: Boolean(valueOf(field.key)), label: `${field.key} が入力されている` });
    });
  if (kind === "journal") {
    checks.push(
      { ok: frontmatter.type !== "making" || Boolean(slugify(frontmatter.slug)), label: "making 記事に slug がある" },
      { ok: !frontmatter.thumbnail.trim() || Boolean(frontmatter.thumbnail_alt.trim()), label: "thumbnail 使用時に thumbnail_alt がある" }
    );
  }
  if (kind === "songs") {
    checks.push({ ok: Boolean(frontmatter.youtube_id.trim()), label: "youtube_id が入力されている" });
  }
  return checks;
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
    youtube_id: frontmatter.youtube_id.trim() || undefined,
    credits: frontmatter.credits.trim() || undefined,
    lyrics: frontmatter.lyrics.trim() || undefined,
    cloudinary_id: frontmatter.cloudinary_id.trim() || undefined,
    image: frontmatter.image.trim() || undefined,
    categories: splitList(frontmatter.categories),
    detail: frontmatter.detail || undefined,
    article_url: frontmatter.article_url.trim() || undefined,
    making_article_url: frontmatter.making_article_url.trim() || undefined,
    comparison_group: frontmatter.comparison_group.trim() || undefined,
    comparison_label: frontmatter.comparison_label.trim() || undefined,
    subtitle: frontmatter.subtitle.trim() || undefined,
    heroImage: frontmatter.heroImage.trim() || undefined,
    hero: frontmatter.hero.trim() || undefined,
    status: frontmatter.status.trim() || undefined,
    links: frontmatter.links.trim() || undefined,
    externalUrl: frontmatter.externalUrl.trim() || undefined,
    sourceUrl: frontmatter.sourceUrl.trim() || undefined,
    features: splitList(frontmatter.features),
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
    thumbnail_class: frontmatter.thumbnail_class.trim() || undefined
  };
}
