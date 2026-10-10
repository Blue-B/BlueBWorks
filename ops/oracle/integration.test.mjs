import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function run(cmd, args, cwd, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd, encoding: "utf8", timeout: 240000,
    env: { ...process.env, ...env, GIT_TERMINAL_PROMPT: "0" },
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.status, 0, cmd + " failed: " + (result.stderr || result.stdout).slice(-1800));
  return result.stdout;
}

if (process.env.BLUEBWORKS_PUBLISHER_INTEGRATION === "1") {
  test("Integration fixture does not recurse inside its own checkout", { skip: true }, () => {});
} else {
  test("Real Git clone + queued article + full build works without publishing to GitHub", { timeout: 270000 }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bluebworks-publisher-e2e-"));
    const fixture = path.join(dir, "source");
    const remote = path.join(dir, "origin.git");
    const state = path.join(dir, "state");
    try {
      // Use the current local repository as a self-contained offline test source.
      run("git", ["clone", "--quiet", "--no-hardlinks", root, fixture], root);
      run("git", ["config", "user.name", "BlueBWorks Integration Test"], fixture);
      run("git", ["config", "user.email", "publisher@example.invalid"], fixture);
      const original = JSON.parse(fs.readFileSync(path.join(fixture, "content/articles/github-stacked-pull-requests-ga-2026.json"), "utf8"));
      const slug = "publisher-synthetic-dry-run";
      const post = { ...original, slug, title: "Publisher synthetic validation article - not for public publishing", publishedAt: "", reviewStatus: "reviewed" };
      const dest = path.join(fixture, "pending", "articles", slug + ".json");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, JSON.stringify(post, null, 2) + "\n");
      run("git", ["add", "--", "pending/articles/" + slug + ".json"], fixture);
      run("git", ["commit", "-qm", "test: pending article fixture"], fixture);
      run("git", ["clone", "--quiet", "--bare", fixture, remote], dir);
      const output = run("node", [path.join(root, "ops/oracle/publisher.mjs"), "--dry-run"], root, {
        BLUEBWORKS_REPO: remote, BLUEBWORKS_STATE_DIR: state,
        BLUEBWORKS_PUBLISHER_INTEGRATION: "1",
      });
      assert.match(output, /"status":"dry_run_ok"/);
      assert.match(output, /"slug":"publisher-synthetic-dry-run"/);
      const log = fs.readFileSync(path.join(state, "history.jsonl"), "utf8");
      assert.match(log, /dry_run_ok/);
      const stillPending = run("git", ["--git-dir=" + remote, "ls-tree", "-r", "--name-only", "HEAD"], dir);
      assert.match(stillPending, /pending\/articles\/publisher-synthetic-dry-run\.json/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
