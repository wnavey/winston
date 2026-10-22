# The intake-prospecting runbook

**ID:** ARCH-5  
**Status:** Draft v1.2.2
**Date:** 2026-10-16
> **Revision note v1.2.2 (2026-10-16, db-schema v2.1):** IDs use the jurisdiction code (db-schema D20).
> - 3.1-write's `conventions.yaml` stub gains `code:`. For a new jurisdiction the runbook proposes `{ABBR}_{ST}` and checks that it is unique against every `conventions.yaml` on `origin/main`; for an existing one it reads the code.
> - Items are `{code}-0001`…, groups `{code}-G01`…, and figures `{code}-F0001`… from `next_figure`.
> - `checklist` in `intake.yaml` is the code.
>
> **Revision note v1.2.1 (2026-10-16, db-schema v2):** D13's output follows db-schema Draft v2's contract. 3.1-write also emits `v1/version.yaml` (`version: 1.0.0`, `format: 1`, `generated_by` with the `runbook_runs` uuid; db-schema D14, D16) and `v1/intake-groups.tsv` (group ids `{code}-G01…`, db-schema D15), and `intake.yaml` gains `next_group`. `decided_by` is the `runbook_runs` uuid, not the run directory's name. No functional change to the runbook's steps.
>
> **Revision note v1.2 (2026-10-14, prospector integration audit):** The runbook is checked against what `bureau/runbooks/prospector/` actually is, so that nothing the Austin loop tunes is thrown away when it becomes a workstream (north-star I3). Functional design unchanged. Technical corrections:
> - **The deliverable and the ledger are written in a bureau worktree from the first session, not in the run dir** (new `1.0-worktree`, D1, D5, D13). `lib/step-loop.ts`, `lib/audit.md` and `lib/disposition.py`, which D5 and D12 reuse, all require one: the step loop's blocking rule checks the worktree is committed and that each report names its HEAD; the audit records `reviewed_head`; disposition commits residual rows into the ledger inside the worktree. v1.1 had the ledger in the run dir and copied it at 3.1, which none of those tools would have accepted.
> - **D2's `scope_gate` is now `gates`, and it governs 4.1-review as well as 1.5-scope.** v1.1 had no `auto` for 4.1, so a loop run (and every prospector-wrapped run) would have parked there.
> - **D14's publish is the branch itself**: 4.2 pushes the worktree branch and opens the PR (prospector `bin/ship.py`'s shape), instead of copying files into a fresh worktree (cc-source-citations' shape). Inside prospector, 4.2 stands aside and the wrapper's mergein plus `8.1-ship-bureau` carry the commits.
> - **§6 "the prospector wrapper" is specified** from the precedent that already exists: `prospector/review-guides/` nests `runbooks/guide-training/` unchanged behind a `2-request` step. The registration list (outer step, `WORKSTREAMS`, `WORK_TYPE`, `DELIVERABLES`, `env.json`, the ship inputs, the `metro_ahj_coverage` migration in **dsd**) is written out.
> - Facts corrected: 46 jurisdictions (not 47) hold `codes/*submittal*|*checklist*|*application*` folders; only the four CC-family runbooks' `AGENTS.md` open with a "Rule 19 posture." paragraph, prospector has none.
> - New D18 (Will: human gates only in the standalone lane; inside prospector the audit is the review and the checklist ships on the autonomous path; closes Q6) and Q7 (which prospector target runs intake, Will's).
>
> **Revision note v1.1 (2026-10-14, Will):** **Austin is the only scored scenario.** Nobody has confirmed the earlier New Braunfels and Cedar Park runs were good, so they are no longer test cases with expected answers. Non-Austin jurisdictions become unscored **smoke runs** that check only the mechanics (scraping, capture and extraction on non-Austin sites, citation validity, the file format), and they carry little weight (D16). D7's New Braunfels note is now only an illustration. Acceptance and P2/P5 changed to match, and the old Q2 is narrowed.

**Parent:** `workspaces/intake/north-star/NORTH-STAR-SPEC.md`, initiative I2. Carries out north-star D2, D5, D10–D14.
**Output contract:** `workspaces/intake/db-schema/DESIGN-SPEC.md` D1–D5 (the file format), checked by its `lint:intake` once db-schema P2a lands.
**Repos touched:**
- `bureau`: a new `runbooks/intake-prospecting/`; a new `runbooks/intake-score/`; the shared source-capture code moved from `runbooks/cc-source-citations/scripts/lib/` to `runbooks/lib/sources/`
- `completion-officer`: archived once the bar is met (D17)

**Repos NOT touched:**
- `cityhall` (the runbook never writes the DB, north-star D10)
- `conductor2` (no engine change)
- `surveyor`
- the CC runbook

## Problem

completion-officer is how Austin's intake checklist was first generated. It cannot do the job again, for any jurisdiction. Verified 2026-10-14:

- **It is prompts, not a runbook.** `~/noetic/completion-officer/.claude/agents/` holds 14 agent definitions run from an interactive Claude Code session (`claude --agent research-director "Austin --run <label>"`). It has five human gates, a beads tracker, and no run record beyond `run-manifest.md`, which holds the date, git hash and command but no cost or time. It is not a conductor2 runbook, so it cannot be checkpointed or audited, and it cannot become a prospector workstream.
- **Every scope correction came from Will, after Phase 5.**
  - In the Austin v2 run, all four intake-specific documents were found in Phase 0 (`research/austin/v2/sources-of-truth.md`): the CC Submittal Checklist and Notes/Templates as primary sources, the CC Application promoted by Will at Gate 0, and the AW Completeness Checklist as "additional" only.
  - Nothing then confined the scope to them. The Requirements webpage and the Environmental PDF were treated as primary, which gave 594 items.
  - Will's corrections afterwards:
    - "the Environmental PDF covers CC and TR": 120 removed;
    - standard notes collapsed to one item per block;
    - the v2 → v2-trimmed rule "keep only items traceable to the four intake documents": 458 → 190 (`research/austin/v2-trimmed/final/removal-audit.md`, `v2/final/cc-source-traceability-audit.md`: 312 of 458 untraceable).
- **The prompts hard-code Austin** despite being written to work for any jurisdiction:
  - the checklist-writer's split table, sections A–E with Austin's sections and item counts;
  - `departments/aw/formal-review/` as the format exemplar;
  - an Austin URL in results-auditor;
  - `research/austin` in analysis-director;
  - `tools/sync-to-bureau.sh` writes only to `jurisdictions/austin/`.
- **Its own spec drifted from what it produced:**
  - v2's writers dropped the Location columns;
  - `Fail Status` was never in any agent spec and was added by hand in v2.3;
  - the validator says "8 checks" but defines 9;
  - Phase 5 added 13 items that synthesis never had.
- **Run comparison was crude.** `research/austin/comparisons/v0-vs-v1/match.py` matched items with difflib `SequenceMatcher` thresholds. It reported 0 exact and 39 high matches between v0 (671 items) and v1 (408).
- **Citations were added afterwards.** cc-source-citations (`bureau/runbooks/cc-source-citations/`, run 32678ad2 → bureau#2045) located 300 of 315 (item, label) pairs in snapshots of Austin's sources after v2.7 already existed.
- **The second jurisdiction stalled at Gate 0.** New Braunfels (`research/new-braunfels/v1/`, 2026-05-06) found no named completeness check: the site plan sits inside the Commercial Building Permit, which has a published 8-page checklist. Three of its five "primary" sources were design manuals, the same over-scoping Austin had.

What exists to build on (bureau `origin/main`, 2026-10-14):

- **The cc-source-citations capture code.** These are reusable as a library: `capture.py` (`capture_pdf` L96, `capture_webpage` L112 → `capture_web.mjs`, `capture_municode` L221), `pdfwords.py` (word ids `p<page>w<index>`), `boxes.py` (`quote_in_words` L46, `boxes_for` L70, `find_quote` L89), `quote.ts`, `step_capture.unique_id` (L137) and `current_snapshot_for` (L128), and `upload_snapshot` (L156). All of them sit under `runbooks/cc-source-citations/scripts/lib/`, with imports relative to that package.
- **The prospector workstream pattern** (`runbooks/prospector/`, verified 2026-10-14). A workstream is a sub-runbook at `runbooks/prospector/<ws>/`, called from an outer step with `runner: runbook` and `bind: {request: 0-resolve}`. The bound folder holds `currency.json` (which workstreams are stale, the run branch `prospector/<slug>-<run>`) and a blobless **sparse** bureau clone on that branch (`jurisdictions/{slug}`, the state folder, `jurisdictions/federal`, `spec`, `tooling`, `taxonomy`, `runbooks/lib` and one review step; `bin/resolve.py` `SPARSE`). Its steps:
  - `1-worktree`: `lib/worktree.py add` branches `<run branch>--<ws>` and writes `worktree.json`, whose `ledger` is `jurisdictions/<slug>/prospector/<ws>/ledger.md` (0-resolve drops every prior run's `ledger.md` at the start, `notes.md` stays).
  - work: a step loop (`lib/step-loop.ts`: a cold session per round, a `sessions/NN.report.json` with `done|continue|blocked`, a cap of 8, two stalled sessions fail it). Each session ends with `worktree.py commit --path …`, and its report names the commit as `head`. **The blocking rule is that the worktree is committed and the report's head is in its history.** A step that shares the worktree declares `worktree_paths` in its `step.yaml`, so a sibling's uncommitted file is not its failure. The workstream's gate (`<ws>/lib/<ws>.ts gate`) runs when the report says done, and so does the American-spelling check.
  - audit: the `reviewer` preset in a fresh session, `lib/audit.md`: reads the worktree deliverable, `gate.json` and the ledger through `ledger.ts auditor-view`, never the sessions; writes `findings.json` with `reviewed_head` = the worktree HEAD, `charged[]` (each with `kind`, `evidence`, `repro_cmd`), `rejudged[]`, `leads[]`.
  - disposition: `lib/disposition.py` (`MAX_ROUNDS=3`, `--work-step`, `--audit-step`, `--worktree-step`, `--target-by-charge-kind KIND=STEP`, `--fan-out`, `--no-audit`). It reads `<worktree-step>/worktree.json`, writes `void-request.json` for a send-back, and **writes residual `## Charges` rows into the ledger inside the worktree and commits them alone**. With `--fan-out`, a charge names the items to relaunch as `<item>.md` before the first colon of its claim, else the whole fan-out relaunches.
  - mergein: `worktree.py mergein` rebases onto the run branch, runs `tooling/verify/content-gates.sh` (the CI gates: index coverage for `programs|approvals|fees`, provenance and fidelity for `codes/`, citations for feasibility guides, American spelling for every changed jurisdiction, `verify_briefing` for `briefing/`), merges with the workstream's record as the message, pushes.
  - **No workstream opens its own PR.** `8.1-ship-bureau/open` (`bin/ship.py`) merges origin/main into the run branch, commits a `conventions.yaml` stub for a new jurisdiction folder (`name:` from the README title), pushes and opens one PR; `8.1-ship-bureau/drive` (sonnet) answers the bot review **and merges the PR itself**; `9-record` stamps `workstream_status` (`work_type` from `bin/resolve.py` `WORK_TYPE`) once the shipped head is on origin/main. There are no human gates anywhere in a prospector run; the audit is the review.
  - The ledger keeps `Surfaces` and `Attempts` tables (`lib/ledger.ts`): `result` is found, partial, negative-technical or negative-policy, and **a negative needs a strong model tier**.
  - Regulatory (`prospector/regulatory/`, nine steps) is the precedent for a multi-step workstream with a fan-out: `4-read` items run in their own worktrees (`worktree.py unit`, sparse over the item's paths) and `5-sum` merges them back after a disjointness check.
- **A standalone runbook already runs nested inside prospector.** `prospector/review-guides/` wraps `runbooks/guide-training/` **without changing it**: `2-request` writes guide-training's `request.json` from `currency.json` (or `stand-aside.json` when the workstream is current, out of scope, or cannot run), `3-train` is `runner: runbook` with `bind: {request: 2-request}`, `4-copy` copies the nested outputs into the worktree and commits them with a `gate.json`, `5-disposition` rules from that gate, `6-mergein` merges. `audit: none`, because the nested runbook has its own checks. conductor2 runs a nested runbook with the step's output folder as its run dir, and a nested step that exits 75 parks the outer run (`conductor2/README.md`, "Nested runbooks"). This is the shape I3 takes (§6).
- **Readiness lives in the Library DB and the dsd dashboard, not bureau.** `metro_ahj_coverage` (`dsd/library/tooling/supabase/migrations/20260710204429_metro_views.sql`) counts completed rows over fixed `work_type` lists: `sir_ready` = 5 of `regulatory, sources, programs, approvals, feasibility_guides`; `review_ready` = 7, adding `comments, training`. `dsd/web/lib/prospector/types.ts` mirrors the lists. `research` gates neither. (`resolve.py` stamps review-guides as `review_guides`, while the view counts `training`; that mismatch predates this spec and is noted for whoever adds `intake`.)
- **Prospector's outputs, as seeds for discovery:**
  - `briefing/process.md` exists for 22 jurisdictions; 6 have an intake heading (austin L46, fort-lauderdale L13, keller L34, leander L70, montgomery-township L55, san-diego L23).
  - 96 `codes/*submittal*|*checklist*|*application*` folders across 46 jurisdictions, each with a `meta/provenance.json` `source.url`.
  - `regulatory/code-inventory.md` (19 jurisdictions) routes "applications, checklists and forms" to `Owner = permit-recon` in its `## Not Regulatory` table. Celina's lists 82 such rows, for example `Site Plan Checklist | …/DocumentCenter/View/5586`.
- **Two scoring harnesses:** cc-compare, a reference set plus blind Opus adjudication and a scorecard whose answer key grows over runs; and `runbooks/lib/eval/`, per-step `_eval` specs.
- **Rule 19:** `runbooks/lib/AGENTS-core.md` rules 19–20 bar prior Noetic output and anything named like an answer key. The four CC-family runbooks' `AGENTS.md` (completeness-check, cc-compare, cc-source-citations, cc-block-attribution) open with a "Rule 19 posture." paragraph; prospector and its workstreams have no `AGENTS.md`.

---

## 1. The runbook at a glance

```diff
 bureau/runbooks/
+├── intake-prospecting/
+│   ├── runbook.yaml            # local lane, sandbox: false, presets: research (opus-5.5 high), extract (opus-5.5 medium), reviewer
+│   ├── AGENTS.md               # rule-19 posture (D3), completeness-not-compliance, item format
+│   ├── scripts/ip.py           # one subcommand per script step
+│   ├── lib/intake.ts           # the workstream gate over the worktree (D13), prospector style
+│   └── steps/
+│       ├── 0-request/          # gate: Request (D2)
+│       ├── 1.0-worktree/       # script: the bureau worktree the run writes into; made, or taken from the request (D1)
+│       ├── 1.1-inputs/         # script: resolve jurisdiction, collect prospector seeds (D4)
+│       ├── 1.2-discover/       # agent, step loop: find + type sources, process shape, ledger in the worktree (D5)
+│       ├── 1.3-capture/        # script: snapshot every candidate source (D6)
+│       ├── 1.4-classify/       # agent: basis + application type + scope sources (D7)
+│       ├── 1.5-scope/          # gate: approve sources + basis (human, or auto) (D8)
+│       ├── 2.1-groups/         # agent: the group roster (D9); empty unless basis = formal
+│       ├── 2.2-extract/<group> # fan-out, agent: items with citations picked by word id (D10)
+│       ├── 2.3-verify/         # script: quotes → boxes, dedupe, coverage (D11)
+│       ├── 2.4-audit/          # agent, fresh session: scope + coverage charges (D12)
+│       ├── 2.5-disposition/    # script: send-back to 2.2 per group, ≤3 rounds (D12)
+│       ├── 3.1-write/          # script + agent: guides, sidecars, intake.yaml, committed in the worktree (D13)
+│       ├── 3.2-contact-sheet/  # script: HTML readout
+│       ├── 4.1-review/         # gate: approved | revise (human, or auto) (D14)
+│       └── 4.2-publish/        # script: upload snapshots, push the branch, open one bureau PR; stands aside when wrapped (D14)
+├── intake-score/               # separate runbook: scores a finished run against a reference (D15)
 ├── cc-source-citations/scripts/lib/   # capture/pdfwords/boxes/quote.ts move out ↓
+└── lib/sources/                # shared source capture + word ids + quote verification (P0)
```

**Two paths through the runbook:**
- **`basis: formal`:** 1.x → 2.x → 3.x → 4.x. Writes a jurisdiction checklist `v1`.
- **`none_found` / `inconclusive`:** the 2.1 roster is empty, so 2.2–2.5 pass with nothing to do. 3.1 writes only `intake.yaml` (`checklist: GENERIC`) plus the discovery ledger as evidence.

**Two ways to run it, one code path:**
- **Standalone** (the loop, smoke runs, a human-gated publish): `0-request` holds a `Request`, `1.0-worktree` makes a bureau worktree, `4.2-publish` opens the PR.
- **Wrapped by prospector** (I3, §6): the wrapper's `2-request` writes the same `Request` with `worktree` pointing at the workstream worktree it made, `gates: auto` and `publish: false`; `1.0-worktree` records that worktree instead of making one; `4.2-publish` stands aside; the wrapper merges the branch into the run branch and prospector ships it. Nothing between 1.1 and 4.1 knows which way it was run.

---

## 2. Decisions

### 2.1 Shape and inputs

**D1. A conductor2 runbook at `bureau/runbooks/intake-prospecting/`, local lane only.**
- `runbook.yaml` sets `sandbox: false`, as prospector does, because browsing and DNS fail silently under the sandbox.
- The description ends "exit 75 = waiting at 1.5-scope or 4.1-review".
- Local lane only for the same reasons as cc-source-citations: snapshot upload uses the service-role key, and publishing uses the operator's `gh`.
- Presets:
  - `research`: opus-5.5, effort high, for discovery, classification and groups;
  - `extract`: opus-5.5, effort medium, timeout 3600 s, matching cc-source-citations' `locate`;
  - `reviewer`: opus-5.5, effort high, fresh session, for the audit.
- Research steps declare `skills: [agent-browser, _shared-research]`, like the prospector research workstreams. WebSearch and WebFetch come with the harness.
- **Everything that reaches bureau is written in a git worktree of bureau, from the first session.** `1.0-worktree` makes it, or records the one the request names (D2):
  - Standalone: a blobless sparse clone of bureau at `1.0-worktree/worktree`, checked out from `origin/main` on the branch `intake-prospecting/<slug>-<run>`, with prospector's `SPARSE` paths (`bin/resolve.py`) so `jurisdictions/<slug>` and `tooling` are present. It writes `worktree.json` in prospector's shape (`workstream: intake`, `slug`, `worktree`, `ledger: jurisdictions/<slug>/prospector/intake/ledger.md`), which is what `lib/ledger.ts` `ledgerFor`, `lib/audit.md` and `lib/disposition.py` read.
  - Wrapped: `request.worktree` names the worktree prospector's `worktree.py add --workstream intake` made, on `<run branch>--intake`; the step writes the same `worktree.json` pointing at it.
  - The worktree holds the deliverable (D13), the ledger (D5) and nothing else of the run's: `sources.json`, `basis.json`, snapshots, `items.json`, `coverage.json`, `findings.json` and the contact sheet stay in the run dir. Each agent session that touches the worktree ends with `worktree.py commit --path …` and names the commit in its report, and each such step declares `worktree_paths` (`jurisdictions/{slug}/completeness-check`, `jurisdictions/{slug}/intake.yaml`, `jurisdictions/{slug}/prospector/intake`), so the step-loop rules apply unchanged.
- Environment, read from `$RUN/.env` as prospector does: `BUREAU` (the clone origin and the content gates; steps that need it declare `tools: [bureau]`), `GH`, `NOETIC_SKILLS_DIR`, `CONDUCTOR_SEAT_CMD`, and for 4.2 only the app-DB pair `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (the snapshot upload). None of prospector's `never` variables may be set.

**D2. The request.** A zod `Request` in `steps/0-request/contract.test.ts`, the only definition:

```ts
Request = {
  jurisdiction: { slug: /^[a-z0-9-]+$/, name: string, state: string },  // need not exist in bureau yet
  application_type_hint?: string,        // e.g. "commercial site plan"; discovery may override with evidence
  seeds?: { url: string, note?: string }[],   // operator-supplied starting points
  worktree?: string,                     // a bureau worktree the caller owns (the prospector wrapper, §6); absent → 1.0 makes one (D1)
  gates: "human" | "auto",               // default "human"; governs 1.5-scope AND 4.1-review (D8, D14); "auto" for loop runs and wrapped runs
  publish: boolean,                      // default false; true requires gates "human"
  replace?: boolean,                     // publish over an existing checklist (D14)
  requested_by: string,
}
```

A `jurisdiction.slug` with no `jurisdictions/<slug>/` directory is allowed; New Braunfels has none. 3.1-write then adds the `conventions.yaml` stub prospector's `bin/ship.py` would add (`name:`, `short_name:`, and now `code:`, db-schema D20), the legal minimum that registers the slug, so `sync-conventions.yml` creates the `jurisdictions` row on merge and db-schema's sync can later satisfy its FK. (`ship.py` writes the stub only when the folder has a `README.md`; a `none_found` jurisdiction may have nothing but `intake.yaml`, so this runbook writes its own.)

**D3. The rule-19 posture.** `AGENTS.md` opens with it, and every sub-agent prompt restates it as a capability limit:

- **Barred:**
  - `jurisdictions/*/completeness-check/**` for **every** jurisdiction, not just the target. A checklist must not copy another jurisdiction's checklist; that is north-star D4 at the source level.
  - `~/noetic/completion-officer/`
  - `runbooks/intake-score/`, any `examples/` or `_eval/` path, Inspector General reports
  - `review_comments` and other CC review output
- **Allowed:** the target jurisdiction's prospector outputs (`briefing/`, `codes/`, `approvals/`, `regulatory/`, `prospector/`) and the open web, including the city's own intake documents, which are the subject of the research.
- Every `$BUREAU` grep uses `--exclude-dir=examples --exclude-dir=completeness-check`.

Without this bar, the Austin loop (D15) would score a copy of its own answer.

**D4. Prospector outputs are used when present; there is no mode flag.** `1.1-inputs` collects seeds from the target jurisdiction, whatever exists:

- the intake section of `briefing/process.md`, with its inline links;
- `codes/*submittal*|*checklist*|*application*|*packet*/meta/provenance.json` → `source.url`, plus `contents/*.md`;
- `regulatory/code-inventory.md` `## Not Regulatory` rows with `Owner = permit-recon`;
- submittal sections under `approvals/*.md`;
- `request.seeds`.

These go into `seeds.json`, each tagged with its origin. The seeds are read from the worktree (D1), which in a wrapped run is a branch off the prospector run branch, so a briefing or a code folder that `1-research` or `2-regulatory` merged **in this same run** is already there; standalone, the worktree is `origin/main`, so the seeds are whatever prospector has shipped. A run on a jurisdiction prospector hasn't covered (New Braunfels) gets only `request.seeds` and starts from the web. This is north-star D14's seam: in I3 the wrapper orders the intake step after research, regulatory and permit-harvest (§6), and this step gets richer seeds without any code path changing.

### 2.2 Discovery and scope

**D5. Discovery types every source; only two types can define scope.** `1.2-discover` runs as a prospector step loop (`lib/step-loop.ts`: a cold session per round, a report with `done|continue|blocked`, a cap of 8). It ports completion-officer's Phase 0–1 heuristics into a single prompt:
- official government sources only;
- find the local name for the intake step;
- find which application type carries the site plan;
- fetch every candidate document yourself, and don't trust summaries.

It writes:
- **`sources.json`:** one row per candidate, with `key`, `title`, `url`, `publisher`, `doc_type`, `application_type`, `version_date`, `why` (a quote) and `seed_origin`. `doc_type` is one of:

  | doc_type | Meaning | Can an item exist because of it? |
  |---|---|---|
  | `intake_instrument` | an application form, submittal or completeness checklist, or a department completeness checklist (Austin's CC Application, CC Submittal Checklist, AW Completeness Checklist) | **yes** |
  | `template` | required notes, standard sheets or templates whose content must appear on the plans (Austin's Notes and Templates DOCX) | **yes** |
  | `regulatory` | code or ordinance sections | no; it can only support and cite |
  | `design_manual` | criteria and design manuals (Austin's Environmental PDF, New Braunfels' drainage manual) | no; same |
  | `informational` | process pages, FAQs, the requirements webpage | no; same, and it may supply process facts |

  This is north-star D2 enforced at the source. completion-officer's taxonomy (Required Submission / Reference-Template / Regulatory / Informational) let a design manual become "primary", which is how the 120 Environmental items happened. Here a source's type, not its importance, decides whether it can originate items.

- **`process.md`:** whether there is a named intake step, who screens, which application type, and the timelines, each with a link.
- **The ledger**, in the worktree at `jurisdictions/<slug>/prospector/intake/ledger.md` (the path `worktree.json` names, D1), plus `notes.md` beside it for the lessons left to the next run: prospector's `Surfaces` and `Attempts` tables (`lib/ledger.ts`), checked by `ledgerRules` in this step's contract. A negative attempt ("no completeness checklist published") needs the strong tier, so a `none_found` basis rests on recorded, strong-tier evidence, not on silence. Each session commits the ledger with `worktree.py commit --path jurisdictions/<slug>/prospector/intake` and reports `units_verified` (the source keys it settled) and `ledger_rows_added`, which is what the step loop's stall rule counts.

`sources.json` and `process.md` are run-dir outputs of this step; only the ledger reaches bureau.

**D6. Every candidate source is captured before classification.** `1.3-capture` snapshots each `intake_instrument` and `template` source, and each `regulatory`/`design_manual`/`informational` source that discovery quoted, using the shared capture library (P0): direct PDF, a web page printed one panel per page, or a Municode section. Output:
- `snapshots/<sid>/` (pages, `text/NNN.tokens.txt` with word ids);
- `manifest.json` in the cc-source-citations schema.

Snapshots exist before 1.4, so classification and every later step read the same fixed text, and the extraction workers can cite by word id (D10). Nothing is uploaded until 4.2.

**D7. Classification decides the basis, the application type and the scope sources.** `1.4-classify` reads `sources.json`, `process.md`, the ledger and the snapshots. It writes `basis.json`:

```json
{ "basis": "formal | none_found | inconclusive",
  "application_type": "Consolidated Site Plan",
  "scope_sources": ["<source key>", ...],
  "rationale": "…", "evidence": [{"source": "<key>", "quote": "…"}] }
```

- `scope_sources` may only name `intake_instrument` and `template` sources (enforced by the contract).
- **The boundary rule is north-star Q1's proposal, pending Will:** any published intake, submittal or application checklist for the application type that carries the site plan gives `formal`; nothing like that, with strong-tier negative attempts, gives `none_found`; anything else gives `inconclusive`.
- Illustration only, not an expected result: New Braunfels publishes a Commercial Building Permit Checklist, which this rule would type as an `intake_instrument`, giving `formal`. That reading rests on an unconfirmed Gate 0 log (D16). If Will rules the boundary differently, D7 changes and nothing else does.

**D8. The scope gate.** `1.5-scope` is `runner: none`, `frozen`, and shows `1.4-classify/readout.md`: the sources table, the basis, and the scope sources with their quotes. A `Decision` zod union, `approved | revise`, carries `decided_by`, `notes`, and on `revise` the edits: add or remove scope sources, retype a source, or change the basis. `revise` re-runs 1.4 with the notes.

Gate 0 was historically the most valuable human step (Austin: the CC Application promoted). But a scored loop must measure the runbook, not Will, so `gates: auto` passes the gate with `decided_by: "auto"`. The readout is still written. `publish: true` requires `gates: human` (D2). A wrapped run (§6) is always `auto`: prospector has no human gates, and a nested step that parks at 75 parks the whole prospector run.

### 2.3 Extraction

**D9. Groups come from the jurisdiction's own documents.** `2.1-groups` writes `roster.json` and `roster.txt`. Each group has a key (`cc-1`, `cc-2`, …), a title, its assigned scope-source sections (snapshot plus page range or section), and a one-line rationale. The ordering rule:
1. **The structure of the jurisdiction's own intake instrument.** If its submittal checklist has sections, those are the groups.
2. **Otherwise, the reviewing department or entity.** That was completion-officer's Gate 1 lesson: group by who reviews it.
3. Never Austin's group list.

Every page of every scope source is assigned to exactly one group (contract). An empty roster when the basis is not `formal`.

**D10. Items are extracted with their citations.** `2.2-extract/<group>` is a fan-out with one `extract` worker per group. It reads only its group's snapshot `tokens.txt` (and may read supporting sources to word the `Condition`). It writes `items.json`; each item has:

| field | rule (ported from completion-officer's checklist-writer, plus what v2.x added by hand) |
|---|---|
| `item` | written as the deficiency ("X missing or incomplete"), never "Verify X"; no location words |
| `condition` | `Always` or `If …` |
| `location`, `location_binding` | `plan set` / sheet name / document name / `all plan sheets`; `explicit` / `inferred` / `flexible` (`plan set` ⇒ `flexible`) |
| `source_type` | `document` / `citation` / `guideline` |
| `fail_status` | `fail` when the source says required or "will be rejected"; `warn` when it says recommended, "may be returned" or similar (Q3) |
| `title` | an affirmative statement, at most 15 words (v2.7 style: "Completed CC Application PDF is included in the submittal package") |
| `citations[]` | `{source_key, snapshot, page, first_word_id, last_word_id, quote}`, at most 4 regions; **at least one on a scope source** |

- **No item without a scope citation** (north-star D2), enforced by the worker contract. Regulatory or manual citations may be added beside it, never instead of it.
- **Standard notes become one item per notes block**, not per note (completion-officer's v2 lesson: 594 → 581).
- **Scope:** completeness, not compliance. Present, filled in, signed, sealed, shown: yes. "Is the design adequate": no.
- **Workers pick words, never coordinates.** This is cc-source-citations' `Pick` shape, and quotes are checked against the words by `quote.ts` in the contract.

**D11. Verification, deduplication and coverage happen in a script.** `2.3-verify`:
- Builds each region with `boxes.quote_in_words` → `boxes_for` from the shared library. An item whose scope citation fails is dropped and listed in `rejected.json`.
- Dedupes across groups: the same scope region plus near-identical text gives one item, kept in the earlier group, with the merge recorded. completion-officer lost this check between v1 and v2.
- Writes `coverage.json`: for every page or section of every scope source, the items citing it, or **uncovered**. Uncovered spans are what the audit looks at first.

**D12. Audit and disposition, prospector style.**
- **`2.4-audit`** is the `reviewer` preset in a fresh session, following `prospector/lib/audit.md`: it reads `items.json`, `coverage.json`, the snapshots and the ledger's auditor view, records the worktree HEAD as `reviewed_head`, and does not read `2.2-extract` sessions. It writes `findings.json` in `prospector/lib/audit.ts`'s `Findings` shape (`CHARGED|CLEAN`, `charged[{id, kind, claim, evidence, repro_cmd}]`, `rejudged[]`, `leads[]`). **A claim opens with the group files it concerns** (`cc-3.md, cc-7.md: …`), which is how `disposition.py --fan-out` names the items to relaunch; a claim that names none relaunches every group. Charge kinds:
  - `scope`: an item asks about compliance;
  - `coverage`: an uncovered scope span holds a requirement;
  - `checkability`: an agent could not verify the item from a plan set and documents;
  - `duplicate`;
  - `format`.
- **`2.5-disposition`** runs `prospector/lib/disposition.py --work-step 2.2-extract --audit-step 2.4-audit --worktree-step 1.0-worktree --fan-out`: only the groups that were charged are voided and re-run with their findings. At most 3 rounds, then `ACCEPTED_WITH_RESIDUALS` with the open charges carried into the readout. The residuals are written as `## Charges` rows in the ledger and committed in the worktree, as every prospector workstream does, so they reach bureau with the checklist. Extraction workers answer prior-round charges in the same table (`ADDRESSED` or `SCORED_BELOW_BAR`), which the 2.2 contract checks the way `fees.ts` `unansweredCharges` does.

### 2.4 Output and publish

**D13. Writing.** `3.1-write` renders the db-schema file format exactly, **into the worktree** (D1), and commits it (`worktree.py commit --path jurisdictions/<slug>/completeness-check --path jurisdictions/<slug>/intake.yaml …`). The step's gate, `lib/intake.ts gate --step …` in the prospector style (a `gate.json` the audit and the wrapper read), runs `lint:intake` once db-schema P2a exists (the same rules locally until then) and `tooling/verify/content-gates.sh` against the branch base. Of the content gates, only American spelling reaches `completeness-check/` and `intake.yaml` today; `lint:intake` is the folder's own gate.

For `basis: formal`, under `jurisdictions/<slug>/completeness-check/`:
- `CURRENT_VERSION`: `v1`, or the next free `vN` when `replace` is set.
- `v1/cc-N.md`, one per group:
  - The checklist table is **rendered by the script from `items.json`** with the 8 columns (`ID | Item | Condition | Location | Location Binding | Requirement Source | Source Type | Fail Status`), so the table can't drift from the items.
  - The prose sections (Description, Overview, Documents to Review, Validation Methodology where the method isn't obvious, and Common Rejection Triggers, at least 2) are written by one agent per group from that group's items and sources.
- `v1/intake-ids.tsv` (db-schema D3):
  - Items are numbered in group order, then table order, as `{code}-0001` and up, and the ID column of each guide **is** that stable ID (db-schema D3, new jurisdictions).
  - `ref` = `cc-N:{id}`.
  - `next_item` = count + 1.
- `v1/intake-groups.tsv` (db-schema D15): one row per group, `cc-N` → `{code}-GNN` in roster order, with the group title without its number. `next_group` = group count + 1.
- `v1/version.yaml` (db-schema D14, D16): `version: 1.0.0`, `format: 1`, and `generated_by` = {runbook, `run_id` (the `runbook_runs` uuid), `run_name`, `runbook_commit`}.
- `v1/cc-item-title-mappings.tsv` and `v1/true-comment-num-mapping.tsv` (comment number = sort order).
- `v1/source-citations.json`: cc-source-citations' schema, built from the verified regions, so `/intake-checklists/<slug>` can show the citations once the bucket syncs.
- `sources/manifest.json`, and `requirement-source-urls.tsv` (`Requirement Source` label → URL), so cc-source-citations can be re-run on this checklist.

For every basis:
- `jurisdictions/<slug>/intake.yaml` (db-schema D1):
  - `checklist`, `basis`, `application_type`;
  - `path`, `next_item` and `next_group` for own checklists only;
  - `evidence.summary` from `basis.json`;
  - `evidence.sources` = the scope sources, or for `none_found` the strong-tier negative attempts;
  - `decided_by` = the run's `runbook_runs` uuid (db-schema D1), or `null` when the run has none.
- `jurisdictions/<slug>/prospector/intake/ledger.md` + `notes.md` are already there (D5, D12); this step adds nothing to them.
- `jurisdictions/<slug>/conventions.yaml`, the stub, when the folder has none (D2).

**D14. Review and publish.**
- **`3.2-contact-sheet`** reuses cc-source-citations' contact-sheet builder. It shows the sources and basis, then each group's items with crops of their cited regions, plus the coverage gaps and residual charges.
- **`4.1-review`** is a `runner: none` gate, `approved | revise`, with `revise` routing to 2.2 for named groups or to 3.1. Under `gates: auto` it is passed with `decided_by: "auto"`, as 1.5 is (D8); the contact sheet is still written, so a loop run can be read afterwards.
- **`4.2-publish`:**
  - Stands aside (`NOTHING-TO-SHIP.md`, exit 0) when `publish` is false. That is every loop run and every wrapped run (§6).
  - Refuses unless 4.1 is approved by a person (`gates: human`).
  - **Refuses if `jurisdictions/<slug>/completeness-check/` already exists on origin/main, unless `replace: true`.** Austin loop runs never publish, and Cedar Park's uncurated v1 is replaced only on purpose.
  - Uploads the snapshots to `cc-source-snapshots` (`upload_snapshot` from the shared library).
  - **Ships the worktree branch**, the way prospector's `bin/ship.py` ships a run branch: merge `origin/main` into `intake-prospecting/<slug>-<run>` (never rebase, so the session commits keep their shas), push, `gh pr create`, `pr.json`. The PR carries exactly the D13 commits; there is no copy step. A conflict parks with a readout.

  Merging the PR is the publish. db-schema's sync, once it exists, carries the result to the DB.

### 2.5 The loop

**D15. Scoring is a separate runbook, `intake-score`.** It sits outside the rule-19 fence that intake-prospecting works inside. It takes a finished intake-prospecting run dir and a scenario, and is modelled on cc-compare:
- `1.1-inputs`
- `2.1-match/<reference group>`: blind Opus judges, one per reference group. Each sees one reference item and the candidate generated items, and answers `match | partial | none`.
- `3.1-scorecard`: the scorecard, plus the judge cache keyed by content hash, so re-scoring an unchanged pair is free.

The one scenario, `runbooks/intake-score/scenarios/austin/` (D16), holds:
- `reference.json`: items parsed from the reference guides, frozen;
- `reference-sources.json`: the documents a good run must find;
- `expected.yaml`: the basis and application type.

| Metric | What it measures | How |
|---|---|---|
| **M1 source recall** | the reference documents among `scope_sources` | mechanical (normalized URL or title), then a judge for near-misses |
| **M2 basis** | `basis` + `application_type` vs `expected.yaml` | mechanical |
| **M3 item recall** | reference items matched (match = 1, partial = 0.5) | judge |
| **M4 item precision** | generated items that match a reference item **or** that a judge rules an in-scope intake item traced to a scope source (the reference isn't exhaustive) | judge |
| **M5 scope violations** | generated items judged compliance-not-completeness | judge |
| **M6 citation validity** | items whose scope citation verified in 2.3 | mechanical, from `rejected.json` |
| **cost / time** | seat dollars and wall clock per step | from the conductor run record |

M3 and M4 are also reported against Austin **v2.7-trimmed** as information only (north-star D11).

**D16. Austin is the only scored scenario; other jurisdictions are unscored smoke runs.** [Will 2026-10-14: Austin only, because nobody can confirm the New Braunfels or Cedar Park runs were good. The numbers are proposed, Q1.]

| Scenario | Reference | Expected and bar |
|---|---|---|
| `austin` (scored) | `v2-trimmed` (190 items, the four intake documents) | `formal`, Consolidated Site Plan; **M1 = 4/4, M3 ≥ 0.70, M4 ≥ 0.85, M5 ≤ 0.05, M6 ≥ 0.95** |

- "Close enough" means the Austin row passes on two consecutive runs with no prompt change between them. **This is the only bar.**
- **Smoke runs** are for non-Austin jurisdictions, for example New Braunfels or Cedar Park, and ideally one with prospector outputs such as Leander, to exercise D4's seeds. They test **mechanics only**:
  - the run completes;
  - snapshots capture from non-Austin hosts (CivicPlus `DocumentCenter/View/N`, other CMSes, Municode), measured as the capture error rate;
  - M6 citation validity;
  - output that passes `lint:intake`;
  - a `basis.json` whose rationale cites evidence.

  They have no `reference.json` and no `expected.yaml`, and nothing is judged against one. Their basis, sources and items are skimmed by a person and noted in the iteration report, but **they don't gate the bar and shouldn't steer prompt changes on their own**. Existing artefacts (Cedar Park's `v1`, New Braunfels' Gate 0 sources) are never treated as answers.
- Loop iterations run with `gates: auto` and `publish: false`, and the scorecards are collected in one Inspector General report per iteration. The worktree each iteration writes is a local branch that is never pushed; `intake-score` reads the run dir and the worktree.

**D17. completion-officer is retired, not imported.** No file is copied in. Its heuristics live on in the D5, D9, D10 and D12 prompts. Once D16's bar is met (north-star Q7):
- archive the repo;
- delete `tools/sync-to-bureau.sh`, whose stale v2.7 copy would already fail db-schema's linter;
- point `jurisdictions/cedar-park/completeness-check/README.md` at this runbook.

**D18. Human gates exist only in the standalone lane.** [Will, 2026-10-14] A standalone run may stop at 1.5-scope and 4.1-review for a person (`gates: human`). Once the runbook is wrapped by prospector (§6), there are no human gates: the wrapper requests `gates: auto`, the fresh-session audit at 2.4 is the review, as it is for every other workstream, and the checklist ships, merges and syncs on prospector's autonomous path (`8.1-ship-bureau/drive` merges, `9-record` stamps, db-schema's sync carries it to the App DB). North-star D10's "human-reviewed merge" therefore holds for the standalone lane only; the north star is amended to say so. A curated jurisdiction is protected by 4.2's existing-checklist refusal in the standalone lane and by the wrapper never requesting `replace`.

---

## 3. Testing seams

**S1: each step's contract** (existing kind)
- **Proves:**
  - D1 (`worktree.json` in prospector's shape; the worktree committed and each report's head in its history, via `lib/step-loop.ts` `stepLoop` with the step's `worktree_paths`), D2 (Request), D5 (`sources.json` shape, `doc_type` enum; the ledger via `ledgerRules`), D7 (`scope_sources` ⊆ intake_instrument ∪ template), D9 (every scope page assigned exactly once; empty roster unless `formal`);
  - D10 (every item has a scope citation; quotes match the words), D11 (`rejected.json`, `coverage.json`), D12 (`findings.json` parses as `audit.ts` `Findings`; prior-round charges answered);
  - D13 (the file set, a guide table that matches `items.json`, `lint:intake`, the content gates), D14 (publish refusals, stand-aside when `publish` is false);
  - D8 (`publish: true` with `gates: auto` refused).
- **Prior art:** `runbooks/cc-source-citations/steps/*/contract.test.ts` (node:test plus `runbooks/lib/contract-helpers.ts`), `steps/2.1-locate/steps/locate/contract.test.ts` for a worker contract that checks quotes, and `runbooks/prospector/fees/contract.test.ts` + `fees/lib/fees.ts` for a step-loop work contract with a workstream gate over the worktree.
- **Runs:** `node --test` per step, over fixture run dirs, in bureau CI with the other runbook contracts.

**S2: the shared source library** (existing, moved in P0)
- **Proves:** the move changes no behaviour. cc-source-citations' `scripts/test_ccs.py` and its step contracts pass unchanged against `runbooks/lib/sources/`.
- **Prior art:** `runbooks/cc-source-citations/scripts/test_ccs.py`.
- **Runs:** `python3 -m pytest runbooks/lib/sources runbooks/cc-source-citations/scripts`, in bureau CI.

**S3: `intake-score` on a fixture run** (new)
- **Proves:** D15's metrics on a hand-built run dir with known matches. M1, M2 and M6 are mechanical and exact; M3–M5 use a cached judge fixture, so the test spends nothing.
- **Prior art:** `runbooks/cc-compare/` (scorecard, answer key) and `runbooks/lib/eval/score.ts` (deterministic scoring with cached judge verdicts).
- **Runs:** `node --test runbooks/intake-score`, in bureau CI.

**Acceptance (not a seam):**
1. D16's Austin row passes twice in a row.
2. At least one non-Austin smoke run passes its mechanical checks.
3. One `gates: human`, `publish: true` run on a non-Austin jurisdiction of Will's choosing opens a **draft** bureau PR that passes `lint:intake`.

Whether that PR merges is Will's judgement of its content, not part of acceptance.

---

## 4. PR plan

All PRs are in `bureau`.

**P0: move the shared source-capture code to `runbooks/lib/sources/`**
- **Blocked by:** nothing (can start now).
- **Delivers:** `capture.py` (minus `capture_municode`'s `CodeIndex` dependency, which is passed in), `capture_web.mjs`, `pdfwords.py`, `boxes.py`, `quote.ts`, `unique_id`, `current_snapshot_for`, `upload_snapshot`, and the `Snapshot`/`Region`/`Box`/`Pick` zod types move. cc-source-citations imports them from the new home. No behaviour change.
- **Tested at:** S2.
- **Door:** two-way.
- **Blast radius:** cc-source-citations runs, until S2 is green.

**P1: request, worktree, inputs, discovery, capture, classification, scope gate** (steps 0 – 1.5)
- **Blocked by:** P0.
- **Delivers:** a run that stops at `1.5-scope` with `sources.json`, `process.md`, the ledger committed in the worktree, snapshots and `basis.json`. Lands D1–D8, including the worktree step in both modes (made, or taken from `request.worktree`). This is enough to measure M1 and M2, the metrics north-star D11 says to score first.
- **Tested at:** S1 (steps 0–1.5).
- **Door:** two-way (a new runbook nobody else calls).
- **Blast radius:** none.

**P2: `intake-score` with M1/M2/M6 and the Austin scenario**
- **Blocked by:** P1 (its run-dir shape).
- **Delivers:** D15 (mechanical metrics) and D16 (scenario folders, with Austin's reference parsed from `v2-trimmed`). **The source loop starts here**: iterate 1.2 and 1.4 prompts against the Austin scores, with smoke runs on one or two non-Austin jurisdictions to catch scraping and capture failures (D16).
- **Tested at:** S3 (mechanical half).
- **Door:** two-way.
- **Blast radius:** none.

**P3: groups, extraction, verify, audit, disposition** (steps 2.1 – 2.5)
- **Blocked by:** P1.
- **Delivers:** D9–D12. A run produces `items.json`, `coverage.json` and `findings.json`.
- **Tested at:** S1 (steps 2.x).
- **Door:** two-way.
- **Blast radius:** none.

**P4: `intake-score` judge metrics M3–M5**
- **Blocked by:** P2, P3.
- **Delivers:** the D15 judge metrics, the judge cache, and the scorecard into Inspector General. **The item loop starts here.**
- **Tested at:** S3 (judge half, cached fixture).
- **Door:** two-way.
- **Blast radius:** none.

**P5: write, contact sheet, review gate, publish** (steps 3.1 – 4.2)
- **Blocked by:** P3, and db-schema **P2a** (the format and `lint:intake` the contract runs; north-star D3 v1.1).
- **Delivers:** D13, D14. Then acceptance, ending in a human-gated draft publish for one non-Austin jurisdiction.
- **Tested at:** S1 (steps 3.x–4.x), then acceptance.
- **Door:** two-way until a PR it opens is merged. A merged checklist is a bureau revert.
- **Blast radius:** the bureau PRs it opens, which are reviewed before merge.

**P6: retire completion-officer** (`completion-officer`, `bureau`)
- **Blocked by:** D16's bar met.
- **Delivers:** D17.
- **Door:** two-way (the archived repo stays readable).
- **Blast radius:** none.

---

## 5. Open questions

- **Q1. The bar.** Are D16's Austin thresholds (M1 4/4, M3 ≥ 0.70, M4 ≥ 0.85, M5 ≤ 0.05, M6 ≥ 0.95, twice in a row) the right meaning of "close enough"? M3 against v2-trimmed is the number most likely to need Will's calibration after the first scored run.
- **Q2. North-star Q1** (the formal / none_found boundary) is needed for D7. The spec assumes the proposed rule. With no non-Austin scenario scored, Austin's `formal` is the only basis checked automatically, so a wrong boundary would show up only in the smoke runs, which a person reads.
- **Q3. Fail status.** Is "required / will be rejected → `fail`; recommended / may be returned → `warn`" enough? v2.7 also uses `fail-or-warn` (9 items), which the generator never produces. Leave that to human edits?
- **Q4. Key Terms.** Austin's guides gained a Key Terms section from the bureau glossary in v2.4. Should generated guides have one, and from what? The jurisdiction has no glossary until prospector's regulatory workstream builds one.
- **Q5. Re-generating a jurisdiction that already has a checklist.** D14 refuses without `replace`, and `replace` writes the next `vN`. Should a re-run on a **curated** checklist (Austin) ever publish, or only ever be scored?
- **Q6. Who reviews a checklist that prospector generates?** **Decided** (Will, 2026-10-14): nobody, by design. See D18. The two alternatives considered (a `review: pending` flag in `intake.yaml` that the sync honours; prospector producing only the basis, sources and ledger and leaving publication to a standalone run) are not taken.
- **Q7. Which prospector target runs intake?** [Will] `comment-harvest` and `review-guides` run only on `target: review` (`REVIEW_ONLY`). Intake feeds the CC review, not the SIR, so the recommendation is review-only, which keeps `sir` runs unchanged. The cost is that `intake_ready` then requires a review-target run.

## 6. Not yet specified

- **Historic comments as evidence** (north-star D13). Reading Library `historic_comments` for "incomplete submittal" notices to weight `fail_status` or confirm enforcement. That needs Library DB access from a run and a classifier for intake-flavoured comments. It comes after the loop shows where the items are weak.
- **More than one application type per jurisdiction** (north-star Q2). D7 picks one. If the loop finds jurisdictions where two application types carry site plans, the request and `intake.yaml` will need a key for it.
- **The prospector wrapper** (north-star I3, its own sub-spec `intake/prospector-workstream`). What it is, from the review-guides precedent, so I2 is built to fit it; the sizes are the point, not the detail.

  A sub-runbook `runbooks/prospector/intake/` with `audit: none` (this runbook audits itself at 2.4):
  1. `1-worktree`: `lib/worktree.py add --clone $RUN/request/worktree --out $OUT --workstream intake`, as every workstream.
  2. `2-request`: a script that writes this runbook's `Request` from `currency.json` (`jurisdiction` from the slug, name and state; `worktree` = `1-worktree/worktree`; `gates: auto`; `publish: false`; `requested_by` = the outer request's), or `stand-aside.json` when intake is current or out of scope.
  3. `3-run`: `runner: runbook`, `runbook: intake-prospecting`, `bind: {request: 2-request}`. Not `bind: {request: 0-resolve}`: that folder is prospector's currency record, not a `Request`.
  4. `4-upload`: the snapshot upload 4.2 would have done (it stood aside), so `/intake-checklists/<slug>` can render the citations after the ship. This needs the app-DB pair in the run environment, which today only `review-guides` gets (`lib/env.json` `stale`); that map is keyed by variable with one workstream per entry, so it grows a list.
  5. `5-disposition`: `disposition.json` derived from the nested `2.5-disposition/disposition.json` and `3.1-write/gate.json`, so `9-record` and the ship PR body see the residuals.
  6. `6-mergein`: `worktree.py mergein --worktree $RUN/1-worktree/worktree --sessions <the nested 1.2 and 2.2 sessions> --disposition …`.

  Registration in the outer runbook: `steps/4-intake/step.yaml` (`runner: runbook`, `runbook: prospector/intake`, `bind: {request: 0-resolve}`, inputs `1-research/output/mergein?`, `2-regulatory/output/mergein?`, `3-permit-harvest/output/mergein?`, so the seeds of D4 are on the run branch first); `intake` in `WORKSTREAMS` (`lib/outer.ts`, `bin/resolve.py`) and, per Q7, in `REVIEW_ONLY`; `WORK_TYPE["intake"] = "intake"`; `DELIVERABLES["intake"] = ("intake.yaml", 1)`, so a jurisdiction whose `intake.yaml` is on main reads as current inside the freshness window; `lib/env.json` `workstreams.intake`; `4-intake/output/mergein?` among `8.1-ship-bureau/open`'s inputs. Outside bureau: a `dsd/library` migration that adds `intake_completed_count` and `intake_ready` to `metro_ahj_coverage`, and `intake` in `dsd/web/lib/prospector/types.ts` `WORKSTREAMS`.

  What is **not** reused from the standalone lane: `4.2-publish` (stands aside) and the human gates (`auto`, D18). Everything the Austin loop tunes (1.2–3.1, the scorer) runs unchanged.

## 7. Out of scope

- **Writing the DB.** That is the db-schema sync (north-star D10).
- **The generic baseline's contents.** The `intake/baseline` sub-spec. This runbook only points `none_found` jurisdictions at `generic`.
- **Running the CC review on a generated checklist.** That needs the CC runbook's Austin defaults removed (north-star §7).
- **Cloud (substation) runs.** Substation is on the deprecation path, and capture needs local Playwright plus the operator's `gh`.
- **Running the loop through prospector itself** (`directives.only: [intake]`). Prospector's `0-resolve` needs the Library DB, takes the jurisdiction lock, clones and installs surveyor, and its ship step opens and merges a PR on every run that merged a workstream. None of that belongs in a scored Austin iteration, which is why the standalone lane exists.
