# Sandbox API tokens — a per-run bearer for a subset of substation routes

**Status:** Draft v1
**Date:** 2026-09-11
**Repos touched:** `substation` (generalize the per-run bearer into a route-allowlisted middleware; add the read + checkpoint routes under `/api/runs/:id/*`; inject the bearer into the runbook sandbox env), `conductor2` (a substation control-plane client that reads the stored token and emits a checkpoint at each step transition + can GET run state), `claude-plugins` + `bureau` (deferred: retire the LLM-driven `post-checkpoint`/`ask`/`await-answer` shell-outs once conductor2 owns them)
**Repos NOT touched:** DB schema (reuses `runbook_checkpoints` / `runbook_hitl_questions` from the reconcile-workstreams converged model — no new tables/columns), `cityhall` (console reads run state with a user JWT, unchanged)
**Parent:** `../DESIGN-SPEC.md` (control-plane) · `../reconcile-workstreams/DESIGN-SPEC.md` v3 (converged tables) · `../conductor-init/DESIGN-SPEC.md` (the `init` verb this builds directly on — D5 named this slice)

> **One-line goal.** Give conductor2 a per-run credential it can use to `GET` and `POST` a small, fixed set of substation routes — so the harness itself (not an orchestrating LLM shelling out to Python) writes each step's checkpoint to the DB, identically in the local and cloud lanes, while never holding a credential whose leak outlives the run.

## Problem

Per-step checkpoint emission (`../reconcile-workstreams/DESIGN-SPEC.md` §2B — "checkpoint stream + emission everywhere") is still improvised by an LLM. In the 2026-09-11 smoke run (`runbook_runs.id=592eceab-31f7-4546-954e-a9228181de91`), the only two `runbook_checkpoints` rows were the HITL question + its answer (auto-emitted by the `ask`/`await-answer` verbs); the other **nine** steps emitted nothing, because nothing in the smoke runbook authors a `post-checkpoint` call. The captain (an LLM following a markdown skill) is the only thing that emits, and only where the prose tells it to. `conductor init` (`../conductor-init/DESIGN-SPEC.md`) moved **run initialization** off the LLM; its **D5** filed the rest — "moving the checkpoints/ask-await off the LLM … a later slice, likely a `conductor`-driven emit/callback contract mirroring the cloud callback" — as the immediate next slice. **This is that slice.**

The blocker is credential shape, and it is lane-asymmetric:

- **Local lane.** conductor2 runs on the operator's laptop, which holds `SUPABASE_SERVICE_ROLE_KEY`. Today the checkpoint writes go through `bureau/runbooks/lib/app_client.py` (`SUPABASE_RUN_TOKEN` first, service-role as a local fallback — `app_client.py:15-21`), shelled out to by the captain.
- **Cloud lane.** conductor2 runs **inside the Vercel sandbox**, which is deliberately denied any long-lived DB credential. `isForbiddenRunbookEnvVar` strips every `*SERVICE_ROLE*` var (`substation/src/lib/runbook/env.ts:121-123`, applied `:263`), and substation's own JWT signing secret is never forwarded (`env.test.ts:65`). The stated reason (`env.test.ts:6-8`): *"the sandbox is persistent and its filesystem is snapshotted indefinitely, so a secret that reaches a run is a secret kept for the life of the project."*

So we cannot simply hand the sandbox a broad substation API key. We need a credential that is **scoped to one run**, **short-blast-radius on leak**, and **identical in both lanes** so conductor2 has one emit path.

## Is this a new pattern? No — it is the union of two substation already has

1. **A per-run bearer that authorizes a specific unattended route set.** `substation/src/lib/run-bearer.ts` already mints `HMAC-SHA256(run_id)` keyed by `RUN_CALLBACK_SECRET` (hex, **derived-not-stored**, no expiry — `run-bearer.ts:11-20`). It is already minted at `POST /api/runs`, returned to conductor2, and stored by `conductor init` at `<run-dir>/.conductor/callback-token` (`conductor2/src/init.rs:44, 121-132`). It already authorizes `POST /api/runs/:id/callback` and `POST /api/gates/:id/decide` (`run-bearer.ts:5-9`), and conductor2 already sends it as `Authorization: Bearer {token}` (`conductor2/src/callback.rs:210-213`).

