# Runbook Checkpoints + HITL Questions + cityhall UI

**Status:** Draft v2
**Date:** 2026-09-08
**Repos touched:** `substation` (3 new tables + RLS + a **launch route + a reconcile cron** that replace the Inngest launcher + readout export + shared zod schemas), `cityhall` (internal runbook-runs console: list + detail + answer endpoints + rich-card renderer), `bureau` (`runbooks/lib/app_client.py` HITL verbs for the local lane; the decision-schema export for gate contracts; optional `audience:` on gate `step.yaml` — later phase)
**Repos NOT touched for HITL emission:** `conductor2` (the Rust graph runner stays DB-free; **zero changes for our emission path** — verified §B and §2). One *separate* conductor2 engine change is adopted from Jason's control-plane design and owned by him: budget-cap → park-on-operator-gate (§2, D54). `conductor` (legacy TS workflow lane) untouched.
**Companion:** `data-model-spec.html` (ER diagram + a sequence diagram per lane) in this dir.
**Input catalog:** `HITL/runbook-hitl-questions.md` (the cross-runbook HITL question catalog this feature operationalizes; landed via winston#250).

> **Revision note (v2).** v1 built the cloud lane on the existing **Inngest** launcher and a *resume-with-decision Inngest event*. This revision reconciles the spec with Jason's **"Run Control Plane"** design (the run-environment/orchestration side of the same feature) and a grounded code pass. The load-bearing change: **Inngest is removed** from the cloud lane and replaced by a **reconcile control plane** — a hot-path launch route + a Vercel-Cron reconcile loop over the DB run rows, driving a **detached** `conductor advance`. This *simplifies* the cloud lane (the lane uses none of Inngest's differentiating features — verified §B), removes a latent serverless time cap, and makes the DB rows — not an event payload — the whole cross-workstream contract. Secondary changes: the gate taxonomy is widened to the union of both designs (`decision | clarification | operator | hands`); progress/gate emission reads the **run dir structurally** rather than scraping `conductor status` prose; the data model gains the reconcile bookkeeping and a `host` column; and the persistent **one-sandbox-per-project** model is adopted. See §10 (D51–D57) for the full v2 decision delta.

## Problem

Bureau runbooks ask humans questions mid-run — confirm this target, approve this deliverable, name this unknown department, "need you" to buy a record. Today those questions are answerable in exactly one place: **a terminal.** For a **1.0** runbook that's the operator's live Claude Code "captain" session; for a **2.0** graph runbook running unattended in the cloud it's *nowhere* — the run parks (conductor exits 75), the Vercel sandbox stops, and an engineer must SSH-equivalent into the run dir and hand-write `decision.json` to continue (the "D19" gap, driven by hand on 2026-09-08).

There is also **no durable, legible view of a run at all.** conductor2 is deliberately DB-free — "the run directory is the whole state: no database, no registry" (`conductor2/src/main.rs:3-4`) — and the cloud launcher (`substation/src/inngest/functions/runbook-run.ts`) writes **nothing** to the database for a 2.0 run. The only pre-existing run rows are result registries for the 1.0 preprocessing runbooks (`site_plan_preprocessing_run`, `city_response_processing_run`) and the *legacy* checklist lane's `workflow_runs` (`substation/supabase/migrations/00000000000000_baseline.sql:852-874`, which has no `project_id`, no pause state, and no authenticated RLS). So: no unified run identity, no published progress, no way to see "which runs are waiting on a human," and no way to answer them off a terminal.

This spec introduces (1) **runbook checkpoints** — a durable, ordered, per-run event stream every runbook publishes as it advances; (2) **runbook HITL questions** — a run-scoped, UI-answerable question entity with pre-canned + freeform answers, answerable in-session *or* in a UI, that mirrors `AskUserQuestion`; (3) a **cityhall internal console** — a runbook-runs list + detail view, scoped to the `noetic` org, that shows the pipeline, badges pending questions, and lets a noetic user answer them; and (4) — new in v2 — a **reconcile control plane** in substation that drives cloud runs without a job engine.

## 1. Scope, lanes, and phasing

### 1.1 The two lanes (why the plumbing forks)

| | **Local lane** | **Cloud lane** |
|---|---|---|
| Runner | conductor2 in a local rootless Podman container, driven by a live `/conductor` **captain** Claude Code session | conductor2 in a **persistent per-project** Vercel Sandbox, driven by the substation **launch route + reconcile cron** (no Inngest) |
| Runbooks | 1.0 (`RUNBOOK.md`) **and** 2.0 (`runbook.yaml`) | 2.0 only |
| Who owns DB writes | the captain session (via a `bureau/runbooks/lib/app_client.py` shell-out) | the substation launch/reconcile routes |
| Answer channels | **in-session (captain chat) OR the UI** | **UI only** (no captain) |
| Answer delivery | captain **polls** the question row; on answer (either channel) it writes `decision.json` into the *local* run dir and resumes conductor | UI answer → substation answer route writes the answer to the gate row and flips the run to `queued`, then **fires a detached resume advance** on the hot path (reconcile backstops a missed fire); the resume resolves the project sandbox, writes `decision.json` into the run dir, then `conductor advance` |
| Who carries the decision into the run dir | the captain session that launched the run | the resume path (answer-route hot fire, or the reconcile loop as backstop) |
| Why they differ | cityhall's server cannot reach an operator's local filesystem, so the local captain must pull the answer | the sandbox is *stopped* while parked, so only a substation-driven resume (which boots it) can write into it |

