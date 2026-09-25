#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const S = require('./core.js');
function readSnapshot(path, label) { const stat = fs.statSync(path); if (!stat.isFile() || stat.size > S.LIMITS.bytes) throw new Error(label + ': 2 MiB 이하의 일반 JSON 파일이 필요해.'); return S.parseSnapshot(fs.readFileSync(path, 'utf8'), label); }
function main(args) {
  const help = 'Usage: node cli.cjs before.json after.json [--format json|markdown] [--fail-on-change]\nNo server execution or network requests. Exit: 0 success, 1 changes (opt-in), 2 invalid input.';
  if (args.includes('--help')) { console.log(help); return 0; }
  const positional = []; let format = 'json', fail = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format') { format = args[++i]; if (!['json', 'markdown'].includes(format)) throw new Error('--format은 json 또는 markdown이어야 해.'); }
    else if (args[i] === '--fail-on-change') fail = true;
    else if (args[i].startsWith('--')) throw new Error('알 수 없는 옵션이야. --help로 사용법을 확인해.');
    else positional.push(args[i]);
  }
  if (positional.length !== 2) throw new Error(help);
  const result = S.compare(readSnapshot(positional[0], '변경 전'), readSnapshot(positional[1], '변경 후'));
  console.log(format === 'json' ? JSON.stringify(S.exportReport(result), null, 2) : S.markdownReport(result));
  return fail && result.counts.added + result.counts.changed + result.counts.removed > 0 ? 1 : 0;
}
try { process.exitCode = main(process.argv.slice(2)); } catch (error) { console.error(error instanceof S.SnapshotError ? error.message : error.code ? '파일을 읽지 못했어. 경로와 권한을 확인해.' : error.message); process.exitCode = 2; }
