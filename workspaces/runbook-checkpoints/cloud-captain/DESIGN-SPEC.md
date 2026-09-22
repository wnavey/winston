# Cloud Captain — an Agent SDK captain inside the Vercel Sandbox

**Status:** Draft v3
**Date:** 2026-09-21
**Repos touched:** `bureau` (the captain entrypoint; `runbook_hitl_cli.py` bearer transport), `substation` (launch the captain as the carrier; two run-bearer gate routes; the per-run subscription token; billing defaults), `claude-plugins` (`/conductor` SKILL.md — every captain question becomes a DB row, on **both** lanes, D9), `conductor2` (nothing — §4, D4)
**Repos NOT touched:** `cityhall` (the console already renders the payload shape a captain writes — §3.4 is the point)
**Sibling:** `../seat-resolution/DESIGN-SPEC.md` (§6 split out in v3)
**Parent:** `../DESIGN-SPEC.md` v2 (runbook checkpoints + HITL control plane), `../reconcile-workstreams/DESIGN-SPEC.md` v3 (the converged tables and routes)
**Corrects:** `../agentic-hitl/DESIGN-SPEC.md` §3, which records "the cloud lane has no agent in the loop at all" as an as-built fact without checking it against `bureau/docs/runbooks.md`. It is an unbuilt component, not an architectural property. This spec builds it.

> **Revision note (v3, 2026-09-21).** Two changes, both from reality moving underneath v2.
>
> **§5.1 is resolved, not pending.** v2 said D6 "contradicts the constitution" and required a human to edit `docs/runbooks.md`. **bureau#1676 merged** (`ad7760400c`, 2026-09-21): the rule now reads "**Cloud runs also default to subscription** but they can use metered spend when we are running a lot of runs in a single week." D6 is aligned with the constitution rather than against it. The same PR deleted a **duplicated** "Runbook ecosystem" block, so v1/v2's citations to `:40`/`:42` are dead — the surviving statement is `docs/runbooks.md:12`, and every citation here is re-checked against the merged file.
>
> **§6 is now its own spec** — `../seat-resolution/DESIGN-SPEC.md`. It spans `dsd` + `substation`, carries its own five open questions, and D10 means it no longer blocks the captain. v2's **D16 and D17 move there** (as its D4 and D2); the numbering of D1–D15 is unchanged so earlier references still resolve.
>
> One consequence worth stating plainly: with #1676 merged, the constitution now says cloud runs default to subscription **while substation still has exactly one shared `CLAUDE_CODE_OAUTH_TOKEN`**, which `:74` forbids sharing. D10 is what makes that honest in the interim — the caller supplies their own seat — and the seat spec is what makes it automatic.
>
> **Revision note (v2, 2026-09-21).** Folds in a two-batch grill plus one factual correction.
>
> **Factual correction — v1's §4 premise was wrong.** v1 justified the new bearer routes with "the sandbox never holds a DB credential." It does: `buildRunbookEnv` injects `SUPABASE_RUN_TOKEN`, `SUPABASE_ANON_KEY` and, on a subscription run, `CLAUDE_CODE_OAUTH_TOKEN` (`substation/src/lib/runbook/env.ts`). The routes are still right, for a sharper reason verified in prod (`mgxqsrjutswbciyrltwd`, 2026-09-21): `runbook_hitl_ask` has `EXECUTE` granted to **`postgres` and `service_role` only** (substation#267 revoked it from `authenticated`), and all three control-plane tables carry a **SELECT-only** RLS policy with **no write policy at all**. The sandbox's run token therefore cannot open a question or read an answer *by design*, not by absence. §4 restated.
>
> **New decisions:** D7 captain always on, no flag and no kill-switch. D8 repair authority is split — the captain may fix environment causes, re-run, and void/REVISE freely, but an edit to `contract.test.ts`, `prompt.md` or `step.yaml` must pass a HITL gate **whose readout is the diff**. D9 every captain question becomes a `runbook_hitl_questions` row on **both** lanes (local answers may still arrive in chat as `channel='session'`; the row always exists) — this puts `claude-plugins` in scope, which v1 said it was not. D10 a per-run `claude_code_oauth_token` on the launch body, stored write-only, so subscription cloud runs work before the seat registry exists. D11 an expired token opens an `operator` gate. D12 no token supplied ⇒ today's shared-token behaviour, so the change is purely additive. D13 seat exhaustion parks rather than silently falling back to metered. D14 the captain narrates itself into the checkpoint stream.
>
> **Revised:** D5 is a **repair-loop count cap (default 3), not a budget cap**, and exhausting it **parks on an `operator` gate rather than failing the run** — reconciling v1's Q4 with D9. D6 splits: local flips to subscription now, cloud's default flips when seat resolution lands.
>
> **Seat resolution is now Phase 2** (§6), with the mechanism researched and recorded. D10 unblocks subscription cloud runs without it. Kept in this spec rather than split out, but it is cleanly separable if it starts to drag — see Q7.

