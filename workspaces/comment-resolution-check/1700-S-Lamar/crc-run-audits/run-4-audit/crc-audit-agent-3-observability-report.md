# CRC Audit — Agent 3: Tool Usage & Observability

- **reviewId**: `bfb4f256-27a2-4adc-8443-b942e3b4aa79`
- **submissionVersionId**: `6b9b85ed-e992-4906-a222-b24ee836910c`
- **Config**: 3 runs x 17 consolidated departments, 294 consolidated checklist items, model claude-haiku-4-5-20251001, maxWorkers 35
- **Run artifacts**: `/private/tmp/claude-501/-Users-wnavey-noetic/3dd9eaba-e797-4c82-9486-85ad204c523c/scratchpad/crc-run-bfb4f256`
- **Companion TSVs**: `crc-audit-agent-3-tool-usage-current.tsv` (882 rows), `crc-audit-agent-3-tool-usage-running-tally.tsv` (294 rows), both in this directory

## Verdict up front

**Do we have logs of the actual prompts the agent sent to each tool?** Yes — for BOTH tools, and (a pleasant surprise vs. expectations) the vision sidecar also logs the model's **response text**:

| Tool | Prompt logged? | Response logged? | Tied to checklist item? | Where |
|---|---|---|---|---|
| crc-vision-check | YES (`promptText`) | YES (`responseText`) | YES (`checklistItemIds[]`, agent-supplied) | `output/vision-log.jsonl` (148 lines) |
| semantic-search-blocks | YES (`query`) | PARTIAL (block IDs + relevance only, no block text) | PARTIAL (`checklistItemId` on 51/112 calls) | `output/semantic-search-blocks-log.jsonl` (224 lines) |
| Both (raw transcript) | YES (tool_use `input`) | YES (tool_result `content`) | NO (guide/dept level only: `item` + `runIndex`) | `logs/comment-resolution-check.log` (~59 MB pino) |

The top gaps are NOT missing prompts/responses — they are (1) **lossy and reason-free error logging** for vision, (2) **no run index** in either sidecar, (3) **agent self-reported `tools_used`** in findings that demonstrably disagrees with the sidecar ground truth, and (4) semantic-search results logged without the retrieved block text.

## Headline tool-usage numbers (current run)

Out of 882 expected item-runs (294 items x 3 runs): 868 have findings, 14 are missing (`voteBreakdown.missing`), and 9 within-run duplicate findings were collapsed when keying by run.

Per `tools_used` self-report in `output/consolidated-findings.json`:

| Category | Item-runs |
|---|---|
| Used vision (any variant name) | 282 |
| Used semantic-search (any variant name) | 85 |
| Used both | 16 |
| Used neither | 517 |
| — of which `tools_used` empty/blank | 467 |

At the item level (294 items): 151 items self-reported vision in >=1 run; 65 self-reported semantic search. Actual sidecar ground truth: 148 vision calls tagged to 140 distinct items; 112 semantic-search calls (51 item-tagged).

`tools_used` values are free-text and inconsistent: `crc-vision-check` (243), `mcp__conductor_tools__crc_vision_check` (38), `semantic-search-blocks` (59), `mcp__conductor_tools__run_semantic_search_blocks` (24), `Read` (52), plus one-off strings like `sheet guide analysis`, `supplementary documents search`, `vision review`, and 14 literal empty-string entries (all in DE run-2).

### Self-report vs. sidecar disagreement (fidelity check)

- **19 items** self-reported a vision tool in `tools_used` but have ZERO sidecar vision calls tagged with their ID (e.g. AWRR-0, CA-07.1, DE-0, EV-04, EV-05.2/3/5, EV-06.1/2/3). Either the self-report is fabricated/loose, or the agent omitted those IDs from the `checklistItemIds` param of a shared call. Both are fidelity failures.
- **8 items** have sidecar vision calls tagged to them but no vision in any run's `tools_used` (CA-06.1, CA-06.2, DE-36.2, EV-14, SP-11.1, SP-11.2, WQ-11, CA-22.1) — under-reporting in the other direction.

Conclusion: **`tools_used` in findings is agent self-report, not instrumentation.** There is no orchestrator-side attribution: the main log contains zero occurrences of `Applied tool attribution` or `toolsUsed`. Treat per-item tool attribution from findings as approximate; the sidecars are the ground truth but are per-call, not per-run.

## Semantic search (`output/semantic-search-blocks-log.jsonl`, 224 lines)

