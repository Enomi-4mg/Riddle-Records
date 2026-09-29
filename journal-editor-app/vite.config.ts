import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const contentDirs = {
  journal: path.resolve(repositoryRoot, "src/content/journal"),
  songs: path.resolve(repositoryRoot, "src/content/songs"),
  gallery: path.resolve(repositoryRoot, "src/content/gallery"),
  projects: path.resolve(repositoryRoot, "src/content/projects")
} as const;
const mediaRegistryPath = path.resolve(repositoryRoot, "src/data/media-registry.json");

type ContentKind = keyof typeof contentDirs;

function isContentKind(value: string | null): value is ContentKind {
  return Boolean(value && Object.prototype.hasOwnProperty.call(contentDirs, value));
}

export function isAllowedContentFilename(value: string) {
  return Boolean(
    value &&
    !path.isAbsolute(value) &&
    path.basename(value) === value &&
    path.extname(value) === ".md" &&
    !value.includes("..")
  );
}

function getContentDir(kind: string | null) {
  if (!isContentKind(kind)) return null;
  return contentDirs[kind];
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, statusCode: number, data: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(data));
}

export function isTrustedWriteOrigin(request: IncomingMessage) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers.host;
  if (!host) return false;
  return origin === new URL(`http://${host}`).origin;
}

