# CRC Audit — Agent 3: Tool Usage & Observability

- **reviewId**: `ed5e7ba9-ba03-4000-abb4-1021ebec0631` (runLabel `2026-07-14-v5-crc-game-day-run-1`, cloud, model claude-sonnet-4-6)
- **submissionVersionId**: `4cfe4c36-c14e-4f5f-8b71-27c6fe3ed677` (v5 — FIRST CRC review of this submission version; zero same-version priors)
- **Config**: 5 runs x 24 department guide files, 291 consolidated checklist items
- **Run artifacts**: `/private/tmp/claude-501/-Users-wnavey-noetic/e4e35185-fafe-46a2-a324-6e4d0b91d03c/scratchpad/crc-run-ed5e7ba9`
- **Companion TSVs**: `crc-audit-agent-3-tool-usage-current.tsv` (1455 rows), `crc-audit-agent-3-tool-usage-running-tally.tsv` (291 rows), in this directory
- **Prior audit compared against**: `/Users/wnavey/noetic/crc-audits/bfb4f256-27a2-4adc-8443-b942e3b4aa79/crc-audit-agent-3-observability-report.md` (run-4 calibration, 2026-07-09 data)

## Verdict up front

**Do we have logs of the actual prompts the agent sent to each tool (esp. vision)?** YES — and this run shows the winston#163 comment-observability work (shipped 2026-07-13) landed. Vision now has THREE independent capture points including full prompt AND full response; semantic search logs its query with per-item, per-run tagging on 100% of calls.

| Tool | Prompt logged? | Response logged? | Tied to checklist item? | Tied to run? | Where |
|---|---|---|---|---|---|
| crc-vision-check | YES (`promptText` / `renderedPrompt` / main-log `prompt`) | YES (`responseText` / `response.text`) — but NOT in main log (only `responseChars`) | YES (`checklistItemIds[]`, 676/676) | YES (`runIndex`, NEW) | `output/vision-log.jsonl` (676 lines) + **NEW** `output/runs/<run>/tool-calls/*.json` (676 files + per-run `manifest.jsonl`) + main log |
| semantic-search-blocks | YES (`query`, also full CLI `command` in main log) | PARTIAL (block IDs + sheet + category + rank; **no block text**) | YES (`checklistItemId`, 482/482, NEW — was 51/112) | YES (`runIndex`, NEW) | `output/semantic-search-blocks-log.jsonl` (1446 lines) + aggregate `semantic-search-blocks.json` |

**The single biggest finding of this audit is not an observability gap — it is what the (new, working) observability revealed: semantic search was effectively dead this entire run.** All 482 calls hit `semantic-search-blocks:hybrid-error` — `"permission denied for schema extensions"` — and silently fell back to `mode: "keyword"`, where **460/482 (95.4%) returned zero results**. See "Errors" below.

## Headline tool-usage numbers (current run, per `tools_used` self-report)

