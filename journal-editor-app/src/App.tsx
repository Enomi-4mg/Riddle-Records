import { useState } from "react";
import type { RestoreConflictMode, StoredDraft, View } from "./types/journal";
import { createDraft, deleteDraft, downloadBackup, hasDraft, loadDrafts, nowIso, restoreBackup, saveNewDraft, writeDraft } from "./lib/storage";
import { parseImportedMarkdown } from "./lib/markdown";
import { existingJournalArticles } from "./data/existingJournal";
import { DraftList } from "./components/DraftList";
import { EditorScreen } from "./components/EditorScreen";

export function App() {
  const [view, setView] = useState<View>("list");
  const [drafts, setDrafts] = useState<StoredDraft[]>(() => loadDrafts());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [notice, setNotice] = useState("準備できました");

  const currentDraft = drafts.find((draft) => draft.id === currentId) ?? null;

  function refresh() {
    setDrafts(loadDrafts());
  }

  function openDraft(id: string) {
    setCurrentId(id);
    setView("editor");
  }

  function createAndOpen() {
    const draft = createDraft();
    saveNewDraft(draft);
    refresh();
    setCurrentId(draft.id);
    setView("editor");
    setNotice("新しい下書きを作成しました");
  }

  function duplicateDraft(source: StoredDraft) {
    const draft = createDraft({
      frontmatter: { ...source.frontmatter, title: `${source.frontmatter.title || "Untitled"} copy` },
      body: source.body
    });
    saveNewDraft(draft);
    refresh();
    setNotice("下書きを複製しました");
  }

  function removeDraft(id: string) {
    if (!window.confirm("この下書きを削除しますか？")) return;
    deleteDraft(id);
    refresh();
    setNotice("下書きを削除しました");
  }

  function importMarkdown(markdown: string) {
    const importedAt = nowIso();
    const draft = parseImportedMarkdown(markdown, { source: "uploaded", createdAt: importedAt, updatedAt: importedAt, importedAt });
    saveNewDraft(draft);
    refresh();
    setCurrentId(draft.id);
    setView("editor");
    setNotice("Markdownを新しい下書きとして読み込みました");
  }

  function importExistingJournal(overwrite = false) {
    let added = 0;
    let skipped = 0;
    let overwritten = 0;
    for (const article of existingJournalArticles) {
      const exists = hasDraft(article.id);
      if (exists && !overwrite) {
        skipped += 1;
        continue;
      }
      const importedAt = nowIso();
      const draft = parseImportedMarkdown(article.markdown, {
        id: article.id,
        createdAt: importedAt,
        updatedAt: importedAt,
        importedAt,
        source: "imported",
        sourcePath: article.sourcePath,
        sourceFileName: article.filename
      });
      saveNewDraft(draft);
      if (exists) overwritten += 1;
      else added += 1;
    }
    refresh();
    setNotice(overwrite ? `既存Journal記事: ${added}件追加、${overwritten}件上書き、${skipped}件スキップ` : `既存Journal記事: ${added}件追加、${skipped}件スキップ`);
  }

  function saveCurrent(next: StoredDraft) {
    const updated = { ...next, updatedAt: nowIso() };
    writeDraft(updated);
    setDrafts((items) => items.map((item) => item.id === updated.id ? updated : item).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setNotice(`保存しました ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`);
  }

  function backupAllDrafts() {
    const backup = downloadBackup();
    setNotice(`バックアップを書き出しました: ${backup.draftCount}件`);
  }

  function restoreAllDrafts(json: string, mode: RestoreConflictMode) {
    const result = restoreBackup(json, mode);
    refresh();
    const warning = result.legacyDuplicateWarnings ? `、旧ID重複候補${result.legacyDuplicateWarnings}件` : "";
    setNotice(`復元: ${result.added}件追加、${result.overwritten}件上書き、${result.skipped}件スキップ、${result.errors}件エラー${warning}`);
  }

  if (view === "editor" && currentDraft) {
    return (
      <EditorScreen
        draft={currentDraft}
        notice={notice}
        onBack={() => {
          refresh();
          setView("list");
        }}
        onSave={saveCurrent}
        onNotice={setNotice}
      />
    );
  }

  return (
    <DraftList
      drafts={drafts}
      notice={notice}
      onNew={createAndOpen}
      onOpen={openDraft}
      onDuplicate={duplicateDraft}
      onDelete={removeDraft}
      onImport={importMarkdown}
      onImportExisting={() => importExistingJournal(false)}
      onReimportExisting={() => importExistingJournal(true)}
      onBackup={backupAllDrafts}
      onRestore={restoreAllDrafts}
    />
  );
}
