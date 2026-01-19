---
layout: default
title: "Discography"
description: "公開した楽曲の一覧。"
og_title: "Discography | Riddle Records"
og_description: "公開中のオリジナル曲・参加作品を掲載。"
image: "/favicon/icon.jpg"
og_type: "website"
---

<h1 class="web_title">{{ page.title }}</h1>

{% assign sorted_songs = site.songs | sort: 'date' | reverse %}

<div class="disco-grid">
{% for song in sorted_songs %}
  <div class="disco-card journal-entry-animate">
    <a href="{{ song.url | relative_url }}" class="disco-card-image">
      <img src="https://img.youtube.com/vi/{{ song.youtube_id }}/sddefault.jpg" alt="{{ song.title }} thumbnail">
    </a>
    <div class="disco-card-content">
      <p class="disco-card-title">
        <a href="{{ song.url | relative_url }}">{{ song.title }}</a>
      </p>
      <time datetime="{{ song.date | date: '%Y-%m-%d' }}" class="disco-card-date">
        {{ song.date | date: "%Y年%m月%d日" }}
      </time>
    </div>
  </div>
{% endfor %}
</div>