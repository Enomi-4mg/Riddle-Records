# Riddle Records

4mg のポートフォリオサイトです。
Astro で構築し、活動記録、楽曲、イラスト、サイト情報を掲載しています。

- Journal：活動記録と報告
- Music：オリジナル楽曲と公開作品
- Gallery：イラストと作品
- About、Info、Tech：プロフィールとサイト情報

## ローカルでの起動

```bash
npm install
npm run dev -- --host 0.0.0.0
```

ビルドを確認するには、次のコマンドを実行します。

```bash
npm run build
```

## ディレクトリ構成

```text
src/
  components/
  content/
    journal/
    songs/
    gallery/
    projects/
  data/
  layouts/
  pages/
assets/
favicon/
legacy/
tools/
```

## コンテンツの保存先

- Journal 記事：`src/content/journal/`
- 楽曲：`src/content/songs/`
- Gallery 作品：`src/content/gallery/*.md`
- Project：`src/content/projects/*.md`

`src/data/gallery.ts` と `src/data/projects.ts` は旧形式との互換性を保つために残していますが、現在は空です。
新しいコンテンツは Markdown ファイルとして追加します。
Jekyll 時代のファイルは移行後に削除済みです。

## Works と Gallery

`/works/` は全作品の一覧です。
`src/content/gallery/*.md` の Gallery 作品と `src/content/songs/` の楽曲を、共通の Works カードで表示します。

`/gallery/` は美術作品に絞ったアーカイブです。
`detail: true` の Gallery 項目には `/gallery/[slug]/` の個別ページを生成し、それ以外の項目は従来どおり Lightbox で表示します。

Gallery の標準 frontmatter は次のとおりです。

- `slug`：個別ページの URL に使う文字列
- `detail`：`true` の場合に個別ページを生成
- `title`：作品タイトル
- `date`：`YYYY-MM-DD` 形式の制作日
- `image`：Cloudinary の公開 ID または画像 URL
- `description`：カード、メタ情報、導入文に使う短い説明
- `tags`：一覧と個別ページに表示するタグ
- `article_url`：関連する Journal 記事
- `making_article_url`：関連する制作記事
- `thumbnail`：Journal のサムネイル照合候補に含めるか
- `draft`：`true` の場合に本番ビルドから除外

Markdown 本文は個別ページの本文になります。
`cloudinary_id` と `categories` は旧形式との互換性のために読み込めますが、新しいファイルでは `image` と `tags` を使います。

```md
---
title: 作品タイトル
slug: work-title
date: 2026-04-30
description: 作品の短い説明
image: example_abcd12.jpg
thumbnail: true
thumbnail_alt: 作品タイトル
detail: true
tags:
  - イラスト
article_url: /journal/2026-04-30/
making_article_url: /journal/2026/04/30/work-making/
draft: false
---

Gallery の個別ページに表示する本文です。
```

## Project

Project ページの正本は `src/content/projects/*.md` です。
標準 frontmatter は次のとおりです。

- `title`：プロジェクト名
- `slug`：`/project/[slug]/` に使う文字列
- `date`：`YYYY-MM-DD` 形式の日付
- `description`：カード、メタ情報、導入文に使う短い説明
- `hero`：メイン画像の URL。空の場合はタイトルを表示
- `status`：`active`、`paused`、`archived`、`completed` のいずれか
- `tags`：カードと個別ページに表示するタグ
- `links`：`label` と `url` を持つ外部リンク
- `features`：個別ページに表示する機能一覧
- `draft`：`true` の場合に本番ビルドから除外

Markdown 本文は個別ページの説明になります。

## Content Editor

Journal、Songs、Gallery、Projects の Markdown は、`journal-editor-app/` にある Riddle Records Content Editor で作成、編集できます。
旧 Astro 版エディタの URL `/tools/journal-editor/` は、ブックマークとの互換性を保つ移行案内ページです。

```bash
cd journal-editor-app
npm install
npm run dev
```

起動後に `http://localhost:5174/` を開きます。
開発サーバーでは `src/content/<kind>/*.md` を直接読み書きできます。
ビルド後の公開環境ではローカルファイルへ書き込めないため、出力欄からコピーするか `.md` ファイルをダウンロードします。

エディタの入力項目は `journal-editor-app/src/types/content.ts`、Astro のコレクションスキーマは `src/content/config.ts` で管理します。
frontmatter の詳しい仕様と運用方法は [Content Editor の README](journal-editor-app/README.md) を参照してください。

保存後はルートディレクトリでビルドし、一覧、個別ページ、画像、Lightbox、関連コンテンツを確認します。

```bash
npm run build
```

## デプロイ

GitHub Pages へのデプロイは `.github/workflows/astro-pages.yml` で行います。

このリポジトリでは Cloudflare Pages を使いません。
Cloudflare Pages のプロジェクトがリポジトリに接続されたままの場合は、ビルドを無視するコマンドに次を設定します。

```bash
./scripts/skip-cloudflare-pages.sh
```

このコマンドが終了コード `0` を返すと、Cloudflare はビルドを省略します。
GitHub Pages のデプロイには影響しません。
