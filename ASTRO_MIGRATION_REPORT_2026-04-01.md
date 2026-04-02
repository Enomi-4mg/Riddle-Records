# Jekyll→Astro 移行調査レポート

作成日: 2026-04-01
対象リポジトリ: Riddle-Records

## 1. 結論サマリ

- このサイトは Jekyll の Collections + Liquid + Data(YAML) を中心に構成されており、Astro への移行は十分可能。
- ただし、移行の本質は「テンプレート置換」よりも「データ設計の再定義」と「URL互換維持」。
- 特に Gallery と Journal の相互連携ロジック（article_url / making_article_url / featured_related / thumbnail系）は、Astro 側で明示的に再実装する必要がある。
- 段階移行（まず URL とコンテンツモデルを固定し、その後 UI/JS を移植）を推奨。

## 2. 現行構成の調査結果

### 2.1 Jekyll 依存の中核

- `_config.yml`
  - collections: `journal`, `songs`
  - permalink:
    - journal: `/journal/:name/`
    - songs: `/disco/:name/`
  - `baseurl: /Riddle-Records`
  - Cloudinary 設定 (`cloudinary_url`, `cloudinary_cloud_name`)
  - OGP/Twitter 共通値
- `_layouts/default.html`
  - 全体 HTML 枠、OGP/Twitter、外部 CDN、共通 CSS/JS 読み込み
  - page 条件で `journal.css` を読み分け
- `_layouts/post.html`
  - 記事ページ共通表示
  - `use_math` 条件で MathJax を読み込み
  - 関連作品・関連記事・前後記事ロジックを Liquid で実装
- `_includes/*.html`
  - header/sidebar/footer
  - `window.galleryData = {{ site.data.gallery | jsonify }}` を注入
- `_data/gallery.yml`
  - Gallery のマスタデータ
  - Journal 連携キー: `article_url`, `making_article_url`
  - サムネイル選定キー: `thumbnail_class`, `thumbnail`
- `_plugins/cloudinary.rb`
  - Liquid フィルタ（Astro移行時は不要）

### 2.2 コンテンツデータ

- Journal: `_journal/*.md`
  - 主キー: `title`, `date`
  - 任意: `og_description`, `image`, `featured_related`, `permalink`, `use_math`
- Songs: `_songs/*.md`
  - 主キー: `title`, `date`, `youtube_id`
  - 任意: `tags`, `credits`, `description`, `lyrics`
- ページ: `index.html`, `about.html`, `journal.md`, `gallery.md`, `disco.md`, `info.md`, `tech.md`
  - Front Matter + Liquid で動的表示

### 2.3 フロントエンド実装

- `script.js`
  - AJAX ページ遷移、カーテン演出、リンク再バインド
  - ナビ active 更新、copy button 初期化などを再実行
- `assets/js/gallery.js`
  - ソート/フィルタ
  - 関連作品セクション空判定
- CSS は概ねそのまま再利用可能

### 2.4 CI/CD

- `.github/workflows/jekyll.yml`
  - Ruby セットアップ + Jekyll build + GitHub Pages deploy
  - Astro へ移行後は Node ベースの Pages ワークフローに置換が必要

## 3. 移行時に維持すべき仕様（重要）

### 3.1 URL 互換

既存の公開 URL を維持すること（SEO/外部リンク保護）:

- `/`
- `/about`
- `/journal`
- `/journal/YYYY-MM-DD/`
- `/journal/YYYY-MM-DD/<slug>-making/`（permalink 指定分）
- `/gallery`
- `/disco`
- `/disco/YYYY-MM-DD/`
- `/info`
- `/tech`

### 3.2 Gallery ↔ Journal 連携

現行仕様で重要なもの:

- Gallery YAML の `article_url` / `making_article_url` で記事連携
- Journal Front Matter の `featured_related` で手動関連表示
- Journal一覧サムネイルは
  - 1) `thumbnail_class` 優先
  - 2) 次に `thumbnail: true`
  - 3) なければ `/favicon/icon.jpg`

### 3.3 OGP/Twitter

- 現行の条件分岐（page.image の URL/ID判定、youtube_id fallback、site default）を Astro Layout で再現

### 3.4 数式レンダリング

- `use_math: true` の記事だけ MathJax を読み込む仕様を維持

## 4. Astro での推奨アーキテクチャ

## 4.1 目標ディレクトリ（提案）

```text
src/
  content/
    journal/*.md
    songs/*.md
  data/
    gallery.yml
  layouts/
    BaseLayout.astro
    PostLayout.astro
  components/
    Header.astro
    Sidebar.astro
    Footer.astro
  pages/
    index.astro
    about.astro
    journal/index.astro
    journal/[...slug].astro
    gallery.astro
    disco/index.astro
    disco/[...slug].astro
    info.astro
    tech.astro
  scripts/
    gallery.ts
    transitions.ts
public/
  assets/
  favicon/
  jpg/
  png/
  tools/
```

