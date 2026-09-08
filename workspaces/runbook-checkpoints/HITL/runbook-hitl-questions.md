# Runbook HITL Questions — Catalog

**Status:** Draft v2
**Date:** 2026-09-08
**Repos touched:** none (documentation/mapping only — this catalog lives in `winston`)
**Reference sources:** `bureau/runbooks/*` (runbook prose + `prompts/` for 1.0; `runbook.yaml` + `steps/*/step.yaml` + contracts for 2.0), `claude-plugins` (the skills runbooks invoke)

> **Revision note (v2).** v1 mapped only `process-city-response-docs` and stubbed the rest. v2 completes the catalog: **all 12 runbooks under `bureau/runbooks/` are now mapped**, and the catalog is organized around a new **Runbook 1.0 vs 2.0** taxonomy (§1). 1.0 = prose `RUNBOOK.md` runbooks that run inline in the local Claude Code HITL workspace and fan out via headless sub-agents; 2.0 = graph/conductor runbooks (`runbook.yaml` + `steps/*/step.yaml`) where a human gate is a `runner: none` step. The v1 §1 "harness constraint" is retained but scoped to 1.0 (§2). A parallel §3 describes the 2.0 HITL mechanism. Every runbook now has a full section (§5–§6). Open questions renumbered and extended (Q1–Q6).

## Purpose

This is a **cross-runbook catalog of every human-in-the-loop (HITL) question** each bureau runbook asks the operator — where in the run it's asked, what the operator is deciding, the options/default, and what happens with the answer.

Why this document exists: which HITL questions exist, and when they fire, is currently only discoverable by reading each runbook's source. This catalog makes the full HITL surface legible in one place — for operators (what will I be asked?), for runbook authors (am I front-loading / gating everything I need to?), and for anyone auditing whether a runbook can actually run headless where it claims to.

**A key structural finding:** there are **two distinct generations of runbook** in bureau, and they realize HITL through **two entirely different mechanisms**. Everything in this catalog is organized around that split.

---

## 1. Runbook 1.0 vs Runbook 2.0 — the taxonomy

The two generations are distinguished by their **execution model**, and that in turn dictates how they do HITL. The tell is the entry-point file in the runbook's directory.

| | **Runbook 1.0** | **Runbook 2.0** |
|---|---|---|
| **Entry point** | `RUNBOOK.md` (prose orchestrator) | `runbook.yaml` + `steps/*/step.yaml` |
| **Execution** | Run **inline in the local Claude Code HITL workspace**. A top-level operator-facing session reads the prose and drives the run, spawning **headless sub-agents** via the Agent tool to fan out work. | A **graph of steps** executed by **conductor** (conductor / "conductor 2.0"). Each step is one agent invocation that writes one output folder, judged by a deterministic contract (`contract.test.ts`). `graph.json` is generated at kickoff. |
| **HITL mechanism** | Prose **readout-in-chat** gates. Because headless sub-agents can't own the human channel (§2), questions consolidate into **pre-flight (PF)**, **readout (RO)**, and **suppressed skill-internal (SK)** buckets. | A **`runner: none` step** IS a human gate: conductor **exits 75** ("waiting at a `runner: none` step whose contract has not passed") and parks until a human drops the step's output folder in. Plus **contract-failure / `NEEDS-OPERATOR` escalations** and the **`directives.decide[]`** headless-authority escape hatch (§3). |
| **Human channel** | Live chat with the inline runner. | File-drop into the parked step's folder (e.g. `request.json`, `decision.json`). **No live prompt** — `AskUserQuestion` appears in zero runbooks. |
| **Status** | `sir`, `review` are **superseded** by their `-new` 2.0 variants (per `runbooks/README.md`); `preprocessing`/`preprocessing-v3`/`process-city-response-docs` are **live** 1.0 runbooks with no 2.0 replacement yet. | The **current** generation for reviews and SIRs (`review-new`, `sir-new`) and for the training/jurisdiction/fixture machinery. |

### Our runbooks, categorized

| Runbook | Generation | Entry point | Human gates (count / kind) | Mapped |
|---------|:----------:|-------------|----------------------------|:------:|
| `review` | **1.0** | `RUNBOOK.md` | 6 PF + 6 RO + 5 SK (phase-boundary readouts) | §5.1 |
| `sir` | **1.0** | `RUNBOOK.md` | 0 PF + 3 RO + 1 SK (phase-boundary readouts) | §5.2 |
| `preprocessing` (v2) | **1.0** | `RUNBOOK.md` | 3 RO + 4 SK (2 end gates) | §5.3 |
| `preprocessing-v3` | **1.0** | `RUNBOOK.md` | 2 RO + 3 SK (1 end gate) | §5.4 |
| `process-city-response-docs` | **1.0** | `RUNBOOK.md` | 1 PF-batch + 1 RO + 4 SK | §5.5 |
| `review-new` | **2.0** | `runbook.yaml` | 2 `runner: none` (`1.1-inputs`, `3.12-deliver`) + 1 conditional escalation | §6.1 |
| `sir-new` | **2.0** | `runbook.yaml` | 2 `runner: none` (`1.1-inputs`, `3.10-deliver`); paid gate delegated to `site-research` | §6.2 |
| `guide-training` | **2.0** | `runbook.yaml` | 1 `runner: none` (`0.1-request`) + readiness park | §6.3 |
| `site-research` | **2.0** (sub-runbook) | `runbook.yaml` | 2 `runner: none` (`8.1-facts-gate`, `9.7-hands`); readout consumed by caller | §6.4 |
| `jurisdiction` | **2.0** | `runbook.yaml` | 1 `runner: none` placeholder + de-facto contract-failure gates (PARKED ×9, lock, surveyor merge) | §6.5 |
| `smoke` | **2.0** (fixture) | `runbook.yaml` | 2 `runner: none` (`1.1-inputs`, `2.3-hitl`) | §6.6 |
| `smoke-package` | **2.0** (sub-runbook fixture) | `runbook.yaml` | **0** (deliberate: reusable sub-runbook convention) | §6.6 |

> Not listed: `runbooks/lib/` (shared library code + `AGENTS-core.md`, no operator entry point). Two conductor **workflows** — `bureau/workflows/completeness-check/` and `bureau/workflows/comment-resolution-check/` — live outside `runbooks/` and are graph/`workflow.yaml`-based (arguably "2.0-class"); they are **out of scope for this catalog** (which is scoped to `runbooks/`) and flagged as **Q6**.

---

## 2. Runbook 1.0 — the harness constraint that forces HITL consolidation

Read this to understand *why* 1.0 HITL is shaped the way it is. It is the lens the 1.0 sections (§5) are organized around.

In Claude Code, **only the operator-facing (top-level) session owns the human channel.** A sub-agent spawned via the Agent tool runs **headless** — it cannot raise a live `AskUserQuestion`/AskHuman. So any 1.0 runbook that fans work out to sub-agents cannot ask the human anything *during* the fan-out.

