# Phase 1 Scaffolding — Smoke Test Kickoff

Drives the entire scaffolding loop end-to-end: cityhall UI subscribes → curl triggers substation → substation publishes Inngest event → field-agent (laptop) consumes → status flips → cityhall UI re-renders.

**This does NOT exercise the diligence-report skill itself** — the field-agent body is still a `step.sleep` stub. That's Phase 2.

---

## TL;DR

Once everything is running and you have the two inputs (project id + feasibility_intake document_version id), the loop is:

```bash
# 1. Trigger
curl -X POST http://localhost:3001/api/projects/<PROJECT_ID>/diligence \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "document_version_id": "<FEASIBILITY_INTAKE_DV_ID>" }'

# Returns: { "id": "dlr_<uuid>", "object": "diligence_run", "status": "queued", ... }
```

```
# 2. Watch the UI (paste the dlr_<uuid> from the response, prefix and all)
http://localhost:5173/project/<PROJECT_ID>/diligence-runs/dlr_<uuid>
```

Expected: status flips `queued → running → completed` within a few seconds of the curl, then again after `STUB_SLEEP_MS` (default 10 min — set to `10000` in field-agent's `.env` for a 10-second loop).

---

## Prereqs

All four processes need to be running locally:

| Service | Command | Port |
|---|---|---|
| Local Supabase | `supabase start` (in substation/) | 54321 (API) / 54323 (Studio) |
| Substation | `pnpm dev` (in substation/) | 3001 |
| field-agent | `pnpm dev` (in field-agent/) | n/a — dials out via Connect |
| Cityhall | `bun run dev` (in cityhall/) | 5173 |

And:

- Substation Supabase has the `20260529180000_diligence_runs.sql` migration applied (`pnpm db:reset` covers it if you haven't already).
- field-agent's `.env` has prod `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` and local `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (the latter two match substation's local stack).
- field-agent's app appears in the [Inngest prod dashboard](https://app.inngest.com/env/production/apps) as `field-agent` with a Connect badge — confirms the worker is online.
- field-agent's `.env` has `STUB_SLEEP_MS=10000` (or shorter) so you're not waiting 10 minutes per iteration.

---

## Step 1 — Get a `feasibility_intake` document_version_id

The seed data (`supabase/seed.sql`) ships 3 empty projects with draft submissions but **no documents**. The trigger route requires a real `feasibility_intake` document_version, so you either need to (a) drive the intake flow to create one, or (b) insert one directly.

### Option A — via the cityhall intake flow

Open cityhall, sign in as `test@noetic.local`, navigate to a project, start an intake conversation, send any message. Once the intake document is created, run the lookup SQL below to find its document_version_id.

### Option B — direct SQL insert

Via Supabase Studio (http://localhost:54323) or psql:

```sql
-- Use one of the seeded projects + its draft submission_version
WITH ctx AS (
  SELECT
    p.id AS project_id,
    sv.id AS sv_id
  FROM project p
  JOIN submission s ON s.project_id = p.id
  JOIN submission_version sv ON sv.submission_id = s.id
  ORDER BY p.created_at
  LIMIT 1
),
new_doc AS (
  INSERT INTO document (project_id, name, kind)
  SELECT project_id, 'Feasibility Intake (test)', 'feasibility_intake' FROM ctx
  RETURNING id, project_id
),
new_dv AS (
  INSERT INTO document_version (
    document_id, submission_version_id, storage_path,
    file_name, file_size, mime_type, processing_state
  )
  SELECT
    new_doc.id, ctx.sv_id, 'inline://feasibility-intake',
    'intake-notes', 0, 'text/plain', 'processed'
  FROM new_doc, ctx
  RETURNING id, document_id
)
SELECT
  new_dv.id            AS document_version_id,
  new_doc.project_id   AS project_id
FROM new_dv
JOIN new_doc ON new_doc.id = new_dv.document_id;
```

Save the returned `document_version_id` and `project_id`.

### Lookup an existing one

If you already have a `feasibility_intake` document_version in the local DB:

```sql
SELECT
  dv.id AS document_version_id,
  d.project_id
FROM document_version dv
JOIN document d ON d.id = dv.document_id
WHERE d.kind = 'feasibility_intake'
ORDER BY dv.created_at DESC
LIMIT 1;
```

---

## Step 2 — Get a bearer token

Two paths. Pick whichever's faster for you.

### Option A — service-role key (fastest for curl)

Use the local Supabase **service_role** JWT as the bearer. Substation's `getAuth(c)` recognises service-role keys and skips the per-user project-access check. Find the key in:

```bash
# From substation/ — the local service role JWT is printed by supabase start
supabase status
# Look for "service_role key:" — that's the value
```

This bypasses RLS — fine for local smoke testing, **never use in prod**.

### Option B — sign-in JWT (matches real auth path)

1. Open cityhall (http://localhost:5173) and sign in as `test@noetic.local` (password is in `substation/supabase/seed-auth.ts`).
2. DevTools → Application → Cookies → find the cookie whose value is `{ "access_token": "...", ... }`. The `access_token` is your bearer.

Option A is fine for Phase 1 — we're not exercising auth here, we're exercising the pipeline.

---

## Step 3 — Trigger the diligence run

Substitute the values from Steps 1 and 2:

```bash
PROJECT_ID="<from-step-1>"
DV_ID="<from-step-1>"
TOKEN="<from-step-2>"

curl -X POST "http://localhost:3001/api/projects/${PROJECT_ID}/diligence" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{ \"document_version_id\": \"${DV_ID}\" }"
```

Expected response (HTTP 201):

```json
{
  "id": "dlr_a1b2c3d4-...",
  "object": "diligence_run",
  "status": "queued",
  "document_version_id": "...",
  "conversation_id": null,
  "project_id": "...",
  "triggered_by_user_id": null,
  "error": null,
  "created_at": "...",
  "updated_at": "...",
  "started_at": null,
  "completed_at": null,
  "inngest_event_id": "..."
}
```

Copy the `id` value (the `dlr_<uuid>` form).

---

## Step 4 — Watch the UI

```
http://localhost:5173/project/<PROJECT_ID>/diligence-runs/<dlr_id>
```

Both the prefixed (`dlr_<uuid>`) and raw (`<uuid>`) forms are accepted in the URL.

**Expected timeline:**

| t | Status | What's happening |
|---|---|---|
| 0s | `queued` | Substation INSERTed the row; event fired |
| ~1–3s | `running` | field-agent received the event, ran `step.run('mark-running')` |
| +STUB_SLEEP_MS | `completed` | field-agent slept, then ran `step.run('mark-completed')` |

The UI updates without any refresh — `subscribeToRows` debounces realtime events and triggers an SSR re-fetch. The elapsed timer should be ticking while status is `running`.

---

## Step 5 — Verify via DB (optional)

In Supabase Studio or psql:

```sql
SELECT id, status, created_at, started_at, completed_at, updated_at
FROM diligence_runs
ORDER BY created_at DESC
LIMIT 5;
```

The lifecycle columns should reflect each transition. `updated_at` advances on every flip (auto-bump trigger).

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401 unauthorized` from substation | Bearer token missing or wrong env (e.g. prod token against local substation) |
| `400 document_version_wrong_kind` | The document_version isn't `kind='feasibility_intake'` — re-run Step 1 |
| `404 document_version_not_found` | document_version_id doesn't exist in this Supabase — re-run Step 1 |
| Row stuck at `queued` forever | field-agent isn't running OR isn't pointed at the same Supabase OR isn't connected to Inngest. Check the Inngest dashboard for the `field-agent` app and the `diligence/requested` event |
| UI shows `404` | Wrong project_id in the URL or the run actually belongs to a different project |
| UI never updates after curl | Cityhall isn't subscribed to realtime — open the browser console and look for Supabase realtime errors; also confirm both tables are in `supabase_realtime` (the migration sets this up) |
| field-agent log shows "invalid event payload" | The `diligence/requested` event arrived without `diligence_run_id` in `event.data` — sanity-check substation's send |

---

## What "works" looks like

A successful full loop produces:

- One `diligence_runs` row, lifecycle `queued → running → completed` within ~10–15 seconds (with `STUB_SLEEP_MS=10000`).
- Zero `diligence_artifacts` rows (Phase 1 stub doesn't generate any).
- One Inngest function run visible in the dashboard with three steps: `mark-running` → `stub-work` (sleep) → `mark-completed`, all green.
- One cityhall page that smoothly walked through the three states without a manual refresh.

If all four are true, Phase 1 scaffolding is end-to-end validated and we're cleared to swap field-agent's stub body for the real Claude Agent SDK invocation in Phase 2.
