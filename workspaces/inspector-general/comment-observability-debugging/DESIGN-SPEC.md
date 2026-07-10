# Comment Observability & Debugging Page for CC and CRC in Inspector General

**Status:** Draft v1
**Date:** 2026-07-10
**Repos touched:** `inspector-general` (post-processing, ingest, new debug route), `conductor` (Phase 2: additive tool-call logging), `bureau` (Phase 2: script-tool attribution)
**Repos NOT touched:** `cityhall`, `substation`, `winston` (except this spec)

## Problem

Debugging a CC or CRC comment today means answering two questions IG cannot answer:
**"what did each of the N voting agents actually think?"** and **"what did the tools they
called actually see and say?"** The ground-truth-evals detail page
(`inspector-general/src/routes/(app)/review/[reviewId]/ground-truth-evals/[commentId]/+page.svelte`)
shows the consolidated comment, one unified `agentTrace`, and a `voteBreakdown` that is
**counts only** (`{fail: 2, pass: 1}`) — no per-agent explanation, no tool calls, no images.
Answering the real question requires downloading the run output from the `workflow-runs`
bucket and grepping a ~40k-line log by hand (which is exactly what the `audit-cc-run` /
`audit-crc-run` skills do, expensively, per audit).

The ask: from `ground-truth-evals/{comment}`, navigate to an observability page showing, per
voting agent, the full explanation/reasoning and every tool call (vision, vision-check,
crc-vision-check, semantic-search-blocks, experimental `vision_check` specialists) with
request **and** response — and for vision calls, render the actual image sent to the model.

### The central finding: the data already exists

This spec's exploration (4 parallel codebase deep-dives + hands-on verification against CC
run `50a1a78d-4517-4c00-82d8-593179cb20a5`, the 2026-07-07 5-voter run) established that
**nearly everything the page needs is already persisted** — it is just scattered across
artifacts with inconsistent attribution, and IG never ingests most of it. The design below
is therefore mostly an *ingestion and alignment* problem, not a new-telemetry problem, and
Phase 1 works **retroactively on every past run** with zero conductor changes.

## Verified facts (what is persisted today)

All claims below were verified against live code and the real downloaded run at
`~/noetic/cc-audit/50a1a78d-4517-4c00-82d8-593179cb20a5/cc-run-output/`.

### F1. The uploaded run log contains the full per-agent transcript

`logs/completeness-check.log` (pino NDJSON, uploaded to `workflow-runs` with the rest of the
run by `conductor/src/shared/storage-uploader.ts`) contains the **complete Claude Agent SDK
message stream** for every agent cell: `assistant` messages (including `thinking` blocks and
`tool_use` blocks with full input args), `user` messages (including `tool_result` blocks with
full response text), and `system` messages. Every line is tagged with `step`, `item` (the
grouping file, e.g. `cc-3.md`), `runIndex` (e.g. `run-1`), and `session_id` (unique per agent
cell). Verified in the sample run: 41,641 lines; 8,142 lines mention `tool_use`; a
`mcp__conductor_tools__vision_check` tool_use for `cc-22:CC-22-12` on `run-2` pairs (by
`tool_use_id`) with a tool_result carrying the **full vision answer text**.

This log is the single authoritative source for "all N voting agents' explanation, reasoning
& tool calls" — including request and response for every tool. It is also the *only* place
some of that exists (see F5/F6 gaps).

Caveat: the earlier `agent-sdk tool_use guard` work and this run's log confirm SDK messages
are logged at the current production level, but this is **incidental, not contractual** —
see Q4.

### F2. Per-run findings are persisted twice and partially ingested already

- `output/runs/run-N/findings/<grouping>.json` — each voting run's raw findings per checklist
  item: `status`, `observation`, `reasoning`, `tools_used`, `explanation`,
  `evidenceLocations`. (CC: `completeness.emit.schema.json`; CRC: `crc.emit.schema.json`.)
- The same per-run trace is embedded per comment in `review-comments.json` →
  `sourceFindings[].perRunFindings[]` and in `consolidated-findings.json`, and lands in
  `review_comments.output_json`. IG's `src/lib/ingest/supabase-loader.ts` **already parses
  `perRunFindings`** — the detail page just barely surfaces it (collapsed `<details>`,
  `+page.svelte:274–318`, not linked from the eval table).

### F3. Vision sidecar logs exist but have three different shapes

