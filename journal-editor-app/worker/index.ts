import { validateMediaRegistry, type MediaRegistry } from "../src/types/media";

const contentDirectories = {
  journal: "src/content/journal",
  songs: "src/content/songs",
  gallery: "src/content/gallery",
  projects: "src/content/projects"
} as const;
const mediaRegistryPath = "src/data/media-registry.json";

type ContentKind = keyof typeof contentDirectories;

export type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
};

type GitHubFile = {
  type: "file";
  name: string;
  path: string;
  sha: string;
  encoding?: string;
  content?: string;
};

class GitHubApiError extends Error {
  constructor(public status: number, public rateLimited = false) {
    super(`GitHub API returned ${status}`);
  }
}

function json(status: number, data: unknown) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function isContentKind(value: unknown): value is ContentKind {
  return typeof value === "string" && Object.hasOwn(contentDirectories, value);
}

function isMediaRegistry(value: unknown): value is MediaRegistry {
  if (!value || typeof value !== "object") return false;
  const registry = value as Record<string, unknown>;
  return registry.version === 1 && Array.isArray(registry.assets) && registry.assets.every((asset) => asset && typeof asset === "object" && typeof asset.id === "string" && typeof asset.publicId === "string" && typeof asset.displayName === "string" && ["image", "video", "audio"].includes(asset.type) && Array.isArray(asset.tags) && asset.tags.every((tag: unknown) => typeof tag === "string") && typeof asset.alt === "string");
}

export function isAllowedContentFilename(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 3 &&
    value.endsWith(".md") &&
    !value.includes("..") &&
    !value.includes("/") &&
    !value.includes("\\");
}

function githubPath(kind: ContentKind, filename?: string) {
  const parts = filename
    ? [...contentDirectories[kind].split("/"), filename]
    : contentDirectories[kind].split("/");
  return parts.map(encodeURIComponent).join("/");
}

