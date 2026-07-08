# Agent 9 — `build-review-comments` Step Audit

Review `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d` · runLabel `2026_07_08_run_2_vision_exp` · 2026-07-08 · runs=5 · checklist v2.7-trimmed (194 items) · setCurrent=false
Step window: 16:25:19.239Z → 16:25:19.742Z (502 ms), completed.

**Verdict: HEALTHY**

---

## Step purpose

Final assembly step. Joins four upstream artifacts — `output/enriched-findings.json` (canonical per-item findings + forced-outcome metadata), `output/rephrased-items.json` (display titles), `output/consolidated-findings.json` (5-state vote metadata, per-run findings), `output/uncertain-explanations.json` (explain-uncertain prose) — into `output/review-comments.json`, the exact shape conductor's `saveReviewToDb()` persists to `reviews` / `review_sections` / `review_comments` and City Hall renders. Also assigns comment numbers, either from a checklist_id→number TSV map or sequentially.

## Script logic

As-ran script: `RUN_DIR/workflow/scripts/build-review-comments.ts` (446 lines). Key mechanics:

- **Canonical ref**: `checklistRef = ${grouping.id}:${finding.checklistItemId}` (line 206). This composite ref is the join key into `consolidatedMap` (line 238), `uncertainExplanations` (line 318), and the numbering map (line 286), and is stamped as `sourceFindings[0].ref` (line 346).
- **Rephrased-title join** (lines 212–217): composite-ref lookup first; **bare item-ID lookup remains as a counted legacy fallback** (`legacyRephrasedKeyHits`, warned at line 432–434). Final fallback is `finding.itemText`. This is the known bare-ID join — in this run it never fired (see evidence).
- **Numbering** (lines 97–124, 284–296): map is treated as not-provided when arg is empty or still contains `{{` (transitional guard for unrendered conductor templates, lines 98–104). **A provided-but-missing map file throws** (lines 106–112) — no silent sequential downgrade. Refs absent from a loaded map warn and take a fallback counter that starts above the max mapped number (lines 191–194, 287–293). Mode + counts are logged (lines 437–441) and stamped into `metadata.numbering` (lines 415–421).
- **Status precedence** (lines 259–273): forced status > consolidated 5-state status > `finding.status` (runs=1 passthrough). Metadata counts are loop-derived from the final effective status so uncertain items count only as uncertain (lines 195–201, 407–411).
- **What lands in output_json per comment** (lines 298–382): `commentNumber`, `title`, `status`, `tentativeStatus` (uncertain only), `voteBreakdown` (whenever a consolidated entry exists, incl. forced), `uncertainExplanation` / `agentTraceUncertainExplanation` (uncertain, non-forced only), `comment`, `citation`/`citationType`, `agentTrace` (observation/reasoning/tools_used/forced/forcedReason/organicStatus), sheet/document references, resolution text gated on the tentative verdict for uncertain items (spec D12, lines 279–282), and `sourceFindings[0].perRunFindings` with per-run status/emittedStatus/evidence.
- **Provenance** (lines 396–422): `checklistVersion`, `bureauCommitHash`, `bureauArtifactPath`, `totalItems`, five partitioned status counts, `uncertainThreshold`, and the explicit `numbering` block.

Workflow args (`RUN_DIR/workflow/workflow.yaml` lines 283–301) wire all of the above; `commentNumberingMapFile` uses the conductor #213 dotted-section syntax so an absent map renders empty → explicit sequential mode.

## What happened (evidence)

Log: `RUN_DIR/logs/completeness-check.log` lines 33797–33800.

- **Rendered command** (log line 33798): all args fully rendered, no `{{` residue. `--commentNumberingMapFile='/vercel/sandbox/workspace/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/pape-dawson-comment-num-mapping.tsv'`.
- **Stdout** (log line 33799):
  - `Loaded comment numbering map: 194 entries from …pape-dawson-comment-num-mapping.tsv` — **the TSV was found and used**.
  - `Loaded consolidated findings: 194 items` · `Loaded uncertain explanations: 19 items`.
  - `Built review-comments.json: 14 sections, 194 comments`
  - `Status: 99 pass, 7 fail, 4 warn, 65 n/a, 19 uncertain (threshold 0.35)` — exactly matches the pre-scan and `enriched-findings.json` totals.
  - `Numbering: mode=map (map-applied), mapFile=pape-dawson-comment-num-mapping.tsv, mapped=194, unmapped=0` — zero fallback numbers, zero unmapped-ref warnings.
  - **No** `legacy bare-ID` warning → `legacyRephrasedKeyHits = 0`.
