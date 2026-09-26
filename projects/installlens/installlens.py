#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

REGISTRY_HOSTS = {"registry.npmjs.org"}

class InputError(ValueError):
    pass

def package_name_from_path(path):
    marker = "node_modules/"
    if marker not in path:
        return None
    tail = path.rsplit(marker, 1)[1]
    parts = tail.split("/")
    if tail.startswith("@") and len(parts) >= 2:
        return "/".join(parts[:2])
    return parts[0] if parts else None

def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise InputError(f"file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise InputError(f"invalid JSON in {path}: line {exc.lineno} column {exc.colno}") from exc

def _allowed(allow_scripts, name, version):
    exact = f"{name}@{version}" if version else name
    if exact in allow_scripts:
        return allow_scripts[exact] is True
    if name in allow_scripts:
        return allow_scripts[name] is True
    return False

def _source_kind(resolved):
    if not resolved:
        return "registry-or-local"
    low = resolved.lower()
    if low.startswith(("git+", "git://", "github:", "git@")):
        return "git"
    if low.startswith(("http://", "https://")):
        host = (urlparse(resolved).hostname or "").lower()
        return "registry" if host in REGISTRY_HOSTS else "remote-url"
    return "other"

def analyze(lock_data, package_data=None):
    packages = lock_data.get("packages")
    if not isinstance(packages, dict):
        raise InputError("package-lock.json must contain a packages object (lockfile v2/v3)")
    package_data = package_data or {}
    allow_scripts = package_data.get("allowScripts", {})
    if not isinstance(allow_scripts, dict):
        raise InputError("package.json allowScripts must be an object when present")
    root = packages.get("", {})
    direct_names = set()
    for key in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
        value = root.get(key, {})
        if isinstance(value, dict):
            direct_names.update(value)
    findings = []
    for path, meta in packages.items():
        if not path or not isinstance(meta, dict):
            continue
        name = package_name_from_path(path)
        if not name:
            continue
        version = str(meta.get("version", ""))
        has_script = bool(meta.get("hasInstallScript"))
        resolved = meta.get("resolved")
        source = _source_kind(resolved)
        integrity = meta.get("integrity")
        findings.append({
            "name": name,
            "version": version,
            "path": path,
            "direct": name in direct_names,
            "has_install_script": has_script,
            "script_approved": _allowed(allow_scripts, name, version) if has_script else None,
            "source": source,
            "resolved": resolved,
            "integrity_present": bool(integrity),
            "link": bool(meta.get("link")),
        })
    script_packages = [x for x in findings if x["has_install_script"]]
    unreviewed = [x for x in script_packages if not x["script_approved"]]
    git_deps = [x for x in findings if x["source"] == "git"]
    remote_deps = [x for x in findings if x["source"] == "remote-url"]
    missing_integrity = [x for x in findings if x["source"] == "registry" and not x["integrity_present"] and not x["link"]]
    return {
        "packages": len(findings),
        "direct_packages": sum(1 for x in findings if x["direct"]),
        "install_script_packages": script_packages,
        "unreviewed_install_scripts": unreviewed,
        "git_dependencies": git_deps,
        "remote_url_dependencies": remote_deps,
        "registry_missing_integrity": missing_integrity,
        "findings": findings,
    }

def render(result):
    lines = [
        "InstallLens",
        f"packages: {result['packages']} ({result['direct_packages']} direct)",
        f"install scripts: {len(result['install_script_packages'])} total / {len(result['unreviewed_install_scripts'])} unreviewed",
        f"git deps: {len(result['git_dependencies'])}",
        f"remote URL deps: {len(result['remote_url_dependencies'])}",
        f"registry entries missing integrity: {len(result['registry_missing_integrity'])}",
    ]
    groups = [
        ("Unreviewed install scripts", result["unreviewed_install_scripts"]),
        ("Git dependencies", result["git_dependencies"]),
        ("Remote URL dependencies", result["remote_url_dependencies"]),
        ("Registry entries missing integrity", result["registry_missing_integrity"]),
    ]
    for title, items in groups:
        lines.extend(["", title + ":"])
        if not items:
            lines.append("  (none)")
            continue
        for item in items:
            direct = "direct" if item["direct"] else "transitive"
            version = f"@{item['version']}" if item["version"] else ""
            lines.append(f"  - {item['name']}{version} [{direct}]")
    lines.extend(["", "Note: this is a lockfile policy preflight, not a malware verdict.", "Review package contents and provenance before approving scripts or unusual sources."])
    return "\n".join(lines)

def main(argv=None):
    parser = argparse.ArgumentParser(description="Offline npm lockfile install-policy preflight")
    parser.add_argument("lockfile", help="path to package-lock.json (lockfile v2/v3)")
    parser.add_argument("--package-json", help="optional package.json with allowScripts policy")
    parser.add_argument("--json", action="store_true", dest="as_json")
    parser.add_argument("--strict", action="store_true", help="exit 2 when review-worthy findings exist")
    args = parser.parse_args(argv)
    try:
        lock_data = load_json(args.lockfile)
        package_data = load_json(args.package_json) if args.package_json else None
        result = analyze(lock_data, package_data)
    except InputError as exc:
        print(f"InstallLens: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2) if args.as_json else render(result))
    if args.strict and any((result["unreviewed_install_scripts"], result["git_dependencies"], result["remote_url_dependencies"], result["registry_missing_integrity"])):
        return 2
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
