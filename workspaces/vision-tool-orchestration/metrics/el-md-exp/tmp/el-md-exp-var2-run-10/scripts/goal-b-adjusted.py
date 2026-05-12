#!/usr/bin/env python3
"""Compute RUN_9 Goal B with valid-skip denominator adjustment.

Goal B (raw) is `majority_vision_check == "measurement"` on the 51
items where `expected_specialist == "measure-distance"`. Many of those
51 items had a valid reason to NOT invoke measure-distance — the
checklist requirement didn't apply to this site, the relevant feature
wasn't on the plan, the agent reached a real pass/fail verdict
without measurement, or the gap was non-spatial. The TSV's
`no_call_verdict` column tags these.

Goal B (adjusted) drops those valid-skip rows from the denominator,
isolating the rate among items where invoking measure-distance was
actually expected to help.

Reads `el-md-exp-var2-run10-vision-check-calls-compared-to-expected.tsv`
in the same directory as this script.
"""

import csv
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent.resolve()
TSV = HERE.parent / "el-md-exp-var2-run10-vision-check-calls-compared-to-expected.tsv"

VALID = {"valid_not_applicable", "valid_no_feature", "valid_other", "valid_other_data_gap"}
INVALID = {"invalid_missing_dimensions", "invalid_probable"}
MIXED = {"mixed"}


def main():
    rows = list(csv.DictReader(TSV.open(), delimiter="\t"))
    md_rows = [r for r in rows if r["expected_specialist"] == "measure-distance"]
    total = len(md_rows)
    numerator = sum(1 for r in md_rows if r["majority_vision_check"] == "measurement")

    counts = Counter(r["no_call_verdict"] for r in md_rows)
    valid_n = sum(counts.get(v, 0) for v in VALID)
    invalid_n = sum(counts.get(v, 0) for v in INVALID)
    mixed_n = counts.get("mixed", 0)
    na_n = counts.get("n/a", 0)

    adjusted_denom = total - valid_n

    print(f"Expected measure-distance items: {total}")
    print(f"Numerator (majority_vision_check=measurement): {numerator}")
    print()
    print("no_call_verdict on expected-md items:")
    for v, n in counts.most_common():
        print(f"  {v}: {n}")
    print()
    print(f"Buckets: valid={valid_n}  invalid={invalid_n}  mixed={mixed_n}  n/a={na_n}")
    print()
    print(f"Goal B (raw)          : {numerator}/{total} = {100*numerator/total:.1f}%")
    print(f"Goal B (adjusted)     : {numerator}/{adjusted_denom} = {100*numerator/adjusted_denom:.1f}%"
          f"  ({valid_n} valid skips removed from denominator)")
    stricter = adjusted_denom - mixed_n
    print(f"Goal B (strict-clear) : {numerator}/{stricter} = {100*numerator/stricter:.1f}%"
          f"  (also drops {mixed_n} mixed)")


if __name__ == "__main__":
    main()
