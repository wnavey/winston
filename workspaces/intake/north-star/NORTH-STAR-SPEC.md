# Intake north star: a checklist for every jurisdiction

**Status:** Draft v1.3
**Date:** 2026-10-14
**Repos touched:** none. This is a plan of a plan. It records the 2026-10-14 discussion with Will, names where intake should end up, and lists the sub-specs that will carry out the work.
**Repos eventually touched:** `bureau` (checklist files, the intake-prospecting runbook, the prospector workstream, the sync), `cityhall` (App-DB tables and migrations), `dsd` (the `metro_ahj_coverage` view and the prospector dashboard, for `intake_ready`), `completion-officer` (retired)
**Repos NOT touched:** `conductor` (legacy), `substation` (on the deprecation path)

> **Revision note v1.3 (2026-10-14, prospector integration audit):** §4.4 now says what the I3 wrapper is, from the precedent in `prospector/review-guides/` (which nests `guide-training` unchanged), and names `dsd` as the home of `intake_ready`. The prospecting-runbook sub-spec is Draft v1.2, built to that wrapper; D10 is amended: the human-reviewed merge is the standalone lane's; inside prospector there are no human gates (Will; runbook D18). Q7 (which target runs intake) is Will's.
>
> **Revision note v1.2 (2026-10-14, Will):** D11: **Austin is the only scored case.** Nobody can confirm that the New Braunfels and Cedar Park runs were good, so they are at most unscored smoke runs for scraping and extraction on non-Austin sites, with little weight. D3's gate on P1/P2b is changed to match.
>
> **Revision note v1.1 (2026-10-14):** D3 now orders the work by dependency: I2 (the runbook) depends on I1's file format only, so it starts now. I1's migration and sync (P1, P2b) wait until the loop has run on two jurisdictions. Sub-spec table: `prospecting-runbook` is now Draft v1.

**Sub-specs spawned from this one:**

| Sub-spec | Path | Status |
|---|---|---|
| Intake checklist DB schema + bureau sync | `workspaces/intake/db-schema/DESIGN-SPEC.md` | Draft v1 (same PR); P2a first, P1/P2b after the loop (D3) |
| The intake-prospecting runbook | `workspaces/intake/prospecting-runbook/DESIGN-SPEC.md` | Draft v1.2 (audited against prospector) |
| The generic baseline checklist | `workspaces/intake/baseline/` | not started |
| Intake in the prospector flow | `workspaces/intake/prospector-workstream/` | not started |
| DB as the source of truth | `workspaces/intake/db-source-of-truth/` | later |
| Renaming completeness-check to intake | `workspaces/intake/rename/` | later |

---

## 1. The north star

### 1.1 What intake is

Noetic runs two reviews against a site plan set:

- **The formal review** (the bureau `review` runbook) asks whether the plans comply with the regulations.
- **The completeness check** asks whether the submission is complete enough for the city to accept it into technical review.

"Completeness check" is Austin's term for that step, so from now on it is called **intake**. Intake and completeness check (CC) mean the same thing throughout this spec.

**The theme that sets the scope of every intake checklist is completeness, not compliance.** An intake item asks whether something required is present, filled in, signed or shown, for example "the CC Application is in the package" or "the ROW widths are dimensioned". It does not ask whether a value meets the code. Many jurisdictions have no formal intake step at all. Where one exists, it is a custom process unique to that city.

### 1.2 The goals

- **G1. Every jurisdiction has an intake checklist with a known basis.** The checklist is either the jurisdiction's own, extracted from its published intake documents, or the shared generic baseline. The DB records which one it is and the evidence behind that choice. "We looked and found no intake process" is stored as a fact, not lost in a run log.
- **G2. Checklist items live in a database** with stable short IDs, a jurisdiction, a version, a group, a title, a comment number and the source of every item. Today the checklist is markdown tables in two git repos, identified by legacy IDs that change whenever an item moves.
- **G3. A runbook generates a jurisdiction's checklist**, replacing completion-officer. It is good enough on Austin that a person would start from its output, and it does not depend on talking to the city.
- **G4. Items come with source citations as they are generated.** cc-source-citations adds citations after the fact today; in future they are recorded when each item is extracted.
- **G5. Prospector produces intake readiness.** Intake becomes a prospector workstream with an `intake_ready` status next to `sir_ready` and `review_ready`.

