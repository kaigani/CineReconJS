# Three.js implementation validation

Status as of 2026-10-15, based on upstream commit `1d850319c9cfcafca92c87a0a279edff4758f468`.

## Passed in GitHub Actions

[Run 38677604750](https://github.com/kaigani/CineReconJS/actions/runs/38677604750) completed successfully on Ubuntu 22.04 at backend commit `800d861cc243fadddc8368b6f5f6ec950436cc89`:

- All 21 authored Python harness tests passed.
- All 26 Node/runtime/browser tests passed, with zero failures and zero skips. This includes actual WebGL rendering, identical PNG hashes across independent runs, exact rational video timestamps, bare Three.js imports, and ten negative scene/network-policy tests.
- The complete authored generation smoke passed: render a 320×180, 6 FPS, 12-frame synthetic reference; prepare sampled inputs; reconstruct and verify an editable Three.js scene and full video. The result explicitly records `api_calls: 0`, `synthetic_test_only: true`, and `evaluator_tested: false`.
- The first CI run exposed an FFmpeg 4.x option incompatibility. The corrected extraction and encoding options were then exercised successfully on the runner, as well as with FFmpeg 7.x locally.

This verifies the authored adapter and renderer, not a real model's reconstruction quality or the original evaluator integration.

## Passed locally

- 21 authored Python harness tests: preview mode, response parsing, task integrity, reference timestamp validation, bounded refinement, preflight/cost controls, generation coverage, provenance exclusion, configuration consistency, and credential handling.
- 14 Node/runtime tests: timeline/config validation, editable demo animation, exact rational FPS and every encoded frame timestamp, even/odd frame sizes, strict HTTP routes, and scene-vs-infrastructure error classification.
- All 50 bundled reference videos decode and match their manifest SHA-256s. All 27,804 decoded frame timestamps pass the constant-frame-rate check after explicit normalization to the first decoded frame. Seven sources have nonzero container offsets; these are recorded, not mistaken for reference content shifts.
- Actual task preparation and no-API request preview on `video1`: 384 frames, 24000/1001 FPS, 1910×1080, 24 timestamped samples.
- Python compilation, `git diff --check`, and dependency audit (`npm audit`: zero reported vulnerabilities).
- Original `cinerecon/`, evaluation prompts, annotations, and media are unchanged.

## Limitations and remaining checks

- The original implementation host still cannot launch Chromium because Unix-domain socket creation is denied with `EPERM`. A separate AF_UNIX probe reproduces that host limitation; TCP loopback works. Browser validation was completed on the GitHub runner instead.
- Original upstream Python regression tests, validator, and evaluator integration have not been executed as part of this implementation validation.
- No live model generation or paid judge calls were made. No benchmark quality scores are claimed.
- Runtime controls do not prove arbitrary generated code obeys the absolute-time/editable-geometry contract; source conformance is explicitly marked unaudited.

Reproduce with the commands in [THREEJS.md](THREEJS.md) and [the renderer README](../threejs/README.md). A skipped browser test is not a passed renderer check.
