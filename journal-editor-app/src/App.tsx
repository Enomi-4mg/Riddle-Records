import { useCallback, useEffect, useState } from "react";
import type { JournalFileEntry, StoredDraft, View } from "./types/journal";
import type { ContentFileInfo, ContentKind } from "./types/content";
import { contentKindSchemas } from "./types/content";
import { buildMarkdown, createEditorDraft, nowIso, parseImportedMarkdown } from "./lib/markdown";
import { generatedFilename } from "./lib/permalink";
import { ContentFileConflictError, deleteContentFile, loadContentFile, loadContentFiles, saveContentFile } from "./lib/contentFiles";
import { clearUnsavedBackup, loadUnsavedBackup, writeUnsavedBackup } from "./lib/unsavedBackup";
import { DraftList } from "./components/DraftList";
import { EditorScreen } from "./components/EditorScreen";
import { FullPreviewScreen } from "./components/FullPreviewScreen";

const pageStateKey = "riddle-content-editor-page-state";

type PersistedPageState = {
  view: View;
  activeKind: ContentKind;
  currentDraft: StoredDraft | null;
};

function loadPageState(): PersistedPageState | null {
  try {
    const raw = localStorage.getItem(pageStateKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedPageState>;
    if (!parsed.activeKind || !(parsed.activeKind in contentKindSchemas)) return null;
    if (parsed.view !== "list" && parsed.view !== "editor" && parsed.view !== "full-preview") return null;
    return {
      view: parsed.currentDraft ? parsed.view : "list",
      activeKind: parsed.activeKind,
      currentDraft: parsed.currentDraft ?? null
    };
  } catch {
    return null;
  }
}

function writePageState(state: PersistedPageState) {
  try {
    localStorage.setItem(pageStateKey, JSON.stringify(state));
  } catch {
    // Page state is a convenience only. Markdown files and unsaved backups remain the durable sources.
  }
}

function clearPublishHash() {
  if (!window.location.hash.startsWith("#publish-")) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}

export function App() {
  const [restoredPageState] = useState(loadPageState);
  const [view, setView] = useState<View>(restoredPageState?.view ?? "list");
  const [activeKind, setActiveKind] = useState<ContentKind>(restoredPageState?.activeKind ?? "journal");
  const [currentDraft, setCurrentDraft] = useState<StoredDraft | null>(restoredPageState?.currentDraft ?? null);
  const [notice, setNotice] = useState("準備できました");
  const [contentFiles, setContentFiles] = useState<ContentFileInfo[]>([]);
  const [contentEntries, setContentEntries] = useState<JournalFileEntry[]>([]);
  const [contentFileApiAvailable, setContentFileApiAvailable] = useState(false);
  const [conflictDraft, setConflictDraft] = useState<StoredDraft | null>(null);

  useEffect(() => {
    refreshContentFiles(activeKind);
  }, [activeKind]);

  useEffect(() => {
    writePageState({ view, activeKind, currentDraft });
    if (view !== "editor") {
      clearPublishHash();
    }
  }, [view, activeKind, currentDraft]);

  async function refreshContentFiles(kind = activeKind) {
    const result = await loadContentFiles(kind);
    setContentFileApiAvailable(result.available);
    setContentFiles(result.files);
    if (!result.available) {
      setContentEntries([]);
      setNotice("ローカルファイルAPIは利用できません。コピー/ダウンロード運用になります");
      return;
    }

    const entries = await Promise.all(result.files.map(async (fileInfo): Promise<JournalFileEntry | null> => {
      try {
        const filename = fileInfo.path;
        const file = await loadContentFile(kind, filename);
        const importedAt = nowIso();
        return {
          file: { path: file.path, mtimeMs: file.mtimeMs },
          filename,
          draft: parseImportedMarkdown(file.markdown, {
            kind,
            id: `file:${file.path}`,
            createdAt: importedAt,
            updatedAt: importedAt,
            importedAt,
            source: "imported",
            sourcePath: `${contentKindSchemas[kind].directory}/${file.path}`,
            sourceFileName: file.path,
            loadedFilePath: file.path,
            loadedFileMtime: file.mtimeMs
          })
        };
      } catch {
        return null;
      }
    }));
    setContentEntries(entries.filter((entry): entry is JournalFileEntry => Boolean(entry)));
  }

  function createAndOpen() {
    const draft = createEditorDraft({ kind: activeKind, frontmatter: activeKind === "songs" ? { type: "journal", draft: false } : undefined });
    setCurrentDraft(draft);
    setView("editor");
    setNotice(`新しい${contentKindSchemas[activeKind].label} Markdownを作成しました`);
  }

  function importMarkdown(markdown: string, filename?: string) {
    const importedAt = nowIso();
    const draft = parseImportedMarkdown(markdown, {
      kind: activeKind,
      id: filename ? `uploaded:${filename}` : undefined,
      createdAt: importedAt,
      updatedAt: importedAt,
      importedAt,
      source: "uploaded",
      sourceFileName: filename?.endsWith(".md") ? filename : undefined
    });
    const backup = loadUnsavedBackup(draft.id);
    setCurrentDraft(backup && window.confirm("未保存の一時退避データがあります。復元しますか？") ? backup : draft);
    setView("editor");
    setNotice(filename ? `${filename} を読み込みました` : "Markdownを読み込みました");
  }

  async function openContentFile(filename: string, kind = activeKind) {
    try {
      const file = await loadContentFile(kind, filename);
      const importedAt = nowIso();
      const draft = parseImportedMarkdown(file.markdown, {
        kind,
        id: `file:${file.path}`,
        createdAt: importedAt,
        updatedAt: importedAt,
        importedAt,
        source: "imported",
        sourcePath: `${contentKindSchemas[kind].directory}/${file.path}`,
        sourceFileName: file.path,
        loadedFilePath: file.path,
        loadedFileMtime: file.mtimeMs
      });
      const backup = loadUnsavedBackup(draft.id);
      setCurrentDraft(backup && window.confirm("未保存の一時退避データがあります。復元しますか？") ? backup : draft);
      setView("editor");
      setNotice(`${file.path} を読み込みました`);
    } catch (error) {
      setNotice(`読み込みに失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  const updateCurrentDraft = useCallback((next: StoredDraft) => {
    const updated = { ...next, updatedAt: nowIso() };
    setCurrentDraft(updated);
    if (updated.editedAt) {
      writeUnsavedBackup(updated);
    }
  }, []);

  async function saveCurrentToFile(next: StoredDraft, options: { force?: boolean } = {}): Promise<StoredDraft | null> {
    const filename = next.sourceFileName || generatedFilename(next.frontmatter, next.kind);
    if (!filename) {
      setNotice("保存先ファイル名を作れません。dateかslugを確認してください");
      return null;
    }

    try {
      const saved = await saveContentFile(next.kind, filename, buildMarkdown(next), {
        expectedMtime: next.loadedFileMtime,
        force: options.force
      });
      const updated = {
        ...next,
        updatedAt: nowIso(),
        source: "imported" as const,
        sourcePath: `${contentKindSchemas[next.kind].directory}/${filename}`,
        sourceFileName: filename,
        loadedFilePath: saved.path,
        loadedFileMtime: saved.mtimeMs
      };
      setCurrentDraft(updated);
      setConflictDraft(null);
      clearUnsavedBackup(next.id);
      setNotice(`${filename} に保存しました`);
      await refreshContentFiles(next.kind);
      return updated;
    } catch (error) {
      if (error instanceof ContentFileConflictError) {
        setConflictDraft(next);
        setNotice("ファイルが外部で変更されています");
        return null;
      }
      setNotice(`ファイル保存に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`);
      return null;
    }
  }

  async function reloadConflictFile() {
    const filename = conflictDraft?.loadedFilePath || conflictDraft?.sourceFileName;
    if (!filename) return;
    const kind = conflictDraft.kind;
    clearUnsavedBackup(conflictDraft.id);
    setConflictDraft(null);
    await openContentFile(filename, kind);
  }

  async function forceSaveConflictFile(): Promise<StoredDraft | null> {
    const draft = currentDraft || conflictDraft;
    if (!draft) return null;
    return await saveCurrentToFile(draft, { force: true });
  }

  async function deleteCurrentFile(next: StoredDraft) {
    const filename = next.source === "imported" ? next.sourceFileName : undefined;
    if (!filename) {
      setCurrentDraft(null);
      setView("list");
      setNotice("未保存の記事を閉じました");
      return;
    }

    try {
      await deleteContentFile(next.kind, filename);
      setCurrentDraft(null);
      setView("list");
      setNotice(`${filename} を削除しました`);
      await refreshContentFiles(next.kind);
    } catch (error) {
      setNotice(`削除に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  function closeEditor() {
    setCurrentDraft(null);
    setView("list");
  }

  if (view === "editor" && currentDraft) {
    return (
      <EditorScreen
        draft={currentDraft}
        notice={notice}
        onBack={() => {
          closeEditor();
        }}
        onSave={updateCurrentDraft}
        onSaveFile={saveCurrentToFile}
        onDelete={deleteCurrentFile}
        conflictActive={Boolean(conflictDraft)}
        onReloadConflict={reloadConflictFile}
        onForceSaveConflict={forceSaveConflictFile}
        onNotice={setNotice}
        onFullPreview={(draft) => {
          updateCurrentDraft(draft);
          setCurrentDraft(draft);
          setView("full-preview");
        }}
      />
    );
  }

  if (view === "full-preview" && currentDraft) {
    return (
      <FullPreviewScreen
        draft={currentDraft}
        onBack={() => setView("editor")}
      />
    );
  }

  return (
    <DraftList
      activeKind={activeKind}
      contentFiles={contentFiles}
      contentEntries={contentEntries}
      contentFileApiAvailable={contentFileApiAvailable}
      notice={notice}
      onKindChange={setActiveKind}
      onNew={createAndOpen}
      onOpenContentFile={openContentFile}
      onRefreshContentFiles={() => refreshContentFiles(activeKind)}
      onImport={importMarkdown}
    />
  );
}
