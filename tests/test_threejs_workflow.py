"""Network-free tests for authored Three.js harness code only."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from cinerecon_threejs.workflow import (
    decode_response, sample_indices, identifier, fingerprint, save, sha, load_task,
    request_body, export_cases, run, call_model, probe, SceneRenderError, PROTOCOL,
)
from cinerecon_threejs.cli import batch
from cinerecon_threejs.tracking import RunTracker, scene_hash, COUNTERS

SOURCE = "export function createScene({THREE}) { return {}; }"


def task_at(folder):
    folder.mkdir(exist_ok=True)
    reference = folder / "reference.mp4"
    reference.write_bytes(b"synthetic video")
    image = folder / "frame.jpg"
    image.write_bytes(b"synthetic image")
    task = dict(protocol=PROTOCOL, level="L1", video_id="video1", prompt="scene prompt",
                reference=str(reference), reference_sha256=sha(reference),
                input_modality="uniform_timestamped_frames", sampling_policy={"kind": "uniform_endpoints", "requested_samples": 24},
                video=dict(width=32, height=32, frames=2, fps=2.0, fps_rational="2", duration=1.0),
                samples=[dict(frame=0, time_sec=0.0, path="frame.jpg", sha256=sha(image))])
    task["fingerprint"] = fingerprint(task)
    save(folder / "task.json", task)
    return folder / "task.json", task


class WorkflowTests(unittest.TestCase):
    def test_sample_endpoints_and_short_video(self):
        self.assertEqual(sample_indices(10, 3), [0, 4, 9])
        self.assertEqual(sample_indices(3, 24), [0, 1, 2])
        self.assertEqual(sample_indices(1, 24), [0])
        with self.assertRaises(ValueError):
            sample_indices(10, 1)

    def test_probe_rejects_vfr_and_normalizes_initial_container_offset(self):
        from types import SimpleNamespace
        fixture = {"streams": [{"width": 64, "height": 48, "r_frame_rate": "24/1",
                    "avg_frame_rate": "24/1", "nb_read_frames": "3", "time_base": "1/24000"}],
                   "frames": [{"best_effort_timestamp": n} for n in (0, 1000, 2000)]}
        with patch("cinerecon_threejs.workflow.subprocess.run", return_value=SimpleNamespace(stdout=json.dumps(fixture))):
            self.assertEqual(probe("fixture.mp4")["frames"], 3)
        fixture["frames"] = [{"best_effort_timestamp": n} for n in (0, 800, 2000)]
        with patch("cinerecon_threejs.workflow.subprocess.run", return_value=SimpleNamespace(stdout=json.dumps(fixture))):
            with self.assertRaisesRegex(ValueError, "timestamp"):
                probe("fixture.mp4")
        fixture["frames"] = [{"best_effort_timestamp": n} for n in (1000, 2000, 3000)]
        with patch("cinerecon_threejs.workflow.subprocess.run", return_value=SimpleNamespace(stdout=json.dumps(fixture))):
            shifted = probe("fixture.mp4")
            self.assertAlmostEqual(shifted["decoded_first_pts_sec"], 1 / 24)
            self.assertEqual(shifted["timeline_origin"], "first_decoded_frame")

    def test_identifiers_are_path_safe(self):
        for text in ("../escape", "model/name", "", "a b"):
            with self.assertRaises(ValueError):
                identifier(text)
        self.assertEqual(identifier("model-threejs_2"), "model-threejs_2")

    def test_decode_rejects_refusal_truncation_and_non_scene(self):
        self.assertEqual(decode_response({"scene_source": SOURCE, "report": "okay"}), (SOURCE, "okay"))
        with self.assertRaises(PermissionError):
            decode_response({"choices": [{"message": {"refusal": "no"}}]})
        with self.assertRaises(ValueError):
            decode_response({"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]})
        with self.assertRaises(ValueError):
            decode_response({"scene_source": "alert('x')", "report": ""})

    def test_task_hashes_detect_changes(self):
        with tempfile.TemporaryDirectory() as temp:
            path, task = task_at(Path(temp))
            self.assertEqual(load_task(path)["video_id"], "video1")
            (path.parent / "frame.jpg").write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "sample changed"):
                load_task(path)

    def test_task_rejects_path_escape(self):
        with tempfile.TemporaryDirectory() as temp:
            path, task = task_at(Path(temp))
            task["samples"][0]["path"] = "../outside.jpg"
            task.pop("fingerprint")
            task["fingerprint"] = fingerprint(task)
            save(path, task)
            with self.assertRaisesRegex(ValueError, "escapes"):
                load_task(path)

    def test_preview_never_calls_model_or_creates_run(self):
        with tempfile.TemporaryDirectory() as temp:
            path, _ = task_at(Path(temp) / "task")
            output = Path(temp) / "run"
            with patch("cinerecon_threejs.workflow.call_model") as model:
                result = run(path, output, "model_test", model="vision-model")
                model.assert_not_called()
            self.assertEqual(result["status"], "preview")
            self.assertFalse(output.exists())
            self.assertNotIn("annotation", json.dumps(result))

    def test_invalid_secret_endpoint_is_never_persisted_or_previewed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            for endpoint in ("https://user:SECRET@example.com/api", "https://example.com/api?key=SECRET"):
                with self.assertRaises(ValueError) as error:
                    run(task, root / "run", "test", model="vision", endpoint=endpoint, execute=True)
                self.assertNotIn("SECRET", str(error.exception))
                self.assertFalse((root / "run").exists())

    def test_request_contains_only_generation_inputs(self):
        with tempfile.TemporaryDirectory() as temp:
            path, task = task_at(Path(temp))
            body = request_body(task, path.parent, "test-model", inline=True)
            text = json.dumps(body)
            self.assertIn("data:image/jpeg;base64,", text)
            self.assertNotIn("reference_sha256", text)
            self.assertNotIn("api_key", text)

    def test_offline_scene_marked_non_benchmark_and_exported_cases_skip_it(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            scene = root / "input.mjs"
            scene.write_text(SOURCE)
            def fake_render(source, output, *args):
                output.mkdir()
                for name in ("reconstruction.mp4", "scene.json", "renderer-metadata.json"):
                    (output / name).write_text("{}")
                return {"backend": "test-double"}
            with patch("cinerecon_threejs.workflow.render", side_effect=fake_render):
                result = run(task, root / "run", "test", scene=scene, rounds=1)
            self.assertEqual(result["status"], "success")
            self.assertEqual(result["origin"], "authored_scene_smoke")
            self.assertEqual(result["tracking"]["counts"]["initial_generations"], 0)
            self.assertEqual(result["tracking"]["counts"]["model_turns"], 0)
            with self.assertRaisesRegex(ValueError, "No successful model runs"):
                export_cases(root, root / "cases.json")

    def test_imported_response_exports_without_live_request(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            response = root / "response.json"
            save(response, {"scene_source": SOURCE, "report": "test"})
            def fake_render(source, output, *args):
                output.mkdir()
                for name in ("reconstruction.mp4", "scene.json", "renderer-metadata.json"):
                    (output / name).write_text("{}")
                return {"backend": "test-double"}
            with patch("cinerecon_threejs.workflow.call_model") as model, patch("cinerecon_threejs.workflow.render", side_effect=fake_render):
                run(task, root / "run", "model_test", model="test-model", response_file=response, rounds=1)
                model.assert_not_called()
            with self.assertRaisesRegex(ValueError, "unverified imports excluded"):
                export_cases(root, root / "not-exported.json")
            export_cases(root, root / "cases.json", include_unverified_imports=True)
            self.assertEqual(read_json(root / "cases.json")["cases"][0]["video_id"], "video1")
            (root / "run/reconstruction.mp4").write_text("altered")
            with self.assertRaisesRegex(ValueError, "changed"):
                export_cases(root, root / "cases2.json", include_unverified_imports=True)

    def test_failed_render_recorded_and_not_exported(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            response = root / "response.json"
            save(response, {"scene_source": SOURCE, "report": "test"})
            with patch("cinerecon_threejs.workflow.render", side_effect=RuntimeError("fixture render failed")):
                with self.assertRaises(RuntimeError):
                    run(task, root / "run", "test", model="test-model", response_file=response, rounds=1)
            self.assertEqual(read_json(root / "run/run.json")["status"], "failed")
            self.assertFalse((root / "run/reconstruction.mp4").exists())

    def test_live_loop_is_bounded_and_uses_synchronized_feedback(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            def fake_render(source, output, *args):
                (output / "frames").mkdir(parents=True)
                (output / "frames/frame_000000.png").write_bytes(b"fake PNG")
                for name in ("reconstruction.mp4", "scene.json", "renderer-metadata.json"):
                    (output / name).write_text("{}")
                return {"backend": "test-double"}
            raw = {"model": "fixture-model", "scene_source": SOURCE, "report": "fixture"}
            # Wrapped API format preserves model provenance while content has the exact schema.
            api = {"model": "fixture-model", "choices": [{"finish_reason": "stop", "message": {
                "content": json.dumps({"scene_source": SOURCE, "report": "fixture"})}}]}
            with patch("cinerecon_threejs.workflow.call_model", return_value=api) as model, patch(
                    "cinerecon_threejs.workflow.render", side_effect=fake_render):
                result = run(task, root / "run", "test", model="fixture-model", endpoint="https://example.invalid/api",
                             execute=True, rounds=2)
                self.assertEqual(model.call_count, 2)
                self.assertIn("YOUR RENDER frame 0", json.dumps(model.call_args_list[1].args[1]))
                self.assertNotIn("YOUR RENDER", json.dumps(model.call_args_list[0].args[1]))
            self.assertEqual(len(result["attempts"]), 2)
            self.assertEqual(result["attempts"][1]["response_model"], "fixture-model")
            tracked = result["tracking"]
            self.assertEqual(tracked["counts"]["initial_generations"], 1)
            self.assertEqual(tracked["counts"]["scene_revisions"], 0)  # Same returned bytes twice.
            self.assertEqual(tracked["counts"]["model_turns"], 2)
            self.assertEqual(tracked["counts"]["provider_responses"], 2)
            self.assertEqual(tracked["counts"]["render_attempts"], 3)  # Includes preflight.
            self.assertEqual(tracked["render_attempts_by_purpose"], {"preflight": 1, "scene": 2})
            self.assertEqual(tracked["stopping"]["reason"], "scheduled_budget_complete")
            self.assertIsNone(tracked["token_usage"]["total_tokens"])
            self.assertEqual(RunTracker(root / "run/tracking").summary()["head_sha256"], tracked["head_sha256"])

    def test_scene_failure_is_repaired_within_remaining_budget(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            def fake_render(source, output, *args):
                if "round_01" in str(output):
                    raise SceneRenderError("bad scene contract")
                (output / "frames").mkdir(parents=True)
                (output / "frames/frame_000000.png").write_bytes(b"fake PNG")
                for name in ("reconstruction.mp4", "scene.json", "renderer-metadata.json"):
                    (output / name).write_text("{}")
                return {"backend": "test-double"}
            with patch("cinerecon_threejs.workflow.call_model", return_value={"scene_source": SOURCE, "report": "fixture"}) as model, patch(
                    "cinerecon_threejs.workflow.render", side_effect=fake_render):
                result = run(task, root / "run", "test", model="fixture", endpoint="https://example.invalid/api",
                             execute=True, rounds=2)
                self.assertEqual(model.call_count, 2)
                self.assertIn("bad scene contract", json.dumps(model.call_args_list[1].args[1]))
            self.assertEqual(result["status"], "success")
            self.assertEqual([a["status"] for a in result["attempts"]], ["render_failed", "rendered"])

    def test_renderer_preflight_failure_makes_no_paid_request(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            with patch("cinerecon_threejs.workflow.call_model") as model, patch(
                    "cinerecon_threejs.workflow.render", side_effect=RuntimeError("Chromium unavailable")):
                with self.assertRaises(RuntimeError):
                    run(task, root / "run", "test", model="fixture", endpoint="https://example.invalid/api",
                        execute=True, rounds=3)
                model.assert_not_called()
            record = read_json(root / "run/run.json")
            self.assertEqual(record["status"], "failed")
            self.assertEqual(record["attempts"], [])
            self.assertEqual(record["tracking"]["counts"]["model_turns"], 0)
            self.assertEqual(record["tracking"]["counts"]["render_attempts"], 1)
            self.assertEqual(record["tracking"]["stopping"]["reason"], "blocked")

    def test_last_round_failure_does_not_score_previous_success(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            def fake_render(source, output, *args):
                if "round_02" in str(output):
                    raise RuntimeError("final round failed")
                (output / "frames").mkdir(parents=True)
                (output / "frames/frame_000000.png").write_bytes(b"fake PNG")
                return {"backend": "test-double"}
            with patch("cinerecon_threejs.workflow.call_model", return_value={"scene_source": SOURCE, "report": "fixture"}), patch(
                    "cinerecon_threejs.workflow.render", side_effect=fake_render):
                with self.assertRaises(RuntimeError):
                    run(task, root / "run", "test", model="fixture", endpoint="https://example.invalid/api",
                        execute=True, rounds=2)
            self.assertEqual(read_json(root / "run/run.json")["status"], "failed")
            self.assertFalse((root / "run/reconstruction.mp4").exists())

    def test_generation_coverage_includes_failed_and_unstarted_cases(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            planned = []
            for config in ("model_a", "model_b"):
                for video in ("video1", "video2"):
                    planned.append({"configuration": config, "level": "L1", "video_id": video})
            save(root / "batch-plan.json", {"runs": planned})
            for config, video, status in (("model_a", "video1", "success"),
                                          ("model_a", "video2", "failed"),
                                          ("model_b", "video1", "success")):
                folder = root / config / video
                folder.mkdir(parents=True)
                (folder / "reconstruction.mp4").write_bytes(b"fixture")
                save(folder / "run.json", dict(configuration=config, level="L1", video_id=video,
                    status=status, origin="live_model", protocol=PROTOCOL, model=config,
                    generated_sha256=sha(folder / "reconstruction.mp4")))
            result = export_cases(root, root / "cases.json", common_only=True)
            self.assertEqual(result["cases"], 2)
            coverage = read_json(root / "cases.generation.json")
            self.assertEqual(coverage["expected_runs"], 4)
            self.assertEqual(coverage["successful_runs"], 2)
            self.assertEqual([r["status"] for r in coverage["runs"]].count("not_started"), 1)
            self.assertEqual([r["status"] for r in coverage["runs"]].count("failed"), 1)
            self.assertEqual(coverage["shared_successful_cases"], [{"level": "L1", "video_id": "video1"}])

    def test_export_rejects_mixed_models_within_configuration(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for index in (1, 2):
                folder = root / str(index)
                folder.mkdir()
                (folder / "reconstruction.mp4").write_bytes(b"fixture")
                save(folder / "run.json", dict(configuration="same", level="L1", video_id=f"video{index}",
                    status="success", origin="live_model", protocol=PROTOCOL, model=f"different_{index}",
                    generated_sha256=sha(folder / "reconstruction.mp4")))
            with self.assertRaisesRegex(ValueError, "Mixed model"):
                export_cases(root, root / "cases.json")

    def test_external_http_and_embedded_credentials_rejected(self):
        for endpoint in ("http://example.com/model", "https://user:password@example.com/model"):
            with self.assertRaises(ValueError):
                call_model(endpoint, {})

    def test_malformed_credentials_are_rejected_without_echo(self):
        with patch.dict("os.environ", {"CINERECON_GENERATOR_API_KEY": "SECRET\nvalue"}):
            with self.assertRaisesRegex(ValueError, "Invalid generator credential format") as error:
                call_model("https://example.invalid/api", {})
            self.assertNotIn("SECRET", str(error.exception))

    def test_batch_rejects_duplicates_before_any_execution(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path, _ = task_at(root / "task")
            row = dict(task="task/task.json", configuration="test", model="vision")
            save(root / "batch.json", {"runs": [row, row]})
            with patch("cinerecon_threejs.cli.run") as runner:
                with self.assertRaisesRegex(ValueError, "Duplicate"):
                    batch(root / "batch.json", root / "runs")
                runner.assert_not_called()

    def test_changed_api_candidate_counts_once_and_token_usage_is_recorded(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            def fake_render(source, output, *args):
                (output / "frames").mkdir(parents=True)
                (output / "frames/frame_000000.png").write_bytes(b"PNG")
                for name in ("reconstruction.mp4", "scene.json", "renderer-metadata.json"):
                    (output / name).write_text("{}")
                return {}
            responses = [{"choices": [{"finish_reason": "stop", "message": {"content": json.dumps({
                "scene_source": SOURCE + suffix, "report": "test"})}}],
                "usage": {"prompt_tokens": 3, "completion_tokens": 5, "total_tokens": 8}}
                for suffix in ("", "\n// revised")]
            with patch("cinerecon_threejs.workflow.call_model", side_effect=responses), patch(
                    "cinerecon_threejs.workflow.render", side_effect=fake_render):
                result = run(task, root / "run", "test", model="fixture", endpoint="https://example.invalid/api",
                             execute=True, rounds=2)
            self.assertEqual(result["tracking"]["counts"]["scene_revisions"], 1)
            self.assertEqual(result["tracking"]["token_usage"], {"input_tokens": 6, "output_tokens": 10, "total_tokens": 16})
            first_result = next(event["data"] for event in RunTracker(root / "run/tracking").events()
                                if event["kind"] == "model_result")
            self.assertEqual(first_result["evidence"]["response_sha256"], sha(root / "run/round_01/response.json"))

    def test_failed_api_request_still_counts_initiated_turn_without_fake_response(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            task, _ = task_at(root / "task")
            with patch("cinerecon_threejs.workflow.call_model", side_effect=RuntimeError("transport failed")), patch(
                    "cinerecon_threejs.workflow.render", return_value={}):
                with self.assertRaisesRegex(RuntimeError, "transport failed"):
                    run(task, root / "run", "test", model="fixture", endpoint="https://example.invalid/api", execute=True)
            tracking = read_json(root / "run/run.json")["tracking"]
            self.assertEqual(tracking["counts"]["model_turns"], 1)
            self.assertEqual(tracking["counts"]["provider_responses"], 0)
            self.assertEqual(tracking["pending_model_turns"], [])
            self.assertEqual(tracking["stopping"]["reason"], "blocked")

    def test_provider_refusal_and_invalid_response_are_received_but_not_completed(self):
        for raw, expected in (({"choices": [{"message": {"refusal": "no"}}]}, "refused"),
                              ({"choices": [{"finish_reason": "length"}]}, "invalid_response"),
                              (["not an object"], "invalid_response")):
            with self.subTest(expected=expected, raw=raw), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                task, _ = task_at(root / "task")
                with patch("cinerecon_threejs.workflow.call_model", return_value=raw), patch(
                        "cinerecon_threejs.workflow.render", return_value={}):
                    with self.assertRaises((ValueError, PermissionError)):
                        run(task, root / "run", "test", model="fixture", endpoint="https://example.invalid/api", execute=True)
                tracker = RunTracker(root / "run/tracking")
                result = next(event["data"] for event in tracker.events() if event["kind"] == "model_result")
                self.assertEqual(result["outcome"], expected)
                self.assertTrue(result["response_received"])
                self.assertEqual(tracker.summary()["counts"]["provider_responses"], 1)
                self.assertEqual(tracker.summary()["pending_model_turns"], [])

    def test_malformed_http_payload_counts_received_response(self):
        for error in (json.JSONDecodeError("invalid payload", "{", 1),
                      UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid byte")):
            with self.subTest(error=type(error).__name__), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                task, _ = task_at(root / "task")
                with patch("cinerecon_threejs.workflow.call_model", side_effect=error), patch(
                        "cinerecon_threejs.workflow.render", return_value={}):
                    with self.assertRaises(type(error)):
                        run(task, root / "run", "test", model="fixture", endpoint="https://example.invalid/api", execute=True)
                tracker = RunTracker(root / "run/tracking")
                result = next(event["data"] for event in tracker.events() if event["kind"] == "model_result")
                self.assertEqual(result["outcome"], "invalid_response")
                self.assertTrue(result["response_received"])
                self.assertEqual(tracker.summary()["counts"]["provider_responses"], 1)
                self.assertEqual(tracker.summary()["pending_model_turns"], [])


class TrackingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "scene.mjs"
        self.source.write_text(SOURCE)

    def tracker(self, **kwargs):
        return RunTracker.create(self.root / "tracking", run_id="test-native",
                                 provenance={"protocol": "native-continuation"}, **kwargs)

    def completed_turn(self, tracker):
        turn = tracker.model_turn()
        tracker.model_result(turn)
        return turn

    def rendered(self, tracker):
        attempt = tracker.render_attempt()
        tracker.render_result(attempt)
        return attempt

    def baseline(self, rendered=True):
        result = {"scene_sha256": scene_hash(self.source),
                  "counts": {"initial_generations": 1, "scene_revisions": 0, "render_attempts": 1},
                  "provenance": {"run_id": "original", "response_sha256": "0" * 64}}
        if rendered:
            result["render"] = {"outcome": "succeeded", "evidence": {"artifact": "baseline/render.mp4"}}
        return result

    def test_continuation_preserves_baseline_and_counts_changed_complete_candidates(self):
        tracker = self.tracker(baseline=self.baseline())
        turn = self.completed_turn(tracker)
        tracker.scene(self.source, turn_sequence=turn)  # Existing baseline is not another generation.
        tracker.decision("inspect", turn_sequence=turn)
        second = self.completed_turn(tracker)
        self.source.write_text(SOURCE + "\n// a complete changed candidate")
        tracker.scene(self.source, turn_sequence=second)
        tracker.scene(self.source, turn_sequence=second)  # Identical re-recording is not a revision.
        tracker.decision("render", turn_sequence=second)
        self.rendered(tracker)
        third = self.completed_turn(tracker)
        tracker.decision("submit", turn_sequence=third)
        tracker.stop("model_submit")
        summary = tracker.summary()
        self.assertEqual(summary["counts"], dict(initial_generations=0, scene_revisions=1,
            inspection_only_decisions=2, render_attempts=1, infrastructure_retries=0, model_turns=3, provider_responses=0))
        self.assertEqual(summary["baseline"]["counts"]["initial_generations"], 1)
        self.assertEqual(summary["total_counts"]["initial_generations"], 1)
        self.assertEqual(summary["total_counts"]["scene_revisions"], 1)
        self.assertEqual(summary["total_counts"]["render_attempts"], 2)
        self.assertIsNone(summary["total_counts"]["model_turns"])
        self.assertEqual(summary["model_turns_by_interface"], {"native_orchestration": 3, "provider_api": 0})
        self.assertEqual(summary["current_scene_sha256"], scene_hash(self.source))
        self.assertEqual(summary["stopping"]["reason"], "model_submit")

    def test_initial_generation_and_return_to_previous_hash_are_counted(self):
        tracker = self.tracker()
        for suffix in ("", "\n// second", ""):
            turn = self.completed_turn(tracker)
            self.source.write_text(SOURCE + suffix)
            tracker.scene(self.source, turn_sequence=turn)
        self.assertEqual(tracker.summary()["counts"]["initial_generations"], 1)
        self.assertEqual(tracker.summary()["counts"]["scene_revisions"], 2)

    def test_infrastructure_retries_do_not_count_as_scene_revisions(self):
        tracker = self.tracker(baseline=self.baseline())
        attempt = tracker.render_attempt()
        tracker.render_result(attempt, outcome="infrastructure_failed")
        tracker.infrastructure_retry(attempt, reason="Browser unavailable; retry on repaired host")
        with self.assertRaisesRegex(ValueError, "already started"):
            tracker.infrastructure_retry(attempt, reason="Duplicate start")
        self.rendered(tracker)
        counts = tracker.summary()["counts"]
        self.assertEqual(counts["scene_revisions"], 0)
        self.assertEqual(counts["render_attempts"], 2)
        self.assertEqual(counts["infrastructure_retries"], 1)
        with self.assertRaisesRegex(ValueError, "failed infrastructure"):
            tracker.infrastructure_retry(1, reason="Invalid unrelated transport recovery")

    def test_submit_requires_rendered_current_hash(self):
        tracker = self.tracker(baseline=self.baseline())
        turn = self.completed_turn(tracker)
        self.source.write_text(SOURCE + "\n// unrendered")
        tracker.scene(self.source, turn_sequence=turn)
        with self.assertRaisesRegex(ValueError, "successful render"):
            tracker.decision("submit", turn_sequence=turn)
        attempt = tracker.render_attempt()
        with self.assertRaisesRegex(ValueError, "successful render"):
            tracker.decision("submit", turn_sequence=turn)
        tracker.render_result(attempt, outcome="scene_failed")
        with self.assertRaisesRegex(ValueError, "successful render"):
            tracker.decision("submit", turn_sequence=turn)
        self.rendered(tracker)
        tracker.decision("submit", turn_sequence=turn)
        tracker.stop("model_submit")

    def test_successful_baseline_can_be_submitted_but_latest_failed_render_blocks_it(self):
        tracker = self.tracker(baseline=self.baseline())
        turn = self.completed_turn(tracker)
        tracker.decision("submit", turn_sequence=turn)
        attempt = tracker.render_attempt()
        tracker.render_result(attempt, outcome="infrastructure_failed")
        with self.assertRaisesRegex(ValueError, "successful render"):
            tracker.stop("model_submit")

    def test_baseline_render_needs_explicit_evidence(self):
        tracker = self.tracker(baseline=self.baseline(rendered=False))
        turn = self.completed_turn(tracker)
        with self.assertRaisesRegex(ValueError, "successful render"):
            tracker.decision("submit", turn_sequence=turn)

    def test_return_to_old_render_requires_rendering_the_current_candidate_again(self):
        tracker = self.tracker()
        turn = self.completed_turn(tracker)
        tracker.scene(self.source, turn_sequence=turn)
        self.rendered(tracker)
        self.source.write_text(SOURCE + "\n// second")
        tracker.scene(self.source, turn_sequence=turn)
        self.rendered(tracker)
        self.source.write_text(SOURCE)
        tracker.scene(self.source, turn_sequence=turn)
        with self.assertRaisesRegex(ValueError, "latest successful render"):
            tracker.decision("submit", turn_sequence=turn)
        self.rendered(tracker)
        tracker.decision("submit", turn_sequence=turn)
        tracker.stop("model_submit")

    def test_baseline_submit_and_elapsed_time_use_observed_not_recorded_timestamps(self):
        tracker = self.tracker(baseline=self.baseline(), started_at="2026-10-15T16:35:00Z")
        turn = tracker.model_turn(observed_at="2026-10-15T16:36:06Z")
        tracker.model_result(turn, observed_at="2026-10-15T16:37:00Z")
        tracker.decision("submit", turn_sequence=turn, observed_at="2026-10-15T16:37:00Z")
        tracker.stop("model_submit", observed_at="2026-10-15T16:38:00Z")
        self.assertEqual(tracker.summary()["elapsed_seconds"], 180)
        self.assertNotEqual(tracker.events()[0]["recorded_at"], tracker.events()[0]["observed_at"])

    def test_native_usage_stays_unknown_and_tool_reports_are_labeled(self):
        tracker = self.tracker()
        turn = tracker.model_turn()
        tracker.model_result(turn, native_tool_calls={"count": 7, "source": "self_reported"})
        second = tracker.model_turn()
        tracker.model_result(second, usage={"input_tokens": 5, "output_tokens": 6, "total_tokens": 11})
        summary = tracker.summary()
        self.assertIsNone(summary["token_usage"]["total_tokens"])
        self.assertEqual(summary["known_token_usage"]["total_tokens"], 11)
        self.assertEqual(summary["native_tool_calls"]["self_reported"],
                         {"known_count": 7, "total_count": None, "reported_turns": 1})
        self.assertIsNone(summary["native_tool_calls"]["runtime"]["known_count"])

    def test_invalid_usage_unknown_references_and_duplicate_results_fail_without_append(self):
        tracker = self.tracker()
        turn = tracker.model_turn()
        for usage in ({"total_tokens": -1}, {"total_tokens": True}, {"nonsense": 1}):
            with self.assertRaisesRegex(ValueError, "token usage"):
                tracker.model_result(turn, usage=usage)
        with self.assertRaisesRegex(ValueError, "Native tool counts"):
            tracker.model_result(turn, native_tool_calls={"count": 3})
        with self.assertRaisesRegex(ValueError, "Unknown"):
            tracker.model_result(999)
        tracker.model_result(turn)
        with self.assertRaisesRegex(ValueError, "already completed"):
            tracker.model_result(turn)
        self.assertEqual(tracker.summary()["event_count"], 3)

    def test_reopen_is_durable_and_stopped_history_is_immutable_through_api(self):
        tracker = self.tracker()
        turn = tracker.model_turn()
        before = (self.root / "tracking/000001.json").read_bytes()
        reopened = RunTracker(self.root / "tracking")
        reopened.model_result(turn)
        reopened.stop("operational_safety_ceiling", detail="Safety deadline reached")
        self.assertEqual((self.root / "tracking/000001.json").read_bytes(), before)
        self.assertEqual(reopened.summary()["counts"]["model_turns"], 1)
        with self.assertRaisesRegex(ValueError, "stopped"):
            reopened.model_turn()
        with self.assertRaises(FileExistsError):
            self.tracker()

    def test_corruption_and_missing_middle_event_fail_closed(self):
        tracker = self.tracker()
        self.completed_turn(tracker)
        middle = self.root / "tracking/000002.json"
        original = middle.read_text()
        middle.write_text(original.replace("native_orchestration", "provider_api"))
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            RunTracker(self.root / "tracking")
        middle.unlink()
        with self.assertRaisesRegex(ValueError, "sequence"):
            RunTracker(self.root / "tracking")

    def test_failed_atomic_publish_leaves_prior_history_readable(self):
        tracker = self.tracker()
        head = tracker.summary()["head_sha256"]
        with patch("cinerecon_threejs.tracking.os.link", side_effect=FileExistsError("collision")):
            with self.assertRaises(FileExistsError):
                tracker.model_turn()
        self.assertEqual(tracker.summary()["head_sha256"], head)
        self.assertEqual(list((self.root / "tracking").glob(".event-*")), [])

    def test_summary_and_returned_events_cannot_mutate_saved_history(self):
        tracker = self.tracker(baseline=self.baseline())
        summary = tracker.summary()
        summary["baseline"]["counts"]["scene_revisions"] = 100
        events = tracker.events()
        events[0]["data"]["provenance"]["protocol"] = "changed"
        self.assertEqual(tracker.summary()["baseline"]["counts"]["scene_revisions"], 0)
        self.assertEqual(tracker.summary()["provenance"]["protocol"], "native-continuation")

    def test_baseline_unknown_fields_and_bad_counts_are_rejected(self):
        for key, value in (("scene_revisions", -1), ("model_turns", True), ("imagined", 1)):
            baseline = self.baseline()
            baseline["counts"][key] = value
            with self.assertRaisesRegex(ValueError, "baseline"):
                self.tracker(baseline=baseline)
        self.assertFalse((self.root / "tracking").exists())
        with self.assertRaises(ValueError):
            self.tracker(started_at="not a timestamp")
        self.assertFalse((self.root / "tracking").exists())

    def test_stop_without_model_decision_is_not_model_submit(self):
        tracker = self.tracker()
        with self.assertRaisesRegex(ValueError, "latest model turn"):
            tracker.stop("model_submit")
        tracker.stop("blocked", detail="Native execution unavailable")
        self.assertEqual(tracker.summary()["counts"], dict.fromkeys(COUNTERS, 0))


def read_json(path):
    return json.loads(path.read_text())


if __name__ == "__main__":
    unittest.main()
