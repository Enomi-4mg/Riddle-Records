document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".menu_toggle");
  const sidebar = document.querySelector(".sidebar");
  toggle?.addEventListener("click", () => {
    const open = sidebar?.classList.toggle("show");
    toggle.setAttribute("aria-expanded", String(Boolean(open)));
  });
});
