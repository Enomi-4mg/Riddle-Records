type Twitter = { widgets: { createTweet: (id: string, element: HTMLElement, options: object) => Promise<HTMLElement | undefined> } };
let loader: Promise<Twitter> | undefined;
function loadWidgets() {
  if ((window as Window & { twttr?: Twitter }).twttr?.widgets) return Promise.resolve((window as Window & { twttr?: Twitter }).twttr!);
  if (!loader) loader = new Promise<Twitter>((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://platform.twitter.com/widgets.js"; script.async = true;
    const timeout = window.setTimeout(() => { script.remove(); loader = undefined; reject(new Error("Xの読み込みに失敗しました")); }, 12000);
    script.onload = () => { clearTimeout(timeout); const api = (window as Window & { twttr?: Twitter }).twttr; if (api?.widgets) resolve(api); else { loader = undefined; reject(new Error("X unavailable")); } };
    script.onerror = () => { clearTimeout(timeout); script.remove(); loader = undefined; reject(new Error("X unavailable")); };
    document.head.append(script);
  });
  return loader;
}
export async function initializeXEmbeds(root: ParentNode) {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-x-post]:not([data-x-initialized])"));
  if (!nodes.length) return;
  nodes.forEach((node) => { node.dataset.xInitialized = "true"; });
  try {
    const api = await loadWidgets();
    await Promise.all(nodes.map(async (node) => {
      if (!node.isConnected) return;
      const target = document.createElement("div"); node.prepend(target);
      try { await api.widgets.createTweet(node.dataset.xPost!, target, { dnt: true, theme: "light" }); } catch { target.remove(); }
    }));
  } catch { /* Keep the source link when scripts are blocked. */ }
}
