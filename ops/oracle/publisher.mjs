#!/usr/bin/env node
// Oracle ARM publisher. AI prepares reviewed pending/articles/*.json; this
// worker handles isolated checkout, quality gates, atomic git publish & proof.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import https from "node:https";
import { candidateFiles, validateCandidate, publishedTime, stampArticle, jsonLine, slotOf, completedInSlot } from "./publisher-core.mjs";

const defaults = {
  repo: process.env.BLUEBWORKS_REPO || "https://github.com/Blue-B/BlueBWorks.git",
  state: process.env.BLUEBWORKS_STATE_DIR || path.join(os.homedir(), ".local", "state", "bluebworks-publisher"),
  pages: process.env.BLUEBWORKS_PAGES || "https://blue-b.github.io/BlueBWorks",
};
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const probe = args.has("--probe");
const MAX_LOG = 6 * 1024 * 1024;
const attempts = Number(process.env.BLUEBWORKS_PAGES_ATTEMPTS || 8);
const waitMs = Number(process.env.BLUEBWORKS_PAGES_DELAY_MS || 12000);
const now = () => new Date();
const exit = (result, code = 0) => { console.log(JSON.stringify(result)); process.exitCode = code; };

function spawn(cmd, argv, cwd, timeout = 180000) {
  const run = spawnSync(cmd, argv, {
    cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
    encoding: "utf8", timeout, maxBuffer: 12 * 1024 * 1024
  });
  if (run.error || run.status !== 0) {
    const message = ((run.stderr || "") + "\n" + (run.stdout || "")).slice(-1800)
      .replace(/(https?:\/\/)[^\s@]+@/g, "$1[REDACTED]@")
      .replace(/(token|password|authorization)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
    throw new Error(cmd + " " + argv.slice(0, 3).join(" ") + " failed: " + (run.error?.message || message));
  }
  return run.stdout.trim();
}

function statusLog(state, result) {
  const filename = path.join(state, "history.jsonl");
  if (fs.existsSync(filename) && fs.statSync(filename).size > MAX_LOG) {
    fs.renameSync(filename, path.join(state, "history.previous.jsonl"));
  }
  fs.appendFileSync(filename, jsonLine(result), { mode: 0o600 });
}
function acquireLock(state) {
  const folder = path.join(state, "lock");
  try { fs.mkdirSync(folder); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    let pid = 0;
    try { pid = Number(fs.readFileSync(path.join(folder, "pid"), "utf8")); } catch {}
    let alive = false;
    if (pid) try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === "EPERM"; }
    const age = Date.now() - fs.statSync(folder).mtimeMs;
    if (alive || age < 2 * 60 * 1000) throw new Error("Another publisher run holds the lock");
    fs.rmSync(folder, { recursive: true, force: true });
    fs.mkdirSync(folder);
  }
  fs.writeFileSync(path.join(folder, "pid"), String(process.pid), { mode: 0o600 });
  return () => fs.rmSync(folder, { recursive: true, force: true });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 10000, headers: { "User-Agent": "BlueBWorks-Publisher/1.0" } }, response => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        if (!new URL(response.headers.location, url).href.startsWith(defaults.pages)) return reject(new Error("Unexpected redirect"));
        return resolve(fetchPage(new URL(response.headers.location, url).href));
      }
      let text = "";
      response.on("data", data => { text += data; if (text.length > 2_000_000) request.destroy(new Error("Page too large")); });
      response.on("end", () => resolve({ status: response.statusCode, text }));
    });
    request.on("timeout", () => request.destroy(new Error("Page request timed out")));
    request.on("error", reject);
  });
}
async function publicProof(slug) {
  const url = defaults.pages.replace(/\/+$/, "") + "/articles/" + slug + "/";
  let last = "No response";
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const page = await fetchPage(url);
      if (page.status === 200 && page.text.includes('class="article-body"') && page.text.includes('/articles/' + slug + '/')) return { url, confirmed: true };
      last = "HTTP " + page.status + " / article body missing";
    } catch (error) { last = error.message; }
    if (attempt < attempts - 1) await sleep(waitMs);
  }
  return { url, confirmed: false, reason: last };
}

function prepareClone(working) {
  spawn("git", ["clone", "--quiet", "--no-tags", "--single-branch", "--branch", "main", "--depth", "1", defaults.repo, working], process.cwd(), 180000);
  const remote = spawn("git", ["remote", "get-url", "origin"], working);
  if (remote !== defaults.repo) throw new Error("Untrusted Git origin");
  return spawn("git", ["rev-parse", "HEAD"], working);
}

