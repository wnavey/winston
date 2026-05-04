# Completeness-Check vs `inspect-drawing` — classification labeling

Reference data for grading whether the cc agent reaches for the
`inspect-drawing` tool when it should. Each checklist item is labeled
with the tool that *would* be the correct primary choice in a perfect
world, plus an optional secondary tool when the item genuinely needs
both.

**Scope of v1:** `cc-13` only — pilot to validate the labeling scheme
before doing the other 12 grouping files.

**Source of truth:** [`cc-classification.tsv`](./cc-classification.tsv).
Markdown report wraps it for human review and stat reporting.

## Categories (proposed)

| Category | When to use it |
|---|---|
| `inspect-drawing` | Answer requires reasoning about the drawing area — lines, symbols, spatial relationships, shapes, geometric overlays. Examples: "are flow arrows shown on the wastewater lines?", "are pipes >=24 inch drawn as double lines?", "are floodplain zones overlaid on the plan?" |
| `generic-vision` | Answer comes from text, labels, table cells, checkboxes, title-block fields, schedules, or general OCR. Examples: "is the AW Infrastructure table completed?", "is the Mapsco page number shown on the location map?" |
| `no-vision-tool-req` | Answer comes from non-visual sources — file existence in the plan set, supplementary-document index, `README.md`, `facts.md`. Examples: "is the TCEQ Ch. 217 engineer's report submitted?", "is a recorded final plat included?" |

Each item also gets a `secondary_tool` when the answer plausibly needs
both (e.g. AW-22: existing W/WW infrastructure — labels are vision,
visible linework is inspect-drawing).

## Are 3 categories enough?

For cc-13 the 3 categories work, but two seams emerged that we should
decide on before classifying the other 12 groupings:

1. **"Either tool would work"** — a handful of items (AW-12 fire-flow
   map presence, AW-18 plan-view-at-top-half, AW-33 key-maps) are
   answerable by *either* tool. Today I'm assigning a primary plus a
   secondary. Two cleaner alternatives:
   - Add an `either` category and drop `secondary_tool` on those rows.
   - Keep primary/secondary but add a `confidence` field (already
     present in the TSV) so we know which rows we're fuzzy on.
   The current TSV uses the primary/secondary + confidence approach.
2. **MUST vs MAY for inspect-drawing.** For grading "did the agent
   pick the right tool?" the meaningful question is: was
   inspect-drawing **required**, **helpful**, or **misuse**? That maps
   onto:
   - `inspect-drawing-required` — pure drawing reasoning, vision
     would not produce a structured answer (AW-23 flow arrows, AW-21
     double-line styling, AW-32 cross-sections, AW-39 drain field
     delineation).
   - `inspect-drawing-helpful-or-either` — answerable both ways
     (AW-18, AW-22, AW-27, AW-29, AW-38a/b).
   - `inspect-drawing-misuse` — vision-only territory, calling
     inspect-drawing here would be wrong (AW-01, all the table-cell
     items).
   This 3-tier "primary tool" scheme is more useful than the current
   one if the goal is to grade the agent's tool choices.

**Recommendation:** add a fourth column `inspect_drawing_grade ∈
{required, optional, misuse}` for grading purposes, alongside the
existing `primary_tool` for descriptive labeling. Will fold in once
you confirm.

## Are these labels reliable across all 13 groupings?

Confidence by source:

- **High confidence** (cc-13 here): I have the full grouping file +
  the AW completeness checklist context inline, and many items map
  cleanly to either text-extraction or drawing-symbology.
- **Probably high** (cc-1 through cc-6, cc-19, cc-20 etc): I'd want
  to read each grouping file directly. Many AW-style items in other
  groupings are text/table extraction (cover sheet, schedules);
  drainage and transportation groupings will have more drawing-area
  questions.
- **Edge cases:** items that reference "shown on plan" but where the
  *real* check is whether a label or callout is correct — those split
  between vision and inspect-drawing depending on whether the agent
  is reading text vs assessing the visible feature.

I have enough context to label all 13 groupings confidently if you
want me to proceed. Where I'm unsure, I'll mark `confidence=medium`
and flag in the notes.

---

