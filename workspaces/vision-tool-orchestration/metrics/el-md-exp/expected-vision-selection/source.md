# source — `expected-vision-selection` (el-md-exp)

`expected.tsv` is built from existing classifications, not re-LLM-generated.
One row per checklist item. Re-build by running `scripts/build.py`.

## Inputs

| Source | Path | What's lifted |
|---|---|---|
| Item classification | `winston/workspaces/measure-distance-tool/analysis/guides/el-md-exp/item-classification.json` | `deficiencyId`, `deficiency` (text), `classification`, `shouldCall`, `subClassification` |

## Schema

Same shape as the cc-side TSV 1 (`metrics/cc/expected-vision-selection/expected.tsv`).

| Column | Type | Notes |
|---|---|---|
| `item_id` | string | `deficiencyId` from the source (e.g. `EL-1.1`). |
| `item_text` | string | `deficiency` from the source. |
| `expected_vision` | yes \| no | See mapping below. |
| `expected_specialist` | none \| generic \| inspect-drawing \| measure-distance | See mapping below. |
| `notes` | string | Free-form. Captures `subClassification`, `classification`, `shouldCall=no` flags. |

## Classification → expected mapping

| `classification` | `shouldCall` | `expected_vision` | `expected_specialist` | Notes |
|---|---|---|---|---|
| `horizontal` | yes | yes | `measure-distance` | distance-only or distance-plus subClassification appended |
| `vertical-or-mixed` | yes | yes | `generic` | "vertical-or-mixed: generic vision sufficient" |
| `vertical-or-mixed` | no | no | `none` | |
| `not-applicable` | * | no | `none` | |
| (else) | no | no | `none` | |

Rationale: items classified `horizontal` with `shouldCall=yes` are the
measure-distance candidates (the specialist was built for them).
Vertical / mixed items can use generic vision.

## Counts

101 items total: 51 expected-vision (all `measure-distance` for this guide
— el-md-exp is purpose-built around the measure-distance specialist),
50 not. No `inspect-drawing` rows for el-md-exp.

For Goal A: denominator is 51.
For Goal B: same 51 (the measure-distance specialist is the only named
specialist relevant to this guide).