- **CC `vision_check` (experiment):** `output/runs/run-N/vision-check-calls/<callId>/metadata.json`
  (`conductor/src/tools/vision-check/index.ts`, CallMetadata) — inputs include
  `checklistItemId`, `question`, `documentId`, `sheetNum`; the classifier section records
  `modelId` (`anthropic/claude-haiku-4-5`), `promptSha256`, `promptSourcePath`, and the routing
  output; the dispatch section records `specialistCalled` and `specialistCallDir`. Verified:
  87 calls in run-1 of the sample run. **Gap:** on the generic-vision route
  `specialistCallDir` is `null` (`dispatch.ts:268,300,322`) — no specialist request/response
  artifact (the response text is only in the F1 transcript).
- **CRC `crc_vision_check`:** appends to `output/vision-log.jsonl` with `checklistItemIds[]`,
  reference-image `paths`, `model`, `usage`, **`responseText`**, `elapsedMs`
  (`conductor/src/tools/crc-vision-check/index.ts:~206`). The richest sidecar we have.
- **Base `vision` (stock CC + formal review):** `output/vision-log.jsonl` entries are
  occurrence-only — `{event, documentId, sheetNum, success, timestamp}`
  (`conductor/src/tools/vision/index.ts:70`). No item attribution, no prompt, no response.

### F4. The images are (almost all) re-derivable — no byte persistence needed

- Sheet-based calls: `conductor/src/shared/vision-file.ts` resolves
  `documentId + sheetNum → sheet_version.thumbnail_storage_path` (latest `sheet_version` via
  `plan_set_version`) and sends the pre-rendered JPEG from the `submission-data` bucket
  inline. **The resolution is deterministic** — IG can run the same lookup and render exactly
  what the model saw via a signed URL.
- Supplementary documents (no `sheetNum`): sent as a 300s signed URL to the whole PDF —
  re-derivable the same way.
- CRC reference figures: relative paths under the `crc-guides` bucket
  (`figures/TPW-9/1.png`), logged per call — renderable via signed URL.
- `inspect-drawing` specialist: **already persists the exact cropped JPEG** at
  `<outputPath-dir>/inspect-drawing-calls/<callId>/cropped.jpg` plus `events.jsonl`
  (`bureau/workflows/completeness-check/scripts/inspect-drawing.ts:741,851`), and the
  vision-check dispatch records `specialistCallDir` pointing at it (`dispatch.ts:890,1171`).
  These live under `output/` and are uploaded with the run.
- The residual risk: thumbnails are the *latest* `sheet_version` at render time; if a sheet
  is re-thumbnailed later, re-derivation could drift from what was sent (see Q5, D4).

### F5. Attribution is inconsistent across tools

| Tool | item attribution | runIndex | prompt logged | response logged |
|---|---|---|---|---|
| `vision_check` (CC exp) | required param | in path + metadata | sha256 only | transcript only (generic route) |
| `crc_vision_check` | optional param | no (flat jsonl) | prompt param yes; composed prompt no | **yes** (`responseText`) |
| base `vision` | **none** | **none** | no | transcript only |
| `script:semantic-search-blocks` | optional, usually absent | **absent** in sampled entries | query yes | full results yes |
| `inspect-drawing` | via `CHECKLIST_ITEM`/`RUN_INDEX` env | yes | yes (events) | yes + crop image |

The F1 transcript rescues attribution in every case — the `tool_use` block sits inside a
message tagged `item` + `runIndex` — but no sidecar can stand alone, and the SDK
`tool_use_id` and sidecar `callId` are **disjoint ID spaces** with no join key.

### F6. IG has no per-agent ingestion

`on-workflow-completed.ts` (9-step Inngest pipeline) reads `review-comments.json`,
`consolidated-findings.json`, and per-run findings, and writes `ig_review_runs` +
`ig_eval_data` (+ annotations). `ig_eval_data.vote_breakdown` is counts only. There is no
`ig_agent_*` table, no transcript ingestion, and no image resolution. The one precedent is
`src/lib/ingest/review-log-parser.ts`, which regex-parses the *formal review* workflow's log
for vision calls (powers Vision Tool Coverage Analytics) — proof the log-parsing approach
works, but it is review-workflow-specific and extracts vision calls only.

## Goals

