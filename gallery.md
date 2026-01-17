---
layout: default
title: "Gallery"
---

<h1 class="web_title">{{ page.title }}</h1>

<div class="gallery-intro">
  <p>作品ギャラリーです。Blenderで作成した3DCG、イラスト、写真などを掲載しています。</p>
  <p>現在{{ site.data.gallery | size }}点の作品があります。</p>
</div>

<!-- コントロールパネル -->
<div class="gallery-controls">
  <div class="sort-controls">
    <button id="sort-newest" class="control-btn active">新しい順</button>
    <button id="sort-oldest" class="control-btn">古い順</button>
  </div>
  
  <div class="filter-controls">
    <button class="filter-btn active" data-filter="all">すべて</button>
    <button class="filter-btn active" data-filter="イラスト">イラスト</button>
    <button class="filter-btn active" data-filter="3DCG">3DCG</button>
    <button class="filter-btn" data-filter="写真">写真</button>
  </div>
</div>

<!-- ギャラリーグリッド -->
<div class="gallery-grid" id="gallery-container">
{% assign sorted_gallery = site.data.gallery | sort: 'date' | reverse %}
{% for item in sorted_gallery %}
  <div class="gallery-item" data-date="{{ item.date }}" data-category="{{ item.category }}">
    <a href="{{ site.cloudinary_url }}/w_1920,q_auto,f_auto/v1/{{ item.cloudinary_id }}" 
       data-lightbox="gallery" 
       data-title="{{ item.title }} - {{ item.description }}"
       class="gallery-image-link">
      <img src="{{ site.cloudinary_url }}/w_400,h_400,c_fill,q_auto,f_auto/v1/{{ item.cloudinary_id }}" 
           alt="{{ item.title }}"
           loading="lazy">
    </a>
    <div class="gallery-info">
      <h3>{{ item.title }}</h3>
      <p class="date">📅 {{ item.date | date: "%Y年%m月%d日" }}</p>
      <p class="description">{{ item.description }}</p>
      <span class="category category-{{ item.category }}">{{ item.category }}</span>
      
      {% if item.article_url and item.article_url != "" %}
        <a href="{{ item.article_url | relative_url }}" class="article-link-btn">
          📖 元記事リンク
        </a>
      {% endif %}
    </div>
  </div>
{% endfor %}
</div>

<script>
// =====================================
// 日時ソート機能
// =====================================
const container = document.getElementById('gallery-container');
const items = Array.from(container.children);

document.getElementById('sort-newest').addEventListener('click', function() {
  items.sort((a, b) => new Date(b.dataset.date) - new Date(a.dataset.date));
  items.forEach(item => container.appendChild(item));
  
  document.querySelectorAll('.sort-controls .control-btn').forEach(btn => btn.classList.remove('active'));
  this.classList.add('active');
});

document.getElementById('sort-oldest').addEventListener('click', function() {
  items.sort((a, b) => new Date(a.dataset.date) - new Date(b.dataset.date));
  items.forEach(item => container.appendChild(item));
  
  document.querySelectorAll('.sort-controls .control-btn').forEach(btn => btn.classList.remove('active'));
  this.classList.add('active');
});

// =====================================
// カテゴリフィルター機能
// =====================================
const filterButtons = document.querySelectorAll('.filter-btn');
const galleryItems = document.querySelectorAll('.gallery-item');

// 初期表示：イラストと3DCGのみ表示
function initializeFilters() {
  const activeFilters = ['イラスト', '3DCG'];
  galleryItems.forEach(item => {
    const category = item.dataset.category;
    if (activeFilters.includes(category)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

filterButtons.forEach(button => {
  button.addEventListener('click', function() {
    const filter = this.dataset.filter;
    
    // 「すべて」ボタンの処理
    if (filter === 'all') {
      galleryItems.forEach(item => item.style.display = '');
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      return;
    }
    
    // 個別カテゴリボタンの処理
    this.classList.toggle('active');
    
    // 「すべて」ボタンを非アクティブに
    document.querySelector('.filter-btn[data-filter="all"]').classList.remove('active');
    
    // アクティブなカテゴリを取得
    const activeFilters = Array.from(document.querySelectorAll('.filter-btn.active'))
      .map(btn => btn.dataset.filter)
      .filter(f => f !== 'all');
    
    // フィルタリング処理
    galleryItems.forEach(item => {
      const category = item.dataset.category;
      
      if (activeFilters.length === 0 || activeFilters.includes(category)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
    
    // すべて非選択なら「すべて」を自動選択
    if (activeFilters.length === 0) {
      document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
      galleryItems.forEach(item => item.style.display = '');
    }
  });
});

// ページ読み込み時に初期フィルター適用
initializeFilters();
</script>

<style>
/* =====================================
   ギャラリー全体のスタイル
   ===================================== */
.gallery-intro {
  text-align: center;
  margin: 2rem 0;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

/* =====================================
   コントロールパネル
   ===================================== */
.gallery-controls {
  margin: 2rem 0;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.sort-controls {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.control-btn,
.filter-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  font-family: 'Kiwi Maru', serif;
}

.control-btn:hover,
.filter-btn:hover {
  background: #f5f5f5;
  border-color: #007acc;
}

.control-btn.active {
  background: #007acc;
  color: white;
  border-color: #007acc;
}

.filter-btn.active {
  background: #ff6b6b;
  color: white;
  border-color: #ff6b6b;
}

/* =====================================
   グリッドレイアウト
   ===================================== */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  padding: 2rem 0;
}

/* =====================================
   各作品のカード
   ===================================== */
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
  cursor: pointer;
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
  margin-bottom: 0.5rem;
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

/* =====================================
   記事リンクボタン
   ===================================== */
.article-link-btn {
  display: inline-block;
  margin-top: 0.75rem;
  padding: 0.6rem 1.2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
}

.article-link-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
  text-decoration: none;
}

/* =====================================
   スマホ対応
   ===================================== */
@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .filter-controls {
    justify-content: center;
  }
  
  .control-btn,
  .filter-btn {
    font-size: 0.85rem;
    padding: 0.4rem 0.8rem;
  }
}
</style>
