# Agent 7 — `enrich-findings` step audit

**Review:** `ae7cb127-6103-48d2-9107-a320155b5436` · **Run label:** `2026_07_07_ROW_fix_take_1` · **Checklist:** `v2.7-trimmed` (14 groupings / 194 items) · **Runs:** 5 · **Baseline path** (no experiment overlay).

**Verdict: HEALTHY.**

---

## Step purpose

Join per-grouping `output/findings/cc-*.json` (already produced by `apply-forced-outcomes` on top of `cross-run-consolidate-cc`) with the source checklist markdown at `bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/cc-*.md`, and — when a consolidated-findings map exists — stamp the cross-run truth (`consolidatedStatus` / `tentativeStatus` / `voteBreakdown`) onto non-forced findings. Output: `output/enriched-findings.json`, consumed downstream by `format-reports` (rendering + rephrasing) and `build-review-comments` (DB payload).

**Explicitly out of scope for this step** (worth stating up front, because the task prompt conflated them with enrich):
- `uncertain-explanations.json` — joined in `build-review-comments.ts:159-171,299-302` (see agent-9 scope).
- `prior-review-comments.json` — not touched by any script here; the `priorReviewId` link lives at the conductor level (writes `reviews.prior_review_id`) so City Hall can surface prior-run `comment_triage` by comment_number.
- `pape-dawson-comment-num-mapping.tsv` — joined in `build-review-comments.ts:99-107` (agent-9 scope).
- `rephrased-items.json` — produced by the next step (`format-reports`) and consumed in `build-review-comments.ts:191-198` (agent-9 scope).

The pointed facts about prior-review linkage / numbering-map alignment therefore have nothing to do with this step; they are silently correct as far as enrichment is concerned because enrichment never sees them.

## Script logic (`workflow/scripts/enrich-findings.ts`, 282 lines)

- **Args:** `--findingsDir`, `--checklistsDir`, `--outputFile`, optional `--consolidatedFile` (line 112-125). All four resolved from workflow.yaml (`workflow/workflow.yaml:191-199`).
- **Consolidated map (optional):** if the file exists and is a file, entries are loaded into a `Map<ref, ConsolidatedEntry>` and logged (`enrich-findings.ts:129-134`). No warning / no error if file is absent — that's the runs=1 path.
- **Checklist load (line 150-170):** reads every `.md` in `checklistsDir`, uses `path.basename(file, '.md')` as `groupingId`, calls `extractTitle` (matches `^#\s+CC-\d+:\s*(.+)$`) and `extractChecklistItems` (grouping-scoped, keyed by bare `item.id`). Non-cc `.md` files would silently be pulled in as groupings — none present in this checklist dir.
- **Merge (line 176-259):** for each `findings/cc-*.json`, look up `titlesByGrouping[groupingId]` (fallback `'Unknown'`) and `itemsByGrouping[groupingId][f.checklistItemId]` (fallback `undefined`). On lookup miss:
  - `itemText` degrades to the raw checklist ID string (`meta?.itemText || f.checklistItemId`, line 237),
  - `condition` / `requirementSource` degrade to `''`,
  - `sourceType` degrades to `'citation'`,
  - **`failStatus` degrades to `'fail'`** — the warn-policy inversion hazard flagged in the brief.
- **Clamp:** enrich re-runs `clampStatus` per non-forced finding as a backstop (line 197-204). Any clamp fires here on a runs>1 path would indicate rule drift vs `cross-run-consolidate-cc`. The clamp emits a `CLAMP:` line to stdout.
- **Consolidated stamping (line 210-223):** only for non-forced findings; a mismatch between `consolidated.status` and post-clamp `status` (excluding `uncertain`) emits a `WARNING: … clamp-rule drift?` line.
- **Counts (line 227-232)** bucket on the DISPLAYED status (`consolidated?.status ?? status`) so uncertain items land in the `uncertain` bucket rather than their tentative verdict.
- **Diagnostics:** entirely `console.log` / `console.warn`. Conductor discards script stdout (only the "Executing script" command line + `duration` are captured in `logs/completeness-check.log:30236-30238`), so any `CLAMP:` / drift / `Loaded consolidated` lines this run emitted are unrecoverable — see observability gaps.

## What happened (evidence)

