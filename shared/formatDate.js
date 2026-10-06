// Publication dates are calendar dates; format them independently of host timezone.
export function formatDate(value, timeZone = "UTC") {
  if (!value) return "";
  const iso = value instanceof Date ? new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value) : String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[1]}年${match[2]}月${match[3]}日` : "";
}