- **Output verification** (`RUN_DIR/output/review-comments.json`):
  - 14 sections, **194 comments = 194 checklist items** (no inflation, no drops). `metadata.totalItems=194`; passCount/failCount/warnCount/notApplicableCount/uncertainCount = 99/7/4/65/19 — partition holds (sums to 194).
  - Provenance: `checklistVersion=v2.7-trimmed`, `bureauCommitHash=148418db653d868b77e87d0f203378890912bb82` (matches bureau commit containing v2.7-trimmed), `bureauArtifactPath=jurisdictions/austin/completeness-check/v2.7-trimmed`, `numbering={mode:map, mapFile:pape-dawson-comment-num-mapping.tsv, mappedCount:194, unmappedCount:0, reason:map-applied}`.
  - **Numbering integrity**: numbers span 1–202, zero duplicates. Gaps {47, 75, 80, 86, 88, 97, 142, 183} are **gaps in the TSV itself** (verified against `bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/pape-dawson-comment-num-mapping.tsv`: 194 entries, range 1–202, same gap set, no dupes). Output→TSV comparison: **0 mismatches**, ref sets identical in both directions. Mapped numbers fully honored.
  - **Titles**: all 194 refs present in `rephrased-items.json` (194 entries, 100% composite keys, 0 bare); 0 itemText fallbacks, 0 empty titles.
  - **Uncertain items**: all 19 carry `tentativeStatus` (11 fail / 5 pass / 3 n-a), `uncertainExplanation`, and `agentTraceUncertainExplanation` (uncertain-explanations.json had 19 entries, none null).
  - **Forced outcomes**: none in this run (0 comments with `agentTrace.forced`).
- **cc-2 missing-vote reconstruction** (`cc-2:CC-2-24`, commentNumber 191, title "Existing and proposed underground utility lines are shown on applicable sheets"):
  - `status=pass`, `confidence=medium`, `runCount=4/5`, `voteBreakdown={pass:4, fail:0, warn:0, not-applicable:0, missing:1}`.
  - `perRunFindings` lists run-1, run-3, run-4, run-5 (all pass). **run-2 is absent** — traced upstream: `output/runs/run-2/findings/cc-2.md.json` exists but contains only 5 of the cc-2 grouping's items (`CC-2-02, CC-2-14, CC-2-16, CC-2-21, CC-2-23`); `CC-2-24` was never emitted by the run-2 agent. The build step faithfully carried the consolidate step's `missing:1` accounting into `voteBreakdown`; nothing was lost at this step. (Root cause belongs to the review/consolidate step audits, not here.)
