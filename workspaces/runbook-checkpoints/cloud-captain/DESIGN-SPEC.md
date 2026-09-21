# Cloud Captain — an Agent SDK captain inside the Vercel Sandbox

**Status:** Draft v1
**Date:** 2026-09-21
**Repos touched:** `bureau` (the captain entrypoint the sandbox runs, and a `docs/runbooks.md` correction a human must make), `substation` (launch the captain instead of bare `conductor advance`; two new run-bearer routes so a sandbox can open and read a HITL question; billing default flip), `conductor2` (nothing for the captain itself — see §4)
**Repos NOT touched:** `cityhall` (the console already renders the payload shape a captain writes — §3.4 is the point)
**Parent:** `../DESIGN-SPEC.md` v2 (runbook checkpoints + HITL control plane), `../reconcile-workstreams/DESIGN-SPEC.md` v3 (the converged tables and routes)
**Corrects:** `../agentic-hitl/DESIGN-SPEC.md` §3, which records "the cloud lane has no agent in the loop at all" as an as-built fact without checking it against `bureau/docs/runbooks.md`. It is an unbuilt component, not an architectural property. This spec builds it.

## Problem

`bureau/docs/runbooks.md` — the constitution, human-edited, "the definitive overview of how our systems work" — specifies a captain on **both** lanes, and says so twice:

> **Cloud Runs** take place in Vercel Sandbox in isolated environments that we can pause and resume as needed. The captain agent run as a Claude Agent SDK wrapper around Conductor in this environment. (`docs/runbooks.md:12`, repeated `:42`)

> For cloud runs the captain is an Agent SDK wrapper around Conductor inside the sandbox. For local runs it is the operator's own Claude Code session initiated with the `/conductor` skill. (`:40`)

It is **specified**, it is **provisioned** — the cloud image installs `claude-agent-sdk==0.2.144` (`conductor2/containers/Containerfile:90`) — and it is **not built**. Nothing runs it. `substation/src/lib/runbook/plan.ts` shells `conductor setup` (`:453`), `conductor advance` (`:506`) and `conductor run-step` (`:570`) directly, and `src/lib/reconcile-loop.ts` launches those as detached commands with no wrapper. Every `captain` reference in bureau resolves to `runbooks/lib/runbook_hitl_cli.py`, whose own header calls it "the captain's **local-lane** HITL client".

So a cloud run today is a bare binary with a cron around it. Three consequences, all observed on real runs this week:

**1. A cloud HITL card carries no question.** `gates_for` (`conductor2/src/callback.rs:285`) builds `title: "{step.id} · {run.name}"` and stops. The local captain's entire authorship at a gate is the `--prompt` one-liner (`../agentic-hitl/DESIGN-SPEC.md` §2, Role B); with no captain, nothing writes it. Run `152db1b9-6b3d-475e-9bb3-a4f7d9d28f7e` (2026-09-21) parked at `2.3-hitl` and the console rendered the step id twice with approve/revise buttons and no question — while `payload.readout.text` held the complete digest, unread, in the same row.

**2. A recoverable failure kills the run.** Run `3b601464-b0d4-4a2a-96da-51215e3610fd` (2026-09-21) died at `2.4-snapshot` with a refusal conductor printed in plain English to `pass.log`. The run went `failed`, no checkpoint carried the reason (§7, R5), and a human read the sandbox filesystem by hand to find it. The `/conductor` skill §5 describes exactly how a captain triages that class — and there was no captain. `docs/runbooks.md:32` states the intent directly: exit 1 "is often picked up and repaired by the outer Captain agent."

**3. Nobody validates the run is actually done.** `docs/runbooks.md:10`: the captain "validat[es] that the runbook is actually done before closing out." Today exit 0 from one `advance` pass sets the row to `done` (`runs.ts` `statusForExit`) and that is the whole check.

This spec builds the cloud captain, and defines the one credential seam it needs that does not exist yet.

## 1. What is actually there today

