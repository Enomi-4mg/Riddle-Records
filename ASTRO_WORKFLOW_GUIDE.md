# Astro 移行 作業手順書

作成日: 2026-04-02
対象ブランチ: `feat/astro-minimal-template`

この手順書は、Jekyll から Astro へ段階移行するための、実際の作業順序と確認ポイントをまとめたものです。

## 1. 現在の状態

- Astro の最小ひな型は作成済みです。
- 共通レイアウトは `src/layouts/BaseLayout.astro` を中心に構成しています。
- ローカル起動用タスクは `.vscode/tasks.json` に追加済みです。
- GitHub Pages 用の Astro ワークフローは `.github/workflows/astro-pages.yml` です。

## 2. 開発開始前の確認

1. ブランチが `feat/astro-minimal-template` であることを確認します。
2. Node.js と npm が使えることを確認します。
3. 必要なら `npm install` を実行して依存関係を揃えます。

## 3. ローカル起動手順

### VS Code から起動する場合

1. コマンドパレットからタスク `astro dev` を実行します。
2. ブラウザで `http://localhost:4321/Riddle-Records` を開きます。
3. 画面に `Riddle Records (Astro Prototype)` が表示されれば起動成功です。

### ターミナルから起動する場合

```bash
npm run dev -- --host 0.0.0.0
```

Windows 環境では PowerShell の実行ポリシーに引っかかる場合があるため、VS Code タスク側では `npm.cmd` を使っています。

## 4. 変更作業の流れ

1. まず共通レイアウトを `src/layouts/` に追加します。
2. `src/components/` に Header と Footer を分けます。
3. 各ページは `src/pages/` へ追加し、`BaseLayout` で包みます。
4. 既存 Jekyll 由来の設定を `astro.config.mjs` と `package.json` に寄せます。
5. 変更後は必ずビルドして崩れを確認します。

## 5. 検証手順

### ローカル確認

1. `npm run dev -- --host 0.0.0.0` で起動します。
2. トップページにアクセスします。
3. ヘッダー、フッター、ベースレイアウトが崩れていないかを見ます。

### ビルド確認

```bash
npm run build
```

ビルドが成功し、`dist/` が生成されれば最低限の静的出力は通っています。

## 6. GitHub Pages への反映

1. 変更を `feat/astro-minimal-template` にまとめます。
2. `main` へ統合した後、`.github/workflows/astro-pages.yml` が動作します。
3. GitHub Pages の公開先は `https://enomi-4mg.github.io/Riddle-Records` を前提にしています。

## 7. ここまでの実装で使う主なファイル

- [astro.config.mjs](astro.config.mjs)
- [package.json](package.json)
- [.vscode/tasks.json](.vscode/tasks.json)
- [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro)
- [src/components/Header.astro](src/components/Header.astro)
- [src/components/Footer.astro](src/components/Footer.astro)
- [src/pages/index.astro](src/pages/index.astro)
- [.github/workflows/astro-pages.yml](.github/workflows/astro-pages.yml)

## 8. 次に行うべき作業

優先度順に進めるなら次の通りです。

1. `journal` を Astro Content Collections に移す。
2. `songs` を Astro Content Collections に移す。
3. `gallery.yml` を Astro 側の data として読み込めるようにする。
4. Journal の一覧ページと詳細ページを Astro で再実装する。
5. Gallery のソート・フィルタ・関連リンクを移植する。
6. Jekyll 用の workflow と不要な Ruby 依存を段階的に整理する。

## 9. 運用メモ

- 既存の Jekyll ファイルは移行完了まで残して問題ありません。
- Astro 側での実装が固まるまでは、URL と表示の一致を優先します。
- 大きな置換より、ページ単位での段階移行が安全です。