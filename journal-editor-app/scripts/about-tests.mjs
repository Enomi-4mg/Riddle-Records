import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import { buildContentMarkdown, parseContentMarkdown, generatedContentFilename, createContentDocument } from "../src/lib/cmsMarkdown.ts";
import { aboutProfileErrors, readAboutProfile } from "../../shared/aboutProfile.ts";
import { validateAboutDocument } from "../src/lib/about.ts";
import { managedContentErrors } from "../src/lib/managedValidation.ts";
import { applyPendingChanges } from "../src/lib/deployPending.ts";
import { emptyPending, upsertPending } from "../src/lib/pendingChanges.ts";
const source = await fs.readFile(new URL("../../src/content/about/profile.md", import.meta.url), "utf8");
test("all profile fields and unknown metadata survive repeated real CMS saves", () => {
  const doc = parseContentMarkdown(source, "about", { path: "profile.md", revision: "old" });
  doc.placement.data.icon = "folder/avatar.png"; doc.placement.data.bio = "Line 1\n\nLine 2";
  doc.placement.data.featuredWorks = ["songs:summer", "gallery:cry"];
  doc.placement.data.hobbies = [" game ", " ", "Music"];
  doc.unknownFrontmatter.custom = "keep";
  const saved = buildContentMarkdown(doc); const read = parseContentMarkdown(saved, "about");
  assert.equal(buildContentMarkdown(read), saved); assert.equal(generatedContentFilename(doc), "profile.md");
  assert.deepEqual(read.placement.data, { ...doc.placement.data, hobbies: ["game", "Music"] });
  assert.equal(read.unknownFrontmatter.custom, "keep"); assert.ok(!saved.includes("date:")); assert.ok(!saved.includes("draft:"));
});
test("validates month/day, URL/image formats, duplicates, array shapes and references", () => {
  const profile = parseContentMarkdown(source, "about").placement.data;
  for (const birthday of ["02-29", "09-26", ""]) assert.deepEqual(aboutProfileErrors({ ...profile, birthday }), []);
  for (const birthday of ["02-30", "13-01", "9-26", "2026-09-26"]) assert.ok(aboutProfileErrors({ ...profile, birthday }).length);
  for (const icon of ["folder/avatar.png", "/images/avatar.jpg", "https://example.com/photo.png", ""]) assert.deepEqual(aboutProfileErrors({ ...profile, icon }), []);
  for (const icon of ["javascript:alert(1)", "//example.com/image", "https:", "https://user:password@example.com/a"]) assert.ok(aboutProfileErrors({ ...profile, icon }).length);
  assert.ok(aboutProfileErrors({ ...profile, sns: [{ service: "Bad", url: "javascript:alert(1)", label: "" }] }).length);
  assert.ok(aboutProfileErrors({ ...profile, featuredWorks: ["gallery:cry", "gallery:cry"] }).length);
  assert.ok(aboutProfileErrors({ ...profile, featuredWorks: ["gallery:missing"] }, []).length);
  assert.throws(() => readAboutProfile({ name: "Test", likes: [false] })); assert.throws(() => readAboutProfile({ name: "Test", sns: [{ service: "X", url: 3 }] }));
});
test("CMS checks existence across Visual/Music and ignores drafts", () => {
  const doc = parseContentMarkdown(source, "about");
  const visual = createContentDocument("gallery"); visual.common.publication = "published"; visual.placement.data.slug = "cry";
  const song = createContentDocument("songs"); song.file = { path: "summer.md" }; song.common.publication = "published";
  doc.placement.data.featuredWorks = ["songs:summer", "gallery:cry"];
  assert.deepEqual(validateAboutDocument(doc, [visual, song]), []);
  song.common.publication = "draft"; assert.ok(validateAboutDocument(doc, [visual, song]).some((error) => error.includes("songs:summer")));
});
test("shared server validation overlays pending works and keeps reference removal atomic", async () => {
  const doc = parseContentMarkdown(source, "about"); doc.placement.data.featuredWorks = ["gallery:cry"];
  const art = "---\ntitle: Cry\ndate: 2026-01-01\nslug: cry\nimage: cry.png\n---\n";
  const readProfile = async () => buildContentMarkdown(doc); const readWorks = async () => [{ kind: "gallery", path: "cry.md", markdown: art }];
  assert.ok((await managedContentErrors([{ kind: "gallery", path: "cry.md", operation: "delete" }], readProfile, readWorks)).length);
  const newArt = art.replaceAll("cry", "new"); doc.placement.data.featuredWorks = ["gallery:new"];
  assert.deepEqual(await managedContentErrors([{ kind: "about", path: "profile.md", operation: "save", markdown: buildContentMarkdown(doc) }, { kind: "gallery", path: "new.md", operation: "save", markdown: newArt }], readProfile, readWorks), []);
});
test("About uses pending deployment and revision updates and cannot be deleted", async () => {
  const doc = parseContentMarkdown(source, "about", { path: "profile.md", revision: "old" });
  const queue = upsertPending(emptyPending(), { document: doc, operation: "save" });
  const deps = { readRevision: async () => "old", saveContent: async (kind, path, markdown, opts) => { assert.equal(kind, "about"); assert.equal(path, "profile.md"); assert.equal(opts.expectedRevision, "old"); assert.equal(parseContentMarkdown(markdown, "about").placement.data.name, "4mg"); return { path, revision: "new", commitSha: "commit" }; } };
  const result = await applyPendingChanges(queue, () => {}, deps); assert.equal(result.contents[0].document.file.revision, "new"); assert.equal(result.lastCommitSha, "commit");
  await assert.rejects(() => applyPendingChanges(upsertPending(emptyPending(), { document: doc, operation: "delete" }), () => {}, deps), /削除できません/);
});
