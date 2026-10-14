# Intake checklist DB schema and the bureau sync

**Status:** Draft v1.2
**Date:** 2026-10-14
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
- `cityhall`: four App-DB tables, one write function, tests
- `bureau`: `intake.yaml`, per-version ID sidecars, a CI linter, the sync library and CLI, the `sync-intake.yml` Action, the Austin v2.7 backfill

**Repos NOT touched:**
- `completion-officer` (being retired)
- `conductor` / `conductor2`
- `inspector-general` (its `bureau_checklist_*` cache is unchanged, north-star Q6)
- `substation`
- the CC runbook (`bureau/runbooks/completeness-check/`) and cc-source-citations, which read exactly what they read today. 1.4-resolve copies the whole version dir into the run, so `intake-ids.tsv` is copied too, but no step reads it (§1).

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

```diff
 bureau/
 ├── intake/
+│   └── baseline/                          # the generic baseline (north-star D4); filled by intake/baseline
+│       ├── checklist.yaml                 # id: generic, name, next_item
+│       ├── CURRENT_VERSION
+│       └── <version>/  cc-N.md … + intake-ids.tsv
 ├── jurisdictions/austin/
+│   ├── intake.yaml                        # which checklist austin uses, basis, evidence, next_item
 │   └── completeness-check/
 │       ├── CURRENT_VERSION                # v2.7-trimmed (unchanged)
 │       └── v2.7-trimmed/
 │           ├── cc-1.md … cc-24.md          # unchanged
 │           ├── cc-item-title-mappings.tsv  # unchanged, read by the sync
 │           ├── true-comment-num-mapping.tsv# unchanged, read by the sync
 │           ├── source-citations.json       # unchanged, read by the sync
 │           ├── pape-dawson-comment-num-mapping.tsv, 1700-s-lamar-forced-outcomes.tsv,
 │           │   citation-overrides.json     # unchanged, not read by the sync
+│           └── intake-ids.tsv              # ref → stable id, 192 rows
 ├── tooling/src/
+│   ├── lib/intake/                        # schema, lint, snapshot builder, sync
+│   └── cli/{lint-intake,sync-intake}.ts
 └── .github/workflows/
+    └── sync-intake.yml                    # merge-to-main → App DB

 cityhall/supabase/schemas/public/
 ├── tables/
+│   ├── intake_checklists.sql
+│   ├── intake_checklist_versions.sql
+│   ├── intake_checklist_items.sql
+│   └── jurisdiction_intake.sql
 └── functions/
+    └── intake_sync_version.sql            # one checklist version + its items, one transaction
```

**Flow:**
1. A bureau PR edits guides or sidecars.
2. `lint:intake` (CI) checks them.
3. On merge, `sync-intake.yml` runs `sync:intake`.
4. For each checklist version that has a sidecar, the sync builds rows, hashes them, and calls `intake_sync_version()`.
5. That function inserts a new revision only if the hash is new.

The CC runbook is not changed:
- It reads guides with `guide_dir.glob("*.md")` (`runbooks/completeness-check/scripts/cc.py:234`) and names each TSV it uses explicitly, so no step reads `intake-ids.tsv`.
- 1.4-resolve does copy the whole version dir into the run (`shutil.copytree`, `cc.py:307`), so the sidecar is copied into each run's `1.4-resolve/checklist/`.
- Adding the sidecar also changes the dir's git tree hash, which 1.4-resolve records as `checklistsTreeHash` (`cc.py:298`) and which review amend compares (`runbooks/lib/review_amend.py:83-85`).

---

## 2. Decisions

### 2.1 Files in bureau

**D1. The `intake.yaml` file.** [Will, 2026-10-14] Each jurisdiction that has an intake assignment gets `jurisdictions/<slug>/intake.yaml`. It is a standalone file, not a block in `conventions.yaml`, so that one sync owns every intake row and writes them in dependency order. Otherwise two Actions racing on the same merge could leave `jurisdiction_intake` pointing at a checklist that doesn't exist yet. Shape:

