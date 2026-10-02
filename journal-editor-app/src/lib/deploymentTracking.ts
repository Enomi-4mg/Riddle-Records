import { getSiteDeploy, type DeployStatus } from "./siteDeploy";
import type { PendingChanges } from "./pendingChanges";

export type Deployment = NonNullable<PendingChanges["deployment"]>;
export type DeploymentState =
  | { state: "idle" }
  | { state: "syncing-github" }
  | { state: "waiting"; deployment: Deployment; url?: string }
  | { state: "paused"; deployment: Deployment; message: string; url?: string }
  | { state: "success"; sha: string; url?: string }
  | { state: "failed"; message: string; sha?: string; url?: string };

export function restoredDeploymentState(queue: PendingChanges): DeploymentState {
  if (queue.deployment) return { state: "waiting", deployment: queue.deployment };
  const result = queue.lastDeployment;
  if (!result) return { state: "idle" };
  return result.conclusion === "success" ? { state: "success", sha: result.sha, url: result.url } : { state: "failed", sha: result.sha, url: result.url, message: `サイトのデプロイに失敗しました: ${result.conclusion}` };
}

function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

export async function trackDeployment(deployment: Deployment, options: {
  signal: AbortSignal;
  onState: (state: DeploymentState) => void;
  onComplete: (result: DeployStatus) => Promise<void>;
  getStatus?: typeof getSiteDeploy;
  sleep?: typeof pause;
  attempts?: number;
  intervalMs?: number;
}) {
  const { signal, onState, onComplete, getStatus = getSiteDeploy, sleep = pause, attempts = 40, intervalMs = 15000 } = options;
  let url: string | undefined;
  try {
    for (let attempt = 0; attempt < attempts && !signal.aborted; attempt += 1) {
      const result = await getStatus(deployment.id, deployment.startedAt, signal);
      if (signal.aborted) return;
      url = result.url;
      if (result.status === "completed") { await onComplete(result); return; }
      onState({ state: "waiting", deployment, url });
      if (attempt < attempts - 1) await sleep(intervalMs, signal);
    }
    if (!signal.aborted) onState({ state: "paused", deployment, url, message: "完了確認を一時停止しました。状態を再確認できます" });
  } catch (error) {
    if (!signal.aborted) onState({ state: "paused", deployment, url, message: `デプロイ状態を確認できません: ${error instanceof Error ? error.message : "Unknown error"}` });
  }
}
