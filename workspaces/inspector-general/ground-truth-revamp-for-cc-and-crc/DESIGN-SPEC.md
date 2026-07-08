# Ground Truth Evals Revamp for CC and CRC

**Status:** Draft v2 — revised after codebase/DB audit
**Date:** 2026-07-08
**Repos touched:** `inspector-general` (compute, UI, Inngest, DAL), `substation` (SQL migrations)
**Repos NOT touched:** `bureau`, `conductor`, `cityhall`

> **Revision note (v2).** This revision folds in an audit that verified every factual
> claim below against the live code and the production DB (project `mgxqsrjutswbciyrltwd`).
> Material changes from v1:
> - **`ig_review_runs.review_type` is NOT added.** `reviews.review_type` is authoritative and
>   already available at runtime on both the compute path (the review row is loaded there) and the
>   read/UI path (the layout already exposes it). We branch on it directly and reconcile the two
>   divergent Inngest reviewType derivations. (Reverses v1 decision Q13.)
> - **CRC rows are sourced from the crc-guides checklist in storage, not from emitted comments.**
>   This makes CRC symmetric with CC (one row per atomic item) and makes a *missed* atomic item
>   visible (recall), instead of only scoring emitted comments (precision-only). (Q3 reaffirmed, Q20 new.)
> - **`not-applicable` is a first-class CRC status** (4-state consolidated), not a legacy fallback. (Q17 revised.)
> - **The UI work is a real refactor**, not a config toggle: a shared `<EvalTable>` component driven by a
>   `ColumnDescriptor` registry, replacing the 1846-line monolith and the duplicated detail-page table.
>   Sequenced to keep formal review byte-identical. (Q21 new; see "Shared table component".)
> - **Metrics stay deferred by design.** Ground Truth Evals is a human-review/labeling surface: an
>   annotator supplies verdicts, the lead reads them (plus cityhall's override) and decides actioning.
>   Agreement %/confusion matrix can come later without changing what we capture now. (Q22 new.)
> - Factual corrections: the review workflow has no `consolidate-logic.ts`; the legacy status column
>   renders `unclear` (a raw `nv` falls through to `—`); `verdict_override` shipped 2026-07-07;
>   `enrichedFinalComment` is a top-level `output_json` field; the fixed-column count is 7 **or** 8.

## Problem

Inspector General's Ground Truth Evals feature (`/review/[reviewId]/ground-truth-evals`) was built
for formal reviews (`reviews.review_type = 'review'`). It now runs against completeness-check
reviews (`'completeness_check'`) and needs to support comment-resolution-check reviews (`'crc'`),
but the schema, compute pipeline, and UI all bake in formal-review assumptions:

1. **CRC has zero IG wiring.** The Inngest trigger pattern
   (`on-workflow-completed.ts:31`) is
   `^(review(-\d+(\.\d+)*)?|review-wip|completeness-check)$` — `comment-resolution-check` never
   fires post-processing. Confirmed in prod: 5 `crc` reviews, 0 `ig_review_runs`, 0 eval rows.
   Deeper than the trigger: the compute path builds rows from **bureau training data** keyed by the
   review's `department_code`, but CRC's `department_code = 'crc'` has no bureau department, so the
   row loop yields zero rows. CRC needs a different row source: its per-project atomic checklist,
   generated from the MCR into the `crc-guides` storage bucket.

2. **CC eval data in prod is wrong, not just misfit.** Row status is derived via a legacy
   severity heuristic (`ground-truth-eval.ts:157-159`: severity 1→`nv`, 2→`unclear`, else→`fail`)
   built for the old formal-review schema. Prod CC eval rows contain `unclear` (not a CC status) and
   contain **no `warn` or `uncertain` at all**, even though both are now first-class. The real
   consolidated status, `tentativeStatus`, `voteBreakdown`, and `confidence` all exist in
   `review_comments.output_json` and are never read. Verified in the backfill window (CC reviews
   `created_at >= 2026-07-05`, 6 reviews / 1,293 comments): **1,100 comments carry `voteBreakdown`,
   257 are `uncertain` (with `tentativeStatus`), 23 are `warn`** — all currently mis-rendered.

3. **`caught_in_review` is trivially true for CC.** CC emits a comment for every checklist item,
   so e.g. review `ae7cb127` has all 194 rows `caught_in_review = true` and `caught_by_city` all
   null. Two of the (7-or-8) fixed UI columns are pure noise for CC. (For CRC we *keep* the signal —
   see the CRC compute section — because CRC can genuinely leave an atomic item unaddressed.)

4. **No first-class status on `ig_eval_data`.** Status lives only as `commentStatus` inside the
   `review_comment_refs` JSONB (first ref wins, `supabase-backend.ts:236-242`). Filtering and
   analytics on status are awkward and get worse with three vocabularies.

5. **Human verdict overrides are ignored.** `comment_triage.verdict_override` (shipped 2026-07-07)
   is a human-corrected verdict per review comment — the strongest available ground-truth signal for
   CC/CRC — and IG doesn't surface it. In prod today: **25 non-null overrides on CRC comments, 9 on
   CC** (0 on formal).

6. **Formal review's own status column is stale.** It renders `unclear` from the legacy severity
   mapping (and a raw `nv`, which no longer maps to any label, falls through to `—`); the current
   review workflow's consolidated vocabulary is `fail` / `not-verifiable`.

## Goals

- Ground Truth Evals works correctly for all three review types with a UI **driven by
  `review_type`**, built on a shared, config-driven table component (see "Shared table component").
- The eval row's status becomes first-class, in each workflow's own vocabulary, including
  `uncertain` (the post-run vote-determined status for CC and CRC).
- Human ground truth is captured as a **verdict** ("agent said `failed`, I say `resolved`") instead
  of a double-negative correctness grade — for CC and CRC.
- Cityhall's `verdict_override` is displayed (read-only, live-queried) alongside the agent verdict.
- Formal review's status derivation is fixed in the same pass.
- CRC evals cover the **full atomic checklist**, so an atomic item the agent never addressed is
  visible (recall), not just the comments it emitted.
- Backfill: CC reviews from 2026-07-05 onward, and all CRC reviews.

### Intended workflow (why there is no metric in scope)

This is a human-review surface, not an automated scoreboard. A ground-truth annotator opens a
review, reads each agent verdict (plus votes and cityhall's User Verdict), and records **their own
verdict** and notes. The eng lead then reads those human verdicts and decides what needs actioning.
Precise agent↔human agreement metrics (agreement %, confusion matrix) are **deliberately out of
scope** — they can be layered on later against the same captured verdicts without changing the data
model. Capturing the verdict in each workflow's own vocabulary now is what keeps that door open.

## Non-goals

- No changes to the workflows themselves (bureau/conductor) or to cityhall.
- No confusion-matrix / agreement-metrics page (listed under Future ideas).
- No migration of `review_comment_refs` string refs to UUIDs beyond adding the new
  `review_comment_id` column (the string refs remain for RFC deep links).
- Auditor modules (citation/clarity/atomicity/verdict) are unchanged; this spec is only the ground
  truth eval system.
- Full support for **legacy `review`-type reviews with duplicate `comment_number`s** (a Feb-2026
  batch — 1,467 duplicate `(review_id, comment_number)` pairs, all in `review_type='review'`). For
  those, `review_comment_id` resolution is best-effort and may be null/ambiguous. Acceptable
  (formal review does not use the live `comment_triage` join). See Q19.

---

## Status vocabularies (reference)

| | Formal review (`review`) | Completeness check (`completeness_check`) | Comment resolution check (`crc`) |
|---|---|---|---|
| Agent per-run | `fail`, `not-verifiable` | `pass`, `fail`, `warn`, `not-applicable` | `resolved`, `failed` (`not-applicable` legacy per-run) |
| Consolidated (displayed) | `fail`, `not-verifiable` | + `uncertain` (5-state) | + `uncertain` **and `not-applicable`** (4-state) |
| `uncertain` trigger | n/a | `totalRuns >= 3` and winner share `<= 1 − 0.35` (≤ 0.65) | same |
| `tentativeStatus` | n/a | set only when `uncertain` | set only when `uncertain` |
| `voteBreakdown` keys | n/a | `pass`,`fail`,`warn`,`not-applicable`,`missing` | `resolved`,`failed`,`not-applicable`,`missing` |
| Extra prose | — | `uncertainExplanation` (+ `agentTraceUncertainExplanation`) | `enrichedFinalComment` (top-level) |

Source of truth: `bureau/workflows/*/scripts/` and the `review_comments.output_json` they persist —
specifically:
- **review:** `review/scripts/cross-run-consolidate.ts` (per-run + consolidated `fail`/`not-verifiable`)
  and `merge-structured-comments.ts`. *(There is no `review/scripts/consolidate-logic.ts`.)*
- **completeness-check:** `completeness-check/scripts/consolidate-logic.ts` and `build-review-comments.ts`.
- **comment-resolution-check:** `comment-resolution-check/scripts/consolidate-logic.ts` and
  `build-crc-review-comments.ts`.

The CC and CRC `consolidate()` gates are byte-identical (min 3 runs, winner share ≤ 0.65,
`DEFAULT_UNCERTAIN_THRESHOLD = 0.35`); `missing` votes (`totalRuns − present votes`) count as dissent
in the denominator, so heavy run attrition can itself drive `uncertain`.

**`not-applicable` for CRC is first-class.** New bureau CRC runs currently emit a 2-state per-run
enum (`resolved`/`failed`), but the *consolidated* type is `resolved | failed | not-applicable |
uncertain`, `not-applicable` remains a valid `voteBreakdown` key, and 17 prod CRC comments across 3
reviews carry consolidated `not-applicable`. IG therefore treats `not-applicable` as a normal CRC
status everywhere (proper badge, status filter, and the "Your Verdict" picker). A later bureau patch
to emit `not-applicable` first-class per-run does not change anything in IG.

**Other legacy values (render-only, never writable):**

- `reviews.review_type = 'formal'` — 13 rows. Treated as an alias of `'review'` at read time
  everywhere in IG. No data migration.
- Any unexpected status string renders the same way: neutral gray badge with the raw value.

---

## DB schema changes

Migrations live in **`substation/supabase/migrations/`** (verified: `substation`'s baseline
`00000000000000_baseline.sql` defines `ig_review_runs`, `ig_eval_data`, `ig_eval_annotations`,
`comment_triage` in the same "Noetic App" database; `cityhall/supabase/migrations/` no longer
exists). Note: `inspector-general/DB-overview.md` is stale (still points at the deleted cityhall
path) and should be corrected as part of this work.

### `ig_review_runs` — no change

`review_type` is **not** denormalized here (v1 Q13 reversed). It is read at runtime from `reviews`
(the review row is already loaded on the compute path via `resolveReviewMetadata`, and the UI already
reads `metadata.reviewType` from the layout at `+page.svelte:19`). See "Inngest changes" for
reconciling the two current reviewType derivations onto `reviews.review_type`.

### `ig_eval_data`

```sql
ALTER TABLE public.ig_eval_data
  ADD COLUMN agent_determined_status text,
  ADD COLUMN uncertain_tentative_status text,
  ADD COLUMN vote_breakdown jsonb,
  ADD COLUMN review_comment_id uuid REFERENCES public.review_comments(id) ON DELETE SET NULL,
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ALTER COLUMN caught_in_review DROP NOT NULL;

CREATE INDEX idx_ig_eval_data_review_comment_id
  ON public.ig_eval_data(review_comment_id) WHERE review_comment_id IS NOT NULL;
CREATE INDEX idx_ig_eval_data_agent_status
  ON public.ig_eval_data(agent_determined_status);
```

Column semantics:

| Column | review | completeness_check | crc |
|---|---|---|---|
| `agent_determined_status` | `fail` / `not-verifiable` | 5-state | 4-state; **null when the atomic item was never addressed** |
| `uncertain_tentative_status` | null | `tentativeStatus` when uncertain | same |
| `vote_breakdown` | null | `voteBreakdown` when multi-run | same |
| `review_comment_id` | matched comment UUID (best-effort; null if not caught / ambiguous) | comment UUID | comment UUID (null for not-addressed rows) |
| `caught_in_review` | as today | **null** (trivially true) | **populated** (true = comment emitted; false = atomic item not addressed → recall miss) |
| `caught_by_city` | as today | null (unchanged) | null |
| `code_citation` | as today | as today | `codeCitation` from the guide (`—` → null) |
| `metadata` | `{}` | `{}` | `{parentCommentId, severity, evidenceExpected}` |

Notes:
- The existing (undocumented) `bureau_checklist_item_id` column stays **null for CRC** (no bureau
  version exists) and is not conflated with the new `review_comment_id`.
- `review_comment_refs` JSONB is retained unchanged (RFC deep links, back-compat), but
  `commentStatus` inside it is no longer the status source — `agent_determined_status` is.
- `caught_in_review` is made nullable for the CC case; CRC uses it as a real recall signal even
  though the "Caught in Review" *column* is hidden for CRC (it feeds the header stat and a filter).
- The upsert key stays `(ig_review_run_id, checklist_item_id)` (`supabase-backend.ts` `saveEvalData`).
  For CRC, `checklist_item_id = ${grouping}:${atomicItemId}` — verified unique per review (all 5 CRC
  reviews: comments == distinct atomicItemIds, zero nulls), so no upsert collision.

`embedding` / `embedding_text` behavior is unchanged and **extends to CC and CRC** rows
(decision Q14): embedding text is built from the deficiency/requirement text as today. Backfill will
generate embeddings for ~7,881 existing CC rows + ~1,150 CRC rows — size the embedding step / rate
limits accordingly.

### `ig_eval_annotations`

```sql
ALTER TABLE public.ig_eval_annotations
  ADD COLUMN verdict text
  CHECK (verdict IN ('pass','fail','warn','not-applicable','resolved','failed'));
```

- The DB check is the **union** of legal values; per-type narrowing is enforced in the API layer and
  UI (CC picker: `pass|fail|warn|not-applicable`; CRC picker: `resolved|failed|not-applicable`).
  `uncertain` is deliberately excluded — never user-writable (decision Q2).
- `comment_correct` / `citation_correct` remain, used **only for formal review** rows. `verdict` is
  used only for CC/CRC rows. `notes` applies to all types.
- Existing unique constraint `(ig_eval_data_id, user_id)` and RLS are unchanged.
- Backfilled CC reviews may carry pre-existing `comment_correct`/`citation_correct` annotations from
  the old model; those columns are hidden for CC going forward, so those values become inert (only
  `notes` still surfaces). This is accepted — the human verdict for CC/CRC starts empty and is filled
  by re-labeling.

### What is deliberately NOT stored

`comment_triage.verdict_override` (the cityhall human override, aka **"User Verdict"**) is
**live-queried at read time**, never copied into `ig_*` tables (decision Q5 — it changes out from
under us). Join: `ig_eval_data.review_comment_id = comment_triage.review_comment_id`
(`comment_triage` is unique on `review_comment_id`).

---

## Compute pipeline changes (`src/lib/compute/ground-truth-eval.ts`)

`computeGroundTruthEvalData` branches on `review_type` (read from `reviews.review_type`, `'formal'` →
`'review'`).

### Formal review (`review`) — fixed derivation

- Row source: unchanged (bureau training data checklist items, `findingId = ${grouping}:${ci.id}`).
- **Delete the severity heuristic** (`ground-truth-eval.ts:157-159`, severity → `nv`/`unclear`/`fail`).
  New derivation, in order:
  1. Detail-level `runComments` consensus in the current vocabulary (`fail` / `not-verifiable`), via
     `review_checklist_comment_map` → `review_comments.output_json`.
  2. Consolidated finding status from the review workflow's stored consolidated output when storage
     outputs exist. *(Confirm the exact artifact filename at implementation — the review workflow's
     consolidation lives in `cross-run-consolidate.ts`/`merge-structured-comments.ts`; do not assume
     a `consolidated-findings.json` name without checking the storage layout.)*
  3. Fallback `fail` when the item is caught but no status is resolvable.
- Populate `agent_determined_status` and `review_comment_id` (resolved via `review_id` +
  `comment_number`). **Best-effort for legacy `review` rows** with duplicate `comment_number`s: leave
  `review_comment_id` null on ambiguity rather than guessing (Q19). Vote columns stay null.
- `caught_in_review` / `caught_by_city` semantics unchanged.
- Old reviews whose stored data still says `nv`/`unclear`/`pass` are handled by the render-only
  fallback badge; recompute fixes any review it's re-run on.

### Completeness check (`completeness_check`)

- Row source: unchanged (bureau CC training data — one row per checklist item, e.g. `cc-1:CC-1-02`).
- Status source: the matched `review_comments.output_json` directly — `status` (5-state),
  `tentativeStatus`, `voteBreakdown`. No inference, no clamping in IG: the workflow already applied
  the Fail Status policy clamp pre-vote; IG stores what the product displays.
- `caught_in_review` → null, `caught_by_city` → null. The scoring.json path is skipped (gated by the
  existing `isCompletenessCheck`).
- `review_comment_id` populated for every row.

### Comment resolution check (`crc`) — new path (rows sourced from the crc-guides checklist)

Mirrors CC (one row per checklist item, comments matched on), but the checklist denominator comes
from storage instead of bureau training data. This is what makes a *missed* atomic item visible.

1. **Derive the guide location (no recomputation).** Read `reviews.metadata->'crcGuides'`:
   `{ bucket: 'crc-guides', prefix: '{projectId}/{submissionId}/{u0VersionNumber}/{crcGenerationNumber}/' }`
   — present and populated on all 5 prod CRC reviews. (Fallback if ever absent: replicate
   `bureau/workflows/comment-resolution-check/scripts/fetch-crc-guides.ts` — submission_version →
   submission → project, highest generation dir.)
2. **Fetch + parse the atomic checklist (the denominator).** List `crc-*.md` under the prefix (skip
   `decisions.md`, `ignored-comments*.md`, and the JSON/PDF sidecars). Each guide has a
   `## Checklist Items` markdown table. **Parse by column name, not index** — two header variants:
   - MCR guides (`crc-{dept}.md`, incl. split `-1/-2/-3` parts): `ID | Parent Comment | Requirement
     to verify resolved | Code Citation | Severity | Evidence expected | Evidence form`.
   - Redline guides (`crc-{dept}-redlines.md`): `ID | Requirement to verify resolved | Code Citation
     | Severity | Evidence expected` (no Parent Comment; each row is its own parent).

   Per row emit `{ atomicItemId (col ID), parentCommentId, requirement, codeCitation, severity,
   evidenceExpected }`. (Authoritative format spec:
   `claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/references/output-format.md` and
   its redlines sibling.)
3. **Grouping / finding_id.** Compute the grouping by **stripping a trailing `-{digits}`** from the
   guide basename (`crc-CA-1` → `crc-CA`; `crc-aw-redlines` kept as-is), then
   `finding_id = ${grouping}:${atomicItemId}` (e.g. `crc-CA:CA-3.2`). This is required and verified:
   emitted comments' `output_json.sourceFindings[].ref` use the *stitched* grouping even where the
   guide file was split, so this makes `finding_id` equal the comment ref and matches the CC
   `${groupingName}:${ci.id}` convention. Write `checklist_item_id = finding_id`,
   `checklist_item_text = requirement`, `code_citation = codeCitation` (`—` → null).
4. **Match comments by atomic item.** Join each row to the review's comments on the atomic item —
   directly on `review_comments.output_json->'crc'->>'atomicItemId'` (bare `CA-3.2`), or equivalently
   on the stitched ref. atomicItemIds embed the dept prefix and are unique per review, so the match
   is unambiguous. From a matched comment's `output_json`, populate:
   - `agent_determined_status` = `status` (`resolved`/`failed`/`uncertain`/`not-applicable`)
   - `uncertain_tentative_status` = `tentativeStatus`, `vote_breakdown` = `voteBreakdown`
   - `metadata` = `{parentCommentId, severity, evidenceExpected}` (from the guide, or `output_json.crc`)
   - `review_comment_id` = the comment's UUID; `caught_in_review = true`
5. **Recall gap.** An atomic item with **no** matching comment still gets a row:
   `agent_determined_status = null`, `review_comment_id = null`, `caught_in_review = false`. The UI
   renders this as "not addressed" (see UI) and the header stat counts it. (In gen 6, guide count ==
   emitted count == 291, so there is no gap in current prod — but the design must not depend on that.)
6. **Fallback (degraded).** If a guide file for a grouping is missing/malformed, source that
   grouping's items from the distinct `atomicItemId`s present in `review_comments` (loses recall
   visibility — only emitted items appear) and `log()` the degradation. Never fail the whole run.
- Embeddings generated from the requirement text, same as other types.

### Read path (`GET /api/ground-truth-eval-data`)

- `assembleRows()` returns the new fields on `GroundTruthEvalRow`:

```typescript
export interface GroundTruthEvalRow {
  findingId: string;
  deficiency: string;                       // requirement text for CRC
  codeCitation?: string;
  agentStatus?: string;                     // agent_determined_status (undefined = not addressed, CRC)
  tentativeStatus?: string;                 // uncertain_tentative_status
  voteBreakdown?: Record<string, number>;   // vote_breakdown
  reviewCommentId?: string;                 // review_comment_id (UUID)
  userVerdictOverride?: string;             // live-joined comment_triage.verdict_override
  caughtInReview?: boolean | null;          // null for CC; true/false for CRC (recall); as-is for review
  caughtByCity?: boolean | null;
  crcMeta?: { parentCommentId: string; severity: string; evidenceExpected: string };
  reviewCommentRefs?: ReviewCommentRef[];
  annotations?: Record<string, UserAnnotation>;  // UserAnnotation gains `verdict?`
}
```

- This type is currently **declared twice** (`src/lib/data/types.ts` and re-exported from
  `src/lib/eval-data-store.svelte.ts`, which both pages import). Unify them (single source in
  `types.ts`) as step 1 of the refactor — see "Shared table component".
- The read handler makes one additional query per page load: `comment_triage` rows for the review's
  comment UUIDs → `userVerdictOverride` per row. Missing triage row or null override → `—`.
- `review_type` for column selection comes from the layout metadata the page already loads
  (`+page.svelte:19`); no new column needed.

### Annotation write path (`PATCH`)

- `UserAnnotation` gains `verdict?: 'pass'|'fail'|'warn'|'not-applicable'|'resolved'|'failed'`.
- The API validates `verdict` against the run's `review_type` vocabulary (CC:
  `pass|fail|warn|not-applicable`; CRC: `resolved|failed|not-applicable`) and rejects `verdict`
  writes on formal-review runs.
