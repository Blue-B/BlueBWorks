import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, resolveOptions } from "../build/build.mjs";
import { runChecks } from "../build/lib/check.mjs";
import { isIndexable, loadPosts, mergePosts, normalizePost, sortPosts } from "../build/lib/data.mjs";
import { inspectArticle } from "../build/editorial-check.mjs";
import { renderFeed } from "../build/lib/templates.mjs";
import {
  formatKoreanDate,
  formatKoreanDateTime,
  kstDate,
  laterDate,
  sortKey,
  toIso,
  toRfc822,
} from "../build/lib/util.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realContent = path.join(root, "docs", "data", "posts.json");
const realReviewed = path.join(root, "content", "reviewed-posts.json");
const realArticles = path.join(root, "content", "articles");

function tempDir(label = "bluebworks-dates-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), label));
}

// A structurally valid long-form article. Real publishing adds one of these,
// so the integration tests must never be pinned to today's article count.
function syntheticParagraph(index) {
  const intro = "합성 회귀 테스트 문단입니다. 실제 기사가 아니라 빌드와 편집 게이트의 구조 요건을 채우기 위해 생성합니다. ";
  const filler = "이 문장은 분량을 확보하는 용도로만 반복됩니다. ";
  return `${intro}문단 번호 ${index}. ${filler.repeat(10)}`;
}

function syntheticArticle(overrides = {}) {
  return {
    slug: "synthetic-new-2026",
    title: "합성 회귀 테스트 글",
    summary: "합성 요약입니다.",
    category: "테스트",
    announcedAt: "2026-10-05",
    publishedAt: "2026-10-06T09:00:00+09:00",
    verifiedAt: "2026-10-06T08:00:00+09:00",
    status: "Test",
    reviewStatus: "reviewed",
    tags: ["test"],
    editorNote: "합성 편집 메모입니다.",
    keyPoints: ["합성 핵심 하나", "합성 핵심 둘"],
    sections: Array.from({ length: 4 }, (_, section) => ({
      title: `합성 섹션 ${section + 1}`,
      paragraphs: [0, 1, 2].map((offset) => syntheticParagraph(section * 3 + offset + 1)),
      sourceRefs: [1, 2],
    })),
    sources: [
      { name: "합성 출처 하나", url: "https://example.com/one", description: "설명 하나" },
      { name: "합성 출처 둘", url: "https://example.com/two", description: "설명 둘" },
    ],
    resources: [
      { name: "합성 자료 하나", url: "https://example.com/r1", description: "자료 설명 하나", type: "문서" },
      { name: "합성 자료 둘", url: "https://example.com/r2", description: "자료 설명 둘", type: "문서" },
      { name: "합성 자료 셋", url: "https://example.com/r3", description: "자료 설명 셋", type: "문서" },
    ],
    ...overrides,
  };
}

// Builds a throwaway content/reviewed/articles tree so integration tests do
// not depend on the live posts.json or the current number of articles.
function makeFixture({ basePosts = [], articles = [] } = {}) {
  const dir = tempDir();
  const contentPath = path.join(dir, "posts.json");
  const reviewedPath = path.join(dir, "reviewed.json");
  const articlesDir = path.join(dir, "articles");
  fs.writeFileSync(contentPath, JSON.stringify(basePosts));
  fs.writeFileSync(reviewedPath, "[]");
  fs.mkdirSync(articlesDir);
  for (const article of articles) {
    fs.mkdirSync(articlesDir, { recursive: true });
    fs.writeFileSync(path.join(articlesDir, `${article.slug}.json`), JSON.stringify(article));
  }
  return { dir, contentPath, reviewedPath, articlesDir };
}

function buildFixture({ basePosts, articles, baseUrl }) {
  const fixture = makeFixture({ basePosts, articles });
  const outDir = path.join(fixture.dir, "out");
  const options = resolveOptions({
    SITE_OUT_DIR: outDir,
    SITE_CONTENT: fixture.contentPath,
    SITE_REVIEWED: fixture.reviewedPath,
    ...(baseUrl ? { SITE_BASE_URL: baseUrl } : {}),
  });
  const result = build(options);
  const posts = sortPosts(
    loadPosts({ contentPath: fixture.contentPath, reviewedPath: fixture.reviewedPath }),
  );
  const checks = runChecks({
    outDir: options.outDir,
    config: options.config,
    base: options.base,
    posts,
    assetsDir: options.assetsDir,
  });
  return { ...result, fixture, options, posts, checks };
}

