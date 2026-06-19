'use strict';

const PAGE_TRANSITION = {
  descendMs: 600,
  settleMs: 100,
  imagePreloadTimeoutMs: 1500
};

let isNavigating = false;

// AJAX page transition
async function loadPageContent(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load page');

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract main element (including its classes)
    const newMain = doc.querySelector('main');
    const currentMain = document.querySelector('main');

    if (newMain && currentMain) {
      // Preload images BEFORE inserting into DOM
      await preloadImages(newMain);

      // Replace the entire main element to preserve classes
      currentMain.className = newMain.className;
      currentMain.innerHTML = newMain.innerHTML;

      // Update page title
      const newTitle = doc.querySelector('title');
      if (newTitle) {
        document.title = newTitle.textContent;
      }

      // Scroll to top
      window.scrollTo(0, 0);

      return true;
    }
  } catch (error) {
    console.error('AJAX load error:', error);
    return false;
  }
}

// Preload images before inserting into DOM (highest priority)
function preloadImages(container) {
  const images = container.querySelectorAll('img');
  if (images.length === 0) {
    return Promise.resolve();
  }

  const promises = Array.from(images).map(img => {
    return new Promise((resolve) => {
      const preloadImg = new Image();

      const timeout = setTimeout(() => {
        resolve();
      }, PAGE_TRANSITION.imagePreloadTimeoutMs);

      preloadImg.onload = () => {
        clearTimeout(timeout);
        resolve();
      };

      preloadImg.onerror = () => {
        clearTimeout(timeout);
        resolve();
      };

      // Start loading with highest priority
      preloadImg.loading = 'eager';
      preloadImg.fetchpriority = 'high';
      preloadImg.src = img.src;
    });
  });

  return Promise.all(promises);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForCurtainAnimation(curtain, animationName) {
  return new Promise(resolve => {
    const handleAnimationEnd = (event) => {
      if (event.animationName !== animationName) return;
      curtain.removeEventListener('animationend', handleAnimationEnd);
      resolve();
    };

    curtain.addEventListener('animationend', handleAnimationEnd);
  });
}

// Get page category from URL
function getPageCategory(url) {
  const path = getSitePath(url);

  if (path === '/' || path.endsWith('/index.html')) return 'home';
  if (path.includes('/about')) return 'about';
  if (path.includes('/journal')) return 'journal'; // Includes both /journal.html and /journal/YYYY-MM-DD/
  if (path.includes('/works') || path.includes('/gallery') || path.includes('/disco')) return 'works';
  if (path.includes('/project')) return 'project';
  if (path.includes('/info')) return 'info';

  return 'other';
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

function shouldUseNormalNavigation(url) {
  const target = new URL(url, window.location.origin);

  return (
    target.origin !== window.location.origin ||
    target.pathname.includes('/tools/') ||
    target.hash && target.pathname === window.location.pathname
  );
}

function resetCurtain(curtain) {
  curtain.classList.remove('ascending', 'initial', 'descending');
  curtain.style.transform = 'translateY(-100%)';
  void curtain.offsetHeight;
  curtain.style.transform = '';
}

async function runCurtainTransition(curtain, beforeAscend) {
  resetCurtain(curtain);
  curtain.classList.add('descending');

  await Promise.all([
    waitForCurtainAnimation(curtain, 'curtainDescend'),
    wait(PAGE_TRANSITION.descendMs)
  ]);

  const result = await beforeAscend();
  await wait(PAGE_TRANSITION.settleMs);

  curtain.classList.remove('descending');
  curtain.classList.add('ascending');
  await waitForCurtainAnimation(curtain, 'curtainAscend');
  return result;
}

async function navigateTo(url, options = {}) {
  if (isNavigating) return;

  const target = new URL(url, window.location.origin);
  const current = new URL(window.location.href);

  if (target.href === current.href) {
    options.closeSidebar?.();
    return;
  }

  if (shouldUseNormalNavigation(target.href)) {
    return;
  }

  const curtain = document.querySelector('.transition-curtain');
  const isCategoryChange = getPageCategory(current.href) !== getPageCategory(target.href);
  isNavigating = true;
  options.closeSidebar?.();

  try {
    if (curtain && isCategoryChange) {
      const success = await runCurtainTransition(curtain, async () => {
        const loaded = await loadPageContent(target.href);
        if (loaded && options.pushState !== false) {
          window.history.pushState({ url: target.href }, '', target.href);
        }
        return loaded;
      });

      if (!success) {
        window.location.href = target.href;
        return;
      }

      initializeEventListeners();
      initScrollAnimations();
      return;
    }

    const success = await loadPageContent(target.href);
    if (success) {
      if (options.pushState !== false) {
        window.history.pushState({ url: target.href }, '', target.href);
      }
      initializeEventListeners();
      initScrollAnimations();
    } else {
      window.location.href = target.href;
    }
  } finally {
    isNavigating = false;
  }
}

// Update navigation active state based on current URL
function updateNavigationActiveState() {
  const currentCategory = getPageCategory(window.location.href);
  const navLinks = document.querySelectorAll('.site-header a, .sidebar a');

  // Remove active class from all links
  navLinks.forEach(link => {
    link.classList.remove('active');
  });

  // Add active class to the matching link
  navLinks.forEach(link => {
    const href = link.getAttribute('href');

    if (href && currentCategory === getPageCategory(href)) {
      link.classList.add('active');
    }
  });
}

// Wait for all images in container to load
// Initialize event listeners for links
function initializeEventListeners() {
  const links = document.querySelectorAll('a');

  // Update sidebar active state
  updateNavigationActiveState();

  // Initialize gallery features if they exist on this page
  if (typeof initGallery === 'function') {
    initGallery();
  }

  initializeJournalFeatures();

  // Initialize copy buttons for code blocks
  initializeCopyButtons();

  links.forEach(link => {
    // Skip if already has listener (check by a custom attribute)
    if (link.dataset.listenerAdded) return;

    // Skip external links, anchor links, and download links
    if (
      link.target === '_blank' ||
      link.href.includes('://') && !link.href.includes(window.location.origin) ||
      link.href.startsWith('#') ||
      link.download
    ) {
      return;
    }

    link.addEventListener('click', async (e) => {
      if (!link.href || link.href === '#') return;
      if (shouldUseNormalNavigation(link.href)) return;

      e.preventDefault();
      await navigateTo(link.href, {
        closeSidebar: () => document.querySelector('.sidebar')?.classList.remove('show')
      });
    });

    link.dataset.listenerAdded = 'true';
  });
}

function getSiteBaseUrl() {
  return typeof window.siteBaseUrl === 'string' ? window.siteBaseUrl : '/';
}

function buildSiteUrl(path) {
  const base = getSiteBaseUrl();
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

function getCloudinaryIdFromImage(src) {
  if (typeof src !== 'string') return null;

  // Extract Cloudinary public ID (filename) from image URLs.
  // Handles both legacy `/v1/...` URLs and newer transformation-only URLs by
  // matching everything after `/image/upload/`, skipping any leading path
  // segments (version or transformation strings), and capturing the final
  // filename segment.
  // Examples:
  //   https://res.cloudinary.com/.../image/upload/v1/result-4_qptaza.gif  → result-4_qptaza.gif
  //   https://res.cloudinary.com/.../image/upload/w_1920,c_fill/result-4_qptaza.gif  → result-4_qptaza.gif
  const match = src.match(/\/image\/upload\/(?:[^/]+\/)*([^?]+)/);
  return match ? match[1] : null;
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
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
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

  const contentWorksSet = new Set();
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

    const cloudinaryId = getCloudinaryIdFromImage(img.src);
    const galleryItem = cloudinaryId && Array.isArray(window.galleryData)
      ? window.galleryData.find((item) => item.cloudinary_id === cloudinaryId)
      : null;

    if (!galleryItem || !cloudinaryId) {
      return;
    }

    contentWorksSet.add(cloudinaryId);

    const parent = img.parentNode;
    const alreadyHasButton = parent?.nextElementSibling?.classList.contains('gallery-link-btn')
      || img.nextElementSibling?.classList.contains('gallery-link-btn');

    if (!alreadyHasButton && parent) {
      const btn = document.createElement('a');
      btn.href = buildSiteUrl(`/gallery/#${slugifyCloudinaryId(cloudinaryId)}`);
      btn.className = 'gallery-link-btn';
      btn.textContent = '📸 ギャラリーで見る';
      parent.insertAdjacentElement('afterend', btn);
    }
  });

  const contentWorksDiv = document.getElementById('content-related-works');
  const grid = document.getElementById('content-works-grid');
  if (contentWorksDiv && grid && contentWorksSet.size > 0) {
    contentWorksSet.forEach((cloudinaryId) => {
      const item = Array.isArray(window.galleryData)
        ? window.galleryData.find((candidate) => candidate.cloudinary_id === cloudinaryId)
        : null;

      if (!item) return;

      const link = document.createElement('a');
      link.href = buildSiteUrl(`/gallery/#${slugifyCloudinaryId(cloudinaryId)}`);
      link.className = 'related-item';
      link.innerHTML = `
        <img src="https://res.cloudinary.com/dzq8y9qes/image/upload/w_200,h_200,c_fill,q_auto,f_auto/v1/${cloudinaryId}"
             alt="${item.title || '作品'}"
             loading="lazy">
        <p>${item.title || cloudinaryId}</p>
      `;
      grid.appendChild(link);
    });

    if (grid.children.length > 0) {
      contentWorksDiv.hidden = false;
    }
  }

  if (typeof window.checkRelatedWorks === 'function') {
    window.checkRelatedWorks();
  }

  if (article.dataset.useMath === 'true') {
    ensureMathJax()
      .then((mathJax) => mathJax.typesetPromise?.([article]))
      .catch((error) => console.error(error));
  }
}

function initializePage() {
  const curtain = document.querySelector('.transition-curtain');

  // Only show transition on true initial page load (not if already hidden)
  if (curtain && !curtain.hasAttribute('data-hidden')) {
    // Wait for curtain to finish ascending before showing content
    curtain.addEventListener('animationend', function onAscendComplete(e) {
      if (e.animationName === 'curtainAscend') {
        // Curtain has finished ascending, now trigger content animations
        initScrollAnimations();
        curtain.removeEventListener('animationend', onAscendComplete);
      }
    });

    setTimeout(() => {
      curtain.classList.remove('initial');
      curtain.classList.add('ascending');
    }, 100);
  } else {
    // No curtain transition, start animations immediately
    initScrollAnimations();
  }

  // Initialize event listeners
  initializeEventListeners();
}

function onDocumentReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

// Page transition effect on initial load
onDocumentReady(initializePage);

// Handle browser back/forward buttons
window.addEventListener('popstate', async (e) => {
  // No transition animation on back/forward navigation
  const url = window.location.href;
  const success = await loadPageContent(url);
  if (success) {
    initializeEventListeners();
    initScrollAnimations();
  }
});

// Sidebar toggle and link handling
const toggleButton = document.querySelector('.menu_toggle');
const sidebar = document.querySelector('.sidebar');

if (toggleButton && sidebar) {
  toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('show');
  });
}

