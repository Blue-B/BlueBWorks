// Optional browser integration test in the approved DevSpace browser session.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const root = path.resolve('docs');
const output = path.resolve('.verify/editorial');
await fs.mkdir(output, {recursive:true});
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json','.mp4':'video/mp4'};
const server = http.createServer(async(req,res)=>{
  try {
    let name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (!name.startsWith('/BlueBWorks/')) throw new Error('outside site');
    name = name.slice('/BlueBWorks'.length);
    if(name.endsWith('/')) name += 'index.html';
    const file = path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)) throw new Error('outside site');
    let bytes = await fs.readFile(file);
    if(file.endsWith('.html')) bytes=Buffer.from(bytes.toString().replaceAll('https://blue-b.github.io/BlueBWorks/',`http://${process.env.SITE_TEST_HOST || '127.0.0.1'}:${server.address().port}/BlueBWorks/`));
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
const base = process.env.SITE_TEST_URL || `http://${process.env.SITE_TEST_HOST || '127.0.0.1'}:${server.address().port}/BlueBWorks`;
async function ab(...args){
  const {stdout}=await exec('/home/shell/bin/ab',[...args,'--json'],{env:{...process.env,AB_PROFILE:'devspace',AB_SESSION:process.env.DEVSPACE_WORKSPACE_ID||'ws_2d9f023a63'},timeout:45000,maxBuffer:4000000});
  const json=JSON.parse(stdout);if(json.success===false) throw new Error(JSON.stringify(json));
  return json.data?.result ?? json.data;
}
const slugs=['claude-code-mods-2026','cloudflare-protected-quick-tunnels-2026','github-copilot-code-review-api-2026'];
try {
  for(const width of [1440,390]){
    await ab('set','viewport',String(width),'960');
    for(const slug of slugs){
      await ab('open',`${base}/articles/${slug}/`);
      await ab('eval','document.fonts.ready.then(()=>true)');
      const images = await ab('eval',`Promise.all([...document.querySelectorAll('.source-media img, .article-figure img')].map(async i=>{i.loading='eager';try{await i.decode()}catch{}return {src:i.currentSrc,width:i.naturalWidth,loaded:i.complete&&i.naturalWidth>0}}))`);
      assert(images.every(image=>image.loaded),'Original image failed: '+JSON.stringify(images));
      const state=await ab('eval',`({title:document.querySelector('h1')?.textContent,h1:document.querySelectorAll('h1').length,body:[...document.querySelectorAll('.prose-section > p:not(.source-refs)')].map(x=>x.textContent).join(' ').length,scroll:document.documentElement.scrollWidth,viewport:innerWidth,sourceCount:document.querySelectorAll('.sources li').length,video:document.querySelectorAll('video').length})`);
      assert.equal(state.h1,1);assert(state.body>=3000);assert(state.scroll<=width+1);assert(state.sourceCount>=2);
      console.log(JSON.stringify({width,slug,...state,images}));
      if(slug==='claude-code-mods-2026'){
        const video=await ab('eval',`new Promise(resolve=>{const v=document.querySelector('video');const t=setTimeout(()=>resolve({loaded:false,error:'metadata timeout'}),18000);v.addEventListener('loadedmetadata',()=>{clearTimeout(t);resolve({loaded:true,duration:v.duration,autoplay:v.autoplay})},{once:true});v.addEventListener('error',()=>{clearTimeout(t);resolve({loaded:false,error:v.error?.code})},{once:true});v.preload='metadata';v.load();})`);
        assert(video.loaded,'Official video metadata failed: '+JSON.stringify(video));assert(!video.autoplay);console.log('Official video:',JSON.stringify(video));
      }
      if(slug!=='github-copilot-code-review-api-2026'){
        await ab('click','[data-zoom-image]');
        assert.equal(await ab('eval','document.querySelector(".figure-lightbox").open'),true);
        await ab('press','Escape');
        assert.equal(await ab('eval','document.querySelector(".figure-lightbox").open'),false);
      }
      await ab('eval','window.scrollTo(0,0)');
      await ab('screenshot',`${output}/${slug}-${width}.png`);
    }
    await ab('open',base+'/');
    await ab('screenshot',`${output}/home-${width}.png`);
    if(width===390){
      await ab('click','[data-nav-toggle]');
      assert.equal(await ab('eval','document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded")'),'true');
      assert.equal(await ab('eval','getComputedStyle(document.querySelector("#site-nav")).display!=="none"'),true);
      await ab('press','Escape');
      assert.equal(await ab('eval','document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded")'),'false');
    }
    await ab('click','.header-search');
    await ab('fill','#archive-search-input','Protected');
    assert.equal(await ab('eval','document.querySelector("[data-list-status]").textContent'),'글 1편');
  }
  console.log('Original images, video metadata, desktop/mobile layout, image zoom, menu and archive search verified.');
} finally {server.close();}
