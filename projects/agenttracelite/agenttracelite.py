import argparse, json, sys
from pathlib import Path

def _value(v):
    if not isinstance(v,dict): return v
    for k in ("stringValue","boolValue","intValue","doubleValue"):
        if k in v: return v[k]
    return v

def _attrs(items):
    return {x["key"]:_value(x.get("value",{})) for x in (items or []) if isinstance(x,dict) and x.get("key")}

def load(path):
    rows=[]
    with Path(path).open(encoding="utf-8") as f:
        for line_no,line in enumerate(f,1):
            if not line.strip(): continue
            try: obj=json.loads(line)
            except json.JSONDecodeError as e: raise ValueError(f"line {line_no}: invalid JSON ({e.msg})") from None
            groups=obj.get("resourceSpans") if isinstance(obj,dict) else None
            if not isinstance(groups,list): raise ValueError(f"line {line_no}: missing resourceSpans")
            for group in groups:
                service=str(_attrs((group.get("resource") or {}).get("attributes",[])).get("service.name","(unknown-service)"))
                for scope in group.get("scopeSpans",[]) or []:
                    for span in scope.get("spans",[]) or []:
                        needed=("traceId","spanId","name","startTimeUnixNano","endTimeUnixNano")
                        missing=[k for k in needed if k not in span]
                        if missing: raise ValueError(f"line {line_no}: span missing {', '.join(missing)}")
                        try: start,end=int(span["startTimeUnixNano"]),int(span["endTimeUnixNano"])
                        except (TypeError,ValueError): raise ValueError(f"line {line_no}: bad timestamp") from None
                        if end < start: raise ValueError(f"line {line_no}: span end precedes start")
                        a=_attrs(span.get("attributes",[])); name=str(span["name"])
                        tool=a.get("gen_ai.tool.name") or a.get("tool.name")
                        cat="tool" if tool or "tool" in name.lower() else ("agent" if a.get("gen_ai.operation.name") or name.lower() in {"invoke_agent","chat"} else "other")
                        code=int((span.get("status") or {}).get("code",0) or 0)
                        rows.append({"trace":str(span["traceId"]),"name":name,"service":service,
                                     "duration_ms":(end-start)/1000000,"status":"ERROR" if code==2 else ("OK" if code==1 else "UNSET"),
                                     "category":cat,"model":a.get("gen_ai.request.model"),"tool":tool,
                                     "input_tokens":a.get("gen_ai.usage.input_tokens"),"output_tokens":a.get("gen_ai.usage.output_tokens")})
    if not rows: raise ValueError("no spans found")
    return rows

def summary(rows):
    tokens=0
    for r in rows:
        for k in ("input_tokens","output_tokens"):
            try: tokens += int(r[k]) if r[k] is not None else 0
            except (TypeError,ValueError): pass
    return {"traces":len({r["trace"] for r in rows}),"spans":len(rows),"errors":sum(r["status"]=="ERROR" for r in rows),"tokens":tokens}

def render(rows,slow=0,category=None):
    s=summary(rows); shown=[r for r in rows if r["duration_ms"]>=slow and (category is None or r["category"]==category)]
    out=[f"AgentTraceLite: {s['traces']} trace(s) | {s['spans']} span(s) | errors={s['errors']} | tokens={s['tokens']}",
         "DURATION   STATUS  TYPE   SERVICE              SPAN"]
    for r in shown:
        extra=(f" [tool={r['tool']}]" if r["tool"] else "")+(f" [model={r['model']}]" if r["model"] else "")
        out.append(f"{r['duration_ms']:8.1f}ms  {r['status']:<6}  {r['category']:<5}  {r['service'][:20]:<20} {r['name']}{extra}")
    if not shown: out.append("(no spans matched)")
    return "\n".join(out)

def main(argv=None):
    ap=argparse.ArgumentParser(); ap.add_argument("trace_file"); ap.add_argument("--slow-ms",type=float,default=0); ap.add_argument("--category",choices=["agent","tool","other"]); ap.add_argument("--json",action="store_true")
    a=ap.parse_args(argv)
    if a.slow_ms < 0: ap.error("--slow-ms must be zero or greater")
    try: rows=load(a.trace_file)
    except (OSError,ValueError) as e: print(f"AgentTraceLite: {e}",file=sys.stderr); return 2
    print(json.dumps({"summary":summary(rows),"spans":rows},indent=2) if a.json else render(rows,a.slow_ms,a.category))
    return 0

if __name__=="__main__": raise SystemExit(main())
