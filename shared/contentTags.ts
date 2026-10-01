/** Canonicalize known aliases without changing the case of unrelated tags. */
export function normalizeContentTags(tags: readonly string[]): string[] {
  const normalized = tags.map((tag) => tag.trim()).filter(Boolean)
    .map((tag) => /^music$/i.test(tag) ? "Music" : tag);
  return [...new Set(normalized)];
}
