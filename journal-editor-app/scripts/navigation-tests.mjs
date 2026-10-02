import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
const window = new Window({ url: "http://localhost:5174/?kind=projects&publication=draft&q=Target" });
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "navigator", "MutationObserver", "localStorage", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? window[key].bind(window) : window[key] });
}
let scrollY = 0;
Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
window.scrollTo = (options) => { scrollY = options.top; };
const scroll = (y) => { scrollY = y; window.dispatchEvent(new window.Event("scroll")); };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { App } = await import("../src/App.tsx");
const { readNavigation } = await import("../src/hooks/useCmsNavigation.ts");
const button = (container, text) => [...container.querySelectorAll("button")].find((item) => item.textContent === text);
const click = async (node) => { assert.ok(node); await act(async () => node.click()); };
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

test("invalid parameters fall back safely without admitting About into the list", () => {
  assert.deepEqual(readNavigation("?kind=about&publication=no&screen=invalid&q=%E0%A4").filters, { kind: "all", publication: "all", query: "�" });
  assert.equal(readNavigation("?screen=invalid").screen, "content");
});

test("App preserves URL filters through editor, media, reload and browser history", async () => {
  const original = globalThis.fetch;
  const sources = new Map([
    ["projects/target.md", "---\ntitle: Target project\ndate: 2026-10-01\nslug: target\ndraft: true\n---\n\nBody"],
    ["about/profile.md", "---\ntitle: About\nname: 4mg\n---\n"],
    ["journal/other.md", "---\ntitle: Other article\ndate: 2026-10-01\n---\n"]
  ]);
  globalThis.fetch = async (address) => {
    const url = new URL(address, window.location.href);
    if (url.pathname === "/api/content-list") return Response.json({ files: [...sources.keys()].map((path) => ({ kind: path.split("/")[0], path: path.split("/")[1], revision: "rev" })) });
    if (url.pathname === "/api/media-registry") return Response.json({ registry: { version: 1, assets: [] }, revision: "media" });
    if (url.pathname === "/api/content-item") return Response.json({ markdown: sources.get(`${url.searchParams.get("kind")}/${url.searchParams.get("path")}`), revision: "rev" });
    throw new Error(`Unexpected ${address}`);
  };
  const container = document.createElement("div"); document.body.append(container); let root = createRoot(container);
  try {
    await act(async () => root.render(createElement(App)));
    assert.equal(container.querySelectorAll(".content-row").length, 1);
    scroll(840);
    await click(container.querySelector(".content-row")); assert.ok(container.querySelector(".editor-shell")); assert.equal(window.scrollY, 0);
    scroll(310);
    assert.equal(new URLSearchParams(window.location.search).get("kind"), "projects");
    await click(button(container, "← コンテンツ")); assert.equal(container.querySelectorAll(".content-row").length, 1);
    assert.equal(window.scrollY, 840);
    assert.equal(button(container, "Projects").className, "active"); assert.equal(button(container, "下書き").className, "active");
    await act(async () => { window.history.back(); await tick(); }); assert.ok(container.querySelector(".editor-shell")); assert.equal(window.scrollY, 310);
    await act(async () => { window.history.forward(); await tick(); }); assert.ok(container.querySelector(".content-index")); assert.equal(window.scrollY, 840);
    await click(button(container, "メディア")); assert.equal(window.scrollY, 0); scroll(240); await click(button(container, "コンテンツ")); assert.equal(window.scrollY, 840);
    await click(button(container, "About")); assert.equal(window.scrollY, 0); await click(button(container, "コンテンツ")); assert.equal(window.scrollY, 840);
    assert.equal(container.querySelector(".filter-bar input").value, "Target");
    await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(createElement(App)));
    assert.equal(container.querySelectorAll(".content-row").length, 1); assert.equal(button(container, "Projects").className, "active");
    await click(container.querySelector(".content-row"));
    await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(createElement(App)));
    assert.ok(container.querySelector(".editor-shell")); assert.equal(container.querySelector(".title-input").value, "Target project");
  } finally { await act(async () => root.unmount()); container.remove(); globalThis.fetch = original; localStorage.clear(); }
});

 test("Journal OG-only summaries appear in the real list and participate in search", async () => {
  const { ContentList } = await import("../src/components/ContentList.tsx");
  const { parseContentMarkdown } = await import("../src/lib/cmsMarkdown.ts");
  const doc = parseContentMarkdown("---\ntitle: Older Journal\ndate: 2026-10-01\nog_description: Searchable legacy summary\n---\nBody", "journal", "older.md");
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(ContentList, { documents: [doc], files: [], filters: { kind: "all", publication: "all", query: "searchable" }, onFilters() {}, onOpen() {}, onNew() {} })));
    assert.equal(container.querySelector(".content-row small").textContent, "Searchable legacy summary");
    assert.equal(doc.common.description, "");
  } finally { await act(async () => root.unmount()); container.remove(); }
});

test("new documents start at the top and list filter changes retain the position", async () => {
  const { useCmsNavigation } = await import("../src/hooks/useCmsNavigation.ts");
  window.history.replaceState(null, "", "/");
  let navigation; function Probe() { navigation = useCmsNavigation(); return null; }
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(Probe)));
    scroll(600);
    await act(async () => navigation.setFilters({ kind: "journal", publication: "all", query: "" })); assert.equal(window.scrollY, 600);
    await act(async () => navigation.navigate("editor", "new-document")); assert.equal(window.scrollY, 0);
    await act(async () => navigation.navigate("content")); assert.equal(window.scrollY, 600);
  } finally { await act(async () => root.unmount()); container.remove(); }
});
