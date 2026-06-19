import type { FrontmatterForm } from "../types/journal";
import { slugify } from "./permalink";

export function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function joinList(value: unknown) {
  return Array.isArray(value) ? value.map(String).join(", ") : typeof value === "string" ? value : "";
}

function yamlString(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlArray(items: string[]) {
  return `[${items.map(yamlString).join(", ")}]`;
}

export function buildFrontmatter(frontmatter: FrontmatterForm) {
  const tags = splitList(frontmatter.tags);
  const related = splitList(frontmatter.featured_related);
  const slug = slugify(frontmatter.slug);
  const lines = ["---"];
  lines.push(`title: ${yamlString(frontmatter.title.trim() || "Untitled")}`);
  if (frontmatter.date) lines.push(`date: ${frontmatter.date}`);
  lines.push(`type: ${yamlString(frontmatter.type)}`);
  if (slug) lines.push(`slug: ${yamlString(slug)}`);
  if (frontmatter.description.trim()) lines.push(`description: ${yamlString(frontmatter.description.trim())}`);
  if (tags.length) lines.push(`tags: ${yamlArray(tags)}`);
  if (frontmatter.draft) lines.push("draft: true");
  if (frontmatter.thumbnail.trim()) lines.push(`thumbnail: ${yamlString(frontmatter.thumbnail.trim())}`);
  if (frontmatter.thumbnail_alt.trim()) lines.push(`thumbnail_alt: ${yamlString(frontmatter.thumbnail_alt.trim())}`);
  if (frontmatter.thumbnail_fit.trim()) lines.push(`thumbnail_fit: ${yamlString(frontmatter.thumbnail_fit.trim())}`);
  if (frontmatter.thumbnail_position.trim()) lines.push(`thumbnail_position: ${yamlString(frontmatter.thumbnail_position.trim())}`);
  if (frontmatter.og_image.trim()) lines.push(`og_image: ${yamlString(frontmatter.og_image.trim())}`);
  if (related.length) lines.push(`featured_related: ${yamlArray(related)}`);
  if (frontmatter.use_math) lines.push("use_math: true");
  if (frontmatter.permalink.trim()) lines.push(`permalink: ${frontmatter.permalink.trim()}`);
  if (frontmatter.og_description.trim()) lines.push(`og_description: ${yamlString(frontmatter.og_description.trim())}`);
  if (frontmatter.image.trim()) lines.push(`image: ${yamlString(frontmatter.image.trim())}`);
  if (frontmatter.thumbnail_class.trim()) lines.push(`thumbnail_class: ${yamlString(frontmatter.thumbnail_class.trim())}`);
  lines.push("---");
  return lines.join("\n");
}
