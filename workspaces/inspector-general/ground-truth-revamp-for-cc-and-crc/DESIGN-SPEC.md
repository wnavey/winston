# Ground Truth Evals Revamp for CC and CRC

**Status:** Draft — ready for review
**Date:** 2026-07-08
**Repos touched:** `inspector-general` (compute, UI, Inngest, DAL), `substation` (SQL migrations)
**Repos NOT touched:** `bureau`, `conductor`, `cityhall`

## Problem

Inspector General's Ground Truth Evals feature (`/review/[reviewId]/ground-truth-evals`) was built
for formal reviews (`reviews.review_type = 'review'`). It now runs against completeness-check
reviews (`'completeness_check'`) and needs to support comment-resolution-check reviews (`'crc'`),
but the schema, compute pipeline, and UI all bake in formal-review assumptions:

1. **CRC has zero IG wiring.** The Inngest trigger pattern
   (`on-workflow-completed.ts:31`) is
   `^(review(-\d+(\.\d+)*)?|review-wip|completeness-check)$` — `comment-resolution-check` never
   fires post-processing. Confirmed in prod: 5 `crc` reviews, 0 `ig_review_runs`, 0 eval rows.
   Deeper than the trigger: the compute path builds rows from **bureau training data** (grouping
   guide checklists), but CRC's checklist is per-project (atomic items generated from the MCR into
   the `crc-guides` bucket), so CRC needs a different row source entirely.

2. **CC eval data in prod is wrong, not just misfit.** Row status is derived via a legacy
   severity heuristic (`ground-truth-eval.ts:152-183`: severity 3→`fail`, 2→`unclear`, 1→`nv`)
   built for the old formal-review schema. Prod CC eval rows contain `unclear` (not a CC status)
   and contain **no `warn` or `uncertain` at all**, even though both are now first-class. The real
   consolidated status, `tentativeStatus`, `voteBreakdown`, and `confidence` all exist in
   `review_comments.output_json` and are never read.

3. **`caught_in_review` is trivially true for CC.** CC emits a comment for every checklist item,
   so e.g. review `ae7cb127` has all 194 rows `caught_in_review = true` and `caught_by_city` all
   null. Two of the seven fixed UI columns are pure noise for CC, and both are meaningless for CRC.

4. **No first-class status on `ig_eval_data`.** Status lives only as `commentStatus` inside the
   `review_comment_refs` JSONB (first ref wins). Filtering and analytics on status are awkward and
   get worse with three vocabularies.

5. **Human verdict overrides are ignored.** `comment_triage.verdict_override` (shipped 2026-07-08)
   is a human-corrected verdict per review comment — the strongest available ground-truth signal
   for CC/CRC — and IG doesn't surface it.

6. **Formal review's own status column is stale.** It renders `nv`/`unclear` from the legacy
   severity mapping; the current review workflow's consolidated vocabulary is
   `fail` / `not-verifiable`.

## Goals

- Ground Truth Evals works correctly for all three review types with a **dynamic UI driven by
  `review_type`**.
- The eval row's status becomes first-class, in each workflow's own vocabulary, including
  `uncertain` (the post-run vote-determined status for CC and CRC).
- Human ground truth is captured as a **verdict** ("agent said `failed`, I say `resolved`") instead
  of a double-negative correctness grade — for CC and CRC.
- Cityhall's `verdict_override` is displayed (read-only, live-queried) alongside the agent verdict.
- Formal review's status derivation is fixed in the same pass.
- Backfill: CC reviews from 2026-07-05 onward, and all CRC reviews.

## Non-goals

- No changes to the workflows themselves (bureau/conductor) or to cityhall.
- No confusion-matrix / agreement-metrics page (listed under Future ideas).
- No migration of `review_comment_refs` string refs to UUIDs beyond adding the new
  `review_comment_id` column (the string refs remain for RFC deep links).
