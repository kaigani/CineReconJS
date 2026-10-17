"""Native Opus inspect -> revise -> submit controller for one prepared task.

The generating model writes files under <run>/rounds/NNN/; this controller
records tracking events, statically screens and renders each candidate, and
builds matched reference/render feedback pairs. It never edits model source.

Relay mode (a separate controller dispatches each native turn as a message):
  controller.py init --task T/task.json --run R --model claude-opus-5-5
  controller.py turn-start --run R
  controller.py turn-end --run R --round 001 [--agent-total-tokens N --agent-tool-uses N --agent-duration-ms N]

Step mode (the generating agent hands each finished round to the controller;
init records the initial dispatch as turn 1):
  controller.py init --task T/task.json --run R --model claude-opus-5-5 --mode step
  controller.py step --run R

  controller.py summary --run R
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from cinerecon_threejs.tracking import RunTracker, scene_hash  # noqa: E402

REVISION_CEILING = 10
PAIR_HALF_WIDTH = 800
STEP_MARKER = "CONTROLLER_STEP_COMPLETE"
NATIVE_ADDENDUM = """
Native inspect-revise-submit protocol (this run):

You are running as a native agent, not through the JSON API harness. Instead of
returning a JSON object, write files. Each of your turns uses a new round
directory that the controller names for you: rounds/NNN/.

- To submit a candidate for rendering, write rounds/NNN/scene.mjs (the complete
  standalone module), rounds/NNN/report.md (the report described above), and
  rounds/NNN/decision.json: {"action": "render", "reason": "<short public reason>"}.
- To finish, write rounds/NNN/decision.json:
  {"action": "submit", "reason": "<public stopping reason>"} and, optionally, an
  updated rounds/NNN/report.md. Submission always applies to the most recently
  rendered scene. To return to an earlier version, resend its full source as a
  new render candidate.
{handoff}
- After each render the controller supplies rounds/NNN/feedback/: pair_XX.jpg
  images (reference sample on the left, your render at the same frame on the
  right, labeled with frame/time above), or render_error.json if the scene failed.
  Full-resolution render frames are also in rounds/NNN/render/frames/.

You decide when the reconstruction is good enough to submit. There is no fixed
number of rounds. An operational safety ceiling of {ceiling} changed scene
revisions after the initial generation applies; it is a safety stop, not a
target, and reaching it is recorded as a ceiling stop rather than your submission.

