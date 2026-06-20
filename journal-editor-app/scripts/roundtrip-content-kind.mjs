import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const kind = process.argv[2];
const supportedKinds = new Set(["gallery", "projects"]);

if (!supportedKinds.has(kind)) {
  console.error(`Usage: node scripts/roundtrip-content-kind.mjs <${[...supportedKinds].join("|")}>`);
  process.exit(1);
}

async function bundleImport(entry) {
  const outfile = path.join(os.tmpdir(), `riddle-editor-roundtrip-${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent"
  });
  const module = await import(`file://${outfile}`);
  await fsp.unlink(outfile).catch(() => undefined);
  return module;
}

const markdown = await bundleImport(new URL("../src/lib/markdown.ts", import.meta.url).pathname);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../..");
const contentDir = path.join(root, `src/content/${kind}`);

function frontmatterKeys(source) {
  const clean = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = clean.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return [];
  return match[1].split("\n").map((line) => line.match(/^([a-zA-Z0-9_]+):/)?.[1]).filter(Boolean);
}

function bodyOf(source) {
  return source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n?/, "").trimEnd();
}

const files = fs.readdirSync(contentDir).filter((file) => file.endsWith(".md")).sort();

const results = files.map((file) => {
  const original = fs.readFileSync(path.join(contentDir, file), "utf8");
  const draft = markdown.parseImportedMarkdown(original, { kind });
  const exported = markdown.buildMarkdown(draft);
  const originalKeys = frontmatterKeys(original);
  const exportedKeys = frontmatterKeys(exported);
  const addedKeys = exportedKeys.filter((key) => !originalKeys.includes(key));
  const removedKeys = originalKeys.filter((key) => !exportedKeys.includes(key));
  return {
    file,
    bodyEqual: bodyOf(original) === bodyOf(exported),
    addedKeys,
    removedKeys,
    keyOrderChanged: originalKeys.join(",") !== exportedKeys.join(","),
    originalBytes: Buffer.byteLength(original),
    exportedBytes: Buffer.byteLength(exported)
  };
});

const bodyMismatches = results.filter((item) => !item.bodyEqual).map((item) => item.file);
if (bodyMismatches.length) {
  console.error(JSON.stringify({ kind, bodyMismatches, results }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    kind,
    checked: results.length,
    bodyMismatches,
    normalizedDifferences: "frontmatter key order, quote style, array style, omitted empty/false fields, and legacy fallback fields may be normalized",
    results
  }, null, 2));
}
