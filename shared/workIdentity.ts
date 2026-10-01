export type WorkKind = "visual" | "music";
export type WorkReference = `gallery:${string}` | `songs:${string}`;
export type WorkPreview = { id: WorkReference; kind: WorkKind; title: string; thumbnail: string; draft?: boolean };
export function workReference(collection: "gallery" | "songs", slug: string): WorkReference {
  return `${collection}:${slug}`;
}
export function galleryWorkPath(id: WorkReference, filter?: WorkKind) {
  const query = new URLSearchParams({ work: id });
  if (filter) query.set("filter", filter);
  return `/gallery/?${query}`;
}
