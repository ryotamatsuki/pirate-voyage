# タイポグラフィ決定記録 — D1

決定日：2026年10月1日（日本時間）  
対象：ゲーム版「黒潮の航海 失われた潮路」v0.1.3以降のデザイン改修

## 決定

従来の「本文は日本語ゴシック、見出しは明朝」という案を取り下げる。
ゲームの基本UI、本文、数値、ボタン、大見出しは **LINE Seed JP** を基本書体とし、Regular / Bold / ExtraBoldのウェイト差で情報階層を作る。

航海帳、観測記録、発見名など「船長が書き残した記録」に見せたい短い見出しだけ **Klee One SemiBold** を使う。Klee Oneは本文、数値、取引、操船ボタン、警告には使わない。

## 理由

- 本作は海上HUD、港の取引、数値、会話、航海帳を同じ画面体系で扱うため、和文・欧文・数字が混ざっても安定するUI書体を優先する。
- 明朝体を画面見出し全体に使うと、現行の暗いパネルと組み合わせた際に冊子・資料の印象が強くなり、ゲームUIとしての一体感が弱い。
- LINE Seed JPは日本語と英語を同時に使う前提で設計され、4ウェイトを持つ。UIの階層を別書体ではなくウェイトで作りやすい。
- Klee Oneは筆記具による手書きに近い静かな表情を持つため、紙面系の記録に限定すると世界観の補助になる。

## 実装

Google FontsのWebフォントを任意依存として読み込む。読み込みに失敗しても、LINE Seed JPはNoto Sans JP、游ゴシック、Meiryo、system-uiへ、Klee Oneは游明朝等へフォールバックする。ゲームの利用可否を外部フォント配信へ依存させない。

使用CSS：

```text
https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&family=LINE+Seed+JP:wght@400;700;800&display=swap
```

フォントファイル自体はリポジトリへ保存しない。

## 参照

- LINE Seed公式: https://seed.line.me/index_jp.html
- LINE Seed GitHub: https://github.com/line/seed
- Google Fonts LINE Seed JP: https://fonts.google.com/specimen/LINE+Seed+JP
- Klee One GitHub: https://github.com/fontworks-fonts/Klee
- Google Fonts Klee One: https://fonts.google.com/specimen/Klee+One

両フォントともSIL Open Font License 1.1で提供される。ライセンスは各配布元の原文を優先する。