The consequence, seen across every 1.0 runbook, is that HITL collapses into **three kinds of gate**:

- **Pre-flight (front-loaded) gates (`PF-`)** — every decision the fan-out will need is pulled to *one* batch before any sub-agent is spawned. Runbooks whose top-level runner stays inline and interactive *between* phases (e.g. `sir`, `review`) may instead distribute questions across phase-boundary readouts rather than front-loading them.
- **End-of-run / readout gates (`RO-`)** — decisions that *require the results to exist first* (e.g. "publish?") stay at a phase boundary or the end, after sub-agents finish and the top-level session is back in control of the human channel.
- **Suppressed / pre-empted internal HITL (`SK-`)** — questions the *invoked skills / workers* would normally ask are not relocated but **defused**: either pre-resolved by passing already-known values, or forced past with non-interactive flags (e.g. `--versioning=bump`, `--defer-uncertain`), or deferred to a readout ledger. These are worth cataloging because they represent decisions that *were* human choices and are now silently defaulted — an operator should know what's being decided on their behalf.

A 1.0 runbook that spawns **no** sub-agents (fully inline) would not be bound by this — but in practice every live 1.0 runbook fans out.

---

## 3. Runbook 2.0 — HITL as `runner: none` graph gates

Read this to understand *how* 2.0 runbooks do HITL. It is the lens the 2.0 sections (§6) are organized around.

A 2.0 runbook is a **graph of steps** run by conductor. A step names a `runner` preset (`judgment`/`discipline`/`format`/`mechanical`/`vision`/`script`/…) that says which harness+model executes it. **A step declared `runner: none` has no machine executor — its output must be produced by a human.** Conductor advances the graph until it reaches such a step whose contract has not yet passed, then **exits 75** and parks. The human satisfies the gate by **writing the step's output folder** (e.g. dropping a validated `request.json` or `decision.json`); conductor re-advances when the contract passes.

So the 2.0 HITL surface is:

- **`runner: none` steps** — the true human gates. Across our runbooks these cluster into a near-universal skeleton:
  - a **front gate** — `1.1-inputs` / `0.1-request` — where a human authors the run's `request.json` (this IS kickoff; the run has no premises until it validates); and
  - a **terminal gate** — `…-deliver` — where a human reads the readout and writes `decision.json` = `approved` (with a publish plan) or `revise` (with notes).
- **`directives.decide[]`** (in `request.json`) — the **headless-authority escape hatch**: the operator can pre-authorize the conductor/driver to *auto-adjudicate* named waiting steps without a human, recording `decided_by` in the decision. This is how a 2.0 runbook runs unattended where the operator has granted authority — the 2.0 analog of a 1.0 `SK-` suppression, but explicit and per-step.
- **Contract-failure / `NEEDS-OPERATOR` escalations** — a non-`none` step can still *demand* a human by writing a sentinel file (`NEEDS-OPERATOR.md`, `PARKED.md`, `LOCKED.md`, `needs-hands.json`) that **fails its contract on purpose**, parking the run until a human resolves what it names. `jurisdiction` expresses most of its human stops this way rather than via `runner: none`.
- **`## Need you` / readout briefs** — prose the run surfaces for the operator to act on (buy a record, sit at a headed browser, co-drive a login). In a sub-runbook (`site-research`) the brief is authored but the actual *pause* lives in the calling runbook.

**Legend used across the catalog:**
- ⛔ **gate** = a hard stop that blocks progress until the operator answers (1.0 readout; 2.0 `runner: none` or contract-failure).
- 🔕 **suppressed** = an internal-skill/worker HITL that's pre-empted/forced/deferred so it never fires live; the "answer" is a fixed default (1.0 `SK-`; 2.0 `directives.decide[]`).
- **Grain** = the unit the question is asked *per* (per-run / per-doc / per-sheet / per-family / …).

---

## 4. How this catalog is laid out

- **§5** — the five **Runbook 1.0** mappings (`review`, `sir`, `preprocessing`, `preprocessing-v3`, `process-city-response-docs`), each in PF / RO / SK buckets.
- **§6** — the seven **Runbook 2.0** mappings (`review-new`, `sir-new`, `guide-training`, `site-research`, `jurisdiction`, `smoke`, `smoke-package`), each as `runner: none` gates + kickoff inputs + escalations.
- **§7** — cross-runbook observations.
- **§8** — open questions (Q1–Q6).

Every row cites the source `file:line` so the catalog is auditable against bureau.

---

## 5. Runbook 1.0 mappings

### 5.1 `review` (1.0 — superseded by `review-new`)

**Source:** `runbooks/review/RUNBOOK.md` + `prompts/` (`1-frame/`, `2-research/`, `3-review/`, `cross-account-fanout.md`, `shared-conventions.md`, `tool-bug-sweep.md`).
**Shape:** Phased fan-out (Frame → Research → Review) with two hard STOP checkpoints between phases. 5-level nesting (runner → phase orchestrator → discipline orchestrator → guide worker → helper), depth 4 / concurrency 50. Phase orchestrators run headless and author readout files; the inline top-level runner presents them. HITL sits at phase boundaries: HITL1 front-loaded before the research+review fan-out, HITL2 a readout after research, delivery closes phase 3.
**Spawns sub-agents?** Yes — heavily.

**5.1A Pre-flight gates ⛔ (`PF-`) — HITL1 frame confirmation**

| ID | Question | Grain | Options / default | What the answer drives | Source |
|----|----------|-------|-------------------|------------------------|--------|
| **PF-1** | Are session settings `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=4` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=50` set? | per-run (step 0) | must be set; defaults (3/20) throttle the fan-out | Whether the 5-level review fan-out can spawn at all | `RUNBOOK.md:80` |
| **PF-2** | Plan-set identity — "which plan set is this, and is it the one you asked for?" (submission version / case number) | per-run | confirm / correct (spawns fresh phase-1 orchestrator scoped to the change) | The exact submission every discipline reviews | `RUNBOOK.md:60`; `prompts/1-frame/hitl1-readout.md:5,30,52` |
| **PF-3** | Jurisdiction, where given vs resolved authority disagree | per-run | confirm which authority | Which regulatory stack the review runs against | `prompts/1-frame/hitl1-readout.md:23,30` |
| **PF-4** | Parcel set (canonical parcel IDs) | per-run | confirm / correct (change messages the records-pull agent a delta) | The `## Canonical Parcel IDs` set every later agent keys on | `prompts/1-frame/hitl1-readout.md:30`; `RUNBOOK.md:91`; `prompts/1-frame/1-frame.md:27` |
| **PF-5** | Open `[Confirm]` items grouped by closer (e.g. resolved vs declared site-area) | per-run, per-item | confirm resolved value / correct by naming the governing figure | Values feeding multiple disciplines (impervious cover, detention, parkland) | `prompts/1-frame/hitl1-readout.md:26,30,44,48` |
| **PF-6** | Corner-cutting disclosure (only when operator authorized "cut corners where clean") | per-run | disclosed in the readout; each cut also becomes a data-gap comment | Where the run may skim; makes every cut visible | `RUNBOOK.md:75` |