- **Wall-time:** 507 ms (`completeness-check.log:30236-30238`, `run-log.json` step 6). Matches the shared-context 0.5s.
- **Output shape (`output/enriched-findings.json`, 397 KB):**
  - `groupings.length = 14`, `totals.total = 194` (matches checklist item count and consolidated ref count).
  - `totals = { pass: 107, fail: 4, warn: 6, uncertain: 16, notApplicable: 61 }` — identical to DB metadata totals (`ae7c…`, shared context).
  - No duplicate refs (194/194 unique `grouping:checklistItemId`), no orphan groupings, no orphan items.
- **Enrichment coverage (all 194 findings):**
  - Grouping title populated: 14/14, zero `'Unknown'`.
  - `itemText` populated: 194/194, zero degraded (i.e., zero cases where `itemText == checklistItemId`).
  - `condition` populated: 194/194.
  - `requirementSource` populated: 194/194.
  - `sourceType` distribution: `{ document: 61, citation: 79, guideline: 54 }` — plausible; no residual defaults.
  - `failStatus` distribution: `{ fail: 177, warn: 10, 'fail-or-warn': 7 }` — no fall-through-to-default `'fail'` signature (the actual `fail` count matches known policy rows).
  - `consolidatedStatus` stamped: 194/194 non-forced (zero forced findings on this run since `forceOutcomes` was not supplied), including 16 `uncertain`. Perfect coverage of the multi-run stamping contract.
  - Zero cases where `consolidatedStatus != status` (excluding uncertain) → **no clamp-rule drift** between `enrich-findings` and `cross-run-consolidate-cc`.
- **Per-grouping counts internally consistent:** for every grouping, `pass+fail+warn+uncertain+notApplicable == total == findings.length`.
- **Bare-ID hazard:** verified zero colons in any `checklistItemId` across the 194 raw findings (a colon-prefixed ID would silently drop enrichment because enrich does NOT call `normalizeChecklistItemId` — only `cross-run-consolidate-cc` does). The consolidate step upstream already stripped any composite prefixes, so on this run the hazard is dormant.
- **Consolidated-file load:** file exists at `output/consolidated-findings.json` (194 entries, 16 uncertain), so the map-based stamping path executed; the `Loaded consolidated findings: 194 items from …` log line was printed and discarded.

## What went right

1. **Full join.** 194/194 items enriched with title, itemText, condition, requirementSource, sourceType, failStatus. Zero degraded fields anywhere in the output.
2. **Consolidated stamping is complete and consistent.** Every non-forced item (all 194) carries `consolidatedStatus` + `voteBreakdown`; totals bucket on displayed status; the 16 uncertain items are correctly reflected (no tentative-shaped status leaking through as a confident verdict).
3. **No clamp-rule drift.** The backstop clamp inside enrich agreed with cross-run-consolidate-cc on every finding — proof the two scripts remain in lock-step on Fail-Status policy.
4. **Fast + deterministic.** 507 ms with an in-memory join, no retries, no fallback branches taken.
5. **Bare-ID path correct on the data actually seen.** The known fragmented-ID failure signature is not present.

## What went wrong

Nothing that materialized on this run. The following are latent hazards in the code that are worth calling out to synthesis but did NOT trigger here:

1. **Silent lookup-miss degradation** (`enrich-findings.ts:187-249`). A missing checklist item causes:
   - `itemText → checklistItemId` (a raw ID leaks into `format-reports` markdown and `build-review-comments` as the comment title fallback),
   - `condition → ''`, `requirementSource → ''`, `sourceType → 'citation'`,
   - **`failStatus → 'fail'`** — this is the warn-policy inversion: an item authored as `warn` would be silently clamped as `fail`. On this run: not triggered (all 194 items resolved).
2. **No `normalizeChecklistItemId` call** in enrich. If a composite `{grouping}:{itemId}` slips past upstream normalization (e.g., an experiment overlay change to `cross-run-consolidate-cc`), enrich will match nothing and take the degradation path silently. Verified 0/194 IDs contain `:` on this run.
3. **All diagnostics go to stdout, which the conductor discards.** The `CLAMP:`, `WARNING: … clamp-rule drift?`, and `Loaded consolidated findings: …` lines are emitted but never surface to `logs/completeness-check.log` (only the shell-level `command` and `duration` records do — `completeness-check.log:30236-30238`). Zero visibility into whether a clamp / drift fired.
4. **Duplicate `.md` files in `checklistsDir` would silently override.** Enrich indexes `titlesByGrouping[basename]`; the numbering-map / forced-outcomes TSV files coexist in the same dir and are safely filtered by `.md` extension. But any stray `.md` file (say, a README) would surface as a phantom grouping with `title = 'Unknown'` and zero findings joined. Not present here.
5. **`totals.total` derived from displayed status, not from raw findings length.** Correct on this run (both = 194) but there's no invariant assertion. A silent drop (finding filtered out somewhere) would not be caught.

