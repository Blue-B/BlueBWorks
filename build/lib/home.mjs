import { assetHref, pageHref, escapeHtml as esc, readingMinutes, formatKoreanDate } from './util.mjs';

export function journalHeader({config, base, active}) {
  const links = [['/', '홈', 'home'], ['articles/', '최신 글', 'articles'], ['editorial.html', '편집 노트', 'editorial'], ['about.html', '소개', 'about']];
  return `<a class="skip-link" href="#main">본문으로 건너뛰기</a><header class="site-header journal-header" data-nav-ready="false">
  <div class="publication-line"><span>AI와 개발 도구를 다루는 한국어 저널</span><a href="${pageHref(base, 'feed.xml')}">RSS로 읽기 ↗</a></div>
  <div class="journal-masthead"><a class="journal-brand" href="${pageHref(base, '/')}" aria-label="${esc(config.siteName)} 홈"><span class="brand-name">BlueBWorks</span><span class="brand-label">AI Radar</span><span class="brand-punctuation" aria-hidden="true">✳</span></a>
  <nav class="site-nav" id="site-nav" data-nav aria-label="주요 메뉴">${links.map(([p,l,k])=>`<a href="${pageHref(base,p)}"${active===k?' aria-current="page"':''}>${l}</a>`).join('')}</nav>
  <div class="journal-tools"><a class="header-search" href="${pageHref(base,'articles/')}#archive-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="m12.5 12.5 5 5"/></svg><span>검색</span></a><button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" hidden><svg viewBox="0 0 22 16" aria-hidden="true"><path d="M1 3h20M1 13h20"/></svg><span>메뉴</span></button></div></div></header>`;
}

const arrow = '<span aria-hidden="true">↗</span>';
const articleHref = (base, post) => pageHref(base, `articles/${post.slug}/`);
const searchable = p => [p.title, p.summary, p.category, ...(p.tags || [])].join(' ').toLowerCase();

function thumbnail(post, base, className = '') {
  const isSnapshot = /s\.wordpress\.com\/mshots|favicon|apple-touch-icon/.test(post.image || '');
  if (post.image && !isSnapshot) {
    return `<figure class="journal-thumb ${className}"><img src="${esc(post.image)}" alt="${esc(post.imageAlt || post.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></figure>`;
  }
  return `<div class="journal-thumb source-tile ${className}" aria-label="${esc(post.category)} 기사"><span>${esc(post.tags?.[0] || post.category)}</span><small>TECH NOTES / BLUEBWORKS</small></div>`;
}

function feature(post, base, index) {
  return `<a class="selection-story selection-story-${index}" href="${articleHref(base, post)}">
    ${thumbnail(post, base)}
    <div class="selection-copy"><p class="journal-meta"><span>${esc(post.category)}</span><span>${readingMinutes(post)}분 읽기</span></p>
    <h3>${esc(post.title)}</h3><p class="selection-dek">${esc(post.summary)}</p><span class="text-link">본문과 자료 보기 ${arrow}</span></div>
  </a>`;
}

