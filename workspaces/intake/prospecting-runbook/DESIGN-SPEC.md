# The intake-prospecting runbook

**Status:** Draft v1.1
**Date:** 2026-10-14
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
- **The prospector workstream pattern.** It runs work as a step loop, then a fresh-session audit, then disposition (`runbooks/prospector/lib/audit.md`, `disposition.py` with `MAX_ROUNDS=3`), and keeps a ledger with `Surfaces` and `Attempts` tables (`lib/ledger.ts`). In the ledger, `result` is found, partial, negative-technical or negative-policy, and **a negative needs a strong model tier**.
- **Prospector's outputs, as seeds for discovery:**
  - `briefing/process.md` exists for 22 jurisdictions; 6 have an intake heading (austin L46, fort-lauderdale L13, keller L34, leander L70, montgomery-township L55, san-diego L23).
  - 96 `codes/*submittal*|*checklist*|*application*` folders across 47 jurisdictions, each with a `meta/provenance.json` `source.url`.
  - `regulatory/code-inventory.md` (19 jurisdictions) routes "applications, checklists and forms" to `Owner = permit-recon` in its `## Not Regulatory` table. Celina's lists 82 such rows, for example `Site Plan Checklist | …/DocumentCenter/View/5586`.
- **Two scoring harnesses:** cc-compare, a reference set plus blind Opus adjudication and a scorecard whose answer key grows over runs; and `runbooks/lib/eval/`, per-step `_eval` specs.
- **Rule 19:** `runbooks/lib/AGENTS-core.md` rules 19–20 bar prior Noetic output and anything named like an answer key, and every runbook's `AGENTS.md` opens with a "Rule 19 posture." paragraph.

---

## 1. The runbook at a glance

```diff
 bureau/runbooks/
+├── intake-prospecting/
+│   ├── runbook.yaml            # local lane, sandbox: false, presets: research (opus-5.5 high), extract (opus-5.5 medium), reviewer
+│   ├── AGENTS.md               # rule-19 posture (D3), completeness-not-compliance, item format
+│   ├── scripts/ip.py           # one subcommand per script step
+│   └── steps/
+│       ├── 0-request/          # gate: Request (D2)
+│       ├── 1.1-inputs/         # script: resolve jurisdiction, collect prospector seeds (D4)
+│       ├── 1.2-discover/       # agent, step loop: find + type sources, process shape, ledger (D5)
+│       ├── 1.3-capture/        # script: snapshot every candidate source (D6)
+│       ├── 1.4-classify/       # agent: basis + application type + scope sources (D7)
+│       ├── 1.5-scope/          # gate: approve sources + basis (human, or auto for eval runs) (D8)
+│       ├── 2.1-groups/         # agent: the group roster (D9); empty unless basis = formal
+│       ├── 2.2-extract/<group> # fan-out, agent: items with citations picked by word id (D10)
+│       ├── 2.3-verify/         # script: quotes → boxes, dedupe, coverage (D11)
+│       ├── 2.4-audit/          # agent, fresh session: scope + coverage charges (D12)
+│       ├── 2.5-disposition/    # script: send-back to 2.2 per group, ≤3 rounds (D12)
+│       ├── 3.1-write/          # script + agent: guides, sidecars, intake.yaml (D13)
+│       ├── 3.2-contact-sheet/  # script: HTML readout
+│       ├── 4.1-review/         # gate: approved | revise (D14)
+│       └── 4.2-publish/        # script: upload snapshots, open one bureau PR (D14)
+├── intake-score/               # separate runbook: scores a finished run against a reference (D15)
 ├── cc-source-citations/scripts/lib/   # capture/pdfwords/boxes/quote.ts move out ↓
+└── lib/sources/                # shared source capture + word ids + quote verification (P0)
```

**Two paths through the runbook:**
- **`basis: formal`:** 1.x → 2.x → 3.x → 4.x. Writes a jurisdiction checklist `v1`.
- **`none_found` / `inconclusive`:** the 2.1 roster is empty, so 2.2–2.5 pass with nothing to do. 3.1 writes only `intake.yaml` (`checklist: generic`) plus the discovery ledger as evidence.

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

**D2. The request.** A zod `Request` in `steps/0-request/contract.test.ts`, the only definition:

