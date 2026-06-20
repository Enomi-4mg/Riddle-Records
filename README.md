# Riddle Records

Portfolio site for 4mg, built with Astro.

- Journal: activity logs and reports
- Music: original songs and releases
- Gallery: illustrations and artwork
- About / Info / Tech: profile and site notes

## Local Development

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Build:

```bash
npm run build
```

## Project Layout

```text
src/
  components/
  content/
    journal/
    songs/
    gallery/
    projects/
  data/
  layouts/
  pages/
assets/
favicon/
legacy/
tools/
```

## Content Notes

- Journal entries live in `src/content/journal/`.
- Song entries live in `src/content/songs/`.
- Gallery works live in `src/content/gallery/*.md`.
- Project entries live in `src/content/projects/*.md`.
- `src/data/gallery.ts` is kept only as a legacy compatibility source and is currently empty.
- `src/data/projects.ts` is kept only as a legacy compatibility source and is currently empty.
- Old Jekyll files were removed during the migration.

## Works and Gallery Pages

`/works/` is the primary index for all works. It combines Gallery collection items from `src/content/gallery/*.md` and songs from `src/content/songs/`, then displays them with the shared Works card layout.

Gallery remains available at `/gallery/` as an artwork-focused archive. Individual artwork pages are generated at `/gallery/[slug]/` only for Gallery items with `detail: true`.

Gallery frontmatter fields:

- `slug`: URL segment for the Gallery detail page
- `detail`: set to `true` to generate `/gallery/[slug]/`
- `title`: artwork title
- `date`: artwork date, written as `YYYY-MM-DD`
- `image`: Cloudinary public ID or full image URL
- `description`: short card, meta, and lead description
- Markdown body: detail page body text
- `tags`: tags shown on Works, Gallery, and detail pages
- `article_url`: related Journal article or legacy artwork article
- `making_article_url`: related making-of Journal article
- `thumbnail`: set to `true` when the item should be available as a Journal thumbnail match; set to `false` to exclude it
- `draft`: set to `true` to hide the item from production builds

Legacy fields:

- `cloudinary_id`: accepted as a fallback for old data, but new Markdown should use `image`
- `categories`: accepted as a fallback for old data, but new Markdown should use `tags`

Example:

```md
---
title: Work title
slug: work-title
date: 2026-04-30
description: Short work description
image: example_abcd12.jpg
thumbnail: true
thumbnail_alt: Work title
detail: true
tags:
  - Illustration
article_url: /journal/2026-04-30/
making_article_url: /journal/2026/04/30/work-making/
draft: false
---

Longer note for the Gallery detail page.
```

Link behavior:

- Works cards link to `/gallery/[slug]/` when the Gallery item has `detail: true`.
- Gallery cards also link to `/gallery/[slug]/` when `detail: true`.
- Gallery items without detail pages keep the existing Gallery Lightbox behavior.
- Works cards without Gallery detail pages fall back to `article_url`, then to the full image.
- `/gallery/` remains part of the Works navigation group in the header active state.

## Project Content

Project pages are sourced from `src/content/projects/*.md`. The legacy `src/data/projects.ts` array remains available for compatibility, but the current source of truth is the Project content collection.

Project frontmatter fields:

- `title`: project title
- `slug`: URL segment for `/project/[slug]/`
- `date`: project date, written as `YYYY-MM-DD`
- `description`: short card, meta, and lead description
- `hero`: preview image URL; leave blank to use the title fallback
- `status`: one of `active`, `paused`, `archived`, or `completed`
- `tags`: tags shown on Project cards and detail pages
- `links`: external project links with `label` and `url`
- `features`: feature list shown on the detail page
- `draft`: set to `true` to hide the item from production builds
- Markdown body: detail page overview text

Example:

```md
---
title: "Project title"
slug: "project-title"
date: 2026-06-16
description: "Short project description"
hero: "/images/projects/example.jpg"
status: "active"
tags:
  - "Web"
links:
  - label: "Website"
    url: "https://example.com"
features:
  - "Feature one"
draft: false
---

Longer project overview.
```

