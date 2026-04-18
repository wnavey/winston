# Phase 1 — Cross-Run Metrics: el-md-exp (EL guides 1, 2, 13)

All metrics are against the `baseline-2026-04-15` (no MD tool). Scope: EL
discipline guides 1.md, 2.md, 13.md — 101 checklist items, 51 horizontal-eligible.
Model: Haiku 4.5. 3 runs × 3 items = 9 agents per experiment.

---

## Summary table

| Metric | Run1 (04-15) | Run2 (04-16) | Run3 (04-17) | Run4 (04-17) |
|--------|-------------:|-------------:|-------------:|-------------:|
| **Invocation recall** | 47.5% | 65.2% | 53.3% | 56.1% |
| **Completion rate** | 0.0% | 100.0% | 100.0% | 95.3% |
| **Finding conversion** | 2.4% | 21.6% | 14.7% | 15.4% |
| MD invocations | 14 | 13 | 10 | 13 |
| Call-dirs total | 8 | 12 | 26 | 55 |
| Call-dirs with metadata | 8 | 7 | 12 | 43 |
| Results produced | 0 | 7 | 12 | 41 |
| Non-zero distances | 0 | 1 | 9 | 35 |
| Agents using MD (of 9) | 5 | 6 | 5 | 6 |

---

## Metric definitions

### Invocation recall

Of eligible (horizontal-distance) checklist items, how often did the agent
have access to MD tool results?

**Denominator:** eligible item × run opportunities. Each agent (run, item)
session reviews multiple deficiency IDs; each horizontal-classified ID is one
opportunity.

**Numerator:** opportunities where the agent made ≥1 MD call in that session.

**Limitation:** agent-level attribution — if the agent called MD once, ALL
eligible items in that session count as "invoked." Overstates recall since
the agent may not have measured every eligible item. Per-finding attribution
requires Review 5.0 agent tracing (Phase 3).

### Completion rate

Of call-dirs that reached the pipeline (have `metadata.json`), how many
produced a final measurement?

**Formula:** `results_produced / call_dirs_with_metadata`

This excludes parent batch-orchestrator dirs (which have no metadata of their
own) and dirs where the Gemini call timed out before writing metadata. It
gives a clean measure of "when the pipeline ran, did it finish?"

### Finding conversion rate

Of eligible items that were `not-verifiable` in the baseline, how many
converted to `pass` or `fail` in the experiment?

**Formula:** `(nv → pass + nv → fail) / (nv → any)`

Paired by (run-index, item-file, deficiency-ID). Items present in the
experiment but missing from the baseline are excluded.

---

## Interpretation

### Invocation recall (~50-65%)

Stable across runs at roughly 50-65%. The 3 agents on item 1.md consistently
skip MD (vertical-clearance item, expected). The remaining variance is
stochastic — individual agents decide whether to call the tool based on their
exploration of the site plan data.

**Improvement lever:** Phase 3 agent tracing will show exactly which eligible
items the agent considered and why it decided not to measure. The prompt nudge
(bureau#225) improved recall from run1→run2 but it's plateaued since.

### Completion rate (0% → 95-100%)

The dramatic jump from 0% (run1, Python 3.9 crash) to 100% (run2/run3) to
95% (run4) reflects the infrastructure fixes. The 95% in run4 is because 2
of 43 call-dirs with metadata didn't produce a result (likely the low-confidence
pairs that produced outlier distances).

**This metric is effectively solved.** The pipeline completes reliably.

### Finding conversion (~15-22%)

Roughly 1 in 5-7 previously-unverifiable findings converts to a concrete
pass/fail verdict with measured evidence. This has been consistent across
runs 2-4 despite massive improvements in measurement quality.

**Why hasn't it improved more?** Two reasons:
1. Many `not-verifiable` items in the baseline are about missing documentation
   (elevation sheets, surveyor data, plan notes) — not missing dimension
   measurements. The MD tool can't help with those.
2. The finding conversion metric only counts items that were `not-verifiable`
   in the baseline AND changed to pass/fail. Items where both baseline and
   experiment say `fail` (the tool provides better evidence but the verdict
   is the same) don't register as "conversions."

**Better metric for Phase 3:** finding-level precision and recall — did the
tool's measurements lead to CORRECT verdicts?

---

## Run progression narrative

| Run | What changed | Key result |
|-----|-------------|------------|
| **Run1** | First experiment attempt | 0% completion — Python 3.9 crash, MCP rejects |
| **Run2** | Python compat, MCP fix, prompt fix, DB fix | 100% completion, but all distances ~0 ft (scale inverted, axis swap) |
| **Run3** | Axis fix, scale fix, real cropping, objectPairs | 100% completion, 75% non-zero, distances 2-32 ft |
| **Run4** | Two-call Gemini (300 DPI), Option A skip, 600s timeout | 95% completion, 85% non-zero, distances 0-462 ft, 3.4× volume |

---

## Methodology notes

- Item classification: `analysis/item-classification.json` (101 items, 51 horizontal)
- Baseline: `runs/baseline-2026-04-15/` (3 items × 3 runs, no MD tool)
- Script: `scripts/compare-findings.py` with corrected completion rate
  (denominator = call-dirs with metadata, not MCP invocations)
- All runs use the same site plan (Valley View Townhomes) and model (Haiku 4.5)