HITL1 corrections loop until confirmed (`RUNBOOK.md:91`). The count-back gate (§20) is the run's one *blocking* check but is code, not HITL (`shared-conventions.md:54`).

**5.1B Readout gates ⛔ (`RO-`) — HITL2 (research) + delivery**

| ID | Question | Grain | Options / default | What the answer drives | Source |
|----|----------|-------|-------------------|------------------------|--------|
| **RO-1** | "Anything about this site/plan set we could plausibly get by desk research that we have not got?" | per-run | fetch+file+read a document before review / proceed | Last point a document can still enter the run; gates start of phase 3 | `RUNBOOK.md:56,62`; `prompts/2-research/hitl2-readout.md:7-13,78` |
| **RO-2** | "Need you?" — a decision to acquire a document | per-run, per-item | yes (name doc, cost, chain) / no | Routes a fetch-and-file session before review | `prompts/2-research/hitl2-readout.md:19-21,75-76` |
| **RO-3** | "Need you?" — sit at a headed browser (login / unsolvable challenge) | per-run, per-wall | operator co-drives the browser | Clears a wall to retrieve a blocked document | `prompts/2-research/hitl2-readout.md:22`; `shared-conventions.md:53` |
| **RO-4** | "Need you?" — authorize money (paid clerk tier / paywall) | per-run, per-item | authorize spend / decline (free-tier run ships `priority-pull-list.md`) | Whether a paid-tier records pull happens | `prompts/2-research/hitl2-readout.md:23`; `prompts/2-research/2.1-records-pull.md:42,53` |
| **RO-5** | Operator reads the rendered report; revisions? | per-run (delivery) | accept / request revisions (narrow phase-3 loop) | Final deliverable; scoped rework → redo → re-render | `RUNBOOK.md:57,64,93`; `prompts/3-review/3-review.md:120-124` |
| **RO-6** | Post-delivery tool-bug sweep | per-run | operator runs it after delivery (as a Fable session) | Triage of the run's append-only `tool-bugs.md` | `RUNBOOK.md:64`; `prompts/tool-bug-sweep.md:3` |

**5.1C Suppressed / pre-empted skill HITL 🔕 (`SK-`)**

| ID | Decision defaulted for the operator | How it's suppressed | Source |
|----|-------------------------------------|---------------------|--------|
| **SK-1** | CAPTCHA / Turnstile / score-based challenge | solved autonomously (browser-discipline rungs 5-6) before any ask; only an unclearable wall escalates → RO-3 | `shared-conventions.md:53`; `prompts/2-research/2.2-researchers/_common.md:123-124` |
| **SK-2** | Free vs paid retrieval route for a document | free routes attempted+recorded autonomously; only a genuine paid tier becomes an ask → RO-4 | `shared-conventions.md:53`; `prompts/2-research/2.1-records-pull.md:42,53` |
| **SK-3** | Cross-account trust when `mayor-herdr` refuses an untrusted account | runbook drops that account and uses the next with headroom — operator explicitly NOT asked | `prompts/cross-account-fanout.md:44,63` |
| **SK-4** | Mechanical check failures (prose/limits/leak/citation/handoffs) | advise-only, non-blocking; fix or disclose in deliverable (count-back §20 is the sole code-blocking exception) | `shared-conventions.md:54` |
| **SK-5** | Adversarial-pass findings on each HITL readout draft | run before the file is written to `hitl/`; operator sees an already-attacked frame — suppresses a second confirmation round | `RUNBOOK.md:72-74`; `prompts/1-frame/1-frame.md:49-56` |

### 5.2 `sir` (1.0 — superseded by `sir-new`)

**Source:** `runbooks/sir/RUNBOOK.md` + `prompts/` (`phase-1/`, `phase-2/`, `phase-3/`, `shared-conventions.md`).
**Shape:** Sequential three-phase pipeline (Frame → Research → Analysis/Deliverable). The inline top-level runner spawns one background phase orchestrator per phase and idles between them, so every HITL point is an inter-phase readout gate: two hard stops (HITL1 frame, HITL2 acquisition) + an end publish gate. No `AskUserQuestion` anywhere — all HITL is prose readout-in-chat.
**Spawns sub-agents?** Yes.

**5.2A Pre-flight gates (`PF-`):** **Empty.** Kickoff captures the operator's request *verbatim* into `ADDENDUM.md` (depth posture, coverage-checklist items, speed/corner-cutting authorization) then immediately spawns phase 1 (`RUNBOOK.md:56-61`). These are captured inputs, not posed questions; because the runner stays inline between phases, HITL is distributed to the readouts below rather than front-loaded.

**5.2B Readout gates ⛔ (`RO-`)**

| ID | Question | Grain | Options / default | What the answer drives | Source |
|----|----------|-------|-------------------|------------------------|--------|
| **RO-1** | **HITL1 Regulatory Orientation:** are foundational facts correct — authority, parcel identity, address, zoning, flood status? (survey posture: also the candidate-uses roster) | per-run frame; after phase 1, before research spend | confirmed / corrections; loop until confirmed; default = do not proceed | Gates research spend on this frame. Corrections → fresh scoped phase-1 orchestrator; parcel change messaged to the running records-pull agent. Recorded in `hitl/hitl1-decision.md` | `RUNBOOK.md:36,41,61`; `prompts/phase-1/hitl1-readout.md:3,22,26` |
| **RO-2** | **HITL2 Acquisition:** "anything about this site we could still plausibly get by desk research that we have not got?" → "Need you?" asks | per-run gaps; after phase 2, before compose | (a) fetch-land-reread a doc before compose; (b) sit at a headed browser; (c) authorize money; or "No." | Whether anything is acquired before composition; browser co-drive; paid tier buy. Recorded in `hitl/hitl2-decision.md` | `RUNBOOK.md:37,43,62`; `prompts/phase-2/hitl2-readout.md:6-9,14-18` |
| **RO-3** | **Delivery / publish:** operator reads the actual PDF; revisions? publish to the app? | per-run deliverable; after phase 3 | request revisions (edit source → re-scrub → re-render) / explicit "publish"; default = do NOT publish | Revision loop; publish happens only on explicit "publish", via the `upload-sir` skill. Then `tool-bug-sweep.md` runs | `RUNBOOK.md:38,45,63` |

Conditional escalations feeding these gates (not standing questions): a coverage-floor failure in the records pull may require "operator sign-off" as a last resort (`records-pull.md:31`); the "Stop and escalate" lever routes a broken-premise stop to the top-level runner (`RUNBOOK.md:54`).

**5.2C Suppressed / pre-empted skill HITL 🔕 (`SK-`)**

