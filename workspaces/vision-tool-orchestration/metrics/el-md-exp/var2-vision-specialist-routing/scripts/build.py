#!/usr/bin/env python3
"""Build metrics/el-md-exp/var2-vision-specialist-routing/per-item-run.tsv (TSV 4, raw).

Long format: one row per (item × run). Source is RUN_2 — vision-check
overlay with `enabledVisionSpecialists="generic-vision,measure-distance"`
and `logAllAgentTrace=true`.

Two attribution paths combined:

1. Per-(item × run) **invocation**: from per-finding `agentTrace.tools_used`
   (now reliable post bureau#314 + conductor#149). Any vision-named tool
   in tools_used → vision_check invoked for that (item, run). This gives
   us clean per-run attribution.

2. Per-item **routing intent**: from `vision-check-calls/<callId>/metadata.json`.
   Use `classifier.output.problemType` (NOT `dispatch.specialistCalled`)
   because:
   - measurement falls back to generic via measurement_arg_construction_not_implemented
   - drawing_inspect falls back via specialist_disabled (allow-list excludes it)
   We aggregate intents per item (the classifier is roughly deterministic
   across the 3 runs) and apply specialist-precedence: measure-distance >
   inspect-drawing > generic. Each (item × run) row inherits the canonical
   intent if that run invoked vision_check.

Why split: vision-check-calls metadata doesn't carry runIndex, so we
can't reliably attribute calls to specific runs. But findings ARE run-
specific, and tools_used on findings tells us per-run invocation. The
classifier's intent is essentially per-item (consistent across runs),
so we pick the strongest intent per item.

Sources:
- ../../../../experiments/run2-review/el-md-exp/output/runs/run-{1,2,3}/findings/*.md.json
  (per-run findings with agentTrace.tools_used)
- ../../../../experiments/run2-review/el-md-exp/output/vision-check-calls/<callId>/metadata.json
  (per-call classifier intent)
- ../../expected-vision-selection/expected.tsv

Output:
- ../per-item-run.tsv

NOTE on item_id format: vision-check-calls metadata uses
`inputs.checklistItemId = "el-md-exp:EL-13.1"` (with guide prefix).
Findings use unprefixed `EL-13.1`. TSV 1 uses unprefixed. Strip the
prefix on read.
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
WORKSPACE = HERE.parent.parent.parent.parent
RUN_LABEL = "VISION_CHECK_REVIEW_EL_MD_EXP_RUN_2"
RUN_DIR = WORKSPACE / "experiments" / "run2-review" / "el-md-exp" / "output"
RUNS_DIR = RUN_DIR / "runs"
CALLS_DIR = RUN_DIR / "vision-check-calls"
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


def vision_check_invoked(finding):
    """Did this finding's agent record any vision-related tool invocation?

    Accept any tool name containing 'vision' (matches vision_check,
    vision, mcp__conductor_tools__vision_check, etc.) — they're all
    evidence that vision_check was called for this item in this run.
    """
    at = finding.get("agentTrace") or {}
    tools_used = at.get("tools_used") or finding.get("tools_used") or []
    return any("vision" in (t or "").lower() for t in tools_used)


def vision_call_count(finding):
    at = finding.get("agentTrace") or {}
    tools_used = at.get("tools_used") or finding.get("tools_used") or []
    return sum(1 for t in tools_used if "vision" in (t or "").lower())


def load_per_item_intent():
    """{item_id: tool_called} aggregated from vision-check-calls metadata.

    For each item, take the strongest classifier intent seen across all
    its calls. Specialist > generic. Intent is fairly deterministic per
    item, so this is a clean per-item label.
    """
    by_item = defaultdict(list)
    if not CALLS_DIR.exists():
        return {}
    for call_dir in sorted(CALLS_DIR.iterdir()):
        if not call_dir.is_dir():
            continue
        meta_path = call_dir / "metadata.json"
        if not meta_path.exists():
            continue
        meta = json.loads(meta_path.read_text())
        item_id = meta.get("inputs", {}).get("checklistItemId", "")
        if ":" in item_id:
            item_id = item_id.split(":", 1)[-1]
        if not item_id:
            continue
        intent = meta.get("classifier", {}).get("output", {}).get("problemType")
        tool = INTENT_TO_TOOL.get(intent)
        if tool:
            by_item[item_id].append(tool)

    canonical = {}
    for item_id, tools in by_item.items():
        canonical[item_id] = max(tools, key=lambda t: TOOL_PRECEDENCE.get(t, 0))
    return canonical


def main():
    expected_items = load_expected_items()
    findings_by_run = load_findings_by_run()
    per_item_intent = load_per_item_intent()
    run_indices = sorted(findings_by_run.keys())

    rows = []
    for item_id in expected_items:
        canonical_tool = per_item_intent.get(item_id)
        for run_index in run_indices:
            item_findings = findings_by_run[run_index].get(item_id, [])
            invoked = any(vision_check_invoked(f) for f in item_findings)
            count = sum(vision_call_count(f) for f in item_findings)

            if invoked:
                tool_called = canonical_tool or "vision-check-generic"
            else:
                tool_called = "none"

            notes_parts = []
            if not item_findings:
                notes_parts.append("no_finding")
            if invoked and not canonical_tool:
                notes_parts.append("invoked but no metadata match")

            rows.append({
                "item_id": item_id,
                "run_index": run_index,
                "run_label": RUN_LABEL,
                "tool_called": tool_called,
                "call_count": count,
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
    print(f"  unique items with classifier intent recorded: {len(per_item_intent)}")
    print(f"  intent distribution per item: " + str({
        t: sum(1 for v in per_item_intent.values() if v == t)
        for t in set(per_item_intent.values())
    }))


if __name__ == "__main__":
    main()
