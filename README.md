# Riddle Records

**4mg** のポートフォリオサイト。日記、音楽作品、イラスト、情報をまとめたサイトです。

- 🎵 ボカロ楽曲の発表
- 📔 活動日記・報告書
- 🎨 イラスト・作品ギャラリー
- 👤 プロフィール・情報ページ

---

# 📍 外部向け情報

## サイト構成

トップページから以下の各ページにアクセスできます：

- **日記（diary.md）** - 活動日記・報告書
- **音楽（disco.md）** - 音楽作品一覧
- **ギャラリー（gallery.html）** - イラスト・作品ギャラリー
- **プロフィール（about.html）** - 4mg について
- **情報（info.html）** - その他情報

---

## 🎨 ギャラリー機能

- **日時ソート**: 「新しい順」「古い順」で並び替え
- **カテゴリフィルター**: イラスト、3DCG、写真の3種類でフィルター
- **Lightbox拡大**: 画像クリックでモーダル表示（ESCキーで閉じる）
- **関連記事リンク**: 作品と関連する記事・メイキング記事へのリンク

---

## 🔗 Gallery & Diary 連携

Gallery と Diary は密接に連携しており、作品と記事を横断的に閲覧できます。

### 主な機能

- **Gallery → Diary**: 各作品カードから関連記事・メイキング記事へリンク
- **Diary → Gallery**: 記事内で使用された画像に「📸 ギャラリーで見る」ボタンを自動表示
- **関連作品**: 記事ページ末尾に関連作品セクションを自動表示

---

---

# 🔧 開発者・管理者向けガイド

## 🚀 セットアップ

### 初期セットアップ

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

---

## 🛠️ 開発ガイド

### ディレクトリ構成

```bash
Riddle-Records/
├─ _layouts/                    ← テンプレート（ページの骨組み）
│   ├─ default.html              ← すべてのページの基本テンプレート
│   └─ post.html                 ← 日記・曲ページ用
│
├─ _includes/                   ← 再利用可能なコンポーネント
│   ├─ header.html               ← ハンバーガーメニューボタン
│   ├─ sidebar.html              ← ナビゲーションメニュー
│   └─ footer.html               ← ページ下部
│
├─ _diary/                      ← 日記コンテンツ（Markdown）
├─ _songs/                      ← 音楽作品データ（Markdown）
├─ _data/gallery.yml            ← ギャラリー作品データ
│
├─ assets/
│   ├─ css/                      ← スタイルシート
│   └─ js/                       ← JavaScript機能
│
├─ jpg/, png/                    ← ローカル画像
├─ favicon/                      ← ファビコン
├─ tools/                        ← 画像管理ツール
│
├─ _site/                       ← ビルド後のサイト（自動生成、Git 除外）
├─ _config.yml                  ← Jekyll 設定ファイル
├─ Gemfile                      ← Ruby 依存関係
├─ .gitignore                   ← Git の除外ファイル設定
└─ script.js                    ← ハンバーガーメニュー制御用 JavaScript
```

### Jekyll（Liquid）基本構文

```liquid
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

### よく使うフィルター

```liquid
{{ entry.date | date: "%Y年%m月%d日" }}    ← 日付フォーマット
{{ text | truncatewords: 30 }}             ← 最初の30語まで表示
{{ html | strip_html }}                    ← HTMLタグを削除
{{ array | sort: 'field' }}                ← フィールドでソート
{{ array | reverse }}                      ← 配列を反転
```

### 重要なポイント

- `_` で始くフォルダ（`_layouts` など）は Jekyll の特別なフォルダ
- `_site/` は自動生成物なので手動編集不要
- `legacy/` フォルダは GitHub Pages には含まれない（`.gitignore` で除外推奨）

---

## 📚 コンテンツ管理手順

### 📝 新しい Diary 記事を追加

1. **記事ファイルを作成**
   - `_diary/YYYY-MM-DD.md` を新規作成（例: `_diary/2026-01-17.md`）
   - ファイル名の年月日と `date` を揃える

2. **フロントマターを記述**
   ```yaml
   ---
   layout: post
   title: "タイトルを書いてね"
   date: 2026-01-17
   featured_related:
     - "cloudinary_id1.png"  # ギャラリー作品を手動指定（オプション）
   ---
   ```

3. **本文を書く**
   - Markdown で自由に記述
   - 画像: `{{ site.cloudinary_url }}/w_800,q_auto,f_auto/v1/<cloudinary_id>.jpg`
   - 動画: `<iframe>` をそのまま貼り付け

4. **ローカル確認（任意）**
   ```bash
   bundle exec jekyll serve
   ```

5. **コミット & プッシュ**
   ```bash
   git add _diary/2026-01-17.md
   git commit -m "Add diary 2026-01-17"
   git push origin main
   ```

---

### 🎨 新しい作品をギャラリーに追加

1. **Cloudinary にアップロード**
   - [Cloudinary Dashboard](https://cloudinary.com/console) にログイン
   - 画像をアップロード
   - Public ID を控える（例: `my_artwork_abc123.png`）

2. **`_data/gallery.yml` にエントリを追加**
   ```yaml
   - title: "作品タイトル"
     date: 2026-01-17
     cloudinary_id: "your_public_id.png"  # 拡張子を含める
     description: "作品の説明"
     categories:
       - "イラスト"  # イラスト / 3DCG / 写真
     article_url: "/diary/2026-01-17/"  # 関連記事（オプション）
     making_article_url: "/diary/2026-01-17/making/"  # メイキング（オプション）
     thumbnail: true  # Diary一覧にサムネイル表示する場合（オプション）
   ```

3. **コミット & プッシュ**
   ```bash
   git add _data/gallery.yml
   git commit -m "Add new artwork to gallery"
   git push origin main
   ```

**YAML 注意点:**
- インデント: 半角スペース2個（タブ禁止）
- 引用符: ダブルクォーテーション `"` で統一
- 相対パス: 先頭に `/` を付ける
- カテゴリ複数設定の場合は配列で追加

