import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectArticle, checkAuthoredArticles } from '../build/editorial-check.mjs';
import { loadPosts, normalizePost } from '../build/lib/data.mjs';
import { articleExtras } from '../build/lib/rich.mjs';

const dir = new URL('../content/articles/', import.meta.url);
const sample = JSON.parse(fs.readFileSync(new URL('cloudflare-protected-quick-tunnels-2026.json', dir), 'utf8'));

test('authored articles meet structural publication requirements', () => {
  assert.deepEqual(checkAuthoredArticles().errors, []);
});

test('short filler and broken reference numbers are rejected', () => {
  const short = structuredClone(sample);
  short.sections = [{ title: '설명', paragraphs: ['짧은 요약'], sourceRefs: [99] }];
  const errors = inspectArticle(short);
  assert.ok(errors.some(error => error.includes('3000')));
  assert.ok(errors.some(error => error.includes('sourceRefs')));
  const duplicate = structuredClone(sample);
  duplicate.sections[1].paragraphs.push(duplicate.sections[0].paragraphs[0]);
  assert.ok(inspectArticle(duplicate).some(error => error.includes('duplicated paragraphs')));
});

test('original-source figures and video survive normalization and escape captions', () => {
  const raw = structuredClone(sample);
  raw.sections[0].figures = [{ src: 'https://example.com/screen.png', sourceUrl: 'https://example.com/article', alt: '설정 <화면>', caption: '<script>bad()</script>', credit: 'Original', width: 900, height: 500 }];
  raw.sections[0].video = { src: 'https://example.com/demo.mp4', sourceUrl: 'https://example.com/article', caption: '공식 시연', credit: 'Original', verified: true };
  const normalized = normalizePost(raw);
  assert.equal(normalized.sections[0].figures[0].width, 900);
  const html = articleExtras(normalized.sections[0]);
  assert.ok(html.includes('data-zoom-image'));
  assert.ok(html.includes('preload="none"'));
  assert.ok(html.includes('controls'));
  assert.ok(!html.includes('autoplay'));
  assert.ok(!html.includes('<script>bad()'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('unverified or unsafe media URLs are never embedded', () => {
  const raw = structuredClone(sample);
  raw.sections[0].figures = [{ src: 'javascript:alert(1)', sourceUrl: 'https://example.com', alt: 'bad', credit: 'bad' }];
  raw.sections[0].links = [{ label: 'unsafe', url: 'data:text/html,unsafe' }];
  raw.sections[0].video = { src: 'https://example.com/unverified.mp4', sourceUrl: 'https://example.com', verified: false };
  const section = normalizePost(raw).sections[0];
  assert.deepEqual(section.figures, []);
  assert.deepEqual(section.links, []);
  assert.equal(section.video, null);
});

test('article files supersede legacy briefs and append new slugs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bluebworks-editorial-'));
  try {
    const contentPath = path.join(tmp, 'base.json');
    const reviewedPath = path.join(tmp, 'reviewed.json');
    fs.writeFileSync(contentPath, JSON.stringify([{ ...sample, title: '기존 요약' }]));
    fs.writeFileSync(reviewedPath, '[]');
    fs.mkdirSync(path.join(tmp, 'articles'));
    fs.writeFileSync(path.join(tmp, 'articles', `${sample.slug}.json`), JSON.stringify(sample));
    fs.writeFileSync(path.join(tmp, 'articles', 'new-example.json'), JSON.stringify({ ...sample, slug: 'new-example' }));
    const posts = loadPosts({ contentPath, reviewedPath });
    assert.equal(posts.length, 2);
    assert.equal(posts.find(post => post.slug === sample.slug).title, sample.title);
    assert.equal(posts[0].sections.length, sample.sections.length);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
