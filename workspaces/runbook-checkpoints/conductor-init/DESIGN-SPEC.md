# `conductor init` — one local run-initialization verb

**Status:** Draft v1
**Date:** 2026-09-10
**Repos touched:** `conductor2` (new `init` verb + a control-plane HTTP client), `substation` (`POST /api/runs` delegates to the shared `registerRun`), `claude-plugins` (the `conductor` skill drops its §6 DB verbs and calls `conductor init`)
**Repos NOT touched:** `cityhall`, `bureau` (the `runbook_hitl_cli.py` local client is superseded but its removal is a follow-up, not this slice)

> **Context.** This is a child of the `runbook-checkpoints` control-plane work (parent: `../DESIGN-SPEC.md` v2, `../reconcile-workstreams/DESIGN-SPEC.md` v3). It assumes those tables (`runbook_runs`, `runbook_checkpoints`, `runbook_hitl_questions`) and the cloud lane as of substation **#257** ("Retire the Inngest launcher: `POST /api/runs` is the only way a cloud run starts", merged 2026-09-10). It does **not** re-litigate the cloud lane or the DB-free stance of conductor2 — it makes the **local** lane initialize a run the same way the cloud lane already does.

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

Behavior:

1. **Register (conditional).** If `--run-id` is **absent** *and* a control-plane URL + credential are configured in the environment: `POST <control-plane>/api/runs` with `x-service-role-key`, body carrying at minimum `{ runbook, host, request?, project_id? }`. Take `{ id, callback_token }` from the response. If `--run-id` is **present**, skip the POST — the row already exists (this is the shape a caller uses when something else registered the run).
2. **Set up.** Run the existing `setup` logic unchanged (`conductor2/src/verbs.rs:21-157`): compile the run dir, write conventions, create `hitl/`, git-init `runbooks/`.
3. **Record the id.** Write the run id to **`<run-dir>/runbook-run-id.txt`** — a text file whose entire contents are the run id, nothing else. (If `--run-id` was given, write that.)

`init` is a thin wrapper: `[register] → setup → write id file`. `conductor setup` remains a public verb, unchanged, for offline / no-DB / throwaway runs.

The control-plane base URL is a **new env var** (proposed: `CONDUCTOR_CONTROL_PLANE_URL`) — the substation API host, which is distinct from `PUBLIC_SUPABASE_URL`. The service-role key reuses `SUPABASE_SERVICE_ROLE_KEY`.

### `runbook-run-id.txt` as the lane signal

`CONDUCTOR_HITL_DB=1` is deleted. The run's lane is now self-describing on disk:

- **File present** → DB lane. The captain publishes checkpoints and routes gates through the control plane (the cityhall console can answer them).
- **File absent** → in-chat lane. Gates are answered in chat and written straight to the step folder as `decision.json` (today's skill §5 default), no DB.

A file in the run dir is durable across the captain's tool calls in a way the env var never was. Verb choice sets the lane: `conductor init` → DB lane; `conductor setup` → in-chat lane.

### The shared registration primitive (substation)

Refactor `POST /api/runs` to delegate to the same `registerRun()` the cloud path uses, instead of its own inline `insert` (`runs.ts:194`). One definition of "register a run": local `conductor init` reaches it over HTTP; the cloud reconcile path reaches it in-process. No behavior change to the endpoint's contract — same validation, same `queued` row, same bearer minting (`runs.ts:219`).

### The `conductor` skill (claude-plugins)

- Skill §3 kickoff becomes `conductor init` (not `conductor setup`) for any run that should be observable/answerable in the app.
- Skill §6's `run-start` / `run-update` / the `CONDUCTOR_HITL_DB` gate are removed. Checkpoint/ask/await-answer during the run are a **separate concern** left to the existing local HITL client for this slice (see Scope) — this spec only moves **initialization** off the LLM.

## Cloud interaction (unchanged, stated for completeness)

Cloud already does the equivalent and is **not touched**:

- `POST /api/runs` creates the row (server-side, credentialed) — the `conductor init` "register" step, done by substation.
- The reconcile `setup` carrier runs `conductor setup` in the sandbox — the `conductor init` "setup" step, done by the loop.
- In cloud the run dir is derived from the id (`…/runs/<runbook>/<run.id>`), so the id is recoverable from the path; `runbook-run-id.txt` is redundant there but harmless if the setup carrier writes it too (optional symmetry, not required by this spec).

The two steps `init` bundles are, in cloud, deliberately **decoupled across the reconcile tick** — a cold sandbox provision sits between "row created" and "`conductor setup` runs", so they cannot be one command. `init` is therefore a *local* convenience, not a new cloud entry point.

## Scope

**In scope (this slice):** the `init` verb (register + setup + id file); `runbook-run-id.txt` as the lane signal; retire `CONDUCTOR_HITL_DB`; `POST /api/runs` → shared `registerRun`; skill §3 switches to `init`.

**Deferred:**
- Moving the *rest* of the local DB writes (checkpoints, ask/await-answer) off the LLM — a later slice, likely a `conductor`-driven emit/callback contract mirroring the cloud callback. This spec deliberately does the smallest useful thing first: initialization.
- Retiring `bureau/runbooks/lib/runbook_hitl_cli.py` / `app_client.py` — superseded over time, not deleted here.
- Implementing the `--callback` / `--run-id`-into-advance contract in conductor2 (substation's cloud driver is coded against it but the binary does not yet speak it) — orthogonal to `init`.

## Open questions

- **Q1 — POST fails locally: hard-fail or degrade?** When `conductor init` cannot reach the control plane (offline, misconfigured URL, 5xx), should it (a) fail the command, or (b) fall back to a no-DB run (proceed as if `conductor setup` was called, no id file, in-chat lane) with a warning? Recommend **(b)** — the parent spec's principle is "a HITL-infra outage never bricks a run" (`../DESIGN-SPEC.md:217`); registration is best-effort, and the id file's absence already means "in-chat lane".
- **Q2 — Which control plane does a *local* run register against?** For the row to appear in the operator's console it must hit the **same** substation deployment cityhall reads (prod). Confirm local dev runs registering prod rows is desired, and whether a `--no-register` / offline escape hatch is wanted for throwaway runs (vs. just calling `conductor setup`). Recommend: `conductor setup` *is* the escape hatch; `conductor init` always registers against the configured (prod) control plane.
- **Q3 — Does `conductor setup` stay public, or become `init`-internal?** Recommend **stays public** — it is the deterministic no-DB primitive, exercised directly by offline runs and by the cloud reconcile carrier. `init` wraps it.
- **Q4 — Verb name.** `init` vs `run-init` vs `register`. `start`/`drive` are rejected (imply execution; `advance` already runs the graph, `drive` is a stubbed verb at `main.rs:443`). Recommend **`init`**.
- **Q5 — Does the bearer get used locally, or minted-and-ignored?** `POST /api/runs` returns a `callback_token`. Cloud injects it into the sandbox as `CONDUCTOR_CALLBACK_TOKEN`. Locally the operator's machine already holds real creds, so the captain does not strictly need the bearer to write. Recommend: **store it in the run dir** (e.g. alongside the id file) but treat it as optional — it becomes load-bearing only if/when the deferred "checkpoints off the LLM" slice routes local writes through the bearer-authenticated routes instead of service-role PostgREST.
