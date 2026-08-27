# Sunset `submission_version.status`

**Status:** Draft v1
**Date:** 2026-08-27
**Repos touched:** `substation` (DB migration: rewrite 5 RLS policies, drop column; API readers), `cityhall` (replace readers with a derivation, delete dead-state UI + type members)
**Repos NOT touched:** `conductor` (writes only `reviews` / `workflow_runs` — never touches `submission_version.status`), `inspector-general`, `quarry`, `navalbase`

> **Companion:** cityhall PR #645 (`wn/consolidate-submission-badge`) already removed the field's most visible read — the header "Draft" chip — replacing it with a badge derived from `city_submission_number`. This spec finishes the job: derive the remaining reads, rewrite the RLS that depends on the column, and drop it.

---

## Problem

`submission_version.status` is defined as a plain, unconstrained text column:

```sql
-- substation/supabase/migrations/00000000000000_baseline.sql:669
status TEXT NOT NULL DEFAULT 'draft'
```

No enum, no `CHECK`. The application layer *pretends* it is a 10-value lifecycle state machine — the `SubmissionStatus` union in `cityhall/src/lib/plan-set/styles.ts:62-72` lists `draft | researching | reviewing | review_complete | review_failed | submitted | in_review | comments_received | approved | rejected`, plus a shadow `archived` used only in filters — but a full write-site audit across every repo shows the reality:

**Only two values are ever written, by three code paths:**

| Value | Write site | Trigger |
|---|---|---|
| `draft` | `substation/src/routes/submissions.ts:79`, `:230`; `substation/src/routes/projects.ts:169`; `cityhall/src/routes/(app)/project/[projectId]/+page.server.ts:77` | Any submission/version/project creation (also the column `DEFAULT`) |
| `review_complete` | `substation/src/routes/submissions.ts:216` | "Heal" path: when creating a new version over a `draft` that already has a completed review, the stale `draft` is promoted to `review_complete` first |

**Everything else is dead code:**

- `researching`, `reviewing`, `review_failed`, `submitted`, `in_review`, `comments_received`, `approved`, `rejected` — **no writer in any repo** (cityhall, substation, conductor all searched). They are aspirational states from a superseded design.
- `archived` — **no writer anywhere.** Every `.neq('status','archived')` / `status !== 'archived'` filter (5 sites, listed below) is a no-op that can never match a row.
- `submitted_at` (the sibling column, `TIMESTAMPTZ` nullable) — **also never written.** It's selected as the "review start" timer source (`+page.ts:417`) but is always null.

The comment at `substation/src/inngest/lib/supabase.ts:8` — "Bypasses RLS so functions can update submission_version status" — describes code that does not exist.

**So the column is, in practice, a binary flag: `draft` vs. not-`draft`** — i.e. "is this version still editable?" And that bit is **fully derivable** from data we already have. The proof is that both repos already compute it independently *alongside* `status`:

- `cityhall/.../submission/[submissionId]/+page.ts:388` — `locked = activeVersion.status !== 'draft' || hasCompletedReviews`. The `hasCompletedReviews` half is a live `reviews` query (`+page.ts:181-186`). `status` is the redundant half.
- `substation/src/routes/submissions.ts:188-218` — the heal path *only exists because `status` drifts*: it re-derives the truth from `reviews` and patches `status` to match. Delete the column and the drift (and the heal) disappear.

### Why this is worth doing

