# Cartographer north star — anchored geometry for every site

**Status:** Draft v1
**Date:** 2026-10-08
**Repos touched:** none yet. This spec commits to no implementation; it names the destination, the stages, and what to peel off first.
**Repos eventually touched:** `substation` (schema), `bureau` (runbooks), `cartographer` (readers, solvers, viewer), `surveyor` (layer identity)
**Repos NOT touched:** `cityhall` until a viewer phase exists
**Prod:** Supabase **Noetic App** (`mgxqsrjutswbciyrltwd`)

> **What this document is.** A plan of a plan. It is deliberately coarse, expects to be
> iterated on for weeks, and expects slices to be peeled off one at a time. Decisions
> (D) are directional, not settled. Open questions (Q) outnumber them on purpose.
> Everything in §2 is verified against prod and the code on 2026-10-08; everything in
> §4 onward is a proposal.

---

## 1. The north star

### 1.1 What "done" looks like

Every site Noetic knows about has its geometry in `geo`, in the county's own State Plane
zone, from **both** of its producers:

- **From the SIR** — the county parcel ring, and every recorded encumbrance the county
  clerk documents describe: easements, rights-of-way, lots, replat boundaries, building
  lines.
- **From the site plan set** — the proposed improvements the drawings show: the building
  footprint, curbs and drive aisles, utility structures (transformers, hydrants,
  manholes), detention ponds.

Both land in the same table, in the same coordinate system, each carrying how it was
placed and how much its position can be trusted.

### 1.2 Why: the question that needs both producers

The point of a planar, projected geometry layer is that **PostGIS answers questions
deterministically** that an LLM can only guess at:

```sql
SELECT ST_Distance(building.geom_local, easement.geom_local);
SELECT ST_ShortestLine(ST_Boundary(building.geom_local), ST_Boundary(parcel.geom_local));
SELECT ST_Intersects(proposed_structure.geom_local, recorded_easement.geom_local);
```

Every one of those is a real review question — *does the proposed building encroach on
the recorded sanitary sewer easement, and if not, by how much?* And every one of them
needs **one geometry from each producer**: the recorded encumbrance comes off a county
clerk document (the SIR side), the proposed structure comes off a plan sheet (the plan
set side). Neither producer alone answers it.

That is the whole argument for one `geo` table serving both, and for this spec existing
at all.

### 1.3 The consumer is a tool surface, not a map

A map viewer is nice and comes late. The actual deliverable is a set of **deterministic
geometry tools an agent can call** during a review or a diligence pass, backed by
PostGIS. A MapLibre viewer is how a human audits what the tools are reasoning over.

---

## 2. Where we are today (verified 2026-10-08)

### 2.1 What exists and works

