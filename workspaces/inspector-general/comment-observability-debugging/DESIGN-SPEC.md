# Comment Observability & Debugging Page for CC and CRC in Inspector General

**Status:** Draft v2.1
**Date:** 2026-07-13
**Repos touched:** `inspector-general` (post-processing, ingest, new debug route), `conductor` (D8 contract test; Phase 2: additive tool-call logging), `bureau` (Phase 2: script-tool attribution)
**Repos NOT touched:** `cityhall`, `substation`, `winston` (except this spec)

> **Revision note (v2, 2026-07-13).** Audit session findings folded in:
> - **CRC join corrected (new F7).** v1's comment→transcript join (`ref` grouping + `.md` →
>   log `item`) is wrong for CRC: the log's `item` values are **split guide files**
>   (`crc-CA-1.md`/`-2`/`-3`), and the ref's grouping (`crc-CA`) is the department — no
>   `crc-CA.md` exists in the log. The join now resolves the checklist item to its split file
>   via the per-run findings files already in the run output. Data-model section rewritten.
> - **Q7 RESOLVED as verified fact (new F8).** Log completeness verified hands-on against the
>   two largest recent CRC runs (127 MB / 110 MB): zero invalid lines, 120/120 agent cells
>   present, exact tool_use↔tool_result pairing. Degraded-behavior rule added to Phase 1a.
> - **Q4 RESOLVED → D8.** Conductor pins SDK-message logging with tests only (no runtime
>   changes). Sequencing table updated.
> - **Phase 1a hardened.** Slicing location confirmed (`on-workflow-completed`, gated
>   `review_type IN ('completeness','crc')`); streaming-parse + idempotency requirements
>   added (logs are 110–127 MB); `metadata.transcripts` index interface specified; CRC's
>   `enrich-final-comment` agent step explicitly out of scope; "review agent step (CRC)"
>   hedge removed — the CRC agent step is also named `review` (verified).
> - **Q11 (unattributed tool calls in the per-item view) and Q12 (slice-fetch transport)
>   added.** Q8 enriched with verified sidecar data (all 538 vision records carry
>   `checklistItemIds`).
>
> **Revision note (v2.1, 2026-07-13).** Will's answers folded in:
> - **Q1 RESOLVED → D3 revised.** Derived transcripts move OUT of the run's `outputs_path`
>   into the existing private `inspector-general` bucket under
>   `ig-derived-review-outputs/{reviewId}/…` — no mixing IG-written objects into conductor's
>   prefix. Bucket verified to already exist.
> - **Q3 RESOLVED.** Backfill everything with an intact log; four named runs go first.
> - **Q9 RESOLVED → D10.** Read-only debugging in v1; no annotation hooks.

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
pinned by D8 (contract test in conductor). CRC logs verified to the same standard — see F8.

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

### F7. CRC groupings are split guide files — the ref's grouping is NOT the log's `item` (v2)

Verified against CRC runs `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e` and
`47eca23e-a010-4f87-ac3b-1cf6f4c481ae` (both 5 runs × 24 guide files, 17 departments):

- A comment's `sourceFindings[].ref` uses the **department** as its grouping half
  (`"crc-CA:CA-07.2"`), but the log's `item` values are **split guide files** —
  `crc-CA-1.md`, `crc-CA-2.md`, `crc-CA-3.md`. There is no `crc-CA.md` anywhere in the log,
  so v1's `grouping + ".md"` join returns nothing for any split department. (For CC the v1
  join happens to hold: CC refs like `cc-13:AW-01` match guide files `cc-13.md` exactly.)
- The deterministic resolver is already in the run output: each
  `output/runs/run-N/findings/<guide-file>.md.json` lists the `checklistItemId`s that guide
  file evaluated (verified: `CA-07.2` appears only in `crc-CA-1.md.json`). Resolving item →
  split file requires no guide download and matches the GT-evals revamp precedent of
  matching CRC by bare atomic item ID (grouping casing/shape varies per guide generation).

### F8. The logs are complete — verified at 110–127 MB (v2, resolves Q7)

The full completeness battery was run against the two largest recent CRC runs plus the CC
sample run:

| Check | CRC `d1ff47e7` (127 MB) | CRC `47eca23e` (110 MB) |
|---|---|---|
| NDJSON lines / invalid | 103,288 / **0** | 74,605 / **0** |
| Agent cells with assistant msgs | **120/120** (24 files × 5 runs) | **120/120** |
| `tool_use` ↔ `tool_result` pairing | **3,664 = 3,664** | **3,292 = 3,292** |

Full response text present in every `tool_result` (median ~3.7k chars, max ~63k). No upload
cap or rotation observed at these sizes. Two implementation-relevant observations:

- The `crc-WQ` run-3 cell in `47eca23e` that silently dropped its structured output (known
  from the run audit) **has its complete transcript in the log** — the debug page can show
  what happened inside dropped cells, which no other artifact can.
- The assistant/user message stream is ~10% of log lines (`review|system` events dominate:
  65,135 of 103,288 lines in `d1ff47e7`); per-cell slices are compact (~85 messages/cell).

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

