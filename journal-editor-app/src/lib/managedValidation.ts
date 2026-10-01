import { aboutProfileErrors } from "../../../shared/aboutProfile";
import { aboutFilename, type ManagedContentKind } from "../../../shared/contentStorage";
import { workReference } from "../../../shared/workIdentity";
import { parseContentMarkdown, contentFrontmatter } from "./cmsMarkdown";
export type ManagedChange = { kind: ManagedContentKind; path: string; operation: "save" | "delete"; markdown?: string };
export type ManagedSource = { kind: "gallery" | "songs"; path: string; markdown: string };
export async function managedContentErrors(changes: ManagedChange[], readProfile: () => Promise<string | undefined>, readWorks: () => Promise<ManagedSource[]>): Promise<string[]> {
  if (!changes.some((item) => ["about", "gallery", "songs"].includes(item.kind))) return [];
  const about = changes.find((item) => item.kind === "about");
  if (about && (about.path !== aboutFilename || about.operation !== "save")) return ["Aboutはprofile.mdの1件だけを編集でき、削除できません"];
  const source = about ? about.markdown : await readProfile();
  if (source === undefined) return [];
  try {
    const profile = parseContentMarkdown(source, "about").placement;
    if (profile.kind !== "about") return ["Invalid About profile"];
    const errors = aboutProfileErrors(profile.data);
    if (errors.length || !profile.data.featuredWorks.length) return errors;
    const works = new Map((await readWorks()).map((item) => [`${item.kind}/${item.path}`, item]));
    for (const change of changes) {
      if (change.kind !== "gallery" && change.kind !== "songs") continue;
      const key = `${change.kind}/${change.path}`;
      if (change.operation === "delete") works.delete(key);
      else works.set(key, { kind: change.kind, path: change.path, markdown: change.markdown! });
    }
    const refs: string[] = [];
    for (const item of works.values()) {
      const doc = parseContentMarkdown(item.markdown, item.kind, { path: item.path });
      if (doc.common.publication === "draft") continue;
      const slug = item.kind === "songs" ? item.path.replace(/\.md$/, "") : String(contentFrontmatter(doc).slug);
      refs.push(workReference(item.kind, slug));
    }
    return aboutProfileErrors(profile.data, refs);
  } catch (error) { return [error instanceof Error ? error.message : "Aboutを読み込めません"]; }
}