function githubUrl(env: Env, path: string) {
  const owner = encodeURIComponent(env.GITHUB_OWNER);
  const repo = encodeURIComponent(env.GITHUB_REPO);
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

function githubHeaders(env: Env) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "User-Agent": "Riddle-Records-Content-Editor",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function githubRequest(fetcher: typeof fetch, env: Env, path: string, init: RequestInit = {}) {
  const response = await fetcher(githubUrl(env, path), {
    ...init,
    headers: { ...githubHeaders(env), ...init.headers }
  });
  if (!response.ok) {
    throw new GitHubApiError(
      response.status,
      response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0"
    );
  }
  return response;
}

async function githubRepositoryRequest(fetcher: typeof fetch, env: Env, path: string, init: RequestInit = {}) {
  const response = await fetcher(`https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/${path}`, { ...init, headers: { ...githubHeaders(env), ...init.headers } });
  if (!response.ok) throw new GitHubApiError(response.status, response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
  return response;
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function getGitHubFile(fetcher: typeof fetch, env: Env, kind: ContentKind, filename: string) {
  try {
    const response = await githubRequest(
      fetcher,
      env,
      `${githubPath(kind, filename)}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`
    );
    return await response.json() as GitHubFile;
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) return null;
    throw error;
  }
}

function conflict(kind: ContentKind, path: string, expectedRevision: string | undefined, currentRevision: string | undefined) {
  return json(409, {
    error: "Content file has changed",
    kind,
    path,
    expectedRevision,
    currentRevision
  });
}

function validateWriteOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readPayload(request: Request) {
  try {
    const value = await request.json();
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function handleApi(request: Request, env: Env, fetcher: typeof fetch): Promise<Response> {
  const url = new URL(request.url);

  if ((request.method === "POST" || request.method === "PUT" || request.method === "DELETE") && !validateWriteOrigin(request)) {
    return json(403, { error: "Forbidden origin" });
  }

  if (url.pathname === "/api/pending-batch" && request.method === "POST") {
    const payload = await readPayload(request);
    const rawContents = payload?.contents;
    if (!Array.isArray(rawContents) || !rawContents.length && !payload?.media) return json(400, { error: "Invalid batch" });
    const contents: Array<{ id: string; kind: ContentKind; path: string; operation: "save" | "delete"; markdown?: string; expectedRevision?: string; force?: boolean }> = [];
    const paths = new Set<string>();
    for (const raw of rawContents) {
      if (!raw || typeof raw !== "object") return json(400, { error: "Invalid batch content" });
      const entry = raw as Record<string, unknown>;
      if (typeof entry.id !== "string" || !isContentKind(entry.kind) || !isAllowedContentFilename(entry.path) || (entry.operation !== "save" && entry.operation !== "delete") || (entry.operation === "save" && typeof entry.markdown !== "string") || (entry.expectedRevision !== undefined && typeof entry.expectedRevision !== "string") || (entry.force !== undefined && typeof entry.force !== "boolean")) return json(400, { error: "Invalid batch content" });
      const path = `${contentDirectories[entry.kind]}/${entry.path}`;
      if (paths.has(path)) return json(400, { error: "Duplicate batch path" });
      paths.add(path);
      contents.push({ id: entry.id, kind: entry.kind, path: entry.path, operation: entry.operation, markdown: entry.markdown as string | undefined, expectedRevision: entry.expectedRevision as string | undefined, force: entry.force as boolean | undefined });
    }
    const rawMedia = payload?.media;
    let media: { registry: MediaRegistry; expectedRevision?: string; force?: boolean } | undefined;
    if (rawMedia !== undefined) {
      if (!rawMedia || typeof rawMedia !== "object" || !("registry" in rawMedia)) return json(400, { error: "Invalid media" });
      const value = rawMedia as Record<string, unknown>;
      if (!isMediaRegistry(value.registry) || (value.expectedRevision !== undefined && typeof value.expectedRevision !== "string") || (value.force !== undefined && typeof value.force !== "boolean")) return json(400, { error: "Invalid media" });
      const registry = value.registry;
      const error = validateMediaRegistry(registry);
      if (error) return json(400, { error });
      media = { registry, expectedRevision: value.expectedRevision as string | undefined, force: value.force as boolean | undefined };
    }
    const ref = await githubRepositoryRequest(fetcher, env, `git/ref/heads/${encodeURIComponent(env.GITHUB_BRANCH)}`);
    const headSha = (await ref.json() as { object?: { sha?: string } }).object?.sha;
    if (!headSha) return json(502, { error: "GitHub did not return the branch head" });
    const commit = await githubRepositoryRequest(fetcher, env, `git/commits/${headSha}`);
    const baseTree = (await commit.json() as { tree?: { sha?: string } }).tree?.sha;
    if (!baseTree) return json(502, { error: "GitHub did not return the tree" });
    const tree: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
    const results: Array<{ id: string; path: string; revision?: string }> = [];
    for (const entry of contents) {
      const current = await getGitHubFile(fetcher, env, entry.kind, entry.path);
      if (!entry.force && current?.sha !== entry.expectedRevision) return json(409, { target: "content", documentId: entry.id, operation: entry.operation, expectedRevision: entry.expectedRevision, currentRevision: current?.sha });
      if (entry.operation === "delete" && !current) return json(409, { target: "content", documentId: entry.id, operation: "delete", expectedRevision: entry.expectedRevision });
      const path = `${contentDirectories[entry.kind]}/${entry.path}`;
      if (entry.operation === "delete") { tree.push({ path, mode: "100644", type: "blob", sha: null }); results.push({ id: entry.id, path: entry.path }); }
      else {
        const blob = await githubRepositoryRequest(fetcher, env, "git/blobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: entry.markdown, encoding: "utf-8" }) });
        const sha = (await blob.json() as { sha?: string }).sha;
        if (!sha) return json(502, { error: "GitHub did not return the blob" });
        tree.push({ path, mode: "100644", type: "blob", sha }); results.push({ id: entry.id, path: entry.path, revision: sha });
      }
    }
    let mediaRevision: string | undefined;
    if (media) {
      const current = await githubRequest(fetcher, env, `${mediaRegistryPath}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`);
      const file = await current.json() as GitHubFile;
      if (!media.force && file.sha !== media.expectedRevision) return json(409, { target: "media", operation: "save", expectedRevision: media.expectedRevision, currentRevision: file.sha });
      const blob = await githubRepositoryRequest(fetcher, env, "git/blobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: `${JSON.stringify(media.registry, null, 2)}\n`, encoding: "utf-8" }) });
      mediaRevision = (await blob.json() as { sha?: string }).sha;
      if (!mediaRevision) return json(502, { error: "GitHub did not return the blob" });
      tree.push({ path: mediaRegistryPath, mode: "100644", type: "blob", sha: mediaRevision });
    }
    const builtTree = await githubRepositoryRequest(fetcher, env, "git/trees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base_tree: baseTree, tree }) });
    const treeSha = (await builtTree.json() as { sha?: string }).sha;
    if (!treeSha) return json(502, { error: "GitHub did not return the new tree" });
    const newCommit = await githubRepositoryRequest(fetcher, env, "git/commits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Update CMS content and media", tree: treeSha, parents: [headSha] }) });
    const commitSha = (await newCommit.json() as { sha?: string }).sha;
    if (!commitSha) return json(502, { error: "GitHub did not return the commit" });
    try { await githubRepositoryRequest(fetcher, env, `git/refs/heads/${encodeURIComponent(env.GITHUB_BRANCH)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sha: commitSha, force: false }) }); }
    catch (error) { if (error instanceof GitHubApiError && (error.status === 409 || error.status === 422)) return json(503, { error: "main changed during commit; retry deployment" }); throw error; }
    return json(200, { commitSha, contents: results, mediaRevision });
  }

  if (url.pathname === "/api/site-deploy" && request.method === "POST") {
    const payload = await readPayload(request);
    const deploymentId = payload?.deploymentId;
    if (typeof deploymentId !== "string" || !/^[a-f0-9-]{36}$/i.test(deploymentId)) return json(400, { error: "Invalid deployment ID" });
    const ref = await githubRepositoryRequest(fetcher, env, `git/ref/heads/${encodeURIComponent(env.GITHUB_BRANCH)}`);
    const headSha = (await ref.json() as { object?: { sha?: string } }).object?.sha;
    if (!headSha) return json(502, { error: "GitHub did not return the branch head" });
    const requestedSha = payload?.commitSha;
    if (requestedSha !== undefined && (typeof requestedSha !== "string" || !/^[a-f0-9]{40}$/.test(requestedSha))) return json(400, { error: "Invalid commit SHA" });
    if (typeof requestedSha === "string" && requestedSha !== headSha) {
      const comparison = await githubRepositoryRequest(fetcher, env, `compare/${requestedSha}...${headSha}`);
      const status = (await comparison.json() as { status?: string }).status;
      if (status !== "ahead" && status !== "identical") return json(409, { error: "CMS changes are not included in main" });
    }
    await githubRepositoryRequest(fetcher, env, "dispatches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_type: "cms_site_deploy", client_payload: { deployment_id: deploymentId } }) });
    return json(200, { deploymentId, sha: headSha, status: "queued" });
  }

  if (url.pathname === "/api/site-deploy" && request.method === "GET") {
    const deploymentId = url.searchParams.get("deploymentId");
    if (!deploymentId || !/^[a-f0-9-]{36}$/i.test(deploymentId)) return json(400, { error: "Invalid deployment ID" });
    const response = await githubRepositoryRequest(fetcher, env, "actions/workflows/astro-pages.yml/runs?event=repository_dispatch&per_page=30");
    if (!response.ok) throw new GitHubApiError(response.status, response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
    const runs = (await response.json() as { workflow_runs?: Array<{ display_title: string; head_sha: string; status: "queued" | "in_progress" | "completed"; conclusion?: string | null; html_url?: string }> }).workflow_runs ?? [];
    const run = runs.find((item) => item.display_title.includes(deploymentId));
    const startedAt = url.searchParams.get("startedAt");
    const missingTooLong = startedAt && Number.isFinite(Date.parse(startedAt)) && Date.now() - Date.parse(startedAt) > 300_000;
    return json(200, run ? { deploymentId, sha: run.head_sha, status: run.status, conclusion: run.conclusion, url: run.html_url } : missingTooLong ? { deploymentId, sha: "", status: "completed", conclusion: "workflow run not found" } : { deploymentId, sha: "", status: "queued" });
  }

  if (request.method === "GET" && url.pathname === "/api/content-list") {
    const kind = url.searchParams.get("kind");
    if (kind && !isContentKind(kind)) return json(400, { error: "Invalid content kind" });
    const kinds: ContentKind[] = kind && isContentKind(kind) ? [kind] : Object.keys(contentDirectories) as ContentKind[];
    const files = (await Promise.all(kinds.map(async (entryKind) => {
      const response = await githubRequest(fetcher, env, `${githubPath(entryKind)}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`);
      const entries = await response.json() as GitHubFile[];
      return entries.filter((entry) => entry.type === "file" && isAllowedContentFilename(entry.name)).map((entry) => ({ kind: entryKind, path: entry.name, revision: entry.sha }));
    }))).flat().sort((a, b) => b.path.localeCompare(a.path));
    return json(200, { files });
  }

  if (request.method === "GET" && url.pathname === "/api/media-registry") {
    const response = await githubRequest(fetcher, env, `${mediaRegistryPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`);
    const file = await response.json() as GitHubFile;
    if (file.encoding !== "base64" || typeof file.content !== "string") return json(502, { error: "GitHub returned an unsupported registry response" });
    return json(200, { registry: JSON.parse(decodeBase64Utf8(file.content)), revision: file.sha });
  }

  if (request.method === "PUT" && url.pathname === "/api/media-registry") {
    const payload = await readPayload(request); if (!payload || !isMediaRegistry(payload.registry)) return json(400, { error: "Invalid registry" });
    const registryError = validateMediaRegistry(payload.registry);
    if (registryError) return json(400, { error: registryError });
    const response = await githubRequest(fetcher, env, `${mediaRegistryPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`);
    const current = await response.json() as GitHubFile;
    const expected = typeof payload.expectedRevision === "string" ? payload.expectedRevision : undefined;
    if (payload.force !== true && expected !== current.sha) return json(409, { error: "Media Registry has changed", currentRevision: current.sha });
    try {
      const update = await githubRequest(fetcher, env, mediaRegistryPath.split("/").map(encodeURIComponent).join("/"), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Update media registry via CMS", content: encodeBase64Utf8(`${JSON.stringify(payload.registry, null, 2)}\n`), branch: env.GITHUB_BRANCH, sha: current.sha }) });
      const result = await update.json() as { content?: { sha?: string }; commit?: { sha?: string } }; return json(200, { registry: payload.registry, revision: result.content?.sha, commitSha: result.commit?.sha });
    } catch (error) {
      if (error instanceof GitHubApiError && (error.status === 409 || error.status === 422)) {
        const latest = await githubRequest(fetcher, env, `${mediaRegistryPath}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`);
        return json(409, { error: "Media Registry has changed", expectedRevision: expected, currentRevision: (await latest.json() as GitHubFile).sha });
      }
      throw error;
    }
  }

  if (request.method === "GET" && url.pathname === "/api/content-item") {
    const kind = url.searchParams.get("kind");
    const path = url.searchParams.get("path");
    if (!isContentKind(kind)) return json(400, { error: "Invalid content kind" });
    if (!isAllowedContentFilename(path)) return json(400, { error: "Invalid content filename" });
    const file = await getGitHubFile(fetcher, env, kind, path);
    if (!file) return json(404, { error: "Content file not found" });
    if (file.type !== "file" || file.encoding !== "base64" || typeof file.content !== "string") {
      return json(502, { error: "GitHub returned an unsupported content response" });
    }
    return json(200, { kind, path, markdown: decodeBase64Utf8(file.content), revision: file.sha });
  }

  if (request.method === "POST" && url.pathname === "/api/content-item") {
    const payload = await readPayload(request);
    if (!payload) return json(400, { error: "Invalid payload" });
    const { kind, path, markdown, expectedRevision, force } = payload;
    if (!isContentKind(kind)) return json(400, { error: "Invalid content kind" });
    if (!isAllowedContentFilename(path)) return json(400, { error: "Invalid content filename" });
    if (typeof markdown !== "string") return json(400, { error: "Invalid payload" });
    if (expectedRevision !== undefined && typeof expectedRevision !== "string") return json(400, { error: "Invalid expected revision" });
    const expected = typeof expectedRevision === "string" ? expectedRevision : undefined;

    const current = await getGitHubFile(fetcher, env, kind, path);
    const currentRevision = current?.sha;
    if (force !== true && ((currentRevision && expected !== currentRevision) || (!currentRevision && expected))) {
      return conflict(kind, path, expected, currentRevision);
    }

    const body: Record<string, unknown> = {
      message: `${current ? "Update" : "Create"} ${contentDirectories[kind]}/${path} via CMS`,
      content: encodeBase64Utf8(markdown),
      branch: env.GITHUB_BRANCH
    };
    if (currentRevision) body.sha = currentRevision;

    try {
      const response = await githubRequest(fetcher, env, githubPath(kind, path), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json() as { content?: { sha?: string }; commit?: { sha?: string } };
      const revision = result.content?.sha;
      if (!revision) return json(502, { error: "GitHub did not return the saved revision" });
      return json(200, { kind, path, saved: true, revision, commitSha: result.commit?.sha });
    } catch (error) {
      if (error instanceof GitHubApiError && (error.status === 409 || error.status === 422)) {
        const latest = await getGitHubFile(fetcher, env, kind, path);
        return conflict(kind, path, expected, latest?.sha);
      }
      throw error;
    }
  }

  if (request.method === "DELETE" && url.pathname === "/api/content-item") {
    const payload = await readPayload(request);
    if (!payload) return json(400, { error: "Invalid payload" });
    const { kind, path, expectedRevision, force } = payload;
    if (!isContentKind(kind)) return json(400, { error: "Invalid content kind" });
    if (!isAllowedContentFilename(path)) return json(400, { error: "Invalid content filename" });
    if (expectedRevision !== undefined && typeof expectedRevision !== "string") return json(400, { error: "Invalid expected revision" });
    const expected = typeof expectedRevision === "string" ? expectedRevision : undefined;

    const current = await getGitHubFile(fetcher, env, kind, path);
    if (!current) return json(404, { error: "Content file not found" });
    if (force !== true && expected !== current.sha) {
      return conflict(kind, path, expected, current.sha);
    }
    try {
      const deleted = await githubRequest(fetcher, env, githubPath(kind, path), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Delete ${contentDirectories[kind]}/${path} via CMS`,
          sha: current.sha,
          branch: env.GITHUB_BRANCH
        })
      });
      const result = await deleted.json() as { commit?: { sha?: string } };
      return json(200, { kind, path, deleted: true, commitSha: result.commit?.sha });
    } catch (error) {
      if (error instanceof GitHubApiError && (error.status === 409 || error.status === 422)) {
        const latest = await getGitHubFile(fetcher, env, kind, path);
        return conflict(kind, path, expected, latest?.sha);
      }
      throw error;
    }
  }

  return json(404, { error: "Not found" });
}

function githubErrorResponse(error: unknown) {
  if (!(error instanceof GitHubApiError)) return json(500, { error: "Unexpected server error" });
  if (error.rateLimited) return json(503, { error: "GitHub API rate limit exceeded" });
  if (error.status === 401 || error.status === 403) return json(502, { error: "GitHub authentication failed" });
  if (error.status === 404) return json(404, { error: "GitHub resource not found" });
  if (error.status >= 500) return json(502, { error: "GitHub API is unavailable" });
  return json(502, { error: "GitHub API request failed" });
}

export function createWorkerHandler(fetcher: typeof fetch = fetch) {
  return async (request: Request, env: Env) => {
    if (!new URL(request.url).pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, env, fetcher);
    } catch (error) {
      return githubErrorResponse(error);
    }
  };
}

export default {
  fetch: createWorkerHandler()
};