An agent cell evaluates a **whole guide file** (all checklist items in `cc-13.md` or
`crc-CA-1.md`) in one session, N times (one per `runIndex`). The ref's grouping half is
**not** reliably the guide filename — CRC departments split across several files (F7) — so
the join goes through the checklist item ID and the per-run findings files:

```
review_comment → output_json.sourceFindings[].ref   ("crc-CA:CA-07.2" / "cc-13:AW-01")
             → checklistItemId ("CA-07.2")
             → per-run findings files (output/runs/run-N/findings/<file>.md.json)
               — the file whose findings contain that checklistItemId → guide file ("crc-CA-1.md")
             → N transcript slices keyed by (item="crc-CA-1.md", runIndex, session_id)
```

The ref's department prefix narrows which findings files to scan but is never trusted as a
filename. For CC the resolution collapses to the v1 shortcut (`cc-13` → `cc-13.md`), but the
slicer uses the findings-file resolver uniformly — one code path, no per-workflow casing.

So the natural unit of ingestion is the **(guide file, runIndex) session slice**, and the
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
backfill trigger path), after run-summary computation, gated on
`review_type IN ('completeness', 'crc')`:

1. Download `logs/<workflow>.log` from the run's `outputs_path`.
2. Stream-parse the NDJSON; keep lines where `step == 'review'` (the agent step is named
   `review` in both the CC and CRC workflows — verified) and `message` is present; group by
   `(item, runIndex, session_id)`. CRC's second agent step (`enrich-final-comment`) is
   **out of scope** — the ask is about the voting agents; its transcript is also in the log
   if a future revision wants it.
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

4. Persist slices to the existing private `inspector-general` bucket under
   `ig-derived-review-outputs/{reviewId}/transcripts/{grouping}/{runIndex}.json` (D3 —
   keyed by the IG-native reviewId, not conductor's `outputs_path`), and record an index
   in `ig_review_runs.metadata.transcripts`:

```typescript
interface TranscriptIndex {
  slicedAt: string;                 // ISO timestamp of the slicing pass
  logLines: number;                 // total NDJSON lines seen
  slices: Array<{
    grouping: string;               // guide file minus .md, e.g. "crc-CA-1"
    runIndex: string;
    storagePath: string;            // "ig-derived-review-outputs/{reviewId}/transcripts/crc-CA-1/run-1.json"
    events: number;
    toolCallsByItem: Record<string, number>;  // checklistItemId → attributed call count
    unattributedToolCalls: number;  // calls with no checklistItemIds (Q11)
  }>;
  itemToGrouping: Record<string, string>;  // from per-run findings files (F7 resolver)
  warnings: string[];               // e.g. "log missing", "cell crc-WQ/run-3 has no findings"
}
```

   Derived data stays in storage because transcripts are large and read rarely; only the
   index goes in the DB. The index merges into the existing `metadata` object the same
   way the run summary does.

**Runtime constraints (v2).** Verified logs are 110–127 MB (F8). The step must stream-parse
line-by-line — never buffer the whole file — and write slice JSONs incrementally; the kept
message stream is ~10% of lines, so slice output is modest (~85 messages per cell). The step
must be **idempotent**: re-running postprocess (routine for backfills) overwrites
`ig-derived-review-outputs/{reviewId}/` and replaces `metadata.transcripts` wholesale.

**Degraded behavior (v2).** If the log is absent from the run upload, or a `(guide file,
runIndex)` cell expected from the findings files has no transcript lines, the slicer still
writes the index with a `warnings` entry naming what is missing — the debug page renders
what exists and badges the gaps. Never fail the whole postprocess over a missing log.

This works for every past run because the log has always been uploaded (completeness
verified in F8). Backfill piggybacks on the existing `trigger-ig-postprocess.sh` /
direct-Inngest path (note the known multi-ID limitation of the script — use the curl loop,
per the GT-evals revamp).

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
- **D3 (revised v2.1, resolves Q1).** Derived transcripts live in the existing private
  `inspector-general` bucket under `ig-derived-review-outputs/{reviewId}/…`, with only an
  index in `ig_review_runs.metadata` — no new large-blob tables, and no IG-written objects
  mixed into conductor's `workflow-runs` prefixes. (v1 proposed `{outputs_path}/ig-derived/`;
  Will preferred separation and the bucket already exists, so separation is free.)
- **D4.** Images are rendered by re-derivation (signed URLs to existing assets), not by
  persisting image bytes per call. Phase 2 pins resolved paths at call time to eliminate
  drift for future runs.
- **D5.** Phase 2 is additive-only in conductor (new ledger alongside existing sidecars);
  IG reads ledger-first with transcript-join fallback, so deploys are order-independent.
- **D6.** CC and CRC share one ingestion path and one debug UI from day one; the formal
  review workflow is explicitly follow-up.
- **D7.** Vision tool convergence is acknowledged tech debt, deferred to its own spec.
- **D8 (v2, resolves Q4).** Conductor pins SDK-message logging contractually with **tests
  only** — a unit/integration test that drives a minimal agent step (or a mocked SDK stream
  through the real logging path) and asserts assistant/user messages, including `tool_use`
  blocks with input and `tool_result` blocks with content, reach the workflow log at the
  production log level. No runtime changes. Ships before or alongside Phase 1.
