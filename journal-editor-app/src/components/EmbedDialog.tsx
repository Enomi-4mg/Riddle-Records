import { useEffect, useRef, useState } from "react";
import { initializeXEmbeds } from "../../../shared/xEmbeds";
import { detectEmbedKind, internalPath, parseEmbed, safeLink, renderEmbed, type Embed, type EmbedKind, type LinkMetadata } from "../../../shared/embeds";
import type { ContentDocument } from "../types/content";
import { publishedCards, resolveDocumentCard } from "../lib/linkCards";

export function EmbedDialog({ initial, documents, onSave, onClose }: { initial: Embed; documents: ContentDocument[]; onSave: (embed: Embed) => void; onClose: () => void }) {
  const [data, setData] = useState(initial); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [refresh, setRefresh] = useState(0);
  const fetchedUrl = useRef(initial.title || initial.description || initial.image ? initial.url : "");
  const preview = useRef<HTMLDivElement>(null);
  const editVersion = useRef(0); const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (data.kind !== "card" || !safeLink(data.url)) return;
    const internal = internalPath(data.url);
    if (internal) { setNotice(resolveDocumentCard(documents, data.url) ? "公開時は参照記事の最新情報を表示します。" : "参照先が見つかりません。公開時は通常リンクになります。"); return; }
    if (fetchedUrl.current === data.url && refresh === 0) return;
    const controller = new AbortController(); const version = editVersion.current;
    const timer = setTimeout(async () => {
      setBusy(true); setNotice("リンク情報を取得中…");
      try {
        const response = await fetch("/api/link-metadata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: data.url }), signal: controller.signal });
        const result = await response.json() as LinkMetadata & { error?: string };
        if (!response.ok) throw new Error(result.error || "取得できませんでした");
        if (!controller.signal.aborted && editVersion.current === version) { setData((current) => ({ ...current, title: result.title, description: result.description, image: result.image })); setNotice("取得しました。各項目は修正できます。"); fetchedUrl.current = data.url; } else if (!controller.signal.aborted) setNotice("入力した内容を保持しました。必要なら再取得してください。");
      } catch (error) { if (!controller.signal.aborted) setNotice(`${error instanceof Error ? error.message : "取得できませんでした"}。手動入力できます。`); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); setBusy(false); };
  }, [data.url, data.kind, refresh, documents]);
  const update = (key: keyof Embed, value: string) => { editVersion.current += 1; setData((current) => key === "url" && value !== current.url ? { kind: current.kind, url: value } : { ...current, [key]: value }); };
  const valid = parseEmbed(JSON.stringify(data)); const cards = publishedCards(documents);
  const previewHtml = valid ? renderEmbed(valid, (url) => resolveDocumentCard(documents, url)) : "";
  useEffect(() => { if (preview.current) void initializeXEmbeds(preview.current); }, [previewHtml]);
  return <dialog ref={dialog} className="embed-dialog" onCancel={onClose}>
    <form onSubmit={(event) => { event.preventDefault(); if (valid) onSave(valid); }}>
      <header><h2>リンク・埋め込み</h2><button type="button" onClick={onClose}>閉じる</button></header>
      <label>表示方法<select value={data.kind} onChange={(event) => update("kind", event.target.value as EmbedKind)}><option value="card">リンクカード</option><option value="youtube">YouTube</option><option value="x">Xの投稿</option><option value="spotify">Spotify</option></select></label>
      <label>URL<input autoFocus value={data.url} onChange={(event) => update("url", event.target.value)} placeholder="https://… または /journal/…/" /></label>
      <button type="button" onClick={() => update("kind", detectEmbedKind(data.url))}>URLからサービスを判定</button>
      {data.kind === "card" && <><label>サイト内の記事<select value={cards.some((card) => card.url === data.url) ? data.url : ""} onChange={(event) => { if (event.target.value) update("url", event.target.value); }}><option value="">URLを入力／記事を選択</option>{cards.map((card) => <option key={card.url} value={card.url}>{card.title} · {card.url}</option>)}</select></label>{!internalPath(data.url) && <><button type="button" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>情報を再取得</button><label>タイトル<input value={data.title || ""} onChange={(event) => update("title", event.target.value)} /></label><label>説明<textarea rows={3} value={data.description || ""} onChange={(event) => update("description", event.target.value)} /></label><label>画像URL<input value={data.image || ""} onChange={(event) => update("image", event.target.value)} /></label></>}</>}
      <p role="status">{notice}</p>
      {!valid && <p className="bad">対応するURLを入力してください。</p>}
      {valid && <div ref={preview} className="embed-dialog-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />}
      <button className="primary" disabled={!valid}>挿入・更新</button>
    </form>
  </dialog>;
}