- Auditor modules (citation/clarity/atomicity/verdict) are unchanged; this spec is only the ground
  truth eval system.

---

## Status vocabularies (reference)

| | Formal review (`review`) | Completeness check (`completeness_check`) | Comment resolution check (`crc`) |
|---|---|---|---|
| Agent per-run | `fail`, `not-verifiable` | `pass`, `fail`, `warn`, `not-applicable` | `resolved`, `failed` |
| Consolidated (displayed) | `fail`, `not-verifiable` | + `uncertain` (5-state) | + `uncertain` (3-state) |
| `uncertain` trigger | n/a | runs ≥ 3 and winner share ≤ 1 − 0.35 | same |
| `tentativeStatus` | n/a | set only when `uncertain` | set only when `uncertain` |
| `voteBreakdown` keys | n/a | `pass`,`fail`,`warn`,`not-applicable`,`missing` | `resolved`,`failed`,`not-applicable`,`missing` |
| Extra prose | — | `uncertainExplanation` | `enrichedFinalComment` |

Source of truth: `bureau/workflows/{review,completeness-check,comment-resolution-check}/scripts/`
(`consolidate-logic.ts`, `build-review-comments.ts`, `build-crc-review-comments.ts`) and the
`review_comments.output_json` they persist.

**Legacy values in prod (render-only, never writable):**

- `reviews.review_type = 'formal'` — 13 rows. Treated as an alias of `'review'` at read time
  everywhere in IG. No data migration.
- CRC `not-applicable` — 17 comments across 3 of 5 CRC reviews (pre comment-triage-rework).
  Rendered as a read-only fallback badge; never offered in any picker.
- Any other unexpected status string renders the same way: neutral gray badge with the raw value.

---

## DB schema changes

Migrations live in **`substation/supabase/migrations/`** (not cityhall — that moved).

### `ig_review_runs`

```sql
ALTER TABLE public.ig_review_runs ADD COLUMN review_type text;

-- Backfill from reviews, normalizing the legacy alias:
UPDATE public.ig_review_runs rr
SET review_type = CASE WHEN r.review_type = 'formal' THEN 'review' ELSE r.review_type END
FROM public.reviews r
WHERE r.id = rr.review_id;
```

First-class (per decision Q13) so eval reads don't join `reviews`. Set at
`resolveOrCreateRunId()` time going forward.

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
| `agent_determined_status` | `fail` / `not-verifiable` | 5-state | 3-state (+ legacy fallback) |
| `uncertain_tentative_status` | null | `tentativeStatus` when uncertain | same |
| `vote_breakdown` | null | `voteBreakdown` when multi-run | same |
| `review_comment_id` | matched comment UUID (null if not caught) | comment UUID | comment UUID (always — 1:1) |
| `caught_in_review` | as today | **null** | **null** |
| `caught_by_city` | as today | null (unchanged) | null |
| `code_citation` | as today | as today | null (no citation concept per-row in UI) |
| `metadata` | `{}` | `{}` | `{parentCommentId, severity, evidenceExpected}` |

`review_comment_refs` JSONB is retained unchanged (RFC deep links, back-compat), but
`commentStatus` inside it is no longer the status source — `agent_determined_status` is.

`embedding` / `embedding_text` behavior is unchanged and **extends to CC and CRC** rows
(decision Q14): embedding text is built from the deficiency/requirement text as today.

### `ig_eval_annotations`

```sql
ALTER TABLE public.ig_eval_annotations
  ADD COLUMN verdict text
  CHECK (verdict IN ('pass','fail','warn','not-applicable','resolved','failed'));
```

- The DB check is the **union** of legal values; per-type narrowing (CC picker vs CRC picker) is
  enforced in the API layer and UI. `uncertain` is deliberately excluded — never user-writable
  (decision Q2).
- `comment_correct` / `citation_correct` remain, used **only for formal review** rows. `verdict`
  is used only for CC/CRC rows. `notes` applies to all types.