```yaml
# jurisdictions/austin/intake.yaml
checklist: austin                     # own checklist id (= slug) or `generic`
basis: formal                         # formal | none_found | inconclusive  (north-star D5)
application_type: Consolidated Site Plan   # what the checklist covers (north-star Q2); free text
path: completeness-check              # versions dir, relative to the jurisdiction (own checklists only)
next_item: 193                        # high-water mark for minting ids (D4); own checklists only
evidence:
  summary: >-
    Austin runs a formal Completeness Check before technical review, with a
    published CC Application, CC Submittal Checklist, Notes and Templates, and
    an Austin Water Completeness Checklist.
  sources:
    - { label: CC Submittal Checklist, url: "https://…" }
decided_by: will                      # a person, or a runbook run id
decided_at: 2026-10-14
```

- **A jurisdiction on the baseline** sets `checklist: generic` and a `basis` of `none_found` or `inconclusive`, and has no `path` or `next_item`.
- **Absence is meaningful:** a jurisdiction with no `intake.yaml` has no assignment, which is different from `none_found`.
- **Validation:** `tooling/src/lib/intake/schema.ts` is the single parser, shared by the linter and the sync, following the `conventions/schema.ts` pattern.
- **The rule for `basis`:**
  - `basis: formal` requires `checklist` = the jurisdiction's slug;
  - any other basis requires `checklist: generic`.

**D2. The baseline lives at `bureau/intake/baseline/`.** It sits outside `jurisdictions/` so it never looks like a jurisdiction to the syncs that walk that directory: `sync-conventions` reads every `jurisdictions/*/` dir, and `sync-bureau.yml` fires on `jurisdictions/**`. It has the same layout as a jurisdiction's versions dir (`CURRENT_VERSION`, `<version>/cc-N.md`, `intake-ids.tsv`), plus `checklist.yaml` (`id: generic`, `name`, `next_item`). This spec defines the location and the schema only. The folder stays empty until the `intake/baseline` sub-spec fills it, and the sync skips it while it has no version with a sidecar.

**D3. A sidecar per version: `<version>/intake-ids.tsv`.** One row per item. Columns:

| column | example | rule |
|---|---|---|
| `ref` | `cc-1:CC-1-01` | `{guide stem}:{ID cell}`, exactly the composite ref reviews already store |
| `id` | `austin-0001` | the stable item ID (D4) |
| `derived_from` | `austin-0097` | optional; comma-separated IDs this item was split or merged from |

- **Why per version and not per jurisdiction:** refs change between versions (`CC-15-09a` → `CC-15-09`), and each review records the version it ran against. A review's ref therefore resolves through that version's sidecar.
- **Which versions sync:** a version is synced only when it has a sidecar. Older Austin versions can be backfilled later just by adding their sidecars (Q1).
- **New jurisdictions** generated by the intake-prospecting runbook use the stable ID directly in the guide's ID column. The sidecar then maps `cc-1:new-braunfels-0007` → `new-braunfels-0007`, which keeps the format the same everywhere.

**D4. Item ID format and minting.** [north-star D6]
- **Format:** an item ID is `{checklist id}-{NNNN}`: at least four digits, zero-padded, matching `^[a-z0-9-]+-[0-9]{4,}$`.
- **Minting:** a new item takes `next_item` from its checklist's `intake.yaml` (or the baseline's `checklist.yaml`), and the same PR increments `next_item`.
- **Why `next_item` exists:** without it, a number could be reused. An item can be deleted from a folder edited in place (§Problem), after which its number appears in no sidecar on disk; the high-water mark keeps that number retired.
- **Edits:** an edit to an item's text keeps its ID. A split mints new IDs and records `derived_from`.

**D5. Backfill Austin v2.7-trimmed only.** [Will, 2026-10-14]
- `austin-0001` … `austin-0192` are assigned in `true-comment-num-mapping.tsv` order, so on day one each item's number equals its comment number.
- **That match is a coincidence of the backfill, not a rule.** The two will diverge with the next insertion. Nothing may derive one from the other, and the comment number stays a separate column (D9).
- `jurisdictions/austin/intake.yaml` gets `basis: formal`, `next_item: 193`.
- The other 10 Austin version dirs (`legacy`, `v1`, `v2`, `v2-trimmed`, `v2.1-trimmed` … `v2.6-trimmed`) are not backfilled (Q1).

### 2.2 Tables in cityhall

