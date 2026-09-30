export type ArticleDefaults = { thumbnail: string; thumbnailAlt: string; ogImage: string };

const storageKey = "riddle-cms-article-defaults-v1";
export const emptyArticleDefaults: ArticleDefaults = { thumbnail: "", thumbnailAlt: "", ogImage: "" };

export function readArticleDefaults(): ArticleDefaults {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "null") as Partial<ArticleDefaults> | null;
    return {
      thumbnail: typeof value?.thumbnail === "string" ? value.thumbnail : "",
      thumbnailAlt: typeof value?.thumbnailAlt === "string" ? value.thumbnailAlt : "",
      ogImage: typeof value?.ogImage === "string" ? value.ogImage : ""
    };
  } catch { return { ...emptyArticleDefaults }; }
}

export function writeArticleDefaults(value: ArticleDefaults) {
  localStorage.setItem(storageKey, JSON.stringify(value));
}
