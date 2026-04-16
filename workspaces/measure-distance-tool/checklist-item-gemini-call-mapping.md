# Checklist Item → Gemini Call Mapping

Mapping of each experiment-run checklist-item agent to the Gemini-backed
tool calls it made (vision + measure-distance). Derived by parsing
`logs/review.log` (`type: assistant` → `tool_use` events) and correlating
tool_use_id → tool_result to get success/error kind. Measure-distance call
artifacts were matched to `measure-distance-calls/<callId>/` directories by
`(runIndex, checklistItem, nearest startedAt)`.

**Source:**
- `experiment-runs/logs/review.log` — per-agent tool_use events
- `experiment-runs/vision-log.jsonl` — vision tool sidecar log (31 events)
- `experiment-runs/measure-distance-calls/` — rich per-call artifact dirs (8)

**Scope:** `el-md-exp` review guide, 3 checklist items × 3 runs = 9 agents,
`--experiment=measure-distance` overlay enabled. Model: `claude-haiku-4-5-20251001`.

## Summary

| Run | Item | Vision calls | MD calls | MD mcp-errors | MD script-errors | MD with call-dir |
|-----|------|-------------:|---------:|-------------:|----------------:|-----------------:|
| run-1 | 1.md | 3 | 0 | 0 | 0 | 0 |
| run-1 | 2.md | 3 | 2 | 1 | 1 | 1 |
| run-1 | 13.md | 4 | 6 | 3 | 3 | 3 |
| run-2 | 1.md | 2 | 2 | 1 | 1 | 1 |
| run-2 | 2.md | 1 | 3 | 1 | 2 | 2 |
| run-2 | 13.md | 3 | 0 | 0 | 0 | 0 |
| run-3 | 1.md | 6 | 0 | 0 | 0 | 0 |
| run-3 | 2.md | 3 | 1 | 0 | 1 | 1 |
| run-3 | 13.md | 6 | 0 | 0 | 0 | 0 |
| **Total** | | **31** | **14** | **6** | **8** | **8** |

## Key findings

- **All 31 vision calls succeeded.** Count in review.log matches `vision-log.jsonl` line count exactly.
- **Zero measure-distance calls succeeded end-to-end.** The agent saw an error response for every one of the 14 invocations.
  - **6 of 14** were rejected at MCP input validation — the agent passed `sheetNum` / `scaleInchesPerFoot` as numbers but the tool schema expects strings. No call-dir is created for these.
  - **8 of 14** reached the script and created a call-dir under `measure-distance-calls/`. The Gemini-based localization step (Option B) succeeded for all 8 (geminiConfidence ≥ 0.9), but the downstream distance-computation step failed, producing a top-level `error` in metadata.json.
- **`run-3/1.md`, `run-3/13.md`, `run-2/13.md`, `run-1/1.md` never invoked measure-distance** — they stayed vision-only.

## Per-agent call detail

### run-1 / `1.md`

- Vision: 3 · Measure-distance: 0 (mcp-error: 0, script-error: 0, call-dirs: 0)

| # | Tool | Sheet | Status | Detail |
|---|------|------:|--------|--------|
| 1 | vision | 4 | ✓ success | prompt: _Review the existing conditions survey sheet carefully for any overhead electric utility poles, condu…_ |
| 2 | vision | 9 | ✓ success | prompt: _Review the proposed site plan (Sheet 9) carefully to identify:  1. **Overhead utility poles and line…_ |
| 3 | vision | 31 | ✓ success | prompt: _Examine the landscape plan carefully to identify:  1. **Overhead utility infrastructure**: Locate an…_ |

### run-1 / `2.md`

- Vision: 3 · Measure-distance: 2 (mcp-error: 1, script-error: 1, call-dirs: 1)

| # | Tool | Sheet | Status | Detail |
|---|------|------:|--------|--------|
| 1 | vision | 31 | ✓ success | prompt: _Examine the landscape plan drawing and identify: 1) All proposed trees shown on the plan, their loca…_ |
| 2 | vision | 31 | ✓ success | prompt: _Carefully examine any legends, symbols, or notes on the landscape plan that identify tree species. L…_ |
| 3 | measure-distance | 31 | ✗ MCP validation: sheetNum/scaleInchesPerFoot type | A: Mitigation trees (marked with 'M' symbol) in the b / B: Overhead electric line (marked as OHE) running alo |
| 4 | measure-distance | 31 | ✗ Script failed downstream | A: Mitigation trees (marked with 'M' symbol) in the b / B: Overhead electric line (marked as OHE) running alo · call-dir: `20260415T170447468Z-az9z-run-1-2` |
| 5 | vision | 31 | ✓ success | prompt: _Look at all the notes, text blocks, and reference callouts on Sheet 31 (Landscape Plan). Specificall…_ |

### run-1 / `13.md`

- Vision: 4 · Measure-distance: 6 (mcp-error: 3, script-error: 3, call-dirs: 3)

