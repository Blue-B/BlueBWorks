import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const meta = (html) => html.match(/<meta name="description" content="([^"]*)">/)?.[1];

test("홈과 글 목록의 검색 제목·설명이 구체적이다", () => {
  for (const page of ["docs/index.html", "docs/articles/index.html"]) {
    const html = read(page);
    assert.match(html, /<title>AI.*오픈소스.*BlueBWorks<\/title>/);
    assert.ok(meta(html)?.length >= 60);
    assert.ok(meta(html)?.length <= 180);
  }
});

test("모든 글에 검색 설명과 독립 대표 주소가 있다", () => {
  for (const entry of fs.readdirSync(path.join(root, "docs/articles"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = read("docs/articles/" + entry.name + "/index.html");
    assert.ok(meta(html) && meta(html).length <= 180, entry.name);
    assert.ok(html.includes('content="' + meta(html) + '">'), entry.name);
    assert.ok(html.includes('/articles/' + entry.name + '/'), entry.name);
  }
});
