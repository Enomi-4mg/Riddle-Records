import type { DeploymentState } from "./deploymentTracking";
import type { PendingChanges } from "./pendingChanges";
import type { EditingStatus } from "../types/content";

export function cmsStatus({ pending, deployment, editing, conflict, error, readonly }: { pending: PendingChanges; deployment: DeploymentState; editing?: EditingStatus; conflict?: boolean; error?: string; readonly?: boolean }) {
  if (conflict || editing === "conflict") return { label: "競合", tone: "error" };
  if (error || editing === "error" || deployment.state === "failed") return { label: "エラー", tone: "error" };
  if (readonly) return { label: "読み取り専用", tone: "muted" };
  if (deployment.state === "syncing-github") return { label: "GitHub反映中", tone: "busy" };
  if (pending.deployment) return { label: deployment.state === "paused" ? "確認待ち" : "デプロイ中", tone: "busy" };
  if (pending.contents.length || pending.media) return { label: "未反映", tone: "pending" };
  return { label: "保存済み", tone: "saved" };
}
