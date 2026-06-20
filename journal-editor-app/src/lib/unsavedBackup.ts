import type { StoredDraft } from "../types/journal";

const backupPrefix = "riddle-journal-unsaved:";

function backupKey(id: string) {
  return `${backupPrefix}${id}`;
}

export function loadUnsavedBackup(id: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(backupKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as StoredDraft;
  } catch {
    return null;
  }
}

export function writeUnsavedBackup(draft: StoredDraft) {
  try {
    localStorage.setItem(backupKey(draft.id), JSON.stringify(draft));
  } catch {
    // localStorage is best-effort only; Markdown files remain the source of truth.
  }
}

export function clearUnsavedBackup(id: string) {
  try {
    localStorage.removeItem(backupKey(id));
  } catch {
    // Ignore unavailable storage.
  }
}
