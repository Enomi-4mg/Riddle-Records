import { AboutEditor } from "./components/AboutEditor";
import { validateAboutDocument } from "./lib/about";
import { normalizeAboutProfile } from "../../shared/aboutProfile";
import { useEffect, useState } from "react";
import { loadContentFile, loadContentFiles } from "./lib/contentFiles";
import { createContentDocument, generatedContentFilename, parseContentMarkdown } from "./lib/cmsMarkdown";
import { applyPendingChanges, PendingConflictError } from "./lib/deployPending";
import { loadMediaRegistry } from "./lib/mediaRegistry";
import { emptyPending, readPending, upsertPending, writePending, type PendingChanges } from "./lib/pendingChanges";
import { getSiteDeploy, startSiteDeploy } from "./lib/siteDeploy";
import { readArticleDefaults, writeArticleDefaults, type ArticleDefaults } from "./lib/articleDefaults";
import { ContentList } from "./components/ContentList";
import { CmsEditor } from "./components/CmsEditor";
import { MediaLibrary } from "./components/MediaLibrary";
import { ArticleDefaultsDialog } from "./components/ArticleDefaultsDialog";
import type { ContentDocument, ContentFileInfo, ContentKind, EditingStatus } from "./types/content";
import type { MediaRegistry } from "./types/media";

