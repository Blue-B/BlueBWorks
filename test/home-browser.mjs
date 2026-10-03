// Visual regression smoke check in the dedicated DevSpace browser session.
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
await fs.mkdir(out, {recursive:true});
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.mp4':'video/mp4'};
const ip = Object.values(os.networkInterfaces()).flat().find(x=>x.family==='IPv4'&&!x.internal)?.address || '127.0.0.1';
let base;
const server = http.createServer(async(req,res)=>{
  try {
    let p=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(!p.startsWith('/BlueBWorks/')) throw new Error('Not found');
    p=p.slice('/BlueBWorks'.length);if(p.endsWith('/'))p+='index.html';
    const target=path.resolve(root,'.'+p);if(!target.startsWith(root+path.sep))throw new Error('Invalid path');
    let data=await fs.readFile(target);
    if(target.endsWith('.html'))data=Buffer.from(data.toString().replaceAll('https://blue-b.github.io/BlueBWorks/',base+'/'));
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'0.0.0.0',r));
base=process.env.SITE_TEST_URL || `http://${ip}:${server.address().port}/BlueBWorks`;
async function ab(...args){const {stdout}=await exec('/home/shell/bin/ab',[...args,'--json'],{env:{...process.env,AB_PROFILE:'devspace',AB_SESSION:process.env.DEVSPACE_WORKSPACE_ID||'ws_2d9f023a63'},timeout:40000,maxBuffer:2000000});const j=JSON.parse(stdout);if(j.success===false)throw new Error(JSON.stringify(j));return j.data?.result??j.data;}
try{
  for(const width of [1440,768,390]){
    await ab('set','viewport',String(width),'1050');
    await ab('open',base+'/');
    await ab('eval','document.fonts.ready.then(()=>true)');
    const info=await ab('eval',`(()=>{const img=document.querySelector('.mascot-img'),h=document.querySelector('h1');return {width:innerWidth,scroll:document.documentElement.scrollWidth,title:h?.innerText,design:document.querySelector('main').dataset.design,header:getComputedStyle(document.querySelector('.journal-header')).backgroundColor,mascot:img.complete&&img.naturalWidth>0,topics:document.querySelectorAll('[data-topic-target]').length,notes:document.querySelectorAll('#post-list>li').length,headings:document.querySelectorAll('h1').length,heroBottom:document.querySelector('.observatory').getBoundingClientRect().bottom}})()`);
    console.log(JSON.stringify(info));assert.equal(info.design,'journal-orbit-v3');assert.equal(info.headings,1);assert(info.scroll<=width+1);assert(info.mascot);assert(info.topics>=3);
    await ab('screenshot',path.join(out,`journal-${width}.png`));
    if(width===390){
      await ab('eval', 'document.documentElement.dataset.motion="reduced"');
      await ab('click','[data-nav-toggle]');assert.equal(await ab('eval','document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded")'),'true');await ab('press','Escape');
      await ab('click','[data-topic-target="오픈소스"]');
      const visible=await ab('eval',`[...document.querySelectorAll('#post-list>li:not([hidden])')].map(x=>x.dataset.category)`);assert(visible.length>0&&visible.every(x=>x==='오픈소스'));
      await ab('click','#radar [data-filter="all"]');await ab('fill','#post-search','Microsoft');
      assert.equal(await ab('eval',`document.querySelectorAll('#post-list>li:not([hidden])').length`),1);
      await ab('fill','#post-search','');
      await ab('click','.journal-mascot');assert.equal(await ab('eval','document.querySelector("#mascot-notes").hidden'),false);await ab('press','Escape');
    }
  }
  await ab('open',base+'/post.html?slug=microsoft-mai-audio-vercel-ai-gateway-2026');
  await ab('eval','document.fonts.ready.then(()=>true)');
  const article=await ab('eval',`({url:location.href,body:document.querySelector('.article-body')?.innerText.length,h1:document.querySelectorAll('h1').length,scroll:document.documentElement.scrollWidth,width:innerWidth})`);
  console.log('Article compatibility:',JSON.stringify(article));assert(article.body>3000);assert.equal(article.h1,1);assert(article.scroll<=article.width+1);
  await ab('screenshot',path.join(out,'journal-article-mobile.png'));
  console.log('Verified: new masthead, real article links, topic navigation, mobile menu, search, character and article compatibility.');
}finally{server.close();}
