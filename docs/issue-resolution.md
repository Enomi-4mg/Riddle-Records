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

不正なエンコードの旧hashでも先頭作品へ戻る。`/disco/` の転送スクリプトはAstroの画面遷移後も再実行する。

## #11: About の CMS 管理

保存先は `src/content/about/profile.md` の単一Markdown / frontmatter。既存ContentDocumentの配置先にsingletonを追加し、共通Contents APIとpending batchを使う。CMSには専用About画面を設け、記事一覧・新規作成・削除から分離した。サイトは型付きAstro collectionから読み込む。従来のプロフィールをデータへ移し、本文の複数行、空の任意項目、未知のメタデータも保存時に保持する。

Featured Worksの初期値は空配列。自動取得を廃止し、「紹介する作品は準備中です。」を表示する。選択は公開Visual / Musicの混在・手動順序に対応し、共通作品IDでGalleryへ直接つなぐ。URL、月日、画像参照、重複、不存在・非公開参照を検査する。参照された作品の削除や非公開化もAPIが拒否し、About側の参照削除を同一batchに含める場合は許可する。空文字タグは除き、全配列の順序は保持する。

既存のGitHub revision競合検出とデプロイ処理を再利用する。実ファイルを書かないDOMテストでAppの編集→ブラウザ再起動→保存→デプロイ→再読込を検証し、APIは一時ディレクトリ／GitHub mockで検証する。ローカル確認で既存の未追跡 `vite.config.js` が古い設定を読み込む問題を見つけ、ViteコマンドにTS設定ファイルを明示した。

## 最終検証（2026-10-02）

- `npm test`: route 3件、現行CMS 117件、legacy 16件が成功。Journal 14 / Songs 5 / Gallery 10 / Projects 3ファイルのroundtripが成功。
- サイトとCMSのproduction buildが成功。旧ページのローカル参照168件も解決する。
- `npm --prefix journal-editor-app run check:worker` が成功。
- 現行経路のcoverage: 行92.56%、分岐85.71%、関数88.65%。
- 実ブラウザで一覧、Gallery、About、CMSのAbout編集画面、旧Discography URLの転送を確認した。

変更はローカルコミットまで。push・本番公開・GitHub Issueのcloseは未実施。

## #12: 一覧・画面の URL 状態

種別 `kind`、公開状態 `publication`、検索語 `q` は URL を正本とし、一覧のローカル state を廃止した。画面と選択文書も `screen` / `document` に保持する。編集・メディアへの移動後も条件を維持し、reload と browser back / forward で復元する。未定義のパラメーターは安全な初期値に戻す。検索の入力中は履歴を置換し、フィルター選択と画面移動は履歴を追加する。配信先のルートを変えない query URL を使用する。

`navigation-tests.mjs` で実際の App の画面移動、履歴、再マウントによる復元を検証。CMS build が成功。

## #13: 共通メニューとブロック操作

`FloatingPanel` と `useDismissable` を新規作成、Block操作、スラッシュメニューで共用。triggerでtoggle、Escapeで閉じてfocusを戻し、外側pointerdownで閉じる。URL貼り付け選択も同じdismiss処理を利用する。固定座標のportalで表示し、viewport端で上下を切替え、scroll / resizeで配置を再計算する。長いメニューは内部scrollで全項目を操作できる。

Block追加・移動をSVGアイコンにし、toolbarをBlock先頭に揃える。既存drag/dropは移動先のラインを表示し、カスタムdrag中はProseMirrorの通常dropとの二重処理を避ける。操作メニューの上下移動はkeyboardからも利用できる。通常のテキストdropは従来どおり。

`interaction-tests.mjs` でviewport配置、内部／外側click、Escapeとfocus、実際のBlock drag/drop・上下移動を検証。既存embed操作とCMS buildも成功。

## #14: デプロイ追跡の復帰

GitHub反映とdeployment pollingを分離し、`useDeployment` / `deploymentTracking.ts` が明示的なidle、syncing、waiting、paused、success、failedを管理する。保存されたdeploymentを起動時に再確認し、focus / visibility復帰時と手動再確認でも追跡を再開する。最大40回のpolling後や通信失敗ではIDを保持したままpausedとし、再確認を提供する。unmount時はHTTPと待機を中断し、遅い応答が新しい追跡状態を上書きしない。

成功時は保留queueを解消し、contentとmediaのrevisionを再取得する。現在の文書も取得したrevisionへ同期する。失敗時はdeploymentだけを外し、GitHub反映済みの変更とrevisionを保持して再編集／再試行できる。完了結果を永続化し、reload後も失敗を表示する。別タブのqueue更新時も同期する。既存の対象別競合処理を維持。

`deployment-tests.mjs` でpolling上限・再開・中断、実際のAppのreload→成功とrevision取得、通信失敗→手動／focus再確認、失敗→reload→再編集を検証。既存About保存／競合テストとCMS buildも成功。

## #15: 保存状態・通知・責務の整理

通常のpillは短い継続状態だけを表示し、共通`StatusControl`の詳細パネルからGitHub反映、公開状況、更新日時、ファイル、revision、Workflowリンク、エラー詳細、再試行／再確認を開く。公開設定は別のラベルで表示する。保存などの一時通知は`useNotice` / `Notice`へ移し、5秒（エラーは10秒）または閉じる操作で消える。通知が消えても保存／競合状態は変わらない。

Appのserver stateは`useContentDocuments`、`useMediaRegistry`、`usePendingQueue`、`useDeployment`へ分離。文書取得は古い応答を無視し、通信失敗時に既存文書を消さない。UI stateはURL navigation、編集中文書、設定dialogに分け、競合の解消は`useConflict`、タブ所有権は`useTabLock`で管理する。競合パネルと保留一覧を編集画面と一覧で共用。保留変更は開閉できるsummaryに収納する。

非所有タブ／デプロイ中は編集欄と公開操作を無効化する。focus、disabled、選択状態を共通CSSで確認し、Block移動ラインにも既存mintトークンを使用する。

`status-tests.mjs` で主要状態の優先順位、一時通知と未反映状態の分離、実際の競合→再読込、readonlyエディタ、古い応答・通信失敗、通知期限を検証。既存navigation / About / deploymentテストとCMS buildも成功。
