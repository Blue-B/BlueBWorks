#!/usr/bin/env node
// Local-only Angelic Angel webhook adapter. Stores public status links, never cookies/raw payloads.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 64 * 1024;
const MAX_ITEMS = 500;
const RETENTION = 7 * 86400000;
export function canonicalStatus(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(url.hostname)) return null;
    const match = /^\/(?:([A-Za-z0-9_]{1,15})|i\/web)\/status\/(\d{1,25})\/?$/.exec(url.pathname);
    if (!match) return null;
    return { postId: match[2], postUrl: `https://x.com/${match[1] || 'i/web'}/status/${match[2]}` };
  } catch { return null; }
}
export function extractStatuses(payload) {
  const result = new Map(); let visited = 0;
  function walk(value, depth = 0) {
    if (depth > 12 || ++visited > 4000) return;
    if (typeof value === 'string') {
      for (const match of value.matchAll(/https:\/\/[^\s<>"'\\]+/g)) {
        const status = canonicalStatus(match[0].replace(/[).,;!?\]]+$/, ''));
        if (status) result.set(status.postId, status);
      }
    } else if (Array.isArray(value)) value.forEach(item => walk(item, depth + 1));
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        // Do not scan credential or private-message fields.
        if (!/auth|token|cookie|secret|password|direct.?message|^dm$/i.test(key)) walk(item, depth + 1);
      }
    }
  }
  if (!payload || typeof payload !== 'object') return [];
  const kind = String(payload.type || payload.notification_type || payload.event || '');
  if (/direct.?message|^dm$/i.test(kind)) return [];
  walk(payload);
  return [...result.values()].slice(0, 20);
}
export function mergeStatuses(items, incoming, now = new Date().toISOString()) {
  const cutoff = Date.parse(now) - RETENTION;
  const result = new Map();
  for (const item of items || []) {
    const status = canonicalStatus(item.postUrl);
    if (status && Date.parse(item.receivedAt) >= cutoff) result.set(status.postId, { ...status, receivedAt: item.receivedAt, source: 'angelic-angel', unverified: true });
  }
  for (const item of incoming) {
    const status = canonicalStatus(item.postUrl);
    if (status && !result.has(status.postId)) result.set(status.postId, { ...status, receivedAt: now, source: 'angelic-angel', unverified: true });
  }
  return [...result.values()].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)).slice(0, MAX_ITEMS);
}
function stateFile() {
  return path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state'), 'bluebworks', 'x-inbox.json');
}
export function readState(file) {
  try {
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error('symlink state file refused');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data.items)) throw new Error('invalid inbox state');
    return { ...data, items: mergeStatuses(data.items, []) };
  } catch (error) { if (error.code === 'ENOENT') return { schemaVersion: 1, items: [], lastWebhookAt: null, lastCandidateAt: null }; throw error; }
}
function saveState(file, state) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('symlink state directory refused');
  const temporary = path.join(directory, `.x-inbox-${crypto.randomUUID()}.tmp`);
  try { fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
export function createInboxServer(file = stateFile()) {
  return http.createServer((request, response) => {
    const reply = (status, data) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
    if (!/^127\.0\.0\.1(?::\d+)?$/.test(request.headers.host || '') || request.headers.origin) { reply(403, { error: 'local requests only' }); request.resume(); return; }
    if (request.method === 'GET' && request.url === '/health') {
      try { const state = readState(file); reply(200, { receiver: 'running', items: state.items.length, lastWebhookAt: state.lastWebhookAt, lastCandidateAt: state.lastCandidateAt, upstreamConnection: 'not-observed' }); }
      catch { reply(500, { error: 'state unavailable' }); }
      return;
    }
    if (request.method !== 'POST' || request.url !== '/ingest') { reply(404, { error: 'not found' }); request.resume(); return; }
    if (!(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) { reply(415, { error: 'JSON required' }); request.resume(); return; }
    let bytes = 0; const chunks = []; let rejected = false;
    request.on('error', () => { if (!response.headersSent) reply(400, { error: 'request interrupted' }); });
    request.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) { if (!rejected) { rejected = true; chunks.length = 0; reply(413, { error: 'payload too large' }); } return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (rejected || response.headersSent) return;
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reply(400, { error: 'invalid JSON' }); return; }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) { reply(400, { error: 'JSON object required' }); return; }
      try {
        const statuses = extractStatuses(payload); const now = new Date().toISOString(); const state = readState(file);
        state.items = mergeStatuses(state.items, statuses, now); state.lastWebhookAt = now;
        if (statuses.length) state.lastCandidateAt = now;
        saveState(file, state);
        reply(202, { extracted: statuses.length, queued: state.items.length, unverified: true });
      } catch { reply(500, { error: 'could not persist inbox' }); }
    });
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'export') {
      const state = readState(stateFile());
      console.log(JSON.stringify({ transport: 'angelic-angel', receiverRunning: 'not-checked', lastWebhookAt: state.lastWebhookAt, lastCandidateAt: state.lastCandidateAt, items: state.items, notice: 'Discovery hints only. receivedAt is not the original post time. Verify each public post and its official source before publication.' }, null, 2));
    } else if (!process.argv[2] || process.argv[2] === 'serve') {
      const port = Number(process.env.X_INBOX_PORT || 4319);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('X_INBOX_PORT must be 1024..65535');
      const server = createInboxServer(); server.requestTimeout = 15000; server.headersTimeout = 10000;
      server.on('error', () => { console.error('X inbox could not start; check port and private state directory.'); process.exitCode = 1; });
      server.listen(port, '127.0.0.1', () => console.log(`X inbox listening on 127.0.0.1:${port}; upstream is not yet verified.`));
      for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.close(); server.closeIdleConnections?.(); });
    } else throw new Error('usage: node tools/x-inbox.mjs [serve|export]');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
