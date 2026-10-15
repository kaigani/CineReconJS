# Run and revision tracking

`cinerecon_threejs.tracking` is a standard-library-only observation API. It does not run a model, execute a scene, render a video, or inspect evaluation labels. The sampled-frame harness automatically records new executions under `tracking/`; a native agent controller can use the same API for an inspect → revise → render → submit loop.

## What the counters mean

`summary()["counts"]` contains only the current run or continuation:

- `initial_generations`: the first complete model-generated scene recorded when no scene already exists. An imported response, authored fixture, or continuation baseline is not a new model generation.
- `scene_revisions`: complete candidates recorded with a different SHA-256 from the immediately preceding scene. Identical bytes do not count. Returning to an older hash after an intervening candidate counts as another revision. These are auditable byte changes to submitted complete candidates, not keystrokes, intermediate saves, a semantic-size judgment, or proof of improvement.
- `inspection_only_decisions`: model turns with a recorded decision but no initial generation or changed candidate attached to that turn. A submit decision without a source change counts here. Recording unchanged source alone does not invent an inspection decision.
- `render_attempts`: controller-initiated renderer invocations, including failures. `render_attempts_by_purpose` separates scene rendering from trusted preflight rendering. Record the attempt before invoking the renderer and its result afterward.
- `infrastructure_retries`: explicitly initiated retries after a recorded infrastructure render failure. Record this only when starting the retry, then record the new render attempt separately. A failure can initiate only one retry; a subsequent failed attempt can initiate its own retry. An artifact download, transport recovery, or re-upload that does not rerun rendering is not an infrastructure render retry.
- `model_turns`: observable controller-dispatched interactions, including failed ones. `model_turns_by_interface` separates `native_orchestration` from `provider_api`. A native orchestration turn may contain multiple internal inferences or responses; this counter does not reveal or estimate their number.
- `provider_responses`: provider API payloads actually received by the harness, including refusals and invalid responses. Failed requests without an observed payload do not count. This counter stays zero for native orchestration; zero does not mean the native model made no internal inferences.

An attempt or retry event records that the controller started that operation. It is not proof that a browser, remote worker, or model actually ran. Its paired result and linked external evidence establish the outcome. A process crash can leave a pending attempt visible in the summary. Do not count a retry merely because one is planned.

The existing harness does not ask for explicit native-style inspection decisions, so it does not invent them from a repeated scene response. A two-round API run can have one initial generation and zero revisions if both responses return the same source bytes.

## Original baseline versus continuation

To continue an already generated scene, supply its `scene_sha256`, known original `counts`, and provenance when creating the tracker. The baseline is stored in the first immutable event. It is never replayed as a new generation or revision.

- `counts`: observations from this continuation only.
- `baseline.counts`: the original run's independently supported counts. Omitted or unavailable values remain `null`.
- `total_counts`: baseline plus continuation, but only where the original count is known. Unknown baseline counts produce `null`, not invented zeroes.

Without a baseline, totals cover this ledger only. Importing an archived response does not establish how many prior generations, model calls, or revisions produced it. Attach that uncertainty to the run's provenance rather than treating these counters as the response's full lifetime history.

To submit an unchanged, already rendered baseline, also provide `baseline.render = {"outcome": "succeeded", "evidence": {...}}`. A render-attempt count alone does not establish success. Evidence should identify the preserved run, artifact, and hashes, not merely assert that it looked good.

## Native controller example

This is an API usage example. The controller supplies the model interaction, rendering, and verified evidence; the tracker supplies no hidden execution.

```python
from pathlib import Path
from cinerecon_threejs.tracking import RunTracker, scene_hash

baseline_source = Path("baseline/scene.mjs")
tracker = RunTracker.create(
    Path("continuation/tracking"),
    run_id="native-continuation-001",
    started_at="2026-10-15T16:35:00Z",
    provenance={
        "protocol": "native-threejs-inspect-revise-submit",
        "model": "reported model identity",
        "safety_deadline": "2026-10-15T18:05:00Z",
    },
    baseline={
        "scene_sha256": scene_hash(baseline_source),
        "counts": {
            "initial_generations": 1,
            "scene_revisions": 0,
            "render_attempts": 1,
        },
        "provenance": {"run_manifest": "baseline/run.json"},
        "render": {
            "outcome": "succeeded",
            "evidence": {"artifact": "baseline/reconstruction.mp4"},
        },
    },
)

# Append immediately before dispatching an observable native interaction.
turn = tracker.model_turn(observed_at="2026-10-15T16:36:06Z")
# The controller dispatches the native interaction and receives its result.
tracker.model_result(turn, usage=None, native_tool_calls=None)

# If the returned decision requests rendering, record the complete candidate.
tracker.scene(Path("revisions/001/scene.mjs"), turn_sequence=turn,
              evidence={"decision": "revisions/001/decision.json"})
tracker.decision("render", turn_sequence=turn,
                 evidence={"decision": "revisions/001/decision.json"})
attempt = tracker.render_attempt(evidence={"candidate": "revisions/001"})
# The controller performs rendering and verifies the artifact here.
tracker.render_result(attempt, outcome="succeeded",
                      evidence={"artifact": "revisions/001/reconstruction.mp4"})

# Repeat inspection/render turns as needed. A later model turn chooses submit.
turn = tracker.model_turn()
tracker.model_result(turn, usage=None, native_tool_calls=None)
tracker.decision("submit", turn_sequence=turn,
                 evidence={"decision": "revisions/002/decision.json"})
tracker.stop("model_submit")
summary = tracker.summary()
```

