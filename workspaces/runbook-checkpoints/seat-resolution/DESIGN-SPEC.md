# Seat resolution — spending the right person's subscription account on a cloud run

**Status:** Draft v1
**Date:** 2026-09-21
**Repos touched:** `substation` (a seat registry to read, resolution at launch, ownership enforcement), `dsd` (publish a machine's accounts to the registry), `bureau` (nothing beyond what the captain spec already names)
**Repos NOT touched:** `conductor2` (its seat hook contract is already right and is the model this borrows — §2), `cityhall`
**Split from:** `../cloud-captain/DESIGN-SPEC.md` v2 §6. That spec's **D10** (a per-run `claude_code_oauth_token` on the launch body) is the interim that unblocks subscription cloud runs without this one, which is why this is separable.
**Sibling:** `../cloud-captain/DESIGN-SPEC.md`

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

A service-role-only Supabase table:

| column | notes |
|---|---|
| `alias` | `max-a`, `max-g` — the same names `dsd.conf` uses, so one vocabulary across lanes |
| `owner_user_id` | FK → `auth.users`. The relation `dsd.conf`'s `owner =` lines already encode |
| `credential` | the cloud-usable form (§3.2) |
| `active` | a seat can be retired without losing its history |

RLS enabled, **no read policy at all** — the same shape the captain spec's `runbook_run_secret` uses. Nobody reads it but substation's service-role client.

**`dsd` gains a command to publish a machine's accounts** into it, so `dsd.conf` stays the human-editable source and the registry is its projection. The alternative — substation calling `dsd` as a service — puts a new network dependency in the launch path and is rejected.

### 3.2 The credential form (Q1)

Local seats are config *directories*; the cloud consumes a *token*. Storing a per-account `CLAUDE_CODE_OAUTH_TOKEN` and injecting it exactly where `env.ts` injects the shared one today is the smallest change — the injection path, the subscription gating, and the "a metered run must never carry it" rule all already exist and are tested.

**Unresolved:** where that token comes from. A `config_dir` is a logged-in session, not a token a human types. Whether one can be extracted from a seat, or must be issued separately per account, is **Q1** and gates this spec's implementation the way seat resolution gates the billing flip.

### 3.3 Resolution (D2, D3)

**D2 — resolution happens in substation, at launch, before any sandbox exists.** The run row exists at that point, so a problem can be reported with nothing spent. Resolving inside the sandbox would mean paying to boot a box before discovering it has nothing to bill.

Order of precedence, mirroring conductor's:

1. `seat` named on the `POST /api/runs` body (**D3** — an optional alias, stored on `runbook_runs`, passed through as `CONDUCTOR_SEAT`)
2. else the first `active` account owned by `triggered_by`
3. else nothing resolves → **D4**

**D3** deliberately reuses the existing alias vocabulary end-to-end, so "run this on `max-g`" means the same thing locally and in the cloud.

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

- **D1** — A service-role-only registry table in Supabase, keyed by alias, owned by a user, published from `dsd.conf` by a `dsd` command. No read policy.
- **D2** — Resolution happens in substation at launch, before a sandbox exists.
- **D3** — `POST /api/runs` takes an optional `seat` alias, stored on the run, passed through as `CONDUCTOR_SEAT`; it beats the `triggered_by` lookup.
- **D4** — Nothing resolves ⇒ an `operator` gate offering metered or cancel. Never a failed launch.
- **D5** — Substation refuses an alias not owned by `triggered_by`. The rule is enforced, not documented.
- **D6** — Leases and usage-aware picking are phase 2; v1 resolves one seat per run.

*(D2, D4 and D5 were `../cloud-captain/` v2's D17, D16 and part of §6 respectively, moved here in that spec's v3.)*

## 5. Open questions

- **Q1 — where does a per-account cloud credential come from?** A local seat is a `CLAUDE_CONFIG_DIR` holding a logged-in session, not a token. Can a usable `CLAUDE_CODE_OAUTH_TOKEN` be extracted from one, or must each account be provisioned a token separately? **This gates implementation.** (§3.2)
- **Q2 — cross-run leases.** Ship a `seat_lease` row in v1 after all, or accept that two concurrent cloud runs can collide on one account until phase 2? (§3.6)
- **Q3 — the null and admin cases.** A cron- or API-triggered run has no `triggered_by`. Does that mean no seat (→ D4's gate), or the org seat? And is there ever a legitimate reason to let someone run on an account they do not own? (§3.4)
- **Q4 — does the registry eventually feed the local lane too?** `dsd.conf` would become the editing surface and the registry its projection; or the registry becomes canonical and `dsd.conf` a cache. Not needed for cloud, but two sources of truth for "who owns which account" is the drift this spec is otherwise avoiding.
- **Q5 — retiring D10.** Once resolution works, does the captain spec's per-run `claude_code_oauth_token` stay as an escape hatch (a one-off run on a seat not in the registry), or is it removed so there is one path? (§Problem)
