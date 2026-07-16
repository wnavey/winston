# Structured-output retry storm, variant 2: the model writes unescaped inch-mark quotes (`24"+`) inside JSON strings — large findings emits arrive unparseable and the repair path is blind to them

> **Status**: Diagnosed 2026-07-16, fix NOT implemented. **Rev 2 (2026-07-16): root cause CORRECTED** — rev 1 attributed the unparseable emits to *stream truncation*; a deeper log dive disproved that and identified **model-authored invalid JSON**: unescaped `"` inch marks quoted verbatim from dimensioned plan content (tree calipers, sq-ft callouts). Rev 1's truncation evidence is retracted in "What rev 1 got wrong" below. Root cause lives in the **emit content × the CLI's unhelpful parse-error feedback**, not in the schema, the envelope prompt, conductor's repair logic, or stream delivery. Discovered by the `audit-crc-run` skill on the v5 game-day run: review `ed5e7ba9-ba03-4000-abb4-1021ebec0631`, workflow_run `87370792`, 1700 S Lamar, 2026-07-14, sonnet-4-6. Sibling of `crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md` (variant 1, double-wrap — whose fixes this run shows are fully effective: 0 wrapper signatures in 120 cells). That doc's zero-`coercion_failed` closure criterion is NOT met (2 events), but by a failure mode it never described. Audit detail: `1700-S-Lamar/crc-run-audits/run-6-audit/crc-audit-agent-1-performance-stability.md` §5.

## Summary

On the v5 game-day CRC run, 26 StructuredOutput emit attempts across 17 of 120 review cells arrived at conductor as `{"__unparsedToolInput": {"raw": "<preview>", "len": N}}` — the Claude Agent SDK's sentinel for tool input that failed `JSON.parse`. In 15 cells the next in-session attempt succeeded. In 2 cells — both `crc-SP-3` — **all 5 SDK attempts failed identically**, tripping `error_max_structured_output_retries` → `agent.structured_output.coercion_failed` → a full outer retry that rebuilt each ~35-minute agent session from scratch (~70 min compute discarded; the run-4 storm set the run's finish line, ≈ +7 min wall-clock).

The JSON is invalid because **the model quotes dimensioned plan content verbatim inside JSON string values without escaping the inch marks**. Three failures are caught red-handed inside the logged preview — e.g. crc-CA-3:

```
"observation": "…columns (Heritage 24"+, Appendix F <24", Non-Appendix F, …"
                                     ↑ closes the string; parser dies at "+"
```

This is deterministic per content, which is what makes it a *storm*: crc-SP-3's SP-33.x items force the model to cite the same landscape/open-space tables (`OPEN SPACE = ~12,000 SQ.FT`, tree calipers) on every attempt, and the CLI's error feedback shows only the **first 200 bytes** of a ~36k payload — the model is told its JSON is invalid, sees a flawless prefix, and blindly re-emits the same mistake five times. A fresh outer-retry session words the evidence differently and passes.

What is working correctly: the crc schema, the envelope prompt, ajv (never reached — `schema_errors: []`), conductor's `tryRepairStructuredOutput` (correctly declines: nothing parsed to repair), the outer retry (both cells recovered; zero findings lost), stream delivery (the tool_use turns complete normally — see the handshake evidence), and the June envelope fixes (double-wrap reflex closed on sonnet-4-6).

Root cause in one sentence: **construction content is full of inch marks, sonnet-4-6 quotes it verbatim into JSON strings without escaping, and the pipeline's only feedback on failure — "first 200 bytes" — gives the model no way to find and fix its own escape error, so content-determined failures repeat until the retry budget dies.**

## The bug in one diagram

```
 agent session (one review cell, e.g. crc-SP-3/run-1: 20 items, ~38 min of evidence)
        │
        ▼  final turn: model emits StructuredOutput tool input (~36k chars, streams fine ✓)
 ┌────────────────────────────────────────────────────────────────────────┐
 │ {"findings": [ …                                                       │
 │   {"checklistItemId": "SP-33.1",                                       │
 │    "observation": "…(Heritage 24"+, Appendix F <24", …)…"              │
 │                                 ▲                                      │
 │                                 └── unescaped inch mark: the string    │
 │                                     CLOSES here → rest is not JSON ✗   │
 │  turn completes normally (full payload delivered ✓)                    │
 └────────────────────────────────────────────────────────────────────────┘
        │
        ▼  CLI: JSON.parse(accumulated input) fails
 block.input = { "__unparsedToolInput": { "raw": "<first ~2k chars>", "len": 36636 } }
        │
        ▼  CLI hands the model a tool_result, SAME live session:
 "InputValidationError: StructuredOutput was called with input that could
  not be parsed as JSON. You sent (first 200 of 36636 bytes): {\"…"
        │                       ▲
        │                       └── error is at char ~6,000+; feedback shows
        │                           char 0–200 → model CANNOT find its bug ✗
        ▼
 model thinks ~8s, re-emits the SAME evidence, SAME inch marks (~185 s/attempt)
 attempts ×5 all fail identically (content-determined, not random)
        │
        ▼  error_max_structured_output_retries
 conductor runner.ts:277-282  tryRepairStructuredOutput(lastInput)
   → built for parsed-but-miswrapped objects; input is an unparseable
     string wrapper → returns null                    ✓ correct, blind
        │
        ▼  coercion_failed (level 50) → throw → step-executor outer retry
 fresh session re-gathers evidence, words it differently → parses ✓
 (run-1: 38.8 min discarded; run-4: 31.6 min, set the run's finish line)
```

