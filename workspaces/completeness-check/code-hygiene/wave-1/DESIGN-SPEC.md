# CC hygiene wave 1: item_id on the row, the runbook owns its envelope, one read model

**ID:** FEAT-75  
**Kind:** feature
**Status:** draft
**Version:** 1
**Date:** 2026-10-23
**Parent:** `../DESIGN-SPEC.md` (ARCH-7). This spec carries ARCH-7's S1, S2 and S5, the three slices that can start now and touch three different places. Later waves (S3; S4 with S6; S7) get their own spec once this one ships.
**Repos touched:** `cityhall-new` (one schema change on `review_comments` with a hand-written data migration; a read model under `src/lib/reviews/cc/`; the CC PDF data builder; one SQL function), `bureau` (lane B and amend write two columns; `build-review-comments.ts` copied under the runbook; a CC publisher module; 1.4-resolve copies named files; a replay harness)
**Repos NOT touched:** `workflows/completeness-check` (the legacy folder is copied from, never edited or deleted here), `inspector-general` (reads nothing this wave changes), `conductor2`, `dsd`, `claude-plugins`

Code read on 2026-10-23 at bureau `f191145ec0`, cityhall-new `dc5a87d`; prod `mgxqsrjutswbciyrltwd` queried the same day.

**Precedence.** Where this spec and an older one disagree, this spec and ARCH-7 v1.2 win: they carry the decisions Will made on 2026-10-23. In particular, ARCH-7 D1 (nullable `item_id`, CHECK scoped to the new label, best-effort backfill) supersedes FEAT-66 §6's note that `itemId` goes into the JSON; ARCH-7 P2 (renumbering is MINOR) supersedes FEAT-66 D14's PATCH list and its Q4 default; and the new label is `2026-10-completeness-check` (ARCH-7 D3).

---

## Problem

Three of ARCH-7's findings block everything after them, and each can be fixed now without changing what a customer sees.

1. **The item id is a string inside JSON** (ARCH-7 H1). `review_comments.output_json->'sourceFindings'->0->>'ref'` is the only identity a CC comment has. Amend (`runbooks/lib/review_amend.py:39-56`), cc-compare, Inspector General's comment map and cityhall's Source link (`src/lib/reviews/adapters/checklist.ts:309-315`) each parse it. The typed columns lane B could use are at their defaults on every runbook-era row (`publish_review.py:1963-1971` writes three fields). Of 13,205 CC rows, 12,651 have a ref and 554, all on the two 2026-03-27 UFCU reviews, have `sourceFindings: []`. No review has two rows with the same ref.
2. **The envelope is built and published by code the runbook cannot change** (H13, H14). 2.9-comments shells to `workflows/completeness-check/scripts/build-review-comments.ts` through `scripts/cc.py:111-116`; 3.1-publish calls lane B of `runbooks/lib/publish_review_cli.py` (`build_lane_b` `:317`, `publish_section_shape` `:365`, `amend_section_shape` `:474`), a path written for both `completeness_check` and `crc` (`publish_review.py:142-145`). 1.4-resolve copies the whole checklist dir into the run (`cc.py:374-377`), `source-citations.json` and both numbering TSVs included, and nothing says which files a run read.
3. **Three readers parse the same rows** (H11, H12). `adaptChecklist` and `adaptCompletenessCheck` share a core (`checklist.ts:137-145, 200-220`); `src/pdf/cc-report-data.ts` has its own types, `buildSectionSlugs` (`:67-84`), `normalizeStatus` (`:86-88`), `parseSheetReferences` (`cc-report-logic.ts:24-46`) and its own effective-verdict rule (`:181-196`). The landing counts by adapting every row and fetches the prior review to compute the delta by comment number (`review-landing.tsx:54-82`; `check-results.ts`), which ARCH-7 H5 shows is unstable across runs.

What already exists and is reused: `review_comments` carries label-scoped partial unique indexes (`supabase/schemas/public/tables/review_comments.sql`: `review_comments_annotated_number_uniq WHERE output_schema = '2026-09-annotated'`), so a label-scoped constraint is the house pattern; formal review's `august_review_discipline_counts` is the shape for a counts RPC; every CC run persists its step folders and each review records `reviewCommentsPath`, so a stored run can be replayed.

