# Field Agent — Implementation Plan

A long-running API surface for the `noetic-tools:diligence-report` skill: cloud-deployed trigger publishes an Inngest event, a laptop-side worker consumes via Inngest Connect, runs the skill, and returns deliverables.

The plan is **scaffolding-first**: Phase 1 ships the entire pipeline with a stub worker that fakes the diligence run (sleep + status updates). Phase 2 swaps the stub for real skill invocation. This lets us validate every part of the system — trigger route, event routing, Connect transport, status tracking, deliverable handoff shape — before we depend on the slow, expensive, hard-to-debug skill itself.

---

## Goal

Trigger a Site Intelligence Report (SIR) run from a public HTTP endpoint and receive the resulting PDFs (SIR + Research Appendix) back as signed URLs, with progress observable along the way. Compute stays on Winston's laptop where the diligence skill, its plugins, and the durable `~/noetic/bureau/jurisdictions/<slug>/feasibility-guides/` directory already live.

## Phase 1 scope (scaffolding)

- Substation trigger endpoint accepts requests and publishes events
- Standalone `field-agent` connects to Inngest via Connect and consumes `diligence/requested` events
- **Stub function body:** log the event, set status to `running`, sleep ~10 min, set status to `completed` with a placeholder result
- Job status persisted to a new `diligence_runs` Supabase table
- Substation status endpoint reads from the table
- End-to-end smoke test: curl → event → stub worker → status flips → completion observable

Phase 1 explicitly **does not** include the Claude Agent SDK, the diligence skill itself, real PDF generation, or storage upload. Those land in Phase 2 against a working scaffold.

## Phase 2 scope (real diligence runs)

- Worker imports `@anthropic-ai/claude-agent-sdk`
- Worker invokes `/diligence-report` skill programmatically with the event payload
- Worker uploads resulting PDFs to Supabase storage with 72h signed URLs
- Worker writes signed URLs + local path to the `diligence_runs.result` column
- Concept-plan PDF download path implemented (worker pulls supporting docs from `submission-data` bucket before invoking the skill)

## Phase 3 scope (productionization)

- Move worker from laptop to an always-on VM (Fly.io / Hetzner) — same code, different host
- Multi-tenant auth on the trigger endpoint
- Concurrent runs / multi-worker scale-out
- Webhook callbacks instead of polling for completion

---

## Architecture

```
┌────────────────────────────┐         ┌────────────────────────┐
│ Substation (Vercel)        │         │ Inngest Cloud          │
│ POST /diligence/trigger    │─send──▶ │ event:                 │
│   - validate inputs        │         │ diligence/requested    │
│   - insert diligence_runs  │         └───────────┬────────────┘
│   - inngest.send()         │                     │
│   - return runId           │                     │ Connect
└────────────────────────────┘                     │ (outbound ws)
        ▲                                          ▼
        │ GET /diligence/:runId    ┌──────────────────────────────┐
        │ (read diligence_runs)    │ field-agent (laptop)    │
        │                          │  Node 22.4+ standalone proc  │
        │                          │   Phase 1: stub body         │
        │                          │     - update status=running  │
        │                          │     - sleep 10m              │
        │                          │     - update status=completed│
        │                          │   Phase 2 adds:              │
        │                          │     - Claude Agent SDK       │
        │                          │     - skill invocation       │
        │                          │     - Supabase upload + sign │
        │                          │     - emit diligence/done    │
        │                          └──────────────────────────────┘
```

### Decisions locked in

| Decision | Choice | Notes |
|---|---|---|
| Worker location | Standalone laptop process | Not a Vercel Sandbox; not part of Substation |
| Inngest transport | Connect (outbound websocket) | TS SDK v4 (GA), Connect feature in public beta — fine for our use case |
| Inngest app structure | **Two apps in one environment** | Substation is app A (existing, `serve()`). field-agent is app B (new, Connect). Events route by name across the env |
| Status persistence | New `diligence_runs` Supabase table | Owned by Substation's Supabase project; worker writes status, trigger route reads it |
| Skill invocation (Phase 2) | `@anthropic-ai/claude-agent-sdk` in-process | Not subprocess; programmatic session with `noetic-tools` plugin loaded |
| Trigger surface | New Hono route in Substation | `POST /diligence/trigger`; reuses Substation auth + `submission-data` bucket |
| Deliverable handoff (Phase 2) | **Both** — local copy + Supabase upload + 72h signed URLs | Local is source of truth; signed URLs for remote callers |

### Open / TBD items

- **Auth on `/diligence/trigger`.** Reuse whatever Substation uses for other org-scoped routes; confirm during implementation.
- **Signed-URL bucket choice (Phase 2).** Default to `submission-data` (already configured). If we want diligence outputs in their own bucket for lifecycle policies, add a `diligence-deliverables` bucket — small change, but a decision to make.
- **Concept plan PDF size cap.** Trigger route should reject uploads above some threshold (suggest 100MB) before paying for storage + the worker download.
- **What happens if Inngest Connect websocket drops mid-run.** Tolerable because phases are durable via `step.run`; document the retry semantics so we know what re-runs look like.

