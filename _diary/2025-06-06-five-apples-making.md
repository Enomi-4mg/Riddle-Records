---
layout: post
title: "五つのりんご - メイキング TEST"
date: 2025-06-06
permalink: /diary/2025-06-06/five-apples-making/
---

## 制作過程

このページでは「五つのりんご」のCG作品がどのように作られたかを詳しく解説します。

### 使用したソフトウェア

- **Blender 4.0** - 3Dモデリング、ライティング、レンダリング
- **YouTube チュートリアル** - 静物シーンの制作方法を参考

### 制作ステップ

#### 1. モデリング

最初に5つの球体を配置して、それぞれの色と形状を調整しました。
りんごの質感を出すために、わずかに不均一な形状に仕上げています。

#### 2. マテリアル設定

各りんごに異なる色を適用しました。
- 赤、黄色、緑など、自然な色合いを意識
- 表面の光沢感を調整して、果物らしい質感を再現

#### 3. ライティング

スポットライトを2つ配置して、作品に立体感を与えました。
- **メインライト**: 上方から照射
- **サブライト**: 側面から補助的に照射

#### 4. カメラアングル

テーブルの上の果物を斜め上から見下ろすアングルで撮影。
被写界深度の効果が最も際立つ位置を試行錯誤しました。

<div class="making-comparison-grid">
  <div class="comparison-item">
    <a href="{{ site.cloudinary_url }}/w_1920,q_auto,f_auto/v1/five_apples_spot_angle2_xmytbf.png" data-lightbox="making-comparison" data-title="被写界深度なし">
      <img src="{{ site.cloudinary_url }}/w_800,q_auto,f_auto/v1/five_apples_spot_angle2_xmytbf.png" alt="被写界深度なし">
    </a>
    <p class="comparison-label">被写界深度なし</p>
  </div>
  <div class="comparison-item no-gallery-button">
    <a href="{{ site.cloudinary_url }}/w_1920,q_auto,f_auto/v1/five_apples_spot_angle2_pint_mgaggo.png" data-lightbox="making-comparison" data-title="被写界深度あり">
      <img src="{{ site.cloudinary_url }}/w_800,q_auto,f_auto/v1/five_apples_spot_angle2_pint_mgaggo.png" alt="被写界深度あり">
    </a>
    <p class="comparison-label">被写界深度あり</p>
  </div>
</div>

Blenderの得意な友人からアドバイスをもらい、Cyclesレンダラーで被写界深度を有効化。
手前のりんごに焦点を合わせ、背景をぼかすことで、より印象的な作品になりました。

### 学んだこと

- **被写界深度の効果**: わずかな設定変更で、作品の印象が大きく変わることを実感
- **ライティングの重要性**: 光の当て方で立体感が劇的に向上
- **試行錯誤の大切さ**: 何度もレンダリングして最適な設定を見つけることが重要

### 今後の課題

- より複雑な形状のモデリングに挑戦
- テクスチャマッピングの習得
- アニメーション制作への応用

---

この作品のその他の詳細は [5月の報告書]({{ '/diary/2025-06-06/' | relative_url }}) をご覧ください。
