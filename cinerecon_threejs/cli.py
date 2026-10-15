"""CLI for preparing tasks, running model comparisons, and exporting judge cases."""
import argparse
import json
from pathlib import Path
from .workflow import ROOT, LEVELS, prepare, run, export_cases, read, save, require, identifier, validate_endpoint


def batch(spec_path, output, execute=False, chromium=None):
    spec_path = Path(spec_path).resolve()
    spec = read(spec_path)
    require(isinstance(spec.get("runs"), list) and spec["runs"], "Batch spec needs a nonempty runs list")
    planned, seen = [], set()
    allowed = {"task", "configuration", "model", "endpoint", "rounds", "max_tokens", "seed", "response_file"}
    for row in spec["runs"]:
        require(isinstance(row, dict) and not (set(row) - allowed), "Unknown batch run fields")
        row = dict(row)
        row["configuration"] = identifier(row["configuration"])
        if row.get("endpoint") is not None:
            validate_endpoint(row["endpoint"])
        row["task_path"] = (spec_path.parent / row.pop("task")).resolve()
        # Read only a generation task; no evaluation-side labels are consulted.
        task = read(row["task_path"])
        key = (row["configuration"], identifier(task["level"]), identifier(task["video_id"]))
        require(key not in seen, "Duplicate batch run")
        seen.add(key)
        row["output"] = Path(output).resolve().joinpath(*key)
        if row.get("response_file"):
            require(not execute, "Imported responses cannot be combined with live --execute")
            row["response_file"] = (spec_path.parent / row["response_file"]).resolve()
        row.update(execute=execute, chromium=chromium)
        planned.append(row)
    if execute or any(row.get("response_file") for row in planned):
        plan_rows = []
        for row in planned:
            task = read(row["task_path"])
            plan_rows.append({"configuration": row["configuration"], "video_id": task["video_id"],
                              "level": task["level"], "run": str(row["output"] / "run.json")})
        plan_path = Path(output) / "batch-plan.json"
        require(not plan_path.exists(), "Use a fresh batch output directory; an existing plan is immutable")
        save(plan_path, {"runs": plan_rows})
    reports = []
    for row in planned:
        try:
            result = run(**row)
            reports.append({k: result.get(k) for k in ("configuration", "video_id", "level", "status", "generated", "max_model_requests")})
        except Exception as error:
            reports.append({"configuration": row["configuration"], "task": str(row["task_path"]),
                            "status": "failed", "error": type(error).__name__, "reason": str(error)[-1000:]})
    result = {"runs": reports, "failed": sum(row["status"] in {"failed", "refused"} for row in reports)}
    if execute or any(row.get("response_file") for row in planned):
        save(Path(output) / "batch-report.json", result)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="CineRecon Three.js generation benchmark (judge unchanged)")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("prepare", help="Extract generation-only reference samples; no API requests")
    p.add_argument("--reference", type=Path, required=True)
    p.add_argument("--video-id", required=True)
    p.add_argument("--level", choices=LEVELS, required=True)
    p.add_argument("--samples", type=int, default=24)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--root", type=Path, default=ROOT)
    p = sub.add_parser("generate", help="Preview by default; --execute enables bounded model calls and rendering")
    p.add_argument("--task", dest="task_path", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--configuration", required=True)
    p.add_argument("--model")
    p.add_argument("--endpoint", help="Explicit OpenAI-compatible chat/completions URL; no default provider")
    source = p.add_mutually_exclusive_group()
    source.add_argument("--execute", action="store_true")
    source.add_argument("--response-file", type=Path)
    source.add_argument("--scene", type=Path, help="Authored smoke fixture, excluded from exported benchmark cases")
    p.add_argument("--rounds", type=int, default=2, help="Fixed generation budget including the initial call (1-10)")
    p.add_argument("--max-tokens", type=int, default=16000)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--chromium", help="Optional Chromium executable path")
    p = sub.add_parser("batch", help="Run a matrix from a spec; previews unless --execute or imported responses")
    p.add_argument("--spec", dest="spec_path", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--execute", action="store_true")
    p.add_argument("--chromium")
    p = sub.add_parser("export-cases", help="Export successful model runs for the unchanged CineRecon evaluator")
    p.add_argument("--runs-root", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--common-only", action="store_true", help="Export only video/level cases successful for every configuration")
    p.add_argument("--include-unverified-imports", action="store_true", help="Explicitly include archived responses whose source protocol cannot be verified")
    args = vars(parser.parse_args(argv))
    command = args.pop("command")
    try:
        result = {"prepare": prepare, "generate": run, "batch": batch, "export-cases": export_cases}[command](**args)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result.get("failed"):
            raise SystemExit(1)
    except (ValueError, RuntimeError, OSError) as error:
        parser.exit(1, f"{type(error).__name__}: {error}\n")
