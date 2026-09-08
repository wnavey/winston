# Runbook Checkpoints + HITL Questions + cityhall UI

**Status:** Draft v1
**Date:** 2026-09-08
**Repos touched:** `substation` (3 new tables + RLS + launcher emission + resume-with-decision Inngest path + shared zod schemas), `cityhall` (internal runbook-runs console: list + detail + answer endpoints + rich-card renderer), `bureau` (`runbooks/lib/app_client.py` HITL verbs for the local lane; optional `audience:` on gate `step.yaml` — later phase)
**Repos NOT touched:** `conductor2` (the Rust graph runner stays DB-free; **zero changes required** — verified §B), `conductor` (legacy TS workflow lane, untouched)
**Companion:** `data-model-spec.html` (ER diagram + a sequence diagram per lane) in this dir.
**Input catalog:** `HITL/runbook-hitl-questions.md` (the cross-runbook HITL question catalog this feature operationalizes; landed via winston#250).

## Problem

Bureau runbooks ask humans questions mid-run — confirm this target, approve this deliverable, name this unknown department, "need you" to buy a record. Today those questions are answerable in exactly one place: **a terminal.** For a **1.0** runbook that's the operator's live Claude Code "captain" session; for a **2.0** graph runbook running unattended in the cloud it's *nowhere* — the run parks (conductor exits 75), the Vercel sandbox stops, and an engineer must SSH-equivalent into the run dir and hand-write `decision.json` to continue (the "D19" gap, driven by hand on 2026-09-08).

There is also **no durable, legible view of a run at all.** conductor2 is deliberately DB-free — "the run directory is the whole state: no database, no registry" (`conductor2/src/main.rs:3-4`) — and the cloud launcher (`substation/src/inngest/functions/runbook-run.ts`) writes **nothing** to the database for a 2.0 run. The only pre-existing run rows are result registries for the 1.0 preprocessing runbooks (`site_plan_preprocessing_run`, `city_response_processing_run`) and the *legacy* checklist lane's `workflow_runs` (`substation/supabase/migrations/00000000000000_baseline.sql:852-874`, which has no `project_id`, no pause state, and no authenticated RLS). So: no unified run identity, no published progress, no way to see "which runs are waiting on a human," and no way to answer them off a terminal.

This spec introduces (1) **runbook checkpoints** — a durable, ordered, per-run event stream every runbook publishes as it advances; (2) **runbook HITL questions** — a run-scoped, UI-answerable question entity with pre-canned + freeform answers, answerable in-session *or* in a UI, that mirrors `AskUserQuestion`; and (3) a **cityhall internal console** — a runbook-runs list + detail view, scoped to the `noetic` org, that shows the pipeline, badges pending questions, and lets a noetic user answer them.

## 1. Scope, lanes, and phasing

### 1.1 The two lanes (why the plumbing forks)

| | **Local lane** | **Cloud lane** |
|---|---|---|
| Runner | conductor2 in a local rootless Podman container, driven by a live `/conductor` **captain** Claude Code session | conductor2 in a per-project Vercel Sandbox, driven by the substation `runbook/run` Inngest launcher |
| Runbooks | 1.0 (`RUNBOOK.md`) **and** 2.0 (`runbook.yaml`) | 2.0 only |
| Who owns DB writes | the captain session (via a `bureau/runbooks/lib/app_client.py` shell-out) | the substation launcher |
| Answer channels | **in-session (captain chat) OR the UI** | **UI only** (no captain) |
| Answer delivery | captain **polls** the question row; on answer (either channel) it writes `decision.json` into the *local* run dir and resumes conductor | UI answer → substation → **Inngest resume event** → launcher writes `decision.json` into the run dir, then `conductor advance` |
| Why they differ | cityhall's server cannot reach an operator's local filesystem, so the local captain must pull the answer | the sandbox is *stopped* while parked, so only the launcher (on resume) can write into it |

The **DB tables are the shared contract**; only emission and answer-delivery differ by lane.

### 1.2 Phasing

- **Phase 1 — local lane, end to end.** The 3 tables; `app_client.py` HITL verbs; the cityhall console (list + detail + answer); answer-once + **multi-turn** (local clarifications are free — the live captain answers from context). Pilot: `smoke/2.3-hitl` run locally.
- **Phase 2 — cloud lane.** Launcher emission (run row + checkpoints), readout export to Storage before stop, resume-with-decision Inngest event, and cloud multi-turn via an ad-hoc `conductor run-step` clarifier. Pilot: `smoke/2.3-hitl` in the cloud, answered from a cityhall page, run reaches exit 0 with no terminal.
- **Phase 3 — generalize + polish.** Prove a 1.0 gate (`preprocessing-v3` publish), author-marked rich checkpoints, `audience:` routing, external notification channels (Slack/email), the keep-warm hybrid optimization for sub-minute gates.

### 1.3 Explicitly out of scope

- **Auto-adjudication (`directives.decide`).** The kickoff field that lets an LLM answer a gate against `adjudication.md` criteria is specced but **unimplemented** in conductor2 (verified: no `directives`/`.decide` anywhere in `conductor2/src/*.rs`). Building it is an engine/Jason workstream. We only **display** an agent-decided gate (`channel='agent'`).
- **The legacy `workflow_runs` / TS-`conductor` checklist lane** (review/CC/CRC). Untouched; copy patterns, never import.
- **Customer-facing HITL.** Gate deciders are noetic staff only; the `isNoetic` gate enforces "never the customer" (handoff standing rule).

## 2. Background facts (grounded)

- **A gate is a `runner: none` step.** It runs no agent; "its status IS its contract" (`conductor2/src/model.rs:28`, `verbs.rs:656-678`). Conductor runs the step's contract test (a `node:test` over `TARGET_DIR`) and reads its exit code (`contract.rs:263-278`, `verbs.rs:1840-1848`). `decision.json` is a **runbook-side convention the contract enforces** — conductor knows nothing about it.
- **Exit codes are the protocol:** `0` done, `75` parked-at-gate ("waiting, not failed"), `1` failed (`conductor2/src/main.rs:38-60`; 75 emitted `sched.rs:422-433`). One `advance` pass drains many nodes to a fixpoint, parking at 75 when something is unfinished, nothing failed, and a child parked. (A `--max-budget-usd` cap surfaces as a *failed* node, not a park — `verbs.rs:1244-1250`.)
- **Resume is incremental and token-free for catch-up.** `advance` skips nodes whose contract already passes and never re-executes completed work (`sched.rs:254-267`, "no relaunch after a zero exit" `sched.rs:17-20`). The runbook is a graph of many small, independent agent invocations, each reading its declared inputs from the run dir — **not** one long conversation. Session `--resume` (which replays context into a model) is used **only for a single node's own contract-retry loop** (`claude.rs:7,46-47`), never across a gate. So pausing at a gate for hours and resuming costs the *same* model tokens as answering instantly; the downstream node runs fresh either way. (Caveat: a *seat-park* — an agent pausing itself mid-step, e.g. `site-research/9.7-hands` — does replay that one node's session on resume; that's inherent to that node, bounded to it, and none of our decision gates are seat-parks.)
- **conductor2 is DB-free** (`main.rs:3-4`); it emits only stdout + exit codes + run-dir files (+ an optional fire-and-forget telemetry log). **All checkpoint/question emission must live in the launcher (cloud) or the captain (local), never in conductor.**
- **The cloud launcher already has the resume half.** `runbook-run.ts` keys on `resuming = Boolean(data.resume_run_dir)` (`:146`); a resume skips only `conductor-setup` (`:238`) and `write-request` (`:246`), re-runs `conductor advance` (`:257`), and stops+snapshots the sandbox on exit 0/75 (`:289-293`). Snapshot preserves the whole `/vercel/sandbox` filesystem incl. every run dir (`sandbox.ts:6-10`). What's missing is everything between "stopped at 75" and "`decision.json` exists."
- **There is a single-step verb.** `conductor run-step <step> --run <dir> [--force] [--seat]` runs one node's agent out-of-band against a run dir **without advancing the graph** (`main.rs:141-160`, `verbs.rs:599-635`). This is the seam the cloud clarifier uses (§7.4) — no conductor2 change.

## 3. Data model

Three new tables in `substation` (Postgres/Supabase). Service-role writes; noetic-scoped authenticated `SELECT` (so cityhall can read + subscribe via Realtime). All three added to `supabase_realtime` with `REPLICA IDENTITY FULL`.

### 3.1 `runbook_run` — one row per run (lifecycle)

Modeled on `site_plan_preprocessing_run` (one-active partial-unique-index + free-JSON metadata + service-role-write RLS, `substation/supabase/migrations/20260818000000_site_plan_preprocessing_run.sql:43-71`) and `diligence_runs` (rich status enum + timestamps + realtime, `20260529180000_diligence_runs.sql:21-71`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `runbook_name` | text NOT NULL | `sir` / `sir-new` / `review-new` / `preprocessing-v3` / `smoke` / … (D8) |
| `runbook_ref` | text | git sha/label of the runbook+prompts snapshot |
| `lane` | text NOT NULL | `local` \| `cloud` |
| `status` | text NOT NULL | `queued` \| `running` \| `awaiting_input` \| `completed` \| `failed` \| `cancelled` (D7) |
| `project_id` | uuid FK→`project` (nullable) | indexable tenant scope (D8); derived from inputs when present |
| `submission_version_id` | uuid FK→`submission_version` (nullable) | when the run is submission-scoped |
| `inputs` | jsonb NOT NULL default `'{}'` | the kickoff `request.json` (verbatim) |
| `run_dir` | text | run directory path (`$SANDBOX_ROOT/runs/…` cloud; local abs path) |
| `sandbox_id` | text | cloud only |
| `inngest_event_id` | text | cloud only; the resume discriminator |
| `triggered_by` | uuid FK→`auth.users` (nullable) | who launched (distinct from a gate's answerer) |
| `ledger_total_usd` | numeric | last-known spend (parsed from `conductor status`) |
| `error` | text | on failure |
| `created_at` / `started_at` / `updated_at` / `finished_at` | timestamptz | |

Indexes: `(status)`, `(runbook_name)`, `(project_id)`, `(created_at desc)`; GIN on `inputs`. No "one-active" constraint (a run is a lifecycle record, not a registry — D6).

### 3.2 `runbook_checkpoint` — the ordered stream that drives the UI

One append-only row per published event. **The UI renders this stream**; a `question`-kind row links to a `runbook_hitl_question` for the interactive card (resolves the "one stream drives the UI" requirement, D16/D25).

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

The **static pipeline plan** (D18) is *not* a table: at run start the launcher/captain derives the runbook's full declared step list from `graph.json` and writes it into `runbook_run.inputs`→`plan` (or a lightweight `runbook_run_step` child table if we want per-step status rows). The UI overlays live checkpoint/status onto that declared plan so every checkpoint is visible even if never "hit."

### 3.3 `runbook_hitl_question` — the run-scoped, UI-answerable question

Directly modeled on `file_upload_decision` (`substation/supabase/migrations/20260825000100_file_upload_decision.sql:40-96`), with the key divergence that **options live in the payload JSONB** (RCM `clarifying_question` style), not in a code-side `question_type→choices` map — because runbook gate questions are author-written and open-ended, not a fixed set of ~4 types (D10).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `run_id` | uuid NOT NULL FK→`runbook_run` ON DELETE CASCADE | |
| `gate_step_id` | text NOT NULL | the `runner: none` step id |
| `input_type` | text NOT NULL | `decision` \| `clarification` — the "human-input supertype" (D50). Only `decision` projects to `decision.json` |
| `payload` | jsonb NOT NULL | the rendered question: `{ prompt, options:[{label, source?}], allow_freeform, readout_storage_path?, schema_ref }` — **generated from the gate's zod contract** at park time (D11) |
| `status` | text NOT NULL default `awaiting_input` | `awaiting_input` \| `answered` \| `dismissed` \| `superseded` |
| `answer` | jsonb | the chosen answer, e.g. `{ choice, notes }` (a `decision`) or `{ question }` (a `clarification`) (D12) |
| `answered_by` | uuid FK→`auth.users` (nullable) | null + `channel='agent'` for auto/agent answers (D45) |
| `channel` | text | `ui` \| `session` \| `agent` — which path won (D12) |
| `created_at` / `answered_at` | timestamptz | |

- **Partial UNIQUE index** `(run_id, gate_step_id) WHERE status='awaiting_input'` — at most one *open* question per gate; N open across different gates in a fan-out is fine (D30/D31).
- **Race-safe answer:** conditional `UPDATE … SET status='answered', answer=…, answered_by=…, channel=… WHERE id=? AND status='awaiting_input'` → 0 rows = `409` already-answered (mirrors `file-upload-decisions.ts:74-92`); first valid write wins (D24).
- **`payload.schema_ref`** points at the gate's zod schema (authored in substation, §8) so the answer endpoint validates a `decision` before it can win.

### 3.4 RLS

All three: RLS enabled; authenticated `SELECT` policy gated to **noetic-org members** via a helper (`public.is_noetic_member(auth.uid())`, a new sibling of the existing `is_noetic_admin`, `baseline.sql:117-135`); **no** authenticated write policy — writes are service-role only (launcher/captain/answer-endpoint). This is what lets cityhall subscribe with `subscribeToRows` client-side while keeping writes controlled (D33).

## 4. Local lane mechanics (Phase 1)

The captain `/conductor` session is the emitter and the answer-poller. New verbs on `bureau/runbooks/lib/app_client.py` (the existing run-scoped-JWT write client; precedent = `register.ts`/`publish.ts` shelling out to the DB — D22):

- `run-start` / `run-update` → upsert `runbook_run` (status, ledger, run_dir).
- `post-checkpoint --kind … --title … [--body readout.md]` → insert `runbook_checkpoint`.
- `ask --gate <step> --readout <path> --schema <ref>` → insert `runbook_hitl_question` (payload generated from the gate schema + readout) **and** a linked `question` checkpoint; upload the readout to Storage.
- `await-answer --gate <step>` → poll the question row (~3–5 s) until `status='answered'`.

Flow: the captain reaches a gate, calls `ask`, then `await-answer`. The operator answers **either** in the captain's chat (the captain writes the row itself, then proceeds) **or** in the cityhall UI (the UI writes the row; the captain's poll sees it). Either way the captain writes `decision.json` into the local run dir and runs `conductor advance`. **Multi-turn is free here**: a `clarification` row (input_type=`clarification`) is answered by the live captain from run context — it posts a `note` checkpoint and the gate stays `awaiting_input` until a real `decision` arrives (D50). See the companion HTML's *local* sequence diagram.

## 5. Cloud lane mechanics (Phase 2)

The substation launcher emits and delivers answers:

- **On kickoff:** launcher inserts `runbook_run` (`lane='cloud'`, status `running`), derives the step plan from `graph.json`, and emits `status`/`note` checkpoints from `conductor status` node transitions (D17 — no conductor2 change).
- **On exit 75 (park):** before `stop-sandbox` (`runbook-run.ts:289-293`), the launcher (a) **exports the gate's `readout:` markdown + any built PDF to Supabase Storage** (D15 — the sandbox is unreadable once stopped), (b) inserts the `runbook_hitl_question` (payload from the gate zod schema + the exported readout path), and (c) sets `runbook_run.status='awaiting_input'`.
- **On answer:** cityhall answer endpoint → substation endpoint (thin proxy, mirrors `file-upload-decisions`) → substation posts a `runbook/run` **resume** Inngest event carrying `resume_run_dir` + `decision:{gate, json, md}` (D13/D14). The launcher writes `decision.json`/`decision.md` into the run dir (the existing `sandbox.writeFiles` path used for `request.json`), then `conductor advance`.
- **Wait model:** **always exit-75 + resume** (D49). Verified token-free for catch-up (§2). The keep-warm hybrid (short `step.waitForEvent` window before stopping, for sub-minute gates) is a Phase-3 optimization only — it saves wall-clock seconds, not tokens.
- **Cloud multi-turn (clarifier):** a `clarification` row triggers a small substation path that resolves the project sandbox and runs `conductor run-step <clarifier-step> --run <dir> --force` (the out-of-band single-node verb, §2) to answer from run context, writing the answer into the run dir + a `note` checkpoint — **the gate stays parked** (no `decision.json`). Zero conductor2 change (D50). See the companion HTML's *cloud* sequence diagram.

## 6. cityhall UI (Phases 1–2)

- **Route:** new internal section `(app)/runbook-runs/` (list) + `(app)/runbook-runs/[runId]/` (detail). Server-load guard `if (!isNoetic) error(403)` (copy `team/+page.server.ts:6-14`); top-nav link gated by `page.data.isNoetic` (`(app)/+layout.svelte`) (D32).
- **List:** rows with a status badge (mirror `DiligenceRunStatus.svelte`'s `STATUS_CONFIG` map) + a **"HITL pending" badge/count** when the run has `awaiting_input` questions. Filter by runbook/status. Mirror `projects/+page.svelte`.
- **Detail:** renders the `runbook_checkpoint` stream (the declared step plan with live status overlaid, D18). A `question`-kind entry renders the rich card + answer form; other entries render as status/note timeline items.
- **Rich card:** reuse RCM `ClarifyingQuestion.svelte` + `ClarifyingQuestionPayloadSchema` (`cityhall/src/lib/rcm/`) if it fits; otherwise a new `RunbookHITLQuestion.svelte` (D34). **Persist** answered state on the row (the RCM card derives it from the next chat message — a runbook pipeline must store it).
- **Answer submit:** `POST /api/runbook-hitl-questions/[id]/answer` → substation proxy → (local: row only, captain polls) / (cloud: row + resume event). Validates the answer against `payload.schema_ref` for a `decision`.
- **Realtime:** `subscribeToRows` on `runbook_checkpoint` + `runbook_hitl_question` filtered by `run_id` (detail) and `runbook_run` (list badge) → debounced `invalidateAll()` (the established pattern, `cityhall/src/lib/realtime.svelte.ts`).
- **Notification:** in-app badge only for MVP, behind a pluggable `notify(audience, run, gate)` seam so Slack/email drop in later (D36).

## 7. The workstream contract (with Jason)

**Jason (run environment) provides / we build against:** the launcher + its Inngest event shape (extended with a `decision` field); the per-project run token; `conductor status` text; the run-dir layout + `readout:` paths from `step.yaml`; the gate decision zod schemas in each `contract.test.ts`; the stop-on-75 snapshot behavior; `conductor run-step` for the clarifier.

**We (HITL UI) provide / Jason builds against:** the 3 tables + RLS; the launcher-side emission + readout export (lands in substation, so we author it in coordination); the resume-with-decision event contract (field name `decision`); the cityhall console; assignment + notification. The DB tables are the decoupling seam — agree the event field name and the two sides ship independently.

## 8. Sequencing, flags, rollback

1. **substation migration** — 3 tables + RLS + `is_noetic_member` helper.
2. **substation** — the shared zod schemas (question/decision — authored here, DB types flow to cityhall, D35); launcher emission + readout export; resume-with-decision event + `decision.json` writer; the answer proxy endpoint; the clarifier path (Phase 2). **`bureau/runbooks/lib/app_client.py`** HITL verbs (local, Phase 1).
3. **cityhall** — console routes + guard + rich card + answer endpoint + realtime + nav.
4. **conductor2 / runbooks** — *only if needed*: an `audience:` `step.yaml` field (Phase 3). No runner/scheduler changes.

- **Flags (D40/D44):** (a) cityhall Edge-Config flag `runbook_runs_console` gating the nav + routes (dark-launch); (b) substation `RUNBOOK_HITL_EMISSION_ENABLED` kill-switch. Both global.
- **Rollback / safety:** all emission is **best-effort and non-blocking** — a failed checkpoint/question write must never fail a run (mirror `createDecision` returning `null` and falling back, `substation/src/lib/file-upload-decision.ts:100-122`). A HITL-infra outage degrades to captain-chat (local) / terminal (cloud), never a bricked run.

## 9. Pilot plan

1. **`smoke/2.3-hitl` local** — the minimal decision gate (`{status: approved|revise, decided_by, notes}`, `bureau/runbooks/smoke/steps/2.3-hitl/contract.test.ts`), run in Podman, answered from the cityhall console; exercises the full stream + question + answer + resume loop for pennies. Also exercises local multi-turn (a clarification).
2. **`smoke/2.3-hitl` cloud** — same gate via the launcher: readout export → question row → answer → resume event → exit 0, no terminal (the handoff's suggested first milestone).
3. **`preprocessing-v3` publish gate (1.0)** — proves generality on a live 1.0 runbook (`publish/re-read/stop`, backed by the existing `register.ts`/`publish.ts` writers).

## 10. Decisions (from the design review)

Full log D1–D50 lives in the grill record; the load-bearing ones: local-first (D1); generic schema, 2.0-pilot (D2); local answerable in-session-or-UI, cloud UI-only (D3); new `runbook_run` (D4); launcher/captain own writes (D5); `awaiting_input` status (D7); `project_id`+`runbook_name` columns (D8); `runbook_hitl_question` with options-in-payload generated from the gate zod contract (D9–D11); answer+`answered_by`+`channel` on the row (D12); launcher writes `decision.json` on resume (D13); cityhall→substation→Inngest resume path (D14); readout export before stop (D15); one `runbook_checkpoint` stream + linked question row (D16/D25); launcher-derived checkpoints + declared-plan overlay (D17/D18); no auto-adjudication, display-only (D20); N-open-questions but one-per-gate unique (D30/D31); `isNoetic` gate + noetic-scoped SELECT RLS (D32/D33); reuse-or-fork the rich card (D34); zod in substation (D35); in-app notification behind a seam (D36); two global flags + best-effort emission (D40/D44); **always exit-75, token-verified** (D49); **`human_input` supertype + phase-1 multi-turn both lanes via the `run-step` clarifier** (D50).

## 11. Open questions

- **Q1** — `runbook_checkpoint` step plan: store the declared step list in `runbook_run.inputs.plan`, or add a `runbook_run_step` child table with per-step status rows? (Leaning: child table if we want per-step badges/timing; JSON blob if just a static list.)
- **Q2** — Does `scratch/` (where a cloud clarification lands) survive across `advance` passes, or get cleaned? Needs a conductor2 check now that it's available — decides whether the clarifier writes to `scratch/` or the gate's own output folder.
- **Q3** — Locking when substation writes `decision.json`/a clarification into a run dir while a `conductor advance` might be mid-pass (top-level advance locking not yet inspected). Likely a non-issue because the sandbox is stopped while parked, but confirm.
- **Q4** — Should the shared zod schemas move to a small npm package (cityhall + substation both consume) instead of substation-authored + generated types, to avoid the RCM-style two-repo drift the catalog research flagged? (Deferred; generated types are enough for MVP.)
- **Q5** — Cross-workstream: is the cloud wait model staying **exit-75** (D49) acceptable to Jason as the launcher owner, and is the resume-event `decision` field name agreed?
- **Q6** — The 1.0 lane's captain is a live agent — do we also want checkpoints for 1.0 runbooks that *don't* fan out (fully inline), or is the emission only meaningful at gate/phase boundaries?

## Appendix — the token-cost finding (why "always exit-75" is safe)

The concern was that tearing down and resuming a cloud run would cost model tokens to "catch the agent back up." It does **not**, and this is an architectural property, not an optimization:

- A `runner: none` gate runs **no agent** — parking replays nothing into a model.
- Runbooks are a **graph of many small independent agent invocations**, each reading its declared inputs from the run dir; there is no single long-lived conversation to replay. The node *after* a gate is a fresh invocation that reads from disk — identical tokens whether the human answered in 2 seconds or 2 days.
- conductor2's session `--resume` (which *does* replay context into a model) is scoped to **a single node's own contract-retry loop** (`conductor2/src/claude.rs:7,46-47`) and never spans a gate.
- `advance` skips already-passing nodes (`sched.rs:254-267`), so no completed work is re-billed.

Net: exit-75 → long human wait → resume costs the same tokens as an instant answer, plus a few wall-clock seconds (VM cold-boot + `npm ci`) that a human-scale wait dwarfs. The keep-warm hybrid saves those seconds only for sub-minute gates and buys **zero** token savings — hence Phase 3, not MVP.
