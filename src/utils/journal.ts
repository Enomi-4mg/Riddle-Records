const normalizeJournalPath = (path: string) => path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/^journal\//, "");

const dateParts = (date: Date) => {
  const isoDate = date.toISOString().slice(0, 10);
  const [year, month, day] = isoDate.split("-");
  return { isoDate, year, month, day };
};

export const getJournalPermalink = (entry: { data: { date: Date; permalink?: string; type?: string; slug?: string } }) => {
  if (entry.data.permalink) {
    return entry.data.permalink;
  }

  const { isoDate, year, month, day } = dateParts(entry.data.date);
  const type = entry.data.type ?? "journal";
  const slug = entry.data.slug?.trim();

  if (type === "making") {
    return slug ? `/journal/${year}/${month}/${day}/${slug}/` : `/journal/${isoDate}/`;
  }

  if (type === "report") {
    return `/journal/${year}-${month}/`;
  }

  return `/journal/${isoDate}/`;
};

export const getJournalRoutePath = (entry: { data: { date: Date; permalink?: string; type?: string; slug?: string } }) =>
  normalizeJournalPath(getJournalPermalink(entry));

export const toJournalRoutePath = normalizeJournalPath;
