#!/usr/bin/env node
// Additional editorial checks for new articles. These do not establish factual truth.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POLICY_START = Date.parse('2026-10-06T14:20:22+09:00');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
const text = value => typeof value === 'string' && value.trim().length > 0;
const stamp = value => text(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
export function prose(value) {
  return String(value || '').replace(/```[\s\S]*?```/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+/g, '').trim();
}
export function inspectPublication(article) {
  const errors = [];
  const fail = message => errors.push(`${article?.slug || 'article'}: ${message}`);
  if (!article || typeof article !== 'object' || Array.isArray(article)) return ['article: expected object'];
  const published = Date.parse(article.publishedAt);
  // Do not silently re-date or invalidate existing articles during the rollout.
  if (Number.isFinite(published) && published < POLICY_START && article.editorialVersion !== 2) return [];
  if (article.editorialVersion !== 2) fail('new articles require editorialVersion=2');
  const sections = Array.isArray(article.sections) ? article.sections : [];
  const blocks = sections.map(section => (Array.isArray(section.paragraphs) ? section.paragraphs : [section.body || '']).map(prose));
  const count = blocks.flat().join('').length;
  if (count < 4000) fail(`explanatory body has ${count} characters; at least 4000 required, excluding links/code/captions`);
  if (sections.length < 5) fail('at least five substantive sections required');
  blocks.forEach((paragraphs, index) => {
    if (paragraphs.join('').length < 240) fail(`section ${index + 1} needs substantive explanation, not only a list`);
    if (paragraphs.some(paragraph => paragraph.length > 650)) fail(`section ${index + 1} contains a paragraph over 650 characters; split it by topic`);
  });
  const sources = Array.isArray(article.sources) ? article.sources : [];
  const sourceUrls = new Set(sources.map(source => source.url));
  const media = sections.flatMap(section => Array.isArray(section.figures) ? section.figures : []);
  if (article.image) {
    if (!https(article.imageSourceUrl) || !sourceUrls.has(article.imageSourceUrl) || !text(article.imageCaption) || !(article.imageWidth > 0 && article.imageHeight > 0)) fail('cover needs original source, caption and actual dimensions');
    media.push({ src: article.image, sourceUrl: article.imageSourceUrl });
  }
  const review = article.mediaReview;
  const candidates = Array.isArray(review?.candidates) ? review.candidates : [];
  if (!stamp(review?.checkedAt) || !['included', 'unavailable'].includes(review?.status) || candidates.length < 2) fail('mediaReview must document at least two checked source pages and a timestamp');
  for (const candidate of candidates) {
    if (!https(candidate.sourceUrl) || !text(candidate.reason) || !['included', 'excluded'].includes(candidate.decision)) fail('each media candidate needs sourceUrl, decision and a specific reason');
    if (candidate.decision === 'included' && (!https(candidate.assetUrl) || !text(candidate.rightsBasis) || !media.some(item => item.src === candidate.assetUrl && item.sourceUrl === candidate.sourceUrl))) fail('an included candidate needs rightsBasis and an actually attached matching image');
  }
  if (media.length) {
    if (review?.status !== 'included') fail('attached images require mediaReview.status=included');
    for (const item of media) if (!candidates.some(candidate => candidate.decision === 'included' && candidate.assetUrl === item.src && candidate.sourceUrl === item.sourceUrl && text(candidate.rightsBasis))) fail('every image needs a matching media review with reuse evidence');
  } else if (review?.status !== 'unavailable' || !text(review?.omittedReason)) fail('an article without images needs a concrete omittedReason; never fabricate pictures');
  const discovery = article.discovery;
  if (!['public-search', 'angelic-angel', 'unavailable'].includes(discovery?.xStatus) || !text(discovery?.notes)) fail('record whether X was actually searched, received through Angelic Angel, or unavailable');
  const posts = Array.isArray(discovery?.xPosts) ? discovery.xPosts : [];
  if (discovery?.xStatus === 'unavailable' && posts.length) fail('unavailable X cannot claim verified X posts');
  for (const post of posts) {
    let valid = false;
    try { const url = new URL(post.url); valid = url.protocol === 'https:' && ['x.com', 'twitter.com'].includes(url.hostname) && /^\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/\d+\/?$/.test(url.pathname) && !url.search && !url.hash; } catch {}
    if (!valid || !stamp(post.postedAt) || !stamp(post.verifiedAt) || !sourceUrls.has(post.url)) fail('X citations need a real status URL, post/verification times and an article source entry');
    if (!['announcement', 'demo', 'reaction'].includes(post.role)) fail('X citation role must distinguish announcement/demo/reaction');
    if (post.role === 'reaction') {
      if (post.verification !== 'attributed') fail('X reactions must be attributed, not presented as established facts');
    } else if (post.verification !== 'corroborated' || !https(post.officialSourceUrl) || !sourceUrls.has(post.officialSourceUrl)) fail('X announcements/demos require a corroborating official source in article.sources');
  }
  return errors;
}
export function checkPublications(directory = path.join(root, 'content', 'articles')) {
  const errors = [];
  if (!fs.existsSync(directory)) return ['content/articles directory is missing'];
  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort()) {
    try { errors.push(...inspectPublication(JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')))); }
    catch (error) { errors.push(`${name}: ${error.message}`); }
  }
  return errors;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkPublications();
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Publication policy checked: depth, paragraph size, image research and X provenance.');
}
