import { marked } from "marked";
import { useEffect, useRef } from "react";
import type { ReviewMode, StoredDraft } from "../types/journal";
import { frontmatterSchema, publishChecks, toFrontmatterObject } from "../lib/validation";
import { Field } from "./shared";

export function ReviewPane({ mode, side, draft, markdown, frontmatter, previewScrollRatio, onClose, onCopy }: {
  mode: ReviewMode;
  side: "left" | "right";
  draft: StoredDraft;
  markdown: string;
  frontmatter: string;
  previewScrollRatio: number;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  const checks = publishChecks(draft.frontmatter, draft.kind);
  const validation = frontmatterSchema.safeParse(toFrontmatterObject(draft.frontmatter));
  const previewHtml = marked.parse(draft.body, { async: false });
  const previewBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "preview") return;
    const body = previewBodyRef.current;
    if (!body) return;
    const scrollable = body.scrollHeight - body.clientHeight;
    body.scrollTop = scrollable > 0 ? scrollable * previewScrollRatio : 0;
  }, [mode, previewHtml, previewScrollRatio]);

  return (
    <aside className={`review-pane review-pane-${side}`}>
      <header className="review-header">
        <strong>{mode === "preview" ? "Preview" : mode === "checks" ? "Checks" : "Output"}</strong>
        <button onClick={onClose}>閉じる</button>
      </header>

      {mode === "preview" && (
        <article className="preview-paper">
          <p className="preview-date">{draft.frontmatter.date}</p>
          <h1>{draft.frontmatter.title || "Untitled"}</h1>
          <p className="description-preview">{draft.frontmatter.description || "description preview"}</p>
          <div ref={previewBodyRef} className="markdown-preview markdown-preview-sync" dangerouslySetInnerHTML={{ __html: previewHtml }} />
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
