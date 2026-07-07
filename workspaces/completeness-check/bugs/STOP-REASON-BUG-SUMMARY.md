# Completeness Check — stop_reason=tool_use Guard Bug (2026-07-06 outage)

> **Status:** Resolved. Filed 2026-07-07; fix merged and verified same day.
> **Fix:** conductor PR #211 (`isInterruptedToolUseResult`).
> **Trigger:** conductor PR #209 (Dependabot bump of `@anthropic-ai/claude-agent-sdk` 0.3.183 → 0.3.201, merged 2026-07-06 10:19 CDT).
> **Blast radius:** every schema-bearing agent step in every conductor workflow (completeness-check, review, CRC, …) from 2026-07-06 ~15:19 UTC until #211 merged 2026-07-07.
> **Prior art:** `structured-output-retry-storm-bugfix/DESIGN-SPEC.md` — different bug, same neighborhood (the SDK structured-output boundary), and its retry machinery is what made this bug expensive rather than merely fatal.

---

## 1. Symptom

Three consecutive cloud completeness-check runs against Lamar + Collier submission v4 failed:

| Run label | Config | Outcome |
|---|---|---|
| `2026_07_06_cc_uncertain` | runs=5, haiku, workers=65, vision-check | Hit the 3-hour Inngest cap ("timed out"); left a zombie `in_progress` row (`88000af5`) |
| `2026_07_06_cc_uncertain_take_2` | runs=5, haiku, workers=40 | `Step 'review' failed: 70 items failed` (67 min) |
| `2026_07_06_cc_uncertain_take_3` | runs=1, haiku, workers=14 | `Step 'review' failed: 14 items failed` (41 min) |

A local CLI run reproduced take 3 identically, which is what produced usable logs (`conductor/workspace/logs/completeness-check-error.log`). Every item, every retry, failed with the same message:

```
Agent reported success but stop_reason=tool_use — agent was interrupted mid-execution
Agent interrupted mid-tool-call (stop_reason=tool_use). The agent may not have completed its work.
```

The "timeout" and "N items failed" outcomes are the same failure — take 1 simply had too many cells (70 × 6 attempts × 17–51 turns each) to finish *failing* within 3 hours.

## 2. What was actually happening

The agents were **succeeding**. From the local run's result message for `cc-5.md`:

- `subtype: 'success'`, `is_error: false`
- `structured_output`: present and fully valid (complete findings for every checklist item)
- final turns: text summary → `StructuredOutput` tool call → tool result "Structured output provided successfully"
- …and `stop_reason: 'tool_use'`

Conductor then discarded the completed result, retried the whole cell from scratch (step `retries: 5`), got the identical outcome five more times, and failed the item. ~$0.35 and 17–51 turns of Haiku work per attempt, ×6 attempts, ×70 cells on take 1 — all thrown away by a guard clause.

## 3. Root cause

Two pieces, four months apart:

1. **The guard (conductor #83, 2026-04-07).** `runAgent` treats an SDK result of `subtype === 'success' && stop_reason === 'tool_use'` as an agent cut short mid-tool-call (the motivating case was context-window exhaustion) and throws a retryable error. Crucially, this check ran **before** the `structured_output` capture in the same result-handling block.

2. **The SDK behavior change (agent-sdk 0.3.183 → 0.3.201, via conductor #209, 2026-07-06).** Schema-bearing agents finish by calling the terminal `StructuredOutput` tool. Under 0.3.201, a session that ends this way reports the final `stop_reason` as `'tool_use'` on the success result — which is technically accurate (the last assistant message *was* a tool call) but previously not surfaced this way. Every normal schema-bearing completion now matched the guard's interruption signature.

Net effect: guard #83 false-positived on 100% of successful structured-output runs. Since the guard threw before the capture, the populated `structured_output` sitting right there on the message never got read.

### Timeline

| When (UTC) | Event |
|---|---|
| 2026-04-07 | Guard added (conductor #83) — correct against then-current SDK |
| 2026-07-02 21:25 | Last successful cloud CC run (lockfile at SDK 0.3.183) |
| 2026-07-06 15:19 | #209 merges; lockfile now pins SDK 0.3.201 |
| 2026-07-06 18:16 | Take 1 fired — first affected run |
| 2026-07-06 21:27 | Take 2 — all 70 items failed |
| 2026-07-07 09:11 | Take 3 (runs=1 diagnostic) — all 14 items failed |
| 2026-07-07 ~10:20 | Local repro; root cause identified from logs + `git log` |
| 2026-07-07 | Conductor #211 merged |
| 2026-07-07 10:44 | Verification run `2026_07_07_post_conductor_pr_211` (runs=1) completes in 7m41s, 193 comments saved |
| 2026-07-07 11:07 | 5-voter run (runs=5, vision-check, workers=35) completes in 1h30m |

## 4. Why diagnosis took three runs

The failure wore two different masks before producing logs:

- **Take 1 looked like a capacity problem.** "Timed out after 3 hours" pattern-matched to prior genuine timeouts (runs=3 vision-check in May; runs=5 workers=65 in May), so takes 2–3 reduced load instead of questioning the pipeline.
- **Cloud runs leave no per-item forensics on failure.** `workflow_runs.error` carries only the step-level summary; outputs upload only on success; the sandbox is destroyed on failure. The turning point was running the identical config through the conductor CLI locally, which yielded the full pino log and the intact result messages.
- **The suspect list was misleading.** Haiku × v2.6-trimmed was the one untested cell in the run-history matrix, so the model/checklist combination absorbed suspicion that belonged to a dependency bump merged hours before take 1.

## 5. The fix (conductor #211)

The guard predicate was extracted and made structured-output-aware — an interruption now additionally requires that no structured output was captured:

```ts
export function isInterruptedToolUseResult(message: {
  subtype?: string;
  stop_reason?: string;
  structured_output?: unknown;
}): boolean {
  return (
    message.subtype === 'success' &&
    message.stop_reason === 'tool_use' &&
    message.structured_output === undefined
  );
}
```

Genuine mid-tool-call cuts (context exhaustion, aborts) never carry `structured_output`, so #83's original protection is fully preserved. Six unit tests in `conductor/tests/agent/runner-interrupted-guard.test.ts` pin the contract, including: explicit `null` structured output counts as emitted; `error_*` subtypes are left to the error path; missing `stop_reason` is not an interruption.

## 6. Verification

- **runs=1 smoke** (`2026_07_07_post_conductor_pr_211`): completed in 7m41s — vs 41 minutes of failing for the identical pre-fix config. Review `ca9d0b82` saved with 193 comments, `is_current=false`, prior-review link intact.
- **runs=5 vision-check** (`2026_07_07_cc_5_voters_test_uncertain_and_inspect_drawing`): completed in 1h30m, all 70 cells. (Surfaced an unrelated checklist-ID double-prefixing issue in the vision-check experiment prompt — tracked separately.)

## 7. Lessons

1. **Guards keyed on SDK-internal signals must fail open on evidence of success.** Any predicate reading SDK result metadata (`stop_reason`, subtypes) should check for the presence of the actual deliverable before declaring failure. The deliverable was on the same message the guard threw away.
2. **Dependabot bumps of the agent-sdk are behavior changes, not hygiene.** 0.3.x patch bumps altered result-message semantics. Worth a smoke run (any runs=1 schema-bearing workflow) as a merge gate for that dependency — and note `^0.3.x` ranges float on fresh installs, so the exposure window opens at SDK *publish* time for anything not lockfile-pinned.
3. **Failed cloud runs need a forensics path.** Nothing uploads on failure; the sandbox dies with the evidence. The local CLI repro was the only reason this was diagnosable in one sitting. (Options: upload `logs/` on failure, or persist per-item errors to `workflow_runs.results`.)
4. **Distrust failure-shape pattern-matching.** "Timed out" ≠ capacity problem; it can be N × retries × slow-failure arithmetic. The tell was in the retry cadence: uniform failure across all cells and all retries means systemic, not load.