- From `ground-truth-evals/{comment}`, reach a debug view that shows, **per voting run**:
  the verdict, explanation, observation, reasoning, and the ordered list of tool calls —
  each with request args and full response.
- For every vision-family call, render the image(s) that were sent to the model (sheet
  thumbnail, document, reference figures, or persisted crop).
- Works for CRC now and CC with the same code path (shared ingestion + shared UI), and
  **retroactively for already-completed runs** (Phase 1 requires no conductor deploy).
- Establish one tool-call logging convention in conductor so future tools are observable by
  construction rather than by archaeology (Phase 2).

## Non-goals (deliberately deferred)

- Exact UI layout — Will explicitly deferred this ("we'll figure out the exact ui later").
  This spec defines routes, data contracts, and rendering capability, not visual design.
- The formal `review` workflow — same bones, but it has its own log parser and analytics
  today; folding it in is follow-up work once CC/CRC share the new path.
- Merging the three vision tool implementations (`vision`, `vision_check`,
  `crc_vision_check`) into one — flagged as the right long-term convergence (D7) but out of
  scope here.
- Live/streaming observability during a run — this is post-hoc debugging of completed runs.
- Better Stack / OpenTelemetry tracing — the durable copy is the uploaded log; telemetry
  pipelines are orthogonal.

## Design

### Data model: how a comment maps to its N agents

An agent cell evaluates a **whole grouping file** (all checklist items in `cc-13.md` or
`crc-tpw.md`) in one session, N times (one per `runIndex`). A comment maps to its agents via:

```
review_comment → output_json.sourceFindings[].ref  ("cc-13:AW-01")
             → grouping ("cc-13") + checklistItemId ("AW-01")
             → N transcript slices keyed by (item="cc-13.md", runIndex, session_id)
```

So the natural unit of ingestion is the **(grouping, runIndex) session slice**, and the
per-item view is a *projection* of that slice: the item's finding (from `perRunFindings`)
plus the subset of tool calls attributed to that item, plus the option to expand the full
session. Attempting hard per-item segmentation of the transcript is unreliable (agents
interleave items); we project rather than split. (Q2)

### Phase 0 — surface what IG already loads (UI-only, ship immediately)

Promote `sourceFindings[].perRunFindings[]` on the comment detail page from a collapsed
afterthought to a first-class per-run breakdown: one card per run showing status,
explanation, observation, reasoning, `tools_used`, and evidence locations. Zero pipeline
changes; delivers the "N voting agents' explanations" half of the ask for every run already
in the system.

### Phase 1 — transcript ingestion + debug page (IG-only, retroactive)

**1a. New post-processing step: transcript slicing.** In `on-workflow-completed.ts` (and the
backfill trigger path), after run-summary computation:

1. Download `logs/<workflow>.log` from the run's `outputs_path`.
2. Stream-parse the NDJSON; keep lines where `step == 'review'` (CC) / the review agent step
   (CRC) and `message` is present; group by `(item, runIndex, session_id)`.
3. For each slice, emit a normalized `AgentTranscript` JSON:

```typescript
interface AgentTranscript {
  grouping: string;            // "cc-13" (item minus .md)
  runIndex: string;            // "run-1"
  sessionId: string;
  model: string;
  events: TranscriptEvent[];   // ordered
}
type TranscriptEvent =
  | { kind: 'thinking'; text: string; ts: number }
  | { kind: 'text'; text: string; ts: number }
  | { kind: 'tool_call'; toolUseId: string; toolName: string;
      input: unknown;                       // full request args
      result: { content: string; isError: boolean } | null;  // joined by tool_use_id
      checklistItemIds: string[];           // from input args when present, else []
      ts: number };
```

4. Persist slices to storage under the run's own prefix:
   `{outputs_path}/ig-derived/transcripts/{grouping}/{runIndex}.json`, and record an index
   (slice list + per-item tool-call counts) in `ig_review_runs.metadata.transcripts`.
   Derived data stays in storage because transcripts are large and read rarely; only the
   index goes in the DB. (Q1)

This works for every past run because the log has always been uploaded. Backfill piggybacks
on the existing `trigger-ig-postprocess.sh` / direct-Inngest path (note the known multi-ID
limitation of the script — use the curl loop, per the GT-evals revamp).

**1b. Tool-call enrichment join.** Where sidecars add information beyond the transcript,
join them in during slicing:

