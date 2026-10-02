import { useMemo, useRef, useState } from "react";
import { contentKindLabels, type ContentDocument, type ContentFileInfo, type ContentKind, type PublicationStatus } from "../types/content";
import { FloatingPanel } from "./FloatingPanel";
import type { ContentFilters } from "../hooks/useCmsNavigation";

export function ContentList({ documents, files, filters, onFilters, disabled = false, pendingIds = [], onOpen, onNew }: { documents: ContentDocument[]; files: ContentFileInfo[]; filters: ContentFilters; onFilters: (value: ContentFilters, replace?: boolean) => void; disabled?: boolean; pendingIds?: string[]; onOpen: (doc: ContentDocument) => void; onNew: (kind: ContentKind) => void }) {
  const { query, kind, publication } = filters;
  const setQuery = (query: string) => onFilters({ ...filters, query }, true);
  const setKind = (kind: "all" | ContentKind) => onFilters({ ...filters, kind });
  const setPublication = (publication: "all" | PublicationStatus) => onFilters({ ...filters, publication });
  const [newMenu, setNewMenu] = useState(false);
  const newTrigger = useRef<HTMLButtonElement>(null);
  const visible = useMemo(() => documents.filter((doc) => doc.placement.kind !== "about" && (kind === "all" || doc.placement.kind === kind) && (publication === "all" || doc.common.publication === publication) && [doc.common.title, doc.common.description, ...doc.common.tags].join(" ").toLowerCase().includes(query.toLowerCase())), [documents, kind, publication, query]);
  return <section className="content-index"><header className="section-heading"><div><p>Content</p><h1>コンテンツ</h1></div><div className="new-content-wrap"><button ref={newTrigger} disabled={disabled} className="primary" aria-expanded={newMenu} onClick={() => setNewMenu(!newMenu)}>新規作成</button>{newMenu && <FloatingPanel anchor={newTrigger} onClose={() => setNewMenu(false)} className="new-content-menu">{contentKindLabels.map((item) => <button key={item.kind} onClick={() => { setNewMenu(false); onNew(item.kind); }}>{item.label}</button>)}</FloatingPanel>}</div></header>
    <div className="filter-bar"><input placeholder="タイトル、説明、タグを検索" value={query} onChange={(event) => setQuery(event.target.value)} /><div className="segmented"><button className={kind === "all" ? "active" : ""} onClick={() => setKind("all")}>すべて</button>{contentKindLabels.map((item) => <button className={kind === item.kind ? "active" : ""} onClick={() => setKind(item.kind)} key={item.kind}>{item.label}</button>)}</div><div className="segmented"><button className={publication === "all" ? "active" : ""} onClick={() => setPublication("all")}>すべて</button><button className={publication === "draft" ? "active" : ""} onClick={() => setPublication("draft")}>下書き</button><button className={publication === "published" ? "active" : ""} onClick={() => setPublication("published")}>公開中</button></div></div>
    <div className="content-table"><div className="content-table-head"><span>タイトル</span><span>配置先</span><span>公開状態</span><span>公開日</span></div>{visible.map((doc) => <button className="content-row" key={doc.id} onClick={() => onOpen(doc)}><span><strong>{doc.common.title || "タイトル未設定"}</strong><small>{doc.common.description || "説明はまだありません"}</small></span><span>{contentKindLabels.find((item) => item.kind === doc.placement.kind)?.label}</span><span><i className={`publication-dot ${doc.common.publication}`} />{pendingIds.includes(doc.id) ? doc.common.publication === "draft" ? "下書き（未反映）" : "公開待ち" : doc.common.publication === "draft" ? "下書き" : "公開中"}</span><time>{doc.common.date || "公開時に設定"}</time></button>)}</div>
    {!visible.length && <div className="empty-state"><h2>該当するコンテンツがありません</h2><p>{files.length ? "検索条件を変えてください。" : "最初のコンテンツを作成できます。"}</p></div>}
  </section>;
}
