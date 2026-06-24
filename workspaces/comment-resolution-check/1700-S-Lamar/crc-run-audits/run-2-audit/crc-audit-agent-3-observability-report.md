# CRC Audit — Agent 3: Tool Usage & Observability Report

**Run audited:** reviewId `3703349c-ac08-44b8-8c10-2100adb89f5b` (CRC, completed 2026-06-23)
**Submission version (U1):** `6b9b85ed-e992-4906-a222-b24ee836910c`
**Config:** 3 runs × 16 departments; 205 checklist items (193 surfaced in any single run; union across the 3 runs = 205).
**Scope:** tool usage attribution (vision / semantic-search / other) per checklist item per run, plus an observability assessment of whether the prompts the agent sent to each tool are captured. (Vote variance and end-to-end timing are out of scope — owned by other audit agents.)

---

## 1. Headline tool-usage numbers

Source of truth for per-item-per-run tool attribution: the per-run findings files
`output/runs/run-{1,2,3}/findings/<dept>.md.json` → `findings[].tools_used[]`.
**Note:** the `consolidated-findings.json` `perRunFindings[]` objects do **not** carry a `tools_used` field (0 of 579), so attribution had to come from the run findings files. Tool names appear in three un-normalized forms each and were normalized:

| Normalized | Raw variants seen in run files |
|---|---|
| `crc-vision-check` | `crc-vision-check`, `crc_vision_check`, `mcp__conductor_tools__crc_vision_check` |
| `semantic-search-blocks` | `semantic-search-blocks`, `run_semantic_search_blocks`, `mcp__conductor_tools__run_semantic_search_blocks` |
| other | `Grep`, `Read` |

### Per item-run (579 rows = 193 × 3 runs)

| Bucket | Item-runs | % |
|---|---:|---:|
| Vision only | 121 | 20.9% |
| Semantic-search only | 152 | 26.3% |
| Both | 56 | 9.7% |
| Neither (no tool) | 250 | 43.2% |
| **Used vision (any)** | **177** | 30.6% |
| **Used semantic-search (any)** | **208** | 35.9% |
| Used another tool (Grep/Read) | 11 | 1.9% |

"Other tool" rows are all in run-1 (Grep, in `crc-ev`) and run-2/3 (Read, in `crc-tpw`/`crc-iw`/`crc-owb`). One row (`IW-1.1` run-3) used Read+Grep+vision; one (`EV-*` run-1) paired Grep with semantic-search.

### Per checklist item, aggregated across the 3 runs (205 items)

| Bucket (item used the tool in ≥1 run) | Items |
|---|---:|
| Vision in ≥1 run only | 37 |
| Semantic-search in ≥1 run only | 53 |
| Both tools across runs | 59 |
| Neither tool in any run | 56 |

The "neither in any run" set (56 items) is notable: roughly a quarter of checklist items were resolved by the agent from text context alone, never invoking a verification tool across all three runs.

---

## 2. Observability verdict — do we have the prompts the agent sent to each tool?

| Tool | Prompt logged? | Response logged? | Where |
|---|---|---|---|
| **semantic-search-blocks** | **YES** | partial (count/mode/latency, not block bodies) | `semantic-search-blocks-log.jsonl` (`query` field) + main pino log |
| **crc-vision-check** | **YES — but only in the main pino log, NOT in the dedicated JSONL** | **NO** — no response text, tokens, or latency anywhere | prompt in `comment-resolution-check.log` "Calling crc-vision-check"; the dedicated `vision-log.jsonl` has only document/sheet metadata |

This is an important correction to the working assumption. The dedicated `vision-log.jsonl` does **not** log the prompt or response (verified: its key union is exactly `documentId, event, paths, referenceImagesCount, referenceImagesSkipped, sheetNum, success, timestamp`; grep for `prompt|response|text|tokens|usage|latency` → 0 hits). **However**, the main workflow log (`logs/comment-resolution-check.log`, pino JSON) DOES log the full rendered vision prompt on every "Calling crc-vision-check" line (182 of them), each tagged with `item` (department), `runIndex`, `documentId`, `sheetNum`, and reference-image counts. What is missing everywhere is the **model's response text** and any **token/latency** data for vision.

### 2a. Semantic-search — confirmed, quantified, sampled

