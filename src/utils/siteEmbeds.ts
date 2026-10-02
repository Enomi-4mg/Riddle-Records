import { getCollection } from "astro:content";
import { getGalleryItems, getGalleryDetailPath, hasGalleryDetail } from "./gallery";
import { getProjectItems } from "./projects";
import { getJournalRoutePath, getJournalThumbnail } from "./journal";
import { resolveImageUrl } from "./images";
import { renderContentMarkdown } from "./renderMarkdown";
import { internalPath, renderEmbed, type InternalCard, type Embed } from "../../shared/embeds";
import fallbackIconUrl from "../../favicon/icon.jpg?url";

// Build from content data, never fetch the published website during a build.
async function buildCards() {
  const [journal, songs, gallery, projects] = await Promise.all([getCollection("journal"), getCollection("songs"), getGalleryItems(), getProjectItems()]);
  const cards = new Map<string, InternalCard>();
  const add = (url: string, title: string, description = "", image = "") => cards.set(url, { url, title, description, image });
  journal.filter((entry) => !entry.data.draft).forEach((entry) => add(`/journal/${getJournalRoutePath(entry)}/`, entry.data.title, entry.data.description ?? entry.data.og_description, getJournalThumbnail(entry, gallery.filter((item) => !item.draft), fallbackIconUrl).src));
  songs.filter((entry) => !entry.data.draft).forEach((entry) => add(`/disco/${entry.slug}/`, entry.data.title, entry.data.description, `https://img.youtube.com/vi/${entry.data.youtube_id}/mqdefault.jpg`));
  gallery.filter((item) => !item.draft && hasGalleryDetail(item)).forEach((item) => add(getGalleryDetailPath(item), item.title, item.description, resolveImageUrl(item.image) || ""));
  projects.filter((item) => !item.draft).forEach((item) => add(`/project/${item.slug}/`, item.title, item.description, resolveImageUrl(item.hero) || ""));
  return cards;
}
export async function getSiteCardResolver() {
  const cards = await buildCards(); const base = import.meta.env.BASE_URL;
  return (url: string) => {
    const path = internalPath(url, "https://4mg.dev", base); const card = path && cards.get(path);
    return card ? { ...card, url: `${base.replace(/\/$/, "")}${card.url}` } : undefined;
  };
}
export async function renderSiteMarkdown(markdown: string) {
  return renderContentMarkdown(markdown, await getSiteCardResolver(), "https://4mg.dev", import.meta.env.BASE_URL, true);
}
export async function renderSiteCard(embed: Embed) {
  return renderEmbed(embed, await getSiteCardResolver(), "https://4mg.dev", import.meta.env.BASE_URL);
}
