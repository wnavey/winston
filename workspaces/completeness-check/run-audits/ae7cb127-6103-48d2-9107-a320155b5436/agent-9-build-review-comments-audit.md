# Agent 9 — `build-review-comments` step audit

**Review ID:** `ae7cb127-6103-48d2-9107-a320155b5436`
**Run label:** `2026_07_07_ROW_fix_take_1`
**Script:** `cc-run-output/workflow/scripts/build-review-comments.ts`
**Wall:** 0.6 s (584 ms per run-log at line 30299)
**Verdict:** **HEALTHY WITH NOTES**

---

## Step purpose

Terminal step of the CC workflow. Reads the four upstream artifacts (`enriched-findings.json`, `rephrased-items.json`, `consolidated-findings.json`, `uncertain-explanations.json`) and emits the single `output/review-comments.json` payload that conductor later hands to `saveReviewToDb()`. Assigns each item a stable comment number (from Pape-Dawson's canonical numbering TSV, with a monotonic fallback), stamps provenance (`checklistVersion`, `bureauCommitHash`, `bureauArtifactPath`, `uncertainThreshold`), and derives per-status metadata counts from the final effective status of every comment.

Note: this script does **not** insert into Supabase and does **not** read `prior-review-comments.json` (verified — grep on `supabase|createClient|insert` in `build-review-comments.ts:1-413` and `prior-review` in same → both empty). DB persistence and prior-comment triage are downstream conductor concerns; this step only produces JSON.

## Script logic (key branches, with line refs)

- L99–108: numbering-map load. Tab-split, skips header, tolerates missing file. Logs `Loaded comment numbering map: N entries` when present.
- L146–152: consolidated-findings load, gated on `parsedTotalRuns > 1` AND file exists. Keyed by composite `ref` (e.g. `cc-1:CC-1-01`).
- L164–173: uncertain-explanations load, tolerant of absent file. Logs entry count.
- L176–178: **fallback counter seeded above map max** — prevents collision if some checklist ref is not in the map.
- L188–366: per-grouping / per-item build.
  - L190: composite ref `grouping.id:finding.checklistItemId` — this is the join key everywhere downstream.
  - L196–200: rephrased-title lookup — composite first, bare-ID fallback (counted as `legacyRephrasedKeyHits`, warned at L404–406).
  - L254–256: **status precedence** — forced.forcedStatus > consolidated.status (5-state) > finding.status (runs=1 passthrough). Correct per DESIGN-SPEC §6.3.
  - L263–266: `showResolution` gated on `resolutionBasis`, which for uncertain items uses `tentativeStatus` — applicant still sees a suggested fix behind the uncertainty callout.
  - L269–277: **numbering assignment** — composite ref → map lookup; misses log a `WARNING` and fall back to the collision-free monotonic counter.
  - L297–307: uncertain-explanation prose stamped only when `effectiveStatus==='uncertain'` and the cell produced non-null fields.
- L385–393: metadata counts derived **loop-local** from `effectiveStatus`, not from `enriched.totals` — correctly avoids double-counting uncertain items into their tentative bucket.

## What happened

Comment count and structure:
- `jq '[.reviewData.sections[].comments|length]|add'` → **194 comments** across 14 sections. This matches the 194 checklist items exactly (from the bureau v2.7-trimmed manifest). The audit brief's expected ≈26 figure was wrong for CC review shape — every checklist item becomes one `review_comments` row (not only fail/warn/uncertain); the pass/N-A rows carry no applicant-visible callout but are stored for provenance and triage.
- Status distribution in output: **pass=107, fail=4, warn=6, uncertain=16, not-applicable=61** (sum 194). Matches `reviewData.metadata` exactly and matches the DB `reviews.metadata` totals cited in SHARED_CONTEXT.

Numbering integrity:
- Output `commentNumber`s: 194 values, all unique, range 1..202 with 8 gaps (47, 75, 80, 86, 88, 97, 142, 183).
- The map file `pape-dawson-comment-num-mapping.tsv` at `bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/pape-dawson-comment-num-mapping.tsv` has 194 rows (195 lines w/ header) with the **same 194 unique numbers over the same 1..202 range with the same 8 gaps** — the gaps are inherent to the canonical Pape-Dawson numbering, not a script bug.
- Sorted `(ref, commentNumber)` pairs from the output `diff` with the map file: **empty diff, exit 0** — every ref got its canonical number. **Zero fallback-counter (`commentNumber++`) assignments were made.**
- Set-comparison of the 194 refs in the output vs. the 194 refs in the map → both `comm -23` and `comm -13` empty. No silent join misses.

Rephrased-title join:
- `rephrased-items.json` has 194 keys, **all composite** (0 bare-ID keys). So `legacyRephrasedKeyHits == 0` — no crosstalk, no fallback warning.

Per-comment content shape (all 194 comments):
- `title`, `status`, `comment`, `citation`, `applicableArea` — 0 missing.
- `agentTrace`, `confidence`, `runCount`, `totalRuns`, `voteBreakdown` — 0 null.
- `sourceFindings[0].perRunFindings` length: **194/194 have exactly 5 entries** (matches `runs=5`, and matches Agent 1's pre-scan of zero missing votes).
- For all 16 uncertain comments: `voteBreakdown` present (16/16), `tentativeStatus` present (16/16), `agentTraceUncertainExplanation` present (16/16), applicant-facing `uncertainExplanation` present (**15/16**).
- For all 10 fail/warn comments: 9/10 carry a non-empty `resolution` string; **1 exception**: `cc-13:AW-29` (warn, comment #91) has `resolution == ""`. Not this script's fault — the upstream `enriched-findings.json` returned an empty resolution; the script correctly copies through.
- Forced comments: **zero** (`agentTrace.forced == true` filter → 0). This run has no forced-outcome TSV overrides taking effect, so precedence rules involving `forced` are dormant here.

DB write path / provenance:
- `build-review-comments.ts` contains **no** `supabase`, `createClient`, `insert`, or `review_comments` reference. DB insert is entirely downstream (conductor's `saveReviewToDb`).
- The rendered command in the run log (line 30298) has every `--*` argument fully substituted: no `{{ input.* }}` templating leaked. Provenance stamps written to `reviewData.metadata`: `checklistVersion=v2.7-trimmed`, `bureauCommitHash=a2adc8a1ce0c58a7849c71b3e99ecbcfe97506e1`, `bureauArtifactPath=jurisdictions/austin/completeness-check/v2.7-trimmed`, `uncertainThreshold=0.35` — all correct and matching workflow inputs.

## Root-cause analysis

Nothing failed. The script's own risk surface — bare-ID crosstalk in `rephrased`, silent fallback-counter drift when a ref misses the map, unrendered CLI args, uncertain metadata not copied through — was clean end-to-end on this run:

- The mapping TSV is **complete** (194/194 refs mapped) so the fallback branch (L274) was never exercised. If the map had been sparse, missed refs would still get collision-free numbers because the fallback counter is seeded at `max(mapValues) + 1` (L176–178) — good design.
- `rephrased-items.json` used composite keys, so the legacy bare-ID hit counter stayed at 0.
- All CLI args were rendered by conductor's template engine before invocation.
- Every `consolidatedMap` join hit — the 194 refs in the consolidated file (which Agent 2's cross-run-consolidate emitted with composite refs) were exactly the 194 refs enrich-findings produced.

## What went right

- **Perfect numbering fidelity** — 194/194 refs got their canonical Pape-Dawson number; downstream triage against `priorReviewId=54d5c002-…` will join cleanly on `comment_number`.
- **Perfect rephrased-key discipline** — 0 bare-ID keys, 0 legacy fallback hits.
- **Metadata counts partition totalItems** (107+4+6+61+16=194) and derive from the FINAL effective status, not from `enriched.totals` — so uncertain items are not double-counted into their tentative bucket.
- **`voteBreakdown`, `perRunFindings`, `tentativeStatus`, `agentTraceUncertainExplanation`** all propagate correctly to the uncertain callouts.
- **Provenance stamps** (`checklistVersion`, `bureauCommitHash`, `bureauArtifactPath`, `uncertainThreshold`) all present and correct.
- **No `{{ input.* }}` leakage** in the rendered CLI (line 30298 of the log).
- **Fallback counter is collision-safe** by design (seeded above map max) — a real property of the script, not luck.

## What went wrong

Small notes only:

1. `cc-13:AW-29` (warn, comment #91) has `resolution == ""`. Upstream (enrich-findings) did not populate a resolution for this fail/warn item. Not a build-review-comments defect, but the script has **no assertion** that fail/warn resolutions are non-empty — a missing resolution is silently rendered as an empty string.
2. `cc-23:CC-23-08` (uncertain, comment #168) has `agentTraceUncertainExplanation` but a null `uncertainExplanation`. This is by design (the explain-uncertain agent chose not to produce an applicant-facing string). Not a defect on this script's side; it correctly conditionally-stamps the field. Belongs to Agent 4.
3. **The script's own stdout is not captured** in the pino/JSON log. Its self-diagnostic lines (`Loaded comment numbering map: …`, `Loaded consolidated findings: …`, `Loaded uncertain explanations: …`, `Built review-comments.json: …`, `WARNING: … not found in numbering map`, `WARNING: N titles resolved via legacy bare-ID rephrased keys`) never made it into `logs/completeness-check.log`. Grep for any of those markers returns nothing. This is the **only real observability issue** — post-hoc auditors (like me) must re-derive everything the script already computed at run time.

## Observability gaps & remediations

- **G1 — Script stdout not captured.** Conductor swallows the script's `console.log`/`console.warn`. Remediation: pipe script stdout/stderr into the pino stream (`{step, level, msg}` per line), or emit a small JSON summary sidecar `output/build-review-comments.log.json`. Without this, the numbering-fallback and legacy-key drift indicators are invisible on the review side.
- **G2 — No assertion that comment count == checklist item count.** On this run it matched (194 == 194). If enrich-findings ever dropped an item, `build-review-comments` would silently emit fewer comments and only downstream DB row-count queries would notice. Remediation: assert `sum(perSection.comments.length) === enriched.totals.total` and hard-fail (or emit `ASSERTION` level).
- **G3 — No assertion that all refs ⊆ checklist manifest.** A fragmented ref (e.g. `cc-1:cc-1:CC-1-01`) would still be emitted as a comment and get a fallback-counter number. Remediation: cross-check every `checklistRef` against the loaded checklist manifest before emitting; log unknown refs.
- **G4 — Silent empty-resolution on fail/warn.** Remediation: when `showResolution === true` and `finding.resolution == null || finding.resolution === ''`, log a `warn` — even if we still emit the comment.
- **G5 — Numbering-mode not explicit.** The script chooses between "mapped" and "sequential" implicitly by `numberingMap.size > 0`. Remediation: emit a single line at the top of processing — `numberingMode=mapped|sequential mappedRefs=N fallbackStart=M` — so post-hoc analysis doesn't need to re-derive the state.
- **G6 — Prior-review linkage is not this script's job**, but nothing in the workflow logs asserts the alignment either. Remediation: a lightweight downstream step (or conductor `saveReviewToDb`) should log `priorAlignment: N/M refs matched by comment_number` for triage traceability.

## Verdict

**HEALTHY WITH NOTES.** The step did exactly what it was designed to do: 194 comments, all correctly numbered against the Pape-Dawson map (zero fallback assignments), all fields fully populated, metadata counts reconcile, provenance stamped, uncertain callouts carry their explanation prose and tentative verdict. The only defects are (a) captured-log observability (script stdout swallowed) and (b) absence of defensive assertions (comment-count, ref-membership, empty-resolution) that would let this same script fail loudly on a future bad upstream, rather than silently producing a plausible but wrong artifact. The user-visible risk on THIS run is zero; the risk on future runs is entirely bounded by whether upstream steps continue to be clean.

---

**Summary (~10 lines):**
- `build-review-comments.ts` ran in 584 ms and emitted `output/review-comments.json` with 194 comments across 14 sections — one per checklist item (the CC shape stores pass/N-A comments too, not only fail/warn/uncertain).
- Status distribution: pass=107, fail=4, warn=6, uncertain=16, N/A=61 — matches DB `reviews.metadata` exactly and metadata counts partition `totalItems`.
- Numbering: 194 unique `commentNumber`s, matching the Pape-Dawson TSV **perfectly** (`diff` empty). 8 gaps in 1..202 are inherent to the canonical map. **Zero fallback-counter assignments** — every ref was mapped.
- Rephrased-title join used composite keys throughout; 0 legacy bare-ID fallbacks.
- Every comment carries `agentTrace`, `voteBreakdown`, `confidence`, and 5 `perRunFindings` (matching `runs=5`). All 16 uncertain comments have `tentativeStatus` + agent-trace explanation; 15/16 also carry the applicant-facing `uncertainExplanation` (the 16th is a legit upstream decision, not this step's bug).
- One fail/warn comment (`cc-13:AW-29`, #91) has empty `resolution` — upstream enrich issue, not this step.
- This script does **not** insert to Supabase or read `prior-review-comments.json` — DB writes and prior-review triage are conductor concerns downstream. CLI args fully rendered (no `{{ input.* }}` leakage).
- Only real gap: the script's own `console.log`/`console.warn` output (numbering-mode banner, legacy-key warnings, fallback-counter warnings) is **not captured** in `completeness-check.log` — needs to pipe into pino.
- Verdict: **HEALTHY WITH NOTES**.
