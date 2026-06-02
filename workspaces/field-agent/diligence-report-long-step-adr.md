# ADR: Running the long diligence skill session outside the Inngest step

> **Status:** Accepted (2026-06-02). Supersedes open decision #1 in
> [`diligence-report-skill-execution.md`](./diligence-report-skill-execution.md).
>
> **Context owner:** field-agent. Affects the `diligence-run` Inngest function
> and the (to-be-built) `src/skill/invoke.ts`.

---

## Context

field-agent invokes the `noetic-tools:diligence-report` skill as a **single
opaque `@anthropic-ai/claude-agent-sdk` `query()` session** (Model A — see
[`diligence-report-skill-execution.md`](./diligence-report-skill-execution.md)).
A full run is **30–60+ minutes**, token-heavy, and orchestrates its own 6 phases
*internally* — field-agent has no seam to wrap those phases in separate Inngest
steps.

That single fact kills two options that earlier drafts assumed:

- **You cannot make the skill's phases individually durable/resumable via
  `step.run`.** The phases live inside the SDK session, not inside the Inngest
  function. (The `implementation-plan.md` risk-table line that claimed "`step.run`
  per phase makes phases idempotent and resumable" is therefore **false under
  Model A** and has been corrected.)
- **A single `step.run` that blocks for 30–60 min fights the Inngest execution
  model** (step/function timeouts, heartbeat expectations) and means an
  at-least-once retry re-runs the *entire* expensive session from zero.

## Decision

**The Inngest function is a thin acknowledgement handler. The long-running skill
session runs outside Inngest step memoization, in the same persistent worker
process, and reports completion through `diligence_runs.status` + Supabase
realtime.**

Concretely:

1. `diligence/requested` arrives → the Inngest function validates the payload,
   flips `diligence_runs.status` `queued → running` (single fast `step.run`),
   **hands the run off to an in-process runner, and returns**. From Inngest's
   point of view the function is **complete in seconds**.
2. The in-process runner (`runDiligenceSession(diligenceRunId)`) is **not
   awaited by the Inngest function**. It runs the `query()` session to
   completion, then writes `status = completed` (with artifact rows) or
   `status = failed` (with `error`) directly to `diligence_runs`.
3. cityhall already subscribes to `diligence_runs` realtime (the
   `diligence_running_job` RCM). It sees `completed`/`failed` without any new
   event. **No `diligence/completed` event is required for the UI.**

```
diligence/requested ──▶ Inngest fn (ack) ──▶ mark running ──▶ enqueue runner ──▶ RETURN ✅
                                                                  │ (detached, same process)
                                                                  ▼
                                                    runDiligenceSession()  ── 30–60 min
                                                                  │
                                            ┌─────────────────────┴─────────────────────┐
                                            ▼                                            ▼
                              status = completed + artifacts                  status = failed + error
                                            └──────────── Supabase realtime ────────────┘
                                                                  ▼
                                                       cityhall RCM updates
```

### Why this is safe here (and would NOT be on serverless)

This pattern only works because **field-agent is a long-lived standalone Node
process** (laptop today, always-on VM at Phase 3). Returning from the Inngest
function does **not** tear down the process, so the detached runner keeps
executing on the same event loop. On a serverless/Lambda/Vercel-Sandbox host the
runtime would freeze or kill execution the moment the handler returned — there
the fire-and-handoff pattern is invalid and you would need a different host.
This constraint is now a load-bearing property of the worker, not an
implementation detail.

## Consequences

### 1. Concurrency control moves out of Inngest — **must be replaced**

Today `concurrency: 1` on the `diligence-run` Inngest function serializes the
heavy work. Once the function acks-and-returns immediately, that gate only
serializes the *ack*, not the SDK sessions — two events could both ack and spawn
two concurrent 60-minute runs, doubling memory/token load on one box.

