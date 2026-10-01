# Issue 対応記録

## 対応順序

1. #6: 現行 CMS の保存・API・デプロイテストを確認する。
2. #9: Journal / Works / Project の表示切替とソート操作を整理する。
3. #10: Visual / Music 共通の Gallery 鑑賞ビューと作品指定 URL を用意する。
4. #11: About を固定プロフィールとして CMS 管理し、Featured Works を Gallery に接続する。

## #6: 現行 CMS テスト

既存コミット `5bde29a`、`737967a`、`83507db` で対応済み。2026-10-01 に再検証した。

- 4種類の roundtrip は `roundtrip-cms.mjs` から現行 parser / serializer を呼び、本文・値のあるメタデータ・繰り返し保存の同一性を assert する。
- metadata-only save、HTML → Markdown、実際のタグ入力を直接検証する。
- 本番 batch client、revision 書き戻し、commit SHA、公開条件、media 同梱、content / media conflict、対象別 force を検証する。
- Worker の commit containment と Worker / Vite の batch / media API を検証する。
- filesystem test は一時ディレクトリを使用し、旧 Draft テストは legacy スイートへ分離している。
- `npm test`、`npm --prefix journal-editor-app run check:worker`、`npm --prefix journal-editor-app run test:coverage` が成功した。

coverage は現行経路のみを対象とし、行 90.20%、分岐 78.39%、関数 87.84%。この数値は追加実装前の確認結果。

## #9: 一覧表示

Journal はリスト、Works / Project はグリッドを初期表示にする。保存された表示設定がある場合はユーザーの選択を優先し、無効な設定や storage が使えない環境ではページの初期値へ戻る。切替はラベル付きの丸い SVG アイコンに統一した。日付順は「新しい順 ↓ / 古い順 ↑」に揃え、Works ではタグを左、表示操作を右に配置した。既存タグの複数選択・OR絞り込みは維持する。

`list-ui-tests.mjs` が初期値・保存設定・storage 例外・日付順・タグとの併用を検証する。

## #10: Gallery 鑑賞ビュー

Gallery は Visual / Music の単一作品ビュー。Visual は contain 表示、Music は YouTube のプライバシー強化プレイヤーを使用し、自動再生しない。左の作品メニューで All / Visual / Music を切替え、右の情報パネルから説明・タグ・クレジット・既存詳細記事を開く。左右キー、前後ボタン、水平スワイプで移動し、Esc でパネルを閉じる。端では前後ボタンを無効にする。YouTube 内の操作はプレイヤーが受け取り、作品移動は周囲のスワイプ領域や前後ボタンを使う。

作品 URL は `/gallery/?work=gallery%3Acry`、`/gallery/?work=songs%3A2026-09-29-summer-song` のように collection と slug を組み合わせる。`filter=visual` / `filter=music` を指定できる。不存在の指定は該当種別の先頭へ戻り、指定作品とフィルターが矛盾する場合は All で指定作品を開く。旧画像IDの hash も読み取る。

`/disco/` は `/gallery/?filter=music` へ移動する。`/disco/[slug]/` と `/gallery/[slug]/` の詳細記事は維持し、Works の一覧・タグ・ソート・表示切替も維持する。