2. **A token accepted only for allowlisted `(path, method)` pairs.** `substation/src/middleware/auth.ts:34-50` — `SERVICE_API_ROUTES` gates `SUBSTATION_SERVICE_API_KEY` so *"a leaked key can't be used against arbitrary endpoints."* That is exactly the "subset of substation APIs" shape.

**This spec composes them:** the per-run bearer of (1), checked against a route allowlist of (2)'s shape, extended from two routes to a small read+write set. The single genuinely new artifact is a reusable middleware; everything else is a config list and one HTTP client.

The security spine is intrinsic to (1): **authorization is `verifyRunBearer(run_id_from_path, token)`, so a token can only ever act on its own run's sub-resources.** Cross-run access is *cryptographically impossible*, not policy-gated — there is no allowlist bug that lets run A's token touch run B, because the path `:id` must hash to the presented token. That is a stronger guarantee than the project-scoped `SUPABASE_RUN_TOKEN` RLS (which trusts a claim) and vastly stronger than the service-role key (all tenants).

## Design

### 1. The token (unchanged primitive)

Reuse `run-bearer.ts` as-is. Properties that matter here, all already true:

- **Run-bound.** `HMAC(run_id)` — the token *is* the run's identity; nothing in the DB is read to check it (`run-bearer.ts:11-16`).
- **No expiry, by design** (`run-bearer.ts:17-20`) — a run may park on a human for days; a TTL'd token can't be refreshed through a channel a parked sandbox lacks. **Blast radius on leak = one run's allowlisted verbs**; the kill switch is rotating `RUN_CALLBACK_SECRET`, which invalidates every live token at once (accepted, documented trade).
- **The secret never enters a sandbox.** `RUN_CALLBACK_SECRET` lives only in substation's env; the sandbox receives only its own already-minted token — the same discipline `SUPABASE_JWT_SECRET` follows for `run-token.ts`.

### 2. The route allowlist (new — mirrors `SERVICE_API_ROUTES`)

A new `RUN_BEARER_ROUTES: Record<templatedPath, { methods: string[] }>` in substation. **Invariant: every entry is under `/api/runs/:id/*`** (the run id must be a path segment) so the middleware can verify `HMAC(:id) === token`. A route without a run id in its path is *unrepresentable* in this allowlist and stays on the service-api-key / user-JWT paths (e.g. `POST /api/runs`, which creates a run and therefore has no id yet).

Initial set:

| Route | Verb | Purpose | Maps to today's |
|---|---|---|---|
| `GET  /api/runs/:id` | read | poll run state (e.g. a resumed sandbox reads whether its gate was answered) | — |
| `POST /api/runs/:id/checkpoints` | write | append one `status`/`note` checkpoint; **server allocates `seq`** | `runbook_hitl_cli.py post-checkpoint` |
| `POST /api/runs/:id/callback` | write | existing exit-code park/done callback | already bearer-gated (migrate onto the middleware) |
| `POST /api/runs/:id/hitl-questions` *(deferred)* | write | open a HITL question, returns id | `ask` |
| `GET  /api/runs/:id/hitl-questions/:qid` *(deferred)* | read | poll a question for its answer | `await-answer` |

`POST /api/gates/:id/decide` / `…/answer` is **not** conductor's route — it is reached from a browser (user JWT) or the existing decide alias, and stays as-is.

### 3. The middleware (new, reusable)

`runBearerMiddleware`, mounted on the `/api/runs/:id/*` sub-router:

1. Read `:id` from the matched route param; read the bearer via `bearerFrom(c.req.header('authorization'))` (`run-bearer.ts:92-96`).
2. `verifyRunBearer(id, token)` (constant-time, fail-closed — `run-bearer.ts:54-73`). On success set `{ runId: id, viaRunBearer: true }` on the context.
3. **Then** assert `(path, method) ∈ RUN_BEARER_ROUTES` (defense-in-depth: the mount already restricts, but an explicit allowlist stops a future careless sub-route from silently inheriting bearer auth). 403 `run_bearer_route_not_allowed` otherwise.
4. **Fall through** to the existing `authMiddleware` when the bearer is absent/invalid — so the same routes still accept a **service-role** call (substation internal / reconcile) and a **user JWT** (cityhall console reading run state). This is a composite `runBearerOr(authMiddleware)`, not a replacement (**Q1** on exact composition).

