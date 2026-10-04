import { assetHref, pageHref, escapeHtml as esc, readingMinutes, formatKoreanDate } from './util.mjs';

const arrow = '<span aria-hidden="true">↗</span>';
const articleHref = (base, post) => pageHref(base, `articles/${post.slug}/`);
const readableCategory = c => c === '개발도구' ? '개발 도구' : c;
const hasThumbnail = p => Boolean(p.image) && !/mshots|favicon|apple-touch-icon/.test(p.image);
const searchable = p => [p.title, p.summary, p.category, ...(p.tags || [])].join(' ').toLowerCase();

export function journalHeader({ config, base, active }) {
  const links = [['/', '홈', 'home'], ['articles/', '글 목록', 'articles'], ['about.html', '소개', 'about']];
  return `<a class="skip-link" href="#main">본문으로 건너뛰기</a>
  <header class="site-header journal-header" data-nav-ready="false">
    <div class="journal-masthead">
      <a class="journal-brand" href="${pageHref(base, '/')}" aria-label="${esc(config.siteName)} 홈"><span class="brand-name">BlueBWorks<span class="brand-dot" aria-hidden="true">.</span></span><span class="brand-label">개발 도구 · 오픈소스 · AI</span></a>
      <nav class="site-nav" id="site-nav" data-nav aria-label="주요 메뉴">${links.map(([p, label, key]) => `<a href="${pageHref(base, p)}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}<a href="${esc(config.repoUrl)}" target="_blank" rel="noopener noreferrer">GitHub ${arrow}</a></nav>
      <div class="journal-tools"><a class="header-search" href="${pageHref(base, 'articles/')}#archive-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span>검색</span></a><button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 17h18"/></svg><span>메뉴</span></button></div>
    </div>
  </header>`;
}

function thumbnail(post, className = '', eager = false) {
  if (!hasThumbnail(post)) return '';
  const dimensions = post.imageWidth && post.imageHeight ? ` width="${post.imageWidth}" height="${post.imageHeight}"` : '';
  const wide = post.imageHeight && post.imageWidth > post.imageHeight * 3;
  return `<figure class="journal-thumb ${className}${wide ? ' is-wide' : ''}"><img src="${esc(post.image)}" alt="${esc(post.imageAlt || post.title)}"${dimensions}${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" referrerpolicy="no-referrer"></figure>`;
}

function meta(post) {
  return `<p class="journal-meta"><span>${esc(readableCategory(post.category))}</span><time datetime="${esc(post.publishedAt)}">게시 ${esc(formatKoreanDate(post.publishedAt))}</time></p>`;
}

function leadStory(post, base) {
  if (!post) return '<div class="lead-story"><h1>아직 게시된 글이 없습니다.</h1></div>';
  return `<article class="lead-story${hasThumbnail(post) ? ' has-thumb' : ''}">
    ${hasThumbnail(post) ? `<a class="lead-story-media" href="${articleHref(base, post)}" aria-label="${esc(post.title)}">${thumbnail(post, 'lead-thumb', true)}</a>` : ''}
    <div class="lead-story-copy">${meta(post)}<h1 id="lead-title"><a href="${articleHref(base, post)}">${esc(post.title)}</a></h1><p class="lead-dek">${esc(post.summary)}</p><a class="lead-more" href="${articleHref(base, post)}">글 읽기 ${arrow}</a></div>
  </article>`;
}

function secondaryStory(post, base) {
  return `<article class="secondary-story"><a href="${articleHref(base, post)}">${meta(post)}<h2>${esc(post.title)}</h2><p class="secondary-dek">${esc(post.summary)}</p><span class="secondary-more">${readingMinutes(post)}분 읽기 ${arrow}</span></a></article>`;
}

function archiveItem(post, base) {
  return `<li class="${hasThumbnail(post) ? 'has-thumb' : 'text-only'}" data-post-card data-category="${esc(post.category)}" data-search="${esc(searchable(post))}"><a href="${articleHref(base, post)}"><div class="note-copy">${meta(post)}<h3>${esc(post.title)}</h3><p class="note-summary">${esc(post.summary)}</p><span class="note-read">${readingMinutes(post)}분 읽기</span></div>${thumbnail(post)}<span class="row-arrow" aria-hidden="true">↗</span></a></li>`;
}

export function journalHome({ base, config, posts, notes }) {
  const categories = [...new Set(posts.map(p => p.category))];
  // The visual feature is explicitly labelled as a pick. The chronological list
  // below always preserves the incoming publication order, including text-only stories.
  const lead = posts.find(p => p.reviewStatus === 'reviewed' && hasThumbnail(p) && p.imageWidth > 0 && p.imageHeight > 0 && p.imageWidth / p.imageHeight < 3) || posts[0];
  const secondary = posts.filter(p => p !== lead).slice(0, 3);
  return `<main id="main" class="journal-home" data-design="editorial-edition-6">
    <section class="home-lead journal-section" aria-labelledby="lead-title">
      <div class="front-heading"><p>추천 글</p><div class="front-tools"><a href="${pageHref(base, 'feed.xml')}">RSS ${arrow}</a><button class="mascot-button" type="button" aria-expanded="false" aria-controls="mascot-notes" aria-label="사이트 안내"><img class="mascot-img" src="${assetHref(base, 'mascot.webp')}" width="48" height="48" alt=""><span class="mascot-tooltip">사이트 안내</span></button></div></div>
      <div class="lead-grid"><div class="lead-column">${leadStory(lead, base)}</div><aside class="secondary-stories" aria-label="최근 글"><h2 class="latest-heading">최근 글</h2>${secondary.map(p => secondaryStory(p, base)).join('')}</aside></div>
    </section>
    ${notes}
    <section class="journal-section journal-archive" id="radar" data-filter-scope aria-labelledby="radar-title">
      <div class="section-heading"><h2 id="radar-title">전체 글</h2><a class="section-link" href="${pageHref(base, 'articles/')}">글 목록 ${arrow}</a></div>
      <div class="archive-controls"><div class="journal-filters" role="group" aria-label="카테고리 필터"><button class="is-active" type="button" data-filter="all" aria-pressed="true">전체</button>${categories.map(c => `<button type="button" data-filter="${esc(c)}" aria-pressed="false">${esc(readableCategory(c))}</button>`).join('')}</div><div class="journal-search"><label class="sr-only" for="post-search">글 검색</label><input id="post-search" type="search" data-search-input placeholder="검색어 입력" autocomplete="off"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></div></div>
      <p class="list-status" data-list-status id="list-status" aria-live="polite">글 ${posts.length}편</p>
      <ol class="journal-posts" id="post-list" data-post-list>${posts.map(p => archiveItem(p, base)).join('')}</ol>
      <p class="empty-state" data-empty-state id="empty-state" hidden>검색 결과가 없습니다.</p>
    </section>
    <section class="journal-sources journal-section" aria-labelledby="rail-title"><div class="section-heading"><h2 id="rail-title">공식 문서</h2></div><ul>${config.resources.map(r => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(r.name)}</strong>${arrow}</a></li>`).join('')}</ul></section>
  </main>`;
}
