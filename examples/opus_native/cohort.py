"""Bookkeeping for a cohort of step-mode native runs.

  cohort.py assign --root R --video video7 --agent <agentId>
  cohort.py finish --root R --video video7      # transcript usage + cost estimate
  cohort.py status --root R                     # per-run table and totals (JSON + markdown)
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TRANSCRIPTS = Path.home() / ".claude" / "projects" / "C--Users-kaiga-Documents-PROJECTS-261015-CineReconJS"
PRICES = dict(input_tokens=4.0, cache_read_input_tokens=0.20, output_tokens=20.0)  # USD per MTok, claude-opus-5-5
CACHE_WRITE = {"5m": 5.0, "1h": 8.0}


def load(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def cost(usage, ttl):
    return (sum(usage[k] * p for k, p in PRICES.items()) + usage["cache_creation_input_tokens"] * CACHE_WRITE[ttl]) / 1e6


def assign(args):
    agents_path = Path(args.root) / "agents.json"
    agents = load(agents_path, {})
    agents[args.video] = args.agent
    save(agents_path, agents)


def finish(args):
    root = Path(args.root)
    agent = load(root / "agents.json", {})[args.video]
    transcripts = list(TRANSCRIPTS.glob(f"*/subagents/agent-{agent}.jsonl"))
    if len(transcripts) != 1:
        sys.exit(f"Expected one transcript for {agent}, found {transcripts}")
    out = subprocess.run([sys.executable, str(HERE / "transcript_usage.py"), str(transcripts[0])],
                         capture_output=True, text=True, check=True).stdout
    run = root / args.video
    (run / "transcript-usage.json").write_text(out, encoding="utf-8")
    total = json.loads(out)["total"]
    save(run / "cost-estimate.json", dict(
        pricing_usd_per_mtok=dict(input=4, output=20, cache_read=0.20, cache_write_5m=5, cache_write_1h=8),
        total_tokens=total,
        estimated_cost_usd={f"cache_write_{t}": round(cost(total, t), 2) for t in CACHE_WRITE},
        basis="Claude Code subagent transcript per-inference usage (max per message id); "
              "hypothetical API list price, not billed"))
    print(json.dumps(dict(video=args.video, **load(run / "cost-estimate.json", {})["estimated_cost_usd"]), indent=None))


def status(args):
    root = Path(args.root)
    rows = []
    for run in sorted((p for p in root.iterdir() if (p / "tracking").is_dir()), key=lambda p: int(p.name[5:])):
        summary = run / "tracking-summary.json"
        st = load(run / "controller-state.json", {})
        task = load(Path(st["task"]), {}) if st.get("task") else {}
        s = load(summary, None)
        est = load(run / "cost-estimate.json", None)
        usage = load(run / "transcript-usage.json", None)
        rows.append(dict(
            video=run.name, frames=task.get("video", {}).get("frames"),
            stop=s["stopping"]["reason"] if s else "running",
            revisions=s["counts"]["scene_revisions"] if s else None,
            renders=s["counts"]["render_attempts"] if s else None,
            turns=s["counts"]["model_turns"] if s else None,
            minutes=round(s["elapsed_seconds"] / 60, 1) if s else None,
            inferences=usage["total"]["inferences"] if usage else None,
            output_tokens=usage["total"]["output_tokens"] if usage else None,
            cost_5m=est["estimated_cost_usd"]["cache_write_5m"] if est else None,
            cost_1h=est["estimated_cost_usd"]["cache_write_1h"] if est else None))
    done = [r for r in rows if r["cost_5m"] is not None]
    totals = dict(runs=len(rows), finished=len(done),
                  submitted=sum(r["stop"] == "model_submit" for r in rows),
                  ceiling=sum(r["stop"] == "operational_safety_ceiling" for r in rows),
                  revisions=sum(r["revisions"] or 0 for r in done),
                  cost_5m=round(sum(r["cost_5m"] for r in done), 2),
                  cost_1h=round(sum(r["cost_1h"] for r in done), 2))
    save(root / "cohort-status.json", dict(rows=rows, totals=totals))
    cols = list(rows[0]) if rows else []
    lines = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    lines += ["| " + " | ".join("" if r[c] is None else str(r[c]) for c in cols) + " |" for r in rows]
    (root / "cohort-status.md").write_text("\n".join(lines) + "\n\n" + json.dumps(totals) + "\n", encoding="utf-8")
    print(json.dumps(totals))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("assign"); a.add_argument("--root", required=True); a.add_argument("--video", required=True)
    a.add_argument("--agent", required=True)
    a = sub.add_parser("finish"); a.add_argument("--root", required=True); a.add_argument("--video", required=True)
    a = sub.add_parser("status"); a.add_argument("--root", required=True)
    args = p.parse_args()
    dict(assign=assign, finish=finish, status=status)[args.cmd](args)


if __name__ == "__main__":
    main()
