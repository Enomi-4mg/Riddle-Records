export const getJournalPermalink = (entry: { data: { date: Date; permalink?: string; type?: string; slug?: string } }) => {
  if (entry.data.permalink) {
    return entry.data.permalink;
  }

  const isoDate = entry.data.date.toISOString().slice(0, 10);
  const [year, month, day] = isoDate.split("-");
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