Net substation change: one middleware, one route-list constant, two new route handlers (`GET :id`, `POST :id/checkpoints`), and migrating the callback's in-handler `verifyRunBearer` onto the shared middleware.

### 4. Delivering the token to the sandbox (cloud)

Locally the token is on disk (`.conductor/callback-token`, written by `init`). In cloud, conductor2 is set up by the reconcile `setup` carrier *after* `POST /api/runs` already minted the bearer — so substation must **inject the bearer into the sandbox env**, exactly as it injects `SUPABASE_RUN_TOKEN` today (`buildRunbookEnv` via the `runTokens` param, `env.ts:93-125`). The env name is already established: conductor2's callback reads `CONDUCTOR_CALLBACK_TOKEN` (`callback.rs:24, 195`). So: `buildRunbookEnv` adds `CONDUCTOR_CALLBACK_TOKEN = mintRunBearer(runId)`. The secret stays in substation; only the minted token crosses the boundary (**Q8** confirms the current cloud delivery path, which the unbuilt callback also needs).

### 5. conductor2 client + the emit hook

**Client.** A new `control_plane` module, modeled on the existing `ureq` lanes (`init.rs`, `gateway.rs`, `callback.rs`): `Agent::config_builder().http_status_as_error(false).timeout_global(...)`. Base URL from `SUBSTATION_URL`; bearer from `CONDUCTOR_CALLBACK_TOKEN` (same source `callback.rs` uses). Methods: `post_checkpoint(run_id, {kind, title, body_md?, step_id})` and `get_run(run_id)`. conductor2 stays **DB-free** — HTTP only, no Postgres (`main.rs:1-4`; `init.rs:8-12`).

**Hook.** There is one choke point for every step transition: `ledger::append(run_root, entry)` (`conductor2/src/ledger.rs:139-166`), called from 15+ sites (cached `verbs.rs:703`, script/agent complete `:734`, agent attempt `:1163`). It **already tees the entry to `telemetry::emit("ledger", …)`** (`ledger.rs:161-164`). The checkpoint emit is a **sibling tee at that exact line** — when the run is in the DB lane (token present) and telemetry-style enablement is on, `ledger::append` also fires `control_plane::post_checkpoint`. One attach point, both lanes, every step, for free.

**Best-effort, never blocking.** A failed emit warns to stderr and returns — it never fails the run (the `callback.rs` discipline: *"reports to stderr, never fails the run"*). The **run dir stays authoritative; the DB is a projection.** This is why status emission can ship before any cloud resume driver exists.

**Row shape.** Keep rows small: `title` (`"2.2-digest · started"` / `"· done"`) + optional short `body_md` + `step_id`. Step *artifacts* (outputs.json, digest, renders) go to Storage and are referenced by path (the `readout_storage_path` pattern already on `runbook_hitl_questions.payload`), never inlined into `body_md`.

### 6. Lane symmetry (the payoff)

- **Cloud:** conductor2 in the sandbox holds `CONDUCTOR_CALLBACK_TOKEN` (injected §4), emits via the client.
- **Local:** conductor2 on the laptop reads the **same** token from `.conductor/callback-token` and hits the **same** routes on **prod** substation — *not* the local service-role key. The `app_client.py` service-role write path becomes vestigial for checkpoints (**Q4** on its retirement).
- The **only** per-lane difference left is how a parked run is *resumed* after a HITL answer (local captain vs cloud reconcile body) — orthogonal to this spec, unchanged, and still the shared gap in `../reconcile-workstreams/DESIGN-SPEC.md` §2·gap.

## Security analysis

