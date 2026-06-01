# Field Agent — Implementation Plan

> **Last verified:** 2026-06-01 — Phase 1 smoke-test passed end-to-end against prod.
> **Status:** Phase 1 ✅ complete. Phase 2 not yet started. Phase 3 deferred.

A long-running API surface for the `noetic-tools:diligence-report` skill: a cloud-deployed trigger publishes an Inngest event, a laptop-side worker (field-agent) consumes via Inngest Connect, runs the skill, and writes status + deliverables back through Supabase.

The plan is **scaffolding-first**: Phase 1 shipped the entire pipeline with a stub worker. Phase 2 swaps the stub for real skill invocation. This lets us validate every part of the system — trigger route, event routing, Connect transport, status tracking, deliverable handoff shape — before we depend on the slow, expensive, hard-to-debug skill itself.

---

## What shipped in Phase 1

Validated end-to-end on 2026-06-01: `curl` → substation INSERT + Inngest event → field-agent (laptop, Connect) → status flip `queued → running → completed` → cityhall realtime UI updates without refresh.

| Layer | What | PR |
|---|---|---|
| substation | `diligence_runs` + `diligence_artifacts` schema, RLS, realtime publication | [noetic-inc/substation#97](https://github.com/noetic-inc/substation/pull/97) |
| substation | `POST /api/projects/:projectId/diligence` + `GET /:diligenceRunId` routes, integration tests | [noetic-inc/substation#98](https://github.com/noetic-inc/substation/pull/98) |
| substation | `SUBSTATION_SERVICE_API_KEY` auth path with route allowlist (mirrors IG pattern) | [noetic-inc/substation#99](https://github.com/noetic-inc/substation/pull/99) |
| field-agent | Initial scaffold (`@noetic/field-agent`, Node 22.4+, Inngest v4) | [noetic-inc/field-agent#1](https://github.com/noetic-inc/field-agent/pull/1) |
| field-agent | Connect handshake + stub body (`mark-running` → `step.sleep` → `mark-completed`) | [noetic-inc/field-agent#2](https://github.com/noetic-inc/field-agent/pull/2) |
| cityhall | `/project/[id]/diligence-runs/[id]` SSR page + Supabase realtime status widget | [noetic-inc/cityhall#483](https://github.com/noetic-inc/cityhall/pull/483) |
| cityhall | `docs/feasibility-research-runner.md` architecture spec | [noetic-inc/cityhall#482](https://github.com/noetic-inc/cityhall/pull/482) |
| winston | Plan, [`testing-kickoff.md`](./testing-kickoff.md), [`trigger-diligence.sh`](./trigger-diligence.sh) helper | wnavey/winston PRs #82, #83, #87, #88, #90, #91, #92 |

What this means concretely: the trigger surface, event routing, worker model, status persistence, and UI subscription all work in prod. The next time someone curls the trigger endpoint, the same loop runs — modulo the fact that field-agent's body is still a stub.

---

## Phase 2 — Real diligence runs (NEXT)

Phase 2 swaps field-agent's stub body for actual `@anthropic-ai/claude-agent-sdk` invocation of the `noetic-tools:diligence-report` skill, AND adds the cityhall UX so the chat can kick off diligence runs and surface them as RCM cards in the conversation.

Two workstreams; they can develop in parallel but the smoke test ties them together.

### Workstream P2-A — field-agent runs the real skill

Replace the stub body with the canonical 6-phase pipeline the skill orchestrates internally (jurisdiction check → vision extraction → research → discipline analysis → synthesis → render). Field-agent wraps that in `step.run` boundaries so partial progress is durable across worker restarts.

**Sequencing (each a separate commit):**

1. **Commit 6 — swap the sleep for the skill, return paths only.**
   Add `@anthropic-ai/claude-agent-sdk` to `field-agent/package.json`. Replace the `step.sleep('stub-work', ...)` call with:
   ```ts
   const deliverable = await step.run('invoke-skill', async () => {
     return invokeDiligenceSkill({
       diligenceRunId,
       documentVersionId: row.document_version_id,
       conversationId: row.conversation_id,
     });
   });
   ```
   `invokeDiligenceSkill` lives in `field-agent/src/skill/invoke.ts`. It:
   - Loads the intake `document_version` + its `document_section` rows from Supabase (address, intended use, tier content)
   - Downloads any `intake_attachment` files linked to the conversation
   - Creates an Agent SDK session with the `noetic-tools` plugin loaded so `/diligence-report` is available
   - Streams the agent's turns to a per-run log file under `~/noetic/diligence/<property-slug>/sir/run-<run-id>.log`
   - Waits for the agent's terminal message and returns local paths to the produced PDFs
   No Supabase storage upload yet — just returns where the files are on disk. Mark the run `completed` with the local paths in `result` JSONB (or leave `result` null and infer from artifacts; design choice).

2. **Commit 7 — upload artifacts + insert `diligence_artifacts` rows.**
   After `invoke-skill` resolves, a new `step.run('upload-artifacts')`:
   - Uploads `site-intelligence-report.pdf` to `submission-data/diligence/<diligence-run-id>/sir.pdf`
   - Uploads `research-appendix.pdf` to `.../appendix.pdf`
   - INSERTs one `diligence_artifacts` row per file with `kind`, `storage_path`, `file_name`, `content_type`, `file_size`, `page_count`
   The trigger route's `GET` endpoint already joins this table; the cityhall page will start showing artifacts as soon as rows land.
   **Signed URL generation lives on the substation read side**, not on the worker — generated at GET time with 72h expiry via `sb.storage.from('submission-data').createSignedUrl(...)`. The worker doesn't need to know about URL lifetimes; the route handles them per request.

3. **Commit 8 — supporting-doc / concept-plan download path.**
   For runs that have attachments (concept plan PDFs, plats, etc. via `intake_attachment` documents linked to the conversation), download them into the working dir before invoking the skill. New helper at `field-agent/src/skill/download-supporting-docs.ts`. Skip cleanly when the conversation has no attachments.

4. **Commit 9 — emit `diligence/completed` event.**
   After `upload-artifacts` succeeds, fire `inngest.send({ name: 'diligence/completed', data: { diligence_run_id } })`. No consumer in this phase, but it sets up the future where downstream subscribers (notifications, follow-up workflows) can react without changing the worker contract.

### Workstream P2-B — cityhall: trigger + `diligence_running_job` RCM

Currently the only way to kick off a diligence run is the `trigger-diligence.sh` curl helper. Phase 2 brings the action into the cityhall intake chat: when the user is ready to run diligence, the chat agent (or a UI button — see open question below) triggers it, and the conversation shows a **`diligence_running_job` RCM card** linking to the existing status page.

#### Trigger mechanism

**Two options, design decision to make before implementing:**

| Option | How user kicks it off | Pros | Cons |
|---|---|---|---|
| **Agent tool** | New `requestDiligenceRun` tool on the cityhall intake agent. Agent decides to call it (e.g. after Tier 1 completion + user agreement) or user asks it directly | Matches existing `updateIntakeNotes` pattern; agent has full context to decide; no UI changes | Agent might mis-fire; users can't kick off manually if agent doesn't oblige |
| **Right-panel button** | "Run Diligence" button in the intake right panel; enabled once Tier 1 is complete; fires a direct request from the page | Explicit user control; no LLM in the trigger loop; predictable | Doesn't auto-fire on milestones; agent isn't aware of the trigger unless we plumb it through |

Probably the right answer is **both, in sequence**: ship the agent tool first (smaller cityhall diff, matches existing patterns, lets the chat-driven flow work end-to-end), then add the button later as a manual override. The RCM design works the same regardless of trigger.

#### Server-side flow (cityhall calls substation)

Regardless of trigger mechanism:

1. Cityhall calls `POST /api/projects/:projectId/diligence` on substation with `{ document_version_id, conversation_id }` in the body.
2. Auth: the request goes out as the **user's Supabase JWT** (not the service API key), so `triggered_by_user_id` is populated on the row. The agent tool / button handler runs server-side in cityhall, so it has access to `locals.session.access_token`.
3. Substation responds with the created `diligence_runs` row (prefixed `dlr_<uuid>` id, status `queued`).
4. Cityhall INSERTs a new `chat_message` with `rcm_payload` carrying the `diligence_running_job` payload.
5. Cityhall's existing realtime subscription on `chat_message` picks up the new row → re-renders the conversation → the card appears.

#### RCM schema

Adds a new entry to cityhall's `src/lib/rcm/schemas.ts` discriminated union:

```ts
export const DiligenceRunningJobPayloadSchema = z.object({
  rcm_type: z.literal('diligence_running_job'),
  data: z.object({
    diligence_run_id: z.string(),       // dlr_<uuid> form
    project_id: z.string(),             // for building the link
    status: z.enum([
      'queued', 'running', 'completed', 'failed', 'cancelled',
    ]).optional(),                       // populated at insert time; static for Phase 2
  }),
});
```

#### RCM renderer

New file `cityhall/src/lib/rcm/DiligenceRunningJob.svelte`. Renders a card with:
- Title: "Diligence run kicked off" (or status-aware: "Running…" / "Completed" / "Failed")
- The link: `/project/<project_id>/diligence-runs/<diligence_run_id>` (relative URL, opens in same tab; user can ⌘-click for a new tab)
- A small status pill if `data.status` is set

For Phase 2, the card is **static** — it shows the state at insert time and links the user to the live status page for updates. Phase 3 could make it mutate in place (subscribe to realtime on `diligence_runs` from the chat side and update `rcm_payload.data.status`), but that's overkill for the MVP and conflicts with the partial-unique-index pattern other RCMs use.

#### Idempotency

To prevent duplicate diligence runs when the agent / user double-triggers or a network retry happens, add a partial unique index in substation:

```sql
create unique index chat_message_rcm_diligence_running_job_once_per_conv
  on chat_message ((rcm_payload->>'rcm_type'), conversation_id)
  where rcm_payload->>'rcm_type' = 'diligence_running_job';
```

(Same pattern as `chat_message_rcm_tier_1_info_complete_once_per_conv`.) Cityhall's writer catches the `23505` and resolves to the existing run's RCM instead of double-firing.

Open question: do we want this to be **once per conversation**, or **once per intake submission**? Once per conversation means a new chat thread can re-trigger; once per intake means literally one diligence run per submission. For Phase 2 I'd start with once-per-conversation since it matches the other RCM index granularity; revisit if we want stricter dedup.

#### Files touched (estimated)

- `cityhall/src/lib/rcm/schemas.ts` — add `DiligenceRunningJobPayloadSchema` to the discriminated union
- `cityhall/src/lib/rcm/components.ts` — map `diligence_running_job → DiligenceRunningJob.svelte`
- `cityhall/src/lib/rcm/DiligenceRunningJob.svelte` *(new)* — the renderer
- `cityhall/src/routes/api/chat/intake/+server.ts` — add `requestDiligenceRun` tool to the agent's tool registry; call substation; insert the RCM
- `cityhall/src/lib/server/substation.ts` — already has `substationPost`; no new helper needed
- `substation/supabase/migrations/<timestamp>_diligence_running_job_rcm_index.sql` *(new)* — partial unique index

### Phase 2 pre-flight check (do first)

**Confirm `@anthropic-ai/claude-agent-sdk` can invoke a `noetic-tools` skill programmatically.**

30-line throwaway script outside field-agent that imports the SDK, creates a session with the `noetic-tools` plugin loaded, invokes a tiny existing skill (e.g. `noetic-tools:smoke-test`), captures the final agent message, and exits. Verifies:

- SDK + plugin discovery work without a TTY
- The agent's terminal message is parseable from our process
- Stdout/stderr streams behave (no zombie processes, clean shutdown)

If it works, the rest of Phase 2 is mechanical wiring. If it doesn't, we diagnose the SDK before committing to changes inside field-agent.

---

## Phase 3 — Productionization (later)

Out of scope for now, but the architecture is built to support it:

- **Move field-agent off the laptop.** Same code, different host — a Fly.io machine, Hetzner box, or any always-on Linux box. Inngest Connect dials out from wherever it runs.
- **Multi-tenancy / auth tightening.** Today the substation API key is a single global secret; in production it'd be per-org or per-service-account with proper rotation.
- **Webhook callbacks on completion.** Anyone who wants to know when a diligence run finishes can subscribe to `diligence/completed` (Phase 2 emits it) or have substation POST to a registered webhook URL.
- **Concurrent runs.** Today the worker has `concurrency: 1` on the `diligence-run` function. A real production cluster would scale this up, partitioned by something sensible (project, org, hardware capacity).
- **Cleanup of old `diligence_runs` rows.** Test runs accumulate forever today. A retention policy + Inngest cron would garbage-collect rows older than N days that have `status != 'completed'` (or move completed ones to cold storage).

---

## Architecture

```
┌────────────────────────────┐         ┌────────────────────────┐
│ Substation (Vercel)        │         │ Inngest Cloud (prod)   │
│ POST /diligence/trigger    │─send──▶ │ event:                 │
│   - validate inputs        │         │ diligence/requested    │
│   - insert diligence_runs  │         └───────────┬────────────┘
│   - inngest.send()         │                     │
│   - return runId           │                     │ Connect
└────────────────────────────┘                     │ (outbound ws)
        ▲                                          ▼
        │ GET /diligence/:runId    ┌──────────────────────────────┐
        │ (read diligence_runs)    │ field-agent (laptop)         │
        │                          │  Node 22.4+ standalone proc  │
        │                          │   Phase 1 (✅ shipped):       │
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
| Inngest app structure | **Fourth app in the existing prod environment** | Substation, Conductor, Dispatcher already live as separate apps in one Inngest prod env. field-agent joins as a fourth app (Connect transport). Events route by name across the env. |
| Status persistence | `diligence_runs` Supabase table | Owned by Substation's Supabase project; worker writes status, trigger route reads it |
| Skill invocation (Phase 2) | `@anthropic-ai/claude-agent-sdk` in-process | Not subprocess; programmatic session with `noetic-tools` plugin loaded |
| Trigger surface | Hono route in Substation | `POST /api/projects/:projectId/diligence`; auth via `SUBSTATION_SERVICE_API_KEY` (route-restricted) OR user JWT |
| Deliverable handoff (Phase 2) | **Both** — local copy + Supabase upload + 72h signed URLs | Local is source of truth; signed URLs for remote callers |
| Trigger from cityhall (Phase 2) | Agent tool first, button second | Two-stage rollout; both call substation as the user JWT to populate `triggered_by_user_id` |

---

## `diligence_runs` + `diligence_artifacts` tables

Shipped in [substation#97](https://github.com/noetic-inc/substation/pull/97). Reference schema:

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

Plus `updated_at` auto-bump trigger, project-access-based RLS mirroring `submission_report`, both tables in `supabase_realtime` for cityhall subscriptions.

**Phase 1 stub does not write `diligence_artifacts` rows.** Phase 2 commit 7 starts populating them.

---

## HTTP contract

Shipped in [substation#98](https://github.com/noetic-inc/substation/pull/98). Both endpoints mounted under `/api/projects/:projectId/` to match existing project-scoped conventions.

### `POST /api/projects/:projectId/diligence`

```
body:    { document_version_id: uuid, conversation_id?: uuid }
returns: { id: 'dlr_<uuid>', object: 'diligence_run', status: 'queued', ... }
auth:    SUBSTATION_SERVICE_API_KEY (route-restricted, recommended for scripts)
         OR a Supabase user JWT (populates triggered_by_user_id)
status:  201 Created on success
```

Defense in depth: route confirms (a) the document_version belongs to `projectId`, (b) `document.kind = 'feasibility_intake'`. Bad inputs → `400`/`403`/`404` per kind of mismatch.

Generates `diligence_run_id` client-side (`crypto.randomUUID()`), fires the Inngest event with the id in the payload, INSERTs both ids together. No two-phase write.

### `GET /api/projects/:projectId/diligence/:diligenceRunId`

Returns the row + joined `diligence_artifacts`. Phase 1 returns artifacts with raw `storage_path`. Phase 2 will add `signed_url` per artifact, generated at read time with 72h expiry.

---

## Inngest event contract

```
event: diligence/requested
data:  { diligence_run_id: "<uuid>" }   // raw uuid, NOT dlr_ prefixed
```

Worker looks up the row by id and pulls everything else (intake doc, project, attachments) via DB joins. Minimal by design — address, intended use, supporting docs don't travel through the event.

`diligence/completed` is **reserved for Phase 2 commit 9**. No consumer today.

---

## Cleanup items / tech debt

Don't block Phase 2; mention if you want me to chip these between rounds.

1. **Regenerate substation DB types.** Once Docker + local Supabase are running, `pnpm gen-types` in substation pulls `diligence_runs` / `diligence_artifacts` into the typed client. Then the `getDiligenceClient()` helper in `substation/src/routes/diligence.ts` (and its mirror in the integration test) can go away.
2. **Promote `ZodError → 400` to `handleError`.** The per-route `safeParse` pattern I added in `routes/diligence.ts` to fix CI's 500s is local; centralizing the conversion would benefit every Substation route without per-route boilerplate. Separate small PR.
3. **Hardening for the API key middleware.** The integration tests I added cover the happy path + 403/401 cases, but a stress test (wrong path + wrong method permutations) wouldn't hurt.
4. **Cleanup SQL for test runs.** `testing-kickoff.md` includes a delete-all-completed snippet; could be a small script in this dir for convenience.
5. **Replace `STUB_SLEEP_MS=10000` default usage in docs.** Once Phase 2 ships and there's no more stub, the `STUB_SLEEP_MS` env var should be removed from the worker entirely.

---

## Risks and mitigations

| Risk | Mitigation | Phase |
|---|---|---|
| Inngest Connect websocket drops mid-run | `step.run` per phase makes phases idempotent and resumable; Inngest at-least-once retries pick up where it left off | 1+ |
| Stub `step.sleep` for 10m hits Inngest pricing surprise | `step.sleep` doesn't burn compute — orchestrator bookkeeping only. Verified inexpensive in Phase 1 | 1 |
| Claude Agent SDK output drift vs. skill expectations | Pin SDK version in field-agent's package.json; lock to the literal `diligence-report` skill version installed locally; the Phase 2 pre-flight catches issues before Phase 2 starts | 2 |
| Skill expects interactive terminal output | The SDK gives us a programmatic session — should work, but verify via pre-flight before wiring up to Inngest | 2 |
| Laptop sleeps mid-run | Inngest queues events while worker is offline; partial-run state is recoverable via `step.run` boundaries. Worst case: re-run from clean state | 2 |
| Two Inngest apps in one env collide on function id | Function ids are app-scoped, not env-scoped — no collision | 1 |
| Double-trigger from cityhall (agent + user click) | Partial unique index on `diligence_running_job` RCM dedupes at the DB layer | 2 |
| Network failure between cityhall and substation during trigger | The cityhall handler should retry-or-surface; if the RCM is inserted but the trigger fails, we'd have a stuck card. Mitigate by inserting the RCM ONLY after substation returns 201 | 2 |

---

## Operational notes (Phase 1, current state)

- **Laptop = production worker for now.** When your laptop is asleep, events queue in Inngest and process when you come back online. That's fine for Phase 1/2 dev usage; eventually Phase 3 moves the worker to an always-on VM.
- **`SUBSTATION_SERVICE_API_KEY` is a live secret.** It's in substation prod's env. Rotate value in `trigger-diligence.sh` (and tell anyone else with a copy) if you rotate the env var.
- **Stub completions accumulate.** Every successful smoke-test run leaves a `diligence_runs` row in prod with `status='completed'`. Cleanup SQL in `testing-kickoff.md`.
- **Phase 1 stub does not produce artifacts.** The cityhall page's artifacts section will be empty until Phase 2 commit 7 ships.

---

## What's next (when you're ready)

1. **Phase 2 pre-flight** — the 30-line Agent SDK invocation script. Eliminates the biggest unknown before Phase 2 starts.
2. **Workstream P2-A commit 6** — swap the stub for `step.run('invoke-skill', ...)` against the Agent SDK. Don't upload yet.
3. **Workstream P2-A commit 7** — Supabase upload + `diligence_artifacts` rows. From here, the cityhall page starts showing artifact links.
4. **Workstream P2-B in parallel** — design decision on trigger mechanism (agent tool vs button), then RCM schema + renderer + cityhall API handler.
5. **End-to-end smoke test** — same shape as Phase 1 but the run produces real PDFs and the chat shows the running-job RCM.
