import {
  assetHref,
  escapeHtml,
  hostnameOf,
  jsonEmbed,
  joinUrl,
  laterDate,
  pageHref,
  readingMinutes,
  sectionParagraphs,
  sortKey,
  toIso,
  toRfc822,
  formatKoreanDate,
  unique,
} from "./util.mjs";
import { isIndexable, relatedPosts, sortPosts } from "./data.mjs";
import { articleCover, articleExtras } from "./rich.mjs";
import { journalHome, journalHeader } from "./home.mjs";

const esc = escapeHtml;

function searchDescription(value, maxLength = 160) {
  const text = String(value || "").replace(/\s+/gu, " ").trim();
  if (Array.from(text).length <= maxLength) return text;
  const sentences = text.match(/[^.!?]+[.!?](?=\s|$)/gu) || [];
  let short = "";
  for (const sentence of sentences) {
    const next = (short + " " + sentence.trim()).trim();
    if (Array.from(next).length > maxLength) break;
    short = next;
  }
  if (Array.from(short).length >= 65) return short;
  const cut = Array.from(text).slice(0, maxLength - 1).join("");
  const space = cut.lastIndexOf(" ");
  return (space >= 75 ? cut.slice(0, space) : cut).trim() + "…";
}


function svgMark() {
  return `<svg class="brand-mark" viewBox="0 0 40 34" role="img" aria-label="고양이 귀 로봇 마스코트" focusable="false"><path d="M8 13 5 3l9 6h12l9-6-3 10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><rect x="4" y="12" width="32" height="20" rx="7" fill="currentColor"/><circle cx="14" cy="21" r="3.1" fill="#79d2ff"/><circle cx="26" cy="21" r="3.1" fill="#79d2ff"/><path d="M15 27h10" stroke="#0b1224" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

function navToggleIcon() {
  return `<svg class="nav-toggle-icon" viewBox="0 0 20 14" aria-hidden="true" focusable="false"><path d="M1 1h18M1 7h18M1 13h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}

function searchIcon() {
  return `<svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m12.8 12.8 5.2 5.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
}

function mascotFallbackSvg() {
  return `<svg class="mascot-fallback-svg" viewBox="0 0 220 260" role="img" aria-label="파란 눈의 고양이 귀 로봇"><ellipse cx="110" cy="248" rx="58" ry="9" fill="rgba(0,0,0,.35)"/><path d="M52 74 40 26l46 28h48l46-28-12 48" fill="#dbe2ef" stroke="#aab6cc" stroke-width="3" stroke-linejoin="round"/><rect x="40" y="66" width="140" height="128" rx="38" fill="#eef2f9" stroke="#aab6cc" stroke-width="3"/><rect x="66" y="104" width="88" height="52" rx="20" fill="#101c3d"/><circle cx="90" cy="130" r="11" fill="#79d2ff"/><circle cx="130" cy="130" r="11" fill="#79d2ff"/><circle cx="86" cy="126" r="3.4" fill="#eaf7ff"/><circle cx="126" cy="126" r="3.4" fill="#eaf7ff"/><path d="M84 176q26 16 52 0" fill="none" stroke="#101c3d" stroke-width="4" stroke-linecap="round"/><path d="M52 58q58 26 116 0" fill="none" stroke="#2f4f97" stroke-width="14" stroke-linecap="round"/><path d="M150 62l10-12 4 14 15 2-12 9 3 15-13-8-13 8 3-15-12-9 15-2z" fill="#7fb0ff"/></svg>`;
}

function head({
  config,
  base,
  title,
  description,
  canonicalPath,
  ogType = "website",
  ogImage = "",
  robots = "",
  jsonLd = [],
}) {
  const canonical = joinUrl(config.baseUrl, canonicalPath);
  const searchSummary = searchDescription(description || config.description);
  const cards = ogImage
    ? `<meta name="twitter:card" content="summary_large_image">
    <meta property="og:image" content="${esc(ogImage)}">`
    : `<meta name="twitter:card" content="summary">`;
  const ld = jsonLd
    .filter(Boolean)
    .map((entry) => `<script type="application/ld+json">${jsonEmbed(entry)}</script>`)
    .join("\n    ");
  return `<!doctype html>
<html lang="ko" data-base="${esc(base)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(searchSummary)}">
    <link rel="canonical" href="${esc(canonical)}">
    ${robots ? `<meta name="robots" content="${esc(robots)}">` : ""}
    <meta property="og:type" content="${esc(ogType)}">
    <meta property="og:site_name" content="${esc(config.siteName)}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(searchSummary)}">
    <meta property="og:url" content="${esc(canonical)}">
    <meta property="og:locale" content="ko_KR">
    ${cards}
    <link rel="icon" href="${assetHref(base, "favicon.svg")}" type="image/svg+xml">
    <link rel="alternate" type="application/rss+xml" title="${esc(config.rssTitle)}" href="${pageHref(base, "feed.xml")}">
    <link rel="stylesheet" href="${assetHref(base, "journal.css")}?v=edition6">
    ${ld}
  </head>`;
}

function header(options) {
  return journalHeader(options);
}

function footer({ config, base }) {
  return `<footer class="site-footer">
    <div class="wrap footer-inner">
      <div class="footer-brand">
        <strong>${esc(config.siteName)}</strong>
      </div>
      <nav class="footer-nav" aria-label="바닥글">
        <a href="${pageHref(base, "about.html")}">소개</a>
        <a href="${pageHref(base, "editorial.html")}">편집 원칙</a>
        <a href="${pageHref(base, "contact.html")}">문의</a>
        <a href="${pageHref(base, "privacy.html")}">개인정보</a>
        <a href="${pageHref(base, "feed.xml")}">RSS</a>
        <a href="${esc(config.repoUrl)}" rel="noopener noreferrer" target="_blank">GitHub</a>
      </nav>
    </div>
    <div class="journal-footer-bottom wrap"><p class="footer-byline">AI 보조로 작성하며, 공식 출처와 확인 시점을 표시합니다.</p><button class="motion-toggle" id="motion-toggle" type="button" aria-pressed="false">동작 줄이기</button></div>
  </footer>`;
}

function layout({ config, base, active, ...page }) {
  return `${head({ config, base, ...page })}
  <body class="${esc(page.bodyClass || "")}">
  ${header({ config, base, active })}
  ${page.content}
  ${footer({ config, base })}
  <script src="${assetHref(base, "app.js")}?v=edition6" defer></script>
  <script src="${assetHref(base, "journal.js")}?v=edition6" defer></script>
  </body>
</html>
`;
}

function orgJsonLd(config) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: config.shortName,
    url: joinUrl(config.baseUrl, "/"),
    description: config.description,
    sameAs: [config.repoUrl],
  };
}

function websiteJsonLd(config) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: config.siteName,
    url: joinUrl(config.baseUrl, "/"),
    description: config.description,
    inLanguage: "ko-KR",
    publisher: { "@type": "Organization", name: config.shortName },
  };
}

function breadcrumbJsonLd(config, items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: joinUrl(config.baseUrl, item.path),
    })),
  };
}

function sourceHost(post) {
  return post.sources[0] ? hostnameOf(post.sources[0].url) : "";
}

function mediaFigure(post, base, { className = "post-media", eager = false } = {}) {
  if (post.image) {
    const dimensions = post.imageWidth && post.imageHeight ? ` width="${post.imageWidth}" height="${post.imageHeight}"` : '';
    const image = `<img src="${esc(post.image)}" alt="${esc(post.imageAlt || post.title)}"${dimensions}${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" referrerpolicy="no-referrer">`;
    // Cards already have an outer link. Only the article cover gets zoom/source links.
    const isCover = className === 'source-media';
    const credit = esc(post.imageCredit || sourceHost(post));
    const sourceLink = isCover && post.imageSourceUrl
      ? `<a href="${esc(post.imageSourceUrl)}" target="_blank" rel="noopener noreferrer">${credit} · 원문</a>`
      : `<cite>${credit}</cite>`;
    return `<figure class="${className}">
        ${isCover ? `<a href="${esc(post.image)}" data-zoom-image target="_blank" rel="noopener noreferrer" aria-label="대표 이미지 크게 보기: ${esc(post.imageAlt || post.title)}">${image}</a>` : image}
        <figcaption><span>${esc(post.imageCaption || post.imageAlt || '')}</span>${sourceLink}${isCover && /CC BY 4\.0/i.test(post.imageCredit) ? '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">이미지 이용 조건</a>' : ''}</figcaption>
      </figure>`;
  }
  const source = post.sources[0];
  const name = source ? source.name : "출처 없음";
  return `<div class="${className} media-source" role="img" aria-label="공식 출처 카드: ${esc(name)}">
      <p class="media-label">공식 출처</p>
      <strong>${esc(name)}</strong>
      ${source ? `<span>${esc(hostnameOf(source.url))}</span>` : ""}
    </div>`;
}

function metaRow(post) {
  return `<p class="meta-row">
      <span class="meta-cat">${esc(post.category)}</span>
      <span>게시 ${esc(formatKoreanDate(post.publishedAt))}</span>
      <span>${readingMinutes(post)}분</span>
      ${post.status ? `<span>${esc(post.status)}</span>` : ""}
    </p>`;
}

function searchText(post) {
  return unique([
    post.title,
    post.summary,
    post.category,
    post.status,
    post.editorNote,
    ...post.tags,
    ...post.keyPoints,
  ])
    .join(" ")
    .toLowerCase();
}

function postCard(post, base, { featured = false } = {}) {
  const href = pageHref(base, `articles/${post.slug}/`);
  return `<li class="post-item${featured ? " is-featured" : ""}" data-post-card data-category="${esc(post.category)}" data-search="${esc(searchText(post))}">
      <a class="post-link" href="${href}">
        ${mediaFigure(post, base, { className: "post-media", eager: featured })}
        <div class="post-body">
          ${metaRow(post)}
          <h3 class="post-title">${esc(post.title)}</h3>
          <p class="post-summary">${esc(post.summary)}</p>
          <p class="post-tags">${post.tags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</p>
        </div>
      </a>
    </li>`;
}

function resourceCard(resource) {
  return `<li class="rail-item">
      <a class="rail-card" href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">
        ${resource.type ? `<span class="rail-type">${esc(resource.type)}</span>` : ""}
        <strong>${esc(resource.name)}</strong>
        ${resource.description ? `<span class="rail-desc">${esc(resource.description)}</span>` : ""}
        <span class="rail-host">${esc(hostnameOf(resource.url))}</span>
      </a>
    </li>`;
}

function mascotNotes(config, base) {
  return `<div class="mascot-notes" id="mascot-notes" hidden>
      <div class="mascot-notes-head">
        <strong>사이트 사용 팁</strong>
        <button type="button" class="notes-close" data-notes-close aria-label="팁 닫기">닫기</button>
      </div>
      <p class="notes-intro">이 로봇은 화면 안내를 맡습니다. 대화형 AI가 아니고, 질문에 답하지 않습니다.</p>
      <ul>
        <li>글 목록에서 카테고리 버튼과 검색창으로 글을 좁힐 수 있습니다.</li>
        <li>글의 <strong>확인</strong> 시각과 <strong>출처</strong>를 함께 보면 발표와 실제 사용 가능 상태를 구분하기 쉽습니다.</li>
        <li>페이지 아래 <strong>동작 줄이기</strong>로 애니메이션을 끌 수 있습니다. 브라우저 설정도 함께 반영합니다.</li>
        <li>각 글의 <strong>링크 복사</strong>로 주소를 공유할 수 있습니다.</li>
        <li>오류 제보는 <a href="${esc(config.issuesUrl)}" target="_blank" rel="noopener noreferrer">GitHub 이슈</a>로 받습니다.</li>
      </ul>
    </div>`;
}

export function renderHome({ config, base, posts, generatedAt, heroImageUrl = "" }) {
  return layout({ config, base, active: "home", title: config.homeTitle || config.siteName, description: config.description, canonicalPath: "/", ogType: "website", ogImage: heroImageUrl, bodyClass: "page-home", content: journalHome({ config, base, posts: posts.filter(isIndexable), notes: mascotNotes(config, base) }), jsonLd: [websiteJsonLd(config), orgJsonLd(config)], generatedAt });
}

function citations(refs, sources) {
  const valid = refs.filter((ref) => ref >= 1 && ref <= sources.length);
  if (!valid.length) return "";
  return `<p class="source-refs">근거 ${valid
    .map((ref) => `<a href="#source-${ref}">[${ref}]</a>`)
    .join(" ")}</p>`;
}

function renderSections(post) {
  return post.sections
    .map((section, index) => {
      const id = `sec-${index + 1}`;
      const paragraphs = sectionParagraphs(section);
      const body = paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("\n        ");
      return `<section class="prose-section" id="${id}">
        <h2>${esc(section.title)}</h2>
        ${body}
        ${articleExtras(section)}
        ${citations(section.sourceRefs, post.sources)}
      </section>`;
    })
    .join("\n      ");
}

function renderToc(post) {
  if (!post.sections.length) return "";
  return `<details class="toc" open>
      <summary>목차</summary>
      <nav aria-label="글 목차">
        <ol>
          ${post.sections
            .map(
              (section, index) =>
                `<li><a href="#sec-${index + 1}">${esc(section.title)}</a></li>`,
            )
            .join("\n          ")}
        </ol>
      </nav>
    </details>`;
}

function renderSources(post) {
  if (!post.sources.length) return "";
  return `<section class="sources" id="sources" aria-labelledby="sources-title">
      <h2 id="sources-title">출처</h2>
      <ol>
        ${post.sources
          .map(
            (source, index) => `<li id="source-${index + 1}">
          <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">
            <strong>${esc(source.name)}</strong>
            <span>${esc(hostnameOf(source.url))}</span>
          </a>
        </li>`,
          )
          .join("\n        ")}
      </ol>
    </section>`;
}

function renderKeyPoints(post) {
  if (!post.keyPoints.length) return "";
  return `<details class="key-points">
      <summary>요약</summary>
      <ul>
        ${post.keyPoints.map((point) => `<li>${esc(point)}</li>`).join("\n        ")}
      </ul>
    </details>`;
}

function renderEditorNote(post) {
  if (!post.editorNote) return "";
  return `<details class="editor-note">
      <summary>덧붙임</summary>
      <p>${esc(post.editorNote)}</p>
    </details>`;
}

function renderCorrections(post) {
  if (!post.corrections.length) return "";
  return `<section class="corrections" aria-labelledby="corrections-title">
      <h2 id="corrections-title">정정 기록</h2>
      <ul>
        ${post.corrections
          .map(
            (entry) => `<li>
          ${entry.date ? `<time datetime="${esc(entry.date)}">${esc(formatKoreanDate(entry.date))}</time>` : ""}
          <p>${esc(entry.text)}</p>
          ${entry.url ? `<a href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">관련 링크</a>` : ""}
        </li>`,
          )
          .join("\n        ")}
      </ul>
    </section>`;
}

function renderVideos(post) {
  if (!post.videos.length) return "";
  return `<section class="videos" aria-labelledby="videos-title">
      <h2 id="videos-title">영상</h2>
      ${post.videos
        .map(
          (video) => `<div class="video" data-video data-youtube-id="${esc(video.youtubeId)}">
        <button class="video-load" type="button" data-video-load aria-label="영상 재생: ${esc(video.title || "공식 영상")}">
          <span class="video-play" aria-hidden="true">재생</span>
          <span class="video-text">
            <strong>${esc(video.title || "공식 영상")}</strong>
            <span>${esc(video.channel || "")}${video.sourceUrl ? ` (${esc(hostnameOf(video.sourceUrl))})` : ""}</span>
          </span>
        </button>
        <p class="video-note">재생하기 전까지는 YouTube에 요청을 보내지 않습니다. 누르면 개인정보 보호 모드로 불러옵니다.</p>
      </div>`,
        )
        .join("\n      ")}
    </section>`;
}

function renderRelated(post, posts, base) {
  const related = relatedPosts(post, posts, 3);
  if (!related.length) return "";
  return `<section class="related" aria-labelledby="related-title">
      <h2 id="related-title">관련 글</h2>
      <ul class="related-list">
        ${related
          .map(
            (item) => `<li>
          <a href="${pageHref(base, `articles/${item.slug}/`)}">
            <span class="related-cat">${esc(item.category)}</span>
            <strong>${esc(item.title)}</strong>
            <span>게시 ${esc(formatKoreanDate(item.publishedAt))}</span>
          </a>
        </li>`,
          )
          .join("\n        ")}
      </ul>
    </section>`;
}

function renderArticleRail(post, posts, base, config, canonical) {
  const resources = post.resources.length ? post.resources : config.resources.slice(0, 5);
  if (!resources.length) return '';
  return `<aside class="article-aside aside-right" aria-labelledby="resources-title">
      <h2 class="rail-title" id="resources-title">참고 자료</h2>
      <ul class="rail-list">
        ${resources.map(resourceCard).join("\n        ")}
      </ul>
      <div class="article-tools">
        <button type="button" class="copy-link" data-copy-url="${esc(canonical)}">링크 복사</button>
        <span class="copy-status" role="status" aria-live="polite"></span>
      </div>
    </aside>`;
}

export function renderArticle({ config, base, post, posts, generatedAt, heroImageUrl = "" }) {
  const canonical = joinUrl(config.baseUrl, `/articles/${post.slug}/`);
  const indexable = isIndexable(post);
  const breadcrumb = breadcrumbJsonLd(config, [
    { name: "홈", path: "/" },
    { name: "글 목록", path: "/articles/" },
    { name: post.title, path: `/articles/${post.slug}/` },
  ]);
  // A missing product image must not become an unrelated site illustration in shares.
  const imageUrl = post.image || '';
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    url: canonical,
    mainEntityOfPage: canonical,
    datePublished: toIso(post.publishedAt),
    dateModified: toIso(laterDate(post.publishedAt, post.verifiedAt)),
    author: { "@type": "Organization", name: config.byline },
    publisher: { "@type": "Organization", name: config.shortName },
    inLanguage: "ko-KR",
    articleSection: post.category,
    keywords: post.tags.join(", "),
    isAccessibleForFree: true,
    ...(imageUrl ? { image: imageUrl } : {}),
  };

  const content = `<main id="main">
    <div class="progress" id="reading-progress" aria-hidden="true"><span></span></div>
    ${articleCover(post, base)}
    <div class="wrap article-wrap">
      <nav class="breadcrumb" aria-label="현재 위치">
        <ol>
          <li><a href="${pageHref(base, "/")}">홈</a></li>
          <li><a href="${pageHref(base, "articles/")}">글 목록</a></li>
        </ol>
      </nav>
      <div class="article-layout">
        <aside class="article-aside aside-left" aria-label="목차">
          ${renderToc(post)}
        </aside>
        <article class="article" aria-labelledby="article-title" itemscope itemtype="https://schema.org/BlogPosting">
          <header class="article-head">
            <meta itemprop="headline" content="${esc(post.title)}">
            <meta itemprop="description" content="${esc(post.summary)}">
            <p class="article-byline">글 작성: <span>${esc(config.byline)}</span></p>
            ${indexable ? "" : `<p class="review-flag">검토 중인 글입니다. 근거와 표현을 다시 확인하고 있으며 검색 노출에서 제외했습니다.</p>`}
          </header>
          ${post.image && !/mshots|favicon|apple-touch-icon/.test(post.image) ? mediaFigure(post, base, { className: "source-media", eager: true }) : ''}
          ${renderKeyPoints(post)}
          ${renderEditorNote(post)}
          <div class="article-body" itemprop="articleBody">
            ${renderSections(post)}
          </div>
          ${post.sourceRefs.length ? `<p class="source-refs body-refs">전체 근거 ${post.sourceRefs
            .filter((ref) => ref >= 1 && ref <= post.sources.length)
            .map((ref) => `<a href="#source-${ref}">[${ref}]</a>`)
            .join(" ")}</p>` : ""}
          ${renderCorrections(post)}
          ${renderVideos(post)}
          ${renderSources(post)}
          ${renderRelated(post, posts, base)}
          <p class="article-back"><a href="${pageHref(base, "articles/")}">글 목록으로</a></p>
        </article>
        ${renderArticleRail(post, posts, base, config, canonical)}
      </div>
    </div>
  </main>`;

  return layout({
    config,
    base,
    active: "articles",
    title: `${post.title} | ${config.siteName}`,
    description: post.summary || config.description,
    canonicalPath: `/articles/${post.slug}/`,
    ogType: "article",
    ogImage: imageUrl,
    robots: indexable ? "" : "noindex,follow",
    bodyClass: "page-article",
    content,
    jsonLd: [articleJsonLd, breadcrumb],
    generatedAt,
  });
}