Restrictions: read only files inside this run directory. Do not open the
reference video, repository examples, other runs, data/annotations, or any
evaluation material. Do not run the renderer or execute the scene; you may run
`node --check` on your own scene.mjs. Do not use web access.
"""
HANDOFF = dict(
    relay="- When your round's files are written, end your turn; the controller renders and messages you.",
    step=("- When your round's files are written, hand the round to the controller by running exactly\n"
          "  {step_command}\n"
          "  in the foreground (Bash timeout 600000 ms). It records your decision, renders, and prints the\n"
          "  next round's instructions. Continue until it prints RUN STOPPED. Never run any other controller\n"
          "  command and never edit files in tracking/ or outside your current round directory."),
)
TURN_DELIVERY = dict(
    relay="controller dispatches each turn as a new message to the agent",
    step="agent invokes the trusted controller `step` command after writing each round; one step call ends one native turn",
)
NEXT = ("This is turn {turn}. Your round directory is rounds/{next}/. Inspect, then either write a complete "
        "revised scene.mjs + report.md + decision.json {{\"action\":\"render\", ...}}, or decision.json "
        "{{\"action\":\"submit\", ...}} (optionally updated report.md). Same restrictions. When the files are "
        "written, run the step command again.")


def now():
    return datetime.now(timezone.utc).isoformat()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, default=str) + "\n", encoding="utf-8")


def state(run):
    return json.loads((run / "controller-state.json").read_text(encoding="utf-8"))


def save_state(run, value):
    write_json(run / "controller-state.json", value)


def step_command(run):
    return f'"{Path(sys.executable).resolve()}" "{Path(__file__).resolve()}" step --run "{run.resolve()}"'


def init(args):
    run, task_path = Path(args.run), Path(args.task)
    task = json.loads(task_path.read_text(encoding="utf-8"))
    run.mkdir(parents=True)
    inputs = run / "inputs"
    shutil.copytree(task_path.parent / "reference_frames", inputs / "reference_frames")
    samples = [dict(index=i, frame=s["frame"], time_sec=s["time_sec"], path=f"inputs/{s['path']}", sha256=s["sha256"])
               for i, s in enumerate(task["samples"])]
    write_json(inputs / "samples.json", dict(video=task["video"], samples=samples))
    prompt = (task_path.parent / "prompt.txt").read_text(encoding="utf-8")
    handoff = HANDOFF[args.mode].replace("{step_command}", step_command(run))
    (inputs / "prompt.txt").write_text(
        prompt + NATIVE_ADDENDUM.replace("{ceiling}", str(REVISION_CEILING)).replace("{handoff}", handoff),
        encoding="utf-8")
    started = now()
    RunTracker.create(run / "tracking", run_id=f"opus-native-{task['video_id']}-{task['level']}",
                      started_at=started, provenance=dict(
                          protocol="native-threejs-inspect-revise-submit",
                          generation_protocol=task["protocol"], model=args.model,
                          interface="Claude Code subagent (native orchestration, subscription; no provider API)",
                          turn_delivery=TURN_DELIVERY[args.mode],
                          video_id=task["video_id"], level=task["level"], samples=len(samples),
                          task_sha256=sha(task_path), reference_sha256=task["reference_sha256"],
                          operational_safety_ceiling=dict(changed_scene_revisions=REVISION_CEILING,
                                                          disclosed_to_model=True),
                          renderer="local native Windows, headless Chromium/SwiftShader (user-selected; not a disposable sandbox)"))
    save_state(run, dict(task=str(task_path.resolve()), mode=args.mode, pending_turn=None, last_round=0,
                         last_rendered_round=None))
    if args.mode == "step":
        open_turn(run)
    print(json.dumps(dict(run=str(run), started_at=started, samples=len(samples), mode=args.mode), indent=2))


def open_turn(run):
    st = state(run)
    if st["pending_turn"] is not None:
        sys.exit(f"Turn {st['pending_turn']} is still pending")
    turn = RunTracker(run / "tracking").model_turn()
    st["pending_turn"] = turn
    st["last_round"] += 1
    save_state(run, st)
    (run / "rounds" / f"{st['last_round']:03d}").mkdir(parents=True, exist_ok=True)
    return turn, f"{st['last_round']:03d}"


def turn_start(args):
    turn, rnd = open_turn(Path(args.run))
    print(json.dumps(dict(turn_sequence=turn, round=rnd)))


SAFETY_PATTERNS = {
    "network": r"\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|https?://",
    "dynamic_code": r"\beval\s*\(|new\s+Function\s*\(|\bimport\s*\(",
    "dom_or_timers": r"\bdocument\.|requestAnimationFrame|setTimeout|setInterval|\bWorker\s*\(",
    "renderer": r"WebGLRenderer\s*\(",
    "data_url": r"data:[a-z]+/",
}


def safety_review(source_path):
    text = source_path.read_text(encoding="utf-8")
    imports = re.findall(r"^\s*import\b[^;]*?from\s*['\"]([^'\"]+)['\"]", text, re.M)
    findings = {k: sorted(set(re.findall(p, text))) for k, p in SAFETY_PATTERNS.items()}
    findings = {k: v for k, v in findings.items() if v}
    bad_imports = [m for m in imports if m != "three"]
    check = subprocess.run(["node", "--check", str(source_path)], capture_output=True, text=True)
    blocking = bool(bad_imports or findings.get("network") or findings.get("dynamic_code") or check.returncode)
    return dict(scene_sha256=sha(source_path), reviewed_at=now(), approved_for_render=not blocking,
                node_check=dict(returncode=check.returncode, stderr=check.stderr[-2000:]),
                imports=imports, non_three_imports=bad_imports, pattern_findings=findings,
                scope="automated static screen; renderer CSP/network policy still applies; not a quality proof")


def render(run, round_dir, video):
    out = round_dir / "render"
    cmd = ["node", str(ROOT / "threejs" / "render.mjs"), "--scene", str(round_dir / "scene.mjs"),
           "--output", str(out), "--width", str(video["width"]), "--height", str(video["height"]),
           "--fps", video["fps_rational"], "--frames", str(video["frames"]), "--seed", "0"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
    (round_dir / "render.log").write_text(proc.stdout + "\n--- stderr ---\n" + proc.stderr, encoding="utf-8")
    meta = out / "renderer-metadata.json"
    if proc.returncode == 0 and meta.exists() and json.loads(meta.read_text(encoding="utf-8")).get("status") == "complete":
        return "succeeded", dict(metadata="render/renderer-metadata.json", metadata_sha256=sha(meta),
                                 video="render/reconstruction.mp4", video_sha256=sha(out / "reconstruction.mp4"))
    err_path = out / "renderer-error.json"
    err = json.loads(err_path.read_text(encoding="utf-8")) if err_path.exists() else dict(
        kind="infrastructure", message=f"renderer exited {proc.returncode} without an error record",
        stderr=proc.stderr[-4000:])
    outcome = "scene_failed" if err.get("kind") == "scene" else "infrastructure_failed"
    return outcome, dict(error=err, returncode=proc.returncode)


def build_feedback(run, round_dir):
    from PIL import Image, ImageDraw
    samples = json.loads((run / "inputs" / "samples.json").read_text(encoding="utf-8"))["samples"]
    fb = round_dir / "feedback"
    fb.mkdir()
    index = []
    for s in samples:
        ref = Image.open(run / s["path"]).convert("RGB")
        ren = Image.open(round_dir / "render" / "frames" / f"frame_{s['frame']:06d}.png").convert("RGB")
        h = round(PAIR_HALF_WIDTH * ren.height / ren.width)
        canvas = Image.new("RGB", (PAIR_HALF_WIDTH * 2 + 8, h + 28), "black")
        canvas.paste(ref.resize((PAIR_HALF_WIDTH, h)), (0, 28))
        canvas.paste(ren.resize((PAIR_HALF_WIDTH, h)), (PAIR_HALF_WIDTH + 8, 28))
        ImageDraw.Draw(canvas).text((6, 8), f"sample {s['index']:02d}  frame {s['frame']}  t={s['time_sec']:.3f}s"
                                    "   | LEFT: reference   RIGHT: your render", fill="white")
        name = f"pair_{s['index']:02d}.jpg"
        canvas.save(fb / name, quality=88)
        index.append(dict(pair=name, frame=s["frame"], time_sec=s["time_sec"]))
    write_json(fb / "index.json", index)


def end_turn(run, rnd, agent_report=None, tool_uses=None):
    """Record the pending turn's decision, render if requested, and return the outcome."""
    st = state(run)
    turn = st["pending_turn"]
    if turn is None or rnd != f"{st['last_round']:03d}":
        sys.exit("No pending turn for this round")
    tracker = RunTracker(run / "tracking")
    round_dir = run / "rounds" / rnd
    decision_path = round_dir / "decision.json"
    try:
        decision = json.loads(decision_path.read_text(encoding="utf-8"))
        action = decision["action"]
        assert action in ("render", "submit"), f"unknown action {action!r}"
    except Exception as exc:  # noqa: BLE001 - recorded as an invalid native response
        tracker.model_result(turn, outcome="invalid_response",
                             evidence=dict(round=rnd, error=repr(exc), agent_reported=agent_report or None))
        st["pending_turn"] = None
        save_state(run, st)
        return dict(round=rnd, status="invalid_decision", error=repr(exc))
    tool_calls = dict(count=tool_uses, source="runtime") if tool_uses is not None else None
    tracker.model_result(turn, native_tool_calls=tool_calls,
                         evidence=dict(round=rnd, decision=f"rounds/{rnd}/decision.json",
                                       decision_sha256=sha(decision_path), agent_reported=agent_report or None))
    st["pending_turn"] = None
    save_state(run, st)
    ev = dict(decision=f"rounds/{rnd}/decision.json", decision_sha256=sha(decision_path))

    if action == "submit":
        if tracker.summary()["submission_render_sequence"] is None:
            return dict(round=rnd, status="submit_rejected",
                        error="the latest scene has no successful render; submit only applies to a rendered scene")
        tracker.decision("submit", turn_sequence=turn, evidence=ev)
        tracker.stop("model_submit", detail=decision.get("reason"), evidence=ev)
        return dict(round=rnd, status="stopped", final=finalize(run, st))

    scene_path = round_dir / "scene.mjs"
    if not scene_path.exists():
        if tracker.summary()["current_scene_sha256"] is not None:
            tracker.decision("render", turn_sequence=turn, evidence=ev)
        return dict(round=rnd, status="missing_scene", error="decision was render but scene.mjs is missing")
    before = tracker.summary()
    if before["current_scene_sha256"] not in (None, scene_hash(scene_path)) and \
            before["counts"]["scene_revisions"] >= REVISION_CEILING:
        tracker.decision("render", turn_sequence=turn, evidence=ev)
        tracker.stop("operational_safety_ceiling",
                     detail=f"Model requested revision {REVISION_CEILING + 1}; ceiling is {REVISION_CEILING} changed revisions",
                     evidence=ev)
        return dict(round=rnd, status="stopped", final=finalize(run, st))
    tracker.scene(scene_path, turn_sequence=turn, evidence=dict(source=f"rounds/{rnd}/scene.mjs", **ev))
    tracker.decision("render", turn_sequence=turn, evidence=ev)
    review = safety_review(scene_path)
    write_json(round_dir / "safety_review.json", review)
    if not review["approved_for_render"]:
        return dict(round=rnd, status="blocked_by_static_review", review=review)

    video = json.loads((run / "inputs" / "samples.json").read_text(encoding="utf-8"))["video"]
    attempt = tracker.render_attempt(evidence=dict(candidate=f"rounds/{rnd}/scene.mjs"))
    outcome, evidence = render(run, round_dir, video)
    tracker.render_result(attempt, outcome=outcome, evidence=evidence)
    if outcome == "infrastructure_failed":
        tracker.infrastructure_retry(attempt, reason=evidence["error"].get("message", "infrastructure failure"))
        shutil.move(str(round_dir / "render"), str(round_dir / "render-failed-1"))
        attempt = tracker.render_attempt(evidence=dict(candidate=f"rounds/{rnd}/scene.mjs", retry=True))
        outcome, evidence = render(run, round_dir, video)
        tracker.render_result(attempt, outcome=outcome, evidence=evidence)
    counts = tracker.summary()["counts"]
    result = dict(round=rnd, render=outcome, counts=counts,
                  revisions_remaining_before_ceiling=REVISION_CEILING - counts["scene_revisions"])
    if outcome == "succeeded":
        build_feedback(run, round_dir)
        st["last_rendered_round"] = rnd
        save_state(run, st)
        return dict(status="rendered", **result)
    (round_dir / "feedback").mkdir(exist_ok=True)
    write_json(round_dir / "feedback" / "render_error.json", evidence)
    return dict(status="render_failed", error=evidence.get("error"), **result)