## Symptom (as observed)

Run `ed5e7ba9` (5 runs × 24 dept guides, claude-sonnet-4-6, maxWorkers 35, cloud):

- 2 × `agent.structured_output.coercion_failed` — `logs/comment-resolution-check.log` lines **71853** (`crc-SP-3.md`/run-1, 17:57:08Z) and **93460** (`crc-SP-3.md`/run-4, 18:13:55Z). Both: `attempts: [{topLevelKeys:["__unparsedToolInput"], hasFindingsArray:false} ×5]`, `schema_errors: []`.
- 26 unparsed attempts across 17 cells total; lengths 6,476–44,850 chars; the 15 other cells recovered in-session with no orchestrator-visible event.
- Attempt cadence in the storms: ~174–194 s apart — the time for the model to re-think and re-stream a same-sized emit (~10k tokens), not a timeout (see Evidence 1).
- Cost: 10 wasted emit attempts + ~70 min discarded agent compute; ≈ +7 min wall-clock (run-4 retry finished 18:35:24 vs next-latest cell 18:28:26).

## Evidence chain

1. **The emits are delivered completely — the "truncation" hypothesis is dead.** The message sequence around every failure (e.g. lines 51166→51167) is: assistant tool_use → **immediate** tool_result `InputValidationError … could not be parsed as JSON. You sent (first 200 of N bytes)…` → thinking → next attempt. A live-session handshake means the API turn completed normally; a cut stream aborts the request and cannot produce a tool_result. **The ~185s attempt cadence is generation time for a ~10k-token re-emit, not a timeout.**
2. **No size cap, no token ceiling.** Successful emits reach 44,279 chars (crc-DE-1/run-5) — larger than most failures; failure lengths (6.5k–44.9k) overlap the success range completely. Estimated thinking+emit tokens: successful turns up to ~75k, failed turns as low as ~10k, against `maxOutputTokens: 32000` config — no ceiling signature in either direction. **Size raises the odds (more dimension-quoting strings per emit) but decides nothing.**
3. **Smoking gun: the syntax error is visible in-frame on 3 failures.** Running `json.loads` over the logged 2,048-char previews: all three crc-CA-3 failures die with `Expecting ',' delimiter` at char 336/392/504 — each at an unescaped inch mark inside a string: `(Heritage 24"+, Appendix F <24", …` (L12956), `…ECM Appendix F (Heritage 24"+, App F <24")…` (L54382), `…Heritage Tree 30"+, Heritage Tree 24"-29.9", 19"+ App F…` (L86983). **The `"` after `24` terminates the JSON string; the `+` that follows is a syntax error.** The other 23 failures' previews cut off (at 2,048 chars) before their error position — same corpus, error out of frame.
4. **Failure is content-determined, not random.** The two storm cells failed **10-for-10** while emits of identical size and shape succeeded elsewhere (e.g. crc-SP-3/run-2: one failure at 42.2k, then success at 40.3k on the next attempt). Under any random per-attempt delivery failure, 10 consecutive failures across two cells is vanishingly unlikely; under content determinism it's expected — **SP-3's SP-33.x items require citing the same dimension-dense landscape tables on every attempt** (the previews repeatedly show `OPEN SPACE = ~12,000 SQ.FT` and Sheet 55/56 tree-preservation content mid-payload).
5. **The feedback loop guarantees the storm.** The CLI's tool_result shows the first 200 bytes of the payload; the actual error sits thousands of chars deep. The model's between-attempt thinking cannot locate the bug, so it re-emits semantically identical content. **Five attempts = five re-rolls of the same loaded dice.** A fresh outer-retry session regathers and rewords the evidence — new dice — and passes.
6. **conductor#197's repair was invoked and is structurally blind to this input.** `runner.ts:277-299`: on exhaustion it calls `tryRepairStructuredOutput`, whose strategies re-wrap a *parsed* object. `lastInput` is `{__unparsedToolInput:{raw,len}}` — no findings array at any depth — so repair correctly returns null. (`coercion_repaired` this run: 0.) **The only safety net requires parseable input, which is exactly what this variant never has** — despite the failure being one character-escape away from valid.
7. **The June fixes work; this is the residual.** Zero double-wrap signatures anywhere in 96,460 log lines; the benign `inject_grouping` normalization fired exactly once per cell ×120. Variant 1 (envelope shape) is closed on sonnet-4-6; variant 2 (content escaping) is what remains.

