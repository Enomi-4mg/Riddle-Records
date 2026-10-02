# Issue 対応記録

## 今回の対応（2026-10-02、#17〜#29）

調査時のopen Issueは全22件（#6、#9〜#29）。
既存対応の9件を再検証し、新たな13件を以下の順に実装した。
Issue本文とコメントを確認し、#17〜#29に追加コメントはなかった。

1. #28・#29：公開対象commitとCIの起動条件を先に固定する。
2. #17・#18・#19：公開サイトのナビゲーション・可視性・文字表現を整える。
3. #20・#21：Project情報と作品サムネイルを整える。
4. #22・#23：CMSの自動保存モデル、削除確認、保留変更管理を揃える。
5. #24・#25・#26：モバイル操作、説明文、画面移動を整える。
6. #27：整えたサイトの見た目をプレビューに利用し、未使用画面を整理する。

| Issue | 実装・判断 | 主な検証 | Commit |
| --- | --- | --- | --- |
| [#28](https://github.com/Enomi-4mg/Riddle-Records/issues/28) | content / mediaのみのpushはPagesを起動せず、CMS dispatchにSHAを渡す。checkout・更新日時・状態追跡を指定SHAに揃える | mainが先へ進んだ場合の旧SHA指定、SHA不一致409、workflowのcheckout契約 | `e23aa8c` |
| [#29](https://github.com/Enomi-4mg/Riddle-Records/issues/29) | Worker deployをruntime依存に絞り、content / mediaの検査をdeployしないCIへ分離。未使用の静的Journal importを削除 | dataのみ・code混在・runtime依存のtrigger判定。#27で追加したCSS・Header・faviconも明示 | `8062324` |
| [#17](https://github.com/Enomi-4mg/Riddle-Records/issues/17) | mobileは768px以下、desktopは769px以上。button・ARIA・inert・独立overlay・Escape・focus復帰を実装 | DOM操作、実ブラウザ767 / 768 / 769px、開閉・Escape・focus復帰 | `d3f8f39` |
| [#18](https://github.com/Enomi-4mg/Riddle-Records/issues/18) | 本文を常時可視にし、curtainを廃止。Observerは移動演出のみ、reduced-motionで無効 | Observerなし・motion抑制・CSS初期可視性 | `442d8a7` |
| [#19](https://github.com/Enomi-4mg/Riddle-Records/issues/19) | 本文・リンク・背景の色トークンを分離。リンク下線、Kiwi Maru 400 / 500、歌詞の書体、shadow・旧配色を整理 | 使用文字色の4.5:1以上の計算、サイトbuild、実表示 | `9812952` |
| [#20](https://github.com/Enomi-4mg/Riddle-Records/issues/20) | 共通statusラベルを日本語にし、タグ・状態を分離。空のfeatures / tags / linksを省略 | 生成ページの日本語状態・空見出し省略・既存features保持 | `4d5e13d` |
| [#21](https://github.com/Enomi-4mg/Riddle-Records/issues/21) | Works・Featured Works・内部カードを16:9のmqdefaultに変更。Galleryの動画表示を維持 | About・Gallery・embedテスト、site build | `d78c449` |
| [#22](https://github.com/Enomi-4mg/Riddle-Records/issues/22) | 自動ブラウザ保存を明示し、「入力を確認」「公開に設定」「保留変更をサイトに反映」に操作を揃える | 入力直後のpending、保存・公開状態、About fixtureを実データから隔離 | `2868d5f` |
| [#23](https://github.com/Enomi-4mg/Riddle-Records/issues/23) | 削除対象を確認し、保留一覧で保存・削除・mediaを個別取消。反映前に全件を確認し、内容変更なら再確認 | Appの削除取消・保存取消、applied / deployment中の拒否、公開確認 | `0627bf0` |
| [#24](https://github.com/Enomi-4mg/Riddle-Records/issues/24) | stickyバーを戻る・状態・サイト反映に絞る。二次操作を本文側へ、Journal初期設定を専用画面へ移す | 実ブラウザ320 / 375pxで高さ60px。縦scrollbarのある320pxも横幅超過なし | `e4d4627`・`3e53e66` |
| [#25](https://github.com/Enomi-4mg/Riddle-Records/issues/25) | 共通summaryでdescriptionを優先、空ならOG説明。入力欄の役割を明示し、既存OGを移行しない | OG-onlyの一覧・検索、frontmatter roundtrip、site / CMS build | `169efcc` |
| [#26](https://github.com/Enomi-4mg/Riddle-Records/issues/26) | 共通navigationで画面先頭・一覧位置・履歴位置を復元。文書取得待ちにも対応 | Appの履歴・Media / About移動、新規作成、実ブラウザ一覧下部→記事先頭→元の一覧位置 | `65320f8` |
| [#27](https://github.com/Enomi-4mg/Riddle-Records/issues/27) | 未使用6画面を削除し、現行ContentDocumentのSitePreviewDialogへ統合。サイトCSS・書体・幅・embedを隔離iframeで表示 | 4種類の描画、内部カード・動画、通常幅 / 375px、dialog開閉・focus、旧画面import不在 | `0e870ca` |

プレビューはスクリプト実行を許可しない。
動画の再生、Xの動的表示、数式・コードの装飾、Lightbox・メニューなどの動作は公開後に確認する仕様で、画面と[UXユースケース](content-editor-ux-use-cases.md)に明記した。

### 最終検証

- `npm test`：route 3件、現行CMS 159件、legacy 16件がすべて成功。
- Journal 14 / Songs 5 / Gallery 10 / Projects 3ファイルの現行CMS roundtripが成功。
- Astro 35ページとCMSのproduction build、旧ページの参照168件の検査が成功。
- `npm --prefix journal-editor-app run check:worker`が成功。
- `npm --prefix journal-editor-app run test:coverage`：現行経路125テスト、行94.65%、分岐86.88%、関数90.80%。旧Draft経路は含めない。
- 実ブラウザで767 / 768 / 769pxのナビ境界、Escapeとfocus復帰、CMSの320 / 375px表示、一覧位置復元、プレビューのKiwi Maru・本文幅1000px・375px切替・編集復帰を確認。
- 最後のCSS修正後にCMS production buildを再確認。320pxでは利用可能幅305px・content幅305px、375pxでは360px・360pxで横幅超過なし。

各変更はstaged diffを確認して意味単位でcommitした。
実装・検証はローカルで完了し、push・本番公開・GitHub Issueのclose / コメント投稿は未実施。
リモートIssueはopenのままで、実際のActions起動回数・本番公開結果はpush後の運用確認対象となる。
既存の未追跡`.claude/`は変更・commit対象に含めていない。

## 前回までの対応順序（#6・#9〜#16）

1. #6: 現行 CMS の保存・API・デプロイテストを確認する。
2. #9: Journal / Works / Project の表示切替とソート操作を整理する。
3. #10: Visual / Music 共通の Gallery 鑑賞ビューと作品指定 URL を用意する。
4. #11: About を固定プロフィールとして CMS 管理し、Featured Works を Gallery に接続する。
5. #12: CMSの画面・フィルターをURLで復元できるようにする。
6. #13: 共通PopoverとBlock操作を整え、後続の状態詳細でも再利用する。
7. #14: デプロイ追跡のライフサイクルと復帰を安定させる。
8. #15: 安定した追跡基盤の上でstatus / noticeとAppの責務を分離する。
9. #16: 保存・公開処理を利用し、公開日と作成日時を分離する。

前回の調査対象は9件（#6、#9〜#16）。本文とコメントを確認した。#6〜#11の4件は既存ローカル実装の再検証を先に行い、#12〜#16の5件を依存関係の順に実装した。GitHub上のIssueはpush前のためopenのまま。

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

## #6〜#11の既存対応時の検証（2026-10-02）

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

## #16: 公開日と作成日時の分離

新規下書きの`date`は未設定とし、初回公開時にAsia/Tokyoの当日を設定する。設定画面の手入力日は優先する。`createdAt`は作成時刻のまま保持し、公開後の編集・再デプロイ・非公開後の再公開でも公開日を自動更新しない。既存公開コンテンツの日付も維持する。作成・更新時刻、公開済みフラグ、日付の入力元、初回公開時刻を`_cms`に永続化し、reload後にも判断できる。

日付未定のJournal / Songsは日付非依存の`content-UUID.md`で下書き保存できる。初回公開後も既存ファイルのpath / revisionを維持する。下書きをGitHubへ保存する前に公開した場合は、従来どおり公開日のファイル名になる。Journalのpermalinkと内部カードは公開日、Songs詳細は実ファイル名を使う。renameを伴わず既存の競合検出を維持する。サイトschemaは下書きに限定した仮日付を使い、公開コンテンツの空日付は拒否する。

`publication-tests.mjs`は4種別のD1作成→D2公開→D3編集／再公開、手入力、旧ブラウザ下書き、既存公開記事、未知の管理情報、UTC/JSTの境界、ファイル名とURL、実際のAstro schemaとAppの下書き保存→公開→reload→日付変更を検証する。

日付未定の下書きは開発プレビューからも除外する。schemaの仮日付が一覧に表示されたり、複数のJournal下書きが同じURLを生成したりすることを防ぐ。共通の`hasVisiblePublicationDate`を各collectionの表示経路へ適用し、複数下書きと既存の日付付き下書き・公開記事の混在、実際のWorks catalog、Journal URLの非衝突を検証した。

## #6・#9〜#16の対応時の検証（2026-10-02）

| Issue | ローカルでの対応 | 主な検証 |
| --- | --- | --- |
| [#6](https://github.com/Enomi-4mg/Riddle-Records/issues/6) | 既存対応を確認 | 現行CMS、API / Worker、4種類のroundtrip、現行経路coverage |
| [#9](https://github.com/Enomi-4mg/Riddle-Records/issues/9) | 既存対応を確認 | 表示初期値・永続設定・日付順・タグ併用、Works / Journal / Projectのブラウザ表示 |
| [#10](https://github.com/Enomi-4mg/Riddle-Records/issues/10) | 既存対応を確認 | 作品指定URL・フィルター・前後移動・Escape・旧Disco転送、375px表示 |
| [#11](https://github.com/Enomi-4mg/Riddle-Records/issues/11) | 既存対応を確認 | Aboutの編集・保存・reload・参照制約、固定画面とサイト表示 |
| [#12](https://github.com/Enomi-4mg/Riddle-Records/issues/12) | 実装済み | Appの編集→一覧復帰、reload、browser履歴、不正パラメーター |
| [#13](https://github.com/Enomi-4mg/Riddle-Records/issues/13) | 実装済み | viewport配置、Escape・外側click・focus復帰、Block drag/dropと上下移動 |
| [#14](https://github.com/Enomi-4mg/Riddle-Records/issues/14) | 実装済み | reload復帰、成功・失敗、revision更新、通信失敗・timeout・再確認、複数タブ |
| [#15](https://github.com/Enomi-4mg/Riddle-Records/issues/15) | 実装済み | 状態優先順位、通知分離、競合再読込、readonly、古い応答、状態詳細の375px表示 |
| [#16](https://github.com/Enomi-4mg/Riddle-Records/issues/16) | 実装済み | D1/D2/D3、手入力・既存日付、JST境界、永続履歴、URL / file整合、日付未定draft |

- `npm test`: route 3件、現行CMS 146件、legacy 16件が全て成功。
- Journal 14 / Songs 5 / Gallery 10 / Projects 3ファイルの現行CMS roundtripが成功。
- AstroとCMSのproduction build、旧ページのローカル参照168件の検査が成功。
- `npm --prefix journal-editor-app run check:worker` が成功。
- 現行経路coverage（116テスト）: 行94.49%、分岐86.93%、関数90.88%。legacy Draft経路は含めない。
- 実ブラウザで `/`、`/works/`、`/journal/`、`/project/`、`/gallery/`、`/disco/`、`/about/`とCMSを確認。GalleryのMusic指定・情報パネル・次作品、Disco転送、CMSフィルターのreload復元・公開日設定を確認した。375px幅のCMS共通メニューは左右・上下ともviewport内に収まる。

今回作成した実装コミット（実行順）:

1. `97b9746` Preserve CMS navigation and list filters in the URL
2. `a49485a` Unify CMS popovers and improve block movement feedback
3. `7ffccf0` Resume CMS deployment tracking across reloads and tab changes
4. `557b450` Separate CMS status, transient notices and state ownership
5. `371d62a` Assign and preserve publication dates independently of draft creation
6. `1d3bfbe` Exclude undated drafts from site previews and date-based routes

実装・検証はローカルコミットまで完了。リポジトリの指示に従いpush・本番公開はしていない。GitHub Issueのclose / コメント投稿もしていない。既存の未追跡`.claude/`は変更・commit対象に含めていない。
