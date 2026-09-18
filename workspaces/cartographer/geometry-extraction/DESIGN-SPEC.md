# Cartographer — geometry extraction runbook (`extract-geometry`)

**Status:** Draft v1
**Date:** 2026-09-18
**Repos touched:** `cartographer` (the runbook + prompts + scripts, and the `/processed` UI), `substation` (one migration — `cartographer_geometries`)
**Repos NOT touched:** `bureau` (this runbook lives in cartographer, deliberately — see D1), `cityhall`, `conductor`/`conductor2`, `navalbase`
**Prod:** Supabase project **Noetic App** (`mgxqsrjutswbciyrltwd`)
**Predecessor:** [`../app/DESIGN-SPEC.md`](../app/DESIGN-SPEC.md) (winston#265) — the file intake this consumes
**Prior art:** [`../../diligence/sir-geometry/ingesting-supporting-docs-3089/SPEC.md`](../../diligence/sir-geometry/ingesting-supporting-docs-3089/SPEC.md) — the same reconstruction done by hand, on the same document

> Scaffolding, not a finished extractor. The goal is water through the pipes: a Claude Code session takes a `cartographer_files.id`, reads the plat, and lands renderable SRID:0 geometry in the database. Curves, closure enforcement, and anchoring are all explicitly deferred (§7).

---

## 1. Problem

Cartographer can now store a plat (winston#265, shipped 2026-09-18) and can render SRID:0 geometry (`src/lib/render/SvgCanvas.svelte`). Nothing connects the two: the geometry it draws is hardcoded in `src/lib/shape-sets.ts` or hand-typed into the Playground. `VISION.md` names the missing link directly — "go from surveyed **metes and bounds** … and turn them into shapes" — and predicts it "may even need to start as an **agentic step** — a skill we define and refine — rather than pure deterministic parsing."

This is that step.

### 1.1 What already exists (verified, cartographer @ `9dfdc89`)

The deterministic half is **already built and tested**, which is why this runbook writes no geometry math:

| Piece | Where |
| --- | --- |
| `Bearing` = `{quadrant, degrees, minutes, seconds}` | `src/lib/geometry/bearing.ts:14` |
| `bearingToAzimuth`, `formatBearing` | `bearing.ts:33`, `:52` |
| `Course` = `{bearing, distance}` | `src/lib/geometry/traverse.ts:15` |
| `runTraverse` (POB-first vertices, nanofoot snapping) | `traverse.ts:44` |
| `traverseMisclosure` | `traverse.ts:61` |
| `Mete`, `meteToTraverse`, `meteToPolygon` | `src/lib/geometry/mete.ts` |
| `parseMete` — zod validation of untrusted JSON | `src/lib/playground/mete-json.ts` |
| SRID:0 SVG rendering | `src/lib/render/SvgCanvas.svelte`, `scene.ts` |

62 unit tests cover it, including a test asserting the reference lot's mete ports to `referenceLot`.

### 1.2 The document this is built against

`cartographer_files` row `bebccffa-baaa-444e-a800-2b760f90ef78` — `car-wash-sir-easments-2024178771.pdf`, 2 pages, 4,127,322 bytes, uploaded 2026-09-18. This is the **same recorded plat** (instrument 2024178771, Louisville KY car-wash SIR) that the sibling 3089 spec reconstructed by hand into the `geo` table. Using it here means the output can be checked against a known-good answer.

**Where this deliberately diverges from that spec.** Its headline finding was "printed State Plane coordinates beat a metes-and-bounds traverse," because it needed *absolutely placed* geometry for a WGS84 map overlay — a traverse needs a placed POB and a trusted basis-of-bearing. SRID:0 is unanchored by definition, so that objection doesn't apply: walking the courses from an arbitrary origin is the correct primary method here (D3). The spec's **validation** ideas do carry over (§4.3).

---

## 2. Roles and shape

Modeled on `bureau/runbooks/preprocessing-v3/RUNBOOK.md`.

**Top-level runner** — the operator-facing session. Resolves the input, writes `ADDENDUM.md`, spawns the orchestrator as a background sub-agent, sits idle, runs the one HITL conversation, and on an explicit go runs the publish script. Never does extraction work inline; its context belongs to the operator.

**Orchestrator** — one background sub-agent. Renders pages, fans out the survey pass, fans out the transcribe pass, runs `assemble.ts`, authors the readout.

**Workers** — one per page (survey), one per region (transcribe).

**Model discipline** (D9). Every spawn names its model explicitly; an unspecified spawn inherits the parent's, which may be Fable. **Opus** for both vision passes — reading a survey call is judgment work, and the failure mode here is confident misreading. **Sonnet** for render/crop mechanics. Never Haiku or Fable.

---

## 3. The pipeline

```
INPUT: cartographer_files.id  (or a file_name that resolves to exactly one row)
   │
 0 │ KICKOFF (top-level runner)
   │   resolve the row · mkdir the run dir · ADDENDUM.md
   │   scripts/fetch.ts   — signed URL → source.pdf
   │   scripts/render.ts  — pdftoppm every page to JPEG
   ↓
 1 │ SURVEY PASS  (vision · Opus · one worker per page)
   │   Which pages carry geometry? What KIND — metes_and_bounds | coordinate_table
   │   | curve_table | none? WHERE on the page (normalized bbox regions)?
   │   Emits regions. Emits NO values.
   ↓
 2 │ TRANSCRIBE PASS  (vision · Opus · one worker per region)
   │   magick-cropped high-DPI tile of that region only. Per course, emits:
   │     · verbatim  — the call exactly as printed
   │     · structured — {quadrant, degrees, minutes, seconds} + distance
   ↓
 3 │ ASSEMBLE  (scripts/assemble.ts · ZERO LLM)
   │   parseMete → runTraverse → traverseMisclosure → shoelace area
   │   formatBearing re-renders each course and diffs it against `verbatim`
   │   raw-artifact.json → artifact.json
   ↓
 4 │ HITL READOUT ⛔  (top-level runner)
   │   figures · misclosure each · area vs stated · verbatim diff · gap ledger
   │   ruling: publish | re-read <regions> | stop
   ↓
 5 │ PUBLISH  (scripts/publish.ts, on the explicit go)
   │   delete prior rows for this file_id, insert the new ones,
   │   flip cartographer_files.status → 'processed'
```

**The honesty boundary (D-core).** The agent only ever *transcribes*. It never computes a coordinate, never closes a figure, never decides an area. Every number that reaches the database comes out of `src/lib/geometry`. A misread bearing therefore surfaces as a visibly wrong shape or a large misclosure, rather than as a plausible number nobody can audit.

**The verbatim diff.** Each course carries both what was printed and what the model decomposed it into. `formatBearing` re-renders the structure; assemble diffs the two strings. A silent digit swap in the decomposition (`53'40"` → `53'04"`) shows up as a mismatch without a human re-reading the plat. This is free and is the single cheapest quality gate in the run.

---

## 4. Contracts

### 4.1 Run directory (D7)

```
~/noetic/working/cartographer-geometry/<file-slug>/
  ADDENDUM.md              # file id, file name, page count, storage path, operator scope note
  source.pdf
  pages/page-<n>.jpg       # pdftoppm output
  crops/<region-id>.jpg    # magick crops, high DPI
  survey/page-<n>.json     # phase 1 output
  transcribe/<region>.json # phase 2 output
  raw-artifact.json        # assembled by the orchestrator, pre-derivation
  artifact.json            # + derived geometry — the only file publish.ts reads
  hitl/readout.md · hitl/decision.md
  tool-bugs.md
```

Same properties as preprocessing-v3's folder contract: it is the API between phases, the resume mechanism (a fresh session picks the run up from the folder alone), and the audit surface.

### 4.2 `artifact.json`

```jsonc
{
  "runSlug": "car-wash-2024178771-1",
  "file": { "id": "bebccffa-…", "fileName": "car-wash-sir-easments-2024178771.pdf", "pageCount": 2 },
  "pages": [ { "page": 1, "kinds": ["metes_and_bounds"], "regions": [ { "id": "p1-r1", "bbox": [0.1,0.2,0.6,0.5] } ] } ],
  "figures": [
    {
      "id": "figure-1",
      "label": "Lot 1",                      // as the plat names it
      "kind": "parcel",                       // parcel | easement | right_of_way | unknown
      "sourcePages": [1],
      "courses": [
        {
          "verbatim": "N 03°53'40\" E  249.10'",
          "bearing": { "quadrant": "NE", "degrees": 3, "minutes": 53, "seconds": 40 },
          "distance": 249.10,
          "isChord": false                    // true = an arc approximated by its chord (D2)
        }
      ],
      "statedAreaSqft": 43560,                 // null when the plat doesn't print one
      "notes": "…"
    }
  ],
  "derived": {                                 // written by assemble.ts, never by an agent
    "figure-1": {
      "polygon": { "srid": 0, "units": "feet", "rings": [[{ "x": 0, "y": 0 }]] },
      "closed": false,
      "misclosureFeet": 1.83,
      "computedAreaSqft": 43122.7,
      "verbatimMismatches": []
    }
  }
}
```

### 4.3 Validation — reported, never blocking (D4)

Three checks, all run by `assemble.ts`, all surfaced in the readout, **none of which stop a publish**:

1. **Misclosure** — `traverseMisclosure`, in feet. A figure that doesn't return to its POB is published as an open figure and drawn as an open polyline (`Shape.open`, already supported by `SvgCanvas`).
2. **Area** — shoelace vs the plat's stated acreage where one is printed.
3. **Verbatim diff** — `formatBearing` output vs the transcribed string.

Publishing an honest bad shape teaches more than blocking the run: the misclosure is stored and shown, so a bad read is visible in the UI rather than absent from it. Blocking thresholds are a v2 policy question once there's a corpus.

---

## 5. Data model

One migration in substation's repo (same ledger reasoning as winston#265 D9).

```sql
create table public.cartographer_geometries (
  id                      uuid primary key default gen_random_uuid(),
  file_id                 uuid not null references public.cartographer_files(id) on delete cascade,
  run_slug                text not null,
  label                   text not null,
  kind                    text not null default 'figure',
  source_pages            int[] not null default '{}',
  mete                    jsonb not null,   -- { courses: [...] } — re-walkable by the app
  polygon                 jsonb not null,   -- { srid: 0, units: 'feet', rings: [...] }
  closed                  boolean not null,
  misclosure_feet         double precision,
  computed_area_sqft      double precision,
  stated_area_sqft        double precision,
  has_approximated_curves boolean not null default false,
  notes                   text,
  created_at              timestamptz not null default now()
);
create index cartographer_geometries_file_id_idx on public.cartographer_geometries (file_id);
alter table public.cartographer_geometries enable row level security;  -- zero policies: service-role only
```

**Both `mete` and `polygon` are stored** — not redundantly. `mete` is the *source description* (what the plat says); `polygon` is the *derived drawing* (what the math produced). Keeping the mete means a later fix to the traverse engine can re-derive every stored figure without re-reading a single PDF.

**No run registry** (D5). preprocessing-v3's `site_plan_preprocessing_run` gives an undo stack; that's real value and too much machinery for this. Instead `publish.ts` deletes prior rows for the `file_id` and reinserts — last run wins. `run_slug` records provenance.

`cartographer_files.status` flips to `'processed'`; `metadata` takes `{ lastGeometryRun, figureCount }`. No migration needed — both columns were seeded for exactly this in winston#265 D8.

---

## 6. UI — Processed Files

New left-nav entry under **Files**. `/processed`:

- **Left rail** — files with at least one geometry row: thumbnail + name + figure count, selectable.
- **Main pane** — the selected file's figures rendered through the existing `SvgCanvas.svelte`, with per-figure toggles so a parcel and its easements can be viewed separately or stacked.
- Per figure: label, kind, course count, misclosure, computed vs stated area, and a chord-approximation flag where one applies.

Open figures draw as unfilled polylines (`Shape.open`) — the misclosure gap is visible, not papered over.

---

## 7. Deliberately deferred

- **Curves** (D2). Arcs are approximated by their printed chord bearing + distance, `isChord: true`, `has_approximated_curves` on the row, flagged in the readout. Real arc support means extending `Course` in the geometry library — its own PR, and it changes the traverse engine, not this runbook.
- **Anchoring** (D3). SRID:0 only. Printed State Plane coordinates are recorded in `notes` if seen, and drive nothing. Placing these figures in WGS84 is the bridge to the `geo` table, later.
- **Closure enforcement** (D4). Reported, never required.
- **Versioned runs** (D5). Republish deletes.
- **Coordinate-table primary reconstruction** — the 3089 spec's method. Worth it when anchoring lands; unnecessary while unanchored.
- **Automatic triggering.** A human runs this from a Claude Code session. No Inngest, no queue, no button in the app.

---

## 8. PR sequence

| # | Repo | Contents |
| --- | --- | --- |
| 1 | `winston` | This spec |
| 2 | `substation` | `cartographer_geometries` migration |
| 3 | `cartographer` | `runbooks/extract-geometry/` — RUNBOOK.md, prompts, scripts |
| 4 | `cartographer` | `/processed` route + nav entry |

PR 3's `scripts/assemble.ts` imports `../../src/lib/geometry` directly (D6). The coupling is the point: the alternative is a second copy of the traverse math that drifts from the one the renderer uses.

---

## 9. Open questions

- **Q1 — Region granularity in phase 1.** One region per figure, or one per printed call-out block? Per figure is simpler to assemble; per block crops tighter and reads smaller text better. Starting per figure, revisit after the first real run.
- **Q2 — Crop DPI.** The `navalbase` step-3 failure (winston#263) is precisely this: vision reading a whole page downscaled to ~44 DPI and misreading small red text. A metes-and-bounds call is small text. Starting at 300 DPI crops per the 3089 spec's worked reference; the readout should make it obvious when a call was read off too few pixels.
- **Q3 — Multi-figure attribution.** When one page carries a parcel and three easements, does the survey pass reliably separate them, or does the transcriber end up merging courses across figures? The known-good answer for this plat (from the 3089 work) makes this testable on run 1.
- **Q4 — What "label" means.** Plats name figures inconsistently ("Lot 1", "TRACT A", "15' SANITARY SEWER EASEMENT"). Taking the plat's own words verbatim; no normalization.
- **Q5 — Should `/processed` show the source crop next to each figure?** It would make a bad read self-evident. Deferred pending the first run's output.