1. **Blast radius.** A leaked per-run bearer → one run's allowlisted verbs, nothing else; cross-run is cryptographically impossible (§"Is this a new pattern"). Rotate `RUN_CALLBACK_SECRET` to invalidate all. Compare: service-role = every tenant; `SUPABASE_RUN_TOKEN` = whole project for 25h.
2. **Secret containment.** `RUN_CALLBACK_SECRET` never leaves substation; the sandbox gets only the minted token (mirrors `SUPABASE_JWT_SECRET`).
3. **No expiry.** Bounded by the narrow allowlist + rotation kill-switch; justified by parked-run refresh impossibility (`run-bearer.ts:17-20`).
4. **Route containment.** The allowlist is the same leaked-token mitigation as `SERVICE_API_ROUTES` (`auth.ts:26-29`).
5. **Server-side validation.** substation allocates `seq`, enforces the `kind` CHECK, and **caps `body_md` size**; `body_md` is markdown rendered in the cityhall console → sanitize on render (existing console concern, restated).
6. **Read scoping.** `GET /api/runs/:id` returns only the row whose id hashes to the token; no cross-run read.
7. **Idempotency.** A client retry could double-POST a checkpoint. `UNIQUE(run_id, seq)` prevents *duplicate seqs* but not *duplicate events* if the client re-tries with a new seq. Options: at-least-once + dedupe-on-render, or an idempotency key `(run_id, step_id, phase)` (**Q3**).
8. **Availability.** substation down → best-effort degrade, run continues, stream gaps; ledger-replay backfill on resume is the guarantee (**Q5** — this slice or the reconcile-body slice).

## Decisions (locked for v1)

- **D1 — Reuse the HMAC bearer, do not mint a new token type.** `SUPABASE_RUN_TOKEN` is a DB credential (a browser/route mediator must not hand it out — `run-bearer.ts:22-25`); the HMAC bearer is the right primitive for "call a substation route as this run."
- **D2 — Allowlist is `/api/runs/:id/*`-only.** Run id in the path is the authorization input; a run-less route can't use this token.
- **D3 — Composite auth, not replacement.** Run-scoped routes accept run-bearer OR service-role OR user JWT, so the console keeps reading run state and reconcile keeps writing.
- **D4 — Server allocates `seq`.** conductor2 never computes it; kills the fan-out race on `UNIQUE(run_id, seq)`.
- **D5 — Emit is a best-effort tee of `ledger::append`, next to the telemetry tee.** One attach point; never fails the run; run dir authoritative.
- **D6 — Ship the one-way slice first** (`GET :id`, `POST :id/checkpoints`, callback migration, cloud token injection, conductor2 client + status emit). The HITL `ask`/`await` routes are deferred because their *cloud resume* depends on the still-unbuilt reconcile body.

## Open questions

- **Q1** — Composite-auth mechanics: one `runBearerOr(authMiddleware)` wrapper vs two mounts on the same sub-router? Where does the existing in-handler callback `verifyRunBearer` move to?
- **Q2** — `seq` allocation under concurrent fan-out: `SELECT max(seq)+1` in a txn, a per-run Postgres sequence, or an advisory lock keyed on `run_id`?
- **Q3** — Idempotency: at-least-once + render-dedupe, or add an idempotency key to `runbook_checkpoints`? (touches the converged schema — is `(run_id, seq)` the only uniqueness?)
- **Q4** — Once conductor2 owns checkpoint writes, does the local lane keep `app_client.py`'s service-role path at all, or is bearer-to-prod the sole writer? Retirement sequencing with `bureau/runbooks/lib`.
- **Q5** — Backfill: is ledger-replay-on-resume (catch emits dropped while substation/offline) in this slice or the reconcile-body slice?
- **Q6** — Should `GET /api/runs/:id` return the run + its open questions in one payload (one round-trip for a resume) or stay REST-granular?
- **Q7** — `RUN_CALLBACK_SECRET` rotation ops: rotating kills every live parked run's token. Is there a re-mint-and-reinject path for a parked cloud run, or is it just re-launched? Document the runbook.
- **Q8** — Cloud token delivery: confirm `buildRunbookEnv` is where `CONDUCTOR_CALLBACK_TOKEN` gets injected (mirroring `SUPABASE_RUN_TOKEN`), and that the unbuilt callback already assumes this — so both features share one delivery path. Also bridge the local gap: `init` writes `.conductor/callback-token` but `callback.rs` reads the `CONDUCTOR_CALLBACK_TOKEN` env and `sched.rs:2372 hand_down()` does not yet pass it — the driver child env must load the file into that var.
