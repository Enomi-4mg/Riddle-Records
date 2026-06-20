import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

const journalDir = path.resolve(__dirname, "../src/content/journal");

function isAllowedJournalFilename(value: string) {
  return Boolean(
    value &&
    !path.isAbsolute(value) &&
    path.basename(value) === value &&
    path.extname(value) === ".md" &&
    !value.includes("..")
  );
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

function journalApiPlugin() {
  return {
    name: "riddle-journal-api",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/journal-")) {
          next();
          return;
        }

        const url = new URL(request.url, "http://localhost");

        try {
          if (request.method === "GET" && url.pathname === "/api/journal-files") {
            const entries = await fs.readdir(journalDir, { withFileTypes: true });
            const filenames = entries
              .filter((entry) => entry.isFile() && isAllowedJournalFilename(entry.name))
              .map((entry) => entry.name)
              .sort((a, b) => b.localeCompare(a));
            const files = await Promise.all(filenames.map(async (filename) => {
              const stat = await fs.stat(path.join(journalDir, filename));
              return { path: filename, mtimeMs: stat.mtimeMs };
            }));
            sendJson(response, 200, { files });
            return;
          }

          if (request.method === "GET" && url.pathname === "/api/journal-file") {
            const filename = url.searchParams.get("path") ?? "";
            if (!isAllowedJournalFilename(filename)) {
              sendJson(response, 400, { error: "Invalid journal filename" });
              return;
            }
            const filePath = path.join(journalDir, filename);
            const [markdown, stat] = await Promise.all([
              fs.readFile(filePath, "utf8"),
              fs.stat(filePath)
            ]);
            sendJson(response, 200, { path: filename, markdown, mtimeMs: stat.mtimeMs });
            return;
          }

          if (request.method === "POST" && url.pathname === "/api/journal-file") {
            const payload = JSON.parse(await readRequestBody(request)) as unknown;
            if (!payload || typeof payload !== "object" || !("path" in payload) || !("markdown" in payload)) {
              sendJson(response, 400, { error: "Invalid payload" });
              return;
            }
            const filename = typeof payload.path === "string" ? payload.path : "";
            const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
            const expectedMtime = "expectedMtime" in payload && typeof payload.expectedMtime === "number" ? payload.expectedMtime : undefined;
            const force = "force" in payload && payload.force === true;
            if (!isAllowedJournalFilename(filename)) {
              sendJson(response, 400, { error: "Invalid journal filename" });
              return;
            }
            const filePath = path.join(journalDir, filename);
            const currentStat = await fs.stat(filePath).catch(() => null);
            if (!force && expectedMtime !== undefined && currentStat && currentStat.mtimeMs !== expectedMtime) {
              sendJson(response, 409, {
                error: "File has changed on disk",
                path: filename,
                expectedMtime,
                currentMtime: currentStat.mtimeMs
              });
              return;
            }
            await fs.writeFile(filePath, markdown, "utf8");
            const nextStat = await fs.stat(filePath);
            sendJson(response, 200, { path: filename, saved: true, mtimeMs: nextStat.mtimeMs });
            return;
          }

          if (request.method === "DELETE" && url.pathname === "/api/journal-file") {
            const filename = url.searchParams.get("path") ?? "";
            if (!isAllowedJournalFilename(filename)) {
              sendJson(response, 400, { error: "Invalid journal filename" });
              return;
            }
            await fs.unlink(path.join(journalDir, filename));
            sendJson(response, 200, { path: filename, deleted: true });
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
  plugins: [react(), journalApiPlugin()],
  server: {
    port: 5174
  }
});