- 112 paired `semantic-search-blocks:start` / `:result` events, joined by `queryId`. Zero error events.
- `:start` logs: `query` (the full prompt), `maxResults`, `projectId`, `timestamp`, and — on **51 of 112** — `checklistItemId`. The other 61 omit it (the param is optional and agent-supplied).
- `:result` logs: `mode` ("hybrid"), `resultCount`, `elapsed_ms`, and `results[]` with only `blockId, sheetNumber, sheetLabel, category, relevance` — **the retrieved block TEXT the agent actually read is not in the sidecar** (it is in the main-log tool_result).
- All 112 calls were correlated to a department/guide and run via the main log: each `mcp__conductor_tools__run_semantic_search_blocks` tool_use line in `logs/comment-resolution-check.log` carries `item` (guide file) and `runIndex`; I matched sidecar `:start` entries to tool_use lines by exact `query` text + nearest timestamp. 112/112 matched. Department spread: TPW-2 (25), SP-1 (11), F (11), TPW-1 (10), PR (8), AWRR (7), SP-2 (5), IW (5), WQ (4), DE-1 (4), OWB (3), SP-3 (3), DE-2 (3), CM (3), PB (3), CA-1 (3), CA-2 (1), RW (1), EV-2 (1), AW (1).

### Sample: 20 query -> result pairs (one per guide, all 20 guides that used the tool)

Mapping method: `item:` shows the sidecar `checklistItemId` when present; otherwise "(untagged; correlated via main log)" — department/run comes from the transcript tool_use line matched by query text + timestamp. Sidecar line numbers cited.

**1. [TPW-1 / run-2] item: (untagged; correlated via main log)** — sidecar lines 1/2
   - Query: "Street Impact Fee" (maxResults=20)
   - Result: 20 blocks in 2171ms; top: sheet 1 (Cover Sheet, rel 0.584); sheet 47 (Landscape Calculations, rel 0.375); sheet 31 (Erosion And Sedimentation Control Details, rel 0.375)
**2. [PR / run-1] item: (untagged; correlated via main log)** — sidecar lines 3/4
   - Query: "parkland dedication table acres floodplain" (maxResults=15)
   - Result: 15 blocks in 907ms; top: sheet 3 (Final Plat, rel 0.489); sheet 30 (Water Quality and Detention Pond Calcs, rel 0.449); sheet 12 (Slope Map, rel 0.442)
**3. [TPW-2 / run-2] item: TPW-20.1** — sidecar lines 9/10
   - Query: "bicycle parking long-term covered weather protected" (maxResults=10)
   - Result: 10 blocks in 619ms; top: sheet 33 (Site Details, rel 0.479); sheet 33 (Site Details, rel 0.472); sheet 14 (Dimensional Control & Site Plan, rel 0.405)
**4. [OWB / run-2] item: (untagged; correlated via main log)** — sidecar lines 17/18
   - Query: "Total Irrigated Landscaped Area irrigation system pervious" (maxResults=15)
   - Result: 15 blocks in 855ms; top: sheet 24 (Proposed Drainage Area Map, rel 0.536); sheet 44 (Sheet Index & Notes, rel 0.508); sheet 52 (Planting Notes, rel 0.508)
**5. [SP-3 / run-1] item: SP-45** — sidecar lines 25/26
   - Query: "site plan release notes nine required notes" (maxResults=15)
   - Result: 15 blocks in 492ms; top: sheet 21 (Grading Plan, rel 0.639); sheet 11 (Erosion and Sedimentation Control Plan, rel 0.634); sheet 14 (Dimensional Control & Site Plan, rel 0.58)
**6. [SP-1 / run-2] item: (untagged; correlated via main log)** — sidecar lines 27/28
   - Query: "Tenant Notification demolition requirements LDC 25-1-712" (maxResults=10)
   - Result: 10 blocks in 562ms; top: sheet 44 (Sheet Index & Notes, rel 0.435); sheet 52 (Planting Notes, rel 0.412); sheet 8 (Existing Conditions & Demolition Plan (1 Of 2), rel 0.411)
**7. [DE-2 / run-1] item: DE-36.1** — sidecar lines 33/34
   - Query: "subsurface pond maintenance plan maintenance activities inspection sediment vegetation" (maxResults=15)
   - Result: 15 blocks in 573ms; top: sheet 29 (Water Quality And Detention Pond Plan, rel 0.684); sheet 29 (Water Quality And Detention Pond Plan, rel 0.58); sheet 29 (Water Quality And Detention Pond Plan, rel 0.563)
