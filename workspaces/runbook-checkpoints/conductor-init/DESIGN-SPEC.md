# `conductor init` — one local run-initialization verb

**Status:** Draft v1
**Date:** 2026-09-10
**Repos touched:** `conductor2` (new `init` verb + a control-plane HTTP client), `substation` (`POST /api/runs` accepts projectless runs), `bureau` (`runbook_hitl_cli.py` drops `run-start`), `claude-plugins` (the `conductor` skill kicks off with `init` and drops its §6 DB register verb)
**Repos NOT touched:** `cityhall`

> **Implementation reconciliation (2026-09-10).** Two header/section claims were corrected against the code *after* substation **#257** landed (same day, just before implementation): (a) there is no `registerRun()` to "share" — #257 deleted the Inngest launcher and `registerRun`, so `POST /api/runs` is *already* the sole registration primitive; the real substation change is making `project_id` **optional** (projectless local/`smoke` runs). (b) `bureau` **is** touched — decision **D3** (delete `run-start`) supersedes the original "Repos NOT touched: bureau" line. See the Implementation section for the shipped PRs.

> **Context.** This is a child of the `runbook-checkpoints` control-plane work (parent: `../DESIGN-SPEC.md` v2, `../reconcile-workstreams/DESIGN-SPEC.md` v3). It assumes those tables (`runbook_runs`, `runbook_checkpoints`, `runbook_hitl_questions`) and the cloud lane as of substation **#257** ("Retire the Inngest launcher: `POST /api/runs` is the only way a cloud run starts", merged 2026-09-10). It does **not** re-litigate the cloud lane or the DB-free stance of conductor2 — it makes the **local** lane initialize a run the same way the cloud lane already does.

> **Decisions locked (grill 2026-09-10):** D1 idempotency (marker-check first, id-in-file not id-in-path), D2 `host≠vercel` guard, D3 delete `run-start`, D4 service-role-key debt accepted, D5 ship init-only + file the follow-up, D6 POST-fails→degrade, D7 register against prod, D8 `setup` stays public, D9 name `init`, D10 bearer stored-optional. See Decisions section.

## Problem

A runbook run needs two things to exist before it can advance: a **`runbook_runs` DB row** (so the run is observable in the cityhall console and answerable through the HITL routes) and a **set-up run directory** (`graph.json`, conventions, the `hitl/` dir — what `conductor setup` writes).

The **cloud lane** does both deterministically. `POST /api/runs` inserts the `queued` row and mints the per-run bearer (`substation/src/routes/runs.ts:141`, the handler; the docstring at `:133` — "Insert a `queued` row and hand back its id and bearer. Nothing is launched here"). The reconcile loop then runs the whole first mile — bureau/tools sync, **`conductor setup`**, attachments, `request.json` — as its `setup` carrier action, one detached command (`substation/src/lib/runbook/plan.ts`, `setupScript` / `conductorSetupScript`; `carrier_action` is now `setup | advance | report_back` per #257). No LLM is in that loop.

The **local lane** does not. The `/conductor` captain — an LLM following markdown — hand-sequences the DB writes itself. Today's kickoff is `conductor setup $BUREAU/runbooks/<runbook> $RUN` (skill §3, `claude-plugins/.../skills/conductor/SKILL.md:45`), and the row/checkpoint/question writes are a *separate*, opt-in path in §6: the captain shells out to `python3 $BUREAU/runbooks/lib/runbook_hitl_cli.py run-start …` (SKILL.md:103-104), `post-checkpoint`, `ask`, `await-answer`, gated behind the `CONDUCTOR_HITL_DB=1` env var (always on for `smoke`).

Three problems with the local lane as it stands:

1. **An LLM sequences DB state.** The order and correctness of `run-start` → `post-checkpoint` → `ask` → `await-answer` → `run-update` lives as prose in a skill file. The cloud lane proves this is deterministic server work; locally it is improvised each run.
2. **The lane toggle is an ambient env var.** `CONDUCTOR_HITL_DB=1` does not survive between the captain's separate Bash tool calls — which is exactly why the skill tells the captain to append vars to `$RUN/.env` and re-source them each call (SKILL.md:48, :105). A per-run fact encoded as process-ambient state is the wrong shape and has "caused more trouble than it's worth."
3. **Two spellings of "register a run."** The cloud path registers via `registerRun()` (`substation/src/lib/runbook/…`); `POST /api/runs` does its own inline `insert` (`runs.ts:194`). Local does a third thing (`runbook_hitl_cli.py` → `app_client.py` PostgREST). Three code paths, one concept.

## Goal

Give the local lane a single verb — **`conductor init`** — whose contract is: *on success, a `runbook_runs` row exists for this run and the run directory is set up.* The captain calls `conductor init` instead of `conductor setup`, and stops sequencing DB writes by hand. `CONDUCTOR_HITL_DB=1` is retired; the **presence of a run-id file in the run directory** becomes the durable, per-run lane signal.

This is the local mirror of what the cloud lane already spreads across `POST /api/runs` (row) + the reconcile `setup` carrier (dir). Cloud is **not changed** by this spec.

## Why not "make conductor own the DB" / "conductor always calls `POST /api/runs`"

Settled earlier in this workspace and unchanged by #257:

- **conductor2 stays DB-free.** `init` makes an authenticated **HTTP** call to `POST /api/runs` via conductor's existing `ureq` client (the same client used for the AI gateway and BetterStack telemetry) and never opens a Postgres connection. substation owns the DB write behind the endpoint. This preserves the invariant the parent specs are built on ("the run directory is the whole state", `conductor2/src/main.rs:3-4`).
- **The registration call happens only inside the trust boundary.** `POST /api/runs` requires a credential (`substation/src/middleware/auth.ts:52-86`: service-role key / service-API key / user JWT). Locally, conductor runs on the operator's machine, which holds `SUPABASE_SERVICE_ROLE_KEY` (`~/.env`, already used by today's `app_client.py`), so conductor *is* inside the boundary and may call the endpoint. In **cloud**, conductor runs inside the sandbox, which is deliberately denied any DB-capable credential (the per-run HMAC bearer exists precisely so the sandbox never holds one — `substation/src/lib/run-bearer.ts:7-9`). That is why cloud registration is done by substation and the sandbox is handed the result — and why `conductor init` self-registers **only** in the local lane. See "Cloud interaction" below.