export function renderArticlesIndex({ config, base, posts, generatedAt }) {
  const sorted = sortPosts(posts);
  const categories = unique(sorted.map((post) => post.category));
  const rows = sorted
    .map((post) => {
      const state = isIndexable(post) ? "" : `<span class="archive-flag">검토 중</span>`;
      const hasImage = Boolean(post.image) && !/mshots|favicon|apple-touch-icon/.test(post.image);
      const dimensions = post.imageWidth && post.imageHeight ? ` width="${post.imageWidth}" height="${post.imageHeight}"` : '';
      return `<li class="archive-entry${hasImage ? ' has-thumb' : ' text-only'}" data-post-card data-category="${esc(post.category)}" data-search="${esc(searchText(post))}">
        <a href="${pageHref(base, `articles/${post.slug}/`)}">
          ${hasImage ? `<span class="archive-thumb${post.imageWidth > post.imageHeight * 3 && post.imageHeight ? ' is-wide' : ''}"><img src="${esc(post.image)}" alt="${esc(post.imageAlt || post.title)}"${dimensions} loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>` : ''}
          <div class="archive-copy">
            <span class="archive-cat">${esc(post.category)}</span>
            <strong>${esc(post.title)}</strong>
            <span class="archive-summary">${esc(post.summary)}</span>
            <span class="archive-date">게시 ${esc(formatKoreanDate(post.publishedAt))}</span>
            ${state}
          </div>
        </a>
      </li>`;
    })
    .join("\n        ");

  const content = `<main id="main">
    <div class="wrap simple-wrap" data-filter-scope>
      <header class="simple-head">
        <h1>글 목록</h1>
        <p>새로 게시한 글부터 보여줍니다.</p>
      </header>
      <section class="archive-search" id="archive-search" aria-label="글 검색과 분류">
        <div class="search-field">
          <label for="archive-search-input">글 검색</label>
          <input id="archive-search-input" type="search" data-search-input placeholder="검색어 입력" autocomplete="off">
        </div>
        <div class="filters" role="group" aria-label="카테고리 필터">
          <button class="filter is-active" type="button" data-filter="all" aria-pressed="true">전체</button>
          ${categories.map((category) => `<button class="filter" type="button" data-filter="${esc(category)}" aria-pressed="false">${esc(category)}</button>`).join("\n          ")}
        </div>
        <p class="list-status" data-list-status aria-live="polite">글 ${sorted.length}편</p>
      </section>
      <ol class="archive-list" data-post-list>
        ${rows}
      </ol>
      <p class="empty-state" data-empty-state hidden>검색 결과가 없습니다.</p>
    </div>
  </main>`;

  return layout({
    config,
    base,
    active: "articles",
    title: `AI·개발 도구·오픈소스 글 모음 | ${config.siteName}`,
    description: "AI 모델, 개발 도구, 오픈소스, 브라우저, 클라우드와 보안에 관한 글을 주제별로 찾아보세요. 사용 방법과 지원 범위를 공식 출처와 함께 정리했습니다.",
    canonicalPath: "/articles/",
    ogType: "website",
    bodyClass: "page-simple",
    content,
    jsonLd: [
      breadcrumbJsonLd(config, [
        { name: "홈", path: "/" },
        { name: "글 목록", path: "/articles/" },
      ]),
    ],
    generatedAt,
  });
}

