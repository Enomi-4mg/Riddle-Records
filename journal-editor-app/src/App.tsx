import { useEffect, useState } from "react";
import { normalizeAboutProfile } from "../../shared/aboutProfile";
import { AboutEditor } from "./components/AboutEditor";
import { ArticleDefaultsDialog } from "./components/ArticleDefaultsDialog";
import { CmsEditor } from "./components/CmsEditor";
import { ContentList } from "./components/ContentList";
import { MediaLibrary } from "./components/MediaLibrary";
import { ConflictPanel, Notice, PendingSummary, StatusControl } from "./components/CmsFeedback";
import { useCmsNavigation } from "./hooks/useCmsNavigation";
import { useContentDocuments, overlayPending } from "./hooks/useContentDocuments";
import { useConflict } from "./hooks/useConflict";
import { useDeployment } from "./hooks/useDeployment";
import { useMediaRegistry } from "./hooks/useMediaRegistry";
import { useNotice } from "./hooks/useNotice";
import { usePendingQueue } from "./hooks/usePendingQueue";
import { useTabLock } from "./hooks/useTabLock";
import { validateAboutDocument } from "./lib/about";
import { readArticleDefaults, writeArticleDefaults, type ArticleDefaults } from "./lib/articleDefaults";
import { createContentDocument, generatedContentFilename } from "./lib/cmsMarkdown";
import { applyPendingChanges, PendingConflictError } from "./lib/deployPending";
import { readPending, upsertPending } from "./lib/pendingChanges";
import { publishDocument } from "./lib/publication";
import { startSiteDeploy } from "./lib/siteDeploy";
import type { ContentDocument, ContentKind, EditingStatus } from "./types/content";
import type { MediaRegistry } from "./types/media";

