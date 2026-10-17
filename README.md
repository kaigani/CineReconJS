# CineReconJS

**Test vision models by asking them to reconstruct video as editable, animated Three.js scenes.**

CineReconJS adapts [CineRecon](https://github.com/Unc1eW4ng/CineRecon) into a JavaScript/WebGL reconstruction benchmark. A model receives timestamped reference images, writes a Three.js scene module, and refines that module using rendered feedback. Headless Chromium renders the full animation; the resulting video can be exported to CineRecon's original evaluation pipeline.

The Three.js workflow requires no Blender installation or Blender MCP server. It retains CineRecon's reference videos, L1/L2/L3 representation targets, annotations, and scoring code, while defining a separate **sampled-frame generation protocol**: `cinerecon-threejs-sampled-v1`.

[Quickstart](#quickstart) · [Model comparisons](#compare-models) · [Scene API](#the-threejs-scene-contract) · [Revision tracking](#track-revisions-and-stopping) · [Full guide](docs/THREEJS.md) · [Validation](docs/THREEJS_VALIDATION.md)

## How the benchmark works

```text
Complete reference video
  → generation-only frame sampling + L1/L2/L3 prompt
  → model returns scene.mjs + reconstruction report
  → Three.js renders every frame in headless Chromium
  → synchronized render feedback or scene errors → bounded model revision
  → final scene, full-length MP4, and provenance
  → export successful videos for the original CineRecon judge
```

1. **Prepare the input.** Read the reference's exact resolution, rational frame rate, frame count, and decoded timestamps. Sample uniformly across the complete timeline, including its endpoints. Generation never reads evaluation annotations or their evidence-frame selections.
2. **Generate editable code.** A vision-capable model returns a single JavaScript module defining geometry, materials, lighting, an animated camera, and object motion. L1/L2/L3 set the representation fidelity; they are not model reasoning-effort settings.
3. **Render and refine.** The host advances the scene at explicit frame times and encodes a verified full-length MP4. The provided API harness uses a fixed request budget, including the initial request; two rounds allow one generation and one refinement request. Each remaining round supplies the previous source plus matching reference/render samples, or a scene error. A separately recorded native-agent controller can instead let the model inspect, revise, and explicitly choose when to submit.
4. **Record the result.** The API harness exports the final scheduled round without selecting a best round using evaluation labels. Native-agent experiments separately record model submission or an operational stop. Source changes, inspection-only decisions, render attempts, retries, responses, hashes, runtime versions, and failures remain available for inspection.
5. **Evaluate separately.** Export complete reconstructed videos to the unchanged CineRecon judge, which selects annotated clips, aligns evidence, and reports camera, static, and dynamic scores. Generation and judging are separate opt-in model costs.

### Representation levels

| Level | Three.js reconstruction target |
|---|---|
| **L1 · Proxy** | Simple geometric proxies that preserve subjects, proportions, spatial relations, articulation, contacts, motion, and camera timing. |
| **L2 · Simplified** | Low-complexity but recognizable subjects, silhouettes, important components, materials, and articulated actions. |
| **L3 · Detailed** | Instance-specific geometry, appearance, actions, and visible imaging characteristics, within the runtime's supported capabilities. |

The level-specific [Three.js prompts](prompts/reconstruction/threejs/en/) define the full contract. All levels reconstruct the whole sequence, including intervals between sampled inputs.

## Quickstart

### 1. Install

Use a Linux or macOS shell with:

- Python **3.10+** and Node.js **20+**.
- **FFmpeg and ffprobe** on `PATH`, with H.264/libx264 encoding support.
- A Chromium environment that supports WebGL and Chromium's sandbox. Playwright can install its pinned browser and required Linux system libraries.

The CI-verified environment is Ubuntu 22.04, Python 3.12, and Node.js 22. Node dependencies are pinned to Three.js `0.180.0` and Playwright `1.56.1` in the lockfile.

```bash
git clone https://github.com/kaigani/CineReconJS.git
cd CineReconJS
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
npm ci --prefix threejs --ignore-scripts
(cd threejs && npx playwright install chromium)
```

On a clean Linux machine, use `(cd threejs && npx playwright install --with-deps chromium)` if browser system dependencies are missing; installing those libraries may require administrator privileges. FFmpeg/ffprobe must be installed separately. Run commands from the repository root: prompts and data live in the checkout, not in the Python wheel.

### 2. Verify rendering without a model or API key

```bash
python examples/threejs_smoke.py --output runs/threejs-smoke
```

This creates a short animated Three.js reference, prepares sampled inputs, renders an authored reconstruction, and verifies the resulting video. It is a **synthetic pipeline check**, not a model result. The default smoke does not execute the original evaluator.

Use a fresh output directory for each run. To select an existing browser, append `--chromium /absolute/path/to/chromium`. Optional authored test suites:

```bash
python -m unittest discover -s tests -p test_threejs_workflow.py -v
CINERECON_BROWSER_TESTS=1 npm test --prefix threejs
```

Without `CINERECON_BROWSER_TESTS=1`, the Node suite deliberately skips browser integration tests. A skipped browser test does not verify rendering.

### 3. Prepare a reference video

The inherited dataset contains 50 complete reference videos and 360 annotated evaluation clips. The benchmark generates one complete reconstruction per video and representation level, not a separate scene for each evaluation clip.

```bash
python -m cinerecon_threejs prepare \
  --reference media/reference/video1.mp4 \
  --video-id video1 --level L1 --samples 24 \
  --output runs/threejs/tasks/video1/L1
```

This writes a hashed `task.json`, a resolved generation prompt, and timestamped reference images. The model receives the sampled images rather than the entire video file; samples are downscaled for input, but the final reconstruction must match the source resolution and full timeline. Prepare separate tasks for L2 and L3. See [reference media and rights](#upstream-attribution-and-license) before sending dataset images to a provider.

### 4. Preview a model run

Choose a vision model and an explicit OpenAI-compatible Chat Completions endpoint supporting image inputs, JSON-object responses, and `max_completion_tokens`. Provider support varies; there is no default generation model or provider.

```bash
python -m cinerecon_threejs generate \
  --task runs/threejs/tasks/video1/L1/task.json \
  --configuration my_model_threejs_24frames_2rounds \
  --model YOUR_VISION_MODEL_ID \
  --endpoint https://api.openai.com/v1/chat/completions \
  --rounds 2 --max-tokens 16000 --seed 0 \
  --output runs/threejs/models/my_model/L1/video1 \
  > request-preview.json
```

**This command only previews the request and call budget.** It does not contact a model, render generated code, or create the run directory. Replace the example endpoint if using another compatible provider.

Before executing model-generated code, prepare the [disposable isolation boundary](threejs/README.md#security-boundary); the harness does not create a container or VM for you. To make a live run, securely set `CINERECON_GENERATOR_API_KEY`, remove the preview redirection, and append `--execute`. This sends reference images and subsequent revision feedback to the selected provider and may incur charges. Never commit credentials. A trusted renderer preflight runs before the first model request; infrastructure failures abort instead of consuming additional scene-repair calls. API errors and refusals stop without automatic retries.

The `seed` controls scene/render initialization, not provider-side model sampling. See the [full generation guide](docs/THREEJS.md) for archived-response imports and custom agents.

## Track revisions and stopping

Every executed API-harness run now maintains a hash-linked `tracking/` event ledger and a summary in `run.json`. Custom native controllers can use the same observation API. The [counting rules and controller example](docs/RUN_TRACKING.md) distinguish:

- Initial generation from changed complete scene candidates (revisions).
- Inspection-only decisions, including submission without another source change.
- Render attempts from infrastructure retries and transport-only downloads.
- Observable native-agent turns from provider API responses; unavailable internal inference counts and tokens remain unknown.

A successful render is not a quality score. `model_submit`, fixed-budget completion, an operational safety ceiling, and a blocked run are different stopping reasons. Continuations keep the original baseline's counters and source separate rather than counting it as a new generation.

### Recorded Astra experiment

The [first-pass Astra baseline](examples/astra_baseline/) preserves one native `gpt-6-astra` generation of `video1` at L1 from 24 timestamped reference frames. The [goal-directed continuation](examples/astra_iterative/) preserves matching render feedback, every scene revision, explicit decisions, checksums, and the current/final tracking summary. Each successful scene covers all 384 frames at 1910×1080 and 24000/1001 FPS. No evaluator annotations or human quality critique are supplied to the generating model.

These are native sampled-frame experiments with their own provenance, not API-harness leaderboard entries or paper-equivalent scores. Their records identify the actual stopping condition, known counters, missing token telemetry, and the operational safety ceiling. The original evaluator and paid judge were not run.

### Results gallery

The [`site/`](site/) directory is a static results page: a side-by-side summary of the native Opus 5.5 L1 cohort (all 50 videos) and the Astra `video1` run, plus a gallery where every reference video can be played in sync with each model's final reconstruction, with per-revision frames, the model's own round notes, and the final `scene.mjs`. It reports run statistics only; no judge scores are claimed. Rebuild its generated data and web-sized media from preserved runs with `python examples/opus_native/build_site.py --astra-artifact <dir>`, and preview with `python -m http.server --directory site`. `.github/workflows/pages.yml` deploys it to GitHub Pages (repository Settings → Pages → Source: GitHub Actions).

## Compare models

Copy [the batch example](configs/threejs.batch.example.json) within `configs/`, then replace its model IDs and endpoints. Each row selects a prepared task, configuration, model, endpoint, round budget, token cap, and scene seed. Task paths are relative to the spec file. Add one row per model configuration, video, and level.

```bash
cp configs/threejs.batch.example.json configs/my_threejs_batch.json
# Edit configs/my_threejs_batch.json before running.
python -m cinerecon_threejs batch \
  --spec configs/my_threejs_batch.json --output runs/threejs/models
```

Batch mode previews by default. Add `--execute` only after reviewing the matrix and costs. Runs execute sequentially. Use a new output root for a new trial; run directories and the saved batch plan are immutable.

For a fair Three.js comparison:

- Use the same reference cohort, representation levels, sampling policy, token cap, round budget, and runtime versions for every model.
- Give each configuration a distinct name. Export rejects duplicate video/level cases and mixed model, protocol, budget, or sampling settings within one configuration.
- Report generation success/failure coverage alongside judged quality. A failed or unstarted generation is not silently converted to a zero quality score.
- Keep reference annotations, checklist answers, and judge outputs out of generation and refinement.

After successful live runs, export evaluator inputs:

```bash
python -m cinerecon_threejs export-cases \
  --runs-root runs/threejs/models \
  --output runs/threejs/cases.json --common-only
```

`--common-only` selects the shared successful video/level intersection across configurations. Omit it to export all successes, and disclose the resulting unequal coverage. The companion `cases.generation.json` records the expected cohort, failed/unstarted runs, settings, hashes, and export selection. Preserve and report it with the quality summary; a shared-success subset does not erase generation failures.

Authored fixtures are always excluded from model-case exports. Archived model responses have `unverified_import` provenance and are excluded by default; `--include-unverified-imports` is an explicit opt-in, not proof of the response's model, inputs, or budget. The synthetic quickstart therefore does not produce a model leaderboard.

### Evaluate exported videos

**Integration status:** the following commands use the retained original evaluator. Its source and input contract have been inspected, but original upstream Python regression tests, the dataset validator, and end-to-end evaluator integration have not been executed during this adaptation; that validation remains pending execution permission. The passing Three.js smoke covers generation/rendering only.

```bash
python -m cinerecon prepare-batch \
  --cases runs/threejs/cases.json --output runs/threejs/evaluation
python -m cinerecon judge --jobs-root runs/threejs/evaluation
```

Preparation creates aligned reference/render evidence for all applicable annotated clips. `judge` without `--execute` previews requests locally. The inherited judge defaults to OpenRouter with `openai/gpt-5.6-sol`; it is distinct from the model under test. Review [the evaluation protocol and provider settings](docs/EVALUATION.md) before making paid calls. Live judging separately requires `CINERECON_API_KEY` and `--execute`; generation credentials do not enable it.

After judge results exist, aggregate them:

```bash
python -m cinerecon summarize \
  --jobs-root runs/threejs/evaluation --output runs/threejs/summary.json
```

The original aggregation uses camera, static, and dynamic dimensions and L1/L2/L3 settings. A configuration-wide overall score requires all three levels; missing required dimensions or levels remain `null`. Preserve generation coverage and evaluation coverage alongside every reported score.

## The Three.js scene contract

The model returns a JSON object with exactly two string fields: `scene_source` and `report`. `scene_source` is a single ES module. Both its exported `createScene` factory and returned `update(time, frame)` function must be synchronous:

```javascript
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 0, 0);
  const subject = new THREE.Mesh(
    new THREE.BoxGeometry(), new THREE.MeshNormalMaterial()
  );
  subject.name = 'Subject';
  scene.add(subject);
  return {
    scene, camera,
    update(time, frame) {
      subject.rotation.y = time; // Absolute state, not a playback increment.
    }
  };
}
```

This small example illustrates the API, not a reconstruction of a dataset video. The runtime supplies Three.js and owns the renderer. Generated code creates editable scene objects and updates geometry, joints, camera transforms, and shot changes from absolute time. It must not create its own render loop or use `requestAnimationFrame`.

The host samples frames `0` through `frames - 1` at exact rational intervals, saves full-resolution PNGs, and encodes H.264. It verifies dimensions, frame count, frame rate, duration, and every encoded frame timestamp. Rendering uses fixed sRGB/ACES settings and software WebGL via SwiftShader. See [renderer setup, API, and security](threejs/README.md).

Successful generation outputs include:

```text
run.json                  # model, task, budgets, hashes, status, and attempts
scene.mjs                 # editable scene and animation source
scene.json                # geometry/material/camera snapshot at frame zero
report.md                 # model's reconstruction report
reconstruction.mp4        # full reference-length, exact-timeline render
renderer-metadata.json    # runtime versions and frame hashes
round_01/, round_02/, ...  # request previews, responses, sources, rendered frames
tracking/                 # immutable, hash-linked observation events
```

`scene.json` does not serialize JavaScript animation functions; keep `scene.mjs` to reproduce motion. Output directories can be large because each round retains every rendered frame.

## Architecture and documentation

| Path | Role |
|---|---|
| [`cinerecon_threejs/`](cinerecon_threejs/) | Python preparation, model requests, bounded refinement, batch execution, and evaluator export. |
| [`cinerecon_threejs/tracking.py`](cinerecon_threejs/tracking.py), [tracking guide](docs/RUN_TRACKING.md) | Revision, inspection, render, retry, usage, and stopping evidence. |
| [`examples/astra_iterative/`](examples/astra_iterative/) | Preserved native Astra continuation, decisions, and per-revision provenance. |
| [`threejs/`](threejs/) | Node host, restricted loopback server, Chromium/WebGL runtime, encoding, and verification. |
| [`prompts/reconstruction/threejs/en/`](prompts/reconstruction/threejs/en/) | Three.js-specific L1/L2/L3 generation contracts. |
| [`configs/threejs.batch.example.json`](configs/threejs.batch.example.json) | Multi-model generation matrix example. |
| [`examples/threejs_smoke.py`](examples/threejs_smoke.py) | No-API authored pipeline demo; optional evaluator fixture is separate. |
| [`tests/test_threejs_workflow.py`](tests/test_threejs_workflow.py), [`threejs/test/`](threejs/test/) | Authored harness, encoding, browser, and failure-policy tests. |
| [`cinerecon/`](cinerecon/), [`prompts/evaluation/en/`](prompts/evaluation/en/) | Retained original video evaluator and judge prompts. |
| [`data/`](data/), [`media/reference/`](media/reference/) | Original manifest, annotations, and reference videos. |

Start with the [full Three.js workflow](docs/THREEJS.md), [renderer reference](threejs/README.md), [dataset specification](docs/DATASET.md), and [evaluation protocol](docs/EVALUATION.md). [Original Blender generation documentation](docs/GENERATION.md) is retained for upstream context; it is not the CineReconJS setup guide.

## Validation and current limits

[CI run 38772744297](https://github.com/kaigani/CineReconJS/actions/runs/38772744297) passed on tracking commit `126ed2d052bcf18b4907e3bfbc22d060b2681031`:

- **41 Python harness/tracking tests** and **26 Node/browser tests**, with zero browser skips.
- Real Chromium rendering, repeated-render PNG hash equality, exact rational video timestamps, and negative scene/network-policy tests.
- The complete authored generation smoke with **zero API calls**.

All 50 reference videos were also independently decoded and checked against their manifest hashes during implementation. See [validation details and unexecuted checks](docs/THREEJS_VALIDATION.md). The native Astra source/decision experiments are linked above; **no paid judge results or benchmark quality scores are claimed**. Their successful render jobs establish execution and exact video timing, not reconstruction quality.

Important boundaries:

- **Cross-backend scores are not protocol-equivalent.** Upstream's Blender agent sees the complete video and uses tools; the API-harness baseline sends sampled images through bounded API calls. Short events can fall between samples, and WebGL imaging differs from Cycles. Report the backend, input sampling, and budgets; do not relabel Blender rankings as Three.js results.
- **This is a procedural single-module runtime.** External assets/imports, GLTF loaders, postprocessing addons, and a general-purpose tool-using agent are not bundled. A custom agent can target the scene API, but its protocol must be recorded separately.
- **Deterministic scheduling is not universal pixel determinism.** Software/platform changes and nonconforming source can affect results. Arbitrary generated source is marked unaudited; source review is needed for absolute-time motion, editability, representation requirements, and prohibitions on reference replay. The video judge does not establish those properties.
- **Generated JavaScript is untrusted.** Run it in a disposable OS/container sandbox without secrets or sensitive mounts, with resource limits and outbound networking disabled at that boundary. Chromium sandboxing, route restrictions, credential stripping, and timeouts are defense in depth, not a secure arbitrary-code sandbox. Do not weaken your everyday browser's security to run generated scenes.

## Upstream attribution and license

CineReconJS builds on [Unc1eW4ng/CineRecon](https://github.com/Unc1eW4ng/CineRecon), starting from upstream commit [`1d850319`](https://github.com/Unc1eW4ng/CineRecon/tree/1d850319c9cfcafca92c87a0a279edff4758f468). Credit the CineRecon contributors for the original dataset, annotations, representation requirements, and evaluation implementation. The original evaluator, annotations, evaluation prompts, and reference media are retained unchanged by this adaptation.

Project-authored code, documentation, prompts, and annotations are covered by the [MIT License](LICENSE). **Reference videos and other third-party media are excluded from that license.** Copyright remains with their respective rights holders, and upstream notes that redistribution permissions remain under review. Review applicable rights before redistributing media or transmitting reference images to model providers. See [reference-media availability](docs/DATASET.md#reference-media).
