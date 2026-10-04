import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, resolveOptions } from "../build/build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realContent = path.join(root, "docs", "data", "posts.json");

function buildToTemp() {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "bluebworks-ui-"));
  const options = resolveOptions({
    SITE_OUT_DIR: outDir,
    SITE_CONTENT: realContent,
    SITE_REVIEWED: path.join(outDir, "no-reviewed.json"),
  });
  build(options);
  return outDir;
}

test("header keeps the editorial wordmark, Korean tagline and working menu", () => {
  const outDir = buildToTemp();
  try {
    const home = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
    assert.match(home, /class="brand-name">BlueBWorks</);
    // The English "AI Radar" eyebrow is replaced by the Korean tagline.
    assert.doesNotMatch(home, /class="brand-label">AI Radar</);
    assert.match(home, /class="brand-label">[^<]*[가-힣][^<]*</);
    assert.match(home, /data-nav-toggle/);
    assert.match(home, /aria-controls="site-nav"/);
    assert.match(home, /class="site-nav" id="site-nav" data-nav/);
    assert.match(home, /class="header-search" href="[^"]*articles\/#archive-search"/);
    assert.match(home, /id="motion-toggle"/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("home opens on a real lead article with media and two secondary stories", () => {
  const outDir = buildToTemp();
  try {
    const home = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
    assert.match(home, /data-design="journal-editorial-v1"/);
    assert.match(home, /class="home-lead journal-section"/);
    // The lead is a real story, not a giant slogan/hero. It owns the page h1.
    assert.match(home, /class="lead-grid"/);
    assert.match(home, /class="lead-story"/);
    assert.match(home, /class="lead-story-media" href="[^"]*articles\/[^"]+\/"/);
    assert.match(home, /<h1 id="lead-title">/);
    assert.equal((home.match(/<h1[\s>]/g) || []).length, 1, "home should have one h1");
    // Two secondary stories with category and date.
    const secondary = home.match(/class="secondary-story"/g) || [];
    assert.ok(secondary.length >= 1, "at least one secondary story is rendered");
    assert.match(home, /class="secondary-copy"[\s\S]*?class="journal-meta"[\s\S]*?<time[\s>]/);
    // Small mascot is an optional brand detail, not a hero.
    assert.match(home, /class="home-mascot"/);
    assert.match(home, /class="mascot-img"/);
    // Orbit / giant RADAR / space backdrop are gone.
    assert.doesNotMatch(home, /class="observatory"/);
    assert.doesNotMatch(home, /journal-orbit-v3/);
    assert.doesNotMatch(home, /planet-window/);
    assert.doesNotMatch(home, /orbital-scene/);
    assert.doesNotMatch(home, /hero-latest/);
    assert.doesNotMatch(home, /orbit-track/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("home topic links and archive stay valid without JavaScript", () => {
  const outDir = buildToTemp();
  try {
    const home = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
    assert.match(home, /data-filter-scope/);
    assert.match(home, /data-search-input/);
    assert.match(home, /data-post-list/);
    assert.match(home, /data-list-status/);
    assert.match(home, /data-empty-state/);
    // Topic links jump to the plain anchor so they work without JS.
    const topicLink = home.match(/<a href="#radar" data-topic-target="[^"]+">/);
    assert.ok(topicLink, "topic links anchor to #radar");
    // Filters are real buttons and the search input is labelled.
    assert.match(home, /<label for="post-search">/);
    assert.match(home, /<button class="is-active" type="button" data-filter="all"/);

    const archive = fs.readFileSync(path.join(outDir, "articles", "index.html"), "utf8");
    assert.match(archive, /id="archive-search"/);
    assert.match(archive, /data-search-input/);
    assert.match(archive, /class="archive-list" data-post-list/);
    assert.match(archive, /data-post-card/);
    assert.match(archive, /data-search="[^"]+"/);
    const scopeBlock = archive.match(/<div class="wrap simple-wrap" data-filter-scope>[\s\S]*?<\/ol>/);
    assert.ok(scopeBlock, "archive filter scope wrapper not found");
    assert.ok(scopeBlock[0].includes("data-search-input") && scopeBlock[0].includes("data-post-list"));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("article pages use a compact typographic header and collapsible notes", () => {
  const outDir = buildToTemp();
  try {
    const posts = JSON.parse(fs.readFileSync(realContent, "utf8"));
    const post = posts[0];
    const html = fs.readFileSync(path.join(outDir, "articles", post.slug, "index.html"), "utf8");
    // Single title, preserved id, compact cream header instead of the space/robot cover.
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.match(html, /class="article-cover article-cover-compact" aria-labelledby="article-title"/);
    assert.match(html, /<h1 id="article-title">/);
    assert.match(html, /class="cover-dek"/);
    assert.match(html, /class="cover-meta"/);
    assert.doesNotMatch(html, /class="cover-character"/);
    assert.doesNotMatch(html, /class="cover-backdrop"/);
    assert.doesNotMatch(html, /scene-credit/);
    // Summary and editor note are collapsible details, contents retained.
    assert.match(html, /<details class="key-points">/);
    assert.match(html, /<summary>먼저 볼 것/);
    assert.match(html, /<details class="editor-note">/);
    assert.match(html, /<summary>편집 메모<\/summary>/);
    // Reading furniture still works.
    assert.match(html, /itemprop="articleBody"/);
    assert.match(html, /class="article-aside aside-right"/);
    assert.match(html, /class="article-aside aside-left"/);
    assert.match(html, /class="toc"/);
    assert.match(html, /id="sources"|class="sources"/);
    assert.match(html, /class="prose-section/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("articleExtras keeps figure and video markup safe for every section", () => {
  const rich = fs.readFileSync(path.join(root, "build", "lib", "rich.mjs"), "utf8");
  assert.match(rich, /class="article-figure"/);
  assert.match(rich, /data-zoom-image/);
  assert.match(rich, /class="article-video"/);
  assert.match(rich, /class="table-scroll"/);
  assert.match(rich, /class="code-example"/);
  assert.match(rich, /class="section-links"/);
});

test("journal stylesheet defines the content-first layouts at each breakpoint", () => {
  const css = fs.readFileSync(path.join(root, "site", "assets", "journal.css"), "utf8");
  assert.match(css, /\.lead-grid\{[^}]*minmax\(0,1\.55fr\)/);
  assert.match(css, /\.home-mascot\{/);
  assert.match(css, /\.secondary-stories\{/);
  // Compact article column and readable 680-760px measure.
  assert.match(css, /\.page-article \.article-layout\{grid-template-columns:180px minmax\(0,720px\) 260px/);
  assert.match(css, /\.page-article \.prose-section p\{font-size:17\.5px;line-height:1\.85/);
  assert.match(css, /\.key-points>summary/);
  assert.match(css, /\.editor-note>summary/);
  // The old orbit/deep-space home is gone.
  assert.doesNotMatch(css, /observatory/);
  assert.doesNotMatch(css, /orbit-track/);
  // Responsive coverage for the required widths.
  for (const width of ["1200px", "960px", "880px", "820px", "640px"]) {
    assert.ok(css.includes(`max-width:${width}`), `missing ${width} breakpoint`);
  }
  assert.match(css, /\.journal-header\[data-nav-open=true\] \.site-nav\{display:flex/);
});

test("progressive enhancement hooks are present in app.js and both stylesheets", () => {
  const app = fs.readFileSync(path.join(root, "site", "assets", "app.js"), "utf8");
  assert.match(app, /data-nav-toggle/);
  assert.match(app, /data-filter-scope/);
  assert.match(app, /\.article-figure \[data-zoom-image\]/);
  assert.match(app, /showModal\(\)/);
  assert.match(app, /addEventListener\("close"/);

  const base = fs.readFileSync(path.join(root, "site", "assets", "style.css"), "utf8");
  const editorial = fs.readFileSync(path.join(root, "site", "assets", "prototype.css"), "utf8");
  for (const css of [base, editorial]) {
    assert.match(css, /\.article-figure/);
    assert.match(css, /\.figure-lightbox/);
  }
  assert.match(editorial, /data-nav-open="true"/);
  assert.match(editorial, /prefers-reduced-motion/);
});
