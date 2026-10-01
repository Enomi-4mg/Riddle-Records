import { parse } from "parse5";
import { safeLink, type LinkMetadata } from "./embeds";

const MAX_BYTES = 1_048_576;
export function publicAddress(value: string): boolean {
  if (value.includes(":")) {
    // Parse a canonical URL host so expanded/mapped representations cannot bypass checks.
    let canonical: string;
    try { canonical = new URL(`https://[${value}]/`).hostname.slice(1, -1); } catch { return false; }
    const [first, second] = canonical.split(":").map((part) => parseInt(part || "0", 16));
    return first >= 0x2000 && first <= 0x3ffe && first !== 0x2002 && !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8));
  }
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a,b] = parts.map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && [0,168].includes(b) || a === 198 && [18,19,51].includes(b) || a === 203 && b === 0 || a === 100 && b >= 64 && b <= 127);
}
export function metadataUrl(value: unknown): URL {
  if (typeof value !== "string" || value.length > 4096) throw new Error("URLを確認してください");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443" || !url.hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(url.hostname) || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(":")) throw new Error("公開されたHTTPSページのURLを入力してください");
  url.hash = "";
  return url;
}
type HtmlNode = { nodeName: string; tagName?: string; attrs?: Array<{ name: string; value: string }>; value?: string; childNodes?: HtmlNode[] };
export function extractMetadata(html: string, url: URL): LinkMetadata {
  const tree = parse(html) as HtmlNode;
  const meta = new Map<string, string>(); let title = "";
  const text = (node: HtmlNode): string => node.value || (node.childNodes || []).map(text).join("");
  const visit = (node: HtmlNode) => {
    if (node.tagName === "title" && !title) title = text(node);
    if (node.tagName === "meta") {
      const attrs = Object.fromEntries((node.attrs || []).map((attr) => [attr.name, attr.value]));
      const key = (attrs.property || attrs.name || "").toLowerCase();
      if (attrs.content && !meta.has(key)) meta.set(key, attrs.content);
    }
    node.childNodes?.forEach(visit);
  }; visit(tree);
  let image = "";
  try { image = safeLink(new URL(meta.get("og:image") || meta.get("twitter:image") || "", url).href); } catch { /* Image is optional. */ }
  if (!meta.get("og:image") && !meta.get("twitter:image")) image = "";
  return { title: (meta.get("og:title") || title || url.hostname).trim().slice(0,1000), description: (meta.get("og:description") || meta.get("description") || "").trim().slice(0,4000), image };
}
export type PageFetcher = (url: URL, addresses: string[], signal: AbortSignal) => Promise<Response>;
export async function fetchLinkMetadata(value: unknown, fetcher: typeof fetch = fetch, pageFetcher?: PageFetcher): Promise<LinkMetadata> {
  let url = metadataUrl(value);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
  try {
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      const results = await Promise.all(["A","AAAA"].map(async (type) => {
        const response = await fetcher(`https://dns.google/resolve?name=${encodeURIComponent(url.hostname)}&type=${type}`, { signal: controller.signal, redirect: "error", headers: { Accept: "application/dns-json" } });
        if (!response.ok) throw new Error("リンク先を確認できませんでした");
        const data = await response.json() as { Status?: number; Answer?: Array<{ type: number; data: string }> };
        if (data.Status !== 0) throw new Error("リンク先を確認できませんでした");
        return (data.Answer || []).filter((answer) => [1,28].includes(answer.type)).map((answer) => answer.data);
      }));
      const addresses = results.flat();
      if (!addresses.length || addresses.some((address) => !publicAddress(address))) throw new Error("公開ネットワークのページのみ取得できます");
      const response = pageFetcher ? await pageFetcher(url, addresses, controller.signal) : await fetcher(url, { signal: controller.signal, redirect: "manual", headers: { Accept: "text/html" } });
      if ([301,302,303,307,308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new Error("リダイレクトが多すぎます");
        url = metadataUrl(new URL(location, url).href); continue;
      }
      if (!response.ok || !/^(?:text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get("content-type") || "")) { await response.body?.cancel(); throw new Error("HTMLページの情報を取得できませんでした"); }
      if (Number(response.headers.get("content-length")) > MAX_BYTES) { await response.body?.cancel(); throw new Error("ページが大きすぎます"); }
      const reader = response.body?.getReader(); if (!reader) throw new Error("ページを読み込めませんでした");
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const { done, value: chunk } = await reader.read(); if (done) break;
        size += chunk.length;
        if (size > MAX_BYTES) { await reader.cancel(); throw new Error("ページが大きすぎます"); }
        chunks.push(chunk);
      }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return extractMetadata(new TextDecoder().decode(bytes), url);
    }
    throw new Error("ページを取得できませんでした");
  } catch (error) {
    if (controller.signal.aborted) throw new Error("リンク情報の取得がタイムアウトしました");
    throw error;
  } finally { clearTimeout(timer); }
}
