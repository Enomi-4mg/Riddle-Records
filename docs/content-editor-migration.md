# Content Editor 移行計画

## 目的

`journal-editor-app/` を Journal 専用エディタから、次のコンテンツを扱う Content Editor へ拡張します。

- `journal`
- `songs`
- `gallery`
- `projects`

エディタは YAML frontmatter を含む Markdown ファイルを読み書きします。
`src/data/gallery.ts` や `src/data/projects.ts` などの TypeScript 配列は書き込み先にしません。

## 現在の保存先

- `journal`：`src/content/journal/*.md`
- `songs`：`src/content/songs/*.md`
- `gallery`：`src/content/gallery/*.md`
- `projects`：`src/content/projects/*.md`

`src/data/gallery.ts` は旧形式との互換性を保つために残していますが、`galleryItems` は現在空です。
公開 Gallery ページは `src/utils/gallery.ts` を介して、正規化された `GalleryItemView` を参照します。

`src/data/projects.ts` も互換性のために残していますが、`projects` は現在空です。
公開 Project ページは `src/utils/projects.ts` を介して、正規化された `ProjectItemView` を参照します。

新しい Gallery と Project のコンテンツは、それぞれ `src/content/gallery/*.md` と `src/content/projects/*.md` に追加します。
旧 TypeScript 配列は移行時の安全策であり、将来の削除対象です。

## コミットの分割案

移行内容を確認しやすくするため、変更を次の単位に分けます。

1. Gallery 個別ページとカードのリンク処理
2. Content Editor の基盤と共通 API
3. Songs の編集機能と往復変換テスト
4. Gallery と Projects のコレクションスキーマおよび移行文書
5. 削除確認やパーサーテストなどの安全対策

## 移行後の保存先

- `journal`：`src/content/journal/*.md` を継続
- `songs`：`src/content/songs/*.md` を継続
- `gallery`：`src/content/gallery/*.md` へ移行済み
- `projects`：`src/content/projects/*.md` へ移行

`gallery` と `projects` の Astro コレクションスキーマは `src/content/config.ts` にあります。
Gallery と Projects は現在、コンテンツコレクションを正本としています。

## エディタ API

エディタはローカル開発環境で次の共通 API を使います。

- `GET /api/content-list?kind=journal`
- `GET /api/content-item?kind=journal&path=YYYY-MM-DD.md`
- `POST /api/content-item`

同じ API を `songs`、`gallery`、`projects` にも使います。
各コンテンツ種別は固定のディレクトリに対応します。
API は絶対パス、`..`、サブディレクトリ、`.md` 以外のファイル名を拒否します。

## 移行手順

1. Gallery：`src/data/gallery.ts` を空のまま固定し、作品を `src/content/gallery/*.md` で管理する。
2. Gallery：`/works/`、`/gallery/`、`/gallery/[slug]/`、関連サムネイルを `src/utils/gallery.ts` 経由で処理する。
3. Projects：移行した項目を `src/content/projects/*.md` で管理する。
4. Projects：公開ページを `src/utils/projects.ts` 経由で処理する。
5. Projects：一時的な互換処理が必要な場合を除き、`src/data/projects.ts` を空のまま保つ。

## 公開ページへの影響

- `/works/`：Gallery コレクションと楽曲一覧を統合して表示する。
- `/gallery/`：`src/utils/gallery.ts` 経由で `getCollection("gallery")` を使い、`detail: true` がない項目では Lightbox の動作を保つ。
- `/gallery/[slug]/`：`detail: true` の Gallery 項目だけ個別ページを生成する。
- `/project/`：`src/utils/projects.ts` 経由で `getCollection("projects")` を使い、カード項目を保つ。
- `/project/[slug]/`：Project の frontmatter と Markdown 本文を `ProjectItemView` によって表示する。

## エディタの対象範囲

実装済みの範囲は次のとおりです。

- コンテンツ種別の共通切り替え
- ローカル開発用の共通 Markdown 読み書き API
- 既存 Journal 編集機能の維持
- `src/content/songs/*.md` にある Songs の編集
- Gallery スキーマと Markdown への移行
- `src/utils/gallery.ts` の `GalleryItemView` を使う Gallery ページ
- slug の重複、必須画像、frontmatter の必須 `slug` を調べる Gallery 検証
- 本番ビルドからの Gallery 下書き（`draft: true`）の除外
- Projects スキーマと Markdown への移行
- `src/utils/projects.ts` の `ProjectItemView` を使う Project ページ
- 本番ビルドからの Project 下書き（`draft: true`）の除外

保留している範囲は次のとおりです。

- エディタから TypeScript 配列への書き込み
- コレクション移行が安定した後の、空の互換配列の削除

## スキーマと検証の分担

- `src/content/config.ts`：Astro のコンテンツコレクションスキーマ。コンテンツ同期時とビルド時に、コレクションの構造エラーを検出する。
- `src/utils/gallery.ts`：Gallery の表示用正規化、旧形式の代替処理、本番環境での下書き除外、必須 slug、画像、slug 重複のビルド時検証を行う。
- `src/utils/projects.ts`：Project の表示用正規化、旧形式の代替処理、本番環境での下書き除外、slug の欠落と重複のビルド時検証を行う。
- `journal-editor-app/src/types/content.ts`：各コンテンツ種別のエディタ用 UI スキーマと入力補助。入力項目と必須項目のチェックに使うが、公開サイトのスキーマではない。
- `journal-editor-app/src/lib/yamlFrontmatter.ts`：エディタの読み込み、書き出し、往復変換テストで使う Markdown frontmatter パーサー兼ライター。

## 作業ツリーとコミット分割の注意

可能であれば、変更を次の単位に分けます。

1. Gallery ページとコレクション移行
2. Projects のコレクション移行
3. Content Editor の基盤と UI 文言
4. 往復変換と YAML のテスト
5. 文書更新
6. Journal の frontmatter 正規化。特に `src/content/journal/2026-01-17.md` は別コミットにする。

## Gallery frontmatter の標準

Gallery の Markdown は `src/content/gallery/*.md` に置きます。

標準項目は次のとおりです。

- `title`
- `slug`
- `date`（`YYYY-MM-DD` 形式）
- `description`
- `image`
- `thumbnail`
- `thumbnail_alt`
- `detail`
- `tags`
- `article_url`
- `making_article_url`
- `draft`

新しい Markdown では `image` と `tags` を使います。
`cloudinary_id` と `categories` は、ヘルパー内で旧形式の代替項目として扱います。
`thumbnail: true` は Journal のサムネイル照合候補に含める指定であり、`thumbnail: false` は除外する指定です。
`detail: true` の項目だけが `/gallery/[slug]/` を生成します。

## Project frontmatter の標準

Project の Markdown は `src/content/projects/*.md` に置きます。

標準項目は次のとおりです。

- `title`
- `slug`
- `date`（`YYYY-MM-DD` 形式）
- `description`
- `hero`
- `status`（`active`、`paused`、`archived`、`completed` のいずれか）
- `tags`
- `links`（`label` と `url` を持つオブジェクトの一覧）
- `features`
- `draft`

Markdown 本文には、プロジェクトの詳しい説明を保存します。
`heroImage`、`externalUrl`、`sourceUrl` は `src/utils/projects.ts` で旧形式の代替項目として扱いますが、新しい Markdown では `hero` と `links` を使います。
