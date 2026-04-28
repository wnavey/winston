# Completeness-Check Variance — 1700 S. Lamar — 3-run smoke test (2026-04-28)

**Review ID:** `6ec3acdf-737b-47b2-8191-49b376ea3404`  
**Source:** `consolidated-findings.json`  
**Total refs:** 198  
**Runs per ref:** 3

## Variance class

| Class | Count | % |
|---|---:|---:|
| unanimous | 155 | 78.3% |
| partial-detection | 18 | 9.1% |
| split-verdict | 25 | 12.6% |
| split-and-partial | 0 | 0.0% |
| no-findings | 0 | 0.0% |

## Per-run status patterns

Each row is the multiset of statuses reported across the runs (sorted).

| Pattern | Count |
|---|---:|
| `pass,pass,pass` | 94 |
| `not-applicable,not-applicable,not-applicable` | 53 |
| `fail,pass,pass` | 10 |
| `pass` | 9 |
| `fail,fail,fail` | 8 |
| `not-applicable,not-applicable,pass` | 4 |
| `not-applicable` | 4 |
| `not-applicable,pass,pass` | 4 |
| `fail,fail,pass` | 4 |
| `pass,pass` | 3 |
| `not-applicable,not-applicable` | 2 |
| `fail,fail,not-applicable` | 1 |
| `fail,not-applicable,pass` | 1 |
| `fail,not-applicable,not-applicable` | 1 |

## High-variance refs by grouping

| Grouping | Split refs |
|---|---:|
| cc-13 | 11 |
| cc-22 | 6 |
| cc-23 | 3 |
| cc-24 | 2 |
| cc-15 | 1 |
| cc-1 | 1 |
| cc-3 | 1 |

## Top split-verdict refs (highest entropy first)

| Ref | Pattern | Winning | Confidence | Entropy |
|---|---|---|---|---:|
| `cc-23:CC-23-07` | `fail,not-applicable,pass` | fail | low | 1.585 |
| `cc-13:AW-05` | `fail,pass,pass` | pass | medium | 0.918 |
| `cc-13:AW-14` | `not-applicable,not-applicable,pass` | not-applicable | medium | 0.918 |
| `cc-13:AW-18` | `fail,pass,pass` | pass | medium | 0.918 |
| `cc-13:AW-23` | `fail,pass,pass` | pass | medium | 0.918 |
| `cc-13:AW-30` | `fail,pass,pass` | pass | medium | 0.918 |
| `cc-13:AW-31` | `fail,pass,pass` | pass | medium | 0.918 |
| `cc-13:AW-32` | `not-applicable,not-applicable,pass` | not-applicable | medium | 0.918 |
| `cc-13:AW-33` | `not-applicable,not-applicable,pass` | not-applicable | medium | 0.918 |
| `cc-13:AW-36` | `not-applicable,pass,pass` | pass | medium | 0.918 |
| `cc-13:AW-37` | `not-applicable,pass,pass` | pass | medium | 0.918 |
| `cc-13:AW-45` | `fail,pass,pass` | pass | medium | 0.918 |
| `cc-15:CC-15-08` | `not-applicable,pass,pass` | pass | medium | 0.918 |
| `cc-1:CC-1-02` | `fail,fail,pass` | fail | medium | 0.918 |
| `cc-22:CC-22-13` | `fail,pass,pass` | pass | medium | 0.918 |
| `cc-22:CC-22-14` | `fail,fail,pass` | fail | medium | 0.918 |
| `cc-22:CC-22-15` | `fail,fail,not-applicable` | fail | medium | 0.918 |
| `cc-22:CC-22-19` | `fail,pass,pass` | pass | medium | 0.918 |
| `cc-22:CC-22-20` | `fail,fail,pass` | fail | medium | 0.918 |
| `cc-22:CC-22-25` | `fail,pass,pass` | pass | medium | 0.918 |
| `cc-23:CC-23-01` | `fail,fail,pass` | fail | medium | 0.918 |
| `cc-23:CC-23-08` | `not-applicable,pass,pass` | pass | medium | 0.918 |
| `cc-24:CC-24-03` | `not-applicable,not-applicable,pass` | not-applicable | medium | 0.918 |
| `cc-24:CC-24-16` | `fail,not-applicable,not-applicable` | not-applicable | medium | 0.918 |
| `cc-3:CC-3-22` | `fail,pass,pass` | pass | medium | 0.918 |

## Detection-variance refs (some runs produced no finding)

| Ref | runCount/total | Pattern | Winning |
|---|---:|---|---|
| `cc-13:AW-09` | 1/3 | `pass` | pass |
| `cc-13:AW-15` | 1/3 | `pass` | pass |
| `cc-13:AW-17` | 1/3 | `pass` | pass |
| `cc-13:AW-24` | 1/3 | `pass` | pass |
| `cc-13:AW-26` | 1/3 | `pass` | pass |
| `cc-13:AW-34` | 1/3 | `not-applicable` | not-applicable |
| `cc-13:AW-35` | 1/3 | `not-applicable` | not-applicable |
| `cc-13:AW-42` | 1/3 | `not-applicable` | not-applicable |
| `cc-13:AW-43` | 1/3 | `not-applicable` | not-applicable |
| `cc-13:AW-44` | 1/3 | `pass` | pass |
| `cc-13:AW-50` | 1/3 | `pass` | pass |
| `cc-13:AW-51` | 1/3 | `pass` | pass |
| `cc-13:AW-52` | 1/3 | `pass` | pass |
| `cc-13:AW-19` | 2/3 | `pass,pass` | pass |
| `cc-13:AW-38a` | 2/3 | `not-applicable,not-applicable` | not-applicable |
| `cc-13:AW-38b` | 2/3 | `pass,pass` | pass |
| `cc-13:AW-39` | 2/3 | `not-applicable,not-applicable` | not-applicable |
| `cc-13:AW-49` | 2/3 | `pass,pass` | pass |