- Empty-annotation deletion logic now considers `verdict` alongside
  `comment_correct`/`citation_correct`/`notes`.

---

## Inngest changes (`src/lib/inngest/functions/on-workflow-completed.ts`)

1. Trigger pattern gains CRC:
   `^(review(-\d+(\.\d+)*)?|review-wip|completeness-check|comment-resolution-check)$`
2. **Reconcile reviewType to a single source.** Today two derivations coexist and can disagree — a
   `workflowName` ternary at `:95` (used for the bureau-checklist step) and `metadata.reviewType`
   from the `reviews` join at `:288` (used for eval compute). Make both read
   `reviews.review_type` (`'formal'` → `'review'`; `comment-resolution-check` workflow → `crc`), so a
   run can't populate as one type and compute as another.
3. **Per-type step gating** for the post-processing pipeline (the current ~9-step pipeline; 11
   `step.run` invocations counting the merged bureau step + 4 auditor sub-steps — finalize
   mechanically at implementation):

| Step | review | CC | CRC |
|---|---|---|---|
| checklist load | bureau checklist ✅ | bureau checklist ✅ | **crc-guides fetch + parse** (new) |
| checklist-comment-map build | ✅ | ✅ | ⏭️ skip (match in-compute by `atomicItemId`) |
| run summary | ✅ | ✅ | ✅ |
| audits (auditor modules) | ✅ | as today | ⏭️ skip (out of scope) |
| ground truth eval compute | ✅ | ✅ | ✅ (new CRC path) |
| embeddings | ✅ | ✅ | ✅ |
| checklist diff mapping | ✅ | ✅ | ⏭️ skip |

