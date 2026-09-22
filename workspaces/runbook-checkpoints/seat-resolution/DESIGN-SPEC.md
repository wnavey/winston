# Seat resolution — spending the right person's subscription account on a cloud run

**Status:** Draft v5
**Date:** 2026-09-22
**Repos touched:** `substation` (a seat registry to read, resolution at launch, ownership enforcement, recording who launched a run, and per-user API keys), `cityhall` (one signed-in page where a person creates their own key — §3.3b), `conductor2` (`init` sends its credential; §3.3a, §3.3b — its seat hook contract is untouched and is the model this borrows, §2), `dsd` (publish a machine's accounts to the registry), `bureau` (nothing beyond what the captain spec already names)
**Repos NOT touched:** none — this reaches every repo in the launch path, which is what identity costs
**Split from:** `../cloud-captain/DESIGN-SPEC.md` v2 §6. That spec's **D10** (a per-run `claude_code_oauth_token` on the launch body) is the interim that unblocks subscription cloud runs without this one, which is why this is separable.
**Sibling:** `../cloud-captain/DESIGN-SPEC.md`

> **Revision note (v5, 2026-09-22).** Adds **D9** — when and where the seat's token is fetched. D1–D8 and Q1–Q5, Q7 keep their numbers and meaning.
>
> **The seat token is resolved fresh on every pass, from `subscription_seat`, by the alias on the run — not copied into `runbook_run_secret` at launch.** A cloud run parks on a human and can resume days later; a token copied at launch is frozen there, so re-issuing a seat's token strands every parked run holding a dead credential and fires cloud-captain D11's expired-token gate for a reason we created ourselves. Fresh resolution heals those runs automatically, and the credential stays in one place instead of being copied per run.
>
> **This is already the shape of what shipped** — `buildLaunchEnv` (`substation/src/lib/runbook/launch.ts:71`, called from `reconcile-loop.ts:416`) already reads the seat at each pass with the service-role client, and the comment above it already argues for exactly this: "A seat supplied once and not re-read is a subscription run that cannot survive its own gate." **Only the source changes**: `getRunSecret(runId)` reading the per-run copy becomes a lookup in `subscription_seat` by the alias stored on the run. Same function, same timing, same client.
>
> **It is substation's code, never the sandbox's.** The sandbox receives the token as an environment variable and could not fetch it if we wanted it to: its `SUPABASE_RUN_TOKEN` assumes the `workflow_run` role, which migration `20260921200000` explicitly revokes from `runbook_run_secret` and which `subscription_seat` must revoke too. That is also *why the cloud seat is per-run rather than per-step* — one token is injected into the environment at each pass and every agent step inside that pass inherits it, with no equivalent of the local `dsd seat pick` that runs once per step. Closing that is downstream of **Q7** and is not in this spec's v1.
>
> **Revision note (v4, 2026-09-22).** Answers **Q6** with **D8**, a per-user substation API key. D1–D7 and Q1–Q5 keep their numbers and meaning; Q6 is marked RESOLVED and **Q7** is new.
>
> **Why a credential change at all.** D7 records who launched a run from `x-on-behalf-of`, which substation believes *because the caller holds `SUPABASE_SERVICE_ROLE_KEY`*. You cannot gate a caller holding a credential more powerful than the thing being gated — anything with that key can write `runbook_runs` and read `subscription_seat` directly, bypassing the route. So no validation on the header buys anything. The launch has to carry a credential that **is** the person.
>
> **D8 — `SUBSTATION_PERSONAL_API_KEY`, required only for a cloud subscription launch.** Deliberately *not* a replacement for `SUBSTATION_SERVICE_API_KEY`: metered runs keep the shared key and are untouched. The risk being managed is spending a named human's rate-limit window, so the stronger credential is required exactly where that happens and nowhere else. It is purely additive — every cloud run in prod to date is metered, so nothing that launches today starts failing.
>
> **The refusal is the control.** If a cloud subscription launch still accepted the service-role key, D8 would be optional and therefore worthless. So §3.3b states it as a refusal: **cloud + subscription + a shared credential ⇒ 403**. This makes the service-role key able to do *more* on metered and *less* on subscription, which is not reduced privilege but the wrong credential type for an operation that must name a person — recorded so nobody later "fixes" the asymmetry.
>
> **Local runs are untouched, and the reason is the whole design in one line:** a local subscription run does not need identity because **substation is not the one spending**. The seat is a directory on the operator's machine, `dsd seat pick` chooses it, Claude Code logs in with it; substation holds and injects nothing, and an operator cannot reach a colleague's account because that login is not on their machine. Cloud is the opposite — the sandbox has no logins, so substation must hand it a token, which means substation must choose *whose*. That choice is what needs to know who you are.
>
> **One correction to the record:** an earlier framing of this claimed D8 would retire the service-role key from operator laptops and pay down `../conductor-init/` D4's booked debt. Scoped to subscription, it does not — metered launches still send `x-service-role-key`, so the key stays on laptops and that debt stands.
>
> **Revision note (v3, 2026-09-22).** Adds **D7** — the run records who launched it — and says plainly what that does and does not buy. D1–D6 and Q1–Q5 keep their numbers and their meaning.
>
> **The premise D2 and D5 rest on was not true.** Both resolve against `runbook_runs.triggered_by`, and **that column is NULL on all 26 rows in prod** (`mgxqsrjutswbciyrltwd`, checked 2026-09-22, every host and both billing modes). `POST /api/runs` never writes it — the insert in `substation/src/routes/runs.ts` omits the column outright, even though `authMiddleware` has already resolved an identity by then. So v1 and v2 specified a lookup keyed on a value nothing produces. **§3.3a** is new and fixes it.
>
> **The mechanism already exists and is already in production.** `authMiddleware` reads an `x-on-behalf-of` header on the service-role path and sets `user.id` from it (`substation/src/middleware/auth.ts:80`), and `POST /api/runbook-hitl-questions/:id/answer` already uses exactly that to attribute a HITL answer to a real person, distinguishing it from an anonymous service call with a `SERVICE_SENTINELS` set (`substation/src/routes/runbook-hitl-questions.ts:61-66`). D7 reuses that shipped pattern rather than inventing an auth concept: `conductor init` sends one header, the runs insert writes one column.
>
> **What D7 is honestly worth, stated out loud.** `x-on-behalf-of` is trusted *because the caller holds the service-role key*, so the identity is **self-asserted**: the requester supplies both the seat and the person who supposedly owns it. D5 is therefore **mistake-prevention, not an authorization boundary** — and mistake-prevention is what `docs/runbooks.md` is actually asking for, since the failure it describes is an accident ("work simply lands on a colleague's account, and they find it on their own board, already burnt", `dsd.conf.example`). `dsd` on the operator's machine already knows who the operator is, so the header can be filled with the truth without anyone typing it. **The check does not change when the input becomes trustworthy** — a launch carrying a verified user JWT strengthens D5 for free. Closing that gap is **Q6**, new here, and is the next thing to decide.
>
> **Revision note (v2, 2026-09-22).** Naming only — no decision changes, no scope change, and every decision and open question keeps its number.
>
> **The registry table is `subscription_seat`.** v1 described it four times ("a service-role-only Supabase table", D1's "registry table in Supabase") and never named it, which left the reader one inference away from confusing it with `runbook_run_secret` — a *different*, already-shipped table (the captain spec's D10, migration `substation/supabase/migrations/20260921200000_runbook_run_secret.sql`, one row per run, deleted at terminal status). `subscription_seat` is the thing itself, it matches the `seat` vocabulary `dsd` and `conductor` already use, and it deliberately does not take a `runbook_` prefix: the registry outlives any run and is not runbook-scoped.
>
> **`credential` is renamed `claude_code_oauth_token`.** §3.2 already concluded that the stored form is a per-account `CLAUDE_CODE_OAUTH_TOKEN` injected where `env.ts` injects the shared one, so the generic column name only invited a `config_dir`, a refresh token or a session blob to be put there later. The new name matches `runbook_run_secret.claude_code_oauth_token` and the environment variable it becomes — one name for one thing, the same discipline §3.1 already applies to the `alias` vocabulary. **Q1 is unchanged**: naming the column does not say where its value comes from.

## Problem

A cloud run that bills a subscription account spends **substation's single shared `CLAUDE_CODE_OAUTH_TOKEN`** (`substation/src/lib/runbook/env.ts`, admitted only when `billing === 'subscription'`, and `:206` fails the launch when it is unset). There is exactly one, it belongs to whoever configured it, and every cloud subscription run lands on it.

`bureau/docs/runbooks.md` forbids that in two separate rules:

> **Subscription accounts are never shared.** Each Noetic employee has their own subscription account(s) and they are only used by those employees. (`:83`)

> …When using subscription accounts the run can only use the accounts owned by the user requesting the run. (the Cloud runs bullet)

Today this is latent, because cloud runs default to metered and subscription is the exception. **bureau#1676 (open, `jasford-patch-1`, 2026-09-21) changes that**, flipping the rule to "**Cloud runs also default to subscription** but they can use metered spend when we are running a lot of runs in a single week." Once it merges, the documented default puts *every* cloud run on the shared token — so the constitution will contradict itself until this is built.

The local lane has no such problem: `dsd seat pick` resolves the operator's own account from their machine's config. The cloud lane has no equivalent, and the local mechanism does not port (§2).

**Interim:** the captain spec's D10 lets the caller pass a `claude_code_oauth_token` on `POST /api/runs`, stored write-only per run. That is correct — the caller supplies their *own* seat, which satisfies `:83` — but it is a manual credential hand-off per run, not resolution. This spec replaces it with a lookup.

## 1. Scope

**In:** a registry mapping a person to their subscription accounts and a usable cloud credential; resolution at launch from `runbook_runs.triggered_by`; naming an account explicitly at launch; refusing an account the requester does not own; what happens when nothing resolves.

**Out:** the captain itself (`../cloud-captain/`), the billing default flip (that spec's D6), metered runs (unaffected — a metered run must never carry a seat credential, and `env.ts` already strips it).

## 2. How seats work today, and why none of it ports

Researched 2026-09-21 against `dsd` and `conductor2`.

**The account table is a per-machine dotfile.** `~/.config/dsd/dsd.conf`, whose own header says "NOT checked in". Two line types:

```
account = <alias> <config_dir>
owner   = <name> <accounts…>
```

So the **alias already exists** as a first-class concept (`max-a`, `max-g`), and **owners already map a person to their accounts** — the exact relation this spec needs, in a file substation cannot read.

**A seat is a `CLAUDE_CONFIG_DIR`, not a token.** The account's `config_dir` holds a logged-in Claude Code session. conductor2 concurs: "a mounted seat is how a container is seated: `retarget` withholds the token from any box with a seat mounted, so the dir is the only login such a child has" (`src/claude.rs`, `on_seat`).

**`dsd seat pick` is a hook contract, not a library.** conductor runs `CONDUCTOR_SEAT_CMD` once per agent step and reads **the first line of stdout**:

| stdout | meaning |
|---|---|
| a path | the seat's config dir |
| `-` | unset the seat variable — the org seat |
| empty | no opinion; inherit |

with exit `0` picked and **`75` no seat available → park the step**. Precedence for who names the seat: `--seat <account>` → the step's runner preset `seat:` (one account, or a **pool** a fan-out spreads across) → the hook. The name reaches the hook as `CONDUCTOR_SEAT` "because the account table is dsd's".

**Bookkeeping is filesystem-local.** Leases at `<cache>/seats/<account>.<pid>.<uniq>` — one file per live launch, with no release call, ended by pid death or a deadline. Usage at `<cache>/usage-snapshots/<account>.json`, which a pick reads to judge remaining headroom. Plus a pick lock.

**Why it does not port.** The table is a dotfile on one machine. A seat is a directory of credentials on that machine, and a Vercel Sandbox has neither the directory nor the machine. Cloud already uses a *token*, a different credential form. Leases and usage are per-machine files, so nothing coordinates two cloud runs.

**What does port: the contract.** conductor's precedence chain, the `CONDUCTOR_SEAT` name, and exit-75-parks-the-step are all right and stay. This spec supplies a cloud implementation behind the same seam, not a new seam.

## 3. Design

### 3.1 The registry (D1)

A service-role-only Supabase table, **`subscription_seat`**:

| column | notes |
|---|---|
| `alias` | `max-a`, `max-g` — the same names `dsd.conf` uses, so one vocabulary across lanes |
| `owner_user_id` | FK → `auth.users`. The relation `dsd.conf`'s `owner =` lines already encode |
| `claude_code_oauth_token` | the cloud-usable form (§3.2) — the token itself, named for what it is and for the environment variable it becomes |
| `active` | a seat can be retired without losing its history |

RLS enabled, **no read policy at all** — the same shape the captain spec's `runbook_run_secret` uses. Nobody reads it but substation's service-role client.

**`dsd` gains a command to publish a machine's accounts** into it, so `dsd.conf` stays the human-editable source and the registry is its projection. The alternative — substation calling `dsd` as a service — puts a new network dependency in the launch path and is rejected.

### 3.2 The stored form — `claude_code_oauth_token` (Q1)

Local seats are config *directories*; the cloud consumes a *token*. Storing a per-account `CLAUDE_CODE_OAUTH_TOKEN` and injecting it exactly where `env.ts` injects the shared one today is the smallest change — the injection path, the subscription gating, and the "a metered run must never carry it" rule all already exist and are tested.

**Unresolved:** where that token comes from. A `config_dir` is a logged-in session, not a token a human types. Whether one can be extracted from a seat, or must be issued separately per account, is **Q1** and gates this spec's implementation the way seat resolution gates the billing flip.

### 3.3 Resolution (D2, D3)

**D2 — resolution happens in substation, at launch, before any sandbox exists.** The run row exists at that point, so a problem can be reported with nothing spent. Resolving inside the sandbox would mean paying to boot a box before discovering it has nothing to bill.

Order of precedence, mirroring conductor's:

1. `seat` named on the `POST /api/runs` body (**D3** — an optional alias, stored on `runbook_runs`, passed through as `CONDUCTOR_SEAT`)
2. else the first `active` account owned by `triggered_by`
3. else nothing resolves → **D4**

**D3** deliberately reuses the existing alias vocabulary end-to-end, so "run this on `max-g`" means the same thing locally and in the cloud.

### 3.3a Who launched the run (D7)

**D7 — `POST /api/runs` records the acting identity as `runbook_runs.triggered_by`.** Nothing writes it today, so §3.3's step 2 and §3.4's ownership check both resolve against NULL.

Three pieces, none of them a new auth concept:

| | change | where |
|---|---|---|
| a | `conductor init` sends `x-on-behalf-of: <operator's user id>` beside the service-role key it already sends | `conductor2/src/init.rs`, `register()` |
| b | the route resolves the acting user, dropping the bare-service sentinels | `substation/src/routes/runs.ts`, reusing the `SERVICE_SENTINELS` / `actingUserId` pattern from `runbook-hitl-questions.ts:61-66` |
| c | the insert writes `triggered_by` | `substation/src/routes/runs.ts`, the `.insert({…})` that currently omits it |

(b) is the load-bearing one: `authMiddleware` resolves `user.id` from `x-on-behalf-of` already, so a launch that names a person *already* carries that person through to the handler — the route just throws it away. A bare service call (`user.id` of `service` or `substation-service-api-key`) records NULL, which is the honest value and is what **Q3** is about.

**This is attribution, not authorization, and the spec says so rather than implying otherwise.** `x-on-behalf-of` is believed because the caller holds `SUPABASE_SERVICE_ROLE_KEY` — a credential strictly more powerful than the thing being gated, since anything holding it can write `runbook_runs` directly and bypass this route entirely. So a caller can name any person they like. That is acceptable for v1 on a stated threat model: the failure `docs/runbooks.md:83` exists to prevent is **a mistake**, not an attack, and the four people who hold the key are the four people who own the seats. What it is not is a control that survives the team growing, the key leaking, or anyone wanting a real answer to "who spent this window". **Q6** is how that gets closed, and D5's check does not change when it is — only the trust in its input goes up.

### 3.3b The credential that proves it (D8, resolving Q6)

**D8 — a cloud subscription launch authenticates with a per-user substation API key, `SUBSTATION_PERSONAL_API_KEY`.** It is the identity D5 enforces against and D7 records, and it is the only thing in this spec that makes either of them true rather than polite.

**It is substation's own credential, not Supabase's.** There is exactly one Supabase service-role key per project and it bypasses RLS by definition, so a "per-user service-role key" cannot exist; a per-user JWT signed with `role: service_role` would bypass RLS too and gate nothing. D8 is a key substation issues, stores and owns.

**Lifetime: no expiry, revocable, with `last_used_at`.** The blast radius of a stolen key is "launch runs as that person, burning that person's window" — it cannot read any seat's token, because the key stays inside the existing route allowlist (`SERVICE_API_ROUTES`, `substation/src/middleware/auth.ts`). That is recoverable by revoking, whereas an expiring credential fails a runbook at 2am for no proportionate gain. `last_used_at` is what makes a forgotten key visible instead of invisible.

**Creation is self-service in cityhall, signed in.** cityhall already authenticates the person through SSO and already calls substation as them (`substationGet(path, token)`, `cityhall/src/lib/server/substation.ts`), so the route derives the owner from the session — **a person can only ever mint their own key, enforced rather than asserted**. Shown once at creation; substation stores only a hash, so a database leak hands out no working keys. New table `personal_api_key` (`user_id` FK → `auth.users`, `key_hash`, `label`, `created_at`, `last_used_at`, `revoked_at`), service-role only like the other two, with cityhall reading it through substation routes that filter by the session user rather than through an RLS policy of its own.

**Delivery: the operator's machine, never substation's environment.** Today's shared key is an env var on *both* sides — the laptop sends it, substation compares it to its own copy — and that is precisely why there can only be one. D8 inverts that: substation holds a **table**, the laptop holds **your** key, and adding a person is a row rather than a redeploy. On the machine it lives in `~/.env` (which conductor and `dsd` already source) and travels as `Authorization: Bearer <key>` — the same header arm `authMiddleware` already has for the shared key. **Substation's change there is one string comparison against an env var becoming one lookup that returns a user id.**

**It is needed on exactly one call.** A cloud run asks substation "who are you?" once:

| call | credential | why |
|---|---|---|
| `POST /api/runs` — the launch | **`SUBSTATION_PERSONAL_API_KEY`** | the only call that decides which seat gets spent |
| everything the sandbox then does | the per-run bearer substation mints for that run | already built, already scoped to its own run (`../sandbox-api-tokens/`) |
| answering a HITL question | the console's signed-in session | a human clicking a button |

So the personal key **never enters the sandbox**, which is the one place a personal credential should least end up.

**The refusal, which is the actual control.** A launch that is `cloud && billing === 'subscription'` is **refused with 403 when it authenticated with `x-service-role-key` or the shared `SUBSTATION_SERVICE_API_KEY`**. Without that, D8 is advisory and the old credential is a bypass. It belongs beside the two guards already in `substation/src/routes/runs.ts` — `no_project_for_subscription` and `no_subscription_seat` — for the reason their comments already give: refusing at the door costs one field on this request, while discovering it later costs a sandbox boot.

**Scope: cloud subscription only.** Not all subscription runs. Both existing subscription guards are cloud-only, and that scoping is what made the local default flip possible at all (substation#286); a guard that covered local too would 400 every local `smoke` run — the standard local kickoff, projectless, registered by `conductor init` — at the door. §3.3a's `x-on-behalf-of` remains the identity for every other launch, unchanged.

**Naming.** `SUBSTATION_PERSONAL_API_KEY` reads as a deliberate pair with `SUBSTATION_SERVICE_API_KEY` — personal vs. service, which is exactly the yours-vs-shared distinction that matters — and matches the universal "personal access token" convention. `SUBSTATION_API_KEY` is unused across every repo, but sits one word from the shared key and would be mistyped for it. It is not named for subscription billing on purpose: the key identifies **a person**, not a billing mode, and the same key is the natural credential for registering a seat (**Q7**) or reading one's own runs.

### 3.3c When the token is fetched (D9)

**D9 — the seat's `claude_code_oauth_token` is resolved fresh on every pass, from `subscription_seat`, keyed by the alias D3 stores on the run.** It is not copied into `runbook_run_secret` at launch.

**Where:** substation, not the sandbox.

```
reconcile-loop.ts:416  →  buildLaunchEnv()  →  buildRunbookEnv()  →  env handed to the sandbox
   (substation's cron,        launch.ts:71        env.ts:202
    once per pass)
```

**The timing already exists.** `buildLaunchEnv` reads the seat at each pass today, with the service-role client, and its own comment gives the reason this decision keeps: park-and-exit rebuilds the environment every time, "including the resume that happens after a human answers a gate, days later. A seat supplied once and not re-read is a subscription run that cannot survive its own gate." So D9 changes **one thing** — the source. `getRunSecret(runId)` becomes a lookup in `subscription_seat` by the run's alias.

**Why fresh rather than copied.** A copy is frozen at launch. Re-issue a seat's token — a rotation, a revoke, a re-auth — and every parked run is holding a credential that no longer works, firing `../cloud-captain/` **D11**'s expired-token gate for a cause the system created itself. Resolving fresh heals them with no operator action, and the credential exists in exactly one row rather than one copy per run.

**The sandbox cannot read it, by construction.** The sandbox's `SUPABASE_RUN_TOKEN` assumes the `workflow_run` role; migration `20260921200000` revokes that role from `runbook_run_secret`, and `subscription_seat` carries the same revoke. The only path into the sandbox is substation writing the environment.

**`runbook_run_secret` stays, and wins where present.** A caller-supplied per-run token (`../cloud-captain/` D10) is checked before the registry, so a one-off run on a seat that is not registered still works. Whether that escape hatch is kept permanently or removed for a single path is **Q5**, unchanged — D9 defines the precedence while both exist, it does not decide that question.

**A consequence worth naming:** because one token is injected into the environment per pass, every agent step inside that pass inherits the same seat. The cloud therefore spends **one seat per run**, where the local lane spends one per *step* — `CONDUCTOR_SEAT_CMD` runs per agent-step invocation and spreads a fan-out across a pool (§2). Substation sets no such hook in the sandbox. Giving the cloud per-step spreading means the sandbox asking substation for a seat *during* the run, which is a different shape and is out of v1; it is downstream of **Q7**.

### 3.4 Ownership is enforced, not documented (D5)

Substation refuses a `seat` alias whose `owner_user_id` is not `triggered_by`, at launch. `docs/runbooks.md:83` is a rule the system can enforce at the one point that knows both facts; leaving it to convention is how the shared-token problem happened in the first place.

**Open:** whether a deliberate exception is ever wanted (an admin running on the org seat), and whether `triggered_by` being null — a cron- or API-triggered run — means "no seat" or "the org seat". See **Q3**.

### 3.5 When nothing resolves (D4)

An `operator` HITL question against the run, offering **continue metered** or **cancel**; cancel sets the run `cancelled`, which already exists in the status enum for exactly this — a human's decision, not a malfunction.

Resolution runs on every cloud run; the gate fires only on failure. Failing the launch outright is the wrong shape: the work still needs doing, and a billing-lane lookup is not a reason to lose a queued run.

### 3.6 Leases and usage (Q2, deferred)

Local leases stop two launches on one seat. Nothing does that across cloud runs, so two runs on one Max account will hit the same rate limit and both stall. A `seat_lease` row per active run, checked at launch, is the obvious port — **deferred to phase 2** so single-seat cloud runs can ship first.

Usage-aware picking (choosing the least-tired of a person's accounts, as a local pick does from `usage-snapshots/`) is **out of v1**. Those snapshots are produced by local machinery watching local sessions; replicating it server-side is its own project, and a cloud run that picks a tired seat degrades to a park, not a wrong answer.

## 4. Decisions

- **D1** — A service-role-only registry table in Supabase, **`subscription_seat`**, keyed by alias, owned by a user, its credential column named `claude_code_oauth_token`, published from `dsd.conf` by a `dsd` command. No read policy.
- **D2** — Resolution happens in substation at launch, before a sandbox exists.
- **D3** — `POST /api/runs` takes an optional `seat` alias, stored on the run, passed through as `CONDUCTOR_SEAT`; it beats the `triggered_by` lookup.
- **D4** — Nothing resolves ⇒ an `operator` gate offering metered or cancel. Never a failed launch.
- **D5** — Substation refuses an alias not owned by `triggered_by`. The rule is enforced, not documented.
- **D6** — Leases and usage-aware picking are phase 2; v1 resolves one seat per run.
- **D7** — `POST /api/runs` records the acting identity as `runbook_runs.triggered_by`: `conductor init` sends `x-on-behalf-of`, the route resolves it with the shipped `SERVICE_SENTINELS` pattern, the insert writes the column. Self-asserted on every launch D8 does not cover — mistake-prevention, not authorization (§3.3a).
- **D8** — A cloud subscription launch authenticates with a per-user substation API key, `SUBSTATION_PERSONAL_API_KEY`: no expiry, revocable, `last_used_at`; minted self-service in cityhall under the person's own SSO session and stored hashed in `personal_api_key`; held on the operator's machine in `~/.env`, never in substation's environment; required on the launch call alone and never inside the sandbox. **Cloud + subscription + a shared credential is refused 403** — the refusal is what makes D5 and D7 real. Additive: metered keeps `SUBSTATION_SERVICE_API_KEY`, local is untouched. (§3.3b)
- **D9** — The seat's `claude_code_oauth_token` is resolved fresh from `subscription_seat` on every pass, by the alias on the run, in substation's `buildLaunchEnv` — not copied into `runbook_run_secret` at launch. A caller-supplied per-run token still wins where present (Q5 unchanged). The sandbox receives it as an environment variable and can never read the table. (§3.3c)

*(D2, D4 and D5 were `../cloud-captain/` v2's D17, D16 and part of §6 respectively, moved here in that spec's v3.)*

## 5. Open questions

- **Q1 — where does a per-account cloud credential come from?** A local seat is a `CLAUDE_CONFIG_DIR` holding a logged-in session, not a token. Can a usable `CLAUDE_CODE_OAUTH_TOKEN` be extracted from one, or must each account be provisioned a token separately? **This gates implementation.** (§3.2)
- **Q2 — cross-run leases.** Ship a `seat_lease` row in v1 after all, or accept that two concurrent cloud runs can collide on one account until phase 2? (§3.6)
- **Q3 — the null and admin cases.** A cron- or API-triggered run has no `triggered_by`. Does that mean no seat (→ D4's gate), or the org seat? And is there ever a legitimate reason to let someone run on an account they do not own? (§3.4)
- **Q4 — does the registry eventually feed the local lane too?** `dsd.conf` would become the editing surface and the registry its projection; or the registry becomes canonical and `dsd.conf` a cache. Not needed for cloud, but two sources of truth for "who owns which account" is the drift this spec is otherwise avoiding.
- **Q6 — RESOLVED (v4).** A launch proves who it is with **D8**, a per-user substation API key required for cloud subscription launches and refused-if-absent. Not the verified-JWT option, which needs an interactive login on a CLI that also runs headless, plus refresh machinery. Not a replacement for the shared service key either: metered is untouched, so `../conductor-init/` D4's service-role debt stands. (§3.3b)
- **Q7 — who writes the `subscription_seat` rows, and how?** D8 supplies the trusted identity that makes self-service registration possible, and the same signed-in cityhall surface is the obvious home — but the credential itself cannot come from `dsd.conf`, which holds `account = <alias> | <config_dir> | <colors>` and **no token at all**. So D1's "publish from `dsd.conf`" can project the alias and the owner and structurally cannot project the credential: that has to be minted deliberately per account (`claude setup-token`, an interactive flow, run under that account's `CLAUDE_CONFIG_DIR`) and handed over once. Also unresolved inside this: `dsd` knows owners as names (`will`, `jason`) while `owner_user_id` is an `auth.users` UUID, so something must bridge them. **This is the next thing to settle.** (§3.1, §3.2)
- **Q5 — retiring D10.** Once resolution works, does the captain spec's per-run `claude_code_oauth_token` stay as an escape hatch (a one-off run on a seat not in the registry), or is it removed so there is one path? (§Problem)
