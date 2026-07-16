# Structured-output retry storm, variant 2: large findings emits arrive as unparseable `__unparsedToolInput` — the repair path is structurally blind to them

> **Status:** Diagnosed 2026-07-16, fix NOT implemented. Root cause lives in the **StructuredOutput emit path** (Claude Agent SDK 0.3.201 streaming tool-input delivery × oversized CRC guide payloads) — NOT in the schema, the prompt envelope, or conductor's repair logic, all of which are working as designed. Discovered by the `audit-crc-run` skill (Agent 1) on the v5 game-day run: review `ed5e7ba9-ba03-4000-abb4-1021ebec0631`, workflow_run `87370792`, 1700 S Lamar, 2026-07-14. Sibling of `STRUCT-OUTPUT-RETRY-STORM.md` (the 2026-06-20 double-wrap bug, whose envelope fixes — conductor#197 + bureau#459 — this run shows are **fully effective against their target**: 0 wrapper signatures in 120 cells). That doc's zero-`coercion_failed` closure criterion is NOT met (2 events), but by a failure mode it never described. Audit detail: `workspaces/comment-resolution-check/1700-S-Lamar/crc-run-audits/run-6-audit/crc-audit-agent-1-performance-stability.md` §5.

## Summary

On the v5 game-day CRC run, 26 StructuredOutput emit attempts across 17 of 120 review cells arrived at conductor as `{"__unparsedToolInput": {"raw": "<partial JSON>", "len": N}}` — the Claude Agent SDK's sentinel for *tool input that never parsed as JSON*. Every one of the 26 raw payloads is cut off mid-word, mid-string, at lengths from 6.5k to 44.9k characters; the assistant message records carry `stop_reason: null` and `output_tokens: 0`, i.e. the streamed emit turn was never finalized. In 15 of the 17 cells the SDK's next internal retry produced a complete emit and nothing was lost. In 2 cells — both `crc-SP-3`, the run's largest-payload guide — **all 5 SDK attempts truncated the same way** (each attempt 34–42k chars), tripping `error_max_structured_output_retries` → `agent.structured_output.coercion_failed` → a full outer retry that rebuilt each ~35-minute agent session from scratch.

What is working correctly: the crc schema, the emit prompt, ajv validation (it never even ran — `schema_errors: []`), conductor's `tryRepairStructuredOutput` (it was invoked and correctly declined: there is no parsed object to re-wrap), the outer retry loop (both cells recovered on retry #1; zero findings lost), and the June envelope fixes (the double-wrap reflex is gone on sonnet-4-6: 0 wrapper signatures, and the benign `inject_grouping` normalization fired exactly once per cell ×120).

Root cause in one sentence: **when a guide's findings payload is large (~35k+ chars for crc-SP-3's 20 verbose items), the streamed StructuredOutput tool-input frequently arrives incomplete, and conductor's entire coercion/repair machinery — built for parsed-but-miswrapped objects — has nothing it can do with an unparseable partial string, so 5 same-sized emits in a row = an unrepairable storm.**

## The bug in one diagram

```
 agent session (one review cell, e.g. crc-SP-3/run-1: 20 items, ~38 min of tool calls)
        │
        ▼  final turn: model streams StructuredOutput tool_use input
 ┌────────────────────────────────────────────────────────────────────┐
 │  {"findings": [ {..SP-33.1..}, {..SP-34..}, … 20 verbose items    │
 │     ≈ 35–45k chars of JSON streamed as input_json_delta chunks    │
 │                                                                    │
 │   stream ends mid-string ──────────✗ CUT (mechanism upstream,      │
 │   '…The absence of any park'          stop_reason:null,            │
 │                                       output_tokens:0 — turn       │
 │                                       never finalized)             │
 └────────────────────────────────────────────────────────────────────┘
        │
        ▼  SDK 0.3.201 cannot JSON.parse the accumulated input
 block.input = { "__unparsedToolInput": { "raw": "<partial>", "len": 36439 } }   ← sentinel
        │
        ▼  conductor runner.ts:395-397 captures the attempt
 summarizeAttempt → { kind:"object", topLevelKeys:["__unparsedToolInput"],
                      hasFindingsArray:false }          ← ajv NEVER RUNS (schema_errors:[])
        │
        ▼  SDK internal retry ×5 … on crc-SP-3 every attempt truncates again
 attempts: [__unparsedToolInput ×5]  →  error_max_structured_output_retries
        │
        ▼  runner.ts:277-282  tryRepairStructuredOutput(lastInput)
 ┌────────────────────────────────────────────────────────────────────┐
 │ conductor#197 repair: re-wraps a PARSED object missing its         │
 │ envelope (inject grouping / unwrap double-wrap).                   │
 │ Input here is an unparseable partial string wrapper                │
 │ → nothing to repair → returns null              ✓ correct, blind  │
 └────────────────────────────────────────────────────────────────────┘
        │
        ▼  runner.ts:302-315
 event: agent.structured_output.coercion_failed  (level 50)  → throw
        │
        ▼  step-executor outer retry (7s backoff)
 ENTIRE ~35-min session re-done from scratch → 2nd session emits cleanly ✓
 (run-1: 38.8 min discarded; run-4: 31.6 min discarded, set the run's finish line)
```

