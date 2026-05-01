# Completeness-check failure investigation — 2026-05-01

Inngest event ID: `01KQHX6ENW7EPK5C7Y9J87H9R5`
Workflow run ID: `93f51c97-e24b-422c-8e4f-e1394fca5175`
Storage path: `workflow-runs/completeness-check/6cd47f07-7f6d-4a7e-92bd-2945486b5be3/2026-05-01-160253`

## Top-line

`Step 'review' failed: 5 items failed`. The review step ran 65 agent invocations (13 checklist groupings × 5 runs). 60 succeeded, 5 failed terminally after exhausting all retries:

| item | runIndex | duration | error |
|---|---|---|---|
| cc-3.md | run-1 | 38 min | `error_max_structured_output_retries` |
| cc-5.md | run-2 | 48 min | `error_max_structured_output_retries` |
| cc-2.md | run-2 | 47 min | `error_max_structured_output_retries` |
| cc-1.md | run-2 | 60 min | `error_max_structured_output_retries` |
| cc-15.md | run-4 | 37 min | `error_max_structured_output_retries` |

The same items succeeded in other runs (e.g. cc-1 succeeded in runs 1, 3, 4, 5; cc-3 succeeded in runs 2, 3, 4, 5). The failures are non-deterministic per run, not item-specific data corruption.

## Root cause

Every `error_max_structured_output_retries` result carries `stop_reason: "tool_use"`. By contrast, all 60 successful invocations stop with `end_turn`.

```
60  "stop_reason":"end_turn"        ← all 60 successes
 2  "stop_reason":"tool_use"        ← among non-failure log lines (eventually retried successfully)
all "stop_reason":"tool_use"        ← among the 37 failure log lines
```

That signature means the agent loop was cut off while the model still wanted to call another tool. The agent SDK then runs its structured-output coercion pass, asks the model to emit JSON conforming to `completeness.schema.json`, fails validation 5 times in a row, and surfaces `error_max_structured_output_retries` (`Failed to provide valid structured output after 5 attempts`).

In short: the agent was terminated mid-investigation, and the SDK could not synthesize a schema-valid finalization from a partial trace.

### Why these items, not others

The failing attempts ran long and hot. From the per-attempt result records:

- cc-1.md run-2 retries: 61 turns / 47 383 output tok, 57 turns / 54 408 tok, 59 turns / 58 499 tok
- cc-13.md run-3: 34 turns / 65 339 tok (highest single attempt)
- cc-15.md run-1: 62 turns / 44 843 tok
- cc-3.md run-1: 39 turns / 35 371 tok

Compare with the typical successful turn count of ~20–30. The five terminally-failed attempts are the ones whose checklist groupings produced the most tool-use rounds (most sheets to inspect, most evidence to gather). They all push past whatever max-turns / output-token budget the agent SDK enforces and get cut off before they can produce a final answer.

The model has `maxOutputTokens: 32000`. Failing attempts repeatedly emit cumulative `output_tokens` between 30 k and 65 k spread across 30–60+ turns — i.e. the agent is fighting the budget and losing.

## Secondary failure modes (non-fatal, but visible)

These hit during the run but did not cause the final 5 failures. Worth tracking as separate issues.

### 1. Vercel AI Gateway timeouts (3 occurrences)

```
GatewayTimeoutError: Cannot connect to API: Headers Timeout Error
  at /vercel/sandbox/src/tools/vision/index.ts:228
```

Affects the `vision` tool. Three discrete events on cc-5 (run-2), cc-3 (run-5), cc-10 (run-5). All retried successfully. Recommend bumping the gateway client-side timeout — the error message links to [Vercel's extending-timeouts doc](https://vercel.com/docs/ai-gateway/capabilities/video-generation#extending-timeouts-for-node.js).

### 2. Stale plan_set_id lookups (3 occurrences)

```
Error: No plan set version found for plan_set_id: bc2edeb8-27c2-4675-8a00-746881bbff97
  at getFileContent (/vercel/sandbox/src/tools/vision/index.ts:100)
```

Three different IDs hit:
- `bc2edeb8-27c2-4675-8a00-746881bbff97`
- `b7632e64-505b-4d07-accb-403fbcfe1271`
- `5d18522d-e23c-4671-a481-06b2971cf4eb`

The vision tool was asked to load sheets from plan sets that don't have a corresponding `plan_set_version`. Likely the agent hallucinated a UUID, or the prompt-bundled README references a plan set whose version row was deleted. Worth confirming whether the agent prompt actually exposes those IDs, and whether `plan_set_version` is supposed to exist for every `plan_set` referenced in the active submission.

### 3. One "agent reported success but stop_reason=tool_use"

```
cc-24.md run-1 retry-1: Agent interrupted mid-tool-call (stop_reason=tool_use)
```

Retried and ultimately succeeded. Same family of issue as the terminal failures, just on a less expensive grouping where one retry was enough.

## Recommendations

1. **Raise the agent-SDK turn budget** for the review step, or expose it as a workflow input. The current implicit cap is being hit by the largest groupings.
2. **Split the largest checklist groupings** (cc-1, cc-2, cc-3, cc-5, cc-13, cc-15) into smaller files so each agent run has a tighter scope.
3. **Add a "wrap up now" instruction** to `review.md` that triggers when the agent has used N tool calls — give the model an explicit off-ramp instead of relying on the SDK to chop it off.
4. **Bump the Vercel gateway timeout** in the vision tool to absorb the rare 408s without consuming a retry slot.
5. **Add validation** in the vision tool for `plan_set_id` → return a structured "not found, here are the valid IDs" message instead of throwing, so the agent can recover. Separately, find out where these stale IDs are coming from.
6. **Consider lowering the workflow `retries: 2`** — currently a stuck grouping burns ~3× its full duration. If max-turn-cut-off is the dominant failure, retries don't help.

## Files in this directory

- `README.md` — this report
- `raw/completeness-check/.../logs/completeness-check.log` — full agent log (70 MB, gitignored)
- `raw/completeness-check/.../logs/completeness-check-error.log` — warnings + errors only (32 KB)
- `raw/completeness-check/.../workflow/` — workflow yaml, schema, scripts, prompts, status.json, run-log.json
