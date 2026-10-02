import { emptyAboutProfile, type AboutProfile } from "../../../shared/aboutProfile";
import type { ManagedContentKind } from "../../../shared/contentStorage";
export type { ManagedContentKind } from "../../../shared/contentStorage";
export const contentKinds = ["journal", "songs", "gallery", "projects"] as const;
export type ContentKind = (typeof contentKinds)[number];
export type PublicationStatus = "draft" | "published";
export type EditingStatus = "clean" | "dirty" | "saving" | "conflict" | "error";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";

export type CommonContentFields = { title: string; date: string; description: string; tags: string[]; publication: PublicationStatus };
export type JournalFields = { articleType: "journal" | "making" | "report"; slug: string; thumbnail: string; thumbnailAlt: string; thumbnailFit: string; thumbnailPosition: string; ogImage: string; ogDescription: string; relatedContent: string[]; useMath: boolean; permalink: string; image: string; thumbnailClass: string };
export type SongFields = { youtubeId: string; credits: string; lyrics: string };
export type GalleryFields = { slug: string; detail: boolean; image: string; thumbnail: string; thumbnailAlt: string; articleUrl: string; makingArticleUrl: string };
export type ProjectFields = { slug: string; hero: string; status: ProjectStatus; links: Array<{ label: string; url: string }>; features: string[] };

export type PlacementFields =
  | { kind: "journal"; data: JournalFields }
  | { kind: "songs"; data: SongFields }
  | { kind: "gallery"; data: GalleryFields }
  | { kind: "projects"; data: ProjectFields }
  | { kind: "about"; data: AboutProfile };

export type ContentDocument = {
  id: string;
  common: CommonContentFields;
  placement: PlacementFields;
  body: string;
  unknownFrontmatter: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  publicationHistory?: { hasBeenPublished: boolean; dateSource: "automatic" | "manual" | "legacy"; firstPublishedAt?: string };
  source: "manual" | "imported" | "uploaded";
  file?: { path: string; revision?: string };
};

export type ContentFileInfo = { kind: ManagedContentKind; path: string; revision: string };
export type ContentFileListResult = { available: boolean; files: ContentFileInfo[]; error?: string };
export const contentKindLabels: Array<{ kind: ContentKind; label: string }> = [
  { kind: "journal", label: "Journal" }, { kind: "songs", label: "Songs" },
  { kind: "gallery", label: "Gallery" }, { kind: "projects", label: "Projects" }
];
export const contentDirectories: Record<ContentKind, string> = { journal: "src/content/journal", songs: "src/content/songs", gallery: "src/content/gallery", projects: "src/content/projects" };
export const routeBases: Record<ContentKind, string> = { journal: "/journal/", songs: "/disco/", gallery: "/gallery/", projects: "/project/" };
type LegacyField = { key: string; label: string; type: "text"; required?: boolean };
const legacyRequired: Record<ContentKind, LegacyField[]> = {
  journal: [{ key: "title", label: "title", type: "text", required: true }, { key: "date", label: "date", type: "text", required: true }],
  songs: [{ key: "title", label: "title", type: "text", required: true }, { key: "date", label: "date", type: "text", required: true }, { key: "youtube_id", label: "youtube_id", type: "text", required: true }],
  gallery: [{ key: "title", label: "title", type: "text", required: true }, { key: "date", label: "date", type: "text", required: true }, { key: "slug", label: "slug", type: "text", required: true }, { key: "image", label: "image", type: "text", required: true }],
  projects: [{ key: "title", label: "title", type: "text", required: true }, { key: "date", label: "date", type: "text", required: true }, { key: "slug", label: "slug", type: "text", required: true }]
};
export const contentKindSchemas = Object.fromEntries(contentKinds.map((kind) => [kind, {
  kind, label: contentKindLabels.find((item) => item.kind === kind)!.label,
  directory: contentDirectories[kind], routeBase: routeBases[kind], fields: legacyRequired[kind]
}])) as unknown as Record<ContentKind, { kind: ContentKind; label: string; directory: string; routeBase: string; fields: readonly LegacyField[] }>;
export function isContentKind(value: string | null | undefined): value is ContentKind { return Boolean(value && (contentKinds as readonly string[]).includes(value)); }
export function createPlacement(kind: ManagedContentKind): PlacementFields {
  if (kind === "about") return { kind, data: emptyAboutProfile() };
  if (kind === "journal") return { kind, data: { articleType: "journal", slug: "", thumbnail: "", thumbnailAlt: "", thumbnailFit: "", thumbnailPosition: "", ogImage: "", ogDescription: "", relatedContent: [], useMath: false, permalink: "", image: "", thumbnailClass: "" } };
  if (kind === "songs") return { kind, data: { youtubeId: "", credits: "", lyrics: "" } };
  if (kind === "gallery") return { kind, data: { slug: "", detail: false, image: "", thumbnail: "", thumbnailAlt: "", articleUrl: "", makingArticleUrl: "" } };
  return { kind, data: { slug: "", hero: "", status: "active", links: [], features: [] } };
}
