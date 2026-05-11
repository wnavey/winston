#!/usr/bin/env python3
"""Compare RUN_7_BACKUP_LOCAL_3_RUNS verdicts vs el-md-exp ctrl baseline.

Both runs are runs=3 so this is an apples-to-apples majority-vote
comparison. For items where measure-distance ran successfully on
RUN_7, how many escaped ctrl's `not-verifiable` verdict?
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
RUN7_RUNS_DIR = RUN_ROOT / "output" / "runs"
RUN7_CALLS_DIR = RUN_ROOT / "output" / "vision-check-calls"
OUT_MD = RUN_ROOT / "compare-vs-ctrl.md"


def load_per_run_findings(runs_dir):
    out = {}
    for run_dir in sorted(runs_dir.iterdir()):
        if not run_dir.is_dir() or not run_dir.name.startswith("run-"):
            continue
        ri = int(run_dir.name.split("-", 1)[1])
        per_item = {}
        f_dir = run_dir / "findings"
        if not f_dir.exists():
            continue
        for f in sorted(f_dir.glob("*.md.json")):
            data = json.loads(f.read_text())
            for finding in data.get("findings", []):
                item = finding.get("deficiencyId")
                if item:
                    per_item[item] = finding
        out[ri] = per_item
    return out


def majority_status(statuses):
    if not statuses:
        return ("absent", "")
    c = Counter(statuses)
    top, _ = c.most_common(1)[0]
    return (top, ",".join(f"{k}:{v}" for k, v in c.most_common()))


def load_md_successes(calls_dir):
    """{item: [sample_pair_dicts]} for items where ≥1 measure-distance call
    produced ≥1 successful pair."""
    by_item = defaultdict(list)
    for cdir in sorted(calls_dir.iterdir()):
        if not cdir.is_dir():
            continue
        mp = cdir / "metadata.json"
        if not mp.exists():
            continue
        m = json.loads(mp.read_text())
        item = (m.get("inputs", {}).get("checklistItemId", "") or "").split(":", 1)[-1]
        if not item:
            continue
        md_dir = cdir / "specialist-measure-distance" / "measure-distance-calls"
        if not md_dir.exists():
            continue
        for pair_dir in sorted(md_dir.iterdir()):
            if not pair_dir.is_dir():
                continue
            pmp = pair_dir / "metadata.json"
            if not pmp.exists():
                continue
            pmd = json.loads(pmp.read_text())
            result = pmd.get("result") or {}
            inputs = pmd.get("inputs") or {}
            d = result.get("distanceFeet")
            if d is None:
                continue
            by_item[item].append({
                "objectA": inputs.get("objectA") or "",
                "objectB": inputs.get("objectB") or "",
                "distanceFeet": d,
                "confidence": result.get("confidence"),
            })
    return by_item


def main():
    md_items = load_md_successes(RUN7_CALLS_DIR)
    ctrl_runs = load_per_run_findings(CTRL_RUNS_DIR)
    run7_runs = load_per_run_findings(RUN7_RUNS_DIR)

    n_runs_run7 = len(run7_runs)
    n_runs_ctrl = len(ctrl_runs)
    threshold_run7 = (n_runs_run7 // 2) + 1
    threshold_ctrl = (n_runs_ctrl // 2) + 1

    rows = []
    moved_loose = 0
    moved_strict = 0

    for item, pair_samples in sorted(md_items.items()):
        ctrl_statuses = [
            (ctrl_runs.get(ri, {}).get(item) or {}).get("status", "absent")
            for ri in sorted(ctrl_runs.keys())
        ]
        run7_statuses = [
            (run7_runs.get(ri, {}).get(item) or {}).get("status", "absent")
            for ri in sorted(run7_runs.keys())
        ]
        ctrl_majority, ctrl_dist = majority_status(ctrl_statuses)
        run7_majority, run7_dist = majority_status(run7_statuses)

        ctrl_unanimous_unverifiable = (
            all(s == "not-verifiable" for s in ctrl_statuses) and ctrl_statuses
        )
        moved_strict_flag = ctrl_unanimous_unverifiable and run7_majority not in ("not-verifiable", "absent")
        moved_loose_flag = (
            ctrl_majority == "not-verifiable"
            and run7_majority not in ("not-verifiable", "absent")
        )
        if moved_strict_flag:
            moved_strict += 1
        if moved_loose_flag:
            moved_loose += 1
        rows.append({
            "item": item,
            "ctrl_majority": ctrl_majority,
            "ctrl_dist": ctrl_dist,
            "run7_majority": run7_majority,
            "run7_dist": run7_dist,
            "n_pairs": len(pair_samples),
            "sample_distances": pair_samples[:3],
            "moved_loose": moved_loose_flag,
            "moved_strict": moved_strict_flag,
        })

    pass_count = sum(1 for r in rows if r["moved_loose"] and r["run7_majority"] == "pass")
    fail_count = sum(1 for r in rows if r["moved_loose"] and r["run7_majority"] == "fail")
    items_processed = len(rows)

    lines = []
    lines.append("# RUN_7_BACKUP_LOCAL_3_RUNS vs ctrl — verdict comparison")
    lines.append("")
    lines.append(
        "Apples-to-apples comparison: both runs are runs=3, both use the "
        "strict-majority predicate (2-of-3 runs must agree). Restricted to "
        "items where measure-distance ran successfully (≥1 pair returned a "
        "distance) on RUN_7."
    )
    lines.append("")
    lines.append("## Headline")
    lines.append("")
    lines.append(f"- **Items where measure-distance succeeded in RUN_7:** {items_processed}")
    lines.append(
        f"- **Items where ctrl was *majority* `not-verifiable` AND RUN_7 produced a real verdict (pass/fail):** {moved_loose} ({pass_count} pass, {fail_count} fail)"
    )
    lines.append(
        f"- **Items where ctrl was *unanimous* `not-verifiable` AND RUN_7 produced a real verdict (stricter):** {moved_strict}"
    )
    lines.append("")
    lines.append("## Per-item verdict comparison")
    lines.append("")
    lines.append(
        "Moved column: ✓ = ctrl unanimously `not-verifiable` (3/3 runs); ◐ = "
        "ctrl majority `not-verifiable` but at least one run dissented; — = "
        "ctrl had a stable non-unverifiable verdict already, or RUN_7 also said `not-verifiable`."
    )
    lines.append("")
    lines.append("| Item | ctrl majority | ctrl distribution | RUN_7 majority | RUN_7 distribution | Moved | Pairs measured |")
    lines.append("|---|---|---|---|---|:---:|---:|")
    for r in rows:
        if r["moved_strict"]:
            marker = "✓"
        elif r["moved_loose"]:
            marker = "◐"
        else:
            marker = "—"
        lines.append(
            f"| `{r['item']}` | `{r['ctrl_majority']}` | {r['ctrl_dist']} | `{r['run7_majority']}` | {r['run7_dist']} | {marker} | {r['n_pairs']} |"
        )
    lines.append("")

    lines.append("## Sample measurements (RUN_7, top items)")
    lines.append("")
    for r in rows:
        if not r["sample_distances"]:
            continue
        lines.append(f"### `{r['item']}` — RUN_7 verdict: `{r['run7_majority']}` (ctrl: `{r['ctrl_majority']}`)")
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
    print(f"Items with successful measure-distance: {items_processed}")
    print(f"Moved (ctrl majority not-verifiable -> RUN_7 real verdict): {moved_loose} ({pass_count} pass, {fail_count} fail)")
    print(f"  of which strict (ctrl unanimous not-verifiable): {moved_strict}")
    print()
    print("Per-item:")
    for r in rows:
        marker = ""
        if r["moved_strict"]:
            marker = " <-- moved (ctrl unanimous)"
        elif r["moved_loose"]:
            marker = " <-- moved (ctrl majority)"
        print(
            f"  {r['item']:10}  ctrl={r['ctrl_majority']:18} ({r['ctrl_dist']:30})  "
            f"run7={r['run7_majority']:18} ({r['run7_dist']:30})  pairs={r['n_pairs']}{marker}"
        )


if __name__ == "__main__":
    main()
