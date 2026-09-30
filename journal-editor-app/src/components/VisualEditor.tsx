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
type BlockKind = "paragraph" | "heading1" | "heading2" | "heading3" | "heading4" | "heading5" | "heading6" | "bulletList" | "orderedList" | "taskList" | "blockquote" | "codeBlock" | "image" | "table" | "horizontalRule" | "rawHtml";

const blockLabels: Record<BlockKind, string> = {
  paragraph: "テキスト", heading1: "見出し H1", heading2: "見出し H2", heading3: "見出し H3", heading4: "見出し H4", heading5: "見出し H5", heading6: "見出し H6",
  bulletList: "箇条書き", orderedList: "番号付きリスト", taskList: "タスクリスト", blockquote: "引用", codeBlock: "コード", image: "画像", table: "表", horizontalRule: "区切り線", rawHtml: "HTML"
};
const basicKinds: BlockKind[] = ["paragraph", "heading1", "heading2", "heading3", "heading4", "heading5", "heading6", "bulletList", "orderedList", "taskList", "blockquote"];
const otherKinds: BlockKind[] = ["codeBlock", "table", "horizontalRule", "rawHtml"];

function blockElement(target: EventTarget | null, root: HTMLElement) {
  if (!(target instanceof HTMLElement)) return null;
  const candidate = target.closest("li, table, pre, blockquote, img, hr, .raw-html-block, h1, h2, h3, h4, h5, h6, p") as HTMLElement | null;
  return candidate && root.contains(candidate) ? candidate : null;
}

