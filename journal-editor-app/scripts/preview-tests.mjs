import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import { Window } from "happy-dom";
import { createContentDocument } from "../src/lib/cmsMarkdown.ts";
import { renderPreviewArticle } from "../src/lib/sitePreview.ts";
import { embedMarkdown } from "../../shared/embeds.ts";

test("current documents render site article structure, summaries and embeds before publication", () => {
  const referenced = createContentDocument("journal"); referenced.common = { ...referenced.common, title: "Linked article", date: "2026-10-01", publication: "published" }; referenced.placement.data.ogDescription = "Legacy summary";
  const article = createContentDocument("journal"); article.common.title = '<Title & "quotes">'; article.placement.data.ogDescription = "OG only";
  article.body = `## Heading\n\n${embedMarkdown({ kind: "card", url: "/journal/2026-10-01/" })}\n\n${embedMarkdown({ kind: "youtube", url: "https://youtu.be/abcdefghijk" })}`;
  const rendered = renderPreviewArticle(article, [referenced]);
  assert.match(rendered, /&lt;Title &amp; &quot;quotes&quot;&gt;/); assert.match(rendered, /journal-summary">OG only/); assert.match(rendered, /公開日未設定/);
  assert.match(rendered, /class="embed-card"/); assert.match(rendered, /Legacy summary/); assert.match(rendered, /class="content-embed embed-youtube"/); assert.ok(!rendered.includes("language-riddle-embed"));
  const song = createContentDocument("songs"); song.placement.data = { youtubeId: "https://youtu.be/abcdefghijk", credits: "Line 1\nLine 2", lyrics: "Verse 1\nVerse 2" };
  const songHtml = renderPreviewArticle(song, []); assert.match(songHtml, /responsive-video-container/); assert.match(songHtml, /<pre>Line 1\nLine 2<\/pre>/); assert.match(songHtml, /Verse 1\nVerse 2/);
  const gallery = createContentDocument("gallery"); gallery.placement.data.image = "test-art"; assert.match(renderPreviewArticle(gallery, []), /work-detail-image/); assert.match(renderPreviewArticle(gallery, []), /w_1400,q_auto,f_auto/);
  const project = createContentDocument("projects"); project.placement.data.status = "paused";
  const empty = renderPreviewArticle(project, []); assert.match(empty, /状態: 休止中/); assert.ok(!empty.includes("<h2>主な機能</h2>")); assert.ok(!empty.includes("<h2>リンク</h2>"));
  project.placement.data.links = [{ label: "Website", url: "https://example.com/" }]; project.body = "## 主な機能\n\n- Feature";
  assert.match(renderPreviewArticle(project, []), /<h2>主な機能<\/h2>/); assert.match(renderPreviewArticle(project, []), /class="project-action project-action-primary"/);
});

const window = new Window({ url: "http://localhost:5174/", settings: { disableIframePageLoading: true, disableCSSFileLoading: true, disableJavaScriptFileLoading: true } });
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "navigator", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? window[key].bind(window) : window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { CmsEditor } = await import("../src/components/CmsEditor.tsx");
test("current editor opens an isolated site preview, switches width and returns focus", async () => {
  const doc = createContentDocument("journal"); doc.common.title = "Preview title"; doc.body = "Current input";
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const props = { document: doc, documents: [], registry: { version: 1, assets: [] }, disabled: false, onChange() {}, onBack() {}, onSave() {}, onPublish() {}, onUnpublish() {}, onDelete() {} };
  try {
    await act(async () => root.render(createElement(CmsEditor, props)));
    const trigger = [...container.querySelectorAll("button")].find((item) => item.textContent === "サイトでの見え方"); trigger.focus();
    await act(async () => trigger.click());
    const dialog = container.querySelector(".site-preview-dialog"); assert.ok(dialog.open);
    const iframe = dialog.querySelector("iframe"); assert.equal(iframe.getAttribute("sandbox"), ""); assert.match(iframe.srcdoc, /Kiwi\+Maru:wght@400;500/); assert.match(iframe.srcdoc, /--container-page/); assert.match(iframe.srcdoc, /Preview title/); assert.match(iframe.srcdoc, /Current input/);
    assert.equal(container.querySelector("style"), null);
    await act(async () => [...dialog.querySelectorAll("button")].find((item) => item.textContent === "375px").click()); assert.equal(iframe.className, "preview-mobile");
    await act(async () => dialog.dispatchEvent(new window.Event("cancel", { cancelable: true }))); assert.equal(container.querySelector(".site-preview-dialog"), null); assert.ok(document.activeElement === trigger, "focus returns to the preview trigger");
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("retired screens have no remaining component imports or legacy tests", async () => {
  const retired = ["EditorScreen", "DraftList", "SettingsDrawer", "ReviewPane", "ImageCardTool", "FullPreviewScreen"];
  for (const directory of ["src", "scripts"]) {
    for (const entry of await fs.readdir(new URL(`../${directory}`, import.meta.url), { recursive: true })) {
      if (!/\.(tsx?|mjs)$/.test(entry) || entry === "preview-tests.mjs") continue;
      const source = await fs.readFile(new URL(`../${directory}/${entry}`, import.meta.url), "utf8");
      for (const name of retired) assert.ok(!source.includes(`/${name}`), `${entry}: ${name}`);
    }
  }
});
