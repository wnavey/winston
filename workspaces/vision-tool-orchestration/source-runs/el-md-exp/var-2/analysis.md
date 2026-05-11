# RUN_7_BACKUP_LOCAL_3_RUNS — analysis

Local conductor execution (runs=3, --step=review-runs, --experiment=vision-check) of var-2 on Valley View v1. **Runs=3 retires the runs-disparity confounder** that was open in RUN_6_BACKUP_LOCAL. This run combines the fixed measure-distance chain (post bureau#324 + conductor#153 + conductor#154) with strict-majority aggregation, giving the headline var-2 numbers for el-md-exp.

## Headline

- **Total `vision_check` calls:** 89 (across 3 runs)
- **Classifier intent distribution:** `generic`=61, `measurement`=28
- **Total pairs extracted:** 99
- **measure-distance subprocess invocations:** 22 (≥1 pair succeeded: 22)
- **Per-pair measurements:** 99 / 99 returned a distance (100.0%)
- **Reported distance range:** 0.0–395.2 ft (median 27.9)

## Goals (strict majority across 3 runs)

| Goal | Hits / Total | Rate |
|---|---:|---:|
| Goal A — any vision invoked on expected_vision=yes | 25 / 51 | 49.0% |
| Goal A misuse — vision invoked on expected_vision=no | 16 / 50 | 32.0% |
| Goal B — canonical intent = measurement on expected_specialist=measure-distance | 14 / 51 | 27.5% |
| Goal B' — measure-distance subprocess produced ≥1 distance on at least one call | 11 / 51 | 21.6% |

## vs RUN_6_BACKUP_LOCAL (runs=1) + RUN_3 (runs=3, pre-fix)

| Metric | RUN_3 (runs=3, chain broken) | RUN_6 (runs=1, chain fixed) | **RUN_7 (runs=3, chain fixed)** |
|---|---:|---:|---:|
| Total `vision_check` calls | 56 | 29 | **89** |
| Classifier intent: measurement | 16 | 9 | **28** |
| measure-distance subprocess invocations | 0 | 8 | **22** |
| Per-pair distance measurements | 0 | 24 | **99** |
| Goal A | 47.1% (24/51) | 37.3% (19/51) | **49.0% (25/51)** |
| Goal B (canonical intent) | 15.7% (8/51) | 13.7% (7/51) | **27.5% (14/51)** |
| Goal B' (chain actually executes) | 0% (chain crashed) | 13.7% (7/51, same as B) | **21.6% (11/51)** |

## Per-item (items invoked or seen by classifier)

Strongest intent = max precedence (measurement > drawing_inspect > generic) across all calls seen for that item. md success = how many runs/calls had ≥1 successful md pair.

| Item | Calls | Intent dist | Strongest | Pairs | md calls succeeded | Expected | Match |
|---|---:|---|---|---:|---|---|:---:|
| `EL-1.1` | 6 | generic:6 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.10` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.14` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.15` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.18` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-1.2` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.22` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.24` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.25` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.26` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.27` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.28` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.29` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.30` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.31` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-1.35` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.36` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.37` | 3 | measurement:2,generic:1 | `measurement` | 13 | 2/2/3 | `measure-distance` | ✓ |
| `EL-1.39` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.4` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.40` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.45` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.6` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-1.8` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-1.9` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-13.1` | 4 | measurement:3,generic:1 | `measurement` | 15 | 3/3/3 | `measure-distance` | ✓ |
| `EL-13.10` | 4 | measurement:3,generic:1 | `measurement` | 16 | 3/3/3 | `measure-distance` | ✓ |
| `EL-13.12` | 3 | measurement:2,generic:1 | `measurement` | 1 | 1/1/3 | `measure-distance` | ✓ |
| `EL-13.13` | 3 | generic:2,measurement:1 | `measurement` | 0 | 0/0/3 | `measure-distance` | ✓ |
| `EL-13.14` | 1 | measurement:1 | `measurement` | 2 | 1/1/3 | `measure-distance` | ✓ |
| `EL-13.15` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-13.16` | 1 | measurement:1 | `measurement` | 0 | 0/0/3 | `measure-distance` | ✓ |
| `EL-13.17` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-13.18` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-13.19` | 2 | measurement:2 | `measurement` | 1 | 1/1/3 | `measure-distance` | ✓ |
| `EL-13.2` | 2 | generic:1,measurement:1 | `measurement` | 5 | 1/1/3 | `measure-distance` | ✓ |
| `EL-13.20` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-13.21` | 3 | generic:2,measurement:1 | `measurement` | 5 | 1/1/3 | `none` | — |
| `EL-13.22` | 2 | generic:1,measurement:1 | `measurement` | 5 | 1/1/3 | `none` | — |
| `EL-13.23` | 1 | measurement:1 | `measurement` | 5 | 1/1/3 | `none` | — |
| `EL-13.24` | 1 | measurement:1 | `measurement` | 0 | 0/0/3 | `none` | — |
| `EL-13.27` | 2 | generic:1,measurement:1 | `measurement` | 6 | 1/1/3 | `measure-distance` | ✓ |
| `EL-13.28` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-13.3` | 1 | measurement:1 | `measurement` | 0 | 0/0/3 | `measure-distance` | ✓ |
| `EL-13.31` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-13.32` | 3 | generic:3 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-13.33` | 3 | generic:2,measurement:1 | `measurement` | 5 | 1/1/3 | `none` | — |
| `EL-13.34` | 3 | generic:3 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-13.35` | 3 | generic:3 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-13.36` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-13.37` | 4 | generic:4 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-13.38` | 3 | generic:3 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-13.39` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-13.5` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-13.7` | 2 | measurement:2 | `measurement` | 6 | 2/2/3 | `measure-distance` | ✓ |
| `EL-13.8` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-13.9` | 2 | generic:2 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-2.1` | 5 | generic:3,measurement:2 | `measurement` | 9 | 2/2/3 | `measure-distance` | ✓ |
| `EL-2.10` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-2.11` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-2.12` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-2.14` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `none` | — |
| `EL-2.2` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-2.3` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-2.4` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-2.5` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-2.6` | 3 | generic:3 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-2.7` | 3 | generic:2,measurement:1 | `measurement` | 5 | 1/1/3 | `measure-distance` | ✓ |
| `EL-2.8` | 1 | generic:1 | `generic` | 0 | 0/0/3 | `measure-distance` | ✗ |
| `EL-2.9` | 0 |  | `?` | 0 | 0/0/3 | `measure-distance` | ✗ |