## Symptom (as observed)

Run `ed5e7ba9` (5 runs × 24 dept guides, claude-sonnet-4-6, maxWorkers 35, cloud):

- 2 × `agent.structured_output.coercion_failed` — `logs/comment-resolution-check.log` lines **71853** (`crc-SP-3.md`/run-1, index 5, 17:57:08Z) and **93460** (`crc-SP-3.md`/run-4, index 77, 18:13:55Z). Both show `attempts: [{topLevelKeys:["__unparsedToolInput"], hasFindingsArray:false} ×5]`, `schema_errors: []`.
- Both cells recovered on outer retry #1 after a 7s backoff; findings files present and valid; no data lost.
- Cost: 10 wasted StructuredOutput attempts + **~70 min of discarded agent compute** (38.8 + 31.6 min sessions re-done). Wall-clock cost ≈ **7 min**: the run-4 retry was the last event of the review step (18:35:24 vs. next-latest cell 18:28:26).
- The milder tail: 26 unparsed attempts across 17 cells total; the other 15 cells recovered inside the SDK's internal retries with no orchestrator-visible event.

Tempting-but-wrong first guesses, eliminated by the data:

- *"The June double-wrap storm is back"* — no. Zero `topLevelKeys:["findings"]`/`["data"]`/`["output"]` signatures, zero `must have required property 'grouping'`, zero `/findings: must be array` in 96,460 log lines. The envelope reflex is closed on sonnet-4-6; this is a different animal (parse-level, not shape-level).
- *"The model is emitting invalid JSON"* — not exactly. Every captured `raw` is a *prefix of valid JSON* cut mid-word (see samples). The model was emitting fine; the input that reached the SDK's parser is incomplete.
- *"It's random flakiness"* — no. Failure probability tracks payload size: the 3 smallest truncations (6.5–7.2k) are one-off blips on small guides that recovered instantly, while `crc-SP-3` — whose complete payload is the run's largest — failed **11 of its emit attempts across 3 of its 5 cells**, including 10-for-10 in the two storm cells. Guide size is the dominant risk factor.

## Evidence chain

1. **The coercion_failed events are parse-level, not schema-level.** Both events log `schema_errors: []` — ajv produced no errors because ajv never ran; there was no parsed object to validate. Raw event, line 71853 (abridged): `{"level":50, "item":"crc-SP-3.md", "runIndex":"run-1", "event":"agent.structured_output.coercion_failed", "attempts":[{"kind":"object","topLevelKeys":["__unparsedToolInput"],"hasFindingsArray":false} ×5], "schema_errors":[], "msg":"Agent exhausted structured-output retries and could not be repaired"}`. **Empty `schema_errors` + `__unparsedToolInput` is the fingerprint distinguishing this variant from the June bug** (which logged real ajv errors like `must have required property 'grouping'`).

2. **`__unparsedToolInput` is the SDK's unparseable-input sentinel, not anything conductor or bureau produces.** The key appears nowhere in `conductor/src` or `bureau/` — it arrives inside `block.input` on `StructuredOutput` tool_use blocks (captured at `conductor/src/agent/runner.ts:395-397`), shaped `{raw: "<first ~2k chars>", len: <full length>}`. Conductor is a faithful recorder here.

3. **Every captured payload is truncated mid-emission.** All 26 `raw` values end mid-word inside a JSON string — e.g. crc-PR/run-2 (len 17,418) ends `…The absence of any park`; crc-CA-3/run-1 (len 6,476) ends `…six distinct Mitigation Tot`. **These are prefixes of well-formed emits, cut off in flight** — not malformed JSON authored by the model.