test("announcedAt (news day) and publishedAt (blog time) stay separate", () => {
  const post = normalizePost({
    slug: "demo",
    announcedAt: "2026-10-02",
    publishedAt: "2026-10-04T14:06:28+09:00",
    verifiedAt: "2026-10-04T13:50:04+09:00",
  });
  assert.equal(post.announcedAt, "2026-10-02");
  assert.equal(post.publishedAt, "2026-10-04T14:06:28+09:00");
  assert.equal(post.verifiedAt, "2026-10-04T13:50:04+09:00");
});

test("legacy posts without announcedAt mirror the date-only publishedAt", () => {
  const post = normalizePost({ slug: "legacy", publishedAt: "2026-10-01" });
  assert.equal(post.announcedAt, "2026-10-01");
  assert.equal(post.publishedAt, "2026-10-01");
});

test("sortPosts compares instants numerically across timezone offsets", () => {
  const posts = [
    // Lexicographically larger but actually earlier (2026-10-01T15:00Z).
    normalizePost({ slug: "kst-midnight", publishedAt: "2026-10-02T00:00:00+09:00" }),
    // Lexicographically smaller but actually later (2026-10-01T23:00Z).
    normalizePost({ slug: "utc-evening", publishedAt: "2026-10-01T23:00:00Z" }),
  ];
  assert.deepEqual(
    sortPosts(posts).map((post) => post.slug),
    ["utc-evening", "kst-midnight"],
  );
});

test("identical publish instants keep the original order", () => {
  const posts = [
    normalizePost({ slug: "first", publishedAt: "2026-10-04T14:06:28+09:00" }),
    normalizePost({ slug: "second", publishedAt: "2026-10-04T14:06:28+09:00" }),
    normalizePost({ slug: "third", publishedAt: "2026-10-04T14:06:28+09:00" }),
  ];
  assert.deepEqual(
    sortPosts(posts).map((post) => post.slug),
    ["first", "second", "third"],
  );
});

test("KST date boundary: a UTC evening is the next day in Asia/Seoul", () => {
  assert.equal(formatKoreanDate("2026-10-01T15:00:00Z"), "2026년 10월 2일");
  assert.equal(formatKoreanDate("2026-10-01T14:59:59Z"), "2026년 10월 1일");
  assert.equal(formatKoreanDate("2026-10-02"), "2026년 10월 2일");
  // A bare date-only value is read as KST midnight, not UTC midnight.
  assert.match(formatKoreanDateTime("2026-10-02"), /^2026년 10월 2일 .*12:00$/);
});

test("kstDate renders the Asia/Seoul day for any offset", () => {
  assert.equal(kstDate("2026-10-04T15:00:00Z"), "2026-10-05");
  assert.equal(kstDate("2026-10-04T14:59:59Z"), "2026-10-04");
  assert.equal(kstDate("2026-10-04T23:30:00+09:00"), "2026-10-04");
  assert.equal(kstDate("2026-10-04"), "2026-10-04");
  // The later of publish/verify wins even when the offsets differ.
  assert.equal(kstDate(laterDate("2026-10-04T23:30:00+09:00", "2026-10-04T15:00:00Z")), "2026-10-05");
});

test("revising a post does not change the newest-first order", () => {
  const merged = mergePosts(
    [
      {
        slug: "older",
        title: "예전 글",
        announcedAt: "2026-09-30",
        publishedAt: "2026-10-01T00:00:00+09:00",
        verifiedAt: "2026-10-01T00:00:00+09:00",
      },
      {
        slug: "newer",
        title: "새 글",
        announcedAt: "2026-09-01",
        publishedAt: "2026-10-03T00:00:00+09:00",
        verifiedAt: "2026-10-03T00:00:00+09:00",
      },
    ],
    [
      // A later verification pass rewrites the older brief.
      { slug: "older", title: "예전 글 개정", verifiedAt: "2026-10-10T00:00:00+09:00" },
    ],
  );
  const revised = merged.find((post) => post.slug === "older");
  assert.equal(revised.title, "예전 글 개정");
  assert.equal(revised.publishedAt, "2026-10-01T00:00:00+09:00", "publish time is never bumped");
  assert.equal(revised.announcedAt, "2026-09-30", "announcement day survives the revision");
  assert.deepEqual(
    sortPosts(merged).map((post) => post.slug),
    ["newer", "older"],
  );
});

