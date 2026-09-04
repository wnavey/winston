# Process City Response Documents — Runbook

**Status:** Draft v1
**Date:** 2026-09-04
**Repos touched:** `substation` (migration: new `city_response_processing_run` registry table + nullable `document_version.city_response_processing_run_id` FK + RLS), `bureau` (new `runbooks/process-city-response-docs/` runbook), `claude-plugins` (minimal non-interactive flags on the two CRC-guide skills)
**Repos NOT touched (this spec):** `cityhall` (the per-card "processed" badge is a deferred fast-follow — D24), `conductor` (this is an operator-driven RUNBOOK.md runbook, not a cloud workflow)

> **Sibling spec:** `workspaces/city-response-docs/DESIGN-SPEC.md` (City Response Documents, Draft v1, **implemented**) added the ability to attach/view/CRC-fetch city response files against a city-submitted submission version. That spec deliberately deferred *processing* those files (its §"Non-goals": "Rewiring `generate-crc-guides` / `generate-crc-guides-from-redlines`… → fast-follow"). **This spec is that fast-follow**, delivered as a bureau runbook rather than an Inngest pipeline.

## Problem

The sibling spec ships the *storage* side: after the City of Austin sends back its response to a site-plan submission — a **Master Comment Report (MCR)** and per-department **redline PDFs** — an operator can now attach those files to the city-submitted `submission_version` as `document` rows (`kind='city_response'`, `city_response_type ∈ {mcr, redlines, misc}`), each carried by exactly one `document_version` whose `submission_version_id` points at the version being responded to.

But nothing *processes* them. The value of a stored MCR/redline is the **per-department CRC guide** it becomes — the checklist the Comment Resolution Check (CRC) workflow reviews the resubmission against. Today those guides are produced only by two Claude Code skills an operator hand-drives from a laptop:

- **`generate-crc-guides`** (`claude-plugins/plugins/noetic-tools/command-packs/generate-crc-guides/`) — takes an **MCR PDF at a local file path** + a project + a submission version, runs a 15-phase LLM pipeline (parse → dept-classify → severity → verifiability → figure extraction → decompose → enrich → HITL → emit), and writes per-dept `crc-{dept}.md` guides to the **`crc-guides`** Supabase bucket at `{projectId}/{submissionId}/{submissionVersionNumber}/{generationNumber}/`. CRC reads them back via `bureau/workflows/comment-resolution-check/scripts/fetch-crc-guides.ts` (which picks the highest integer generation dir).
- **`generate-crc-guides-from-redlines`** (`…/command-packs/generate-crc-guides-from-redlines/`) — consumes a **navalbase `detailed-analysis-results.json`** (the structured output of `navalbase step-3-analyze-pdfs`, optionally refined/enriched), plus a `source.pdf` symlink and a `--dept-code`/`--dept-label`, and emits `crc-{dept-code}-redlines.md` to the same `crc-guides` bucket.

Two gaps:

1. **No orchestration.** An operator must, per document, find the file, download it, resolve project/submission/version IDs, (for redlines) run navalbase first, and invoke the right skill by hand. There is no single entry point that says "process every city-response doc attached to submission version N."
2. **No processed-ness signal.** Nothing records that a city-response document has been turned into a guide, so the UI cannot show a "processed" badge and a re-run cannot tell which docs are still outstanding. The sibling data model has no analogue to pre-processing's `preprocessing_run_id`.

This spec adds **`process-city-response-docs`**, a bureau runbook that takes a project + submission version, discovers the attached city-response docs, allocates one processing job per document, invokes the existing CRC-guide skills (running navalbase first for redlines), and records a **run registry + per-document provenance stamp** — mirroring the pre-processing runbook's `site_plan_preprocessing_run` pattern so the app gets processed badges.

### Verified facts this design rests on

Grounded in the current code (read 2026-09-04):

