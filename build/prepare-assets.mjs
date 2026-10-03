// Reproducible image build: prepare committed media, then the static builder copies it to docs.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'site', 'assets');
await fs.mkdir(out, { recursive: true });
const embedded = JSON.parse(await fs.readFile(path.join(root, 'site/asset-data.json'), 'utf8'));
for (const [name, value] of Object.entries(embedded)) {
  if (!/^[a-z0-9-]+\.webp$/.test(name)) throw new Error('Invalid asset filename');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Invalid WebP asset');
  await fs.writeFile(path.join(out, name), bytes);
}
const assets = [
  { name: 'earth-night.jpg', url: 'https://www.nasa.gov/wp-content/uploads/2026/09/55534901810-95d2f06788-o.jpg', credit: 'NASA / Jessica Meir', source: 'https://www.nasa.gov/image-article/space-station-view-of-earth-at-night/' },
  { name: 'microsoft-audio-official.png', url: 'https://assets.vercel.com/image/upload/contentful/image/e5382hct74si/4VUQPah80J1WYBwplwXQjh/341d68a8100d89550907348d511d49db/image__111_.png', credit: 'Vercel', source: 'https://vercel.com/changelog/microsoft-ai-models-are-now-available-on-ai-gateway' },
];
for (const item of assets) {
  const target = path.join(out, item.name);
  try { if ((await fs.stat(target)).size > 100) continue; } catch {}
  let bytes;
  try { bytes = await fs.readFile(path.join(root, 'docs/assets', item.name)); } catch {
    const response = await fetch(item.url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Image unavailable: ${item.name} (${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length < 100 || bytes.length > 12000000) throw new Error(`Unexpected image size: ${item.name}`);
  await fs.writeFile(target, bytes);
  // Pillow is an optional one-time optimization tool. Already prepared media requires only Node.
  try {
    execFileSync('python3', [path.join(root, 'build/optimize-image.py'), target], { stdio: 'pipe' });
  } catch { console.warn(`Pillow optimization unavailable for ${item.name}; original image preserved.`); }
  console.log(`Prepared ${item.name}: ${(await fs.stat(target)).size} bytes`);
}
await fs.writeFile(path.join(out, 'credits.json'), JSON.stringify({ mascot: { credit: 'BlueBWorks, AI-generated character artwork', decorative: true }, images: assets }, null, 2));
console.log('Generated character and official image assets ready.');
