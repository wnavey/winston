#!/usr/bin/env python3
"""Build el-md-exp-var2-run9-vision-check-calls-compared-to-expected.tsv.

Ports expected.tsv as-is and adds per-run vision-check classification
columns plus a strict-majority column and the call IDs.

Per-(item × run) value:
  - "none"        → no vision_check call recorded for that pair
  - "generic"     → classifier picked problemType=generic
  - "measurement" → classifier picked problemType=measurement
                    (covers both measure-distance-dispatched calls AND
                    extract-measurement-pairs-only short-circuits)

If a single (item × run) pair has multiple calls with different intents,
specialist precedence wins (measurement > generic).

majority_vision_check:
  - Count occurrences across the 3 runs.
  - If one value has strict plurality (count > others), it wins.
  - If all three runs picked different values → "3-way-tie".
  - If two runs tied for top → take the tied value with higher precedence
    (measurement > generic > none). Note: 2+1 is always a clear majority.

vision_check_call_id:
  - Semicolon-joined `run-N:<callId>` entries, one per call across the 3
    runs. Empty when no calls.

no_call_verdict:
  - "n/a" when majority_vision_check ∈ {measurement, generic, 3-way-tie}
    (the agent did make some kind of vision call).
  - For majority=none, the verdict from the skip classifier. Two cases:
    * `valid_not_expected` — expected_vision=no. Agent correctly skipped.
    * One of {valid_not_applicable, valid_no_feature, valid_other,
      valid_other_data_gap, invalid_missing_dimensions,
      invalid_probable, mixed} — for expected_vision=yes items, derived
      by reading the per-run findings' agentTrace and applying the
      same heuristics as run-9-no-vision-check-analysis.md.

no_call_verdict_reason:
  - "n/a" when no_call_verdict is "n/a".
  - Otherwise a 1-2 sentence explanation: the dominant status pattern
    across the 3 runs, plus a representative agent quote/paraphrase
    showing the signal that drove the verdict.
"""

import csv, json, re
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(__file__).parent.resolve()
# scripts → tmp/el-md-exp-var2-run-9 → tmp → el-md-exp → metrics → vision-tool-orchestration
WORKSPACE = HERE.parent.parent.parent.parent.parent
RUN9 = WORKSPACE / "source-runs" / "el-md-exp" / "var-2" / "output" / "runs"
EXPECTED_TSV = WORKSPACE / "metrics" / "el-md-exp" / "expected-vision-selection" / "expected.tsv"
OUT_TSV = HERE.parent / "el-md-exp-var2-run9-vision-check-calls-compared-to-expected.tsv"

INTENT_PRECEDENCE = {"none": 0, "generic": 1, "measurement": 2}
PT_TO_INTENT = {
    "generic":     "generic",
    "measurement": "measurement",
}

# ---------------------------------------------------------------------------
# Skip-verdict classifier — mirrors analyze-no-vision-check.py
# ---------------------------------------------------------------------------

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
PAT_DATA_UNAVAILABLE = re.compile(
    r"(species\s+(?:identity|identification|name)|plant\s+schedule|UC\s+designation|utility-compatible\s+(?:status|species)"
    r"|access\s+door\s+orientations?|frequently\s+omitted)",
    re.I,
)


def classify_skip(runs):
    """runs: list of (status, observation, reasoning) tuples. Returns
    (verdict, signals) — mirrors analyze-no-vision-check.py exactly."""
    statuses = [s for s, _, _ in runs]
    sc = Counter(statuses)
    n_no_dim = sum(1 for _, o, r in runs if PAT_NO_DIM.search(f"{o or ''}\n{r or ''}"))
    n_not_app = sum(1 for _, o, r in runs if PAT_NOT_APPLICABLE.search(f"{o or ''}\n{r or ''}"))
    n_no_feat = sum(1 for _, o, r in runs if PAT_FEATURE_NOT_FOUND.search(f"{o or ''}\n{r or ''}"))
    n_data_gap = sum(1 for _, o, r in runs if PAT_DATA_UNAVAILABLE.search(f"{o or ''}\n{r or ''}"))

    if sc.get("n/a", 0) >= 2 or n_not_app >= 2:
        return "valid_not_applicable", sc
    if n_no_feat >= 2 and sc.get("not-verifiable", 0) >= 1 and n_no_dim < 2:
        return "valid_no_feature", sc
    if n_data_gap >= 2 and n_no_dim < 2:
        return "valid_other_data_gap", sc
    if n_no_dim >= 2 and sc.get("not-verifiable", 0) >= 2:
        return "invalid_missing_dimensions", sc
    if sc.get("not-verifiable", 0) == 3 and n_no_feat < 2 and n_data_gap < 2:
        return "invalid_probable", sc
    if sc.get("pass", 0) + sc.get("fail", 0) >= 2:
        return "valid_other", sc
    return "mixed", sc


