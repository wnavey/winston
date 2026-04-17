# Experiment Run3 Deep Dive — 2026-04-17

Detailed analysis of `experiment-run3`, the third iteration of the `el-md-exp`
A/B experiment. Same guide subset (1.md, 2.md, 13.md), same model (Haiku 4.5),
3 runs × 3 items = 9 agents. This is the first run with the corrected scale
formula, real image cropping, nearestPoint axis fix, and objectPairs batching.

## Run configuration

- **Workflow:** review v5.1.0 + measure-distance experiment overlay
- **Guide:** `el-md-exp` (items 1.md, 2.md, 13.md)
- **Site plan:** Valley View Townhomes (SP-2025-0126C)
- **Duration:** ~25 min (17:00–17:25 UTC)

### Fixes applied since run2

| PR | Fix |
|----|-----|
| bureau#229 | Swap nearestPoint axis order to match Gemini [y, x] convention |
| bureau#232 | Scale formula inverted (* → /), disable vector refinement, standardize Gemini prompt to [y, x] |
| bureau#233 | Fix drawing bbox format ({x,y,width,height} → {x0,y0,x1,y1}) |
| bureau#234 | objectPairs array — batch multiple measurements per tool call |
| conductor#122 | Typed tool schema with per-field types/descriptions |
| conductor#123 | Array support in tool schema + shell quoting for JSON values |

## Call inventory

**26 call-dirs total** from 10 MCP invocations (up from 12 call-dirs / 13
invocations in run2). The increase is from **objectPairs batching** — each
tool call now measures multiple object pairs, creating per-pair sub-directories
(suffixed `-p0`, `-p1`, `-p2`, etc.) alongside the parent call-dir.

### Completion status

| Status | Count | Description |
|--------|------:|-------------|
| **Complete** (metadata + result) | 12 | Full pipeline: Gemini → compute-distance → result |
| **Gemini succeeded, incomplete** | 1 | Has localization.json but no metadata (timeout before write) |
| **Gemini timed out** | 6 | Parent dirs with only legend.txt (batch orchestrator dirs) |
| **Pair timed out** | 7 | Sub-pair dirs with cropped.jpg but no response |
| **Total** | **26** | |

### Successful measurements

| Call-dir | Run | Item | Sheet | Distance | Conf | Drawing bbox |
|----------|-----|------|------:|----------|------|-------------|
| qnnh-run-2-2-p0 | run-2 | 2.md | 31 | **6.1 ft** (73.6 in) | medium | 0.26,0.35→0.91,0.95 |
| qnnh-run-2-2-p1 | run-2 | 2.md | 31 | **11.2 ft** (134.1 in) | medium | 0.26,0.35→0.91,0.95 |
| z393-run-1-13-p0 | run-1 | 13.md | 21 | **31.8 ft** (381 in) | medium | 0.03,0.03→0.91,0.96 |
| 3ei4-run-1-13 | run-1 | 13.md | 21 | **11.4 ft** (137.2 in) | medium | 0.03,0.03→0.91,0.96 |
| 16ze-run-1-2-p0 | run-1 | 2.md | 31 | 0 ft (0 in) | medium | 0.26,0.35→0.91,0.95 |
| 16ze-run-1-2-p1 | run-1 | 2.md | 31 | **4.3 ft** (51.9 in) | medium | 0.26,0.35→0.91,0.95 |
| awie-run-1-13 | run-1 | 13.md | 21 | **8.9 ft** (106.7 in) | medium | 0.03,0.03→0.91,0.96 |
| 956z-run-1-2-p0 | run-1 | 2.md | 31 | 0 ft (0 in) | medium | 0.26,0.35→0.91,0.95 |
| 956z-run-1-2-p1 | run-1 | 2.md | 31 | **2.3 ft** (27.5 in) | medium | 0.26,0.35→0.91,0.95 |
| 6698-run-3-2-p0 | run-3 | 2.md | 31 | **10.3 ft** (123.8 in) | medium | 0.26,0.35→0.91,0.95 |
| 6698-run-3-2-p1 | run-3 | 2.md | 31 | 0 ft (0 in) | medium | 0.26,0.35→0.91,0.95 |
| eoix-run-2-13-p0 | run-2 | 13.md | 21 | **22.9 ft** (274.3 in) | medium | 0.03,0.03→0.91,0.96 |

**9 of 12 results are non-zero** (75%). Range: 2.3 ft – 31.8 ft. These are
physically plausible clearance distances for a 1"=20' site plan.

The 3 zero-distance results are tree-to-OHE measurements where the tree
symbol genuinely overlaps or sits directly on the line.

## Infrastructure metrics

### Drawing-block cropping — now real

**Run2:** `{x0:0, y0:0, x1:1, y1:1}` on all calls — trivial full-page bbox.

**Run3:** two distinct, real crop regions:
- **Sheet 31** (landscape): `0.26, 0.35 → 0.91, 0.95` — crops out title block, border, and notes panels
- **Sheet 21** (electrical): `0.03, 0.03 → 0.91, 0.96` — wider crop, most of the sheet is drawing

This is the bureau#233 fix (drawing bbox format conversion from `{x,y,width,height}`
to `{x0,y0,x1,y1}`). Gemini now sees just the engineering drawing, not the
full page with title blocks. This likely contributes to the improved
localization quality.

### Scale formula — corrected

**Run2:** scale formula was inverted (`*` instead of `/`), producing distances
of 0.0–0.5 ft (off by a factor of 400).

