# Lamar + Collier v4 — Partial Reprocess Plan

> **Status:** Draft, 2026-07-09. Companion to [`DEV-PLAN.md`](./DEV-PLAN.md).
> Describes a targeted, one-off operation to convert an *already-processed*
> submission version to `block_numbering_scheme = 'short-id-ordered'` so its
> CRC/CC evidence chips can deep-link to specific blocks — without paying for a
> full `process-file` reprocess.
>
> **Not yet executed.** This is a plan; kicking it off is gated on operator
> approval and on the downstream repos (conductor/bureau/cityhall) being
> deployed with the evidence-chips code.

---

## 1. Goal

Make the **Lamar + Collier** site-plan submission **version 4** render as
`short-id-ordered` so that, on the next CRC/CC run, its evidence chips carry a
validated `blockNumber` and the cityhall modal highlights the cited block.

Concretely: for every `sheet_version` under v4's plan set(s), set
`block_numbering_scheme = 'short-id-ordered'` **and** regenerate its
`reading_guide` against short_id block numbering — atomically, per sheet.

## 2. Subject

| Field | Value |
|---|---|
| Project | Lamar + Collier |
| `project_id` | `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` |
| `submission_id` | `cf1201c2-2e8b-4034-9a5e-a70b6317e39a` |
| `submission_version.version_number` | 4 |
| `submission_version_id` (from DEV-PLAN §6, **verify against DB**) | `6b9b85ed-e992-4906-a222-b24ee836910c` |

> The `submission_version_id` above is the one recorded in `DEV-PLAN.md` §6 for
> "site_plan v4, Lamar + Collier". Re-confirm it (and enumerate v4's plan
> set(s) / `plan_set_version_id`(s)) against the live DB before running —
> a submission version can reference more than one plan set.

## 3. Why not a full reprocess

The obvious lever — substation's `POST /api/projects/:projectId/plan-sets/:planSetId/process`
(re-sends the `process-file` event for the latest `plan_set_version` using the
stored source PDF) — is the wrong tool here:

- **Copy-path partial conversion.** `processPlanSet` fetches a prior version
  (`fetchPriorVersion` → most-recent *other* submission version = v3) and diffs
  against it. Sheets **unchanged** vs v3 are *copied*, inheriting
  `block_numbering_scheme: priorSheet.block_numbering_scheme`
  (`plan-set.logic.ts:145`). Since v3 is legacy, those sheets **stay legacy**.
  Only sheets that *changed* vs v3 get freshly generated and stamped
  `short-id-ordered`. A single re-run of v4 therefore yields a **mixed** plan,
  not a fully deep-linkable one.
- **Expensive.** Re-runs optimize → rasterize → split → per-sheet
  block-discovery → similarity → reading-guide (up to a 60-min timeout), and
  regenerates content_blocks — far more work than we need.
- **No working UI path.** Both cityhall reprocess endpoints
  (`plan-set/[planSetId]/reprocess`, per-sheet `.../reprocess`) are currently
  `501` stubs ("being migrated to Substation") and point at a `/reprocess`
  path that doesn't match substation's `/process`. So there is no
  click-a-button route today regardless.
- **Deployment coupling.** The endpoint only stamps `short-id-ordered` if prod
  substation is running the merged writer (#127).

## 4. Chosen approach — standalone reading-guide regen + scheme flip

Run substation's `sheet-reading-guide` step (`sheet.ts:216-268`) **in
isolation**, directly against each of v4's `sheet_version` rows. Everything the
step needs already exists on a processed v4:

- `sheet_version.storage_path` — the per-sheet split PDF (already there)
- `content_block` rows with backfilled `short_id`s (already there)
- `generateReadingGuide(pdf, blocksContext)` + `buildBlocksContext` — substation's
  own functions

### Per-sheet operation (mirrors `sheet.ts:216-268`)

For each `sheet_version` under v4's plan set(s):

1. Fetch the sheet PDF from `sheet_version.storage_path`.
2. Fetch its `content_block`s ordered by `short_id ASC` (`nullsFirst: false`).
3. `buildBlocksContext(blocks)` — numbers the "Block N" labels by `short_id`.
4. `generateReadingGuide(pdfBase64, blocksContext)` — **one LLM call**.
5. **Guard:** proceed to `short-id-ordered` only when the fetch succeeded and
   *every* block has a non-null `short_id`
   (`!blocksError && blocks.every(b => b.short_id != null)`). Otherwise log and
   leave the row legacy (fail-safe).
6. Atomic update:
   ```sql
   UPDATE sheet_version
      SET reading_guide = :guide,
          block_numbering_scheme = 'short-id-ordered'
    WHERE id = :sheetVersionId;
   ```

### Why this beats the full reprocess

- **Skips the heavy pipeline** — one LLM call per sheet, nothing else.
- **No copy-path problem** — targets v4's sheet_versions directly (no
  prior-version diff), so it converts **all** of v4's sheets regardless of
  whether they changed vs v3.
