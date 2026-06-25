# CRC Audit Agent 3 — Tool Usage & Observability Report

- **reviewId:** `a8d07d22-19e6-4a1f-a12d-a4371c1dbd19`
- **submissionVersionId:** `6b9b85ed-e992-4906-a222-b24ee836910c` (Lamar + Collier v4)
- **Config:** 5 runs × 22 guide files (16 departments, with splits crc-sp-{1..4}, crc-de-{1,2}, crc-ca-{1,2}, crc-tpw-{1,2})
- **Per-run item counts (only items that appeared in that run):**
  run-1=227, run-2=223 (crc-cm: 0), run-3=224 (crc-iw: 0), run-4=223 (crc-awrr: 0), run-5=234 (crc-ca-1: 27)
- **Total item-run rows in TSV:** 1,131

---

## 1. Tool-usage headline (current run)

| Bucket | item-runs | % |
|---|---:|---:|
| Used **vision** (any variant) | 445 | 39.3% |
| Used **semantic-search** (any variant) | 396 | 35.0% |
| Used **both** vision + semantic-search in same item-run | 90 | 8.0% |
| Used **only** other tools (Read/Grep/Bash) | 31 | 2.7% |
| Used **no tools at all** (`tools_used:[]`) | 349 | 30.9% |

Aggregate invocation totals across the 5 runs (from `tools_used[]` arrays):
- Vision invocations: **445**
- Semantic-search invocations: **396**
- Other-tool invocations: Read=82, Grep=12, Bash=2 (96 total)

Per-file (department) breakdown — see `crc-audit-agent-3-tool-usage-running-tally.tsv` (1 row per item, 235 rows).

### Tool-name variants observed
The pipeline emits **three names for vision** and **four for semantic-search** depending on whether the agent SDK records the MCP name, the registered tool name, or a script alias. Normalized in both TSVs:

- **vision** = `crc-vision-check` (249), `mcp__conductor_tools__crc_vision_check` (186), `crc_vision_check` (10)
- **semantic-search** = `mcp__conductor_tools__run_semantic_search_blocks` (211), `semantic-search-blocks` (161), `run_semantic_search_blocks` (16), `run-semantic-search-blocks` (8)
- **other** = `Read` (82), `Grep` (12), `Bash` (2)

The three-way variance for *the same tool* is itself an observability finding — see Recommendation #3.

### Historical-comparison decision (per task brief)
**Excluded.** Both prior CRC reviews of this submission version (`3703349c-…` and `7e79e197-…`) ran under `crcGenerationNumber=1`; the current run is `crcGenerationNumber=2`. Item `ref`s are not stable across generations, so any aggregation would be apples-to-oranges. All rows in the running-tally TSV carry `historical_reviews_counted=0` and note `EXCLUDED — gen mismatch`.

---

## 2. Are we logging the actual prompts the agent sends to each tool?

**Yes for both vision and semantic-search — but in two different places, with two different gaps.**

### 2.1 Semantic-search (`run_semantic_search_blocks`)

Three log sources carry pieces of the same call:

| Source | Prompt logged? | Response logged? | Item / run tag? |
|---|---|---|---|
| Sidecar `semantic-search-blocks-log.jsonl` | **Yes** — `query`, `maxResults`, `projectId` on the `:start` event | **No** — only `resultCount`, `elapsed_ms`, `mode` on `:result` (618/618 pairs, 6,843 total blocks returned) | **No** |
| Main pino log, `msg:"Executing script tool"` | **Yes** — the full CLI command including `--query='…'` and `--maxResults='…'` | No | **Yes** — `item` (file) + `runIndex` |
| Main pino log, `message.content[].type=="tool_use"` (assistant turn) + matching `tool_result` (user turn) | **Yes** — `input.args.query` / `input.args.maxResults` | **Yes** — full JSON results array (sheet/blockId/description/contentPreview/relevance) embedded in `tool_result.content[0].text` | **Yes** — `item` + `runIndex` on each line; tool_use_id ties request↔response |

So semantic-search has **full prompt+response capture**, but only by stitching together the main pino log via `tool_use_id`. The standalone sidecar `semantic-search-blocks.jsonl` is half a picture — it tells you what was asked but not what came back, and it has no checklist context at all.

There is also `output/semantic-search-blocks.json` (singular, not `.jsonl`), which contains a **single** query+results object — clearly the last call's scratch output, not a persistent log. Misleading filename.

#### Sample — 22 query→result pairs (one per checklist file, picked from the main log)

