#!/usr/bin/env python3
"""Execute the six offline CLI demos and make honest, readable output replays.

Run from any directory with Python 3.11+ and Pillow installed:
    python3 automation/capture_cli_demos.py
    python3 automation/capture_cli_demos.py --project agenttracelite
    python3 automation/capture_cli_demos.py --verify-only

These are paced visualizations of captured stdout/stderr, not a screen recording
or a simulation of application UI. No application output is supplied by this
script. Every displayed result comes from a newly executed subprocess; commands,
full output, return codes, source/input hashes, and image hashes are saved beside
the GIF. Only checked-in, explicitly illustrative fixtures are used.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import shlex
import subprocess
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[1]
WIDTH, MAX_HEIGHT = 1120, 900
FONT_SIZE, LINE_HEIGHT = 20, 26
PALETTE_COLORS = 96

# The return-code assertions distinguish intentional findings from demo failure.
DEMOS = {
    "agentscope": {
        "title": "AgentScope",
        "fixture": "Bundled example_repo / illustrative instruction files",
        "inputs": ["example_repo"],
        "commands": [
            (["python3", "agentscope.py", "src/api/service.py", "--root", "example_repo"], 0),
            (["python3", "agentscope.py", "AGENTS.md", "--root", "example_repo"], 0),
        ],
    },
    "agenttracelite": {
        "title": "AgentTraceLite",
        "fixture": "Bundled examples/agent-trace.jsonl / synthetic telemetry",
        "inputs": ["examples/agent-trace.jsonl"],
        "commands": [
            (["python3", "agenttracelite.py", "examples/agent-trace.jsonl"], 0),
            (["python3", "agenttracelite.py", "examples/agent-trace.jsonl", "--category", "tool"], 0),
            (["python3", "agenttracelite.py", "examples/agent-trace.jsonl", "--slow-ms", "1000"], 0),
        ],
    },
    "harlens": {
        "title": "HARLens",
        "fixture": "Bundled sample.har / illustrative HTTP requests",
        "inputs": ["sample.har"],
        "commands": [
            (["python3", "harlens.py", "sample.har"], 0),
            (["python3", "harlens.py", "sample.har", "--slow-ms", "200"], 0),
        ],
    },
    "installlens": {
        "title": "InstallLens",
        "fixture": "Bundled examples/*.json / illustrative packages; never installed",
        "inputs": ["examples/package-lock.json", "examples/package.json"],
        "commands": [
            (["python3", "installlens.py", "examples/package-lock.json"], 0),
            (["python3", "installlens.py", "examples/package-lock.json", "--package-json", "examples/package.json", "--strict"], 2),
        ],
    },
    "pylockpeek": {
        "title": "PyLockPeek",
        "fixture": "Bundled examples/pylock.toml / illustrative package metadata",
        "inputs": ["examples/pylock.toml"],
        "commands": [
            (["python3", "pylockpeek.py", "examples/pylock.toml"], 0),
            (["python3", "pylockpeek.py", "examples/pylock.toml", "--source-only"], 0),
        ],
    },
    "transition-guard": {
        "title": "TransitionGuard",
        "fixture": "Bundled examples/ / illustrative React and CSS source",
        "inputs": ["examples"],
        "commands": [
            (["python3", "transition_guard.py", "examples"], 0),
            (["python3", "transition_guard.py", "examples", "--fail-on-duplicate"], 1),
        ],
    },
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def input_hashes(project: Path, spec: dict) -> dict[str, str]:
    manifest = json.loads((project / "project.json").read_text())
    candidates = [project / p for p in manifest["source_files"] + spec["inputs"]]
    files = []
    for path in candidates:
        if path.is_dir():
            files.extend(p for p in path.rglob("*") if p.is_file() and "__pycache__" not in p.parts)
        else:
            files.append(path)
    return {p.relative_to(ROOT).as_posix(): digest(p) for p in sorted(set(files))}


def execute(project: Path, args: list[str], expected: int) -> dict:
    # No shell, network client, user files, or package installs in this workflow.
    run = subprocess.run(args, cwd=project, text=True, encoding="utf-8",
                         capture_output=True, timeout=30, stdin=subprocess.DEVNULL,
                         env={**os.environ, "LC_ALL": "C.UTF-8", "PYTHONIOENCODING": "utf-8"})
    if run.returncode != expected:
        raise RuntimeError(f"{project.name}: {shlex.join(args)} returned {run.returncode}, "
                           f"expected {expected}\n{run.stdout}\n{run.stderr}")
    return {"argv": args, "cwd": project.relative_to(ROOT).as_posix(),
            "exit_code": run.returncode, "expected_exit_code": expected,
            "stdout": run.stdout, "stderr": run.stderr}


def load_font(override: str | None):
    from PIL import ImageFont
    choices = [override] if override else [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/System/Library/Fonts/Menlo.ttc",
        "C:/Windows/Fonts/consola.ttf",
    ]
    for name in choices:
        if name and Path(name).is_file():
            return (ImageFont.truetype(name, FONT_SIZE), ImageFont.truetype(name, 26),
                    ImageFont.truetype(name, 16))
    raise RuntimeError("No monospace font found. Pass --font /path/to/monospace.ttf")


def wrap_lines(text: str, columns: int) -> list[str]:
    # Presentation-only wrapping; complete exact bytes remain in JSON/transcript.
    lines = []
    for line in text.splitlines():
        lines.extend(textwrap.wrap(line, columns, expand_tabs=True,
                                   replace_whitespace=False, drop_whitespace=False) or [""])
    return lines


def frame(spec: dict, command: dict, output_lines: list[str], step: int, total: int,
          fonts: tuple, completed: bool, output_total: int, height: int):
    from PIL import Image, ImageDraw
    mono, heading, caption = fonts
    image = Image.new("RGB", (WIDTH, height), "#0b1421")
    draw = ImageDraw.Draw(image)
    draw.text((30, 22), spec["title"] + " / CLI demo", font=heading, fill="#edf4ff")
    draw.text((30, 62), "EXAMPLE DATA - " + spec["fixture"], font=caption, fill="#e9c875")
    draw.line((30, 99, WIDTH - 30, 99), fill="#314258", width=1)
    columns = int((WIDTH - 60) / mono.getlength("M"))
    prompt = wrap_lines("$ " + shlex.join(command["argv"]), columns)
    y = 122
    for line in prompt:
        draw.text((30, y), line, font=mono, fill="#85ddb0")
        y += LINE_HEIGHT
    y += 14
    max_rows = (height - 75 - y) // LINE_HEIGHT
    lines = output_lines[-max_rows:]
    for line in lines:
        color = "#dde6f3"
        if "DUPLICATE" in line or " ERROR " in line:
            color = "#ffc78c"
        draw.text((30, y), line, font=mono, fill=color)
        y += LINE_HEIGHT
    draw.line((30, height - 68, WIDTH - 30, height - 68), fill="#314258", width=1)
    status = (f"Exit {command['exit_code']}" + (" (expected finding)" if command['exit_code'] else "")) if completed else "Output replay"
    if len(output_lines) > max_rows:
        status += f" | showing final {max_rows}/{output_total} lines"
    draw.text((30, height - 56), f"Command {step}/{total} | {status}", font=caption, fill="#a9bfd9")
    draw.text((30, height - 30), "Captured subprocess output | playback paced for readability, not execution time", font=caption, fill="#849bb8")
    return image


def capture(slug: str, fonts: tuple) -> dict:
    from PIL import Image
    spec = DEMOS[slug]
    project = ROOT / "projects" / slug
    captured = [execute(project, args, expected) for args, expected in spec["commands"]]
    frames, durations = [], []
    preview = None
    columns = int((WIDTH - 60) / fonts[0].getlength("M"))
    max_lines = max(len(wrap_lines("$ " + shlex.join(c["argv"]), columns)) +
                    len(wrap_lines(c["stdout"] + c["stderr"], columns)) for c in captured)
    height = min(MAX_HEIGHT, max(430, 122 + 14 + max_lines * LINE_HEIGHT + 100))
    for i, result in enumerate(captured, 1):
        visible = result["stdout"]
        # Separate output streams are retained verbatim in metadata/transcript.
        if result["stderr"]:
            visible += ("\n" if visible and not visible.endswith("\n") else "") + result["stderr"]
        lines = wrap_lines(visible, columns)
        frames.append(frame(spec, result, [], i, len(spec["commands"]), fonts, False, len(lines), height))
        durations.append(900)
        for stop in range(3, len(lines), 3):
            frames.append(frame(spec, result, lines[:stop], i, len(spec["commands"]), fonts, False, len(lines), height))
            durations.append(360)
        full = frame(spec, result, lines, i, len(spec["commands"]), fonts, True, len(lines), height)
        frames.append(full)
        durations.append(3400)
        if preview is None:
            preview = full
    gif = project / "demo.gif"
    indexed = [f.quantize(colors=PALETTE_COLORS, method=Image.Quantize.MEDIANCUT) for f in frames]
    indexed[0].save(gif, save_all=True, append_images=indexed[1:], duration=durations,
                    loop=0, optimize=True, disposal=2)
    preview.save(project / "preview.png", optimize=True)
    transcript = [f"{spec['title']} - actual subprocess capture", f"EXAMPLE DATA: {spec['fixture']}",
                  "Playback is paced for readability; it does not measure execution time.", ""]
    for result in captured:
        transcript += [f"cwd: {result['cwd']}", "$ " + shlex.join(result["argv"]), "[stdout]", result["stdout"],
                       "[stderr]", result["stderr"], f"[exit {result['exit_code']}]", ""]
    (project / "demo-transcript.txt").write_text("\n".join(transcript), encoding="utf-8")
    with Image.open(gif) as check:
        assert check.size == (WIDTH, height)
        hashes, total_ms = set(), 0
        for i in range(check.n_frames):
            check.seek(i)
            hashes.add(hashlib.sha256(check.convert("RGB").tobytes()).hexdigest())
            total_ms += check.info.get("duration", 0)
        if len(hashes) < 2:
            raise RuntimeError(f"{slug}: GIF is not meaningfully animated")
        output = {"width": WIDTH, "height": height, "frames": check.n_frames,
                  "distinct_frames": len(hashes), "duration_ms": total_ms, "bytes": gif.stat().st_size}
    metadata = {
        "schema_version": 1, "project": slug,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "environment": {"os": platform.system(), "machine": platform.machine(), "python": platform.python_version()},
        "method": "Real subprocess stdout/stderr captured verbatim, then rendered as a paced text replay with Pillow. Not a desktop screen recording or application UI.",
        "data": spec["fixture"], "playback_timing": "Edited for readability; not a runtime benchmark.",
        "regenerate": f"python3 automation/capture_cli_demos.py --project {slug}",
        "source_and_input_sha256": input_hashes(project, spec),
        "commands": captured, "gif": output,
        "artifacts_sha256": {name: digest(project / name) for name in ("demo.gif", "preview.png", "demo-transcript.txt")},
    }
    (project / "demo-capture.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return output


def verify(slug: str) -> None:
    project = ROOT / "projects" / slug
    saved = json.loads((project / "demo-capture.json").read_text())
    if saved["source_and_input_sha256"] != input_hashes(project, DEMOS[slug]):
        raise RuntimeError(f"{slug}: source or input changed since capture")
    for name, expected in saved["artifacts_sha256"].items():
        if digest(project / name) != expected:
            raise RuntimeError(f"{slug}: captured artifact changed: {name}")
    for command in saved["commands"]:
        current = execute(project, command["argv"], command["expected_exit_code"])
        if current != command:
            raise RuntimeError(f"{slug}: live output differs from captured output")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", choices=sorted(DEMOS), help="capture one project (default: all six)")
    parser.add_argument("--verify-only", action="store_true", help="rerun commands and verify provenance/artifact hashes without rewriting files")
    parser.add_argument("--font", help="path to a monospace TrueType/OpenType font")
    args = parser.parse_args()
    selected = [args.project] if args.project else list(DEMOS)
    fonts = None if args.verify_only else load_font(args.font)
    for slug in selected:
        if args.verify_only:
            verify(slug)
            print(f"{slug}: source/input/artifact hashes and rerun output match")
        else:
            print(f"{slug}: {json.dumps(capture(slug, fonts))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
