"""Write the cohort report (REPORT.md + report.json) from finished step-mode runs.

  report.py --root runs/opus55/l1-cohort

Cost is shown as measured and "pause-adjusted": when a subscription session limit
interrupted a run, the transcript holds a <synthetic> error message and the first
real inference after it re-writes the whole context to cache. An uninterrupted API
run would have read that context from cache, so the adjusted figure reprices that
inference's cache writes as cache reads.
"""
import argparse
import json
import statistics
from pathlib import Path

from cohort import CACHE_WRITE, PRICES, TRANSCRIPTS, cost, load

FIELDS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")


def resume_rewrites(transcript):
    """Cache-write tokens on the first real inference after each <synthetic> error."""
    usage_by_id, order, pending, flagged = {}, [], False, []
    for line in open(transcript, encoding="utf-8"):
        rec = json.loads(line)
        if rec.get("type") != "assistant":
            continue
        msg = rec.get("message") or {}
        mid = msg.get("id")
        if msg.get("model") == "<synthetic>":
            pending = True
            continue
        if mid not in usage_by_id:
            usage_by_id[mid] = 0
            order.append(mid)
            if pending:
                flagged.append(mid)
                pending = False
        usage_by_id[mid] = max(usage_by_id[mid], (msg.get("usage") or {}).get("cache_creation_input_tokens") or 0)
    return len(flagged), sum(usage_by_id[m] for m in flagged)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", required=True)
    root = Path(p.parse_args().root)
    agents = load(root / "agents.json", {})
    rows = []
    for run in sorted((d for d in root.iterdir() if (d / "tracking-summary.json").exists()), key=lambda d: int(d.name[5:])):
        s = load(run / "tracking-summary.json", {})
        total = load(run / "transcript-usage.json", {})["total"]
        transcript = next(TRANSCRIPTS.glob(f"*/subagents/agent-{agents[run.name]}.jsonl"))
        pauses, rewrite = resume_rewrites(transcript)
        adjusted = dict(total, cache_creation_input_tokens=total["cache_creation_input_tokens"] - rewrite,
                        cache_read_input_tokens=total["cache_read_input_tokens"] + rewrite)
        c = s["counts"]
        rows.append(dict(
            video=run.name, stop=s["stopping"]["reason"], revisions=c["scene_revisions"],
            renders=c["render_attempts"], infra_retries=c["infrastructure_retries"], turns=c["model_turns"],
            pauses=pauses, inferences=total["inferences"], output_tokens=total["output_tokens"],
            cache_write_tokens=total["cache_creation_input_tokens"], cache_read_tokens=total["cache_read_input_tokens"],
            cost_5m=round(cost(total, "5m"), 2), cost_1h=round(cost(total, "1h"), 2),
            adj_cost_5m=round(cost(adjusted, "5m"), 2), adj_cost_1h=round(cost(adjusted, "1h"), 2)))

    def stat(key):
        vals = [r[key] for r in rows]
        return dict(sum=round(sum(vals), 2), mean=round(statistics.mean(vals), 2),
                    median=statistics.median(vals), min=min(vals), max=max(vals))

    summary = dict(
        runs=len(rows), stops={k: sum(r["stop"] == k for r in rows) for k in sorted({r["stop"] for r in rows})},
        paused_runs=sum(r["pauses"] > 0 for r in rows),
        revision_histogram={n: sum(r["revisions"] == n for r in rows) for n in range(0, 11)},
        **{k: stat(k) for k in ("revisions", "renders", "inferences", "output_tokens",
                                "cost_5m", "cost_1h", "adj_cost_5m", "adj_cost_1h")},
        pricing_usd_per_mtok=dict(input=PRICES["input_tokens"], output=PRICES["output_tokens"],
                                  cache_read=PRICES["cache_read_input_tokens"],
                                  cache_write_5m=CACHE_WRITE["5m"], cache_write_1h=CACHE_WRITE["1h"]))
    (root / "report.json").write_text(json.dumps(dict(summary=summary, rows=rows), indent=2) + "\n", encoding="utf-8")

    cols = ["video", "stop", "revisions", "renders", "infra_retries", "pauses", "inferences", "output_tokens",
            "cost_5m", "cost_1h", "adj_cost_5m", "adj_cost_1h"]
    lines = ["# Opus 5.5 native L1 cohort", "",
             f"{summary['runs']} runs; stops: {summary['stops']}; {summary['paused_runs']} runs paused by subscription session limits.", "",
             "| metric | sum | mean | median | min | max |", "|---|---|---|---|---|---|"]
    for k in ("revisions", "renders", "inferences", "output_tokens", "cost_5m", "cost_1h", "adj_cost_5m", "adj_cost_1h"):
        v = summary[k]
        lines.append(f"| {k} | {v['sum']} | {v['mean']} | {v['median']} | {v['min']} | {v['max']} |")
    lines += ["", "Revisions histogram: " + ", ".join(f"{n}: {c}" for n, c in summary["revision_histogram"].items() if c), "",
              "Cost is hypothetical API list price (USD) from subagent transcript usage, max per message id; "
              "`_5m`/`_1h` = cache-write TTL assumption; `adj_` reprices post-pause cache re-writes as cache reads.", "",
              "| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    lines += ["| " + " | ".join(str(r[c]) for c in cols) + " |" for r in rows]
    notes = root / "notes.md"
    if notes.exists():
        lines += ["", notes.read_text(encoding="utf-8").replace("# Cohort caveats", "## Caveats", 1)]
    (root / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({k: summary[k] for k in ("runs", "stops", "paused_runs", "revisions", "adj_cost_5m", "cost_5m")}))


if __name__ == "__main__":
    main()
