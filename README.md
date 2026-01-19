# Riddle Records

**4mg** のポートフォリオサイト。日記、音楽作品、イラスト、情報をまとめたサイトです。

- 🎵 ボカロ楽曲の発表
- 📔 活動日記・報告書
- 🎨 イラスト・作品ギャラリー
- 👤 プロフィール・情報ページ

---

## 🚀 クイックスタート

### セットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/miyas/Riddle-Records.git
cd Riddle-Records

# 2. Ruby と Bundler がインストール済みか確認
ruby --version  # Ruby 2.7.0 以上
bundler --version

# 3. 依存関係をインストール
bundle install

# 4. ローカルサーバーを起動
bundle exec jekyll serve

# 5. ブラウザで確認
# http://localhost:4000/Riddle-Records/ を開く
```

```bash
Riddle-Records/
├─ _layouts/                    ← テンプレート（ページの骨組み）
│   ├─ default.html              ← すべてのページの基本テンプレート
│   ├─ post.html                 ← 日記・曲ページ用
│   └─ page.html                 ← About、Gallery など静的ページ用
│
├─ _includes/                   ← 再利用可能なコンポーネント
│   ├─ header.html               ← ハンバーガーメニューボタン
│   ├─ sidebar.html              ← ナビゲーションメニュー
│   └─ footer.html               ← ページ下部
│
├─ _diary/                      ← 日記コンテンツ（Markdown）
│   ├─ 2025-05-01.md
│   ├─ 2025-06-06.md
│   └─ ...
│
├─ _songs/                      ← 曲コンテンツ（Markdown）
│   ├─ 2025-01-03.md
│   ├─ 2025-02-25.md
│   └─ ...
│
├─ _site/                       ← ビルド後のサイト（自動生成、Git 除外）
│
├─ assets/
│   ├─ css/
│   │   ├─ main.css              ← メインスタイル
│   │   └─ gallery.css           ← ギャラリー固有スタイル
│   └─ js/
│       └─ gallery.js            ← ギャラリー機能
│
├─ jpg/, png/                    ← メディアファイル（画像）
│
├─ favicon/                      ← ファビコン
│
├─ diary.md                     ← 日記一覧ページ（Liquid ループで自動生成）
├─ disco.md                     ← 曲一覧ページ（Liquid ループで自動生成）
├─ about.html                   ← プロフィールページ
├─ gallery.html                 ← ギャラリー
├─ info.html                    ← 情報ページ
├─ index.html                   ← トップページ
│
├─ _config.yml                  ← Jekyll 設定ファイル
├─ Gemfile                      ← Ruby 依存関係
├─ .gitignore                   ← Git の除外ファイル設定
├─ script.js                    ← ハンバーガーメニュー制御用 JavaScript
└─ README.md                    ← このファイル
```

```Jykell
{# コメント #}

{{ variable }}                          ← 変数を表示
{{ variable | filter }}                 ← フィルターで加工
{{ site.title }}                        ← _config.yml の値
{{ page.title }}                        ← 各ページのフロントマター値

{% if condition %}                      ← 条件分岐
  content
{% endif %}

{% for item in collection %}            ← ループ
  {{ item.name }}
{% endfor %}

{% include file.html %}                 ← ファイルを埋め込み
```

```Jykell
{{ entry.date | date: "%Y年%m月%d日" }}    ← 日付フォーマット
{{ text | truncatewords: 30 }}             ← 最初の30語まで表示
{{ html | strip_html }}                    ← HTMLタグを削除
{{ array | sort: 'field' }}                ← フィールドでソート
{{ array | reverse }}                      ← 配列を反転
```

【ポイント】
- _ で始まるフォルダ（_layouts など）は Jekyll の特別なフォルダ
- GitHub Pages が自動で _site/ を生成して、それを公開する
- legacy/ フォルダは GitHub Pages には含まれない（.gitignore で除外推奨）

---

## 🖼️ Cloudinary 画像運用ガイド（簡易版）

- **設定**: `_config.yml` に `cloudinary_cloud_name` と `cloudinary_url` を定義済み。参照は `{{ site.cloudinary_url }}` を使用。
- **アップロード**: CloudinaryのMedia Libraryで `riddle-records/jpg/...`・`riddle-records/png/...` に配置。`Public ID`（拡張子なし）を控える。
- **Markdown参照（記事）**: `{{ site.cloudinary_url }}/w_800,q_auto,f_auto/v1/<cloudinary_id>.jpg` を推奨（幅800px・品質自動・形式自動）。
- **サムネイル（ギャラリー）**: `{{ site.cloudinary_url }}/w_400,h_400,c_fill,q_auto,f_auto/v1/<cloudinary_id>.jpg` を推奨（正方形にトリミング）。
- **データ駆動**: `_data/gallery.yml` に `title/date/cloudinary_id/description/categories[]` を追記すると [gallery.md](gallery.md) から自動表示可能（カテゴリは複数可）。
- **暫定運用**: プロジェクトサイトの`baseurl`都合で、ローカル画像は `{{ '/path' | relative_url }}` を使うと404を回避できます。

トラブル時は以下を確認してください：
- 画像が表示されない → `cloudinary_id` が正しいか／拡張子の付与／フォルダ構成の一致
- 404が出る → ルート相対`/path`ではなく `relative_url` か Cloudinary の絶対URLに統一
- iframe警告 → `allowfullscreen`は削除し、`allow`に`fullscreen`を含めて一本化（SpotifyのEME警告は仕様）

---

## 🎨 ギャラリーへの作品追加方法

### 手順

1. **Cloudinaryに画像をアップロード**
   - [Cloudinary Dashboard](https://cloudinary.com/console) にログイン
   - Media Library から画像をアップロード
   - Public ID（拡張子なし）をメモ（例: `my_artwork_abc123`）

2. **`_data/gallery.yml` に新しいエントリを追加**
    ```yaml
    - title: "作品タイトル"
       date: 2026-01-17
       cloudinary_id: "your_public_id.png"  # 拡張子を含める
       description: "作品の説明"
       categories:
          - "イラスト"  # 例: イラスト / 3DCG / 写真
          # - "3DCG"    # 複数カテゴリを付けたい場合は行を追加
       article_url: "/diary/2026-01-17/"  # オプション（関連記事がない場合は ""）
    ```

3. **Git にコミット & プッシュ**
   ```bash
   git add _data/gallery.yml
   git commit -m "Add new artwork to gallery"
   git push origin main
   ```

4. **自動デプロイ完了を待つ**
   - GitHub Actions が自動的にビルド & デプロイ
   - 数分後に公開サイトで確認可能

### ギャラリー機能

- **日時ソート**: 「新しい順」「古い順」ボタンで並び替え
- **カテゴリフィルター**: デフォルトで「イラスト」「3DCG」を表示、「写真」は非表示
- **Lightbox拡大表示**: 画像クリックでモーダル表示、ESCキーで閉じる
- **記事リンク**: `article_url` を設定した作品に「📖 関連記事を読む」ボタンが表示

### 注意点

- **インデント**: YAML は半角スペース2個でインデント（タブ禁止）
- **引用符**: ダブルクォート `"` で統一
- **カテゴリ複数対応**: `categories` は配列。主要カテゴリは「イラスト」「3DCG」「写真」。（フィルタはこの3種で動作）
- **相対パス**: `/diary/2025-06-06/` のように先頭に `/` を付ける
- **空値**: 関連記事がない場合は `article_url: ""` または省略

---
## 🔗 Gallery & Diary 連携機能

このサイトでは、Gallery と Diary が密接に連携しており、作品と記事を横断的に閲覧できます。

### 機能概要

#### 1. Gallery → Diary へのリンク

Gallery ページの各作品カードに、関連する記事へのリンクボタンが表示されます。

- **📖 作品記事**: 作品の制作背景や使用した記事へのリンク（`article_url` で指定）
- **📝 メイキング**: 制作過程の詳細を解説した記事へのリンク（`making_article_url` で指定）

#### 2. Diary → Gallery への自動リンク

記事内で使用された画像を自動検出し、対応する Gallery 作品へのリンクボタン（📸 ギャラリーで見る）が画像の下に表示されます。

#### 3. 関連作品の自動表示

記事ページの末尾に「関連作品」セクションが自動的に表示されます。

- **📌 おすすめ**: 手動で指定した関連作品（`featured_related` で指定）
- **📅 同じ日の作品**: 記事と同じ日付の Gallery 作品を自動抽出

### 設定方法

#### Gallery データ（`_data/gallery.yml`）

```yaml
- title: "作品タイトル"
  date: 2025-06-06
  cloudinary_id: "your_image_id.png"
  description: "作品の説明"
  categories:
    - "3DCG"
  article_url: "/diary/2025-06-06/"                        # 作品記事へのリンク
  making_article_url: "/diary/2025-06-06/five-apples-making/"  # メイキング記事へのリンク（任意）
```

#### 記事の FrontMatter（`_diary/*.md`）

```yaml
---
layout: post
title: "5月の報告書"
date: 2025-06-06

# 手動で指定する関連作品（任意）
featured_related:
  - "five_apples_spot_angle2_xmytbf.png"  # 五つのりんご（被写界深度なし）
  - "mt.fuji_b82xur.jpg"                   # 富士山
---
```

**ポイント:**
- `featured_related` には gallery.yml の `cloudinary_id` を配列で指定
- コメント（`#`）で作品名を併記すると管理しやすい
- 指定しない場合は、同じ日付の作品のみが自動表示される

#### メイキング記事の作成

メイキング記事は通常の Diary 記事と同じ方法で作成し、`permalink` で URL を指定します。

**ファイル名**: `_diary/YYYY-MM-DD-[作品名]-making.md`（例: `2025-06-06-five-apples-making.md`）

```yaml
---
layout: post
title: "五つのりんご - メイキング"
date: 2025-06-06
permalink: /diary/2025-06-06/five-apples-making/
---

## 制作過程

...メイキング内容...
```

**URL構造**: `/diary/2025-06-06/five-apples-making/` のように、日付ディレクトリ内に配置されます。

### 動作の仕組み

1. **自動画像検出**: 記事内の Cloudinary URL を JavaScript で抽出し、`gallery.yml` と照合
2. **Gallery リンク生成**: 一致する作品が見つかった場合、画像下に「ギャラリーで見る」ボタンを自動挿入
3. **関連作品表示**: `featured_related` と同日付作品を Liquid テンプレートで自動取得・表示

---

## 🚧 今後の改善案

以下は、将来的に実装を検討している機能です。

### 1. メイキング記事の permalink 自動化

**現状**: メイキング記事の `permalink` を手動で指定する必要がある

**改善案**: `_config.yml` で以下のようなパターンを設定し、ファイル名から自動生成

```yaml
collections:
  diary:
    output: true
    permalink: /diary/:year-:month-:day/:title/
```

これにより、`2025-06-06-five-apples-making.md` から `/diary/2025-06-06/five-apples-making/` が自動生成される。

### 2. featured_related の空配列対応

**現状**: `featured_related: []` の場合でも「おすすめ」セクションが表示される可能性

**改善案**: Liquid テンプレート内で `page.featured_related.size > 0` の条件分岐を追加し、空の場合は非表示にする。

### 3. サイドバーへの関連作品表示

**現状**: 関連作品は記事本文内にのみ表示

**改善案**: `_includes/sidebar.html` に関連作品ウィジェットを追加し、記事閲覧中に常に表示。ただし、情報の二重表示を避けるため、デザイン上の検討が必要。

### 4. Gallery でのメイキング画像プレビュー

**現状**: メイキング記事へのリンクボタンのみ

**改善案**: `gallery.yml` に `making_preview_images` フィールドを追加し、Gallery カードにメイキング画像のサムネイルを表示。

```yaml
making_preview_images:
  - "five_apples_sketch_abc123"
  - "five_apples_wip_def456"
```

### 5. CMS 統一管理

**現状**: 記事と Gallery データを別々に手動管理

**改善案**: Contentful、Forestry、NetlifyCMS などの Headless CMS を導入し、ブラウザの管理画面から記事・Gallery・メイキングを一元管理。記事作成時に Gallery データを自動生成。

### 6. タグ・技法による関連作品検索

**現状**: 日付ベースの関連作品抽出のみ

**改善案**: `gallery.yml` に `tags` や `techniques` フィールドを追加し、同じ技法・テーマの作品をクロスリンク表示。

```yaml
tags:
  - "被写界深度"
  - "Blender"
  - "静物"
techniques:
  - name: "Cycles レンダリング"
    description: "被写界深度の適用方法"
```

---
## 🔄 GitHub Actions による自動デプロイ

このサイトは `.github/workflows/jekyll.yml` によって自動デプロイされます。

### デプロイの流れ

1. `main` ブランチに `git push`
2. GitHub Actions が自動的に起動
3. Jekyll ビルドを実行
4. GitHub Pages にデプロイ

### デプロイ状況の確認

リポジトリの **Actions** タブでビルド状況を確認できます。エラーが発生した場合は、ログを確認してください。

---

## ✍️ Diary の更新手順

1. **記事ファイルを作成**
   - `_diary/YYYY-MM-DD.md` を新規作成（例: `_diary/2026-01-17.md`）。
   - ファイル名の年月日と `date` は揃える。

2. **フロントマターを記述**
   ```md
   ---
   layout: post
   title: "タイトルを書いてね"
   date: 2026-01-17
   ---
   ```

3. **本文を書く**
   - Markdown で自由に記述。見出し・リスト・太字・斜体が使用可能。
   - 画像は相対パス or Cloudinary: `{{ site.cloudinary_url }}/w_800,q_auto,f_auto/v1/<cloudinary_id>.jpg`
   - 動画は `<iframe>` をそのまま貼り付け。

4. **ローカル確認（任意）**
   ```bash
   bundle exec jekyll serve
   ```
   - `http://localhost:4000/Riddle-Records/diary/` で記事が表示されるか確認。

5. **コミット & プッシュ**
   ```bash
   git add _diary/2026-01-17.md
   git commit -m "Add diary 2026-01-17"
   git push origin main
   ```
   - GitHub Pages / Actions が自動でデプロイ。

補足:
- 一覧ページは [diary.md](diary.md) のコレクションループで自動更新されます。
- `_site/` 配下は自動生成物なので手動編集不要です。

---

## 🛠️ 開発ツール

このリポジトリには、画像管理を効率化する便利なツールが含まれています。

### 画像圧縮ツール

[tools/image-compressor.html](tools/image-compressor.html) - ブラウザ内で画像を圧縮できるオフラインツール

**特徴:**
- 📦 **完全オフライン処理** - ImageMagick WASM を使用し、画像データは外部に送信されません
- 🎯 **対応形式** - JPEG, PNG, GIF, BMP, TIFF（WebP は現在未対応）
- ⚡ **バッチ処理** - 複数画像を同時に圧縮（最大3並行）
- 🎨 **詳細設定** - 品質調整（10-100）、プログレッシブJPEG、メタデータ削除、PNG色数削減
- 📁 **柔軟なファイル名** - 元ファイル名保持、タイムスタンプ付与、カスタム接頭辞・接尾辞

**使い方:**
1. ブラウザで `tools/image-compressor.html` を開く
2. 画像をドラッグ&ドロップまたはファイル選択
3. 形式（JPEG/PNG）と品質を選択
4. 「圧縮実行」ボタンをクリック
5. 圧縮前後の比較を確認し、個別にダウンロード

**推奨設定:**
- **Web用画像**: JPEG品質75-85、プログレッシブ有効
- **イラスト・透過PNG**: PNG品質85、色数制限なし
- **写真アーカイブ**: JPEG品質90-95

### Cloudinary URL変換ツール

[tools/cloudinary-url-converter.html](tools/cloudinary-url-converter.html) - Cloudinary URL から Public ID を抽出

**使い方:**
1. Cloudinary ダッシュボードから画像URLをコピー
2. ツールにペーストして「変換」ボタンをクリック
3. 出力された Public ID を `_data/gallery.yml` に貼り付け

---

## 📸 Diary 画像表示機能

Diary投稿内の画像は**カード形式**で統一表示されます。Galleryと同じデザインで、サムネイル表示とLightbox拡大機能に対応しています。

### 画像の配置方法

#### **単独画像**

```html
<div class="diary-card-grid">
  <div class="diary-card">
    <a href="{{ site.cloudinary_url }}/w_1920,q_auto,f_auto/v1/cloudinary_id.jpg" data-lightbox="diary" data-title="画像説明">
      <img src="{{ site.cloudinary_url }}/w_300,h_300,c_fill,q_auto,f_auto/v1/cloudinary_id.jpg" alt="画像説明">
    </a>
    <div class="diary-card-info">
      <h4>画像タイトル</h4>
    </div>
  </div>
</div>
```

#### **複数画像グリッド（2-3列）**

```html
<div class="diary-card-grid">
  <div class="diary-card">
    <!-- カード1 -->
  </div>
  <div class="diary-card">
    <!-- カード2 -->
  </div>
  <div class="diary-card">
    <!-- カード3 -->
  </div>
</div>
```

### 主要なパラメータ

| パラメータ | 説明 | 例 |
|-----------|------|-----|
| `w_300,h_300,c_fill` | サムネイル: 300×300px（正方形） | 表示用 |
| `w_1920,q_auto,f_auto` | フル解像度: 1920px幅（Lightbox用） | クリック時に表示 |
| `data-lightbox="diary"` | Lightboxグループ化（全Diary画像が統一） | クリック拡大機能 |
| `data-title` | Lightboxでの画像説明 | `alt`と同じ値を推奨 |

### スタイル機能

- **レスポンシブ**: 250px幅の自動グリッド、600px以下で1列表示
- **ホバーエフェクト**: マウスオーバーで上に浮上、画像が1.05倍に拡大
- **カード枠**: 白背景+ボーダー+シャドウ（Gallery互換デザイン）
- **自動Lightbox**: JavaScript自動適用により、Markdownの`![...](...)`は自動的にLightbox対応

### ギャラリーで見るボタンの制御

Diary投稿にGalleryに登録されている画像が含まれる場合、自動的に「📸 ギャラリーで見る」ボタンが表示されます。

#### ボタンを非表示にする

Front Matterに `hide_gallery_buttons: true` を追加：

```yaml
---
layout: post
title: "投稿タイトル"
date: 2025-10-01
hide_gallery_buttons: true
---
```

#### 特定の画像だけボタンを非表示にする

画像やラッパー要素に `no-gallery-button` クラスを追加：

```html
<!-- 単独の画像 -->
<img class="no-gallery-button" src="..." alt="...">

<!-- カード形式 -->
<div class="diary-card no-gallery-button">
  <a href="...">
    <img src="..." alt="...">
  </a>
  <div class="diary-card-info">
    <h4>タイトル</h4>
  </div>
</div>

<!-- メイキング比較グリッド全体 -->
<div class="making-comparison-grid no-gallery-button">
  <!-- 画像... -->
</div>
```

#### ボタンのスタイル

- **色**: サイトメインカラー（ターコイズグリーン）のグラデーション
- **テキスト**: 「📸 ギャラリーで見る」のみ（作品タイトルは非表示）
- **配置**: 画像の直後、中央揃え

---