export const publicationTimeZone = "Asia/Tokyo";
export function publicationDateAt(instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: publicationTimeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function isPublicationDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Astro validates drafts too; an undated draft gets a private sortable placeholder. */
export function normalizeUndatedDraft(value: unknown) {
  if (value && typeof value === "object" && "draft" in value && value.draft === true && (!('date' in value) || value.date === "" || value.date == null)) return { ...value, date: new Date(0) };
  return value;
}

/** Keep the schema's private draft placeholder out of previews and date-based routes. */
export function hasVisiblePublicationDate(data: { draft?: boolean; date: Date }, showDrafts: boolean) {
  return (!data.draft || showDrafts) && (!data.draft || data.date.getTime() !== 0);
}