### 1.3 What done looks like

- Run prospector for a new jurisdiction and it opens a bureau PR containing either (a) an intake checklist for that jurisdiction, with a citation for every item, or (b) a "no formal intake found" record with its evidence, which points the jurisdiction at the generic baseline.
- On merge, the checklist reaches the App DB. The CC (intake) runbook runs against it unchanged, the same way Austin's does today.
- Austin keeps working throughout, and its 60 existing CC reviews still resolve to their items.

---

## 2. Where we are today

All facts verified 2026-10-14.

### 2.1 completion-officer, the original generator

- `~/noetic/completion-officer` holds prompts and Claude Code agent definitions, with no application code. You launch it with `claude --agent research-director "Austin --run <label>"`.
- It runs six phases with human gates between them:
  - 0: sources of truth
  - 1: discovery scouts
  - 2: section scouts
  - 3: deep research, plus lookups against `bureau/jurisdictions/<slug>/codes/`
  - 4: synthesis
  - 5: checklist writers, which produce `cc-N.md` files
- Agents use WebSearch/WebFetch, plus `tools/extract.py` to convert PDF/DOCX to markdown. Output goes to `research/<slug>/<run>/`. Finished versions are copied to `final-checklists/<ver>/` and pushed to bureau with `tools/sync-to-bureau.sh`, which hard-codes Austin.
- **The agents are written to work for any jurisdiction**, and the director warns against assuming Austin's structure. Every checklist they have finished is Austin's.
- **Bureau is now upstream of completion-officer.** Since v2.5, completion-officer commits are titled "mirror/port of bureau PR #…". Its v2.7 copy has 191 items and bureau's has 192, because it is missing `cc-22:CC-22-12` (noted in memory, never fixed). Retiring completion-officer therefore means moving its research agents, not migrating data.

### 2.2 How Austin's checklist evolved

| Version | Items | How it was made |
|---|---|---|
| v0 | 671 | first agent run (2026-03-13) |
| v1 | 421 | agent run (03-24) |
| v2 | ~458 | agent run (04-03) |
| v2-trimmed | 190 | **rule-based cut** of v2 (04-03), see below |
| v2.1 – v2.7-trimmed | 185 → 192 | manual edits from review triage and conversations with the City of Austin (04-13 → 10-09) |

**The v2 → v2-trimmed cut followed a written rule** (`completion-officer/research/austin/v2-trimmed/final/removal-audit.md`). An item survived only if it traced to one of four documents published specifically for intake:

1. the CC Application
2. the CC Submittal Checklist
3. the Notes and Templates DOCX
4. the AW Completeness Checklist, which says it is for "the Land Use Review completeness check process"

Items sourced only from the Requirements webpage, the LDC, the WUI checklist, the Environmental PDF or the TIA worksheet were cut: 268 items and 7 group files. This is the completeness-over-compliance theme of §1.1, arrived at by trial and error. D2 builds it in.

From v2.1 on the edits were made by hand (`final-checklists/queued-changes/`, `research/austin/v2.*-trimmed/`), driven by review triage and by talking with the city. **A fresh run of today's completion-officer would not produce v2.7-trimmed**, and other jurisdictions will not have that channel to the city.

### 2.3 Where the checklist lives and how it is identified

