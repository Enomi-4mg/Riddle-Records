import { aboutProfileErrors } from "../../../shared/aboutProfile";
import { workReference, type WorkPreview } from "../../../shared/workIdentity";
import { generatedContentFilename, normalizeYouTubeId } from "./cmsMarkdown";
import { slugify } from "./permalink";
import { resolveImageUrl } from "../../../src/utils/images";
import type { ContentDocument } from "../types/content";
export function featuredWorkOptions(documents: ContentDocument[]): WorkPreview[] {
  return documents.flatMap((doc): WorkPreview[] => {
    if (doc.common.publication !== "published") return [];
    if (doc.placement.kind === "gallery") {
      const slug = slugify(doc.placement.data.slug) || generatedContentFilename(doc).replace(/\.md$/, "");
      return [{ id: workReference("gallery", slug), kind: "visual", title: doc.common.title, thumbnail: resolveImageUrl(doc.placement.data.image) || "" }];
    }
    if (doc.placement.kind === "songs") {
      const slug = generatedContentFilename(doc).replace(/\.md$/, "");
      return [{ id: workReference("songs", slug), kind: "music", title: doc.common.title, thumbnail: `https://img.youtube.com/vi/${normalizeYouTubeId(doc.placement.data.youtubeId)}/sddefault.jpg` }];
    }
    return [];
  });
}
export function validateAboutDocument(doc: ContentDocument, documents: ContentDocument[]) {
  if (doc.placement.kind !== "about") return [];
  return aboutProfileErrors(doc.placement.data, featuredWorkOptions(documents).map((work) => work.id));
}