**8. [SP-2 / run-2] item: (untagged; correlated via main log)** — sidecar lines 59/60
   - Query: "Level 6 building floor plan architecture" (maxResults=10)
   - Result: 10 blocks in 571ms; top: sheet 43 (Building Plan - Level 5, rel 0.639); sheet 40 (Building Plan - Level 2, rel 0.592); sheet 41 (Building Plan - Level 3, rel 0.568)
**9. [WQ / run-1] item: (untagged; correlated via main log)** — sidecar lines 65/66
   - Query: "pump station wet well irrigation dual pump system plug valves" (maxResults=20)
   - Result: 20 blocks in 592ms; top: sheet 52 (Planting Notes, rel 0.431); sheet 44 (Sheet Index & Notes, rel 0.422); sheet 35 (Utility Details, rel 0.42)
**10. [CM / run-1] item: CM-4** — sidecar lines 99/100
   - Query: "license agreement right-of-way ROW vertical improvements canopy sign planter" (maxResults=15)
   - Result: 15 blocks in 592ms; top: sheet 14 (Dimensional Control & Site Plan, rel 0.531); sheet 13 (Overall Site & Paving & Striping Plan, rel 0.522); sheet 53 (Planting Plan, rel 0.507)
**11. [IW / run-2] item: (untagged; correlated via main log)** — sidecar lines 105/106
   - Query: "506-AW-04 standard detail large diameter wastewater cleanout" (maxResults=15)
   - Result: 15 blocks in 505ms; top: sheet 35 (Utility Details, rel 0.646); sheet 35 (Utility Details, rel 0.629); sheet 35 (Utility Details, rel 0.616)
**12. [PB / run-1] item: PB-1** — sidecar lines 107/108
   - Query: "wastewater easement crossing lot line property boundary" (maxResults=10)
   - Result: 10 blocks in 625ms; top: sheet 19 (Water & Wastewater PNP (1 Of 2), rel 0.589); sheet 19 (Water & Wastewater PNP (1 Of 2), rel 0.58); sheet 34 (Utility Details, rel 0.555)
**13. [F / run-2] item: F-1.1** — sidecar lines 111/112
   - Query: "fire lane turnaround 25 feet wide vertical clearance" (maxResults=10)
   - Result: 10 blocks in 548ms; top: sheet 33 (Site Details, rel 0.508); sheet 33 (Site Details, rel 0.471); sheet 32 (Site Details, rel 0.445)
**14. [AWRR / run-2] item: AWRR-2.2** — sidecar lines 127/128
   - Query: "OWRS meter demand sheet fixture units peak flow sizing" (maxResults=15)
   - Result: 15 blocks in 510ms; top: sheet 7 (General Notes, rel 0.683); sheet 7 (General Notes, rel 0.681); sheet 6 (Austin Water General Information, rel 0.629)
**15. [DE-1 / run-2] item: (untagged; correlated via main log)** — sidecar lines 133/134
   - Query: "trickle channel concrete pilot channel OS-1 offsite drainage" (maxResults=10)
   - Result: 10 blocks in 506ms; top: sheet 27 (Storm Drain Plan & Profile, rel 0.537); sheet 28 (Storm Drain Plan & Profile, rel 0.484); sheet 32 (Site Details, rel 0.482)
**16. [CA-2 / run-2] item: (untagged; correlated via main log)** — sidecar lines 135/136
   - Query: "Heritage Tree transplant feasibility arborist buildability" (maxResults=10)
   - Result: 10 blocks in 614ms; top: sheet 46 (Tree Preservation Plan, rel 0.488); sheet 44 (Sheet Index & Notes, rel 0.472); sheet 54 (Planting Details, rel 0.466)
**17. [CA-1 / run-2] item: CA-01.1** — sidecar lines 147/148
   - Query: "buildability exhibit Heritage Tree 5001 transplant feasibility" (maxResults=10)
   - Result: 10 blocks in 460ms; top: sheet 46 (Tree Preservation Plan, rel 0.491); sheet 8 (Existing Conditions & Demolition Plan (1 Of 2), rel 0.479); sheet 54 (Planting Details, rel 0.479)
