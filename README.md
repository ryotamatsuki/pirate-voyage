# 黒潮の航海 — The Wandering Sea

海を眺める自由航海版と、交易で船を育てるゲーム版を、同じリポジトリで公開しています。

各版のHTML・CSS・JavaScriptを、それぞれ独立したHTML一ファイルに収めています。外部ライブラリ、外部画像、インストール、ビルドは不要です。

## プレイする

- [自由航海版 — GitHub Pages](https://ryotamatsuki.github.io/pirate-voyage/)
- [ゲーム版 — 交易と観測の試作 v0.1.3](https://ryotamatsuki.github.io/pirate-voyage/adventure/)
- [自由航海版 — ChatGPT Sites](https://pirate-voyage.budoto.chatgpt.site/)
- ローカル：遊びたい版の `index.html` をダウンロードし、WebGLに対応したブラウザで開いてください。オフラインでも動きます。

## ゲーム版：黒潮の航海 失われた潮路

小船「凪灯号」で灯待ち港と松帆港を往復する試作です。最初は100G、食料30、船倉20から始まります。

初めての航海では、航海士セナが目的と操作を一つずつ案内します。次の操作を金色の枠と矢印で示し、説明中は航海と食料消費を止めます。案内の途中でも閉じて自由に遊べます。進み具合は保存され、再読込み後も続けられます。

画面の「遊び方」か右上の「？」で、交易、補給、修理、操船、入港、改造、保存、JSON、救助を読み返せます。以前のセーブでも船と資金を保ったまま案内を始められます。

1. 市場で木材を仕入れる。最初の配送も引き受けられます。
2. 出港画面で食料と行き先を確認し、自動航海で松帆港へ向かう。
3. 港の沖で「入港する」を押し、木材を売る。配送の報酬は40Gです。
4. 補給し、120Gで補強沿岸船へ改造する。船倉と食料上限が広がります。

在庫に応じて価格が動き、表示した合計額で決済します。食料と船体HP、救助による復帰、1・2・4倍速、航海日誌、ブラウザ内保存、JSONの書き出し・読み込みが使えます。港とメニュー、背景のタブでは航海時間が止まります。ゲーム版の `R` は、費用を確認した上で救助を要請する操作です。

航海で海図が開き、海鳥の集まる浮標を見つけられます。セナの案内で、港へ直行・浮標に接近・目印を残す、を選びます。選択中は時間と食料消費を止め、寄り道と帰港の予備を表示します。「海図・発見」と日誌から選び直し、元の航路にも戻れます。

浮標へ接近すると、潮と銘板を観測できます。「航海帳・保存」に分かったこと・未確認・次の行動を記録し、松帆港の「海図係」で報告すると受理状況と航路登録の準備を確認できます。観測で資金や積荷は増えません。「北の灯」は現在訪問できない手掛かりです。

次は航路登録と帰路の移動短縮を追加します。この試作を確認してから、五港、予報と十遭遇、第一章の順に広げます。船員・海賊行為・勢力争いはさらに後の工程です。完成版の仕様と現在の実装範囲は、[開発タスクと進捗](docs/development-status.md)で区別しています。

保存先はブラウザと公開先ごとに異なります。移動する場合は日誌からJSONを書き出してください。二港試作の世界データは `two-ports-1` です。v0.1.0〜2の記録を保って読み込み、視認・接近・目印と開いた海図、観測・報告を保存します。旧記録は未観測から始め、接近済みでも勝手に観測・受理済みにしません。将来版への移行は今後実装し、互換性のない保存は上書きせず拒否します。

## 自由航海版の主な機能

- 波と風による船の揺れ、帆の動き、航跡
- 島を避ける自動航海と手動操舵
- 海図からの目的地指定
- 帆の開き具合、天候、朝・昼・夕・夜の切り替え
- 追従・周回・甲板カメラ
- 波と風の音、一時停止、スマートフォン用の操作

実際の船舶運航を再現する専門シミュレーターではなく、風・帆・波の影響を体験するための簡易モデルです。

## 自由航海版の操作

| 操作 | 動作 |
| --- | --- |
| ドラッグ／スワイプ | カメラの視点を変更 |
| スクロール／ピンチ | カメラの距離を変更 |
| ← →／A D | 左右に操舵し、手動航海へ切り替え |
| ↑ ↓／W S | 帆を開く／畳む |
| 海図をクリック／タップ | 自動航海の目的地を指定 |
| P | 一時停止／再開 |
| H | 操作画面を非表示／表示 |
| R | 航海位置をリセット |

音は右上のスピーカーボタンでオンにできます。

## GitHub Pagesの公開設定

このリポジトリの **Settings → Pages** で、以下を設定します。

- Source：**Deploy from a branch**
- Branch：**main**
- Folder：**/ (root)**

保存すると、直下の `index.html` が自由航海版、`adventure/index.html` がゲーム版として同時に配信されます。以後は `main` の更新が公開版に反映されます。既存のChatGPT Sites版は自由航海のままです。

## ファイル

- `index.html`：従来の自由航海版（内容を保持）
- `adventure/index.html`：交易ゲーム版（HTML／CSS／JavaScript）
- `tests/adventure-core.test.cjs`：取引・航海・保存のゲーム処理テスト
- `tests/adventure-tutorial.test.cjs`：案内の進行、保存、旧セーブ互換性のテスト
- `tests/adventure-exploration.test.cjs`：発見、海図、寄り道、食料見積り、保存のテスト
- `tests/adventure-observation.test.cjs`：観測・報告、重複防止、旧版移行、保存条件のテスト
- `tests/adventure-browser.cjs`：実画面の操作・保存・旧記録・縦横配置のブラウザ検証
- `.github/workflows/adventure-checks.yml`：処理とブラウザの継続検証、画面・結果の保存
- `tests/responsive-review.html`：幅を変えて航海中の画面と操作を確認する開発用ページ
- `docs/tutorial-guide.md`：初回ガイドの動作と確認条件
- `docs/development-status.md`：タスク、実装済み範囲、検証結果
- `docs/voyage-prototype-plan.md`：一航海の試作と、第一章までの開発工程
- `docs/voyage-prototype-playtest.md`：初見の三問と受入項目の記録ひな形
- `docs/development-log.md`：判断、変更理由、確認結果の記録
- `docs/exploration-research_2026-09-30.md`：八作品の比較と採用する設計
- `docs/asset-register.md`：素材の出所と制作記録
- `.nojekyll`：GitHub Pagesで静的ファイルをそのまま配信するための設定
- `README.md`：作品概要・操作方法・公開手順

## ゲーム拡張の企画書

探索・交易・船の成長を中心とするゲーム拡張の企画と仕様です。独自の物語、船員と勢力、権利確認の方針、段階的な実装手順をまとめています。

- [企画書兼仕様書 Markdown版](docs/pirate-voyage_game-spec_v1.md)
- [企画書兼仕様書 Word版](docs/pirate-voyage_game-spec_v1.docx)

仕様書は版1.2です。M0〜M3と初回ガイドは完了済みです。一航海の試作を優先する開発順を採用し、内容と確認基準をGitHubに記録しました。

- [次の開発工程と受入項目](docs/voyage-prototype-plan.md)
- [観測と報告の検証記録](docs/verification/m4a2.md)
- [開発Issue](https://github.com/ryotamatsuki/pirate-voyage/issues)
- [初見の試遊記録のひな形](docs/voyage-prototype-playtest.md)
- [判断と変更の開発ログ](docs/development-log.md)
- [八作品の調査提案書](docs/exploration-research_2026-09-30.md)

## 開発時の検証

Node.js 18以上で、追加パッケージなしに実行できます。

```sh
node --test tests/*.test.cjs
```

画面は [開発用の確認ページ](https://ryotamatsuki.github.io/pirate-voyage/tests/responsive-review.html) でPC幅、縦・小型・横画面を切り替えて確認できます。iframe内のゲームは同じ公開版で、幅変更だけでは再読込みしません。実機のタッチ入力・Safari・性能測定とは区別します。

ブラウザ検証はGitHub Actionsの **Adventure checks** で実行します。配布するHTMLをChromiumで開き、初回ガイド、発見・寄り道・観測、航海帳、港への報告、帰港、売買、補強、保存・JSON、旧記録の移行を確認します。PCとタッチ操作を模した六つの画面サイズ、回転、画面の重なりを検証し、スクリーンショットと結果JSONを14日間保存します。実機Safariと性能測定は後続の確認です。

手元で画面検証を行う場合だけ、開発用にPlaywrightを追加します。ゲームの起動には不要です。

```sh
npm install --no-save --package-lock=false playwright@1.51.1
npx playwright install chromium
node tests/adventure-browser.cjs
```

ゲーム処理は `adventure/index.html` の `adventure-core`、画面と保存は `adventure-ui`、WebGL描画は `adventure-renderer` の各scriptに分けています。テストは配布するHTMLから処理を読み込むため、別の実装との食い違いを防げます。ゲーム版の修正は `adventure/` で行い、直下の自由航海版を変更しません。