- **232** `semantic-search-blocks:start` events, each with a `query` (the prompt) + `maxResults` + `projectId`; **232** matching `:result` events with `resultCount`, `mode`, `elapsed_ms`.
- All 232 are mode `hybrid`. resultCount: min 1, max 20, mean 11.5, **0 zero-result queries**. Latency: min 430 ms, max 2283 ms, mean ~678 ms.
- **Full query→item correlation is achievable** by joining to the main log's "Executing script tool" lines (232 of them, all `run_semantic_search_blocks`), which carry `item` + `runIndex` and embed the query in the `--query='…'` command. The main-log query and the JSONL `query` match **232/232 by order**, so the two logs are reliably alignable.

#### Sample of 20 semantic-search query→result pairs (spread across all 16 departments)

| Dept | Run | maxResults | Returned | Latency | Query |
|---|---|---:|---:|---:|---|
| crc-aw-redlines | run-1 | 20 | 20 | 553 ms | Austin Water standard detail adopted municode |
| crc-aw | run-2 | 15 | 15 | 482 ms | Wendlandt Subdivision Lot 3 recorded plat land status |
| crc-awrr | run-2 | 20 | 20 | 595 ms | OWRS overflow air gap storm drain connection |
| crc-ca | run-2 | 10 | 10 | 527 ms | ECM 3.6.2 tree protection standard plan note appendix P-2 |
| crc-cm | run-1 | 10 | 10 | 591 ms | applicant agent Libby Linton authorized representative |
| crc-de | run-1 | 10 | 10 | 609 ms | changes to drainage design since last update engineering report revised |
| crc-ev | run-1 | 10 | 10 | 1183 ms | West Bouldin Creek Watershed Urban Watershed Edwards Aquifer Recharge Zone |
| crc-f | run-2 | 10 | 10 | 528 ms | fire lane turnaround 25 feet wide 14 feet vertical clearance |
| crc-iw | run-2 | 20 | 20 | 649 ms | Standard Detail 506-AW-04 large diameter cleanout wastewater |
| crc-lde | run-3 | 15 | 15 | 480 ms | curb inlet Collier Street driveway 10 feet clearance dimension |
| crc-owb | run-3 | 20 | 20 | 2283 ms | OWRS on-site water reuse system irrigated landscaped area water balance |
| crc-pb | run-1 | 15 | 15 | 985 ms | private domestic water piping material specification copper PEX HDPE |
| crc-pr | run-2 | 20 | 20 | 963 ms | parkland dedication to the City of Austin |
| crc-sp | run-2 | 10 | 10 | 576 ms | legal description book page document number metes bounds subdivision |
| crc-tpw | run-1 | 15 | 15 | 624 ms | S. Lamar right-of-way dedication ROW centerline 58 feet ASMP 116 |
| crc-wq | run-1 | 20 | 20 | 724 ms | base impervious cover redeveloped new impervious cover shading labeling ECM 1.9.2 |
| crc-aw-redlines | run-3 | 20 | 20 | 545 ms | Austin Water standard detail |
| crc-aw | run-1 | 10 | 10 | 471 ms | Wendlandt Subdivision Lot 3 parcel 0100050216 1401 Collier |
| crc-awrr | run-2 | 10 | 10 | 559 ms | air gap graywater sanitary sewer overflow connection indoor cistern |
| crc-ca | run-3 | 10 | 10 | 704 ms | species diversity Appendix F significant shade provider table 75 percent Bur Oak Live Oak Pecan Elm replacement trees |

**Mapping method:** queries pulled from `semantic-search-blocks-log.jsonl` (`:start` for query/maxResults, `:result` for resultCount/mode/elapsed_ms), and tied to a department + run by positional join with the main log's "Executing script tool" lines (start[i] ↔ result[i] ↔ exec-script[i], query-matched 232/232). The result events log only an aggregate `resultCount` — **the returned block IDs / bodies are not in this JSONL** (see gap G3 below), so "Returned" reflects count, not content.

### 2b. Vision — prompt present (main log), response absent everywhere

