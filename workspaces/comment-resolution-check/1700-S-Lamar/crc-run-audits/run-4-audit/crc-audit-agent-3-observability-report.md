# CRC Audit — Agent 3 — Tool Usage & Observability Report

- **reviewId**: `1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8`
- **submissionVersionId**: `6b9b85ed-e992-4906-a222-b24ee836910c`
- **Config**: 5 runs × 21 dept guide files = 229 checklist items × 5 = **1,145 item-runs**
- **Run dir**: `/Users/wnavey/noetic/crc-audits/1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8/_run`
- **Sibling TSVs**: `crc-audit-agent-3-tool-usage-current.tsv` (per item-run), `crc-audit-agent-3-tool-usage-running-tally.tsv` (per checklist item, summed across the 5 runs).

---

## 1. Tool-usage headline (current run)

Distinct tool names appearing in `runs/run-*/findings/*.json → tools_used[]` for this run:

| Tool | Total appearances across all 5 runs × 229 items |
|---|---|
| `mcp__conductor_tools__run_semantic_search_blocks` | 264 |
| `crc-vision-check` | 217 |
| `mcp__conductor_tools__crc_vision_check` | 187 |
| `semantic-search-blocks` | 167 |
| `Read` | 160 |
| `Grep` | 46 |
| `Bash` | 3 |

Vision and semantic-search each appear under two synonymous names (the bare tool name and the namespaced MCP form). The TSVs treat both forms as the same logical tool.

Per item-run mix (1,145 item-runs total):

| Bucket | Count | Share |
|---|---:|---:|
| Used **vision** only (no semantic) | 324 | 28.3% |
| Used **semantic-search** only (no vision) | 351 | 30.7% |
| Used **both** vision + semantic | 80 | 7.0% |
| Used **neither** (only Read/Grep/Bash, or none) | 390 | 34.1% |
| **Any vision** | 404 | 35.3% |
| **Any semantic-search** | 431 | 37.6% |

Total tool invocations recorded in `tools_used[]` across all 1,145 item-runs: 1,044 (avg ~0.91 per item-run; many items recorded no tool use at all in the structured-output tools_used list, while still being evaluated).

Raw invocations as seen in the sidecar logs:

- **`vision-log.jsonl`**: 324 entries (309 `crc-vision:result` + 15 `crc-vision:error`)
- **`semantic-search-blocks-log.jsonl`**: 482 paired `start`/`result` events (964 lines = 482 × 2)
- **Main log `tool_use` blocks**: 325 vision invocations (1 rejected by MCP input validation → 324 reaching the sidecar = exact match) and 482 semantic-search invocations (exact match)

The vision tool is sometimes called with a **batched** `checklistItemIds[]` array (up to 11 items in one call) — see the error events: e.g. one call covered `F-1, F-2, F-3, F-5, F-6` for sheet 17. That batching means `tools_used[]` per checklist item can under-count actual vision work that hit the model for that item.

## 2. Historical comparison — explicitly skipped

The `historical_reviews_counted` column in the running-tally TSV is set to `0` for every checklist item. Prior CRC reviews for this submission used different CRC-guide generations (gen 1 / gen 1 / gen 2 vs the current gen 5 guides — see `_run/output/runs/run-1/findings/*.json` skill_version block referenced via the StructuredOutput preamble), so atomic checklist IDs are not comparable across runs. The TSV `notes` column records this reason on every row. No historical numbers were fabricated.

## 3. Do we have logs of the actual prompts sent to each tool?

### Semantic search — **prompts logged, responses logged**

- The sidecar `semantic-search-blocks-log.jsonl` `:start` event captures `query`, `maxResults`, `projectId`, `timestamp`.
- The sidecar `:result` event captures `mode`, `resultCount`, `elapsed_ms`, `timestamp` — **but NOT the returned block IDs/content**. Result content is only in the main log's `tool_result` payload (all 482 invocations are paired there with full result JSON).
- All 482 invocations have a paired prompt and a paired response somewhere in the system, even if not co-located.

20-sample query→result pairs spanning multiple departments (all `mode=hybrid`):