- **Doesn't require prod substation redeployed** — the script carries the new
  logic itself. (Conductor/bureau/cityhall still must be deployed for the
  *downstream* to consume the flag; the flip itself does not depend on it.)

## 5. Why the regen is load-bearing (not a flag-only flip)

Flipping `block_numbering_scheme` **without** regenerating the guide is a bug,
not a shortcut:

- v4's existing `reading_guide`s were written against the **old
  category-alphabetical** numbering ("Blocks 2, 3, 4 — Boilerplate…").
- Conductor's project-downloader uses the scheme flag to number `blocks.md` by
  `short_id`. After a flag-only flip, `blocks.md`'s "Block N" (short_id) and the
  guide's "Block N" (category order) point at **different** blocks.
- The bureau gate validates a cited `blockNumber` against the sheet's *entire*
  `validBlockNumbers` set — so a guide-misdirected citation is "valid but
  wrong" and passes the gate. That is exactly the precise-but-wrong failure the
  scheme-versioning design (DEV-PLAN §3.4) exists to prevent.

So step 4 (regen) and step 6 (flip) must happen together, atomically.

## 6. Prerequisites & guards

- **short_id coverage.** Confirm every content_block on every v4 sheet has a
  non-null `short_id` (they were backfilled Phase 1, so this should hold; the
  guard in step 5 enforces it per-sheet regardless).
- **Downstream deployed.** For the flip to actually surface deep-links, the
  merged conductor / bureau (#531 gate, #532 schema) / cityhall (#576) code
  must be deployed. The flip can be done earlier, but it's inert until then.
- **Fresh CRC/CC run.** The block numbers only reach `review_comments` on a
  *new* review run over v4 after the flip — existing review rows are not
  back-annotated.
- **Scope.** Enumerate v4's plan set(s) first; apply to the sheet_versions of
  each `plan_set_version` linked to v4's `submission_version_id`.

## 7. Execution

- **No standalone endpoint/event exists** for the reading-guide step (it only
  lives inside the `process-file` Inngest function). This requires a **one-off
  script** that imports/replicates `sheet.ts:216-268` and loops over v4's
  sheet_versions.
- The script needs: prod Supabase (service-role) for the block fetch + atomic
  update, storage read for `storage_path`, and an Anthropic/Gemini key for
  `generateReadingGuide`.
- **Idempotent-ish:** safe to re-run; each run regenerates the guide (new LLM
  output) and re-stamps the scheme.

## 8. Cost / scope

- **1 LLM call per sheet** (reading-guide generation). Total ≈ (# sheets in
  v4's plan set(s)) calls. Look up the sheet count before running to size it.
- No rasterize/split/block-discovery cost.

## 9. Verification

**Before:**
- Confirm `submission_version_id` for v4 and its `plan_set_version_id`(s).
- Count sheet_versions and confirm short_id coverage (guard will pass on all).

**After:**
- `block_numbering_scheme = 'short-id-ordered'` on every targeted sheet_version.
- Spot-check a regenerated `reading_guide` — its "Block N" references should
  match the short_id ordering.
- Run a conductor project-downloader against v4 and confirm `blocks.md` is
  short_id-numbered and `block-manifest.json` lists `validBlockNumbers` for the
  converted sheets.
- Run a fresh CRC/CC review; confirm evidence chips carry `blockNumber` and the
  cityhall modal highlights the block.

## 10. Rollback / risk

- The regen **overwrites** the existing legacy `reading_guide` (not versioned).
  Intended — the legacy-numbered guide is what we're replacing — but note there
  is no automatic restore; a bad run is fixed by re-running.
- Reverting a sheet to legacy would require restoring the old guide text and
  setting `block_numbering_scheme = 'legacy-category-order'`. Capture the
  pre-flip `reading_guide` values in the script's log if a rollback path is
  wanted.
- Fail-safe by design: any sheet failing the step-5 guard is left legacy, never
  half-converted.

## 11. Open items

- [ ] Verify v4 `submission_version_id` + enumerate `plan_set_version_id`(s).
- [ ] Confirm short_id coverage across v4 sheets.
- [ ] Confirm conductor/bureau/cityhall are deployed before relying on output.
- [ ] Write the one-off regen script (imports `generateReadingGuide` /
      `buildBlocksContext`, loops v4 sheet_versions, applies steps 1-6).
- [ ] Decide whether to snapshot pre-flip guides for rollback.

---

## References

- Main plan: [`DEV-PLAN.md`](./DEV-PLAN.md) (§3.1 column, §3.2 writer + stamp
  guard, §3.3 conductor branching + manifest, §3.4 gate)
- Reading-guide step: `substation/src/inngest/functions/process-file/sheet.ts:216-268`
- Copy-path scheme inheritance: `substation/.../plan-set.logic.ts:145`
- Re-process endpoint (the path we're *avoiding*):
  `substation/src/routes/plan-sets.ts` — `POST /:planSetId/process`