4. **Backfill trigger script** — `scripts/trigger-ig-postprocess.sh` maps `review_type → workflowName`
   at lines ~124-128 and today only emits `review` or `completeness-check`. Add `crc →
   comment-resolution-check` so per-review and `--backfill` runs fire for CRC. (This is the third
   independent CRC edit site, alongside the regex and the reviewType reconciliation.)

---

## UI changes

The Ground Truth Evals table today is a **single 1846-line `+page.svelte`** with columns hand-written
in `<thead>`/`<tbody>` and column identity computed by hardcoded index arithmetic
(`fixedColCount = 8|7` at `:808`, `statusColIndex = showCaughtByCityColumn ? 6 : 5` at `:1250`,
`getCellType`'s `col < fixedColCount-1` logic at `:143-159`, `baseCol = fixedColCount + userIdx*3`),
that same arithmetic threaded through the keyboard-nav engine. The `[commentId]` detail page
**duplicates** a reduced version of the table plus its own annotation handlers/modals (~230 lines)
and has no keyboard nav. Making columns `review_type`-driven is therefore a **refactor**, not a
config switch. We front-load it.

### Shared table component (front-loaded refactor)

Introduce a `ColumnDescriptor` model, a `COLUMN_REGISTRY`, and one `<EvalTable>` component that both
pages render.

**`ColumnDescriptor`** (`src/lib/eval-table/column-descriptor.ts`) captures everything a column
needs so no layout math lives in the pages:

```ts
type ReviewType = 'review' | 'completeness_check' | 'crc';
type CellKind =
  | 'readonly' | 'verdict-badge' | 'votes' | 'user-verdict'   // read-only kinds
  | 'comment'                                                   // 0–2 sub-cells: text / RFC link / Noetic link
  | 'dropdown' | 'verdict' | 'notes';                          // per-user editable kinds

interface ColumnDescriptor {
  id: string;
  header: string | ((t: ReviewType) => string);   // e.g. 'Deficiency' vs 'Requirement' for CRC
  kind: CellKind;
  visibleFor: ReviewType[];
  isVisible?: (ctx: CellContext) => boolean;       // extra runtime gate (e.g. Caught by City needs data)
  perUser?: boolean;                               // expands once per annotating user
  accessor: (row, ctx, user?) => unknown;
  subCellCount: (row, ctx, user?) => number;       // replaces commentMaxSubCell + notes hardcode
  options?: (t: ReviewType) => PickerOption[];     // dropdown/verdict pickers, per type
  editable?: (row, ctx, user?) => boolean;         // self-owned cells only
  onEnter?: (row, ctx, subCell, user?) => void;    // RFC/Noetic/modal actions, keeps EvalTable URL-agnostic
}
```

`COLUMN_REGISTRY` is the ordered list; `columnsFor(reviewType)` filters by `visibleFor` (then the
page filters by `isVisible`). Column set per type:

| Column | review | CC | CRC | Notes |
|---|---|---|---|---|
| Row # | ✅ | ✅ | ✅ | |
| Finding ID | ✅ `aw-1:AW-04` | ✅ `cc-1:CC-1-02` | ✅ displays bare `atomicItemId` (e.g. `AW-1.3`); stored `checklist_item_id = crc-AW:AW-1.3` | |
| Deficiency / Requirement | ✅ | ✅ | ✅ | header "Requirement" for CRC |
| Citation | ✅ | ✅ | ✅ (from guide) | |
| Caught in Review | ✅ | ❌ | ❌ (column hidden; signal still stored) | |
| Caught by City | conditional (`isVisible`) | ❌ | ❌ | |
| **Agent Verdict** | ✅ (`fail`/`not-verifiable` + fallback badge) | ✅ 5-state | ✅ 4-state + `not addressed` when status null | replaces "Review Finding Status"; read-only badge; `uncertain` shows tentative inline, e.g. `uncertain (→ fail)` |
| **Votes** | ❌ | ✅ | ✅ | one cell, all totals, e.g. `2 fail · 1 pass`; `—` for single-run |
| **User Verdict** | ❌ | ✅ | ✅ | read-only; live `comment_triage.verdict_override`; `—` when unset |
| Review Finding Comment | ✅ | ✅ | ✅ | comment cell: modal / RFC link / Noetic link sub-cells |
| {user}: Finding Comment Correct? | ✅ | ❌ | ❌ | |
| {user}: Is Citation Correct? | ✅ | ❌ | ❌ | |
| **{user}: Your Verdict** | ❌ | ✅ picker: pass/fail/warn/not-applicable | ✅ picker: resolved/failed/not-applicable | defaults unset (`--`); `uncertain` never offered |
| {user}: Notes | ✅ | ✅ | ✅ | |

**`<EvalTable>`** renders `<thead>`/`<tbody>` generically from a **flattened** `visibleColumns` array
(each `perUser` descriptor expanded once per annotating user, carrying its owner). Cell markup is
lifted verbatim into small components (`ReadonlyCell`, `VerdictBadge`, `VotesCell`, `UserVerdictCell`,
`CommentCell`, `DropdownCell`, `VerdictCell`, `NotesCell`). The keyboard-nav engine becomes descriptor
lookups against `visibleColumns` — **every hardcoded offset is deleted**:

| Current | Generic replacement |
|---|---|
| `totalColCount` | `visibleColumns.length` |
| `getCellType(col)` | `visibleColumns[col].descriptor.kind` |
| `commentMaxSubCell(row)` / notes "2 sub-cells" | `descriptor.subCellCount(row, ctx, user) - 1` |
| dropdown-vs-readonly self-check | `descriptor.editable(...)` |
| RFC/Noetic Enter targets | `descriptor.onEnter(...)` |
| `fixedColCount` / `statusColIndex` / `baseCol` literals | (gone) |

The duplicated in-`<textarea>` nav collapses into `NotesCell` emitting the same
`moveLeft/moveRight/commit` callbacks — one nav implementation, not two.

**Both pages consume `<EvalTable>`.** Main page feeds it the filtered/sorted rows plus store order
(`allRows`, for `originalIndex`). Detail page feeds it `matchingEvalRows` and a column subset
(`DETAIL_HIDDEN = {rowNum, deficiency, citation, caughtInReview, reviewComment}` — those are shown in
the card above). This deletes the detail page's ~230 lines of duplication, and fixes two live
detail-page issues for free: the always-rendered "Caught by City" cell (becomes `visibleFor:['review']
+ isVisible`) and the divergent `allAnnotatingUsers` rule (unify on the stricter "has a value" rule).
Keyboard nav turns **on** for the detail table too (a strict upgrade — it has none today).

**Refactor sequencing (keeps formal review byte-identical; incremental, not big-bang):**

1. **Type unification** — delete the duplicate `GroundTruthEvalRow`/`UserAnnotation`/… in
   `eval-data-store.svelte.ts`; import from `data/types.ts`. Gate: `svelte-check` clean.
2. **Extract pure cell components** from the existing inline markup, wired into the current table by
   index (no descriptors yet). Gate: visual + keyboard parity on a formal review.
3. **Introduce `ColumnDescriptor` + `COLUMN_REGISTRY` + `columnsFor('review')`** reproducing the exact
   current formal column order/labels. Gate: a parity test asserting the `<th>` label sequence and
   total column count match the legacy `fixedColCount + users*3` for N users.
4. **Build `<EvalTable>`**, swap the main page's inline `<table>` for it (still index-based nav
   internally). Keep the old table behind a feature flag for one release. Gate: formal review
   pixel/behavior identical.
