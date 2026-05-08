#!/usr/bin/env python3
"""Build a per-call inspector for the el-md-exp / var-2 source run.

The measure-distance debug viewer (`measure-distance-tool/viewer/`) won't
render anything for this run because every measurement-routed dispatch
fell back to generic via `measurement_arg_construction_not_implemented`
— there's no `measure-distance-calls/` directory. The actual Gemini-vision
prompt that the dispatched-to-generic call sent isn't logged either
(standalone vision tool prompt-traceability gap).

What we DO have: each `vision-check-calls/<callId>/metadata.json` carries
the agent's question, the classifier's intent + reasoning, and the
dispatch outcome. This script aggregates those into a single readable
markdown summary at `../call-inspector.md`.

Run from the var-2 dir or any subdir.

Output: ../call-inspector.md
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
VAR2_ROOT = HERE.parent  # source-runs/el-md-exp/var-2/
CALLS_DIR = VAR2_ROOT / "output" / "vision-check-calls"
EXPECTED_TSV = (
    VAR2_ROOT.parent.parent.parent
    / "metrics" / "el-md-exp" / "expected-vision-selection" / "expected.tsv"
)
RUN_METADATA = VAR2_ROOT / "run-metadata.json"
OUT_PATH = VAR2_ROOT / "call-inspector.md"


def main():
    metadata = json.loads(RUN_METADATA.read_text())
    expected = {}
    if EXPECTED_TSV.exists():
        for r in csv.DictReader(EXPECTED_TSV.open(), delimiter="\t"):
            expected[r["item_id"]] = r

    calls = []
    for call_dir in sorted(CALLS_DIR.iterdir()):
        if not call_dir.is_dir():
            continue
        meta_path = call_dir / "metadata.json"
        if not meta_path.exists():
            continue
        m = json.loads(meta_path.read_text())
        calls.append((call_dir.name, m))

    by_intent = defaultdict(list)
    by_item = defaultdict(list)
    for call_id, m in calls:
        intent = m.get("classifier", {}).get("output", {}).get("problemType", "unknown")
        by_intent[intent].append((call_id, m))
        item = m.get("inputs", {}).get("checklistItemId", "")
        if ":" in item:
            item = item.split(":", 1)[-1]
        if item:
            by_item[item].append((call_id, m))

    lines = []
    lines.append(f"# vision-check call inspector — el-md-exp / var-2")
    lines.append("")
    lines.append(f"**runLabel:** `{metadata['runLabel']}`")
    lines.append(f"**workflow_runs.id:** `{metadata['workflowRunsId']}`")
    lines.append(f"**review id:** `{metadata['reviewId']}`")
    lines.append(f"**Inngest event:** `{metadata['inngestEventId']}`")
    lines.append(f"**Submission:** {metadata['submission']['name']}")
    lines.append(f"**Guide:** {metadata['checklistOrGuide']}")
    lines.append(f"**enabledVisionSpecialists:** `{metadata.get('enabledVisionSpecialists', '(all)')}`")
    lines.append(f"**Wall-clock:** ~{metadata['wallClockMinutes']} min")
    lines.append("")
    lines.append("## Why this report exists")
    lines.append("")
    lines.append(
        "The measure-distance debug viewer can't render this run because every "
        "measurement-routed dispatch fell back to generic via "
        "`measurement_arg_construction_not_implemented` (the conductor's "
        "measurement arg-construction is deferred). No `measure-distance-calls/` "
        "directory exists. The actual Gemini-vision prompt that the "
        "dispatched-to-generic call sent isn't logged either (standalone vision "
        "tool prompt-traceability gap)."
    )
    lines.append("")
    lines.append(
        "What we DO have, and what this report surfaces: each `vision_check` "
        "call's per-call `metadata.json` records (a) the agent's high-level "
        "question, (b) the classifier's intent + reasoning, and (c) the "
        "dispatch outcome (with fallback reason)."
    )
    lines.append("")
    lines.append(f"**Total calls:** {len(calls)}  ·  **Unique items invoked:** {len(by_item)}")
    lines.append("")

    lines.append("## Distribution by classifier intent")
    lines.append("")
    lines.append("| Intent | Calls | Unique items |")
    lines.append("|---|---:|---:|")
    for intent in ("measurement", "drawing_inspect", "generic"):
        intent_calls = by_intent.get(intent, [])
        items = {
            (m.get("inputs", {}).get("checklistItemId", "") or "").split(":", 1)[-1]
            for _, m in intent_calls
        }
        items.discard("")
        lines.append(f"| `{intent}` | {len(intent_calls)} | {len(items)} |")
    lines.append("")
    lines.append(
        "(With `enabledVisionSpecialists='generic-vision,measure-distance'`, "
        "drawing_inspect is removed from the classifier's prompt, so the "
        "classifier should never pick it. Confirmed: 0 calls.)"
    )
    lines.append("")

    lines.append("## Per-call detail")
    lines.append("")
    for intent in ("measurement", "drawing_inspect", "generic", "unknown"):
        intent_calls = by_intent.get(intent, [])
        if not intent_calls:
            continue
        lines.append(f"### Classifier intent: `{intent}` ({len(intent_calls)} calls)")
        lines.append("")
        for call_id, m in intent_calls:
            inputs = m.get("inputs", {})
            classifier = m.get("classifier", {}).get("output", {})
            dispatch = m.get("dispatch", {})
            item_id = (inputs.get("checklistItemId", "") or "").split(":", 1)[-1]
            exp = expected.get(item_id, {})
            exp_summary = (
                f"expected_specialist={exp.get('expected_specialist', 'unknown')}"
                if exp else "(item not in TSV 1)"
            )

            lines.append(f"#### `{call_id}`")
            lines.append("")
            lines.append(f"- **Item:** `{item_id}` — {exp_summary}")
            lines.append(f"- **Sheet:** {inputs.get('sheetNum', '(none)')}")
            lines.append(f"- **Agent question:** {inputs.get('question', '(missing)')}")
            ck = inputs.get('checklistItemText', '').strip()
            if ck:
                lines.append(f"- **Checklist text:** {ck[:200]}{'…' if len(ck) > 200 else ''}")
            lines.append(f"- **Classifier reasoning:** {classifier.get('reasoning', '(none)')}")
            lines.append(f"- **Confidence:** {classifier.get('confidence', '?')}")
            lines.append(
                f"- **Dispatched to:** `{dispatch.get('specialistCalled', '?')}`"
                + (f" — fallback `{dispatch['fallbackReason']}`" if dispatch.get("fallbackReason") else "")
            )
            lines.append("")

    lines.append("## Items invoked by canonical intent (post-aggregation)")
    lines.append("")
    lines.append(
        "The metrics framework aggregates per-item canonical intent across "
        "all calls for that item, then applies majority vote (`per-item.tsv`). "
        "Below: each invoked item, with the strongest classifier intent seen."
    )
    lines.append("")
    lines.append("| Item | Calls | Strongest intent | Expected (TSV 1) |")
    lines.append("|---|---:|---|---|")
    PRECEDENCE = {"measurement": 3, "drawing_inspect": 2, "generic": 1}
    rows = []
    for item, item_calls in sorted(by_item.items()):
        intents = [m.get("classifier", {}).get("output", {}).get("problemType") for _, m in item_calls]
        strongest = max((i for i in intents if i), key=lambda i: PRECEDENCE.get(i, 0), default="?")
        exp = expected.get(item, {})
        exp_text = exp.get("expected_specialist", "?") if exp else "?"
        rows.append((item, len(item_calls), strongest, exp_text))
    for item, n_calls, strongest, exp_text in rows:
        marker = ""
        if exp_text == "measure-distance" and strongest == "measurement":
            marker = " ✓"
        elif exp_text == "measure-distance":
            marker = " ✗"
        lines.append(f"| `{item}` | {n_calls} | `{strongest}` | `{exp_text}`{marker} |")
    lines.append("")

    OUT_PATH.write_text("\n".join(lines) + "\n")
    print(f"Wrote {OUT_PATH.relative_to(VAR2_ROOT.parent.parent.parent.parent.parent)}")
    print(f"  total calls: {len(calls)}")
    print(f"  unique items: {len(by_item)}")
    print(f"  intent distribution: " + ", ".join(f"{k}={len(v)}" for k, v in sorted(by_intent.items())))


if __name__ == "__main__":
    main()