## What rev 1 got wrong (retractions)

Rev 1 concluded "emit truncation" from three observations that do not survive scrutiny:

- *"Every payload ends mid-word"* — the inspected tails were the tails of the **2,048-char logging preview** (the SDK truncates `raw` for the record and reports full `len` separately), not of the payload. The payloads' actual endings are not in any log.
- *"`stop_reason: null`, `output_tokens: 0` — the turn was never finalized"* — those fields are null/0 on **successful** emit turns too; they are uninformative in conductor's message log.
- *"The 34–45k spread suggests a race/timeout"* — the spread is just the natural size range of complete heavy-guide payloads; successful emits occupy the same range.

The corrected mechanism (unescaped quotes) additionally explains what truncation never could: the 10-for-10 within-session determinism, the tiny 6.5k failures on the 2-item crc-CA-3 guide, and why fresh sessions pass at the same payload size.

## Timeline

| Date | Event | Relevance |
|---|---|---|
| 2026-06-19 | First smoke run: 11 coercion_failed, all double-wrap (real ajv errors) | variant 1 filed |
| 2026-06-24/25 | Lenient emit schema + conductor#197 + bureau#459 | closes variant 1 |
| 2026-07-13 | Baseline run `bfb4f256` (haiku-4-5): 0 coercion_failed, 0 unparsed attempts | haiku's terse observations rarely quote dimensions verbatim |
| 2026-07-14 | Game-day run `ed5e7ba9` (sonnet-4-6): 26 unparsed / 17 cells / 2 storms | **variant 2 first observed** — sonnet quotes sheet text verbatim, inch marks included |
| 2026-07-16 | Diagnosed (rev 1: truncation); same-day deep-dive corrected to unescaped quotes (rev 2) | — |

Corollary: expect this on every sonnet-class run whose guides force verbatim citation of dimensioned content (calipers, pipe/meter sizes, sq-ft tables) — probabilistic per cell, near-deterministic for cells whose *required evidence* contains inch marks (the SP-33.x / CA-3 tree-matrix pattern).

## Sample request/response models

Real captured failure, crc-CA-3/run-1 (log line 12956, len 6,476) — error **in frame**:

```jsonc
// block.input on the StructuredOutput tool_use (SDK sentinel):
{"__unparsedToolInput": {
   "raw": "{\"findings\": [\n  {\n    \"checklistItemId\": \"CA-21\",\n    \"observation\": \"…'[EMC 3.5.4]' matrix with Existing Tree Survey columns (Heritage 24\"+, Appendix F <24\", Non-Appendix F, Inva…",
   //                                              the model wrote, unescaped:  (Heritage 24"+, Appendix F <24", …
   //                                              json.loads → Expecting ',' delimiter @ char 336
   "len": 6476
}}

// what the model then received as feedback (tool_result, verbatim shape):
<tool_use_error>InputValidationError: StructuredOutput was called with input
that could not be parsed as JSON.
You sent (first 200 of 6476 bytes): {"…
// ← error is at char 336+; feedback ends at char 200 → unfindable
```

And the storm shape, crc-SP-3/run-1 (five attempts, lines 51166→71850): lens 36,636 / 36,439 / 35,390 / 35,228 / 38,398 — five complete re-emits of the same evidence set, ~185 s apart, previews all mid-payload showing the same `OPEN SPACE = ~12,000 SQ.FT` landscape-table citations. Contrast the eventual success (fresh session, L95399): same items, differently worded, parses.

## Impact

| Consumer / surface | Status | Mechanism |
|---|---|---|
| Findings correctness (this run) | **unaffected** | both storm cells recovered on outer retry; all 120 cells' findings present and schema-valid |
| Agent compute / cost | **affected** | ~70 min discarded session time + 10 wasted ~10k-token emits; smaller tax from the 24 in-session recoveries |
| Wall-clock | affected | ≈ +7 min on game day; scales with storms per run |
| ⚠️ Worst case: outer-retry exhaustion | **latent, content-gated** | a cell whose *required* evidence contains inch marks can fail every outer retry the same way → its findings silently absent from consolidation. crc-SP-3 and crc-CA-3 are the standing candidates; nothing prevents it today. |
| Vote variance | unaffected this run | no per-run item-set drift |
| Future sonnet-class CRC/CC runs | **affected, recurring** | any guide forcing verbatim citation of dimensioned tables re-rolls these dice every run |
| Haiku-class runs | unaffected so far | terse observations; 07-13 baseline had zero unparsed attempts |

