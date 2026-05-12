#!/usr/bin/env python3
"""Generate run-10-no-vision-check-analysis.md.

For every item where expected_specialist=measure-distance but the
strict-majority across 3 runs did NOT pick `measurement`, read each
run's finding (status + agentTrace.observation + agentTrace.reasoning)
and classify the skip as 'valid' (feature not present, or vision
genuinely irrelevant) vs 'invalid' (agent gave up due to missing
dimensions — which is exactly when measure-distance should fire).

Classification heuristics (applied per item, aggregating across 3 runs):

- `valid_not_applicable`: majority of runs status=`n/a` AND reasoning
  cites "not applicable" / "not a triggering condition" / feature not
  present. The checklist item doesn't apply to this site.

- `valid_no_feature`: majority of runs say the relevant feature (e.g.
  retaining walls, transformer pads, fences) is NOT present on the
  plan. Nothing to measure.

- `invalid_missing_dimensions`: majority of runs status=`not-verifiable`
  with reasoning citing "no dimension annotations", "not dimensioned",
  "clearance dimensions not provided", or similar. This is the exact
  signal that measure-distance should fire — the agent gave up where
  the specialist would have computed the distance.

- `invalid_partial_observation`: agent observed the feature on the
  plan AND noted lack of dimensions, but only invoked generic vision
  (not measurement). Subset of the above with vision invoked.

- `mixed`: runs disagree materially; status mix of n/a + nv + fail.
  Inconclusive.

- `valid_other`: pass/fail verdicts that were resolvable without
  measurement (e.g. agent confident in a worst-case argument).
"""

import csv, json, re
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(__file__).parent.resolve()
# scripts → tmp/el-md-exp-var2-run-10 → tmp → el-md-exp → metrics → vision-tool-orchestration
WORKSPACE = HERE.parent.parent.parent.parent.parent
TSV = HERE.parent / "el-md-exp-var2-run10-vision-check-calls-compared-to-expected.tsv"
RUNS = WORKSPACE / "source-runs" / "el-md-exp" / "var-2" / "output" / "runs"
OUT = HERE.parent / "run-10-no-vision-check-analysis.md"

# Patterns
PAT_NO_DIM = re.compile(
    r"(no\s+dimension|not\s+dimensioned|dimensions?\s+(are\s+)?not\s+(provided|shown|specified|indicated)"
    r"|clearance\s+(?:distance|dimensions?)\s+(?:are\s+)?not\s+(?:provided|shown|specified|annotated|indicated|verifi)"
    r"|measurement\s+annotations?\s+not"
    r"|not\s+explicitly\s+(?:dimensioned|annotated|labeled|shown\s+with\s+dimensions)"
    r"|specific\s+(?:measurements?|distances?)\s+(?:are\s+)?not"
    r"|without\s+(?:explicit\s+)?(?:dimension|measurement|clearance)\s+(annotations|notes|values)"
    r"|exact\s+(?:dimensions?|distances?|clearance)\s+(?:are\s+)?not"
    r"|specific\s+(?:distances?|dimensions?)\s+(?:are\s+)?(?:not\s+)?(?:clearly\s+)?(?:shown|provided|annotated|indicated|labeled)"
    r"|exact\s+distances?\s+and"
    r"|distance\s+(?:cannot|could\s+not)\s+be"
    r"|cannot\s+be\s+(?:definitively\s+)?(?:determined|measured|verified)\s+from"
    r"|without\s+dimensional\s+(?:correlation|annotation)"
    r"|spatial\s+correlation"
    r"|conflict\s+determination\s+difficult"
    r"|distance[s]?\s+(?:and|or)\s+(?:access\s+door\s+)?locations?\s+(?:are\s+)?not"
    r"|measurement\s+(?:between|of|to)\s+\S+\s+(?:and|to)\s+\S+\s+(?:is\s+)?not)",
    re.I,
)
PAT_NOT_APPLICABLE = re.compile(
    r"(not\s+a\s+triggering\s+condition|requirement\s+does\s+not\s+apply|does\s+not\s+apply"
    r"|n/?a\s+condition|not\s+applicable|no\s+(retaining\s+walls|fences|transformer|substation|bike\s+racks|loading|driveways|trees|swimming|pad-?mounted|guy)\s+(are\s+)?(proposed|shown|on\s+(this\s+)?(plan|site)|present|identified)"
    r"|no\s+\S+\s+identified\s+on\s+the\s+(site\s+)?plan"
    r"|do(?:es)?\s+not\s+(?:apply|trigger)|not\s+triggered|condition\s+(?:is\s+)?absent"
    r"|no\s+(?:swimming|pool|substation|bike|loading|generator|transformer\s+pad)s?\s+(?:are\s+)?proposed)",
    re.I,
)
PAT_FEATURE_NOT_FOUND = re.compile(
    r"(not\s+(visible|shown|present|labeled|depicted|identified)\s+on"
    r"|no\s+\S+\s+(are\s+)?(visible|shown|present|labeled)"
    r"|are\s+not\s+labeled|cannot\s+(identify|locate)"
    r"|no\s+such\s+(?:facilities?|feature)|absent\s+from"
    r"|frequently\s+omitted\s+from\s+(?:site\s+)?plans"
    r"|not\s+(?:clearly\s+)?(?:depicted|documented)"
    r"|cannot\s+be\s+confirmed|documentation\s+gap"
    r"|species\s+(?:identity|identification)\s+(?:not|is\s+not)"
    r"|plant\s+schedule\s+(?:lacks|is\s+missing|does\s+not))",
    re.I,
)

