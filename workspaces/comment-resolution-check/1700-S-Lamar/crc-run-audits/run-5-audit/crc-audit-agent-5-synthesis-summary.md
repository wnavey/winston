# CRC Run Audit — Synthesis Summary

**Review audited:** `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e`
**Submission version:** `6b9b85ed-e992-4906-a222-b24ee836910c` (Lamar + Collier U0 v4)
**Guides:** `6b9b85ed-...` gen `6` (submissionId `cf1201c2-...`, u0VersionNumber 4)
**Calibration test:** **YES** (submissionVersionId == crcGuidesSubmissionVersionId — implicit ground truth = every item should `failed`)
**Run config:** 5 runs × 17 groupings (24 dept files) · 291 checklist items · maxWorkers 24 · model `claude-sonnet-4-6` · jurisdiction `austin`
**Run location:** cloud — `workflow-runs/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-06-30-222844`
**Audit date:** 2026-07-01 (P0 retagged 2026-07-01 — see §Correction)
**Auditors:** four parallel sub-agents (performance/stability · vote variance · tool usage/observability · output quality)

---

## Correction (2026-07-01) — R-03 retired

The original synthesis of this run promoted **R-03 (reasoning-verdict consistency gate)** as the single top fix, based on a mis-read of the CRC pipeline. The operator flagged that:

- Per-run review agents emit only `resolved` or `failed` — they never produce `uncertain`.
- The `uncertain` status is set exclusively by the cross-run consolidator (`cross-run-consolidate-crc.ts`) when the winning share of per-run votes drops at or below `1 − uncertainThreshold` (default 0.35). This is **by design** — see `crc-workflow/uncertain-status/DESIGN-SPEC.md` §5.

The original "reasoning-verdict mismatch" I diagnosed was actually the consolidator's `winningFinding` selection: for `uncertain` items with `tentativeStatus == failed`, `winningFinding.reasoning` legitimately concludes "failed" (that per-run agent voted correctly). The `uncertain` aggregate came from other per-run agents voting `resolved`. There is no reasoning-verdict mismatch to fix — the system is working as intended.

**R-03 is retired.** R-04 (mention-vs-demonstration guard, ~40 cases post-retag) becomes the top output-quality remediation. Two new remediations were added:

- **R-05** (audit resolved-side per-run findings for disputed items) — closes an audit-methodology gap: 11 cases where `winningFinding` came from the correctly-voting `failed` side, so this audit couldn't classify the actual failure pattern.
- **R-06** (universal-quantifier + vision-feature-hallucination guard) — bundles two smaller related patterns.

The headline failure rate (61 / 291 = 21.0 % → **DEGRADED**) is unchanged — the retag is a classification correction, not a rescoping.

Downstream artifacts updated: `crc-audit-agent-4-output-quality-report.md`, `crc-audit-agent-4-failure-cases.tsv`, `crc-audit-agent-4-remediations.tsv`, `crc-audit-agent-4-agent-traces.jsonl`, and the 21 affected `per-case/*.md` files (each now carries a "Corrected interpretation (2026-07-01)" hypothesis section). The observability observations from Agents 1, 2, and 3 are untouched.

---

## TL;DR — overall health: **DEGRADED**

