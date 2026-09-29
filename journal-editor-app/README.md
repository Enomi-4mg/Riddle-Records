# Riddle Records Content Editor

Riddle Records の Markdown content を作成・編集するための専用Webアプリです。Vite + React + TypeScript で、ポートフォリオ本体の Astro レイアウトから独立して動きます。

Journal / Songs / Gallery / Projects の Markdown content をまとめて管理する Content Editor です。

- `journal`: `src/content/journal/*.md` を読み書き
- `songs`: `src/content/songs/*.md` を読み書き
- `gallery`: `src/content/gallery/*.md` を読み書き
- `projects`: `src/content/projects/*.md` を読み書き

Gallery の公開ページは `src/utils/gallery.ts` 経由で content collection を参照します。Projects の公開ページは `src/utils/projects.ts` 経由で content collection を参照します。`src/data/gallery.ts` と `src/data/projects.ts` は空配列の legacy source で、新規追加・編集対象ではありません。移行計画と役割分担は `../docs/content-editor-migration.md` を参照してください。

## 起動方法

```sh
cd journal-editor-app
npm install
npm run dev
```

Vite dev server は `5174` を使います。

Astro本体側の旧Editor `src/pages/tools/journal-editor.astro` は、現在は移行案内ページです。旧URL `/tools/journal-editor/` はブックマークや Information ページからの互換用に残し、実際の content 編集はこの `journal-editor-app/` で行います。

## 基本運用

### ローカルCMSモード

dev server 上では、Editor から `src/content/<kind>/*.md` を開いて編集できます。`Journal` / `Songs` / `Gallery` / `Projects` の変更はまずブラウザ内に保留され、「記事をデプロイ」でローカルの `.md` ファイルへ反映します。

ローカルでの反映はVite dev server APIを使います。本番CMSでは同じ操作がGitHubへのコミットとGitHub Pagesの起動になります。

API は kind ごとに固定された `src/content/<kind>/` 配下のサブディレクトリなし `.md` ファイルだけを対象にします。絶対パス、path traversal、`.md` 以外の拡張子、対象ディレクトリ外への書き込みは拒否します。

ローカルAPIとCloudflare Worker APIは同じ契約を使います。`revision` はローカルではmtime由来の文字列、WorkerではGitHub blob SHAです。

共通 API：

- `GET /api/content-list?kind=journal`
- `GET /api/content-item?kind=journal&path=2026-04-01.md`
- `POST /api/content-item`
- `DELETE /api/content-item`
- `POST /api/site-deploy`（CMSからサイト公開を起動）
- `GET /api/site-deploy?deploymentId=...`（公開状況を確認）

保存リクエストは `{ kind, path, markdown, expectedRevision?, force? }`、削除リクエストは `{ kind, path, expectedRevision, force? }` をJSONで送ります。既存ファイルが読み込み後に更新されていた場合は `409 Conflict` になり、現在の内容を再読み込みするか明示的に強制保存します。削除にも同じ競合検査を適用します。

## Cloudflare Workerへのデプロイ

本番Editorは `https://cms.4mg.dev/` でReact SPAと `/api/*` を同じWorkerから配信します。`workers.dev` とpreview URLは無効で、custom domain以外からWorkerへ到達させない設定です。

### 1. GitHub token

GitHubでFine-grained personal access tokenを作成します。

- Repository access: `Enomi-4mg/Riddle-Records` のみ
- Repository permission: Contents `Read and write`
- それ以外の権限は追加しない

トークンはリポジトリやGitHub Actionsへ保存せず、Worker Secretとして登録します。

```sh
cd journal-editor-app
npx wrangler secret put GITHUB_TOKEN
```

通常設定は `wrangler.jsonc` の `GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_BRANCH` にあり、保存先は `main` 固定です。

### 2. GitHub Actions secrets

