import fs from "node:fs";
import path from "node:path";
import { hostnameOf, sortKey, txt } from "./util.mjs";

export function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toRefList(value) {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return list.map(item => Number.parseInt(item, 10)).filter(item => Number.isInteger(item) && item > 0);
}

function mediaUrl(value) {
  const url = txt(value);
  try { return new URL(url).protocol === "https:" ? url : ""; }
  catch { return ""; }
}

function normalizeCorrection(entry) {
  if (entry == null) return null;
  if (typeof entry === "string") return { date: "", text: txt(entry) };
  return { date: txt(entry.date || entry.publishedAt), text: txt(entry.text || entry.note || entry.body || entry.summary), url: txt(entry.url) };
}

function normalizeFigure(raw) {
  if (!raw || typeof raw !== "object") return null;
  const src = mediaUrl(raw.src), sourceUrl = mediaUrl(raw.sourceUrl);
  if (!src || !sourceUrl || !raw.alt || !raw.credit) return null;
  return {
    src, sourceUrl, alt: txt(raw.alt), caption: txt(raw.caption), credit: txt(raw.credit),
    width: Number.isInteger(raw.width) && raw.width > 0 ? raw.width : 1200,
    height: Number.isInteger(raw.height) && raw.height > 0 ? raw.height : 675,
  };
}

function normalizeSection(raw) {
  const paragraphs = Array.isArray(raw.paragraphs) ? raw.paragraphs.map(txt).filter(Boolean) : [];
  return {
    title: txt(raw.title),
    body: typeof raw.body === "string" ? raw.body : "",
    paragraphs,
    table: raw.table && Array.isArray(raw.table.headers) && Array.isArray(raw.table.rows)
      ? { headers: raw.table.headers.map(txt), rows: raw.table.rows.map(row => Array.isArray(row) ? row.map(txt) : []), caption: txt(raw.table.caption) } : null,
    code: raw.code?.text ? { language: txt(raw.code.language), text: txt(raw.code.text), caption: txt(raw.code.caption) } : null,
    diagram: txt(raw.diagram),
    figures: (Array.isArray(raw.figures) ? raw.figures : []).map(normalizeFigure).filter(Boolean),
    links: (Array.isArray(raw.links) ? raw.links : []).map(link => ({ label: txt(link?.label), url: mediaUrl(link?.url) })).filter(link => link.label && link.url),
    video: raw.video?.verified === true && mediaUrl(raw.video.src) && mediaUrl(raw.video.sourceUrl)
      ? { src: mediaUrl(raw.video.src), poster: mediaUrl(raw.video.poster), sourceUrl: mediaUrl(raw.video.sourceUrl), caption: txt(raw.video.caption), credit: txt(raw.video.credit), verified: true } : null,
    sourceRefs: toRefList(raw.sourceRefs),
  };
}

function hasSectionContent(section) {
  return Boolean(section.title) || Boolean(section.body) || section.paragraphs.length > 0;
}

export function normalizePost(raw) {
  const sections = (Array.isArray(raw.sections) ? raw.sections : []).map(normalizeSection).filter(hasSectionContent);
  const sources = (Array.isArray(raw.sources) ? raw.sources : [])
    .map(source => ({ name: txt(source?.name) || hostnameOf(source?.url), url: txt(source?.url), description: txt(source?.description) })).filter(source => source.url);
  const resources = (Array.isArray(raw.resources) ? raw.resources : [])
    .map(resource => ({ name: txt(resource?.name), url: txt(resource?.url), description: txt(resource?.description), type: txt(resource?.type) })).filter(resource => resource.url && resource.name);
  const videos = (Array.isArray(raw.videos) ? raw.videos : [])
    .filter(video => video && video.verified === true && /^[\w-]{6,}$/.test(txt(video.youtubeId)))
    .map(video => ({ youtubeId: txt(video.youtubeId), title: txt(video.title), channel: txt(video.channel), sourceUrl: txt(video.sourceUrl), verified: true }));
  const corrections = (Array.isArray(raw.corrections) ? raw.corrections : []).map(normalizeCorrection).filter(entry => entry && entry.text);
  return {
    slug: txt(raw.slug), title: txt(raw.title), summary: txt(raw.summary), category: txt(raw.category) || "기타",
    publishedAt: txt(raw.publishedAt), verifiedAt: txt(raw.verifiedAt), status: txt(raw.status),
    tags: (Array.isArray(raw.tags) ? raw.tags : []).map(txt).filter(Boolean),
    image: txt(raw.image), imageAlt: txt(raw.imageAlt), imageCredit: txt(raw.imageCredit),
    editorNote: txt(raw.editorNote), keyPoints: (Array.isArray(raw.keyPoints) ? raw.keyPoints : []).map(txt).filter(Boolean),
    sections, sources, sourceRefs: toRefList(raw.sourceRefs), resources, videos, corrections,
    reviewStatus: txt(raw.reviewStatus), reviewed: raw._reviewed === true,
  };
}