## Design

### The `init` verb (conductor2)

`conductor init <runbook-dir> <run-dir> [--run-id <id>]`

`init` takes the **same positional args as `setup`** — the caller names the run dir (locally a human slug like `908-old-koenig`); `init` does not invent the path. It is "path-aware" only in that it checks and materializes the dir at the path it is handed, which is what `setup` already does.

Behavior:

0. **Idempotency check (first).** `stat <run-dir>/runbook-run-id.txt`. If it **exists** → this path is already an initialized run: adopt that id and exit 0, skipping both register and setup. Registration is the **last** side effect and is reached only when the path is fresh, so re-running `init` (a retry, a resume, a fat-finger) never double-registers or orphans a row. (D1)
1. **Register (conditional).** If `--run-id` is **absent** *and* a control-plane URL + credential are configured: `POST <control-plane>/api/runs` with `x-service-role-key`, body `{ runbook, host, request?, project_id? }`. Take `{ id, callback_token }` from the response. If `--run-id` is **present**, skip the POST — the row already exists. **`host` is forced to the local hostname; `init` refuses to send `host='vercel'`** — a locally-initialized run must never be claimable by the prod reconcile cron, which acts only on `host='vercel'`. A test asserts this. (D2)
2. **Set up.** Run the existing `setup` logic unchanged (`conductor2/src/verbs.rs:21-157`): create + compile the run dir, write conventions, create `hitl/`, git-init `runbooks/`. `init` does not mkdir separately — `setup` creates the dir at the given path (`verbs.rs:31`).
3. **Record the id.** Write the run id to **`<run-dir>/runbook-run-id.txt`** — a text file whose entire contents are the run id, nothing else. (If `--run-id` was given, write that.)

`init` is a thin wrapper: `[adopt-if-present] → [register unless --run-id] → setup → write id file`. `conductor setup` remains a public verb, unchanged, for offline / no-DB / throwaway runs.

**The id lives in the file, not in the path.** Locally the path is a caller-chosen slug; the id-in-path scheme (`…/runs/<runbook>/<id>`) is a cloud-only convenience the launcher can afford because it mints the id first. Keeping the local path caller-chosen is what *makes* the D1 idempotency check possible — if the id drove the path, `init` could not look for an existing run before minting a new id, and every call would mint a fresh id → fresh path → never detect the re-run.

