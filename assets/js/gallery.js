// Gallery functionality - Initialize and reinitialize on page transitions
function initGallery() {
  // Get fresh DOM references on each call
  const container = document.getElementById('gallery-container');
  if (!container) return; // Exit if gallery container doesn't exist on this page
  
  // Re-fetch items each time (they may have changed due to AJAX)
  const items = Array.from(container.children);
  
  // =====================================
  // 日時ソート機能
  // =====================================
  const sortNewestBtn = document.getElementById('sort-newest');
  const sortOldestBtn = document.getElementById('sort-oldest');
  
  // Remove old listeners by replacing elements
  if (sortNewestBtn) {
    const newSortNewestBtn = sortNewestBtn.cloneNode(true);
    sortNewestBtn.parentNode.replaceChild(newSortNewestBtn, sortNewestBtn);
    
    newSortNewestBtn.addEventListener('click', function() {
      items.sort((a, b) => new Date(b.dataset.date) - new Date(a.dataset.date));
      items.forEach(item => container.appendChild(item));
      
      document.querySelectorAll('.sort-controls .control-btn').forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
    });
  }
  
  if (sortOldestBtn) {
    const newSortOldestBtn = sortOldestBtn.cloneNode(true);
    sortOldestBtn.parentNode.replaceChild(newSortOldestBtn, sortOldestBtn);
    
    newSortOldestBtn.addEventListener('click', function() {
      items.sort((a, b) => new Date(a.dataset.date) - new Date(b.dataset.date));
      items.forEach(item => container.appendChild(item));
      
      document.querySelectorAll('.sort-controls .control-btn').forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
    });
  }
  
  // =====================================
  // カテゴリフィルター機能
  // =====================================
  const filterButtons = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  // Parse comma-separated categories into an array
  const getCategories = (item) => {
    const raw = item.dataset.categories || '';
    return raw.split(',').map(c => c.trim()).filter(Boolean);
  };
  
  // 初期表示：イラストと3DCGのみ表示
  function initializeFilters() {
    const activeFilters = ['イラスト', '3DCG'];
    galleryItems.forEach(item => {
      const categories = getCategories(item);
      if (activeFilters.some(filter => categories.includes(filter))) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  // Remove old filter listeners and set up new ones
  filterButtons.forEach(button => {
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    newButton.addEventListener('click', function() {
      const filter = this.dataset.filter;
      
      // 「すべて」ボタンの処理
      if (filter === 'all') {
        document.querySelectorAll('.gallery-item').forEach(item => item.style.display = '');
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        return;
      }
      
      // 個別カテゴリボタンの処理
      this.classList.toggle('active');
      
      // 「すべて」ボタンを非アクティブに
      const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
      if (allBtn) {
        allBtn.classList.remove('active');
      }
      
      // アクティブなカテゴリを取得
      const activeFilters = Array.from(document.querySelectorAll('.filter-btn.active'))
        .map(btn => btn.dataset.filter)
        .filter(f => f !== 'all');
      
      // フィルタリング処理
      document.querySelectorAll('.gallery-item').forEach(item => {
        const categories = getCategories(item);
        
        if (activeFilters.length === 0 || activeFilters.some(filter => categories.includes(filter))) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
      
      // すべて非選択なら「すべて」を自動選択
      if (activeFilters.length === 0) {
        const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
        if (allBtn) {
          allBtn.classList.add('active');
        }
        document.querySelectorAll('.gallery-item').forEach(item => item.style.display = '');
      }
    });
  });
  
  // ページ読み込み時に初期フィルター適用
  initializeFilters();
}

// Export for global use
if (typeof window !== 'undefined') {
  window.initGallery = initGallery;
}
