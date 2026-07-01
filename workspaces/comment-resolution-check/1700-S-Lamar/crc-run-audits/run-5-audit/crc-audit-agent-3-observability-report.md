# CRC Audit — Agent 3 — Tool Usage & Observability

- **reviewId**: `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e`
- **submissionVersionId**: `6b9b85ed-e992-4906-a222-b24ee836910c`
- **Config**: 5 runs × 17 groupings, 291 checklist items → 1,455 item-runs
- **RUN_DIR**: `/Users/wnavey/noetic/crc-audits/d1ff47e7-7c77-4a54-9d1c-4d6bae26046e/_run_artifacts`
- **INCLUDE_INCOMPATIBLE_HISTORY**: `no` (all `historical_reviews_counted=0`)

## 1. Headline tool-usage numbers (current run only)

Counts are over the 1,455 item-runs (291 items × 5 runs), as attributed in `consolidated-findings.json → perRunFindings[].tools_used[]`.

| bucket | item-runs | % of 1,455 |
|---|---|---|
| used vision (any) | 997 | 68.5% |
| used semantic-search (any) | 493 | 33.9% |
| used BOTH vision & semantic-search | 269 | 18.5% |
| used vision ONLY | 728 | 50.0% |
| used semantic-search ONLY | 224 | 15.4% |
| used NEITHER vision nor semantic-search | 234 | 16.1% |
|   … of which used `Read` only | 58 | 4.0% |
|   … of which had no tool attribution at all | 176 | 12.1% |

Raw tool-attribution histogram across all `perRunFindings`:

| tool | occurrences |
|---|---|
| `crc-vision-check` (short) | 801 |
| `mcp__conductor_tools__crc_vision_check` (long) | 196 |
| `semantic-search-blocks` (short) | 337 |
| `mcp__conductor_tools__run_semantic_search_blocks` (long) | 116 |
| `run_semantic_search_blocks` (bare) | 40 |
| `Read` | 147 |

Both the short (`crc-vision-check`) and long (`mcp__conductor_tools__crc_vision_check`) forms of the same tool appear in `tools_used[]`. The pipeline's "Applied tool attribution" step is normalizing inconsistently — some findings get the pretty name, others get the raw MCP tool ID, and semantic-search shows up under three names. Downstream analytics must canonicalize before aggregating. The current TSVs collapse them into two canonical labels.

Vision was actually called only **538 times** in the sidecar log; the 997 item-runs figure is inflated because a single vision call is often attributed to multiple checklist items (a call to `crc_vision_check` for sheet 18 with `checklistItemIds=["PB-1","PB-2"]` gets counted in `tools_used` for both items). Distribution of `checklistItemIds.length` per vision call: 136 single-item, 101 two-item, 92 three-item, and 76 calls covered 6+ items (max = 13).

Per-department invocation totals (from running-tally TSV):

| dept | items | vision calls | semantic calls |
|---|---|---|---|
| crc-SP | 63 | 213 | 96 |
| crc-CA | 42 | 132 | 107 |
| crc-TPW | 37 | 165 | 39 |
| crc-DE | 39 | 112 | 28 |
| crc-EV | 29 | 77 | 59 |
| crc-WQ | 20 | 48 | 23 |
| crc-F | 11 | 51 | 24 |
| crc-AWRR | 10 | 40 | 27 |
| crc-aw-redlines | 10 | 49 | 10 |
| crc-CM | 7 | 24 | 12 |
| crc-PR | 6 | 28 | 20 |
| crc-AW | 5 | 25 | 4 |
| crc-OWB | 5 | 3 | 25 |
| crc-IW | 3 | 15 | 5 |
| crc-PB | 2 | 10 | 5 |
| crc-LDE | 1 | 5 | 4 |
| crc-RW | 1 | 0 | 5 |

Outliers worth flagging: **crc-OWB** did almost no vision (3 calls vs 25 semantic) — probably fine because OWB (Onsite Water/Benchmarking) is text-heavy. **crc-RW** used ZERO vision across its 5 runs of 1 item. **crc-SP** dominates raw call volume (213+96 = 309 tool calls across 63 items).

## 2. Vision tool observability — where prompts and responses live

