import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
const window = new Window({ url: "http://localhost:5174" });
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "navigator", "MutationObserver", "localStorage", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? window[key].bind(window) : window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { App } = await import("../src/App.tsx");
const { trackDeployment, restoredDeploymentState } = await import("../src/lib/deploymentTracking.ts");
const { parseContentMarkdown } = await import("../src/lib/cmsMarkdown.ts");
const { readPending, writePending } = await import("../src/lib/pendingChanges.ts");
const deployment = { id: "deployment", sha: "commit", startedAt: "2026-10-02T00:00:00.000Z" };
const markdown = "---\ntitle: Example\ndate: 2026-10-02\n---\n\nBody\n";
const pending = () => ({ version: 1, contents: [{ operation: "save", applied: true, document: parseContentMarkdown(markdown, "journal", { path: "example.md", revision: "new" }) }], deployment });
const status = (conclusion) => ({ deploymentId: deployment.id, sha: deployment.sha, status: conclusion ? "completed" : "queued", conclusion, url: "https://github.com/Enomi-4mg/Riddle-Records/actions/runs/1" });

test("tracking bounds polling, supports resuming and ignores aborted late completions", async () => {
  const states = [], completed = []; let polls = 0;
  await trackDeployment(deployment, { signal: new AbortController().signal, attempts: 2, sleep: async () => {}, getStatus: async () => { polls++; return status(); }, onState: (state) => states.push(state), onComplete: async (result) => completed.push(result) });
  assert.equal(polls, 2); assert.equal(states.at(-1).state, "paused"); assert.equal(completed.length, 0);
  await trackDeployment(deployment, { signal: new AbortController().signal, getStatus: async () => status("success"), onState: (state) => states.push(state), onComplete: async (result) => completed.push(result) });
  assert.equal(completed.length, 1);
  const controller = new AbortController(); let resolve;
  const tracking = trackDeployment(deployment, { signal: controller.signal, getStatus: () => new Promise((done) => { resolve = done; }), onState: (state) => states.push(state), onComplete: async (result) => completed.push(result) });
  controller.abort(); resolve(status("success")); await tracking; assert.equal(completed.length, 1);
});

async function mountWithApi(getStatus) {
  const original = globalThis.fetch, calls = [];
  globalThis.fetch = async (address, options = {}) => {
    const url = new URL(address, window.location.href); calls.push(url.pathname);
    if (url.pathname === "/api/content-list") return Response.json({ files: [{ kind: "journal", path: "example.md", revision: "server-new" }] });
    if (url.pathname === "/api/content-item") return Response.json({ markdown, revision: "server-new", path: "example.md" });
    if (url.pathname === "/api/media-registry") return Response.json({ registry: { version: 1, assets: [] }, revision: "media-new" });
    if (url.pathname === "/api/site-deploy") { assert.ok(!options.method, "Restored deployment must never trigger another deploy"); assert.equal(url.searchParams.get("startedAt"), deployment.startedAt); return getStatus(options); }
    throw new Error(`Unexpected ${address}`);
  };
  const container = document.createElement("div"); document.body.append(container); let root = createRoot(container);
  await act(async () => root.render(createElement(App)));
  return { container, calls, async remount() { await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(createElement(App))); }, async close() { await act(async () => root.unmount()); container.remove(); globalThis.fetch = original; localStorage.clear(); window.history.replaceState(null, "", "/"); } };
}
const button = (container, label) => [...container.querySelectorAll("button")].find((item) => item.textContent === label);
const click = async (node) => { assert.ok(node); await act(async () => node.click()); };

test("App resumes persisted deployment after reload, clears success and reloads content/media revisions", async () => {
  localStorage.clear(); writePending(pending()); let resolve, signal; let complete = false;
  const mounted = await mountWithApi((options) => complete ? Response.json(status("success")) : new Promise((done) => { resolve = done; signal = options.signal; }));
  try {
    assert.match(mounted.container.textContent, /デプロイ中/); assert.ok(readPending().deployment);
    const initialCalls = mounted.calls.length; complete = true; await mounted.remount();
    assert.equal(signal.aborted, true); await act(async () => resolve(Response.json(status("failure"))));
    assert.equal(readPending().deployment, undefined); assert.equal(readPending().contents.length, 0); assert.equal(readPending().lastDeployment.conclusion, "success");
    assert.ok(mounted.calls.length > initialCalls); assert.ok(mounted.calls.filter((path) => path === "/api/media-registry").length >= 3);
    await click(mounted.container.querySelector(".content-row")); await click(button(mounted.container, "記事設定")); await click(button(mounted.container, "開発者情報"));
    assert.match(mounted.container.querySelector(".developer-info").textContent, /server-new/);
  } finally { await mounted.close(); }
});

