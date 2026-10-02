import { useCallback, useEffect, useRef, useState } from "react";
import { loadMediaRegistry } from "../lib/mediaRegistry";
import type { PendingChanges } from "../lib/pendingChanges";
import type { MediaRegistry } from "../types/media";

export function useMediaRegistry(pending: PendingChanges) {
  const [server, setServer] = useState<{ registry: MediaRegistry; revision?: string }>({ registry: { version: 1, assets: [] } });
  const [error, setError] = useState<string>();
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++request.current;
    try { const value = await loadMediaRegistry(); if (generation === request.current) { setServer(value); setError(undefined); } }
    catch (error) { if (generation === request.current) setError(`メディアを読み込めません: ${error instanceof Error ? error.message : "Unknown error"}`); }
  }, []);
  useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh]);
  useEffect(() => { if (pending.media?.applied) setServer({ registry: pending.media.registry, revision: pending.media.expectedRevision }); }, [pending.media]);
  return { registry: pending.media?.registry ?? server.registry, revision: pending.media?.applied ? pending.media.expectedRevision : server.revision, refresh, error };
}