// Close sidebar when clicking on overlay
document.addEventListener('click', (e) => {
  // Check if sidebar is open and click is outside the sidebar and toggle button
  if (sidebar && sidebar.classList.contains('show')) {
    if (!sidebar.contains(e.target) && !toggleButton?.contains(e.target)) {
      sidebar.classList.remove('show');
    }
  }
});

// Intersection Observer: Trigger animation when element enters viewport
function initScrollAnimations() {
  // Select manually animated elements
  const manualEntries = document.querySelectorAll('.journal-entry-animate');

  // Select auto-animated elements (article content and main direct children)
  // Exclude script, style, and already animated elements
  const autoEntries = document.querySelectorAll(`
    article.post > *:not(script):not(style):not(.journal-entry-animate),
    main > *:not(article):not(script):not(style):not(.gallery-grid):not(.related-grid):not(.journal-entry-animate)
  `);

  const entries = [...manualEntries, ...autoEntries];

  if (entries.length === 0) return;

  // Intersection Observer for scroll-triggered animations
  const observer = new IntersectionObserver(function(elements) {
    elements.forEach(function(element) {
      if (element.isIntersecting) {
        // Add visible class to trigger animation
        element.target.classList.add('visible');
        // Stop observing this element (animation plays once)
        observer.unobserve(element.target);
      }
    });
  }, {
    threshold: 0.05,  // Trigger when 5% of element is visible (earlier trigger)
    rootMargin: '0px 0px -30px 0px'
  });

  // Immediately animate elements already in viewport
  entries.forEach(function(entry, index) {
    // Ensure opacity is 0 initially for auto-detected elements (in case CSS didn't catch it)
    if (!entry.classList.contains('journal-entry-animate') && !entry.classList.contains('visible')) {
        entry.style.opacity = '0';
    }

    const rect = entry.getBoundingClientRect();
    const isInViewport = (
      rect.top >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
    );

    if (isInViewport) {
      // Element is already visible, animate immediately
      entry.classList.add('visible');
      // Reset inline opacity so CSS animation takes over
      entry.style.opacity = '';
    } else {
      // Element not in viewport, observe for scroll trigger
      observer.observe(entry);
    }
  });
}

// Initialize copy buttons for code blocks
function initializeCopyButtons() {
  // Get all code blocks in post and main container
  const codeBlocks = document.querySelectorAll('.post pre:not([data-copy-button-added]), main.container pre:not([data-copy-button-added])');

  codeBlocks.forEach(pre => {
    // Mark this element as processed
    pre.setAttribute('data-copy-button-added', 'true');

    // Create copy button
    const button = document.createElement('button');
    button.className = 'copy-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Copy code');

    // Insert button into pre element
    pre.appendChild(button);

    // Add click event listener
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        // Get code text (excluding the button)
        const codeElement = pre.querySelector('code');
        const codeText = codeElement ? codeElement.textContent : pre.textContent;

        // Copy to clipboard
        await navigator.clipboard.writeText(codeText);

        // Show feedback
        button.classList.add('copied');

        // Remove feedback after 2 seconds
        setTimeout(() => {
          button.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
        button.classList.add('error');
        setTimeout(() => {
          button.classList.remove('error');
        }, 2000);
      }
    });
  });
}



