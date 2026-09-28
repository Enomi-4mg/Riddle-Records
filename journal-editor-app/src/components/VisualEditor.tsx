import { Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "../lib/editorMarkdown";

const RawHtml = Node.create({
  name: "rawHtml", group: "block", atom: true,
  addAttributes: () => ({ raw: { default: "", parseHTML: (element) => element.getAttribute("data-raw-html"), renderHTML: (attributes) => ({ "data-raw-html": attributes.raw }) } }),
  parseHTML: () => [{ tag: "div[data-raw-html]", getAttrs: (element) => ({ raw: (element as HTMLElement).getAttribute("data-raw-html") }) }],
  renderHTML: ({ HTMLAttributes }) => ["div", { ...HTMLAttributes, class: "raw-html-block" }, ["span", {}, "既存の埋め込みコンテンツ"]]
});

export function VisualEditor({ value, onChange, onOpenMedia }: { value: string; onChange: (markdown: string) => void; onOpenMedia: () => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false }), Image, RawHtml],
    content: markdownToEditorHtml(value),
    onUpdate: ({ editor }) => onChange(editorHtmlToMarkdown(editor.getHTML()))
  });
  useEffect(() => { if (editor && editorHtmlToMarkdown(editor.getHTML()) !== value.trim()) editor.commands.setContent(markdownToEditorHtml(value), { emitUpdate: false }); }, [editor, value]);
  if (!editor) return <div className="visual-editor-loading">エディターを準備中…</div>;
  const chain = () => editor.chain().focus();
  return <div className="visual-editor">
    <div className="editor-toolbar" aria-label="本文書式">
      <button className={editor.isActive("bold") ? "active" : ""} onClick={() => chain().toggleBold().run()}>太字</button>
      <button className={editor.isActive("italic") ? "active" : ""} onClick={() => chain().toggleItalic().run()}>斜体</button>
      <button onClick={() => chain().toggleHeading({ level: 2 }).run()}>見出し</button>
      <button onClick={() => chain().toggleBulletList().run()}>リスト</button>
      <button onClick={() => chain().toggleBlockquote().run()}>引用</button>
      <button onClick={() => chain().toggleCodeBlock().run()}>コード</button>
      <button onClick={() => { const href = window.prompt("リンク先URL"); if (href) chain().setLink({ href }).run(); }}>リンク</button>
      <button onClick={onOpenMedia}>メディア</button>
    </div>
    <EditorContent editor={editor} />
  </div>;
}
