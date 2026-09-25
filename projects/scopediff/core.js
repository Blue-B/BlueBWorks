'use strict';
(function (root) {
  const LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, tools: 500, depth: 48, nodes: 100000 });
  const HINTS = Object.freeze({ readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true });
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  class SnapshotError extends Error { constructor(message) { super(message); this.name = 'SnapshotError'; } }
  function bounded(value, depth = 0, budget = { n: 0 }) {
    if (depth > LIMITS.depth || ++budget.n > LIMITS.nodes) throw new SnapshotError('데이터 구조가 너무 복잡해. 깊이 48단계, 항목 100,000개 이하로 줄여줘.');
    if (value && typeof value === 'object') for (const v of Object.values(value)) bounded(v, depth + 1, budget);
  }
  function canonical(value, key = '') {
    if (Array.isArray(value)) {
      const items = value.map(v => canonical(v));
      return '[' + ((key === 'required' || key === 'enum' || key === 'type') ? [...new Set(items)].sort() : items).join(',') + ']';
    }
    if (record(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k], k)).join(',') + '}';
    return JSON.stringify(value);
  }
  function validateName(value, what, max) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new SnapshotError(what + ' 이름이 비어 있거나 너무 길거나 제어 문자를 포함해.');
  }
  function validateSchema(value, label) {
    if (!record(value) || value.type !== 'object') throw new SnapshotError(label + '는 type: "object"인 JSON Schema여야 해.');
    if (own(value, 'properties') && !record(value.properties)) throw new SnapshotError(label + '.properties는 객체여야 해.');
    if (own(value, 'required') && (!Array.isArray(value.required) || value.required.some(k => typeof k !== 'string') || new Set(value.required).size !== value.required.length)) throw new SnapshotError(label + '.required는 중복 없는 문자열 배열이어야 해.');
  }
  function parseSnapshot(text, label = '입력') {
    if (typeof text !== 'string' || !text.trim()) throw new SnapshotError(label + ': 도구 목록을 먼저 넣어줘.');
    if (new TextEncoder().encode(text).length > LIMITS.bytes) throw new SnapshotError(label + ': 최대 2 MiB까지 읽을 수 있어.');
    let doc;
    try { doc = JSON.parse(text); } catch (_) { throw new SnapshotError(label + ': JSON 형식이 올바르지 않아.'); }
    bounded(doc);
    if (record(doc) && own(doc, 'error')) throw new SnapshotError(label + ': 성공한 tools/list 응답이 아니라 오류 응답이야.');
    if (record(doc) && own(doc, 'result')) doc = doc.result;
    if (record(doc) && own(doc, 'resultType') && doc.resultType !== 'complete') throw new SnapshotError(label + ': 완료되지 않은 응답은 비교할 수 없어.');
    const groups = Array.isArray(doc) ? [{ name: 'default', tools: doc }] : record(doc) && own(doc, 'servers') ? doc.servers : record(doc) && Array.isArray(doc.tools) ? [{ ...doc, name: 'default' }] : null;
    if (!Array.isArray(groups)) throw new SnapshotError(label + ': tools 배열, tools/list 응답 또는 {servers:[{name,tools}]} 형식이 필요해. 연결 설정(mcpServers)은 도구 목록이 아니야.');
    if (record(doc) && own(doc, 'nextCursor')) throw new SnapshotError(label + ': 다음 페이지가 남은 응답이야. 모든 페이지를 합친 도구 목록이 필요해.');
    const servers = new Set(); const tools = []; const keys = new Set();
    for (const group of groups) {
      if (!record(group) || !Array.isArray(group.tools)) throw new SnapshotError(label + ': 서버마다 name과 tools 배열이 필요해.');
      if (own(group, 'nextCursor')) throw new SnapshotError(label + ': 다음 페이지가 남은 서버가 있어. 모든 페이지를 합쳐줘.');
      validateName(group.name, '서버', 160);
      if (servers.has(group.name)) throw new SnapshotError(label + ': 같은 서버 이름이 중복돼.');
      servers.add(group.name);
      for (const raw of group.tools) {
        if (!record(raw)) throw new SnapshotError(label + ': 도구 항목은 객체여야 해.');
        validateName(raw.name, '도구', 128);
        validateSchema(raw.inputSchema, 'inputSchema');
        if (own(raw, 'outputSchema')) validateSchema(raw.outputSchema, 'outputSchema');
        for (const field of ['title', 'description']) if (own(raw, field) && typeof raw[field] !== 'string') throw new SnapshotError(label + ': ' + field + '는 문자열이어야 해.');
        if (own(raw, 'annotations') && !record(raw.annotations)) throw new SnapshotError(label + ': annotations는 객체여야 해.');
        const annotations = raw.annotations || {};
        for (const hint of Object.keys(HINTS)) if (own(annotations, hint) && typeof annotations[hint] !== 'boolean') throw new SnapshotError(label + ': ' + hint + '는 true 또는 false여야 해.');
        const key = JSON.stringify([group.name, raw.name]);
        if (keys.has(key)) throw new SnapshotError(label + ': 같은 서버 안에 같은 도구 이름이 중복돼.');
        keys.add(key);
        const hints = Object.fromEntries(Object.entries(HINTS).map(([k, v]) => [k, own(annotations, k) ? annotations[k] : v]));
        tools.push({ key, server: group.name, name: raw.name, raw, hints, missing: Object.keys(HINTS).filter(k => !own(annotations, k)) });
        if (tools.length > LIMITS.tools) throw new SnapshotError(label + ': 한 번에 최대 500개 도구를 비교할 수 있어.');
      }
    }
    return { tools, servers: [...servers].sort() };
  }
  function changes(oldTool, newTool) {
    const notes = [];
    const add = (code, level, text) => notes.push({ code, level, text });
    if (!oldTool) { add('TOOL_ADDED', 'review', '새 도구가 추가됐어. 사용 전에 설명과 입력 항목을 확인해.'); return notes; }
    if (!newTool) { add('TOOL_REMOVED', 'contract', '도구가 목록에서 사라졌어. 기존 호출이 실패할 수 있어.'); return notes; }
    const a = oldTool.hints, b = newTool.hints;
    if (a.readOnlyHint && !b.readOnlyHint) add('WRITE_DECLARATION', 'review', '읽기 전용 선언이 없어졌거나 false로 바뀌었어. 수정 가능성에 대한 재검토가 필요해.');
    if (!b.readOnlyHint && !a.destructiveHint && b.destructiveHint) add('DESTRUCTIVE_DECLARATION', 'review', '파괴적 변경이 없다는 선언이 없어졌거나 true로 바뀌었어.');
    if (!a.openWorldHint && b.openWorldHint) add('OPEN_WORLD_DECLARATION', 'review', '닫힌 범위라는 선언이 없어졌거나 외부 상호작용 가능으로 바뀌었어.');
    if (!b.readOnlyHint && !a.readOnlyHint && a.idempotentHint && !b.idempotentHint) add('RETRY_DECLARATION', 'review', '같은 요청을 반복해도 추가 효과가 없다는 선언이 없어졌어. 자동 재시도 설정을 확인해.');
    const oldRequired = new Set(oldTool.raw.inputSchema.required || []);
    const requiredAdded = (newTool.raw.inputSchema.required || []).filter(k => !oldRequired.has(k));
    if (requiredAdded.length) add('REQUIRED_ADDED', 'contract', '새 필수 입력: ' + requiredAdded.join(', ') + '. 기존 호출에 값이 없으면 실패할 수 있어.');
    const oldProps = oldTool.raw.inputSchema.properties || {}, newProps = newTool.raw.inputSchema.properties || {};
    const removed = Object.keys(oldProps).filter(k => !own(newProps, k));
    if (removed.length) add('PROPERTY_REMOVED', 'contract', '입력 정의에서 빠진 항목: ' + removed.join(', ') + '. 실제 허용 여부는 전체 스키마를 확인해.');
    for (const name of Object.keys(newProps)) {
      if (!own(oldProps, name) || !record(oldProps[name]) || !record(newProps[name])) continue;
      if (canonical(oldProps[name].type) !== canonical(newProps[name].type)) add('PROPERTY_TYPE', 'contract', '입력 ' + name + '의 type 정의가 달라졌어.');
      const oldEnum = oldProps[name].enum, newEnum = newProps[name].enum;
      if (Array.isArray(newEnum) && (!Array.isArray(oldEnum) || oldEnum.some(v => !newEnum.some(n => canonical(n) === canonical(v))))) add('ENUM_NARROWED', 'contract', '입력 ' + name + '의 허용 값이 제한됐어.');
    }
    if (canonical(oldTool.raw.inputSchema) !== canonical(newTool.raw.inputSchema)) add('INPUT_SCHEMA', 'contract', '입력 스키마가 변경됐어. 중첩 조건·참조까지의 완전한 호환성 판정은 제공하지 않아.');
    if (canonical(oldTool.raw.outputSchema) !== canonical(newTool.raw.outputSchema)) add('OUTPUT_SCHEMA', 'contract', '출력 스키마가 변경됐어. 결과를 읽는 코드도 확인해.');
    if (oldTool.raw.description !== newTool.raw.description) add('DESCRIPTION', 'info', '모델에 전달되는 도구 설명이 달라졌어. 원문을 비교해.');
    if (canonical(oldTool.raw.annotations) !== canonical(newTool.raw.annotations)) add('ANNOTATIONS', 'info', '힌트 선언값이 달라졌어. 미선언과 명시적 기본값도 구분해서 표시해.');
    if (!notes.length && canonical(oldTool.raw) !== canonical(newTool.raw)) add('METADATA', 'info', '제목·아이콘·실행 옵션 등 도구 정의의 다른 항목이 바뀌었어.');
    return notes;
  }
  function compare(before, after) {
    const a = new Map(before.tools.map(t => [t.key, t]));
    const b = new Map(after.tools.map(t => [t.key, t]));
    const counts = { added: 0, removed: 0, changed: 0, unchanged: 0, review: 0 };
    const entries = [...new Set([...a.keys(), ...b.keys()])].map(key => {
      const oldTool = a.get(key), newTool = b.get(key), tool = newTool || oldTool;
      const status = !oldTool ? 'added' : !newTool ? 'removed' : canonical(oldTool.raw) === canonical(newTool.raw) ? 'unchanged' : 'changed';
      const notes = status === 'unchanged' ? [] : changes(oldTool, newTool);
      const review = notes.some(n => n.level !== 'info');
      counts[status]++; if (review) counts.review++;
      return { key, server: tool.server, name: tool.name, status, review, notes, before: oldTool || null, after: newTool || null };
    });
    const priority = { changed: 0, added: 1, removed: 2, unchanged: 3 };
    entries.sort((x, y) => Number(y.review) - Number(x.review) || priority[x.status] - priority[y.status] || x.server.localeCompare(y.server) || x.name.localeCompare(y.name));
    return { counts, entries, beforeCount: before.tools.length, afterCount: after.tools.length };
  }
  function exportReport(result) {
    return { format: 'scopediff-report-v1', disclaimer: 'Declared metadata comparison only. Not a security audit, permission check, runtime guarantee or complete schema compatibility proof.', counts: result.counts, beforeCount: result.beforeCount, afterCount: result.afterCount, changes: result.entries.filter(e => e.status !== 'unchanged').map(e => ({ server: e.server, tool: e.name, status: e.status, notes: e.notes, before: e.before ? e.before.raw : null, after: e.after ? e.after.raw : null })) };
  }
  function markdownReport(result) {
    const safe = s => String(s).replace(/[\\`*_{}\[\]<>#|!]/g, '\\$&').replace(/[\r\n]/g, ' ');
    const lines = ['# ScopeDiff 변경 검토', '', '> 선언된 메타데이터 비교 결과야. 실제 권한·동작·보안 또는 완전한 스키마 호환성을 보장하지 않아.', '', '추가 ' + result.counts.added + ' · 변경 ' + result.counts.changed + ' · 삭제 ' + result.counts.removed + ' · 동일 ' + result.counts.unchanged, ''];
    for (const e of result.entries.filter(e => e.status !== 'unchanged')) {
      lines.push('## ' + safe(e.server) + ' / ' + safe(e.name) + ' (' + e.status + ')', ...e.notes.map(n => '- ' + safe(n.text)), '');
    }
    return lines.join('\n');
  }
  const api = Object.freeze({ LIMITS, HINTS, SnapshotError, parseSnapshot, compare, canonical, exportReport, markdownReport });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ScopeDiff = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
