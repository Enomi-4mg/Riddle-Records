import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
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
  const listPositions = useRef(new Map<string, number>());
  const restoring = useRef(false);
  const listKey = (url: URL) => { const params = new URLSearchParams(url.search); params.delete("screen"); params.delete("document"); return params.toString(); };
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const remember = () => {
      if (restoring.current) return;
      window.history.replaceState({ ...window.history.state, cmsScroll: window.scrollY }, "");
      if (readNavigation(window.location.search).screen === "content") listPositions.current.set(listKey(new URL(window.location.href)), window.scrollY);
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => { window.removeEventListener("scroll", remember); window.history.scrollRestoration = previous; };
  }, []);
  useLayoutEffect(() => {
    const target = Math.max(0, Number(window.history.state?.cmsScroll) || 0);
    restoring.current = true;
    let observer: MutationObserver | undefined;
    const restore = () => {
      window.scrollTo({ top: target, left: 0, behavior: "instant" });
      if (Math.abs(window.scrollY - target) < 1) { restoring.current = false; observer?.disconnect(); }
    };
    // A history entry may mount before its documents have loaded. Retry after DOM changes.
    observer = new window.MutationObserver(restore); observer.observe(document.body, { childList: true, subtree: true });
    restore();
    const cancel = () => { restoring.current = false; observer?.disconnect(); };
    window.addEventListener("wheel", cancel, { passive: true }); window.addEventListener("touchstart", cancel, { passive: true }); window.addEventListener("keydown", cancel);
    return () => { cancel(); window.removeEventListener("wheel", cancel); window.removeEventListener("touchstart", cancel); window.removeEventListener("keydown", cancel); };
  }, [search]);
  function update(values: Record<string, string | null>, replace = false) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href === window.location.href) return;
    const y = window.scrollY;
    const current = readNavigation(window.location.search), next = readNavigation(url.search);
    if (current.screen === "content") listPositions.current.set(listKey(new URL(window.location.href)), y);
    window.history.replaceState({ ...window.history.state, cmsScroll: y }, "");
    const transition = current.screen !== next.screen || current.documentId !== next.documentId;
    const top = transition ? next.screen === "content" ? listPositions.current.get(listKey(url)) || 0 : 0 : y;
    window.history[replace ? "replaceState" : "pushState"]({ ...window.history.state, cmsScroll: top }, "", url);
    window.dispatchEvent(new Event(event));
  }
  return { ...navigation,
    navigate: (screen: Screen, documentId?: string, replace = false) => update({ screen: screen === "content" ? null : screen, document: documentId || null }, replace),
    setFilters: (filters: ContentFilters, replace = false) => update({ kind: filters.kind === "all" ? null : filters.kind, publication: filters.publication === "all" ? null : filters.publication, q: filters.query }, replace)
  };
}
