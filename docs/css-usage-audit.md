# CSS 使用状況の確認（#33、2026-10-03）

対象は `assets/css/main.css`、`gallery.css`、`journal.css`、`animations.css`、`embeds.css`。
Astroテンプレート・Markdown本文・共通レンダラー・CMSのHTML生成・ブラウザJS・生成済みHTML・publicツール・legacyページを確認した。
使用確認が取れないものを全面的に削除するのではなく、以下の旧UIに範囲を限定し、38ルールを削除した。

| 候補 | 判断・根拠 |
| --- | --- |
| `.category` / `.category-list` / `.category-*` | 削除。現行のタグはAstroとGallery viewerのJSが生成する `.work-tag`。旧カテゴリクラスを生成する経路はない。 |
| `.article-link-btn` / `.article-links-horizontal` | 削除。現行の作品詳細・一覧は別のリンククラスを使い、Markdown・CMS・JSにも生成経路がない。`journal.css`の旧詳細・一覧向け子孫ルールも削除。 |
| `.post-related*` / `.featured-works` / `.auto-related-works` / `.related-grid` / `.related-item` / `.no-related-text` | 削除。現行Astroに関連記事セクションはなく、レンダラーも生成しない。`script.js`の `.related-grid` はObserver対象からの除外条件のみで、生成処理ではない。`gallery.js`の旧関連作品チェックもDOMを生成せず、対象要素がないと終了する。 |
| `.making-comparison-grid` / `.comparison-*` | 維持。下書き `2025-06-06-five-apples-making.md`、CMS `src/lib/media.ts`、publicのjournal-card-generatorが使用。公開ビルドにない下書きや将来の生成にも必要。 |
| `.journal-card*` / `.gallery-link-btn` | 維持。MarkdownとCMSの画像カード生成、ブラウザのGalleryリンク挿入で使用。 |
| `.active` / `.show` / `.scroll-reveal` / `.copied` など | 維持。JSが動的に付与する状態。 |
| embed / animation / language / Lightbox関連 | 維持。共有レンダラー・外部ライブラリ・コード装飾・動的状態を扱うため、この整理では変更しない。 |

legacyページは `public/legacy/style/legacy.css` を参照し、今回のCSSを参照しない。
legacyのスタイルとHTMLは変更していない。
publicのツールから今回のCSSを直接読み込む経路もない。
サイトCSSを利用するCMSプレビューは同じ共有レンダラーとコンテンツを使うため、生成クラスを確認した。

## 検証

- 削除対象クラスが生成済みHTML全56ファイル（現行・legacy・publicツール）に存在しないことをparse5で確認。
- `/`、`/about/`、`/journal/`、`/works/`、`/gallery/`、`/disco/`、`/project/`、Journalメイキング記事、Gallery作品詳細、楽曲詳細を1280pxと375pxで確認。
- CSS削除前後の同じページを撮影して比較。外部画像と書体は同じキャッシュを使い、アニメーションを止めて比較した。20枚中13枚はピクセル一致し、残りは画像内の微小なラスタライズ差分（平均チャンネル差0.0003未満）だった。
- 同じ20条件で削除前後の全本文要素のcomputed styleと位置・寸法が一致することを確認。
- `npm test`（既存テスト、サイト・CMSビルド、legacyリンク検査）。

ミント系トークンと現行UIのスタイル設計は維持した。
