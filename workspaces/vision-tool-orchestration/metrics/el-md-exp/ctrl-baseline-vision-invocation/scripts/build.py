#!/usr/bin/env python3
"""Build metrics/el-md-exp/ctrl-baseline-vision-invocation/per-item-run.tsv (TSV 2, raw).

Long format: one row per (item × run). Source is BASELINE_V3 — production
review prompt with logAllAgentTrace=true (which now actually works:
findings emitted for every item / every status, with agentTrace.tools_used
populated).

Sources:
- ../../../../experiments/baseline-v3-review/el-md-exp/output/runs/run-{1,2,3}/findings/*.md.json
- ../../expected-vision-selection/expected.tsv

Output:
- ../per-item-run.tsv

Ctrl-baseline only exposes the generic ``vision`` tool to the agent, so
``tool_called`` ∈ {none, generic-vision}.
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
WORKSPACE = HERE.parent.parent.parent.parent
RUN_LABEL = "VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V3"
RUNS_DIR = WORKSPACE / "experiments" / "baseline-v3-review" / "el-md-exp" / "output" / "runs"
EXPECTED_TSV = HERE.parent.parent / "expected-vision-selection" / "expected.tsv"
OUT_TSV = HERE.parent / "per-item-run.tsv"


def vision_called_tools(tools_used):
    """Vision called if any tool name contains 'vision' (any prefix variant)."""
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
    """{run_index: {item_id: list[finding]}}.

    deficiencyIds in findings are unprefixed (`EL-1.1`) — same as TSV 1's
    item_id, so the join is direct.
    """
    out = {}
    for run_dir in sorted(RUNS_DIR.iterdir()):
        if not run_dir.is_dir() or not run_dir.name.startswith("run-"):
            continue
        run_index = int(run_dir.name.split("-", 1)[1])
        findings_dir = run_dir / "findings"
        if not findings_dir.exists():
            continue
        per_item = defaultdict(list)
        for f in sorted(findings_dir.glob("*.md.json")):
            data = json.loads(f.read_text())
            for finding in data.get("findings", []):
                key = finding.get("deficiencyId")
                if key:
                    per_item[key].append(finding)
        out[run_index] = dict(per_item)
    return out


def main():
    expected_items = load_expected_items()
    findings_by_run = load_findings_by_run()
    run_indices = sorted(findings_by_run.keys())

    rows = []
    for item_id in expected_items:
        for run_index in run_indices:
            item_findings = findings_by_run[run_index].get(item_id, [])
            tools_all = []
            for f in item_findings:
                # logAllAgentTrace=true path: tools_used is under agentTrace.
                # Defensive: also check top-level tools_used in case schema variants differ.
                at = f.get("agentTrace") or {}
                tools_all.extend(at.get("tools_used") or [])
                tools_all.extend(f.get("tools_used") or [])
            count = vision_call_count(tools_all)
            tool = "generic-vision" if count > 0 else "none"
            notes = ""
            if not item_findings:
                notes = "no_finding"
            elif len(item_findings) > 1:
                notes = f"{len(item_findings)} findings"
            rows.append({
                "item_id": item_id,
                "run_index": run_index,
                "run_label": RUN_LABEL,
                "tool_called": tool,
                "call_count": count,
                "notes": notes,
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
    no_finding = sum(1 for r in rows if r["notes"] == "no_finding")
    print(f"  no_finding rows: {no_finding}")


if __name__ == "__main__":
    main()
