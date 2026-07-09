# Lamar + Collier v4 — Partial Reprocess Plan

> **Status:** Draft, 2026-07-09 (updated same day after a prod-DB + repo-state
> audit). Companion to [`DEV-PLAN.md`](./DEV-PLAN.md).
> Describes a targeted, one-off operation to convert an *already-processed*
> submission version to `block_numbering_scheme = 'short-id-ordered'` so its
> CRC/CC evidence chips can deep-link to specific blocks — without paying for a
> full `process-file` reprocess.
>
> **Not yet executed.** This is a plan; kicking it off is gated on operator
> approval. The downstream evidence-chips code is fully merged as of
> 2026-07-09 (substation #127, conductor #215, bureau #531 + #532, cityhall
> #576) and is assumed deployed by execution time — see §6.

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
| `submission_version_id` (**verified against prod DB 2026-07-09**) | `6b9b85ed-e992-4906-a222-b24ee836910c` |
| `plan_set_version_id` (v4 has exactly **one** plan set) | `e9111f12-a156-4ed1-9446-8770de2407b4` |
| `plan_set_id` | `908ffab5-9bf8-4155-b9f7-b3c3be0663ff` |
| sheet_versions | 57, all `processed` (49 modified / 5 added / 3 unchanged) |

> Verified against the prod DB 2026-07-09: v4 (created 2026-05-11, status
> `draft`) references exactly one plan_set_version. Its 57 sheets carry
> **447 content_blocks — zero null `short_id`, zero null `bounding_box`,
> short_ids unique and contiguous 1..N per sheet** (v4 was processed
> 2026-05-11, before the 2026-07-01 Phase 1 backfill, which covered it).
> All 57 rows have a `reading_guide` and a `storage_path` (storage
> spot-check passes), every guide references "Block N" (so the regen in §5
> is genuinely load-bearing), and `block_numbering_scheme` is live in prod
> with all 57 rows at `legacy-category-order`. Trivia: the stored
> `change_summary` says "51 modified, 3 added" but the sheet rows say
> 49/5 — the sheet-comparison step re-classifies unrelated sheets after
> the summary is written; harmless.

## 3. Why not a full reprocess

The obvious lever — substation's `POST /api/projects/:projectId/plan-sets/:planSetId/process`
(re-sends the `process-file` event for the latest `plan_set_version` using the
stored source PDF) — is the wrong tool here:

- **In-place re-run, still a mixed result.** For v4 the "latest
  plan_set_version" is v4's own, which already has 57 sheet_version rows —
  so `createSheetManifestV2` takes its early-return path
  (`plan-set.logic.ts:108-122`): nothing is diffed against v3 and nothing
  is copied. The 54 modified/added sheets are re-processed **in place**
  (`needsProcessing = change_type !== 'unchanged'`) and the 3 unchanged
  sheets are **skipped entirely** — their reading_guides are never
  regenerated, so they stay legacy. A single re-run of v4 therefore still
  yields a **mixed** plan, not a fully deep-linkable one. (The
  `fetchPriorVersion` → copy-path scheme inheritance
  (`plan-set.logic.ts:145`) that an earlier draft of this section blamed
  only governs the creation of a *new* plan_set_version — e.g. a future
  v5 — not a re-run of an existing one.)
- **Destroys block identity.** Re-processing a sheet re-runs block
  discovery, which **deletes and regenerates every content_block** on it
  (`sheet.logic.ts:81`) — a fresh, nondeterministic vision pass producing
  new row ids, new bounding boxes, new transcriptions, new short_ids on
  54 of 57 sheets. v4's current blocks are verified good (§2), so the
  re-roll buys nothing, would have to be re-vetted sheet by sheet, and
  orphans the block references implicit in v4's existing run history.
  The partial approach leaves all 447 blocks untouched.
- **Expensive.** Re-runs optimize → rasterize → split → per-sheet
  block-discovery → similarity → reading-guide (up to a 60-min timeout) —
  far more work than we need.
- **No working UI path.** Both cityhall reprocess endpoints
  (`plan-set/[planSetId]/reprocess`, per-sheet `.../reprocess`) are currently
  `501` stubs ("being migrated to Substation") and point at a `/reprocess`
  path that doesn't match substation's `/process`. So there is no
  click-a-button route today regardless.

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
- **No endpoint dependency** — the script carries the logic itself, so it
  doesn't depend on what substation has deployed. (Substation #127 is merged
  anyway; the full deployment picture lives in §6.)

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

- **short_id coverage — verified 2026-07-09.** All 447 content_blocks across
  v4's 57 sheets have non-null, per-sheet-unique, contiguous `short_id`s
  (§2). The guard in step 5 still enforces this per-sheet at run time.
- **Downstream code state (verified 2026-07-09).** Everything is merged:
  substation #127 (writer + both migrations — the scheme column is live in
  prod), conductor #215 (scheme branching + block-manifest), bureau #531
  (gate) and #532 (schema + prompt, merged 2026-07-09), cityhall #576
  (modal). Conductor is cloned fresh from GitHub main into each cloud run's
  sandbox, so merged = live for Inngest runs. Assume all merged code is
  deployed by execution time; the one residual pre-flight is confirming the
  prod substation Vercel deployment includes #127 — a stale substation
  deploy processing a future v5 would copy v4's regenerated (short-id)
  guides while stamping the legacy default and inserting NULL-short_id
  blocks.
