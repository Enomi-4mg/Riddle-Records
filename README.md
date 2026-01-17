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
├─ css/
│   └─ style.css                 ← メインスタイル
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
- **データ駆動**: `_data/gallery.yml` に `title/date/cloudinary_id/description/category` を追記すると [gallery.md](gallery.md) から自動表示可能。
- **暫定運用**: プロジェクトサイトの`baseurl`都合で、ローカル画像は `{{ '/path' | relative_url }}` を使うと404を回避できます。

トラブル時は以下を確認してください：
- 画像が表示されない → `cloudinary_id` が正しいか／拡張子の付与／フォルダ構成の一致
- 404が出る → ルート相対`/path`ではなく `relative_url` か Cloudinary の絶対URLに統一
- iframe警告 → `allowfullscreen`は削除し、`allow`に`fullscreen`を含めて一本化（SpotifyのEME警告は仕様）