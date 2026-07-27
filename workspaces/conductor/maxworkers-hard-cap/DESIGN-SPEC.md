# Hard Cap on `maxWorkers` for Completeness-Check and Comment-Resolution-Check

**Status:** Draft v1
**Date:** 2026-07-27
**Repos touched:** `bureau` (declare a `max` on the `maxWorkers` input of the CC + CRC `workflow.yaml`), `conductor` (teach the input schema + `validateInputs` to enforce `max`), `substation` (pre-sandbox guard so an over-cap run fails before we pay for a sandbox)
**Repos NOT touched:** `cityhall`, `radar`, `quarry`, `navalbase`

> **Relationship to winston#188:** this is the "start simple" first slice of R2 from the *Conductor Agent-Saturation Hang* spec (`workspaces/conductor/agent-saturation-hang-and-run-observability/`). It is deliberately narrow — a guardrail against the specific input that killed the 2026-07-24 CRC run — and does **not** replace the deeper fixes there (R1 per-agent timeout, R13e sidecar, R3/R13b substation reconciliation). Ship this now; those follow.

## Problem

On 2026-07-24 a CRC run was fired with `maxWorkers: 65` (Inngest event `01KYA52Z4EE8WYXAZTG4TQPPD5`, `workflow_runs.5701a8c5-…`). It saturated a 4-vCPU sandbox, hung for 3 hours, produced no output, and left an orphaned `in_progress` row. Full diagnosis in winston#188. The one-line trigger: **an operator-supplied `maxWorkers` far above anything ever validated.** Every CC/CRC run that has ever completed used ≤ 39 workers; 65 was the sole outlier and the sole hang.

There is no ceiling on `maxWorkers` today. Both workflows declare it as an unconstrained `type: number` input (`bureau/workflows/comment-resolution-check/workflow.yaml:62-70`, `bureau/workflows/completeness-check/workflow.yaml:127-131`; default 13), and conductor's `validateInputs` (`conductor/src/orchestrator/workflow-loader.ts:154-236`) checks *type* but supports no numeric bounds — `InputDefSchema` (`conductor/src/orchestrator/types.ts:14-21`) has only `type` / `required` / `default` / `description`. So any value passes.

## Decision

**Reject a CC or CRC run whose `maxWorkers` exceeds the cap, with a clear, non-retriable error, as early as possible.**

Enforced at two layers, cheapest-first:

1. **Substation pre-sandbox guard (the cost-saver).** Fail at dispatch, before `setUpSandbox`, so an over-cap run **never creates a sandbox** — no clone, no `npm install`, no agents, no spend.
2. **Conductor `validateInputs` (the correctness backstop).** A schema-declared `max` on the input, enforced for every execution path (cloud, local CLI, direct API) — fail-closed even if the substation guard is bypassed or a new caller appears.

### Open decision — is the cap 35 or 40? (needs Will's call)

The request was **35**. One tension to resolve first: the CC/CRC `workflow.yaml` descriptions **explicitly recommend `runs=3 → maxWorkers=39`**, and **two 39-worker runs have completed successfully** (CRC, runs=5, avg 72 min — see winston#188's comparative table). A hard cap of 35 would **reject a documented, known-good configuration.**

- **Option A — cap = 40.** Blocks the 65 disaster, still admits the documented/known-good 39. Zero doc churn. *Recommended* — it draws the line between "proven" and "never validated" rather than below a proven value.
- **Option B — cap = 35 (as requested).** Slightly more conservative, but requires also **retuning the two `workflow.yaml` descriptions** to stop recommending 39 (lower the `runs=3` guidance to ≤35), or the docs will contradict the guard.

Either way the mechanism is identical; only the constant and the doc edits differ. This spec is written to a symbolic `CAP` (= 40 pending decision).

## Design

### Change 1 — `bureau`: declare the cap on the input (source of truth)

Add a `max` to the `maxWorkers` input in both workflows:

```yaml
# bureau/workflows/comment-resolution-check/workflow.yaml  (and completeness-check)
maxWorkers:
  type: number
  required: false
  default: 13
  max: 40          # hard ceiling — a 4-vCPU sandbox cannot sustain more; see winston#188
  description: |
    ... (if CAP=35, drop the "runs=3 → maxWorkers=39" guidance here) ...
```

### Change 2 — `conductor`: teach the schema + validator to enforce `max`

- `InputDefSchema` (`types.ts:14-21`): add `max: z.number().optional()` (and, cheap and symmetric, `min`).
- `validateInputs` (`workflow-loader.ts`, `case 'number'` around lines 189-197): after the `Number.isNaN` check, if `inputDef.max !== undefined && num > inputDef.max`, push an error `Input 'maxWorkers' must be ≤ ${max}, got: ${num}`. The existing `errors[]` path already throws `Input validation failed: …` at `workflow-loader.ts:230`, which surfaces at `engine.ts:216` **before any step runs**. In the sandbox this aborts conductor immediately; conductor should also `markFailed()` the run row so it doesn't orphan (ties to winston#188 R3).

This is general — no workflow-name special-casing; any workflow can now bound any numeric input.

### Change 3 — `substation`: guard before sandbox creation (the money-saver)

In `substation/src/inngest/functions/workflow-run.ts`, before `step.run('setup-sandbox', …)` (currently `:72`), check a small cap map and throw `NonRetriableError` so Inngest stops with a clear message and **no sandbox is created**:

```ts
const MAX_WORKERS_CAP: Record<string, number> = {
  'completeness-check': 40,
  'comment-resolution-check': 40,
};
const cap = MAX_WORKERS_CAP[workflowName];
const requested = Number(inputs.maxWorkers);
if (cap !== undefined && Number.isFinite(requested) && requested > cap) {
  throw new NonRetriableError(
    `maxWorkers=${requested} exceeds the ${cap} cap for ${workflowName} (see winston#188). Refire at ≤ ${cap}.`
  );
}
```

**Duplication note:** the cap value now lives in two places (bureau YAML + this map). That is acceptable for a guardrail, but the drift risk is real — mitigate with a comment on each pointing at the other, and a substation unit test asserting the map value. A future consolidation (substation reading the workflow.yaml before dispatch, or a shared constant) is out of scope here.

## Scope / non-goals

- **Not** a substitute for winston#188's real resilience work — a capped-but-still-too-high run could still hang; R1 (per-agent timeout) is what makes *any* stall recoverable. This spec only removes the specific footgun of an absurd `maxWorkers`.
- **Not** touching other workflows (review, train, process-*). Only CC + CRC get a cap, per the request. The conductor `max` mechanism is general, but only these two YAMLs declare it.
- **Not** changing the defaults (13) or the `runs` input.
- **Not** clamping (silently lowering) — the decision is to **hard-fail** so the operator refires deliberately, per the request.

## Test plan

- Conductor unit: `validateInputs` rejects `maxWorkers = CAP+1`, accepts `CAP`, accepts default when omitted; error message names the input and the cap.
- Substation unit: the guard throws `NonRetriableError` for `{workflowName: 'comment-resolution-check', inputs:{maxWorkers: CAP+1}}` and is a no-op at `CAP` and for uncapped workflows.
- Manual (no new cloud run needed): re-validate against the recorded 2026-07-24 payload — `maxWorkers: 65` must now fail at the substation guard before any sandbox spend.