# New: agent says "data is unavailable in any form" — measurement won't help
PAT_DATA_UNAVAILABLE = re.compile(
    r"(species\s+(?:identity|identification|name)|plant\s+schedule|UC\s+designation|utility-compatible\s+(?:status|species)"
    r"|access\s+door\s+orientations?|frequently\s+omitted)",
    re.I,
)


def classify_item(runs):
    """runs: list of (status, observation, reasoning) tuples."""
    statuses = [s for s, _, _ in runs]
    sc = Counter(statuses)

    # Heuristic counts across runs
    n_no_dim = 0
    n_not_app = 0
    n_no_feat = 0
    for _, obs, rsn in runs:
        blob = f"{obs or ''}\n{rsn or ''}"
        if PAT_NO_DIM.search(blob): n_no_dim += 1
        if PAT_NOT_APPLICABLE.search(blob): n_not_app += 1
        if PAT_FEATURE_NOT_FOUND.search(blob): n_no_feat += 1

    # Decision tree
    # 1. Most runs say not-applicable → valid.
    if sc.get("n/a", 0) >= 2 or n_not_app >= 2:
        return "valid_not_applicable", {"n/a_count": sc.get("n/a", 0), "not_app_signal": n_not_app}

    # 2. Most runs say feature isn't on the plan → valid.
    if n_no_feat >= 2 and sc.get("not-verifiable", 0) >= 1:
        # the agent says "I can't find the feature" — vision won't help
        # if the feature doesn't exist on the drawing in the first place
        if n_no_dim < 2:
            return "valid_no_feature", {"no_feature_signal": n_no_feat}

    # 2b. Agent cites non-vision data gap (plant schedule, species names) → valid.
    # measure-distance wouldn't have helped — these need textual data not pixels.
    n_data_gap = sum(1 for _, o, r in runs if PAT_DATA_UNAVAILABLE.search(f"{o}\n{r}"))
    if n_data_gap >= 2 and n_no_dim < 2:
        return "valid_other_data_gap", {"data_gap_signal": n_data_gap}

    # 3. Most runs say "no dimensions" but the feature IS observed → invalid
    if n_no_dim >= 2 and sc.get("not-verifiable", 0) >= 2:
        return "invalid_missing_dimensions", {"no_dim_signal": n_no_dim, "nv_count": sc.get("not-verifiable", 0)}

    # 3b. All 3 runs are not-verifiable — even if regex didn't catch the
    # exact phrase, if expected is measure-distance and the agent failed
    # to verify across all 3 runs without invoking measurement, this is
    # a probable invalid skip. Flag for review.
    if sc.get("not-verifiable", 0) == 3 and n_no_feat < 2 and n_data_gap < 2:
        return "invalid_probable", {"no_dim_signal": n_no_dim, "all_nv": True}

    # 4. The agent reached a verdict (pass/fail) without measurement → valid_other
    if sc.get("pass", 0) + sc.get("fail", 0) >= 2:
        return "valid_other", {"pass": sc.get("pass", 0), "fail": sc.get("fail", 0)}

    # 5. Mixed bag (n/a + nv + fail combos)
    return "mixed", {"status_counts": dict(sc), "no_dim_signal": n_no_dim, "no_feature_signal": n_no_feat, "not_app_signal": n_not_app}


