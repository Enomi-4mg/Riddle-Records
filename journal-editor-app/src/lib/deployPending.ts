import { deleteContentFile, readContentRevision, saveContentFile } from "./contentFiles";
import { buildContentMarkdown, generatedContentFilename, publicationChecks } from "./cmsMarkdown";
import { loadMediaRegistry, saveMediaRegistry } from "./mediaRegistry";
import type { PendingChanges } from "./pendingChanges";
import { validateMediaRegistry } from "../types/media";

type Dependencies = {
  readRevision: typeof readContentRevision;
  saveContent: typeof saveContentFile;
  deleteContent: typeof deleteContentFile;
  loadMedia: typeof loadMediaRegistry;
  saveMedia: typeof saveMediaRegistry;
};

const defaults: Dependencies = {
  readRevision: readContentRevision,
  saveContent: saveContentFile,
  deleteContent: deleteContentFile,
  loadMedia: loadMediaRegistry,
  saveMedia: saveMediaRegistry
};

export async function applyPendingChanges(initial: PendingChanges, onProgress: (value: PendingChanges) => void, dependencies: Dependencies = defaults): Promise<PendingChanges> {
  let queue = initial;
  for (const item of queue.contents.filter((entry) => !entry.applied)) {
    const doc = item.document;
    const filename = generatedContentFilename(doc);
    if (!filename) throw new Error(`${doc.common.title || "タイトル未設定"}: ファイル名が未設定です`);
    if (item.operation === "save" && doc.common.publication === "published" && publicationChecks(doc).some((check) => !check.ok)) throw new Error(`${doc.common.title}: 公開に必要な項目がありません`);
    const actual = await dependencies.readRevision(doc.placement.kind, filename);
    if (actual !== doc.file?.revision) throw new Error(`${doc.common.title}: GitHub側の変更と競合しています。再読み込みして確認してください`);
  }
  if (queue.media && !queue.media.applied) {
    const validationError = validateMediaRegistry(queue.media.registry);
    if (validationError) throw new Error(validationError);
    const latest = await dependencies.loadMedia();
    if (latest.revision !== queue.media.expectedRevision) throw new Error("メディア情報がGitHub側の変更と競合しています");
  }
  for (let index = 0; index < queue.contents.length; index += 1) {
    const entry = queue.contents[index];
    if (entry.applied) continue;
    const doc = entry.document;
    const filename = generatedContentFilename(doc);
    let completed = entry;
    let commitSha: string | undefined;
    if (entry.operation === "delete") {
      if (doc.file) { const result = await dependencies.deleteContent(doc.placement.kind, filename, { expectedRevision: doc.file.revision }); commitSha = result.commitSha; }
    } else {
      const result = await dependencies.saveContent(doc.placement.kind, filename, buildContentMarkdown(doc), { expectedRevision: doc.file?.revision });
      completed = { ...entry, document: { ...doc, file: { path: result.path, revision: result.revision } } };
      commitSha = result.commitSha;
    }
    queue = { ...queue, contents: queue.contents.map((item, itemIndex) => itemIndex === index ? { ...completed, applied: true } : item), lastCommitSha: commitSha ?? queue.lastCommitSha };
    onProgress(queue);
  }
  if (queue.media && !queue.media.applied) {
    const result = await dependencies.saveMedia(queue.media.registry, queue.media.expectedRevision);
    queue = { ...queue, media: { ...queue.media, applied: true }, lastCommitSha: result.commitSha ?? queue.lastCommitSha };
    onProgress(queue);
  }
  return queue;
}