- Existing unique constraint `(ig_eval_data_id, user_id)` and RLS are unchanged.

### What is deliberately NOT stored

`comment_triage.verdict_override` (the cityhall human override, aka **"User Verdict"**) is
**live-queried at read time**, never copied into `ig_*` tables (decision Q5 — it changes out from
under us). Join: `ig_eval_data.review_comment_id = comment_triage.review_comment_id`.

---

## Compute pipeline changes (`src/lib/compute/ground-truth-eval.ts`)

The compute function branches on `review_type` (from `ig_review_runs.review_type`, falling back to
the `reviews` join; `'formal'` → `'review'`).

### Formal review (`review`) — fixed derivation

- Row source: unchanged (bureau training data checklist items).
- **Delete the severity heuristic** (severity 3/2/1 → fail/unclear/nv). New derivation, in order:
  1. Detail-level `runComments` consensus where the vocabulary is the current one
     (`fail` / `not-verifiable`), via `review_checklist_comment_map` →
     `review_comments.output_json` as today.
  2. Consolidated finding status from `consolidated-findings.json` when storage outputs exist.
  3. Fallback `fail` when the item is caught but no status is resolvable.
- Populate the new columns: `agent_determined_status`, `review_comment_id` (resolved via
  `review_id` + `comment_number` per the existing UUID-resolution convention). Vote columns stay
  null (formal review has confidence tiers, not votes).
- `caught_in_review` / `caught_by_city` semantics unchanged.
- Old reviews whose stored data still says `nv`/`unclear`/`pass` are handled by the render-only
  fallback badge; recompute fixes any review it's re-run on.

### Completeness check (`completeness_check`)

- Row source: unchanged (bureau CC training data — one row per checklist item, e.g.
  `cc-1:CC-1-02`).
- Status source: the matched `review_comments.output_json` directly —
  `status` (5-state), `tentativeStatus`, `voteBreakdown`. No inference, no clamping in IG: the
  workflow already applied the Fail Status policy clamp pre-vote; IG stores what the product
  displays.
- `caught_in_review` → null, `caught_by_city` → null. The scoring.json path is skipped (already
  gated by `isCompletenessCheck`).
- `review_comment_id` populated for every row.

### Comment resolution check (`crc`) — new path

- **Row source: `review_comments` themselves.** Each CRC comment IS one atomic checklist item
  (1:1). No bureau training data, no `review_checklist_comment_map`, no storage fallbacks needed
  for row identity.
- Per row, from `output_json`:
  - `checklist_item_id` = `crc.atomicItemId` (e.g. `AW-1.3`)
  - `checklist_item_text` = `crc.requirement`
  - `agent_determined_status` = `status` (`resolved` / `failed` / `uncertain`; legacy
    `not-applicable` stored as-is, rendered read-only)
  - `uncertain_tentative_status` = `tentativeStatus`, `vote_breakdown` = `voteBreakdown`
  - `metadata` = `{parentCommentId, severity, evidenceExpected}` from `crc.*`
  - `review_comment_id` = the comment's UUID
  - `code_citation` = null; `caught_in_review` / `caught_by_city` = null
- Embeddings generated from the requirement text, same as other types.

### Read path (`GET /api/ground-truth-eval-data`)

- `assembleRows()` returns the new fields on `GroundTruthEvalRow`:

```typescript
export interface GroundTruthEvalRow {
  findingId: string;
  deficiency: string;                       // requirement text for CRC
  codeCitation?: string;
  agentStatus?: string;                     // agent_determined_status
  tentativeStatus?: string;                 // uncertain_tentative_status
  voteBreakdown?: Record<string, number>;   // vote_breakdown
  reviewCommentId?: string;                 // review_comment_id (UUID)
  userVerdictOverride?: string;             // live-joined comment_triage.verdict_override
  caughtInReview?: boolean | null;          // null for CC/CRC
  caughtByCity?: boolean | null;
  crcMeta?: { parentCommentId: string; severity: string; evidenceExpected: string };
  reviewCommentRefs?: ReviewCommentRef[];
  annotations?: Record<string, UserAnnotation>;  // UserAnnotation gains `verdict?`
}
```