1. **It's a footgun that already misfires.** The heal path is a live bug workaround for `status` lying. Five RLS policies (below) trust `status = 'draft'` as the authority on mutability — a single bad write (no `CHECK` guards it) silently unlocks a submitted version or freezes a draft.
2. **Dead UI states mislead.** `cityhall` renders "Conducting property research…", "Running Austin review…", and a "Review Failed" banner (`+page.svelte:202-213`, `:556`) for states that never occur, and gates a review-landing spinner (`review/+page.ts:137`) and a nav item (`+layout.ts:366`) on values that are always false. This is confusing dead weight for the next reader.
3. **The real lifecycle already moved elsewhere.** "Submitted to the city" is now modeled by `city_submission_number` (the jurisdiction-conventions work, winston #182/#185). "Review ran / completed / failed" is modeled by the `reviews` table (`status review_status` enum: `pending | in_progress | completed | failed`, `is_current`, `submission_version_id` FK). `submission_version.status` is a vestigial third model that duplicates neither well.

---

## The derivation

Everything the column is used for reduces to one predicate — **is this version locked (immutable)?**

```
is_locked(sv) := sv.city_submission_number IS NOT NULL          -- stamped to a city cycle → submitted
                 OR EXISTS ( SELECT 1 FROM reviews r            -- a current review of record exists
                             WHERE r.submission_version_id = sv.id
                               AND r.is_current = true
                               AND r.review_type = 'review'
                               AND r.status = 'completed' )
```

"Is draft" is simply `NOT is_locked(sv)`.

- The `reviews` sub-predicate is exactly the check both repos already run. **Note a live inconsistency to resolve (Q2):** cityhall's `hasCompletedReviews` (`+page.ts:181-186`) filters `is_current + review_type='review'` but **omits `status='completed'`** — it counts *any* current review, including in-progress/failed — whereas substation's heal (`submissions.ts:189-197`) includes `status='completed'`. These disagree today. The spec adopts substation's stricter form (`status='completed'`) as canonical; cityhall's omission is treated as the bug.
- The `city_submission_number` clause is new to the lock predicate but strictly correct: a version stamped to a city cycle has been submitted and must be immutable. Today no stamped version is un-`review_complete`, so this clause changes no current row's lockedness — it's future-proofing (D3).

---

## Plan

Phased so each step is independently shippable and reversible. DB (RLS) is the load-bearing risk and goes behind the app changes, not before.

### Phase 0 — visible read removed *(done)*
cityhall PR #645: header badge no longer reads `status`. Ships independently of everything below.

### Phase 1 — canonicalize the derivation (both repos, no DB change)
- **cityhall:** add `submissionLock.ts` helper exporting `isLocked(version, hasCompletedReview)` and a `hasCompletedReviewQuery(supabase, versionId)`. Replace the `status !== 'draft'` half of every reader (`+page.ts:388`, `:172`, `:394`; `plan-set/+page.ts:48`; `document/[documentId]/+page.svelte:28,486`) with `isLocked(...)`. Fix the `status='completed'` omission (Q2) in the shared query.
- **substation:** extract the heal path's `reviews` check (`submissions.ts:189-197`) into a shared `isVersionLocked(sb, versionId)` and route the delete/remove/upload/link gates (`submissions.ts:310,428,918`; `documents.ts:119,311`; `plan-sets.ts:171`) through it instead of `status`.
- **Delete dead-state UI now** (safe — the states never fire): the `researching`/`reviewing`/`review_failed` banners + timer (`+page.svelte:196-213`, elapsed-timer `$effect`, `:556`), the `reviewRunning`/`reviewing` gates (`+layout.ts:366`, `review/+page.ts:137`), and all 5 `archived` filters (they're no-ops: `+layout.ts:35`, `+page.svelte:26,60`, `submission/[submissionId]/+page.ts:73`, `review/[reviewId]/+page.ts:425`, `substation submissions.ts:142`).

At the end of Phase 1 **no application logic reads `status`** except the raw column select in `+layout.ts:133`. Everything still writes it (harmless).

### Phase 2 — rewrite RLS to the derivation (substation migration)
The 5 policies that gate on `sv.status = 'draft'` (`baseline.sql`):

| Policy | Table / cmd | Line |
|---|---|---|
| delete draft submission versions v2+ | `submission_version` DELETE | 1646 |
| link plan sets to draft submissions | `submission_plan_set` INSERT | 1669 |
| unlink plan sets from draft submissions | `submission_plan_set` DELETE | 1678 |
| link documents to draft submissions | `submission_document` INSERT | 1696 |
| unlink documents from draft submissions | `submission_document` DELETE | 1705 |

Replace each `sv.status = 'draft'` with `NOT public.submission_version_is_locked(sv.id)` (a `STABLE` SQL function encapsulating the predicate above — **Q1** covers function-vs-generated-column-vs-view). New migration only; never edit the baseline. This is the step that must be tested against a real project (draft mutable, submitted/reviewed immutable) before merge.

### Phase 3 — stop writing `status` (both repos)
Drop `status: 'draft'` from the 4 insert sites and delete the heal-path `UPDATE ... status='review_complete'` (`submissions.ts:214-218`) — the heal's *real* work (blocking new-version creation over an empty draft) stays; only the cosmetic status patch goes. Stop selecting `status` in `+layout.ts:133`.

### Phase 4 — drop the column + dead type (substation migration + cityhall)
- Migration: `ALTER TABLE submission_version DROP COLUMN status;` (and decide `submitted_at` — **Q3**).
- cityhall: delete the `SubmissionStatus` union + `statusStyles` map from `styles.ts` (or trim to what, if anything, still renders — **Q4**), and the `versionStatus`/`SubmissionStatus` cast in `+page.svelte`.
- Drop `status` from `substation/supabase/seed.sql:117`.

---

## Decisions

- **D1** — The column becomes a derived predicate `is_locked`; no replacement column is added. Lockedness is computed, not stored.
- **D2** — Canonical lock query uses substation's stricter form (`status='completed'`). cityhall's current omission is a bug fixed in Phase 1 (Q2).
- **D3** — `is_locked` includes the `city_submission_number IS NOT NULL` clause even though it changes no current row, so a version submitted to the city is immutable independent of review state.
- **D4** — Dead lifecycle states (`submitted`, `in_review`, `comments_received`, `approved`, `rejected`) are **deleted, not preserved.** When a real post-submission city lifecycle is built it will be modeled on `city_submission_number` + a purpose-built table, not resurrected here.
- **D5** — Phasing puts app-layer reader removal (Phase 1) before the RLS rewrite (Phase 2) before write removal (Phase 3) before the drop (Phase 4), so no phase can break mutability enforcement — at every point either `status` or the derivation (or both) is authoritative.

---

## Open questions

- **Q1 — Derivation mechanism for RLS.** A `STABLE SECURITY DEFINER` SQL function `submission_version_is_locked(uuid)` is cleanest for reuse across 5 policies, but adds an `EXISTS(reviews)` subquery per row-check on hot junction tables (`submission_plan_set`, `submission_document`) during uploads. Alternatives: (a) a generated/`STORED` column `is_locked` — but generated columns can't reference other tables, so `reviews` can't feed it; (b) a maintained boolean `locked` column updated by trigger on `reviews` insert + `city_submission_number` stamp — reintroduces stored state (the thing we're removing) but is index-friendly. **Recommendation:** SQL function; measure the upload-path RLS cost before committing. Is the per-row subquery acceptable, or do we need the trigger-maintained boolean?
- **Q2 — Reconcile the two "completed review" queries.** Confirm substation's `status='completed'` form is the correct lock semantics (a draft with only an *in-progress* review — should it be editable?). If in-progress should also lock, the predicate changes and cityhall's current form is closer to right. Which is the intended rule?
- **Q3 — `submitted_at`.** Never written, always null. Drop it in Phase 4 alongside `status`, or keep as a reserved column for a future submit action? (`reviewStartedAt` at `+page.ts:417` is its only reader and is already dead.)
- **Q4 — `statusStyles` / `SubmissionStatus`.** After the drop, does anything still need a status→label/color map? The mock/fixtures at `cityhall/src/routes/mocks/...` reference `status.label` — do the mock routes stay, and do they need the type, or do they move to their own local fixture type?
- **Q5 — External consumers.** Does any analytics query, Supabase dashboard view, Metabase card, or export read `submission_version.status` outside these repos? A column drop is irreversible for those. Needs a prod grep / stakeholder check before Phase 4.
- **Q6 — Realtime review-progress signal.** The `submission_version` UPDATE subscription (`+page.svelte:444` → `invalidateAll()`) was meant to surface the (dead) "reviewing" spinner. Real review progress lives in `reviews`. Should the subscription move to the `reviews` table so an actual running review refreshes the page, or is that out of scope here?
- **Q7 — Test surface for the RLS rewrite.** Minimum acceptance: on a real project, (a) a draft v1 accepts document/plan-set link+unlink and can't be deleted (v1 guard); (b) a draft v2 accepts edits and can be deleted; (c) a version with a completed review rejects all link/unlink/delete; (d) a version stamped with `city_submission_number` rejects the same. Is a Playwright/e2e pass required, or is a SQL-level policy test sufficient?

---

## Appendix — full read-site inventory (Phase 1 checklist)

**substation** (all gate "is draft" → replace with `isVersionLocked`):
`submissions.ts:142` (archived filter — delete), `:188` (heal check — keep, it's the real gate), `:310`, `:428`, `:918`; `documents.ts:119`, `:311`; `plan-sets.ts:171`; `submission-report-context.ts:72,201,216` (passes `status` into an AI prompt as "**Status:** draft" — replace with derived label).

**cityhall** (readers):
`+layout.ts:35` (archived — delete), `:133` (select — drop in Phase 3), `:366` (dead `reviewRunning`); `review/+page.ts:137` (dead `reviewing`); `submission/[submissionId]/+page.ts:73` (archived — delete), `:172`, `:388`, `:394`, `:418` (dead timer); `plan-set/+page.ts:48`; `document/[documentId]/+page.svelte:28,486`; `submission/[submissionId]/+page.svelte:196-213` (dead banners), `:444` (realtime — Q6); `review/[reviewId]/+page.ts:425` (archived — delete).

**DB:** the 5 RLS policies (Phase 2) + column definition `baseline.sql:669` + seed `seed.sql:117`. No triggers, views, or check constraints reference the column.