- **Hard ordering: scheme-aware conductor BEFORE the flip.** An earlier
  draft claimed a pre-deployment flip was "inert until then" — wrong. A
  flip against a scheme-blind conductor is actively harmful: every
  post-flip CRC/CC run would render blocks.md category-ordered while the
  regenerated guides reference short_id numbering — the §5 mismatch
  inverted, on all 57 sheets, silently degrading review accuracy. Conductor
  #215 being merged satisfies this for cloud runs. Residual echoes of the
  same hazard: a **local** conductor run must use a checkout that includes
  #215, and the surveyor mirror (`noetic-vej`) hasn't landed —
  surveyor-built workspaces for this project will render mismatched
  numbering until it does (off the review critical path).
- **Fresh CRC/CC run.** The block numbers only reach `review_comments` on a
  *new* review run over v4 after the flip — existing review rows are not
  back-annotated.
- **Run-history comparability — accepted trade-off.** v4 is the active CC
  test article (six completeness-check runs on 07-07/07-08, four CRC runs
  in June). The regen replaces all 57 guides with fresh LLM output —
  different prose, today's prompt/model vintage — so post-flip runs are not
  comparable with that series. Accepted deliberately: **accuracy of future
  runs outranks comparability across past v4 runs.** The corollary is that
  what must not go wrong is the regenerated guides themselves — hence the
  mandatory snapshot (§10), the per-sheet guards (§7), and the §9 spot
  checks.
- **Scope — resolved.** v4 has exactly one plan_set_version (§2); the script
  targets its 57 sheet_versions.

## 7. Execution

- **No standalone endpoint/event exists** for the reading-guide step (it only
  lives inside the `process-file` Inngest function). This requires a **one-off
  script** that imports/replicates `sheet.ts:216-268` and loops over v4's
  sheet_versions.
- The script needs: prod Supabase (service-role) for the block fetch + atomic
  update, storage read for `storage_path`, and `AI_GATEWAY_API_KEY` —
  `generateReadingGuide` resolves `google/gemini-3.1-pro-preview` through the
  Vercel AI Gateway.
- **Script guards** (beyond the step-5 short_id guard):
  - **Never clobber on a bad generation.** Refuse the UPDATE if
    `generateReadingGuide` returns an empty or suspiciously short guide —
    an LLM hiccup must not overwrite a known-good legacy guide.
  - **Zero-block sheets.** `[].every(...)` passes vacuously, so a sheet
    with no content_blocks would stamp `short-id-ordered` on an empty
    context. v4 has none (§2), but skip-and-log explicitly rather than
    rely on that.
  - **Per-sheet outcome log + nonzero exit on any failure**, so a partial
    run is visible, not silent.
- **Partial-failure window.** ~57 sequential LLM calls; an interrupted run
  leaves the plan set mixed legacy/short-id. Downstream stays correct
  per-sheet (scheme + manifest are per-sheet), but the remedy is re-run to
  completion — and don't fire a CRC/CC run, or any reprocess, while the
  script is mid-flight.
- **Idempotent-ish:** safe to re-run; each run regenerates the guide (new LLM
  output) and re-stamps the scheme.

## 8. Cost / scope

- **1 LLM call per sheet** (reading-guide generation). Total = **57 calls**
  (one per sheet_version; verified 2026-07-09).
- No rasterize/split/block-discovery cost.

## 9. Verification

**Before:**
- IDs / counts / short_id coverage — verified 2026-07-09 (§2): one
  plan_set_version, 57 sheets, 447/447 blocks with valid short_ids. Re-run
  the coverage query at execution time if meaningful time has passed.
- Confirm the prod substation deployment includes #127 (§6).
- Snapshot the 57 pre-flip rows (§10) — the script must do this before its
  first UPDATE.

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
- **Mandatory snapshot (decided 2026-07-09).** Before its first UPDATE the
  script writes `(sheet_version_id, sheet_number, reading_guide,
  block_numbering_scheme)` for all 57 rows to a timestamped JSON file. The
  regen is destructive and LLM output is nondeterministic — without the
  snapshot, the exact guides behind v4's existing run history are
  unrecoverable. Rollback = restore the guide text and set
  `block_numbering_scheme = 'legacy-category-order'` from the snapshot.
- Fail-safe by design: any sheet failing the step-5 guard is left legacy, never
  half-converted.

## 11. Open items

- [x] Verify v4 `submission_version_id` + enumerate `plan_set_version_id`(s)
      — done 2026-07-09 (§2): one plan set, psv `e9111f12-…`, 57 sheets.
- [x] Confirm short_id coverage across v4 sheets — done 2026-07-09:
      447/447 non-null, unique, contiguous (§2/§6).
- [x] Confirm conductor/bureau/cityhall code is in — all merged as of
      2026-07-09 (bureau #532 last); assume deployed at execution time.
      Remaining pre-flight: prod substation deploy includes #127 (§6).
- [ ] Write the one-off regen script (imports `generateReadingGuide` /
      `buildBlocksContext`, loops v4's 57 sheet_versions, applies steps 1-6
      plus the §7 guards and the §10 snapshot).
- [x] Snapshot pre-flip guides — decided 2026-07-09: mandatory (§10).

---

## References

- Main plan: [`DEV-PLAN.md`](./DEV-PLAN.md) (§3.1 column, §3.2 writer + stamp
  guard, §3.3 conductor branching + manifest, §3.4 gate)
- Reading-guide step: `substation/src/inngest/functions/process-file/sheet.ts:216-268`
- Manifest early-return governing a re-run of an existing plan_set_version:
  `substation/.../plan-set.logic.ts:108-122`
- Copy-path scheme inheritance (new-version path only, e.g. a future v5):
  `substation/.../plan-set.logic.ts:145`
- Block delete-and-regen on reprocess: `substation/.../sheet.logic.ts:81`
- Re-process endpoint (the path we're *avoiding*):
  `substation/src/routes/plan-sets.ts` — `POST /:planSetId/process`
