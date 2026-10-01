import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
const window = new Window();
for (const key of ["window", "document", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "navigator"]) Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement, act, useState } = await import("react");
const { createRoot } = await import("react-dom/client");
const { TagInput } = await import("../src/components/TagInput.tsx");

test("actual tag input preserves a trailing comma and commits multiple tags on blur/Enter", async () => {
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); const commits = [];
  function Harness() {
    const [tags, setTags] = useState(["art"]);
    return createElement(TagInput, { documentId: "one", tags, onCommit: (value) => { commits.push(value); setTags(value); } });
  }
  try {
    await act(async () => root.render(createElement(Harness)));
    const input = container.querySelector("input");
    await act(async () => input.focus());
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => { setter.call(input, "art,"); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
    assert.equal(input.value, "art,"); assert.deepEqual(commits, []);
    await act(async () => { setter.call(input, "art, music, Music, art, "); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
    assert.equal(input.value, "art, music, Music, art, ");
    await act(async () => input.blur());
    assert.deepEqual(commits, [["art", "Music"]]); assert.equal(input.value, "art, Music");
    await act(async () => { input.focus(); setter.call(input, "art, music, study"); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
    await act(async () => input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    assert.deepEqual(commits.at(-1), ["art", "Music", "study"]);
    await act(async () => { input.focus(); setter.call(input, "art"); input.dispatchEvent(new window.Event("input", { bubbles: true })); input.blur(); });
    assert.deepEqual(commits.at(-1), ["art"]); assert.equal(input.value, "art");
  } finally { await act(async () => root.unmount()); container.remove(); }
});