**Required:** an **in-process concurrency limit** in the runner (a queue or
semaphore, default `1`). This becomes the real throughput knob; the Inngest
`concurrency` setting is now only about ack handling. Phase 3 raises the
in-process limit per host capacity.

### 2. Durability is traded away — needs a stuck-run reconciler (fast-follow)

Once the function acks, **Inngest will not retry** (it considers the event
handled). If the worker crashes or the laptop sleeps mid-session, the row is
stuck at `running` with no orchestrator to recover it.

**Mitigations:**
- **Failure path:** wrap `runDiligenceSession` in try/catch (and guard against
  synchronous throws at enqueue time) so any in-process error writes
  `status = failed`. This covers crashes *within* the session, not process death.
- **Stuck-run reconciler (fast-follow, not blocking):**
  - **Startup reconcile** — on worker boot, any `running` row with no live
    in-process runner is orphaned → mark `failed` (or `queued` for re-trigger).
  - **Age sweeper** — a periodic check (Inngest cron or interval) flips rows
    `running` longer than a max-duration ceiling (e.g. 90 min) to `failed`.
  - Until the reconciler ships, a stuck row is recovered manually (it's a single
    `update diligence_runs set status='failed'`), acceptable for laptop-era dev.

### 3. Observability shifts to `diligence_runs`

We lose the Inngest step timeline for the heavy work (there are no steps). The
run's progress is whatever the runner writes to the row. Pair this with open
decision #3 (stream `tool_use`/phase markers to a progress column) so the UI
shows more than a binary running/completed.

### 4. Retry / double-cost is eliminated by design

Because the function acks before the expensive work, there is no Inngest retry
of the session — so no risk of burning a second full run's tokens on a transient
hiccup. The cost of that is (2) above: we own recovery instead of Inngest.

### 5. Optional future `diligence/completed` event

The runner *may* emit `diligence/completed` after success for future downstream
consumers (notifications, follow-up workflows). It is **not** part of the
completion-tracking contract — the row status + realtime is the source of truth.
Deferred until a consumer exists.

## Alternatives considered

| Option | Why not |
|---|---|
| **Single long `step.run` + raised timeout + heartbeats** | Fights Inngest timeouts; an at-least-once retry re-runs the whole 30–60 min session from zero (double token cost). Heartbeat tuning is fragile. |
| **`step.run` per skill phase** | Impossible under Model A — the phases are internal to one opaque SDK session; field-agent has no boundary to wrap. |
| **Re-emit an internal `diligence/execute` event to a second long function** | Just relocates the same long-step problem into another function; no win. |
| **Fire-and-handoff (chosen)** | Matches the persistent-worker reality; eliminates retry double-cost; cost is owning recovery (the reconciler), which is cheap. |

## Implementation notes for `invoke.ts` / `diligence-run.ts`

- Inngest function body: `safeParse` → `mark-running` (`step.run`) → enqueue
  runner → `return { accepted: true, diligence_run_id }`. Keep `onFailure`
  only for the *ack* path now (payload parse / mark-running failures).
- Runner: re-fetch the row by id (don't thread row data through), run `query()`,
  read `workdir/sir/deliverable/*.pdf`, reuse `upload.ts` + `insert.ts`, then
  set terminal status. All inside try/catch → `failed` on throw.
- In-process queue: a tiny `p-limit`-style semaphore (or a hand-rolled
  one-at-a-time promise chain) keyed at module scope. Default concurrency `1`.
- The runner owns the run's lifetime; the process must not `process.exit` while a
  runner is in flight, and must register an `unhandledRejection` guard.

## Cross-refs

- Skill-execution design: [`diligence-report-skill-execution.md`](./diligence-report-skill-execution.md)
- Host provisioning: [`diligence-report-skill-execution-host-provisioning.md`](./diligence-report-skill-execution-host-provisioning.md)
- field-agent roadmap: [`implementation-plan.md`](./implementation-plan.md)
