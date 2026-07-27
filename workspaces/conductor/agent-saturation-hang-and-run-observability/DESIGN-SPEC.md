# Conductor Agent-Saturation Hang + Cloud-Run Observability

**Status:** Draft v2
**Date:** 2026-07-27
**Repos touched:** `conductor` (per-agent timeout, maxWorkers clamp, orchestration heartbeat, resource-sampling sidecar, logger run-scoping), `substation` (timeout → mark-run-failed reconciliation, log harvest-before-kill, orphaned-run reaper, sandbox sizing), `bureau`/docs + `CLAUDE.md` (concurrency ceiling docs, hung-run runbook)
**Repos NOT touched:** `cityhall`, `radar`, `quarry`, `navalbase`

> **Revision note (v2, 2026-07-27):** deepened the log-durability analysis (P1b) after verifying conductor's logging topology.
> - **Factual correction:** the CRC upload prefix is keyed by `{projectId}/{datetime}` stamped at *upload* time, not by the run UUID — v1 cited the wrong storage path. The failed run still uploaded nothing (no folder exists near its start); confirmed by mapping every 07-24 folder to a run.
> - **New corroboration:** after the 65-worker hang, two `maxWorkers:35` *backup* runs on the **same project + submission** were fired ~1.5 h later and both completed — same data, same day, lower concurrency ⇒ success. Rules out data-specific and platform-wide causes.
> - **Reframed R13:** verified that all logging is centralized in the orchestrator process and that pino ships off the main thread already, so the "agents block on log flushes" concern is moot. A sibling that only *flushes existing logs* buys durability but no new signal; the robust form is a **resource-sampling heartbeat sidecar** (new R13e, subsumes R5's independence). Q6 added in v1 stays; Q1–Q5 unchanged.

> **Reading order for an auditor:** this spec is grounded in one concrete failed run. Every fact in **Problem** is verified against prod (Inngest, Supabase project `mgxqsrjutswbciyrltwd`, Better Stack source `Reviewer`/`1654842`) or against code at the cited file:line on `main` as of 2026-07-27. The **Open questions (Q1–Q6)** are the deliberately-unresolved "why did *zero* of 65 agents succeed" thread — audit those hardest.

## Problem

On Friday 2026-07-24 a cloud CRC "game day" run (comment-resolution-check) was fired via an `workflow/run` Inngest event and **hung for 3 hours, produced no output, and left a workflow row stuck `in_progress` forever.** It is the first and only CRC run ever fired at `maxWorkers: 65`.

### The run

- **Inngest** event `01KYA52Z4EE8WYXAZTG4TQPPD5` → function run `01KYA52ZCFBCS92QEEZFTR0VKJ`, status **Failed**, output `NonRetriableError: Conductor workflow timed out after 3 hours`. Started `2026-07-24T13:29:56.524Z`, ended `2026-07-24T16:30:44.979Z` (≈3h exactly).
- **Inputs:** `crcGenerationNumber: 6`, `runs: 5`, `maxWorkers: 65`, `model: claude-sonnet-4-6`, `jurisdiction: austin`, `projectId: 23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, `submissionVersionId: 0e308099-7304-42e2-93a3-e5007af2e73c`, `crcGuidesSubmissionVersionId: 6b9b85ed-e992-4906-a222-b24ee836910c`, `runLabel: 2026-07-24-v7-crc-game-day-run-1`.
- **DB row** `workflow_runs.id = 5701a8c5-3857-4a1a-ae26-16ef1f04c5b3`:
  - `status = in_progress` (never flipped), `error = null`, `completed_at = null`, `outputs_path = null`
  - `sandbox_id = maroon-isolated-baboon-Fnk66h`, `started_at = 2026-07-24 13:30:37.922+00`
  - `inngest_run_id = 01KYA52Z4EE8WYXAZTG4TQPPD5` — note this stores the **event** ULID, not the function-**run** ULID (`…VKJ`). Minor data-quality bug, hurts correlation (see Q-adjacent fix R8).
- **Storage:** the CRC upload prefix is `workflow-runs/comment-resolution-check/{{input.projectId}}/{{datetime}}`, stamped at **upload** time (`bureau/workflows/comment-resolution-check/workflow.yaml:135-137`). The failed run produced **no folder at all** — under the `23301a8a…` project prefix the folders jump from the 07-23 run (`…181201`) straight to the two 07-24 backup runs (`…152618`, `…161834`), with nothing near this run's 13:30 start. `outputs_path` is null. Nothing uploaded ⇒ no review row downstream. (Folder timestamps track *completion* time, confirming the stamp is at upload, so a hard-killed run leaves no trace in storage.)

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

### Where the logs survive — the upload boundary

Conductor's logs have three homes with very different durability. The uploader ships the `output/`, **`logs/`**, and `workflow/` workspace dirs to the run's storage bucket (`conductor/src/shared/storage-uploader.ts:43`) — and `logs/` is exactly where pino writes `conductor.log` + `conductor-error.log` (`conductor/src/shared/logger.ts`). Critically, that upload runs from `engine.ts:487`, which the code comments **"always, even on step failure"**: a step returning an error breaks the step loop (`engine.ts:471-477`) but still falls through to the upload. So the durability axis is **not** success-vs-failure — it is **whether conductor's own process reached line 487 before it died**:

| scenario | reaches `engine.ts:487` upload? | logs in Supabase storage? | Better Stack? |
|---|---|---|---|
| Workflow succeeds | ✅ | ✅ (`output/` + `logs/` + `workflow/`) | ✅ |
| Step **fails gracefully** (conductor exits its own loop) | ✅ | ✅ | ✅ |
| Conductor **hard-killed mid-run** — SIGKILL from `sandbox.stop()`, OOM, or the sandbox 300m cap | ❌ never reached | ❌ storage empty, `outputs_path` null | ⚠️ only what already streamed |

**This run is row 3.** The hang → substation's `sandbox.stop()` SIGKILLed conductor mid-step → line 487 was never reached → storage empty, `outputs_path` null. Better Stack was the only survivor. Two caveats make even that imperfect for row 3:

- `flushLogs()` only runs on conductor's own exit paths (`conductor/src/index.ts:356/387/392/399`). **A SIGKILL bypasses all of them**, so the final buffered `@logtail/pino` batch is lost — which is why the Better Stack trail cuts off dead at 13:31:43 with no shutdown line.
- The sandbox is `persistent: false` (`setup.ts:29`), so the local `logs/*.log` files are discarded on stop — no post-mortem retrieval from the box.

The observability remediations below (R3/R4/R6, and the new R13 log-durability cluster) matter precisely because **the hard-kill path is the same path that loses the logs** — the runs we most need to diagnose are the ones that leave the least behind.

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

Notably a **35-worker run completed on the same day (2026-07-24)** — so this was not a platform-wide outage; it is specific to the 65-worker concurrency. Stronger still: after the 65-worker run hung, two `maxWorkers:35` **backup runs on the exact same project + submission** were fired ~1.5 h later — `…run-2-haiku-backup` (`f74c56e9`, started 15:04, completed in **24 min**) and `…run-3-sonnet-backup` (`f972c1ad`, started 15:12, completed in **69 min**). Same inputs, same day, lower concurrency → both succeeded. This rules out a data-specific or platform-wide cause and isolates the variable to concurrency. The default `maxWorkers` is **10** (`conductor/src/orchestrator/types.ts:133`); the root `CLAUDE.md` documents review as "parallelized up to 30 workers." **65 was ~1.7× the highest value ever known to work and 6.5× the default.**

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
- **R5. Orchestration heartbeat.** Emit a periodic line from the orchestrator — `event=orchestration.heartbeat` with `{running, completed, failed, queued, oldestAgentAgeMs}` every ~30–60 s during parallel steps. A single stall would then be obvious within a minute instead of invisible for 3 hours. *Highest diagnostic ROI for the effort* — but note R13e (a resource-sampling **sidecar**) is the more robust realization, since an in-process timer can be starved with the loop it lives in; prefer R13e and keep R5 only under a no-extra-process constraint.
- **R6. Agent-subprocess visibility + dead-child detection.** Today only the orchestrator logs; the 65 agent subprocesses ship nothing, so a stall is a black box. Surface per-agent lifecycle (`agent.completed`/`agent.failed`/progress), and ensure a silently-killed child (OOM) causes its `query()` promise to **reject**, not hang — otherwise R1's timeout is the only safety net.

### P1b — Log durability under resource pressure (the "we have no logs" problem)

The runs we most need to diagnose (hard-kills) upload nothing (row 3 of the boundary table). Design principle: **the only durable logging is logging that leaves the box *continuously*, to a sink that outlives the box.** "Flush harder at the end" cannot help a process that is torn down — which is exactly why Better Stack (a streaming out-of-box sink) held the trail while storage (an end-of-run push) held nothing.

#### First, the logging topology (verified) — and what it means for a "sibling flusher"

Before choosing a mechanism, three facts about how conductor logs today (all on `main`):

1. **Logging is centralized in the orchestrator process.** The orchestrator drives each agent's SDK stream with `for await (const message of query(...)) { logger.info(message) }` (`conductor/src/agent/runner.ts:285,305`), and the `progress` MCP tool logs through the same orchestrator logger (`conductor/src/tools/progress.ts:37`). **The agent SDK subprocesses do not write conductor's logs at all** — they stream messages back over IPC and the orchestrator logs them. (This is why only `pid 117` appears in Better Stack.)
2. **Shipping is already off the main event loop.** `pino ^10` + `transport({targets})` runs the file writes *and* the `@logtail/pino` HTTP shipping in a **worker thread** (`conductor/src/shared/logger.ts:86`). `logger.info()` is a near-non-blocking enqueue.

   → **Consequence for the proposed "sibling that flushes every N s so the agents don't hang on flushes":** the agents *already* don't touch logging, and shipping is *already* off the orchestrator's event loop — so no agent or the orchestrator is blocking on a flush today. A sibling that only *flushes existing log files* therefore adds **durability but no new signal.**
3. **The Friday failure was not "flush blocked work" — it was "log *production* stopped."** The orchestrator went silent at 13:31:43 because the 65 agents stopped streaming messages (hung) and/or the orchestrator couldn't service 65 IPC streams. A file-flushing sibling ships what is written to disk; if the orchestrator writes nothing new, the sibling ships nothing new — it would have surfaced the same 152 lines and no more.

**So a sibling flusher is worth doing for durability, but it is not sufficient for diagnosis. The robust form is a sibling that *independently produces new signal* the sick orchestrator cannot** — see R13e.

#### Remediations, matched to death mode

- **R13a. Periodic in-run log flush to storage (conductor).** A worker-thread/timer that upserts `logs/conductor.log` + `conductor-error.log` to the run's bucket every ~60 s, not just at `engine.ts:487`. Gives Supabase-storage parity with the Better Stack trail — independent of end-of-run upload *and* of the interactively-authenticated Better Stack MCP connector (so a headless/cron session self-serves logs). Durability only (see topology note); pairs with R13e for signal.
- **R13b. Substation harvests logs before it kills the box.** The 3h death is **not** a surprise — substation *initiates* it. On the `waitForEvent` timeout (and in `catch`), before `sandbox.stop()`, run one command in the sandbox to upload `logs/` (or read files out via the SDK). Rescues the "box starved/blocked but still responsive" case — plausibly Friday's. **Required because `sandbox.stop()` is a hard control-plane session teardown** (`@vercel/sandbox` `session.stop()` → `stopSession`, no in-box SIGTERM grace), so conductor's own `flushLogs()` never runs. Shares the pre-teardown window with R3 (mark row failed).
- **R13c. Shrink the logtail buffer window.** Reduce `@logtail/pino` batch size / flush interval so a SIGKILL loses less in-flight. Cheap; tradeoff is network chatter.
- **R13d. (stretch) SIGTERM-with-grace before teardown.** Substation `kill('SIGTERM')`s the detached conductor command and waits before `stop()`; conductor installs a handler that flushes + uploads. Only helps when the box is responsive — the regime R13b already covers with less coupling — so optional.
- **R13e. ★ Resource-sampling heartbeat *sidecar* (the robust answer to the sibling question).** A **separate OS process** (not a worker thread, not the orchestrator loop), spawned by conductor bootstrap, that every ~15–30 s: samples `/proc/meminfo`, `/proc/loadavg`, and per-process state (count of agent processes + their R/S/**D**/Z state, RSS, FD counts), and ships those as its own lines to Better Stack **and** storage. Why a separate process and not an in-orchestrator `setInterval` (the R5 heartbeat): a sidecar keeps emitting signal even when the orchestrator's event loop is jammed *or the orchestrator process itself is OOM-killed* (the kernel reaps the largest RSS — an agent or the orchestrator — not a tiny sampler). It is the one mechanism that can tell us **whether the box was starved vs. the agents were hung** (directly answers Q1/Q2/Q6) because it observes from *outside* the thing that failed. It can also perform R13a's flush. **This is the load-bearing robustness improvement.** It still dies at whole-box teardown — hence R13b remains the backstop.
- **R13f. Trim the per-message logging firehose (efficiency).** `runner.ts:305` logs *every* full SDK message at `info` for all agents; across 65 agents that is a serialization + I/O load on the orchestrator that may itself contribute to starvation and balloons the log files. Log lifecycle events at `info`, gate raw messages behind `debug`. Reduces the orchestrator's own footprint — helps every scenario above.

