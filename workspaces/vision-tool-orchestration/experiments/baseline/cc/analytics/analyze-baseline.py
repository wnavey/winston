#!/usr/bin/env python3
"""Analyze the CC vision-check BASELINE run against cc-vision-classification ground truth.

Differs from run1's analyze.py (../../run1/analytics/analyze.py) in that the
baseline run uses production review.md (no `experiment=vision-check` overlay),
which means:

- The agent calls the plain `vision` tool, not `vision_check`.
- There are no `vision-check-calls/<callId>/metadata.json` artifacts (they're
  emitted by the experiment's vision_check MCP tool only).
- All vision-call attribution comes directly from `tools_used` on each
  finding — no fuzzy matching needed.

The output `vision-call-invocation-metrics.tsv` keeps the same column shape as
run1 so cross-run comparison stays a simple diff. The `actual_vision_tool_call`
column carries different values though:

- "vision (called)"  — agent called `vision` (or any vision-named tool)
                       on this item in at least one run
- "not called"       — no vision tool calls in any run

Reads:
- ../output/runs/run-*/findings/cc-*.md.json — per-(run, grouping) findings
  with `tools_used` populated
- cc-vision-classification/cc-classification.tsv — ground-truth grade per item
- bureau checklist markdown files — deficiency text per item

Writes:
- vision-call-invocation-metrics.tsv — canonical eval artifact, one row per
  classified item
- summary stats (printed to stdout)
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
CC_OUTPUT = HERE.parent / "output"
RUNS_DIR = CC_OUTPUT / "runs"
GRADES_TSV = HERE.parent.parent.parent.parent.parent / "cc-vision-classification" / "cc-classification.tsv"
CHECKLIST_DIR = Path(
    "/Users/winston/noetic/bureau/jurisdictions/austin/completeness-check/v2.5-trimmed"
)


def load_grades():
    grades = {}
    with GRADES_TSV.open() as f:
        for row in csv.DictReader(f, delimiter="\t"):
            grades[(row["grouping"], row["item_id"])] = {
                "grade": row["grade"],
                "confidence": row["confidence"],
                "condition": row["condition"],
            }
    return grades


def load_checklist_text():
    item_text = {}
    for md_file in sorted(CHECKLIST_DIR.glob("cc-*.md")):
        grouping = md_file.stem
        for line in md_file.read_text().split("\n"):
            line = line.strip()
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.split("|")]
            if len(cells) < 3:
                continue
            item_id, deficiency = cells[1], cells[2]
            if item_id in ("ID", "----", "") or deficiency in ("Item", "------", ""):
                continue
            if "--" in item_id and len(item_id) < 4:
                continue
            item_text[(grouping, item_id)] = deficiency
    return item_text


def load_findings():
    out = []
    for run_dir in sorted(RUNS_DIR.iterdir()):
        if not run_dir.is_dir():
            continue
        run = run_dir.name
        findings_dir = run_dir / "findings"
        if not findings_dir.exists():
            continue
        for f in sorted(findings_dir.glob("cc-*.md.json")):
            grouping = f.name.replace(".md.json", "")
            data = json.loads(f.read_text())
            for finding in data.get("findings", []):
                out.append({
                    "run": run,
                    "grouping": grouping,
                    "item_id": finding["checklistItemId"],
                    "status": finding.get("status"),
                    "tools_used": finding.get("tools_used") or [],
                })
    return out


def _expected_tool(grade):
    if grade == "inspect-drawing-required":
        return "inspect-drawing"
    if grade == "inspect-drawing-optional":
        return "inspect-drawing or generic"
    if grade == "vision-only":
        return "generic"
    if grade == "no-tool":
        return "none"
    return "unknown"


def _vision_called(tools_used):
    """A finding 'called vision' if any tool in tools_used has 'vision' in its name.

    The production tool is 'vision' but we also accept the qualified
    'mcp__conductor_tools__vision' variant that sometimes appears.
    """
    return any("vision" in (t or "").lower() for t in tools_used)


def main():
    grades = load_grades()
    checklist_text = load_checklist_text()
    findings = load_findings()

    findings_by_item = defaultdict(list)
    for f in findings:
        findings_by_item[(f["grouping"], f["item_id"])].append(f)

    item_rows = []
    for (grouping, item_id), grade_info in sorted(grades.items()):
        grade = grade_info["grade"]
        condition = grade_info["condition"]
        deficiency = checklist_text.get((grouping, item_id), "")

        item_findings = findings_by_item.get((grouping, item_id), [])
        called_any = any(_vision_called(f["tools_used"]) for f in item_findings)
        runs_called = sum(1 for f in item_findings if _vision_called(f["tools_used"]))
        runs_total = len(item_findings)

        if called_any:
            actual = f"vision (called) [{runs_called}/{runs_total} runs]"
        else:
            actual = "not called"

        statuses = [f.get("status", "") for f in item_findings]
        # use the first status to keep parity with run1 schema
        status = statuses[0] if statuses else ""

        item_rows.append({
            "checklist_item_id": f"{grouping}:{item_id}",
            "checklist_item_deficiency_text": deficiency,
            "grade": grade,
            "condition": condition,
            "expected_vision_tool_call": _expected_tool(grade),
            "actual_vision_tool_call": actual,
            "finding_status": status,
        })

    metrics_path = HERE / "vision-call-invocation-metrics.tsv"
    with metrics_path.open("w") as out:
        w = csv.DictWriter(out, fieldnames=item_rows[0].keys(), delimiter="\t")
        w.writeheader()
        w.writerows(item_rows)

    print("=" * 72)
    print("VISION-CHECK BASELINE — CC ANALYSIS")
    print("=" * 72)
    print(f"\nDataset: {len(grades)} classified items, {len(findings)} finding rows ({len(findings)//3} per run)")
    print(f"Wrote {metrics_path.name} ({len(item_rows)} rows)")

    # Headline by grade
    grade_stats = defaultdict(lambda: {
        "total": 0, "any_called": 0, "all_called": 0,
        "items_called": [], "items_not_called": [],
    })
    for (grouping, item_id), grade_info in sorted(grades.items()):
        grade = grade_info["grade"]
        item_findings = findings_by_item.get((grouping, item_id), [])
        any_called = any(_vision_called(f["tools_used"]) for f in item_findings)
        all_called = item_findings and all(_vision_called(f["tools_used"]) for f in item_findings)
        grade_stats[grade]["total"] += 1
        if any_called:
            grade_stats[grade]["any_called"] += 1
            grade_stats[grade]["items_called"].append(f"{grouping}/{item_id}")
        else:
            grade_stats[grade]["items_not_called"].append(f"{grouping}/{item_id}")
        if all_called:
            grade_stats[grade]["all_called"] += 1

    print("\n── HEADLINE RECALL (vision called per ground-truth grade) ──")
    print(f"{'Grade':<28s} {'≥1 run':>8s} {'all 3':>7s} {'Total':>7s}   {'≥1 rate':>8s}")
    print("-" * 65)
    should_call_total = 0
    should_call_called = 0
    for grade in ["inspect-drawing-required", "inspect-drawing-optional", "vision-only", "no-tool"]:
        s = grade_stats[grade]
        rate = 100 * s["any_called"] / s["total"] if s["total"] else 0
        print(f"  {grade:<26s} {s['any_called']:>8d} {s['all_called']:>7d} {s['total']:>7d}   {rate:>7.1f}%")
        if grade in ("inspect-drawing-required", "inspect-drawing-optional", "vision-only"):
            should_call_total += s["total"]
            should_call_called += s["any_called"]
    headline = 100 * should_call_called / should_call_total if should_call_total else 0
    print("-" * 65)
    print(f"  {'SHOULD-CALL (req+opt+vis)':<26s} {should_call_called:>8d}        {should_call_total:>7d}   {headline:>7.1f}%")

    no_tool = grade_stats["no-tool"]
    misuse_rate = 100 * no_tool["any_called"] / no_tool["total"] if no_tool["total"] else 0
    print(f"\n  MISUSE (no-tool items called): {no_tool['any_called']}/{no_tool['total']} = {misuse_rate:.1f}%")

    # Required items detail
    print("\n── INSPECT-DRAWING-REQUIRED ITEMS (must-hit) ──")
    req = grade_stats["inspect-drawing-required"]
    print(f"  Called ({len(req['items_called'])}): {', '.join(req['items_called'])}")
    print(f"  Missed ({len(req['items_not_called'])}): {', '.join(req['items_not_called'])}")

    # Per-run detail
    print(f"\n── PER-RUN VISION CALL COUNTS ──")
    per_run = defaultdict(lambda: {"calls": 0, "items": 0})
    for f in findings:
        per_run[f["run"]]["items"] += 1
        if _vision_called(f["tools_used"]):
            per_run[f["run"]]["calls"] += 1
    for run, s in sorted(per_run.items()):
        rate = 100 * s["calls"] / s["items"] if s["items"] else 0
        print(f"  {run}: {s['calls']:3d}/{s['items']:3d} item-runs called vision  ({rate:.1f}%)")

    # Applicable subset (excluding finding_status='not-applicable')
    print(f"\n── APPLICABLE SUBSET (excludes 'not-applicable' findings) ──")
    applicable_grade_stats = defaultdict(lambda: {"total": 0, "any_called": 0})
    for (grouping, item_id), grade_info in sorted(grades.items()):
        grade = grade_info["grade"]
        item_findings = findings_by_item.get((grouping, item_id), [])
        # treat the item as applicable if at least one run produced an applicable finding
        applicable_runs = [f for f in item_findings if f.get("status") != "not-applicable"]
        if not applicable_runs:
            continue
        applicable_grade_stats[grade]["total"] += 1
        if any(_vision_called(f["tools_used"]) for f in applicable_runs):
            applicable_grade_stats[grade]["any_called"] += 1
    print(f"{'Grade':<28s} {'Called':>8s} / {'Total':>5s}   {'Rate':>6s}")
    print("-" * 55)
    app_should = app_called = 0
    for grade in ["inspect-drawing-required", "inspect-drawing-optional", "vision-only", "no-tool"]:
        s = applicable_grade_stats[grade]
        rate = 100 * s["any_called"] / s["total"] if s["total"] else 0
        print(f"  {grade:<26s} {s['any_called']:>8d} / {s['total']:>5d}   {rate:>5.1f}%")
        if grade in ("inspect-drawing-required", "inspect-drawing-optional", "vision-only"):
            app_should += s["total"]
            app_called += s["any_called"]
    print("-" * 55)
    if app_should:
        print(f"  {'APPLICABLE SHOULD-CALL':<26s} {app_called:>8d} / {app_should:>5d}   {100*app_called/app_should:>5.1f}%")


if __name__ == "__main__":
    main()