| # | Tool | Sheet | Status | Detail |
|---|------|------:|--------|--------|
| 1 | vision | 21 | ✓ success | prompt: _Examine the electrical plan and identify: 1) The exact location(s) of transformer pads on this site …_ |
| 2 | vision | 9 | ✓ success | prompt: _Examine the site plan and identify: 1) Are transformer pads marked or labeled on this site plan? 2) …_ |
| 3 | vision | 19 | ✓ success | prompt: _Examine the utility tap plan and identify: 1) Are transformer pads shown or labeled on this utility …_ |
| 4 | vision | 31 | ✓ success | prompt: _Examine the landscape plan and identify: 1) Where are transformer pads shown or located on this plan…_ |
| 5 | measure-distance | 21 | ✗ MCP validation: sheetNum/scaleInchesPerFoot type | A: transformer pad in northwest area near Bldg. 1 ent / B: Bldg. 1 western facade |
| 6 | measure-distance | 21 | ✗ MCP validation: sheetNum/scaleInchesPerFoot type | A: transformer pad in west central area near Bldg. 2 / B: Bldg. 2 western facade |
| 7 | measure-distance | 21 | ✗ MCP validation: sheetNum/scaleInchesPerFoot type | A: transformer pad in southwest area near Bldg. 8 / B: Bldg. 8 western facade |
| 8 | measure-distance | 21 | ✗ Script failed downstream | A: transformer pad in northwest area near Bldg. 1 ent / B: Bldg. 1 western facade · call-dir: `20260415T170606407Z-7z5h-run-1-13` |
| 9 | measure-distance | 21 | ✗ Script failed downstream | A: transformer pad in west central area near Bldg. 2  / B: Bldg. 2 western facade · call-dir: `20260415T170658401Z-32x0-run-1-13` |
| 10 | measure-distance | 21 | ✗ Script failed downstream | A: transformer pad in southwest area near Bldg. 8 / B: Bldg. 8 western facade · call-dir: `20260415T170815775Z-w0gh-run-1-13` |

### run-2 / `1.md`

- Vision: 2 · Measure-distance: 2 (mcp-error: 1, script-error: 1, call-dirs: 1)

