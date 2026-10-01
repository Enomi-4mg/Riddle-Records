import type { ManagedContentKind } from "../types/content";
import type { MediaRegistry } from "../types/media";

export type BatchContent = { id: string; kind: ManagedContentKind; path: string; operation: "save" | "delete"; markdown?: string; expectedRevision?: string; force?: boolean };
export type BatchPayload = { contents: BatchContent[]; media?: { registry: MediaRegistry; expectedRevision?: string; force?: boolean } };
export type BatchResult = { commitSha: string; contents: Array<{ id: string; path: string; revision?: string }>; mediaRevision?: string };

export class BatchConflictError extends Error {
  constructor(public detail: { target: "content" | "media"; documentId?: string; operation: "save" | "delete"; expectedRevision?: string; currentRevision?: string }) {
    super("GitHub側の変更と競合しています");
  }
}

export async function commitBatch(payload: BatchPayload): Promise<BatchResult> {
  const response = await fetch("/api/pending-batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (response.status === 409) {
    const detail = await response.json() as BatchConflictError["detail"];
    throw new BatchConflictError(detail);
  }
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<BatchResult>;
}