**Recommendation:** ship **R13e + R13b** as the primary pair — an out-of-process signal producer that streams continuously, plus a guaranteed pre-teardown harvest — with **R13a** folded into the sidecar and **R13c/R13f** as cheap riders. R13d deferred. A sidecar (R13e) supersedes the in-process R5 heartbeat for robustness; keep R5 only if a zero-new-process constraint forces it. **None of these remove the irreducible floor** (below) — that is R1/R2/R7's job.

#### The irreducible floor — and why it's narrow

There is a real limit: a box that dies **faster than a single batch can leave it** (near-instant catastrophic OOM, or a kernel-level teardown) can only ever surface what already streamed out. No in-box heroics change that. But this floor is narrower than "resource-constrained runs just lose their logs":

1. Most resource deaths are *gradual* (thrash/creep), where continuous shippers (Better Stack, R13a, and especially the out-of-process R13e sidecar) keep exporting until the box is too sick to run the sampler — capturing the **onset**, which is the diagnostically valuable part. Note Friday's logs are complete up to 13:31:43, the exact moment things went wrong; the missing 3 h is mostly (suspected) silence, not lost signal.
2. Continuous shippers only lose to the box under CPU/OOM starvation — which is itself caused by oversaturation. So the highest-leverage "keep the logs" fix is **don't let the box get that sick**: R1 (per-agent timeout → graceful failure → normal upload) and R2/R7 (concurrency within headroom). Prevention converts row 3 of the table into row 2.
3. The truly-zero-logs case then collapses to "instant catastrophic death before any export," which for these workflows is rare and, if it recurs, is a signal to prevent (cap concurrency / size the box), not to instrument.

