import { useEffect, useMemo, useRef, useState } from "react";
import type { FrontmatterForm, ReviewMode, StoredDraft } from "../types/journal";
import { buildFrontmatter } from "../lib/frontmatter";
import { buildMarkdown, downloadDraft } from "../lib/markdown";
import { SettingsDrawer } from "./SettingsDrawer";
import { ReviewPane } from "./ReviewPane";
import { ImageCardTool } from "./ImageCardTool";

export function EditorScreen({ draft, notice, onBack, onSave, onSaveFile, onDelete, conflictActive, onReloadConflict, onForceSaveConflict, onNotice }: {
  draft: StoredDraft;
  notice: string;
  onBack: () => void;
  onSave: (draft: StoredDraft) => void;
  onSaveFile: (draft: StoredDraft, options?: { force?: boolean }) => void;
  onDelete: (draft: StoredDraft) => void;
  conflictActive: boolean;
  onReloadConflict: () => void;
  onForceSaveConflict: () => void;
  onNotice: (notice: string) => void;
}) {
  const [localDraft, setLocalDraft] = useState(draft);
  const [publishOpen, setPublishOpen] = useState(false);
  const [cardToolOpen, setCardToolOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setLocalDraft(draft), [draft.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => onSave(localDraft), 350);
    return () => window.clearTimeout(timer);
  }, [localDraft, onSave]);

  const markdown = useMemo(() => buildMarkdown(localDraft), [localDraft]);
  const frontmatter = useMemo(() => buildFrontmatter(localDraft.frontmatter, localDraft.kind), [localDraft.frontmatter, localDraft.kind]);

  function markEdited(draft: StoredDraft): StoredDraft {
    return { ...draft, editedAt: new Date().toISOString() };
  }

  function updateFrontmatter<K extends keyof FrontmatterForm>(key: K, value: FrontmatterForm[K]) {
    setLocalDraft((current) => {
      if (current.frontmatter[key] === value) return current;
      return markEdited({ ...current, frontmatter: { ...current.frontmatter, [key]: value } });
    });
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    onNotice(`${label}をコピーしました`);
  }

  function insertBodyText(text: string) {
    const textarea = bodyRef.current;
    setLocalDraft((current) => {
      const start = textarea?.selectionStart ?? current.body.length;
      const end = textarea?.selectionEnd ?? start;
      const nextBody = `${current.body.slice(0, start)}${text}${current.body.slice(end)}`;
      window.requestAnimationFrame(() => {
        if (!textarea) return;
        const cursor = start + text.length;
        textarea.focus();
        textarea.selectionStart = cursor;
        textarea.selectionEnd = cursor;
      });
      return markEdited({ ...current, body: nextBody });
    });
    onNotice("カードHTMLを本文に挿入しました");
  }

  function saveDraft() {
    onSaveFile(localDraft);
  }

  function saveAsDraft() {
    const next = markEdited({ ...localDraft, frontmatter: { ...localDraft.frontmatter, draft: true } });
    setLocalDraft(next);
    onSaveFile(next);
  }

  function deleteArticle() {
    setMoreOpen(false);
    setDeleteConfirmOpen(true);
  }

  return (
    <main className="editor-shell">
      <header className="editor-topbar">
        <button className="ghost" onClick={() => publishOpen ? setPublishOpen(false) : onBack()}>{publishOpen ? "編集に戻る" : "閉じる"}</button>
        <span className="status-pill">{draft.sourceFileName ? `${notice} ・ ${draft.kind} ・ ${draft.sourceFileName}` : `${notice} ・ ${draft.kind} ・ 未保存Markdown`}</span>
        <div className="editor-actions">
          <div className="more-menu-wrap">
            <button className="icon-button" aria-label="その他" onClick={() => setMoreOpen((open) => !open)}>...</button>
            {moreOpen && (
              <div className="more-menu">
                <button onClick={() => { setReviewMode("preview"); setMoreOpen(false); }}>プレビュー</button>
                <button onClick={() => { onNotice(`作成 ${new Date(localDraft.createdAt).toLocaleString()} / 更新 ${new Date(localDraft.updatedAt).toLocaleString()}`); setMoreOpen(false); }}>変更履歴</button>
                <button className="danger" onClick={deleteArticle}>削除</button>
              </div>
            )}
          </div>
          <button onClick={saveDraft}>下書き保存</button>
          <button className="primary" onClick={() => { setPublishOpen(true); setReviewMode(null); }}>公開に進む</button>
        </div>
      </header>

      {conflictActive && (
        <section className="conflict-bar" role="alert">
          <div>
            <strong>ファイルが外部で変更されています</strong>
            <span>保存前に再読み込みするか、現在の編集内容で上書き保存してください。</span>
          </div>
          <div className="button-row">
            <button onClick={onReloadConflict}>再読み込み</button>
            <button className="danger" onClick={onForceSaveConflict}>上書き保存</button>
          </div>
        </section>
      )}

      {deleteConfirmOpen && (
        <section className="delete-confirm-bar" role="alert">
          <div>
            <strong>{localDraft.sourceFileName ? "Markdownファイルを削除します" : "未保存Markdownを閉じます"}</strong>
            <span>kind: {localDraft.kind}</span>
            <span>path: {localDraft.sourceFileName || "未保存Markdown"}</span>
            <span>title: {localDraft.frontmatter.title || "Untitled"}</span>
          </div>
          <div className="button-row">
            <button onClick={() => setDeleteConfirmOpen(false)}>キャンセル</button>
            <button className="danger" onClick={() => onDelete(localDraft)}>削除する</button>
          </div>
        </section>
      )}

      {!publishOpen && (
        <>
          <aside className="editor-tool-rail" aria-label="編集ツール">
            <button className="tool-button active" title="目次" onClick={() => onNotice("見出しを設定すると目次に表示されます")}>☰</button>
            <button className="tool-button" title="画像カード" onClick={() => setCardToolOpen(true)}>▧</button>
            <button className="tool-button" title="チェック" onClick={() => setReviewMode(reviewMode === "checks" ? null : "checks")}>✓</button>
            <button className="tool-button" title="MD出力" onClick={() => setReviewMode(reviewMode === "output" ? null : "output")}>MD</button>
            <span className="tool-count">{localDraft.body.length}字</span>
          </aside>

          <section className={reviewMode ? "writing-layout with-review" : "writing-layout"}>
          <article className="writing-canvas">
            <input
              className="title-input"
              value={localDraft.frontmatter.title}
              onChange={(event) => updateFrontmatter("title", event.target.value)}
              placeholder="記事タイトル"
            />
            <textarea
              ref={bodyRef}
              className="note-editor"
              value={localDraft.body}
              onChange={(event) => setLocalDraft((current) => current.body === event.target.value ? current : markEdited({ ...current, body: event.target.value }))}
              spellCheck={false}
              placeholder="本文を書きはじめる"
            />
          </article>

          {reviewMode && (
            <ReviewPane
              mode={reviewMode}
              draft={localDraft}
              markdown={markdown}
              frontmatter={frontmatter}
              onClose={() => setReviewMode(null)}
              onCopy={copy}
            />
          )}
          </section>
        </>
      )}

      {publishOpen && (
        <SettingsDrawer
          draft={localDraft}
          markdown={markdown}
          frontmatterOutput={frontmatter}
          onChange={updateFrontmatter}
          onBack={() => setPublishOpen(false)}
          onSaveDraft={saveAsDraft}
          onSaveFile={() => onSaveFile(localDraft)}
          onDownload={() => downloadDraft(localDraft)}
          onCopy={copy}
        />
      )}

      {cardToolOpen && (
        <div className="drawer-backdrop" role="presentation">
          <ImageCardTool
            body={localDraft.body}
            frontmatter={localDraft.frontmatter}
            onInsert={insertBodyText}
            onFrontmatterChange={updateFrontmatter}
            onCopy={copy}
            onNotice={onNotice}
            onClose={() => setCardToolOpen(false)}
          />
        </div>
      )}
    </main>
  );
}
