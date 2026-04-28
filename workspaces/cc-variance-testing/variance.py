#!/usr/bin/env python3
"""Compute per-ref variance metrics from a completeness-check consolidated-findings.json.

Reads the consolidated-findings.json produced by the completeness-check workflow
(N-run majority voting) and writes:

  - variance-per-ref.tsv      every ref, full metrics, sorted by ref
  - variance-split-refs.tsv   only refs where runs disagreed on status, sorted by entropy desc
  - variance-detection.tsv    only refs where runCount < totalRuns, sorted by detection_rate asc
  - variance-summary.md       human summary with histograms and the top variant refs

Usage:
  python variance.py <consolidated-findings.json> <out-dir> [--review-id ID] [--label STR]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path

STATUSES = ["pass", "fail", "not-applicable", "unclear"]


def shannon_entropy(counts: dict[str, int]) -> float:
    total = sum(counts.values())
    if total == 0:
        return 0.0
    h = 0.0
    for n in counts.values():
        if n == 0:
            continue
        p = n / total
        h -= p * math.log2(p)
    return h


def per_ref_row(entry: dict) -> dict:
    per_run = entry.get("perRunFindings") or []
    status_counts = Counter(f.get("status", "missing") for f in per_run)
    run_count = entry.get("runCount", len(per_run))
    total_runs = entry.get("totalRuns", run_count)
    missing_runs = max(0, total_runs - run_count)

    verdict_entropy = shannon_entropy({s: status_counts.get(s, 0) for s in STATUSES})

    distinct_statuses = sum(1 for s in STATUSES if status_counts.get(s, 0) > 0)
    if missing_runs == 0 and distinct_statuses == 1:
        variance_class = "unanimous"
    elif missing_runs == total_runs:
        variance_class = "no-findings"
    elif missing_runs > 0 and distinct_statuses <= 1:
        variance_class = "partial-detection"
    elif distinct_statuses >= 2 and missing_runs == 0:
        variance_class = "split-verdict"
    else:
        variance_class = "split-and-partial"

    return {
        "ref": entry.get("ref", ""),
        "checklist_item_id": entry.get("checklistItemId", ""),
        "grouping": entry.get("grouping", ""),
        "total_runs": total_runs,
        "run_count": run_count,
        "missing_runs": missing_runs,
        "detection_rate": (run_count / total_runs) if total_runs else 0.0,
        "pass": status_counts.get("pass", 0),
        "fail": status_counts.get("fail", 0),
        "not_applicable": status_counts.get("not-applicable", 0),
        "unclear": status_counts.get("unclear", 0),
        "winning_status": entry.get("status", ""),
        "winning_confidence": entry.get("confidence", ""),
        "verdict_entropy": round(verdict_entropy, 4),
        "variance_class": variance_class,
        "per_run_pattern": ",".join(
            sorted(f.get("status", "missing") for f in per_run)
        ),
    }


def write_tsv(path: Path, rows: list[dict], columns: list[str]) -> None:
    with path.open("w") as f:
        f.write("\t".join(columns) + "\n")
        for r in rows:
            f.write("\t".join(str(r.get(c, "")) for c in columns) + "\n")


def render_summary(
    rows: list[dict],
    label: str | None,
    review_id: str | None,
    source_path: Path,
) -> str:
    total = len(rows)
    total_runs = rows[0]["total_runs"] if rows else 0

    class_counts = Counter(r["variance_class"] for r in rows)
    pattern_counts = Counter(r["per_run_pattern"] for r in rows)
    grouping_high_var: dict[str, int] = Counter()
    for r in rows:
        if r["variance_class"] in ("split-verdict", "split-and-partial"):
            grouping_high_var[r["grouping"]] += 1

    split_rows = sorted(
        [r for r in rows if r["variance_class"] in ("split-verdict", "split-and-partial")],
        key=lambda r: (-r["verdict_entropy"], -r["missing_runs"], r["ref"]),
    )
    detection_rows = sorted(
        [r for r in rows if r["missing_runs"] > 0],
        key=lambda r: (r["detection_rate"], r["ref"]),
    )

    lines: list[str] = []
    title = f"# Completeness-Check Variance — {label}" if label else "# Completeness-Check Variance"
    lines.append(title)
    lines.append("")
    if review_id:
        lines.append(f"**Review ID:** `{review_id}`  ")
    lines.append(f"**Source:** `{source_path.name}`  ")
    lines.append(f"**Total refs:** {total}  ")
    lines.append(f"**Runs per ref:** {total_runs}")
    lines.append("")

    lines.append("## Variance class")
    lines.append("")
    lines.append("| Class | Count | % |")
    lines.append("|---|---:|---:|")
    for cls in ["unanimous", "partial-detection", "split-verdict", "split-and-partial", "no-findings"]:
        n = class_counts.get(cls, 0)
        pct = (n / total * 100) if total else 0
        lines.append(f"| {cls} | {n} | {pct:.1f}% |")
    lines.append("")

    lines.append("## Per-run status patterns")
    lines.append("")
    lines.append("Each row is the multiset of statuses reported across the runs (sorted).")
    lines.append("")
    lines.append("| Pattern | Count |")
    lines.append("|---|---:|")
    for pat, n in pattern_counts.most_common():
        lines.append(f"| `{pat}` | {n} |")
    lines.append("")

    if grouping_high_var:
        lines.append("## High-variance refs by grouping")
        lines.append("")
        lines.append("| Grouping | Split refs |")
        lines.append("|---|---:|")
        for g, n in sorted(grouping_high_var.items(), key=lambda x: -x[1]):
            lines.append(f"| {g} | {n} |")
        lines.append("")

    if split_rows:
        lines.append("## Top split-verdict refs (highest entropy first)")
        lines.append("")
        lines.append("| Ref | Pattern | Winning | Confidence | Entropy |")
        lines.append("|---|---|---|---|---:|")
        for r in split_rows[:25]:
            lines.append(
                f"| `{r['ref']}` | `{r['per_run_pattern']}` | "
                f"{r['winning_status']} | {r['winning_confidence']} | {r['verdict_entropy']:.3f} |"
            )
        if len(split_rows) > 25:
            lines.append("")
            lines.append(f"_… plus {len(split_rows) - 25} more split refs in `variance-split-refs.tsv`._")
        lines.append("")

    if detection_rows:
        lines.append("## Detection-variance refs (some runs produced no finding)")
        lines.append("")
        lines.append("| Ref | runCount/total | Pattern | Winning |")
        lines.append("|---|---:|---|---|")
        for r in detection_rows[:25]:
            lines.append(
                f"| `{r['ref']}` | {r['run_count']}/{r['total_runs']} | "
                f"`{r['per_run_pattern']}` | {r['winning_status']} |"
            )
        if len(detection_rows) > 25:
            lines.append("")
            lines.append(f"_… plus {len(detection_rows) - 25} more in `variance-detection.tsv`._")
        lines.append("")

    return "\n".join(lines) + "\n"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("source", type=Path, help="Path to consolidated-findings.json")
    p.add_argument("out_dir", type=Path, help="Output directory")
    p.add_argument("--review-id", help="Optional review UUID for the summary header")
    p.add_argument("--label", help="Optional human label for the summary header")
    args = p.parse_args()

    if not args.source.exists():
        print(f"error: {args.source} does not exist", file=sys.stderr)
        return 2

    args.out_dir.mkdir(parents=True, exist_ok=True)

    with args.source.open() as f:
        data = json.load(f)
    if not isinstance(data, list):
        print("error: consolidated-findings.json is not an array", file=sys.stderr)
        return 2

    rows = [per_ref_row(e) for e in data]
    rows.sort(key=lambda r: r["ref"])

    columns = [
        "ref", "checklist_item_id", "grouping",
        "total_runs", "run_count", "missing_runs", "detection_rate",
        "pass", "fail", "not_applicable", "unclear",
        "winning_status", "winning_confidence",
        "verdict_entropy", "variance_class", "per_run_pattern",
    ]
    write_tsv(args.out_dir / "variance-per-ref.tsv", rows, columns)

    split = [r for r in rows if r["variance_class"] in ("split-verdict", "split-and-partial")]
    split.sort(key=lambda r: (-r["verdict_entropy"], -r["missing_runs"], r["ref"]))
    write_tsv(args.out_dir / "variance-split-refs.tsv", split, columns)

    detection = [r for r in rows if r["missing_runs"] > 0]
    detection.sort(key=lambda r: (r["detection_rate"], r["ref"]))
    write_tsv(args.out_dir / "variance-detection.tsv", detection, columns)

    summary = render_summary(rows, args.label, args.review_id, args.source)
    (args.out_dir / "variance-summary.md").write_text(summary)

    print(f"wrote {len(rows)} refs → {args.out_dir}")
    print(f"  split-verdict (incl. split-and-partial): {len(split)}")
    print(f"  detection-variance (runCount < totalRuns): {len(detection)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
