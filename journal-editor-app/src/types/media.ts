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

export function isMediaRegistry(value: unknown): value is MediaRegistry {
  if (!value || typeof value !== "object") return false;
  const registry = value as Record<string, unknown>;
  return registry.version === 1 && Array.isArray(registry.assets) && registry.assets.every((asset) => asset && typeof asset === "object" && typeof asset.id === "string" && typeof asset.publicId === "string" && typeof asset.displayName === "string" && ["image", "video", "audio"].includes(asset.type) && Array.isArray(asset.tags) && asset.tags.every((tag: unknown) => typeof tag === "string") && typeof asset.alt === "string");
}