function buildAndTest(working, slug, before) {
  spawn("npm", ["run", "verify"], working, 240000);
  if (slug) {
    spawn("node", ["tools/publication-health.mjs", "--since=" + before.toISOString()], working, 30000);
    const article = fs.readFileSync(path.join(working, "docs", "articles", slug, "index.html"), "utf8");
    if (!article.includes('class="article-body"') || !article.includes("/articles/" + slug + "/")) throw new Error("Generated article HTML is incomplete");
  } else {
    spawn("node", ["tools/publication-health.mjs"], working, 30000);
  }
}

async function run() {
  const state = defaults.state;
  fs.mkdirSync(state, { recursive: true, mode: 0o700 });
  let unlock;
  try { unlock = acquireLock(state); }
  catch (error) {
    const result = { status: "failed", phase: "lock", error: error.message };
    statusLog(state, result); return exit(result, 1);
  }
  const runId = now().toISOString().replace(/[^0-9]/g, "") + "-" + crypto.randomBytes(3).toString("hex");
  const workspace = path.join(state, "run-" + runId);
  let phase = "start", pushed = false, slug = "", mainBefore = "";
  const slot = slotOf(now());
  try {
    if (!probe && !dryRun && completedInSlot(path.join(state, "history.jsonl"), slot)) {
      const result = { status: "already_published_this_slot", phase: "complete", slot };
      statusLog(state, result); return exit(result);
    }
    phase = "clone";
    mainBefore = prepareClone(workspace);
    const pending = candidateFiles(workspace);
    if (probe || pending.length === 0) {
      if (probe) {
        phase = "verify";
        buildAndTest(workspace, null);
        phase = "push_dry_run";
        spawn("git", ["config", "user.name", "BlueBWorks Publisher"], workspace);
        spawn("git", ["config", "user.email", "55532956+Blue-B@users.noreply.github.com"], workspace);
        spawn("git", ["commit", "--allow-empty", "-m", "publisher dry-run authentication check"], workspace);
        spawn("git", ["push", "--dry-run", "origin", "HEAD:refs/heads/main"], workspace, 30000);
      }
      const result = { status: probe ? "probe_ok" : "no_candidate", phase: "complete", slot, mainBefore, pending: pending.length, dryRun, pushDryRun: probe };
      statusLog(state, result); return exit(result);
    }
    if (pending.length > 1) console.log(JSON.stringify({ info: "Only one pending article published per run", pending: pending.length }));
    const item = pending[0]; slug = item.slug;
    phase = "validate";
    const content = validateCandidate(JSON.parse(fs.readFileSync(item.path, "utf8")), slug, workspace);
    const previous = publishedTime(fs.readFileSync(path.join(workspace, "docs", "feed.xml"), "utf8"));
    const article = stampArticle(content, previous);
    const dest = path.join(workspace, "content", "articles", slug + ".json");
    fs.writeFileSync(dest, JSON.stringify(article, null, 2) + "\n");
    fs.unlinkSync(item.path);

    phase = "build";
    buildAndTest(workspace, slug, previous);
    if (dryRun) {
      const result = { status: "dry_run_ok", phase: "build", slug, slot, mainBefore, pending: pending.length };
      statusLog(state, result); return exit(result);
    }

    phase = "commit";
    spawn("git", ["config", "user.name", "BlueBWorks Publisher"], workspace);
    spawn("git", ["config", "user.email", "55532956+Blue-B@users.noreply.github.com"], workspace);
    spawn("git", ["add", "--", "content/articles/" + slug + ".json", "docs"], workspace);
    spawn("git", ["add", "-u", "--", item.relative], workspace);
    const staged = spawn("git", ["diff", "--cached", "--name-only"], workspace);
    if (!staged.includes("docs/index.html") || !staged.includes("docs/feed.xml") || !staged.includes("docs/sitemap.xml") || !staged.includes(slug + ".json")) {
      throw new Error("Required build output is missing from the staged commit");
    }
    spawn("git", ["commit", "-m", "content: publish " + slug], workspace);
    const commit = spawn("git", ["rev-parse", "HEAD"], workspace);
    phase = "push";
    // Non-force push. If another run changed main, stop, keep candidate in
    // origin, and retry from a new clean checkout on the next run.
    spawn("git", ["push", "origin", "HEAD:refs/heads/main"], workspace, 120000);
    pushed = true;
    phase = "public_verify";
    const proof = await publicProof(slug);
    const result = { status: proof.confirmed ? "published" : "pushed_unverified", slug, slot, phase, mainBefore, commit, ...proof };
    statusLog(state, result); return exit(result, proof.confirmed ? 0 : 2);
  } catch (error) {
    const result = { status: pushed ? "pushed_unverified" : "failed", slug, slot, phase, mainBefore, error: error.message };
    statusLog(state, result); return exit(result, 1);
  } finally {
    try { fs.rmSync(workspace, { recursive: true, force: true }); } catch {}
    unlock();
  }
}
await run();