5. **Move keyboard nav into `<EvalTable>`** driven by `visibleColumns`; delete
   `fixedColCount`/`statusColIndex`/`baseCol` and the in-textarea nav duplicate. Gate: replay the
   `ground-truth-keyboard-nav.md` scenarios (arrows/Tab/Enter/Escape across comment sub-cells 0/1/2
   and notes sub-cells 0/1).
6. **Add the CC/CRC data-layer columns** (additive; formal untouched): `agentStatus`, `voteBreakdown`,
   `tentativeStatus`, `userVerdictOverride` on the row; `verdict` on the annotation; the
   `comment_triage` join; the `crc` review_type in `columnsFor`. Gate: formal rows serialize
   unchanged (new fields absent).
7. **Replace the detail page table** with `<EvalTable>` + column subset; delete its duplicated
   handlers/modals; unify `allAnnotatingUsers`.

`ground-truth-keyboard-nav.md` is updated once (it is already stale — says `fixedColCount = 6 or 7`
while the code is `8 or 7`, and documents 2 comment sub-cells while the code has 3). After the
refactor its content is the descriptor registry + the generic nav rules.

### Filters

- **Status filter** options come from the type's vocabulary (plus any legacy values actually present).
- **Caught in Review / Caught by City filters** + AND/OR toggle: formal review only; removed (not
  disabled) for CC/CRC.
