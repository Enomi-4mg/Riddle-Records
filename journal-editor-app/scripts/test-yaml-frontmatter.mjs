import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";

async function bundleImport(entry) {
  const outfile = path.join(os.tmpdir(), `riddle-editor-test-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent"
  });
  const module = await import(`file://${outfile}`);
  await fs.unlink(outfile).catch(() => undefined);
  return module;
}

const yaml = await bundleImport(new URL("../src/lib/yamlFrontmatter.ts", import.meta.url).pathname);
const frontmatter = await bundleImport(new URL("../src/lib/frontmatter.ts", import.meta.url).pathname);

const parsed = yaml.parseYamlFrontmatter(`title: "Song title"
tags: ["楽曲", "ボカロ"]
draft: false
empty:
lyrics: |
  line one
  line two
meta:
  label: "demo"
  featured: true
`);

assert.equal(parsed.title, "Song title");
assert.deepEqual(parsed.tags, ["楽曲", "ボカロ"]);
assert.equal(parsed.draft, false);
assert.equal(parsed.empty, "");
assert.equal(parsed.lyrics, "line one\nline two");
assert.deepEqual(parsed.meta, { label: "demo", featured: true });

assert.equal(yaml.yamlString("a\nb"), "\"a\\nb\"");
assert.equal(yaml.yamlArray(["a", "b"]), "[\"a\", \"b\"]");
assert.equal(yaml.yamlBlock("a\nb"), "|\n  a\n  b");

const songOutput = frontmatter.buildFrontmatter({
  title: "Song title",
  date: "2026-01-02",
  type: "journal",
  slug: "",
  description: "description",
  youtube_id: "abc123",
  credits: "Music: 4mg\nGuitar: rita",
  lyrics: "la\nla",
  cloudinary_id: "",
  categories: "",
  detail: false,
  article_url: "",
  making_article_url: "",
  subtitle: "",
  heroImage: "",
  externalUrl: "",
  sourceUrl: "",
  features: "",
  tags: "楽曲, ボカロ",
  draft: false,
  thumbnail: "",
  thumbnail_alt: "",
  thumbnail_fit: "",
  thumbnail_position: "",
  og_image: "",
  featured_related: "",
  use_math: false,
  permalink: "",
  og_description: "",
  image: "",
  thumbnail_class: ""
}, "songs");

const expectedOrder = ["title:", "date:", "youtube_id:", "description:", "credits:", "lyrics:", "tags:"];
const positions = expectedOrder.map((key) => songOutput.indexOf(key));
assert.ok(positions.every((position) => position >= 0), songOutput);
assert.deepEqual([...positions].sort((a, b) => a - b), positions);
assert.ok(songOutput.includes("credits: |\n  Music: 4mg\n  Guitar: rita"));
assert.ok(songOutput.includes("lyrics: |\n  la\n  la"));

console.log("yaml frontmatter tests passed");
