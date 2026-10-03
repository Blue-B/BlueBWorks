// Optional local browser integration check. Uses the approved DevSpace browser profile.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
const exec = promisify(execFile);
const root = path.resolve('docs');
const prefix = '/BlueBWorks';
const screenshots = '/tmp/bluebworks-browser-final';
await fs.mkdir(screenshots, { recursive: true });
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
const server = http.createServer(async (req,res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix + '/')) {res.writeHead(404);res.end();return;}
    pathname = pathname.slice(prefix.length);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const target = path.resolve(root, '.' + pathname);
    if (!target.startsWith(root + path.sep)) throw new Error('Invalid path');
    let data = await fs.readFile(target);
    if (target.endsWith('.html')) data = Buffer.from(data.toString().replaceAll('https://blue-b.github.io/BlueBWorks/', `http://127.0.0.1:${server.address().port}/BlueBWorks/`));
    res.writeHead(200, {'Content-Type':mime[path.extname(target)] || 'application/octet-stream'});res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const base = process.env.SITE_TEST_URL || `http://127.0.0.1:${server.address().port}${prefix}`;
async function ab(...args) {
  const {stdout} = await exec('/home/shell/bin/ab', [...args,'--json'], {env:{...process.env,AB_PROFILE:'devspace',AB_SESSION:process.env.DEVSPACE_WORKSPACE_ID || 'ws_121cbba7f8'},timeout:45000,maxBuffer:4000000});
  const json = JSON.parse(stdout);
  if (json.success === false) throw new Error(JSON.stringify(json));
  return json.data?.result ?? json.data;
}
const slug='microsoft-mai-audio-vercel-ai-gateway-2026';
try {
  for (const width of [1440,390]) {
    await ab('set','viewport',String(width),'980');
    for (const route of ['/',`/post.html?slug=${slug}`]) {
      await ab('open',base+route);
      await ab('eval','document.fonts.ready.then(() => true)');
      const info=await ab('eval',`(() => {const h=document.querySelector('h1'),img=document.querySelector('.mascot-img');return {url:location.href,title:h?.textContent,headings:document.querySelectorAll('h1').length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,mascot:img?.complete&&img?.naturalWidth>0,articleChars:document.querySelector('.article-body')?.innerText.length||0,tables:document.querySelectorAll('table').length,code:document.querySelectorAll('pre code').length,sourceLinks:document.querySelectorAll('.sources a').length};})()`);
      console.log(JSON.stringify(info));
      assert.equal(info.headings,1);assert(info.scrollWidth<=width+1);assert(info.mascot);
      if(route!=='/'){assert(info.articleChars>=3000);assert(info.tables>=1);assert(info.code>=1);assert.equal(info.sourceLinks,9);assert(info.url.includes(`/articles/${slug}/`));}
      await ab('screenshot',`${screenshots}/${route==='/'?'home':'article'}-${width}.png`);
    }
  }
  await ab('open',base+'/');
  await ab('click','.mascot-button');
  assert.equal(await ab('eval','document.querySelector("#mascot-notes").hidden'),false);
  await ab('press','Escape');
  assert.equal(await ab('eval','document.querySelector("#mascot-notes").hidden'),true);
  await ab('fill','#post-search','Microsoft');
  console.log('Search:',await ab('get','text','#list-status'));
  await ab('click','#motion-toggle');
  console.log('Motion toggle:',await ab('get','attr','#motion-toggle','aria-pressed'));
  console.log('Browser checks completed. Screenshots:',screenshots);
} finally {server.close();}
