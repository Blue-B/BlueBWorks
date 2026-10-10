#!/usr/bin/env node
// Read-only audit for the static output of scheduled publication.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const tag = (text, name) => text.split("<" + name + ">")[1]?.split("</" + name + ">")[0]?.trim() || "";

export function publicationHealth({ now = new Date(), maxAgeHours, since } = {}) {
  const rss = read("docs/feed.xml");
  const item = rss.match(/<item>([\s\S]*?)<\/item>/)?.[1];
  if (!item) throw new Error("RSS에 게시된 글이 없어");
  const url = tag(item, "link");
  const title = tag(item, "title");
  const slug = new URL(url).pathname.match(/\/articles\/([^/]+)\//)?.[1];
  const timestamp = Date.parse(tag(item, "pubDate"));
  if (!slug || !title || !Number.isFinite(timestamp)) throw new Error("RSS 최신 글의 제목·주소·시간이 올바르지 않아");
  const article = read("docs/articles/" + slug + "/index.html");
  if (!article.includes('<link rel="canonical" href="' + url + '">') || !article.includes('class="article-body"')) {
    throw new Error("최신 글 HTML에서 본문이나 대표 주소가 빠졌어");
  }
  for (const [name, content] of [
    ["홈", read("docs/index.html")],
    ["글 목록", read("docs/articles/index.html")],
    ["사이트맵", read("docs/sitemap.xml")]
  ]) {
    if (!content.includes(url) && !content.includes("/articles/" + slug + "/")) {
      throw new Error(name + "에 최신 기사가 없어: " + slug);
    }
  }
  const ageHours = (new Date(now).getTime() - timestamp) / 3600000;
  if (!Number.isFinite(ageHours) || ageHours < -0.25) throw new Error("발행 시각이 현재보다 미래거나 유효하지 않아");
  if (since && !(timestamp > Date.parse(since))) throw new Error("직전 발행 이후 신규 기사가 없어");
  if (Number.isFinite(maxAgeHours) && ageHours > maxAgeHours) {
    throw new Error("최신 글 발행 이후 " + ageHours.toFixed(1) + "시간 경과");
  }
  return { status: "ok", slug, title, url, publishedAt: new Date(timestamp).toISOString(), ageHours: Number(ageHours.toFixed(1)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const maxAgeHours = process.argv.find((x) => x.startsWith("--max-age-hours="))?.split("=")[1];
    const since = process.argv.find((x) => x.startsWith("--since="))?.slice(8);
    console.log(JSON.stringify(publicationHealth({ maxAgeHours: maxAgeHours === undefined ? undefined : Number(maxAgeHours), since }), null, 2));
  } catch (err) {
    console.error(JSON.stringify({ status: "failed", reason: err.message }));
    process.exitCode = 1;
  }
}