| | status | evidence |
|---|---|---|
| Specified | ✅ | `bureau/docs/runbooks.md:12,40,42` |
| Provisioned | ✅ | `conductor2/containers/Containerfile:90` installs `claude-agent-sdk==0.2.144` |
| Behavioural contract written | ✅ | `claude-plugins/plugins/noetic-tools/skills/conductor/SKILL.md` §5–§6, which `docs/runbooks.md:10` names as the statement of what the captain decides itself vs takes to a human |
| Built | ❌ | nothing launches it |

### 1.1 What the sandbox's credential can reach

The sandbox is deliberately denied any DB-capable credential; it holds a per-run HMAC bearer instead (`substation/src/lib/run-bearer.ts`, and `../conductor-init/DESIGN-SPEC.md` "Why not make conductor own the DB"). That bearer today opens exactly five routes (`substation/src/routes/runs.ts`):

| route | line | purpose |
|---|---|---|
| `GET /api/runs/:runId` | `:388` | read the run row |
| `POST /api/runs/:runId/checkpoints` | `:473` | append a checkpoint |
| `POST /api/runs/:runId/callback` | `:553` | report a pass's outcome |
| `PUT /api/runs/:runId/graph` | `:730` | run-monitor graph |
| `POST /api/runs/:runId/events` | `:761` | run-monitor step events |

**There is no route to open a HITL question, and none to read a gate's answer.** So a cloud captain cannot do the one thing that most distinguishes a captain, with the only credential it is allowed to hold. That is the single new API surface this spec adds (§4).

## 2. The captain's job

Taken from `SKILL.md` §5–§6, which is the contract. The cloud captain is the same agent with a different shell and a narrower remit.

**A — author the question (the headline).** At exit 75, read the parked step's readout, its `adjudication.md` if it has one, and the `Decision` zod in its `contract.test.ts`; write one line stating what the gate is asking; open the question with that prompt, the readout, and the attachments the decision is *about* — "the outputs of the steps the gate's `inputs:` name" (`SKILL.md` §6).

**B — repair a recoverable failure.** Exit 1 (failing contract): triage output vs contract vs prompt, fix in the run's copy committed in `$RUN/runbooks` git, two re-runs then escalate. Exit 76 (unverified): raise the contract timeout or run the contract by hand. Exit 77 (dirty surface): name the strays — and per `SKILL.md`, **ask rather than clear them**. Exit 1 with no step output: the environment.

**C — escalate what it cannot fix**, as a HITL question, rather than failing the run. `docs/runbooks.md:41`: "The Captain agent can also escalate to HITL when it runs into issues."

**D — decide a gate itself when licensed.** Only when `request.json`'s `directives.decide` names that step id and the step's folder holds written criteria; `decided_by` then names the captain and cites the directive (`SKILL.md` §5).

**E — validate completion** before reporting `done`.

**Explicitly not the captain's:** `BLOCKED.md` and the other step readouts, which `SKILL.md` says are handled in chat and never through the app lane. In the cloud there is no chat, so a `BLOCKED.md` becomes an escalation (C) — see **Q4**.

## 3. Lifecycle — park-and-exit, not block-and-poll

The local captain blocks: `await-answer` polls the question row every few seconds until it is terminal. A cloud captain **must not**, and this is the central design decision.

### 3.1 The two shapes

**Blocking.** Captain runs, hits 75, asks, polls, writes `decision.json`, continues. Mirrors local exactly. But the sandbox stays up for the entire human wait — 4 vCPU / 8 GB, billed as running — and the session's `timeout` is 86,400,000 ms, so a gate open longer than 24 h loses the session. Run `152db1b9`'s gate was open 28 minutes; a real `sir` acquisition gate can be open for days.

**Park-and-exit (D1, chosen).** Captain runs `advance`, and on exit 75 authors and opens the question, then **exits**. The run parks, substation stops the sandbox, the human answers whenever, the reconcile loop resumes the sandbox and relaunches the captain, which finds the answered gate, writes `decision.json`, and advances.