**So: no, "we have no logs" should not be an accepted outcome for the common (gradual) resource-pressure deaths — R13e (out-of-process signal) + R13b (harvest-before-kill) make those self-documenting, and R13a mirrors them into our own storage. Yes, there is a narrow floor for instantaneous catastrophic death, and the honest answer there is prevention (R1/R2/R7), not capture.**

### P2 — Structural / follow-up

- **R7. Right-size concurrency to the box.** Either scale sandbox `vcpus` up when a high `maxWorkers` is requested, make conductor concurrency a function of available memory, or shard agents across multiple sandboxes. Depends on Q4/Q5.
- **R8. Fix `inngest_run_id` provenance.** It currently stores the event ULID (`event.id`, passed as `--inngest-run-id=${event.id}` at `workflow-run.ts:115`), not the function-run ULID. Store both, or the run ULID, so DB ↔ Inngest correlation is 1:1.
- **R9. Better Stack ergonomics.** (a) Bind `runId` **and** `sandboxId` to conductor's root logger so every line is filterable (not just `createRun`). (b) Consider a dedicated `conductor` source instead of co-mingling in `Reviewer`. Removes the "correlate by sandbox hostname" archaeology this investigation required.

### Docs / CLAUDE.md

- **R10.** Root `CLAUDE.md`: reconcile the "up to 30 workers" claim with the enforced ceiling (R2); add a one-liner on the 4-vCPU sandbox and the concurrency/memory relationship.
- **R11.** Conductor `CLAUDE.md`: document the per-agent timeout (R1) and the `maxWorkers` clamp (R2) once shipped, under a "Danger Zones"-style note.
- **R12.** Add a **"Diagnosing a hung cloud run" runbook** (this topic dir or conductor docs) capturing the recipe used here: find the row in `workflow_runs`; the durable log trail is Better Stack source `Reviewer` (`1654842`); correlate by sandbox hostname (`JSONExtract(raw,'hostname',...)`) over `s3Cluster(primary, t490582_reviewer_s3)` (>30 min old) vs `remote(t490582_reviewer_logs)` (last ~30 min); watch for `agent.started` with no matching `agent.completed`. **Prerequisite to record:** Better Stack access in this investigation was via the interactively-authenticated Better Stack **MCP connector** (`mcp__…_Betterstack__query`, credentials held connector-side, not in the repo) — a headless/cron session won't have it. Once R13a ships, the same logs are self-servable from the run's storage bucket without the connector, which is the more portable path the runbook should prefer.