- **D9 (v2).** Comment→slice resolution goes through the checklist item ID and the per-run
  findings files (F7), never through the ref's grouping string as a filename. One resolver
  for CC and CRC.
- **D10 (v2.1, resolves Q9).** The debug page is **read-only** in v1 — no annotation hooks
  into `ig_eval_annotations`. Revisit once the page has seen real debugging use.

## Open questions

- **Q1.** ~~Derived-transcript storage location?~~ **RESOLVED (v2.1) → D3 revised**:
  `inspector-general` bucket, `ig-derived-review-outputs/{reviewId}/…`.
- **Q2.** Is session-slice projection (D2) acceptable for v1, or do we want best-effort
  per-item segmentation markers (e.g. split on the agent's own "Evaluating CC-1-03" text)?
  Recommendation: projection only; segmentation heuristics rot.
- **Q3.** ~~Backfill scope?~~ **RESOLVED (v2.1)**: everything with an intact `logs/` upload
  (parsing is cheap). Priority order — these four runs backfill first:
  CRC `47eca23e-a010-4f87-ac3b-1cf6f4c481ae`, CRC `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e`,
  CC `b38e2619-91e4-4585-8e92-2fd32bbb9653`, CC `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d`.
- **Q4.** ~~Pin SDK-message logging contractually?~~ **RESOLVED (v2) → D8**: yes, tests
  only, small conductor PR, independent of Phase 2.
- **Q5.** Thumbnail drift (F4): acceptable for old runs to render the *current* thumbnail
  with a "re-derived, may differ" badge, or should the page cross-check
  `sheet_version.created_at` against the run window and warn?
- **Q6.** `tool_use_id` capture: can the MCP tool handler see the SDK `tool_use_id` at call
  time (to write into the ledger), or does the join have to happen transcript-side (slicer
  stamps `toolUseId` onto ledger records by matching args+timestamps)? Needs a conductor
  spike; determines how clean the Phase 2 join is. **Spike required before Phase 2 design
  freeze; does not block Phase 1.**
- **Q7.** ~~Do large runs truncate the log?~~ **RESOLVED (v2) → F8**: verified complete at
  110–127 MB on the two largest recent CRC runs; degraded-behavior rule added to Phase 1a
  for any run whose log is nonetheless missing.
- **Q8.** For CRC multi-run, `vision-log.jsonl` is flat (no `runIndex` in entries) — join
  by `checklistItemIds` + timestamp within the slice window, or add `runIndex` to CRC
  entries as an early Phase 2 cherry-pick? (v2 data point: all 538 vision records in the
  `d1ff47e7` run carry populated `checklistItemIds`, so the itemIds+timestamp join has
  full coverage there; the question is only about disambiguating same-item calls across
  runIndexes.)
- **Q9.** ~~Annotation hooks in v1?~~ **RESOLVED (v2.1) → D10**: read-only v1.
- **Q10.** Signed-URL policy for images on the page: per-request short TTL (simplest) vs
  proxying bytes through IG (no expiring links in the DOM). Recommendation: short-TTL signed
  URLs, matching existing IG behavior.
- **Q11 (v2).** Per-item projection policy for **unattributed** tool calls: base `vision`
  and most `semantic-search-blocks` calls carry no `checklistItemIds` (F5), so on old runs
  the per-item view would silently omit them and look misleadingly sparse — worst for
  exactly the tool with the weakest attribution. Recommendation: render an "unattributed
  calls in this session" bucket on the per-item view (count comes from the index's
  `unattributedToolCalls`), in addition to the expand-full-session affordance.
- **Q12 (v2).** Slice-fetch transport for the debug page: signed URL directly into the
  `inspector-general` bucket vs an IG API endpoint (matching the existing
  `/api/load`-style server-proxied pattern). Recommendation: IG API endpoint — keeps
  bucket-layout knowledge server-side and matches how the page already loads run data.

## Sequencing summary

| Phase | Repo(s) | Retroactive? | Delivers |
|---|---|---|---|
| 0 | inspector-general (UI) | yes | per-run verdict/explanation cards on comment page |
| 1 | inspector-general | yes | debug route: full transcripts, tool req/resp, rendered images |
| D8 pin | conductor (test only) | n/a | contract test that Phase 1's source stays intact |
| 2 | conductor + bureau | new runs | tool-call ledger, join keys, attribution, rendered prompts |
| 3 | conductor (deferred) | — | vision tool convergence (own spec) |

## Related specs

- winston#153 / winston#156 — GT-evals revamp for CC/CRC (the page this feature hangs off;
  `ig_eval_data` shape, backfill mechanics).
- winston#162 — CRC guides figure-extraction audit (reference figures this page will render).
- `workspaces/inspect-drawing-tool/`, `workspaces/measure-distance-tool/`,
  `workspaces/vision-tool-orchestration/` — specialist tools whose artifacts Phase 1 joins.
