export function initializeGalleryViewers(root = document) {
  root.querySelectorAll("[data-gallery-viewer]").forEach((viewer) => {
    if (viewer.dataset.initialized) return;
    viewer.dataset.initialized = "true";
    const doc = viewer.ownerDocument;
    const win = doc.defaultView;
    const works = JSON.parse(viewer.querySelector("[data-viewer-data]").textContent);
    const stage = viewer.querySelector("[data-stage]");
    const menu = viewer.querySelector("#viewer-menu");
    const info = viewer.querySelector("#viewer-info");
    let filter = "all";
    let selected;
    const sequence = () => works.filter((work) => filter === "all" || work.kind === filter);
    const text = (selector, value) => { viewer.querySelector(selector).textContent = value || ""; };
    const siteUrl = (url) => /^https?:\/\//.test(url) ? url : `${viewer.dataset.base}${url.replace(/^\/+/, "")}`;
    function closePanels(restore = true) {
      const opener = !menu.hidden ? "menu" : !info.hidden ? "info" : null;
      menu.hidden = info.hidden = true;
      viewer.querySelectorAll(".viewer-topbar, [data-stage], [data-step]").forEach(element => { element.inert = false; });
      viewer.querySelectorAll("[data-open]").forEach((button) => button.setAttribute("aria-expanded", "false"));
      if (restore && opener) viewer.querySelector(`[data-open="${opener}"]`).focus();
    }
    function updateUrl() {
      const url = new URL(win.location.href);
      if (selected) url.searchParams.set("work", selected.id); else url.searchParams.delete("work");
      if (filter === "all") url.searchParams.delete("filter"); else url.searchParams.set("filter", filter);
      win.history.replaceState(null, "", url);
    }
    function show(id, writeUrl = true) {
      const items = sequence();
      const next = items.find((work) => work.id === id) || items[0];
      // Keep a playing video mounted while opening panels or selecting its active filter.
      if (next?.id !== selected?.id || !selected) {
        stage.replaceChildren();
        if (!next) {
          const empty = doc.createElement("p"); empty.textContent = "この種別の作品はまだありません。"; stage.append(empty);
        } else if (next.kind === "visual") {
          const image = doc.createElement("img"); image.src = next.image; image.alt = next.imageAlt; stage.append(image);
        } else {
          const frame = doc.createElement("iframe"); frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(next.youtubeId)}`;
          frame.title = next.title; frame.allow = "encrypted-media; picture-in-picture"; frame.allowFullscreen = true; stage.append(frame);
        }
      }
      selected = next;
      viewer.querySelectorAll("[data-kind]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.kind === filter)));
      viewer.querySelectorAll("[data-kind-item]").forEach((item) => { item.hidden = filter !== "all" && item.dataset.kindItem !== filter; });
      viewer.querySelectorAll("[data-work]").forEach((button) => {
        if (button.dataset.work === selected?.id) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current");
      });
      viewer.querySelector("[data-empty]").hidden = items.length !== 0;
      const index = items.indexOf(selected);
      viewer.querySelector('[data-step="-1"]').disabled = index <= 0;
      viewer.querySelector('[data-step="1"]').disabled = index < 0 || index >= items.length - 1;
      text("[data-status]", selected ? `${index + 1} / ${items.length}：${selected.title}` : "作品はありません");
      text("[data-info-title]", selected?.title); text("[data-info-date]", selected?.date);
      viewer.querySelector("[data-info-date]").setAttribute("datetime", selected?.date || "");
      text("[data-info-description]", selected?.description); text("[data-info-credits]", selected?.credits);
      viewer.querySelector("[data-credits-section]").hidden = !selected?.credits;
      const tags = viewer.querySelector("[data-info-tags]"); tags.replaceChildren();
      for (const tag of selected?.tags || []) { const span = doc.createElement("span"); span.className = "work-tag"; span.textContent = tag; tags.append(span); }
      const links = viewer.querySelector("[data-info-links]"); links.replaceChildren();
      for (const link of selected?.links || []) { const anchor = doc.createElement("a"); anchor.href = siteUrl(link.url); anchor.textContent = link.label; links.append(anchor); }
      if (writeUrl) updateUrl();
    }
    function step(direction) {
      const items = sequence(); const index = items.indexOf(selected); const next = items[index + direction];
      if (next) show(next.id);
    }
    viewer.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => {
      const panel = button.dataset.open === "menu" ? menu : info;
      const opening = panel.hidden; closePanels(false); panel.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
      if (opening) {
        viewer.querySelectorAll(".viewer-topbar, [data-stage], [data-step]").forEach(element => { element.inert = true; });
        panel.querySelector("button").focus();
      }
    }));
    viewer.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closePanels()));
    viewer.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => step(Number(button.dataset.step))));
    viewer.querySelectorAll("[data-kind]").forEach((button) => button.addEventListener("click", () => { filter = button.dataset.kind; show(selected?.id); }));
    viewer.querySelectorAll("[data-work]").forEach((button) => button.addEventListener("click", () => { show(button.dataset.work); closePanels(false); stage.focus(); }));
    const onKey = (event) => {
      const panel = !menu.hidden ? menu : !info.hidden ? info : null;
      if (panel && event.key === "Tab") {
        const controls = Array.from(panel.querySelectorAll("button:not(:disabled), a[href], [tabindex=\"0\"]")).filter(element => !element.closest("[hidden]"));
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && (doc.activeElement === first || !panel.contains(doc.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (doc.activeElement === last || !panel.contains(doc.activeElement))) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.key === "Escape") { closePanels(); return; }
      if (!menu.hidden || !info.hidden || /INPUT|TEXTAREA|SELECT|IFRAME/.test(event.target.tagName) || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); step(event.key === "ArrowLeft" ? -1 : 1); }
    };
    doc.addEventListener("keydown", onKey);
    let touch;
    stage.addEventListener("touchstart", (event) => { touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }, { passive: true });
    stage.addEventListener("touchend", (event) => {
      if (!touch || !menu.hidden || !info.hidden || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - touch.x; const dy = event.changedTouches[0].clientY - touch.y; touch = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }, { passive: true });
    stage.addEventListener("touchcancel", () => { touch = null; }, { passive: true });
    function readUrl() {
      const params = new URL(win.location.href).searchParams;
      filter = ["visual", "music"].includes(params.get("filter")) ? params.get("filter") : "all";
      let legacyHash = "";
      try { legacyHash = decodeURIComponent(win.location.hash.slice(1)); } catch { /* An invalid old hash falls back to the first work. */ }
      const id = params.get("work") || works.find((work) => work.legacyHash === legacyHash)?.id;
      // An explicit work outside the requested filter still opens that work.
      const requested = works.find((work) => work.id === id);
      if (requested && filter !== "all" && requested.kind !== filter) filter = "all";
      show(id, false);
    }
    readUrl();
    const onHistory = () => readUrl(); win.addEventListener("popstate", onHistory); win.addEventListener("hashchange", onHistory);
    doc.addEventListener("astro:before-swap", () => { win.removeEventListener("popstate", onHistory); win.removeEventListener("hashchange", onHistory); doc.removeEventListener("keydown", onKey); }, { once: true });
  });
}
