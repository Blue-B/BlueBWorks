#!/usr/bin/env python3
import argparse, json
from collections import Counter
from urllib.parse import urlparse

def analyze_har(data, slow_ms=1000):
    entries = data.get("log", {}).get("entries", [])
    domains = Counter()
    methods = Counter()
    status_groups = Counter()
    failed = []
    slow = []
    total_bytes = 0
    total_time = 0.0

    for entry in entries:
        req = entry.get("request", {})
        res = entry.get("response", {})
        url = req.get("url", "")
        method = req.get("method", "?")
        status = int(res.get("status", 0) or 0)
        elapsed = float(entry.get("time", 0) or 0)
        size = int(res.get("bodySize", 0) or 0)
        if size < 0:
            size = int(res.get("content", {}).get("size", 0) or 0)
        total_bytes += max(size, 0)
        total_time += max(elapsed, 0)
        host = urlparse(url).netloc or "(unknown)"
        domains[host] += 1
        methods[method] += 1
        group = f"{status//100}xx" if status else "none"
        status_groups[group] += 1
        item = {"method": method, "status": status, "time_ms": round(elapsed, 1), "url": url}
        if status >= 400 or status == 0:
            failed.append(item)
        if elapsed >= slow_ms:
            slow.append(item)

    slow.sort(key=lambda x: x["time_ms"], reverse=True)
    failed.sort(key=lambda x: (x["status"], -x["time_ms"]))
    return {
        "requests": len(entries),
        "domains": domains.most_common(),
        "methods": dict(methods),
        "status_groups": dict(status_groups),
        "failed": failed,
        "slow": slow,
        "total_bytes": total_bytes,
        "total_time_ms": round(total_time, 1),
    }

def human_bytes(n):
    units = ["B","KB","MB","GB"]
    x = float(n)
    for unit in units:
        if x < 1024 or unit == units[-1]:
            return f"{x:.1f} {unit}" if unit != "B" else f"{int(x)} B"
        x /= 1024

def render(result, limit=8):
    lines = [
        "HARLens summary",
        f"- Requests: {result['requests']}",
        f"- Transfer: {human_bytes(result['total_bytes'])}",
        f"- Aggregate request time: {result['total_time_ms']:.1f} ms",
        f"- Status groups: {', '.join(f'{k}={v}' for k,v in sorted(result['status_groups'].items())) or 'none'}",
        "",
        "Top domains:"
    ]
    if result["domains"]:
        lines += [f"  {count:>4}  {host}" for host, count in result["domains"][:limit]]
    else:
        lines.append("  (none)")
    lines += ["", "Failed requests:"]
    if result["failed"]:
        lines += [f"  {x['status']:>3} {x['time_ms']:>7.1f} ms  {x['method']} {x['url']}" for x in result["failed"][:limit]]
    else:
        lines.append("  (none)")
    lines += ["", "Slow requests:"]
    if result["slow"]:
        lines += [f"  {x['time_ms']:>7.1f} ms  {x['status']:>3} {x['method']} {x['url']}" for x in result["slow"][:limit]]
    else:
        lines.append("  (none)")
    return "\n".join(lines)

def main():
    p = argparse.ArgumentParser(description="Offline HAR summary and triage")
    p.add_argument("har", help="path to a .har file")
    p.add_argument("--slow-ms", type=float, default=1000)
    p.add_argument("--json", action="store_true", dest="as_json")
    args = p.parse_args()
    with open(args.har, "r", encoding="utf-8") as f:
        data = json.load(f)
    result = analyze_har(data, args.slow_ms)
    print(json.dumps(result, ensure_ascii=False, indent=2) if args.as_json else render(result))

if __name__ == "__main__":
    main()
