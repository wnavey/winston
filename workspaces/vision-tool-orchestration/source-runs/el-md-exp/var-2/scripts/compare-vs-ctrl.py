#!/usr/bin/env python3
"""Compare RUN_6_BACKUP_LOCAL (var-2, post measure-distance fix) findings
vs the el-md-exp ctrl baseline for the same checklist items.

Specifically: for items where measure-distance actually invoked
successfully in RUN_6, did the verdict change vs ctrl? Did
"not-verifiable" become "fail" / "pass"? That's the one-step success
criterion for the measure-distance experiment — the whole point of
having a real measurement tool is to convert clearance questions from
"the agent can't tell from the plan view alone" into concrete
pass/fail determinations.

For ctrl (runs=3), we report each run's status. For RUN_6 (runs=1),
single status. We highlight any items where ctrl converged on
not-verifiable across all 3 runs but RUN_6 produced a non-not-verifiable
verdict.
"""

import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
RUN_ROOT = HERE.parent  # source-runs/el-md-exp/var-2/
WORKSPACE = RUN_ROOT.parents[2]  # vision-tool-orchestration/
CTRL_RUNS_DIR = (
    WORKSPACE / "source-runs" / "el-md-exp" / "ctrl" / "output" / "runs"
)
RUN6_RUNS_DIR = RUN_ROOT / "output" / "runs"
RUN6_CALLS_DIR = RUN_ROOT / "output" / "vision-check-calls"
OUT_MD = RUN_ROOT / "compare-vs-ctrl.md"


def load_run_findings(run_dir: Path) -> dict[str, dict]:
    """Walk findings/*.md.json under run_dir, return {deficiencyId: finding}."""
    by_item = {}
    findings_dir = run_dir / "findings"
    if not findings_dir.exists():
        return by_item
    for f in sorted(findings_dir.glob("*.md.json")):
        data = json.loads(f.read_text())
        for finding in data.get("findings", []):
            item = finding.get("deficiencyId")
            if item:
                by_item[item] = finding
    return by_item


def load_md_successes(calls_dir: Path) -> dict[str, list]:
    """Items that had ≥1 measure-distance pair return a distance, with
    sample (objectA, objectB, distanceFeet) pairs."""
    by_item = defaultdict(list)
    for cdir in sorted(calls_dir.iterdir()):
        if not cdir.is_dir():
            continue
        meta_path = cdir / "metadata.json"
        if not meta_path.exists():
            continue
        m = json.loads(meta_path.read_text())
        item = (m.get("inputs", {}).get("checklistItemId", "") or "").split(":", 1)[-1]
        if not item:
            continue
        md_dir = cdir / "specialist-measure-distance" / "measure-distance-calls"
        if not md_dir.exists():
            continue
        for pair_dir in sorted(md_dir.iterdir()):
            if not pair_dir.is_dir():
                continue
            pmeta_path = pair_dir / "metadata.json"
            if not pmeta_path.exists():
                continue
            pmeta = json.loads(pmeta_path.read_text())
            result = pmeta.get("result") or {}
            inputs = pmeta.get("inputs") or {}
            distance_ft = result.get("distanceFeet")
            if distance_ft is None:
                continue
            by_item[item].append({
                "objectA": inputs.get("objectA") or "",
                "objectB": inputs.get("objectB") or "",
                "distanceFeet": distance_ft,
                "confidence": result.get("confidence"),
            })
    return by_item


def majority_status(statuses: list[str]) -> tuple[str, str]:
    """Return (majority_status, distribution_str) over a list of statuses."""
    if not statuses:
        return ("absent", "")
    c = Counter(statuses)
    top, _ = c.most_common(1)[0]
    dist = ",".join(f"{k}:{v}" for k, v in c.most_common())
    return (top, dist)