D1 is chosen because it preserves the entire existing control plane. The captain becomes **the carrier command the reconcile loop launches** in place of bare `conductor advance` — the lease, the callback, the `decided → applied` transition, the `next_action` branch and the cost accounting are all unchanged. It is a substitution at one line of `reconcile-loop.ts:416`, not a new control plane.

### 3.2 It depends on a bug being fixed first

D1 assumes "the sandbox is stopped while parked", which the whole parent spec assumes (§5: "(d) stop + snapshot"; D55: "a sleeping sandbox costs ~$0.08/GB-month"). **That is not true today.** The only `sandbox.stop()` in the lane is the image-drift hold path (`substation/src/lib/runbook/sandbox.ts:212`); `reconcile-loop.ts` never stops a sandbox on park. Verified on run `152db1b9`: session `sbx_Fvw0NJGlJ3aj4yL2IwKsIYVItvS0` was created at 17:24:17Z and was still `running` at 18:15Z, straight through a 28-minute park, with no `stopped (snapshotted)` checkpoint — where the 2026-09-10 run emitted one, because the retired Inngest launcher did it and `#257` did not carry the behaviour across.

**This spec depends on that fix and does not contain it** (§7, R1). Without it, park-and-exit still works but the sandbox keeps burning; with it, a parked captain costs storage only.

### 3.3 Where the captain's own model tokens go

The captain is an agent, so it costs tokens per pass on top of the steps. Two consequences: it needs its own budget (D5), and its billing lane is the run's (§5). A pass that parks immediately at a gate should cost cents; the cost to watch is a repair loop, which is why D5 caps it.

### 3.4 What this buys the console for free

A cloud captain calls the same `runbook_hitl_cli.py ask` verbs the local captain calls, so it writes `payload.prompt`, `readout_storage_path` and `attachments` — **the exact shape `cityhall/src/lib/runbook-runs/RunbookHITLQuestion.svelte` already renders.** The cloud card looks broken today only because the callback path writes a different vocabulary (`payload.title` + `payload.readout.text`). Building the captain closes that gap with no cityhall change.

The callback path remains as the fallback for any gate no captain mediates, so the two cheap fixes filed alongside this spec (ship `step.desc` as `payload.prompt`; render `payload.readout.text`) stay worth doing — see §7, R2.

## 4. The credential seam — two new run-bearer routes

The captain runs inside the sandbox, so it may hold only the run bearer. It needs to open a question and later read the answer. Neither route exists.

| new route | auth | does |
|---|---|---|
| `POST /api/runs/:runId/gates` | `runBearerAuth` | open a HITL question at a step: `{ step, kind, prompt, readout?, attachments[]?, allow_report_back? }` → the existing `runbook_hitl_ask` RPC (`substation/supabase/functions/runbook_hitl_ask.sql`), plus the linked `question` checkpoint |
| `GET /api/runs/:runId/gates` | `runBearerAuth` | read this run's gates and their answers, so a relaunched captain sees `decided`/`applied`, the `decision` and `next_action` |

Both are `/api/runs/:id/*`, so the bearer's authority stays intrinsic: `HMAC(:id)` means a token can only ever touch its own run's sub-resources, and cross-run access is cryptographically impossible (`../sandbox-api-tokens/DESIGN-SPEC.md`). This is the HITL slice that spec explicitly **deferred** — "HITL `ask`/`await` routes deferred (cloud resume needs the unbuilt reconcile body)". The reconcile body is now built, so the deferral is spent.

**D2 — the captain writes through the bearer, not through PostgREST.** The alternative, handing the sandbox a `SUPABASE_RUN_TOKEN` so `runbook_hitl_cli.py` works unchanged, is rejected: the run bearer exists precisely so the sandbox never holds a DB credential, and a token whose leak outlives the run is the thing that design avoids.

