# RUN_10 vs RUN_9 — el-md-exp var-2 comparison

**RUN_9** (`VISION_CHECK_REVIEW_EL_MD_EXP_RUN_9_LOCAL`, started 2026-05-11 17:18 UTC) — baseline before bureau prompt tweak.
**RUN_10** (`VISION_CHECK_REVIEW_EL_MD_EXP_RUN_10_LOCAL`, started 2026-05-11 22:01 UTC) — first run after bureau#340 landed (added "dimensional analysis, distance computation" to the vision_check capability list in the experiment overlay's review.md).

Both runs: same submission (Valley View Townhomes v1), same submissionVersionId, same model (haiku-4-5), runs=3, same `enabledVisionSpecialists="generic-vision,measure-distance"`.

## Headline

| metric | RUN_9 | RUN_10 | delta |
|---|---:|---:|---:|
| total `vision_check` calls (all items) | 67 | 86 | **+19** |
| Goal B raw | 5/54 = 9.3% | 11/54 = 20.4% | **+11.1pp** |
| Goal B adjusted | 5/33 = 15.2% | 11/37 = 29.7% | **+14.5pp** |
| Goal B strict-clear | 5/17 = 29.4% | 11/27 = 40.7% | **+11.3pp** |

All three Goal B variants moved up. RUN_10 contributed 6 more measurement-majority items on a 54-item denominator. The lift is larger after the EL-13.21/22/23 reclassification — those 3 items moved from `mixed` in RUN_9 (denom-only) to `measurement` in RUN_10 (numerator+denom).

## Verdict distribution on the 54 expected-md items

| no_call_verdict / state | RUN_9 | RUN_10 | delta |
|---|---:|---:|---:|
| `invalid_missing_dimensions` | 6 | 7 | +1 |
| `invalid_probable` | 3 | 4 | +1 |
| `mixed` | 16 | 10 | -6 |
| `n/a` | 8 | 16 | +8 |
| `valid_no_feature` | 1 | 0 | -1 |
| `valid_not_applicable` | 14 | 15 | +1 |
| `valid_other` | 4 | 1 | -3 |
| `valid_other_data_gap` | 2 | 1 | -1 |

## Per-item movement (expected_specialist=measure-distance)

Effective bucket: `measurement` if majority_vision_check=measurement (Goal B hit), `generic` if majority generic, `3-way-tie` if all three runs differ, otherwise the TSV's `no_call_verdict`.

| RUN_9 bucket → RUN_10 bucket | count |
|---|---:|
| `valid_not_applicable` → `valid_not_applicable` | 10 |
| `mixed` → `measurement (Goal B hit)` | 5 🟢 (moved INTO Goal B) |
| `mixed` → `valid_not_applicable` | 5 |
| `invalid_missing_dimensions` → `invalid_missing_dimensions` | 4 |
| `measurement (Goal B hit)` → `generic (vision called, wrong specialist)` | 3 🔴 (LOST from Goal B) |
| `mixed` → `invalid_probable` | 3 |
| `invalid_probable` → `mixed` | 3 |
| `invalid_missing_dimensions` → `mixed` | 2 |
| `valid_not_applicable` → `mixed` | 2 |
| `mixed` → `invalid_missing_dimensions` | 2 |
| `measurement (Goal B hit)` → `measurement (Goal B hit)` | 2 |
| `valid_not_applicable` → `measurement (Goal B hit)` | 2 🟢 (moved INTO Goal B) |
| `valid_other` → `invalid_missing_dimensions` | 1 |
| `generic (vision called, wrong specialist)` → `valid_other` | 1 |
| `valid_no_feature` → `valid_other_data_gap` | 1 |
| `valid_other` → `invalid_probable` | 1 |
| `valid_other` → `mixed` | 1 |
| `mixed` → `mixed` | 1 |
| `3-way-tie (mixed call)` → `measurement (Goal B hit)` | 1 🟢 (moved INTO Goal B) |
| `valid_other_data_gap` → `mixed` | 1 |
| `valid_other` → `measurement (Goal B hit)` | 1 🟢 (moved INTO Goal B) |
| `generic (vision called, wrong specialist)` → `generic (vision called, wrong specialist)` | 1 |
| `valid_other_data_gap` → `3-way-tie (mixed call)` | 1 |

## Direct test of the prompt tweak — RUN_9's 6 `invalid_missing_dimensions` items in RUN_10

These are the items the RUN_9 analysis flagged as the prompt-tweak's intended targets: the agent observed the feature on the plan, cited "no dimension annotations", and gave up. The prompt tweak (bureau#340) was designed to nudge the agent to ask a measurement question instead.

| item | RUN_9 bucket | RUN_10 bucket | moved? |
|---|---|---|---|
| `EL-1.10` | invalid_missing_dimensions | invalid_missing_dimensions | no |
| `EL-1.14` | invalid_missing_dimensions | mixed | → mixed |
| `EL-1.22` | invalid_missing_dimensions | invalid_missing_dimensions | no |
| `EL-1.25` | invalid_missing_dimensions | invalid_missing_dimensions | no |
| `EL-1.29` | invalid_missing_dimensions | invalid_missing_dimensions | no |
| `EL-2.7` | invalid_missing_dimensions | mixed | → mixed |

**Summary on the 6 RUN_9 invalid_missing_dimensions items:** 0 moved INTO `measurement` (Goal B hits the prompt tweak directly produced); 4 stayed `invalid_missing_dimensions`; 2 moved to other buckets.

## Caveats

- Single-shot comparison with a non-deterministic agent (haiku). Even with the same prompt, runs=3 variance can produce ±2-3 items of movement just from sampling.
- Different machine for RUN_10 (user noted "on another box"). No reason to expect a machine effect, but flagged.
- Bureau prompt tweak was a single line addition: "dimensional analysis, distance computation" appended to the existing capability enumeration in the first bullet. No classifier or specialist changes.
