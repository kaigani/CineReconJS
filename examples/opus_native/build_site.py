#!/usr/bin/env python3
"""Build the generated data and media for the results gallery in site/.

Reads the preserved native runs (runs/opus55/l1-cohort/*, the Astra
continuation under examples/astra_iterative) and writes web-sized videos,
thumbnails, per-clip JSON and copies of each final scene into site/.
Hand-written pages (site/index.html, style.css, app.js) are not touched.

    python examples/opus_native/build_site.py \
        --astra-artifact <dir with downloaded reconstruction.mp4>

ffmpeg/ffprobe must be on PATH. Existing outputs are skipped unless --force.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COHORT = ROOT / "runs/opus55/l1-cohort"
REFERENCE = ROOT / "media/reference"
SITE = ROOT / "site"
WEB_WIDTH = 640
WEB_FPS = 24
HIST_WIDTH = 240
HIST_FRACTIONS = (0.12, 0.37, 0.62, 0.87)
POSTER_FRACTION = 0.4

ASTRA_REASON = (
    "I judge this rendered version sufficient for submission as an editable L1 geometric "
    "proxy: the principal scene structure, shot progression, and action are represented, "
    "and the targeted silhouette and framing corrections have been checked in rendered "
    "pixels. I am stopping with the remaining visual inaccuracies documented; this is a "
    "model-selected submission, not a claim of photorealistic or quantitatively evaluated accuracy."
)


def run(cmd: list[str]) -> str:
    return subprocess.run(
        [str(c) for c in cmd], check=True, capture_output=True, text=True
    ).stdout


def probe(path: Path) -> dict:
    out = run([
        "ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,nb_read_frames,r_frame_rate",
        "-show_entries", "format=duration", "-of", "json", path,
    ])
    data = json.loads(out)
    s = data["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return {
        "width": s["width"], "height": s["height"],
        "frames": int(s["nb_read_frames"]),
        "fps": round(int(num) / int(den), 3),
        "duration": round(float(data["format"]["duration"]), 3),
    }


def encode(src: Path, dst: Path, force: bool) -> None:
    if dst.exists() and not force:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-v", "error", "-y", "-i", src, "-an",
        "-vf", f"fps={WEB_FPS},scale={WEB_WIDTH}:-2",
        "-c:v", "libx264", "-preset", "slow", "-crf", "30",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst,
    ])


def frames_to_jpgs(src: Path, frames: list[int], outdir: Path, prefix: str,
                   width: int, force: bool) -> list[str]:
    """Extract the given frame numbers as <prefix>_<k>.jpg; return file names."""
    names = [f"{prefix}_{k}.jpg" for k in range(len(frames))]
    if not force and all((outdir / n).exists() for n in names):
        return names
    outdir.mkdir(parents=True, exist_ok=True)
    expr = "+".join(f"eq(n\\,{n})" for n in frames)
    tmp = outdir / f".{prefix}_%d.jpg"
    run([
        "ffmpeg", "-v", "error", "-y", "-i", src,
        "-vf", f"select='{expr}',scale={width}:-2", "-fps_mode", "passthrough",
        "-q:v", "6", "-start_number", "0", tmp,
    ])
    for k, name in enumerate(names):
        (outdir / f".{prefix}_{k}.jpg").replace(outdir / name)
    return names


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def build_opus_clip(n: int, row: dict, force: bool) -> dict:
    vid = f"video{n}"
    run_dir = COHORT / vid
    final = read_json(run_dir / "final.json")
    summary = read_json(run_dir / "tracking-summary.json")
    final_video = run_dir / final["video"]
    ref_src = REFERENCE / f"{vid}.mp4"

    ref_info = probe(ref_src)
    rounds = []
    for rd in sorted(p for p in (run_dir / "rounds").iterdir() if p.is_dir()):
        decision = read_json(rd / "decision.json", {})
        mp4 = rd / "render" / "reconstruction.mp4"
        report = (rd / "report.md")
        rounds.append({
            "round": rd.name,
            "action": decision.get("action"),
            "reason": decision.get("reason"),
            "rendered": mp4.exists(),
            "report": report.read_text(encoding="utf-8").strip() if report.exists() else None,
            "_mp4": mp4,
        })

    hist_dir = SITE / "media/hist" / vid
    ref_frames = [min(ref_info["frames"] - 1, int(ref_info["frames"] * f)) for f in HIST_FRACTIONS]
    history = {"reference": frames_to_jpgs(ref_src, ref_frames, hist_dir, "ref", HIST_WIDTH, force),
               "times": [round(f * ref_info["duration"], 2) for f in HIST_FRACTIONS],
               "rounds": {}}
    for r in rounds:
        if r["rendered"]:
            info = probe(r["_mp4"])
            idx = [min(info["frames"] - 1, int(info["frames"] * f)) for f in HIST_FRACTIONS]
            history["rounds"][r["round"]] = frames_to_jpgs(
                r["_mp4"], idx, hist_dir, f"r{r['round']}", HIST_WIDTH, force)
    for r in rounds:
        r.pop("_mp4")

    final_info = probe(final_video)
    encode(ref_src, SITE / "media/ref" / f"{vid}.mp4", force)
    encode(final_video, SITE / "media/opus-5-5" / f"{vid}.mp4", force)
    poster_ref = frames_to_jpgs(ref_src, [int(ref_info["frames"] * POSTER_FRACTION)],
                                SITE / "media/poster/ref", vid, 320, force)[0]
    poster_rec = frames_to_jpgs(final_video, [int(final_info["frames"] * POSTER_FRACTION)],
                                SITE / "media/poster/opus-5-5", vid, 320, force)[0]
    scene_dst = SITE / "media/scene/opus-5-5" / f"{vid}.mjs"
    scene_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(run_dir / final["scene"], scene_dst)

    submit = next((r for r in reversed(rounds) if r["action"] == "submit"), None)
    counts = summary["counts"]
    model = {
        "id": "opus-5-5",
        "video": f"media/opus-5-5/{vid}.mp4",
        "poster": f"media/poster/opus-5-5/{poster_rec}",
        "scene": f"media/scene/opus-5-5/{vid}.mjs",
        "final_round": final["round"],
        "scene_sha256": final["scene_sha256"],
        "video_sha256": final["video_sha256"],
        "stop": row["stop"],
        "revisions": row["revisions"],
        "renders": row["renders"],
        "infra_retries": row["infra_retries"],
        "turns": row["turns"],
        "pauses": row["pauses"],
        "inferences": row["inferences"],
        "output_tokens": row["output_tokens"],
        "cost": row["adj_cost_5m"],
        "cost_1h": row["adj_cost_1h"],
        "elapsed_seconds": round(summary["elapsed_seconds"]),
        "submit_reason": submit["reason"] if submit else None,
        "rounds": rounds,
        "history": history,
        "counts": counts,
    }
    clip = {
        "id": vid, "n": n,
        "reference": {"video": f"media/ref/{vid}.mp4", "poster": f"media/poster/ref/{poster_ref}",
                      **{k: ref_info[k] for k in ("width", "height", "frames", "fps", "duration")}},
        "models": {"opus-5-5": model},
    }
    return clip


def build_astra(clips: dict, artifact: Path | None, force: bool) -> None:
    if artifact is None:
        print("skip Astra: no --astra-artifact", file=sys.stderr)
        return
    src = artifact / "reconstruction.mp4"
    vid = "video1"
    clip = clips[vid]
    info = probe(src)
    summary = read_json(ROOT / "examples/astra_iterative/tracking-summary.json")
    encode(src, SITE / "media/gpt-6-astra" / f"{vid}.mp4", force)
    poster = frames_to_jpgs(src, [int(info["frames"] * POSTER_FRACTION)],
                            SITE / "media/poster/gpt-6-astra", vid, 320, force)[0]
    scene_dst = SITE / "media/scene/gpt-6-astra" / f"{vid}.mjs"
    scene_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / "examples/astra_iterative/revisions/004/scene.mjs", scene_dst)
    total = summary["total_counts"]
    prov = read_json(ROOT / "examples/astra_iterative/revisions/004/provenance.json", {})
    clip["models"]["gpt-6-astra"] = {
        "id": "gpt-6-astra",
        "video": f"media/gpt-6-astra/{vid}.mp4",
        "poster": f"media/poster/gpt-6-astra/{poster}",
        "scene": f"media/scene/gpt-6-astra/{vid}.mjs",
        "final_round": "004",
        "scene_sha256": prov.get("scene_sha256"),
        "stop": "model_submit",
        "revisions": total["scene_revisions"],
        "renders": total["render_attempts"],
        "infra_retries": total["infrastructure_retries"],
        "turns": total["model_turns"],
        "pauses": 0, "inferences": None, "output_tokens": None, "cost": None, "cost_1h": None,
        "elapsed_seconds": round(summary["elapsed_seconds"]),
        "submit_reason": ASTRA_REASON,
        "rounds": [], "history": None, "counts": total,
    }


MODELS = [
    {
        "id": "opus-5-5", "name": "Claude Opus 5.5", "short": "Opus 5.5", "level": "L1",
        "protocol": "native-threejs-inspect-revise-submit",
        "interface": "Claude Code subagent (native orchestration, subscription; no provider API)",
        "samples": 24,
        "ceiling": "10 changed revisions (disclosed to the model); never reached",
        "note": "Full cohort: all 50 reference videos, each ended by the model's own submit decision.",
    },
    {
        "id": "gpt-6-astra", "name": "GPT-6 Astra", "short": "Astra", "level": "L1",
        "protocol": "native-astra-goal-directed-continuation-v1",
        "interface": "Native session (token and inference telemetry unavailable)",
        "samples": 24,
        "ceiling": "90-minute operational ceiling; submitted about 23 s before it",
        "note": "Single-video experiment: video1 only. The other 49 videos were not run.",
    },
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--astra-artifact", type=Path)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", type=int, nargs="*", help="limit to these video numbers")
    ap.add_argument("--jobs", type=int, default=12)
    args = ap.parse_args()

    report = read_json(COHORT / "report.json")
    rows = {r["video"]: r for r in report["rows"]}
    numbers = args.only or list(range(1, 51))

    with ThreadPoolExecutor(args.jobs) as pool:
        futures = {n: pool.submit(build_opus_clip, n, rows[f"video{n}"], args.force) for n in numbers}
        clips = {}
        for n, fut in futures.items():
            clips[f"video{n}"] = fut.result()
            print(f"built video{n}", flush=True)
    if "video1" in clips:
        build_astra(clips, args.astra_artifact, args.force)

    data = SITE / "data"
    data.mkdir(parents=True, exist_ok=True)
    index = []
    for vid, clip in clips.items():
        (data / f"{vid}.json").write_text(json.dumps(clip, indent=1), encoding="utf-8")
        index.append({
            "id": vid, "n": clip["n"],
            "reference": {k: clip["reference"][k] for k in ("poster", "width", "height", "duration")},
            "models": {mid: {k: m[k] for k in ("poster", "revisions", "renders", "cost", "stop")}
                       for mid, m in clip["models"].items()},
        })
    index.sort(key=lambda c: c["n"])
    s = report["summary"]
    (data / "index.json").write_text(json.dumps({
        "models": MODELS,
        "clips": index,
        "summary": {"opus-5-5": s},
        "pricing": s["pricing_usd_per_mtok"],
    }, indent=1), encoding="utf-8")
    print(f"wrote {len(index)} clips")


if __name__ == "__main__":
    main()
