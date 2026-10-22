# Intake summary on the jurisdiction page

**Status:** Draft v1
**Date:** 2026-10-22
**Repos touched:** `bureau` (intake-prospecting 3.1-write and 4.2-publish, the 1.0 worktree fence, the `cc-source-snapshots` sync, a backfill of El Paso's and Austin's `intake.yaml`), `cityhall` (`/intake-checklists` index and `/intake-checklists/[jurisdiction]` homepage, storage seed, e2e)
**Repos NOT touched:** `substation`, `conductor2`, `cartographer`, `surveyor`, App DB schema (no migration)
**Parents:** `../tiers-golden-set/DESIGN-SPEC.md` (the tiers), `../tiers-golden-set/CLASSIFY-LOOP-SPEC.md` (1.4-classify, bureau#2187), `../jurisdiction-pages/DESIGN-SPEC.md` (the homepage, D3 and D4), `../db-schema/DESIGN-SPEC.md` (D1, the `intake.yaml` file)

## 1. Problem

Will wants each jurisdiction's intake page (`app.noeticbuild.com/intake-checklists/el-paso`, `/austin`) to open with a short **intake summary**: the tier, when we last prospected the city, the checklist version if there is one, the application type, the quote that decides the tier, why there is no list (Tier 2), and the evidence summary. The page's current content stays below it unchanged.

Today none of that summary reaches the page, and most of it never leaves the run dir.

**1.4-classify decides it, and 3.1-write drops it.** Since bureau#2187 (`fdc8014cdc`), `1.4-classify/classification.json` holds `gate`, `gate_evidence[{source, quote, kind}]`, `tier`, `content_items`, `why_no_list`, `basis`, `application_type`, `scope_sources`, `rationale`, `evidence[{source, quote}]` and `retype` (`runbooks/intake-prospecting/scripts/schemas.ts`, `Classification`). `intake_yaml()` (`scripts/iplib/step_write.py:165`) writes only `basis`, `application_type`, the rationale (as `evidence.summary`) and source labels with URLs. The rest is lost:
- `gate`, `gate_evidence`, `tier` and `why_no_list` are gone entirely. `basis` keeps Tier 1 (`formal`) and an unknown gate (`inconclusive`), but Tier 2 and Tier 3 both become `none_found`, which erases the distinction the golden set was built to make.
- The 1.5-scope approve schema says its notes are "Carried into the bureau PR body" (`steps/1.5-scope/decision.schema.json`), but `cmd_publish` reads only `4.1-review/decision.json`, so that promise is not kept.
- `decided_by` is the run name (`el-paso`), not who ruled. db-schema D1 says it should be a person or a run id.
- The CLASSIFY-LOOP-SPEC §9 put "Steps 1.5 onward" out of scope, which is why #2187 left 3.1-write alone.

**The page reads only the bucket, and 404s without a checklist.** `readChecklistSources` (`cityhall/src/app/(app)/intake-checklists/[jurisdiction]/read.ts`) reads `jurisdictions` plus `CURRENT_VERSION`, `citations/<v>.json` and `manifest.json` from `cc-source-snapshots`, and returns not-found when `CURRENT_VERSION` is missing. The index (`intake-checklists/read.ts`) lists only bucket folders that have one. The bucket is filled by bureau's `sync-cc-sources.yml` → `runbooks/cc-source-citations/scripts/sync.mjs`, whose `plan()` skips any jurisdiction without `completeness-check/sources/manifest.json`. Nothing reads `intake.yaml`, so a Tier 2 or Tier 3 city, which by design never gets a checklist, can never have a page.

**Only El Paso has an `intake.yaml`, and it predates the tiers.** `bureau/jurisdictions/el-paso/intake.yaml` was written by run `el-paso` on 2026-10-15, under the old `basis.json` 1.4. Austin's checklist (`v2.7-trimmed`) came from the older pipeline and has no `intake.yaml`; db-schema D1 and D5 define the one Austin should get (`next_item: 195`, written by db-schema P2a, not yet built).

**Real classifications of both already exist.** Pass p03 of the classify loop (`~/noetic/working/intake-prospecting/tiers/p03/`, head `168d59106d`, bar met with 15/15 gates right and 9/9 tiers right) ran the merged 1.4 prompt on both cities. It differs from main only in the revise paragraph, which a first round does not read. Austin: gate yes, Tier 1, `Consolidated Site Plan`, 18 gate quotes (15 `hold_text`, 2 `practice`, 1 `statute`). El Paso: gate yes, Tier 1, `Detailed Site Development Plan`, 6 `hold_text` quotes. Both runs are parked at 1.5-scope.

## 2. What the page shows

```
┌ Intake checklists ─────────────────────────────────────────────── [All items] ┐
│ City of El Paso                       Active                                  │
│                                                                               │
│ Intake summary                                                                │
│  Tier 1  The city holds incomplete site plans and publishes what it checks    │
│  Application        Detailed Site Development Plan                            │
│  Last prospected    2026-10-22 · run tiers/p03/el-paso-tx                     │
│  Checklist          v1 · 43 items · generated 2026-10-15                      │
│  Why we say so      "The application shall be reviewed by the planning        │
│                     division for completeness and shall not be processed      │
│                     until any missing information is supplied…"               │
│                     (El Paso Municipal Code § 20.04.150 ↗)                    │
│  ▸ Evidence summary and all 6 quotes                                          │
│                                                                               │
│ Checklist v1     (unchanged: counts, commit, groups, sources below)           │
└───────────────────────────────────────────────────────────────────────────────┘
```

A Tier 2 city shows `Why there is no list: never written`, and a Tier 2 or Tier 3 city shows `Checklist: none` with no checklist or source sections below it.

## 3. Decisions

**D1. The summary is the page's first section, above the existing sections, which do not change.** It shows these rows, in order, each hidden when it has no value:
1. **Tier**: a badge (`Tier 1`, `Tier 2`, `Tier 3`, `Not determined`) and one fixed line of meaning:
   - Tier 1: "The city holds incomplete site plans and publishes what it checks."
   - Tier 2: "The city holds incomplete site plans but has no written list of what it checks."
   - Tier 3: "The city does not hold site plans for completeness before formal review."
   - Not determined (gate `unknown`): "We could not establish whether the city holds incomplete site plans."
2. **Application**: `application_type`, as the city writes it.
3. **Last prospected**: `classification.classified_at` and `classification.run`.
4. **Checklist**: the `CURRENT_VERSION` label, the item count and `generated_at` from the citation file, linked to `/items`. With no published checklist it reads `None`.
5. **Why we say so**: up to two deciding quotes (D3), each with its source label linked as D4 says.
6. **Why there is no list** (Tier 2 only): `never written`, `not obtainable` or `withdrawn`, from `why_no_list`.
7. **Evidence summary**: `evidence.summary` and every gate quote, behind one disclosure, closed by default.

The readout's "Need you?" open questions, `content_items` and the classifier's retypes are not shown (Will, 2026-10-22).

**D2. `intake.yaml` gains a `classification` block, written by 3.1-write from `classification.json`.** It extends db-schema D1's shape, and nothing else in D1 changes:

```yaml
# jurisdictions/el-paso/intake.yaml, as a run after P1 would write it (the backfill differs, D9)
checklist: el-paso
basis: formal
application_type: "Detailed Site Development Plan"
path: completeness-check
next_item: 44
classification:
  gate: "yes"                        # "yes" | "no" | "unknown"; always quoted (YAML 1.1 reads a bare yes/no as a boolean)
  tier: 1                            # 1 | 2 | 3 | null
  why_no_list: null                  # never_written | not_obtainable | withdrawn; set exactly on Tier 2
  run: "el-paso"                     # the intake-prospecting run whose 1.4-classify decided it
  classified_at: 2026-10-15          # the date that run's classification.json was written
  gate_evidence:                     # every gate quote, in classification.json's order
    - kind: hold_text                # hold_text | no_hold_text | practice | statute
      source: code-20-04-150-dsdp-procedure   # the sources.json key
      label: "El Paso Municipal Code § 20.04.150 Procedure (Detailed Site Development Plan)"
      url: "https://library.municode.com/tx/el_paso/codes/code_of_ordinances?nodeId=…20.04.150PR"
      page: 1                        # carried when classification.json has it (p03's quotes do, with word ids)
      quote: "The application shall be reviewed by the planning division for completeness and shall not be processed until any missing information is supplied by the applicant and the fee has been received."
evidence:
  summary: >-
    …
  sources: [ … ]
decided_by: "will@noetic.inc"        # D6
decided_at: 2026-10-15
```

- `label` and `url` are resolved from `1.2-discover/sources.json` at write time, because `sources.json` is never committed. `page` and `words` are copied when the quote carries them: the prompt does not ask for them, but p03's quotes all have them (`{"page": 1, "words": "p1w79-p1w109"}`).
- `IntakeYaml` gains the block with `classificationRules`' invariants: tier null exactly when the gate is unknown, Tier 3 exactly when the gate is no, `why_no_list` exactly on Tier 2, and the tier agreeing with `basis` through `basisForTier`. The block is optional in the schema, so a file written before this spec still parses; 3.1-write's gate requires it.
- The schema moves to `runbooks/lib/intake/intake-yaml.ts`, so the sync (D7) can import it without the runbook's step schemas. `scripts/schemas.ts` re-exports it, and db-schema P2a's `tooling/src/lib/intake/schema.ts` will fold it in.

**D3. The deciding quotes are picked by kind, on the page.** The classifier writes every gate quote (Austin's p03 run has 18), and the page picks which ones to show. Gate yes: the first `hold_text`, then the first `practice`, or a second `hold_text` if there is no `practice`. Gate no: the first `no_hold_text` and the first `practice`. Gate unknown: the first two quotes of any kind. A `statute` quote is shown only when no other kind is present. 1.4's prompt does not change; the classify loop tuned it, and quote order is not part of its contract.

**D4. A quote links to our captured copy when the bucket has one, else to the live URL.** If `manifest.json` holds a snapshot whose `source_key` equals the quote's `source`, the label links to that source's page (`/intake-checklists/<slug>/sources/<source slug>`, through `buildSourceIndex`). Otherwise it links to `url` with ↗. Today the manifest holds only snapshots that items cite, so most gate quotes take the live URL; §7 records the gap.

**D5. A jurisdiction with an intake file and no checklist has a page.** `readChecklistSources` reads `intake.json` beside `CURRENT_VERSION`, and returns not-found only when the jurisdiction has neither, or when RLS hides the `jurisdictions` row (as today). With no checklist, the page renders the summary only: no version section, no source sections and no "All items" button. The index lists every visible jurisdiction whose bucket folder holds `CURRENT_VERSION` or `intake.json`, and gains a **Tier** column (the D1 badge, `—` without an intake file). The Checklist column shows `—` when there is no checklist.

**D6. 3.1-write records who ruled, and 4.2-publish carries the 1.5-scope notes.**
- `decided_by` becomes `1.5-scope/decision.json`'s `decided_by` when it is a person (not `auto`), else the run name as today. db-schema D1 reads it as who ruled on the basis, and db-schema D22 still owns replacing run names with `runbook_runs` uuids.
- `cmd_publish` adds the 1.5-scope notes to the PR body beside 4.1-review's, so the schema's promise is kept.

**D7. The sync publishes `intake.yaml` as `<slug>/intake.json`.**
- `sync-cc-sources.yml` adds `jurisdictions/*/intake.yaml` to its path filter and sparse checkout, along with the D2 schema file.
- `sync.mjs` `plan()` adds one entry per `jurisdictions/<j>/intake.yaml`, whether or not the jurisdiction has a manifest. `validate()` parses it with `IntakeYaml` (one invalid file uploads nothing, as today), and the upload writes the parsed object as JSON. Converting it on the way makes the app parse JSON, not YAML.
- The existing CI dry-run (`ci.yml:627`, `sync.mjs --root . --dry-run`) covers the new entry with no workflow change.
- An `intake.yaml` deleted from bureau leaves its object in the bucket, as a removed citation version does today; Q2 asks whether that matters.

**D8. Fence `intake.yaml` from research sessions.** Once it carries the tier and the gate quotes, a jurisdiction's `intake.yaml` is a prior answer. The 1.0 worktree's sparse set (`sparse_paths`, `scripts/iplib/common.py:128`) holds `/jurisdictions/<slug>/` minus `completeness-check/`, so a 1.4 session on El Paso could read El Paso's file today.
- `sparse_paths` adds `!/jurisdictions/<slug>/intake.yaml`.
- `rule19.ts` `BARRED` adds `/jurisdictions\/[^/\s'"]+\/intake\.yaml/`.
- The two scripts that read the file get it from git instead of the disk: 2.3-verify's `next_item` read (`step_verify.py`) uses `git show HEAD:jurisdictions/<slug>/intake.yaml`, and 3.1-write widens the sparse set for `intake.yaml` before it writes and commits, as it already does for `completeness-check/`, and narrows it before a send-back.
- This also keeps a pass of the classify loop from reading a backfilled answer (D9) on bureau main.

**D9. Backfill El Paso and Austin from pass p03's classifications.** One bureau PR writes them, using a script in the PR (not hand-copied), from `tiers/p03/<id>/1.4-classify/classification.json` and that run's `1.2-discover/sources.json`. `run` is `tiers/p03/<id>` and `classified_at` is 2026-10-22.
- **El Paso:** add the `classification` block only. `basis`, `application_type`, `evidence` and `decided_*` stay as the 2026-10-15 run wrote them, because 1.5-scope approved that basis. p03's `application_type` matches.
- **Austin:** a new `intake.yaml` with db-schema D1 and D5's values (`checklist: austin`, `basis: formal`, `path: completeness-check`, `next_item: 195`) and p03's `application_type`, rationale and evidence sources. `decided_by` is `will@noetic.inc` and `decided_at` the merge date, since Will reviews this PR. P2a later renames `checklist` to `AUS_TX` and adds `next_group`, as D22 does for El Paso. Q1 asks whether Austin should wait for P2a instead.

## 4. The change, as trees

```diff
 intake-prospecting
   1.0-worktree
     sparse_paths
-      /jurisdictions/<slug>/  !…/completeness-check/
+      /jurisdictions/<slug>/  !…/completeness-check/  !…/intake.yaml     # D8
   2.3-verify
-    read intake.yaml next_item from the worktree disk
+    git show HEAD:jurisdictions/<slug>/intake.yaml                       # D8
   3.1-write
     intake_yaml(slug, basis, sources, run_id, own, next_item)
+      classification: {gate, tier, why_no_list, run, classified_at, gate_evidence[+label,url]}   # D2
+      decided_by ← 1.5-scope decision.decided_by unless auto             # D6
+    widen_sparse(intake.yaml) before write; narrow before a send-back    # D8
   4.2-publish
+    PR body carries the 1.5-scope notes                                  # D6
```

```diff
 bureau
 ├── runbooks/lib/
+│   └── intake/intake-yaml.ts            # IntakeYaml + classification block (D2)
 ├── runbooks/lib/rule19.ts               # BARRED += intake.yaml (D8)
 ├── runbooks/cc-source-citations/scripts/sync.mjs
+│                                        # intake.yaml → <j>/intake.json (D7)
 ├── .github/workflows/sync-cc-sources.yml  # paths + sparse += intake.yaml (D7)
 └── jurisdictions/
     ├── austin/
+    │   └── intake.yaml                  # backfill (D9)
     └── el-paso/
         └── intake.yaml                  # + classification block (D9)
```

```diff
 cityhall/src/app/(app)/intake-checklists/
   page.tsx                       index
+    Tier column; lists folders with CURRENT_VERSION or intake.json   # D5
   read.ts
+    readChecklistJurisdictions: + intake.json probe                  # D5
   [jurisdiction]/
     read.ts
-      null when CURRENT_VERSION is missing
+      { jurisdiction, intake | null, checklist | null }; null only when both are missing   # D5
     page.tsx
+      <IntakeSummary>  (tier · application · last prospected · checklist · quotes · why no list · disclosure)   # D1, D3, D4
       checklist + sources sections   (only when checklist)
 cityhall/src/lib/intake-checklists/
+  intake-summary.ts              zod parse of intake.json, tier labels, pickDecidingQuotes   # D1, D3
```

## 5. Open questions

- **Q1. Should Austin's `intake.yaml` land in the backfill (D9), or wait for db-schema P2a?** D9 writes it now with D1 and D5's values, so Austin's page shows the summary this week. The cost is that P2a then edits a file it was going to create. Waiting means Austin's page has no summary until P2a. Recommendation: land it now.
- **Q2. Does a deleted `intake.yaml` need to be removed from the bucket?** The sync never deletes objects (D7). A jurisdiction losing its intake assignment is not a case we have; recommendation: no deletion until one exists.
- **Q3. Who sees the tier?** Any signed-in user who can see the jurisdiction row sees the page, and the bucket policy (`cc-source-snapshots: select for authenticated`, cityhall `supabase/schemas/storage/tables/objects.sql`) lets **any** signed-in user read `intake.json` directly, whatever RLS says about the row. So a staff-only tier cannot live in this bucket. The tier rests on the city's public documents, and the D1 wording describes the city, not a sales judgment. Recommendation: show it to every reader of the page. If Will wants it staff-only, D7 moves the file to a staff-only path or bucket and the page checks `is_noetic_member`.

## 6. Testing seams

**S1: the runbook's write step, run dir in → worktree files out** (existing)
- **Proves:** D2, D6 and D8. A fixture `classification.json` for each tier gives an `intake.yaml` whose `classification` block parses and agrees with `basis`. `gate` is a quoted string. Labels and URLs resolve from `sources.json`. `decided_by` is the 1.5 person, or the run name when the gate is `auto`. `intake.yaml` is off disk in the 1.0 worktree and committed by 3.1. 2.3-verify still reads `next_item`. Publish's PR body carries the 1.5 notes. The rule-19 scan flags an `intake.yaml` read.
- **Prior art:** `runbooks/intake-prospecting/tests/write.test.ts` (the 3.1-write tests at :69 and :112) and `tests/contracts.test.ts`.
- **Runs:** `cd runbooks/lib && npm run test:bin`, plus `python3 -m pytest runbooks/intake-prospecting/scripts --import-mode=importlib`; local and CI.

**S2: the sync CLI, a bureau checkout in → planned bucket objects out** (existing)
- **Proves:** D7 and D2's schema. `sync.mjs --root <fixture> --dry-run` plans `<j>/intake.json` for a jurisdiction with a checklist and for one with only `intake.yaml` (Tier 3). An invalid `classification` block fails the run and uploads nothing.
- **Prior art:** `ci.yml:627` runs the dry-run over bureau main; `runbooks/cc-source-citations/scripts/test_registry.py` tests the cross-check `validate()` runs.
- **Runs:** CI on every bureau PR, and locally with the same command.

**S3: the intake-checklists pages, storage seed in → rendered page out** (existing)
- **Proves:** D1, D3, D4 and D5. El Paso's page shows the summary above the unchanged sections, with the deciding quote linked. A seeded Tier 3 jurisdiction with only `intake.json` renders the summary with `Checklist: None` and no source sections, and the index lists it with its tier. A jurisdiction with neither file is still not found. The viewer and outsider cases in the e2e still hold.
- **Prior art:** `cityhall/e2e/intake-checklists.spec.ts`, over `supabase/seed/96-intake-checklists.sql` and the `cc-source-snapshots` storage seed.
- **Runs:** cityhall's Playwright e2e against a local Supabase stack, in CI (this box has no local stack).

`pickDecidingQuotes` (D3) is a pure function and gets a unit test beside it, in the shape of `source-index.test.ts`.

## 7. PR plan

**P1: 3.1-write keeps the classification, the fence, and the 1.5 notes**, `bureau`
- **Blocked by:** nothing (can start now).
- **Delivers:** every intake-prospecting run from here commits a `classification` block, and research sessions can no longer read `intake.yaml`. Lands D2, D6 and D8.
- **Tested at:** S1.
- **Door:** two-way (revert the PR).
- **Blast radius:** intake-prospecting runs only. A wrong fence breaks 2.3-verify's id numbering or 3.1's commit, which S1 covers.

**P2: the sync publishes `intake.json`**, `bureau`
- **Blocked by:** P1 (imports its schema).
- **Delivers:** any `intake.yaml` on main reaches `cc-source-snapshots/<slug>/intake.json`. Lands D7. On merge, El Paso's current file (no block) publishes; the page ignores it until P4.
- **Tested at:** S2.
- **Door:** two-way. A revert stops future uploads, and objects already uploaded stay (Q2).
- **Blast radius:** the `cc-source-snapshots` sync. An invalid file fails the job and uploads nothing, the existing alert fires, and the pages keep their previous data.

**P3: backfill El Paso and Austin**, `bureau`
- **Blocked by:** P2 (so the merge publishes them), and Q1 for Austin.
- **Delivers:** D9. Both files on main and in the bucket.
- **Tested at:** S1's gate (the files parse with `IntakeYaml`) and S2 (the CI dry-run plans both).
- **Door:** two-way for bureau; the bucket objects stay after a revert (Q2).
- **Blast radius:** Austin's file sets `next_item: 195`, which a future Austin intake-prospecting run would mint from. That matches db-schema D5.

**P4: the summary section, intake-only pages and the tier column**, `cityhall`
- **Blocked by:** nothing for the merge: with no `intake.json` every page renders as today. It shows data once P3 is merged.
- **Delivers:** D1, D3, D4 and D5, with El Paso's storage seed updated to carry the block and one seeded Tier 3 jurisdiction.
- **Tested at:** S3, plus the `pickDecidingQuotes` unit test.
- **Door:** two-way.
- **Blast radius:** the two intake-checklists pages. A parse failure on `intake.json` hides the summary and never 404s a page that has a checklist.

**Acceptance:** after P3 and P4, `/intake-checklists/el-paso` and `/intake-checklists/austin` show the Tier 1 summary in production, each with a deciding `hold_text` quote.

## 8. Not yet specified

- **Gate-evidence snapshots.** The manifest and bucket hold only snapshots that items cite (`step_write.py`, `used_sids`), and a Tier 2 or 3 run writes no manifest, so most deciding quotes link to the live page (D4) and cannot be rechecked against what we read. Keeping them means a manifest, and an uploaded snapshot set, for jurisdictions with no checklist. That will need its own decision once a Tier 2 or 3 jurisdiction has a page.
- **What a Tier 2 or 3 page offers below the summary** once the generic baseline (db-schema D2) has a version: probably a link to it.

## 9. Out of scope

- The readout's "Need you?" questions, `content_items` and retype quotes on the page (Will, 2026-10-22).
- A model-written summary (jurisdiction-pages D4 ruled it out).
- Changing 1.4-classify's prompt or outputs; the classify loop owns it (CLASSIFY-LOOP-SPEC).
- Classifying jurisdictions beyond El Paso and Austin: a new intake-prospecting run does it.
- A DB home for the summary (db-schema T5 and D6 defer `jurisdiction_intake`).
