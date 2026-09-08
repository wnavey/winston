# Runbook HITL Questions — Catalog

**Status:** Draft v1
**Date:** 2026-09-08
**Repos touched:** none (documentation/mapping only — this catalog lives in `winston`)
**Reference sources:** `bureau/runbooks/*` (runbook prose + `prompts/`), `claude-plugins` (the skills runbooks invoke)

## Purpose

This is a **cross-runbook catalog of every human-in-the-loop (HITL) question** each bureau runbook asks the operator — where in the run it's asked, what the operator is deciding, the options/default, and what happens with the answer.

Why this document exists: runbooks run in the local Claude Code HITL workspace, and the harness imposes a hard constraint (below) that forces each runbook to *consolidate* its human decisions to a small number of gates. Which questions exist, and when they fire, is currently only discoverable by reading each runbook's prose + `prompts/` files. This catalog makes the full HITL surface legible in one place — for operators (what will I be asked?), for runbook authors (am I front-loading everything I need to?), and for anyone auditing whether a runbook can actually run headless where it claims to.

**Scope of THIS draft (v1):** only the **`process-city-response-docs`** runbook is mapped in full (§2). Every other runbook is scaffolded as a TODO stub (§3) with the exact template to fill in. A future session picks this up and maps the rest — see §4 for how.

---

## 1. The harness constraint that forces HITL consolidation

Read this first — it explains *why* HITL is shaped the way it is in every runbook, and it's the lens the catalog is organized around.

In Claude Code, **only the operator-facing (top-level) session owns the human channel.** A sub-agent spawned via the Agent tool runs **headless** — it cannot raise a live `AskUserQuestion`/AskHuman. So any runbook that fans work out to sub-agents cannot ask the human anything *during* the fan-out.

The consequence, seen across runbooks, is that HITL collapses into **three kinds of gate**:

- **Pre-flight (front-loaded) gates** — every decision the fan-out will need is pulled to *one* batch before any sub-agent is spawned. This is where most questions live.
- **End-of-run (readout) gates** — decisions that *require the results to exist first* (e.g. "publish?") stay at the end, after all sub-agents finish and the top-level session is back in control of the human channel.
- **Suppressed / pre-empted internal HITL** — questions the *invoked skills* would normally ask are not relocated but **defused**: either pre-resolved by passing already-known values, or forced past with non-interactive flags (e.g. `--versioning=bump`, `--defer-uncertain`). These are worth cataloging too, because they represent decisions that *were* human choices and are now silently defaulted — an operator should know what's being decided on their behalf.

A runbook that spawns **no** sub-agents (fully inline) is not bound by this and can ask the human anywhere; note that per-runbook in §3.

**Legend used in the catalog:**
- ⛔ **gate** = a hard stop that blocks progress until the operator answers.
- 🔕 **suppressed** = an internal-skill HITL that's pre-empted/forced by the runbook so it never fires; the "answer" is a fixed default.
- **Grain** = the unit the question is asked *per* (per-run / per-doc / per-prefix / …).

---

## 2. `process-city-response-docs` — fully mapped

