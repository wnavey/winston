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
| Inngest app structure | **Fourth app in the existing prod environment** | Substation, Conductor, Dispatcher already live as separate apps in one Inngest prod env. field-agent joins as a fourth app (Connect transport). Events route by name across the env. No new env, no branch env — follows existing precedent. |
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

## `diligence_runs` + `diligence_artifacts` tables (new Supabase migration in Substation)

The schema FK-anchors each run to the originating feasibility-intake `document_version` rather than storing raw address/intended_use strings. From any `diligence_runs` row we can reach the conversation, the intake document, its attachments, the submission, and the project via supported joins — validated against the existing schema before locking in.

Output PDFs live in their own `diligence_artifacts` table (normalized, queryable, extensible) rather than a `result` JSONB blob.

```sql
create table public.diligence_runs (
  id uuid primary key default gen_random_uuid(),
  inngest_event_id text unique not null,                    -- API-facing runId equivalent

  -- Primary anchor: the feasibility-intake document_version that triggered this run.
  -- The kind='feasibility_intake' invariant is enforced by Substation's
  -- /diligence/trigger route (application layer), not by a DB trigger.
  document_version_id uuid not null references public.document_version(id),
  conversation_id uuid references public.conversations(id),
  project_id uuid not null references public.project(id),
  triggered_by_user_id uuid references auth.users(id),

  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','cancelled')),
  error text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  started_at   timestamptz,
  completed_at timestamptz
);

create index on public.diligence_runs (status);
create index on public.diligence_runs (project_id);
create index on public.diligence_runs (conversation_id);
create index on public.diligence_runs (document_version_id);

create table public.diligence_artifacts (
  id uuid primary key default gen_random_uuid(),
  diligence_run_id uuid not null references public.diligence_runs(id) on delete cascade,

  kind text not null
    check (kind in ('site_intelligence_report','research_appendix','supporting_document_copy')),
  storage_path text not null,                                -- submission-data bucket
  file_name    text not null,
  content_type text not null default 'application/pdf',
  file_size    bigint,
  page_count   int,

  created_at timestamptz not null default now()
);

create index on public.diligence_artifacts (diligence_run_id);
create index on public.diligence_artifacts (kind);
```

Plus an `updated_at` auto-bump trigger and project-access-based RLS mirroring `submission_report` (reads gated by `user_can_see_project`; writes by `get_user_project_access_level IN ('write','admin')`). field-agent writes via service-role and bypasses RLS. Both tables added to `supabase_realtime` so cityhall's UI can observe status without polling.

**Schema rationale (decisions made during design):**
- **`document_version_id` is the anchor**, not raw address/intended_use. Address, intended use, supporting attachments are all derivable from the intake document_version + its sections + its conversation's `chat_message_attachment` rows.
- **No `workflow_runs` FK.** field-agent isn't driven by Substation's `workflow-run` Inngest function — it's its own Connect worker. The `inngest_event_id` gives us Inngest-dashboard correlation. `diligence_runs.status` is canonical.
- **Status lifecycle owned by `diligence_runs`** (queued / running / completed / failed / cancelled). The trigger route inserts at `queued`; field-agent flips to `running` then `completed` (or `failed`).
- **No `submission_version_id` column** — it's reachable in one join through `document_version`, and storing it would just denormalize.

Migration lives at `substation/supabase/migrations/20260529180000_diligence_runs.sql` (PR noetic-inc/substation#97).

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

The event payload is minimal — just the `diligence_run_id`. The worker uses that to find the `diligence_runs` row and flip its status. Address/intended_use/attachments aren't passed via the event because they're already in the database via the `document_version_id` FK.

```ts
const STUB_SLEEP_MS = 10 * 60 * 1000; // 10 minutes — long enough to feel real

export const diligenceRun = inngest.createFunction(
  {
    id: 'diligence-run',
    concurrency: 1,
    triggers: [{ event: 'diligence/requested' }],
  },
  async ({ event, step, logger }) => {
    const { diligence_run_id } = DiligenceRequestSchema.parse(event.data);

    logger.info('[diligence-run] received', { diligence_run_id });

    await step.run('mark-running', async () => {
      await updateRunStatus(diligence_run_id, {
        status: 'running',
        started_at: new Date().toISOString(),
      });
    });

    await step.sleep('stub-work', `${STUB_SLEEP_MS}ms`);

    await step.run('mark-completed', async () => {
      await updateRunStatus(diligence_run_id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    });

    return { diligence_run_id, status: 'completed', stub: true };
  },
);
```

Phase 1 stub does **not** write `diligence_artifacts` rows — no PDFs are generated. That table starts seeing inserts in Phase 2 once the real skill produces SIR + Research Appendix PDFs.

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
    document_version_id: string   // MUST reference a feasibility_intake document_version
  }
  returns: {
    diligence_run_id: string,
    status: 'queued'
  }

GET /diligence/:diligence_run_id
  returns: {
    diligence_run_id: string,
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled',
    document_version_id: string,
    conversation_id: string | null,
    project_id: string,
    error: string | null,
    created_at: string,
    started_at: string | null,
    completed_at: string | null,
    updated_at: string,
    artifacts: Array<{
      id: string,
      kind: 'site_intelligence_report' | 'research_appendix' | 'supporting_document_copy',
      file_name: string,
      content_type: string,
      file_size: number | null,
      page_count: number | null,
      signed_url: string                // generated at read time, 72h expiry (Phase 2)
    }>
  }
```

**Trigger handler logic:**

1. Validate inputs with zod (`document_version_id` is a UUID).
2. **Enforce the intake invariant:** look up the `document_version` → `document`, reject if `document.kind !== 'feasibility_intake'`. This is the application-layer check that backs the rationale-only comment in the migration.
3. Derive `project_id` via `document_version.submission_version_id → submission.project_id`.
4. (Optionally) look up `conversation_id` — find the most recent `feasibility_intake` conversation for the same project, if any.
5. Resolve `triggered_by_user_id` from the request's auth context.
6. `await inngest.send({ name: 'diligence/requested', data: { diligence_run_id: <to-be-determined> } })` — capture the returned event id.
7. Insert into `diligence_runs` with `status='queued'`, the FKs from above, and the captured `inngest_event_id`.
8. Return `{ diligence_run_id, status: 'queued' }`.

Implementation note: the order of (6) and (7) creates a chicken-and-egg with `diligence_run_id`. Two options: (a) `insert` first to get the id, then `inngest.send` with that id, then `update` the row with `inngest_event_id`; or (b) `inngest.send` first to get the event id, then `insert` with both ids together. Option (b) is cleaner — one INSERT, no UPDATE.

**Status handler:** `select` the row by `id`, join `diligence_artifacts` for the run's outputs, generate signed URLs for each artifact's `storage_path` at read time. No Inngest API needed because the worker writes status to the table directly.

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
     # Pick an existing feasibility_intake document_version id from the local DB:
     #   select dv.id from document_version dv
     #     join document d on d.id = dv.document_id
     #    where d.kind = 'feasibility_intake' limit 1;
     #
     # Then trigger the run:
     curl -X POST http://localhost:3001/diligence/trigger \
       -H 'Content-Type: application/json' \
       -d '{ "document_version_id": "<uuid-of-feasibility-intake-doc-version>" }'
     ```

   - Poll `GET /diligence/:diligence_run_id` every ~30s.
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
