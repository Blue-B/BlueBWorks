// Topic links remain normal anchors without JavaScript.
(() => {
  'use strict';
  const archive = document.querySelector('#radar[data-filter-scope]');
  if (!archive) return;
  const topicLinks = [...document.querySelectorAll('[data-topic-target]')];
  const filters = [...archive.querySelectorAll('[data-filter]')];
  topicLinks.forEach(link => link.addEventListener('click', event => {
    const button = filters.find(item => item.dataset.filter === link.dataset.topicTarget);
    if (!button) return;
    event.preventDefault();
    const search = archive.querySelector('[data-search-input]');
    if (search) search.value = '';
    button.click();
    topicLinks.forEach(item => item.classList.toggle('is-picked', item === link));
    const reduced = document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    archive.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    button.focus({ preventScroll: true });
    history.replaceState(null, '', '#radar');
  }));
})();