| ID | Decision defaulted for the operator | How it's suppressed | Source |
|----|-------------------------------------|---------------------|--------|
| **SK-1** | CAPTCHA / Turnstile / score-based challenge | solved autonomously (CapSolver + browser-discipline rungs 5-6) before any ask; only a login wall / paid tier / session-bound token falls through → RO-2 | `shared-conventions.md:31`; `prompts/phase-2/researchers/_common.md:107,114`; `records-pull.md:42` |

Note: the `upload-sir` skill carries its own interactive opt-in publish gate + org/project pickers; the runbook does **not** suppress it — it routes RO-3's explicit "publish" *into* that skill so its HITL runs. PDF/DOCX rendering is local scripts (`render_pdf.py`/`render_docx.py`), so there is no render-skill HITL.

### 5.3 `preprocessing` (v2) (1.0 — live)

**Source:** `runbooks/preprocessing/RUNBOOK.md` + `prompts/` (`phase-1/`, `phase-2/`, `shared-conventions.md`, `zoom-recipes.md`, `tool-bug-sweep.md`).
**Shape:** Two-phase, two-stop prose orchestration. Phase 1 (read: three tracks) ends at HITL-1; a `refine` ruling forks into opt-in Phase 2 (box-refine) ending at HITL-2; publish is deterministic after the go.
**Spawns sub-agents?** Yes — two fan-out levels (per-sheet triad Reader A + Reader B + Reconciler; per-doc/drainage track workers; adversarial reader; on `refine`, per-sheet box-refine workers). No `AskUserQuestion` — every gate is prose readout.

**5.3A Pre-flight (`PF-`) — kickoff parameters, not posed questions** (listed for completeness)

| ID | Input | Grain | Default | Drives | Source |
|----|-------|-------|---------|--------|--------|
| **PF-1** | `projectId` (only required input, "D13") | run | none | Resolves latest submission + plan-set + unprocessed sheet/doc sets → `ADDENDUM.md` | `RUNBOOK.md:84,100` |
| **PF-2** | Scope restriction? | run / sheet subset | all unprocessed | Whether run-1 reads only named probe sheets | `RUNBOOK.md:89` |
| **PF-3** | Run-1 calibration: read *everything* with full triad? | plan-set | tier-gated reading | Forces full triad on every sheet to measure drawing-only path loss | `prompts/phase-1/phase-1.md:13` |

**5.3B Readout gates ⛔ (`RO-`)**

| ID | Question | Grain | Options / default | What the answer drives | Source |
|----|----------|-------|-------------------|------------------------|--------|
| **RO-1** | **HITL-1 reading readout:** publish these eyeballed boxes, refine, re-tier, or stop? | run (plan-set) | `publish` / `refine` / `re-tier` / `stop`; publish only on explicit word | publish → register+publish `phase-1-reading/artifact.json`; refine → spawn Phase 2; re-tier → fresh scoped phase-1 pass; stop → halt | `RUNBOOK.md:58,91-94`; `prompts/phase-1/hitl1-readout.md:3,31` |
| **RO-2** | **HITL-2 box-refine readout** (only after RO-1 `refine`): publish refined, publish as-is, or stop? | run (plan-set) | `publish` / `publish as-is` / `stop` | publish → register+publish `phase-2-refine/artifact.json`; as-is → discard refinement, publish phase-1; stop → halt | `RUNBOOK.md:60,95`; `prompts/phase-2/hitl2-readout.md:3,30` |
| **RO-3** | Confirm `projectId` is the intended target before the publish go (service-role DB write) | run | verify / abort | Guards the register+publish DB write | `RUNBOOK.md:100` |

**5.3C Suppressed / pre-empted worker HITL 🔕 (`SK-`)**

| ID | Decision defaulted for the operator | How it's suppressed | Source |
|----|-------------------------------------|---------------------|--------|
| **SK-1** | Applicant-only questions a reader hits mid-read | not asked live — ledgered under `needs-operator`, surfaced in HITL-1 gap ledger | `prompts/phase-1/readers/reconcile.md:28`; `prompts/phase-1/hitl1-readout.md:23` |
| **SK-2** | Is this sheet value-bearing (full triad) or pure-drawing (single read)? | auto-resolved by tier-classifier (sonnet), "ties break UP"; operator override deferred to RO-1 | `prompts/phase-1/phase-1.md:13`; `prompts/phase-1/tier-classifier.md` |
| **SK-3** | Is a matched resubmittal pair the same sheet or an unrelated chain-break? | pre-resolved by the reader via `scripts/lib/parity.ts:chainBreak` | `prompts/phase-1/phase-1.md:20` |
| **SK-4** | Spend a higher-DPI / rotated crop to close a value? | orchestrator/reconciler approves autonomously as a costed disposition (recorded, not asked) | `RUNBOOK.md:77`; `prompts/phase-1/readers/reconcile.md:28` |

### 5.4 `preprocessing-v3` (1.0 — live)

**Source:** `runbooks/preprocessing-v3/RUNBOOK.md` + `prompts/` (`read/`, `shared-conventions.md`, `zoom-recipes.md`, `tool-bug-sweep.md`).
**Shape:** Single-phase, single-stop prose orchestration — one linear four-read pass per sheet (summary/label → boxes → transcription → reading guide) across three tracks, ending at one reading readout gate; publish deterministic after the go. **No tiering, no second reader, no reconcile, no adversarial pass, no box-refine phase** — the collapse of the triad is the headline difference from v2.
**Spawns sub-agents?** Yes — one fan-out level (one sheet worker per unprocessed sheet + per-doc/drainage track workers).

**5.4A Pre-flight (`PF-`) — kickoff parameters**

| ID | Input | Grain | Default | Drives | Source |
|----|-------|-------|---------|--------|--------|
| **PF-1** | `projectId` | run | none | Resolves submission + plan-set + unprocessed entity sets | `RUNBOOK.md:13,73` |
| **PF-2** | `submission_version.version_number` | run | **must NOT default to "latest"** — operator names it; fail loudly if none | Sets run grain (`submission_version_id`) + exact rows publish writes | `RUNBOOK.md:13,73-74` |
| **PF-3** | Scope restriction? | run / sheet subset | all unprocessed | Whether run-1 reads only named probe sheets | `RUNBOOK.md:79` |

Difference from v2: `version_number` is a **new mandatory second input** with an explicit no-default rule (v2 took only `projectId` and resolved "latest").

**5.4B Readout gates ⛔ (`RO-`)**

| ID | Question | Grain | Options / default | What the answer drives | Source |
|----|----------|-------|-------------------|------------------------|--------|
| **RO-1** | **HITL reading readout:** publish the read as-is, re-read named sheets, or stop? | run (plan-set) | `publish` / `re-read` / `stop`; publish only on explicit word | publish → register+publish `reading/artifact.json`; re-read → fresh scoped orchestrator (fresh four-read) → back to gate; stop → halt | `RUNBOOK.md:48,81-83`; `prompts/hitl-readout.md:3,29` |
| **RO-2** | Confirm target (`projectId` + `version_number`) before the publish go (RLS-bypassing service-role write) | run | verify / abort | Guards the live DB write into resolved rows | `RUNBOOK.md:64` |

