# Completeness-Check Checklist Coverage Audit — 1700 S. Lamar

**Audited:** 2026-04-24
**Project:** 1700 S. Lamar (`23301a8a-4cdb-4751-ac0c-93b97f0f5c12`)
**Submission:** Site Plan (`cf1201c2-2e8b-4034-9a5e-a70b6317e39a`)

## Runs under review

| Sub ver | Submission version ID | Checklist template | Review ID (cc) | Workflow run ID |
|---|---|---|---|---|
| 1 | `56c0b702-2ba4-4adb-b407-5f41f3755972` | `v2.3-trimmed` | `6e921f33-848f-4f29-882b-785593ce2f7a` | `22cd2af8-44eb-421d-91da-7e2f3cf053c1` |
| 2 | `eb67ee21-76b1-4065-b20d-c32f674add12` | `v2.4-trimmed` | `d09d30ff-d4f5-4b8a-9f79-5b36e3203075` | `99525a53-38b8-4074-bc8e-77896244ccac` |

Both reviews are `is_current=true`, `status=completed`, `department_code=cc`.

ig_review_runs: v1 = `bbeaa4cd-af20-4a6b-8bec-1618e9177ede` · v2 = `555031fc-bf69-416b-96dc-4c4a425a20b6`.

## Headline

The checklist item IDs *should* line up across v2.3-trimmed and v2.4-trimmed — but they don't. Counting items that have a comment in each run:

- **Sub ver 1 (v2.3-trimmed):** 180 commented items
- **Sub ver 2 (v2.4-trimmed):** 185 commented items
- **Shared (same checklist_item_id in both):** 174
- **Only in v1 (lost in v2):** 6 items — all in `cc-13` (AW)
- **Only in v2 (new in v2):** 11 items — all in `cc-13` (AW)

All 17 missing items are in the AW (arborist/water?) block of `cc-13`. The `cc-1`, `cc-2`, `cc-3`, `cc-5`, `cc-6`, `cc-10`, `cc-15`, `cc-19`, `cc-20`, `cc-22`, `cc-23`, and `cc-24` groups are unchanged between the two runs.

## Missing in sub ver 2 (present in v1, absent in v2)

| v1 checklist_item_id | v1 comment # |
|---|---|
| `cc-13:AW-04` | 75 |
| `cc-13:AW-09` | 80 |
| `cc-13:AW-15` | 86 |
| `cc-13:AW-17` | 88 |
| `cc-13:AW-24` | 95 |
| `cc-13:AW-26` | 97 |

## Missing in sub ver 1 (present in v2, absent in v1)

| v2 checklist_item_id | v2 comment # |
|---|---|
| `cc-13:AW-29` | 94 |
| `cc-13:AW-30` | 95 |
| `cc-13:AW-31` | 96 |
| `cc-13:AW-34` | 99 |
| `cc-13:AW-36` | 100 |
| `cc-13:AW-37` | 101 |
| `cc-13:AW-38b` | 103 |
| `cc-13:AW-45` | 106 |
| `cc-13:AW-46` | 107 |
| `cc-13:AW-49` | 108 |
| `cc-13:AW-53` | 109 |

## Data-quality issue in `ig_checklist_diff_mapping`

The diff table has 185 rows — exactly the size of the v2.4 checklist. Every row has `mapping_status=equal`. There are **no** `removed` / `added` rows.

Two consequences:

1. **The 6 v1-only items are silently absent from the diff.** They are in neither `previous_checklist_item_id` nor `current_checklist_item_id`, despite being commented on in v1. There is no `removed` entry for them.
2. **11 diff rows claim a previous match that the v1 run never commented on.** For `cc-13:AW-29/30/31/34/36/37/38b/45/46/49/53`, the diff says `previous == current` (both are the v2-only IDs), but v1 produced no comment for any of them.

The simplest explanation is that the diff is computed against the base `v2.3` vs `v2.4` checklist templates, while the runs use *trimmed* variants. If the trimmer diverges per-run, the diff table can't be trusted as a comment-mapping source without cross-referencing against what each run actually commented on.

**Recommendation:** have `ig_checklist_diff_mapping` either (a) be computed over the trimmed checklist the run actually used, or (b) emit explicit `removed`/`added` rows so consumers don't need to re-derive them.

## Comment-number mapping (v1 → v2)

Full mapping in `1700-s-lamar-comment-mapping.tsv` alongside this file. Summary of shifts:

- `cc-1` through `cc-10` (v1 #1–71): comment numbers unchanged.
- `cc-13` (v1 #72–104): unchanged through AW-03, then the 6 v1-only drops and 11 v2-only adds interleave, ending with an offset of roughly +5 by the end of the cc-13 block.
- `cc-15` onward (v1 #105–180): shifted by a constant **+5** in v2 (v1 #105 → v2 #110, v1 #180 → v2 #185).

174 of 180 v1 comments have a direct 1:1 v2 counterpart; the 6 listed above are unmapped.

## Query recipe

To reproduce:

```sql
-- reviews for the project's submission versions
select r.id, r.submission_version_id, r.review_type, r.is_current, r.workflow_run_id
from reviews r
join submission_version sv on sv.id = r.submission_version_id
join submission s on s.id = sv.submission_id
where s.project_id = '23301a8a-4cdb-4751-ac0c-93b97f0f5c12'
  and r.review_type = 'completeness_check'
  and r.is_current;

-- checklist diff for the two ig_review_runs
select *
from ig_checklist_diff_mapping
where previous_ig_review_run_id = 'bbeaa4cd-af20-4a6b-8bec-1618e9177ede'
  and current_ig_review_run_id  = '555031fc-bf69-416b-96dc-4c4a425a20b6';

-- comment-number mapping
select
  rcm.checklist_item_id,
  rc.comment_number
from review_checklist_comment_map rcm
join review_comments rc on rc.id = rcm.review_comment_id
where rcm.review_id = '<v1 or v2 review id>'
order by rc.comment_number;
```
