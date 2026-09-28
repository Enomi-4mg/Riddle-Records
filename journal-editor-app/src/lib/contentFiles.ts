import type { ContentFileInfo, ContentFileListResult, ContentKind } from "../types/content";

export class ContentFileConflictError extends Error {
  currentRevision?: string;
  expectedRevision?: string;

  constructor(message: string, options: { currentRevision?: string; expectedRevision?: string } = {}) {
    super(message);
    this.name = "ContentFileConflictError";
    this.currentRevision = options.currentRevision;
    this.expectedRevision = options.expectedRevision;
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

export async function loadContentFiles(kind: ContentKind): Promise<ContentFileListResult> {
  try {
    const response = await fetch(`/api/content-list?kind=${encodeURIComponent(kind)}`);
    if (!response.ok) {
      return { available: false, files: [], error: await readError(response) };
    }
    const payload = await response.json() as { files?: unknown };
    return {
      available: true,
      files: Array.isArray(payload.files)
        ? payload.files.filter((file): file is ContentFileInfo => (
          Boolean(file) &&
          typeof file === "object" &&
          "kind" in file &&
          "path" in file &&
          "revision" in file &&
          file.kind === kind &&
          typeof file.path === "string" &&
          typeof file.revision === "string"
        ))
        : []
    };
  } catch (error) {
    return { available: false, files: [], error: error instanceof Error ? error.message : "API unavailable" };
  }
}

export async function loadContentFile(kind: ContentKind, filename: string) {
  const response = await fetch(`/api/content-item?kind=${encodeURIComponent(kind)}&path=${encodeURIComponent(filename)}`);
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as { kind: ContentKind; path: string; markdown: string; revision: string };
}

export async function saveContentFile(kind: ContentKind, filename: string, markdown: string, options: { expectedRevision?: string; force?: boolean } = {}) {
  const response = await fetch("/api/content-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, path: filename, markdown, expectedRevision: options.expectedRevision, force: options.force })
  });
  if (response.status === 409) {
    const payload = await response.json() as { error?: string; currentRevision?: string; expectedRevision?: string };
    throw new ContentFileConflictError(payload.error || "File has changed on disk", {
      currentRevision: payload.currentRevision,
      expectedRevision: payload.expectedRevision
    });
  }
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as { kind: ContentKind; path: string; saved: boolean; revision: string };
}

export async function deleteContentFile(kind: ContentKind, filename: string, options: { expectedRevision?: string; force?: boolean } = {}) {
  const response = await fetch("/api/content-item", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, path: filename, expectedRevision: options.expectedRevision, force: options.force })
  });
  if (response.status === 409) {
    const payload = await response.json() as { error?: string; currentRevision?: string; expectedRevision?: string };
    throw new ContentFileConflictError(payload.error || "File has changed", {
      currentRevision: payload.currentRevision,
      expectedRevision: payload.expectedRevision
    });
  }
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as { kind: ContentKind; path: string; deleted: boolean };
}
