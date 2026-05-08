#!/usr/bin/env python3
"""Build metrics/cc/var1-bifurcated-vision-tools/per-item-run.tsv (TSV 3, raw).

Long format: one row per (item × run). Source is the var1 cc run
``VISION_EXP_INSPECT_DRAWING_RUN_1`` (in the inspect-drawing-tool
workspace, not the vision-tool-orchestration one). The agent for that
run had `vision` + direct `inspect-drawing` script-tool exposed —
exactly what the var1 variant requires.

Two attribution paths (both needed because of a known
``tools_used``-tracking bug):

- **vision** calls — attributed via per-finding ``tools_used`` field
  (same as ctrl-baseline). 186 vision occurrences in this run.
- **inspect-drawing** calls — attributed via per-call metadata at
  ``output/inspect-drawing-calls/<callId>/metadata.json``. The agent's
  ``tools_used`` does NOT track inspect-drawing in this run (open
  workspace TODO). The metadata.json files are the source of truth:
  each has ``inputs.applicableChecklistItems[].checklist_id`` plus
  the callId encodes ``run-N-cc-NN`` so we can derive (run_index,
  grouping).

tool_called precedence for an item-run with multiple call kinds:
inspect-drawing > vision > none.

Sources:
- ../../../../inspect-drawing-tool/experiments/run1/output/runs/run-{1,2,3}/findings/cc-*.md.json
- ../../../../inspect-drawing-tool/experiments/run1/output/inspect-drawing-calls/<callId>/metadata.json
- ../../expected-vision-selection/expected.tsv

Output:
- ../per-item-run.tsv
"""

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
# scripts/ → var1-bifurcated-vision-tools/ → cc/ → metrics/ → vision-tool-orchestration/
WORKSPACE = HERE.parent.parent.parent.parent
RUN_LABEL = "VISION_EXP_INSPECT_DRAWING_RUN_1"
RUN_DIR = WORKSPACE / "source-runs" / "cc" / "var-1" / "output"
RUNS_DIR = RUN_DIR / "runs"
ID_CALLS_DIR = RUN_DIR / "inspect-drawing-calls"
EXPECTED_TSV = HERE.parent.parent / "expected-vision-selection" / "expected.tsv"
OUT_TSV = HERE.parent / "per-item-run.tsv"

CALLID_RUN_GROUPING_RE = re.compile(r"-run-(\d+)-(cc-\d+)")

TOOL_PRECEDENCE = {
    "none":             0,
    "generic-vision":   1,
    "inspect-drawing":  2,
}


def vision_called(tools_used):
    """A finding 'called vision' if any tool name contains 'vision'."""
    return any("vision" in (t or "").lower() for t in tools_used)


def vision_call_count(tools_used):
    return sum(1 for t in tools_used if "vision" in (t or "").lower())


def load_expected_items():
    items = []
    with EXPECTED_TSV.open() as f:
        for r in csv.DictReader(f, delimiter="\t"):
            items.append(r["item_id"])
    return items


def load_findings_by_run():
    """{run_index: {item_id: list[finding]}}. item_id format: 'cc-13:AW-21'."""
    out = {}
    for run_dir in sorted(RUNS_DIR.iterdir()):
        if not run_dir.is_dir() or not run_dir.name.startswith("run-"):
            continue
        run_index = int(run_dir.name.split("-", 1)[1])
        findings_dir = run_dir / "findings"
        if not findings_dir.exists():
            continue
        per_item = defaultdict(list)
        for f in sorted(findings_dir.glob("cc-*.md.json")):
            grouping = f.name.replace(".md.json", "")
            data = json.loads(f.read_text())
            for finding in data.get("findings", []):
                key = f"{grouping}:{finding['checklistItemId']}"
                per_item[key].append(finding)
        out[run_index] = dict(per_item)
    return out


def load_inspect_drawing_calls():
    """{(item_id, run_index): [call_metadata]}.

    Multi-attribution: a single inspect-drawing call may list multiple
    ``applicableChecklistItems`` — we credit all of them.
    """
    by_item = defaultdict(list)
    if not ID_CALLS_DIR.exists():
        return by_item
    for call_dir in sorted(ID_CALLS_DIR.iterdir()):
        if not call_dir.is_dir():
            continue
        meta_path = call_dir / "metadata.json"
        if not meta_path.exists():
            continue
        m = CALLID_RUN_GROUPING_RE.search(call_dir.name)
        if not m:
            print(f"WARNING: callId {call_dir.name!r} doesn't match run-N-cc-NN pattern; skipping")
            continue
        run_index = int(m.group(1))
        grouping = m.group(2)
        meta = json.loads(meta_path.read_text())
        applicable = meta.get("inputs", {}).get("applicableChecklistItems") or []
        for entry in applicable:
            checklist_id = entry.get("checklist_id")
            if not checklist_id:
                continue
            item_id = f"{grouping}:{checklist_id}"
            by_item[(item_id, run_index)].append(meta)
    return by_item


def main():
    expected_items = load_expected_items()
    findings_by_run = load_findings_by_run()
    id_calls = load_inspect_drawing_calls()
    run_indices = sorted(findings_by_run.keys())

    rows = []
    for item_id in expected_items:
        for run_index in run_indices:
            item_findings = findings_by_run[run_index].get(item_id, [])
            tools_all = [t for f in item_findings for t in (f.get("tools_used") or [])]
            v_count = vision_call_count(tools_all)
            v_called = v_count > 0

            id_call_list = id_calls.get((item_id, run_index), [])
            id_count = len(id_call_list)

            if id_count > 0:
                tool_called = "inspect-drawing"
            elif v_called:
                tool_called = "generic-vision"
            else:
                tool_called = "none"

            call_count = id_count + v_count

            notes_parts = []
            if not item_findings:
                notes_parts.append("no_finding")
            if id_count > 0 and v_called:
                notes_parts.append("mixed: vision + inspect-drawing")
            if len(item_findings) > 1:
                notes_parts.append(f"{len(item_findings)} findings for this item-run")

            rows.append({
                "item_id": item_id,
                "run_index": run_index,
                "run_label": RUN_LABEL,
                "tool_called": tool_called,
                "call_count": call_count,
                "notes": "; ".join(notes_parts),
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
    print(f"  total inspect-drawing call attributions: {sum(1 for r in rows if r['tool_called'] == 'inspect-drawing')}")
    print(f"  runs: {run_indices}")


if __name__ == "__main__":
    main()