## cc-13 — `Austin Water — General Requirements` (37 items)

Stats:

| Category | Count | % |
|---|---|---|
| `inspect-drawing` (primary) | 11 | 30% |
| `generic-vision` (primary) | 24 | 65% |
| `no-vision-tool-req` (primary) | 2 | 5% |

Of the 11 `inspect-drawing` items, **5 also benefit from a vision pass**
(`secondary_tool=generic-vision`): AW-22, AW-27, AW-29, AW-30, AW-38a,
AW-38b — the agent typically needs to read labels alongside the visual
check.

Of the 24 `generic-vision` items, **3 could fall back to inspect-drawing**
(`secondary_tool=inspect-drawing`): AW-31, AW-33, AW-46.

### inspect-drawing items (11)

| ID | Item (paraphrased) | Why inspect-drawing |
|---|---|---|
| AW-18 | Profile view present + plan view at top half of sheet | Sheet layout is a spatial/visual question; vision can read `PLAN`/`PROFILE` labels but the layout assertion is drawing-region. |
| AW-21 | Pipe size/material/location vs easements/ROW; >=24" pipes as double lines | Double-line styling is pure drawing symbology. |
| AW-22 | Existing W/WW infrastructure shown with location/size/material | Visible linework + labels. |
| AW-23 | Wastewater flow direction not indicated on plan views | Canonical inspect-drawing case — flow arrows on lines. |
| AW-27 | Easement recordation numbers + proposed easement limits | Limits are visible boundaries on the plan. |
| AW-28 | Retaining-wall components (geogrid, straps, tie-backs) shown/identified | Drawing detail / section reading. |
| AW-29 | Physical obstructions in ROW affecting W/WW/reclaimed | Visual identification on plans. |
| AW-30 | TCEQ crossing compliance details where mains cross | Locating crossings is inspect-drawing. |
| AW-32 | Typical cross sections for private streets/easements | Visual diagram. |
| AW-38a | Floodplain / CWQZ / erosion-hazard zones shown | Boundary overlays on the drawing. |
| AW-38b | Storm sewers, easements, watercourse centerlines shown | Drawn linework. |
| AW-39 | Drain field delineated for properties not on city sewer | Visual delineation. |

(That's 12 — the table above counts AW-22 and AW-27 as inspect-drawing
primary; if you push them to "either" the count drops to 10.)

### generic-vision items (24)

The "AW General Info Sheet" cluster — AW-01, AW-02, AW-03, AW-05,
AW-06, AW-07, AW-08, AW-10, AW-11, AW-12, AW-13, AW-14, AW-16, AW-25
— is **all generic-vision**. These are template-completeness checks:
boxes filled, tables filled, checkboxes ticked, title block present.

Other vision items: AW-19 (location-map labels), AW-20 (construction
notes text matching), AW-31 (curve data table), AW-33 (key-map
presence), AW-36 (scale + sheet size), AW-45 (street address labels),
AW-46 (roadway/drive labels), AW-49 (title-block fields), AW-53
(subdivision file number on cover).

### no-vision-tool-req items (2)

| ID | Item | Why no tool |
|---|---|---|
| AW-37 | Recorded final plat / land-status determination present | Document existence — checkable from `README.md` / supplementary docs index. |
| AW-41 | TCEQ Ch. 217 engineer's report submitted (force mains/lift stations) | Same — document existence check. |

---

## Open question for you

Before I classify the other 12 groupings, confirm one of:

1. **Keep the current scheme** (primary tool + optional secondary +
   confidence). Best for descriptive labeling.
2. **Add an `inspect_drawing_grade` column** with values `required`,
   `optional`, `misuse`. Best for grading agent runs against this
   reference.
3. **Replace primary/secondary with a single 4-value category**:
   `inspect-drawing-required` / `inspect-drawing-optional` /
   `vision-only` / `no-tool`. Cleanest single-column scheme.

I lean **#2** — keep the descriptive labels and add the grading column
on top. Then `inspect_drawing_grade=required` rows are your "agent
should have called inspect-drawing here" reference set, and
`inspect_drawing_grade=misuse` rows are your "agent should NOT have
called inspect-drawing here" reference set.
