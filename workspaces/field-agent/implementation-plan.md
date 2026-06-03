# Field Agent — Implementation Plan

> **Last verified:** 2026-06-03.
> **Status:** Phase 1 ✅ · Phase 2-B ✅ · **Phase 2-A.1 ✅** (dummy-renderer artifact pipeline) · **Phase 2-A.2 🟡 built + in validation** — real `claude-agent-sdk` skill invocation (`src/skill/`), observability, and attachment download all merged; the **minimal-kickoff fan-out fix (#10) is under test** against a real run · Phase 3 deferred.

A long-running API surface for the `noetic-tools:diligence-report` skill: a cloud-deployed trigger publishes an Inngest event, a laptop-side worker (field-agent) consumes via Inngest Connect, runs the work, and writes status + deliverables back through Supabase.

The plan is **scaffolding-first**: Phase 1 shipped the entire pipeline with a stub worker. Phase 2-A then split into two: **2-A.1** swapped the stub for the real artifact *plumbing* (render PDFs with `noetic-pdf` → upload → insert rows → signed URLs → UI links) using a **dummy renderer**, and **2-A.2** will swap that dummy renderer for the real `claude-agent-sdk` skill invocation. Validating every pipe — render, store, sign, display, and that intake data flows through — with a fast/free dummy before depending on the slow, expensive skill is the whole point of the split.

---

## What shipped

### Phase 1 — scaffolding pipeline

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

### Phase 2-B — chat trigger + `full_run` flag plumbing

`requestDiligenceRun` agent tool in the cityhall intake chat fires runs end-to-end; a `diligence_running_job` RCM card surfaces the run with live status (via its own narrow realtime subscription). `full_run` flag flows cityhall → substation → field-agent. At the time of 2-B it gated stub-vs-real; field-agent observed + logged it but didn't act on it (real path deferred to 2-A.2, still pending).

| Layer | What | PR |
|---|---|---|
| substation | `full_run` field on POST body + Inngest event payload + integration tests | [noetic-inc/substation#100](https://github.com/noetic-inc/substation/pull/100) |
| cityhall | `requestDiligenceRun` agent tool, `diligence_running_job` RCM (schema + renderer with realtime sub), `fullFeasibilityRunEnabled` Vercel flag, system-prompt update | [noetic-inc/cityhall#484](https://github.com/noetic-inc/cityhall/pull/484) |
| field-agent | `DiligenceRequestSchema` picks up `full_run`; path + completion logging; soft guardrail (warn on `full_run=true` while P2-A pending) | [noetic-inc/field-agent#5](https://github.com/noetic-inc/field-agent/pull/5) |
| winston | Plan: Phase 1 done + Phase 2 scope incl. RCM; trigger + idempotency locked; full-run feature flag captured | wnavey/winston PRs #93, #94 |

What this means concretely: from cityhall's intake chat, the user can now tell the agent "go run the research," the agent calls the tool, a status card appears in the chat (with live updates), and the run flows through the existing pipeline.

### Phase 2-A.1 — artifact pipeline (dummy render)

field-agent's stub sleep is **replaced** by a real artifact pipeline (`src/artifacts/`): load the feasibility-intake `document_section` rows, render a **Site Intelligence Report from that real intake data** + a placeholder **Research Appendix** via `noetic-pdf`, upload both to `submission-data/diligence/<run-id>/`, and upsert `diligence_artifacts` rows. substation mints 72h signed URLs on the GET; cityhall renders View/Download links. Verified end-to-end against prod on 2026-06-02 (run completes, two artifacts, working links, SIR shows the captured intake).

**Both `full_run` values behave identically** — the dummy pipeline runs regardless. The flag is observed-only and will gate 2-A.2's real skill. The PDF *content* is a placeholder; only 2-A.2 makes it real.

| Layer | What | PR |
|---|---|---|
| claude-plugins | `noetic-pdf` buildable as a dependency (esbuild bundle + `.d.ts`, `dist`-pointed exports, gitignored `dist/`) | [noetic-inc/claude-plugins#8](https://github.com/noetic-inc/claude-plugins/pull/8) |
| field-agent | `src/artifacts/` (load intake → render SIR + appendix → upload → upsert rows); handler rewired (both `full_run` paths); `onFailure` → `failed`; shared supabase client | [noetic-inc/field-agent#7](https://github.com/noetic-inc/field-agent/pull/7) |
| substation | `diligence_artifacts(diligence_run_id, kind)` unique index; 72h signed-URL GET | [noetic-inc/substation#101](https://github.com/noetic-inc/substation/pull/101) |
| cityhall | `signed_url` type + View/Download links on the status widget | [noetic-inc/cityhall#487](https://github.com/noetic-inc/cityhall/pull/487) |
| winston | This plan + canonical spec updated for 2-A.1 | this PR |

#### The big de-risking finding: `noetic-pdf` must be pre-built

A 30-line render spike surfaced that field-agent **cannot** consume `noetic-pdf`'s raw `.tsx` source cross-repo: files under `node_modules` get tsx's *classic* JSX runtime regardless of tsconfig, but the package is authored for the *automatic* runtime → every component throws `React is not defined`. Fix: `noetic-pdf` ships a built `dist/` (esbuild bundle, `react`/`@react-pdf` externalized, + `tsc --emitDeclarationOnly --noCheck` for types), consumed via a **`link:`** dependency (not `file:`, which snapshots a stale copy). `dist/` is gitignored → **`pnpm build` in `noetic-pdf` is a required setup step** after pulling, or `pnpm dev` fails with `ERR_MODULE_NOT_FOUND … dist/index.js`.

#### Handler shape

`mark-running → render-and-upload-artifacts → insert-artifacts → mark-completed`. Render + upload share one `step.run` because rendered `Buffer`s aren't JSON-serializable across Inngest step boundaries; only artifact metadata is passed to the insert step. `onFailure` flips the run to `failed` after retries exhaust.

---

## Phase 2-A.2 — Real diligence runs (built + validating)

> **As-built design + first-run findings:** [`diligence-report-skill-execution.md`](./diligence-report-skill-execution.md) is the authoritative, current doc (the SDK call, the minimal-kickoff / single-threaded finding, the env allowlist, observability, attachments, and the live build-plan checklist). This section is the historical scope/decisions.

2-A.2 swaps the **dummy renderer** (shipped in 2-A.1) for actual `@anthropic-ai/claude-agent-sdk` invocation of the `noetic-tools:diligence-report` skill. Everything around it — trigger, RCM, status, render→upload→insert plumbing, signed URLs, UI links — already exists; 2-A.2 only changes *what produces the PDF buffers*.

**Shipped:** field-agent [#8](https://github.com/noetic-inc/field-agent/pull/8) (`invoke.ts` + in-process runner, fire-and-handoff, behind `if (full_run)`), [#9](https://github.com/noetic-inc/field-agent/pull/9) (observability), [#11](https://github.com/noetic-inc/field-agent/pull/11) (attachment download). **In validation:** [#10](https://github.com/noetic-inc/field-agent/pull/10) (minimal kickoff — the fan-out fix). **The first real run completed but ran single-threaded** (0 `Task` subagents, ~13pp SIR); the diagnostic showed `Task` was available, so the cause was an over-constrained kickoff, fixed in #10 (under test).

**Workstream ordering (history):** P2-B (cityhall trigger + RCM) shipped first, then 2-A.1 (artifact pipeline with a dummy renderer). The `full_run` flag was the safety net — it let us validate the chat-driven trigger and the whole artifact loop without burning Anthropic tokens. 2-A.2 wires the real skill behind that flag, gets validated incrementally, and then we flip the flag's default to `true` once we trust the real path.

### Feature flag: `full-feasibility-run-enabled`

A Vercel flag on cityhall, default **`false`**, gates whether a triggered run invokes the real diligence-report skill or runs the dummy-render artifact pipeline. The flag flows cityhall → substation → field-agent as a request param. **As of 2-A.2 it now branches for real:** `full_run=true` → the real skill (in-process runner); `full_run=false` → the 2-A.1 dummy pipeline. Default stays `false` (no accidental token spend) until the real path is validated, then we flip it.

**Flow:**

1. Cityhall server-side reads the flag at request time (whichever Vercel mechanism — env var, Edge Config, or Vercel Feature Flags — backs the flag). Default `false`.
2. Cityhall passes the boolean in the substation POST body: `{ document_version_id, conversation_id, full_run: <bool> }`. Omitted = treated as `false`.
3. Substation accepts `full_run` as an optional field in the body schema (`z.boolean().default(false)`), forwards it in the Inngest event payload: `data: { diligence_run_id, full_run }`.
4. field-agent's `DiligenceRequestSchema` has `full_run: z.boolean().default(false)`. The handler branches: `full_run === true` → ack + hand off to the in-process runner that invokes the real skill; `false` → the 2-A.1 dummy pipeline (in-Inngest steps).

**Default-safe at every layer:** missing/unset is treated as `false` end-to-end. No accidental real (token-spending) runs without explicit opt-in.

**Not persisted on the row.** The boolean lives in the request → event → handler decision, not on `diligence_runs`. Real runs (2-A.2) will be tens of minutes vs the dummy's few seconds — the duration gap makes it obvious which mode a row was in. Once the flag defaults to `true` permanently, the parameter can be ripped out without a schema change.

---

### Workstream 2-A.2 — field-agent runs the real skill

Swap 2-A.1's **dummy renderer** for the canonical 6-phase pipeline the skill orchestrates internally (jurisdiction check → vision extraction → research → discipline analysis → synthesis → render). The surrounding plumbing — upload, `diligence_artifacts` upsert, signed URLs, UI links — already exists from 2-A.1; the work below is mostly *where the PDF buffers come from*.

**As built** (detail + the live checklist live in the [skill-execution doc](./diligence-report-skill-execution.md)):

1. ✅ **Real skill invocation, flag-gated** (#8). `field-agent/src/skill/` — `runner.ts` (in-process semaphore, concurrency 1) + `invoke.ts` (`runDiligenceSession`). The handler **acks + hands off** (the 30–60 min SDK session does **not** sit in a `step.run`); the runner writes terminal status. `else` keeps the 2-A.1 dummy pipeline. Reuses `load-intake.ts` + `upload.ts`/`insert.ts`. SDK pinned `0.2.74`; `env` is a default-deny allowlist (`buildSessionEnv`), not a `process.env` spread.
2. ✅ **Upload + insert** — unchanged from 2-A.1; the real skill's deliverable PDFs flow through `upload.ts`/`insert.ts`.
3. ✅ **Observability** (#9) — `run-summary.json` (session id, cost, turns, tool histogram, notes).
4. ✅ **Attachment download for Phase 1/§9** (#11) — vision-gated; `source-pdfs/`.
5. 🟡 **Minimal kickoff (fan-out fix)** (#10) — **in validation** against a real run. The first run single-threaded; this strips the suppressive framing so the skill self-orchestrates its Phase 2/3 fan-out.
6. ⬜ **Remaining / fast-follow:** stuck-run reconciler, tool allowlist, per-subagent observability, supporting-doc artifacts (`(run_id, storage_path)` index), `diligence/completed` emission (no consumer yet), full-fidelity Tier-2 smoke → flip the flag default.

### Workstream P2-B — cityhall: trigger + `diligence_running_job` RCM ✅

**Shipped.** From the cityhall intake chat, the user signals readiness ("go run the research"), the agent calls `requestDiligenceRun`, a `diligence_running_job` RCM card appears in the conversation with live status updates, and the run flows through the pipeline (which now produces dummy artifacts via 2-A.1; the real skill arrives in 2-A.2).

**Trigger mechanism — locked: intake chat agent tool.** `requestDiligenceRun` registered alongside `updateIntakeNotes` and `askClarifyingQuestion` in `cityhall/src/routes/api/chat/intake/+server.ts`. Input is `z.object({})` — the trigger is fully contextual (conversation + intake doc are known from the request context, not from the model). Right-panel manual-override button stays deferred to Phase 3.

**Server-side flow:**

1. Cityhall reads `fullFeasibilityRunEnabled` (Vercel flag via the `defineFlag` helper, default `false`).
2. Calls `POST /api/projects/:projectId/diligence` on substation with `{ document_version_id, conversation_id, full_run }` and the user's Supabase JWT (so `triggered_by_user_id` is populated on the row).
3. Substation INSERTs the `diligence_runs` row, fires `diligence/requested` with `{ diligence_run_id, full_run }`, returns the row to cityhall.
4. Cityhall INSERTs a `chat_message` with `rcm_payload: { rcm_type: 'diligence_running_job', data: { diligence_run_id, project_id, status: 'queued' } }`.
5. Cityhall's chat realtime subscription picks up the new row → card renders.
6. The RCM renderer (`DiligenceRunningJob.svelte`) opens its OWN narrow Supabase realtime subscription on `diligence_runs` filtered by id, plus an initial SELECT to catch up if status already changed since insert. Card updates in place as status flips. (`rcm_payload.data.status` itself stays at the insert-time snapshot; the live status lives in component state only — small, well-bounded display concern.)

**Idempotency — once per conversation:** application-layer guard inside `request-diligence-run.ts` queries for an existing `diligence_running_job` RCM in this conversation before triggering; if found, returns `{ already_running: true, diligence_run_id }` so the model can tell the user instead of double-firing. The DB-level partial unique index (belt-and-suspenders) is not yet in place — listed under cleanup/tech-debt; the app-layer check has carried us this far.

**Files shipped (cityhall #484):**
- `cityhall/src/lib/flags.ts` — new `fullFeasibilityRunEnabled` flag definition mirroring `feasibilityIntakeEnabled` / `intakeChatUseSonnet`
- `cityhall/src/lib/rcm/schemas.ts` — `DiligenceRunningJobPayloadSchema` in the discriminated union
- `cityhall/src/lib/rcm/DiligenceRunningJob.svelte` *(new)* — renderer with `$effect`-driven realtime subscription
- `cityhall/src/lib/rcm/components.ts` — registers the renderer
- `cityhall/src/lib/intake/request-diligence-run.ts` *(new)* — tool's execute body
- `cityhall/src/routes/api/chat/intake/+server.ts` — tool registration + system-prompt update for when to call the tool

**Files shipped (substation #100):**
- `substation/src/routes/diligence.ts` — `full_run: z.boolean().default(false)` on body schema; forwarded to event payload
- `substation/src/routes/diligence.integration.test.ts` — coverage for `full_run` true/false/omitted/non-boolean paths

**Files shipped (field-agent #5):**
- `field-agent/src/inngest/events.ts` — `DiligenceRequestSchema` accepts `full_run`
- `field-agent/src/inngest/functions/diligence-run.ts` — path logging + completion logging + soft guardrail (warn on `full_run=true` while P2-A pending)

**Still to do for full P2-B closure:**
- Substation migration: partial unique index `chat_message_rcm_diligence_running_job_once_per_conv` on `chat_message` to DB-enforce the once-per-conversation rule. Cityhall already handles `23505` via its app-layer check; this is defensive.

### 2-A.2 pre-flight check (do first)

**Confirm `@anthropic-ai/claude-agent-sdk` can invoke a `noetic-tools` skill programmatically.** (The analogue of the `noetic-pdf` render spike that de-risked 2-A.1.)

30-line throwaway script outside field-agent that imports the SDK, creates a session with the `noetic-tools` plugin loaded, invokes a tiny existing skill (e.g. `noetic-tools:smoke-test`), captures the final agent message, and exits. Verifies:

- SDK + plugin discovery work without a TTY
- The agent's terminal message is parseable from our process
- Stdout/stderr streams behave (no zombie processes, clean shutdown)

If it works, the rest of 2-A.2 is mechanical wiring (the render → upload → insert → sign → display loop already exists from 2-A.1). If it doesn't, we diagnose the SDK before committing to changes inside field-agent.

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
        │                          │   Today (2-A.1, ✅ shipped):  │
        │                          │     - status=running         │
        │                          │     - render SIR+appendix    │
        │                          │       (noetic-pdf, dummy)    │
        │                          │     - upload + upsert rows   │
        │                          │     - status=completed       │
        │                          │   2-A.2 adds:                │
        │                          │     - Claude Agent SDK        │
        │                          │     - real skill invocation  │
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
| Artifact rendering (2-A.1) | `noetic-pdf` in-process via `renderToBuffer` | Built `dist/` consumed via `link:`; raw TSX can't be transpiled cross-repo (see 2-A.1 finding) |
| Skill invocation (2-A.2) | `@anthropic-ai/claude-agent-sdk@0.2.74` in-process | Not subprocess; programmatic session with `noetic-tools` plugin loaded. **Not built yet.** |
| Long skill session vs. Inngest (2-A.2) | **Ack-and-handoff** — Inngest fn acks + marks running, in-process runner runs the session, status tracked via `diligence_runs` + realtime | Skill is one opaque 30–60 min session — can't be wrapped per-phase in `step.run`. Concurrency moves in-process; recovery via stuck-run reconciler (fast-follow). See [ADR](./diligence-report-long-step-adr.md). |
| Trigger surface | Hono route in Substation | `POST /api/projects/:projectId/diligence`; auth via `SUBSTATION_SERVICE_API_KEY` (route-restricted) OR user JWT |
| Deliverable handoff | **Supabase upload only** + 72h signed URLs (minted at GET) | No local laptop copy for the dummy; revisit a local cache if the real skill's outputs are worth keeping on disk |
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

**2-A.1 populates `diligence_artifacts`** — one `site_intelligence_report` row + one `research_appendix` row per completed run, upserted on `(diligence_run_id, kind)` (migration `20260602120000`).

---

## HTTP contract

Shipped in [substation#98](https://github.com/noetic-inc/substation/pull/98). Both endpoints mounted under `/api/projects/:projectId/` to match existing project-scoped conventions.

### `POST /api/projects/:projectId/diligence`

```
body:    {
           document_version_id: uuid,
           conversation_id?: uuid,
           full_run?: boolean,   // defaults to false; gates real-skill invocation in field-agent
         }
returns: { id: 'dlr_<uuid>', object: 'diligence_run', status: 'queued', ... }
auth:    SUBSTATION_SERVICE_API_KEY (route-restricted, recommended for scripts)
         OR a Supabase user JWT (populates triggered_by_user_id)
status:  201 Created on success
```

Defense in depth: route confirms (a) the document_version belongs to `projectId`, (b) `document.kind = 'feasibility_intake'`. Bad inputs → `400`/`403`/`404` per kind of mismatch.

Generates `diligence_run_id` client-side (`crypto.randomUUID()`), fires the Inngest event with the id in the payload, INSERTs both ids together. No two-phase write.

### `GET /api/projects/:projectId/diligence/:diligenceRunId`

Returns the row + joined `diligence_artifacts`, each with a `signed_url` (72h, minted at read time; null if signing fails). Shipped in 2-A.1 (substation #101).

---

## Inngest event contract

```
event: diligence/requested
data:  {
         diligence_run_id: "<uuid>",   // raw uuid, NOT dlr_ prefixed
         full_run: boolean,            // forwarded from substation POST body (default false)
       }
```

Worker looks up the row by id and pulls everything else (intake doc, project, attachments) via DB joins. Minimal by design — address, intended use, supporting docs don't travel through the event. `full_run` rides in event.data so the worker can branch without an extra DB read.

`diligence/completed` is **reserved for 2-A.2**. Not emitted today; no consumer.

---

## Cleanup items / tech debt

Don't block Phase 2; mention if you want me to chip these between rounds.

1. **Regenerate substation DB types.** Once Docker + local Supabase are running, `pnpm gen-types` in substation pulls `diligence_runs` / `diligence_artifacts` into the typed client. Then the `getDiligenceClient()` helper in `substation/src/routes/diligence.ts` (and its mirror in the integration test) can go away.
2. **Promote `ZodError → 400` to `handleError`.** The per-route `safeParse` pattern I added in `routes/diligence.ts` to fix CI's 500s is local; centralizing the conversion would benefit every Substation route without per-route boilerplate. Separate small PR.
3. **Hardening for the API key middleware.** The integration tests I added cover the happy path + 403/401 cases, but a stress test (wrong path + wrong method permutations) wouldn't hurt.
4. **Cleanup SQL for test runs.** `testing-kickoff.md` includes a delete-all-completed snippet; could be a small script in this dir for convenience.
5. **`STUB_SLEEP_MS` removed.** The stub sleep is gone (2-A.1 replaced it with the artifact pipeline); the env var no longer exists in the worker.
6. **Substation partial unique index on `diligence_running_job` RCM** — DB-enforced once-per-conversation; redundant with the cityhall app-layer check but useful belt-and-suspenders. Tiny migration.
7. **`updateRunStatus` terminal-state guard** — add an `.eq('status', …)` filter so a late `mark-completed` can't overwrite `failed`. Low-probability under `concurrency: 1`; substation reviewer flagged it as non-blocking. Fold into 2-A.2 as the failure surface grows.
8. **`noetic-pdf` build step.** `dist/` is gitignored and consumed via `link:`, so `pnpm build` in `noetic-pdf` is a required setup step. Consider a field-agent `predev` hook or, for Phase 3, publishing `noetic-pdf` to a registry.

---

## Risks and mitigations

| Risk | Mitigation | Phase |
|---|---|---|
| Inngest Connect websocket drops mid-run (dummy/stub path) | The short steps (`mark-running` → render → insert → `mark-completed`) are idempotent; Inngest at-least-once retries pick up where they left off | 1 / 2-A.1 |
| Worker crash mid-run (real skill, 2-A.2) | The skill session is **not** step-durable (one opaque SDK session, ack-and-handoff — see [ADR](./diligence-report-long-step-adr.md)). Once acked, Inngest won't retry. Recovery = in-process try/catch → `failed`, plus a stuck-run reconciler (startup reconcile + age sweeper). Fast-follow. | 2-A.2 |
| `noetic-pdf` raw TSX can't be consumed cross-repo (classic vs automatic JSX in node_modules) | Resolved in 2-A.1: ship a built `dist/` (esbuild bundle + `.d.ts`), consume via `link:`. Required setup step: `pnpm build` in `noetic-pdf` | 2-A.1 |
| Claude Agent SDK output drift vs. skill expectations | Pin SDK version in field-agent's package.json; lock to the literal `diligence-report` skill version installed locally; the 2-A.2 pre-flight catches issues before wiring | 2-A.2 |
| Skill expects interactive terminal output | The SDK gives us a programmatic session — should work, but verify via pre-flight before wiring up to Inngest | 2-A.2 |
| Laptop sleeps mid-run | Inngest queues *new* events while the worker is offline. An **in-flight** real run (2-A.2) is lost (the session dies with the process) and is recovered by the stuck-run reconciler → re-trigger. Worst case: re-run from clean state | 2-A.2 |
| Two Inngest apps in one env collide on function id | Function ids are app-scoped, not env-scoped — no collision | 1 |
| Double-trigger from cityhall (agent + user click) | Partial unique index on `diligence_running_job` RCM dedupes at the DB layer | 2 |
| Network failure between cityhall and substation during trigger | The cityhall handler should retry-or-surface; if the RCM is inserted but the trigger fails, we'd have a stuck card. Mitigate by inserting the RCM ONLY after substation returns 201 | 2 |

---

## Operational notes (current state)

- **Laptop = production worker for now.** When your laptop is asleep, events queue in Inngest and process when you come back online. That's fine for current dev usage; Phase 3 moves the worker to an always-on VM.
- **`SUBSTATION_SERVICE_API_KEY` is a live secret.** It's in substation prod's env. Rotate value in `trigger-diligence.sh` (and tell anyone else with a copy) if you rotate the env var.
- **`fullFeasibilityRunEnabled` Vercel flag.** Default `false`. Today flipping it has **no behavioural effect** — both values run the dummy artifact pipeline. It becomes the master switch for the real skill once 2-A.2 lands.
- **`noetic-pdf` must be built.** `dist/` is gitignored; after pulling claude-plugins run `pnpm build` (or `npm run build`) in `noetic-pdf` or `pnpm dev` fails with `ERR_MODULE_NOT_FOUND … dist/index.js`.
- **Runs produce real artifacts now (dummy content).** Every chat-driven run leaves a `diligence_runs` row + 2 `diligence_artifacts` rows + 2 PDFs in `submission-data/diligence/<run-id>/`, and shows View/Download links. The SIR renders the real captured intake; the appendix is a placeholder. Cleanup SQL in `testing-kickoff.md` (also clear the storage objects).
- **RCM card updates live in chat.** The renderer subscribes to `diligence_runs` realtime updates filtered by id (with an initial SELECT to catch up on mount). Status flips visible without leaving the chat.

---

## What's next (when you're ready)

P2-B and 2-A.1 are shipped and verified e2e against prod. **2-A.2 (real skill) is what's left.** The feature flag is the safety net — observed-only today, gates the real skill once it lands.

1. **2-A.2 pre-flight** — 30-line standalone script that imports `@anthropic-ai/claude-agent-sdk`, invokes a known-good `noetic-tools` skill (`smoke-test` is the cheapest), captures the terminal message, exits clean. Eliminates the biggest unknown before we touch field-agent's handler. (Mirrors the `noetic-pdf` render spike that de-risked 2-A.1.)

2. **2-A.2 — flag-gated real skill invocation.** Add `src/skill/invoke.ts`; branch the render step on `event.data.full_run` (`true` → real skill, `false` → 2-A.1 dummy). The upload/insert/sign/UI loop already exists — just feed it the skill's real PDF buffers. Test by flipping the flag for one test conversation.

3. **2-A.2 — supporting-doc download path + `supporting_document_copy` kind.** For runs with attachments. Revisit the `(diligence_run_id, kind)` unique index here (move to `(diligence_run_id, storage_path)`).

4. **2-A.2 — emit `diligence/completed`.** No consumer yet; sets up the future.

5. **E2E smoke test with `full_run=true`** producing *real* PDFs; then flip the flag default to `true` in Vercel once trusted.

### Lower-priority cleanup (not blocking 2-A.2)

- `updateRunStatus` terminal-state guard (see Cleanup items #7).
- Field-agent `predev` hook to auto-build `noetic-pdf` (see Cleanup items #8).
- Substation migration: partial unique index `chat_message_rcm_diligence_running_job_once_per_conv` to DB-enforce once-per-conversation. Cityhall's app-layer check is carrying this for now.
- Other items in the "Cleanup items / tech debt" section.
