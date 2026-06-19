import { useRef } from "react";
import type { RestoreConflictMode, StoredDraft } from "../types/journal";
import { downloadDraft } from "../lib/markdown";
import { generatedFilename } from "../lib/permalink";
import { publishChecks } from "../lib/validation";
import { getArticleState, getArticleStateLabel } from "../lib/articleState";
import { formatDateTime } from "./shared";

export function DraftList({ drafts, notice, onNew, onOpen, onDuplicate, onDelete, onImport, onImportExisting, onReimportExisting, onBackup, onRestore }: {
  drafts: StoredDraft[];
  notice: string;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDuplicate: (draft: StoredDraft) => void;
  onDelete: (id: string) => void;
  onImport: (markdown: string) => void;
  onImportExisting: () => void;
  onReimportExisting: () => void;
  onBackup: () => void;
  onRestore: (json: string, mode: RestoreConflictMode) => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  async function handleImport(file: File | undefined) {
    if (!file) return;
    onImport(await file.text());
    if (importRef.current) importRef.current.value = "";
  }

  async function handleRestore(file: File | undefined) {
    if (!file) return;
    const selected = window.prompt("復元モードを入力してください: skip / overwrite / duplicate", "skip");
    const mode: RestoreConflictMode = selected === "overwrite" || selected === "duplicate" ? selected : "skip";
    onRestore(await file.text(), mode);
    if (restoreRef.current) restoreRef.current.value = "";
  }

  return (
    <main className="list-shell">
      <header className="global-bar">
        <strong className="brand">Riddle Journal</strong>
        <div className="bar-actions">
          <span className="status-pill">{notice}</span>
          <button onClick={onImportExisting}>既存記事を一括インポート</button>
          <button onClick={onReimportExisting}>再インポートして上書き</button>
          <input ref={importRef} className="visually-hidden" type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={(event) => handleImport(event.target.files?.[0])} />
          <input ref={restoreRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => handleRestore(event.target.files?.[0])} />
          <button onClick={() => importRef.current?.click()}>Markdown import</button>
          <button onClick={onBackup}>全下書きバックアップ</button>
          <button onClick={() => restoreRef.current?.click()}>JSON復元</button>
          <button className="primary" onClick={onNew}>新規作成</button>
        </div>
      </header>

      <section className="list-layout">
        <aside className="list-nav">
          <h1>記事</h1>
          <a className="active">自分の下書き</a>
          <a>最近編集</a>
          <a>書き出し</a>
        </aside>

        <section className="draft-card">
          <div className="draft-card-header">
            <strong>{drafts.length} drafts</strong>
            <span>localStorageに保存中</span>
          </div>

          {drafts.length === 0 ? (
            <div className="empty-state">
              <h2>まだ下書きがありません</h2>
              <p>新規作成かMarkdown importから、最初の記事を追加できます。</p>
              <button className="primary" onClick={onNew}>新規作成</button>
            </div>
          ) : (
            <div className="draft-list">
              {drafts.map((draft) => (
                <article className="draft-row" key={draft.id}>
                  <button className="draft-main" onClick={() => onOpen(draft.id)}>
                    <span className="draft-title">{draft.frontmatter.title || "タイトル未設定"}</span>
                    <span className="draft-meta">
                      <span className={draft.frontmatter.draft ? "dot draft" : "dot"} />
                      <span className={`state-label state-${getArticleState(draft)}`}>{getArticleStateLabel(getArticleState(draft))}</span>
                      {" "}・ {draft.source} ・ {draft.frontmatter.type} ・ {draft.frontmatter.date || "No date"}
                    </span>
                    <span className="draft-description">{generatedFilename(draft.frontmatter) || "filename unavailable"}</span>
                    <span className="draft-stats">
                      warning {publishChecks(draft.frontmatter).filter((check) => !check.ok).length} ・ {draft.body.length}字
                      {draft.sourceFileName ? ` ・ ${draft.sourceFileName}` : ""}
                    </span>
                  </button>
                  <span className="updated-at">{formatDateTime(draft.updatedAt)}</span>
                  <div className="row-actions">
                    <button onClick={() => onOpen(draft.id)}>編集</button>
                    <button onClick={() => onDuplicate(draft)}>複製</button>
                    <button onClick={() => downloadDraft(draft)}>.md</button>
                    <button className="danger" onClick={() => onDelete(draft.id)}>削除</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
