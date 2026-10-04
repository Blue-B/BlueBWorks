import { assetHref, pageHref, escapeHtml as esc, readingMinutes, formatKoreanDate } from './util.mjs';

export function journalHeader({config, base, active}) {
  const links = [['/', '홈', 'home'], ['articles/', '최신 글', 'articles'], ['editorial.html', '편집 원칙', 'editorial'], ['about.html', '소개', 'about']];
  return `<a class="skip-link" href="#main">본문으로 건너뛰기</a><header class="site-header journal-header" data-nav-ready="false">
  <div class="publication-line"><span>AI와 개발 도구를 다루는 한국어 저널</span><a href="${pageHref(base, 'feed.xml')}">RSS로 읽기 ↗</a></div>
  <div class="journal-masthead"><a class="journal-brand" href="${pageHref(base, '/')}" aria-label="${esc(config.siteName)} 홈"><span class="brand-name">BlueBWorks</span><span class="brand-label">${esc(config.tagline || '기술을 읽는 저널')}</span><span class="brand-punctuation" aria-hidden="true">✳</span></a>
  <nav class="site-nav" id="site-nav" data-nav aria-label="주요 메뉴">${links.map(([p,l,k])=>`<a href="${pageHref(base,p)}"${active===k?' aria-current="page"':''}>${l}</a>`).join('')}</nav>
  <div class="journal-tools"><a class="header-search" href="${pageHref(base,'articles/')}#archive-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="m12.5 12.5 5 5"/></svg><span>검색</span></a><button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" hidden><svg viewBox="0 0 22 16" aria-hidden="true"><path d="M1 3h20M1 13h20"/></svg><span>메뉴</span></button></div></div></header>`;
}

const arrow = '<span aria-hidden="true">↗</span>';
const articleHref = (base, post) => pageHref(base, `articles/${post.slug}/`);
const searchable = p => [p.title, p.summary, p.category, ...(p.tags || [])].join(' ').toLowerCase();
const readableCategory = category => category === '개발도구' ? '개발 도구' : category;

const hasThumbnail = post => Boolean(post.image) && !/mshots|favicon|apple-touch-icon/.test(post.image);
function thumbnail(post, base, className = '') {
  const isSnapshot = /s\.wordpress\.com\/mshots|favicon|apple-touch-icon/.test(post.image || '');
  if (post.image && !isSnapshot) {
    return `<figure class="journal-thumb ${className}"><img src="${esc(post.image)}" alt="${esc(post.imageAlt || post.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></figure>`;
  }
  return '';
}

function postMeta(post) {
  return `<p class="journal-meta"><span>${esc(readableCategory(post.category))}</span><time datetime="${esc(post.publishedAt)}">게시 ${esc(formatKoreanDate(post.publishedAt))}</time><span>${readingMinutes(post)}분 읽기</span></p>`;
}

function leadStory(post, base) {
  if (!post) {
    return `<div class="lead-story"><div class="lead-story-copy"><h1 id="lead-title">BlueBWorks</h1><p class="lead-dek">공식 발표와 실제 사용 조건을 함께 읽는 기술 저널입니다.</p></div></div>`;
  }
  return `<article class="lead-story">
    <div class="lead-story-copy">
      ${postMeta(post)}
      <h1 id="lead-title"><a href="${articleHref(base, post)}">${esc(post.title)}</a></h1>
      <p class="lead-dek">${esc(post.summary)}</p>
      <a class="lead-more" href="${articleHref(base, post)}">본문과 자료 보기 ${arrow}</a>
    </div>
    ${hasThumbnail(post) ? `<a class="lead-story-media" href="${articleHref(base, post)}" aria-label="${esc(post.title)}">${thumbnail(post, base, 'lead-thumb')}</a>` : ''}
  </article>`;
}

function secondaryStory(post, base) {
  return `<a class="secondary-story${hasThumbnail(post) ? ' has-thumb' : ''}" href="${articleHref(base, post)}">
    <div class="secondary-copy">
      ${postMeta(post)}
      <h2>${esc(post.title)}</h2>
      <p class="secondary-dek">${esc(post.summary)}</p>
    </div>
    ${thumbnail(post, base, 'secondary-thumb')}
  </a>`;
}

