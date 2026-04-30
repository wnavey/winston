# Completeness-Check Anchored Re-Review — Plan

A re-review workflow for the completeness check (CC) discipline that anchors on
a prior CC review. Modeled on `bureau/jurisdictions/austin/workflows/review-anchored/`,
which already does this for technical reviews (SDUF, ZLU, TA).

## Why anchor

A fresh CC review against revised plans produces different comment numbers, headlines,
and section ordering — which makes a v2 review look like a totally different artifact
to the reviewer, even when 90% of the substance carries over. Anchoring preserves
the prior review's structure and only updates statuses where evidence changed.

Concrete value props:

- **Structural continuity.** Same comment numbers, same titles, same sections — a v2
  review reads as an update to v1, not a replacement.
- **Effort focused on changes.** Items whose referenced sheets/docs are unchanged
  short-circuit; only changed surfaces get re-examined by the agent.
- **Conservative status changes.** Burden of proof for flipping `fail → pass`. Multi-run
  majority vote with ties breaking toward prior status.
- **Regression detection scoped narrowly.** New findings only on changed sheets / changed
  docs — not "a second chance to find what v1 missed."

## Scope decisions (settled)

1. **One-to-one per CC item.** Each prior CC comment maps to exactly one re-evaluation
   via `sourceFindings[0].ref` (the `{grouping}:{checklistItemId}` key). No detail-level
   patching, unlike the SDUF anchored review which walks `details[]`.
2. **Configurable re-evaluation scope.** New `reEvaluateStatuses` input controls which
   prior statuses get re-evaluated. Default `"pass,fail,warn,not-applicable"` (re-evaluate
   everything). Allowed: any subset.
3. **Forced outcomes re-applied at finalize time.** The `forceOutcomes.tsv` overrides
   anything the agent decided, exactly like a fresh review.
4. **Document-change tracking.** Change manifest covers both sheets (from `sheet_version`)
   and supplementary docs (from `supplementary-docs/doc-changes.md`).
5. **Vision + semantic-search.** Both tools available to the re-review agent.
6. **Standard-note diffs punted.** Re-review may produce stale `resolutionDetails` for
   verbatim-note failures whose actual text changed; not handled in v1.
7. **Prior comments artifact already exists.** Conductor's `engine.ts:217-235` fetches
   `review_comments.output_json` for any `priorReviewId` and writes
   `output/prior-review-comments.json`. Generic across departments — no conductor change
   needed for CC.

## Conservative re-evaluation of prior passes

When `reEvaluateStatuses` includes `pass`, the prompt biases conservative: only flip
`pass → fail` if a referenced document/sheet was modified AND the agent can point to
specifically what changed. Otherwise we'd churn comments on every revision.

## Pipeline

Seven steps, mirroring `review-anchored` adapted for CC's flat one-comment-per-item model.

### 1. `prepare-change-manifest-cc` (script)

- Same Supabase query as review-anchored: `submission_version → submission_plan_set →
  plan_set_version → sheet_version`.
- **Extension:** also reads `supplementary-docs/doc-changes.md` from the workspace
  and merges into the manifest as a `documents[]` array (changeType: added/removed/replaced/unchanged).
- Output: `change-manifest.json` with `sheets[]` and `documents[]`.

### 2. `extract-prior-cc-findings` (new script)

- Reads `prior-review-comments.json` (CC shape, not SDUF shape).
- One prior finding per comment, indexed by `sourceFindings[0].ref`.
- Carries forward: `status`, `comment`, `resolution`, `citation`, `sheetReferences`,
  `documentReferences`, `commentNumber`, `title`.
- Annotates `sheetsChanged` / `documentsChanged` flags from the manifest.
- Applies the `reEvaluateStatuses` filter — only emits findings whose prior status is
  in the configured set.
- Groups by `grouping` (e.g., `cc-3`); writes one JSON file per checklist file in
  `prior-findings/`. Empty file for groupings with nothing to re-evaluate (so inject
  step never fails).

### 3. `anchored-review-runs` (agent, N parallel passes per checklist item)

- Tools: `vision` + `script:semantic-search-blocks` (same as fresh CC review).
- New prompt `review-cc-anchored.md`, modeled on the SDUF anchored review prompt and
  the existing CC `review.md`.
- Per grouping the agent gets: `priorFindings` for that grouping, `changeManifest`,
  the grouping markdown file.
- Per prior finding:
  - Sheets & docs unchanged → keep prior status (conservative).
  - Changed → re-evaluate to `pass | fail | not-applicable`.
  - `warn` is **not** an agent-emitted status. The agent emits `fail` for warn-eligible
    items; the warn overlay is re-applied at finalize.
- New findings only on changed sheets / changed docs (regression scope).
- Schema `cc-anchored.schema.json`:
  - `evaluations[]`: `priorStatus`, `currentStatus`, `statusChanged`, `observation`,
    `reasoning`, `tools_used`, `explanation`, `resolution`, `evidenceLocations`.
  - `newFindings[]`: matching CC's finding shape.

### 4. `reconcile-anchored-cc` (new script)

