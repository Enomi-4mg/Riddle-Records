import type { FrontmatterForm } from "../types/journal";
import type { ContentKind } from "../types/content";

export function slugify(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function generatedUrl(frontmatter: FrontmatterForm, kind: ContentKind = "journal") {
  if (kind === "songs") return frontmatter.date ? `/disco/${frontmatter.date}/` : "";
  if (kind === "gallery") {
    const slug = slugify(frontmatter.slug);
    return slug ? `/gallery/${slug}/` : "";
  }
  if (kind === "projects") {
    const slug = slugify(frontmatter.slug);
    return slug ? `/project/${slug}/` : "";
  }
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

export function generatedFilename(frontmatter: FrontmatterForm, kind: ContentKind = "journal") {
  if (!frontmatter.date) return "";
  if (kind === "songs") return `${frontmatter.date}.md`;
  const slug = slugify(frontmatter.slug);
  if ((kind === "gallery" || kind === "projects") && slug) return `${slug}.md`;
  return slug ? `${frontmatter.date}-${slug}.md` : `${frontmatter.date}.md`;
}
