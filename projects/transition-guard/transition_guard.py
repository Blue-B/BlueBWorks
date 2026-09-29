#!/usr/bin/env python3
"""Inspect local CSS and React source for View Transition usage and static name collisions."""
from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import re
import sys

SUPPORTED_SUFFIXES = {".css", ".js", ".jsx", ".ts", ".tsx"}
IGNORED_NAMES = {"none", "match-element", "inherit", "initial", "revert", "revert-layer", "unset"}
NAME_RE = re.compile(r"\bview-transition-name\s*:\s*([A-Za-z_][\w-]*|[-][\w-]+)", re.IGNORECASE)
CLASS_RE = re.compile(r"\bview-transition-class\s*:\s*([A-Za-z_][\w-]*|[-][\w-]+)", re.IGNORECASE)
REACT_VIEW_RE = re.compile(r"<\s*ViewTransition\b")
TYPE_RE = re.compile(r"\baddTransitionType\s*\(\s*(['\"])(.*?)\1")
BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)

@dataclass(frozen=True)
class Location:
    path: str
    line: int

@dataclass
class ScanResult:
    files: int
    named_declarations: int
    duplicate_names: dict[str, list[Location]]
    view_transition_classes: dict[str, list[Location]]
    react_view_transitions: list[Location]
    transition_types: dict[str, list[Location]]

def _strip_block_comments(text: str) -> str:
    return BLOCK_COMMENT_RE.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), text)

def discover(inputs: list[str]) -> list[Path]:
    found: list[Path] = []
    for raw in inputs:
        path = Path(raw)
        if path.is_file():
            if path.suffix.lower() in SUPPORTED_SUFFIXES:
                found.append(path)
            continue
        if not path.is_dir():
            raise FileNotFoundError(raw)
        found.extend(p for p in path.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES)
    return sorted(dict.fromkeys(found))

def _display_path(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)

def scan(inputs: list[str], display_root: Path | None = None) -> ScanResult:
    files = discover(inputs)
    display_root = display_root or Path.cwd()
    names: dict[str, list[Location]] = defaultdict(list)
    classes: dict[str, list[Location]] = defaultdict(list)
    react_views: list[Location] = []
    types: dict[str, list[Location]] = defaultdict(list)
    for path in files:
        text = _strip_block_comments(path.read_text(encoding="utf-8"))
        display = _display_path(path, display_root)
        for line_no, line in enumerate(text.splitlines(), 1):
            for match in NAME_RE.finditer(line):
                name = match.group(1)
                if name.lower() not in IGNORED_NAMES:
                    names[name].append(Location(display, line_no))
            for match in CLASS_RE.finditer(line):
                classes[match.group(1)].append(Location(display, line_no))
            if path.suffix.lower() in {".js", ".jsx", ".ts", ".tsx"}:
                if REACT_VIEW_RE.search(line):
                    react_views.append(Location(display, line_no))
                for match in TYPE_RE.finditer(line):
                    types[match.group(2)].append(Location(display, line_no))
    duplicates = {name: locs for name, locs in names.items() if len(locs) > 1}
    return ScanResult(
        files=len(files),
        named_declarations=sum(len(v) for v in names.values()),
        duplicate_names=dict(sorted(duplicates.items())),
        view_transition_classes=dict(sorted(classes.items())),
        react_view_transitions=react_views,
        transition_types=dict(sorted(types.items())),
    )

def _location_dicts(mapping: dict[str, list[Location]]) -> dict[str, list[dict[str, object]]]:
    return {name: [asdict(loc) for loc in locs] for name, locs in mapping.items()}

def to_jsonable(result: ScanResult) -> dict[str, object]:
    return {
        "files": result.files,
        "named_declarations": result.named_declarations,
        "duplicate_names": _location_dicts(result.duplicate_names),
        "view_transition_classes": _location_dicts(result.view_transition_classes),
        "react_view_transitions": [asdict(loc) for loc in result.react_view_transitions],
        "transition_types": _location_dicts(result.transition_types),
    }

def print_text(result: ScanResult) -> None:
    print(f"TransitionGuard: {result.files} file(s), {result.named_declarations} named declaration(s), {len(result.duplicate_names)} duplicate name(s)")
    for name, locations in result.duplicate_names.items():
        print(f"DUPLICATE {name}")
        for loc in locations:
            print(f"  {loc.path}:{loc.line}")
    print(f"React <ViewTransition>: {len(result.react_view_transitions)}")
    print(f"addTransitionType(): {sum(len(items) for items in result.transition_types.values())}")

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", help="file or directory to scan")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    parser.add_argument("--fail-on-duplicate", action="store_true", help="exit 1 when a static view-transition-name appears more than once")
    args = parser.parse_args(argv)
    try:
        result = scan(args.paths)
    except (OSError, UnicodeError) as exc:
        print(f"TransitionGuard error: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(to_jsonable(result), ensure_ascii=False, indent=2))
    else:
        print_text(result)
    if args.fail_on_duplicate and result.duplicate_names:
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
