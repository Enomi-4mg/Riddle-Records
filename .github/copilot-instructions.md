# Copilot Instructions for Riddle-Records

## 概要
- 本リポジトリは Jekyll + Markdown によるポートフォリオ・日記・作品ギャラリーサイトです。
- 静的サイト生成（Jekyll）を活用し、Liquid テンプレートで動的な一覧・連携を実現。
- 旧コンテンツ（legacy/）は参考用で、編集・デプロイ対象外。

## 主要構成
- `_journal/` : 日記記事（Markdown, FrontMatter 必須）
- `_songs/` : 音楽作品データ（Markdown）
- `_data/gallery.yml` : ギャラリー作品データ（YAML, Cloudinary連携）
- `_layouts/`, `_includes/` : Liquid テンプレート・再利用部品
- `assets/css/`, `assets/js/` : スタイル・JS機能
- `tools/` : 画像圧縮・Cloudinary URL変換・Journalカード生成などの補助ツール
- `_plugins/cloudinary.rb` : Cloudinary画像URL自動生成フィルタ

## 開発・運用フロー
- ローカル開発は `bundle exec jekyll serve` で起動
- 記事追加は `_journal/YYYY-MM-DD.md` を新規作成し、FrontMatter（`layout`, `title`, `date` など）を記述
- ギャラリー追加は Cloudinary へ画像アップ→`_data/gallery.yml` へエントリ追加
- サムネイル表示は `thumbnail_class` または `thumbnail: true` で制御
- 画像は Cloudinary URL（`{{ site.cloudinary_url }}`）で参照
- コミット後は GitHub Actions（`.github/workflows/jekyll.yml`）で自動デプロイ

## 重要なパターン・注意点
- YAMLはスペース2個インデント、ダブルクォート統一、パスは `/` で始める
- JournalとGalleryは `article_url` で連携、`featured_related` で関連作品を手動指定可能
- 画像がない場合は `/favicon/icon.jpg` をプレースホルダー表示
- legacy/配下は編集・デプロイ対象外
- Liquid テンプレートでループ・条件分岐・includeを多用
- サムネイル・関連作品は FrontMatterとgallery.ymlのマッチングで自動表示

## 参考ファイル
- `README.md` : 全体構成・運用手順・主要パターン
- `_data/gallery.yml` : ギャラリー連携・サムネイル制御例
- `_journal/*.md` : FrontMatter・関連作品指定例
- `tools/Journal-card-generator.html` : サムネイルYAML生成補助
- `_plugins/cloudinary.rb` : Cloudinary画像URL生成

## よく使うコマンド
- `bundle install` : 依存関係インストール
- `bundle exec jekyll serve` : ローカルサーバー起動
- `git add . && git commit -m "..." && git push` : 変更反映

## 独自ルール・慣習
- Markdown・YAML・Liquidの混在構成
- 画像はCloudinary管理、URLは自動生成
- サムネイル・関連作品はFrontMatterとgallery.ymlのマッチング
- 旧HTMLはlegacy/に保存、参考のみ

---

この内容で不明点・追加したいルールがあればご指摘ください。