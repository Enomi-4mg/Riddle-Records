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