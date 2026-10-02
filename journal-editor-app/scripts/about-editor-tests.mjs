import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import { Window } from "happy-dom";
const window = new Window({ url: "http://localhost:5174" });
for (const key of ["window", "document", "HTMLElement", "Node", "Event", "MouseEvent", "KeyboardEvent", "navigator", "localStorage"]) Object.defineProperty(globalThis, key, { configurable: true, value: key === "window" ? window : window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { App } = await import("../src/App.tsx");
const { parseContentMarkdown, buildContentMarkdown } = await import("../src/lib/cmsMarkdown.ts");
const source = await fs.readFile(new URL("../../src/content/about/profile.md", import.meta.url), "utf8");
function input(container, label) { return [...container.querySelectorAll("label")].find((item) => item.firstChild.textContent === label).querySelector("input,textarea"); }
function button(container, text) { return [...container.querySelectorAll("button")].find((item) => item.textContent === text); }
async function change(node, value) { await act(async () => { const prototype = node.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value); node.dispatchEvent(new window.Event("input", { bubbles: true })); }); }
async function click(node) { assert.ok(node, "Missing button"); await act(async () => node.click()); }

test("real App keeps About separate, edits every field and deploys/reloads through existing APIs", async () => {
  localStorage.clear();
  const originals = globalThis.fetch;
  const sources = new Map([
    ["about/profile.md", (() => { const fixture = parseContentMarkdown(source, "about"); fixture.placement.data.featuredWorks = []; return buildContentMarkdown(fixture); })()],
    ["gallery/cry.md", "---\ntitle: Cry\ndate: 2026-01-01\nslug: cry\nimage: cry.png\n---\n"],
    ["songs/summer.md", "---\ntitle: Summer\ndate: 2026-01-01\nyoutube_id: abcdefghijk\n---\n"]
  ]); let revision = "old"; const requests = [];
  globalThis.fetch = async (address, options = {}) => {
    const url = new URL(address, "http://localhost:5174"); requests.push([url.pathname, options]);
    if (url.pathname === "/api/content-list") return Response.json({ files: [...sources.keys()].map((key) => ({ kind: key.split("/")[0], path: key.split("/")[1], revision })) });
    if (url.pathname === "/api/media-registry") return Response.json({ registry: { version: 1, assets: [{ id: "icon", publicId: "avatars/icon.png", type: "image", displayName: "Avatar", alt: "Avatar", tags: [] }] }, revision: "media-rev" });
    if (url.pathname === "/api/content-item") {
      if (options.method === "POST") { const payload = JSON.parse(options.body); assert.equal(payload.kind, "about"); assert.equal(payload.path, "profile.md"); assert.equal(payload.expectedRevision, "old"); sources.set("about/profile.md", payload.markdown); revision = "new"; return Response.json({ kind: "about", path: "profile.md", revision, commitSha: "commit" }); }
      const kind = url.searchParams.get("kind"), path = url.searchParams.get("path"); return Response.json({ kind, path, markdown: sources.get(`${kind}/${path}`), revision });
    }
    if (url.pathname === "/api/site-deploy") { assert.equal(JSON.parse(options.body).commitSha, "commit"); return Response.json({ local: true, sha: "local", status: "completed" }); }
    throw new Error(`Unexpected request: ${url}`);
  };
  const container = document.createElement("div"); document.body.append(container); let root = createRoot(container);
  try {
    await act(async () => root.render(createElement(App)));
    assert.equal(container.querySelectorAll(".content-row").length, 2); assert.ok(!container.querySelector(".content-table").textContent.includes("4mg"));
    await click(button(container, "About")); assert.ok(container.querySelector(".about-editor")); assert.equal(container.querySelector(".content-table"), null);
    await change(input(container, "名前"), "New Name"); await change(input(container, "自己紹介"), "First line\nSecond line"); await change(input(container, "誕生日（月日）"), "02-29"); await change(input(container, "座右の銘"), "New motto");
    await click(button(container, "画像を選択")); await click(container.querySelector(".media-preview")); assert.equal(input(container, "アイコン").value, "avatars/icon.png");
    for (const label of ["趣味", "特技", "好きなもの"]) {
      const node = container.querySelector(`[aria-label="${label}を追加"]`); await change(node, "New tag,  "); await act(async () => node.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
      await click(container.querySelector(`[aria-label="${label}: New tagを上へ"]`));
    }
    await click(button(container, "SNSを追加")); const sns = container.querySelectorAll(".about-sns-row"); const row = sns[sns.length - 1];
    await change(input(row, "サービス名"), "Website"); await change(input(row, "URL"), "https://example.com/"); await change(input(row, "表示ラベル（任意）"), "Homepage");
    await click(container.querySelector('[aria-label="Cryを追加"]')); await click(container.querySelector('[aria-label="Summerを追加"]')); await click(container.querySelector('[aria-label="Summerを上へ"]'));
    assert.deepEqual([...container.querySelectorAll(".about-featured-list li .about-work-preview > span")].map((item) => item.firstChild.textContent), ["Summer", "Cry"]);
    assert.equal(container.querySelector('[aria-label="Cryを追加"]').disabled, true);
    await click(button(container, "入力を確認")); assert.match(container.querySelector(".global-notice").textContent, /ブラウザに自動保存/);
    // Reopening the app recovers all pending fields before deployment.
    await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(createElement(App))); await click(button(container, "About"));
    assert.equal(input(container, "名前").value, "New Name"); assert.equal(container.querySelectorAll(".about-featured-list li").length, 2);
    await click([...container.querySelectorAll("button")].find((item) => item.textContent.startsWith("保留変更をサイトに反映")));
    await click(document.querySelector(".confirmation-dialog .primary"));
    assert.match(container.querySelector(".global-notice").textContent, /ローカルファイルに反映/);
    const saved = parseContentMarkdown(sources.get("about/profile.md"), "about").placement.data;
    assert.equal(saved.icon, "avatars/icon.png"); assert.equal(saved.name, "New Name"); assert.equal(saved.bio, "First line\nSecond line"); assert.equal(saved.birthday, "02-29"); assert.equal(saved.motto, "New motto");
    assert.ok(saved.hobbies.includes("New tag")); assert.ok(saved.skills.includes("New tag")); assert.ok(saved.likes.includes("New tag")); assert.ok(saved.hobbies.every((tag) => tag.trim()));
    assert.deepEqual(saved.sns.at(-1), { service: "Website", url: "https://example.com/", label: "Homepage" }); assert.deepEqual(saved.featuredWorks, ["songs:summer", "gallery:cry"]);
    await act(async () => root.unmount()); root = createRoot(container); await act(async () => root.render(createElement(App))); await click(button(container, "About")); assert.equal(input(container, "名前").value, "New Name");
    await click(container.querySelector('[aria-label="Summerを削除"]')); await click(container.querySelector('[aria-label="Cryを削除"]')); assert.match(container.querySelector(".about-empty").textContent, /未選択/);
    await change(input(container, "誕生日（月日）"), "02-30"); assert.equal(button(container, "入力を確認").disabled, true); assert.match(container.querySelector('[role="alert"]').textContent, /誕生日/);
    assert.equal(requests.filter(([url, options]) => url === "/api/content-item" && options.method === "POST").length, 1);
  } finally { await act(async () => root.unmount()); container.remove(); globalThis.fetch = originals; localStorage.clear(); }
});