- **Bureau is canonical:** `bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/` (`CURRENT_VERSION` = `v2.7-trimmed`). It has 14 guides (`cc-1.md` … `cc-24.md`, with gaps) and 192 items. Each guide carries prose the review agents depend on (Description, Overview, Key Terms, Documents to Review, Validation Methodology) plus a markdown table: `ID | Item | Condition | Location | Location Binding | Requirement Source | Source Type | Fail Status`.
- **The side TSVs:**
  - `cc-item-title-mappings.tsv`: the authored titles.
  - `true-comment-num-mapping.tsv`: comments numbered 1–192, renumbered in group order by bureau#2105.
  - `pape-dawson-comment-num-mapping.tsv`: the original numbers, with gaps, up to 202.
  - `1700-s-lamar-forced-outcomes.tsv`: forced outcomes for one project.
  - `source-citations.json` + `citation-overrides.json`: from cc-source-citations (bureau#2045).
  - v2.1–v2.3 also have version-to-version mapping TSVs that record ID lineage by hand.
- **ID schemes are mixed.** `CC-<group>-<NN>` IDs (from the Phase 5 writer) sit beside department prefixes kept from the v2 synthesis: AW (37 items), DAT, ADR, AE, AF, CMP, HCR, OSP, AEGB. Many item texts still carry an older synthesis ID in parentheses (`(INT-01)`). **The group number is part of the ID**, so moving, splitting or renaming an item changes its ID, which is why the mapping TSVs exist.
- **How a review cites an item.** A review cites the composite ref `"{group}:{id}"` (`cc-1:CC-1-01`) in `review_comments.source_findings[].ref`, built in `bureau/runbooks/lib/review_comments_v2.py`. `review_checklist_comment_map.checklist_item_id` holds the bare ID (47,826 rows). Amend (`runbooks/lib/review_amend.py`) and cityhall triage both match on the ref. There are 60 CC reviews in prod.
- **There is already a DB copy, but it is a cache.** Inspector General fills `bureau_checklist_version` + `bureau_checklist_item` (`inspector-general/src/lib/data/bureau-checklist-store.ts`) for evals, keyed by (bureau commit, department, path). CC has 41 version rows. v2.7-trimmed alone is versions 6–14, nine rows with the same 192 items, because a version is created per commit, not per content change.

### 2.4 Other jurisdictions

- **Cedar Park:** `bureau/jurisdictions/cedar-park/completeness-check/v1/` has 21 guides plus a unified TSV, generated by completion-officer and never curated. It has no title map, numbering maps, URL map or citations.
- **New Braunfels:** `completion-officer/research/new-braunfels/v1/` stopped at Gate 0 (2026-05-06). The run found **no standalone site plan application and no formally named completion check.** The site plan is a drawing inside the commercial building permit, and intake is "informal" building-permit screening. **But the city does publish an 8-page Commercial Building Permit Checklist** covering 5 reviewing divisions. So New Braunfels is not a clean "no intake" case. It sits exactly on the boundary in Q1.

### 2.5 The CC runbook works for any jurisdiction slug; only Austin has content

- `bureau/runbooks/completeness-check/` takes its jurisdiction from `project.jurisdiction_slug`, checks it against the `jurisdictions` table, and reads `jurisdictions/<slug>/completeness-check/CURRENT_VERSION`.
- **It is Austin-only in practice because of content and defaults:**
  - The guides themselves are written for Austin.
  - `standardNotesReferenceUrl` defaults to an austin.widen.net URL (`cc.py`).
  - cc-source-citations' `lib/labels.py` hard-codes `austin.widen.net` and `austintexas.gov`.
  - The numbering and forced-outcome files are specific to Austin and to individual projects.
  - The cc-compare answer keys are Austin projects only.
- **When pieces are missing:** a jurisdiction with no `CURRENT_VERSION` fails at `1.4-resolve`. One with no title map gets titles generated on the fly. One with no numbering map gets sequential comment numbers.

### 2.6 Prospector already gathers most of the inputs, but has no intake workstream

- The current prospector is the bureau runbook `bureau/runbooks/prospector/`. The `~/noetic/prospector` repo is its predecessor (last commit 2026-09-07).
- **It runs these workstreams:**
  - research → `briefing/`
  - regulatory → `codes/`
  - sources- and permit-recon
  - programs, fees, permit-harvest → `approvals/`
  - sources (the surveyor modules)
  - comment-harvest
  - feasibility guides and review guides (`review` target only)
- **Readiness:** in the Library view `metro_ahj_coverage`, `sir_ready` requires 5 workstreams and `review_ready` requires 7.
- **Intake signals it already produces:**
  - **Submittal checklists:** regulatory has saved **96 `codes/*submittal*|*checklist*|*application*` folders across 46 jurisdictions**.
  - **Briefings:** `briefing/process.md` often has an "Intake and completeness" section.
  - **Approvals:** the approvals skill profiles each approval type's submittal requirements as prose.
  - **A completeness guide inside review:** review guide training always writes `review-guides/global/plan-set-integrity-and-submission-completeness.md`. That file exists for Austin, Cedar Park, El Paso and Fort Lauderdale.
- **City comments:**
  - Library `historic_comments` holds **3,437,029 rows across 32 jurisdictions**, verified 2026-10-14. Austin's are Master Comment Report PDFs scraped from the city portal.
  - Bureau `comment-harvest/` exists only for El Paso and McKinney. **El Paso's recon plan discards intake and routing notes on purpose.**
- **Two DBs key jurisdictions differently:**
  - The **App DB** (`mgxqsrjutswbciyrltwd`) uses `jurisdictions.slug TEXT PRIMARY KEY`, synced from bureau `conventions.yaml` by `.github/workflows/sync-conventions.yml` (spec winston#185).
  - The **Library DB** uses a uuid key with no slug.

---

## 3. Decisions

Each decision is marked **[Will]** if Will decided it in the 2026-10-14 discussion, or **[proposed]** if it is this spec's recommendation, open to change in a sub-spec.

**D1. Name.** [Will] "Intake" is the name for intake. All new work uses it: tables, files, runbooks. The existing `completeness-check/` paths, the `completeness_check` review type, the `2026-03-completeness-check` output schema and the CC runbook keep their names until the rename sub-spec, which comes after D8's source-of-truth flip.

**D2. Completeness over compliance, enforced by how sources are ranked.** [proposed] An item must trace to one of the jurisdiction's **intake-specific documents**: an application form, a submittal or completeness checklist, or required notes and templates. Code sections and design manuals may support an item and supply its citation, but they cannot be the reason an item exists. This is the v2 → v2-trimmed rule (§2.2) applied at generation time rather than as a trim afterwards.

**D3. Three initiatives, in order.** [Will, with the order proposed]
1. **I1: put the items in the DB** (`intake/db-schema`): define the file format in bureau, sync it to cityhall, backfill Austin.
2. **I2: port completion-officer to an intake-prospecting runbook** (`intake/prospecting-runbook`), looped until it gets close enough to Austin (D11).
3. **I3: make it a prospector workstream** (`intake/prospector-workstream`).

**The order of the work is not I1 → I2 → I3** (revised v1.1, Will 2026-10-14). I2 depends on I1's **file format** (db-schema D1, D3, D4), not on the database: the runbook publishes through a bureau PR (D10), and the loop compares files with files. The work runs in this order:
1. The I1 file format is agreed. That is the db-schema spec, and it is the runbook's output contract.
2. **I2 starts now.**
3. I1's **P2a** (format, linter, Austin backfill) lands when convenient, ideally before the runbook's first real publish, so the linter can check runbook output.
4. I1's **P1 + P2b** (migration and sync) wait until the loop has met the Austin bar and at least one non-Austin smoke run has produced output in the format (v1.2). Applying a migration is the step that costs the most to undo, and Q1/Q2 (where formal vs none_found falls, and whether there is a checklist per application type) are likely to change the format once non-Austin runs show how other jurisdictions are structured.

completion-officer is retired once I2 replaces it.

**D4. One shared generic baseline; jurisdiction-specific checklists stand alone.** [Will]
- There is **one generic baseline checklist** that belongs to no jurisdiction. Every jurisdiction with no formal intake process points at it. If three jurisdictions have none, all three point at the same baseline items.
- A jurisdiction **with** its own intake process has **its own items**. They never reference baseline items or another jurisdiction's items. That stays true even when they come out nearly identical: NYC might produce items that read like the baseline's, but they are separate rows. This also leaves Austin untouched.

**D5. A checklist owns its items, and a jurisdiction points at one checklist.** [proposed] Because the baseline is not a jurisdiction (D4), items belong to a **checklist**, which is either a jurisdiction's own or the baseline. Each jurisdiction records which checklist it uses, plus its **intake basis**:
- `formal`: its own checklist;
- `none_found`: the baseline;
- `inconclusive`: the baseline, flagged so it is easy to revisit;

together with the evidence and sources behind that basis.

Moving a jurisdiction off the baseline later means it gets its own checklist with new IDs. Its old reviews keep their baseline references, and nothing is migrated. Never work out a review's jurisdiction from an item ID prefix; go through review → project.

**D6. Stable short IDs.** [Will: slug prefix; proposed: the rest]
- An item ID is `{owner-slug}-{NNNN}`, for example `austin-0042`, `new-braunfels-0007` or `generic-0012`. The jurisdiction slug is used because `jurisdictions.short_name` holds display names, not codes, and 3-letter codes would collide across the ~2,000 Library jurisdictions.
- `NNNN` is a counter scoped to its owner. It encodes nothing.
- Group, display order and comment number are attributes of an item within a checklist version, not part of its ID.
- An edit keeps the ID and makes a new revision. A split creates new IDs that record what they came from.
- Every Austin item keeps its legacy ref (`cc-1:CC-1-01`), so existing reviews resolve.

**D7. For now the DB is a synced copy of bureau.** [Will] Bureau files stay authoritative. A merge to bureau main syncs them one way into the App DB, the same pattern as `sync-conventions.yml`. This lets the DB change shape without touching the Austin CC run. **Making the DB the source of truth is the end goal**, and it is a separate initiative with its own spec (`intake/db-source-of-truth`).

**D8. The App DB, with migrations in `~/noetic/cityhall`.** [Will] The current cityhall is `noetic-inc/cityhall`, the Next.js full-stack app. The old SvelteKit cityhall is already gone. Reviews, projects and `jurisdictions` (slug PK) all live in the App DB.

**D9. A new version only when the content changes.** [proposed] The sync hashes the item set and records a new checklist version only when the hash changes. This is the opposite of Inspector General's cache (§2.3), which has nine identical v2.7 versions.

**D10. Runbooks never write the DB; publishing goes through bureau.** [proposed] intake-prospecting publishes by opening a bureau PR, as cc-source-citations' `4.1-publish` does today. On merge, the sync (D7) carries it to the DB. This matches conductor2's rule that runbooks don't touch the DB, and gives every checklist a human-reviewed merge **in the standalone lane**. Inside prospector (I3) there are no human gates (Will, 2026-10-14; prospecting-runbook D18): the workstream's fresh-session audit is the review, and prospector's ship step merges the PR itself, as it does for every other workstream.

**D11. Loop the runbook against v2-trimmed, not v2.7.** [Will: "close enough", no exact match; proposed: the target and test set]
- v2-trimmed is the last Austin version shaped mostly by research rather than by talking with the city. Report overlap with v2.7 alongside it, but don't tune to it.
- **Score source discovery first:** did the run find the intake-specific documents (Austin's four, §2.2)? If it found them, the items mostly follow.
- **Austin is the only scored test case** (Will, v1.2): it has a formal process and a curated answer.
- New Braunfels and Cedar Park (or any non-Austin jurisdiction) run only as **unscored smoke runs**. They check scraping, capture and extraction on non-Austin sites, and they don't gate anything. Nobody can confirm the earlier runs there were good, so their artefacts are never treated as answers.

**D12. Citations are produced as items are extracted.** [Will: "ideally"; proposed: the method] The runbook records each item's quote and source snapshot when it extracts the item. It reuses cc-source-citations' capture step (immutable snapshots in `cc-source-snapshots`) and its citation shape. It does not run a locate pass afterwards. The Austin hard-coding in `labels.py` gets generalised.

**D13. City comments are supporting evidence, not a primary source.** [proposed] Most historic comments come from technical review, after intake has already accepted the submission. Their uses are:
- evidence that a requirement is actually enforced at intake;
- weighting by how often it is cited;
- finding "incomplete submittal" notices.

Comment-harvest should keep intake and routing notes, tagged, instead of discarding them as El Paso's recon plan does (Q9).

**D14. Build the standalone runbook so prospector can plug in later.** [proposed] Run on its own, intake-prospecting does its own web discovery. Inside prospector it reads the upstream outputs instead: `briefing/process.md`, `codes/*submittal*`, `approvals/`. Defining that input contract during I2 is what keeps I3 small: one workstream plus `intake_ready`.

---

## 4. The work, as sub-specs

### 4.1 I1: the intake checklist DB schema and bureau sync (`intake/db-schema`, this PR)

This defines the intake file format in bureau and the cityhall tables it syncs into:
- the sidecar that maps legacy refs to stable IDs;
- the `intake:` block in `conventions.yaml`;
- a home for the baseline outside `jurisdictions/`;
- the GitHub Action that runs the sync;
- the Austin v2.7 backfill.

Austin's CC run is not changed.

### 4.2 I2: the intake-prospecting runbook (`intake/prospecting-runbook`)

Port completion-officer's phases into a conductor2 runbook:
- **Discovery:** find and rank the intake-specific sources. This replaces Gates 0–1.
- **Classification:** decide the intake basis (D5).
- **Extraction:** extract items with their citations (D12).
- **Grouping and guides:** group the items using the jurisdiction's own structure where it has one, and write the guides (the `cc-N.md` prose the CC runbook consumes).
- **Publish:** open a bureau PR in the I1 format.

Then loop it against Austin, with non-Austin smoke runs (D11). The spec has to settle the scoring harness for items: matching an item against v2-trimmed needs an LLM judge, not string equality.

### 4.3 The generic baseline (`intake/baseline`)

A one-time checklist curated by hand, needed before New Braunfels (or any `none_found` jurisdiction) can run an intake review. A starting point is the items shared by Austin v2-trimmed, Cedar Park v1 and the four `plan-set-integrity-and-submission-completeness.md` review guides, for example: application form, sheet index, seal and signature, scale, north arrow, vicinity map, legal description, owner information. The baseline also needs its own guide prose. It can be built alongside I2.

### 4.4 I3: intake in the prospector flow (`intake/prospector-workstream`)

- An `intake` workstream in `bureau/runbooks/prospector/`, fed by the upstream outputs (D14). It is a wrapper, not a port: `prospector/review-guides/` already nests `runbooks/guide-training/` unchanged behind a `2-request` step that writes the nested runbook's request from `currency.json`, and the intake workstream does the same with intake-prospecting (its spec, §6: worktree, request, nested run, snapshot upload, disposition, mergein, plus the registration in `lib/outer.ts`, `bin/resolve.py`, `lib/env.json` and the ship inputs). The runbook writes into a bureau worktree from its first session so that the wrapper copies nothing.
- `intake` in `workstream_status` (stamped by `9-record` from `WORK_TYPE`), and `intake_ready` in `metro_ahj_coverage`, which is a migration in `dsd/library/tooling/supabase/migrations/` plus the dashboard's workstream list in `dsd/web/lib/prospector/types.ts`.
- No human gates once wrapped (Will, 2026-10-14; prospecting-runbook D18): the audit is the review, and the checklist merges and syncs on prospector's autonomous path. One decision still Will's (prospecting-runbook Q7): whether intake runs on `sir` runs or only `review` runs.
- Comment-harvest stops discarding intake notes (D13).

### 4.5 Later: the DB as source of truth, and the rename

- **Source of truth:** reverse D7. Items are edited in the app, and the CC runbook reads a checklist exported from the DB. This needs an answer to where the guide prose lives. `jurisdiction_departments`' columns (`origin` bureau|app, `verified`, `bureau_commit`) show one way for rows created in the app to sit beside synced rows during the transition.
- **Rename:** the `completeness-check/` paths, `review_type`, `output_schema` and the CC runbook name. Each touches the 60 existing CC reviews and cityhall's CC adapter.

---

## 5. Things to think about

- **Intake is per application type, not per city.** Austin's checklist is for the consolidated site plan. In New Braunfels the site plan sits inside the commercial building permit. A jurisdiction's "intake checklist" is really a checklist for the application type that carries the site plan (Q2).
- **The guides are more than their items.** The CC runbook's review agents read Key Terms, Documents to Review and Validation Methodology, not just the table. Moving items into the DB (I1) does not move the prose. Moving the prose is the hard part of the source-of-truth flip.
- **Manual edits to Austin will keep coming.** Until the flip, they keep landing as bureau PRs, and the sidecar has to keep up with them. A mapping that falls behind its guides is the drift this initiative exists to stop.
- **The two comment-numbering maps are two orderings, not two identities.** In D6 terms, comment number becomes a per-version attribute. The "pape-dawson" ordering is a second ordering that one firm's reviews depend on (Q8).

---

## 6. Open questions

- **Q1. Where is the line between `formal` and `none_found`?** New Braunfels has no named completeness check, but it does publish a submittal checklist used for informal screening (§2.4). Proposed rule: any published intake, submittal or application checklist for the application type that carries the site plan → `formal`, and the jurisdiction gets its own checklist; nothing like that found → `none_found` and the baseline; research inconclusive → `inconclusive` and the baseline. Needs Will's call.
- **Q2. One intake checklist per jurisdiction, or one per application type?** Start with one, recording which application type it covers? Or key checklists by (jurisdiction, application type) from day one?
- **Q3. Do baseline jurisdictions follow the latest baseline or pin a version?** Proposed: follow the latest, since sharing implies it. History stays safe because every review records the checklist version it ran against.
- **Q4. When does the rename happen,** and is it tied to the source-of-truth flip?
- **Q5. How are baseline items grouped,** and how are groups chosen for a jurisdiction whose own documents don't suggest any?
- **Q6. What happens to Inspector General's `bureau_checklist_version` cache for CC?** Leave it, or point it at the new tables (Inspector General's eval reads it)?
- **Q7. When is completion-officer retired?** Proposed: once I2's Austin run passes the D11 bar, archive the repo and remove `sync-to-bureau.sh`.
- **Q8. Do both comment numberings survive?** Is the Pape-Dawson ordering a real per-customer need, or a leftover?
- **Q9. Comment-harvest and intake notes:** keep them, tagged, in `historic_comments.raw_metadata`, or in a separate table?

---

## 7. Out of scope

- **Making the CC runbook itself generic** (removing the Austin defaults in `cc.py`, building non-Austin answer keys). That is needed before a second jurisdiction's intake review ships, but it is its own spec.
- **Formal-review (`review`) checklists.** They have their own pipeline (review-guide training) and their own IDs.
- **CRC.** Not intake.
- **Customer-facing UI for checklists** beyond the existing `/intake-checklists/[jurisdiction]` pages.

---

## Appendix A: evidence pointers

- completion-officer: `CLAUDE.md`, `.claude/agents/research-director.md`, `final-checklists/`, `research/austin/v2-trimmed/final/removal-audit.md`, `research/new-braunfels/v1/research-log.md`, `tools/sync-to-bureau.sh`
- bureau:
  - `jurisdictions/austin/completeness-check/` (`CURRENT_VERSION`, `v2.7-trimmed/`, `requirement-source-urls.tsv`, `sources/manifest.json`)
  - `jurisdictions/cedar-park/completeness-check/v1/`
  - `runbooks/completeness-check/` (`scripts/cc.py`, `scripts/lib/guide-items.ts`, `steps/1.4-resolve`)
  - `runbooks/cc-source-citations/` (`scripts/schemas.ts`, `scripts/lib/labels.py`)
  - `runbooks/lib/review_comments_v2.py`, `runbooks/lib/review_amend.py`
  - `runbooks/prospector/` (`bin/resolve.py`)
  - `.github/workflows/sync-conventions.yml`, `.github/workflows/sync-cc-sources.yml`
  - `tooling/src/cli/sync-conventions.ts`
- cityhall: `supabase/migrations/20260724000000_jurisdiction_conventions.sql`, `src/app/(app)/intake-checklists/`
- inspector-general: `src/lib/data/bureau-checklist-store.ts`
- App DB `mgxqsrjutswbciyrltwd`: `bureau_checklist_version` (CC: 41 rows), `reviews` (60 CC), `review_checklist_comment_map` (47,826)
- Library DB `jkbuvkwnrrvunqgrkeol`: `historic_comments` (3,437,029 rows, 32 jurisdictions), view `metro_ahj_coverage`
- Related specs:
  - winston#185 (jurisdiction conventions)
  - winston#290/#291 (CC → runbook v2 port)
  - winston#297/#298 (CC checklist source UI / cc-source-citations)
  - winston#305/#306 (CC review amend)