---

## 1. Decisions

**D1. The column, the index and the CHECK** (ARCH-7 D1). In `supabase/schemas/public/tables/review_comments.sql`:

```sql
"item_id"   text,
"group_id"  text,
CONSTRAINT review_comments_item_id_required
  CHECK (output_schema <> '2026-10-completeness-check' OR item_id IS NOT NULL)
…
CREATE UNIQUE INDEX review_comments_review_item_uniq
  ON public.review_comments (review_id, item_id) WHERE item_id IS NOT NULL;
```

Generated with `npx supabase@2.119.0 db schema declarative sync --no-apply -f cc_item_id`. No row carries the new label yet, so the CHECK governs nothing today and never depends on D2. Formal review and CRC rows stay null.

**D2. The backfill is a hand-written data migration, idempotent, best-effort.** One statement:

```sql
UPDATE public.review_comments rc
SET item_id = rc.output_json->'sourceFindings'->0->>'ref'
FROM public.reviews r
WHERE r.id = rc.review_id AND r.review_type = 'completeness_check'
  AND rc.item_id IS NULL
  AND coalesce(rc.output_json->'sourceFindings'->0->>'ref', '') <> '';
```

Expected: 12,651 rows. The 554 with no ref stay null. The migration's comment records the counts. It runs after D1's index exists, which is safe because the duplicate query is empty. A later migration (not this wave) rewrites composite refs to stable ids from FEAT-66 P2a's `intake-ids.tsv`.

**D3. Who applies it.** Will or Jason, from the PR's worktree before merge, per `AGENTS.md:111-127`; the dry-run must list exactly the two new migrations. No agent runs anything against prod.

**D4. Lane B and amend write the columns.** `publish_section_shape` adds `item_id` and `group_id` to every CC row it inserts: `item_id` = the comment's `sourceFindings[0].ref` (the composite ref until `intake-ids.tsv` exists in the run's checklist dir, then the stable id); `group_id` = the stem's id from `intake-groups.tsv` when present, else null. `amend_section_shape`'s upsert carries both. CRC's path through the same function writes null for both. `publish_review.py`'s section-shape docstring (`:1934-1940`) is updated to say so.

**D5. The envelope builder is copied under the runbook, not moved.** `workflows/completeness-check/scripts/build-review-comments.ts` and the modules it imports that 2.9 needs are copied to `runbooks/completeness-check/scripts/lib/`, and 2.9-comments calls the copy directly instead of `run_legacy`. The legacy folder is untouched: conductor-1 still runs it, and FEAT-60 froze it. Deleting it is a later wave's job, once nothing shells to it. Output is byte-identical (S3).

**D6. A CC publisher module owns the CC half of lane B.** `runbooks/completeness-check/scripts/publish.py` holds what is CC-specific: the envelope validation now in `review_comments_v2.py`, the slug rule, the row mapping (`publish_review.py:1885-1979`) and the amend match-and-merge (`review_amend.py`). `publish_review_cli.py` keeps the transport, the storage upload, the row insert, the metadata stamp and the amend upsert, and lane B keeps serving CRC unchanged. 3.1-publish calls the CC module, which calls the transport. Output is byte-identical (S3).

**D7. 1.4-resolve names its inputs** (ARCH-7 D15). It copies the guide files, `cc-item-title-mappings.tsv`, `true-comment-num-mapping.tsv`, the sidecars `intake-ids.tsv`, `intake-groups.tsv` and `version.yaml` when present, and the one overlay the request names (`commentNumberingMap`, `forceOutcomes`). It stops copying `source-citations.json` and `citation-overrides.json`. `resolved.json.inputs` lists every file copied with its sha256. Amend's tree-hash gate is unchanged this wave: `checklistsTreeHash` stays over the copied tree, so a run that copies fewer files hashes differently from one published before this wave, and amend refuses across that boundary, which is the existing rule for a changed tree. FEAT-66 D18's content hash is where that gets fixed.

