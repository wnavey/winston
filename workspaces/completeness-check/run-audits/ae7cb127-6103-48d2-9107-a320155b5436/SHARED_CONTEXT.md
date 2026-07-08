# Shared context for audit sub-agents

## Identity
- **Review ID:** `ae7cb127-6103-48d2-9107-a320155b5436`
- **Project ID:** `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`
- **Run label:** `2026_07_07_ROW_fix_take_1`
- **Prior review ID (for triage):** `54d5c002-4648-4fb0-b22d-d222cbbd02f9`
- **Ran:** 2026-07-07T17:57:41Z → 18:17:07Z (~19m 26s wall)
- **DB status:** `completed` (workflow_run_id `9d3bbd5c-f3be-446f-a67a-f88d9092ec7b`); note workflow/status.json still shows `in-progress` — final state file was never re-uploaded at end.
- **DB metadata result totals:** total=194, pass=107, fail=4, warn=6, uncertain=16, notApplicable=61.

## Inputs (from `workflow/status.json`)
- runs=5, model=`claude-haiku-4-5-20251001`
- checklistVersion=`v2.7-trimmed` (14 groupings, 194 items)
- maxWorkers=35, uncertainThreshold=0.35
- explainUncertain=true, uncertainExplanationModel=`claude-sonnet-4-6`, uncertainExplanationMaxWorkers=10
- enabledVisionSpecialists=`generic-vision,inspect-drawing,measure-distance`
- reviewSchemaName=`review`, reviewPromptName=`review` → **baseline path, no experiment overlay**
- commentNumberingMap=`pape-dawson-comment-num-mapping.tsv`
- setCurrent=false, so this run is not the "current" review pointer.

## Paths
- **RUN_DIR:** `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/cc-run-output/`
- **AUDIT_OUT:** `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/`
- **Bureau checklist:** `/Users/winston/noetic/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/`
- **Local bureau HEAD == run's `bureauCommitHash`** (`a2adc8a1c`). No drift.

## Step wall-times (from `workflow/run-log.json`)
| # | Step | Wall | Items |
|---|---|---|---|
| 0 | review | 13m 38s | 70 (5×14) |
| 1 | cross-run-consolidate-cc | 0.6s | — |
| 2 | apply-forced-outcomes | 0.7s | — |
| 3 | prepare-uncertain-explanation-inputs | 0.5s | — |
| 4 | explain-uncertain | 2m 59s | 16 |
| 5 | collect-uncertain-explanations | 0.6s | — |
| 6 | enrich-findings | 0.5s | — |
| 7 | format-reports | 2m 41s | — |
| 8 | build-review-comments | 0.6s | — |

## Pre-scan headline (verify, don't re-derive)
- **Every cell fully populated:** all 5 runs × all 14 groupings emitted the correct item count per grouping.
- **All checklist IDs are BARE** (no `grouping:ID` prefix, no fragmentation).
- Consolidated ref count `194` == checklist item count `194`. **Zero refs with 2+ colons.**
- vote-missing distribution: `{0: 194}` — no cell dropped any item.
- Status counts on `consolidated-findings.json`: `pass=107, not-applicable=61, warn=6, uncertain=16, fail=4`.
- `uncertain with ≥1 missing vote: 0/16` — uncertainty is NOT missing-driven; it's real disagreement or low confidence.
- No `experiment` set → stock `workflow/prompts/review.md` ran. Overlays under `workflow/experiments/{inspect-drawing,vision-check}/` are dormant on this run.

## Log signals
- `logs/completeness-check.log`: 30300 lines, 48MB. Levels: 30298 info, **2 errors**.
- Zero occurrences of `error_max_structured_output_retries`, `coercion`. **No retry storm.**
- The 2 errors are both `Vision: failed to load file <plan_set_id>` (getFileContent in `src/shared/vision-file.ts:51`):
  - `run-3` `cc-20.md` idx 36: `plan_set_id: 777f2782-6933-4af3-8010-e26c52311541` (sheet 1)
  - `run-2` `cc-1.md` idx 28: `plan_set_id: dd5b866a-144e-457d-8bc3-fbf523e3d3cb` (sheet 1)
- **Both errors are for plan_set_ids OTHER than the current submission's** — indicates the review agent is calling the `vision` tool with plan-set IDs it discovered from `priorReviewId`'s context (prior submission), and the current runtime can't find them. Worth confirming in Agent 1's report.
- Ancillary logs: `output/vision-log.jsonl` (173 lines, event/documentId/success/timestamp only — no prompt or checklist attribution; matches the known baseline vision-tool traceability gap), `output/semantic-search-blocks-log.jsonl` (228 lines).

## Known failure signatures — status on this run
- Checklist-ID fragmentation: **NONE** (all bare, exact ref count).
- Structured-output retry storm: **NONE**.
- Vision-tool failures: **2 isolated** (see above).
- Silent script fallbacks / unrendered `{{ input.* }}`: check per-step scripts.
- Experiment overlay drift: **N/A** (baseline path).
- Prior-review numbering drift: verify `pape-dawson-comment-num-mapping.tsv` alignment in Agent 9.

## Conventions
- Cite paths and line numbers.
- Never modify the run tree — audit is read-only. Write only to AUDIT_OUT.
- Every report ends with an **Observability gaps & remediations** section.
- Verdict vocabulary: `HEALTHY | HEALTHY WITH NOTES | DEGRADED | FAILED`.
- Final sub-agent message: ~10-line summary for the synthesis agent.
