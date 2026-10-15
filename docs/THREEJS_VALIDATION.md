# Three.js implementation validation

Status as of 2026-10-15, based on upstream commit `1d850319c9cfcafca92c87a0a279edff4758f468`.

## Passed locally

- 21 authored Python harness tests: preview mode, response parsing, task integrity, reference timestamp validation, bounded refinement, preflight/cost controls, generation coverage, provenance exclusion, configuration consistency, and credential handling.
- 14 Node/runtime tests: timeline/config validation, editable demo animation, exact rational FPS and every encoded frame timestamp, even/odd frame sizes, strict HTTP routes, and scene-vs-infrastructure error classification.
- All 50 bundled reference videos decode and match their manifest SHA-256s. All 27,804 decoded frame timestamps pass the constant-frame-rate check after explicit normalization to the first decoded frame. Seven sources have nonzero container offsets; these are recorded, not mistaken for reference content shifts.
- Actual task preparation and no-API request preview on `video1`: 384 frames, 24000/1001 FPS, 1910×1080, 24 timestamped samples.
- Python compilation, `git diff --check`, and dependency audit (`npm audit`: zero reported vulnerabilities).
- Original `cinerecon/`, evaluation prompts, annotations, and media are unchanged.

## Still unverified

- The 12 browser/WebGL tests and the complete rendered smoke run could not execute on the implementation host. Chromium fails before loading a page because Unix-domain socket creation is denied with `EPERM`. A separate AF_UNIX probe reproduces the host limitation; TCP loopback works.
- The GitHub Actions workflow is configured to run the authored Python, renderer/browser tests, and no-API smoke on a standard Linux runner. No CI success is claimed until a remote run completes.
- Original upstream Python regression tests, validator, and evaluator integration have not been executed as part of this implementation validation.
- No live model generation or paid judge calls were made. No benchmark quality scores are claimed.
- Runtime controls do not prove arbitrary generated code obeys the absolute-time/editable-geometry contract; source conformance is explicitly marked unaudited.

Reproduce with the commands in [THREEJS.md](THREEJS.md) and [the renderer README](../threejs/README.md). A skipped browser test is not a passed renderer check.
