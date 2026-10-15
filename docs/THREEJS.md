# CineRecon for Three.js

This fork adds a runnable **model-under-test → editable Three.js module → rendered full video → original CineRecon judge** workflow. Blender is not required for this backend. The original dataset, annotations, judge prompts, frame alignment, scoring, and Blender instructions remain available unchanged.

This is a **sampled-frame Three.js baseline**, not a reproduction of the published Blender agent protocol. It is suitable for comparing models under the same Three.js conditions. No real model results or leaderboard claims are bundled. See [implementation validation and remaining checks](THREEJS_VALIDATION.md).

## Install

Requirements: Python 3.10+, Node.js 20+, FFmpeg and FFprobe on PATH, and a Chromium browser with WebGL support. Run from the repository checkout; prompts and dataset stay in the checkout rather than inside the wheel.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
npm ci --prefix threejs --ignore-scripts
npx --prefix threejs playwright install chromium
# Alternatively, use an installed Chromium with --chromium /path/to/chromium.
```

The generation harness itself uses only the Python standard library. The original evaluator needs the Python dependencies above. Node dependencies are version-pinned in `threejs/package-lock.json`. On a clean Linux machine, Playwright's documented system dependencies may also be needed (`npx --prefix threejs playwright install --with-deps chromium`).

## First run, no credentials or model calls

```bash
python -m unittest discover -s tests -p test_threejs_workflow.py -v
npm test --prefix threejs
python examples/threejs_smoke.py --output runs/threejs-smoke \
  --chromium /usr/bin/chromium
```

Omit `--chromium` to use the Playwright-installed browser. The smoke test uses an authored animated scene as both a synthetic reference and an authored reconstruction, checks the full rendering/preparation path, and explicitly labels itself a smoke fixture. It does not measure a model. Add `--evaluate` to exercise the original evaluator with synthetic annotations and imported synthetic ratings, still with zero API calls. These synthetic ratings are parser/aggregation test fixtures, not quality judgments.

## Prepare a generation task

```bash
python -m cinerecon_threejs prepare \
  --reference media/reference/video1.mp4 --video-id video1 --level L1 \
  --samples 24 --output runs/threejs/tasks/video1/L1
```

Prepare separately for L1, L2, and L3. The task records the complete reference's frame count, rational FPS, resolution, duration, SHA-256, generation prompt, and 24 regularly spaced timestamped reference images, including the endpoints. Very short videos use every frame. It never reads evaluation annotations or their evidence-frame selections. The complete video remains local; the baseline API request receives the sampled images. Use the same sampling policy for every compared model.

Decoded per-frame presentation timestamps are checked, not merely the declared frame rates. Variable-frame-rate inputs are rejected. Container edit-list offsets are recorded and normalized to the first decoded frame, matching the original evaluator’s frame-zero convention; this does not shift content relative to decoded reference frames. Final rendering preserves the exact frame count, rational frame rate, resolution, and timeline. Unsupported dimensions or codecs fail rather than silently resizing or retiming.

## Preview and test a model

Choose a vision-capable model that supports OpenAI-compatible Chat Completions, image inputs, JSON-object responses, and `max_completion_tokens`. Provider/model capabilities vary. There is no default generation provider or model.

```bash
python -m cinerecon_threejs generate \
  --task runs/threejs/tasks/video1/L1/task.json \
  --configuration my_model_threejs_24frames_2rounds \
  --model YOUR_MODEL_ID \
  --endpoint https://api.openai.com/v1/chat/completions \
  --rounds 2 --max-tokens 16000 \
  --output runs/threejs/models/my_model/L1/video1 > request-preview.json
```

This only previews the request and budget. It does not create the run directory, contact a service, or render code. To execute the same command, set `CINERECON_GENERATOR_API_KEY` securely in your shell and append `--execute` (remove the preview redirection if desired). Never place keys in source, specs, prompts, or committed files. Live execution sends reference samples and, after the initial round, the preceding scene source and synchronized rendered samples to the explicitly selected provider. It may incur model charges. Generation and judging use separate keys and are separately opt-in.

The round count is a fixed budget including the initial request, not a promised quality threshold. Two rounds mean initial generation plus one visual refinement. Each response supplies a complete replacement module. A trusted offline renderer preflight must pass before the first model request. Scene-code failures can be repaired by the next remaining round; browser/encoder/host failures abort without spending additional calls. API errors and refusals stop the run; requests are not automatically retried. The final scheduled round is scored, without choosing a best round using labels. Keep token and round budgets equal across compared models. Provider sampling is not guaranteed deterministic; `seed` controls scene/render initialization, not model sampling.

### Multiple models / videos / levels

Copy `configs/threejs.batch.example.json` and fill in models and task paths. Each row identifies a prepared full-video task, configuration, model, endpoint, fixed round budget, token cap, and scene seed. Use one row per configuration/video/level. Paths resolve relative to the spec. Calls run sequentially, with failures recorded independently.

```bash
python -m cinerecon_threejs batch --spec configs/threejs.batch.example.json \
  --output runs/threejs/models
