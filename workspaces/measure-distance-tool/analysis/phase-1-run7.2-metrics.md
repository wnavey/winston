# Phase 1 — Pilot Metrics: Measure-Distance Tool Validation

> ⚠️ **Superseded — 2026-05-05.** Invocation recall here uses agent-session-
> level attribution and a baseline-NV-only denominator that inflate the
> number ~5× vs the rigorous per-(item × run) framing. See
> [`rigorous-metrics/experiment-run7.2.md`](./rigorous-metrics/experiment-run7.2.md)
> for the rigorous numbers and `measure-distance-science-plan.md` for the
> methodology update.

Baseline: `baseline-el-md-exp` · Experiment: `experiment-run7.2`
Scope: EL guides 1, 2, 13 (101 items: 36 distance-only, 15 distance-plus, 28 not-applicable, 22 vertical)

---

## 1. Invocation recall

Of distance-only items (where distance alone resolves the verdict),
how often did the agent have access to MD tool results?

| Metric | Value |
|--------|------:|
| Distance-only opportunities | 19 |
| Opportunities where agent invoked MD ≥1 time | 3 |
| **Invocation recall (distance-only)** | **15.8%** |
| Agents that called MD (of 9) | 6 |
| Agents that never called MD | 3 |

### By item scope

| Scope | Eligible | Invoked | Recall |
|-------|--------:|--------:|-------:|
| distance-only | 19 | 3 | 15.8% |
| distance-plus | 20 | 17 | 85.0% |
| all-horizontal | 39 | 20 | 51.3% |

> **Note**: Primary metric uses distance-only items (where distance alone resolves the verdict). Agent-level attribution: counts as "invoked" if agent made ≥1 MD call.

## 2. Completion rate

Of MD invocations, how often did the pipeline produce a measurement?

| Metric | Value |
|--------|------:|
| Total MD invocations (from review.log) | 13 |
| Call-dirs created | 62 |
| Call-dirs with metadata (denominator) | 51 |
| Completed with a result | 51 |
| Completed with an error | 0 |
| **Completion rate** (results / call-dirs with metadata) | **100.0%** |

## 3. Finding conversion rate

Of **distance-only** items that were `not-verifiable` in the baseline,
how many converted to `pass` (implicit or explicit) or `fail`?

Missing experiment finding = **implicit pass** (agent evaluated the item
and found it compliant — the review workflow only emits findings for
non-compliant items).

| Transition | Count |
|-----------|------:|
| not-verifiable → not-verifiable | 8 |
| not-verifiable → pass (implicit) | 35 |
| fail → pass (implicit) | 7 |
| not-verifiable → fail | 1 |
| missing → not-verifiable | 6 |
| missing → fail | 4 |

| Metric | Value |
|--------|------:|
| Baseline not-verifiable (distance-only) | 44 |
| → explicit fail | 1 |
| → implicit pass (no finding in experiment) | 35 |
| → still not-verifiable | 8 |
| **Total converted (fail + implicit pass)** | **36** |
| **Conversion rate** | **81.8%** |


### Conversion by item scope

| Scope | NV baseline | To fail | To pass (implicit) | Still NV | Converted | Rate |
|-------|----------:|---------:|-------------------:|---------:|----------:|-----:|
| distance-only | 44 | 1 | 35 | 8 | 36 | 81.8% |
| distance-plus | 21 | 3 | 10 | 8 | 13 | 61.9% |
| all-horizontal | 65 | 4 | 45 | 16 | 49 | 75.4% |

### Converted findings (not-verifiable → pass/fail)

| Run | Item | Deficiency | New status | Comment (excerpt) |
|-----|------|-----------|-----------|-------------------|
| run-1 | 1.md | EL-1.6 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.1 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.2 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.3 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.7 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.8 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.12 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.16 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.19 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.20 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-1 | 2.md | EL-2.6 | fail | Proposed tree measured at 8.5 lateral feet from overhead electric utility pole. UCM § 1.10.10.4 prohibits trees within 1 |
| run-1 | 2.md | EL-2.8 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.8 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-3 | 1.md | EL-1.14 | pass (implicit) | (no finding — item passed) |
| run-3 | 1.md | EL-1.25 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.1 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.3 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.7 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.12 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.20 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-3 | 2.md | EL-2.6 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.9 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.10 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.13 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.14 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.15 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.38 | pass (implicit) | (no finding — item passed) |
| run-1 | 2.md | EL-2.3 | fail | Large trees with mature height 40+ feet (Cedar Elm and Live Oak per ECM Appendix F) are proposed at 0-1.5 feet from over |
| run-1 | 2.md | EL-2.9 | pass (implicit) | (no finding — item passed) |
| run-2 | 2.md | EL-2.1 | fail | Landscape plan shows proposed trees at 3.1 to 6 feet from overhead electric distribution conductor running along souther |
| run-3 | 1.md | EL-1.37 | fail | Landscape plan (Sheet 31) depicts proposed mitigation trees approximately 10-15 feet from southern overhead electric lin |
| run-3 | 13.md | EL-13.13 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.14 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.15 | pass (implicit) | (no finding — item passed) |
| run-1 | 1.md | EL-1.6 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.1 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.2 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.3 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.7 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.8 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.9 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.10 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.12 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.13 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.14 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.15 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.16 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.19 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.20 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.38 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-1 | 2.md | EL-2.3 | fail | Large trees with mature height 40+ feet (Cedar Elm and Live Oak per ECM Appendix F) are proposed at 0-1.5 feet from over |
| run-1 | 2.md | EL-2.6 | fail | Proposed tree measured at 8.5 lateral feet from overhead electric utility pole. UCM § 1.10.10.4 prohibits trees within 1 |
| run-1 | 2.md | EL-2.8 | pass (implicit) | (no finding — item passed) |
| run-1 | 2.md | EL-2.9 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.8 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-2 | 2.md | EL-2.1 | fail | Landscape plan shows proposed trees at 3.1 to 6 feet from overhead electric distribution conductor running along souther |
| run-3 | 1.md | EL-1.14 | pass (implicit) | (no finding — item passed) |
| run-3 | 1.md | EL-1.25 | pass (implicit) | (no finding — item passed) |
| run-3 | 1.md | EL-1.37 | fail | Landscape plan (Sheet 31) depicts proposed mitigation trees approximately 10-15 feet from southern overhead electric lin |
| run-3 | 13.md | EL-13.1 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.3 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.7 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.12 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.13 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.14 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.15 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.20 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-3 | 2.md | EL-2.6 | pass (implicit) | (no finding — item passed) |

---

## Summary

- **Invocation recall: 15.8%** — 3 of 19 eligible opportunities had an agent that called MD.
- **Completion rate: 100.0%** — 51 of 51 call-dirs with metadata produced a measurement.
- **Finding conversion rate: 81.8%** — 36 of 44 not-verifiable baseline findings resolved (1 to fail, 35 to implicit pass).

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