- **crc-TPW** (run-2): `Street Impact Fee building permit ordinance` — maxResults=10 → returned 10 blocks (2536 ms)
- **crc-ATPW** (run-1): `AULCC utility coordination case John Carr Austin Utility Locator Coordination Committee ROW right of way coordination` — maxResults=20 → returned 20 blocks (1030 ms)
- **crc-AD** (run-1): `addressing unit numbering layout coordination reviewer meeting` — maxResults=20 → returned 20 blocks (1398 ms)
- **crc-OWB** (run-1): `water benchmarking dashboard application survey` — maxResults=15 → returned 15 blocks (969 ms)
- **crc-WQ** (run-2): `base impervious redeveloped new impervious cover square footage breakdown` — maxResults=10 → returned 10 blocks (1029 ms)
- **crc-EV** (run-1): `West Bouldin Creek Watershed Urban Watershed Edwards Aquifer Recharge Zone` — maxResults=10 → returned 10 blocks (490 ms)
- **crc-WQ** (run-2): `inlet velocity calculations maximum velocity two feet per second water quality basin` — maxResults=10 → returned 10 blocks (1121 ms)
- **crc-WQ** (run-2): `certification compliance closed municipal solid waste landfill` — maxResults=10 → returned 10 blocks (1230 ms)
- **crc-WQ** (run-2): `green stormwater control measures ordinance november 2022` — maxResults=10 → returned 10 blocks (681 ms)
- **crc-IW** (run-2): `wastewater cleanout 506-AW-04 large diameter sampling port` — maxResults=20 → returned 20 blocks (1006 ms)
- **crc-EV** (run-2): `West Bouldin Creek Watershed Urban Watershed classified` — maxResults=10 → returned 10 blocks (531 ms)
- **crc-EV** (run-2): `Edwards Aquifer Recharge Zone not located` — maxResults=10 → returned 10 blocks (854 ms)
- **crc-EV** (run-2): `Q1 Q2 tables impervious cover` — maxResults=10 → returned 10 blocks (1005 ms)
- **crc-F** (run-1): `median section profile fire lane entrance South Lamar Boulevard` — maxResults=10 → returned 10 blocks (576 ms)
- **crc-TPW** (run-1): `Street Impact Fee adopted December 2020 applicable June 22 2022` — maxResults=10 → returned 10 blocks (475 ms)
- **crc-PR** (run-2): `parkland dedication to be deeded to the city of austin` — maxResults=20 → returned 20 blocks (497 ms)
- **crc-AWRR** (run-2): `onsite water reuse system OWRS components treatment recycling` — maxResults=20 → returned 20 blocks (535 ms)
- **crc-PR** (run-2): `parkland dedication table CWQZ critical water quality zone conditions of encumbrance` — maxResults=15 → returned 15 blocks (540 ms)
- **crc-PR** (run-2): `parkland fee in lieu certificate of occupancy restrictive covenant deed` — maxResults=15 → returned 15 blocks (463 ms)
- **crc-OWB** (run-2): `water benchmarking application dashboard survey` — maxResults=15 → returned 15 blocks (496 ms)

**Mapping method**: pulled all 482 assistant `tool_use` blocks for `mcp__conductor_tools__run_semantic_search_blocks` from the main pino log (each carries `item` = guide filename and `runIndex`), then paired with sidecar `:start` events by ordinal index of the query string in invocation order. Result counts came from the matching sidecar `:result` event. Departments shown above were drawn from 9 distinct guides (TPW, ATPW, AD, OWB, WQ, EV, IW, F, PR, AWRR) for diversity. Per-item correlation is approximate: the sidecar carries no `checklistItemId`, only `query` text + ordering (see §6).

### Vision — **prompt logged, response logged, but in DIFFERENT places**

- **Prompt**: the main log captures every `mcp__conductor_tools__crc_vision_check` invocation as an `assistant.tool_use` block whose `input` carries `prompt` (the full rendered text the model was asked), `checklistItemIds[]`, `documentId`, `sheetNum`, and `referenceImages[]` (path + description). 325/325 invocations have the `prompt` field. The sidecar `vision-log.jsonl` does **NOT** record the prompt at all.
- **Response (model output text)**: the sidecar `:result` events record `responseText` (full model reply), `model` (`google/gemini-3.1-pro-preview`), `usage` (`inputTokens`, `outputTokens`, `totalTokens`, `reasoningTokens`), `elapsedMs`, `checklistItemIds[]`, `documentId`, `sheetNum`, `paths`. The main log's MCP `tool_result` for these calls is, in practice, mostly empty/elided — only 1 of 325 paired tool_results survives in the main log (the one rejected by MCP input-validation with `Expected number, received string` on `sheetNum`), so the sidecar `responseText` is the **only** authoritative record of what the vision model said.

**Bottom line**: vision is fully observable but only by joining `main-log.tool_use.input.prompt` ↔ `vision-log.responseText` on `checklistItemIds + documentId + sheetNum + ordering`. There is no single file containing both halves. If `vision-log.jsonl` were lost, every vision-driven pass/fail in this run becomes unauditable — the agent's `observation` text references the vision call but the raw model judgement is gone.

## 4. Errors

- **Vision failures**: 15 (5% of 324 sidecar events; 4.6% of 325 main-log invocations).
- **Error coverage**:
  - The dedicated error log `_run/logs/comment-resolution-check-error.log` has **15 entries**, each with the real reason: `crc-vision-check: failed to load primary file 908ffab5-9bf8-4155-b9f7-b3c3be0663ff (sheet: N)` and `err: DB error fetching plan_set_version: TypeError: fetch failed`. All 15 errors share the same root cause: transient Supabase fetch failures (`TypeError: fetch failed`) when retrieving the plan-set-version primary file.
  - The sidecar `crc-vision:error` events log `success:false` plus `checklistItemIds, documentId, sheetNum, paths, referenceImagesCount, referenceImagesSkipped` — but **no error reason, no stack, no HTTP status**. The sidecar alone is insufficient to diagnose a vision failure.
