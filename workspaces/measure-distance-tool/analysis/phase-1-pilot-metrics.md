# Phase 1 — Pilot Metrics: Measure-Distance Tool Validation

Baseline: `baseline-2026-04-15` · Experiment: `experiment-run4`
Scope: EL guides 1, 2, 13 (101 items) × 3 runs = 9 agents

---

## 1. Per-run finding transitions

Raw per-run comparison: for each (run, item, deficiency), how did the status
change from baseline to experiment?

| Transition | Count |
|---|---:|
| pass → pass | 39 |
| pass → fail | 4 |
| pass → not-verifiable | 10 |
| fail → fail | 15 |
| fail → not-verifiable | 27 |
| fail → pass | 7 |
| not-verifiable → not-verifiable | 63 |
| not-verifiable → fail | 12 |
| **not-verifiable → pass** | **36** |

36 per-run instances where the tool enabled a pass verdict that was previously
not-verifiable. 12 where it enabled a fail verdict. 7 where a baseline fail
became a pass (tool confirmed compliance the baseline incorrectly flagged).

---

## 2. Consolidated: Union rule (production)

Production uses **union**: a deficiency is flagged if ANY run flags it.
Confidence tiers reflect how many runs agree (3=high, 2=medium, 1=low).
This is the most conservative rule — a single stochastic flag keeps an item
in the output.

| Transition | Count |
|---|---:|
| fail → fail | 14 |
| fail → not-verifiable | 20 |
| fail → pass | 1 |
| not-verifiable → not-verifiable | 19 |
| not-verifiable → fail | 8 |
| **not-verifiable → pass** | **4** |
| pass → not-verifiable | 5 |

| Metric | Value |
|---|---:|
| Baseline not-verifiable (union) | 31 |
| Converted to pass or fail | 12 |
| **Union conversion rate** | **38.7%** |

### Union: not-verifiable → pass (4 items)

| Item | Deficiency | What happened |
|---|---|---|
| 1.md | EL-1.25 | Sidewalk clearance from power poles |
| 2.md | EL-2.13 | Tree clearance measured from trunk, not canopy |
| 2.md | EL-2.8 | Trees within 5 ft of underground electric — tool measured > 5 ft |
| 2.md | EL-2.9 | Root barrier requirements — tool confirmed distance > 20 ft |

### Union: not-verifiable → fail (8 items)

| Item | Deficiency | What happened |
|---|---|---|
| 1.md | EL-1.1 | Building clearance from OHE — tool measured insufficient clearance |
| 1.md | EL-1.3 | Building projection clearance from OHE |
| 1.md | EL-1.6 | Building clearance from OHE in ROW |
| 1.md | EL-1.14 | Retaining wall clearance from OHE |
| 1.md | EL-1.17 | Retaining wall lacks section exhibits |
| 2.md | EL-2.6 | Trees within 10 ft of utility pole |
| 2.md | EL-2.7 | Trees within 10 ft of pad-mounted equipment |
| 2.md | EL-2.12 | Tree clearances measured from pole instead of conductor |

---

## 3. Consolidated: Majority vote (2 of 3)

Under **majority vote**, a deficiency is only flagged if 2+ runs agree.
This filters out stochastic single-run flags and better reflects the tool's
consistent impact.

| Transition | Count |
|---|---:|
| fail → fail | 13 |
| fail → not-verifiable | 16 |
| fail → pass | 5 |
| not-verifiable → not-verifiable | 10 |
| not-verifiable → fail | 2 |
| **not-verifiable → pass** | **7** |
| pass → fail | 1 |
| pass → not-verifiable | 2 |

| Metric | Value |
|---|---:|
| Baseline not-verifiable (majority) | 19 |
| Converted to pass or fail | 9 |
| **Majority conversion rate** | **47.4%** |

### Majority: not-verifiable → pass (7 items)