---

### 🖼️ Diary一覧のサムネイル表示

Diary一覧ページ（`diary.md`）では、各日記エントリーにサムネイル画像を表示できます。

#### サムネイル表示の仕組み

**方法1: サムネイルクラスで指定（推奨）**

1. **`_data/gallery.yml` に `thumbnail_class` を追加**
   ```yaml
   - title: "サムネイル画像"
     cloudinary_id: "thumbnail_abc123.png"
     thumbnail_class: "diary-thumb"  # ← カスタムクラス
     article_url: "/diary/2025-06-06/"
     # ギャラリーに表示しない場合は categories を省略可能
   ```

2. **Diary記事のフロントマターで指定**
   ```yaml
   ---
   layout: post
   title: "記事タイトル"
   date: 2025-06-06
   thumbnail_class: "diary-thumb"  # ← 使用するクラスを指定
   ---
   ```

3. **マッチング**: 記事の `thumbnail_class` と一致する画像をサムネイルとして使用

**方法2: デフォルトのサムネイル（フォールバック）**

1. **`_data/gallery.yml` に `thumbnail: true` を追加**
   ```yaml
   - title: "作品タイトル"
     date: 2025-06-06
     cloudinary_id: "artwork_abc123.png"
     categories: ["イラスト"]
     article_url: "/diary/2025-06-06/"
     thumbnail: true  # ← デフォルトサムネイル
   ```

2. **マッチング**: `thumbnail_class` が指定されていない場合、`thumbnail: true` の画像を使用

**画像がない場合のフォールバック**
- 該当する画像がない場合は `/favicon/icon.jpg` をプレースホルダーとして表示

#### ツールで簡単設定

**diary-card-generator.html** を使用すると、GUIでサムネイル対応フラグを設定できます：

1. `tools/diary-card-generator.html` をブラウザで開く
2. カード情報を入力
3. 「サムネイル対象 (diary一覧で表示)」にチェック
4. 生成された YAML をコピーして `_data/gallery.yml` に追加

#### 重要なポイント

- **優先順位**: `thumbnail_class` 指定 > `thumbnail: true` > プレースホルダー
- **記事URLの一致**: `gallery.yml` の `article_url` と Diary 記事の URL が一致する必要があります
- **柔軟な使い分け**: 
  - ギャラリー表示用の画像とサムネイル用の画像を分けられる
  - サムネイル専用画像（ギャラリーに表示しない）も設定可能
  - 複数の記事で同じサムネイルクラスを使い回せる
- **Cloudinary URL**: `_plugins/cloudinary.rb` カスタムフィルタが自動でURLを生成します

---

### 📖 メイキング記事を作成

ファイル名: `_diary/YYYY-MM-DD-[作品名]-making.md`（例: `2025-06-06-five-apples-making.md`）

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

---

## 🖼️ Cloudinary 画像運用ガイド

- **設定**: `_config.yml` に `cloudinary_cloud_name` と `cloudinary_url` を定義済み
- **参照方法**: `{{ site.cloudinary_url }}` を使用
- **アップロード先**: `riddle-records/jpg/...` または `riddle-records/png/...`
- **記事用**: `{{ site.cloudinary_url }}/w_800,q_auto,f_auto/v1/<cloudinary_id>.jpg`（幅800px）
- **サムネイル**: `{{ site.cloudinary_url }}/w_400,h_400,c_fill,q_auto,f_auto/v1/<cloudinary_id>.jpg`（正方形）

**トラブル時:**
- 画像が表示されない → `cloudinary_id` が正しいか / 拡張子の確認
- 404が出る → `relative_url` または Cloudinary の絶対URL に統一
- iframe警告 → `allow="fullscreen"` で統一（Spotify の警告は仕様）

---

## 🔄 GitHub Actions による自動デプロイ

このサイトは `.github/workflows/jekyll.yml` によって自動デプロイされます。

### デプロイの流れ