**D8. The replay harness.** `cc.py replay --run <dir> --steps 2.9,3.1 --dry-run` re-executes those steps over a stored run folder pulled from storage, writes to a scratch dir, and prints a diff of `review-comments.json` and of the row payloads lane B would send against the review's published envelope at `reviewCommentsPath` and its rows in prod (read-only). It is the acceptance test for D5 and D6, and later waves reuse it.

**D9. One read model** (ARCH-7 D10). `src/lib/reviews/cc/read-model.ts` exports `ccReadModel(reviewId)` returning `{ groups: ChecklistGroup[], items, counts }` from the rows, the triage and the review row's `sections[]`. Identity is `coalesce(item_id, output_json->'sourceFindings'->0->>'ref')`, in one function. `adaptChecklist` and `adaptCompletenessCheck` become projections (keep N/A, drop N/A). `sections.ts`'s slugify is the one slugify. `cc-report-data.ts` reads the read model and keeps only `relativeCommentNumbers` and the `to-fix` rule; its own types, `buildSectionSlugs`, `normalizeStatus` and `parseSheetReferences` are deleted. The old label is the only one this wave reads.

**D10. Counts in SQL** (ARCH-7 D11). `supabase/schemas/public/functions/cc_review_counts.sql`: `cc_review_counts(p_review_id uuid)` returns per-group and overall totals by effective verdict (`verdict_override` else `status`, with the pre-cutover fold reproduced exactly as `rows.ts:130-144` has it, because this wave does not remove it) and the prior-review delta (fixed, regressed, new, gone) joined on `item_id` with the JSON fallback. SECURITY INVOKER; the caller's RLS applies. The landing calls it instead of adapting every row; `reviews.metadata` counts are never displayed.

**D11. Nothing a customer sees changes.** Same groups, same order, same titles, same numbers, same PDF. S5's parity test is the proof.

---

## 2. Testing seams

**S1: `pnpm test:db` on `review_comments`** (existing seam, new file `tests/db/review-comments-item-id.test.ts`)
- **Proves:** D1: a row on the new label without `item_id` is refused; a row on the old label or on a formal-review label with null is accepted; two rows with the same `(review_id, item_id)` are refused; `writeAs("workflow_run", …)` can insert with the columns. D2: the backfill statement on a fixture of mixed rows fills the ones with a ref, leaves `[]`-ref rows null, and is idempotent.
- **Prior art:** `tests/db/intake-figures.test.ts`, `tests/db/child-table-rls.test.ts:104-122`.
- **Runs:** local Supabase stack, `check` CI job.

**S2: lane B's and amend's Python tests** (existing seam, new cases)
- **Proves:** D4: a published CC row carries `item_id` = the ref and `group_id` from a fixture `intake-groups.tsv`, null without one; a CRC row carries null for both; the amend upsert body carries both. D6: the CC module's output for a fixture envelope equals the old lane B's, field for field.
- **Prior art:** `runbooks/lib/test_publish_review_cli.py`, `test_review_amend.py`, `test_review_comments_v2.py`.
- **Runs:** `pytest runbooks/lib`, locally and in bureau CI.

**S3: the replay harness over stored runs** (new, D8)
- **Proves:** D5, D6: for the current reviews of 2008 San Antonio (`0bc96434`), WhiteWater (`28b83857`) and Lamar + Collier (`85fd5bd2`), replaying 2.9 and 3.1 through the copied builder and the CC module produces an envelope and row payloads byte-identical to what was published, apart from the two new columns. D7: `resolved.json.inputs` lists exactly the named files.
- **Prior art:** `runbooks/completeness-check/scripts/test_cc.py` (the run-folder fixtures at `:124-200`), `steps/1.4-resolve/contract.test.ts`.
- **Runs:** `python3 scripts/cc.py replay …` by the implementing session against stored runs; the diff is pasted into the PR. The 1.4-resolve contract test runs in CI.

**S4: the 1.4-resolve and 2.9-comments contracts** (existing seam, new cases)
- **Proves:** D7: the contract refuses a run dir holding `source-citations.json`; accepts one with the sidecars; `resolved.json.inputs` has a sha256 per file. D5: 2.9's contract is unchanged and still passes on the copied builder.
- **Prior art:** `steps/1.4-resolve/contract.test.ts`, `steps/2.9-comments/contract.test.ts`.
- **Runs:** `node scripts/run-tests.mjs` in the runbook, locally and in bureau CI.

