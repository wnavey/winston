# Experiment Run3 vs Run4 — Comparative Analysis

Comparison of 2026-04-17 run3 (single-call Gemini) and 2026-04-17 run4
(two-call Gemini Phase A). Both use `el-md-exp` guide subset, Haiku 4.5,
3 runs × 3 items = 9 agents.

## Executive summary

**Run4 is the first production run of the two-call Gemini pipeline.** The
pipeline is stable (100% call2 success, zero fallbacks), measurement volume
tripled (41 vs 12 results), and the non-zero rate improved from 75% to 85%.
However, ~30% of measurements are in the 100+ ft range, which likely exceeds
the physical property dimensions and warrants investigation.

## Side-by-side metrics

| Metric | Run3 | Run4 | Change |
|--------|-----:|-----:|--------|
| MD invocations (review.log) | 10 | 13 | +3 |
| Call-dirs created | 26 | 55 | +29 |
| **Two-call mode** | **0** | **41** | **NEW** |
| Call2 success rate | — | 41/41 (100%) | — |
| Call2 fallbacks to call1 | — | 0 | — |
| Completed with result | 12 | 41 | **+242%** |
| Completed with error | 0 | 0 | — |
| **Non-zero distances** | **9 / 12 (75%)** | **35 / 41 (85%)** | **+10 pp** |
| Zero distances | 3 / 12 (25%) | 6 / 41 (15%) | -10 pp |
| Distance median | 8.9 ft | 27.3 ft | +18.4 ft |
| Distance max | 31.8 ft | 462.8 ft | suspect outliers |
| Measurements >100 ft | 0 | 12 (29%) | suspect |
| Agents with MD (of 9) | 5 | 6 | +1 (item 1.md!) |
| Vision calls | 36 | 32 | -4 |
| Findings total | 120 | 131 | +11 |
| Finding conversion (nv→fail) | 14.7% | 15.4% | +0.7 pp |

## What improved

### 1. Two-call pipeline is production-ready

41/41 two-call completions with zero fallbacks. The pipeline reliably:
1. Sends call 1 at 120 DPI → gets coarse bounding boxes
2. Computes refined crop (union + padding + quadrant floor)
3. Re-renders from PDF at 300 DPI
4. Sends call 2 → gets precise nearestPoints
5. Uses call 2's localization for compute-distance

No timeout issues despite doubling the Gemini calls — the conductor#125
timeout bump from 120s to 600s gives enough headroom.

### 2. Measurement volume tripled

41 results from 13 invocations (3.15× yield per call). Run3 produced 12
results from 10 invocations (1.2×). The difference is primarily from more
aggressive objectPairs batching — run-2/13.md alone batched 17 pairs across
4 tool calls.

### 3. Item 1.md used MD for the first time

In runs 1-3, ALL agents on item 1.md (Site Feature Clearances from OHE)
skipped the measure-distance tool — the item was considered "vertical
clearance only." In run4, **run-1/1.md invoked MD** for the first time and
measured tree-to-OHE distance (3.3 ft, 0 ft). The agent cited these in its
EL-1.37 finding.

This suggests the prompt improvements (bureau#225) plus the Option A
short-circuit (bureau#236 — removing the 60-80s stub that previously ate
into the timeout budget) gave the agent enough time and encouragement to
try the tool on items it previously considered out of scope.

### 4. Richer finding citations

Run3 agents cited 1-2 distances per finding. Run4 agents batch multiple
measurements:

> "overhead distribution electric line present with six mitigation trees
> (**measured at 0, 0, 12.6, and 0 feet lateral distances** from conductor)"

This is a direct result of objectPairs batching — the agent measures
multiple pairs per call and includes all results in a single finding.

### 5. Non-zero rate improved

85% non-zero (35/41) vs 75% (9/12). The 300 DPI refined crop appears to
help Gemini distinguish features that are close but not overlapping. The
remaining 6 zero-distance cases are tree symbols that genuinely sit directly
on the OHE line.

## What needs investigation

### Outlier distances (100+ ft)

| Range | Run3 | Run4 |
|-------|-----:|-----:|
| 0–50 ft | 12 (100%) | 24 (59%) |
| 50–100 ft | 0 | 5 (12%) |
| 100–200 ft | 0 | 8 (20%) |
| > 200 ft | 0 | 4 (10%) |

Run3's maximum was 31.8 ft — all measurements were within a plausible range
for a ~2-acre residential site. Run4 has 12 measurements exceeding 100 ft,
with a max of 462.8 ft. The property's longest dimension is roughly 300 ft.

Possible causes:
1. **Coordinate mapping amplification:** The two-call pipeline maps between
   three coordinate systems (full-page → drawing crop → refined crop). If
   the refined crop bbox is small relative to the page, small errors in
   call2's 0-1000 space get amplified when projected back to page coordinates.
2. **Low call1 confidence on some pairs:** The worst outlier (462.8 ft) came
   from a pair where call1 confidence was 0.90 and call2 was 0.90. But the
   260.7 ft case had call1=0.30, call2=0.40 — very low confidence on both
   calls, suggesting Gemini wasn't sure where the objects were.
3. **Cross-sheet object confusion:** Some agent-described objects (e.g.,
   "Transformer Pad 4 near Building 8") may not be precisely locatable on
   the sheet, causing Gemini to pick features far apart.

**Recommendation:** Add a sanity-check upper bound in compute-distance. If the
measured distance exceeds the sheet's physical dimensions (computable from
the scale + page size), flag it as `confidence: low` instead of `medium`.

### Agent adoption is inconsistent

6/9 agents invoked MD in run4 — same fraction as run3 but different agents:

| Agent | Run3 | Run4 |
|-------|------|------|
| run-1/1.md | skip | **invoked** (new!) |
| run-1/13.md | 5 calls | **skip** (regression) |
| run-2/1.md | skip | skip |
| run-3/1.md | skip | skip |
| run-3/13.md | 1 call | 3 calls |

The run-1/13.md regression (5 calls → 0) is stochastic — agent-level
variance. With only 1 sample per (run, item) pair, individual agent decisions
flip between runs.

## Timing

Run4 completed in ~41 minutes for 9 agents — up from run3's ~25 minutes.
The increase is expected: each measurement now makes two sequential Gemini
calls plus a PDF re-render, and run4 produced 3.4× more measurements (41 vs
12). Per-phase timing was not yet available in run4 (bureau#241 merged after
run4), but will be captured in future runs.

## Verdict

The two-call Gemini pipeline works. It's stable (zero fallbacks), produces
more measurements (3× volume), and the 300 DPI refined crop improves the
non-zero rate (75% → 85%). The main concern is distance outliers — 29% of
measurements exceed 100 ft, which is likely a coordinate-mapping amplification
issue in the two-call pipeline. This needs a sanity-check bound before the
measurements can be trusted for regulatory verdicts.

**Next priorities:**
1. Investigate the 100+ ft outliers via the viewer (compare call1 vs call2
   bboxes to see where the mapping diverges)
2. Add a distance sanity-check upper bound in compute-distance
3. Run the compare-findings Phase 1 metrics with run4 data to measure
   finding conversion impact
4. Begin Phase 2 ground truth validation