- **Ran cleanly and produced every expected artifact** (5×24 = 120 review cells, all 291 items enriched, 90.5 min wall-clock). Performance dimension: **HEALTHY WITH NOTES**.
- **But 61 of 291 verdicts (21.0%) are candidate false positives** on the calibration invariant. Output quality dimension: **DEGRADED**.
- **The retry-storm closure criterion is MET for the review step** — 0 `agent.structured_output.coercion_failed` events across 120 review cells (conductor #197 held). 2 events surfaced in `enrich-final-comment` (Haiku, different signature); both recovered.
- **Top failure pattern is `mention-vs-demonstration`** — 40 of 61 candidate failures. The per-run agent finds a plan artifact that *mentions* the required concept and votes `resolved` without verifying the artifact *demonstrates* code compliance. This is Agent 4's **R-04** guard.
- **Observability is the second structural gap.** Vision now logs the rendered prompt (conductor #208, merged); semantic-search now logs returned block IDs + `checklistItemId` attribution (bureau #488, merged). Remaining gap: the 91 tool errors that live only in the main pino log — see Agent 3's #1 recommendation.
- Output-quality verdict: **DEGRADED** (61 of 291 candidate agent failures = 21.0%; threshold 15–35% DEGRADED).

---

## What went well

- **Completion & throughput.** Run ended cleanly in 90.5 min for 291 items × 5 runs. All 120 review cells `status="done"`; all 291 enrichment cells `status="done"`. Zero rate-limit hits. Only 2 errors + 4 warnings in the entire 121 MB main log.
- **Retry-storm fix held** for the review step. 0 `coercion_failed` events across 120 review cells — the closure criterion in `STRUCT-OUTPUT-RETRY-STORM.md` is met for that step. Conductor #197's lenient-schema canonicalization was exercised on every cell and worked.
- **Concurrency.** Effective in-flight parallelism averaged 18.97 / 24 (79%) during the review step — saturated at 24 workers for 57.9 min of the 84 min step.
- **Consensus signal.** 226 / 291 items (77.7%) came back unanimous across 5 runs — 199 unanimous-failed (correct on calibration) + 27 unanimous-resolved (candidate false-positives, but at least stable).
- **Consolidator working as designed.** 26 tight 3-2 / 2-3 splits correctly surfaced as `uncertain` at the majority level. The `uncertain` band is exactly the dispute-surfacing behavior the design spec calls for — the presence of these `uncertain` verdicts is a strength of the pipeline, not a bug.
- **Vision reliability.** 538 vision calls, 100% success in the sidecar; only 1 vision call was rejected at the MCP-input layer (invisible in the sidecar — see observability P1).
- **Multi-run voting caught real ambiguity.** 65 items split across the 5 runs.

## What needs attention — prioritized (post-retag)

Verdicts land in a stack: **DEGRADED** overall, driven entirely by **output quality (Agent 4)**. Performance and stability are fine; the fixes are per-run-review-prompt edits plus one methodology follow-up.

### P0 — mention-vs-demonstration guard (Agent 4, 40 cases, MEDIUM effort) — **the single top fix**

The largest single failure pattern (**40 of 61 candidates, 65 %** — up from 32 pre-retag as `mention-vs-demonstration`-primary items previously co-tagged with `self-uncertainty-not-escalated` collapsed into this bucket). The per-run agent finds a plan note or callout that *mentions* the required concept and votes `resolved` without checking whether the artifact *demonstrates* compliance. Examples span the whole severity spectrum — EV-01/02 (verbatim watershed and EARZ notes on cover), TPW-1 (SIF note), SP-30.1/30.2/30.3 (Key Note 7 labelled "PROPOSED BUILDING ENTRANCE" treated as proof of a customer-facing principal-street entrance connected to the sidewalk).

Agent 4's **R-04** is the fix: a two-step decision in the per-run review prompt. (1) *Have you found the artifact the checklist asks for?* (2) *Does the artifact you found substantively demonstrate the code criterion, or merely mention the topic?* Only pass at step 2. Require the agent to quote the specific plan text/dimension/callout that satisfies the requirement, not the general presence of a document.

Detail: `crc-audit-agent-4-output-quality-report.md` §R-04.

### P0 — observability rebuild (Agent 3, partially delivered)

Every downstream diagnosis (retry storm, vision misreads, semantic-search retrieval quality, tool-error triage) was bottlenecked on grepping a 121 MB pino log. As of 2026-07-01 two of the three top gaps are closed:

- **Vision** — rendered prompt now logged per call. **Delivered: conductor #208 (merged).**
- **Semantic-search** — `:start`/`:result` now paired via `queryId`, `:result` now includes block IDs + relevance, and both events carry `checklistItemId` for atomic-item attribution. **Delivered: bureau #488 (merged).**

Remaining gap: the 91 tool errors that live only in the main pino log (57 wrong-path Reads, 27 StructuredOutput parse failures, 3 schema failures, 3 enrichment "cohort-empty", 1 rejected vision call). Agent 3's #1 recommendation (unified per-tool-call JSONL keyed by `(tool_use_id, checklistItemIds, run)` capturing rendered prompt + raw response + tokens + elapsed + errorClass) covers this. Follow-up PR needed.

Also unresolved: **tool-attribution normalization**. `tools_used[]` in `consolidated-findings.json` carries 5 different names for 2 tools — the "Applied tool attribution" step isn't canonicalising. Small cleanup.

Detail: `crc-audit-agent-3-observability-report.md`.

### P1 — audit-methodology fix: read the resolved-side per-run findings (R-05, 11 cases)

11 of the 26 `uncertain` candidate failures were retagged `dispute-resolved-side-not-audited` after the R-03 correction. On these, `winningFinding` came from the correctly-voting `failed` side, so Agent 4's audit read the *right* reasoning and could not classify the actual failure pattern. The real failure lives on the resolved-side per-run findings — which this audit didn't systematically examine.

**R-05** proposes a targeted follow-up: an Agent-4-style pass with prompt scope extended to include losing-side per-run findings, not only `winningFinding`. Cheap (11 refs' resolved-side reasoning to classify), and preview based on which refs appear here (DE-23 legibility judgment, SP-41 amenity labelling, SP-48 courtyard plan) suggests most will fold into R-04 — but rather than guess, R-05 asks the follow-up to actually classify.

Structural fix on the audit-crc-run skill: update `prompts/agent-4-output-quality.md` so future calibration-test audits automatically read both cohorts of `uncertain` items.

### P1 — tail-latency: split crc-CA-2 and crc-SP-3 (Agent 1)

The review step is 93.1% of wall-clock (84.16 min of 90.5). A 26.9-min drain tail is dominated by two cells: **crc-CA-2** (avg 1658s, max 2174s) and **crc-SP-3** (avg 1600s, max 1991s). Both live in the 20-item bracket. Splitting them (Agent 1's rec) would let the tail parallelize and shorten wall-clock; the exact figures are in `crc-audit-agent-1-performance-stability.md` §Concurrency/throughput.

Cross-agent: this is the same **crc-SP** hot-spot Agent 2 flagged — crc-SP alone contains **11 of 15 tight (3-2) splits, all leaning "resolved"** (i.e. probable minority-verdict false positives). The single guide is both the slowest AND the noisiest. Splitting it attacks tail-latency AND per-item variance simultaneously.

### P2 — universal-quantifier + vision-feature-hallucination guard (R-06, 6 cases, MEDIUM effort)

A merged remediation covering two smaller adjacent patterns: `any-vs-most-quantifier` (rule requires universal compliance ["at any point", "every", "all"] but agent reasoning used "most" / "substantially") and `vision-feature-hallucinated` (reported features not on the plan). Add prompt clauses that (a) when the rule uses a universal quantifier, enumerate the cases rather than sampling; (b) require corroboration from a text-side observation before treating a vision claim as evidence of presence.

### P2 — non-vacuous-N/A (R-01, 4 cases, MEDIUM effort)

Items like AW-1.1 / F-2.2 / SP-26.3 / SP-29 got `resolved` because the sub-item's precondition (Standard drawings in portrait orientation, one-way gates, supplemental zone, etc.) didn't apply to the plan — but the atomization dropped the parent MCR concern from every sibling too, so the concern is now uncovered by any item. Fix in atomization + agent prompt (novel pattern: `vacuous-N/A-from-atomization`).

### P2 — enrichment retry-storm signature (Agent 1)

2 `coercion_failed` events in `enrich-final-comment` (Haiku), with a different signature than the closed review-step storm — wrapper key `enrichedFinalComment` or `__unparsedToolInput`, error `must have required property 'source'`. Both recovered on outer retry 1; ~12 wasted Haiku attempts. Extend conductor #197's structural repair to the enrichment schema before it grows.

### P2 — status.json terminal-write bug (Agent 1)

`status.json` in the workflow dir still reads `in-progress` after all 10 steps completed cleanly. Not a data issue but a monitoring/telemetry landmine — anything watching the file for termination will hang.

### Separate concern — enrich-final-comments step is effectively broken

Not a P-ranked bullet here because it's covered by its own dedicated report (**Agent 6**). Bureau PR #476 added `prepare-enrichment-inputs` → `enrich-final-comment` → `collect-enriched-final-comments`; on this run 252 of 291 review_comments (86.6%) have `enrichedFinalComment: null`, and 38 of the 39 non-null enrichments are misattributed to a different checklist item's content. Root cause: the prompt tells Haiku to read `output/enrichment-inputs/{ref-slug}.json` but `{ref-slug}` is a literal placeholder that never gets substituted. Detail + fix plan in `crc-audit-agent-6-enrich-final-comments-audit.md`.

---

## Cross-cutting insight

**crc-SP remains the concentrated hotspot.** It is simultaneously the slowest guide (Agent 1: crc-SP-3 in the tail), the noisiest (Agent 2: 18 splits, 11 of the 15 tight 3-2 splits are here, all leaning "resolved"), and the biggest contributor to Agent 4's `mention-vs-demonstration` pattern (14 of 40 R-04 cases are crc-SP:*). Splitting `crc-SP-*` further attacks all three dimensions.

**Ship-order recommendation** (updated post-retag):

1. **R-04** (mention-vs-demonstration guard) — top output-quality lever, 40 / 61 candidate failures, per-run prompt edit.
2. **Observability follow-up** — unified per-tool-call JSONL for the remaining hidden tool errors. Builds on the merged conductor #208 + bureau #488.
3. **R-05** (audit resolved-side per-run findings for disputed items) — closes the audit-methodology gap; also update the audit-crc-run skill so future calibration audits do this natively.
4. **crc-SP guide split** — attacks tail-latency and vote-variance and pattern concentration.
5. **R-06** (universal-quantifier + vision-feature-hallucination guard) — smaller but principled.
6. **Enrich-final-comment fix** — see Agent 6's R-6-1 (substitute `{{ checklistItem }}` into the prompt file). Independent of R-04 etc.
7. **Enrichment retry-storm structural repair** — extend conductor #197 to the enrichment schema.

---

## Per-agent verdicts

| Agent | Dimension | Verdict | Headline |
|---|---|---|---|
| 1 | Performance & stability | **HEALTHY WITH NOTES** | 90.5 min, all cells produced, retry-storm closure met for `review` step (0 events / 120 cells), tail dominated by crc-CA-2 + crc-SP-3. `crc-audit-agent-1-performance-stability.md` |
| 2 | Vote variance | **HEALTHY WITH NOTES** | 226/291 unanimous (77.7%); 65 splits (22.3%); 26 tight 3-2 / 2-3 correctly surfaced as `uncertain` at majority (this is by-design consolidator behavior, not agent hedging); crc-SP is the noisiest dept (18 splits, all 11 tight ones lean "resolved"). Historical comparison SKIPPED — prior CRC gens 1/1/2/5 incompatible with current gen 6. `crc-audit-agent-2-high-variance-writeup.md` |
| 3 | Tool usage & observability | **DEGRADED → HEALTHY WITH NOTES** post-merges | Vision prompt now logged (conductor #208 merged); semantic-search now attributes to checklistItemId + logs block IDs (bureau #488 merged); remaining gap: 91 tool errors still only in main pino log. `crc-audit-agent-3-observability-report.md` |
| 4 | Output quality (calibration) | **DEGRADED** | 61 / 291 candidate agent failures = 21.0%; top patterns (post-retag): mention-vs-demonstration (40), scope-misinterpretation (13), dispute-resolved-side-not-audited (11 — audit-methodology gap, not a per-run pattern). `crc-audit-agent-4-output-quality-report.md` |
| 6 | Enrich-final-comments audit | **FAILED for the launch of PR #476** | 86.6% missing, 97.5% of the 39 non-null enrichments are misattributed to a different checklist item's content. Root cause: unrendered `{ref-slug}` in enrich prompt. `crc-audit-agent-6-enrich-final-comments-audit.md` |

Overall run verdict (worst dimension governs): **DEGRADED**.

---

## Open questions / data limitations

- **No triage data** — 0 rows in `comment_triage` for this reviewId, so Agent 4 ran in no-triage mode. If a human triages this run afterwards, Agent 4's pattern classifications can be validated / refined against the triage notes.
- **Historical variance comparison omitted.** 4 prior CRC reviews exist for this submission_version (`7e79e197-...`, `3703349c-...`, `a8d07d22-...`, `1b2f8fa5-...`) but they used crc-guide generations 1 / 1 / 2 / 5 vs. the current 6 — checklist items don't line up, so per-item historical tallies would be misleading. Cross-generation *rate*-level trends (unanimous share, mean confidence) could still be computed if the team wants that view; out of scope here.
- **Resolved-side per-run reasoning for 11 disputed items was not audited** — see R-05. This audit read `winningFinding.reasoning` only, which is the majority-side per-run agent. For `uncertain` items with `tentativeStatus == failed`, that means the failure sits on the unaudited resolved-side per-run findings.
- **`consolidated-findings.json` schema drifted from the prompt template** — reasoning/observation live under `winningFinding.*` not `output_json.agentTrace.*`. Agent 4 adapted; the `audit-crc-run` skill's `prompts/agent-4-output-quality.md` should be updated to match, and to fetch both cohorts on `uncertain` items (see R-05).

---

## Audit artifacts

All under `/Users/wnavey/noetic/crc-audits/d1ff47e7-7c77-4a54-9d1c-4d6bae26046e/`:

- `crc-audit-agent-1-performance-stability.md`
- `crc-audit-agent-2-current-run-votes.tsv` — 291 rows, high-variance sorted first
- `crc-audit-agent-2-running-variance-all-runs.tsv` — 291 current-run rows (historical omitted; see file header comment)
- `crc-audit-agent-2-high-variance-writeup.md`
- `crc-audit-agent-3-tool-usage-current.tsv` — 1,455 rows (291 items × 5 runs)
- `crc-audit-agent-3-tool-usage-running-tally.tsv` — 291 rows (historical omitted)
- `crc-audit-agent-3-observability-report.md`
- `crc-audit-agent-4-output-quality-report.md` — **updated 2026-07-01** post-retag
- `crc-audit-agent-4-failure-cases.tsv` — 61 candidate failures, retagged
- `crc-audit-agent-4-remediations.tsv` — **7 remediations post-retag** (R-03 retired; R-05 and R-06 added; R-04 promoted to top)
- `crc-audit-agent-4-agent-traces.jsonl` — retagged
- `per-case/001.md` – `per-case/061.md` — 21 files updated with a "Corrected interpretation (2026-07-01)" hypothesis section
- `crc-audit-agent-5-synthesis-summary.md` — this file (updated 2026-07-01)
- `crc-audit-agent-6-enrich-final-comments-audit.md` — separate dedicated audit of bureau PR #476's enrich pipeline

Working artifacts: `_run_artifacts/` (downloaded run outputs + 121 MB main log), `_guides/`, `_retag_log.json`, `_candidates_*.json`, `_classifications*.json`.
