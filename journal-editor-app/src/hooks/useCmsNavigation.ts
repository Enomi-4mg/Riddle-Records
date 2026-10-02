import { useSyncExternalStore } from "react";
import { isContentKind, type ContentKind, type PublicationStatus } from "../types/content";

export type Screen = "content" | "editor" | "media" | "about";
export type ContentFilters = { kind: "all" | ContentKind; publication: "all" | PublicationStatus; query: string };
const event = "riddle-cms-navigation";
const subscribe = (listener: () => void) => {
  window.addEventListener("popstate", listener);
  window.addEventListener(event, listener);
  return () => { window.removeEventListener("popstate", listener); window.removeEventListener(event, listener); };
};
export function readNavigation(search: string) {
  const params = new URLSearchParams(search);
  const screen = params.get("screen");
  const kind = params.get("kind"), publication = params.get("publication");
  return {
    screen: (["editor", "media", "about"].includes(screen || "") ? screen : "content") as Screen,
    documentId: params.get("document"),
    filters: { kind: isContentKind(kind) ? kind : "all", publication: publication === "draft" || publication === "published" ? publication : "all", query: params.get("q") || "" } as ContentFilters
  };
}
export function useCmsNavigation() {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  const navigation = readNavigation(search);
  function update(values: Record<string, string | null>, replace = false) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href === window.location.href) return;
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    window.dispatchEvent(new Event(event));
  }
  return { ...navigation,
    navigate: (screen: Screen, documentId?: string) => update({ screen: screen === "content" ? null : screen, document: documentId || null }),
    setFilters: (filters: ContentFilters, replace = false) => update({ kind: filters.kind === "all" ? null : filters.kind, publication: filters.publication === "all" ? null : filters.publication, q: filters.query }, replace)
  };
}
