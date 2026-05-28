# Diligence Runner — Implementation Plan

A long-running API surface for the `noetic-tools:diligence-report` skill: cloud-deployed trigger publishes an Inngest event, a laptop-side worker consumes via Inngest Connect, runs the skill via the Claude Agent SDK, and returns deliverables.

---

## Goal

Trigger a Site Intelligence Report (SIR) run from a public HTTP endpoint and receive the resulting PDFs (SIR + Research Appendix) back as signed URLs, with progress observable along the way. Compute stays on Winston's laptop where the diligence skill, its plugins, and the durable `~/noetic/bureau/jurisdictions/<slug>/feasibility-guides/` directory already live.

## Phase 1 scope

- Single endpoint trigger from Substation
- One concurrent run at a time (the skill is heavy enough this is fine)
- Address-only and address-plus-concept-plan paths both work
- Deliverables land on the laptop **and** in Supabase storage with 72h signed URLs
- Progress observable in Inngest dashboard via `step.run` boundaries

## Phase 2 (out of scope here, but architecture preserves the option)

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
│   - upload PDFs to         │         └───────────┬────────────┘
│     submission-data bucket │                     │
│   - inngest.send()         │                     │ Connect
│   - return runId           │                     │ (outbound ws)
└────────────────────────────┘                     ▼
        ▲                          ┌──────────────────────────────┐
        │ GET /diligence/:runId    │ diligence-worker (laptop)    │
        │ (poll status)            │  Node 22.4+ standalone proc  │
        │                          │   - Inngest Connect client   │
        │ ◀──── status ────────────│   - @anthropic-ai/           │
        │                          │     claude-agent-sdk         │
        └──────────────────────────│   - invokes diligence skill  │
                                   │     in-process               │
                                   │   - writes ~/noetic/         │
                                   │     diligence/<slug>/        │
                                   │   - uploads PDFs to Supabase │
                                   │   - emits                    │
                                   │     diligence/completed      │
                                   └──────────────────────────────┘
```

### Decisions locked in

| Decision | Choice | Notes |
|---|---|---|
| Worker location | Standalone laptop process | Not a Vercel Sandbox; not part of Substation |
| Inngest transport | Connect (outbound websocket) | TS SDK v4 (GA), Connect feature in public beta — fine for our use case |
| Inngest app structure | **Two apps in one environment** | Substation is app A (existing, `serve()`). diligence-worker is app B (new, Connect). Events route by name across the env |
| Skill invocation | `@anthropic-ai/claude-agent-sdk` in-process | Not subprocess; programmatic session with `noetic-tools` plugin loaded |
| Trigger surface | New Hono route in Substation | `POST /diligence/trigger`; reuses Substation auth + `submission-data` bucket |
| Deliverable handoff | **Both** — local copy + Supabase upload + 72h signed URLs | Local is source of truth; signed URLs for remote callers |
| Status reporting | Inngest dashboard + status endpoint | `GET /diligence/:runId` reads the Inngest function run state |

### Open / TBD items

- **Auth on `/diligence/trigger`.** Reuse whatever Substation uses for other org-scoped routes; confirm during implementation. Worth checking before merging the trigger PR.
- **Signed-URL bucket choice.** Default to `submission-data` (already configured, service-role uploads work). If we want diligence outputs in their own bucket for lifecycle policies, add a `diligence-deliverables` bucket — small change, but a decision to make.
- **Concept plan PDF size cap.** The trigger route should reject uploads above some threshold (suggest 100MB) before paying for storage + the worker download.
- **What happens if Inngest Connect websocket drops mid-run.** Tolerable because phases are durable via `step.run`; document the retry semantics so we know what re-runs look like.

---

## Workstreams

Four streams. Stream 1 can start independently; Streams 2 + 3 in parallel after Stream 1 has a minimal worker boot; Stream 4 ties them together for the smoke test.

### Stream 1 — `diligence-worker` repo (the bulk of the work)

**Location:** New repo at `/Users/winston/workspace/diligence-worker/` (top-level workspace project).

**Layout:**

```
diligence-worker/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── src/
│   ├── index.ts                 # entrypoint: starts Inngest Connect worker
│   ├── inngest/
│   │   ├── client.ts            # new Inngest({ id: 'diligence-worker' })
│   │   └── functions/
│   │       └── diligence-run.ts # the function — event diligence/requested
│   ├── skill/
│   │   ├── invoke.ts            # Claude Agent SDK wrapper around diligence-report
│   │   └── progress.ts          # parse SDK events into Inngest step boundaries
│   ├── storage/
│   │   └── upload-deliverables.ts # Supabase service-role client, upload + sign
│   └── lib/
│       ├── property-slug.ts     # canonical slug from address
│       └── env.ts               # typed env loader
└── scripts/
    └── dev.ts                   # convenience runner