| Item file | Run | maxResults | resultCount | Query | Unique result sheets |
|---|---|---:|---:|---|---|
| crc-aw-redlines.md | run-1 | 20 | 20 | existing water meter callout meter number 63325038 63255523 63205449 contractor to verify | 6,7,8,9,19,20,34 |
| crc-aw.md | run-1 | 20 | 20 | land status determination letter report recorded plat final plat | 1,2,3,7,13,14,15,19,20,21,23,36,47 |
| crc-awrr.md | run-1 | 10 | 10 | Fire Domestic Irrigation Demand Data Table peak flow GPM | 6,7,23,24,26,30 |
| crc-ca-1.md | run-1 | 15 | 15 | Heritage Tree 5001 transplant feasibility arborist report condition suitability excavation root ball stabilization transport storage remedial care | 8,9,31,44,45,46,47,52,54 |
| crc-ca-2.md | run-1 | 20 | 20 | tree mitigation chart surveyed removed DDI UFRF mitigation line items | 8,9,10,13,19,24,31,44,45,46,47 |
| crc-cm.md | run-2 | 20 | 20 | batch stamp space blank area lower right corner for city stamping permitting | 1,3,6,7,13,32,33,36,49,54 |
| crc-de-1.md | run-2 | 15 | 15 | DCM 4.4.3 inlet flow calculation table carry-over flow ponded width La effective length 18-column | 23,24,26,28,30 |
| crc-de-2.md | run-2 | 10 | 10 | drawdown time 24 hours detention pond emptying calculation routing hydrograph | 23,24,29,30 |
| crc-ev.md | run-1 | 10 | 10 | Q1 Q2 tables net site area impervious cover calculation | 12,23,24,26,30 |
| crc-f.md | run-2 | 10 | 10 | fire flow calculations required fire flow gpm building fire area | 1,6,7,23,24,30,34 |
| crc-iw.md | run-2 | 20 | 20 | Standard Detail 506-AW-04 large diameter cleanout wastewater | 19,20,28,29,35,36 |
| crc-lde.md | run-1 | 15 | 15 | curb inlet Collier Street driveway radius offset 10 feet | 10,28,32,33,36,46,49 |
| crc-owb.md | run-2 | 15 | 15 | OWB benchmarking application water use gross floor area building coverage irrigated landscape | 6,7,12,19,20,23,24,26,30 |
| crc-pb.md | run-2 | 20 | 20 | private wastewater sanitary sewer piping routing lot line property boundary easement | 10,17,19,20,28,32,34,35 |
| crc-pr.md | run-1 | 20 | 20 | parkland dedication City of Austin deeded park | 1,2,3,6,7,12,18,32,33,44 |
| crc-sp-1.md | run-1 | 10 | 10 | legal description lot block subdivision metes bounds book page document number | 2,3,7,13,15,36,47 |
| crc-sp-2.md | run-1 | 10 | 10 | Planting Zone Clear Zone Supplemental Zone sidewalk Subchapter E Core Transit Corridor | 13,14,24,31,44,45,52 |
| crc-sp-3.md | run-2 | 5 | 5 | sheet index listing all sheets in the plan set | 1,8,14,44 |
| crc-sp-4.md | run-2 | 10 | **2** | adjacent use west religious assembly church office | 16,37 |
| crc-tpw-1.md | run-1 | 10 | 10 | Street Impact Fee building permit ordinance | 1,6,13,31,32,36 |
| crc-tpw-2.md | run-2 | 20 | 20 | long-term bicycle parking covered rack detail | 13,14,16,33,36,39,40,41,42,43 |
| crc-wq.md | run-2 | 10 | 10 | green stormwater infrastructure biofiltration retention irrigation waiver exception | 6,27,28,29,30,31,44,52 |

Source of mapping: each row was selected by walking the main pino log and pulling the first `tool_use` of `mcp__conductor_tools__run_semantic_search_blocks` for each distinct `item` value. The matching `tool_result` is identified by `tool_use_id`; `resultCount` and unique `sheetNumber` values are parsed from its full JSON payload. Method script: `/tmp/sample-ss-queries.py`.

