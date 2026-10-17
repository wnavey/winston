# Structured-output emit, parse, and retry mechanics — where the 5 attempts live, what `coercion_failed` is, and every lever we have

**Status:** Draft v1
**Date:** 2026-07-17
**Repos touched:** none — descriptive sub-spec of [`DESIGN-SPEC.md`](./DESIGN-SPEC.md) (CRC review step architecture)
**Grounding:** conductor@main (post-#230), `@anthropic-ai/claude-agent-sdk` 0.3.201 (bundled CLI 2.1.201), run `ed5e7ba9` artifacts
**Prior art:** `bugs/STRUCT-OUTPUT-UNPARSED-EMIT-VARIANT.md` (variant 2, inch marks), `crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md` (variant 1, double-wrap)

## Problem

The run-6 audit and the inch-mark bug doc reference "5 SDK attempts", `coercion_failed`, and "the
outer retry" without a single place that explains where each mechanism lives, who owns it, what it
can and cannot see, and which of them we can configure. This sub-spec is that place. It also answers
four specific questions from the game-day post-mortem, with fresh evidence pulled for this spec:

- **Q-A**: The final crc-CA-3 resolution text still contains `"` inch marks (`…all 8"-or-greater…`).
  Does that mean the model knew to escape them?
- **Q-B**: When the model retried in-session, did it have any hint the failure was the unescaped
  quote — or was fixing it a guess?
- **Q-C**: WHEN does `JSON.parse` actually run? After the full emit? Whose code is it?
- **Q-D**: Where do the 5 attempts, `coercion_failed`, and our retry configuration live?

Short answers up front: **A — yes, the successful emit escaped them (verified in the run artifact);
B — no useful hint: the feedback's "Common causes" list names backslashes, control characters, and
truncation, never quotes, so the in-session fix was model inference; C — inside the agent-SDK's
bundled CLI, once the tool_use block finishes streaming, before conductor ever sees the input;
D — SDK-hardcoded (5), conductor `runner.ts:347` (coercion_failed), bureau workflow.yaml
`retries: 5` (outer).** The rest of the doc is the full mechanism.

## 1. The whole stack in one diagram

```
 LAYER 0 — the model (per agent session = one review cell)
   final turn: calls StructuredOutput tool; input streams over the API
   as input_json_delta chunks (a ~6k–45k char JSON string for CRC)
        │ tool_use block completes (turn ends normally)
        ▼
 LAYER 1 — claude-agent-sdk bundled CLI  (SDK 0.3.201 / CLI 2.1.201)
   accumulate deltas ──► JSON.parse(accumulated)          ◄── Q-C: HERE
        │ parse OK                     │ parse FAILS
        ▼                              ▼
   ajv-style schema check         block.input := {__unparsedToolInput:
        │ OK        │ schema fail        {raw: first ~2k chars, len}}
        │           ▼                  ▼
        │      tool_result:        tool_result to the SAME live session:
        │      "Output does not    "<tool_use_error>InputValidationError:
        │       match required      StructuredOutput was called with input
        │       schema: /path"      that could not be parsed as JSON.
        │           │               You sent (first 200 of N bytes): …
        │           │               Common causes: unescaped backslashes in
        │           │               file paths (use / or \\), unescaped
        │           │               control characters, or truncated output.
        │           │               Retry with valid JSON.</tool_use_error>"
        │           └──────┬───────────┘
        │                  ▼
        │        model re-emits (attempt++) — UP TO 5 ATTEMPTS TOTAL,
        │        hardcoded in the CLI, no SDK option to change it
        │                  │ budget exhausted
        │                  ▼
        │        result message subtype: 'error_max_structured_output_retries'
        ▼                  │
 LAYER 2 — conductor runner.ts (per-session, one shot)                 
   success path:           │  runner.ts:320 catches the subtype
   normalizeStructured-    ▼
   Output() injects        tryRepairStructuredOutput(lastInput)
   `grouping` from cell    (structured-output-repair.ts:194-258 — 4 envelope
   filename, canonical-     rewrap strategies + ajv re-validation)
   izes lenient emit →       │ repaired: cell completes  │ null (e.g. input
   {grouping, findings}      ▼ event: coercion_repaired  │ is the sentinel)
   (runner.ts:382-399)                                   ▼
                              event: agent.structured_output.coercion_failed
                              (runner.ts:347, level 50) ──► THROW
                                                             │
 LAYER 3 — conductor step-executor (per cell)                ▼
   catch → if retryCount < step.retries (CRC yaml: 5; default 2):
     backoff = min(2s·2^n + jitter, 30s)   (rate-limit: 15s·2^n, cap 120s)
     re-run the cell in a COMPLETELY FRESH agent session
     (re-gathers all evidence — ~35 min for crc-SP-3)
   else: markFailed(cell) → step fails (CRC review has no continueOnFailure)
```

## 2. Layer 0/1 — the emit and the CLI parse (Q-C in full)

When a step declares `schema:`, conductor passes
`outputFormat: { type: 'json_schema', schema }` to the SDK's `query()`
(`step-executor.ts:859-864`, `runner.ts:298`). The SDK materializes a `StructuredOutput` tool from
that schema and instructs the model that its final answer must be delivered by calling it. The
schema's own validation and the parse of the tool input happen **inside the bundled CLI binary**
(the SDK spawns it as a subprocess) — none of this is conductor code, and none of it is reachable
from conductor's process.

Timing: tool input streams from the API as `input_json_delta` chunks. The CLI accumulates the raw
string and runs `JSON.parse` **once the tool_use block completes** — i.e. after the model has
finished emitting the entire payload, at the end of a normally-completed turn. This is why the bug
doc's "truncation" rev-1 theory was wrong-by-construction: a cut stream aborts the API request and
never yields the tool_result handshake we observe in the logs.

On parse failure the CLI does two things:

1. Replaces the block's input with the sentinel `{__unparsedToolInput: {raw, len}}` — `raw`
   truncated to ~2,048 chars, `len` the authoritative full size. This is what conductor's message
   log records (and why the actual syntax error is usually out of frame).
2. Feeds a `tool_use_error` tool_result back into the **same live session**. Verbatim, captured from
   the `ed5e7ba9` run log for this spec (crc-PB, 17,418-byte emit):

   ```
   <tool_use_error>InputValidationError: StructuredOutput was called with input
   that could not be parsed as JSON.
   You sent (first 200 of 17418 bytes): {"findings": [\n  {\n    "checklistItemId": "PR-3",\n    "observation": "Examined Sheet 1 (Cover Sheet, Block 5 General Notes and Block 8 Site Data), Sheet 16 (Site Notes and Tables, Blocks 1-4), Sheet 4
   Common causes: unescaped backslashes in file paths (use / or \\), unescaped
   control characters, or truncated output. Retry with valid JSON.</tool_use_error>
   ```

Schema-validation failure (parse OK, shape wrong) produces the *other* error string,
`Output does not match required schema` + a JSON-pointer path. Both error classes burn attempts from
the same in-session budget; conductor#228 taught the `coercion_failed` diagnostics to capture both
wordings (the original code only matched the schema string).

**The feedback is structurally incapable of localizing an escape error (Q-B).** Three properties:
(i) it shows the first 200 bytes, while the inch-mark error sits thousands of characters deep;
(ii) the 200-byte prefix is *flawless JSON*, actively suggesting the payload is fine;
(iii) the "Common causes" list enumerates backslashes, control characters, and truncation —
**unescaped interior quotes are not on the list.** A model that fixes the quote on the next attempt
did so by its own inference (or by luckily rewording), not because the feedback pointed at it.

## 3. What actually happened on the inch-mark cells (Q-A, Q-B evidence)

**crc-CA-3 — failed then self-corrected in-session.** Attempt 1 (log line 12956, 6,476 bytes) emits
`…(Heritage 24"+, Appendix F <24", …` — raw quotes, parser dies at char 336. The persisted winning
emit for the same cell (`output/runs/run-1/findings/crc-CA-3.md.json`, pulled from the run bucket for
this spec) contains the **same tree-caliper content with the quotes properly escaped** — the stored
JSON carries `Heritage 24\"+, App F <24\"`, which renders as `Heritage 24"+` in the final text. So:

- **Yes (Q-A): any `"` inch mark you see in final resolution/observation text — e.g. the CA
  resolution "Add specific plan-drawing callouts within the CRZs of all 8"-or-greater…" — was
  emitted as `\"` in the raw JSON.** Valid JSON is a hard precondition for the finding existing at
  all; unescaped variants never made it out of Layer 1.
- The model demonstrably **knows how** to escape; the failure mode is *inconsistent application*
  during long dimension-dense emits, not a capability gap. (Note the winning emit also abbreviates
  differently — "App F" vs "Appendix F" — consistent with a re-roll that happened to escape, guided
  at most by generic inference from "could not be parsed as JSON".)
- CA-3 is a 2-item guide (~6.5k emits): few quoted dimensions per attempt → each re-roll has a real
  chance of coming out clean. It failed 3 times across the run's 15 cells that recovered in-session.

**crc-SP-3 — the storm.** 20 items, ~36k emits whose SP-33.x items *require* citing the same
landscape/open-space tables every time. 5/5 in-session attempts failed identically on run-1 AND
run-4 (10-for-10) — with more quoted dimensions per emit, the per-attempt "clean re-roll"
probability collapses, and the useless feedback guarantees no directed fix. Both cells then
recovered on the Layer-3 outer retry: a fresh session re-gathered evidence and worded it differently
(~70 min discarded compute, ≈ +7 min wall-clock).

Going forward the trigger is suppressed at the source: bureau#591 (merged 2026-07-16) adds a
CRITICAL emit rule to CRC's and CC's `review.md` — dimensions as `24-in` / `30-in+`, never a literal
`"` inside a JSON string — so post-#591 outputs shouldn't contain inch marks at all, escaped or not.

## 4. Layers 2–3 — conductor's side (Q-D in full)

**Attempt observability** (`runner.ts:440-465`): every StructuredOutput tool_use is summarized into
`structuredOutputAttempts`; since conductor#229, each sentinel-shaped input additionally emits a
level-40 `agent.structured_output.unparsed_attempt` event `{len, attempt, checklistItem, runIndex}` —
making the in-session failures (24 of 26 on game day) queryable without a log dive.

**`coercion_failed` is a conductor log event, not an SDK concept.** When the SDK result arrives with
subtype `error_max_structured_output_retries` (`runner.ts:320`), conductor makes exactly one repair
attempt: `tryRepairStructuredOutput(lastInput)` (`structured-output-repair.ts:194-258`), four
strategies — `wrap_bare_findings_array`, `wrap_findings_with_grouping`, `unwrap_findings_object`,
`unwrap_wrapped_envelope` — each re-validated with ajv before acceptance. All four operate on a
**parsed** object; the unparsed-input sentinel has no findings array at any depth, so repair
correctly returns null for variant-2 failures. Then `runner.ts:347` logs
`agent.structured_output.coercion_failed` (level 50, with the attempt summaries and captured
schema/parse errors) and **throws** — that throw is the hand-off from Layer 2 to Layer 3.

On the *success* path, `normalizeStructuredOutput()` (`structured-output-repair.ts:286-336`, called
at `runner.ts:382-399`) canonicalizes the lenient emit: injects `grouping` derived from the cell's
guide filename (strategy `inject_grouping` — the benign event that fires once per cell) and returns
the strict `{grouping, findings}` shape that gets written to disk. This is the bureau#459 lenient-
emit design: the agent never types `grouping`, removing the variant-1 double-wrap trigger.

**Outer retries are configured in the bureau yaml and executed by the step-executor.**
`maxRetries = step.retries ?? 2` (`step-executor.ts:1026` for the parallel-agent path) — CRC's
review step sets `retries: 5`. Any thrown cell error counts (coercion_failed, transport errors, SDK
crashes — there is no error-class discrimination). Backoff:
`min(base · 2^n + jitter(0–5s), cap)` with base/cap = 2s/30s, or 15s/120s for `RateLimitError`
(`step-executor.ts:86-92`). Each retry is a **from-scratch session** — new context, fresh evidence
gathering; nothing from the failed session is reused. Exhaustion → `checklistManager.markFailed` →
the step reports failure (CRC's review step does not set `continueOnFailure`, so a permanently
failing cell fails the run — the "latent worst case" in the bug doc's impact table).

Note the multiplication: a fully cursed cell burns 5 in-session attempts × (1 + 5 outer retries) =
up to 30 emit attempts and ~3.5 hours of agent compute before the run fails. Game day consumed 2 of
the 5 outer retries on each storm cell.

## 5. Levers and knobs

What we can turn today, per layer:

| Lever | Layer | Where | Notes |
|---|---|---|---|
| Emit-content rules (inch marks, wrapper shape) | 0 | bureau `prompts/review.md` (CRC+CC per bureau#591/#459 precedent) | shipped; cheapest, model-behavior dependent |
| Model choice | 0 | workflow input `model` | haiku's terse observations produced **zero** unparsed emits on the 07-13 baseline; sonnet quotes plans verbatim. Verbosity of evidence prose is itself a storm-exposure knob |
| Effort | 0 | workflow input `effort` | untested against this failure mode |
| Emit schema shape (lenient envelope) | 0/1 | bureau `schemas/*.emit.schema.json` | closed variant 1; cannot help variant 2 (never parses) |
| Guide splitting | 0 | generated guides (SP-3/SP-2/DE-1/CA-1) | fewer dimension-citing strings per emit → probabilistic relief + cheaper retries; not a complete fix (CA-3 is tiny and still failed) |
| In-session attempt count (5) | 1 | **not configurable** — hardcoded in the CLI; no SDK option (`sdk.d.ts` exposes only `outputFormat`, `maxOutputTokens`, `model`, …) | changing it means an upstream SDK/CLI change |
| Parse-error feedback content | 1 | **not configurable** — CLI-owned template | the highest-leverage upstream fix: include error position ±context, and add unescaped quotes to "Common causes". Worth filing against claude-agent-sdk |
| Sentinel `raw` truncation (~2k) | 1 | **not configurable** | blocks conductor-side deterministic salvage; extending it (or passing full raw) is the enabler for jsonrepair-style recovery in `tryRepairStructuredOutput` |
| Repair strategies | 2 | conductor `structured-output-repair.ts` | natural host for an escape-aware salvage IF full raw ever reaches conductor; gate on ajv + full checklistItemId coverage |
| Attempt/failure observability | 2 | conductor#228 (error capture) + #229 (`unparsed_attempt` event) | shipped; trend the per-run unparsed count |
| Outer retry budget | 3 | bureau workflow.yaml `retries:` | per-cell, fresh session; CRC review = 5 |
| Backoff profile | 3 | conductor `step-executor.ts:86-92` | code-level, shared by all workflows |
| Cell-failure posture | 3 | workflow.yaml `continueOnFailure` | unset on CRC review (fail-the-run); see DESIGN-SPEC Q1 |
| Concurrency | 3 | workflow.yaml `maxWorkers` / input | cost/wall-clock only; no effect on failure probability |

## 6. Acceptance criteria for "this is fixed"

Inherited from the bug doc, restated against the layers:

1. Next comparable sonnet-class run: `coercion_failed` = 0 **and** `unparsed_attempt` ≈ 0 (the
   prompt rule working at Layer 0), measured via the #229 event, not a log dive.
2. If salvage (Layer 2) is ever built: the captured line-12956 raw string must repair to a valid
   envelope with `Heritage 24"+` correctly escaped and zero dropped `checklistItemId`s.
3. If the upstream feedback fix (Layer 1) ships: an induced unescaped-quote emit must be corrected
   by the model on attempt 2 in-session.

## Open questions

- **Q1** — Do we file the two upstream claude-agent-sdk asks (parse-error position in feedback;
  full/longer `raw` on the sentinel)? Both are small, and the second unlocks conductor-side
  deterministic salvage that would end this failure class regardless of model behavior.
- **Q2** — Should Layer-3 outer retries discriminate error classes? A `coercion_failed` cell gets
  the same 2s-backoff fresh-session treatment as a transient transport error, but its failure is
  content-correlated — the retry's value comes purely from evidence re-wording. Cheap middle
  ground: on coercion_failed retries, prepend a one-line session hint ("previous attempt produced
  unparseable JSON — check quote escaping in dimension citations").
- **Q3** — The `runs:` ensemble multiplies storm exposure linearly (the yaml's own cost note). Post
  bureau#591, is that note stale, or do we keep it until criterion #1 is measured on a real run?