Difference from v2: **no HITL-2** (box-refine removed) and **no `refine`/`re-tier` options** — the fork collapses to a single `publish/re-read/stop`; the publish safety confirm now covers both target inputs.

**5.4C Suppressed / pre-empted worker HITL 🔕 (`SK-`)**

| ID | Decision defaulted for the operator | How it's suppressed | Source |
|----|-------------------------------------|---------------------|--------|
| **SK-1** | Applicant-only questions a worker hits mid-read | ledgered under `needs-operator`, surfaced in HITL gap ledger | `prompts/hitl-readout.md:21`; `prompts/read/orchestrator.md:35` |
| **SK-2** | Is a matched resubmittal pair an unrelated chain-break? | pre-resolved by the worker via `scripts/lib/parity.ts:chainBreak` | `prompts/read/orchestrator.md:17` |
| **SK-3** | Spend a higher-DPI / rotated crop to close a value? | orchestrator approves autonomously as a costed disposition | `RUNBOOK.md:68`; `prompts/read/orchestrator.md:13` |

Difference from v2: the SK bucket shrinks by one — v2's SK-2 (tiering/full-triad override) has no v3 analogue because v3 abolished tiering.

### 5.5 `process-city-response-docs` (1.0 — live)

**Source:** `runbooks/process-city-response-docs/RUNBOOK.md` + `prompts/` (`hitl-preflight.md`, `preflight-mcr-scan.md`, `orchestrator.md`, `mcr-worker.md`, `redlines-worker.md`, `hitl-readout.md`).
**Design spec:** `workspaces/city-response-docs/preprocessing/DESIGN-SPEC.md` (D14b/D18/D19).
**Shape:** one pre-flight ⛔ → background orchestrator fans out one Opus sub-agent per doc → one end readout ⛔. Workers are headless sub-agents, so fully bound by §2.
**Spawns sub-agents?** Yes (orchestrator + per-doc workers).

**5.5A Pre-flight gate ⛔ (`PF-`) — `prompts/hitl-preflight.md`**

All batched into **one** operator conversation, recorded verbatim in `hitl/preflight.md` and folded into `ADDENDUM.md`:

| ID | Question | Grain | Options / default | What the answer drives |
|----|----------|-------|-------------------|------------------------|
| **PF-a** | Confirm resolved target + doc inventory: project / submission / `version_number` (+ `city_submission_number`) and discovered docs bucketed by `city_response_type` (mcr / redlines / misc). "Right target before anything runs?" | per-run | confirm / stop | Go/no-go for the whole run — the expensive mistake to catch first |
| **PF-b** | For each **unknown MCR department prefix** (no `jurisdiction_departments` row): the city's **real** department name (never a guessed expansion). | per-unknown-prefix | operator names it; if they can't → don't fan out that MCR | Runner pre-INSERTs each `(prefix, name)` via `preinsert-departments.ts` (`origin='app', verified=false`) so the headless MCR skill never hits its `dept:unknown` HITL (🔕 SK-3). Discovered by the `pdftotext` pre-scan in `preflight-mcr-scan.md` (D14b) |
| **PF-c** | **Versioning intent** for the whole run's crc-guides output. | per-run | **bump** (only non-interactive-safe choice; replace/merge need per-file intent) | Every worker passes `--versioning=bump`; forces 🔕 SK-2 |
| **PF-d** | For each **`redlines`** doc: `--dept-code` (e.g. `aw`) and `--dept-label` (e.g. `Austin Water (Redlines)`). Derive from metadata/filename if unambiguous, else ask. | per-redlines-doc | operator supplies code + label | Passed to `generate-crc-guides-from-redlines`; names the single-department redline guide output |

**Bootstrap sub-case (still PF-b):** if the jurisdiction has **0** `jurisdiction_departments` rows, every MCR prefix is unknown — the operator names the full roster at pre-flight, or the run defers until the jurisdiction is onboarded. Never fan out an MCR against a 0-row jurisdiction.

**navalbase/radar precondition (fail-loud check, not a question):** if any doc is `redlines`, the runner verifies navalbase is runnable before fan-out and stops if not. Radar starts once as a shared singleton by the orchestrator (D12b).

**5.5B End-of-run readout gate ⛔ (`RO-`) — `prompts/hitl-readout.md`**

| ID | Question | Grain | Options | What the answer drives |
|----|----------|-------|---------|------------------------|
| **RO-1** | Given the per-doc inventory + flagged-uncertain ledger + failures: **publish, re-run, or stop?** | per-run | **publish** / **re-run** / **stop** | `publish` → `register.ts` then `publish.ts` (stamps `document_version.city_response_processing_run_id`, flips run active); `re-run` → fresh orchestrator scoped to named docs → back to readout; `stop` → halt. Recorded in `hitl/decision.md` |

Must be at the end: the operator rules on results that don't exist until fan-out completes, and publishing writes to live DB with the service-role key (D18).

**5.5C Suppressed / pre-empted skill HITL 🔕 (`SK-`)** — from `generate-crc-guides` / `generate-crc-guides-from-redlines`

| ID | Skill HITL that would normally fire | How the runbook suppresses it | Defaulted to |
|----|-------------------------------------|-------------------------------|--------------|
| **SK-1** | Phase-0 DB disambiguation (which project/submission?) | pass the resolved `--project-id` / `--submission-version-id` (confirmed at PF-a) | The PF-a target |
| **SK-2** | Versioning prompt (bump/replace/merge, per file) | `--versioning=bump` on every worker (PF-c) | Fresh generation (bump) |
| **SK-3** | `dept:unknown` onboarding (name this unseen prefix) | pre-INSERT every unknown prefix at pre-flight (PF-b); a residual unknown hard-fails under `--defer-uncertain` → worker returns `status:"failed"` | The PF-b names |
| **SK-4** | Phase-9 uncertain-bucket keep/drop | `--defer-uncertain` → keep-and-flag; degraded gate auto-proceeds | Keep + flag; surfaced in RO-1's ledger |

**Design note (D19):** RO-1's publish is provenance/badge only — CRC reads the highest crc-guides *generation* (owned by the skills), not this registry. "Publish" stamps the processed badge; it does not gate what CRC consumes.

---

## 6. Runbook 2.0 mappings

Each 2.0 runbook is mapped as: its **`runner: none` human gates**, the **kickoff inputs** the operator supplies in `request.json`, and any **escalation / publish** surface. Recall (§3) that `directives.decide[]` lets the operator pre-authorize the conductor to auto-decide named waiting steps headlessly.

### 6.1 `review-new` (2.0 — current)

