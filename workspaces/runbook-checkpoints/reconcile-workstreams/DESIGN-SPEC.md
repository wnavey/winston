# Reconciling the two Runbook Control Plane workstreams

**Status:** Draft v1
**Date:** 2026-09-09
**Repos touched (proposed):** `substation` (converge one migration + one route surface), `bureau` (re-target the local captain CLI), `cityhall` (re-target the console)
**Repos NOT touched:** `conductor2` (still DB-free; still zero emission changes)
**Companion:** `reconcile-diagram.html` (4-tab visual: summary · code deltas · data deltas · path forward) in this dir.
**Supersedes context:** the `runbook-checkpoints` spec (`../DESIGN-SPEC.md`) + its `../data-model-spec.html`.

> **One-line problem.** The same feature got built twice, in parallel, with different table names, a different gate model, and an overlapping decide route — and **Jason's half already merged to `main`**. This spec categorizes every delta and proposes a fix-forward that keeps one canonical schema and one route surface.

## Problem

Two implementations of the runbook control plane / HITL feature landed at the same time:

- **A — merged.** Jason's `substation#247` ("Scaffold the run control plane", commit `d1c082b`, merged to `main` 2026-09-09) added **two tables** (`public.runs`, `public.gates`) and **four routes** (`POST /api/runs`, `POST /api/runs/:id/callback`, `POST /api/gates/:id/decide`, `GET /api/cron/reconcile`), a per-run HMAC bearer, ajv schema validation, and a full route-test suite. Reconcile is a **dry-run stub**; RLS has **no policies**; realtime is **off**.
- **B — open (mine).** `substation#245` + `bureau#1549` + `cityhall#663` added **three tables** (`runbook_run`, `runbook_checkpoint`, `runbook_hitl_question`), **one** substation route (`POST /api/runbook-hitl-questions/:id/answer`), the **local captain lane** (bureau `app_client.py` + `runbook_hitl_cli.py`), the **cityhall console UI** (list + detail + per-kind rich cards), and **live RLS + realtime**.

They collided first on a migration filename (`20260908000000`, fixed by renaming mine to `20260909000000`), but the real collision is architectural. This spec is the reconciliation of record.

The categories below use the **venn framing the request asked for**: *A-only*, *B-only*, *overlap* — first for **code**, then for the **data model** — then a **fix-forward plan** keyed to the three open PRs.

---

## 1. The two implementations in one breath

