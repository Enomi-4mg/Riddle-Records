// Compatibility tests for the retired Draft-based editor. Excluded from current CMS coverage.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getArticleState, getArticleStateLabel } from "../src/lib/articleState.ts";
import { buildFrontmatter, joinList, splitList } from "../src/lib/frontmatter.ts";
import { buildMarkdown, createEditorDraft, parseImportedMarkdown } from "../src/lib/markdown.ts";
import { addRelatedIds, buildCardsHtml, buildGalleryCode, createImageCard, escapeHtml, extractCloudinaryId, resolveEditorImage } from "../src/lib/media.ts";
import { generatedFilename, generatedUrl, slugify } from "../src/lib/permalink.ts";
import { clearUnsavedBackup, loadUnsavedBackup, writeUnsavedBackup } from "../src/lib/unsavedBackup.ts";
import { frontmatterSchema, publishChecks, toFrontmatterObject } from "../src/lib/validation.ts";
import { parseYamlFrontmatter, parseYamlScalar, yamlArray, yamlBlock, yamlObjectArray, yamlString } from "../src/lib/yamlFrontmatter.ts";
import { defaultFrontmatter } from "../src/types/journal.ts";

const makeFrontmatter = (overrides = {}) => ({
  ...defaultFrontmatter,
  title: "Test title",
  date: "2026-02-03",
  description: "Test description",
  draft: false,
  ...overrides
});

const makeDraft = (overrides = {}) => createEditorDraft({
  id: "test-draft",
  createdAt: "2026-02-03T00:00:00.000Z",
  updatedAt: "2026-02-03T00:00:00.000Z",
  frontmatter: makeFrontmatter(),
  ...overrides
});

function withLocalStorage(callback) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try {
    return callback({ storage, values });
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
}


describe("permalink and article state", () => {
  test("normalizes slugs and generates every route variant", () => {
    assert.equal(slugify("  My New--Post!  "), "my-new-post");
    assert.equal(generatedUrl(makeFrontmatter(), "songs"), "/disco/2026-02-03/");
    assert.equal(generatedUrl(makeFrontmatter({ slug: "Light Work" }), "gallery"), "/gallery/light-work/");
    assert.equal(generatedUrl(makeFrontmatter({ slug: "Tool Box" }), "projects"), "/project/tool-box/");
    assert.equal(generatedUrl(makeFrontmatter({ permalink: "/custom/path/" })), "/custom/path/");
    assert.equal(generatedUrl(makeFrontmatter({ type: "making", slug: "Behind Scenes" })), "/journal/2026/02/03/behind-scenes/");
    assert.equal(generatedUrl(makeFrontmatter({ type: "report" })), "/journal/2026-02/");
    assert.equal(generatedUrl(makeFrontmatter()), "/journal/2026-02-03/");
    assert.equal(generatedUrl(makeFrontmatter({ date: "" })), "");
  });

  test("generates filenames by content kind", () => {
    assert.equal(generatedFilename(makeFrontmatter(), "songs"), "2026-02-03.md");
    assert.equal(generatedFilename(makeFrontmatter({ slug: "Light Work" }), "gallery"), "light-work.md");
    assert.equal(generatedFilename(makeFrontmatter({ slug: "Tool Box" }), "projects"), "tool-box.md");
    assert.equal(generatedFilename(makeFrontmatter({ slug: "Behind Scenes" })), "2026-02-03-behind-scenes.md");
    assert.equal(generatedFilename(makeFrontmatter({ date: "" })), "");
  });

  test("classifies draft lifecycle states and labels", () => {
    const states = [
      [makeDraft({ frontmatter: makeFrontmatter({ draft: true }) }), "draft", "下書き"],
      [makeDraft({ source: "imported" }), "published", "投稿済み"],
      [makeDraft({ source: "imported", editedAt: "2026-02-04T00:00:00.000Z" }), "editing-published", "投稿済みを編集中"],
      [makeDraft({ source: "manual" }), "scheduled", "公開予定"]
    ];
    for (const [draft, state, label] of states) {
      assert.equal(getArticleState(draft), state);
      assert.equal(getArticleStateLabel(state), label);
    }
  });
});