Use actual verified artifact hashes and external job URLs in `evidence` when available. Do not save credentials, hidden model reasoning, or other secrets in provenance. The ledger records caller-provided evidence; it does not authenticate a URL or independently prove that the evidence is correct.

`scene()` hashes a file without importing or executing it. It does not preserve the file bytes itself: keep each complete candidate under a distinct immutable artifact path. For native turns, the default `interface` is `native_orchestration`; for a directly observed provider API request use `model_turn(interface="provider_api")`.

`model_result()` accepts `completed`, `failed`, `refused`, or `invalid_response`. For the provider API interface, `response_received` can be explicitly set to distinguish receipt from generation success. If omitted it defaults to true for non-failed results and false for failed results. Native results must leave it `None`, since a native orchestration result does not establish a count of internal provider responses.

## Usage and stopping

Token `usage` is `None` when unavailable, or an object containing nonnegative `input_tokens`, `output_tokens`, and/or `total_tokens`. Missing fields remain unknown. `token_usage` reports an aggregate field only when every current-run model turn has supplied that field. `known_token_usage` shows the partial sum of reported values. Neither includes unavailable original-baseline usage.

Never estimate native tokens from source length or the number of agent turns. Leave `native_tool_calls` as `None` unless a count was actually available. A known count uses `{"count": 7, "source": "runtime"}` or `{"count": 7, "source": "self_reported"}`. Summaries keep those sources separate and include reporting coverage. `known_count` is a partial sum; `total_count` stays `null` unless every turn reported through that same source. A self-report is not independently verified telemetry.

The stopping reasons are deliberately distinct:

- `model_submit`: the latest completed model turn explicitly submits the current scene. The decision must reference the latest already-successful scene render, or an explicitly successful baseline when no scene render has superseded it. Pending renders, a newly changed unrendered scene, a failed latest render, a stale source, and a submit decision made before rendering completed cannot satisfy this condition.
- `scheduled_budget_complete`: the existing fixed-round harness finished its requested generation budget and rendered its final scheduled candidate. This is ordinary completion, not a model's autonomous submit decision and not a safety termination.
- `operational_safety_ceiling`: a native controller stopped for an external safety limit, such as a wall-clock deadline. Record the particular limit in `detail` or `evidence`. This does not claim model submission.
- `blocked`: an operational error, refusal, invalid response, unavailable execution environment, or another blocker prevented continuation. Record the reason.

The tracker does not impose a hidden revision cap or enforce a deadline. The controller owns execution and stopping policy. A scene-code render failure can still be revised; an infrastructure failure is distinct and should not be represented as a new scene revision unless the source actually changes.

## Event files, time, and recovery

The ledger is a directory of `000001.json`, `000002.json`, and subsequent events. Each has schema `cinerecon-run-events-v1`, a stable run ID, sequence, kind, data, the preceding event's SHA-256, and its own canonical-JSON SHA-256. `recorded_at` is the append time. `observed_at` is the actual observation time supplied by the controller, defaulting to append time. All timestamps require explicit timezones. This permits honest later recording of an earlier dispatch without pretending the record existed then.

`started_at` on `create()` sets the initial observation time. Summaries expose `started_at`, `finished_at`, and `elapsed_seconds`; an open run's elapsed time is calculated when the summary is read. A stopped run's elapsed time uses its stop observation time. Events cannot be appended with an observation time earlier than the run start.

Writes use a complete, fsynced temporary file and a no-replace hard link, then fsync directory entries on POSIX. This requires filesystem support for hard links and directory fsync. Existing event files are never rewritten by the API. The ledger is intended for one controller. A concurrent sequence collision fails instead of overwriting evidence. After an uncertain write failure, reopen and inspect the last event before retrying; a successful publication followed by a sync error may already have recorded the event.

Reopen an unfinished run with `RunTracker(path)`. It validates every event's hash, sequence, references, and counters before allowing new events. Interrupted model and renderer operations remain in `pending_model_turns` and `pending_render_attempts`; reconcile them against real external evidence before continuing. A `.event-*` temporary file left by an interrupted write is not a published event. Do not delete, rewrite, or invent results to make a damaged history look complete.

Every stop is terminal. To continue a deliberately stopped run, create a new continuation ledger and reference the old head, scene hash, and supported baseline counts. A blocked run may deliberately retain pending operations when their outcomes are unknown.

Hash linking is tamper-evident, not an external notarization or an OS immutability guarantee. A party able to rewrite every event can recompute the chain. An unanchored chain cannot detect deletion of its entire tail. Preserve `summary()["head_sha256"]` and `event_count` in a separately retained run manifest or versioned artifact to detect such changes. `run.json` contains a convenience summary snapshot; the verified event files are authoritative.

## Tests

The current authored harness test command includes tracker tests, with mocked model and renderer boundaries:

```bash
python -m unittest discover -s tests -p test_threejs_workflow.py -v
```

The tests require no model credentials, model calls, Chromium, or execution of the original `cinerecon` implementation.