def turn_end(args):
    report = {k: v for k, v in dict(total_tokens=args.agent_total_tokens, tool_uses=args.agent_tool_uses,
              duration_ms=args.agent_duration_ms).items() if v is not None}
    result = end_turn(Path(args.run), f"{int(args.round):03d}", report, args.agent_tool_uses)
    print(json.dumps(result, indent=2, default=str))


def step(args):
    run = Path(args.run).resolve()
    st = state(run)
    if st.get("mode") != "step":
        sys.exit("This run is not in step mode")
    if st["pending_turn"] is None:
        sys.exit("No pending turn: the run has stopped")
    rnd = f"{st['last_round']:03d}"
    result = end_turn(run, rnd)
    if result["status"] == "stopped":
        print(json.dumps(result["final"], indent=2, default=str))
        print(f"{STEP_MARKER}\nRUN STOPPED ({result['final']['stopping']['reason']}). "
              "Reply with one short paragraph summarizing the submitted reconstruction and end.")
        return
    _, nxt = open_turn(run)
    tracker = RunTracker(run / "tracking")
    turn_no = sum(1 for e in tracker.events() if e["kind"] == "model_turn")
    used = tracker.summary()["counts"]["scene_revisions"]
    status = result["status"]
    if status == "rendered":
        head = (f"Round {rnd} rendered successfully. Feedback: rounds/{rnd}/feedback/pair_00.jpg-pair_23.jpg "
                f"(left reference, right your render) and index.json; full-resolution frames in "
                f"rounds/{rnd}/render/frames/.")
    elif status == "render_failed":
        head = (f"Round {rnd} failed to render; details in rounds/{rnd}/feedback/render_error.json:\n"
                + json.dumps(result.get("error"), indent=2, default=str)[:4000])
    elif status == "blocked_by_static_review":
        head = (f"Round {rnd} was not rendered: the static review blocked it (see rounds/{rnd}/safety_review.json). "
                "Remove network access, dynamic code, and non-'three' imports; check node --check.")
    else:
        head = f"Round {rnd} was not accepted ({status}): {result.get('error')}"
    print(f"{STEP_MARKER}\n{head}\nRevisions used: {used} of the {REVISION_CEILING}-revision safety ceiling.\n\n"
          + NEXT.format(turn=turn_no, next=nxt))


