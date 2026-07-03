import { marked } from "marked";
import type { StoredDraft } from "../types/journal";
import { generatedUrl } from "../lib/permalink";
import mainCss from "../../../assets/css/main.css?raw";
import animationsCss from "../../../assets/css/animations.css?raw";
import galleryCss from "../../../assets/css/gallery.css?raw";
import journalCss from "../../../assets/css/journal.css?raw";

const cloudinaryBase = "https://res.cloudinary.com/dzq8y9qes/image/upload";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(date);
  return `${parsed.getFullYear()}年${String(parsed.getMonth() + 1).padStart(2, "0")}月${String(parsed.getDate()).padStart(2, "0")}日`;
}

function splitList(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function splitLinks(value: string) {
  return value.split("\n").map((line) => {
    const [label, ...urlParts] = line.split("|");
    const url = urlParts.join("|").trim();
    return label?.trim() && url ? { label: label.trim(), url } : undefined;
  }).filter((link): link is { label: string; url: string } => Boolean(link));
}

function cloudinaryImage(id: string, transform = "w_1400,q_auto,f_auto") {
  if (!id) return "";
  if (/^https?:\/\//.test(id)) return id;
  return `${cloudinaryBase}/${transform}/v1/${id}`;
}

function renderHeader(active: "home" | "about" | "journal" | "works" | "project" | "info") {
  const activeClass = (key: typeof active) => key === active ? ' class="active"' : "";
  return `
    <header class="site-header">
      <div class="header-container">
        <nav class="header-nav header-nav-left">
          <ul class="nav-menu">
            <li class="nav-item"><a href="#"${activeClass("home")}>Home</a></li>
            <li class="nav-item"><a href="#"${activeClass("about")}>About</a></li>
            <li class="nav-item"><a href="#"${activeClass("journal")}>Journal</a></li>
          </ul>
        </nav>
        <a href="#" class="header-logo">
          <span class="logo-icon preview-logo-icon">RR</span>
          <span class="site-title">Riddle Records</span>
        </a>
        <nav class="header-nav header-nav-right">
          <ul class="nav-menu">
            <li class="nav-item"><a href="#"${activeClass("works")}>Works</a></li>
            <li class="nav-item"><a href="#"${activeClass("project")}>Project</a></li>
            <li class="nav-item"><a href="#"${activeClass("info")}>Information</a></li>
          </ul>
        </nav>
        <div class="menu_toggle">☰</div>
      </div>
    </header>
  `;
}

function renderSidebar(active: "home" | "about" | "journal" | "works" | "project" | "info") {
  const activeClass = (key: typeof active) => key === active ? ' class="active"' : "";
  return `
    <nav class="sidebar">
      <div class="sidebar_content">
        <ul class="sidebar_menu">
          <li class="menu_item"><a href="#"${activeClass("home")}>Home</a></li>
          <li class="menu_item"><a href="#"${activeClass("about")}>About</a></li>
          <li class="menu_item"><a href="#"${activeClass("journal")}>Journal</a></li>
          <li class="menu_item"><a href="#"${activeClass("works")}>Works</a></li>
          <li class="menu_item"><a href="#"${activeClass("project")}>Project</a></li>
          <li class="menu_item"><a href="#"${activeClass("info")}>Information</a></li>
        </ul>
      </div>
    </nav>
  `;
}

function renderJournal(draft: StoredDraft, bodyHtml: string) {
  const summary = draft.frontmatter.description || draft.frontmatter.og_description || draft.frontmatter.title;
  const credits = draft.frontmatter.credits.trim();
  const lyrics = draft.frontmatter.lyrics.trim();
  return `
    <article class="post journal-article" data-use-math="${draft.frontmatter.use_math ? "true" : ""}">
      <div class="journal-back-link journal-back-link-top"><a href="#">Journal一覧へ戻る</a></div>
      <header class="journal-hero">
        <p class="journal-date"><time datetime="${escapeHtml(draft.frontmatter.date)}">${formatDate(draft.frontmatter.date)}</time></p>
        <h1 class="page_title">${escapeHtml(draft.frontmatter.title || "Untitled")}</h1>
        ${summary ? `<p class="journal-summary">${escapeHtml(summary)}</p>` : ""}
      </header>
      <div class="post-content journal-content">${bodyHtml}</div>
      ${credits ? `<section class="post-info"><div class="post-credits"><h3>クレジット</h3><pre>${escapeHtml(credits)}</pre></div></section>` : ""}
      ${lyrics ? `<section class="post-lyrics"><details id="lyrics-details"><summary>歌詞</summary><pre>${escapeHtml(lyrics)}</pre></details></section>` : ""}
      <div class="journal-back-link"><a href="#">Journal一覧へ戻る</a></div>
    </article>
  `;
}

function renderSong(draft: StoredDraft, bodyHtml: string) {
  const credits = draft.frontmatter.credits.trim();
  const lyrics = draft.frontmatter.lyrics.trim();
  const youtubeId = escapeHtml(draft.frontmatter.youtube_id);
  return `
    <article class="post song-article">
      <header class="song-hero">
        <time class="post-date" datetime="${escapeHtml(draft.frontmatter.date)}">${formatDate(draft.frontmatter.date)}</time>
        <h1 class="page_title">${escapeHtml(draft.frontmatter.title || "Untitled")}</h1>
        ${draft.frontmatter.description ? `<p>${escapeHtml(draft.frontmatter.description)}</p>` : ""}
      </header>
      ${youtubeId ? `<div class="song-video responsive-video-container"><iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}" title="${escapeHtml(draft.frontmatter.title || "Song preview")}" allowfullscreen></iframe></div>` : ""}
      <div class="post-content song-content">${bodyHtml}</div>
      ${credits ? `<section class="post-info song-meta"><div class="post-credits"><h3>クレジット</h3><pre>${escapeHtml(credits)}</pre></div></section>` : ""}
      ${lyrics ? `<section class="post-lyrics"><details id="lyrics-details"><summary>歌詞</summary><pre>${escapeHtml(lyrics)}</pre></details></section>` : ""}
    </article>
  `;
}

function renderGallery(draft: StoredDraft, bodyHtml: string) {
  const image = cloudinaryImage(draft.frontmatter.image || draft.frontmatter.cloudinary_id);
  const fullImage = cloudinaryImage(draft.frontmatter.image || draft.frontmatter.cloudinary_id, "w_1920,q_auto,f_auto");
  const tags = splitList(draft.frontmatter.tags || draft.frontmatter.categories);
  return `
    <article class="gallery-detail journal-entry-animate">
      <a class="gallery-detail-back" href="#">Gallery一覧へ戻る</a>
      <header class="gallery-detail-header">
        <p class="gallery-detail-kicker">Gallery</p>
        <h1 class="web_title">${escapeHtml(draft.frontmatter.title || "Untitled")}</h1>
        <time class="gallery-detail-date" datetime="${escapeHtml(draft.frontmatter.date)}">${formatDate(draft.frontmatter.date)}</time>
        ${draft.frontmatter.description ? `<p class="gallery-detail-description">${escapeHtml(draft.frontmatter.description)}</p>` : ""}
      </header>
      ${image ? `<a class="gallery-detail-image" href="${fullImage}"><img src="${image}" alt="${escapeHtml(draft.frontmatter.thumbnail_alt || draft.frontmatter.title || "Gallery preview")}" /></a>` : ""}
      ${tags.length ? `<div class="gallery-detail-tags">${tags.map((tag) => `<span class="work-tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      <section class="gallery-detail-body">${bodyHtml}</section>
      <a class="gallery-detail-back gallery-detail-back-bottom" href="#">Gallery一覧へ戻る</a>
    </article>
  `;
}

function renderProject(draft: StoredDraft, bodyHtml: string) {
  const tags = splitList(draft.frontmatter.tags);
  const features = splitList(draft.frontmatter.features);
  const links = splitLinks(draft.frontmatter.links);
  const hero = draft.frontmatter.hero || draft.frontmatter.heroImage;
  return `
    <article class="project-detail journal-entry-animate">
      <a class="project-back-link" href="#">Project一覧へ戻る</a>
      <header class="project-detail-header">
        ${draft.frontmatter.status ? `<p class="project-kicker">${escapeHtml(draft.frontmatter.status)}</p>` : ""}
        <h1 class="web_title">${escapeHtml(draft.frontmatter.title || "Untitled")}</h1>
        <time class="project-date" datetime="${escapeHtml(draft.frontmatter.date)}">${formatDate(draft.frontmatter.date)}</time>
        ${draft.frontmatter.description ? `<p class="project-lead">${escapeHtml(draft.frontmatter.description)}</p>` : ""}
      </header>
      <div class="project-hero${hero ? "" : " project-hero-fallback"}">${hero ? `<img src="${escapeHtml(hero)}" alt="${escapeHtml(draft.frontmatter.title || "Project preview")}" />` : `<span>${escapeHtml(draft.frontmatter.title || "Untitled")}</span>`}</div>
      <section class="project-section"><h2 class="page_title">概要</h2>${bodyHtml || `<p>${escapeHtml(draft.frontmatter.description)}</p>`}</section>
      ${features.length ? `<section class="project-section"><h2 class="page_title">主な機能</h2><ul class="project-feature-list">${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul></section>` : ""}
      ${links.length ? `<section class="project-section"><h2 class="page_title">リンク</h2><ul class="project-link-list">${links.map((link) => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul></section>` : ""}
      ${tags.length ? `<section class="project-section"><h2 class="page_title">Tags</h2><div class="project-tags">${tags.map((tag) => `<span class="project-tag">${escapeHtml(tag)}</span>`).join("")}</div></section>` : ""}
    </article>
  `;
}

function renderArticle(draft: StoredDraft) {
  const bodyHtml = marked.parse(draft.body, { async: false });
  if (draft.kind === "songs") return renderSong(draft, bodyHtml);
  if (draft.kind === "gallery") return renderGallery(draft, bodyHtml);
  if (draft.kind === "projects") return renderProject(draft, bodyHtml);
  return renderJournal(draft, bodyHtml);
}

function previewCss() {
  return `
    ${mainCss}
    ${animationsCss}
    ${galleryCss}
    ${journalCss}

    .transition-curtain { display: none; }
    .preview-logo-icon {
      display: inline-grid;
      place-items: center;
      border-radius: 999px;
      background: #2adca3;
      color: #06110d;
      font-size: 0.72rem;
      font-weight: 900;
    }
    .journal-entry-animate,
    article.post > *,
    main > * {
      opacity: 1 !important;
      transform: none !important;
    }
  `;
}

function buildPreviewBody(draft: StoredDraft) {
  const active = draft.kind === "journal" ? "journal" : draft.kind === "projects" ? "project" : "works";
  const wideContainer = draft.kind === "gallery";
  return `
    <div class="transition-curtain initial"></div>
    ${renderHeader(active)}
    ${renderSidebar(active)}
    <main class="${wideContainer ? "container wide-container" : "container"}">
      ${renderArticle(draft)}
    </main>
    <footer class="site-footer">
      <p>&copy; ${new Date().getFullYear()} 4mg - Riddle Records</p>
      <p class="site-footer-note">Built with Astro and GitHub Pages</p>
    </footer>
  `;
}

export function FullPreviewScreen({ draft, onBack }: {
  draft: StoredDraft;
  onBack: () => void;
}) {
  const url = generatedUrl(draft.frontmatter, draft.kind);
  return (
    <main className="site-preview-shell">
      <style>{previewCss()}</style>
      <header className="site-preview-toolbar">
        <div>
          <p className="site-preview-kicker">Full Preview</p>
          <strong>{url || "未保存URL"}</strong>
        </div>
        <button className="primary" onClick={onBack}>編集に戻る</button>
      </header>
      <div className="site-preview-document" dangerouslySetInnerHTML={{ __html: buildPreviewBody(draft) }} />
    </main>
  );
}
