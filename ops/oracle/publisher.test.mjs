import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { candidateFiles, validateCandidate, stampArticle, publishedTime, slotOf, completedInSlot } from "./publisher-core.mjs";

test("Queue filenames are ordered and invalid slugs rejected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "publisher-core-"));
  try {
    fs.mkdirSync(path.join(root, "pending", "articles"), { recursive: true });
    fs.writeFileSync(path.join(root, "pending", "articles", "bbb.json"), "{}");
    fs.writeFileSync(path.join(root, "pending", "articles", "aaa.json"), "{}");
    assert.deepEqual(candidateFiles(root).map(x => x.slug), ["aaa", "bbb"]);
    fs.writeFileSync(path.join(root, "pending", "articles", "BAD.json"), "{}");
    assert.throws(() => candidateFiles(root), /Invalid pending filename/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("Invalid or duplicate queue posts never overwrite published content", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "publisher-core-"));
  try {
    fs.mkdirSync(path.join(root, "content", "articles"), { recursive: true });
    fs.mkdirSync(path.join(root, "docs", "data"), { recursive: true });
    fs.mkdirSync(path.join(root, "content"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs/data/posts.json"), "[]");
    fs.writeFileSync(path.join(root, "content/reviewed-posts.json"), "[]");
    const draft = { slug: "some-topic", title: "A meaningful product update", summary: "An accurate summary with enough words to explain the change and audience.", sources: [{}, {}], editorialVersion: 2, reviewStatus: "reviewed" };
    assert.equal(validateCandidate(draft, "some-topic", root).slug, "some-topic");
    assert.throws(() => validateCandidate(draft, "another-topic", root), /does not match/);
    fs.writeFileSync(path.join(root, "content/articles/some-topic.json"), "{}");
    assert.throws(() => validateCandidate(draft, "some-topic", root), /already published/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("Morning and evening retries share one slot, and only completed publication blocks duplicates", () => {
  assert.equal(slotOf(new Date("2026-10-10T00:20:00Z")), "2026-10-10-am");
  assert.equal(slotOf(new Date("2026-10-10T01:30:00Z")), "2026-10-10-am");
  assert.equal(slotOf(new Date("2026-10-10T11:20:00Z")), "2026-10-10-pm");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "publisher-slot-"));
  try {
    const log = path.join(dir, "history.jsonl");
    fs.writeFileSync(log, JSON.stringify({ slot: "2026-10-10-am", status: "no_candidate" }) + "\n");
    assert.equal(completedInSlot(log, "2026-10-10-am"), false);
    fs.appendFileSync(log, JSON.stringify({ slot: "2026-10-10-am", status: "pushed_unverified" }) + "\n");
    assert.equal(completedInSlot(log, "2026-10-10-am"), true);
    assert.equal(completedInSlot(log, "2026-10-10-pm"), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("Real blog publication time is stamped by publisher, not copied from draft", () => {
  const old = publishedTime("<rss><item><pubDate>Thu, 08 Oct 2026 16:20:00 GMT</pubDate></item></rss>");
  const result = stampArticle({ publishedAt: "2026-01-01T00:00:00Z" }, old, new Date("2026-10-11T09:00:00Z"));
  assert.equal(result.publishedAt, "2026-10-11T09:00:00.000Z");
  assert.throws(() => stampArticle({}, old, new Date("2026-10-01T00:00:00Z")), /clock/);
});
