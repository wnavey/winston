# Baseline run — cc — kickoff state

**Fired:** 2026-05-06 ~15:29 UTC
**Status at write time:** in_progress
**Purpose:** Establish how often the *production* prompt (3-tool list,
no `vision_check` entry point) calls vision on inspect-drawing items —
the baseline against which the experiment runs are compared.

See [`../eval-plan.md`](../eval-plan.md) for the full eval methodology
and the "Maybe we over-estimated how much vision was needed?" framing
that makes this baseline the disambiguating run. See
[`review-kickoff.md`](./review-kickoff.md) for the parallel review baseline.

---

## Identifiers

| Thing | Value |
|---|---|
| Inngest event id | `01KQYYG6G4JHPRMGK0WK9CAWYZ` |
| Inngest function run | `01KQYYG6VSE0Z648NXXWXS8PM3` (Completed — dispatcher created the DB row) |
| `workflow_runs.id` | `1cea1a70-5860-4068-bd25-e67ce5529eee` |
| Started | 2026-05-06 15:29:23 UTC |
| `runLabel` | `VISION_CHECK_CC_BASELINE` |
| Submission | 1700 S. Lamar v2 (`projectId=23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, `submissionVersionId=eb67ee21-76b1-4065-b20d-c32f674add12`) |
| Checklist | `v2.5-trimmed` |
| `runs` | 3 |
| `experiment` | (none — production prompt) |
| `setCurrent` | false |

---

## Payload (verbatim)

```json
{
  "workflowName": "completeness-check",
  "jurisdiction": "austin",
  "inputs": {
    "projectId": "23301a8a-4cdb-4751-ac0c-93b97f0f5c12",
    "submissionVersionId": "eb67ee21-76b1-4065-b20d-c32f674add12",
    "checklistVersion": "v2.5-trimmed",
    "runs": 3,
    "setCurrent": false,
    "runLabel": "VISION_CHECK_CC_BASELINE"
  }
}
```

Difference vs. experiment run1 payload: no `experiment` field,
`runs=3` (run1 was 1 local run), distinct `runLabel`.

---

## When the run finishes

Poll Supabase for `outputs_path`:

```sql
SELECT id, status, started_at, ended_at, outputs_path
FROM workflow_runs
WHERE inputs->>'runLabel' = 'VISION_CHECK_CC_BASELINE'
ORDER BY created_at DESC LIMIT 1;
```

Once `status = 'done'` and `outputs_path` is populated:

1. **Pull artifacts** into `experiments/baseline/cc/output/`.
   Mirror the run1 layout.
2. **Generate `experiments/baseline/analytics/vision-call-invocation-metrics.tsv`**
   — same shape as run1's TSV but tracking `vision`,
   `measure-distance`, and `inspect-drawing` calls separately. The
   comparable column is "any vision tool called" — see eval-plan.md
   "Tool-rate equivalence" note.
3. **Cross-tab vs. run1.** Goals:
   - Compute baseline applicable-items vision call rate
   - Compute baseline routing share (how often the agent picks each
     of the 3 specialist tools)
   - Test the over-aggressive-labels hypothesis (eval-plan.md): does
     baseline call vision at the same ~40% rate as experiment, or
     much higher?
4. **Write `experiments/baseline/analytics/analysis.md`** with the
   delta vs. run1 + which failure-mode framing it supports.

---

## Open follow-ups (after baseline lands)

- **Run 2 of the experiment** with the dimension-anchor prompt change
  (bureau PR #301) merged — `runs=3`, `runLabel=VISION_CHECK_CC_RUN_2`.
  Goal: confirm Cluster A + B from
  [`../run1/analytics/failure-mode-2.md`](../run1/analytics/failure-mode-2.md)
  flip from `(generic -> vision)` to `(drawing_inspect -> ...)`.
- **Specialist execution accuracy** is measurable for the first time
  in run2 because conductor PR #145 fixed the workflowPath fallback
  bug that ran in run1. Compare drawing_inspect findings vs generic
  vision findings on the same items.
