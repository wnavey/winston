# Ingesting Supporting-Document Geometry (recorded plats → `geo` table)

**Status:** Draft v1
**Date:** 2026-08-07
**Repos touched (by the eventual skill):** none structurally — the skill *writes rows* to the prod `geo` table (Supabase project **Noetic App** `mgxqsrjutswbciyrltwd`) and reads a source PDF from disk/storage. Rendering already exists (see §7).
**Repos NOT touched:** `bureau`, `conductor`, `substation` schema (the `geo` table + `sir_parcels` RPC already shipped), `cityhall` app code (dynamic per-kind tabs + colors shipped in cityhall#627).
**Sibling doc:** [`../MVP-EXPERIMENT.md`](../MVP-EXPERIMENT.md) — the `geo` table + map-view experiment this builds on.

> This is a concept spec for a **future Claude Code skill**, not a finished design. It captures the methodology proven out by hand on one real SIR so a later session can turn it into a repeatable skill. Deliberately high-level; §8 is the worked reference so the concepts are concrete.

---

## 1. Problem / goal

A recorded subdivision plat or boundary survey (a "supporting document" attached to a diligence run) contains the **authoritative parcel geometry** for a site — more precise than the county GIS parcel rings we already ingest. Today that geometry is trapped as pixels in a PDF. We want a skill that, given such a PDF page and a target SIR, reconstructs the parcel polygon(s) in a local projected CRS, transforms to WGS84, validates them, and writes them into the `geo` table so they render on the SIR map as their own overlay — **alongside** (not replacing) the county parcels, so different derivation methodologies can be compared.

Success = for a plat with published corner coordinates, produce polygons whose computed area matches the plat's stated acreage to within ~0.1% and which overlap the county parcel at high IoU, uploaded under a distinct `kind`.

---

## 2. What the skill does (pipeline)

```
PDF page ──▶ render + zoom ──▶ read geometry ──▶ reconstruct rings ──▶ validate ──▶ transform ──▶ upload
 (poppler)    (imagemagick)     (native vision)    (planar math)       (3 gates)    (pyproj/PG)   (geo rows)
```

1. **Render** the target page to a high-DPI raster (`pdftoppm -r 300`). Plats are large-format; 300 DPI makes coordinate boxes legible.
2. **Determine the CRS** from the plat's north-arrow / basis-of-bearing note (e.g. "GRID NORTH KY STATE PLANE / NAD83(2011) SINGLE ZONE"). Map it to an EPSG code (§5). Confirm by transforming one corner to lat/lon and checking it lands on the known site.
3. **Read the geometry** with native vision, working in cropped/zoomed tiles (`magick -crop … -resize`). Extract two things:
   - **Corner coordinate boxes** — many plats print `N: … E: …` State Plane coordinates at each monument. **These are the ground truth** (see §4).
   - **Edge calls** — the bearing/distance labels (`N 03°53'40" E 249.10`) on each boundary segment. Used for cross-checking, not as the primary source.
4. **Reconstruct rings** in the projected CRS from the corner coordinates. Resolve topology (outer boundary + internal division lines for multi-lot plats), excluding right-of-way dedication strips from net-lot areas. Derive any un-boxed corner from an exact edge call.
5. **Validate** against three independent checks (§6). Do not proceed if a lot fails.
6. **Transform** each ring to WGS84 (EPSG:4326).
7. **Upload** one `geo` row per polygon (§7), under a document-scoped `kind`.

The skill is **human-in-the-loop**: it presents the fully validated geometry (areas, closure, an overlay QA image) and gets an explicit go before any DB write. Never fire the insert while still reconstructing.

---

## 3. Reading the plat with vision — practical notes

- Plats are dense and rotated (grid north is rarely "up" on the sheet). **Do not reason about page orientation** — the coordinate boxes are absolute, so read them and let the math place everything.
- Work in tiles. A single full-page read misses digits; crop each corner cluster and zoom (`-resize 200%`) to read `N/E` boxes and edge calls precisely.
- Read every coordinate box independently and transcribe carefully; a single wrong digit is caught downstream by the closure/area checks, but re-zoom to resolve any box you're unsure of.
- Distinguish **boundary lines** (heavy) from **easement/setback lines** (thin/dashed) and **tie lines to off-site monuments** (labeled "tie from parent tract"). Only boundary lines bound a lot.

---

## 4. Key insight — coordinates beat a metes-and-bounds traverse

The obvious approach is a metes-and-bounds traverse: start at a Point of Beginning and walk each `bearing + distance` call. That requires an absolutely-placed POB and is sensitive to the basis-of-bearing.

Many recorded plats instead **print State Plane coordinates at every corner monument**. Building the polygon directly from those coordinates is far more robust:

- The coordinates are absolute — no assumed basis, no accumulated traverse error.
- The bearing/distance calls become an **independent verification layer**: the coordinate delta between two adjacent corners must reproduce the printed call.
- Page orientation is irrelevant.

So: **coordinates are primary, calls are the check.** Fall back to a traverse only when a plat has no coordinate boxes.

---

## 5. CRS handling

- Read the datum/zone note off the plat and map to EPSG. Kentucky Single Zone US-survey-feet ≈ **EPSG:3089** (NAD83). The plat may cite NAD83(2011), strictly EPSG:6595 — projection parameters are identical and the datum-realization shift is sub-meter, negligible for a map overlay. **Default to matching whatever `srid_local` the SIR's existing rows use** for consistency (3089 in the reference case).
- The `geo` table stores geometry twice: `geom_local` (authoritative, projected — units follow the CRS) and `geom_wgs84` (derived, for web maps). `srid_local` records the EPSG code; a check constraint enforces `ST_SRID(geom_local) = srid_local`.
- **Sanity gate:** transform one corner `local → 4326` and confirm it lands on the subject site before trusting the CRS choice. A wrong EPSG lands hundreds of miles off.

---

## 6. Validation — three gates

Every reconstructed lot must pass all three before upload:

1. **Edge consistency** — for each edge, the coordinate delta reproduces the plat's printed `bearing + distance` call (tolerance ~0.5 ft; found monuments legitimately differ from record by a few tenths).
2. **Area** — shoelace area of the ring matches the plat's stated acreage (target < ~0.5%). For multi-lot plats the outer tract should equal the sum of the lots. This is the strongest structural check: a wrong vertex or bad topology breaks it.
3. **Cross-reference** — if the SIR already has county parcels for the same lots, compute IoU + centroid distance against them (via PostGIS `ST_Intersection`/`ST_Union`, `ST_Centroid`). Expect high IoU (>0.9) and sub-meter centroids; a lower-but-nonzero IoU is expected and fine (plat geometry is *more* precise than county GIS).

Also run `ST_IsValid` and confirm `ST_SRID` on both geometry columns before insert.

---

## 7. Data model + rendering surface

- **Write path:** one `INSERT` per polygon into `public.geo`. Build `geom_local` with `ST_GeomFromText(<wkt>, <srid>)` and `geom_wgs84 = ST_Transform(geom_local, 4326)` so the WGS84 copy is derived the same way as the county rows. `computed_area` is a generated `ST_Area(geom_local)`. Populate `stated_area` (sq ft from the doc), `method`, `source_doc`, and a `properties` jsonb (stated acreage, address, instrument, a note on how it was reconstructed). The table is RLS-locked to `service_role`; write via the Supabase MCP / service role.
- **`kind` convention:** give a supporting-document's polygons a **document-scoped kind** — `supporting_doc_<instrument>` (e.g. `supporting_doc_2024178771`) — *not* `parcel`. This keeps them from overlapping the county `parcel` rows and gives them their own map tab.
- **Rendering (already shipped, cityhall#627):** the SIR map derives one tab per distinct `kind` present (`parcel` pinned to the 0th/leftmost slot, others title-cased from the slug), and colors each tab's overlay from a 10-color blue/green palette indexed by `tabIndex % 10`. The `sir_parcels(uuid)` RPC returns all kinds, so no RPC change is needed for a new kind.

---

## 8. Reference implementation — Louisville car-wash SIR

Done by hand on 2026-08-07; this is what the skill should automate.

- **Source:** `working/sir/hutton/car-wash-louisville-ky/…/deliverable/supporting-documents/2024178771.pdf`, page 2 — a Bowman *Minor Subdivision Plat* of the Hutton Louisville / Bardstown Rd & Fegenbush Ln property, Jefferson County KY.
- **SIR:** `caac753c-128b-4311-8d10-2480be0268eb` (project `02a3a7c7-…`).
- **CRS:** plat noted "GRID NORTH KY STATE PLANE / NAD83(2011) SINGLE ZONE"; used **EPSG:3089** (matches the SIR's existing county rows). A corner transformed to (−85.637, 38.187) — on-site in Louisville.
- **Geometry:** the plat printed `N:/E:` coordinate boxes at every monument. Extracted ~12 corner boxes + edge calls. Reconstructed a 3-lot subdivision: outer tract = one internal chord + a Lot 1/Lot 3 division + a Lot 1/Lot 2 division; the R/W dedication strip (`~0.179 ac`) was excluded from the net lots; one SE corner was derived from an exact `S02°31'46"W 196.90` call (no box), validated by Lot 3 closing to its stated area.
- **Validation results:**
  - Areas: Lot 1 **3.861** ac / Lot 2 **1.023** / Lot 3 **2.608** vs. stated 3.863 / 1.023 / 2.608; outer tract 7.492 vs. 7.494.
  - Edges reproduced the printed calls to < 0.5 ft.
  - IoU vs. county parcels: Lot 2 **0.90**, Lot 3 **0.97**; centroids < 1.5 m. (Lot 1 is the new development parcel, absent from county data.)
- **Upload:** 3 rows, `kind = 'supporting_doc_2024178771'`, `srid_local = 3089`, `method = 'traverse'`. County `parcel` rows left in place → 5 total rows, 2 kinds → 2 map tabs.
- **Tools used:** `pdfinfo`/`pdftoppm` (poppler), `magick` (crop/zoom), `pyproj` `Transformer.from_crs(3089, 4326)`, PostGIS via Supabase MCP (`ST_GeomFromText`/`ST_Transform`/`ST_Area`/`ST_IsValid`/`ST_Intersection`), Pillow for the overlay QA image.

---

## 9. Skill I/O (proposed)

**Inputs:** source PDF (path or storage ref) + page number; target `sir_id`; optional CRS override; optional `kind` (default `supporting_doc_<instrument>`); optional stated-area hints.

**Outputs:** validated `geo` rows (after HITL go); a per-run report (extracted coordinates, per-lot validation table, transform sanity); an overlay QA PNG (reconstructed polygons vs. any existing county parcels).

**Gates:** CRS sanity (§5) → three validation gates (§6) → explicit human go before insert. Abort and surface, don't guess, if a lot won't close to its stated area.

---

## 10. Scope — deliberately deferred

- **No metes-and-bounds fallback** in v1 — assumes the plat prints corner coordinates. Coordinate-less plats (pure bearing/distance) need the traverse path (§4) with a georeferenced POB; out of scope for now.
- **Curved boundaries** are approximated as straight chords between monuments (fine for a web-map overlay at parcel zoom). True arc reconstruction (curve tables) is deferred.
- **No easement/encumbrance extraction** — only the parcel/lot boundaries. Recorded easements as their own `kind` are future work.
- **Not wired into the diligence pipeline** — a manual/skill-invoked session writes the rows out-of-band, exactly as in the MVP experiment.
- **Datum realization** (NAD83 vs NAD83(2011)) is treated as interchangeable for the overlay; not corrected.

---

## 11. Open questions

- **Q1 — CRS discovery.** Auto-map a plat's datum/zone note to an EPSG code (a small lookup keyed on state + zone + units), or always require an override? A wrong guess is caught by the on-site sanity check, but auto-mapping would smooth the happy path.
- **Q2 — Topology for multi-lot plats.** The hardest part is deciding which corners bound which lot and where internal division lines run. The reference case was solved by area-balancing (each lot must hit its stated acreage). Can this be made systematic, or does it stay human-guided per plat?
- **Q3 — Coordinate transcription reliability.** Vision digit-reads are the main error source. Worth a second-pass re-read of each box, or a confidence gate that forces a re-zoom? The area/closure checks catch most errors but not a compensating pair.
- **Q4 — `kind` naming + display.** `supporting_doc_<instrument>` renders as a title-cased slug ("Supporting Doc 2024178771"). Fine for the experiment; a richer display-name scheme (a label column, or human title in `properties`) is cleaner long-term.
- **Q5 — Where does this live?** A standalone skill vs. a step in a future surveyor/parcel-resolution pipeline that writes `geo` rows as part of a run (see MVP-EXPERIMENT Q3).

---

## 12. References

- Sibling: [`../MVP-EXPERIMENT.md`](../MVP-EXPERIMENT.md) — `geo` table schema, `sir_parcels` RPC, map-view wiring.
- `geo` table + RPC: `substation/supabase/migrations/20260807130000_geo_parcels.sql`, `substation/supabase/functions/geo_helpers.sql`.
- Rendering: cityhall#627 (dynamic per-kind tabs + index-based overlay colors).
- Reference data: SIR `caac753c-128b-4311-8d10-2480be0268eb`, instrument `2024178771`, prod Supabase `mgxqsrjutswbciyrltwd`.
