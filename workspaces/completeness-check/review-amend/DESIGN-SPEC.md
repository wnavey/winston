# CC review amend — re-run part of a completeness-check run and update its published review in place

**Status:** Draft v1
**Date:** 2026-10-12
**Repos touched:** `bureau` (`runbooks/lib/publish_review_cli.py` + `publish_review.py` gain an amend lane; `runbooks/completeness-check/scripts/cc.py` passes it; `steps/1.1-inputs/contract.test.ts` accepts the request key; tests)
**Repos NOT touched:** `conductor2` (its `void` + `advance` already re-run a step and everything that reads it), `cityhall` / `cityhall-new` (no schema, RPC or UI change — and both are on the deprecation path), `substation`, `inspector-general`

## Problem

A completeness-check (CC) run publishes exactly once, as a new review. Re-running any part of it (turning on comment markings after the fact, re-running the review step after a guide-prompt fix) can only land as a *second* review row with new comment ids. Everything people have attached to the first review stays behind on it.

The case that prompted this: run `sa2008-v1-cc27-no-annotate` (runbook run `c6473037-a08f-41e3-b8b3-e2ee21cad89b`, `~/noetic/working/completeness-check/sa2008-v1-cc27-no-annotate`) ran with `annotate: false` and published review **`0bc96434-934e-4b3b-bdca-1094ff486b6b`** (192 comments, `is_current = true`, released 2026-10-09 12:16 UTC). We now want its comment markings, on that review.

Verified facts (prod `mgxqsrjutswbciyrltwd`, bureau `826585eda0`, 2026-10-12):

1. **Lane B only inserts.** `publish_review_cli.publish_section_shape` POSTs one `reviews` row and one bulk `review_comments` insert (`runbooks/lib/publish_review_cli.py:367-380`). `versioning: iterate` only bumps the run-root record's counter (`next_version`, `:155-161`); it never touches an existing row. `cc.py decision()` always asks for `iterate` (`runbooks/completeness-check/scripts/cc.py:585-592`).
2. **Delete-and-reinsert would destroy human work.** For review `0bc96434`'s comment ids:

   | Table → `review_comments.id` | Rows | `ON DELETE` |
   |---|---|---|
   | `comment_triage` (staff verdict overrides + notes) | **23** (3 overrides, 20 confirming notes) | CASCADE |
   | `ig_audit_scores` | 768 | CASCADE |
   | `review_checklist_comment_map` | 192 | CASCADE |
   | `ig_eval_data` | 192 | SET NULL |

   So an amend must **UPDATE rows in place and keep every `review_comments.id`**.
