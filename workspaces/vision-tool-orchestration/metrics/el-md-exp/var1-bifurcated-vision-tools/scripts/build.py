#!/usr/bin/env python3
"""Build metrics/el-md-exp/var1-bifurcated-vision-tools/per-item-run.tsv (TSV 3, raw).

Long format: one row per (item × run). Source is VAR1_RUN_2
(`experiment=measure-distance` overlay — agent has `vision` + direct
`measure-distance` script-tool exposed).

Sources:
- ../../../../experiments/var1-run2-review/el-md-exp/output/runs/run-{1,2,3}/findings/*.md.json
- ../../../../experiments/var1-run2-review/el-md-exp/output/measure-distance-calls/*/metadata.json
  (MAY NOT EXIST — if the agent never called measure-distance, no calls dir)
- ../../expected-vision-selection/expected.tsv

Output:
- ../per-item-run.tsv

tool_called precedence per item-run: measure-distance > generic-vision > none.

Coverage: VAR1_RUN_2 emits findings for all four statuses (pass / fail /
not-verifiable / n/a) — bureau#317 added the {{ agentTraceGuidance }}
placeholder to the measure-distance overlay's review.md, so
`logAllAgentTrace=true` now properly appends the emit-all-statuses
override. Supersedes VAR1_RUN_1 which only had 201/303 cells with
findings.
"""

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
WORKSPACE = HERE.parent.parent.parent.parent
RUN_LABEL = "VISION_CHECK_REVIEW_EL_MD_EXP_VAR1_RUN_2"
RUN_DIR = WORKSPACE / "experiments" / "var1-run2-review" / "el-md-exp" / "output"
RUNS_DIR = RUN_DIR / "runs"
MD_CALLS_DIR = RUN_DIR / "measure-distance-calls"
EXPECTED_TSV = HERE.parent.parent / "expected-vision-selection" / "expected.tsv"
OUT_TSV = HERE.parent / "per-item-run.tsv"

# callId may encode `-run-N-...` similarly to the inspect-drawing pattern;
# parse defensively.
CALLID_RUN_RE = re.compile(r"-run-(\d+)")

TOOL_PRECEDENCE = {
    "none": 0,
    "generic-vision": 1,
    "measure-distance": 2,
}


def vision_call_count(tools_used):
    return sum(1 for t in tools_used if "vision" in (t or "").lower())


def load_expected_items():
    return [r["item_id"] for r in csv.DictReader(EXPECTED_TSV.open(), delimiter="\t")]


def load_findings_by_run():
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


def load_md_calls():
    """{(item_id, run_index): [call_metadata]}.

    measure-distance per-call metadata. Items extracted from
    inputs.applicableChecklistItems[].checklist_id (mirrors inspect-drawing
    metadata shape). Run index from callId pattern.
    """
    by_item = defaultdict(list)
    if not MD_CALLS_DIR.exists():
        return by_item
    for call_dir in sorted(MD_CALLS_DIR.iterdir()):
        if not call_dir.is_dir():
            continue
        meta_path = call_dir / "metadata.json"
        if not meta_path.exists():
            continue
        m = CALLID_RUN_RE.search(call_dir.name)
        if not m:
            continue
        run_index = int(m.group(1))
        meta = json.loads(meta_path.read_text())
        for entry in meta.get("inputs", {}).get("applicableChecklistItems") or []:
            cid = entry.get("checklist_id")
            if cid:
                # Strip any guide prefix (e.g. "el-md-exp:EL-1.1" → "EL-1.1").
                cid = cid.split(":", 1)[-1]
                by_item[(cid, run_index)].append(meta)
    return by_item


def main():
    expected_items = load_expected_items()
    findings_by_run = load_findings_by_run()
    md_calls = load_md_calls()
    run_indices = sorted(findings_by_run.keys())

    rows = []
    for item_id in expected_items:
        for run_index in run_indices:
            item_findings = findings_by_run[run_index].get(item_id, [])
            tools_all = []
            for f in item_findings:
                at = f.get("agentTrace") or {}
                tools_all.extend(at.get("tools_used") or [])
                tools_all.extend(f.get("tools_used") or [])
            v_count = vision_call_count(tools_all)
            md_count = len(md_calls.get((item_id, run_index), []))

            if md_count > 0:
                tool_called = "measure-distance"
            elif v_count > 0:
                tool_called = "generic-vision"
            else:
                tool_called = "none"

            call_count = md_count + v_count
            notes_parts = []
            if not item_findings:
                notes_parts.append("no_finding")
            if md_count > 0 and v_count > 0:
                notes_parts.append("mixed: vision + measure-distance")
            if len(item_findings) > 1:
                notes_parts.append(f"{len(item_findings)} findings")

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
    no_finding = sum(1 for r in rows if "no_finding" in r["notes"])
    print(f"  no_finding rows: {no_finding} (var1 coverage caveat — agent omitted pass items)")
    print(f"  measure-distance call attributions: {sum(1 for r in rows if r['tool_called'] == 'measure-distance')}")


if __name__ == "__main__":
    main()
