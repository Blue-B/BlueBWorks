import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, resolveOptions } from '../build/build.mjs';
import { normalizeEmbed, normalizePost } from '../build/lib/data.mjs';
import { articleExtras, hasEmbeds } from '../build/lib/rich.mjs';
import { inspectPublication } from '../build/publication-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const embed = { type: 'x', url: 'https://x.com/Google/status/2115489522603466766', text: 'Introducing Gemini 4 Carbon', author: 'Google', handle: 'Google', postedAt: '2026-10-28T17:03:00Z' };

test('only official X status URLs with quoted text become embeds', () => {
  assert.ok(normalizeEmbed(embed));
  assert.equal(normalizeEmbed({ ...embed, url: 'https://x.com/Google/status/1?s=20' }), null);
  assert.equal(normalizeEmbed({ ...embed, url: 'https://example.com/Google/status/1' }), null);
  assert.equal(normalizeEmbed({ ...embed, text: '' }), null);
  assert.equal(normalizeEmbed({ ...embed, type: 'youtube' }), null);
});

test('X embed keeps a readable quote and original link without JavaScript', () => {
  const html = articleExtras({ embeds: [normalizeEmbed(embed)] });
  assert.match(html, /<blockquote class="twitter-tweet" data-dnt="true"/);
  assert.match(html, /Introducing Gemini 4 Carbon/);
  assert.match(html, /href="https:\/\/x\.com\/Google\/status\/2115489522603466766"/);
  assert.match(html, /X에서 원문 보기/);
  assert.doesNotMatch(html, /<script/);
});

test('stat cards and FAQ render as static HTML', () => {
  const post = normalizePost({ slug: 's', title: 't', sections: [{ title: 'FAQ', paragraphs: ['p'], stats: [{ value: '59점', label: 'AA 지수' }, { value: '', label: 'dropped' }], faq: [{ question: '무료인가?', answer: '아니다.' }] }] });
  const html = articleExtras(post.sections[0]);
  assert.equal(post.sections[0].stats.length, 1);
  assert.match(html, /class="stat-card"[\s\S]*59점/);
  assert.match(html, /<h3>무료인가\?<\/h3><p>아니다\.<\/p>/);
  assert.equal(hasEmbeds(post), false);
});

test('FAQ answers count toward the explanatory body', () => {
  const article = JSON.parse(fs.readFileSync(path.join(root, 'content/articles/gemini-4-carbon-2026.json'), 'utf8'));
  assert.deepEqual(inspectPublication(article), []);
  const faqSection = article.sections.find(section => Array.isArray(section.faq) && section.faq.length);
  assert.ok(faqSection, 'gemini article keeps its FAQ section');
});

test('widgets.js loads once only on pages with X embeds; share image tags match the cover', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bluebworks-embed-'));
  try {
    build(resolveOptions({ SITE_OUT_DIR: out, SITE_CONTENT: path.join(root, 'docs/data/posts.json'), SITE_REVIEWED: path.join(root, 'content/reviewed-posts.json') }));
    const read = name => fs.readFileSync(path.join(out, name), 'utf8');
    const withEmbed = read('articles/gemini-4-carbon-2026/index.html');
    assert.equal((withEmbed.match(/platform\.twitter\.com\/widgets\.js/g) || []).length, 1);
    assert.match(withEmbed, /<script async src="https:\/\/platform\.twitter\.com\/widgets\.js"/);
    assert.match(withEmbed, /"@type":"FAQPage"/);
    const og = withEmbed.match(/<meta property="og:image" content="([^"]+)">/)?.[1];
    const tw = withEmbed.match(/<meta name="twitter:image" content="([^"]+)">/)?.[1];
    assert.ok(og && og.endsWith('.png'), 'cover share image must be a raster PNG');
    assert.equal(tw, og);
    for (const page of ['index.html', 'articles/index.html', 'articles/git-2-56-2026/index.html']) {
      assert.doesNotMatch(read(page), /platform\.twitter\.com\/widgets\.js/, page);
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
