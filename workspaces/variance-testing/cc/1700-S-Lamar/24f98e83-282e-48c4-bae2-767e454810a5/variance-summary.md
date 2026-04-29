# Variance Summary — 1700 S. Lamar — runs=10 baseline (2026-04-28, no code changes)

**Review ID:** `24f98e83-282e-48c4-bae2-767e454810a5`  
**Source:** `consolidated-findings.json`  
**Total refs:** 185  
**Runs per ref:** 10

## Variance class

| Class | Count | % |
|---|---:|---:|
| unanimous | 139 | 75.1% |
| partial-detection | 0 | 0.0% |
| split-verdict | 46 | 24.9% |
| split-and-partial | 0 | 0.0% |
| no-findings | 0 | 0.0% |

## Per-run status patterns

Each row is the multiset of statuses reported across the runs (sorted).

| Pattern | Count |
|---|---:|
| `pass,pass,pass,pass,pass,pass,pass,pass,pass,pass` | 82 |
| `not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable` | 54 |
| `fail,pass,pass,pass,pass,pass,pass,pass,pass,pass` | 11 |
| `fail,fail,pass,pass,pass,pass,pass,pass,pass,pass` | 9 |
| `fail,fail,fail,fail,fail,fail,pass,pass,pass,pass` | 4 |
| `fail,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable` | 4 |
| `fail,fail,fail,pass,pass,pass,pass,pass,pass,pass` | 3 |
| `fail,fail,fail,fail,fail,fail,fail,fail,fail,fail` | 3 |
| `fail,fail,fail,fail,pass,pass,pass,pass,pass,pass` | 2 |
| `fail,fail,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable` | 2 |
| `fail,fail,fail,fail,fail,fail,fail,fail,not-applicable,not-applicable` | 2 |
| `fail,fail,fail,fail,fail,fail,fail,fail,pass,pass` | 2 |
| `fail,fail,fail,fail,fail,pass,pass,pass,pass,pass` | 1 |
| `not-applicable,pass,pass,pass,pass,pass,pass,pass,pass,pass` | 1 |
| `fail,fail,fail,fail,fail,fail,fail,fail,not-applicable,pass` | 1 |
| `fail,fail,fail,fail,fail,fail,fail,fail,fail,pass` | 1 |
| `fail,fail,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,pass,pass,pass` | 1 |
| `fail,fail,fail,fail,fail,fail,fail,fail,fail,not-applicable` | 1 |
| `fail,fail,fail,fail,fail,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable` | 1 |

## High-variance refs by grouping

| Grouping | Split refs |
|---|---:|
| cc-13 | 12 |
| cc-22 | 8 |
| cc-24 | 6 |
| cc-23 | 5 |
| cc-3 | 5 |
| cc-1 | 4 |
| cc-15 | 2 |
| cc-2 | 2 |
| cc-19 | 1 |
| cc-5 | 1 |

## Top split-verdict refs (highest entropy first)

| Ref | Pattern | Winning | Confidence | Entropy |
|---|---|---|---|---:|
| `cc-23:CC-23-07` | `fail,fail,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,pass,pass,pass` | not-applicable | medium | 1.486 |
| `cc-13:AW-45` | `fail,fail,fail,fail,fail,pass,pass,pass,pass,pass` | fail | medium | 1.000 |
| `cc-24:CC-24-15` | `fail,fail,fail,fail,fail,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable` | fail | medium | 1.000 |
| `cc-13:AW-23` | `fail,fail,fail,fail,fail,fail,pass,pass,pass,pass` | fail | medium | 0.971 |
| `cc-13:AW-27` | `fail,fail,fail,fail,pass,pass,pass,pass,pass,pass` | pass | medium | 0.971 |
| `cc-1:CC-1-26` | `fail,fail,fail,fail,pass,pass,pass,pass,pass,pass` | pass | medium | 0.971 |
| `cc-22:CC-22-14` | `fail,fail,fail,fail,fail,fail,pass,pass,pass,pass` | fail | medium | 0.971 |
| `cc-23:CC-23-01` | `fail,fail,fail,fail,fail,fail,pass,pass,pass,pass` | fail | medium | 0.971 |
| `cc-3:CC-3-18` | `fail,fail,fail,fail,fail,fail,pass,pass,pass,pass` | fail | medium | 0.971 |
| `cc-22:CC-22-15` | `fail,fail,fail,fail,fail,fail,fail,fail,not-applicable,pass` | fail | medium | 0.922 |
| `cc-13:AW-18` | `fail,fail,fail,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.881 |
| `cc-13:AW-21` | `fail,fail,fail,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.881 |
| `cc-22:CC-22-19` | `fail,fail,fail,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.881 |
| `cc-13:AW-05` | `fail,fail,pass,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.722 |
| `cc-13:AW-28` | `fail,fail,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable` | not-applicable | medium | 0.722 |
| `cc-13:AW-29` | `fail,fail,pass,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.722 |
| `cc-13:AW-30` | `fail,fail,pass,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.722 |
| `cc-13:AW-31` | `fail,fail,pass,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.722 |
| `cc-1:CC-1-02` | `fail,fail,pass,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.722 |
| `cc-1:CC-1-13` | `fail,fail,pass,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.722 |
| `cc-22:CC-22-13` | `fail,fail,pass,pass,pass,pass,pass,pass,pass,pass` | pass | medium | 0.722 |
| `cc-24:CC-24-03` | `fail,fail,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable,not-applicable` | not-applicable | medium | 0.722 |
| `cc-24:CC-24-04` | `fail,fail,fail,fail,fail,fail,fail,fail,not-applicable,not-applicable` | fail | medium | 0.722 |
| `cc-24:CC-24-16` | `fail,fail,fail,fail,fail,fail,fail,fail,not-applicable,not-applicable` | fail | medium | 0.722 |
| `cc-2:CC-2-14` | `fail,fail,fail,fail,fail,fail,fail,fail,pass,pass` | fail | medium | 0.722 |

_… plus 21 more split refs in `variance-split-refs.tsv`._

