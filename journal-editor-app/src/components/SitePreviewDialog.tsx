import { useEffect, useId, useMemo, useRef, useState } from "react";
import mainCss from "../../../assets/css/main.css?raw";
import animationsCss from "../../../assets/css/animations.css?raw";
import galleryCss from "../../../assets/css/gallery.css?raw";
import journalCss from "../../../assets/css/journal.css?raw";
import embedsCss from "../../../assets/css/embeds.css?raw";
import headerSource from "../../../src/components/Header.astro?raw";
import icon from "../../../favicon/favicon.ico?url";
import { buildPreviewDocument } from "../lib/sitePreview";
import type { ContentDocument } from "../types/content";

const css = [mainCss, animationsCss, galleryCss, journalCss, embedsCss, headerSource.match(/<style is:global>([\s\S]*?)<\/style>/)?.[1] || ""].join("\n");
export function SitePreviewDialog({ document: doc, documents, onClose }: { document: ContentDocument; documents: ContentDocument[]; onClose: () => void }) {
  const trigger = useRef(document.activeElement as HTMLElement | null);
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId(); const [mobile, setMobile] = useState(false);
  const source = useMemo(() => buildPreviewDocument(doc, documents, css, new URL(icon, window.location.href).href), [doc, documents]);
  useEffect(() => {
    dialog.current?.showModal();
    return () => { dialog.current?.close(); if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); };
  }, []);
  return <dialog className="site-preview-dialog" ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="preview-toolbar"><h2 id={titleId}>サイトでの見え方</h2><div className="button-row"><button aria-pressed={!mobile} onClick={() => setMobile(false)}>通常幅</button><button aria-pressed={mobile} onClick={() => setMobile(true)}>375px</button><button autoFocus onClick={onClose}>編集に戻る</button></div></header>
    <p>現在の入力をサイトの書体・レイアウトで表示します。埋め込みの再生、数式・コードの装飾、メニュー等の動作は公開後に確認してください。</p>
    <div className="preview-viewport"><iframe title="公開サイト相当の記事プレビュー" sandbox="" srcDoc={source} className={mobile ? "preview-mobile" : ""} /></div>
  </dialog>;
}
