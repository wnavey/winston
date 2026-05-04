# Completeness-Check vs `inspect-drawing` — classification labeling

Reference data for grading whether the cc agent reaches for the
`inspect-drawing` tool when it should. Each checklist item is labeled
with a single `grade` value that captures both the descriptive tool
fit and the grading semantics for an agent run.

**Scope of v1:** `cc-13` only — pilot to validate the labeling scheme
before doing the other 12 grouping files.

**Source of truth:** [`cc-classification.tsv`](./cc-classification.tsv).
Markdown report wraps it for human review and stat reporting.

## Schema

Single `grade` column with 4 values:

| Value | Meaning | Grading rule for an agent run |
|---|---|---|
| `inspect-drawing-required` | Pure drawing reasoning. Vision alone cannot produce a structured answer. | Agent SHOULD call `inspect-drawing`. Not calling it is a miss. |
| `inspect-drawing-optional` | Either tool plausibly works. Item has both visual and textual aspects. | Agent calling `inspect-drawing` OR `vision` is acceptable. |
| `vision-only` | Text/labels/tables/checkboxes/title-block. | Agent calling `inspect-drawing` here is misuse. |
| `no-tool` | Document-existence check; non-visual sources (`README.md`, supplementary docs index). | No vision tool needed. |

Other columns:

- `confidence` — `high` / `medium` for the grade assignment
- `location` — where the answer lives (`utility plan`, `AW general info sheet`, `cover sheet`, etc.) — copied from the checklist
- `condition` — `always` or `conditional`, mirrors the "Condition" column in the source checklist
- `rationale` — one-line justification for the grade

## How to use this for grading runs

For a given agent run, join `cc-classification.tsv` against the agent's
tool-call log (per-item, indexed by `grouping` + `item_id`) and
classify each call:

| Run behavior | `grade` | Outcome |
|---|---|---|
| Agent called `inspect-drawing` | `inspect-drawing-required` | ✅ correct |
| Agent called `inspect-drawing` | `inspect-drawing-optional` | ✅ acceptable |
| Agent called `inspect-drawing` | `vision-only` | ❌ misuse |
| Agent called `inspect-drawing` | `no-tool` | ❌ misuse |
| Agent did NOT call `inspect-drawing` | `inspect-drawing-required` | ❌ missed call |
| Agent did NOT call `inspect-drawing` | `inspect-drawing-optional` | ✅ acceptable |
| Agent did NOT call `inspect-drawing` | `vision-only` | ✅ correct |
| Agent did NOT call `inspect-drawing` | `no-tool` | ✅ correct |

---

## cc-13 — `Austin Water — General Requirements` (37 items)

### Stats

| Grade | Count | % |
|---|---|---|
| `inspect-drawing-required` | 5 | 14% |
| `inspect-drawing-optional` | 7 | 19% |
| `vision-only` | 23 | 62% |
| `no-tool` | 2 | 5% |

**Reference set for "should have called inspect-drawing":** 5 required +
7 optional = **12 of 37 items** (32%) where calling `inspect-drawing`
is at least acceptable. Of those, 5 (14%) are where *not* calling it is
a miss.

### `inspect-drawing-required` (5)

| ID | Item (paraphrased) | Why required |
|---|---|---|
| AW-21 | Pipes >=24" shown as double lines (+ size/material/location vs easements/ROW) | Double-line styling is pure drawing symbology — vision cannot reliably structure-output this. |
| AW-23 | Wastewater flow direction not indicated on plan views | Canonical inspect-drawing case — flow arrows on lines. |
| AW-28 | Retaining-wall components (geogrid, straps, tie-backs) shown/identified | Drawing-detail / section reading — symbology required. |
| AW-32 | Typical cross sections for private streets/easements | Visual diagram. |
| AW-39 | Drain field delineated for properties not on city sewer | Visual outlined area. |

### `inspect-drawing-optional` (7)

| ID | Item | Why optional |
|---|---|---|
| AW-18 | Profile view present + plan view at top half | Vision can read PLAN/PROFILE labels; inspect-drawing handles the layout assertion. |
| AW-22 | Existing W/WW infrastructure with location/size/material | Labels are vision; visible linework is inspect-drawing. |
| AW-27 | Easement recordation numbers + proposed easement limits | Recordation numbers = vision (text); limits = inspect-drawing (boundaries). |
| AW-29 | Physical obstructions (poles, trees, inlets) in ROW | Either tool if obstructions are clearly labeled. |
| AW-30 | TCEQ crossing compliance details where mains cross | Crossings = inspect-drawing; compliance callouts = vision. |
| AW-38a | Floodplain / CWQZ / erosion-hazard zones shown | Either tool with labeled overlays. |
| AW-38b | Storm sewers, easements, watercourse centerlines shown | Drawn linework with labels — either tool. |

### `vision-only` (23)

The "AW General Info Sheet" cluster (AW-01, AW-02, AW-03, AW-05,
AW-06, AW-07, AW-08, AW-10, AW-11, AW-12, AW-13, AW-14, AW-16, AW-25)
is all template-completeness checks: boxes filled, tables filled,
checkboxes ticked, title block present.

Other vision items: AW-19 (location-map labels), AW-20 (construction
notes text matching), AW-31 (curve data table), AW-33 (key-map
presence), AW-36 (scale + sheet size), AW-45 (street address labels),
AW-46 (roadway/drive labels), AW-49 (title-block fields), AW-53
(subdivision file number on cover).

### `no-tool` (2)

| ID | Item | Why no tool |
|---|---|---|
| AW-37 | Recorded final plat / land-status determination present | Document existence — checkable from `README.md` / supplementary docs index. |
| AW-41 | TCEQ Ch. 217 engineer's report submitted (force mains/lift stations) | Same — document existence check. |

---

## Open question

Confidence on cc-13 is high enough that I'm ready to extend this to
the other 12 v2.5-trimmed groupings (cc-1, cc-2, cc-3, cc-5, cc-6,
cc-10, cc-15, cc-19, cc-20, cc-22, cc-23, cc-24).

**Spot-check one more first, or proceed straight through?** If
spot-checking, cc-3 (Roadway / drive — high inspect-drawing density
expected) or cc-15 (Site Plan General — heavy text/title-block) would
be the most informative second sample.
