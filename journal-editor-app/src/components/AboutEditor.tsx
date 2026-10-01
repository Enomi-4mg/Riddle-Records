import { useState } from "react";
import type { AboutProfile } from "../../../shared/aboutProfile";
import { featuredWorkOptions, validateAboutDocument } from "../lib/about";
import { resolveImageUrl } from "../../../src/utils/images";
import { MediaLibrary } from "./MediaLibrary";
import type { ContentDocument } from "../types/content";
import type { MediaRegistry } from "../types/media";
import defaultIcon from "../../../favicon/icon.jpg?url";

type Props = { document: ContentDocument; documents: ContentDocument[]; registry: MediaRegistry; disabled?: boolean; onChange: (document: ContentDocument) => void; onSave: () => void };
export function AboutEditor({ document: doc, documents, registry, disabled, onChange, onSave }: Props) {
  const [media, setMedia] = useState(false); const [query, setQuery] = useState(""); const [kind, setKind] = useState("all");
  if (doc.placement.kind !== "about") return null;
  const profile = doc.placement.data;
  const options = featuredWorkOptions(documents);
  const errors = validateAboutDocument(doc, documents);
  const update = (data: AboutProfile) => onChange({ ...doc, placement: { kind: "about", data }, common: { ...doc.common, title: data.name, description: data.bio, publication: "published" } });
  const field = <K extends keyof AboutProfile>(key: K, value: AboutProfile[K]) => update({ ...profile, [key]: value });
  return <section className="about-editor"><header className="section-heading"><div><p>Profile</p><h1>About</h1></div><button className="primary" disabled={disabled || errors.length > 0} onClick={onSave}>変更を保存</button></header><p>サイトに1件だけあるプロフィールです。保存後、「記事をデプロイ」でサイトに反映します。</p>
    <fieldset disabled={disabled} className="about-fields"><legend className="sr-only">プロフィール</legend>
      <section className="about-basic"><label>アイコン<span className="input-with-action"><input value={profile.icon} onChange={(event) => field("icon", event.target.value)} placeholder="画像URL / Cloudinary ID / サイト内パス" /><button type="button" onClick={() => setMedia(true)}>画像を選択</button></span></label><img className="about-icon-preview" src={resolveImageUrl(profile.icon) || defaultIcon} alt="プロフィール画像プレビュー" /><small>空欄の場合は既定のプロフィール画像を使用します。</small>
        <label>名前<input value={profile.name} onChange={(event) => field("name", event.target.value)} /></label>
        <label>自己紹介<textarea rows={4} value={profile.bio} onChange={(event) => field("bio", event.target.value)} /></label>
        <label>誕生日（月日）<input value={profile.birthday} placeholder="09-26" onChange={(event) => field("birthday", event.target.value)} /></label>
        <label>座右の銘<input value={profile.motto} onChange={(event) => field("motto", event.target.value)} /></label>
      </section>
      {([['hobbies', '趣味'], ['skills', '特技'], ['likes', '好きなもの']] as const).map(([key, label]) => <OrderedTags key={key} label={label} values={profile[key]} onChange={(values) => field(key, values)} />)}
      <section><h2>SNS</h2>{profile.sns.map((item, index) => <div className="about-sns-row" key={index}><label>サービス名<input value={item.service} onChange={(event) => field("sns", profile.sns.map((entry, i) => i === index ? { ...entry, service: event.target.value } : entry))} /></label><label>URL<input type="url" value={item.url} onChange={(event) => field("sns", profile.sns.map((entry, i) => i === index ? { ...entry, url: event.target.value } : entry))} /></label><label>表示ラベル（任意）<input value={item.label} onChange={(event) => field("sns", profile.sns.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} /></label><RowActions label={item.service || `SNS ${index + 1}`} index={index} count={profile.sns.length} onMove={(direction) => field("sns", move(profile.sns, index, direction))} onRemove={() => field("sns", profile.sns.filter((_, i) => i !== index))} /></div>)}<button type="button" onClick={() => field("sns", [...profile.sns, { service: "", url: "", label: "" }])}>SNSを追加</button></section>
      <section><h2>Featured Works</h2><p>選択した順で「最近の作品・おすすめ作品」に表示します。公開されたVisual / Musicから選択できます。</p>
        {!profile.featuredWorks.length && <p className="about-empty">作品は未選択です。サイトにも空状態を表示します。</p>}
        <ol className="about-featured-list">{profile.featuredWorks.map((id, index) => { const work = options.find((item) => item.id === id); return <li key={`${id}:${index}`}><div className="about-work-preview">{work?.thumbnail && <img src={work.thumbnail} alt="" />}<span>{work?.title || `参照できない作品: ${id}`}<small>{work?.kind === "music" ? "Music" : work?.kind === "visual" ? "Visual" : id}</small></span></div><RowActions label={work?.title || id} index={index} count={profile.featuredWorks.length} onMove={(direction) => field("featuredWorks", move(profile.featuredWorks, index, direction))} onRemove={() => field("featuredWorks", profile.featuredWorks.filter((_, i) => i !== index))} /></li>; })}</ol>
        <div className="filter-bar"><input aria-label="作品を検索" placeholder="作品タイトルを検索" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="作品の種別" value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">All</option><option value="visual">Visual</option><option value="music">Music</option></select></div>
        <div className="about-work-options">{options.filter((work) => (kind === "all" || work.kind === kind) && work.title.toLowerCase().includes(query.toLowerCase())).map((work) => <button type="button" key={work.id} disabled={profile.featuredWorks.includes(work.id)} aria-label={`${work.title}を追加`} onClick={() => field("featuredWorks", [...profile.featuredWorks, work.id])}><span className="about-work-preview"><img src={work.thumbnail} alt="" loading="lazy" /><span>{work.title}<small>{work.kind === "music" ? "Music" : "Visual"}{profile.featuredWorks.includes(work.id) ? " · 選択済み" : ""}</small></span></span></button>)}</div>
      </section>
    </fieldset>
    {errors.length > 0 && <div className="about-errors" role="alert"><strong>保存前に確認してください</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
    {media && <div className="modal-backdrop media-picker"><div className="media-picker-panel"><header><h2>アイコンを選択</h2><button onClick={() => setMedia(false)}>閉じる</button></header><MediaLibrary registry={{ ...registry, assets: registry.assets.filter((asset) => asset.type === "image") }} onSelect={(asset) => { field("icon", asset.publicId); setMedia(false); }} /></div></div>}
  </section>;
}
function move<T>(items: T[], index: number, direction: number): T[] { const result = [...items]; const target = index + direction; if (target < 0 || target >= items.length) return result; [result[index], result[target]] = [result[target], result[index]]; return result; }
function RowActions({ label, index, count, onMove, onRemove }: { label: string; index: number; count: number; onMove: (direction: number) => void; onRemove: () => void }) {
  return <span className="button-row about-row-actions"><button type="button" disabled={index === 0} aria-label={`${label}を上へ`} onClick={() => onMove(-1)}>↑</button><button type="button" disabled={index === count - 1} aria-label={`${label}を下へ`} onClick={() => onMove(1)}>↓</button><button type="button" aria-label={`${label}を削除`} onClick={onRemove}>削除</button></span>;
}
function OrderedTags({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  const [buffer, setBuffer] = useState("");
  const add = () => { const tags = buffer.split(",").map((tag) => tag.trim()).filter(Boolean); if (tags.length) onChange([...values, ...tags]); setBuffer(""); };
  return <section className="about-tag-section"><h2>{label}</h2><div className="about-tags">{values.map((value, index) => <span className="about-tag" key={index}>{value}<RowActions label={`${label}: ${value}`} index={index} count={values.length} onMove={(direction) => onChange(move(values, index, direction))} onRemove={() => onChange(values.filter((_, i) => i !== index))} /></span>)}</div><div className="input-with-action"><input aria-label={`${label}を追加`} placeholder="追加する項目（カンマで複数入力）" value={buffer} onChange={(event) => setBuffer(event.target.value)} onBlur={add} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} /><button type="button" onClick={add}>追加</button></div></section>;
}
