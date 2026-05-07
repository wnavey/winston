#!/usr/bin/env python3
"""Build metrics/cc/ctrl-baseline-vision-invocation/per-item-run.tsv (TSV 2).

Long format: one row per (item × run). Source is the VISION_CHECK_CC_BASELINE
run's per-finding ``tools_used`` field; we collapse to ``none`` / ``generic-vision``.

Sources:
- ../../../experiments/baseline/cc/output/runs/run-{1,2,3}/findings/cc-*.md.json
  (per-run findings with tools_used)
- ../expected.tsv  ← actually ../../expected-vision-selection/expected.tsv
  (canonical item list — we emit one row per (TSV-1 item × run))

Output:
- ../per-item-run.tsv

ctrl-baseline only exposes the generic ``vision`` tool to the agent, so
``tool_called`` is always one of:
  - ``none``           — no vision call attributed to this item in this run
  - ``generic-vision`` — at least one vision tool call attributed
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
WORKSPACE = HERE.parent.parent.parent.parent
RUN_LABEL = "VISION_CHECK_CC_BASELINE"
RUNS_DIR = WORKSPACE / "experiments" / "baseline" / "cc" / "output" / "runs"
EXPECTED_TSV = HERE.parent.parent / "expected-vision-selection" / "expected.tsv"
OUT_TSV = HERE.parent / "per-item-run.tsv"


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


def main():
    expected_items = load_expected_items()
    findings_by_run = load_findings_by_run()
    run_indices = sorted(findings_by_run.keys())

    rows = []
    seen_findings_items = set()
    for item_id in expected_items:
        for run_index in run_indices:
            item_findings = findings_by_run[run_index].get(item_id, [])
            if item_findings:
                seen_findings_items.add(item_id)
                tools_all = [t for f in item_findings for t in (f.get("tools_used") or [])]
                count = vision_call_count(tools_all)
                tool = "generic-vision" if count > 0 else "none"
                notes = ""
                if len(item_findings) > 1:
                    notes = f"{len(item_findings)} findings for this item-run"
            else:
                tool = "none"
                count = 0
                notes = "no_finding"

            rows.append({
                "item_id": item_id,
                "run_index": run_index,
                "run_label": RUN_LABEL,
                "tool_called": tool,
                "call_count": count,
                "notes": notes,
            })

    # Defensive: surface findings that exist for items not in TSV 1.
    findings_only = set()
    for run_index, by_item in findings_by_run.items():
        for item_id in by_item:
            if item_id not in set(expected_items):
                findings_only.add(item_id)
    if findings_only:
        print(f"WARNING: {len(findings_only)} item ids in findings but not in TSV 1: {sorted(findings_only)[:5]}...")

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
    print(f"  runs: {run_indices}")
    print(f"  items: {len(expected_items)} expected, {len(seen_findings_items)} with at least 1 finding")
    no_finding = sum(1 for r in rows if r["notes"] == "no_finding")
    if no_finding:
        print(f"  no_finding rows: {no_finding}")


if __name__ == "__main__":
    main()
