# Phase 1 — Cross-Run Metrics: el-md-exp (EL guides 1, 2, 13)

All metrics are against the `baseline-2026-04-15` (no MD tool). Scope: EL
discipline guides 1.md, 2.md, 13.md — 101 checklist items total. Model:
Haiku 4.5. 3 runs × 3 items = 9 agents per experiment.

**Item classification:**
- 36 **distance-only** — distance measurement alone resolves the verdict
- 15 **distance-plus** — distance needed but verdict also requires species
  verification, orientation ID, or other non-distance checks
- 28 **not-applicable** — documentation, material, methodology checks
- 22 **vertical-or-mixed** — needs vertical/3D clearance (tool can't measure)

---

## Summary table

| Metric | Run1 (04-15) | Run2 (04-16) | Run3 (04-17) | Run4 (04-17) |
|--------|-------------:|-------------:|-------------:|-------------:|
| **Recall (distance-only)** | 43.9% | 50.0% | 42.4% | 46.9% |
| Recall (distance-plus) | 56.5% | 88.9% | 66.7% | 68.0% |
| Recall (all-horizontal) | 47.5% | 65.2% | 53.3% | 56.1% |
| **Completion rate** | 0.0% | 100.0% | 100.0% | 95.3% |
| **Conversion (distance-only)** | 3.8% (1/26) | 5.0% (1/20) | 5.6% (1/18) | 8.3% (2/24) |
| Conversion (distance-plus) | 0.0% (0/15) | 41.2% (7/17) | 25.0% (4/16) | 26.7% (4/15) |
| Conversion (all-horizontal) | 2.4% (1/41) | 21.6% (8/37) | 14.7% (5/34) | 15.4% (6/39) |
| MD invocations | 14 | 13 | 10 | 13 |
| Results produced | 0 | 7 | 12 | 41 |
| Agents using MD (of 9) | 5 | 6 | 5 | 6 |

---

## Metric definitions

### Invocation recall

Of eligible items, how often did the agent have access to MD tool results?

**Three scopes:**
- **distance-only** (primary): items where distance alone resolves the verdict (36 items)
- **distance-plus**: items needing distance + additional info (15 items)
- **all-horizontal**: both combined (51 items)

**Attribution:** agent-level — if the agent called MD ≥1 time in a session,
all eligible items in that session count as "invoked." Overstates recall.

### Completion rate

Of call-dirs with metadata, how many produced a final measurement?

### Finding conversion rate

Of items that were `not-verifiable` in the baseline, how many converted to
`pass` or `fail` in the experiment?

---

## Key insight: distance-plus items convert at higher rates

The counterintuitive finding: distance-plus items (which need BOTH distance
AND some additional check) convert at **3× the rate** of distance-only items:

| Scope | Run4 conversion | Why |
|-------|----------------:|-----|
| distance-only | 8.3% (2/24) | The tool's clean win — purely distance-resolved verdicts |
| distance-plus | 26.7% (4/15) | Distance violations are often so severe (0 ft from OHE) that the "plus" requirement is moot |
| all-horizontal | 15.4% (6/39) | Combined rate |

**Example:** EL-2.3 requires species verification (distance-plus) AND 25-ft
clearance from OHE. Trees measured at 0 feet lateral distance — the distance
alone is conclusive regardless of species. The agent correctly calls this a
fail.

This means the tool's impact is BROADER than the "distance-only" count
suggests. Even items that technically need additional verification benefit
when the distance violation is clear-cut.

---

## Invocation recall pattern

Recall is stable at ~45-50% for distance-only, ~60-70% for distance-plus:

| | Distance-only | Distance-plus |
|---|---:|---:|
| Run1 | 43.9% | 56.5% |
| Run2 | 50.0% | 88.9% |
| Run3 | 42.4% | 66.7% |
| Run4 | 46.9% | 68.0% |

Distance-plus items have HIGHER recall because they tend to be tree-clearance
items (guides 2.md) where the agent naturally investigates the landscape plan
and invokes the tool. Distance-only items include transformer-pad checks
(guide 13.md) where the agent sometimes doesn't think to measure pad-to-pad
or pad-to-feature distances.

---

## Conversion progression

| | Distance-only | Distance-plus | All-horizontal |
|---|---:|---:|---:|
| Run1 | 3.8% | 0.0% | 2.4% |
| Run2 | 5.0% | 41.2% | 21.6% |
| Run3 | 5.6% | 25.0% | 14.7% |
| Run4 | 8.3% | 26.7% | 15.4% |

Distance-only conversion is climbing slowly (3.8% → 8.3%). Distance-plus
had a spike in run2 (41.2%) then settled at ~25-27%. The run2 spike is likely
because that was the first run where measurements actually completed —
all the "low-hanging fruit" conversions happened at once.

---

## Methodology notes

- Item classification: `analysis/guides/el-md-exp/item-classification.json`
  with `subClassification` field (distance-only vs distance-plus)
- Baseline: `runs/baseline-2026-04-15/` (3 items × 3 runs, no MD tool)
- Script: `scripts/compare-findings.py` with scoped breakdown
- All runs use Valley View Townhomes and Haiku 4.5
