'use strict';
(() => {
  const S = globalThis.ScopeDiff;
  const $ = id => document.getElementById(id);
  const statusLabels = { added: '추가', changed: '변경', removed: '삭제', unchanged: '동일' };
  const hintLabels = { readOnlyHint: '읽기 전용', destructiveHint: '파괴적 변경 가능', idempotentHint: '반복 호출 시 추가 효과 없음', openWorldHint: '외부 상호작용 가능' };
  let result = null, selected = null, filter = 'all';
  const revisions = { before: 0, after: 0 };
  function node(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; }
  function showError(message) { $('error').textContent = message; $('error').hidden = false; }
  function clearError() { $('error').textContent = ''; $('error').hidden = true; }
  function setExports(enabled) { $('export-json').disabled = !enabled; $('export-md').disabled = !enabled; }
  function invalidate(message = '입력이 바뀌었어. 다시 비교하면 최신 결과를 볼 수 있어.') {
    result = null; selected = null; setExports(false); clearError();
    for (const k of ['added', 'changed', 'removed', 'unchanged']) $('count-' + k).textContent = '—';
    $('total-changes').textContent = '—'; $('data-state').textContent = message;
    $('tool-list').replaceChildren(node('div', '두 목록을 넣고 변경 사항 비교를 눌러줘.', 'empty'));
    $('detail').replaceChildren(node('div', '도구를 선택하면 변경 근거와 원문이 여기에 보여.', 'detail-empty'));
  }
  function runCompare() {
    clearError();
    try {
      const before = S.parseSnapshot($('before').value, '변경 전');
      const after = S.parseSnapshot($('after').value, '변경 후');
      result = S.compare(before, after); selected = result.entries[0]?.key || null;
      for (const k of ['added', 'changed', 'removed', 'unchanged']) $('count-' + k).textContent = result.counts[k];
      $('total-changes').textContent = result.counts.added + result.counts.changed + result.counts.removed;
      $('data-state').textContent = '변경 전 ' + result.beforeCount + '개 → 변경 후 ' + result.afterCount + '개 · 입력한 전체 목록 기준';
      setExports(true); renderList();
    } catch (e) { invalidate('입력 형식을 확인한 뒤 다시 비교해줘.'); showError(e instanceof S.SnapshotError ? e.message : '비교 중 문제가 생겼어. 입력을 줄여서 다시 시도해줘.'); }
  }
  function renderList() {
    if (!result) return;
    const q = $('search').value.toLocaleLowerCase().trim();
    const entries = result.entries.filter(e => (filter === 'all' || filter === 'review' && e.review || e.status === filter) && (e.server + ' ' + e.name).toLocaleLowerCase().includes(q));
    if (!entries.some(e => e.key === selected)) selected = entries[0]?.key || null;
    $('tool-list').replaceChildren();
    if (!entries.length) $('tool-list').append(node('div', result.entries.length ? '조건에 맞는 도구가 없어.' : '두 목록 모두 비어 있어. 비교할 도구가 없어.', 'empty'));
    for (const e of entries) {
      const button = node('button', undefined, 'tool-row'); button.type = 'button'; button.setAttribute('aria-pressed', String(e.key === selected));
      button.append(node('span', e.server, 'server-name'));
      const top = node('div', undefined, 'tool-row-top'); top.append(node('strong', e.name), node('span', statusLabels[e.status], 'badge ' + e.status)); button.append(top);
      button.append(node('span', e.notes[0]?.text || '선언된 도구 정의가 같아.', 'row-note'));
      button.addEventListener('click', () => { selected = e.key; renderList(); const active = [...$('tool-list').children].find(b => b.getAttribute('aria-pressed') === 'true'); active?.focus({ preventScroll: true }); });
      $('tool-list').append(button);
    }
    renderDetail(result.entries.find(e => e.key === selected));
  }
  function hintCell(tool, key) {
    if (!tool) return node('td', '—');
    const cell = node('td');
    if (tool.hints.readOnlyHint && ['destructiveHint', 'idempotentHint'].includes(key)) { cell.append(node('span', '적용하지 않음'), node('small', '읽기 전용 선언 기준')); }
    else { cell.append(node('span', tool.hints[key] ? 'true' : 'false'), node('small', tool.missing.includes(key) ? '미선언 · 규격 기본값' : '서버가 명시한 값')); }
    return cell;
  }
  function renderDetail(e) {
    const box = $('detail'); box.replaceChildren();
    if (!e) { box.append(node('div', '선택한 도구가 없어.', 'detail-empty')); return; }
    box.append(node('span', e.server, 'server-name'));
    const title = node('div', undefined, 'detail-title'); title.append(node('h3', e.name), node('span', statusLabels[e.status], 'badge ' + e.status)); box.append(title);
    const notes = node('div', undefined, 'notes');
    for (const n of e.notes) notes.append(node('div', n.text, 'note ' + n.level));
    if (!e.notes.length) notes.append(node('div', '도구 정의가 같아. 서버 코드나 실제 권한이 같다는 뜻은 아니야.', 'note'));
    box.append(notes, node('h4', '선언된 기능 범위'));
    const table = node('table', undefined, 'hint-table'), head = node('thead'), tr = node('tr');
    for (const label of ['힌트', '변경 전', '변경 후']) { const th = node('th', label); th.scope = 'col'; tr.append(th); }
    head.append(tr); table.append(head); const body = node('tbody');
    for (const [key, label] of Object.entries(hintLabels)) {
      const row = node('tr'); row.append(node('td', label), hintCell(e.before, key), hintCell(e.after, key));
      if (e.before && e.after && (e.before.hints[key] !== e.after.hints[key] || e.before.missing.includes(key) !== e.after.missing.includes(key))) row.className = 'hint-change';
      body.append(row);
    }
    table.append(body); box.append(table);
    const raw = node('details', undefined, 'raw-details'); raw.append(node('summary', '도구 정의 원문 비교'));
    const columns = node('div', undefined, 'raw-columns');
    for (const [label, tool] of [['변경 전', e.before], ['변경 후', e.after]]) {
      const col = node('div'); const text = tool ? JSON.stringify(tool.raw, null, 2) : '이 목록에는 없는 도구야.';
      col.append(node('strong', label), node('pre', text.length > 25000 ? text.slice(0, 25000) + '\n… 화면 표시를 줄였어. JSON 결과에는 전체 원문이 들어 있어.' : text)); columns.append(col);
    }
    raw.append(columns); box.append(raw, node('p', '서버가 값을 누락하면 보수적인 규격 기본값을 표시해. 실제 동작 확인이나 안전 판정은 아니야.', 'disclaimer'));
  }
  async function loadFile(side, file) {
    if (!file) return;
    const revision = ++revisions[side]; invalidate('파일을 읽고 있어.');
    if (file.size > S.LIMITS.bytes) { showError('최대 2 MiB까지 읽을 수 있어.'); return; }
    try {
      const text = await file.text(); if (revisions[side] !== revision) return;
      $(side).value = text; invalidate('파일을 읽었어. 변경 사항 비교를 눌러줘.');
    } catch (_) { if (revisions[side] === revision) showError('파일을 읽지 못했어. 접근 가능한 JSON 파일을 골라줘.'); }
  }
  function download(extension, text) {
    const blob = new Blob([text], { type: extension === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = node('a'); link.href = url; link.download = 'scopediff-review.' + extension; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const tool = (name, description, hints, properties = {}, required = []) => ({ name, description, inputSchema: { type: 'object', properties, required }, annotations: hints });
  const read = { readOnlyHint: true, openWorldHint: false };
  const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  function demo() {
    const baseline = { servers: [{ name: 'workspace', tools: [tool('read_note', '노트 본문 읽기', read, { id: { type: 'string' } }, ['id']), tool('save_note', '노트 저장', write), tool('archive_note', '노트 보관', write), tool('read_profile', '프로필 읽기', read)] }, { name: 'catalog', tools: [tool('search_catalog', '로컬 카탈로그 검색', read)] }] };
    const candidate = JSON.parse(JSON.stringify(baseline));
    const notes = candidate.servers[0].tools;
    notes[0].annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
    notes[0].description = '노트를 읽고 마지막 열람 시각 기록';
    notes[0].inputSchema.properties.format = { type: 'string', enum: ['text', 'markdown'] }; notes[0].inputSchema.required.push('format');
    notes.splice(2, 1);
    notes.push(tool('delete_note', '노트 영구 삭제', { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }));
    notes.push(tool('publish_note', '외부 게시', { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }));
    candidate.servers[1].tools[0].annotations.openWorldHint = true;
    candidate.servers[1].tools[0].description = '로컬과 외부 카탈로그를 함께 검색';
    for (const side of ['before', 'after']) revisions[side]++;
    $('before').value = JSON.stringify(baseline, null, 2); $('after').value = JSON.stringify(candidate, null, 2);
    $('notice').textContent = '가상 예제 데이터 · 읽기 전용 변경, 필수 입력 추가, 외부 상호작용 변경, 도구 추가·삭제를 담았어.';
    filter = 'all'; $('search').value = ''; updateFilters(); runCompare();
  }
  function updateFilters() { document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter))); }
  for (const side of ['before', 'after']) {
    $(side).addEventListener('input', () => { revisions[side]++; $('notice').textContent = '사용자 입력 · 도구를 실행하지 않고 선언된 메타데이터만 비교해.'; invalidate(); });
    $('load-' + side).addEventListener('click', () => $('file-' + side).click());
    $('file-' + side).addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; loadFile(side, file); });
    const card = document.querySelector('[data-side="' + side + '"]');
    card.addEventListener('dragover', event => { event.preventDefault(); card.classList.add('dragover'); });
    card.addEventListener('dragleave', () => card.classList.remove('dragover'));
    card.addEventListener('drop', event => { event.preventDefault(); card.classList.remove('dragover'); loadFile(side, event.dataTransfer.files[0]); });
  }
  document.addEventListener('dragover', event => event.preventDefault()); document.addEventListener('drop', event => event.preventDefault());
  $('compare').addEventListener('click', runCompare); $('demo').addEventListener('click', demo);
  $('reset').addEventListener('click', () => { for (const side of ['before', 'after']) { revisions[side]++; $(side).value = ''; } $('search').value = ''; filter = 'all'; updateFilters(); $('notice').textContent = '입력과 분석 결과를 지웠어. 브라우저 저장소에는 기록하지 않아.'; invalidate('새 도구 목록을 넣어줘.'); $('before').focus(); });
  $('search').addEventListener('input', renderList);
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; updateFilters(); renderList(); }));
  $('export-json').addEventListener('click', () => { if (result) download('json', JSON.stringify(S.exportReport(result), null, 2)); });
  $('export-md').addEventListener('click', () => { if (result) download('md', S.markdownReport(result)); });
})();