- The read handler makes one additional query per page load:
  `comment_triage` rows for the review's comment UUIDs → `userVerdictOverride` per row. Missing
  triage row or null override → column shows `—`.

### Annotation write path (`PATCH`)

- `UserAnnotation` gains `verdict?: 'pass'|'fail'|'warn'|'not-applicable'|'resolved'|'failed'`.
- The API validates the verdict against the run's `review_type` vocabulary
  (CC: `pass|fail|warn|not-applicable`; CRC: `resolved|failed`) and rejects `verdict` writes on
  formal-review runs.
- Empty-annotation deletion logic now considers `verdict` alongside
  `comment_correct`/`citation_correct`/`notes`.

---

## Inngest changes (`src/lib/inngest/functions/on-workflow-completed.ts`)

1. Trigger pattern gains CRC:
   `^(review(-\d+(\.\d+)*)?|review-wip|completeness-check|comment-resolution-check)$`
2. `reviewType` mapping becomes explicit for all three (today `review` maps to `null`):
   `completeness-check` → `completeness_check`, `comment-resolution-check` → `crc`,
   `review*` → `review`. Persisted onto `ig_review_runs.review_type`.
3. **Per-type step gating** for the post-processing pipeline. CRC skips the bureau-driven steps:

| Step | review | CC | CRC |
|---|---|---|---|
| bureau checklist load | ✅ | ✅ | ⏭️ skip |
| checklist-comment-map build | ✅ | ✅ | ⏭️ skip |
| run summary | ✅ | ✅ | ✅ |
| audits (auditor modules) | ✅ | as today | ⏭️ skip (out of scope) |
| ground truth eval compute | ✅ | ✅ | ✅ (new CRC path) |
| embeddings | ✅ | ✅ | ✅ |
| checklist diff mapping | ✅ | ✅ | ⏭️ skip |

(The exact step list is the current 9-step pipeline; the matrix above is the intent — finalize
mechanically at implementation.)

---

## UI changes

One dynamic route (decision Q7): `/review/[reviewId]/ground-truth-evals` reads `review_type` and
selects a **column config**. No new routes.

### Column matrix

| Column | review | CC | CRC | Notes |
|---|---|---|---|---|
| Row # | ✅ | ✅ | ✅ | |
| Finding ID | ✅ `aw-1:AW-04` | ✅ `cc-1:CC-1-02` | ✅ `atomicItemId` e.g. `AW-1.3` | |
| Deficiency / Requirement | ✅ | ✅ | ✅ (`requirement`) | header label "Requirement" for CRC |
| Citation | ✅ | ✅ | ❌ | |
| Caught in Review | ✅ | ❌ | ❌ | |
| Caught by City | conditional | ❌ | ❌ | |
| **Agent Verdict** | ✅ (`fail`/`not-verifiable` + legacy fallback badge) | ✅ 5-state | ✅ 3-state + fallback badge | replaces "Review Finding Status"; read-only badge. `uncertain` badge also shows tentative status inline, e.g. `uncertain (→ fail)` |
| **Votes** | ❌ | ✅ | ✅ | single cell, all totals, e.g. `2 fail · 1 pass`; `—` for single-run |
| **User Verdict** | ❌ | ✅ | ✅ | read-only; live `comment_triage.verdict_override`; `—` when unset |
| Review Finding Comment | ✅ | ✅ | ✅ | unchanged sub-cell behavior (modal / RFC link / Noetic link) |
| {user}: Finding Comment Correct? | ✅ | ❌ | ❌ | |
| {user}: Is Citation Correct? | ✅ | ❌ | ❌ | |
| **{user}: Your Verdict** | ❌ | ✅ picker: pass/fail/warn/not-applicable | ✅ picker: resolved/failed | defaults to unset (`--`); `uncertain` never offered |
| {user}: Notes | ✅ | ✅ | ✅ | |