// Overrides replace fields for a matching slug; unknown slugs are appended.
// The original arrays are never mutated.
export function mergePosts(basePosts, reviewedPosts) {
  const list = (Array.isArray(basePosts) ? basePosts : []).map(post => ({ ...post }));
  const indexBySlug = new Map();
  list.forEach((post, index) => { if (post?.slug) indexBySlug.set(post.slug, index); });
  for (const entry of Array.isArray(reviewedPosts) ? reviewedPosts : []) {
    if (!entry?.slug) continue;
    if (indexBySlug.has(entry.slug)) {
      const index = indexBySlug.get(entry.slug);
      list[index] = { ...list[index], ...entry, _reviewed: true };
    } else {
      indexBySlug.set(entry.slug, list.length);
      list.push({ ...entry, _reviewed: true });
    }
  }
  return list.map(normalizePost).filter(post => post.slug);
}

export function loadPosts({ contentPath, reviewedPath }) {
  if (!contentPath || !fs.existsSync(contentPath)) throw new Error(`posts data not found: ${contentPath}`);
  const base = readJsonFile(contentPath);
  if (!Array.isArray(base)) throw new Error(`posts data must be an array: ${contentPath}`);
  const reviewed = reviewedPath && fs.existsSync(reviewedPath) ? readJsonFile(reviewedPath) : [];
  if (!Array.isArray(reviewed)) throw new Error(`reviewed posts must be an array: ${reviewedPath}`);
  // New long-form articles live in individual files next to the legacy overrides.
  const articlesDir = reviewedPath ? path.join(path.dirname(reviewedPath), "articles") : "";
  const authored = articlesDir && fs.existsSync(articlesDir)
    ? fs.readdirSync(articlesDir).filter(name => name.endsWith(".json")).sort().map(name => readJsonFile(path.join(articlesDir, name))) : [];
  const slugs = new Set();
  for (const article of authored) {
    if (!article?.slug || slugs.has(article.slug)) throw new Error("Authored article slug is missing or duplicated");
    slugs.add(article.slug);
  }
  return mergePosts(base, [...reviewed, ...authored]);
}

export function sortPosts(posts) {
  return posts.map((post, index) => ({ post, index })).sort((a, b) => {
    const diff = sortKey(b.post.publishedAt) - sortKey(a.post.publishedAt);
    return diff !== 0 ? diff : a.index - b.index;
  }).map(({ post }) => post);
}

export function hasEvidence(post) {
  return post.sources.length > 0 || post.sourceRefs.length > 0;
}

// Preserve older links while excluding explicitly unverified articles from discovery.
export function isIndexable(post) {
  return post.reviewStatus !== "unverified" && hasEvidence(post);
}

export function relatedPosts(post, posts, limit = 3) {
  return posts.filter(item => item.slug !== post.slug && isIndexable(item)).map(item => ({
    item,
    score: (item.tags || []).filter(tag => (post.tags || []).includes(tag)).length * 2 + (item.category === post.category ? 1 : 0),
  })).sort((a, b) => b.score - a.score || sortKey(b.item.publishedAt) - sortKey(a.item.publishedAt)).slice(0, limit).map(({ item }) => item);
}
