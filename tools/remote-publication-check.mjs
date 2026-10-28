#!/usr/bin/env node
// Read-only live verification. A successful build or git push is not proof of deployment.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8')).baseUrl.replace(/\/$/, '');
const fetchText = async (url, fetcher) => {
  const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
};
export async function checkRemote({ slug, expectedTitle, fetcher = fetch } = {}) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) throw new Error('valid --slug is required');
  if (!expectedTitle?.trim()) throw new Error('--title is required');
  const url = `${baseUrl}/articles/${slug}/`;
  const [article, home, index, sitemap, rss] = await Promise.all([
    fetchText(url, fetcher), fetchText(`${baseUrl}/`, fetcher),
    fetchText(`${baseUrl}/articles/`, fetcher),
    fetchText(`${baseUrl}/sitemap.xml`, fetcher), fetchText(`${baseUrl}/feed.xml`, fetcher),
  ]);
  if (!article.includes(expectedTitle)) throw new Error('public article title not found');
  if (!article.includes(`<link rel="canonical" href="${url}">`)) throw new Error('public canonical URL mismatch');
  if (!article.includes('class="article-body"') || !article.includes('application/ld+json')) throw new Error('public article body or structured data missing');
  for (const [name, content] of [['home', home], ['archive', index], ['sitemap', sitemap], ['rss', rss]]) {
    if (!content.includes(url) && !content.includes(`/articles/${slug}/`)) throw new Error(`public ${name} does not list article`);
  }
  return { status: 'published', url, title: expectedTitle, checkedAt: new Date().toISOString(), endpoints: 5 };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = name => process.argv.find(item => item.startsWith(`--${name}=`))?.slice(name.length + 3);
  checkRemote({ slug: arg('slug'), expectedTitle: arg('title') })
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(err => { console.error(JSON.stringify({ status: 'failed', reason: err.message })); process.exitCode = 1; });
}
