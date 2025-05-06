'use strict';
const toggleButton = document.querySelector('.menu_toggle');
const sidebar = document.querySelector('.sidebar');

toggleButton.addEventListener('click', () => {
  sidebar.classList.toggle('show');
});