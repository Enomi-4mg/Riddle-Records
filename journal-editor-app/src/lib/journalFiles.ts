import type { JournalFileInfo } from "../types/journal";

export type JournalFileListResult = {
  available: boolean;
  files: JournalFileInfo[];
  error?: string;
};

export class JournalFileConflictError extends Error {
  currentMtime?: number;
  expectedMtime?: number;

  constructor(message: string, options: { currentMtime?: number; expectedMtime?: number } = {}) {
    super(message);
    this.name = "JournalFileConflictError";
    this.currentMtime = options.currentMtime;
    this.expectedMtime = options.expectedMtime;
  }
}

async function readError(response: Response) {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function loadJournalFiles(): Promise<JournalFileListResult> {
  try {
    const response = await fetch("/api/journal-files");
    if (!response.ok) {
      return { available: false, files: [], error: await readError(response) };
    }
    const payload = await response.json() as { files?: unknown };
    return {
      available: true,
      files: Array.isArray(payload.files)
        ? payload.files.filter((file): file is JournalFileInfo => (
          Boolean(file) &&
          typeof file === "object" &&
          "path" in file &&
          "mtimeMs" in file &&
          typeof file.path === "string" &&
          typeof file.mtimeMs === "number"
        ))
        : []
    };
  } catch (error) {
    return { available: false, files: [], error: error instanceof Error ? error.message : "API unavailable" };
  }
}

export async function loadJournalFile(filename: string) {
  const response = await fetch(`/api/journal-file?path=${encodeURIComponent(filename)}`);
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as { path: string; markdown: string; mtimeMs: number };
}

export async function saveJournalFile(filename: string, markdown: string, options: { expectedMtime?: number; force?: boolean } = {}) {
  const response = await fetch("/api/journal-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filename, markdown, expectedMtime: options.expectedMtime, force: options.force })
  });
  if (response.status === 409) {
    const payload = await response.json() as { error?: string; currentMtime?: number; expectedMtime?: number };
    throw new JournalFileConflictError(payload.error || "File has changed on disk", {
      currentMtime: payload.currentMtime,
      expectedMtime: payload.expectedMtime
    });
  }
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as { path: string; saved: boolean; mtimeMs: number };
}

export async function deleteJournalFile(filename: string) {
  const response = await fetch(`/api/journal-file?path=${encodeURIComponent(filename)}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as { path: string; deleted: boolean };
}
