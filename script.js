'use strict';

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
      
      // Re-initialize event listeners for new content
      initializeEventListeners();
      
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
      }, 5000);
      
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

// Get page category from URL
function getPageCategory(url) {
  const path = new URL(url, window.location.origin).pathname;
  
  if (path === '/' || path.endsWith('/index.html')) return 'home';
  if (path.includes('/about')) return 'about';
  if (path.includes('/diary')) return 'diary'; // Includes both /diary.html and /diary/YYYY-MM-DD/
  if (path.includes('/gallery')) return 'gallery';
  if (path.includes('/disco')) return 'disco'; // Includes both /disco.html and /disco/YYYY-MM-DD/
  if (path.includes('/info')) return 'info';
  
  return 'other';
}

// Wait for all images in container to load
// Initialize event listeners for links
function initializeEventListeners() {
  const curtain = document.querySelector('.transition-curtain');
  const links = document.querySelectorAll('a');
  
  // Initialize gallery features if they exist on this page
  if (typeof initGallery === 'function') {
    initGallery();
  }
  
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
      // If it's an internal link
      if (link.href && link.href !== '#') {
        e.preventDefault();
        
        const url = link.href;
        // Get current category at click time, not at initialization
        const currentCategory = getPageCategory(window.location.href);
        const targetCategory = getPageCategory(url);
        const isCategoryChange = currentCategory !== targetCategory;
        
        console.log(`Navigation: ${currentCategory} -> ${targetCategory}, isCategoryChange: ${isCategoryChange}`);
        
        // Only use transition animation when moving between different categories
        if (curtain && isCategoryChange) {
          // Mark that we're using internal navigation
          sessionStorage.setItem('internalNavigation', 'true');
          
          // Remove hidden state if it exists
          curtain.removeAttribute('data-hidden');
          
          // Remove all animation classes first
          curtain.classList.remove('ascending', 'initial', 'descending');
          
          // Force position to top immediately (bypass animation)
          curtain.style.transform = 'translateY(-100%)';
          
          // Force reflow to apply the transform immediately
          void curtain.offsetHeight;
          
          // Remove inline style and start descending animation
          curtain.style.transform = '';
          curtain.classList.add('descending');
          
          // Load content while curtain is down
          setTimeout(async () => {
            const success = await loadPageContent(url);
            
            if (success) {
              // Update browser history
              window.history.pushState({ url }, '', url);
              
              // Wait a bit more for images to settle
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Start ascending animation
              curtain.classList.remove('descending');
              curtain.classList.add('ascending');
            } else {
              // Fallback to normal navigation on AJAX failure
              window.location.href = url;
            }
          }, 300); // Wait for descend animation
        } else {
          // Direct navigation without animation for same-category moves
          // Mark that we're using internal navigation (no transition needed)
          sessionStorage.setItem('internalNavigation', 'skip');
          window.location.href = url;
        }
      }
    });
    
    link.dataset.listenerAdded = 'true';
  });
}

// Page transition effect on initial load
document.addEventListener('DOMContentLoaded', () => {
  const curtain = document.querySelector('.transition-curtain');
  
  // Only show transition on true initial page load (not if already hidden)
  if (curtain && !curtain.hasAttribute('data-hidden')) {
    setTimeout(() => {
      curtain.classList.remove('initial');
      curtain.classList.add('ascending');
    }, 100);
  }
  
  // Initialize event listeners
  initializeEventListeners();
});

// Handle browser back/forward buttons
window.addEventListener('popstate', async (e) => {
  // No transition animation on back/forward navigation
  const url = window.location.href;
  await loadPageContent(url);
});

// Sidebar toggle and link handling
const toggleButton = document.querySelector('.menu_toggle');
const sidebar = document.querySelector('.sidebar');
const sidebarLinks = document.querySelectorAll('.sidebar a');
const curtain = document.querySelector('.transition-curtain');

if (toggleButton && sidebar) {
  toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('show');
  });
}

// Close sidebar when clicking on overlay
document.addEventListener('click', (e) => {
  // Check if sidebar is open and click is outside the sidebar and toggle button
  if (sidebar && sidebar.classList.contains('show')) {
    if (!sidebar.contains(e.target) && !toggleButton.contains(e.target)) {
      sidebar.classList.remove('show');
    }
  }
});

// Handle sidebar link clicks
if (sidebarLinks.length > 0) {
  sidebarLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      const href = link.getAttribute('href');
      
      // Skip anchor links
      if (href && !href.startsWith('#') && href !== '#') {
        e.preventDefault();
        
        const currentCategory = getPageCategory(window.location.href);
        const targetCategory = getPageCategory(href);
        const isCategoryChange = currentCategory !== targetCategory;
        
        console.log(`Sidebar Navigation: ${currentCategory} -> ${targetCategory}, isCategoryChange: ${isCategoryChange}`);
        
        if (curtain && isCategoryChange) {
          // Mark that we're using internal navigation
          sessionStorage.setItem('internalNavigation', 'true');
          
          // Remove hidden state if it exists
          curtain.removeAttribute('data-hidden');
          
          // Remove all animation classes first
          curtain.classList.remove('ascending', 'initial', 'descending');
          
          // Force position to top immediately (bypass animation)
          curtain.style.transform = 'translateY(-100%)';
          
          // Force reflow to apply the transform immediately
          void curtain.offsetHeight;
          
          // Remove inline style and start descending animation
          curtain.style.transform = '';
          curtain.classList.add('descending');
          
          // Close sidebar during animation
          sidebar.classList.remove('show');
          
          // Load content while curtain is down
          setTimeout(async () => {
            const success = await loadPageContent(href);
            
            if (success) {
              // Update browser history
              window.history.pushState({ url: href }, '', href);
              
              // Wait a bit more for images to settle
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Start ascending animation
              curtain.classList.remove('descending');
              curtain.classList.add('ascending');
            } else {
              // Fallback to normal navigation on AJAX failure
              window.location.href = href;
            }
          }, 300); // Wait for descend animation
        } else {
          // Direct navigation without animation for same-category moves
          // Close sidebar first
          sidebar.classList.remove('show');
          
          // Mark that we're using internal navigation (no transition needed)
          sessionStorage.setItem('internalNavigation', 'skip');
          
          // Small delay for better UX
          setTimeout(() => {
            window.location.href = href;
          }, 100);
        }
      }
    });
  });
}