describe("YAML and Markdown conversion", () => {
  test("parses nested YAML and serializes escaped values", () => {
    assert.equal(parseYamlScalar("null"), "");
    assert.deepEqual(parseYamlFrontmatter("title: demo\ntags: [a, b]\nmeta:\n  enabled: true\nempty:"), {
      title: "demo",
      tags: ["a", "b"],
      meta: { enabled: true },
      empty: ""
    });
    assert.deepEqual(parseYamlFrontmatter("- one\n- two"), {});
    assert.equal(yamlString("a\\b\n\"c\""), "\"a\\\\b\\n\\\"c\\\"\"");
    assert.equal(yamlBlock("a\nb"), "|\n  a\n  b");
    assert.equal(yamlArray(["a", "b"]), "[\"a\", \"b\"]");
    assert.equal(yamlObjectArray([{ label: "Site", url: "https://example.com/a|b" }]), "\n  - label: \"Site\"\n    url: \"https://example.com/a|b\"");
  });

  test("builds kind-specific frontmatter", () => {
    const song = buildFrontmatter(makeFrontmatter({
      youtube_id: "abc123",
      credits: "Music: A\nGuitar: B",
      lyrics: "line one\nline two",
      tags: "music, vocaloid"
    }), "songs");
    assert.match(song, /youtube_id: "abc123"/);
    assert.match(song, /credits: \|\n  Music: A\n  Guitar: B/);
    assert.match(song, /lyrics: \|\n  line one\n  line two/);

    const gallery = buildFrontmatter(makeFrontmatter({
      slug: "My Image",
      detail: true,
      image: "gallery/image.jpg",
      thumbnail: "true",
      tags: "art, study",
      article_url: "/journal/2026-02-03/"
    }), "gallery");
    assert.match(gallery, /slug: "my-image"/);
    assert.match(gallery, /detail: true/);
    assert.match(gallery, /thumbnail: true/);

    const project = buildFrontmatter(makeFrontmatter({
      slug: "Editor App",
      hero: "project/hero.jpg",
      status: "active",
      links: "Website | https://example.com/a|b\nGitHub | https://github.com/example/repo",
      features: "editing, preview"
    }), "projects");
    assert.match(project, /links:\n  - label: "Website"\n    url: "https:\/\/example.com\/a\|b"/);
    assert.match(project, /features: \["editing", "preview"\]/);
  });

  test("imports and re-exports representative content without losing values", () => {
    const source = `---
title: "Imported song"
date: 2025-08-23
youtube_id: "video-id"
credits:
  - "Music: A"
  - "Guitar: B"
tags: ["music", "demo"]
draft: false
---

# Body

Text.
`;
    const draft = parseImportedMarkdown(source, { kind: "songs", id: "imported-song" });
    assert.equal(draft.frontmatter.date, "2025-08-23");
    assert.equal(draft.frontmatter.credits, "Music: A\nGuitar: B");
    assert.equal(draft.frontmatter.tags, "music, demo");
    assert.equal(draft.body, "# Body\n\nText.\n");
    const output = buildMarkdown(draft);
    assert.match(output, /date: 2025-08-23/);
    assert.match(output, /youtube_id: "video-id"/);
    assert.match(output, /# Body\n\nText\.\n$/);
  });

  test("uses safe defaults for Markdown without frontmatter", () => {
    const journal = parseImportedMarkdown("Plain text", { id: "plain" });
    assert.equal(journal.frontmatter.title, "");
    assert.equal(journal.body, "Plain text");
    const emptyProject = parseImportedMarkdown("---\ntitle: Demo\n---\n", { kind: "projects" });
    assert.equal(emptyProject.body, "");
  });

  test("supports list helpers", () => {
    assert.deepEqual(splitList(" a, ,b "), ["a", "b"]);
    assert.equal(joinList(["a", 2]), "a, 2");
    assert.equal(joinList(null), "");
  });
});

describe("validation", () => {
  test("checks required fields and kind-specific publishing rules", () => {
    const making = publishChecks(makeFrontmatter({ type: "making", slug: "", thumbnail: "image/id", thumbnail_alt: "" }));
    assert.equal(making.find((check) => check.label === "making 記事に slug がある")?.ok, false);
    assert.equal(making.find((check) => check.label === "thumbnail 使用時に thumbnail_alt がある")?.ok, false);

    const gallery = publishChecks(makeFrontmatter({ slug: "", image: "" }), "gallery");
    assert.equal(gallery.find((check) => check.label === "slug が入力されている")?.ok, false);
    assert.equal(gallery.find((check) => check.label === "image が入力されている")?.ok, false);

    const song = publishChecks(makeFrontmatter({ youtube_id: "" }), "songs");
    assert.equal(song.find((check) => check.label === "youtube_id が入力されている")?.ok, false);
  });

  test("normalizes a form before schema validation", () => {
    const object = toFrontmatterObject(makeFrontmatter({
      title: "  Title  ",
      slug: " New Post ",
      tags: "one, two",
      categories: "art, demo",
      features: "fast, safe",
      featured_related: "a, b"
    }));
    assert.equal(object.title, "Title");
    assert.equal(object.slug, "new-post");
    assert.deepEqual(object.tags, ["one", "two"]);
    assert.deepEqual(object.categories, ["art", "demo"]);
    assert.deepEqual(object.features, ["fast", "safe"]);
    assert.equal(frontmatterSchema.safeParse(object).success, true);
    assert.equal(frontmatterSchema.safeParse({ title: "", date: "" }).success, false);
  });
});

describe("media helpers", () => {
  test("resolves images and escapes generated HTML", () => {
    assert.deepEqual(resolveEditorImage(""), { kind: "empty", label: "未入力", url: "" });
    assert.equal(resolveEditorImage("https://example.com/image.jpg").kind, "url");
    assert.equal(resolveEditorImage("/images/local.jpg").kind, "local");
    assert.equal(resolveEditorImage("folder/image.jpg").url, "https://res.cloudinary.com/dzq8y9qes/image/upload/w_400,h_400,c_fill,q_auto,f_auto/v1/folder/image.jpg");
    assert.equal(escapeHtml(`<tag a="b">Tom & 'Ann'</tag>`), "&lt;tag a=&quot;b&quot;&gt;Tom &amp; &#39;Ann&#39;&lt;/tag&gt;");
  });

  test("builds both card layouts and ignores empty cards", () => {
    const card = createImageCard({
      id: "card-1",
      cloudinaryId: "gallery/image.jpg",
      caption: `A & <B>`,
      heading: "Heading",
      noGalleryButton: true
    });
    const grid = buildCardsHtml([createImageCard({ cloudinaryId: "" }), card], "journal-card-grid", `Group \"One\"`);
    assert.match(grid, /class="journal-card no-gallery-button"/);
    assert.match(grid, /data-title="A &amp; &lt;B&gt;"/);
    assert.match(grid, /data-lightbox="Group &quot;One&quot;"/);
    const comparison = buildCardsHtml([card], "making-comparison-grid", "");
    assert.match(comparison, /class="making-comparison-grid"/);
    assert.match(comparison, /class="comparison-label">Heading<\/p>/);
    assert.equal(buildCardsHtml([], "journal-card-grid", "Journal"), "");
  });

  test("builds gallery records with stable fallbacks", () => {
    const code = buildGalleryCode([
      createImageCard({
        id: "card-1",
        cloudinaryId: "folder/My Image.jpg",
        categories: "art, demo",
        thumbnail: false,
        detail: true
      })
    ], "journal-card-grid", makeFrontmatter());
    assert.match(code, /slug: "card-1"/);
    assert.match(code, /title: "Card 1"/);
    assert.match(code, /tags: \["art", "demo"\]/);
    assert.match(code, /article_url: "\/journal\/2026-02-03\/"/);
    assert.match(code, /thumbnail: false/);
    assert.equal(buildGalleryCode([], "journal-card-grid", makeFrontmatter()), "");
  });

  test("extracts Cloudinary IDs and merges related IDs", () => {
    assert.equal(extractCloudinaryId("https://example.com/upload/v1/folder/image.jpg?x=1"), "image.jpg");
    assert.equal(extractCloudinaryId(""), "");
    assert.equal(addRelatedIds("a, b", [" b ", "c", ""]), "a, b, c");
  });
});

describe("unsaved backups", () => {
  test("writes, loads, fills defaults, and clears a backup", () => {
    withLocalStorage(({ values }) => {
      const draft = makeDraft({ id: "backup-1", frontmatter: makeFrontmatter({ title: "Saved title" }) });
      writeUnsavedBackup(draft);
      assert.equal(loadUnsavedBackup("backup-1")?.frontmatter.title, "Saved title");
      values.set("riddle-journal-unsaved:partial", JSON.stringify({ id: "partial", frontmatter: { title: "Partial" } }));
      const partial = loadUnsavedBackup("partial");
      assert.equal(partial?.kind, "journal");
      assert.equal(partial?.frontmatter.title, "Partial");
      assert.equal(partial?.frontmatter.type, "journal");
      clearUnsavedBackup("backup-1");
      assert.equal(loadUnsavedBackup("backup-1"), null);
      values.set("riddle-journal-unsaved:broken", "not-json");
      assert.equal(loadUnsavedBackup("broken"), null);
    });
  });

  test("ignores legacy mtime metadata when creating migrated drafts", () => {
    const draft = createEditorDraft({ loadedFilePath: "legacy.md", loadedFileMtime: 123 });
    assert.equal(draft.loadedFilePath, "legacy.md");
    assert.equal(draft.loadedFileRevision, undefined);
    assert.equal(draft.loadedFileMtime, undefined);
  });
});
