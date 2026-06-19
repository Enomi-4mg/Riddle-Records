import { useEffect, useMemo, useState } from "react";
import type { FrontmatterForm, ReviewMode, StoredDraft } from "../types/journal";
import { buildFrontmatter } from "../lib/frontmatter";
import { buildMarkdown, downloadDraft } from "../lib/markdown";
import { SettingsDrawer } from "./SettingsDrawer";
import { ReviewPane } from "./ReviewPane";

export function EditorScreen({ draft, notice, onBack, onSave, onNotice }: {
  draft: StoredDraft;
  notice: string;
  onBack: () => void;
  onSave: (draft: StoredDraft) => void;
  onNotice: (notice: string) => void;
}) {
  const [localDraft, setLocalDraft] = useState(draft);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode | null>(null);

  useEffect(() => setLocalDraft(draft), [draft.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => onSave(localDraft), 350);
    return () => window.clearTimeout(timer);
  }, [localDraft, onSave]);

  const markdown = useMemo(() => buildMarkdown(localDraft), [localDraft]);
  const frontmatter = useMemo(() => buildFrontmatter(localDraft.frontmatter), [localDraft.frontmatter]);

  function updateFrontmatter<K extends keyof FrontmatterForm>(key: K, value: FrontmatterForm[K]) {
    setLocalDraft((current) => ({ ...current, frontmatter: { ...current.frontmatter, [key]: value } }));
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    onNotice(`${label}をコピーしました`);
  }

  return (
    <main className="editor-shell">
      <header className="editor-topbar">
        <button className="ghost" onClick={onBack}>記事一覧へ</button>
        <span className="status-pill">{notice}</span>
        <div className="editor-actions">
          <button onClick={() => setSettingsOpen(true)}>記事設定</button>
          <button className={reviewMode === "preview" ? "active" : ""} onClick={() => setReviewMode(reviewMode === "preview" ? null : "preview")}>プレビュー</button>
          <button className={reviewMode === "checks" ? "active" : ""} onClick={() => setReviewMode(reviewMode === "checks" ? null : "checks")}>チェック</button>
          <button className={reviewMode === "output" ? "active" : ""} onClick={() => setReviewMode(reviewMode === "output" ? null : "output")}>出力</button>
          <button className="primary" onClick={() => downloadDraft(localDraft)}>.md</button>
        </div>
      </header>

      <section className={reviewMode ? "writing-layout with-review" : "writing-layout"}>
        <aside className="outline-rail">
          <span>本文</span>
          <span>{localDraft.body.length}字</span>
        </aside>

        <article className="writing-canvas">
          <input
            className="title-input"
            value={localDraft.frontmatter.title}
            onChange={(event) => updateFrontmatter("title", event.target.value)}
            placeholder="記事タイトル"
          />
          <textarea
            className="note-editor"
            value={localDraft.body}
            onChange={(event) => setLocalDraft((current) => ({ ...current, body: event.target.value }))}
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

      {settingsOpen && (
        <SettingsDrawer
          draft={localDraft}
          onChange={updateFrontmatter}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
