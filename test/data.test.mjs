import test from "node:test";
import assert from "node:assert/strict";
import { isIndexable, mergePosts, normalizePost, sortPosts } from "../build/lib/data.mjs";

test("normalizePost keeps existing fields and new optional fields", () => {
  const post = normalizePost({
    slug: "demo",
    title: "제목",
    summary: "요약",
    category: "모델",
    publishedAt: "2026-01-02",
    verifiedAt: "2026-01-03T10:00:00+09:00",
    status: "Preview",
    tags: ["a", "b"],
    keyPoints: ["하나"],
    sections: [
      { title: "본문", body: "본문 문장." },
      { title: "문단", paragraphs: ["첫 문단.", "둘째 문단."], sourceRefs: [1, "2"] },
    ],
    sources: [{ name: "원문", url: "https://example.com/a" }],
    sourceRefs: [1],
    resources: [{ name: "문서", url: "https://example.com/doc", description: "설명", type: "공식 문서" }],
    videos: [
      { youtubeId: "abcdefghijk", title: "공식 영상", channel: "채널", sourceUrl: "https://youtube.com/watch?v=abcdefghijk", verified: true },
      { youtubeId: "zzzzzzzzzzz", title: "미검증", verified: false },
    ],
    corrections: [{ date: "2026-02-01", text: "수치를 고쳤습니다." }],
    reviewStatus: "verified",
  });

  assert.equal(post.slug, "demo");
  assert.equal(post.sections.length, 2);
  assert.deepEqual(post.sections[1].paragraphs, ["첫 문단.", "둘째 문단."]);
  assert.deepEqual(post.sections[1].sourceRefs, [1, 2]);
  assert.equal(post.resources.length, 1);
  assert.equal(post.resources[0].type, "공식 문서");
  assert.equal(post.videos.length, 1);
  assert.equal(post.videos[0].youtubeId, "abcdefghijk");
  assert.equal(post.corrections.length, 1);
  assert.equal(isIndexable(post), true);
});

test("videos without verified:true are dropped so no IDs are invented", () => {
  const post = normalizePost({
    slug: "no-video",
    title: "t",
    summary: "s",
    sections: [],
    sources: [{ url: "https://example.com" }],
    videos: [{ youtubeId: "abcdefghijk", title: "unverified" }],
  });
  assert.equal(post.videos.length, 0);
});

test("mergePosts overrides by slug, appends new slugs, never mutates input", () => {
  const base = [
    { slug: "one", title: "원래 제목", summary: "s", sources: [{ url: "https://a.test" }] },
    { slug: "two", title: "둘", summary: "s", sources: [{ url: "https://b.test" }] },
  ];
  const frozen = JSON.parse(JSON.stringify(base));
  const reviewed = [
    { slug: "one", title: "고친 제목" },
    { slug: "three", title: "새 글", summary: "s", sources: [{ url: "https://c.test" }] },
  ];
  const merged = mergePosts(base, reviewed);
  assert.deepEqual(base, frozen, "original array must not be mutated");
  assert.equal(merged.length, 3);
  const one = merged.find((post) => post.slug === "one");
  assert.equal(one.title, "고친 제목");
  assert.equal(one.summary, "s", "unspecified fields survive the override");
  assert.equal(one.reviewed, true);
  assert.equal(merged.find((post) => post.slug === "three").reviewed, true);
});

test("unverified or evidence-free posts are not indexable", () => {
  const evidence = { sources: [{ url: "https://a.test" }] };
  assert.equal(isIndexable(normalizePost({ slug: "a", ...evidence })), true);
  assert.equal(
    isIndexable(normalizePost({ slug: "b", reviewStatus: "unverified", ...evidence })),
    false,
  );
  assert.equal(isIndexable(normalizePost({ slug: "c", sources: [] })), false);
});

test("sortPosts orders newest first and keeps original order on ties", () => {
  const posts = [
    normalizePost({ slug: "old", publishedAt: "2026-01-01", sources: [{ url: "https://a.test" }] }),
    normalizePost({ slug: "new", publishedAt: "2026-03-01", sources: [{ url: "https://a.test" }] }),
    normalizePost({ slug: "tie", publishedAt: "2026-03-01", sources: [{ url: "https://a.test" }] }),
  ];
  assert.deepEqual(
    sortPosts(posts).map((post) => post.slug),
    ["new", "tie", "old"],
  );
});
