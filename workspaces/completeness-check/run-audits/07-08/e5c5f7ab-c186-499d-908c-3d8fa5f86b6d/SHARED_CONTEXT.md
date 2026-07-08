# Shared context for audit sub-agents

## Identity
- **Review ID:** `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d`
- **Project ID:** `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` (1700 S Lamar)
- **Run label:** `2026_07_08_run_2_vision_exp`
- **Prior review ID (for triage):** `54d5c002-4648-4fb0-b22d-d222cbbd02f9`
- **Ran:** 2026-07-08T15:20:49Z → 16:25:19Z (~64m 30s wall)
- **DB status:** `completed` (workflow_run_id `0bb769d3-a961-4ce4-a988-4e968a861536`); workflow/status.json shows `in-progress` at step 8 — stamped at upload, near run end.
- **Consolidated result totals:** total=194, pass=99, fail=7, warn=4, uncertain=19, notApplicable=65.

## Inputs (from `workflow/status.json`)
- runs=5, model=`claude-haiku-4-5-20251001`
- checklistVersion=`v2.7-trimmed` (14 groupings, 194 items)
- maxWorkers=35, uncertainThreshold=0.35
- explainUncertain=true, uncertainExplanationModel=`claude-sonnet-4-6`, uncertainExplanationMaxWorkers=10
- enabledVisionSpecialists=`generic-vision,inspect-drawing`
- **experiment=`vision-check`** → the overlay prompt `workflow/experiments/vision-check/review.md` ran instead of stock `workflow/prompts/review.md`
- commentNumberingMap=`pape-dawson-comment-num-mapping.tsv`
- setCurrent=false, so this run is not the "current" review pointer.

## Run lineage (all 2026-07-08, same plan / checklist / 5 voters)
- **Run 1 (baseline comparator):** review `b38e2619-91e4-4585-8e92-2fd32bbb9653` — stock prompt + vanilla `vision` tool, 150 vision calls, 0 failures. Storage folder `2026-07-08-144339`.
- **Run 2 (this run):** vision-check experiment, 279 vision_check calls (155 inspect-drawing / 124 generic-vision), 42 generic-path failures.
- Context: the 2026-07-07 vision-exp run (`50a1a78d-…`) suffered overlay-induced checklist-ID fragmentation (189 artifactual uncertains). This run verifies the one-line overlay fix (bare IDs) — it held: zero fragmentation.

## Paths (as run on Will's machine)
- **RUN_DIR:** `/Users/wnavey/noetic/cc-audit/e5c5f7ab-c186-499d-908c-3d8fa5f86b6d/cc-run-output/`
- **AUDIT_OUT:** `/Users/wnavey/noetic/cc-audit/e5c5f7ab-c186-499d-908c-3d8fa5f86b6d/`
- **Bureau checklist:** `/Users/wnavey/noetic/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/`
- **Provenance caveat:** `review-comments.json` stamps `bureauCommit: c29a96ea…` inherited from the prior review — provably predates v2.7-trimmed. Actual content verified equivalent to bureau HEAD `148418db` (969/969 emitted IDs match).

## Step wall-times (from `workflow/run-log.json`)
| # | Step | Wall | Items |
|---|---|---|---|
| 0 | review | 58m 20s | 70 (5×14) |
| 1 | cross-run-consolidate-cc | 0.6s | — |
| 2 | apply-forced-outcomes | skipped | — |
| 3 | prepare-uncertain-explanation-inputs | 0.5s | — |
| 4 | explain-uncertain | 3m 12s | 19 |
| 5 | collect-uncertain-explanations | 0.5s | — |
| 6 | enrich-findings | 0.5s | — |
| 7 | format-reports | 2m 56s | — |
| 8 | build-review-comments | 0.5s | — |

## Audit verdict
**HEALTHY WITH NOTES** — output trustworthy as labeled, nothing needs data repair. See `audit-summary.md` for the causal chain and `FOLLOW-UP-PLAN.md` for committed fixes.
