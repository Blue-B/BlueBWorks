#!/usr/bin/env node
// Lightweight source discovery only. The editor must still read and verify originals.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sources = [
  { name: 'GitHub Changelog', url: 'https://github.blog/changelog/feed/' },
  { name: 'Cloudflare', url: 'https://blog.cloudflare.com/rss/' },
  { name: 'Vercel', url: 'https://vercel.com/changelog/rss' },
  { name: 'Claude Code Releases', url: 'https://github.com/anthropics/claude-code/releases.atom' },
  { name: 'OpenAI Codex Releases', url: 'https://github.com/openai/codex/releases.atom' },
];

function decode(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function tag(xml, names) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match) return decode(match[1]);
  }
  return '';
}
export function parseFeed(xml, source, now = new Date()) {
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>|<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  return blocks.map(block => {
    const title = tag(block, ['title']);
    const date = tag(block, ['pubDate', 'published', 'updated', 'dc:date']);
    const time = Date.parse(date);
    const atomLink = block.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1] || '';
    const link = atomLink || tag(block, ['link']);
    let url = '';
    try { const u = new URL(link); if (u.protocol === 'https:') url = u.href; } catch {}
    const ageHours = (now.getTime() - time) / 3600000;
    if (!title || !url || !Number.isFinite(time) || ageHours < -2 || ageHours > 24 * 7) return null;
    return { title, url, publishedAt: new Date(time).toISOString(), source, ageHours: Math.round(ageHours) };
  }).filter(Boolean);
}
export async function discover({ fetcher = fetch, now = new Date() } = {}) {
  const posts = [], errors = [];
  for (const source of sources) {
    try {
      const response = await fetcher(source.url, { headers: { 'User-Agent': 'BlueBWorks-source-radar/1.0' }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      posts.push(...parseFeed(await response.text(), source.name, now));
    } catch (error) { errors.push({ source: source.name, reason: error.message }); }
  }
  const unique = [...new Map(posts.map(post => [post.url, post])).values()];
  unique.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const existing = new Set();
  const articles = path.join(root, 'content/articles');
  for (const filename of fs.readdirSync(articles).filter(name => name.endsWith('.json'))) {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(articles, filename), 'utf8'));
      for (const item of json.sources || []) existing.add(item.url);
    } catch {}
  }
  return { checkedAt: now.toISOString(), candidates: unique.filter(post => !existing.has(post.url)), errors };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  discover().then(out => console.log(JSON.stringify(out, null, 2))).catch(err => { console.error(err); process.exitCode = 1; });
}
