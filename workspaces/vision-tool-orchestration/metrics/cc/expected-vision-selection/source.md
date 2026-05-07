# source — `expected-vision-selection` (cc)

`expected.tsv` is built from existing classifications, not re-LLM-generated.
One row per checklist item. Re-build by running `scripts/build.py`.

## Inputs

| Source | Path | What's lifted |
|---|---|---|
| Item grade + condition | `../../../cc-vision-classification/cc-classification.tsv` | `grouping`, `item_id`, `grade`, `condition` columns. Existing hand+LLM classification. |
| Deficiency text | `bureau/jurisdictions/austin/completeness-check/v2.5-trimmed/cc-*.md` | The "Checklist Items" table per `cc-*.md` file. |

## Schema

| Column | Type | Notes |
|---|---|---|
| `item_id` | string | `{grouping}:{item_id}`, e.g. `cc-13:AW-21`. |
| `item_text` | string | Deficiency text from the bureau checklist `## Checklist Items` table. |
| `expected_vision` | yes \| no | See grade mapping below. |
| `expected_specialist` | none \| generic \| inspect-drawing \| measure-distance | See grade mapping below. |
| `notes` | string | Free-form. Currently captures `condition=conditional` and "optional - generic also acceptable" (for the `inspect-drawing-optional` grade). |

## Grade → expected mapping

| `grade` | `expected_vision` | `expected_specialist` | `notes` (additive) |
|---|---|---|---|
| `inspect-drawing-required` | yes | inspect-drawing | — |
| `inspect-drawing-optional` | yes | inspect-drawing | "optional - generic also acceptable" |
| `vision-only` | yes | generic | — |
| `no-tool` | no | none | — |

For goal-B (specialist selection rate) the `inspect-drawing-optional` rows
are slightly soft — generic vision is acceptable too. Analyses that want
the strict denominator can filter on `notes` not containing "optional".

## Counts

185 items total: 154 expected-vision (100 generic, 54 inspect-drawing),
31 not. No `measure-distance` rows — that specialist is reviewed on the
`el-md-exp` side, not cc.

## Parser bug fixed (2026-05-07)

The existing `analyze-baseline.py` parser parsed all `|`-prefixed table
rows in each `cc-*.md` file. Some files have a "Reference Materials"
table at the bottom whose first column is also an item id (e.g. `AE-01`)
but whose second column is a doc path, not the deficiency text. That
table was overwriting the deficiency text for the affected items.

`scripts/build.py` here only parses rows under the `## Checklist Items`
heading. Same bug should be fixed in `analyze-baseline.py` next time it's
touched (or replaced by joining against this `expected.tsv`).
