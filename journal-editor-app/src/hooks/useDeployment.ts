import { useEffect, useRef, useState } from "react";
import { restoredDeploymentState, trackDeployment, type DeploymentState } from "../lib/deploymentTracking";
import { emptyPending, readPending, type PendingChanges } from "../lib/pendingChanges";

export function useDeployment({ pending, updatePending, onRefresh, enabled = true }: { pending: PendingChanges; updatePending: (queue: PendingChanges) => void; onRefresh: () => Promise<void>; enabled?: boolean }) {
  const [state, setState] = useState<DeploymentState>(() => restoredDeploymentState(pending));
  const [check, setCheck] = useState(0);
  const syncing = useRef(false);
  const latest = useRef({ updatePending, onRefresh });
  latest.current = { updatePending, onRefresh };
  const deployment = pending.deployment;
  const recheck = () => setCheck((value) => value + 1);

  useEffect(() => {
    if (!deployment || !enabled) return;
    const controller = new AbortController();
    setState({ state: "waiting", deployment });
    void trackDeployment(deployment, { signal: controller.signal, onState: setState, onComplete: async (result) => {
      const queue = readPending();
      if (queue.deployment?.id !== deployment.id || controller.signal.aborted) return;
      const lastDeployment = { ...deployment, conclusion: result.conclusion || "unknown", url: result.url, finishedAt: new Date().toISOString() };
      const next = result.conclusion === "success" ? { ...emptyPending(), lastDeployment } : { ...queue, deployment: undefined, lastDeployment };
      latest.current.updatePending(next);
      setState(restoredDeploymentState(next));
      await latest.current.onRefresh();
    } });
    const onFocus = () => recheck();
    const onVisible = () => { if (document.visibilityState === "visible") recheck(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => { controller.abort(); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisible); };
  }, [deployment?.id, deployment?.startedAt, enabled, check]);

  useEffect(() => {
    if (!pending.deployment && !syncing.current) setState(restoredDeploymentState(pending));
  }, [pending.lastDeployment, pending.deployment?.id]);

  return { state, recheck, clearError: () => setState(restoredDeploymentState(readPending())), beginSync: () => { if (syncing.current) return false; syncing.current = true; setState({ state: "syncing-github" }); return true; }, endSync: () => { syncing.current = false; }, fail: (message: string) => setState({ state: "failed", message }),
    async finishLocal() { latest.current.updatePending(emptyPending()); setState({ state: "success", sha: "local" }); await latest.current.onRefresh(); },
    stopTracking() { latest.current.updatePending({ ...readPending(), deployment: undefined }); setState({ state: "idle" }); }
  };
}
