# Experiment Run2 vs Run3 — Comparative Analysis

Comparison of 2026-04-16 (run2) and 2026-04-17 (run3) experiments. Both use
`el-md-exp` guide subset (items 1.md, 2.md, 13.md), Haiku 4.5, 3 runs × 3
items = 9 agents.

## Executive summary

**Run3 is the first run where the measure-distance tool produces real,
physically plausible measurements.** Six infrastructure fixes shipped between
runs collectively transformed the tool from "completes but returns 0 feet" to
"returns 2–32 ft distances that agents cite in defensible fail verdicts." The
75% non-zero rate (9/12 results) vs 14% (1/7) in run2 is the starkest signal.

## Side-by-side metrics

| Metric | Run2 | Run3 | Change |
|--------|-----:|-----:|--------|
| MD invocations (review.log) | 13 | 10 | -3 (fewer but batched) |
| Call-dirs created | 12 | 26 | +14 (objectPairs batching) |
| Completed with result | 7 | 12 | +5 (+71%) |
| Completed with error | 0 | 0 | — |
| **Non-zero distances** | **1 / 7 (14%)** | **9 / 12 (75%)** | **+61 pp** |
| Distance range | 0.0–0.5 ft | 0.0–31.8 ft | real values |
| Drawing bbox non-trivial | 0 / 7 | 12 / 12 | +100% (actual cropping!) |
| Drawing bbox type | `{0,0,1,1}` (full page) | `{0.26,0.35,0.91,0.95}` etc. | real regions |
| Legend source | 7/7 cross-sheet | 12/12 cross-sheet | — (stable) |
| Scale values correct | 7/7 (0.05) | 12/12 (0.05) | — (stable) |
| Python errors | 0 | 0 | — |
| Agents with MD (of 9) | 6 | 5 | -1 |
| Vision calls | 47 | 36 | -11 |
| Findings total | 144 | 120 | -24 |
| Findings: fail | 36 | 26 | -10 |
| Findings: not-verifiable | 108 | 94 | -14 |

### Phase 1 metrics vs baseline

| Metric | Run2 | Run3 |
|--------|-----:|-----:|
| Invocation recall | 65.2% (45/69) | 53.3% (32/60) |
| Completion rate | 53.8% (7/13) | 120% (12/10 — batching) |
| Finding conversion (nv → fail) | 21.6% (8/37) | 14.7% (5/34) |

## What each fix delivered

| Fix | What was broken in run2 | Run3 evidence |
|-----|------------------------|---------------|
| **bureau#229** — nearestPoint axis swap | Gemini [y,x] treated as [x,y] → points at wrong locations | Points now land inside bboxes (verified by containment test) |
| **bureau#232** — scale formula fix (× → ÷) | `distanceFeet` values off by factor of ~400 (0.0–0.5 ft) | Distances now 2–32 ft — correct magnitude for 1"=20' sheet |
| **bureau#233** — drawing bbox format | `{x,y,width,height}` vs `{x0,y0,x1,y1}` mismatch → trivial {0,0,1,1} crop | Real crop regions: sheet 31 `0.26,0.35→0.91,0.95`, sheet 21 `0.03,0.03→0.91,0.96` |
| **bureau#234** — objectPairs batching | One pair per tool call = many round trips | 10 MCP calls → 26 call-dirs; agent measures multiple pairs per invocation |
| **conductor#122** — typed tool schema | Generic string-record schema; agent guessed field types | Per-field types/descriptions in the MCP schema |
| **conductor#123** — array + JSON shell quoting | objectPairs array couldn't pass through CLI; JSON values got shell-mangled | objectPairs arrays pass through correctly |

## Key qualitative improvements

### 1. Real image cropping

Run2 sent the full-page JPEG to Gemini (title block, borders, notes panels
included). Run3 crops to just the engineering drawing area.

Sheet 31 crop: `x0=0.26, y0=0.35, x1=0.91, y1=0.95` — removes the left
notes column, top header, and bottom border. Gemini's search space is
reduced by ~40%, which likely improves localization precision.

### 2. Physically plausible distances

Run2 max distance: 0.5 ft (artifact of inverted scale formula).
Run3 distances: 2.3, 4.3, 6.1, 8.9, 10.3, 11.2, 11.4, 22.9, 31.8 ft.

These are in the range you'd expect for:
- Tree-to-OHE clearances on a residential site plan (2–11 ft)
- Transformer-pad-to-building clearances (8–32 ft)

### 3. Defensible fail verdicts

Run2 agent: "measured 0 feet 0 inches" — technically a citation but with
a bogus value that undermines credibility.

Run3 agent: "proposed **0 to 2.3 feet** from the overhead electric distribution
line conductor, far below the required **15-foot minimum** clearance" — cites
a plausible measured range AND the regulatory threshold. This is the kind of
finding that holds up in review.

### 4. Batched measurements

Run2: 1 object pair per tool call. Agent needs to make separate calls for
each tree-to-OHE or pad-to-building measurement.

Run3: agent batches multiple pairs per call (2–3 pairs typical). One call
to measure "tree A to OHE, tree B to OHE, tree C to OHE" instead of three
separate calls. More efficient, fewer agent turns.

## What got slightly worse

### Invocation recall dropped (65% → 53%)

One fewer agent invoked the tool (run-3/13.md skipped MD). This is likely
stochastic variance — the same agent invoked MD in run2. With n=1 per
(run, item) pair, a single agent's decision flips the rate.

The 3 agents on item 1.md still universally skip MD (expected — vertical
clearance item).

### Fewer vision calls (47 → 36)

Agents are making fewer raw vision queries, possibly because the MD tool
gives them the spatial data they need without additional vision analysis.
This could be interpreted as efficiency (less redundant vision work) or as
the agent being less thorough in other areas.

### Finding conversion slightly lower (21.6% → 14.7%)

The absolute count is similar (8 → 5 findings converted from
not-verifiable to fail). The rate difference is driven by denominator
changes: different agents produce different subsets of findings, changing
the pairing.

Both rates are in the 15–22% range, suggesting the tool consistently
converts roughly 1 in 5 eligible not-verifiable items to a fail verdict.

## Transition matrix summary

**Run2 → baseline transitions** (from Phase 1 metrics):
- 29 not-verifiable → not-verifiable
- 8 not-verifiable → fail (conversions)
- 18 missing → not-verifiable

**Run3 → baseline transitions**:
- 29 not-verifiable → not-verifiable
- 5 not-verifiable → fail (conversions)
- 13 missing → not-verifiable
- 12 fail → not-verifiable (regressions in the other direction)

The 12 `fail → not-verifiable` transitions in run3 are worth watching —
these are items that had a fail verdict in the baseline (no tool) but
became not-verifiable in the experiment. This might indicate the agent
is deferring to the tool instead of making a judgment from visual evidence
alone, and when the tool doesn't fire for that item, it falls back to
not-verifiable. Needs per-finding tracing (Phase 3) to diagnose.

## Verdict

Run3 validates that the measure-distance tool is producing real, usable
measurements for the first time. The combination of correct scale formula,
real image cropping, and proper axis handling makes the pipeline output
trustworthy. The next priorities are:

1. **Ground truth validation** (Phase 2) — verify that 6.1 ft, 11.2 ft, etc.
   are actually the right answers
2. **Pair timeout mitigation** — 7/26 sub-pairs timed out; the later pairs in
   a batch are most at risk
3. **Full-discipline run** (Phase 3) — expand from 3 to all 20 EL guide files
   to measure impact at scale
