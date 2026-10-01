import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { initializeGalleryViewers } from "../../assets/js/galleryViewer.js";
import { galleryWorkPath, workReference } from "../../shared/workIdentity.ts";
const works = [
  { id: "gallery:one", kind: "visual", title: "One", image: "/one.png", imageAlt: "One", date: "2026-01-01", tags: ["art"], legacyHash: "one-png", links: [{ label: "Detail", url: "/gallery/one/" }] },
  { id: "songs:two", kind: "music", title: "Two", youtubeId: "abcdefghijk", date: "2025-01-01", tags: ["Music"], credits: "Credits", links: [{ label: "Lyrics", url: "/disco/two/" }, { label: "External", url: "https://example.com" }] },
  { id: "gallery:three", kind: "visual", title: "Three", image: "/three.png", imageAlt: "Three", date: "2024-01-01", tags: [], links: [] }
];
function setup(query = "", items = works) {
  const window = new Window({ url: `https://example.org/site/gallery/${query}` }); const document = window.document;
  document.body.innerHTML = `<section data-gallery-viewer data-base="/site/"><button data-open="menu"></button><button data-open="info"></button><div data-stage tabindex="0"></div><button data-step="-1"></button><button data-step="1"></button><p data-status></p><aside id="viewer-menu" hidden><button data-close></button>${["all", "visual", "music"].map((kind) => `<button data-kind="${kind}"></button>`).join("")}<p data-empty hidden></p>${items.map((work) => `<li data-kind-item="${work.kind}"><button data-work="${work.id}">${work.title}</button></li>`).join("")}</aside><aside id="viewer-info" hidden><button data-close></button><h3 data-info-title></h3><time data-info-date></time><div data-info-tags></div><p data-info-description></p><section data-credits-section><p data-info-credits></p></section><div data-info-links></div></aside><script data-viewer-data type="application/json"></script></section>`;
  document.querySelector("[data-viewer-data]").textContent = JSON.stringify(items);
  initializeGalleryViewers(document); initializeGalleryViewers(document);
  const click = (selector) => document.querySelector(selector).click();
  const key = (value) => document.dispatchEvent(new window.KeyboardEvent("keydown", { key: value, bubbles: true }));
  return { window, document, click, key, stage: document.querySelector("[data-stage]") };
}
test("mixed navigation, direct URL and existing detail links with a site base", () => {
  assert.equal(galleryWorkPath(workReference("songs", "two")), "/gallery/?work=songs%3Atwo");
  const { window, document, key, stage } = setup();
  assert.ok(stage.querySelector("img")); key("ArrowRight"); assert.ok(stage.querySelector("iframe"));
  assert.match(window.location.search, /work=songs%3Atwo/);
  assert.equal(document.querySelector("[data-info-links] a").href, "https://example.org/site/disco/two/");
  assert.equal(document.querySelectorAll("[data-info-links] a")[1].href, "https://example.com/");
  key("ArrowRight"); assert.equal(stage.querySelector("img").alt, "Three"); assert.equal(document.querySelector('[data-step="1"]').disabled, true);
  key("ArrowRight"); assert.equal(stage.querySelector("img").alt, "Three"); key("ArrowLeft"); assert.ok(stage.querySelector("iframe"));
});
test("filters form independent sequences and active music stays mounted without autoplay", () => {
  const { document, click, stage } = setup("?work=songs%3Atwo&filter=music"); const frame = stage.firstElementChild;
  assert.ok(frame.src.includes("youtube-nocookie.com/embed/")); assert.equal(new URL(frame.src).searchParams.has("autoplay"), false); assert.ok(!frame.allow.includes("autoplay"));
  click('[data-open="menu"]'); click('[data-kind="music"]'); assert.equal(stage.firstElementChild, frame);
  assert.equal(document.querySelector('[data-step="1"]').disabled, true);
  click('[data-kind="visual"]'); assert.equal(stage.querySelector("img").alt, "One"); click('[data-step="1"]'); assert.equal(stage.querySelector("img").alt, "Three");
});
test("panel exclusivity, Escape focus restoration and no arrow navigation while in a panel", () => {
  const { document, click, key, stage } = setup();
  click('[data-open="menu"]'); key("ArrowRight"); assert.equal(stage.querySelector("img").alt, "One");
  click('[data-open="info"]'); assert.equal(document.getElementById("viewer-menu").hidden, true); assert.equal(document.getElementById("viewer-info").hidden, false);
  key("Escape"); assert.equal(document.getElementById("viewer-info").hidden, true); assert.equal(document.activeElement.dataset.open, "info");
  click('[data-open="menu"]'); click('[data-work="gallery:three"]'); assert.equal(stage.querySelector("img").alt, "Three"); assert.equal(document.activeElement, stage);
});
test("unknown URLs, contradictory filters, legacy hash and empty collections", () => {
  assert.equal(setup("?work=missing").stage.querySelector("img").alt, "One");
  assert.ok(setup("?work=songs%3Atwo&filter=visual").stage.querySelector("iframe"));
  assert.equal(setup("#one-png").stage.querySelector("img").alt, "One");
  const { stage, document } = setup("?filter=music", works.filter((work) => work.kind === "visual"));
  assert.match(stage.textContent, /作品はまだ/); assert.equal(document.querySelector('[data-step="1"]').disabled, true);
  assert.match(setup("", []).stage.textContent, /作品はまだ/);
});
test("horizontal swipes move works, vertical scrolling does not, transition cleanup removes keys", () => {
  const { window, document, stage, key } = setup();
  const touch = (type, x, y) => { const event = new window.Event(type); Object.defineProperty(event, type === "touchstart" ? "touches" : "changedTouches", { value: [{ clientX: x, clientY: y }] }); stage.dispatchEvent(event); };
  touch("touchstart", 200, 100); touch("touchend", 100, 110); assert.ok(stage.querySelector("iframe"));
  touch("touchstart", 200, 100); touch("touchend", 190, 250); assert.ok(stage.querySelector("iframe"));
  document.dispatchEvent(new window.Event("astro:before-swap")); key("ArrowRight"); assert.ok(stage.querySelector("iframe"));
});
