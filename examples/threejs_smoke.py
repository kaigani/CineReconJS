"""Offline, synthetic end-to-end test. No model endpoint, credentials, or network calls.

Use --evaluate to additionally run upstream evaluation code with synthetic labels.
"""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cinerecon_threejs.workflow import ROOT, empty_output, render, prepare, run, save, sha


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--chromium")
    parser.add_argument("--evaluate", action="store_true")
    args = parser.parse_args()
    out = empty_output(args.output)
    source = ROOT / "threejs/scenes/demo.mjs"
    video = dict(width=320, height=180, fps_rational="6", fps=6.0, frames=12, duration=2.0)
    render(source, out / "reference_render", video, chromium=args.chromium)
    reference = out / "reference_render/reconstruction.mp4"
    prepare(reference, out / "task", "synthetic", "L1", samples=4)
    generated = run(out / "task/task.json", out / "reconstruction", "SYNTHETIC_TEST_ONLY",
                    scene=source, rounds=1, chromium=args.chromium)
    assert generated["status"] == "success"
    assert generated["origin"] == "authored_scene_smoke"
    result = dict(passed=True, synthetic_test_only=True, api_calls=0,
                  generated=generated["generated"], evaluator_tested=False)
    if args.evaluate:
        from cinerecon.evaluation import prepare as prepare_evaluation, judge
        from cinerecon.aggregate import summarize
        annotation = dict(clip_id="synthetic_cp001", video_id="synthetic", fps=6.0,
            start_frame=0, end_frame=11, source_frame_offset=0, source_sha256=sha(reference),
            first_appearance_definition="Zero-based first visible local frame", entities=[],
            evaluation_sample_frames=[0, 11], evaluation_cut_frames=[],
            items=[dict(item_key=f"L1:synthetic_{i}", statement="Synthetic pipeline test only",
                category=category, levels=["L1", "L2", "L3"], start_frame=0, end_frame=11,
                evidence_frames=[0, 11], subject_ids=[]) for i, category in enumerate(
                    ["camera_position", "object_presence", "object_motion"])])
        save(out / "dataset/data/annotations/en/synthetic_cp001.json", annotation)
        save(out / "synthetic_response.json", dict(model="gpt-5.6-sol", choices=[dict(
            finish_reason="stop", message=dict(content=json.dumps({"results": [
                "Unsatisfied", "Partially satisfied", "Fully satisfied"]})))]))
        for level in ("L1", "L2", "L3"):
            prompt = out / "dataset/prompts/evaluation/en" / f"{level}.txt"
            prompt.parent.mkdir(parents=True, exist_ok=True)
            prompt.write_text("Synthetic parser fixture, not a real model evaluation. Return three labels.")
            folder = out / "jobs" / level
            prepare_evaluation(out / "dataset", "synthetic_cp001", level, "en", reference,
                               Path(generated["generated"]), folder, "SYNTHETIC_TEST_ONLY")
            assert judge(folder, response_file=out / "synthetic_response.json")["status"] == "success"
        summary = summarize([out / "jobs" / level for level in ("L1", "L2", "L3")])
        assert summary["configurations"][0]["overall"] == 50.0
        summary["synthetic_test_only"] = True
        save(out / "synthetic-summary.json", summary)
        result["evaluator_tested"] = True
    save(out / "smoke-result.json", result)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
