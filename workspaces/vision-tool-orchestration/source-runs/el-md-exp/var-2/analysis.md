# RUN_6_BACKUP_LOCAL — analysis

Diagnostic local re-run (runs=1, --step=review-runs) of var-2 on Valley View v1, post bureau#324 + conductor#154 (submissionVersionId plumbing + lib migration). Validates that the measure-distance chain now runs end-to-end after the prior `version_number` ordering bug + the silent-wrong-submission footgun were fixed.

## Headline

- **Total `vision_check` calls:** 29
- **Classifier intent distribution:** `generic`=20, `measurement`=9
- **Total pairs extracted:** 24 across 8 measurement-routed calls (avg 2.7 pairs/call)
- **measure-distance subprocess invocations:** 8 (≥1 pair succeeded: 8, all pairs succeeded: 8)
- **Per-pair measurements:** 24 / 24 returned a distance (100.0%)
- **Reported distance range:** 0.9–387.0 ft (median 24.6)

## vs RUN_5_BACKUP_LOCAL (pre-fix)

| Metric | RUN_5_BACKUP_LOCAL | RUN_6_BACKUP_LOCAL |
|---|---:|---:|
| Total `vision_check` calls | 20 | 29 |
| Pairs extracted (total) | 30 | 24 |
| measure-distance subprocesses ran | 0 | 8 |
| measure-distance subprocesses with ≥1 successful pair | 0 | 8 |
| Per-pair distance measurements computed | 0 | 24 |

### Sample measurements

| Item | objectA | objectB | Distance (ft) | Confidence |
|---|---|---|---:|---|
| `EL-13.10` | Electrical Transformer Pad located west of Bldg. 1 | West exterior wall of Bldg. 1 | 34.6 | medium |
| `EL-13.10` | Electrical Transformer Pad located west of Bldg. 2 | West exterior wall of Bldg. 2 | 14.3 | medium |
| `EL-13.10` | Electrical Transformer Pad located west of Bldg. 8 | West exterior wall of Bldg. 8 | 13.3 | medium |
| `EL-13.10` | Electrical Transformer Pad located between Bldg. 4 and Bldg. 5 | West exterior wall of Bldg. 5 | 5.1 | medium |
| `EL-13.10` | Electrical Transformer Pad located east of Bldg. 7 | East exterior wall of Bldg. 7 | 46.0 | medium |
| `EL-1.37` | proposed mitigation tree (labeled 'M') in the southwest corner | overhead electric (OHE) line on the southern boundary | 2.4 | medium |

## Goal A — overall vision invocation hit rate

`vision_check` was invoked (per `agentTrace.tools_used`) on **19 / 51** items where `expected_vision=yes` (37.3%).

## Goal B — specialist routing

Of the 51 items where `expected_specialist=measure-distance`, **7** had the classifier's strongest intent = `measurement` (13.7% specialist-routing hit rate among expected measurement items).

Goal B here measures *classifier intent*. Now that measure-distance actually invokes successfully, post-RUN_6 we can also report a stricter B' = items that had ≥1 successful measure-distance subprocess run (not just classifier intent).

**Goal B' (actual measure-distance success):** 7 / 51 = 13.7%

## Per-item table

| Item | Calls | Strongest intent | Pairs | md ran | md succeeded | Expected | Match |
|---|---:|---|---:|---:|---:|---|:---:|
| `EL-1.1` | 2 | `measurement` | 2 | 1 | 1 | `measure-distance` | ✓ |
| `EL-1.14` | 1 | `measurement` | 1 | 1 | 1 | `measure-distance` | ✓ |
| `EL-1.18` | 1 | `generic` | 0 | 0 | 0 | `none` | — |
| `EL-1.2` | 1 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |
| `EL-1.27` | 1 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |
| `EL-1.37` | 1 | `measurement` | 4 | 1 | 1 | `measure-distance` | ✓ |
| `EL-1.46` | 1 | `generic` | 0 | 0 | 0 | `none` | — |
| `EL-1.8` | 1 | `measurement` | 6 | 1 | 1 | `none` | — |
| `EL-1.9` | 1 | `measurement` | 2 | 1 | 1 | `measure-distance` | ✓ |
| `EL-13.1` | 2 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |
| `EL-13.10` | 1 | `measurement` | 5 | 1 | 1 | `measure-distance` | ✓ |
| `EL-13.12` | 2 | `measurement` | 2 | 1 | 1 | `measure-distance` | ✓ |
| `EL-13.13` | 1 | `measurement` | 2 | 1 | 1 | `measure-distance` | ✓ |
| `EL-13.19` | 1 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |
| `EL-13.32` | 1 | `generic` | 0 | 0 | 0 | `none` | — |
| `EL-13.35` | 1 | `generic` | 0 | 0 | 0 | `none` | — |
| `EL-13.38` | 1 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |
| `EL-2.1` | 1 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |
| `EL-2.10` | 1 | `generic` | 0 | 0 | 0 | `none` | — |
| `EL-2.11` | 1 | `generic` | 0 | 0 | 0 | `none` | — |
| `EL-2.12` | 1 | `generic` | 0 | 0 | 0 | `none` | — |
| `EL-2.14` | 1 | `generic` | 0 | 0 | 0 | `none` | — |
| `EL-2.6` | 1 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |
| `EL-2.7` | 1 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |
| `EL-2.8` | 1 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |
| `EL-2.9` | 1 | `generic` | 0 | 0 | 0 | `measure-distance` | ✗ |

