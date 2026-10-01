# 水面レンダリング比較 — Clearwater / CAUSTIC//VOLUME / ClearWater6.1

調査日：2026年10月1日（日本時間）。  
対象：ゲーム版「黒潮の航海 失われた潮路」の海上レンダリング。  
目的：現行の自作WebGL水面を維持すべきか、公開MIT実装の技術を採用・移植すべきか判断する。

## 結論

現時点ではレンダラーの丸ごと置換を行わない。

最も相性がよい調査対象は **SamG-Coder/ClearWater6.1**。外洋向けFFT波、Fresnel反射、屈折、Beer-Lambert吸収、コースティクスを一つの上水面レンダラーとして持ち、モバイル用の解像度制御も明示されているため、「黒潮の航海」の将来の海面品質目標として最も近い。

一方で現行ゲームはWebGL 1の単一HTMLで、船、島、浮標、海、空を同一レンダラーで描き、CPU側の `waveHeight` とGPU側の波式を一致させて船体の上下・傾きを決めている。ClearWater6.1とClearwaterはWebGPU上でGPU常駐FFTを実行するため、水面だけを差し替えると船体運動との同期、深度、遮蔽、反射、同一canvasの描画方式が崩れる。したがって直接コピーではなく、別ページのrender labで評価してから移行可否を決める。

## 現行レンダラー

`adventure/index.html` の `adventure-renderer` はライブラリを使わないWebGL 1実装。

- 100×100の非線形グリッドを船の周囲に配置。
- 3本の正弦波を合成して高さと解析的勾配を生成。
- CPU側にも同じ `waveHeight` / `waveSlope` を持ち、船のheave、pitch、rollを同期。
- 水面色は深色と浅色をノイズで補間し、視線角による近似Fresnel、太陽スペキュラ、波頭ノイズ、船首付近の航跡を加える。
- 空は別のフルスクリーンshader。島、船、浮標は同じWebGLコンテキストで描く。
- 強みは軽量さ、単一HTML、広い互換性、ゲーム状態との同期の単純さ。
- 弱みは波のスケール数、波形の自然さ、水平変位、白波生成、反射・屈折・浅瀬光学の物理性。

## 候補1 SamG-Coder/ClearWater6.1

URL: https://github.com/SamG-Coder/ClearWater6.1  
Demo: https://samg-coder.github.io/ClearWater6.1/  
License: MIT。

主な実装：
- WebGPU。CUDA WebShaderでCUDA-subsetをWGSLへ変換。
- 128×128のFFTを2カスケード、6 mと96 m。
- finite-depth gravity-wave dispersion。
- Fresnel反射、屈折、波長別Beer-Lambert吸収、水中散乱、太陽ハイライト。
- 256×256コースティクス。
- 水面ドラッグから別のスペクトル場へ力を注入。
- Mobile / Autoでは30fps目標、最大辺960px、動的解像度低下、モバイル用の軽量photon pass。
- Three.js、WebGL、外部テクスチャを使わない。

### 本作との適合

三候補中で最も高い。

本作も「上から海を見る外洋航海」が中心であり、ClearWater6.1は水槽ではなく浅瀬～外洋の水面研究である。現在の3波合成から、複数スケールFFT、物理寄りのFresnel、深度光学へ進む場合の基準として適している。

ただしWebGPU専用。現行WebGLの船・島を同じcanvasにそのまま混ぜることはできず、採用する場合は描画層の移行が必要。GPU常駐波をCPUへ毎frame readbackしない設計なので、現在のCPU船体運動をそのまま合わせることもできない。

### 採用するなら

まず独立した `render-lab` で、本作のカメラ、船の大きさ、夕景、浮標の距離感に合わせた水面だけを試す。実機で問題がなければ、船と島を含めたWebGPUレンダラーへの段階移行を別工程として設計する。

## 候補2 SamG-Coder/clearwater

URL: https://github.com/SamG-Coder/clearwater  
Demo: https://samg-coder.github.io/clearwater/  
License: MIT。原Clearwaterとvendored CUDA WebShaderのnoticeを保持する。

ClearWater6.1よりさらに大規模。