def main():
    targets = [r for r in csv.DictReader(TSV.open(), delimiter="\t")
               if r["expected_specialist"] == "measure-distance"
               and r["majority_vision_check"] != "measurement"]

    findings = defaultdict(dict)
    for run_dir in sorted(RUNS.iterdir()):
        if not run_dir.name.startswith("run-"): continue
        for fp in (run_dir/"findings").glob("*.md.json"):
            d = json.loads(fp.read_text())
            for f in d.get("findings", []):
                findings[f["deficiencyId"]][run_dir.name] = f

    classified = []
    for t in targets:
        iid = t["item_id"]
        runs_data = []
        for ri in ["run-1","run-2","run-3"]:
            f = findings[iid].get(ri) or {}
            at = f.get("agentTrace") or {}
            runs_data.append((f.get("status"), at.get("observation") or "", at.get("reasoning") or ""))
        verdict, sig = classify_item(runs_data)
        classified.append({
            "item": t,
            "runs_data": runs_data,
            "verdict": verdict,
            "signals": sig,
        })

    # Stats
    by_verdict = Counter(c["verdict"] for c in classified)
    total = len(classified)

    # Build MD
    lines = []
    lines.append("# RUN_9 — Items where expected `measure-distance` but classifier did NOT pick `measurement`")
    lines.append("")
    lines.append("**Run:** `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_9_LOCAL` · `el-md-exp` · var-2 · 3 runs · haiku · local conductor.")
    lines.append("")
    lines.append("**Scope:** of the 51 items where `expected_specialist = measure-distance`, this analysis covers the **46** where `majority_vision_check ≠ measurement` (43 `none` + 2 `generic` + 1 `3-way-tie`). For each, we read each run's `agentTrace.observation` + `agentTrace.reasoning` and classify the skip as valid (the agent's reasoning shows vision/measure-distance wouldn't have helped) or invalid (the agent gave up exactly where measure-distance would have fired).")
    lines.append("")
    lines.append("**Classification (heuristic, applied per item across the 3 runs):**")
    lines.append("")
    lines.append("| verdict | meaning |")
    lines.append("|---|---|")
    lines.append("| `valid_not_applicable` | ≥2 runs marked `n/a` or reasoning explicitly says \"requirement does not apply\" / \"not a triggering condition\". The checklist item didn't apply to this site. |")
    lines.append("| `valid_no_feature` | ≥2 runs observed that the relevant feature (transformer pads, retaining walls, fences, etc.) is not present on the plan. Nothing to measure. |")
    lines.append("| `valid_other` | ≥2 runs reached a real verdict (pass/fail) without needing measurement (e.g. confident worst-case reasoning). |")
    lines.append("| `valid_other_data_gap` | ≥2 runs cite a non-spatial data gap (plant schedule lacks species names, ECM Appendix F UC designation absent, etc.). measure-distance wouldn't have helped — these need textual data, not pixels. |")
    lines.append("| `invalid_missing_dimensions` | ≥2 runs `not-verifiable` with reasoning citing \"no dimension annotations\" / \"dimensions not provided\" or similar. This is the canonical case for `measure-distance` to fire — the agent gave up exactly where the specialist would have computed the distance. |")
    lines.append("| `invalid_probable` | All 3 runs `not-verifiable` and the agent didn't cite a non-spatial data gap. The agent ran out of options without trying to measure — probable invalid skip but worth manual review since reasoning didn't trip the explicit \"no dimensions\" regex. |")
    lines.append("| `mixed` | Runs disagreed materially; no dominant signal. Inconclusive. |")
    lines.append("")
    lines.append("## Headline")
    lines.append("")
    lines.append(f"Total items analyzed: **{total}**")
    lines.append("")
    lines.append("| verdict | count | share |")
    lines.append("|---|---:|---:|")
    for v in ["invalid_missing_dimensions","invalid_probable","valid_not_applicable","valid_no_feature","valid_other","valid_other_data_gap","mixed"]:
        n = by_verdict.get(v, 0)
        lines.append(f"| `{v}` | {n} | {100*n/total:.1f}% |")
    lines.append("")
    invalid = by_verdict.get("invalid_missing_dimensions", 0)
    invalid_probable = by_verdict.get("invalid_probable", 0)
    valid = (by_verdict.get("valid_not_applicable", 0)
             + by_verdict.get("valid_no_feature", 0)
             + by_verdict.get("valid_other", 0)
             + by_verdict.get("valid_other_data_gap", 0))
    mixed = by_verdict.get("mixed", 0)
    lines.append("**Reading:**")
    lines.append("")
    lines.append(f"- **{invalid} confirmed *invalid skips*** — the agent saw the feature on the plan and explicitly said dimensions weren't annotated. Exactly what `measure-distance` is built for. Latent Goal B headroom: if the classifier had fired `measurement`, the specialist would have computed the distance instead of the agent declaring `not-verifiable`.")
    lines.append(f"- **{invalid_probable} probable invalid skips** — all 3 runs `not-verifiable`, no non-spatial data gap cited, but reasoning didn't trip the strict \"no dimensions\" regex. Worth manual confirmation.")
    lines.append(f"- **{valid} valid skips** — `measure-distance` wouldn't have helped: feature not on plan ({by_verdict.get('valid_no_feature',0)}), requirement doesn't apply ({by_verdict.get('valid_not_applicable',0)}), real verdict reached without measurement ({by_verdict.get('valid_other',0)}), or non-spatial data gap ({by_verdict.get('valid_other_data_gap',0)}).")
    lines.append(f"- **{mixed} mixed.** Runs disagreed; needs manual review.")
    lines.append("")
    adjusted_denom = 51 - valid
    if adjusted_denom > 0:
        adjusted_rate = 100*5/adjusted_denom
        lines.append(f"If we restrict Goal B's denominator to the {adjusted_denom} items where vision/measurement *could* have helped (i.e. drop the {valid} valid-skip items from the 51), RUN_9's adjusted Goal B becomes **5 / {adjusted_denom} = {adjusted_rate:.1f}%**. The remaining {invalid + invalid_probable + mixed} items in this denominator are where the agent skipped vision but probably shouldn't have, and represent the real Goal B headroom.")
    lines.append("")
    lines.append("## Per-item detail")
    lines.append("")
    lines.append("Each entry: item_id (verdict), expected item text, then per-run status + observation snippet + reasoning snippet.")
    lines.append("")

    # Order by verdict (invalid first — biggest concern), then item_id
    order = {
        "invalid_missing_dimensions":0,
        "invalid_probable":1,
        "mixed":2,
        "valid_other":3,
        "valid_other_data_gap":4,
        "valid_no_feature":5,
        "valid_not_applicable":6,
    }
    classified.sort(key=lambda c: (order.get(c["verdict"], 9), c["item"]["item_id"]))

    for c in classified:
        t = c["item"]
        iid = t["item_id"]
        text = t["item_text"]
        maj = t["majority_vision_check"]
        runs_vc = (t["run_1_vision_check"], t["run_2_vision_check"], t["run_3_vision_check"])
        lines.append(f"### {iid} — `{c['verdict']}`")
        lines.append("")
        lines.append(f"> {text}")
        lines.append("")
        lines.append(f"- **majority vision_check:** `{maj}`  ·  **per-run intent:** run-1=`{runs_vc[0]}`, run-2=`{runs_vc[1]}`, run-3=`{runs_vc[2]}`")
        lines.append(f"- **expected:** `expected_specialist = measure-distance` (`{t['notes']}`)")
        lines.append("")
        for i, (status, obs, rsn) in enumerate(c["runs_data"], 1):
            obs_short = (obs or "").strip().replace("\n", " ")
            rsn_short = (rsn or "").strip().replace("\n", " ")
            if len(obs_short) > 360: obs_short = obs_short[:357] + "…"
            if len(rsn_short) > 360: rsn_short = rsn_short[:357] + "…"
            lines.append(f"**run-{i}** — status=`{status}`")
            lines.append(f"- *observation:* {obs_short}")
            lines.append(f"- *reasoning:* {rsn_short}")
            lines.append("")
        lines.append("---")
        lines.append("")

    OUT.write_text("\n".join(lines))
    print(f"Wrote {OUT.relative_to(WORKSPACE.parent.parent)} ({len(classified)} items)")
    print(f"Verdict distribution: {dict(by_verdict)}")
    print(f"Invalid skips: {invalid}/{total} ({100*invalid/total:.1f}%)")
    print(f"Valid skips:   {valid}/{total} ({100*valid/total:.1f}%)")
    print(f"Mixed:         {mixed}/{total} ({100*mixed/total:.1f}%)")


if __name__ == "__main__":
    main()
