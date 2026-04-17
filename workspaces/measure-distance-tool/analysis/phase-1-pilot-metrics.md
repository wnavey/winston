# Phase 1 — Pilot Metrics: Measure-Distance Tool Validation

Baseline: `baseline-2026-04-15` · Experiment: `experiment-run2`
Scope: EL guides 1, 2, 13 (101 items, 51 horizontal-eligible) × 3 runs = 9 agents

---

## 1. Invocation recall

Of eligible (horizontal-distance) items, how often did the agent have
access to MD tool results?

| Metric | Value |
|--------|------:|
| Eligible item × run opportunities | 69 |
| Opportunities where agent invoked MD ≥1 time | 45 |
| **Invocation recall** | **65.2%** |
| Agents that called MD (of 9) | 6 |
| Agents that never called MD | 3 |

> **Note**: Agent-level attribution: an eligible item counts as "invoked" if its agent made ≥1 MD call. Without per-finding tracing, we cannot attribute specific invocations to specific items.

## 2. Completion rate

Of MD invocations, how often did the pipeline produce a measurement?

| Metric | Value |
|--------|------:|
| Total MD invocations (from review.log) | 13 |
| Call-dirs created (reached script) | 12 |
| Completed with a result | 7 |
| Completed with an error | 0 |
| **Completion rate** | **53.8%** |

## 3. Finding conversion rate

Of eligible items that were `not-verifiable` in the baseline, how many
converted to `pass` or `fail` in the experiment?

| Transition | Count |
|-----------|------:|
| fail → fail | 4 |
| not-verifiable → not-verifiable | 29 |
| missing → not-verifiable | 18 |
| not-verifiable → fail | 8 |
| fail → not-verifiable | 10 |

| Metric | Value |
|--------|------:|
| Baseline not-verifiable (eligible items) | 37 |
| Converted to pass or fail | 8 |
| **Conversion rate** | **21.6%** |

### Converted findings (not-verifiable → pass/fail)

| Run | Item | Deficiency | New status | Comment (excerpt) |
|-----|------|-----------|-----------|-------------------|
| run-1 | 13.md | EL-13.38 | fail | Vision analysis indicates transformer pads located west of Building 1, east of Building 4, and south of Building 7 are p |
| run-1 | 2.md | EL-2.1 | fail | Mitigation trees are located 0-5 feet north of the overhead electric line along the southern property boundary. Plant sc |
| run-1 | 2.md | EL-2.3 | fail | Proposed Cedar Elm (10 trees) and Live Oak (2 trees) have typical mature heights of 40-50 feet, meeting the definition o |
| run-2 | 2.md | EL-2.1 | fail | Proposed trees including Live Oak are positioned immediately adjacent (approximately 0 feet) to the overhead electric li |
| run-3 | 1.md | EL-1.37 | fail | Proposed trees are not verified to be from the Utility Compatible Shade Trees list per ECM Appendix F. The landscape pla |
| run-3 | 2.md | EL-2.1 | fail | Proposed trees at southern boundary are planted directly at the overhead electric line with zero clearance (measured 0 f |
| run-3 | 2.md | EL-2.3 | fail | Proposed Live Oak trees (minimum specification 100 gallon, 4-inch caliper, 16-foot height minimum) and Cedar Elm trees ( |
| run-3 | 2.md | EL-2.6 | fail | Trees are proposed 0.5 feet from the overhead electric line along the northern boundary, indicating proximity to utility |

---

## Summary

- **Invocation recall: 65.2%** — 45 of 69 eligible opportunities had an agent that called MD.
- **Completion rate: 53.8%** — 7 of 13 invocations produced a measurement.
- **Finding conversion rate: 21.6%** — 8 of 37 not-verifiable baseline findings converted to pass/fail.

## Methodology notes

- Item classification source: `analysis/item-classification.json` (parsed from
  `analysis/items-requiring-distance-measurement.md`).
- Invocation recall uses **agent-level** attribution: if an agent made ≥1 MD call,
  all eligible items in that agent session count as "invoked." This overstates recall
  since the agent may not have measured every eligible item. Per-finding attribution
  requires Review 5.0 agent tracing (Phase 3).
- Finding conversion pairs baseline and experiment by (run-index, item-file,
  deficiency-ID). Items present in experiment but missing from baseline are skipped.
- "Horizontal" classification means the item requires plan-view distance measurement
  that the tool CAN perform. "Vertical-or-mixed" items are excluded from eligible
  counts but tracked separately.