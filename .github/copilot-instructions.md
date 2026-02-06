# Copilot Instructions for Riddle-Records

## Big picture
- Jekyll + Markdown ポートフォリオ。ページは Liquid で一覧生成し、Gallery と Journal が相互連携。
- 旧HTMLは legacy/ に退避（参考のみ、編集・デプロイ対象外）。

## 主要ディレクトリ
- _journal/ : 日記記事（Markdown + FrontMatter）。ファイル名は YYYY-MM-DD(.md) / YYYY-MM-DD-*-making.md。
- _songs/ : 音楽作品データ（Markdown）。
- _data/gallery.yml : 作品メタデータ（Gallery と Journal の連携元）。
- _layouts/ と _includes/ : Liquid テンプレート。
- assets/css/, assets/js/ : スタイルと機能。
- _plugins/cloudinary.rb : Cloudinary URL 生成のカスタムフィルタ。

## 連携ルール（重要）
- Gallery ↔ Journal の紐付けは _data/gallery.yml の `article_url` / `making_article_url`。
- Journal 側の関連作品は FrontMatter の `featured_related`（Cloudinary ID 指定）。
- サムネイルは `thumbnail_class` 優先、次に `thumbnail: true`。該当なしは /favicon/icon.jpg。
- YAMLは2スペース・ダブルクォート統一・パスは / から開始。

## Cloudinary 画像運用
- 参照は {{ site.cloudinary_url }}。記事用は w_800、サムネは w_400,h_400,c_fill が標準。
- ID には拡張子を含める（例: "xxx.png"）。

## 開発ワークフロー
- 依存インストール: bundle install
- ローカル起動: bundle exec jekyll serve
- デプロイ: main への push で GitHub Actions が自動実行（.github/workflows/jekyll.yml）。

## 参考例
- 連携・サムネ例: _data/gallery.yml
- FrontMatter 例: _journal/*.md
- MathJax 条件読み込み: _layouts/post.html（`use_math: true`）
- 便利ツール: tools/Journal-card-generator.html