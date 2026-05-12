#!/usr/bin/env python3
"""Build metrics/el-md-exp/var2-vision-specialist-routing/per-item-run.tsv (TSV 4, raw).

Long format: one row per (item × run). Source is RUN_10_LOCAL — fired
post bureau#340 prompt tweak (vision_check capability list adds
"dimensional analysis, distance computation"). Per-run output layout
(conductor#155). Per-(item × run) attribution comes from real tool
invocations recorded in `output/runs/run-N/vision-check-calls/<callId>/metadata.json`.

Per (item × run):
  tool_called = highest-precedence classifier intent among all
                vision_check calls recorded under that run's
                vision-check-calls/ for that checklistItemId. "none"
                when no calls.
  call_count  = number of vision_check calls for that pair.

Specialist precedence: measure-distance > inspect-drawing > generic.
(`measurement` problemType maps to `vision-check-measure-distance`
even when extract-measurement-pairs short-circuits with 0 pairs —
classifier intent is the routing signal.)

Sources:
- ../../../../source-runs/el-md-exp/var-2/output/runs/run-{1,2,3}/vision-check-calls/<callId>/metadata.json
- ../../expected-vision-selection/expected.tsv

Output:
- ../per-item-run.tsv

NOTE on item_id format: vision-check-calls metadata uses
`inputs.checklistItemId = "el-md-exp:EL-13.1"` (with guide prefix).
Expected TSV uses unprefixed `EL-13.1`. Strip the prefix on read.
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
WORKSPACE = HERE.parent.parent.parent.parent
RUN_LABEL = "VISION_CHECK_REVIEW_EL_MD_EXP_RUN_10_LOCAL"
RUNS_DIR = WORKSPACE / "source-runs" / "el-md-exp" / "var-2" / "output" / "runs"
EXPECTED_TSV = HERE.parent.parent / "expected-vision-selection" / "expected.tsv"
OUT_TSV = HERE.parent / "per-item-run.tsv"

INTENT_TO_TOOL = {
    "generic":         "vision-check-generic",
    "drawing_inspect": "vision-check-inspect-drawing",
    "measurement":     "vision-check-measure-distance",
}

TOOL_PRECEDENCE = {
    "none": 0,
    "vision-check-generic": 1,
    "vision-check-inspect-drawing": 2,
    "vision-check-measure-distance": 3,
}


def load_expected_items():
    return [r["item_id"] for r in csv.DictReader(EXPECTED_TSV.open(), delimiter="\t")]


def load_per_run_calls():
    """{ run_index_int: { item_id: [(callId, intent), ...] } }"""
    out = defaultdict(lambda: defaultdict(list))
    for run_dir in sorted(RUNS_DIR.iterdir()):
        if not run_dir.is_dir() or not run_dir.name.startswith("run-"):
            continue
        run_idx = int(run_dir.name.split("-", 1)[1])
        calls_dir = run_dir / "vision-check-calls"
        if not calls_dir.exists():
            continue
        for cd in sorted(calls_dir.iterdir()):
            meta = cd / "metadata.json"
            if not meta.exists():
                continue
            m = json.loads(meta.read_text())
            iid = m.get("inputs", {}).get("checklistItemId", "")
            if ":" in iid:
                iid = iid.split(":", 1)[-1]
            if not iid:
                continue
            pt = m.get("classifier", {}).get("output", {}).get("problemType")
            tool = INTENT_TO_TOOL.get(pt)
            if tool:
                out[run_idx][iid].append((cd.name, tool))
    return out


def strongest_tool(calls):
    if not calls:
        return "none"
    tools = [t for _, t in calls]
    return max(tools, key=lambda t: TOOL_PRECEDENCE.get(t, 0))


def main():
    expected_items = load_expected_items()
    calls = load_per_run_calls()
    run_indices = sorted(calls.keys()) if calls else [1, 2, 3]

    rows = []
    for item_id in expected_items:
        for run_idx in run_indices:
            pair = calls[run_idx].get(item_id, [])
            tool = strongest_tool(pair)
            rows.append({
                "item_id": item_id,
                "run_index": run_idx,
                "run_label": RUN_LABEL,
                "tool_called": tool,
                "call_count": len(pair),
                "notes": "",
            })

    with OUT_TSV.open("w") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["item_id", "run_index", "run_label", "tool_called", "call_count", "notes"],
            delimiter="\t",
        )
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {OUT_TSV.relative_to(WORKSPACE.parent.parent)} ({len(rows)} rows)")
    by_tool = defaultdict(int)
    for r in rows:
        by_tool[r["tool_called"]] += 1
    print(f"  tool_called: {dict(by_tool)}")
    total_calls = sum(r["call_count"] for r in rows)
    print(f"  total vision_check calls (sum): {total_calls}")


if __name__ == "__main__":
    main()
