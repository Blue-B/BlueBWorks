import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { once } from 'node:events';
import { canonicalStatus, extractStatuses, mergeStatuses, createInboxServer, readState } from '../tools/x-inbox.mjs';

test('canonicalizes public posts without tracking tokens', () => assert.deepEqual(canonicalStatus('https://mobile.twitter.com/Example/status/123?s=20'), { postId: '123', postUrl: 'https://x.com/Example/status/123' }));
test('never accepts external hosts, private URLs or executable schemes', () => { for (const url of ['https://x.com.evil.test/a/status/1', 'https://x.com/messages/1', 'javascript:alert(1)', 'http://x.com/a/status/1', 'https://secret@x.com/a/status/1', 'https://127.0.0.1/a/status/1']) assert.equal(canonicalStatus(url), null); });
test('nested notification URL extraction deduplicates by post ID', () => assert.equal(extractStatuses({ data: { url: 'https://x.com/i/web/status/123' }, body: 'See https://twitter.com/example/status/123?s=20.' }).length, 1));
test('missing status URLs do not produce invented IDs', () => assert.deepEqual(extractStatuses({ title: 'A release', tweet_id: '123', body: 'Read the announcement' }), []));
test('private message notifications and credentials are ignored', () => { assert.deepEqual(extractStatuses({ type: 'direct_message', body: 'https://x.com/a/status/1' }), []); assert.deepEqual(extractStatuses({ auth_token: 'https://x.com/a/status/1', cookie: 'https://x.com/a/status/2' }), []); });
test('repeat delivery preserves first receipt time and discards stale records', () => { const items = [{ postUrl: 'https://x.com/a/status/1', receivedAt: '2026-10-06T00:00:00Z' }, { postUrl: 'https://x.com/a/status/2', receivedAt: '2026-09-01T00:00:00Z' }]; const result = mergeStatuses(items, [{ postUrl: 'https://x.com/a/status/1' }], '2026-10-07T00:00:00Z'); assert.equal(result.length, 1); assert.equal(result[0].receivedAt, items[0].receivedAt); assert.equal(result[0].unverified, true); });
function request(port, body, headers = {}, route = '/ingest', method = 'POST') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method, headers: { 'Content-Type': 'application/json', ...headers } }, response => { const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode, json: JSON.parse(Buffer.concat(chunks)) })); });
    req.on('error', reject); req.end(body);
  });
}
test('local HTTP receiver persists only minimal public hints and enforces boundaries', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blueb-x-test-')); const file = path.join(directory, 'x-inbox.json');
  const server = createInboxServer(file); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); });
  const result = await request(port, JSON.stringify({ data: { url: 'https://x.com/example/status/123?s=20' }, body: 'Private notification text', auth_token: 'DO_NOT_STORE_THIS' }));
  assert.equal(result.status, 202); assert.equal(result.json.extracted, 1);
  const disk = fs.readFileSync(file, 'utf8'); assert.doesNotMatch(disk, /DO_NOT_STORE_THIS|Private notification text|auth_token|\?s=20/);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600); assert.equal(readState(file).items.length, 1);
  assert.equal((await request(port, '{}', { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await request(port, '{}', { Host: 'evil.test' })).status, 403);
  assert.equal((await request(port, '{}', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await request(port, '{bad')).status, 400);
  assert.equal((await request(port, JSON.stringify({ body: 'x'.repeat(65537) }))).status, 413);
  const health = await request(port, '', {}, '/health', 'GET'); assert.equal(health.json.upstreamConnection, 'not-observed'); assert.equal(health.json.receiver, 'running');
});
