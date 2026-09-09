# Reconciling the two Runbook Control Plane workstreams

**Status:** Draft v2
**Date:** 2026-09-09
**Repos touched (proposed):** `substation` (rename A's tables + graft B's fields; one decide controller behind two routes), `bureau` (re-target the local captain CLI), `cityhall` (re-target the console)
**Repos NOT touched:** `conductor2` (still DB-free; still zero emission changes)
**Companion:** `reconcile-diagram.html` (4-tab visual: summary · code deltas · data deltas · path forward) in this dir.
**Supersedes context:** the `runbook-checkpoints` spec (`../DESIGN-SPEC.md`) + its `../data-model-spec.html`.

> **One-line problem.** The same feature got built twice, in parallel, with different table names, a different gate model, and an overlapping decide route — and **Jason's half already merged to `main`**. This spec categorizes every delta and proposes a fix-forward that keeps one canonical schema and one route surface.

> **Revision note (v2, 2026-09-09).** Folds in Will's feedback. **(a) Rename, don't keep A's names** — the canonical tables become `runbook_runs` / `runbook_hitl_questions` / `runbook_checkpoints` (rename A's `runs`/`gates`, add checkpoints). **(b) Decide route = two routes over one controller** — keep A's `POST /api/gates/:id/decide` as a thin alias and add the canonical `POST /api/runbook-hitl-questions/:id/answer`; both delegate to one controller, so A's existing callers keep working (a clean swap). **(c) `schema` and `payload` both stay** — they're orthogonal (validation contract vs render content), new §3.1. **(d) `cancelled` added** to run status; **(e) `run_dir` dropped** (derive-only, §5.1). **(f) Reconcile reframed** as a shared *gap* (both reference it, neither built it), not a build conflict.

## Problem

Two implementations of the runbook control plane / HITL feature landed at the same time:

- **A — merged.** Jason's `substation#247` ("Scaffold the run control plane", commit `d1c082b`, merged to `main` 2026-09-09) added **two tables** (`public.runs`, `public.gates`) and **four routes** (`POST /api/runs`, `POST /api/runs/:id/callback`, `POST /api/gates/:id/decide`, `GET /api/cron/reconcile`), a per-run HMAC bearer, ajv schema validation, and a full route-test suite. Reconcile is a **dry-run stub**; RLS has **no policies**; realtime is **off**.
- **B — open (mine).** `substation#245` + `bureau#1549` + `cityhall#663` added **three tables** (`runbook_run`, `runbook_checkpoint`, `runbook_hitl_question`), **one** substation route (`POST /api/runbook-hitl-questions/:id/answer`), the **local captain lane** (bureau `app_client.py` + `runbook_hitl_cli.py`), the **cityhall console UI** (list + detail + per-kind rich cards), and **live RLS + realtime**.

