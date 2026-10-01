import { managedContentDirectories, isAllowedSingletonOperation, aboutFilename } from "../shared/contentStorage";
import { managedContentErrors, type ManagedChange, type ManagedSource } from "./src/lib/managedValidation";
import { fetchLinkMetadata } from "../shared/linkMetadata";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { isMediaRegistry, validateMediaRegistry } from "./src/types/media";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const contentKinds = ["journal", "songs", "gallery", "projects", "about"] as const;
type ContentKind = typeof contentKinds[number];
function createContentDirs(root: string) {
  return Object.fromEntries(contentKinds.map((kind) => [kind, path.resolve(root, managedContentDirectories[kind])])) as Record<ContentKind, string>;
}
function isContentKind(value: unknown): value is ContentKind {
  return typeof value === "string" && (contentKinds as readonly string[]).includes(value);
}
export function isAllowedContentFilename(value: unknown): value is string {
  return typeof value === "string" && value.length > 3 && !path.isAbsolute(value) && path.basename(value) === value && path.extname(value) === ".md" && !value.includes("..") && !value.includes("\\");
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

async function listContentFiles(kind: ContentKind, directories: Record<ContentKind, string>) {
  const contentDir = directories[kind];
  const entries = await fs.readdir(contentDir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const filenames = entries
    .filter((entry) => entry.isFile() && isAllowedContentFilename(entry.name) && isAllowedSingletonOperation(kind, entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));
  return await Promise.all(filenames.map(async (filename) => {
    const stat = await fs.stat(path.join(contentDir, filename));
    return { kind, path: filename, revision: `mtime:${stat.mtimeMs}` };
  }));
}

export function contentApiPlugin(root = repositoryRoot) {
  const contentDirs = createContentDirs(root);
  const mediaRegistryPath = path.resolve(root, "src/data/media-registry.json");
  const getContentDir = (kind: string | null) => isContentKind(kind) ? contentDirs[kind] : null;
  const validateWrites = (changes: ManagedChange[]) => managedContentErrors(changes,
    () => fs.readFile(path.join(contentDirs.about, aboutFilename), "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return undefined; throw error; }),
    async () => {
      const sources: ManagedSource[] = [];
      for (const kind of ["gallery", "songs"] as const) {
        for (const file of await listContentFiles(kind, contentDirs)) sources.push({ kind, path: file.path, markdown: await fs.readFile(path.join(contentDirs[kind], file.path), "utf8") });
      }
      return sources;
    });
  return {
    name: "riddle-content-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/content-") && !request.url?.startsWith("/api/media-registry") && !request.url?.startsWith("/api/site-deploy") && !request.url?.startsWith("/api/pending-batch") && !request.url?.startsWith("/api/link-metadata")) {
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

          if (request.method === "POST" && url.pathname === "/api/link-metadata") {
            try {
              const payload = JSON.parse(await readRequestBody(request)) as { url?: unknown } | null;
              const metadata = await fetchLinkMetadata(payload?.url, fetch, async (target, addresses, signal) => new Promise<Response>((resolve, reject) => {
                // Pin the validated address to prevent DNS rebinding on local networks.
                const req = httpsRequest(target, { signal, headers: { Accept: "text/html" }, lookup: (_hostname, options, callback) => options.all ? callback(null, addresses.map((address) => ({ address, family: isIP(address) }))) : callback(null, addresses[0], isIP(addresses[0])) }, (res) => {
                  const headers = new Headers();
                  for (const [key, value] of Object.entries(res.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
                  const stream = new ReadableStream<Uint8Array>({ start(controller) { res.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk))); res.on("end", () => controller.close()); res.on("error", (error) => controller.error(error)); }, cancel() { res.destroy(); } });
                  resolve(new Response(stream, { status: res.statusCode || 502, headers }));
                });
                req.on("error", reject); req.end();
              }));
              sendJson(response, 200, metadata);
            } catch (error) { sendJson(response, 400, { error: error instanceof Error ? error.message : "リンク情報を取得できませんでした" }); }
            return;
          }

          if (request.method === "POST" && url.pathname === "/api/pending-batch") {
            const payload = JSON.parse(await readRequestBody(request)) as { contents?: Array<{ id: string; kind: string; path: string; operation: "save" | "delete"; markdown?: string; expectedRevision?: string; force?: boolean }>; media?: { registry: unknown; expectedRevision?: string; force?: boolean } };
            if (!Array.isArray(payload.contents) || !payload.contents.length && !payload.media) { sendJson(response, 400, { error: "Invalid batch" }); return; }
            const batchPaths = new Set<string>();
            const checked: Array<{ id: string; path: string; filePath: string; operation: "save" | "delete"; markdown?: string }> = [];
            for (const entry of payload.contents) {
              if (!entry || typeof entry.id !== "string" || !isContentKind(entry.kind) || !isAllowedContentFilename(entry.path) || !isAllowedSingletonOperation(entry.kind, entry.path, entry.operation === "delete" ? "delete" : "save") || !["save", "delete"].includes(entry.operation) || entry.operation === "save" && typeof entry.markdown !== "string" || entry.expectedRevision !== undefined && typeof entry.expectedRevision !== "string" || entry.force !== undefined && typeof entry.force !== "boolean") { sendJson(response, 400, { error: "Invalid batch content" }); return; }
              const filePath = path.join(contentDirs[entry.kind], entry.path);
              if (batchPaths.has(filePath)) { sendJson(response, 400, { error: "Duplicate batch path" }); return; }
              batchPaths.add(filePath);
            }
            if (payload.media && (!isMediaRegistry(payload.media.registry) || validateMediaRegistry(payload.media.registry) || payload.media.expectedRevision !== undefined && typeof payload.media.expectedRevision !== "string" || payload.media.force !== undefined && typeof payload.media.force !== "boolean")) { sendJson(response, 400, { error: "Invalid media" }); return; }
            const aboutErrors = await validateWrites(payload.contents as ManagedChange[]);
            if (aboutErrors.length) { sendJson(response, 400, { error: aboutErrors.join("\n") }); return; }
            for (const entry of payload.contents) {
              const filePath = path.join(contentDirs[entry.kind as ContentKind], entry.path);
              const stat = await fs.stat(filePath).catch(() => null);
              const currentRevision = stat ? `mtime:${stat.mtimeMs}` : undefined;
              if (entry.operation === "delete" && !stat) { sendJson(response, 409, { target: "content", documentId: entry.id, operation: "delete", expectedRevision: entry.expectedRevision }); return; }
              if (entry.force !== true && currentRevision !== entry.expectedRevision) { sendJson(response, 409, { target: "content", documentId: entry.id, operation: entry.operation, expectedRevision: entry.expectedRevision, currentRevision }); return; }
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
            const kinds = (kind ? [kind] : Object.keys(contentDirs)) as ContentKind[];
            sendJson(response, 200, { files: (await Promise.all(kinds.map((kind) => listContentFiles(kind, contentDirs)))).flat() });
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
            if (!isMediaRegistry(payload.registry) || validateMediaRegistry(payload.registry) || payload.expectedRevision !== undefined && typeof payload.expectedRevision !== "string" || payload.force !== undefined && typeof payload.force !== "boolean") { sendJson(response, 400, { error: "Invalid registry" }); return; }
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
            if (!isAllowedContentFilename(filename) || !isAllowedSingletonOperation(kind, filename, "read")) {
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
            if (!isAllowedContentFilename(filename) || !isAllowedSingletonOperation(kind, filename, "save")) {
              sendJson(response, 400, { error: "Invalid content filename" });
              return;
            }
            const aboutErrors = await validateWrites([{ kind, path: filename, operation: "save", markdown }]);
            if (aboutErrors.length) { sendJson(response, 400, { error: aboutErrors.join("\n") }); return; }
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
            if (!isAllowedContentFilename(filename) || !isAllowedSingletonOperation(kind, filename, "delete")) {
              sendJson(response, 400, { error: "Invalid content filename" });
              return;
            }
            const aboutErrors = await validateWrites([{ kind, path: filename, operation: "delete" }]);
            if (aboutErrors.length) { sendJson(response, 400, { error: aboutErrors.join("\n") }); return; }
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