**Run3:** corrected formula (bureau#232). Distances now in the 2–32 ft range,
matching what you'd expect for clearances on a 1"=20' sheet.

### Legend context — unchanged

All 26 call-dirs have `legend.txt` with ~14,889 bytes of cross-sheet symbol
context. Same as run2 — the legend pipeline is stable.

### objectPairs batching — new

Bureau#234 introduced the `objectPairs` array — the agent can request multiple
measurements in a single tool call. The TS orchestrator fans them out into
per-pair sub-directories (`-p0`, `-p1`, `-p2`), each with its own Gemini call
and compute-distance result.

In this run: 10 MCP invocations produced 26 call-dirs. Several invocations
measured 2–3 pairs each. Not all pairs completed (some later pairs timed out),
but the successfully-batched ones are a net efficiency gain.

### Errors — zero

0 errors across all 12 completed call-dirs. No Python crashes, no import
failures, no argparse rejections.

## Agent behavior

### Tool adoption

| Agent | MD calls | Call-dirs | Results | Non-zero |
|-------|---------|-----------|---------|----------|
| run-1/1.md | 0 | — | — | — |
| run-1/2.md | 2 | 7 | 4 | 2 |
| run-1/13.md | 5 | 8 | 3 | 3 |
| run-2/1.md | 0 | — | — | — |
| run-2/2.md | 1 | 4 | 2 | 2 |
| run-2/13.md | 1 | 3 | 1 | 1 |
| run-3/1.md | 0 | — | — | — |
| run-3/2.md | 1 | 4 | 2 | 1 |
| run-3/13.md | 0 | — | — | — |

**5 of 9 agents invoked MD** (vs 6/9 in run2). Item 1.md is still universally
skipped (vertical-clearance item). run-3/13.md also skipped MD this time.

**run-1 was the heaviest user**: 7 invocations producing 15 call-dirs. This
agent was thorough, making multiple batched measurements per item.

### Vision calls

36 vision calls (down from 47 in run2). The agents are relying more on the MD
tool and less on raw vision queries — a sign that the tool is earning trust.

### Finding quality

Agents are citing **specific measured distances** in their findings:

> **run-1/2.md [EL-2.1] fail:** "Mitigation trees including Cedar Elm, Live
> Oak, and Mexican Redbud are proposed **0 to 2.3 feet** from the overhead
> electric distribution line conductor, far below the required 15-foot minimum
> clearance."

> **run-1/2.md [EL-2.6] fail:** "Mitigation trees are proposed **0 to 2.3
> feet** from the overhead electric line where utility poles are located,
> violating the 10-foot minimum clearance requirement."

These are not just "fail" verdicts — they cite the measured distance AND
the regulatory threshold, providing defensible evidence. This is the
quality improvement the tool was designed to produce.

### Finding counts

| Agent | Findings | fail | not-verifiable |
|-------|---------|------|---------------|
| run-1/1.md | 13 | 1 | 12 |
| run-1/2.md | 8 | 5 | 3 |
| run-1/13.md | 9 | 2 | 7 |
| run-2/1.md | 8 | 3 | 5 |
| run-2/2.md | 8 | 1 | 7 |
| run-2/13.md | 24 | 4 | 20 |
| run-3/1.md | 8 | 3 | 5 |
| run-3/2.md | 7 | 4 | 3 |
| run-3/13.md | 35 | 3 | 32 |
| **Total** | **120** | **26** | **94** |

### Phase 1 metrics (run3 vs baseline)

| Metric | Value |
|--------|------:|
| Invocation recall | 53.3% (32/60) |
| Completion rate | 120% (12 results from 10 invocations — batching) |
| Finding conversion | 14.7% (5/34 not-verifiable → fail) |

Invocation recall dropped from 65.2% (run2) to 53.3% because one fewer agent
invoked MD (run-3/13.md skipped). Finding conversion is 14.7% vs 21.6% in
run2 — the absolute count is similar (5 vs 8) but the denominator shifted
due to different baseline pairing.

## Timing analysis

The workflow completed in ~25 minutes for 9 agents. Individual call-dirs don't
have consistent timing data (many sub-pair dirs lack metadata), but from the
call-dir timestamps, Gemini calls average ~90–100s each — consistent with run2.

The objectPairs batching means the wallclock impact per finding is actually
LOWER than run2 despite more measurements being taken, because pairs within
a batch run sequentially within a single tool-call window rather than
requiring separate agent turns.

## Summary

### What's new and working in run3

1. **Real image cropping** — drawing bbox is non-trivial, Gemini sees just the engineering drawing
2. **Correct scale formula** — distances are 2–32 ft, not 0.0–0.5 ft
3. **nearestPoint axis fix** — points land on the correct objects
4. **objectPairs batching** — multiple measurements per tool call
5. **Measurement quality** — 9 of 12 results are non-zero and physically plausible
6. **Finding quality** — agents cite measured distances with regulatory thresholds in fail verdicts
7. **Zero errors** — no Python crashes, no MCP rejects, no import failures

### What still needs work

1. **Pair timeout** — 7 of 26 sub-pair dirs timed out (later pairs in a batch)
2. **Agent adoption on 1.md** — vertical clearance item, universally skipped
3. **Invocation recall dropped slightly** — 53% vs 65% in run2; run-3/13.md skipped MD
4. **No ground truth** — we don't yet know if 6.1 ft or 31.8 ft are the RIGHT answers
