import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Window } from "happy-dom";
import { buildContentMarkdown, contentFrontmatter, createContentDocument, generatedContentFilename, parseContentMarkdown, publicationChecks } from "../src/lib/cmsMarkdown.ts";
import { publishDocument, setPublicationDate } from "../src/lib/publication.ts";
import { documentCard } from "../src/lib/linkCards.ts";
import { publicationDateAt, isPublicationDate } from "../../shared/publicationDate.ts";
import { getJournalPermalink } from "../../shared/contentRoutes.ts";

const d1 = new Date("2026-10-01T03:00:00Z"), d2 = new Date("2026-10-05T03:00:00Z"), d3 = new Date("2026-10-09T03:00:00Z");
const kinds = ["journal", "songs", "gallery", "projects"];
function draft(kind) {
  const doc = createContentDocument(kind, d1); doc.common.title = "Draft";
  if (kind === "songs") doc.placement.data.youtubeId = "abcdefghijk";
  if (kind === "gallery") { doc.placement.data.slug = "art"; doc.placement.data.image = "folder/art"; }
  if (kind === "projects") doc.placement.data.slug = "tool";
  return doc;
}

for (const kind of kinds) test(`${kind}: D1 draft saves undated, first publishes at D2 and retains its history at D3`, () => {
  const original = draft(kind);
  assert.equal(original.common.date, "");
  const draftPath = generatedContentFilename(original);
  assert.ok(draftPath); assert.ok(!draftPath.includes("2026-10-01"));
  const reopened = parseContentMarkdown(buildContentMarkdown(original), kind, { path: draftPath, revision: "draft-revision" });
  assert.equal(reopened.createdAt, d1.toISOString()); assert.equal(reopened.common.date, "");
  const published = publishDocument(reopened, d2);
  assert.equal(published.common.date, "2026-10-05"); assert.equal(published.createdAt, d1.toISOString());
  assert.equal(published.publicationHistory.firstPublishedAt, d2.toISOString());
  assert.ok(publicationChecks(published).every((check) => check.ok));
  assert.equal(generatedContentFilename(published), draftPath); assert.equal(published.file.revision, "draft-revision");
  const saved = buildContentMarkdown(published);
  assert.equal(contentFrontmatter(published).date, "2026-10-05");
  assert.equal(buildContentMarkdown(parseContentMarkdown(saved, kind, published.file)), saved);
  const reread = parseContentMarkdown(saved, kind, published.file);
  reread.common.publication = "draft"; reread.body = "Edited at D3"; reread.updatedAt = d3.toISOString();
  const republished = publishDocument(reread, d3);
  assert.equal(republished.common.date, "2026-10-05"); assert.equal(republished.createdAt, d1.toISOString());
  assert.equal(republished.publicationHistory.firstPublishedAt, d2.toISOString());
  const manual = publishDocument(setPublicationDate(reread, "2026-09-30"), d3);
  assert.equal(manual.common.date, "2026-09-30");
});

test("explicit dates survive first publication and reload, while old browser drafts get the first publication date", () => {
  const manual = setPublicationDate(draft("journal"), "2026-09-28");
  const reloaded = parseContentMarkdown(buildContentMarkdown(manual), "journal");
  assert.equal(publishDocument(reloaded, d2).common.date, "2026-09-28");
  const legacy = draft("journal"); delete legacy.publicationHistory; legacy.common.date = "2026-10-01";
  assert.equal(publishDocument(legacy, d2).common.date, "2026-10-05");
  const imported = parseContentMarkdown("---\ntitle: Existing\ndate: 2020-01-02\n---\nBody", "journal", { path: "old.md", revision: "old" });
  assert.equal(publishDocument(imported, d3).common.date, "2020-01-02");
  imported.common.publication = "draft";
  assert.equal(publishDocument(imported, d3).common.date, "2020-01-02");
  assert.equal(generatedContentFilename(imported), "old.md");
});

test("publication uses Tokyo midnight and rejects malformed or impossible manually entered dates", () => {
  assert.equal(publicationDateAt(new Date("2026-10-04T14:59:59Z")), "2026-10-04");
  assert.equal(publicationDateAt(new Date("2026-10-04T15:00:00Z")), "2026-10-05");
  for (const value of ["", "2026-2-1", "2026-02-30", "invalid"]) {
    assert.equal(isPublicationDate(value), false);
    assert.equal(publicationChecks(setPublicationDate(draft("journal"), value)).find((check) => check.label === "公開日").ok, false);
  }
  assert.equal(isPublicationDate("2024-02-29"), true);
});