**D3 — `runbook_hitl_cli.py` grows a bearer transport rather than being forked.** The verbs, the payload construction and the `--attach` upload are all correct already; only the transport differs. One client, two transports (PostgREST locally, run-bearer in the sandbox), selected by which credential is present. A second implementation is how the two lanes drift, which is the defect `../reconcile-workstreams/DESIGN-SPEC.md` was written to undo.

**D4 — no conductor2 change.** The captain shells `conductor` exactly as the local captain does. `advance --callback` keeps reporting the pass, so the run row, the ledger total and the recovery path are untouched. The captain's questions and conductor's callback gates both land through `runbook_hitl_ask`, which already supersedes-or-returns identically (`20260918180000`), so a captain-authored question and a callback-authored one at the same step do not duplicate — the second is a no-op if identical, a supersede if the readout changed. See **Q2**.

## 5. Billing — subscription everywhere by default

**D6 — every runbook run, both lanes, defaults to `subscription`. Metered must be asked for explicitly.**

Today the default is split and the cloud half is metered: `substation/src/routes/runs.ts` `createBody.billing` is `z.enum(RUN_BILLINGS).default('metered')` and `src/lib/runbook/env.ts:194` reads `inputs.billing ?? 'metered'`. conductor2's own default is already subscription — a session-harness step is a subscription step unless its preset says otherwise (`harness.rs`), and the run-level default added today (`conductor2#105`) falls to subscription when nothing is armed. So D6 is **one change in substation**: flip both defaults to `subscription`. conductor2 already behaves this way and needs nothing.

Rationale, in Will's words and the constitution's: subscription accounts are ~30× cheaper for Anthropic models, and the volume that justifies metered is not here yet. Defaulting to the cheap lane and paying metered on purpose is the right way round; the reverse silently spends real dollars on iteration.

### 5.1 This contradicts the constitution, which a human must fix

`docs/runbooks.md:85` currently reads: "**Cloud runs default to metered spend** but they can also use subscription accounts when specified for testing or low-volume runs." D6 reverses that. `bureau/docs/CLAUDE.md` is explicit that a change making `docs/` untrue must be made by a human in parallel — so **shipping D6 requires Will to edit `docs/runbooks.md` §Token Spend Rules**. Flagged here rather than done, per that rule.

### 5.2 The problem D6 exposes: whose seat does a cloud run spend?

The constitution also says (`:83`, `:85`): "Subscription accounts are never shared. Each Noetic employee has their own subscription account(s)" and "When using subscription accounts the run can only use the accounts owned by the user requesting the run."

Substation has **one** `CLAUDE_CODE_OAUTH_TOKEN` (`docs/runbook-lane.md` env table: "A Claude Max seat, for `billing: subscription` runs only"), and `env.ts:206` fails a subscription run that finds it unset. There is no per-user seat resolution in the cloud lane — no equivalent of the local `CONDUCTOR_SEAT_CMD` / `dsd seat pick` hook.

So D6 as stated would funnel **every** cloud run onto one shared seat, which violates `:83` directly. Two ways out, and this spec does not choose:

- **(a)** Resolve the seat from `runbook_runs.triggered_by` → that user's account, via a `dsd seat pick` equivalent reachable from substation. Correct, and more work than the default flip.
- **(b)** Ship D6 for the **local** lane and for cloud runs that name a seat, and keep cloud's default metered until (a) exists.

This is **Q1**, and it is the one question that gates D6 actually shipping. The default flip is a one-line change; making it *true* is not.

## 6. What the captain does not change

- The DB tables and the four control-plane routes (`../reconcile-workstreams/DESIGN-SPEC.md` §5).
- The lease, the callback, `decided → applied`, `next_action`, the cost accounting.
- conductor2's exit-code protocol; the captain is a consumer of it.
- The local lane. `/conductor` in a Claude Code session stays exactly as it is.

## 7. Sequencing

