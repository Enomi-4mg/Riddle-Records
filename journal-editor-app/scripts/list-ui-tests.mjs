import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import { Window } from "happy-dom";
import { initializeListControls } from "../../assets/js/listControls.js";
const galleryScript = await fs.readFile(new URL("../../assets/js/gallery.js", import.meta.url), "utf8");
function setup(defaultView = "list", stored = null) {
  const window = new Window({ url: "https://example.com" });
  const document = window.document;
  document.body.innerHTML = `<div data-list-switch data-target="gallery-container" data-page="demo" data-default-view="${defaultView}"><button data-view="list"></button><button data-view="grid"></button></div><div data-sort-switch data-target="gallery-container"><button data-sort="newest"></button><button data-sort="oldest"></button></div><button class="filter-btn active" data-filter="all"></button><button class="filter-btn" data-filter="A"></button><button class="filter-btn" data-filter="B"></button><div id="gallery-container"><article id="new" class="gallery-item" data-date="2026-01-02" data-categories="A"></article><article id="old" class="gallery-item" data-date="2025-01-02" data-categories="B"></article></div>`;
  const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  initializeListControls(document, () => storage);
  return { window, document, container: document.getElementById("gallery-container"), stored: () => stored };
}
test("page defaults, remembered views, invalid storage and unavailable storage", () => {
  for (const [fallback, stored, expected] of [["list", null, "list"], ["grid", null, "grid"], ["list", "grid", "grid"], ["list", "invalid", "list"]]) {
    const { document, container } = setup(fallback, stored);
    assert.equal(container.dataset.view, expected);
    assert.equal(document.querySelector(`[data-view="${expected}"]`).getAttribute("aria-pressed"), "true");
  }
  const { document, container, stored } = setup();
  document.querySelector('[data-view="grid"]').click(); assert.equal(container.dataset.view, "grid"); assert.equal(stored(), "grid");
  delete document.querySelector("[data-list-switch]").dataset.initialized;
  initializeListControls(document, () => { throw new Error("denied"); }); assert.equal(container.dataset.view, "list");
});
test("sorting and view changes preserve existing multi-tag union filtering", () => {
  const { window, document, container } = setup("grid");
  window.eval(galleryScript); window.initGallery();
  document.querySelector('[data-filter="A"]').click();
  assert.equal(document.getElementById("old").style.display, "none");
  document.querySelector('[data-sort="oldest"]').click();
  document.querySelector('[data-view="list"]').click();
  assert.equal(container.firstElementChild.id, "old"); assert.equal(document.getElementById("old").style.display, "none");
  document.querySelector('[data-filter="B"]').click(); assert.equal(document.getElementById("old").style.display, ""); assert.equal(document.getElementById("new").style.display, "");
  document.querySelector('[data-sort="newest"]').click(); assert.equal(container.firstElementChild.id, "new");
  document.querySelector('[data-filter="all"]').click(); assert.equal(document.querySelectorAll(".filter-btn.active").length, 1);
});