**S5: cityhall vitest, parity of the read model** (existing seam, new files)
- **Proves:** D9: for a fixture set drawn from the 64 CC reviews (one per label era: a March, an April, a July pre-cutover, a July post-cutover and an October review), `ccReadModel` equals the old adapters' output, and the new `cc-report-data` equals the old one's report data. D10: `cc_review_counts` equals the numbers `readCheckResults` computes today on the same fixtures, including the pre-cutover fold. D11 follows.
- **Prior art:** `src/lib/reviews/adapters/checklist.test.ts`, `sections.test.ts`, `check-results.test.ts`, `counts.test.ts`, `src/pdf/cc-report-logic.test.ts`.
- **Runs:** `pnpm test` (vitest) and, for the RPC, `pnpm test:db`.

---

## 3. PR plan

**P1: `item_id` and `group_id` on `review_comments`, with the backfill** — `cityhall-new`
- **Blocked by:** nothing (can start now).
- **Delivers:** D1's schema change and generated migration; D2's data migration; S1's test; `supabase/rls-isolation-allowlist.txt` unchanged (no new table). Lands D1, D2, D3.
- **Tested at:** S1.
- **Door:** two-way for the columns (drop them); the backfill is reversible by `SET item_id = NULL` on the backfilled rows, and the source JSON is untouched.
- **Blast radius:** none until something writes or reads the columns. Applied by Will or Jason (D3).

**P2: lane B and amend write the columns** — `bureau`
- **Blocked by:** P1 applied to prod (the insert fails on an unknown column otherwise).
- **Delivers:** D4; the docstring; S2's cases. From the next CC publish, every row carries `item_id`.
- **Tested at:** S2.
- **Door:** two-way.
- **Blast radius:** every CC and CRC publish and amend, which is why S2 covers the CRC null case.

