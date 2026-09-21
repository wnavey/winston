# Cartographer — placing extracted figures relative to each other (`extract-geometry` placement phase)

**Status:** Draft v1
**Date:** 2026-09-21
**Repos touched:** `cartographer` (runbook: one new phase + prompt + script, transcribe/assemble schema; `/processed` rendering), `substation` (one additive migration on `cartographer_geometries`)
**Repos NOT touched:** `bureau`, `cityhall`, `conductor`/`conductor2`
**Predecessor:** [`../geometry-extraction/DESIGN-SPEC.md`](../geometry-extraction/DESIGN-SPEC.md) (winston#266) — this lifts part of its §7 "Anchoring (D3)" deferral. SRID/WGS84 stays deferred.

> Short spec. Extraction stays unanchored. A new phase decides, from evidence printed on the document, which figures belong to one drawing and where each sits relative to the others.

---

## 1. Problem

Every figure `extract-geometry` produces is walked from its own Point of Beginning at `(0,0)`. The runbook says so on purpose (`cartographer/runbooks/extract-geometry/RUNBOOK.md:121`: "Every figure walks from the origin. Printed State Plane coordinates get recorded in `notes` and drive nothing."). `/processed` then draws all of a file's figures on one canvas, so they stack on top of each other.

Verified on the car-wash plat (`cartographer_files.id = bebccffa-baaa-444e-a800-2b760f90ef78`, run `car-wash-2024178771-run2`, `~/noetic/working/cartographer-geometry/car-wash-2024178771-run2/artifact.json`): 8 figures (LOT 1–3, R/W dedication areas 1–3, the S&D easement, the cross-access easement), all starting at `(0,0)`. You can check one shape at a time with the toggles. You can't check the layout against the plat, which draws them side by side.

The comment at `cartographer/src/routes/processed/+page.svelte:15` says a file's figures "sit in the same coordinate frame". They share a canvas, but each has its own frame.

### 1.1 The information to place them is already being read, just not structured

From the run-2 `notes` and `hitl/readout.md`:

| Figure | Evidence on the plat |
|---|---|
| LOT 1, 2, 3; R/W 1, 3 | Printed State Plane N/E at the POB (e.g. LOT 1 `N:3955650.03 E:4953690.49`), which lives only in `notes` as free text |
| R/W 3 | Its course 2 walks LOT 1's west line in reverse (`S 55°56'43" E 411.49'`) (readout:25) |
| R/W 2 | POB is a monument, with no coordinates, but its west side is the same line as R/W 1's east side (readout:94) |
| S&D easement, cross-access easement | Each starts at a point of commencement (P.O.C.), with tie courses DE13/DE14 and CA16/CA17 "from parent tract". The ties are read, then dropped into `notes` |

The readout also flags that the plat's coordinate boxes "run 180° opposite the bearings" (readout:75). So the printed coordinates alone can't be trusted blindly, which is the reason for D2.

### 1.2 Siblings are not a property of the file

A plat's figures belong to one drawing. But one document can also list several unrelated metes-and-bounds descriptions, for example a deed with exhibits for separate tracts. Those are independent shapes that happen to share a PDF. So grouping must come from **evidence**, never from being in the same file. Figures start unrelated, and placement is what makes them siblings.

---

## 2. Decisions

- **D1 — Extraction stays unanchored.** Transcribe, order and assemble are unchanged in what they compute. `polygon` stays walked from its POB at `(0,0)`. Placement is stored **beside** the polygon as a translation, never baked into it, so placement can be redone without re-reading the plat. This mirrors the reason `mete` and `polygon` are both stored (winston#266 §5).
- **D2 — Evidence precedence: shared line > tie > printed coordinates.** A shared line is geometry read off the drawing and checked against both figures' own traverses. A tie is a printed walk from a known point. Printed coordinates are a third, independent transcription and can be internally inconsistent (§1.1, readout:75). When two kinds of evidence disagree, the higher-ranked one places the figure and the disagreement is reported with its residual.
- **D3 — No new human-review stop.** Placement runs automatically between assemble and the existing readout stop. It adds a section to the readout, and the existing publish / re-read / stop ruling covers it. It never blocks: a bad placement is reported the same way misclosure is (winston#266 D4).
- **D4 — Honesty boundary is unchanged: agents name relationships, scripts compute numbers.** A vision worker says *which* line of figure A is *which* line of figure B, or *which* point a P.O.C. is. `place.ts` (zero LLM) computes every offset and residual through `src/lib/geometry`. A wrong claim shows up as a large residual, not a plausible offset.
- **D5 — A frame is a connected component of evidence.** Figures are nodes, and accepted evidence links are edges. Each connected component is a **frame**, laid out relative to one reference figure at `(0,0)`. A figure with no links is a frame of one, which is valid and reported as unplaced, never dropped beside the others by guesswork.
- **D6 — Translation only.** Figures in one frame share a basis of bearings, because they're drawn on one sheet. So placement is `(dx, dy)`, with no rotation. A frame that would need rotation is out of scope (§5).
- **D7 — Frames are per file, per run.** No cross-file frames.

---

## 3. Pipeline change

```
kickoff → survey → transcribe → [ordering] → assemble → placement pass → place.ts → HITL ⛔ → publish
                                                          (new, vision)   (new, 0 LLM)
```

### 3.1 Transcribe and assemble: structure what is already read

`transcribe/<region>.json` and `raw-artifact.json` gain optional, structured fields, replacing the free text in `notes`:

```jsonc
"pob": {
  "description": "1/2\" IRON ROD (FND) NO CAP",           // today's `pointOfBeginning` prose
  "coordinates": { "n": 3955650.03, "e": 4953690.49, "verbatim": "N:3955650.03 E:4953690.49" } | null,
  "commencement": {                                         // null unless the figure starts from a P.O.C.
    "description": "P.O.C. CROSS-ACCESS ESMT, 1/2\" IRON ROD (FND) NO CAP",
    "ties": [ /* ordinary courses, same schema as `courses`, e.g. CA16, CA17 */ ]
  } | null
}
```

Ties become real courses, so the verbatim diff and parser checks cover them too. They stay out of the outline, as today.

### 3.2 Placement pass (new, vision): `prompts/place-figures.md`

This runs once per page that carries two or more figures. It is skipped when the run has exactly one figure. The worker sees the page at survey resolution plus each figure's walked outline, and the numbered courses rendered in their `(0,0)` frames. It **reads no values**. It returns claims:

```jsonc
{
  "sharedLines": [
    { "a": "figure-6", "aCourse": 2, "b": "figure-1", "bCourse": 7, "sense": "reversed",
      "evidence": "R/W 3's east side is drawn on LOT 1's west line; one label serves both" }
  ],
  "commencements": [
    { "figure": "figure-8", "pocIs": { "figure": "figure-1", "vertex": 0 },
      "evidence": "P.O.C. symbol sits on LOT 1's POB iron rod" }
  ],
  "unrelated": [ { "figure": "figure-9", "why": "separate exhibit, no shared line or tie" } ]
}
```

`vertex` indexes the ring. The same rules as the ordering pass apply: when unsure, say so, and never invent a link.

### 3.3 `scripts/place.ts` (new, zero LLM)

1. **Check each claim.** A shared-line claim is accepted only if the two courses agree in length and bearing, with the bearing reversed when `sense` is reversed, within survey tolerance (`SURVEY_CLOSE_TOLERANCE` for length; bearing tolerance per Q1). A rejected claim is reported, not used.
2. **Build edges**, each giving a candidate `(dx, dy)` of B relative to A:
   - *shared line*: align the matched segment's endpoints
   - *tie*: walk the tie courses from the P.O.C. vertex to the figure's POB
   - *coordinates*: `(ΔE, ΔN)` between two figures' printed POBs, only when both carry them
3. **Build frames.** Take the connected components over accepted edges. Within each, pick the reference figure (the largest parcel by computed area), then take a spanning tree preferring edge rank per D2.
4. **Report every non-tree edge as a check**: the residual between the offset it implies and the placed one. A coordinate edge that disagrees with a shared-line placement is exactly how §1.1's 180° question gets answered, or flagged.
5. **Sanity check**: overlapping parcel or right-of-way interiors within a frame are reported. Easements are expected to overlie parcels, so they're exempt.
6. **Write** `placement.json` and merge per-figure placement into `artifact.json`.

### 3.4 Readout

A new **Placement** section lists:

- each frame: its figures, its reference figure, and how each figure was placed (method + evidence)
- the checks, with residuals
- rejected claims
- unplaced figures

No new decision is asked for (D3).

---

## 4. Data model and UI

Additive migration on `cartographer_geometries`, with all columns nullable so existing rows stay valid:

```sql
alter table public.cartographer_geometries
  add column frame_key           text,              -- 'frame-1'; unique per (file_id, run_slug)
  add column offset_x            double precision,  -- feet, relative to the frame's reference figure's POB
  add column offset_y            double precision,
  add column placement_method    text,              -- 'reference' | 'shared_line' | 'tie' | 'coordinates' | 'unplaced'
  add column placement_evidence  jsonb;             -- the claim(s) + residuals that placed it
```

`polygon` is untouched (D1), and the rendered position is `translatePolygon(polygon, offset_x, offset_y)`. `publish.ts` writes the new columns. Its `ArtifactFigure` type gains the fields, so a missing one fails there, not as a null insert.

`/processed`:

- draws **one frame at a time**, with a frame picker when a file has more than one
- shows unplaced figures in their own frame, never stacked with a placed one
- adds a placement line to each figure's detail
- keeps rotation (`quarterTurns`) applied to the whole frame
- corrects the misleading `+page.svelte:15` comment

Rows from before this change, with a null `frame_key`, render as today.

---

## 5. Deliberately deferred

- **Real-world anchoring** (SRID / WGS84 / `geo` table). Frames stay local, in feet. Printed coordinates are used only as relative evidence (`ΔE`, `ΔN`).
- **Rotation between figures** (D6). This would matter for figures from different bases of bearings, which also means different documents (D7).
- **Cross-file frames** (D7).
- **Curved shared lines.** Curves are still chords (winston#266 D2). A shared curve matches chord-to-chord, which works when both figures walk the same chord (LOT 1 and LOT 2 do, C3/C4 vs C1/C2). It fails when they chord it differently, and that's reported as a rejected claim.
- **A human-review stop for placement** (D3). Revisit if auto-placement produces confident wrong frames.

---

## 6. Acceptance: re-run the car-wash plat

1. All 8 figures land in **one frame** with LOT 1 as reference.
2. R/W 3 is placed by its shared line with LOT 1, and R/W 2 by its shared line with R/W 1.
3. LOT 1–3 share boundary lines with residual ≤ 0.01 ft.
4. The two easements are placed by tie, or reported unplaced if the P.O.C. can't be identified. Either outcome is acceptable, but it must be stated.
5. The coordinate checks either agree with the shared-line placements or report the 180° disagreement with a residual.
6. Visually, the `/processed` render matches the plat's layout (rotated per the existing 270° view).

---

## 7. PR sequence

| # | Repo | Contents |
|---|---|---|
| 1 | `winston` | This spec |
| 2 | `substation` | Additive migration (§4) |
| 3 | `cartographer` | Transcribe/assemble `pob` schema, `place-figures.md`, `place.ts` (+ tests on synthetic lots), RUNBOOK phase + readout section, `publish.ts` |
| 4 | `cartographer` | `/processed` frame rendering + comment fix |

---

## 8. Open questions

- **Q1 — Shared-line bearing tolerance.** Printed to the second, so an exact match is expected. But a line printed twice can differ by a rounding second (readout:89 shows coordinate-derived vs printed differing by ~3′). Start at ≤ 1″ and 0.01 ft, then tune on the car-wash re-run.
- **Q2 — Can `place.ts` propose shared lines itself?** Equal length plus reversed bearing is cheap to find, but ambiguous: a rectangle's opposite sides match too. Proposed answer: no, it only verifies worker claims (D4). Revisit if workers miss obvious links.
- **Q3 — Reference-figure choice.** Largest parcel by area, or the figure whose POB the plat marks as the parent tract's? It affects only the viewer's origin, not correctness.
- **Q4 — Placement pass on single-figure-per-page documents.** A deed whose figures span several pages still needs cross-page claims. Run one worker per document instead of per page when the figures span pages?
- **Q5 — Do rejected coordinate checks need their own readout flag** so the 180° class of plat defect is easy to spot across runs?
