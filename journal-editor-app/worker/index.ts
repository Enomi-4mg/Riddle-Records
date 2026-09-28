const contentDirectories = {
  journal: "src/content/journal",
  songs: "src/content/songs",
  gallery: "src/content/gallery",
  projects: "src/content/projects"
} as const;

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
  return typeof value === "string" && value in contentDirectories;
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

  if ((request.method === "POST" || request.method === "DELETE") && !validateWriteOrigin(request)) {
    return json(403, { error: "Forbidden origin" });
  }

  if (request.method === "GET" && url.pathname === "/api/content-list") {
    const kind = url.searchParams.get("kind");
    if (!isContentKind(kind)) return json(400, { error: "Invalid content kind" });
    const response = await githubRequest(
      fetcher,
      env,
      `${githubPath(kind)}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`
    );
    const entries = await response.json() as GitHubFile[];
    const files = entries
      .filter((entry) => entry.type === "file" && isAllowedContentFilename(entry.name))
      .map((entry) => ({ kind, path: entry.name, revision: entry.sha }))
      .sort((a, b) => b.path.localeCompare(a.path));
    return json(200, { files });
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
      const result = await response.json() as { content?: { sha?: string } };
      const revision = result.content?.sha;
      if (!revision) return json(502, { error: "GitHub did not return the saved revision" });
      return json(200, { kind, path, saved: true, revision });
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
      await githubRequest(fetcher, env, githubPath(kind, path), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Delete ${contentDirectories[kind]}/${path} via CMS`,
          sha: current.sha,
          branch: env.GITHUB_BRANCH
        })
      });
      return json(200, { kind, path, deleted: true });
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
