# Water Render Lab

「黒潮の航海」のゲームロジックと独立した水面比較ページ。

## 比較条件

左と右で共通：
- 凪灯号の段階1モデル
- 船首方位 0.04 rad
- 追従カメラ：yaw 0.78 / pitch 0.31 / zoom 54
- 夕景 17:06相当
- 同じ空、同じ太陽、同じfog、同じ船体材質
- 同じ118×118の非線形海面グリッド

左：
- 現行ゲームと同じ3方向正弦波
- 現行に近い近似Fresnel、スペキュラ、ノイズ白波

右：
- 128×128 Stockham IFFTを2カスケード
- 6 m短波 + 96 m長波
- finite-depth gravity-wave dispersion
- Schlick Fresnel、反射方向の空、深度吸収、勾配ベースの白波
- FFTと同じ係数をCPUでも1点評価し、凪灯号のheave / pitch / rollを同期

右側はClearWater6.1の設計思想を比較するための独自実験実装であり、同リポジトリのCUDA/WebGPUコードの移植ではない。

## 目的

D2 UI改修とは独立して、現行水面とFFT水面の差を同一画角で確認する。ここで優位性と負荷が確認できても、ゲーム本体のレンダラーを自動的に置換しない。

確認する観点：
- 波の反復感
- 船の大きさに対する波長
- 夕景の水面反射
- 水平線の安定
- 白波の自然さ
- 凪灯号と海面の同期
- PC / スマホのfps

参考：
- https://github.com/SamG-Coder/ClearWater6.1
- https://github.com/SamG-Coder/clearwater
- https://github.com/ScottieFox/caustic-volume

## 実行

GitHub Pagesでは `/render-lab/`。

ローカルではリポジトリ直下をHTTP serverで配信して `/render-lab/` を開く。WebGL 2 と `EXT_color_buffer_float` が必要。
