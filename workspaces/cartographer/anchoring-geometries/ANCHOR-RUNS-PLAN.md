# Cartographer — the first anchor runs (P2 exit test)

**Status:** Draft v1, a handoff plan for a fresh session
**Date:** 2026-09-28
**Executes:** [`DESIGN-SPEC.md`](DESIGN-SPEC.md) (winston#279 v1, #281 v2) §3.6 `anchor-geometry` runbook, §3.8 accuracy measurement, §4 P2 exit test
**Repos touched by the session:** none structurally. It runs the merged runbook, writes rows to prod `cartographer_anchors` and `geo`, and revises the spec (a winston PR, v3). Bug fixes it finds go up as ordinary PRs.
**Prod:** Supabase **Noetic App** (`mgxqsrjutswbciyrltwd`)

> **In one paragraph.** Everything the anchoring spec designed is merged and applied to prod. What is left is to *use* it: run the `anchor-geometry` runbook on three real documents, rule on each transform at its gate, and write the measured accuracy into the spec as v3. The three cases were chosen in the spec because each exercises a different rung of the solver: the car-wash plat has printed coordinates (`survey`), Palm Bay Lot 7 has a grid basis of bearings and a Web Mercator county layer (`gis_fit` with θ ≈ 0 as the check), and the Conroe tract has neither (`gis_fit` where the rotation is a real unknown and the ambiguity metric matters). Nothing here is automatic; the session is the run's captain and the operator rules at every gate.

---

## 1. Where things stand (verified 2026-09-28)

Read this before the runbook README, because the README was written before any of it existed.

| Piece | State |
|---|---|
| Code | Every P0a–P2 PR is merged: surveyor#426, bureau#1812/#1813/#1815, substation#307/#308/#309/#310, cartographer#29/#30/#31/#33. |
| Prod schema | substation migrations `20260925131000`, `132000`, `140000` applied; `geo_helpers.sql` applied (7 functions, `service_role` only). |
| County rings | Every `geo` county parcel row has `geom_local`/`srid_local` (Q11 backfill, substation#314). So `fetch.ts` resolves `target_srid` from the parcel rows on every SIR below; the `--target-srid` flag should not be needed. |
| Car-wash plat | Re-extracted 2026-09-28 (bureau `extract-geometry-v2`, run slug `car-wash-2024178771-run5`). Its 8 figures now carry `basis_of_bearings` (grid, KY Single Zone NAD83(2011)), `distance_units` ftUS, `grid_or_surface` grid, and `control_points` (8 on LOT 1, 4 each on LOT 2, LOT 3 and the three R/W areas). `cartographer_anchors` is empty. |
| Palm Bay, Conroe | Not in Cartographer yet. Each needs an import and an extraction run before its anchor run (§3, §4). |
| Measurement so far | One number, from a hand-built fixture (spec §3.8): on the car-wash lot the county-ring fit sits a uniform 2.9 ft from the printed-coordinate solve. The three runs replace that with pipeline numbers and add two more counties. |

## 2. What the session does, in order

1. **Car-wash anchor run** (§3). The only case that can run today. Proves the `survey` rung on the real pipeline.
2. **Palm Bay Lot 7**: import → extraction run → anchor run (§4).
3. **Conroe tract**: import → extraction run → anchor run (§4).
4. **Spec v3** (§6): §3.8 gains a table per case; Q8/Q9/Q12/Q13 get answered or re-opened from what the runs showed.

Each run is its own go from the operator. Each gate is the operator's ruling. Never fire a run, a publish or a prod write while it is still being discussed.

## 3. The car-wash anchor run

**Inputs.** `cartographer_files.id = bebccffa-baaa-444e-a800-2b760f90ef78`; SIR `caac753c-128b-4311-8d10-2480be0268eb` (the Louisville car-wash SIR, whose two county rows carry `srid_local = 3089` and whose hand-built `traverse` rows are the 3089 spec's answer key). `target_srid` resolves to 3089 from the parcel rows.

**Request** (`1.1-inputs/request.json`, schema in `bureau/runbooks/anchor-geometry/steps/1.1-inputs/contract.test.ts`):

```json
{ "schema_version": 1,
  "file": "bebccffa-baaa-444e-a800-2b760f90ef78",
  "sir_id": "caac753c-128b-4311-8d10-2480be0268eb",
  "target_srid": null,
  "anchor_run_slug": "car-wash-anchor-1",
  "scope_note": "First anchor run. The plat prints State Plane coordinate boxes at the lot corners (control_points on LOT 1, LOT 2, LOT 3 and the three R/W areas) and states a grid basis (KY Single Zone NAD83(2011)). Expect frame-1 to solve at rung 1 (printed coordinates, class survey). The cross-access easement figure is open by 40.6 ft on the plat itself (two sides never printed); it rides on the frame and anchors nothing by itself." }
```

**Launch** through the `conductor` skill (`conductor init $BUREAU/runbooks/anchor-geometry $RUN`, then `advance`). Read §5 first: three of its gotchas cost this session an hour.

**What each step should show.**
- `1.2-fetch`: `inputs/target.json` says `target_srid: 3089, source: 'parcel_rows'`; `inputs/parcels.json` carries the SIR's county rows (and the hand-built plat rows, `method` traverse/estimated) transformed by `sir_geo_in_srid`; anchored rows are excluded. `inputs/geometries.json` has one frame with 8 figures and `control_points` on six of them.
- `2.1-correspond` (agent): `correspondences.json` names, per frame, `ring_matches` (LOT 1 ↔ the 4403 Fegenbush parcel, LOT 2 ↔ 4401, or `union_of` if the county drew them as one), `control_points` for the boxed corners, and leaves the two easements `within`. Ids and indices only; a number in the file fails the contract on purpose.
- `3.1-solve`: `anchors.json` frame-1 with `solver: printed_coordinates`, `accuracy_class: survey`, residuals under 1 ft (the P1 fixture gave 0.14–0.31 ft), IoU against the county rings about 0.97, `thetaVsGridDeg` about 0.006°. If it demotes to `ring_fit`, read `notes` and `demoted_from` before doing anything else: a demotion here means a control point was mis-attributed at 2.1 or a box was misread at extraction.
- `3.2-render` / `3.3-check`: the overlay shows the lots on the county rings; the check's `check.md` is the readout.
- `4.1-hitl`: the operator accepts or rejects frame-1. Rejecting draws nothing. Accepting writes 8 `geo` rows with `method='anchored'`, `srid_local = 3089`, `geom_local` authoritative.
- `5.1-publish`: `publish.json` lists the anchor id and the geo ids.

**Verify in prod** after publish: one `cartographer_anchors` row (`status accepted`, `method printed_coordinates`, `accuracy_class survey`, `params` with five numeric keys), 8 `geo` rows for the SIR with `method='anchored'` and `properties.anchor_id` set, and `sir_parcels(sir)` returning them (the SIR map draws them with no cityhall change).

**The measurement.** Compare the anchored LOT 1/2/3 rings against the hand-built 3089 rows (`kind` `supporting_doc_2024178771`, `method` traverse) vertex by vertex, and against the county rings by IoU. Then, for the spec's §3.8 experiment, re-run `3.1-solve` with the control points removed from `correspondences.json` (a scratch copy, not the run's surface) so the frame solves at rung 3, and record the per-vertex gap between the two solves. That is the pipeline's version of the 2.9 ft number.

## 4. Palm Bay Lot 7 and the Conroe tract

Both need three runs each: import, extraction, anchor.

**Import** (cartographer#29): `bun run runbooks/extract-geometry/scripts/import-sir-artifact.ts <sir_artifact_id>` from the cartographer checkout, with `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment. It hashes the object, reuses an existing `cartographer_files` row with that hash (oldest wins), else inserts one with `source_sir_artifact_id` and `project_id`. stdout's last line is the file id; `--dry-run` writes nothing. PDFs only.

| Case | SIR | Source document (`sir_artifact.id`) | Why this one |
|---|---|---|---|
| Palm Bay Lot 7 | `5602b5c8-78f0-4a5c-93ef-7fde9285c70a` (Brevard FL; two county rows `parcel-1`, `parcel-2`, `srid_local` 2881 from the county table because BCPAO's layer is Web Mercator) | `482e0648-9fdd-427e-aff2-82d36291775b` `04-bayside-lakes-office-park--lot-7-alta-survey.pdf` (880 KB; version 1 of the same bytes is `db1bf4ac-…`, the importer dedupes) | The spec's case: an ALTA survey with a FL East NAD83(2011) grid basis, so `fitToRing` should give θ ≈ 0 and the D8 grid check is meaningful. |
| Conroe tract | `352a4345-4121-41a2-8101-68426d02cc0c` (Conroe Marketplace, Montgomery TX; one county row, legal description "PARTIAL REPLAT NO 1 … (FILE # 2006-054841)", `srid_local` 2278) | `d1705459-990d-4033-ab06-0b1218546fbc` `Plat - No. 2006054841 - 2006-05-18.pdf` (12 MB), the replat the parcel's own legal description cites | A TxDOT right-of-way-map basis, no grid: θ is a real unknown, so this run tests the rotation candidates and the ambiguity metric. If that plat proves to be several sheets of context, the two `Right-of-Way Instrument` documents (`6cce6e45-…`, `97c41a29-…`) are the fallback tracts. Confirm the pick against the IG survey's `data.json` (spec §1.5), which lists every geometry per artifact with its basis of bearings. |

**Extraction** (bureau `extract-geometry-v2`, one local conductor run per file): follow what the car-wash re-extraction did on 2026-09-28. Expect 30–60 minutes of Opus 5.5 vision per document, about $40 list-equivalent of subscription drain, no metered spend. The `6.2-hitl` gate takes `publish | reread | stop`; publish replaces the file's figures (none exist yet for these two). Read the readout for the four anchoring fields before publishing: on Palm Bay the basis must come out `grid` with a zone; on Conroe it should come out `row_map` or `record_plat`, and a `grid` there is a misread worth a re-read of the notes region.

**Anchor run**: as §3, with the new file id and the case's SIR. Expected outcomes: Palm Bay solves at rung 3 (`gis_fit`) with `thetaVsGridDeg` near 0 and the readout saying so; Conroe solves at rung 3 with a measured θ and an `ambiguity` value worth recording (a rectangle-ish tract will show a 180° twin near 1.0, which is the point).

## 5. Gotchas from the first runs (2026-09-28)

These are the things that were not in any README.

- **Claude Code version.** Every bureau runbook names `opus-5.5`, which needs Claude Code ≥ 2.1.280. The Homebrew `claude-code` cask lags (2.1.274 on 2026-09-28); the working install is `brew uninstall --cask claude-code && brew install --cask claude-code@latest` (2.1.283). The failure looks like `API Error: 400 … does not support this model` on the first agent step, billed $0.
- **`with-secrets` has no credentials folder on Will's Mac.** It refuses to run rather than fall back. Run `conductor` directly; the ambient environment already holds `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The runbook scripts need both.
- **`$RUN/.env` from `conductor init` sets `CONDUCTOR_SEAT_CMD='dsd seat pick'`**, and the local `dsd` has no `seat` verb. Remove that line and append `RUN`, `SUBSTATION_URL`, `BUREAU`, `SURVEYOR`, `DSD`, `NOETIC_SKILLS_DIR`, `CARTOGRAPHER` and `RUNBOOK_RUN_ID` instead.
- **Never put a `scratch/` folder at a family step's root** (`2.1-survey/scratch`, `3.1-transcribe/scratch`): the family contract allows only one folder per item and fails the whole step. Readouts for your own escalations go under the run root or `strays/`.
- **The failure watcher from the conductor skill sees nothing when a step dies at launch** (no `step.exit` event is written). Read the advance output directly.
- **A ruling in chat still has to be recorded on the gate** with `runbook_hitl_cli.py answer --question-id … --status … --decided-by …`; then `await-answer` writes `decision.json`. The question id comes from `gates --gate <step>`.
- **`assemble.ts` misreads curve-table rows in its verbatim check** (takes the delta angle's minutes as the chord distance) and reports false MISMATCHes; the readings are right. A small cartographer fix is due; until then, treat curve-row mismatches in a readout as noise unless closure disagrees.
- **Cost.** Subscription only, no `--max-budget-usd` needed while every preset is `harness: claude`. The `SEAT ESTIMATE` line in `conductor status` is list price, not a bill.

## 6. What to write back into the spec (v3)

A winston PR on a `spec/cartographer-anchoring-geometries-v3` branch, per the `winston-spec` skill. Bump to Draft v3 with a revision note, and:

- **§3.8**: one table per case (the car-wash table already there becomes "fixture" beside a "pipeline" column): solver, class, θ vs grid, IoU, mean boundary distance, Hausdorff, ambiguity, residuals, and for the car-wash the per-vertex gap between rung 1 and rung 3. State the county-drawing error each case implies.
- **§4** P2 row: mark the exit test done, with the three anchor ids.
- **Open questions**: Q8 (replats: did `union_of` come up, and did the operator want an auto-reject?), Q9 (chords: did `has_approximated_curves` matter to any fit?), Q12 (did any frame demote, and was demotion the right call?), Q13 (did a `tied` anchor occur; was 10 ft the right county-linework tolerance?). Answer what the runs answered; leave the rest open with what was learned.
- **D11**: whether the proposed auto-accept thresholds (IoU ≥ 0.9, mean distance ≤ 5 ft, ambiguity < 0.8) would have agreed with the operator on all three, or need moving.

## 7. Out of scope

Automatic anchoring inside the SIR run, batch triage, the cityhall viewer with accuracy styling, and true curves (spec §8). Fixing the `assemble.ts` curve-row parser is a separate small PR, not this session's run.