def _short(s, n=180):
    s = (s or "").strip().replace("\n", " ").replace("\t", " ")
    return s if len(s) <= n else s[:n - 1] + "…"


def _pick_quote(runs, pattern):
    """Find a representative reasoning sentence matching `pattern`."""
    for _, _, rsn in runs:
        if rsn and pattern.search(rsn):
            # Return the matching sentence (split on . and pick best)
            for sent in re.split(r"(?<=[.!?])\s+", rsn):
                if pattern.search(sent):
                    return _short(sent, 200)
            return _short(rsn, 200)
    return None


def _status_summary(sc):
    """e.g. '2 not-verifiable + 1 n/a'"""
    parts = []
    for k in ("not-verifiable", "n/a", "pass", "fail"):
        if sc.get(k, 0):
            parts.append(f"{sc[k]} {k}")
    return " + ".join(parts) if parts else "no status"


def reason_for_verdict(verdict, runs, sc):
    """Synthesize a 1-2 sentence explanation for the verdict."""
    status_str = _status_summary(sc)
    if verdict == "valid_not_expected":
        return "expected_vision=no in `expected.tsv`; agent correctly did not invoke vision_check."
    if verdict == "valid_not_applicable":
        quote = _pick_quote(runs, PAT_NOT_APPLICABLE)
        head = f"{status_str} across 3 runs — checklist item not triggered on this site."
        return f"{head} Agent: \"{quote}\"" if quote else head
    if verdict == "valid_no_feature":
        quote = _pick_quote(runs, PAT_FEATURE_NOT_FOUND)
        head = f"{status_str} — relevant feature not present/visible on the plan."
        return f"{head} Agent: \"{quote}\"" if quote else head
    if verdict == "valid_other_data_gap":
        quote = _pick_quote(runs, PAT_DATA_UNAVAILABLE)
        head = f"{status_str} — gap is non-spatial (textual/schedule data missing); measure-distance can't address it."
        return f"{head} Agent: \"{quote}\"" if quote else head
    if verdict == "valid_other":
        return f"{status_str} — agent reached a real verdict without needing measurement."
    if verdict == "invalid_missing_dimensions":
        quote = _pick_quote(runs, PAT_NO_DIM)
        head = f"{status_str} — agent saw the feature but said dimensions weren't annotated; measure-distance would have computed the clearance."
        return f"{head} Agent: \"{quote}\"" if quote else head
    if verdict == "invalid_probable":
        # Surface any reasoning hint we can
        any_rsn = next((rsn for _, _, rsn in runs if rsn), "")
        return f"{status_str} — agent gave up across all 3 runs without invoking measurement. No explicit \"no dimensions\" phrase, but reasoning ({_short(any_rsn, 140)}) suggests measure-distance could have helped."
    if verdict == "mixed":
        return f"Runs disagreed: {status_str}. No dominant signal; needs manual review."
    return f"{verdict}: {status_str}"


def load_findings():
    """{ item_id: { run_label: finding_dict } }"""
    out = defaultdict(dict)
    for run_dir in sorted(RUN9.iterdir()):
        if not run_dir.is_dir() or not run_dir.name.startswith("run-"):
            continue
        for fp in (run_dir / "findings").glob("*.md.json"):
            d = json.loads(fp.read_text())
            for f in d.get("findings", []):
                iid = f.get("deficiencyId")
                if iid:
                    out[iid][run_dir.name] = f
    return out