`RUN_DIR/output/vision-log.jsonl` (1.1 MB, 538 records). Every record has the same shape (verified via `jq -c 'keys' | sort -u`):

```
["checklistItemIds","documentId","elapsedMs","event","model","paths","referenceImagesCount","referenceImagesSkipped","responseText","sheetNum","success","timestamp","usage"]
```

Every record is `event: "crc-vision:result"`. `crc-vision:error` events referenced in the task brief are **not present** in this run — either no vision service errors occurred at the tool-execution layer, or errors aren't being written (there is 1 vision call rejected at MCP-input-validation that never made it to the sidecar; see §4).

**What IS logged in the sidecar**:
- `checklistItemIds`: array of atomic checklist IDs this call was made for. **Every one of 538 records has this populated** — this is the ONE place in the whole run where tool calls are tied to atomic checklist IDs. Excellent.
- `responseText`: the full model response text. **This is load-bearing** because the vision model's response text is what the agent uses to reach pass/fail on the checklist item — losing this would mean losing the primary evidence for the ruling.
- `documentId` + `sheetNum` + `paths[]` (reference images used).
- `usage`: input/output/reasoning tokens.
- `model`: all 538 calls used `google/gemini-3.1-pro-preview`.
- `referenceImagesCount` / `referenceImagesSkipped`: 62 calls used reference images, 476 did not.

**What is NOT logged in the sidecar**:
- **The rendered prompt is not in the sidecar.** The full text of `input.prompt` (which was ~1,200 characters for the sample PB-1/PB-2 call) is captured in the **main pino log** as the `tool_use` payload (`message.content[].type=="tool_use", input.prompt`), but nowhere in `vision-log.jsonl`. Anyone auditing "why did the agent claim X" has to grep 121 MB of pino JSON to recover the exact question that was asked. This is the top observability gap.
- **No `:start` event.** Semantic-search paired `:start`/`:result` — vision is one-record-per-call. That's fine except it means the sidecar has no record of a call that never reached the vision service (see §4).
- **No error records.** The task brief anticipates a `crc-vision:error` event type; zero appear in this run's sidecar. A vision MCP validation failure did occur (§4) and is invisible in the sidecar.
- **No `parent_tool_use_id` / no run index / no grouping-file name.** You can figure out "which agent session made this call" only by correlating timestamps to the main log.

## 3. Semantic-search observability

`RUN_DIR/output/semantic-search-blocks-log.jsonl` (154 KB, 920 records = 460 `:start` + 460 `:result`).

**`:start` records** capture:
```
["event","maxResults","projectId","query","timestamp"]
```
Query text is logged in full. 460 unique queries. `maxResults` distribution: 219×10, 128×15, 74×20, 20×5, 15×8, 4×30.

**`:result` records** capture:
```
["elapsed_ms","event","mode","resultCount","timestamp"]
```
`resultCount` distribution: 213×10, 128×15, 74×20, 20×5, 15×8, 4×30, plus 26 calls that returned <maxResults. `mode` was always `"hybrid"`. Elapsed times available.

**What's missing on the semantic side**:
1. **The `:result` record has no correlation ID** back to its `:start`. Pairing is done by ordinal position within the file (or by matching timestamps within a short window). The main log's tool_use_id would make this trivial — that ID is not propagated.
2. **The `:result` record has NO returned block IDs, sheet numbers, or content.** Result records are 90 bytes and tell you only "we returned N blocks in T ms." What blocks? Not here. To recover them, you must go to the main pino log's `tool_result` content, which contains the full JSON payload — but for large payloads (~60 KB+) the CLI persists them to disk and only stores a preview stub (see the crc-PR.md sample below). Full blocks may not exist on disk after the sandbox exits.
3. **No `checklistItemId` attribution at all.** Vision has `checklistItemIds`. Semantic-search does not, in either the sidecar or the main-log tool_use input. Correlation to a specific atomic check requires timestamp-window matching against agent activity by department — imprecise.

### Sample query → result pairs (20 across departments)

