import { useState } from "react";
import { type PendingConflictError } from "../lib/deployPending";
import { readPending, type PendingChanges } from "../lib/pendingChanges";
import { loadContentFile } from "../lib/contentFiles";
import { generatedContentFilename, parseContentMarkdown } from "../lib/cmsMarkdown";
import type { ContentDocument } from "../types/content";

export function useConflict(options: { enabled: boolean; updatePending: (value: PendingChanges) => void; onDocument: (doc: ContentDocument | null) => void; onRefresh: () => Promise<void>; onForce: (target?: string) => void }) {
  const [conflict, setConflict] = useState<PendingConflictError["detail"] | null>(null);
  async function resolve(action: "reload" | "discard" | "force") {
    if (!conflict || !options.enabled) return;
    if (action === "force") { options.onForce(conflict.target === "media" ? "media" : conflict.documentId); return; }
    const pending = readPending();
    const next = conflict.target === "media" ? { ...pending, media: undefined } : { ...pending, contents: pending.contents.filter((item) => item.document.id !== conflict.documentId) };
    options.updatePending(next); setConflict(null);
    if (conflict.target === "content") {
      const item = pending.contents.find((entry) => entry.document.id === conflict.documentId);
      if (item) {
        try {
          const path = generatedContentFilename(item.document);
          const value = await loadContentFile(item.document.placement.kind, path);
          options.onDocument(parseContentMarkdown(value.markdown, item.document.placement.kind, { path, revision: value.revision }));
        } catch { options.onDocument(null); }
      }
    }
    await options.onRefresh();
  }
  return { conflict, setConflict, resolve };
}
