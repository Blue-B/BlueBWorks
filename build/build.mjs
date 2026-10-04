#!/usr/bin/env node
// BlueBWorks AI Radar static builder.
// Node built-ins only. Reads content, renders HTML/XML into the output folder.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isIndexable, loadPosts, sortPosts } from "./lib/data.mjs";
import { basePathFromUrl, joinUrl, kstDate, laterDate, normalizeBaseUrl, sortKey } from "./lib/util.mjs";
import {
  render404,
  renderAbout,
  renderArticle,
  renderArticlesIndex,
  renderContact,
  renderEditorial,
  renderFeed,
  renderHome,
  renderPostCompat,
  renderPrivacy,
  renderSitemap,
} from "./lib/templates.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export function resolveOptions(env = process.env) {
  const outDir = path.resolve(root, env.SITE_OUT_DIR || "docs");
  const contentPath = path.resolve(root, env.SITE_CONTENT || "docs/data/posts.json");
  const reviewedPath = path.resolve(root, env.SITE_REVIEWED || "content/reviewed-posts.json");
  const configPath = path.resolve(root, env.SITE_CONFIG || "site.config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (env.SITE_BASE_URL) config.baseUrl = env.SITE_BASE_URL;
  config.baseUrl = normalizeBaseUrl(config.baseUrl);
  const base = basePathFromUrl(config.baseUrl);
  const assetsDir = path.resolve(root, env.SITE_ASSETS || "site/assets");
  return { root, outDir, contentPath, reviewedPath, configPath, config, base, assetsDir };
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function copyAssets(assetsDir, outDir) {
  if (!fs.existsSync(assetsDir)) return [];
  const copied = [];
  const walk = (current, relative) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const from = path.join(current, entry.name);
      const toRelative = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        walk(from, toRelative);
      } else {
        const to = path.join(outDir, "assets", toRelative);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        copied.push(path.posix.join("assets", toRelative));
      }
    }
  };
  walk(assetsDir, "");
  return copied;
}

function cleanupPreviousBuild(outDir, generated) {
  const manifestPath = path.join(outDir, ".build-manifest.json");
  if (!fs.existsSync(manifestPath)) return;
  let previous = [];
  try {
    previous = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    previous = [];
  }
  const keep = new Set(generated);
  for (const relative of previous) {
    if (keep.has(relative)) continue;
    const target = path.join(outDir, relative);
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      fs.rmSync(target);
      const dir = path.dirname(target);
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmSync(dir, { recursive: true });
    }
  }
}

function sitemapPaths(config, posts) {
  const indexable = posts.filter(isIndexable);
  // Compare real instants, then render each lastmod as a KST calendar day so
  // timestamps with different offsets cannot disagree about the date.
  const latestInstant = indexable
    .map((post) => laterDate(post.publishedAt, post.verifiedAt))
    .reduce((best, value) => (sortKey(value) > sortKey(best) ? value : best), "");
  const latest = kstDate(latestInstant);
  const paths = [
    { path: "/", lastmod: latest },
    { path: "/articles/", lastmod: latest },
    { path: "/about.html" },
    { path: "/editorial.html" },
    { path: "/contact.html" },
    { path: "/privacy.html" },
  ];
  for (const post of indexable) {
    paths.push({
      path: `/articles/${post.slug}/`,
      lastmod: kstDate(laterDate(post.publishedAt, post.verifiedAt)),
    });
  }
  return paths;
}

export function build(options = resolveOptions()) {
  const { outDir, contentPath, reviewedPath, config, base, assetsDir } = options;
  const posts = sortPosts(loadPosts({ contentPath, reviewedPath }));
  if (!posts.length) throw new Error("no posts to build");

  const generated = [];
  const emit = (relative, contents) => {
    writeFile(path.join(outDir, relative), typeof contents === 'string' ? contents.replace(/[ \t]+\n/g, '\n') : contents);
    generated.push(relative);
  };

  copyAssets(assetsDir, outDir);
  const heroImageUrl = fs.existsSync(path.join(outDir, "assets", "earth-night.jpg"))
    ? joinUrl(config.baseUrl, "/assets/earth-night.jpg")
    : "";

  emit("index.html", renderHome({ config, base, posts, heroImageUrl }));
  emit("articles/index.html", renderArticlesIndex({ config, base, posts }));
  for (const post of posts) {
    emit(
      `articles/${post.slug}/index.html`,
      renderArticle({ config, base, post, posts, heroImageUrl }),
    );
  }
  emit("post.html", renderPostCompat({ config, base, posts }));
  emit("about.html", renderAbout({ config, base }));
  emit("editorial.html", renderEditorial({ config, base }));
  emit("contact.html", renderContact({ config, base }));
  emit("privacy.html", renderPrivacy({ config, base }));
  emit("404.html", render404({ config, base }));
  emit("feed.xml", renderFeed({ config, posts }));
  emit("sitemap.xml", renderSitemap({ config, paths: sitemapPaths(config, posts) }));

  cleanupPreviousBuild(outDir, generated);
  writeFile(path.join(outDir, ".build-manifest.json"), `${JSON.stringify(generated, null, 2)}\n`);

  return { posts, generated, base, outDir, config };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const options = resolveOptions();
  const { posts, generated, base } = build(options);
  const indexable = posts.filter(isIndexable).length;
  console.log(`BlueBWorks build complete`);
  console.log(`  base path : ${base || "/"}`);
  console.log(`  posts     : ${posts.length} total, ${indexable} indexable, ${posts.length - indexable} review-only`);
  console.log(`  output    : ${path.relative(process.cwd(), options.outDir) || "."}`);
  console.log(`  files     : ${generated.length} generated + assets`);
}
