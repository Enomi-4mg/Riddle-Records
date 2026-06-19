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

## Journal Editor での記事作成手順

Journal 記事は、独立アプリ `journal-editor-app/` の Journal Editor でMarkdownを生成してから `src/content/journal/` に追加します。

旧Astro版Editor `src/pages/tools/journal-editor.astro` は、現在は移行案内ページです。旧URL `/tools/journal-editor/` はブックマークや Information ページからの互換用に残していますが、記事作成の本命Editorは `journal-editor-app/` です。画像カード生成やGallery登録用コード生成も新Editorへ移植済みです。

### 1. エディタを開く

新Editorを起動します。

```bash
cd journal-editor-app
npm install
npm run dev
```

Vite dev server のURLをブラウザで開きます。旧URLは移行案内ページです。

```text
http://localhost:5174/
```

公開サイト上では `Information` ページの「Journal Editor（移行案内）」から、移行先と起動方法を確認できます。

### 2. 記事設定を入力する

新Editorでは、`src/content/config.ts` のJournal schemaに合わせて以下の項目を生成します。

- `title`: 記事タイトル
- `date`: 記事日付
- `og_description`: 一覧・OGP用の短い説明
- `image`: OGP画像。Cloudinary IDまたはURLを指定
- `permalink`: 公開URL。通常記事は `/journal/YYYY-MM-DD/`、制作メモは `/journal/YYYY/MM/DD/slug/` が基本
- `featured_related`: 関連作品のCloudinary ID
- `use_math`: 数式を使う記事で有効化
- `tags`: 関連記事判定に使うタグ
- `thumbnail_class`: 一覧サムネイルを明示したい場合のみ指定

入力内容はブラウザの `localStorage` に自動保存されます。複数下書き管理、既存Journal記事の一括import、Markdown import、backup / restore に対応しています。

テンプレートは次の3種類です。

- `通常Journal`: 日記・活動報告向け
- `制作メモ`: 作品制作記事向け。slug付きのpermalinkを生成します
- `月次報告`: 月次・近況報告向け

### 3. 画像カードを挿入する

Cloudinary画像を記事本文に入れる場合は「画像カード」を使います。

1. `Cloudinary ID` に `example_abcd12.jpg` のようなIDを入力します。
2. `キャプション` と `見出し` を入力します。
3. `本文に画像カードを挿入` を押します。
4. 一覧や関連記事のおすすめにも出したい場合は `featured_relatedに追加` を押します。

出力される画像カードは現在のAstroサイトに合わせたHTMLです。Jekyll時代の `{{ site.cloudinary_url }}` は使いません。

### 4. Markdownを保存する

生成結果を確認して、どちらかの方法でMarkdownを取得します。

- `Markdownをコピー`: 内容をクリップボードにコピーします。
- `Markdownをダウンロード`: ファイル名つきで `.md` を保存します。

保存先は `src/content/journal/` です。例:

```text
src/content/journal/2026-04-30.md
src/content/journal/2026-04-30-dunes-making.md
```

### 5. 表示確認する

記事ファイルを追加したら、ローカルで以下を確認します。

```bash
npm run build
```

確認ポイント:

- `/journal/` の一覧に記事が表示される
- 記事詳細ページが開ける
- OGP画像やサムネイルが意図したものになっている
- 画像カードのLightboxが動作する
- `featured_related` や `tags` による関連コンテンツが表示される

### 6. Gallery と連携する場合

作品をGalleryにも載せる場合は、記事作成後に `src/data/gallery.ts` へ作品データを追加します。

```ts
{
  title: "作品タイトル",
  date: "2026-04-30",
  cloudinary_id: "example_abcd12.jpg",
  description: "作品説明",
  categories: ["イラスト"],
  article_url: "/journal/2026-04-30/",
  thumbnail: true
}
```

制作記事へのリンクがある場合は `making_article_url` も追加します。

## デプロイ

GitHub Pages への反映は `.github/workflows/astro-pages.yml` で行います。