def collect_calls():
    """{ (item_id, run_label): [(callId, intent), ...] }"""
    out = defaultdict(list)
    for run_dir in sorted(RUN9.iterdir()):
        if not run_dir.is_dir() or not run_dir.name.startswith("run-"):
            continue
        run_label = run_dir.name  # e.g. "run-1"
        for cd in sorted((run_dir / "vision-check-calls").iterdir()):
            meta = cd / "metadata.json"
            if not meta.exists():
                continue
            m = json.loads(meta.read_text())
            iid = m.get("inputs", {}).get("checklistItemId", "")
            if ":" in iid:
                iid = iid.split(":", 1)[-1]
            if not iid:
                continue
            pt = m.get("classifier", {}).get("output", {}).get("problemType")
            intent = PT_TO_INTENT.get(pt, pt or "unknown")
            out[(iid, run_label)].append((cd.name, intent))
    return out


def strongest_intent(call_list):
    if not call_list:
        return "none"
    intents = [c[1] for c in call_list]
    return max(intents, key=lambda i: INTENT_PRECEDENCE.get(i, -1))


def majority(values):
    """values is e.g. ['generic', 'measurement', 'none']. Returns the
    majority/plurality, or '3-way-tie' if all three differ."""
    c = Counter(values)
    top_count = max(c.values())
    top_vals = [v for v, n in c.items() if n == top_count]
    if len(top_vals) == 1:
        return top_vals[0]
    # Multiple values tied for top.
    if len(c) == 3:
        # All three distinct → 3-way tie.
        return "3-way-tie"
    # Otherwise pick the highest-precedence among the tied values.
    return max(top_vals, key=lambda v: INTENT_PRECEDENCE.get(v, -1))


def main():
    calls = collect_calls()
    findings = load_findings()
    run_labels = ["run-1", "run-2", "run-3"]

    with EXPECTED_TSV.open() as f:
        reader = csv.DictReader(f, delimiter="\t")
        base_fields = reader.fieldnames
        rows = list(reader)

    out_fields = list(base_fields) + [
        f"run_{n}_vision_check" for n in (1, 2, 3)
    ] + [
        "majority_vision_check",
        "vision_check_call_id",
        "no_call_verdict",
        "no_call_verdict_reason",
    ]

    out_rows = []
    for r in rows:
        iid = r["item_id"]
        per_run_intents = []
        per_run_callids = []
        for rl in run_labels:
            pair_calls = calls.get((iid, rl), [])
            intent = strongest_intent(pair_calls)
            per_run_intents.append(intent)
            for callid, _ in pair_calls:
                per_run_callids.append(f"{rl}:{callid}")
        out_row = dict(r)
        out_row["run_1_vision_check"] = per_run_intents[0]
        out_row["run_2_vision_check"] = per_run_intents[1]
        out_row["run_3_vision_check"] = per_run_intents[2]
        maj = majority(per_run_intents)
        out_row["majority_vision_check"] = maj
        out_row["vision_check_call_id"] = "; ".join(per_run_callids)

        # no_call_verdict / no_call_verdict_reason
        if maj == "none":
            if r["expected_vision"] == "no":
                verdict = "valid_not_expected"
                # No need for the per-run findings here.
                reason = reason_for_verdict(verdict, [], Counter())
            else:
                runs_data = []
                for rl in run_labels:
                    f = findings.get(iid, {}).get(rl) or {}
                    at = f.get("agentTrace") or {}
                    runs_data.append((f.get("status"), at.get("observation"), at.get("reasoning")))
                verdict, sc = classify_skip(runs_data)
                reason = reason_for_verdict(verdict, runs_data, sc)
            out_row["no_call_verdict"] = verdict
            out_row["no_call_verdict_reason"] = reason
        else:
            out_row["no_call_verdict"] = "n/a"
            out_row["no_call_verdict_reason"] = "n/a"

        out_rows.append(out_row)

    OUT_TSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_TSV.open("w") as f:
        w = csv.DictWriter(f, fieldnames=out_fields, delimiter="\t")
        w.writeheader()
        w.writerows(out_rows)

    print(f"Wrote {OUT_TSV.relative_to(WORKSPACE.parent.parent)} ({len(out_rows)} rows)")
    maj_d = Counter(r["majority_vision_check"] for r in out_rows)
    print(f"  majority_vision_check distribution: {dict(maj_d)}")
    verdict_d = Counter(r["no_call_verdict"] for r in out_rows)
    print(f"  no_call_verdict distribution: {dict(verdict_d)}")
    per_run_dist = {}
    for col in ("run_1_vision_check", "run_2_vision_check", "run_3_vision_check"):
        per_run_dist[col] = dict(Counter(r[col] for r in out_rows))
    for k, v in per_run_dist.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