- The vision prompt is rich and item-specific. Example (item `crc-lde`, run-1, sheet 18): a structured, multi-point prompt asking the model to locate a 10-ft curb inlet and driveway radius on Collier St and confirm ≥10 ft clearance, quoting the exact requirement text. So the *input* is fully auditable from the main log.
- **No response is captured.** The "crc-vision-check response received" line (169 of them) contains only `item, runIndex, documentId, sheetNum, referenceImagesLoaded/Skipped` — there is no `response`, `text`, `result`, `tokens`, `usage`, or `latency` field. The model's actual answer (which directly drives the pass/fail finding) is **not recoverable from any log**. It survives only indirectly as the `observation`/`reasoning` text the agent later wrote into the findings JSON.
- `vision-log.jsonl` is strictly a coarse success/metadata sidecar; it is redundant with — and poorer than — the main-log vision lines, except that it is structured/parseable in isolation.

---

## 3. The 13 vision errors — 0 captured error reasons (observability gap)

`vision-log.jsonl` records 13 `crc-vision:error` events, all with `success:false` and **no error message field** — the JSONL gives you the failure count but not the cause. The cause is only reconstructable by cross-referencing the main pino log, where the 13 errors resolve to **two distinct failure modes**:

| Cause (from main log) | Count | Detail |
|---|---:|---|
| `failed to load primary file` with documentId literal **`primary-site-plan`** | 11 | An **unresolved placeholder** — the literal string `primary-site-plan` was passed where a document UUID was expected, so the file never loaded and the model was never called. Sheets 1 (×3), 18 (×3), 24 (×2), 3, 13, 25. |
| `failed to load primary file` with real documentId `908ffab5…` (sheet 18) | 1 | Primary file failed to load for a valid document/sheet. |
| `error running vision AI call` — `GatewayResponseError` (sheet 15, doc `908ffab5…`, crc-sp run-3) | 1 | "Gateway request failed: Cannot connect to API: other side closed." A genuine upstream/model-gateway connectivity failure. |

The 11 `primary-site-plan` failures are the more interesting signal: they look like a **document-resolution bug** (placeholder not substituted) rather than transient infrastructure — worth a follow-up by the workflow owners. None of this is visible from the structured JSONL alone.

---

## 4. Can a specific tool call be tied to a specific checklist item + run?

**Partially today; cleanly with one change.**

- **Department + run:** YES, today, for both tools — both the vision "Calling" lines and the semantic "Executing script tool" lines carry `item` (= department file, e.g. `crc-lde.md`) and `runIndex`. The dedicated JSONL sidecars (`vision-log.jsonl`, `semantic-search-blocks-log.jsonl`) do **not** carry `item`/`runIndex`, so they can only be tied to a department by positional/timestamp join with the main log.
- **Exact checklist item (e.g. `LDE-1.1`):** NO from any log. The logs resolve only to the department file, not the atomic checklist item within it. `checklistItemId` is `null` on every vision and script-tool log line. Multiple items in a department issue multiple tool calls, and there is no field linking a given call to the item that triggered it. (It is partly inferable from prompt text — the LDE prompt quotes the requirement — but that is fragile.)
- The `vision-log.jsonl` and `semantic-search-blocks-log.jsonl` sidecars carry **no `item`, `runIndex`, or `checklistItemId`** at all, so in isolation they cannot be attributed beyond a timestamp.

---

## 5. Historical tool attribution for this submission version (Supabase)

There are **2** CRC reviews for submission version `6b9b85ed-…` in Supabase (`reviews` table):

| reviewId | created | role |
|---|---|---|
| `7e79e197-8922-4c18-8a94-bc6d43218362` | 2026-06-19 | **historical** |
| `3703349c-…` (this audit) | 2026-06-23 | current |

**Tool attribution IS stored** for the historical run — in `review_comments.agent_trace->'tools_used'` (the `review_comments` table has no dedicated tools column; attribution lives in the `agent_trace` jsonb, keyed alongside a `vision` sub-object). The checklist item is in `output_json->'crc'->>'atomicItemId'`.

**Finding:** the historical review has 183 comments and **every single one is stamped `tools_used: ["vision"]`** — 183/183 vision, 0 semantic-search, 0 with no tools, exactly 1 comment per item. This uniform stamp strongly suggests the historical run used a **blanket/default attribution** (every comment tagged "vision" regardless of what was actually called) rather than the per-comment differentiated tracking the current run produces. So historical tool data exists and is queryable, but its fidelity is low and not directly comparable to the current run's per-item-per-run attribution. The running-tally TSV records `historical_reviews_counted=1` for the 183 items that appeared in the historical review (all stamped vision) and `0` for the 22 items that had no historical comment, with the caveat noted per-row.

