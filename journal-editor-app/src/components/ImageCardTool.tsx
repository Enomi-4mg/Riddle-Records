import { useMemo, useState } from "react";
import { galleryIds } from "../data/galleryIds";
import type { FrontmatterForm } from "../types/journal";
import {
  addRelatedIds,
  buildCardsHtml,
  buildGalleryCode,
  createImageCard,
  extractCardsFromHtml,
  type CardLayout,
  type ImageCard,
  resolveEditorImage
} from "../lib/media";
import { Field, Readout } from "./shared";

const lightboxPresets = ["Journal", "diary", "gallery", "making-comparison", "custom"] as const;

function ImagePreview({ label, value, transform }: { label: string; value: string; transform?: string }) {
  const image = resolveEditorImage(value, transform);
  return (
    <div className="media-preview-item">
      <div>
        <strong>{label}</strong>
        <span>{image.label}</span>
        {image.url && <code>{image.url}</code>}
      </div>
      {image.url && <img src={image.url} alt={`${label} preview`} loading="lazy" />}
    </div>
  );
}

export function ImageCardTool({ body, frontmatter, onInsert, onFrontmatterChange, onCopy, onNotice, onClose }: {
  body: string;
  frontmatter: FrontmatterForm;
  onInsert: (html: string) => void;
  onFrontmatterChange: <K extends keyof FrontmatterForm>(key: K, value: FrontmatterForm[K]) => void;
  onCopy: (text: string, label: string) => void;
  onNotice: (notice: string) => void;
  onClose: () => void;
}) {
  const [layout, setLayout] = useState<CardLayout>("journal-card-grid");
  const [lightboxPreset, setLightboxPreset] = useState<(typeof lightboxPresets)[number]>("Journal");
  const [customLightbox, setCustomLightbox] = useState("");
  const [cards, setCards] = useState<ImageCard[]>([createImageCard()]);
  const [extractedCards, setExtractedCards] = useState<ImageCard[]>([]);

  const lightboxGroup = lightboxPreset === "custom" ? customLightbox || "Journal" : lightboxPreset;
  const cardsHtml = useMemo(() => buildCardsHtml(cards, layout, lightboxGroup), [cards, layout, lightboxGroup]);
  const galleryCode = useMemo(() => buildGalleryCode(cards, layout, frontmatter), [cards, layout, frontmatter]);
  const activeIds = cards.map((card) => card.cloudinaryId.trim()).filter(Boolean);
  const extractedIds = extractedCards.map((card) => card.cloudinaryId.trim()).filter(Boolean);

  function updateCard(index: number, patch: Partial<ImageCard>) {
    setCards((current) => current.map((card, cardIndex) => cardIndex === index ? { ...card, ...patch } : card));
  }

  function addCardsToFeatured(ids: string[], label: string) {
    const next = addRelatedIds(frontmatter.featured_related, ids);
    onFrontmatterChange("featured_related", next);
    onNotice(`${label}をfeatured_relatedに追加しました`);
  }

  function analyzeBody() {
    const parsed = extractCardsFromHtml(body);
    setExtractedCards(parsed);
    if (parsed.some((card) => card.comparisonLabel)) setLayout("making-comparison-grid");
    onNotice(parsed.length ? `本文から${parsed.length}件のカードを抽出しました` : "本文内にカードが見つかりませんでした");
  }

  return (
    <aside className="tool-drawer" role="dialog" aria-label="画像カードツール">
      <header className="drawer-header">
        <div>
          <p>Media Tool</p>
          <h2>画像カード</h2>
        </div>
        <button onClick={onClose}>閉じる</button>
      </header>

      <section className="settings-section">
        <h3>画像プレビュー</h3>
        <div className="media-preview-list">
          <ImagePreview label="thumbnail" value={frontmatter.thumbnail} />
          <ImagePreview label="og_image" value={frontmatter.og_image} transform="w_1200,h_630,c_fill,q_auto,f_auto" />
          <ImagePreview label="legacy image" value={frontmatter.image} />
        </div>
      </section>

      <section className="settings-section">
        <h3>生成設定</h3>
        <div className="field-grid">
          <Field label="カードレイアウト">
            <select value={layout} onChange={(event) => setLayout(event.target.value as CardLayout)}>
              <option value="journal-card-grid">journal-card-grid</option>
              <option value="making-comparison-grid">making-comparison-grid</option>
            </select>
          </Field>
          <Field label="Lightbox group">
            <select value={lightboxPreset} onChange={(event) => setLightboxPreset(event.target.value as (typeof lightboxPresets)[number])}>
              {lightboxPresets.map((preset) => <option value={preset} key={preset}>{preset}</option>)}
            </select>
          </Field>
        </div>
        {lightboxPreset === "custom" && (
          <Field label="カスタムLightbox group">
            <input value={customLightbox} onChange={(event) => setCustomLightbox(event.target.value)} placeholder="custom-group" />
          </Field>
        )}
      </section>

      <section className="settings-section">
        <div className="section-line">
          <h3>カード</h3>
          <button onClick={() => setCards((current) => [...current, createImageCard()])}>追加</button>
        </div>
        <datalist id="gallery-id-list">
          {galleryIds.map((id) => <option value={id} key={id} />)}
        </datalist>
        {cards.map((card, index) => (
          <article className="media-card-editor" key={card.id}>
            <div className="section-line">
              <strong>Card {index + 1}</strong>
              <button onClick={() => setCards((current) => current.length === 1 ? [createImageCard()] : current.filter((_, cardIndex) => cardIndex !== index))}>削除</button>
            </div>
            <Field label="Cloudinary ID">
              <input list="gallery-id-list" value={card.cloudinaryId} onChange={(event) => updateCard(index, { cloudinaryId: event.target.value })} placeholder="example_abcd12.jpg" />
            </Field>
            {card.cloudinaryId && <ImagePreview label="card image" value={card.cloudinaryId} />}
            <div className="field-grid">
              <Field label="caption / alt">
                <input value={card.caption} onChange={(event) => updateCard(index, { caption: event.target.value })} />
              </Field>
              <Field label="heading">
                <input value={card.heading} onChange={(event) => updateCard(index, { heading: event.target.value })} />
              </Field>
            </div>
            <div className="field-grid">
              <Field label="slug (Gallery詳細URL)">
                <input value={card.slug} onChange={(event) => updateCard(index, { slug: event.target.value })} placeholder="work-title" />
              </Field>
              <Field label="article_url">
                <input value={card.articleUrl} onChange={(event) => updateCard(index, { articleUrl: event.target.value })} placeholder="未入力なら記事URLを使用" />
              </Field>
            </div>
            <Field label="description (Gallery用)">
              <input value={card.description} onChange={(event) => updateCard(index, { description: event.target.value })} />
            </Field>
            <Field label="body (Gallery詳細本文)">
              <textarea value={card.body} onChange={(event) => updateCard(index, { body: event.target.value })} placeholder="空なら出力しません" />
            </Field>
            <div className="field-grid">
              <Field label="tags (Gallery用)">
                <input value={card.categories} onChange={(event) => updateCard(index, { categories: event.target.value })} placeholder="3DCG, Illustration" />
              </Field>
              <Field label="making_article_url">
                <input value={card.makingArticleUrl} onChange={(event) => updateCard(index, { makingArticleUrl: event.target.value })} />
              </Field>
            </div>
            <div className="field-grid">
              <Field label="comparison_label">
                <input value={card.comparisonLabel} onChange={(event) => updateCard(index, { comparisonLabel: event.target.value })} />
              </Field>
              <Field label="comparison_order">
                <input type="number" value={card.comparisonOrder} onChange={(event) => updateCard(index, { comparisonOrder: event.target.value })} />
              </Field>
            </div>
            <div className="button-row">
              <label className="check-row"><input type="checkbox" checked={card.detail} onChange={(event) => updateCard(index, { detail: event.target.checked })} /> detail page</label>
              <label className="check-row"><input type="checkbox" checked={card.thumbnail} onChange={(event) => updateCard(index, { thumbnail: event.target.checked })} /> thumbnail</label>
              <label className="check-row"><input type="checkbox" checked={card.noGalleryButton} onChange={(event) => updateCard(index, { noGalleryButton: event.target.checked })} /> no-gallery-button</label>
            </div>
          </article>
        ))}
      </section>

      <section className="settings-section">
        <h3>出力</h3>
        <div className="button-row">
          <button onClick={() => onCopy(cardsHtml, "カードHTML")} disabled={!cardsHtml}>HTMLコピー</button>
          <button onClick={() => onInsert(`\n\n${cardsHtml}\n\n`)} disabled={!cardsHtml}>本文に挿入</button>
          <button onClick={() => addCardsToFeatured(activeIds, "生成カードID")} disabled={!activeIds.length}>featured_relatedに追加</button>
        </div>
        <Field label="カードHTML">
          <textarea className="output compact-output" value={cardsHtml} readOnly spellCheck={false} />
        </Field>
        <Readout label="生成カードID" value={activeIds.join(", ") || "未入力"} />
        <Field label="Gallery登録コード">
          <textarea className="output compact-output" value={galleryCode} readOnly spellCheck={false} />
        </Field>
        <button onClick={() => onCopy(galleryCode, "Gallery登録コード")} disabled={!galleryCode}>Galleryコードをコピー</button>
      </section>

      <section className="settings-section">
        <div className="section-line">
          <h3>本文から抽出</h3>
          <button onClick={analyzeBody}>抽出</button>
        </div>
        <Readout label="本文内カード数" value={`${extractedCards.length} cards`} />
        <Readout label="抽出カードID" value={extractedIds.join(", ") || "未抽出"} />
        <div className="button-row">
          <button onClick={() => setCards(extractedCards.length ? extractedCards : cards)} disabled={!extractedCards.length}>抽出カードを編集に使う</button>
          <button onClick={() => addCardsToFeatured(extractedIds, "抽出カードID")} disabled={!extractedIds.length}>featured_relatedに追加</button>
        </div>
      </section>
    </aside>
  );
}