---

## `diligence_runs` table (new Supabase migration in Substation)

```sql
create table public.diligence_runs (
  id uuid primary key default gen_random_uuid(),
  run_id text unique not null,            -- Inngest event id, surfaced as API runId
  property_slug text not null,
  address text not null,
  intended_use text not null,
  supporting_docs jsonb default '[]'::jsonb,   -- [{ storage_path, kind }]
  status text not null default 'queued',  -- queued | running | completed | failed
  result jsonb,                            -- { signedUrls: { sir, appendix }, localPath } (Phase 2)
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.diligence_runs (status);
create index on public.diligence_runs (property_slug);
```

Update trigger to bump `updated_at` on row changes. Service-role writes only (worker + trigger route both run with service-role keys); no RLS needed for Phase 1.

---

## Phase 1 workstreams

Three streams. Stream A and Stream B can develop in parallel once the table migration lands. Stream C is the smoke test that ties them together.

### Stream A — `field-agent` repo (stub)

**Location:** New repo at `/Users/winston/workspace/field-agent/`.

**Layout (Phase 1 only — Phase 2 expands `src/`):**

```
field-agent/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── src/
│   ├── index.ts                 # entrypoint: starts Inngest Connect worker
│   ├── inngest/
│   │   ├── client.ts            # new Inngest({ id: 'field-agent' })
│   │   └── functions/
│   │       └── diligence-run.ts # the function — event diligence/requested
│   ├── status/
│   │   └── update.ts            # Supabase client; writes to diligence_runs
│   └── lib/
│       └── env.ts               # typed env loader
└── scripts/
    └── dev.ts                   # convenience runner
```

**Dependencies (Phase 1):**
- `inngest@^3.34.1` (Connect support)
- `@supabase/supabase-js`
- `zod` (event payload validation)
- TypeScript, tsx for dev

(`@anthropic-ai/claude-agent-sdk` is added in Phase 2.)

**Runtime requirements:** Node 22.4+ (native WebSocket).

**Stub function shape — `diligence-run.ts`:**

```ts
const STUB_SLEEP_MS = 10 * 60 * 1000; // 10 minutes — long enough to feel real

export const diligenceRun = inngest.createFunction(
  { id: 'diligence-run', concurrency: 1 },
  { event: 'diligence/requested' },
  async ({ event, step, logger }) => {
    const { runId, propertySlug, address, intendedUse } =
      DiligenceRequestSchema.parse(event.data);

    logger.info('diligence-run received', { runId, propertySlug, address });

    await step.run('mark-running', async () => {
      await updateRunStatus(runId, { status: 'running' });
    });

    await step.sleep('stub-work', `${STUB_SLEEP_MS}ms`);

    await step.run('mark-completed', async () => {
      await updateRunStatus(runId, {
        status: 'completed',
        result: {
          stub: true,
          message: `stub completion for ${propertySlug} (${intendedUse})`,
        },
      });
    });

    return { runId, propertySlug, status: 'completed', stub: true };
  },
);
```

**Env vars (`.env.example`):**

```
INNGEST_APP_ID=field-agent
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

(Phase 2 adds `ANTHROPIC_API_KEY` and `NOETIC_DILIGENCE_ROOT`.)

**Run locally:**

```bash
cd /Users/winston/workspace/field-agent
pnpm install
pnpm dev   # tsx watch src/index.ts — opens Connect websocket
```

### Stream B — Substation trigger route + status endpoint

**Files to touch:**

- `substation/supabase/migrations/<timestamp>_diligence_runs.sql` *(new)* — table migration
- `substation/src/routes/diligence.ts` *(new)* — Hono router for the two endpoints
- `substation/src/index.ts` — mount the router
- `substation/src/inngest/events.ts` *(check if exists; otherwise inline)* — type the `diligence/requested` event payload

**Endpoints:**

```
POST /diligence/trigger
  body: {
    address: string,
    intended_use: string,
    concept_plan?: { storage_path: string }  // already uploaded via existing prepare-upload flow
  }
  returns: { runId: string, propertySlug: string, status: 'queued' }

GET /diligence/:runId
  returns: {
    runId: string,
    propertySlug: string,
    status: 'queued' | 'running' | 'completed' | 'failed',
    result?: { stub: true, message: string } | { signedUrls: {...}, localPath: string },
    error?: string,
    createdAt: string,
    updatedAt: string
  }
