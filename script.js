'use strict';

const MATHJAX_SRC = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
const MATHJAX_INTEGRITY = 'sha512-tiaNmAzpy3KcgtuiLwT9WSlSsqGqtDB5ylMwxoqG5ysNIyzkBw24k6UFTuXGgyXJLJ8aM/ho1h67NRKedPx++Q==';

function getSiteBaseUrl() {
  return typeof window.siteBaseUrl === 'string' ? window.siteBaseUrl : '/';
}

function buildSiteUrl(path) {
  const base = getSiteBaseUrl();
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

function getSitePath(url) {
  const path = new URL(url, window.location.origin).pathname;
  const basePath = getSiteBaseUrl();
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;

  if (basePath !== '/' && path === basePath.replace(/\/$/, '')) {
    return '/';
  }

  if (normalizedBase !== '/' && path.startsWith(normalizedBase)) {
    return `/${path.slice(normalizedBase.length)}`;
  }

  return path;
}

function getPageCategory(url) {
  const path = getSitePath(url);

  if (path === '/' || path.endsWith('/index.html')) return 'home';
  if (path.includes('/about')) return 'about';
  if (path.includes('/journal')) return 'journal';
  if (path.includes('/works') || path.includes('/gallery') || path.includes('/disco')) return 'works';
  if (path.includes('/project')) return 'project';
  if (path.includes('/info')) return 'info';

  return 'other';
}

function updateNavigationActiveState() {
  const currentCategory = getPageCategory(window.location.href);
  const navLinks = document.querySelectorAll('.site-header a, .sidebar a');

  navLinks.forEach((link) => {
    link.classList.toggle('active', currentCategory === getPageCategory(link.href));
  });
}

function getCloudinaryIdFromImage(src) {
  if (typeof src !== 'string') return null;

  const match = src.match(/\/image\/upload\/(?:[^/]+\/)*([^?]+)/);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]).split('/').pop();
  } catch {
    return match[1].split('/').pop();
  }
}

function normalizeGalleryImageId(value) {
  return typeof value === 'string' ? value.split('/').pop() : '';
}

function slugifyCloudinaryId(cloudinaryId) {
  return cloudinaryId.replace(/\./g, '-');
}

function ensureMathJax() {
  if (window.MathJax?.typesetPromise) {
    return Promise.resolve(window.MathJax);
  }

  if (window.__mathJaxPromise) {
    return window.__mathJaxPromise;
  }

  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true
    },
    options: {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
    }
  };

  window.__mathJaxPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MATHJAX_SRC;
    script.async = true;
    script.integrity = MATHJAX_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(window.MathJax);
    script.onerror = () => reject(new Error('Failed to load MathJax'));
    document.head.appendChild(script);
  });

  return window.__mathJaxPromise;
}

function initializeJournalFeatures() {
  const article = document.querySelector('article.post.journal-article');
  if (!article) return;

  const contentContainer = article.querySelector('.post-content');
  if (!contentContainer) return;

  const images = contentContainer.querySelectorAll('img');

  images.forEach((img) => {
    if (img.classList.contains('no-gallery-button') || img.closest('.no-gallery-button')) {
      return;
    }

    if (img.parentNode?.tagName !== 'A' && !img.hasAttribute('data-lightbox')) {
      const link = document.createElement('a');
      link.href = img.src;
      link.setAttribute('data-lightbox', 'diary');
      link.setAttribute('data-title', img.alt || '');
      img.parentNode.insertBefore(link, img);
      link.appendChild(img);
    }

    const imageId = getCloudinaryIdFromImage(img.src);
    const galleryItem = imageId && Array.isArray(window.galleryData)
      ? window.galleryData.find((item) => normalizeGalleryImageId(item.image) === imageId)
      : null;

    if (!galleryItem) {
      return;
    }

    const parent = img.parentNode;
    const alreadyHasButton = parent?.nextElementSibling?.classList.contains('gallery-link-btn')
      || img.nextElementSibling?.classList.contains('gallery-link-btn');

    if (!alreadyHasButton && parent) {
      const btn = document.createElement('a');
      btn.href = buildSiteUrl(`/gallery/#${slugifyCloudinaryId(galleryItem.image)}`);
      btn.className = 'gallery-link-btn';
      btn.textContent = '📸 ギャラリーで見る';
      parent.insertAdjacentElement('afterend', btn);
    }
  });

  if (typeof window.checkRelatedWorks === 'function') {
    window.checkRelatedWorks();
  }

  if (article.dataset.useMath === 'true') {
    ensureMathJax()
      .then((mathJax) => mathJax.typesetPromise?.([article]))
      .catch((error) => console.error(error));
  }
}