The **DB tables are the whole cross-workstream contract**; only emission and answer-delivery differ by lane. In v2 there is **no event contract to agree** — the decision simply lands on the gate row and the resume path pulls it (see §7).

### 1.2 Phasing

- **Phase 1 — local lane, end to end.** The 3 tables; `app_client.py` HITL verbs; the cityhall console (list + detail + answer); answer-once + **multi-turn** (local clarifications are free — the live captain answers from context). Pilot: `smoke/2.3-hitl` run locally.
- **Phase 2 — cloud lane.** The launch route + reconcile cron (replacing the Inngest launcher), a **detached** advance, run-dir-structural emission (run row + checkpoints), readout export to Storage before stop, the answer-route hot resume, and cloud multi-turn via an ad-hoc `conductor run-step` clarifier. Pilot: `smoke/2.3-hitl` in the cloud, answered from a cityhall page, run reaches exit 0 with no terminal, **under a dollar per attempt** (the shared milestone with Jason's design).
- **Phase 3 — generalize + polish.** Prove a 1.0 gate (`preprocessing-v3` publish), author-marked rich checkpoints, `audience:` routing, external notification channels (Slack/email), the keep-warm optimization for sub-minute gates, and the operator/hands gate views once site-research runs on the cloud lane.

### 1.3 Explicitly out of scope

- **Auto-adjudication (`directives.decide`).** The kickoff field that lets an LLM answer a gate against `adjudication.md` criteria is specced but **unimplemented** in conductor2 (verified: no `directives`/`.decide` anywhere in `conductor2/src/*.rs`). Building it is an engine/Jason workstream. We only **display** an agent-decided gate (`channel='agent'`).
- **The engine side of the reconcile control plane.** The detached-command sandbox API, the raised session timeout, and the budget-cap-park behavior (D54) are Jason's run-environment workstream; this spec depends on them and specifies the DB seam, not their internals.
- **The legacy `workflow_runs` / TS-`conductor` checklist lane** (review/CC/CRC). Untouched; copy patterns, never import.
- **Customer-facing HITL.** Gate deciders are noetic staff only; the `isNoetic` gate enforces "never the customer" (handoff standing rule).

## 2. Background facts (grounded)

- **A gate is a `runner: none` step.** It runs no agent; "its status IS its contract" (`conductor2/src/model.rs:28`, `verbs.rs:656-678`). Conductor runs the step's contract test (a `node:test` over `TARGET_DIR`) and reads its exit code (`contract.rs:263-278`, `verbs.rs:1840-1848`). `decision.json` is a **runbook-side convention the contract enforces** — conductor knows nothing about it.
- **Exit codes are the protocol:** `0` done, `75` parked-at-gate ("waiting, not failed"), `1` failed, plus `2` usage, `76` unverified, `77` dirty (`conductor2/src/main.rs:38-60`; 75 emitted `sched.rs:432`, seat-park `verbs.rs:1176-1180`, propagated `verbs.rs:2345-2370`). One `advance` pass drains many nodes to a fixpoint, parking at 75 when something is unfinished, nothing failed, and a child parked.
- **Budget cap → park-on-operator-gate (v2 change, Jason-owned).** Today a `--max-budget-usd` cap surfaces as a *failed* node (`verbs.rs:1244-1250`) — a dead run. Adopting Jason's control-plane design, conductor2 will instead **park on an operator gate** (a distinct exit code) whose readout is the ledger, so a human can raise the cap and resume. This is the one conductor2 **engine** change; it lands in Jason's workstream, and our side needs only the `operator` gate kind we already add for site-research (§3.3, D54).
- **Resume is incremental and token-free for catch-up.** `advance` skips nodes whose contract already passes and never re-executes completed work (`sched.rs:254-267`, "no relaunch after a zero exit" `sched.rs:17-20`). The runbook is a graph of many small, independent agent invocations, each reading its declared inputs from the run dir — **not** one long conversation. Session `--resume` (which replays context into a model) is used **only for a single node's own contract-retry loop** (`claude.rs:7,46-47`), never across a gate. So pausing at a gate for hours and resuming costs the *same* model tokens as answering instantly; the downstream node runs fresh either way. (Caveat: a *seat-park* — an agent pausing itself mid-step, e.g. `site-research/9.7-hands` — does replay that one node's session on resume; that's inherent to that node, bounded to it, and none of our *decision* gates are seat-parks.) Full argument in the appendix.
- **conductor2 is DB-free but not network-free.** `main.rs:3-4` fixes the run dir as the whole state. It already contains a **fire-and-forget telemetry sink** (`telemetry.rs`) that, when armed by its own `CONDUCTOR_TELEMETRY_HOST/TOKEN` pair, POSTs `park` events **with each gate's readout path**, `ledger` lines, and per-pass summaries to its *own* BetterStack source — drop-on-failure, never a failure path (`telemetry.rs:16-19`). This is a **log sink, not an authoritative writer**, and is currently unarmed in cloud (`env.ts:246-254`). It confirms conductor already *emits* everything a "callback" would carry — but the authoritative DB write belongs to the driver, not to conductor (§B). **All checkpoint/question/gate-row writes live in the launch+reconcile routes (cloud) or the captain (local), never in conductor.**
- **Emission reads the run dir structurally, not `conductor status` prose (v2 refinement).** `conductor status` is human prose — one word per step, no readout path, no schema (`verbs.rs:2437-2550`); only its anchored `TOTAL COST: $x` line is safe to scrape (`plan.ts:204-207`). So the driver builds checkpoints + gate rows from **structured run-dir files**: `<run>/ledger.jsonl` for the cost total (`ledger.rs:92-170`), `<run>/*/graph.json` for the declared step list + which are `runner:none`, and each parked gate's `step.yaml` for its `readout:` (`model.rs:705-719`). Only the decision **schema** is not on disk in a machine-readable shape (§3.3 note, Q7).
- **The cloud driver already does most of this.** `runbook-run.ts` already runs `conductor setup` → writes `request.json` → `conductor advance` (capturing exit/stdout) → reads status → treats exit 0/75 as finished → parses the ledger total (`runbook-run.ts:257-306`, `plan.ts:184-216`). What v2 moves is the *shell* it lives in: out of one Inngest function and into a launch route + a reconcile cron, with the advance run **detached**.
- **The advance must be detached; this removes a real cap.** Today the advance runs **blocking** inside one serverless invocation, hard-capped at `maxDuration: 800s` (~13 min, `vercel.ts:8`) with `retries: 0` — so any conductor pass over ~13 min silently kills the run. The Vercel Sandbox SDK supports `detached: true` (`session.d.ts:45`), and the *old* workflow lane already uses it (`workflow-run.ts:161`). A detached advance outlives the short cron/HTTP request and **removes the 800s ceiling** — this is a benefit of dropping Inngest, not just a cost.
- **Persistence is the sandbox snapshot, never Inngest.** What survives a six-week pause is the **stopped, snapshotted per-project sandbox** + conductor's on-disk run dir (`sandbox.ts:6-10,145-154`), which resumes in ~10s with every earlier run dir intact. A sleeping sandbox costs ~$0.08/GB-month and snapshots do not expire, so **one persistent sandbox per project** (named by `project_id`) is the right unit; a phase is a new run dir on that disk that reads earlier phases' outputs by path — no upload/re-download between phases (D55).
- **There is a single-step verb.** `conductor run-step <step> --run <dir> [--force] [--seat]` runs one node's agent out-of-band against a run dir **without advancing the graph** (`main.rs:141-160`, `verbs.rs:599-635`). This is the seam the cloud clarifier uses (§5) — no conductor2 change.

## 3. Data model

Three new tables in `substation` (Postgres/Supabase). Service-role writes; noetic-scoped authenticated `SELECT` (so cityhall can read + subscribe via Realtime). All three added to `supabase_realtime` with `REPLICA IDENTITY FULL`.

### 3.1 `runbook_run` — one row per run (lifecycle + reconcile record)

Modeled on `site_plan_preprocessing_run` (free-JSON metadata + service-role-write RLS, `20260818000000_site_plan_preprocessing_run.sql:43-71`) and `diligence_runs` (rich status enum + timestamps + realtime, `20260529180000_diligence_runs.sql:21-71`). In v2 this row is **also the reconcile loop's record** — the loop repairs sandbox reality to match it.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()`. The run dir is derived — `<runs root>/<runbook>/<id>` — the same shape on every host |
| `runbook_name` | text NOT NULL | `sir` / `sir-new` / `review-new` / `preprocessing-v3` / `smoke` / … (D8) |
| `runbook_ref` | text | git sha/label of the runbook+prompts snapshot |
| `host` | text NOT NULL | **free string, not an enum** (v2, from Jason's design): `vercel` for a cloud Sandbox run, else the machine name (`powerstation`, `ida`, `winston`). The reconcile loop acts **only on `host='vercel'`** rows. The **lane** (`local`\|`cloud`) is *derived*: `host='vercel'` → cloud, else local |
| `status` | text NOT NULL | `queued` \| `running` \| `awaiting_input` \| `completed` \| `failed` \| `cancelled` (D7). `awaiting_input` == "parked with ≥1 open gate"; the gates say which steps |
| `project_id` | uuid FK→`project` (nullable) | indexable tenant scope (D8); also names the persistent sandbox (D55). Derived from inputs when present |
| `submission_version_id` | uuid FK→`submission_version` (nullable) | when the run is submission-scoped |
| `inputs` | jsonb NOT NULL default `'{}'` | the kickoff `request.json` (verbatim) + the derived `plan` step list (D18) |
| `run_dir` | text | denormalized convenience (derivable from `id`); local abs path or the sandbox path |
| `sandbox_id` | text | cloud only; denormalized (the sandbox is *named by* `project_id`, so this is a cache, not the key) |
| `claimed_at` | timestamptz | **the reconcile lease (v2).** A tick/hot-path claims a run before advancing so the two never double-advance one run dir (D51) |
| `session_started_at` | timestamptz | **when the current detached advance was launched (v2).** Read by reconcile to tell *interrupted* from *parked* |
| `last_callback_at` | timestamptz | **when the run last reported park/exit (v2).** `running` + no live session + no callback since `session_started_at` ⇒ interrupted (crash/session-cap), not parked |
| `triggered_by` | uuid FK→`auth.users` (nullable) | who launched (distinct from a gate's answerer) |
| `ledger_total_usd` | numeric | last-known spend, read from `<run>/ledger.jsonl` (or the anchored `TOTAL COST:` line) |
| `error` | text | last failure text |
| `created_at` / `started_at` / `updated_at` / `finished_at` | timestamptz | |

Indexes: `(status)`, `(host)`, `(runbook_name)`, `(project_id)`, `(created_at desc)`; GIN on `inputs`. No "one-active" constraint (a run is a lifecycle record, not a registry — D6).

### 3.2 `runbook_checkpoint` — the ordered stream that drives the UI

One append-only row per published event. **The UI renders this stream**; a `question`-kind row links to a `runbook_hitl_question` for the interactive card (resolves the "one stream drives the UI" requirement, D16/D25). This stream is also **the observability we take back from the Inngest dashboard** — the one genuine thing dropping Inngest costs, and it is already in scope here.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `run_id` | uuid NOT NULL FK→`runbook_run` ON DELETE CASCADE | |
| `seq` | bigint NOT NULL | per-run monotonic order (or use `created_at` + a serial) |
| `kind` | text NOT NULL | `status` \| `note` \| `question` |
| `step_id` | text | the graph step this pertains to (nullable for run-level) |
| `title` | text | e.g. "Phase 3 · synthesis started" |
| `body_md` | text | optional markdown detail / readout excerpt |
| `hitl_question_id` | uuid FK→`runbook_hitl_question` (nullable) | set iff `kind='question'` |
| `created_at` | timestamptz | |

The **static pipeline plan** (D18) is *not* a table: at run start the launch route/captain derives the runbook's full declared step list from `graph.json` and writes it into `runbook_run.inputs`→`plan` (or a lightweight `runbook_run_step` child table if we want per-step status rows — Q1). The UI overlays live checkpoint/status onto that declared plan so every checkpoint is visible even if never "hit."

### 3.3 `runbook_hitl_question` — the run-scoped, UI-answerable gate

Directly modeled on `file_upload_decision` (`20260825000100_file_upload_decision.sql:40-96`), with the key divergence that **options live in the payload JSONB** (RCM `clarifying_question` style), not in a code-side `question_type→choices` map — because runbook gate questions are author-written and open-ended (D10). This entity is the union of v1's `input_type` (decision\|clarification) and Jason's gate `kind` (decision\|operator\|hands): a single **`kind`** enum over all four (D53).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `run_id` | uuid NOT NULL FK→`runbook_run` ON DELETE CASCADE | |
| `gate_step_id` | text NOT NULL | the `runner: none` step id |
| `kind` | text NOT NULL | `decision` \| `clarification` \| `operator` \| `hands` (D53). A **derived** `terminal` = `kind != 'clarification'`: terminal kinds advance the graph on answer; a `clarification` leaves the gate parked |
| `payload` | jsonb NOT NULL | the rendered gate, shape **varies by kind** (below). `readout_storage_path` is **nullable** — operator gates (e.g. `8.1-facts-gate`) have no `readout:` |
| `status` | text NOT NULL default `awaiting_input` | `awaiting_input` \| `answered` \| `applied` \| `dismissed` \| `superseded`. **`applied` (v2)** = the answer has been written into the run dir and the run re-advanced — the reconcile loop's "decided but not yet carried in" state (mirrors Jason's gate `open→decided→applied`, D52) |
| `answer` | jsonb | the chosen answer; shape varies by kind (below) (D12) |
| `answered_by` | uuid FK→`auth.users` (nullable) | null + `channel='agent'` for auto/agent answers (D45) |
| `channel` | text | `ui` \| `session` \| `agent` — which path won (D12) |
| `audience` | text (nullable) | `specialist` \| `engineer` (never customer). Routes notification; from the gate's `audience:` when authored (Phase 3), else defaulted by kind |
| `created_at` / `answered_at` | timestamptz | |

**Payload / answer by kind:**

| kind | readout | payload | answer | who (default audience) |
|---|---|---|---|---|
| `decision` | the digest / SIR readout + built PDF | `{ prompt, options[], allow_freeform, readout_storage_path, schema_ref }` | `{ choice: approved\|revise, decided_by, notes }` → projects to `decision.json` | engineer (delivery) / specialist (content) |
| `clarification` | run context | `{ prompt, allow_freeform }` | `{ question }` — a free note; gate **stays parked**, no `decision.json` (D50) | live captain (local) / clarifier (cloud) |
| `operator` | *(nullable)* a needs-operator note | `{ prompt, void_candidates[], readout_storage_path? }` | `{ void_step, findings, then: re-advance }` — remediation, not approve/revise | engineer |
| `hands` | needs-hands.md (items needing a card/CAPTCHA) | `{ prompt, live_view_url, readout_storage_path }` | `{ hands_done: true }` after acting in the live view | whoever holds the card |

- **Partial UNIQUE index** `(run_id, gate_step_id) WHERE status='awaiting_input'` — at most one *open* question per gate; N open across different gates in a fan-out is fine (D30/D31).
- **Race-safe answer:** conditional `UPDATE … SET status='answered', answer=…, answered_by=…, channel=… WHERE id=? AND status='awaiting_input'` → 0 rows = `409` already-answered (mirrors `file-upload-decisions.ts:74-92`); first valid write wins (D24). The `answered→applied` transition is owned by the resume path, not the UI.
- **`payload.schema_ref`** points at the gate's decision schema so the answer endpoint validates a `decision` before it can win. **Caveat (Q7):** that schema lives as **Zod-in-TS inside each `contract.test.ts`** with a non-uniform export (`smoke/2.3-hitl/contract.test.ts` etc.) and is **not** machine-readable on disk today — so a `schema_ref` needs an extraction step (a conventioned export or `compile.py` emitting the schema into `graph.json`), which lands in **bureau**, not our lane. Until it exists, MVP validates decisions against a substation-authored schema keyed by `(runbook, gate)`.

### 3.4 RLS

All three: RLS enabled; authenticated `SELECT` policy gated to **noetic-org members** via a helper (`public.is_noetic_member(auth.uid())`, a new sibling of the existing `is_noetic_admin`, `baseline.sql:117-135`); **no** authenticated write policy — writes are service-role only (launch/reconcile routes, captain, answer-endpoint). This is what lets cityhall subscribe with `subscribeToRows` client-side while keeping writes controlled (D33).

## 4. Local lane mechanics (Phase 1)

The captain `/conductor` session is the emitter and the answer-poller. New verbs on `bureau/runbooks/lib/app_client.py` (the existing run-scoped-JWT write client; precedent = `register.ts`/`publish.ts` shelling out to the DB — D22):

- `run-start` / `run-update` → upsert `runbook_run` (status, ledger, run_dir, `host=<machine name>`).
- `post-checkpoint --kind … --title … [--body readout.md]` → insert `runbook_checkpoint`.
- `ask --gate <step> --kind <k> [--readout <path>] [--schema <ref>]` → insert `runbook_hitl_question` (payload built for the kind from the gate + readout) **and** a linked `question` checkpoint; upload any readout to Storage.
- `await-answer --gate <step>` → poll the question row (~3–5 s) until `status='answered'`.

Flow: the captain reaches a gate, calls `ask`, then `await-answer`. The operator answers **either** in the captain's chat (the captain writes the row itself, then proceeds) **or** in the cityhall UI (the UI writes the row; the captain's poll sees it). Either way the captain writes `decision.json` into the local run dir, marks the gate `applied`, and runs `conductor advance`. **Multi-turn is free here**: a `clarification` gate is answered by the live captain from run context — it posts a `note` checkpoint and the gate stays `awaiting_input` until a real terminal answer arrives (D50). The reconcile loop **never touches a local run** (it filters `host='vercel'`). See the companion HTML's *local* sequence diagram.

## 5. Cloud lane mechanics (Phase 2) — the reconcile control plane

No job engine. The cloud lane is **four substation routes over the DB rows + a persistent per-project sandbox**, replacing the Inngest launcher (D51). A run advances via a **detached** `conductor advance` that outlives the short HTTP request; the DB row is the record and the reconcile loop repairs reality to match it.

**The four routes** (mirror Jason's control-plane surface):

| route | caller | does |
|---|---|---|
| `POST /api/runs` | cityhall, the conductor skill, prospector | insert a `queued` row (host, inputs, derived `plan`); **on the hot path, resolve/boot the project sandbox and fire the first detached advance**, claiming the lease; return the run id. Reconcile backstops if the hot fire is missed |
| `POST /api/runs/:id/callback` | the detached advance's shell wrapper, at park/exit | a **shell-level** `curl` appended to the advance command (or an exit-sentinel file the loop reads) reports the exit code + ledger; **zero conductor2 change**. exit 0 → `completed`; exit 75 → `awaiting_input` + build gate rows; else → `failed`. Updates `last_callback_at` + cost |
| `POST /api/gates/:id/decide` (a.k.a. the answer route) | the cityhall answer endpoint | validate the answer against the gate schema, write it, mark the gate `answered`, set the run `queued`, and **fire a detached resume advance** on the hot path (reconcile backstops) |
| `GET /api/cron/reconcile` | Vercel Cron, every 2–5 min | walk `host='vercel'` runs and repair reality to match the rows (rules below) |

**Kickoff latency is not the cron interval.** The launch route fires the first advance directly (detached); the 2–5 min tick only bounds **crash recovery** and missed hot-fires, never user-facing start or answer→resume latency.

**Emission (run-dir-structural, D56).** On kickoff the launch route inserts the run row, derives the `plan` from `graph.json`, and streams `status`/`note` checkpoints as passes complete. On **park (exit 75)**, before `stop-sandbox`: (a) **export each waiting gate's `readout:` markdown + any built PDF to Supabase Storage** (D15 — the sandbox is unreadable once stopped); (b) enumerate the parked gates from `graph.json` + status and, **reading each gate's `step.yaml` for its `readout:`** and the schema by `(runbook, gate)`, insert one `runbook_hitl_question` per waiting step (kind per the gate); (c) set the run `awaiting_input`; (d) stop + snapshot. All reads are structured run-dir files, **not** `conductor status` prose.

**Answer → resume.** The answer route writes the answer and flips the run to `queued`, then fires a detached resume: boot the project sandbox from its snapshot (~10s), write `decision.json`/`decision.md` into the gate's folder (the existing `sandbox.writeFiles` path used for `request.json`), mark the gate `applied`, and `conductor advance`. Conductor finds the gate's contract now passes and continues downstream.

**Reconcile rules** (the loop is the guarantee; the callback + hot fires are the fast path):

| row says | reality | action |
|---|---|---|
| `queued` | no live session | claim lease; resume/create the sandbox; write any `answered` gate's decision into the run dir (→ `applied`); fire a detached advance; mark `running` |
| `running` | session live | nothing |
| `running` | session gone, no callback since `session_started_at` | **interrupted** (session-cap or crash): resume + re-advance; conductor picks up at the first unverified step |
| `awaiting_input` | a gate is `answered` | same as `queued` |
| `completed`/`failed` | any | nothing; the sandbox sleeps at storage cost only |

Two ticks never double-advance one run: a **row-level lock + `claimed_at` lease** (D51). The interrupted/parked distinction is exactly what `session_started_at` + `last_callback_at` are for (§3.1).

**Cloud multi-turn (clarifier).** A `clarification` gate triggers a small substation path that boots the project sandbox and runs `conductor run-step <clarifier-step> --run <dir> --force` (the out-of-band single-node verb, §2) to answer from run context, writing the answer into the run dir + a `note` checkpoint — **the gate stays parked** (no `decision.json`). Zero conductor2 change (D50). See the companion HTML's *cloud* sequence diagram.

**Vercel browser (from Jason's design).** Cloud runs use **Browser Use Cloud**, residential proxy **off by default** ($5.00/GB vs $0.20/GB — on only for a site that refuses the datacenter IP). A `hands` gate carries the vendor's **live-view URL** in its payload; the hosted browser caps at 4h, so parking stops it and the resume opens a fresh session that re-navigates to the item (consistent with the 9.7-hands seat-park caveat, §2).

## 6. cityhall UI (Phases 1–2)

- **Route:** new internal section `(app)/runbook-runs/` (list) + `(app)/runbook-runs/[runId]/` (detail). Server-load guard `if (!isNoetic) error(403)` (copy `team/+page.server.ts:6-14`); top-nav link gated by `page.data.isNoetic` (`(app)/+layout.svelte`) (D32).
- **List:** rows with a status badge (mirror `DiligenceRunStatus.svelte`'s `STATUS_CONFIG` map) + a **"HITL pending" badge/count** when the run has `awaiting_input` questions; surface parked runs first (open gates, how long, cost so far, host). Filter by runbook/status. Mirror `projects/+page.svelte`.
- **Detail:** renders the `runbook_checkpoint` stream (the declared step plan with live status overlaid, D18). A `question`-kind entry renders the rich card + answer form for its kind; other entries render as status/note timeline items.
- **Rich card, by kind:** `decision` → readout (markdown + any PDF) + a form from the schema; `operator` → the needs-operator text + "void this step with these findings" + "re-advance"; `hands` → the live-view link with its warning (anyone holding the link controls that browser) + a "done" button; `clarification` → a free-text reply that posts a `note`. Reuse RCM `ClarifyingQuestion.svelte` where it fits, else a new `RunbookHITLQuestion.svelte` (D34). **Persist** answered state on the row.
- **Answer submit:** `POST /api/runbook-hitl-questions/[id]/answer` → substation answer route → (local: row only, captain polls) / (cloud: row + hot resume advance, reconcile backstops). Validates the answer against the gate schema for a terminal kind.
- **Realtime:** `subscribeToRows` on `runbook_checkpoint` + `runbook_hitl_question` filtered by `run_id` (detail) and `runbook_run` (list badge) → debounced `invalidateAll()` (the established pattern, `cityhall/src/lib/realtime.svelte.ts`).
- **Notification:** in-app badge only for MVP, behind a pluggable `notify(audience, run, gate)` seam so Slack/email drop in later (D36). Audience routes it: `specialist` → Sal; `engineer` → Will/Jason.

## 7. The workstream contract (with Jason)

The v2 seam is **the DB rows — there is no event payload to agree** (this is what removing Inngest buys).

**Jason (run environment) provides / we build against:** the persistent per-project sandbox (named by `project_id`) + its **detached-command API** and on-demand snapshot; the raised session timeout (5h → toward 24h so a 7h SIR fits one session); the budget-cap → operator-gate engine change (D54); the run-dir layout + `readout:` paths in `step.yaml`; `conductor run-step` for the clarifier; the decision-schema **extraction** for gate contracts (bureau `compile.py` / a conventioned export — Q7).

**We (HITL UI + control plane) provide / Jason builds against:** the 3 tables + RLS; the four substation routes (launch, callback, decide, reconcile) that **replace** the Inngest launcher; the run-dir-structural emission + readout export; the cityhall console; assignment + notification. The DB rows are the decoupling seam — no event field to agree; the answer route writes the gate row and fires the resume, and the two sides ship independently.

## 8. Sequencing, flags, rollback

1. **substation migration** — 3 tables + RLS + `is_noetic_member` helper.
2. **substation** — the shared zod schemas (question/decision — authored here, DB types flow to cityhall, D35); the **four routes** (launch with hot detached advance; callback/exit-sentinel; answer→hot-resume; reconcile cron) + `claimed_at` lease + run-dir-structural emission + readout export; the clarifier path (Phase 2). **Remove the `runbook-run` Inngest function** once the reconcile loop has driven the smoke runbook end to end. **`bureau/runbooks/lib/app_client.py`** HITL verbs (local, Phase 1).
3. **cityhall** — console routes + guard + per-kind rich card + answer endpoint + realtime + nav.
4. **bureau / conductor2 (Jason)** — decision-schema extraction (Q7); the budget-cap → operator-gate engine change (D54); optional `audience:` `step.yaml` field (Phase 3). No scheduler changes on our side.

- **Flags (D40/D44):** (a) cityhall Edge-Config flag `runbook_runs_console` gating the nav + routes (dark-launch); (b) substation `RUNBOOK_HITL_EMISSION_ENABLED` kill-switch. Both global.
- **Rollback / safety:** all emission is **best-effort and non-blocking** — a failed checkpoint/question write must never fail a run (mirror `createDecision` returning `null` and falling back, `substation/src/lib/file-upload-decision.ts:100-122`). Because the **reconcile loop is the guarantee** and the callback/hot-fires are only a fast path, a missed write self-heals on the next tick. A HITL-infra outage degrades to captain-chat (local) / a manual re-advance (cloud), never a bricked run.

## 9. Pilot plan

1. **`smoke/2.3-hitl` local** — the minimal decision gate (`{status: approved|revise, decided_by, notes}`, `bureau/runbooks/smoke/steps/2.3-hitl/contract.test.ts`), run in Podman, answered from the cityhall console; exercises the full stream + question + answer + resume loop for pennies. Also exercises local multi-turn (a clarification).
2. **`smoke/2.3-hitl` cloud** — same gate via the reconcile control plane: launch route (detached advance) → readout export → question row → answer → hot resume → exit 0, no terminal, **under a dollar** (the shared first milestone). Observed smoke economics from Jason's run: 8 steps / 70s / $0.47, resume ~10s.
3. **`preprocessing-v3` publish gate (1.0)** — proves generality on a live 1.0 runbook (`publish/re-read/stop`, backed by the existing `register.ts`/`publish.ts` writers).

## 10. Decisions (from the design review)

Full v1 log D1–D50 lives in the grill record; the load-bearing ones: local-first (D1); generic schema, 2.0-pilot (D2); local answerable in-session-or-UI, cloud UI-only (D3); new `runbook_run` (D4); launcher/captain own writes (D5); `awaiting_input` status (D7); `project_id`+`runbook_name` columns (D8); `runbook_hitl_question` with options-in-payload (D9–D11); answer+`answered_by`+`channel` on the row (D12); readout export before stop (D15); one `runbook_checkpoint` stream + linked question row (D16/D25); declared-plan overlay (D17/D18); no auto-adjudication, display-only (D20); N-open-questions but one-per-gate unique (D30/D31); `isNoetic` gate + noetic-scoped SELECT RLS (D32/D33); reuse-or-fork the rich card (D34); zod in substation (D35); in-app notification behind a seam (D36); two global flags + best-effort emission (D40/D44); `human_input` supertype + phase-1 multi-turn both lanes via the `run-step` clarifier (D50).

**Superseded by v2:** ~~D13/D14 (cityhall→substation→**Inngest** resume path; launcher writes `decision.json` on the resume event)~~ → the answer route writes the gate row and fires a **detached resume advance**; no event (D51). D49 (always exit-75) **stands but is reframed** — exit-75 + resume is now driven by the reconcile loop, not an Inngest re-send; the token argument (appendix) is unchanged.

**v2 decision delta (reconciling Jason's "Run Control Plane"):**
- **D51 — Remove Inngest; adopt a reconcile control plane.** The lane uses none of Inngest's differentiating features (no `waitForEvent`, retries off by design, no concurrency/sleep/cron/fan-out — verified §B). Replace with `POST /api/runs` (hot-path detached advance) + `GET /api/cron/reconcile` (backstop) + a `claimed_at` lease. Kickoff stays sub-second; the DB row is the whole seam.
- **D52 — Detached advance; gate `status` gains `applied`.** The advance runs `detached:true` (SDK-supported; old-lane precedent) so it outlives the short request and **removes the 800s `maxDuration` cap** that silently killed long passes. The reconcile loop needs a `answered→applied` state (mirrors Jason's `open→decided→applied`).
- **D53 — Merge the gate taxonomy.** One `kind` enum `decision | clarification | operator | hands` + a derived `terminal` flag. v1's `input_type` becomes `terminal`; Jason's `operator`/`hands` become first-class. `readout` is nullable.
- **D54 — Budget cap → park-on-operator-gate.** Adopt Jason's behavior over v1's "fail." The **one conductor2 engine change**, owned by Jason; our side needs only the `operator` kind. (v1's §2 note that a cap "surfaces as a failed node" documented *current* behavior; D54 changes it.)
- **D55 — One persistent sandbox per project.** Named by `project_id`, held asleep for the project's life (~$0.08/GB-month, non-expiring snapshots). A phase is a new run dir on that disk reading earlier phases by path — no upload/re-download.
- **D56 — Emit from the run dir structurally, not `conductor status` prose.** Build checkpoints + gate rows from `ledger.jsonl` + `graph.json` + `step.yaml`; scrape only the anchored `TOTAL COST:` line. Keeps "zero conductor2 changes" for emission and is robust where prose-scraping is fragile (§B).
- **D57 — `host` (free string) replaces `lane` as the stored column.** `host='vercel'` ⇒ cloud (the reconcile loop's filter); machine name ⇒ local. `lane` is derived. Preserves machine identity Jason's design uses.

## 11. Open questions

- **Q1** — `runbook_checkpoint` step plan: store the declared step list in `runbook_run.inputs.plan`, or add a `runbook_run_step` child table with per-step status rows? (Leaning: child table if we want per-step badges/timing; JSON blob if just a static list.)
- **Q2** — Does `scratch/` (where a cloud clarification lands) survive across `advance` passes, or get cleaned? Needs a conductor2 check — decides whether the clarifier writes to `scratch/` or the gate's own output folder.
- **Q3** — *(largely resolved by v2)* Locking when substation writes `decision.json` into a run dir mid-pass. The `claimed_at` lease + row-level lock (D51) plus "the sandbox is stopped while parked" make this safe; confirm the lease covers the hot-fire vs. reconcile-tick race explicitly.
- **Q4** — Should the shared zod schemas move to a small npm package (cityhall + substation both consume) instead of substation-authored + generated types, to avoid RCM-style two-repo drift? (Deferred; generated types are enough for MVP.)
- **Q5 — RESOLVED / struck.** v1 asked whether the *resume-event `decision` field name* was agreed with Jason. v2 removes the event: the decision lands on the gate row and the resume path pulls it (D51). No field to agree. The remaining handshake is only "the answer route owns writing `decision.json`; reconcile backstops" (§7).
- **Q6** — The 1.0 lane's captain is a live agent — do we also want checkpoints for 1.0 runbooks that *don't* fan out (fully inline), or is emission only meaningful at gate/phase boundaries?
- **Q7 — NEW.** Decision-schema extraction. The gate decision schema is **Zod-in-TS in each `contract.test.ts`**, not machine-readable on disk. A `payload.schema_ref` needs an extraction step — a conventioned export or `compile.py` emitting the schema into `graph.json` — which lands in **bureau** (Jason). MVP falls back to a substation-authored schema keyed by `(runbook, gate)`.
- **Q8 — NEW (from Jason's failure modes).** The persistent per-project sandbox's edge cases: image-digest change (recreate + re-clone, the one case that must copy run dirs out and back), a deleted sandbox/region (fail runs on that project; storage deliverables unaffected). Confirm these live in Jason's control-plane workstream, not ours — our rows just need to reflect the resulting `failed` status.

## Appendix — the token-cost finding (why "always exit-75" is safe)

The concern was that tearing down and resuming a cloud run would cost model tokens to "catch the agent back up." It does **not**, and this is an architectural property, not an optimization:

- A `runner: none` gate runs **no agent** — parking replays nothing into a model.
- Runbooks are a **graph of many small independent agent invocations**, each reading its declared inputs from the run dir; there is no single long-lived conversation to replay. The node *after* a gate is a fresh invocation that reads from disk — identical tokens whether the human answered in 2 seconds or 2 days.
- conductor2's session `--resume` (which *does* replay context into a model) is scoped to **a single node's own contract-retry loop** (`conductor2/src/claude.rs:7,46-47`) and never spans a gate.
- `advance` skips already-passing nodes (`sched.rs:254-267`), so no completed work is re-billed.

Net: exit-75 → long human wait → resume costs the same tokens as an instant answer, plus a few wall-clock seconds (snapshot resume ~10s) that a human-scale wait dwarfs. In v2 this resume is driven by the reconcile loop rather than an Inngest re-send — the token argument is identical either way. A keep-warm optimization (hold the sandbox running for a short window polling for a sub-minute answer before stopping) saves those seconds only for sub-minute gates and buys **zero** token savings — hence Phase 3, not MVP.
