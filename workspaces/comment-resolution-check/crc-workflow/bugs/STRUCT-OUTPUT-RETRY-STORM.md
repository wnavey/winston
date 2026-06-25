# Structured-Output Retry Storm in CRC `review` Step

> **Status:** Open, non-blocking. Filed 2026-06-20 from the first end-to-end smoke run. **Two fixes in flight as of 2026-06-25 (conductor #197 + bureau #459) — see "Update — 2026-06-25" at the bottom.** The originally-proposed prompt mitigations #1–3 were **never shipped**; the actual 06-24 intervention was a different lever (lenient emit schema) that shifted the failure rather than closing it.
> **Surface:** `bureau/workflows/comment-resolution-check/` (`review` step + `crc.schema.json` + `prompts/review.md`).
> **Severity:** Low correctness impact (all 183 findings eventually produced and persisted to Supabase), measurable cost & wall-clock waste.

## What happened

During the first full-workflow smoke run on Lamar + Collier v4 / gen 1 (2026-06-19), 9 of the 15 dept review agents failed structured-output validation enough times to trip the orchestrator's "exhausted retries" path, then re-entered the workflow's outer retry loop and eventually succeeded.

From `workspace/logs/comment-resolution-check-error.log`:

```
event: agent.structured_output.coercion_failed  ×11
"Agent exhausted structured-output retries and could not be repaired"  ×11
```

Per dept (each event = 5 wasted internal attempts):

| Dept | coercion_failed events | Atomic items in guide |
|---|---|---|
| crc-ev  | 2 | 15 |
| crc-iw  | 2 | 1  |
| crc-aw  | 1 | 2  |
| crc-awrr| 1 | 4  |
| crc-ca  | 1 | 21 |
| crc-de  | 1 | 33 |
| crc-sp  | 1 | 49 |
| crc-tpw | 1 | 21 |
| crc-wq  | 1 | 15 |

Note the size column doesn't correlate — `crc-iw` (1 item) and `crc-sp` (49 items) both tripped exactly once. The failure mode is shape-level, not size-driven.

## Expected output shape

The schema lives at `bureau/workflows/comment-resolution-check/schemas/crc.schema.json` and is referenced by the `review` step's `schema:` field in `workflow.yaml`. Conductor's agent SDK passes the schema to the model via a `StructuredOutput` tool — the validator at the orchestrator layer is `ajv` (compiled at step-executor boot).

Top-level required shape:

```jsonc
{
  "grouping": "crc-tpw",                  // REQUIRED — guide filename minus `.md`
  "findings": [                            // REQUIRED — ARRAY of finding objects
    {
      "checklistItemId": "TPW-3.1",       // REQUIRED
      "observation": "...",                // REQUIRED
      "reasoning": "...",                  // REQUIRED
      "tools_used": [],                    // REQUIRED — array, may be empty
      "status": "resolved",                // REQUIRED — enum: resolved|failed|not-applicable
      "explanation": "...",                // REQUIRED — 6-30 words
      "evidenceLocations": [               // REQUIRED — array
        { "documentId": "...", "label": "...", "sheetNumber": 2 }
      ],
      "resolution": null                   // optional — corrective action for `failed`
    }
  ],
  "summary": "8 of 12 resolved, 3 failed, 1 not-applicable"   // optional
}
```

`grouping` and `findings` are both at the root, both `required`. `findings` is typed as `"type": "array"`. The schema does **not** define any property called `findings` *inside* `findings[]`.

## What the agent actually emits

Pulled the raw `StructuredOutput` tool_use payload from `workspace/logs/comment-resolution-check.log` for several of the failing attempts. The shape is consistent — and more specific than the orchestrator's `topLevelKeys: ["findings"]` summary suggests. The agent is **double-wrapping** the envelope:

```jsonc
// What the agent sent to StructuredOutput (FAILING)
{
  "findings": {                            // ← single top-level key
    "grouping": "crc-lde",                 // ← the real envelope is one level too deep
    "findings": [ /* ...array of findings objects... */ ],
    "summary": "..."
  }
}
```

Whereas what the schema requires:

```jsonc
// What StructuredOutput expects (PASSING)
{
  "grouping": "crc-lde",
  "findings": [ /* ...array of findings objects... */ ],
  "summary": "..."
}
```

In other words: the agent is treating the `StructuredOutput` tool as if its single input parameter were named `findings` and were expected to *contain* the envelope. But `StructuredOutput`'s parameters *are* the envelope — `grouping`, `findings`, `summary` are sibling top-level inputs, not children of a wrapper.

This explains both schema errors that show up in every failing attempt:

- `root: must have required property 'grouping'` — the real `grouping` is nested under `findings`, not at root.
- `/findings: must be array` — the root-level `findings` is the outer-wrapper object, not the array.

It also matches the orchestrator's per-attempt summary:

```
"attempts": [
  { "kind": "object", "topLevelKeys": ["findings"], "hasFindingsArray": false },
  ...
]
```

`topLevelKeys: ["findings"]` — only one key at the root, the wrapper. `hasFindingsArray: false` — that one key holds a dict, not an array.

The model commits to this misshape on attempt 1 and reproduces it five times in a row before the orchestrator's "exhausted retries" path fires and the outer workflow retry kicks in with a fresh agent session.

## Why this is happening (hypothesis)

The model isn't *forgetting* the envelope — it's *adding* one. It treats the `StructuredOutput` tool as if it took a single parameter `findings` that holds the whole result object. That misreading is a known pattern for tools that expose schema-validated structured output: the model collapses tool name → first noun-like parameter and tries to stuff the whole shape underneath.

CRC's `review.md` doesn't directly defend against this *specific* shape. The "WRONG" examples it lists are:

```jsonc
// Missing the `grouping` wrapper — findings cannot be at the root.
{ "findings": [ ... ] }

// Bare array — must be wrapped in an object with `grouping` and `findings`.
[ { ... }, { ... } ]

// Empty object.
{}
```

None of these match the actual failure mode, which is `{ "findings": { grouping, findings, summary } }`. The skeleton example in the prompt is correctly shaped, but the model is generalizing past it.

## Suggested mitigations (ranked by effort)

1. **Add the double-wrap to the documented anti-patterns.** Append a new "WRONG" example to `prompts/review.md` Step 5:

   ```jsonc
   // Double-wrapped — StructuredOutput's parameters ARE the envelope,
   // not a child of a `findings` key.
   { "findings": { "grouping": "...", "findings": [...], "summary": "..." } }
   ```

   This addresses the failure directly. The current "WRONG" list trains on `{ findings: [...] }` (missing grouping); the model is producing a different misshape that isn't anticipated.

2. **Sharpen the schema's `findings` description.** Update `schemas/crc.schema.json` so the `findings` property reads something like *"REQUIRED at the top level. Must be an ARRAY of finding objects — not an object, not a wrapper for the rest of the envelope. The `grouping`, `findings`, and `summary` fields are siblings under the root, not children of any wrapper."* The agent SDK surfaces `description` text back to the model on retry; making the array-at-root constraint explicit at that boundary should help.

3. **Restate the tool-parameter contract in the prompt.** Add one sentence to Step 5: *"`StructuredOutput`'s parameters are the envelope's top-level fields. Pass `grouping`, `findings`, and `summary` as separate parameters at the root — do not wrap them under a `findings:` key."*

4. **Hoist the envelope shape above Step 1.** Lower priority once 1–3 are in. The model reads top-down; even if it commits to the wrong shape during evaluation, an early structural reminder anchors the right pattern. Helps with general envelope drift, not just the double-wrap.

5. **Validate-checklist precheck (out of scope here).** The existing `validate-checklist` tool (`conductor/src/tools/validate-checklist.ts`) could be wired into the review step as a pre-tool-call structural check that catches the misshape before the orchestrator's 5-retry penalty kicks in. Bigger lift; revisit if 1–4 don't move the needle.

Recommend trying mitigations 1 + 2 + 3 together as a single prompt/schema tweak and re-running the smoke test for comparison.

## Cost impact

A coercion_failed event burns ~5 agent attempts before the outer retry kicks in. 11 events × 5 attempts ≈ 55 wasted Sonnet calls on top of the ~15 successful ones. Roughly **2-4× the agent-call budget the run "should" have used**. At Sonnet pricing this is real money on a 183-item run, and the wall-clock penalty was visible in the logs (multiple-minute backoff gaps).

## Reproduction

```
cd /Users/wnavey/noetic/conductor && npm run conduct -- \
  --workflow=comment-resolution-check \
  --submission-version-id=6b9b85ed-e992-4906-a222-b24ee836910c \
  --crc-guides-submission-version-id=6b9b85ed-e992-4906-a222-b24ee836910c \
  --crc-generation-number=1
```

Reproducible against Lamar + Collier v4 / gen 1 as long as no prompt/schema changes have shipped since the 2026-06-19 smoke run.

## Closure criteria

A subsequent end-to-end run on the same inputs should produce **zero** `agent.structured_output.coercion_failed` events in `workspace/logs/comment-resolution-check-error.log`. Spot-check the agent-trace on a few findings to confirm the StructuredOutput call shape is the full envelope on the first attempt.

---

## Update — 2026-06-25 (Run 3 / 1700 S Lamar gen2 audit)

**Correcting the record:** the mitigations recommended above (#1 prompt anti-pattern, #2 sharpened schema description, #3 tool-parameter contract) were **never shipped**. `review.md` still carried only the original three "WRONG" examples and no anti-nesting language; `crc.schema.json`'s `findings` description was never sharpened. The intervention that *did* ship on 2026-06-24 was a different lever entirely:

- **bureau `crc.emit.schema.json` (PR #457)** — a "lenient emit" schema that drops the top-level `grouping` requirement. Conductor injects `grouping` from the cell filename afterward (conductor PR #194, `normalizeStructuredOutput`).

### What the 5-run gen2 audit found

The lenient fix made the storm **worse at the system level**, not better:

| Metric | Smoke (06-19, gen1, strict) | Run 06-23 (gen1, strict) | Run 3 (06-25, gen2, **lenient**) |
|---|---:|---:|---:|
| `coercion_failed` events | 11 | 10 | **36** |
| Cells affected | 9/15 (60%) | 7/48 (15%) | **25/110 (23%)** |
| Dominant failure shape | `["findings"]` 100% | `["findings"]` 100% | `["findings"]` only 5/36; **new:** `data` ×72, `output` ×59, `properties` ×27, `content`/`results`/`result` (attempt-level) |

So the per-cell rate rose (~15% → ~23%) and the shape **migrated**. Note the audit's own write-up misattributed the `findings`-shape shrinkage to "the 2026-06-20 mitigations" — those never existed in code. The shrinkage is from the lenient schema removing `grouping` (the model's reason to nest under `findings` specifically); the underlying *wrap-the-envelope-under-one-key* reflex is unchanged.

### Corrected root cause

The trigger was never `grouping`. It is a **generic reflex**: the model treats `StructuredOutput` as a single parameter holding the whole result and names the wrapper with a generic noun. Removing `grouping` killed one *instance* (`findings`) and let the model reach for even more natural container words (`data`/`output`/`properties`).

**Compounding bug:** under the lenient schema, the failure-path repair (`tryRepairStructuredOutput`) was **silently disabled** — it guards on `schemaRequiresGroupingAndFindings`, which is false for the findings-only schema. So wrapped shapes that exhausted the SDK's retries got *no* repair attempt at all. The lenient fix didn't just miss the new shapes; it removed the net that used to catch the `findings` double-wrap.

### Fixes now in flight

1. **conductor #197** — `extractFindingsArray` + `tryRepairStructuredOutput` now match findings by **structure, not wrapper-key name**, and repair runs under the lenient schema too. Catches `data`/`output`/`properties`/`findings`/any wrapper, deterministically, before `coercion_failed`. This is the structural fix (the bug doc's deferred lever #5, done at the repair layer instead of via a precheck).
2. **bureau #459** — aligns `review.md` with the lenient emit schema (the prompt was contradicting it: it listed the now-correct flat `{findings:[...]}` as WRONG) and replaces the `findings`-specific anti-pattern with a generic "don't wrap under ANY key" one. Reduces *frequency*; #197 is the safety net.

### Revised closure criteria

The original "zero `coercion_failed`" bar should be met by #197 alone (wrapped attempts become `coercion_repaired` instead). Add two finer bars:

- **`coercion_repaired` count** should trend toward zero as #459 reduces wrapping frequency — a nonzero count is the net working, not a regression.
- **Wasted internal attempts:** #197 does not stop the SDK from burning ~5 internal attempts before repair fires; only #459 (and any future bare-array contract) lowers that. Track it separately from the `coercion_failed` count.
