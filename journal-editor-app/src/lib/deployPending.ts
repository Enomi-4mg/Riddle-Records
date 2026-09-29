import { ContentFileConflictError, deleteContentFile, readContentRevision, saveContentFile } from "./contentFiles";
import { buildContentMarkdown, generatedContentFilename, publicationChecks } from "./cmsMarkdown";
import { loadMediaRegistry, MediaRegistryConflictError, saveMediaRegistry } from "./mediaRegistry";
import type { PendingChanges } from "./pendingChanges";
import { validateMediaRegistry } from "../types/media";
import { BatchConflictError, commitBatch } from "./commitBatch";

export class PendingConflictError extends Error {
  constructor(public detail: { target: "content" | "media"; documentId?: string; operation: "save" | "delete"; expectedRevision?: string; currentRevision?: string }) {
    super(detail.target === "media" ? "メディア情報がGitHub側の変更と競合しています" : "GitHub側の変更と競合しています");
  }
}

type Dependencies = {
  readRevision: typeof readContentRevision;
  saveContent: typeof saveContentFile;
  deleteContent: typeof deleteContentFile;
  loadMedia: typeof loadMediaRegistry;
  saveMedia: typeof saveMediaRegistry;
  commitBatch?: typeof commitBatch;
};

const defaults: Dependencies = {
  readRevision: readContentRevision,
  saveContent: saveContentFile,
  deleteContent: deleteContentFile,
  loadMedia: loadMediaRegistry,
  saveMedia: saveMediaRegistry,
  commitBatch
};

export async function applyPendingChanges(initial: PendingChanges, onProgress: (value: PendingChanges) => void, dependencies: Dependencies = defaults, forceTarget?: string): Promise<PendingChanges> {
  let queue = initial;
  for (const item of queue.contents.filter((entry) => !entry.applied)) {
    const doc = item.document;
    const filename = generatedContentFilename(doc);
    if (!filename) throw new Error(`${doc.common.title || "タイトル未設定"}: ファイル名が未設定です`);
    if (item.operation === "save" && doc.placement.kind === "projects" && doc.placement.data.links.some((link) => !link.label.trim() || !link.url.trim())) throw new Error(`${doc.common.title || "Project"}: リンクのラベルとURLを入力するか、空の行を削除してください`);
    if (item.operation === "save" && doc.common.publication === "published" && publicationChecks(doc).some((check) => !check.ok)) throw new Error(`${doc.common.title}: 公開に必要な項目がありません`);
    const actual = await dependencies.readRevision(doc.placement.kind, filename);
    if (actual !== doc.file?.revision && forceTarget !== doc.id) throw new PendingConflictError({ target: "content", documentId: doc.id, operation: item.operation, expectedRevision: doc.file?.revision, currentRevision: actual });
  }
  if (queue.media && !queue.media.applied) {
    const validationError = validateMediaRegistry(queue.media.registry);
    if (validationError) throw new Error(validationError);
    const latest = await dependencies.loadMedia();
    if (latest.revision !== queue.media.expectedRevision && forceTarget !== "media") throw new PendingConflictError({ target: "media", operation: "save", expectedRevision: queue.media.expectedRevision, currentRevision: latest.revision });
  }
  const remaining = queue.contents.filter((entry) => !entry.applied).length + (queue.media && !queue.media.applied ? 1 : 0);
  if (remaining > 1 && dependencies.commitBatch) {
    try {
      const result = await dependencies.commitBatch({
        contents: queue.contents.filter((entry) => !entry.applied).map((entry) => ({ id: entry.document.id, kind: entry.document.placement.kind, path: generatedContentFilename(entry.document), operation: entry.operation, ...(entry.operation === "save" ? { markdown: buildContentMarkdown(entry.document) } : {}), expectedRevision: entry.document.file?.revision, force: forceTarget === entry.document.id })),
        ...(queue.media && !queue.media.applied ? { media: { registry: queue.media.registry, expectedRevision: queue.media.expectedRevision, force: forceTarget === "media" } } : {})
      });
      queue = { ...queue, contents: queue.contents.map((entry) => {
        const saved = result.contents.find((item) => item.id === entry.document.id);
        return saved ? { ...entry, applied: true, document: saved.revision ? { ...entry.document, file: { path: saved.path, revision: saved.revision } } : entry.document } : entry;
      }), media: queue.media && result.mediaRevision ? { ...queue.media, expectedRevision: result.mediaRevision, applied: true } : queue.media, lastCommitSha: result.commitSha };
      onProgress(queue);
      return queue;
    } catch (error) {
      if (error instanceof BatchConflictError) throw new PendingConflictError(error.detail);
      throw error;
    }
  }
  for (let index = 0; index < queue.contents.length; index += 1) {
    const entry = queue.contents[index];
    if (entry.applied) continue;
    const doc = entry.document;
    const filename = generatedContentFilename(doc);
    let completed = entry;
    let commitSha: string | undefined;
    try {
      if (entry.operation === "delete") {
        if (doc.file) { const result = await dependencies.deleteContent(doc.placement.kind, filename, { expectedRevision: doc.file.revision, force: forceTarget === doc.id }); commitSha = result.commitSha; }
      } else {
        const result = await dependencies.saveContent(doc.placement.kind, filename, buildContentMarkdown(doc), { expectedRevision: doc.file?.revision, force: forceTarget === doc.id });
        completed = { ...entry, document: { ...doc, file: { path: result.path, revision: result.revision } } };
        commitSha = result.commitSha;
      }
    } catch (error) {
      if (error instanceof ContentFileConflictError) throw new PendingConflictError({ target: "content", documentId: doc.id, operation: entry.operation, expectedRevision: error.expectedRevision ?? doc.file?.revision, currentRevision: error.currentRevision });
      throw error;
    }
    queue = { ...queue, contents: queue.contents.map((item, itemIndex) => itemIndex === index ? { ...completed, applied: true } : item), lastCommitSha: commitSha ?? queue.lastCommitSha };
    onProgress(queue);
  }
  if (queue.media && !queue.media.applied) {
    let result;
    try { result = await dependencies.saveMedia(queue.media.registry, queue.media.expectedRevision, forceTarget === "media"); }
    catch (error) {
      if (error instanceof MediaRegistryConflictError) throw new PendingConflictError({ target: "media", operation: "save", expectedRevision: queue.media.expectedRevision, currentRevision: error.currentRevision });
      throw error;
    }
    queue = { ...queue, media: { ...queue.media, expectedRevision: result.revision, applied: true }, lastCommitSha: result.commitSha ?? queue.lastCommitSha };
    onProgress(queue);
  }
  return queue;
}
