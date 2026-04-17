# Experiment Run2 Deep Dive — 2026-04-16

Detailed analysis of `experiment-run2-2026-04-16`, the second iteration of the
`el-md-exp` A/B experiment. Guide subset: `1.md`, `2.md`, `13.md`. Model:
Haiku 4.5. 3 independent runs × 3 items = 9 agents. Overlay:
`--experiment=measure-distance`.

## Run configuration

- **Workflow:** review v5.1.0 + measure-distance experiment overlay
- **Guide:** `el-md-exp` (3 items: 1.md, 2.md, 13.md)
- **Site plan:** Valley View Townhomes (SP-2025-0126C)
  - Project: `63cead15-41f8-418c-b0ef-bd5c2b44719a`
  - Document: `1144b126-1216-4dee-a89c-178950fa7777`
- **Key fixes since run1:** Bureau #221 (Python 3.9), #225 (prompt nudge),
  #226 (DB table renames); Conductor #118 (numeric MCP args), #121 (shell-quoting)

## Call inventory

12 call-dirs total (13 MCP invocations in review.log; 1 likely timed out
before creating a dir). By completion status:

| Status | Count | Description |
|--------|------:|-------------|
| **Complete** (metadata + result) | 7 | Full pipeline: Gemini → compute-distance → result JSON |
| **Gemini succeeded, no metadata** | 1 | Localization succeeded but compute-distance timed out before writing metadata |
| **Gemini timed out** | 4 | Only `cropped.jpg` + `legend.txt` + `prompt.txt` — no Gemini response |
| **Total** | **12** | |

### Per-call detail

| # | Call-dir | Run | Item | Complete? | Gemini conf | Distance | Confidence | Elapsed |
|---|----------|-----|------|-----------|------------|----------|------------|---------|
| 1 | `5at6-run-2-2` | run-2 | 2.md | ✅ | 0.95 | 0 ft / 0 in | medium | 101s |
| 2 | `7fb8-run-3-13` | run-3 | 13.md | partial | — | — | — | — |
| 3 | `g6cg-run-2-2` | run-2 | 2.md | ✅ | 0.95 | 0 ft / 0 in | medium | 101s |
| 4 | `jztc-run-1-13` | run-1 | 13.md | timed out | — | — | — | — |
| 5 | `9ns4-run-1-13` | run-1 | 13.md | timed out | — | — | — | — |
| 6 | `v8kq-run-3-2` | run-3 | 2.md | ✅ | 0.90 | 0 ft / 0.1 in | medium | 102s |
| 7 | `dsoy-run-1-2` | run-1 | 2.md | timed out | — | — | — | — |
| 8 | `2f3d-run-3-2` | run-3 | 2.md | ✅ | 0.90 | 0 ft / 0 in | high | 116s |
| 9 | `raqr-run-2-13` | run-2 | 13.md | ✅ | 0.95 | 0 ft / 0 in | high | 108s |
| 10 | `cnxd-run-3-2` | run-3 | 2.md | ✅ | 0.90 | 0.5 ft / 6 in | medium | 98s |
| 11 | `rc3w-run-3-2` | run-3 | 2.md | timed out | — | — | — | — |
| 12 | `wz2k-run-1-2` | run-1 | 2.md | ✅ | 0.95 | 0 ft / 0.2 in | medium | 99s |

### By agent (run × checklist item)

| Agent | MD calls | Complete | Timed out | Notes |
|-------|----------|----------|-----------|-------|
| run-1/1.md | 0 | — | — | Never invoked MD (vertical clearance item) |
| run-1/2.md | 2 | 1 | 1 | 1 result: 0 ft 0.2 in |
| run-1/13.md | 2 | 0 | 2 | Both Gemini calls timed out |
| run-2/1.md | 0 | — | — | Never invoked MD |
| run-2/2.md | 2 | 2 | 0 | Both returned 0 ft |
| run-2/13.md | 2 | 1 | 0* | 1 result: 0 ft. *1 invocation visible in review.log but no call-dir — likely MCP/script boundary issue |
| run-3/1.md | 0 | — | — | Never invoked MD |
| run-3/2.md | 4 | 3 | 1 | Best-performing agent. Got 0.5 ft / 6 in (the only non-trivial measurement) |
| run-3/13.md | 1 | 0 | 0 | Gemini succeeded but compute-distance timed out (partial: has localization.json but no metadata) |

