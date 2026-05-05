# Completeness-Check vs `inspect-drawing` — classification labeling

Reference data for grading whether the cc agent reaches for the
`inspect-drawing` tool when it should. Each checklist item is labeled
with a single `grade` value that captures both the descriptive tool
fit and the grading semantics for an agent run.

**Scope:** All 13 v2.5-trimmed groupings, 185 items. Complete.

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

## Final cumulative stats — all 13 groupings

| Grade | Count | % |
|---|---:|---:|
| `inspect-drawing-required` | 8 | 4% |
| `inspect-drawing-optional` | 46 | 25% |
| `vision-only` | 100 | 54% |
| `no-tool` | 31 | 17% |
| **Total** | **185** | |

**Reference set for "should have called inspect-drawing":** 8 required +
46 optional = **54 of 185 items (29%)** where calling
`inspect-drawing` is at least acceptable. Of those, **8 (4%) are
MUST-call** — not calling them is a miss.

### Per-grouping breakdown

| Grouping | Total | req | opt | vis | no |
|---|---:|---:|---:|---:|---:|
| `cc-1` (Intake & Core Submittal) | 33 | 0 | 3 | 16 | 14 |
| `cc-2` (Base Sheet Requirements) | 6 | 0 | 4 | 2 | 0 |
| `cc-3` (Cover Sheet Notes / Approvals) | 11 | 0 | 1 | 10 | 0 |
| `cc-5` (Plan Content / Data Tables / HCR) | 14 | 0 | 3 | 11 | 0 |
| `cc-6` (Compatibility Standards) | 3 | 0 | 3 | 0 | 0 |
| `cc-10` (Austin Energy & Green Building) | 4 | 0 | 2 | 2 | 0 |
| `cc-13` (AW General Requirements) | 37 | 5 | 7 | 23 | 2 |
| `cc-15` (Trees & Environmental) | 14 | 0 | 2 | 11 | 1 |
| `cc-19` (Floodplain & RSMP) | 22 | 2 | 2 | 5 | 13 |
| `cc-20` (WQ & Drainage Engineering) | 7 | 0 | 3 | 4 | 0 |
| `cc-22` (Transportation Core) | 14 | 1 | 9 | 3 | 1 |
| `cc-23` (Transportation Infrastructure) | 11 | 0 | 7 | 4 | 0 |
| `cc-24` (LDE & ROW) | 9 | 0 | 0 | 9 | 0 |

### Required-item reference set (8 items, 3 groupings)

| Grouping | ID | Item |
|---|---|---|
| cc-13 | AW-21 | Pipes >=24" shown as double lines |
| cc-13 | AW-23 | Wastewater flow direction not indicated |
| cc-13 | AW-28 | Retaining-wall components shown/identified |
| cc-13 | AW-32 | Typical cross sections for private streets/easements |
| cc-13 | AW-39 | Drain field delineation |
| cc-19 | CC-19-05 | Drainage easements contain 100-year floodplain |
| cc-19 | CC-19-19 | Drainage area maps missing flow arrows / contours / spot elevations |
| cc-22 | CC-22-14 | Adjacent driveways within 300 feet shown |

CC-22-14 is interesting — the validation methodology *itself* spells
out a drawing-region symbology pattern ("two wide flat-bottomed U/J
shapes side-by-side, opening same direction"). That's the strongest
signal in the entire corpus that vision is the wrong tool: even the
human-written checklist methodology is reaching for symbology
pattern recognition.

### Top-level observations

1. **All 8 required items live in 3 groupings: cc-13, cc-19, cc-22.**
   Roughly: utility-plan symbology (cc-13), drainage spatial reasoning
   (cc-19), and driveway pattern recognition (cc-22). Other groupings
   either have visual content with strong text labels (so vision
   plausibly works) or no visual content at all.
2. **`cc-6` is the densest visual grouping per item ratio
   (3/3 = 100% optional)** but contributes zero `required` items —
   land use map, elevations, and setbacks all have labels.
3. **`cc-1` (42% no-tool) and `cc-19` (59% no-tool) are the two
   "submittal package" groupings.** Together they hold 27 of 31 no-tool
   items. An agent calling `inspect-drawing` for cc-1 or RSMP-section
   cc-19 items is almost certainly misusing the tool.
4. **`cc-24` is 100% `vision-only`** — License/Encroachment Agreement
   references on plans, AULCC notes. No drawing-area content.
5. **`cc-3` is 91% `vision-only`** — verbatim notes-block matching.
   Strong "do not call inspect-drawing" reference.
6. **Transportation groupings (cc-22, cc-23) skew heavily optional**
   — driveway dimensions, parking stall dimensions, accessible routes,
   ROW improvements. All have visual features but typically with
   dimension/label annotations alongside.

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

## Per-grouping detail — the final four groupings

### cc-20 — `Water Quality & Drainage Engineering` (7 items)

Half engineering documentation (front-page seal, ESL with required
topic coverage, RSMP application or flood-control documentation —
`vision-only`), half cross-section / detail diagrams (detention pond
cross-section with WSEs, outlet structure detail with calcs, WQ pond
cross-section — `inspect-drawing-optional`). Stage-storage discharge
table is vision-only (table read).

### cc-22 — `Transportation Core` (14 items)

The driveway / parking / accessibility grouping. Mostly
`inspect-drawing-optional` because almost every item is a
"dimensioned X" or "shown Y" check on the site plan with annotations
alongside the visual feature. Vision-only: parking-table reads (land
use × sq ft, totals, type identification). One `no-tool` item: TIA
report document presence.

The single `required` item — **CC-22-14** (adjacent driveways within
300 ft) — stands out because the validation methodology itself spells
out the drawing-region symbology pattern ("two wide flat-bottomed
U/J shapes side-by-side, parallel or curving, both opening same
direction"). That's pattern recognition over the drawing area; vision
cannot reliably structure-output it.

### cc-23 — `Transportation Infrastructure & Construction` (11 items)

Heavy `inspect-drawing-optional` (7/11): ROW widths, behind-the-curb
improvements, grading-plan grade lines, ROW improvement dimensions,
horizontal/vertical roadway views, dumpster locations, encroachment
identification. All have visual features with dimension/label
annotations. Vision-only items: target-speed text, signage/striping
plan presence, retaining-wall elevation labels, sealed structural
drawings for ROW retaining walls.

### cc-24 — `Land Development Engineering & ROW` (9 items)

100% `vision-only`. Every item is "License Agreement / Encroachment
Agreement / AULCC reference submitted or referenced on plans" — the
agent reads either a text reference on plans or confirms a
supplementary document. No drawing-area content. Strongest
"do-not-call inspect-drawing" reference grouping in the corpus
alongside cc-3.

---

## Done

All 13 v2.5-trimmed groupings classified (185 items). The TSV is the
single source of truth — join against any agent-run tool-call log on
`(grouping, item_id)` to grade tool choices per the rules in the
"How to use" section.