function initScrollAnimations() {
  const manualEntries = document.querySelectorAll('.journal-entry-animate');
  const autoEntries = document.querySelectorAll(`
    article.post > *:not(script):not(style):not(.journal-entry-animate),
    main > *:not(article):not(script):not(style):not(.gallery-grid):not(.related-grid):not(.journal-entry-animate)
  `);
  const entries = [...manualEntries, ...autoEntries];

  if (entries.length === 0) return;

  const observer = new IntersectionObserver((elements) => {
    elements.forEach((element) => {
      if (element.isIntersecting) {
        element.target.classList.add('visible');
        observer.unobserve(element.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px -30px 0px'
  });

  entries.forEach((entry) => {
    if (!entry.classList.contains('journal-entry-animate') && !entry.classList.contains('visible')) {
      entry.style.opacity = '0';
    }

    const rect = entry.getBoundingClientRect();
    const isInViewport = rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);

    if (isInViewport) {
      entry.classList.add('visible');
      entry.style.opacity = '';
    } else {
      observer.observe(entry);
    }
  });
}

function initializeCopyButtons() {
  const codeBlocks = document.querySelectorAll('.post pre:not([data-copy-button-added]), main.container pre:not([data-copy-button-added])');

  codeBlocks.forEach((pre) => {
    pre.setAttribute('data-copy-button-added', 'true');

    const button = document.createElement('button');
    button.className = 'copy-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Copy code');

    pre.appendChild(button);

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        const codeElement = pre.querySelector('code');
        const codeText = codeElement ? codeElement.textContent : pre.textContent;
        await navigator.clipboard.writeText(codeText);
        button.classList.add('copied');
        setTimeout(() => button.classList.remove('copied'), 2000);
      } catch (error) {
        console.error('Failed to copy code:', error);
        button.classList.add('error');
        setTimeout(() => button.classList.remove('error'), 2000);
      }
    });
  });
}

function initializeCurtain() {
  const curtain = document.querySelector('.transition-curtain');
  if (!curtain || curtain.dataset.initialized === 'true') return;

  curtain.dataset.initialized = 'true';
  curtain.addEventListener('animationend', function onAscendComplete(event) {
    if (event.animationName === 'curtainAscend') {
      initScrollAnimations();
      curtain.removeEventListener('animationend', onAscendComplete);
    }
  });

  setTimeout(() => {
    curtain.classList.remove('initial');
    curtain.classList.add('ascending');
  }, 100);
}

function initializePage() {
  updateNavigationActiveState();

  if (typeof initGallery === 'function') {
    initGallery();
  }

  initializeJournalFeatures();
  initializeCopyButtons();
  initializeCurtain();
  initScrollAnimations();
}

function onDocumentReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

if (!window.__riddleSiteListenersInitialized) {
  window.__riddleSiteListenersInitialized = true;

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const sidebar = document.querySelector('.sidebar');
    const toggleButton = target?.closest('.menu_toggle');

    if (toggleButton && sidebar) {
      sidebar.classList.toggle('show');
      return;
    }

    if (!sidebar?.classList.contains('show')) {
      return;
    }

    if (target?.closest('.sidebar a')) {
      sidebar.classList.remove('show');
      return;
    }

    if (!target?.closest('.sidebar') && !target?.closest('.menu_toggle')) {
      sidebar.classList.remove('show');
    }
  });

  document.addEventListener('astro:page-load', initializePage);
}

onDocumentReady(initializePage);
