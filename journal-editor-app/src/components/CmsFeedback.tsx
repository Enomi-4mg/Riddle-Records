import { useRef, useState } from "react";
import { FloatingPanel } from "./FloatingPanel";
import { cmsStatus } from "../lib/cmsStatus";
import { generatedContentFilename } from "../lib/cmsMarkdown";
import type { DeploymentState } from "../lib/deploymentTracking";
import type { PendingChanges } from "../lib/pendingChanges";
import type { PendingConflictError } from "../lib/deployPending";
import type { ContentDocument, EditingStatus } from "../types/content";
import type { NoticeMessage } from "../hooks/useNotice";
import { safeLink } from "../../../shared/embeds";

export function Notice({ value, onDismiss }: { value: NoticeMessage | null; onDismiss: () => void }) {
  if (!value) return null;
  return <aside className={`cms-notice global-notice notice-${value.tone}`} role={value.tone === "error" ? "alert" : "status"}><span>{value.message}</span><button type="button" aria-label="通知を閉じる" onClick={onDismiss}>閉じる</button></aside>;
}

export function StatusControl({ pending, deployment, document: doc, editing, conflict, error, readonlyMessage, registryRevision, onRecheck, onRetry, onStop }: {
  pending: PendingChanges; deployment: DeploymentState; document?: ContentDocument | null; editing?: EditingStatus; conflict?: boolean; error?: string; readonlyMessage?: string; registryRevision?: string; onRecheck: () => void; onRetry: () => void; onStop: () => void;
}) {
  const [open, setOpen] = useState(false); const trigger = useRef<HTMLButtonElement>(null);
  const state = cmsStatus({ pending, deployment, editing, conflict, error, readonly: Boolean(readonlyMessage) });
  const workflowUrl = "url" in deployment ? safeLink(deployment.url || "") : "";
  return <div className="cms-status"><button ref={trigger} className={`status-pill status-tone-${state.tone}`} type="button" aria-expanded={open} aria-label={`状態: ${state.label}。詳細を表示`} onClick={() => setOpen(!open)}>{state.label}</button>{open && <FloatingPanel anchor={trigger} className="status-detail" onClose={() => setOpen(false)}>
    <strong>保存・公開の状態</strong>
    <dl><dt>ブラウザの保留変更</dt><dd>{pending.contents.length + (pending.media ? 1 : 0)}件</dd><dt>GitHubへの反映</dt><dd>{pending.contents.filter((item) => item.applied).length + (pending.media?.applied ? 1 : 0)}件反映済み</dd><dt>サイト公開</dt><dd>{deployment.state === "success" ? "デプロイ完了" : deployment.state === "waiting" ? "デプロイ中" : deployment.state === "paused" ? "確認待ち" : deployment.state === "failed" ? "失敗" : deployment.state === "syncing-github" ? "GitHub反映中" : "待機中"}</dd>{doc && <><dt>公開設定</dt><dd>{doc.common.publication === "published" ? "公開" : "下書き"}</dd><dt>ファイル</dt><dd>{generatedContentFilename(doc) || "未設定"}</dd><dt>更新日時</dt><dd>{doc.updatedAt}</dd><dt>記事revision</dt><dd>{doc.file?.revision || "未反映"}</dd></>}<dt>メディアrevision</dt><dd>{registryRevision || "未取得"}</dd>{pending.lastCommitSha && <><dt>GitHub commit</dt><dd>{pending.lastCommitSha}</dd></>}{pending.deployment && <><dt>公開するcommit</dt><dd>{pending.deployment.sha}</dd><dt>デプロイ開始</dt><dd>{pending.deployment.startedAt || "不明"}</dd></>}{pending.lastDeployment && <><dt>前回の完了日時</dt><dd>{pending.lastDeployment.finishedAt}</dd></>}</dl>
    {readonlyMessage && <p>{readonlyMessage}</p>}{error && <p role="alert">{error}</p>}{(deployment.state === "paused" || deployment.state === "failed") && <p role="alert">{deployment.message}</p>}{workflowUrl && <a href={workflowUrl} target="_blank" rel="noopener noreferrer">GitHub Actionsを開く</a>}
    {pending.deployment ? <><button type="button" disabled={Boolean(readonlyMessage)} onClick={onRecheck}>状態を再確認</button>{deployment.state === "paused" && <button type="button" disabled={Boolean(readonlyMessage)} onClick={onStop}>デプロイ追跡を解除</button>}</> : (deployment.state === "failed" || error) && <button type="button" disabled={Boolean(readonlyMessage)} onClick={onRetry}>再試行</button>}
  </FloatingPanel>}</div>;
}

export function ConflictPanel({ conflict, disabled, onResolve }: { conflict: PendingConflictError["detail"] | null; disabled: boolean; onResolve: (action: "reload" | "discard" | "force") => void }) {
  if (!conflict) return null;
  return <aside className="conflict-bar" role="alert"><div><strong>{conflict.target === "media" ? "メディア情報" : "コンテンツ"}が外部の変更と競合しています</strong><small>現在のrevision: {conflict.currentRevision || "削除済み"}</small></div><div className="button-row"><button disabled={disabled} onClick={() => onResolve("reload")}>GitHub版を再読み込み</button><button disabled={disabled} onClick={() => onResolve("discard")}>保留変更を破棄</button><button disabled={disabled} className="danger" onClick={() => onResolve("force")}>{conflict.operation === "delete" ? "強制削除" : "強制上書き"}</button></div></aside>;
}

export function PendingSummary({ pending }: { pending: PendingChanges }) {
  const count = pending.contents.length + (pending.media ? 1 : 0);
  if (!count) return null;
  return <details className="pending-summary"><summary>未デプロイの変更 {count}件</summary><ul>{pending.contents.map((item) => <li key={item.document.id}>{item.operation === "delete" ? "削除" : item.document.common.publication === "draft" ? "下書き" : "公開"}: {item.document.common.title || "タイトル未設定"}{item.applied ? "（GitHub反映済み）" : ""}</li>)}{pending.media && <li>メディア情報{pending.media.applied ? "（GitHub反映済み）" : ""}</li>}</ul><small>保留内容はこのブラウザだけに保存されます。</small></details>;
}
