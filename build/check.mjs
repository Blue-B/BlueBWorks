#!/usr/bin/env node
// Validates a built docs/ tree. Run `npm run build` first.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPosts, sortPosts } from "./lib/data.mjs";
import { runChecks } from "./lib/check.mjs";
import { resolveOptions } from "./build.mjs";

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const options = resolveOptions();
  const posts = sortPosts(loadPosts({ contentPath: options.contentPath, reviewedPath: options.reviewedPath }));
  const result = runChecks({
    outDir: options.outDir,
    config: options.config,
    base: options.base,
    posts,
    assetsDir: options.assetsDir,
  });
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (result.ok) {
    console.log(`check passed: ${result.stats.pages} pages, ${result.stats.jsonLd} JSON-LD blocks, ${posts.length} slugs`);
  } else {
    for (const error of result.errors) console.error(`error: ${error}`);
    console.error(`check failed: ${result.errors.length} problem(s)`);
    process.exitCode = 1;
  }
}
