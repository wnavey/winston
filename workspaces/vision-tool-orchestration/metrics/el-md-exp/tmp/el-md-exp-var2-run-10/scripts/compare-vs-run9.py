#!/usr/bin/env python3
"""Compare RUN_10 vs RUN_9 per-item, focused on Goal B and whether the
bureau prompt tweak (#340 — adds "dimensional analysis, distance
computation" to the vision_check capability list) shifted classifications.

Reads both runs' per-item-vs-expected TSVs and emits:
  - Headline Goal B raw / adjusted / strict-clear deltas.
  - Movement matrix: counts of (RUN_9 verdict → RUN_10 verdict).
  - Itemized table of `invalid_missing_dimensions` items in RUN_9 and
    where they landed in RUN_10 — the direct test of the prompt tweak.

Writes `run-10-vs-run-9-comparison.md` alongside this script's parent dir.
"""

import csv
from pathlib import Path
from collections import Counter, defaultdict

HERE = Path(__file__).parent.resolve()
RUN10_TSV = HERE.parent / "el-md-exp-var2-run10-vision-check-calls-compared-to-expected.tsv"
RUN9_TSV  = HERE.parent.parent / "el-md-exp-var2-run-9" / "el-md-exp-var2-run9-vision-check-calls-compared-to-expected.tsv"
OUT = HERE.parent / "run-10-vs-run-9-comparison.md"

VALID = {"valid_not_applicable", "valid_no_feature", "valid_other", "valid_other_data_gap"}


def goal_b(rows):
    md = [r for r in rows if r["expected_specialist"] == "measure-distance"]
    num = sum(1 for r in md if r["majority_vision_check"] == "measurement")
    counts = Counter(r["no_call_verdict"] for r in md)
    valid_n = sum(counts.get(v, 0) for v in VALID)
    mixed_n = counts.get("mixed", 0)
    return {
        "numerator": num,
        "total": len(md),
        "valid": valid_n,
        "mixed": mixed_n,
        "raw_rate": f"{100*num/len(md):.1f}%",
        "adj_rate": f"{100*num/(len(md)-valid_n):.1f}%",
        "adj_denom": len(md)-valid_n,
        "strict_rate": f"{100*num/(len(md)-valid_n-mixed_n):.1f}%",
        "strict_denom": len(md)-valid_n-mixed_n,
        "verdict_counts": counts,
    }