type Screen = "content" | "editor" | "media" | "about";
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
  const [conflict, setConflict] = useState<PendingConflictError["detail"] | null>(null);
  const [tabId] = useState(() => crypto.randomUUID());
  const [otherTab, setOtherTab] = useState(false);
  const [articleDefaults, setArticleDefaults] = useState<ArticleDefaults>(readArticleDefaults);
  const [showArticleDefaults, setShowArticleDefaults] = useState(false);

  function updatePending(next: PendingChanges) {
    writePending(next);
    setPending(next);
    if (next.media?.applied) { setRegistryRevision(next.media.expectedRevision); setRegistry(next.media.registry); }
    const applied = next.contents.filter((item) => item.applied && item.operation === "save");
    if (applied.length) {
      setCurrent((doc) => applied.find((item) => item.document.id === doc?.id)?.document ?? doc);
      setDocuments((items) => overlayPending(items, next));
    }
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
  useEffect(() => {
    const key = "riddle-cms-active-tab";
    const claim = () => {
      let owner: { id: string; at: number } | null = null;
      try { owner = JSON.parse(localStorage.getItem(key) || "null") as { id: string; at: number } | null; } catch { /* Recover invalid lock. */ }
      if (owner && owner.id !== tabId && Date.now() - owner.at < 15000) { setOtherTab(true); setNotice("別のタブでCMSを使用中です。このタブでの編集とデプロイを停止しています"); return; }
      localStorage.setItem(key, JSON.stringify({ id: tabId, at: Date.now() }));
      if (otherTab) { void refresh(); void refreshRegistry(); }
      setOtherTab(false);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) claim();
      if (event.key === "riddle-cms-pending-v1") setPending(readPending());
    };
    claim();
    const timer = window.setInterval(claim, 5000);
    window.addEventListener("storage", onStorage);
    const release = () => { try { const owner = JSON.parse(localStorage.getItem(key) || "null") as { id?: string } | null; if (owner?.id === tabId) localStorage.removeItem(key); } catch { /* Ignore invalid lock. */ } };
    window.addEventListener("beforeunload", release);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", onStorage); window.removeEventListener("beforeunload", release); release(); };
  }, [tabId, otherTab]);

  function openDocument(doc: ContentDocument) {
    setCurrent(doc); setEditingStatus("clean"); setScreen(doc.placement.kind === "about" ? "about" : "editor");
  }
  function stageDocument(doc: ContentDocument) {
    if (otherTab || deploying || pending.deployment) { setNotice(otherTab ? "別のタブでCMSを使用中です" : "進行中のデプロイを確認してから編集してください"); return false; }
    const edited = { ...doc, editedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const next = upsertPending(pending, { document: edited, operation: "save" });
    try { updatePending(next); } catch { setNotice("ブラウザの保存容量が不足しています。変更を保存できません"); return false; }
    setCurrent(edited); setEditingStatus("dirty");
    setDocuments((items) => overlayPending(items, next));
    return true;
  }
  function saveLocally(doc: ContentDocument, force = false) {
    if (!force && editingStatus === "clean") { setNotice("変更はありません"); return; }
    if (doc.placement.kind === "about") {
      const errors = validateAboutDocument(doc, documents);
      if (errors.length) { setNotice(errors.join("; ")); setEditingStatus("error"); return; }
      doc = { ...doc, placement: { kind: "about", data: normalizeAboutProfile(doc.placement.data) } };
    }
    const filename = generatedContentFilename(doc);
    if (!filename) { setNotice("日付またはslugを入力してください"); setEditingStatus("error"); return; }
    if (stageDocument(doc)) { setEditingStatus("clean"); setNotice("ブラウザに保存しました。サイトへの反映にはデプロイが必要です"); }
  }
  function stageDelete() {
    if (!current) return;
    if (otherTab || deploying || pending.deployment) { setNotice(otherTab ? "別のタブでCMSを使用中です" : "進行中のデプロイを確認してから削除してください"); return; }
    const next = current.file ? upsertPending(pending, { document: current, operation: "delete" }) : { ...pending, contents: pending.contents.filter((item) => item.document.id !== current.id) };
    updatePending(next); setDocuments((items) => items.filter((item) => item.id !== current.id));
    setCurrent(null); setScreen("content"); setNotice("削除を保留しました");
  }
  function changeRegistry(next: MediaRegistry) {
    if (otherTab || deploying || pending.deployment) { setNotice(otherTab ? "別のタブでCMSを使用中です" : "進行中のデプロイを確認してから編集してください"); return; }
    const queued = { ...pending, media: { registry: next, expectedRevision: pending.media?.expectedRevision ?? registryRevision } };
    updatePending(queued); setRegistry(next);
  }
  async function resolveConflict(action: "reload" | "discard" | "force") {
    if (!conflict) return;
    if (action === "force") { void deploySite(conflict.target === "media" ? "media" : conflict.documentId); return; }
    const next = conflict.target === "media" ? { ...pending, media: undefined } : { ...pending, contents: pending.contents.filter((item) => item.document.id !== conflict.documentId) };
    updatePending(next); setConflict(null); setEditingStatus("clean");
    if (conflict.target === "content") {
      const item = pending.contents.find((entry) => entry.document.id === conflict.documentId);
      if (item) {
        try {
          const value = await loadContentFile(item.document.placement.kind, generatedContentFilename(item.document));
          setCurrent(parseContentMarkdown(value.markdown, item.document.placement.kind, { path: value.path, revision: value.revision }));
        } catch { setCurrent(null); setScreen("content"); }
      }
    }
    if (conflict.target === "media") await refreshRegistry();
    await refresh(); setNotice(action === "reload" ? "GitHub版を再読み込みしました" : "保留変更を破棄しました");
  }
  async function deploySite(forceTarget?: string) {
    if (deploying || otherTab) return;
    setDeploying(true);
    let queue = readPending();
    try {
      if (!queue.deployment) {
        const merged = overlayPending(documents, queue);
        const about = merged.find((doc) => doc.placement.kind === "about");
        if (about) { const errors = validateAboutDocument(about, merged); if (errors.length) throw new Error(errors.join("; ")); }
        queue = await applyPendingChanges(queue, updatePending, undefined, forceTarget);
        setConflict(null);
        if (queue.media?.applied) setRegistryRevision(queue.media.expectedRevision);
        const deploymentId = crypto.randomUUID();
        const started = await startSiteDeploy(deploymentId, queue.lastCommitSha);
        queue = { ...queue, deployment: { id: deploymentId, sha: started.sha, startedAt: new Date().toISOString() } };
        updatePending(queue);
        if (started.local) { updatePending(emptyPending()); setNotice("ローカルファイルに反映しました"); await refresh(); return; }
      }
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const result = await getSiteDeploy(queue.deployment!.id, queue.deployment!.startedAt);
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
      if (error instanceof PendingConflictError) { setConflict(error.detail); setEditingStatus("conflict"); }
      setNotice(`デプロイできません: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally { setDeploying(false); }
  }

  const pendingCount = pending.contents.length + (pending.media ? 1 : 0);
  const deployButton = <><button type="button" disabled={otherTab} onClick={() => setShowArticleDefaults(true)}>デフォルト設定</button><button className="primary" disabled={deploying || otherTab} onClick={() => void deploySite()}>{deploying ? "デプロイ中…" : `記事をデプロイ${pendingCount ? ` (${pendingCount})` : ""}`}</button>{showArticleDefaults && <ArticleDefaultsDialog value={articleDefaults} registry={registry} onClose={() => setShowArticleDefaults(false)} onSave={(value) => { try { writeArticleDefaults(value); setArticleDefaults(value); setShowArticleDefaults(false); setNotice("記事のデフォルト設定を保存しました"); } catch { setNotice("ブラウザにデフォルト設定を保存できませんでした"); } }} />}</>;
  const shellNav = <nav className="cms-nav"><button className={(screen === "content" || screen === "editor") ? "active" : ""} onClick={() => { setScreen("content"); setCurrent(null); }}>コンテンツ</button><button className={screen === "about" ? "active" : ""} onClick={() => { const doc = documents.find((item) => item.placement.kind === "about"); if (doc) openDocument(doc); else setNotice("Aboutを読み込めません。接続を確認して再読み込みしてください"); }}>About</button><button className={screen === "media" ? "active" : ""} onClick={() => setScreen("media")}>メディア</button></nav>;
  if (screen === "editor" && current) return <CmsEditor documents={documents} document={current} status={editingStatus} notice={notice} deployButton={deployButton} registry={registry} conflict={conflict} onChange={stageDocument} onSave={() => saveLocally(current)} onPublish={() => saveLocally({ ...current, common: { ...current.common, publication: "published" } }, true)} onUnpublish={() => saveLocally({ ...current, common: { ...current.common, publication: "draft" } }, true)} onBack={() => { setScreen("content"); setCurrent(null); }} onReload={() => void resolveConflict("reload")} onDiscard={() => void resolveConflict("discard")} onForce={() => void resolveConflict("force")} onDelete={stageDelete} />;
  return <main className="cms-shell"><header className="global-bar"><strong className="brand">Riddle Records CMS</strong>{shellNav}<span className="status-pill global-notice">{notice}</span><div className="deploy-action">{deployButton}</div></header>{(pendingCount > 0 || pending.deployment) && <aside className="pending-summary"><strong>未デプロイの変更 {pendingCount}件</strong><ul>{pending.contents.map((item) => <li key={item.document.id}>{item.operation === "delete" ? "削除" : item.document.common.publication === "draft" ? "下書き" : "公開"}: {item.document.common.title || "タイトル未設定"}{item.applied ? "（GitHub反映済み）" : ""}</li>)}{pending.media && <li>メディア情報{pending.media.applied ? "（GitHub反映済み）" : ""}</li>}</ul>{pending.deployment && <button type="button" disabled={deploying} onClick={() => { updatePending({ ...pending, deployment: undefined }); setNotice("デプロイ追跡を解除しました。GitHub側の公開状況を確認してください"); }}>デプロイ追跡を解除</button>}{conflict && <div className="conflict-bar"><strong>{conflict.target === "media" ? "メディア情報" : "コンテンツ"}が競合しています</strong><div className="button-row"><button onClick={() => void resolveConflict("reload")}>GitHub版を再読み込み</button><button onClick={() => void resolveConflict("discard")}>保留変更を破棄</button><button className="danger" onClick={() => void resolveConflict("force")}>強制上書き</button></div></div>}<small>保留内容はこのブラウザだけに保存されます。</small></aside>}{screen === "about" && current?.placement.kind === "about" ? <AboutEditor document={current} documents={documents} registry={registry} disabled={otherTab || deploying || Boolean(pending.deployment)} onChange={stageDocument} onSave={() => saveLocally(current)} /> : screen === "media" ? <MediaLibrary registry={registry} editable onChange={changeRegistry} onSave={() => setNotice("メディア情報をブラウザに保存しました")} saving={deploying} /> : <ContentList documents={documents} files={files.filter((file) => file.kind !== "about")} pendingIds={pending.contents.filter((item) => item.operation === "save").map((item) => item.document.id)} onOpen={openDocument} onNew={(kind: ContentKind) => { const doc = createContentDocument(kind); if (doc.placement.kind === "journal") doc.placement.data = { ...doc.placement.data, ...articleDefaults }; if (!stageDocument(doc)) return; setCurrent(doc); setEditingStatus("dirty"); setScreen("editor"); }} />}</main>;
}
