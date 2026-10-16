# Intake checklist DB schema and the bureau sync

**Status:** Draft v2
**Date:** 2026-10-16
> **Revision note v2 (2026-10-16): the audit folded in.** Every finding in `AUDIT-2026-10-14.md` is now a decision here, except the judgment calls, which are Q4–Q8 with stated defaults. The audit stays as the record of why.
> - **A18 → new D19:** bureau stays the source of truth; the DB is a read replica; the flip is not planned; per-customer files are overlays.
> - **A1 → D5 rewritten:** backfill v2.7-trimmed's history, one version per distinct folder state, plus `intake_checklist_version_commits`. The two items dropped on 07-09 get retired IDs 0193–0194; `next_item` is 195.
> - **A2 → new D14:** a semver per version in `version.yaml`, with the bump computed by the linter. D6, D8, D10 and D11 are re-keyed from a revision counter to the semver. A revert is a new version (A13).
> - **A5 → new D15:** groups get stable IDs (`austin-g01`) through `intake-groups.tsv`. D6 splits identity tables (`intake_items`, `intake_groups`) from per-version placement and content (`intake_checklist_groups`, `intake_checklist_items`).
> - **A6 → new D16:** `generated_by` in `version.yaml`; `minted_in_version` and `retired_in_version` are computed. D1's `decided_by` means only who ruled on the basis.
> - **A19 → new D17:** reference images are listed in `figures.yaml` by sha256, stored in the `intake-figures` bucket, and hydrated at 1.4-resolve. New P1a (the bucket) and P2c (figures). A3 is narrowed to figures only.
> - **A8 → new D18:** amend compares a content hash that ignores intake-only files.
> - **A9 → D13 rewritten:** the sync is an `intake` job after `conventions` in one workflow.
> - **A10, A11, A12, A14, A16:** D4 adds mint checks and a post-merge lint. D6's ID CHECKs are anchored regexes, citations become rows with a `stale` flag, and `fail_status` stores the runtime value. D12 adds rules 6–8 and a golden parser check.
> - **A15:** overlay files are excluded from the version (D19).
> - **A17:** P2a merges before bureau#2112.
> - **A4, A7:** stamping and counting move to the `intake/review-linkage` sibling (§6), and refresh to `intake/refresh`.
> - **winston#316/#317 (jurisdiction pages):** citations as rows indexed by snapshot, version summary counts, and Q8 (`source_id`).
> - **Q2 closed;** Q4–Q8 new.
>
> **Revision note v1.2 (2026-10-14, fact audit):** factual corrections only; no decision changes. Functional findings from the same audit are in `AUDIT-2026-10-14.md` beside this file, for Will to rule on.
> - **Where reviews keep the ref:** in `review_comments.output_json->'sourceFindings'[].ref`, not in the `source_findings` column, which is filled only on 7 early reviews. `review_checklist_comment_map.checklist_item_id` holds the composite ref, not the bare ID. `review_comments_v2.py:161` is the validator, not the place it is stored (§Problem, §6).
> - **Review labels** carry `-trimmed` (`v2.4-trimmed`, not `v2.4`). The count is 9 real labels plus one review labelled `unknown`. 59 of 60 reviews record `bureauCommitHash`, and the 19 v2.7-trimmed reviews span 14 commits (§Problem, Q1, Q2).
> - **The IG cache:** v2.7-trimmed is versions 1–14 (not 6–14). They hold 194 items in versions 1–2, then 192, across 6 distinct contents. The cache already stores `content_hash` (§Problem).
> - **Edits to v2.7-trimmed:** the guides were last edited on 2026-10-08 (#2057), the title map on 10-09 (#2059) and the numbering map on 10-13 (#2105). Older v2.7 reviews were numbered by the pre-#2105 map (§Problem).
> - **The CC runbook *does* copy `intake-ids.tsv`:** 1.4-resolve copies the whole version dir into the run (`cc.py:307`), and the sidecar changes `checklistsTreeHash`. No step reads the file (§1, header).
> - **The runtime item parser** is `workflows/completeness-check/scripts/checklist-policy.ts`, which has different rules from `guide-items.ts` (D9). In sequential mode, comments are numbered by the agent's emission order within a group (D9).
> - **Smaller fixes:**
>   - The `CC-2-23` split (§Problem).
>   - The `section` key in `source-citations.json`, and its 9 stale items (§Problem).
>   - `ci.yml:683–687` (§Problem, D12).
>   - The Slack alert is conditional (D13).
>   - The D7 grants and the definer-ACL rationale.
>   - The `jurisdictions` policy (D7).
>   - The files §1 leaves out.
>   - 10 other Austin version dirs, not 9 (D5).
>   - Cedar Park's counts and its broken row (Q3).
>   - Open bureau#2112 already writes this format (P2a).
>
> **Revision note v1.1 (2026-10-14):** the PR plan is resequenced per north-star D3 v1.1. P2a lands first, as the runbook's output contract; P1 and P2b wait until the loop has met the Austin bar and at least one non-Austin smoke run has produced output in the format (north-star v1.2).

**Parent:** `workspaces/intake/north-star/NORTH-STAR-SPEC.md`, initiative I1 (D3). Carries out north-star D4–D9.
**Repos touched:**
- `cityhall`: ten App-DB tables, one write function, the `intake-figures` bucket, tests
- `bureau`:
  - `intake.yaml`, and per-version `version.yaml`, `intake-ids.tsv`, `intake-groups.tsv` and `figures.yaml`;
  - a CI linter;
  - the sync library, CLI and job;
  - the Austin v2.7 history backfill;
  - in the CC runbook, figure hydration at 1.4-resolve and amend's content hash

**Repos NOT touched:**
- `completion-officer` (being retired)
- `conductor` / `conductor2`
- `inspector-general` (its `bureau_checklist_*` cache is unchanged, north-star Q6)
- `substation`
- cc-source-citations (its manifest gains `source_id` under the jurisdiction-pages spec, not here)

## Problem

Intake (completeness-check) checklist items exist only as markdown tables in bureau guides, identified by legacy IDs that change whenever an item moves. Nothing in the DB holds an item. Verified 2026-10-14:

- **The checklist is markdown.** `bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/` holds 14 guides (`cc-1.md` … `cc-24.md`) with 192 items.
  - **What counts as an item:** a row counts only if it sits in a table whose first header cell is `ID` (`runbooks/completeness-check/scripts/lib/guide-items.ts`).
  - **Columns:** `ID | Item | Condition | Location | Location Binding | Requirement Source | Source Type | Fail Status`. 71 rows, in 7 guides, sit in older tables that have no `Fail Status` column.
  - **Other parsers:** the runbook's own runtime parser is a different one, `workflows/completeness-check/scripts/checklist-policy.ts`. It reads columns by position, does not skip fences, and treats a missing `Fail Status` as `fail`. cc-source-citations has a third, `guides.py`, which reads by header name. On v2.7-trimmed all three return the same 192 refs.
- **Side files supply the rest.**
  - `cc-item-title-mappings.tsv` has 192 titles, keyed by the composite ref `cc-1:CC-1-01`.
  - `true-comment-num-mapping.tsv` has comment numbers 1–192 in numeric group order (bureau#2105, 2026-10-13).
  - `source-citations.json` keys `items` by the same composite ref, each with `group`, `local_id`, `section`, `title`, `item_text`, `item_text_sha` and `citations[]` (bureau#2045). It was generated on 2026-10-07. Since #2057, 9 of its `item_text`s no longer match the guide's `Item` cell.
  - The folder also holds `pape-dawson-comment-num-mapping.tsv`, `1700-s-lamar-forced-outcomes.tsv` (one project's forced outcomes) and an empty `citation-overrides.json`.
- **IDs encode the group and are not stable.** `CC-15-09a/b` became `CC-15-09/14` in v2.5. Also in v2.5, `CC-2-23` was split into `CC-2-23` and a new `CC-2-24`. The v2.1–v2.3 folders carry hand-made `vX-to-vY-mapping.tsv` files to track changes like these.
- **The folder is edited in place.** v2.7-trimmed was created on 2026-07-07 as an exact copy of v2.6, and 18 commits have touched it since:
  - the item count went from 194 to 192 on 07-09;
  - the guides were last edited on 2026-10-08 (#2057), the title map on 10-09 (#2059), and the numbering map on 10-13 (#2105).

  So the label `v2.7-trimmed` does not name one fixed set of content. Comment numbers changed under it too: review 31fb1daa (2026-10-12) was numbered by the pre-#2105 map, and 159 of its 192 numbers differ from today's.
- **Reviews cite items only by string.** A CC review writes one `review_comments` row per item. The composite ref lives in `review_comments.output_json->'sourceFindings'[].ref` (lane B, `runbooks/lib/publish_review.py:1964-1970`; validated by `valid_refs_from_enriched`, `runbooks/lib/review_comments_v2.py:161`). The `source_findings` column is filled only on 7 early reviews (2026-03-30 to 04-03). `review_checklist_comment_map.checklist_item_id`, which Inspector General fills, holds the same composite ref (8,451 CC rows over 44 reviews).
- **Reviews span 9 checklist labels.** Prod has 60 CC reviews (`review_type = 'completeness_check'`). Grouped by `output_json.metadata.checklistVersion`:

  | Label | Reviews |
  |---|---|
  | v2.7-trimmed | 19 |
  | v2.4-trimmed | 12 |
  | v2.5-trimmed | 10 |
  | v1 | 6 |
  | v2.6-trimmed | 4 |
  | v2.1-trimmed | 3 |
  | v2.3-trimmed | 2 |
  | v2-trimmed | 2 |
  | v2 | 1 |
  | `unknown` (a literal string) | 1 |

  59 of the 60 also record `bureauCommitHash`, and the 19 v2.7-trimmed reviews span 14 distinct commits.
- **The only DB copy is Inspector General's cache.** `bureau_checklist_version` + `bureau_checklist_item` (`inspector-general/src/lib/data/bureau-checklist-store.ts`) has one version per `(bureau_commit_hash, department_code, bureau_artifacts_path)`, numbered per path. It already stores `content_hash` (over each item's id, deficiency and citation) and `item_count`.
  - It has 41 CC version rows, one of them Cedar Park's.
  - v2.7-trimmed alone is versions 1–14: 194 items in versions 1–2 and 192 from version 3 on. Across the 14 rows there are 6 distinct contents.

**One label, many contents.** The 19 v2.7-trimmed reviews' `bureauCommitHash`es resolve to 7 different git tree states of the folder. None of them is the folder as it is today (tree `d7ffe14`, after #2105). Reviews per state, oldest first: 3, 1, 5, 2, 4, 3, 1.

**Bureau holds no binaries.** It tracks 0 images and 0 PDFs.
- Codes record a source URL and a sha256 in `meta/provenance.json`.
- CC source snapshots keep `sources/manifest.json` in bureau and the bytes in the `cc-source-snapshots` bucket.
- The CRC guides that already embed reference images live in the `crc-guides` bucket. Lamar + Collier's sets hold 125 figure files (48.6 MB, 86 unique), overwritten in place on 2026-07-10, with no hashes recorded.

**Runbooks can read the App DB.** The CC runbook reads the submission (1.2), `project_facts` (1.3) and `jurisdictions` (1.4-resolve) through a per-run `workflow_run` token (`cityhall/src/lib/runbook/run-token.ts:152-169`), and writes `reviews` at 3.1. conductor2's "DB-free" rule covers the runner binary only (`src/init.rs:8-10`).

**The precedent for this sync is the conventions sync.** `bureau/.github/workflows/sync-conventions.yml` runs `bun run sync:conventions` (`tooling/src/cli/sync-conventions.ts`) on merge to main.
- It replicates `jurisdictions/<slug>/conventions.yaml` one way into `jurisdictions` + `jurisdiction_departments` with the service-role key.
- A failure fails the job. Its alert step posts to Slack when `SLACK_WEBHOOK_URL` is set.
- Its schema (`tooling/src/lib/conventions/schema.ts`) is shared with a CI linter (`bun run lint:conventions && bun run test:conventions`, `.github/workflows/ci.yml:683-687`).
- Spec: winston#185.

**bureau#2112 (open) already writes the format.** The intake-prospecting runbook's `3.1-write` emits `jurisdictions/<slug>/intake.yaml` and `<version>/intake-ids.tsv` (header `ref	id	derived_from`) for new jurisdictions. It adds no linter and no Austin sidecar.

**How cityhall changes its schema.** Per `cityhall/AGENTS.md:111-127`:
- The schema is declared in `supabase/schemas/` (one file per table and per function), and migrations are generated with `npx supabase@2.119.0 db schema declarative sync --no-apply -f <name>`.
- Jason pushes migrations.
- Every new table is covered by `pnpm test:db`, or listed in `supabase/rls-isolation-allowlist.txt` with a reason. `jurisdictions`, `jurisdiction_departments` and `bureau_checklist_*` are already listed as `reference`.

---

## 1. The design at a glance

**Bureau is the source of truth for checklist text; the App DB holds a read replica; Storage holds the figure bytes** (D19). Every checklist version carries a semver that bureau declares and the linter checks (D14). Items and groups have stable IDs that never encode their position (D4, D15). Reference images are listed by sha256 in bureau and hydrated into each run (D17).

```diff
 bureau/
 ├── intake/
+│   └── baseline/                          # the generic baseline (north-star D4); filled by intake/baseline
+│       ├── checklist.yaml                 # id: generic, name, next_item, next_group
+│       ├── CURRENT_VERSION
+│       └── <version>/                     # same layout as a jurisdiction's version dir
 ├── jurisdictions/austin/
+│   ├── intake.yaml                        # which checklist, basis, evidence, next_item, next_group (D1)
 │   └── completeness-check/
 │       ├── CURRENT_VERSION                # v2.7-trimmed (unchanged)
 │       └── v2.7-trimmed/
 │           ├── cc-1.md … cc-24.md          # unchanged; a "## Figures" section once a guide has figures
 │           ├── cc-item-title-mappings.tsv  # unchanged, read by the sync
 │           ├── true-comment-num-mapping.tsv# unchanged, read by the sync
 │           ├── source-citations.json       # unchanged, read by the sync
 │           ├── pape-dawson-comment-num-mapping.tsv, 1700-s-lamar-forced-outcomes.tsv,
 │           │   citation-overrides.json     # unchanged; overlays, never synced (D19)
+│           ├── version.yaml                # semver, format, generated_by (D14, D16)
+│           ├── intake-ids.tsv              # ref → stable item id (D3)
+│           ├── intake-groups.tsv           # guide stem → stable group id + title (D15)
+│           └── figures.yaml                # figure id → caption, sha256, … (D17); only when a guide has figures
 ├── runbooks/completeness-check/
~│   ├── scripts/cc.py                      # 1.4-resolve hydrates figures (D17)
~│   └── …/review_amend.py                  # amend ignores intake-only files (D18)
 ├── tooling/src/
+│   ├── lib/intake/                        # schema, lint, bump, snapshot builder, sync, history backfill
+│   └── cli/{lint-intake,sync-intake,intake-mint,intake-figure-upload}.ts
 └── .github/workflows/
~    └── sync-conventions.yml               # + an `intake` job, `needs: conventions` (D13)

 cityhall/supabase/schemas/
 ├── public/tables/
+│   ├── intake_checklists.sql              # one row per checklist
+│   ├── intake_checklist_versions.sql      # one row per semver
+│   ├── intake_checklist_version_commits.sql # bureau commit → version (D5)
+│   ├── intake_groups.sql                  # group identity (D15)
+│   ├── intake_items.sql                   # item identity (D4)
+│   ├── intake_checklist_groups.sql        # a group's place and title in a version
+│   ├── intake_checklist_items.sql         # an item's place and content in a version
+│   ├── intake_checklist_citations.sql     # one row per citation (D9)
+│   ├── intake_checklist_figures.sql       # one row per figure (D17)
+│   └── jurisdiction_intake.sql
 ├── public/functions/
+│   └── intake_sync_version.sql            # one version and everything in it, one transaction (D8)
 └── storage/
+    └── intake-figures bucket + policies   # figure bytes by sha256 (D17)
```

**Flow:**
1. A bureau PR edits guides or sidecars. A new or changed figure is uploaded to Storage before the PR is opened.
2. `lint:intake` checks the files, the semver bump and the figure hashes (D12).
3. On merge, the `intake` job runs after the `conventions` job (D13).
4. For each version dir, the sync builds rows, hashes them, and calls `intake_sync_version()`.
5. That function writes the version only if its semver is new. A known semver arriving with a different hash fails the job (D8, D14).

**What the CC runbook sees:**
- **Guides:** it reads them exactly as today. 1.4-resolve copies the version dir into the run (`cc.py:307`), and no step reads the intake-only files.
- **Figures:** after the copy, 1.4-resolve fetches each figure listed in `figures.yaml` by sha256, verifies it, and writes it where the guide's markdown points (D17).
- **Amend:** it ignores the intake-only files when it compares a review's checklist with today's, so adding them doesn't break amending older reviews (D18).

---

## 2. Decisions

### 2.1 Files in bureau

**D1. The `intake.yaml` file.** [Will, 2026-10-14] Each jurisdiction that has an intake assignment gets `jurisdictions/<slug>/intake.yaml`. It is a standalone file, not a block in `conventions.yaml`, so that one sync owns every intake row and writes them in dependency order. Shape:

```yaml
# jurisdictions/austin/intake.yaml
checklist: austin                     # own checklist id (= slug) or `generic`
basis: formal                         # formal | none_found | inconclusive  (north-star D5)
application_type: Consolidated Site Plan   # what the checklist covers (north-star Q2); free text
path: completeness-check              # versions dir, relative to the jurisdiction (own checklists only)
next_item: 195                        # high-water mark for item ids (D4); own checklists only
next_group: 15                        # high-water mark for group ids (D15); own checklists only
evidence:
  summary: >-
    Austin runs a formal Completeness Check before technical review, with a
    published CC Application, CC Submittal Checklist, Notes and Templates, and
    an Austin Water Completeness Checklist.
  sources:
    - { label: CC Submittal Checklist, url: "https://…" }
decided_by: will                      # who ruled on the basis: a person, or a runbook_runs uuid
decided_at: 2026-10-14
```

- **A jurisdiction on the baseline** sets `checklist: generic` and a `basis` of `none_found` or `inconclusive`, and has no `path`, `next_item` or `next_group`.
- **Absence is meaningful:** a jurisdiction with no `intake.yaml` has no assignment, which is different from `none_found`.
- **Validation:** `tooling/src/lib/intake/schema.ts` is the single parser, shared by the linter and the sync, following the `conventions/schema.ts` pattern.
- **The rule for `basis`:**
  - `basis: formal` requires `checklist` = the jurisdiction's slug;
  - any other basis requires `checklist: generic`.
- **`decided_by` means one thing:** who ruled on the basis. The run that generated a checklist version is recorded in that version's `version.yaml` (D16), not here. For a run, `decided_by` holds the `runbook_runs` uuid, not the run directory's name.

**D2. The baseline lives at `bureau/intake/baseline/`.**
- It sits outside `jurisdictions/`, so it never looks like a jurisdiction to the syncs that walk that directory: `sync-conventions` reads every `jurisdictions/*/` dir, and `sync-bureau.yml` fires on `jurisdictions/**`.
- It has the same layout as a jurisdiction's versions dir, plus `checklist.yaml` (`id: generic`, `name`, `next_item`, `next_group`).
- This spec defines the location and the schema only. The folder stays empty until the `intake/baseline` sub-spec fills it, and the sync skips it while it has no version.

**D3. An item sidecar per version: `<version>/intake-ids.tsv`.** One row per item. Columns:

| column | example | rule |
|---|---|---|
| `ref` | `cc-1:CC-1-01` | `{guide stem}:{ID cell}`, exactly the composite ref reviews already store |
| `id` | `austin-0001` | the stable item ID (D4) |
| `derived_from` | `austin-0097` | optional; comma-separated IDs this item was split or merged from |

- **Why per version and not per jurisdiction:** refs change between versions (`CC-15-09a` → `CC-15-09`), and moving an item to another guide changes its ref (`cc-2:X` → `cc-5:X`). A review's ref resolves through the sidecar of the version it ran against.
- **New jurisdictions** generated by intake-prospecting put the stable ID directly in the guide's ID column, so the sidecar maps `cc-1:new-braunfels-0007` → `new-braunfels-0007`. The format is the same everywhere. Open bureau#2112 already writes this file.

**D4. Item ID format and minting.** [north-star D6]
- **Format:** an item ID is `{checklist id}-{NNNN}`: at least four digits, zero-padded, matching `^[a-z0-9-]+-[0-9]{4,}$`.
- **Minting:** a new item takes `next_item` from its checklist's `intake.yaml` (or the baseline's `checklist.yaml`), and the same PR increments it. `bun run intake:mint <checklist> [n]` does both, so nobody picks a number by hand.
- **Why `next_item` exists:** a folder is edited in place, so a deleted item's number appears in no sidecar on disk. The high-water mark keeps it retired.
- **Edits keep the ID.** A split or merge mints new IDs and records `derived_from`. A move to another group keeps the ID (D15).
- **Concurrent PRs.** Two PRs that each take the same `next_item` make an identical edit that git merges cleanly. Three checks catch it:
  - `lint:intake` also runs on every push to `main`;
  - the sync refuses an ID whose first appearance differs between two versions (D8);
  - the mint helper re-reads `origin/main` before minting.

**D5. Backfill Austin v2.7-trimmed with its history, not just its tip.** [Will, 2026-10-14: v2.7 only; history added in v2]
- **Why history:** the label v2.7-trimmed has named 18 commits of edits. The 19 v2.7 reviews ran on 7 different folder states, and none of them is the folder as it is today. A single backfilled version would resolve none of them.
- **How:** a one-time script, `tooling/src/lib/intake/backfill-history.ts`, does the following.
  1. It walks `git log -- jurisdictions/austin/completeness-check/v2.7-trimmed` and builds the version rows for each distinct content state, in commit order.
  2. It assigns each state a semver under D14's rules, starting at `1.0.0` (Q5).
  3. It writes every folder commit into `intake_checklist_version_commits`.
- **IDs:** `austin-0001` … `austin-0192` are assigned in today's `true-comment-num-mapping.tsv` order.
  - Day one is a coincidence: each item's number equals its comment number. Nothing may derive one from the other, and the two diverge with the next insertion.
  - The two items that left on 2026-07-09 (194 → 192) get `austin-0193` and `austin-0194`, retired in the version that dropped them.
  - `next_item` starts at 195.
- **How a review finds its version:** through `reviews.metadata.bureauCommitHash`. The newest folder commit that is an ancestor of that commit names the version. 59 of the 60 CC reviews record the hash.
- **Scope:** the other 10 Austin version dirs (`legacy`, `v1`, `v2`, `v2-trimmed`, `v2.1-trimmed` … `v2.6-trimmed`) are not backfilled (Q1).

**D14. Every version declares a semver in `<version>/version.yaml`.** [audit A2]

```yaml
# jurisdictions/austin/completeness-check/v2.7-trimmed/version.yaml
version: 1.4.2              # semver of this checklist's content
format: 1                   # the file-format version; the sync refuses a major it doesn't know
generated_by: …             # D16; absent for hand edits
```

- **The folder label stays** as the version's `label`, for display only. A folder can be edited in place; its semver moves forward with every content change.
- **The linter computes the smallest bump** by diffing the dir against `origin/main`. The declared version must be at least that bump, and may be bigger:

  | Bump | When |
  |---|---|
  | MAJOR | an item ID leaves the checklist (removed, split, merged) |
  | MINOR | an item is added, or what an item checks changes: `item_text`, `condition`, `location`, `location_binding`, `requirement_source`, `source_type`, `fail_status` |
  | PATCH | anything else in the dir: titles, citations, figures, group placement and order, group titles, comment numbers, guide prose |

  Whether regrouping and renumbering are PATCH, since comment numbers are customer-visible, is Q4. PATCH is the default until it is answered.
- **A revert is a new version.** Going back to earlier content still bumps forward, so "the newest version is current" always holds.
- **Reviews will record it.** 1.4-resolve already reads the version dir. The review-linkage sibling spec has it copy `version` into `resolved.json` and `reviews.metadata.intakeVersion`, so a review names its exact version with no DB lookup.
- **`format`** is an integer, following the `schema_version: 1` precedent in `resolved.json` and the cc-compare answer keys. A breaking change to this file layout bumps it.

**D15. Groups have stable IDs, apart from their guide file and their number.** [audit A5]
- **Where a group shows up today:**
  - **guide file:** a group *is* a guide file, the unit the review agents fan out over;
  - **ref:** its stem is the prefix of every ref;
  - **title and section:** its H1 (`# CC-1: …`) is parsed for the title, which becomes each comment's section slug;
  - **comment numbers:** they follow group order.
- **This spec gives groups an identity of their own** without changing any of that at run time:
  - **The ID:** `{checklist}-g{NN}` (e.g. `austin-g01`), minted from `next_group` like items.
  - **The sidecar:** `<version>/intake-groups.tsv` maps each guide stem to its group:

    | column | example |
    |---|---|
    | `stem` | `cc-1` |
    | `group_id` | `austin-g01` |
    | `title` | `Intake & Core Submittal` (the H1 without its `CC-N:` number; the display number is positional) |

  - **In the DB:** moving an item changes only its row's `group_id` and `position` in the new version (D6). The item's ID and title stay, and every group's ID and title stay. Renaming a group changes one title; reordering changes positions.
- **The runbook still keys sections on the H1 and refs on the stem.** So in new reviews a regroup still changes refs and section slugs; old reviews resolve through their own version. Moving the runbook to `group_id` and `itemId` is the review-linkage sibling's job.

**D16. A version records the run that generated it.** [audit A6] `version.yaml` gains:

```yaml
generated_by:
  runbook: intake-prospecting
  run_id: 3f2a…               # runbook_runs.id, the uuid conductor init creates
  run_name: new-braunfels-2026-10-20
  runbook_commit: 9c1e…
```

- **Hand edits leave `generated_by` out.** Git records who made the PR.
- **The DB computes the rest:** the sync derives `minted_in_version` and `retired_in_version` for each item from version history (D8), so the run that minted an item is one join away.
- **A run with no `runbook_runs` id** (no control plane) records `run_id: null` explicitly. intake-prospecting's 3.1-write must write the uuid. Today it writes `run.name`, the run directory's name, so bureau#2112 needs that change.

**D17. Reference images: hashes in bureau, bytes in Storage, hydrated at 1.4-resolve.** [audit A19; builds on winston#312 D2]
- **The manifest:** a version dir with figures holds `figures.yaml`, one row per figure:

  ```yaml
  - id: austin-0042/F1            # the item's stable id + a number; survives regrouping
    items: [austin-0042]
    caption: CRZ root-zone impact thresholds
    type: reference-design        # reference-design | site-example | table | redline
    description: >-               # what it shows, and what it does NOT show
      …
    constraints: "min 50% of CRZ preserved at natural grade; …"
    sha256: 9f2c…
    media_type: image/png
    px: [938, 851]
    bytes: 197602
    derived_from:                 # optional: where it was cut from
      snapshot: sn_ecm-3-5_20261007-ab12cd34
      page: 14
      bbox: [0.12, 0.30, 0.55, 0.62]
  ```

- **The guide:** each figure appears in the guide's `## Figures` section as `![caption](figures/austin-0042/F1.png)`, the format CRC's generated guides already use. The path does not exist in git; hydration creates it.
- **The bytes:** Storage bucket `intake-figures`, path `<checklist_id>/<sha256>.<ext>`. Objects are never overwritten: a changed figure is a new hash, and a PATCH.
  - **Read:** `authenticated` and `workflow_run` can read (Q7).
  - **Write:** only `service_role` can write.
- **Upload before the PR:** the author (intake-prospecting, or a Will-directed session) runs `bun run intake:figure-upload <file>`. It prints the manifest row, the same way cc-source-citations' 1.2-capture uploads snapshots. The PR carries only text.
- **Hydration at 1.4-resolve.** After `cc.py` copies the version dir into the run:
  1. It reads `figures.yaml`.
  2. It takes each sha256 from a host cache, or from the bucket on a miss.
  3. It verifies the hash and writes the file to the path the markdown names.
  4. It records the list in `resolved.json`.

  A missing object or a hash mismatch stops the run with a reason. `checklistsTreeHash` covers `figures.yaml`, so a review's existing provenance pins every image.
- **The vision CLI** gains `--ref <figure id>` in winston#312's P2, which is revised to this layout. It attaches the guide's caption, description and constraints, never an agent-written one. It resizes each image to the mode's view size, caps a call at 4 references, refuses an unknown ID with a reason, and logs `{id, sha256, sent_px}`.
- **Why not git:** bureau tracks 0 images and 0 PDFs. Its rule for binaries, in codes provenance and in CC source snapshots, is hashes in git and bytes elsewhere. CRC's Lamar + Collier sets alone hold 125 figure files (48.6 MB, 86 unique). In git that would grow history permanently.

**D18. Review amend ignores the intake-only files.** [audit A8]
- Today amend compares the review's `checklistsTreeHash` (`git rev-parse HEAD:<dir>`, `cc.py:298`) with today's, and refuses when they differ (`review_amend.py:83-85`). Adding `intake-ids.tsv` would make every pre-sidecar v2.7 review un-amendable.
- From P2a, 1.4-resolve also records `checklistsContentHash`: a sha256 over the files a run reads, sorted by path, excluding `intake-ids.tsv`, `intake-groups.tsv` and `version.yaml`. `figures.yaml` stays in, because it pins the images.
- Amend compares content hashes when the review has one. Otherwise it recomputes the content hash of the review's own commit and compares that with today's. A review recorded before P2a therefore amends as long as only intake-only files changed.

**D19. Bureau stays the source of truth. The DB is a read replica, and per-customer variants become DB overlays.** [audit A18; north-star D7]
- **Bureau is the source** for every intake checklist, at any scale foreseen. Every other content type prospector makes (codes, review guides, conventions) is bureau files that a runbook reads from a checkout. intake-prospecting publishes the same way, through a bureau PR.
- **The DB is a read replica** for the app, review linkage, counting and dashboards. The runbook never needs it, though it could read it: runbooks already read the App DB through a per-run `workflow_run` token.
- **The flip is not planned.** Reading and editing checklists in the DB is reconsidered only if one of these becomes real:

  | Trigger | Response |
  |---|---|
  | people who don't use git need to change items routinely | build an app editor and flip |
  | customers need their own variants of a jurisdiction's checklist | per-org overlay rows in the DB, `origin = 'app'` |
  | fixes must reach live reviews within minutes, routinely | override rows, not the flip |

- **Overlays stay out of the version.** `1700-s-lamar-forced-outcomes.tsv` belongs to one project and `pape-dawson-comment-num-mapping.tsv` to one firm. They are excluded from the version's content, its semver bump and the sync. Where they should live is north-star Q8.

### 2.2 Tables in cityhall

**D6. Ten tables, keyed naturally rather than by uuid: identity apart from per-version placement and content.** [north-star D5, D6; audit A1, A2, A5, A11, A12, A14, A19; Will prefers short IDs to uuids]

```sql
-- identity: what exists, under ids that never change
intake_checklists
  id                text PK          -- 'austin' | 'generic'   CHECK (id ~ '^[a-z0-9-]+$')
  kind              text NOT NULL    -- 'jurisdiction' | 'baseline'
  jurisdiction_slug text NULL  FK → jurisdictions(slug)
  name              text NOT NULL
  bureau_path       text NOT NULL    -- 'jurisdictions/austin/completeness-check' | 'intake/baseline'
  bureau_commit     text             -- last sync that touched this row
  created_at, updated_at
  CHECK ((kind = 'baseline') = (jurisdiction_slug IS NULL))
  CHECK (kind <> 'jurisdiction' OR id = jurisdiction_slug)       -- relaxed if north-star Q2 says per application type

intake_items
  checklist_id      text FK → intake_checklists
  item_id           text             -- 'austin-0042'
  jurisdiction_slug text NULL FK → jurisdictions(slug)   -- = the checklist's; NULL on the baseline
  derived_from      text[] NULL
  minted_in_version text NOT NULL    -- computed by the sync
  retired_in_version text NULL       -- computed by the sync
  PK (checklist_id, item_id)
  CHECK (item_id ~ ('^' || checklist_id || '-[0-9]{4,}$'))

intake_groups
  checklist_id      text FK → intake_checklists
  group_id          text             -- 'austin-g01'
  PK (checklist_id, group_id)
  CHECK (group_id ~ ('^' || checklist_id || '-g[0-9]{2,}$'))

-- versions
intake_checklist_versions
  checklist_id      text FK → intake_checklists
  version           text             -- semver '1.4.2'
  major, minor, patch int NOT NULL   -- for ordering
  label             text NOT NULL    -- the folder name, 'v2.7-trimmed'
  format            int NOT NULL
  content_hash      text NOT NULL    -- sha256 of the canonical rows (D10)
  is_current        boolean NOT NULL DEFAULT false
  item_count, group_count, figure_count  int NOT NULL
  citation_counts   jsonb NOT NULL   -- {"found": 300, "not_found": 8, "document_level": 6, "no_snapshot": 1}
  generated_by      jsonb NULL       -- version.yaml's block (D16)
  generated_by_run_id uuid NULL      -- no FK: runs can come from another environment
  bureau_commit     text NOT NULL    -- the commit that introduced this content
  synced_at         timestamptz NOT NULL DEFAULT now()
  PK (checklist_id, version)
  UNIQUE (checklist_id) WHERE is_current

intake_checklist_version_commits
  checklist_id      text
  bureau_commit     text             -- every commit that touched the version dir
  version           text
  committed_at      timestamptz NOT NULL
  PK (checklist_id, bureau_commit)
  FK (checklist_id, version) → intake_checklist_versions

-- placement and content, per version
intake_checklist_groups
  checklist_id, version              FK → intake_checklist_versions
  group_id          text             FK (checklist_id, group_id) → intake_groups
  position          int NOT NULL     -- the display number comes from here
  title             text NOT NULL    -- 'Intake & Core Submittal', no number
  guide_path        text NOT NULL    -- 'cc-1.md'
  PK (checklist_id, version, group_id)

intake_checklist_items
  checklist_id, version              FK → intake_checklist_versions
  item_id           text             FK (checklist_id, item_id) → intake_items
  group_id          text             FK (checklist_id, version, group_id) → intake_checklist_groups
  position          int NOT NULL     -- across the version (guides by number, then table order)
  comment_number    int NOT NULL
  legacy_ref        text NULL        -- 'cc-1:CC-1-01', what reviews store
  title             text NULL        -- authored title; NULL when the version has no title map
  item_text         text NOT NULL    -- the `Item` cell
  condition, location, location_binding, requirement_source, source_type   text NULL
  fail_status       text NOT NULL    -- the value the runtime uses: 'fail' | 'warn' | 'fail-or-warn'
  fail_status_declared boolean NOT NULL  -- false where the guide's table has no Fail Status column
  PK (checklist_id, version, item_id)
  UNIQUE (checklist_id, version, legacy_ref)
  UNIQUE (checklist_id, version, comment_number)

intake_checklist_citations
  checklist_id, version, item_id     FK → intake_checklist_items
  ordinal           int              -- the citation's position in the item's list
  source_key        text NOT NULL    -- the manifest's source_key
  source_id         text NULL        -- a stable source slug, once the manifest carries one (Q8)
  snapshot_id       text NULL        -- 'sn_cc-submittal-checklist_20261007-158d3960'
  label             text NULL
  status            text NOT NULL    -- cc-source-citations' vocabulary: found | not_found | document_level | no_snapshot
  confidence        text NULL
  regions           jsonb NOT NULL DEFAULT '[]'  -- [{page, boxes, quote}]
  stale             boolean NOT NULL -- the citation's item_text_sha no longer matches the item's Item cell
  PK (checklist_id, version, item_id, ordinal)
  INDEX (snapshot_id)

intake_checklist_figures
  checklist_id, version              FK → intake_checklist_versions
  figure_id         text             -- 'austin-0042/F1'
  item_ids          text[] NOT NULL
  caption           text NOT NULL
  type              text NOT NULL
  description, constraints  text NULL
  sha256            text NOT NULL    CHECK (sha256 ~ '^[0-9a-f]{64}$')
  storage_path      text NOT NULL    -- 'austin/<sha256>.png' in bucket intake-figures
  media_type        text NOT NULL
  px_w, px_h, bytes int NOT NULL
  derived_from      jsonb NULL       -- {snapshot, page, bbox}
  PK (checklist_id, version, figure_id)

-- assignment
jurisdiction_intake
  jurisdiction_slug text PK FK → jurisdictions(slug)
  checklist_id      text NOT NULL FK → intake_checklists(id)
  basis             text NOT NULL    -- 'formal' | 'none_found' | 'inconclusive'
  application_type  text NULL
  evidence          jsonb NOT NULL DEFAULT '{}'   -- intake.yaml's evidence block, verbatim
  decided_by        text NULL
  decided_at        date NULL
  bureau_commit     text NOT NULL
  updated_at        timestamptz NOT NULL DEFAULT now()
  CHECK ((basis = 'formal') = (checklist_id <> 'generic'))
```

- **Names.** `intake_checklist_items` is the table Will named. It holds an item's place and content in one version. `intake_items` and `intake_groups` hold identities only, so something that must point at "the item, whatever version" has a key to point at.
- **No row has a uuid.** A version is `('austin', '1.4.2')` and an item in it is `('austin', '1.4.2', 'austin-0042')`.
- **`jurisdiction_slug` lives on `intake_items`.** Will asked for the column so "items for jurisdiction X" needs no join. It always equals the checklist's slug, and the sync sets it.
- **The ID CHECKs are anchored regexes.** A `LIKE checklist_id || '-%'` check would accept `new-braunfels-0007` in a checklist named `new`.
- **`fail_status` stores the runtime's value.** `checklist-policy.ts` treats a missing column as `fail`, so 71 Austin rows store `fail` with `fail_status_declared = false`.
- **Citations are rows,** not a jsonb blob on items. That is so the per-source page in winston#316/#317 can ask "every region on snapshot X, page N" in one indexed query. Snapshot bytes stay in `cc-source-snapshots`.
- **Why `jurisdiction_intake` is a separate table** rather than columns on `jurisdictions`: the conventions sync writes `jurisdictions`, and one writer per table keeps "bureau wins" unambiguous.

**D7. Access: shared reference data, written only by the sync.**
- RLS is on for every table.
- `authenticated` and `workflow_run` get `SELECT … USING (true)`.
  - Each grant follows `tables/jurisdictions.sql`: a policy plus an explicit `GRANT SELECT … TO "workflow_run"`, because the default privileges grant `workflow_run` nothing.
  - This matches the any-signed-in-user read policy on the `cc-source-snapshots` bucket that `/intake-checklists` reads.
  - It is broader than `jurisdictions`' own authenticated policy, which shows only jurisdictions that have a project the caller can see. These are city requirements, not tenant data.
- No `anon` access.
- Writes come only from `service_role` through `intake_sync_version()` (D8).
  - Its file revokes EXECUTE with `REVOKE ALL … FROM PUBLIC, "anon", "authenticated"`, the pattern in `functions/cartographer_anchor_decide.sql:50`.
  - It is SECURITY INVOKER, so it needs no `definer-acl-allowlist.txt` entry: `scripts/check-definer-acl.sh` checks only SECURITY DEFINER functions.
- Every table goes in `supabase/rls-isolation-allowlist.txt` as `reference`, beside `jurisdictions`.
- **The `intake-figures` bucket** is private.
  - `authenticated` may SELECT, as for `cc-source-snapshots` (`schemas/storage/tables/objects.sql:1-10`), and the bucket joins `AUTHENTICATED_READ_BUCKETS` in `tests/db/storage-isolation.test.ts`.
  - `workflow_run` read is Q7.
  - Only `service_role` writes.

**D8. One checklist version is written in one transaction, by one function.** `intake_sync_version(p jsonb) RETURNS jsonb`, SECURITY INVOKER, service_role only. It takes:
- one checklist row;
- one version (semver, label, format, hash, counts, `generated_by`, bureau commit, `is_current`);
- that version's commits;
- its group, item, citation and figure rows.

In a single transaction it does the following.
1. It upserts the `intake_checklists` row.
2. **If `(checklist_id, version)` already exists:**
   - with the same `content_hash`, it upserts the commits, applies step 6, and returns `{version, created: false}`;
   - with a different hash, it raises `version_hash_mismatch`, because someone changed content without bumping.
3. **It checks each figure's `storage_path`** exists in `storage.objects` for bucket `intake-figures`, and raises `figure_missing` if one doesn't.
4. **It checks identities.**
   - It upserts `intake_groups` and `intake_items`.
   - It sets `minted_in_version` for each new item, and `retired_in_version` for each item that left.
   - It raises `item_id_reused` if an item ID that was retired in an earlier version reappears (D4: numbers are never reused).
5. It inserts the version, its groups, items, citations and figures.
6. If `is_current` was passed, it clears the flag on the checklist's other versions and sets it on this one.

- **Why a function:** each PostgREST request is its own transaction. Writing a version and its rows as separate requests could leave a version with only some of its rows.
- **Why figures before rows:** Storage can't join the transaction. So bytes are uploaded first (D17), and the function refuses a version that names a missing object. A failed upload leaves only orphan blobs, which are harmless because they are content-addressed.
- **Nothing is ever deleted or updated in place,** apart from the identity tables' computed columns and `is_current`. Reviews may point at any version, and the next sync would overwrite a manual DB edit anyway (D19).

**D9. How the sync fills each column.** For each version dir that has a `version.yaml`:

| column | source |
|---|---|
| `version`, `format`, `generated_by` | `version.yaml` |
| `item_id`, `legacy_ref`, `derived_from` | `intake-ids.tsv` |
| `group_id`, the group `title`, `guide_path` | `intake-groups.tsv` and the guide's file name |
| `item_text`, `condition`, `location`, `location_binding`, `requirement_source`, `source_type` | the guide row's cells, by header name (a missing column → NULL) |
| `fail_status`, `fail_status_declared` | the `Fail Status` cell; `fail` and `false` when the table has no such column |
| `position` | guides ordered by the number in their file name, then items in table order. This reproduces `true-comment-num-mapping.tsv` exactly. |
| `comment_number` | `true-comment-num-mapping.tsv` if present, else `position` |
| `title` | `cc-item-title-mappings.tsv` if present, else NULL |
| citation rows | `source-citations.json` `items[ref].citations[]`; `stale` = its `item_text_sha` ≠ sha256(normalize(the `Item` cell)) |
| figure rows | `figures.yaml` |

- **The guide parser** reuses `guide-items.ts`'s rules: only tables whose first header cell is `ID`, and fenced blocks skipped. It is extended to return cells by header name, as cc-source-citations' `guides.py` does.
- **The runtime parser is different.** The runbook runs `checklist-policy.ts`, which reads by position. S1 holds a golden check that the two agree on refs and effective fail status for every synced version.
- **Overlays are not synced** (D19): `pape-dawson-comment-num-mapping.tsv` and `1700-s-lamar-forced-outcomes.tsv`.

**D10. The DB writes a version only when the semver is new, and checks the hash.** [north-star D9; D14]
- `content_hash` = sha256 of the canonical JSON of the version's group, item, citation and figure rows, with keys in a fixed order and rows sorted by position or id.
- The semver is the version's identity. The hash is the guard: the same semver with a different hash fails the job (D8 step 2).
- **Guide prose** is not stored, but it is still versioned: the linter requires a PATCH bump when prose changes (D14), so a review's version identifies the prose it read through git.

**D11. `is_current` follows `CURRENT_VERSION`.** For each checklist, the sync passes `is_current: true` only for the version declared by the dir that `CURRENT_VERSION` names. Because a revert is a new version (D14), the current version is always the newest one in that dir.

### 2.3 Lint and sync in bureau

**D12. `lint:intake` runs in CI on every PR and on every push to `main`.** It runs beside `lint:conventions` (`.github/workflows/ci.yml:683-687`) and fails on any of:

1. an `intake.yaml`, `checklist.yaml` or `version.yaml` that doesn't parse, breaks the D1 basis rule, or declares a `format` the tooling doesn't know;
2. a mismatch, in either direction, between `intake-ids.tsv`'s refs and the guide rows (`{stem}:{ID}`), or between `intake-groups.tsv`'s stems and the guide files;
3. an item or group ID that is duplicated within a version, doesn't match D4's or D15's pattern, or doesn't carry its checklist's prefix;
4. an ID number ≥ `next_item` / `next_group`, or a high-water mark lower than on `origin/main`;
5. a `derived_from` ID that belongs to another checklist, or is not lower-numbered than the item that names it;
6. **a declared semver smaller than the computed bump** against `origin/main` (D14);
7. **a figure mismatch:** a `## Figures` reference with no `figures.yaml` row or the reverse, a figure ID not prefixed by one of its items, or a figure whose sha256 is not in the `intake-figures` bucket. The last check needs the service key, which `sync-cc-sources.yml` already uses; on PRs from forks it is skipped with a warning;
8. **a table row whose cell count differs from its header's,** which catches unescaped pipes such as Cedar Park `cc-21.md:86`.

Rule 2 keeps the sidecars from drifting: a PR that edits a synced version's guide tables must update them in the same PR. It also catches a run of completion-officer's `tools/sync-to-bureau.sh`, which would copy its stale v2.7 guides, missing `CC-22-12`, over bureau's.

**D13. The sync is an `intake` job in `sync-conventions.yml`, after the `conventions` job.** [audit A9] It follows `sync-conventions` (`tooling/src/cli/sync-conventions.ts`).
- **Why one workflow:** intake-prospecting adds a `conventions.yaml` stub and an `intake.yaml` in the same PR for a new jurisdiction. Two independent workflows would race, and `intake_checklists.jurisdiction_slug`'s FK would fail whenever intake won. With `needs: conventions`, the jurisdiction row always exists first.
- **Triggers:** the workflow's paths gain `jurisdictions/*/intake.yaml`, `jurisdictions/*/completeness-check/**` and `intake/**`. `workflow_dispatch` is kept. The concurrency group doesn't cancel in progress.
- **Validation first:** the job runs every D12 check. Any failure → nothing is written and the exit code is non-zero.
- **Write order:**
  1. For each checklist, call `intake_sync_version()` once per version dir.
  2. Upsert `jurisdiction_intake` from each `intake.yaml`.
- **Reports:**
  - versions created and versions unchanged, per checklist;
  - any `jurisdiction_intake` row whose `intake.yaml` was removed. That row is kept and flagged unreconciled, mirroring conventions D33; it is never deleted.
- **On failure:** the job fails, and the alert step posts to Slack when `SLACK_WEBHOOK_URL` is set.
- **`--dry-run`:** builds and prints rows, hashes and computed bumps, and writes nothing.

---

## 3. Testing seams

**S1: the snapshot builder and linter, given a bureau tree** (new)
- **Proves:**
  - D3, D4, D15: sidecar and ID rules, including concurrent minting caught on `main`.
  - D9: column mapping, including a version with no title map and no citations, a table without `Fail Status` (stored as `fail`, not declared), and a stale citation.
  - D14: the computed bump for each kind of change: a removed item → MAJOR, an edited condition → MINOR, a moved item or edited prose → PATCH. A revert still bumps forward.
  - D17: figure manifest checks in both directions; a missing blob fails.
  - D12 rules 1–8, each with a failing fixture.
  - The golden check against `checklist-policy.ts` (D9).
  - The real Austin v2.7 tree builds 192 items `austin-0001` … `austin-0192`, 14 groups and comment numbers 1–192.
  - The history backfill builds one version per distinct folder state and resolves all 19 v2.7 reviews' commits (D5).
- **Prior art:** `bureau/tooling/src/lib/conventions/sync-conventions.test.ts`, which has no test runner and exits 1 on failure.
- **Runs:** `cd tooling && bun run test:intake` locally, and in `ci.yml` beside `test:conventions`.

**S2: `intake_sync_version()` and the tables** (new)
- **Proves:**
  - **D6 constraints reject:**
    - a baseline with a slug;
    - an item ID with another checklist's prefix (`new-braunfels-0007` in `new`);
    - `formal` with `generic`.
  - **D8:**
    - everything in a version lands together, and an invalid row rolls back the whole version;
    - the same semver with the same hash returns `created: false`;
    - the same semver with a different hash raises `version_hash_mismatch`;
    - a missing figure object raises `figure_missing`;
    - `minted_in_version` and `retired_in_version` are computed.
  - D11: `is_current` moves.
  - **D7:**
    - `authenticated` and `workflow_run` can read; `anon` cannot;
    - `authenticated` cannot execute the function or insert;
    - the bucket's policies hold.
- **Prior art:** `cityhall/tests/db/verdict-triage-split.test.ts` (a function plus its permissions, against the local stack), with `tests/db/support.ts` helpers; `tests/db/storage-isolation.test.ts` for the bucket.
- **Runs:** `pnpm test:db` in cityhall, on the local Supabase stack, in the `check` CI job.

**S3: 1.4-resolve and amend in the CC runbook** (existing seam, new cases)
- **Proves:**
  - D17: figures are hydrated from a stub bucket and verified; a hash mismatch stops the run.
  - D18: a v2.7 review recorded before P2a still amends after `intake-ids.tsv` lands; a real guide change still refuses.
- **Prior art:** `runbooks/completeness-check/steps/1.4-resolve/contract.test.ts`, and amend's tests beside `runbooks/lib/review_amend.py`.
- **Runs:** the CC runbook's contract tests, locally and in bureau CI.

**Acceptance (not a seam):** after P2b merges, `workflow_dispatch` the workflow, then against prod:
- `intake_checklist_versions` for `austin` holds one row per distinct v2.7 folder state. The newest is current.
- `intake_checklist_items` for the current version holds 192 rows.
- `intake_checklist_version_commits` resolves each of the 19 v2.7 reviews' `bureauCommitHash` to a version.
- `jurisdiction_intake` holds `austin | austin | formal`.

Dispatch again: no new versions.

---

## 4. PR plan

**P2a: the intake files, the linter, the Austin sidecars and the amend fix** (`bureau`)
- **Blocked by:** nothing (can start now). **It should merge before bureau#2112,** so the runbook's output is checked against the contract. #2112 then rebases and adds `version.yaml`, `intake-groups.tsv` and `generated_by.run_id`.
- **Delivers:**
  - `tooling/src/lib/intake/` schema, guide parser, bump calculator and linter; `cli/lint-intake.ts` and `cli/intake-mint.ts`; `lint:intake` + `test:intake` in `ci.yml`, on PRs and on `main`;
  - `jurisdictions/austin/intake.yaml`;
  - v2.7-trimmed's `intake-ids.tsv` (192 rows), `intake-groups.tsv` (14 rows) and `version.yaml`;
  - `intake/baseline/README.md` stating D2;
  - the amend change (D18): `checklistsContentHash` at 1.4-resolve, and amend's comparison.

  Lands D1–D4, D12, D14 (file side), D15 (file side), D16 and D18.
- **Tested at:** S1 (the linter half and the real Austin tree), S3 (amend).
- **Door:** two-way.
- **Blast radius:**
  - every bureau PR that edits v2.7-trimmed's guide tables must now update the sidecars and bump `version.yaml`. That is intended, but it changes Will's hand-editing workflow;
  - amend's comparison changes for every CC review.

**P1a: the `intake-figures` bucket and its policies** (`cityhall`)
- **Blocked by:** nothing. It is small, and figures are wanted soon.
- **Delivers:** the bucket, its storage policies, and the storage-isolation test entry. Lands D7's bucket half. Jason applies it.
- **Tested at:** S2 (bucket cases).
- **Door:** two-way (an empty bucket).
- **Blast radius:** none.

**P2c: figures in guides** (`bureau`)
- **Blocked by:** P1a, P2a.
- **Delivers:**
  - the `figures.yaml` schema and lint rule 7;
  - `cli/intake-figure-upload.ts`;
  - hydration in 1.4-resolve;
  - one guide with real figures (winston#312 Q1's pick).

  Lands D17. winston#312 P2 (`vision.ts --ref`) follows on top.
- **Tested at:** S1, S3.
- **Door:** two-way.
- **Blast radius:** runs on the version that adds figures; hydration is a no-op without `figures.yaml`.

**P1b: the tables and their write function** (`cityhall`)
- **Blocked by:** nothing technical. **It is scheduled after the intake-prospecting loop has met the Austin bar and at least one non-Austin smoke run has produced output in the format** (north-star D3 v1.1), so that north-star Q1/Q2 can still change the schema before the migration is applied.
- **Delivers:**
  - the ten table files;
  - `functions/intake_sync_version.sql`;
  - the generated migration;
  - allowlist entries;
  - `tests/db/intake-checklists.test.ts`.

  Lands D6, D7, D8 and D10's DB half. Jason applies the migration to prod before merge (AGENTS.md:114).
- **Tested at:** S2.
- **Door:** two-way (new, empty tables; a follow-up migration drops them).
- **Blast radius:** none. Nothing reads or writes these tables until P2b.

**P2b: the sync job and the history backfill** (`bureau`)
- **Blocked by:** P1b applied to prod; P2a merged.
- **Delivers:**
  - the snapshot builder and `lib/intake/sync.ts`;
  - `cli/sync-intake.ts` and its scripts;
  - the `intake` job in `sync-conventions.yml`;
  - `lib/intake/backfill-history.ts`, run once.

  Lands D5, D9, D10, D11 and D13. Then the acceptance run.
- **Tested at:** S1 (the builder and backfill half), then acceptance.
- **Door:** two-way. Rows in a synced copy that nothing reads; truncate and re-dispatch.
- **Blast radius:** a failing job alerts but blocks nothing. Because the intake job `needs: conventions`, a failing conventions job also holds back the intake sync.

---

## 5. Open questions

- **Q1. Backfill older Austin labels?** 41 of the 60 CC reviews ran on 8 other labels, plus one labelled `unknown`. D5's history backfill could walk those folders the same way. Not now (Will, 2026-10-14). Revisit when something needs to join old reviews to items.
- **Q2.** *Closed in v2:* a review will record its exact version as `intakeVersion` (D14), and history resolves through `intake_checklist_version_commits` (D5).
- **Q3. Cedar Park v1.** It has 21 guides and 220 items, all in tables with no `Fail Status`, plus a unified TSV. It has no title map, numbering maps or citations, and nobody has curated it. One row (`cc-21.md:86`, CC-21-07) has an unescaped `|` in its Item cell, which D12 rule 8 would now reject. Give it an `intake.yaml` and sidecars now as a second, sparse fixture, or wait for intake-prospecting to regenerate it?
- **Q4. Are regrouping and renumbering PATCH or MINOR?** Comment numbers are customer-visible. The default is PATCH (D14).
- **Q5. Where do semvers start?** The default is `1.0.0` for each checklist's first synced content (D5). Seeding Austin at `2.7.0` would echo the label, but the 194 → 192 removal on 07-09 would make it `3.0.0` at once.
- **Q6. What should review counting answer?** Per-item fail rates, reviews per version, reviews per jurisdiction? The proposed rules are in the review-linkage sibling (§6).
- **Q7. Can `workflow_run` read a Storage bucket?** No storage policy targets that role today. If it can't, cloud runs hydrate figures through a signed-URL step run with the service key at launch (D7, D17).
- **Q8. When does the source manifest get a stable `source_id`?** Today `source_key` means two things: a URL or `municode:…` in Austin's manifest, and a kebab slug in a prospecting manifest. The jurisdiction-pages spec (winston#316/#317, its D14 and P3) mints `source_id` in bureau as a separate field. Until then, `intake_checklist_citations.source_id` is NULL.

## 6. Not yet specified

- **Review linkage (a sibling spec, `intake/review-linkage`).** This covers:
  - 1.4-resolve stamping `intakeChecklist` and `intakeVersion`;
  - 2.9-comments adding each finding's stable `itemId` from the sidecar already in the run;
  - the runbook keying sections on `group_id`;
  - a view `intake_item_review_outcomes`, with one row per review × item, `agent_status`, `final_status`, `runs`, `votes` and `overridden`;
  - versioned item links in `/intake-checklists`.

  The audit's proposed counting rules (one count per review, whatever its run count; amends count once; promotions and overrides count the final verdict; test projects excluded) go there, pending Q6.
- **Refresh (a sibling spec, `intake/refresh`).** This keeps checklists current without a person:
  1. re-fetch the sources and compare their sha256 and etag with the manifest;
  2. re-extract the changed sources;
  3. match regenerated items to stable IDs;
  4. compute the bump;
  5. publish a bureau PR on prospector's autonomous path.

  Figures with `derived_from` are re-cut when their snapshot changes.
- **What the CC runbook does for a `none_found` jurisdiction.** It has to resolve its guides from `intake/baseline/` instead of `jurisdictions/<slug>/completeness-check/`. That belongs to the baseline sub-spec, together with filling the baseline.
- **Whether `/intake-checklists` reads from these tables** instead of the bucket. The jurisdiction-pages spec (winston#316/#317) builds on the bucket first and names these tables as its target (§D6's citation and figure rows).

## 7. Out of scope

- **The DB as the source of truth, and editing in the app.** Not planned (D19); reconsidered only on its triggers.
- **Moving guide prose into the DB.** Not needed while bureau is the source. Prose is versioned through D14's PATCH rule.
- **Renaming `completeness-check/` paths, `review_type` or `output_schema`.** That is the north-star rename sub-spec.
- **Changing Inspector General's `bureau_checklist_version` cache.** North-star Q6.
- **Formal-review checklists.** They are a different pipeline with different IDs.
- **The vision CLI's `--ref` and `--region` flags.** They are winston#312's P1 and P2. This spec gives them the figure manifest and hydrated files.
