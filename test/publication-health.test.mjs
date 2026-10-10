import test from "node:test";
import assert from "node:assert/strict";
import { publicationHealth } from "../tools/publication-health.mjs";

test("최신 글은 홈·목록·기사·RSS·사이트맵에 존재한다", () => {
  const result = publicationHealth({ now: new Date() });
  assert.equal(result.status, "ok");
  assert.match(result.url, /^https:\/\//);
});

test("오래된 글을 새로 발행했다고 오인하지 않는다", () => {
  const current = publicationHealth({ now: new Date() });
  const published = Date.parse(current.publishedAt);
  const future = new Date(published + 48 * 3600 * 1000);
  assert.throws(() => publicationHealth({ now: future, maxAgeHours: 24 }), /경과/);
});
