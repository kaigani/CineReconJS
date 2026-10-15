"""Append-only, dependency-free provenance for generation and native agent runs.

The ledger records observations, never executes scenes or contacts a model. Each
event is atomically published under a new sequence number and hash-linked to its
predecessor. Summaries are derived from verified events, not mutable counters.
"""
import copy
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "cinerecon-run-events-v1"
COUNTERS = ("initial_generations", "scene_revisions", "inspection_only_decisions",
            "render_attempts", "infrastructure_retries", "model_turns", "provider_responses")
STOP_REASONS = ("model_submit", "operational_safety_ceiling", "scheduled_budget_complete", "blocked")


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False, allow_nan=False).encode("utf-8")


def _digest(value):
    return hashlib.sha256(_json(value)).hexdigest()


def scene_hash(path):
    """Hash exact scene bytes; no code is imported or executed."""
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _hash(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def _count(value):
    return type(value) is int and value >= 0


def _timestamp(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    _require(parsed.tzinfo is not None, "Timestamps need an explicit timezone")
    return parsed


def _sync_directory(path):
    if os.name == "posix":
        fd = os.open(path, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def _baseline(value):
    if value is None:
        return None
    _require(isinstance(value, dict) and set(value) <= {"scene_sha256", "counts", "provenance", "render"},
             "Invalid baseline fields")
    _require(_hash(value.get("scene_sha256")), "Baseline needs a scene SHA-256")
    _require(isinstance(value.get("provenance"), dict) and value["provenance"],
             "Baseline needs explicit provenance")
    counts = value.get("counts", {})
    _require(isinstance(counts, dict) and set(counts) <= set(COUNTERS), "Invalid baseline counters")
    _require(all(v is None or _count(v) for v in counts.values()), "Invalid baseline count")
    rendered = value.get("render")
    if rendered is not None:
        _require(isinstance(rendered, dict) and set(rendered) == {"outcome", "evidence"}
                 and rendered["outcome"] == "succeeded" and isinstance(rendered["evidence"], dict)
                 and rendered["evidence"], "Baseline render needs succeeded outcome and evidence")
    return dict(scene_sha256=value["scene_sha256"],
                counts={key: counts.get(key) for key in COUNTERS}, provenance=value["provenance"], render=rendered)


def _usage(value):
    _require(value is None or (isinstance(value, dict) and value and
             set(value) <= {"input_tokens", "output_tokens", "total_tokens"} and
             all(v is None or _count(v) for v in value.values())), "Invalid token usage")


def _submission_render(scene, baseline, renders, results):
    """Only the latest completed scene render is eligible for model submission."""
    if set(renders) != set(results):
        return None
    attempts = [sequence for sequence, row in renders.items() if row["purpose"] == "scene"]
    if attempts:
        latest = attempts[-1]
        if renders[latest]["scene_sha256"] == scene and results[latest]["outcome"] == "succeeded":
            return latest
    elif baseline and baseline["scene_sha256"] == scene and baseline["render"]:
        return "baseline"
    return None


def _state(events):
    """Validate semantic references while deriving a fresh summary."""
    counts = dict.fromkeys(COUNTERS, 0)
    turns, results, renders, render_results, decisions, changes, retried = {}, {}, {}, {}, {}, set(), set()
    scene, baseline, stopping = None, None, None
    token_totals = dict.fromkeys(("input_tokens", "output_tokens", "total_tokens"), 0)
    tools = {"runtime": [], "self_reported": []}
    for event in events:
        kind, data, seq = event["kind"], event["data"], event["sequence"]
        _require(stopping is None, "Cannot append after a run has stopped")
        _require(isinstance(data, dict), "Event data must be an object")
        if kind == "run_started":
            _require(seq == 1, "run_started must be the first and only start event")
            _require(isinstance(data.get("provenance"), dict) and data["provenance"],
                     "Run needs explicit provenance")
            baseline = _baseline(data.get("baseline"))
            scene = baseline["scene_sha256"] if baseline else None
        elif kind == "model_turn":
            _require(data.get("source") in {"runtime", "self_reported"}, "Invalid model-turn source")
            _require(data.get("interface") in {"native_orchestration", "provider_api"}, "Invalid model interface")
            turns[seq] = data
            counts["model_turns"] += 1
        elif kind == "model_result":
            turn = data.get("turn_sequence")
            _require(turn in turns and turn not in results, "Unknown or already completed model turn")
            _require(data.get("outcome") in {"completed", "failed", "refused", "invalid_response"}, "Invalid model outcome")
            received = data.get("response_received")
            _require(type(received) is bool if turns[turn]["interface"] == "provider_api" else received is None,
                     "Provider response receipt must be explicit; native inference count is unavailable")
            _usage(data.get("usage"))
            native = data.get("native_tool_calls")
            if native is not None:
                _require(isinstance(native, dict) and set(native) == {"count", "source"}
                         and _count(native["count"]) and native["source"] in tools,
                         "Native tool counts need a runtime or self_reported source")
                tools[native["source"]].append(native["count"])
            results[turn] = data
            if received:
                counts["provider_responses"] += 1
        elif kind == "scene_recorded":
            current, turn, origin = data.get("scene_sha256"), data.get("turn_sequence"), data.get("origin")
            _require(_hash(current), "Invalid scene SHA-256")
            _require(origin in {"model", "imported", "authored"}, "Invalid scene origin")
            _require(turn is None or turn in turns, "Unknown model turn for scene")
            _require(origin != "model" or turn in turns, "Model scene requires a model turn")
            _require(data.get("previous_scene_sha256") == scene, "Scene predecessor mismatch")
            classification = ("unchanged" if current == scene else "revision" if scene else
                              "initial_generation" if origin == "model" else "initial_import")
            _require(data.get("classification") == classification, "Incorrect scene classification")
            if classification in {"initial_generation", "revision"}:
                counts["initial_generations" if classification == "initial_generation" else "scene_revisions"] += 1
                changes.add(turn)
            scene = current
        elif kind == "render_attempt":
            purpose = data.get("purpose")
            _require(purpose in {"scene", "preflight"}, "Invalid render purpose")
            _require(_hash(data.get("scene_sha256")), "Render needs a scene hash")
            _require(purpose != "scene" or data["scene_sha256"] == scene, "Render does not match current scene")
            renders[seq] = data
            counts["render_attempts"] += 1
        elif kind == "render_result":
            attempt = data.get("attempt_sequence")
            _require(attempt in renders and attempt not in render_results, "Unknown or completed render attempt")
            _require(data.get("outcome") in {"succeeded", "scene_failed", "infrastructure_failed"},
                     "Invalid render outcome")
            render_results[attempt] = data
        elif kind == "infrastructure_retry":
            attempt = data.get("after_sequence")
            _require(attempt in renders and render_results.get(attempt, {}).get("outcome") == "infrastructure_failed",
                     "Infrastructure retry must refer to a failed infrastructure render")
            _require(attempt not in retried, "Infrastructure retry already started for this failure")
            _require(isinstance(data.get("reason"), str) and data["reason"], "Retry needs a reason")
            retried.add(attempt)
            counts["infrastructure_retries"] += 1
        elif kind == "inspection_decision":
            turn = data.get("turn_sequence")
            _require(turn in turns and turn not in decisions, "Unknown or already decided model turn")
            _require(data.get("action") in {"inspect", "revise", "render", "submit"}, "Invalid model decision")
            _require(scene is not None and data.get("scene_sha256") == scene, "Decision needs current scene")
            if data["action"] == "submit":
                rendered = _submission_render(scene, baseline, renders, render_results)
                _require(rendered is not None and data.get("render_sequence") == rendered,
                         "submit decision requires the latest successful render of the current scene")
            decisions[turn] = data
        elif kind == "run_stopped":
            _require(data.get("reason") in STOP_REASONS, "Invalid stopping reason")
            if data["reason"] == "model_submit":
                latest = decisions.get(max(turns, default=0), {})
                _require(latest.get("action") == "submit" and latest.get("scene_sha256") == scene,
                         "model_submit requires the latest model turn to submit the current scene")
                _require(set(turns) == set(results) and results[max(turns)]["outcome"] == "completed",
                         "model_submit requires completed model turns")
                _require(set(renders) == set(render_results), "Cannot submit with a pending render")
                rendered = _submission_render(scene, baseline, renders, render_results)
                _require(rendered is not None and latest.get("render_sequence") == rendered,
                         "model_submit requires a decision on the latest successful render of the current scene")
            stopping = data
        else:
            raise ValueError(f"Unknown event kind: {kind}")
    counts["inspection_only_decisions"] = sum(turn not in changes for turn in decisions)
    # Missing usage is unknown, never zero. Partial known usage stays separately visible.
    known_usage = dict(token_totals)
    for field in token_totals:
        values = [result.get("usage", {}).get(field) if result.get("usage") else None
                  for result in results.values()]
        known_usage[field] = sum(v for v in values if v is not None)
        token_totals[field] = (sum(values) if len(results) == len(turns) and all(v is not None for v in values)
                               else None)
    return dict(counts=counts, baseline=baseline, current_scene_sha256=scene,
                total_counts={key: (counts[key] + baseline["counts"][key]
                                  if baseline and baseline["counts"][key] is not None else
                                  counts[key] if baseline is None else None) for key in COUNTERS},
                token_usage=token_totals if turns else None, known_token_usage=known_usage if turns else None,
                native_tool_calls={source: {"known_count": sum(values) if values else None,
                                           "total_count": sum(values) if turns and len(values) == len(turns) else None,
                                           "reported_turns": len(values)} for source, values in tools.items()},
                model_turns_by_interface={interface: sum(t["interface"] == interface for t in turns.values())
                                          for interface in ("native_orchestration", "provider_api")},
                submission_render_sequence=_submission_render(scene, baseline, renders, render_results),
                pending_model_turns=sorted(set(turns) - set(results)),
                pending_render_attempts=sorted(set(renders) - set(render_results)),
                render_attempts_by_purpose={purpose: sum(r["purpose"] == purpose for r in renders.values())
                                            for purpose in ("scene", "preflight")},
                stopping=stopping, status="stopped" if stopping else "running")


class RunTracker:
    """A small single-controller ledger; reopen it to continue an unfinished run.

    Existing events are never overwritten. Concurrent sequence collisions fail
    rather than losing events. Keep the event head hash in a separate manifest
    when transporting a run: an unanchored chain cannot detect tail deletion.
    """

    def __init__(self, path):
        self.path = Path(path)
        self.events()  # Fail closed on malformed or incomplete history.

    @classmethod
    def create(cls, path, *, run_id, provenance, baseline=None, started_at=None):
        _require(isinstance(run_id, str) and run_id.strip(), "run_id must be nonempty")
        data = dict(provenance=provenance, baseline=_baseline(baseline))
        _json(data)
        _state([dict(kind="run_started", data=data, sequence=1)])
        if started_at is not None:
            _timestamp(started_at)
        path = Path(path)
        missing_parents, parent = [], path.parent
        while not parent.exists():
            missing_parents.append(parent)
            parent = parent.parent
        path.parent.mkdir(parents=True, exist_ok=True)
        path.mkdir()  # Creating over any previous ledger is forbidden.
        for parent in [path, *missing_parents]:
            _sync_directory(parent.parent)
        tracker = cls.__new__(cls)
        tracker.path = path
        tracker._append("run_started", data, run_id=run_id, observed_at=started_at)
        return tracker

    def events(self):
        events, previous = [], None
        _require(self.path.is_dir(), "Tracking directory does not exist")
        for index, path in enumerate(sorted(self.path.glob("*.json")), 1):
            _require(path.name == f"{index:06d}.json", "Event sequence has a gap or invalid filename")
            event = json.loads(path.read_text(encoding="utf-8"))
            _require(isinstance(event, dict) and set(event) == {"schema", "run_id", "sequence", "kind",
                     "recorded_at", "observed_at", "data", "previous_event_sha256", "event_sha256"}, "Invalid event envelope")
            _require(event["schema"] == SCHEMA and event["sequence"] == index, "Event schema or sequence mismatch")
            _require(event["previous_event_sha256"] == previous, "Event hash-chain mismatch")
            _require(event["event_sha256"] == _digest({k: v for k, v in event.items() if k != "event_sha256"}),
                     "Event hash mismatch")
            _require(not events or event["run_id"] == events[0]["run_id"], "Run ID changed")
            _timestamp(event["recorded_at"])
            _timestamp(event["observed_at"])
            previous = event["event_sha256"]
            events.append(event)
        _require(events and events[0]["kind"] == "run_started", "Tracking history has no start event")
        _state(events)
        return events

    def _append(self, kind, data, run_id=None, observed_at=None):
        events = [] if kind == "run_started" else self.events()
        now = datetime.now(timezone.utc).isoformat()
        observed_at = observed_at or now
        _timestamp(observed_at)
        if events:
            _require(_timestamp(observed_at) >= _timestamp(events[0]["observed_at"]),
                     "Observed event predates run start")
        event = dict(schema=SCHEMA, run_id=run_id if not events else events[0]["run_id"],
                     sequence=len(events) + 1, kind=kind, recorded_at=now, observed_at=observed_at,
                     data=copy.deepcopy(data), previous_event_sha256=events[-1]["event_sha256"] if events else None)
        _state(events + [event])
        event["event_sha256"] = _digest(event)
        # Publish a complete fsynced file without ever replacing an old event.
        temp = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".event-", dir=self.path, delete=False) as stream:
                temp = Path(stream.name)
                stream.write(_json(event) + b"\n")
                stream.flush()
                os.fsync(stream.fileno())
            os.link(temp, self.path / f"{event['sequence']:06d}.json")
            _sync_directory(self.path)
        finally:
            if temp is not None:
                temp.unlink(missing_ok=True)
        return event["sequence"]

    def summary(self):
        events = self.events()
        state = _state(events)
        started = events[0]["observed_at"]
        finished = events[-1]["observed_at"] if state["stopping"] else None
        elapsed = (_timestamp(finished) if finished else datetime.now(timezone.utc)) - _timestamp(started)
        return dict(schema=SCHEMA, run_id=events[0]["run_id"], event_count=len(events),
                    head_sha256=events[-1]["event_sha256"], provenance=events[0]["data"]["provenance"],
                    started_at=started, finished_at=finished, elapsed_seconds=max(0.0, elapsed.total_seconds()),
                    **state)

    def model_turn(self, *, interface="native_orchestration", source="runtime", evidence=None, observed_at=None):
        return self._append("model_turn", dict(interface=interface, source=source, evidence=evidence), observed_at=observed_at)

    def model_result(self, turn_sequence, *, outcome="completed", usage=None, native_tool_calls=None,
                     response_received=None, evidence=None, observed_at=None):
        turns = {event["sequence"]: event["data"] for event in self.events() if event["kind"] == "model_turn"}
        if response_received is None and turns.get(turn_sequence, {}).get("interface") == "provider_api":
            response_received = outcome != "failed"
        return self._append("model_result", dict(turn_sequence=turn_sequence, outcome=outcome,
                            usage=usage, native_tool_calls=native_tool_calls, response_received=response_received,
                            evidence=evidence), observed_at=observed_at)

    def scene(self, path, *, turn_sequence=None, origin="model", evidence=None, observed_at=None):
        current = scene_hash(path)
        previous = self.summary()["current_scene_sha256"]
        classification = ("unchanged" if current == previous else "revision" if previous else
                          "initial_generation" if origin == "model" else "initial_import")
        return self._append("scene_recorded", dict(scene_sha256=current, previous_scene_sha256=previous,
                            classification=classification, origin=origin, turn_sequence=turn_sequence,
                            evidence=evidence), observed_at=observed_at)

    def render_attempt(self, *, purpose="scene", source_sha256=None, evidence=None, observed_at=None):
        return self._append("render_attempt", dict(purpose=purpose, scene_sha256=source_sha256 or
                            self.summary()["current_scene_sha256"], evidence=evidence), observed_at=observed_at)

    def render_result(self, attempt_sequence, *, outcome="succeeded", evidence=None, observed_at=None):
        return self._append("render_result", dict(attempt_sequence=attempt_sequence, outcome=outcome, evidence=evidence), observed_at=observed_at)

    def infrastructure_retry(self, after_sequence, *, reason, evidence=None, observed_at=None):
        return self._append("infrastructure_retry", dict(after_sequence=after_sequence, reason=reason, evidence=evidence), observed_at=observed_at)

    def decision(self, action, *, turn_sequence, evidence=None, observed_at=None):
        summary = self.summary()
        return self._append("inspection_decision", dict(action=action, turn_sequence=turn_sequence,
                            scene_sha256=summary["current_scene_sha256"],
                            render_sequence=summary["submission_render_sequence"] if action == "submit" else None,
                            evidence=evidence), observed_at=observed_at)

    def stop(self, reason, *, detail=None, evidence=None, observed_at=None):
        return self._append("run_stopped", dict(reason=reason, detail=detail, evidence=evidence), observed_at=observed_at)