- **Runbook shape.** The live pre-processing runbooks (`bureau/runbooks/preprocessing/`, `preprocessing-v3/`) are **`RUNBOOK.md` prose-orchestrator** runbooks — a prose top-level-runner script + `prompts/` + deterministic `scripts/` (Bun) — run in a local HITL Claude Code session, **not** the compiled `runbook.yaml`/conductor format used by `review-new`/`sir-new` (`bureau/runbooks/README.md:12`). Agents write files; deterministic scripts do all DB writes.
- **The registry pattern** (`substation/supabase/migrations/20260818000000_site_plan_preprocessing_run.sql`): `site_plan_preprocessing_run` — `id`, `submission_version_id` (NOT NULL FK → `submission_version`, ON DELETE CASCADE) as the **grain**, `runbook_output_storage_path` (NOT NULL), `runbook_ref`, `status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive'))`, `execution_metadata JSONB`, `created_at`, `published_at`. A **partial unique index** `WHERE status='active'` enforces one active run per grain. Two nullable FK columns `preprocessing_run_id UUID … ON DELETE SET NULL` on `sheet_version` and `document_version` are the processed-ness flag (`IS NOT NULL` = processed); partial indexes `WHERE preprocessing_run_id IS NULL` keep the "what's left" query cheap.
- **register/publish split** (`bureau/runbooks/preprocessing-v3/scripts/register.ts`, `publish.ts`): `register.ts` uploads the run artifact to `submission-data/{projectId}/preprocessing-runs/{submission_version_id}/{runSlug}/artifact.json`, then INSERTs the run row `status='inactive'`, printing the run id. `publish.ts` reads the artifact back, applies it, **stamps `preprocessing_run_id = run.id` on every covered row**, then flips this run `active` and siblings `inactive` (deactivating siblings **first** so the partial unique index never sees two active rows). Idempotent + swappable: `publish(A) → publish(B) → publish(A)` restores A. Publish runs **non-transactionally** (a `// HARDENING:` note flags per-entity transactions as a pre-production item).
- **Supabase access** (`bureau/runbooks/preprocessing-v3/scripts/lib/supabase.ts`): a lazy service-role client (RLS-bypassing) from `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; `orThrow` fails loudly on any PostgREST error.
- **`generate-crc-guides`**: input = local MCR PDF path + project + submission version (accepts explicit `--project-id` / `--submission-version-id`, short-circuiting its own Phase-0 DB disambiguation HITL). Output = `crc-guides` bucket (everything but `scratch/`) + a local gen dir. **DB write:** INSERTs `jurisdiction_departments` at Phase-9 HITL when it meets an **unknown dept prefix**. Mandatory Phase-9 `AskUserQuestion` HITL: unknown-prefix naming, status-unknown, **verifiability-uncertain**, figure-attribution. Reads `~/noetic/bureau/`. A `scripts/verify-phase.py` gate hard-fails any LLM phase that dispatched 0 calls.
- **`generate-crc-guides-from-redlines`**: input = navalbase `detailed-analysis-results.json` (raw **or** refined; accepts either without validation) + `source.pdf` sibling symlink + `--dept-code`/`--dept-label` + explicit submission-version IDs. **Hard upstream dependency:** it "isn't a redline extractor" — `navalbase step-3-analyze-pdfs` must have already produced the JSON. Output = `crc-{dept-code}-redlines.md` to the `crc-guides` bucket. Its **only** HITL is a Phase-6 versioning choice. Phase-3 spawns Opus vision sub-agents (cap 11 concurrent).
- **`navalbase-refine-step-3-output`** (`noetic-tools:navalbase-refine-step-3-output`): an **agentic vision multipass** that dedupes redline comments + strips process-noise from a step-3 output before enrichment. `generate-crc-guides-from-redlines` accepts its output directly.
- **CRC fetch** (`bureau/workflows/comment-resolution-check/scripts/fetch-crc-guides.ts:12`): reads `crc-guides/{projectId}/{submissionId}/{u0VersionNumber}/{generationNumber}/` and **picks the highest integer-named generation dir**. This is what determines which guides CRC consumes — see the generation-vs-registry seam (D19).
- **Harness constraint (the design pivot).** In Claude Code, only the operator-facing session owns the human channel. A sub-agent spawned via the Agent tool runs headless — its only back-channel to its parent is its **final return message on termination** (or pause/resume via SendMessage). It **cannot** raise a live `AskUserQuestion` to the human mid-run. A worker that invokes a skill which calls `AskUserQuestion` internally therefore stalls. This forces all human decisions to the operator-facing session (D7).

## Goals / Non-goals

**Goals (this spec):**
1. A `bureau/runbooks/process-city-response-docs/` runbook that takes `projectId` (or project name) + `submission_version.version_number`, implicitly scoped to the project's `type='site_plan'` submission, and processes every attached city-response document into CRC guides.
2. Route by `city_response_type`: `mcr` → `generate-crc-guides`; `redlines` → navalbase (`step-3-analyze-pdfs` → `refine-step-3-output`) → `generate-crc-guides-from-redlines`; `misc` → skip.
3. A `city_response_processing_run` registry (grain = `submission_version`) + a nullable `document_version.city_response_processing_run_id` FK stamp, mirroring the pre-processing pattern, so the app can badge processed docs and subset re-runs know what's left.
4. All human decisions resolved in a **single kickoff pre-flight** + a **single end-of-run readout gate**; worker sub-agents run headless and parallel.

**Non-goals (deferred):**
- **cityhall processed-badge UI** on the City Response cards (D24) — a thin follow-up once the FK exists.
- **`layer-2-enrich`** on the redline path (D9) — the redline guide ships without the enriched regulatory-citation column; enrichment is out of scope for v1.
- **Re-homing the `crc-guides` output** into the registry artifact, or making the registry authoritative over which generation CRC reads (D19) — generation numbering stays the source of truth for CRC.
- **Transactional publish** — inherits pre-processing's non-transactional posture and its deferred-hardening note (D18).
- **Non-PDF MCR/redline handling** — assume PDF; fail loudly otherwise (D21).

## Inputs & discovery

**Inputs (D1–D4):**
- `projectId` (UUID) **or** project name (fuzzy-matched against `project.name`, exactly as the skills already do).
- `submission_version.version_number` — the operator names the version explicitly (never "latest").
- Implicit: the project's `type='site_plan'` submission. **Assert exactly one** such submission exists; fail loudly on 0 or >1 (D2).

**Which version `version_number` names (D3):** the **city-submitted** version the response answers — the one whose `document_version.submission_version_id` the city-response docs point at. Assert `city_submission_number IS NOT NULL` on it (the same gate the sibling spec puts on attachment).

**Document discovery (D4, D35):**
```
document_version dv
  WHERE dv.submission_version_id = :resolvedVersionId
    AND dv.city_response_processing_run_id IS NULL      -- subset re-runs: only what's unprocessed