Repository settingsのActions secretsへ次を登録します。

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`: 対象アカウントのWorkers Scripts編集に必要な最小権限を持つトークン

`main` の `journal-editor-app/**` またはデプロイworkflowが変わると、テスト、roundtrip検証、buildの成功後にWorkerをデプロイします。初回はActionsを手動実行することもできます。

### 3. Custom DomainとAccess

初回デプロイ後、Cloudflare Zero TrustでSelf-hosted applicationを作成します。

- Application domain: `cms.4mg.dev`
- Path: `*`
- Policy action: Allow
- Include rule: 管理者本人のメールアドレス1件

Access applicationはEditorだけでなく `/api/*` を含むhostname全体へ適用します。許可メールはCloudflare側だけに設定し、リポジトリには記録しません。Access未認証と認証済みの両方で、画面とAPIが同じ保護範囲にあることを確認してください。

### 4. 手動確認・デプロイ

```sh
cd journal-editor-app
npm ci
npm run check:worker
npm test
npm run build
npm run deploy
```

CMSの編集・公開切替・削除・メディア情報変更は、そのブラウザのlocalStorageに保留されます。別端末には同期されず、ブラウザデータを消すと失われます。CMS全体の「記事をデプロイ」を押すと、保留した各ファイルをGitHub `main`へ1ファイル1commitで反映し、最後にGitHub Pages workflowを手動起動します。GitHub側で競合があれば反映を止めます。途中で失敗した場合は、未完了の操作を保持して再試行できます。

ローカルCMSでは同じボタンで保留内容をローカルファイルに書き込みます。GitHub Pagesは起動しません。CMSアプリ自身は`main`へのコード変更時に従来どおり自動デプロイされます。

### 削除操作の注意

Editor の削除操作は dev server 上の実ファイルを削除します。削除前には確認UIで `kind`、`path`、`title` を確認してください。API 側では kind ごとに保存先ディレクトリを固定し、絶対パス、`..`、サブディレクトリ、`.md` 以外のファイル名を拒否します。

デプロイ前の変更はlocalStorageに保存します。デプロイ後の正本はMarkdownファイルです。ブラウザを閉じても未反映の変更を再表示し、デプロイが成功した後に保留データを消します。

### 新規記事作成

1. DraftList で `新規作成` を押します。
2. Editor 画面で `title` と本文 Markdown を書きます。
3. 説明・タグ・画像などの表示内容は記事キャンバスで、日付・種別・slugなどの管理情報は`記事設定`で入力します。
4. `チェック` で公開前チェックを確認します。
5. ブラウザに保留した変更を「記事をデプロイ」で反映します。公開状態の切替だけではサイトは更新されません。

### 画像カード / Gallery支援

Editor 画面の `画像カード` から、旧Astro版Editorにあった画像カード生成系の補助機能を使えます。

- `journal-card-grid` と `making-comparison-grid` のHTML生成
- `data-lightbox` / `data-title` 付きの既存記事互換HTML出力
- 生成HTMLのコピー、本文textareaのカーソル位置への挿入
- 本文内の `.journal-card` / `.comparison-item` 抽出
- 生成または抽出した Cloudinary ID の `featured_related` 追加
- Gallery登録用Markdown/frontmatterコード生成
- `thumbnail` / `og_image` / legacy `image` / カード画像の実URLプレビュー

Cloudinary ID候補は `src/data/galleryIds.ts` に分離しています。本文内カードの置換編集、カード作成状態の永続化はまだ未実装です。ローカルCMSモードでは Gallery タブから `src/content/gallery/*.md` を開いて保存できます。

Gallery Markdown の標準frontmatterは `image` / `tags` 優先です。`cloudinary_id` / `categories` は旧データ互換として読み取り可能ですが、新規作成では使わない方針です。`detail: true` の item だけ `/gallery/[slug]/` が生成され、`draft: true` は production build から除外されます。`thumbnail: true` は Journal 一覧などのサムネイル照合候補に含める意味です。

### 単体Markdown import

`Markdown import` から `.md` ファイルを選ぶと、Markdownエディタとして読み込みます。ファイル名が `.md` の場合は保存先候補として使い、それ以外はfrontmatterから推奨ファイル名を生成します。

### 編集時刻の扱い

Editor内部では、時刻を以下の意味で分けています。

- `createdAt`: Editor上でMarkdownを開いた時刻
- `updatedAt`: Editor上で最後に更新された時刻
- `importedAt`: 既存Markdownを読み込んだ時刻
- `editedAt`: ユーザーが記事内容を最後に編集した時刻

既存Journal記事を開いただけでは `editedAt` は付きません。本文やfrontmatter、画像カード挿入、`featured_related` 追加など、ユーザーが内容を変更したときだけ `editedAt` を更新します。

## Riddle Records本体への反映

1. dev server 上では `Markdown保存` で `src/content/<kind>/` に直接保存します。
2. build/公開環境では Editor の `.md` でMarkdownを書き出し、推奨ファイル名に従って `src/content/<kind>/` に配置します。
3. Riddle Records 本体のルートで build を確認します。

```sh
cd ..
npm run build
```

既存記事を置き換える場合は、同名ファイルを差し替えてからbuildしてください。

## URL の規則

- `permalink` があれば override として優先
- `journal`: `/journal/YYYY-MM-DD/`
- `making` + `slug`: `/journal/YYYY/MM/DD/slug/`
- `making` slugなし: `/journal/YYYY-MM-DD/`
- `report`: `/journal/YYYY-MM/`

## 往復変換の検証

既存 `src/content/*/*.md` を import → export 相当で検証します。

```sh
npm run test:roundtrip
```

全 content kind をまとめて確認する場合:

```sh
npm run test:content
```

個別確認:

```sh
npm run test:roundtrip:journal
npm run test:roundtrip:songs
npm run test:roundtrip:gallery
npm run test:roundtrip:projects
```

export後Markdownを実ファイルとして確認したい場合:

```sh
npm run test:roundtrip:write
```

出力先は `journal-editor-app/roundtrip-exported/` です。このディレクトリは検証用です。

### 許容差分

往復変換では以下の差分を許容しています。

- BOM除去
- frontmatterの順序やquoteの正規化
- 配列のinline表記への正規化
- 空配列 field の省略
- `type: "journal"` の追加

本文Markdown、本文HTML、画像カードHTMLが変わる差分は要確認です。

### Markdown 読み込みパーサーの制約

frontmatter import はフルYAML parserではなく、行ベースの簡易parserです。通常の `key: value`、inline array、単純なblock arrayを想定しています。

以下のような複雑なYAMLは非推奨または未保証です。

- block scalar
- nested object
- 複雑なquoteやescape
- quoted comma を含む inline array

既存 content は `npm run test:content` で import/export 相当の検証をしています。複雑なfrontmatterを追加した場合は、roundtrip結果と実buildの両方を確認してください。

## `type: "journal"` の出力方針

既存記事の多くは `type` を省略しており、Astro content schema 側では `journal` がdefaultです。そのため roundtrip差分を最小化するなら、`type === "journal"` のときはfrontmatter出力を省略する案があります。

一方で、このエディタは新規記事作成時に `journal / making / report` の種類を明示して扱う設計です。運用上は出力Markdownにも type を明示した方が、後から見たときに記事種別が分かりやすくなります。

現時点では **明示性を優先して `type: "journal"` を出力する方針** にしています。roundtrip検証では許容差分として扱います。
