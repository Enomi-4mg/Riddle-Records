import { buildContentMarkdown, createContentDocument, parseContentMarkdown } from "../src/lib/cmsMarkdown.ts";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { contentApiPlugin } from "../vite.config.ts";
import { createWorkerHandler } from "../worker/index.ts";
const registry = { version: 1, assets: [] };
const deploymentId = "123e4567-e89b-42d3-a456-426614174000";
const env = { ASSETS: { fetch: async () => new Response("asset") }, GITHUB_TOKEN: "test-token", GITHUB_OWNER: "owner", GITHUB_REPO: "repo", GITHUB_BRANCH: "main" };
function remote(options = {}) {
  const calls = []; let blobs = 0;
  const handler = createWorkerHandler(async (url, init = {}) => {
    const address = String(url); calls.push([address, init]);
    if (address.includes("git/ref/heads") && init.method !== "PATCH") return Response.json({ object: { sha: "b".repeat(40) } });
    if (address.includes("actions/workflows/")) return Response.json({ workflow_runs: options.runs ?? [] });
    if (address.includes("/compare/")) return Response.json({ status: options.compare ?? "ahead" });
    if (address.includes("git/commits/") && init.method !== "POST") return Response.json({ tree: { sha: "base-tree" } });
    if (address.includes("/contents/")) {
      if (init.method === "PUT") return options.race ? Response.json({ message: "conflict" }, { status: 409 }) : Response.json({ content: { sha: "saved-media" }, commit: { sha: "commit" } });
      const sourcePath = decodeURIComponent(new URL(address).pathname.split("/contents/")[1]);
      if (sourcePath === "src/content/about/profile.md" && options.profile) return Response.json({ type: "file", sha: "profile-rev", encoding: "base64", content: Buffer.from(options.profile).toString("base64") });
      if (options.works && ["src/content/gallery", "src/content/songs"].includes(sourcePath)) return Response.json(Object.keys(options.works).filter((file) => file.startsWith(`${sourcePath}/`)).map((file) => ({ type: "file", name: file.split("/").pop() })));
      if (options.works?.[sourcePath]) return Response.json({ type: "file", sha: "work-rev", encoding: "base64", content: Buffer.from(options.works[sourcePath]).toString("base64") });
      if (address.includes("media-registry")) return Response.json({ sha: "media-rev", encoding: "base64", content: Buffer.from(JSON.stringify(registry)).toString("base64") });
      if (options.content) return Response.json({ sha: "content-rev", type: "file", encoding: "base64", content: Buffer.from("Original").toString("base64") });
      return new Response(null, { status: 404 });
    }
    if (address.endsWith("git/blobs")) return Response.json({ sha: `blob-${++blobs}` });
    if (address.endsWith("git/trees")) return Response.json({ sha: "tree" });
    if (address.endsWith("git/commits")) return Response.json({ sha: "commit" });
    return Response.json({});
  });
  return { calls, request: async (url, method = "GET", payload) => {
    const response = await handler(new Request(`https://cms.example${url}`, { method, ...(payload && { body: JSON.stringify(payload) }) }), env);
    return { status: response.status, body: await response.json() };
  } };
}
async function local(callback) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "riddle-api-"));
  try {
    for (const kind of ["journal", "songs", "gallery", "projects", "about"]) await fs.mkdir(path.join(root, "src/content", kind), { recursive: true });
    await fs.mkdir(path.join(root, "src/data"), { recursive: true });
    await fs.writeFile(path.join(root, "src/data/media-registry.json"), JSON.stringify(registry));
    await fs.writeFile(path.join(root, "src/content/journal/one.md"), "Original");
    let middleware; contentApiPlugin(root).configureServer({ middlewares: { use: (value) => { middleware = value; } } });
    const request = (url, method = "GET", payload) => new Promise((resolve, reject) => {
      const req = new EventEmitter(); req.url = url; req.method = method; req.headers = {}; req.setEncoding = () => {};
      const res = { statusCode: 200, setHeader() {}, end(value) { resolve({ status: res.statusCode, body: JSON.parse(value) }); } };
      Promise.resolve(middleware(req, res, () => reject(new Error("unexpected next")))).catch(reject);
      queueMicrotask(() => { if (payload) req.emit("data", JSON.stringify(payload)); req.emit("end"); });
    });
    await callback({ request, root });
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
const content = (overrides = {}) => ({ id: "one", kind: "journal", path: "one.md", operation: "save", markdown: "Updated", ...overrides });

describe("Worker deployment commit containment", () => {
  for (const status of ["ahead", "identical", "diverged", "behind"]) test(`requested SHA comparison ${status}`, async () => {
    const api = remote({ compare: status }); const result = await api.request("/api/site-deploy", "POST", { deploymentId, commitSha: "a".repeat(40) });
    assert.equal(result.status, ["ahead", "identical"].includes(status) ? 200 : 409);
    assert.equal(api.calls.filter(([url]) => url.endsWith("/dispatches")).length, result.status === 200 ? 1 : 0);
    if (result.status === 200) {
      assert.equal(result.body.sha, "a".repeat(40));
      const dispatch = api.calls.find(([url]) => url.endsWith("/dispatches"));
      assert.equal(JSON.parse(dispatch[1].body).client_payload.commit_sha, "a".repeat(40));
    }
  });
  test("status follows the pinned checkout even after main advances, and rejects a mismatched commit", async () => {
    const sha = "a".repeat(40);
    const api = remote({ runs: [{ display_title: `Deploy site (${deploymentId}) [${sha}]`, head_sha: "b".repeat(40), status: "completed", conclusion: "success" }] });
    const result = await api.request(`/api/site-deploy?deploymentId=${deploymentId}&commitSha=${sha}`);
    assert.equal(result.status, 200); assert.equal(result.body.sha, sha);
    assert.equal((await api.request(`/api/site-deploy?deploymentId=${deploymentId}&commitSha=${"c".repeat(40)}`)).status, 409);
  });
  test("head SHA bypasses comparison; malformed SHA is rejected", async () => {
    const api = remote(); assert.equal((await api.request("/api/site-deploy", "POST", { deploymentId, commitSha: "b".repeat(40) })).status, 200);
    assert.equal(api.calls.some(([url]) => url.includes("/compare/")), false);
    assert.equal((await api.request("/api/site-deploy", "POST", { deploymentId, commitSha: "invalid" })).status, 400);
  });
});

describe("Worker and local API batch semantics", () => {
  for (const backend of ["worker", "local"]) {
    const run = (callback, opts = {}) => backend === "local" ? local(callback) : callback(remote(opts));
    test(`${backend} rejects duplicate paths, malformed filenames, force flags and media`, () => run(async ({ request }) => {
      for (const contents of [[content(), content({ id: "duplicate" })], [content({ path: "../bad.md" })], [content({ path: 4 })], [content({ path: "bad\\name.md" })], [content({ force: "true" })], [content({ expectedRevision: 4 })]]) assert.equal((await request("/api/pending-batch", "POST", { contents })).status, 400);
      assert.equal((await request("/api/pending-batch", "POST", { contents: [], media: { registry: {} } })).status, 400);
    }));
    test(`${backend} content conflict refuses all writes; force resolves it`, () => run(async ({ request, root, calls }) => {
      const result = await request("/api/pending-batch", "POST", { contents: [content({ expectedRevision: "stale" }), content({ id: "two", path: "two.md" })] });
      assert.equal(result.status, 409); assert.equal(result.body.target, "content"); assert.equal(result.body.documentId, "one");
      if (root) { assert.equal(await fs.readFile(path.join(root, "src/content/journal/one.md"), "utf8"), "Original"); await assert.rejects(fs.stat(path.join(root, "src/content/journal/two.md"))); }
      if (calls) assert.equal(calls.filter(([, init]) => init.method === "PATCH").length, 0);
      const forced = await request("/api/pending-batch", "POST", { contents: [content({ expectedRevision: "stale", force: true })] });
      assert.equal(forced.status, 200); assert.ok(forced.body.contents[0].revision);
    }, { content: true }));
    test(`${backend} media conflict blocks batch; media can be bundled and forced`, () => run(async ({ request, root, calls }) => {
      const conflict = await request("/api/pending-batch", "POST", { contents: [content({ path: "new.md" })], media: { registry, expectedRevision: "stale" } });
      assert.equal(conflict.status, 409); assert.equal(conflict.body.target, "media");
      if (root) await assert.rejects(fs.stat(path.join(root, "src/content/journal/new.md")));
      if (calls) assert.equal(calls.filter(([, init]) => init.method === "PATCH").length, 0);
      const result = await request("/api/pending-batch", "POST", { contents: [content({ path: "new.md" })], media: { registry, expectedRevision: "stale", force: true } });
      assert.equal(result.status, 200); assert.ok(result.body.mediaRevision); assert.ok(result.body.contents[0].revision); assert.ok(result.body.commitSha);
    }));
    test(`${backend} missing delete is a conflict even when forced`, () => run(async ({ request }) => {
      const result = await request("/api/pending-batch", "POST", { contents: [content({ operation: "delete", path: "missing.md", force: true })] }); assert.equal(result.status, 409);
    }));
    test(`${backend} media registry GET/PUT revision, conflict, validation and force`, () => run(async ({ request }) => {
      const current = await request("/api/media-registry"); assert.equal(current.status, 200); assert.deepEqual(current.body.registry, registry);
      assert.equal((await request("/api/media-registry", "PUT", { registry, expectedRevision: "stale" })).status, 409);
      const saved = await request("/api/media-registry", "PUT", { registry, expectedRevision: current.body.revision }); assert.equal(saved.status, 200); assert.ok(saved.body.revision);
      assert.equal((await request("/api/media-registry", "PUT", { registry, force: true })).status, 200);
      assert.equal((await request("/api/media-registry", "PUT", { registry: {} })).status, 400);
      assert.equal((await request("/api/media-registry", "PUT", { registry, force: "true" })).status, 400);
    }));
  }
  test("Worker reports a concurrent media PUT conflict", async () => {
    const api = remote({ race: true }); const result = await api.request("/api/media-registry", "PUT", { registry, expectedRevision: "media-rev" }); assert.equal(result.status, 409); assert.equal(result.body.currentRevision, "media-rev");
  });
});

const profileSource = (refs = []) => {
  const doc = createContentDocument("about"); doc.placement.data.name = "Test profile"; doc.placement.data.featuredWorks = refs;
  return buildContentMarkdown(doc);
};
const visualSource = "---\ntitle: Visual\ndate: 2026-01-01\nslug: one\nimage: one.png\ndraft: false\n---\n\nBody\n";
describe("singleton About uses existing Worker/local content APIs", () => {
  for (const backend of ["worker", "local"]) {
    const run = (callback) => backend === "local" ? local(async (api) => {
      await fs.writeFile(path.join(api.root, "src/content/about/profile.md"), profileSource());
      await fs.writeFile(path.join(api.root, "src/content/gallery/one.md"), visualSource);
      await callback(api);
    }) : callback(remote({ profile: profileSource(), works: { "src/content/gallery/one.md": visualSource } }));
    test(`${backend} reads, saves and checks profile revision`, () => run(async ({ request, root, calls }) => {
      const current = await request("/api/content-item?kind=about&path=profile.md"); assert.equal(current.status, 200); assert.equal(parseContentMarkdown(current.body.markdown, "about").placement.data.name, "Test profile");
      assert.equal((await request("/api/content-item", "POST", { kind: "about", path: "profile.md", markdown: profileSource(), expectedRevision: "stale" })).status, 409);
      const markdown = profileSource(["gallery:one"]);
      const saved = await request("/api/content-item", "POST", { kind: "about", path: "profile.md", markdown, expectedRevision: current.body.revision }); assert.equal(saved.status, 200);
      if (root) { const read = await request("/api/content-item?kind=about&path=profile.md"); assert.deepEqual(parseContentMarkdown(read.body.markdown, "about").placement.data.featuredWorks, ["gallery:one"]); }
      if (calls) { const write = calls.find(([url, options]) => url.endsWith("/about/profile.md") && options.method === "PUT"); assert.equal(Buffer.from(JSON.parse(write[1].body).content, "base64").toString("utf8"), markdown); }
    }));
    test(`${backend} rejects extra profiles, deletion, invalid URLs and missing or duplicate works`, () => run(async ({ request, root, calls }) => {
      for (const method of ["POST", "DELETE"]) assert.equal((await request("/api/content-item", method, { kind: "about", path: method === "DELETE" ? "profile.md" : "other.md", markdown: profileSource(), force: true })).status, 400);
      assert.equal((await request("/api/content-item?kind=about&path=other.md")).status, 400);
      const invalid = [profileSource(["gallery:missing"]), profileSource(["gallery:one", "gallery:one"]), profileSource().replace("sns: []", "sns:\n  - service: Bad\n    url: javascript:alert(1)")];
      for (const markdown of invalid) assert.equal((await request("/api/pending-batch", "POST", { contents: [content({ kind: "about", path: "profile.md", markdown, force: true })] })).status, 400);
      if (root) assert.equal(await fs.readFile(path.join(root, "src/content/about/profile.md"), "utf8"), profileSource());
      if (calls) assert.equal(calls.filter(([, options]) => ["PUT", "PATCH"].includes(options.method)).length, 0);
    }));
    test(`${backend} batches About and new works, and prevents removing a featured work`, () => run(async ({ request, root, calls }) => {
      const result = await request("/api/pending-batch", "POST", { contents: [content({ id: "about", kind: "about", path: "profile.md", markdown: profileSource(["gallery:new"]), force: true }), content({ id: "new", kind: "gallery", path: "new.md", markdown: visualSource.replace("slug: one", "slug: new") })] });
      assert.equal(result.status, 200); assert.equal(result.body.contents.length, 2);
      if (root) {
        const file = await request("/api/content-item?kind=gallery&path=new.md");
        assert.equal((await request("/api/content-item", "DELETE", { kind: "gallery", path: "new.md", expectedRevision: file.body.revision, force: true })).status, 400);
        assert.equal((await request("/api/content-item", "POST", { kind: "gallery", path: "new.md", markdown: visualSource.replace("slug: one", "slug: new").replace("draft: false", "draft: true"), expectedRevision: file.body.revision })).status, 400);
        assert.equal((await request("/api/pending-batch", "POST", { contents: [content({ id: "about", kind: "about", path: "profile.md", markdown: profileSource(), force: true }), content({ id: "new", kind: "gallery", path: "new.md", operation: "delete", expectedRevision: file.body.revision })] })).status, 200);
      }
      if (calls) { const trees = calls.filter(([url]) => url.endsWith("git/trees")); assert.equal(trees.length, 1); assert.deepEqual(JSON.parse(trees[0][1].body).tree.map((item) => item.path), ["src/content/about/profile.md", "src/content/gallery/new.md"]); }
    }));
  }
});

test("Worker refuses deletion/unpublishing of selected works until the same batch removes the reference", async () => {
  const api = remote({ profile: profileSource(["gallery:one"]), works: { "src/content/gallery/one.md": visualSource } });
  assert.equal((await api.request("/api/content-item", "DELETE", { kind: "gallery", path: "one.md", force: true })).status, 400);
  assert.equal((await api.request("/api/content-item", "POST", { kind: "gallery", path: "one.md", markdown: visualSource.replace("draft: false", "draft: true"), force: true })).status, 400);
  assert.equal(api.calls.filter(([, options]) => ["PUT", "PATCH", "DELETE"].includes(options.method)).length, 0);
  const result = await api.request("/api/pending-batch", "POST", { contents: [content({ id: "about", kind: "about", path: "profile.md", markdown: profileSource(), force: true }), content({ id: "art", kind: "gallery", path: "one.md", operation: "delete", force: true })] });
  assert.equal(result.status, 200);
});