JOIN document d ON d.id = dv.document_id
  WHERE d.kind = 'city_response'
    AND d.city_response_type IN ('mcr','redlines')       -- 'misc' excluded (D22)
RETURN { document_id, document_version_id, city_response_type, storage_path, file_name }
```
A subset re-run picks up only still-`NULL` docs, mirroring pre-processing's `preprocessing_run_id IS NULL` discovery.

## Architecture: pre-flight, then headless parallel workers

The harness constraint (above) forbids mid-pipeline HITL in a headless worker. The runbook therefore splits every human decision out of the worker path (D7, chosen model **7a**):

```
Top-level runner (operator-facing session)
  │  Kickoff pre-flight — resolve inputs, enumerate docs, batch ALL human decisions ONCE
  │     · unknown MCR dept-prefixes → operator names them → pre-INSERT jurisdiction_departments
  │     · versioning intent (bump vs replace) for the whole run
  │     · per-redline dept-code / dept-label
  ▼
Reading/processing orchestrator (background sub-agent)
  │  fan out ONE worker per document (bounded concurrency)
  │     ├─ mcr worker      → generate-crc-guides (non-interactive, pre-resolved IDs)
  │     └─ redlines worker → navalbase step-3 → refine → generate-crc-guides-from-redlines
  │  collect per-doc results; assemble artifact.json; run register.ts (status='inactive')
  ▼