- **Duplicate analysis**: 0 duplicate refs, 0 bare (colon-less) refs, 0 bare-ID collisions across groupings → **zero bare+prefixed duplicate pairs**, consistent with the pre-scan's "zero fragmented refs."
- **Prior-review linkage** (`output/prior-review-comments.json`, fetched from `54d5c002-4648-4fb0-b22d-d222cbbd02f9` per log lines 1, 9, 11 — 185 comments):
  - 182 comment numbers shared; ref alignment holds on **180 of 182**.
  - **Drift is localized to numbers 112–113**: prior had `cc-15:CC-15-09a`→112 and `cc-15:CC-15-09b`→113; current v2.7-trimmed has `cc-15:CC-15-09`→112 and `cc-15:CC-15-14`→113. A checklist evolution (09a/09b merged; CC-15-14 re-slotted at 113), not a numbering bug. Number 113 now denotes a **different item** than in the prior review — relevant if any triage matches purely on comment_number.
  - Prior-only numbers {47, 142, 183} are items removed in v2.7 (three of the current TSV's gaps); current-only numbers {191–202} are 12 items added since the prior checklist. Alignment resumes after 113 with no cascade.
  - 30 shared refs changed status vs prior (e.g. `cc-2:CC-2-16` fail→pass, `cc-3:CC-3-21` pass→uncertain) — review-outcome variance, not a build-step concern.

## What went right

1. Map-mode numbering worked end to end: TSV found, 194/194 mapped, 0 unmapped, 0 fallback numbers, 0 duplicate numbers; output numbers byte-identical to the TSV.
2. All four joins were 100% clean on composite refs: rephrased (0 legacy bare-ID hits, 0 itemText fallbacks), consolidated (194/194), uncertain explanations (19/19), numbering (194/194).
3. Status accounting is coherent everywhere: script stdout == metadata counts == recomputed per-comment distribution == pre-scan (99/7/4/65/19), and the five counts partition 194.
4. The cc-2:CC-2-24 missing vote is fully documented in the output (`voteBreakdown.missing=1`, `runCount=4`, `confidence=medium`, 4-entry perRunFindings) — exactly the observability the schema intends.
5. Provenance complete: checklistVersion, bureauCommitHash, bureauArtifactPath, uncertainThreshold, and the explicit `numbering` block all stamped.
6. Uncertain handling per spec: 19/19 uncertain comments carry tentativeStatus + both explanation fields; resolution text correctly gated on tentative verdict.

## What went wrong

Nothing attributable to this step. Two adjacent observations, both upstream/contextual:

1. **run-2 under-emitted grouping cc-2** (5 of its items vs the other runs' fuller sets), producing the single `missing:1` vote on CC-2-24. Consolidation clamped it correctly; the 4–0 pass vote is unambiguous. Belongs to the review-step audit.
2. **Comment-number 113 semantic drift vs the prior review** (CC-15-09b → CC-15-14). Deliberate checklist evolution, but any comment_number-keyed triage carryover from `54d5c002` would mis-associate item 113 (and lose 47/142/183, gain 191–202). Worth a note for whoever runs the triage comparison.

## Salvageability

**Nothing needs repair.** The output is internally consistent, complete (194/194), correctly numbered, and fully provenance-stamped. No recipe required. If the run is ever promoted (`setCurrent` currently false), the only pre-promotion check worth doing is confirming City Hall's prior-review triage logic keys on checklist ref rather than bare comment_number, given the 112/113 drift.

## Observability gaps & remediations

The as-ran script already implements most of the historical wishlist (fail-hard on missing map file at lines 106–112; explicit numbering-mode log at lines 437–441 and metadata stamp at lines 415–421; legacy bare-ID hit counter at lines 213–216, 432–434). Remaining gaps:

1. **Comment count == checklist size assertion** — the script trusts `enriched.groupings`. Add: after assembly, `assert totalComments === expectedChecklistSize` (pass expected size as an arg or derive from the numbering map when provided) and fail the step on mismatch. Today a fragmented/inflated enriched file would flow straight to the DB.
2. **Refs ⊆ checklist / canonical-ref uniqueness** — no check that each `checklistRef` is unique or appears in the numbering map's key set. Add a `Set` collision check (throw on duplicate ref) and, in map mode, treat `unmappedRefCount > 0` as an error (or at least a distinct `reason: 'map-partial'`) rather than a warn — an unmapped ref in map mode is a checklist/TSV skew signal.
3. **Uncertain-share tripwire** — 19/194 ≈ 9.8% here (fine), but nothing alerts when uncertain share explodes (the 07-07 run had 189 uncertain from ID fragmentation). Add: `if (uncertainCount / totalItems > 0.25) console.warn/throw` with an override flag.
4. **Prior-alignment warning** — the step has `prior-review-comments.json` available in the workspace but never compares. A cheap check: load prior, compare refs at shared comment numbers, log `Prior-alignment: N/M shared numbers match; drift at [112,113]`. Would have surfaced the CC-15 drift at run time instead of at audit time.
5. **Missing-vote surfacing** — items with `voteBreakdown.missing > 0` are silent in stdout. One log line (`1 item with missing votes: cc-2:CC-2-24 (missing 1/5)`) would make the pre-scan's finding self-evident from the step log.

---

**Verdict: HEALTHY** — the step did exactly what it was designed to do, with clean joins, exact TSV numbering, complete provenance, and faithful propagation of the one upstream anomaly (cc-2:CC-2-24 missing run-2 vote).
