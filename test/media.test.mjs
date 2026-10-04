import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizePost, sortPosts } from '../build/lib/data.mjs';
import { renderArticle, renderArticlesIndex, renderHome } from '../build/lib/templates.mjs';

const config = JSON.parse(fs.readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const base = '/BlueBWorks';
const raw = {
  slug: 'media-example', title: '화면으로 보는 변경', summary: '공식 문서 화면을 설명합니다.',
  category: '개발도구', announcedAt: '2026-10-01', publishedAt: '2026-10-04T10:00:00+09:00',
  verifiedAt: '2026-10-04T09:00:00+09:00', reviewStatus: 'reviewed',
  image: 'https://example.com/screen.png', imageAlt: '실제 설정 화면', imageCredit: '원 저작자 · CC BY 4.0',
  imageWidth: 1000, imageHeight: 600, imageSourceUrl: 'https://example.com/guide',
  imageCaption: '선택한 옵션과 적용 범위를 확인하는 화면.',
  sections: [{ title: '화면 읽기', paragraphs: ['변경된 위치를 확인합니다.'], sourceRefs: [1] }],
  sources: [{ name: '공식 문서', url: 'https://example.com/guide' }],
};
const make = changes => normalizePost({ ...raw, ...changes });

test('cover metadata is preserved and unsafe URLs or invalid dimensions are dropped', () => {
  const post = make();
  assert.equal(post.imageWidth, 1000);
  assert.equal(post.imageHeight, 600);
  assert.equal(post.imageCaption, raw.imageCaption);
  assert.equal(post.imageSourceUrl, raw.imageSourceUrl);
  const unsafe = make({ image: 'javascript:alert(1)', imageSourceUrl: 'data:text/html,unsafe', imageWidth: -20, imageHeight: '100' });
  assert.equal(unsafe.image, '');
  assert.equal(unsafe.imageSourceUrl, '');
  assert.equal(unsafe.imageWidth, 0);
  assert.equal(unsafe.imageHeight, 0);
});

test('archive has a linked real thumbnail and no blank image for text-only posts', () => {
  const posts = [make(), make({ slug: 'without-media', image: '', imageSourceUrl: '' })];
  const html = renderArticlesIndex({ config, base, posts });
  const rows = html.match(/<li class="archive-entry[\s\S]*?<\/li>/g);
  assert.equal(rows.length, 2);
  assert.match(rows[0], /archive-thumb/);
  assert.match(rows[0], /width="1000" height="600"/);
  assert.match(rows[0], /href="\/BlueBWorks\/articles\/media-example\/"/);
  assert.match(rows[1], /text-only/);
  assert.doesNotMatch(rows[1], /<img|archive-thumb|mascot|media-source/);
  assert.match(html, /블로그 게시일순/);
});

test('article cover links the source and full image and escapes the caption', () => {
  const post = make({ imageCaption: '설정 <script>not executable</script>' });
  const html = renderArticle({ config, base, post, posts: [post] });
  const figure = html.match(/<figure class="source-media">[\s\S]*?<\/figure>/)?.[0];
  assert.ok(figure);
  assert.match(figure, /data-zoom-image/);
  assert.match(figure, /width="1000" height="600"/);
  assert.match(figure, /href="https:\/\/example.com\/guide"/);
  assert.match(figure, /https:\/\/creativecommons.org\/licenses\/by\/4.0\//);
  assert.match(figure, /&lt;script&gt;not executable&lt;\/script&gt;/);
  assert.doesNotMatch(figure, /<script>/);
});

test('image-less articles do not use unrelated site artwork for social cards', () => {
  const post = make({ image: '' });
  const html = renderArticle({ config, base, post, posts: [post], heroImageUrl: 'https://example.com/unrelated-space.jpg' });
  assert.doesNotMatch(html, /unrelated-space\.jpg|<figure class="source-media">/);
});

test('image edits leave both article dates and publication order unchanged', () => {
  const older = make({ slug: 'older', publishedAt: '2026-10-03T10:00:00+09:00' });
  const post = make({ image: 'https://example.com/updated-screen.png' });
  assert.equal(post.publishedAt, raw.publishedAt);
  assert.equal(post.announcedAt, raw.announcedAt);
  assert.equal(post.verifiedAt, raw.verifiedAt);
  assert.deepEqual(sortPosts([older, post]).map(p => p.slug), ['media-example', 'older']);
});