**18. [RW / run-3] item: RW-1** — sidecar lines 175/176
   - Query: "AULCC Austin Utility Coordination Committee case number" (maxResults=15)
   - Result: 15 blocks in 490ms; top: sheet 1 (Cover Sheet, rel 0.516); sheet 18 (Overall Utility Plan, rel 0.502); sheet 20 (Water & Wastewater Pnp, rel 0.48)
**19. [EV-2 / run-3] item: (untagged; correlated via main log)** — sidecar lines 201/202
   - Query: "planting schedule plant species size caliper shrub ground cover grass quantities" (maxResults=20)
   - Result: 20 blocks in 596ms; top: sheet 54 (Planting Details, rel 0.622); sheet 54 (Planting Details, rel 0.577); sheet 44 (Sheet Index & Notes, rel 0.504)
**20. [AW / run-2] item: (untagged; correlated via main log)** — sidecar lines 215/216
   - Query: "land status determination letter LSD lot documentation" (maxResults=20)
   - Result: 20 blocks in 785ms; top: sheet 21 (Grading Plan, rel 0.416); sheet 3 (Final Plat, rel 0.41); sheet 44 (Sheet Index & Notes, rel 0.409)

## Vision (`output/vision-log.jsonl`, 148 lines)

- 145 `crc-vision:result` + 3 `crc-vision:error` lines.
- Every line (including errors) logs `promptText` and `checklistItemIds[]` — so the vision **prompt IS logged**, in the sidecar itself, contrary to the usual expectation.
- Result lines additionally log `responseText` (the full model answer that drives pass/fail), `model` (all 145: `google/gemini-3.1-pro-preview`), `usage` (token detail; 572,960 total tokens across the run), `elapsedMs`, `documentId`, `sheetNum`, `referenceImagesCount/Skipped`, `paths`.
- The main log ALSO carries prompt + response: 150 `mcp__conductor_tools__crc_vision_check` tool_use blocks with full `input` (`documentId`, `sheetNum`, `checklistItemIds`, `prompt`) and their tool_result contents in the transcript stream.
- What is missing from the sidecar: **run index** (cannot tell run-1 from run-3 without the main log), department/guide, and — critically — **any error reason on `:error` lines** (they have only `success:false`; no `error` field, no elapsed, no model).

## Errors: cross-referencing the 3 (actually 4+) failed vision calls

Sidecar `crc-vision:error` lines 3-5 of `output/vision-log.jsonl`: sheets 34, 35, 36, `checklistItemIds` [AW-1.1, AW-1.2, AW-1.3], `documentId` = `"1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf"` — **a filename, not a UUID**. No error reason recorded.

Cross-reference recovered the real cause:

- `logs/comment-resolution-check-error.log` (3 entries, times 1783982115604 / 1783982117897 / 1783982120201, item `crc-AW.md`, run-1): `DB error fetching plan_set_version: invalid input syntax for type uuid: "1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf"` — the agent passed the redlines PDF's display filename (taken from the crc-aw-redlines guide) as `documentId`, and the tool crashed on the uuid cast instead of validating input.
- What the agent saw (main log lines 10880, 11015, 11179): a generic, non-error-flagged tool_result: `"File could not be loaded. Are you using a valid documentId?"`. The real reason never reached the agent — it recovered anyway by retrying with the correct UUID `908ffab5-…` (successful sidecar results for sheets 34-36 from t=1783982457447 onward).
- **Lossiness bug**: the main log shows a 4th `File could not be loaded` failure (line 12745, t=1783982150397, crc-AW.md run-1) and 150 vision tool_use vs 148 sidecar lines (sheet-35 and sheet-36 prompts each appear twice in the transcript but once in the sidecar). At least one failed call is recorded **nowhere** except the raw transcript — the sidecar error path does not fire on every failure mode.

Semantic search: zero failed calls this run, so its (nonexistent) error logging is untested here — note the sidecar has no `:error` event type at all.

## Traceability: can a tool call be tied to an atomic checklistItemId?

- **Vision**: yes, via agent-supplied `checklistItemIds[]` — present on all 148 sidecar lines. But because it is agent-supplied it is unverified; the 19-item over-report / 8-item under-report divergence above shows agent-supplied attribution cannot be fully trusted.
- **Semantic search**: only 51/112 calls carry `checklistItemId`; the rest resolve only to a department/guide + run via transcript correlation (query-text matching — fragile, would break on duplicate queries).
- **Main log**: guide-level only (`item: crc-XX.md`, `runIndex`); no per-item tagging of tool calls.
- **Findings `tools_used`**: per item x run, but self-reported free text with no linkage to specific calls.

