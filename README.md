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

## Journal Editor Workflow

Use the built-in Journal Editor to generate Markdown for new Journal posts.

### 1. Open the editor

Start the local dev server.

```bash
npm run dev -- --host 0.0.0.0
```

Open:

```text
http://localhost:4321/Riddle-Records/tools/journal-editor/
```

The editor is also linked from the `Information` page.

### 2. Fill in post metadata

The editor generates frontmatter that matches the Journal collection schema in `src/content/config.ts`.

- `title`: post title
- `date`: post date
- `og_description`: short list and OGP description
- `image`: OGP image, either a Cloudinary ID or a full URL
- `permalink`: public URL
- `featured_related`: related Cloudinary IDs
- `use_math`: enable for math-heavy posts
- `tags`: used for related article matching
- `thumbnail_class`: optional thumbnail selector

Editor input is automatically saved to the browser's `localStorage`. Opening the editor again in the same browser restores the draft. Use `下書きを削除` to remove the stored draft.

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

The generated card HTML uses the current Astro URL format and does not use old Jekyll Liquid variables such as `{{ site.cloudinary_url }}`.

### 4. Save the Markdown

Use either editor action:

- `Markdownをコピー`: copy generated Markdown.
- `Markdownをダウンロード`: download a `.md` file.

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

If the post introduces a Gallery work, add the item to `src/data/gallery.ts`.

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
