# Riddle Records

This is the portfolio site for **4mg**, featuring a collection of diaries, music, illustrations, and information.

- 🎵 Vocaloid Music Releases
- 📔 Activity Logs & Reports
- 🎨 Illustration & Artwork Gallery
- 👤 Profile & Information

---

# 📍 Public Information

## Site Structure

You can access the following pages from the top page:

- **Journal (Journal.md)** - Activity logs and reports
- **Music (disco.md)** - A list of music works
- **Gallery (gallery.html)** - An illustration and artwork gallery
- **Profile (about.html)** - About 4mg
- **Info (info.html)** - Other information

---

## 🎨 Gallery Features

- **Sort by Date**: Arrange works in "Newest" or "Oldest" order.
- **Category Filter**: Filter by three categories: Illustration, 3DCG, and Photography.
- **Lightbox View**: Click on an image to open it in a modal view (close with the ESC key).
- **Related Article Links**: Links to related articles and making-of posts.

---

## 🔗 Gallery & Journal Integration

The Gallery and Journal are closely integrated, allowing you to browse works and articles seamlessly.

### Key Features

- **Gallery → Journal**: Link from each artwork card to related articles and making-of posts.
- **Journal → Gallery**: A "📸 View in Gallery" button is automatically displayed for images used in articles.
- **Related Works**: A section for related works is automatically displayed at the end of article pages.

---

---

# 🔧 For Developers & Administrators

## 🚀 Setup

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/miyas/Riddle-Records.git
cd Riddle-Records

# 2. Ensure Ruby and Bundler are installed
ruby --version  # Ruby 2.7.0 or higher
bundler --version

# 3. Install dependencies
bundle install

# 4. Start the local server
bundle exec jekyll serve

