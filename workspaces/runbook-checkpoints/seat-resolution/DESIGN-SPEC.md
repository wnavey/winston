# Seat resolution — spending the right person's subscription account on a cloud run

**Status:** Draft v11 (consolidated for implementation)
**Date:** 2026-09-22
**Repos touched:** `substation` (the `subscription_seat` and `personal_api_key` tables, a `seat` column on `runbook_runs`, sealing the stored token, the `/api/seats` routes, personal-key auth, resolution and ownership enforcement at launch, recording who launched a run, the per-pass token fetch), `cityhall` (one signed-in page where a person creates their own API key), `conductor2` (`init` sends the operator's identity and, for a cloud subscription run, the personal key), `claude-plugins` (the `register-seat` skill and its upload script), `bureau` (nothing beyond what `../cloud-captain/` already names)
**Repos NOT touched:** `dsd` — the skill reads `dsd.conf`; dsd gains no command
**Manual steps:** one — `SEAT_TOKEN_KEY` set on substation's Vercel environment before the code that reads it deploys (§3.1)
**Sibling:** `../cloud-captain/DESIGN-SPEC.md`. That spec's **D10** (a per-run `claude_code_oauth_token` on the launch body, stored in `runbook_run_secret`) is the shipped interim this replaces; its **D12** (fall back to the shared token) is closed for cloud subscription runs by this spec's D13, and D10 itself is retired by D15.

> This version consolidates v1–v10 into one implementation-ready document. Decision numbers D1–D16 are stable because `../cloud-captain/` cites them; the change history is in the commits of winston#272. Open questions were renumbered here.

## Problem

A cloud run that bills a subscription account spends **substation's single shared `CLAUDE_CODE_OAUTH_TOKEN`** (`substation/src/lib/runbook/env.ts`, admitted only when `billing === 'subscription'`). There is exactly one, it belongs to whoever configured it, and every cloud subscription run lands on it.

`bureau/docs/runbooks.md` forbids that in two rules:

> **Subscription accounts are never shared.** Each Noetic employee has their own subscription account(s) and they are only used by those employees. (`:74`)

> **Cloud runs also default to subscription** but they can use metered spend when we are running a lot of runs in a single week. When using subscription accounts the run can only use the accounts owned by the user requesting the run. (`:76`)

The second rule was written by bureau#1676 (merged 2026-09-21). substation has not followed it: `defaultBilling()` in `substation/src/routes/runs.ts` still defaults a cloud run to `metered`, deliberately, because flipping it would funnel every cloud run onto the one shared token. So the documented default is ahead of the mechanism, and this spec is the mechanism.

**What exists today.** `../cloud-captain/` D10 lets a caller pass `claude_code_oauth_token` on `POST /api/runs`; substation stores it in `runbook_run_secret` (migration `20260921200000`) and `buildLaunchEnv` re-reads it at every pass. The caller supplies their *own* seat, so `:74` is satisfied, but it is a manual credential hand-off per run rather than resolution, it records no alias (so nothing can say which account paid), and it has never been used — **every cloud run in prod to date is metered** (`mgxqsrjutswbciyrltwd`, checked 2026-09-22).

The local lane has no such problem: `dsd seat pick` resolves the operator's own account from their machine's config. The cloud lane has no equivalent, and the local mechanism does not port (§2).

## 1. Scope

**In:** a registry mapping a person to their subscription accounts and a usable cloud credential; a launch that proves who is launching; resolution at launch from that identity; naming an account explicitly at launch; refusing an account the requester does not own; what happens when nothing resolves; retiring the interim.

**Out:** the captain itself (`../cloud-captain/`); the cloud billing default flip (that spec's D6 — it flips when this ships); metered runs (unaffected — a metered run must never carry a seat credential, and `env.ts` already strips it); per-step seat spreading in the cloud (§3.5 explains why the cloud spends one seat per run); usage-aware picking (§3.4).

## 2. How seats work today, and why none of it ports

Researched 2026-09-21 against `dsd` and `conductor2`.

**The account table is a per-machine dotfile.** `~/.config/dsd/dsd.conf`, whose header says "NOT checked in". Two line types:

```
account = <alias> | <config_dir> | <bar color> | <text color>
owner   = <name> <accounts…>
```

So the **alias already exists** as a first-class concept (`max-a`, `max-g`, `will-noetic-inc`), and **owners already map a person to their accounts** — the relation this spec needs, in a file substation cannot read. **The file holds no token anywhere.**

**A seat is a `CLAUDE_CONFIG_DIR`, not a token.** The account's `config_dir` holds a logged-in Claude Code session. conductor2 concurs (`src/claude.rs`, `on_seat`): a mounted seat is how a container is seated, and `retarget` withholds the token from any box with a seat mounted.

**`dsd seat pick` is a hook contract.** conductor runs `CONDUCTOR_SEAT_CMD` once per agent step and reads the first line of stdout:

| stdout | meaning |
|---|---|
| a path | the seat's config dir |
| `-` | unset the seat variable — the org seat |
| empty | no opinion; inherit |

Exit `0` = picked; exit **`75` = no seat available → park the step**. Precedence for who names the seat: `--seat <account>` → the step's runner preset `seat:` (one account, or a pool a fan-out spreads across) → the hook. The name reaches the hook as `CONDUCTOR_SEAT`.

**Bookkeeping is filesystem-local.** Leases at `<cache>/seats/<account>.<pid>.<uniq>`, ended by pid death or a deadline. Usage snapshots at `<cache>/usage-snapshots/<account>.json`, produced by `dsd usage` running `claude -p "/usage"` per account (`dsd/launcher/src/usage/probe.rs`). There is no server-side usage endpoint.

**Why it does not port.** The table is a dotfile on one machine. A seat is a directory of credentials on that machine, and a Vercel Sandbox has neither. Cloud already consumes a *token*. Leases and usage are per-machine files, so nothing coordinates two cloud runs.

**What does port: the contract.** conductor's precedence chain, the `CONDUCTOR_SEAT` name, and exit-75-parks-the-step all stay. This spec supplies a cloud implementation behind the same seam.

## 3. Design

### 3.1 The registry — `subscription_seat` (D1, D16)

A service-role-only table. The name uses the `seat` vocabulary dsd and conductor already use and deliberately takes no `runbook_` prefix: the registry outlives any run.

| column | type | notes |
|---|---|---|
| `alias` | `text` PK | `max-a`, `will-noetic-inc` — the same names `dsd.conf` uses, so one vocabulary across lanes. Charset `[A-Za-z0-9._-]` |
| `owner_user_id` | `uuid` FK → `auth.users` NOT NULL | the relation `dsd.conf`'s `owner =` lines encode locally |
| `claude_code_oauth_token` | `text` NOT NULL | the token from `claude setup-token` (§3.2), **stored sealed** (below) — the column holds ciphertext only substation can open |
| `active` | `boolean` default true | a seat can be retired without losing its history |
| `created_at`, `updated_at`, `last_verified_at` | `timestamptz` | `last_verified_at` is null until Q3 gives it a meaning |

**Access model — copy `20260921200000_runbook_run_secret.sql` exactly:** RLS enabled with **no policy at all**; `REVOKE ALL … FROM PUBLIC, anon, authenticated, workflow_run`; `GRANT ALL … TO service_role`; **not** added to `supabase_realtime`. `workflow_run` is the role the sandbox's `SUPABASE_RUN_TOKEN` assumes and is named explicitly because it holds broad grants elsewhere.

That denies the console, a noetic member's JWT, and the sandbox. It does **not** make substation the only reader. These all read the column in plaintext, as `service_role` or from underneath the database:

| reader | how |
|---|---|
| the Supabase dashboard | SQL editor and table editor, for anyone with dashboard access |
| the Supabase MCP | `execute_sql` runs as `service_role`, and it is loaded in teammates' Claude Code sessions, whose transcripts are plaintext JSONL on disk |
| operator laptops | `SUPABASE_SERVICE_ROLE_KEY` is on every operator machine for `conductor init` (`../conductor-init/` D4) |
| backups | every PITR snapshot and `pg_dump` |

`runbook_run_secret` tolerates that exposure correctly: a run secret is deleted at terminal status, so the window is hours. A seat token is a person's account for a **year** (§3.2), and the only revocation path is a human in a browser. So:

**D16 — the column holds ciphertext, and only substation holds the key.**

- **Algorithm:** AES-256-GCM, random 12-byte IV per seal, stored as one string `v1.<iv>.<tag>.<ciphertext>` (base64). GCM fails closed on tampering, so a corrupted row is a failed pass, never a wrong token. The `v1.` prefix lets the key or algorithm rotate later without a second column.
- **Key:** `SEAT_TOKEN_KEY`, 32 bytes base64, in substation's environment and nowhere else — the same discipline `RUN_CALLBACK_SECRET` (`substation/src/lib/run-bearer.ts`) and `SUPABASE_JWT_SECRET` (`run-token.ts`) already follow. Unset, the code throws, as `mintRunBearer` does. A registry that cannot seal refuses at `PUT /api/seats/:alias`, not at the pass.
- **Code:** one new module, `substation/src/lib/seat-crypto.ts` — `sealSeatToken(plain)` and `openSeatToken(sealed)`, about forty lines plus tests (round trip, tamper detection, missing key throws). Two call sites: `PUT /api/seats/:alias` seals before its upsert (§3.3); the resolver in `buildLaunchEnv` opens after its select (§3.5). Nothing else touches the column.
- **The one manual step.** `openssl rand -base64 32`, then `SEAT_TOKEN_KEY` into substation's production Vercel environment and each operator's local `substation/.env`. Vercel functions pick up environment changes on the next deploy, so **the variable lands before the PR that reads it deploys.** Whether preview deployments need it is Q4.
- **Accepted consequences.** Losing the key means every seat is re-registered (a re-run of the skill per person; a fresh `setup-token` is what one would mint anyway). Rotating the key is a small reseal pass or the same re-registration.
- **Not Supabase Vault:** `vault.decrypted_secrets` is readable by `service_role`, so every reader in the table above still gets plaintext. **Not retrofitted to `runbook_run_secret`:** D15 deletes it. **The wire is unchanged:** the skill uploads plaintext over TLS and substation seals it, because a key on every laptop is the shared-secret shape D8 exists to end.

`GET /api/seats` reports "whether a token is present" as a null check, never a decrypt (§3.3).

### 3.2 Where a token comes from

A per-account cloud credential is minted with **`claude setup-token`** ("Set up a long-lived authentication token (requires Claude subscription)") run with `CLAUDE_CONFIG_DIR` pointed at that account's directory. Nothing is extracted from a seat; a token is minted beside one, by the human who owns it. The token is long-lived (one year), and `setup-token` is mint-only — there is no CLI list or revoke (anthropics/claude-code#48373). The stored form is exactly this token, injected where `env.ts` injects the shared one today, so the injection path, the subscription gating and the "a metered run must never carry it" rule are all reused.

**A token does not say whose account it is.** dsd's `/usage` probe returns the alias it was passed, not one the account reported. So the alias attached at registration is **asserted by the person registering**; D8 enforces that the row is *theirs*, and nothing can check *which* of their accounts a given token is. Getting that wrong is an accounting error inside one's own seats, not a cross-person one. Q3 is an optional way to get evidence.

### 3.3 Populating the registry — the `register-seat` skill and `/api/seats` (D10, D11)

Registering a seat is rare, per-account, and has a browser step in the middle — the shape a Claude Code skill is good at. **D10: a shared `register-seat` skill in `claude-plugins`, one account at a time.** dsd gains nothing; the skill *reads* `dsd.conf` for the alias list.

**Three substation routes**, authenticated with `SUBSTATION_PERSONAL_API_KEY` (§3.4b) and scoped to the caller's own `owner_user_id`, so a person can only ever see and write their own seats:

| route | does | returns |
|---|---|---|
| `GET /api/seats` | list my seats | alias, `active`, whether a token is present, `created_at`, `last_verified_at` — **never the token** |
| `PUT /api/seats/:alias` | register or rotate my seat's token (body `{ claude_code_oauth_token }`) — seals with D16, upserts | confirmation only |
| `DELETE /api/seats/:alias` | retire a seat (`active = false`) | — |

**Step 0.** The skill checks for `SUBSTATION_PERSONAL_API_KEY` and, when absent, sends the operator to cityhall to mint one and stops (§3.4b). Without this the first call 401s and the error describes the wrong problem.

**The loop.** For each `account =` row in `dsd.conf` — **every row, with no filtering** — the skill states whether a token is registered and when it was last verified, then offers: **do nothing · supply a token you already have · mint a new one**. Not dsd's own `owner =` ∩ `seat_allow` intersection: on this fleet a personally-named account (`will-navey-personal`) is used for company spending, so inferring policy from a name or a local allowlist would hide a seat its owner wants. The operator chooses; the skill infers nothing.

**The credential moves around the agent, never through it.** Transcripts are plaintext JSONL on disk; `with-secrets` exists because on 2026-09-17 a session read a token file, a shell error echoed it into the transcript, and the token had to be rotated. So "paste it in the chat" and "run `setup-token` in the session" (it prints the token to stdout) are both ruled out. The token is staged in a file the skill *names but never opens*:

```
~/.noetic-seat-tokens/<alias>          # dir 700, files 600
```

- **Supply one you have** → the operator writes the token into that path themselves: one line, raw value, no `KEY=` prefix, no quotes; the script trims whitespace.
- **Mint a new one** → `CLAUDE_CONFIG_DIR=<account dir> claude setup-token > ~/.noetic-seat-tokens/<alias>` (Q2: if `setup-token` needs a TTY, this is a copy-paste into the file instead; the design is unchanged).

Both paths converge on one upload: the script reads the file, calls `PUT /api/seats/:alias`, and **deletes the file on success**. The transcript holds the path, the command and `registered seat <alias>` — never a value.

Five rules the script and skill carry:

1. **The staging directory is outside `~/.config/ida/`.** The guard hook denies any tool call that *names* a file there, and the skill must name this one. (That folder exists on some machines and not others, which is also why the skill cannot assume where an existing token lives.)
2. **The skill never reads the file** — no `cat`, `head`, `grep`, `echo`. An agent's instinct after asking for a file is to check it; that instinct is the leak. `test -f` for existence, `wc -c` for a byte count, `stat` for permissions.
3. **The filename must match the `--alias` being uploaded.** This is the one check that catches writing `max-g`'s token into the slot uploaded as `max-a`; nothing downstream would ever reveal the swap.
4. **The alias is validated against `[A-Za-z0-9._-]` before it is interpolated into a path.** One containing `/` or `..` turns a filename into path traversal.
5. **The file is deleted on success, and the script refuses a world-readable one.** Otherwise a token in a transcript has been traded for a token sitting in `$HOME` indefinitely.

Because the path carries the alias, an operator with several accounts can stage them all in advance and the skill can upload what it finds in one pass.

**D11 — a launch that resolves a seat with no registered token is refused by name.** `POST /api/runs` answers `seat_not_registered`, naming the alias and pointing at the skill. `runs.ts` already refuses in this register (`no_project_for_subscription`, `no_subscription_seat` both name the field and list the ways out); this is what makes the feature discoverable.

### 3.4 Identity — who is launching, and how they prove it

#### 3.4a The run records who launched it (D7)

`runbook_runs.triggered_by` (`uuid` FK → `auth.users`, added by `20260909000000_reconcile_runbook_control_plane.sql`) is **NULL on every row in prod**: the insert in `substation/src/routes/runs.ts` omits it, even though `authMiddleware` has already resolved an identity by then.

**D7 — `POST /api/runs` writes the acting identity to `triggered_by`.** Three pieces, none a new auth concept:

| | change | where |
|---|---|---|
| a | `conductor init` sends `x-on-behalf-of: <operator's user id>` beside the credential it already sends | `conductor2/src/init.rs`, `register()` |
| b | the route resolves the acting user, dropping the bare-service sentinels | `substation/src/routes/runs.ts`, reusing the `SERVICE_SENTINELS` / `actingUserId` pattern at `runbook-hitl-questions.ts:61-66` |
| c | the insert writes `triggered_by` | the `.insert({…})` in `runs.ts` |

`authMiddleware` already resolves `x-on-behalf-of` into `user.id` on the service-role path (`substation/src/middleware/auth.ts:80`). A bare service call (`user.id` of `service` or `substation-service-api-key`) records NULL, which is the honest value.

**On its own this is attribution, not authorization.** `x-on-behalf-of` is believed because the caller holds `SUPABASE_SERVICE_ROLE_KEY`, a credential strictly more powerful than the thing being gated — anything holding it can write `runbook_runs` directly. So for metered and local launches, which keep the shared credentials, `triggered_by` is self-asserted and D5 is mistake-prevention. For cloud subscription launches, §3.4b makes it real.

#### 3.4b The credential that proves it — `SUBSTATION_PERSONAL_API_KEY` (D8)

**D8 — a cloud subscription launch authenticates with a per-user substation API key.** It is the identity D5 enforces against and D7 records, and the `/api/seats` routes are scoped by it.

**It is substation's own credential, not Supabase's.** There is one Supabase service-role key per project and it bypasses RLS by definition; a per-user JWT signed with `role: service_role` would bypass RLS too and gate nothing. D8 is a key substation issues, stores hashed, and owns.

**New table `personal_api_key`:** `id uuid`, `user_id` FK → `auth.users`, `key_hash text`, `label text`, `created_at`, `last_used_at`, `revoked_at`. Service-role only, same access model as §3.1. The key itself is shown once at creation; substation stores only a hash, so a database leak hands out no working keys.

**Lifetime: no expiry, revocable, `last_used_at` maintained.** A stolen key can launch runs as that person and burn that person's window; it cannot read any seat's token, because the key is accepted only on the allowlisted routes below. Revocation recovers that; an expiring credential would fail a runbook at 2am for no proportionate gain.

**Creation is self-service in cityhall, signed in.** cityhall already authenticates the person through SSO and calls substation as them (`substationGet(path, token)`, `cityhall/src/lib/server/substation.ts`). New substation routes `GET /api/personal-keys`, `POST /api/personal-keys` (returns the key once), `DELETE /api/personal-keys/:id`, all deriving `user_id` from the caller's JWT — **a person can only ever mint their own key, enforced rather than asserted.** One cityhall page lists, creates and revokes.

**Delivery: the operator's machine, never substation's environment.** The key lives in the operator's `~/.env` (which conductor and dsd already source) and travels as `Authorization: Bearer <key>` — the header arm `authMiddleware` already has. In `authMiddleware`, alongside the `SUBSTATION_SERVICE_API_KEY` string compare, a personal key is looked up by hash in `personal_api_key` (`revoked_at IS NULL`), yields `{ user: { id: user_id }, isServiceRole: false, viaPersonalKey: true }`, and is accepted **only** for routes in a `PERSONAL_API_ROUTES` allowlist: `POST /api/runs`, `GET /api/seats`, `PUT /api/seats/:alias`, `DELETE /api/seats/:alias`. Same shape as `SERVICE_API_ROUTES`. Update `last_used_at` on success.

**It is needed on exactly one call.**

| call | credential |
|---|---|
| `POST /api/runs` — the launch | **`SUBSTATION_PERSONAL_API_KEY`** — the only call that decides which seat gets spent |
| everything the sandbox then does | the per-run bearer substation mints (`../sandbox-api-tokens/`) |
| answering a HITL question | the console's signed-in session |

So the personal key **never enters the sandbox**. `conductor init` sends it (instead of `x-service-role-key`) when the run it is registering is `host=vercel, billing=subscription`; every other launch is unchanged.

**The refusal is the control.** A launch that is `host === 'vercel' && billing === 'subscription'` is **refused with 403 `personal_key_required`** when it authenticated with `x-service-role-key` or the shared `SUBSTATION_SERVICE_API_KEY`. A user JWT (cityhall) is a person and is accepted. Without the refusal, D8 is advisory and the old credential is a bypass. It sits beside the two existing cloud-only guards in `runs.ts`, for the reason their comments give: refusing at the door costs one field on this request; discovering it later costs a sandbox boot.

**Scope: cloud subscription only.** Both existing subscription guards are cloud-only, and that scoping is what made the local default flip possible (substation#286). Metered launches keep `SUBSTATION_SERVICE_API_KEY` / `x-service-role-key`; local runs are untouched, because **substation is not the one spending** there — the seat is a directory on the operator's machine, `dsd seat pick` chooses it, and an operator cannot reach a colleague's account because that login is not on their machine. Cloud is the opposite: the sandbox has no logins, so substation must hand it a token, which means substation must choose *whose*. That choice is what needs to know who you are.

**Naming.** `SUBSTATION_PERSONAL_API_KEY` pairs with `SUBSTATION_SERVICE_API_KEY` — personal vs service, yours vs shared. Not named for subscription billing: the key identifies a person, and the same key registers seats.

### 3.5 Resolution at launch (D2, D3, D4, D5, D12, D13, D14)

**D2 — resolution happens in substation, in `POST /api/runs`, before any sandbox exists.** A problem is reported with nothing spent. `runbook_runs` gains a **`seat text` column** (nullable; the alias, not the token). Resolution runs for every `host=vercel, billing=subscription` launch and nowhere else.

**Order of precedence**, mirroring conductor's:

1. **`seat` named on the body (D3)** — an optional alias, validated to be an `active` row in `subscription_seat` whose `owner_user_id` is the acting user. "Run this on `max-g`" means the same thing locally and in the cloud.
2. **else the acting user's `active` seat with the fewest runs in flight (D12).** One query:

   ```sql
   select s.alias, count(r.id) as in_flight
   from subscription_seat s
   left join runbook_runs r on r.seat = s.alias and r.status in ('queued', 'running')
   where s.owner_user_id = $acting_user and s.active
   group by s.alias
   order by in_flight asc, s.alias asc
   limit 1
   ```

   `parked` does not count: a parked run is waiting on a human and spending nothing. Ties break on alias so the choice is stable and testable.
3. **else nothing resolves → D4.**

The chosen alias is written to `runbook_runs.seat` and passed into the sandbox as `CONDUCTOR_SEAT` (§3.6), so `seat_exhausted` callbacks can name the account.

**D5 — ownership is enforced, not documented.** A `seat` alias whose `owner_user_id` is not the acting user is refused: 403 `seat_not_owned`, naming the alias. **D14 — there is no exception**: no admin override, no org seat. Registration is self-service, so an account someone cannot register is one that is not theirs, which is precisely the case `:74` describes. One rule, no exception path, nothing to audit.

**D13 — the shared `CLAUDE_CODE_OAUTH_TOKEN` is not a fallback for a cloud subscription run.** Today `runs.ts` admits a cloud subscription launch with no per-run token whenever that variable is set (`../cloud-captain/` D12). With the registry that makes registration optional and D8 bypassable by never registering. So for `host=vercel, billing=subscription`, an acting user with no registered active seat gets **D11's `seat_not_registered`**, and the shared token is not consulted. The `no_subscription_seat` guard is replaced by this. (`../cloud-captain/` D12 stands wherever else it applies, until D15 removes the path entirely.)

**D4 — when nothing resolves, an `operator` HITL question against the run offers continue metered or cancel.** Cancel sets the run `cancelled`, which exists in the status enum for exactly this — a human's decision, not a malfunction. The stated rationale: failing the launch outright is the wrong shape, because the work still needs doing and a billing-lane lookup is not a reason to lose a queued run.

> **Q5 — D4 and D11 both claim the "no seat" case at the door and disagree.** D11 (and D13, which says D11's refusal wins over the shared token) answers `POST /api/runs` with `seat_not_registered`; D4 says never fail the launch, open a gate instead. With the registry, "no registered token" and "nothing resolves" are the same condition, so an implementer has to pick. See §5.

**D12 deliberately does not:** wait when every seat is busy (it picks the least-loaded), count consumption rather than runs (a seat carrying one review looks emptier than one carrying two `smoke` runs — real headroom needs the usage board, which is a client-side probe with no server endpoint), or protect against a deliberate overdraw (four runs on two seats will exhaust them; runbooks cost tokens and the people launching them know it). No `seat_lease` table: leases bring acquire/release/deadline/reaper, and local leases end on pid death, which substation cannot observe. **Their absence is the decision.** Motivation: 10 of 27 `runbook_runs` were non-terminal on 2026-09-22 with at least one overlapping pair, and a deterministic "first active seat" rule makes two back-to-back launches *always* share one seat and stall on the same 429.

### 3.6 Fetching the token, per pass (D9)

**D9 — the seat's token is resolved fresh on every pass, from `subscription_seat`, keyed by `runbook_runs.seat`.** It is never copied into a per-run row.

```
substation/src/lib/reconcile-loop.ts:416  →  buildLaunchEnv()  →  buildRunbookEnv()  →  env on sandbox.runCommand
      (substation's cron, once per pass)        launch.ts:71        env.ts
```

`buildLaunchEnv` already reads the run's seat at each pass with the service-role client, and its own comment gives the reason: park-and-exit rebuilds the environment every time, "including the resume that happens after a human answers a gate, days later. A seat supplied once and not re-read is a subscription run that cannot survive its own gate." So the change is **the source**: where it calls `getRunSecret(runId)` today, it selects `claude_code_oauth_token` from `subscription_seat` where `alias = run.seat`, calls `openSeatToken` (D16), and passes the result as `subscriptionToken`. `buildLaunchEnv` therefore takes `seat` in its inputs; the reconcile loop has it on the `run` row.

**Why fresh.** Re-issue a seat's token — a rotation, a re-auth — and every parked run holding a frozen copy fires `../cloud-captain/` D11's expired-token gate for a cause we created. Resolving fresh heals them with no operator action, and the credential exists in one sealed row.

**A read that fails stops the pass.** As `getRunSecret` does today: an unreadable seat must not fall back to the shared token (D13) or to metered (`../cloud-captain/` D13).

**Transitional precedence.** While `runbook_run_secret` exists, a per-run token wins over the registry, so a one-off run on an unregistered seat keeps working. D15 deletes that branch.

**The sandbox cannot read the table, by construction.** Its `SUPABASE_RUN_TOKEN` assumes `workflow_run`, which §3.1 revokes. The only path in is substation writing the environment. That is also why **the cloud spends one seat per run**: one token is injected per pass and every agent step inside it inherits it. The local lane spends one per *step* via `CONDUCTOR_SEAT_CMD`; the sandbox sets no such hook, and giving it one means the sandbox asking substation for a seat *during* a run, which is out of scope. `CONDUCTOR_SEAT=<alias>` is set in the env so conductor's `seat_exhausted` reporting can name the account.

### 3.7 Retiring the interim (D15) — the last step

**D15 — `../cloud-captain/` D10's per-run token path is removed once the registry is proven.** Gated on a fact, not a date: **the first registry-resolved cloud subscription run that completes end to end.** No cloud subscription run has ever happened, so until then D10 is the only proven path and the registry is the unproven one; retiring a working mechanism before its replacement has run once leaves the lane with neither.

**What goes:**

| | where |
|---|---|
| `claude_code_oauth_token` on the `POST /api/runs` body and the metered-with-token guard | `substation/src/routes/runs.ts` |
| the `no_subscription_seat` guard's per-run-token arm (D11/D13 supersede it) | `substation/src/routes/runs.ts` |
| `putRunSecret` / `getRunSecret` / `deleteRunSecret` and their call sites | `substation/src/lib/control-plane.ts`, `runs.ts`, `reconcile-loop.ts` |
| the `runbook_run_secret` table | a migration dropping it |
| the per-run-token precedence branch | `substation/src/lib/runbook/launch.ts` |

**Why.** A raw token on the body carries no alias, so D5 has nothing to check and nothing records which account paid. Two paths to one outcome is how a rule and a record both end up with a hole.

### 3.8 Implementation order

| # | what | repo | notes |
|---|---|---|---|
| 1 | Set `SEAT_TOKEN_KEY` on substation's Vercel env (§3.1) | ops | **before** #2 deploys |
| 2 | Migration: `subscription_seat`, `personal_api_key`, `runbook_runs.seat`. `seat-crypto.ts` + tests | substation | copy `20260921200000`'s access model for both tables |
| 3 | `authMiddleware`: personal-key lookup + `PERSONAL_API_ROUTES`; `personal-keys` routes; `/api/seats` routes | substation | seats routes seal on write, never return the token |
| 4 | `POST /api/runs`: write `triggered_by` (D7); `personal_key_required` refusal (D8); `seat` on the body (D3); resolution + `seat_not_owned` + `seat_not_registered` (D5, D11, D12, D13); write `runbook_runs.seat` | substation | cloud + subscription only; metered and local unchanged |
| 5 | `buildLaunchEnv`: resolve from `subscription_seat` by `run.seat`, open the seal, set `CONDUCTOR_SEAT` (D9) | substation | per-run token still wins while `runbook_run_secret` exists |
| 6 | Personal API key page | cityhall | after #3 deploys |
| 7 | `conductor init`: send `x-on-behalf-of`; send the personal key for a cloud subscription run; accept `--seat` and pass it on the body | conductor2 | after #4 deploys |
| 8 | `register-seat` skill + upload script (§3.3) | claude-plugins | after #3 deploys |
| 9 | Flip `defaultBilling('vercel')` to `subscription` (`../cloud-captain/` D6) | substation | after one registry-resolved run succeeds |
| 10 | D15: delete the interim | substation | after #9 |

## 4. Decisions

- **D1** — A service-role-only registry table, **`subscription_seat`**, keyed by alias, owned by a user, its credential column `claude_code_oauth_token` held sealed (D16). RLS enabled, no policy; `workflow_run` revoked. (§3.1)
- **D2** — Resolution happens in substation at `POST /api/runs`, before a sandbox exists. (§3.5)
- **D3** — `POST /api/runs` takes an optional `seat` alias, stored on `runbook_runs.seat`, passed into the sandbox as `CONDUCTOR_SEAT`; it beats the lookup. (§3.5)
- **D4** — Nothing resolves ⇒ an `operator` gate offering metered or cancel; never a failed launch. **Conflicts with D11 at the door — see Q5.** (§3.5)
- **D5** — A `seat` alias not owned by the acting user is refused: `seat_not_owned`. Enforced, not documented. (§3.5)
- **D6** — Leases, waiting and usage-aware picking are out of scope; D12 is the whole of spreading. (§3.5)
- **D7** — `POST /api/runs` records the acting identity as `runbook_runs.triggered_by`: `conductor init` sends `x-on-behalf-of`, the route resolves it with the shipped `SERVICE_SENTINELS` pattern, the insert writes the column. (§3.4a)
- **D8** — A cloud subscription launch authenticates with a per-user substation API key, `SUBSTATION_PERSONAL_API_KEY`: no expiry, revocable, `last_used_at`; minted self-service in cityhall under the person's own SSO session; stored hashed in `personal_api_key`; held on the operator's machine, never in substation's environment; accepted only for `PERSONAL_API_ROUTES`; needed on the launch call alone and never inside the sandbox. **Cloud + subscription + a shared credential ⇒ 403 `personal_key_required`.** Metered and local are untouched. (§3.4b)
- **D9** — The seat's token is resolved fresh from `subscription_seat` on every pass, by `runbook_runs.seat`, in `buildLaunchEnv`, and opened with D16 there. A caller-supplied per-run token wins while `runbook_run_secret` exists. The sandbox receives it as an environment variable and can never read the table. (§3.6)
- **D10** — The registry is populated by a shared `register-seat` skill in `claude-plugins`, one account at a time, through `GET`/`PUT`/`DELETE /api/seats[/:alias]` authenticated by the personal key and scoped to the caller. It reads `dsd.conf` for aliases and offers every account with no filtering; dsd gains no command. The token is staged in `~/.noetic-seat-tokens/<alias>`, which the skill names and never opens, and the script deletes on success. (§3.3)
- **D11** — A launch whose resolved seat has no registered token is refused by name: `seat_not_registered`, pointing at the skill. (§3.3)
- **D12** — Resolution step 2 picks the acting user's `active` seat with the fewest runs in flight (`status in ('queued','running')`; `parked` does not count), ties broken on alias. No `seat_lease` table, no waiting, no headroom awareness, no protection from a deliberate overdraw. (§3.5)
- **D13** — For a cloud subscription run the shared `CLAUDE_CODE_OAUTH_TOKEN` is not a fallback: D11's refusal wins. Amends `../cloud-captain/` D12. (§3.5)
- **D14** — No admin override and no org seat. D5 is absolute. (§3.5)
- **D15** — `../cloud-captain/` D10's per-run token path is removed — the body field, its guards, `runbook_run_secret`, the secret helpers and the precedence branch — once the first registry-resolved cloud subscription run completes end to end. The spec's last step. (§3.7)
- **D16** — `subscription_seat.claude_code_oauth_token` is stored sealed: AES-256-GCM under `SEAT_TOKEN_KEY`, an env-only secret substation alone holds, `v1.`-prefixed. Sealed on the `PUT /api/seats/:alias` write, opened in the D9 resolver, in one module. Not Vault; not retrofitted to `runbook_run_secret`. One manual step: the key on Vercel before the reading code deploys. (§3.1)

*(D2, D4 and D5 originated in `../cloud-captain/` v2 as its D17, D16 and part of §6 and moved here in that spec's v3.)*

## 5. Open questions

- **Q1 — does the registry eventually feed the local lane too?** `dsd.conf` would become the editing surface and the registry its projection, or the registry becomes canonical and `dsd.conf` a cache. Not needed for cloud, but two sources of truth for "who owns which account" is a drift this spec otherwise avoids.
- **Q2 — does `claude setup-token` pipe?** §3.3's mint path redirects its stdout into the staging file. It is a browser auth flow and may require a TTY, in which case minting is a copy-paste into the file. One line of the skill, but test it rather than assume it.
- **Q3 — can a token be verified against the alias it is registered under?** Nothing identifies a token's account (§3.2). One cheap check: probe the token once and compare its 5h/7d readings and reset time against the snapshot `dsd usage` holds for that alias — strong evidence, not proof. Would populate `last_verified_at`. Worth building, or is a mislabel inside one's own seats an acceptable failure?
- **Q4 — do substation preview deployments share production's database?** If so a preview without `SEAT_TOKEN_KEY` cannot resolve a seat, and one with the wrong key fails every cloud subscription pass it drives. Decide before #2 in §3.8 deploys.
- **Q5 — D4 or D11 at the door?** Both were decided in earlier versions and they disagree on the same condition (§3.5). Recommended: **D11 at the door** — `POST /api/runs` refuses `seat_not_registered`, because the operator is present at `conductor init` to read the answer and nothing has been queued yet; **D4 at a later pass** — if the D9 read finds no active seat for a run that already exists (the seat was retired or deleted after launch), open the operator gate rather than fail a run with work behind it. That keeps both decisions' intent and gives each a case that is only its own. Confirm or overrule before #4 in §3.8.