```

**Dependencies:**
- `inngest@^3.34.1` (Connect support)
- `@anthropic-ai/claude-agent-sdk` (latest)
- `@supabase/supabase-js`
- `zod` (event payload validation)
- TypeScript, tsx for dev

**Runtime requirements:** Node 22.4+ (native WebSocket).

**Function shape — `diligence-run.ts`:**

```ts
export const diligenceRun = inngest.createFunction(
  { id: 'diligence-run', concurrency: 1 },
  { event: 'diligence/requested' },
  async ({ event, step }) => {
    const { propertySlug, address, intendedUse, supportingDocs } =
      DiligenceRequestSchema.parse(event.data);

    // Phase 0: download supporting PDFs from Supabase to a local working dir
    const workingDir = await step.run('prepare-working-dir', async () => {
      return downloadSupportingDocs(propertySlug, supportingDocs);
    });

    // Phase 1-5: invoke the skill via Agent SDK
    // Note: the skill itself orchestrates its internal phases.
    // We expose the SDK event stream as one big step.run for now;
    // can subdivide later if Inngest dashboard granularity matters.
    const deliverable = await step.run('run-diligence-skill', async () => {
      return invokeDiligenceSkill({ address, intendedUse, workingDir });
    });

    // Phase 6: upload to Supabase + sign
    const signedUrls = await step.run('upload-and-sign', async () => {
      return uploadDeliverables(propertySlug, deliverable);
    });

    // Emit completion event for any downstream listeners
    await step.sendEvent('emit-completion', {
      name: 'diligence/completed',
      data: { propertySlug, runId: event.id, signedUrls, localPath: deliverable.localDir },
    });

    return { propertySlug, signedUrls, localPath: deliverable.localDir };
  },
);
```

**Skill invocation (`skill/invoke.ts`):**

Programmatic Claude Code session using the Agent SDK. Load the `noetic-tools` plugin (so `/diligence-report` is available), seed the conversation with the structured inputs, let the skill run to completion. Capture stdout/stderr to a per-run log file in the working dir for debugging. Wait for the agent's terminal message before returning.

The skill writes deliverables to `~/noetic/diligence/<property-slug>/sir/deliverable/`. The invoke function returns paths to the two PDFs and the supporting-documents dir from there.

**Storage upload (`storage/upload-deliverables.ts`):**

Service-role Supabase client. Upload `site-intelligence-report.pdf` and `research-appendix.pdf` to `submission-data/diligence/<property-slug>/<run-id>/`. Generate 72h signed URLs. Return `{ sir: url, appendix: url }`.

**Env vars (`.env.example`):**

```
INNGEST_APP_ID=diligence-worker
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
NOETIC_DILIGENCE_ROOT=/Users/winston/noetic/diligence
```

**Run locally:**

```bash
cd /Users/winston/workspace/diligence-worker
pnpm install
pnpm dev   # tsx watch src/index.ts — opens Connect websocket
```

### Stream 2 — Substation trigger route

**Files to touch:**

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
  returns: { runId: string, propertySlug: string }

GET /diligence/:runId
  returns: { status: 'queued' | 'running' | 'completed' | 'failed',
             signedUrls?: { sir: string, appendix: string },
             error?: string }
```

**Trigger handler logic:**

1. Validate inputs with zod
2. Generate `propertySlug` from address (deterministic; same function as worker uses)
3. If `concept_plan.storage_path` provided, verify file exists in bucket
4. `inngest.send({ name: 'diligence/requested', data: { propertySlug, address, intendedUse, supportingDocs } })` — capture returned event id as `runId`
5. Return `{ runId, propertySlug }`

**Status handler:** Use Inngest's REST API to fetch run state by event id. (If that's painful, fall back to writing run state into a Supabase table from the worker; defer this decision until we feel the polling pain.)

**Auth:** Whatever pattern `submissions.ts` uses — copy it. Worth a 15-min look during implementation.

### Stream 3 — Inngest environment setup

This is configuration, not code, but it has dependencies.

