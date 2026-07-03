import { useEffect, useMemo, useRef, useState } from "react";
import type { FrontmatterForm, ReviewMode, StoredDraft } from "../types/journal";
import { buildFrontmatter } from "../lib/frontmatter";
import { buildMarkdown, downloadDraft } from "../lib/markdown";
import { SettingsDrawer } from "./SettingsDrawer";
import { ReviewPane } from "./ReviewPane";
import { ImageCardTool } from "./ImageCardTool";

export function EditorScreen({ draft, notice, onBack, onSave, onSaveFile, onDelete, conflictActive, onReloadConflict, onForceSaveConflict, onNotice, onFullPreview }: {
  draft: StoredDraft;
  notice: string;
  onBack: () => void;
  onSave: (draft: StoredDraft) => void;
  onSaveFile: (draft: StoredDraft, options?: { force?: boolean }) => Promise<StoredDraft | null>;
  onDelete: (draft: StoredDraft) => void;
  conflictActive: boolean;
  onReloadConflict: () => void;
  onForceSaveConflict: () => Promise<StoredDraft | null>;
  onNotice: (notice: string) => void;
  onFullPreview: (draft: StoredDraft) => void;
}) {
  const [localDraft, setLocalDraft] = useState(draft);
  const [panelMode, setPanelMode] = useState<ReviewMode | "settings" | "media" | null>(null);
  const [panelSide, setPanelSide] = useState<"left" | "right">("right");
  const [previewScrollRatio, setPreviewScrollRatio] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const savedEditMarkerRef = useRef(draft.editedAt ?? "");
  const skipNextAutosaveRef = useRef(true);
  const hasUnsavedFileChanges = (localDraft.editedAt ?? "") !== savedEditMarkerRef.current;

  useEffect(() => {
    skipNextAutosaveRef.current = true;
    setLocalDraft(draft);
    savedEditMarkerRef.current = draft.editedAt ?? "";
  }, [draft.id]);

  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => onSave(localDraft), 350);
    return () => window.clearTimeout(timer);
  }, [localDraft, onSave]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedFileChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedFileChanges]);

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
    try {
      await navigator.clipboard.writeText(text);
      onNotice(`${label}をコピーしました`);
    } catch {
      onNotice("コピーできませんでした。ブラウザの権限を確認してください");
    }
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

  async function saveFile() {
    const saved = await onSaveFile(localDraft);
    syncSavedDraft(saved);
  }

  function syncSavedDraft(saved: StoredDraft | null) {
    if (!saved) return;
    savedEditMarkerRef.current = saved.editedAt ?? "";
    skipNextAutosaveRef.current = true;
    setLocalDraft(saved);
  }

  async function saveAsDraft() {
    const next = markEdited({ ...localDraft, frontmatter: { ...localDraft.frontmatter, draft: true } });
    setLocalDraft(next);
    const saved = await onSaveFile(next);
    syncSavedDraft(saved);
  }

  async function forceSaveFile() {
    const saved = await onForceSaveConflict();
    syncSavedDraft(saved);
  }

  function closeEditor() {
    if (!hasUnsavedFileChanges || window.confirm("Markdownファイルに保存していない変更があります。閉じますか？")) {
      onBack();
    }
  }

  function deleteArticle() {
    setMoreOpen(false);
    setDeleteConfirmOpen(true);
  }

  function openReview(mode: ReviewMode, side: "left" | "right") {
    updatePreviewScrollRatio();
    setPanelSide(side);
    setPanelMode((current) => current === mode && panelSide === side ? null : mode);
  }

  function openPanel(mode: "settings" | "media", side: "left" | "right") {
    setPanelSide(side);
    setPanelMode((current) => current === mode && panelSide === side ? null : mode);
  }

  function closePanel() {
    setPanelMode(null);
  }

  function updatePreviewScrollRatio() {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const scrollable = textarea.scrollHeight - textarea.clientHeight;
    setPreviewScrollRatio(scrollable > 0 ? textarea.scrollTop / scrollable : 0);
  }

  return (
    <main className="editor-shell">
      <header className="editor-topbar">
        <button className="ghost" onClick={() => panelMode ? closePanel() : closeEditor()}>{panelMode ? "編集に戻る" : "閉じる"}</button>
        <span className={hasUnsavedFileChanges ? "status-pill status-pill-unsaved" : "status-pill"}>
          {localDraft.sourceFileName ? `${notice} ・ ${localDraft.kind} ・ ${localDraft.sourceFileName}` : `${notice} ・ ${localDraft.kind} ・ 未保存Markdown`}
          {hasUnsavedFileChanges ? " ・ 未保存変更あり" : ""}
        </span>
        <div className="editor-actions">
          <div className="more-menu-wrap">
            <button className="icon-button" aria-label="その他" onClick={() => setMoreOpen((open) => !open)}>...</button>
            {moreOpen && (
              <div className="more-menu">
                <button onClick={() => { openReview("preview", "right"); setMoreOpen(false); }}>プレビュー</button>
                <button onClick={() => { openReview("checks", "right"); setMoreOpen(false); }}>チェック</button>
                <button onClick={() => { openReview("output", "right"); setMoreOpen(false); }}>MD出力</button>
                <button onClick={() => { onFullPreview(localDraft); setMoreOpen(false); }}>完全プレビュー</button>
                <button onClick={() => { onNotice(`作成 ${new Date(localDraft.createdAt).toLocaleString()} / 更新 ${new Date(localDraft.updatedAt).toLocaleString()}`); setMoreOpen(false); }}>変更履歴</button>
                <button className="danger" onClick={deleteArticle}>削除</button>
              </div>
            )}
          </div>
          <button onClick={saveFile}>Markdown保存</button>
          <button className="primary" onClick={() => openPanel("settings", "right")}>公開に進む</button>
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
            <button className="danger" onClick={forceSaveFile}>上書き保存</button>
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

      <>
        <aside className="editor-tool-rail" aria-label="編集ツール">
          <button className="tool-button active" title="目次" onClick={() => onNotice("見出しを設定すると目次に表示されます")}>☰</button>
          <button className="tool-button" title="画像カード" onClick={() => openPanel("media", "left")}>▧</button>
          <button className="tool-button" title="MD出力" onClick={() => openReview("output", "left")}>MD</button>
          <span className="tool-count">{localDraft.body.length}字</span>
        </aside>

        <section className={panelMode ? `writing-layout review-open review-open-${panelSide}` : "writing-layout"}>
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
              onChange={(event) => {
                updatePreviewScrollRatio();
                setLocalDraft((current) => current.body === event.target.value ? current : markEdited({ ...current, body: event.target.value }));
              }}
              onScroll={updatePreviewScrollRatio}
              spellCheck={false}
              placeholder="本文を書きはじめる"
            />
          </article>

          {panelMode === "preview" || panelMode === "checks" || panelMode === "output" ? (
            <ReviewPane
              mode={panelMode}
              side={panelSide}
              draft={localDraft}
              markdown={markdown}
              frontmatter={frontmatter}
              previewScrollRatio={previewScrollRatio}
              onClose={closePanel}
              onCopy={copy}
            />
          ) : null}

          {panelMode === "settings" && (
            <aside className={`review-pane review-pane-${panelSide} editor-side-panel`}>
              <SettingsDrawer
                draft={localDraft}
                markdown={markdown}
                frontmatterOutput={frontmatter}
                onChange={updateFrontmatter}
                onBack={closePanel}
                onSaveDraft={saveAsDraft}
                onSaveFile={saveFile}
                onDownload={() => downloadDraft(localDraft)}
                onCopy={copy}
              />
            </aside>
          )}

          {panelMode === "media" && (
            <aside className={`review-pane review-pane-${panelSide} editor-side-panel editor-side-panel-wide`}>
              <ImageCardTool
                body={localDraft.body}
                frontmatter={localDraft.frontmatter}
                onInsert={insertBodyText}
                onFrontmatterChange={updateFrontmatter}
                onCopy={copy}
                onNotice={onNotice}
                onClose={closePanel}
              />
            </aside>
          )}
          </section>
        </>
    </main>
  );
}