**D6. Four tables, keyed naturally rather than by uuid.** [north-star D5, D6; Will prefers short IDs to uuids]

```sql
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

intake_checklist_versions
  checklist_id      text FK → intake_checklists(id)
  revision          int              -- 1, 2, 3 … per checklist, assigned by intake_sync_version
  label             text NOT NULL    -- the bureau folder name, 'v2.7-trimmed'
  content_hash      text NOT NULL    -- sha256 of the canonical item rows (D8)
  is_current        boolean NOT NULL DEFAULT false
  item_count        int NOT NULL
  bureau_commit     text NOT NULL    -- the commit that introduced this content
  synced_at         timestamptz NOT NULL DEFAULT now()
  PK (checklist_id, revision)
  UNIQUE (checklist_id, label, content_hash)
  UNIQUE (checklist_id) WHERE is_current                          -- partial unique index

intake_checklist_items
  checklist_id      text
  revision          int
  item_id           text             -- 'austin-0042'   CHECK (item_id LIKE checklist_id || '-%')
  jurisdiction_slug text NULL FK → jurisdictions(slug)   -- = the checklist's; NULL on the baseline
  legacy_ref        text NULL        -- 'cc-1:CC-1-01' (the sidecar's ref)
  derived_from      text[] NULL
  group_key         text NOT NULL    -- 'cc-1'
  group_title       text NOT NULL    -- the guide's H1, 'CC-1: Intake & Core Submittal'
  sort_order        int NOT NULL     -- position across the version (guides by number, then table order)
  comment_number    int NOT NULL
  title             text NULL        -- authored title; NULL when the version has no title map
  item_text         text NOT NULL    -- the `Item` cell (written as the deficiency)
  condition, location, location_binding, requirement_source, source_type   text NULL
  fail_status       text NULL        -- 'fail' | 'warn' | 'fail-or-warn'; NULL in tables without the column
  citations         jsonb NULL       -- the item's entry from source-citations.json, when present
  PK (checklist_id, revision, item_id)
  FK (checklist_id, revision) → intake_checklist_versions
  UNIQUE (checklist_id, revision, legacy_ref)
  UNIQUE (checklist_id, revision, comment_number)

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

- **The table names.** `intake_checklist_items` is the table Will named. The other three exist because the baseline is not a jurisdiction (north-star D5) and because one label can hold several sets of content (§Problem).
- **No row has a uuid.** A version is addressed as `('austin', 3)` and an item as `('austin', 3, 'austin-0042')`.
- **Why `jurisdiction_slug` is copied onto items.** Will asked for the column, and it lets "items for jurisdiction X" be answered without a join. It always equals the checklist's slug, and the write function sets it.
- **Why `jurisdiction_intake` is a separate table** rather than columns on `jurisdictions`: the conventions sync writes `jurisdictions`, and one writer per table keeps "bureau wins" unambiguous.

**D7. Access: shared reference data, written only by the sync.**
- RLS is on for all four tables.
- `authenticated` and `workflow_run` get `SELECT … USING (true)`. Each grant follows `tables/jurisdictions.sql`: a policy plus an explicit `GRANT SELECT … TO "workflow_run"`, because the default privileges grant `workflow_run` nothing. This matches the any-signed-in-user read policy on the `cc-source-snapshots` bucket that `/intake-checklists` reads. It is broader than `jurisdictions`' own authenticated policy, which shows only jurisdictions that have a project the caller can see. These are city requirements, not tenant data.
- No `anon` access.
- Writes come only from `service_role` through `intake_sync_version()` (D8).
  - Its file revokes EXECUTE with `REVOKE ALL … FROM PUBLIC, "anon", "authenticated"`, the pattern in `functions/cartographer_anchor_decide.sql:50`. `workflow_run` never had EXECUTE under the default privileges.
  - It is SECURITY INVOKER, so it needs no `definer-acl-allowlist.txt` entry: `scripts/check-definer-acl.sh` checks only SECURITY DEFINER functions.
- All four tables go in `supabase/rls-isolation-allowlist.txt` as `reference`, beside `jurisdictions`.

**D8. One checklist version is written in one transaction, by one function.** `intake_sync_version(p jsonb) RETURNS jsonb`, SECURITY INVOKER, service_role only. It takes one checklist row, one version (label, hash, bureau commit, is_current) and its item rows, and in a single transaction:

1. Upserts the `intake_checklists` row (name, bureau_path, bureau_commit).
2. If `(checklist_id, label, content_hash)` already exists, it writes nothing further except the `is_current` flip in step 4, and returns `{revision, created: false}`.
3. Otherwise it inserts revision `max(revision)+1` and every item row, setting `jurisdiction_slug` from the checklist.
4. If `is_current` was passed, it clears the flag on the checklist's other revisions and sets it on this one.

- **Why a function:** each PostgREST request is its own transaction, so writing a version and its items as separate requests could leave a revision with only some of its items.
- **Nothing is ever deleted or updated in place.** Reviews may point at any revision, and the next sync would overwrite a manual DB edit anyway (north-star D7).

**D9. How the sync fills each column.** For each version dir that has `intake-ids.tsv`:

| column | source |
|---|---|
| `item_id`, `legacy_ref`, `derived_from` | the sidecar |
| `group_key`, `group_title` | guide stem, guide H1 |
| `item_text`, `condition`, `location`, `location_binding`, `requirement_source`, `source_type`, `fail_status` | the guide row's cells, by header name (a missing column → NULL) |
| `sort_order` | guides ordered by the number in their file name, then items in table order. This reproduces `true-comment-num-mapping.tsv` exactly. When no map is given, the CC runbook numbers comments in guide order, and within a guide in the order the agent emitted its findings (`build-review-comments.ts:303-315`). That has matched table order on all 12 sequential v2.7 reviews. |
| `comment_number` | `true-comment-num-mapping.tsv` if present, else `sort_order` |
| `title` | `cc-item-title-mappings.tsv` if present, else NULL |
| `citations` | `source-citations.json` `items[ref]` if present, else NULL |

- The guide parser reuses `guide-items.ts`'s rules: only tables whose first header cell is `ID`, and fenced blocks skipped. It is extended to return cells by header name.
  - This is not the parser the runbook runs: that is `checklist-policy.ts`, which reads by position and defaults a missing `Fail Status` to `fail`.
  - cc-source-citations' `guides.py` reads by header name, as the sync will.
  - On v2.7-trimmed all three agree on the 192 refs.
- `pape-dawson-comment-num-mapping.tsv` is not synced (north-star Q8).

**D10. A new version only when the content changes.** [north-star D9]
- `content_hash` = sha256 of the canonical JSON of the version's item rows: every D9 column, sorted by `sort_order`, with keys in a fixed order.
- A commit that changes nothing stored produces the same hash, so D8 writes nothing. An edit to an item's text, title, comment number or citations produces a new revision.
- Edits to guide prose (Overview, Key Terms) are not stored, so they don't create one either. The prose stays in bureau until the source-of-truth sub-spec.

**D11. `is_current` follows `CURRENT_VERSION`.** For each checklist, the sync passes `is_current: true` only for the dir that `CURRENT_VERSION` names. That makes the newest revision of the current label the current one.

### 2.3 Lint and sync in bureau

**D12. `lint:intake` runs in CI.** It runs beside `lint:conventions` (`.github/workflows/ci.yml:683-687`) and fails the PR on any of:

1. an `intake.yaml` or `checklist.yaml` that doesn't parse, or breaks the D1 basis rule;
2. a mismatch between the sidecar's `ref` set and the set of guide rows (`{stem}:{ID}`), in either direction;
3. an `id` that is duplicated within a version, doesn't match D4's pattern, or doesn't carry its checklist's prefix;
4. an `id` number ≥ `next_item`, or a `next_item` lower than on the base branch (read with `git show origin/main:…`);
5. a `derived_from` ID that belongs to another checklist or is not lower-numbered than the item that names it.

Rule 2 is what keeps the sidecar from drifting: from now on, a PR that edits a synced version's guide tables must update `intake-ids.tsv` in the same PR. It also catches a run of completion-officer's `tools/sync-to-bureau.sh`, which would copy its stale v2.7 guides (missing `CC-22-12`) over bureau's.

**D13. `sync:intake` and the `sync-intake.yml` Action** follow `sync-conventions` (`tooling/src/cli/sync-conventions.ts`, `.github/workflows/sync-conventions.yml`):

- **Triggers:** a push to `main` touching `jurisdictions/*/intake.yaml`, `jurisdictions/*/completeness-check/**` or `intake/**`, plus `workflow_dispatch`. The concurrency group `sync-intake` does not cancel in progress.
- **Validation first:** it loads and validates every `intake.yaml` and `checklist.yaml` with the D12 checks. Any failure → nothing is written and the exit code is non-zero.
- **Write order:**
  1. For each checklist with versions, call `intake_sync_version()` once per version dir that has a sidecar.
  2. Upsert `jurisdiction_intake` from each `intake.yaml`.
- **Reports:**
  - revisions created and versions unchanged, per checklist;
  - any `jurisdiction_intake` row whose `intake.yaml` was removed. That row is kept and flagged unreconciled, mirroring conventions D33; it is never deleted.
- **On failure:** the job fails, and the same alert step as `sync-conventions` posts to Slack when `SLACK_WEBHOOK_URL` is set.
- **`--dry-run`:** builds and prints rows and hashes, and writes nothing.

---

## 3. Testing seams

**S1: the snapshot builder and linter, given a bureau tree** (new)
- **Proves:**
  - D3, D4: sidecar and ID rules.
  - D9: column mapping, including a version with no title map and no citations, and a table without `Fail Status`.
  - D10: the same tree gives the same hash; an edited title gives a different hash; edited Overview prose gives the same hash.
  - D12 rules 1–5, each with a failing fixture.
  - The real Austin v2.7 tree builds 192 rows, `austin-0001` … `austin-0192`, with comment numbers 1–192.
- **Prior art:** `bureau/tooling/src/lib/conventions/sync-conventions.test.ts`, which has no test runner and exits 1 on failure.
- **Runs:** `cd tooling && bun run test:intake` locally, and in `ci.yml` beside `test:conventions`.

**S2: `intake_sync_version()` and the four tables** (new)
- **Proves:**
  - D6 constraints reject: a baseline with a slug, an item ID with the wrong prefix, `formal` + `generic`.
  - D8: version and items land together, and an invalid item rolls back the whole version.
  - D10/D8: the same payload twice gives one revision and `created: false`; a changed hash gives revision 2.
  - D11: `is_current` moves.
  - D7: `authenticated` can read, `anon` cannot, and `authenticated` cannot execute the function or insert.
- **Prior art:** `cityhall/tests/db/verdict-triage-split.test.ts` (a function plus its permissions, against the local stack), with `tests/db/support.ts` helpers.
- **Runs:** `pnpm test:db` in cityhall, on the local Supabase stack, in the `check` CI job.

**Acceptance (not a seam):** after P2b merges, `workflow_dispatch` `sync-intake.yml`, then against prod:
- `select count(*) from intake_checklist_items where checklist_id='austin'` → 192;
- `intake_checklist_versions` → one row, `('austin', 1, 'v2.7-trimmed', is_current=true)`;
- `jurisdiction_intake` → `austin | austin | formal`.

Dispatch again: still one revision.

---

## 4. PR plan

**P1: the four intake tables and their write function** (`cityhall`)
- **Blocked by:** nothing technical. **It is scheduled after the intake-prospecting loop has met the Austin bar and at least one non-Austin smoke run has produced output in the format** (north-star D3 v1.1), so that answers to north-star Q1 and Q2 can still change the schema before the migration is applied.
- **Delivers:**
  - `supabase/schemas/public/tables/{intake_checklists,intake_checklist_versions,intake_checklist_items,jurisdiction_intake}.sql`
  - `functions/intake_sync_version.sql`
  - the generated migration
  - allowlist entries
  - `tests/db/intake-checklists.test.ts`

  Lands D6, D7, D8, and D10's DB half. Jason applies the migration to prod before merge (AGENTS.md:114).
- **Tested at:** S2.
- **Door:** two-way (new, empty tables; a follow-up migration drops them).
- **Blast radius:** none. Nothing reads or writes these tables until P2b.

**P2a: the intake files, the linter and the Austin v2.7 backfill** (`bureau`)
- **Blocked by:** nothing (can start now). It should land before the intake-prospecting runbook's first real publish, so the runbook's output is checked by `lint:intake` (north-star D3 v1.1). Open bureau#2112 already writes `intake.yaml` and `intake-ids.tsv` without a linter, so whichever of the two merges first fixes the format on main.
- **Delivers:**
  - `tooling/src/lib/intake/schema.ts`, the guide-row parser, the linter, `cli/lint-intake.ts`, and `lint:intake` + `test:intake` in `ci.yml`
  - `jurisdictions/austin/intake.yaml`
  - `jurisdictions/austin/completeness-check/v2.7-trimmed/intake-ids.tsv` (192 rows)
  - `intake/baseline/README.md` stating D2

  Lands D1–D5 and D12.
- **Tested at:** S1 (linter half, plus the real Austin tree).
- **Door:** two-way.
- **Blast radius:** every bureau PR that edits the v2.7-trimmed guide tables must now update the sidecar (D12 rule 2). That is intended, but it changes Will's hand-editing workflow from merge onwards.

**P2b: the sync and its Action** (`bureau`)
- **Blocked by:** P1 applied to prod; P2a merged.
- **Delivers:** the snapshot builder, `lib/intake/sync.ts`, `cli/sync-intake.ts`, `sync:intake` / `sync:intake:dry-run` scripts, and `.github/workflows/sync-intake.yml`. Lands D9, D10, D11, D13. Then the acceptance run.
- **Tested at:** S1 (builder half), then acceptance.
- **Door:** two-way. Rows in a synced copy that nothing reads; truncate and re-dispatch.
- **Blast radius:** none for runs. A failing Action alerts but blocks nothing.

---

## 5. Open questions

- **Q1. Backfill older Austin versions?** 41 of the 60 CC reviews ran on 8 other labels, plus one review labelled `unknown`. A sidecar per version (D3) would let their refs resolve. Not now (Will, 2026-10-14). Revisit when something needs to join old reviews to items.
- **Q2. Should a review record the checklist revision it ran against?** Reviews record `metadata.checklistVersion` (the label) and `bureauCommitHash`, in two copies: `output_json.metadata` and the `reviews.metadata` column. Runbook-lane reviews also record `runbookRunId` in the column, and 2 record `checklistsTreeHash`. Because v2.7-trimmed has had several contents, the label alone doesn't pick a revision; the commit does, if the sync keeps a commit-to-revision lookup. Options: (a) leave it, since `bureau_commit` on the version is the commit that introduced the content; (b) have the CC runbook's `3.1-publish` write `metadata.intakeRevision` once the tables exist. That belongs to the review-linkage work in Not yet specified.
- **Q3. Cedar Park v1.** It has 21 guides and 220 items, all in tables with no `Fail Status`, plus a unified TSV. It has no title map, numbering maps or citations, and nobody has curated it. One row (`cc-21.md:86`, CC-21-07) has an unescaped `|` in its Item cell, so any parser reads it as 12 cells against a 7-cell header. Give it an `intake.yaml` + sidecar now as a second, sparse fixture, or wait for the intake-prospecting runbook to regenerate it?

## 6. Not yet specified

- **Linking reviews to items.** A real column on `review_comments`, or a view joining `output_json->'sourceFindings'[].ref` to `legacy_ref` through the review's version and revision. It is needed once anything in the app reads items from these tables instead of from `output_json`.
- **What the CC runbook does for a `none_found` jurisdiction.** It has to resolve its guides from `intake/baseline/` instead of `jurisdictions/<slug>/completeness-check/`. That belongs to the baseline sub-spec, together with filling the baseline.
- **Whether `/intake-checklists` reads from these tables** instead of the citation bucket.

## 7. Out of scope

- **The DB as the source of truth, and edits made in the app.** That is the north-star `db-source-of-truth` sub-spec.
- **Moving guide prose (Overview, Key Terms, Validation Methodology) into the DB.** Same sub-spec.
- **Renaming `completeness-check/` paths, `review_type` or `output_schema`.** That is the north-star rename sub-spec.
- **Changing Inspector General's `bureau_checklist_version` cache.** North-star Q6.
- **Formal-review checklists.** They are a different pipeline with different IDs.
