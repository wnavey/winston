# Conductor Agent-Saturation Hang + Cloud-Run Observability

**Status:** Draft v1
**Date:** 2026-07-27
**Repos touched:** `conductor` (per-agent timeout, maxWorkers clamp, orchestration heartbeat, logger run-scoping), `substation` (timeout → mark-run-failed reconciliation, orphaned-run reaper, sandbox sizing), `bureau`/docs + `CLAUDE.md` (concurrency ceiling docs, hung-run runbook)
**Repos NOT touched:** `cityhall`, `radar`, `quarry`, `navalbase`

> **Reading order for an auditor:** this spec is grounded in one concrete failed run. Every fact in **Problem** is verified against prod (Inngest, Supabase project `mgxqsrjutswbciyrltwd`, Better Stack source `Reviewer`/`1654842`) or against code at the cited file:line on `main` as of 2026-07-27. The **Open questions (Q1–Q5)** are the deliberately-unresolved "why did *zero* of 65 agents succeed" thread — audit those hardest.

## Problem

On Friday 2026-07-24 a cloud CRC "game day" run (comment-resolution-check) was fired via an `workflow/run` Inngest event and **hung for 3 hours, produced no output, and left a workflow row stuck `in_progress` forever.** It is the first and only CRC run ever fired at `maxWorkers: 65`.

### The run

- **Inngest** event `01KYA52Z4EE8WYXAZTG4TQPPD5` → function run `01KYA52ZCFBCS92QEEZFTR0VKJ`, status **Failed**, output `NonRetriableError: Conductor workflow timed out after 3 hours`. Started `2026-07-24T13:29:56.524Z`, ended `2026-07-24T16:30:44.979Z` (≈3h exactly).
- **Inputs:** `crcGenerationNumber: 6`, `runs: 5`, `maxWorkers: 65`, `model: claude-sonnet-4-6`, `jurisdiction: austin`, `projectId: 23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, `submissionVersionId: 0e308099-7304-42e2-93a3-e5007af2e73c`, `crcGuidesSubmissionVersionId: 6b9b85ed-e992-4906-a222-b24ee836910c`, `runLabel: 2026-07-24-v7-crc-game-day-run-1`.
- **DB row** `workflow_runs.id = 5701a8c5-3857-4a1a-ae26-16ef1f04c5b3`:
  - `status = in_progress` (never flipped), `error = null`, `completed_at = null`, `outputs_path = null`
  - `sandbox_id = maroon-isolated-baboon-Fnk66h`, `started_at = 2026-07-24 13:30:37.922+00`
  - `inngest_run_id = 01KYA52Z4EE8WYXAZTG4TQPPD5` — note this stores the **event** ULID, not the function-**run** ULID (`…VKJ`). Minor data-quality bug, hurts correlation (see Q-adjacent fix R8).
- **Storage:** `workflow-runs/comment-resolution-check/5701a8c5-…` is **empty** — nothing was ever uploaded, so there was no review row to produce downstream.

### What the logs show: 65 agents launched, 0 ever returned

Conductor ships structured logs to Better Stack via `@logtail/pino` only when `ENVIRONMENT=production` (`conductor/src/shared/logger.ts:68-84`). There is **no `conductor` source** — the lines land in the **`Reviewer`** source (id `1654842`, ClickHouse table `t490582.reviewer`). Only the orchestrator's `createRun` line carries `runId`; every other line must be correlated by the **sandbox hostname** `4001fb8b-d2f` (orchestrator `pid 117`).

Timeline reconstructed from those logs:

```
13:30:37  Conductor starting → Workflow loaded → Resources prepared →
          Site plan data written → step.script.completed  (bootstrap OK)
13:31:43  "Starting parallel execution"
13:31:43  "Claimed item, launching agent"  × 65   ┐  all within a ~100 ms burst
13:31:43  event=agent.started               × 65   ┘  (65 == maxWorkers exactly)
   ─────   ... 2h 59m of TOTAL SILENCE ...
