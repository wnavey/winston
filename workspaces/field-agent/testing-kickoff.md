# Phase 1 Scaffolding — Prod Smoke Test Kickoff

Drives the full prod loop end-to-end: prod cityhall subscribes → curl triggers prod substation → substation publishes Inngest event → field-agent (laptop) consumes → status flips in prod Supabase → prod cityhall UI re-renders.

**This does NOT exercise the diligence-report skill itself** — the field-agent body is still a `step.sleep` stub. That's Phase 2.

**Topology:** field-agent is the only thing running locally. Substation and cityhall are the deployed Vercel instances. All three services use the same prod Supabase + prod Inngest env.

> **You are touching prod data.** Every diligence_run row this creates is visible to anyone with prod project access. The bearer token grants real user privileges. Treat both accordingly.

---

## TL;DR

Once the one-time setup below is in place:

```bash
# 1. Trigger
TOKEN="eyJ..."  # from a signed-in prod cityhall tab (see Step 2)
PROJECT_ID="<from prod>"
DV_ID="<feasibility_intake doc_version_id from prod>"

curl -X POST "${PROD_SUBSTATION_URL}/api/projects/${PROJECT_ID}/diligence" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{ \"document_version_id\": \"${DV_ID}\" }"

# Returns: { "id": "dlr_<uuid>", "object": "diligence_run", "status": "queued", ... }
```

```
# 2. Watch the UI (use the dlr_<uuid> from the response, prefix and all)
<PROD_CITYHALL_URL>/project/<PROJECT_ID>/diligence-runs/dlr_<uuid>
```

