// Prepare a bounded set of source-attributed editorial media. Existing files are reused.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await fs.readFile(path.join(root,'site/editorial-media.json'),'utf8'));
const out=path.join(root,'site/assets/editorial');
await fs.mkdir(out,{recursive:true});
const credits=[];
for(const item of manifest){
  if(!/^[a-z0-9-]+\.(?:png|jpg|webp|mp4)$/.test(item.file)) throw new Error('Invalid media filename');
  if(new URL(item.url).protocol!=='https:' || !item.sourceUrl || !item.credit) throw new Error('Editorial media requires original source and credit');
  const target=path.join(out,item.file);
  let bytes;
  try { bytes=await fs.readFile(target); } catch {
    const response=await fetch(item.url,{signal:AbortSignal.timeout(35000)});
    const type=response.headers.get('content-type')||'';
    if(!response.ok || !(type.startsWith('image/') || type.startsWith('video/mp4'))) throw new Error(`Invalid media response: ${item.file} ${response.status} ${type}`);
    bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<100 || bytes.length>8000000) throw new Error(`Unexpected media size: ${item.file}`);
    await fs.writeFile(target,bytes);
    console.log(`Prepared original media: ${item.file} (${bytes.length} bytes)`);
  }
  if(bytes.length<100) throw new Error(`Empty media: ${item.file}`);
  credits.push({...item,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
await fs.writeFile(path.join(out,'sources.json'),JSON.stringify(credits,null,2)+'\n');
console.log(`Original editorial media ready: ${credits.length} files; provenance retained.`);