def main():
    md_items = load_md_successes(RUN6_CALLS_DIR)

    # Load RUN_6 findings (runs=1)
    run6_run1_dir = RUN6_RUNS_DIR / "run-1"
    run6_findings = load_run_findings(run6_run1_dir)

    # Load ctrl findings (runs=3)
    ctrl_runs = {}
    for run_dir in sorted(CTRL_RUNS_DIR.iterdir()):
        if not run_dir.is_dir() or not run_dir.name.startswith("run-"):
            continue
        ctrl_runs[run_dir.name] = load_run_findings(run_dir)

    rows = []
    moved_from_unverifiable = 0
    items_processed = 0

    for item, pair_results in sorted(md_items.items()):
        items_processed += 1
        # RUN_6 status
        run6_finding = run6_findings.get(item)
        run6_status = run6_finding.get("status") if run6_finding else "absent"
        # ctrl status (majority across 3 runs)
        ctrl_statuses = [
            (ctrl_runs[r].get(item) or {}).get("status", "absent")
            for r in sorted(ctrl_runs)
        ]
        ctrl_majority, ctrl_dist = majority_status(ctrl_statuses)
        # Two definitions of "moved", strict and loose:
        #   strict: ctrl unanimous not-verifiable across all 3 runs AND RUN_6 escaped
        #   loose:  ctrl majority not-verifiable AND RUN_6 produced a real verdict
        ctrl_unanimous_unverifiable = all(s == "not-verifiable" for s in ctrl_statuses) and ctrl_statuses
        moved_strict = ctrl_unanimous_unverifiable and run6_status not in ("not-verifiable", "absent")
        moved_loose = (
            ctrl_majority == "not-verifiable"
            and run6_status not in ("not-verifiable", "absent")
        )
        if moved_strict:
            moved_from_unverifiable += 1
        rows.append({
            "item": item,
            "run6_status": run6_status,
            "ctrl_majority": ctrl_majority,
            "ctrl_dist": ctrl_dist,
            "n_pairs": len(pair_results),
            "sample_distances": pair_results[:3],
            "moved_strict": moved_strict,
            "moved_loose": moved_loose,
        })

    lines = []
    lines.append("# RUN_6_BACKUP_LOCAL vs ctrl — verdict comparison")
    lines.append("")
    lines.append(
        "Restricted to items where measure-distance ran successfully (≥1 pair "
        "returned a distance) in RUN_6_BACKUP_LOCAL. ctrl is el-md-exp baseline "
        "(runs=3, no measure-distance, no vision_check — agent has only generic "
        "`vision`). RUN_6 is runs=1 with the full var-2 chain (vision_check → "
        "extract-measurement-pairs → measure-distance) post bureau#324 + "
        "conductor#154."
    )
    lines.append("")
    moved_loose_count = sum(1 for r in rows if r["moved_loose"])
    moved_strict_count = sum(1 for r in rows if r["moved_strict"])
    pass_count = sum(1 for r in rows if r["moved_loose"] and r["run6_status"] == "pass")
    fail_count = sum(1 for r in rows if r["moved_loose"] and r["run6_status"] == "fail")

    lines.append("## Headline")
    lines.append("")
    lines.append(f"- **Items where measure-distance succeeded in RUN_6:** {items_processed}")
    lines.append(
        f"- **Items where ctrl was *majority* `not-verifiable` AND RUN_6 produced a real verdict:** {moved_loose_count} ({pass_count} pass, {fail_count} fail)"
    )
    lines.append(
        f"- **Items where ctrl was *unanimous* `not-verifiable` AND RUN_6 produced a real verdict (stricter):** {moved_strict_count}"
    )
    lines.append("")
    lines.append("## Per-item verdict comparison")
    lines.append("")
    lines.append(
        "Moved column: ✓ = ctrl was unanimously `not-verifiable` (3/3 runs); ◐ = "
        "ctrl was majority `not-verifiable` but at least one run dissented; — = "
        "ctrl had a stable verdict already, or RUN_6 also said `not-verifiable`."
    )
    lines.append("")
    lines.append("| Item | ctrl (runs=3 majority) | ctrl distribution | RUN_6 status | Moved | Pairs measured |")
    lines.append("|---|---|---|---|:---:|---:|")
    for r in rows:
        if r["moved_strict"]:
            marker = "✓"
        elif r["moved_loose"]:
            marker = "◐"
        else:
            marker = "—"
        lines.append(
            f"| `{r['item']}` | `{r['ctrl_majority']}` | {r['ctrl_dist']} | `{r['run6_status']}` | {marker} | {r['n_pairs']} |"
        )
    lines.append("")
    lines.append("## Sample distances (RUN_6, top items)")
    lines.append("")
    for r in rows:
        if not r["sample_distances"]:
            continue
        lines.append(f"### `{r['item']}` — RUN_6 verdict: `{r['run6_status']}` (ctrl: `{r['ctrl_majority']}`)")
        lines.append("")
        lines.append("| objectA | objectB | Distance (ft) | Confidence |")
        lines.append("|---|---|---:|---|")
        for s in r["sample_distances"]:
            objA = (s["objectA"] or "")[:80]
            objB = (s["objectB"] or "")[:80]
            d = s["distanceFeet"]
            d_str = f"{d:.1f}" if isinstance(d, (int, float)) else str(d)
            lines.append(f"| {objA} | {objB} | {d_str} | {s.get('confidence') or '—'} |")
        lines.append("")

    OUT_MD.write_text("\n".join(lines) + "\n")

    print(f"Wrote {OUT_MD.relative_to(WORKSPACE.parent.parent)}")
    print()
    moved_loose_count = sum(1 for r in rows if r["moved_loose"])
    moved_strict_count = sum(1 for r in rows if r["moved_strict"])
    pass_count = sum(1 for r in rows if r["moved_loose"] and r["run6_status"] == "pass")
    fail_count = sum(1 for r in rows if r["moved_loose"] and r["run6_status"] == "fail")
    print(f"Items with successful measure-distance in RUN_6: {items_processed}")
    print(f"Moved (ctrl majority not-verifiable -> RUN_6 real verdict): {moved_loose_count} ({pass_count} pass, {fail_count} fail)")
    print(f"  of which strict (ctrl unanimous not-verifiable): {moved_strict_count}")
    print()
    print("Per-item outcomes:")
    for r in rows:
        marker = ""
        if r["moved_strict"]:
            marker = " <-- moved (ctrl unanimous unverifiable)"
        elif r["moved_loose"]:
            marker = " <-- moved (ctrl majority unverifiable)"
        print(f"  {r['item']:10}  ctrl={r['ctrl_majority']:18}  run6={r['run6_status']:18}  pairs={r['n_pairs']}{marker}")


if __name__ == "__main__":
    main()