function simplePage({ config, base, active, path, heading, lead, body, jsonLd = [] }) {
  const content = `<main id="main">
    <div class="wrap simple-wrap">
      <nav class="breadcrumb" aria-label="현재 위치">
        <ol>
          <li><a href="${pageHref(base, "/")}">홈</a></li>
          <li aria-current="page">${esc(heading)}</li>
        </ol>
      </nav>
      <article class="simple-body">
        <header class="simple-head">
          <h1>${esc(heading)}</h1>
          <p>${esc(lead)}</p>
        </header>
        ${body}
      </article>
    </div>
  </main>`;
  return layout({
    config,
    base,
    active,
    title: `${heading} | ${config.siteName}`,
    description: lead,
    canonicalPath: path,
    ogType: "website",
    bodyClass: "page-simple",
    content,
    jsonLd: [
      ...jsonLd,
      breadcrumbJsonLd(config, [
        { name: "홈", path: "/" },
        { name: heading, path },
      ]),
    ],
  });
}

export function renderAbout({ config, base, generatedAt }) {
  const body = `<section>
        <h2>다루는 내용</h2>
        <p>개발 도구와 오픈소스, AI 제품의 새 기능과 사용 방법을 소개합니다. 비용과 지원 범위도 함께 다루며, 각 글에 발표일과 원문 링크를 남깁니다.</p>
        <p>모든 글은 정적 HTML로 미리 생성됩니다. 자바스크립트가 없어도 본문과 출처를 읽을 수 있습니다.</p>
      </section>
      <section>
        <h2>운영</h2>
        <p>글의 바이라인은 <strong>${esc(config.byline)}</strong>입니다. 이 사이트는 사람 편집자 팀을 두지 않으며, 문장은 AI 보조로 작성하고 공개 데이터에 확인 시각과 출처를 함께 남기는 방식으로 운영합니다. 감수자를 따로 두지 않았다는 점을 숨기지 않습니다.</p>
      </section>
      <section>
        <h2>사이트 상태</h2>
        <ul class="fact-list">
          <li>운영 형태: 개인 프로젝트, 광고 없음, 후원 없음</li>
          <li>호스팅: GitHub Pages의 정적 파일</li>
          <li>구독자 수나 방문자 통계는 이 사이트가 수집하거나 공개하지 않습니다.</li>
          <li>문의와 오류 제보: <a href="${esc(config.issuesUrl)}" target="_blank" rel="noopener noreferrer">GitHub 이슈</a></li>
        </ul>
      </section>
      <section>
        <h2>마스코트</h2>
        <p>고양이 귀가 달린 흰색 로봇은 사이트 안내를 맡습니다. 홈 화면에서 로봇을 누르면 검색, 목차, 동작 줄이기 같은 사용 팁이 열립니다. 대화형 AI가 아니고 질문에 답하지 않습니다.</p>
      </section>`;
  return simplePage({
    config,
    base,
    active: "about",
    path: "/about.html",
    heading: "소개",
    lead: "공식 출처를 확인하고, 실제 사용 조건과 한계까지 함께 적는 사이트입니다.",
    body,
  });
}