They collided first on a migration filename (`20260908000000`, fixed by renaming mine to `20260909000000`), but the real collision is architectural. This spec is the reconciliation of record. The categories below use the **venn framing the request asked for** — *A-only*, *B-only*, *overlap* — first for **code**, then for the **data model** — then a **fix-forward plan** keyed to the three open PRs.

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
- The `(runbook, gate)` **decision-schema registry** (a weaker MVP stand-in for A's schema-on-gate).

### 2·∩ — both built, differently (the real conflict)
- **Decide / answer route.** A: `POST /api/gates/:id/decide` — ajv vs stored `gates.schema`, run-bearer/service auth, no user identity, `parked→queued`. B: `POST /api/runbook-hitl-questions/:id/answer` — zod kind-aware vs registry, noetic-JWT auth (`answered_by`, `channel`), **clarification parks**, explicit local-vs-cloud lane split. **This is the one place code must merge, not just coexist — resolved in §5.2 by one controller behind both routes.**

### 2·gap — a shared hole (NOT a conflict)
- **Reconcile loop.** A shipped the `GET /api/cron/reconcile` route but it is a **dry-run**: it returns the plan it *would* run (`resume_and_advance` / `probe_session` / `none`) and changes nothing — no sandbox resumes, no run advances. B never built a reconcile route; B's answer route flips a cloud run to `queued` and *names* "the reconcile loop" as the future guarantee. So **neither side has a working loop that drives a parked run forward.** It is a to-do both halves point at, owned by the run-environment workstream — not a place two built things disagree.

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
| `schema JSONB` (validation contract on the row) | *(none — code registry)* | **A-only; keep A's (§3.1)** |
| `readout_prefix`, `live_view_url` (columns) | *(inside `payload JSONB`)* | complementary — see §3.1 |
| `decision` / `decided_by TEXT` / `decided_at` | `answer` / `answered_by UUID→auth.users` / `answered_at` | rename + **B upgrades `decided_by` to a real FK** |
| `status` = `open/decided/applied` | `status` = `awaiting_input/answered/applied/dismissed/superseded` | **enum conflict** |
| `UNIQUE(run_id, step)` + **upsert-on-repark** | **partial-unique** `WHERE status='awaiting_input'` + new row per re-ask | uniqueness-model conflict |

### 3A — A-only columns
`sandbox_session_id`, `cmd_id` (liveness); `schema` (per-gate JSON Schema — the validation contract, §3.1).

### 3B — B-only entities / columns
- **`runbook_checkpoint`** — the whole append-only stream table (no A equivalent).
- On the run: `claimed_at` (lease), `sandbox_id`, `run_dir` (**dropped, §5.1**), `runbook_ref`, `submission_version_id`, `triggered_by`, `started_at`/`finished_at`, GIN(`inputs`).
- On the gate: `payload JSONB` (render content, §3.1), `channel`.

### 3.1 `schema` vs `payload` — orthogonal; keep both
They are **not** the same and do not overlap in purpose:

- **`schema` (A) = the validation contract.** A JSON Schema describing what a *valid decision/answer* must look like. The decide route compiles it with **ajv** and rejects a malformed answer (missing required fields, wrong types); A's HITL page also **auto-generates its form from this schema** (migration comment: "the HITL page renders its form from this, and `POST /api/gates/:id/decide` validates the submitted decision against it"). One artifact, two machine uses: validate + generic form-gen. **A is strict here.** B has no equivalent — B validates with a substation-authored zod registry keyed `(runbook, gate)`, only `smoke:2.3-hitl` populated, with a generic accept-any fallback (an explicit MVP).
- **`payload` (B) = the presentation content.** The *human-facing* render data: the prose prompt, option labels (with source pills), `allow_freeform`, `void_candidates`, the readout pointer, `live_view_url`. cityhall's rich cards render **bespoke per-kind UI** from it (approve/revise, operator void-select, hands live-view + done) — things a bare JSON Schema can't express well.
- **Merge = keep both.** `schema` stays the strict answer contract (ajv); `payload` carries the bespoke card content. A's `readout_prefix`/`live_view_url` may stay as columns or fold into `payload` (minor). The old Q7 ("where does the schema come from") now resolves cleanly: the bureau schema-extraction task populates `runbook_hitl_questions.schema` at callback time.

---

## 4. Key conflicting assumptions (force a decision on each)

1. **2 tables vs 3** — is there a dedicated checkpoint stream, or does status + gates carry everything? **(v2: 3 — add `runbook_checkpoints`.)**
2. **Gate folds the decision vs separate question + stream** — one row that re-parks in place (A upsert) vs a question row + a stream (B). **(v2: keep A's one-row-upsert gate + add the stream table.)**
3. **Schema-on-gate (ajv) vs schema-registry (zod)** — where does the decision contract live? **(v2: A's `schema` on the row; drop B's registry — §3.1.)**
4. **Enum literals** — `parked` vs `awaiting_input`; `done` vs `completed`; `open/decided` vs `awaiting_input/answered`. **(v2: adopt A's literals; add B's `cancelled`.)**
5. **HMAC-bearer callback vs no callback** — **(v2: keep A's bearer + callback.)**
6. **Cloud-only vs local+cloud** — **(v2: keep both lanes — A's cloud + B's local captain.)**
7. **No stream + realtime off vs stream + realtime on** — **(v2: on.)**
8. **Upsert-on-repark vs partial-unique-on-open** — **(v2: keep A's upsert-on-repark; the stream table carries history instead.)**
9. **Auth: run-bearer/service vs noetic-JWT** — **(v2: one controller accepts both; capture `decided_by_user_id`+`channel` on the UI path.)**
10. **`run_dir` stored vs derived** — **(v2: drop `run_dir`; derive-only. Confirm for the local lane — Q4.)**
11. **`clarification` in or out** — **(v2: in.)**

---

## 5. Proposed path forward

**Principle: converge on A's merged base; rename its tables to B's convention and graft B's additive surface onto it.** A is on `main`, has the harder cloud plumbing and a test suite. B's differentiators are overwhelmingly *additive* — they grow A's tables, they don't reshape them. Renaming A's two tables + a decide-controller extraction is cheaper and less risky than unwinding a merged migration.

### 5.1 The converged data model — rename A's two tables, add a third, graft B's fields
- **Rename** (a new migration on top of `main`; update A's route/controller code to match):
  - `runs` → **`runbook_runs`**
  - `gates` → **`runbook_hitl_questions`**
  - add **`runbook_checkpoints`** (B's stream: `run_id → runbook_runs`, optional `hitl_question_id → runbook_hitl_questions`, `seq`, `kind status|note|question`, `title`, `body_md`, `created_at`).
- **`runbook_runs`** = A's columns, plus:
  - **add `cancelled`** to the `status` CHECK → `queued/running/parked/done/failed/cancelled`.
  - **drop `run_dir`** — adopt A's derive-only rule (path = `<runs root>/<runbook>/<id>`). See the run_dir note below. Keep A's `sandbox_session_id`+`cmd_id` liveness (drop B's `claimed_at` lease unless the reconcile body needs it — Q6).
  - graft B's harmless metadata as wanted (all additive, decide per-column): `runbook_ref`, `submission_version_id`, `triggered_by`, `started_at`/`finished_at`, GIN on `request`.
- **`runbook_hitl_questions`** = A's columns (`schema`, `readout_prefix`, `live_view_url`, `decision`, `decided_by`, `status open/decided/applied`, `UNIQUE(run_id, step)` upsert-on-repark), plus:
  - **add `clarification`** to the `kind` CHECK → `decision/clarification/operator/hands`. Clarification is non-terminal: the controller records a `runbook_checkpoints` note and does **not** requeue the run.
  - **add `payload JSONB`** (B's render content — prompt/options/allow_freeform/void_candidates). **Keep A's `schema` too** — they're orthogonal (§3.1): `schema` validates the answer, `payload` renders the card.
  - **add `decided_by_user_id UUID → auth.users`** (real attribution for the UI answer path) alongside A's free-text `decided_by`, and **`channel`** (ui/session/agent).
- **Turn RLS policies + realtime ON** for all three (B's noetic-member SELECT + `is_noetic_member()` + `REPLICA IDENTITY FULL` + `supabase_realtime` publication) — A's deferred "shape (b)", now decided.

**`run_dir` — what it did in B, why we drop it.** `run_dir` was a denormalized TEXT column caching the run directory's absolute path (local path or sandbox path). A omits it and *derives* the path from `<runs root>/<runbook>/<id>`, because "two spellings of one path is how a resume ends up pointed at a directory that does not exist." Since the path is deterministic from `id`+`runbook`, the column is a convenience that only adds drift risk. **Drop it.** Caveat (Q4): B's local captain CLI currently passes an explicit `--run-dir`; confirm the derive rule covers a local run's dir, or keep `run_dir` strictly as a non-authoritative display hint never used for resume path resolution.

### 5.2 The converged route surface — two routes, one controller
- **Keep A's `POST /api/runs`, `/api/runs/:id/callback`, `/api/cron/reconcile`** as the cloud spine (finish reconcile's effectful body in the run-environment workstream — still unbuilt on both sides).
- **Extract the decide logic into one controller, then expose two routes** (Will's clean-swap):
  - `POST /api/gates/:id/decide` — **kept as a thin alias** so A's existing integration/callers keep working unchanged.
  - `POST /api/runbook-hitl-questions/:id/answer` — the **canonical** route cityhall calls.
  Both delegate to the same controller (reads/writes `runbook_hitl_questions`). The controller absorbs B's additions: accept a **noetic-member user JWT** (→ `decided_by_user_id`, `channel='ui'`) in addition to A's run-bearer/service auth; handle **`clarification`** as non-terminal (checkpoint note, no requeue); keep **ajv-vs-`schema`** for terminal decisions. If A's callers later migrate, the alias can be retired without touching the controller.

### 5.3 PR disposition (the request's core question)

| PR | Verdict | Action |
|---|---|---|
| **substation #245** | **Mostly dated — do not merge as-is.** Its `runbook_run`/`runbook_hitl_question` tables and the `/runbook-hitl-questions/:id/answer` route duplicate A's `runs`/`gates` + decide route. | **Chunk the competing tables + standalone answer route.** Re-cut a *small* follow-up PR on top of `main`: the rename migration (`runs`→`runbook_runs`, `gates`→`runbook_hitl_questions`), `runbook_checkpoints`, `kind += clarification`, `payload`/`channel`/`decided_by_user_id`, RLS + realtime, `is_noetic_member()`, and the decide-controller extraction (both routes). Salvage the concepts, drop the duplicate tables/route. |
| **bureau #1549** | **Keep — modify.** Net-new (A has no local lane). | Re-target `app_client.py` + `runbook_hitl_cli.py` to write `runbook_runs`/`runbook_hitl_questions`/`runbook_checkpoints` and A's column/enum names (`runbook`, `request`, `step`, `decision`, `decided_by`, `open/decided/applied`). No capability lost. |
| **cityhall #663** | **Keep — modify.** Net-new UI (A has only a commented-out policy sketch). | Re-target reads to the renamed tables; point the answer proxy at `/api/runbook-hitl-questions/:id/answer` (canonical) or `/api/gates/:id/decide` (alias — same controller); keep the checkpoint-stream timeline + per-kind cards (they now render `payload`). |

**So: one PR (#245) is largely dated and should be chunked-and-re-cut; two PRs (#1549, #663) are net-new and only need a name/enum re-target.** No B *capability* is thrown away — only B's duplicate tables and duplicate standalone decide route.

### 5.4 Sequencing
1. **substation** — one reconciliation migration on top of `main`: rename A's two tables, add `runbook_checkpoints`, `kind += clarification`, `payload`/`channel`/`decided_by_user_id`, `status += cancelled`, drop nothing of A's, RLS policies + realtime, `is_noetic_member()`. Extract the decide controller; wire both routes at it. Update A's route/controller code to the renamed tables. Close #245; open the small follow-up.
2. **bureau** — re-target #1549's CLI to the converged names.
3. **cityhall** — re-target #663 to the converged tables + a decide route.
4. **run-environment (Jason)** — the still-unbuilt reconcile effectful body + detached-sandbox API (unchanged dependency).

---

## 6. Open questions

- **Q1 — RESOLVED (v2).** Adopt A's base, renamed to B's convention (`runbook_runs`/`runbook_hitl_questions`/`runbook_checkpoints`). Not a rewrite of A's shape — a rename + graft.
- **Q2 — RESOLVED (v2).** Keep B's extra statuses: `cancelled` on runs (Will-confirmed); `dismissed`/`superseded` on questions optional (additive) — decide during the migration.
- **Q3** — `runbook_checkpoints` FK: link to `runbook_hitl_questions` directly (`hitl_question_id`) in addition to `run_id`? (B did; keep it.)
- **Q4** — `run_dir` derived-only confirmed (v2). Verify the derive rule (`<runs root>/<runbook>/<id>`) covers the **local** lane, where B's captain CLI currently passes an explicit run dir. If not, keep `run_dir` as a non-authoritative display hint only.
- **Q5** — Decision schema now lives on `runbook_hitl_questions.schema` (ajv/JSON-Schema, §3.1). The bureau schema-extraction task (old Q7) must emit JSON Schema into the gate at callback time, not a zod registry — confirm that output format.
- **Q6** — Reconcile liveness: A's `Command.wait` probe (via `sandbox_session_id`+`cmd_id`) vs adding B's `claimed_at` lease to stop a tick and a hot-fire double-advancing one run. Decide when the effectful reconcile body is built.