Top-level runner  →  End readout (per-doc inventory + flagged-uncertain ledger + failures) ⛔
                     ├─ publish  → publish.ts (stamp FK + flip active)
                     ├─ re-run   → scoped orchestrator over named docs
                     └─ stop
```

### Pre-flight (D13, D14) — what the operator answers once

The top-level runner, before any fan-out, computes and batches to the operator in one conversation (recorded verbatim in `hitl/`):
- (a) resolved project / submission / version + the full city-response doc list bucketed by type;
- (b) for each `mcr` doc: a **cheap `pdftotext` prefix scan** (not the full skill) to enumerate its department prefixes, diffed against `jurisdiction_departments` for the jurisdiction; the operator **names any unknown prefixes**, which the runner **pre-INSERTs** into `jurisdiction_departments` so the MCR skill never hits its unknown-prefix HITL;
- (c) **versioning intent** — one answer for the whole run (rec: always **bump** a new `crc-guides` generation);
- (d) **per-redline `--dept-code` / `--dept-label`** (a redline PDF is inherently single-department), derived from document metadata if present, else asked.

### Emergent HITL → non-interactive default (D15)

The skills' *emergent* mid-pipeline decisions that cannot be pre-computed (verifiability-uncertain, figure-attribution, status-unknown) default to **keep-and-flag** — never `AskUserQuestion`. Flagged items surface in the **end readout**, where the operator can order a scoped re-run. This is the `--defer-uncertain` behavior (see skill changes, D38).

### Worker fan-out (D6, D26, D27, D28)

- One worker per document (D6). **Opus** for orchestrator + workers (reading city comments is judgment work); **Sonnet** for the mechanical navalbase subprocess driving; every spawn names its model explicitly (D28).
- **Concurrency is capped low (~2–3 doc-workers)** (D27): the redline skills already fan out their own Opus vision sub-agents (refine's multipass; the redline skill's Phase-3, cap 11), so a high doc-level cap would multiply into a thundering herd.
- **Nested-spawn depth risk (D26):** a redline worker invokes two agentic skills that each spawn vision sub-agents, so the chain is top-level → orchestrator → worker → skill-vision = 3–4 nesting levels. **Carried as a pre-build validation item**, with a documented fallback: if the harness balks at that depth, the **orchestrator invokes the per-doc skill chain itself** in a bounded concurrency loop (one level shallower) instead of spawning a distinct worker layer.

### Skill invocation contract (D5, D36, D37)

- **Invoke the skills in place** (D5) — they keep their canonical definition in `claude-plugins`; the runbook does not port their pipelines into bureau (porting 15-phase pipelines would fork and rot them).
- Each worker **downloads its document's bytes** from `submission-data` to the run dir, then invokes the skill with **explicit `--project-id` + `--submission-version-id`** (D36) so the skill skips its own Phase-0 DB disambiguation HITL.
- After each skill run, the worker **parses the skill's own `manifest.json`** to capture the emitted `crc-guides` generation number + path (never guess it), and returns it to the orchestrator for `execution_metadata` (D37).

### Redline path detail (D9, D10, D12)

Per `redlines` doc, the worker:
1. downloads the redline PDF to the run dir;
2. runs `navalbase step-3-analyze-pdfs` as a subprocess (Python CLI) — **the one required navalbase step** the runbook orchestrates (D10);
3. runs `navalbase-refine-step-3-output` (agentic vision multipass) over the step-3 output (D9 — **refine is in**; `layer-2-enrich` is **out**);
4. creates the `source.pdf` sibling symlink the redline skill requires;
5. invokes `generate-crc-guides-from-redlines --detailed-analysis-results-path <refined.json> --dept-code … --dept-label … --submission-version-id …`.

navalbase's `detailed-analysis-results.json` + crops are **intermediates** kept local to the run dir only (D11) — the durable product is the `crc-guides` bucket output. navalbase's Python env + CLI tool prereqs (poppler, ImageMagick, `fitz`) are an **operator-machine precondition**, checked at pre-flight; fail loudly if navalbase isn't runnable (D12), same posture as the skills' own tool prereqs.

## Data model (`substation` migration)

Mirrors `20260818000000_site_plan_preprocessing_run.sql`.

### New table `city_response_processing_run` (D13-schema, D30)

```sql
CREATE TABLE public.city_response_processing_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  submission_version_id UUID NOT NULL
    REFERENCES public.submission_version(id) ON DELETE CASCADE,   -- the grain (D14)

  runbook_output_storage_path TEXT NOT NULL,   -- the per-doc result manifest in Storage
  runbook_ref                 TEXT,            -- git sha / label of the runbook+prompts used
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive')),
  execution_metadata JSONB,                    -- per-doc results (see D17)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_city_response_processing_run_submission_version
  ON public.city_response_processing_run(submission_version_id);