Verdict badge palette follows cityhall conventions: `pass`/`resolved` green, `fail`/`failed` red,
`warn` amber, `not-applicable` gray, `uncertain` purple, `not-verifiable` gray, unknown/legacy
values neutral gray with raw text.

### Filters

- **Status filter** options come from the type's vocabulary (plus any legacy values actually
  present in the data, as today).
- **Caught in Review / Caught by City filters**: formal review only; removed (not just disabled)
  for CC/CRC, along with the AND/OR toggle.
- New **User Verdict filter** (set / unset / specific value) for CC/CRC.
- New **Your Verdict filter** (annotated / not annotated / specific value) for CC/CRC.
- Semantic search, Finding ID, Citation (review+CC), Annotated By: unchanged.
- Vote-threshold filter: **future idea**, not in scope.

### Header stats bar (decision Q16)

Replaces "X/N caught in review · X/N caught by city" for CC/CRC:

- Status distribution: `142 fail · 21 pass · 8 warn · 12 n/a · 11 uncertain`
- Annotation progress: `X/N rows annotated` (a row counts as annotated when any user set a verdict)

Formal review keeps its current stats.

### RFC detail page (`[commentId]`) additions

- CC: `uncertainExplanation` (and `agentTraceUncertainExplanation` if present) rendered when the
  comment is uncertain.
- CRC: `enrichedFinalComment`, plus the CRC context block — `parentCommentId`, `severity`
  (required/recommendation badge), `evidenceExpected`.
- Both: vote breakdown detail (per-run statuses from `sourceFindings.perRunFindings`), confidence,
  `runCount/totalRuns`.

### Keyboard nav

The "Your Verdict" cell behaves exactly like the existing dropdown cells (Enter → `showPicker()`,
arrows/Tab navigation, Escape). The Votes and User Verdict cells are read-only cells like Citation.
No changes to the interaction model in `ground-truth-keyboard-nav.md` beyond the column list.

---

## Backfill plan (decision Q6)

Order: migrate schema → deploy IG code → backfill.

1. **CC reviews with `created_at >= 2026-07-05`**: re-emit post-processing via the existing
   `./scripts/trigger-ig-postprocess.sh` flow. Recompute upserts `ig_eval_data` (the
   `saveEvalData()` upsert + stale-row delete) and **preserves annotations** via
   `getExistingAnnotations()` — existing notes survive.
2. **All CRC reviews** (5 in prod today): same trigger script once the Inngest pattern accepts
   `comment-resolution-check`. These create fresh `ig_review_runs` + eval rows.
3. CC reviews older than 2026-07-05: left as-is (their stored statuses remain legacy-derived;
   render-only fallback handles them; can be recomputed ad hoc if ever needed).
4. `'formal'` reviews: no backfill, alias-handled at read time.

Backfill validation queries (post-run):

```sql
-- CRC coverage
SELECT r.id, count(d.id) AS eval_rows
FROM reviews r
LEFT JOIN ig_review_runs rr ON rr.review_id = r.id
LEFT JOIN ig_eval_data d ON d.ig_review_run_id = rr.id
WHERE r.review_type = 'crc' GROUP BY r.id;

-- CC status vocabulary sanity (should show pass/fail/warn/not-applicable/uncertain only)
SELECT d.agent_determined_status, count(*)
FROM ig_eval_data d
JOIN ig_review_runs rr ON rr.id = d.ig_review_run_id
WHERE rr.review_type = 'completeness_check'
  AND rr.created_at >= '2026-07-05'
GROUP BY 1;
```

---

## Decision log (from design review, 2026-07-08)

