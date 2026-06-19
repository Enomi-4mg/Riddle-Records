import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../..");
const journalDir = path.join(root, "src/content/journal");
const articleTypes = ["journal", "making", "report"];

function splitList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function joinList(value) {
  return Array.isArray(value) ? value.map(String).join(", ") : typeof value === "string" ? value : "";
}

function slugify(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function yamlString(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlArray(items) {
  return `[${items.map(yamlString).join(", ")}]`;
}

function parseScalar(value) {
  const trimmed = value.trim().replace(/\s+#.*$/, "").trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

function parseImportedMarkdown(markdown) {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const imported = {};
  let body = normalized;
  if (match) {
    body = match[2] || "";
    const lines = match[1].split("\n");
    let arrayKey = "";
    for (const line of lines) {
      const arrayItem = line.match(/^\s*-\s+(.+)$/);
      if (arrayKey && arrayItem) {
        const current = Array.isArray(imported[arrayKey]) ? imported[arrayKey] : [];
        imported[arrayKey] = [...current, String(parseScalar(arrayItem[1]))];
        continue;
      }
      const keyValue = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (!keyValue) continue;
      const [, key, value] = keyValue;
      arrayKey = value ? "" : key;
      imported[key] = value ? parseScalar(value) : [];
    }
  }

  return {
    frontmatter: {
      title: typeof imported.title === "string" ? imported.title : "",
      date: typeof imported.date === "string" ? imported.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      type: articleTypes.includes(imported.type) ? imported.type : "journal",
      slug: typeof imported.slug === "string" ? imported.slug : "",
      description: typeof imported.description === "string" ? imported.description : "",
      tags: joinList(imported.tags),
      draft: typeof imported.draft === "boolean" ? imported.draft : false,
      thumbnail: typeof imported.thumbnail === "string" ? imported.thumbnail : "",
      thumbnail_alt: typeof imported.thumbnail_alt === "string" ? imported.thumbnail_alt : "",
      thumbnail_fit: typeof imported.thumbnail_fit === "string" ? imported.thumbnail_fit : "",
      thumbnail_position: typeof imported.thumbnail_position === "string" ? imported.thumbnail_position : "",
      og_image: typeof imported.og_image === "string" ? imported.og_image : "",
      featured_related: joinList(imported.featured_related),
      use_math: Boolean(imported.use_math),
      permalink: typeof imported.permalink === "string" ? imported.permalink : "",
      og_description: typeof imported.og_description === "string" ? imported.og_description : "",
      image: typeof imported.image === "string" ? imported.image : "",
      thumbnail_class: typeof imported.thumbnail_class === "string" ? imported.thumbnail_class : ""
    },
    body: body.trimStart() || "# 見出し\n\nここに本文を書きます。\n"
  };
}

function buildFrontmatter(frontmatter) {
  const tags = splitList(frontmatter.tags);
  const related = splitList(frontmatter.featured_related);
  const slug = slugify(frontmatter.slug);
  const lines = ["---"];
  lines.push(`title: ${yamlString(frontmatter.title.trim() || "Untitled")}`);
  if (frontmatter.date) lines.push(`date: ${frontmatter.date}`);
  lines.push(`type: ${yamlString(frontmatter.type)}`);
  if (slug) lines.push(`slug: ${yamlString(slug)}`);
  if (frontmatter.description.trim()) lines.push(`description: ${yamlString(frontmatter.description.trim())}`);
  if (tags.length) lines.push(`tags: ${yamlArray(tags)}`);
  if (frontmatter.draft) lines.push("draft: true");
  if (frontmatter.thumbnail.trim()) lines.push(`thumbnail: ${yamlString(frontmatter.thumbnail.trim())}`);
  if (frontmatter.thumbnail_alt.trim()) lines.push(`thumbnail_alt: ${yamlString(frontmatter.thumbnail_alt.trim())}`);
  if (frontmatter.thumbnail_fit.trim()) lines.push(`thumbnail_fit: ${yamlString(frontmatter.thumbnail_fit.trim())}`);
  if (frontmatter.thumbnail_position.trim()) lines.push(`thumbnail_position: ${yamlString(frontmatter.thumbnail_position.trim())}`);
  if (frontmatter.og_image.trim()) lines.push(`og_image: ${yamlString(frontmatter.og_image.trim())}`);
  if (related.length) lines.push(`featured_related: ${yamlArray(related)}`);
  if (frontmatter.use_math) lines.push("use_math: true");
  if (frontmatter.permalink.trim()) lines.push(`permalink: ${frontmatter.permalink.trim()}`);
  if (frontmatter.og_description.trim()) lines.push(`og_description: ${yamlString(frontmatter.og_description.trim())}`);
  if (frontmatter.image.trim()) lines.push(`image: ${yamlString(frontmatter.image.trim())}`);
  if (frontmatter.thumbnail_class.trim()) lines.push(`thumbnail_class: ${yamlString(frontmatter.thumbnail_class.trim())}`);
  lines.push("---");
  return lines.join("\n");
}

function buildMarkdown(draft) {
  return `${buildFrontmatter(draft.frontmatter)}\n\n${draft.body.trimEnd()}\n`;
}

function frontmatterKeys(markdown) {
  const clean = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = clean.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return [];
  return match[1].split("\n").map((line) => line.match(/^([a-zA-Z0-9_]+):/)?.[1]).filter(Boolean);
}

function bodyOf(markdown) {
  return markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n?/, "").trimEnd();
}

const files = fs.readdirSync(journalDir).filter((file) => file.endsWith(".md")).sort();
const writeIndex = process.argv.indexOf("--write-exported");
const writeDir = writeIndex >= 0 ? path.resolve(process.argv[writeIndex + 1] ?? "") : "";
if (writeDir) {
  fs.mkdirSync(writeDir, { recursive: true });
}

const results = files.map((file) => {
  const original = fs.readFileSync(path.join(journalDir, file), "utf8");
  const draft = parseImportedMarkdown(original);
  const exported = buildMarkdown(draft);
  if (writeDir) {
    fs.writeFileSync(path.join(writeDir, file), exported);
  }
  const originalKeys = frontmatterKeys(original);
  const exportedKeys = frontmatterKeys(exported);
  const addedKeys = exportedKeys.filter((key) => !originalKeys.includes(key));
  const removedKeys = originalKeys.filter((key) => !exportedKeys.includes(key));
  return {
    file,
    bomRemoved: original.charCodeAt(0) === 0xfeff,
    bodyEqual: bodyOf(original) === bodyOf(exported),
    addedKeys,
    removedKeys,
    draftAdded: addedKeys.includes("draft"),
    typeAdded: addedKeys.includes("type"),
    originalBytes: Buffer.byteLength(original),
    exportedBytes: Buffer.byteLength(exported)
  };
});

console.log(JSON.stringify({
  checked: results.length,
  bodyMismatches: results.filter((item) => !item.bodyEqual).map((item) => item.file),
  bomFiles: results.filter((item) => item.bomRemoved).map((item) => item.file),
  draftAddedFiles: results.filter((item) => item.draftAdded).map((item) => item.file),
  typeAddedFiles: results.filter((item) => item.typeAdded).map((item) => item.file),
  results
}, null, 2));
