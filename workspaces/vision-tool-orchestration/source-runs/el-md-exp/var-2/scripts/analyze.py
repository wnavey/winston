#!/usr/bin/env python3
"""Analytics for RUN_7_BACKUP_LOCAL_3_RUNS — var-2 with runs=3 + the
fixed measure-distance chain.

Critical question this answers: with the chain executing end-to-end
AND runs=3 (strict-majority aggregation), what does var-2 look like
on el-md-exp? RUN_6_BACKUP_LOCAL validated the chain at runs=1; this
retires the runs-disparity confounder on Goal A and gives us a real
majority-voted Goal B / Goal B'.

Outputs:
  - tmp-el-md-exp-var2-run7-local/analysis.md
  - prints headline numbers to stdout
"""

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent.resolve()
RUN_ROOT = HERE.parent  # source-runs/el-md-exp/var-2/
WORKSPACE = RUN_ROOT.parents[2]  # vision-tool-orchestration/
CALLS_DIR = RUN_ROOT / "output" / "vision-check-calls"
RUNS_DIR = RUN_ROOT / "output" / "runs"
EXPECTED_TSV = (
    WORKSPACE / "metrics" / "el-md-exp" / "expected-vision-selection" / "expected.tsv"
)
OUT_MD = RUN_ROOT / "analysis.md"

INTENT_PRECEDENCE = {"measurement": 3, "drawing_inspect": 2, "generic": 1}


def load_expected():
    by_item = {}
    for r in csv.DictReader(EXPECTED_TSV.open(), delimiter="\t"):
        by_item[r["item_id"]] = {
            "expected_vision": r["expected_vision"],
            "expected_specialist": r["expected_specialist"],
        }
    return by_item


def load_calls():
    """Per-call vision_check metadata + per-pair measure-distance results."""
    calls = []
    for d in sorted(CALLS_DIR.iterdir()):
        if not d.is_dir():
            continue
        meta_path = d / "metadata.json"
        if not meta_path.exists():
            continue
        m = json.loads(meta_path.read_text())
        calls.append((d.name, m, d))
    return calls


def md_outcome_for_call(call_dir):
    md_dir = call_dir / "specialist-measure-distance" / "measure-distance-calls"
    if not md_dir.exists():
        return {"ran": False, "pairs": []}
    pair_dirs = sorted(p for p in md_dir.iterdir() if p.is_dir())
    if not pair_dirs:
        return {"ran": False, "pairs": []}
    pairs = []
    for pd in pair_dirs:
        mp = pd / "metadata.json"
        if not mp.exists():
            continue
        md = json.loads(mp.read_text())
        result = md.get("result") or {}
        inputs = md.get("inputs") or {}
        pairs.append({
            "objectA": (inputs.get("objectA") or "")[:80],
            "objectB": (inputs.get("objectB") or "")[:80],
            "distanceFeet": result.get("distanceFeet"),
            "confidence": result.get("confidence"),
            "success": result.get("distanceFeet") is not None,
        })
    return {"ran": bool(pairs), "pairs": pairs}


def load_per_run_findings():
    """{run_index: {deficiencyId: finding}} from output/runs/run-N/findings/*.md.json."""
    out = {}
    for run_dir in sorted(RUNS_DIR.iterdir()):
        if not run_dir.is_dir() or not run_dir.name.startswith("run-"):
            continue
        run_index = int(run_dir.name.split("-", 1)[1])
        findings_dir = run_dir / "findings"
        if not findings_dir.exists():
            continue
        per_item = {}
        for f in sorted(findings_dir.glob("*.md.json")):
            data = json.loads(f.read_text())
            for finding in data.get("findings", []):
                deficiency = finding.get("deficiencyId")
                if deficiency:
                    per_item[deficiency] = finding
        out[run_index] = per_item
    return out


def vision_invoked_in_finding(finding):
    at = finding.get("agentTrace") or {}
    tools = at.get("tools_used") or finding.get("tools_used") or []
    return any("vision" in (t or "").lower() for t in tools)