**Source:** `runbooks/review-new/runbook.yaml` + `steps/*` (18 steps, phases 1.x→4.1). Runners: `judgment`/`discipline`/`format` (`runbook.yaml:5-8`).
**Shape:** graph of 18 steps, each one agent → one output folder judged by a `contract.test.ts`. Exactly **two `runner: none` gates**: `1.1-inputs` (kickoff) and `3.12-deliver` (delivery/publish).

**6.1A Human-gate steps (`runner: none`) ⛔**

| Step | What the human must do/decide | What it unblocks | Source |
|------|-------------------------------|------------------|--------|
| **`1.1-inputs`** | Author `request.json` — nothing in the runbook writes this. State the review request verbatim, jurisdiction slug, the one non-derivable `submission_version_id` (UUID), and a locatable `site`. Contract blocks until it validates and every named discipline maps to a real guide folder. | The entire run (1.2-stage-submission, 1.3-plan-subset, 1.4-site-research all read it) | `steps/1.1-inputs/step.yaml:2`; `contract.test.ts:1-3,14-64` |
| **`3.12-deliver`** | Delivery decision (`frozen: true`). Read `3.11-final/readout.md`; write `decision.json` + `decision.md`: `approved` (requires a `publish` object: project, versioning iterate/new, label) or `revise` (requires notes ≥10 chars). Records `decided_by`. Auto-decidable only if kickoff granted authority via `directives.decide[]`. | `approved` → 4.1-publish; `revise` → loops back to 3.11-final | `steps/3.12-deliver/step.yaml:1-4`; `contract.test.ts:1-4,13-44` |

**6.1B Kickoff inputs (`Request` zod, `steps/1.1-inputs/contract.test.ts:14-52`)**
`request` (verbatim, ≥20 chars) · `jurisdiction` (bureau slug, e.g. `austin` not `austin-tx`) · `submission.submission_version_id` (UUID — the one identifier nothing downstream can derive) · `site` (≥1 of `address` / `parcel_ids[]` / `lat`+`lon`) · optional `customer` (organization + project) · optional `publish` (versioning iterate|new, label) · optional `directives` (`disciplines[]` scope, `depth[]`, `speed`, `questions[]`, `spend_tier` free|paid, `decide[]`, `notes`).

**6.1C Escalation (contract-flag, not `runner: none`)**

| ID | Question | Grain | Options/default | Drives | Source |
|----|----------|-------|-----------------|--------|--------|
| **site-identity** | Does the staged plan set match the site the operator asked about? If not, what must a human say to continue? | per-run (conditional) | agent decides `site_match`; on `no` writes `NEEDS-OPERATOR.md` (blocking contract flag in the `format`-run `1.3-plan-subset`) | Halts before site-research proceeds against the wrong parcel | `steps/1.3-plan-subset/step.yaml:11`; `prompt.md:38-44`; `contract.test.ts:52-54` |

Notes: no `AskUserQuestion` anywhere. `4.1-publish` is automated (`publish_review_cli.py`), consuming the operator's `decision.json` — not itself a gate. The `readout.md` the operator reads must be free of run/process vocabulary (`steps/3.11-final/contract.test.ts:27,60-65`).

### 6.2 `sir-new` (2.0 — current)

**Source:** `runbooks/sir-new/runbook.yaml` + `steps/*` (~30 steps). Runners: `judgment`/`research`/`discipline`/`format`/`mechanical`/`vision` (`runbook.yaml`).
**Shape:** ~30-step graph with exactly **two `runner: none` gates** bracketing an otherwise automated pipeline; the paid-records HITL lives inside the `site-research` sub-runbook (§6.4).

**6.2A Human-gate steps (`runner: none`) ⛔**

| Step | What the human must do/decide | What it unblocks | Source |
|------|-------------------------------|------------------|--------|
| **`1.1-inputs`** | Author `request.json` (+ any `attachments/`) — verbatim request, site locator, customer org+project, publish plan, directives. This IS kickoff; run waits until it validates. | Every downstream step; `1.2-site-research` binds it as `request` | `steps/1.1-inputs/step.yaml:2`; `contract.test.ts:11-43,53-57` |
| **`3.10-deliver`** | End delivery/publish gate: read the PDF; **approve** (supply `publish`: org, project, versioning iterate\|new, label) or **revise** with notes. Lands as `decision.md` + `decision.json`; records `decided_by`. Auto-decidable via `directives.decide[]`. | approve → `4.1-upload`; revise → loops to `3.9-final/repair` | `steps/3.10-deliver/step.yaml:1-9`; `contract.test.ts:10-45` |

**6.2B Kickoff inputs (`Request`, `steps/1.1-inputs/contract.test.ts:11-43`)**
`request` (verbatim ≥20 chars) · `site` (≥1 of `address`/`parcel_ids[]`/`lat`+`lon`) · optional `intended_use` (absent = breadth-first survey posture) · `customer.organization` (+ optional `project`) · optional `publish` (versioning, label) · optional `directives` (`candidate_uses[]`, `depth[]`, `coverage[]`, `questions[]`, `spend_tier` free|paid → controls the records-pull paid gate inside site-research, `decide[]`, `notes`) · optional `attachments[]` (must match files in `attachments/`).

**6.2C Notes.** No in-step operator prompts — prompts are harness-agnostic and forbid tool names / "present to the operator" (`steps/README.md:145`). The readout the operator reads at the gate is authored by `steps/3.9-final/steps/readout/`. "Operator flags" / `hitl-flag:` threaded through synthesis/compose/adversarial are **report-content items for the reader**, not runtime pauses. `1.2-site-research` is invoked as `runner: runbook` / `runbook: site-research` (§6.4).

### 6.3 `guide-training` (2.0 — current)

**Source:** `runbooks/guide-training/runbook.yaml` + `steps/*`.
**Shape:** mostly-scripted training pipeline (atomize regulations + comments → author one guide per sub-discipline with the `author`/opus-5 agent → assemble the guide set). Only one true human gate: the kickoff request.

**6.3A Human-gate steps (`runner: none`) ⛔**

| Step | What the human must do/decide | What it unblocks | Source |
|------|-------------------------------|------------------|--------|
| **`0-start / 0.1-request`** | Hand-write `request.json` — verbatim words, jurisdiction slug + state, optional `directives.decide[]`/`notes`, optional `guides[]` subset to re-author. Run waits until it validates and the jurisdiction has a `codes/` folder under `$BUREAU`. | The entire run (`0.2-readiness` and everything after read it) | `steps/0-start/steps/0.1-request/step.yaml:2`; `contract.test.ts:14-43` |

