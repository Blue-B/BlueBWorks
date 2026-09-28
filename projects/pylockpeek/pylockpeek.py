import argparse,json,sys,tomllib

def inspect(path):
    with open(path,"rb") as f: d=tomllib.load(f)
    if d.get("lock-version")!="1.0": raise ValueError("expected lock-version 1.0")
    if not d.get("created-by"): raise ValueError("created-by is required")
    rows=[]
    for p in d.get("packages",[]):
        if not isinstance(p,dict) or not p.get("name"): raise ValueError("package name is required")
        wheels=p.get("wheels",[]) if isinstance(p.get("wheels",[]),list) else []
        sdist=isinstance(p.get("sdist"),dict)
        kinds=([f"wheel:{len(wheels)}"] if wheels else [])+(["sdist"] if sdist else [])+[k for k in ("vcs","directory","archive") if isinstance(p.get(k),dict)]
        rows.append({"name":p["name"],"version":p.get("version","(unversioned)"),"artifacts":kinds or ["metadata-only"],"source_only":sdist and not wheels})
    return {"created_by":d["created-by"],"requires_python":d.get("requires-python"),"packages":rows,"source_only":sum(x["source_only"] for x in rows)}

def main(argv=None):
    ap=argparse.ArgumentParser(); ap.add_argument("lockfile"); ap.add_argument("--source-only",action="store_true"); ap.add_argument("--json",action="store_true"); a=ap.parse_args(argv)
    try:r=inspect(a.lockfile)
    except (OSError,tomllib.TOMLDecodeError,ValueError) as e: print(f"PyLockPeek: {e}",file=sys.stderr); return 2
    rows=[x for x in r["packages"] if x["source_only"]] if a.source_only else r["packages"]
    if a.json: print(json.dumps({**r,"packages":rows},indent=2)); return 0
    print(f"PyLockPeek: {len(r['packages'])} package(s) | created-by={r['created_by']} | source-only={r['source_only']}")
    for x in rows: print(f"{x['name']}  {x['version']}  {', '.join(x['artifacts'])}")
    return 0
if __name__=="__main__": raise SystemExit(main())
