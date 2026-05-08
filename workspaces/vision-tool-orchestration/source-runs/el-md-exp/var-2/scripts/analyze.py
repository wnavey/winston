#!/usr/bin/env python3
"""Ad-hoc analytics for the RUN_6_BACKUP_LOCAL diagnostic re-run.

Same shape as the prior tmp/scripts/analyze.py but adapted for
runs=1 + scoped to step=review-runs (no consolidated-findings.json).
Reads the run in place and produces a one-pass summary.

Critical question this answers: did the bureau#324 + conductor#154
plumbing actually fix the measurement chain end-to-end? Specifically,
how many measure-distance subprocesses ran successfully (vs the prior
RUN_5_BACKUP_LOCAL where every one crashed on plan_set_version
lookup).

Outputs:
  - tmp-el-md-exp-var2-run6-local/analysis.md (human-readable)
  - prints headline numbers to stdout
"""

import csv
import json
from collections import defaultdict
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


def load_expected():
    by_item = {}
    for r in csv.DictReader(EXPECTED_TSV.open(), delimiter="\t"):
        by_item[r["item_id"]] = {
            "expected_vision": r["expected_vision"],
            "expected_specialist": r["expected_specialist"],
        }
    return by_item


def load_calls():
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


def load_findings_invocation():
    invoked = set()
    for run_dir in sorted(RUNS_DIR.iterdir()):
        if not run_dir.is_dir() or not run_dir.name.startswith("run-"):
            continue
        findings_dir = run_dir / "findings"
        if not findings_dir.exists():
            continue
        for f in sorted(findings_dir.glob("*.md.json")):
            data = json.loads(f.read_text())
            for finding in data.get("findings", []):
                item = finding.get("deficiencyId", "")
                tools = (finding.get("agentTrace") or {}).get("tools_used") or finding.get("tools_used") or []
                if any("vision" in (t or "").lower() for t in tools):
                    invoked.add(item)
    return invoked


def measure_distance_outcome(call_dir: Path) -> dict:
    """Walk specialist-measure-distance/measure-distance-calls/<sessionId-p<n>>/metadata.json
    per pair. measure-distance writes one subdir per pair within the
    session, each with its own metadata.json carrying `result.distanceFeet`,
    `result.confidence`, `optionB.success`, etc.

    Returns {"ran": bool (any pair has metadata), "success": bool (all
    pairs that ran reported a distanceFeet), "pairCount": int, "perPair":
    [...]}.
    """
    md_dir = call_dir / "specialist-measure-distance" / "measure-distance-calls"
    if not md_dir.exists():
        return {"ran": False, "success": False, "pairCount": 0, "perPair": []}
    pair_dirs = sorted([p for p in md_dir.iterdir() if p.is_dir()])
    if not pair_dirs:
        return {"ran": False, "success": False, "pairCount": 0, "perPair": []}

    per_pair = []
    any_ran = False
    all_succeeded = True
    for pair_dir in pair_dirs:
        meta_path = pair_dir / "metadata.json"
        if not meta_path.exists():
            all_succeeded = False
            continue
        any_ran = True
        md_meta = json.loads(meta_path.read_text())
        result = md_meta.get("result") or {}
        option_b = md_meta.get("optionB") or {}
        inputs = md_meta.get("inputs") or {}
        distance_ft = result.get("distanceFeet")
        success = distance_ft is not None and bool(option_b.get("success", True))
        if not success:
            all_succeeded = False
        per_pair.append({
            "objectA": (inputs.get("objectA") or "")[:80],
            "objectB": (inputs.get("objectB") or "")[:80],
            "distanceFeet": distance_ft,
            "confidence": result.get("confidence"),
            "method": result.get("method"),
            "success": success,
        })
    return {
        "ran": any_ran,
        "success": all_succeeded and bool(per_pair),
        "pairCount": len(per_pair),
        "perPair": per_pair,
    }