**6.3B Kickoff inputs (`contract.test.ts:14-28`)**
`schema_version:1` · `request` (verbatim ≥20 chars) · `jurisdiction` (bureau slug, e.g. `fort-lauderdale`) · `state` (2-letter, binds the comment census's Library) · optional `directives{decide[], notes}` · optional `guides[]` as `<discipline>/<slug>` to re-author a subset (absent = whole taxonomy). Env: `$BUREAU` must hold the jurisdiction's captured codes.

**6.3C Escalation / publish**

| Mechanism | Behavior | Source |
|-----------|----------|--------|
| readiness park (automated, not a `runner: none` gate) | if a corpus lacks a capture date / regulatory text isn't confirmed-current / adoption map won't parse / Prospector or Library gaps → script **parks the run before any spend**; operator fixes captures (no question posed) | `steps/0-start/0.2-readiness/step.yaml:1`; `readiness.py` |
| publish gate | **None inside the runbook.** `4-guide-set` (`runner: script`) assembles `review-guides/` + emits `copy-list.txt`; landing the tree in bureau (PR + merge) happens outside this runbook | `steps/4-guide-set/step.yaml:2,26` |

No `AskUserQuestion`; `3.2-author/prompt.md:18` *consumes* directives, it does not ask.

### 6.4 `site-research` (2.0 — sub-runbook, "never driven alone")

**Source:** `runbooks/site-research/runbook.yaml` + `steps/*` + `AGENTS.md`.
**Shape:** a sub-runbook — not itself a deliverable; it establishes site + rules for a calling report/review run (`AGENTS.md:1,3`). Two `runner: none` gates: a settled-facts soundness gate and a "hands" gate for checkout/CAPTCHA.

**6.4A Human-gate steps (`runner: none`) ⛔**

| Step | What the human must do/decide | What it unblocks | Source |
|------|-------------------------------|------------------|--------|
| **`8.1-facts-gate`** | Parks until settled facts are sound. **[BLOCKING]** if `8-repair/NEEDS-OPERATOR.md` exists, a human settles what it names (parcel identity / blocking unknowns) then re-runs `8-repair`. If `settled-facts-status.json.unsound[]` non-empty, driver runs `conductor void <step>` + re-advances. Clean passes with nobody. | The whole research fan-out (topics, cross-check, reconcile, coverage, adversarial, readout, acquire) — placed before the widest spend on purpose | `steps/8.1-facts-gate/step.yaml:2`; `contract.test.ts:22-23,30-33` |
| **`9.7-hands`** | The "hands" gate: for each item `9.8-acquire` wrote to `needs-hands.json` (`action: checkout \| captcha`, with `price`), a human finishes it in the headed browser left open at the page and writes `hands-done.json` (`outcome: done \| declined`). **Empty list is the common case and passes without stopping.** | Completion/closure of `9.8-acquire` (last point a document enters the run) | `steps/9.7-hands/step.yaml:2-3`; `contract.test.ts:35-42` |

**6.4B Kickoff inputs.** The calling step's `request` folder = `request.json` + `attachments/` (`runbook.yaml:4-6`). The run **derives** its type (`bin/research_type.py:5-46`): `submission_version_id` present ⇒ `review`; else `intended_use` present ⇒ `sir`; else `sir`. Operator-settable pieces flow through `request.directives` (e.g. `disciplines`, `speed`, free-tier-only records posture) copied into `scope.md` by `8-repair`. As a sub-runbook the operator normally supplies these to the **caller**, not to site-research directly.

**6.4C Escalation surface**

| ID | Behavior | Grain | Source |
|----|----------|-------|--------|
| `NEEDS-OPERATOR.md` | `8-repair` writes it when `needs_operator` true (blocking unknowns / unresolved parcel identity); its presence fails the whole-runbook contract, opening a gate in the **consumer's** operator flow | run | `steps/8-repair/prompt.md:40,49,68-70`; `AGENTS.md:8` |
| `## Need you` items | steps escalate human-only actions (a payment at the stated price, a login not held, a wall a solve can't clear) as `## Need you` lines — never a silent substitution (e.g. paid clerk image tier under a free-tier-only directive) | per doc/topic | `steps/5-records/steps/facts/prompt.md:31`; `steps/9.8-acquire/prompt.md:13` |
| `hitl2-readout.md` | `9.6-readout` (a `judgment` agent, not a gate) writes the checkpoint brief + "Need you?" the operator reads **before phase-3 composes**; the actual pause lives in the **calling** runbook | run | `runbook.yaml:63-65` |
| publish gate | **None** — publishes 9 output symlinks for a consumer | — | `runbook.yaml:1,8-68` |

### 6.5 `jurisdiction` (2.0 — current)

**Source:** `runbooks/jurisdiction/runbook.yaml` + `steps/*` + `lib/`.
**Shape:** nine workstream "families" (`work → review-1 → revise-1 → review-2 → revise-2 → review-3 → disposition`), a cross-model `reviewer` (codex/gpt-5.6), then ship-via-PR + record-to-DB; `target` (sir|review) gates graph depth. Only **one literal `runner: none`** step (a placeholder); the real human stops are contract-failure gates.

**6.5A Human-gate steps (`runner: none`) ⛔**

| Step | What the human must do/decide | What it unblocks | Source |
|------|-------------------------------|------------------|--------|
| **`7-guide-training`** | **OWED placeholder.** On a `review` target the contract **[BLOCKING]** waits for `guide-set/` that nothing yet produces (guide-training isn't yet callable as a `runner: runbook` sub-runbook — no `outputs:`/signature). On a review run it waits indefinitely until wired; on `sir` it stands aside (vacuous). | `5-record-review` | `steps/7-guide-training/step.yaml:1-5`; `contract.test.ts:4-8,18-25` |

**6.5B De-facto human gates (contract-failure / exit-75, not `runner: none`) ⛔**

| Mechanism | What the human must do | Source |
|-----------|------------------------|--------|
| **`disposition` PARKED** (all 9 families: `1-regulatory`, `1-programs`, `1-approvals`, `1-research`, `1-sources-recon`, `2-sources`, `3-feasibility-guides`, `6-comments`, `6-comments-recon`) | `disposition` (a script) emits `CLEAN` / `ACCEPTED_WITH_RESIDUALS` / `PARKED`; a `PARKED` verdict **fails its contract on purpose**, stopping the run for a human to answer the review in `PARKED.md`; nothing downstream ships over it | `steps/1-regulatory/steps/disposition/step.yaml:1,9`; `lib/family.ts:255,264-269` |
| **Lock (`0-resolve` → `LOCKED.md`)** | if another run holds the jurisdiction's lock, resolve emits `LOCKED.md` and parks (exit 75) until the lease frees | `steps/0-resolve/step.yaml:2,10`; `bin/resolve.py:368` |
| **Surveyor PR merge** | `4-ship-surveyor/open` opens the surveyor PR **without auto-merge**; a human (or the `drive` step) merges it. bureau/dsd auto-merge; `record` steps record only after PRs are on `main` | `steps/4-ship-surveyor/steps/open/step.yaml:6`; `bin/ship.py:8,14-15,33` |

**6.5C Kickoff inputs (`lib/schemas.ts:24-37`)**
`schema_version:1` · `jurisdiction` (`{slug}` or `{id}`) · `target` (`sir` \| `review` — decides graph depth) · `requested_by` · `request` (words) · optional `directives{research: bool, refresh: detect|deep|trust}`. `graph.json` generated at kickoff.

No `AskUserQuestion`. Shipping is via PR (bureau/dsd auto-merge; surveyor needs a human/driver merge); `5-record-*` write DB rows + release the lock only after merge; `NOTHING-TO-SHIP.md` / `NOTHING-TO-RECORD.md` when nothing is stale.

### 6.6 `smoke` + `smoke-package` (2.0 — test fixtures)

**Source:** `runbooks/smoke/runbook.yaml` + `steps/*`; `runbooks/smoke-package/runbook.yaml` + `steps/*`.
**Purpose:** the machinery's own test fixture — exercises every mechanism the format defines in minutes for pennies; run before anything expensive. Notably, `smoke` deliberately includes `runner: none` gates to exercise the human-gate mechanism itself.

**6.6A `smoke` — Human-gate steps (`runner: none`) ⛔**

| Step | What the human does | What it unblocks | Source |
|------|---------------------|------------------|--------|
| **`1.1-inputs`** | Author `request.json` (topic + ≥2 slug-id items with text ≥40 chars, optional `directives`). Run waits until it validates against the `Request` schema. | The entire graph — item ids become the roster / brief folders | `steps/1.1-inputs/step.yaml:2`; `contract.test.ts:9-26` |
| **`2.3-hitl`** | Read the readout `2.2-digest/digest.md`; write `decision.json` (`status: approved`\|`revise`; `decided_by`; `notes` required on revise) + `decision.md`. Only `approved` releases the gate. **Conditionally human** — if kickoff lists `2.3-hitl` in `directives.decide`, the driver may auto-adjudicate per `adjudication.md:6-12` (`step.yaml:1` labels it "eng, optional") | `3.1-classify` and `3.2-render/a-html` | `steps/2.3-hitl/step.yaml:2`; `adjudication.md:1-18`; `contract.test.ts:22-27` |

Kickoff inputs (all in `1.1-inputs/request.json`, `contract.test.ts:9-20`): `topic` (≥3 chars) · `items[]` (≥2, each `{id: slug, text: ≥40 chars}`) · optional `directives.snapshot` (bool → real headed screenshot at `2.4-snapshot`) · optional `directives.decide` (string[] of waiting-step ids the driver may auto-decide). The gate is purely file-drop; no `AskUserQuestion`.

**6.6B `smoke-package` — Human-gate steps (`runner: none`):** **None.** This runbook has **zero human gates** by deliberate convention — `runbook.yaml:4` states "exit 75 never happens here (no waiting steps, which is the convention for a reusable sub-runbook)"; every step is `runner: script` (`steps/1-tally/step.yaml:2`, `steps/2-echo/step.yaml:2`). Its sole input is the caller's `request` folder, symlinked in (`runbook.yaml:6-8`). The operator surface is entirely inherited from `smoke`'s kickoff.

---

## 7. Cross-runbook observations

1. **Two mechanisms, one intent.** Both generations converge on the same shape — front gate (confirm the target/premises before spend) + terminal gate (approve/publish the deliverable) — but realize it differently: 1.0 via prose readouts consolidated to dodge the headless-channel constraint (§2); 2.0 via `runner: none` graph steps that conductor parks on (§3). The 2.0 skeleton is strikingly uniform: `1.1-inputs`/`0.1-request` + `…-deliver`.
2. **`AskUserQuestion` is used by zero runbooks.** 1.0 uses prose readout-in-chat; 2.0 uses file-drop into a parked step. Any operator tooling should target those two surfaces, not a structured-question API.
3. **Publishing is always the last, most-guarded gate** and always requires an explicit affirmative — a service-role/RLS-bypassing DB write (`preprocessing`, `process-city-response-docs`) or an `approved`+publish-plan decision (`review-new`, `sir-new`). It is never defaulted.
4. **Headless authority is explicit in 2.0, implicit in 1.0.** 2.0's `directives.decide[]` lets the operator name exactly which gates the conductor may auto-adjudicate (recording `decided_by`). 1.0 has no equivalent switch — its "headless" behavior is the fixed `SK-` suppressions baked into the prose.
5. **Escalation-by-sentinel-file is the 2.0 analog of a 1.0 conditional stop.** `NEEDS-OPERATOR.md` / `PARKED.md` / `LOCKED.md` / `needs-hands.json` fail a contract on purpose to summon a human. `jurisdiction` leans on this almost entirely (only one literal `runner: none`).
6. **Sub-runbooks push their gates up to the caller.** `site-research` authors readouts and writes `NEEDS-OPERATOR.md`, but the actual operator *pause* fires in the calling `sir-new`/`review-new`; `smoke-package` has no gates at all. A catalog reader must follow the invocation edge to see where a human actually stops.
7. **The v2→v3 preprocessing trend is fewer gates.** `preprocessing` (v2) had two end gates and a `refine`/`re-tier` fork; `preprocessing-v3` collapses to one `publish/re-read/stop` gate (box-refine removed) while adding a mandatory `version_number` input. Simplification of the HITL surface tracks simplification of the pipeline.

---

## 8. Open questions

- **Q1** — Should 🔕 suppressed HITL (1.0 `SK-`) and 2.0 `directives.decide[]` auto-adjudication both stay in scope, or only live ⛔ gates? (v2 keeps them, because a defaulted decision is still a decision the operator may want visibility into — but it widens the catalog.)
- **Q2** — Should this catalog live in `winston` (design/reference, as here) or move into `bureau/runbooks/README.md` as operator-facing docs once stable? (Leaning: iterate in winston, then port a stabilized summary into bureau.)
- **Q3** — Is there a shared HITL vocabulary (gate IDs, the pre-flight/readout/suppressed taxonomy for 1.0; the `runner: none` + `directives.decide[]` + sentinel-file taxonomy for 2.0) worth lifting into the runbook-authoring guidelines so new runbooks are consistent by construction?
- **Q4** — Should the 1.0 runbooks slated for supersession (`sir`, `review`) still be maintained in this catalog, or marked frozen once their `-new` variants fully replace them? (v2 keeps them mapped for completeness and for operators still running them.)
- **Q5** — `jurisdiction`'s substantive human stops are almost all contract-failure gates (PARKED ×9, lock, surveyor merge) rather than `runner: none`. Is that an intentional 2.0 pattern (contract-as-gate) worth blessing, or drift that should be normalized to explicit `runner: none` steps where a human is truly required? The `7-guide-training` OWED placeholder is a concrete symptom — it's a `runner: none` step that no producer yet satisfies.
- **Q6** — The conductor **workflows** outside `runbooks/` (`bureau/workflows/completeness-check/`, `bureau/workflows/comment-resolution-check/`) are graph/`workflow.yaml`-based and arguably "2.0-class." Should this catalog extend to cover their HITL surface, or does "runbook" deliberately exclude them? (v2 scopes to `runbooks/` only and flags this.)
