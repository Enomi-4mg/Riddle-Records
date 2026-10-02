import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { embedMarkdown, parseEmbed } from "../../shared/embeds.ts";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "../src/lib/editorMarkdown.ts";
import { documentCard, publishedCards, resolveDocumentCard } from "../src/lib/linkCards.ts";
import { createContentDocument, parseContentMarkdown, buildContentMarkdown } from "../src/lib/cmsMarkdown.ts";

for (const embed of [
  {kind:"card",url:"https://news.org/page",title:'日本語 50% & "quotes"',description:"Line one\nLine two",image:"https://news.org/image.png"},
  {kind:"card",url:"/journal/2026-08-02/"},
  {kind:"youtube",url:"https://youtu.be/abcdefghijk"},
  {kind:"x",url:"https://x.com/person/status/123456"},
  {kind:"spotify",url:"https://open.spotify.com/track/ABC123"}
]) test(`${embed.kind} embeds survive repeated Markdown/editor/file round trips`, () => {
  const body=`Before\n\n${embedMarkdown(embed)}\n\nAfter`;
  const converted=editorHtmlToMarkdown(markdownToEditorHtml(body)); assert.equal(converted,body);
  assert.equal(editorHtmlToMarkdown(markdownToEditorHtml(converted)),body);
  for (const kind of ["journal","songs","gallery","projects"]) {
    const doc=createContentDocument(kind); doc.body=body;
    assert.equal(parseContentMarkdown(buildContentMarkdown(doc),kind).body.trim(),body);
  }
});
test("existing raw iframes remain raw and unknown embed code remains editable code", () => {
  const raw='<iframe src="https://open.spotify.com/embed/track/ABC" width="100%" height="152"></iframe>';
  assert.equal(editorHtmlToMarkdown(markdownToEditorHtml(raw)),raw);
  const invalid='```riddle-embed\n{"kind":"unsupported","url":"https://news.org/"}\n```';
  assert.match(markdownToEditorHtml(invalid),/language-riddle-embed/); assert.ok(!markdownToEditorHtml(invalid).includes("data-riddle-embed"));
});
test("CMS internal references follow Journal permalink and actual Song filename", () => {
  const doc=createContentDocument("journal"); doc.common.publication="published"; doc.common.date="2026-01-02"; doc.common.title="Title";
  doc.placement.data.articleType="making"; doc.placement.data.slug="making";
  assert.equal(documentCard(doc).url,"/journal/2026/01/02/making/");
  doc.placement.data.permalink="/journal/custom/"; assert.equal(documentCard(doc).url,"/journal/custom/");
  doc.placement.data.permalink=""; doc.placement.data.articleType="report"; assert.equal(documentCard(doc).url,"/journal/2026-01/");
  const song=createContentDocument("songs");song.common.publication="published";song.file={path:"2026-01-02-second-song.md"};assert.equal(documentCard(song).url,"/disco/2026-01-02-second-song/");
  const gallery=createContentDocument("gallery");gallery.common.publication="published";gallery.placement.data.slug="art";
  assert.equal(documentCard(gallery),undefined);gallery.placement.data.detail=true;assert.equal(documentCard(gallery).url,"/gallery/art/");
  const draft=createContentDocument("journal");draft.common.title="Private";assert.ok(!publishedCards([draft,doc]).some((card)=>card.title==="Private"));
  assert.equal(resolveDocumentCard([doc],"https://4mg.dev/journal/2026-01/#part").title,"Title");
});

const window = new Window();
for (const key of ["window","document","Element","HTMLElement","HTMLDialogElement","Node","Event","MouseEvent","KeyboardEvent","navigator","MutationObserver","getComputedStyle","requestAnimationFrame","cancelAnimationFrame"]) {
  const value=key === "window" ? window : typeof window[key] === "function" && ["getComputedStyle","requestAnimationFrame","cancelAnimationFrame"].includes(key) ? window[key].bind(window) : window[key];
  Object.defineProperty(globalThis,key,{configurable:true,value});
}
window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createElement,act}=await import("react");
const {createRoot}=await import("react-dom/client");
const {EmbedDialog}=await import("../src/components/EmbedDialog.tsx");
const {VisualEditor}=await import("../src/components/VisualEditor.tsx");
const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
async function mount(Component,props) { const container=document.createElement("div");document.body.append(container);const root=createRoot(container);await act(async()=>root.render(createElement(Component,props)));return {container,root,async close(){await act(async()=>root.unmount());container.remove();}}; }
async function change(input,value) { const prototype=input.tagName==="SELECT"?window.HTMLSelectElement.prototype:input.tagName==="TEXTAREA"?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(prototype,"value").set;await act(async()=>{setter.call(input,value);input.dispatchEvent(new window.Event(input.tagName==="SELECT"?"change":"input",{bubbles:true}));}); }

