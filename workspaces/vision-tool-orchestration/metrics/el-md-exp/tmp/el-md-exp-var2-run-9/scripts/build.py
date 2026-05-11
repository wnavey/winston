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
  - runs. Empty when no calls.
"""

import csv, json
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(__file__).parent.resolve()
# scripts → tmp/el-md-exp-var2-run-9 → tmp → el-md-exp → metrics → vision-tool-orchestration
WORKSPACE = HERE.parent.parent.parent.parent.parent
RUN9 = WORKSPACE / "source-runs" / "tmp-el-md-exp-var2-run9-local" / "output" / "runs"
EXPECTED_TSV = WORKSPACE / "metrics" / "el-md-exp" / "expected-vision-selection" / "expected.tsv"
OUT_TSV = HERE.parent / "el-md-exp-var2-run9-vision-check-calls-compared-to-expected.tsv"

INTENT_PRECEDENCE = {"none": 0, "generic": 1, "measurement": 2}
PT_TO_INTENT = {
    "generic":     "generic",
    "measurement": "measurement",
}


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
    run_labels = ["run-1", "run-2", "run-3"]

    with EXPECTED_TSV.open() as f:
        reader = csv.DictReader(f, delimiter="\t")
        base_fields = reader.fieldnames
        rows = list(reader)

    out_fields = list(base_fields) + [
        f"run_{n}_vision_check" for n in (1, 2, 3)
    ] + ["majority_vision_check", "vision_check_call_id"]

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
        out_row["majority_vision_check"] = majority(per_run_intents)
        out_row["vision_check_call_id"] = "; ".join(per_run_callids)
        out_rows.append(out_row)

    OUT_TSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_TSV.open("w") as f:
        w = csv.DictWriter(f, fieldnames=out_fields, delimiter="\t")
        w.writeheader()
        w.writerows(out_rows)

    print(f"Wrote {OUT_TSV.relative_to(WORKSPACE.parent.parent)} ({len(out_rows)} rows)")
    maj = Counter(r["majority_vision_check"] for r in out_rows)
    print(f"  majority_vision_check distribution: {dict(maj)}")
    per_run_dist = {}
    for col in ("run_1_vision_check", "run_2_vision_check", "run_3_vision_check"):
        per_run_dist[col] = dict(Counter(r[col] for r in out_rows))
    for k, v in per_run_dist.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
