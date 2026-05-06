#!/usr/bin/env python3
"""Analyze the review (el-md-exp) vision-check BASELINE run.

Mirrors `../cc/analytics/analyze-baseline.py` but for the review side.

Important data gap (2026-05-06):
    Unlike CC findings, review findings do NOT carry a `tools_used` field
    (see schema: deficiencyId/status/codeCitations/applicableAreas/
    sheetReferences/documentReferences/comment). The vision-log.jsonl
    captures vision events with documentId + sheetNum + timestamp but no
    deficiencyId attribution, so we cannot reconstruct per-deficiency
    agent-majority the way the CC analyzer can.

    What this analyzer reports instead:
    - Per-deficiency status majority across the 3 runs (joined against
      the el-md-exp ground-truth classification).
    - Aggregate vision call counts per run (from vision-log.jsonl).
    - Sheet-level vision call distribution.

    To enable per-deficiency agent-majority on review the way we have on
    CC, we'd need EITHER:
      (a) bureau review.md to populate `tools_used` on each finding
          (matches CC schema), OR
      (b) the vision MCP tool to log deficiencyId/checklistItemId in
          vision-log.jsonl events (so we can join logs → findings).

    Both are small bureau/conductor patches. Tracking as a follow-up.

Reads:
- ../output/runs/run-*/findings/*.md.json — per-(run, guide) findings
- ../output/vision-log.jsonl — vision call events
- ../output/consolidated-findings.json — per-deficiency cross-run rollup
- measure-distance-tool/analysis/guides/el-md-exp/item-classification.json
  — ground-truth classification (for context, even though it's
  measure-distance-flavored not vision-flavored)

Writes:
- review-baseline-deficiency-status.tsv — one row per deficiency with
  cross-run status majority
- summary stats (printed to stdout)
"""

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
OUTPUT = HERE.parent / "output"
RUNS_DIR = OUTPUT / "runs"
VISION_LOG = OUTPUT / "vision-log.jsonl"
CONSOLIDATED = OUTPUT / "consolidated-findings.json"
GROUND_TRUTH = (
    HERE.parent.parent.parent.parent.parent
    / "measure-distance-tool" / "analysis" / "guides" / "el-md-exp"
    / "item-classification.json"
)


def load_ground_truth():
    return json.loads(GROUND_TRUTH.read_text())["items"]


def load_findings_per_run():
    """Returns {run -> {deficiencyId -> finding}}."""
    out = defaultdict(dict)
    for run_dir in sorted(RUNS_DIR.iterdir()):
        if not run_dir.is_dir():
            continue
        for f in sorted(run_dir.glob("findings/*.md.json")):
            data = json.loads(f.read_text())
            for finding in data.get("findings", []):
                deficiency_id = finding.get("deficiencyId")
                if deficiency_id:
                    out[run_dir.name][deficiency_id] = finding
    return out


def load_vision_events():
    out = []
    with VISION_LOG.open() as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def main():
    ground_truth = load_ground_truth()
    findings_per_run = load_findings_per_run()
    vision_events = load_vision_events()

    runs = sorted(findings_per_run.keys())

    # ── Per-deficiency status majority ───────────────────────────────
    rows = []
    for deficiency_id, gt in sorted(ground_truth.items()):
        statuses_per_run = []
        for run in runs:
            f = findings_per_run.get(run, {}).get(deficiency_id)
            statuses_per_run.append(f.get("status") if f else "missing")
        status_counter = Counter(statuses_per_run)
        majority_status, majority_count = status_counter.most_common(1)[0]
        rows.append({
            "deficiency_id": deficiency_id,
            "deficiency": gt["deficiency"][:120],
            "classification": gt["classification"],
            "should_call_md": gt["shouldCall"],
            "subClassification": gt.get("subClassification", ""),
            "status_run_1": statuses_per_run[0] if len(statuses_per_run) > 0 else "",
            "status_run_2": statuses_per_run[1] if len(statuses_per_run) > 1 else "",
            "status_run_3": statuses_per_run[2] if len(statuses_per_run) > 2 else "",
            "majority_status": majority_status,
            "majority_count": f"{majority_count}/{len(statuses_per_run)}",
        })

    out_path = HERE / "review-baseline-deficiency-status.tsv"
    with out_path.open("w") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys(), delimiter="\t")
        w.writeheader()
        w.writerows(rows)

    # ── Summary ──────────────────────────────────────────────────────
    print("=" * 72)
    print("VISION-CHECK BASELINE — REVIEW (el-md-exp) ANALYSIS")
    print("=" * 72)
    print()
    print(f"Ground-truth deficiencies: {len(ground_truth)}")
    print(f"Runs found: {runs}")
    print(f"Wrote {out_path.name} ({len(rows)} rows)")

    # Status distribution
    print(f"\n── PER-DEFICIENCY MAJORITY STATUS ──")
    majority_counter = Counter(r["majority_status"] for r in rows)
    for status, count in majority_counter.most_common():
        print(f"  {status:<20s} {count:>3d}")

    # Status by classification
    print(f"\n── STATUS MAJORITY × should_call_md ──")
    by_class = defaultdict(lambda: Counter())
    for r in rows:
        by_class[r["should_call_md"]][r["majority_status"]] += 1
    statuses = sorted(set(r["majority_status"] for r in rows))
    print(f"  {'should_call_md':<14s}" + "".join(f"{s:>16s}" for s in statuses))
    for sc in ("yes", "no"):
        if sc in by_class:
            row = "".join(f"{by_class[sc].get(s,0):>16d}" for s in statuses)
            print(f"  {sc:<14s}{row}")

    # Vision call totals (no per-deficiency attribution available)
    print(f"\n── VISION CALL TOTALS (vision-log.jsonl) ──")
    print(f"Total vision events across the entire 3-run review: {len(vision_events)}")
    if vision_events:
        ts = sorted(e["timestamp"] for e in vision_events)
        print(f"Time span: {(ts[-1] - ts[0]) / 1000:.1f}s "
              f"(~{(ts[-1] - ts[0]) / 1000 / 60:.1f} min)")
    by_sheet = Counter(
        (e.get("documentId", "")[:8], e.get("sheetNum")) for e in vision_events
    )
    print(f"Unique (doc, sheet) pairs touched: {len(by_sheet)}")
    print(f"Per-sheet call distribution:")
    for (doc, sheet), count in sorted(by_sheet.items(), key=lambda x: -x[1]):
        print(f"  doc {doc} sheet {sheet}: {count} calls")

    # Note the gap explicitly so output is unambiguous
    print(f"\n── DATA GAP ──")
    print("Per-deficiency 'agent-majority called vision' is NOT computed here.")
    print("Review findings carry no `tools_used` field, and vision-log events")
    print("carry no deficiencyId attribution. See module docstring for the")
    print("two small fixes that would close this gap.")


if __name__ == "__main__":
    main()