test("authored file overwrites a legacy slug with the blog publish time", () => {
  const merged = mergePosts(
    [{ slug: "shared", announcedAt: "2026-10-02", publishedAt: "2026-10-02" }],
    [
      {
        slug: "shared",
        title: "장문 개정",
        announcedAt: "2026-10-02",
        publishedAt: "2026-10-04T14:06:28+09:00",
      },
    ],
  );
  const post = merged.find((item) => item.slug === "shared");
  assert.equal(post.publishedAt, "2026-10-04T14:06:28+09:00");
  assert.equal(post.announcedAt, "2026-10-02");
  // The old date-only value must not leak back through normalization.
  assert.notEqual(post.publishedAt, "2026-10-02");
});

test("dateModified and lastmod never fall before the publish time", () => {
  // Verification can legitimately happen before the blog post goes out.
  const earlier = laterDate("2026-10-04T14:06:28+09:00", "2026-10-04T13:50:04+09:00");
  assert.equal(earlier, "2026-10-04T14:06:28+09:00");
  assert.equal(toIso(earlier), "2026-10-04T05:06:28.000Z");
  assert.equal(toRfc822(earlier), toRfc822("2026-10-04T14:06:28+09:00"));
});

test("renderFeed sorts unsorted input and dates lastBuildDate from content, not now", () => {
  const config = { baseUrl: "https://example.com", rssTitle: "합성 피드", description: "합성 설명" };
  const posts = [
    normalizePost({
      slug: "old",
      publishedAt: "2026-10-01T00:00:00+09:00",
      verifiedAt: "2026-10-05T00:00:00+09:00",
      sources: [{ url: "https://a.test" }],
    }),
    normalizePost({
      slug: "new",
      publishedAt: "2026-10-03T00:00:00+09:00",
      verifiedAt: "2026-10-03T00:00:00+09:00",
      sources: [{ url: "https://b.test" }],
    }),
  ];
  const feed = renderFeed({ config, posts });
  assert.deepEqual(
    [...feed.matchAll(/<link>https:\/\/example\.com\/articles\/([a-z0-9-]+)\//g)].map((match) => match[1]),
    ["new", "old"],
  );
  // A later verification of an older post still counts as a valid content time.
  assert.ok(feed.includes(`<lastBuildDate>${toRfc822("2026-10-05T00:00:00+09:00")}</lastBuildDate>`));
});

test("invalid calendar days, 24:00 rollover and missing timezones are rejected", () => {
  const sample = syntheticArticle();
  assert.deepEqual(inspectArticle(sample), [], "the synthetic fixture must itself be valid");

  const impossible = syntheticArticle({ announcedAt: "2026-02-30" });
  assert.ok(inspectArticle(impossible).some((error) => error.includes("announcedAt")));

  const noOffset = syntheticArticle({ publishedAt: "2026-10-04T14:06:28" });
  assert.ok(inspectArticle(noOffset).some((error) => error.includes("publishedAt")));

  const midnightRollover = syntheticArticle({ publishedAt: "2026-10-04T24:00:00+09:00" });
  assert.ok(inspectArticle(midnightRollover).some((error) => error.includes("publishedAt")));

  const rolledDay = syntheticArticle({ verifiedAt: "2026-02-30T10:00:00+09:00" });
  assert.ok(inspectArticle(rolledDay).some((error) => error.includes("verifiedAt")));
});

test("a valid new synthetic article builds clean and becomes the newest entry", () => {
  const oldArticle = syntheticArticle({
    slug: "synthetic-old-2026",
    title: "합성 예전 글",
    announcedAt: "2026-09-01",
    publishedAt: "2026-09-02T09:00:00+09:00",
    verifiedAt: "2026-09-02T08:00:00+09:00",
  });
  // The next scheduled publish adds one new file to content/articles.
  const newArticle = syntheticArticle({
    slug: "synthetic-next-2026",
    title: "합성 다음 글",
    announcedAt: "2026-10-05",
    publishedAt: "2026-10-06T09:00:00+09:00",
    verifiedAt: "2026-10-06T08:00:00+09:00",
  });
  const { checks, posts, options } = buildFixture({
    basePosts: [oldArticle],
    articles: [oldArticle, newArticle],
  });
  try {
    assert.deepEqual(inspectArticle(newArticle), []);
    assert.deepEqual(checks.errors, []);
    assert.equal(checks.ok, true);
    assert.deepEqual(
      posts.filter(isIndexable).map((post) => post.slug),
      ["synthetic-next-2026", "synthetic-old-2026"],
    );
    assert.ok(fs.existsSync(path.join(options.outDir, "articles", "synthetic-next-2026", "index.html")));
    const html = fs.readFileSync(
      path.join(options.outDir, "articles", "synthetic-next-2026", "index.html"),
      "utf8",
    );
    assert.match(html, /<span>블로그 게시 2026년 10월 6일<\/span>/);
    assert.match(html, /<span>소식 발표 2026년 10월 5일<\/span>/);
  } finally {
    fs.rmSync(options.outDir, { recursive: true, force: true });
  }
});

test("sitemap lastmod follows the KST calendar day across a UTC evening boundary", () => {
  const crossing = syntheticArticle({
    slug: "synthetic-boundary-2026",
    announcedAt: "2026-10-05",
    // 2026-10-04T15:00Z is 2026-10-05T00:00 in Asia/Seoul.
    publishedAt: "2026-10-04T15:00:00Z",
    verifiedAt: "2026-10-04T15:30:00Z",
  });
  const { checks, options } = buildFixture({
    basePosts: [crossing],
    articles: [crossing],
  });
  try {
    assert.deepEqual(checks.errors, []);
    const sitemap = fs.readFileSync(path.join(options.outDir, "sitemap.xml"), "utf8");
    assert.match(
      sitemap,
      /<loc>[^<]*\/articles\/synthetic-boundary-2026\/<\/loc>\s*<lastmod>2026-10-05<\/lastmod>/,
    );
    const home = sitemap.match(/<loc>[^<]*\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/);
    assert.equal(home[1], "2026-10-05");
  } finally {
    fs.rmSync(options.outDir, { recursive: true, force: true });
  }
});

test("real content keeps every known slug and the two separated dates", () => {
  const base = JSON.parse(fs.readFileSync(realContent, "utf8"));
  const posts = loadPosts({ contentPath: realContent, reviewedPath: realReviewed });
  const slugs = new Set(posts.map((post) => post.slug));
  for (const post of base) assert.ok(slugs.has(post.slug), `missing legacy slug ${post.slug}`);
  for (const name of fs.readdirSync(realArticles).filter((file) => file.endsWith(".json"))) {
    const article = JSON.parse(fs.readFileSync(path.join(realArticles, name), "utf8"));
    assert.ok(slugs.has(article.slug), `missing authored slug ${article.slug}`);
  }
  // Every publish time must be a real offset timestamp, not a bare date.
  for (const post of posts) {
    assert.match(post.publishedAt, /(?:Z|[+-]\d{2}:\d{2})$/, `publishedAt needs offset: ${post.slug}`);
    assert.match(post.announcedAt, /^\d{4}-\d{2}-\d{2}$/, `announcedAt needs date-only: ${post.slug}`);
  }
  const expected = {
    "git-2-56-2026": { announcedAt: "2026-09-28", publishedAt: "2026-10-04T14:06:28+09:00" },
    "cloudflare-ohttp-gateway-2026": { announcedAt: "2026-10-02", publishedAt: "2026-10-04T14:06:28+09:00" },
  };
  for (const [slug, dates] of Object.entries(expected)) {
    const post = posts.find((item) => item.slug === slug);
    assert.ok(post, `missing ${slug}`);
    assert.equal(post.announcedAt, dates.announcedAt);
    assert.equal(post.publishedAt, dates.publishedAt);
  }
});

test("built real content shows both dates and the feed uses the publish day", () => {
  const outDir = tempDir("bluebworks-real-");
  try {
    const options = resolveOptions({ SITE_OUT_DIR: outDir });
    const { posts } = build(options);
    assert.ok(posts.length >= 15, "all current articles remain buildable");
    // The list stays newest-first even after a future article is published.
    const keys = posts.map((post) => sortKey(post.publishedAt));
    for (let i = 1; i < keys.length; i += 1) {
      assert.ok(keys[i - 1] >= keys[i], "posts are not sorted by publish instant");
    }
    const git = posts.find((post) => post.slug === "git-2-56-2026");
    const html = fs.readFileSync(path.join(outDir, "articles", "git-2-56-2026", "index.html"), "utf8");
    assert.match(html, /<span>블로그 게시 2026년 10월 4일<\/span>/);
    assert.match(html, /<span>소식 발표 2026년 9월 28일<\/span>/);
    const feed = fs.readFileSync(path.join(outDir, "feed.xml"), "utf8");
    assert.ok(feed.includes(`<pubDate>${toRfc822(git.publishedAt)}</pubDate>`));
    assert.ok(fs.readFileSync(path.join(outDir, "index.html"), "utf8").includes(`articles/${posts[0].slug}/`));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
