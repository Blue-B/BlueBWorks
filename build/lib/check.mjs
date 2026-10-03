import fs from "node:fs";
import path from "node:path";
import { isIndexable } from "./data.mjs";
import { escapeHtml, joinUrl, sectionParagraphs } from "./util.mjs";

const PENDING_ASSETS = new Set(["assets/mascot.webp", "assets/space-hero.webp"]);

function listHtmlFiles(dir, base = dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "data" || entry.name === "assets") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listHtmlFiles(full, base));
    else if (entry.name.endsWith(".html")) files.push(path.relative(base, full));
  }
  return files.sort();
}

function canonicalPathForFile(relative) {
  const posix = relative.split(path.sep).join("/");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) return `/${posix.slice(0, -"index.html".length)}`;
  return `/${posix}`;
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function attrValues(html, attribute) {
  const pattern = new RegExp(`\\s${attribute}="([^"]*)"`, "g");
  const values = [];
  let match;
  while ((match = pattern.exec(html))) values.push(match[1]);
  return values;
}

function isExternal(value) {
  return (
    !value ||
    value.startsWith("#") ||
    value.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    value.startsWith("{{")
  );
}

function resolveLocal(value, pageFile, outDir, basePath) {
  const clean = value.split("#")[0].split("?")[0];
  if (!clean) return null;
  if (clean.startsWith("/")) {
    if (basePath && clean !== basePath && !clean.startsWith(`${basePath}/`)) {
      return { error: `root path outside base: ${value}` };
    }
    const withoutBase = basePath ? clean.slice(basePath.length) : clean;
    return { target: path.join(outDir, withoutBase.replace(/^\/+/, "")) };
  }
  return { target: path.resolve(path.dirname(pageFile), clean) };
}

function targetExists(target) {
  if (fs.existsSync(target)) {
    if (fs.statSync(target).isDirectory()) return fs.existsSync(path.join(target, "index.html"));
    return true;
  }
  if (!path.extname(target) && fs.existsSync(`${target}.html`)) return true;
  return false;
}

