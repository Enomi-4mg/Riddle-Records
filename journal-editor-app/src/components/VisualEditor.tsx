import { EmbedNode, EmbedDocumentsContext } from "./EmbedNode";
import { useDismissable } from "../hooks/useDismissable";
import { FloatingPanel } from "./FloatingPanel";
import { EmbedDialog } from "./EmbedDialog";
import { detectEmbedKind, safeLink, type Embed } from "../../../shared/embeds";
import type { ContentDocument } from "../types/content";
import { Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { decodeRawHtml, editorHtmlToMarkdown, encodeRawHtml, markdownToEditorHtml } from "../lib/editorMarkdown";

export type EditorImage = { src: string; alt: string; title?: string };

const RawHtml = Node.create({
  name: "rawHtml", group: "block", atom: true, selectable: true,
  addAttributes: () => ({ raw: { default: "", parseHTML: (element) => decodeRawHtml(element.getAttribute("data-raw-html") || ""), renderHTML: (attributes) => ({ "data-raw-html": encodeRawHtml(attributes.raw) }) } }),
  parseHTML: () => [{ tag: "div[data-raw-html]", getAttrs: (element) => ({ raw: decodeRawHtml((element as HTMLElement).getAttribute("data-raw-html") || "") }) }],
  renderHTML: ({ HTMLAttributes }) => ["div", { ...HTMLAttributes, class: "raw-html-block" }, ["span", {}, "HTML互換ブロック"], ["small", {}, "クリックして選択・メニューから編集"]]
});

type BlockInfo = { pos: number; top: number; nodeType: string };
type BlockKind = "paragraph" | "heading1" | "heading2" | "heading3" | "heading4" | "heading5" | "heading6" | "bulletList" | "orderedList" | "taskList" | "blockquote" | "codeBlock" | "image" | "table" | "horizontalRule" | "rawHtml" | "embed";

const blockLabels: Record<BlockKind, string> = {
  paragraph: "テキスト", heading1: "見出し H1", heading2: "見出し H2", heading3: "見出し H3", heading4: "見出し H4", heading5: "見出し H5", heading6: "見出し H6",
  bulletList: "箇条書き", orderedList: "番号付きリスト", taskList: "タスクリスト", blockquote: "引用", codeBlock: "コード", image: "画像", table: "表", horizontalRule: "区切り線", rawHtml: "HTML", embed: "リンク・埋め込み"
};
const basicKinds: BlockKind[] = ["paragraph", "heading1", "heading2", "heading3", "heading4", "heading5", "heading6", "bulletList", "orderedList", "taskList", "blockquote"];
const otherKinds: BlockKind[] = ["embed", "codeBlock", "table", "horizontalRule", "rawHtml"];

function blockElement(target: EventTarget | null, root: HTMLElement) {
  if (!(target instanceof HTMLElement)) return null;
  const embed = target.closest("[data-editor-embed]") as HTMLElement | null;
  if (embed && root.contains(embed)) return embed;
  const candidate = target.closest("li, table, pre, blockquote, img, hr, .raw-html-block, [data-editor-embed], h1, h2, h3, h4, h5, h6, p") as HTMLElement | null;
  return candidate && root.contains(candidate) ? candidate : null;
}

function nodeKind(element: HTMLElement): string {
  if (element.matches("[data-editor-embed]")) return "embed";
  if (element.matches("li[data-checked]")) return "taskItem";
  if (element.tagName === "LI") return "listItem";
  if (element.tagName === "IMG") return "image";
  if (element.tagName === "TABLE") return "table";
  if (element.tagName === "PRE") return "codeBlock";
  if (element.tagName === "BLOCKQUOTE") return "blockquote";
  if (element.tagName === "HR") return "horizontalRule";
  if (element.classList.contains("raw-html-block")) return "rawHtml";
  return element.tagName.toLowerCase();
}

export function VisualEditor({ value, onChange, onOpenMedia, documents = [], editable = true }: { editable?: boolean; documents?: ContentDocument[]; value: string; onChange: (markdown: string) => void; onOpenMedia: (insert: (image: EditorImage) => void) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingPos = useRef<number | null>(null);
  const addHandle = useRef<HTMLButtonElement>(null);
  const moveHandle = useRef<HTMLButtonElement>(null);
  const [dropMarker, setDropMarker] = useState<{ top: number; left: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const pasteRegion = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<BlockInfo | null>(null);
  const [menu, setMenu] = useState<"add" | "actions" | null>(null);
  const [slash, setSlash] = useState<{ query: string; left: number; top: number } | null>(null);
  const [embedEdit, setEmbedEdit] = useState<{ data: Embed; from?: number; to?: number; expected?: string } | null>(null);
  const [pasted, setPasted] = useState<{ url: string; pos: number } | null>(null);
  useDismissable(Boolean(pasted), () => setPasted(null), [pasteRegion]);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false }), Image.configure({ allowBase64: false }), TaskList, TaskItem.configure({ nested: true }), TableKit.configure({ table: { resizable: true } }), RawHtml, EmbedNode.configure({ onEdit: (pos, data) => { if (typeof pos === "number") setEmbedEdit({ data, from: pos, expected: JSON.stringify(data) }); } })],
    editable,
    content: markdownToEditorHtml(value),
    onUpdate: ({ editor }) => {
      onChange(editorHtmlToMarkdown(editor.getHTML()));
      const { $from, empty } = editor.state.selection;
      const text = $from.parent.type.name === "paragraph" ? $from.parent.textContent : "";
      if (empty && /^\/[\p{L}\d-]*$/u.test(text)) {
        const coords = editor.view.coordsAtPos($from.pos); const root = rootRef.current?.getBoundingClientRect();
        if (root) setSlash({ query: text.slice(1).toLowerCase(), left: coords.left - root.left, top: coords.bottom - root.top + 6 });
      } else setSlash(null);
    },
    editorProps: { handlePaste: (view, event) => {
      const url = event.clipboardData?.getData("text/plain").trim() || "";
      const { $from, empty } = view.state.selection;
      if (!empty || $from.parent.type.name !== "paragraph" || $from.parent.content.size || !safeLink(url)) return false;
      event.preventDefault();
      const pos = $from.before();
      const from = view.state.selection.from;
      view.dispatch(view.state.tr.insertText(url).addMark(from, from + url.length, view.state.schema.marks.link.create({ href: url })));
      setPasted({ url, pos });
      return true;
    }, attributes: { "aria-label": "本文エディター" } }
  });

  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);
  useEffect(() => { if (editor && editorHtmlToMarkdown(editor.getHTML()) !== value.trim()) editor.commands.setContent(markdownToEditorHtml(value), { emitUpdate: false }); }, [editor, value]);

  const updateActive = useCallback((target: EventTarget | null) => {
    if (!editor || !rootRef.current) return;
    const element = blockElement(target, rootRef.current); if (!element) return;
    const rootBox = rootRef.current.getBoundingClientRect(); const box = element.getBoundingClientRect();
    let pos = editor.view.posAtDOM(element, 0); const $pos = editor.state.doc.resolve(Math.max(0, pos));
    const targetType = element.tagName === "LI" ? ["listItem", "taskItem"] : element.tagName.startsWith("H") ? ["heading"] : element.tagName === "P" ? ["paragraph"] : [nodeKind(element)];
    for (let depth = $pos.depth; depth > 0; depth -= 1) if (targetType.includes($pos.node(depth).type.name)) { pos = $pos.before(depth); break; }
    setActive({ pos, top: box.top - rootBox.top + Math.max(0, Math.min(8, (box.height - 28) / 2)), nodeType: nodeKind(element) });
  }, [editor]);

  if (!editor) return <div className="visual-editor-loading">エディターを準備中…</div>;

  const focusBlock = () => {
    const chain = editor.chain().focus();
    if (!active) return chain;
    const node = editor.state.doc.nodeAt(active.pos);
    return node?.isAtom ? chain.setNodeSelection(active.pos) : chain.setTextSelection(Math.min(active.pos + 1, editor.state.doc.content.size));
  };

  function insertBlock(kind: BlockKind, replaceSlash = false) {
    let chain = editor.chain().focus();
    if (replaceSlash) { const { $from } = editor.state.selection; chain = chain.deleteRange({ from: $from.start(), to: $from.pos }); }
    if (kind.startsWith("heading")) chain.setHeading({ level: Number(kind.slice(-1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
    else if (kind === "paragraph") chain.setParagraph().run();
    else if (kind === "bulletList") chain.toggleBulletList().run();
    else if (kind === "orderedList") chain.toggleOrderedList().run();
    else if (kind === "taskList") chain.toggleTaskList().run();
    else if (kind === "blockquote") chain.toggleBlockquote().run();
    else if (kind === "codeBlock") chain.toggleCodeBlock().run();
    else if (kind === "horizontalRule") chain.setHorizontalRule().run();
    else if (kind === "table") chooseTableSize();
    else if (kind === "image") requestImage();
    else if (kind === "embed") { if (replaceSlash) chain.run(); const url = ""; setEmbedEdit({ data: { kind: "card", url } }); }
    else if (kind === "rawHtml") { const raw = window.prompt("HTMLを入力", "<div>\n\n</div>"); if (raw) editor.chain().focus().insertContent({ type: "rawHtml", attrs: { raw } }).run(); }
    setMenu(null); setSlash(null);
  }

  function chooseTableSize() {
    const choice = window.prompt("表のサイズ（例: 3x3）", "3x3")?.trim(); const match = choice?.match(/^(\d+)\s*[x×]\s*(\d+)$/i); if (!match) return;
    editor.chain().focus().insertTable({ rows: Math.min(12, Math.max(1, Number(match[1]))), cols: Math.min(12, Math.max(1, Number(match[2]))), withHeaderRow: true }).run();
  }
  function requestImage() { onOpenMedia((image) => editor.chain().focus().setImage(image).run()); }

  function addRelative(kind: BlockKind, before = false) {
    if (!active) return; const node = editor.state.doc.nodeAt(active.pos); if (!node) return;
    if (["listItem", "taskItem"].includes(node.type.name) && ((node.type.name === "taskItem" && kind === "taskList") || (node.type.name === "listItem" && ["bulletList", "orderedList"].includes(kind)))) {
      const sibling = node.type.createAndFill(node.attrs); if (sibling) editor.view.dispatch(editor.state.tr.insert(before ? active.pos : active.pos + node.nodeSize, sibling));
    } else {
      const pos = before ? active.pos : active.pos + node.nodeSize;
      editor.chain().focus().insertContentAt(pos, { type: "paragraph" }).setTextSelection(pos + 1).run(); insertBlock(kind);
    }
    setMenu(null);
  }
  function duplicateBlock() { if (!active) return; const node = editor.state.doc.nodeAt(active.pos); if (node) editor.view.dispatch(editor.state.tr.insert(active.pos + node.nodeSize, node.copy(node.content))); setMenu(null); }
  function deleteBlock() { if (!active) return; const node = editor.state.doc.nodeAt(active.pos); if (node) editor.view.dispatch(editor.state.tr.delete(active.pos, active.pos + node.nodeSize)); setMenu(null); }
  function editSpecificBlock() {
    if (!active) return; const node = editor.state.doc.nodeAt(active.pos); if (!node) return;
    if (node.type.name === "embed") setEmbedEdit({ data: node.attrs.data, from: active.pos, expected: JSON.stringify(node.attrs.data) });
    else if (node.type.name === "image") { const alt = window.prompt("altテキスト", node.attrs.alt || ""); if (alt === null) return; const title = window.prompt("キャプション", node.attrs.title || ""); if (title === null) return; editor.view.dispatch(editor.state.tr.setNodeMarkup(active.pos, undefined, { ...node.attrs, alt, title })); }
    else if (node.type.name === "codeBlock") { const language = window.prompt("言語識別子（例: cpp, shader.frag）", node.attrs.language || ""); if (language !== null) editor.view.dispatch(editor.state.tr.setNodeMarkup(active.pos, undefined, { ...node.attrs, language: language.trim() || null })); }
    else if (node.type.name === "rawHtml") { const raw = window.prompt("HTMLを編集", node.attrs.raw || ""); if (raw !== null) editor.view.dispatch(editor.state.tr.setNodeMarkup(active.pos, undefined, { raw })); }
    setMenu(null);
  }

  function clearDrag() {
    setDropMarker(null);
    draggingPos.current = null; setDragging(false);
  }
  function moveRelative(before: boolean) {
    if (!active) return;
    const resolved = editor.state.doc.resolve(active.pos);
    const source = resolved.nodeAfter;
    if (!source) return;
    const sibling = before ? resolved.nodeBefore : editor.state.doc.resolve(active.pos + source.nodeSize).nodeAfter;
    if (!sibling) return;
    const destination = before ? active.pos - sibling.nodeSize : active.pos + sibling.nodeSize;
    const tr = editor.state.tr.delete(active.pos, active.pos + source.nodeSize);
    editor.view.dispatch(tr.insert(destination, source));
    setActive({ ...active, pos: destination }); setMenu(null);
  }
  function dropBlock(event: React.DragEvent<HTMLDivElement>) {
    if (draggingPos.current === null || !rootRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const target = blockElement(event.target, rootRef.current); if (!target) return;
    const sourcePos = draggingPos.current; const source = editor.state.doc.nodeAt(sourcePos); if (!source) return;
    let targetPos = editor.view.posAtDOM(target, 0); const $target = editor.state.doc.resolve(Math.max(0, targetPos));
    const targetNames = target.tagName === "LI" ? ["listItem", "taskItem"] : target.tagName.startsWith("H") ? ["heading"] : target.tagName === "P" ? ["paragraph"] : [nodeKind(target)];
    for (let depth = $target.depth; depth > 0; depth -= 1) if (targetNames.includes($target.node(depth).type.name)) { targetPos = $target.before(depth); break; }
    if (targetPos === sourcePos) { clearDrag(); return; }
    const targetNode = editor.state.doc.nodeAt(targetPos); if (!targetNode) return;
    const insertBefore = event.clientY < target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
    let destination = insertBefore ? targetPos : targetPos + targetNode.nodeSize;
    const tr = editor.state.tr.delete(sourcePos, sourcePos + source.nodeSize);
    if (destination > sourcePos) destination -= source.nodeSize;
    try { editor.view.dispatch(tr.insert(destination, source)); } catch { clearDrag(); return; }
    clearDrag(); setActive(null); setMenu(null);
  }

  const slashItems = ([...basicKinds, "image", ...otherKinds] as BlockKind[]).filter((kind) => {
    if (!slash?.query) return true;
    const aliases: Partial<Record<BlockKind, string>> = { heading1: "heading h1 見出し", heading2: "heading h2 見出し", heading3: "heading h3 見出し", image: "image 画像", codeBlock: "code コード", table: "table 表", rawHtml: "html", embed: "link embed card youtube spotify x リンク 埋め込み" };
    return `${blockLabels[kind]} ${aliases[kind] || kind}`.toLowerCase().includes(slash.query);
  });

  return <EmbedDocumentsContext.Provider value={documents}><div className={`visual-editor${dragging ? " is-dragging" : ""}`} ref={rootRef} onMouseMove={(event) => { if (!menu) updateActive(event.target); }} onFocusCapture={(event) => updateActive(event.target)} onDragOverCapture={(event) => {
      if (draggingPos.current === null || !rootRef.current) return;
      event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move";
      const target = blockElement(event.target, rootRef.current);
      if (target) { const box = target.getBoundingClientRect(); const root = rootRef.current.getBoundingClientRect(); setDropMarker({ top: (event.clientY < box.top + box.height / 2 ? box.top : box.bottom) - root.top, left: box.left - root.left, width: box.width }); }
      else setDropMarker(null);
    }} onDragEnd={clearDrag} onDropCapture={dropBlock}>
    <BubbleMenu editor={editor} options={{ placement: "top" }} shouldShow={({ editor, from, to }) => from !== to && editor.isEditable}>
      <div className="bubble-menu" aria-label="文字装飾"><button className={editor.isActive("bold") ? "active" : ""} onClick={() => editor.chain().focus().toggleBold().run()} title="太字"><strong>B</strong></button><button className={editor.isActive("italic") ? "active" : ""} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体"><em>I</em></button><button className={editor.isActive("strike") ? "active" : ""} onClick={() => editor.chain().focus().toggleStrike().run()} title="打ち消し線"><s>S</s></button><button className={editor.isActive("code") ? "active" : ""} onClick={() => editor.chain().focus().toggleCode().run()} title="インラインコード">&lt;/&gt;</button><button className={editor.isActive("link") ? "active" : ""} onClick={() => { const href = window.prompt("リンク先URL", editor.getAttributes("link").href || "https://"); if (href === "") editor.chain().focus().unsetLink().run(); else if (href) editor.chain().focus().setLink({ href }).run(); }} title="リンク">🔗</button></div>
    </BubbleMenu>
    {active && <div className="block-controls" style={{ top: active.top }} onMouseDown={(event) => { if (!(event.target as HTMLElement).closest(".drag-handle")) event.preventDefault(); }}><button ref={addHandle} className="block-control" aria-expanded={menu === "add"} aria-label="下にブロックを追加" title="下に追加" onClick={() => { focusBlock(); setMenu(menu === "add" ? null : "add"); }}><ControlIcon kind="add" /></button><button ref={moveHandle} className="block-control drag-handle" aria-expanded={menu === "actions"} draggable aria-label="ブロック操作" title="クリックで操作、ドラッグで移動" onDragStart={(event) => { draggingPos.current = active.pos; setDragging(true); setMenu(null); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", "riddle-editor-block"); }} onClick={() => { focusBlock(); setMenu(menu === "actions" ? null : "actions"); }}><ControlIcon kind="move" /></button>
      {menu === "add" && <FloatingPanel anchor={addHandle} onClose={() => setMenu(null)} className="block-popover add-popover" preserveSelection><BlockPicker onPick={(kind) => addRelative(kind)} /></FloatingPanel>}
      {menu === "actions" && <FloatingPanel anchor={moveHandle} onClose={() => setMenu(null)} className="block-popover action-popover" preserveSelection>{active.nodeType === "embed" && <button onClick={editSpecificBlock}>埋め込みを編集</button>}{active.nodeType === "image" && <button onClick={editSpecificBlock}>画像を編集</button>}{active.nodeType === "codeBlock" && <button onClick={editSpecificBlock}>言語を設定</button>}{active.nodeType === "table" && <TableActions editor={editor} />}{active.nodeType === "rawHtml" && <button onClick={editSpecificBlock}>HTMLを表示 / 編集</button>}{!(["image", "table", "horizontalRule", "rawHtml", "embed"].includes(active.nodeType)) && <details><summary>種類を変更</summary><BlockPicker compact onPick={(kind) => { focusBlock(); insertBlock(kind); }} includeDedicated={false} /></details>}<button onClick={() => addRelative("paragraph", true)}>上に追加</button><button onClick={() => addRelative("paragraph")}>下に追加</button><button onClick={() => moveRelative(true)}>上へ移動</button><button onClick={() => moveRelative(false)}>下へ移動</button><button onClick={duplicateBlock}>複製</button><button className="danger" onClick={deleteBlock}>削除</button>{["listItem", "taskItem"].includes(active.nodeType) && <><button onClick={() => focusBlock().sinkListItem(active.nodeType as "listItem" | "taskItem").run()}>インデント</button><button onClick={() => focusBlock().liftListItem(active.nodeType as "listItem" | "taskItem").run()}>アウトデント</button></>}</FloatingPanel>}
    </div>}
    {slash && <FloatingPanel anchor={rootRef} point={{ left: slash.left, top: slash.top }} className="slash-menu" preserveSelection onClose={() => setSlash(null)}><p>ブロックを追加</p>{slashItems.length ? slashItems.map((kind) => <button key={kind} onClick={() => insertBlock(kind, true)}>{blockLabels[kind]}</button>) : <span>一致するブロックがありません</span>}</FloatingPanel>}
    {pasted && <div ref={pasteRegion} className="paste-embed-menu" role="group" aria-label="貼り付けたURLの表示方法"><span>URLの表示方法</span><button type="button" onClick={() => setPasted(null)}>通常リンク</button>{["card", ...(detectEmbedKind(pasted.url) !== "card" ? [detectEmbedKind(pasted.url)] : [])].map((kind) => <button type="button" key={kind} onClick={() => {
      const node = editor.state.doc.nodeAt(pasted.pos);
      if (node?.type.name === "paragraph" && node.textContent === pasted.url) setEmbedEdit({ data: { kind: kind as Embed["kind"], url: pasted.url }, from: pasted.pos, to: pasted.pos + node.nodeSize, expected: pasted.url });
      setPasted(null);
    }}>{kind === "card" ? "リンクカード" : `${kind}を埋め込む`}</button>)}</div>}
    {embedEdit && <EmbedDialog initial={embedEdit.data} documents={documents} onClose={() => setEmbedEdit(null)} onSave={(data) => {
      if (embedEdit.from !== undefined) {
        const node = editor.state.doc.nodeAt(embedEdit.from);
        if (node && (JSON.stringify(node.attrs.data) === embedEdit.expected || node.type.name === "paragraph" && node.textContent === embedEdit.expected)) editor.chain().focus().insertContentAt({ from: embedEdit.from, to: embedEdit.to ?? embedEdit.from + node.nodeSize }, { type: "embed", attrs: { data } }).run();
      } else editor.chain().focus().insertContent({ type: "embed", attrs: { data } }).run();
      setEmbedEdit(null);
    }} />}
    {dropMarker && <div className="block-drop-indicator" style={dropMarker} aria-hidden="true" />}
    <EditorContent editor={editor} />
  </div></EmbedDocumentsContext.Provider>;
}

function BlockPicker({ onPick, compact, className = "", includeDedicated = true }: { onPick: (kind: BlockKind) => void; compact?: boolean; className?: string; includeDedicated?: boolean }) {
  const button = (kind: BlockKind) => <button key={kind} onClick={() => onPick(kind)}>{blockLabels[kind]}</button>;
  if (compact) return <div className="compact-block-picker">{basicKinds.map(button)}{button("codeBlock")}</div>;
  return <div className={className}><p>基本</p>{basicKinds.map(button)}{includeDedicated && <><p>メディア</p>{button("image")}<p>その他</p>{otherKinds.map(button)}</>}</div>;
}

function TableActions({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  return <details><summary>表を編集</summary><div className="compact-block-picker"><button onClick={() => editor.chain().focus().addRowAfter().run()}>行を追加</button><button onClick={() => editor.chain().focus().addColumnAfter().run()}>列を追加</button><button onClick={() => editor.chain().focus().deleteRow().run()}>行を削除</button><button onClick={() => editor.chain().focus().deleteColumn().run()}>列を削除</button><button className="danger" onClick={() => editor.chain().focus().deleteTable().run()}>表を削除</button></div></details>;
}

function ControlIcon({ kind }: { kind: "add" | "move" }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{kind === "add" ? <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></> : <><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></>}</svg>;
}