Deterministic: per-content, near-deterministic for dimension-heavy cells; probabilistic across a run. Logged: `coercion_failed` at exhaustion only — the 24 in-session failures emit no orchestrator event. Cheap detector: `grep -c '__unparsedToolInput' logs/comment-resolution-check.log` per run; trend it.

## Fix directions (not yet implemented — directions, not a mandate)

1. **Deterministic salvage — this variant is mechanically repairable.** An escape-aware lenient parse (jsonrepair-style; or targeted: re-escape a `"` that appears inside an open string followed by non-structural characters — the inch-mark signature) recovers every observed failure. It must run **where the full raw string exists** — the SDK/CLI layer, or conductor if the sentinel is extended to carry full `raw` (today's record truncates to ~2k chars). Extend `tryRepairStructuredOutput` with this strategy and gate acceptance on ajv + complete `checklistItemId` coverage vs the guide's item list (never accept a repair that silently drops items).
2. **Fix the feedback, break the loop:** the CLI's `InputValidationError` should include the **parse-error position and ±100 chars of context** instead of the first 200 bytes. With that, the model fixes its escape on attempt 2 and storms cannot happen. (Upstream `@anthropic-ai/claude-agent-sdk` change; worth filing.)
3. **Prompt-level mitigation (cheap, ships today):** in the emit instructions, require dimensions be written as `24-in` / `24 inch` — never a literal `"` inch mark — inside JSON strings. Add to the CRC (and CC) review prompts' output rules.
4. **Guide splitting** (see `OVERSIZED-GUIDES-TAIL-STORMS-COMPACTION-VARIANCE.md`) now *helps probabilistically* (fewer dimension-citing strings per emit, cheaper retries) but is **no longer the primary fix for this bug** — a split crc-CA-3 would still fail on its tree-caliper matrix.
5. **Observability floor:** emit a level-40 orchestrator event per unparsed attempt (`event: agent.structured_output.unparsed_attempt`, `{len, item, runIndex, attempt}`) so the trend is queryable without a log dive; add the grep detector to the audit skill's standard checks.
6. **Update variant 1's closure criterion:** zero `coercion_failed` now spans two variants with distinct fingerprints (ajv errors vs `__unparsedToolInput` + empty `schema_errors`); sustained zero across sonnet runs plus a near-zero unparsed-attempt trend is the real bar.

## Prior art

- `crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md` — variant 1; its repair (conductor#197) is the natural host for fix #1's new strategy.
- `conductor/src/agent/runner.ts:216-315` (attempt tracking, repair invocation, coercion_failed emission), `:395-397` (sentinel capture).
- The bureau#459 lenient-emit-schema precedent — same lever class as fix #3 (make the format forgiving where the model predictably errs).

## Reproduction / verification recipe

Cold verification against the incident (read-only):

1. **Artifacts:** bucket `workflow-runs`, prefix `comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-07-14-183605/`; grep the 112 MB log, never read whole.
2. **The storms:** `grep -n 'coercion_failed'` → lines 71853, 93460 (`crc-SP-3.md` run-1/run-4); confirm `schema_errors:[]` and 5× `__unparsedToolInput` attempts each.
3. **The smoking gun:** extract `message.content[].input.__unparsedToolInput.raw` from log lines 12956, 54382, 86983 (the crc-CA-3 failures) and `json.loads` each — all three fail `Expecting ',' delimiter` at char 336/392/504, at an unescaped inch mark (`Heritage 24"+…`). This is the discriminating observation vs rev 1: a *syntax* error mid-content, not an unterminated tail.
4. **The handshake (disproves truncation):** log line 51167 — the tool_result `InputValidationError … (first 200 of 36636 bytes)` delivered to the live session immediately after the failed tool_use at 51166.
5. **No size cap:** largest successful emit = 44,279 chars (`crc-DE-1.md`/run-5, line 95268) > most failures.
6. **Acceptance test for a fix:** on the next comparable sonnet run — (a) `coercion_failed` = 0; (b) unparsed attempts ≈ 0 (fix #3) or every one salvaged with full item coverage (#1) or corrected on the following attempt (#2); (c) as a direct unit test for #1/#2: feed the line-12956 raw string through the repair path — it must produce the valid envelope with the `Heritage 24"+` inch marks correctly escaped.
