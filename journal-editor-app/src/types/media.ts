export type MediaType = "image" | "video" | "audio";
export type MediaAsset = { id: string; publicId: string; type: MediaType; displayName: string; tags: string[]; alt: string };
export type MediaRegistry = { version: 1; assets: MediaAsset[] };
export type MediaRegistryResult = { registry: MediaRegistry; revision: string };
export function validateMediaRegistry(value: MediaRegistry) {
  const ids = new Set<string>(); const references = new Set<string>();
  for (const asset of value.assets) {
    if (!asset.id.trim() || !asset.publicId.trim() || !asset.displayName.trim()) return "ID、public ID、表示名は必須です";
    if (ids.has(asset.id)) return `IDが重複しています: ${asset.id}`;
    const reference = `${asset.type}:${asset.publicId}`;
    if (references.has(reference)) return `public IDと種類が重複しています: ${asset.publicId}`;
    ids.add(asset.id); references.add(reference);
  }
  return null;
}