- **Affected checklist items** (from error events): AW-RL-1 (×3), IW-1 (×3), PR-5+PR-7 (batched ×2), PB-2 and PB-1+PB-2, F-1/F-2/F-3/F-5/F-6 (batched), CM-10/CM-12/CM-13 (batched), AD-2, SP-23+SP-24, AW-2. Eight distinct sheets (1, 3, 6, 13, 14, 17, 18, 19, 43) all on documentId `908ffab5-...` — pattern is consistent with a transient Supabase/database outage during a ~80s window (timestamps cluster between 1782491933 and 1782492015).
- **One additional vision invocation never reached the MCP/sidecar** at all: an `assistant.tool_use` with `sheetNum` as a string was rejected by Zod input validation (`Expected number, received string`). That call burned model tokens but produced no sidecar record. Tally: 325 invocations attempted, 324 reached MCP, 309 succeeded.

## 5. Traceability — does any log tie a tool call to a specific `checklistItemId`?

| Tool | Sidecar log carries checklistItemId? | Main pino log carries checklistItemId? |
|---|---|---|
| `crc_vision_check` | **YES** — every event has `checklistItemIds[]` (often 1, sometimes batched up to 11) | YES — `tool_use.input.checklistItemIds[]` |
| `run_semantic_search_blocks` | **NO** — sidecar has only `query`, `maxResults`, `projectId`, `timestamp`. Verified: 0 of 1,928 sidecar lines carry `checklistItemId` or `checklistItemIds`. | Partial — the `item` field is the guide filename (department-level, e.g. `crc-AD.md`), not the atomic checklist item. The agent loop processes all items in one session per guide, so a semantic search inside that session cannot be deterministically attributed to a single `checklistItemId` from the log alone. |

Net: **vision is traceable to checklist items; semantic-search is only traceable to the department/guide.**

## 6. Observability improvement proposals (ranked)

1. **Log vision prompt AND response together in one record, keyed by checklistItemId+run.** Extend `vision-log.jsonl` so each `:start` event captures the rendered `prompt`, `referenceImages` paths/descriptions, and a generated `callId`. The `:result`/`:error` event already carries `responseText`/`success`; just add the same `callId` plus a `runIndex` (`run-1..run-5`) and the agent's `tool_use_id`. Net effect: a single grep on `vision-log.jsonl` reproduces the full prompt + response + tokens + latency + reason for any individual call. **This is the top fix** — today the prompt-half lives only in a 12k-line pino log that has to be JSON-parsed line by line and joined manually.

2. **Capture the actual error reason in the vision sidecar.** Today, `crc-vision:error` events only set `success:false` and the diagnostic message lives in a separate pino error log. Add `errorMessage`, `errorCode`, and `errorKind` (e.g. `"db_fetch_failed"`, `"input_validation"`, `"model_timeout"`) directly in the sidecar `:error` event. Also log the 1 input-validation rejection (`sheetNum` type) — it never made it to the sidecar at all and would have been invisible without parsing the main pino log.

3. **Tie semantic-search invocations to specific checklist items.** Pass the active `checklistItemId` (or `checklistItemIds[]` when batched) down through the MCP wrapper for `run_semantic_search_blocks` and emit it in both `:start` and `:result` events alongside `runIndex` and `callId`. The conductor harness already has `item` and `runIndex` on every pino line; threading `checklistItemId` into the MCP call requires either adding it to the tool's input schema or having the wrapper sniff the current agent context. Today 482 semantic calls can only be coarse-attributed to a 21-guide department, not to the 229-item checklist.

4. **Unify into a single per-tool-call ledger**. Add `_run/output/tool-calls.jsonl` (one row per tool invocation across all tools), schema: `{callId, runIndex, item (guide), checklistItemId(s), tool, startedAt, endedAt, latencyMs, model?, usage?, inputDigest, fullInput, fullOutput, success, errorMessage?}`. Replace the current scattered `vision-log.jsonl` + `semantic-search-blocks-log.jsonl` + main-log archaeology with one file that any downstream auditor (this report, atomic-accuracy scoring, vote-variance) can scan. Hash large blobs (referenceImages bytes) but store the prompt text inline — it's small relative to the model bills.

5. **Persist the agent's reported `tools_used[]` audit trail authoritatively.** The agent's StructuredOutput `tools_used[]` is the only source today for the per-checklist-item tool attribution in `crc-audit-agent-3-tool-usage-*.tsv`, but it's self-reported by the model — there is no automatic check that the agent listed every tool it actually called. The unified ledger above would let us reconcile model-claimed vs ledger-observed tool sets per item.

6. **Make `referenceImages` recoverable.** The main log records the `path` (e.g. `figures/AW-RL-1/1.png`) and `description`, but not the bytes. If the `figures/` folder is rotated or deleted, the prompt becomes uninterpretable. Either include a content hash in the log or copy the images into `_run/output/vision-references/<callId>/` at call time.

---

## File inventory written by this audit

- `crc-audit-agent-3-tool-usage-current.tsv` — 1,146 lines (header + 1,145 item-runs)
- `crc-audit-agent-3-tool-usage-running-tally.tsv` — 230 lines (header + 229 checklist items)
- `crc-audit-agent-3-observability-report.md` — this file
