import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadContentFile, loadContentFiles } from "../lib/contentFiles";
import { parseContentMarkdown } from "../lib/cmsMarkdown";
import { type PendingChanges } from "../lib/pendingChanges";
import type { ContentDocument, ContentFileInfo } from "../types/content";

export function overlayPending(loaded: ContentDocument[], queue: PendingChanges) {
  const identity = (doc: ContentDocument) => doc.file ? `${doc.placement.kind}:${doc.file.path}` : doc.id;
  const byId = new Map(loaded.map((doc) => [identity(doc), doc]));
  for (const item of queue.contents) {
    // A newly saved file may replace a UUID-keyed browser draft.
    byId.delete(item.document.id);
    if (item.operation === "delete") byId.delete(identity(item.document));
    else byId.set(identity(item.document), item.document);
  }
  return [...byId.values()];
}

export function useContentDocuments(pending: PendingChanges) {
  const [loaded, setLoaded] = useState<ContentDocument[]>([]);
  const [files, setFiles] = useState<ContentFileInfo[]>([]);
  const [error, setError] = useState<string>();
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++request.current;
    const result = await loadContentFiles();
    if (generation !== request.current) return;
    if (!result.available) { setError(result.error || "コンテンツAPIを利用できません"); return; }
    const values = await Promise.all(result.files.map(async (file) => {
      const value = await loadContentFile(file.kind, file.path);
      return parseContentMarkdown(value.markdown, file.kind, { path: file.path, revision: value.revision });
    }).map((promise) => promise.then((doc) => ({ doc }), (error: unknown) => ({ error }))));
    if (generation !== request.current) return;
    const errors = values.filter((value) => "error" in value);
    if (errors.length) { setError(`${errors.length}件のコンテンツを読み込めません。再読み込みしてください`); return; }
    setFiles(result.files); setLoaded(values.flatMap((value) => "doc" in value ? [value.doc] : [])); setError(undefined);
  }, []);
  useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh]);
  useEffect(() => {
    const applied = pending.contents.filter((item) => item.applied);
    if (applied.length) setLoaded((values) => overlayPending(values, { version: 1, contents: applied }));
  }, [pending]);
  return { documents: useMemo(() => overlayPending(loaded, pending), [loaded, pending]), files, error, refresh };
}
