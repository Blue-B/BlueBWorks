'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const S = require('./core.js');
const make = () => ({ name: 'test', inputSchema: { type: 'object', properties: {} } });
const compare = (a, b) => S.compare(S.parseSnapshot(JSON.stringify([a])), S.parseSnapshot(JSON.stringify([b])));
for (const keyword of ['default', 'const', 'examples']) {
  test(keyword + ' keeps literal array order even under a key named required', () => {
    const a = make(), b = make(); a.inputSchema[keyword] = { required: ['first', 'second'] }; b.inputSchema[keyword] = { required: ['second', 'first'] };
    assert.equal(compare(a, b).counts.changed, 1);
  });
}
test('enum object literals keep order inside nested arrays', () => {
  const a = make(), b = make();
  a.inputSchema.properties.choice = { enum: [{ type: ['a', 'b'] }] };
  b.inputSchema.properties.choice = { enum: [{ type: ['b', 'a'] }] };
  assert.equal(compare(a, b).counts.changed, 1);
});
test('metadata arrays are not schema keyword sets', () => {
  const a = make(), b = make(); a._meta = { required: [1, 2] }; b._meta = { required: [2, 1] };
  assert.equal(compare(a, b).counts.changed, 1);
});
test('nested schema required sets normalize in properties and definitions', () => {
  const a = make(), b = make();
  a.inputSchema.properties.nested = { type: 'object', required: ['a', 'b'] };
  b.inputSchema.properties.nested = { type: 'object', required: ['b', 'a'] };
  a.inputSchema.$defs = { nested: { type: ['string', 'null'] } };
  b.inputSchema.$defs = { nested: { type: ['null', 'string'] } };
  assert.equal(compare(a, b).counts.unchanged, 1);
});
test('tuple prefixItems order remains significant', () => {
  const a = make(), b = make();
  a.inputSchema.properties.tuple = { type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }] };
  b.inputSchema.properties.tuple = { type: 'array', prefixItems: [{ type: 'number' }, { type: 'string' }] };
  assert.equal(compare(a, b).counts.changed, 1);
});
test('standalone build preserves literal sources and correct CSP hashes', () => {
  const build = spawnSync(process.execPath, ['build.cjs'], { cwd: __dirname, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const html = fs.readFileSync(path.join(__dirname, 'dist', 'ScopeDiff.html'), 'utf8');
  for (const [filename, tag] of [['core.js', 'script'], ['app.js', 'script'], ['style.css', 'style']]) {
    const bytes = fs.readFileSync(path.join(__dirname, filename), 'utf8');
    assert.ok(html.includes('<' + tag + '>' + bytes + '</' + tag + '>'), filename);
    assert.ok(html.includes('sha256-' + crypto.createHash('sha256').update(bytes).digest('base64')), filename);
  }
  assert.ok(!html.includes('<script src=')); assert.ok(!html.includes('<link rel="stylesheet"'));
  assert.ok(html.includes("connect-src 'none'"));
});
test('CLI processes real files and reports all three exit statuses', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scopediff-test-'));
  try {
    const before = path.join(dir, 'before.json'), after = path.join(dir, 'after.json');
    fs.writeFileSync(before, JSON.stringify({ tools: [] })); fs.writeFileSync(after, JSON.stringify({ tools: [make()] }));
    const run = args => spawnSync(process.execPath, [path.join(__dirname, 'cli.cjs'), ...args], { encoding: 'utf8' });
    let r = run([before, after]); assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).counts.added, 1);
    r = run([before, after, '--fail-on-change']); assert.equal(r.status, 1);
    r = run([after, after, '--fail-on-change', '--format', 'markdown']); assert.equal(r.status, 0); assert.match(r.stdout, /ScopeDiff/);
    r = run([before, after, '--format', 'invalid']); assert.equal(r.status, 2);
    fs.writeFileSync(after, '{'); r = run([before, after]); assert.equal(r.status, 2);
    r = run([before, path.join(dir, 'absent.json')]); assert.equal(r.status, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
