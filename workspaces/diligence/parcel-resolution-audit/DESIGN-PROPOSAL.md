# Design Proposal — `parcel-geo-location-resolution` skill + Phase 0 observability

**Branch:** `parcel-resolution-audit`
**Status:** Draft for brainstorm. Open for redirection.
**Companions:** `AUDIT.md` (the audit this design responds to), `research-notes.md` (file:line trace).

### Update history

- **v0.3 (current):**
  - Added a dedicated "Concept-plan preprocessing" section to Part 2. The new skill borrows the imagemagick + poppler pattern verbatim from `diligence-report/references/phase1-vision-extraction.md` — `pdftoppm` for dual-DPI rendering (300 + 600), `magick` for quadrant crops, de-skew/rotate for non-standard orientations. Scoped vision extraction (dual-extractor: Gemini 3.1 Pro + Opus 4.7) targets multi-parcel signals specifically — title-block parcel IDs, declared plat references, "abandoned interior lot lines" callouts, multi-tract labels — narrower than Phase 1's full feature inventory. Concept plans are vectorized CAD-produced PDFs often larger than 8.5×11 with fine-print labels; preprocessing is load-bearing.
  - Output layout adds `<output-dir>/concept-plan-extracted/` with dual extractions + reconciled view, for traceability and audit.
  - Phase C estimate increased from 2-3 days to 3-5 days to account for the vision-pass work.
  - Phase C dependencies clarified: `poppler-utils` and `imagemagick` must be installed and on PATH; documented in SKILL.md.