test("App keeps pending changes on network errors and rechecks manually or when focused", async () => {
  localStorage.clear(); writePending(pending()); let mode = "error";
  const mounted = await mountWithApi(async () => { if (mode === "error") throw new Error("offline"); return Response.json(status(mode === "success" ? "success" : undefined)); });
  try {
    assert.match(mounted.container.textContent, /offline/); assert.ok(readPending().deployment);
    mode = "queued"; await click(button(mounted.container, "状態を再確認")); assert.match(mounted.container.textContent, /デプロイ中/);
    mode = "success"; await act(async () => window.dispatchEvent(new window.Event("focus")));
    assert.equal(readPending().deployment, undefined); assert.equal(readPending().contents.length, 0);
  } finally { await mounted.close(); }
});

test("App persists failure, releases the edit lock and retains applied changes for retry", async () => {
  localStorage.clear(); writePending(pending());
  const mounted = await mountWithApi(async () => Response.json(status("failure")));
  try {
    assert.equal(readPending().deployment, undefined); assert.equal(readPending().contents[0].applied, true); assert.match(mounted.container.textContent, /失敗/);
    assert.equal(restoredDeploymentState(readPending()).state, "failed"); await mounted.remount(); assert.match(mounted.container.textContent, /失敗/);
    await click(mounted.container.querySelector(".content-row"));
    const input = mounted.container.querySelector(".title-input");
    await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "Edited after failure"); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
    assert.equal(readPending().contents[0].document.common.title, "Edited after failure"); assert.equal(readPending().contents[0].applied, undefined);
  } finally { await mounted.close(); }
});

test("App applies changes before starting a remote deployment and clears the resulting queue", async () => {
  localStorage.clear(); let started;
  const mounted = await mountWithApi(async () => Response.json(status("success")));
  const baseFetch = globalThis.fetch;
  globalThis.fetch = async (address, options = {}) => {
    const url = new URL(address, window.location.href);
    if (url.pathname === "/api/content-item" && options.method === "POST") {
      const payload = JSON.parse(options.body); assert.equal(payload.expectedRevision, "server-new"); assert.match(payload.markdown, /New title/);
      return Response.json({ kind: "journal", path: "example.md", revision: "saved-new", commitSha: "applied-commit" });
    }
    if (url.pathname === "/api/site-deploy" && options.method === "POST") {
      started = JSON.parse(options.body); assert.equal(started.commitSha, "applied-commit");
      return Response.json({ deploymentId: started.deploymentId, sha: "applied-commit", status: "queued" });
    }
    if (url.pathname === "/api/site-deploy") return Response.json({ ...status("success"), deploymentId: started.deploymentId, sha: "applied-commit" });
    return baseFetch(address, options);
  };
  try {
    await click(mounted.container.querySelector(".content-row"));
    const input = mounted.container.querySelector(".title-input");
    await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "New title"); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
    await click([...mounted.container.querySelectorAll("button")].find((item) => item.textContent.startsWith("記事をデプロイ")));
    assert.ok(started); assert.equal(readPending().contents.length, 0); assert.equal(readPending().lastDeployment.sha, "applied-commit");
  } finally { await mounted.close(); }
});

test("another tab's completed queue is revalidated without losing its deployment result", async () => {
  localStorage.clear(); writePending(pending());
  localStorage.setItem("riddle-cms-active-tab", JSON.stringify({ id: "other-tab", at: Date.now() }));
  const mounted = await mountWithApi(async () => Response.json(status()));
  try {
    const before = mounted.calls.filter((path) => path === "/api/media-registry").length;
    writePending({ version: 1, contents: [], lastDeployment: { ...deployment, conclusion: "success", finishedAt: new Date().toISOString() } });
    await act(async () => window.dispatchEvent(new window.StorageEvent("storage", { key: "riddle-cms-pending-v1" })));
    assert.equal(readPending().contents.length, 0); assert.match(mounted.container.textContent, /デプロイ完了/);
    assert.ok(mounted.calls.filter((path) => path === "/api/media-registry").length > before);
  } finally { await mounted.close(); }
});