-- one active run per submission version (D20)
CREATE UNIQUE INDEX idx_city_response_processing_run_one_active
  ON public.city_response_processing_run(submission_version_id)
  WHERE status = 'active';
```

**No `preprocessing_version`-style badge column** (D32) — a single runbook; the presence of the FK is the only badge signal needed.

### Badge FK on `document_version` (D31)

```sql
ALTER TABLE public.document_version
  ADD COLUMN city_response_processing_run_id UUID
    REFERENCES public.city_response_processing_run(id) ON DELETE SET NULL;

-- subset-discovery: unprocessed city-response docs = IS NULL (D34)
CREATE INDEX idx_document_version_unprocessed_city_response
  ON public.document_version(document_id)
  WHERE city_response_processing_run_id IS NULL;
```

`ON DELETE SET NULL` so removing a run row de-stamps its docs back to "unprocessed" (correct — those docs no longer have a live guide-generation run). On `document_version` (not `document`), matching where `preprocessing_run_id` already lives and where the byte-carrier + `submission_version_id` link sit.

> **Interaction with the sibling FK:** `document_version.preprocessing_run_id` (from pre-processing) is deliberately distinct from `city_response_processing_run_id`. City-response docs bypass pre-processing entirely (sibling spec: no Inngest, `processing_state` NULL), so their `preprocessing_run_id` stays NULL forever; the new column is their only processed-ness signal. No conflation.

### RLS (D33)

```sql
ALTER TABLE public.city_response_processing_run ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view city response processing runs for accessible projects"
  ON public.city_response_processing_run FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.submission_version sv
      JOIN public.submission s ON s.id = sv.submission_id
     WHERE sv.id = city_response_processing_run.submission_version_id
       AND public.user_can_see_project(s.project_id, auth.uid())
  ));