- `vision-check-calls/*/metadata.json` → classifier decision + routing + `specialistCallDir`
  (match on `runIndex` + `inputs.checklistItemId` + nearest timestamp, since there is no
  shared ID — fixed properly in Phase 2).
- CRC `vision-log.jsonl` → `usage`, `elapsedMs`, reference-image paths.
- `inspect-drawing-calls/*/` → `cropped.jpg` storage path + `events.jsonl`.
- `semantic-search-blocks-log.jsonl` → full ranked results (the transcript tool_result may
  be a truncated rendering).

**1c. Image resolution service.** A small IG server module mirroring
`vision-file.ts`'s logic: `(documentId, sheetNum?) → signed thumbnail/document URL`, plus
`crc-guides` figure paths → signed URLs, plus persisted crops → signed URLs into the
`workflow-runs` bucket. Exposed as `GET /api/vision-image?documentId=…&sheetNum=…` (and a
`storagePath` variant). Signed-URL TTL scoped to page session.

**1d. Route.** `/review/[reviewId]/ground-truth-evals/[commentId]/debug` — linked from the
comment detail page (and each Phase 0 per-run card links to its run's slice with the item
pre-filtered). The page reads the transcript index from `ig_review_runs.metadata`, lazy-loads
slice JSONs, and renders per-run: verdict header (from `perRunFindings`), tool-call timeline
(request args, response, image thumbnails inline), and expandable full transcript
(thinking/text events).

### Phase 2 — conductor/bureau alignment: one tool-call ledger

Additive changes so future runs don't need fuzzy joins, and so sidecars stand alone:

1. **Unified envelope.** Every tool call writes one JSON under
   `output/runs/{runIndex}/tool-calls/{callId}.json`:

```typescript
interface ToolCallRecord {
  callId: string;
  toolUseId: string | null;    // SDK id — closes the join-key gap (F5)
  toolName: string;
  runIndex: string | null;
  checklistItemIds: string[];
  request: unknown;            // tool input args
  renderedPrompt?: string;     // the composed prompt actually sent to the vision model
  response: { text: string; isError: boolean };
  artifacts: string[];         // e.g. ["inspect-drawing-calls/<id>/cropped.jpg"]
  resolvedImages: Array<{ source: 'sheet-thumbnail'|'document'|'reference-figure'|'crop';
                          storagePath: string }>;  // pins exactly what was sent (F4 drift)
  model?: string; usage?: unknown; elapsedMs?: number;
  startedAt: string; completedAt: string;
}
```

   `vision-check`'s `CallMetadata` is ~80% of this already — generalize it rather than
   inventing new. Existing sidecars keep writing (back-compat) until IG cuts over.
2. **Attribution params required.** Add `checklistItemIds` to the base `vision` tool schema;
   make it required in the CC/CRC review prompts; thread `RUN_INDEX`/`CHECKLIST_ITEM` env
   into `semantic-search-blocks` log entries (the `inspect-drawing` pattern,
   `inspect-drawing.ts:404–435`).
3. **Log the rendered vision prompt.** Today the literal prompt sent to Gemini is
   recoverable nowhere (vision-check logs only `promptSha256`; CRC logs the agent's `prompt`
   arg but not the composed prompt). One string field in the ledger fixes "see the request"
   in the strictest sense.
4. **Record resolved image paths at call time** (`resolvedImages` above) so re-derivation
   drift (F4) is eliminated for new runs; old runs fall back to live resolution.
5. **Unify the two `vision-log.jsonl` schemas** (CC gains `responseText`/`usage`/
   `checklistItemIds` to match CRC) — or retire both in favor of the ledger once IG reads it.

Deploy order note: ledger reads in IG must tolerate both worlds (records absent → fall back
to Phase 1 transcript joins), so conductor and IG can ship independently.

### Phase 3 (deferred) — vision tool convergence

`crc_vision_check` and `vision_check` share a dispatch/specialist core, with
reference-images as a capability rather than a separate tool; the formal review workflow
moves onto the same path. Out of scope; recorded so the ledger design above is checked
against it (it is — the envelope is tool-agnostic).

## Decisions

- **D1.** Phase 1 is IG-only and retroactive: the uploaded pino log is the source of truth
  for per-agent transcripts; no conductor deploy is required to ship the debug page.
- **D2.** Ingestion granularity is the (grouping, runIndex) session slice; the per-comment
  view is a projection (item finding + attributed tool calls + expandable full session), not
  a hard split of the transcript.