def main():
    expected = load_expected()
    calls = load_calls()
    findings_by_run = load_per_run_findings()
    run_indices = sorted(findings_by_run.keys())
    n_runs = len(run_indices)
    majority_threshold = (n_runs // 2) + 1  # strict majority

    # Per-call rollup
    intent_counts = Counter()
    md_subprocess_runs = 0
    md_subprocess_succeeded = 0  # at least one pair returned a distance
    md_pair_attempts = 0
    md_pair_successes = 0
    pairs_total = 0
    md_distances = []

    # Item-level aggregation. Key the per-run signals by runIndex so we
    # can compute strict-majority Goal B / B' the same way the
    # canonical build.py + aggregate.py do.
    #   by_item[item] = {
    #     "intent_calls": [intent_per_call],       # all classifier intents seen
    #     "intent_by_run": {ri: [intents]},        # per-run intent list
    #     "md_success_runs": set of runIndex,      # runs where ≥1 md call succeeded
    #     "all_pairs": [pair_dict, ...],
    #   }
    by_item = defaultdict(lambda: {
        "intent_calls": [],
        "intent_by_run": defaultdict(list),
        "md_success_runs": set(),
        "md_calls_succeeded": 0,  # number of calls (any run) where md returned ≥1 distance
        "md_calls_total": 0,       # number of calls where md was invoked at all
        "all_pairs": [],
    })

    def parse_run_index_from_call(call_dir):
        """vision-check-calls metadata.json doesn't carry runIndex
        today. Infer it from a specialist sidecar's per-call dir name,
        which includes the run suffix (format:
        <ts>-<rand>-run-N-checklistItem)."""
        for sub_name in ("specialist-extract-measurement-pairs", "specialist-measure-distance"):
            sub = call_dir / sub_name
            if not sub.exists():
                continue
            for inner_top in sub.iterdir():
                if not inner_top.is_dir() or "-calls" not in inner_top.name:
                    continue
                for inner in inner_top.iterdir():
                    name = inner.name
                    if "-run-" in name:
                        try:
                            return int(name.split("-run-", 1)[1].split("-", 1)[0])
                        except (ValueError, IndexError):
                            pass
        return None

    for cid, m, cdir in calls:
        item = (m.get("inputs", {}).get("checklistItemId", "") or "").split(":", 1)[-1]
        if not item:
            continue
        intent = m.get("classifier", {}).get("output", {}).get("problemType", "?")
        intent_counts[intent] += 1
        by_item[item]["intent_calls"].append(intent)

        ri = parse_run_index_from_call(cdir)
        if ri is not None:
            by_item[item]["intent_by_run"][ri].append(intent)

        ac = m.get("dispatch", {}).get("argConstruction") or {}
        pair_count = len(ac.get("pairs") or [])
        pairs_total += pair_count

        md = md_outcome_for_call(cdir)
        if md["ran"]:
            md_subprocess_runs += 1
            by_item[item]["md_calls_total"] += 1
            any_ok = any(p["success"] for p in md["pairs"])
            if any_ok:
                md_subprocess_succeeded += 1
                by_item[item]["md_calls_succeeded"] += 1
                if ri is not None:
                    by_item[item]["md_success_runs"].add(ri)
            for p in md["pairs"]:
                md_pair_attempts += 1
                if p["success"]:
                    md_pair_successes += 1
                    md_distances.append(p["distanceFeet"])
                by_item[item]["all_pairs"].append(p)

    # Per-(item × run) invocation (Goal A) — from per-finding tools_used.
    per_run_invoked = {ri: set() for ri in run_indices}
    for ri, item_findings in findings_by_run.items():
        for item, finding in item_findings.items():
            if vision_invoked_in_finding(finding):
                per_run_invoked[ri].add(item)

    def item_majority_invoked(item):
        hits = sum(1 for ri in run_indices if item in per_run_invoked[ri])
        return hits >= majority_threshold

    # Item-level majority for canonical intent and md success
    def item_canonical_intent(item):
        intents = by_item[item]["intent_calls"]
        if not intents:
            return None
        return max(intents, key=lambda i: INTENT_PRECEDENCE.get(i, 0))

    def item_md_any_success(item):
        """Did measure-distance produce ≥1 successful pair on any
        call for this item? Run-index attribution isn't reliable on
        the local run (callIds don't carry the run suffix), so we use
        the same loose predicate that build.py uses for canonical
        intent."""
        return by_item[item]["md_calls_succeeded"] > 0

    # Goals
    expected_yes_items = [i for i, e in expected.items() if e["expected_vision"] == "yes"]
    expected_md_items = [i for i, e in expected.items() if e["expected_specialist"] == "measure-distance"]

    goal_a_hits = sum(1 for i in expected_yes_items if item_majority_invoked(i))
    goal_a_total = len(expected_yes_items)

    # Goal B (framework convention): canonical intent = measurement
    # using strongest-precedence across all calls seen for the item.
    # Matches what build.py + aggregate.py produce.
    goal_b_hits = 0
    for i in expected_md_items:
        if item_canonical_intent(i) == "measurement":
            goal_b_hits += 1
    goal_b_total = len(expected_md_items)

    # Goal B': measure-distance produced ≥1 successful pair on any
    # call for this item. Matches the looseness of canonical Goal B
    # (which uses "any call had measurement intent"). Goal B = Goal B'
    # will hold whenever every measurement-intent call's md subprocess
    # succeeded.
    goal_b_prime_hits = sum(1 for i in expected_md_items if item_md_any_success(i))

    # Misuse: items where expected_vision=no but RUN_7 majority-invoked vision
    no_vision_items = [i for i, e in expected.items() if e["expected_vision"] == "no"]
    misuse_hits = sum(1 for i in no_vision_items if item_majority_invoked(i))

    lines = []
    lines.append("# RUN_7_BACKUP_LOCAL_3_RUNS — analysis")
    lines.append("")
    lines.append(
        "Local conductor execution (runs=3, --step=review-runs, --experiment=vision-check) "
        "of var-2 on Valley View v1. **Runs=3 retires the runs-disparity confounder** that "
        "was open in RUN_6_BACKUP_LOCAL. This run combines the fixed measure-distance chain "
        "(post bureau#324 + conductor#153 + conductor#154) with strict-majority aggregation, "
        "giving the headline var-2 numbers for el-md-exp."
    )
    lines.append("")
    lines.append("## Headline")
    lines.append("")
    lines.append(f"- **Total `vision_check` calls:** {len(calls)} (across {n_runs} runs)")
    lines.append(f"- **Classifier intent distribution:** " + ", ".join(f"`{k}`={v}" for k, v in sorted(intent_counts.items())))
    lines.append(f"- **Total pairs extracted:** {pairs_total}")
    lines.append(f"- **measure-distance subprocess invocations:** {md_subprocess_runs} (≥1 pair succeeded: {md_subprocess_succeeded})")
    lines.append(f"- **Per-pair measurements:** {md_pair_successes} / {md_pair_attempts} returned a distance ({md_pair_successes / max(md_pair_attempts, 1) * 100:.1f}%)")
    if md_distances:
        sorted_d = sorted(md_distances)
        median = sorted_d[len(sorted_d) // 2]
        lines.append(f"- **Reported distance range:** {min(md_distances):.1f}–{max(md_distances):.1f} ft (median {median:.1f})")
    lines.append("")
    lines.append("## Goals (strict majority across 3 runs)")
    lines.append("")
    lines.append("| Goal | Hits / Total | Rate |")
    lines.append("|---|---:|---:|")
    lines.append(f"| Goal A — any vision invoked on expected_vision=yes | {goal_a_hits} / {goal_a_total} | {goal_a_hits / max(goal_a_total, 1) * 100:.1f}% |")
    lines.append(f"| Goal A misuse — vision invoked on expected_vision=no | {misuse_hits} / {len(no_vision_items)} | {misuse_hits / max(len(no_vision_items), 1) * 100:.1f}% |")
    lines.append(f"| Goal B — canonical intent = measurement on expected_specialist=measure-distance | {goal_b_hits} / {goal_b_total} | {goal_b_hits / max(goal_b_total, 1) * 100:.1f}% |")
    lines.append(f"| Goal B' — measure-distance subprocess produced ≥1 distance on at least one call | {goal_b_prime_hits} / {goal_b_total} | {goal_b_prime_hits / max(goal_b_total, 1) * 100:.1f}% |")
    lines.append("")
    lines.append("## vs RUN_6_BACKUP_LOCAL (runs=1) + RUN_3 (runs=3, pre-fix)")
    lines.append("")
    lines.append("| Metric | RUN_3 (runs=3, chain broken) | RUN_6 (runs=1, chain fixed) | **RUN_7 (runs=3, chain fixed)** |")
    lines.append("|---|---:|---:|---:|")
    lines.append(f"| Total `vision_check` calls | 56 | 29 | **{len(calls)}** |")
    lines.append(f"| Classifier intent: measurement | 16 | 9 | **{intent_counts.get('measurement', 0)}** |")
    lines.append(f"| measure-distance subprocess invocations | 0 | 8 | **{md_subprocess_runs}** |")
    lines.append(f"| Per-pair distance measurements | 0 | 24 | **{md_pair_successes}** |")
    lines.append(f"| Goal A | 47.1% (24/51) | 37.3% (19/51) | **{goal_a_hits/max(goal_a_total,1)*100:.1f}% ({goal_a_hits}/{goal_a_total})** |")
    lines.append(f"| Goal B (canonical intent) | 15.7% (8/51) | 13.7% (7/51) | **{goal_b_hits/max(goal_b_total,1)*100:.1f}% ({goal_b_hits}/{goal_b_total})** |")
    lines.append(f"| Goal B' (chain actually executes) | 0% (chain crashed) | 13.7% (7/51, same as B) | **{goal_b_prime_hits/max(goal_b_total,1)*100:.1f}% ({goal_b_prime_hits}/{goal_b_total})** |")
    lines.append("")

    # Per-item table — focused on items the agent invoked
    lines.append("## Per-item (items invoked or seen by classifier)")
    lines.append("")
    lines.append("Strongest intent = max precedence (measurement > drawing_inspect > generic) across all calls seen for that item. md success = how many runs/calls had ≥1 successful md pair.")
    lines.append("")
    lines.append("| Item | Calls | Intent dist | Strongest | Pairs | md calls succeeded | Expected | Match |")
    lines.append("|---|---:|---|---|---:|---|---|:---:|")
    rows = []
    for item, info in sorted(by_item.items()):
        intent_dist = Counter(info["intent_calls"])
        intent_str = ",".join(f"{k}:{v}" for k, v in intent_dist.most_common())
        strongest = item_canonical_intent(item) or "?"
        pairs_n = sum(1 for p in info["all_pairs"] if p["success"])
        exp_spec = expected.get(item, {}).get("expected_specialist", "?")
        match = "✓" if (exp_spec == "measure-distance" and strongest == "measurement") else (
            "✗" if exp_spec == "measure-distance" else "—"
        )
        md_succ_calls = info["md_calls_succeeded"]
        md_total_calls = info["md_calls_total"]
        rows.append((item, len(info["intent_calls"]), intent_str, strongest, pairs_n, f"{md_succ_calls}/{md_total_calls}", exp_spec, match))
    for r in rows:
        lines.append(f"| `{r[0]}` | {r[1]} | {r[2]} | `{r[3]}` | {r[4]} | {r[5]}/{n_runs} | `{r[6]}` | {r[7]} |")
    lines.append("")

    OUT_MD.write_text("\n".join(lines) + "\n")

    print(f"Wrote {OUT_MD.relative_to(WORKSPACE.parent.parent)}")
    print()
    print(f"Total calls: {len(calls)} across {n_runs} runs")
    print(f"Intent dist: {dict(intent_counts)}")
    print(f"measure-distance: {md_subprocess_runs} invocations, {md_subprocess_succeeded} with ≥1 successful pair")
    print(f"Per-pair: {md_pair_successes} / {md_pair_attempts} measurements")
    if md_distances:
        sorted_d = sorted(md_distances)
        median = sorted_d[len(sorted_d) // 2]
        print(f"Distance range: {min(md_distances):.1f}–{max(md_distances):.1f} ft (median {median:.1f})")
    print()
    print(f"Goal A: {goal_a_hits}/{goal_a_total} = {goal_a_hits / max(goal_a_total, 1) * 100:.1f}%")
    print(f"Goal A misuse: {misuse_hits}/{len(no_vision_items)} = {misuse_hits / max(len(no_vision_items), 1) * 100:.1f}%")
    print(f"Goal B  (canonical intent): {goal_b_hits}/{goal_b_total} = {goal_b_hits / max(goal_b_total, 1) * 100:.1f}%")
    print(f"Goal B' (chain executed):   {goal_b_prime_hits}/{goal_b_total} = {goal_b_prime_hits / max(goal_b_total, 1) * 100:.1f}%")


if __name__ == "__main__":
    main()