**Runbook:** `bureau/runbooks/process-city-response-docs/RUNBOOK.md`
**Prompts:** `bureau/runbooks/process-city-response-docs/prompts/` (`hitl-preflight.md`, `preflight-mcr-scan.md`, `orchestrator.md`, `mcr-worker.md`, `redlines-worker.md`, `hitl-readout.md`)
**Shape:** one pre-flight ⛔ → background orchestrator fans out one Opus sub-agent per doc → one end readout ⛔. Because workers are headless sub-agents, this runbook is fully bound by the constraint in §1.
**Design spec:** `workspaces/city-response-docs/preprocessing/DESIGN-SPEC.md` (the runbook's parent spec; D14b/D18/D19 referenced below).

### 2A. Pre-flight gate ⛔ (before any fan-out) — `prompts/hitl-preflight.md`

All batched into **one** operator conversation, recorded verbatim in `hitl/preflight.md` and folded into `ADDENDUM.md`. Presented in this order:

| ID | Question | Grain | Options / default | What the answer drives |
|----|----------|-------|-------------------|------------------------|
| **PF-a** | Confirm the resolved target + doc inventory: project / submission / `version_number` (+ `city_submission_number`) and the discovered docs bucketed by `city_response_type` (mcr / redlines / misc). "Is this the right target before anything runs?" | per-run | confirm / stop | Go/no-go for the whole run. A wrong target here is the expensive mistake, so it's gate #1. |
| **PF-b** | For each **unknown MCR department prefix** (a prefix appearing on the MCR with no `jurisdiction_departments` row for this jurisdiction): "what is the city's **real** department name for it?" (never a guessed expansion of the prefix). | per-unknown-prefix | operator supplies name; if they can't name it → do **not** fan out that MCR | Runner pre-INSERTs each `(prefix, name)` via `preinsert-departments.ts` (`origin='app', verified=false`) so the headless MCR skill never hits its `dept:unknown` HITL (see 🔕 SK-3). Discovered by the cheap `pdftotext` pre-scan in `preflight-mcr-scan.md` (D14b). |
| **PF-c** | **Versioning intent** for the whole run's crc-guides output. | per-run (one answer) | **bump** (recommended; the only non-interactive-safe choice) — replace / merge need per-file human intent and aren't offered headless | Every worker passes `--versioning=bump`; forces 🔕 SK-2. |
| **PF-d** | For each **`redlines`** doc: the `--dept-code` (short, e.g. `aw`) and `--dept-label` (e.g. `Austin Water (Redlines)`). Derive from the document's metadata/filename if unambiguous; otherwise ask. | per-redlines-doc | operator supplies code + label | Passed to `generate-crc-guides-from-redlines`; names the single-department redline guide output. |

**Bootstrap sub-case (still PF-b):** if the jurisdiction has **0** `jurisdiction_departments` rows, *every* MCR prefix is unknown — an inherently interactive bootstrap. Surface plainly: the operator names the full roster at pre-flight, or the run is deferred until the jurisdiction is onboarded. Never fan out an MCR against a 0-row jurisdiction (the skill hard-fails bootstrap under `--defer-uncertain`).

**navalbase/radar precondition (not a question, but a pre-flight stop):** if any doc is `redlines`, the runner verifies navalbase is runnable before fan-out and stops (telling the operator) if not. Radar itself is started once as a shared singleton by the orchestrator, not per-worker (D12b). This is a fail-loud check, not an operator decision — listed here so the pre-flight surface is complete.

### 2B. End-of-run readout gate ⛔ (after all workers finish) — `prompts/hitl-readout.md`

| ID | Question | Grain | Options | What the answer drives |
|----|----------|-------|---------|------------------------|
| **RO-1** | Given the assembled per-doc inventory + flagged-uncertain ledger + failures: **publish, re-run, or stop?** | per-run | **publish** / **re-run** / **stop** | `publish` → `register.ts` then `publish.ts` (stamps `document_version.city_response_processing_run_id`, flips run active). `re-run` → spawn a fresh orchestrator scoped to the named docs, then return to this readout. `stop` → halt. Recorded verbatim in `hitl/decision.md`. |

This one **must** be at the end: the operator is ruling on results that don't exist until the fan-out completes, and publishing writes to the live DB with the service-role key — so it's deliberately gated on an explicit "publish" (D18).

### 2C. Suppressed / pre-empted skill-internal HITL 🔕

These belong to the invoked `claude-plugins` skills (`generate-crc-guides`, `generate-crc-guides-from-redlines`). The runbook defuses each so a headless worker never stalls — but each represents a decision that is now defaulted on the operator's behalf.

| ID | Skill HITL that would normally fire | How the runbook suppresses it | Decision now defaulted to |
|----|-------------------------------------|-------------------------------|---------------------------|
| **SK-1** | `generate-crc-guides` **Phase-0 DB disambiguation** (which project / submission?) | Pass the already-resolved `--project-id` / `--submission-version-id` (resolved + confirmed at PF-a). | The PF-a-confirmed target. |
| **SK-2** | Versioning prompt (bump / replace / merge, per file) | `--versioning=bump` on every worker (forced by PF-c). | Fresh generation (bump). |
| **SK-3** | `dept:unknown` onboarding (name this unseen prefix) | Pre-INSERT every unknown prefix at pre-flight (PF-b). A *residual* unknown the pre-scan missed hard-fails the skill under `--defer-uncertain` → worker returns `status:"failed"` (never guesses). | The PF-b operator-supplied names. |
| **SK-4** | Phase-9 **uncertain-bucket** keep/drop (per emergent uncertain item) | `--defer-uncertain` → keep-and-flag to the manifest; degraded gate auto-proceeds. | Keep + flag; surfaced in RO-1's ledger. |

**Design note (D19):** RO-1's publish is provenance/badge only — CRC reads the highest crc-guides *generation* (owned by the skills), not this registry. So "publish" does not gate what CRC consumes; it stamps the processed badge. Worth stating in any operator-facing summary so the publish decision isn't over-read.

---

## 3. Other runbooks — TODO stubs

One stub per runbook found under `bureau/runbooks/` (excluding `lib/` and `*-package` helpers). Each is **unmapped** — a future session fills these in using the §4 template. The "Spawns sub-agents?" column is the first thing to determine, because it decides whether the runbook is bound by the §1 constraint (and therefore whether HITL must be front-loaded) or can ask freely inline.

| Runbook | Entry point | Spawns sub-agents? | HITL mapped? |
|---------|-------------|--------------------|--------------|
| `review` | `runbooks/review/RUNBOOK.md` | TODO | ☐ |
| `review-new` | `runbooks/review-new/` | TODO | ☐ |
| `sir` | `runbooks/sir/RUNBOOK.md` | TODO | ☐ |
| `sir-new` | `runbooks/sir-new/` | TODO | ☐ |
| `preprocessing` | `runbooks/preprocessing/RUNBOOK.md` | TODO | ☐ |
| `preprocessing-v3` | `runbooks/preprocessing-v3/RUNBOOK.md` | TODO | ☐ |
| `guide-training` | `runbooks/guide-training/` | TODO | ☐ |
| `jurisdiction` | `runbooks/jurisdiction/` | TODO | ☐ |
| `site-research` | `runbooks/site-research/` | TODO | ☐ |
| `smoke` | `runbooks/smoke/` | TODO | ☐ |
| `process-city-response-docs` | `runbooks/process-city-response-docs/RUNBOOK.md` | **yes** (orchestrator + per-doc workers) | ✅ (§2) |

> Note: `runbooks/lib/` is shared library code, and `smoke-package` is a packaging helper — neither is an operator-run runbook, so neither is listed. Confirm this when mapping.

---

## 4. How a future session fills in the rest

For each TODO runbook in §3, add a section mirroring §2's structure:

1. **Read** the runbook's `RUNBOOK.md` prose and everything under its `prompts/` dir. Grep the prompts for the human-channel surface: `AskUserQuestion`, `HITL`, `pre-flight`/`preflight`, `readout`, `gate`, `⛔`, `operator`, `confirm`, and any `hitl-*.md` prompt files.
2. **Determine sub-agent use** (the §3 "Spawns sub-agents?" column). If it fans out, HITL must be front-loaded (pre-flight) + end-gated (readout) per §1; if it's fully inline, questions can appear anywhere and should be listed in run order.
3. **Enumerate three buckets**, using the same table columns as §2:
   - **Pre-flight gates ⛔** (ID prefix `PF-`) — front-loaded operator questions.
   - **End-of-run gates ⛔** (ID prefix `RO-`) — decisions that need results first.
   - **Suppressed/pre-empted skill HITL 🔕** (ID prefix `SK-`) — internal-skill questions the runbook defaults via flags/pre-resolution; record what's being decided on the operator's behalf.
4. For every row capture: **question**, **grain**, **options/default**, **what the answer drives**, and the **file:prompt** it's sourced from. Cite prompt file paths (and line numbers where useful) so the catalog is auditable against the source.
5. Flip the §3 "HITL mapped?" box to ✅ and link to the new section.

**Open questions for the catalog itself (Q1–Q3):**
- **Q1** — Should 🔕 suppressed HITL be in scope, or only live ⛔ gates? (v1 includes them, because a defaulted decision is still a decision the operator may want visibility into — but it widens the catalog.)
- **Q2** — Should this catalog live in `winston` (design/reference, as here) or move into `bureau/runbooks/README.md` as operator-facing docs once stable? (Leaning: draft/iterate in winston, then port a stabilized summary into bureau.)
- **Q3** — Is there a shared HITL vocabulary (gate IDs, the pre-flight/readout/suppressed taxonomy) worth lifting into the runbook-authoring guidelines so new runbooks are consistent by construction?
