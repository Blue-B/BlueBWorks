// Validate real media and responsive layouts in the approved DevSpace browser.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadPosts, sortPosts } from '../build/lib/data.mjs';
const exec = promisify(execFile);
if (!process.env.DEVSPACE_WORKSPACE_ID) throw new Error('DEVSPACE_WORKSPACE_ID is required');
const root = path.resolve('docs');
const output = path.resolve('.verify/media');
await fs.mkdir(output, { recursive: true });
const posts = sortPosts(loadPosts({ contentPath: 'docs/data/posts.json', reviewedPath: 'content/reviewed-posts.json' }));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp4': 'video/mp4' };
const host = process.env.SITE_TEST_HOST || '127.0.0.1';
const server = http.createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!name.startsWith('/BlueBWorks/')) throw new Error('outside site');
    name = name.slice('/BlueBWorks'.length);
    if (name.endsWith('/')) name += 'index.html';
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep)) throw new Error('outside site');
    let bytes = await fs.readFile(file);
    if (file.endsWith('.html')) bytes = Buffer.from(bytes.toString().replaceAll('https://blue-b.github.io/BlueBWorks/', `http://${host}:${server.address().port}/BlueBWorks/`));
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
const base = process.env.SITE_TEST_URL || `http://${host}:${server.address().port}/BlueBWorks`;
async function ab(...args) {
  const { stdout } = await exec('/home/shell/bin/ab', [...args, '--json'], {
    env: { ...process.env, AB_PROFILE: 'devspace', AB_SESSION: process.env.DEVSPACE_WORKSPACE_ID },
    timeout: 45000, maxBuffer: 4000000,
  });
  const data = JSON.parse(stdout);
  if (data.success === false) throw new Error(JSON.stringify(data));
  return data.data?.result ?? data.data;
}
const results = [];
const widths = (process.env.MEDIA_WIDTHS || '1440,390').split(',').map(Number);
const selector = '.source-media img, .article-figure img, .archive-thumb img, .journal-thumb img';
try {
  for (const width of widths) {
    await ab('set', 'viewport', String(width), '960');
    for (const item of [{ slug: 'home', route: '/' }, { slug: 'archive', route: '/articles/' }, ...posts.map(p => ({ slug: p.slug, title: p.title, route: `/articles/${p.slug}/` }))]) {
      await ab('open', base + item.route);
      await ab('eval', 'document.fonts.ready.then(()=>true)');
      const images = await ab('eval', `Promise.all([...document.querySelectorAll(${JSON.stringify(selector)})].map(async i=>{i.loading='eager';try{await Promise.race([i.decode(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('image timeout')),12000))])}catch{}const r=i.getBoundingClientRect();return {src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,renderedWidth:Math.round(r.width),renderedHeight:Math.round(r.height),alt:i.alt}}))`);
      const state = await ab('eval', `({title:document.querySelector('h1')?.textContent,h1:document.querySelectorAll('h1').length,viewport:innerWidth,scroll:document.documentElement.scrollWidth,figures:document.querySelectorAll('.article-figure').length,captions:[...document.querySelectorAll('.article-figure figcaption,.source-media figcaption')].map(c=>c.textContent.trim())})`);
      assert.equal(state.h1, 1, item.slug + ': single title');
      if (item.title) assert.equal(state.title, item.title);
      assert(state.scroll <= state.viewport + 1, item.slug + ': horizontal overflow ' + JSON.stringify(state));
      assert(images.every(i => i.loaded && i.alt && i.renderedWidth > 0), item.slug + ': image did not render ' + JSON.stringify(images));
      assert(state.captions.every(Boolean), item.slug + ': missing captions');
      if (item.slug === 'archive') {
        const count = await ab('eval', `document.querySelectorAll('.archive-thumb img').length`);
        assert.equal(count, posts.filter(p => p.image && !/mshots|favicon|apple-touch-icon/.test(p.image)).length);
        await ab('snapshot', '-i');
        await ab('fill', '#archive-search-input', 'Git 2.56');
        const filtered = await ab('eval', `({count:[...document.querySelectorAll('[data-post-card]')].filter(x=>!x.hidden).length,text:document.querySelector('[data-list-status]').textContent})`);
        assert.equal(filtered.count, 1);
        await ab('fill', '#archive-search-input', '');
      }
      if (process.env.MEDIA_SCREENSHOTS === '1' && ['home', 'archive', 'git-2-56-2026', 'github-copilot-code-review-api-2026'].includes(item.slug)) {
        await ab('screenshot', `${output}/${item.slug}-${width}.png`);
      }
      if (item.slug === 'git-2-56-2026' && images.length) {
        await ab('snapshot', '-i');
        await ab('click', '[data-zoom-image]');
        assert.equal(await ab('eval', 'document.querySelector(".figure-lightbox")?.open'), true);
        await ab('press', 'Escape');
        assert.equal(await ab('eval', 'document.querySelector(".figure-lightbox")?.open'), false);
        if (process.env.MEDIA_SCREENSHOTS === '1' && state.figures) {
          await ab('scrollintoview', '.article-figure');
          await ab('screenshot', `${output}/git-figure-${width}.png`);
        }
      }
      const row = { slug: item.slug, width, ...state, images };
      results.push(row);
      console.log(JSON.stringify(row));
    }
  }
  await fs.writeFile(path.join(output, `checks-${widths.join('-')}.json`), JSON.stringify(results, null, 2));
  console.log(`Media verified: ${results.length} page/viewport combinations, dates preserved separately by tests.`);
} finally { server.close(); }