**Suggested sequencing:** R1 + R2 first (they'd have prevented the loss outright), then R3 + R13b together (one substation pre-teardown window: mark the row failed *and* harvest logs) and R13e (the resource-sampling sidecar — turns future stalls self-documenting and answers Q1/Q2/Q6), then R13a/R13c/R13f/R4/R6, then P2. R1 and the substation cluster (R3/R13b) are independently valuable and can ship in parallel across the two repos.

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
- **Q6. Was the box still *responsive* at the 3h mark?** This decides whether R13b (harvest-before-kill) actually rescues logs or whether the box was already dead. Can't be answered retroactively (sandbox gone), but the R13e sidecar answers it directly on the next stall: sidecar signal still streaming during a stall ⇒ box alive, agents hung (R13b works, and R1 is the fix); sidecar also goes dark ⇒ whole box starved/torn down (lean on already-streamed samples + R2/R7 prevention). The per-process state it samples (agents in `D` uninterruptible sleep vs. gone/zombie) also disambiguates Q1/Q2/Q3.

### Proposed repro / investigation plan

Re-run the **exact** inputs (`projectId 23301a8a…`, `submissionVersionId 0e308099…`, `crcGuidesSubmissionVersionId 6b9b85ed…`, `runs: 5`) at `maxWorkers: 65` **with instrumentation**, against a `maxWorkers: 39` control:

1. Land R13e (the resource-sampling sidecar) first — it is both the fix and the instrument: its `/proc` samples + per-process state reveal whether agents are inching forward, stuck in `D`, or gone.
2. (Subsumed by R13e — the sidecar *is* the sampler: `/proc/meminfo` + `/proc/loadavg` + process/FD counts every ~15 s, streamed off-box.)
3. Optionally bump the repro sandbox to `vcpus: 8` to isolate memory-vs-CPU (if 65 succeeds at 8 vCPU, it's resource-bound per Q1; if it still hangs, suspect a shared dependency / deadlock).
4. Compare `agent.completed` cadence and peak RSS across 39 vs 65 to locate the cliff (Q4).

*Do not fire any repro without Will's explicit go on the exact payload.*

## Scope / non-goals

- Not changing the CRC workflow logic, guides, or agent prompts — this is an orchestration-resilience + observability bug, discipline-agnostic (it would bite CC and review identically).
- Not redesigning the substation↔conductor completion protocol (detached + webhook + waitForEvent stays); R3/R4 harden its failure edges only.
- Not raising the 3h outer timeout — the goal is to **never rely on it** as the failure mechanism.