1. `main` ブランチに `git push`
2. GitHub Actions が自動的に起動
3. Jekyll ビルドを実行
4. GitHub Pages にデプロイ

### デプロイ状況の確認

リポジトリの **Actions** タブでビルド状況を確認できます。

---

## 🛠️ 開発ツール

### 画像圧縮ツール

[tools/image-compressor.html](tools/image-compressor.html) - ブラウザ内で画像を圧縮

**特徴:**
- 📦 完全オフライン処理（ImageMagick WASM 使用）
- 🎯 対応形式: JPEG, PNG, GIF, BMP, TIFF
- ⚡ バッチ処理（最大3並行）
- 🎨 詳細設定: 品質調整、プログレッシブJPEG、メタデータ削除

**推奨設定:**
- **Web用画像**: JPEG品質75-85、プログレッシブ有効
- **イラスト・透過PNG**: PNG品質85、色数制限なし
- **写真アーカイブ**: JPEG品質90-95

### Cloudinary URL変換ツール

[tools/cloudinary-url-converter.html](tools/cloudinary-url-converter.html) - Cloudinary URL から Public ID を抽出

### Diary Card Generator

[tools/diary-card-generator.html](tools/diary-card-generator.html) - DiaryカードHTMLと gallery.yml 用YAMLを生成

---

## 📸 Diary 画像表示機能

Diary投稿内の画像はカード形式で統一表示されます。

### 画像の配置方法

#### 単独画像

```html
<div class="diary-card-grid">
  <div class="diary-card">
    <a href="{{ site.cloudinary_url }}/w_1920,q_auto,f_auto/v1/cloudinary_id.jpg" 
       data-lightbox="diary" data-title="画像説明">
      <img src="{{ site.cloudinary_url }}/w_300,h_300,c_fill,q_auto,f_auto/v1/cloudinary_id.jpg" 
           alt="画像説明">
    </a>
    <div class="diary-card-info">
      <h4>画像タイトル</h4>
    </div>
  </div>
</div>
```

#### 複数画像グリッド

```html
<div class="diary-card-grid">
  <div class="diary-card"><!-- カード1 --></div>
  <div class="diary-card"><!-- カード2 --></div>
  <div class="diary-card"><!-- カード3 --></div>
</div>
```

### 主要なパラメータ

| パラメータ | 説明 |
|-----------|------|
| `w_300,h_300,c_fill` | サムネイル: 300×300px（正方形） |
| `w_1920,q_auto,f_auto` | フル解像度: 1920px幅（Lightbox用） |
| `data-lightbox="diary"` | Lightboxグループ化 |
| `data-title` | Lightboxでの画像説明 |

### ギャラリーで見るボタンの制御

#### ボタンを非表示にする

Front Matterに追加：

```yaml
hide_gallery_buttons: true
```

#### 特定の画像だけボタンを非表示

要素に `no-gallery-button` クラスを追加：

```html
<img class="no-gallery-button" src="..." alt="...">
<div class="diary-card no-gallery-button">...</div>
<div class="making-comparison-grid no-gallery-button">...</div>
```

---

## 🔗 Gallery & Diary 連携（詳細）

### Gallery データ設定（`_data/gallery.yml`）

```yaml
- title: "作品タイトル"
  date: 2025-06-06
  cloudinary_id: "your_image_id.png"
  description: "作品の説明"
  categories:
    - "3DCG"
  article_url: "/diary/2025-06-06/"
  making_article_url: "/diary/2025-06-06/five-apples-making/"
```

### 記事の FrontMatter（`_diary/*.md`）

```yaml
---
layout: post
title: "5月の報告書"
date: 2025-06-06

featured_related:
  - "five_apples_spot_angle2_xmytbf.png"  # 作品1
  - "mt.fuji_b82xur.jpg"                   # 作品2
---
```

**ポイント:**
- `featured_related` には gallery.yml の `cloudinary_id` を配列で指定
- コメント（`#`）で作品名を併記すると管理しやすい
- 指定しない場合は、同じ日付の作品のみが自動表示される

### 関連作品の自動表示

記事ページ末尾に以下が自動表示されます：

- **📌 おすすめ**: 手動で指定した関連作品（`featured_related`）
- **📅 関連作品**: 同じ日付の Gallery 作品
- **🎨 記事内の作品**: 記事内で使用された画像
- **📖 関連記事**: `tags` が一致する記事

---

## 🚧 今後の改善案

### 1. メイキング記事の permalink 自動化
`_config.yml` で自動生成パターンを設定予定

### 2. featured_related の空配列対応
Liquid テンプレートで条件分岐を追加予定

### 3. サイドバーへの関連作品表示
記事閲覧中に常に表示する機能を検討中

### 4. Gallery でのメイキング画像プレビュー
Gallery カードにメイキング画像を表示予定

### 5. CMS 統一管理
Contentful、Forestry など Headless CMS の導入検討中

### 6. タグ・技法による関連作品検索
同じ技法・テーマの作品をクロスリンク表示予定

---