def finalize(run, st):
    tracker = RunTracker(run / "tracking")
    s = tracker.summary()
    write_json(run / "tracking-summary.json", s)
    if s["stopping"]["reason"] == "model_submit" and st["last_rendered_round"]:
        rnd = st["last_rendered_round"]
        final = run / "rounds" / rnd
        write_json(run / "final.json", dict(round=rnd, scene=f"rounds/{rnd}/scene.mjs",
                                            scene_sha256=sha(final / "scene.mjs"),
                                            video=f"rounds/{rnd}/render/reconstruction.mp4",
                                            video_sha256=sha(final / "render" / "reconstruction.mp4"),
                                            head_sha256=s["head_sha256"], event_count=s["event_count"]))
    return dict(stopping=s["stopping"], counts=s["counts"], elapsed_seconds=s["elapsed_seconds"])


def summary(args):
    print(json.dumps(RunTracker(Path(args.run) / "tracking").summary(), indent=2))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("init"); a.add_argument("--task", required=True); a.add_argument("--run", required=True)
    a.add_argument("--model", required=True); a.add_argument("--mode", choices=tuple(HANDOFF), default="relay")
    a = sub.add_parser("turn-start"); a.add_argument("--run", required=True)
    a = sub.add_parser("turn-end"); a.add_argument("--run", required=True); a.add_argument("--round", required=True)
    for k in ("agent-total-tokens", "agent-tool-uses", "agent-duration-ms"):
        a.add_argument(f"--{k}", type=int)
    a = sub.add_parser("step"); a.add_argument("--run", required=True)
    a = sub.add_parser("summary"); a.add_argument("--run", required=True)
    args = p.parse_args()
    dict(init=init, step=step, summary=summary, **{"turn-start": turn_start, "turn-end": turn_end})[args.cmd](args)


if __name__ == "__main__":
    main()
