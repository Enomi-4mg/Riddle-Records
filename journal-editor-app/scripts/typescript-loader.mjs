import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const extensions = [".ts", ".tsx"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".") || path.extname(specifier)) throw error;

    for (const extension of extensions) {
      const url = new URL(`${specifier}${extension}`, context.parentURL);
      try {
        await fs.access(fileURLToPath(url));
        return { url: url.href, shortCircuit: true };
      } catch {
        // Try the next supported TypeScript extension.
      }
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!extensions.some((extension) => url.endsWith(extension))) {
    return nextLoad(url, context);
  }

  const sourcefile = fileURLToPath(url);
  const source = await fs.readFile(sourcefile, "utf8");
  const result = await transform(source, {
    format: "esm",
    loader: url.endsWith(".tsx") ? "tsx" : "ts",
    sourcemap: "inline",
    sourcefile,
    target: "es2022"
  });
  return { format: "module", source: result.code, shortCircuit: true };
}
