// Run manually: DEVSPACE_WORKSPACE_ID=<workspace> node test/reading-browser.mjs
// Set SITE_TEST_URL to verify the deployed site with the same assertions.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
const exec = promisify(execFile);
const root = path.resolve('docs');
const out = path.resolve('.verify');
await fs.mkdir(out, { recursive: true });
const session = process.env.DEVSPACE_WORKSPACE_ID;
if (!session) throw new Error('Set DEVSPACE_WORKSPACE_ID to the approved current workspace.');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const ip = Object.values(os.networkInterfaces()).flat().find(x => x.family === 'IPv4' && !x.internal)?.address || '127.0.0.1';
let base;
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (!pathname.startsWith('/BlueBWorks/')) throw new Error('Not found');
    pathname = pathname.slice('/BlueBWorks'.length);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const target = path.resolve(root, '.' + pathname);
    if (!target.startsWith(root + path.sep)) throw new Error('Invalid path');
    let data = await fs.readFile(target);
    if (target.endsWith('.html')) data = Buffer.from(data.toString().replaceAll('https://blue-b.github.io/BlueBWorks/', base + '/'));
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
base = process.env.SITE_TEST_URL || `http://${ip}:${server.address().port}/BlueBWorks`;
async function ab(...args) {
  const { stdout } = await exec('/home/shell/bin/ab', [...args, '--json'], {
    env: { ...process.env, AB_PROFILE: 'devspace', AB_SESSION: session }, timeout: 45000, maxBuffer: 3000000
  });
  const parsed = JSON.parse(stdout);
  if (parsed.success === false) throw new Error(JSON.stringify(parsed));
  return parsed.data?.result ?? parsed.data;
}
const getMetrics = `(() => {
  const header=document.querySelector('.site-header'), h=document.querySelector('h1'), body=document.querySelector('.article-body');
  return {title:h?.innerText, h1:document.querySelectorAll('h1').length, viewport:innerWidth, scroll:document.documentElement.scrollWidth,
    headerBottom:header?.getBoundingClientRect().bottom,titleTop:h?.getBoundingClientRect().top,
    bodyTop:body?.getBoundingClientRect().top,bodyChars:body?.innerText.length||0,
    coverMascots:document.querySelectorAll('.article-cover .mascot-img').length,
    sourceLinks:document.querySelectorAll('.sources a').length,
    notes:document.querySelectorAll('#post-list>li').length,
    design:document.querySelector('main')?.dataset.design,
    leadTop:document.querySelector('.lead-story')?.getBoundingClientRect().top,
    giantHero:!!document.querySelector('.observatory,.orbit-track'),
    brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth&&i.getAttribute('src')).map(i=>i.getAttribute('src'))};
})()`;
const slug = 'cloudflare-k2-serverless-event-streams-2026';
try {
  for (const width of [1440, 768, 390, 320]) {
    await ab('set', 'viewport', String(width), '960');
    await ab('open', base + '/');
    await ab('eval', 'document.fonts.ready.then(()=>true)');
    const home = await ab('eval', getMetrics);
    assert.equal(home.h1, 1); assert(home.scroll <= width + 1); assert.equal(home.giantHero, false);
    assert.equal(home.design, 'journal-editorial-v1'); assert(home.leadTop < 380, 'lead article is pushed below the first screen');
    assert.equal(home.brokenImages.length, 0); assert(home.titleTop >= home.headerBottom - 1);
    console.log(JSON.stringify({ page: 'home', ...home }));
    await ab('screenshot', path.join(out, `reading-home-${width}.png`));
    if (width === 320) {
      await ab('click', '[data-nav-toggle]');
      assert.equal(await ab('eval', 'document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded")'), 'true');
      await ab('press', 'Escape');
      assert.equal(await ab('eval', 'document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded")'), 'false');
      await ab('fill', '#post-search', 'Microsoft');
      assert.equal(await ab('eval', 'document.querySelectorAll("#post-list>li:not([hidden])").length'), 1);
    }
    await ab('open', base + '/post.html?slug=' + slug);
    await ab('eval', 'document.fonts.ready.then(()=>true)');
    const article = await ab('eval', getMetrics);
    assert.equal(article.h1, 1); assert(article.scroll <= width + 1); assert(article.bodyChars >= 3000);
    assert.equal(article.coverMascots, 0); assert.equal(article.sourceLinks, 8);
    assert.equal(article.brokenImages.length, 0);
    assert(article.titleTop >= article.headerBottom - 1, 'sticky header hides the article title');
    if (width <= 960) {
      assert.equal(await ab('eval', 'document.querySelector("details.toc").open'), false);
      await ab('click', 'details.toc > summary');
      assert.equal(await ab('eval', 'document.querySelector("details.toc").open'), true);
      await ab('click', 'details.toc > summary');
      assert(article.bodyTop < 1020, 'introductory controls bury the first paragraph');
    }
    console.log(JSON.stringify({ page: 'K2', ...article }));
    await ab('screenshot', path.join(out, `reading-k2-${width}.png`));
  }
  await ab('open', base + '/post.html?slug=microsoft-mai-audio-vercel-ai-gateway-2026');
  const microsoft = await ab('eval', '({url:location.href,body:document.querySelector(".article-body")?.innerText.length,sources:document.querySelectorAll(".sources a").length,table:document.querySelectorAll("table").length,code:document.querySelectorAll("pre code").length})');
  assert(microsoft.url.includes('/articles/microsoft-mai-audio-vercel-ai-gateway-2026/'));
  assert(microsoft.body > 3000); assert.equal(microsoft.sources, 9); assert(microsoft.table > 0); assert(microsoft.code > 0);
  await ab('open', base + '/articles/claude-code-mods-2026/');
  await ab('scrollintoview', '.article-figure');
  await ab('click', '.article-figure [data-zoom-image]');
  assert.equal(await ab('eval', 'document.querySelector(".figure-lightbox")?.open'), true);
  await ab('press', 'Escape');
  assert.equal(await ab('eval', 'document.querySelector(".figure-lightbox")?.open'), false);
  await ab('open', base + '/articles/#archive-search');
  await ab('fill', '#archive-search-input', 'K2');
  const results = await ab('eval', '[...document.querySelectorAll("[data-post-list]>li:not([hidden])")].map(x=>x.innerText)');
  assert(results.some(text => text.includes('Cloudflare K2')));
  console.log('Content-first home, compact article, 320–1440px layouts, menu, original URL, search and image zoom verified.');
} finally { server.close(); }