def main():
    expected = load_expected()
    calls = load_calls()
    invoked_items = load_findings_invocation()

    INTENT_PRECEDENCE = {"measurement": 3, "drawing_inspect": 2, "generic": 1}
    by_item = defaultdict(lambda: {
        "n_calls": 0,
        "intents": [],
        "pair_counts": [],
        "md_ran": 0,
        "md_succeeded": 0,
    })
    intent_counts = defaultdict(int)
    md_subprocess_runs = 0
    md_any_pair_succeeded = 0  # ≥1 pair returned a distance
    md_all_pairs_succeeded = 0  # every pair returned a distance
    md_pair_attempts = 0
    md_pair_successes = 0
    pairs_total = 0
    md_distances = []  # all reported distanceFeet values
    md_sample = []  # for showing concrete examples in the report

    for cid, m, call_dir in calls:
        item = (m.get("inputs", {}).get("checklistItemId", "") or "").split(":", 1)[-1]
        if not item:
            continue
        intent = m.get("classifier", {}).get("output", {}).get("problemType", "?")
        dispatch = m.get("dispatch", {})
        ac = dispatch.get("argConstruction") or {}
        pairs = ac.get("pairs") or []
        success = dispatch.get("success", False)

        intent_counts[intent] += 1
        pairs_total += len(pairs)
        by_item[item]["n_calls"] += 1
        by_item[item]["intents"].append(intent)
        if pairs:
            by_item[item]["pair_counts"].append(len(pairs))

        # Check whether measure-distance actually ran + succeeded.
        md_outcome = measure_distance_outcome(call_dir)
        if md_outcome["ran"]:
            md_subprocess_runs += 1
            by_item[item]["md_ran"] += 1
            any_pair_ok = any(pp.get("success") for pp in md_outcome["perPair"])
            all_pairs_ok = all(pp.get("success") for pp in md_outcome["perPair"]) if md_outcome["perPair"] else False
            if any_pair_ok:
                md_any_pair_succeeded += 1
                by_item[item]["md_succeeded"] += 1
            if all_pairs_ok:
                md_all_pairs_succeeded += 1
            for pp in md_outcome["perPair"]:
                md_pair_attempts += 1
                if pp.get("distanceFeet") is not None:
                    md_pair_successes += 1
                    md_distances.append(pp["distanceFeet"])
                if len(md_sample) < 6 and pp.get("success"):
                    md_sample.append({
                        "item": item,
                        "objectA": pp["objectA"],
                        "objectB": pp["objectB"],
                        "distanceFeet": pp["distanceFeet"],
                        "confidence": pp.get("confidence"),
                    })

    expected_md_items = [i for i, e in expected.items() if e["expected_specialist"] == "measure-distance"]
    expected_yes_items = [i for i, e in expected.items() if e["expected_vision"] == "yes"]

    goal_a_hits = sum(1 for i in expected_yes_items if i in invoked_items)
    goal_a_total = len(expected_yes_items)

    goal_b_hits = 0
    for i in expected_md_items:
        info = by_item.get(i)
        if not info:
            continue
        strongest = max(info["intents"], key=lambda x: INTENT_PRECEDENCE.get(x, 0), default="?")
        if strongest == "measurement":
            goal_b_hits += 1
    goal_b_total = len(expected_md_items)

    rows = []
    for item, info in sorted(by_item.items()):
        exp = expected.get(item, {})
        strongest = max(info["intents"], key=lambda x: INTENT_PRECEDENCE.get(x, 0), default="?")
        exp_spec = exp.get("expected_specialist", "?")
        match = "✓" if (exp_spec == "measure-distance" and strongest == "measurement") else (
            "✗" if exp_spec == "measure-distance" else "—"
        )
        rows.append({
            "item": item,
            "n_calls": info["n_calls"],
            "intents": ",".join(info["intents"]),
            "strongest": strongest,
            "pairs": sum(info["pair_counts"]),
            "md_ran": info["md_ran"],
            "md_succeeded": info["md_succeeded"],
            "expected": exp_spec,
            "match": match,
        })

    lines = []
    lines.append("# RUN_6_BACKUP_LOCAL — analysis")
    lines.append("")
    lines.append("Diagnostic local re-run (runs=1, --step=review-runs) of var-2 on Valley View v1, post bureau#324 + conductor#154 (submissionVersionId plumbing + lib migration). Validates that the measure-distance chain now runs end-to-end after the prior `version_number` ordering bug + the silent-wrong-submission footgun were fixed.")
    lines.append("")
    lines.append("## Headline")
    lines.append("")
    lines.append(f"- **Total `vision_check` calls:** {len(calls)}")
    lines.append(f"- **Classifier intent distribution:** " + ", ".join(f"`{k}`={v}" for k, v in sorted(intent_counts.items())))
    lines.append(f"- **Total pairs extracted:** {pairs_total} across {sum(1 for _ in by_item.values() if _['pair_counts'])} measurement-routed calls (avg {pairs_total / max(intent_counts.get('measurement', 1), 1):.1f} pairs/call)")
    lines.append(f"- **measure-distance subprocess invocations:** {md_subprocess_runs} (≥1 pair succeeded: {md_any_pair_succeeded}, all pairs succeeded: {md_all_pairs_succeeded})")
    lines.append(f"- **Per-pair measurements:** {md_pair_successes} / {md_pair_attempts} returned a distance ({md_pair_successes / max(md_pair_attempts, 1) * 100:.1f}%)")
    if md_distances:
        sorted_d = sorted(md_distances)
        median = sorted_d[len(sorted_d) // 2]
        lines.append(f"- **Reported distance range:** {min(md_distances):.1f}–{max(md_distances):.1f} ft (median {median:.1f})")
    lines.append("")
    lines.append("## vs RUN_5_BACKUP_LOCAL (pre-fix)")
    lines.append("")
    lines.append("| Metric | RUN_5_BACKUP_LOCAL | RUN_6_BACKUP_LOCAL |")
    lines.append("|---|---:|---:|")
    lines.append(f"| Total `vision_check` calls | 20 | {len(calls)} |")
    lines.append(f"| Pairs extracted (total) | 30 | {pairs_total} |")
    lines.append(f"| measure-distance subprocesses ran | 0 | {md_subprocess_runs} |")
    lines.append(f"| measure-distance subprocesses with ≥1 successful pair | 0 | {md_any_pair_succeeded} |")
    lines.append(f"| Per-pair distance measurements computed | 0 | {md_pair_successes} |")
    lines.append("")
    if md_sample:
        lines.append("### Sample measurements")
        lines.append("")
        lines.append("| Item | objectA | objectB | Distance (ft) | Confidence |")
        lines.append("|---|---|---|---:|---|")
        for s in md_sample:
            lines.append(f"| `{s['item']}` | {s['objectA']} | {s['objectB']} | {s['distanceFeet']:.1f} | {s['confidence'] or '—'} |")
        lines.append("")
    lines.append("## Goal A — overall vision invocation hit rate")
    lines.append("")
    lines.append(f"`vision_check` was invoked (per `agentTrace.tools_used`) on **{goal_a_hits} / {goal_a_total}** items where `expected_vision=yes` ({goal_a_hits / max(goal_a_total, 1) * 100:.1f}%).")
    lines.append("")
    lines.append("## Goal B — specialist routing")
    lines.append("")
    goal_b_pct = goal_b_hits / max(goal_b_total, 1) * 100
    lines.append(f"Of the {goal_b_total} items where `expected_specialist=measure-distance`, **{goal_b_hits}** had the classifier's strongest intent = `measurement` ({goal_b_pct:.1f}% specialist-routing hit rate among expected measurement items).")
    lines.append("")
    lines.append("Goal B here measures *classifier intent*. Now that measure-distance actually invokes successfully, post-RUN_6 we can also report a stricter B' = items that had ≥1 successful measure-distance subprocess run (not just classifier intent).")
    lines.append("")
    md_succeeded_items = sum(1 for i in expected_md_items if by_item.get(i, {}).get("md_succeeded", 0) > 0)
    lines.append(f"**Goal B' (actual measure-distance success):** {md_succeeded_items} / {goal_b_total} = {md_succeeded_items / max(goal_b_total, 1) * 100:.1f}%")
    lines.append("")
    lines.append("## Per-item table")
    lines.append("")
    lines.append("| Item | Calls | Strongest intent | Pairs | md ran | md succeeded | Expected | Match |")
    lines.append("|---|---:|---|---:|---:|---:|---|:---:|")
    for r in rows:
        lines.append(
            f"| `{r['item']}` | {r['n_calls']} | `{r['strongest']}` | {r['pairs']} | {r['md_ran']} | {r['md_succeeded']} | `{r['expected']}` | {r['match']} |"
        )
    lines.append("")

    OUT_MD.write_text("\n".join(lines) + "\n")

    print(f"Wrote {OUT_MD.relative_to(WORKSPACE.parent.parent)}")
    print()
    print(f"Total calls: {len(calls)}")
    print(f"Intent dist: {dict(intent_counts)}")
    print(f"Pairs extracted: {pairs_total}")
    print(f"measure-distance: {md_subprocess_runs} runs, {md_any_pair_succeeded} with ≥1 successful pair, {md_all_pairs_succeeded} with all pairs successful")
    print(f"Per-pair measurements: {md_pair_successes} / {md_pair_attempts}")
    if md_distances:
        sorted_d = sorted(md_distances)
        median = sorted_d[len(sorted_d) // 2]
        print(f"Distance range: {min(md_distances):.1f}–{max(md_distances):.1f} ft (median {median:.1f})")
    print(f"Goal A: {goal_a_hits}/{goal_a_total} = {goal_a_hits / max(goal_a_total, 1) * 100:.1f}%")
    print(f"Goal B (intent): {goal_b_hits}/{goal_b_total} = {goal_b_pct:.1f}%")
    print(f"Goal B' (md actually succeeded): {md_succeeded_items}/{goal_b_total} = {md_succeeded_items / max(goal_b_total, 1) * 100:.1f}%")


if __name__ == "__main__":
    main()
