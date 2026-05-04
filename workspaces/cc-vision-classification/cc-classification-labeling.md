# Completeness-Check vs `inspect-drawing` — classification labeling

Reference data for grading whether the cc agent reaches for the
`inspect-drawing` tool when it should. Each checklist item is labeled
with a single `grade` value that captures both the descriptive tool
fit and the grading semantics for an agent run.

**Scope:** `cc-13`, `cc-1`, `cc-2`, `cc-3`, `cc-5` (5 of 13 groupings,
101 items). Remaining 8 groupings (cc-6, cc-10, cc-15, cc-19, cc-20,
cc-22, cc-23, cc-24) staged for follow-up commits.

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

## Cumulative stats across the 5 classified groupings

| Grade | Count | % |
|---|---|---|
| `inspect-drawing-required` | 5 | 5% |
| `inspect-drawing-optional` | 18 | 18% |
| `vision-only` | 62 | 61% |
| `no-tool` | 16 | 16% |
| **Total** | **101** | |

Reference set for "should have called inspect-drawing": **23 of 101
items (23%)** where the call is at least acceptable. Of those, **5
(5%) are MUST-call** — not calling them is a miss.

### Per-grouping breakdown

| Grouping | Total | required | optional | vision-only | no-tool |
|---|---:|---:|---:|---:|---:|
| `cc-1` (Intake & Core Submittal) | 33 | 0 | 3 | 16 | 14 |
| `cc-2` (Base Sheet Requirements) | 6 | 0 | 4 | 2 | 0 |
| `cc-3` (Cover Sheet Notes / Approvals) | 11 | 0 | 1 | 10 | 0 |
| `cc-5` (Plan Content / Data Tables / HCR) | 14 | 0 | 3 | 11 | 0 |
| `cc-13` (AW General Requirements) | 37 | 5 | 7 | 23 | 2 |

**All 5 `inspect-drawing-required` items live in cc-13** (Austin Water
utility plan content). The other 4 groupings have visual content but
none that *fundamentally* requires drawing-region reasoning — labels
and text are typically present alongside any visual feature, so vision
is at least workable.

### Notable observations

1. **`cc-1` is dominated by `no-tool` (42%).** Most items are document-
   existence checks (CC Application, Tax Cert, ESL, TIA, PRF, optional
   cert letters, facade photos) — answerable from the file index without
   any vision tool. This is a useful baseline: an agent calling
   `inspect-drawing` on cc-1 items is almost certainly misuse.
2. **`cc-3` is 91% `vision-only`.** Verbatim notes blocks, approval
   blocks, sheet index — all OCR / text comparison. Only CC-3-27 (Great
   Streets / UNO boundaries) is plausibly an inspect-drawing call.
3. **`cc-2` is the highest concentration of `inspect-drawing-optional`
   (67%).** Boundary lines, easements, utility lines on plan sheets —
   the validation methodology already calls these out as "vision model"
   tasks, but they're geometric features where inspect-drawing is at
   least as appropriate as vision.
4. **`cc-13` is the only grouping with required items.** Confirms the
   first experiment-run hypothesis: cc-13 items (wastewater flow arrows,
   double-line pipe styling, retaining-wall components, cross sections,
   drain fields) are the cases where the agent should reach for
   inspect-drawing.

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

## Per-grouping detail — the four new groupings

### cc-1 — `Intake & Core Submittal` (33 items)

Almost entirely about whether documents are present in the submittal
package and whether forms are completed/signed. Heavy `no-tool` tail:

- **`no-tool` (14):** CC-1-01 (CC App PDF), -08 (Tax Cert), -10 (ESL
  presence), -14 (TIA report when required), -15 (PRF), -18 (VR
  Petition), -20 (plan set), -22 (Legal Description), -27 (extension
  prior set), -29 (revision unmarked set), -31 (SMART), -32 (DB90),
  -34 (facade photos), -41 (PDF format).
- **`vision-only` (16):** Reading form fields, signatures, seals, dates,
  PE certifications, project review form contents.
- **`inspect-drawing-optional` (3):** CC-1-23 (limits of construction /
  property boundaries with bearings/dims), CC-1-24 (existing utilities
  + crossovers), CC-1-25 (existing easements + setbacks). These are
  the only items where the agent needs to look at drawing content vs
  forms/text.

### cc-2 — `Base Sheet Requirements` (6 items)

Tightest grouping. Half is reading text (watershed in ESL, PE seals on
sheets); the other 4 items are about drawn features on plan sheets
(boundary lines + bearings, easements, overhead/underground utility
lines). All 4 are `inspect-drawing-optional` because labels typically
accompany the geometric features.

### cc-3 — `Cover Sheet Notes, Approval Blocks & Standard Notes` (11 items)

The "verbatim text comparison" grouping. 10 of 11 items are checking
that specific note blocks (Ordinance Requirements, Compatibility,
General Construction, ADA, Developer Info, Director DSD approval, BSZ
approval, Austin Fire notes) match the canonical Notes and Templates
DOCX. Pure text matching. Only CC-3-27 (Great Streets / UNO boundaries
on the site plan) escapes into `inspect-drawing-optional`.

### cc-5 — `Plan Content, Data Tables & Conditional Plan Requirements` (14 items)

Mix of addressing labels (ADR-01/04/07/08), data table reads (DAT-01..07),
and Hill Country Roadway conditional items. 11 are `vision-only`
(label/table reading); 3 are `inspect-drawing-optional` — ADR-05
(driveway/handicap-parking/garage/sidewalk identification — labels +
visual ID), HCR-01 (construction lines + cut/fill), HCR-02
(mechanical equipment screening). HCR-01/-02 sit closest to "required"
but the items typically have labels accompanying the visual features,
so optional is correct.

---

## Next

Eight groupings remaining: **cc-6, cc-10, cc-15, cc-19, cc-20, cc-22,
cc-23, cc-24**. These cover (rough guesses pre-read):

- `cc-6` — likely transportation / drive details (drawing-heavy)
- `cc-10` — TBD; could be tree/landscape (vision-heavy)
- `cc-15` — Site Plan General (mixed)
- `cc-19` — TBD
- `cc-20` — TBD
- `cc-22` — TBD
- `cc-23` — TBD
- `cc-24` — TBD

I'll keep staging in batches per your token-monitoring preference.
