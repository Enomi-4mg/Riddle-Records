import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { load } from "js-yaml";
import { buildContentMarkdown, createContentDocument, generatedContentFilename, parseContentMarkdown } from "../src/lib/cmsMarkdown.ts";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "../src/lib/editorMarkdown.ts";
import { applyPendingChanges, PendingConflictError } from "../src/lib/deployPending.ts";
import { BatchConflictError, commitBatch } from "../src/lib/commitBatch.ts";
import { loadMediaRegistry, saveMediaRegistry, MediaRegistryConflictError } from "../src/lib/mediaRegistry.ts";
import { readContentRevision } from "../src/lib/contentFiles.ts";
import { startSiteDeploy, getSiteDeploy } from "../src/lib/siteDeploy.ts";
import { readArticleDefaults, writeArticleDefaults } from "../src/lib/articleDefaults.ts";
import { emptyPending, upsertPending } from "../src/lib/pendingChanges.ts";
import { resolveImageUrl } from "../../src/utils/images.ts";
import { renderContentMarkdown } from "../../src/utils/renderMarkdown.ts";

const media = { version: 1, assets: [] };
const makeDoc = (kind = "journal") => { const doc = createContentDocument(kind); doc.common.title = "Test"; return doc; };
const makeQueue = () => {
  const first = makeDoc(); first.common.date = "2026-01-02";
  const second = makeDoc(); second.common.date = "2026-01-03";
  return [first, second].reduce((queue, document) => upsertPending(queue, { document, operation: "save" }), emptyPending());
};
const unexpected = async () => { throw new Error("Unexpected individual write"); };
const deps = (overrides = {}) => ({ readRevision: async () => undefined, loadMedia: async () => ({ registry: media, revision: "old" }), saveContent: unexpected, deleteContent: unexpected, saveMedia: unexpected, commitBatch: unexpected, ...overrides });
async function withFetch(fetcher, callback) { const original = globalThis.fetch; globalThis.fetch = fetcher; try { return await callback(); } finally { globalThis.fetch = original; } }

