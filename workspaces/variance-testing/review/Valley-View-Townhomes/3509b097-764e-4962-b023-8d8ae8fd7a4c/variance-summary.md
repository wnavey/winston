# Variance Summary — Valley View Townhomes — el-md-exp 5-run (2026-04-28, logAllAgentTrace)

**Review ID:** `3509b097-764e-4962-b023-8d8ae8fd7a4c`  
**Source:** `consolidated-findings.json`  
**Total refs:** 84  
**Runs per ref:** 5

## Variance class

| Class | Count | % |
|---|---:|---:|
| unanimous | 2 | 2.4% |
| partial-detection | 61 | 72.6% |
| split-verdict | 9 | 10.7% |
| split-and-partial | 12 | 14.3% |
| no-findings | 0 | 0.0% |

## Per-run status patterns

Each row is the multiset of statuses reported across the runs (sorted).

| Pattern | Count |
|---|---:|
| `not-verifiable` | 21 |
| `not-verifiable,not-verifiable` | 21 |
| `not-verifiable,not-verifiable,not-verifiable,not-verifiable` | 10 |
| `not-verifiable,not-verifiable,not-verifiable` | 5 |
| `fail,not-verifiable,not-verifiable,not-verifiable` | 3 |
| `fail,fail,not-verifiable,not-verifiable,not-verifiable` | 3 |
| `fail,fail,fail,not-verifiable,not-verifiable` | 3 |
| `fail,not-verifiable` | 3 |
| `fail,fail,not-verifiable,not-verifiable` | 2 |
| `fail,not-verifiable,not-verifiable` | 2 |
| `fail,fail,not-verifiable` | 2 |
| `fail,fail,fail,fail,not-verifiable` | 2 |
| `fail,not-verifiable,not-verifiable,not-verifiable,not-verifiable` | 1 |
| `not-verifiable,not-verifiable,not-verifiable,not-verifiable,not-verifiable` | 1 |
| `fail,fail` | 1 |
| `fail` | 1 |
| `fail,fail,fail,fail,fail` | 1 |
| `fail,fail,fail` | 1 |
| `fail,fail,fail,fail` | 1 |

## High-variance refs by grouping

| Grouping | Split refs |
|---|---:|
| 1 | 9 |
| 13 | 8 |
| 2 | 4 |

## Top split-verdict refs (highest entropy first)

| Ref | Pattern | Winning | Confidence | Entropy |
|---|---|---|---|---:|
| `1:EL-1.14` | `fail,not-verifiable` | fail | medium | 1.000 |
| `1:EL-1.27` | `fail,not-verifiable` | fail | medium | 1.000 |
| `1:EL-1.9` | `fail,not-verifiable` | fail | medium | 1.000 |
| `13:EL-13.35` | `fail,fail,not-verifiable,not-verifiable` | fail | medium | 1.000 |
| `1:EL-1.37` | `fail,fail,not-verifiable,not-verifiable` | fail | medium | 1.000 |
| `13:EL-13.34` | `fail,fail,not-verifiable,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `13:EL-13.37` | `fail,fail,fail,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `13:EL-13.38` | `fail,fail,fail,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `1:EL-1.7` | `fail,fail,fail,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `2:EL-2.1` | `fail,fail,not-verifiable,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `2:EL-2.15` | `fail,fail,not-verifiable,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `1:EL-1.18` | `fail,not-verifiable,not-verifiable` | fail | medium | 0.918 |
| `1:EL-1.23` | `fail,fail,not-verifiable` | fail | medium | 0.918 |
| `2:EL-2.14` | `fail,fail,not-verifiable` | fail | medium | 0.918 |
| `2:EL-2.3` | `fail,not-verifiable,not-verifiable` | fail | medium | 0.918 |
| `13:EL-13.21` | `fail,not-verifiable,not-verifiable,not-verifiable` | fail | medium | 0.811 |
| `13:EL-13.22` | `fail,not-verifiable,not-verifiable,not-verifiable` | fail | medium | 0.811 |
| `13:EL-13.31` | `fail,not-verifiable,not-verifiable,not-verifiable` | fail | medium | 0.811 |
| `13:EL-13.1` | `fail,not-verifiable,not-verifiable,not-verifiable,not-verifiable` | fail | high | 0.722 |
| `1:EL-1.31` | `fail,fail,fail,fail,not-verifiable` | fail | high | 0.722 |
| `1:EL-1.8` | `fail,fail,fail,fail,not-verifiable` | fail | high | 0.722 |

## Detection-variance refs (some runs produced no finding)

| Ref | runCount/total | Pattern | Winning |
|---|---:|---|---|
| `13:EL-13.11` | 1/5 | `not-verifiable` | not-verifiable |
| `13:EL-13.16` | 1/5 | `not-verifiable` | not-verifiable |
| `13:EL-13.17` | 1/5 | `not-verifiable` | not-verifiable |
| `13:EL-13.18` | 1/5 | `not-verifiable` | not-verifiable |
| `13:EL-13.20` | 1/5 | `not-verifiable` | not-verifiable |
| `13:EL-13.3` | 1/5 | `not-verifiable` | not-verifiable |
| `13:EL-13.4` | 1/5 | `not-verifiable` | not-verifiable |
| `13:EL-13.5` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.13` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.16` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.24` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.26` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.29` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.30` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.34` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.36` | 1/5 | `fail` | fail |
| `1:EL-1.39` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.4` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.43` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.44` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.47` | 1/5 | `not-verifiable` | not-verifiable |
| `1:EL-1.5` | 1/5 | `not-verifiable` | not-verifiable |
| `13:EL-13.12` | 2/5 | `not-verifiable,not-verifiable` | not-verifiable |
| `13:EL-13.19` | 2/5 | `not-verifiable,not-verifiable` | not-verifiable |
| `13:EL-13.2` | 2/5 | `not-verifiable,not-verifiable` | not-verifiable |

_… plus 48 more in `variance-detection.tsv`._

