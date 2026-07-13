# Conductor Local-Run Fallback for Sec Wave 9 Scoped Run Tokens

**Status:** Draft v1
**Date:** 2026-07-13
**Repos touched:** `conductor` (CLI bootstrap alias + tests + `.env.example` docs)
**Repos NOT touched:** `bureau`, `substation`, `cityhall`

## Problem

Sec Wave 9 (2026-07-11) moved all migrated workflows off the ambient `service_role` key and onto short-lived, per-run scoped JWTs:

- **substation#146/#147** — substation mints `SUPABASE_RUN_TOKEN` per run (HS256, 6h TTL, `workflow_run` role + tenant-scope claims via `deriveRunScope()`; see `substation/src/inngest/lib/run-token.ts` on origin/main). The signing secret `SUPABASE_JWT_SECRET` lives ONLY in substation's Vercel env and is never forwarded to sandboxes.
- **conductor#217/#222** (`eda6b64`, `3358d4a`) — `getSupabaseClient()` delegates to `createRunScopedClient()` (`conductor/src/shared/run-scoped-supabase.ts:42-57`): run token in `Authorization: Bearer`, publishable/anon key in `apikey`. Round 2 hard-blocks `SUPABASE_SERVICE_ROLE_KEY` from every child process env (`conductor/src/shared/child-env.ts:129`, `REMOVED_ENV_VARS`). There is **no service-role fallback left anywhere in the client path**.
- **bureau#574** (`fbd70c1cb`) — declared `SUPABASE_ANON_KEY` + `SUPABASE_RUN_TOKEN` in `requiredEnv` of every migrated workflow: comment-resolution-check, completeness-check(-anchored), review(-anchored), process-zip, drainage-model-analyze, submission-report, mcr-prep/convert, etc. (e.g. `bureau/workflows/comment-resolution-check/workflow.yaml:21-24` workflow-level, plus step-level declarations at lines 154-157, 169-172, 293-296).

**Local runs were left with no way to satisfy this.** Two independent failures:

1. **Hard preflight.** `validateRequiredEnv()` (`conductor/src/orchestrator/workflow-loader.ts:241-256`, called from `engine.ts:163`) fails the run at load time if any `requiredEnv` name is unset on the orchestrator's `process.env`. It checks **literal names** — `SUPABASE_ANON_KEY`, not conductor's documented local-dev var `PUBLIC_SUPABASE_ANON_KEY` (the `??` fallback exists only inside the clients, not the preflight). A local CRC/CC/review run dies before any step executes.
2. **Real functional need.** Migrated workflows genuinely hit Supabase mid-run — e.g. CRC's `fetch-crc-guides` (storage bucket `crc-guides`), `review` (`semantic-search-blocks` tool), and `upload-titles-cache` steps. These run as **child processes executing bureau scripts** with their own mirrored client (`bureau/workflows/shared/run-scoped-supabase.ts`) plus ~9 raw-fetch sites (submission-report, process-zip, drainage-model-analyze scripts), all reading `SUPABASE_RUN_TOKEN` from the child env.

There is no local mint path: the JWT secret is substation-only by design, and a correct mint needs `deriveRunScope()`'s DB lookup (chicken-and-egg: DB access is needed to scope the token that grants DB access).