4. **The emit turn was never finalized.** On all 26 attempts the assistant message record has `stop_reason: null` and `usage.output_tokens: 0`. A model that cleanly hit a max-token ceiling would stamp `stop_reason:"max_tokens"`; a clean finish stamps `"tool_use"`. **Null + zero usage means the stream was abandoned before the turn closed — the cut is in delivery, not a deliberate stop.**

5. **Failure risk scales with payload size.** The 26 truncation lengths: 3 attempts at 6.5–7.2k (crc-CA-3), 5 at 15–18k (crc-CM, crc-PR), and **18 at 34–45k** — the latter all on the run's heaviest guides (SP-3 ×11, SP-2, SP-1, DE-1, CA-1, CA-2, WQ ×2). crc-SP-3's complete findings payload is inherently the largest (20 items with verbose observations; its cells average 36.9 min), and it is the only guide whose emits failed 5-in-a-row — twice. **The longer the emit must stream, the higher the odds it never completes; only the biggest guide rolled five failures consecutively.**

6. **conductor#197's repair was invoked and is structurally blind to this input.** `runner.ts:277-299`: on `error_max_structured_output_retries` it calls `tryRepairStructuredOutput({lastInput, …})`, whose strategies re-wrap a *parsed* object (inject missing `grouping`, unwrap a double-wrapped envelope). `lastInput` here is `{__unparsedToolInput:{raw,len}}` — no findings array exists at any depth, so repair correctly returns null and the failure goes terminal. **The only existing safety net for exhausted retries requires parseable input, which is precisely what this variant never has.** (`coercion_repaired` count this run: 0.)

7. **The June fixes work; this is the residual.** The lenient-envelope path (`agent.structured_output.normalized`, `strategy:"inject_grouping"`) fired exactly once per cell ×120 — benign and universal. Zero double-wrap signatures anywhere. **Variant 1 (envelope shape) is effectively closed on sonnet-4-6; variant 2 (delivery truncation) is what remains.**

## Timeline

