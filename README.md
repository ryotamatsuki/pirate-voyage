# 黒潮の航海 — The Wandering Sea

3本マストの海賊船で広大な海と碧の群島を航海する、ブラウザ向け3Dシミュレーションです。

HTML・CSS・JavaScriptを `index.html` 1ファイルに収めています。外部ライブラリ、外部画像、インストール、ビルドは不要です。

## プレイする

- [ChatGPT Sites版](https://pirate-voyage.budoto.chatgpt.site/)
- GitHub Pagesの公開先：<https://ryotamatsuki.github.io/pirate-voyage/>（下記の公開設定後に利用できます）
- ローカル：`index.html` をダウンロードし、WebGLに対応したブラウザで開いてください。オフラインでも動きます。

## 主な機能

- 波と風による船の揺れ、帆の動き、航跡
- 島を避ける自動航海と手動操舵
- 海図からの目的地指定
- 帆の開き具合、天候、朝・昼・夕・夜の切り替え
- 追従・周回・甲板カメラ
- 波と風の音、一時停止、スマートフォン用の操作

実際の船舶運航を再現する専門シミュレーターではなく、風・帆・波の影響を体験するための簡易モデルです。

## 操作

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

保存すると、`index.html` がGitHub Pagesのトップページになります。以後は `main` の更新が公開版に反映されます。

## ファイル

- `index.html`：シミュレーション本体（HTML／CSS／JavaScript）
- `.nojekyll`：GitHub Pagesで静的ファイルをそのまま配信するための設定
- `README.md`：作品概要・操作方法・公開手順

## ゲーム拡張の企画書

探索・交易・船の成長を中心とするゲーム拡張の企画と仕様です。独自の物語、船員と勢力、権利確認の方針、段階的な実装手順をまとめています。

- [企画書兼仕様書 Markdown版](docs/pirate-voyage_game-spec_v1.md)
- [企画書兼仕様書 Word版](docs/pirate-voyage_game-spec_v1.docx)

ゲーム拡張の実装は、この文書の制作順序に沿って進めます。
