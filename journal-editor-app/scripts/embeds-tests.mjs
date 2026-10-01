import { galleryBodySections } from "../../shared/gallerySections.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import { transform } from "esbuild";
import { detectEmbedKind, parseEmbed, renderEmbed, embedMarkdown, internalPath } from "../../shared/embeds.ts";
import { publicAddress, metadataUrl, extractMetadata, fetchLinkMetadata } from "../../shared/linkMetadata.ts";
import { renderContentMarkdown } from "../../src/utils/renderMarkdown.ts";
import { createWorkerHandler } from "../worker/index.ts";

const youtube = "https://youtu.be/abcdefghijk";
test("recognizes services with strict host and ID boundaries", () => {
  for (const [url, kind] of [[youtube,"youtube"],["https://www.youtube.com/watch?v=abcdefghijk","youtube"],["https://www.youtube-nocookie.com/embed/abcdefghijk","youtube"],["https://x.com/person/status/123456","x"],["https://twitter.com/person/status/123456","x"],["https://open.spotify.com/intl-ja/track/ABC123","spotify"]]) {
    assert.equal(detectEmbedKind(url),kind); assert.ok(parseEmbed(JSON.stringify({kind,url})));
  }
  assert.equal(detectEmbedKind("https://youtube.com.evil.org/watch?v=abcdefghijk"),"card");
  assert.equal(parseEmbed('{"kind":"youtube","url":"https://evil.org/embed/abcdefghijk"}'),undefined);
  for (const url of ["javascript:alert(1)","//evil.org","/\\evil.org","https://user:password@evil.org"]) assert.equal(parseEmbed(JSON.stringify({kind:"card",url})),undefined);
});
test("cards escape text and resolve internal metadata without leaking missing references", () => {
  const raw = {kind:"card",url:"https://news.org/story",title:'<img src=x onerror="alert(1)">',description:"<script>bad</script>",image:"javascript:alert(1)"};
  const html = renderEmbed(raw); assert.ok(!html.includes("<script>")); assert.ok(!html.includes("onerror=\"")); assert.ok(!html.includes('src="javascript:'));
  const internal = {kind:"card",url:"https://4mg.dev/journal/test/",title:"Saved private title",image:"https://private.org/secret.png"};
  assert.ok(!renderEmbed(internal, () => undefined).includes("Saved private title"));
  assert.ok(!renderEmbed(internal, () => undefined).includes("secret.png"));
  assert.match(renderEmbed(internal, () => ({url:"/journal/test/",title:"Current",description:"Latest",image:""})),/Current/);
  assert.equal(internalPath("https://4mg.dev/base/journal/test/?query=1#heading", "https://4mg.dev", "/base/"),"/journal/test/");
});
test("public Markdown renders service blocks and preserves invalid fenced code", async () => {
  const html = await renderContentMarkdown(embedMarkdown({kind:"youtube",url:youtube}));
  assert.match(html,/youtube-nocookie.com\/embed\/abcdefghijk/); assert.match(html,/allowfullscreen/); assert.ok(!html.includes("autoplay"));
  assert.match(renderEmbed({kind:"x",url:"https://x.com/person/status/123"}),/data-x-post="123"/);
  assert.match(renderEmbed({kind:"spotify",url:"https://open.spotify.com/album/ABC"}),/open.spotify.com\/embed\/album\/ABC/);
  const invalid = await renderContentMarkdown('```riddle-embed\n{"kind":"youtube","url":"invalid"}\n```'); assert.match(invalid,/<code/);
});
test("metadata extraction uses OG first and resolves images against the actual final URL", () => {
  const data = extractMetadata('<title>Fallback &amp; Title</title><meta content="OG &amp; title" property="og:title"><meta name="description" content="Summary"><meta property="og:image" content="../cover.png">', new URL("https://news.org/articles/page"));
  assert.deepEqual(data,{title:"OG & title",description:"Summary",image:"https://news.org/cover.png"});
  assert.equal(extractMetadata('<title>Just a title</title>',new URL("https://news.org/page")).image,"");
});
test("rejects private, reserved, mapped and encoded network addresses", () => {
  for (const address of ["0.0.0.0","10.1.2.3","127.0.0.1","169.254.169.254","172.16.0.1","192.168.1.1","100.64.0.1","198.19.0.1","203.0.113.1","224.0.0.1","::1","::ffff:127.0.0.1","fc00::1","2001:0000:1::1","2001:db8::1","2002:7f00:1::"]) assert.equal(publicAddress(address),false,address);
  for (const address of ["8.8.8.8","93.184.216.34","2606:4700:4700::1111","2001:4860:4860::8888"]) assert.equal(publicAddress(address),true,address);
  for (const url of ["http://news.org/","https://127.1/","https://0x7f000001/","https://[::1]/","https://localhost/","https://private.local/","https://user:pass@news.org/","https://news.org:8443/"]) assert.throws(() => metadataUrl(url));
});
const dns = (address="93.184.216.34") => Response.json({Status:0,Answer:[{type:1,data:address}]});
const page = (html='<title>Page</title>',headers={}) => new Response(html,{headers:{"content-type":"text/html",...headers}});
test("metadata API follows bounded public redirects and sends no credentials", async () => {
  const calls=[];
  const fetcher=async (input,init) => { const url=String(input); calls.push({url,init}); if(url.startsWith("https://dns.google/")) return dns(); if(url.includes("first.org")) return new Response(null,{status:302,headers:{location:"https://news.org/final"}}); return page('<meta property="og:image" content="cover.png"><title>Final</title>'); };
  const data=await fetchLinkMetadata("https://first.org/path",fetcher); assert.equal(data.image,"https://news.org/cover.png");
  assert.ok(calls.every(({init}) => !JSON.stringify(init.headers).includes("Authorization")));
  const handler=createWorkerHandler(fetcher); const env={ASSETS:{fetch:async()=>new Response("asset")}};
  const result=await handler(new Request("https://cms.4mg.dev/api/link-metadata",{method:"POST",headers:{"content-type":"application/json",Origin:"https://cms.4mg.dev"},body:JSON.stringify({url:"https://news.org/"})}),env);
  assert.equal(result.status,200); assert.equal((await result.json()).title,"Final");
  const forbidden=await handler(new Request("https://cms.4mg.dev/api/link-metadata",{method:"POST",headers:{Origin:"https://evil.org"},body:'{}'}),env); assert.equal(forbidden.status,403);
});
test("metadata errors preserve failures rather than fetching unsafe or huge pages", async () => {
  await assert.rejects(fetchLinkMetadata("https://news.org/", async(input)=>String(input).startsWith("https://dns.google/") ? dns("127.0.0.1") : assert.fail("private fetch")),/公開ネットワーク/);
  await assert.rejects(fetchLinkMetadata("https://news.org/", async(input)=>String(input).startsWith("https://dns.google/") ? dns() : new Response(null,{status:302,headers:{location:"https://127.0.0.1/"}})));
  await assert.rejects(fetchLinkMetadata("https://news.org/", async(input)=>String(input).startsWith("https://dns.google/") ? dns() : new Response(null,{status:302,headers:{location:"https://news.org/again"}})),/リダイレクト/);
  await assert.rejects(fetchLinkMetadata("https://news.org/", async(input)=>String(input).startsWith("https://dns.google/") ? dns() : page("x",{"content-length":"2000000"})),/大きすぎ/);
  await assert.rejects(fetchLinkMetadata("https://news.org/", async(input)=>String(input).startsWith("https://dns.google/") ? dns() : page("x".repeat(1_048_577))),/大きすぎ/);
  await assert.rejects(fetchLinkMetadata("https://news.org/", async(input)=>String(input).startsWith("https://dns.google/") ? dns() : new Response("binary",{headers:{"content-type":"image/png"}})),/HTML/);
});
test("actual list-switch script restores per-page settings and preserves filter state", async () => {
  const source=await readFile(new URL("../../src/components/ListViewSwitch.astro",import.meta.url),"utf8");
  const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const js=(await transform(script,{loader:"ts",target:"es2022"})).code;
  const window=new Window({url:"https://4mg.dev/gallery/"});
  const setup=()=> { window.document.body.innerHTML='<div data-list-switch data-target="items" data-page="gallery"><button data-view="grid"></button><button data-view="list"></button></div><div id="items" data-view="grid"><article style="display:none"></article><article></article></div>'; };
  setup(); window.eval(js);
  assert.equal(window.document.getElementById("items").dataset.view,"grid");
  window.document.querySelector('[data-view="list"]').click();
  assert.equal(window.document.getElementById("items").dataset.view,"list"); assert.equal(window.document.querySelector("article").style.display,"none");
  assert.equal(window.document.querySelector('[data-view="list"]').getAttribute("aria-pressed"),"true");
  setup(); window.document.dispatchEvent(new window.Event("astro:page-load")); assert.equal(window.document.getElementById("items").dataset.view,"list");
  window.localStorage.setItem("riddle-list-view:gallery","bogus"); setup(); window.document.dispatchEvent(new window.Event("astro:page-load")); assert.equal(window.document.getElementById("items").dataset.view,"grid");
  await window.happyDOM.close();
});