| Piece | State |
|---|---|
| `geo` table | 44 rows. 34 `county_api` (parcel rings), 8 `anchored`, 2 `estimated`. Every row carries `geom_local` + `srid_local`. |
| SIR → parcel rings | Automatic. `upload-sir`'s publish calls `sir_add_parcel_geo` (`substation/supabase/functions/geo_helpers.sql:143`), which now derives `geom_local` from the county layer's native ring or by `ST_Transform`. |
| Local SRID resolution | Layer-first (`arcgis_query.py` reads the layer's own `sourceSpatialReference` as `native_sr`), falling back to the curated county table via `site-research/bin/spcs_lookup.py`. |
| `extract-geometry-v2` | Works. One PDF per run → SRID:0 figures in `cartographer_geometries`, placed relative to each other inside a `frame_key`, with `basis_of_bearings` / `distance_units` / `grid_or_surface` / `combined_scale_factor` / `control_points` transcribed. |
| `anchor-geometry` | Works. One run completed: anchor `e94fae93`, car-wash plat, `printed_coordinates` / `survey`, θ vs grid 0.0095°, control-point residuals 0.17–0.31 ft, IoU 0.988, 8 `geo` rows published 2026-09-28. |
| Cartographer app | Live at `cartographer-ruddy.vercel.app`, SSO gate working. `/files` lists uploads, `/processed` lists files with figures, `/geometry/[id]` renders one figure. |

### 2.2 What the corpus actually looks like

From the Inspector General survey
[`2026-09-23-sir-geometry-source-survey`](https://inspector-general-gamma.vercel.app/reports/view/2026-09-23-sir-geometry-source-survey/)
(10 SIRs, 645 supporting docs / 445 unique files / ~6,800 pages, 315 unique geometries),
and from prod counts taken for this spec:

- **Volume.** 2,597 `supporting_document` rows across 34 SIRs — 100–300 per SIR. IG found
  **75%** of documents define some geometry.
- **Cost.** `extract-geometry-v2` is 30–60 minutes of Opus vision and roughly $40 of
  subscription drain per document. Exhaustive extraction of one SIR is therefore a
  four-to-five-figure, multi-day proposition.
- **The anchoring ladder is calibrated for the rare case.** Printed State Plane
  coordinate values appear in **3 of 315 geometries** (~1%) — the car-wash plat is one of
  them. **25** geometries cite a State Plane grid as a basis of bearings with no
  coordinate values.
- **Reconstructability.** 51% are a closed shape with no position (today's SRID:0 path,
  anchored by ring fit); **27% are located only by reference to another document**; 17%
  are approximate sketches; 3% are not reconstructable.
- **Duplication is the norm.** **147 of 315 geometries appear in more than one
  document.** Palm Bay's Lot 7 description is reproduced in **12**.
- **Feature mix.** Easement 27%, tract 18%, lot 10%, parcel 8%, right-of-way 7%, site
  boundary 6%, point features 5%.

### 2.3 The couplings that block the north star

**C1 — `geo` is SIR-owned.** `geo.sir_id` is `NOT NULL` with `ON DELETE CASCADE`
(`20260807130000_geo_parcels.sql`). A plan set can never hang geometry off it. Both
`plan_set` and `site_intelligence_report` carry `project_id`.

**C2 — `anchor-geometry` requires a SIR**, and the SIR does three different jobs in it
(`bureau/runbooks/anchor-geometry/steps/1.1-inputs/contract.test.ts`,
`cartographer/runbooks/anchor-geometry/scripts/fetch.ts`): it supplies the **fitting
target** (the county parcel ring), the **target CRS** (modal `srid_local` of the SIR's
`kind='parcel'` rows), and the **output destination** (`sir_put_anchored_geo`).

**C3 — nothing crosses document boundaries.** Extraction is scoped to one
`cartographer_files` row. Nothing anywhere says two readings describe the same thing.

**C4 — no route from a SIR's documents into Cartographer at scale.** Only two things
insert `cartographer_files` rows: the app's upload (`api/files/commit`) and
`import-sir-artifact.ts`. Both are one file at a time, by hand.

**C5 — the quality metric is wrong for the dominant case.** winston#289 B3: fit metrics
are computed over a *union outline* that keeps the target's interior lot lines, giving
25.7 ft mean / 209 ft Hausdorff where per-lot it is 1.6–2.5 ft. Auto-accept thresholds
cannot be calibrated against it.

---

## 3. The shape of the system

### 3.1 Four stages; two of them are source-agnostic

**D1.** The pipeline has four stages, and the question of *which are reusable across
producers* is the organising idea of this spec:

| Stage | What it does | Source-agnostic? |
|---|---|---|
| **Read** | turn a document into a shape | **No.** Metes-and-bounds prose, a dimensioned plat, a CAD vector layer and a hydrant symbol on a utility sheet are four different problems. |
| **Identify** | decide which readings describe the same real-world thing | **Mostly yes.** The matching signals differ (recording references vs sheet labels) but the algorithm is one. |
| **Place** | solve a transform onto the county grid | **Yes.** One 2D similarity transform. The *strategies* are weighted differently per producer, but the solver is one. |
| **Publish** | write the located feature to `geo` | **Yes.** |

The corollary: **plan sets need a new reader and reuse everything below it.** That is
what makes the north star reachable instead of a rewrite.

### 3.2 Placement is already source-agnostic, in code

`cartographer/src/lib/geometry/anchor.ts` takes `AnchorInputs` = `{ frameKey, figures,
distanceUnits, targetUnits, gridBasis, statedScaleFactor, controlPoints, vertexTies,
edgeTies, ringTargets }`. There is no SIR concept anywhere in the math layer. **The
coupling in C2 lives entirely in the runbook's `fetch.ts` and `publish.ts` wrappers.**

### 3.3 The missing stage is identity

Nothing today represents *the thing itself*. `cartographer_geometries` holds **what one
document says**; `geo` holds **where something is**. With 147 of 315 geometries appearing
in more than one document, a per-document pipeline writing straight into `geo` produces a
pile of near-identical polygons and `ST_ShortestLine` has no idea which easement was
meant.

**D2.** Introduce a **feature**: the row that asserts *"these N readings describe one
thing, and here is the reading we trust."* Three roles, cleanly separated:

| Role | What it is | Where |
|---|---|---|
| **Reading** | what one document says — SRID:0, feet, evidence-backed, one per figure per document | `cartographer_geometries` (unchanged) |
| **Feature** | the real-world thing, its identity, its corroboration | **new** |
| **Placement** | the transform that puts a frame on the grid | `cartographer_anchors` (unchanged) |

Identity is also **free accuracy**: twelve independent transcriptions of one description
cross-check each other. If eleven close to 0.02 ft and one closes to 40 ft, the outlier
is a misread, not a disagreement about the world.

### 3.4 What `geo` becomes

**D3.** `geo` stops being a second source of truth and becomes the **derived spatial
layer**: one row per located feature, rebuildable. The invariant:

> If you dropped `geo` entirely, you could regenerate every row from readings + anchors +
> county fetches.

Today it is both — the two `estimated` rows are hand-authored truth, the 8 `anchored`
rows are derived, the 34 `county_api` rows are a fetch. Picking *derived* resolves the
"two databases" smell without deleting anything, and makes the plan-set producer a
straightforward additional writer rather than a schema negotiation.

**D4.** `geo`'s owner becomes the **project**, with SIR and plan-set ids as provenance
rather than parentage. This is the one change that makes §6 possible at all, and it is
far cheaper now than after there is data pointing at it.

---

## 4. The five-step SIR geo workflow

**D5.** For the SIR producer, the pipeline is five steps, three of which are new
runbooks. Will's name for it: *the five-step SIR geo workflow.*

```
① triage  →  ② extract  →  ③ consolidate  →  ④ anchor  →  ⑤ geo
   (new)      (exists)        (new)          (exists,      (exists,
                                              decoupled)    widened)
```

### 4.1 ① triage — which documents are worth $40

A cheap, per-SIR runbook. Reads the SIR's supporting documents by text, first page,
filename and whatever the SIR's own research already concluded, and emits a **ranked
worklist**: which documents define geometry, what is in each, what to extract first and
why, what to never bother with.

It never does full vision extraction. The expensive, genuinely-unsupported decision today
is *which 12 of 200 documents are worth the money* — not launching the run, which
conductor already does.

**D6.** The queue is not a new subsystem. `sir_artifact` already **is** the backlog —
"not yet extracted" is a query (a supporting document with no `cartographer_files` row
carrying its `source_sir_artifact_id`). The only state worth persisting is what a query
cannot derive: *examined and deliberately skipped*, *tried and the scan is illegible*.

### 4.2 ② extract — unchanged

`extract-geometry-v2`, per document, exactly as it runs today. Needs a
`cartographer_files` row, which `import-sir-artifact.ts` already mints from a
`sir_artifact` id with content-hash dedup.

### 4.3 ③ consolidate — readings become features

Its own runbook, for three independent reasons: it is the first step that is **per-SIR
rather than per-file**; it must **re-run every time one more document is extracted**
(idempotent and incremental, where extraction is once-per-file and destructive on
republish); and it is **cheap** (structured JSON, not vision), so it can be re-run
freely.

**D7.** Two matching problems, not one:

- **Same-shape** — nearly deterministic. Twelve recitations of one description give
  twelve course lists with matching bearings and distances. Comparable as SRID:0 shapes
  with no anchoring at all. Probably catches the large majority of the 147/315.
- **Same-thing** — genuinely semantic. Recording references (book/page, instrument
  number) are the strongest signal; portions, amendments and releases need judgment.

Cheap deterministic clustering, then an agent adjudicates the residue — structurally the
same pattern as the AW training pipeline, over geometries instead of comments.

**D8.** Consolidation's output is **two things**: the feature set, *and the anchor
worklist* — a minimal covering set of frames. Twelve documents reciting Lot 7 collapse to
one anchor run.

That second output carries a judgment worth making deliberately: **prefer a frame that
contains something fittable.** An easement exhibit showing a bare strip has nothing to
match against the county ring and can only ride someone else's transform; a plat showing
the parent boundary *and* the easement anchors itself and carries the easement along.

### 4.4 ④ anchor — per frame, not per feature

A frame is the set of figures one document draws together, already placed relative to one
another; the transform applies to the whole frame at once. The car-wash run is the
illustration: **8 figures, 1 anchor**. So a feature picks its authoritative reading, that
reading lives in some frame, and anchoring that frame incidentally places every other
figure on it.

### 4.5 ⑤ geo — the located feature

`sir_put_anchored_geo`, widened per D3/D4.

### 4.6 What will not land on the first pass

By IG's reconstructability split, a meaningful share of features will come out with a
solid identity — recording reference, courses, corroborating copies — and **no position**:
the 27% defined relative to another document, and the 17% approximate sketches.

**D9.** A feature with no geometry is a first-class outcome, not a failure. `geo` (or the
feature table) must be able to represent *we know this easement exists, we know its
courses, we do not know where it is* rather than silently dropping it.

**D10.** The 27% are a **dependency graph, not a queue** — "a 25-foot strip along the east
line of Lot 20" cannot be placed until Lot 20 is placed. Dependency-ordered placement is
deliberately deferred (§8, P3). Trying to solve it in the first build is what turns this
into a six-month project.

---

## 5. Decoupling anchor-geometry from the SIR

**D11.** Introduce one small concept — an **anchoring target** = `{ ring(s), srid,
provenance }` — and let it be sourced three ways: from a SIR's `geo` rows (today's path,
unchanged), fetched live from the county layer, or supplied by a plan set that already
knows its parcel.

The three couplings in C2 are of very different difficulty:

| Coupling | Difficulty |
|---|---|
| **Target CRS** | Already solved. `--target-srid` exists; `spcs_lookup.py <county FIPS>` answers it with no SIR. |
| **Output destination** | Mechanical — this is D4. |
| **The fitting target** | The real one. `ringTargets` is what rung 3 fits against and what rung 2's ties attach to. |

But the fitting target is not really a *SIR* problem either — it is "we need this site's
county parcel polygon", and `arcgis_query.py` is a standalone script that fetches exactly
that **and returns `native_sr` in the same call**, answering the CRS question at the same
time. The SIR is simply the only thing that currently goes and gets one.

**Honest caveat.** For rung 1 (printed coordinates) the CRS genuinely *is* all you need —
the parcel ring only feeds a zone sanity-check and the quality metrics, both optional in
`AnchorTolerances`. But rung 1 is the 3-in-315 case. For the 51% that are
closed-shape-no-position, the ring *is* the anchor. So "decoupled from SIRs" and "needs a
parcel ring from somewhere" are the same sentence, and the work is sourcing the ring.

---

## 6. Site plan sets

**D12.** Plan sets need a **new reader** and reuse identify / place / publish unchanged.

What is the same: a sheet's drawn features, once read, are a shape in some local frame
that needs one similarity transform onto the county grid. The solver, the accuracy
classes, the metrics and the storage are all the same.

What is different, and unsolved:

- **The reading problem.** A building footprint, a curb return or a hydrant symbol is not
  metes-and-bounds prose. Reading them means sheet georeferencing — a scale bar plus a
  known point, or matching the drawn property line to the known parcel ring — then a
  pixel-to-ground transform. This is closer to the existing `preprocessing-v4` vision work
  than to `extract-geometry-v2`.
- **Point and line features.** Today's model is polygons. Hydrants and transformers are
  points; water mains and curbs are lines.
- **Proposed, not recorded.** A plan set shows what someone *intends to build*. That is a
  different epistemic category from a recorded easement, and §1.2's whole use case is
  measuring between the two — so the distinction has to survive into `geo`, not be
  flattened away.

---

## 7. The manual Cartographer path

Lower priority, but a **design constraint worth stating explicitly**: it must be possible
to upload a loose PDF into Cartographer, carry it as far down the pipeline as the data
allows, and see an anchored geometry on a map.

Where an automated producer fills a blank from a database lookup (which parcel? which
CRS? which ring to fit?), the manual path should **ask**. That is the forcing function
that keeps the pipeline's inputs explicit parameters rather than implicit SIR reads — the
same discipline that makes §5 and §6 possible.

**D13.** Test uploads need no special handling in the data model. A manual upload produces
*readings*, and readings are harmless; they only reach `geo` by being promoted to a
feature and anchored, which is gated. An explicit `origin` on `cartographer_files`
(`manual_upload` / `sir_pipeline` / `plan_set`) makes it self-describing rather than
inferred from `source_sir_artifact_id IS NULL`, but the separation of roles in D2 is what
actually does the work.

---

## 8. Granularity and priority

Grouped so slices can be peeled off one at a time. **The ordering principle: schema
decisions are cheap now and expensive later; runbooks can be built in any order.**

### P0 — Unblockers (small, and they gate everything else)

| | What | Why first |
|---|---|---|
| **P0a** | `geo` gets a project-level owner (D4) | Two-line migration today; a data migration later. Nothing behaves differently. |
| **P0b** | `geo` becomes derived-only (D3); `cartographer_files.origin` (D13) | Establishes the invariant before there is volume to clean up. |
| **P0c** | Fix the fit metric (C5 / winston#289 B3) | Nothing about auto-acceptance can be calibrated until the quality number is right for the 51% case. |

### P1 — The five-step SIR workflow

| | What | Notes |
|---|---|---|
| **P1a** | `triage-sir-geos` runbook (§4.1) | Independently valuable even if nothing else ships: first time the backlog and its cost are visible. No new tables, no change to the SIR runbook. |
| **P1b** | Run the existing extract + anchor by hand off the triage list | Proves the chain end-to-end on a real SIR. Knowingly accepts duplicates. |
| **P1c** | Feature identity + `consolidate-geos` (D2, D7, D8) | The biggest piece of new design. Depends on P0c for anything automatic. |

### P2 — Decoupling

| | What | Notes |
|---|---|---|
| **P2a** | The anchoring target (D11) | Lets an anchor run name its own ring and CRS. |
| **P2b** | The manual Cartographer path end-to-end (§7) | The test that proves P2a. |

### P3 — Dependency-ordered placement

Rung 2 (ties) in earnest, and features located relative to other features — the 27%
(D10).

### P4 — The consumer

The PostGIS tool surface for agents (§1.2), and a MapLibre viewer for auditing it.

### P5 — Plan sets

The new reader (§6). Blocked on P0a; everything else is additive.

---

## 9. Things to think about

Not decisions. Tensions worth carrying while the spec is iterated on.

1. **Feature identity must be stable across re-runs.** Once `geo` rows and anchors point
   at features, consolidation cannot rebuild its groupings from scratch each pass — it has
   to propose merges and splits against existing features. A wrong merge is silent and
   expensive. This is what makes consolidation an algorithm rather than a clustering
   script, and why it needs a HITL gate about *identity* where extraction's gate is about
   *readings*.
2. **Geometry has a vintage.** An easement is granted, amended, partially released,
   superseded by a replat. A feature is not just a shape, it is a shape *as of a date*,
   and title chains are exactly where SIRs operate. Today's model has no time dimension at
   all.
3. **Recorded versus proposed.** §6 again, from the other side: `geo` will hold both
   "what is recorded" and "what is drawn as proposed", and the headline use case measures
   between them. Conflating them would be a quiet correctness bug.
4. **Accuracy must survive into the tool surface.** If an easement is placed at
   `gis_fit` (±3 ft on the one measurement we have) and an agent computes a 2-ft setback
   violation, that is noise presented as a finding. `geo` carries `accuracy_class`; the
   tools must refuse or caveat accordingly.
5. **Triage is the product until extraction gets cheap.** At ~$40/document, full
   automation is not a goal to rush toward — it is a thing that becomes sensible when the
   per-document cost falls. The first honest number P1a will produce: *how many documents
   per site actually carry a reconstructable boundary?* If it is 8, automation is close;
   if it is 60, the triage list is the product for a long time.
6. **Units and grid-versus-surface discipline.** `ftUS` vs `ft` vs `m`, grid vs surface
   distances, combined scale factors. Already modelled at the reading layer; it has to
   survive consolidation when two readings of one feature disagree about units.
7. **Consolidation feeds back into triage.** Once Lot 7 is known to appear in 12
   documents, triage should stop recommending all 12 and start recommending the best copy.
   The second pass over a site should be much cheaper than the first.

---

## 10. Open questions

**Q1.** Does a feature live in its own table, or is `geo` itself the feature table with
readings pointing at it? The second is fewer moving parts; the first survives a feature
having no position (D9) more naturally.

**Q2.** What is a feature's identity key? Recording reference where one exists — but
what carries identity for an unrecorded exhibit, or a plan-set hydrant?

**Q3.** When consolidation re-runs and disagrees with itself, what is the merge/split
protocol, and what does a human see at the gate?

**Q4.** Where does the time dimension live (§9.2) — on the feature, on the reading, or
not at all in v1?

**Q5.** Does `geo` keep one row per feature, or one row per (feature, source) so that the
recorded easement and the plan set's depiction of it coexist? §1.2's use case may need
both.

**Q6.** How does a plan set get its anchoring target — the project's SIR parcel ring when
one exists, a live county fetch when it does not, or a georeference solved from the sheet
itself?

**Q7.** Is `project` really the right owner for `geo` (D4), or should it be the site /
parcel, with projects pointing at sites?

**Q8.** What does the agent tool surface look like — raw SQL against a view, a small set
of named RPCs, or an MCP server with a geometry vocabulary?

**Q9.** Should triage's skip decisions be per-document or per-(document, reason), and do
they survive a new SIR version over the same site?

**Q10.** Does consolidation run before anchoring only, or is a second post-anchor
reconciliation pass (two shapes that turn out to occupy the same ground) part of v1?

**Q11.** What is the backfill posture for the 34 existing SIRs and the one existing
anchored file? Stated intent: **no perfect backfill required.** Does anything need to be
re-derived at all, or does the new model only apply going forward?

**Q12.** Does the plan-set reader belong in Cartographer or in the preprocessing-v4
lineage, given that the vision machinery for reading sheets already lives there?

---

## 11. Out of scope

- Any implementation. This spec names no PRs and no migrations.
- True curves. Everything stays chorded, as in the anchoring spec §8.
- Automatic anchoring inside a SIR run — the SIR runbook is untouched by every phase here.
- Backfilling historical SIRs to the new model (Q11 may reopen this).
- A customer-facing map.

---

## Appendix A: evidence pointers

- **Prod counts (2026-10-08):** `geo` 44 rows (34 `county_api` / 8 `anchored` / 2
  `estimated`), all with `geom_local`; `cartographer_files` 1; `cartographer_geometries`
  8; `cartographer_anchors` 1; `sir_artifact` 2,597 `supporting_document` rows across 34
  SIRs; 28 of 34 SIRs have any `geo` row.
- **The one anchor run:** `e94fae93-b3b6-42e5-9a24-fd16c476bee1`, run slug
  `car-wash-anchor-1`, accepted 2026-09-28T19:15Z, `printed_coordinates` / `survey`,
  params `{theta_rad 0.000166, scale 1, k_units 1}`, IoU 0.9876, θ vs grid 0.0095°,
  `auto_accept_suggested: false` (C5).
- **Corpus survey:** IG report `2026-09-23-sir-geometry-source-survey`. Figures in §2.2
  are taken from its summary, classification distribution, by-site table and coordinate
  systems catalog; the per-SIR appendix tables were not read in full.
- **Schema:** `substation/supabase/migrations/20260807130000_geo_parcels.sql` (the
  `sir_id NOT NULL` cascade), `20260812000000_geo_optional_local.sql` (`geom_wgs84` became
  the required geometry), `20260918170000_cartographer_geometries.sql`,
  `20260925140000_cartographer_anchors.sql`.
- **RPCs:** `substation/supabase/functions/geo_helpers.sql` — `sir_parcels:14`,
  `geo_projected_srid:71`, `sir_add_parcel_geo:143`, `sir_put_anchored_geo:291`,
  `cartographer_anchor_decide:398`, `cartographer_mark_anchors_stale:451`,
  `sir_geo_in_srid:500`.
- **The SIR-free math layer:** `cartographer/src/lib/geometry/anchor.ts`, `AnchorInputs`.
- **The couplings:** `bureau/runbooks/anchor-geometry/steps/1.1-inputs/contract.test.ts`,
  `cartographer/runbooks/anchor-geometry/scripts/fetch.ts`.
- **Prior specs this one sits above:** `../geometry-extraction/DESIGN-SPEC.md`,
  `../geometry-extraction/evidence/DESIGN-SPEC.md`,
  `../geometry-placement/DESIGN-SPEC.md`,
  `../anchoring-geometries/DESIGN-SPEC.md` (winston#279, #281),
  `../anchoring-geometries/ANCHOR-RUNS-PLAN.md` (winston#283),
  `../anchoring-geometries/bugs/ANCHOR-RUN-1-BUGS.md` (winston#289).
