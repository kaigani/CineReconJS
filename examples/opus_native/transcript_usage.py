"""Sum per-inference API usage from a Claude Code subagent transcript (JSONL).

Splits by native turn at each controller message: a user message that is not a
tool result (relay mode), or a tool result carrying the controller's step marker
(step mode). One API response is logged as several content-block records whose
early copies carry placeholder output counts, so each field takes the maximum
across a message id's records.
"""
import json
import sys
from collections import OrderedDict

STEP_MARKER = "CONTROLLER_STEP_COMPLETE"
FIELDS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")


def main(path):
    turns, owner, usage_by_id = [], {}, {}
    for line in open(path, encoding="utf-8"):
        rec = json.loads(line)
        msg = rec.get("message") or {}
        if rec.get("type") == "user":
            content = msg.get("content")
            is_tool_result = isinstance(content, list) and any(
                isinstance(c, dict) and c.get("type") == "tool_result" for c in content)
            if not is_tool_result or STEP_MARKER in json.dumps(content):
                turns.append(OrderedDict(model=None, inferences=0, **dict.fromkeys(FIELDS, 0)))
            continue
        if rec.get("type") != "assistant" or not turns:
            continue
        mid, usage = msg.get("id"), msg.get("usage") or {}
        if mid not in owner:
            owner[mid] = len(turns) - 1
            usage_by_id[mid] = dict.fromkeys(FIELDS, 0)
            turns[-1]["model"] = msg.get("model")
            turns[-1]["inferences"] += 1
        for f in FIELDS:
            usage_by_id[mid][f] = max(usage_by_id[mid][f], usage.get(f) or 0)
    for mid, usage in usage_by_id.items():
        for f in FIELDS:
            turns[owner[mid]][f] += usage[f]
    total = OrderedDict(inferences=sum(t["inferences"] for t in turns),
                        **{f: sum(t[f] for t in turns) for f in FIELDS})
    print(json.dumps(dict(source=path, turns=turns, total=total), indent=2))


if __name__ == "__main__":
    main(sys.argv[1])
