// BlueBWorks queue/publishing helpers; dependency-free and safe to import in tests.
import fs from "node:fs";
import path from "node:path";

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function candidateFiles(root) {
  const directory = path.join(root, "pending", "articles");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(name => name.endsWith(".json")).sort().map(name => {
    const slug = name.slice(0, -5);
    if (!SLUG.test(slug)) throw new Error("Invalid pending filename: " + name);
    return { slug, path: path.join(directory, name), relative: "pending/articles/" + name };
  });
}

export function validateCandidate(article, filenameSlug, checkoutRoot) {
  if (!article || typeof article !== "object" || Array.isArray(article)) throw new Error("Pending article is not an object");
  if (article.slug !== filenameSlug || !SLUG.test(article.slug)) throw new Error("Article slug does not match filename");
  if (article.editorialVersion !== 2 || article.reviewStatus !== "reviewed") throw new Error("Draft must be editorialVersion=2 and reviewed");
  if (typeof article.title !== "string" || article.title.trim().length < 12) throw new Error("Article title is missing or too short");
  if (typeof article.summary !== "string" || article.summary.trim().length < 50) throw new Error("Article summary is missing or too short");
  if (fs.existsSync(path.join(checkoutRoot, "content", "articles", filenameSlug + ".json"))) throw new Error("Article slug already published: " + filenameSlug);
  // Reject duplicates even when a previously published article only exists in the legacy source.
  for (const relative of ["docs/data/posts.json", "content/reviewed-posts.json"]) {
    const list = JSON.parse(fs.readFileSync(path.join(checkoutRoot, relative), "utf8"));
    if (Array.isArray(list) && list.some(row => row.slug === filenameSlug)) throw new Error("Article slug already exists: " + filenameSlug);
  }
  if (!Array.isArray(article.sources) || article.sources.length < 2) throw new Error("Missing independent source records");
  return { ...article };
}

export function publishedTime(feedText) {
  const item = feedText.match(/<item>([\s\S]*?)<\/item>/)?.[1];
  const date = item?.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
  if (!date || !Number.isFinite(Date.parse(date))) throw new Error("Cannot read latest RSS date");
  return new Date(date);
}

export function stampArticle(article, previousTime, now = new Date()) {
  if (Number.isNaN(now.getTime()) || now.getTime() <= previousTime.getTime()) throw new Error("Publishing clock is not after the previous article");
  // The actual first publication time belongs to the publisher, not the writer.
  return { ...article, publishedAt: now.toISOString() };
}

export function jsonLine(record) { return JSON.stringify({ ...record, at: new Date().toISOString() }) + "\n"; }

// Asia/Seoul has no daylight saving time; group the retry and regular run
// into the same morning/evening publishing slot.
export function slotOf(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10) + (kst.getUTCHours() < 15 ? "-am" : "-pm");
}

export function completedInSlot(logFile, slot) {
  if (!fs.existsSync(logFile)) return false;
  const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
  return lines.some(line => {
    try {
      const entry = JSON.parse(line);
      return entry.slot === slot && ["published", "pushed_unverified"].includes(entry.status);
    } catch { return false; }
  });
}

