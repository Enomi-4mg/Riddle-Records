import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("dist");
async function files(directory) {
  return (await Promise.all((await fs.readdir(directory, { withFileTypes: true })).map((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}
let checked = 0;
for (const file of (await files(path.join(root, "legacy"))).filter((file) => file.endsWith(".html"))) {
  const html = await fs.readFile(file, "utf8");
  for (const [, reference] of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) continue;
    const url = reference.split(/[?#]/)[0];
    const target = path.resolve(url.startsWith("/") ? root : path.dirname(file), url.replace(/^\//, ""));
    assert.ok(target.startsWith(`${root}/`), `${file}: reference escapes output: ${reference}`);
    await assert.doesNotReject(fs.access(target), `${file}: missing ${reference}`);
    checked++;
  }
}
console.log(`Legacy: ${checked} local href/src references resolve in build output`);
