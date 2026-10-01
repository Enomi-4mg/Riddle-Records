export function initializeListControls(root = document, storage = () => localStorage) {
  root.querySelectorAll("[data-list-switch]").forEach((control) => {
    if (control.dataset.initialized) return;
    const container = root.getElementById(control.dataset.target);
    if (!container) return;
    control.dataset.initialized = "true";
    const key = `riddle-list-view:${control.dataset.page}`;
    const fallback = control.dataset.defaultView === "list" ? "list" : "grid";
    const apply = (view) => {
      container.dataset.view = ["grid", "list"].includes(view) ? view : fallback;
      control.querySelectorAll("button[data-view]").forEach((button) => {
        const selected = button.dataset.view === container.dataset.view;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    };
    try { apply(storage().getItem(key)); } catch { apply(fallback); }
    control.querySelectorAll("button[data-view]").forEach((button) => button.addEventListener("click", () => {
      apply(button.dataset.view);
      try { storage().setItem(key, container.dataset.view); } catch { /* Storage is optional. */ }
    }));
  });
  root.querySelectorAll("[data-sort-switch]").forEach((control) => {
    if (control.dataset.initialized) return;
    const container = root.getElementById(control.dataset.target);
    if (!container) return;
    control.dataset.initialized = "true";
    const items = [...container.children];
    control.querySelectorAll("button[data-sort]").forEach((button) => button.addEventListener("click", () => {
      const direction = button.dataset.sort === "oldest" ? 1 : -1;
      items.sort((a, b) => direction * ((Date.parse(a.dataset.date) || 0) - (Date.parse(b.dataset.date) || 0)));
      items.forEach((item) => container.appendChild(item));
      control.querySelectorAll("button[data-sort]").forEach((option) => {
        const selected = option === button;
        option.classList.toggle("active", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
    }));
  });
}
