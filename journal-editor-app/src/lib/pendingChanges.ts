import type { ContentDocument } from "../types/content";
import type { MediaRegistry } from "../types/media";

export type PendingContent = { document: ContentDocument; operation: "save" | "delete"; applied?: boolean };
export type PendingRegistry = { registry: MediaRegistry; expectedRevision?: string; applied?: boolean };
export type PendingChanges = { version: 1; contents: PendingContent[]; media?: PendingRegistry; lastCommitSha?: string; deployment?: { id: string; sha: string; startedAt?: string }; lastDeployment?: { id: string; sha: string; conclusion: string; url?: string; finishedAt: string } };

export const pendingStorageKey = "riddle-cms-pending-v1";
export const emptyPending = (): PendingChanges => ({ version: 1, contents: [] });

export function readPending(): PendingChanges {
  try {
    const value = JSON.parse(localStorage.getItem(pendingStorageKey) || "null") as PendingChanges | null;
    return value?.version === 1 && Array.isArray(value.contents) ? value : emptyPending();
  } catch { return emptyPending(); }
}

export function writePending(value: PendingChanges) {
  localStorage.setItem(pendingStorageKey, JSON.stringify(value));
}

export function upsertPending(value: PendingChanges, entry: PendingContent): PendingChanges {
  return { ...value, contents: [...value.contents.filter((item) => item.document.id !== entry.document.id), entry] };
}

export function removePending(value: PendingChanges, id: string): PendingChanges {
  if (value.deployment) throw new Error("デプロイ中の変更は取り消せません");
  if (id === "media") {
    if (value.media?.applied) throw new Error("GitHub反映済みの変更は取り消せません。編集して再反映してください");
    return { ...value, media: undefined };
  }
  if (value.contents.find((item) => item.document.id === id)?.applied) throw new Error("GitHub反映済みの変更は取り消せません。編集して再反映してください");
  return { ...value, contents: value.contents.filter((item) => item.document.id !== id) };
}
