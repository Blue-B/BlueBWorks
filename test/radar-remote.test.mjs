import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../tools/discover-sources.mjs';
import { checkRemote } from '../tools/remote-publication-check.mjs';

test('RSS and Atom source discovery handles valid dates and rejects stale items', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  const rss = '<rss><item><title>Release A</title><link>https://example.com/a</link><pubDate>Tue, 27 Oct 2026 12:00:00 GMT</pubDate></item><item><title>Old</title><link>https://example.com/old</link><pubDate>Tue, 20 Oct 2026 12:00:00 GMT</pubDate></item></rss>';
  assert.equal(parseFeed(rss, 'RSS', now).length, 1);
  const atom = '<feed><entry><title>Release B</title><link rel="alternate" href="https://example.com/b"/><updated>2026-10-28T00:00:00Z</updated></entry></feed>';
  assert.equal(parseFeed(atom, 'Atom', now)[0].url, 'https://example.com/b');
});

test('remote publication check rejects a missing public listing', async () => {
  const fetcher = async url => ({ ok: true, text: async () => url.includes('/articles/smoke/')
    ? '<title>Smoke</title><link rel="canonical" href="https://blue-b.github.io/BlueBWorks/articles/smoke/"><div class="article-body"></div><script type="application/ld+json"></script>'
    : '<html>no new article</html>' });
  await assert.rejects(checkRemote({ slug: 'smoke', expectedTitle: 'Smoke', fetcher }), /does not list article/);
});