export function renderEditorial({ config, base }) {
  const body = `<section>
        <h2>확인 순서</h2>
        <p>기업 공식 블로그, 제품 문서, 릴리스 노트, 원 저장소를 1차 근거로 씁니다. 커뮤니티 반응은 맥락을 보는 보조 자료로만 둡니다.</p>
        <p>글은 사실, 맥락, 실무 영향, 한계 순서로 구성합니다. 추정이나 해석은 사실 문장과 섞지 않고 '덧붙임'에서 구분합니다.</p>
      </section>
      <section>
        <h2>발표와 사용 가능 구분</h2>
        <p>공개 발표, 프리뷰, 제한 배포, 일반 제공(GA)을 같은 의미로 쓰지 않습니다. 각 글에는 상태(status)와 확인 시각(verifiedAt)을 따로 적습니다.</p>
      </section>
      <section>
        <h2>수치와 벤치마크</h2>
        <p>공급자가 자체 측정한 수치는 그 공급자의 측정값이라고 밝힙니다. 도입 판단에는 완료율, 재시도, 지연, 총비용처럼 워크플로 단위 지표를 우선하도록 안내합니다.</p>
      </section>
      <section>
        <h2>이미지</h2>
        <p>공식 발표의 대표 이미지나 제품 스크린샷을 우선하고, 이미지 출처를 캡션에 적습니다. 공식 이미지를 확보하지 못하면 이미지를 늘리지 않고 출처 카드로 대체합니다. 관계없는 스톡 이미지나 스크린샷 프록시는 쓰지 않습니다.</p>
      </section>
      <section>
        <h2>검토 중인 글</h2>
        <p>근거가 부족하거나 확인이 끝나지 않은 글은 reviewStatus를 unverified로 두고, 홈 목록과 사이트맵에서 빼며 noindex로 표시합니다. 주소를 아는 사람은 계속 읽을 수 있습니다. 사실 오류를 확인하면 새 글을 더하기 전에 기존 글을 먼저 정정하고 정정 기록을 남깁니다.</p>
      </section>
      <section>
        <h2>영상</h2>
        <p>공식 출처이고 검증된 영상 정보가 있을 때만 싣습니다. 영상은 누르기 전까지 YouTube에 요청을 보내지 않고, 재생할 때 개인정보 보호 모드(no-cookie)로 불러옵니다. 검증된 영상이 없으면 영상 영역을 만들지 않습니다.</p>
      </section>
      <section>
        <h2>정정 요청</h2>
        <p>오류는 <a href="${esc(config.issuesUrl)}" target="_blank" rel="noopener noreferrer">GitHub 이슈</a>로 알려 주세요. 확인되면 글의 정정 기록에 날짜와 내용을 남깁니다.</p>
      </section>`;
  return simplePage({
    config,
    base,
    active: "editorial",
    path: "/editorial.html",
    heading: "편집 원칙",
    lead: "무엇을 싣고 무엇을 빼는지, 어떤 순서로 확인하는지 정리했습니다.",
    body,
  });
}