```

**Trigger handler logic:**

1. Validate inputs with zod
2. Generate `propertySlug` from address (deterministic; same function used downstream)
3. If `concept_plan.storage_path` provided, verify file exists in bucket (Phase 2 actually does something with it; Phase 1 just records the path)
4. `inngest.send({ name: 'diligence/requested', data: { ... } })` — capture returned event id as `runId`
5. `insert into diligence_runs (...)` with `status='queued'`
6. Return `{ runId, propertySlug, status: 'queued' }`

**Status handler:** Simple `select * from diligence_runs where run_id = $1`. No Inngest API needed because the worker writes status to the table directly.

**Auth:** Whatever pattern `submissions.ts` uses — copy it. Worth a 15-min look during implementation.

### Stream C — Inngest environment setup + end-to-end smoke test

1. **Create a new Inngest app** in the Inngest dashboard for `field-agent`. Same environment as Substation.
2. **Generate event key + signing key** for the new app. These go into the worker's `.env`.
3. **Confirm event-name routing.** In Inngest, events are routed by name across all apps in an environment. Substation publishes `diligence/requested` from its existing app; the new worker app subscribes.
4. **Smoke test sequence:**
   - Worker running locally (`pnpm dev` in `field-agent`).
   - Substation running locally (`pnpm dev` in `substation`).
   - From a third terminal:

     ```bash
     curl -X POST http://localhost:3001/diligence/trigger \
       -H 'Content-Type: application/json' \
       -d '{
         "address": "1700 S Lamar Blvd, Austin, TX",
         "intended_use": "for-sale townhomes, ~40 units"
       }'
     ```

   - Poll `GET /diligence/:runId` every ~30s.
   - Verify status transitions: `queued` → `running` (within seconds) → `completed` (after ~10 min).
   - Inngest dashboard shows a clean run with `mark-running` → `stub-work` (sleep) → `mark-completed` steps visible.

If this passes, Phase 1 is done and the scaffolding is ready for Phase 2 to swap in the real skill body.

---

## Phase 1 sequencing — smallest viable first commit

**Commit 1 (Stream B, schema):** Add the `diligence_runs` migration. Run locally to confirm. No code paths exercise it yet.

**Commit 2 (Stream A, boots):** `field-agent` repo skeleton that boots, connects to Inngest via Connect, registers a no-op function for `diligence/requested` that just logs the event and returns. No status writes. Goal: prove the Connect websocket works with a test event fired manually from the Inngest CLI.

**Commit 3 (Stream A, stub body):** Wire up the Supabase client and the stub function body — mark-running, sleep, mark-completed. Test by manually inserting a `diligence_runs` row and firing a test event from the Inngest dashboard with a matching `runId`.

**Commit 4 (Stream B, trigger):** `POST /diligence/trigger` route in Substation. End-to-end: curl → row inserted → event fired → worker picks it up → status flips.

**Commit 5 (Stream B, status):** `GET /diligence/:runId` route. Smoke test (Stream C) runs against this.

Each commit is independently shippable and verifiable. No big-bang merges.

---

## Phase 2 sequencing (after Phase 1 lands)

**Commit 6:** Add `@anthropic-ai/claude-agent-sdk` to the worker. Replace `step.sleep` with a `step.run('invoke-skill', ...)` that programmatically runs `/diligence-report`. Still no upload — return paths only.

**Commit 7:** Supabase upload + signed URL generation. Worker writes `result.signedUrls` into the row.

**Commit 8:** Concept-plan download path. Worker pulls supporting docs from `submission-data` before invoking the skill.

**Commit 9:** Emit `diligence/completed` event (for any future downstream subscribers).

---

## Risks and mitigations

| Risk | Mitigation | Phase |
|---|---|---|
| Inngest Connect websocket drops mid-run | `step.run` per phase makes phases idempotent and resumable; Inngest at-least-once retries pick up where it left off | 1+ |
| Stub `step.sleep` for 10m hits Inngest pricing surprise | Verify Inngest's free/paid step.sleep semantics before committing; the stub run is artificial and only used during scaffolding validation | 1 |
| Claude Agent SDK output drift vs. skill expectations | Pin SDK version; test against the literal `diligence-report` skill version installed locally | 2 |
| Skill expects interactive terminal output | The SDK gives us a programmatic session — should work, but verify by running the skill via SDK against a tiny test case before wiring up to Inngest | 2 |
| Laptop sleeps mid-run | Inngest queues events while worker is offline; partial-run state is recoverable via `step.run` boundaries. Worst case: re-run from clean state | 2 |
| Two Inngest apps in one env collide on function id | Function ids are app-scoped, not env-scoped — no collision | 1 |

---

## Pre-flight checks

### Before Phase 1 starts

**Inngest Connect happy path.** Fork the smallest Inngest Connect example from the docs, point it at a fresh app in our environment, fire a test event from the dashboard, confirm the worker receives and acks it. Done in under an hour; eliminates the biggest unknown.

### Before Phase 2 starts

**Claude Agent SDK can invoke a skill programmatically.** Write a 30-line script that uses the SDK to invoke any small `noetic-tools` skill (e.g. `smoke-test`) and confirm it runs to completion and we can capture the result. This validates the skill-invocation pathway before we wire it into the worker.

If both check out at the right time, the rest of the plan is mechanical.