| grouping | run | query | maxResults | resultCount | top-3 results (sheet, category, relevance, blockId prefix) |
|---|---|---|---|---|---|
| crc-AW.md | run-2 | land status determination letter report Wendlandt subdivision lot 3 | 20 | 20 | s3 (drawing, r=0.566, 6c114da4…); s3 (notes, r=0.512, 78be2938…); s2 (form, r=0.462, 3909c21d…) |
| crc-AWRR.md | run-1 | OWRS cistern potable back-up make-up water line RPZ backflow | 20 | 20 | s6 (form, r=0.575, a1b2f988…); s7 (table, r=0.496, b05b7484…); s7 (table, r=0.494, bd50a576…) |
| crc-CA-1.md | run-1 | Heritage Tree 5001 buildability exhibit transplant feasibility fiscal surety | 20 | 20 | s46 (legend, r=0.493, 500c9266…); s8 (table, r=0.477, dbaf0e6c…); s9 (table, r=0.468, fd32450d…) |
| crc-CA-2.md | run-1 | Critical Root Zone CRZ Half CRZ Quarter CRZ cut fill depth natural grade preservation | 15 | 15 | s45 (diagram, r=0.505, 37d3dbcc…); s54 (diagram, r=0.5, c73e11bc…); s44 (notes, r=0.484, 87822cee…) |
| crc-CA-3.md | run-1 | ECM 3.6.2 modified tree and natural area protection standard plan note | 10 | 10 | s45 (diagram, r=0.576, 43b06a57…); s45 (diagram, r=0.565, 37d3dbcc…); s45 (notes, r=0.561, 0f3e9807…) |
| crc-CM.md | run-1 | license agreement right-of-way Land Management vertical improvements streetscape | 15 | 15 | s14 (legend, r=0.519, be46e34a…); s44 (notes, r=0.508, 60b0c069…); s13 (legend, r=0.504, b7a769f9…) |
| crc-DE-1.md | run-1 | hydraulic grade line HGL storm drain profile | 20 | 20 | s27 (diagram, r=0.615, 5c4584c1…); s27 (diagram, r=0.613, a4e5a1c4…); s28 (diagram, r=0.6, ae58a1fb…) |
| crc-DE-2.md | run-1 | horizontal clearance storm drain utility DCM 5.7.0 separation distance | 10 | 10 | s28 (drawing, r=0.579, b9e29eec…); s28 (diagram, r=0.552, c99f926b…); s36 (diagram, r=0.547, 9ee58146…) |
| crc-EV-1.md | run-1 | concrete washout detail BMP erosion control | 10 | 10 | s31 (diagram, r=0.536, a3c30065…); s11 (notes, r=0.507, eb36189e…); s29 (drawing, r=0.506, ec701d29…) |
| crc-EV-2.md | run-1 | planting schedule shrubs ground covers grasses species container size quantities | 20 | 20 | s54 (diagram, r=0.619, d06d6348…); s54 (notes, r=0.562, b120d5c5…); s44 (notes, r=0.515, 60b0c069…) |
| crc-F.md | run-1 | fire lane turnaround dimension width clearance | 20 | 20 | s33 (diagram, r=0.523, b54df80e…); s33 (diagram, r=0.481, 31f614f7…); s32 (notes, r=0.469, beeb1829…) |
| crc-IW.md | run-1 | large diameter wastewater cleanout 506-AW-04 standard detail | 20 | 20 | s35 (diagram, r=0.66, 4ad0ed7d…); s35 (diagram, r=0.642, 31a4d43d…); s35 (diagram, r=0.642, 7d39adf1…) |
| crc-LDE.md | run-1 | 10 ft curb inlet Collier Street driveway radius minimum clearance | 20 | 20 | s36 (diagram, r=0.528, 54ac7667…); s32 (notes, r=0.52, beeb1829…); s36 (diagram, r=0.495, a75c3b55…) |
| crc-OWB.md | run-1 | benchmarking application water use GFA gross floor area irrigated area | 20 | 20 | s6 (form, r=0.51, b8c993c1…); s6 (notes, r=0.499, 309ff167…); s7 (table, r=0.485, b05b7484…) |
| crc-PB.md | run-1 | private domestic water pipe material label copper PVC CPVC PEX service line | 15 | 15 | s35 (diagram, r=0.562, 31b84613…); s19 (drawing, r=0.562, 1e461b81…); s34 (diagram, r=0.522, 3c3dfd6f…) |
| crc-PR.md | run-1 | parkland dedication deeded to City of Austin | 30 | ? (persisted-output stub; full result offloaded to disk file `tool-results/toolu_01XijTQK6Y7oUfyHKaazAFEd.json`) | n/a — the 60 KB result was pushed out of the pino log |
| crc-RW.md | run-1 | AULCC Austin Utility Coordination Committee case number | 20 | 20 | s1 (text_block, r=0.516, fba21b4b…); s18 (drawing, r=0.502, 190a0190…); s20 (notes, r=0.48, 34d655f8…) |
| crc-SP-1.md | run-1 | legal description lot block subdivision book page document number | 15 | 15 | s7 (seal, r=0.501, 4e72f725…); s3 (drawing, r=0.483, 6c114da4…); s3 (notes, r=0.474, 78be2938…) |
| crc-SP-2.md | run-1 | compatibility notes hooded shielded lighting mechanical equipment screening refuse | 20 | 20 | s36 (diagram, r=0.422, 1de0964a…); s6 (table, r=0.421, 656b1e26…); s17 (notes, r=0.412, 191585aa…) |
| crc-SP-3.md | run-1 | site plan release notes nine required notes amendments building fire code sign compliance | 10 | 10 | s14 (notes, r=0.595, 8fa31186…); s21 (notes, r=0.593, d5d823de…); s17 (notes, r=0.581, 191585aa…) |

