// Small reading conveniences; article text and navigation do not depend on JS.
(() => {
  'use strict';
  const toc = document.querySelector('details.toc');
  if (toc && window.matchMedia('(max-width: 960px)').matches) toc.open = false;
  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const search = document.querySelector('[data-search-input]');
    if (!search) return;
    event.preventDefault();
    search.focus();
    search.scrollIntoView({ block: 'center', behavior: 'auto' });
  });
})();