- 256×256 FFTを3カスケード、約4.6 m / 37 m / 293 m。
- JONSWAP型の風向依存スペクトル。
- 水平crest displacement。
- Jacobianと勾配を使う持続白波、泡、気泡、spray。
- Fresnel、屈折、吸収・散乱、浅瀬caustics。
- volumetric clouds、storm、rain、lightning。
- 局地的な竜巻・waterspout用流体、局地海面パッチ等も含む。
- WebGPU / CUDA WebShader。

### 本作との適合

海そのものの品質目標としては最も高度だが、現在の二港試作には過剰。

波・白波・夕景・荒天の考え方は非常に参考になる。特に三スケール波、波面圧縮に基づくfoam、水平変位は将来の荒天表現で採用価値が高い。

一方で天候・雲・竜巻・spray・気泡まで持ち込むとゲーム本体よりレンダリング基盤が支配的になる。現段階でコードを丸ごと移植する対象にはしない。

## 候補3 ScottieFox/caustic-volume

URL: https://github.com/ScottieFox/caustic-volume  
Demo: https://scottiefox.github.io/caustic-volume/  
License: MIT。

二つの系統がある。

### CAUSTIC//LITE

- three.js / WebGL 2。
- WebGL 2がない場合はCPU fallback。
- 24本の進行波、GPU ripple simulation。
- Fresnel反射、Snell屈折、Beer-Lambert吸収。
- 毎frame、光線を水面から床へ投影してcaustics textureを生成。
- 実測fpsに応じたadaptive resolution。

### CAUSTIC//VOLUME sandbox

- WebGL 2 + float render targets。
- FFT ocean + iWave。
- photon-traced caustics、色分散、caustic volume、水中light shafts。
- foam、splashes、浮力、TAA、bloom、depth of field等。
- 高性能GPU向け。

### 本作との適合

外洋の主レンダラーより、将来の「港の浅瀬」「海底が見える水域」「水中」「船体近傍の光学」の資料として価値が高い。

LiteはWebGL 2とCPU fallbackを持つため互換性の思想は本作と相性がよい。ただしthree.jsベースへ移るため、現行の自作WebGL 1へそのまま追加する方式ではない。

Sandboxのvolumetric causticsは見栄えが強いが、海上航行中は海底がほぼ見えないため計算量に対する効果が小さい。港や透明な浅瀬を作る段階まで保留する。

## 採用優先順位

### 近い将来
1. ClearWater6.1を外洋水面の品質基準にする。
2. 現行WebGL 1には、低リスクで移植できる考え方だけ先行導入する。
   - 複数スケール・複数方向の波
   - より正確なFresnel
   - wave slopeに基づくsun glitter
   - slope / compressionに連動する白波
   - 距離で短波を落とすhorizon stabilization
3. 現行のCPU/GPU同一波式は維持し、船体運動との不一致を起こさない。

### 中期
`adventure/render-lab.html` のような独立実験ページを作り、WebGPU版の海面を本作のカメラ条件で比較する。mainのゲームロジックや保存データには接続しない。

確認項目：
- PCとiPhone相当の縦画面で30fps以上を維持できるか。
- 初回ロード時間とshader/artifact読み込み。
- 船と浮標の視認性。
- 夕方・夜間の帆の判別。
- 低電力GPUでの解像度低下時の見え方。
- `navigator.gpu` 不可環境のfallback。
- 船体heave/pitch/rollをGPU波と同期する方式。
- 島と水面の遮蔽、reflection、depthの統合方法。

### 保留
- Clearwaterのvolumetric weather、tornado、spray全体。
- CAUSTIC//VOLUME sandboxの水中volume / TAA / DOF一式。
- 現行game rendererの即時全面置換。

## 技術判断

今回の三候補を見たことで「現行の海面で十分」とは判断しない。海の品質は改善余地が大きい。

ただし、現在の価値はゲームとして船、浮標、交易、観測、保存が一体で動くことである。レンダラーを先に全面移行すると、D2～D4のUI改修とM4a-3以降の機能開発を止めるリスクが高い。

したがって本線は **現行レンダラーを保ちながら見た目を段階改善し、ClearWater6.1方式はrender labで並走評価する**。実機で明確な優位と許容負荷が確認できた場合にだけ、WebGPU移行を正式工程化する。
