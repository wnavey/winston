# Phase 1 — Pilot Metrics: Measure-Distance Tool Validation

Baseline: `baseline-2026-04-15` · Experiment: `experiment-run4`
Review guide: `el-md-exp` (EL guides 1, 2, 13 — 101 checklist items) × 3 runs = 9 agents
Per-item detail: `analysis/guides/el-md-exp/item-conversion-baseline-run4.md`

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

## 4. Consolidated status: Union rule (production)

Production uses **union**: a deficiency is flagged if ANY of the 3 runs flags
it. Fail wins over not-verifiable. This is the most conservative rule — a
single stochastic flag keeps an item in the output.

71 unique (item, deficiency) pairs were flagged by at least one run across
baseline and experiment combined.

| Status | Baseline | Experiment | Delta |
|---|---:|---:|---:|
| **Pass** | 5 | 5 | — |
| **Not-verifiable** | 31 | 44 | +13 |
| **Fail** | 35 | 22 | −13 |

Under union, the tool's main effect is **shifting fail → not-verifiable** (20
items). The tool-equipped agent is more conservative — measuring rather than
guessing — so definitive fail calls become "I measured but can't definitively
confirm." 4 items converted from not-verifiable to pass (tool confirmed
compliance). The net pass count is flat because 5 items that were pass in
baseline got flagged by the tool-equipped agent (new findings).

**Union transitions:**

| From → To | Count |
|---|---:|
| not-verifiable → pass | 4 |
| not-verifiable → not-verifiable | 19 |
| not-verifiable → fail | 8 |
| fail → pass | 1 |
| fail → not-verifiable | 20 |
| fail → fail | 14 |
| pass → not-verifiable | 5 |

---

## 5. Consolidated status: Majority vote (2 of 3)

Under **majority vote**, a deficiency is only flagged if 2+ runs agree. This
filters out stochastic single-run flags and better reflects the tool's
consistent impact.

| Status | Baseline | Experiment | Delta |
|---|---:|---:|---:|
| **Pass** | 18 | 27 | **+9** |
| **Not-verifiable** | 19 | 28 | +9 |
| **Fail** | 34 | 16 | **−18** |

The picture is much clearer under majority: **pass items increase by 9** and
**fail items drop by 18**. The tool is both confirming compliance (→ pass) and
replacing guesswork with measurement (fail → NV or pass).

**Majority transitions:**

| From → To | Count |
|---|---:|
| pass → pass | 15 |
| pass → not-verifiable | 2 |
| pass → fail | 1 |
| not-verifiable → pass | 7 |
| not-verifiable → not-verifiable | 10 |
| not-verifiable → fail | 2 |
| fail → pass | 5 |
| fail → not-verifiable | 16 |
| fail → fail | 13 |

---

## 6. Why the rules tell different stories

The union rule shows a flat pass count (5 → 5) while majority shows +9 passes.
The difference is entirely **invocation consistency**: when only 2 of 3 runs
use the tool and confirm compliance, majority counts that as a pass (2 > 1),
but union keeps it flagged because the 1 run that skipped the tool still has
a not-verifiable or fail entry.

Example: **EL-13.1** (transformer-to-building clearance)
- Baseline: all 3 runs flag it (2 NV, 1 fail) → union=fail, majority=fail
- Experiment: run-1 flags NV (didn't use tool), runs 2+3 pass (tool measured > 5 ft)
  → union=not-verifiable (1 flag keeps it), majority=pass (only 1/3, below threshold)

**The tool works when invoked.** The gap between union and majority is a measure
of how often the tool is NOT invoked — the invocation-consistency problem
(outstanding issue #3). If all 3 runs consistently used the tool, union results
would converge toward majority results.

---

## Methodology notes

- Baseline: `runs/v5.0/baseline-el-md-exp/` (no measure-distance tool)
- Experiment: `runs/v5.0/experiment-run4/` (with tool, two-call Gemini pipeline)
- **Union consolidation**: deficiency flagged if ≥1 run flags it. Status: fail > not-verifiable > pass.
- **Majority consolidation**: deficiency flagged if ≥2 runs flag it. Same status precedence.
- **Pass**: absence from findings output (the review prompt says "omit pass and n/a items").
- Per-run transitions count each (run, item, deficiency) independently.
- Consolidated transitions count each (item, deficiency) once after aggregation.
