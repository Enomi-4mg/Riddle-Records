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

// Wait for all images in container to load
// Initialize event listeners for links
function initializeEventListeners() {
  const curtain = document.querySelector('.transition-curtain');
  const links = document.querySelectorAll('a');
  
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
        
        if (curtain) {
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
  
  // When page loads, ascend the curtain (幕が上に消える)
  if (curtain) {
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
  const curtain = document.querySelector('.transition-curtain');
  
  if (curtain) {
    curtain.classList.remove('ascending');
    setTimeout(() => {
      curtain.classList.add('descending');
    }, 10);
    
    setTimeout(async () => {
      const url = window.location.href;
      const success = await loadPageContent(url);
      
      if (success) {
        curtain.classList.remove('descending');
        setTimeout(() => {
          curtain.classList.add('ascending');
        }, 50);
      }
    }, 300);
  }
});

// Sidebar toggle
const toggleButton = document.querySelector('.menu_toggle');
const sidebar = document.querySelector('.sidebar');
if (toggleButton && sidebar) {
  toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('show');
  });
}



