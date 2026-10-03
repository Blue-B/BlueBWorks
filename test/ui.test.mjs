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

test("header exposes a typographic wordmark, real search link and menu toggle", () => {
  const outDir = buildToTemp();
  try {
    const home = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
    assert.match(home, /class="brand-name">BlueBWorks</);
    assert.match(home, /class="brand-label">AI Radar</);
    assert.match(home, /data-nav-toggle/);
    assert.match(home, /aria-controls="site-nav"/);
    assert.match(home, /class="site-nav" id="site-nav" data-nav/);
    assert.match(home, /class="header-search" href="[^"]*articles\/#archive-search"/);
    assert.match(home, /id="motion-toggle"/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("home hero cues the latest article and keeps the mascot scene", () => {
  const outDir = buildToTemp();
  try {
    const home = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
    assert.match(home, /class="[^"]*hero-latest/);
    assert.match(home, /data-design="journal-orbit-v3"/);
    assert.match(home, /class="site-header journal-header"/);
    assert.match(home, /data-topic-target=/);
    assert.match(home, /assets\/journal\.css/);
    assert.match(home, /class="hero-latest-link" href="[^"]*articles\/[^"]+\/"/);
    assert.match(home, /class="mascot-img"/);
    assert.match(home, /assets\/earth-night\.jpg/);
    // The generic, repeated hero CTA is gone.
    assert.ok(!home.includes("최신 글 보기"));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("home and archive share the searchable filter scope", () => {
  const outDir = buildToTemp();
  try {
    const home = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
    assert.match(home, /data-filter-scope/);
    assert.match(home, /data-search-input/);
    assert.match(home, /data-post-list/);
    assert.match(home, /data-list-status/);
    assert.match(home, /data-empty-state/);

    const archive = fs.readFileSync(path.join(outDir, "articles", "index.html"), "utf8");
    assert.match(archive, /id="archive-search"/);
    assert.match(archive, /data-search-input/);
    assert.match(archive, /class="archive-list" data-post-list/);
    assert.match(archive, /data-post-card/);
    assert.match(archive, /data-search="[^"]+"/);
    // The search input, filters and the list must share one filter scope so
    // the client script can wire them together.
    const scopeBlock = archive.match(/<div class="wrap simple-wrap" data-filter-scope>[\s\S]*?<\/ol>/);
    assert.ok(scopeBlock, "archive filter scope wrapper not found");
    assert.ok(scopeBlock[0].includes("data-search-input") && scopeBlock[0].includes("data-post-list"));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("article pages keep the static body and a single article title", () => {
  const outDir = buildToTemp();
  try {
    const posts = JSON.parse(fs.readFileSync(realContent, "utf8"));
    const post = posts[0];
    const html = fs.readFileSync(path.join(outDir, "articles", post.slug, "index.html"), "utf8");
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
    assert.match(html, /class="article-figure|class="prose-section/);
    assert.match(html, /itemprop="articleBody"/);
    assert.match(html, /class="article-aside aside-right"/);
    assert.match(html, /class="toc"/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
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
