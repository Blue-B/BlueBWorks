#!/usr/bin/env node
// Structural publication gate. Factual review still requires reading primary sources.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function httpsUrl(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
export function inspectArticle(article, filename = '') {
  const errors = [];
  const fail = message => errors.push(`${article?.slug || filename}: ${message}`);
  if (!article || Array.isArray(article) || typeof article !== 'object') return [`${filename}: expected one article object`];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug || '')) fail('invalid slug');
  if (filename && filename !== `${article.slug}.json`) fail('file name must match slug');
  const sections = Array.isArray(article.sections) ? article.sections : [];
  const paragraphs = sections.flatMap(section => Array.isArray(section.paragraphs) ? section.paragraphs : [section.body || '']);
  const body = paragraphs.join('\n');
  if (body.length < 3000) fail(`body is ${body.length} characters; at least 3000 required (excluding summary, code and sources)`);
  if (sections.length < 4) fail('at least four substantive sections required');
  if (article.reviewStatus !== 'reviewed') fail('explicit reviewStatus=reviewed required');
  for (const field of ['title', 'summary', 'publishedAt', 'verifiedAt', 'category']) if (!article[field]) fail(`missing ${field}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.publishedAt || '') || !Number.isFinite(Date.parse(article.verifiedAt))) fail('invalid publication or verification date');
  const sources = Array.isArray(article.sources) ? article.sources : [];
  if (sources.length < 2) fail('at least two primary-source links required');
  if (new Set(sources.map(source => source.url)).size !== sources.length) fail('duplicate source URLs');
  for (const source of sources) if (!httpsUrl(source.url) || !source.name) fail('source must have a name and HTTPS URL');
  const resources = Array.isArray(article.resources) ? article.resources : [];
  if (resources.length < 3) fail('at least three directly useful resources required');
  for (const resource of resources) if (!resource.name || !resource.description || !httpsUrl(resource.url)) fail('incomplete resource');
  if (!Array.isArray(article.keyPoints) || article.keyPoints.length < 2) fail('key points missing');
  if (article.image && (!httpsUrl(article.image) || !article.imageAlt || !article.imageCredit)) fail('cover image needs HTTPS URL, alt and credit');
  const repeated = paragraphs.filter((paragraph, index) => paragraph && paragraphs.indexOf(paragraph) !== index);
  if (repeated.length) fail('duplicated paragraphs cannot be used to fill length');
  for (const section of sections) {
    if (!section.title || !(section.paragraphs?.length || section.body)) fail('empty section');
    if (!Array.isArray(section.sourceRefs) || !section.sourceRefs.length || section.sourceRefs.some(ref => !Number.isInteger(ref) || ref < 1 || ref > sources.length)) fail(`invalid sourceRefs in ${section.title}`);
    if (section.table && (!section.table.caption || !section.table.rows?.every(row => row.length === section.table.headers?.length))) fail(`table needs a caption and rectangular rows in ${section.title}`);
    for (const link of section.links || []) if (!link.label || !httpsUrl(link.url)) fail('invalid in-section link');
    for (const figure of section.figures || []) {
      if (!httpsUrl(figure.src) || !httpsUrl(figure.sourceUrl) || !figure.alt || !figure.credit || !figure.caption) fail('figure must contain the original source and a descriptive caption');
      if (!(figure.width > 0 && figure.height > 0)) fail('figure dimensions missing');
      if (!sources.some(source => source.url === figure.sourceUrl)) fail('figure source must be in the article sources');
    }
    if (section.video && (section.video.verified !== true || !httpsUrl(section.video.src) || !section.video.caption || !section.video.credit || !sources.some(source => source.url === section.video.sourceUrl))) fail('native video needs a verified original source, caption and credit');
  }
  return errors;
}

export function checkAuthoredArticles(directory = path.join(root, 'content', 'articles')) {
  const files = fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort() : [];
  const errors = [], summary = [];
  for (const file of files) {
    try {
      const article = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
      errors.push(...inspectArticle(article, file));
      summary.push({ slug: article.slug, bodyCharacters: (article.sections || []).flatMap(section => section.paragraphs || [section.body || '']).join('\n').length });
    } catch (error) { errors.push(`${file}: ${error.message}`); }
  }
  return { errors, summary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkAuthoredArticles();
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else { console.log(`Editorial structure checked: ${result.summary.length} long-form articles`); result.summary.forEach(row => console.log(`${row.slug}: ${row.bodyCharacters} body characters`)); }
}
