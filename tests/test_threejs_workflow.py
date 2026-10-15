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


def read_json(path):
    return json.loads(path.read_text())


if __name__ == "__main__":
    unittest.main()