## Content Editor Workflow

Use the standalone React editor in `journal-editor-app/` to create and edit Journal, Songs, Gallery, and Project Markdown. The folder name is still `journal-editor-app/`, but the app title and role are now **Riddle Records Content Editor**. The old Astro editor implementation has been replaced by a migration notice at `/tools/journal-editor/`; that URL is kept only as a compatibility landing page for bookmarks and the Information page.

### 1. Open the editor

Start the editor app.

```bash
cd journal-editor-app
npm install
npm run dev
```

Open the Vite dev server URL:

```text
http://localhost:5174/
```

The `Information` page links to the `/tools/journal-editor/` migration notice, not to the editor app itself.

### 2. Fill in post metadata

The React editor generates frontmatter for the selected content kind. `journal-editor-app/src/types/content.ts` defines the Editor UI fields, while `src/content/config.ts` remains the Astro collection schema.

- `title`: post title
- `date`: post date
- `og_description`: short list and OGP description
- `image`: OGP image, either a Cloudinary ID or a full URL
- `permalink`: public URL
- `featured_related`: related Cloudinary IDs
- `use_math`: enable for math-heavy posts
- `tags`: used for related article matching
- `thumbnail_class`: optional thumbnail selector

In the dev server, the editor manages `src/content/<kind>/*.md` directly. The UI stays note-like, but the source of truth is Markdown rather than browser `localStorage`. In build/public environments, use the output pane or `.md` download button because local file writes are unavailable.

Available templates:

- `通常Journal`: regular diary or report post
- `制作メモ`: making-of post with a slugged permalink
- `月次報告`: monthly report style post

### 3. Insert Cloudinary image cards

Use the image card builder when a post needs Cloudinary images.

1. Enter a Cloudinary ID, such as `example_abcd12.jpg`.
2. Add a caption and heading.
3. Press `本文に画像カードを挿入`.
4. Press `featured_relatedに追加` if the image should be highlighted as related content.

The generated card HTML uses the current Astro URL format and does not use old Jekyll Liquid variables such as `{{ site.cloudinary_url }}`. The editor can also generate `making-comparison-grid` HTML, extract existing cards from the body, add IDs to `featured_related`, and generate TypeScript-style Gallery registration snippets.

### 4. Save the Markdown

Use the editor output pane to copy the generated Markdown, or use the `.md` button to download a Markdown file.

Place the file in the matching `src/content/<kind>/` directory.

Examples:

```text
src/content/journal/2026-04-30.md
src/content/journal/2026-04-30-dunes-making.md
src/content/gallery/work-title.md
src/content/projects/project-title.md
```

### 5. Verify the post

Run:

```bash
npm run build
```

Check:

- the post appears on `/journal/`
- the detail page opens
- OGP image and thumbnails are correct
- image card Lightbox behavior works
- `featured_related` and `tags` produce the expected related content

### 6. Connect Gallery items

If the post introduces a Gallery work, use the editor's Gallery output as a starting point and add or edit a Markdown file in `src/content/gallery/*.md`.

```md
---
title: Work title
slug: work-title
date: 2026-04-30
image: example_abcd12.jpg
description: Work description
tags:
  - Illustration
article_url: /journal/2026-04-30/
thumbnail: true
detail: true
---
```

Add `making_article_url` when there is a separate making-of post.

### Markdown import notes

The editor uses a YAML frontmatter parser/writer for Markdown files. Existing Journal, Songs, Gallery, and Project files are checked with `npm run test:content` in `journal-editor-app/`; YAML edge cases are checked with `npm run test:yaml`.

## Deployment

GitHub Pages is handled by `.github/workflows/astro-pages.yml`.

Cloudflare Pages is not used for this repository. If a Cloudflare Pages project
is still connected to the repo, set its **Ignored build step** command to:

```bash
./scripts/skip-cloudflare-pages.sh
```

Cloudflare treats an exit code of `0` from that command as "skip this build",
so the project remains outside the Cloudflare build target while GitHub Pages
continues to deploy normally.