- **D3.** Derived transcripts live in storage under the run's `outputs_path`
  (`ig-derived/`), with only an index in `ig_review_runs.metadata` — no new large-blob
  tables.
- **D4.** Images are rendered by re-derivation (signed URLs to existing assets), not by
  persisting image bytes per call. Phase 2 pins resolved paths at call time to eliminate
  drift for future runs.
- **D5.** Phase 2 is additive-only in conductor (new ledger alongside existing sidecars);
  IG reads ledger-first with transcript-join fallback, so deploys are order-independent.
- **D6.** CC and CRC share one ingestion path and one debug UI from day one; the formal
  review workflow is explicitly follow-up.
- **D7.** Vision tool convergence is acknowledged tech debt, deferred to its own spec.

## Open questions

- **Q1.** Derived-transcript storage: `{outputs_path}/ig-derived/` in the `workflow-runs`
  bucket (proposed) vs a dedicated `ig-derived` bucket? Same-prefix keeps run artifacts
  colocated but mixes conductor-written and IG-written objects under one prefix — any
  lifecycle/permissions reason to separate?
- **Q2.** Is session-slice projection (D2) acceptable for v1, or do we want best-effort
  per-item segmentation markers (e.g. split on the agent's own "Evaluating CC-1-03" text)?
  Recommendation: projection only; segmentation heuristics rot.
- **Q3.** Backfill scope: all completed CC/CRC runs, or the GT-evals backfill window
  (`created_at >= 2026-07-05`)? Log parsing is cheap; recommendation: everything with an
  intact `logs/` upload.
- **Q4.** SDK-message logging is load-bearing but incidental (F1). Should conductor pin it
  contractually — a test asserting assistant/user messages with tool_use/tool_result reach
  the workflow log at production level — before we build on it? Recommendation: yes, small
  conductor PR, independent of Phase 2.
- **Q5.** Thumbnail drift (F4): acceptable for old runs to render the *current* thumbnail
  with a "re-derived, may differ" badge, or should the page cross-check
  `sheet_version.created_at` against the run window and warn?
- **Q6.** `tool_use_id` capture: can the MCP tool handler see the SDK `tool_use_id` at call
  time (to write into the ledger), or does the join have to happen transcript-side (slicer
  stamps `toolUseId` onto ledger records by matching args+timestamps)? Needs a conductor
  spike; determines how clean the Phase 2 join is.
- **Q7.** The pino log for a 5-voter CC run is ~40k lines; are there runs where log size
  hits an upload cap or rotation that truncates the message stream? Audit a few of the
  largest runs before trusting the log as complete.
- **Q8.** For CRC multi-run, `vision-log.jsonl` is flat (no `runIndex` in entries) — join
  by `checklistItemIds` + timestamp within the slice window, or add `runIndex` to CRC
  entries as an early Phase 2 cherry-pick?
- **Q9.** Does the debug page need annotation hooks (e.g. "this vision call misread the
  sheet") wired into `ig_eval_annotations` in v1, or is read-only debugging enough to start?
  Recommendation: read-only v1.
- **Q10.** Signed-URL policy for images on the page: per-request short TTL (simplest) vs
  proxying bytes through IG (no expiring links in the DOM). Recommendation: short-TTL signed
  URLs, matching existing IG behavior.

## Sequencing summary

| Phase | Repo(s) | Retroactive? | Delivers |
|---|---|---|---|
| 0 | inspector-general (UI) | yes | per-run verdict/explanation cards on comment page |
| 1 | inspector-general | yes | debug route: full transcripts, tool req/resp, rendered images |
| Q4 pin | conductor (test only) | n/a | contract that Phase 1's source stays intact |
| 2 | conductor + bureau | new runs | tool-call ledger, join keys, attribution, rendered prompts |
| 3 | conductor (deferred) | — | vision tool convergence (own spec) |

## Related specs

- winston#153 / winston#156 — GT-evals revamp for CC/CRC (the page this feature hangs off;
  `ig_eval_data` shape, backfill mechanics).
- winston#162 — CRC guides figure-extraction audit (reference figures this page will render).
- `workspaces/inspect-drawing-tool/`, `workspaces/measure-distance-tool/`,
  `workspaces/vision-tool-orchestration/` — specialist tools whose artifacts Phase 1 joins.
