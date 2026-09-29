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
  return Boolean(value && value in contentDirs);
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
        if (!request.url?.startsWith("/api/content-") && !request.url?.startsWith("/api/media-registry") && !request.url?.startsWith("/api/site-deploy")) {
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