export function journalHome({ base, config, posts, notes }) {
  const categories = [...new Set(posts.map(p => p.category))];
  const reviewed = posts.filter(p => p.reviewStatus === 'reviewed');
  const picks = [...reviewed, ...posts.filter(p => !reviewed.includes(p))].slice(0, 3);
  const lead = picks[0] || posts[0];
  const secondary = picks.slice(1, 3);
  const topics = categories.slice(0, 6);
  return `<main id="main" class="journal-home" data-design="journal-editorial-v1">
    <section class="home-lead journal-section" aria-labelledby="lead-title">
      <div class="home-intro">
        <div class="home-intro-copy">
          <p class="home-intro-line">모델과 도구, 지금 읽을 이야기.</p>
          ${topics.length ? `<nav class="topic-links" aria-label="주제별 글"><span>주제</span>${topics.map(c => `<a href="#radar" data-topic-target="${esc(c)}">${esc(readableCategory(c))}</a>`).join('')}</nav>` : ''}
        </div>
        <figure class="home-mascot">
          <button class="mascot-button" type="button" aria-expanded="false" aria-controls="mascot-notes" aria-label="사이트 안내 보기"><img class="mascot-img" src="${assetHref(base, 'mascot.webp')}" width="320" height="320" alt="BlueBWorks 파란 눈 로봇 캐릭터"></button>
        </figure>
      </div>
      <div class="lead-grid">
        <div class="lead-column">${leadStory(lead, base)}</div>
        ${secondary.length ? `<div class="secondary-stories">${secondary.map(p => secondaryStory(p, base)).join('')}</div>` : ''}
      </div>
    </section>
    ${notes}
    <section class="journal-section journal-archive" id="radar" data-filter-scope aria-labelledby="radar-title">
      <div class="section-heading"><div><p class="section-index">모든 글</p><h2 id="radar-title">쌓아둔 기록<span>.</span></h2></div><p>제목, 모델, 도구 이름으로 찾아보세요.</p><a class="section-link" href="${pageHref(base, 'articles/')}">글 목록 ${arrow}</a></div>
      <div class="archive-controls"><div class="journal-search"><label for="post-search">글 검색</label><div><input id="post-search" type="search" data-search-input placeholder="제목, 모델, 도구 이름" autocomplete="off"><span aria-hidden="true">⌕</span></div></div><p class="list-status" data-list-status id="list-status" aria-live="polite">글 ${posts.length}편</p></div>
      <div class="journal-filters" role="group" aria-label="카테고리 필터"><button class="is-active" type="button" data-filter="all" aria-pressed="true">전체</button>${categories.map(c => `<button type="button" data-filter="${esc(c)}" aria-pressed="false">${esc(readableCategory(c))}</button>`).join('')}</div>
      <ol class="journal-posts" id="post-list" data-post-list>${posts.map((p, i) => `<li class="${hasThumbnail(p) ? 'has-thumb' : 'text-only'}" data-post-card data-category="${esc(p.category)}" data-search="${esc(searchable(p))}"><a href="${articleHref(base, p)}"><span class="note-number">${String(i + 1).padStart(2, '0')}</span>${thumbnail(p, base)}<div class="note-copy"><p class="journal-meta"><span>${esc(readableCategory(p.category))}</span><time datetime="${esc(p.publishedAt)}">게시 ${esc(formatKoreanDate(p.publishedAt))}</time></p><h3>${esc(p.title)}</h3><p class="note-summary">${esc(p.summary)}</p></div><span class="note-read">${readingMinutes(p)}분 ${arrow}</span></a></li>`).join('')}</ol>
      <p class="empty-state" data-empty-state id="empty-state" hidden>찾는 글이 없어. 다른 검색어나 주제로 찾아봐.</p>
    </section>
    <section class="journal-sources" aria-labelledby="rail-title"><div class="journal-section"><div class="section-heading"><div><p class="section-index">공식 자료</p><h2 id="rail-title">원문으로 가기<span>↗</span></h2></div><p>직접 확인하고 싶을 때 여는<br>공식 문서와 변경 기록.</p></div><ul>${config.resources.map((r,i) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><span>${String(i+1).padStart(2,'0')}</span><div><strong>${esc(r.name)}</strong><small>${esc(r.type || '공식 자료')}</small></div>${arrow}</a></li>`).join('')}</ul></div></section>
  </main>`;
}