export function renderContact({ config, base }) {
  const body = `<section>
        <h2>받는 것</h2>
        <ul class="fact-list">
          <li>사실 오류와 오래된 상태 정보 제보</li>
          <li>깨진 링크와 잘못된 출처 제보</li>
          <li>정정 요청과 근거 자료</li>
        </ul>
      </section>
      <section>
        <h2>보내는 곳</h2>
        <p>이 사이트는 별도 이메일 주소를 운영하지 않습니다. 제보는 저장소의 <a href="${esc(config.issuesUrl)}" target="_blank" rel="noopener noreferrer">GitHub 이슈</a>로 보내 주세요. 공개된 이슈라서 근거 링크를 함께 남기기 좋습니다.</p>
        <p>이슈에는 글 주소, 잘못된 부분, 확인할 수 있는 공식 링크를 적어 주시면 확인이 빠릅니다.</p>
      </section>
      <section>
        <h2>응답 범위</h2>
        <p>모든 제보에 답을 보장하지는 않습니다. 근거가 확인되면 글을 고치고 정정 기록을 남깁니다. 개인적인 사용법 질문이나 제품 지원 요청은 받지 않습니다.</p>
      </section>`;
  return simplePage({
    config,
    base,
    active: "contact",
    path: "/contact.html",
    heading: "문의",
    lead: "오류 제보와 정정 요청은 GitHub 이슈로 받습니다. 별도 이메일은 두지 않습니다.",
    body,
  });
}

