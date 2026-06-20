# Structured-Output Retry Storm in CRC `review` Step

> **Status:** Open, non-blocking. Filed 2026-06-20 from the first end-to-end smoke run.
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

## Failure pattern

Every coercion_failed event has the same `attempts` signature:

```jsonc
{
  "attempts": [
    { "kind": "object", "topLevelKeys": ["findings"], "hasFindingsArray": false },
    { "kind": "object", "topLevelKeys": ["findings"], "hasFindingsArray": false },
    { "kind": "object", "topLevelKeys": ["findings"], "hasFindingsArray": false },
    { "kind": "object", "topLevelKeys": ["findings"], "hasFindingsArray": false },
    { "kind": "object", "topLevelKeys": ["findings"], "hasFindingsArray": false }
  ],
  "schema_errors": [
    "root: must have required property 'grouping', /findings: must be array",
    ...
  ]
}
```

The agent returns an object with `findings` at the root and *no* `grouping` field. On retry it makes the same omission five times in a row before the outer workflow retry kicks in, the agent re-runs from scratch, and eventually produces the correct envelope.

`hasFindingsArray: false` across all attempts is also notable — the inner `findings` value isn't even an array on these failing attempts, despite the top-level key being called `findings`. Likely a JSON-encoded-string-of-array shape, but the log doesn't surface the inner value.

## Why this is happening (hypothesis)

The review prompt (`bureau/workflows/comment-resolution-check/prompts/review.md`) introduces the full output shape in **Step 5 — Return Your Findings**, which is the last section the agent reads after walking through the guide (Step 1), checking applicability (Step 2), gathering evidence (Step 3), and evaluating each item (Step 4). By the time the agent is composing its tool call, it has spent the bulk of its attention on per-item evaluation logic and produces the findings array verbatim — forgetting to wrap.

Mirrors a class of failure the CC review prompt mitigates with a `CRITICAL — always call StructuredOutput with the full envelope` block. CRC has the same block, but it's only at Step 5 and doesn't appear to be sticking.

## What we already tried

CRC's `review.md` already contains:
- An explicit "WRONG — these fail schema validation" block showing the exact failure shape (`{ "findings": [...] }` without `grouping`).
- A full skeleton example with all three top-level fields.
- A "REQUIRED" annotation on `grouping` and `findings`.

The model produces the documented anti-pattern anyway on ~60% of dept agents.

## Suggested mitigations (ranked by effort)

1. **Hoist the envelope requirement out of Step 5.** Move the `{ grouping, findings, summary }` skeleton + the `grouping` derivation rule ("filename without `.md`") to the very top of the prompt, before Step 1. The agent reads top-down; the last instruction it sees should be the shape, not the content of `findings[]`.
2. **Front the `grouping` field in the example.** Currently the example shows `findings` heavily; swap so `grouping` appears first and most prominently. Models pattern-match shapes from the example more than they parse the prose.
3. **Sharper schema description.** Update `bureau/workflows/comment-resolution-check/schemas/crc.schema.json` so the `grouping` field's `description` reads something like *"REQUIRED. Set to the guide filename without `.md` extension (e.g. `crc-tpw`). Omitting this is the most common output mistake; the StructuredOutput call will be rejected without it."* The agent SDK surfaces this back to the model on retry — making it explicit at that boundary should reduce repeat-omission.
4. **Validate-checklist precheck.** Worth checking whether the existing `validate-checklist` tool (`conductor/src/tools/validate-checklist.ts`) can be wired into the review step as a pre-tool-call structural check. Out of scope for a single bug-fix iteration but worth scoping.

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
