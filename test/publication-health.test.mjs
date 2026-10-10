import test from "node:test";
import assert from "node:assert/strict";
import { publicationHealth } from "../tools/publication-health.mjs";

test("최신 글은 홈·목록·기사·RSS·사이트맵에 존재한다", () => {
  const result = publicationHealth({ now: "2026-10-10T00:00:00+09:00" });
  assert.equal(result.status, "ok");
  assert.match(result.url, /^https:\/\//);
});

test("오래된 글을 새로 발행했다고 오인하지 않는다", () => {
  assert.throws(() => publicationHealth({ now: "2026-10-12T00:00:00+09:00", maxAgeHours: 24 }), /경과/);
});