## Problem

`bureau/docs/runbooks.md` — the constitution, human-edited, "the definitive overview of how our systems work" — specifies a captain on **both** lanes:

> **Cloud Runs** take place in Vercel Sandbox in isolated environments that we can pause and resume as needed. The captain agent run as a Claude Agent SDK wrapper around Conductor in this environment. (`docs/runbooks.md:12`)

> The captain starts conductor, handles any problems, repairing it's copy of the runbook if needed, and validating that the runbook is actually done before closing out. What the captain decides itself and what it takes to a human is stated in the `/conductor` skill. (`:10`)

It is **specified**, it is **provisioned** — the cloud image installs `claude-agent-sdk==0.2.144` (`conductor2/containers/Containerfile:90`) — and it is **not built**. `substation/src/lib/runbook/plan.ts` shells `conductor setup` (`:453`), `conductor advance` (`:506`) and `conductor run-step` (`:570`) directly, and `reconcile-loop.ts` launches those as detached commands with no wrapper. Every `captain` reference in bureau resolves to `runbooks/lib/runbook_hitl_cli.py`, whose own header calls it "the captain's **local-lane** HITL client".

So a cloud run today is a bare binary with a cron around it. Three consequences, all observed this week:

**1. A cloud HITL card carries no question.** `gates_for` (`conductor2/src/callback.rs:285`) builds `title: "{step.id} · {run.name}"` and stops. The local captain's entire authorship at a gate is the `--prompt` one-liner (`../agentic-hitl/DESIGN-SPEC.md` §2, Role B); with no captain, nothing writes it. Run `152db1b9-6b3d-475e-9bb3-a4f7d9d28f7e` (2026-09-21) parked at `2.3-hitl` and the console rendered the step id twice with approve/revise and no question — while `payload.readout.text` held the complete digest, unread, in the same row.

**2. A recoverable failure kills the run.** Run `3b601464-b0d4-4a2a-96da-51215e3610fd` (2026-09-21) died at `2.4-snapshot` on a refusal conductor printed in plain English to `pass.log`. The run went `failed`, no checkpoint carried the reason, and a human read the sandbox filesystem by hand to find it. `docs/runbooks.md:32` states the intent: exit 1 "is often picked up and repaired by the outer Captain agent."

**3. Nobody validates the run is actually done.** `docs/runbooks.md:10`: the captain "validat[es] that the runbook is actually done before closing out." Today exit 0 from one pass sets `done` and that is the whole check.

## 1. What is actually there today

