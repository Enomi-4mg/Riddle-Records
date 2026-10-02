import { isPublicationDate, publicationDateAt } from "../../../shared/publicationDate";
import type { ContentDocument } from "../types/content";

export function setPublicationDate(doc: ContentDocument, date: string): ContentDocument {
  return { ...doc, common: { ...doc.common, date }, publicationHistory: { ...doc.publicationHistory, hasBeenPublished: doc.publicationHistory?.hasBeenPublished ?? doc.common.publication === "published", dateSource: date ? "manual" : "automatic" } };
}

export function publishDocument(doc: ContentDocument, instant = new Date()): ContentDocument {
  if (doc.placement.kind === "about") return doc;
  const previous = doc.publicationHistory;
  const hasBeenPublished = previous?.hasBeenPublished || doc.common.publication === "published";
  // Old browser drafts had an automatically assigned creation date and no history.
  const manual = previous?.dateSource === "manual" || (!previous && doc.source !== "manual" && isPublicationDate(doc.common.date));
  const date = hasBeenPublished || manual ? doc.common.date : publicationDateAt(instant);
  return { ...doc, common: { ...doc.common, date, publication: "published" }, publicationHistory: {
    hasBeenPublished: true,
    dateSource: manual ? "manual" : previous?.dateSource || "automatic",
    firstPublishedAt: previous?.firstPublishedAt || (!hasBeenPublished ? instant.toISOString() : undefined)
  } };
}