- **v0.2:**
  - Renamed the proposed skill from `location-resolution` → **`parcel-geo-location-resolution`** (more specific about what's being resolved).
  - Flipped Part 1 from caller-passes-`--log-mcp-calls`-flag to **producer-owned logging with smart path resolution** — observability is now a property of the tool, not a property of the prompt. Logging is always on unless explicitly disabled.
  - Applied the same producer-owned-logging pattern to the new skill: it always writes a JSONL log to its own output directory as part of its public output contract.
  - Codified the output-directory convention: when `diligence-report` invokes the skill, it passes `--output-dir $NOETIC_DILIGENCE_DIR/location-resolution/`. Skill outputs (the standardized `.md`, the MCP-call log, and any screenshots) all land in that subdirectory.
- **v0.1:** initial draft (see git history on this file for the prior version).

### Quick reference — terminology after rename

| Concept | Value |
|---|---|
| Skill name (and skill directory under `claude-plugins/.../skills/`) | `parcel-geo-location-resolution` |
| Output directory when invoked by `diligence-report` | `$NOETIC_DILIGENCE_DIR/location-resolution/` |
| Standardized output file | `location-resolution.md` (inside the output dir) |
| Structured MCP-call log | `location-resolution-mcp-calls.jsonl` (inside the output dir) |
| Screenshots | `site-aerial.png`, `site-cadastral.png` (inside the output dir) |
| CLI wrapper (for independent invocation) | `noetic-parcel-geo-resolve` |

The output namespace (`location-resolution/`) is deliberately shorter than the skill name; the dir + filename together (`location-resolution/location-resolution.md`) is verbose enough that we can consider shortening the file name to `resolution.md` once we're sure of the schema. Open question for the brainstorm.

---

This document proposes two coupled changes:

1. A new **`parcel-geo-location-resolution`** skill that hardens address → (parcel ID + lat/lon) resolution, handles multi-parcel sites explicitly, and produces a standardized `location-resolution.md` artifact.
2. **Phase 0 MCP tool-call observability fixes** so the audit gap in §11 of the audit (narrative summaries instead of structured logs) becomes a structured log we can validate against.

Both are aimed at one outcome: **independent validation without re-running the full pipeline**. The skill should be runnable on its own against an address (or lat/lon, or parcel ID), produce its standardized output, and feed Phase 0 of `diligence-report` as a deterministic input.

---

## Part 1 — Observability fixes (Phase 0 tool-call logging)

### Problem (recap from AUDIT §11)

`run-manifest/phase0.json` records tools at the MCP-server level with agent-authored `detail` prose. The actual MCP function calls (which function, with what args, returning what payload) live only in Claude's session transcript and are lost from the run dir. Phase 2's surveyor diligence-mode writes a clean JSONL (`research-findings.jsonl`); Phase 0 produces nothing equivalent.

### Proposed fix — `phase0/mcp-calls.jsonl`

Mirror the Phase 2 JSONL schema for Phase 0. Every MCP tool invocation in Phase 0 appends one row to `run-manifest/phase0-mcp-calls.jsonl` (or `phase0/mcp-calls.jsonl` if we move toward per-phase directories):

```jsonl
{"type":"event","kind":"tool_call","sequence_number":1,"phase":"phase0","step":"subject-location-gate",
 "source_id":"fulton-county-gis","tool_name":"fulton_assessor_search",
 "input_args":{"query":"4279 ROSWELL","searchType":"address"},
 "result_data":{"success":true,"data":{...}},
 "success":true,"duration_ms":268,"created_at":"2026-06-16T22:05:55.123Z"}
```

Schema is **byte-compatible** with the surveyor's `research-findings.jsonl`. One JSONL reader serves both. Existing `phase0.json` `tools[]` block stays for the rollup view; the new JSONL is the audit trail.

### How calls get logged — producer-owned with smart path resolution

**Principle: observability is a property of the producer, not the caller.**

If logging requires the caller to pass a flag, every new caller is a new chance to forget — and the audit gap re-emerges silently. The whole reason we have this audit is that Phase 0's caller (Claude in the skill) did the right thing for MCP calls without leaving a structured trail. We shouldn't fix that by adding a new way to forget.

So: **the surveyor MCP server logs every tool call by default. Always. Unless explicitly disabled.**

**Implementation:** the surveyor MCP server (`surveyor/src/server.ts`) wraps each tool handler with append-to-JSONL middleware. The output path is resolved at startup in this precedence order:

```
1. --log-mcp-calls <path>           ← explicit override flag (caller knows best)
2. --no-log-mcp-calls               ← explicit disable (rare; unit tests, ad-hoc queries)
3. $NOETIC_PHASE_LOG env var        ← caller-injected without flag
4. cwd looks like a diligence run   ← auto-detect:
                                      <cwd>/.surveyor-mcp-calls.jsonl
                                      ("looks like a run dir" = contains
                                       seed-site-data.md OR run-manifest/)
5. fallback                         ← ~/.local/share/noetic/surveyor-mcp-calls.jsonl
                                      (append-only, rotated at ~100 MB, never lost)
```

Logging is on unless rule 2 fires. Diligence-report's Phase 0 doesn't need to pass anything — it invokes the surveyor MCP server from the run dir and rule 4 kicks in automatically. A future skill author who's never read this audit gets observability for free.

**Why not the alternatives:**

| Rejected option | Why |
|---|---|
| Skill prompt logs after each call | Agent compliance is unreliable; defeats the purpose |
| Hook in `~/.claude/settings.json` (`PostToolUse`) | Cross-session state; only works in Claude Code, not for SDK users; hook would still need to identify the run dir |
| Caller passes `--log-mcp-calls` (the original v0.1 proposal) | Caller-cooperation is the same failure mode the audit identified. Switching to producer-owned-logging makes the audit trail a property of the tool, not a property of the prompt. |

**Trade-offs honestly:**

- Slight filesystem-write cost on every surveyor MCP invocation. Negligible (one append per call).
- The default path needs to handle weird cwd cases (someone runs the MCP server from `/`, `/tmp`, etc.). The fallback to `~/.local/share/noetic/` covers it. We never silently drop a log.
- Log rotation. The fallback path grows over time; cap at ~100 MB so it doesn't fill a disk. Standard.
- Privacy / test fixtures. If someone runs the surveyor MCP for an ad-hoc query they don't want logged, they pass `--no-log-mcp-calls`. Explicit opt-out is fine.

### Manifest schema extension

Add to `references/run-manifest.md` Phase 0 payload:

```json
"mcp_calls": {
  "log_path": "run-manifest/phase0-mcp-calls.jsonl",
  "call_count": 7,
  "tools_invoked": [
    "fulton_assessor_search", "fulton_parcel_details",
    "atlanta_property_profile", "fema_flood_lookup", ...
  ],
  "total_duration_ms": 4127
}
```

The `tools_invoked` array is a derived rollup; the JSONL is the authoritative source.

### Side effect — fixes the `customer_supplied_pin: null` defect by exposing it

The audit §11 noted that `customer_supplied_pin: null` was structurally untrue because the manifest schema has no slot for PIN identifiers (only lat/lon). With structured MCP-call logging, we don't need to fix that schema yet — the JSONL will show `fulton_assessor_search({query: "17 00950004067", searchType: "parcelId"})` *was* called, with the result data, even if the rollup field is `null`. The audit trail becomes recoverable.

A second, smaller fix can land in parallel: change `customer_supplied_pin` type from `{lat,lon}` to a tagged union:

```json
"customer_supplied_pin": {
  "kind": "lat-lon" | "parcel-id" | "google-maps-link" | null,
  "value": "17 00950004067" | {"lat": ..., "lon": ...} | "https://maps.google.com/..." | null
}
```

This unblocks structured recording of customer-supplied APNs, Google Maps share links, dropped pins, and lat/lon coords with one schema.

### Cost

- Surveyor change: ~40 LOC TypeScript (middleware wrapper around tool handlers, JSONL writer, env-var ingest)
- Skill change: ~10 lines added to Phase 0 prompts pointing at the JSONL path
- Manifest schema change: ~15 lines docs

Small. Worth doing before the next diligence run regardless of what else happens.

---

## Part 2 — The `parcel-geo-location-resolution` skill

### Why a separate skill

Three criteria for separating:

1. **Independently validatable.** Resolution can be re-run on a single address without touching the rest of the pipeline. Useful for testing, debugging, and amending a wrong parcel set on an existing run.
2. **Reusable.** Other skills (`diligence-report`, `feasibility-intake-chat`, future tools) need the same address-to-parcel resolution. A shared skill avoids duplication.
3. **Deterministic input contract.** The output is a single file (`location-resolution.md`) with a fixed schema. Downstream consumers (Phase 0 of `diligence-report`) read that file and have a deterministic seed.

These match the criteria for a **standalone skill**, not a sub-skill. A sub-skill (Skill files nested inside another skill) is fine when only the parent needs it; here we want broader reuse. Skill lives at `claude-plugins/plugins/noetic-tools/skills/parcel-geo-location-resolution/`.

Diligence-report's Phase 0 invokes `parcel-geo-location-resolution` via the standard `Skill` tool, passing `--output-dir $NOETIC_DILIGENCE_DIR/location-resolution/`, and reads back `location-resolution.md` from that directory.

### Output-directory convention

Everything the skill produces lands under a single output directory chosen by the caller:

```
<output-dir>/
├── location-resolution.md             ← the standardized artifact (what callers read)
├── location-resolution-mcp-calls.jsonl ← producer-owned MCP-call log (always written)
├── site-aerial.png                    ← Google Maps satellite screenshot (when multi-parcel detection runs)
├── site-cadastral.png                 ← jurisdiction GIS cadastral screenshot
└── concept-plan-extracted/            ← preprocessed renders + scoped vision extraction
    ├── page-{N}.png                   ← 300 DPI full-page renders (pdftoppm)
    ├── page-hires-{N}.png             ← 600 DPI full-page renders
    ├── page-hires-{N}-rotated.png     ← (if rotation needed)
    ├── crop-{NW,NE,SW,SE}.png         ← quadrant crops of the hi-res render (magick)
    ├── crop-drawing.png               ← (if drawing region isolated)
    ├── crop-titleblock.png            ← (if title-block region isolated)
    ├── gemini-3.1-pro-extraction.md   ← raw Gemini scoped extraction
    ├── opus-4.7-extraction.md         ← raw Opus scoped extraction
    └── concept-plan-data.md           ← reconciled view (STEP 4b.v reads this)
```

When invoked by `diligence-report` Phase 0, `<output-dir>` is `$NOETIC_DILIGENCE_DIR/location-resolution/`. When invoked independently from the CLI, the user supplies a path.

### Logging — producer-owned, mirrors Part 1

The skill always writes `location-resolution-mcp-calls.jsonl` to its output directory as part of its public output contract. No caller flag is needed; the skill knows where to put the log because it knows its own output directory.

Schema matches Part 1's surveyor-MCP-call JSONL (same `{type, kind, sequence_number, source_id, tool_name, input_args, result_data, success, duration_ms, created_at}` row shape). One JSONL reader serves both. Adds a `step` field so post-hoc analysis can distinguish "primary-resolution" from "adjoining-sweep" from "multi-parcel-spatial-recon" calls within a single skill run.

Disabling (rare): `--no-log-mcp-calls` opts out. There is no rule-4-style cwd fallback because the skill always has an output directory available; if no output dir is supplied the skill errors out at startup, not silently.

### Inputs — accept any one of three

The skill accepts a single primary input (any one of):

| Input | Example | Notes |
|---|---|---|
| **Address** | `4279 Roswell Rd NE, Atlanta, GA 30342` | Most common path. Skill geocodes to lat/lon and queries assessor to derive parcel ID. |
| **Lat/lon** | `33.871083, -84.379667` | Reverse-geocode to address + parcel layer point-query for parcel ID. |
| **Parcel ID** | `17 009500040675` | Direct assessor lookup; derive address + centroid. |

Optional inputs:

| Optional input | What it does |
|---|---|
| **Concept plan / site plan image** | Triggers multi-parcel detection (see §2.3 below) |
| **Customer-supplied geocode/pin** | Reconciled against authoritative coordinate (preserves the existing subject-location gate behavior) |
| **Jurisdiction hint** | Skip jurisdiction detection if the user knows the answer |

### Flow

```
INPUT (any one of: address | lat/lon | parcel ID) [+ optional concept plan image]
  ↓
STEP 1 — Jurisdiction detection
  Detect jurisdiction from the input (reusing existing prompts/jurisdiction-detection.md
  logic; geocode the address, point-in-polygon against state/county/city boundaries).
  ↓
STEP 2 — Primary parcel resolution via surveyor MCP
  Start the surveyor MCP server for <slug>. Call the appropriate tool based on input type:
    - Address → <jur>_assessor_search(query=address, searchType=address)
    - Lat/lon  → <jur>_parcel_details_by_point(lon, lat)  (or polygon point-query)
    - Parcel  → <jur>_parcel_details(parcelId)
  Get back: primary ParcelID + WGS84 centroid + assessor record.
  ↓
STEP 3 — Customer-supplied input reconciliation
  If the user supplied any of address+lat/lon+parcel, reconcile each pairwise against
  the authoritative resolution. STOP and surface to user if any disagree materially
  (existing subject-location-gate behavior).
  ↓
STEP 4 — Multi-parcel detection (THE NEW LOAD-BEARING STEP)
  Goal: identify whether the project's scope extends beyond the primary parcel.

  4a. Always perform: adjoining-parcels GIS sweep.
      Buffer the primary parcel polygon by ~50 ft and query the parcel layer for any
      polygon intersecting the buffer. For each adjoining parcel, capture:
        - ParcelID
        - Owner name
        - Acreage
        - Land use code
      Flag any adjoining parcel that shares:
        - Owner name with primary (likely assemblage)
        - Subdivision name with primary (potentially related)
        - Use code with primary (suggestive)

  4b. If a concept-plan / site-plan image is provided, perform multi-source spatial
      reconciliation (modeled on references/spatial-grounding.md). Concept plans
      are vectorized CAD-produced PDFs, often larger than 8.5x11 inches, often
      rotated, often with the title-block scale + drawn boundary at small
      typographic sizes. Naive vision-pass against the raw PDF page renders at
      150 DPI loses too much. We need to preprocess.

        i.   PREPROCESS the concept plan PDF (imagemagick + poppler — same pattern
             as diligence-report Phase 1 vision). See the "Concept-plan
             preprocessing" section below for the full command set.
               - Render each page at 300 DPI (normal pass) AND 600 DPI (hi-res).
               - If the page is rotated (title block on the side, north arrow not
                 pointing up), de-skew or rotate before any vision pass.
               - Crop the high-DPI render into quadrants (NE / NW / SE / SW), the
                 isolated drawing area, and the isolated tables/title-block area.
                 This reduces per-call pixel attention budget and raises measurement
                 precision.
               - Save everything to <output-dir>/concept-plan-extracted/.

        ii.  SCOPED vision extraction on the preprocessed renders. The goal is
             narrower than diligence-report Phase 1 — we are looking for evidence
             of multi-parcel scope, not full site facts. Extract:
               - Title block: declared parcel ID(s) (singular or plural — many
                 plans list all parcels in the assemblage), plat reference, total
                 site area (the "9.60 ac" the engineer drew against), scale
               - Drawn property boundary: where the engineer's line work says the
                 site begins and ends
               - Building footprints + their locations relative to the drawn
                 boundary
               - Any labels suggesting multiple lots: "Lot A / Lot B", "Parcel 1
                 / Parcel 2", "Tract A", subdivision-and-lot references, recorded
                 plat callouts, or notes like "see plat of <subdivision> for lot
                 lines"
               - Any callouts about lot lines being abandoned / dissolved /
                 vacated (a concept plan that says "ALL INTERIOR LOT LINES TO BE
                 ABANDONED" is a smoking gun for assemblage)
             Use Gemini 3.1 Pro and Opus 4.7 in parallel, same dual-extractor
             pattern as Phase 1; flag disagreements rather than silently picking.
             Save the two extractions + the reconciled view to
             <output-dir>/concept-plan-extracted/.

        iii. Capture a north-up Google Maps satellite screenshot via agent-browser,
             centered on the primary centroid, at a zoom where the parcel and
             immediately-adjacent properties are visible. Save to
             <output-dir>/site-aerial.png.

        iv.  Capture a screenshot of the assessor's PropertyMapViewer (or
             equivalent jurisdiction GIS viewer) at the same coordinate, with the
             parcel layer visible. This shows the cadastral lot lines. Save to
             <output-dir>/site-cadastral.png.

        v.   THREE-WAY comparison: the preprocessed concept-plan extraction
             + the cadastral screenshot + the aerial. Check:
               - Does the concept plan's drawn extent fit inside the primary
                 parcel polygon? (Geometric containment.)
               - Do the concept plan's labeled site features (parking, buildings,
                 driveways) all land inside the primary parcel, or do some extend
                 over adjoining lots per the cadastral?
               - Does the concept plan declare a parcel ID (or multiple) that
                 differ from the one resolved in STEP 2?
               - Does the title-block total-area match the assessor's LandAcres
                 within the 15% block threshold?
               - Are there any labeled buildings on the concept plan that sit on
                 *different* lots per the cadastral screenshot?
               - Does the concept plan callout "interior lot lines to be
                 abandoned" or equivalent assemblage language?

        vi.  If any check suggests assemblage:
               - Identify the lat/lon of each suspected additional parcel by
                 sampling points inside their footprints on Google Maps. Use
                 agent-browser to click-and-read coordinates, or compute from
                 the basemap's known scale.
               - Call <jur>_parcel_details_by_point(lon, lat) for each sampled
                 point to retrieve the additional parcel ID.
               - Add to the resolved parcel set.

  4c. If no concept-plan image is provided, perform a lightweight check anyway:
      compare the primary parcel polygon's acreage against any user-provided
      hint about site size. If material disagreement (>15% delta), surface a
      warning to the user without blocking.
  ↓
STEP 5 — Write location-resolution.md to <output-dir>
  Produce the standardized output (schema below).
  ↓
STEP 6 — Tool-call log is already written
  location-resolution-mcp-calls.jsonl was appended in real time as the skill ran;
  no separate write step. Producer-owned, always on (see "Logging" above).
```

### Multi-source spatial reconciliation — borrowing from spatial-grounding

The `references/spatial-grounding.md` reference (commit 9c65028) gives the pattern. Adapt the rules for parcel set detection:

| Source | Authoritative for |
|---|---|
| **Assessor parcel polygon (GIS)** | Parcel **boundary geometry** — the legal lot lines |
| **Google Maps satellite imagery** | **Visible occupancy** — what's actually on the ground |
| **Concept plan / site plan** | **Project scope** — what the developer plans to touch |

Reconciliation rules:

| Disagreement | Resolution |
|---|---|
| Concept-plan footprint extends past primary parcel polygon | Likely assemblage. Sample extension area on Google Maps → identify adjoining parcel(s) → add to resolved set |
| Concept-plan acreage > primary parcel acreage by >15% | Likely assemblage. Same investigation. |
| Adjoining parcel shares owner name | Likely assemblage. Add to resolved set with `confidence: high`. |
| Adjoining parcel shares only subdivision name | Possibly assemblage. Add to candidate set with `confidence: medium`. Surface to user. |
| Google Maps shows buildings on adjoining lots that look part of the same property (same brand, no fence, no driveway separation) | Possibly assemblage. Add to candidate set with `confidence: medium`. Surface to user. |

**Block condition:** if the concept plan's drawn extent is materially larger than the resolved parcel set's combined acreage (>15% delta), **STOP** and surface to user. This is the analog of spatial-grounding's hard-cardinal-flip block.

### Concept-plan preprocessing (imagemagick + poppler)

Borrowed directly from `diligence-report/references/phase1-vision-extraction.md` and `prompts/phase1-vision.md`. The pattern is proven; the new skill should use it verbatim with light adaptation to its narrower scope.

**Why preprocessing matters.** Concept plans are vectorized PDFs produced in CAD (Civil 3D, AutoCAD, MicroStation). They are typically:
- Larger than 8.5×11 (24×36, 30×42, or full ANSI E at 34×44 inches are common)
- Sometimes rotated (title block on the side or bottom)
- Dense with fine-print text (dim strings, parcel labels, notes, scale bars) that loses legibility under naive 150-DPI rendering
- Drawn with thin line work that aliases badly at low DPI

A vision-pass that just dumps the raw PDF to the model misses the title-block parcel IDs, the abandoned-interior-lot-lines callout, the small "Lot A / Lot B" labels — exactly the signals we need for multi-parcel detection.

**Tooling.** `poppler-utils` (provides `pdftoppm`) for rasterizing, `imagemagick` (provides `magick`) for cropping and de-skewing.

**Commands (per supplied concept-plan PDF):**

```bash
OUT="${OUTPUT_DIR}/concept-plan-extracted"
mkdir -p "$OUT"

# Normal-pass render: 300 DPI per page → used for overview + title-block reading
pdftoppm -r 300 -png "${CONCEPT_PLAN_PDF}" "$OUT/page"

# Hi-res render: 600 DPI per page → used for fine-print labels, dim strings, scale bar
pdftoppm -r 600 -png "${CONCEPT_PLAN_PDF}" "$OUT/page-hires"

# De-skew / rotate if needed (the agent decides after viewing the normal render)
magick "$OUT/page-hires-1.png" -deskew 40% "$OUT/page-hires-1-deskewed.png"
# OR for a known fixed rotation (title block was on the left side):
magick "$OUT/page-hires-1.png" -rotate 90 "$OUT/page-hires-1-rotated.png"

# Quadrant crops of the hi-res render → raises per-call vision precision
magick "$OUT/page-hires-1.png" -crop 50%x50%+0+0     "$OUT/crop-NW.png"
magick "$OUT/page-hires-1.png" -crop 50%x50%+50%+0   "$OUT/crop-NE.png"
magick "$OUT/page-hires-1.png" -crop 50%x50%+0+50%   "$OUT/crop-SW.png"
magick "$OUT/page-hires-1.png" -crop 50%x50%+50%+50% "$OUT/crop-SE.png"

# Optional: isolate the drawing area + the tables/title-block area as separate crops
# The agent identifies the regions from the normal render before issuing these.
magick "$OUT/page-hires-1.png" -crop <WxH+x+y> "$OUT/crop-drawing.png"
magick "$OUT/page-hires-1.png" -crop <WxH+x+y> "$OUT/crop-titleblock.png"
```

**Why dual-DPI:** 300 DPI is enough for the agent to read overall layout, identify the title block, and locate features. 600 DPI is needed when the agent wants to read a 4-pt dimension string or a tightly-packed lot-line callout. The two are complementary; both are kept.

**Why quadrant crops:** vision models attend to pixels in proportion to the call's image budget. A 30×42 page rendered at 600 DPI is 18,000×25,200 pixels (~450 MP) — way over the per-call budget. Quadranting yields four ~112 MP images, each of which fits within typical vision-call budgets at far higher effective resolution than the original full-page render.

**De-skew / rotate.** If the agent sees from the normal render that the title block is on a side rather than the top, OR the north arrow doesn't point up, OR the drawing is skewed (uncommon but happens on scanned PDFs), apply the appropriate `magick -rotate` or `magick -deskew` before the hi-res / quadrant pass. The orientation that ends up feeding the vision model should always be north-up with the title block at the bottom (or wherever the engineer's standard places it).