**Mapping method used**: I extracted every `tool_use` invocation of `mcp__conductor_tools__run_semantic_search_blocks` from the main pino log — which carries the `item` field (grouping-file the agent session was reviewing) alongside the `query`. Then, for each grouping, took the first-observed sample query, looked up its `tool_use_id` in the main log's `tool_result` line, and extracted the top-3 blocks from the JSON payload. Correlation to atomic checklist IDs is not directly recoverable — I could only pin down "this query was fired while reviewing the crc-DE-1.md grouping," not "this query was fired to answer checklist item DE-15.2." The agent typically fires several semantic queries in the course of researching a grouping before writing findings for its 5-40 atomic items, so which checklist item motivated a given query is inferable from the query text but not directly logged.

## 4. Errors — what the sidecar hid vs. what the main log recovered

Total `is_error:true` tool_result entries in main log: **91**. Sidecar files show **0 errors** for both vision and semantic-search.

Breakdown by content pattern (from `jq | uniq -c`):

| pattern | count |
|---|---|
| `File does not exist. Note: your current working directory is /vercel/sandbox.` (agent tried to `Read` a wrong path) | 57 |
| `StructuredOutput was called with input that could not be parsed as JSON` (agent's final findings JSON was malformed) | 27 |
| `Output does not match required schema: root: must have required property 'source'` (enrichment step) | 3 |
| `mcp__conductor_tools__crc_vision_check was called with input that could not be parsed as JSON` (**vision MCP input rejected**) | 1 |
| Enrichment "cohort-empty" prose failures | 3 |

Top offending groupings/runs for StructuredOutput failures (final findings unparseable):

| grouping | run | count |
|---|---|---|
| crc-TPW__TPW-20.1.json | run-1 | 4 |
| crc-SP-3.md | run-4 | 3 |
| crc-SP-3.md | run-1 | 3 |
| crc-AW__AW-1.2.json | run-1 | 3 |

The `__TPW-20.1.json` / `__AW-1.2.json` etc. suffixes indicate the enrichment step's per-atomic-item retry — the pipeline retried structured output for individual items after the whole-grouping submission failed. Cost impact of this retry storm is Agent 1's remit; observability-wise the point is: **these errors are ONLY in the main log**; nothing in the two sidecar files hints that ~30 final outputs required a retry cycle.

### The one vision error nobody would have caught from the sidecar

At `2026-06-30T21:38:20Z` (`run-3`, grouping `crc-CA-2.md`, `tool_use_id: toolu_017kd5HbhPfhx1PEoobZMJvX`), the agent tried to call `crc_vision_check` for `documentId=908ffab5…, sheetNum=46` with a 956-byte prompt about the Tree Preservation Plan. The MCP input validator rejected the JSON before it ever reached the vision service (`Common causes: unescaped backslashes, unescaped control characters, or truncated output`). Because the call never left the CLI, **no `crc-vision:result` record was written**. If you were auditing this run using only `vision-log.jsonl` you'd have no idea a Tree Preservation Plan vision call was ever attempted, let alone rejected. This is a real bug hiding in plain sight.

## 5. Traceability — can any current log tie a tool call to a specific atomic checklistItemId?

Yes, but only for vision, and only via one channel.

| source | ties call → atomic checklistItemId? |
|---|---|
| `vision-log.jsonl` | **Yes** — every record has `checklistItemIds[]`. |
| `semantic-search-blocks-log.jsonl` | **No** — no checklist attribution field at all. |
| main pino log `tool_use` for vision | Yes — the agent-supplied `input.checklistItemIds[]` is captured. |
| main pino log `tool_use` for semantic-search | **No** — only `input.args.query` + `input.args.maxResults`. The `item` field of the log line = the grouping/department file (`crc-CA-2.md`) not the atomic item. |
| main pino log `tool_use` for `Read` | No — file path only. |
| `consolidated-findings.json → perRunFindings[].tools_used[]` | Attribution exists per atomic item but is post-hoc "the agent used these tools while reasoning about this item" — you can't tell which specific `tool_use_id` served which item. |

So today, only vision is fully traceable end-to-end (call → checklist item → response text). Semantic-search is traceable to a grouping but not to an atomic item. Non-MCP tools (`Read`, structured output) have no per-checklist-item log line at all.

## 6. Observability improvement proposals

**Priority 1 — per-tool-call JSONL keyed by (checklistItemId, run, tool_use_id).**
Adopt vision's sidecar pattern for every tool the CRC agent has access to. Fields:
```
{
  "timestamp", "run", "grouping", "checklistItemIds", // both sides
  "tool_use_id",                                       // hard correlation
  "tool", "input",                                     // rendered prompt/args
  "output_text" | "output_ref",                        // response or disk pointer
  "usage": { "inputTokens", "outputTokens", ... },
  "elapsedMs",
  "success", "errorClass", "errorMessage"              // MCP-input rejection, service error, timeout
}
```
This one file replaces the whole "grep 121 MB pino log" workflow and closes the gap for semantic-search, `Read`, and structured-output validation failures. It also captures MCP-input-validation rejections that never reached the underlying service.

**Priority 2 — semantic-search must log the result blocks it returned.**
Right now `:result` = `{event, mode, resultCount, elapsed_ms, timestamp}` — nothing about *what came back*. Add at minimum an array of `{blockId, sheetNumber, category, relevance.combined}` on each result record. Full content preview can stay in the main log or a separate `semantic-search-blocks-content.jsonl`. Also add a `queryId` field paired with `:start` to eliminate the timestamp-ordinal pairing.

**Priority 3 — attribute semantic-search calls to `checklistItemIds`.**
Add a required `checklistItemIds[]` param to `mcp__conductor_tools__run_semantic_search_blocks`, matching the vision tool's convention. This forces the agent to declare which atomic checks the query is servicing, and makes downstream audits and cost attribution possible without heuristic timestamp joins.

**Priority 4 — normalize tool names at attribution time.**
`consolidated-findings.json → perRunFindings[].tools_used[]` contains `"crc-vision-check"`, `"mcp__conductor_tools__crc_vision_check"`, `"semantic-search-blocks"`, `"mcp__conductor_tools__run_semantic_search_blocks"`, and bare `"run_semantic_search_blocks"` — five names for two tools. Fix in the "Applied tool attribution" step so downstream analytics don't have to normalize.

**Priority 5 — log `crc-vision:start` and `crc-vision:error` events.**
Right now the vision sidecar only has `:result` and only when the call reached the service. Emit `:start` at MCP entry (before validation) so rejected calls are visible, and `:error` when the vision service itself fails.

**Priority 6 — stop hiding large tool_results behind the CLI persisted-output stub.**
For at least the CRC audit trail, capture the full tool_result JSON to the sidecar. `crc-PR.md`'s `parkland dedication deeded to City of Austin` query returned 30 blocks that got pushed to `~/.claude/projects/.../tool-results/toolu_….json` inside the sandbox — a path that vanishes when the sandbox exits. That result is unrecoverable from these run artifacts.