1455 item-runs (291 items x 5 runs; every item has 5 per-run findings — no missing runs, unlike baseline's 14).

| Category | Item-runs | Rate | BASELINE (bfb4f256: different submission version, same gen-6 items, 3 runs, haiku) |
|---|---|---|---|
| Used vision (any variant) | 1,099 | 75.5% | 282/882 = 32.0% |
| Used semantic-search (any variant) | 268 | 18.4% | 85/882 = 9.6% |
| Used both | 169 | 11.6% | 16/882 = 1.8% |
| Used neither | 257 | 17.7% | 531/882 = 60.2% |
| — of which `tools_used` empty | 247 | 17.0% | 467/882 = 53.0% |

Sidecar ground truth (actual calls): **676 vision calls** (673 ok + 3 errors; 0.465 per item-run vs baseline 0.168 — 2.8x) and **482 semantic-search calls** (0.331 per item-run vs baseline 0.127 — 2.6x). Vision spend: **2,892,612 total tokens** (vs 572,960 baseline — 5.0x), avg 4,298 tokens and 23.5 s per call (max 216 s), all 673 on `google/gemini-3.1-pro-preview`. Item level: 264/291 items self-reported vision in >=1 run (sidecar agrees: 264 distinct tagged items); 102/291 self-reported semantic search (sidecar: 140 tagged items — agents under-report searches that came back empty).

`tools_used` naming is still free text but far cleaner than baseline (6 spellings, no one-off prose strings): `crc-vision-check` (1074), `semantic-search-blocks` (246), `mcp__conductor_tools__crc_vision_check` (26), `Read` (17), `run_semantic_search_blocks` (13), `mcp__conductor_tools__run_semantic_search_blocks` (9).

### Self-report vs sidecar fidelity (much improved vs baseline's 19 over / 8 under)

- 6 items self-reported vision with zero sidecar calls tagged to them: CA-16.2, DE-33, EV-06.1, PR-4, SP-19.1, TPW-1 (likely shared calls whose `checklistItemIds` omitted them).
- 3 items had sidecar vision calls but never self-reported vision: CA-01.3, SP-20, SP-25.
- **Parent-vs-sub-item ID mismatch (new wrinkle)**: sidecar vision calls tagged `TPW-7`, `TPW-10`, `TPW-13` and a semantic-search call tagged `WQ-14` match NO consolidated item — the consolidated IDs are the sub-items (TPW-10.1/.2/.3, WQ-14.1/.2/.3, etc.). The agent tagged the parent ID; joins on bare atomicItemId silently drop these calls.

## Semantic search (`output/semantic-search-blocks-log.jsonl`, 1446 lines = 482 x {start, hybrid-error, result})

- `:start` logs `query`, `maxResults`, `projectId`, plus NEW fields `runIndex`, `guideFile`, `queryId`, `checklistItemId` — **all 482 calls are item-tagged and run-tagged** (baseline: 51/112 item-tagged, 0 run-tagged). `queryId` pairs start↔result deterministically (baseline needed query-text + timestamp heuristics).
- `:result` logs `mode`, `resultCount`, `elapsed_ms`, `results[]` (blockId, sheetNumber, sheetLabel, category, relevance.rank). **Retrieved block TEXT is still not logged** — prior recommendation #5, not yet done (low-stakes this run since 95% of results were empty).
- Main log: each call also appears as `"Executing script tool"` with the full CLI `command` (query, checklistItemId, maxResults visible) + `item` (guide) + `runIndex`.
- Distribution: run-1: 105, run-2: 91, run-3: 93, run-4: 99, run-5: 94. All 24 guide files hit at least once (SP-2: 40, WQ: 34, SP-1: 33, EV-1: 36 … RW: 5, IW: 1, LDE: 10).

### Sample: 23 query → result pairs (one per guide file, all departments that used the tool)

Mapping method: direct — every sidecar line now carries `checklistItemId`, `guideFile`, `runIndex`; no heuristic correlation needed. Sidecar line numbers cited as start/result. Note the pervasive zero-result pattern and the microscopic keyword ranks (0.0002–0.03) vs baseline hybrid ranks (0.4–0.7).

1. **[crc-AWRR / run-1] AWRR-0** (lines 163/165) — Q: "OWRS permit onsite water reuse system permit application" (max 10) → **0 blocks**, 834 ms
2. **[crc-CA-1 / run-4] CA-06.1** (1168/1170) — Q: "tree protection mulch fencing" (max 10) → 7 blocks, 629 ms; top: sheet 54 (Tree Protection Notes And Details, diagram, rank 0.0297), sheet 53 (Sheet Index & Notes, notes, 0.0106)
3. **[crc-CA-2 / run-2] CA-13.1** (493/495) — Q: "ECM 3.6.2 standard tree and natural area protection plan note" (max 10) → 1 block, 599 ms; sheet 5 (General Notes, notes, 0.0068)
4. **[crc-CA-3 / run-1] CA-22** (214/216) — Q: "Appendix P-2 tree protection plan note" (max 10) → 1 block, 597 ms; sheet 53 (Sheet Index & Notes, notes, 0.0062)
5. **[crc-CM / run-1] CM-4** (235/237) — Q: "license agreement right-of-way Land Management vertical improvements streetscape" (max 15) → **0 blocks**, 565 ms
6. **[crc-DE-1 / run-1] DE-4** (319/321) — Q: "Appendix Q-2 impervious cover table maximum allowable zoning" (max 10) → **0 blocks**, 864 ms
7. **[crc-DE-2 / run-1] DE-35** (286/288) — Q: "detention pond drawdown time 24 hours calculation" (max 10) → **0 blocks**, 839 ms
8. **[crc-EV-1 / run-1] EV-08.1** (127/129) — Q: "landscape plan owner maintain required landscaping supplemental irrigation planting" (max 10) → 1 block, 3872 ms; sheet 53 (Sheet Index & Notes, notes, 0.0003)
9. **[crc-EV-2 / run-1] EV-10** (46/48) — Q: "shrubs ground covers grasses species location quantity size planting schedule" (max 10) → **0 blocks**, 867 ms
10. **[crc-F / run-1] F-2.3** (568/570) — Q: "Knox box key switch gate fire access road UL 325 ASTM F2200 power operated gate note" (max 15) → 2 blocks, 745 ms; sheet 15 (Dimensional Control & Site Plan 2 Of 2, notes, 0.0015), sheet 17 (Fire Protection Plan, notes, 0.0006)
11. **[crc-IW / run-2] IW-1.1** (148/150) — Q: "506-AW-04 large diameter wastewater cleanout standard detail" (max 20) → 1 block, 662 ms; sheet 37 (Utility Details, diagram, 0.0003)
12. **[crc-LDE / run-1] LDE-1** (31/33) — Q: "10-ft curb inlet Collier Street driveway radius clearance" (max 20) → **0 blocks**, 981 ms
13. **[crc-OWB / run-1] OWB-5** (109/111) — Q: "total irrigated landscape area irrigation plan" (max 15) → 1 block, 719 ms; sheet 54 (Tree Protection Notes And Details, notes, 0.0002)
14. **[crc-PB / run-2] PB-1** (7/9) — Q: "private wastewater piping lot line crossing property boundary" (max 15) → **0 blocks**, 1464 ms
15. **[crc-PR / run-2] PR-8** (16/18) — Q: "parkland dedication table acres floodplain CWQZ" (max 20) → **0 blocks**, 1214 ms
16. **[crc-RW / run-1] RW-1** (1/3) — Q: "AULCC Austin Utility Coordination Committee case number" (max 15) → **0 blocks**, 2201 ms
17. **[crc-SP-1 / run-1] SP-5** (250/252) — Q: "Unified Development Agreement UDA restrictive covenant recorded lots cohesive development" (max 10) → **0 blocks**, 735 ms
18. **[crc-SP-2 / run-4] SP-25** (823/825) — Q: "compatibility notes hooded shielded lighting mechanical equipment screening refuse receptacle" (max 10) → 1 block, 578 ms; sheet 5 (General Notes, notes, 0.0020)
19. **[crc-SP-3 / run-1] SP-45** (1276/1278) — Q: "site plan release notes improvements amendments signs" (max 10) → 2 blocks, 753 ms; sheet 13 (Overall Site & Paving & Striping Plan, notes, 0.0026)
20. **[crc-TPW-1 / run-4] TPW-3** (808/810) — Q: "right of way dedication" (max 15) → 3 blocks, 684 ms; sheet 3 (Final Plat, drawing, 0.0269), sheet 34 (Utility Details, table, 0.02)
21. **[crc-TPW-2 / run-1] TPW-14.1** (22/24) — Q: "sidewalk easement dedication" (max 15) → 1 block, 579 ms; sheet 34 (Utility Details, table, 0.0038)
22. **[crc-WQ / run-1] WQ-15** (217/219) — Q: "maintenance agreement Official Public Records Travis County water quality detention facility" (max 10) → **0 blocks**, 911 ms
23. **[crc-aw-redlines / run-2] AW-RL-6** (421/423) — Q: "Austin Water meter abandonment detail" (max 10) → 3 blocks, 824 ms; sheet 8 (Existing Conditions & Demolition Plan, notes, 0.0071)

(These samples over-represent nonzero results by construction — I preferred a nonzero example per guide where one existed. Only 22 of 482 calls run-wide returned anything at all.)

## Vision — where the prompt and response ARE (and are not) logged

Three capture points, cross-checked for parity (676 = 676 = 673+3; the baseline's lossy-sidecar bug did not reproduce):

1. **Sidecar `output/vision-log.jsonl`** (676 lines: 673 `crc-vision:result` + 3 `crc-vision:error`). Every line: `promptText` (full prompt), `checklistItemIds[]`, `documentId`, `sheetNum`, `runIndex` (NEW), `referenceImagesCount/Skipped`, `paths`. Result lines add `responseText` (the full model answer that drives pass/fail), `model`, `usage` (token detail incl. reasoning tokens), `elapsedMs`. **Error lines still carry NO error reason** — only `success: false`.
2. **NEW: per-tool-call capture `output/runs/<run>/tool-calls/<callId>-crc_vision_check-*.json`** (676 files + per-run `manifest.jsonl`) — this is essentially the prior audit's recommendation #1, implemented for vision: `callId`, `toolUseId` (joins to raw transcript), `checklistItemIds`, `renderedPrompt`, `request` (raw params), `response` (`{text, isError}` — **failures ARE captured**, unlike baseline), `resolvedImages`, `artifacts`, `model`, `usage`, `runIndex`, `startedAt/completedAt`, `elapsedMs`. The manifest gives a per-run call index.
3. **Main log** `logs/comment-resolution-check.log` (101 MB pino): `"Calling crc-vision-check: <doc> (<sheet>)"` lines carry the full `prompt`, `checklistItemIds`, `item` (guide), `runIndex`; `"crc-vision-check response received"` lines carry `usage` and `responseChars` but **NOT the response text**. Response text in the main log exists only inside raw transcript tool_result blocks.

**Bottom line: the baseline's "top gap" candidates are closed for vision** — prompt, response, run index, and per-call file capture all exist. What remains: error *reasons* are still not in the sidecar or tool-call files (the `error` field in the tool-call JSON is `null` even for failures; the response is just the agent-facing "File could not be loaded.").

## Errors — cross-referenced to the main/error log

### 1. Semantic search: hybrid mode down for the ENTIRE run (the big one)

Every one of the 482 calls emitted `semantic-search-blocks:hybrid-error` → `"permission denied for schema extensions"` (a Postgres privilege failure — the querying role lacks USAGE on the `extensions` schema, where pgvector lives) and silently fell back to `mode: "keyword"`. Consequences:

- **460/482 (95.4%) of searches returned zero blocks**; the 22 nonzero results have keyword ranks of 0.0002–0.03 (baseline hybrid: 0.4–0.7 with full result pages). The tool was effectively non-functional for evidence-gathering all run.
- The agents never saw an error — they saw legitimate-looking empty result sets, and visibly compensated by leaning on vision (vision calls per item-run 2.8x baseline; vision tokens 5x baseline).
- Credit where due: the `:hybrid-error` sidecar event is itself NEW observability (baseline had no error event type at all) — this failure is only diagnosable because of it. But nothing *alerted*: a 100% degraded-mode rate should page someone, not just journal itself.
- The baseline run (2026-07-09 artifacts) ran hybrid successfully, so this permission break happened between then and 2026-07-14 — likely fallout from the Sec Wave 9 / C1 permission lockdowns. Needs a grant fix before the next run.

### 2. Vision: 3 failed calls, real reason recovered from the error log

Sidecar shows 3 `crc-vision:error` lines (no reason). All three: `documentId: e3412be0-07b0-4378-8a60-a38736dbbf60` **with a `sheetNum`** (sheet 1 or 2), items SP-15.1–SP-15.4 (airport/military/industrial proximity checks), run-1 (x2) and run-4 (x1). Cross-reference:

- `logs/comment-resolution-check-error.log`: `Error: No plan set version found for plan_set_id: e3412be0-…` at `vision-file.ts:51` via `crc-vision-check/index.ts:347` — the UUID is **valid and real**, but it's the "Austin Property Profile Maps" **supporting document**, not a plan set. Passing `sheetNum` routes the tool down the plan-set-version lookup path, which cannot resolve a supporting document.
- Proof: the SAME documentId **without** `sheetNum` succeeded 3 times (runs 1, 3, 5) — full property-profile-map analysis returned. Tool-call file `run-1/tool-calls/2026-07-14T17-32-19-834Z-crc_vision_check-204-3vpmoa.json` (fail, sheetNum 1) vs `...17-33-03-472Z-...-217-llv1oe.json` (success, sheetNum null) shows the agent itself discovered the workaround by retrying sheet-less 44 seconds later.
- The agent-facing message was just "File could not be loaded." — no hint that omitting `sheetNum` (or that this is a supporting doc) was the fix. This is the same error-opacity bug class as baseline's filename-as-UUID case, in a new costume: last time input validation was the gap, this time it's **document-type routing** (`sheetNum` + supporting-document ID = guaranteed crash).
- Also in the error log (out of my lane, noting for Agent 1): one structured-output retry exhaustion on crc-SP-3.md run-1 (`error_max_structured_output_retries`), recovered on item retry.

## Traceability: can a tool call be tied to an atomic checklistItemId?

**Yes — for the first time, on both tools, at 100% coverage** (vision: agent-supplied `checklistItemIds[]` on 676/676 sidecar lines AND in tool-call files AND in main-log call lines; semantic search: `checklistItemId` on 482/482, now passed as an explicit CLI flag). Remaining weaknesses:

1. Attribution is still **agent-supplied and unvalidated** — the TPW-7/TPW-10/TPW-13/WQ-14 parent-ID tags match no consolidated item, and the 6-over/3-under self-report divergence persists (though 3–6x better than baseline).
2. `tools_used` in findings is still self-report; there is still no orchestrator-side "Applied tool attribution" step (zero occurrences in the main log).
3. Semantic search is **not** covered by the per-call `tool-calls/` capture (vision only).

## Observability improvement proposals (concrete, delta-aware)

Prior-audit scorecard: rec #1 per-tool-call JSONL — **DONE for vision** (tool-calls/ + manifest); rec #2 error reason in sidecar — **NOT done**; rec #3 runIndex in sidecars — **DONE (both)**; rec #4 orchestrator-side attribution — **NOT done** (but self-report fidelity improved); rec #5 block text in search results — **NOT done**; rec #6 documentId validation — **partially** (no filename-UUIDs this run, but the supporting-doc+sheetNum path is a new unvalidated hole).

1. **Fix and alert on semantic-search hybrid degradation** (new, top priority): grant the runtime role USAGE on the `extensions` schema (or schema-qualify the pgvector operators); add a post-run health check that fails loudly when `hybrid-error` rate > 0% or zero-result rate > ~60% — this run's 100%/95.4% should never be discoverable only by audit. Log the fallback `mode` into the agent-visible result so the model knows it's getting degraded keyword results.
2. **Put the error reason where the errors are**: `crc-vision:error` sidecar lines and the tool-call file's `error` field must carry the caught exception message (`No plan set version found…`). Return an actionable hint to the agent ("this documentId is a supporting document — omit sheetNum"), and validate the documentId-type/sheetNum combination before the DB lookup.
3. **Extend `tool-calls/` capture to semantic-search** (and any future tools) with the same shape (`callId`, `toolUseId`, request, response *including retrieved block text or first ~200 chars per block*, elapsed, error) — one uniform per-call store instead of tool-specific sidecars.
4. **Server-side tool attribution**: derive per-(item x run) tool counts from the tool-call manifests and stamp them into findings (`tools_used_measured`), keeping the model's list as `tools_claimed`; validate agent-supplied `checklistItemIds` against the guide's atomic item list and reject/expand parent IDs (TPW-10 → TPW-10.1/.2/.3).
5. **Log vision response text (or a pointer) in the main log** `response received` line — today an auditor grepping the 101 MB main log gets `responseChars` only and must pivot to the sidecar; a `callId` cross-reference field on both main-log lines would make the three stores joinable in one hop.

## File citations

- `/private/tmp/claude-501/-Users-wnavey-noetic/e4e35185-fafe-46a2-a324-6e4d0b91d03c/scratchpad/crc-run-ed5e7ba9/output/consolidated-findings.json` — 291 items x 5 `perRunFindings[].tools_used`
- `…/output/vision-log.jsonl` — 673 results + 3 errors; error lines have no reason field
- `…/output/semantic-search-blocks-log.jsonl` — 482 x (start / hybrid-error / result); sample line refs above
- `…/output/runs/run-1/tool-calls/2026-07-14T17-32-19-834Z-crc_vision_check-204-3vpmoa.json` (failed call, `response.isError: true`) and `…-217-llv1oe.json` (sheet-less retry, success)
- `…/logs/comment-resolution-check-error.log` — 3 x `No plan set version found for plan_set_id: e3412be0-…` (crc-SP-1.md, run-1 x2 + run-4) + 1 structured-output retry exhaustion (crc-SP-3.md run-1)
- `…/logs/comment-resolution-check.log` (101 MB) — `"Calling crc-vision-check"` lines carry full prompt + checklistItemIds + runIndex; `"crc-vision-check response received"` carries usage but not response text; `"Executing script tool"` carries the full semantic-search CLI command
