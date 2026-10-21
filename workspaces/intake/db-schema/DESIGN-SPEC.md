# Intake checklist DB schema and the bureau sync

**Status:** Draft v3.1
**Date:** 2026-10-21
> **Revision note v3.1 (2026-10-21, Will):** §2.4 is rewritten. The second investment is a live `intake_groups` table with one rule, **files unless the DB has rows for the jurisdiction, else the DB**, not an overrides layer. Titles and order work under it at once; membership turns on when refs can be the stable item ID (P2a), and until then 1.4-resolve refuses a run whose live rows disagree with the files on membership. P3 and Q10 change to match; the sync mirrors the run (D9).
>
> **Revision note v3 (2026-10-21): the spec matches what exists, and says how the DB grows.** Checked against bureau main `f83e018a30`, cityhall main `acd1fdf`, winston main `5101394` and prod `mgxqsrjutswbciyrltwd` on 2026-10-21.
> - **D6 is the five-table set** the 2026-10-16 audit proposed and Will accepted: `intake_figures` (built), `intake_checklists`, `intake_checklist_versions`, `intake_checklist_groups`, `intake_checklist_items`. The identity tables, `intake_checklist_version_commits`, `intake_checklist_citations` and `jurisdiction_intake` are gone from the design (citations are jsonb on items; the assignment table waits for the baseline sub-spec).
> - **D17 is replaced by a record of what was built.** Figures are the first DB investment: `intake_figures` + the `intake-figures` bucket (cityhall#411, #419), the `intake-figure` CLI, hydration at 1.4-resolve, `vision.ts --ref` and the review prompt (bureau#2138, #2139, #2140, #2163). The specs are `../checklist-figures/`. There is no `figures.yaml`, no `next_figure`, and no figure lint rule; a guide cites a figure by id in its methodology bullet, so bureau still says how a figure is used.
> - **New D21: how the DB grows.** Bureau is the authority for checklist text. The DB takes bounded investments, one at a time, where files are the wrong store or where iterating in files costs too much. Each investment has the same shape as figures: one table, a run-token read at 1.4-resolve, provenance on the review. The candidate second investment is group placement (names, order, membership); §2.4 weighs it and Q10 asks Will.
> - **D20 is reworded to the order things actually landed:** `jurisdictions.code` exists in prod for `austin` (`AUS_TX`) and `cedar-park` (`CP_TX`), set by a cityhall data migration; `conventions.yaml` carries no `code:` yet, and the conventions sync does not know the column. P2a makes bureau the source without clobbering the two rows.
> - **New D22: El Paso's item IDs.** bureau#2123 merged with slug-prefixed IDs (`el-paso-0001` … `el-paso-0043`) and `checklist: el-paso`, against D20. No review cites them. They are renamed to `EP_TX-0001` … in one PR before anything does.
> - **D5 and D8 are simplified** to match: the 22 v2.7 reviews get `intakeVersion` stamped into their metadata once, and the sync function no longer handles identities, commits or figures.
> - **Problem facts refreshed:** 63 CC reviews (22 on v2.7-trimmed, 1 Cedar Park), 3 with a recorded figure set; 3 live figures in prod.
> - **D7 follows the figures build:** every intake table reads under the `jurisdictions` policy, not `USING (true)`.
> - Q7 closed (it was already closed in v2.2); Q10 new.
>
> **Revision note v2.2 (2026-10-16):** the tables audited for simplicity (`AUDIT-2026-10-16-tables.md`), Will accepted; Step 1 (figures, DB-first) moved to the sibling spec `../checklist-figures/`; Q7 closed.
> **Revision note v2.1 (2026-10-16, Will):** jurisdiction codes `{ABBR}_{ST}` (D20); figures get their own counter.
> **Revision note v2 (2026-10-16):** the 19-finding audit (`AUDIT-2026-10-14.md`) folded in: D14–D19, D5 rewritten, D13 rewritten.
> **Revision note v1.2 (2026-10-14):** factual corrections from the fact audit. **v1.1 (2026-10-14):** PR plan resequenced per north-star D3.

**Parent:** `workspaces/intake/north-star/NORTH-STAR-SPEC.md`, initiative I1 (D3). Carries out north-star D4–D9.
**Siblings:** `../checklist-figures/` (the first DB investment, built), `../prospecting-runbook/` (writes the files this spec defines).
**Repos touched:**
- `cityhall`: four App-DB tables still to build (`intake_checklists`, `intake_checklist_versions`, `intake_checklist_groups`, `intake_checklist_items`), one write function, tests. Built already: `intake_figures`, `jurisdictions.code`, the `intake-figures` bucket.
- `bureau`:
  - `conventions.yaml` gains `code:`, with its schema, lint and sync (D20);
  - `intake.yaml`, and per-version `version.yaml`, `intake-ids.tsv`, `intake-groups.tsv`;
  - a CI linter;
  - the sync library, CLI and job;
  - the Austin v2.7 history stamp (D5) and the El Paso ID rename (D22);
  - in the CC runbook, amend's content hash (D18). Built already: figure hydration, `--ref`, the figure set on reviews.

**Repos NOT touched:** `completion-officer` (being retired), `conductor` / `conductor2`, `inspector-general` (its `bureau_checklist_*` cache is unchanged, north-star Q6), `substation`, cc-source-citations (its manifest gains `source_id` under the jurisdiction-pages spec, not here).

## Problem

Intake (completeness-check) checklist items exist only as markdown tables in bureau guides, identified by legacy IDs that change whenever an item moves. One table in the DB now holds something about an item, a reference figure, and nothing holds the item itself. Verified 2026-10-21 unless dated otherwise:

- **The checklist is markdown.** `bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/` holds 14 guides (`cc-1.md` … `cc-24.md`) with 192 items.
  - **What counts as an item:** a row counts only if it sits in a table whose first header cell is `ID` (`runbooks/completeness-check/scripts/lib/guide-items.ts`).
  - **Columns:** `ID | Item | Condition | Location | Location Binding | Requirement Source | Source Type | Fail Status`. 71 rows, in 7 guides, sit in older tables that have no `Fail Status` column.
  - **Other parsers:** the runbook's own runtime parser is `workflows/completeness-check/scripts/checklist-policy.ts`, which reads columns by position, does not skip fences, and treats a missing `Fail Status` as `fail`. cc-source-citations has a third, `guides.py`, which reads by header name. On v2.7-trimmed all three return the same 192 refs.
- **Side files supply the rest.** `cc-item-title-mappings.tsv` (192 titles keyed by the composite ref `cc-1:CC-1-01`), `true-comment-num-mapping.tsv` (comment numbers 1–192 in numeric group order, bureau#2105), `source-citations.json` (keyed by the same ref; generated 2026-10-07; 9 of its `item_text`s no longer match the guide since #2057). The folder also holds `pape-dawson-comment-num-mapping.tsv`, `1700-s-lamar-forced-outcomes.tsv` and an empty `citation-overrides.json`.
- **IDs encode the group and are not stable.** `CC-15-09a/b` became `CC-15-09/14` in v2.5; `CC-2-23` was split into `CC-2-23` and `CC-2-24`. The v2.1–v2.3 folders carry hand-made `vX-to-vY-mapping.tsv` files.
- **The folder is edited in place.** v2.7-trimmed was created on 2026-07-07 as a copy of v2.6. Since then: the item count went from 194 to 192 on 07-09; guide edits through 2026-10-20 (#2057, then the figure citations in #2163 and #2175); the title map on 10-09; the numbering map on 10-13. So the label does not name one fixed set of content.
- **Reviews cite items only by string.** A CC review writes one `review_comments` row per item. The composite ref lives in `review_comments.output_json->'sourceFindings'[].ref` (`runbooks/lib/publish_review.py:1964-1970`). `review_checklist_comment_map.checklist_item_id`, which Inspector General fills, holds the same ref.
- **Reviews span 9 Austin labels and one Cedar Park dir.** Prod has 63 CC reviews. By `bureauArtifactPath`: v2.7-trimmed 22, v2.4-trimmed 12, v2.5-trimmed 10, v1 5, v2.6-trimmed 4, v2.1-trimmed 3, v2.3-trimmed 2, v2-trimmed 2, v2 1, Cedar Park v1 1, and one with no path. Reviews record `bureauCommitHash` and `checklistsTreeHash`; the 3 newest (2026-10-17 to 10-20) also record the figure set they ran with (`metadata.figures`).
- **The only DB copy of items is Inspector General's cache.** `bureau_checklist_version` + `bureau_checklist_item` has one version per `(bureau_commit_hash, department_code, bureau_artifacts_path)` and stores a `content_hash`. v2.7-trimmed alone is 14 versions over 6 distinct contents.
- **One DB table exists for intake now: `intake_figures`** (cityhall `supabase/schemas/public/tables/intake_figures.sql`, migrations `20261016210000` to `20261019181416`). Three live Austin rows: `AUS_TX-F0001` for `cc-15:CC-15-01` and `AUS_TX-F0002`/`F0003` for `cc-13:AW-23`. The bytes are in the private `intake-figures` bucket by sha256. Guides cite the figures by id in their methodology bullets (`cc-15.md:69`, `cc-13.md`). The CC runbook hydrates them at 1.4-resolve, attaches them with `bin/vision.ts --ref`, and records the set on the review. See `../checklist-figures/IMPLEMENTATION-DETAILS.md` and `iteration-2/`.
- **`jurisdictions.code` exists for two rows,** `austin = AUS_TX` and `cedar-park = CP_TX`, written by the cityhall data migration `20261016210200_jurisdiction_codes.sql`. No `conventions.yaml` declares a `code:`, and `tooling/src/cli/sync-conventions.ts` does not write the column.
- **El Paso has intake files in the old ID format.** `jurisdictions/el-paso/intake.yaml` (`checklist: el-paso`, `basis: formal`, `next_item: 44`) and `completeness-check/v1/intake-ids.tsv` with 43 rows `cc-1:el-paso-0001 → el-paso-0001`, written by intake-prospecting (bureau#2123, #2126). No `version.yaml`, no `intake-groups.tsv`. No CC review cites an El Paso item.
- **Nothing else from this spec exists in bureau:** no `tooling/src/lib/intake/`, no `lint:intake`, no `sync-intake`, no Austin sidecars.
- **Bureau holds no binaries.** 0 images and 0 PDFs. Figures went to Storage for that reason (D21).
- **Runbooks read the App DB and Storage through a per-run `workflow_run` token** (`cityhall/src/lib/runbook/run-token.ts:150-170`; bureau `runbooks/lib/app_client.py`). 1.3-facts reads `project_facts`; 1.4-resolve now reads `intake_figures` and the bucket the same way.
- **The precedent for the sync is the conventions sync.** `bureau/.github/workflows/sync-conventions.yml` runs `bun run sync:conventions` on merge to main, one way into `jurisdictions` + `jurisdiction_departments`, with a shared schema and linter (`tooling/src/lib/conventions/schema.ts`; winston#185).
- **How cityhall changes its schema.** `cityhall/AGENTS.md:111-127`: declarative schema in `supabase/schemas/`, migrations generated with `npx supabase@2.119.0 db schema declarative sync --no-apply -f <name>`; a `storage.buckets` row or a data change is a hand-written migration; every new table is in `pnpm test:db` or in `supabase/rls-isolation-allowlist.txt`. The figures work applied its own migrations from the implementing session (checklist-figures iteration-2 D8).

---

## 1. The design at a glance

**Bureau is the source of truth for checklist text; the App DB holds a read replica, plus bounded investments where files are the wrong store** (D19, D21). Every checklist version carries a semver that bureau declares and the linter checks (D14). Items and groups have stable IDs built from the jurisdiction's permanent code (`AUS_TX-0042`, `AUS_TX-G01`) that never encode position (D4, D15, D20). Figures are the first investment, already built (D17).

```diff
 bureau/
 ├── intake/
+│   └── baseline/                          # the generic baseline (north-star D4); filled by intake/baseline
 ├── jurisdictions/austin/
~│   ├── conventions.yaml                   # + code: AUS_TX (D20)
+│   ├── intake.yaml                        # which checklist, basis, evidence, next_item / next_group (D1)
 │   └── completeness-check/
 │       ├── CURRENT_VERSION                # v2.7-trimmed (unchanged)
 │       └── v2.7-trimmed/
 │           ├── cc-1.md … cc-24.md          # unchanged; a methodology bullet may cite a figure by id (D17)
 │           ├── cc-item-title-mappings.tsv, true-comment-num-mapping.tsv, source-citations.json   # read by the sync
 │           ├── pape-dawson-…tsv, 1700-s-lamar-…tsv, citation-overrides.json   # overlays, never synced (D19)
+│           ├── version.yaml                # semver, format, generated_by (D14, D16)
+│           ├── intake-ids.tsv              # ref → stable item id (D3)
+│           └── intake-groups.tsv           # guide stem → stable group id + title (D15)
 ├── jurisdictions/el-paso/
~│   ├── conventions.yaml                   # + code: EP_TX (D22)
~│   ├── intake.yaml                        # checklist: EP_TX (was el-paso)
~│   └── completeness-check/v1/intake-ids.tsv   # EP_TX-0001 … (was el-paso-0001 …)
 ├── runbooks/completeness-check/
 │   ├── scripts/cc.py                      # 1.4-resolve hydrates figures (built, D17)
~│   └── …/review_amend.py                  # + amend ignores the intake-only files (D18); figure set compared (built)
 ├── tooling/src/
 │   ├── lib/intake-figures/, cli/intake-figure.ts   # built (D17)
+│   ├── lib/intake/                        # schema, lint, bump, snapshot builder, sync, history stamp
+│   └── cli/{lint-intake,sync-intake,intake-mint}.ts
 └── .github/workflows/
~    └── sync-conventions.yml               # + code; + an `intake` job, `needs: conventions` (D13)

 cityhall/supabase/schemas/public/tables/
~├── jurisdictions.sql                      # code text null UNIQUE, UNIQUE (slug, code)   ← built (cityhall#411)
 ├── intake_figures.sql                     # built (cityhall#411, #419)
+├── intake_checklists.sql                  # one row per checklist
+├── intake_checklist_versions.sql          # one row per semver
+├── intake_checklist_groups.sql            # a group's place and title in a version
+└── intake_checklist_items.sql             # an item's place, content and citations in a version
 cityhall/supabase/schemas/public/functions/
+└── intake_sync_version.sql                # one version and everything in it, one transaction (D8)
```

**Flow:**
1. A bureau PR edits guides or sidecars. `lint:intake` checks the files and the semver bump (D12).
2. On merge, the `intake` job runs after the `conventions` job (D13).
3. For each version dir, the sync builds rows, hashes them, and calls `intake_sync_version()`.
4. That function writes the version only if its semver is new. A known semver arriving with a different hash fails the job (D8, D14).

**What the CC runbook sees:** the guides exactly as today, copied into the run (`cc.py`), with figures hydrated beside them (built). Amend compares a content hash that ignores the intake-only files, so adding them does not break amending older reviews (D18).

---

## 2. Decisions

### 2.1 Files in bureau

**D1. The `intake.yaml` file.** [Will, 2026-10-14] Each jurisdiction that has an intake assignment gets `jurisdictions/<slug>/intake.yaml`. Shape:

```yaml
# jurisdictions/austin/intake.yaml
checklist: AUS_TX                     # own checklist id (= the jurisdiction's code, D20) or `GENERIC`
basis: formal                         # formal | none_found | inconclusive  (north-star D5)
application_type: Consolidated Site Plan   # what the checklist covers (north-star Q2); free text
path: completeness-check              # versions dir, relative to the jurisdiction (own checklists only)
next_item: 195                        # high-water mark for item ids (D4); own checklists only
next_group: 15                        # high-water mark for group ids (D15); own checklists only
evidence:
  summary: >-
    Austin runs a formal Completeness Check before technical review …
  sources:
    - { label: CC Submittal Checklist, url: "https://…" }
decided_by: will                      # who ruled on the basis: a person, or a runbook_runs uuid
decided_at: 2026-10-14
```

- **A jurisdiction on the baseline** sets `checklist: GENERIC` and a `basis` of `none_found` or `inconclusive`, and has no `path`, `next_item` or `next_group`.
- **Absence is meaningful:** no `intake.yaml` means no assignment, which is different from `none_found`.
- **Validation:** `tooling/src/lib/intake/schema.ts` is the single parser, shared by the linter and the sync.
- **The rule for `basis`:** `formal` requires `checklist` = the jurisdiction's code (D20); any other basis requires `GENERIC`.
- **`decided_by` means one thing:** who ruled on the basis. The run that generated a version is in `version.yaml` (D16). For a run it is the `runbook_runs` uuid. El Paso's file holds the run name `el-paso`; P2a fixes it with D22.
- There is no `next_figure`: figure ids are minted in the DB (D17).

**D2. The baseline lives at `bureau/intake/baseline/`,** outside `jurisdictions/`, with the same layout as a jurisdiction's versions dir plus `checklist.yaml` (`id: GENERIC`, `name`, `next_item`, `next_group`). This spec defines the location and the schema only; the folder stays empty until the `intake/baseline` sub-spec fills it.

**D3. An item sidecar per version: `<version>/intake-ids.tsv`.** Columns `ref` (`cc-1:CC-1-01`, the composite ref reviews store), `id` (`AUS_TX-0001`, D4), `derived_from` (optional, comma-separated). Per version because refs change between versions. New jurisdictions put the stable ID directly in the guide's ID column, so the sidecar maps `cc-1:EP_TX-0007 → EP_TX-0007`. El Paso's v1 already has this file (D22).

**D4. Item ID format and minting.** [north-star D6] `{checklist id}-{NNNN}`, matching `^([A-Z]{2,8}_[A-Z]{2}|GENERIC)-[0-9]{4,}$`. A new item takes `next_item` from `intake.yaml` (or the baseline's `checklist.yaml`) and the same PR increments it; `bun run intake:mint <checklist> [n]` does both. Edits keep the ID; a split or merge mints new IDs and records `derived_from`; a move keeps the ID. Concurrent PRs are caught by `lint:intake` on `main`, by the sync refusing an ID whose first appearance differs between versions, and by the mint helper re-reading `origin/main`.

**D5. Backfill Austin v2.7-trimmed's history by stamping the reviews, not with a lookup table.** [audit 2026-10-16 T2; replaces v2's commit table]
- The label v2.7-trimmed has named 20 commits of edits, and the 22 v2.7 reviews ran on several folder states. A single backfilled version would resolve none of them.
- **How:** `tooling/src/lib/intake/backfill-history.ts`, run once: walk `git log -- jurisdictions/austin/completeness-check/v2.7-trimmed`, build the version rows for each distinct content state in commit order, assign each a semver under D14 starting at `1.0.0` (Q5), and sync them. Then, for each of the 22 reviews, resolve its `bureauCommitHash` to the newest folder commit that is its ancestor, and **write `intakeVersion` into `reviews.metadata`** once. From P2a on, 1.4-resolve stamps it at run time (review-linkage sibling), so no commit lookup is ever needed again.
- **IDs:** `AUS_TX-0001` … `AUS_TX-0192` in today's `true-comment-num-mapping.tsv` order. Day one is a coincidence: nothing may derive a comment number from an ID. The two items that left on 07-09 get `0193` and `0194`, retired in the version that dropped them; `next_item` starts at 195.
- **Scope:** the other 10 Austin dirs are not backfilled (Q1).

**D14. Every version declares a semver in `<version>/version.yaml`** (`version`, `format`, optional `generated_by`). The folder label stays as the version's `label`. The linter computes the smallest bump by diffing against `origin/main`: MAJOR when an item ID leaves; MINOR when an item is added or what it checks changes (`item_text`, `condition`, `location`, `location_binding`, `requirement_source`, `source_type`, `fail_status`); PATCH for anything else (titles, citations, group placement and order, group titles, comment numbers, prose, a figure citation in a bullet). Q4 asks whether regrouping is PATCH. A revert is a new version. Reviews record the version as `intakeVersion` (review-linkage sibling). `format` is an integer.

**D15. Groups have stable IDs, apart from their guide file and their number.** The ID is `{checklist}-G{NN}`, minted from `next_group`. `<version>/intake-groups.tsv` maps each guide stem to `group_id` and `title` (the H1 without its `CC-N:` number). In the DB, moving an item changes only its `group_id` and `position` in the new version. The runbook still keys sections on the H1 and refs on the stem; moving it to `group_id` is the review-linkage sibling's job. See also D21 and §2.4 for making group placement a DB investment.

**D16. A version records the run that generated it** in `version.yaml`'s `generated_by` block (`runbook`, `run_id` = the `runbook_runs` uuid, `run_name`, `runbook_commit`). Hand edits leave it out. The sync derives each item's `minted_in_version` and `retired_in_version` from version history when a reader wants them (a view, not columns).

**D17. Reference figures: built, DB-first, with the guide saying how a figure is used.** [replaces v2's D17; audit A19, T4, T9; Will 2026-10-16 and 2026-10-19]
- **What exists:** `intake_figures` (one row per figure: `id`, `jurisdiction_slug`, `jurisdiction_code`, `item_refs`, `description`, `sha256`, `storage_path`, `media_type`, `px_w`, `px_h`, `bytes`, `derived_from`, `created_at`, `created_by`, `retired_at`; composite FK to `jurisdictions(slug, code)`; CHECKs tie the id prefix and `storage_path` to the code and hash), the private `intake-figures` bucket (`<code>/<sha256>.<ext>`, never overwritten; read by `workflow_run` bucket-wide and by a user through a row they can see), the `intake-figure upload|retire|list` CLI (service key), hydration at 1.4-resolve into `checklist/figures.json` and `checklist/figures/<id>.<ext>` (hash verified, host cache), `bin/vision.ts --ref <id>` (≤ 4, the figure's id and description, resized, logged), the review-prompt bullet, and `metadata.figures` on the review with amend comparing the set.
- **Where the authority sits:** the DB holds the image and a neutral description. **The guide's Validation Methodology bullet cites the figure by id and says what it is for** (iteration-2 D1). `item_refs` is for people to read; the run does not check it.
- **Not versioned with the checklist.** A figure is live from `created_at` to `retired_at`; a review pins the set it saw by hash. The replica (D6) carries no figure rows and no figure counts.
- **Not built:** the figures view on the intake-checklists pages (checklist-figures P5).
- **Specs:** `../checklist-figures/DESIGN-SPEC.md` (v1, as planned), `IMPLEMENTATION-DETAILS.md` (as built, with the divergences), `iteration-2/DESIGN-SPEC.md` (the one-column change, built).

**D18. Review amend ignores the intake-only files.** [audit A8] Amend compares `checklistsTreeHash` (`cc.py`, `review_amend.py`). Adding `intake-ids.tsv` would make every pre-sidecar v2.7 review un-amendable. From P2a, 1.4-resolve also records `checklistsContentHash`: a sha256 over the files a run reads, sorted by path, excluding `intake-ids.tsv`, `intake-groups.tsv` and `version.yaml`. Amend compares content hashes when the review has one, else recomputes the content hash of the review's own commit. The figure set is compared separately, as built.

**D19. Bureau stays the source of truth for checklist text. The DB is a read replica, and per-customer variants become DB overlays.** [audit A18; north-star D7] The flip is not planned; it is reconsidered only on three triggers (people who don't use git must change items routinely; customers need variants; fixes must reach live reviews within minutes). Overlays (`1700-s-lamar-forced-outcomes.tsv`, `pape-dawson-comment-num-mapping.tsv`) stay out of the version, its bump and the sync (north-star Q8).

**D20. Every jurisdiction gets a permanent code, `{ABBR}_{ST}`, and intake IDs are built from it.** [Will, 2026-10-16; amends north-star D6; reworded v3 to the order things landed]
- **Format:** `^[A-Z]{2,8}_[A-Z]{2}$`. Austin `AUS_TX`, El Paso `EP_TX`, New Braunfels `NB_TX`, Cedar Park `CP_TX`; a county takes a distinguishing abbreviation (`EPCO_TX`, Q9); `GENERIC` is the baseline.
- **Where it lives today:** `jurisdictions.code` (nullable, UNIQUE, the format CHECK, `UNIQUE (slug, code)`) exists in prod with two rows set by a data migration. No `conventions.yaml` declares it.
- **Where it lives after P2a:** `code:` in each jurisdiction's `conventions.yaml` is the source. The conventions schema requires it for any jurisdiction that has an `intake.yaml` or a figure; `lint:conventions` refuses a code that differs from the column's existing value (permanence), a change to the code of any jurisdiction that has intake IDs, and a code another jurisdiction uses. `sync-conventions` writes `code` only when the file declares it, so a declared value must match prod's or the lint fails first, and an undeclared one leaves the column alone.
- **Uses:** `intake_checklists.id` is the code; items `AUS_TX-0042`, groups `AUS_TX-G01`, figures `AUS_TX-F0001`; the composite FK `(jurisdiction_slug, id) → jurisdictions(slug, code)`, which `intake_figures` already uses. Slugs stay as the `jurisdictions` key, in paths and URLs.

**D21. How the DB grows: bounded investments, one at a time, with bureau as the authority.** [Will, 2026-10-21]
- **Bureau is the authority for checklist text** (D19). The DB is not a second place to edit it.
- **An investment is made where files are the wrong store, or where iterating in files costs too much to be worth a PR per try.** Binaries were the first case: bureau tracks no images, and figures would bloat the repo forever. Presentation metadata that people want to tune quickly is the second kind of case (§2.4).
- **Every investment has the same shape,** so the runbook and the app learn one pattern: one table (plus a bucket when there are bytes), keyed by the jurisdiction's code; read by the CC runbook at 1.4-resolve through the run token and copied into the run folder; recorded on the review so amend and provenance see it; shown on the intake-checklists pages; written by a CLI with the service key, not by an app page, until an editor is needed. A guide may cite a DB row by id, as it cites a figure, but the guide's text is never generated from the DB.
- **The replica (D6's other four tables) is not an investment;** it is derived from bureau and overwritten by the sync. The two kinds never share a table.
- **Order:** figures (built) → the candidate in §2.4 on Will's call (Q10) → the replica when something reads it (P1b, P2b).

**D22. El Paso's item IDs are renamed to the code form before any review cites them.** [v3; corrects what bureau#2123 merged]
- `jurisdictions/el-paso/intake.yaml` gets `checklist: EP_TX` and `decided_by` set to the run's `runbook_runs` uuid (or a person), `conventions.yaml` gets `code: EP_TX`, and `completeness-check/v1/intake-ids.tsv` plus the guides' ID columns are rewritten `el-paso-NNNN → EP_TX-NNNN`, keeping the numbers. The jurisdiction-pages bucket copy (`cc-source-snapshots/el-paso/…`) republishes on merge, so its item keys change too.
- One PR, in P2a, with the `EP_TX` row added to `jurisdictions.code` by the same conventions-sync change. No CC review cites an El Paso item, so nothing resolves through the old IDs.
- intake-prospecting's `3.1-write` must mint the code form from then on (prospecting-runbook spec).

### 2.2 Tables in cityhall

**D6. Five tables, keyed naturally rather than by uuid.** [north-star D5, D6; audit 2026-10-16 T1–T6; Will prefers short IDs to uuids]

```sql
-- the investment (built): figures
intake_figures            -- as built, see D17; keyed by id 'AUS_TX-F0001'; FK (jurisdiction_slug, jurisdiction_code) → jurisdictions(slug, code)

-- the replica (to build)
intake_checklists
  id                text PK          -- 'AUS_TX' | 'GENERIC'   CHECK (id ~ '^([A-Z]{2,8}_[A-Z]{2}|GENERIC)$')
  kind              text NOT NULL    -- 'jurisdiction' | 'baseline'
  jurisdiction_slug text NULL        -- NULL on the baseline
  name              text NOT NULL
  bureau_path       text NOT NULL    -- 'jurisdictions/austin/completeness-check' | 'intake/baseline'
  basis             text NOT NULL    -- 'formal' on an own checklist; the baseline row holds 'baseline'
  application_type  text NULL
  evidence          jsonb NOT NULL DEFAULT '{}'   -- intake.yaml's evidence block, verbatim
  decided_by        text NULL
  decided_at        date NULL
  bureau_commit     text             -- last sync that touched this row
  created_at, updated_at
  CHECK ((kind = 'baseline') = (jurisdiction_slug IS NULL))
  CHECK ((kind = 'baseline') = (id = 'GENERIC'))
  FK (jurisdiction_slug, id) → jurisdictions(slug, code)

intake_checklist_versions
  checklist_id      text FK → intake_checklists
  version           text             -- semver '1.4.2'
  major, minor, patch int NOT NULL   -- for ordering
  label             text NOT NULL    -- the folder name, 'v2.7-trimmed'
  format            int NOT NULL
  content_hash      text NOT NULL    -- sha256 of the canonical group and item rows (D10)
  is_current        boolean NOT NULL DEFAULT false
  generated_by      jsonb NULL       -- version.yaml's block (D16)
  bureau_commit     text NOT NULL    -- the commit that introduced this content
  commits           text[] NOT NULL  -- every folder commit that carried this content (D5)
  synced_at         timestamptz NOT NULL DEFAULT now()
  PK (checklist_id, version)
  UNIQUE (checklist_id) WHERE is_current

intake_checklist_groups
  checklist_id, version              FK → intake_checklist_versions
  group_id          text             -- 'AUS_TX-G01'   CHECK (group_id ~ ('^' || checklist_id || '-G[0-9]{2,}$'))
  position          int NOT NULL     -- the display number comes from here
  title             text NOT NULL    -- 'Intake & Core Submittal', no number
  guide_path        text NOT NULL    -- 'cc-1.md'
  PK (checklist_id, version, group_id)

intake_checklist_items
  checklist_id, version              FK → intake_checklist_versions
  item_id           text             -- 'AUS_TX-0042'   CHECK (item_id ~ ('^' || checklist_id || '-[0-9]{4,}$'))
  group_id          text             FK (checklist_id, version, group_id) → intake_checklist_groups
  position          int NOT NULL     -- across the version (guides by number, then table order)
  comment_number    int NOT NULL
  legacy_ref        text NULL        -- 'cc-1:CC-1-01', what reviews store
  title             text NULL        -- authored title; NULL when the version has no title map
  item_text         text NOT NULL    -- the `Item` cell
  condition, location, location_binding, requirement_source, source_type   text NULL
  fail_status       text NOT NULL    -- the value the runtime uses: 'fail' | 'warn' | 'fail-or-warn'
  fail_status_declared boolean NOT NULL  -- false where the guide's table has no Fail Status column
  derived_from      text[] NULL      -- ids this item was split or merged from (D4)
  citations         jsonb NOT NULL DEFAULT '[]'  -- source-citations.json's list for the item, each with `stale` computed by the sync
  PK (checklist_id, version, item_id)
  UNIQUE (checklist_id, version, legacy_ref)
  UNIQUE (checklist_id, version, comment_number)
```

- **What left since v2.1, and why** (`AUDIT-2026-10-16-tables.md`): the identity tables held nothing a view can't derive (`minted_in_version` = the first version containing the id; `retired_in_version` = the first version after its last appearance). The commit lookup served 22 reviews, which get stamped instead (D5); `commits text[]` keeps the audit trail. Citations as rows had no reader: the jurisdiction page reads them from the bucket. The assignment table waits for the baseline; until then every checklist jurisdiction is `formal`, so the assignment columns sit on `intake_checklists`. The figure tables became the one built table.
- **No row has a uuid.** A version is `('AUS_TX', '1.4.2')` and an item in it is `('AUS_TX', '1.4.2', 'AUS_TX-0042')`. The anchored CHECKs keep an ID inside its own checklist.
- **"Items for jurisdiction X"** is `WHERE checklist_id = (SELECT code FROM jurisdictions WHERE slug = X)`, one subquery; Will's earlier `jurisdiction_slug` column on items went with the identity table.
- **`fail_status` stores the runtime's value** (`checklist-policy.ts` treats a missing column as `fail`), with `fail_status_declared = false` on the 71 Austin rows that have no column.
- **Citations become rows** only when a cross-item query exists (the jurisdiction-pages spec's "every region on snapshot X" is the candidate).

**D7. Access: reference data, read under the `jurisdictions` policy, written only by the sync.** [follows the figures build]
- RLS on for every table. `authenticated` reads a row whose checklist's jurisdiction the `jurisdictions` policy shows them (staff see all); `workflow_run` reads with `USING (true)` plus the explicit `GRANT SELECT`, as `jurisdictions` and `intake_figures` do. No `anon` access.
- Writes come only from `service_role` through `intake_sync_version()` (D8), SECURITY INVOKER, EXECUTE revoked from `PUBLIC`, `anon` and `authenticated`.
- Every table goes in `supabase/rls-isolation-allowlist.txt` as `reference`, beside `jurisdictions` and `intake_figures`.

**D8. One checklist version is written in one transaction, by one function.** `intake_sync_version(p jsonb) RETURNS jsonb` takes one checklist row, one version (semver, label, format, hash, `generated_by`, bureau commit, commits, `is_current`) and its group and item rows. In one transaction: upsert the checklist row; if `(checklist_id, version)` exists with the same hash, merge `commits`, apply the current flag and return `{created: false}`, with a different hash raise `version_hash_mismatch`; raise `id_reused` if an item id that an earlier version retired reappears; insert the version, groups and items; move `is_current` if asked. Nothing is deleted or updated in place apart from `commits` and `is_current`.

**D9. How the sync fills each column.** `version`, `format`, `generated_by` from `version.yaml`; `item_id`, `legacy_ref`, `derived_from` from `intake-ids.tsv`; `group_id`, `title`, `guide_path` from `intake-groups.tsv` and the file name; the content cells from the guide row by header name; `fail_status` and `fail_status_declared` from the `Fail Status` cell; `position` from guide number then table order (reproduces `true-comment-num-mapping.tsv` exactly); `comment_number` from that file if present, else `position`; `title` from `cc-item-title-mappings.tsv` if present; `citations` from `source-citations.json`, each with `stale` = its `item_text_sha` ≠ sha256(normalize(the `Item` cell)). The guide parser reuses `guide-items.ts`'s rules and is extended to return cells by header name; S1 holds a golden check that it agrees with `checklist-policy.ts` on refs and effective fail status. Overlays are not synced (D19).

**D10. The DB writes a version only when the semver is new, and checks the hash.** `content_hash` = sha256 of the canonical JSON of the version's group and item rows (citations included), keys in a fixed order, rows sorted by position or id. Guide prose is not stored but is versioned through D14's PATCH rule.

**D11. `is_current` follows `CURRENT_VERSION`.** The sync passes `is_current: true` only for the version declared by the dir that `CURRENT_VERSION` names; because a revert is a new version, that is always the newest one in the dir.

### 2.3 Lint and sync in bureau

**D12. `lint:intake` runs in CI on every PR and on every push to `main`,** beside `lint:conventions`, and fails on:
1. an `intake.yaml`, `checklist.yaml` or `version.yaml` that doesn't parse, breaks the D1 basis rule, or declares an unknown `format`;
2. a mismatch, in either direction, between `intake-ids.tsv`'s refs and the guide rows, or between `intake-groups.tsv`'s stems and the guide files;
3. an item or group ID that is duplicated within a version, doesn't match D4's or D15's pattern, or doesn't carry its checklist's code;
4. an ID number ≥ `next_item` / `next_group`, or a high-water mark lower than on `origin/main`;
5. a `derived_from` ID that belongs to another checklist, or is not lower-numbered than the item that names it;
6. a declared semver smaller than the computed bump against `origin/main` (D14);
7. a table row whose cell count differs from its header's (catches Cedar Park `cc-21.md:86`);
8. a methodology bullet that cites a figure id of the wrong jurisdiction or in the wrong format (the id's existence is checked at run time by hydration, D17).

Rule 2 keeps the sidecars from drifting: a PR that edits a synced version's guide tables must update them in the same PR.

**D13. The sync is an `intake` job in `sync-conventions.yml`, after the `conventions` job.** intake-prospecting adds a `conventions.yaml` stub and an `intake.yaml` in the same PR, so two workflows would race on the FK. Triggers gain `jurisdictions/*/intake.yaml`, `jurisdictions/*/completeness-check/**` and `intake/**`. Validation first (every D12 check); then `intake_sync_version()` once per version dir; then the `intake_checklists` assignment columns from each `intake.yaml`. A removed `intake.yaml` leaves its row and flags it unreconciled. On failure the job fails and alerts; `--dry-run` writes nothing.

### 2.4 The next investment: group placement

[Will, 2026-10-21; rewritten v3.1 on Will's rule]

**What Will wants:** to play with group names, group order and which items sit in which group without a bureau PR per try.

**The rule: files unless the DB has rows for the jurisdiction, else the DB.** One source per jurisdiction at a time. There is no override layer and no merge: when live `intake_groups` rows exist for a jurisdiction, they define its groups; when none exist, the guide files do, exactly as today. The review records which source it used and a hash of the group set it ran with, as it records the figure set.

**The table,** DB-authored and live, in D21's shape (not the replica's per-version `intake_checklist_groups`, which the sync overwrites from bureau):

```sql
intake_groups
  id                text PK          -- 'AUS_TX-G01'; minted max + 1 per jurisdiction; never reused
  jurisdiction_slug text NOT NULL
  jurisdiction_code text NOT NULL    -- FK (jurisdiction_slug, jurisdiction_code) → jurisdictions(slug, code)
  stem              text NOT NULL    -- the guide file this group is, 'cc-1'
  title             text NOT NULL    -- 'Intake & Core Submittal', no number
  position          int NOT NULL     -- the display number and the comment-number order
  item_refs         text[] NOT NULL  -- the items in this group, as refs today and stable ids after P2a
  created_at        timestamptz NOT NULL DEFAULT now()
  created_by        text NULL
  retired_at        timestamptz NULL -- a changed group is a new row; the old one is retired
  CHECK (id ~ '^[A-Z]{2,8}_[A-Z]{2}-G[0-9]{2,}$')
  CHECK (split_part(id, '-', 1) = jurisdiction_code)
  UNIQUE (jurisdiction_code, stem) WHERE retired_at IS NULL
  UNIQUE (jurisdiction_code, position) WHERE retired_at IS NULL
```

Reads follow the `jurisdictions` policy; `workflow_run` reads all; only `service_role` writes, through a CLI `intake-group set|retire|list` in the shape of `intake-figure`. The whole live set for a jurisdiction is written together, because the rule is all-or-nothing per jurisdiction.

**What the run does with it, by attribute.** To the runbook a group *is* a guide file today (D15): one review agent per file, the ref is `stem:ID`, the section slug comes from the H1, comment numbers follow guide order.

| Attribute | With live rows, 1.4-resolve … | When it turns on |
|---|---|---|
| **Title** | writes `checklist/groups.json`; 2.9-comments takes the section title from it instead of the H1 | with the table |
| **Order** | the same file; 2.9-comments numbers comments by `position` instead of `true-comment-num-mapping.tsv` | with the table (comment numbers are customer-visible, Q4; a published review keeps its numbers) |
| **Membership** | regenerates each guide copy: the H1, then the item table rows and their methodology bullets for the group's `item_refs`, pulled from bureau's files by item; records a content hash of the generated files | **after P2a**, when the ref can be the stable item ID. Until then, 1.4-resolve **refuses the run** if the live rows' membership differs from the files, naming the items that moved |

- **Why membership waits for stable IDs:** moving an item between files changes its ref (`cc-2:X` → `cc-5:X`) between two reviews of the same bureau version. Amend matches comments by ref and Inspector General's comment map keys on it, so both would lose continuity. With stable IDs the ref is the ID and a regroup changes nothing a review stores.
- **Provenance:** with live rows the tree hash no longer pins what the agents read, so the review records `groups: {source: 'db', hash}` beside `checklistsTreeHash` and the figure set, and amend compares it (D18).
- **The sync mirrors the run (D9):** when live rows exist for a jurisdiction, the replica's `intake_checklist_groups` and each item's `group_id` and `position` are written from them, else from the files. Replica and run never disagree.
- **Group-level prose** (anything in a guide outside the item table and the per-item bullets) stays with the file it is in; a regenerated guide carries the prose of the file whose stem it keeps. Q10 asks whether that is enough.

**What it does not do:** change comment numbers on published reviews, or let a guide's text be generated from the DB beyond moving rows and bullets between files (D21).

---

## 3. Testing seams

**S1: the snapshot builder and linter, given a bureau tree** (new)
- **Proves:** D3, D4, D15, D20, D22: sidecar and ID rules for items and groups, concurrent minting caught on `main`, a changed code refused once intake IDs exist, El Paso's renamed tree lints clean. D9: column mapping, a version with no title map and no citations, a table without `Fail Status`, a stale citation. D14: the computed bump for each kind of change; a revert still bumps forward. D12 rules 1–8, each with a failing fixture. The golden check against `checklist-policy.ts`. The real Austin v2.7 tree builds 192 items, 14 groups and comment numbers 1–192; the history stamp resolves all 22 v2.7 reviews' commits (D5).
- **Prior art:** `bureau/tooling/src/lib/conventions/sync-conventions.test.ts`.
- **Runs:** `cd tooling && bun run test:intake` locally, and in `ci.yml` beside `test:conventions`.

**S2: `intake_sync_version()` and the four replica tables** (new)
- **Proves:** D6 constraints reject a baseline with a slug, an item ID with another checklist's code, a checklist whose id isn't its jurisdiction's code. D8: everything in a version lands together and an invalid row rolls back the whole version; the same semver with the same hash returns `created: false`; a different hash raises `version_hash_mismatch`; a retired id reappearing raises `id_reused`. D11: `is_current` moves. D7: the `jurisdictions`-policy read for `authenticated`, `USING (true)` for `workflow_run`, nothing for `anon`; `authenticated` cannot execute the function.
- **Prior art:** `cityhall/tests/db/intake-figures.test.ts` (the figures table's RLS and CHECKs, built), `tests/db/verdict-triage-split.test.ts`, `tests/db/child-table-rls.test.ts:104-122` (`writeAs("workflow_run", …)`).
- **Runs:** `pnpm test:db` in cityhall, on the local Supabase stack, in the `check` CI job.

**S3: amend in the CC runbook** (existing seam, new case)
- **Proves:** D18: a v2.7 review recorded before P2a still amends after `intake-ids.tsv` lands; a real guide change still refuses; the figure-set refusal (built) still holds.
- **Prior art:** amend's tests beside `runbooks/lib/review_amend.py`; `steps/1.4-resolve/contract.test.ts`.
- **Runs:** the CC runbook's contract tests and `runbooks/lib` tests, locally and in bureau CI.

**Acceptance (not a seam):** after P2b merges, `workflow_dispatch` the workflow, then against prod: `intake_checklist_versions` for `AUS_TX` holds one row per distinct v2.7 folder state, the newest current; `intake_checklist_items` for it holds 192 rows; each of the 22 v2.7 reviews has `metadata.intakeVersion`; `intake_checklists` holds `AUS_TX | formal` and `EP_TX | formal`. Dispatch again: no new versions.

---

## 4. PR plan

**Done:**
- **P1a (cityhall#411, #419):** `jurisdictions.code` with Austin's and Cedar Park's values, `intake_figures`, the `intake-figures` bucket and policies. Lands D20's DB half and D17.
- **P2c (bureau#2138, #2139, #2140, #2163, #2175):** the figure CLI, hydration, `--ref`, the prompt, the figure set on reviews, three figures cited from CC-15 and CC-13. Lands D17.

**P2a: codes in conventions, the intake files, the linter, the Austin sidecars, the El Paso rename, the amend fix** — `bureau`
- **Blocked by:** nothing (P1a is applied).
- **Delivers:** `code:` in `conventions.yaml` for Austin, Cedar Park and El Paso, with the schema, lint (format, uniqueness, permanence, agreement with prod) and the sync writing the column only when declared (D20); `tooling/src/lib/intake/` schema, guide parser, bump calculator and linter, `cli/lint-intake.ts`, `cli/intake-mint.ts`, `lint:intake` + `test:intake` in `ci.yml`; `jurisdictions/austin/intake.yaml`; v2.7-trimmed's `intake-ids.tsv` (192 rows), `intake-groups.tsv` (14 rows) and `version.yaml`; El Paso's rename and `version.yaml` (D22); `intake/baseline/README.md` (D2); `checklistsContentHash` at 1.4-resolve and amend's comparison (D18). Lands D1–D4, D12, D14 (file side), D15 (file side), D16, D18, D20, D22.
- **Tested at:** S1, S3.
- **Door:** two-way.
- **Blast radius:** every bureau PR that edits v2.7-trimmed's guide tables must update the sidecars and bump `version.yaml`; amend's comparison changes for every CC review; El Paso's jurisdiction page keys change on republish.

**P1b: the four replica tables and the write function** — `cityhall`
- **Blocked by:** nothing technical; scheduled after the intake-prospecting loop has met the Austin bar and one non-Austin run has produced output in the format (north-star D3), so north-star Q1/Q2 can still change the shape. El Paso's v1 is that non-Austin output once D22 lands.
- **Delivers:** the four table files, `functions/intake_sync_version.sql`, the generated migration, allowlist entries, `tests/db/intake-checklists.test.ts`. Lands D6, D7, D8, D10's DB half.
- **Tested at:** S2.
- **Door:** two-way (empty tables).
- **Blast radius:** none until P2b.

**P2b: the sync job and the history stamp** — `bureau`
- **Blocked by:** P1b applied to prod; P2a merged.
- **Delivers:** the snapshot builder and `lib/intake/sync.ts`; `cli/sync-intake.ts`; the `intake` job in `sync-conventions.yml`; `lib/intake/backfill-history.ts`, run once, including the review stamp. Lands D5, D9, D10, D11, D13. Then the acceptance run.
- **Tested at:** S1, then acceptance.
- **Door:** two-way (rows nothing reads; truncate and re-dispatch; the review stamp is one metadata key).
- **Blast radius:** a failing job alerts but blocks nothing.

**P3: live groups** — `cityhall` + `bureau`
- **Blocked by:** nothing technical for titles and order; membership waits for P2a.
- **Delivers:** `intake_groups`, its RLS, allowlist entry and test; `intake-group set|retire|list`; 1.4-resolve reads the live rows into `checklist/groups.json`, refuses a membership change until P2a, and records the source and hash on the review; 2.9-comments takes titles and order from the file when present; amend compares the group set; the sync mirrors the rule; the jurisdiction page shows the live groups. Lands §2.4 under D21. After P2a, a second PR turns membership on: regenerated guide copies keyed by stable ID.
- **Tested at:** S2 (the table), the 1.4-resolve contract (files-only, DB-present, and the membership refusal), 2.9's tests, S3 (amend).
- **Door:** two-way: retire the rows and the run falls back to the files.
- **Blast radius:** section titles and comment numbers on new reviews of a jurisdiction with live rows.

---

## 5. Open questions

- **Q1. Backfill older Austin labels?** 40 of the 63 CC reviews ran on 8 other labels or Cedar Park. D5's stamp could walk those folders the same way. Not now (Will, 2026-10-14).
- **Q2.** *Closed in v2:* a review records its exact version as `intakeVersion`.
- **Q3. Cedar Park v1.** 21 guides, 220 items, no `Fail Status`, no maps, one row with an unescaped `|` that rule 7 rejects. It has a code now (`CP_TX`) and one review. Give it `intake.yaml` and sidecars in P2a as a sparse second fixture, or wait for intake-prospecting to regenerate it?
- **Q4. Are regrouping and renumbering PATCH or MINOR?** Comment numbers are customer-visible. Default PATCH. If Q10 moves order to the DB, this question moves with it.
- **Q5. Where do semvers start?** Default `1.0.0` for each checklist's first synced content.
- **Q6. What should review counting answer?** For the review-linkage sibling.
- **Q7.** *Closed in v2.2:* `workflow_run` reads buckets through bucket-wide policies; `intake-figures` has one.
- **Q8. When does the source manifest get a stable `source_id`?** Until then the `citations` jsonb carries `source_key` only (jurisdiction-pages spec).
- **Q9. Counties and cities that share a name:** default a `CO` suffix (`EPCO_TX`).
- **Q10. Is group placement the second DB investment, and is the membership guard enough?** §2.4 is the proposal: live `intake_groups`, files unless the DB has rows, titles and order at once, membership after P2a. Open within it: whether group-level prose that stays with its file is acceptable when items move, or whether such prose must first be made per-item.

## 6. Not yet specified

- **Review linkage (`intake/review-linkage`):** 1.4-resolve stamping `intakeChecklist` and `intakeVersion`; 2.9-comments adding each finding's `itemId`; sections keyed on `group_id`; a view `intake_item_review_outcomes`; versioned item links in `/intake-checklists`. The counting rules go there, pending Q6.
- **Refresh (`intake/refresh`):** re-fetch sources, re-extract, match to stable IDs, compute the bump, open a bureau PR. Figures with `derived_from` are re-cut when their snapshot changes.
- **The baseline (`intake/baseline`):** filling `intake/baseline/`, the `GENERIC` row, and what the CC runbook does for a `none_found` jurisdiction.
- **The figures view in the app** (checklist-figures P5) and an upload page: the first app-side service-role write, when someone who doesn't run a CLI needs it.
- **Whether `/intake-checklists` reads the replica** instead of the bucket (jurisdiction-pages spec).

## 7. Out of scope

- **The DB as the source of truth for checklist text, and editing it in the app.** Not planned (D19); reconsidered only on its triggers. D21's investments are not that.
- **Moving guide prose into the DB.** Prose is versioned through D14's PATCH rule.
- **Renaming `completeness-check/` paths, `review_type` or `output_schema`.** The north-star rename sub-spec.
- **Changing Inspector General's `bureau_checklist_version` cache.** North-star Q6.
- **Formal-review checklists.** A different pipeline with different IDs.
- **The vision CLI's `--region` and `--tile` flags.** winston#312 P1.
