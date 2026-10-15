# Astra goal-directed continuation

This experiment continues the preserved [first-pass Astra baseline](../astra_baseline/)
on the same `video1` rooftop sequence, at L1. The same native `gpt-6-astra`
session receives matching reference/reconstruction images, requests complete
scene revisions, and chooses when to submit the most recently rendered scene.
There is **no fixed number of revision rounds**.

## Protocol

- Inputs remain the original 24 timestamped reference images and standard
  Three.js L1 prompt/runtime contract. No evaluator annotations or answers are
  provided. Reference pixels are not committed here.
- The initial feedback is decoded from the original baseline MP4 at the exact
  input frame indices. Later feedback uses original renderer PNGs at those same
  24 indices. Feedback does not include an evaluator score or a human-written
  reconstruction critique.
- Each candidate is a complete standalone scene module. The exact model
  decision and source are preserved before a static safety review. Only a
  reviewed source hash can enter the disposable render environment.
- Each render covers all 384 frames, 1910×1080, 24000/1001 FPS, 16.016 seconds,
  with seed 0 and the existing pinned Three.js runtime. Network isolation and
  Chromium sandboxing remain enabled. No external model API or original
  evaluator is invoked.
- Astra inspects the returned matched frames and either requests another
  render or submits. A submit decision must reference a rendered scene;
  unrendered edits cannot silently become the final result.
- An operational safety ceiling of 90 minutes applies to this continuation,
  from 2026-10-15 16:35 UTC to 18:05 UTC. This is **not a paper protocol budget
  or a revision-count cap**. If reached, the outcome is explicitly recorded as
  a safety-ceiling stop rather than model-selected completion.

This remains a native interactive, sampled-frame Three.js experiment. It is
not a provider-API reproduction or directly comparable published CineRecon
score. Requested reasoning effort is `xhigh`; provider-authenticated usage and
paper-matched output-token limits are unavailable. The original baseline is
kept separately and is never overwritten.

## Evidence layout

`revisions/NNN/decision.json` preserves each meaningful model candidate or
submission decision. Render candidates additionally have source checksums,
provenance, and a static safety-review record. `render_request.json` selects
one reviewed immutable candidate for CI; changing this pointer triggers a
render, without modifying prior candidates.

The workflow uploads a short-lived Actions artifact containing the exact
scene, decision, provenance, full MP4, renderer metadata, 24 matching PNGs,
and per-file checksums. Source and decision history remain in git after
artifacts expire. `artifact_io.py` prepares/collects explicit files and checks
hashes; it does not execute the scene.

Run tracking records source-hash transitions and separate generation,
inspection, render, and retry events. Continuation counters are separate from
the prior baseline's one initial generation and one successful render.
Transport-only artifact recovery does not count as another render or revision.
Native dispatched turns are observable; the platform's internal inference
count and token usage are not available and must not be invented.

A passed render establishes executable output and exact video timing. It is
not a visual quality score or a claim that all motion/contact constraints were
satisfied. The final result includes its stopping reason and comparison with
the preserved baseline.
