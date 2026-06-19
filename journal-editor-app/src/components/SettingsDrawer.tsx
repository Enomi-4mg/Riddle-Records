import type { ArticleType, FrontmatterForm, StoredDraft } from "../types/journal";
import { generatedFilename, generatedUrl } from "../lib/permalink";
import { Field, Readout } from "./shared";

export function SettingsDrawer({ draft, onChange, onClose }: {
  draft: StoredDraft;
  onChange: <K extends keyof FrontmatterForm>(key: K, value: FrontmatterForm[K]) => void;
  onClose: () => void;
}) {
  const frontmatter = draft.frontmatter;
  return (
    <div className="drawer-backdrop" role="presentation">
      <aside className="settings-drawer" role="dialog" aria-label="記事設定">
        <header className="drawer-header">
          <div>
            <p>Settings</p>
            <h2>記事設定</h2>
          </div>
          <button onClick={onClose}>閉じる</button>
        </header>

        <section className="settings-section">
          <h3>Basic</h3>
          <Field label="title"><input value={frontmatter.title} onChange={(event) => onChange("title", event.target.value)} /></Field>
          <div className="field-grid">
            <Field label="date"><input type="date" value={frontmatter.date} onChange={(event) => onChange("date", event.target.value)} /></Field>
            <Field label="type">
              <select value={frontmatter.type} onChange={(event) => onChange("type", event.target.value as ArticleType)}>
                <option value="journal">journal</option>
                <option value="making">making</option>
                <option value="report">report</option>
              </select>
            </Field>
          </div>
          <Field label="slug"><input value={frontmatter.slug} onChange={(event) => onChange("slug", event.target.value)} /></Field>
          <Field label="description"><textarea rows={4} value={frontmatter.description} onChange={(event) => onChange("description", event.target.value)} /></Field>
          <Field label="tags"><input value={frontmatter.tags} onChange={(event) => onChange("tags", event.target.value)} placeholder="日記, 3DCG, 制作" /></Field>
          <label className="check-row"><input type="checkbox" checked={frontmatter.draft} onChange={(event) => onChange("draft", event.target.checked)} /> draft</label>
        </section>

        <section className="settings-section">
          <h3>Publish</h3>
          <Readout label="URL" value={generatedUrl(frontmatter) || "date を入力してください"} />
          <Readout label="Markdown filename" value={generatedFilename(frontmatter) || "date を入力してください"} />
          <Field label="permalink override"><input value={frontmatter.permalink} onChange={(event) => onChange("permalink", event.target.value)} /></Field>
        </section>

        <section className="settings-section">
          <h3>Media</h3>
          <Field label="thumbnail"><input value={frontmatter.thumbnail} onChange={(event) => onChange("thumbnail", event.target.value)} /></Field>
          <Field label="thumbnail_alt"><input value={frontmatter.thumbnail_alt} onChange={(event) => onChange("thumbnail_alt", event.target.value)} /></Field>
          <div className="field-grid">
            <Field label="thumbnail_fit"><input value={frontmatter.thumbnail_fit} onChange={(event) => onChange("thumbnail_fit", event.target.value)} /></Field>
            <Field label="thumbnail_position"><input value={frontmatter.thumbnail_position} onChange={(event) => onChange("thumbnail_position", event.target.value)} /></Field>
          </div>
          <Field label="og_image"><input value={frontmatter.og_image} onChange={(event) => onChange("og_image", event.target.value)} /></Field>
          <Field label="featured_related"><input value={frontmatter.featured_related} onChange={(event) => onChange("featured_related", event.target.value)} /></Field>
        </section>

        <section className="settings-section">
          <h3>Advanced</h3>
          <label className="check-row"><input type="checkbox" checked={frontmatter.use_math} onChange={(event) => onChange("use_math", event.target.checked)} /> use_math</label>
          <Field label="og_description"><input value={frontmatter.og_description} onChange={(event) => onChange("og_description", event.target.value)} /></Field>
          <Field label="image"><input value={frontmatter.image} onChange={(event) => onChange("image", event.target.value)} /></Field>
          <Field label="thumbnail_class"><input value={frontmatter.thumbnail_class} onChange={(event) => onChange("thumbnail_class", event.target.value)} /></Field>
        </section>
      </aside>
    </div>
  );
}
