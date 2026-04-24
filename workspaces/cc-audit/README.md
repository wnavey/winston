# 1700 S. Lamar — Completeness-Check Artifacts

Comment-number mappings and status-transition slices between the two
`is_current=true` completeness-check reviews for the 1700 S. Lamar site plan.

**Old (v1):** submission version 1 · checklist `v2.3-trimmed` · review `6e921f33-848f-4f29-882b-785593ce2f7a` · ig_review_run `bbeaa4cd-af20-4a6b-8bec-1618e9177ede`
**New (v2):** submission version 2 · checklist `v2.4-trimmed` · review `d09d30ff-d4f5-4b8a-9f79-5b36e3203075` · ig_review_run `555031fc-bf69-416b-96dc-4c4a425a20b6`

## Comment-number mapping (4 files, bucketed by `mapping_status`)

| File | Rows | Columns |
|---|---|---|
| `south-lamar-cc-comment-num-mapping-equal.tsv` | 174 | `checklist_id`, `old_comment_number`, `new_comment_number` |
| `south-lamar-cc-comment-num-mapping-removed.tsv` | 6 | `checklist_id`, `old_comment_number` |
| `south-lamar-cc-comment-num-mapping-added.tsv` | 11 | `checklist_id`, `new_comment_number` |
| `south-lamar-cc-comment-num-mapping-modified.tsv` | 0 | `old_checklist_id`, `new_checklist_id`, `old_comment_number`, `new_comment_number` |

### Note on sourcing

`ig_checklist_diff_mapping` for this pair has 185 rows, *all* labelled
`equal` — no `removed`/`added`/`modified` rows are emitted. 11 of those 185
rows reference `previous_checklist_item_id`s that the v1 run never
commented on, and the 6 genuinely v1-only items are absent from the diff
entirely.

To keep the bucket files semantically correct, the buckets here are derived
from the intersection/difference of each run's `review_checklist_comment_map`
entries:

- `equal` = checklist_ids present in **both** runs' comment maps (174)
- `removed` = checklist_ids present in v1 only (6 — all in `cc-13` AW)
- `added` = checklist_ids present in v2 only (11 — all in `cc-13` AW)
- `modified` = rows with `mapping_status='modified'` in the diff table (0)

See `1700-s-lamar-checklist-coverage.md` for the underlying audit and the
list of missing items by ID.

## Status-transition mapping (9 files, only over the 174 `equal` pairs)

Status comes from `review_comments.output_json.status` in each run. Observed
status tokens: `pass`, `fail`, `warn`, `not-applicable`, `unclear`.

All files share the same columns:
`checklist_id`, `old_comment_number`, `new_comment_number`, `old_status`, `new_status`.

| Transition | File | Rows |
|---|---|---|
| pass → pass | `south-lamar-cc-status-mapping-pass-to-pass.tsv` | 79 |
| not-applicable → not-applicable | `south-lamar-cc-status-mapping-not-applicable-to-not-applicable.tsv` | 55 |
| **fail → pass** | `south-lamar-cc-status-mapping-fail-to-pass.tsv` | 15 |
| **pass → fail** | `south-lamar-cc-status-mapping-pass-to-fail.tsv` | 9 |
| fail → fail | `south-lamar-cc-status-mapping-fail-to-fail.tsv` | 7 |
| **not-applicable → fail** | `south-lamar-cc-status-mapping-not-applicable-to-fail.tsv` | 3 |
| warn → warn | `south-lamar-cc-status-mapping-warn-to-warn.tsv` | 3 |
| not-applicable → unclear | `south-lamar-cc-status-mapping-not-applicable-to-unclear.tsv` | 2 |
| not-applicable → pass | `south-lamar-cc-status-mapping-not-applicable-to-pass.tsv` | 1 |

(No pairs seen for `warn → pass`, `warn → fail`, `pass → warn`, `fail → warn`,
`pass → not-applicable`, `fail → not-applicable`, or any transition ending in
`warn` from a non-`warn` source.)

## Reproducing

Inputs (all JSON dumps of PostgREST filter queries):

```bash
# comment maps
supabase-query review_checklist_comment_map \
  --select='checklist_item_id,comment_ref,review_comment_id' \
  --filter='review_id=eq.<v1 review id>' --format=json > v1_map.json
# (same for v2)

# review comments (need output_json for status)
supabase-query review_comments \
  --select='id,comment_number,output_json' \
  --filter='review_id=eq.<v1 review id>' --format=json > v1_rc.json
# (same for v2)

# diff (direction is previous=v1, current=v2 for this pair)
supabase-query ig_checklist_diff_mapping \
  --filter='previous_ig_review_run_id=eq.<v1 ig_review_run id>' \
  --filter='current_ig_review_run_id=eq.<v2 ig_review_run id>' \
  --format=json > diff.json
```

Generator: `build_artifacts.py` in the PR description / chat transcript.