| | status | evidence |
|---|---|---|
| Specified | ✅ | `bureau/docs/runbooks.md:10,12` (post-#1676) |
| Provisioned | ✅ | `conductor2/containers/Containerfile:90` — `claude-agent-sdk==0.2.144` |
| Behavioural contract written | ✅ | `claude-plugins/.../skills/conductor/SKILL.md` §5–§6, which `docs/runbooks.md:10` names as the statement of what the captain decides itself vs takes to a human |
| Built | ❌ | nothing launches it |

### 1.1 What the sandbox can and cannot reach

The sandbox **does** hold credentials: `SUPABASE_RUN_TOKEN`, `SUPABASE_ANON_KEY`, the per-run HMAC bearer, and on a subscription run `CLAUDE_CODE_OAUTH_TOKEN` (`env.ts`). What it does not hold is *write authority over the control plane*, and that is deliberate:

- `runbook_hitl_ask` — `EXECUTE` to `postgres` and `service_role` only (substation#267).
- `runbook_runs`, `runbook_checkpoints`, `runbook_hitl_questions` — one `SELECT` policy each, `authenticated`, noetic-member gated. **No INSERT or UPDATE policy exists**, so writes are service-role only.

The bearer opens five routes (`substation/src/routes/runs.ts`): `GET /runs/:id` (`:388`, a deliberately narrow field-by-field projection that omits `request`), `POST /runs/:id/checkpoints` (`:473`), `POST /runs/:id/callback` (`:553`), `PUT /runs/:id/graph` (`:730`), `POST /runs/:id/events` (`:761`).

**None of them can open a HITL question or read its answer.** So a sandbox-bound captain cannot do the thing that most makes it a captain. That is the one new API surface this spec adds (§4).

## 2. The captain's job

From `SKILL.md` §5–§6, which is the contract.

**A — author the question.** At exit 75, read the parked step's readout, its `adjudication.md` if present, and the `Decision` zod in its `contract.test.ts`; write one line stating what the gate is asking; open the question with that prompt, the readout, and the attachments the decision is *about* — "the outputs of the steps the gate's `inputs:` name" (`SKILL.md` §6).

**B — repair, within bounds (D8).** Exit 1, 76, 77 and environment failures. What it may do unaided and what it must ask for is §2.1.

**C — escalate.** Anything it cannot fix becomes a HITL question rather than a failed run (D9).

**D — decide a gate itself when licensed.** Only when `request.json`'s `directives.decide` names that step id and the folder holds written criteria; `decided_by` then names the captain and cites the directive (`SKILL.md` §5).

**E — validate completion (D15).** Minimal: re-run `conductor status`, confirm every declared step's contract passes and none is stood aside, then report. Judgement beyond an exit code is the intent; a deeper "is the output good" check belongs in the runbook's own contracts.

### 2.1 Repair authority (D8)

| the captain wants to… | authority |
|---|---|
| fix an environment cause (a missing tool, a bad root, a timeout) | **free** |
| re-run a step; `void` / REVISE with findings | **free** — re-does work the runbook already sanctioned |
| edit `contract.test.ts`, `prompt.md` or **`step.yaml`** in the run copy | **HITL gate required** |
| anything it cannot diagnose | escalate (D9) |

A gated edit is not a different mechanism: the captain writes the proposed diff, opens an ordinary `decision` gate **whose readout is that diff**, and exits (D1). A human approves in the console; the next captain pass applies it and advances. Every runbook edit made in the cloud therefore carries a human signature.

`step.yaml` joins the gated set because it changes inputs, runner and timeouts — arguably more consequential than a contract, and v1 left it ambiguous.

**Repair is capped by count, not by dollars (D5).** Three attempts at one problem, then stop. Exhausting the cap **opens an `operator` gate and parks**; it never fails the run. A failed run is invisible until someone looks, while a parked run carries a pending badge on the console — and a human can still cancel.

## 3. Lifecycle — park-and-exit

**D1.** The captain runs `advance`; on exit 75 it authors and opens the question, then **exits**. The run parks, the sandbox stops, the human answers whenever, the reconcile loop resumes the sandbox and relaunches the captain, which finds the answered gate, writes `decision.json`, and advances.

The alternative — blocking on `await-answer` as the local captain does — holds a 4-vCPU/8 GB sandbox for the whole human wait and loses the session at the 24 h cap. A `sir` acquisition gate can be open for days; a runbook sitting open for weeks must not cost money.

D1 is also the cheapest change: the captain becomes **the carrier command the reconcile loop launches** in place of bare `conductor advance` — a substitution at `reconcile-loop.ts:416`. The lease, the callback, `decided → applied`, `next_action` and cost accounting are all untouched.

### 3.1 It depends on a bug being fixed first

D1 assumes "the sandbox is stopped while parked", which the parent spec assumes throughout (§5 "(d) stop + snapshot"; D55 "a sleeping sandbox costs ~$0.08/GB-month"). **That is not true today.** The only `sandbox.stop()` in the lane is the image-drift hold path (`substation/src/lib/runbook/sandbox.ts:212`); `reconcile-loop.ts` never stops a sandbox on park. Verified on run `152db1b9`: session `sbx_Fvw0NJGlJ3aj4yL2IwKsIYVItvS0` was created 17:24:17Z and still `running` at 18:15Z, straight through a 28-minute park, with no `stopped (snapshotted)` checkpoint — where the 2026-09-10 run emitted one, because the retired Inngest launcher did it and `#257` did not carry the behaviour across.

This spec **depends on that fix and does not contain it** (§7, R1).

### 3.2 Always on (D7)

No per-run captain flag and no kill-switch. A flag is more trouble than it is worth and something that bites later; the captain is the lane, not a mode of it.

### 3.3 The captain narrates itself (D14)

A `note` checkpoint per captain action — diagnosis, repair attempt N of 3, escalation, completion verdict. An unsupervised agent editing a runbook is otherwise unauditable, and the stream and its console rendering already exist.

### 3.4 What this buys the console for free

A cloud captain calls the same `runbook_hitl_cli.py` verbs the local captain calls, so it writes `payload.prompt`, `readout_storage_path` and `attachments` — **the shape `cityhall/src/lib/runbook-runs/RunbookHITLQuestion.svelte` already renders.** The cloud card looks broken today only because the callback path writes a different vocabulary (`payload.title` + `payload.readout.text`). Building the captain closes that gap with no cityhall change.

The callback path stays as the fallback for any gate no captain mediates (D3), so the two cheap fixes in §7 R2 remain worth doing.

## 4. The credential seam — two new run-bearer routes

| new route | auth | does |
|---|---|---|
| `POST /api/runs/:runId/gates` | `runBearerAuth` | open a question: `{ step, kind, prompt, readout?, attachments[]?, allow_report_back? }` → the existing `runbook_hitl_ask` RPC, plus the linked `question` checkpoint |
| `GET /api/runs/:runId/gates` | `runBearerAuth` | read this run's gates and answers, so a relaunched captain sees `decided`/`applied`, the `decision` and `next_action` |

Both sit under `/api/runs/:id/*`, so the bearer's authority stays intrinsic: `HMAC(:id)` means a token can only touch its own run's sub-resources and cross-run access is cryptographically impossible (`../sandbox-api-tokens/DESIGN-SPEC.md`). This is the HITL slice that spec explicitly **deferred** — "HITL `ask`/`await` routes deferred (cloud resume needs the unbuilt reconcile body)". The reconcile body is built; the deferral is spent.

- **D2 — the captain writes through the bearer, not through PostgREST.** Not because the sandbox holds no credential (it does), but because the HITL write path is service-role only by design (§1.1). Granting the run token that authority would undo substation#267 deliberately.
- **D3 — `runbook_hitl_cli.py` grows a bearer transport rather than being forked.** The verbs, payload construction and `--attach` upload are already correct; only the transport differs. One client, two transports, selected by which credential is present. A second implementation is how the lanes drift — the defect `../reconcile-workstreams/` exists to undo.
- **D4 — no conductor2 change.** The captain shells `conductor` as the local captain does. `advance --callback` keeps reporting the pass. Both a captain-authored and a callback-authored question at one step land through `runbook_hitl_ask`, which supersedes-or-no-ops (`20260918180000`), so **keep both; the captain wins**. The callback is the backstop if the captain dies before asking — the one path whose failure means a human never learns the run is waiting.

## 5. Billing

**D6 — every runbook run defaults to `subscription`; metered is explicit.** conductor2 already behaves this way (its run-level default falls to subscription when nothing is armed, `conductor2#105`), so this is a substation change: `runs.ts` `createBody.billing` and `env.ts:194` both currently default `'metered'`.

Rationale, and the constitution's: subscription accounts are ~30× cheaper for Anthropic models, and the volume that justifies metered is not here yet. Defaulting to the cheap lane and paying metered on purpose is the right way round.

**Split by lane, for a shrinking reason.** Local flips now — the local seat hook already picks the operator's own account, so there is no correctness problem. **Cloud's default flips when a seat is resolvable** (`../seat-resolution/`): until then, defaulting cloud to subscription funnels every run onto substation's one shared `CLAUDE_CODE_OAUTH_TOKEN`, which `docs/runbooks.md:74` forbids outright. D10 (§5.2) is what lets a cloud run be subscription-billed *correctly* in the meantime, by having the caller supply their own seat.

### 5.1 The constitution already agrees (bureau#1676, merged)

v1 and v2 flagged this as a contradiction needing a human edit. It has one: **bureau#1676 merged 2026-09-21** (`ad7760400c`), and `docs/runbooks.md:76` now reads "**Cloud runs also default to subscription** but they can use metered spend when we are running a lot of runs in a single week." D6 implements the documented rule rather than diverging from it.

What that merge does *not* fix is the mechanism: `:74` ("Subscription accounts are never shared") and `:76` ("the run can only use the accounts owned by the user requesting the run") both stand, while substation still holds exactly one token. So the documented default is now ahead of the implementation, and D10 plus `../seat-resolution/` are what close the distance.

### 5.2 The unblock — a per-run subscription token (D10)

Subscription cloud runs work before the seat registry exists.

**`POST /api/runs` accepts `claude_code_oauth_token` as a top-level field, never merged into `request`.** `request` is persisted verbatim in `runbook_runs.request`, returned in the 201, and covered by a **row**-level (not column-level) SELECT policy for every noetic member — so a credential there would be readable team-wide in plaintext. The bearer's `GET /runs/:id` omits `request` already, so the sandbox is not the exposure; the team is.

Substation writes it to a service-role-only `runbook_run_secret(run_id, claude_code_oauth_token, created_at)` with **RLS enabled and no read policy at all** — unreadable by the console, by a noetic member, and by the sandbox bearer. `buildRunbookEnv` reads it with the service-role client **at each pass** and injects it exactly where `env.ts:204` injects the shared token today. The row is deleted when the run reaches `done`/`failed`/`cancelled`.

It must persist because **park-and-exit rebuilds the sandbox env on every pass**, including the resume that happens after a human answers — possibly days later. A token supplied once and not kept means a subscription cloud run cannot survive its own gate, which is the point of the lane.

This is not throwaway: when the registry lands, the resolver writes into the same slot instead of the caller supplying it. The injection path, the subscription gating and the "a metered run must never carry it" rule are unchanged.

- **D12 is amended by `../seat-resolution/` D13 (2026-09-22).** Once the seat registry exists, a **cloud subscription** run no longer falls back to substation's shared `CLAUDE_CODE_OAUTH_TOKEN`: it is refused with `seat_not_registered`. Falling back was strictly better than failing when there was nothing to resolve against; with a registry it makes registration optional and the ownership check bypassable, which is what `docs/runbooks.md:74` forbids. D12 stands unchanged everywhere else, and until the registry lands.
- **D10 is retired by `../seat-resolution/` D15 (2026-09-22).** It is the interim, and it ends: once a registry-resolved cloud subscription run has completed end to end, the launch-body field, its guards, `runbook_run_secret` and the secret helpers are all deleted. A raw token carries no alias, so the ownership rule has nothing to check and nothing records which account paid. Gated on that run rather than a date, because none has happened yet and D10 is currently the only proven path.
- **D11 — an expired token opens an `operator` gate**: "this run's seat token is no longer valid — supply a new one, or continue metered." Same gate shape as D16, no new concept.
- **D12 — no token supplied ⇒ today's behaviour.** Fall back to substation's shared `CLAUDE_CODE_OAUTH_TOKEN` rather than failing, so D10 is purely additive and nothing that works today breaks.
- **D13 — seat exhaustion mid-run parks.** conductor already parks with `seat_exhausted` on a 429. The captain opens an `operator` gate naming the seat and its reset time. **It must not auto-fall-back to metered**: silently switching to real dollars because a rate limit hit is the surprise the Token Spend Rules exist to prevent.

## 6. Seat resolution — split out

v2 carried the seat mechanism here. It is now **`../seat-resolution/DESIGN-SPEC.md`**: a service-role-only registry keyed by alias and owner, resolution in substation at launch from `runbook_runs.triggered_by`, an optional `seat` alias on the launch body, ownership enforced rather than documented, and an `operator` gate when nothing resolves.

It is separable because **D10 unblocks subscription cloud runs without it** — the caller supplies their own token per run, which satisfies "accounts are never shared" by construction. The captain does not wait on it.

The one fact worth keeping in view here: **none of the local seat machinery ports.** `dsd.conf` is a per-machine dotfile, a seat is a `CLAUDE_CONFIG_DIR` rather than a token, and `dsd seat pick` is a stdout hook contract with per-machine leases. What *does* port is conductor's seam — the `--seat`/preset/hook precedence and `CONDUCTOR_SEAT` — which the seat spec implements behind rather than replaces.

## 7. Sequencing

| | what | repo | why here |
|---|---|---|---|
| **R1** | Stop + snapshot the sandbox on park | substation | D1 depends on it; also a standalone cost bug (§3.1) |
| **R2** | Ship `step.desc` as `payload.prompt`; render `payload.readout.text` | conductor2, cityhall | ~1 hour; makes the callback-path card readable today and stays the fallback for un-captained gates |
| **R3** | The two run-bearer gate routes (§4) | substation | the captain cannot ask without them |
| **R4** | `runbook_hitl_cli.py` bearer transport (D3) | bureau | |
| **R5** | `runbook_run_secret` + `claude_code_oauth_token` on the launch body (D10–D12) | substation | unblocks subscription cloud runs; independent of R3/R4 |
| **R6** | The captain entrypoint + launch it as the carrier | bureau, substation | the substitution at `reconcile-loop.ts:416` |
| **R7** | D9 on the local lane — every captain question becomes a row | claude-plugins, bureau | |
| **R8** | Local billing default → subscription | substation | the `docs/runbooks.md` half is already done — bureau#1676, merged |
| **R9** | Seat registry + resolution; cloud billing default flips | dsd, substation | its own spec — `../seat-resolution/` |

Independently useful, not blocking: `pass.log`'s last lines as a checkpoint on a non-0/75 exit, which `docs/runbook-lane.md` already promises and run `3b601464` did not get.

**Pilot:** `smoke/2.3-hitl` in the cloud, captained — the card carries an authored question and the briefs as attachments, answered from the console, run reaches exit 0. The milestone run `152db1b9` hit on 2026-09-21, plus a readable card.

## 8. Decisions

- **D1** — Park-and-exit, not block-and-poll. The captain is the carrier the reconcile loop launches. (§3)
- **D2** — The captain writes through the run bearer; the HITL write path stays service-role only. (§4)
- **D3** — One `runbook_hitl_cli.py`, two transports. No fork. (§4)
- **D4** — No conductor2 change. Keep both question sources; the captain wins, the callback backstops. (§4)
- **D5** — Repair is capped by **loop count (default 3), not dollars**; exhaustion parks on an `operator` gate and never fails the run. (§2.1)
- **D6** — All runbooks default to `subscription`; metered explicit. Local now, cloud when a seat resolves. Requires a human edit to `docs/runbooks.md:85`. (§5)
- **D7** — The captain is always on. No per-run flag, no kill-switch. (§3.2)
- **D8** — Split repair authority: environment fixes, re-runs and void/REVISE free; `contract.test.ts` / `prompt.md` / `step.yaml` edits require a HITL gate whose **readout is the diff**. (§2.1)
- **D9** — Every captain question is a `runbook_hitl_questions` row, **both lanes**. A local answer may still arrive in chat (`channel='session'`); the row always exists. Puts `claude-plugins` SKILL.md in scope. (§2)
- **D10** — Per-run `claude_code_oauth_token` on the launch body, never in `request`, stored write-only in `runbook_run_secret`, injected each pass, deleted at terminal status. (§5.2) **Retired by `../seat-resolution/` D15** once the registry is proven.
- **D11** — An expired token opens an `operator` gate. (§5.2)
- **D12** — No token supplied ⇒ today's shared-token behaviour. Purely additive. (§5.2) **Amended by `../seat-resolution/` D13:** not for a cloud subscription run once the registry exists — that case is refused instead.
- **D13** — Seat exhaustion parks on an `operator` gate; never auto-fall-back to metered. (§5.2)
- **D14** — The captain narrates itself: a `note` checkpoint per action. (§3.3)
- **D15** — Completion validation is minimal: `conductor status`, every contract passing, nothing stood aside. (§2)

*(v2's **D16** and **D17** moved to `../seat-resolution/` as its D4 and D2. D1–D15 keep their numbers.)*

**Non-goal, revisited:** converging the local Claude Code captain onto the SDK implementation. Not now — but keep the captain's logic in `bureau`, not in `substation`, so it stays possible.

## 9. Open questions

- **Q1 — what does the captain see of an earlier pass?** Park-and-exit means a relaunched captain is a fresh session with no memory of the one that parked. The run directory is the state, as always — but is the gate's own ask/answer history (preserved per-ask since `20260918180000`, `attempt` on `runbook_hitl_questions`) enough context for a captain resuming a `report_back`?
- **Q2 — which model, at what effort, drives the captain?** It is an agent per pass on top of the steps. D5 caps its repair loop but not its model choice. A cheap model that misdiagnoses costs more than an expensive one that does not.
- **Q3 — 24 h.** The sandbox session cap is 86,400,000 ms. With R1 a parked run is stopped and resumes from a snapshot, so the cap should not bite. Confirm a stopped-and-snapshotted sandbox survives past 24 h, and what happens to a session that *times out* while parked — the automatic snapshot is taken by `stop()`, and whether a timeout leaves one is unverified.
- **Q4 — RESOLVED (v3).** v2 asked whether §6 should split. It has: `../seat-resolution/DESIGN-SPEC.md`, carrying its own D1–D6 and Q1–Q5. The captain no longer waits on it.
