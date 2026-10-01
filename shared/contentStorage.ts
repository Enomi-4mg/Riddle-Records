export const managedContentDirectories = {
  journal: "src/content/journal", songs: "src/content/songs", gallery: "src/content/gallery",
  projects: "src/content/projects", about: "src/content/about"
} as const;
export type ManagedContentKind = keyof typeof managedContentDirectories;
export const aboutFilename = "profile.md";
export function isManagedContentKind(value: unknown): value is ManagedContentKind {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(managedContentDirectories, value);
}
export function isAllowedSingletonOperation(kind: ManagedContentKind, filename: string, operation: "read" | "save" | "delete" = "read") {
  return kind !== "about" || filename === aboutFilename && operation !== "delete";
}
