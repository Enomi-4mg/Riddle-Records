import { useEffect, useState } from "react";
import { loadContentFile, loadContentFiles } from "./lib/contentFiles";
import { buildContentMarkdown, createContentDocument, generatedContentFilename, parseContentMarkdown } from "./lib/cmsMarkdown";
import { applyPendingChanges } from "./lib/deployPending";
import { loadMediaRegistry } from "./lib/mediaRegistry";
import { emptyPending, readPending, upsertPending, writePending, type PendingChanges } from "./lib/pendingChanges";
import { getSiteDeploy, startSiteDeploy } from "./lib/siteDeploy";
import { ContentList } from "./components/ContentList";
import { CmsEditor } from "./components/CmsEditor";
import { MediaLibrary } from "./components/MediaLibrary";
import type { ContentDocument, ContentFileInfo, ContentKind, EditingStatus } from "./types/content";
import type { MediaRegistry } from "./types/media";

type Screen = "content" | "editor" | "media";
const emptyRegistry: MediaRegistry = { version: 1, assets: [] };

export function App() {
  const [screen, setScreen] = useState<Screen>("content");
  const [files, setFiles] = useState<ContentFileInfo[]>([]);
  const [documents, setDocuments] = useState<ContentDocument[]>([]);
  const [current, setCurrent] = useState<ContentDocument | null>(null);
  const [editingStatus, setEditingStatus] = useState<EditingStatus>("clean");
  const [notice, setNotice] = useState("準備できました");
  const [registry, setRegistry] = useState(emptyRegistry);
  const [registryRevision, setRegistryRevision] = useState<string>();
  const [pending, setPending] = useState<PendingChanges>(readPending);
  const [deploying, setDeploying] = useState(false);
  const [conflict, setConflict] = useState<"save" | "delete" | null>(null);

  function updatePending(next: PendingChanges) {
    writePending(next);
    setPending(next);
  }
  function overlayPending(loaded: ContentDocument[], queue = readPending()) {
    const byId = new Map(loaded.map((doc) => [doc.id, doc]));
    for (const item of queue.contents) {
      if (item.operation === "delete") byId.delete(item.document.id);
      else byId.set(item.document.id, item.document);
    }
    return [...byId.values()];
  }
  async function refresh() {
    const result = await loadContentFiles(); setFiles(result.files);
    if (!result.available) { setNotice(result.error || "コンテンツAPIを利用できません"); return; }
    const loaded = await Promise.all(result.files.map(async (file) => { try { const value = await loadContentFile(file.kind, file.path); return parseContentMarkdown(value.markdown, file.kind, { path: file.path, revision: value.revision }); } catch { return null; } }));
    setDocuments(overlayPending(loaded.filter((value): value is ContentDocument => Boolean(value))));
  }
  async function refreshRegistry() {
    try {
      const value = await loadMediaRegistry();
      setRegistry(readPending().media?.registry ?? value.registry);
      setRegistryRevision(value.revision);
    } catch (error) { setNotice(`メディアを読み込めません: ${error instanceof Error ? error.message : "Unknown error"}`); }
  }
  useEffect(() => { void refresh(); void refreshRegistry(); }, []);

  function openDocument(doc: ContentDocument) {
    const backup = localStorage.getItem(`riddle-cms-backup:${doc.id}`);
    if (backup && !pending.contents.some((item) => item.document.id === doc.id) && window.confirm("以前の未保存編集を復元しますか？")) {
      try { doc = JSON.parse(backup) as ContentDocument; stageDocument(doc); } catch { /* Keep the current document. */ }
    }
    setCurrent(doc); setEditingStatus("clean"); setScreen("editor");
  }
  function stageDocument(doc: ContentDocument) {
    if (deploying || pending.deployment) { setNotice("進行中のデプロイを確認してから編集してください"); return false; }
    const edited = { ...doc, editedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const next = upsertPending(pending, { document: edited, operation: "save" });
    try { updatePending(next); } catch { setNotice("ブラウザの保存容量が不足しています。変更を保存できません"); return false; }
    setCurrent(edited); setEditingStatus("dirty");
    setDocuments((items) => overlayPending(items, next));
    return true;
  }
  function saveLocally(doc: ContentDocument, force = false) {
    if (!force && editingStatus === "clean") { setNotice("変更はありません"); return; }
    const filename = generatedContentFilename(doc);
    if (!filename) { setNotice("日付またはslugを入力してください"); setEditingStatus("error"); return; }
    if (stageDocument(doc)) { setEditingStatus("clean"); setNotice("ブラウザに保存しました。サイトへの反映にはデプロイが必要です"); }
  }
  function stageDelete() {
    if (!current) return;
    if (deploying || pending.deployment) { setNotice("進行中のデプロイを確認してから削除してください"); return; }
    const next = current.file ? upsertPending(pending, { document: current, operation: "delete" }) : { ...pending, contents: pending.contents.filter((item) => item.document.id !== current.id) };
    updatePending(next); setDocuments((items) => items.filter((item) => item.id !== current.id));
    setCurrent(null); setScreen("content"); setNotice("削除を保留しました");
  }
  function changeRegistry(next: MediaRegistry) {
    if (deploying || pending.deployment) { setNotice("進行中のデプロイを確認してから編集してください"); return; }
    const queued = { ...pending, media: { registry: next, expectedRevision: pending.media?.expectedRevision ?? registryRevision } };
    updatePending(queued); setRegistry(next);
  }
  async function deploySite() {
    if (deploying) return;
    setDeploying(true);
    let queue = readPending();
    try {
      if (!queue.deployment) {
        queue = await applyPendingChanges(queue, updatePending);
        const deploymentId = crypto.randomUUID();
        const started = await startSiteDeploy(deploymentId, queue.lastCommitSha);
        queue = { ...queue, deployment: { id: deploymentId, sha: started.sha } };
        updatePending(queue);
        if (started.local) { updatePending(emptyPending()); setNotice("ローカルファイルに反映しました"); await refresh(); return; }
      }
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const result = await getSiteDeploy(queue.deployment!.id);
        if (result.status === "completed") {
          if (result.conclusion !== "success") { updatePending({ ...queue, deployment: undefined }); throw new Error(`サイトのデプロイに失敗しました: ${result.url || result.conclusion}`); }
          updatePending(emptyPending()); setNotice(`サイトを公開しました: ${result.url || queue.deployment!.sha}`);
          await refresh(); await refreshRegistry(); return;
        }
        setNotice(`記事をデプロイ中: ${result.url || queue.deployment!.sha}`);
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }
      setNotice("デプロイの完了確認がタイムアウトしました。再度ボタンを押して状態を確認してください");
    } catch (error) {
      setNotice(`デプロイできません: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally { setDeploying(false); }
  }

  const pendingCount = pending.contents.length + (pending.media ? 1 : 0);
  const deployButton = <button className="primary" disabled={deploying} onClick={() => void deploySite()}>{deploying ? "デプロイ中…" : `記事をデプロイ${pendingCount ? ` (${pendingCount})` : ""}`}</button>;
  const shellNav = <nav className="cms-nav"><button className={screen !== "media" ? "active" : ""} onClick={() => { setScreen("content"); setCurrent(null); }}>コンテンツ</button><button className={screen === "media" ? "active" : ""} onClick={() => setScreen("media")}>メディア</button></nav>;
  if (screen === "editor" && current) return <CmsEditor document={current} status={editingStatus} notice={notice} deployButton={deployButton} registry={registry} conflict={conflict} onChange={stageDocument} onSave={() => saveLocally(current)} onPublish={() => saveLocally({ ...current, common: { ...current.common, publication: "published" } }, true)} onUnpublish={() => saveLocally({ ...current, common: { ...current.common, publication: "draft" } }, true)} onBack={() => { setScreen("content"); setCurrent(null); }} onReload={() => { if (current.file) void loadContentFile(current.placement.kind, current.file.path).then((value) => { const next = { ...pending, contents: pending.contents.filter((item) => item.document.id !== current.id) }; updatePending(next); setCurrent(parseContentMarkdown(value.markdown, current.placement.kind, { path: value.path, revision: value.revision })); void refresh(); }); }} onForce={() => saveLocally(current, true)} onDelete={stageDelete} />;
  return <main className="cms-shell"><header className="global-bar"><strong className="brand">Riddle Records CMS</strong>{shellNav}<span className="status-pill global-notice">{notice}</span><div className="deploy-action">{deployButton}</div></header>{pendingCount > 0 && <aside className="pending-summary"><strong>未デプロイの変更 {pendingCount}件</strong><ul>{pending.contents.map((item) => <li key={item.document.id}>{item.operation === "delete" ? "削除" : item.document.common.publication === "draft" ? "下書き" : "公開"}: {item.document.common.title || "タイトル未設定"}{item.applied ? "（GitHub反映済み）" : ""}</li>)}{pending.media && <li>メディア情報{pending.media.applied ? "（GitHub反映済み）" : ""}</li>}</ul><small>保留内容はこのブラウザだけに保存されます。</small></aside>}{screen === "media" ? <MediaLibrary registry={registry} editable onChange={changeRegistry} onSave={() => setNotice("メディア情報をブラウザに保存しました")} saving={deploying} /> : <ContentList documents={documents} files={files} pendingIds={pending.contents.filter((item) => item.operation === "save").map((item) => item.document.id)} onOpen={openDocument} onNew={(kind: ContentKind) => { const doc = createContentDocument(kind); if (!stageDocument(doc)) return; setCurrent(doc); setEditingStatus("dirty"); setScreen("editor"); }} />}</main>;
}