| | what | repo | why in this order |
|---|---|---|---|
| **R1** | Stop + snapshot the sandbox on park | substation | D1 depends on it; it is also a standalone cost bug (§3.2) |
| **R2** | Ship `step.desc` as `payload.prompt`; render `payload.readout.text` | conductor2, cityhall | ~1 hour, makes the callback-path card readable today, and stays the fallback for un-captained gates |
| **R3** | The two run-bearer gate routes (§4) | substation | the captain cannot ask without them |
| **R4** | `runbook_hitl_cli.py` bearer transport (D3) | bureau | |
| **R5** | The captain entrypoint + launch it as the carrier | bureau, substation | the substitution at `reconcile-loop.ts:416` |
| **R6** | Billing default flip (D6) + the `docs/runbooks.md` edit | substation, bureau (human) | gated on **Q1** |

Independently useful and not blocking: `pass.log`'s last lines as a checkpoint on a non-0/75 exit, which `docs/runbook-lane.md` already promises and run `3b601464` did not get.

**Pilot:** `smoke/2.3-hitl` in the cloud, captained — the gate card carries an authored question and the briefs as attachments, answered from the console, run reaches exit 0. The same milestone run `152db1b9` hit today, plus a readable card.

## 8. Decisions

- **D1** — Park-and-exit, not block-and-poll. The captain is the carrier command the reconcile loop launches, replacing bare `conductor advance`. (§3.1)
- **D2** — The captain writes through the run bearer; the sandbox never holds a DB credential. (§4)
- **D3** — One `runbook_hitl_cli.py`, two transports. No fork. (§4)
- **D4** — No conductor2 change. `advance --callback` keeps reporting; `runbook_hitl_ask` already de-duplicates a captain-authored and a callback-authored question at one step. (§4)
- **D5** — The captain gets its own budget cap, separate from the run's step budget, so a repair loop cannot spend the run's cap. (§3.3)
- **D6** — All runbooks default to `subscription`; metered is explicit. One substation change; conductor2 already behaves this way. Requires a human edit to `docs/runbooks.md:85`. (§5)

## 9. Open questions

- **Q1 — whose seat does a cloud subscription run spend?** D6 defaults cloud runs to a lane that today has one shared token, which `docs/runbooks.md:83` forbids sharing. Resolve per-user from `triggered_by`, or hold cloud's default at metered until that exists? **This gates D6.** (§5.2)
- **Q2 — captain-authored vs callback-authored questions.** Both paths can open a question at the same step. `runbook_hitl_ask` makes that safe, but should a captained run suppress conductor's callback gates entirely (and if so, does `--callback` still report the pass?), or is supersede-on-difference the right behaviour? (§4, D4)
- **Q3 — what does the captain see of an earlier pass?** Park-and-exit means a relaunched captain is a fresh session with no memory of the one that parked. The run directory is the state, as always — but is the gate's own question-and-answer history (now preserved per-ask, `attempt` on `runbook_hitl_questions`) enough context for a captain resuming a `report_back`?
- **Q4 — `BLOCKED.md` and the other step readouts.** `SKILL.md` says handle them in chat, never through the app lane. The cloud has no chat. Do they become HITL questions of a new kind, or does a blocked step fail the cloud run? (§2)
- **Q5 — how much captain is too much?** A captain that repairs contracts and prompts in the run's copy is editing the runbook mid-run, unsupervised, in the cloud. Locally an operator sees every edit. Should the cloud captain's repair authority be narrower than the local captain's — say, escalate rather than edit `contract.test.ts` — and is `directives.decide` even meaningful without a human in the session? (§2, B and D)
- **Q6 — 24h.** The sandbox session cap is 86,400,000 ms. With R1 in place a parked run is stopped and resumes from a snapshot, so the cap should not bite. Confirm a stopped-and-snapshotted sandbox genuinely survives past 24 h, and what happens to a session that instead *times out* while parked — the automatic snapshot is taken by `stop()`, and it is unverified whether a timeout leaves one. (§3.1)
