---
layout: default
title: "Journal"
---

<div style="max-width: 900px; margin: 0 auto; padding: 0 1rem;">
  <h1 class="web_title">{{ page.title }}</h1>

  {% assign sorted_entries = site.diary | sort: 'date' | reverse %}

  {% for entry in sorted_entries %}
    {% assign thumbnail_image = nil %}
    {% assign found_thumbnail = false %}
    
    <!-- Find thumbnail by thumbnail_class if specified in entry -->
    {% if entry.thumbnail_class %}
      {% for gallery_item in site.data.gallery %}
        {% if gallery_item.thumbnail_class == entry.thumbnail_class %}
          {% if gallery_item.article_url and gallery_item.article_url != "" %}
            {% if entry.url contains gallery_item.article_url %}
              {% assign thumbnail_image = gallery_item %}
              {% assign found_thumbnail = true %}
              {% break %}
            {% endif %}
          {% endif %}
        {% endif %}
      {% endfor %}
    {% endif %}
    
    <!-- Fallback: Find the first thumbnail image for this diary entry -->
    {% if found_thumbnail == false %}
      {% for gallery_item in site.data.gallery %}
        {% if gallery_item.article_url and gallery_item.article_url != "" and gallery_item.thumbnail == true %}
          {% if entry.url contains gallery_item.article_url %}
            {% assign thumbnail_image = gallery_item %}
            {% assign found_thumbnail = true %}
            {% break %}
          {% endif %}
        {% endif %}
      {% endfor %}
    {% endif %}
    
    <div class="diary-entry-animate" style="display: flex; gap: 1.5rem; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #e0e0e0;">
      <!-- Thumbnail -->
      <a href="{{ entry.url | relative_url }}" style="flex-shrink: 0;">
        {% if found_thumbnail %}
          <img src="{{ site.cloudinary_url }}/{{ thumbnail_image.cloudinary_id }}" 
               alt="{{ thumbnail_image.title }}" 
               style="width: 160px; height: 130px; object-fit: cover; border-radius: 4px;"
               loading="lazy">
        {% else %}
          <img src="{{ site.baseurl }}/favicon/icon.jpg" 
               alt="Placeholder" 
               style="width: 160px; height: 130px; object-fit: cover; border-radius: 4px;"
               loading="lazy">
        {% endif %}
      </a>
      
      <!-- Content -->
      <div style="flex: 1;">
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.5rem;">
          <a href="{{ entry.url | relative_url }}">{{ entry.title }}</a>
        </h3>
        <div style="color: #666; font-size: 1.1rem; margin-bottom: 0.7rem;">
          {{ entry.date | date: "%Y年%m月%d日" }}
        </div>
        {% if entry.excerpt %}
          <p style="margin: 0; color: #555; font-size: 1.15rem; line-height: 1.6;">
            {{ entry.excerpt | strip_html | truncatewords: 25 }}
          </p>
        {% endif %}
      </div>
    </div>
  {% endfor %}
</div>