# 5. Open in your browser
# Open http://localhost:4000/Riddle-Records/
```

---

## 🛠️ Development Guide

### Directory Structure

```bash
Riddle-Records/
├─ _layouts/                    ← Templates (page structure)
│   ├─ default.html              ← Base template for all pages
│   └─ post.html                 ← For journal and song pages
│
├─ _includes/                   ← Reusable components
│   ├─ header.html               ← Hamburger menu button
│   ├─ sidebar.html              ← Navigation menu
│   └─ footer.html               ← Page footer
│
├─ _journal/                      ← Journal content (Markdown)
├─ _songs/                      ← Music work data (Markdown)
├─ _data/gallery.yml            ← Gallery artwork data
│
├─ assets/
│   ├─ css/                      ← Stylesheets
│   └─ js/                       ← JavaScript features
│
├─ jpg/, png/                    ← Local images
├─ favicon/                      ← Favicon
├─ tools/                        ← Image management tools
│
├─ _site/                       ← Built site (auto-generated, excluded from Git)
├─ _config.yml                  ← Jekyll configuration file
├─ Gemfile                      ← Ruby dependencies
├─ .gitignore                   ← Git ignore file settings
└─ script.js                    ← JavaScript for hamburger menu control
```

### Basic Jekyll (Liquid) Syntax

```liquid
{# Comment #}

{{ variable }}                          ← Display a variable
{{ variable | filter }}                 ← Process with a filter
{{ site.title }}                        ← Value from _config.yml
{{ page.title }}                        ← Front matter value from a page

{% if condition %}                      ← Conditional branch
  content
{% endif %}

{% for item in collection %}            ← Loop
  {{ item.name }}
{% endfor %}

{% include file.html %}                 ← Embed a file
```

### Commonly Used Filters

```liquid
{{ entry.date | date: "%Y-%m-%d" }}     ← Format date
{{ text | truncatewords: 30 }}             ← Display first 30 words
{{ html | strip_html }}                    ← Remove HTML tags
{{ array | sort: 'field' }}                ← Sort by a field
{{ array | reverse }}                      ← Reverse an array
```

### Important Notes

- Folders starting with `_` (e.g., `_layouts`) are special Jekyll folders.
- `_site/` is auto-generated, so do not edit it manually.
- The `legacy/` folder is not included on GitHub Pages (recommended to exclude via `.gitignore`).

---

## 📚 Content Management

### 📝 Adding a New Journal Entry

1. **Create the entry file**
   - Name the file according to the following conventions:
     - **Standard Entry:** `YYYY-MM-DD.md`
     - **Making-of Entry:** `YYYY-MM-DD-[artwork-name]-making.md`
   - Example: `_journal/2026-01-17.md` or `_journal/2025-06-06-five-apples-making.md`.
   - The date in the filename must match the `date` in the front matter.

2. **Write the front matter**
   ```yaml
   ---
   layout: post
   title: "Your Title Here"
   date: 2026-01-17
   featured_related:
     - "cloudinary_id1.png"  # Manually specify a gallery work (optional)
   ---
   ```

3. **Write the content**
   - Use Markdown for formatting.
   - Images: `{{ site.cloudinary_url }}/w_800,q_auto,f_auto/v1/<cloudinary_id>.jpg`
   - Videos: Paste `<iframe>` embed code directly.

4. **Preview locally (optional)**
   ```bash
   bundle exec jekyll serve
   ```

5. **Commit & Push**
   ```bash
   git add _journal/2026-01-17.md
   git commit -m "Add Journal 2026-01-17"
   git push origin main
   ```

---

### ✍️ Using LaTeX in Journal Entries

You can embed mathematical formulas in your journal entries using LaTeX syntax, powered by MathJax.

1.  **Enable MathJax in the Front Matter**
    - To use LaTeX in an article, add `use_math: true` to the front matter of the markdown file.

    ```yaml
    ---
    layout: post
    title: "My Article with Math"
    date: 2026-01-30
    use_math: true
    ---
    ```

2.  **Write LaTeX Code**
    - **Inline Math**: Wrap your formula with a single dollar sign (`$`).
      - Example: `This is an inline formula: $E = mc^2$.`
    - **Block Math**: Wrap your formula with double dollar signs (`$$`).
      - Example:
        ```
        This is a block formula:
        $$
        \int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
        $$
        ```

This feature is configured in `_layouts/post.html` to load the MathJax script only when `page.use_math` is set to `true`.

---

### 🎨 Adding New Artwork to the Gallery

1. **Upload to Cloudinary**
   - Log in to the [Cloudinary Dashboard](https://cloudinary.com/console).
   - Upload the image.
   - Note the Public ID (e.g., `my_artwork_abc123.png`).

2. **Add an entry to `_data/gallery.yml`**
   ```yaml
   - title: "Artwork Title"
     date: 2026-01-17
     cloudinary_id: "your_public_id.png"  # Include the extension
     description: "Description of the artwork"
     categories:
       - "Illustration"  # Illustration / 3DCG / Photography
     article_url: "/Journal/2026-01-17/"  # Related article (optional)
     making_article_url: "/Journal/2026-01-17/making/"  # Making-of article (optional)
     thumbnail: true  # To display as a thumbnail in the Journal list (optional)
   ```

3. **Commit & Push**
   ```bash
   git add _data/gallery.yml
   git commit -m "Add new artwork to gallery"
   git push origin main
   ```

**YAML Notes:**
- Indentation: Use 2 spaces (no tabs).
- Quotes: Use double quotes `"` consistently.
- Relative Paths: Start with `/`.
- Multiple Categories: Add them as an array.

---

### 🖼️ Displaying Thumbnails in the Journal List

On the Journal list page (`Journal.md`), you can display thumbnails for each entry.

#### How Thumbnails Work

**Method 1: Specify with a Thumbnail Class (Recommended)**

1. **Add `thumbnail_class` to `_data/gallery.yml`**
   ```yaml
   - title: "Thumbnail Image"
     cloudinary_id: "thumbnail_abc123.png"
     thumbnail_class: "Journal-thumb"  # ← Custom class
     article_url: "/Journal/2025-06-06/"
     # You can omit categories if it's not meant to be in the gallery
   ```

2. **Specify the class in the Journal entry's front matter**
   ```yaml
   ---
   layout: post
   title: "Article Title"
   date: 2025-06-06
   thumbnail_class: "Journal-thumb"  # ← Specify the class to use
   ---
   ```

3. **Matching**: The image with the matching `thumbnail_class` will be used as the thumbnail.

**Method 2: Default Thumbnail (Fallback)**

1. **Add `thumbnail: true` to `_data/gallery.yml`**
   ```yaml
   - title: "Artwork Title"
     date: 2025-06-06
     cloudinary_id: "artwork_abc123.png"
     categories: ["Illustration"]
     article_url: "/Journal/2025-06-06/"
     thumbnail: true  # ← Default thumbnail
   ```

2. **Matching**: If `thumbnail_class` is not specified, the image with `thumbnail: true` will be used.

**Image Fallback**
- If no matching image is found, `/favicon/icon.jpg` will be used as a placeholder.

#### Easy Setup with a Tool

You can use **Journal-card-generator.html** to set the thumbnail flag via a GUI:

1. Open `tools/Journal-card-generator.html` in a browser.
2. Fill in the card information.
3. Check "Target for thumbnail (display in Journal list)".
4. Copy the generated YAML and add it to `_data/gallery.yml`.

#### Key Points

- **Priority**: `thumbnail_class` > `thumbnail: true` > Placeholder.
- **URL Matching**: The `article_url` in `gallery.yml` must match the Journal entry's URL.
- **Flexible Usage**: 
  - Use different images for the gallery and for thumbnails.
  - Set up thumbnail-only images (not displayed in the gallery).
  - Reuse the same thumbnail class for multiple articles.
- **Cloudinary URL**: The `_plugins/cloudinary.rb` custom filter automatically generates the URL.

---

### 📖 Creating a Making-of Article

Filename: `_journal/YYYY-MM-DD-[artwork-name]-making.md` (e.g., `2025-06-06-five-apples-making.md`)

```yaml
---
layout: post
title: "Five Apples - Making Of"
date: 2025-06-06
permalink: /Journal/2025-06-06/five-apples-making/
---

## Production Process

...Making-of content...
```

---

## 🖼️ Cloudinary Image Management Guide

- **Configuration**: `cloudinary_cloud_name` and `cloudinary_url` are defined in `_config.yml`.
- **Reference**: Use `{{ site.cloudinary_url }}`.
- **Upload Destination**: `riddle-records/jpg/...` or `riddle-records/png/...`
- **For Articles**: `{{ site.cloudinary_url }}/w_800,q_auto,f_auto/v1/<cloudinary_id>.jpg` (800px width)
- **Thumbnails**: `{{ site.cloudinary_url }}/w_400,h_400,c_fill,q_auto,f_auto/v1/<cloudinary_id>.jpg` (square)

**Troubleshooting:**
- Image not displaying → Check if `cloudinary_id` is correct / check the extension.
- 404 error → Ensure URLs are consistent (use `relative_url` or absolute Cloudinary URL).
- iframe warning → Use `allow="fullscreen"` consistently (Spotify warning is by design).

---

## 🔄 Automatic Deployment with GitHub Actions

This site is automatically deployed via `.github/workflows/jekyll.yml`.

### Deployment Flow

1. `git push` to the `main` branch.
2. GitHub Actions starts automatically.
3. A Jekyll build is executed.
4. The site is deployed to GitHub Pages.

### Checking Deployment Status

You can check the build status in the **Actions** tab of the repository.

---

## 🛠️ Development Tools

### Image Compression Tool

[tools/image-compressor.html](tools/image-compressor.html) - Compress images in the browser.

**Features:**
- 📦 Fully offline processing (uses ImageMagick WASM).
- 🎯 Supported formats: JPEG, PNG, GIF, BMP, TIFF.
- ⚡ Batch processing (up to 3 in parallel).
- 🎨 Advanced settings: Quality adjustment, progressive JPEG, metadata removal.

**Recommended Settings:**
- **Web Images**: JPEG quality 75-85, progressive enabled.
- **Illustrations/Transparent PNGs**: PNG quality 85, no color limit.
- **Photo Archives**: JPEG quality 90-95.

### Cloudinary URL Converter

[tools/cloudinary-url-converter.html](tools/cloudinary-url-converter.html) - Extract the Public ID from a Cloudinary URL.

### Journal Card Generator

[tools/Journal-card-generator.html](tools/Journal-card-generator.html) - Generate HTML for Journal cards and YAML for `gallery.yml`.

---

## 📸 Journal Image Display Feature

Images in Journal posts are displayed in a uniform card format.

### How to Place Images

#### Single Image

```html
<div class="Journal-card-grid">
  <div class="Journal-card">
    <a href="{{ site.cloudinary_url }}/w_1920,q_auto,f_auto/v1/cloudinary_id.jpg" 
       data-lightbox="Journal" data-title="Image description">
      <img src="{{ site.cloudinary_url }}/w_300,h_300,c_fill,q_auto,f_auto/v1/cloudinary_id.jpg" 
           alt="Image description">
    </a>
    <div class="Journal-card-info">
      <h4>Image Title</h4>
    </div>
  </div>
</div>
```

#### Multiple Image Grid

```html
<div class="Journal-card-grid">
  <div class="Journal-card"><!-- Card 1 --></div>
  <div class="Journal-card"><!-- Card 2 --></div>
  <div class="Journal-card"><!-- Card 3 --></div>
</div>
```

### Key Parameters

| Parameter | Description |
|-----------|------|
| `w_300,h_300,c_fill` | Thumbnail: 300×300px (square) |
| `w_1920,q_auto,f_auto` | Full resolution: 1920px width (for Lightbox) |
| `data-lightbox="Journal"` | Groups images in Lightbox |
| `data-title` | Image description in Lightbox |

### Controlling the "View in Gallery" Button

#### Hide the Button

Add to the front matter:

```yaml
hide_gallery_buttons: true
```

#### Hide the Button for Specific Images

Add the `no-gallery-button` class to the element:

```html
<img class="no-gallery-button" src="..." alt="...">
<div class="Journal-card no-gallery-button">...</div>
<div class="making-comparison-grid no-gallery-button">...</div>
```

---

## 🔗 Gallery & Journal Integration (Detailed)

### Gallery Data Settings (`_data/gallery.yml`)

```yaml
- title: "Artwork Title"
  date: 2025-06-06
  cloudinary_id: "your_image_id.png"
  description: "Description of the artwork"
  categories:
    - "3DCG"
  article_url: "/Journal/2025-06-06/"
  making_article_url: "/Journal/2025-06-06/five-apples-making/"
```

### Article Front Matter (`_journal/*.md`)

```yaml
---
layout: post
title: "May Report"
date: 2025-06-06

featured_related:
  - "five_apples_spot_angle2_xmytbf.png"  # Artwork 1
  - "mt.fuji_b82xur.jpg"                   # Artwork 2
---
```

**Notes:**
- In `featured_related`, specify an array of `cloudinary_id`s from `gallery.yml`.
- It's helpful to add comments (`#`) with artwork names for easier management.
- If not specified, only works with the same date will be automatically displayed.

### Automatic Display of Related Works

The following are automatically displayed at the end of an article page:

- **📌 Featured**: Manually specified related works (`featured_related`).
- **📅 Related Works**: Gallery works with the same date.
- **🎨 Works in this Article**: Images used in the article.
- **📖 Related Articles**: Articles with matching `tags`.

---

## 🚧 Future Improvements

### 1. Automate Permalinks for Making-of Articles
Plan to set up an auto-generation pattern in `_config.yml`.

### 2. Handle Empty `featured_related` Array
Plan to add a conditional branch in the Liquid template.

### 3. Display Related Works in the Sidebar
Considering a feature to always show them while viewing an article.

### 4. Preview Making-of Images in the Gallery
Plan to display making-of images in Gallery cards.

### 5. Unified CMS Management
Considering the introduction of a Headless CMS like Contentful or Forestry.

### 6. Search for Related Works by Tags/Techniques
Plan to cross-link works with the same techniques or themes.

---
