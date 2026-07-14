# CRC Run Audit — Synthesis Summary

**Review audited:** `bfb4f256-27a2-4adc-8443-b942e3b4aa79`
**Submission version:** `6b9b85ed-e992-4906-a222-b24ee836910c`  ·  **Guides:** `6b9b85ed-e992-4906-a222-b24ee836910c` gen `6`
**Calibration test:** YES (submissionVersionId == crcGuidesSubmissionVersionId — implicit ground truth: every item should be `failed`)
**Run config:** 3 runs × 17 departments (24 split guide files, 72 review cells) · maxWorkers 35 · jurisdiction austin · model claude-haiku-4-5-20251001 · runLabel `2026-07-13-run-2-local-winston-test`
**Run location:** cloud artifacts (`workflow-runs/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-07-13-182144`), executed on a local conductor process and uploaded
**Audit date:** 2026-07-14
**Auditors:** sub-agents — performance/stability (1), vote variance (2), tool usage/observability (3), output quality (4, calibration mode, no-triage); synthesis by orchestrator

---

## TL;DR

**Overall health: DEGRADED** — the machinery ran clean, but the verdicts it produced did not.

- **Mechanically the healthiest CRC run audited to date**: completed in 49.3 min, all 72/72 cells valid, **retry storm NO (zero-event closure criterion MET)**, zero context compactions, 3 total errors all run.
- **Output-quality verdict: DEGRADED — 56 of 294 verdicts (19.0%) flagged as candidate agent failures.** On a calibration run every item should read `failed`; 56 came back `resolved`, and 21 of those were unanimous 3-0 at high confidence — majority voting cannot fix them.
- **Top risk:** a **consolidation-integrity bug** — `CA-19.1`'s majority was decided by a duplicated run-3 vote (honest vote 2-1 resolved; recorded 2-2, tie broken to failed). A rogue run-3 `crc-CA-1` worker also caused all 20 vote-count anomalies (missing, quadruple, and phantom votes).
- **Top win:** the structured-output retry storm is gone on haiku-4-5/gen-6 (0 `coercion_failed` events; the bug doc's closure criterion is met), and vision observability is better than believed — the sidecar logs both `promptText` and full `responseText`.

## What went well

- **Clean completion**: 72/72 cells produced valid findings JSON; consolidated 294 items (235/56/3) exactly matches the DB row. Only 3 level-50 errors in a 37,503-line log, all one recoverable cell.
- **Retry storm closed**: 0 coercion failures, 0 exhausted retries, 0 double-wrap signatures; all 72 cells took the benign lenient path (78 `inject_grouping` normalizations). Agent 1 recommends marking `STRUCT-OUTPUT-RETRY-STORM.md` closed for this config.
- **Zero compactions**: no cell approached the SDK auto-compaction threshold — the guide-splitting work is paying off.
- **62% unanimous** (181/294 items 3-0), with three departments (crc-aw-redlines, crc-LDE, crc-RW) perfectly unanimous.
- **Vision tool logs prompts AND responses** (`output/vision-log.jsonl`: `promptText`, `responseText`, `checklistItemIds`, tokens) — the presumed top observability gap doesn't exist.
- **Historical comparison ran** against both gen-6 priors, and the DB's `output_json` turned out to preserve full per-run votes for priors (5 runs each), enabling a real running-variance tally (880 rows).

## What needs attention / investigate — prioritized

**P0 — Consolidation integrity + the rogue crc-CA worker (Agents 1+2).**
Run-3's `crc-CA-1` cell emitted 32 findings out of its scope, double-voting 9 of `crc-CA-2`'s items; run-2's `crc-CA-1` dropped items CA-06.x–CA-09.x. Net effect: 11 coverage gaps, 9 quadruple-vote items, one self-contradicting cell (`CA-16.1` voted both ways), and **one wrong recorded majority (`CA-19.1`)**. The consolidator neither dedupes per-run votes nor caps votes at N. This is a code bug, not model noise. Detail: `crc-audit-agent-2-high-variance-writeup.md` § crc-CA anomaly cluster. Note Agent 1's per-run finding counts (291/283/303) corroborate the scope drift, and this run had **no** retry storm — so item-set drift is agent-behavioral, not a storm artifact.

**P1 — Output quality is DEGRADED, and voting can't fix the worst of it (Agent 4).**
56/294 (19.0%) false `resolved`; excluding the 10 upstream `atomization-incomplete` cases, agent-only rate is 15.6% — still DEGRADED. Dominant patterns: `mention-vs-demonstration` (22 — legends/callouts/self-reported totals accepted as proof, e.g. case 073 trusting the index's own "01 OF 52" footer against a 57-sheet set) and `self-uncertainty-not-escalated` (14 — worst: F-4/case 152 computed 1,404 < 1,500 GPM fire flow and still resolved at high confidence, 3-0). 35 of the 56 were 2-1 where the correct dissent was outvoted — connect to Agent 2's 25 chronic coin-flip items across all three gen-6 reviews: these are the same fragile population. Detail: `crc-audit-agent-4-output-quality-report.md` + `per-case/`.

**P1 — Checklist-ID fragmentation is polluting outputs across reviews (Agent 2).**
All 3 of this run's "uncertain" items are single-vote phantom IDs (`CA-17.1`, `CA-21.1`, `CA-22.1`) invented by run-3 while their canonical parents were also scored. The same mechanism fully explains the 291/295/294 item-count drift across the gen-6 reviews. Items should be validated against the guide's canonical ID set at findings-parse time.

**P2 — Vision error path is lossy and reason-free (Agents 1+3).**
The 3 vision errors (agent passed a PDF *filename* where `crc-vision-check` wants a document UUID) surface to the sidecar with no error reason — the raw Postgres uuid-cast error only exists in the error log, and a 4th tool failure (main log line ~12745) appears in **no** sidecar or error log. Exactly the "observability gap masking a real bug" pattern: validate the `documentId` param, log the caught exception message in the sidecar, and add `runIndex` to both sidecars.

**P2 — `tools_used` is unreliable self-report (Agent 3).**
5+ inconsistent spellings, 19 items claim vision with zero sidecar calls, 8 the reverse, 467 item-runs blank. Historical tool attribution inherits the same fidelity ceiling. Replace with orchestrator-side attribution derived from the sidecars.

**P2 — Wall-clock is one cell (Agent 1).**
Review step (96.4% of 49.3 min) literally equals its longest cell, run-2/`crc-SP-3` (2,851 s), on all three runs. Rebalancing the SP split could take the run to ~30 min; raising maxWorkers buys 0%.

## Cross-cutting insight

1. **Verdict-side guards beat more votes.** The two highest-coverage remediations (R-2 demonstration-over-attestation rule, R-1 hedge-escalation gate → `uncertain`) attack both Agent 4's failure patterns *and* Agent 2's chronic coin-flips at their shared root: the agent resolves on attestation or hedged reasoning. Note the per-run vote vocabulary is currently binary (failed/resolved) — R-1 requires letting individual runs vote `uncertain`.
2. **Trust the sidecars, fix their gaps.** Vision logging already captures prompt+response; adding error reasons + runIndex + orchestrator-side attribution makes every future audit (and every hidden bug like the filename/UUID trap) directly inspectable, and retires the misleading `tools_used` self-report.

## Per-agent verdicts

| Agent | Verdict | Headline | Report |
|---|---|---|---|
| 1 — Performance & stability | HEALTHY WITH NOTES | 49.3 min clean run; retry storm NO (closure MET); 0 compactions; tail-bound on crc-SP-3 | `crc-audit-agent-1-performance-stability.md` |
| 2 — Vote variance | (integrity bug found) | 95/294 split; crc-CA anomaly cluster incl. wrong `CA-19.1` majority; 41 hard flips across gen-6 reviews; drift = ID fragmentation | `crc-audit-agent-2-high-variance-writeup.md` + 2 TSVs |
| 3 — Tool usage & observability | (prompts/responses logged; attribution weak) | vision 282 / sem-search 85 / neither 517 item-runs (self-report); vision sidecar logs prompt+response; error path lossy | `crc-audit-agent-3-observability-report.md` + 2 TSVs |
| 4 — Output quality (calibration, no-triage) | DEGRADED | 56/294 = 19.0% false resolved (15.6% agent-only); top tags mention-vs-demonstration (22), self-uncertainty-not-escalated (14), atomization-incomplete (10); R-1/R-2/R-5 top remediations | `crc-audit-agent-4-output-quality-report.md` + 2 TSVs + traces + `per-case/` |

## Open questions / data limitations

- **History**: 6 prior CRC reviews of this submission version exist; only the two gen-6 ones (`d1ff47e7` 06-30, `47eca23e` 07-09) were guide-compatible and included; gen-1/2/5 reviews excluded. Priors carry 5 votes/item vs 3 here, and priors used `uncertain` for close votes — split rates aren't directly comparable across reviews.
- **No human triage** (0 `comment_triage` rows): Agent 4's classifications are LLM-judged from agent traces + guide text, not re-verified against the plan PDFs. The 3 uncertain verdicts were out of Agent 4's scope (they're phantom IDs anyway, per Agent 2).
- Tool-attribution fidelity is capped by the self-reported `tools_used` field (see P2).
- `RUN_DIR/workflow/status.json` reads `in-progress` in the storage snapshot — upload-ordering artifact, not a defect.

## Audit artifacts

All in `~/noetic/crc-audits/bfb4f256-27a2-4adc-8443-b942e3b4aa79/`:

- `crc-audit-agent-1-performance-stability.md`
- `crc-audit-agent-2-high-variance-writeup.md` · `crc-audit-agent-2-current-run-votes.tsv` (294 rows) · `crc-audit-agent-2-running-variance-all-runs.tsv` (880 rows)
- `crc-audit-agent-3-observability-report.md` · `crc-audit-agent-3-tool-usage-current.tsv` (882 rows) · `crc-audit-agent-3-tool-usage-running-tally.tsv` (294 rows)
- `crc-audit-agent-4-output-quality-report.md` · `crc-audit-agent-4-failure-cases.tsv` (56 rows) · `crc-audit-agent-4-remediations.tsv` (R-1…R-8) · `crc-audit-agent-4-agent-traces.jsonl` (56) · `per-case/` (56 detail files)
- `crc-audit-agent-5-synthesis-summary.md` (this file)
