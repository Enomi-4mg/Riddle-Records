# Riddle Journal Editor

Riddle Records の Journal 記事を作成・編集するための専用Webアプリです。Vite + React + TypeScript で、ポートフォリオ本体の Astro レイアウトから独立して動きます。

## 起動方法

```sh
cd journal-editor-app
npm install
npm run dev
```

Vite dev server は `5174` を使います。

Astro本体側の旧Editor `src/pages/tools/journal-editor.astro` は、現在は移行案内ページです。旧URL `/tools/journal-editor/` はブックマークや Information ページからの互換用に残し、実際の記事作成・画像カード生成・Galleryコード生成はこの `journal-editor-app/` で行います。

## 基本運用

### 新規記事作成

1. DraftList で `新規作成` を押します。
2. Editor 画面で `title` と本文 Markdown を書きます。
3. `記事設定` から date / type / slug / description / tags / media fields を設定します。
4. `チェック` で公開前チェックを確認します。
5. `出力` からコピー、または `.md` ボタンでMarkdownを書き出します。

### 画像カード / Gallery支援

Editor 画面の `画像カード` から、旧Astro版Editorにあった画像カード生成系の補助機能を使えます。

- `journal-card-grid` と `making-comparison-grid` のHTML生成
- `data-lightbox` / `data-title` 付きの既存記事互換HTML出力
- 生成HTMLのコピー、本文textareaのカーソル位置への挿入
- 本文内の `.journal-card` / `.comparison-item` 抽出
- 生成または抽出した Cloudinary ID の `featured_related` 追加
- Gallery登録用TypeScript風コード生成
- `thumbnail` / `og_image` / legacy `image` / カード画像の実URLプレビュー

Cloudinary ID候補は `src/data/galleryIds.ts` に分離しています。Galleryデータへ直接書き込む機能、本文内カードの置換編集、カード作成状態の永続化はまだ未実装です。

### 既存記事一括インポート

`既存記事を一括インポート` は、親リポジトリの `src/content/journal/*.md` を raw import し、localStorage の draft として保存します。

- 既存IDがある記事はデフォルトでスキップします。
- `再インポートして上書き` は同じIDのdraftを上書きします。
- imported draft のIDは元ファイル名由来です。例: `imported:2026-01-30-dunes-making.md`
- source情報として `source: "imported"`、`sourcePath`、`sourceFileName` を保存します。

### 単体Markdown import

`Markdown import` から `.md` ファイルを選ぶと、新しいdraftとして読み込みます。

- 既存draftは上書きしません。
- source は `uploaded` になります。

### 全下書きバックアップ / 復元

`全下書きバックアップ` は localStorage 内の全draftをJSONとして書き出します。

```json
{
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "exportedAt": "2026-06-19T00:00:00.000Z",
  "draftCount": 1,
  "draftIndex": ["draft-id"],
  "drafts": []
}
```

`JSON復元` では復元モードを入力します。

- `skip`: 同じIDがあるdraftはスキップします。
- `overwrite`: 同じIDがあるdraftを上書きします。
- `duplicate`: 同じIDがあるdraftを別IDで複製追加します。

`imported:xxx` と `imported:xxx.md` は旧ID/新IDの同一記事候補として扱い、noticeに警告件数を表示します。

### 下書き時刻の扱い

draft metadata では、時刻を以下の意味で分けています。

- `createdAt`: draft が作られた時刻
- `updatedAt`: localStorage 上で最後に保存・更新された時刻
- `importedAt`: 既存記事として import / 再 import された時刻
- `editedAt`: ユーザーが記事内容を最後に編集した時刻

既存Journal記事を import しただけでは `editedAt` は付きません。本文やfrontmatter、画像カード挿入、`featured_related` 追加など、ユーザーが内容を変更したときだけ `editedAt` を更新します。再インポートして上書きした場合は既存ファイルの状態へ戻すため、`editedAt` は消えます。

## Riddle Records本体への反映

1. Editor の `.md` でMarkdownを書き出します。
2. 推奨ファイル名に従って、本体側の `src/content/journal/` に配置します。
3. Riddle Records 本体のルートで build を確認します。

```sh
cd ..
npm run build
```

既存記事を置き換える場合は、同名ファイルを差し替えてからbuildしてください。

## URL rules

- `permalink` があれば override として優先
- `journal`: `/journal/YYYY-MM-DD/`
- `making` + `slug`: `/journal/YYYY/MM/DD/slug/`
- `making` slugなし: `/journal/YYYY-MM-DD/`
- `report`: `/journal/YYYY-MM/`

## Roundtrip検証

既存 `src/content/journal/*.md` を import → export 相当で検証します。

```sh
npm run test:roundtrip
```

export後Markdownを実ファイルとして確認したい場合:

```sh
npm run test:roundtrip:write
```

出力先は `journal-editor-app/roundtrip-exported/` です。このディレクトリは検証用です。

### 許容差分

Roundtripでは以下の差分を許容しています。

- BOM除去
- frontmatterの順序やquoteの正規化
- 配列のinline表記への正規化
- 空配列 field の省略
- `type: "journal"` の追加

本文Markdown、本文HTML、画像カードHTMLが変わる差分は要確認です。

### Markdown import parser の制約

frontmatter import はフルYAML parserではなく、行ベースの簡易parserです。通常の `key: value`、inline array、単純なblock arrayを想定しています。

以下のような複雑なYAMLは非推奨または未保証です。

- block scalar
- nested object
- 複雑なquoteやescape
- quoted comma を含む inline array

既存Journal記事は `npm run test:roundtrip` で import/export 相当の検証をしています。複雑なfrontmatterを追加した場合は、roundtrip結果と実buildの両方を確認してください。

## `type: "journal"` の出力方針

既存記事の多くは `type` を省略しており、Astro content schema 側では `journal` がdefaultです。そのため roundtrip差分を最小化するなら、`type === "journal"` のときはfrontmatter出力を省略する案があります。

一方で、このエディタは新規記事作成時に `journal / making / report` の種類を明示して扱う設計です。運用上は出力Markdownにも type を明示した方が、後から見たときに記事種別が分かりやすくなります。

現時点では **明示性を優先して `type: "journal"` を出力する方針** にしています。roundtrip検証では許容差分として扱います。
