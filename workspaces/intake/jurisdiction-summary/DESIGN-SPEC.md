# Intake summary on the jurisdiction page

**Status:** Draft v1.1
**Date:** 2026-10-22
**Repos touched:** `bureau` (intake-prospecting 2.3-verify, 3.1-write and 4.2-publish, the 1.0 worktree's sparse set, the `cc-source-snapshots` sync, a backfill of El Paso's and Austin's `intake.yaml`), `cityhall` (`/intake-checklists` index and `/intake-checklists/[jurisdiction]` homepage, storage seed, e2e)
**Repos NOT touched:** `substation`, `conductor2`, `cartographer`, `surveyor`, App DB schema (no migration)
**Parents:** `../tiers-golden-set/DESIGN-SPEC.md` (the tiers), `../tiers-golden-set/CLASSIFY-LOOP-SPEC.md` (1.4-classify, bureau#2187), `../jurisdiction-pages/DESIGN-SPEC.md` (the homepage, D3 and D4), `../db-schema/DESIGN-SPEC.md` (D1, the `intake.yaml` file)

> **Revision note v1.1 (2026-10-22, audit by a fresh session + Will's rulings).** Every audit finding was verified and folded in.
> - **Will:** Austin's `intake.yaml` is a hand backfill (Tier 1, no rerun), dated from the GitHub history of Austin's checklist: bureau#2175, `3c94bf3fab`, 2026-10-20. That closes **Q1**. **Q2** is closed (no deletion, per db-schema D13). **Q3** stays open as Will's call, now with evidence. **New Q4:** is the classifier's rationale fit to show as the page's evidence summary?
> - **D1:** row 3 is now **Last assessed**, which shows `decided_at` (the date the run wrote the assignment), not the date of the classification.
> - **D2:**
>   - The block gains the required `classified_by` and `classified_at`, with a named source for `classified_at`.
>   - The schema moves to `runbooks/lib/intake/intake-yaml.ts` with its constants, and its checklist regex accepts both id forms.
>   - `page`/`words` are optional (only El Paso's p03 quotes have them).
>   - The writer uses `ensure_ascii=False`.
>   - The reason given for quoting `gate` is corrected: none of today's parsers reads a bare `yes` as a boolean, and quoting stays as cheap insurance.
> - **D3:** the `unknown` rule is stated precisely, and the second quote prefers a different source.
> - **D4:** quotes join to a snapshot by URL, not by source key (Austin's manifest is keyed by URL), and only when the source has a page.
> - **D5:** a separate `readIntakeSummary`, so the four other callers of `readChecklistSources` don't change. An intake file without a `classification` block hides the Tier row.
> - **D6:** `decided_by` uses the console's name form (`Will Navey`), never an email, because `intake.json` is readable by any signed-in user.
> - **D7:**
>   - An invalid `intake.yaml` skips only its own `intake.json`.
>   - The sha is taken over the converted body.
>   - The sparse-checkout claim is fixed (`runbooks/lib/` is already there).
>   - P2's merge alone starts no sync.
> - **D8** is cut to the physical fence:
>   - Exclude the file from the worktree's sparse set, with a file-pattern widen on both of 3.1's branches.
>   - 2.3-verify reads `next_item` from the base commit, which also fixes a renumbering bug on a 4.1 regroup.
>   - AGENTS.md rule 7 is reworded.
>   - The rule-19 `BARRED` regex is dropped: it gives a false positive on a real p03 `git log`, and the scan wasn't running in the loop passes. Both gaps go to §8.
> - **D9:**
>   - The El Paso backfill also applies D6 and removes the "Need you?" sentence.
>   - Austin is hand-written.
>   - The P3 script checks every committed quote against a copy we still hold, because p03's snapshots were deleted.
> - **New §5.1, asks of db-schema P2a.**
> - **§1:** p03 versus main is stated precisely.
> - **S1, S2 and P3's tests** name the right test files.
> - **§4:** the rule-19 path is corrected.

## 1. Problem

Will wants each jurisdiction's intake page (`app.noeticbuild.com/intake-checklists/el-paso`, `/austin`) to open with a short **intake summary**: the tier, when we last assessed the city, the checklist version if there is one, the application type, the quote that decides the tier, why there is no list (Tier 2), and the evidence summary. The page's current content stays below it unchanged.

Today none of that summary reaches the page, and most of it never leaves the run dir.

**1.4-classify decides it, and 3.1-write drops it.** Since bureau#2187 (`fdc8014cdc`), `1.4-classify/classification.json` holds `gate`, `gate_evidence[{source, quote, kind}]`, `tier`, `content_items`, `why_no_list`, `basis`, `application_type`, `scope_sources`, `rationale`, `evidence[{source, quote}]` and `retype` (`runbooks/intake-prospecting/scripts/schemas.ts`, `Classification`). `intake_yaml()` (`scripts/iplib/step_write.py:165`) writes only `basis`, `application_type`, the rationale (as `evidence.summary`) and source labels with URLs. The rest is lost:
- `gate`, `gate_evidence`, `tier` and `why_no_list` are gone entirely. `basis` keeps Tier 1 (`formal`) and an unknown gate (`inconclusive`), but Tier 2 and Tier 3 both become `none_found`, which erases the distinction the golden set was built to make.
- The 1.5-scope approve schema says its notes are "Carried into the bureau PR body" (`steps/1.5-scope/decision.schema.json`), but `cmd_publish` reads only `4.1-review/decision.json`, so that promise is not kept.
- `decided_by` is the run name (`el-paso`), not who ruled. db-schema D1 says it should be a person or a run id. The El Paso run's own `1.5-scope/decision.json` says `"decided_by": "Will Navey"`.
- The CLASSIFY-LOOP-SPEC §9 put "Steps 1.5 onward" out of scope, which is why #2187 left 3.1-write alone.

**The page reads only the bucket, and 404s without a checklist.** `readChecklistSources` (`cityhall/src/app/(app)/intake-checklists/[jurisdiction]/read.ts`) reads `jurisdictions` plus `CURRENT_VERSION`, `citations/<v>.json` and `manifest.json` from `cc-source-snapshots`. It returns not-found when `CURRENT_VERSION` is missing. It is also called by `items/page.tsx`, `[checklistKey]/page.tsx`, `sources/[source]/page.tsx` and `sources/[source]/file/route.ts`. The index (`intake-checklists/read.ts`) lists only bucket folders that have a `CURRENT_VERSION`. The bucket is filled by bureau's `sync-cc-sources.yml` → `runbooks/cc-source-citations/scripts/sync.mjs`, whose `plan()` skips any jurisdiction without `completeness-check/sources/manifest.json`. Nothing reads `intake.yaml`, so a Tier 2 or Tier 3 city, which by design never gets a checklist, can never have a page.

**Only El Paso has an `intake.yaml`, and it predates the tiers.** `bureau/jurisdictions/el-paso/intake.yaml` was written by run `el-paso` on 2026-10-15, under the old `basis.json` 1.4. Its `evidence.summary` ends with a sentence about the readout's "Need you?" section. Austin's checklist (`v2.7-trimmed`) came from the older pipeline, was last changed by bureau#2175 (`3c94bf3fab`, 2026-10-20), and has no `intake.yaml`. db-schema D1 and D5 define the one Austin should get (`next_item: 195`), but db-schema P2a, which would write it, is not built yet.

**Classify-loop pass p03 classified both cities.** It ran at `~/noetic/working/intake-prospecting/tiers/p03/`, at head `168d59106d`, and met the bar with 15/15 gates right and 9/9 tiers right.
- Its 1.4 prompt differs from main only in the revise paragraph, which a first round does not read.
- The runbook diff between `168d59106d` and main also changes 1.4's `step.yaml` description, and `step_capture.py` (main adds an Internet Archive fallback when a capture fails).
- Results:
  - Austin: gate yes, Tier 1, `Consolidated Site Plan`, 18 gate quotes (15 `hold_text`, 2 `practice`, 1 `statute`), each `{source, quote, kind}` only.
  - El Paso: gate yes, Tier 1, `Detailed Site Development Plan`, 6 `hold_text` quotes, each also carrying `page` and `words`.
- Both runs are parked at 1.5-scope. Their `1.3-capture/snapshots/` have since been deleted, so the quotes can no longer be checked against what was captured.

## 2. What the page shows

```
┌ Intake checklists ─────────────────────────────────────────────── [All items] ┐
│ City of El Paso                       Active                                  │
│                                                                               │
│ Intake summary                                                                │
│  Tier 1  The city holds incomplete site plans and publishes what it checks    │
│  Application        Detailed Site Development Plan                            │
│  Last assessed      2026-10-15                                                │
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

A Tier 2 city shows `Why there is no list: never written`. A Tier 2 or Tier 3 city shows `Checklist: None`, with no checklist or source sections below it.

## 3. Decisions

**D1. The summary is the page's first section, above the existing sections, which do not change.** It shows these rows, in order, each hidden when it has no value:
1. **Tier**: a badge (`Tier 1`, `Tier 2`, `Tier 3`, `Not determined`) and one fixed line of meaning:
   - Tier 1: "The city holds incomplete site plans and publishes what it checks."
   - Tier 2: "The city holds incomplete site plans but has no written list of what it checks."
   - Tier 3: "The city does not hold site plans for completeness before formal review."
   - Not determined (gate `unknown`): "We could not establish whether the city holds incomplete site plans."
   - Hidden when `intake.json` has no `classification` block.
2. **Application**: `application_type`, as the city writes it.
3. **Last assessed**: `decided_at`, the date the city's intake assignment was last written: by 3.1-write on a run, or by hand on a backfill.
4. **Checklist**: the `CURRENT_VERSION` label, the item count and `generated_at` from the citation file, linked to `/items`. With no published checklist it reads `None`.
5. **Why we say so**: up to two deciding quotes (D3), each with its source label linked as D4 says.
6. **Why there is no list** (Tier 2 only): `never written`, `not obtainable` or `withdrawn`, from `why_no_list`.
7. **Evidence summary**: `evidence.summary`, every gate quote, and `classification.classified_by` / `classified_at`, behind one disclosure that is closed by default (Q4).

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
  gate: "yes"                        # "yes" | "no" | "unknown"
  tier: 1                            # 1 | 2 | 3 | null
  why_no_list: null                  # never_written | not_obtainable | withdrawn; set exactly on Tier 2
  classified_by: "el-paso"           # the run whose 1.4-classify decided it, or a backfill's provenance note (D9)
  classified_at: 2026-10-15          # UTC date of that run's last passing 1.4-classify contract event in events.jsonl
  gate_evidence:                     # every gate quote, in classification.json's order
    - kind: hold_text                # hold_text | no_hold_text | practice | statute
      source: code-20-04-150-dsdp-procedure   # the sources.json key
      label: "El Paso Municipal Code § 20.04.150 Procedure (Detailed Site Development Plan)"
      url: "https://library.municode.com/tx/el_paso/codes/code_of_ordinances?nodeId=…20.04.150PR"
      page: 1                        # optional: copied when the quote carries it
      quote: "The application shall be reviewed by the planning division for completeness and shall not be processed until any missing information is supplied by the applicant and the fee has been received."
evidence:
  summary: >-
    …
  sources: [ … ]
decided_by: "Will Navey"             # D6
decided_at: 2026-10-15
```

- `label` and `url` are resolved from `1.2-discover/sources.json` at write time, because `sources.json` is never committed. `page` and `words` are copied when the quote carries them. The prompt does not ask for them; p03's El Paso quotes have them and its Austin quotes do not.
- `gate` is written quoted. None of today's readers parse a bare `yes` as a boolean: the `yaml` npm package, `Bun.YAML` and 2.3-verify's regex all keep it as text, and only PyYAML would not, but no code uses it on this file. Quoting costs nothing and protects a future reader.
- The writer passes `ensure_ascii=False` to `json.dumps`, as the conventions stub already does (`step_write.py:255`), so `§` and `’` are committed as themselves rather than as `\u` escapes.
- **The schema.** `IntakeYaml` gains the block with `classificationRules`' invariants: tier null exactly when the gate is unknown; Tier 3 exactly when the gate is no; `why_no_list` exactly on Tier 2; the tier agreeing with `basis` through `basisForTier`; and `classified_by` and `classified_at` required whenever the block is present.
  - The block itself is optional, so a file written before this spec still parses. 3.1-write's gate requires it.
  - `checklist` accepts both id forms, `^([a-z0-9-]+|[A-Z]{2,8}_[A-Z]{2}|GENERIC)$`, so db-schema D22's rename does not invalidate the file mid-transition.
- **Where it lives.** `IntakeYaml` moves, with `BASES`, `GATES`, `GATE_EVIDENCE_KINDS`, `WHY_NO_LIST` and `basisForTier`, to `runbooks/lib/intake/intake-yaml.ts`. That file depends only on `runbooks/lib` (zod, and `SourceKey` from `runbooks/lib/sources/schemas.ts`), so the sync (D7) can import it. `scripts/schemas.ts` re-exports all of it. §5.1 asks db-schema P2a to adopt it.

**D3. The page picks the deciding quotes by kind.** The classifier writes every gate quote (Austin's p03 run has 18), and the page shows at most two:
- **Gate yes:** the first `hold_text`, then the first `practice`. With no `practice`, the second is the next `hold_text`, preferring one from a different source than the first.
- **Gate no:** the first `no_hold_text` and the first `practice`.
- **Gate unknown:** the first two quotes that are not `statute`, preferring different sources.
- In every case a `statute` quote is shown only when no other kind is present.

1.4's prompt does not change: the classify loop tuned it, and quote order is not part of its contract.

**D4. A quote links to our captured copy when the bucket has one, else to the live URL.** The join is by URL, not by source key. Austin's `manifest.json` keys snapshots by URL (`https://austin.widen.net/content/d7vma1dqla/…SubmittalChecklist.pdf`) or Municode id, while a run's quotes use run-minted keys (`cc-submittal-checklist`).
- A quote links to the source page (`/intake-checklists/<slug>/sources/<source slug>`) when its `url` equals a snapshot's `source_key` or `url`, **and** that snapshot's source is in `buildSourceIndex(...).sources`. A source has a page only when an item cites it.
- Otherwise it links to `url` with ↗.
- An exact URL match keeps a different edition from being linked as "our copy". p03 Austin's `aw-site-plan-completeness-checklist` is the 6.1.2026 edition, and the bucket holds the 8.30.2022 one.

Today most gate quotes take the live URL. §8 records the gap.

**D5. A jurisdiction with an intake file and no checklist has a page.**
- **Reader.** A new `readIntakeSummary(supabase, slug)` reads and parses `<slug>/intake.json`, returning null when it is missing or invalid. `readChecklistSources` and its four other callers are unchanged.
- **Homepage.** The homepage calls both readers. It is not found only when both return null, or when RLS hides the `jurisdictions` row (as today).
- **Pages with no checklist.** That includes one whose citation file does not parse. The homepage renders the summary only: no version section, no source sections and no "All items" button. `/items` and the source pages stay not-found there, as today.
- **Index.** The index lists every visible jurisdiction whose bucket folder holds `CURRENT_VERSION` or `intake.json`. It gains a **Tier** column (the D1 badge, or `—` when there is no `classification` block). The Checklist column shows `—` when there is no checklist.

**D6. 3.1-write records who ruled, and 4.2-publish carries the 1.5-scope notes.**
- `decided_by` becomes `1.5-scope/decision.json`'s `decided_by` when it is a person (not `auto`), in the console's form (`Will Navey`), else the run name as today.
- Never an email: `intake.json` is readable by any signed-in user (Q3).
- db-schema D22 still owns replacing run names with `runbook_runs` uuids.
- `cmd_publish` adds the 1.5-scope notes to the PR body beside 4.1-review's, so the schema's promise is kept.

**D7. The sync publishes `intake.yaml` as `<slug>/intake.json`.**
- **The workflow.** `sync-cc-sources.yml` adds `jurisdictions/*/intake.yaml` to its `paths:` filter and its sparse checkout. The schema needs no new sparse entry, because `/runbooks/lib/` is already checked out (`sync-cc-sources.yml:38`).
- **Planning.** `sync.mjs` `plan()` adds one entry per `jurisdictions/<j>/intake.yaml`, whether or not the jurisdiction has a manifest.
- **Validation.** `validate()` parses the file with `IntakeYaml`. An invalid `intake.yaml` fails the job but uploads every other valid file, and skips only that jurisdiction's `intake.json`. This keeps a bad intake file from freezing every jurisdiction's citations.
- **Upload.** The upload writes the parsed object as JSON, so the app parses JSON, not YAML. Today's loop reads raw file bytes for both the sha and the body (`sync.mjs:101–105`), so the intake entry carries its converted body, and its sha is taken over that body.
- **CI.** The existing dry-run (`ci.yml:627`, `sync.mjs --root . --dry-run`) covers the new entry.
- **When it runs.** P2's merge changes no watched path, so it starts no sync job; P3's merge does.
- **Deletion.** A deleted `intake.yaml` leaves its object in the bucket (Q2, closed).

**D8. Keep `intake.yaml` off disk in the run's worktree.** Once it carries the tier and the gate quotes, a jurisdiction's `intake.yaml` is a prior answer. Today the 1.0 worktree's sparse set (`sparse_paths`, `scripts/iplib/common.py:128`) holds `/jurisdictions/<slug>/` minus `completeness-check/`, so the file is on disk for every session.
- `sparse_paths` adds `!/jurisdictions/<slug>/intake.yaml`.
- `widen_sparse` (`common.py:150`) adds directory patterns only: it appends a trailing `/`, which cannot re-include a file. A file form is added, either a flag or a sibling helper that adds `/<path>` with no slash.
- 3.1-write calls the file form before the `intake.yaml` write at `step_write.py:345`. That write runs on every branch, so the call does too; today's widen at :273 sits only inside `if own`. `narrow_sparse` restores the exclusion before any send-back, as it does for `completeness-check/`.
- 2.3-verify reads `next_item` with `git show <base>:jurisdictions/<slug>/intake.yaml`, where `<base>` is `worktree.json`'s `base`. That is the same read `writeRules` does at `lib/intake.ts:260`, and the blobless clone fetches the blob on demand.
  - Reading the base, not `HEAD` or the disk, also fixes a bug that exists today: a 4.1 revise with `regroup` re-runs 2.3-verify after 3.1 has committed, and reading the run's own file renumbers every item upward.
- AGENTS.md rule 7 is reworded so 3.1-write, a script, writes `intake.yaml`, and no session does.
- The rule-19 `BARRED` list (`runbooks/intake-prospecting/lib/rule19.ts:27`) does **not** gain `intake.yaml`. p03 El Paso's 1.2-discover ran `git log --oneline -3 -- jurisdictions/el-paso/prospector/intake jurisdictions/el-paso/intake.yaml`, which such a pattern fails, and the loop's tuned prompts would have to change to state the bar. The fence's remaining gaps are in §8.
- **Order:** P1 merges before P3 backfills, so no worktree cloned from main after the backfill has the file on disk. Replay corpora were made before it and hold only El Paso's old file, which has no tier.

**D9. Backfill El Paso and Austin.** One bureau PR (P3), reviewed by Will. That review is the human review of both summaries, which jurisdiction-pages D4 requires.
- **El Paso:**
  - Add the `classification` block from p03's `tiers/p03/el-paso-tx/1.4-classify/classification.json`, with labels and URLs from that run's `1.2-discover/sources.json`.
  - `classified_by: "classify-loop pass p03 (winston#331)"`, `classified_at: 2026-10-22`.
  - Apply D6: `decided_by: "Will Navey"`, from the El Paso run's 1.5 decision.
  - Remove the "Need you?" sentence from `evidence.summary`.
  - `basis`, `application_type`, the rest of `evidence` and `decided_at: 2026-10-15` stay as the 2026-10-15 run wrote them, because 1.5-scope approved that basis. p03's `application_type` matches.
- **Austin, by hand** (Will, 2026-10-22: Tier 1 is known, so there is no rerun):
  - db-schema D1 and D5's values: `checklist: austin`, `basis: formal`, `path: completeness-check`, `next_item: 195`.
  - `application_type: "Consolidated Site Plan"`.
  - `evidence.summary` hand-written for the page, not p03's rationale, which talks to the 1.5 reviewer ("see Need you?", "content_items is a gross, overlapping count…").
  - `evidence.sources`: the Consolidated Site Plan completeness check application and the submittal checklist.
  - `decided_by: "Will Navey"`, `decided_at: 2026-10-20` (the checklist's last change, bureau#2175).
  - `classification`: gate `"yes"`, tier 1, `classified_by: "hand (winston#334)"`, `classified_at: 2026-10-20`, and the deciding `hold_text` and `practice` quotes taken from p03 Austin's classification.
  - P2a later renames `checklist` to `AUS_TX` and adds `next_group` (§5.1).
- **Quote check.** p03's snapshots are gone, and 1.4's contract checks a quote's source key, never its text (`lib/intake.ts:155–160`). So the P3 script checks every committed quote against a copy we still hold, normalizing as `tiers-golden-set/verify_quotes.py` does, and fails on a miss:
  - Austin's LDC quotes (`ldc-25-1-82`, `ldc-25-1-61`) against `jurisdictions/austin/codes/ldc/contents/…` in bureau.
  - The others against the bucket snapshot whose URL matches, else against the live page fetched for the check.
- **Collisions:** none today. The file passes `IntakeYaml` and matches the intake gate's `checklist === slug` (`lib/intake.ts:251`) and 2.3-verify's `^checklist:\s*austin\s*$` regex. A future Austin run mints from `austin-0195`, which matches db-schema D5. The spelling gate and sync-bureau scan only `.md` files.

## 4. The change, as trees

```diff
 intake-prospecting
   AGENTS.md rule 7: intake.yaml is written by 3.1-write (a script)         # D8
   1.0-worktree
     sparse_paths
-      /jurisdictions/<slug>/  !…/completeness-check/
+      /jurisdictions/<slug>/  !…/completeness-check/  !…/intake.yaml     # D8
   2.3-verify
-    read intake.yaml next_item from the worktree disk
+    git show <base>:jurisdictions/<slug>/intake.yaml                     # D8
   3.1-write
+    widen_sparse(file: intake.yaml) on every branch; narrow before a send-back   # D8
     intake_yaml(slug, basis, sources, run_id, own, next_item)
+      classification: {gate, tier, why_no_list, classified_by, classified_at, gate_evidence[+label,url,page?]}   # D2
+      decided_by ← 1.5-scope decision.decided_by unless auto             # D6
+      json.dumps(ensure_ascii=False)                                     # D2
   4.2-publish
+    PR body carries the 1.5-scope notes                                  # D6
```

```diff
 bureau
 ├── runbooks/lib/
+│   └── intake/intake-yaml.ts            # IntakeYaml + classification block + its constants (D2)
 ├── runbooks/intake-prospecting/scripts/schemas.ts   # re-exports intake-yaml.ts (D2)
 ├── runbooks/cc-source-citations/scripts/sync.mjs
+│                                        # intake.yaml → <j>/intake.json; per-file skip (D7)
 ├── .github/workflows/sync-cc-sources.yml  # paths + sparse += jurisdictions/*/intake.yaml (D7)
 └── jurisdictions/
     ├── austin/
+    │   └── intake.yaml                  # hand backfill (D9)
     └── el-paso/
         └── intake.yaml                  # + classification block, decided_by, summary edit (D9)
```

```diff
 cityhall/src/app/(app)/intake-checklists/
   page.tsx                       index
+    Tier column; lists folders with CURRENT_VERSION or intake.json   # D5
   read.ts
+    readChecklistJurisdictions: + intake.json probe                  # D5
   [jurisdiction]/
     read.ts
       readChecklistSources                (unchanged; 5 callers)
+      readIntakeSummary(supabase, slug)   intake.json | null         # D5
     page.tsx
-      notFound() when readChecklistSources is null
+      notFound() only when both readers are null                     # D5
+      <IntakeSummary>  (tier · application · last assessed · checklist · quotes · why no list · disclosure)   # D1, D3, D4
       checklist + sources sections   (only when a checklist)
 cityhall/src/lib/intake-checklists/
+  intake-summary.ts              zod parse of intake.json, tier labels, pickDecidingQuotes, quote → source link   # D1, D3, D4
```

## 5. Open questions

- **Q1. Austin now, or with db-schema P2a?** **Closed (Will, 2026-10-22):** now, by hand (D9).
- **Q2. Does a deleted `intake.yaml` need to be removed from the bucket?** **Closed:** no. The sync only ever upserts (`sync.mjs:100–110`), and db-schema D13 has a removed `intake.yaml` leave its row and flag it unreconciled. That is the same posture.
- **Q3. Who sees the tier?** Any signed-in user who can see the jurisdiction row sees the page. The bucket policy (`cc-source-snapshots: select for authenticated`, cityhall `supabase/schemas/storage/tables/objects.sql:7–10`) lets **any** signed-in user read `intake.json` directly, whatever RLS says about the row, so a staff-only tier cannot live in this bucket.
  - The precedents point to showing it: db-schema D7 treats intake data as reference data read under the `jurisdictions` policy, and Will's 2026-10-15 ruling on jurisdiction-pages Q3 kept today's visibility.
  - It is still a customer-facing claim about a city, Tier 3 especially.
  - Recommendation: show it to every reader of the page, and keep anything non-public out of the file (D6).
  - If Will wants it staff-only, D7 moves the file to a staff-only path or bucket and the page checks `is_noetic_member`.
- **Q4. Is the classifier's rationale fit to show as the evidence summary?** For a run, `evidence.summary` is 1.4's `rationale`. The 1.5 reviewer reads and approves it, but it is written for that reviewer and can mention the readout ("see Need you?"). D1 shows it behind a disclosure, and D9 cleans the two backfills by hand. The alternatives are to hide it for runs until a page-facing summary exists, or to have 3.1-write trim it. Recommendation: show it as written, behind the disclosure.

### 5.1 Asks of db-schema P2a

- Adopt `runbooks/lib/intake/intake-yaml.ts` as the `intake.yaml` parser db-schema D1 names, or port it to `tooling/src/lib/intake/schema.ts` (bun, `Bun.YAML`, no zod today) and point the sync at the port. Either way there must be one parser.
- Update that parser in the same PR that renames `checklist` to `AUS_TX` or `EP_TX` and adds `next_group`.
- Update 2.3-verify's `^checklist:\s*<slug>\s*$` regex (`step_verify.py:197`) in the same PR. Otherwise minting falls back to 1 after the rename.
- Amend db-schema D1's "single parser" sentence and its example `decided_by: will` to match D2 and D6 here.

## 6. Testing seams

**S1: the runbook's steps, run dir in → worktree files out** (existing)
- **Proves:** D2, D6 and D8.
  - A fixture `classification.json` for each tier gives an `intake.yaml` whose `classification` block parses and agrees with `basis`, with labels and URLs resolved from `sources.json`.
  - `decided_by` is the 1.5 person, or the run name when the gate is `auto`.
  - Publish's PR body carries the 1.5 notes.
  - In a sparse clone, `intake.yaml` is off disk after 1.0, and 3.1 writes and commits it on both a formal and a `none_found` run.
  - 2.3-verify reads `next_item` from the base, and a regroup re-run keeps the ids.
- **Prior art:** `runbooks/intake-prospecting/tests/write.test.ts` (the 3.1-write tests at :69 and :112) for the file and the gate. The fence assertions go in `scripts/test_ip.py`'s sparse-clone test (:91–109), because the TS fixture is a plain repo where `widen_sparse` is a no-op.
- **Runs:** `cd runbooks/lib && npm run test:bin` and `python3 -m pytest runbooks/intake-prospecting/scripts --import-mode=importlib`; local and CI.

**S2: the sync CLI, a bureau checkout in → planned bucket objects out** (new fixture test on an existing CLI)
- **Proves:** D7 and D2's schema.
  - `sync.mjs --root <fixture> --dry-run` plans `<j>/intake.json` for a jurisdiction with a checklist and for one with only `intake.yaml` (Tier 3).
  - An invalid `classification` block skips that file's `intake.json`, still plans the others, and exits non-zero.
  - The planned body is JSON, and its sha is taken over that body.
- **Prior art:** none for `sync.mjs` itself; `ci.yml:627` runs the dry-run over bureau main. The new test is a node test beside `sync.mjs` over a temp fixture checkout, in the shape of `runbooks/intake-prospecting/tests/` fixtures.
- **Runs:** CI on every bureau PR; locally with `node --test`.

**S3: the intake-checklists pages, storage seed in → rendered page out** (existing)
- **Proves:** D1, D3, D4 and D5.
  - El Paso's page shows the summary above the unchanged sections, with its deciding quote.
  - A seeded Tier 3 jurisdiction with only `intake.json` renders the summary with `Checklist: None` and no source sections, and the index lists it with its tier.
  - An `intake.json` with no `classification` block hides the Tier row.
  - A jurisdiction with neither file is still not found.
  - The viewer and outsider cases still hold.
- **Prior art:** `cityhall/e2e/intake-checklists.spec.ts`, over `supabase/seed/96-intake-checklists.sql` and the `cc-source-snapshots` storage seed.
- **Runs:** cityhall's Playwright e2e against a local Supabase stack, in CI (this box has no local stack).

`pickDecidingQuotes` (D3) and the quote-to-source link (D4) are pure functions. Each gets a unit test beside it, in the shape of `source-index.test.ts`.

## 7. PR plan

**P1: 3.1-write keeps the classification; the worktree fence; the 1.5 notes**, `bureau`
- **Blocked by:** nothing (can start now).
- **Delivers:** every intake-prospecting run from here commits a `classification` block, and `intake.yaml` is off disk in a run's worktree. Lands D2 (including the schema move), D6 and D8.
- **Tested at:** S1.
- **Door:** two-way (revert the PR).
- **Blast radius:** intake-prospecting runs, and anything importing `IntakeYaml` through the re-export.
  - A wrong fence breaks 2.3-verify's id start or 3.1's commit; S1's sparse-clone test covers both.
  - No prompt changes, so the classify loop's tuning is untouched.

**P2: the sync publishes `intake.json`**, `bureau`
- **Blocked by:** P1 (imports its schema).
- **Delivers:** D7. From the next sync on, any `intake.yaml` on main reaches `cc-source-snapshots/<slug>/intake.json`.
- **Tested at:** S2.
- **Door:** two-way. A revert stops future uploads, and objects already uploaded stay (Q2).
- **Blast radius:** the `cc-source-snapshots` sync. An invalid intake file fails the job (the existing alert fires) but no longer blocks other files.

**P3: backfill El Paso and Austin**, `bureau`
- **Blocked by:** P1 (the fence must be on main first, D8) and P2 (so the merge publishes them).
- **Delivers:** D9. Both files on main and in the bucket. The merge triggers the sync.
- **Tested at:** the P3 quote-check script, and S2's CI dry-run over main, the only CI check that parses the committed files.
- **Door:** two-way for bureau; the bucket objects stay after a revert (Q2).
- **Blast radius:** Austin's `next_item: 195`, which a future Austin run would mint from, as db-schema D5 intends.

**P4: the summary section, intake-only pages and the tier column**, `cityhall`
- **Blocked by:** nothing for the merge: with no `intake.json`, every page renders as today. It shows data once P3 has synced.
- **Delivers:** D1, D3, D4 and D5, with El Paso's storage seed updated to carry the block and one seeded Tier 3 jurisdiction.
- **Tested at:** S3, plus the unit tests.
- **Door:** two-way.
- **Blast radius:** the intake-checklists homepage and index. A bad `intake.json` hides the summary and never 404s a page that has a checklist.

**Acceptance:** after P3 and P4, `/intake-checklists/el-paso` and `/intake-checklists/austin` show the Tier 1 summary in production, each with a deciding `hold_text` quote, `Last assessed` 2026-10-15 and 2026-10-20 respectively.

## 8. Not yet specified

- **Gate-evidence snapshots.** The manifest and bucket hold only snapshots that items cite (`step_write.py`, `used_sids`), and a Tier 2 or 3 run writes no manifest. So most deciding quotes link to the live page (D4) and cannot be rechecked against what we read. p03 showed the same problem from the other side: its snapshots were deleted, and P3 has to re-verify by hand. Keeping them means a manifest, and an uploaded snapshot set, for jurisdictions with no checklist.
- **`intake.yaml` is unfenced through `$BUREAU`.** D8 fences only the run's worktree. Sessions 1.2, 1.4, 2.1 and 2.4 also hold `$BUREAU`, a full checkout (p03's loop log: "1.4-classify: tools $BUREAU @ 168d59106d38"), where every `intake.yaml` is on disk.
  - 1.4's allowlist (the run's files and the worktree's briefing, codes, approvals, regulatory and prospector folders) already keeps it out by instruction.
  - 1.2, 2.1 and 2.4 have no such line, and a `grep -r` over `$BUREAU/jurisdictions/austin` would reach the backfilled answer.
  - The cheapest fix that leaves the tuned prompts alone is a `$BUREAU` that is itself a sparse checkout excluding `jurisdictions/*/intake.yaml` (in `launch_tiers.py` and conductor's tools checkout).
- **The rule-19 scan did not run in the classify-loop passes.** `barredCalls` reads `$RUN/.logs/<step>*.jsonl` and returns `[]` when no stream exists (`rule19.ts:64–73`). p03's `.logs/` holds only `loop-*.log` and `spend/`, and its session transcripts went to `~/.claude-shared/projects/…`. The 10-15 `el-paso` run does have the streams. The scan should fail as "not checked" when a research step has no stream. This is a rule-19 bug of its own, outside this spec. The same class of gap: `launch_tiers.py replay` copies `1.0-worktree` with `cp -cRp` and never re-applies `sparse_paths`.
- **What a Tier 2 or 3 page offers below the summary** once the generic baseline (db-schema D2) has a version: probably a link to it.

## 9. Out of scope

- The readout's "Need you?" questions, `content_items` and retype quotes on the page (Will, 2026-10-22).
- A model-written page summary (jurisdiction-pages D4 ruled it out).
- Changing 1.4-classify's prompt or outputs, or any loop-tuned prompt; the classify loop owns them (CLASSIFY-LOOP-SPEC).
- Classifying jurisdictions beyond El Paso and Austin: a new intake-prospecting run does it.
- A DB home for the summary (db-schema T5 and D6 defer `jurisdiction_intake`).