- **A is the cloud spine.** A run is *registered* by a plain API call; conductor *reports its own outcome* by exit code to a callback; a timer *will* walk the Vercel rows. Machine-to-machine, no user identity, no UI, cloud-only. The hard parts — detached-sandbox liveness, the HMAC bearer a sandbox can hold, the exit-code contract — are done (reconcile's effectful body is not).
- **B is the human surface + the local lane.** A checkpoint stream drives a cityhall console; a noetic user answers a gate with real attribution; a live local `/conductor` captain writes and polls the same rows; RLS + realtime are on. The cloud *driver* is deferred (B's answer route only flips the run to `queued` and names A's reconcile loop as the guarantee).

**They are complements as much as competitors.** Almost everything B built, A lacks (UI, local lane, stream, RLS/realtime, clarification). Almost everything A built, B lacks (launch, callback, reconcile, bearer, ajv, liveness). The genuine *overlap* is small: the decide/answer route, the run table, the gate table, and the status vocabulary.

---

## 2. Code feature deltas (venn)

### 2A — A built, B did not
- `POST /api/runs` launch/register + per-run HMAC bearer minted on insert.
- `POST /api/runs/:id/callback` — conductor park/exit callback (`statusForExit`: 0→done, 75→parked, else→failed; upserts one `gates` row per waiting step).
- `GET /api/cron/reconcile` — the reconcile route (**dry-run stub**) + the pure `planFor` / `actionForProbe` / `probe_session` liveness logic.
- Per-run **HMAC bearer** (`run-bearer.ts`, HMAC-SHA256 of run id keyed by `RUN_CALLBACK_SECRET`, derived-not-stored, constant-time) — a credential a sandbox can hold with no DB access.
- **ajv** JSON-Schema validation of a decision against a **per-gate stored schema** (`gates.schema`).
- Sandbox **liveness** columns + `Command.wait` probe design.
- A **route-test suite** (runs/gates/cron-reconcile/run-bearer) against an in-memory PostgREST fake.

### 2B — B built, A did not
- **Checkpoint stream** table + emission everywhere (`postCheckpoint` / `create_hitl_question` emit a linked `question` checkpoint) — one stream drives the UI.
- **`clarification` gate kind** — non-terminal, parks-not-advances (records a note, leaves the gate open).
- **Live RLS policies** (noetic-member SELECT) + `is_noetic_member()` + **Realtime + REPLICA IDENTITY FULL** on all tables.
- **Bureau LOCAL lane** — `app_client.py` writers + the captain CLI (`run-start` / `run-update` / `post-checkpoint` / `ask` / `await-answer`), in-session answering (`channel='session'`), readout upload, and the poll → write `decision.json` → mark `applied` loop.
- **cityhall console UI** — `/runbook-runs` list (HITL-pending badges) + `[runId]` detail (checkpoint stream + question cards), the per-kind `RunbookHITLQuestion.svelte` rich cards, and the cityhall answer proxy.
- **Real user attribution** (`answered_by` FK to `auth.users`) + **`channel` provenance** (ui/session/agent).
- The `(runbook, gate)` **decision-schema registry** (an MVP alternative to schema-on-gate).

### 2·∩ — both built, differently (the real conflict)
- **Decide / answer route.** A: `POST /api/gates/:id/decide` — ajv vs stored `gates.schema`, run-bearer/service auth, no user identity, `parked→queued`. B: `POST /api/runbook-hitl-questions/:id/answer` — zod kind-aware vs registry, noetic-JWT auth (`answered_by`, `channel`), **clarification parks**, explicit local-vs-cloud lane split.
- **Reconcile loop** — A has the route (dry-run), B names it as the guarantee. **Neither has a live loop.**

---

## 3. Data entity model deltas (venn)

### 3·∩ — the same two entities, renamed + reshaped

| A `runs` | B `runbook_run` | verdict |
|---|---|---|
| `runbook` | `runbook_name` | rename |
| `request` | `inputs` | rename |
| `host` | `host` | **same** |
| `status` = `queued/running/parked/done/failed` | `status` = `queued/running/awaiting_input/completed/failed/cancelled` | **enum conflict** |
| `cost_usd NUMERIC(12,4)` | `ledger_total_usd NUMERIC` | rename + tighten type |
| `session_started_at` / `last_callback_at` | same | **same** |

| A `gates` | B `runbook_hitl_question` | verdict |
|---|---|---|
| `step` | `gate_step_id` | rename |
| `kind` = `decision/operator/hands` | `kind` = `decision/clarification/operator/hands` | **B adds `clarification`** |
| `schema JSONB` (on the row) | *(none — code registry)* | **A-only; conflict** |
| `readout_prefix`, `live_view_url` (columns) | *(inside `payload JSONB`)* | shape conflict |
| `decision` / `decided_by TEXT` / `decided_at` | `answer` / `answered_by UUID→auth.users` / `answered_at` | rename + **B upgrades `decided_by` to a real FK** |
| `status` = `open/decided/applied` | `status` = `awaiting_input/answered/applied/dismissed/superseded` | **enum conflict** |
| `UNIQUE(run_id, step)` + **upsert-on-repark** | **partial-unique** `WHERE status='awaiting_input'` + new row per re-ask | uniqueness-model conflict |

### 3A — A-only columns
`sandbox_session_id`, `cmd_id` (liveness); `gates.schema` (per-gate JSON Schema).

### 3B — B-only entities / columns
- **`runbook_checkpoint`** — the whole append-only stream table (no A equivalent).
- On the run: `claimed_at` (lease), `sandbox_id`, `run_dir`, `runbook_ref`, `submission_version_id`, `triggered_by`, `started_at`/`finished_at`, GIN(`inputs`).
- On the gate: `payload JSONB`, `channel`.

---

## 4. Key conflicting assumptions (force a decision on each)

1. **2 tables vs 3** — is there a dedicated checkpoint stream, or does status + gates carry everything?
2. **Gate folds the decision vs separate question + stream** — one row that re-parks in place (A upsert) vs a question row + a stream, re-ask = new row (B).
3. **Schema-on-gate (ajv) vs schema-registry (zod)** — where does the decision contract live?
4. **Enum literals** — `parked` vs `awaiting_input`; `done` vs `completed`; `open/decided` vs `awaiting_input/answered`. Same lifecycle, incompatible strings.
5. **HMAC-bearer callback vs no callback** — sandbox reports via a per-run bearer (A) vs no substation callback, captain writes directly (B).
6. **Cloud-only vs local+cloud** — A acts on `host='vercel'` only; B ships a real local captain lane too.
7. **No stream + realtime off vs stream + realtime on** — A route-mediated reads; B direct RLS reads + realtime (the "shape (b)" A left as "Will's call").
8. **Upsert-on-repark vs partial-unique-on-open** — one durable gate row vs open-plus-history.
9. **Auth: run-bearer/service (no user) vs noetic-JWT (real `answered_by` + `channel`).**
10. **`run_dir` stored vs derived** — A deliberately omits it ("two spellings of one path is how a resume points at a directory that doesn't exist"); B stores it as convenience. **Direct disagreement.**
11. **`clarification` in or out** of the `kind` CHECK.

---

## 5. Proposed path forward

**Principle: converge on A's merged base; graft B's additive surface onto it.** A is on `main`, has the harder cloud plumbing and a test suite, and calls itself the design of record. B's differentiators are overwhelmingly *additive* to A's tables — they don't require A's shape to change, only to grow. Re-targeting B's names is cheaper and less risky than unwinding a merged migration.

### 5.1 The converged data model — `runs` + `gates` + a new `checkpoints`
- **Keep `runs` and `gates`** (A's names, on `main`).
- **Add a third table `checkpoints`** (B's `runbook_checkpoint`, renamed to sit beside `runs`/`gates`: `run_id → runs`, optional `gate_id → gates`, `seq`, `kind status|note|question`, `title`, `body_md`, `created_at`).
- **Extend `gates.kind`** CHECK to add **`clarification`** (B's non-terminal kind).
- **Turn RLS + realtime ON** — apply B's noetic-member SELECT policies to `runs`/`gates`/`checkpoints`, add them to `supabase_realtime` with `REPLICA IDENTITY FULL`, and keep `is_noetic_member()`. This makes A's deferred "shape (b)" the decision, made.
- **Keep A's `gates.schema` + ajv**; drop B's zod registry (it was an explicit MVP fallback). The open bureau schema-extraction task (Q7) now populates `gates.schema` at callback time.
- **Adopt A's status enums** (`parked`/`done`; `open`/`decided`/`applied`) as canonical — they're merged. Decide whether to add B's extras (`cancelled` on runs; `dismissed`/`superseded` on gates) — recommended, they're additive.
- **`run_dir`: adopt A's omission** (derive-only). Drop B's `run_dir`. Keep A's `sandbox_session_id`+`cmd_id`; drop B's `claimed_at` lease in favor of A's probe model (or keep both only if the reconcile body needs a lease — decide when it's built).
- **Add real user attribution to `gates`**: a nullable `decided_by_user_id UUID → auth.users` alongside A's free-text `decided_by`, plus `channel` (ui/session/agent). This is what cityhall needs and A lacks.

### 5.2 The converged route surface — A's four routes, decide route extended
- **Keep A's `POST /api/runs`, `/api/runs/:id/callback`, `/api/cron/reconcile`** as the cloud spine (finish reconcile's effectful body in the run-environment workstream — still nobody's built it).
- **One decide route: extend A's `POST /api/gates/:id/decide`** to absorb B's behavior:
  - Accept a **noetic-member user JWT** (cityhall) in addition to run-bearer/service; capture `decided_by_user_id` + `channel='ui'`.
  - Handle **`clarification`** as non-terminal (record a `checkpoints` note, leave the gate `open`, do not requeue).
  - Keep ajv-vs-`gates.schema` validation for terminal decisions.
- **Retire B's `POST /api/runbook-hitl-questions/:id/answer`** — its logic moves into the extended decide route; cityhall's proxy points at `/api/gates/:id/decide`.

### 5.3 PR disposition (the request's core question)

| PR | Verdict | Action |
|---|---|---|
| **substation #245** | **Mostly dated — do not merge as-is.** Its `runbook_run`/`runbook_hitl_question` tables and the `/runbook-hitl-questions/:id/answer` route duplicate A's `runs`/`gates` + decide route. | **Chunk the competing tables + answer route.** Re-cut a *small* follow-up PR against A's tables: the new `checkpoints` table, `gates.kind += clarification`, RLS + realtime on all three, `is_noetic_member()`, and the decide-route extensions. Salvage ~30%, drop the rest. |
| **bureau #1549** | **Keep — modify.** Net-new (A has no local lane). | Re-target `app_client.py` + `runbook_hitl_cli.py` to write `runs`/`gates`/`checkpoints` and A's column/enum names (`runbook`, `request`, `step`, `decision`, `decided_by`, `open/decided/applied`). No capability lost. |
| **cityhall #663** | **Keep — modify.** Net-new UI (A has only a commented-out policy sketch). | Re-target reads to `runs`/`gates`/`checkpoints`; point the answer proxy at `/api/gates/:id/decide`; keep the checkpoint-stream timeline + per-kind cards (they now render A's tables). |

**So: one PR (#245) is largely dated and should be chunked-and-re-cut; two PRs (#1549, #663) are net-new and only need a name/enum re-target.** No B *capability* is thrown away — only B's duplicate tables and duplicate decide route.

### 5.4 Sequencing
1. **substation** — a reconciliation migration on top of `main`: `checkpoints` table + `gates.kind += clarification` + `gates.decided_by_user_id`/`channel` + RLS policies + realtime + `is_noetic_member()`. Extend `gates.ts` decide route (noetic-JWT + clarification). Close #245; open the small follow-up.
2. **bureau** — re-target #1549's CLI to the converged names.
3. **cityhall** — re-target #663 to the converged tables + decide route.
4. **run-environment (Jason)** — the still-unbuilt reconcile effectful body + detached-sandbox API (unchanged dependency).

---

## 6. Open questions

- **Q1** — Adopt A's base (recommended) vs rename A→B? A is merged with tests; renaming it churns `main` and Jason's callers. Confirm A-base.
- **Q2** — Keep B's extra statuses (`cancelled`, `dismissed`, `superseded`)? They're additive; recommend yes.
- **Q3** — `checkpoints` FK: link to `gates` directly (`gate_id`) or only via `run_id` + a soft `step` ref? B linked to the question row; A's gate is the equivalent.
- **Q4** — `run_dir` derived-only (A) confirmed? B's local captain currently passes an explicit run dir on the CLI — verify the derive rule covers the local lane too.
- **Q5** — Decision schema: does the bureau schema-extraction task (old Q7) now target `gates.schema` (ajv/JSON-Schema) instead of a zod registry? That changes the extraction output format.
- **Q6** — Lease vs probe: does the reconcile body need B's `claimed_at` lease on top of A's `Command.wait` probe to prevent a tick and a hot-fire double-advancing one run? Decide when the effectful reconcile is built.
