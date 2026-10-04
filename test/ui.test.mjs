import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, resolveOptions } from '../build/build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const realContent = path.join(root, 'docs/data/posts.json');
function withBuild(run) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bluebworks-ui-'));
  try {
    build(resolveOptions({ SITE_OUT_DIR: out, SITE_CONTENT: realContent, SITE_REVIEWED: path.join(root, 'content/reviewed-posts.json') }));
    run(name => fs.readFileSync(path.join(out, name), 'utf8'), out);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
}

test('single-row brand and navigation keep accessible search and mobile menu', () => withBuild(read => {
  const home = read('index.html');
  assert.match(home, /class="brand-name">BlueBWorks/);
  assert.match(home, /개발 도구 · 오픈소스 · AI/);
  assert.match(home, /data-nav-toggle/);
  assert.match(home, /aria-controls="site-nav"/);
  assert.match(home, /class="site-nav" id="site-nav" data-nav/);
  assert.match(home, /class="header-search" href="[^"]*articles\/#archive-search"/);
  assert.match(home, /class="skip-link" href="#main"/);
}));

test('home labels the visual feature and preserves actual latest stories separately', () => withBuild(read => {
  const home = read('index.html');
  assert.match(home, /data-design="editorial-edition-6"/);
  assert.match(home, /추천 글/);
  assert.match(home, /class="lead-story-media" href="[^"]*articles\/[^"]+\/"/);
  assert.equal((home.match(/<h1[\s>]/g) || []).length, 1);
  assert.equal((home.match(/class="secondary-story"/g) || []).length, 3);
  assert.match(home, /aria-label="최근 글"/);
  assert.match(home, /class="mascot-button"[^>]*aria-controls="mascot-notes"/);
  assert.match(home, /width="48" height="48"/);
  assert.doesNotMatch(home, /data-parallax|orbit-track|planet-window|cover-backdrop/);
}));

test('home and archive expose all article links without JavaScript and share labelled filters', () => withBuild(read => {
  for (const file of ['index.html', 'articles/index.html']) {
    const html = read(file);
    for (const hook of ['data-filter-scope', 'data-search-input', 'data-post-list', 'data-list-status', 'data-empty-state']) assert.ok(html.includes(hook), `${file}: missing ${hook}`);
    assert.match(html, /data-filter="all"/);
    assert.match(html, /data-post-card/);
    assert.match(html, /data-search="[^"]+"/);
    assert.match(html, /href="[^"]*articles\/git-2-56-2026\/"/);
  }
  assert.match(read('index.html'), /<label[^>]*for="post-search"/);
  assert.match(read('articles/index.html'), /id="archive-search"/);
}));

test('article has one visible title and summary, with content, sources and both dates intact', () => withBuild(read => {
  const html = read('articles/github-copilot-code-review-api-2026/index.html');
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /id="article-title"/);
  assert.equal((html.match(/class="cover-dek"/g) || []).length, 1);
  assert.doesNotMatch(html, /<p class="article-dek"/);
  assert.match(html, /<details class="key-points">[\s\S]*?<summary>요약/);
  assert.match(html, /<details class="editor-note">[\s\S]*?<summary>덧붙임/);
  for (const token of ['itemprop="articleBody"', 'aside-right', 'aside-left', 'class="toc"', 'id="sources"', 'data-zoom-image', '블로그 게시', '소식 발표']) assert.ok(html.includes(token), `missing ${token}`);
  assert.doesNotMatch(html, /class="section-number"|class="cover-character"|class="cover-backdrop"/);
}));

test('all public pages use one theme and omit the rejected interface copy', () => withBuild((read, out) => {
  const files = ['index.html', 'articles/index.html', 'about.html', 'editorial.html', 'contact.html', 'privacy.html', 'articles/git-2-56-2026/index.html'];
  for (const file of files) {
    const html = read(file);
    assert.match(html, /journal\.css\?v=edition6/);
    assert.doesNotMatch(html, /href="[^"]*\/(?:style|prototype)\.css/);
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
    for (const phrase of ['쌓아둔 기록', '제목, 모델, 도구 이름으로 찾아보세요', '모델과 도구, 지금 읽을 이야기', '기술을 읽는 저널', '원문으로 가기']) assert.ok(!html.includes(phrase), `${file}: rejected copy ${phrase}`);
  }
  assert.match(read('about.html'), /AI/); // Transparency is not removed with the marketing copy.
}));

test('one stylesheet covers responsive reading, accessibility and real-image presentation', () => {
  const css = fs.readFileSync(path.join(root, 'site/assets/journal.css'), 'utf8');
  assert.match(css, /--paper:#fff/);
  assert.match(css, /--serif:var\(--display\)/);
  assert.match(css, /grid-template-columns:minmax\(0,740px\) minmax\(0,220px\)/);
  assert.match(css, /\.prose-section p\{font-size:18px;line-height:1\.95/);
  assert.match(css, /\.source-media img\{[^}]*height:auto/);
  assert.match(css, /\.figure-lightbox/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  for (const width of ['1200px', '960px', '720px', '380px']) assert.ok(css.includes(`max-width:${width}`));
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|backdrop-filter|@keyframes|orbit-track/);
});

test('progressive enhancement preserves menus, filters, image zoom and safe rich media', () => {
  const app = fs.readFileSync(path.join(root, 'site/assets/app.js'), 'utf8');
  for (const token of ['data-nav-toggle', 'data-filter-scope', 'showModal()', 'data-zoom-image']) assert.ok(app.includes(token));
  const rich = fs.readFileSync(path.join(root, 'build/lib/rich.mjs'), 'utf8');
  for (const token of ['article-figure', 'data-zoom-image', 'article-video', 'table-scroll', 'code-example', 'section-links']) assert.ok(rich.includes(token));
});