Notable: `crc-sp-4.md` asked `maxResults=10` and got only `resultCount=2` — the corpus produced few hits for "adjacent use west religious assembly church office". This kind of under-recall is invisible from the sidecar JSONL alone (you'd see `resultCount=2` but have no way to know whether `2` is "the right answer" or "a thin search" without seeing the query).

### 2.2 Vision (`crc-vision-check`)

| Source | Prompt logged? | Response logged? | Item / run tag? |
|---|---|---|---|
| Sidecar `vision-log.jsonl` (514 events: 460 result, 54 error) | **No** — only `documentId`, `sheetNum`, `referenceImagesCount/Skipped`, `paths`, `success`, `timestamp` | **No** — no model output text, no token counts, no latency | **No** |
| Main pino log, `msg:"Calling crc-vision-check: …"` | **Yes** — full `prompt` text + `documentId` + `sheetNum` + reference-image metadata | No | **Yes** — `item` (file) + `runIndex` |
| Main pino log, `msg:"crc-vision-check response received"` | No | **No** — explicit "response received" line carries `documentId`/`sheetNum` but **no text** | Yes |
| Main pino log, `message.content[].type=="tool_use"` (assistant turn) + matching `tool_result` (user turn) | **Yes** — `input.documentId`, `input.sheetNum`, `input.prompt` | **Yes** — full vision-model response text in `tool_result.content[0].text` (verified by spot-check, e.g. `toolu_01SRGnsDEynoLehKGPPxtzU5` returned a 700-word storm-drain analysis) | **Yes** |

**The vision-model response text is preserved — just only in the agent-message stream of the main pino log, not in any structured sidecar.** That is good (we *do* have the evidence behind every pass/fail) but fragile:

- It's mixed in with 18,028 lines of pino JSON, most of them unrelated. There is no per-tool-call JSONL keyed by `(checklistItemId, run)` you can grep.
- The `msg:"crc-vision-check response received"` sidecar event is misleadingly named — it logs *that* a response arrived, not *what* the response said. Easy to mistake for a response capture and stop looking.
- Token counts, model name, and latency for the *vision* call (vs. the agent call) are not surfaced in either place. They live inside `generateText` in `src/tools/crc-vision-check/index.ts` and are dropped.

### 2.3 Traceability — can any tool call be tied to a specific `checklistItemId`?

**No.** Every per-tool-call log line — sidecar or main — carries at most `item` (the guide file, e.g. `crc-sp-2.md`) and `runIndex`. The atomic `checklistItemId` (e.g. `SP-2.13`) the agent is currently working on is **never** in the log line itself. We only know which checklist items existed by reading the final per-run findings file.

For a file like `crc-sp-2.md` with 19 checklist items and 50 vision calls + 50 semantic-search calls in one run, today there is no way to answer "which checklist item caused this specific vision call?" except by inferring from the prompt content.

That's the single biggest observability hole for this run.

---

## 3. Errors — cross-referencing the sidecar vs. the main log

The sidecar `vision-log.jsonl` reports **54 `crc-vision:error`** entries:
- 35 with `documentId=primary-site-plan`
- 19 with `documentId=908ffab5-9bf8-4155-b9f7-b3c3be0663ff`

Cross-referencing the main pino log, the **real** root causes are:

| Root cause | Count | Behavior |
|---|---:|---|
| `DB error fetching plan_set_version: invalid input syntax for type uuid: "primary-site-plan"` | **24** | The literal string `primary-site-plan` is being passed where a UUID is expected. **The agent never substituted the placeholder for the real document UUID.** |
| `DB error fetching plan_set_version: TypeError: fetch failed` | **27** | Transient Supabase fetch failure (different sheets, multiple departments, clustered around ts ≈ 1782386104964). Real network/Supabase blip during the run. |
| `DB error fetching sheet_version: TypeError: fetch failed` | **1** | Same transient class. |
| `crc-vision-check: error running vision AI call` (`GatewayResponseError: Cannot connect to API: other side closed`) | **2** | Vercel AI Gateway socket closed mid-call (run-5, crc-pr index 96; run-5, crc-iw index 100). |
| **Total** | **54** | Matches the sidecar's 54 `crc-vision:error` events. |

**This is the highest-value finding in the observability report**: the sidecar `vision-log.jsonl` hides a real bug. With only the sidecar you'd see 54 errors but think they were one issue (unspecified failure). With the main log they fall into two distinct buckets, and one of them — the 24 `primary-site-plan` placeholder calls — is **not** a network blip, it's a bug in how the document reference is resolved when the agent calls `crc-vision-check`. All 14 files that hit it are listed in §2 of the running-tally; here's the per-file count of `Calling crc-vision-check: primary-site-plan` invocations from the main log: crc-sp-3=4, crc-de-1=4, crc-cm=4, crc-sp-4=3, crc-awrr=3, crc-tpw-2=2, crc-tpw-1=2, crc-sp-1=2, crc-pr=2, crc-pb=2, crc-lde=2, crc-f=2, crc-aw-redlines=2, crc-de-2=1 (= 35 total calls; 24 hit the DB-uuid-validation path, the rest hit a Supabase blip first). Worth filing as a bug.

The vision AI-call gateway errors (2 total) are also invisible in the sidecar — `crc-vision:error` doesn't distinguish "doc load failed" from "model gateway failed". Both bucket types matter for different reasons (data-pipeline bug vs. provider reliability).

---

## 4. Top 3 observability recommendations

### Recommendation 1 — Add a per-tool-call JSONL keyed by `(checklistItemId, run)` (replaces both sidecars)

Write one append-only JSONL file at `output/tool-calls.jsonl` with one entry per tool invocation, schema:

```jsonc
{
  "ts_start": 1782386035010,
  "ts_end":   1782386230401,
  "elapsed_ms": 195391,
  "tool": "crc-vision-check",
  "tool_name_variants": ["crc-vision-check","mcp__conductor_tools__crc_vision_check"],
  "tool_use_id": "toolu_01Vo8mJirHJxyEYM59BN5h1v",
  "run": "run-1",
  "item": "crc-f.md",
  "checklistItemId": "F-3.2",            // <-- the missing field
  "input": { "documentId": "908ffab5-…", "sheetNum": 17, "prompt": "Analyze this Fire Protection Plan…" },
  "output": { "ok": true, "text": "Based on the provided Fire Protection Plan…", "model": "anthropic/claude-sonnet-4-5-20250929", "tokens": { "input": 5821, "output": 412 } },
  "error": null,
  "metadata": { "referenceImagesRequested": 0, "referenceImagesLoaded": 0, "referenceImagesSkipped": 0, "paths": [], "mode": "hybrid", "resultCount": 20 }
}
```

The `checklistItemId` is the single hardest field to capture because the agent SDK doesn't surface it natively. Two viable strategies:

1. **System-prompt anchoring** — instruct the agent to wrap every tool call in a small JSON envelope like `{"checklistItemId":"SP-2.13", ...args}`; the tool unwraps it before forwarding. Lossy if the agent forgets, but cheap.
2. **Per-item agent sessions with an injected context tag** — the conductor already creates one agent session per item; pipe the `checklistItemId` into a logging context that wraps the tool handler. This is the robust fix and only touches `src/tools/crc-*/index.ts`.

This single file would replace both `vision-log.jsonl` and `semantic-search-blocks-log.jsonl` and would let you answer "which item caused this vision error" with a single `jq` query.

### Recommendation 2 — Log the vision response text + model + tokens in the sidecar (don't rely on the agent-message stream)

Today the vision response only survives by accident because the agent's `tool_result` is in the main pino log. Anyone post-processing `vision-log.jsonl` in isolation will conclude "we don't have the answers". They do — but only via fragile pino-log mining.

Specifically: extend `src/tools/crc-vision-check/index.ts` (around line 351 where `generateText` is awaited) to log the model's response text, `model`, `usage.inputTokens`, `usage.outputTokens`, `usage.cachedInputTokens`, and `elapsedMs` to whatever file the rec-1 unified tool-call JSONL ends up at. The current `msg:"crc-vision-check response received"` line is the perfect place — it already runs once per successful call but currently carries zero response payload.

### Recommendation 3 — Normalize tool names at the SDK boundary

There are **three** distinct strings in the agent's `tools_used[]` for vision (`crc-vision-check` / `mcp__conductor_tools__crc_vision_check` / `crc_vision_check`) and **four** for semantic-search. Any downstream tally has to know about all of them or it silently undercounts. Either:

- Have the conductor agent SDK collapse `mcp__<server>__<tool>` to its registered short name before populating `tools_used[]`, or
- Publish a canonical alias map alongside the run output (e.g. `tool-name-aliases.json`).

This also affects this audit: I had to discover the seven variants by `grep | sort | uniq -c` rather than reading a manifest.

#### Honorable mentions
- The misleadingly-named `output/semantic-search-blocks.json` (singular) is a single overwritten scratch file, not a log. It should be deleted or renamed to `…-last-call.json`.
- `output/consolidated-findings.json` has `tools_used: null` for all 1,142 per-run findings — the consolidation step drops `tools_used[]` even though it's present in the per-run findings files. One-line fix in the consolidation script.
- Pino's `msg:"crc-vision-check response received"` lacks the matching `Calling crc-vision-check` correlation id (toolu_…); right now you can only pair them by timestamp + item, which is fragile under concurrency. Add a `callId`.

---

## 5. Files emitted by this audit

- `crc-audit-agent-3-tool-usage-current.tsv` — 1 row per (checklist_item × run); 1,131 data rows.
- `crc-audit-agent-3-tool-usage-running-tally.tsv` — 1 row per checklist item; 235 data rows; `historical_reviews_counted=0` everywhere (gen mismatch).
- `crc-audit-agent-3-observability-report.md` — this file.
