export type EmbedKind = "card" | "youtube" | "x" | "spotify";
export type Embed = { kind: EmbedKind; url: string; title?: string; description?: string; image?: string };
export type LinkMetadata = { title: string; description: string; image: string };
export type InternalCard = LinkMetadata & { url: string };
export type CardResolver = (url: string) => InternalCard | undefined;
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));

export function safeLink(value: string): string {
  if (!value || /[\u0000-\u0020\\]/.test(value)) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
export function internalPath(value: string, origin = "https://4mg.dev", base = "/"): string | undefined {
  const safe = safeLink(value); if (!safe) return;
  const url = new URL(safe, origin);
  if (url.origin !== new URL(origin).origin) return;
  let path = url.pathname.replace(/\/index\.html$/, "/");
  if (base !== "/" && path.startsWith(base)) path = `/${path.slice(base.length)}`;
  return `${path.replace(/\/+$/, "")}/`;
}
export function serviceId(kind: EmbedKind, value: string): string {
  const safe = safeLink(value); if (!safe || safe.startsWith("/")) return "";
  const url = new URL(safe); const host = url.hostname.replace(/^www\./, "");
  if (kind === "youtube") {
    const id = host === "youtu.be" ? url.pathname.slice(1) : ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host) ? url.pathname === "/watch" ? url.searchParams.get("v") || "" : url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})\/?$/)?.[1] || "" : "";
    return /^[\w-]{11}$/.test(id) ? id : "";
  }
  if (kind === "x" && ["x.com", "twitter.com", "mobile.twitter.com"].includes(host)) return url.pathname.match(/^\/(?:[\w]+\/status|i\/web\/status)\/(\d+)\/?$/)?.[1] || "";
  if (kind === "spotify" && host === "open.spotify.com") return url.pathname.match(/^\/(?:intl-[a-z]+\/)?(?:embed\/)?((?:track|album|playlist|episode|show|artist)\/[a-zA-Z0-9]+)\/?$/)?.[1] || "";
  return "";
}
export function detectEmbedKind(url: string): EmbedKind {
  return (["youtube", "x", "spotify"] as const).find((kind) => serviceId(kind, url)) || "card";
}
export function parseEmbed(value: string): Embed | undefined {
  try {
    const data = JSON.parse(value);
    if (!data || !["card", "youtube", "x", "spotify"].includes(data.kind) || typeof data.url !== "string" || !safeLink(data.url)) return;
    if (data.kind !== "card" && !serviceId(data.kind, data.url)) return;
    const embed: Embed = { kind: data.kind, url: safeLink(data.url) };
    for (const key of ["title", "description", "image"] as const) {
      if (data[key] !== undefined && typeof data[key] !== "string") return;
      if (data[key]) embed[key] = key === "image" ? safeLink(data[key]) : data[key].slice(0, key === "description" ? 4000 : 1000);
    }
    return embed;
  } catch { return; }
}
export function embedMarkdown(embed: Embed) { return `\`\`\`riddle-embed\n${JSON.stringify(embed, null, 2)}\n\`\`\``; }
export function renderEmbed(embed: Embed, resolve?: CardResolver, origin = "https://4mg.dev", base = "/"): string {
  const validated = parseEmbed(JSON.stringify(embed)); if (!validated) return "";
  let { url, title, description, image } = validated;
  const internal = internalPath(url, origin, base);
  if (embed.kind === "card" && internal) {
    const card = resolve?.(url);
    if (!card) return `<p class="embed-fallback"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`;
    ({ url, title, description, image } = card);
  }
  const href = escapeHtml(url); const label = escapeHtml(title || url);
  if (embed.kind === "card") {
    const imageUrl = image && safeLink(image);
    return `<a class="embed-card" href="${href}">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">` : ""}<span class="embed-card-copy"><strong>${label}</strong>${description ? `<span class="embed-card-description">${escapeHtml(description)}</span>` : ""}<small>${escapeHtml(internal ? "Riddle Records" : new URL(url).hostname)}</small></span></a>`;
  }
  const id = serviceId(embed.kind, url);
  const fallback = `<a class="embed-source" href="${href}" target="_blank" rel="noopener noreferrer">${label}を開く</a>`;
  if (embed.kind === "x") return `<figure class="content-embed embed-x" data-x-post="${id}">${fallback}</figure>`;
  const src = embed.kind === "youtube" ? `https://www.youtube-nocookie.com/embed/${id}` : `https://open.spotify.com/embed/${id}`;
  return `<figure class="content-embed embed-${embed.kind}"><iframe src="${src}" title="${escapeHtml(title || (embed.kind === "youtube" ? "YouTube動画" : "Spotify"))}" loading="lazy" allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>${fallback}</figure>`;
}