16:30:44  substation gives up on waitForEvent, kills the sandbox
```

Hard counts over the full window `13:29:00 → 16:35:00` on hostname `4001fb8b-d2f`:

| event | count | last seen |
|---|---|---|
| `agent.started` | **65** | 13:31:43.180 |
| `agent.completed` | **0** | — |
| `agent.failed` | **0** | — |
| any `warn`/`error` level | **0** | — |

152 total info lines, **all timestamped ≤ 13:31:43.180**. The orchestrator claimed exactly `maxWorkers` items, launched 65 agents, and then **not one agent ever completed, failed, or logged anything for the next 3 hours.** No crash, no error — a pure stall. All logs come from `pid 117` (the orchestrator); the 65 agent subprocesses ship nothing (see gap R6).

### Why this becomes a 3-hour dead run (the code path)

1. **Substation launches conductor detached and waits for a webhook** (`substation/src/inngest/functions/workflow-run.ts:158-167`):
   ```ts
   const completionEvent = await step.waitForEvent('wait-for-conductor', {
     event: 'webhook/conductor.complete',
     if: `async.data.sandboxId == '${sandboxId}'`,
     timeout: ms('3h'),
   });
   if (!completionEvent) throw new Error('Conductor workflow timed out after 3 hours');
   ```
   Conductor owns the `workflow_runs` row (`WorkflowRunTracker`, `conductor/src/shared/workflow-run-tracker.ts`); substation only orchestrates the sandbox.

2. **The parallel step never advances.** The step-executor claims up to `maxWorkers` items and `Promise.race`s them, backfilling as each resolves (`conductor/src/orchestrator/step-executor.ts:694-705`). **A promise that never resolves blocks the race forever** — the queue never advances past the first 65, and there is no step-level timeout.

3. **There is no per-agent wall-clock timeout.** The agent runner drives the Agent SDK `query()` under an `AbortController`, but the only `abortController.abort()` fires in cleanup *after* the loop ends (`conductor/src/agent/runner.ts:530`). Nothing aborts a hung `query()`. One wedged agent = one never-resolving promise = the whole step hangs → the 3h outer timeout.

4. **The timeout leaves the DB row orphaned.** Substation's `catch` (`workflow-run.ts:198-215`) and `onFailure` (`:38-46`) **only stop the sandbox** — neither touches `workflow_runs`. Conductor *would* call `markFailed()` (`workflow-run-tracker.ts:163-192`) but it was SIGKILLed with the sandbox, so the row stays `in_progress` / `error=null` indefinitely. `markFailed` is also wrapped in try/catch that never throws (`:143-157`), by design.

### Why 65 specifically: the concurrency was past the box's ceiling

The Vercel sandbox is provisioned with **`resources: { vcpus: 4 }`** and `runtime: node24`, `timeout: 300m`, `persistent: false` (`substation/src/inngest/lib/sandbox/setup.ts:22-30`). Vercel allocates ~2 GB RAM per vCPU, so ≈**8 GB** total (exact ratio to be confirmed — Q3). Every conductor agent is an Agent SDK `query()` that **spawns a Claude Code subprocess plus its MCP stdio servers** (`runner.ts:184-186, 269-295`). 65 concurrent agents ≈ 65 node processes + 65 child process trees + their MCP servers on 4 vCPUs / ~8 GB — roughly **16 agents/vCPU**.

Comparative prod evidence — **every** CRC run that ever completed used ≤ 39 workers; the 65-worker run is the sole outlier and the sole hang:

| maxWorkers | runs | outcome | n | avg minutes |
|---:|---:|---|---:|---:|
| 24 | 5 | completed | 1 | 93.1 |
| 35 | 5 | completed | 5 | 57.2 |
| 35 | 3 | completed | 1 | 49.9 |
| 35 | 5 | **failed** (but finished in 63.6m) | 1 | 63.6 |
| 39 | 3 | completed | 1 | 62.2 |
| 39 | 5 | completed | 2 | 72.3 |
| **65** | **5** | **in_progress / hung 3h** | **1** | — |

Notably a **35-worker run completed on the same day (2026-07-24)** — so this was not a platform-wide outage; it is specific to the 65-worker concurrency. The default `maxWorkers` is **10** (`conductor/src/orchestrator/types.ts:133`); the root `CLAUDE.md` documents review as "parallelized up to 30 workers." **65 was ~1.7× the highest value ever known to work and 6.5× the default.**

**However — and this is the genuinely unexplained part (Q1) — "slow" does not explain the observations.** If 65 agents were merely progressing slowly, *some* would have finished inside 3 hours and we would see `agent.completed` + backfilled `agent.started` lines. We saw exactly 65 starts and **zero** completions over 3 hours. That is a hard stall, not slowness, and its mechanism is not yet proven (see Open questions).

### Related prior art

`winston/workspaces/substation-review-silent-failure/README.md` tracks a *different* cloud-path failure (review workflow "Completed" in ~50 ms with no output — a fast silent no-op, suspected env/provisioning). This spec is the opposite signature (3h hang, work started then stalled), but both share the theme **the cloud deployment path fails silently and we find out late**. The observability remediations here (R3–R6) would have surfaced both.

## Root cause (summary)

A hung/stalled parallel step has **no per-agent timeout** to break it and **no orchestration heartbeat** to reveal it, so a single stall consumes the entire 3-hour budget invisibly; the timeout path then **fails to reconcile the DB row**, leaving it orphaned. The stall itself was **triggered by `maxWorkers: 65` on a 4-vCPU sandbox** — a concurrency level never validated (default 10, docs say 30, max-known-good 39). Three independent defects had to line up: (a) unsafe concurrency, (b) no timeout/heartbeat resilience, (c) no failure reconciliation.

## Remediations (prioritized)

### P0 — Correctness / stop the bleeding

- **R1. Per-agent wall-clock timeout in the agent runner.** Wrap `query()` in a timeout (config'd per workflow, default e.g. 20 min) that calls `abortController.abort()` and rejects the item as failed → retryable via the existing backoff loop (`step-executor.ts:717-731`). *This is the fix for the entire class*: it converts "one hung agent → 3h dead run" into "one failed item → run completes with partial output." Must confirm the SDK actually tears down on abort and the promise settles (Q2).
- **R2. Clamp `maxWorkers` to a safe ceiling + fix the docs drift.** Enforce a hard cap in conductor (clamp with a warn when exceeded) and/or validate at substation dispatch. Set the ceiling from the box's proven headroom (≤ ~39 today; pick after Q4). Immediate operator mitigation with zero code: **do not fire above ~35**. Reconcile root `CLAUDE.md` ("30 workers") with the enforced number.

### P1 — Observability + resilience

- **R3. Substation timeout → mark run failed.** On `waitForEvent` timeout (and in the `catch`), look up the `workflow_runs` row by `sandbox_id` (substation holds it) and set `status='failed'`, `completed_at=now()`, `error=<reason>`. Crosses the "conductor owns the row" boundary deliberately — the owner is dead by definition when this fires. Also wrap the throw as a `NonRetriableError` carrying structured detail so `onFailure` logs more than a bare string.
- **R4. Orphaned-run reaper.** A periodic sweep (Inngest cron) that marks `in_progress` rows older than the 3h ceiling as `failed` when their sandbox is gone. Backstop independent of R3 and of who owns the row. Would retroactively clean `5701a8c5-…` and any siblings.
- **R5. Orchestration heartbeat.** Emit a periodic line from the orchestrator — `event=orchestration.heartbeat` with `{running, completed, failed, queued, oldestAgentAgeMs}` every ~30–60 s during parallel steps. A single stall would then be obvious within a minute instead of invisible for 3 hours. *Highest diagnostic ROI for the effort.*
- **R6. Agent-subprocess visibility + dead-child detection.** Today only the orchestrator logs; the 65 agent subprocesses ship nothing, so a stall is a black box. Surface per-agent lifecycle (`agent.completed`/`agent.failed`/progress), and ensure a silently-killed child (OOM) causes its `query()` promise to **reject**, not hang — otherwise R1's timeout is the only safety net.

### P2 — Structural / follow-up

- **R7. Right-size concurrency to the box.** Either scale sandbox `vcpus` up when a high `maxWorkers` is requested, make conductor concurrency a function of available memory, or shard agents across multiple sandboxes. Depends on Q4/Q5.
- **R8. Fix `inngest_run_id` provenance.** It currently stores the event ULID (`event.id`, passed as `--inngest-run-id=${event.id}` at `workflow-run.ts:115`), not the function-run ULID. Store both, or the run ULID, so DB ↔ Inngest correlation is 1:1.
- **R9. Better Stack ergonomics.** (a) Bind `runId` **and** `sandboxId` to conductor's root logger so every line is filterable (not just `createRun`). (b) Consider a dedicated `conductor` source instead of co-mingling in `Reviewer`. Removes the "correlate by sandbox hostname" archaeology this investigation required.

### Docs / CLAUDE.md

- **R10.** Root `CLAUDE.md`: reconcile the "up to 30 workers" claim with the enforced ceiling (R2); add a one-liner on the 4-vCPU sandbox and the concurrency/memory relationship.
- **R11.** Conductor `CLAUDE.md`: document the per-agent timeout (R1) and the `maxWorkers` clamp (R2) once shipped, under a "Danger Zones"-style note.
- **R12.** Add a **"Diagnosing a hung cloud run" runbook** (this topic dir or conductor docs) capturing the recipe used here: find the row in `workflow_runs`; the durable log trail is Better Stack source `Reviewer` (`1654842`); correlate by sandbox hostname (`JSONExtract(raw,'hostname',...)`) over `s3Cluster(primary, t490582_reviewer_s3)` (>30 min old) vs `remote(t490582_reviewer_logs)` (last ~30 min); watch for `agent.started` with no matching `agent.completed`.

**Suggested sequencing:** R1 + R2 first (they'd have prevented the loss outright), then R3/R5 (turn future stalls from invisible to obvious), then R4/R6, then P2. R1 and R3 are independently valuable and can ship in parallel across the two repos.

## Open questions — "why did *zero* of 65 succeed?" (investigate hardest)

The concurrency level is a convincing **trigger**, but the **mechanism** of zero completions is not proven. Candidate explanations, to be discriminated by a controlled repro:

- **Q1. What actually stalled?** Leading hypotheses:
  1. **Memory exhaustion** — 65 agent process-trees exceed ~8 GB; the OOM killer reaps children, whose parent `query()` awaits never settle → hang.
  2. **CPU starvation** so severe that neither agents *nor the `@logtail/pino` transport worker* make progress (i.e. the "silence" is partly un-shipped logs — Q3).
  3. **FD / PID / thread-table exhaustion** wedging further subprocess/MCP spawns.
  4. **Shared-dependency contention** — all agents blocking on the AI gateway, `semantic-search-blocks`, or Supabase with no per-agent timeout. (Rate limits usually surface as warns/retries; we saw none, which argues *against* this and *for* OS-level exhaustion.)
- **Q2. Does an OOM-killed / crashed Agent SDK child make `query()` reject, or hang forever?** Determines whether R1 (timeout) is sufficient or R6 (dead-child detection) is also mandatory.
- **Q3. Is the 3h Better Stack silence "no work happened" or "logs not shipped"?** The logtail transport is async/buffered; under starvation it may simply stop flushing. Add sandbox-side resource sampling to disambiguate. Also confirm the exact Vercel RAM-per-vCPU ratio for a 4-vCPU box.
- **Q4. Where is the cliff between 39 (works, ~72 min) and 65 (hangs)?** Sweep 40 / 50 / 60 with metrics to fix the safe ceiling for R2/R7.
- **Q5. Scale up or shard out?** For genuinely large runs, is the answer more vCPUs per sandbox, or multiple sandboxes each under the per-box ceiling? Informs R7.

### Proposed repro / investigation plan

Re-run the **exact** inputs (`projectId 23301a8a…`, `submissionVersionId 0e308099…`, `crcGuidesSubmissionVersionId 6b9b85ed…`, `runs: 5`) at `maxWorkers: 65` **with instrumentation**, against a `maxWorkers: 39` control:

1. Land R5 (heartbeat) first — cheap, and it alone may reveal whether agents are inching forward or dead-stopped.
2. Add a temporary **sandbox resource sampler**: poll `/proc/meminfo` + `/proc/loadavg` (+ process/FD counts) every ~15 s into the log stream.
3. Optionally bump the repro sandbox to `vcpus: 8` to isolate memory-vs-CPU (if 65 succeeds at 8 vCPU, it's resource-bound per Q1; if it still hangs, suspect a shared dependency / deadlock).
4. Compare `agent.completed` cadence and peak RSS across 39 vs 65 to locate the cliff (Q4).

*Do not fire any repro without Will's explicit go on the exact payload.*

## Scope / non-goals

- Not changing the CRC workflow logic, guides, or agent prompts — this is an orchestration-resilience + observability bug, discipline-agnostic (it would bite CC and review identically).
- Not redesigning the substation↔conductor completion protocol (detached + webhook + waitForEvent stays); R3/R4 harden its failure edges only.
- Not raising the 3h outer timeout — the goal is to **never rely on it** as the failure mechanism.
