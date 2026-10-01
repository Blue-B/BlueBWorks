"""Real Chromium UI checks and optional demo capture, using only synthetic audio.

Requires Python Playwright, Pillow, and an installed Chromium. Nothing is uploaded.
Run: python3 browser_test.py --capture
Set SILENCESKETCH_CHROMIUM to select an installed browser executable.
"""
from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from threading import Thread
import hashlib
import json
import math
import os
import struct
import wave

from PIL import Image
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / 'artifacts'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def synthetic_wav():
    """Four seconds of generated tones separated by a one-second pause."""
    out = BytesIO()
    with wave.open(out, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(24000)
        wav.writeframes(b''.join(struct.pack('<h', int(11000 * math.sin(2 * math.pi * 220 * i / 24000))
                                if i < 24000 or i >= 48000 else 0) for i in range(96000)))
    return out.getvalue()


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--capture', action='store_true', help='Write actual browser screenshots to demo.gif and preview.png')
    args = parser.parse_args()
    ARTIFACTS.mkdir(exist_ok=True)
    checks, frames, durations, scenes = [], [], [], []
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=os.environ.get('SILENCESKETCH_CHROMIUM', '/usr/bin/chromium'),
                                                 headless=True, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 1280, 'height': 1500}, accept_downloads=True)
            page = context.new_page()
            errors, remote_requests, dialogs = [], [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('request', lambda request: remote_requests.append(request.url)
                    if not request.url.startswith((origin + '/', 'blob:', 'data:')) else None)
            page.on('dialog', lambda dialog: (dialogs.append(dialog.message), dialog.dismiss()))
            page.goto(origin + '/', wait_until='networkidle')
            expect(page.locator('#workspace')).to_be_hidden()
            checks.append('Initial state hides the unloaded editor')
            page.locator('#demo-button').click()
            expect(page.locator('#count')).to_have_text('3')
            expect(page.locator('#duration')).to_have_text('0:09.5')
            expect(page.locator('#file-name')).to_contain_text('가상 음성 데모')
            checks.append('Built-in synthetic 9.5-second demo proposes three cuts')
            default_result = page.locator('#result').inner_text()
            bounds = page.locator('.shell').bounding_box()
            top = page.locator('.drop').bounding_box()['y']
            bottom = page.locator('footer').bounding_box()
            clip = {'x': math.floor(bounds['x']), 'y': math.floor(top), 'width': math.ceil(bounds['width']),
                    'height': math.ceil(bottom['y'] + bottom['height'] - top)}

            def capture(label, duration=1900):
                if not args.capture:
                    return
                # Capture the actual rendered app. No DOM/CSS replacement, text overlays or synthetic UI.
                page.mouse.move(12, 12)
                frames.append(Image.open(BytesIO(page.screenshot(clip=clip))).convert('RGB'))
                durations.append(duration)
                scenes.append(label)

            def slider(selector, value):
                element = page.locator(selector)
                minimum = float(element.get_attribute('min'))
                step = float(element.get_attribute('step'))
                element.press('Home')
                for _ in range(round((value - minimum) / step)):
                    element.press('ArrowRight')

            capture('Synthetic example: three proposed silence cuts', 2400)
            page.screenshot(path=str(ARTIFACTS / 'desktop.png'), full_page=True)
            page.locator('#cut-list input').nth(1).uncheck()
            expect(page.locator('#count')).to_have_text('2')
            assert page.locator('#result').inner_text() != default_result
            capture('Keep the middle pause by unchecking it')
            page.locator('#cut-list input').nth(1).check()
            expect(page.locator('#result')).to_have_text(default_result)
            checks.append('Cut veto updates duration and can be restored')
            slider('#min-silence', 1.25)
            expect(page.locator('#count')).to_have_text('1')
            capture('Increase minimum silence to keep shorter pauses')
            slider('#min-silence', 1.8)
            expect(page.locator('#count')).to_have_text('0')
            expect(page.locator('.empty')).to_be_visible()
            expect(page.locator('#result')).to_have_text('0:09.5')
            capture('No qualifying cuts: original duration is preserved')
            checks.append('Minimum-silence slider handles filtered and zero-cut states')
            slider('#min-silence', .55)
            slider('#threshold', -36)
            slider('#padding', .25)
            expect(page.locator('#threshold-value')).to_have_text('-36 dB')
            expect(page.locator('#padding-value')).to_have_text('0.25s')
            expect(page.locator('#count')).to_have_text('3')
            capture('Adjust threshold and end padding')
            checks.append('Threshold and padding update the rendered editor')
            slider('#threshold', -42)
            slider('#padding', .12)
            page.locator('#cut-list input').nth(1).uncheck()
            capture('Keep one intentional pause before exporting', 2300)
            expected_seconds = page.locator('#result').inner_text()
            with page.expect_download() as event:
                page.locator('#download-button').click()
            target = ARTIFACTS / 'synthetic-cleaned.wav'
            event.value.save_as(str(target))
            assert event.value.suggested_filename == 'silencesketch-demo.silencesketch.wav'
            with wave.open(str(target)) as wav:
                assert wav.getnchannels() == 1 and wav.getsampwidth() == 2 and wav.getframerate() == 24000
                duration = wav.getnframes() / wav.getframerate()
                minute, second = expected_seconds.split(':')
                displayed = 60 * int(minute) + float(second)
                assert displayed <= duration < displayed + .11, (displayed, duration)
            checks.append('Download is a real 16-bit mono WAV with the selected cut duration')
            page.locator('#demo-button').click()
            expect(page.locator('#count')).to_have_text('3')
            capture('Reload the demo to reset all cut selections')
            checks.append('Repeated demo load restores selections without duplicating cuts')
            page.locator('#file-input').set_input_files({'name': 'synthetic-tone-example.wav', 'mimeType': 'audio/wav',
                                                       'buffer': synthetic_wav()})
            expect(page.locator('#file-name')).to_contain_text('synthetic-tone-example.wav')
            expect(page.locator('#duration')).to_have_text('0:04.0')
            expect(page.locator('#count')).to_have_text('1')
            checks.append('Local WAV file decodes and analyzes a known one-second pause')
            page.locator('#file-input').set_input_files({'name': 'invalid-example.wav', 'mimeType': 'audio/wav', 'buffer': b'not audio'})
            page.wait_for_function('document.querySelector("#file-input").files[0].name === "invalid-example.wav"')
            # Decode rejection is asynchronous. A later successful demo remains a valid recovery path.
            for _ in range(100):
                if dialogs:
                    break
                page.wait_for_timeout(50)
            assert len(dialogs) == 1 and '오디오를 열지 못했어' in dialogs[0], dialogs
            expect(page.locator('#file-name')).to_contain_text('synthetic-tone-example.wav')
            page.locator('#demo-button').click()
            expect(page.locator('#count')).to_have_text('3')
            checks.append('Malformed audio reports a decode error, preserves the prior file, and permits recovery')
            for width in [390, 320]:
                page.set_viewport_size({'width': width, 'height': 844})
                assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), width
                page.locator('#cut-list input').nth(0).uncheck()
                expect(page.locator('#count')).to_have_text('2')
                page.locator('#cut-list input').nth(0).check()
                if width == 390:
                    page.screenshot(path=str(ARTIFACTS / 'mobile.png'), full_page=True)
            checks.append('390px and 320px responsive widths work without horizontal overflow')
            assert not errors, errors
            assert not remote_requests, remote_requests
            checks.append('No page JavaScript errors or non-local requests')
            result = {'browser': browser.version, 'mode': 'actual loopback HTTP navigation', 'passed': len(checks),
                      'checks': checks, 'page_errors': errors, 'non_local_requests': remote_requests,
                      'limits': ['Synthetic tones rather than recorded speech', 'No real mobile hardware, Safari or Firefox testing',
                                 'GIF has no audio and is a sequence of captured interaction states, not continuous video']}
            if args.capture:
                # A single shared palette avoids color flicker between actual screenshot frames.
                palette_source = Image.new('RGB', (frames[0].width, frames[0].height * len(frames)))
                for index, frame in enumerate(frames):
                    palette_source.paste(frame, (0, index * frame.height))
                palette = palette_source.quantize(colors=256)
                converted = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
                output = ROOT / 'demo.gif'
                converted[0].save(output, save_all=True, append_images=converted[1:], duration=durations, loop=0, optimize=True)
                frames[0].save(ROOT / 'preview.png')
                with Image.open(output) as gif:
                    result['gif'] = {'path': 'demo.gif', 'size': list(gif.size), 'frames': gif.n_frames,
                                     'bytes': output.stat().st_size, 'duration_ms': sum(durations), 'scenes': scenes}
                result['source_sha256'] = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                                           for name in ['index.html', 'app.js', 'audio-core.js', 'styles.css']}
                (ROOT / 'preview-checks.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
            (ARTIFACTS / 'browser-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
            print(json.dumps(result, ensure_ascii=False, indent=2))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
