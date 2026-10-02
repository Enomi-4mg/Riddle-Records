import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import * as yaml from "js-yaml";
const workflow = (name) => yaml.load(fs.readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), "utf8"));
const matches = (file, pattern) => pattern.endsWith("/**") ? file.startsWith(pattern.slice(0, -2)) : file === pattern;
const triggers = (config, files) => files.some((file) => config.paths ? config.paths.some((pattern) => matches(file, pattern)) : !(config["paths-ignore"] || []).some((pattern) => matches(file, pattern)));
test("managed content and media run validation without duplicate Pages or Worker deployments", () => {
  const pages = workflow("astro-pages"), worker = workflow("content-editor-worker"), tests = workflow("content-tests");
  for (const files of [["src/content/journal/article.md"], ["src/data/media-registry.json"], ["src/content/about/profile.md", "src/data/media-registry.json"]]) {
    assert.equal(triggers(pages.on.push, files), false);
    assert.equal(triggers(worker.on.push, files), false);
    assert.equal(triggers(tests.on.push, files), true);
  }
  for (const file of ["journal-editor-app/src/App.tsx", "journal-editor-app/worker/index.ts", "shared/contentStorage.ts", "src/utils/images.ts", "assets/css/embeds.css", "assets/css/main.css", "assets/css/journal.css", "src/components/Header.astro", "favicon/favicon.ico", "package.json", "package-lock.json"]) assert.equal(triggers(worker.on.push, [file]), true, file);
  assert.equal(triggers(pages.on.push, ["src/content/journal/article.md", "src/pages/index.astro"]), true);
  assert.ok(pages.on.workflow_dispatch); assert.deepEqual(pages.on.repository_dispatch.types, ["cms_site_deploy"]);
  const checkout = pages.jobs.build.steps.find((step) => step.name === "Checkout");
  assert.match(checkout.with.ref, /client_payload.commit_sha/); assert.match(checkout.with.ref, /github.sha/);
  assert.equal(pages.jobs.build.steps.find((step) => step.name === "Set site update date").env.DEPLOY_SHA, "HEAD");
  assert.ok(!JSON.stringify(tests.jobs).includes("wrangler deploy"));
});
