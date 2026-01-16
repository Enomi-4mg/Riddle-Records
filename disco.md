---
layout: page
title: "曲"
---

# 曲

{% assign sorted_songs = site.songs | sort: 'date' | reverse %}

<ul class="gallery_item">
{% for song in sorted_songs %}
  <li class="gallery_gap">
    <a href="{{ song.url }}">
      <img src="https://img.youtube.com/vi/{{ song.youtube_id }}/sddefault.jpg" alt="{{ song.title }} thumbnail" style="width: 100%; max-width: 320px;">
    </a>
    <p class="work_title" style="margin-top: 0.5rem;">
      <a href="{{ song.url }}">{{ song.title }}</a>
    </p>
    <time datetime="{{ song.date | date: '%Y-%m-%d' }}" style="color: #666; font-size: 0.9rem; display: block;">
      {{ song.date | date: "%Y年%m月%d日" }}
    </time>
  </li>
{% endfor %}
</ul>