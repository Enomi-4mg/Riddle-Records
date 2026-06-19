import type { ArticleState, StoredDraft } from "../types/journal";

export function getArticleState(draft: StoredDraft): ArticleState {
  if (draft.frontmatter.draft === true) return "draft";
  if (draft.source === "imported") {
    const importedAt = draft.importedAt ?? draft.createdAt;
    return draft.updatedAt > importedAt ? "editing-published" : "published";
  }
  return "scheduled";
}

export function getArticleStateLabel(state: ArticleState) {
  switch (state) {
    case "draft":
      return "下書き";
    case "published":
      return "投稿済み";
    case "editing-published":
      return "投稿済みを編集中";
    case "scheduled":
      return "公開予定";
  }
}
