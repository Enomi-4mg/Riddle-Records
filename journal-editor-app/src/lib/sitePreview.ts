import { marked } from "marked";
import { escapeHtml as escape, parseEmbed, renderEmbed, safeLink } from "../../../shared/embeds";
import { projectStatusLabel } from "../../../shared/projectStatus";
import { resolveImageUrl } from "../../../src/utils/images";
import { documentSummary, normalizeYouTubeId } from "./cmsMarkdown";
import { resolveDocumentCard } from "./linkCards";
import type { ContentDocument } from "../types/content";

export function previewMarkdown(markdown: string, documents: ContentDocument[]) {
  const renderer = new marked.Renderer();
  renderer.code = (token) => {
    const embed = token.lang === "riddle-embed" && parseEmbed(token.text);
    return embed ? renderEmbed(embed, (url) => resolveDocumentCard(documents, url)) : new marked.Renderer().code(token);
  };
  return marked.parse(markdown, { async: false, gfm: true, renderer });
}
const date = (value: string) => value ? escape(value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日")) : "公開日未設定";
const image = (value: string, alt: string, transform?: string) => {
  const src = resolveImageUrl(value, transform);
  return src && safeLink(src) ? `<img src="${escape(src)}" alt="${escape(alt)}">` : "";
};
const back = (kind: string) => `<div class="journal-back-link"><a href="#">${kind}一覧へ戻る</a></div>`;

export function renderPreviewArticle(doc: ContentDocument, documents: ContentDocument[]) {
  if (doc.placement.kind === "about") return "";
  const { kind, data } = doc.placement;
  const title = escape(doc.common.title || "Untitled");
  const lead = documentSummary(doc) || (kind === "journal" ? doc.common.title : "");
  const hero = `<header class="journal-hero"><p class="journal-date"><time datetime="${escape(doc.common.date)}">${date(doc.common.date)}</time></p><h1 class="page_title">${title}</h1>${kind === "projects" && "status" in data ? `<p class="project-status" data-status="${escape(data.status)}">状態: ${projectStatusLabel(data.status)}</p>` : ""}${lead ? `<p class="journal-summary">${escape(lead)}</p>` : ""}</header>`;
  let body = previewMarkdown(doc.body || (kind === "projects" ? doc.common.description : ""), documents);
  let extras = "";
  if (kind === "songs" && "youtubeId" in data) {
    const id = normalizeYouTubeId(data.youtubeId);
    body = `${id ? `<div class="song-video responsive-video-container"><iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${id}" title="${title}" allowfullscreen></iframe></div>` : ""}<div class="rendered-markdown">${body}</div>`;
    extras = `${data.credits ? `<section class="post-info song-meta"><div class="post-credits"><h3>クレジット</h3><pre>${escape(data.credits)}</pre></div></section>` : ""}${data.lyrics ? `<section class="post-lyrics"><details><summary>歌詞</summary><pre>${escape(data.lyrics)}</pre></details></section>` : ""}`;
  }
  if (kind === "gallery" && "image" in data) {
    const tags = doc.common.tags.map((tag) => `<span class="work-tag">${escape(tag)}</span>`).join("");
    body = `<a class="work-detail-image" href="#">${image(data.image, data.thumbnailAlt || doc.common.title, "w_1400,q_auto,f_auto")}</a><div class="work-tags">${tags}</div><div class="rendered-markdown">${body}</div>`;
  }
  if (kind === "projects" && "hero" in data) {
    const heroImage = image(data.hero, `${doc.common.title} preview`);
    const links = data.links.filter((link) => safeLink(link.url));
    body = `<div class="project-hero${heroImage ? "" : " project-hero-fallback"}">${heroImage || `<span>${title}</span>`}</div><section class="project-section"><h2>概要</h2><div class="rendered-markdown">${body}</div></section>${data.features.length ? `<section class="project-section"><h2>主な機能</h2><ul class="project-feature-list">${data.features.map((feature) => `<li>${escape(feature)}</li>`).join("")}</ul></section>` : ""}${doc.common.tags.length ? `<section class="project-section"><h2>タグ</h2><div class="project-tags">${doc.common.tags.map((tag) => `<span class="project-tag">${escape(tag)}</span>`).join("")}</div></section>` : ""}${links.length ? `<section class="project-section"><h2>リンク</h2><div class="project-actions">${links.map((link, index) => `<a class="project-action${index === 0 ? " project-action-primary" : ""}" href="${escape(safeLink(link.url))}">${escape(link.label)}</a>`).join("")}</div></section>` : ""}`;
  }
  const classes = kind === "projects" ? "project-detail journal-article" : kind === "gallery" ? "journal-article" : `post journal-article ${kind === "songs" ? "song-article" : ""}`;
  const contentClasses = kind === "projects" ? "journal-content project-content" : kind === "gallery" ? "journal-content work-detail-content" : `post-content journal-content ${kind === "songs" ? "song-content" : ""}`;
  const label = kind === "projects" ? "Project" : kind === "journal" ? "Journal" : "Works";
  return `<article class="${classes}">${back(label)}${hero}<div class="${contentClasses}">${body}</div>${extras}${back(label)}</article>`;
}

export function buildPreviewDocument(doc: ContentDocument, documents: ContentDocument[], css: string, icon: string) {
  return `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="https://4mg.dev/"><title>${escape(doc.common.title)} - プレビュー</title><link href="https://fonts.googleapis.com/css2?family=Kiwi+Maru:wght@400;500&display=swap" rel="stylesheet"><style>${css}</style></head><body><header class="site-header"><div class="header-container"><nav class="header-nav header-nav-left"><ul class="nav-menu"><li class="nav-item"><a href="#">Home</a></li><li class="nav-item"><a href="#">About</a></li><li class="nav-item"><a href="#">Journal</a></li></ul></nav><a class="header-logo" href="#"><img class="logo-icon" src="${escape(icon)}" alt=""><span class="site-title">Riddle Records</span></a><nav class="header-nav header-nav-right"><ul class="nav-menu"><li class="nav-item"><a href="#">Works</a></li><li class="nav-item"><a href="#">Project</a></li></ul></nav><button class="menu_toggle" aria-label="プレビュー内メニュー（操作なし）" disabled>☰</button></div></header><main class="container">${renderPreviewArticle(doc, documents)}</main><footer class="site-footer"><p>&copy; ${new Date().getFullYear()} 4mg - Riddle Records</p><p class="site-footer-note">Built with Astro and GitHub Pages</p></footer></body></html>`;
}