test("metadata timeout interrupts an unresponsive fetch", async () => {
  const original=globalThis.setTimeout;
  globalThis.setTimeout=(callback,ms,...args)=>original(callback,ms===8000?10:ms,...args);
  try { await assert.rejects(fetchLinkMetadata("https://news.org/",async(_input,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener("abort",()=>reject(new Error("aborted")),{once:true}))),/タイムアウト/); }
  finally {globalThis.setTimeout=original;}
});


test("Gallery related sections preserve new embed cards and custom text", () => {
  const card=embedMarkdown({kind:"card",url:"/journal/2026-08-02/"});
  const source=`Intro\n\n## 関連記事\n\n- [作品記事](/journal/legacy/)\n\n${card}\n\nCustom text\n\n## Next\nTail`;
  const result=galleryBodySections(source);
  assert.equal(result.articleUrl,"/journal/legacy/");assert.match(result.body,/Custom text/);assert.ok(result.body.includes(card));assert.match(result.body,/## Next\nTail/);assert.ok(!result.body.includes("[作品記事]"));
});

test("concurrent Markdown renders keep internal card contexts separate", async () => {
  const markdown=embedMarkdown({kind:"card",url:"/journal/one/"});
  const card=(title)=>()=>({url:"/journal/one/",title,description:"",image:""});
  const [first,second]=await Promise.all([renderContentMarkdown(markdown,card("First")),renderContentMarkdown(markdown,card("Second"))]);
  assert.match(first,/First/);assert.ok(!first.includes("Second"));assert.match(second,/Second/);assert.ok(!second.includes("First"));
});