export function renderPrivacy({ config, base }) {
  const body = `<section>
        <h2>수집하는 것</h2>
        <p>이 사이트는 회원 가입, 댓글, 로그인 기능이 없고 자체 분석 도구나 광고 스크립트를 넣지 않습니다. 사이트가 직접 쿠키를 설정하지 않습니다.</p>
      </section>
      <section>
        <h2>브라우저에 남는 값</h2>
        <p>동작 줄이기 설정을 기억하기 위해 브라우저의 로컬 저장소에 값 하나를 저장합니다. 이 값은 서버로 전송되지 않고 브라우저에서 지우면 사라집니다.</p>
      </section>
      <section>
        <h2>외부 요청</h2>
        <ul class="fact-list">
          <li>호스팅: GitHub Pages가 접속 기록을 처리합니다. 처리 방식은 GitHub의 정책을 따릅니다.</li>
          <li>영상: 검증된 공식 영상이 있는 글에서 재생을 누를 때만 YouTube no-cookie 도메인으로 요청을 보냅니다.</li>
          <li>출처 링크: 각 글의 출처와 자료 링크는 외부 사이트로 이동하며, 그 사이트의 정책이 적용됩니다.</li>
        </ul>
      </section>
      <section>
        <h2>바뀌면</h2>
        <p>수집 항목이나 외부 요청이 바뀌면 이 페이지를 먼저 고칩니다. 이 페이지의 내용은 저장소의 공개 기록으로 확인할 수 있습니다.</p>
      </section>`;
  return simplePage({
    config,
    base,
    active: "privacy",
    path: "/privacy.html",
    heading: "개인정보",
    lead: "계정도, 자체 분석도, 광고도 두지 않습니다. 실제로 일어나는 외부 요청만 적었습니다.",
    body,
  });
}