## 4.2 Astro Content Collections

`src/content/config.ts` で schema 定義を推奨:

- journal schema
  - title, date 必須
  - og_description, image, featured_related, use_math, permalink 任意
- songs schema
  - title, date, youtube_id 必須
  - tags, credits, description, lyrics 任意

これにより Front Matter の型検証が可能になり、今後の運用ミスを抑制できる。

## 4.3 Data ファイル

- `src/data/gallery.yml` を維持
- Astro 側で YAML 読み込み（`yaml` パッケージ利用または JSON 化）
- `article_url`, `making_article_url`, `thumbnail_class`, `thumbnail` の意味論をコードで固定

## 4.4 JS の扱い

- `script.js` はそのまま移植せず、責務分割推奨
  - ページ遷移演出
  - ナビ active 制御
  - ページ別初期化（gallery/post）
- Astro の View Transitions を採用する場合、既存 AJAX 遷移と競合するためどちらか一方に寄せる

## 5. 実行手順（推奨）

### Phase 0: 凍結と基準化

1. 現行公開サイトの URL 一覧を収集
2. 主要ページのスクリーンショット保存（回帰比較用）
3. 既存 `_site/` は参照専用扱いにして、手編集禁止を徹底

### Phase 1: Astro 基盤構築

1. Astro プロジェクト初期化
2. GitHub Pages 用 `base` を `/Riddle-Records` に設定
3. 共通 Layout/Components の雛形作成
4. 既存 CSS を暫定コピーして見た目崩れを最小化

### Phase 2: コンテンツ移行

1. `_journal` → `src/content/journal`
2. `_songs` → `src/content/songs`
3. `gallery.yml` を `src/data` へ移動
4. schema 作成と型エラー修正

### Phase 3: ページ移行

優先順:

1. index/about/info/tech（静的寄り）
2. journal 一覧 + journal 詳細
3. disco 一覧 + song 詳細
4. gallery

この順序なら、連携ロジックの複雑な箇所を後段に回せる。

### Phase 4: 連携ロジック再実装

1. Journal一覧のサムネイル選定規則
2. 記事内画像と Gallery データの対応表示
3. featured_related / same-date 作品表示
4. 関連記事（tag一致）

### Phase 5: デプロイ切替

1. Jekyll workflow を退役
2. Astro build + upload-pages-artifact + deploy-pages に置換
3. main push で本番切替

## 6. リスクと対策

- URL 不一致
  - 対策: 旧URL一覧と 1:1 照合テスト
- baseurl 差分でアセット404
  - 対策: `import.meta.env.BASE_URL`/`site` 設定で統一
- Gallery連携欠落
  - 対策: 連携規則をユニットテスト化
- OGP 退行
  - 対策: 代表ページで meta タグ自動検証
- 遷移JSの競合
  - 対策: 既存AJAXかAstro View Transitionsのどちらかに統一

## 7. 検証チェックリスト

- [ ] 既存公開URLがすべて 200
- [ ] Journal/Songs/Gallery の件数一致
- [ ] Journal一覧サムネイル規則一致
- [ ] Gallery フィルタ/ソート動作一致
- [ ] 記事内「ギャラリーで見る」ボタン動作
- [ ] 関連作品/関連記事の表示一致
- [ ] OGP/Twitterカードが代表ページで一致
- [ ] `use_math: true` 記事のみ MathJax 有効
- [ ] GitHub Pages で `/Riddle-Records` 配下に正しく配信

## 8. 推奨する実装方針

- 一気に作り直すより、「URL維持を最優先」に段階移行する。
- まずは Liquid 依存ロジックを Astro 側に純関数として移し、見た目は後追いで微調整する。
- Gallery-Journal 連携ルールをコード上で明文化し、将来の更新時に壊れないようテストを追加する。

## 9. 移行対象外/注意点

- `legacy/` は参考アーカイブ。移行対象に含めない運用が妥当。
- `_site/` は生成物。Astro移行後は `dist/` が生成物になるため、混在運用は避ける。
- `Gemfile` / Ruby 依存は移行完了後に撤去可能（ただし段階移行中は併存可）。

## 10. 直近アクション（次に着手するなら）

1. Astro の最小雛形を別ブランチで作成
2. `journal` と `songs` の Content Collections schema を先行作成
3. `journal` 詳細ページ1本を PoC 実装し、URL/OGP/関連作品を検証
4. 問題なければ一覧ページ・galleryへ拡張
