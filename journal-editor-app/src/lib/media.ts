import type { FrontmatterForm } from "../types/journal";
import { generatedUrl, slugify } from "./permalink";

export const cloudinaryBase = "https://res.cloudinary.com/dzq8y9qes/image/upload";

export type CardLayout = "journal-card-grid" | "making-comparison-grid";

export type ImageCard = {
  id: string;
  caption: string;
  heading: string;
  cloudinaryId: string;
  description: string;
  categories: string;
  comparisonLabel: string;
  comparisonOrder: string;
  thumbnail: boolean;
  noGalleryButton: boolean;
  makingArticleUrl: string;
};

export type ResolvedImage = {
  kind: "empty" | "url" | "local" | "cloudinary";
  label: string;
  url: string;
};

export function createImageCard(overrides: Partial<ImageCard> = {}): ImageCard {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    caption: "",
    heading: "",
    cloudinaryId: "",
    description: "",
    categories: "",
    comparisonLabel: "",
    comparisonOrder: "",
    thumbnail: true,
    noGalleryButton: true,
    makingArticleUrl: "",
    ...overrides
  };
}

export function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tsString(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function resolveEditorImage(value: string, transform = "w_400,h_400,c_fill,q_auto,f_auto"): ResolvedImage {
  const image = value.trim();
  if (!image) return { kind: "empty", label: "未入力", url: "" };
  if (/^https?:\/\//.test(image)) return { kind: "url", label: "URL", url: image };
  if (image.startsWith("/")) return { kind: "local", label: "ローカルパス", url: image };
  return { kind: "cloudinary", label: "Cloudinary ID", url: `${cloudinaryBase}/${transform}/v1/${image}` };
}

function cleanCards(cards: ImageCard[]) {
  return cards.filter((card) => card.cloudinaryId.trim());
}

export function buildCardsHtml(cards: ImageCard[], layout: CardLayout, lightboxGroup: string) {
  const activeCards = cleanCards(cards);
  if (!activeCards.length) return "";
  const group = lightboxGroup.trim() || "Journal";

  if (layout === "making-comparison-grid") {
    const items = activeCards.map((card) => {
      const caption = card.caption || card.heading || "";
      const label = card.comparisonLabel || card.heading || caption;
      const blockClass = card.noGalleryButton ? " no-gallery-button" : "";
      const id = escapeHtml(card.cloudinaryId.trim());
      return `  <div class="comparison-item${blockClass}">
    <a href="${cloudinaryBase}/w_1920,q_auto,f_auto/v1/${id}" data-lightbox="${escapeHtml(group)}" data-title="${escapeHtml(caption)}">
      <img src="${cloudinaryBase}/w_300,h_300,c_fill,q_auto,f_auto/v1/${id}" alt="${escapeHtml(caption)}">
    </a>${label ? `\n    <p class="comparison-label">${escapeHtml(label)}</p>` : ""}
  </div>`;
    }).join("\n");
    return `<div class="making-comparison-grid">\n${items}\n</div>`;
  }

  const items = activeCards.map((card) => {
    const caption = card.caption || card.heading || "";
    const heading = card.heading || card.caption || "";
    const blockClass = card.noGalleryButton ? " no-gallery-button" : "";
    const id = escapeHtml(card.cloudinaryId.trim());
    return `  <div class="journal-card${blockClass}">
    <a href="${cloudinaryBase}/w_1920,q_auto,f_auto/v1/${id}" data-lightbox="${escapeHtml(group)}" data-title="${escapeHtml(caption)}">
      <img src="${cloudinaryBase}/w_300,h_300,c_fill,q_auto,f_auto/v1/${id}" alt="${escapeHtml(caption)}">
    </a>
    <div class="journal-card-info">
      <h4>${escapeHtml(heading)}</h4>
    </div>
  </div>`;
  }).join("\n");
  return `<div class="journal-card-grid">\n${items}\n</div>`;
}

export function buildGalleryCode(cards: ImageCard[], layout: CardLayout, frontmatter: FrontmatterForm) {
  const activeCards = cleanCards(cards);
  if (!activeCards.length) return "";
  const articleUrl = generatedUrl(frontmatter);
  const comparisonGroup = slugify(frontmatter.slug) || articleUrl.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");

  return activeCards.map((card, index) => {
    const title = card.caption || card.heading || `Card ${index + 1}`;
    const description = card.description || title;
    const categories = splitList(card.categories);
    const lines = [
      "{",
      `  title: ${tsString(title)},`,
      `  date: ${tsString(frontmatter.date)},`,
      `  cloudinary_id: ${tsString(card.cloudinaryId.trim())},`,
      `  description: ${tsString(description)},`,
      `  categories: [${categories.map(tsString).join(", ")}],`,
      `  article_url: ${tsString(articleUrl)},`
    ];
    if (card.makingArticleUrl.trim()) lines.push(`  making_article_url: ${tsString(card.makingArticleUrl.trim())},`);
    lines.push(`  thumbnail: ${card.thumbnail ? "true" : "false"},`);
    if (layout === "making-comparison-grid") {
      lines.push(`  comparison_group: ${tsString(comparisonGroup)},`);
      if (card.comparisonLabel || card.heading) lines.push(`  comparison_label: ${tsString(card.comparisonLabel || card.heading)},`);
      if (card.comparisonOrder) lines.push(`  comparison_order: ${Number(card.comparisonOrder)},`);
    }
    lines.push("}");
    return lines.join("\n");
  }).join(",\n");
}

export function extractCloudinaryId(url: string) {
  if (!url) return "";
  const clean = url.trim().split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function extractCardsFromHtml(html: string): ImageCard[] {
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = Array.from(doc.querySelectorAll(".journal-card, .comparison-item"));
  return nodes.map((node, index) => {
    const anchor = node.querySelector("a");
    const img = node.querySelector("img");
    const caption = anchor?.getAttribute("data-title") || img?.getAttribute("alt") || "";
    const labelNode = node.querySelector("h4") || node.querySelector(".comparison-label");
    const isComparison = node.classList.contains("comparison-item");
    return createImageCard({
      caption,
      heading: labelNode?.textContent?.trim() || caption,
      cloudinaryId: extractCloudinaryId(anchor?.getAttribute("href") || img?.getAttribute("src") || ""),
      comparisonLabel: isComparison ? labelNode?.textContent?.trim() || caption : "",
      comparisonOrder: String(index + 1),
      noGalleryButton: node.classList.contains("no-gallery-button")
    });
  }).filter((card) => card.cloudinaryId);
}

export function addRelatedIds(current: string, ids: string[]) {
  const items = splitList(current);
  ids.forEach((id) => {
    const trimmed = id.trim();
    if (trimmed && !items.includes(trimmed)) items.push(trimmed);
  });
  return items.join(", ");
}