export function runChecks({ outDir, config, base, posts, assetsDir }) {
  const errors = [];
  const warnings = [];
  const stats = {};
  const basePath = base || "";
  const htmlFiles = listHtmlFiles(outDir);
  stats.pages = htmlFiles.length;

  const indexable = posts.filter(isIndexable);
  const excluded = posts.filter((post) => !isIndexable(post));

  // 1. Structural HTML + canonical consistency + local links + JSON-LD.
  let jsonLdCount = 0;
  const canonicals = new Map();
  for (const relative of htmlFiles) {
    const file = path.join(outDir, relative);
    const html = read(file);
    const label = relative.split(path.sep).join("/");

    if (!/^<!doctype html>/i.test(html)) errors.push(`${label}: missing <!doctype html>`);
    if (!/<html lang="ko"/.test(html)) errors.push(`${label}: missing lang="ko"`);
    if (!/<meta charset="utf-8">/.test(html)) errors.push(`${label}: missing charset`);
    if (!/name="viewport"/.test(html)) errors.push(`${label}: missing viewport`);
    if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${label}: missing <title>`);
    if (!/<meta name="description" content="[^"]+">/.test(html)) {
      errors.push(`${label}: missing meta description`);
    }
    if (!/<\/html>\s*$/.test(html.trim() + "\n")) {
      // trailing newline tolerant check
      if (!html.includes("</html>")) errors.push(`${label}: missing </html>`);
    }
    const h1Count = (html.match(/<h1[\s>]/g) || []).length;
    if (h1Count !== 1) errors.push(`${label}: expected exactly one <h1>, found ${h1Count}`);

    const canonicalTags = attrValues(html, "href").filter((href) =>
      html.includes(`rel="canonical" href="${href}"`),
    );
    if (canonicalTags.length !== 1) {
      errors.push(`${label}: expected exactly one canonical link`);
    } else {
      const expected = joinUrl(config.baseUrl, canonicalPathForFile(relative));
      if (canonicalTags[0] !== expected) {
        errors.push(`${label}: canonical ${canonicalTags[0]} != ${expected}`);
      }
      if (canonicals.has(canonicalTags[0])) {
        errors.push(`${label}: duplicate canonical with ${canonicals.get(canonicalTags[0])}`);
      }
      canonicals.set(canonicalTags[0], label);
    }

    for (const value of [...attrValues(html, "href"), ...attrValues(html, "src")]) {
      if (isExternal(value)) continue;
      const resolved = resolveLocal(value, file, outDir, basePath);
      if (!resolved) continue;
      if (resolved.error) {
        errors.push(`${label}: ${resolved.error}`);
        continue;
      }
      if (!targetExists(resolved.target)) {
        const rel = path.relative(outDir, resolved.target).split(path.sep).join("/");
        if (PENDING_ASSETS.has(rel)) {
          warnings.push(`${label}: waiting on supplied asset ${rel} (fallback is active)`);
        } else {
          errors.push(`${label}: missing local target ${value}`);
        }
      }
    }

    const ldPattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    let ldMatch;
    const ldTypes = [];
    while ((ldMatch = ldPattern.exec(html))) {
      jsonLdCount += 1;
      try {
        const parsed = JSON.parse(ldMatch[1]);
        if (!parsed["@context"] || !parsed["@type"]) {
          errors.push(`${label}: JSON-LD missing @context/@type`);
        }
        ldTypes.push(String(parsed["@type"]));
      } catch (error) {
        errors.push(`${label}: invalid JSON-LD (${error.message})`);
      }
    }
    if (/^articles\/[^/]+\/index\.html$/.test(label)) {
      if (!ldTypes.includes("BlogPosting")) errors.push(`${label}: missing BlogPosting JSON-LD`);
      if (!ldTypes.includes("BreadcrumbList")) errors.push(`${label}: missing BreadcrumbList JSON-LD`);
    }
    if (label === "index.html" && !ldTypes.includes("WebSite")) {
      errors.push(`${label}: missing WebSite JSON-LD`);
    }
  }
  stats.jsonLd = jsonLdCount;

  // 2. Article bodies must exist without JavaScript.
  for (const post of posts) {
    const file = path.join(outDir, "articles", post.slug, "index.html");
    if (!fs.existsSync(file)) {
      errors.push(`missing article page for slug ${post.slug}`);
      continue;
    }
    const html = read(file);
    const required = [post.title, post.summary, post.editorNote, ...post.keyPoints];
    for (const section of post.sections) {
      const paragraphs = sectionParagraphs(section);
      required.push(section.title, ...paragraphs);
    }
    for (const source of post.sources) required.push(source.name);
    for (const text of required) {
      if (!text) continue;
      if (!html.includes(escapeHtml(text))) {
        errors.push(`articles/${post.slug}: body text missing from initial HTML: ${text.slice(0, 40)}...`);
      }
    }
  }

  // 3. Every existing slug stays reachable; post.html keeps the mapping.
  const postCompat = path.join(outDir, "post.html");
  const compatHtml = fs.existsSync(postCompat) ? read(postCompat) : "";
  for (const post of posts) {
    if (!fs.existsSync(path.join(outDir, "articles", post.slug, "index.html"))) {
      errors.push(`slug not preserved: ${post.slug}`);
    }
    if (!compatHtml.includes(`"${post.slug}":`)) {
      errors.push(`post.html compatibility map missing slug ${post.slug}`);
    }
  }

  // 4. Homepage lists every indexable article and hides review-only posts.
  const homeHtml = read(path.join(outDir, "index.html"));
  for (const post of indexable) {
    if (!homeHtml.includes(`articles/${post.slug}/`)) {
      errors.push(`homepage missing indexable article ${post.slug}`);
    }
  }
  for (const post of excluded) {
    if (homeHtml.includes(`articles/${post.slug}/`)) {
      errors.push(`homepage lists review-only article ${post.slug}`);
    }
  }

  // 5. Sitemap and feed agree with the indexable set.
  const sitemap = read(path.join(outDir, "sitemap.xml"));
  for (const post of indexable) {
    if (!sitemap.includes(`/articles/${post.slug}/`)) errors.push(`sitemap missing ${post.slug}`);
  }
  for (const post of excluded) {
    if (sitemap.includes(`/articles/${post.slug}/`)) errors.push(`sitemap lists review-only ${post.slug}`);
  }
  if (sitemap.includes("/post.html") || sitemap.includes("/404.html")) {
    errors.push("sitemap contains a non-indexable utility page");
  }
  const feed = read(path.join(outDir, "feed.xml"));
  if (!feed.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) errors.push("feed.xml: bad header");
  if (!feed.includes("<rss version=") || !feed.includes("</rss>")) errors.push("feed.xml: malformed");
  for (const post of excluded) {
    if (feed.includes(post.slug)) errors.push(`feed lists review-only ${post.slug}`);
  }

  // 6. CSS local url() targets exist.
  const cssPath = path.join(outDir, "assets", "style.css");
  if (fs.existsSync(cssPath)) {
    const css = read(cssPath);
    const urlPattern = /url\((['"]?)([^'")]+)\1\)/g;
    let match;
    while ((match = urlPattern.exec(css))) {
      const value = match[2].trim();
      if (isExternal(value) || value.startsWith("data:")) continue;
      const clean = value.split("#")[0].split("?")[0];
      const target = clean.startsWith("/")
        ? path.join(outDir, clean.slice(basePath.length).replace(/^\/+/, ""))
        : path.resolve(path.dirname(cssPath), clean);
      const rel = path.relative(outDir, target).split(path.sep).join("/");
      if (!fs.existsSync(target) && !PENDING_ASSETS.has(rel)) {
        errors.push(`style.css: missing url() target ${value}`);
      }
    }
  }

  // 7. Required pages exist.
  for (const page of [
    "index.html",
    "articles/index.html",
    "post.html",
    "about.html",
    "contact.html",
    "editorial.html",
    "privacy.html",
    "404.html",
    "feed.xml",
    "sitemap.xml",
  ]) {
    if (!fs.existsSync(path.join(outDir, page))) errors.push(`missing generated page ${page}`);
  }

  return { ok: errors.length === 0, errors, warnings, stats };
}
