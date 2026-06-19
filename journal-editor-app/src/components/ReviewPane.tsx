import { marked } from "marked";
import type { ReviewMode, StoredDraft } from "../types/journal";
import { frontmatterSchema, publishChecks, toFrontmatterObject } from "../lib/validation";
import { Field } from "./shared";

export function ReviewPane({ mode, draft, markdown, frontmatter, onClose, onCopy }: {
  mode: ReviewMode;
  draft: StoredDraft;
  markdown: string;
  frontmatter: string;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  const checks = publishChecks(draft.frontmatter);
  const validation = frontmatterSchema.safeParse(toFrontmatterObject(draft.frontmatter));
  const previewHtml = marked.parse(draft.body, { async: false });

  return (
    <aside className="review-pane">
      <header className="review-header">
        <strong>{mode === "preview" ? "Preview" : mode === "checks" ? "Checks" : "Output"}</strong>
        <button onClick={onClose}>閉じる</button>
      </header>

      {mode === "preview" && (
        <article className="preview-paper">
          <p className="preview-date">{draft.frontmatter.date}</p>
          <h1>{draft.frontmatter.title || "Untitled"}</h1>
          <p className="description-preview">{draft.frontmatter.description || "description preview"}</p>
          <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </article>
      )}

      {mode === "checks" && (
        <section className="review-section">
          <p className={validation.success ? "validation-ok" : "validation-bad"}>
            {validation.success ? "Zod validation OK" : "Zod validation error"}
          </p>
          <ul className="check-list">
            {checks.map((check) => <li className={check.ok ? "ok" : "bad"} key={check.label}>{check.label}</li>)}
          </ul>
          {!validation.success && <pre className="error-box">{validation.error.issues.map((issue) => issue.message).join("\n")}</pre>}
        </section>
      )}

      {mode === "output" && (
        <section className="review-section">
          <div className="button-row">
            <button onClick={() => onCopy(markdown, "記事全体")}>記事全体</button>
            <button onClick={() => onCopy(frontmatter, "frontmatter")}>frontmatter</button>
            <button onClick={() => onCopy(draft.body, "本文")}>本文</button>
          </div>
          <Field label="frontmatter + body">
            <textarea className="output" value={markdown} readOnly spellCheck={false} />
          </Field>
        </section>
      )}
    </aside>
  );
}