export function App() {
  const { screen, documentId, filters, navigate, setFilters } = useCmsNavigation();
  const { pending, updatePending, externalRevision } = usePendingQueue();
  const content = useContentDocuments(pending);
  const media = useMediaRegistry(pending);
  const { documents, files } = content;
  const { registry } = media;
  const { notice, notify, dismiss } = useNotice();
  const [current, setCurrent] = useState<ContentDocument | null>(null);
  const [editingStatus, setEditingStatus] = useState<EditingStatus>("clean");
  const [articleDefaults, setArticleDefaults] = useState<ArticleDefaults>(readArticleDefaults);
  const [showArticleDefaults, setShowArticleDefaults] = useState(false);
  const refreshAll = async () => { await Promise.all([content.refresh(), media.refresh()]); };
  const tabLock = useTabLock(() => { void refreshAll(); });
  const deployment = useDeployment({ pending, updatePending, enabled: !tabLock.blocked, onRefresh: refreshAll });
  const deploying = deployment.state.state === "syncing-github" || deployment.state.state === "waiting";
  const blocked = tabLock.blocked || deploying || Boolean(pending.deployment);
  const conflicts = useConflict({ enabled: !blocked, updatePending, onDocument: (doc) => {
    setCurrent(doc); setEditingStatus("clean");
    if (doc) navigate(doc.placement.kind === "about" ? "about" : "editor", doc.id, true);
    else navigate("content", undefined, true);
  }, onRefresh: refreshAll, onForce: (target) => { void deploySite(target); } });
  const { conflict } = conflicts;

  useEffect(() => { if (externalRevision) void refreshAll(); }, [externalRevision]);
  useEffect(() => {
    if (screen !== "editor" && screen !== "about") { setCurrent(null); return; }
    const doc = documents.find((item) => item.id === documentId || (screen === "about" && item.placement.kind === "about"));
    const match = doc ?? documents.find((item) => current?.file && item.placement.kind === current.placement.kind && item.file?.path === current.file.path);
    if (match && match !== current) {
      setCurrent(match);
      if (match.id !== current?.id) setEditingStatus("clean");
      if (match.id !== documentId) navigate(screen, match.id, true);
    }
  }, [screen, documentId, documents, current?.id]);

  function openDocument(doc: ContentDocument) {
    setCurrent(doc); setEditingStatus("clean"); navigate(doc.placement.kind === "about" ? "about" : "editor", doc.id);
  }
  function canEdit() {
    if (!blocked && tabLock.isOwner() && !readPending().deployment) return true;
    notify(tabLock.message || "進行中のデプロイを確認してから編集してください", "error"); return false;
  }
  function stageDocument(doc: ContentDocument) {
    if (!canEdit()) return false;
    const edited = { ...doc, editedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    try { updatePending(upsertPending(readPending(), { document: edited, operation: "save" })); }
    catch { setEditingStatus("error"); notify("ブラウザの保存容量が不足しています。変更を保存できません", "error"); return false; }
    setCurrent(edited); setEditingStatus("clean"); return true;
  }
  function confirmContent(doc: ContentDocument, force = false) {
    if (doc.placement.kind === "about") {
      const errors = validateAboutDocument(doc, documents);
      if (errors.length) { notify(errors.join("; "), "error"); setEditingStatus("error"); return; }
      doc = { ...doc, placement: { kind: "about", data: normalizeAboutProfile(doc.placement.data) } };
    }
    if (!generatedContentFilename(doc)) { notify("日付またはslugを入力してください", "error"); setEditingStatus("error"); return; }
    if (force && !stageDocument(doc)) return;
    setEditingStatus("clean"); notify("入力を確認しました。変更はブラウザに自動保存されています。サイトへの反映は別操作です");
  }
  function stageDelete() {
    if (!current || !canEdit()) return;
    const queue = readPending();
    const next = current.file ? upsertPending(queue, { document: current, operation: "delete" }) : { ...queue, contents: queue.contents.filter((item) => item.document.id !== current.id) };
    try { updatePending(next); setCurrent(null); navigate("content"); notify("削除を保留しました"); }
    catch { notify("削除をブラウザに保存できませんでした", "error"); }
  }
  function changeRegistry(next: MediaRegistry) {
    if (!canEdit()) return;
    const queue = readPending();
    try { updatePending({ ...queue, media: { registry: next, expectedRevision: queue.media?.expectedRevision ?? media.revision } }); }
    catch { notify("メディア情報をブラウザに保存できませんでした", "error"); }
  }
  async function resolveConflict(action: "reload" | "discard" | "force") {
    try {
      await conflicts.resolve(action);
      if (action !== "force") { deployment.clearError(); setEditingStatus("clean"); notify(action === "reload" ? "GitHub版を再読み込みしました" : "保留変更を破棄しました"); }
    } catch (error) { notify(error instanceof Error ? error.message : "競合を解消できません", "error"); }
  }
  async function deploySite(forceTarget?: string) {
    if (tabLock.blocked || !tabLock.isOwner()) return;
    if (readPending().deployment) { deployment.recheck(); return; }
    if (deploying || !deployment.beginSync()) return;
    let queue = readPending();
    try {
      const merged = overlayPending(documents, queue);
      const about = merged.find((doc) => doc.placement.kind === "about");
      if (about) { const errors = validateAboutDocument(about, merged); if (errors.length) throw new Error(errors.join("; ")); }
      queue = await applyPendingChanges(queue, updatePending, undefined, forceTarget);
      conflicts.setConflict(null);
      const deploymentId = crypto.randomUUID();
      const started = await startSiteDeploy(deploymentId, queue.lastCommitSha);
      if (started.local) { await deployment.finishLocal(); notify("ローカルファイルに反映しました"); return; }
      updatePending({ ...queue, deployment: { id: deploymentId, sha: started.sha, startedAt: new Date().toISOString() } });
    } catch (error) {
      if (error instanceof PendingConflictError) { conflicts.setConflict(error.detail); setEditingStatus("conflict"); }
      const message = `デプロイできません: ${error instanceof Error ? error.message : "Unknown error"}`;
      deployment.fail(message); notify(message, "error");
    } finally { deployment.endSync(); }
  }

  const pendingCount = pending.contents.length + (pending.media ? 1 : 0);
  const statusControl = <StatusControl pending={pending} deployment={deployment.state} document={current} editing={editingStatus} conflict={Boolean(conflict)} error={content.error || media.error} readonlyMessage={tabLock.message} registryRevision={media.revision} onRecheck={deployment.recheck} onRetry={() => { if (content.error || media.error) void refreshAll(); else void deploySite(); }} onStop={() => { deployment.stopTracking(); notify("デプロイ追跡を解除しました。GitHub側の公開状況を確認してください"); }} />;
  const feedback = <><Notice value={notice} onDismiss={dismiss} /><ConflictPanel conflict={conflict} disabled={blocked} onResolve={(action) => void resolveConflict(action)} /><PendingSummary pending={pending} /></>;
  const deployButton = <><button type="button" disabled={tabLock.blocked} onClick={() => setShowArticleDefaults(true)}>デフォルト設定</button><button className="primary" disabled={deploying || tabLock.blocked} onClick={() => void deploySite()}>{deploying ? "デプロイ中…" : `保留変更をサイトに反映${pendingCount ? ` (${pendingCount})` : ""}`}</button>{showArticleDefaults && <ArticleDefaultsDialog value={articleDefaults} registry={registry} onClose={() => setShowArticleDefaults(false)} onSave={(value) => { try { writeArticleDefaults(value); setArticleDefaults(value); setShowArticleDefaults(false); notify("記事のデフォルト設定を保存しました"); } catch { notify("ブラウザにデフォルト設定を保存できませんでした", "error"); } }} />}</>;
  const shellNav = <nav className="cms-nav"><button className={(screen === "content" || screen === "editor") ? "active" : ""} onClick={() => navigate("content")}>コンテンツ</button><button className={screen === "about" ? "active" : ""} onClick={() => { const doc = documents.find((item) => item.placement.kind === "about"); if (doc) openDocument(doc); else notify("Aboutを読み込めません。接続を確認して再読み込みしてください", "error"); }}>About</button><button className={screen === "media" ? "active" : ""} onClick={() => navigate("media")}>メディア</button></nav>;
  if (screen === "editor" && current) return <CmsEditor documents={documents} document={current} statusControl={statusControl} feedback={feedback} disabled={blocked} deployButton={deployButton} registry={registry} onChange={stageDocument} onSave={() => confirmContent(current)} onPublish={() => confirmContent(publishDocument(current), true)} onUnpublish={() => confirmContent({ ...current, common: { ...current.common, publication: "draft" } }, true)} onBack={() => navigate("content")} onDelete={stageDelete} />;
  return <main className="cms-shell"><header className="global-bar"><strong className="brand">Riddle Records CMS</strong>{shellNav}{statusControl}<div className="deploy-action">{deployButton}</div></header>{feedback}{screen === "about" && current?.placement.kind === "about" ? <AboutEditor document={current} documents={documents} registry={registry} disabled={blocked} onChange={stageDocument} onSave={() => confirmContent(current)} /> : screen === "media" ? <MediaLibrary registry={registry} editable={!blocked} onChange={changeRegistry} /> : <ContentList filters={filters} onFilters={setFilters} documents={documents} files={files.filter((file) => file.kind !== "about")} disabled={blocked} pendingIds={pending.contents.filter((item) => item.operation === "save").map((item) => item.document.id)} onOpen={openDocument} onNew={(kind: ContentKind) => { const doc = createContentDocument(kind); if (doc.placement.kind === "journal") doc.placement.data = { ...doc.placement.data, ...articleDefaults }; if (!stageDocument(doc)) return; setCurrent(doc); setEditingStatus("clean"); navigate("editor", doc.id); }} />}</main>;
}
