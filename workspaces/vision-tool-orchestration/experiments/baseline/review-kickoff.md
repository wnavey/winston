# Baseline run — review (el-md-exp) — kickoff state

**Fired:** 2026-05-06 ~16:28 UTC
**Status at write time:** in_progress
**Purpose:** Establish the production-prompt review floor on `el-md-exp`
(Valley View v2) before running the vision-check experiment on the
review side.

See [`../eval-plan.md`](../eval-plan.md) for the full eval methodology
and the over-aggressive-labels framing. See [`cc-kickoff.md`](./cc-kickoff.md)
for the parallel cc baseline.

---

## Identifiers

| Thing | Value |
|---|---|
| Inngest event id | `01KQZ1X0NMDDZ6E4SA3P1S3Q1E` |
| `workflow_runs.id` | `300eb8a1-9bb1-4257-a88a-745bf696b805` |
| Started | 2026-05-06 16:28:46 UTC |
| `runLabel` | `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE` |
| Submission | Valley View v2 (`submissionVersionId=48f705aa-39cc-44a5-8128-2898c4a2cb7f`) |
| Department / Guide | `el` / `el-md-exp` (3 items: 1.md control, 2.md trees, 13.md transformers) |
| `runs` | 3 |
| `experiment` | (none — production prompt, vision-only tool) |
| `setCurrent` | false |

---

## Payload (verbatim)

```json
{
  "workflowName": "review",
  "jurisdiction": "austin",
  "inputs": {
    "submissionVersionId": "48f705aa-39cc-44a5-8128-2898c4a2cb7f",
    "departmentCode": "el",
    "guideCode": "el-md-exp",
    "runs": 3,
    "setCurrent": false,
    "runLabel": "VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE"
  }
}
```

Difference vs. the planned experiment payload (plan.md lines 588-602):
no `experiment` field, distinct `runLabel`. Same submission, guide,
`runs=3`, `setCurrent=false`.

---

## Why fresh, not borrowed

There were two candidate baselines we could have reused. Neither was
clean for vision-check A/B:

1. **`measure-distance-tool/runs/v5.0/el-md-exp/baseline-el-md-exp/`**
   (April 15) — structurally a vision-only review, *would* have been a
   valid baseline, but 3 weeks old. Review.md, dispatcher state, or
   the Haiku 4.5 snapshot may have shifted in that window. Comparing a
   2026-05-06 experiment against an April-15 floor would conflate
   prompt drift with experiment effects.
2. **`experiment-run7`** (April, the run plan.md originally called the
   "review baseline") — used the `experiment=measure-distance` overlay,
   so it had measure-distance wired in as a tool. That's a different
   tool list than current production review (which is vision-only) and
   different from the vision-check experiment (which is vision_check
   only). It still works as an aspirational ceiling for headline
   recall, but not as a vision-check A/B floor.

Production review's `workflow.yaml` lists `tools: [vision]` and the
vision-check `experiment.yaml` says verbatim *"Baseline (no
--experiment flag) keeps the workflow's default prompt and tools list
— vision only."* So this baseline = current production = correct floor.

---

## When the run finishes

Poll Supabase for `outputs_path`:

```sql
SELECT id, status, started_at, ended_at, outputs_path
FROM workflow_runs
WHERE inputs->>'runLabel' = 'VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE'
ORDER BY created_at DESC LIMIT 1;
```

Once `status = 'done'` and `outputs_path` is populated:

1. **Pull artifacts** into `experiments/baseline/review/output/`.
   Mirror the existing measure-distance run layout
   (`run-1/findings/...`).
2. **Compute rigorous metrics** using
   [`../../measure-distance-tool/analysis/scripts/compute-rigorous-metrics.py`](../../../measure-distance-tool/analysis/scripts/compute-rigorous-metrics.py)
   — reuses the `item-classification.json` ground truth (101 items,
   horizontal vs vertical-or-mixed). Output to
   `experiments/baseline/review/analytics/`.
3. **Cross-tab vs. experiment-run7 (ceiling) and the planned
   experiment run (`VISION_CHECK_REVIEW_EL_MD_EXP_RUN_1`).**
   The relevant comparisons:
   - Baseline vision call rate vs. experiment vision_check call rate
     — does the single entry point change agent tool-call frequency?
   - Baseline pass/fail/NV split vs. experiment — does any change in
     tool routing translate to different finding outcomes?
   - Both vs. experiment-run7 (measure-distance tool wired in, our
     ceiling) — how much of run7's lift was the measure-distance
     specialist vs the prompt's vision-tool framing?

---

## Open follow-ups (after baseline lands)

- **Review experiment run 1** with the vision-check overlay — `runs=3`,
  `runLabel=VISION_CHECK_REVIEW_EL_MD_EXP_RUN_1`. Payload already
  defined in [`../../plan.md`](../../plan.md) Phase D. Fire after
  bureau PR #301 merges so the dimension-anchor router is live.
- **Update plan.md** to reflect that experiment-run7 is a ceiling
  reference, not the baseline floor — this baseline run is the floor.