**Output directory layout** under `<output-dir>/concept-plan-extracted/`:

```
concept-plan-extracted/
├── page-1.png                              ← 300 DPI full-page render
├── page-2.png                              ← (if multi-page)
├── page-hires-1.png                        ← 600 DPI full-page render
├── page-hires-1-rotated.png                ← (if rotation needed)
├── crop-NW.png  crop-NE.png
├── crop-SW.png  crop-SE.png
├── crop-drawing.png                        ← (if drawing region isolated)
├── crop-titleblock.png                     ← (if title-block region isolated)
├── gemini-3.1-pro-extraction.md            ← raw Gemini extraction (audit trail)
├── opus-4.7-extraction.md                  ← raw Opus extraction (audit trail)
└── concept-plan-data.md                    ← reconciled view (what STEP 4b.v reads)
```

**Scoped extraction targets** for the location-resolution use case (narrower than Phase 1's full feature inventory):

```
Title block:
  - Project name
  - Declared parcel ID(s) (capture all of them — if the title block lists
    multiple, that is itself a signal)
  - Recorded-plat reference (subdivision name + volume/page or book/page)
  - Total site area (the engineer's "as drawn" acreage / SF)
  - Scale declaration ("1\" = 20'", etc.)
  - Owner of record
  - Engineer + design firm + date

Drawn boundary:
  - Where the line work delineates the site
  - Whether the boundary is one closed polygon or multiple polygons
  - Any "abandoned lot line" / "vacated easement" callouts inside the boundary

Building footprints:
  - Each building's approximate corners (for later cadastral overlay)
  - Whether buildings are labeled by lot ("Building A on Lot 1" etc.)

Multi-parcel signals:
  - Subdivision callouts ("Lot 1 Block A of <subdivision>; Lot 2 Block A ...")
  - "Parcel 1 / Parcel 2 / Parcel 3" labels anywhere on the plan
  - "Tract A" / "Tract B" labels
  - "Interior lot lines to be abandoned"
  - "Plat amendment to combine parcels"
  - Multiple plat references in the title block
  - References to a unified development plan / replat / lot consolidation
```

**Dual-extractor reconciliation.** Same as Phase 1 vision: run both Gemini 3.1 Pro and Opus 4.7 against the same image set, save both raw extractions, reconcile in `concept-plan-data.md`. Disagreements on a parcel-ID label get a `// DISAGREEMENT` flag and human verification rather than silent pick.

**Relationship to diligence-report's Phase 1 vision.**

This skill performs a scoped vision pass focused on multi-parcel detection. Diligence-report's Phase 1 then runs the full vision extraction (every measurement, every easement, every callout, etc.) against the same PDF after location-resolution has finished. Two vision passes happen on the same concept plan — *intentional duplication* because:

- Location-resolution must run BEFORE Phase 1 to produce the correct parcel set that Phase 1 (and Phase 2/3) keys off
- The two passes have genuinely different scopes
- Both produce structured outputs for traceability and cross-check
- The scoped pass is cheaper than the full pass and runs in the more time-sensitive Phase 0 slot

If the duplication becomes costly, a future refactor can factor the preprocessing into a shared reference (`diligence-report/references/concept-plan-preprocessing.md` ← both skills depend on this) and let the two extractions co-locate their pixel work. Defer to v2.

### Standardized output — `location-resolution.md`

```markdown
# Location Resolution — <Address>

**Resolved at:** <ISO timestamp>
**Skill version:** parcel-geo-location-resolution v1.0
**Output directory:** `<output-dir>/` (companion files: `location-resolution-mcp-calls.jsonl`, `site-aerial.png`, `site-cadastral.png`)

## Confirmed Subject Location (single source of truth)

**Address:** 4279 Roswell Rd NE, Atlanta, GA 30342
**Lat/Lon (WGS84):** 33.871083, -84.379667
**Primary Parcel ID:** 17 009500040675 (Fulton County canonical 14-digit)
**Jurisdiction:** City of Atlanta, Fulton County, Georgia (in-city-limits)

## Parcel Set

| Parcel ID | Acreage | Owner | Use code | Confidence | Source |
|---|---|---|---|---|---|
| 17 009500040675 | 7.38 ac | IRT PROPERTY COMPANY | 343 | **primary** | Fulton assessor address-search |
| 17 009500040680 | 1.45 ac | IRT PROPERTY COMPANY | 343 | high | Adjoining-parcels sweep; shared owner |
| 17 009500040685 | 0.75 ac | CHASTAIN SQUARE LLC | 343 | medium | Concept-plan footprint extends here; sampled on Google Maps |

**Total resolved acreage:** 9.58 ac (3 parcels)
**Concept-plan drawn acreage:** 9.60 ac
**Reconciliation:** confirmed — total resolved (9.58 ac) within 0.5% of drawn (9.60 ac)

## Customer-Supplied Inputs

| Input | Value | Reconciliation |
|---|---|---|
| Address | 4279 Roswell Rd NE, Atlanta, GA 30342 | confirmed (assessor address-search returned primary parcel) |
| Parcel ID | 17 00950004067 (13-digit) | confirmed as LOWPARCELI alias of canonical 14-digit primary |
| Lat/lon pin | (none) | n/a |
| Concept plan | inputs/concept-plan.pdf | drawn extent reconciled against parcel set (see above) |

## Methodology

1. **Jurisdiction detection.** Geocoded address → Fulton County, City of Atlanta (in-city-limits) via <tool>.
2. **Primary parcel resolution.** Called `fulton_assessor_search({query: "4279 ROSWELL", searchType: "address"})` → returned ParcelID 17 009500040675. Followed by `fulton_parcel_details({parcelId: "17 009500040675"})` for full polygon + centroid.
3. **Customer-pin reconciliation.** Customer-supplied 13-digit PIN `17 00950004067` reconciled as LOWPARCELI alias of canonical 14-digit `17 009500040675` (verified via `atlanta_property_profile` SAP record SAP-12-030 which carries both forms).
4. **Adjoining-parcels sweep.** Buffered primary polygon by 50 ft, queried Fulton parcel layer for intersecting polygons → 4 adjoining parcels. Two shared owner name with primary (IRT PROPERTY COMPANY) → flagged as high-confidence assemblage candidates.
5. **Multi-source spatial reconciliation.** Concept-plan footprint compared against primary parcel polygon via Google Maps screenshot + Fulton PropertyMapViewer cadastral screenshot. Concept-plan southwest extent visibly crossed the primary parcel's south boundary into an adjoining lot. Sampled coordinate inside the extension; called `fulton_parcel_details_by_point(lon: -84.3795, lat: 33.8702)` → returned ParcelID 17 009500040685.
6. **Reconciliation.** Total resolved acreage 9.58 ac vs concept-plan drawn 9.60 ac → 0.5% delta, well inside the 15% block threshold. Resolution confirmed.

## Assumptions

- The Fulton County PropertyMapViewer parcel layer (layer 11) is current as of query time. Re-verify at title commitment.
- The 50-ft buffer for adjoining-parcels sweep is the default. Larger assemblages may have non-contiguous parcels — those would require a different detection strategy.
- The shared-owner heuristic uses exact-string match on the assessor's `Owner` field. Owner name aliases (e.g. "IRT Property Co" vs "IRT PROPERTY COMPANY") may produce false negatives.
- The concept-plan footprint comparison was performed by visual inspection of the rendered plan against the cadastral screenshot, not by geometric overlay. A geometric overlay would require georeferencing the concept plan PDF.

## Tool-Call Log

Full structured log: `./location-resolution-mcp-calls.jsonl` (relative to this file's output directory). 8 calls, total 3.2 seconds.

## Open Questions for the User

(None in this run. If multi-parcel detection found medium-confidence candidates, they'd be listed here for confirmation.)
```

This file then feeds into Phase 0 of `diligence-report`. Phase 0 reads `location-resolution.md` and writes `seed-site-data.md` keyed off the **already-resolved parcel set** — no more "single parcel asserted parenthetically" defect.

### Integration with diligence-report Phase 0

Update `pipeline.md` Phase 0:

```diff
 ## Phase 0 — Jurisdiction & feasibility-guide bootstrap

 **Goal:** identify the jurisdiction, confirm we have feasibility-guides for it; generate them if not.

 1. **Emit start stub** — write `run-manifest/phase0.json` with `status: "in_progress"` ...
 2. Parse parcel(s) and intended use from user input
-3. Identify jurisdiction:
+3. **Resolve location** — invoke the `parcel-geo-location-resolution` skill with the user's
+   input (address / lat-lon / parcel ID) and any concept-plan image. Read the
+   resulting `location-resolution.md` as the canonical parcel set + coordinate.
+   The skill produces:
+   - Confirmed address, lat/lon, primary parcel ID, **and any additional parcels
+     in scope**
+   - Methodology + assumptions block
+   - Customer-pin reconciliation result
+   - A structured MCP-call log
+   If the skill stopped for human confirmation (multi-parcel ambiguity, concept
+   vs polygon delta, customer-pin mismatch), pause Phase 0 until resolved.
+4. Identify jurisdiction (now informed by location-resolution.md's jurisdiction):
    - Extract from concept plan title block if present
-   - Otherwise geocode the address → city/ETJ/county
+   - Cross-check against location-resolution.md
    - Cross-check against `surveyor/jurisdictions/<slug>.md` for a slug match
-4. **Subject-location confirmation gate (MANDATORY — do not skip).** ...
+5. **Subject-location confirmation gate** — now largely satisfied by
+   location-resolution.md. This phase is reduced to: verify the
+   location-resolution.md output is well-formed and persist the canonical
+   single-source-of-truth lines into seed-site-data.md.
 5. Check `$NOETIC_BUREAU_DIR/jurisdictions/<bureau-slug>/feasibility-guides/` ...
 6. Write `seed-site-data.md` ...
```

The existing `subject-location-gate.md` shrinks: its parcel-resolution and customer-pin reconciliation steps move to the new skill. What stays in `subject-location-gate.md` is the persistence-into-seed-site-data step and the gate's role as a Phase 0 contract checker.

### What goes in seed-site-data.md after this change

```markdown
## Subject Location (CONFIRMED — single source of truth)

Subject location confirmed: 33.871083,-84.379667, parcels [17 009500040675 (primary), 17 009500040680, 17 009500040685], City of Atlanta (in-city-limits)

- **Authoritative source:** location-resolution.md (see methodology there)
- **Total resolved acreage:** 9.58 ac across 3 parcels
- **Customer-pin reconciliation:** confirmed as LOWPARCELI alias of canonical primary

## Canonical Parcel IDs

- 17 009500040675 — Chastain Square anchor parcel (primary)
- 17 009500040680 — adjoining parcel, shared owner IRT PROPERTY COMPANY
- 17 009500040685 — adjoining parcel, CHASTAIN SQUARE LLC, concept-plan extension
```

Three bullets now; the surveyor's `parcels.ts` regex sees three multi-token PINs and (after the regex fix in `audit/multi-agent-audit-summary.md` B1) processes them all correctly.

### Validating without re-running the full pipeline

The whole point of separation. Validation workflows:

- **Run `parcel-geo-location-resolution` against a known address with a known parcel set; assert the output matches.** Smoke test for the skill itself.
- **Run `parcel-geo-location-resolution` against an address with a known assemblage (Chastain Square); assert it finds all 3 parcels.** Regression test.
- **Run `parcel-geo-location-resolution` with an intentionally-wrong customer-supplied lat/lon; assert the skill stops at the reconciliation gate.** Safety test.
- **Run `parcel-geo-location-resolution` against an existing `diligence-report` run's input; compare the produced `location-resolution.md` to the run's seed-site-data.md.** Re-validation of an existing run without re-running it. *This is the workflow that would have caught the Chastain Square 3-parcel issue post-hoc.*

A simple CLI wrapper:

```bash
$ noetic-parcel-geo-resolve \
    --address "4279 Roswell Rd NE, Atlanta, GA 30342" \
    --concept-plan inputs/chastain-square-cp15.pdf \
    --output-dir /tmp/test-resolution/

# Produces:
#   /tmp/test-resolution/location-resolution.md
#   /tmp/test-resolution/location-resolution-mcp-calls.jsonl
#   /tmp/test-resolution/site-aerial.png
#   /tmp/test-resolution/site-cadastral.png
```

When invoked from `diligence-report` Phase 0, the same skill is called with `--output-dir $NOETIC_DILIGENCE_DIR/location-resolution/`.

### Open design questions

**Resolved in v0.2** (no longer open):

- ~~Standalone skill vs sub-skill~~ → standalone, at `claude-plugins/plugins/noetic-tools/skills/parcel-geo-location-resolution/`.
- ~~Caller flag vs producer-owned logging~~ → producer-owned with smart path resolution (Part 1) for the surveyor; skill writes its own log to its output directory (Part 2).
- ~~Output directory convention when invoked by diligence-report~~ → `$NOETIC_DILIGENCE_DIR/location-resolution/`; everything the skill produces lands inside.
- ~~Skill name~~ → `parcel-geo-location-resolution`.

**Still open:**

1. **Multi-parcel detection block threshold — what's the right delta?** Currently proposed 15% acreage delta. Spatial-grounding uses ±25% for trigger margins. Tunable per jurisdiction.
2. **How aggressive should the adjoining-parcels sweep be?** 50-ft buffer is generous for contiguous assemblages; non-contiguous (e.g. two parcels separated by a third-party lot) needs a different strategy. Defer to v2.
3. **Owner-name normalization for the shared-owner heuristic.** Exact-string match is brittle. Levenshtein? LLM check? Defer to v2.
4. **What if the jurisdiction has no surveyor config?** The skill falls back to `agent-browser` against the county appraisal district + GIS viewer, same as today's `subject-location-gate.md:30-33`. Worth keeping that capability inside the new skill.
5. **Concept plan georeferencing.** Phase 1 vision extracts the title-block area number; could we go further and georeference the concept plan PDF for a true geometric overlay check? Probably v2.
6. **Should the skill be auto-invoked by diligence-report Phase 0, or run manually first?** Recommendation: auto-invoke. The CLI wrapper exists for testing and post-hoc validation.
7. **Output file name inside `location-resolution/`.** Currently `location-resolution.md` (dir-name + file-name redundant). Considered: `resolution.md`, `output.md`, `subject.md`. Defer to v2 — schema matters more than file name.

---

## Part 3 — Implementation phasing

Rough sequencing if we move on this:

### Phase A — observability foundation (1-2 days, no behavioral change)

- Add producer-owned MCP-call logging to surveyor `src/server.ts` (middleware wrapper, smart-path resolver per the rules in Part 1, `--log-mcp-calls` override + `--no-log-mcp-calls` opt-out)
- Update `references/run-manifest.md` schema for `phase0.mcp_calls` block (derived rollup pointing at the JSONL the surveyor now writes by default)
- Tagged-union schema for `customer_supplied_pin`

No Phase 0 prompt changes needed — surveyor logs by default; rule-4 cwd auto-detection writes the JSONL into the run dir.

This stands alone. Lands the audit trail before any behavior changes.

### Phase B — `parcel-geo-location-resolution` skill v1, single-parcel path (2-3 days)

- Create `claude-plugins/plugins/noetic-tools/skills/parcel-geo-location-resolution/`
- SKILL.md, pipeline.md (analog of diligence-report's), references/
- Accept all three input types (address / lat-lon / parcel ID); produce `location-resolution.md` plus the producer-owned `location-resolution-mcp-calls.jsonl`, both inside the caller-supplied `--output-dir`
- Single-parcel path only; multi-parcel detection deferred to Phase C
- CLI wrapper (`noetic-parcel-geo-resolve`) for independent invocation
- Integration test against 3 known addresses (Atlanta, Austin, Round Rock for jurisdiction breadth)

At this point: Phase 0 of diligence-report can invoke the new skill instead of doing the work inline (with `--output-dir $NOETIC_DILIGENCE_DIR/location-resolution/`), but behavior is identical to today (just better-tested and better-logged).

### Phase C — multi-parcel detection (3-5 days)

- Add Step 4a (adjoining-parcels sweep) — pure GIS work, no agent-browser
- Add Step 4b concept-plan preprocessing (imagemagick + poppler — borrow Phase 1 vision pattern verbatim; output to `<output-dir>/concept-plan-extracted/`)
- Add Step 4b scoped vision extraction (dual-extractor Gemini 3.1 Pro + Opus 4.7, narrower target set than Phase 1)
- Add Step 4b three-way comparison (concept-plan extraction + Google Maps aerial + cadastral GIS screenshot) — agent-browser captures saved to `<output-dir>/site-aerial.png` and `<output-dir>/site-cadastral.png`
- Add Step 4b assemblage detection via point-sampling on Google Maps
- Update `location-resolution.md` schema to support N parcels
- Update diligence-report's `seed-site-data.md` template + downstream consumers (this is the bigger downstream change — see audit §5 on per-acre calcs, restrictive-covenants discipline, etc.)
- **Dependencies:** the runtime must have `poppler-utils` (`pdftoppm`) and `imagemagick` (`magick`) installed and on PATH. Confirm in skill SKILL.md and document the apt/brew install commands.
- Smoke test against Chastain Square (Atlanta) — must find all 3 parcels

### Phase D — Validation harness (1 day)

- The `noetic-parcel-geo-resolve` CLI
- A `validate-against-run` mode that takes an existing diligence run dir and produces a diff between its `seed-site-data.md` and a fresh `location-resolution.md`
- Integrate into the `audit-diligence-run` skill

### Phase E — Surveyor regex fix + downstream cleanup (already filed as B1 in multi-agent audit)

Independent of the new skill but should land in the same window — the regex fix is what allows the 3-parcel seed produced by `parcel-geo-location-resolution` to actually flow through the surveyor's gate without crashing.

---

## Part 4 — What this doesn't fix (acknowledged)

- **Discipline-level multi-parcel reasoning.** Even with the correct parcel set, the 10 disciplines treat "the parcel" as singular. Per-acre calcs (eptp tree cap, sde 35% redevelopment threshold, etc.) still need to be re-keyed to the assemblage acreage. The location-resolution skill produces the correct input; the disciplines still need to learn to use it.
- **Restrictive-covenants disambiguation.** The discipline's "burdens this parcel?" logic (audit §5.R4) still excludes encumbrances on parcels 2/3 from the burdens list. With the correct parcel set, the prompt logic at least gets *applied* against all three parcels — but the prompts themselves may need updating to handle multi-parcel REA / shared-easement scenarios.
- **Phase 1 vision area-discrepancy check elevation.** The audit §5.R3 finding that "data-gap ≠ STOP" persists. Even with a correct parcel set, if the concept plan still disagrees with the assemblage acreage, we want that to STOP (or at least flag harder than Bucket C).

These are follow-on items for the brainstorm to enumerate, not blockers for the location-resolution skill itself.

---

## Part 5 — Asks for the brainstorm

**Resolved in v0.2:**

- ~~Standalone skill vs sub-skill~~ → standalone.
- ~~Caller flag vs producer-owned logging~~ → producer-owned.
- ~~Skill name~~ → `parcel-geo-location-resolution`.
- ~~Output directory~~ → `$NOETIC_DILIGENCE_DIR/location-resolution/` when invoked by diligence-report.

**Still open:**

1. **Multi-parcel detection threshold** — 15% acreage delta as the block condition; confirm or tune.
2. **Phasing order** — does A → B → C → D → E land in the right order, or should observability + regex fix (A+E) land first to stop the bleeding?
3. **Owner-name normalization** — defer to v2, or land in v1?
4. **Concept-plan georeferencing** — defer to v2, or worth investigating now?
5. **Scope of post-hoc validation** — should the skill be able to *amend* an existing run (write a new seed, re-run only affected phases), or only validate? Recommend validate-only in v1; amend in v2.
6. **Output file name inside `location-resolution/`** — keep `location-resolution.md` (dir-name + file-name redundant), or shorten to `resolution.md` / `output.md` / `subject.md`?
7. **Vision pass duplication with Phase 1** — keep two independent vision passes on the concept plan (one scoped in this skill, one full in Phase 1), or factor the preprocessing into a shared reference and let both skills co-locate pixel work? Recommend: keep separate for v1; revisit once both are stable.

---

**End of design proposal.**