function nodeKind(element: HTMLElement): string {
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

export function VisualEditor({ value, onChange, onOpenMedia }: { value: string; onChange: (markdown: string) => void; onOpenMedia: (insert: (image: EditorImage) => void) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingPos = useRef<number | null>(null);
  const [active, setActive] = useState<BlockInfo | null>(null);
  const [menu, setMenu] = useState<"add" | "actions" | null>(null);
  const [slash, setSlash] = useState<{ query: string; left: number; top: number } | null>(null);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false }), Image.configure({ allowBase64: false }), TaskList, TaskItem.configure({ nested: true }), TableKit.configure({ table: { resizable: true } }), RawHtml],
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
    editorProps: { attributes: { "aria-label": "本文エディター" }, handleKeyDown: (_view, event) => { if (event.key === "Escape") { setMenu(null); setSlash(null); } return false; } }
  });

  useEffect(() => { if (editor && editorHtmlToMarkdown(editor.getHTML()) !== value.trim()) editor.commands.setContent(markdownToEditorHtml(value), { emitUpdate: false }); }, [editor, value]);

  const updateActive = useCallback((target: EventTarget | null) => {
    if (!editor || !rootRef.current) return;
    const element = blockElement(target, rootRef.current); if (!element) return;
    const rootBox = rootRef.current.getBoundingClientRect(); const box = element.getBoundingClientRect();
    let pos = editor.view.posAtDOM(element, 0); const $pos = editor.state.doc.resolve(Math.max(0, pos));
    const targetType = element.tagName === "LI" ? ["listItem", "taskItem"] : element.tagName.startsWith("H") ? ["heading"] : element.tagName === "P" ? ["paragraph"] : [nodeKind(element)];
    for (let depth = $pos.depth; depth > 0; depth -= 1) if (targetType.includes($pos.node(depth).type.name)) { pos = $pos.before(depth); break; }
    setActive({ pos, top: box.top - rootBox.top, nodeType: nodeKind(element) });
  }, [editor]);

  if (!editor) return <div className="visual-editor-loading">エディターを準備中…</div>;

  const focusBlock = () => active ? editor.chain().focus().setTextSelection(Math.min(active.pos + 1, editor.state.doc.content.size)) : editor.chain().focus();

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
    if (node.type.name === "image") { const alt = window.prompt("altテキスト", node.attrs.alt || ""); if (alt === null) return; const title = window.prompt("キャプション", node.attrs.title || ""); if (title === null) return; editor.view.dispatch(editor.state.tr.setNodeMarkup(active.pos, undefined, { ...node.attrs, alt, title })); }
    else if (node.type.name === "codeBlock") { const language = window.prompt("言語識別子（例: cpp, shader.frag）", node.attrs.language || ""); if (language !== null) editor.view.dispatch(editor.state.tr.setNodeMarkup(active.pos, undefined, { ...node.attrs, language: language.trim() || null })); }
    else if (node.type.name === "rawHtml") { const raw = window.prompt("HTMLを編集", node.attrs.raw || ""); if (raw !== null) editor.view.dispatch(editor.state.tr.setNodeMarkup(active.pos, undefined, { raw })); }
    setMenu(null);
  }

  function dropBlock(event: React.DragEvent<HTMLDivElement>) {
    if (draggingPos.current === null || !rootRef.current) return;
    event.preventDefault();
    const target = blockElement(event.target, rootRef.current); if (!target) return;
    const sourcePos = draggingPos.current; const source = editor.state.doc.nodeAt(sourcePos); if (!source) return;
    let targetPos = editor.view.posAtDOM(target, 0); const $target = editor.state.doc.resolve(Math.max(0, targetPos));
    const targetNames = target.tagName === "LI" ? ["listItem", "taskItem"] : target.tagName.startsWith("H") ? ["heading"] : target.tagName === "P" ? ["paragraph"] : [nodeKind(target)];
    for (let depth = $target.depth; depth > 0; depth -= 1) if (targetNames.includes($target.node(depth).type.name)) { targetPos = $target.before(depth); break; }
    if (targetPos === sourcePos) return;
    const targetNode = editor.state.doc.nodeAt(targetPos); if (!targetNode) return;
    const insertBefore = event.clientY < target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
    let destination = insertBefore ? targetPos : targetPos + targetNode.nodeSize;
    const tr = editor.state.tr.delete(sourcePos, sourcePos + source.nodeSize);
    if (destination > sourcePos) destination -= source.nodeSize;
    try { editor.view.dispatch(tr.insert(destination, source)); } catch { return; }
    draggingPos.current = null; setMenu(null);
  }

  const slashItems = ([...basicKinds, "image", ...otherKinds] as BlockKind[]).filter((kind) => {
    if (!slash?.query) return true;
    const aliases: Partial<Record<BlockKind, string>> = { heading1: "heading h1 見出し", heading2: "heading h2 見出し", heading3: "heading h3 見出し", image: "image 画像", codeBlock: "code コード", table: "table 表", rawHtml: "html" };
    return `${blockLabels[kind]} ${aliases[kind] || kind}`.toLowerCase().includes(slash.query);
  });

  return <div className="visual-editor" ref={rootRef} onMouseMove={(event) => { if (!menu) updateActive(event.target); }} onFocusCapture={(event) => updateActive(event.target)} onDragOver={(event) => event.preventDefault()} onDrop={dropBlock}>
    <BubbleMenu editor={editor} options={{ placement: "top" }} shouldShow={({ editor, from, to }) => from !== to && editor.isEditable}>
      <div className="bubble-menu" aria-label="文字装飾"><button className={editor.isActive("bold") ? "active" : ""} onClick={() => editor.chain().focus().toggleBold().run()} title="太字"><strong>B</strong></button><button className={editor.isActive("italic") ? "active" : ""} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体"><em>I</em></button><button className={editor.isActive("strike") ? "active" : ""} onClick={() => editor.chain().focus().toggleStrike().run()} title="打ち消し線"><s>S</s></button><button className={editor.isActive("code") ? "active" : ""} onClick={() => editor.chain().focus().toggleCode().run()} title="インラインコード">&lt;/&gt;</button><button className={editor.isActive("link") ? "active" : ""} onClick={() => { const href = window.prompt("リンク先URL", editor.getAttributes("link").href || "https://"); if (href === "") editor.chain().focus().unsetLink().run(); else if (href) editor.chain().focus().setLink({ href }).run(); }} title="リンク">🔗</button></div>
    </BubbleMenu>
    {active && <div className="block-controls" style={{ top: active.top }} onMouseDown={(event) => event.preventDefault()}><button className="block-control" aria-label="下にブロックを追加" title="下に追加" onClick={() => { focusBlock(); setMenu(menu === "add" ? null : "add"); }}>＋</button><button className="block-control drag-handle" draggable aria-label="ブロック操作" title="クリックで操作、ドラッグで移動" onDragStart={(event) => { draggingPos.current = active.pos; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", "riddle-editor-block"); }} onClick={() => { focusBlock(); setMenu(menu === "actions" ? null : "actions"); }}>⋮⋮</button>
      {menu === "add" && <BlockPicker className="block-popover add-popover" onPick={(kind) => addRelative(kind)} />}
      {menu === "actions" && <div className="block-popover action-popover">{active.nodeType === "image" && <button onClick={editSpecificBlock}>画像を編集</button>}{active.nodeType === "codeBlock" && <button onClick={editSpecificBlock}>言語を設定</button>}{active.nodeType === "table" && <TableActions editor={editor} />}{active.nodeType === "rawHtml" && <button onClick={editSpecificBlock}>HTMLを表示 / 編集</button>}{!(["image", "table", "horizontalRule", "rawHtml"].includes(active.nodeType)) && <details><summary>種類を変更</summary><BlockPicker compact onPick={(kind) => { focusBlock(); insertBlock(kind); }} includeDedicated={false} /></details>}<button onClick={() => addRelative("paragraph", true)}>上に追加</button><button onClick={() => addRelative("paragraph")}>下に追加</button><button onClick={duplicateBlock}>複製</button><button className="danger" onClick={deleteBlock}>削除</button>{["listItem", "taskItem"].includes(active.nodeType) && <><button onClick={() => focusBlock().sinkListItem(active.nodeType as "listItem" | "taskItem").run()}>インデント</button><button onClick={() => focusBlock().liftListItem(active.nodeType as "listItem" | "taskItem").run()}>アウトデント</button></>}</div>}
    </div>}
    {slash && <div className="slash-menu" style={{ left: Math.min(slash.left, 360), top: slash.top }}><p>ブロックを追加</p>{slashItems.length ? slashItems.map((kind) => <button key={kind} onClick={() => insertBlock(kind, true)}>{blockLabels[kind]}</button>) : <span>一致するブロックがありません</span>}</div>}
    <EditorContent editor={editor} />
  </div>;
}

function BlockPicker({ onPick, compact, className = "", includeDedicated = true }: { onPick: (kind: BlockKind) => void; compact?: boolean; className?: string; includeDedicated?: boolean }) {
  const button = (kind: BlockKind) => <button key={kind} onClick={() => onPick(kind)}>{blockLabels[kind]}</button>;
  if (compact) return <div className="compact-block-picker">{basicKinds.map(button)}{button("codeBlock")}</div>;
  return <div className={className}><p>基本</p>{basicKinds.map(button)}{includeDedicated && <><p>メディア</p>{button("image")}<p>その他</p>{otherKinds.map(button)}</>}</div>;
}

function TableActions({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  return <details><summary>表を編集</summary><div className="compact-block-picker"><button onClick={() => editor.chain().focus().addRowAfter().run()}>行を追加</button><button onClick={() => editor.chain().focus().addColumnAfter().run()}>列を追加</button><button onClick={() => editor.chain().focus().deleteRow().run()}>行を削除</button><button onClick={() => editor.chain().focus().deleteColumn().run()}>列を削除</button><button className="danger" onClick={() => editor.chain().focus().deleteTable().run()}>表を削除</button></div></details>;
}
