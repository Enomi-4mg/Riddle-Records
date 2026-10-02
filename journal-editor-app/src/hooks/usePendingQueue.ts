import { useCallback, useEffect, useState } from "react";
import { pendingStorageKey, readPending, writePending, type PendingChanges } from "../lib/pendingChanges";

export function usePendingQueue() {
  const [pending, setPending] = useState(readPending);
  const [externalRevision, setExternalRevision] = useState(0);
  const updatePending = useCallback((next: PendingChanges) => { writePending(next); setPending(next); }, []);
  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key !== pendingStorageKey && event.key !== null) return;
      setPending(readPending()); setExternalRevision((value) => value + 1);
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, []);
  return { pending, updatePending, externalRevision };
}
