import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { createContext, useContext, useEffect, useRef } from "react";
import { parseEmbed, renderEmbed, type Embed } from "../../../shared/embeds";
import { initializeXEmbeds } from "../../../shared/xEmbeds";

import type { ContentDocument } from "../types/content";
import { resolveDocumentCard } from "../lib/linkCards";
export const EmbedDocumentsContext = createContext<ContentDocument[]>([]);

function EmbedView({ node, extension, getPos, editor }: NodeViewProps) {
  const root = useRef<HTMLDivElement>(null);
  const data = parseEmbed(JSON.stringify(node.attrs.data)) || { kind: "card", url: "" } as Embed;
  const documents = useContext(EmbedDocumentsContext);
  const html = renderEmbed(data, (url) => resolveDocumentCard(documents, url));
  useEffect(() => { if (root.current) void initializeXEmbeds(root.current); }, [html]);
  return <NodeViewWrapper className="editor-embed" data-editor-embed contentEditable={false}>
    <div className="embed-node-actions"><span>{data.kind === "card" ? "リンクカード" : data.kind}</span><button type="button" onClick={() => extension.options.onEdit(getPos(), data)}>編集</button><button type="button" onClick={() => { const pos = getPos(); if (typeof pos === "number") editor.chain().focus().insertContentAt({ from: pos, to: pos + node.nodeSize }, { type: "paragraph", content: [{ type: "text", text: data.url, marks: [{ type: "link", attrs: { href: data.url } }] }] }).run(); }}>通常リンクにする</button></div>
    <div ref={root} dangerouslySetInnerHTML={{ __html: html }} />
  </NodeViewWrapper>;
}
export const EmbedNode = Node.create<{ onEdit: (pos: number | undefined, data: Embed) => void }>({
  name: "embed", group: "block", atom: true, selectable: true, draggable: true,
  addOptions: () => ({ onEdit: () => {} }),
  addAttributes: () => ({ data: { default: null, parseHTML: (element) => { try { return parseEmbed(decodeURIComponent(element.getAttribute("data-riddle-embed") || "")) || null; } catch { return null; } }, renderHTML: (attrs) => ({ "data-riddle-embed": encodeURIComponent(JSON.stringify(attrs.data)) }) } }),
  parseHTML: () => [{ tag: "div[data-riddle-embed]", getAttrs: (element) => { try { const data = parseEmbed(decodeURIComponent((element as HTMLElement).getAttribute("data-riddle-embed") || "")); return data ? { data } : false; } catch { return false; } } }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes)],
  addNodeView: () => ReactNodeViewRenderer(EmbedView)
});