3. **Human verdicts live outside the model output.** `comment_triage.verdict_override` / `verdict_override_note` (the verdict-triage-split spec, winston #294) point at the comment by id. The model's verdict and text are `review_comments.output_json`. Updating `output_json` in place leaves every override and note attached and untouched.
4. **One comment per checklist item, always.** All 192 comments carry exactly one `sourceFindings[].ref` (e.g. `cc-1:CC-1-01`), and the 192 refs are distinct. Statuses: 93 pass, 70 not-applicable, 23 fail, 6 warn — a passing item still has a comment. So re-running any step that changes verdicts changes a comment's *content*, never the *set* of comments. The set changes only when the checklist changes.
5. **The checklist can drift under a re-run.** The run resolved `v2.7-trimmed` at bureau `fb64eb11`, tree `f59519178815…`. At bureau HEAD the same directory is tree `04e428d2…`. A run reads guides only from its own copy (`1.4-resolve/checklist/`), so voiding a step at 2.1 or later keeps the run's checklist. Voiding `1.4-resolve` re-copies from the live checkout and would silently swap it.
6. **The target review records its checklist.** `reviews.metadata` holds `checklistVersion` (`v2.7-trimmed`), `bureauArtifactPath` (`jurisdictions/austin/completeness-check/v2.7-trimmed`), `bureauCommitHash` and `runbookRunId`. It does not hold the tree hash, but `git rev-parse <bureauCommitHash>:<bureauArtifactPath>` reproduces it exactly (`f5951917…`).
7. **The run token can already do this.** The `workflow_run` role has SELECT/INSERT/UPDATE on `review_comments` and SELECT/UPDATE on `reviews`, both scoped to the claim's project, plus SELECT on `comment_triage`. A PostgREST upsert (`on_conflict=id`, `resolution=merge-duplicates`) needs INSERT + UPDATE, and both are granted. No new RPC or policy is needed.
8. **Rows can change after publish.** Two of the 192 rows (#82, #84) have `updated_at` 14 minutes after `created_at`. Their status, votes, text and sheets still match the run's envelope (`2.9-comments/review-comments.json`), so the touch looks mechanical, but an amend must not blindly overwrite a row someone has changed.

## Decisions

**D1 — Amend is opt-in. A new review stays the default.** A re-publish with no amend request lands a new draft review exactly as today. Amend is asked for in the request:

```json
"amend": { "reviewId": "<uuid>", "dryRun": true }
```

`dryRun` defaults to **true**. The first amend of any review is a plan only, and writing needs an explicit `"dryRun": false`.

**D2 — An amend takes effect immediately on a released review.** It updates the live rows. `is_current`, `released_at`, `prior_review_id` and the review's `id` are never written. There is no draft or re-release step (Will, 2026-10-12).

**D3 — Comments match by checklist item, not by number.** The key is the comment's single `sourceFindings[].ref`. Each run comment updates the existing row with the same ref. `comment_number` is rewritten from the run (it is stable whenever the item set is). A comment with zero or several refs, or a ref that appears twice on either side, is a refusal (CC never produces one; see fact 4).

**D4 — The checklist is frozen across an amend.** Refuse unless all of these hold:
- the run's `checklistVersion` equals the target's `metadata.checklistVersion`
- the run's `checklistsDir` equals the target's `metadata.bureauArtifactPath`
- the run's `checklistsTreeHash` equals the target's tree hash: `metadata.checklistsTreeHash` when present (D9 writes it from now on), else `git rev-parse <metadata.bureauCommitHash>:<metadata.bureauArtifactPath>` in `$BUREAU`. If that commit is not in the checkout, refuse; never guess.
- the run's checklist item refs are **exactly** the target's (no extra, no missing).

So `checklistVersion`, `checklistsDir` and `reviewFiles` cannot change under an amend, and neither can the guides' contents.

**D5 — Triage is never written.** The amend reads `comment_triage` only to report on it (D7). Overrides and notes survive by construction (fact 3). Example: run 1 says fail, staff override to pass with a note, the amend's run now says pass. The comment now shows the model's pass, and the override and its note are still there.

**D6 — Identity checks before anything is written.** Refuse unless the target exists and matches the run on `project_id`, `submission_version_id`, `review_type = completeness_check` and `output_schema = 2026-03-completeness-check`, and the run's envelope passes the same validation a normal publish runs (`publish_review.section_shape_review`, `--valid-refs`).

**D7 — The plan is a report, written every time.** Every amend, dry or not, writes `3.1-publish/amend-plan.json` and `3.1-publish/amend-report.md` before any write:
- the target, the checks from D4/D6 and their results
- per comment: whether it changes, a status flip (`fail → pass`), text changed, citations changed, markers added or removed
- **triage reconciliation** (read-only):
  - *override now agrees*: `verdict_override` equals the new model status. Fine; kept as the human record.
  - *override still differs*: kept, and still wins in the app.
  - *note on a changed verdict*: a triage row with a note and no override whose comment's status changed (e.g. "Correct, this needs to be fixed" on a comment that is now a pass). **Listed for staff to look at again.**
- drift (D8)

A dry run stops after the report and exits 0 having written nothing.

**D8 — Drift refuses.** The baseline is the envelope that last wrote the target (the uploaded `review-comments.json`, found from the run-root `review-publishing-record.json` when this run published the target, else from `metadata.reviewCommentsPath`, which D9 writes from now on). A row whose current `output_json` differs from its baseline, apart from the `section` slug lane B adds, was changed outside the run. Any drifted row refuses the whole amend and lists the rows. `amend.overwriteDrift: [<comment numbers>]` accepts named rows explicitly. When no baseline can be found, the report says so and the amend refuses unless `amend.noBaseline: true`.

**D9 — Write order, and making the next amend easier.**
1. Upload the run's envelope to `<project>/reviews/<svid>/<run>/v<N>/review-comments.json`. The earlier version's file stays where it is.
2. **One** PostgREST upsert of every changed comment row: `POST review_comments?on_conflict=id` with `Prefer: resolution=merge-duplicates`, body `{id, review_id, comment_number, output_schema, output_json}`. It is one statement, so it is atomic. Unchanged rows are not sent, so their `updated_at` stays.
3. `PATCH reviews?id=eq.<id>`: `output_json` (the run's `reviewData` + `sheet_map`, as a normal publish builds it), and `metadata` merged: the run's counts (`failCount`, `passCount`, …), `version: N`, `checklistsTreeHash`, `reviewCommentsPath`, `bureauCommitHash` of this run, and an appended `amendments[]` entry `{version, at, runbookRunId, changed, flips}`. Any other existing metadata key is kept.
4. Append `{version: N, mode: "amend", review_id: <same id>, …}` to the run-root `review-publishing-record.json`.

A normal (non-amend) publish also starts writing `checklistsTreeHash` and `reviewCommentsPath` into `metadata`, so later amends of new reviews need no git lookup or baseline guesswork.

**D10 — An amend can be re-run safely.** If step 3 fails after step 2 succeeded, the CLI exits 1 saying exactly that ("comments amended, review row not; re-run the amend"). Re-running it finds no comment changes, so step 2 sends nothing, and step 3 is applied. Nothing is half-reverted.

**D11 — Same-run and cross-run amends both work, under one rule.** The amend target is named explicitly, whether or not this run published it. Same-run (the common case: void a step, re-advance) passes D4 trivially unless `1.4-resolve` was voided. Cross-run (a new run aimed at an old review) must pass D4 against the old review's checklist, which in practice means pinning `checklistsDir` + the same bureau tree.

**D12 — IG is asked again.** `3.2-ig-postprocess` sends `ig/review.postprocess.requested` for the same review id, as after any publish. IG writes `ig_audit_scores` and `ig_eval_data` as upserts (`inspector-general/src/lib/data/audit-supabase-backend.ts`, `supabase-backend.ts`), so a re-send refreshes rather than duplicates. Confirm on the first real amend (Q2).

## How an operator runs one

```bash
R=<run dir>
# 1. Request: name the target; dryRun defaults to true. Edit 1.1-inputs/request.json AND
#    1.4-resolve/resolved.json (options.amend), since 1.4 already ran.
# 2. Re-run what changed, e.g. markings:
conductor void 2.12-annotate --fresh --run $R      # sets aside 2.12, 2.13, 2.10, 2.11, 3.1, 3.2
conductor advance --run $R --billing subscription
# 3. Read 3.1-publish/amend-report.md. Then set "dryRun": false and apply:
conductor void 3.1-publish --fresh --run $R        # sets aside 3.1 and 3.2
conductor advance --run $R --billing subscription
```

By hand, the same lane is `publish_review_cli.py … --amend-review-id <uuid> [--amend-apply]` (dry unless `--amend-apply`).

## First use: markings onto `0bc96434`

Run `sa2008-v1-cc27-no-annotate`: set `annotate: true` and `amend: {reviewId: "0bc96434-…", dryRun: true}` in both request copies, void `2.12-annotate --fresh` and advance (28 annotate sweep workers, Opus high, seat `personal`), read the report, then flip `dryRun` to false and void/advance `3.1-publish`. Expected report: 0 status flips, markers added on the fail/warn comments, 0 triage notes on changed verdicts, and #82/#84 either clean (content equal to the baseline) or named as drift.

## Scope

- **Completeness-check only.** Lane A (the August plan review, `import_*` RPCs) and CRC are out of scope; the matching rule (D3) is CC's one-comment-per-item property.
- **No comment added or removed by an amend.** D4 makes it impossible for CC. A future runbook whose comment set can change needs its own reconcile rule, which is deliberately not designed here.
- **No conductor change.** A verb that edits a finished run's request (instead of hand-editing 1.1 and 1.4) would be nice, but it is not needed.

## Open questions

- **Q1** — Drift (D8): is refusing the whole amend right, or should drifted rows be skipped and the rest applied? v1 refuses; it is the conservative choice while drift is rare (2/192 here, likely mechanical).
- **Q2** — IG re-send (D12): confirm `ig_review_runs`, `review_checklist_comment_map` and the audit scores refresh rather than duplicate on the first real amend.
- **Q3** — Should the app show that a review was amended (e.g. "updated 2026-10-12" from `metadata.amendments`)? Not needed for v1; staff can see it in metadata.