- New **User Verdict filter** (set / unset / specific value) for CC/CRC.
- New **Your Verdict filter** (annotated / not annotated / specific value) for CC/CRC.
- New **CRC "not addressed" filter** (atomic items with null agent status — the recall misses).
- Semantic search, Finding ID, Citation, Annotated By: unchanged.
- Vote-threshold filter: **future idea**, not in scope.

Filters and the stats bar stay in the page (they are page concerns), feeding `rows` into `<EvalTable>`.

### Header stats bar

Replaces "X/N caught in review · X/N caught by city" for CC/CRC:

- CC status distribution: `142 fail · 21 pass · 8 warn · 12 n/a · 11 uncertain`
- CRC status distribution + recall: `… resolved · … failed · … uncertain · … n/a` and
  `X/N atomic items addressed` (from `caught_in_review`).
- Annotation progress: `X/N rows annotated` (a row counts as annotated when any user set a verdict).

Formal review keeps its current stats.

### RFC detail page (`[commentId]`) additions

Now rendered via the shared `<EvalTable>` (annotation table) plus the existing comment card:

- CC: `uncertainExplanation` (and `agentTraceUncertainExplanation` if present) when uncertain.
- CRC: `enrichedFinalComment` (a **top-level** `output_json` field, not nested under `crc`), plus the
  CRC context block — `parentCommentId`, `severity` (required/recommendation badge), `evidenceExpected`.
