# Anchoring without a SIR — a loose PDF from upload to the map

**Status:** Draft v1
**Date:** 2026-10-13
**Repos touched:** `bureau` (`anchor-geometry` steps 1.1 and 1.2; a new SRID resolver and a county reader under `site-research/bin`), `cartographer` (`runbooks/anchor-geometry/scripts/{fetch,publish}.ts`; `src/routes/anchored`), `substation` (`geo` and `cartographer_anchors` ownership columns; the three RPCs in `geo_helpers.sql`)
**Repos NOT touched:** `cityhall-new`, `surveyor`, `conductor2`, `claude-plugins`, `quarry`
**Prod:** Supabase **Noetic App** (`mgxqsrjutswbciyrltwd`)
**Parent:** [`../north-star/NORTH-STAR-SPEC.md`](../north-star/NORTH-STAR-SPEC.md) (winston#303) — this is **P2a + P2b**, the decoupling and the manual path, peeled off on their own.
**Predecessor:** [`../anchoring-geometries/DESIGN-SPEC.md`](../anchoring-geometries/DESIGN-SPEC.md) (winston#279/#281) — the anchoring algorithm. Nothing here changes `anchor.ts`.

---

## 1. Problem

### 1.1 What this is for

One sentence: **upload a site plan PDF to Cartographer, run `extract-geometry-v2`, run `anchor-geometry`, and see the result on the map** — with no SIR, no project, and no plan set anywhere in the loop.

That is north star §7's manual path, stated there as a design constraint rather than a feature: *"it must be possible to upload a loose PDF into Cartographer, carry it as far down the pipeline as the data allows, and see an anchored geometry on a map."* It is P2a (the anchoring target) and P2b (the manual path end-to-end).

### 1.2 The file this is specified against

Everything below is verified against one real file already in prod.

`cartographer_files.cc2e3a53-db9b-493f-b270-e9039b03284c` — `White Water Express Car Wash 071326.pdf`, 30 pages, 30,727,110 bytes, `status: processed`, `project_id: null`, `source_sir_artifact_id: null`, `content_sha256: ee1c0b6b…`. Autodesk Civil 3D 2021 vector output, 2592 × 1728 pt sheets.

`extract-geometry-v2` ran on it as `whitewater-cc2e3a53-v2-run1` and published **exactly one figure**, `cartographer_geometries.5ab01b03-67ac-43ea-bc99-f38f29690ebf`:

| field | value |
|---|---|
| `label` / `kind` | `LOT 1` / `parcel` |
| `source_pages` | `[2, 7, 12, 19]` |
| `frame_key` | `frame-1`, `placement_method: reference`, offsets `(0, 0)` |
| `mete.courses` | `N15°27'20"E 195.00` · `S74°32'40"E 217.63` · `S12°50'40"W 95.83` · `S09°53'38"W 99.74` · `N74°32'40"W 231.66` |
| `misclosure_feet` | `0.0024` |
| `computed_area_sqft` / `stated_area_sqft` | `43,560.21` / `43,560` |
| `basis_of_bearings` | `{kind: "grid", zone: "TEXAS CENTRAL ZONE", datum: "NAD 83", verbatim: "HORIZONTAL DATUM BASED ON THE TEXAS STATE PLANE COORDINATE SYSTEM, NAD 83, TEXAS CENTRAL ZONE."}` |
| `grid_or_surface` / `combined_scale_factor` | `surface` / `1.0000327271` |
| `distance_units` | **`null`** |
| `control_points` | **`null`** |

One figure is the **correct** answer, not an under-read. Sheet 2 is the recorded plat and it dimensions exactly one thing: Lot 1. Every easement on it carries a recording reference and nothing else — `WATER EASEMENT DOC. NO. 2020062709`, `15' AERIAL ELECTRIC DISTRIBUTION, TELECOMMUNICATIONS AND ELECTRIC FIBER EASEMENT DOC. NO. 2019035034`, `EXCLUSIVE WATER LINES VAULT EASEMENT DOC. NO. 2019079124`, `WASTEWATER EASEMENT DOC. NO. 2019129105`, `DRAINAGE EASEMENT DOC. NO. 2019129457`, `25' WATER EASEMENT DOC. NO. 2006240270`, `ELECTRIC TRANSMISSION DISTRIBUTION LINE EASEMENT VOL. 548, PG. 327`. No bearings, no distances. They are IG's *"27% located only by reference to another document"* bucket and belong to north star **D10 / P3**, deferred.

`control_points: null` is likewise correct. There are **no printed State Plane coordinates anywhere in the 30 sheets** — a grep of the full text layer for the Texas Central range at this site (`3,0xx,xxx` easting / `10,0xx,xxx` northing) returns nothing, and the only two benchmarks are vertical:

```
BM#50: ELEVATION = 653.11'   SQUARE CUT ON NORTHEAST SIDE OF CONCRETE MANHOLE RISER…
BM#51: ELEVATION = 651.45'   SQUARE CUT ON THE CENTER OF THE WEST EDGE OF A STORM WATER CURB INLET…
```

So this file is **rung 3, `fitToRing`**. Rungs 1 and 2 are unavailable by construction. For rung 3 the county ring *is* the anchor, which is why §1.4 is about sourcing a ring and not only an EPSG code.

### 1.3 Why it cannot run today

The project this file belongs to (`project.7a697ef1-733f-4d3b-87e6-9cce995d8f1e`, *WhiteWater Express Car Wash - 78747*, `jurisdiction_slug: austin`) has **no `site_intelligence_report` row and no `geo` rows at all**. The only `workflow_runs` row for it is a completeness check (`116d55ac`, `submissionVersionId: 6688de93-71ba-4827-8092-8ec61d92c8b1`).

Three couplings stop the run, and they are of different difficulty:

| | Where | What the SIR supplies |
|---|---|---|
| **C-a** | `bureau/runbooks/anchor-geometry/steps/1.1-inputs/contract.test.ts:13` — `sir_id: z.string().uuid()` | the request will not validate without one |
| **C-b** | `cartographer/runbooks/anchor-geometry/scripts/fetch.ts:126` → `:144` | the **target CRS**, as the modal `srid_local` of the SIR's `county_api` parcel rows |
| **C-c** | `fetch.ts:152-156` → `:161` | the **fitting target**, as `sir_geo_in_srid(sir, srid)` → `inputs/parcels.json` |
| **C-d** | `publish.ts:119`, `geo_helpers.sql:326-328` and `:434-436` | the **output destination** — `cartographer_anchors.sir_id` is `NOT NULL`, `geo.sir_id` is `NOT NULL`, and both delete-keys are `(sir_id, properties->>'anchor_id')` |
| **C-e** | `cartographer/src/routes/anchored/+page.server.ts:67,92-93,106` | the **viewer** loops `sirIds` and calls `sir_parcels(p_sir)` per SIR |

**C-b already has an escape hatch that ships.** `target_srid` is optional on the request (`contract.test.ts:15`), passed through by `fetch.py:45-47`, and takes precedence at `fetch.ts:116-121` with `source: 'flag'`. It exists because SIRs researched before bureau#1812 have no `srid_local`.

But it does **not** remove the SIR. `sirId` is required unconditionally at `fetch.ts:46-48`, and `sir_geo_in_srid` is called unconditionally at `:152` *even when `target_srid` was supplied*. On White Water today, `target_srid: 2277` gets past `:144` and dies at `:161`: `SIR … has no geo rows; the anchor run needs at least the county parcel`.

### 1.4 The ring is the work, and it is already solved for SIRs

The one anchor run in existence, `cartographer_anchors.e94fae93-b3b6-42e5-9a24-fd16c476bee1` (car-wash plat, accepted 2026-09-28), fitted to two ordinary `county_api` rows:

| geo id | label | method | `source_doc` | area ft² |
|---|---|---|---|---|
| `71fd4e9f-d710-49b0-8235-e8b8117202a7` | 4401 Fegenbush Ln | `county_api` | `parcel-rings.geojson` | 44,558 |
| `22824c2a-fe7a-49c2-a042-4b4d4c81d4a2` | 4403 Fegenbush Ln | `county_api` | `parcel-rings.geojson` | 113,595 |

Those were written by `sir_add_parcel_geo` (`geo_helpers.sql:143`) at SIR publish, from the county ArcGIS fetch `site-research` had already staged. **The ring came from the county. The SIR was only the row it hung off.** So the pattern this spec needs is not new — it is the existing pattern with the owner removed.

Two findings from reading that run, both of which this spec acts on:

- **"8 figures, 1 anchor" verifies.** The plat had 8 figures and the SIR had only 2 county rings. LOT 2 (44,546 extracted) fitted 4401; LOT 3 (113,595) fitted 4403; the remaining six — LOT 1 at 168,282 ft², three ROW dedications, two easements — had **no target at all** and rode the frame's transform. North star §4.4 confirmed against real data.
- **`cartographer_anchors.target_geo_ids` already dangles.** It lists three ids; only two exist. `68ca747d-fc39-41a7-9187-5c54b093fa06` is gone from `geo`. It is a bare `uuid[]` with no foreign key and it has already rotted on the only anchor run we have. §3.6 gives it a job; **Q7** asks whether to constrain it.

### 1.5 What a live county fetch returns, measured

Run during this spec against the layer `jurisdictions/austin-tx.md` names, at the site:

```
arcgis_query.py point https://maps.austintexas.gov/arcgis/rest/services/Shared/AppraisalDistricts/MapServer/0 \
  --lat 30.15026 --lon -97.79345 --geometry --native-ring --out tcad
→ 1 feature: PID_10 0436110202, PROP_ID 775822
→ native_sr {wkid: 102739, latestWkid: 2277, projected: true, source: "layer"}
→ ring: 1 ring, 7 points
```

The ring's edges against the plat's courses:

| TCAD native edge | plat course |
|---|---|
| 231.64 ft @ 285.4487° | `N74°32'40"W 231.66` (285.4444°) |
| 195.00 ft @ 15.4481° | `N15°27'20"E 195.00` (15.4556°) |
| 217.63 ft @ 105.4480° | `S74°32'40"E 217.63` (105.4556°) |
| 95.83 ft @ 192.8446° | `S12°50'40"W 95.83` (192.8444°) |
| 86.82 + 12.92 ft @ 189.894° | `S09°53'38"W 99.74` (189.8939°) — TCAD splits the single call at a collinear vertex |

Area 43,557.77 ft² against the plat's 43,560. **The rung-3 fit on this file should be near-exact.** Lenox Springs Section III is a 2021 plat and TCAD digitised it from the recording; this is not representative of older parcels, which are the ±3 ft `gis_fit` case north star §9.4 warns about.

One more measured fact: `project.site_outline` for this project is **vertex-identical to that live fetch** — same seven points to ≤ 1.8 × 10⁻⁹ degrees, wound the opposite way. So the parcel is already resolved and already in the database, despite there being no SIR and no site-research run. What `site_outline` lacks is everything but the shape: no `parcel_id`, no legal description, no `native_geometry`, no `native_sr`. See **D7** for why that is not good enough to build a `county_api` row from.

### 1.6 Scope

**In:** making `anchor-geometry` run on a `cartographer_files` row that nothing owns, resolving the target SRID without an operator typing it, sourcing and persisting the fitting target, making `geo` and `cartographer_anchors` accept no owner or an optional one, and making `/anchored` draw the result.

**Out, deliberately:**

- **The sheet-linework reader.** Reading the *drawn* geometry off a vector plan sheet — tracing the dashed property line with `plan_vectors.py`, solving page-pixels → State Plane, and placing the building, pond, curbs and mains — is north star §6 / **P5**. It is where the value is on a plan set (metes-and-bounds prose gives you the boundary and, by construction, nothing else), and it looks tractable: on sheet 12 the heavy dashed property line merges across its 28 dashes into one run of **3475.00 px**, which at 300 dpi is **231.67 ft** against the plat's 231.66, and **15.0004 px/ft** — exactly 1″=20′, self-confirming. None of that is in this spec. §6 names only the seams it must not foreclose.
- Schema elegance. Duplicating an RPC is preferred to generalising one where generalising costs a migration on 56 live rows.
- Any change to `anchor.ts`, to `extract-geometry-v2`, or to steps 2.1, 3.1, 3.2, 3.3 and 4.1 of `anchor-geometry` — **five of nine steps are untouched**, because none of them has a SIR concept and they only read `inputs/parcels.json`, whose shape does not change.
- Backfilling the 56 existing `geo` rows to a new ownership model. All 56 derive a `project_id` cleanly (31 SIRs → 31 projects, 1:1, zero orphans) if that is ever wanted; **Q8**.

---

## 2. Decisions

### 2.1 Ownership

**D1. `geo.sir_id` becomes nullable, and `geo` gains a nullable `submission_version_id`.** A `geo` row may be owned by a SIR (today's rows, unchanged), by a site-plan submission version, or by **nothing**. Nothing is a first-class case — it is what a loose PDF produces, and it is the case this spec exists to serve.

`submission_version` is the right grain: for White Water, `submission_version.6688de93-71ba-4827-8092-8ec61d92c8b1` → `submission.38ddbfd8` → `project.7a697ef1`, and `plan_set_version.6b4c9887.submission_version_id = 6688de93`, so the join to the plan set already exists and nothing new is needed to reach the project.

There are **no RLS policies on `geo`, `cartographer_files`, `cartographer_geometries` or `cartographer_anchors`** (verified: `pg_policies` returns zero rows for all four), so this is a column change, not a policy rewrite.

**D2. `cartographer_anchors` takes the same treatment** — `sir_id` nullable, new nullable `submission_version_id`.

**D3. The run request's owner fields are all optional.** `1.1-inputs`'s `Request` becomes `{file, anchor_run_slug?, scope_note?, target_srid?, sir_id?, submission_version_id?}`. The only required field is `file`. A request naming both owners is accepted (**Q2** asks whether to forbid it).

### 2.2 Resolving the target SRID

**D4. The ladder is: the request, then derivation, then stop.**

1. `request.target_srid` — the existing operator override (`contract.test.ts:15` → `fetch.py:45` → `fetch.ts:116`), unchanged, always wins.
2. **Derive it**, from two independent sources that must agree (D5, D6).
3. **Fail fast** (D8). There is no silent fallback.

**D5. The zone comes from the already-extracted `basis_of_bearings` — no new vision call.** The plat states the zone on sheet 2, and `extract-geometry-v2` already captured it (§1.2). `fetch.ts` already reads the field and prints it into `inputs/README.md` for the correspond agent, so the data is *already flowing through this runbook*; it is simply not used to pick an SRID.

Re-reading the PDF is not an alternative: **page 2 has 641 non-whitespace characters in its text layer**. The plat's lettering is vector outlines, which is why `pdftotext` finds no "TEXAS CENTRAL ZONE" and why the extract run's vision pass is the only thing that has ever read it. Spending an Opus vision call to re-derive a field we are holding is waste.

The zone alone is **not sufficient**: "TEXAS CENTRAL ZONE / NAD 83" is EPSG **2277** in US survey feet and **32139** in metres, and the bearing basis note never states a unit — it says only *"COORDINATES AND DISTANCES ARE SURFACE VALUES. COMBINED SCALE FACTOR IS 1.0000327271."* That is why `distance_units` is `null` on the extracted row, and why D6 exists.

**D6. The code and the unit come from the county, and the county comes from the plan set's own text layer.** `spcs_lookup.py` already holds exactly this data and resolves the unit from the state's statutory unit:

```
spcs_lookup.py 48453      # or: --state TX --county Travis
{"fips":"48453","state":"TX","county":"Travis","epsg":2277,"units":"ftUS",
 "zone_name":"NAD83 / Texas Central (ftUS)","zone":"tx_central","basis":"ngs_zone",
 "note":"Observed on the City of Austin Shared/AppraisalDistricts/MapServer/0 (TCAD Parcels)
         layer: wkid 102739 / latestWkid 2277 (2026-09-24)","source":"county_table"}
```

Stdlib, zero network, already in bureau — and its Travis row has already been reconciled against the exact layer §1.5 fetched from.

The county is read from **page 1 of the PDF**, which unlike page 2 has a full text layer:

```
line  64: FEDERAL FLOOD INSURANCE ADMINISTRATION, FIRM PANEL NO. 48453C0595K FOR TRAVIS COUNTY,
line 150: LOTS 1 OF LENOX SPRINGS SECTION III … PUBLIC RECORDS TRAVIS COUNTY, TEXAS.
```

The **FIRM panel number is the primary key, not the prose**: the first five characters of a FEMA panel id are the county FIPS by convention, so `48453C0595K` → `48453` → Travis, structurally rather than by regex over English. The legal description's "TRAVIS COUNTY, TEXAS" is corroboration. Flood notes are near-universal on site plan sets.

`project.jurisdiction_slug` is a shortcut when a project happens to be linked, never a requirement — the manual path has no project.

**D7. `spcs_lookup` is the resolver; surveyor is not consulted.** surveyor's `native_sr` is recorded **per GIS layer**, not per county — inside Travis County's own server, `DBO.Parcels` is 2277 while `DBO.County` and `DBO.Precincts` are published as geographic WGS84 WKT. Using it requires already knowing which layer you would query, and there is **no machine-readable jurisdiction → parcel-layer registry**: `jurisdictions/austin-tx.md` is prose for an agent and `site-research/steps/1-resolve-site` is an agent step. Building that registry is real work and is not in this spec (**Q3**).

**D8. Disagreement is a hard stop.** The run exits 75 at `1.2-fetch` with a message naming the two readings and the fix (`target_srid` in `request.json`). The cases:

- the plat cites a **low-distortion or county projection** — increasingly common on Texas plats — so it names a zone that is not an SPCS zone at all;
- `basis_of_bearings.kind` is `assumed` or `deed`, so there is no zone to read;
- the county is **split between zones** and `spcs_lookup` has no row (`_about.unassigned`);
- the two resolve to different EPSG codes;
- the PDF is a scan with no page-1 text layer, or names more than one county (**Q6**).

A wrong SRID does not fail loudly. It produces a plausible similarity transform onto the wrong grid, and `fitToRing` will cheerfully report an IoU for it. The escape hatch already exists and costs the operator one number.

**D9. `grid_or_surface` and `combined_scale_factor` are carried into the solve, not dropped.** The plat's distances are **surface**; the target grid is not. `anchor.ts` takes this as `statedScaleFactor` (`AnchorInputs`), and on this file it is `1.0000327271`. Resolving the SRID correctly and discarding the scale factor puts the ring out by ~0.9 ppm — negligible on a 1-acre lot, and exactly the class of thing that silently poisons a fit at scale.

### 2.3 Sourcing the fitting target

**D10. `1.2-fetch` fetches the county ring live and writes it into `geo` as a `county_api` row before solving.** This is the pattern that already runs (§1.4), with the owner removed. Concretely: `arcgis_query.py point <layer> --lat --lon --geometry --native-ring`, then an RPC that is `sir_add_parcel_geo` with the ownership changed, then `fetch.ts` reads the row back and builds `inputs/parcels.json` exactly as it does today.

Three consequences, all wanted:

- `inputs/parcels.json` keeps its shape, so **`2.1-correspond` needs no changes** — it still reads `properties.legal_desc`, per-feature rings, and the county's own ids to make and quote its claims.
- `cartographer_anchors.target_geo_ids` points at real rows, which is what D11 needs.
- The project ends up with its county parcel ring in `geo`, which is `geo`'s dominant row type anyway (46 of 56).

Rejected alternatives:

- **Transient fetch** (no `geo` write): `target_geo_ids` would go empty and the viewer's context layer would be empty, so you would see an anchored lot floating on the aerial with nothing to judge it against — which is the entire point of looking at it on a map.
- **Promote `project.site_outline`**: zero network and present for 57 of 59 projects, but it is a collected, deduped geometry with no parcel id, no legal description, no `native_geometry` and no `native_sr`. `geom_local` would become a reprojection rather than the county's own digitisation — the exact distinction `sir_add_parcel_geo` goes to trouble to preserve (it Hausdorff-checks the native ring against the WGS84 one in a 50 m two-sided containment test before trusting it, `geo_helpers.sql` ~:190-215). Throwing that away to save one HTTP call is the wrong trade on the table that is meant to become the derived spatial layer. It also breaks correspond's evidence.

**D11. The idempotency key for an unowned `county_api` row is the cartographer file.**

Today's key (`geo_helpers.sql:172-175`) is:

```sql
where sir_id = p_sir and kind = p_kind
  and method = 'county_api' and label is not distinct from p_label
```

With `p_sir` NULL this is a **never-match**, not a wrong-match: `sir_id = NULL` is NULL, so the lookup finds nothing and always inserts. Run the anchor runbook twice on the same loose PDF and you get two county rings, then three, and `/anchored`'s context layer accumulates duplicates. The naive repair (`sir_id is not distinct from p_sir`) is worse — it makes every unowned county row collide with every *other* unowned county row sharing a kind and label, across unrelated sites.

So the new RPC keys on `(file_id, kind, label, method='county_api')`, with `file_id` taken from the `source_doc` the function already writes (`'cartographer:' || file_id`). It is stable across re-runs of both runbooks, and it makes "this file's county context" a single well-defined set regardless of whether anything owns it.

### 2.4 Publishing and the map

**D12. The delete-key for an anchor's rows becomes `properties->>'anchor_id'` alone.** It appears twice — `sir_put_anchored_geo` (`geo_helpers.sql:326-328`) and the reject path of `cartographer_anchor_decide` (`:434-436`) — and both are currently `(sir_id, anchor_id)`. `anchor_id` is already sufficient and unique; the `sir_id` conjunct is redundant today and wrong once `sir_id` is nullable. This is the one place where the decoupling makes the schema simpler rather than wider.

**D13. `/anchored` finds its context through the anchor, not through an owner.**

```
figures = geo WHERE properties->>'anchor_id' = anchor.id      -- unchanged (+page.server.ts:139)
context = geo WHERE id = ANY(anchor.target_geo_ids)           -- replaces sir_parcels(p_sir)
```

This works with zero owners and gives `target_geo_ids` a real job — which is incidentally the reason to fix its integrity (§1.4, **Q7**). The SIR rail subtitle (`+page.server.ts:71`) becomes optional rather than per-anchor-required.

**D14. The `4.1-hitl` gate is unchanged.** It exists so a fit cannot publish itself. Even on the near-perfect car-wash run `auto_accept_suggested` was `false`, because of the C5 union-outline metric bug (north star **P0c** / winston#289 B3), so the gate is still the only real check. Removing it is a separate decision that depends on P0c.

---

## 3. The change, piece by piece

| # | File | Change |
|---|---|---|
| 1 | `bureau/.../steps/1.1-inputs/contract.test.ts:13` | `sir_id` → optional; add optional `submission_version_id` (D3) |
| 2 | `bureau/.../scripts/fetch.py` | pass the owner fields and the resolved SRID through; surface the D8 stop with its message |
| 3 | `bureau/runbooks/site-research/bin/spcs_lookup.py` | add a **zone-name → EPSG + unit** reverse index over the table it already owns (D6) |
| 4 | `bureau/runbooks/site-research/bin/` (new) | `plan_set_county.py` — page-1 text layer → `{fips, county, state, evidence}`, FIRM panel first (D6) |
| 5 | `cartographer/.../scripts/fetch.ts:46-48` | `--sir` → optional; new `--submission-version`; owner may be absent |
| 6 | `cartographer/.../scripts/fetch.ts:116-147` | insert the D4 ladder between the flag and the stop |
| 7 | `cartographer/.../scripts/fetch.ts:152-161` | when there is no SIR, fetch the county ring (D10), write it, read it back; `sir_geo_in_srid` is used only on the SIR path |
| 8 | `cartographer/.../scripts/publish.ts:119` | `sir_id` may be null; carry `submission_version_id` |
| 9 | `substation/supabase/migrations/` (new) | `geo.sir_id` nullable + `geo.submission_version_id`; same on `cartographer_anchors` (D1, D2) |
| 10 | `substation/supabase/functions/geo_helpers.sql` | new `add_parcel_geo` (D10, D11); `sir_put_anchored_geo` and `cartographer_anchor_decide` delete-keys → `anchor_id` (D12) |
| 11 | `cartographer/src/routes/anchored/+page.server.ts:67,92-93,106` | context by `target_geo_ids` (D13) |

**Untouched:** `anchor.ts` and every solver; `extract-geometry-v2`; and `anchor-geometry` steps `2.1-correspond`, `3.1-solve`, `3.2-render`, `3.3-check`, `4.1-hitl`.

**Deploy order:** substation (9, 10) → bureau (1–4) + cartographer scripts (5–8) → cartographer app (11).

---

## 4. Testing seams

**S1: the `anchor-geometry` runbook, inputs → outputs** (existing)
- **Proves:** D1–D3, D10, D12 end to end — a `request.json` carrying only `{file, anchor_run_slug}` produces `anchors.json`, a `cartographer_anchors` row with `sir_id IS NULL`, and `geo` rows with no owner.
- **Prior art:** `cartographer/runbooks/anchor-geometry/scripts/anchor-e2e.test.ts`.
- **Runs:** locally against the White Water file; it is the §5 acceptance test.

**S2: `fetch.ts`'s CLI** (existing)
- **Proves:** D4–D9 and D10. The SRID ladder and the ring materialisation are both observable in `inputs/target.json` (`target_srid` + `source`) and `inputs/parcels.json`, with no database assertions needed. Each D8 stop is one invocation and one expected exit.
- **Prior art:** `cartographer/runbooks/anchor-geometry/scripts/lib/contracts.test.ts`, `frames.test.ts`.
- **Runs:** `bun test` in `cartographer`, CI.

**S3: the SRID resolver** (new, in `spcs_lookup.py`)
- **Proves:** D5–D8's arithmetic alone — `("TEXAS CENTRAL ZONE", "NAD 83") + 48453 → 2277/ftUS`; zone-not-SPCS, county-unassigned, kind-not-grid and outright-disagreement each return the stop rather than a guess. The unit ambiguity (2277 vs 32139) gets a case of its own.
- **Prior art:** `bureau/runbooks/site-research/bin/test_spcs_lookup.py` — same file, same style, stdlib `unittest`.
- **Runs:** `python3 -m unittest test_spcs_lookup`, CI.

**S4: the RPCs, against a local Supabase** (existing)
- **Proves:** D11 (two runs on one file produce **one** county row) and D12 (the `anchor_id`-only delete-key removes exactly the right rows with `sir_id` null).
- **Prior art:** `substation/src/lib/cartographer-anchors.integration.test.ts`, `geo-parcel-native-srid.integration.test.ts`.
- **Runs:** substation's integration suite against a local Supabase.

---

## 5. Acceptance

Upload `White Water Express Car Wash 071326.pdf` to Cartographer as a loose file — **no project, no SIR, no plan set**. Run `extract-geometry-v2`. Run `anchor-geometry` with a request carrying only `{file, anchor_run_slug}`.

1. `1.2-fetch` resolves **EPSG 2277** on its own, `source: "derived"`, with `fetch.log` naming both readings: `basis_of_bearings` "TEXAS CENTRAL ZONE / NAD 83" and FIRM panel `48453C0595K` → Travis → `tx_central`, `ftUS`.
2. It fetches the TCAD ring (PID `0436110202`) and writes **one** `county_api` `geo` row with no owner.
3. `3.1-solve` fits LOT 1 by `ring_fit` / `gis_fit`, with the stated surface scale factor applied.
4. `/anchored` draws the anchored lot in marine over the county ring in amber.
5. **Re-running the whole thing produces one county row, not two.**

A deliberate negative: run it again with `target_srid: 32139` in the request and it must solve in metres and produce a visibly wrong result — the override has to still be an override.

---

## 6. Seams this must not foreclose

Named only so the decoupling does not harden against north star **P5**. None is addressed here.

1. **Frame identity.** `frame_key` is per-document today (`frame-1` for all of White Water). A plan set has ~14 plan-view sheets, each its own viewport — on sheets 7 and 12 the same property line sits at different page coordinates — so a sheet reader needs one frame per sheet. Nothing links a frame to `sheet_version`. Do not make `frame_key` *mean* "document".
2. **Fixed scale.** `anchor.ts` fixes `s` at 1 or the stated combined factor, which is right for courses already in feet and wrong for page pixels. `freeScale` is already computed and reported but never applied.
3. **Units.** `DistanceUnits = ft | ftUS | varas | m` has no page-pixel member.
4. **Polygon-only.** `cartographer_geometries.polygon` is `{rings}` and `sir_put_anchored_geo` rejects anything not (Multi)Polygon after `ST_MakeValid`. Hydrants are points; mains and curbs are lines.
5. **Reading model.** `mete.courses` + `misclosure_feet` has no meaning for a traced polyline.
6. **Correspondence vocabulary.** `2.1-correspond` claims ring matches, vertex ties, edge ties and control points; a sheet's natural claims are "this run is the property line" and "this is the scale bar and it reads 20 ft".
7. **Posture.** `geo.method` ∈ `county_api | anchored | estimated` has no *recorded vs proposed* axis, and north star §1.3's headline use case measures between the two.
8. **Provenance.** `geo.source_doc` is `'cartographer:' || file_id`; a sheet reader wants the sheet. D1's `submission_version_id` is the first step toward that.

---

## 7. Open questions

**Q1.** Does the new parcel RPC get a fresh name (`add_parcel_geo`) alongside `sir_add_parcel_geo`, or does `sir_add_parcel_geo` gain nullable owner params and keep its name? Duplication is cheap and explicitly acceptable; a rename touches `cityhall-new/src/lib/publish/sir.ts:382` and both test doubles.

**Q2.** Should `geo` forbid carrying both `sir_id` and `submission_version_id` (a CHECK), or are they independent provenance links with no XOR?

**Q3.** Where does the **parcel layer URL** come from for a county we have not met? D10 needs one and there is no registry (D7). For v1 it can be a constant for Austin plus an optional request field — but that is the thing that stops this generalising, and it is the same gap north star **D11** names.

**Q4.** `/anchored` currently has one rail row per anchor with a SIR subtitle. With no owner, what labels an anchor — the file name alone, or `submission_version` → `submission` → `project.name` when the chain exists?

**Q5.** Does a re-run under a *new* `anchor_run_slug` reuse the county row (D11 says yes, the key is the file) or mint a fresh one per anchor run so a run's context is immutable?

**Q6.** A plan set naming more than one county (a TxDOT note, an adjacent jurisdiction), or citing several FIRM panels. Stop and ask, or take the panel that appears in the flood note specifically?

**Q7.** Should `cartographer_anchors.target_geo_ids` get referential integrity now that D13 reads the map through it? It has already dangled once on one row (§1.4). An array FK needs a trigger or a join table.

**Q8.** Backfill posture for the 56 existing `geo` rows. All 56 derive a `project_id` cleanly, so north star **D4** (project ownership) stays available — but this spec does not need it and does not do it. Does anything want it before P5?
