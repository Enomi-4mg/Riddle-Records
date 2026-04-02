# Riddle Records

**4mg** のポートフォリオサイト。Astro で構築された、日記・音楽作品・イラスト・情報をまとめたサイトです。

- Journal: 活動日記・報告書
- Music: オリジナル楽曲と公開作品
- Gallery: イラスト・作品ギャラリー
- About / Info / Tech: プロフィールとサイト情報

## ローカル起動

```bash
npm install
npm run dev -- --host 0.0.0.0
```

ビルド確認:

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
  data/
  layouts/
  pages/
assets/
favicon/
legacy/
tools/
```

## コンテンツの置き場所

- Journal 記事は `src/content/journal/` に置きます。
- songs 記事は `src/content/songs/` に置きます。
- Gallery の作品データは `src/data/gallery.ts` で管理します。
- Jekyll 時代のファイルは移行後に削除済みです。

## デプロイ

GitHub Pages への反映は `.github/workflows/astro-pages.yml` で行います。
