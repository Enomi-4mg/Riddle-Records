import { useEffect, useMemo, useState } from "react";
import { ContentFileConflictError, deleteContentFile, loadContentFile, loadContentFiles, saveContentFile } from "./lib/contentFiles";
import { buildContentMarkdown, createContentDocument, generatedContentFilename, parseContentMarkdown } from "./lib/cmsMarkdown";
import { loadMediaRegistry, MediaRegistryConflictError, saveMediaRegistry } from "./lib/mediaRegistry";
import { ContentList } from "./components/ContentList";
import { CmsEditor } from "./components/CmsEditor";
import { MediaLibrary } from "./components/MediaLibrary";
import type { ContentDocument, ContentFileInfo, ContentKind, EditingStatus } from "./types/content";
import type { MediaRegistry } from "./types/media";
import { validateMediaRegistry } from "./types/media";

type Screen = "content" | "editor" | "media";
const emptyRegistry: MediaRegistry = { version: 1, assets: [] };
const backupKey = (id: string) => `riddle-cms-backup:${id}`;

export function App() {
  const [screen, setScreen] = useState<Screen>("content"); const [files, setFiles] = useState<ContentFileInfo[]>([]); const [documents, setDocuments] = useState<ContentDocument[]>([]);
  const [current, setCurrent] = useState<ContentDocument | null>(null); const [editingStatus, setEditingStatus] = useState<EditingStatus>("clean"); const [notice, setNotice] = useState("準備できました");
  const [registry, setRegistry] = useState(emptyRegistry); const [registryRevision, setRegistryRevision] = useState<string>(); const [registrySaving, setRegistrySaving] = useState(false);
  const [conflict, setConflict] = useState<"save" | "delete" | null>(null);

  async function refresh() {
    const result = await loadContentFiles(); setFiles(result.files);
    if (!result.available) { setNotice(result.error || "コンテンツAPIを利用できません"); return; }
    const loaded = await Promise.all(result.files.map(async (file) => { try { const value = await loadContentFile(file.kind, file.path); return parseContentMarkdown(value.markdown, file.kind, { path: file.path, revision: value.revision }); } catch { return null; } }));
    setDocuments(loaded.filter((value): value is ContentDocument => Boolean(value)));
  }
  async function refreshRegistry() { try { const value = await loadMediaRegistry(); setRegistry(value.registry); setRegistryRevision(value.revision); } catch (error) { setNotice(`メディアを読み込めません: ${error instanceof Error ? error.message : "Unknown error"}`); } }
  useEffect(() => { void refresh(); void refreshRegistry(); }, []);

  function openDocument(doc: ContentDocument) {
    const backup = localStorage.getItem(backupKey(doc.id)); let next = doc;
    if (backup && window.confirm("保存されていない編集を復元しますか？")) { try { next = JSON.parse(backup) as ContentDocument; } catch { /* ignore invalid backup */ } }
    setCurrent(next); setEditingStatus(backup ? "dirty" : "clean"); setScreen("editor");
  }
  function changeDocument(next: ContentDocument) { const edited = { ...next, editedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; setCurrent(edited); setEditingStatus("dirty"); localStorage.setItem(backupKey(next.id), JSON.stringify(edited)); }
  async function persist(doc: ContentDocument, force = false) {
    const filename = generatedContentFilename(doc); if (!filename) { setNotice("日付またはslugを入力してください"); setEditingStatus("error"); return null; }
    setEditingStatus("saving");
    try { const saved = await saveContentFile(doc.placement.kind, filename, buildContentMarkdown(doc), { expectedRevision: doc.file?.revision, force }); const next = { ...doc, source: "imported" as const, file: { path: saved.path, revision: saved.revision }, updatedAt: new Date().toISOString() }; setCurrent(next); setEditingStatus("clean"); setConflict(null); localStorage.removeItem(backupKey(doc.id)); setNotice("保存しました"); await refresh(); return next; }
    catch (error) { if (error instanceof ContentFileConflictError) { setConflict("save"); setEditingStatus("conflict"); setNotice("外部で変更されています"); } else { setEditingStatus("error"); setNotice(`保存できません: ${error instanceof Error ? error.message : "Unknown error"}`); } return null; }
  }
  async function reloadCurrent() { if (!current?.file) return; const loaded = await loadContentFile(current.placement.kind, current.file.path); localStorage.removeItem(backupKey(current.id)); setCurrent(parseContentMarkdown(loaded.markdown, current.placement.kind, { path: loaded.path, revision: loaded.revision })); setConflict(null); setEditingStatus("clean"); }
  async function removeCurrent(force = false) { if (!current) return; if (!current.file) { setCurrent(null); setScreen("content"); return; } try { await deleteContentFile(current.placement.kind, current.file.path, { expectedRevision: current.file.revision, force }); localStorage.removeItem(backupKey(current.id)); setCurrent(null); setScreen("content"); setConflict(null); await refresh(); } catch (error) { if (error instanceof ContentFileConflictError) { setConflict("delete"); setEditingStatus("conflict"); } else setNotice(`削除できません: ${error instanceof Error ? error.message : "Unknown error"}`); } }
  async function persistRegistry(force = false) { const validationError = validateMediaRegistry(registry); if (validationError) { setNotice(validationError); return; } setRegistrySaving(true); try { const value = await saveMediaRegistry(registry, registryRevision, force); setRegistryRevision(value.revision); setNotice("メディア情報を保存しました"); } catch (error) { setNotice(error instanceof MediaRegistryConflictError ? "メディア情報が外部で変更されています。再読み込みしてください" : `メディアを保存できません: ${error instanceof Error ? error.message : "Unknown error"}`); } finally { setRegistrySaving(false); } }

  const shellNav = useMemo(() => <nav className="cms-nav"><button className={screen !== "media" ? "active" : ""} onClick={() => { setScreen("content"); setCurrent(null); }}>コンテンツ</button><button className={screen === "media" ? "active" : ""} onClick={() => setScreen("media")}>メディア</button></nav>, [screen]);
  if (screen === "editor" && current) return <CmsEditor document={current} status={editingStatus} notice={notice} registry={registry} conflict={conflict} onChange={changeDocument} onSave={() => persist(current)} onPublish={() => persist({ ...current, common: { ...current.common, publication: "published" } })} onUnpublish={() => persist({ ...current, common: { ...current.common, publication: "draft" } })} onBack={() => { if (editingStatus !== "dirty" || window.confirm("保存していない変更があります。閉じますか？")) { setScreen("content"); setCurrent(null); } }} onReload={reloadCurrent} onForce={() => conflict === "delete" ? removeCurrent(true) : persist(current, true)} onDelete={() => removeCurrent()} />;
  return <main className="cms-shell"><header className="global-bar"><strong className="brand">Riddle Records CMS</strong>{shellNav}<span className="status-pill">{notice}</span></header>{screen === "media" ? <MediaLibrary registry={registry} editable onChange={setRegistry} onSave={() => persistRegistry()} saving={registrySaving} /> : <ContentList documents={documents} files={files} onOpen={openDocument} onNew={(kind: ContentKind) => { const doc = createContentDocument(kind); setCurrent(doc); setEditingStatus("dirty"); setScreen("editor"); }} />}</main>;
}
