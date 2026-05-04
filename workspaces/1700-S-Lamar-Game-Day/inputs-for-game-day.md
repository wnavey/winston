# 1700 S Lamar — Game Day inputs

## Trigger command

```
trigger-workflow --workflow=completeness-check-anchored \
  --jurisdiction=austin \
  --prior-review-id=d09d30ff-d4f5-4b8a-9f79-5b36e3203075 \
  --submission-version-id={new-v3-sub-ver-id} \
  --project-id=23301a8a-4cdb-4751-ac0c-93b97f0f5c12 \
  --checklist-version=v2.4-trimmed \
  --runs=3 \
  --model=claude-sonnet-4-5-20250929 \
  --set-current=false \
  --force-outcomes=1700-s-lamar-forced-outcomes.tsv \
  --run-label=1700_s_lamar_cc_anchored_v2_to_v3
```

## Inputs payload

```json
{
  "priorReviewId": "d09d30ff-d4f5-4b8a-9f79-5b36e3203075",
  "submissionVersionId": "{new-v3-sub-ver-id}",
  "projectId": "23301a8a-4cdb-4751-ac0c-93b97f0f5c12",
  "checklistVersion": "v2.4-trimmed",
  "runs": 3,
  "model": "claude-sonnet-4-5-20250929",
  "setCurrent": false,
  "forceOutcomes": "1700-s-lamar-forced-outcomes.tsv",
  "runLabel": "1700_s_lamar_cc_anchored_v2_to_v3"
}
```