async function listContentFiles(kind: ContentKind) {
  const contentDir = contentDirs[kind];
  const entries = await fs.readdir(contentDir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const filenames = entries
    .filter((entry) => entry.isFile() && isAllowedContentFilename(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));
  return await Promise.all(filenames.map(async (filename) => {
    const stat = await fs.stat(path.join(contentDir, filename));
    return { kind, path: filename, revision: `mtime:${stat.mtimeMs}` };
  }));
}

export function contentApiPlugin() {
  return {
    name: "riddle-content-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/content-") && !request.url?.startsWith("/api/media-registry") && !request.url?.startsWith("/api/site-deploy") && !request.url?.startsWith("/api/pending-batch")) {
          next();
          return;
        }

        const url = new URL(request.url, "http://localhost");

        try {
          if (url.pathname === "/api/site-deploy" && request.method === "POST") {
            if (!isTrustedWriteOrigin(request)) { sendJson(response, 403, { error: "Forbidden origin" }); return; }
            const payload = JSON.parse(await readRequestBody(request)) as { deploymentId?: string };
            if (!payload.deploymentId || !/^[a-f0-9-]{36}$/i.test(payload.deploymentId)) { sendJson(response, 400, { error: "Invalid deployment ID" }); return; }
            sendJson(response, 200, { deploymentId: payload.deploymentId, sha: "local", status: "completed", conclusion: "success", local: true });
            return;
          }
          if (url.pathname === "/api/site-deploy" && request.method === "GET") {
            sendJson(response, 200, { deploymentId: url.searchParams.get("deploymentId"), sha: "local", status: "completed", conclusion: "success", local: true });
            return;
          }
          if ((request.method === "POST" || request.method === "DELETE") && !isTrustedWriteOrigin(request)) {
            sendJson(response, 403, { error: "Forbidden origin" });
            return;
          }

          if (request.method === "POST" && url.pathname === "/api/pending-batch") {
            const payload = JSON.parse(await readRequestBody(request)) as { contents?: Array<{ id: string; kind: string; path: string; operation: "save" | "delete"; markdown?: string; expectedRevision?: string; force?: boolean }>; media?: { registry: unknown; expectedRevision?: string; force?: boolean } };
            if (!Array.isArray(payload.contents) || !payload.contents.length && !payload.media) { sendJson(response, 400, { error: "Invalid batch" }); return; }
            const checked: Array<{ id: string; path: string; filePath: string; operation: "save" | "delete"; markdown?: string }> = [];
            for (const entry of payload.contents) {
              if (!entry || typeof entry.id !== "string" || !isContentKind(entry.kind) || !isAllowedContentFilename(entry.path) || !["save", "delete"].includes(entry.operation) || entry.operation === "save" && typeof entry.markdown !== "string") { sendJson(response, 400, { error: "Invalid batch content" }); return; }
              const filePath = path.join(contentDirs[entry.kind], entry.path);
              const stat = await fs.stat(filePath).catch(() => null);
              const currentRevision = stat ? `mtime:${stat.mtimeMs}` : undefined;
              if (!entry.force && currentRevision !== entry.expectedRevision) { sendJson(response, 409, { target: "content", documentId: entry.id, operation: entry.operation, expectedRevision: entry.expectedRevision, currentRevision }); return; }
              checked.push({ id: entry.id, path: entry.path, filePath, operation: entry.operation, markdown: entry.markdown });
            }
            if (payload.media) {
              const stat = await fs.stat(mediaRegistryPath).catch(() => null);
              const currentRevision = stat ? `mtime:${stat.mtimeMs}` : undefined;
              if (!payload.media.force && currentRevision !== payload.media.expectedRevision) { sendJson(response, 409, { target: "media", operation: "save", expectedRevision: payload.media.expectedRevision, currentRevision }); return; }
            }
            const results = [];
            for (const entry of checked) {
              if (entry.operation === "delete") { await fs.unlink(entry.filePath); results.push({ id: entry.id, path: entry.path }); }
              else { await fs.writeFile(entry.filePath, entry.markdown!, "utf8"); const stat = await fs.stat(entry.filePath); results.push({ id: entry.id, path: entry.path, revision: `mtime:${stat.mtimeMs}` }); }
            }
            let mediaRevision: string | undefined;
            if (payload.media) { await fs.writeFile(mediaRegistryPath, `${JSON.stringify(payload.media.registry, null, 2)}\n`, "utf8"); mediaRevision = `mtime:${(await fs.stat(mediaRegistryPath)).mtimeMs}`; }
            sendJson(response, 200, { commitSha: "local", contents: results, mediaRevision });
            return;
          }

          if (request.method === "GET" && url.pathname === "/api/content-list") {
            const kind = url.searchParams.get("kind");
            if (kind && !isContentKind(kind)) {
              sendJson(response, 400, { error: "Invalid content kind" });
              return;
            }
            const kinds = kind ? [kind] : Object.keys(contentDirs) as ContentKind[];
            sendJson(response, 200, { files: (await Promise.all(kinds.map(listContentFiles))).flat() });
            return;
          }

          if (request.method === "GET" && url.pathname === "/api/media-registry") {
            const [source, stat] = await Promise.all([fs.readFile(mediaRegistryPath, "utf8"), fs.stat(mediaRegistryPath)]);
            sendJson(response, 200, { registry: JSON.parse(source), revision: `mtime:${stat.mtimeMs}` });
            return;
          }

          if (request.method === "PUT" && url.pathname === "/api/media-registry") {
            if (!isTrustedWriteOrigin(request)) { sendJson(response, 403, { error: "Forbidden origin" }); return; }
            const payload = JSON.parse(await readRequestBody(request)) as { registry?: unknown; expectedRevision?: string; force?: boolean };
            if (!payload.registry || typeof payload.registry !== "object") { sendJson(response, 400, { error: "Invalid registry" }); return; }
            const stat = await fs.stat(mediaRegistryPath).catch(() => null);
            const currentRevision = stat ? `mtime:${stat.mtimeMs}` : undefined;
            if (payload.force !== true && payload.expectedRevision !== currentRevision) { sendJson(response, 409, { error: "Media Registry has changed", currentRevision }); return; }
            await fs.writeFile(mediaRegistryPath, `${JSON.stringify(payload.registry, null, 2)}\n`, "utf8");
            const next = await fs.stat(mediaRegistryPath);
            sendJson(response, 200, { registry: payload.registry, revision: `mtime:${next.mtimeMs}` });
            return;
          }

          if (request.method === "GET" && url.pathname === "/api/content-item") {
            const kind = url.searchParams.get("kind");
            const contentDir = getContentDir(kind);
            const filename = url.searchParams.get("path") ?? "";
            if (!contentDir || !isContentKind(kind)) {
              sendJson(response, 400, { error: "Invalid content kind" });
              return;
            }
            if (!isAllowedContentFilename(filename)) {
              sendJson(response, 400, { error: "Invalid content filename" });
              return;
            }
            const filePath = path.join(contentDir, filename);
            const exists = await fs.stat(filePath).catch(() => null);
            if (!exists) { sendJson(response, 404, { error: "Content file not found" }); return; }
            const [markdown, stat] = await Promise.all([
              fs.readFile(filePath, "utf8"),
              fs.stat(filePath)
            ]);
            sendJson(response, 200, { kind, path: filename, markdown, revision: `mtime:${stat.mtimeMs}` });
            return;
          }

          if (request.method === "POST" && url.pathname === "/api/content-item") {
            const payload = JSON.parse(await readRequestBody(request)) as unknown;
            if (!payload || typeof payload !== "object" || !("kind" in payload) || !("path" in payload) || !("markdown" in payload)) {
              sendJson(response, 400, { error: "Invalid payload" });
              return;
            }
            const kind = typeof payload.kind === "string" ? payload.kind : "";
            const contentDir = getContentDir(kind);
            const filename = typeof payload.path === "string" ? payload.path : "";
            const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
            const expectedRevision = "expectedRevision" in payload && typeof payload.expectedRevision === "string" ? payload.expectedRevision : undefined;
            const force = "force" in payload && payload.force === true;
            if (!contentDir || !isContentKind(kind)) {
              sendJson(response, 400, { error: "Invalid content kind" });
              return;
            }
            if (!isAllowedContentFilename(filename)) {
              sendJson(response, 400, { error: "Invalid content filename" });
              return;
            }
            await fs.mkdir(contentDir, { recursive: true });
            const filePath = path.join(contentDir, filename);
            const currentStat = await fs.stat(filePath).catch(() => null);
            const currentRevision = currentStat ? `mtime:${currentStat.mtimeMs}` : undefined;
            if (!force && ((currentRevision && expectedRevision !== currentRevision) || (!currentRevision && expectedRevision))) {
              sendJson(response, 409, {
                error: "File has changed on disk",
                kind,
                path: filename,
                expectedRevision,
                currentRevision
              });
              return;
            }
            await fs.writeFile(filePath, markdown, "utf8");
            const nextStat = await fs.stat(filePath);
            sendJson(response, 200, { kind, path: filename, saved: true, revision: `mtime:${nextStat.mtimeMs}` });
            return;
          }

          if (request.method === "DELETE" && url.pathname === "/api/content-item") {
            const payload = JSON.parse(await readRequestBody(request)) as unknown;
            if (!payload || typeof payload !== "object" || !("kind" in payload) || !("path" in payload)) {
              sendJson(response, 400, { error: "Invalid payload" });
              return;
            }
            const kind = typeof payload.kind === "string" ? payload.kind : "";
            const contentDir = getContentDir(kind);
            const filename = typeof payload.path === "string" ? payload.path : "";
            const expectedRevision = "expectedRevision" in payload && typeof payload.expectedRevision === "string" ? payload.expectedRevision : undefined;
            const force = "force" in payload && payload.force === true;
            if (!contentDir || !isContentKind(kind)) {
              sendJson(response, 400, { error: "Invalid content kind" });
              return;
            }
            if (!isAllowedContentFilename(filename)) {
              sendJson(response, 400, { error: "Invalid content filename" });
              return;
            }
            const filePath = path.join(contentDir, filename);
            const currentStat = await fs.stat(filePath).catch(() => null);
            if (!currentStat) {
              sendJson(response, 404, { error: "Content file not found" });
              return;
            }
            const currentRevision = `mtime:${currentStat.mtimeMs}`;
            if (!force && expectedRevision !== currentRevision) {
              sendJson(response, 409, { error: "File has changed on disk", kind, path: filename, expectedRevision, currentRevision });
              return;
            }
            await fs.unlink(filePath);
            sendJson(response, 200, { kind, path: filename, deleted: true });
            return;
          }

          sendJson(response, 404, { error: "Not found" });
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : "Unknown error" });
        }
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), contentApiPlugin()],
  server: {
    port: 5174
  }
});