1. **Create a new Inngest app** in the Inngest dashboard for `diligence-worker`. Same environment as Substation.
2. **Generate event key + signing key** for the new app. These go into the worker's `.env`.
3. **Confirm event-name routing.** In Inngest, events are routed by name across all apps in an environment. Substation can publish `diligence/requested` from its existing app; the new worker app subscribes. No additional wiring needed.
4. **Verify Substation's existing event key** is sufficient to publish the new event name (it should be — event keys are environment-scoped, not event-scoped).

### Stream 4 — End-to-end smoke test

After Streams 1–3 are minimally functional:

1. Worker running locally (`pnpm dev` in `diligence-worker`).
2. Substation running locally (`pnpm dev` in `substation`).
3. From a third terminal:

```bash
curl -X POST http://localhost:3001/diligence/trigger \
  -H 'Content-Type: application/json' \
  -d '{
    "address": "1700 S Lamar Blvd, Austin, TX",
    "intended_use": "for-sale townhomes, ~40 units"
  }'
```

4. Poll `GET /diligence/:runId` until status is `completed`.
5. Verify:
   - `~/noetic/diligence/1700-s-lamar-blvd/sir/deliverable/` exists with both PDFs
   - Signed URLs in the response download the same PDFs
   - Inngest dashboard shows a clean run with each `step.run` visible

If this passes, Phase 1 is done.

---

## Sequencing and smallest viable first commit

**First commit (Stream 1, minimal):** A `diligence-worker` repo that boots, connects to Inngest via Connect, registers a no-op function for `diligence/requested` that just logs the event and returns. No skill invocation yet. No storage. The goal of this commit is to prove the Connect websocket works end-to-end with a test event fired manually from the Inngest CLI.

**Second commit:** Wire up the Claude Agent SDK invocation with hard-coded test inputs. Confirm the skill runs to completion against a known address. Skip storage upload — just log the local paths.

**Third commit:** Add Supabase upload + signed URL generation. Worker now produces remotely accessible artifacts.

**Fourth commit (Stream 2):** Substation trigger route. From here, the only thing left is wiring the status endpoint.

**Fifth commit (Stream 2):** Status endpoint + smoke test.

Each commit is independently shippable and verifiable. No big-bang merges.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Inngest Connect websocket drops mid-run | `step.run` per phase makes phases idempotent and resumable; Inngest at-least-once retries pick up where it left off. Diligence runs are slow enough that this matters; budget time to actually test a drop. |
| Claude Agent SDK output drift vs. skill expectations | Pin SDK version; test against the literal `diligence-report` skill version that's installed locally (`claude-plugins/plugins/noetic-tools`). |
| Skill expects interactive terminal output | The SDK gives us a programmatic session — should work, but verify by running the skill via SDK against a tiny test case before wiring up to Inngest. **Do this before committing to Stream 1.** |
| Laptop sleeps mid-run | Inngest queues events while worker is offline; partial-run state is recoverable via the `step.run` boundaries. Worst case: re-run from a clean state. |
| Concept-plan PDF too large for upload | Cap upload size at the trigger route; reject early with a clear error. |
| Two Inngest apps in one env collide on function id | Function ids are app-scoped, not env-scoped — no collision. Verified per Inngest docs. |

---

## Phase 2 notes (for future reference)

- **Public IP via worker on a VM:** Move the `diligence-worker` process to a Fly machine or Hetzner box. Same code, just runs there. Connect still dials out, so no inbound port forwarding needed. The skill's filesystem assumptions (`~/noetic/`) move with the user that owns the box — provision once.
- **Multi-tenancy:** Add an `org_id` to the event payload and namespace deliverables in storage by org. The skill's working dir already namespaces by property slug, so multi-tenant local storage is fine.
- **Webhook callbacks:** Subscribe to `diligence/completed` in the trigger app and POST to a caller-supplied webhook URL on completion. Trivial add once we have a real caller asking for it.

---

## Pre-flight check before writing any code

Two things to verify before Stream 1 starts:

1. **Claude Agent SDK can invoke a skill programmatically.** Write a 30-line script that uses the SDK to invoke any small `noetic-tools` skill (e.g. `smoke-test`) and confirm it runs to completion and we can capture the result. This validates the skill-invocation pathway before we wire it to Inngest.

2. **Inngest Connect happy path.** Fork the smallest Inngest Connect example from the docs, point it at a fresh app in our environment, fire a test event from the dashboard, confirm the worker receives and acks it. Done in under an hour; eliminates the biggest unknown.

If both check out, the rest of the plan is mechanical.
