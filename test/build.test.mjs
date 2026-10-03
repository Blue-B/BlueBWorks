import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, resolveOptions } from "../build/build.mjs";
import { runChecks } from "../build/lib/check.mjs";
import { isIndexable, loadPosts, sortPosts } from "../build/lib/data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realContent = path.join(root, "docs", "data", "posts.json");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bluebworks-"));
}

function buildTo({ outDir, contentPath = realContent, reviewedPath, baseUrl }) {
  const options = resolveOptions({
    SITE_OUT_DIR: outDir,
    SITE_CONTENT: contentPath,
    SITE_REVIEWED: reviewedPath || path.join(outDir, "no-reviewed.json"),
    ...(baseUrl ? { SITE_BASE_URL: baseUrl } : {}),
  });
  const result = build(options);
  const posts = sortPosts(
    loadPosts({ contentPath: options.contentPath, reviewedPath: options.reviewedPath }),
  );
  const checks = runChecks({
    outDir: options.outDir,
    config: options.config,
    base: options.base,
    posts,
    assetsDir: options.assetsDir,
  });
  return { ...result, options, posts, checks };
}

test("real content builds clean and preserves every existing slug", () => {
  const outDir = tempDir();
  const basePosts = JSON.parse(fs.readFileSync(realContent, "utf8"));
  const { checks, posts } = buildTo({ outDir });
  assert.deepEqual(checks.errors, []);
  assert.equal(checks.ok, true);
  assert.equal(posts.length, basePosts.length);
  for (const post of basePosts) {
    assert.ok(
      fs.existsSync(path.join(outDir, "articles", post.slug, "index.html")),
      `missing ${post.slug}`,
    );
    assert.ok(fs.readFileSync(path.join(outDir, "post.html"), "utf8").includes(`"${post.slug}":`));
  }
  fs.rmSync(outDir, { recursive: true, force: true });
});

test("article HTML contains the full body without JavaScript", () => {
  const outDir = tempDir();
  const { posts } = buildTo({ outDir });
  const post = posts[0];
  const html = fs.readFileSync(path.join(outDir, "articles", post.slug, "index.html"), "utf8");
  for (const section of post.sections) {
    assert.ok(html.includes(section.title), `section title missing: ${section.title}`);
  }
  assert.ok(html.includes(post.editorNote));
  assert.ok(html.match(/<script type="application\/ld\+json">/));
  fs.rmSync(outDir, { recursive: true, force: true });
});

test("domain-root base URL produces root-relative paths", () => {
  const outDir = tempDir();
  const { checks } = buildTo({ outDir, baseUrl: "https://example.com" });
  assert.equal(checks.ok, true, checks.errors.join("\n"));
  const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  assert.ok(html.includes('href="/articles/'));
  assert.ok(!html.includes('href="/BlueBWorks/'));
  assert.ok(html.includes('href="https://example.com/"'));
  fs.rmSync(outDir, { recursive: true, force: true });
});

test("reviewed posts override fields, add new posts, and unverified posts are excluded", () => {
  const outDir = tempDir();
  const contentPath = path.join(outDir, "posts.json");
  const reviewedPath = path.join(outDir, "reviewed.json");

  fs.writeFileSync(
    contentPath,
    JSON.stringify([
      {
        slug: "keep-me",
        title: "원래 제목",
        summary: "원래 요약",
        category: "모델",
        publishedAt: "2026-01-01",
        tags: ["a"],
        keyPoints: ["핵심"],
        sections: [{ title: "본문", body: "본문 내용." }],
        sources: [{ name: "원문", url: "https://example.com/a" }],
      },
    ]),
  );
  fs.writeFileSync(
    reviewedPath,
    JSON.stringify([
      { slug: "keep-me", title: "검토된 제목", summary: "검토된 요약" },
      {
        slug: "brand-new",
        title: "새로 추가된 글",
        summary: "새 요약",
        category: "오픈소스",
        publishedAt: "2026-02-02",
        tags: ["b"],
        keyPoints: ["새 핵심"],
        sections: [{ title: "새 본문", paragraphs: ["새 문단 하나.", "새 문단 둘."] }],
        sources: [{ name: "새 원문", url: "https://example.com/b" }],
      },
      {
        slug: "needs-review",
        title: "검토 중",
        summary: "검토 중 요약",
        category: "모델",
        publishedAt: "2026-03-03",
        reviewStatus: "unverified",
        sections: [{ title: "검토", body: "확인 중." }],
        sources: [{ name: "임시", url: "https://example.com/c" }],
      },
    ]),
  );

  const { checks, posts } = buildTo({ outDir, contentPath, reviewedPath });
  assert.equal(checks.ok, true, checks.errors.join("\n"));

  const overridden = fs.readFileSync(path.join(outDir, "articles", "keep-me", "index.html"), "utf8");
  assert.ok(overridden.includes("검토된 제목"));
  assert.ok(overridden.includes("본문 내용."), "original body survives partial override");

  const newHtml = fs.readFileSync(path.join(outDir, "articles", "brand-new", "index.html"), "utf8");
  assert.ok(newHtml.includes("새 문단 하나."));
  assert.ok(newHtml.includes("새 문단 둘."));

  const reviewHtml = fs.readFileSync(
    path.join(outDir, "articles", "needs-review", "index.html"),
    "utf8",
  );
  assert.ok(reviewHtml.includes('name="robots" content="noindex,follow"'));
  assert.ok(!fs.readFileSync(path.join(outDir, "index.html"), "utf8").includes("needs-review"));
  assert.ok(!fs.readFileSync(path.join(outDir, "sitemap.xml"), "utf8").includes("needs-review"));
  assert.ok(!fs.readFileSync(path.join(outDir, "feed.xml"), "utf8").includes("needs-review"));

  assert.equal(posts.filter(isIndexable).length, 2);
  fs.rmSync(outDir, { recursive: true, force: true });
});

test("utility pages are not indexable in the sitemap", () => {
  const outDir = tempDir();
  buildTo({ outDir });
  const sitemap = fs.readFileSync(path.join(outDir, "sitemap.xml"), "utf8");
  assert.ok(!sitemap.includes("/post.html"));
  assert.ok(!sitemap.includes("/404.html"));
  assert.ok(sitemap.includes("/about.html"));
  assert.ok(sitemap.includes("/privacy.html"));
  const robots = fs.readFileSync(
    path.join(outDir, "articles", "github-copilot-code-review-api-2026", "index.html"),
    "utf8",
  );
  assert.ok(!robots.includes('name="robots"'));
  fs.rmSync(outDir, { recursive: true, force: true });
});
