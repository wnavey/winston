# Experiments / run1 — `VISION_EXP_INSPECT_DRAWING_RUN_1`

First end-to-end experiment run after the wrapped-structured-output
fix landed in the inspect-drawing overlay (bureau `c98bcc995`).

| | |
|---|---|
| Run label | `VISION_EXP_INSPECT_DRAWING_RUN_1` |
| Workflow run ID | `386b040b-3f75-47ab-af5c-26e8f6b74e9b` |
| Review ID | `51586bce-e7d8-4fce-834d-4437abe0df1a` |
| Project | 1700 S. Lamar (`23301a8a-4cdb-4751-ac0c-93b97f0f5c12`) |
| Submission version | v2 (`eb67ee21-76b1-4065-b20d-c32f674add12`) |
| Checklist | `v2.5-trimmed`, 185 items |
| Runs | 3 |
| Model | `claude-sonnet-4-5-20250929` |
| Status | `completed` (no review-step failures) |
| Source storage path | `workflow-runs/completeness-check/23301a8a-…/2026-05-04-190800` |

## Layout

| Path | Purpose |
|---|---|
| [`analytics/`](./analytics/) | Tool-usage analysis (calls vs cc-vision-classification reference set). Start with [`analytics/analysis.md`](./analytics/analysis.md). |
| [`logs/`](./logs/) | Conductor logs (`completeness-check.log`, `completeness-check-error.log`). |
| [`output/`](./output/) | Workflow output: per-run findings, inspect-drawing per-call artifacts, vision/semantic-search logs, consolidated review comments and reports. |
| [`workflow/`](./workflow/) | Snapshot of the workflow definition that ran (workflow.yaml, prompts, schemas, scripts, experiments overlay). |

## Headline

3 inspect-drawing calls total, all in run-1, all on cc-13 (AW-21 + AW-23).
Tool worked; agent adoption was sparse (15% hit rate on applicable
required items) and inconsistent across runs. Full breakdown in
[`analytics/analysis.md`](./analytics/analysis.md).