export function render404({ config, base }) {
  const content = `<main id="main">
    <div class="wrap simple-wrap not-found">
      <p class="not-found-mark" aria-hidden="true">404</p>
      <h1>페이지를 찾지 못했습니다.</h1>
      <p>주소가 바뀌었거나 글이 내려갔을 수 있습니다. 글 목록에서 다시 찾아보세요.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="${pageHref(base, "articles/")}">글 목록</a>
        <a class="btn btn-ghost" href="${pageHref(base, "/")}">홈으로 가기</a>
      </div>
    </div>
  </main>`;
  return layout({
    config,
    base,
    active: "",
    title: `페이지를 찾지 못했습니다 | ${config.siteName}`,
    description: "요청한 페이지를 찾지 못했습니다.",
    canonicalPath: "/404.html",
    ogType: "website",
    robots: "noindex",
    bodyClass: "page-simple",
    content,
    jsonLd: [],
  });
}

// Old post.html?slug= links keep working. The script redirects when it can,
// and the static list below stays readable when JavaScript is unavailable.
export function renderPostCompat({ config, base, posts }) {
  const map = {};
  for (const post of posts) map[post.slug] = pageHref(base, `articles/${post.slug}/`);
  const rows = posts
    .map(
      (post) => `<li>
        <a href="${pageHref(base, `articles/${post.slug}/`)}">
          <strong>${esc(post.title)}</strong>
          <span>${esc(post.category)}</span>
        </a>
      </li>`,
    )
    .join("\n        ");

  const content = `<main id="main">
    <div class="wrap simple-wrap">
      <article class="simple-body">
        <header class="simple-head">
          <h1>글 주소가 바뀌었습니다</h1>
          <p>예전 주소로 들어오셨습니다. 잠시 뒤 해당 글로 이동합니다. 이동하지 않으면 아래 목록에서 글을 고르세요.</p>
        </header>
        <p class="compat-status" id="compat-status" role="status" aria-live="polite"></p>
        <ol class="archive-list">
          ${rows}
        </ol>
      </article>
    </div>
  </main>
  <script>
    (function () {
      var map = ${jsonEmbed(map)};
      var slug = new URLSearchParams(location.search).get("slug");
      var target = slug && map[slug];
      var status = document.getElementById("compat-status");
      if (target) {
        if (status) status.textContent = "해당 글로 이동합니다: " + slug;
        location.replace(target);
      } else if (status) {
        status.textContent = "주소에서 글을 찾지 못했습니다. 아래 전체 목록을 확인하세요.";
      }
    })();
  </script>`;

  return layout({
    config,
    base,
    active: "",
    title: `글 주소 안내 | ${config.siteName}`,
    description: "예전 글 주소를 새 주소로 연결합니다.",
    canonicalPath: "/post.html",
    ogType: "website",
    robots: "noindex,follow",
    bodyClass: "page-simple",
    content,
    jsonLd: [],
  });
}

export function renderFeed({ config, posts }) {
  const indexable = sortPosts(posts.filter(isIndexable));
  const latest = indexable
    .map((post) => laterDate(post.publishedAt, post.verifiedAt))
    .reduce((best, value) => (sortKey(value) > sortKey(best) ? value : best), "");
  const items = indexable
    .map((post) => {
      const url = joinUrl(config.baseUrl, `/articles/${post.slug}/`);
      return `<item>
      <title>${esc(post.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${esc(toRfc822(post.publishedAt))}</pubDate>
      <category>${esc(post.category)}</category>
      <description>${esc(post.summary)}</description>
    </item>`;
    })
    .join("\n    ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(config.rssTitle)}</title>
    <link>${esc(joinUrl(config.baseUrl, "/"))}</link>
    <description>${esc(config.description)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${esc(toRfc822(latest))}</lastBuildDate>
    ${items}
  </channel>
</rss>
`;
}

export function renderSitemap({ config, paths }) {
  const urls = paths
    .map((entry) => {
      const lines = [`    <loc>${esc(joinUrl(config.baseUrl, entry.path))}</loc>`];
      if (entry.lastmod) lines.push(`    <lastmod>${esc(entry.lastmod)}</lastmod>`);
      return `  <url>\n${lines.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