**Current manual workaround** (applied on Will's machine 2026-07-13): hand-copy the legacy `service_role` JWT into `conductor/.env` as `SUPABASE_RUN_TOKEN`, and duplicate the anon key as `SUPABASE_ANON_KEY`. It works because the service-role key is a valid JWT bearer and the hard-block in `child-env.ts` is on the *name* `SUPABASE_SERVICE_ROLE_KEY`, not the value. But it's undocumented, easy to get dangerously wrong (see "Failure mode worth documenting" below), and breaks silently on key rotation.

### Failure mode worth documenting

Setting `SUPABASE_RUN_TOKEN` to the **publishable key** (`sb_publishable_…`) passes the preflight but authenticates as the unprivileged `anon` role. Writes 403 loudly, but **RLS-filtered reads silently return zero rows** — e.g. `fetch-crc-guides` "succeeds" with an empty guide set and the run produces garbage instead of crashing. The fix must make the correct path easier than this trap.

## Decision (Option A of three considered)

**Codify the service-role-as-bearer workaround as an explicit, opt-in, local-only env alias at conductor's CLI bootstrap.** No changes to any Supabase client, the preflight, `child-env.ts`, bureau, or substation.

Options considered:

- **A. Bootstrap alias (this spec)** — small conductor-only PR; honest about what local runs are (trusted dev holding the service-role key anyway). Does not exercise RLS locally.
- **B. Local mint script in substation** — real scoped tokens locally (RLS fidelity), but puts `SUPABASE_JWT_SECRET` on dev machines, duplicates `deriveRunScope`, and needs re-minting every 6h. Deferred until local RLS-policy testing is actually wanted.
- **C. Substation mint endpoint** — cleanest long-term, but a new authenticated surface + substation reachability dependency for local runs. Over-engineered for a single local operator today.

### Why an env alias and not a client fallback

The obvious shape — `createRunScopedClient()` falls back to `SUPABASE_SERVICE_ROLE_KEY` under a flag — is wrong for three structural reasons:

1. **The client is mirrored.** Conductor's `src/shared/run-scoped-supabase.ts` and bureau's `workflows/shared/run-scoped-supabase.ts` are deliberate copies, plus bureau raw-fetch sites. A client-side fallback means coordinated changes across two repos and ~10 files, re-touching everything Wave 9 just migrated.
2. **Children can never see the service-role key.** `child-env.ts:129` (`REMOVED_ENV_VARS`) hard-excludes `SUPABASE_SERVICE_ROLE_KEY` from every child env regardless of declarations — a bureau-script fallback reading that name would find it absent even if conductor forwarded everything. Aliasing the *value* under the `SUPABASE_RUN_TOKEN` name rides the existing, already-audited forwarding path (`SECRET_ENV_VARS`, step-declared — which the migrated workflows already declare at step level).
3. **The preflight checks names on the orchestrator process env.** An alias set before `runWorkflow()` satisfies `validateRequiredEnv()` with zero preflight changes.

## Design

### Change 1 — bootstrap alias in `src/index.ts`

Immediately after the inline `.env` loader (`src/index.ts:22-34`, which since conductor#223 has standard "real env wins over `.env`" semantics), insert:

```ts
// LOCAL-DEV fallback for Sec Wave 9 scoped run tokens (opt-in via
// LOCAL_SERVICE_ROLE_FALLBACK=1). Substation mints SUPABASE_RUN_TOKEN per
// run in cloud sandboxes; locally there is no minter (the JWT secret is
// substation-only). When the sentinel is set AND no run token is present,
// alias the service_role JWT under the SUPABASE_RUN_TOKEN name so the
// preflight, child-env forwarding, and every run-scoped client (conductor +
// bureau mirrors) work unchanged. Effective identity: service_role (RLS
// bypassed) — identical to pre-Wave-9 local behavior. Refused outright when
// ENVIRONMENT=production.
if (
  process.env.LOCAL_SERVICE_ROLE_FALLBACK === '1' &&
  process.env.ENVIRONMENT !== 'production'
) {
  if (!process.env.SUPABASE_RUN_TOKEN && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_RUN_TOKEN = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.warn(
      '[local-dev] SUPABASE_RUN_TOKEN ⇐ SUPABASE_SERVICE_ROLE_KEY (RLS bypassed; local runs only)'
    );
  }
}
// Name-convention shim, unconditional: the requiredEnv preflight checks the
// literal name SUPABASE_ANON_KEY (substation's sandbox convention); local
// .env uses PUBLIC_SUPABASE_ANON_KEY (conductor's documented var). The
// clients already treat the two as interchangeable fallbacks.
if (!process.env.SUPABASE_ANON_KEY && process.env.PUBLIC_SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
}
```

Decisions embedded here, stated explicitly:

- **D1. Gate name `LOCAL_SERVICE_ROLE_FALLBACK=1`.** Follows the `SUBSCRIPTION_ONLY=1` sentinel precedent (conductor#223). The name says exactly what it grants — not a vague `CONDUCTOR_LOCAL_DEV` that invites unrelated behavior accreting onto it.
- **D2. The run-token alias is gated; the anon-key alias is not.** The anon key is non-secret, the two names are already interchangeable inside every client, and an ungated shim removes one entire class of preflight failure with zero security delta. The run-token alias changes effective privilege and must be a deliberate opt-in.
- **D3. Never override.** The alias fires only when `SUPABASE_RUN_TOKEN` is absent. Cloud sandboxes always receive a substation-minted token, so even a sentinel leaking into a sandbox env is a no-op. This is the second of three independent cloud-safety layers (see below).
- **D4. Refuse under `ENVIRONMENT=production`.** Belt-and-braces; `index.ts` already branches on this var (line 183).
- **D5. Loud one-line warning, once, at bootstrap.** Operators must be able to tell from any run log whether it ran as `service_role` or as a scoped token. Not repeated per-step (noise).
- **D6. Placement in `index.ts` (CLI bootstrap), not `engine.ts`.** Programmatic consumers of `runWorkflow()` (substation's sandbox invocation path) get no alias behavior unless the CLI is the entry point AND the sentinel is set AND no token exists AND not production.

### Change 2 — `.env.example` documentation

Append to the Supabase block of `conductor/.env.example`:

```bash
# --- Local runs only (Sec Wave 9 scoped run tokens) ---
# Cloud runs get a per-run SUPABASE_RUN_TOKEN minted by substation; locally
# there is no minter. Set this sentinel to run local workflows as
# service_role (RLS bypassed — pre-Wave-9 behavior):
LOCAL_SERVICE_ROLE_FALLBACK=1
# Do NOT set SUPABASE_RUN_TOKEN to the publishable (sb_publishable_...) key:
# it authenticates as `anon` and RLS silently returns EMPTY reads — runs
# "succeed" with garbage instead of failing.
```

### Change 3 — tests

Unit tests alongside the existing env suites (`tests/env-allowlist.test.ts` precedent). The alias logic should be extracted into a small exported function (e.g. `applyLocalDevEnvFallbacks(env)`) in `src/shared/` so it's testable without spawning the CLI:

1. Sentinel set + token absent + service key present → token aliased, warning emitted.
2. Sentinel set + token **present** → untouched (cloud-safety: never override).
3. Sentinel absent → untouched, regardless of other vars.
4. Sentinel set + `ENVIRONMENT=production` → refused.
5. Anon-key shim: `SUPABASE_ANON_KEY` set from `PUBLIC_SUPABASE_ANON_KEY` only when absent; never gated on the sentinel.
6. Regression pin: `buildChildEnv()` still forwards the aliased `SUPABASE_RUN_TOKEN` to a step that declares it, and still hard-excludes `SUPABASE_SERVICE_ROLE_KEY` — i.e. the alias composes with, and does not weaken, Wave 9's child-env guarantees.

## Cloud-safety analysis

Three independent layers, any one of which prevents the fallback from changing cloud behavior:

1. **Sentinel absent in sandboxes.** Substation's per-workflow env allow-list (substation#142, `src/inngest/lib/env.ts`) controls exactly what enters a sandbox; `LOCAL_SERVICE_ROLE_FALLBACK` is not in it and this spec adds it nowhere.
2. **Token always present in sandboxes.** Substation injects a minted `SUPABASE_RUN_TOKEN` into every migrated run's env; D3's absent-only guard makes the alias a structural no-op there.
3. **Key absent in sandboxes.** Round 2 (substation#147) removed `SUPABASE_SERVICE_ROLE_KEY` from sandbox admission entirely — there is nothing to alias even if layers 1-2 both failed.

What this change deliberately does **not** weaken: `child-env.ts`'s hard-block on the `SUPABASE_SERVICE_ROLE_KEY` name is untouched; the preflight is untouched; no client gains a fallback branch; bureau and substation are untouched.

The honest cost: a local operator running with the sentinel bypasses RLS, so local runs cannot catch Wave 9 RLS-policy regressions. That is identical to all pre-Wave-9 local behavior and is the explicit trade of Option A; Option B (local mint script) is the named follow-up if local RLS fidelity becomes wanted.

## Scope boundaries

- **No bureau changes.** Workflow `requiredEnv` declarations stay exactly as bureau#574 landed them.
- **No substation changes.** Minting, allow-lists, and the sandbox baseline are untouched.
- **No Library handling.** `train` still uses `LIBRARY_SUPABASE_SERVICE_ROLE_KEY` directly (Wave 9 descoped Library; ES256-only project can't take HS256 tokens). Out of scope here too.
- **Options B/C deferred**, not rejected: B when local RLS testing is wanted; C if local operation ever extends beyond one trusted dev.
- **`local-run` skill (noetic-tools plugin)** may want a one-line mention of the sentinel; tracked as a follow-up outside this conductor PR.

## Open questions

- **Q1.** Should the sentinel additionally require a TTY / absence of `SANDBOX_ID` (`index.ts:384` shows sandboxes pass `--sandbox-id`) as a fourth cloud-safety layer, or is three layers plus D4 enough? (Recommend: enough — more predicates means more ways for local dev to mysteriously not work.)
- **Q2.** Is the unconditional anon-key shim (D2) acceptable to DSD, or should it also sit behind the sentinel for auditability? (Recommend: unconditional — it's a pure name-convention bridge for a non-secret; gating it re-creates the confusing "preflight wants a name my .env doesn't use" failure for everyone.)
- **Q3.** Warning destination: `console.warn` only, or also a structured log event (`docs/structured-events.md` convention, e.g. `env.local_service_role_fallback`) so BetterStack could detect the sentinel ever firing outside a laptop? (Recommend: both — the structured event is cheap and turns layer-failure into an alertable signal.)
- **Q4.** Wave 9 is DSD's work. Does DSD want to own/land this, or review a PR cut from this spec? Either way this spec should be flagged to them before implementation.

## Verification plan

1. Unit tests above, green.
2. Remove the manual workaround lines from `conductor/.env` (the two hand-copied vars), set `LOCAL_SERVICE_ROLE_FALLBACK=1`, run a local CRC (or the cheapest migrated workflow) end-to-end: preflight passes, `fetch-crc-guides` downloads a non-empty guide set, warning line appears exactly once in the log.
3. Negative test: unset the sentinel, confirm the preflight fails with the missing-env error naming `SUPABASE_RUN_TOKEN` (i.e. the default is still fail-closed).
4. Grep the substation allow-list to confirm `LOCAL_SERVICE_ROLE_FALLBACK` is not admitted to sandboxes.