- Majority vote with conservative ties (ties → keep prior status).
- Adapted for CC statuses: pass / fail / not-applicable.
- New findings need ≥2 runs (skip when `runs=1` — single-run authoritative).
- Output `reconciliation.json` keyed by `{grouping}:{checklistItemId}`.

### 5. `patch-prior-comments-cc` (new script)

- Walks prior CC comments. For each:
  - Looks up reconciled evaluation by `sourceFindings[0].ref`.
  - Updates `status`, `comment`, `resolution`, `evidenceLocations` from reconciled output.
  - Sets `resolved: true` when `currentStatus === 'pass'` and prior was fail/warn.
  - Preserves `commentNumber`, `title`, `citation`, `applicableArea`.
- Appends `newFindings[]` as new comments. Comment numbering continues from
  `max(prior commentNumber) + 1`. Tagged with `isNewFinding: true`.
- Writes `patched-comments.json` and `changed-comments.json` (only items whose status
  actually changed, plus new findings).

### 6. `rewrite-explanations` (agent — Haiku)

- New prompt `rewrite-cc-explanations.md`.
- Different shape than the SDUF rewrite (no `summary` / `details[]` distinction).
- For CC: rewrite the `comment` field (user-facing explanation) when status changes:
  - `fail → pass`: "Cover sheet now includes the project address (Sheet 1)."
  - `pass → fail`: "Project address was removed from Sheet 1 in the revision."
  - `fail → fail` with new evidence: terse update referencing what's still missing.
- For `isNewFinding: true` comments, also generates a `title`.
- Schema: `{ rewrites: [{ commentIndex, title|null, comment }] }`.

### 7. `finalize-cc-re-review` (new script)

- Applies rewrites onto patched comments.
- **Re-applies forced outcomes** by invoking `apply-forced-outcomes` logic — the
  `forceOutcomes.tsv` overrides anything the agent decided.
- Re-applies `failStatus: warn` overlay from the checklist (same logic as
  `build-review-comments.ts:138-141`).
- Applies `commentNumberingMap` for any new findings (existing comments keep their
  prior numbers).
- Emits final `review-comments.json` in conductor's `reviewData` wrapper, with
  `reviewType: 'completeness_check'` and prior review linkage via `priorReviewId`.

## File layout

```
bureau/jurisdictions/austin/workflows/completeness-check-anchored/
├── workflow.yaml
├── prompts/
│   ├── review-cc-anchored.md
│   └── rewrite-cc-explanations.md
├── schemas/
│   ├── cc-anchored.schema.json
│   └── rewrite-cc-explanations.schema.json
└── scripts/
    ├── prepare-change-manifest-cc.ts
    ├── extract-prior-cc-findings.ts
    ├── reconcile-anchored-cc.ts
    ├── patch-prior-comments-cc.ts
    └── finalize-cc-re-review.ts
```

## Workflow inputs

- `submissionVersionId` (required) — revised plans
- `priorReviewId` (required) — prior CC review
- `runs` (default 1) — N independent passes
- `model`, `effort` — matching `completeness-check`
- `commentNumberingMap`, `forceOutcomes` — pass-through to finalize step
- `reEvaluateStatuses` (default `"pass,fail,warn,not-applicable"`) — comma-separated
  list of prior statuses to re-evaluate

## Code reuse

The review-anchored scripts and CC scripts are close enough to be tempting to share,
but the data shapes differ (CC flat vs SDUF nested, different statuses, doc-change
manifest, warn overlay, forced outcomes). Forking is cleaner than parameterizing.
Refactor into shared helpers when a third workflow needs them.

## Implementation status

PRs:

- winston: this plan doc — wnavey/winston#27
- bureau: workflow scaffold + scripts + prompts — noetic-inc/bureau#285

## Future improvements (deferred)

- **`bureauCommitOverride` conductor input.** Conductor's `engine.ts:208` pins
  bureau to `priorReview.metadata.bureauCommitHash` for any re-review. For SDUF
  this is correct (review-guides at the same path → commit *is* the version).
  For CC it's overkill — versions are already side-by-side directories
  (`v2.3-trimmed/`, `v2.4-trimmed/`, …). The pin can prevent backtests where
  the newer review used a newer checklist not present at the prior commit
  (e.g., 6e921f33 pinned to `66c5070a`, which has v2.3-trimmed but not
  v2.4-trimmed). A small conductor change to honor an explicit
  `bureauCommitOverride` input (or `bureauRef=HEAD`) would unblock cleaner
  backtests and any future anchored runs where the checklist has moved
  forward.

- **Doc-change tracking precision.** `extract-prior-cc-findings` flips
  `documentsChanged: true` for any comment that cites docs whenever any doc
  in the manifest changed. Match comment `documentReferences[]` to manifest
  entries by name once doc-name normalization is reliable.

- **LLM-rephrased forced outcomes.** `finalize-cc-re-review` re-applies the
  `forceOutcomes.tsv` by status override + raw TSV explanation. The fresh-
  review `apply-forced-outcomes.ts` calls Claude to generate natural
  observation/reasoning/explanation/resolution. Port that LLM step into the
  re-review finalize once we want polished forced-comment narratives.

- **Standard-note `resolutionDetails` re-diff.** Currently cleared when status
  changes; could be re-diffed against the revised plans to keep the rich UI
  payload accurate.
