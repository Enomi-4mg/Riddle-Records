import type { FrontmatterForm } from "../types/journal";

export function slugify(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function generatedUrl(frontmatter: FrontmatterForm) {
  if (frontmatter.permalink.trim()) return frontmatter.permalink.trim();
  if (!frontmatter.date) return "";
  const slug = slugify(frontmatter.slug);
  if (frontmatter.type === "making" && slug) {
    const [year, month, day] = frontmatter.date.split("-");
    return `/journal/${year}/${month}/${day}/${slug}/`;
  }
  if (frontmatter.type === "report") return `/journal/${frontmatter.date.slice(0, 7)}/`;
  return `/journal/${frontmatter.date}/`;
}

export function generatedFilename(frontmatter: FrontmatterForm) {
  if (!frontmatter.date) return "";
  const slug = slugify(frontmatter.slug);
  return slug ? `${frontmatter.date}-${slug}.md` : `${frontmatter.date}.md`;
}