| Date | Event | Relevance |
|---|---|---|
| 2026-06-19 | First smoke run: 11 coercion_failed, all double-wrap (`topLevelKeys:["findings"]`, real ajv errors) | variant 1 filed as `STRUCT-OUTPUT-RETRY-STORM.md` |
| 2026-06-24/25 | Lenient emit schema + conductor#197 (deterministic envelope repair) + bureau#459 | closes variant 1's shape failures |
| 2026-07-06 | SDK 0.3.201 tool_use guard regression (conductor#211) | unrelated, but pins the SDK version this run used |
| 2026-07-13 | Baseline run `bfb4f256` (72 cells, haiku-4-5): 0 coercion_failed, 0 unparsed attempts | variant 2 absent on smaller model/payloads |
| 2026-07-14 | Game-day run `ed5e7ba9` (120 cells, sonnet-4-6): 26 unparsed attempts / 17 cells / 2 storms | **variant 2 first observed** |
| 2026-07-16 | Diagnosed via `audit-crc-run` Agent 1 + this deep-dive | — |

Corollaries: sonnet-4-6 writes materially longer observations than the haiku baseline (mean cell 962s vs 914s on 3× the per-cell items; 676 vision calls vs 148), so **the model upgrade is what pushed emit sizes into the failure zone** — expect this variant on every future sonnet-class CRC run whose largest guides remain unsplit. Probabilistic per-attempt, so counts will vary run to run; zero events on a given run does not prove closure.

## Root cause

Exact chain, most upstream first:

1. **Emit sizes**: `crc-SP-3.md` (20 atomic items) produces a single StructuredOutput input of ~35–45k chars on sonnet-4-6. The schema/prompt design emits **all findings in one tool call** (`bureau/workflows/comment-resolution-check/schemas/crc.schema.json` — root object with `findings[]` required).
2. **Delivery**: at those sizes the streamed tool-input frequently arrives incomplete (evidence #3/#4; the precise cutting layer — model stream, API edge, or SDK accumulation in `@anthropic-ai/claude-agent-sdk` 0.3.201 — is not determinable from conductor's logs and needs an SDK-side repro; note the truncations spread 34–45k rather than clustering at one hard cap, which disfavors a simple fixed limit).
3. **Sentinel**: the SDK surfaces the partial input as `{__unparsedToolInput: {raw, len}}` instead of a parsed object.
4. **The blind spot** — `conductor/src/agent/runner.ts:277-315`: the exhaustion handler's only recovery is `tryRepairStructuredOutput`, which by design "repairs the last attempt deterministically" *given a parsed object*. Missing invariant, precisely: **the repair path assumes `lastInput` is parsed JSON whose problem is shape; it has no strategy for `raw` being a truncated-but-mostly-complete JSON prefix.** Near-miss irony: the sentinel carries the full partial text (`raw`) and its length (`len`) — enough material for a truncation-aware salvage or a "resume from item N" re-prompt — and the handler reads neither.

## Sample request/response models

Real captured attempt (crc-SP-3/run-1, log line 51166 — one of the 5 storm attempts):

```jsonc
// What the model was emitting (reconstructed intent — a valid ~36k-char envelope):
{"findings": [
  {"checklistItemId": "SP-33.1",
   "observation": "Sheet 16 (Site Notes and Tables), Block 4 (Project Tracking Table) states proposed open space as 0.26 ac / 11,350 SF / 5%. The Landscape Calculation Plan (Sheet 56, L-003), Block 3 (Symbols Legend) designat…",
   // … 19 more items …

// What reached conductor (block.input on the StructuredOutput tool_use):
{"__unparsedToolInput": {
   "raw": "{\"findings\": [\n  {\n    \"checklistItemId\": \"SP-33.1\",\n    \"observation\": \"Sheet 16 (Site Notes and Tables), Block 4 (Project Tracking Table) states proposed open space as 0.26 ac / 11,350 SF / 5%. The Landscape Calculation Plan (Sheet 56, L-003), Block 3 (Symbols Legend) designat…",   // ← prefix only, ends mid-word
   "len": 36439                                    // ← full accumulated length before the cut
}}
// assistant message metadata on this turn:  stop_reason: null, usage.output_tokens: 0   ← never finalized

// conductor's per-attempt summary (what the coercion_failed event shows):
{"kind": "object", "topLevelKeys": ["__unparsedToolInput"], "hasFindingsArray": false}
// ajv: never invoked → schema_errors: []
```

The five attempts in this cell measured 35,228 / 35,390 / 36,439 / 36,636 / 38,398 chars — five independent emits of the same findings set, all cut before completion.

## Impact

| Consumer / surface | Status | Mechanism |
|---|---|---|
| Findings correctness (this run) | **unaffected** | both storm cells fully recovered on outer retry; all 120 cells' findings present and schema-valid; consolidation saw 291/291 items with 5/5 votes |
| Agent compute / cost | **affected** | ~70 min of discarded session time (two ~35-min sessions re-done, incl. their vision calls); +10 wasted emit attempts; smaller invisible tax from the 24 recovered-in-SDK retries |
| Wall-clock | affected | ≈ +7 min on game day (the run-4 storm retry was the review step's last event); worst case scales badly — a storm on outer retry #2+ or on multiple cells would push much further |
| ⚠️ Worst case: outer-retry exhaustion | **latent** | if all outer retries truncate the same way on an oversized guide (plausible: per-attempt failure odds rise with payload size, and retries re-emit the same-sized payload), the cell's findings are **lost for the run** — 20 checklist items absent from consolidation. Did not happen yet; nothing prevents it. |
| Vote variance (Agent 2's lane) | unaffected this run | no per-run item-set drift; storms did not corrupt which items got scored |
| Every future sonnet-class CRC/CC run with unsplit large guides | **affected, probabilistic** | risk concentrates on crc-SP-3 (2 storms), then crc-SP-2 / crc-DE-1 / crc-CA-1 (1 unparsed attempt each, 39–45k truncation lengths; SP-2 and DE-1 *also* auto-compacted at ~170k pre-tokens — same oversized-guide root) |
| Baseline-style haiku runs | unaffected so far | 07-13 run: zero unparsed attempts (shorter emits) |

Deterministic: no — probabilistic per emit, rising with payload size. Logged: yes at exhaustion (`coercion_failed`, level 50) but **the 24 SDK-internal recoveries emit no orchestrator event at all** — the milder signal is invisible outside a log dive. Cheap detector: `grep -c '__unparsedToolInput' logs/comment-resolution-check.log` per run (this run: 31 hits incl. secondary mentions, 26 distinct attempts); trend it run-over-run.

## Fix directions (not yet implemented — directions, not a mandate)

1. **Shrink the payloads (already the audit's #1 rec, independent motivation):** split `crc-SP-3`, `crc-SP-2`, `crc-DE-1`, `crc-CA-1` via the established `crc-sp` split pattern. Halving item counts roughly halves emit size, pulling the heavy guides out of the 34–45k failure zone. Attacks storms, compactions, and the wall-clock tail simultaneously. Cheapest, no code.
2. **Truncation-aware salvage in `tryRepairStructuredOutput`:** on `__unparsedToolInput`, take `raw`, close open strings/brackets (or use a tolerant parser), and check whether ≥1 complete finding object is recoverable. **Hazard:** a truncated `findings[]` parses "successfully" while silently missing trailing items — any salvage MUST cross-check recovered `checklistItemId`s against the guide's atomic item list and treat a shortfall as failure (or trigger a targeted re-prompt: "emit only items ⟨missing⟩"). Never accept a partial array as the cell's verdict set.
3. **Chunked emission for large guides:** have the agent emit findings in batches (e.g. ≤8 items per StructuredOutput call) and assemble server-side, or emit per-item. Keeps every tool-input small enough to deliver reliably. Requires schema + prompt + collector changes; the most robust long-term shape.
4. **SDK-side investigation (upstream):** repro a ~40k-char tool-input emit on `@anthropic-ai/claude-agent-sdk` 0.3.201 and find which layer drops the stream (the 34–45k spread suggests a race/timeout, not a fixed cap). Also: surface `stop_reason`/partial-usage on unfinalized turns so the cut is attributable. Candidate for an SDK issue report.
5. **Observability floor:** emit an orchestrator event (level 40) on *every* unparsed attempt, not just exhaustion — `event: agent.structured_output.unparsed_attempt` with `{len, item, runIndex, attempt}` — so the per-run trend is queryable in Better Stack without a log dive, and add the grep above to the audit skill's standard checks (done informally in run-6's audit; make it permanent).
6. **Update the closure criterion in `STRUCT-OUTPUT-RETRY-STORM.md`:** keep "zero `coercion_failed`" as the bar but note it now covers two variants with different fingerprints (ajv errors vs. `__unparsedToolInput` + empty `schema_errors`), and that variant 2 is probabilistic — sustained zero across multiple sonnet runs, plus a near-zero unparsed-attempt trend, is the real bar.

## Prior art

- `winston/workspaces/comment-resolution-check/crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md` — variant 1 (double-wrap); its "What the agent actually emits" section is the shape this variant does NOT match.
- `conductor/src/agent/runner.ts:216-315` — attempt tracking, repair invocation, and the `coercion_failed` emission; `:395-397` — where `block.input` (incl. the sentinel) is captured. The repair function itself (`normalizeStructuredOutput` / `tryRepairStructuredOutput`, imported at `:15-17`) is the natural home for fix #2.
- The audit's compaction finding (run-6 Agent 1 §7): crc-SP-2/run-1 and crc-DE-1/run-4 each had one unparsed emit attempt *before* auto-compacting at ~170k pre-tokens — independent evidence that the same oversized guides stress two different mechanisms.

## Reproduction / verification recipe

Cold verification against the incident (read-only):

1. **Artifacts:** storage bucket `workflow-runs`, prefix `comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-07-14-183605/`. Download `logs/comment-resolution-check.log` (112 MB — grep only).
2. **The two storms:** `grep -n 'coercion_failed' <log>` → exactly lines 71853 (`crc-SP-3.md`/run-1) and 93460 (`crc-SP-3.md`/run-4); confirm `schema_errors:[]` and 5× `__unparsedToolInput` attempts in each.
3. **The truncation fingerprint:** for any line matching `__unparsedToolInput`, extract `message.content[].input.__unparsedToolInput` → `{raw, len}`; confirm `raw` ends mid-string, `json.loads(raw)` fails, the parent message has `stop_reason: null` and `usage.output_tokens: 0`. Unambiguous single case: line 51166 (`crc-SP-3.md`/run-1, len 36,439, raw ends `…Block 3 (Symbols Legend) designat`).
4. **Recovery happened:** `output/runs/run-1/findings/crc-SP-3.md.json` and `run-4/…` exist and validate; `output/consolidated-findings.json` has 5/5 `runCount` on every SP-3 item.
5. **Distinguish from variant 1:** `grep -c 'must have required property' <log>` → 0; `grep -c 'topLevelKeys":\["findings"\]' <log>` → 0.
6. **Acceptance test for any fix:** on the next comparable sonnet-class run (a) `coercion_failed` count = 0, (b) unparsed-attempt count ≈ 0 (fix #1/#3) or every unparsed attempt either salvaged-with-complete-item-coverage or re-prompted (fix #2), and (c) no review cell's wall-clock includes a discarded ≥30-min session attributable to emit truncation.
