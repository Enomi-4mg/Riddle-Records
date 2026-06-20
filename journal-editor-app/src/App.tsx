import { useCallback, useEffect, useState } from "react";
import type { JournalFileEntry, StoredDraft, View } from "./types/journal";
import { buildMarkdown, createEditorDraft, nowIso, parseImportedMarkdown } from "./lib/markdown";
import { generatedFilename } from "./lib/permalink";
import { deleteJournalFile, JournalFileConflictError, loadJournalFile, loadJournalFiles, saveJournalFile } from "./lib/journalFiles";
import { clearUnsavedBackup, loadUnsavedBackup, writeUnsavedBackup } from "./lib/unsavedBackup";
import { DraftList } from "./components/DraftList";
import { EditorScreen } from "./components/EditorScreen";

export function App() {
  const [view, setView] = useState<View>("list");
  const [currentDraft, setCurrentDraft] = useState<StoredDraft | null>(null);
  const [notice, setNotice] = useState("準備できました");
  const [journalFiles, setJournalFiles] = useState<string[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalFileEntry[]>([]);
  const [journalFileApiAvailable, setJournalFileApiAvailable] = useState(false);
  const [conflictDraft, setConflictDraft] = useState<StoredDraft | null>(null);

  useEffect(() => {
    refreshJournalFiles();
  }, []);

  async function refreshJournalFiles() {
    const result = await loadJournalFiles();
    setJournalFileApiAvailable(result.available);
    setJournalFiles(result.files.map((file) => file.path));
    if (!result.available) {
      setJournalEntries([]);
      setNotice("ローカルファイルAPIは利用できません。コピー/ダウンロード運用になります");
      return;
    }

    const entries = await Promise.all(result.files.map(async (fileInfo): Promise<JournalFileEntry | null> => {
      try {
        const filename = fileInfo.path;
        const file = await loadJournalFile(filename);
        const importedAt = nowIso();
        return {
          file: { path: file.path, mtimeMs: file.mtimeMs },
          filename,
          draft: parseImportedMarkdown(file.markdown, {
            id: `file:${file.path}`,
            createdAt: importedAt,
            updatedAt: importedAt,
            importedAt,
            source: "imported",
            sourcePath: `src/content/journal/${file.path}`,
            sourceFileName: file.path,
            loadedFilePath: file.path,
            loadedFileMtime: file.mtimeMs
          })
        };
      } catch {
        return null;
      }
    }));
    setJournalEntries(entries.filter((entry): entry is JournalFileEntry => Boolean(entry)));
  }

  function createAndOpen() {
    const draft = createEditorDraft();
    setCurrentDraft(draft);
    setView("editor");
    setNotice("新しいMarkdownを作成しました。保存するとsrc/content/journalに書き出します");
  }

  function importMarkdown(markdown: string, filename?: string) {
    const importedAt = nowIso();
    const draft = parseImportedMarkdown(markdown, {
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

  async function openJournalFile(filename: string) {
    try {
      const file = await loadJournalFile(filename);
      const importedAt = nowIso();
      const draft = parseImportedMarkdown(file.markdown, {
        id: `file:${file.path}`,
        createdAt: importedAt,
        updatedAt: importedAt,
        importedAt,
        source: "imported",
        sourcePath: `src/content/journal/${file.path}`,
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
    writeUnsavedBackup(updated);
  }, []);

  async function saveCurrentToFile(next: StoredDraft, options: { force?: boolean } = {}) {
    const filename = next.sourceFileName || generatedFilename(next.frontmatter);
    if (!filename) {
      setNotice("保存先ファイル名を作れません。dateかslugを確認してください");
      return;
    }

    try {
      const saved = await saveJournalFile(filename, buildMarkdown(next), {
        expectedMtime: next.loadedFileMtime,
        force: options.force
      });
      const updated = {
        ...next,
        updatedAt: nowIso(),
        source: "imported" as const,
        sourcePath: `src/content/journal/${filename}`,
        sourceFileName: filename,
        loadedFilePath: saved.path,
        loadedFileMtime: saved.mtimeMs
      };
      setCurrentDraft(updated);
      setConflictDraft(null);
      clearUnsavedBackup(next.id);
      setNotice(`${filename} に保存しました`);
      await refreshJournalFiles();
    } catch (error) {
      if (error instanceof JournalFileConflictError) {
        setConflictDraft(next);
        setNotice("ファイルが外部で変更されています");
        return;
      }
      setNotice(`ファイル保存に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function reloadConflictFile() {
    const filename = conflictDraft?.loadedFilePath || conflictDraft?.sourceFileName;
    if (!filename) return;
    clearUnsavedBackup(conflictDraft.id);
    setConflictDraft(null);
    await openJournalFile(filename);
  }

  async function forceSaveConflictFile() {
    const draft = currentDraft || conflictDraft;
    if (!draft) return;
    await saveCurrentToFile(draft, { force: true });
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
      await deleteJournalFile(filename);
      setCurrentDraft(null);
      setView("list");
      setNotice(`${filename} を削除しました`);
      await refreshJournalFiles();
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
      />
    );
  }

  return (
    <DraftList
      journalFiles={journalFiles}
      journalEntries={journalEntries}
      journalFileApiAvailable={journalFileApiAvailable}
      notice={notice}
      onNew={createAndOpen}
      onOpenJournalFile={openJournalFile}
      onRefreshJournalFiles={refreshJournalFiles}
      onImport={importMarkdown}
    />
  );
}