test("new published filenames, Journal routes and internal cards use the publication date", () => {
  const journal = publishDocument(draft("journal"), d2);
  assert.equal(generatedContentFilename(journal), "2026-10-05.md");
  for (const [type, slug, expected] of [["journal", "", "/journal/2026-10-05/"], ["making", "art", "/journal/2026/10/05/art/"], ["report", "", "/journal/2026-10/"]]) {
    journal.placement.data.articleType = type; journal.placement.data.slug = slug;
    assert.equal(documentCard(journal).url, expected);
    assert.equal(getJournalPermalink({ data: { date: new Date(contentFrontmatter(journal).date), type, slug } }), expected);
  }
  const song = publishDocument(draft("songs"), d2);
  assert.equal(generatedContentFilename(song), "2026-10-05.md"); assert.equal(documentCard(song).url, "/disco/2026-10-05/");
  song.file = { path: "content-stable.md" };
  assert.equal(documentCard(song).url, "/disco/content-stable/");
});

test("CMS history and future metadata survive repeated Markdown saving", () => {
  const doc = draft("journal"); doc.unknownFrontmatter = { custom: "keep", _cms: { future: { nested: true } } };
  const published = publishDocument(doc, d2), saved = buildContentMarkdown(published);
  const read = parseContentMarkdown(saved, "journal");
  assert.equal(read.unknownFrontmatter._cms.future.nested, true);
  assert.equal(read.createdAt, d1.toISOString()); assert.equal(read.updatedAt, d1.toISOString());
  assert.equal(buildContentMarkdown(read), saved);
});

test("actual Astro schemas accept undated drafts and reject undated public content", async () => {
  const result = await build({ entryPoints: [fileURLToPath(new URL("../../src/content/config.ts", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node",
    plugins: [{ name: "astro-schema", setup(builder) {
      builder.onResolve({ filter: /^astro:content$/ }, () => ({ path: "fixture", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `export { z } from ${JSON.stringify(fileURLToPath(import.meta.resolve("zod")))}; export const defineCollection = value => value;`, resolveDir: process.cwd() }));
    } }] });
  const { collections } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  for (const kind of kinds) {
    const raw = contentFrontmatter(draft(kind));
    for (const date of ["", undefined, null]) {
      assert.equal(collections[kind].schema.safeParse({ ...raw, date }).success, true);
      assert.equal(collections[kind].schema.safeParse({ ...raw, date, draft: false }).success, false);
    }
    const publicData = contentFrontmatter(publishDocument(draft(kind), d2));
    assert.equal(collections[kind].schema.parse(publicData).date.toISOString().slice(0, 10), "2026-10-05");
  }
});

test("App can save an undated draft, publish, reload and explicitly change its date", async () => {
  const window = new Window({ url: "http://localhost:5174" });
  for (const key of ["window", "document", "Element", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "navigator", "MutationObserver", "localStorage", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"])
    Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? window[key].bind(window) : window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { act, createElement } = await import("react"), { createRoot } = await import("react-dom/client");
  const { App } = await import("../src/App.tsx"), { readPending } = await import("../src/lib/pendingChanges.ts");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (address) => {
    if (address === "/api/content-list") return Response.json({ files: [] });
    if (address === "/api/media-registry") return Response.json({ registry: { version: 1, assets: [] }, revision: "media" });
    throw new Error(`Unexpected ${address}`);
  };
  const container = document.createElement("div"); document.body.append(container); let root = createRoot(container);
  const button = (text) => [...document.querySelectorAll("button")].find((item) => item.textContent === text);
  const click = async (node) => { assert.ok(node); await act(async () => node.click()); };
  const input = async (node, value) => { await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(node, value); node.dispatchEvent(new window.Event("input", { bubbles: true })); }); };
  try {
    await act(async () => root.render(createElement(App)));
    await click(button("新規作成")); await click([...document.querySelectorAll(".new-content-menu button")].find((item) => item.textContent === "Journal"));
    await input(container.querySelector(".title-input"), "New publication");
    await click(button("下書きを保存")); assert.equal(readPending().contents[0].document.common.date, "");
    const publish = [...container.querySelectorAll("button")].find((item) => item.textContent === "公開する");
    assert.ok(publish && !publish.disabled); await click(publish);
    const saved = readPending().contents[0].document;
    assert.equal(saved.common.date, publicationDateAt()); assert.equal(saved.publicationHistory.hasBeenPublished, true);
    await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(createElement(App)));
    await click(button("記事設定")); const date = container.querySelector('input[type="date"]');
    assert.equal(date.value, saved.common.date); await input(date, "2026-09-28");
    assert.equal(readPending().contents[0].document.common.date, "2026-09-28");
    assert.equal(readPending().contents[0].document.createdAt, saved.createdAt);
    assert.equal(readPending().contents[0].document.publicationHistory.dateSource, "manual");
  } finally { await act(async () => root.unmount()); container.remove(); localStorage.clear(); globalThis.fetch = originalFetch; }
});
