#!/usr/bin/env python3
"""Build metrics/cc/expected-vision-selection/expected.tsv (TSV 1).

Lifts + normalizes existing classifications under the unified TSV 1 schema:
  item_id, item_text, expected_vision, expected_specialist, notes

One row per checklist item.

Sources:
- ../../../../cc-vision-classification/cc-classification.tsv  (grade per item)
- bureau/.../v2.5-trimmed/cc-*.md                             (deficiency text)

Output:
- ../expected.tsv

Grade → (expected_vision, expected_specialist) mapping:
  inspect-drawing-required → (yes, inspect-drawing)
  inspect-drawing-optional → (yes, inspect-drawing)   # note: generic also acceptable
  vision-only              → (yes, generic)
  no-tool                  → (no,  none)
"""

import csv
from pathlib import Path

HERE = Path(__file__).parent.resolve()
WORKSPACES = HERE.parent.parent.parent.parent.parent
GRADES_TSV = WORKSPACES / "cc-vision-classification" / "cc-classification.tsv"
CHECKLIST_DIR = Path(
    "/Users/winston/noetic/bureau/jurisdictions/austin/completeness-check/v2.5-trimmed"
)
OUT_TSV = HERE.parent / "expected.tsv"

GRADE_MAP = {
    "inspect-drawing-required": ("yes", "inspect-drawing", ""),
    "inspect-drawing-optional": ("yes", "inspect-drawing", "optional - generic also acceptable"),
    "vision-only":              ("yes", "generic", ""),
    "no-tool":                  ("no",  "none", ""),
}


def load_checklist_text():
    """Parse cc-*.md table rows. Returns {(grouping, item_id): deficiency_text}.

    Only parses rows under the ``## Checklist Items`` heading; the
    ``## Reference Materials`` table at the bottom of some files has the
    same first-cell shape but a different second cell (a doc path),
    which would otherwise overwrite the deficiency text.
    """
    item_text = {}
    for md_file in sorted(CHECKLIST_DIR.glob("cc-*.md")):
        grouping = md_file.stem
        in_checklist = False
        for line in md_file.read_text().split("\n"):
            stripped = line.strip()
            if stripped.startswith("## "):
                in_checklist = stripped == "## Checklist Items"
                continue
            if not in_checklist or not stripped.startswith("|"):
                continue
            cells = [c.strip() for c in stripped.split("|")]
            if len(cells) < 3:
                continue
            item_id, deficiency = cells[1], cells[2]
            if item_id in ("ID", "----", "") or deficiency in ("Item", "------", ""):
                continue
            if "--" in item_id and len(item_id) < 4:
                continue
            item_text[(grouping, item_id)] = deficiency
    return item_text


def main():
    checklist_text = load_checklist_text()

    rows = []
    with GRADES_TSV.open() as f:
        for r in csv.DictReader(f, delimiter="\t"):
            grouping = r["grouping"]
            item = r["item_id"]
            grade = r["grade"]
            condition = r["condition"]

            if grade not in GRADE_MAP:
                raise ValueError(f"unexpected grade: {grade!r} on {grouping}/{item}")
            expected_vision, expected_specialist, base_note = GRADE_MAP[grade]

            notes_parts = []
            if condition and condition != "always":
                notes_parts.append(f"condition={condition}")
            if base_note:
                notes_parts.append(base_note)
            notes = "; ".join(notes_parts)

            rows.append({
                "item_id": f"{grouping}:{item}",
                "item_text": checklist_text.get((grouping, item), ""),
                "expected_vision": expected_vision,
                "expected_specialist": expected_specialist,
                "notes": notes,
            })

    rows.sort(key=lambda r: r["item_id"])

    with OUT_TSV.open("w") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["item_id", "item_text", "expected_vision", "expected_specialist", "notes"],
            delimiter="\t",
        )
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {OUT_TSV.relative_to(WORKSPACES.parent.parent)} ({len(rows)} rows)")
    by_specialist = {}
    by_vision = {"yes": 0, "no": 0}
    missing_text = 0
    for r in rows:
        by_specialist[r["expected_specialist"]] = by_specialist.get(r["expected_specialist"], 0) + 1
        by_vision[r["expected_vision"]] += 1
        if not r["item_text"]:
            missing_text += 1
    print(f"  expected_vision:     yes={by_vision['yes']}  no={by_vision['no']}")
    print(f"  expected_specialist: {by_specialist}")
    if missing_text:
        print(f"  WARNING: {missing_text} rows have empty item_text")


if __name__ == "__main__":
    main()
