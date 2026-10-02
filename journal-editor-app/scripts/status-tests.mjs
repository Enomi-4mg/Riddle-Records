import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
const window = new Window({ url: "http://localhost:5174" });
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "navigator", "MutationObserver", "localStorage", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? window[key].bind(window) : window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { App } = await import("../src/App.tsx");
const { cmsStatus } = await import("../src/lib/cmsStatus.ts");
const { useContentDocuments } = await import("../src/hooks/useContentDocuments.ts");
const { useNotice } = await import("../src/hooks/useNotice.ts");
const { Notice } = await import("../src/components/CmsFeedback.tsx");
const { readPending } = await import("../src/lib/pendingChanges.ts");
const empty = { version: 1, contents: [] };
const deployment = { id: "id", sha: "sha" };
const button = (container, text) => [...container.querySelectorAll("button")].find((item) => item.textContent === text);
const click = async (node) => { assert.ok(node); await act(async () => node.click()); };
async function mount(Component) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); await act(async () => root.render(createElement(Component))); return { container, async close() { await act(async () => root.unmount()); container.remove(); localStorage.clear(); window.history.replaceState(null, "", "/"); } }; }

test("status labels reflect persistent state, including conflict/error precedence", () => {
  const base = { pending: empty, deployment: { state: "idle" } };
  for (const [options, label] of [
    [base, "保存済み"], [{ ...base, pending: { ...empty, media: {} } }, "未反映"],
    [{ ...base, deployment: { state: "syncing-github" } }, "GitHub反映中"],
    [{ ...base, pending: { ...empty, deployment }, deployment: { state: "waiting", deployment } }, "デプロイ中"],
    [{ ...base, pending: { ...empty, deployment }, deployment: { state: "paused", deployment, message: "offline" } }, "確認待ち"],
    [{ ...base, deployment: { state: "failed", message: "failed" } }, "エラー"],
    [{ ...base, error: "load failed" }, "エラー"], [{ ...base, readonly: true }, "読み取り専用"],
    [{ ...base, error: "failed", conflict: true }, "競合"]
  ]) assert.equal(cmsStatus(options).label, label);
});

test("App separates save feedback from pending state, resolves conflicts and disables readonly editing", async () => {
  localStorage.clear(); const original = globalThis.fetch; let external = false;
  const markdown = (title) => `---\ntitle: ${title}\ndate: 2026-10-01\n---\n\nBody`;
  globalThis.fetch = async (address) => {
    const url = new URL(address, window.location.href);
    if (url.pathname === "/api/content-list") return Response.json({ files: [{ kind: "journal", path: "example.md", revision: external ? "new" : "old" }] });
    if (url.pathname === "/api/content-item") return Response.json({ path: "example.md", markdown: markdown(external ? "Remote title" : "Original"), revision: external ? "new" : "old" });
    if (url.pathname === "/api/media-registry") return Response.json({ registry: { version: 1, assets: [] }, revision: "media" });
    throw new Error(`Unexpected ${address}`);
  };
  const mounted = await mount(App);
  try {
    assert.equal(mounted.container.querySelector(".status-pill").textContent, "保存済み"); assert.equal(mounted.container.querySelector(".cms-notice"), null);
    await click(mounted.container.querySelector(".content-row")); const input = mounted.container.querySelector(".title-input");
    await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "Browser title"); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
    assert.equal(mounted.container.querySelector(".status-pill").textContent, "未反映");
    assert.equal(readPending().contents[0].document.common.title, "Browser title", "Input is saved before any explicit action");
    await click(button(mounted.container, "入力を確認")); const notice = mounted.container.querySelector(".cms-notice"); assert.equal(notice.getAttribute("role"), "status"); assert.ok(!notice.classList.contains("status-pill"));
    await click(notice.querySelector("button")); assert.equal(mounted.container.querySelector(".cms-notice"), null); assert.equal(mounted.container.querySelector(".status-pill").textContent, "未反映");
    external = true; await click([...mounted.container.querySelectorAll("button")].find((item) => item.textContent.startsWith("保留変更をサイトに反映")));
    assert.equal(mounted.container.querySelector(".status-pill").textContent, "競合"); assert.match(mounted.container.querySelector(".conflict-bar").textContent, /new/);
    await click(button(mounted.container, "GitHub版を再読み込み")); assert.equal(readPending().contents.length, 0); assert.equal(mounted.container.querySelector(".title-input").value, "Remote title"); assert.equal(mounted.container.querySelector(".status-pill").textContent, "保存済み");
    localStorage.setItem("riddle-cms-active-tab", JSON.stringify({ id: "other", at: Date.now() })); await act(async () => window.dispatchEvent(new window.StorageEvent("storage", { key: "riddle-cms-active-tab" })));
    assert.equal(mounted.container.querySelector(".status-pill").textContent, "読み取り専用"); assert.equal(mounted.container.querySelector("[contenteditable]").getAttribute("contenteditable"), "false"); assert.equal(button(mounted.container, "入力を確認").disabled, true);
  } finally { await mounted.close(); globalThis.fetch = original; }
});

test("content revalidation ignores old responses and preserves documents on a load failure", async () => {
  const original = globalThis.fetch; let resolveOld, calls = 0, failed = false;
  globalThis.fetch = async (address) => {
    if (address === "/api/content-list") return failed ? Response.json({ error: "offline" }, { status: 503 }) : Response.json({ files: [{ kind: "journal", path: "file.md", revision: "rev" }] });
    const response = () => Response.json({ markdown: "---\ntitle: New\ndate: 2026-10-01\n---\n", revision: "new" });
    calls++; return calls === 1 ? new Promise((resolve) => { resolveOld = resolve; }) : response();
  };
  function Harness() { const { documents, error, refresh } = useContentDocuments(empty); return createElement("div", {}, createElement("button", { onClick: refresh }, "Refresh"), createElement("p", {}, documents.map((doc) => doc.common.title).join(",")), error); }
  const mounted = await mount(Harness);
  try {
    await click(button(mounted.container, "Refresh")); assert.equal(mounted.container.querySelector("p").textContent, "New");
    await act(async () => resolveOld(Response.json({ markdown: "---\ntitle: Old\n---\n", revision: "old" }))); assert.equal(mounted.container.querySelector("p").textContent, "New");
    failed = true; await click(button(mounted.container, "Refresh")); assert.match(mounted.container.textContent, /offline/); assert.equal(mounted.container.querySelector("p").textContent, "New");
  } finally { await mounted.close(); globalThis.fetch = original; }
});

test("transient notice expires independently of persistent CMS state", async () => {
  function Harness() { const { notice, notify, dismiss } = useNotice(); return createElement("div", {}, createElement("button", { onClick: () => notify("Saved") }, "Save"), createElement(Notice, { value: notice, onDismiss: dismiss })); }
  const mounted = await mount(Harness);
  try { await click(button(mounted.container, "Save")); assert.match(mounted.container.textContent, /Saved/); await act(async () => new Promise((resolve) => setTimeout(resolve, 5100))); assert.equal(mounted.container.querySelector(".cms-notice"), null); }
  finally { await mounted.close(); }
});
