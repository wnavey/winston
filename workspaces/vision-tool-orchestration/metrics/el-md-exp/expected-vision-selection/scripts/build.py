#!/usr/bin/env python3
"""Build metrics/el-md-exp/expected-vision-selection/expected.tsv (TSV 1).

Lifts + normalizes el-md-exp's existing classification under the unified
TSV 1 schema:
  item_id, item_text, expected_vision, expected_specialist, notes

One row per checklist item. Mirror of the cc/expected-vision-selection
TSV 1 builder.

Sources:
- ../../../../measure-distance-tool/analysis/guides/el-md-exp/item-classification.json
  Each entry has: deficiencyId, deficiency (text), classification
  (horizontal/vertical-or-mixed/not-applicable), shouldCall (yes/no),
  subClassification (distance-only / distance-plus / null), threshold, guide.

Output:
- ../expected.tsv

Mapping:

  classification        | shouldCall | expected_vision | expected_specialist | notes
  ----------------------|------------|-----------------|---------------------|------
  horizontal            | yes        | yes             | measure-distance    | (subClass appended)
  vertical-or-mixed     | yes        | yes             | generic             | "vertical-or-mixed: generic vision sufficient"
  vertical-or-mixed     | no         | no              | none                |
  not-applicable        | no         | no              | none                |
  (other should-call=no)| no         | no              | none                |

Rationale: items classified `horizontal` with `shouldCall=yes` are the
ones the measure-distance specialist was built for — distance/clearance
checks. The other 'shouldCall=yes' items can use generic vision.
"""

import csv
import json
from pathlib import Path

HERE = Path(__file__).parent.resolve()
WORKSPACES = HERE.parent.parent.parent.parent.parent
GROUND_TRUTH = WORKSPACES / "measure-distance-tool" / "analysis" / "guides" / "el-md-exp" / "item-classification.json"
OUT_TSV = HERE.parent / "expected.tsv"


def main():
    data = json.load(GROUND_TRUTH.open())
    items = data["items"]

    rows = []
    for item_id, entry in sorted(items.items()):
        classification = entry.get("classification", "")
        should_call = entry.get("shouldCall", "no")
        subclass = entry.get("subClassification") or ""
        deficiency = entry.get("deficiency", "")

        notes_parts = []
        if classification == "horizontal" and should_call == "yes":
            expected_vision = "yes"
            expected_specialist = "measure-distance"
            if subclass:
                notes_parts.append(f"subClassification={subclass}")
        elif classification == "vertical-or-mixed" and should_call == "yes":
            expected_vision = "yes"
            expected_specialist = "generic"
            notes_parts.append("vertical-or-mixed: generic vision sufficient")
        else:
            expected_vision = "no"
            expected_specialist = "none"
            if classification:
                notes_parts.append(f"classification={classification}")
            if should_call == "no":
                notes_parts.append("shouldCall=no")

        rows.append({
            "item_id": item_id,
            "item_text": deficiency,
            "expected_vision": expected_vision,
            "expected_specialist": expected_specialist,
            "notes": "; ".join(notes_parts),
        })

    with OUT_TSV.open("w") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["item_id", "item_text", "expected_vision", "expected_specialist", "notes"],
            delimiter="\t",
        )
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {OUT_TSV.relative_to(WORKSPACES.parent)} ({len(rows)} rows)")
    by_vision = {"yes": 0, "no": 0}
    by_spec = {}
    for r in rows:
        by_vision[r["expected_vision"]] += 1
        by_spec[r["expected_specialist"]] = by_spec.get(r["expected_specialist"], 0) + 1
    print(f"  expected_vision:     yes={by_vision['yes']}  no={by_vision['no']}")
    print(f"  expected_specialist: {by_spec}")


if __name__ == "__main__":
    main()
