import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "../lib/mediaRegistry";
import type { ArticleDefaults } from "../lib/articleDefaults";
import type { MediaRegistry } from "../types/media";
import { MediaLibrary } from "./MediaLibrary";

export function ArticleDefaultsDialog({ value, registry, onSave, onClose }: { value: ArticleDefaults; registry: MediaRegistry; onSave: (value: ArticleDefaults) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value);
  const [picking, setPicking] = useState<"thumbnail" | "ogImage" | null>(null);
  const update = (key: keyof ArticleDefaults, input: string) => setDraft((current) => ({ ...current, [key]: input }));
  useEffect(() => {
    const root = document.getElementById("root");
    const previousOverflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    return () => { if (root) root.inert = false; document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (picking) setPicking(null);
      else onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [picking, onClose]);
  return createPortal(<div className="modal-backdrop article-defaults-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="media-dialog article-defaults-dialog" role="dialog" aria-modal="true" aria-label="記事のデフォルト設定" onSubmit={(event) => { event.preventDefault(); onSave({ thumbnail: draft.thumbnail.trim(), thumbnailAlt: draft.thumbnailAlt.trim(), ogImage: draft.ogImage.trim() }); }}>
      <div className="dialog-heading"><div><p>Journal</p><h2>記事のデフォルト設定</h2></div><button type="button" onClick={onClose}>閉じる</button></div>
      <p className="dialog-help">新しく作るJournal記事に適用します。記事ごとの設定で変更できます。この設定は現在のブラウザに保存されます。</p>
      <label>デフォルトのサムネイル<span className="input-with-action"><input value={draft.thumbnail} onChange={(event) => update("thumbnail", event.target.value)} placeholder="画像URL または Cloudinary public ID" /><button type="button" onClick={() => setPicking("thumbnail")}>選択</button></span></label>
      <label>サムネイルの代替テキスト<input value={draft.thumbnailAlt} onChange={(event) => update("thumbnailAlt", event.target.value)} placeholder="画像の内容を説明" /></label>
      <label>デフォルトのOG画像<span className="input-with-action"><input value={draft.ogImage} onChange={(event) => update("ogImage", event.target.value)} placeholder="画像URL または Cloudinary public ID" /><button type="button" onClick={() => setPicking("ogImage")}>選択</button></span></label>
      {(draft.thumbnail || draft.ogImage) && <div className="defaults-previews">{draft.thumbnail && <figure><img src={mediaUrl(draft.thumbnail, "image", "w_400,h_400,c_fill,q_auto,f_auto")} alt={draft.thumbnailAlt || "サムネイルのプレビュー"} /><figcaption>サムネイル</figcaption></figure>}{draft.ogImage && <figure><img src={mediaUrl(draft.ogImage, "image", "w_600,h_315,c_fill,q_auto,f_auto")} alt="OG画像のプレビュー" /><figcaption>OG画像</figcaption></figure>}</div>}
      <div className="button-row dialog-actions"><button type="button" onClick={onClose}>キャンセル</button><button className="primary" type="submit">設定を保存</button></div>
    </form>
    {picking && <div className="modal-backdrop media-picker" role="dialog" aria-modal="true" aria-label="画像を選択" onMouseDown={(event) => { if (event.target === event.currentTarget) setPicking(null); }}><div className="media-picker-panel"><header className="dialog-heading"><h2>画像を選択</h2><button onClick={() => setPicking(null)}>閉じる</button></header><MediaLibrary registry={{ ...registry, assets: registry.assets.filter((asset) => asset.type === "image") }} onSelect={(asset) => { update(picking, asset.publicId); if (picking === "thumbnail" && !draft.thumbnailAlt) update("thumbnailAlt", asset.alt || asset.displayName); setPicking(null); }} /></div></div>}
  </div>, document.body);
}
