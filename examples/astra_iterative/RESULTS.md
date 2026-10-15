# Astra continuation result: video1 / L1

**Astra submitted unchanged rendered revision 004 after four substantive scene revisions.**
The exact submission decision is [decision 005](revisions/005/decision.json).

## Counts and stopping

| Observation | Continuation | Including preserved baseline |
|---|---:|---:|
| Initial scene generations | 0 | 1 |
| Changed complete scene candidates / revisions | 4 | 4 |
| Inspection-only decisions | 1 | 1 |
| Full scene render attempts | 4 | 5 |
| Scene-render infrastructure retries | 0 | 0 |
| Native orchestration turns | 5 | 6 |

All four continuation renders succeeded unchanged. Decision 005 is an inspection-only
submission of scene 004, **not a fifth revision**. [Counting rules](../../docs/RUN_TRACKING.md)
separate candidates, decisions, render invocations, and transport-only recovery.
Native turns are not underlying model inference counts. The five continuation turns
self-reported 222 image/shell tool calls in total; that is not independently verified
telemetry. Internal inference count and token usage are unavailable. There were no
external model API calls, judge calls, or original upstream evaluator execution.

The continuation began at 16:35:00 UTC. The submit decision file was written at
18:04:37.480130 UTC on 2026-10-15: **89 minutes 37.48 seconds elapsed**.
Its completion notification was observed at 18:05:05 UTC. The recorded stop reason
is `model_submit`, supported by the preserved decision, source hash, and prior
successful full render. [The hash-linked ledger](tracking/) and
[summary](tracking-summary.json) preserve observed times separately from record times.

**Timing caveat:** submission arrived only about 23 seconds before the disclosed
18:05 UTC operational safety ceiling. This was not a deadline-blinded trial, and
we cannot isolate whether awareness of time or the ceiling affected self-stopping.
It should not be treated as evidence of unconstrained convergence or a paper-equivalent
refinement budget. There was no fixed revision-count cap.

### Astra's public stopping reason, verbatim

> I judge this rendered version sufficient for submission as an editable L1 geometric proxy: the principal scene structure, shot progression, and action are represented, and the targeted silhouette and framing corrections have been checked in rendered pixels. I am stopping with the remaining visual inaccuracies documented; this is a model-selected submission, not a claim of photorealistic or quantitatively evaluated accuracy.

This is the model's submission explanation, not an independent quality assessment.

## Render and source validation

[Revision 004 Actions run](https://github.com/kaigani/CineReconJS/actions/runs/38781165176)
completed successfully using source/runtime commit `10fa8814cdd63e7c11b557ced060a7c25dbc8e87`.
The video has **384 frames, 1910×1080, 24000/1001 FPS, and 16.016 seconds**, seed 0.
Downloaded artifact and per-file checksums, exact generated source bytes, every
encoded frame timestamp, and all 24 matched renderer PNG checksums were verified.

- Source SHA-256: `c6da7d9b979cc800d301ecfb94b71aadcf2a75cc72a55ed15c7d1f185ecad3f4`
- Video SHA-256: `d994e7b95b4d2df27f871c2f7f1767c5320edf8bb5a8a371a6d91eb91249bce1`
- [Validation record](revisions/004/render-validation.json)
- [Final editable scene](revisions/004/scene.mjs)
- [Final generation decision](revisions/004/decision.json)

The original baseline and revisions 001–004 are preserved separately. Source was
never repaired or changed by the controller. Safety review and disposable,
network-isolated execution are required; successful rendering is not a safety,
editability, representation-compliance, or quality proof.

## Qualitative comparison

An independent image-only review inspected all 24 matched reference/baseline/final
moments, without reading generated source or the model's self-critique. The final
scene improves the muzzle placement, multiple camera compositions, late arm arrangement,
and coat silhouette over the baseline. Revision 004 also restores early foot/leg
visibility that revision 003 had obscured.

Major errors remain in crouch and backward-dodge body mechanics, low-angle framing,
foot and coat contact, impact inserts, and overly symmetric legs in the ending.
See the [complete sampled-frame review](visual-review.txt). No numerical score is
assigned. Sampled stills do not establish continuous motion, exact cuts, or contact
between samples; baseline feedback is MP4-decoded while later feedback uses PNGs.

The delivered three-column comparison aligns reference, baseline, and submitted scene
by all 384 decoded frame indices. Panels are scaled without cropping; the separate
submitted MP4 retains full resolution. The editable-history ZIP includes baseline
and all revised source/decision files and full rendered videos, but not a duplicate
reference film. Short-lived Actions artifacts can expire; the source and provenance
remain in git.

## Tracking implementation checks

[Tracking commit](https://github.com/kaigani/CineReconJS/commit/126ed2d052bcf18b4907e3bfbc22d060b2681031)
passed [CI](https://github.com/kaigani/CineReconJS/actions/runs/38772744297):
41 authored Python tests, 26 Node/browser tests with no skips, and the no-API authored
pipeline smoke. The 41 Python tests and local documentation-link checks also passed
after recording this experiment. The original upstream Python evaluator remains
unexecuted; these checks do not establish a benchmark score.
