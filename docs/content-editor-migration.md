# Content Editor Migration Plan

## Goal

`journal-editor-app/` is being widened from a Journal-only editor into a Content Editor for:

- `journal`
- `songs`
- `gallery`
- `projects`

The editor should operate on Markdown files with YAML frontmatter. TypeScript data arrays such as `src/data/gallery.ts` and `src/data/projects.ts` should not become write targets.

## Current Storage

- `journal`: `src/content/journal/*.md`
- `songs`: `src/content/songs/*.md`
- `gallery`: `src/content/gallery/*.md`
- `projects`: `src/content/projects/*.md`

`src/data/gallery.ts` is retained as a legacy compatibility source, but `galleryItems` is currently empty. Public Gallery pages read normalized `GalleryItemView` objects through `src/utils/gallery.ts`.
`src/data/projects.ts` is retained as a legacy compatibility source, but `projects` is currently empty. Public Project pages read normalized `ProjectItemView` objects through `src/utils/projects.ts`.

New Gallery and Project content must be added to `src/content/gallery/*.md` and `src/content/projects/*.md`. The legacy TypeScript arrays are a migration safety valve and should be considered future removal candidates.

## Suggested Commit Split

To keep the migration reviewable, split changes roughly as follows:

1. Gallery detail page and card link behavior.
2. Content Editor foundation and generic API.
3. Songs editing and roundtrip coverage.
4. Gallery/Projects collection schema and migration docs.
5. Safety hardening such as delete confirmation and parser tests.

## Target Storage

- `journal`: keep `src/content/journal/*.md`
- `songs`: keep `src/content/songs/*.md`
- `gallery`: migrated to `src/content/gallery/*.md`
- `projects`: migrate to `src/content/projects/*.md`

Astro collection schemas for `gallery` and `projects` exist in `src/content/config.ts`. Gallery and Projects are now collection-backed.

## Editor API

The editor should use these generic local-dev endpoints:

- `GET /api/content-list?kind=journal`
- `GET /api/content-item?kind=journal&path=YYYY-MM-DD.md`
- `POST /api/content-item`

The same endpoints work for `songs`, `gallery`, and `projects`. Each kind maps to a fixed directory. The API rejects absolute paths, `..`, subdirectories, and non-`.md` filenames.

## Migration Steps

1. Gallery: keep `src/data/gallery.ts` frozen/empty and manage works in `src/content/gallery/*.md`.
2. Gallery: route `/works/`, `/gallery/`, `/gallery/[slug]/`, and related thumbnails through `src/utils/gallery.ts`.
3. Projects: manage migrated items in `src/content/projects/*.md`.
4. Projects: route public pages through `src/utils/projects.ts`.
5. Projects: keep `src/data/projects.ts` empty unless a temporary legacy fallback is needed.

## Page Impact

- `/works/`: uses the merged Gallery collection and songs list.
- `/gallery/`: uses `getCollection("gallery")` through `src/utils/gallery.ts` and preserves Lightbox behavior for items without `detail: true`.
- `/gallery/[slug]/`: generates pages only for `detail: true` gallery entries.
- `/project/`: uses `getCollection("projects")` through `src/utils/projects.ts` and preserves card fields.
- `/project/[slug]/`: renders Project frontmatter and Markdown body through `ProjectItemView`.

## Editor Scope

Current implemented scope:

- Generic content kind switcher.
- Generic local-dev Markdown read/write API.
- Journal editing preserved.
- Songs editing added for existing `src/content/songs/*.md`.
- Gallery schema and Markdown migration completed.
- Gallery pages use `GalleryItemView` from `src/utils/gallery.ts`.
- Gallery validation checks duplicate slugs, required images, and required frontmatter `slug`.
- Gallery drafts (`draft: true`) are excluded from production builds.
- Projects schema and Markdown migration completed.
- Project pages use `ProjectItemView` from `src/utils/projects.ts`.
- Project drafts (`draft: true`) are excluded from production builds.

Deferred scope:

- Writing TypeScript arrays from the editor.
- Removing the empty legacy fallback arrays after the collection migration has settled.

## Schema and Validation Responsibilities

- `src/content/config.ts`: Astro content collection schema. This catches collection-level shape errors during content sync and build.
- `src/utils/gallery.ts`: Gallery display normalization, legacy fallback mapping, production draft filtering, and build-time validation for required slugs/images and duplicate slugs.
- `src/utils/projects.ts`: Project display normalization, legacy fallback mapping, production draft filtering, and build-time validation for missing or duplicate slugs.
- `journal-editor-app/src/types/content.ts`: Editor UI schema and input hints for each content kind. This drives fields and required checks in the editor, but it is not the public site schema.
- `journal-editor-app/src/lib/yamlFrontmatter.ts`: Markdown frontmatter parser/writer used by the editor import/export and roundtrip tests.

## Working Tree / Commit Split Notes

Keep the migration reviewable by separating these groups where possible:

1. Gallery pages and collection migration.
2. Projects collection migration.
3. Content Editor foundation and UI wording.
4. Roundtrip/YAML tests.
5. Docs updates.
6. Journal frontmatter normalization, especially `src/content/journal/2026-01-17.md`, as a separate commit.

## Gallery Frontmatter Standard

Gallery Markdown lives in `src/content/gallery/*.md`.

Standard fields:

- `title`
- `slug`
- `date` as `YYYY-MM-DD`
- `description`
- `image`
- `thumbnail`
- `thumbnail_alt`
- `detail`
- `tags`
- `article_url`
- `making_article_url`
- `draft`

`image` and `tags` are the standard fields for new Markdown. `cloudinary_id` and `categories` remain legacy fallbacks in the helper. `thumbnail: true` means the item is available for Journal thumbnail matching; `thumbnail: false` excludes it. Only `detail: true` items generate `/gallery/[slug]/`.

## Project Frontmatter Standard

Project Markdown lives in `src/content/projects/*.md`.

Standard fields:

- `title`
- `slug`
- `date` as `YYYY-MM-DD`
- `description`
- `hero`
- `status`: `active`, `paused`, `archived`, or `completed`
- `tags`
- `links`: list of `{ label, url }` objects
- `features`
- `draft`

Markdown body stores the longer project overview. `heroImage`, `externalUrl`, and `sourceUrl` remain legacy fallbacks in `src/utils/projects.ts`, but new Markdown should use `hero` and `links`.
