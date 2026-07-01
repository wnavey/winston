# CRC Run Audit — Synthesis Summary

**Review audited:** `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e`
**Submission version:** `6b9b85ed-e992-4906-a222-b24ee836910c` (Lamar + Collier U0 v4)
**Guides:** `6b9b85ed-...` gen `6` (submissionId `cf1201c2-...`, u0VersionNumber 4)
**Calibration test:** **YES** (submissionVersionId == crcGuidesSubmissionVersionId — implicit ground truth = every item should `failed`)
**Run config:** 5 runs × 17 groupings (24 dept files) · 291 checklist items · maxWorkers 24 · model `claude-sonnet-4-6` · jurisdiction `austin`
**Run location:** cloud — `workflow-runs/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-06-30-222844`
**Audit date:** 2026-07-01
**Auditors:** four parallel sub-agents (performance/stability · vote variance · tool usage/observability · output quality)

---

## TL;DR — overall health: **DEGRADED**

- **Ran cleanly and produced every expected artifact** (5×24 = 120 review cells, all 291 items enriched, 90.5 min wall-clock). Performance dimension: **HEALTHY WITH NOTES**.
- **But 61 of 291 verdicts (21.0%) are candidate false positives** on the calibration invariant. Output quality dimension: **DEGRADED**.
- **The retry-storm closure criterion is MET for the review step** — 0 `agent.structured_output.coercion_failed` events across 120 review cells (conductor #197 held). 2 events surfaced in `enrich-final-comment` (Haiku, different signature); both recovered.
- **~34 % of candidate failures are "reasoning says failed, verdict says uncertain"** — `self-uncertainty-not-escalated` (21 cases). This is the single highest-leverage fix: a reasoning-verdict consistency gate.
- **Observability is the top structural gap.** Vision logs response text but not the rendered prompt; semantic-search doesn't log returned block IDs at all; only vision sidecar ties calls to atomic `checklistItemId`. Every downstream audit degrades to "grep the 121 MB pino log."
- Output-quality verdict: **DEGRADED** (61 of 291 candidate agent failures = 21.0%; threshold 15–35% DEGRADED).

---

## What went well

- **Completion & throughput.** Run ended cleanly in 90.5 min for 291 items × 5 runs. All 120 review cells `status="done"`; all 291 enrichment cells `status="done"`. Zero rate-limit hits. Only 2 errors + 4 warnings in the entire 121 MB main log.
- **Retry-storm fix held** for the review step. 0 `coercion_failed` events across 120 review cells — the closure criterion in `STRUCT-OUTPUT-RETRY-STORM.md` is met for that step. Conductor #197's lenient-schema canonicalization was exercised on every cell and worked.
- **Concurrency.** Effective in-flight parallelism averaged 18.97 / 24 (79%) during the review step — saturated at 24 workers for 57.9 min of the 84 min step.
- **Consensus signal.** 226 / 291 items (77.7%) came back unanimous across 5 runs — 199 unanimous-failed (correct on calibration) + 27 unanimous-resolved (candidate false-positives, but at least stable).
- **Vision reliability.** 538 vision calls, 100% success in the sidecar; only 1 vision call was rejected at the MCP-input layer (and that error is only visible in the main log — see observability gap below).
- **Multi-run voting caught real ambiguity.** 65 items split across the 5 runs (all 26 tight 3-2 / 2-3 splits ended up as `uncertain` at the majority level), correctly surfacing items the agent isn't confident about.

## What needs attention — prioritized

Verdicts land in a stack: **DEGRADED** overall, driven entirely by **output quality (Agent 4)**. Performance and stability are fine; the fixes here are mostly reasoning/prompt-level, plus observability.

### P0 — reasoning-verdict consistency (Agent 4, ~20 cases, LOW effort) — **the single top fix**

On this calibration run the agent's own reasoning text explicitly concludes "failed" or lists disqualifying gaps in **21 of 61 candidate failures**, yet the aggregated verdict is `uncertain` or `resolved`. This is Agent 4's `self-uncertainty-not-escalated` pattern (21 / 61 = 34%) and its proposed **R-03 reasoning-verdict consistency gate** — the highest-leverage remediation in the audit.

Cross-agent: this is exactly the population Agent 2 also saw as "26 tight 3-2 / 2-3 splits that all resolved to `uncertain` at the majority level." The consolidator's per-run vocabulary is only `resolved` / `failed`; the `uncertain` majority appears when the 5 runs tie or nearly tie. So R-03 attacks the pattern from the per-run side (before votes are aggregated) and would materially reduce both the output-quality failure rate AND the noise Agent 2 flagged. **Ship R-03 first.** Detail: `crc-audit-agent-4-output-quality-report.md` §Prioritized remediations.

### P0 — mention-vs-demonstration (Agent 4, 39 cases, MEDIUM effort)

The single largest failure pattern (39 / 61 = 64% of candidates). The agent treats a plan note that *states* a rule as proof the plan *demonstrates* compliance with that rule (e.g. a maintenance note saying "drawdown ≤ 24 hr" counted as proof the drawdown calc is ≤ 24 hr). Agent 4's **R-04** proposes a prompt-level guard requiring the agent to distinguish "the plan says X" from "the plan proves X." Detail: `crc-audit-agent-4-output-quality-report.md` §R-04.

### P1 — observability rebuild (Agent 3)

Every downstream diagnosis (retry storm, vision misreads, semantic-search retrieval quality, tool-error triage) is bottlenecked on grepping a 121 MB pino log. Concrete gaps:
- **Vision:** logs the model's response text and `checklistItemIds`, but NOT the rendered prompt. If Agent 4 finds a `vision-dimensional-misread` case, we cannot see what the tool was asked. **91 tool errors** in the main log are invisible in either sidecar (57 wrong-path Reads, 27 StructuredOutput parse failures, 3 schema failures, 3 enrichment "cohort-empty", 1 rejected vision call).
- **Semantic-search:** `:start` logs the query; `:result` logs only `resultCount + elapsed_ms` — no block IDs, no relevance scores, no `checklistItemId` attribution, no `tool_use_id` correlation between `:start` and `:result`. Effectively opaque.
- **Tool attribution normalization:** `tools_used[]` in `consolidated-findings.json` carries 5 different names for 2 tools — the "Applied tool attribution" step isn't normalizing.

Agent 3's #1 recommendation (unified per-tool-call JSONL keyed by `(tool_use_id, checklistItemIds, run)` capturing rendered prompt + raw response + tokens + elapsed + errorClass) closes all of these at once and unlocks debuggability for future audits. Detail: `crc-audit-agent-3-observability-report.md`.

### P1 — tail-latency: split crc-CA-2 and crc-SP-3 (Agent 1)

The review step is 93.1% of wall-clock (84.16 min of 90.5). A 26.9-min drain tail is dominated by two cells: **crc-CA-2** (avg 1658s, max 2174s) and **crc-SP-3** (avg 1600s, max 1991s). Both live in the 20-item bracket. Splitting them (Agent 1's rec) would let the tail parallelize and shorten wall-clock; the exact figures are in `crc-audit-agent-1-performance-stability.md` §Concurrency/throughput.

Cross-agent: this is the same **crc-SP** hot-spot Agent 2 flagged — crc-SP alone contains **11 of 15 tight (3-2) splits, all leaning "resolved"** (i.e. probable minority-verdict false positives). The single guide is both the slowest AND the noisiest. Splitting it attacks tail-latency AND per-item variance simultaneously.

### P2 — non-vacuous-N/A (Agent 4, R-01, 4 cases, MEDIUM effort)

A small but principled class: items like AW-1.1 / F-2.2 / SP-26.3 / SP-29 got `resolved` because the sub-item's precondition (Standard drawings in portrait orientation, one-way gates, supplemental zone, etc.) didn't apply to the plan — but the atomization dropped the parent MCR concern from every sibling too, so the concern is now uncovered by any item. Fix in atomization + agent prompt (`vacuous-N/A-from-atomization` novel pattern).

### P2 — enrichment retry-storm signature (Agent 1)

2 `coercion_failed` events in `enrich-final-comment` (Haiku), with a different signature than the closed review-step storm — wrapper key `enrichedFinalComment` or `__unparsedToolInput`, error `must have required property 'source'`. Both recovered on outer retry 1; ~12 wasted Haiku attempts. Extend conductor #197's structural repair to the enrichment schema before it grows.

### P2 — status.json terminal-write bug (Agent 1)

`status.json` in the workflow dir still reads `in-progress` after all 10 steps completed cleanly. Not a data issue but a monitoring/telemetry landmine — anything watching the file for termination will hang.

---

## Cross-cutting insight

Two connections drive most of the value:

**1. Reasoning-verdict inconsistency (R-03) is the pivot point.** Agent 4's top pattern (`self-uncertainty-not-escalated`, 34% of failures) is the same population Agent 2 sees as tight-split `uncertain` verdicts (all 26 of the 3-2 / 2-3 splits ended up `uncertain` at majority). The per-run agent is producing `failed`-flavored reasoning but a schema field then aggregates to something softer. Fixing this **once, at the per-run schema layer**, moves the output-quality failure rate down AND drops the vote-variance rate — a single prompt/schema fix that improves two audit dimensions.

**2. crc-SP is the concentrated hotspot.** It is simultaneously the slowest guide (Agent 1: crc-SP-3 in the tail), the noisiest (Agent 2: 18 splits, all 11 of the 3-2 minority-resolved splits are here), and the biggest contributor to Agent 4's `mention-vs-demonstration` pattern. Splitting `crc-SP-*` further (Agent 1's tail-latency rec) attacks all three dimensions.

Ship-order recommendation: **R-03 first (LOW effort, ~20 cases, cuts both output-quality failure rate and vote variance) → observability JSONL (unlocks the next audit) → crc-SP guide split (tail + variance + hotspot) → R-04 mention-vs-demonstration prompt guard → enrichment retry-storm structural repair**.

---

## Per-agent verdicts

| Agent | Dimension | Verdict | Headline |
|---|---|---|---|
| 1 | Performance & stability | **HEALTHY WITH NOTES** | 90.5 min, all cells produced, retry-storm closure met for `review` step (0 events / 120 cells), tail dominated by crc-CA-2 + crc-SP-3. `crc-audit-agent-1-performance-stability.md` |
| 2 | Vote variance | **HEALTHY WITH NOTES** | 226/291 unanimous (77.7%); 65 splits (22.3%); 26 tight 3-2 / 2-3 all resolved to `uncertain` at majority; crc-SP is the noisiest dept (18 splits, all 11 tight ones lean "resolved"). Historical comparison SKIPPED — prior CRC gens 1/1/2/5 incompatible with current gen 6. `crc-audit-agent-2-high-variance-writeup.md` |
| 3 | Tool usage & observability | **DEGRADED** | Vision logs response but not prompt; semantic-search doesn't log returned block IDs or item attribution; 91 tool errors invisible in either sidecar. `crc-audit-agent-3-observability-report.md` |
| 4 | Output quality (calibration) | **DEGRADED** | 61 / 291 candidate agent failures = 21.0%; top patterns: mention-vs-demonstration (39), self-uncertainty-not-escalated (21), scope-misinterpretation (13). `crc-audit-agent-4-output-quality-report.md` |

Overall run verdict (worst dimension governs): **DEGRADED**.

---

## Open questions / data limitations

- **No triage data** — 0 rows in `comment_triage` for this reviewId, so Agent 4 ran in no-triage mode. If a human triages this run afterwards, Agent 4's pattern classifications can be validated / refined against the triage notes.
- **Historical variance comparison omitted.** 4 prior CRC reviews exist for this submission_version (`7e79e197-...`, `3703349c-...`, `a8d07d22-...`, `1b2f8fa5-...`) but they used crc-guide generations 1 / 1 / 2 / 5 vs. the current 6 — checklist items don't line up, so per-item historical tallies would be misleading. Cross-generation *rate*-level trends (unanimous share, mean confidence) could still be computed if the team wants that view; it's out of scope here.
- **Vision-prompt content is not preserved anywhere** — if Agent 4's `vision-dimensional-misread` hypothesis is right for a specific case, we cannot verify what the vision model was asked without re-running the review. Agent 3's #1 recommendation closes this gap prospectively.
- **`consolidated-findings.json` schema drifted from the prompt template** — reasoning/observation live under `winningFinding.*` not `output_json.agentTrace.*`. Agent 4 adapted; the SKILL.md template should be updated to match.
- **No obvious structural bug is being masked by the observability gaps** on this run — but future runs won't be so lucky.

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
- `crc-audit-agent-4-output-quality-report.md`
- `crc-audit-agent-4-failure-cases.tsv` — 61 candidate failures
- `crc-audit-agent-4-remediations.tsv` — 6 remediations
- `crc-audit-agent-4-agent-traces.jsonl` — raw traces for the 61 candidates
- `per-case/001.md` – `per-case/061.md` — one detail file per audited candidate
- `crc-audit-agent-5-synthesis-summary.md` — this file

Working artifacts (may be pruned): `_run_artifacts/` (downloaded run outputs + 121 MB main log), `_guides/`, `_candidates_*.json`, `_classifications*.json`.