**Recommendation**: make `checklistItemIds` a REQUIRED param on both tools, validated against the guide's item list (reject unknown IDs), and stamp it server-side into both sidecars — do not rely on the model volunteering it.

## Observability improvement proposals (concrete)

1. **Unified per-tool-call JSONL** — `output/tool-calls.jsonl`, one line per call, shape:
   `{ toolName, runIndex, guide, checklistItemIds[], callId (== transcript tool_use_id), promptOrQuery, responseText | resultSummary, model, usage: {in, out, total}, elapsedMs, success, errorReason, timestamp }`.
   Key everything by the transcript `tool_use_id` so sidecar lines are joinable to the raw transcript without query-text heuristics. This single change subsumes gaps 2-5 below.
2. **Log the error reason in the vision sidecar** — the `:error` event must carry `errorReason` (the caught exception message, e.g. the uuid-cast failure) and fire on EVERY failure path (fix the lossy 4th-failure case). Also return a more specific hint to the agent ("documentId must be a UUID; you passed a filename").
3. **Add `runIndex` (and guide name) to both sidecars** — today neither vision-log nor semantic-search-log can distinguish run-1/2/3 without transcript correlation; that blocks any per-run tool analysis from sidecars alone.
4. **Replace self-reported `tools_used` with orchestrator-side attribution** — count actual tool calls per (item x run) from the instrumented sidecars and stamp them into findings post-hoc (an "Applied tool attribution" step, which today does not exist despite the field's authoritative appearance). Keep the agent's self-report, if at all, as a separate `tools_claimed` field. This also fixes the inconsistent naming (5+ spellings) and the 14 empty-string entries.
5. **Log retrieved block text (or a hash + first 200 chars) in semantic-search `:result`** — currently the evidence the agent actually read is unrecoverable from the sidecar; auditors must trawl the 59 MB transcript.
6. **Input validation on `documentId`** — validate UUID shape before the DB query; the current behavior surfaces a Postgres cast error into the error log and a vague message to the agent.

## Historical tool attribution (feeds running-tally TSV)

Per orchestrator decision, only the two gen-6 priors were counted (INCLUDE_INCOMPATIBLE_HISTORY: no):
- `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e` (2026-06-30): 291 comments, all with `output_json.agentTrace.tools_used` and `output_json.crc.atomicItemId`.
- `47eca23e-a010-4f87-ac3b-1cf6f4c481ae` (2026-07-09): 295 comments, same shape (5-run review).

Matching by bare atomic item ID (case-insensitive): **291/294** current items matched in both priors, 1 in exactly one, 2 in neither. Fidelity caveat (recorded per-row in the TSV notes): historical attribution is **comment-level agent self-report** — one `tools_used` array per consolidated comment, NOT per run and NOT per call (`sourceFindings[].perRunFindings[]` in the priors carry no tools_used at all). It is not a blanket default (values vary: vision 304, sem-search 215, Read 39, empty 5 across 586 comments), so it is usable as a coarse "did this item historically need vision?" signal, nothing finer.

## File citations

- `/private/tmp/claude-501/-Users-wnavey-noetic/3dd9eaba-e797-4c82-9486-85ad204c523c/scratchpad/crc-run-bfb4f256/output/consolidated-findings.json` — 294 items, `perRunFindings[].tools_used`
- `/private/tmp/claude-501/-Users-wnavey-noetic/3dd9eaba-e797-4c82-9486-85ad204c523c/scratchpad/crc-run-bfb4f256/output/vision-log.jsonl` — errors at lines 3, 4, 5
- `/private/tmp/claude-501/-Users-wnavey-noetic/3dd9eaba-e797-4c82-9486-85ad204c523c/scratchpad/crc-run-bfb4f256/output/semantic-search-blocks-log.jsonl` — paired by `queryId`; sample line refs above
- `/private/tmp/claude-501/-Users-wnavey-noetic/3dd9eaba-e797-4c82-9486-85ad204c523c/scratchpad/crc-run-bfb4f256/logs/comment-resolution-check.log` — vision tool_use example line 10868; generic failure results lines 10880, 11015, 11179, 12745
- `/private/tmp/claude-501/-Users-wnavey-noetic/3dd9eaba-e797-4c82-9486-85ad204c523c/scratchpad/crc-run-bfb4f256/logs/comment-resolution-check-error.log` — 3 uuid-cast errors, item crc-AW.md run-1
