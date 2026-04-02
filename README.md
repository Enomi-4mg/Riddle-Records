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

## Deployment

GitHub Pages is handled by `.github/workflows/astro-pages.yml`.
