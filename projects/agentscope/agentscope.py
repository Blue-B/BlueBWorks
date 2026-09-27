#!/usr/bin/env python3
import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

class AgentScopeError(ValueError):
    pass

@dataclass
class Match:
    path: str
    kind: str
    precedence: int
    reason: str
    patterns: list[str]

def _glob_to_regex(pattern):
    pattern = pattern.replace("\\", "/").lstrip("./")
    out = []
    i = 0
    while i < len(pattern):
        if pattern[i:i+3] == "**/":
            out.append("(?:.*/)?")
            i += 3
        elif pattern[i:i+2] == "**":
            out.append(".*")
            i += 2
        elif pattern[i] == "*":
            out.append("[^/]*")
            i += 1
        elif pattern[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(pattern[i]))
            i += 1
    return re.compile("^" + "".join(out) + "$")

def _matches(pattern, rel_target):
    try:
        return bool(_glob_to_regex(pattern).match(rel_target))
    except re.error:
        return False

def _parse_apply_to(path):
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        return []
    if not lines or lines[0].strip() != "---":
        return []
    front = []
    for line in lines[1:]:
        if line.strip() == "---":
            break
        front.append(line)
    for line in front:
        if line.strip().startswith("applyTo:"):
            value = line.split(":", 1)[1].strip()
            if not value:
                return []
            if value.startswith("[") and value.endswith("]"):
                try:
                    parsed = json.loads(value)
                    return [str(x).strip() for x in parsed if str(x).strip()]
                except json.JSONDecodeError:
                    pass
            value = value.strip("'\"")
            return [p.strip().strip("'\"") for p in value.split(",") if p.strip()]
    return []

def _relative_target(root, target):
    root = Path(root).resolve()
    target = Path(target)
    resolved = target.resolve() if target.is_absolute() else (root / target).resolve()
    if resolved != root and root not in resolved.parents:
        raise AgentScopeError("target must stay inside repository root")
    return root, resolved, resolved.relative_to(root).as_posix()

def scan(repo_root, target):
    root, target_path, rel_target = _relative_target(repo_root, target)
    matches = []
    skipped = []

    instructions_dir = root / ".github" / "instructions"
    if instructions_dir.exists():
        for path in sorted(instructions_dir.rglob("*.instructions.md")):
            patterns = _parse_apply_to(path)
            rel = path.relative_to(root).as_posix()
            if not patterns:
                skipped.append({"path": rel, "reason": "missing applyTo frontmatter"})
            elif any(_matches(p, rel_target) for p in patterns):
                matches.append(Match(rel, "github-path-specific", 10, "applyTo matches target", patterns))

    repo_wide = root / ".github" / "copilot-instructions.md"
    if repo_wide.is_file():
        matches.append(Match(repo_wide.relative_to(root).as_posix(), "github-repository", 20, "repository-wide instructions", []))

    ancestor_dirs = []
    cursor = target_path if target_path.is_dir() else target_path.parent
    while True:
        ancestor_dirs.append(cursor)
        if cursor == root:
            break
        if root not in cursor.parents:
            break
        cursor = cursor.parent

    for directory in ancestor_dirs:
        candidate = directory / "AGENTS.md"
        if candidate.is_file():
            depth = len(candidate.relative_to(root).parts) - 1
            matches.append(Match(candidate.relative_to(root).as_posix(), "agent-instructions", 30 - min(depth, 9), "nearest AGENTS.md wins within agent instructions", []))

    for name in ("CLAUDE.md", "GEMINI.md"):
        path = root / name
        if path.is_file():
            matches.append(Match(name, "agent-instructions", 39, "root agent instruction file", []))

    matches.sort(key=lambda x: (x.precedence, x.path))
    return {
        "target": rel_target,
        "applicable": [asdict(x) for x in matches],
        "skipped": skipped,
    }

def render(result):
    lines = [f"AgentScope: {result['target']}"]
    if not result["applicable"]:
        lines.append("  no supported instruction files apply")
    else:
        for idx, item in enumerate(result["applicable"], 1):
            suffix = f" [{', '.join(item['patterns'])}]" if item["patterns"] else ""
            lines.append(f"  {idx}. {item['path']} - {item['kind']}{suffix}")
    if result["skipped"]:
        lines.append(f"  skipped: {len(result['skipped'])} path-specific file(s) without usable applyTo")
    return "\n".join(lines)

def main(argv=None):
    parser = argparse.ArgumentParser(description="Map AI coding-agent instruction files that apply to a repository path")
    parser.add_argument("target", help="target file or directory, relative to repository root")
    parser.add_argument("--root", default=".", help="repository root (default: current directory)")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args(argv)
    try:
        result = scan(args.root, args.target)
    except (AgentScopeError, OSError) as exc:
        print(f"AgentScope: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2) if args.as_json else render(result))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
