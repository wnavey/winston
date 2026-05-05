#!/usr/bin/env python3
"""Cross-reference inspect-drawing tool calls against the cc-vision-classification grades.

Reads:
- ../output/inspect-drawing-calls/*/metadata.json — one per actual inspect-drawing call
- ../output/runs/run-*/findings/cc-*.md.json — per-(run, item) findings (tools_used field)
- ../../../cc-vision-classification/cc-classification.tsv — ground-truth grade per item

Writes:
- per-item-grade-vs-actual.tsv — full join: (run, grouping, item, grade, tools_used, inspect_drawing_called)
- inspect-drawing-calls-summary.tsv — one row per actual inspect-drawing call
- summary stats (printed to stdout)
"""

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
RUN1 = HERE.parent
OUTPUT = RUN1 / "output"
CALLS = OUTPUT / "inspect-drawing-calls"
RUNS = OUTPUT / "runs"
GRADES_TSV = HERE.parent.parent.parent.parent / "cc-vision-classification" / "cc-classification.tsv"


def load_grades():
    grades = {}
    with GRADES_TSV.open() as f:
        for row in csv.DictReader(f, delimiter="\t"):
            grades[(row["grouping"], row["item_id"])] = row["grade"]
    return grades


def load_calls():
    """Return list of dicts: {callDir, run, grouping, item_id, sheet, classification, confidence}."""
    out = []
    for call_dir in sorted(CALLS.iterdir()):
        if not call_dir.is_dir():
            continue
        meta = json.loads((call_dir / "metadata.json").read_text())
        inputs = meta.get("inputs", {})
        items = inputs.get("applicableChecklistItems", [])

        # Extract run / grouping from callId folder name pattern: <ts>-<id>-run-<N>-<grouping>
        name = call_dir.name
        parts = name.split("-")
        # callId pattern includes "run" and "cc" tokens
        run = None
        grouping = None
        try:
            for i, p in enumerate(parts):
                if p == "run" and i + 1 < len(parts):
                    run = f"run-{parts[i+1]}"
                if p == "cc" and i + 1 < len(parts):
                    grouping = f"cc-{parts[i+1]}"
        except Exception:
            pass

        for item in items:
            out.append({
                "callDir": call_dir.name,
                "run": run,
                "grouping": grouping,
                "item_id": item.get("checklist_id"),
                "sheet": inputs.get("sheetNum"),
                "question": inputs.get("question", "")[:120],
                "classification": meta.get("result", {}).get("classification"),
                "count": meta.get("result", {}).get("count"),
                "unanswerable": meta.get("result", {}).get("unanswerable"),
                "confidence": meta.get("result", {}).get("confidence"),
                "answerText": meta.get("result", {}).get("answerText", "")[:200],
            })
    return out


def load_findings():
    """Return list of dicts: {run, grouping, item_id, status, tools_used (list)}."""
    out = []
    for run_dir in sorted(RUNS.iterdir()):
        if not run_dir.is_dir():
            continue
        run = run_dir.name
        for f in sorted((run_dir / "findings").glob("cc-*.md.json")):
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


def main():
    grades = load_grades()
    calls = load_calls()
    findings = load_findings()

    # Index calls by (run, grouping, item_id) → list of calls
    calls_by_key = defaultdict(list)
    for c in calls:
        calls_by_key[(c["run"], c["grouping"], c["item_id"])].append(c)

    # ── Write per-item-grade-vs-actual.tsv ───────────────────────────────
    out_rows = []
    for f in findings:
        key = (f["run"], f["grouping"], f["item_id"])
        grade = grades.get((f["grouping"], f["item_id"]), "UNCLASSIFIED")
        n_calls = len(calls_by_key[key])
        out_rows.append({
            "run": f["run"],
            "grouping": f["grouping"],
            "item_id": f["item_id"],
            "grade": grade,
            "status": f["status"],
            "tools_used": ";".join(f["tools_used"]),
            "inspect_drawing_calls": n_calls,
        })
    with (HERE / "per-item-grade-vs-actual.tsv").open("w") as out:
        w = csv.DictWriter(out, fieldnames=out_rows[0].keys(), delimiter="\t")
        w.writeheader()
        w.writerows(out_rows)
    print(f"Wrote per-item-grade-vs-actual.tsv ({len(out_rows)} rows)")

    # ── Write inspect-drawing-calls-summary.tsv ──────────────────────────
    if calls:
        with (HERE / "inspect-drawing-calls-summary.tsv").open("w") as out:
            cols = ["run", "grouping", "item_id", "sheet", "classification",
                    "count", "unanswerable", "confidence", "question", "answerText"]
            w = csv.DictWriter(out, fieldnames=cols, delimiter="\t",
                               extrasaction="ignore")
            w.writeheader()
            for c in calls:
                w.writerow({k: c.get(k) for k in cols})
    print(f"Wrote inspect-drawing-calls-summary.tsv ({len(calls)} rows)")

    # ── Summary stats ─────────────────────────────────────────────────────
    print("\n=== TOTAL INSPECT-DRAWING CALLS ===")
    print(f"  total calls: {len(calls)}")
    print(f"  unique callDirs: {len(set(c['callDir'] for c in calls))}")
    by_run = Counter(c["run"] for c in calls)
    by_grouping = Counter(c["grouping"] for c in calls)
    by_item = Counter((c["grouping"], c["item_id"]) for c in calls)
    print(f"\n  by run: {dict(by_run)}")
    print(f"  by grouping: {dict(by_grouping)}")
    print(f"  by item: {dict(by_item)}")

    print("\n=== HIT RATE: agent called inspect-drawing on `required` items ===")
    by_grade = defaultdict(lambda: {"opportunities": 0, "called": 0})
    for r in out_rows:
        g = r["grade"]
        by_grade[g]["opportunities"] += 1
        if r["inspect_drawing_calls"] > 0:
            by_grade[g]["called"] += 1
    for grade, stats in sorted(by_grade.items()):
        opp = stats["opportunities"]
        called = stats["called"]
        pct = 100 * called / opp if opp else 0
        print(f"  {grade}: {called}/{opp} = {pct:.1f}%")

    print("\n=== TOOLS_USED FIELD AUDIT ===")
    # Does the tools_used field track inspect-drawing at all?
    tools_used_any = Counter()
    for f in findings:
        for t in f["tools_used"]:
            tools_used_any[t] += 1
    print(f"  unique tools tracked in tools_used: {dict(tools_used_any)}")
    inspect_in_tools_used = sum(
        1 for f in findings
        if any("inspect" in t.lower() for t in f["tools_used"])
    )
    print(f"  findings with 'inspect' in tools_used: {inspect_in_tools_used}")
    print(f"  findings with 1+ inspect-drawing call (per-call dir): {sum(1 for r in out_rows if r['inspect_drawing_calls'] > 0)}")

    print("\n=== REQUIRED ITEMS — PER-RUN BREAKDOWN ===")
    required_items = [(g, i) for (g, i), grade in grades.items()
                      if grade == "inspect-drawing-required"]
    print(f"  total required items in classification: {len(required_items)}")
    for run in sorted(set(f["run"] for f in findings)):
        run_calls = sum(1 for r in out_rows
                        if r["run"] == run and r["grade"] == "inspect-drawing-required"
                        and r["inspect_drawing_calls"] > 0)
        print(f"  {run}: {run_calls}/{len(required_items)} required items got inspect-drawing")


if __name__ == "__main__":
    main()