test("dialog preserves saved metadata until explicit refresh and ignores stale results", async () => {
  const original=globalThis.fetch;const calls=[];
  globalThis.fetch=(url,options)=>new Promise((resolve)=>calls.push({resolve,options}));
  const mounted=await mount(EmbedDialog,{initial:{kind:"card",url:"https://news.org/old",title:"Hand edited"},documents:[],onSave:()=>{},onClose:()=>{}});
  try {
    await act(async()=>delay(400));assert.equal(calls.length,0);
    const inputs=mounted.container.querySelectorAll("input");
    await change(inputs[0],"https://news.org/first");await act(async()=>delay(400));assert.equal(calls.length,1);
    await change(inputs[0],"https://news.org/second");await act(async()=>delay(400));assert.equal(calls.length,2);
    assert.equal(calls[0].options.signal.aborted,true);
    await act(async()=>calls[0].resolve(Response.json({title:"Stale",description:"",image:""})));
    assert.equal(inputs[1].value,"");
    await change(inputs[1],"Manual while loading");
    await act(async()=>calls[1].resolve(Response.json({title:"Fetched",description:"",image:""})));
    assert.equal(inputs[1].value,"Manual while loading");
    assert.match(mounted.container.textContent,/入力した内容を保持/);
  } finally {await mounted.close();globalThis.fetch=original;}
});
test("failed metadata retrieval permits a manually entered card",async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:"Unavailable"},{status:400});const saved=[];
  const mounted=await mount(EmbedDialog,{initial:{kind:"card",url:"https://news.org/"},documents:[],onSave:(data)=>saved.push(data),onClose:()=>{}});
  try { await act(async()=>delay(400));assert.match(mounted.container.textContent,/手動入力できます/);await change(mounted.container.querySelectorAll("input")[1],"Manual title");await act(async()=>mounted.container.querySelector("form").dispatchEvent(new window.Event("submit",{bubbles:true,cancelable:true})));assert.equal(saved[0].title,"Manual title");}
  finally{await mounted.close();globalThis.fetch=original;}
});
test("actual editor shows embeds, converts to links and offers URL paste choices", async () => {
  const outputs=[];
  const mounted=await mount(VisualEditor,{value:embedMarkdown({kind:"youtube",url:"https://youtu.be/abcdefghijk"}),onChange:(body)=>outputs.push(body),onOpenMedia:()=>{},documents:[]});
  try {
    assert.ok(mounted.container.querySelector("iframe"));
    const convert=Array.from(mounted.container.querySelectorAll("button")).find((button)=>button.textContent==="通常リンクにする");
    assert.ok(convert);await act(async()=>convert.click());assert.ok(outputs.at(-1).includes("https://youtu.be/abcdefghijk"));assert.ok(!outputs.at(-1).includes("riddle-embed"));
  } finally {await mounted.close();}
  const pasted=await mount(VisualEditor,{value:"",onChange:(body)=>outputs.push(body),onOpenMedia:()=>{},documents:[]});
  try {
    const editable=pasted.container.querySelector('[contenteditable="true"]');
    const event=new window.Event("paste",{bubbles:true,cancelable:true});Object.defineProperty(event,"clipboardData",{value:{getData:(type)=>type==="text/plain"?"https://youtu.be/abcdefghijk":""}});
    await act(async()=>editable.dispatchEvent(event));
    assert.match(pasted.container.textContent,/URLの表示方法/);assert.match(pasted.container.textContent,/youtubeを埋め込む/);
    const embed=Array.from(pasted.container.querySelectorAll("button")).find((button)=>button.textContent==="youtubeを埋め込む");await act(async()=>embed.click());
    assert.ok(pasted.container.querySelector("dialog"));
    await act(async()=>pasted.container.querySelector("dialog form").dispatchEvent(new window.Event("submit",{bubbles:true,cancelable:true})));
    assert.ok(pasted.container.querySelector("iframe"));assert.match(outputs.at(-1),/riddle-embed/);assert.ok(parseEmbed(outputs.at(-1).match(/```riddle-embed\n([\s\S]*?)\n```/)[1]));
  }finally{await pasted.close();}
});

test("HTML inside a fenced example stays code rather than becoming raw HTML", () => {
  const body='```html\n<iframe src="https://example.com"></iframe>\n```';
  assert.ok(!markdownToEditorHtml(body).includes("data-raw-html"));
  assert.match(editorHtmlToMarkdown(markdownToEditorHtml(body)),/<iframe/);
});

test("embed block actions duplicate and delete without losing metadata", async () => {
  const outputs=[];
  const mounted=await mount(VisualEditor,{value:embedMarkdown({kind:"youtube",url:"https://youtu.be/abcdefghijk"}),onChange:(body)=>outputs.push(body),onOpenMedia:()=>{},documents:[]});
  try {
    const openActions=async()=>{
      await act(async()=>mounted.container.querySelector("[data-editor-embed]").dispatchEvent(new window.MouseEvent("mousemove",{bubbles:true})));
      const handle=mounted.container.querySelector('.drag-handle');assert.ok(handle);await act(async()=>handle.click());
    };
    await openActions();
    await act(async()=>Array.from(document.querySelectorAll(".action-popover button")).find((button)=>button.textContent==="複製").click());
    assert.equal(mounted.container.querySelectorAll("[data-editor-embed]").length,2);assert.equal((outputs.at(-1).match(/```riddle-embed/g)||[]).length,2);
    await openActions();
    await act(async()=>Array.from(document.querySelectorAll(".action-popover button")).find((button)=>button.textContent==="削除").click());
    assert.equal(mounted.container.querySelectorAll("[data-editor-embed]").length,1);assert.match(outputs.at(-1),/abcdefghijk/);
  } finally {await mounted.close();}
});