# Review first, then add --execute to make live requests.
```

Run directories are immutable. To retry a failed run, use a fresh directory; the harness never silently overwrites or reuses old model output. `batch-report.json` includes failures, and the command exits nonzero if any run fails. Missing and failed generations do not become zero scores.

### Bring your own agent or archived response

An external coding agent can inspect the complete reference and author the same scene-module API, while using the Three.js renderer for its own feedback loop. Record that distinct full-video/tool-using protocol separately from the bundled sampled-frame baseline.

For an archived response from a model, replace `--execute` with `--response-file response.json --rounds 1`. Accepted input is a Chat Completions response or the exact `{ "scene_source": "...", "report": "..." }` content object. Imports are labeled `imported_model_response` with `unverified_import` provenance and are excluded from benchmark export by default: a response file cannot prove which input, model, or budget produced it. Preserve original request/response provenance separately. Use `export-cases --include-unverified-imports` only after explicitly deciding to include such data, and disclose that provenance limitation. To render a hand-authored fixture use `--scene path/scene.mjs --rounds 1` instead. Authored fixture runs are excluded from exported model benchmark cases.

## Editable scene API

```javascript
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 2, 5);
  camera.lookAt(0, 0, 0);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(), new THREE.MeshNormalMaterial()
  );
  scene.add(mesh);
  return {
    scene, camera,
    update(time, frame) {
      mesh.rotation.y = time; // Absolute state, never += playback increments.
    }
  };
}
```

The supplied `THREE` namespace is pinned. One optional bare `import ... from 'three'` is supported; other packages, addons, network imports, and local assets are not. The harness owns WebGLRenderer. `update(time, frame)` must support repeated calls and backward seeking with stable scene/camera objects. Procedural geometry, materials, lights, articulation, and deterministic camera cuts are supported. Do not use timers, wall-clock time, unseeded randomness, reference-image planes, or screenshot playback.

A successful run contains:

```text
scene.mjs                   # Canonical editable geometry + animation source
scene.json                  # Three.js scene/camera snapshot; not an animation-source substitute
reconstruction.mp4          # Full-size, exact-timeline video used by original evaluator
report.md                   # Model-written notes, not independently verified quality claims
renderer-metadata.json      # Renderer/browser/configuration and verification details
run.json                    # Protocol, hashes, inputs, attempts, origin, status, token usage
round_01/ ... round_NN/     # Responses, request previews, sources, per-frame PNGs
```

## Evaluate with the existing CineRecon scoring

```bash
python -m cinerecon_threejs export-cases \
  --runs-root runs/threejs/models --output runs/threejs/cases.json
python -m cinerecon prepare-batch \
  --cases runs/threejs/cases.json --output runs/threejs/evaluation
python -m cinerecon judge --jobs-root runs/threejs/evaluation
```

Export checks the final video hash, rejects duplicate cases and mixed model/budget/sampling settings within a configuration, and omits failed runs, authored fixtures, and unverified imports by default. It also writes `cases.generation.json`, which preserves the expected generation cohort, failed/unstarted runs, settings, hashes, and per-configuration success counts. Batch plans are saved before execution so interrupted runs remain in that denominator. The original evaluator only sees exported successful videos; report generation coverage alongside quality scores. Use `export-cases --common-only` to score only the shared successful video/level intersection across configurations. The shared subset must also be disclosed; it does not erase generation failures. Preparation extracts all annotated evaluation clips from each complete reconstruction. It does not modify the renderer output. The last command previews judge requests locally. Only after separately authorizing judge costs, configure `CINERECON_API_KEY` and add `--execute`. Then use:

```bash
python -m cinerecon summarize \
  --jobs-root runs/threejs/evaluation --output runs/threejs/summary.json
```

The judge uses the same L1/L2/L3 requirements, dimensions, categories, missing-value handling, and aggregation as upstream. A configuration-wide overall score still requires all three levels. Keep generation and evaluation processes separate: never feed checklists, annotations, entity tables, or judge answers back into generation.

## Comparability and limitations

- Upstream supplies 50 videos and 360 evaluation clips. This fork retains those data and original licensing notices. Reference videos are **not MIT licensed**; rights remain with their owners, and the manifest marks redistribution review as pending. Check rights before redistributing videos or sending them to a model provider.
- Upstream gives an agent the complete video and Blender MCP tools. The bundled baseline uses uniformly sampled images and bounded API calls. Short events may fall between samples. These scores must be labeled with backend, input modality, sample count, model settings, and revision budget.
- Three.js WebGL rasterization, tone mapping, lighting, and material behavior differ from Cycles. Original imaging requirements remain scoring targets, but no renderer parity is implied.
- This initial runtime intentionally supports one procedural source module. It does not bundle a general-purpose agent framework, asset downloads, GLTF imports, postprocessing addons, or a tool-call server. `scene.json` captures inspectable geometry/materials at a sampled time; `scene.mjs` preserves the actual animation logic.
- The evaluator judges video evidence. It does not independently enforce mesh editability, level complexity, contact physics, or prohibition of reference replay. Those remain protocol requirements requiring source audit.
- No paid generation or judging was performed during implementation. The offline demo validates plumbing, not model ability. Record device/browser/library versions for reproducibility; exact image hashes across different GPUs are not promised.

## Security and operational boundaries

Generated JavaScript is untrusted. It is loaded only in a fresh Chromium context, never imported into Node or Python. The loopback server exposes a small explicit route allowlist, not repository contents or reference media. External requests and service workers are blocked. Generator API credentials are stripped from the rendering subprocess environment. **These controls are defense in depth, not a secure arbitrary-code sandbox.** Run unfamiliar model code in a disposable OS/container sandbox without secrets, host filesystem mounts, or network privileges. Browser security flags should not be weakened to run it on your everyday signed-in browser.

Absolute-time/determinism conformance of arbitrary generated source is recorded as unaudited; source review is still necessary. The runtime has bounded per-frame operations and the Python controller imposes an overall timeout. Rendering every reference frame can consume substantial time and disk; per-round PNGs are retained for audit. Inspect and remove old run directories explicitly when no longer needed. Model HTTP requests do not follow redirects; HTTPS is mandatory except explicit loopback testing. Neither generation nor judge credentials are saved.

Reference APIs: [Three.js WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer), [Playwright BrowserContext](https://playwright.dev/docs/api/class-browsercontext), [Chat Completions](https://developers.openai.com/api/reference/resources/chat).
