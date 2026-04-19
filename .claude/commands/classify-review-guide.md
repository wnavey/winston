# Classify Review Guide for Distance Measurement

Classify every checklist item in a review guide (or full department) by whether it requires horizontal distance measurement, vertical distance measurement, or is not a distance check at all. Produces both a machine-readable JSON and a human-readable markdown summary.

## Usage

```
/classify-review-guide <department-code> [guide-number]
```

**Examples:**
- `/classify-review-guide el` — classify all guides in the EL (Electric) department
- `/classify-review-guide sduf` — classify all guides in the SDUF department
- `/classify-review-guide el 5` — classify only guide 5.md in the EL department

## What this does

1. **Reads** every `.md` guide file from `bureau/jurisdictions/austin/review-guides/<department>/`
2. **Extracts** all checklist items from the markdown tables (rows matching `| XX-N.N | deficiency text |`)
3. **Classifies** each item into one of three categories:
   - **horizontal** — requires plan-view distance measurement (the measure-distance tool CAN do this)
   - **vertical-or-mixed** — requires vertical/3D clearance measurement (tool CANNOT do this yet)
   - **not-applicable** — non-distance check (documentation, materials, methodology, specifications)
4. **Sub-classifies** horizontal items as:
   - **distance-only** — distance measurement alone resolves the verdict (compare to threshold)
   - **distance-plus** — distance needed but verdict also requires additional information
5. **Identifies** additional requirements for distance-plus items:
   - `species-verification` — tree utility-compatibility per ECM Appendix F
   - `orientation-identification` — equipment access door side
   - `equipment-type-identification` — oil-filled vs dry-type
   - `root-barrier-specification` — barrier depth and position
   - `bollard-specification` — diameter, spacing, material
   - `material-specification` — non-conductive, fire-rated, etc.
   - `documentation-approval` — written approval from Austin Energy Design
6. **Writes** output to `workspaces/measure-distance-tool/analysis/guides/<department>/`:
   - `item-classification.json` — machine-readable, used by `compare-findings.py`
   - `items-requiring-distance-measurement.md` — human-readable summary with per-guide breakdown

## Classification approach

- **Keyword analysis** of deficiency text to detect horizontal distance indicators (clearance, lateral, separation, feet from, within, setback, etc.), vertical indicators (vertical clearance, depth, elevation, profile, cross-section), and non-distance indicators (documentation, specification, not provided, not shown, etc.)
- **Threshold extraction** — parses numeric distance thresholds from deficiency text (e.g., "minimum 5-foot clearance" → threshold: "5 feet")
- **Reuses human-reviewed classification** when available — if an `el-md-exp` or other manually classified subset exists for the department, those items are carried forward without re-classifying

## Important notes

- **Programmatic classification should be spot-checked** by a human, especially for the highest-count guides. Edge cases include items with both horizontal and vertical components, items where distance is a trigger but the actual check is something else, and items with ambiguous wording.
- The classification is **jurisdiction-specific** (Austin) because review guides reference Austin-specific codes (UCM, ECM, DCM). Other jurisdictions would need their own classification.
- The **bureau repo** must be available locally (or symlinked in the conductor workspace) for the script to read guide files.
- If running for a department that already has a classification, the script will **overwrite** the existing files. Back up first if the existing classification was manually curated.

## Output structure

```
workspaces/measure-distance-tool/analysis/guides/<department>/
├── item-classification.json      # machine-readable
└── items-requiring-distance-measurement.md  # human-readable summary
```

The JSON includes per-item fields:
```json
{
  "deficiencyId": "EL-5.3",
  "deficiency": "Customer facilities encroach into electric easement...",
  "classification": "horizontal",
  "subClassification": "distance-only",
  "additionalRequirements": [],
  "threshold": "7.5 feet",
  "guide": "5"
}
```

## Existing classifications

| Department | Scope | Status |
|---|---|---|
| `el-md-exp` | Guides 1, 2, 13 (101 items) | Human-reviewed ✅ |
| `el` | All 20 guides (770 items) | Programmatic (guides 1,2,13 from human review) |

## Follow-up after classification

Once a department is classified, you can:
1. Run `scripts/compare-findings.py --classification analysis/guides/<dept>/item-classification.json` to compute Phase 1 metrics
2. Identify the highest-value guides (most distance-only items) for experiment expansion
3. Estimate the tool's impact across the department (% of items addressable)
