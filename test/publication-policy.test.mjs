import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPublication, prose } from '../build/publication-check.mjs';

function article() {
  return { slug: 'fixture', editorialVersion: 2, publishedAt: '2026-10-07T09:00:00+09:00',
    sections: Array.from({ length: 5 }, (_, index) => ({ title: `section ${index}`, paragraphs: [`${index} ${'가나다라 '.repeat(80)}`, '마바사아 '.repeat(85)] })),
    sources: [{ url: 'https://example.com/release' }, { url: 'https://example.com/docs' }],
    discovery: { xStatus: 'unavailable', notes: 'X access unavailable; used verified official sources.' },
    mediaReview: { checkedAt: '2026-10-07T08:00:00+09:00', status: 'unavailable', omittedReason: 'No relevant reusable image in the checked materials.', candidates: [
      { sourceUrl: 'https://example.com/release', decision: 'excluded', reason: 'No visual explaining this change.' },
      { sourceUrl: 'https://example.com/docs', decision: 'excluded', reason: 'Image reuse terms not established.' }
    ] }
  };
}
test('complete new article can explicitly document unavailable X and images', () => assert.deepEqual(inspectPublication(article()), []));
test('pre-rollout articles remain compatible without silently changing dates', () => assert.deepEqual(inspectPublication({ slug: 'old', publishedAt: '2026-10-04T09:00:00+09:00' }), []));
test('new articles cannot omit the new policy marker', () => { const a = article(); delete a.editorialVersion; assert.match(inspectPublication(a).join('\n'), /editorialVersion/); });
test('short body fails even with a very long summary', () => { const a = article(); a.summary = '요약'.repeat(4000); a.sections[0].paragraphs = ['짧음']; assert.match(inspectPublication(a).join('\n'), /at least 4000/); });
test('code and raw links cannot pad explanatory prose', () => assert.equal(prose('앞 [설명](https://example.com) ```js\n' + 'code'.repeat(200) + '\n``` 뒤 https://example.com/long'), '앞 설명  뒤'));
test('overlong paragraphs fail without requiring terse content', () => { const a = article(); a.sections[0].paragraphs = ['가'.repeat(900)]; assert.match(inspectPublication(a).join('\n'), /over 650/); });
test('missing media research fails', () => { const a = article(); delete a.mediaReview; assert.match(inspectPublication(a).join('\n'), /mediaReview/); });
test('claiming image inclusion without attaching the image fails', () => { const a = article(); Object.assign(a.mediaReview.candidates[0], { decision: 'included', assetUrl: 'https://example.com/screen.png', rightsBasis: 'Example permission' }); assert.match(inspectPublication(a).join('\n'), /actually attached/); });
test('a properly documented cover image passes', () => { const a = article(); Object.assign(a, { image: 'https://example.com/screen.png', imageSourceUrl: 'https://example.com/release', imageCaption: 'The changed setting.', imageWidth: 1200, imageHeight: 800 }); a.mediaReview.status = 'included'; Object.assign(a.mediaReview.candidates[0], { decision: 'included', assetUrl: a.image, rightsBasis: 'Example explicit image permission.' }); assert.deepEqual(inspectPublication(a), []); });
test('X announcements without an official corroborating source fail', () => { const a = article(); a.discovery.xStatus = 'public-search'; a.discovery.xPosts = [{ url: 'https://x.com/example/status/123', postedAt: '2026-10-06T01:00:00Z', verifiedAt: '2026-10-07T00:00:00Z', role: 'announcement' }]; a.sources.push({ url: a.discovery.xPosts[0].url }); assert.match(inspectPublication(a).join('\n'), /corroborating official/); });
test('properly attributed reaction is not forced into a product-spec claim', () => { const a = article(); a.discovery.xStatus = 'public-search'; a.discovery.xPosts = [{ url: 'https://x.com/example/status/123', postedAt: '2026-10-06T01:00:00Z', verifiedAt: '2026-10-07T00:00:00Z', role: 'reaction', verification: 'attributed' }]; a.sources.push({ url: a.discovery.xPosts[0].url }); assert.deepEqual(inspectPublication(a), []); });
test('X access cannot be fabricated while marked unavailable', () => { const a = article(); a.discovery.xPosts = [{ url: 'https://x.com/example/status/123' }]; assert.match(inspectPublication(a).join('\n'), /unavailable X/); });