---

## 6. Observability improvement proposals (concrete)

**P1 — Capture the vision model's response + usage + latency (highest priority).**
The single biggest gap: the vision answer that drives every pass/fail is never logged. On the existing "crc-vision-check response received" line (and in `vision-log.jsonl`), add: `responseText` (the model's raw answer, or a length-capped prefix), `inputTokens`/`outputTokens`, `latencyMs`, and `model`/`modelId`. Without this, a wrong vision call is undebuggable after the fact.

**P2 — Add `checklistItemId` (and keep `item`+`runIndex`) to every tool-call log line and to both JSONL sidecars.**
Today calls resolve only to a department. Stamp the atomic item id on: the vision "Calling"/"response received" lines, the "Executing script tool" line, and every record in `vision-log.jsonl` and `semantic-search-blocks-log.jsonl`. This makes per-item-per-run attribution a direct lookup instead of a fragile positional/timestamp join.

**P3 — Introduce one unified per-tool-call JSONL, keyed by item+run.**
Replace/augment the two disjoint sidecars with a single `tool-calls.jsonl`, one record per call, shape:
```json
{"ts":1782247564836,"reviewId":"3703349c-…","runIndex":"run-1",
 "department":"crc-lde","checklistItemId":"LDE-1.1","tool":"crc-vision-check",
 "input":{"documentId":"908ffab5-…","sheetNum":18,"prompt":"<rendered prompt>",
          "referenceImagesLoaded":0},
 "output":{"success":true,"responseText":"<model answer>","resultCount":null},
 "usage":{"inputTokens":…,"outputTokens":…},"latencyMs":1840,"error":null}
```
For semantic-search the same record carries `input.query`, `input.maxResults`, `output.resultCount`, and `output.blockIds` (see P4). One file, one schema, trivially joinable to findings and to votes.

**P4 — Log semantic-search result identities, not just a count.**
The `:result` event currently logs only `resultCount`. Add `blockIds` (and optionally truncated snippets/scores) so the actual evidence the agent retrieved is auditable — right now we can see what was asked but not what came back.

**P5 — Capture an explicit error reason on every failed tool call.**
The 13 vision errors log `success:false` with no cause; the cause only exists, partially, in the main log. Add an `errorType` + `errorMessage` to the failure record (e.g. `documentResolutionError: "primary-site-plan" unresolved` vs `GatewayResponseError`). This would have immediately surfaced the 11 `primary-site-plan` placeholder failures as a code bug rather than noise.

**P6 — Fix per-comment tool attribution on the persisted record (and backfill semantics).**
The current run produces genuine per-item tool sets in the findings files, but the historical persisted review stamped a uniform `["vision"]`. Ensure the attribution written to `review_comments` (`agent_trace`/`output_json`) is the real per-comment tool set from the run findings, and store it in a first-class `tools_used` column rather than buried in `agent_trace` jsonb, so cross-run tool comparisons are queryable without jsonb spelunking.

---

## 7. Data limitations / caveats

- `consolidated-findings.json` `perRunFindings[]` lacks `tools_used`; all per-item-per-run attribution comes from `output/runs/run-*/findings/*.json`. Each checklist item is unique within a run file; 193 items appear per run, 205 across the union (12 SP/TPW items surfaced only in run-2).
- "Used vision/semantic = TRUE/FALSE" is membership of the normalized tool in that item-run's `tools_used` array; the array does not record *how many times* a tool was called within an item-run, so item-run counts (177 vision item-runs, 208 semantic item-runs) are lower than raw call counts in the logs (182 vision calls, 232 semantic calls). The running-tally `total_invocations_current_run` is the sum over the 3 runs of distinct tool-types per run (max 2 per run here), not raw call count.
- Vision response text and token/latency data are unavailable in any artifact for this run; they cannot be reconstructed.
- Historical (`7e79e197`) tool data is present but uniform-`vision` only, so it is reported as `historical_reviews_counted=1` per item with a fidelity caveat — not fabricated, but not trustworthy as per-tool ground truth.

---

## Output files
- `crc-audit-agent-3-tool-usage-current.tsv` — 579 rows, per checklist item × run.
- `crc-audit-agent-3-tool-usage-running-tally.tsv` — 205 rows, per item aggregated across the 3 current runs + historical column.
- `crc-audit-agent-3-observability-report.md` — this report.
