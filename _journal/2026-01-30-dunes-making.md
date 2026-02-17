---
layout: post
title: "砂の風紋シミュレーション"
date: 2026-02-07
og_description: "砂丘と風紋の物理モデルをC++のopenFrameworksにて実装しました。"
image: result-4_qptaza.gif
permalink: /journal/2026-01-30/dunes-making/
use_math: true
---

# 概要
　風によってできる砂の模様を再現しました。メモとして残しておきます。

<div class="journal-card-grid">
  <div class="journal-card no-gallery-button">
    <a href="{{ site.cloudinary_url }}/w_1920,q_auto,f_auto/result-4_qptaza.gif" data-lightbox="Journal" data-title="">
      <img src="{{ site.cloudinary_url }}/w_300,h_300,c_fill,q_auto,f_auto/result-4_qptaza.gif" alt="">
    </a>
    <div class="journal-card-info">
      <h4></h4>
    </div>
  </div>
</div>

## 経緯
　きっかけは[この動画](https://www.youtube.com/watch?v=_M6bBMniKO4)を視聴したことです。
こういう物理エンジンで興味深い実験をしたり、突拍子もないことをしたりする動画を小学生の頃に滅茶苦茶みてたなあと懐かしくなって動画を視聴。プログラミングに慣れてきたからか意外と自分でも再現できそうだなと思いました。幸いにも動画の概要欄に参考にした論文が掲載してあったのでそれを基に、openFrameworks（C++）を用いた実装に挑戦しました。

　以下に、参考にした文献とGeminiとのチャットを掲載します。

### 参考文献
1. [A Method for Modeling and Rendering Dunes with Wind-ripples](https://www.researchgate.net/publication/2353759_A_Method_for_Modeling_and_Rendering_Dunes_with_Wind-ripples)
2. [風紋・砂丘を含む砂漠景観の表示法](http://nishitalab.org/user/nis/cdrom/japanese/onoue03.pdf)
3. [風洞を使って砂の動きを見てみよう](https://www.alrc.tottori-u.ac.jp/staff103/jikkensiryou.pdf)

### Geminiとのチャット
- [Gemini先生と計画段階](https://gemini.google.com/share/41dd01429f65)
- [Gemini先生による実装指導](https://gemini.google.com/share/b372cf65297a)

## 砂の風紋の数理モデル
　砂の風紋は平面をセルに分割しそれぞれの高さをモデルを適用することで表現できるようです。セルの高さは $H(x, y)$ として表現されます。文献①によると砂の風紋は**跳躍（Saltation）**と**這行（Creep）**の2段階に分離して実装できるようです。
### **跳躍（Saltation）**
　跳躍は風によって砂が吹き飛ぶ様子に対応します。
　このモデルにおける跳躍距離 $L$ は、風力パラメータ $L_0$ と定数 $b$ を用いて次のように近似されます。一地点から砂の量 $q$ を引き、着地点に $q$ を加えることで、砂の移動を表現できるようです。

$$L = L_{0} + bH_{n}(x,y)$$

* $q : 移動する砂の高さ（転送量）$
* $L : 1回の跳躍距離$
* $L_0 : 基本風速$
* $b : 高さの影響度$

　砂の移動に伴う高さの変化は、中間ステップ $H'$ を用いて以下のように記述されます。

$$H^{\prime}_{n}(x,y) = H_{n}(x,y) - q$$

$$H^{\prime}_{n}(x+L, y) = H_{n}(x+L, y) + q$$

### **這行（Creep）**
　重力による砂の盛り上がりの崩壊。これは物理的には拡散方程式として扱えるようです。近傍8セル（上下左右の $NN$ と斜め方向の $NNN$）の高さを参照し、地形を滑らかに平滑化します。この $D$（拡散係数）が、砂の「さらさら具合」を決定します。

$$H_{n+1}(x, y) = H_{n^{\prime}}(x, y) + D \left[ \frac{1}{6} \sum_{NN} H_{n^{\prime}} + \frac{1}{12} \sum_{NNN} H_{n^{\prime}} - H_{n^{\prime}}(x, y) \right]$$

* $ NN : 最近接点（Nearest Neighbor）、隣接するセル $
* $ NNN : 次近接点（Next Nearest Neighbor）、斜め方向のセル $
* $ D : 拡散（緩和）係数、砂山の崩れやすさ、砂のサラサラ度 $

### **砂丘（Dune）モデルへの拡張**
　大規模な砂丘モデルでは、跳躍距離 $L$ と転送量 $q$ が地形の勾配（$\nabla \cdot H$）に依存します。登り坂だと飛距離Lが短くなる、下り坂だと伸びるというのでモデル化しているようです。

$$ L = L_0 - b \tanh(\nabla \cdot H_n(x,y)) $$

* $ L_0(基本飛距離) : 風が平坦な地面を吹く際の、砂粒の標準的なジャンプ距離です。 $
* $ \nabla \cdot H(局所勾配) : その地点が風に対して「登り坂」か「下り坂」かを示します。 $
* $ \tanh (双曲線正接関数) : 良い感じに増減するように調整する役割。無限に飛距離が増減することを防いでいるよう。 $

　登り坂では風が斜面にぶつかって風圧が強まることでより多くの砂が巻き上げられます。下り坂ではその逆で砂を運ぶ力が弱まります。

$$ q = q_0 + b' \tanh(\nabla \cdot H_n(x,y)) $$

* $ q_0 (基本転送量): 風によって一度に運ばれる砂の標準的な量です。$

## 実装過

### phase①:準備
　openFrameworksのProject Generatorでファイルを作成します。詳しい解説はインターネッツにいろいろあるので検索するなりして探してみてください…。
- 使用したIDE: Visual Studio 2026

### phase②:メッシュを描画
  　まずは砂丘の基礎となるメッシュを描画します。openFrameworksではofMeshクラスを用いてメッシュを扱うことができます。一次元配列`std::vector<float>`で管理し、`index = i + j * \_X`を用いてアクセスします。以下に簡単なコード例を示します。
  
```cpp
void ofApp::setup(){
  heights.resize(_X * _Z);
  for (int i = 0; i < _X; i++) {
    for(int j=0; j < _Z; j++){
      heights[i + j * _X] = ofNoise(i * 0.05, j * 0.05) * 100.0f;
      glm::vec3 vertex(i, heights[i + j * _X], j);
      dunes.addVertex(vertex);
      }
    }
  dunes.setMode(OF_PRIMITIVE_TRIANGLES);
  for (int i = 0; i < _X - 1; i++) {
    for (int j = 0; j < _Z - 1; j++) {
      dunes.addIndex(i + j * _X);
      dunes.addIndex((i + 1) + j * _X);
      dunes.addIndex(i + (j + 1) * _X);

      dunes.addIndex(i + (j + 1) * _X);
      dunes.addIndex((i + 1) + j * _X);
      dunes.addIndex((i + 1) + (j + 1) * _X);
    }
  }
} 
void ofApp::draw(){
  ofBackground(30);
    
  cam.begin();
  ofDrawGrid(100, 10, true, true, true, true); 
    
  ofSetColor(200, 150, 100);
  dunes.drawWireframe();
  cam.end();
}
```

### phase③:砂の風紋シミュレーションの実装
  　砂の風紋シミュレーションは、前述の数理モデルに基づいて実装しました。`heights`の値を数式で処理します。途中で`interHeights`,`resrltHeights`を介することで上手く更新できるようにします。
  
  ```cpp
  void ofApp::update() {
	interHeights = heights;
	resultHeights = heights;
	for (int i = 0; i < _X; i++) {
		for (int j = 0; j < _Z; j++) {
			int Idx = i + j * _X;
			float L = windVelocityParam.get() + velocityHeightParam.get() * heights[i + j * _X];

			int offset = static_cast<int>(std::round(L));
			int nextX = (i + offset) % _X;
			if (nextX < 0) {
				nextX += _X;
			}
			int nextIdx = nextX + j * _X;

			interHeights[Idx] -= sandTransportRateParam.get();
			interHeights[nextIdx] += sandTransportRateParam.get();
		}
	}
	resultHeights = interHeights;
	for (int i = 0; i < _X; i++) {
		for (int j = 0; j < _Z; j++) {
			int Idx = i + j * _X;
			// 平滑化
			float sum_NN = 0;
			float sum_NNN = 0;

			// 上下左右 (NN)
			int left = (i - 1 + _X) % _X;
			int right = (i + 1) % _X;
			int up = (j - 1 + _Z) % _Z;
			int down = (j + 1) % _Z;

			sum_NN += interHeights[left + j * _X];
			sum_NN += interHeights[right + j * _X];
			sum_NN += interHeights[i + up * _X];
			sum_NN += interHeights[i + down * _X];

			// 斜め 4点 (NNN)
			sum_NNN += interHeights[left + up * _X];   // 左上
			sum_NNN += interHeights[right + up * _X];  // 右上
			sum_NNN += interHeights[left + down * _X]; // 左下
			sum_NNN += interHeights[right + down * _X];// 右下

			float delta = diffusionCoeffParam.get() * ((1.0 / 6.0) * sum_NN + (1.0 / 12.0) * sum_NNN - interHeights[Idx]);
			resultHeights[Idx] = interHeights[Idx] + delta;
		}
	}
	heights = resultHeights;
	for (int i = 0; i < _X; i++) {
		for (int j = 0; j < _Z; j++) {
			int idx = i + j * _X;
			glm::vec3 vertex = dunes.getVertex(idx);
			vertex.y = heights[idx];
			dunes.setVertex(idx, vertex);
		}
	}
}
```

# シェーダーの設定
　シェーダーに関する設定は全くよくわかっていません。コピペです。コピペ。そのうちちゃんと勉強したいですね。

```shader.frag
#version 150

uniform sampler2D normalMap;
uniform vec3 lightDir; // C++から渡す太陽の向き

in vec2 v_texCoord;
out vec4 outputColor;

void main() {
    vec3 resNormal = texture(normalMap, v_texCoord).rgb;
    vec3 normal = normalize(resNormal * 2.0 - 1.0);

    vec3 L = normalize(lightDir);
    float diffuse = max(dot(normal, L), 0.0);

    vec3 sandColor = vec3(0.7, 0.6, 0.4); 
    
    vec3 viewDir = normalize(vec3(0, 0, 1)); // 簡易的な視線方向
    vec3 halfDir = normalize(L + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0); // 32は光沢の鋭さ
    outputColor = vec4(sandColor * (diffuse + ambient) + vec3(spec * 0.2), 1.0);
}
```
```shader.vert
#version 150

uniform mat4 modelViewProjectionMatrix;
in vec4 position;
in vec2 texcoord;

out vec2 v_texCoord;

void main() {
    v_texCoord = texcoord;
    gl_Position = modelViewProjectionMatrix * position;
}
```

# まとめ
　以上のような感じで風紋シミュレーターを作成してみました。
　詳細なコードは以下のリンクからアクセスしてクローンするなどして試してみてください。実際のコードではGUIによるパラメタの調整なんかも実装しています。

- [GitHubのリポジトリ](https://github.com/Enomi-4mg/Dune-Rendering)