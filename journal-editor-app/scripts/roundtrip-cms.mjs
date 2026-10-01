import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { parseContentMarkdown, buildContentMarkdown } from "../src/lib/cmsMarkdown.ts";
import { normalizeContentTags } from "../../shared/contentTags.ts";

const metadata = (source) => load(source.match(/^---\n([\s\S]*?)\n---/)[1]);
const body = (source) => source.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
// Explicit migrations: aliases become canonical fields; tags normalize; related links/features move to body.
const aliases = { cloudinary_id: "image", categories: "tags", heroImage: "hero" };
const moved = { gallery: { article_url: "作品記事", making_article_url: "メイキング" }, projects: { features: "主な機能" } };
export async function checkRoundtrip(kind) {
  const directory = new URL(`../../src/content/${kind}/`, import.meta.url);
  const files = (await fs.readdir(directory)).filter((name) => name.endsWith(".md")).sort();
  const exportIndex = process.argv.indexOf("--write-exported");
  const exportDirectory = exportIndex >= 0 ? process.argv[exportIndex + 1] : null;
  if (exportIndex >= 0 && !exportDirectory) throw new Error("Missing export directory");
  if (exportDirectory) await fs.mkdir(exportDirectory, { recursive: true });
  for (const file of files) {
    const source = (await fs.readFile(new URL(file, directory), "utf8")).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    const saved = buildContentMarkdown(parseContentMarkdown(source, kind, { path: file }));
    const twice = buildContentMarkdown(parseContentMarkdown(saved, kind, { path: file }));
    if (exportDirectory) await fs.writeFile(path.join(exportDirectory, file), saved);
    assert.equal(saved, twice, `${kind}/${file}: save must be idempotent`);
    let expectedBody = body(source);
    const originalMeta = metadata(source);
    if (kind === "gallery" && (originalMeta.article_url || originalMeta.making_article_url) && !/^## 関連記事\s*$/m.test(expectedBody)) {
      expectedBody += `\n\n## 関連記事\n${originalMeta.article_url ? `\n- [作品記事](${originalMeta.article_url})` : ""}${originalMeta.making_article_url ? `\n- [メイキング](${originalMeta.making_article_url})` : ""}`;
    }
    if (kind === "projects" && originalMeta.features?.length && !/^## 主な機能\s*$/m.test(expectedBody)) expectedBody += `\n\n## 主な機能\n\n${originalMeta.features.map((feature) => `- ${feature}`).join("\n")}`;
    assert.equal(body(saved), expectedBody.trim(), `${kind}/${file}: body changed outside explicit migrations`);
    const before = metadata(source), after = metadata(saved);
    for (const [key, value] of Object.entries(before)) {
      if (value === "" || value == null || Array.isArray(value) && !value.length) continue;
      if (moved[kind]?.[key]) {
        for (const item of Array.isArray(value) ? value : [value]) assert.ok(body(saved).includes(String(item)), `${file}: migrated ${key} lost`);
        continue;
      }
      const target = aliases[key] || key;
      if ((key === "tags" || kind === "gallery" && key === "categories") && Array.isArray(value)) {
        const tags = normalizeContentTags(value);
        assert.deepEqual(after[target] ?? [], tags, `${kind}/${file}: tags changed outside canonicalization`);
        continue;
      }
      if (key === "credits" && Array.isArray(value)) { assert.equal(after[target], value.join("\n"), `${file}: credits changed`); continue; }
      if (key === "use_math" && value === false && after[target] === undefined) continue;
      assert.deepEqual(after[target], value, `${kind}/${file}: ${key} changed or lost`);
    }
  }
  console.log(`${kind}: ${files.length} current CMS roundtrips passed`);
}
