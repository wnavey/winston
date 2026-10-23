# Completeness Check Code Hygiene: how a CC review is produced and shown, and where to clean it up

**ID:** ARCH-7  
**Kind:** architecture
**Status:** living
**Version:** 1.1
**Date:** 2026-10-23
**Repos touched:** none yet. This is the map of the current system and the target shape. Slices of it ship as feature specs that amend this one.
**Repos eventually touched:** `bureau` (the CC runbook's 2.8-format, 2.9-comments and lane B of `publish_review.py`; amend), `cityhall-new` (the CC adapter, the checklist landing, the CC PDF, three migrations), `inspector-general` (its comment map, only if it stops reading `sourceFindings`)
**Repos NOT touched:** `conductor` and `workflows/completeness-check` (frozen legacy lane; the runbook shells to its scripts and that is the thing to retire, not edit), `substation` (archived), `dsd` (the RDS renderer is fine as is)
**Verified:** 2026-10-23 against `bureau@f191145ec0`, `cityhall-new@dc5a87d`, prod `mgxqsrjutswbciyrltwd`
**Amended by:** none yet

> **Revision note v1.1 (2026-10-23, Will):** the new schema label is `2026-10-completeness-check` (labels date the shape's design, as `2026-03`, `2026-08` and `2026-09` do). D1 is settled after a pass over what formal review writes (§2.7): `item_id` is **nullable with a CHECK scoped to the new label**, so the constraint governs only rows published from S4 on and never depends on the backfill; the backfill is best-effort (554 rows on the two 2026-03-27 UFCU reviews have no ref at all) and readers keep a one-line fallback to the JSON ref. Formal review has no item: its `ref` is a per-report prose handle and its `sources` are run-scoped finding ids, so its rows stay null by design; CRC may adopt the column under its own label.
**Parent:** `workspaces/intake/north-star/NORTH-STAR-SPEC.md` (ARCH-6). Sibling of `workspaces/intake/db-schema/DESIGN-SPEC.md` (FEAT-66), whose §6 named a `review-linkage` sub-spec; this spec is that design, widened to the whole review side.

Paths are relative to the repo named. `CC` = `bureau/runbooks/completeness-check`, `LEG` = `bureau/workflows/completeness-check/scripts`, `LIB` = `bureau/runbooks/lib`. Prod numbers are from the three projects Will named, read 2026-10-23: **2008 San Antonio St** (`7746ac2f`), **WhiteWater Express Car Wash** (`7a697ef1`), **Lamar + Collier** (`23301a8a`).

---

## 1. What this spec is

Three systems cooperate to show a customer one completeness-check comment: the bureau checklist files and their side TSVs, the CC runbook that turns them into a `review-comments.json` envelope, and cityhall, which reads that envelope out of two tables and draws a checklist. Each was built in a hurry on top of the one before it, and the seams show: the item's identity lives in a JSON string, the group is a slugified heading, the title is written by an agent, the comment number changes from run to run, every comment is stored twice, and the app carries adapters for four review formats nothing produces anymore.

This document does three things:

1. **§2 says how it works today,** with the source of every visible field. This is the part that stays fresh.
2. **§3 lists the hygiene findings,** H1 to H14, each with its evidence and what it blocks.
3. **§4 to §6 say where it should end up:** a review is a set of verdicts keyed by a stable item id, presentation resolves from the checklist at read time, the app has one read model for the page and the PDF, and the two review UIs stay separate but share their skeleton. §7 ranks the slices.

It is not a build plan. Each slice becomes a feature spec with its own seams and PRs, and that spec adds itself to **Amended by** above.

### 1.1 The goals

- **G1. An item is a row you can join on.** `review_comments` carries the checklist item id in a typed column, and nothing has to parse `output_json` to find it.
- **G2. Presentation is data, not output.** Title, group, group order, item order and comment number come from the checklist the review ran against, resolved when the page is read, so changing any of them is a checklist edit, not a run.
- **G3. One copy of each comment.** The review row describes the review; the comment rows describe the comments. Nothing is stored in both.
- **G4. One read model.** The checklist landing, the issue panel, the sheets screen, search and the PDF read a CC review through one adapter.
- **G5. The app carries only formats it still produces,** plus a frozen path for archived ones.
- **G6. Bifurcated UIs, shared skeleton.** Formal review and CC keep their own pages, but the pieces that are the same (sections on the review row, a per-comment identifier, SQL counts, typed references) are the same code.

---

## 2. How it works today

Facts in this section hold at the **Verified** line's commits and date. A slice that changes a subsection refreshes that subsection and the line.

### 2.1 The pipeline, from guide file to row

The runbook is a feature-parity port of the legacy workflow (`CC/runbook.yaml:1-9`): its script steps shell to `LEG/*` unchanged through `CC/scripts/cc.py:111-116`, "so the intermediate files, the review-comments.json envelope and the DB rows are the legacy ones."

| Step | Kind | What it does to the output | Legacy script |
|---|---|---|---|
| 1.4-resolve | script | copies the whole guide dir into the run, TSVs and `source-citations.json` included (`cc.py:374-377`); hydrates figures | none |
| 2.1-review | agent × guide × run | one `findings.json` per cell; every ID must appear, in any order (`steps/2.1-review/steps/review/contract.test.ts:61-70`) | n/a |
| 2.2-consolidate | script | votes across runs; **item order = run 1's emit order** (`LEG/cross-run-consolidate-cc.ts:323-340`) | `cross-run-consolidate-cc.ts` |
| 2.3-forced-outcomes | script + LLM | patches status from the request's TSV | `apply-forced-outcomes.ts` |
| 2.4 to 2.6 | script, agent, script | uncertain explanations | three scripts |
| 2.7-enrich | script | joins findings to guide rows by position-parsed table (`LEG/checklist-policy.ts:44-116`); **section title = H1 after `CC-N:`** (`LEG/enrich-findings.ts:110-113`); **section order = digits in the filename** (`:141-147`) | `enrich-findings.ts` |
| 2.8-format | **agent** | writes `rephrased-items.json`: the title per item, looked up in `cc-item-title-mappings.tsv`, rephrased when missing (`steps/2.8-format/prompt.md:28-47`) | n/a |
| 2.9-comments | script | builds `review-comments.json`; comment number from the request's map or sequential (`LEG/build-review-comments.ts:109-128`) | `build-review-comments.ts` |
| 2.12 / 2.13 | agent, script | markings folded into a copy of the envelope | `annotate-merge.ts` |
| 3.1-publish | script | lane B of `LIB/publish_review_cli.py`: one `reviews` row, one bulk `review_comments` insert | n/a |

### 2.2 The envelope and the rows

`review-comments.json` is `{reviewData: {metadata, sections: [{sectionNumber, sectionName, comments: [...]}]}}` (`LEG/build-review-comments.ts:418-441`), validated by `LIB/review_comments_v2.py:91-160`.

**The review row** gets the whole `reviewData` plus `sheet_map` as `output_json` (`LIB/publish_review.py:1977-1979`): keys `metadata`, `sections`, `sheet_map`. The sections carry full copies of every comment.

**Each comment row** gets exactly three fields (`LIB/publish_review.py:1963-1971`): `comment_number`, `output_schema = '2026-03-completeness-check'`, and `output_json = {**comment, section: slugify(sectionName)}`. The slug rule is the old `review-saver.ts` one, kept "because City Hall regroups comments into sections by this string" (`:1885-1897`, `:1934-1940`). Lane B never writes `sheet_references`, `document_references`, `source_findings` or `agent_trace`, so those typed columns sit at their defaults on every runbook-era row.

Per-comment keys, all always present unless bracketed (`build-review-comments.ts:317-401`): `commentNumber, title, status, [tentativeStatus], [voteBreakdown], [uncertainExplanation], [agentTraceUncertainExplanation], comment, issue, citation, citationType, agentTrace, sheets, applicableArea, resolution, resolutionDetails, confidence, runCount, totalRuns, isCrossDepartment, crossDepartmentNote, isReviewerAttention, reviewerAttentionNote, sheetReferences, documentReferences, sourceFindings[{ref, confidence, runCount, totalRuns, perRunFindings[...]}]`, plus `annotations` and `annotation_disposition` from 2.13 and `section` from the publisher.

### 2.3 Where each thing a customer sees comes from

| On the page | Source of truth | Set by | Stored at | Read by cityhall at |
|---|---|---|---|---|
| **Item identity** | guide table `ID` cell + file stem | 2.1 agent emits `checklistItemId`; 2.9 writes `ref = "{stem}:{id}"` | `review_comments.output_json.sourceFindings[0].ref` only | `adapters/checklist.ts:309-315` (first ref matching `/^[^\s:/]+:[^\s/]+$/`) for the Source link |
| **Title** | `cc-item-title-mappings.tsv` (189 rows, one per item since bureau#2196 deduped the checklist to 189 on 2026-10-23) else the guide's `Item` cell | the **2.8 agent** reads the TSV and writes `rephrased-items.json`; 2.9 copies it (`build-review-comments.ts:240`) | `output_json.title` | `checklist.ts:349` |
| **Group name** | guide H1 after `CC-N:` | 2.7 `extractTitle`; 2.9 copies it into `sectionName` and every comment's `applicableArea` and every run's `applicableAreas` | `reviews.output_json.sections[].sectionName`; `output_json.applicableArea` | `adapters/sections.ts:35` (sectionName only; `applicableArea` is never a title source) |
| **Group identity** | none | publisher slugifies the name | `output_json.section` | `sections.ts:45` groups rows by this string |
| **Group order** | digits in the guide filename | 2.7 sorts findings files; 2.9 numbers `sectionNumber = idx+1` | `sections[].sectionNumber` | `sections.ts:36, 64`; PDF by array index |
| **Item order in a group** | none pinned | 2.2 keeps run 1's emit order; 2.9 keeps it | `comment_number` ascending | `rows.ts:58` `ORDER BY comment_number`, no re-sort |
| **Comment number** | the request's `commentNumberingMap`, else sequential | 2.9 (`:109-128`, `:304-315`); the runbook has no default (`cc.py:169`) | `comment_number` and `output_json.commentNumber` | landing prints the column; PDF prints `section.relative` (`2.1`, `cc-report-logic.ts:272-277`) |
| **Verdict** | votes across runs, forced outcomes, then a human override | 2.2, 2.3; `set_verdict_override` RPC | `output_json.status`; `comment_triage.verdict_override` | `rows.ts:130-144` (`verdict_override ?? status` after the cutover) |
| **Agent trace, votes** | 2.1 per-run findings | 2.9 copies run 1's observation/reasoning to `agentTrace`, every run to `sourceFindings[0].perRunFindings` | `output_json` | `agent-trace.ts:27-70`; promote (`promote-run.ts`) |
| **Citation** | guide `Requirement Source` / `Source Type` cells | 2.7, 2.9 | `output_json.citation`, `citationType` | `citation` only (`checklist.ts:344`) |
| **Sheet and document refs** | 2.1 agent | 2.9; `doc_pages.py` adds `pageNumber` | `output_json.sheetReferences / documentReferences`; typed columns empty | JSON fallback (`checklist.ts:360-364`) |
| **Markings** | 2.12 agent | 2.13 | `output_json.annotations`, `annotation_disposition` | `adapters/annotations.ts` |

Three copies of the group titles exist in bureau before a run starts: the guide H1s, `source-citations.json`'s `groups` block, and after the run the envelope. The checklist's own `source-citations.json` and `citation-overrides.json` ride into every run and are read by nothing in the runbook.

### 2.4 How cityhall reads it

- **One predicate picks the CC page:** `review_type === 'completeness_check' && output_schema === '2026-03-completeness-check'` (`src/lib/reviews/registry.ts:178-180`). True → the one-page checklist landing (`components/reviews/checklist-landing.tsx`), groups folded in place, items opened in the side panel by `?comment=<number>`. False → `DisciplineList` plus `OverallResults`.
- **Two adapters over the same rows:** `adaptCompletenessCheck` drops N/A and feeds the panel, sheets and search; `adaptChecklist` keeps N/A and feeds the landing (`adapters/checklist.ts:137-145`, `:200-220`). Both regroup flat rows by `output_json.section` and order groups by `reviews.output_json.sections[].sectionNumber` (`adapters/sections.ts:23-65`).
- **The select is the same on every screen:** `id, comment_number, output_schema, output_json, sheet_references, comment_triage(verdict_override, triage_status)` ordered by `comment_number` (`rows.ts:49-58`).
- **Fields read:** `status, title, comment, resolution, section, applicableArea (as location), citation, sourceFindings[].ref, sourceFindings[].perRunFindings[], agentTrace, uncertainExplanation, agentTraceUncertainExplanation, tentativeStatus, voteBreakdown, promotion, sheetReferences, documentReferences, annotations, annotation_disposition.sheets`.
- **Fields ignored by every reader:** `issue, sheets, commentNumber (JSON), citationType, confidence, runCount, totalRuns, isCrossDepartment, crossDepartmentNote, isReviewerAttention, reviewerAttentionNote, resolutionDetails, annotation_disposition.documents`.
- **The section page still exists for CC** (`review/[reviewId]/[discipline]/page.tsx`), reachable only by typing it or via an old link (`old-link.ts`), and it draws the formal-review filter row (`discipline-page.tsx:50-204`).
- **The PDF parses on its own.** `src/pdf/cc-report-data.ts` has its own `CcReviewComment`/`CcSection` types, its own `buildSectionSlugs` ("mirrors cityhall's slugify", `:59-84`), `normalizeStatus` coercing unknown to `fail` (`:86-88`) and `parseSheetReferences` (`cc-report-logic.ts:24-46`). It shares one helper and one constant with the app.
- **Counts are computed on read.** `reviews.metadata` holds pre-triage counts the PDF says are wrong (`cc-report-data.ts:250-252`); the landing builds the whole view to count, and fetches the prior review's items for the delta (`review-landing.tsx:54-82`). Formal review counts in SQL.

### 2.5 What the app can write

- `comment_triage`: `setTriage` and the `set_verdict_override` RPC.
- `review_comments`: **one writer**, `promoteRunVote`, which rewrites `output_json`, `sheet_references` and `document_references` for one comment (`lib/reviews/promote-run-vote.ts:67-76`).
- `reviews`: `release_review` flips `is_current` and `released_at`.
- **Nothing can change a title, a section, an item's order, a section's title or section order.** All five are bureau-written at publish and bureau-rewritten by amend, which still needs 2.1 to 2.9 to run (`LIB/review_amend.py`, FEAT-64).

### 2.6 The three projects in prod

Prod holds 64 CC reviews, all `2026-03-completeness-check`, 13,205 comment rows, none using `prior_comment_id`. The stored reviews have 192 comments because they ran before bureau#2196 deduplicated the checklist to 189 items (2026-10-23); the next run will have 189.

| Project | CC reviews | Current | What they show |
|---|---|---|---|
| 2008 San Antonio St | 10, all on one submission version, 2026-10-01 to 10-20 | `0bc96434` (10-09, released, 1 amendment, 23 triage rows, 6 overrides) | 192 comments in 14 sections; review blob **415 KB**, comment rows **513 KB**; `sheet_references` filled on 1 row, `agent_trace` on 0; 30 comments carry markings |
| WhiteWater Express Car Wash | 6 on one version, 10-05 to 10-22 | `28b83857` (10-22) | 545 KB blob + 639 KB rows; 47 marked. **`cc-13:AW-05` is comment 41 in the 10-12 run (Pape-Dawson map) and comment 75 in the 10-22 run (sequential)** |
| Lamar + Collier | 32 across 4 versions, 2026-04-20 to 10-01, checklists v2.1 through v2.7-trimmed (151 to 194 items) | three, one per version | the April and May rows have `agent_trace` filled (lane A era); comment maps per run; the only project with map-numbered reviews on every current row |

The comment copies inside `reviews.output_json.sections[]` differ from the rows by exactly one key: the row has `section`, the copy does not. Human triage vocabulary across CC: `to-fix` 54, `incorrect` 42, `na` 32 (all pre-cutover words), `new` 56, `formal-note` 3; verdict overrides 23.

### 2.7 Formal review, for comparison

Lane A (`bureau/runbooks/review/steps/4.1-publish`) publishes through the same CLI but a different shape (`LIB/publish_review.py:580-700`): a **declared section table** of eleven fixed disciplines (`:60-73`), each `{slug, label, number, code}` on the review row with no comment copies; a **`ref`** handle per comment; typed **`sheet_references`** and **`source_findings`** written (`:693-696`, `:1856`); a schema label picked from content (`2026-08-plan-review`, `2026-08-dual-view`, `2026-09-annotated`, `:383-413`); writes through an RPC per schema. In cityhall the August adapter reads `sheet_references` first, counts in SQL (`august_review_discipline_counts`), shows an `identifier` instead of a number, has `kind`/`certainty` badges, `withdrawn[]`, markdown prose and a stored PDF. Neither lane stores a checklist item id in a typed column, and formal review has none to store: `ref` is a prose handle the agent mints per report (`zoning-west-alley-improvements`; Take 5's three annotated runs each carry a different set) and `sources` are run-scoped finding ids from 3.1-guides and 3.2-disciplines (`ZLU-18`, `EL-1`; 2,632 over 2,264 comments, one to five per comment), which the section contract only requires to be findings the synthesis kept (`steps/3.5-comments/steps/section/contract.test.ts:80-101`). The review guides do carry stable topic ids (`ELC-03`, `contract_prefix` per guide) but nothing attaches one to a finding or comment in a typed field. The conductor-era `legacy` formal reviews (120, 30,254 rows) used the CC shape with grouping item refs (`el-9:EL-9.15`) copied into typed `source_findings`, which is why that column holds 30,010 rows. CRC (15 reviews, 3,592 rows) has a per-item identity like CC's: `sourceFindings[0].ref = "crc-CA:CA-06.2"` and `crc.atomicItemId`.

---

## 3. Hygiene findings

Each finding: what is wrong, the evidence, what it costs or blocks. Ordered by how much they block §4.

**H1. The item id is a string inside JSON.** `sourceFindings[0].ref` is the only place a comment says which checklist item it is. Amend matches on it (`review_amend.py:39-56`), cc-compare keys on it (`cc-compare/scripts/compare.ts:15-16`), Inspector General copies it into `review_checklist_comment_map.checklist_item_id` (prod: `comment_ref = 'comment-N'`), cityhall regexes it for the Source link. No join, no index, no constraint. Blocks: per-item outcome counts across reviews, FEAT-66's review linkage, any UI keyed by item.

**H2. Groups have no identity; the slug is the heading.** `section = slugify(H1)`. Renaming a group changes the slug on every future review and nothing links the old slug to the new. The slug is recomputed independently in the publisher (`publish_review.py:1885`), the app (`sections.ts:105-110`) and the PDF (`cc-report-data.ts:67-84`), with a comment on each that it must match the others. Blocks: FEAT-66's live `intake_groups`; moving an item between groups without breaking the app's regroup.

**H3. Every comment is stored twice.** 192 comment copies inside `reviews.output_json.sections[]` next to 192 rows, 415 KB beside 513 KB on one review. The app reads the review-level copy only for `sectionName` and `sectionNumber`. Amend rewrites both (`publish_review_cli.py:557-561`); promote rewrites only the row, so the two drift after a promotion. Costs: every landing load pulls a 400 to 550 KB row it uses 1 KB of; two sources of truth for a comment.

**H4. The title is an agent artifact.** 2.8-format is an agent that reads the TSV and writes every title, authored ones verbatim and missing ones rephrased (`prompt.md:39-43`). The deterministic 2.9 reads only the agent's file. Since bureau#2196 (2026-10-23) the TSV covers every one of the 189 items, so the rephrase path is dead code on Austin and the agent is in the title path for nothing. A title fix is a bureau PR plus a full run (or an amend, which still runs 2.1 to 2.9). Blocks: G2; anyone editing titles in minutes.

**H5. Comment numbers are not stable across runs of one project.** `commentNumberingMap` is a per-request option with no default; two of the three projects' current reviews are sequential, WhiteWater's previous run was map-numbered, and AW-05 moved from 41 to 75 between them. The customer's handle for an item changes between runs. The PDF already prints a different number (`2.1` relative) than the page (`75` absolute).

**H6. Item order within a group is the agent's emit order in run 1.** Not the table order, not pinned by any contract (`cross-run-consolidate-cc.ts:323-340`; the 2.1 contract requires presence only). Two runs on the same checklist can order a group differently, and with sequential numbering that reorders the numbers too.

**H7. The envelope carries legacy constants and duplicates.** Always `issue: ''`, `isCrossDepartment: false`, `crossDepartmentNote: null`, `isReviewerAttention: false`, `reviewerAttentionNote: null` (`build-review-comments.ts:347-361`); `sheets` is a text rendering of `sheetReferences`; `confidence/runCount/totalRuns` appear at the comment and again inside `sourceFindings[0]`; `applicableArea` is copied onto every comment and every per-run finding; `codeCitations` per run is the same citation repeated. Cityhall reads none of the constants. Costs: a schema nobody can describe from its fields; validators that check fields nothing uses.

**H8. The typed columns are dead on lane B.** `sheet_references`, `document_references`, `source_findings`, `agent_trace` were lane A's and are `[]`/`NULL` on every runbook-published CC row; `prior_comment_id` is unused on all 13,205. Cityhall reads `sheet_references` first then falls back to JSON, so the fallback is the live path. The one filled row on `0bc96434` is the promoted comment: `promoteRunVote` writes the column (`promote-run-vote.ts:73`), so a column is filled exactly when a human promoted a run. Across all CC rows 1,234 have it filled, almost all from the lane A era. A column that is sometimes filled is worse than one that never is.

**H9. The app carries four formats it no longer produces.** `legacy` (142 reviews, last 2026-04-15), `2026-04-simplified` (168, last 07-27), the `unclear` status word (removed from the agent contract), and the pre-cutover triage fold (`incorrect`/`na` → N/A for reviews completed before 2026-07-07T21:00Z, `rows.ts:130-144`, mirrored in the PDF `cc-report-logic.ts:181-196`). Each has an adapter, tests and a branch in counts. `old-link.ts` translates three retired URL shapes because Inspector General still mints one of them.

**H10. The CC section page is a formal-review page in disguise.** CC's home is the one-page landing, but `[discipline]/page.tsx` still renders for CC, with severity chips, a Kind menu that is always empty for CC, and the five-status filter. Nothing links to it except old links.

**H11. The PDF has its own parser.** `cc-report-data.ts` and `cc-report-logic.ts` re-implement section slugging, status normalisation, sheet-reference parsing and effective-verdict logic beside the app adapters, sharing one helper and one constant. A field added to the row has to be read twice.

**H12. Counts are computed by building the page.** `reviews.metadata` counts are pre-triage and ignored; the landing adapts every row to count, then fetches the prior review to show the delta. Formal review does this in one RPC.

**H13. Three steps in the runbook exist to carry files the run does not use.** 1.4-resolve copies `source-citations.json`, `citation-overrides.json` and both numbering TSVs into every run; only the TSV the request names is read. The checklist dir is the run's input contract, but nothing says which files are.

**H14. The legacy workflow is still the implementation.** Every script step from 2.2 to 2.10, and 2.13, shells to `workflows/completeness-check/scripts/*` (`cc.py:111-116`); only 1.4-resolve, 2.11, 3.1 and 3.2 are native to the runbook. The runbook can't change the envelope without editing the frozen lane, and the frozen lane's tests pin the legacy shape. FEAT-60 chose parity on purpose; the parity test has since passed, so the reason to keep the shim is gone.

---

## 4. The target shape

### 4.1 Principles

**P1. A review is verdicts keyed by item.** What a run produces that is *about this submission* is: per item, a verdict, the evidence (observation, reasoning, votes, refs, markings) and the prose (comment, resolution). Everything else on today's comment is *about the checklist* and is resolved from it.

**P2. Presentation resolves at read time against the review's pinned checklist version.** Title, group, group title, group order, item order and comment number are a function of `(checklist version, item id)`, overlaid by FEAT-66 D21's live investments (`intake_groups` today). A review pins a version (`intakeVersion`, FEAT-66 D5) and **follows the latest PATCH of that MINOR**: FEAT-66 D14, as amended by this spec, defines PATCH as the changes that do not alter what an item checks (titles, group placement and order, prose), so re-reading them is safe by construction. A MINOR or MAJOR bump never retro-applies. Two consequences this spec decides rather than leaves open: **renumbering is MINOR, not PATCH** (FEAT-66 D14 lists comment numbers under PATCH and its Q4 defaults to PATCH; FEAT-66 closes Q4 as MINOR in its next revision, recorded there: a comment number is customer-visible, so a MINOR's numbering never moves, and D7's stability holds). **Numbers come from the pinned MINOR's replica, never from the live overlay:** a live `intake_groups` change (FEAT-66 §2.4, which has no version) re-resolves display grouping and order on every review but assigns no new `comment_number` to a new run of the same MINOR; and **amend's gate becomes FEAT-66 D18's content hash over the MINOR-affecting columns**, not the guide tree hash it compares today (`review_amend.py:87-92`), so a PATCH does not make every review on the previous PATCH un-amendable. D18 is not built yet; until it is, a PATCH blocks amend, which is today's behaviour.

**P3. The published snapshot is kept, as a fallback and an audit.** The row keeps the title, section slug and number it was published with. The app shows the resolved value; when the two differ on a released review the issue panel shows the published value to staff beside it (the "as published" row, D9). Reviews whose version has no replica row (everything before FEAT-66 P2b syncs) show the snapshot, which is what they show today.

**P6. Released reviews resolve live too, and that is a decision.** A verdict override already changes a released review and its PDF the moment it is written (the PDF renders with `no-store`, `pdf/[kind]/route.ts:130-132`); resolved titles and groups are the same class of change. The record of what a customer saw is the row's snapshot, the pinned version and `released_at`. The alternative, freezing presentation at release and restamping on re-release (§8, alternative 3), was considered and rejected because it reintroduces a run per edit. What a PATCH may change is bounded by FEAT-66 D14's definition; an edit that changes what an item checks is MINOR and never retro-applies. The gap this accepts: an override is a per-review act with a note and an RPC audit, a PATCH is a bureau PR that touches every review on the MINOR with no per-review record, so the snapshot says what was published, not what a customer saw on a given day between PATCHes. The bureau PR and the sync log are that record.

**P4. The comment number is a handle, not a position.** It is assigned once at publish from the checklist's `comment_number` for that version and never changes for that row, because customers write it into notes and appeals. Display order may differ from number order, as it already does under the landing's filters.

**P5. One read model, two UIs.** A `ccReadModel(reviewId)` in cityhall produces the groups, items, verdicts, refs, markings and counts once, from rows plus the checklist replica, and the landing, panel, sheets screen, search and PDF consume it. Formal review keeps its own read model; the two share the review-row section table, the typed reference columns and the counting RPC shape.

### 4.2 Decisions

Every decision carries a status tag. All fifteen are `proposed` in v1; the feature spec that ships one changes its tag to `shipped by FEAT-N` and adds itself to **Amended by**, so a reader can tell which half of this document is current.

**D1. `review_comments` gains `item_id` and `group_id` typed columns, nullable, with a CHECK scoped to the new label.** [proposed; shape settled with Will 2026-10-23] `item_id text NULL` holds the stable id (`AUS_TX-42` once FEAT-66 P2a lands; until then the composite ref `cc-1:CC-1-01`). `group_id text NULL` holds the group the run placed it in (`AUS_TX-G1`). Both are null on formal review, which has no item (§2.7), and may be filled by CRC under its own label later. The constraint is

```sql
alter table review_comments add column item_id text null, add column group_id text null;
create unique index review_comments_review_item on review_comments (review_id, item_id) where item_id is not null;
alter table review_comments add constraint review_comments_item_id_required
  check (output_schema <> '2026-10-completeness-check' or item_id is not null);
```

so it governs only rows published from S4 on and never depends on the backfill. No row carries the new label today, which makes the label the date guard; an explicit `created_at` guard was considered and dropped because the label does the same job without a magic date. **The backfill is best-effort:** one idempotent statement copies `output_json.sourceFindings[0].ref` into `item_id` on the 12,651 CC rows that have one; the 554 rows on the two 2026-03-27 UFCU reviews (checklist v1, superseded) have `sourceFindings: []` and stay null. No review has two rows with the same ref, so the partial unique index holds from the start. A second backfill rewrites composite refs to stable ids through `intake-ids.tsv` when FEAT-66 P2a lands. Until nulls are gone the read model resolves an item as `coalesce(item_id, output_json->'sourceFindings'->0->>'ref')`, one expression in one place. Lane B writes both columns on every new row and amend's upsert carries them; promote leaves untouched columns alone. This is FEAT-66 §6's "2.9-comments adding each finding's itemId", landed in the DB rather than the JSON.

**D2. The review row describes the review; comments live only in rows.** [proposed] `reviews.output_json` becomes `{metadata, sections: [{group_id, slug, label, number}], sheet_map}` on the new schema, the formal-review shape (`publish_review.py:60-73`) with a `group_id` added. The comment copies go. Expand → migrate → contract: cityhall's `sections.ts` reads `sections[].group_id` when present and the old `sectionName` path otherwise; the publisher stops writing copies on the new schema; a one-time script strips copies from the 64 existing review rows after the app no longer reads them. Amend's `reviews.output_json` PATCH shrinks to metadata and sections (FEAT-64 D8 step 3). **Inspector General reads the copies:** its DB fallback loader reads `reviews.output_json` and `review_comments.output_json` (`inspector-general/src/lib/ingest/supabase-loader.ts:409-415`) and `audit-scores.svelte.ts:13` documents CC as comments nested under `sections`; its primary path is the storage envelope, which S4 keeps writing in full. S4 therefore ships an IG PR that reads rows, and adds the new label to IG's pinned schema ids (`audit-scores.svelte.ts:13-20`, pinned across four repos). The storage envelope `review-comments.json` keeps today's per-comment shape for one generation so IG's auditors, which read it, are not cut over in the same slice (Q9).

**D3. A new schema label, `2026-10-completeness-check`, with a trimmed comment.** [proposed] The per-comment `output_json` keeps: `title, comment, resolution, status, tentativeStatus, uncertainExplanation, agentTraceUncertainExplanation, voteBreakdown, citation, runs[]` (`title` and `citation` are checklist data kept as the published snapshot; both resolve from the checklist after S7, D9) (today's `sourceFindings[0].perRunFindings`, renamed because a comment has exactly one source finding), `annotations, annotation_disposition, promotion`, and the published snapshot `section, commentNumber`. It drops `issue, sheets, isCrossDepartment, crossDepartmentNote, isReviewerAttention, reviewerAttentionNote, resolutionDetails, citationType, applicableArea, confidence, runCount, totalRuns, sourceFindings` (replaced by `item_id` + `runs`), `agentTrace` (replaced by `runs[0]`'s observation and reasoning, which it was a copy of), and per-run `applicableAreas` and `codeCitations`. `applicableArea` goes from the CC envelope only: CRC's PDFs read it as their section source (`crv-report-data.ts:275`) and CRC is out of scope. The typed columns `sheet_references` and `document_references` are written (D4). The registry gains the label beside the old one; `2026-03-completeness-check` stays readable forever and is never written again.

**D4. Lane B writes the typed columns it has.** [proposed] `sheet_references`, `document_references`, `item_id`, `group_id`. `source_findings` and `agent_trace` are not revived: `runs[]` in `output_json` is the trace, and the formal-review meaning of `source_findings` (library sources) does not apply to CC. Cityhall's JSON fallback for `sheetReferences` is deleted once every CC row has the column filled (backfill from JSON, one statement).

**D5. Titles are deterministic.** [proposed] 2.9-comments reads the title from the checklist (the TSV today, the replica's `title` after FEAT-66 P2b) and writes it; 2.8-format stops producing titles and keeps only the reports it also writes. A missing title is a lint failure in bureau (FEAT-66 D12 rule 2 extended), not a rephrase; on Austin the TSV already covers all 189 items. Whether 2.8-format survives at all once it writes no titles is Q8.

**D6. Item order within a group is the checklist's order.** [proposed] 2.9 sorts each group's comments by the guide table row order (the replica's `position` after P2b). 2.2's emit order stops mattering. The 2.1 contract is unchanged.

**D7. Comment numbering has one default.** [proposed] `comment_number` = the checklist MINOR's `comment_number` for the item (`true-comment-num-mapping.tsv` today, the replica column after P2b), which is the sequential number in group-then-table order at the MINOR's first PATCH; a renumbering is a MINOR bump, and live group changes never renumber (P2). The request option `commentNumberingMap` survives only for the Pape-Dawson overlay, named explicitly, and is recorded on the review as today (`metadata.numbering`). Sequential-because-no-map (`reason: 'map-not-provided'`) stops being a silent mode: with no map named, the checklist's numbering is the map. Per P2 and P4 the number is then stable across runs of one checklist MINOR on one project. A named map that does not exist already throws (`build-review-comments.ts:113-117`); only the absent case was silent.

**D8. Group identity comes from the checklist, and the slug is derived once.** [proposed] With `group_id` on the row (D1) and on the review's `sections[]` (D2), cityhall groups by `group_id` when present, else by the snapshot slug. The publisher keeps writing the snapshot slug for the old readers (cc-compare, Inspector General) until they move. The three independent slugify implementations collapse to one, in cityhall's `sections.ts`, used by the PDF through the read model (D10).

**D9. The read-time resolver.** [proposed] `resolveCcPresentation(review, rows)` in cityhall: looks up `reviews.metadata.intakeVersion`, picks the latest PATCH of that MINOR from `intake_checklist_versions` (P2), joins `intake_checklist_items` on `item_id` for title, group and position, overlays live `intake_groups` rows (FEAT-66 §2.4) for group title, order and membership, and falls back to the row's snapshot per field when the replica has no row. Output is the `ChecklistGroup[]` the landing already consumes, plus per item the published snapshot where it differs, which the issue panel shows to staff on a released review (P3). The resolver is the one place P2, P3 and P6 are implemented.

**D10. One CC read model feeds the page and the PDF.** [proposed] `src/lib/reviews/cc/read-model.ts` replaces the two adapters' shared core and `src/pdf/cc-report-data.ts`'s parser: rows → resolved presentation (D9) → effective verdicts → counts → groups. `adaptCompletenessCheck` and `adaptChecklist` become projections of it (drop N/A or keep it). The PDF's own `CcReviewComment`, `buildSectionSlugs`, `normalizeStatus` and `parseSheetReferences` go. The PDF keeps its relative numbering as a projection.

**D11. Counts move to SQL.** [proposed] A `cc_review_counts(review_id)` RPC in the shape of `august_review_discipline_counts`, computing effective verdicts (`verdict_override ?? status`) and per-group totals, and the prior-review delta by `item_id` rather than by `comment_number` (`check-results.ts` today matches on number, which H5 shows is unstable). `reviews.metadata` counts stay as the run's record and are never displayed.

**D12. Archived formats are frozen, not deleted.** [proposed] `legacy` and `2026-04-simplified` adapters move to `src/lib/reviews/adapters/archived/`, keep their tests, and get no new features; the registry marks them `archived` so the landing shows an "archived review" note and the PDF link. The `unclear` word cannot be deleted: 65 CC rows carry it, 8 of them on three current, released April reviews (`928c0820`, `d09d30ff`, `d7fb7cc6`), so it becomes a one-line alias to `uncertain` in the read model and leaves the adapters and the PDF. The pre-cutover triage fold is narrower than it looks: it applies only to `status = 'fail'` rows with `triage_status in ('incorrect', 'na')` (`rows.ts:140-144`), 63 rows with no override yet, on 9 of the 42 pre-cutover reviews: 34 on five current released reviews, 29 on four superseded; no post-cutover row uses those words. It is materialised once: a migration writes `verdict_override = 'not-applicable'` and `verdict_override_note = 'materialised from pre-cutover triage'` on exactly those rows (the note is the audit trail the RPC would have left), then `CC_VERDICT_TRIAGE_CUTOVER_AT` and both fold branches are deleted. This reverses FEAT-61 D13's "no existing data is modified" (Q2); the alternative is computing the fold in `cc_review_counts` forever.

**D13. The CC section page is retired.** [proposed] `[discipline]/page.tsx` redirects, never 404s, for `isChecklistLanding` reviews: to the submission reviews page (`reviewLandingHref`, with `&review=<id>`, so it does not bounce twice) carrying the same `?comment=`, which the issue panel reads on the server render (`issue-panel-switch.tsx:27, 40`), so Inspector General's numeric links (`old-link.ts:7-10`) keep working. The file itself stays until Inspector General stops minting numeric links (Q4). `discipline-page.tsx` loses the CC-only status list and becomes formal-review-only (`hasKinds` stays: it is format-generic).

**D14. The runbook owns its envelope.** [proposed] The scripts 2.9-comments and 3.1-publish stop shelling to `LEG/` for the parts D3 to D7 change: `build-review-comments.ts` and the lane B section of `publish_review.py` move under `CC/scripts/` and are edited there. The rest of the shim (2.2, 2.3, 2.7, 2.10) stays until it is touched. `LEG/` is deleted when nothing shells to it (H14).

**D15. 1.4-resolve names its inputs.** [proposed] The run copies the guides, the sidecars and the one numbering overlay the request names; `source-citations.json` and `citation-overrides.json` stay in bureau. `resolved.json` lists the files the run read, and amend's content hash (FEAT-66 D18, not built) is over that list; until D18 ships, amend keeps the tree hash and D15 only narrows what is copied.

### 4.3 What a row looks like after

```diff
 review_comments
   id                    uuid PK
   review_id             uuid FK
   comment_number        int            -- the published handle (P4); never changes for the row
+  item_id               text NULL      -- 'AUS_TX-42' (D1); NOT NULL by CHECK on the new label; null on formal review, and on 554 archived CC rows
+  group_id              text NULL      -- 'AUS_TX-G1' as placed at publish (D1)
   output_schema         text           -- '2026-10-completeness-check' (D3)
   output_json           jsonb          -- title, comment, resolution, status, votes, runs[], markings, snapshot {section, commentNumber}
~  sheet_references      jsonb          -- now written by lane B (D4)
~  document_references   jsonb          -- now written by lane B (D4)
-  source_findings       jsonb          -- stays, unused by CC (D4); dropped only if formal review also stops
-  agent_trace           jsonb          -- stays, unused by CC (D4)
   prior_comment_id      uuid NULL      -- unused by CC; CRC's
+  UNIQUE (review_id, item_id) WHERE item_id IS NOT NULL; CHECK item_id present when output_schema = '2026-10-completeness-check' (D1)

 reviews.output_json
   metadata                             -- unchanged
~  sections[]            {group_id, slug, label, number}   -- declared, no comment copies (D2)
   sheet_map                            -- unchanged
```

The `-` rows are not dropped by this spec; they are marked so the reader knows CC leaves them empty on purpose.

### 4.4 What changes without a run, before and after

| Change | Today | After (and which spec gives it) |
|---|---|---|
| Item title | bureau PR to the TSV, then a full run or an amend (2.1 to 2.9) | bureau PR to the TSV (PATCH bump), sync; every review on that MINOR shows it (P2, D5, D9). A live `intake_items` investment would make it a CLI call (Q1) |
| Item moved between groups | bureau PR moving the row between guides, then a run; old reviews keep the old slug | `intake-group set` (FEAT-66 P3, after P2a), live rows; every review re-resolves its display (D9); comment numbers unchanged (P2) |
| Group title or order | bureau PR editing the H1 or renaming the file, then a run; slug changes | `intake-group set` (FEAT-66 P3), live rows (D9) |
| Item order in a group | not controllable (H6) | checklist table order (D6); position in the replica |
| Comment number | the request's map or sequential, per run (H5) | fixed at publish from the checklist (D7); stable across runs on one MINOR |
| Verdict | `set_verdict_override` RPC | unchanged |
| Comment prose, refs, markings | promote one run's vote; or amend | unchanged; amend upserts by `(review_id, item_id)` instead of parsing refs |
| Release | `release_review` RPC | unchanged |

### 4.5 Diff tree of the read path

```diff
 cityhall-new/src/lib/reviews/
 ├── registry.ts                       # + '2026-10-completeness-check' (D3); legacy + simplified marked archived (D12)
 ├── adapters/
~│   ├── checklist.ts                  # two projections of the read model (D10)
~│   ├── sections.ts                   # groups by group_id when present (D8); the one slugify
+│   ├── archived/{legacy,simplified}.ts   # frozen (D12)
 │   └── august.ts                     # unchanged
+├── cc/
+│   ├── read-model.ts                 # rows + replica → groups, items, verdicts, counts (D10)
+│   └── resolve-presentation.ts       # pinned MINOR, latest PATCH, live groups overlay (D9)
~└── check-results.ts                  # delta by item_id (D11)
 cityhall-new/src/pdf/
~├── cc-report-data.ts                 # reads the read model; own parser deleted (D10)
~└── cc-report-logic.ts                # relative numbering stays; cutover + fold deleted (D12)
 cityhall-new/src/app/project/[projectId]/review/[reviewId]/
~├── [discipline]/page.tsx             # 404 for CC (D13)
~└── [discipline]/old-link.ts          # CC old links → landing (D13)
 cityhall-new/supabase/schemas/public/
~├── tables/review_comments.sql        # + item_id, group_id, partial unique (D1)
+└── functions/cc_review_counts.sql    # (D11)
```

---

## 5. The API surface

What the app and the runbook expose for changing a review, after §4. "Run" means a runbook run (full or amend).

| Operation | Owner | Interface | Run needed? |
|---|---|---|---|
| Publish a review | bureau 3.1-publish | `publish_review_cli.py` lane B, `--schema 2026-10-completeness-check` | yes |
| Amend part of a review | bureau | `publish_review_cli.py --amend`, matching rows on `(review_id, item_id)` | yes (partial) |
| Override a verdict | cityhall | `set_verdict_override(review_comment_id, verdict, note)` RPC | no |
| Promote one run's vote | cityhall | `promoteRunVote` server action | no |
| Triage, appeal, formal note | cityhall | `setTriage` server action | no |
| Release, supersede | cityhall | `release_review` RPC | no |
| Edit an item's title | bureau | TSV / replica title + PATCH bump; sync | no |
| Move an item, rename or reorder a group | bureau CLI | `intake-group set|retire|list` (FEAT-66 P3) | no |
| Read a review for the page or the PDF | cityhall | `ccReadModel(reviewId)` (D10), `cc_review_counts` RPC (D11) | no |
| Count outcomes per item across reviews | cityhall / IG | `intake_item_review_outcomes` view over `review_comments.item_id` (FEAT-66 §6) | no |

What stays deliberately absent: an app page that edits checklist text. FEAT-66 D19 keeps bureau the authority for text, and this spec adds no second editor.

---

## 6. What formal review lends, and what stays bifurcated

**Borrowed (G6):**
- the declared `sections[]` table on the review row (D2);
- a per-comment identifier shown to the reader (`item_id` plays formal review's `identifier`);
- typed `sheet_references` written at publish (D4);
- counts in one RPC (D11);
- a schema label per shape, with the registry choosing the adapter (D3 keeps this; CC gets a label per shape instead of one label forever).

**Not borrowed:**
- fixed sections: CC's groups come from the checklist and change per jurisdiction;
- `kind` / `certainty` / `severity`: CC's verdict scale is pass/warn/fail/uncertain/N/A and the triage card is built on it;
- the stored PDF: the CC PDF renders live so overrides and relative numbers are current;
- markdown prose: CC prose is one or two sentences and the landing's finding line depends on that (Q5).

**Stays CC-only:** the checklist landing, the split triage card and verdict correction, run promotion, document markers and document mode on the sheets screen, the Source link to `/intake-checklists`, N/A as a first-class verdict, `OverallResults` with the prior-review delta.

---

## 7. Priorities

A proposed order, by what each slice unlocks per unit of work. Each becomes a feature spec; the IDs below are placeholders until allocated.

| # | Slice | Delivers | Unlocks | Size | Depends on |
|---|---|---|---|---|---|
| S1 | **`item_id` on the row** (D1, D4's backfill) | nullable typed id, partial unique index, label-scoped CHECK, best-effort backfill of 12,651 rows; lane B and amend write it; the read model falls back to the JSON ref | H1; FEAT-66 review linkage; per-item counting | small: one migration, two readers | nothing |
| S2 | **Runbook owns 2.9 and lane B** (D14, D15) | the envelope code moves under `CC/`; 1.4-resolve names inputs | every bureau-side change below; H13, H14 | medium: a move plus the contract tests | nothing |
| S3 | **Deterministic title, order, number** (D5, D6, D7) | 2.8 stops writing titles; checklist order; one numbering default | H4, H5, H6; stable handles for customers | medium | S2 |
| S4 | **The new schema and the slim review row** (D2, D3, D8) | `2026-10-completeness-check`; no comment copies; `group_id`; registry entry; IG reads rows | H2, H3, H7; halves the bytes a landing loads | medium-large: publisher, adapter expand/contract, amend, cc-compare, an IG PR | S1, S2, S3 |
| S5 | **One read model + SQL counts** (D10, D11) | the PDF parser goes; counts RPC; delta by item | H11, H12; every later UI change is one edit | medium | S1 |
| S6 | **Archive and delete** (D12, D13) | archived adapters; triage fold materialised; CC section page gone; `unclear` gone | H9, H10; fewer branches in every count and render | small-medium, mostly deletion | S5 for the fold (counts must agree); Q2 |
| S7 | **Read-time presentation** (D9, P2, P3) | titles, groups, order resolve from the replica and live groups | G2 in full; titles in minutes | medium | S4; FEAT-66 P2a, P2b, P3 |

S1, S2 and S5 can start now and in parallel. S7 is the payoff and is the one that waits on the intake DB work.

---

## 8. Alternatives considered

Raised by the adversarial review of v1 and weighed here, so they are not re-litigated.

1. **Keep the blob canonical and derive the rows** (the inverse of D2). Amend already writes the blob wholesale and the storage envelope agrees with it. Rejected: triage, promote, the IG tables and the comment map all key on `review_comments.id`, and promote already writes the row, so the row is the live truth today; inverting moves the drift rather than removing it.
2. **A `review_items` table for CC** beside `review_comments`, typed from day one. Rejected for now: every FK points at `review_comments`, and a second table doubles the join surface for the PDF and the read model. Revisit if `review_comments` is retired for CC.
3. **Resolve presentation in the publisher** (a restamp lane on release) instead of at read time. Reproducible PDFs and a meaningful amend gate, but a run per edit, which is what G2 exists to remove. Rejected; P6 takes the live path with the verdict-override precedent.
4. **A materialised `cc_review_presentation` table** refreshed by the sync and by `intake-group set`. One table to read, "as published" and "resolved" as two columns. Deferred: another derived table to keep fresh; it is the fallback if the read-time join is too slow.
5. **A generated column for `item_id`** from the JSON path. No backfill, cannot drift. Rejected: it pins the `sourceFindings` path D3 deletes, cannot become the stable id without a rewrite, and would need a CASE for the 554 rows with no ref.
6. **Show `item_id` and drop `comment_number` as the handle.** Stable by construction, but customers and the city talk in numbers and the PDF's relative numbering exists because the city asked. Rejected; numbers stay and P2 defines them.

## 9. Open questions

- **Q1. Is a live item-title investment wanted, or is a PATCH bump plus sync fast enough?** FEAT-66 D21 allows a third investment in the shape of `intake_groups`; a `title` override on a live `intake_items` row would make a title edit a CLI call with no PR. Default: not yet; see whether the PATCH path is fast enough after S7.
- **Q2. Materialise the pre-cutover fold?** D12 writes `verdict_override` on rows the fold applies to, reversing FEAT-61 D13. The alternative is carrying the cutover constant forever. Will's call.
- **Q3.** *Answered 2026-10-23:* 65 rows, 8 on current released reviews; `unclear` becomes an alias (D12).
- **Q4. When does Inspector General stop minting numeric section links?** Until then `old-link.ts` stays.
- **Q5. Should CC prose become markdown?** The landing's finding line is the first sentence of `comment`; markdown would need a plain-text projection.
- **Q6.** *Closed:* `comment_number` is stable per `(project, checklist MINOR)` by P2 and D7, with no constraint; a constraint would need the Pape-Dawson overlay settled first (FEAT-66 Q8).
- **Q7. Does cc-compare move to `item_id` in S1 or S4?** It keys on `sourceFindings[0].ref` from both the storage envelope (`cc-compare/scripts/lib.ts:194`) and `review_comments.output_json` through PostgREST (`fetch.py:131-152`); moving it in S1 removes one `sourceFindings` reader early.
- **Q8. Does 2.8-format survive?** Once it writes no titles it writes only reports; S3 checks whether `steps/2.9-comments/step.yaml` or anything else reads them and deletes the step if not.
- **Q9. When does the storage envelope `review-comments.json` adopt the slim shape?** D2 keeps it full for one generation because Inspector General's auditors read it; the cutover is an IG slice.

## 10. Not yet specified

- How amend treats a review whose pinned MINOR has moved on when the run is on a newer MINOR: refuse, as today's tree-hash check does, or re-pin.
- The `intake_item_review_outcomes` view's exact columns (FEAT-66 Q6).
- Whether the formal-review landing adopts the shared read-model shape once CC has one (G6 says share the skeleton, not when).

## 11. Out of scope

- **Checklist text editing in the app.** FEAT-66 D19 keeps bureau authoritative.
- **The intake rename** (`completeness_check`, `completeness-check/` paths). ARCH-6's rename sub-spec; this spec's new schema label keeps the `completeness-check` word so the rename can land independently.
- **Changing what the 2.1 review agent emits.** The verdict step's contract is untouched; everything here is downstream of `findings.json`.
- **CRC.** Different envelope, different adapter.
- **Inspector General's eval tables** (`bureau_checklist_*`, `ig_*`) and its auditors' envelope reads. S4 carries the one IG PR that D2 needs (rows instead of the blob, the new schema id); everything else in IG is its own spec.

## Appendix A: evidence pointers

- bureau: `runbooks/completeness-check/runbook.yaml`, `scripts/cc.py`, `steps/2.8-format/prompt.md`, `steps/2.1-review/steps/review/contract.test.ts`; `workflows/completeness-check/scripts/{build-review-comments,enrich-findings,cross-run-consolidate-cc,checklist-policy}.ts`; `runbooks/lib/{publish_review,publish_review_cli,review_comments_v2,review_amend}.py`; `runbooks/cc-compare/scripts/{fetch.py,compare.ts}`
- cityhall-new: `src/lib/reviews/{registry,rows,view-model,check-results,counts}.ts`, `src/lib/reviews/adapters/{checklist,sections,annotations,sheet-refs,august}.ts`, `src/components/reviews/{checklist-landing,checklist-fold,review-landing,discipline-page,overall-results}.tsx`, `src/app/project/[projectId]/submission/[submissionId]/reviews/page.tsx`, `src/app/project/[projectId]/review/[reviewId]/{read.ts,actions.ts,[discipline]/page.tsx,[discipline]/old-link.ts,pdf/[kind]/route.ts}`, `src/pdf/{cc-report-data,cc-report-logic}.ts`, `src/lib/operations/{set-triage,set-verdict}.ts`, `src/lib/reviews/{promote-run,promote-run-vote}.ts`, `supabase/schemas/public/functions/{review_comment_links,set_verdict_override}.sql`
- prod `mgxqsrjutswbciyrltwd`: `reviews` (64 CC), `review_comments` (13,205 CC), `comment_triage`, `review_checklist_comment_map`; reviews `0bc96434`, `28b83857`, `31fb1daa`, `85fd5bd2`, `54d5c002`, `d09d30ff`
- related specs: ARCH-6 (intake north star), FEAT-66 (intake DB schema), FEAT-60 (runbook v2 port), FEAT-61 (verdict/triage split), FEAT-62 (checklist source UI), FEAT-63 (comment markings), FEAT-64 (review amend), FEAT-22 (CC PDF on RDS)