| # | Decision |
|---|---|
| Q1 | Two verdict columns instead of correctness grading: read-only **Agent Verdict** + per-user **Your Verdict** in the same vocabulary. No double negatives. |
| Q2 | `uncertain` is never user-selectable. Users pick from the agent-status vocabulary only. |
| Q3 | CRC row = the atomic checklist item (from crc-guides), not the parent city comment. |
| Q4 | Single `ig_eval_data` table; add `agent_determined_status`, `uncertain_tentative_status`, `vote_breakdown`, `review_comment_id`, `metadata` jsonb. Stop hiding status in `review_comment_refs`. |
| Q5 | `verdict_override` is displayed as read-only **User Verdict**, live-queried from `comment_triage` — never stored in `ig_*`. |
| Q6 | Backfill CC reviews from 2026-07-05+, and all CRC reviews. |
| Q7 | One dynamic route; columns driven by `review_type`. |
| Q8 | Votes shown as one cell with all totals; vote-threshold filter deferred. |
| Q9 | `uncertainExplanation` (CC) and `enrichedFinalComment` (CRC) shown on the detail page. |
| Q10/Q11 | "Citation Correct?" dropped for CC and CRC (kept for formal review). CRC table columns: `atomicItemId` + `requirement`; `parentCommentId`/`severity`/`evidenceExpected` detail-page only. |
| Q12 | Formal review's status derivation is fixed in this spec (drop severity heuristic; `fail`/`not-verifiable`). |
| Q13 | `review_type` denormalized as a first-class column on `ig_review_runs`. |
| Q14 | Semantic-search embeddings generated for CC and CRC rows too. |
| Q15 | Migrations live in `substation/supabase/migrations/`. |
| Q16 | Header stats: per-type status distribution + `X/N rows annotated`. Agreement %/confusion matrix deferred. |
| Q17 | CRC vocabulary is strictly `resolved`/`failed`/`uncertain`. Unexpected strings (incl. legacy `not-applicable`, 17 rows in prod) render read-only; pickers never offer them. |
| Q18 | For CC/CRC: annotation columns are Your Verdict + Notes only. Formal review keeps its three annotation columns. User Verdict is display-only in IG. |

## Assumptions

- `'formal'` (13 prod reviews) is an alias of `'review'`; handled at read time, no data migration.
- CRC "Your Verdict" picker is `resolved`/`failed` only (Q2 dominates; the display vocabulary is
  3-state including `uncertain`).
- `comment_number` remains unique per review (existing convention) for formal/CC
  `review_comment_id` resolution.
- `comment_triage` continues to key overrides by `review_comment_id`; if a review has no triage
  rows, User Verdict renders `—` throughout.

## Future ideas (out of scope)

- Agent–human agreement % in the stats bar; full confusion-matrix view (agent verdict × human
  verdict) per run and across runs.
- Vote-threshold filter (e.g. "winner share < 0.7").
- Ingesting `verdict_override` as a pre-fill suggestion for Your Verdict.
- CRC-aware auditor modules (verdict auditor against CRC evidence).
- Fully migrating `review_comment_refs` string refs to UUID joins.

## Implementation checklist

1. `substation`: migration — `ig_review_runs.review_type`, `ig_eval_data` new columns +
   indexes + `caught_in_review` nullable, `ig_eval_annotations.verdict` + check.
2. `inspector-general`: types (`GroundTruthEvalRow`, `UserAnnotation`), DAL
   (`supabase-backend.ts` read/write of new columns, `comment_triage` join), compute
   (per-type branches; new CRC path; formal-review derivation fix), Inngest (pattern, reviewType
   mapping, step gating), embeddings for CC/CRC.
3. `inspector-general` UI: column config per review_type, verdict pickers, votes cell, User
   Verdict cell, filters, stats bar, detail-page additions, keyboard-nav column wiring.
4. Backfill: CC ≥ 2026-07-05, all CRC; run validation queries.