| # | Tool | Sheet | Status | Detail |
|---|------|------:|--------|--------|
| 1 | vision | 4 | ✓ success | prompt: _Please examine this existing conditions survey sheet and identify all overhead utility infrastructur…_ |
| 2 | vision | 31 | ✓ success | prompt: _Please examine the landscape plan and address the following questions about overhead electric lines …_ |
| 3 | measure-distance | 31 | ✗ MCP validation: sheetNum/scaleInchesPerFoot type | A: overhead electric line crossing the site from west / B: proposed buildings (southern-most building, buildi |
| 4 | measure-distance | 31 | ✗ Script failed downstream | A: overhead electric line crossing the site from west / B: proposed southern building (Building 8) · call-dir: `20260415T170734222Z-wdkk-run-2-1` |

### run-2 / `2.md`

- Vision: 1 · Measure-distance: 3 (mcp-error: 1, script-error: 2, call-dirs: 2)

| # | Tool | Sheet | Status | Detail |
|---|------|------:|--------|--------|
| 1 | vision | 31 | ✓ success | prompt: _I need to understand the tree planting plan and its relationship to overhead electric infrastructure…_ |
| 2 | measure-distance | 31 | ✗ MCP validation: sheetNum/scaleInchesPerFoot type | A: trees in the southern landscape buffer area near t / B: the OHE (Overhead Electric) utility line and condu |
| 3 | measure-distance | 31 | ✗ Script failed downstream | A: trees in the southern landscape buffer area near t / B: the OHE (Overhead Electric) utility line and condu · call-dir: `20260415T170336704Z-qebm-run-2-2` |
| 4 | measure-distance | 31 | ✗ Script failed downstream | A: street yard trees (SY/M designation) in the left b / B: the overhead electric line with utility poles alon · call-dir: `20260415T170411717Z-0rhd-run-2-2` |

### run-2 / `13.md`

- Vision: 3 · Measure-distance: 0 (mcp-error: 0, script-error: 0, call-dirs: 0)

| # | Tool | Sheet | Status | Detail |
|---|------|------:|--------|--------|
| 1 | vision | 21 | ✓ success | prompt: _This is an electrical design plan for a development project. Please identify and describe all transf…_ |
| 2 | vision | 21 | ✓ success | prompt: _Examine the Preliminary Electrical Design Plan for utility separations and clearances. Please focus …_ |
| 3 | vision | 9 | ✓ success | prompt: _This is the main site plan for the Valley View Townhomes development. Please identify:  1. **Transfo…_ |

### run-3 / `1.md`

- Vision: 6 · Measure-distance: 0 (mcp-error: 0, script-error: 0, call-dirs: 0)

| # | Tool | Sheet | Status | Detail |
|---|------|------:|--------|--------|
| 1 | vision | 4 | ✓ success | prompt: _Please examine Sheet 4 (Existing Conditions Survey) and identify: 1. Are there any existing utility …_ |
| 2 | vision | 9 | ✓ success | prompt: _Please examine Sheet 9 (Site Plan) and describe: 1. Are the existing utility poles and overhead util…_ |
| 3 | vision | 3 | ✓ success | prompt: _Please examine Sheet 3 (General Notes) and specifically identify: 1. Are there any notes or requirem…_ |
| 4 | vision | 9 | ✓ success | prompt: _Looking at Sheet 9 Site Plan, I need to verify the proposed building locations and site features rel…_ |
| 5 | vision | 9 | ✓ success | prompt: _Please examine Sheet 9 and identify:  1. **Fences**: Where are wood fences and other fencing shown? …_ |
| 6 | vision | 31 | ✓ success | prompt: _Please examine Sheet 31 (Landscape Plan) and identify:  1. Are there any trees (deciduous or evergre…_ |

### run-3 / `2.md`

- Vision: 3 · Measure-distance: 1 (mcp-error: 0, script-error: 1, call-dirs: 1)

| # | Tool | Sheet | Status | Detail |
|---|------|------:|--------|--------|
| 1 | vision | 31 | ✓ success | prompt: _Examine the overhead electric (OHE) utility lines shown on this landscape plan. Where are they locat…_ |
| 2 | vision | 3 | ✓ success | prompt: _Examine the electric utility notes and transmission line requirements shown on this sheet. Look for:…_ |
| 3 | vision | 31 | ✓ success | prompt: _Look at the southern boundary of the site plan where the overhead electric (OHE) line is located. Id…_ |
| 4 | measure-distance | 31 | ✗ Script failed downstream | A: Individual tree symbol (single center cross with + / B: Overhead Electric (OHE) line marked with '-OHE-' t · call-dir: `20260415T170908529Z-mmf4-run-3-2` |

### run-3 / `13.md`

- Vision: 6 · Measure-distance: 0 (mcp-error: 0, script-error: 0, call-dirs: 0)

| # | Tool | Sheet | Status | Detail |
|---|------|------:|--------|--------|
| 1 | vision | 21 | ✓ success | prompt: _This is the Preliminary Electrical Design Plan for a townhome project. I need to identify and analyz…_ |
| 2 | vision | 9 | ✓ success | prompt: _This is the main Site Plan for Valley View Townhomes. I need to identify transformer pads and assess…_ |
| 3 | vision | 31 | ✓ success | prompt: _This is the Landscape Plan for Valley View Townhomes. I need to identify trees, vegetation, and land…_ |
| 4 | vision | 32 | ✓ success | prompt: _This is the Tree List for Valley View Townhomes. I need to extract the tree survey table data to ide…_ |
| 5 | vision | 11 | ✓ success | prompt: _This is the Grading Plan for Valley View Townhomes. I need to assess drainage patterns around the th…_ |
| 6 | vision | 2 | ✓ success | prompt: _This is the Plat for Valley View Townhomes. I need to assess the property boundaries and easements i…_ |

## Appendix: measure-distance call-dir → agent mapping

The 8 call-dirs under `measure-distance-calls/` map to agents as follows:

| Call-dir | Run | Item | Option-B (Gemini) success | Agent-visible result |
|----------|-----|------|:------------------------:|----------------------|
| `20260415T170336704Z-qebm-run-2-2` | run-2 | 2.md | yes | Script failed downstream |
| `20260415T170411717Z-0rhd-run-2-2` | run-2 | 2.md | yes | Script failed downstream |
| `20260415T170447468Z-az9z-run-1-2` | run-1 | 2.md | yes | Script failed downstream |
| `20260415T170606407Z-7z5h-run-1-13` | run-1 | 13.md | yes | Script failed downstream |
| `20260415T170658401Z-32x0-run-1-13` | run-1 | 13.md | yes | Script failed downstream |
| `20260415T170734222Z-wdkk-run-2-1` | run-2 | 1.md | yes | Script failed downstream |
| `20260415T170815775Z-w0gh-run-1-13` | run-1 | 13.md | yes | Script failed downstream |
| `20260415T170908529Z-mmf4-run-3-2` | run-3 | 2.md | yes | Script failed downstream |

## Methodology notes

- `review.log` Pino events with `type: assistant` and `message.content[].type: tool_use`
  provide authoritative per-agent tool-call attribution. Each event carries `runIndex`,
  `item`, and `checklistItem` set by the parallel-execution harness, so concurrency does
  not blur attribution.
- `vision-log.jsonl` is a sidecar log with no agent-id field — it is counted here only
  for cross-checking the 31-call total against review.log.
- Call-dir matching uses `(runIndex, checklistItem, nearest tool_use → startedAt)`. No
  tool_use_id is stored in metadata.json, so matching is heuristic but unambiguous
  given the time window (agents are tagged; collisions only possible inside the same
  agent, where order-by-time within agent is the tie-break).