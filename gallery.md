---
layout: page
title: "Gallery"
---

<div class="gallery-intro">
  <p>作品ギャラリーです。Blenderで作成した3DCG、イラスト、写真などを掲載しています。</p>
  <p>現在{{ site.data.gallery | size }}点の作品があります。</p>
</div>

<div class="gallery-grid">
{% for item in site.data.gallery %}
  <div class="gallery-item">
    <a href="{{ site.cloudinary_url }}/v1/{{ item.cloudinary_id }}" target="_blank" class="gallery-image-link">
      <img src="{{ site.cloudinary_url }}/w_400,h_400,c_fill,q_auto,f_auto/v1/{{ item.cloudinary_id }}" 
           alt="{{ item.title }}"
           loading="lazy">
    </a>
    <div class="gallery-info">
      <h3>{{ item.title }}</h3>
      <p class="date">📅 {{ item.date }}</p>
      <p class="description">{{ item.description }}</p>
      <span class="category category-{{ item.category }}">{{ item.category }}</span>
    </div>
  </div>
{% endfor %}
</div>

<style>
/* ギャラリー全体のスタイル */
.gallery-intro {
  text-align: center;
  margin: 2rem 0;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

/* グリッドレイアウト（カード形式） */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  padding: 2rem 0;
}

/* 各作品のカード */
.gallery-item {
  border: 1px solid #ddd;
  padding: 1rem;
  border-radius: 8px;
  background: white;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.gallery-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

/* 画像部分 */
.gallery-image-link {
  display: block;
  overflow: hidden;
  border-radius: 4px;
}

.gallery-item img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
  transition: transform 0.3s ease;
}

.gallery-item:hover img {
  transform: scale(1.05);
}

/* 作品情報部分 */
.gallery-info {
  padding-top: 1rem;
}

.gallery-item h3 {
  margin: 0.5rem 0;
  font-size: 1.2rem;
  color: #333;
}

.date {
  font-size: 0.9rem;
  color: #666;
  margin: 0.3rem 0;
}

.description {
  font-size: 0.95rem;
  color: #555;
  margin: 0.5rem 0 1rem;
  line-height: 1.5;
}

/* カテゴリタグ */
.category {
  display: inline-block;
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: bold;
}

.category-3DCG {
  background: #007acc;
  color: white;
}

.category-イラスト {
  background: #ff6b6b;
  color: white;
}

.category-写真 {
  background: #51cf66;
  color: white;
}

/* スマホ対応 */
@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}
</style>
