---
layout: default
title: "Journal"
---

<h1 class="web_title">{{ page.title }}</h1>

{% assign sorted_entries = site.diary | sort: 'date' | reverse %}

{% for entry in sorted_entries %}
  <article class="diary-entry" style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #ccc;">
    <h2>
      <a href="{{ entry.url | relative_url }}">{{ entry.title }}</a>
    </h2>
    
    <time datetime="{{ entry.date | date: '%Y-%m-%d' }}" style="color: #666; font-size: 0.9rem;">
      {{ entry.date | date: "%Y年%m月%d日" }}
    </time>
    
    {% if entry.excerpt %}
      <p style="margin-top: 0.5rem; color: #555;">
        {{ entry.excerpt | strip_html | truncatewords: 30 }}
      </p>
    {% endif %}
  </article>
{% endfor %}