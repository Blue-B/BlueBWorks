// Notify IndexNow (Bing, Naver, Yandex, Seznam share submissions) about new or updated URLs.
// Usage: node tools/indexnow.mjs [url ...]   (no args = all URLs in the live sitemap)
import fs from "node:fs";
const config = JSON.parse(fs.readFileSync(new URL("../site.config.json", import.meta.url), "utf8"));
const key = config.indexNowKey;
const base = (config.baseUrl || "https://bluebworks.com").replace(/\/$/, "");
if (!key) { console.error("indexNowKey missing in site.config.json"); process.exit(1); }
let urls = process.argv.slice(2);
if (!urls.length) {
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}
urls = urls.filter(u => u.startsWith(base)).slice(0, 10000);
const host = new URL(base).host;
const body = JSON.stringify({ host, key, keyLocation: `${base}/${key}.txt`, urlList: urls });
const endpoints = ["https://api.indexnow.org/indexnow", "https://searchadvisor.naver.com/indexnow"];
let ok = 0;
for (const ep of endpoints) {
  try {
    const r = await fetch(ep, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body });
    console.log(`${ep} -> ${r.status} (${urls.length} urls)`);
    if (r.status >= 200 && r.status < 300) ok++;
  } catch (e) { console.log(`${ep} -> error ${e.message}`); }
}
process.exit(ok ? 0 : 1);
