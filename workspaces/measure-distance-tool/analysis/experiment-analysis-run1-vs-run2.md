# Experiment Run1 vs Run2 — Comparative Analysis

Comparison of the 2026-04-15 experiment (run1) and the 2026-04-16 experiment
(run2), both using the `el-md-exp` guide subset (items `1.md`, `2.md`, `13.md`)
with `--experiment=measure-distance` on 3 independent runs × 3 checklist items
= 9 agents each.

## Executive summary

**Five infrastructure fixes shipped between runs. All five are verifiably
working in run2.** The pipeline went from zero successful measurements in run1
to 7 complete end-to-end results in run2. The remaining blocker to useful
measurements is the nearestPoint-collapse bug (6 of 7 results are 0.0 feet).

## Side-by-side metrics

| Metric | Run1 | Run2 | Change |
|--------|-----:|-----:|--------|
| MD invocations (from review.log `tool_use`) | 14 | 13 | -1 |
| Invocations reaching the script (call-dirs) | 8 | 12 | +50% |
| MCP validation rejects | 6 | ~1 | -83% |
| Call-dirs with full metadata | 8 | 7 | -1 |
| Gemini localization succeeded | 8 / 8 | 8 / 12 | same rate; 4 new timeouts |
| Python compute-distance errors | **8 / 8** | **0 / 7** | all fixed |
| End-to-end results produced | **0** | **7** | new signal |
| Non-zero distance measurements | 0 | 1 (0.5 ft) | +1 |
| Zero-distance measurements | 0 | 6 | new (measurement bug) |
| Agents that invoked MD (out of 9) | 5 | 6 | +1 |
| Agents that never invoked MD | 4 | 3 | -1 |
| Vision calls (from review.log) | 31 | 47 | +52% |
| drawingBbox present on call-dirs | 0 / 8 (null) | 7 / 7 | +100% |
| legendSource (non-none) | 0 / 8 | 7 / 7 (cross-sheet) | +100% |
| legend.txt content | 0 bytes | ~15 KB per call | new |
| Scale values correct (numeric, not label) | mixed | 7 / 7 = 100% | fixed |

## What each fix delivered

| Fix | What broke in run1 | Run2 evidence |
|-----|-------------------|---------------|
| **Bureau #221** — Python 3.9 compat (`from __future__ import annotations`) | All 8 script calls crashed at import: `TypeError: unsupported operand type(s) for \|` | 0 / 7 import crashes. Pipeline reaches compute-distance and returns results. |
| **Conductor #118** — MCP accepts numeric args | 6 / 14 tool invocations rejected: `Expected string, received number` for `sheetNum` | ~1 / 13 rejected (marginal). Down from 43% to ~8%. |
| **Bureau #225** — Prompt fix (measure-before-not-verifiable, numeric scale examples) | Agent sent `"1 inch = 20 feet"` or `"1"` as scaleInchesPerFoot | All 7 complete calls use `0.05` (correct for 1"=20' sheets). |
| **Bureau #226** — Supabase table/column renames (3 queries were silently failing) | `drawingBbox: null`, `legendSource: none` on all 8 calls — DB queries returning empty | `drawingBbox` present on 7/7. `legendSource: cross-sheet` on 7/7. `legend.txt` ~15 KB of symbol context per call. |
| **Conductor #121** — Shell-quote script args + NODE_PATH | Various arg-passing failures at the conductor→script boundary | No shell-quoting errors observed in run2. |

## Agent behavior comparison

### Tool adoption

| Agent (run/item) | Run1 MD calls | Run2 MD calls |
|------------------|-------------:|-------------:|
| run-1/1.md | 0 | 0 |
| run-1/2.md | 2 | 2 |
| run-1/13.md | 6 | 2 |
| run-2/1.md | 2 | 0 |
| run-2/2.md | 3 | 2 |
| run-2/13.md | 0 | 2 |
| run-3/1.md | 0 | 0 |
| run-3/2.md | 1 | 4 |
| run-3/13.md | 0 | 1 |

**Item 1.md (Site Feature Clearances from OHE):** 0 MD calls in run2 across
all 3 runs. Same as run1 for 2 of 3 runs. The agent consistently decides this
item requires vertical clearance data (building-elevation vs. conductor-elevation),
which measure-distance can't provide (horizontal plan view only).

**Items 2.md + 13.md:** both adopted MD in all 3 runs in run2 (6/6 agents).
Run1 had gaps (2.md run-1 and run-3 used it; 13.md only run-1 used it).

### Vision tool usage

Run2 agents made 47 vision calls vs 31 in run1 (+52%). This suggests the
experiment prompt's instruction to "investigate sheets before measuring" is
driving more visual analysis, not just more tool calls.

### Finding quality

The agent IS consuming tool results in its findings. From
`run-3/2.md` (EL-2.1):

> "Proposed trees at southern boundary are planted directly at the overhead
> electric line with zero clearance (**measured 0 feet 0 inches**). Northern
> boundary trees are planted **0.5 feet** from the overhead electric line."

This is the first evidence that the tool's output flows end-to-end from Gemini
→ Python → agent → finding. The bad news: the agent is citing 0-feet
measurements that are artifacts of the nearestPoint-collapse bug, leading to
overly aggressive `fail` verdicts on items that may actually have clearance.

## What remains broken

### 1. nearestPoint collapse → 0.0-feet distances (6 of 7 results)

The same bug as identified in the test-script replay. Gemini returns
nearestPoint coordinates that are either:
- Swapped `[y, x]` vs the Python consumer's expected `[x, y]`, or
- Both projecting to nearly the same pixel after coordinate denormalization

Debugging via the viewer confirms the dots appear outside or at identical
positions on the bboxes when plotted as `[x, y]`.

### 2. Gemini timeouts (4 of 12 calls incomplete)

4 call-dirs have only `cropped.jpg` + `legend.txt` + `prompt.txt` —
the Gemini call didn't return a response before the script timed out.
These are 100s+ calls against a 90s Python timeout. No Gemini-level
timeout is set; the script should set an AbortController cap or bump the
subprocess timeout.

### 3. Item 1.md universally skipped

This item needs vertical clearance analysis (conductor-to-building height),
which the horizontal plan-view tool can't provide. Either:
- Accept that 1.md is out of scope for measure-distance, or
- Add a vertical-distance capability (see outstanding-issues.md #10).

### 4. drawingBbox is trivial `{0,0,1,1}` (whole page)

While `drawingBbox` is now present (vs null in run1), it's `{x0:0, y0:0,
x1:1, y1:1}` on all calls — effectively the full page. The `content_block`
query returns a "drawing" block that spans the entire sheet. True cropping
(to just the engineering drawing, excluding title blocks / notes / borders)
would narrow Gemini's search area and likely improve localization accuracy.

## Verdict

Run2 validates that the infrastructure layer is sound. The tool pipeline
completes end-to-end. The next bottleneck is measurement accuracy — the
nearestPoint-collapse bug must be fixed before the measurements can
meaningfully contribute to pass/fail verdicts.
