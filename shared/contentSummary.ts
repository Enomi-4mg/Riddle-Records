/** List/lead summaries prefer description; old Journal metadata remains a fallback. */
export function contentSummary(description?: string | null, ogDescription?: string | null) {
  return description?.trim() || ogDescription?.trim() || "";
}
