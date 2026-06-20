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
- Gallery metadata lives in `src/data/gallery.ts`.
- Old Jekyll files were removed during the migration.

## Works and Gallery Pages

`/works/` is the primary index for all works. It combines Gallery items from `src/data/gallery.ts` and songs from `src/content/songs/`, then displays them with the shared Works card layout.

Gallery remains available at `/gallery/` as an artwork-focused archive. Individual artwork pages are generated at `/gallery/[slug]/` only for Gallery items with `detail: true`.

Gallery item fields:

- `slug`: URL segment for the Gallery detail page
- `detail`: set to `true` to generate `/gallery/[slug]/`
- `title`: artwork title
- `date`: artwork date
- `cloudinary_id`: Cloudinary public ID
- `description`: short card, meta, and lead description
- `body`: optional detail page body text
- `categories`: tags shown on Works, Gallery, and detail pages
- `article_url`: related Journal article or legacy artwork article
- `making_article_url`: related making-of Journal article
- `thumbnail`: controls Journal thumbnail matching behavior

Example:

```ts
{
  slug: "work-title",
  detail: true,
  title: "Work title",
  date: "2026-04-30",
  cloudinary_id: "example_abcd12.jpg",
  description: "Short work description",
  body: "Longer note for the Gallery detail page.",
  categories: ["Illustration"],
  article_url: "/journal/2026-04-30/",
  making_article_url: "/journal/2026/04/30/work-making/",
  thumbnail: true
}
```

Link behavior:

- Works cards link to `/gallery/[slug]/` when the Gallery item has `detail: true`.
- Gallery cards also link to `/gallery/[slug]/` when `detail: true`.
- Gallery items without detail pages keep the existing Gallery Lightbox behavior.
- Works cards without Gallery detail pages fall back to `article_url`, then to the full Cloudinary image.
- `/gallery/` remains part of the Works navigation group in the header active state.

## Journal Editor Workflow

Use the standalone React editor in `journal-editor-app/` to create and edit Journal Markdown. The old Astro editor implementation has been replaced by a migration notice at `/tools/journal-editor/`; that URL is kept only as a compatibility landing page for bookmarks and the Information page.

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

The React editor generates frontmatter that matches the Journal collection schema in `src/content/config.ts`.

- `title`: post title
- `date`: post date
- `og_description`: short list and OGP description
- `image`: OGP image, either a Cloudinary ID or a full URL
- `permalink`: public URL
- `featured_related`: related Cloudinary IDs
- `use_math`: enable for math-heavy posts
- `tags`: used for related article matching
- `thumbnail_class`: optional thumbnail selector

In the dev server, the editor manages `src/content/journal/*.md` directly. The UI stays note-like, but the source of truth is Markdown rather than browser `localStorage`. In build/public environments, use the output pane or `.md` download button because local file writes are unavailable.

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

Place the file in `src/content/journal/`.

Examples:

```text
src/content/journal/2026-04-30.md
src/content/journal/2026-04-30-dunes-making.md
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

If the post introduces a Gallery work, use the editor's Gallery code output as a starting point and add the item to `src/data/gallery.ts`.

```ts
{
  title: "Work title",
  date: "2026-04-30",
  cloudinary_id: "example_abcd12.jpg",
  description: "Work description",
  categories: ["Illustration"],
  article_url: "/journal/2026-04-30/",
  thumbnail: true
}
```

Add `making_article_url` when there is a separate making-of post.

### Markdown import notes

The editor's frontmatter importer is a small line-based parser, not a full YAML parser. It is intended for the current Journal files and common fields such as `key: value`, inline arrays, and simple block arrays. Avoid complex YAML such as block scalars, nested objects, heavily escaped quotes, or inline arrays with quoted commas. Existing Journal files are checked with `npm run test:roundtrip` in `journal-editor-app/`.

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
