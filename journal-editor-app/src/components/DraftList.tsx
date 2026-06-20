import { useRef } from "react";
import type { JournalFileEntry } from "../types/journal";
import { generatedFilename } from "../lib/permalink";
import { publishChecks } from "../lib/validation";
import { getArticleState, getArticleStateLabel } from "../lib/articleState";

export function DraftList({ journalFiles, journalEntries, journalFileApiAvailable, notice, onNew, onOpenJournalFile, onRefreshJournalFiles, onImport }: {
  journalFiles: string[];
  journalEntries: JournalFileEntry[];
  journalFileApiAvailable: boolean;
  notice: string;
  onNew: () => void;
  onOpenJournalFile: (filename: string) => void;
  onRefreshJournalFiles: () => void;
  onImport: (markdown: string, filename?: string) => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);

  async function handleImport(file: File | undefined) {
    if (!file) return;
    onImport(await file.text(), file.name);
    if (importRef.current) importRef.current.value = "";
  }

  return (
    <main className="list-shell">
      <header className="global-bar">
        <strong className="brand">Riddle Journal</strong>
        <div className="bar-actions">
          <span className="status-pill">{notice}</span>
          <input ref={importRef} className="visually-hidden" type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={(event) => handleImport(event.target.files?.[0])} />
          <button onClick={() => importRef.current?.click()}>Markdown import</button>
          <button className="primary" onClick={onNew}>新規作成</button>
        </div>
      </header>

      <section className="list-layout">
        <aside className="list-nav">
          <h1>記事</h1>
          <a className="active">Markdown</a>
          <a>src/content/journal</a>
          <a>書き出し</a>
        </aside>

        <section className="file-card">
          <div className="draft-card-header">
            <strong>{journalFiles.length} journal files</strong>
            <span>{journalFileApiAvailable ? "src/content/journal/*.md" : "API unavailable"}</span>
          </div>

          {!journalFileApiAvailable ? (
            <div className="empty-state compact">
              <h2>ローカルファイルAPIは利用できません</h2>
              <p>build/公開環境ではMarkdownのコピーまたはダウンロードで運用します。</p>
              <button onClick={onRefreshJournalFiles}>再読み込み</button>
            </div>
          ) : journalFiles.length === 0 ? (
            <div className="empty-state compact">
              <h2>Journalファイルがありません</h2>
              <p>新規作成かMarkdown importから、最初の記事を追加できます。</p>
              <button onClick={onRefreshJournalFiles}>再読み込み</button>
            </div>
          ) : journalEntries.length === 0 ? (
            <div className="empty-state compact">
              <h2>Markdownを読み込み中です</h2>
              <p>frontmatterを読み取って記事一覧を作っています。</p>
            </div>
          ) : (
            <div className="draft-list">
              {journalEntries.map(({ filename, draft }) => (
                <article className="draft-row note-row" key={filename}>
                  <button className="draft-main" onClick={() => onOpenJournalFile(filename)}>
                    <span className="draft-title">{draft.frontmatter.title || "タイトル未設定"}</span>
                    <span className="draft-meta">
                      <span className={draft.frontmatter.draft ? "dot draft" : "dot"} />
                      <span className={`state-label state-${getArticleState(draft)}`}>{getArticleStateLabel(getArticleState(draft))}</span>
                      {" "}・ {draft.frontmatter.type} ・ {draft.frontmatter.date || "No date"}
                    </span>
                    <span className="draft-description">{draft.frontmatter.description || filename}</span>
                    <span className="draft-stats">
                      warning {publishChecks(draft.frontmatter).filter((check) => !check.ok).length} ・ {draft.body.length}字 ・ {generatedFilename(draft.frontmatter) || filename}
                    </span>
                  </button>
                  <div className="row-actions">
                    <span className="updated-at">{filename}</span>
                    <button onClick={() => onOpenJournalFile(filename)}>開く</button>
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
