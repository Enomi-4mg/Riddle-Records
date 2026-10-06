// Gallery functionality - Initialize and reinitialize on page transitions
function initGallery() {
  // Get fresh DOM references on each call
  const container = document.getElementById('gallery-container');
  if (!container) return; // Exit if gallery container doesn't exist on this page

  // Guard against attaching duplicate event listeners on repeated calls
  if (container.dataset.listenerAdded === 'true') return;
  container.dataset.listenerAdded = 'true';

  // Re-fetch items each time (they may have changed due to AJAX)
  const items = Array.from(container.children);
  
  // =====================================
  // 日時ソート機能
  // =====================================
  const sortNewestBtn = document.getElementById('sort-newest');
  const sortOldestBtn = document.getElementById('sort-oldest');
  
  const setActiveSortButton = (activeButton) => {
    document.querySelectorAll('.sort-controls .control-btn').forEach(btn => btn.classList.remove('active'));
    activeButton.classList.add('active');
  };

  if (sortNewestBtn) {
    sortNewestBtn.addEventListener('click', function() {
      items.sort((a, b) => new Date(b.dataset.date) - new Date(a.dataset.date));
      items.forEach(item => container.appendChild(item));
      setActiveSortButton(this);
    });
  }
  
  if (sortOldestBtn) {
    sortOldestBtn.addEventListener('click', function() {
      items.sort((a, b) => new Date(a.dataset.date) - new Date(b.dataset.date));
      items.forEach(item => container.appendChild(item));
      setActiveSortButton(this);
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
  
  function initializeFilters() {
    const activeFilters = Array.from(filterButtons).filter(button => button.classList.contains('active') && button.dataset.filter !== 'all').map(button => button.dataset.filter);
    let count = 0;
    galleryItems.forEach(item => {
      const visible = activeFilters.length === 0 || activeFilters.some(filter => getCategories(item).includes(filter));
      item.style.display = visible ? '' : 'none';
      if (visible) count++;
    });
    filterButtons.forEach(button => {
      if (button.dataset.filter === 'all') button.classList.toggle('active', activeFilters.length === 0);
      button.setAttribute('aria-pressed', String(button.classList.contains('active')));
    });
    const status = document.querySelector('[data-filter-status]');
    if (status) status.textContent = `${count}件表示中`;
    const empty = document.querySelector('[data-filter-empty]');
    if (empty) empty.hidden = count !== 0;
  }
  filterButtons.forEach(button => button.addEventListener('click', () => {
    if (button.dataset.filter === 'all') filterButtons.forEach(item => item.classList.remove('active'));
    else button.classList.toggle('active');
    initializeFilters();
  }));

  // ページ読み込み時に初期フィルター適用
  initializeFilters();
}

// =====================================
// Journal記事の関連作品チェック機能
// =====================================
function checkRelatedWorks() {
  const contentWorksDiv = document.getElementById('content-related-works');
  const featuredWorks = document.querySelector('[data-section-type="featured"]');
  const sameDateWorks = document.querySelector('[data-section-type="same-date"]');
  const noRelatedMessage = document.getElementById('no-related-message');
  
  if (!noRelatedMessage) return; // Journal記事ページでない場合は終了
  
  // 各セクションの表示状態をチェック
  const hasContentWorks = contentWorksDiv && !contentWorksDiv.hidden;
  const hasFeaturedWorks = !!featuredWorks;
  const hasSameDateWorks = !!sameDateWorks;
  
  // 全て空の場合のみメッセージを表示
  if (!hasContentWorks && !hasFeaturedWorks && !hasSameDateWorks) {
    noRelatedMessage.hidden = false;
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  window.initGallery = initGallery;
  window.checkRelatedWorks = checkRelatedWorks;
}
