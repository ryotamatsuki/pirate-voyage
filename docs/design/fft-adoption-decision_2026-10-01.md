# FFT水面の本編採用判断

評価日：2026-10-01  
対象：`render-lab/` の現行3波水面と128²×2カスケードFFT比較面  
判断対象：FFT側をゲーム本編へどこまで導入するか

## 結論

**現時点ではFFT本体を本編へ入れない。**

本編では、現行のCPU/GPU同期型の軽量水面を維持したまま、FFT側およびClearWater6.1から「見た目に効く要素」だけを段階的に取り込む。

次の水面改修は **FFT移植ではなく、FFT-inspired hybrid** とする。

## render-labで確認できたこと

### 現行側の優位

CIで保存したdesktop / phoneスクリーンショットでは、現行側の方が夕景のゲーム画面としてまとまりがよい。

- 太陽の反射帯が一本の光路として読みやすい。
- 船体と水面のコントラストが良い。
- 小さな水面変化が多く、静止画でも海らしい情報量がある。
- 船のheave / pitch / rollは描画波と同じ解析式なので同期が確実。
- WebGL 1で既存の船・島・浮標・航跡と同一canvasに統合済み。

### FFT比較面の良い点

- 長波と短波を別スケールで持てるため、今後の海況表現の設計基盤としては優れている。
- finite-depth dispersionを使うため、単純な正弦波合成より各周波数の時間発展を自然にできる。
- Schlick Fresnel、反射方向の空、吸収を使うshadingは現行より物理的。
- 将来、風向・海況・荒天を波スペクトルと結びつけやすい。

### 現在のFFT比較面の問題

- 6 m / 96 mの2カスケードが、画面上では長い平行帯として見えやすい。
- 水平crest displacementがないため、FFTを使っていても波頭の形が十分立体的ではない。
- 白波は勾配だけから生成しており、ClearwaterのJacobian/transport型foamほど自然ではない。
- 夕景のsun glitterが点・筋に分離し、現行側の反射帯より視覚的なまとまりが弱い。
- render-labの船体同期は、GPU FFTとは別にCPUで同じFourier係数を全モード一点評価している。128²×2カスケードを毎frame走査する方式は本編用として不適切。
- WebGL 2 + float render targetを要求するため、現行WebGL 1より互換性が落ちる。
- render-labは左右を同時描画する比較ページであり、表示fpsは実機性能の比較値ではない。CIスクリーンショットの6fps/12fpsはheadless/software rendering環境の値なので本番性能指標には使わない。

## 本編へ入れる範囲

### A. 今すぐ採用する

#### 1. Schlick Fresnel

現行：
`pow(1 - dot(view,n), 3.4)`

改修：
水のF0 ≈ 0.020を使うSchlick式。

`F = F0 + (1-F0)(1-cosθ)^5`

効果：
- 正面視では水中色を維持。
- 斜め視線で空の反射が自然に増える。
- 計算コストはほぼ無視できる。

#### 2. 反射方向に応じた空色

現行はFresnel項でfog色を混ぜているだけ。

FFT比較面のように `reflect(-view,n)` の方向から、現在の空shaderに対応する近似空色を得る。

効果：
- 夕景で「空が海に映る」感覚が増える。
- sun glitterとの一体感を改善できる。

ただし本物のenvironment mapはまだ導入せず、解析的なsky functionを共用する。

#### 3. 距離に応じた短波減衰

ClearWater6.1のhorizon stabilizationの考え方を採用。

- 近距離：細かい短波を表示。
- 遠距離：短波normalを徐々に減衰。
- 長波だけを水平線まで残す。

効果：
- 遠景のちらつき・moireを抑える。
- スマホでのaliasingを減らす。
- 実質的な追加GPU負荷は小さい。

#### 4. slopeベースのsun glitter

現在の高指数specularを、wave slopeとview/sun half-vectorを使う狭いroughness分布へ変更。

FFT比較面のmicrofacet的な考え方は採用するが、完全なBRDF実装までは不要。

#### 5. 白波発生条件の改善

現在の「高さ + noise」中心から、
- slope
- crest height
- 進行方向
を組み合わせる。

ランダムな白い模様ではなく「急な波頭だけが白くなる」方向へ移す。

### B. FFTの代わりに採用する

#### 6. 多スケール解析波へ拡張

現在3波を、**6〜10個程度の決定論的な方向波**へ拡張する。

推奨構成：
- 長波 2本
- 中波 3〜4本
- 短波 2〜4本

各成分は
- 波長
- 振幅
- 方向
- 位相
- 深度依存の角周波数

を持たせる。

GPU shaderとCPU `waveHeight/waveSlope` の双方で同じ配列を使う。

これによりFFTの主要な視覚上の利点である「単一周期感の減少」「複数スケール」を得ながら、
- CPU/GPU同期
- WebGL 1
- 船体挙動
- 浮標追従
- 航跡
をそのまま維持できる。

これは次の本編水面改修の中心とする。

### C. 今は入れない

#### 7. 128² FFT × 2のruntime

採用しない。

理由：
- 現在のrender-lab画像では視覚的優位が確立していない。
- 船体同期方法を別途設計する必要がある。
- WebGL 2依存になる。
- 本編のD2〜D4とM4a開発に対して改修範囲が大きすぎる。

#### 8. GPU波面のCPU readback

採用しない。

毎frame readbackはGPU pipeline stallを生む可能性が高く、ClearWater系のzero-readback設計とも逆行する。

#### 9. CPUで全FFTモード一点評価

render-labでは比較のため許容したが、本編では採用しない。

#### 10. caustics / Beer-Lambert海底光学

外洋本編では保留。

港や浅瀬で海底を見せる設計が入った時点で再評価する。

#### 11. Clearwaterのfoam transport / spray / volumetric weather

荒天をゲームシステムとして実装する段階まで保留。

## 推奨ロードマップ

### Water-H1：現行shaderの物理寄り改善
機能変更なし。

- Schlick Fresnel
- analytic sky reflection
- improved sun glitter
- distance short-wave fade
- slope-based foam

この段階では波形自体は現行3波を維持する。

### Water-H2：多スケール解析波
3波を6〜10波へ拡張。

- CPU/GPUで共通定数
- finite-depth dispersion
- 長・中・短の三帯域
- wind directionに応じた方向重み
- 船、浮標、camera clearanceを同じsurface functionへ接続

### Water-H3：荒天品質
必要になった時だけ実装。

- crest compressionの近似
- persistent foam
- wind-dependent spectrum weights
- storm時の短波・白波増加

### Water-FFT：将来の再評価ゲート
以下をすべて満たした場合のみruntime FFTへの移行を再検討する。

1. FFT版が同じ船・同じ画角でH2版を見た目で明確に上回る。
2. iPhone実機相当で継続30fps以上。
3. 船体・浮標の波同期をGPU readbackなしで解決。
4. WebGL 2 / WebGPU非対応環境のfallback方針が決まる。
5. 島・船・海のdepth統合を一つのrendererで処理できる。

## 判断

本編に取り込むのは「FFTそのもの」ではなく、まず **FFTが良く見える理由**。

今回のrender-labからは、FFTを使うこと自体よりも、
- 複数スケール
- 物理寄りの反射
- 距離LOD
- 波勾配に結び付いた光と白波
の方が本作への費用対効果が高い。

したがって本編の次期水面仕様は **WebGL 1を維持したFFT-inspired hybrid** とする。
