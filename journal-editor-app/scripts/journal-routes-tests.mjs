import assert from "node:assert/strict";
import { test } from "node:test";
import { assertUniqueJournalRoutes } from "../../src/utils/journal.ts";
const entry = (id, date, extra = {}) => ({ id, data: { date: new Date(date), ...extra } });
test("rejects reports in the same month with actionable filenames and URL", () => {
  assert.throws(() => assertUniqueJournalRoutes([entry("first.md", "2026-08-01", { type: "report" }), entry("second.md", "2026-08-31", { type: "report" })]), /URL collision: \/journal\/2026-08\/ \(first.md, second.md\)/);
});
test("accepts separate months and explicit distinct permalinks", () => {
  assert.doesNotThrow(() => assertUniqueJournalRoutes([entry("one", "2026-08-01", { type: "report" }), entry("two", "2026-09-01", { type: "report" }), entry("extra", "2026-08-31", { type: "report", permalink: "/journal/extra/" })]));
});
test("rejects collisions between explicit and generated normalized paths", () => {
  assert.throws(() => assertUniqueJournalRoutes([entry("one", "2026-08-01"), entry("two", "2026-09-01", { permalink: "journal/2026-08-01" })]), /URL collision/);
});
