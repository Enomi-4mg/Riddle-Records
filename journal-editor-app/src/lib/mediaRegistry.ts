import type { MediaRegistry, MediaRegistryResult } from "../types/media";

export class MediaRegistryConflictError extends Error { constructor(public currentRevision?: string) { super("Media Registry has changed"); } }
async function readError(response: Response) { try { return ((await response.json()) as { error?: string }).error || response.statusText; } catch { return response.statusText; } }
export async function loadMediaRegistry(): Promise<MediaRegistryResult> {
  const response = await fetch("/api/media-registry"); if (!response.ok) throw new Error(await readError(response)); return response.json();
}
export async function saveMediaRegistry(registry: MediaRegistry, expectedRevision?: string, force = false): Promise<MediaRegistryResult> {
  const response = await fetch("/api/media-registry", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registry, expectedRevision, force }) });
  if (response.status === 409) { const value = await response.json() as { currentRevision?: string }; throw new MediaRegistryConflictError(value.currentRevision); }
  if (!response.ok) throw new Error(await readError(response)); return response.json();
}
export function mediaUrl(publicId: string, type: "image" | "video" | "audio", transform = type === "image" ? "w_640,q_auto,f_auto" : "q_auto") {
  if (/^https?:\/\//.test(publicId) || publicId.startsWith("/")) return publicId;
  const resource = type === "image" ? "image" : "video";
  return `https://res.cloudinary.com/dzq8y9qes/${resource}/upload/${transform}/v1/${publicId}`;
}