```ts
Request = {
  jurisdiction: { slug: /^[a-z0-9-]+$/, name: string, state: string },  // need not exist in bureau yet
  application_type_hint?: string,        // e.g. "commercial site plan"; discovery may override with evidence
  seeds?: { url: string, note?: string }[],   // operator-supplied starting points
  scope_gate: "human" | "auto",          // default "human"; "auto" for scored loop runs (D8)
  publish: boolean,                      // default false; true requires scope_gate "human"
  replace?: boolean,                     // publish over an existing checklist (D14)
  requested_by: string,
}
```

A `jurisdiction.slug` with no `jurisdictions/<slug>/` directory is allowed; New Braunfels has none. Publishing then adds a two-line `conventions.yaml` stub (name, short_name), the legal minimum that registers the slug, so db-schema's sync can later satisfy its `jurisdictions` FK.

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

These go into `seeds.json`, each tagged with its origin. A standalone run on a jurisdiction prospector hasn't covered (New Braunfels) gets only `request.seeds` and starts from the web. This is north-star D14's seam: in I3, prospector calls the same runbook as a sub-runbook after `1-research` and `2-regulatory`, and it gets richer seeds without any code path changing.

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
- **`ledger.md`:** prospector's `Surfaces` and `Attempts` tables (`lib/ledger.ts`). A negative attempt ("no completeness checklist published") needs the strong tier, so a `none_found` basis rests on recorded, strong-tier evidence, not on silence.

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

Gate 0 was historically the most valuable human step (Austin: the CC Application promoted). But a scored loop must measure the runbook, not Will, so `scope_gate: auto` passes the gate with `decided_by: "auto"`. The readout is still written. `publish: true` requires `scope_gate: human` (D2).

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
- **`2.4-audit`** is the `reviewer` preset in a fresh session, following `prospector/lib/audit.md`. It does not read `2.2-extract` sessions. It writes `findings.json` (`CHARGED|CLEAN`, `charged[{id, group, kind, claim, evidence}]`). Charge kinds:
  - `scope`: an item asks about compliance;
  - `coverage`: an uncovered scope span holds a requirement;
  - `checkability`: an agent could not verify the item from a plan set and documents;
  - `duplicate`;
  - `format`.
- **`2.5-disposition`** reuses `prospector/lib/disposition.py` with `--fan-out`: only the groups that were charged are voided and re-run with their findings. At most 3 rounds, then `ACCEPTED_WITH_RESIDUALS` with the open charges carried into the readout.

### 2.4 Output and publish

**D13. Writing.** `3.1-write` renders the db-schema file format exactly.

