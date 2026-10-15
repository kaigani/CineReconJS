# Astra single-pass baseline

A bounded `gpt-6-astra` reconstruction of `video1` at L1, using the standard
Three.js prompt and 24 uniformly sampled reference images. One initial scene
was produced, with no rendered feedback, refinement, executable tests, or scene
repairs supplied to the model. The exact first response is preserved unchanged.

This is an interactive sampled-frame experiment, **not** a standard provider-API
harness run, a full CineRecon protocol run, or a quality score. Requested
reasoning effort was `xhigh`; provider-authenticated response metadata, token
usage, and a paper-matched output-token budget are unavailable. The original
paper's standard protocol includes iterative refinement; its No Refine setting
is an ablation. See the paper's Appendix B.3 and Section 4.4:
https://arxiv.org/html/2610.16577v1

`video1_l1_no_refine/` contains the first JSON response, frozen generation prompt,
input-frame timestamps/checksums (no reference pixels), and provenance. The
source is the exact UTF-8 value of `scene_source` in `first_response.json`.

The dedicated GitHub Actions workflow renders all 384 frames at 1910×1080,
24000/1001 FPS (16.016 seconds), using the existing pinned renderer and seed 0.
It runs in a fresh hosted VM with a loopback-only network namespace, ordinary
runner permissions, and Chromium sandboxing enabled. No model API or original
upstream evaluator is invoked. Static safety review precedes rendering; the
scene is not edited to make the experiment pass.

Successful completion checks execution, dimensions, frame count, rational
frame rate, and every encoded frame timestamp. It does not establish visual
fidelity, editability/protocol conformance, or benchmark quality.

A compact result ZIP is encoded into numbered job-log records, with SHA-256,
to retrieve the video, scene snapshot, metadata, and selected frames without
creating Actions artifact storage. `package_result.py` only packages explicit
result files. Treat downloaded experiment outputs as data; never execute them
outside an appropriate disposable sandbox.