## Infrastructure metrics

### Drawing-block bbox (cropping)

**Run1:** `null` on all 8 calls. No cropping. Full-sheet JPEG sent to Gemini.

**Run2:** `{x0: 0, y0: 0, x1: 1, y1: 1}` on all 7 complete calls. Technically
"present" (the DB query now returns results thanks to the table-rename fix in
Bureau #226), but the bbox spans the entire page. The `content_block` table has
a `drawing` block for these sheets, but its coordinates are `(0,0)→(1,1)`.

**Implication:** no real cropping is happening yet. The JPEG sent to Gemini is
still the full sheet — title block, borders, notes, and all. True cropping
would narrow Gemini's search area. This is outstanding-issues.md #1.

### Legend context

**Run1:** `legendSource: none` on all 8. Empty `legend.txt`. Gemini had zero
symbol context.

**Run2:** `legendSource: cross-sheet` on all 7 complete calls. `legend.txt` is
~14,889 bytes per call — substantial cross-sheet symbol/abbreviation context
pulled from all sheets in the plan set.

**Implication:** this is a major improvement. Gemini now knows that `-OHE-` means
"overhead electric line", that `M` means "mitigation tree", etc. Whether this
improved localization accuracy vs run1 is hard to measure directly (the
nearestPoint-collapse bug masks the signal), but the Gemini confidence scores
are comparable (0.90–0.95 in both runs), suggesting the legend didn't degrade
anything and may be contributing to the descriptive quality of localizations.

### Scale values

**Run1:** mixed — `"0.05"` (4 calls), `"1"` (7 calls), `"1 inch = 20 feet"` (2 calls).
Only 4 of 14 had a correct numeric ratio. The rest caused argparse crashes or
produced nonsense measurements.

**Run2:** `"0.05"` on all 7 complete calls. 100% correct. The prompt fix in
Bureau #225 (added explicit numeric examples like `"For 1" = 20', pass 0.05"`)
is clearly working.

### Python compute-distance

**Run1:** 8/8 crashed at import (`str | None` PEP 604 syntax on Python 3.9).

**Run2:** 0/7 crashed. All 7 calls that reached compute-distance ran to
completion and produced a result. Bureau #221 (`from __future__ import annotations`)
is working.

## Measurement quality

### The 0.0-feet anomaly

6 of 7 complete calls returned `distanceFeet: 0` and `distanceInches: 0` (or
near-zero like 0.1 in, 0.2 in). Only one call (`cnxd-run-3-2`) returned a
plausible distance: 0.5 ft / 6 in.

**Root cause (same as identified in test-script replay):** Gemini's
`nearestPoint` values, when plotted in the viewer as `[x, y]`, appear outside
their respective bboxes. When toggling the viewer's "swap axes" control,
the dots land on the bbox edges — strongly suggesting Gemini returns them
in `[y, x]` order but the Python consumer treats them as `[x, y]`.

When both nearestPoints have their axes swapped but the Python code doesn't
account for this, the Euclidean distance is computed between coordinates that
don't correspond to the actual closest points on the objects → collapses to
near-zero because the wrong-axis values happen to be similar.

**This is the #1 blocker for useful measurements.** Fix options:
1. Swap axes in the Python consumer when `method == "vision"`
2. Ask Gemini to return coordinates in explicit `{x: N, y: N}` format
3. Use the viewer to visually confirm the correct interpretation, then hardcode

### Agent consumption of tool results

The agent in `run-3/2.md` incorporated tool measurements into its findings:

> **EL-2.1** [fail]: "Proposed trees at southern boundary are planted directly
> at the overhead electric line with zero clearance (**measured 0 feet 0
> inches**). Northern boundary trees are planted **0.5 feet** from the overhead
> electric line."

This is significant: it proves the full loop works
(Gemini → Python → tool result → agent finding). But the agent is citing
bogus 0-feet measurements as evidence for `fail` verdicts — making the tool
actively harmful until the nearestPoint bug is fixed.

## Timing analysis

Complete calls took 98–116 seconds each (median ~101s). Breakdown:
- Option A (Python vector stub): ~1s (always fails, as expected)
- Option B (Gemini call): ~25–40s
- Compute-distance (Python): ~2–5s
- Overhead (asset download, context queries, etc.): ~55–70s

The 4 timed-out calls produced only `cropped.jpg` + `legend.txt` + `prompt.txt`,
meaning they got past asset download and context collection but stalled at
the Gemini call. Given the Python subprocess timeout is 90s, these calls
likely hit the Gemini API latency ceiling (some Gemini calls take 60–200s
based on past observations). Outstanding-issues.md #9 recommends an
AbortController timeout on the Gemini side.

## Finding counts comparison

| Agent | Run1 findings | Run2 findings | Run1 fail% | Run2 fail% |
|-------|-------------:|-------------:|----------:|----------:|
| run-1/1.md | 32 | 22 | 13% | 23% |
| run-1/2.md | 8 | 6 | 25% | 50% |
| run-1/13.md | 39 | 20 | 13% | 15% |
| run-2/1.md | 19 | 12 | 16% | 25% |
| run-2/2.md | 5 | 6 | 100% | 100% |
| run-2/13.md | 23 | 30 | 0% | 10% |
| run-3/1.md | 17 | 18 | 24% | 33% |
| run-3/2.md | 6 | 11 | 17% | 45% |
| run-3/13.md | 9 | 19 | 33% | 16% |

Across 2.md agents: run2 `fail` rates are notably higher (25%→50%, 17%→45%),
likely because the agent is now citing 0-feet tool measurements as evidence
for failure — a false-precision effect from the measurement bug.

## Summary of findings

### What's working (verified by run2)

1. Python 3.9 compat — 0 import crashes
2. Scale values — 100% correct numeric ratio
3. Legend context — ~15 KB of cross-sheet symbol descriptions on every call
4. Drawing-block bbox field populated (DB queries working)
5. End-to-end pipeline completion (7 of 12 calls)
6. Agent consumption of tool output in findings
7. Agent adoption: 6/9 agents invoked MD (vs 5/9 in run1)

### What needs fixing

1. **nearestPoint axis swap** — #1 blocker. 6/7 results are 0 feet.
2. **Gemini timeouts** — 4/12 calls stalled. Need AbortController or longer subprocess cap.
3. **drawingBbox trivial** — {0,0,1,1} = full page. Need real drawing-block cropping.
4. **Item 1.md never invoked** — vertical clearance item; horizontal tool can't help.
5. **Agent cites bad measurements** — 0-feet results are surfacing as `fail` verdicts in findings, making the tool net-negative for quality on affected items.

### Recommended next steps

1. Fix the nearestPoint axis swap in `measure-distance-impl.py` (swap `[y,x]→[x,y]`
   when `method == "vision"`). Re-run the test-script fixture to verify.
2. Set a Gemini AbortController timeout (90s) in `measure-distance.ts` to avoid
   indefinite hangs.
3. Investigate why `drawingBbox` is `{0,0,1,1}` — is the `content_block` table
   storing trivial bboxes, or is the query falling back to a default?
4. Re-run the full experiment with the axis fix and compare `fail` rates to
   baseline (no-tool) to measure whether the tool improves or degrades finding quality.