describe("current CMS serialization and editor conversion", () => {
  test("canonicalizes Music aliases and duplicates while preserving other tags and order", () => {
    for (const kind of ["journal", "songs", "gallery", "projects"]) {
      const doc = parseContentMarkdown('---\ntitle: Tagged\ndate: 2026-01-02\ntags: [" art ", music, Music, MUSIC, art, CG, cg, " "]\n---\n\nBody\n', kind);
      assert.deepEqual(doc.common.tags, ["art", "Music", "CG", "cg"]);
      // Pending data from an older browser is normalized on save too.
      doc.common.tags = ["music", "Music", "ボカロ", " ボカロ "];
      const saved = buildContentMarkdown(doc);
      const read = parseContentMarkdown(saved, kind);
      assert.deepEqual(read.common.tags, ["Music", "ボカロ"]);
      assert.equal(buildContentMarkdown(read), saved);
    }
    const legacy = parseContentMarkdown('---\ntitle: Legacy\ndate: 2026-01-02\ncategories: [music, Music]\n---\n', "gallery");
    assert.deepEqual(legacy.common.tags, ["Music"]);
  });
  test("new songs have an editable Music tag and removing it survives saving and reopening", () => {
    const doc = createContentDocument("songs");
    assert.deepEqual(doc.common.tags, ["Music"]);
    doc.common.tags = [];
    const saved = buildContentMarkdown(doc);
    assert.deepEqual(parseContentMarkdown(saved, "songs").common.tags, []);
    doc.common.tags = ["ボカロ"];
    assert.deepEqual(parseContentMarkdown(buildContentMarkdown(doc), "songs").common.tags, ["ボカロ"]);
    assert.deepEqual(createContentDocument("gallery").common.tags, []);
  });
  test("public Works/Gallery catalog uses saved song tags without injecting Music", async () => {
    const { build } = await import("esbuild");
    const { fileURLToPath } = await import("node:url");
    const songs = [
      { slug: "tagged", data: { title: "Tagged", date: "2026-01-02", youtube_id: "abcdefghijk", tags: ["music", "Music", " ボカロ "] } },
      { slug: "empty", data: { title: "Empty", date: "2026-01-01", youtube_id: "abcdefghijk", tags: [] } },
      { slug: "specific", data: { title: "Specific", date: "2025-12-31", youtube_id: "abcdefghijk", tags: ["Instrumental"] } }
    ];
    const result = await build({
      entryPoints: [fileURLToPath(new URL("../../src/utils/works.ts", import.meta.url))], bundle: true, write: false,
      format: "esm", platform: "node", define: { "import.meta.env.PROD": "true" },
      plugins: [{ name: "content-fixture", setup(builder) {
        builder.onResolve({ filter: /^astro:content$/ }, () => ({ path: "fixture", namespace: "content-fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "content-fixture" }, () => ({ contents: `export async function getCollection(kind) { return kind === "songs" ? ${JSON.stringify(songs)}.map(entry => ({ ...entry, data: { ...entry.data, date: new Date(entry.data.date) } })) : []; }` }));
      } }]
    });
    const { getViewingWorks } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
    const works = await getViewingWorks();
    assert.deepEqual(works.find((work) => work.id === "songs:tagged").tags, ["Music", "ボカロ"]);
    assert.deepEqual(works.find((work) => work.id === "songs:empty").tags, []);
    assert.deepEqual(works.find((work) => work.id === "songs:specific").tags, ["Instrumental"]);
  });
  for (const kind of ["journal", "songs", "gallery", "projects"]) test(`${kind} metadata saves keep body stable`, () => {
    const original = "---\ntitle: Demo\ndate: 2026-01-02\ncustom: keep\n---\n\n# Heading\n\n  indented text\n";
    const doc = parseContentMarkdown(original, kind, { path: "demo.md" });
    assert.equal(doc.body, "# Heading\n\n  indented text\n");
    doc.common.title = "Changed";
    const first = buildContentMarkdown(doc);
    assert.equal(first, buildContentMarkdown(parseContentMarkdown(first, kind, { path: "demo.md" })));
    assert.ok(first.endsWith(doc.body));
    assert.match(first, /custom: keep/);
  });
  test("preserves Gallery boolean thumbnail and absolute URLs through YAML", () => {
    const source = "---\ntitle: Art\ndate: 2026-01-02\nslug: art\nimage: https://example.com/art.png\nthumbnail: false\n---\n\nBody\n";
    const saved = buildContentMarkdown(parseContentMarkdown(source, "gallery"));
    const raw = load(saved.match(/^---\n([\s\S]*?)\n---/)[1]);
    assert.equal(raw.thumbnail, false);
    assert.equal(resolveImageUrl(raw.image), raw.image);
    assert.match(resolveImageUrl("folder/hero.png"), /image\/upload\/v1\/folder\/hero.png$/);
  });
  test("preserves kind-specific unknown metadata", () => {
    const doc = parseContentMarkdown("---\ntitle: Test\ndate: 2026-01-02\ncredits: Original credits\nsubtitle: Sub\n---\n\nBody", "journal");
    assert.match(buildContentMarkdown(doc), /credits: Original credits/);
    assert.match(buildContentMarkdown(doc), /subtitle: Sub/);
  });
  test("converts strike, raw percent HTML, tasks and tables without browser globals", () => {
    assert.equal(editorHtmlToMarkdown("<p><s>struck</s></p>"), "~~struck~~");
    const raw = '<div style="width:100%">Raw 50% & text</div>';
    assert.equal(editorHtmlToMarkdown(markdownToEditorHtml(raw)), raw);
    assert.equal(editorHtmlToMarkdown('<div data-raw-html="&lt;div style=&quot;width:100%&quot;&gt;raw&lt;/div&gt;"></div>'), '<div style="width:100%">raw</div>');
    const image = '<img src="https://example.com/image.png" alt="raw image">';
    assert.equal(editorHtmlToMarkdown(markdownToEditorHtml(image)), image);
    const tasks = "- [x] Complete\n- [ ] Pending";
    assert.equal(editorHtmlToMarkdown(markdownToEditorHtml(tasks)), tasks);
    const table = "| First | Second |\n| --- | --- |\n| A | B |";
    assert.equal(editorHtmlToMarkdown(markdownToEditorHtml(table)), table);
  });
  test("renders public Gallery/Project body formatting", async () => {
    for (const kind of ["gallery", "projects"]) {
      const doc = makeDoc(kind); doc.body = "## Heading\n\n**Strong** [Link](https://example.com)\n\n- Item\n\n![Image](https://example.com/art.png)";
      const saved = parseContentMarkdown(buildContentMarkdown(doc), kind);
      const html = await renderContentMarkdown(saved.body);
      assert.match(html, /<h2[^>]*>Heading/); assert.match(html, /<strong>Strong<\/strong>/); assert.match(html, /<li>Item/); assert.match(html, /src="https:\/\/example.com\/art.png"/);
    }
  });
  test("generates filenames for current documents and preserves imported paths", () => {
    for (const kind of ["journal", "songs", "gallery", "projects"]) {
      const doc = makeDoc(kind); doc.common.date = "2026-01-02";
      if ("slug" in doc.placement.data) doc.placement.data.slug = "A Name";
      assert.equal(generatedContentFilename(doc), kind === "songs" ? "2026-01-02.md" : kind === "journal" ? "2026-01-02-a-name.md" : "a-name.md");
      doc.file = { path: "original.md" }; assert.equal(generatedContentFilename(doc), "original.md");
    }
  });
});

describe("production pending batch", () => {
  test("default dependencies use the real HTTP batch client for two distinct documents", async () => {
    let batches = 0;
    await withFetch(async (url, options) => {
      if (url.startsWith("/api/content-item")) return new Response(null, { status: 404 });
      assert.equal(url, "/api/pending-batch"); batches++;
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.contents.map((item) => item.path), ["2026-01-02.md", "2026-01-03.md"]);
      return Response.json({ commitSha: "http-commit", contents: payload.contents.map((item) => ({ id: item.id, path: item.path, revision: `revision-${item.id}` })) });
    }, async () => {
      const result = await applyPendingChanges(makeQueue(), () => {});
      assert.equal(result.lastCommitSha, "http-commit");
      assert.ok(result.contents.every((item) => item.applied && item.document.file.revision));
    });
    assert.equal(batches, 1);
  });
  test("writes every revision, media revision, commit SHA and progress after success", async () => {
    const queue = { ...makeQueue(), media: { registry: media, expectedRevision: "old" } }; let progress;
    const result = await applyPendingChanges(queue, (next) => { progress = next; }, deps({ commitBatch: async (payload) => {
      assert.deepEqual(payload.media, { registry: media, expectedRevision: "old", force: false });
      return { commitSha: "new-commit", contents: payload.contents.map((item) => ({ id: item.id, path: item.path, revision: `new-${item.id}` })), mediaRevision: "new-media" };
    } }));
    assert.equal(progress, result); assert.equal(result.lastCommitSha, "new-commit");
    for (const item of result.contents) { assert.equal(item.applied, true); assert.equal(item.document.file.revision, `new-${item.document.id}`); }
    assert.equal(result.media.expectedRevision, "new-media"); assert.equal(result.media.applied, true);
  });
  for (const target of ["content", "media"]) test(`translates ${target} batch conflicts and keeps changes pending`, async () => {
    const queue = makeQueue(); const detail = { target, documentId: queue.contents[0].document.id, operation: "save", currentRevision: "newer" }; let progressed = false;
    await assert.rejects(() => applyPendingChanges(queue, () => { progressed = true; }, deps({ commitBatch: async () => { throw new BatchConflictError(detail); } })), (error) => error instanceof PendingConflictError && error.detail === detail);
    assert.equal(progressed, false); assert.ok(queue.contents.every((item) => !item.applied));
  });
  for (const target of ["content", "media"]) test(`forces only the selected ${target} conflict`, async () => {
    const queue = { ...makeQueue(), media: { registry: media, expectedRevision: "old" } };
    const first = queue.contents[0].document; first.file = { path: "one.md", revision: "old" };
    const force = target === "content" ? first.id : "media";
    await applyPendingChanges(queue, () => {}, deps({ readRevision: async (_kind, filename) => filename === "one.md" ? target === "content" ? "newer" : "old" : undefined, loadMedia: async () => ({ registry: media, revision: target === "media" ? "newer" : "old" }), commitBatch: async (payload) => {
      assert.deepEqual(payload.contents.map((item) => item.force), [target === "content", false]); assert.equal(payload.media.force, target === "media");
      return { commitSha: "commit", contents: payload.contents.map((item) => ({ id: item.id, path: item.path, revision: "saved" })), mediaRevision: "saved" };
    } }), force);
  });
  test("rejects unpublished requirements and preflight content/media conflicts before batch", async () => {
    const queue = makeQueue(); queue.contents[0].document.common.publication = "published"; queue.contents[0].document.common.title = "";
    await assert.rejects(() => applyPendingChanges(queue, () => {}, deps()), /公開/);
    queue.contents[0].document.common.publication = "draft";
    await assert.rejects(() => applyPendingChanges(queue, () => {}, deps({ readRevision: async () => "newer" })), (error) => error instanceof PendingConflictError && error.detail.target === "content");
    queue.media = { registry: media, expectedRevision: "stale" };
    await assert.rejects(() => applyPendingChanges(queue, () => {}, deps()), (error) => error instanceof PendingConflictError && error.detail.target === "media");
  });
});

describe("current CMS HTTP clients and defaults", () => {
  test("batch client sends payload and translates conflicts and failures", async () => {
    const payload = { contents: [], media: { registry: media } };
    await withFetch(async (url, options) => { assert.equal(url, "/api/pending-batch"); assert.deepEqual(JSON.parse(options.body), payload); return Response.json({ commitSha: "commit", contents: [], mediaRevision: "rev" }); }, async () => assert.equal((await commitBatch(payload)).mediaRevision, "rev"));
    await withFetch(async () => Response.json({ target: "media", operation: "save" }, { status: 409 }), async () => assert.rejects(() => commitBatch(payload), BatchConflictError));
    await withFetch(async () => new Response("failure", { status: 500 }), async () => assert.rejects(() => commitBatch(payload), /failure/));
  });
  test("media registry client handles load, save, force and conflicts", async () => {
    await withFetch(async (_url, options) => { if (options) assert.deepEqual(JSON.parse(options.body), { registry: media, expectedRevision: "old", force: true }); return Response.json({ registry: media, revision: "new" }); }, async () => { assert.equal((await loadMediaRegistry()).revision, "new"); assert.equal((await saveMediaRegistry(media, "old", true)).revision, "new"); });
    await withFetch(async () => Response.json({ currentRevision: "newer" }, { status: 409 }), async () => assert.rejects(() => saveMediaRegistry(media), (error) => error instanceof MediaRegistryConflictError && error.currentRevision === "newer"));
    await withFetch(async () => Response.json({ error: "denied" }, { status: 403 }), async () => { await assert.rejects(() => loadMediaRegistry(), /denied/); await assert.rejects(() => saveMediaRegistry(media), /denied/); });
  });
  test("deploy client transmits commit SHA and queries deployment status", async () => {
    await withFetch(async (url, options) => { if (options) assert.deepEqual(JSON.parse(options.body), { deploymentId: "id", commitSha: "sha" }); else assert.match(url, /deploymentId=id&startedAt=/); return Response.json({ deploymentId: "id", sha: "sha", status: "queued" }); }, async () => { assert.equal((await startSiteDeploy("id", "sha")).sha, "sha"); assert.equal((await getSiteDeploy("id", "2026-01-02")).status, "queued"); });
    await withFetch(async () => new Response("failed", { status: 409 }), async () => { await assert.rejects(() => startSiteDeploy("id"), /failed/); await assert.rejects(() => getSiteDeploy("id"), /failed/); });
  });
  test("reads current and missing content revisions", async () => {
    await withFetch(async () => Response.json({ revision: "rev", markdown: "Body" }), async () => assert.equal(await readContentRevision("journal", "demo.md"), "rev"));
    await withFetch(async () => new Response(null, { status: 404 }), async () => assert.equal(await readContentRevision("journal", "missing.md"), undefined));
  });
  test("article defaults sanitize malformed data and preserve valid settings", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage"); let stored = "invalid";
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => stored, setItem: (_key, value) => { stored = value; } } });
    try { assert.deepEqual(readArticleDefaults(), { thumbnail: "", thumbnailAlt: "", ogImage: "" }); const defaults = { thumbnail: "image", thumbnailAlt: "alt", ogImage: "og" }; writeArticleDefaults(defaults); assert.deepEqual(readArticleDefaults(), defaults); stored = '{"thumbnail":false}'; assert.equal(readArticleDefaults().thumbnail, ""); }
    finally { if (original) Object.defineProperty(globalThis, "localStorage", original); else delete globalThis.localStorage; }
  });
});
