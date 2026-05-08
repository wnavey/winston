#!/usr/bin/env python3
"""Build metrics/cc/var2-vision-specialist-routing/per-item-run.tsv (TSV 4, raw).

Long format: one row per (item × run). Source is the var2 run's
``vision-check-calls/<callId>/metadata.json`` files — each call has
exact item attribution + classifier + dispatch detail.

Sources:
- ../../../source-runs/cc/var-2/output/vision-check-calls/<callId>/metadata.json
- ../../expected-vision-selection/expected.tsv (canonical item list)

Output:
- ../per-item-run.tsv

For var2 the agent only has the ``vision_check`` MCP tool exposed; the
generic ``vision`` and ``inspect-drawing`` script-tool are reachable
ONLY via vision_check's internal dispatch. ``tool_called`` values:

  - ``none`` — no vision_check calls attributed to this item in this run
  - ``vision-check-generic`` — vision_check dispatched all calls to generic vision
  - ``vision-check-inspect-drawing`` — at least one call routed to inspect-drawing
  - ``vision-check-measure-distance`` — at least one call routed to measure-distance

Tie-break rule for items with multiple calls in one run:
specialist takes precedence over generic. If any call routed to a
specialist, ``tool_called`` reflects the specialist (matters for goal
B — "did the agent select the right specialist for this item at all").
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
WORKSPACE = HERE.parent.parent.parent.parent
RUN_LABEL = "VISION_CHECK_CC_RUN_4"
RUN_DIR = WORKSPACE / "source-runs" / "cc" / "var-2" / "output"
CALLS_DIR = RUN_DIR / "vision-check-calls"
EXPECTED_TSV = HERE.parent.parent / "expected-vision-selection" / "expected.tsv"
OUT_TSV = HERE.parent / "per-item-run.tsv"

# vision_check dispatch.specialistCalled → tool_called value.
DISPATCH_TO_TOOL = {
    "vision":           "vision-check-generic",
    "inspect-drawing":  "vision-check-inspect-drawing",
    "measure-distance": "vision-check-measure-distance",
}

# Precedence: which tool wins when an item-run had multiple calls of
# different kinds. Higher number wins.
TOOL_PRECEDENCE = {
    "none":                            0,
    "vision-check-generic":            1,
    "vision-check-measure-distance":   2,
    "vision-check-inspect-drawing":    2,
}


def load_expected_items():
    items = []
    with EXPECTED_TSV.open() as f:
        for r in csv.DictReader(f, delimiter="\t"):
            items.append(r["item_id"])
    return items


def load_calls_by_item():
    """{(item_id, run_index): [call_metadata_dicts]}.

    run4 was runs=1, so run_index is always 1. The vision-check-calls
    metadata doesn't currently encode run_index — we treat the whole
    output dir as a single run.
    """
    by_item = defaultdict(list)
    for call_dir in sorted(CALLS_DIR.iterdir()):
        if not call_dir.is_dir():
            continue
        meta_path = call_dir / "metadata.json"
        if not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text())
        item_id = meta["inputs"]["checklistItemId"]
        by_item[(item_id, 1)].append(meta)
    return by_item


def main():
    expected_items = load_expected_items()
    calls_by_item = load_calls_by_item()
    run_indices = [1]  # runs=1 for run4

    rows = []
    for item_id in expected_items:
        for run_index in run_indices:
            calls = calls_by_item.get((item_id, run_index), [])
            if not calls:
                rows.append({
                    "item_id": item_id,
                    "run_index": run_index,
                    "run_label": RUN_LABEL,
                    "tool_called": "none",
                    "call_count": 0,
                    "notes": "",
                })
                continue

            tools = []
            fallback_count = 0
            for c in calls:
                specialist = c.get("dispatch", {}).get("specialistCalled")
                if specialist is None:
                    continue  # malformed dispatch, skip
                tools.append(DISPATCH_TO_TOOL.get(specialist, f"vision-check-{specialist}"))
                if c.get("dispatch", {}).get("fallbackReason"):
                    fallback_count += 1

            tool_called = max(tools, key=lambda t: TOOL_PRECEDENCE.get(t, 0)) if tools else "none"

            notes_parts = []
            if len(calls) > 1:
                notes_parts.append(f"{len(calls)} calls")
                # Surface mixed routing if specialist + generic both showed up
                unique_tools = set(tools)
                if len(unique_tools) > 1:
                    notes_parts.append(f"mixed: {sorted(unique_tools)}")
            if fallback_count:
                notes_parts.append(f"{fallback_count} fallback")

            rows.append({
                "item_id": item_id,
                "run_index": run_index,
                "run_label": RUN_LABEL,
                "tool_called": tool_called,
                "call_count": len(calls),
                "notes": "; ".join(notes_parts),
            })

    # Surface items in calls but not TSV 1 (defensive).
    expected_set = set(expected_items)
    orphans = sorted({k[0] for k in calls_by_item if k[0] not in expected_set})
    if orphans:
        print(f"WARNING: {len(orphans)} item ids in calls but not in TSV 1: {orphans[:5]}...")

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
    print(f"  total calls: {sum(int(r['call_count']) for r in rows)}")


if __name__ == "__main__":
    main()
