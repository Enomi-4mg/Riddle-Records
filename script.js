'use strict';
// Sidebar toggle
const toggleButton = document.querySelector('.menu_toggle');
const sidebar = document.querySelector('.sidebar');
if (toggleButton && sidebar) {
  toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('show');
  });
}

// Unavatar loader for About page
document.addEventListener('DOMContentLoaded', () => {
  const avatarEl = document.querySelector('#profile-avatar');
  if (!avatarEl) return;

  const xHandle = avatarEl.dataset.xHandle;
  const youtubeHandle = avatarEl.dataset.youtubeHandle;

  const tryLoadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });

  const buildUrl = (provider, handle) => {
    if (!handle) return null;
    const enc = encodeURIComponent(handle);
    return `https://unavatar.io/${provider}/${enc}`;
  };

  const xUrl = buildUrl('x', xHandle) || buildUrl('twitter', xHandle);
  const ytUrl = buildUrl('youtube', youtubeHandle);

  (async () => {
    let finalUrl = null;
    try {
      if (xUrl) finalUrl = await tryLoadImage(xUrl);
    } catch (_) {}
    if (!finalUrl) {
      try {
        if (ytUrl) finalUrl = await tryLoadImage(ytUrl);
      } catch (_) {}
    }
    if (finalUrl) {
      avatarEl.src = finalUrl;
      avatarEl.classList.add('loaded');
    }
  })();
});