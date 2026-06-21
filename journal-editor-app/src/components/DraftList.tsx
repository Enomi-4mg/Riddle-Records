import { useRef } from "react";
import type { ContentFileInfo, ContentKind } from "../types/content";
import { contentKindLabels, contentKindSchemas } from "../types/content";
import type { JournalFileEntry } from "../types/journal";
import { generatedFilename } from "../lib/permalink";
import { publishChecks } from "../lib/validation";
import { getArticleState, getArticleStateLabel } from "../lib/articleState";

export function DraftList({ activeKind, contentFiles, contentEntries, contentFileApiAvailable, notice, onKindChange, onNew, onOpenContentFile, onRefreshContentFiles, onImport }: {
  activeKind: ContentKind;
  contentFiles: ContentFileInfo[];
  contentEntries: JournalFileEntry[];
  contentFileApiAvailable: boolean;
  notice: string;
  onKindChange: (kind: ContentKind) => void;
  onNew: () => void;
  onOpenContentFile: (filename: string) => void;
  onRefreshContentFiles: () => void;
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
        <strong className="brand">Riddle Records Content Editor</strong>
        <div className="bar-actions">
          <span className="status-pill">{notice}</span>
          <input ref={importRef} className="visually-hidden" type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={(event) => handleImport(event.target.files?.[0])} />
          <button onClick={() => importRef.current?.click()}>Markdown import</button>
          <button className="primary" onClick={onNew}>新規作成</button>
        </div>
      </header>

      <section className="list-layout">
        <aside className="list-nav">
          <h1>Content</h1>
          {contentKindLabels.map(({ kind, label }) => (
            <button className={kind === activeKind ? "active" : ""} key={kind} onClick={() => onKindChange(kind)}>{label}</button>
          ))}
        </aside>

        <section className="file-card">
          <div className="draft-card-header">
            <strong>{contentFiles.length} {activeKind} files</strong>
            <span>{contentFileApiAvailable ? `${contentKindSchemas[activeKind].directory}/*.md` : "API unavailable"}</span>
          </div>

          {!contentFileApiAvailable ? (
            <div className="empty-state compact">
              <h2>ローカルファイルAPIは利用できません</h2>
              <p>build/公開環境ではMarkdownのコピーまたはダウンロードで運用します。</p>
              <button onClick={onRefreshContentFiles}>再読み込み</button>
            </div>
          ) : contentFiles.length === 0 ? (
            <div className="empty-state compact">
              <h2>{contentKindSchemas[activeKind].label}ファイルがありません</h2>
              <p>新規作成かMarkdown importから、最初のMarkdownを追加できます。</p>
              <button onClick={onRefreshContentFiles}>再読み込み</button>
            </div>
          ) : contentEntries.length === 0 ? (
            <div className="empty-state compact">
              <h2>Markdownを読み込み中です</h2>
              <p>frontmatterを読み取って記事一覧を作っています。</p>
            </div>
          ) : (
            <div className="draft-list">
              {contentEntries.map(({ filename, draft }) => (
                <article className="draft-row note-row" key={filename}>
                  <button className="draft-main" onClick={() => onOpenContentFile(filename)}>
                    <span className="draft-title">{draft.frontmatter.title || "タイトル未設定"} <span className="updated-at">{filename}</span></span>
                    <span className="draft-meta">
                      <span className={draft.frontmatter.draft ? "dot draft" : "dot"} />
                      <span className={`state-label state-${getArticleState(draft)}`}>{getArticleStateLabel(getArticleState(draft))}</span>
                      {" "}・ {draft.kind} ・ {draft.frontmatter.date || "No date"}
                    </span>
                    <span className="draft-description">{draft.frontmatter.description || filename}</span>
                    <span className="draft-stats">
                      warning {publishChecks(draft.frontmatter, draft.kind).filter((check) => !check.ok).length} ・ {draft.body.length}字 ・ {generatedFilename(draft.frontmatter, draft.kind) || filename}
                    </span>
                  </button>
                  <div className="row-actions">
                    <button onClick={() => onOpenContentFile(filename)}>開く</button>
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
