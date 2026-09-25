"""Offline UI checks for the built HTML. Requires Playwright and Chromium.

The document is loaded with set_content, without modifying its CSP. This checks
actual Chromium rendering and interaction, not file:// navigation, which may be
blocked by the host's browser policy. No server or external network is needed.
Run: SCOPEDIFF_CHROMIUM=/usr/bin/chromium python3 browser_test.py
"""
from pathlib import Path
import json
import os
import re
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
checks = []


def ok(name):
    checks.append(name)


def fixture(name='custom_read', description='Read a record'):
    return {'tools': [{'name': name, 'description': description,
                      'inputSchema': {'type': 'object', 'properties': {}},
                      'annotations': {'readOnlyHint': True}}]}


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('SCOPEDIFF_CHROMIUM', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, accept_downloads=True)
    context.set_offline(True)
    page = context.new_page()
    errors, console_errors, requests = [], [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda e: console_errors.append(e.text) if e.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    page.set_content((ROOT / 'dist/ScopeDiff.html').read_text(), wait_until='load')
    expect(page.locator('#export-json')).to_be_disabled()
    ok('Initial empty state disables export')
    page.locator('#demo').click()
    for key, value in {'added': '2', 'changed': '2', 'removed': '1', 'unchanged': '2'}.items():
        expect(page.locator('#count-' + key)).to_have_text(value)
    ok('Offline demo produces expected 2/2/1/2 counts')
    for status, number in [('review', 5), ('added', 2), ('changed', 2), ('removed', 1), ('all', 7)]:
        page.locator('[data-filter="' + status + '"]').click()
        expect(page.locator('.tool-row')).to_have_count(number)
    ok('All five filters return expected tool sets')
    page.locator('.tool-row').filter(has=page.locator('strong', has_text='read_note')).click()
    expect(page.locator('#detail')).to_contain_text('새 필수 입력: format')
    expect(page.locator('#detail')).to_contain_text('읽기 전용 선언이 없어졌거나')
    page.locator('.raw-details summary').click()
    expect(page.locator('.raw-columns')).to_contain_text('마지막 열람 시각')
    ok('Selection exposes reasons, hint values and both raw definitions')
    page.locator('#search').fill('read_profile')
    expect(page.locator('.tool-row')).to_have_count(1)
    page.locator('#search').fill('no_such_tool')
    expect(page.locator('.tool-row')).to_have_count(0)
    page.locator('#search').fill('')
    ok('Search and no-result state work')
    for extension in ['json', 'md']:
        with page.expect_download(timeout=10000) as event:
            page.locator('#export-' + extension).click()
        download = event.value
        output = ARTIFACTS / ('demo-review.' + extension)
        download.save_as(str(output))
        assert output.stat().st_size > 100
        if extension == 'json':
            assert json.loads(output.read_text())['counts']['added'] == 2
    ok('JSON and Markdown reports actually download')
    page.locator('#before').fill('{')
    expect(page.locator('#export-json')).to_be_disabled()
    page.locator('#compare').click()
    expect(page.locator('#error')).to_be_visible()
    ok('Editing invalidates stale results; malformed JSON shows an error')
    page.locator('#reset').click()
    expect(page.locator('#before')).to_have_value('')
    page.locator('#compare').click()
    expect(page.locator('#error')).to_contain_text('먼저 넣어줘')
    ok('Reset clears both inputs; empty input is rejected')
    page.locator('#before').fill('{"tools":[]}')
    page.locator('#file-after').set_input_files({'name': 'inventory.json', 'mimeType': 'application/json',
                                              'buffer': json.dumps(fixture()).encode()})
    expect(page.locator('#after')).to_have_value(re.compile('custom_read'))
    expect(page.locator('#notice')).to_contain_text('사용자 파일 입력')
    page.locator('#compare').click()
    expect(page.locator('#count-added')).to_have_text('1')
    ok('User JSON file is read locally and compared, with correct source label')
    page.locator('#file-after').set_input_files({'name': 'large.json', 'mimeType': 'application/json',
                                              'buffer': b' ' * (2 * 1024 * 1024 + 1)})
    expect(page.locator('#error')).to_contain_text('2 MiB')
    expect(page.locator('#export-json')).to_be_disabled()
    ok('Oversized file is rejected without leaving stale export enabled')
    page.locator('#after').fill('{"tools":[],"nextCursor":"more"}')
    page.locator('#compare').click()
    expect(page.locator('#error')).to_contain_text('다음 페이지')
    ok('Incomplete paginated input is rejected')
    dropped = json.dumps(fixture('dragged_tool'))
    page.locator('[data-side="after"]').evaluate('''(element, text) => {
      const data = new DataTransfer(); data.items.add(new File([text], 'drop.json', {type:'application/json'}));
      element.dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:data}));
    }''', dropped)
    expect(page.locator('#after')).to_have_value(re.compile('dragged_tool'))
    page.locator('#compare').click()
    expect(page.locator('#detail')).to_contain_text('dragged_tool')
    ok('Drag-and-drop file intake works')
    hostile = fixture('untrusted_tool', '<img src="https://invalid.example/x" onerror="window.injected=1"><script>window.injected=2</script>')
    page.locator('#after').fill(json.dumps(hostile))
    page.locator('#compare').click()
    page.locator('.raw-details summary').click()
    expect(page.locator('.raw-columns')).to_contain_text('<img')
    assert page.locator('#detail img, #detail script').count() == 0
    assert page.evaluate('window.injected === undefined')
    ok('Untrusted HTML is displayed as text, not executed or fetched')
    page.locator('#demo').click()
    page.locator('.tool-row').filter(has=page.locator('strong', has_text='read_note')).click()
    page.screenshot(path=str(ARTIFACTS / 'desktop.png'), full_page=True)
    for width in [390, 320]:
        page.set_viewport_size({'width': width, 'height': 844})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), width
        page.locator('[data-filter="added"]').click()
        expect(page.locator('.tool-row')).to_have_count(2)
        page.locator('[data-filter="all"]').click()
        page.locator('.tool-row').filter(has=page.locator('strong', has_text='read_note')).click()
        if width == 390:
            page.screenshot(path=str(ARTIFACTS / 'mobile.png'), full_page=True)
    ok('390px and 320px responsive layouts work without horizontal overflow')
    assert not errors, errors
    assert not console_errors, console_errors
    assert not requests, requests
    ok('No JavaScript errors, CSP errors or network requests during all interactions')
    result = {'browser': browser.version, 'mode': 'set_content, unmodified CSP, offline context',
              'passed': len(checks), 'checks': checks, 'page_errors': errors, 'console_errors': console_errors,
              'network_requests': len(requests), 'limits': ['file:// navigation blocked by host policy', 'real mobile devices, Safari and Firefox not tested']}
    (ARTIFACTS / 'browser-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    browser.close()