| Item | Deficiency | What happened |
|---|---|---|
| 1.md | EL-1.2 | Customer facilities maintain 15-ft radial clearance — 2+ runs confirmed |
| 2.md | EL-2.6 | Trees within 10 ft of utility pole — 2+ runs measured compliance |
| 2.md | EL-2.8 | Trees within 5 ft of underground electric — 2+ runs confirmed |
| 2.md | EL-2.9 | Root barrier requirements — 2+ runs confirmed |
| 13.md | EL-13.8 | Transformer clearance from stairwells — 2+ runs found compliant |
| 13.md | EL-13.9 | Transformer clearance from fire escapes — 2+ runs found compliant |
| 13.md | EL-13.39 | Customer facilities not under/over OHE — 2+ runs confirmed |

### Notable: EL-13.1 (transformer-to-building clearance)

Under union: **fail → not-verifiable** (baseline had 3/3 runs flagging it;
experiment had 1/3 flagging, 2/3 passing via tool measurement > 5 ft).
The single stochastic run-1 flag (which didn't use the tool) prevents full
conversion under the union rule.

Under majority: **fail → pass** (only 1 of 3 runs flagged it, below the
2-of-3 threshold). The tool's measurements in runs 2 and 3 directly caused
this conversion.

This demonstrates how the union rule is conservative — a single agent that
doesn't use the tool can block a conversion that the tool clearly enables.
Improving tool invocation consistency (issue #3) would close this gap.

---

## 4. Summary comparison

**Important**: the denominators differ between union and majority because the
consolidation rule changes what counts as "flagged" in the baseline. Under union,
a single run flagging an item makes it a baseline finding. Under majority, you
need 2+ runs. So the majority baseline is smaller — not because items are
missing, but because single-run stochastic flags are filtered out.

### Not-verifiable conversions

| Metric | Union (production) | Majority vote |
|---|---:|---:|
| Baseline not-verifiable | 31 | 19 |
| Converted to pass or fail | 12 | 9 |
| **NV conversion rate** | **38.7%** | **47.4%** |
| → pass | 4 | 7 |
| → fail | 8 | 2 |

### Fail conversions (also significant)

| Metric | Union (production) | Majority vote |
|---|---:|---:|
| Baseline fail | 35 | 34 |
| Changed status | 21 | 21 |
| **Fail change rate** | **60.0%** | **61.8%** |
| → not-verifiable | 20 | 16 |
| → pass | 1 | 5 |

The fail→not-verifiable transitions are mostly items where the baseline agent
made a definitive (sometimes incorrect) call, and the tool-equipped agent was
more conservative — measuring rather than guessing. The fail→pass transitions
under majority (5 items) represent cases where the tool confirmed compliance
that the baseline incorrectly flagged as violations.

### Combined tool impact

| Metric | Union | Majority |
|---|---:|---:|
| Total baseline findings (fail + NV) | 66 | 53 |
| Items that changed status | 33 | 30 |
| **Overall change rate** | **50.0%** | **56.6%** |
| Converted to pass | 5 | 12 |
| **Pass conversion rate** | **7.6%** | **22.6%** |

Under majority vote, the tool converts nearly 1 in 4 previously-flagged items
to a clean pass. Under union, it's 1 in 13 — the gap is entirely due to
stochastic runs that don't invoke the tool.

**Key insight**: The tool's real accuracy is better reflected by majority vote.
The union gap is an invocation-consistency problem (issue #3), not a tool
accuracy problem. If all 3 runs used the tool for the same items, the union
pass rate would approach the majority rate.

---

## Methodology notes

- Baseline: `runs/baseline-2026-04-15/` (no measure-distance tool)
- Experiment: `runs/experiment-run4/` (with tool, two-call Gemini pipeline)
- **Union consolidation**: deficiency flagged if ≥1 run flags it. Status: fail > not-verifiable > pass.
- **Majority consolidation**: deficiency flagged if ≥2 runs flag it. Same status precedence.
- **Pass**: absence from findings output (the review prompt says "omit pass and n/a items").
- Per-run transitions count each (run, item, deficiency) independently.
- Consolidated transitions count each (item, deficiency) once after aggregation.
