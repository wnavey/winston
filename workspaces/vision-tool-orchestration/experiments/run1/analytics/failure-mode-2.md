# Run 1 — Failure Mode 2 deep dive

**Date:** 2026-05-06
**Companion to:** [`analysis.md`](./analysis.md) (run-level findings)
**Output:** [bureau PR #301](https://github.com/noetic-inc/bureau/pull/301)

This file documents the analysis that produced the dimension-anchor
prompt change in bureau, and what it deliberately leaves unfixed.

---

## What FM2 is

From [`../../eval-plan.md`](../../eval-plan.md), Failure Mode 2 is when
the agent correctly decided an item needed `vision_check`, but the
classifier routed it to `generic` instead of `drawing_inspect`. The
fix surface is the classifier prompt
(`bureau/jurisdictions/austin/workflows/completeness-check/prompts/vision-router.md`),
not the agent's `review.md`.

---

## The 12 misrouted items

Pulled from `vision-call-invocation-metrics.tsv` —
`grade ∈ {inspect-drawing-required, inspect-drawing-optional}`,
`actual_vision_tool_call = "vision_check (generic -> vision)"`,
`finding_status ≠ not-applicable`. Joined with `vision-check-calls-audit.tsv`
for the classifier reasoning.

### Cluster A — dimensions / widths / radii missing on the drawing (5)

| ID | Text | Classifier confidence |
|---|---|---:|
| `cc-22:CC-22-12` | Driveway spacing dimensions not shown on plans (DRV-02) | 0.85 |
| `cc-22:CC-22-13` | Driveway widths or curb return radii not shown on plans (DRV-03) | 0.85 |
| `cc-22:CC-22-20` | Parking aisle widths or internal driveway widths not dimensioned (PRK-04) | 0.85 |
| `cc-23:CC-23-01` | Existing ROW width not shown or not dimensioned (GRD-01) | 0.85 |
| `cc-23:CC-23-04` | Dimensions for new or modified ROW improvements not shown (GRD-04) | 0.85 |

### Cluster B — boundary lines + bearings missing (1)

| ID | Text | Classifier confidence |
|---|---|---:|
| `cc-2:CC-2-16` | Boundary lines with bearings and dimensions not shown on Existing Conditions or Overall Site Plan sheet(s) (BAS-07) | 0.92 |

### Pattern 2 — drawing element / view / map missing (5)

| ID | Text | Classifier confidence |
|---|---|---:|
| `cc-13:AW-18` | Profile view missing for public water/reclaimed/wastewater mains, or plan view not at top half of sheet | 0.92 |
| `cc-23:CC-23-03` | Grading plan with existing and proposed grade lines not provided (GRD-03) | 0.95 |
| `cc-23:CC-23-10` | Location of existing and proposed dumpsters and garbage carts not shown (SVC-01) | 0.92 |
| `cc-6:CMP-01` | Land use map showing adjacent land uses not provided | 0.95 |
| `cc-6:CMP-02` | Building elevations showing architectural elements not provided | 0.95 |

### Compound (1)

| ID | Text | Classifier confidence |
|---|---|---:|
| `cc-13:AW-27` | Recorded easement recordation numbers (volume/page) not shown for existing easements, or proposed easement limits not indicated | 0.95 |

This item bundles a label-readout component (recordation numbers) with
a spatial-reasoning component (easement limits). Per the iter-1 scope
in `plan.md`, compound items are intentionally routed to `generic` —
so this isn't really a misroute, it's an artifact of compound-item
handling that gets resolved when decomposition lands in iter 2+.

---

## The classifier's recurring rationalization

Across all 12 misroutes, the classifier reasoning collapses to one
formula (verbatim phrase variants in 11 of 12 records):

> "...is a *document-level inspection* / *label/notation presence
> check* rather than a *measurement* or *spatial relationship* analysis."

The classifier has internalized a dichotomy:

- `drawing_inspect` = reasoning about lines / symbols / spatial
  relationships *between* features
- `generic` = "is this thing present?" / "is this label there?"

That dichotomy is reasonable in the abstract but **wrong for this
domain**. Checking whether dimension labels exist on a drawing still
requires looking at the drawing — there is no document-presence
shortcut. The prompt needed to explicitly contradict this
rationalization.

---

## Why the prompt failed at this

`bureau/.../vision-router.md` (pre-PR-#301) had:

1. **Definition** (line 9-12): emphasized *"lines, symbols, spatial
   relationships, or shapes"* — the classifier mapped "dimension
   annotation" → label, not shape, → generic.
2. **`generic` definition** (line 13-17): explicitly listed
   "**label readout**" and "**note presence**" — exactly the words
   the classifier used to justify these routes.
3. **Few-shots:** all 4 `drawing_inspect` examples were about flow
   direction, line styles, presence of features. **Zero were about
   dimensions, bearings, sheet composition, or required views.**
4. The closest `generic` analog (`"Recorded final plat … not
   provided"`) actively taught the classifier that "X not provided"
   → generic.

---

## Hypotheses and which we picked

| ID | Description | Items covered | Picked? |
|---|---|---:|---|
| H1 | Add dimension/annotation few-shots to `drawing_inspect` | Cluster A (5) | ✓ |
| H2 | Add view/sheet-composition few-shots | Pattern 2 (4) | deferred |
| H3 | Tighten `generic` definition (carve out drawing-area annotations) | partial overlap | partially in H4 |
| H4 | Reframe `drawing_inspect` to explicitly include drawing-element presence checks | Clusters A + B + Pattern 2 | ✓ (in definition tweak) |
| H5 | Compound-item handling | AW-27 (1) | deferred to iter 2 |

We picked H1 + H4 minimally. The user explicitly asked for the
smallest possible change focused on widths, dimensions, bearings, and
boundary lines — so Pattern 2 (views/maps/elevations) is not
addressed in this PR. That's intentional: keeping the change small
lets run2 cleanly attribute any lift to the dimension/annotation
framing rather than a multi-pattern bundle.

---

## The actual change (bureau PR #301)

Two parts. **One clause** appended to the `drawing_inspect`
definition:

> ...This also includes checking whether dimensions, widths,
> bearings, or boundary line annotations are shown on the drawing —
> those are drawing elements, not document-presence checks.

This directly contradicts the "document-level inspection" formula.
It's the load-bearing piece — without it, the few-shots compete with
the prompt's own framing.

**Two new few-shots:**

```
"Driveway spacing dimensions not shown on plans"                 -> drawing_inspect
"Boundary lines with bearings and dimensions not shown on plans" -> drawing_inspect
```

The first anchors Cluster A (5 items) by phrasal similarity. The
second anchors Cluster B (1 item) and teaches that bearings +
boundary lines are drawing elements.

---

## Why curb return radii was excluded

CC-22-13 says "Driveway widths **or curb return radii** not shown".
"Driveway widths" is purely drawing-area; curb return radii is
compound — the curve labels (C1, C2…) live in the drawing area, but
the actual numerical values (radius, length, delta) live in the
separate Record Curve Table. A complete check requires both a
drawing-area inspection and a table read.

We considered three options:

1. **Drop "curb return radii" from the few-shot.** Use a phrasing
   without compound-tool ambiguity.
2. **Keep it, trust orchestration to call both inspect-drawing and
   generic.** Doesn't match the iter-1 architecture (single classifier
   call → single specialist dispatch).
3. **Keep it, knowing the Record Curve Table is preprocessed.**
   Possibly true today, but a near-twin item where the table
   *isn't* preprocessed would inherit a faulty generalization.

We went with (1). The chosen few-shot `"Driveway spacing dimensions
not shown on plans"` is verbatim CC-22-12 and is purely drawing-area
(no table cross-reference), so it's a clean Cluster A anchor.

---

## Coverage summary

| Pattern | Items | Addressed by PR #301? |
|---|---:|---|
| Cluster A (dimensions/widths) | 5 | ✓ |
| Cluster B (boundary/bearings) | 1 | ✓ |
| Pattern 2 (views/maps/elevations) | 5 | no — deferred |
| Compound (AW-27) | 1 | no — iter-2 scope |

PR #301 targets ~6 of 12. Pattern 2 is intentionally deferred so we
can isolate the dimension-anchor signal in run2.

---

## Verification path

1. **Baseline** ([`../../baseline/kickoff.md`](../../baseline/kickoff.md))
   establishes how often the production prompt calls generic `vision`
   on these items today (no `experiment` flag).
2. **Run 2** — re-run with `experiment=vision-check` after PR #301
   merges (`runs=3`, `runLabel=VISION_CHECK_CC_RUN_2`). Expect
   Cluster A + B items to flip from `(generic -> vision)` to
   `(drawing_inspect -> ...)`.
3. **Cross-tab** vs run1 audit — verify no regressions on the 4
   existing `drawing_inspect` few-shot patterns and on the `generic`
   items.

If Cluster A + B flip cleanly and Pattern 2 stays misrouted as
predicted, that's strong evidence the framing fix worked and a
follow-up PR for Pattern 2 (views/maps/elevations) is warranted.
