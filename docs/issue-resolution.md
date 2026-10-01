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