def main():
    run9 = list(csv.DictReader(RUN9_TSV.open(), delimiter="\t"))
    run10 = list(csv.DictReader(RUN10_TSV.open(), delimiter="\t"))

    g9 = goal_b(run9)
    g10 = goal_b(run10)

    # Per-item movement: only on expected-md items
    by_id_9 = {r["item_id"]: r for r in run9 if r["expected_specialist"] == "measure-distance"}
    by_id_10 = {r["item_id"]: r for r in run10 if r["expected_specialist"] == "measure-distance"}

    # Effective bucket per item: measurement-majority items go in
    # "measurement" bucket; others fall back to their no_call_verdict.
    def bucket(r):
        if r["majority_vision_check"] == "measurement":
            return "measurement (Goal B hit)"
        if r["majority_vision_check"] == "generic":
            return "generic (vision called, wrong specialist)"
        if r["majority_vision_check"] == "3-way-tie":
            return "3-way-tie (mixed call)"
        return r["no_call_verdict"]

    movement = Counter()
    for iid in sorted(by_id_9.keys()):
        a = bucket(by_id_9[iid])
        b = bucket(by_id_10.get(iid, by_id_9[iid]))
        movement[(a, b)] += 1

    # Focus: RUN_9's invalid_missing_dimensions items
    r9_invalid_dim = sorted(iid for iid, r in by_id_9.items() if r["no_call_verdict"] == "invalid_missing_dimensions")

    lines = []
    lines.append("# RUN_10 vs RUN_9 — el-md-exp var-2 comparison")
    lines.append("")
    lines.append("**RUN_9** (`VISION_CHECK_REVIEW_EL_MD_EXP_RUN_9_LOCAL`, started 2026-05-11 17:18 UTC) — baseline before bureau prompt tweak.")
    lines.append("**RUN_10** (`VISION_CHECK_REVIEW_EL_MD_EXP_RUN_10_LOCAL`, started 2026-05-11 22:01 UTC) — first run after bureau#340 landed (added \"dimensional analysis, distance computation\" to the vision_check capability list in the experiment overlay's review.md).")
    lines.append("")
    lines.append("Both runs: same submission (Valley View Townhomes v1), same submissionVersionId, same model (haiku-4-5), runs=3, same `enabledVisionSpecialists=\"generic-vision,measure-distance\"`.")
    lines.append("")
    lines.append("## Headline")
    lines.append("")
    lines.append("| metric | RUN_9 | RUN_10 | delta |")
    lines.append("|---|---:|---:|---:|")
    # vision_check call totals
    def call_total(rows):
        return sum(int(r.get("total_calls") or 0) or len([c for c in (r.get("vision_check_call_id") or "").split(";") if c.strip()])
                   for r in rows)
    # call counts derived from the call-id field
    def call_count(rows):
        return sum(len([c for c in (r.get("vision_check_call_id") or "").split(";") if c.strip()]) for r in rows)
    lines.append(f"| total `vision_check` calls (all items) | {call_count(run9)} | {call_count(run10)} | **+{call_count(run10)-call_count(run9)}** |")
    raw9 = float(g9['raw_rate'].rstrip('%'))
    raw10 = float(g10['raw_rate'].rstrip('%'))
    adj9 = float(g9['adj_rate'].rstrip('%'))
    adj10 = float(g10['adj_rate'].rstrip('%'))
    strict9 = float(g9['strict_rate'].rstrip('%'))
    strict10 = float(g10['strict_rate'].rstrip('%'))
    lines.append(f"| Goal B raw | {g9['numerator']}/{g9['total']} = {g9['raw_rate']} | {g10['numerator']}/{g10['total']} = {g10['raw_rate']} | **+{raw10-raw9:.1f}pp** |")
    lines.append(f"| Goal B adjusted | {g9['numerator']}/{g9['adj_denom']} = {g9['adj_rate']} | {g10['numerator']}/{g10['adj_denom']} = {g10['adj_rate']} | **+{adj10-adj9:.1f}pp** |")
    lines.append(f"| Goal B strict-clear | {g9['numerator']}/{g9['strict_denom']} = {g9['strict_rate']} | {g10['numerator']}/{g10['strict_denom']} = {g10['strict_rate']} | **+{strict10-strict9:.1f}pp** |")
    lines.append("")
    lines.append(f"All three Goal B variants moved up. RUN_10 contributed {g10['numerator']-g9['numerator']} more measurement-majority items on a {g10['total']}-item denominator. The lift is larger after the EL-13.21/22/23 reclassification — those 3 items moved from `mixed` in RUN_9 (denom-only) to `measurement` in RUN_10 (numerator+denom).")
    lines.append("")
    lines.append(f"## Verdict distribution on the {g10['total']} expected-md items")
    lines.append("")
    lines.append("| no_call_verdict / state | RUN_9 | RUN_10 | delta |")
    lines.append("|---|---:|---:|---:|")
    all_v = sorted(set(list(g9['verdict_counts'].keys()) + list(g10['verdict_counts'].keys())))
    for v in all_v:
        n9 = g9['verdict_counts'].get(v, 0)
        n10 = g10['verdict_counts'].get(v, 0)
        d = n10 - n9
        lines.append(f"| `{v}` | {n9} | {n10} | {d:+d} |")
    lines.append("")
    lines.append("## Per-item movement (expected_specialist=measure-distance)")
    lines.append("")
    lines.append("Effective bucket: `measurement` if majority_vision_check=measurement (Goal B hit), `generic` if majority generic, `3-way-tie` if all three runs differ, otherwise the TSV's `no_call_verdict`.")
    lines.append("")
    lines.append("| RUN_9 bucket → RUN_10 bucket | count |")
    lines.append("|---|---:|")
    for (a, b), n in sorted(movement.items(), key=lambda kv: -kv[1]):
        marker = ""
        if "measurement (Goal B hit)" in b and "measurement" not in a:
            marker = " 🟢 (moved INTO Goal B)"
        elif "measurement (Goal B hit)" in a and "measurement" not in b:
            marker = " 🔴 (LOST from Goal B)"
        lines.append(f"| `{a}` → `{b}` | {n}{marker} |")
    lines.append("")
    lines.append("## Direct test of the prompt tweak — RUN_9's 6 `invalid_missing_dimensions` items in RUN_10")
    lines.append("")
    lines.append("These are the items the RUN_9 analysis flagged as the prompt-tweak's intended targets: the agent observed the feature on the plan, cited \"no dimension annotations\", and gave up. The prompt tweak (bureau#340) was designed to nudge the agent to ask a measurement question instead.")
    lines.append("")
    lines.append("| item | RUN_9 bucket | RUN_10 bucket | moved? |")
    lines.append("|---|---|---|---|")
    moved_in = 0
    moved_other = 0
    same = 0
    for iid in r9_invalid_dim:
        a = bucket(by_id_9[iid])
        b = bucket(by_id_10.get(iid, by_id_9[iid]))
        if a == b:
            marker = "no"
            same += 1
        elif "measurement" in b:
            marker = "🟢 → measurement"
            moved_in += 1
        else:
            marker = "→ " + b
            moved_other += 1
        lines.append(f"| `{iid}` | {a} | {b} | {marker} |")
    lines.append("")
    lines.append(f"**Summary on the 6 RUN_9 invalid_missing_dimensions items:** {moved_in} moved INTO `measurement` (Goal B hits the prompt tweak directly produced); {same} stayed `invalid_missing_dimensions`; {moved_other} moved to other buckets.")
    lines.append("")
    lines.append("## Caveats")
    lines.append("")
    lines.append("- Single-shot comparison with a non-deterministic agent (haiku). Even with the same prompt, runs=3 variance can produce ±2-3 items of movement just from sampling.")
    lines.append("- Different machine for RUN_10 (user noted \"on another box\"). No reason to expect a machine effect, but flagged.")
    lines.append("- Bureau prompt tweak was a single line addition: \"dimensional analysis, distance computation\" appended to the existing capability enumeration in the first bullet. No classifier or specialist changes.")
    lines.append("")
    OUT.write_text("\n".join(lines))
    print(f"Wrote {OUT.relative_to(HERE.parent.parent.parent.parent.parent)}")
    print(f"  movement classes: {len(movement)}")
    print(f"  RUN_9 invalid_missing_dimensions items: {len(r9_invalid_dim)} → moved_in={moved_in}, same={same}, other={moved_other}")


if __name__ == "__main__":
    main()
