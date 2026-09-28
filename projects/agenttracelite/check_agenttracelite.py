import agenttracelite as app

rows = app.load("examples/agent-trace.jsonl")
assert len(rows) == 3
assert [row["category"] for row in rows] == ["agent", "agent", "tool"]
summary = app.summary(rows)
assert summary["errors"] == 1
assert summary["tokens"] == 820
filtered = [row for row in rows if row["category"] == "tool" and row["duration_ms"] >= 500]
assert len(filtered) == 1
print("AgentTraceLite checks passed")
