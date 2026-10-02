import type { ContentDocument } from "../types/content";
import type { MediaRegistry } from "../types/media";

export type PendingContent = { document: ContentDocument; operation: "save" | "delete"; applied?: boolean };
export type PendingRegistry = { registry: MediaRegistry; expectedRevision?: string; applied?: boolean };
export type PendingChanges = { version: 1; contents: PendingContent[]; media?: PendingRegistry; lastCommitSha?: string; deployment?: { id: string; sha: string; startedAt?: string }; lastDeployment?: { id: string; sha: string; conclusion: string; url?: string; finishedAt: string } };

const key = "riddle-cms-pending-v1";
export const emptyPending = (): PendingChanges => ({ version: 1, contents: [] });

export function readPending(): PendingChanges {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null") as PendingChanges | null;
    return value?.version === 1 && Array.isArray(value.contents) ? value : emptyPending();
  } catch { return emptyPending(); }
}

export function writePending(value: PendingChanges) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function upsertPending(value: PendingChanges, entry: PendingContent): PendingChanges {
  return { ...value, contents: [...value.contents.filter((item) => item.document.id !== entry.document.id), entry] };
}