```
Writes are service-role only (the runbook scripts bypass RLS) — no authenticated INSERT/UPDATE/DELETE policy. Verbatim from the pre-processing-run migration.

## Registry & publish semantics (lighter than pre-processing)

**Publish here is a thin stamp, not a data-mover (D16).** Pre-processing's `publish.ts` clear-then-applies *content* (content_blocks, summaries) into rows. Here the content — the CRC guides — **already lives in the `crc-guides` bucket**, written by the skills. So:

- `register.ts` (D17, D18): uploads a small **per-doc result manifest** `artifact.json` to `submission-data/{projectId}/city-response-runs/{submission_version_id}/{runSlug}/artifact.json`, then INSERTs the `city_response_processing_run` row `status='inactive'`. `execution_metadata` records, per document: `document_id`, `document_version_id`, `city_response_type`, emitted `crc-guides` generation number + path, dept code(s), and per-doc `status ∈ {processed, skipped, failed}` (D17, D22, D23).
- `publish.ts` (D16, D18): reads the manifest, **stamps `city_response_processing_run_id = run.id` on each processed `document_version`** (only `status='processed'` docs), then flips this run `active` / siblings `inactive` (siblings first). No content migration. Inherits pre-processing's non-transactional posture + deferred-hardening note.

`register` runs after all workers finish + artifact assembly; `publish` runs **only on the operator's explicit go** at the end readout (D18) — same gate discipline as preprocessing-v3.

## The generation-vs-registry seam (explicit v1 decision — D19)

CRC's `fetch-crc-guides.ts` reads the **highest integer generation** dir in the `crc-guides` bucket — it does **not** consult this registry. So the registry's `active`/`inactive` does **not** control which guides CRC consumes; **generation numbering (owned by the skills) is the source of truth for what CRC reads.**

Consequence: the pre-processing "swap back to a prior run" undo property does **not** redirect CRC here. **Accepted for v1:** the registry is *provenance + badge only*. "Undo" = re-run to emit a corrected higher generation, not a registry flip. The one-active-per-version index (D20) is kept anyway — harmless, and it matches the pattern. (Alternative, rejected for v1: make the registry authoritative by changing `fetch-crc-guides.ts` to read the active run's recorded generation — bigger blast radius on the live CRC path.)

## Edge cases & failure handling

- **`misc` docs (D22):** no processing job, no FK stamp; recorded as `status='skipped'` in `execution_metadata` for auditability.
- **Non-PDF MCR/redline (D21):** assume MCR/redline docs are always PDF; if a `mcr`/`redlines` doc is non-PDF, **fail loudly at pre-flight** with a clear message rather than silently converting. (MCRs/redlines from the city are PDFs in practice.)
- **Partial failure (D23):** a worker that fails (navalbase crash, skill error) records `status='failed'` for that doc in `execution_metadata`; the run still registers. Because `publish.ts` stamps only `status='processed'` docs, failed docs stay `city_response_processing_run_id IS NULL` and a subset re-run (D35) picks them up. Mirrors pre-processing subset runs.
- **Empty set:** if discovery finds zero unprocessed `mcr`/`redlines` docs, stop and report at pre-flight (nothing to do) rather than registering an empty run.

## Run layout (folder contract, D29)

```
~/noetic/working/process-city-response-docs/<jurisdiction>-<project-slug>/
  ADDENDUM.md            # resolved projectId/version, submission_version_id, doc list, operator pre-flight answers
  hitl/                  # readout.md + decision.md, verbatim
  docs/<document_id>/    # downloaded bytes + navalbase intermediates (redlines) + skill gen/scratch dirs
  artifact.json          # per-doc result manifest (the registry's runbook_output_storage_path payload)
