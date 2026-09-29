import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, test } from "node:test";

import { getArticleState, getArticleStateLabel } from "../src/lib/articleState.ts";
import {
  ContentFileConflictError,
  deleteContentFile,
  loadContentFile,
  loadContentFiles,
  saveContentFile
} from "../src/lib/contentFiles.ts";
import { buildFrontmatter, joinList, splitList } from "../src/lib/frontmatter.ts";
import { buildMarkdown, createEditorDraft, parseImportedMarkdown } from "../src/lib/markdown.ts";
import {
  addRelatedIds,
  buildCardsHtml,
  buildGalleryCode,
  createImageCard,
  escapeHtml,
  extractCloudinaryId,
  resolveEditorImage
} from "../src/lib/media.ts";
import { generatedFilename, generatedUrl, slugify } from "../src/lib/permalink.ts";
import { clearUnsavedBackup, loadUnsavedBackup, writeUnsavedBackup } from "../src/lib/unsavedBackup.ts";
import { frontmatterSchema, publishChecks, toFrontmatterObject } from "../src/lib/validation.ts";
import {
  parseYamlFrontmatter,
  parseYamlScalar,
  yamlArray,
  yamlBlock,
  yamlObjectArray,
  yamlString
} from "../src/lib/yamlFrontmatter.ts";
import { isContentKind } from "../src/types/content.ts";
import { buildContentMarkdown, createContentDocument, normalizeYouTubeId, parseContentMarkdown, publicationChecks } from "../src/lib/cmsMarkdown.ts";
import { markdownToEditorHtml } from "../src/lib/editorMarkdown.ts";
import { validateMediaRegistry } from "../src/types/media.ts";
import { defaultFrontmatter } from "../src/types/journal.ts";
import { contentApiPlugin, isAllowedContentFilename, isTrustedWriteOrigin } from "../vite.config.ts";
import { createWorkerHandler } from "../worker/index.ts";
import { getGalleryDetailPath, hasGalleryDetail, validateGalleryItems } from "../../src/data/gallery.ts";
import { resolveImageUrl } from "../../src/utils/images.ts";
import {
  getJournalPermalink,
  getJournalRoutePath,
  getJournalThumbnail,
  toJournalRoutePath
} from "../../src/utils/journal.ts";

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

async function withFetch(mockFetch, callback) {
  const original = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    return await callback();
  } finally {
    globalThis.fetch = original;
  }
}

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