**P3: the builder under the runbook and the CC publisher module** — `bureau`
- **Blocked by:** nothing technical; sequenced after P2 so one replay diff covers both.
- **Delivers:** D5, D6, D8: the copied `build-review-comments.ts` and its imports under `scripts/lib/`, 2.9 calling it directly, `scripts/publish.py`, 3.1 calling it, the replay harness, the three replay diffs pasted into the PR.
- **Tested at:** S2 (field-for-field), S3 (byte-for-byte), S4 (2.9's contract).
- **Door:** two-way (restore the `run_legacy` call and the lane B call).
- **Blast radius:** every CC publish. The replay diff on three stored runs is the gate.

**P4: 1.4-resolve names its inputs** — `bureau`
- **Blocked by:** P3 merged (the replay harness is how D7 is checked against stored runs).
- **Delivers:** D7; `resolved.json.inputs`; the contract cases.
- **Tested at:** S3, S4.
- **Door:** two-way.
- **Blast radius:** amend across the boundary: a review published before P4 has a different `checklistsTreeHash` from a run after it, and amend refuses, as it does today for any tree change. Noted in the PR; fixed by FEAT-66 D18.

**P5: the CC read model and the PDF on it** — `cityhall-new`
- **Blocked by:** nothing (can start now, in parallel with P1; it reads the old label and falls back to JSON identity).
- **Delivers:** D9: `src/lib/reviews/cc/read-model.ts`, the two adapters as projections, the single slugify, `cc-report-data.ts` on the read model with its parser deleted; S5's parity fixtures and tests. Lands D11 for the page and the PDF.
- **Tested at:** S5.
- **Door:** two-way.
- **Blast radius:** every CC landing, panel, search result and PDF. The parity fixtures are the gate; a visual check of three PDFs before and after is in the PR.

**P6: counts in SQL** — `cityhall-new`
- **Blocked by:** P1 applied (the delta joins on `item_id`), P5 merged (the landing calls the RPC through the read model).
- **Delivers:** D10: `cc_review_counts.sql`, the generated migration, grants, the landing switched to it, `readCheckResults`'s adapt-everything path deleted; S5's RPC cases.
- **Tested at:** S5 (`pnpm test:db` for the function).
- **Door:** two-way (the old path is one commit back).
- **Blast radius:** the landing's numbers and the prior-review delta. Applied by Will or Jason (D3).

**P7: update ARCH-7** — `winston`
- **Blocked by:** P1 to P6 merged and applied.
- **Delivers:** ARCH-7's D1, D10, D11, D14 and D15 tags flip from `proposed` to `shipped by FEAT-75`; §2.2, §2.4 and §2.5 refreshed; the **Verified** line and **Amended by** updated; the architecture page's delta map moves the three boxes from After to Today.
- **Door:** n/a.

Frontier at the start: P1 and P5 together, P3 after P2.

---

## 4. Open questions

- **Q1. Does the replay harness live in `cc.py` or as its own script?** `cc.py` already has the step entry points and `effective_options`; a `replay` subcommand reuses them. Default: in `cc.py`.
- **Q2. Does P5 ship before or after P1 applies?** They are independent; P5 works with null `item_id` through the fallback. Default: whichever is ready, P5 need not wait.
- **Q3. Does the CC module keep the `2026-03-completeness-check` label name as a constant it owns, or import it from `publish_review.py`?** The next wave adds a second label; owning it in the CC module now saves one move later. Default: the CC module owns both CC labels; `publish_review.py` keeps CRC's.

## 5. Not yet specified

- The exact file list `build-review-comments.ts` pulls in (`checklist-policy.ts` is certain; `consolidate-logic.ts` probably); the implementing session reads the imports and copies what 2.9 needs, nothing more.
- Whether `cc_review_counts` also serves the project overview's review card, which today counts the April format differently (`src/lib/overview.ts:66-69`).

## 6. Out of scope

- **Deterministic titles, order and numbers** (ARCH-7 S3): the next wave. This wave's 2.9 copy keeps reading the 2.8 agent's file.
- **The new schema label and the slim row** (S4), **archiving formats and the fold** (S6), **read-time presentation** (S7).
- **The other legacy scripts.** This wave copies only `build-review-comments.ts` and `block-number-gate.ts`. Still shimmed after it: `cross-run-consolidate-cc.ts` (2.2), `apply-forced-outcomes.ts` (2.3), `prepare-uncertain-explanation-inputs.ts` (2.4), `collect-uncertain-explanations.ts` (2.6), `enrich-findings.ts` + `checklist-policy.ts` (2.7), `validate-output.ts` (2.10) and `semantic-search-blocks.ts` (the 2.1 agent's search tool via `bin/search.sh`). They move in ARCH-7 S8 after S4, and the folder is deleted there. The implementing agent does not widen this wave to them.
- **Rewriting composite refs to stable ids**: the second backfill, after FEAT-66 P2a.
- **Inspector General**: nothing this wave changes is read by it; the blob and the storage envelope are untouched.

## Appendix A: evidence pointers

- bureau: `runbooks/completeness-check/scripts/cc.py` (`run_legacy :111-116`, checklist copy `:374-377`, `legacy_args_comments :620`, 2.9 call `:652`, 3.1 `:665-671`), `runbooks/lib/publish_review_cli.py` (`build_lane_b :317`, `publish_section_shape :365`, `amend_section_shape :474`), `runbooks/lib/publish_review.py` (`:142-145`, `:1885-1979`), `runbooks/lib/review_amend.py`, `runbooks/lib/review_comments_v2.py`, `workflows/completeness-check/scripts/build-review-comments.ts`
- cityhall-new: `supabase/schemas/public/tables/review_comments.sql`, `AGENTS.md:111-127`, `src/lib/reviews/adapters/{checklist,sections}.ts`, `src/lib/reviews/{check-results,counts,rows}.ts`, `src/components/reviews/review-landing.tsx:54-82`, `src/pdf/{cc-report-data,cc-report-logic}.ts`, `supabase/schemas/public/functions/august_review_discipline_counts.sql`
- prod: `review_comments` 13,205 CC rows, 12,651 with a ref, 554 without (reviews `65771d9c`, `ed8ab616`); current reviews `0bc96434`, `28b83857`, `85fd5bd2`
