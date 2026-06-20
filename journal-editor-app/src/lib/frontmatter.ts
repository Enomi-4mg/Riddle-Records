import type { FrontmatterForm } from "../types/journal";
import type { ContentKind } from "../types/content";
import { slugify } from "./permalink";
import { yamlArray, yamlBlock, yamlObjectArray, yamlString } from "./yamlFrontmatter";

export function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function joinList(value: unknown) {
  return Array.isArray(value) ? value.map(String).join(", ") : typeof value === "string" ? value : "";
}

function pushMultiline(lines: string[], key: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  lines.push(`${key}: ${trimmed.includes("\n") ? yamlBlock(trimmed) : yamlString(trimmed)}`);
}

function parseProjectLinks(value: string, externalUrl: string, sourceUrl: string) {
  const fromLinks = value.split("\n").map((line) => {
    const [label, ...urlParts] = line.split("|");
    const url = urlParts.join("|").trim();
    return label?.trim() && url ? { label: label.trim(), url } : undefined;
  }).filter((link): link is { label: string; url: string } => Boolean(link));
  if (fromLinks.length) return fromLinks;
  return [
    externalUrl.trim() ? { label: "Website", url: externalUrl.trim() } : undefined,
    sourceUrl.trim() ? { label: "GitHub", url: sourceUrl.trim() } : undefined
  ].filter((link): link is { label: string; url: string } => Boolean(link));
}

export function buildFrontmatter(frontmatter: FrontmatterForm, kind: ContentKind = "journal") {
  const tags = splitList(frontmatter.tags);
  const related = splitList(frontmatter.featured_related);
  const slug = slugify(frontmatter.slug);
  const lines = ["---"];
  lines.push(`title: ${yamlString(frontmatter.title.trim() || "Untitled")}`);
  if (frontmatter.date) lines.push(`date: ${frontmatter.date}`);
  if (kind === "journal") lines.push(`type: ${yamlString(frontmatter.type)}`);
  if (slug && (kind === "journal" || kind === "gallery" || kind === "projects")) lines.push(`slug: ${yamlString(slug)}`);
  if (kind === "songs" && frontmatter.youtube_id.trim()) lines.push(`youtube_id: ${yamlString(frontmatter.youtube_id.trim())}`);
  if (kind === "gallery") {
    lines.push(`detail: ${frontmatter.detail ? "true" : "false"}`);
    if (frontmatter.image.trim()) lines.push(`image: ${yamlString(frontmatter.image.trim())}`);
  }
  if (kind === "projects") {
    if (frontmatter.hero.trim() || frontmatter.heroImage.trim()) lines.push(`hero: ${yamlString((frontmatter.hero || frontmatter.heroImage).trim())}`);
    if (frontmatter.status.trim()) lines.push(`status: ${yamlString(frontmatter.status.trim())}`);
  }
  if (frontmatter.description.trim()) lines.push(`description: ${yamlString(frontmatter.description.trim())}`);
  if (kind === "songs") {
    pushMultiline(lines, "credits", frontmatter.credits);
    pushMultiline(lines, "lyrics", frontmatter.lyrics);
  }
  if (kind === "gallery") {
    const galleryTags = splitList(frontmatter.tags || frontmatter.categories);
    if (frontmatter.thumbnail.trim()) lines.push(`thumbnail: ${frontmatter.thumbnail.trim() === "true" ? "true" : yamlString(frontmatter.thumbnail.trim())}`);
    if (frontmatter.thumbnail_alt.trim()) lines.push(`thumbnail_alt: ${yamlString(frontmatter.thumbnail_alt.trim())}`);
    if (galleryTags.length) lines.push(`tags: ${yamlArray(galleryTags)}`);
    if (frontmatter.article_url.trim()) lines.push(`article_url: ${yamlString(frontmatter.article_url.trim())}`);
    if (frontmatter.making_article_url.trim()) lines.push(`making_article_url: ${yamlString(frontmatter.making_article_url.trim())}`);
    if (frontmatter.comparison_group.trim()) lines.push(`comparison_group: ${yamlString(frontmatter.comparison_group.trim())}`);
    if (frontmatter.comparison_label.trim()) lines.push(`comparison_label: ${yamlString(frontmatter.comparison_label.trim())}`);
    lines.push(`draft: ${frontmatter.draft ? "true" : "false"}`);
    lines.push("---");
    return lines.join("\n");
  }
  if (kind === "projects") {
    const tags = splitList(frontmatter.tags);
    const features = splitList(frontmatter.features);
    const links = parseProjectLinks(frontmatter.links, frontmatter.externalUrl, frontmatter.sourceUrl);
    if (tags.length) lines.push(`tags: ${yamlArray(tags)}`);
    if (links.length) lines.push(`links:${yamlObjectArray(links)}`);
    if (features.length) lines.push(`features: ${yamlArray(features)}`);
    lines.push(`draft: ${frontmatter.draft ? "true" : "false"}`);
    lines.push("---");
    return lines.join("\n");
  }
  if (tags.length) lines.push(`tags: ${yamlArray(tags)}`);
  if (kind !== "journal") {
    lines.push("---");
    return lines.join("\n");
  }
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