- Both: vote breakdown detail (per-run statuses from `output_json.sourceFindings[].perRunFindings[]`;
  note the per-run field is `comment`, renamed from the agent's `explanation`), confidence,
  `runCount/totalRuns`.

### Keyboard nav

After the refactor, cell behavior is descriptor-driven: "Your Verdict" is a `dropdown`/`verdict`
picker cell (Enter → `showPicker()`, arrows/Tab/Escape); Votes and User Verdict are read-only cells
like Citation. No conceptual change to the interaction model beyond the (now generic) column list.

---

## Backfill plan (decision Q6)

Order: migrate schema → deploy IG code → backfill.

1. **CC reviews with `created_at >= 2026-07-05`** (6 reviews): re-emit post-processing via
   `./scripts/trigger-ig-postprocess.sh`. Recompute upserts `ig_eval_data` (the `saveEvalData()`
   upsert + stale-row delete, keyed on `(ig_review_run_id, checklist_item_id)`) and **preserves
   annotations** via `getExistingAnnotations()` (keyed by `checklist_item_id.toLowerCase()`) — notes
   survive; old CC correctness annotations become inert (columns hidden).
2. **All CRC reviews** (5 in prod): same trigger script **once the Inngest pattern AND the script's
   `review_type → workflowName` mapping both accept `comment-resolution-check`**. These fetch the
   crc-guides checklist from storage, create fresh `ig_review_runs` + eval rows.
3. CC reviews older than 2026-07-05: left as-is (render-only fallback handles legacy statuses).
4. `'formal'` reviews: no backfill, alias-handled at read time.

Backfill validation queries (post-run):

```sql
-- CRC coverage (expect eval_rows == distinct atomicItemIds in the guide, >= emitted comments)
SELECT r.id, count(d.id) AS eval_rows,
       count(d.id) FILTER (WHERE d.caught_in_review) AS addressed
FROM reviews r
LEFT JOIN ig_review_runs rr ON rr.review_id = r.id
LEFT JOIN ig_eval_data d ON d.ig_review_run_id = rr.id
WHERE r.review_type = 'crc' GROUP BY r.id;

-- CC status vocabulary sanity (should show pass/fail/warn/not-applicable/uncertain only)
SELECT d.agent_determined_status, count(*)
FROM ig_eval_data d
JOIN ig_review_runs rr ON rr.id = d.ig_review_run_id
JOIN reviews r ON r.id = rr.review_id
WHERE r.review_type = 'completeness_check' AND r.created_at >= '2026-07-05'
GROUP BY 1;
```

---

## Decision log (design review 2026-07-08, revised after audit)

| # | Decision |
|---|---|
| Q1 | Two verdict columns instead of correctness grading: read-only **Agent Verdict** + per-user **Your Verdict** in the same vocabulary. No double negatives. |
| Q2 | `uncertain` is never user-selectable. Users pick from the agent-status vocabulary only. |
| Q3 | CRC row = the atomic checklist item (from crc-guides), not the parent city comment. |
| Q4 | Single `ig_eval_data` table; add `agent_determined_status`, `uncertain_tentative_status`, `vote_breakdown`, `review_comment_id`, `metadata` jsonb. Stop hiding status in `review_comment_refs`. |
| Q5 | `verdict_override` is displayed as read-only **User Verdict**, live-queried from `comment_triage` — never stored in `ig_*`. |
| Q6 | Backfill CC reviews from 2026-07-05+, and all CRC reviews. |
| Q7 | Columns driven by `review_type` via a shared component (see Q21). One dynamic route. |
| Q8 | Votes shown as one cell with all totals; vote-threshold filter deferred. |
| Q9 | `uncertainExplanation` (CC) and `enrichedFinalComment` (CRC, top-level) shown on the detail page. |
| Q10/Q11 | "Citation Correct?" dropped for CC and CRC (kept for formal). CRC table shows `atomicItemId` + `requirement`; `parentCommentId`/`severity`/`evidenceExpected` on the detail page. |
| Q12 | Formal review's status derivation is fixed (drop severity heuristic; `fail`/`not-verifiable`). |
| Q13 | **REVERSED.** `review_type` is NOT denormalized onto `ig_review_runs`; it is read at runtime from `reviews` (already loaded on compute + read paths). Reconcile the two divergent Inngest reviewType sources onto `reviews.review_type`. |
| Q14 | Semantic-search embeddings generated for CC and CRC rows too. |
| Q15 | Migrations live in `substation/supabase/migrations/`. (Verified: substation baseline owns the ig_* tables; cityhall migrations are gone; fix stale `DB-overview.md`.) |
| Q16 | Header stats: per-type status distribution + `X/N rows annotated`; CRC also shows `X/N addressed`. Agreement %/confusion matrix deferred. |
| Q17 | **REVISED.** CRC vocabulary is `resolved`/`failed`/`uncertain` + **first-class `not-applicable`** (4-state consolidated). `not-applicable` gets a real badge, appears in filters, and is offered in the CRC "Your Verdict" picker. |
| Q18 | For CC/CRC: annotation columns are Your Verdict + Notes only. Formal keeps its three. User Verdict is display-only. |
| Q19 | **NEW.** Legacy `review`-type reviews with duplicate `comment_number`s (Feb-2026 batch, 1,467 dup pairs) are under-supported: `review_comment_id` resolution is best-effort (null on ambiguity). Acceptable. |
| Q20 | **NEW.** CRC eval rows are sourced from the crc-guides checklist in storage (`reviews.metadata->'crcGuides'`), one row per atomic item; comments matched on by `atomicItemId`; unaddressed items appear as `caught_in_review=false`, `agent_determined_status=null` (recall). |
| Q21 | **NEW.** The UI is refactored into a shared `<EvalTable>` driven by a `ColumnDescriptor` registry, replacing the monolith and the duplicated detail-page table. Sequenced to keep formal review byte-identical; both pages consume it. |
| Q22 | **NEW.** No agreement/accuracy metric in scope. Ground Truth Evals is a human-review/labeling surface (annotator records verdicts; lead reads and actions). Metrics can be added later against the same captured verdicts. |

## Assumptions

- `'formal'` (13 prod reviews) is an alias of `'review'`; handled at read time, no data migration.
- CRC "Your Verdict" picker is `resolved`/`failed`/`not-applicable` (Q2 excludes `uncertain`; display
  vocabulary is 4-state).
- `comment_number` is unique per review for all **current** reviews; the only violators are the
  legacy Feb-2026 `review`-type batch (Q19).
- `reviews.metadata->'crcGuides'` (`bucket`, `prefix`) is present on all CRC reviews (verified on all 5).
- `comment_triage` keys overrides by `review_comment_id` (unique); no triage rows → User Verdict `—`.

## Future ideas (out of scope)

- Agent–human agreement % in the stats bar; full confusion-matrix view per run and across runs.
- Vote-threshold filter (e.g. "winner share < 0.7").
- Ingesting `verdict_override` as a pre-fill suggestion for Your Verdict.
- CRC-aware auditor modules (verdict auditor against CRC evidence).
- Fully migrating `review_comment_refs` string refs to UUID joins.
- Per-type filters/stats extracted into the shared component (currently page-level).

## Implementation checklist

1. `substation`: migration — `ig_eval_data` new columns + indexes + `caught_in_review` nullable,
   `ig_eval_annotations.verdict` + check. (No `ig_review_runs` change.) Update `DB-overview.md`.
2. `inspector-general` data layer: unify the duplicated `GroundTruthEvalRow`/`UserAnnotation` types;
   DAL (`supabase-backend.ts` read/write of new columns, `comment_triage` join); compute (per-type
   branches; new CRC guide-fetch + parse + match path; formal-review derivation fix; best-effort
   legacy `review_comment_id`); Inngest (pattern, reviewType reconciliation, step gating, trigger
   script mapping); embeddings for CC/CRC.
3. `inspector-general` UI refactor (steps 1–7 under "Shared table component"): `ColumnDescriptor`
   registry + `<EvalTable>` + cell components + generic keyboard nav; per-type filters, votes cell,
   User Verdict cell, "not addressed" rendering, stats bar; detail-page consumes `<EvalTable>`;
   update `ground-truth-keyboard-nav.md`.
4. Backfill: CC ≥ 2026-07-05, all CRC; run validation queries.