For `basis: formal`, under `jurisdictions/<slug>/completeness-check/`:
- `CURRENT_VERSION`: `v1`, or the next free `vN` when `replace` is set.
- `v1/cc-N.md`, one per group:
  - The checklist table is **rendered by the script from `items.json`** with the 8 columns (`ID | Item | Condition | Location | Location Binding | Requirement Source | Source Type | Fail Status`), so the table can't drift from the items.
  - The prose sections (Description, Overview, Documents to Review, Validation Methodology where the method isn't obvious, and Common Rejection Triggers, at least 2) are written by one agent per group from that group's items and sources.
- `v1/intake-ids.tsv` (db-schema D3):
  - Items are numbered in group order, then table order, as `{slug}-0001` and up, and the ID column of each guide **is** that stable ID (db-schema D3, new jurisdictions).
  - `ref` = `cc-N:{id}`.
  - `next_item` = count + 1.
- `v1/cc-item-title-mappings.tsv` and `v1/true-comment-num-mapping.tsv` (comment number = sort order).
- `v1/source-citations.json`: cc-source-citations' schema, built from the verified regions, so `/intake-checklists/<slug>` can show the citations once the bucket syncs.
- `sources/manifest.json`, and `requirement-source-urls.tsv` (`Requirement Source` label → URL), so cc-source-citations can be re-run on this checklist.

For every basis:
- `jurisdictions/<slug>/intake.yaml` (db-schema D1):
  - `checklist`, `basis`, `application_type`;
  - `path` and `next_item` for own checklists only;
  - `evidence.summary` from `basis.json`;
  - `evidence.sources` = the scope sources, or for `none_found` the strong-tier negative attempts;
  - `decided_by` = the run id.
- `jurisdictions/<slug>/prospector/intake/ledger.md` + `notes.md`: the discovery ledger, at prospector's workstream path, ready for I3.

The step's contract runs `lint:intake` once db-schema P2a exists. Until then it checks the same rules locally.

**D14. Review and publish.**
- **`3.2-contact-sheet`** reuses cc-source-citations' contact-sheet builder. It shows the sources and basis, then each group's items with crops of their cited regions, plus the coverage gaps and residual charges.
- **`4.1-review`** is a `runner: none` gate, `approved | revise`, with `revise` routing to 2.2 for named groups or to 3.1.
- **`4.2-publish`:**
  - Refuses unless 4.1 is approved and `publish: true`.
  - **Refuses if `jurisdictions/<slug>/completeness-check/` already exists, unless `replace: true`.** Austin loop runs never publish, and Cedar Park's uncurated v1 is replaced only on purpose.
  - Uploads the snapshots to `cc-source-snapshots`.
  - Opens one bureau PR on `intake-prospecting/<slug>-<YYYYmmdd-HHMM>`, using cc-source-citations' `step_review` publish flow: a worktree off origin/main, copy exactly the D13 files, commit, `gh pr create`, `pr.json`, or `NOTHING-TO-SHIP.md`.

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
- Loop iterations run with `scope_gate: auto` and `publish: false`, and the scorecards are collected in one Inspector General report per iteration.

**D17. completion-officer is retired, not imported.** No file is copied in. Its heuristics live on in the D5, D9, D10 and D12 prompts. Once D16's bar is met (north-star Q7):
- archive the repo;
- delete `tools/sync-to-bureau.sh`, whose stale v2.7 copy would already fail db-schema's linter;
- point `jurisdictions/cedar-park/completeness-check/README.md` at this runbook.

---

## 3. Testing seams

**S1: each step's contract** (existing kind)
- **Proves:**
  - D2 (Request), D5 (`sources.json` / ledger shape, `doc_type` enum), D7 (`scope_sources` ⊆ intake_instrument ∪ template), D9 (every scope page assigned exactly once; empty roster unless `formal`);
  - D10 (every item has a scope citation; quotes match the words), D11 (`rejected.json`, `coverage.json`);
  - D13 (the file set, a guide table that matches `items.json`, `lint:intake`), D14 (publish refusals);
  - D8 (`publish: true` with `scope_gate: auto` refused).
- **Prior art:** `runbooks/cc-source-citations/steps/*/contract.test.ts` (node:test plus `runbooks/lib/contract-helpers.ts`), and `steps/2.1-locate/steps/locate/contract.test.ts` for a worker contract that checks quotes.
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
3. One `scope_gate: human`, `publish: true` run on a non-Austin jurisdiction of Will's choosing opens a **draft** bureau PR that passes `lint:intake`.

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

**P1: request, inputs, discovery, capture, classification, scope gate** (steps 0 – 1.5)
- **Blocked by:** P0.
- **Delivers:** a run that stops at `1.5-scope` with `sources.json`, `process.md`, the ledger, snapshots and `basis.json`. Lands D1–D8. This is enough to measure M1 and M2, the metrics north-star D11 says to score first.
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

## 6. Not yet specified

- **Historic comments as evidence** (north-star D13). Reading Library `historic_comments` for "incomplete submittal" notices to weight `fail_status` or confirm enforcement. That needs Library DB access from a run and a classifier for intake-flavoured comments. It comes after the loop shows where the items are weak.
- **More than one application type per jurisdiction** (north-star Q2). D7 picks one. If the loop finds jurisdictions where two application types carry site plans, the request and `intake.yaml` will need a key for it.
- **The prospector wrapper** (north-star I3). It calls this runbook as a sub-runbook with `bind: {request: 0-resolve}`, maps its gates onto prospector's audit pattern, and adds `intake` to `workstream_status`. D4 and D13 (the ledger path) are designed so that wrapper adds code without changing this runbook.

## 7. Out of scope

- **Writing the DB.** That is the db-schema sync (north-star D10).
- **The generic baseline's contents.** The `intake/baseline` sub-spec. This runbook only points `none_found` jurisdictions at `generic`.
- **Running the CC review on a generated checklist.** That needs the CC runbook's Austin defaults removed (north-star §7).
- **Cloud (substation) runs.** Substation is on the deprecation path, and capture needs local Playwright plus the operator's `gh`.
