import type { ArticleType, FrontmatterForm, StoredDraft } from "../types/journal";
import { contentKindSchemas } from "../types/content";
import { generatedFilename, generatedUrl } from "../lib/permalink";
import { frontmatterSchema, publishChecks, toFrontmatterObject } from "../lib/validation";
import { Field, Readout } from "./shared";

export function SettingsDrawer({ draft, markdown, frontmatterOutput, onChange, onBack, onSaveDraft, onSaveFile, onDownload, onCopy }: {
  draft: StoredDraft;
  markdown: string;
  frontmatterOutput: string;
  onChange: <K extends keyof FrontmatterForm>(key: K, value: FrontmatterForm[K]) => void;
  onBack: () => void;
  onSaveDraft: () => void;
  onSaveFile: () => void;
  onDownload: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  const frontmatter = draft.frontmatter;
  const schema = contentKindSchemas[draft.kind];
  const checks = publishChecks(frontmatter, draft.kind);
  const validation = frontmatterSchema.safeParse(toFrontmatterObject(frontmatter));

  return (
    <section className="publish-layout" aria-label="記事設定">
      <aside className="publish-nav">
        <strong>公開設定</strong>
        <a href="#publish-basic">基本</a>
        <a href="#publish-checks">チェック</a>
        <a href="#publish-media">画像</a>
        <a href="#publish-output">MD出力</a>
      </aside>

      <article className="publish-panel">
        <header className="publish-header">
          <div>
            <p>Settings</p>
            <h2>記事設定</h2>
          </div>
          <div className="button-row">
            <button onClick={onBack}>編集に戻る</button>
            <button onClick={onSaveDraft}>下書きのまま保存</button>
            <button className="primary" onClick={onSaveFile}>Markdown保存</button>
          </div>
        </header>

        <section id="publish-basic" className="settings-section">
          <h3>{schema.label} Basic</h3>
          <Field label="title"><input value={frontmatter.title} onChange={(event) => onChange("title", event.target.value)} /></Field>
          <div className="field-grid">
            <Field label="date"><input type="date" value={frontmatter.date} onChange={(event) => onChange("date", event.target.value)} /></Field>
            {draft.kind === "journal" && (
              <Field label="type">
                <select value={frontmatter.type} onChange={(event) => onChange("type", event.target.value as ArticleType)}>
                  <option value="journal">journal</option>
                  <option value="making">making</option>
                  <option value="report">report</option>
                </select>
              </Field>
            )}
          </div>
          {draft.kind !== "songs" && <Field label="slug"><input value={frontmatter.slug} onChange={(event) => onChange("slug", event.target.value)} /></Field>}
          {draft.kind === "songs" && <Field label="youtube_id"><input value={frontmatter.youtube_id} onChange={(event) => onChange("youtube_id", event.target.value)} /></Field>}
          {draft.kind === "gallery" && (
            <>
              <Field label="image"><input value={frontmatter.image} onChange={(event) => onChange("image", event.target.value)} placeholder="Cloudinary ID or URL" /></Field>
              <label className="check-row"><input type="checkbox" checked={frontmatter.detail} onChange={(event) => onChange("detail", event.target.checked)} /> detail</label>
            </>
          )}
          {draft.kind === "projects" && (
            <div className="field-grid">
              <Field label="hero"><input value={frontmatter.hero} onChange={(event) => onChange("hero", event.target.value)} /></Field>
              <Field label="status">
                <select value={frontmatter.status} onChange={(event) => onChange("status", event.target.value)}>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="archived">archived</option>
                  <option value="completed">completed</option>
                </select>
              </Field>
            </div>
          )}
          <Field label="description"><textarea rows={4} value={frontmatter.description} onChange={(event) => onChange("description", event.target.value)} /></Field>
          {draft.kind === "songs" && (
            <>
              <Field label="credits"><textarea rows={4} value={frontmatter.credits} onChange={(event) => onChange("credits", event.target.value)} /></Field>
              <Field label="lyrics"><textarea rows={8} value={frontmatter.lyrics} onChange={(event) => onChange("lyrics", event.target.value)} /></Field>
            </>
          )}
          <Field label="tags"><input value={frontmatter.tags} onChange={(event) => onChange("tags", event.target.value)} placeholder="日記, 3DCG, 制作" /></Field>
          {draft.kind === "gallery" && (
            <>
              <div className="field-grid">
                <Field label="thumbnail"><input value={frontmatter.thumbnail} onChange={(event) => onChange("thumbnail", event.target.value)} placeholder="true or image ID" /></Field>
                <Field label="thumbnail_alt"><input value={frontmatter.thumbnail_alt} onChange={(event) => onChange("thumbnail_alt", event.target.value)} /></Field>
              </div>
              <div className="field-grid">
                <Field label="article_url"><input value={frontmatter.article_url} onChange={(event) => onChange("article_url", event.target.value)} /></Field>
                <Field label="making_article_url"><input value={frontmatter.making_article_url} onChange={(event) => onChange("making_article_url", event.target.value)} /></Field>
              </div>
              <label className="check-row"><input type="checkbox" checked={frontmatter.draft} onChange={(event) => onChange("draft", event.target.checked)} /> draft</label>
            </>
          )}
          {draft.kind === "projects" && (
            <>
              <Field label="features"><input value={frontmatter.features} onChange={(event) => onChange("features", event.target.value)} placeholder="feature A, feature B" /></Field>
              <Field label="links"><textarea rows={3} value={frontmatter.links} onChange={(event) => onChange("links", event.target.value)} placeholder="Website | https://example.com" /></Field>
              <label className="check-row"><input type="checkbox" checked={frontmatter.draft} onChange={(event) => onChange("draft", event.target.checked)} /> draft</label>
            </>
          )}
          {draft.kind === "journal" && <label className="check-row"><input type="checkbox" checked={frontmatter.draft} onChange={(event) => onChange("draft", event.target.checked)} /> draft</label>}
        </section>

        <section className="settings-section">
          <h3>Publish</h3>
          <Readout label="URL" value={generatedUrl(frontmatter, draft.kind) || "date を入力してください"} />
          <Readout label="Markdown filename" value={generatedFilename(frontmatter, draft.kind) || "date を入力してください"} />
          {draft.kind === "journal" && <Field label="permalink override"><input value={frontmatter.permalink} onChange={(event) => onChange("permalink", event.target.value)} /></Field>}
        </section>

        <section id="publish-checks" className="settings-section">
          <h3>Checks</h3>
          <p className={validation.success ? "validation-ok" : "validation-bad"}>
            {validation.success ? "frontmatter validation OK" : "frontmatter validation error"}
          </p>
          <ul className="check-list">
            {checks.map((check) => <li className={check.ok ? "ok" : "bad"} key={check.label}>{check.label}</li>)}
          </ul>
        </section>

        {draft.kind === "journal" && <section id="publish-media" className="settings-section">
          <h3>Media</h3>
          <Field label="thumbnail"><input value={frontmatter.thumbnail} onChange={(event) => onChange("thumbnail", event.target.value)} /></Field>
          <Field label="thumbnail_alt"><input value={frontmatter.thumbnail_alt} onChange={(event) => onChange("thumbnail_alt", event.target.value)} /></Field>
          <div className="field-grid">
            <Field label="thumbnail_fit"><input value={frontmatter.thumbnail_fit} onChange={(event) => onChange("thumbnail_fit", event.target.value)} /></Field>
            <Field label="thumbnail_position"><input value={frontmatter.thumbnail_position} onChange={(event) => onChange("thumbnail_position", event.target.value)} /></Field>
          </div>
          <Field label="og_image"><input value={frontmatter.og_image} onChange={(event) => onChange("og_image", event.target.value)} /></Field>
          <Field label="featured_related"><input value={frontmatter.featured_related} onChange={(event) => onChange("featured_related", event.target.value)} /></Field>
        </section>}

        {draft.kind === "journal" && <section className="settings-section">
          <h3>Advanced</h3>
          <label className="check-row"><input type="checkbox" checked={frontmatter.use_math} onChange={(event) => onChange("use_math", event.target.checked)} /> use_math</label>
          <Field label="og_description"><input value={frontmatter.og_description} onChange={(event) => onChange("og_description", event.target.value)} /></Field>
          <Field label="image"><input value={frontmatter.image} onChange={(event) => onChange("image", event.target.value)} /></Field>
          <Field label="thumbnail_class"><input value={frontmatter.thumbnail_class} onChange={(event) => onChange("thumbnail_class", event.target.value)} /></Field>
        </section>}

        <section id="publish-output" className="settings-section">
          <h3>MD出力</h3>
          <div className="button-row">
            <button onClick={() => onCopy(markdown, "記事全体")}>記事全体をコピー</button>
            <button onClick={() => onCopy(frontmatterOutput, "frontmatter")}>frontmatterをコピー</button>
            <button onClick={onDownload}>.md ダウンロード</button>
          </div>
          <Field label="frontmatter + body">
            <textarea className="output" value={markdown} readOnly spellCheck={false} />
          </Field>
        </section>
      </article>
    </section>
  );
}