```
As in preprocessing-v3, the folder is simultaneously the API, the resume mechanism, and the audit surface; unlinked files are invisible downstream by design.

## Skill changes (`claude-plugins` companion — D38)

Minimal, referenced by this spec as a **required sibling PR**:
- **`generate-crc-guides` (MCR):** a `--versioning=bump` flag (skip the Phase-9 versioning `AskUserQuestion`) + a `--defer-uncertain` mode (verifiability-uncertain / figure-attribution / status-unknown default to keep-and-flag; never `AskUserQuestion`; flagged items written to the manifest for the runbook's readout). Unknown-prefix HITL needs **no** change — the runbook pre-INSERTs `jurisdiction_departments` at pre-flight.
- **`generate-crc-guides-from-redlines`:** a `--versioning=bump` flag (its only HITL is the Phase-6 versioning choice).

Everything else about the skills is unchanged; they keep their canonical home in `claude-plugins`.

## Deploy order (D39)

1. **`substation`** first: migration (new table + FK column + RLS). The runbook's `register.ts`/`publish.ts` cannot run until it exists.
2. **`bureau`** runbook + **`claude-plugins`** skill flags — usable once the migration is live.
3. **`cityhall`** processed-badge (D24) — deferred fast-follow.

No data backfill required (net-new capability).

## Decision log

- **D1/D2/D3/D4** Inputs = `projectId`/name + `version_number`, implicit single `type='site_plan'` submission (fail on 0/>1); version = the city-submitted version (`city_submission_number IS NOT NULL`); discover via `document_version.submission_version_id` ⋈ `document.kind='city_response'`.
- **D5/D6** Invoke the CRC-guide skills in place (canonical home stays `claude-plugins`); one worker per document.
- **D7 (model 7a)** Harness sub-agents cannot do live HITL → pre-flight resolves all human decisions up front, then headless parallel workers, then one end readout gate.
- **D9/D10/D11/D12** Redline path = navalbase `step-3-analyze-pdfs` → `refine-step-3-output` → `generate-crc-guides-from-redlines`; **no** `layer-2-enrich`; navalbase output is a local intermediate; navalbase env is an operator precondition checked at pre-flight.
- **D13/D14/D15** Pre-flight batches unknown-prefix naming (+ pre-INSERT), versioning intent, and per-redline dept code/label; emergent HITL → keep-and-flag default.
- **D16/D17/D18** Publish is a thin FK-stamp (content already in `crc-guides`); `register` inactive after assembly, `publish` on operator go; `execution_metadata` holds per-doc results.
- **D19/D20** Generation numbering (skills) is the source of truth for what CRC reads; registry is provenance/badge only; keep the one-active index anyway.
- **D21/D22/D23** Assume PDF (fail loudly otherwise); `misc` → skipped, no stamp; per-doc `failed` status → subset re-run picks it up.
- **D24** cityhall processed-badge deferred.
- **D26/D27/D28** Nested-spawn depth carried as a validation item with an orchestrator-invokes-skills fallback; low doc-worker concurrency; explicit Opus/Sonnet model on every spawn.
- **D29** Run-dir folder contract mirrors preprocessing-v3.
- **D30/D31/D32/D33/D34/D35** New `city_response_processing_run` table (grain = submission_version) + nullable `document_version.city_response_processing_run_id` FK (ON DELETE SET NULL); no version column; pre-processing-style RLS + indexes; subset discovery via `IS NULL`.
- **D36/D37** Skills invoked with explicit `--project-id`/`--submission-version-id`; read the skill's `manifest.json` for the emitted generation/path.
- **D38/D39** Minimal `claude-plugins` flags (`--versioning=bump`, `--defer-uncertain`); deploy substation → bureau+claude-plugins → cityhall.

## Open questions

- **Q1 (nested-spawn depth, D26):** validate the top-level → orchestrator → worker → skill-vision nesting depth against the harness before build. If it fails, adopt the orchestrator-invokes-skills fallback. Which is confirmed before implementation starts?
- **Q2 (refine cost, D9):** `refine-step-3-output` adds an agentic vision multipass per redline doc. Acceptable per-doc cost, or make refine operator-gated per-doc if a redline PDF is visibly clean?
- **Q3 (runbook_ref):** what does `runbook_ref` capture for a runbook that invokes external skills — the bureau runbook git sha only, or also the `claude-plugins` skill sha(s)? (Rec: record both in `execution_metadata` for reproducibility.)
- **Q4 (generation source-of-truth, D19):** confirm we're content to let CRC keep reading the highest generation and never consult the registry. If a future need arises to pin CRC to a specific run, that's the rejected alternative (touch `fetch-crc-guides.ts`).
- **Q5 (jurisdiction resolution):** the unknown-prefix diff (D14b) needs the jurisdiction slug for the project. Confirm the runbook derives it the same way the skills do (project → jurisdiction), and that pre-INSERTing `jurisdiction_departments` at pre-flight matches the skill's own insert shape (`jurisdiction_slug, prefix, display_name, origin, verified`).
