import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
const window = new Window({ url: "http://localhost:5174" });
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "PointerEvent", "navigator", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? window[key].bind(window) : window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { ContentList } = await import("../src/components/ContentList.tsx");
const { VisualEditor } = await import("../src/components/VisualEditor.tsx");
const { panelPosition } = await import("../src/components/FloatingPanel.tsx");
async function mount(Component, props) {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  await act(async () => root.render(createElement(Component, props)));
  return { container, async close() { await act(async () => root.unmount()); container.remove(); } };
}
const click = async (node) => { assert.ok(node); await act(async () => node.click()); };
const outside = async () => { await act(async () => document.body.dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true }))); };
const escape = async () => { await act(async () => document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))); };

test("popover placement flips at the bottom and clamps at every viewport edge", () => {
  const viewport = { width: 320, height: 640 };
  assert.deepEqual(panelPosition({ left: 310, top: 610, bottom: 638 }, 230, 200, viewport), { left: 82, top: 404, maxHeight: 624 });
  assert.deepEqual(panelPosition({ left: -100, top: -20, bottom: 8 }, 230, 900, viewport), { left: 8, top: 8, maxHeight: 624 });
  assert.equal(panelPosition({ left: 20, top: 20, bottom: 48 }, 230, 200, viewport).top, 54);
});

test("new-content menu toggles, keeps internal clicks and dismisses on outside/Escape", async () => {
  const selected = [];
  const mounted = await mount(ContentList, { documents: [], files: [], filters: { kind: "all", publication: "all", query: "" }, onFilters: () => {}, onOpen: () => {}, onNew: (kind) => selected.push(kind) });
  try {
    const trigger = mounted.container.querySelector(".new-content-wrap > button");
    await click(trigger); assert.ok(document.querySelector(".new-content-menu"));
    await act(async () => document.querySelector(".new-content-menu").dispatchEvent(new window.PointerEvent("pointerdown", { bubbles: true })));
    assert.ok(document.querySelector(".new-content-menu"));
    await click(trigger); assert.equal(document.querySelector(".new-content-menu"), null);
    await click(trigger); await outside(); assert.equal(document.querySelector(".new-content-menu"), null);
    await click(trigger); await escape(); assert.equal(document.querySelector(".new-content-menu"), null); assert.equal(document.activeElement, trigger);
    await click(trigger); await click(document.querySelector(".new-content-menu button")); assert.deepEqual(selected, ["journal"]); assert.equal(document.querySelector(".new-content-menu"), null);
  } finally { await mounted.close(); }
});

test("real block toolbar preserves drag/drop, move actions and shared dismissal", async () => {
  const outputs = [];
  const mounted = await mount(VisualEditor, { value: "First\n\nSecond\n\nThird", onChange: (value) => outputs.push(value), onOpenMedia: () => {} });
  try {
    const paragraphs = () => mounted.container.querySelectorAll(".tiptap > p");
    const hover = async (node) => { await act(async () => node.dispatchEvent(new window.MouseEvent("mousemove", { bubbles: true }))); };
    await hover(paragraphs()[0]); const handle = mounted.container.querySelector(".drag-handle"); assert.ok(handle.querySelector("svg"));
    await click(handle); assert.ok(document.querySelector(".action-popover")); await outside(); assert.equal(document.querySelector(".action-popover"), null);
    await click(handle); await escape(); assert.equal(document.activeElement, handle);
    const transfer = { setData() {}, effectAllowed: "", dropEffect: "" };
    const dragEvent = (type, clientY = 1) => { const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientY }); Object.defineProperty(event, "dataTransfer", { value: transfer }); return event; };
    await act(async () => handle.dispatchEvent(dragEvent("dragstart")));
    assert.ok(mounted.container.querySelector(".is-dragging"));
    await act(async () => paragraphs()[1].dispatchEvent(dragEvent("dragover")));
    assert.ok(mounted.container.querySelector(".block-drop-indicator"));
    await act(async () => paragraphs()[1].dispatchEvent(dragEvent("drop")));
    assert.equal(outputs.at(-1), "Second\n\nFirst\n\nThird"); assert.equal(mounted.container.querySelector(".block-drop-indicator"), null);
    await hover(paragraphs()[1]); await click(mounted.container.querySelector(".drag-handle"));
    await click([...document.querySelectorAll(".action-popover button")].find((item) => item.textContent === "上へ移動"));
    assert.equal(outputs.at(-1), "First\n\nSecond\n\nThird");
    await hover(paragraphs()[0]); await click(mounted.container.querySelector('[aria-label="下にブロックを追加"]'));
    assert.ok(document.querySelector(".add-popover")); await escape(); assert.equal(document.querySelector(".add-popover"), null);
  } finally { await mounted.close(); }
});
