import { defaultBody, defaultFrontmatter, type BackupPayload, type DraftOverrides, type RestoreConflictMode, type RestoreResult, type StoredDraft } from "../types/journal";

const legacyStorageKey = "riddle-records:journal-editor-app:draft";
const draftIndexKey = "rr-editor:draft-index";
const draftKey = (id: string) => `rr-editor:draft:${id}`;
const appVersion = "0.1.0";

export function nowIso() {
  return new Date().toISOString();
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function duplicateId(id: string) {
  return `${id}:copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDraft(overrides: DraftOverrides = {}): StoredDraft {
  const createdAt = overrides.createdAt ?? nowIso();
  return {
    id: overrides.id ?? createId(),
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    importedAt: overrides.importedAt,
    source: overrides.source ?? "manual",
    sourcePath: overrides.sourcePath,
    sourceFileName: overrides.sourceFileName,
    frontmatter: { ...defaultFrontmatter, ...overrides.frontmatter },
    body: overrides.body ?? defaultBody
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeDraft(value: unknown): StoredDraft | null {
  if (!isPlainObject(value) || typeof value.id !== "string" || typeof value.body !== "string" || !isPlainObject(value.frontmatter)) {
    return null;
  }
  return createDraft({
    ...value,
    id: value.id,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : nowIso(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : nowIso(),
    importedAt: typeof value.importedAt === "string" ? value.importedAt : typeof value.createdAt === "string" ? value.createdAt : undefined,
    source: value.source === "imported" || value.source === "uploaded" || value.source === "manual" ? value.source : "manual",
    sourcePath: typeof value.sourcePath === "string" ? value.sourcePath : undefined,
    sourceFileName: typeof value.sourceFileName === "string" ? value.sourceFileName : undefined,
    frontmatter: value.frontmatter,
    body: value.body
  });
}

function readIndex() {
  try {
    const value = JSON.parse(localStorage.getItem(draftIndexKey) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]) {
  localStorage.setItem(draftIndexKey, JSON.stringify(ids));
}

export function readDraft(id: string) {
  try {
    const raw = localStorage.getItem(draftKey(id));
    if (!raw) return null;
    return normalizeDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function hasDraft(id: string) {
  return readIndex().includes(id) && Boolean(localStorage.getItem(draftKey(id)));
}

export function writeDraft(draft: StoredDraft) {
  localStorage.setItem(draftKey(draft.id), JSON.stringify(draft));
}

export function deleteDraft(id: string) {
  localStorage.removeItem(draftKey(id));
  writeIndex(readIndex().filter((draftId) => draftId !== id));
}

export function saveNewDraft(draft: StoredDraft) {
  const ids = readIndex();
  if (!ids.includes(draft.id)) writeIndex([draft.id, ...ids]);
  writeDraft(draft);
}

function migrateLegacyDraft() {
  if (readIndex().length > 0) return;
  const raw = localStorage.getItem(legacyStorageKey);
  if (!raw) return;
  try {
    const legacy = JSON.parse(raw);
    const migrated = createDraft({
      frontmatter: legacy,
      body: legacy.body ?? defaultBody
    });
    saveNewDraft(migrated);
  } catch {
    // Ignore broken legacy data. The new list can still create fresh drafts.
  }
}

export function loadDrafts() {
  migrateLegacyDraft();
  return readIndex().map(readDraft).filter((draft): draft is StoredDraft => Boolean(draft)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createBackup(): BackupPayload {
  const draftIndex = readIndex();
  const drafts = draftIndex.map(readDraft).filter((draft): draft is StoredDraft => Boolean(draft));
  return {
    schemaVersion: 1,
    appVersion,
    exportedAt: nowIso(),
    draftCount: drafts.length,
    draftIndex: drafts.map((draft) => draft.id),
    drafts
  };
}

export function downloadBackup() {
  const backup = createBackup();
  const date = backup.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `riddle-records-editor-backup-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return backup;
}

function parseBackupPayload(json: string) {
  const parsed = JSON.parse(json) as unknown;
  if (!isPlainObject(parsed) || !Array.isArray(parsed.drafts)) {
    throw new Error("Invalid backup JSON");
  }
  return parsed.drafts;
}

function legacyImportedCounterpart(id: string) {
  if (!id.startsWith("imported:")) return "";
  return id.endsWith(".md") ? id.replace(/\.md$/, "") : `${id}.md`;
}

export function restoreBackup(json: string, mode: RestoreConflictMode): RestoreResult {
  const result: RestoreResult = { added: 0, overwritten: 0, skipped: 0, errors: 0, legacyDuplicateWarnings: 0 };
  let incoming: unknown[];
  try {
    incoming = parseBackupPayload(json);
  } catch {
    return { ...result, errors: 1 };
  }

  for (const rawDraft of incoming) {
    const draft = normalizeDraft(rawDraft);
    if (!draft) {
      result.errors += 1;
      continue;
    }

    const hasSameId = hasDraft(draft.id);
    const legacyCounterpart = legacyImportedCounterpart(draft.id);
    const hasLegacyCounterpart = Boolean(legacyCounterpart && hasDraft(legacyCounterpart));

    if (hasLegacyCounterpart && !hasSameId) {
      result.legacyDuplicateWarnings += 1;
    }

    if (mode === "duplicate") {
      const duplicate = createDraft({
        ...draft,
        id: hasSameId || hasLegacyCounterpart ? duplicateId(draft.id) : draft.id,
        frontmatter: draft.frontmatter,
        body: draft.body
      });
      saveNewDraft(duplicate);
      result.added += 1;
      continue;
    }

    if (hasSameId || hasLegacyCounterpart) {
      if (mode === "overwrite" && hasSameId) {
        writeDraft(draft);
        saveNewDraft(draft);
        result.overwritten += 1;
      } else {
        result.skipped += 1;
      }
      continue;
    }

    saveNewDraft(draft);
    result.added += 1;
  }

  return result;
}