export function journalHome({ base, config, posts, notes }) {
  const categories = [...new Set(posts.map(p => p.category))];
  const reviewed = posts.filter(p => p.reviewStatus === 'reviewed');
  const picks = [...reviewed, ...posts.filter(p => !reviewed.includes(p))].slice(0, 3);
  const lead = picks[0] || posts[0];
  const categoriesForOrbit = ['모델', '개발도구', '오픈소스', '에이전트'].filter(c => categories.includes(c));
  return `<main id="main" class="journal-home" data-design="journal-orbit-v3">
    <section class="observatory" aria-labelledby="hero-title">
      <div class="observatory-top"><span>BLUEBWORKS JOURNAL</span><span>AI · CODE · OPEN SOURCE</span><a href="#radar">전체 글 ${String(posts.length).padStart(2, '0')} ${arrow}</a></div>
      <div class="observatory-grid">
        <div class="observatory-copy">
          <p class="edition-label"><span class="edition-dot" aria-hidden="true"></span> 기술을 읽는 시간</p>
          <h1 id="hero-title"><span class="radar-prefix">AI</span>RADAR<span class="radar-period">.</span></h1>
          <p class="journal-intro">새 모델부터 개발 도구까지.<br>발표 내용과 실제로 쓸 때의 차이를 읽습니다.</p>
          ${lead ? `<article class="cover-story hero-latest"><p class="cover-story-label">RECENT NOTE <span>${esc(formatKoreanDate(lead.publishedAt))}</span></p>
            <a class="hero-latest-link" href="${articleHref(base, lead)}"><h2>${esc(lead.title)}</h2>${arrow}</a>
            <p>${esc(lead.summary)}</p>
          </article>` : ''}
        </div>
        <div class="orbital-scene hero-scene" data-parallax aria-label="캐릭터와 주제별 탐색">
          <div class="orbit-track orbit-track-outer" aria-hidden="true"><i></i></div><div class="orbit-track orbit-track-inner" aria-hidden="true"></div>
          <div class="planet-window" aria-hidden="true"><img src="${assetHref(base, 'earth-night.jpg')}" alt="" width="600" height="600" fetchpriority="high"><span></span></div>
          <div class="orbit-coordinate" aria-hidden="true">B / 01<br><span>OBSERVATORY</span></div>
          <div class="scene-layer scene-mascot" style="--depth:10"><button class="mascot-button journal-mascot" type="button" aria-expanded="false" aria-controls="mascot-notes" aria-label="캐릭터를 눌러 사이트 안내 보기"><span class="mascot-float"><img class="mascot-img" src="${assetHref(base, 'mascot.webp')}" width="320" height="320" alt="BlueBWorks의 파란 눈 로봇 캐릭터"></span></button></div>
          ${categoriesForOrbit.map((c, i) => `<a class="orbit-topic orbit-topic-${i}" href="#radar" data-topic-target="${esc(c)}"><span class="orbit-pin" aria-hidden="true"></span><strong>${esc(c === '개발도구' ? '개발 도구' : c)}</strong><small>${String(posts.filter(p => p.category === c).length).padStart(2, '0')}</small></a>`).join('')}
          <p class="orbit-caption">궁금한 주제를 눌러보세요 <span aria-hidden="true">↗</span></p>
        </div>
      </div>
      <div class="observatory-bottom"><a class="scroll-cue" href="#selection"><span aria-hidden="true">↓</span> 아래에서 이어 읽기</a><span>공식 발표 · 원문 이미지 · 사용 자료</span><span class="orbit-legend"><i aria-hidden="true"></i> BlueBWorks AI Radar</span></div>
    </section>
    ${notes}
    <section id="selection" class="journal-section selection" aria-labelledby="selection-title">
      <div class="section-heading"><div><p class="section-index">01 / THE READING ROOM</p><h2 id="selection-title">먼저 읽기<span>.</span></h2></div><p>발표에서 한 걸음 더.<br>설정과 비용, 실제 동작을 살펴본 글.</p><a class="section-link" href="${pageHref(base, 'articles/')}">전체 글 ${arrow}</a></div>
      <div class="selection-grid">${picks.map((p, i) => feature(p, base, i)).join('')}</div>
    </section>
    <section class="journal-section journal-archive" id="radar" data-filter-scope aria-labelledby="radar-title">
      <div class="section-heading"><div><p class="section-index">02 / ALL NOTES</p><h2 id="radar-title">쌓아둔 기록<span>.</span></h2></div><div class="journal-search"><label for="post-search">글 검색</label><div><input id="post-search" type="search" data-search-input placeholder="제목, 모델, 도구 이름" autocomplete="off"><span aria-hidden="true">⌕</span></div></div></div>
      <div class="archive-controls"><div class="journal-filters" role="group" aria-label="카테고리 필터"><button class="is-active" type="button" data-filter="all" aria-pressed="true">전체</button>${categories.map(c => `<button type="button" data-filter="${esc(c)}" aria-pressed="false">${esc(c === '개발도구' ? '개발 도구' : c)}</button>`).join('')}</div><p class="list-status" data-list-status id="list-status" aria-live="polite">글 ${posts.length}편</p></div>
      <ol class="journal-posts" id="post-list" data-post-list>${posts.map((p, i) => `<li data-post-card data-category="${esc(p.category)}" data-search="${esc(searchable(p))}"><a href="${articleHref(base, p)}"><span class="note-number">${String(i + 1).padStart(2, '0')}</span>${thumbnail(p, base)}<div class="note-copy"><p class="journal-meta"><span>${esc(p.category)}</span><time>${esc(formatKoreanDate(p.publishedAt))}</time></p><h3>${esc(p.title)}</h3><p class="note-summary">${esc(p.summary)}</p></div><span class="note-read">${readingMinutes(p)}분 ${arrow}</span></a></li>`).join('')}</ol>
      <p class="empty-state" data-empty-state id="empty-state" hidden>찾는 글이 없어. 다른 검색어나 주제로 찾아봐.</p>
    </section>
    <section class="journal-sources" aria-labelledby="rail-title"><div class="journal-section"><div class="section-heading"><div><p class="section-index">03 / OPEN TABS</p><h2 id="rail-title">원문으로 가기<span>↗</span></h2></div><p>직접 확인하고 싶을 때 여는<br>공식 문서와 변경 기록.</p></div><ul>${config.resources.map((r,i) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><span>${String(i+1).padStart(2,'0')}</span><div><strong>${esc(r.name)}</strong><small>${esc(r.type || '공식 자료')}</small></div>${arrow}</a></li>`).join('')}</ul></div></section>
  </main>`;
}
