import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const root = fileURLToPath(new URL("../..", import.meta.url));
const contentRoot = path.join(root, "src/content");
const output = path.join(root, "src/data/media-registry.json");
const cloudinary = /https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:[^\s"')]+\/)?v1\/([^\s"')<>]+)/g;
const knownExtensions = /\.(?:avif|gif|jpe?g|png|webp|mp4|webm|mov|mp3|wav|ogg|m4a)$/i;
const mediaType = (resource, id) => resource === "image" ? "image" : /\.(?:mp3|wav|ogg|m4a)$/i.test(id) ? "audio" : "video";
const slug = (value) => value.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID();

const files = [];
async function walk(directory) { for (const entry of await fs.readdir(directory, { withFileTypes: true })) { const target = path.join(directory, entry.name); if (entry.isDirectory()) await walk(target); else if (entry.name.endsWith(".md")) files.push(target); } }
await walk(contentRoot);
const found = new Map();
const usedIds = new Set();
function addAsset(publicId, type, displayName = "", alt = "") {
  if (!publicId || /^https?:\/\//.test(publicId) || publicId.startsWith("/") || publicId === "true" || publicId === "false") return;
  const key = `${type}:${publicId}`; if (found.has(key)) return;
  const name = displayName || path.basename(publicId).replace(knownExtensions, "").replace(/[_-]+/g, " ");
  const baseId = `${type}-${slug(publicId)}`; let id = baseId; let suffix = 2; while (usedIds.has(id)) id = `${baseId}-${suffix++}`; usedIds.add(id);
  found.set(key, { id, publicId, type, displayName: name, tags: [], alt: alt || name });
}
for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  for (const match of source.matchAll(cloudinary)) {
    const publicId = decodeURIComponent(match[2]).replace(/[?#].*$/, ""); const type = mediaType(match[1], publicId); const key = `${type}:${publicId}`;
    if (!found.has(key)) addAsset(publicId, type);
  }
  const frontmatterMatch = source.replace(/^\uFEFF/, "").match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const data = load(frontmatterMatch[1]) || {}; const title = typeof data.title === "string" ? data.title : ""; const alt = typeof data.thumbnail_alt === "string" ? data.thumbnail_alt : title;
    for (const key of ["image", "cloudinary_id", "thumbnail", "og_image", "hero", "heroImage"]) if (typeof data[key] === "string") addAsset(data[key], "image", title, alt);
  }
}
await fs.writeFile(output, `${JSON.stringify({ version: 1, assets: [...found.values()].sort((a, b) => a.displayName.localeCompare(b.displayName)) }, null, 2)}\n`);
console.log(`Wrote ${found.size} media assets to ${path.relative(root, output)}`);