Status should flip `queued → running → completed` within a few seconds (with `STUB_SLEEP_MS=10000` in field-agent's `.env`).

---

## Known URLs (fill in once)

These are the three endpoint URLs you'll substitute throughout. Find them in the Vercel project list / your password manager / `noetic-inc/substation` README:

| Variable | Where to find | Example |
|---|---|---|
| `PROD_SUBSTATION_URL` | Vercel `substation` project → production deployment | `https://substation-noetic.vercel.app` |
| `PROD_CITYHALL_URL` | Vercel `cityhall` project → production deployment | `https://app.noetic.inc` |
| `PROD_SUPABASE_URL` | Supabase dashboard → Project Settings → API | `https://<project-ref>.supabase.co` |

---

## One-time setup

### field-agent's `.env` — point everything at prod

```env
INNGEST_APP_ID=field-agent
INNGEST_EVENT_KEY=<prod env key from Inngest dashboard>
INNGEST_SIGNING_KEY=<prod signing key from Inngest dashboard>
SUPABASE_URL=<PROD_SUPABASE_URL>
SUPABASE_SERVICE_ROLE_KEY=<prod service-role JWT from Supabase dashboard>

# Optional: short stub sleep for fast iteration. Default is 10 minutes.
STUB_SLEEP_MS=10000
```

Then:

```bash
cd /Users/winston/workspace/field-agent
pnpm dev
```

You should see:
```
[field-agent] starting (app=field-agent)
[field-agent] connected to Inngest
```

The `field-agent` app should appear (or remain) **online** in the [Inngest prod dashboard](https://app.inngest.com/env/production/apps) — confirms the worker is dialed in and ready to consume `diligence/requested` events.

> Substation and cityhall **are not** run locally for this loop. The deployed Vercel instances of both serve real prod traffic against the same Supabase + Inngest env field-agent uses.

---

## Step 1 — Get a `feasibility_intake` document_version_id

You need a prod-DB document_version row with `kind='feasibility_intake'`. Two paths.

### Option A — via the prod cityhall intake flow (recommended)

1. Open `<PROD_CITYHALL_URL>` and sign in.
2. Open a project that doesn't already have an active intake (or create one).
3. Start an intake conversation; send any message. The intake document + version are created automatically.
4. Look up the document_version_id (Option B query below).

### Option B — from a known `conversation_id`

If you've been in the cityhall intake chat for a project, the chat URL already gives you a `conversation_id`. The URL pattern is:

```
<PROD_CITYHALL_URL>/project/<projectId>/submission/<submissionId>/intake/<conversationId>
```

Grab the `conversationId` segment and run this in Supabase Studio / psql to resolve it to the corresponding feasibility_intake document_version:

```sql
-- Given a conversation_id (the last segment of the cityhall intake URL),
-- find the feasibility_intake document_version that belongs to the same
-- project. Picks the most-recent if the project has more than one intake.
SELECT
  dv.id              AS document_version_id,
  c.project_id       AS project_id,
  c.id               AS conversation_id,
  d.created_at       AS doc_created_at,
  sv.version_number  AS submission_version
FROM conversations c
JOIN document d
  ON d.project_id = c.project_id
 AND d.kind = 'feasibility_intake'
JOIN document_version dv
  ON dv.document_id = d.id
JOIN submission_version sv
  ON sv.id = dv.submission_version_id
WHERE c.id = '<CONVERSATION_ID>'
ORDER BY dv.created_at DESC
LIMIT 1;
```

Save `document_version_id` and `project_id` for Step 3. The trigger route also accepts an optional `conversation_id` in the body — passing it stamps the resulting `diligence_runs` row with the conversation FK, which makes the run traceable from the chat thread later.

> **Note on the join shape:** `conversations` doesn't directly FK to the feasibility_intake document — they're related via `project_id`. The query picks the most-recent feasibility_intake `document_version` in that project, which is what you want for a fresh test. If the project happens to have multiple intake submissions, double-check the `submission_version` column to confirm you're targeting the one you mean.

### Option C — query existing rows in prod Supabase

Via Supabase Studio (dashboard → SQL Editor) or psql against the prod connection string:

```sql
SELECT
  dv.id AS document_version_id,
  d.project_id,
  d.created_at,
  d.name
FROM document_version dv
JOIN document d ON d.id = dv.document_id
WHERE d.kind = 'feasibility_intake'
ORDER BY dv.created_at DESC
LIMIT 5;
```

Pick a row that belongs to a project you have access to. Save both the `document_version_id` and `project_id`.

> Don't INSERT feasibility_intake rows directly into prod — go through the cityhall intake flow so the document is in a consistent state.

---

## Step 2 — Get a bearer token

The bearer is the Supabase JWT for your signed-in cityhall session.

1. Open `<PROD_CITYHALL_URL>` and sign in.
2. DevTools → **Application** → **Cookies** → select your host.
3. Find the cookie whose value is a JSON blob with `access_token` and `refresh_token` keys. The cookie name is typically `sb-<project-ref>-auth-token`.
4. Copy the `access_token` string — that's the bearer. It looks like `eyJhbGciOi...` and is valid for ~1 hour.

If you need to leave a long-running test going, re-grab a fresh token when the old one expires (you'll see `401` from substation).

> **Don't use the prod service-role key in curl.** It's the most privileged credential in the system — using it in shell history / IDE terminals is unnecessarily risky. The user-JWT path is enough for smoke testing.

---

## Step 3 — Trigger the diligence run

```bash
PROD_SUBSTATION_URL="https://..."  # your prod URL
TOKEN="eyJ..."                     # from Step 2
PROJECT_ID="..."                   # from Step 1
DV_ID="..."                        # from Step 1

curl -X POST "${PROD_SUBSTATION_URL}/api/projects/${PROJECT_ID}/diligence" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{ \"document_version_id\": \"${DV_ID}\" }"
```

If you used Option B in Step 1, you have a `conversation_id` too. Optional but useful — passing it stamps the row with the chat thread FK so you can trace the run back to the conversation later:

```bash
curl -X POST "${PROD_SUBSTATION_URL}/api/projects/${PROJECT_ID}/diligence" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{ \"document_version_id\": \"${DV_ID}\", \"conversation_id\": \"${CONVERSATION_ID}\" }"
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
  "triggered_by_user_id": "<your-user-uuid>",
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
<PROD_CITYHALL_URL>/project/<PROJECT_ID>/diligence-runs/<dlr_id>
```

Both the prefixed (`dlr_<uuid>`) and raw (`<uuid>`) forms work in the URL.

**Expected timeline:**

| t | Status | What's happening |
|---|---|---|
| 0s | `queued` | Substation INSERTed the row; event fired |
| ~1–3s | `running` | field-agent received the event, ran `step.run('mark-running')` |
| +STUB_SLEEP_MS | `completed` | field-agent slept, then ran `step.run('mark-completed')` |

The UI updates without any refresh — Supabase Realtime debounces and triggers an SSR re-fetch. Live elapsed timer ticks while status is `running`.

---

## Step 5 — Verify via DB (optional)

In prod Supabase Studio:

```sql
SELECT id, status, created_at, started_at, completed_at, updated_at
FROM diligence_runs
ORDER BY created_at DESC
LIMIT 5;
```

The lifecycle columns reflect each transition. `updated_at` advances on every flip (auto-bump trigger fires on each UPDATE).

You can also watch it in real-time via Studio's table editor by enabling the realtime view — field-agent's status flips show up the moment they happen.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401 unauthorized` from substation | Token expired (sign in again, copy fresh JWT) or wrong host (using a local token against prod / vice versa) |
| `400 document_version_wrong_kind` | The `document_version_id` isn't kind=`feasibility_intake`. Re-run Step 1's lookup query |
| `403 document_version_wrong_project` | The doc_version belongs to a different project than the URL `:projectId`. Re-pick a matching pair |
| `404 document_version_not_found` | Doc_version doesn't exist in prod Supabase. Re-run Step 1 |
| Row stuck at `queued` forever | (a) field-agent isn't running, (b) field-agent's `.env` still points at local Supabase, (c) field-agent isn't connected to Inngest. Check the Inngest prod dashboard for the `field-agent` app status and look for the `diligence/requested` event in the events feed |
| field-agent logs "invalid event payload" | The `diligence/requested` event arrived without `diligence_run_id` in `event.data`. Sanity-check substation's send code didn't get rolled back |
| UI shows `404` | Wrong project_id in the URL (the run belongs to a different project) or `dlr_id` doesn't exist |
| UI shows the row but never updates | Realtime isn't connecting. Check browser console for Supabase realtime errors; confirm both `diligence_runs` and `diligence_artifacts` are still in `supabase_realtime` (`SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename LIKE 'diligence%'`) |

---

## What "works" looks like

A successful full prod loop produces:

- One `diligence_runs` row in prod Supabase, lifecycle `queued → running → completed` within ~10–15 seconds (with `STUB_SLEEP_MS=10000`)
- Zero `diligence_artifacts` rows (Phase 1 stub doesn't generate any)
- One Inngest function run in the prod dashboard with three steps: `mark-running` → `stub-work` (sleep) → `mark-completed`, all green
- One prod cityhall page that smoothly walked through the three states without a manual refresh

If all four are true, Phase 1 scaffolding is end-to-end validated in prod and we're cleared to swap field-agent's stub body for the real `@anthropic-ai/claude-agent-sdk` invocation in Phase 2.

---

## What this leaves behind

Each successful loop leaves a `diligence_runs` row in prod with `status='completed'`. These accumulate; nothing automatically cleans them up. Hand-cleanup if you want:

```sql
-- Delete all stub completed rows (cascade removes artifacts; Phase 1 has none anyway)
DELETE FROM diligence_runs WHERE status = 'completed';
```

Or filter to your test rows by `triggered_by_user_id`, `created_at` window, or the matching `inngest_event_id` you can see in the dashboard.