## Handoff contract & blast radius (for synthesis)

- **`format-reports` (next step):** consumes `enriched-findings.json` end-to-end for its markdown report and produces `rephrased-items.json`. Uses `itemText`, `condition`, `requirementSource`, `consolidatedStatus`, `voteBreakdown`, `explanation`, etc. Any enrichment miss would surface as `Unknown` titles or raw-ID item text in the markdown report — none on this run.
- **`build-review-comments`:** re-loads `enriched-findings.json` and joins `rephrased-items.json` + `uncertain-explanations.json` + `commentNumberingMap` + `consolidated-findings.json` itself (`build-review-comments.ts:87-107,159-171,299-302`). It also treats `itemText` as the title fallback when the rephrased map has no entry (`build-review-comments.ts:196-198`) — a degraded `itemText == raw ID` would surface as raw IDs in the DB. None on this run.
- **Not leaky in a bad sense** — `build-review-comments` re-reads consolidated only because it needs the full 5-run `perRunFindings` payload for `agent_trace`, which enrich never carried. That's a payload-shape choice, not enrichment failure.

## Observability gaps & remediations

1. **Emit a machine-readable step summary.** Have `enrich-findings.ts` write `output/enrich-findings.summary.json` with: `{ groupingCount, totalFindings, clampHits: [...], drifts: [...], consolidatedLoaded: bool, lookupMisses: [{ grouping, itemId }...] }`. Files are captured by the conductor as workflow artifacts; stdout is not.
2. **Fail-loud on lookup miss.** Introduce a `--maxLookupMisses` threshold (default 0). Every miss appends to the summary; exceeding threshold exits non-zero. Prevents the warn-policy inversion from silently reaching the DB.
3. **Never default `failStatus`.** On a miss, raise a hard error rather than defaulting to `'fail'`. If the intent is really "assume fail on a phantom item," gate it behind a flag with a summary entry.
4. **Assert ID cleanliness at ingest.** In `enrich-findings.ts`, throw if any `checklistItemId` contains `:`; the normalization contract is upstream and enrich should validate it. (Equivalently, call `normalizeChecklistItemId` and count strips into the summary.)
5. **Assert `totals.total === sum(findings.length across groupings) === consolidatedMap.size` (when the file is present).** Guards against silent dropping and against a stale consolidated file.
6. **Route `CLAMP:` / `WARNING: … clamp-rule drift` to structured log, not stdout.** Or at minimum, mirror them into the summary JSON so drift can be audited retroactively.
7. **Assert `groupingId` is `/^cc-\d+$/` when reading `checklistsDir/*.md`** to reject stray markdown files as phantom groupings.

## Verdict

**HEALTHY.** The enrichment executed correctly on all five dimensions relevant to this step: (1) join count matches source (194/194, no orphans/duplicates), (2) every enriched entry carries title + itemText + condition + requirementSource + sourceType + failStatus, (3) `consolidatedStatus` stamped on all 194 non-forced items including the 16 uncertains, (4) zero clamp-rule drift vs `cross-run-consolidate-cc`, (5) zero silent fallbacks fired. The prior-review-comments / numbering-map / uncertain-explanation joins referenced in the top-level charge live in `build-review-comments` (agent 9), not here. Latent observability gaps around silent lookup-miss degradation and stdout-discarded diagnostics warrant fixing but did not affect this run.

## Files cited

- `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/cc-run-output/workflow/scripts/enrich-findings.ts`
- `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/cc-run-output/workflow/scripts/checklist-policy.ts:45-125` (extractChecklistItems + failStatus parsing)
- `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/cc-run-output/workflow/scripts/build-review-comments.ts:99-107,159-171,191-198,299-302` (proof the uncertain / prior-review / numbering joins happen there, not in enrich)
- `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/cc-run-output/workflow/workflow.yaml` (enrich-findings step definition ~L191-199)
- `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/cc-run-output/output/enriched-findings.json`
- `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/cc-run-output/output/consolidated-findings.json`
- `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/cc-run-output/logs/completeness-check.log:30236-30238` (enrich step run record, only shell-level diagnostics captured)
