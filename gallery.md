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
    <button class="filter-btn" data-filter="四コマ漫画">四コマ漫画</button>
  </div>
</div>

<!-- ギャラリーグリッド -->
<div class="gallery-grid" id="gallery-container">
{% assign sorted_gallery = site.data.gallery | sort: 'date' | reverse %}
{% for item in sorted_gallery %}
  <div class="gallery-item" data-date="{{ item.date }}" data-categories="{{ item.categories | join: ',' }}">
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
      <div class="category-list">
        {% for category in item.categories %}
          <span class="category category-{{ category }}">{{ category }}</span>
        {% endfor %}
      </div>
      
      {% if item.article_url and item.article_url != "" %}
        <a href="{{ item.article_url | relative_url }}" class="article-link-btn">
          📖 元記事リンク
        </a>
      {% endif %}
    </div>
  </div>
{% endfor %}
</div>

