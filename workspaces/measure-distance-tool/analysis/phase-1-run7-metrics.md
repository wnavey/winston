# Phase 1 — Pilot Metrics: Measure-Distance Tool Validation

> ⚠️ **Superseded — 2026-05-05.** The 46.2% invocation recall reported here
> uses agent-session-level attribution and a baseline-NV-only denominator,
> ~5× the rigorous per-(item × run) recall of **12.4%** in
> [`rigorous-metrics/experiment-run7.md`](./rigorous-metrics/experiment-run7.md).
> See `measure-distance-science-plan.md` for the methodology update.

Baseline: `baseline-el-md-exp` · Experiment: `experiment-run7`
Scope: EL guides 1, 2, 13 (101 items: 36 distance-only, 15 distance-plus, 28 not-applicable, 22 vertical)

---

## 1. Invocation recall

Of distance-only items (where distance alone resolves the verdict),
how often did the agent have access to MD tool results?

| Metric | Value |
|--------|------:|
| Distance-only opportunities | 26 |
| Opportunities where agent invoked MD ≥1 time | 12 |
| **Invocation recall (distance-only)** | **46.2%** |
| Agents that called MD (of 9) | 6 |
| Agents that never called MD | 3 |

### By item scope

| Scope | Eligible | Invoked | Recall |
|-------|--------:|--------:|-------:|
| distance-only | 26 | 12 | 46.2% |
| distance-plus | 21 | 18 | 85.7% |
| all-horizontal | 47 | 30 | 63.8% |

> **Note**: Primary metric uses distance-only items (where distance alone resolves the verdict). Agent-level attribution: counts as "invoked" if agent made ≥1 MD call.

## 2. Completion rate

Of MD invocations, how often did the pipeline produce a measurement?

| Metric | Value |
|--------|------:|
| Total MD invocations (from review.log) | 9 |
| Call-dirs created | 53 |
| Call-dirs with metadata (denominator) | 44 |
| Completed with a result | 44 |
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
| not-verifiable → not-verifiable | 12 |
| not-verifiable → pass (implicit) | 30 |
| fail → pass (implicit) | 7 |
| missing → not-verifiable | 11 |
| missing → fail | 1 |
| not-verifiable → fail | 2 |

| Metric | Value |
|--------|------:|
| Baseline not-verifiable (distance-only) | 44 |
| → explicit fail | 2 |
| → implicit pass (no finding in experiment) | 30 |
| → still not-verifiable | 12 |
| **Total converted (fail + implicit pass)** | **32** |
| **Conversion rate** | **72.7%** |


### Conversion by item scope

| Scope | NV baseline | To fail | To pass (implicit) | Still NV | Converted | Rate |
|-------|----------:|---------:|-------------------:|---------:|----------:|-----:|
| distance-only | 44 | 2 | 30 | 12 | 32 | 72.7% |
| distance-plus | 21 | 3 | 9 | 9 | 12 | 57.1% |
| all-horizontal | 65 | 5 | 39 | 21 | 44 | 67.7% |

### Converted findings (not-verifiable → pass/fail)

| Run | Item | Deficiency | New status | Comment (excerpt) |
|-----|------|-----------|-----------|-------------------|
| run-1 | 1.md | EL-1.2 | pass (implicit) | (no finding — item passed) |
| run-1 | 1.md | EL-1.6 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.1 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.2 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.3 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.7 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.8 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.16 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.20 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.8 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-2 | 2.md | EL-2.6 | fail | Proposed mitigation trees planted 0 to 2.2 feet from the overhead electric line clearly violate the 10 lateral feet mini |
| run-2 | 2.md | EL-2.8 | pass (implicit) | (no finding — item passed) |
| run-3 | 1.md | EL-1.2 | pass (implicit) | (no finding — item passed) |
| run-3 | 1.md | EL-1.14 | fail | Proposed concrete retaining wall runs along the southern property line in the same location as the existing overhead ele |
| run-3 | 1.md | EL-1.25 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.1 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.7 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.12 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.20 | pass (implicit) | (no finding — item passed) |
| run-3 | 2.md | EL-2.6 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.10 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.13 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.14 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.15 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.38 | pass (implicit) | (no finding — item passed) |
| run-1 | 2.md | EL-2.1 | fail | Proposed trees measured at 0.5 feet and 4 feet from overhead electric distribution conductor (southern boundary). Non-ut |
| run-1 | 2.md | EL-2.3 | fail | Large trees (Cedar Elm ~50-60 ft, Live Oak ~50-80 ft mature height—both exceeding the 40-foot threshold per ECM Appendix |
| run-2 | 13.md | EL-13.9 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.14 | pass (implicit) | (no finding — item passed) |
| run-2 | 2.md | EL-2.1 | fail | Proposed mitigation trees along the southern boundary are located 0 to 2.2 feet from the overhead electric (OHE) conduct |
| run-2 | 2.md | EL-2.7 | pass (implicit) | (no finding — item passed) |
| run-2 | 2.md | EL-2.9 | pass (implicit) | (no finding — item passed) |
| run-1 | 1.md | EL-1.2 | pass (implicit) | (no finding — item passed) |
| run-1 | 1.md | EL-1.6 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.1 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.2 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.3 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.7 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.8 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.10 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.13 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.14 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.15 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.16 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.20 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.38 | pass (implicit) | (no finding — item passed) |
| run-1 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-1 | 2.md | EL-2.1 | fail | Proposed trees measured at 0.5 feet and 4 feet from overhead electric distribution conductor (southern boundary). Non-ut |
| run-1 | 2.md | EL-2.3 | fail | Large trees (Cedar Elm ~50-60 ft, Live Oak ~50-80 ft mature height—both exceeding the 40-foot threshold per ECM Appendix |
| run-2 | 13.md | EL-13.8 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.9 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.14 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.27 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.28 | pass (implicit) | (no finding — item passed) |
| run-2 | 13.md | EL-13.39 | pass (implicit) | (no finding — item passed) |
| run-2 | 2.md | EL-2.1 | fail | Proposed mitigation trees along the southern boundary are located 0 to 2.2 feet from the overhead electric (OHE) conduct |
| run-2 | 2.md | EL-2.6 | fail | Proposed mitigation trees planted 0 to 2.2 feet from the overhead electric line clearly violate the 10 lateral feet mini |
| run-2 | 2.md | EL-2.7 | pass (implicit) | (no finding — item passed) |
| run-2 | 2.md | EL-2.8 | pass (implicit) | (no finding — item passed) |
| run-2 | 2.md | EL-2.9 | pass (implicit) | (no finding — item passed) |
| run-3 | 1.md | EL-1.2 | pass (implicit) | (no finding — item passed) |
| run-3 | 1.md | EL-1.14 | fail | Proposed concrete retaining wall runs along the southern property line in the same location as the existing overhead ele |
| run-3 | 1.md | EL-1.25 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.1 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.7 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.12 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.17 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.18 | pass (implicit) | (no finding — item passed) |
| run-3 | 13.md | EL-13.20 | pass (implicit) | (no finding — item passed) |
| run-3 | 2.md | EL-2.6 | pass (implicit) | (no finding — item passed) |

---

## Summary

- **Invocation recall: 46.2%** — 12 of 26 eligible opportunities had an agent that called MD.
- **Completion rate: 100.0%** — 44 of 44 call-dirs with metadata produced a measurement.
- **Finding conversion rate: 72.7%** — 32 of 44 not-verifiable baseline findings resolved (2 to fail, 30 to implicit pass).

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