function requestContentApi({ method = "GET", url, headers = {}, body = "" }) {
  let middleware;
  contentApiPlugin().configureServer({
    middlewares: { use: (handler) => { middleware = handler; } }
  });

  return new Promise((resolve, reject) => {
    const request = new EventEmitter();
    Object.assign(request, { method, url, headers, setEncoding: () => undefined });
    const responseHeaders = {};
    const response = {
      statusCode: 200,
      setHeader: (key, value) => { responseHeaders[key] = value; },
      end: (body = "") => resolve({
        statusCode: response.statusCode,
        headers: responseHeaders,
        body: String(body),
        nextCalled: false
      })
    };
    Promise.resolve(middleware(request, response, () => resolve({ nextCalled: true }))).catch(reject);
    queueMicrotask(() => {
      if (body) request.emit("data", body);
      request.emit("end");
    });
  });
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
  test("prepares task lists and raw image HTML for structured editing", () => {
    const tasks = markdownToEditorHtml("- [ ] todo\n- [x] done");
    assert.match(tasks, /<ul data-type="taskList">/);
    assert.match(tasks, /data-checked="false"/);
    assert.match(tasks, /data-checked="true"/);
    const rawImage = markdownToEditorHtml('<img src="legacy.jpg" alt="legacy">');
    assert.match(rawImage, /data-raw-html=/);
    assert.doesNotMatch(rawImage, /<img src="legacy.jpg"/);
  });

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

describe("content file API client", () => {
  test("loads and filters file listings", async () => {
    let requestedUrl = "";
    await withFetch(async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({ files: [
        { kind: "journal", path: "valid.md", revision: "sha-10" },
        { kind: "songs", path: "wrong-kind.md", revision: "sha-20" },
        { kind: "journal", path: 42, revision: "sha-30" }
      ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }, async () => {
      const result = await loadContentFiles("journal");
      assert.equal(requestedUrl, "/api/content-list?kind=journal");
      assert.deepEqual(result, { available: true, files: [{ kind: "journal", path: "valid.md", revision: "sha-10" }] });
    });
  });

  test("returns API and network failures as unavailable listings", async () => {
    await withFetch(async () => new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      statusText: "Unavailable",
      headers: { "Content-Type": "application/json" }
    }), async () => {
      assert.deepEqual(await loadContentFiles("journal"), { available: false, files: [], error: "offline" });
    });
    await withFetch(async () => { throw new Error("network down"); }, async () => {
      assert.deepEqual(await loadContentFiles("journal"), { available: false, files: [], error: "network down" });
    });
  });

  test("loads, saves, and deletes content with encoded paths", async () => {
    const requests = [];
    await withFetch(async (url, options = {}) => {
      requests.push([String(url), options]);
      if (options.method === "POST") return Response.json({ kind: "journal", path: "a b.md", saved: true, revision: "sha-12" });
      if (options.method === "DELETE") return Response.json({ kind: "journal", path: "a b.md", deleted: true });
      return Response.json({ kind: "journal", path: "a b.md", markdown: "# body", revision: "sha-11" });
    }, async () => {
      assert.equal((await loadContentFile("journal", "a b.md")).markdown, "# body");
      assert.equal((await saveContentFile("journal", "a b.md", "# next", { expectedRevision: "sha-11" })).saved, true);
      assert.equal((await deleteContentFile("journal", "a b.md", { expectedRevision: "sha-12" })).deleted, true);
    });
    assert.equal(requests[0][0], "/api/content-item?kind=journal&path=a%20b.md");
    assert.deepEqual(JSON.parse(requests[1][1].body), {
      kind: "journal",
      path: "a b.md",
      markdown: "# next",
      expectedRevision: "sha-11"
    });
    assert.equal(requests[2][1].method, "DELETE");
    assert.deepEqual(JSON.parse(requests[2][1].body), {
      kind: "journal",
      path: "a b.md",
      expectedRevision: "sha-12"
    });
  });

  test("raises a typed error for write conflicts", async () => {
    await withFetch(async () => Response.json({
      error: "changed",
      currentRevision: "sha-20",
      expectedRevision: "sha-10"
    }, { status: 409 }), async () => {
      await assert.rejects(
        saveContentFile("journal", "entry.md", "body", { expectedRevision: "sha-10" }),
        (error) => error instanceof ContentFileConflictError &&
          error.message === "changed" &&
          error.currentRevision === "sha-20" &&
          error.expectedRevision === "sha-10"
      );
    });
  });
});

describe("content file API server boundary", () => {
  test("accepts only flat Markdown filenames", () => {
    assert.equal(isAllowedContentFilename("entry.md"), true);
    for (const filename of ["", "entry.txt", "../entry.md", "nested/entry.md", "/entry.md", "entry..md"]) {
      assert.equal(isAllowedContentFilename(filename), false, filename);
    }
  });

  test("allows same-origin and non-browser writes only", () => {
    assert.equal(isTrustedWriteOrigin({ headers: {} }), true);
    assert.equal(isTrustedWriteOrigin({ headers: { host: "localhost:5174", origin: "http://localhost:5174" } }), true);
    assert.equal(isTrustedWriteOrigin({ headers: { host: "localhost:5174", origin: "https://evil.example" } }), false);
    assert.equal(isTrustedWriteOrigin({ headers: { origin: "http://localhost:5174" } }), false);
  });

  test("lists content and rejects invalid requests before filesystem access", async () => {
    const listing = await requestContentApi({ url: "/api/content-list?kind=journal" });
    assert.equal(listing.statusCode, 200);
    const files = JSON.parse(listing.body).files;
    assert.ok(files.length > 0);
    assert.ok(files.every((file) => file.kind === "journal" && file.path.endsWith(".md")));

    const invalidKind = await requestContentApi({ url: "/api/content-list?kind=unknown" });
    assert.equal(invalidKind.statusCode, 400);
    assert.deepEqual(JSON.parse(invalidKind.body), { error: "Invalid content kind" });

    const traversal = await requestContentApi({ url: "/api/content-item?kind=journal&path=..%2Fpackage.json" });
    assert.equal(traversal.statusCode, 400);
    assert.deepEqual(JSON.parse(traversal.body), { error: "Invalid content filename" });

    const forbidden = await requestContentApi({
      method: "DELETE",
      url: "/api/content-item",
      headers: { host: "localhost:5174", origin: "https://evil.example" },
      body: JSON.stringify({ kind: "journal", path: "entry.md", expectedRevision: "mtime:1" })
    });
    assert.equal(forbidden.statusCode, 403);

    assert.deepEqual(await requestContentApi({ url: "/not-an-api" }), { nextCalled: true });
  });

  test("uses revision conflicts for local saves and deletes", async () => {
    const staleRevision = "mtime:0";
    const save = await requestContentApi({
      method: "POST",
      url: "/api/content-item",
      body: JSON.stringify({ kind: "journal", path: "2026-04-01.md", markdown: "unchanged", expectedRevision: staleRevision })
    });
    assert.equal(save.statusCode, 409);
    assert.equal(JSON.parse(save.body).expectedRevision, staleRevision);
    assert.match(JSON.parse(save.body).currentRevision, /^mtime:/);

    const deletion = await requestContentApi({
      method: "DELETE",
      url: "/api/content-item",
      body: JSON.stringify({ kind: "journal", path: "2026-04-01.md", expectedRevision: staleRevision })
    });
    assert.equal(deletion.statusCode, 409);
    assert.equal(JSON.parse(deletion.body).expectedRevision, staleRevision);
  });
});

describe("Cloudflare Worker content API", () => {
  const env = {
    ASSETS: { fetch: async () => new Response("asset") },
    GITHUB_TOKEN: "test-token",
    GITHUB_OWNER: "Enomi-4mg",
    GITHUB_REPO: "Riddle-Records",
    GITHUB_BRANCH: "main"
  };

  test("serves assets outside API routes and validates paths before GitHub access", async () => {
    const requests = [];
    const handler = createWorkerHandler(async (...args) => {
      requests.push(args);
      return Response.json([]);
    });
    assert.equal(await (await handler(new Request("https://cms.4mg.dev/editor"), env)).text(), "asset");
    const invalid = await handler(new Request("https://cms.4mg.dev/api/content-item?kind=journal&path=..%2Fsecret.md"), env);
    assert.equal(invalid.status, 400);
    assert.equal(requests.length, 0);
  });

  test("lists and reads GitHub content with SHA revisions", async () => {
    const calls = [];
    const handler = createWorkerHandler(async (url, options) => {
      calls.push([String(url), options]);
      if (String(url).includes("entry.md")) {
        return Response.json({ type: "file", name: "entry.md", path: "src/content/journal/entry.md", sha: "sha-1", encoding: "base64", content: Buffer.from("# 本文", "utf8").toString("base64") });
      }
      return Response.json([
        { type: "file", name: "entry.md", path: "src/content/journal/entry.md", sha: "sha-1" },
        { type: "dir", name: "nested", path: "src/content/journal/nested", sha: "sha-dir" }
      ]);
    });
    const listing = await handler(new Request("https://cms.4mg.dev/api/content-list?kind=journal"), env);
    assert.deepEqual(await listing.json(), { files: [{ kind: "journal", path: "entry.md", revision: "sha-1" }] });
    const item = await handler(new Request("https://cms.4mg.dev/api/content-item?kind=journal&path=entry.md"), env);
    assert.deepEqual(await item.json(), { kind: "journal", path: "entry.md", markdown: "# 本文", revision: "sha-1" });
    assert.ok(calls.every(([url]) => url.includes("ref=main")));
    assert.ok(calls.every(([, options]) => options.headers.Authorization === "Bearer test-token"));
  });

  test("creates, updates, force-updates, and deletes through the Contents API", async () => {
    let current = null;
    const writes = [];
    const handler = createWorkerHandler(async (url, options = {}) => {
      if (!options.method || options.method === "GET") {
        return current ? Response.json({ type: "file", name: "entry.md", path: "src/content/journal/entry.md", sha: current, encoding: "base64", content: btoa("old") }) : new Response("", { status: 404 });
      }
      const body = JSON.parse(options.body);
      writes.push([options.method, body]);
      if (options.method === "PUT") {
        current = `sha-${writes.length}`;
        return Response.json({ content: { sha: current } });
      }
      current = null;
      return Response.json({ commit: { sha: "commit-delete" } });
    });

    const create = await handler(new Request("https://cms.4mg.dev/api/content-item", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "journal", path: "entry.md", markdown: "new" })
    }), env);
    assert.equal((await create.json()).revision, "sha-1");
    assert.equal(writes[0][1].sha, undefined);

    const update = await handler(new Request("https://cms.4mg.dev/api/content-item", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "journal", path: "entry.md", markdown: "next", expectedRevision: "sha-1" })
    }), env);
    assert.equal((await update.json()).revision, "sha-2");
    assert.equal(writes[1][1].sha, "sha-1");

    const forced = await handler(new Request("https://cms.4mg.dev/api/content-item", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "journal", path: "entry.md", markdown: "forced", expectedRevision: "stale", force: true })
    }), env);
    assert.equal((await forced.json()).revision, "sha-3");
    assert.equal(writes[2][1].sha, "sha-2");

    const deleted = await handler(new Request("https://cms.4mg.dev/api/content-item", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "journal", path: "entry.md", expectedRevision: "sha-3" })
    }), env);
    assert.equal((await deleted.json()).deleted, true);
    assert.equal(writes[3][1].sha, "sha-3");
  });

  test("returns conflicts without mutating GitHub", async () => {
    let writes = 0;
    const handler = createWorkerHandler(async (_url, options = {}) => {
      if (options.method) writes += 1;
      return Response.json({ type: "file", name: "entry.md", path: "src/content/journal/entry.md", sha: "current", encoding: "base64", content: btoa("old") });
    });
    for (const method of ["POST", "DELETE"]) {
      const response = await handler(new Request("https://cms.4mg.dev/api/content-item", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "journal", path: "entry.md", markdown: "next", expectedRevision: "stale" })
      }), env);
      assert.equal(response.status, 409);
      assert.equal((await response.json()).currentRevision, "current");
    }
    assert.equal(writes, 0);
  });

  test("normalizes GitHub authentication, rate-limit, and upstream errors", async () => {
    for (const [status, headers, expectedStatus, message] of [
      [401, {}, 502, "GitHub authentication failed"],
      [403, { "x-ratelimit-remaining": "0" }, 503, "GitHub API rate limit exceeded"],
      [500, {}, 502, "GitHub API is unavailable"]
    ]) {
      const handler = createWorkerHandler(async () => new Response("secret upstream body", { status, headers }));
      const response = await handler(new Request("https://cms.4mg.dev/api/content-list?kind=journal"), env);
      assert.equal(response.status, expectedStatus);
      assert.deepEqual(await response.json(), { error: message });
    }
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

describe("site utility behavior", () => {
  test("resolves public, remote, and Cloudinary images", () => {
    assert.equal(resolveImageUrl("  "), undefined);
    assert.equal(resolveImageUrl("https://example.com/a.jpg", "w_100"), "https://example.com/a.jpg");
    assert.equal(resolveImageUrl("/images/a.jpg"), "/images/a.jpg");
    assert.equal(resolveImageUrl("gallery/a.jpg", "/w_100,q_auto/"), "https://res.cloudinary.com/dzq8y9qes/image/upload/w_100,q_auto/v1/gallery/a.jpg");
  });

  test("generates and normalizes journal routes", () => {
    const entry = (overrides = {}) => ({ data: { date: new Date("2026-02-03T00:00:00.000Z"), ...overrides } });
    assert.equal(getJournalPermalink(entry()), "/journal/2026-02-03/");
    assert.equal(getJournalPermalink(entry({ type: "making", slug: "process" })), "/journal/2026/02/03/process/");
    assert.equal(getJournalPermalink(entry({ type: "making" })), "/journal/2026-02-03/");
    assert.equal(getJournalPermalink(entry({ type: "report" })), "/journal/2026-02/");
    assert.equal(getJournalPermalink(entry({ permalink: "/special/" })), "/special/");
    assert.equal(getJournalRoutePath(entry({ type: "making", slug: "process" })), "2026/02/03/process");
    assert.equal(toJournalRoutePath("//journal/2026-02-03///"), "2026-02-03");
  });

  test("selects explicit, gallery, legacy, and fallback thumbnails", () => {
    const entry = (overrides = {}) => ({ data: {
      title: "Journal title",
      date: new Date("2026-02-03T00:00:00.000Z"),
      ...overrides
    } });
    const gallery = [{
      source: "collection",
      slug: "image",
      detail: false,
      title: "Gallery image",
      date: "2026-02-03",
      image: "gallery/image.jpg",
      imageAlt: "Gallery alt",
      description: "",
      body: "",
      tags: [],
      article_url: "/journal/2026-02-03/",
      thumbnail: true,
      thumbnail_class: "featured"
    }];
    assert.deepEqual(getJournalThumbnail(entry({ thumbnail: "thumb/id.jpg", thumbnail_alt: "Thumb alt" }), gallery, "/fallback.jpg"), {
      src: "https://res.cloudinary.com/dzq8y9qes/image/upload/w_400,h_400,c_fill,q_auto,f_auto/v1/thumb/id.jpg",
      alt: "Thumb alt"
    });
    assert.match(getJournalThumbnail(entry(), gallery, "/fallback.jpg").src, /gallery\/image\.jpg$/);
    assert.equal(getJournalThumbnail(entry({ thumbnail_class: "featured" }), gallery, "/fallback.jpg").alt, "Gallery alt");
    assert.match(getJournalThumbnail(entry({ image: "legacy/image.jpg" }), [], "/fallback.jpg").src, /legacy\/image\.jpg$/);
    assert.deepEqual(getJournalThumbnail(entry(), [], "/fallback.jpg"), { src: "/fallback.jpg", alt: "Journal title" });
  });

  test("validates gallery detail slugs and duplicates", () => {
    const item = { slug: "light", title: "Light", date: "2026-01-01", cloudinary_id: "light.jpg", description: "", categories: [] };
    assert.equal(getGalleryDetailPath(item), "/gallery/light/");
    assert.equal(hasGalleryDetail({ ...item, detail: true }), true);
    assert.throws(() => validateGalleryItems([{ ...item, slug: "", detail: true }]), /detail: true but no slug/);
    assert.throws(() => validateGalleryItems([item, { ...item, title: "Other" }]), /duplicated/);
  });

  test("recognizes supported content kinds", () => {
    for (const kind of ["journal", "songs", "gallery", "projects"]) assert.equal(isContentKind(kind), true);
    assert.equal(isContentKind("pages"), false);
    assert.equal(isContentKind(null), false);
  });
});

describe("CMS content model", () => {
  test("moves legacy feature and related links into editable body without duplicating them", () => {
    const project = parseContentMarkdown("---\ntitle: Demo\ndate: 2026-09-29\nfeatures: [One, Two]\n---\n\nIntro\n", "projects");
    assert.match(project.body, /## 主な機能\n\n- One\n- Two/);
    assert.doesNotMatch(buildContentMarkdown(project), /^features:/m);
    assert.equal((parseContentMarkdown(buildContentMarkdown(project), "projects").body.match(/## 主な機能/g) || []).length, 1);
    const gallery = parseContentMarkdown("---\ntitle: Demo\ndate: 2026-09-29\narticle_url: /journal/one/\n---\n\nIntro\n", "gallery");
    assert.match(gallery.body, /\[作品記事\]\(\/journal\/one\/\)/);
    assert.doesNotMatch(buildContentMarkdown(gallery), /^article_url:/m);
  });

  test("accepts YouTube URLs while storing only the video ID", () => {
    assert.equal(normalizeYouTubeId("https://youtu.be/2kTaqYkdbP8"), "2kTaqYkdbP8");
    assert.equal(normalizeYouTubeId("https://www.youtube.com/watch?v=2kTaqYkdbP8&t=5"), "2kTaqYkdbP8");
    assert.equal(normalizeYouTubeId("https://example.com/watch?v=2kTaqYkdbP8"), "");
  });
  test("keeps publication and project status independent", () => {
    const document = createContentDocument("projects");
    document.common.publication = "published";
    document.placement.data.status = "archived";
    const parsed = parseContentMarkdown(buildContentMarkdown(document), "projects");
    assert.equal(parsed.common.publication, "published");
    assert.equal(parsed.placement.data.status, "archived");
  });

  test("preserves unknown frontmatter fields", () => {
    const source = `---\ntitle: Demo\ndate: 2026-09-28\ndraft: true\ncustom_meta:\n  color: mint\n---\n\nBody\n`;
    const document = parseContentMarkdown(source, "journal");
    assert.deepEqual(document.unknownFrontmatter, { custom_meta: { color: "mint" } });
    assert.match(buildContentMarkdown(document), /custom_meta:\n  color: mint/);
  });

  test("allows incomplete drafts but reports publishing requirements", () => {
    const gallery = createContentDocument("gallery");
    assert.equal(gallery.common.publication, "draft");
    assert.equal(publicationChecks(gallery).every((check) => check.ok), false);
  });
});

describe("Media Registry", () => {
  test("rejects duplicate ids and type/public id pairs", () => {
    const asset = { id: "one", publicId: "folder/image.jpg", type: "image", displayName: "Image", tags: [], alt: "" };
    assert.equal(validateMediaRegistry({ version: 1, assets: [asset] }), null);
    assert.match(validateMediaRegistry({ version: 1, assets: [asset, { ...asset, id: "two" }] }), /public ID/);
    assert.match(validateMediaRegistry({ version: 1, assets: [asset, { ...asset, publicId: "other.jpg" }] }), /ID/);
  });
});