The control-plane base URL reuses the stack's existing **`SUBSTATION_URL`** (the internal substation API host — the same var `substationBaseUrl()` reads to build the callback URL; *not* `PUBLIC_SUBSTATION_URL`). Read straight from the process env, like the credential beside it — `SUPABASE_SERVICE_ROLE_KEY`. (An earlier draft proposed a new `CONDUCTOR_CONTROL_PLANE_URL`; rejected in favor of the canonical name.)

### `runbook-run-id.txt` as the lane signal

`CONDUCTOR_HITL_DB=1` is deleted. The run's lane is now self-describing on disk:

- **File present** → DB lane. The captain publishes checkpoints and routes gates through the control plane (the cityhall console can answer them).
- **File absent** → in-chat lane. Gates are answered in chat and written straight to the step folder as `decision.json` (today's skill §5 default), no DB.

A file in the run dir is durable across the captain's tool calls in a way the env var never was. Verb choice sets the lane: `conductor init` → DB lane; `conductor setup` → in-chat lane.

### The registration primitive (substation)

`POST /api/runs` is *already* the single registration primitive: substation **#257** deleted the Inngest launcher and its `registerRun()`, leaving the route (`runs.ts:194`) as the sole inserter of `runbook_runs`. So there is nothing to dedup — the spec's original "share `registerRun`" item is moot.

The change actually needed to make local `conductor init` work: **`createBody.project_id` must be optional.** Local runs — `smoke` above all — have no project, but the route required `project_id: z.string().uuid()` and hard-validated the project exists, while the column is now nullable (`20260909000000_reconcile_runbook_control_plane.sql:48`). So `project_id` becomes `.optional()`, the project-existence check runs only when it is present, and a projectless row inserts with `project_id: null`. A projectless run must be `metered` (no project to carry a subscription seat) — rejected by name otherwise. Everything else (attachments/seat validation, `host` from body, `queued` status, bearer minting at `runs.ts:219`) is unchanged.

### The `conductor` skill (claude-plugins)

- Skill §3 kickoff becomes `conductor init` (not `conductor setup`) for any run that should be observable/answerable in the app.
- Skill §6's `CONDUCTOR_HITL_DB` gate is removed. **`run-start` is deleted** from `runbook_hitl_cli.py`, and the CLI instead **reads `<run-dir>/runbook-run-id.txt`** for the run id — so the row is created exactly once (by `init`), never a second time by the HITL client. (D3) `run-update` / `post-checkpoint` / `ask` / `await-answer` stay on the existing Python client for this slice but source the id from the file; moving *those* off the LLM is the deferred next slice. This spec moves **initialization** off the LLM.

## Cloud interaction (unchanged, stated for completeness)

Cloud already does the equivalent and is **not touched**:

- `POST /api/runs` creates the row (server-side, credentialed) — the `conductor init` "register" step, done by substation.
- The reconcile `setup` carrier runs `conductor setup` in the sandbox — the `conductor init` "setup" step, done by the loop.
- In cloud the run dir is derived from the id (`…/runs/<runbook>/<run.id>`), so the id is recoverable from the path; `runbook-run-id.txt` is redundant there but harmless if the setup carrier writes it too (optional symmetry, not required by this spec).

The two steps `init` bundles are, in cloud, deliberately **decoupled across the reconcile tick** — a cold sandbox provision sits between "row created" and "`conductor setup` runs", so they cannot be one command. `init` is therefore a *local* convenience, not a new cloud entry point.

## Scope

**In scope (this slice):** the `init` verb (adopt-if-present + register + setup + id file); the D1 idempotency check; the D2 `host≠vercel` guard; `runbook-run-id.txt` as the lane signal; retire `CONDUCTOR_HITL_DB`; delete `run-start` and have `runbook_hitl_cli.py` read the id file (D3); `POST /api/runs` → shared `registerRun`; skill §3 switches to `init`.

**Deferred (D5 — filed now as the immediate next slice):**
- Moving the *rest* of the local DB writes (checkpoints, ask/await-answer) off the LLM — a later slice, likely a `conductor`-driven emit/callback contract mirroring the cloud callback. This spec deliberately does the smallest useful thing first: initialization.
- Retiring `bureau/runbooks/lib/runbook_hitl_cli.py` / `app_client.py` — superseded over time, not deleted here (only `run-start` goes now).
- Implementing the `--callback` / `--run-id`-into-advance contract in conductor2 (substation's cloud driver is coded against it but the binary does not yet speak it) — orthogonal to `init`.

## Decisions (locked — grill 2026-09-10)

- **D1 — Idempotency, path-first.** `init` shares `setup`'s positional args (caller names the run dir). It stats `<run-dir>/runbook-run-id.txt` first; if present, adopt + exit 0 (skip register + setup). Registration is the last side effect, reached only on a fresh path — so a re-run never double-registers. The id lives in the file, never in the local path.
- **D2 — `host≠vercel` guard.** `init` forces `host` to the local hostname and refuses to send `host='vercel'`, so a locally-initialized row can never be claimed and launched (for money) by the prod reconcile cron, which acts only on `host='vercel'`. A test asserts it.
- **D3 — Delete `run-start`.** As part of this slice, `runbook_hitl_cli.py` stops calling `run-start` and reads the run id from `runbook-run-id.txt`. The row is created exactly once (by `init`); no double-registration during the half-migrated interim.
- **D4 — Service-role key on operator laptops: accepted, noted as debt.** No new exposure — the key is already in `~/.env` for `app_client.py`. The eventual hardening is to give *local* the allowlisted `SUBSTATION_SERVICE_API_KEY` (scoped to `/api/runs`) instead of the full RLS-bypass service-role key. Flagged, not fixed, in this slice.
- **D5 — Ship initialization alone.** It's a testable milestone (row + dir + lane signal, deterministic, `smoke` exercises it end to end) and settles the run-id contract before the harder callback/emit work. The follow-up (checkpoints/ask-await off the LLM) is filed now as the immediate next slice, so this is a waypoint, not a resting state.
- **D6 — POST fails locally → degrade, not hard-fail.** When `init` cannot reach the control plane (offline, bad URL, 5xx), it proceeds as a no-DB run (as if `setup` was called), warns, and writes no id file — so the run lands in the in-chat lane. "A HITL-infra outage never bricks a run" (`../DESIGN-SPEC.md:217`).
- **D7 — Local registers against the prod control plane** (the deployment cityhall reads), so the row shows in the operator's console. `conductor setup` *is* the offline / no-register escape hatch — no separate `--no-register` flag.
- **D8 — `conductor setup` stays public** — the deterministic no-DB primitive, exercised by offline runs and by the cloud reconcile `setup` carrier. `init` wraps it.
- **D9 — Verb name: `init`.** (`start`/`drive` rejected — imply execution; `advance` runs the graph, `drive` is a stub at `main.rs:443`.)
- **D10 — Bearer stored in the run dir, treated as optional.** `POST /api/runs` returns a `callback_token`; store it alongside the id file. It becomes load-bearing only if/when the deferred slice routes local writes through the bearer-authenticated routes instead of service-role PostgREST.

## Implementation (shipped 2026-09-10, PRs open — not merged)

- **conductor2 #65** (`feat/conductor-init`) — the `init` verb in a new `src/init.rs` (`[adopt-if-present] → [register unless --run-id] → verbs::setup → write runbook-run-id.txt`), a `ureq` control-plane client modeled on `gateway.rs`, `SUBSTATION_URL` + `SUPABASE_SERVICE_ROLE_KEY`, the D2 `guard_host` (refuses `vercel`), D6 degrade, D10 best-effort `.conductor/callback-token`. 214 tests pass (8 new, incl. a loopback-mock live-POST test asserting the `x-service-role-key` header + body); clippy clean; DB-free preserved (HTTP only).
- **substation #258** (`feat/runs-project-optional`) — `POST /api/runs` `project_id` optional; project-existence check gated on presence; projectless subscription rejected (`no_project_for_subscription`); projectless row inserts `project_id: null`. 582 tests pass.
- **bureau #1589** (`feat/hitl-cli-drop-run-start`) — `runbook_hitl_cli.py` drops the `run-start` verb; the run id now comes from `runbook-run-id.txt`; `upsert_runbook_run` retained for `run-update`. Tests green.
- **claude-plugins #245** (`feat/conductor-skill-init`) — the `conductor` skill kicks off with `conductor init`; §5/§6 key the DB lane on `runbook-run-id.txt` presence; `CONDUCTOR_HITL_DB` and `run-start` removed; `setup` kept as the offline alternative.

Contract verified across #65 ↔ #258: request body field names, the `x-service-role-key` header, and the `{ id, callback_token }` response shape match.

## Open questions

None outstanding — all grill decisions locked 2026-09-10 (D1–D10). New questions from an audit pass get numbered here.
