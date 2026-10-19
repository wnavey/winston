# Reference images for intake checklist items

**Status:** Draft v1
**Date:** 2026-10-16
**Parent:** `../db-schema/DESIGN-SPEC.md` (v2.2, its Step 1) and `../db-schema/AUDIT-2026-10-16-tables.md` §3. Revises `../../completeness-check/vision-reference-images/DESIGN-SPEC.md` (winston#312) D2 and P2: the figures live in the App DB and Storage, not in a `figures/` folder in bureau.
> **Iteration 2 (2026-10-19):** `iteration-2/DESIGN-SPEC.md` changes D2 (one `description` column; `caption`, `constraints`, `type` dropped; `item_refs` kept for people to read), D6 (no ref checks or skips at hydration), D8 (the text sent with a figure), D9 (the prompt bullet) and D11 (the guide's Validation Methodology, not `item_refs`, links a figure to an item and says how to use it). This file is left as built.

**Repos touched:**
- `cityhall`: the `intake_figures` table, `jurisdictions.code`, the `intake-figures` bucket and its policies, a figures section on the intake-checklists pages, a signed-URL route
- `bureau`: an `intake-figure` CLI (upload, retire, list); figure hydration at 1.4-resolve; `--ref` in the CC vision CLI; the review prompt; amend and publish metadata

**Repos NOT touched:** `conductor` (legacy CRC keeps `crc_vision_check`), `conductor2`, `substation`, `inspector-general`, `claude-plugins`

Code read on 2026-10-16 at bureau `7fc10ab48f`, cityhall `eb6c584`, conductor `fbfd1c4`. Paths are relative to each repo.

## Problem

The completeness-check (CC) runbook cannot show the vision model what "right" looks like, and nothing in Noetic's stores holds a figure for an intake item.

- **The CC guides have no images.** No guide under `jurisdictions/*/completeness-check` has a `## Figures` section, and bureau tracks 0 images and 0 PDFs (db-schema §Problem).
- **The vision CLI takes one image and one question.** `runbooks/completeness-check/bin/vision.ts` accepts `--document-id`, `--sheet`, `--prompt` and `--item-ids`; anything else is "unknown flag" (`parseArgs`, `:58-79`, allow-list at `:65`). There is no `--ref`, `--region` or reference-image support anywhere in CC. The review prompt (`steps/2.1-review/steps/review/prompt.md:29-44`) describes that call and mentions no figures.
- **winston#312 sketched the vision side but nothing was built.** Its D2 put figures in a `figures/` folder beside the guide in git. The db-schema audit (A19, D17) moved the bytes to Storage with a `figures.yaml` manifest in bureau. The 2026-10-16 table audit, which Will accepted, moves the manifest itself into the DB: the figure rows are the source, and bureau holds no figure file at all.
- **CRC shows what goes wrong without a store.** Its figures live in the `crc-guides` bucket and are fetched whole into every run (`workflows/comment-resolution-check/scripts/fetch-crc-guides.ts:321-335`, `downloadOne`, no hash check). One Lamar + Collier set was overwritten in place on 2026-07-10 with no hashes recorded; captions are written by the agent at call time; references are sent raw with no resize and no cap (`conductor/src/tools/crc-vision-check/index.ts:402-419`); 4 of 57 calls in run 145517 attached one (db-schema audit §10.1–10.2).
- **The run already reads the App DB and Storage through its run token.** `runbooks/lib/app_client.py` holds the auth order (`credentials()`, `:135-161`: `SUPABASE_RUN_TOKEN` as bearer, the anon key as `apikey`, the service key as the local fallback at `:152-154`), a PostgREST reader (`pg()`, `:176-195`) and a bucket reader (`storage_get()`, `:316-321`, on `/storage/v1/object/authenticated/{bucket}/{path}`). 1.3-facts reads `project_facts` with it (`scripts/cc.py:140-148`). 1.2 downloads sheets from `submission-data` and verifies their sha256 (`runbooks/lib/stage_submission.py:715-716, 1258-1264`).
- **1.4-resolve copies the guide dir and records the run's provenance.** `cc.py:307` copies the whole version dir into `$RUN/1.4-resolve/checklist/`; `:313` writes `resolved.json` with `bureauCommitHash` and `checklistsTreeHash`. The contract (`steps/1.4-resolve/contract.test.ts:11-36`) is a `looseObject`, so new keys pass; `expectSurface` fails any output file not matched by the declared globs (`runbooks/lib/contract-helpers.ts:798-823`), and `checklist/` is one of them.
- **Amend compares the tree hash only.** `runbooks/lib/review_amend.py:69-85` refuses an amend when the version, the directory or the tree hash differs. `publish_review_cli.py:345-348` records only `checklistsTreeHash` on the review. A figure that lives outside git is invisible to both.
- **Item identity in the run is the composite ref.** The review agent gets `{{ITEM}}` (`cc-21--r2` → the guide `cc-21`) and the bare IDs from its guide table, and emits a bare `checklistItemId` (`prompt.md:6, 180, 210`). The ref `cc-21:CC-21-07` is formed downstream (`workflows/completeness-check/scripts/checklist-policy.ts:161`), is what reviews store, and is the item key the app shows (`src/app/(app)/intake-checklists/[jurisdiction]/items/page.tsx:159`) and routes on (`[checklistKey]/page.tsx:36-37`). Stable item IDs (db-schema D4) do not exist yet.
- **`workflow_run` can already read Storage.** cityhall grants the role `USAGE` on `storage` and `SELECT, INSERT, UPDATE, DELETE` on `storage.objects` (`supabase/migrations/20260711000000_workflow_run_role_and_rls.sql:641-642`), and five `workflow_run: select <bucket>` policies exist (`supabase/schemas/storage/tables/objects.sql:187-233`). Each is project-scoped through `workflow_run_claim_project_id()`; none is bucket-wide yet. Shared reference data uses `USING (true)` for the role, as `tables/jurisdictions.sql:30-33` does. This closes db-schema Q7.
- **The app already serves private-bucket images by signed redirect.** `src/app/(app)/intake-checklists/[jurisdiction]/sources/[source]/file/route.ts:45-61` answers `requireUser()`, signs the object for an hour and redirects (`src/lib/http.ts:35-40`, `signedRedirect`; a `THUMB` transform at `route.ts:9`). The intake-checklists pages are open to any signed-in user (`requireUser()`, `read.ts:17-23`), limited by the `jurisdictions` RLS policy.
- **Buckets are hand-written migrations in cityhall.** `supabase/migrations/20261007200000_cc_source_snapshots_bucket.sql:25-27` inserts the bucket row; the read policy is declared in `schemas/storage/tables/objects.sql:1-10`; `tests/db/storage-isolation.test.ts:35` lists the buckets every signed-in account may read (`AUTHENTICATED_READ_BUCKETS = ["cc-source-snapshots"]`). `AGENTS.md:121-127` has the declarative-schema rules; Jason applies migrations (`AGENTS.md:114`).
- **`jurisdictions` has no `code` column** (`schemas/public/tables/jurisdictions.sql:1-13`). db-schema D20 adds it; no view depends on the table and app reads name their columns.

---

## 1. The design at a glance

**Figures are the one content type whose source is the App DB.** A figure is a row in `intake_figures` plus an object in the private `intake-figures` bucket, addressed by sha256 and never overwritten. Bureau holds no figure file and no manifest (D1). A curator uploads with a CLI (D5). At 1.4-resolve the CC runbook reads the jurisdiction's live rows through its run token, fetches the bytes, verifies them, and writes `figures.json` and the files into the run's guide copy (D6). The review agent attaches a figure by id; the vision CLI sends it with the stored caption, resized, and logs it (D8, D9). The intake-checklists pages show the figures for debugging (D10).

```diff
 cityhall/supabase/
 ├── schemas/public/tables/
~│   ├── jurisdictions.sql                 # + code text null UNIQUE (db-schema D20)
+│   └── intake_figures.sql                # one row per figure; RLS; grants (D2)
 ├── schemas/storage/tables/
~│   └── objects.sql                       # + 2 policies: intake-figures select for authenticated, for workflow_run (D3)
 ├── migrations/
+│   ├── <ts>_intake_figures_bucket.sql     # the bucket row, by hand (D3)
+│   └── <ts>_austin_code.sql               # UPDATE jurisdictions SET code = 'AUS_TX' (D4)
 └── rls-isolation-allowlist.txt           # + intake_figures | reference | …
 cityhall/src/app/(app)/intake-checklists/[jurisdiction]/
~├── page.tsx                              # + Figures section (D10)
~├── [checklistKey]/page.tsx               # + the item's figures (D10)
+└── figures/[id]/file/route.ts            # signed redirect, ?thumb (D10)

 bureau/
 ├── tooling/src/cli/
+│   └── intake-figure.ts                  # upload | retire | list (D5)
 ├── runbooks/completeness-check/
~│   ├── scripts/cc.py                     # 1.4-resolve: hydrate_figures() (D6)
~│   ├── steps/1.4-resolve/contract.test.ts
~│   ├── bin/vision.ts                     # --ref <id> (D8)
~│   └── steps/2.1-review/steps/review/prompt.md   # "Reference figures" (D9)
 └── runbooks/lib/
~    ├── review_amend.py                   # figure set compared (D7)
~    └── publish_review_cli.py             # review metadata records the figures (D7)
```

**What the run sees after 1.4-resolve:**

```diff
 $RUN/1.4-resolve/
   resolved.json                           # + figures: [{id, sha256}], figuresSkipped: [...]
   checklist/
     cc-21.md                              # byte-identical to bureau
+    figures.json                          # the rows, plus each file's local path
+    figures/AUS_TX-F0001.png              # verified against sha256
```

---

## 2. Decisions

### 2.1 Where figures live

**D1. The DB and Storage are the source for figures; bureau holds nothing.** [Will, 2026-10-16; db-schema v2.2]
- A figure is one row in `intake_figures` and one object in `intake-figures`. There is no `figures.yaml`, no `## Figures` section in a guide, no `next_figure` counter and no lint rule for figures (db-schema D17 is revised to this).
- This is a bounded exception to db-schema D19 (bureau is the source of checklist text). The exception exists because bureau tracks no binaries, and a manifest in bureau that points at bytes elsewhere was the complication the audit removed.
- A figure belongs to a jurisdiction, not to a checklist version. It is live from `created_at` until `retired_at`. Which figures a review saw is recorded on the review (D7), not derived from a version.

**D2. The table.** [db-schema audit §3]

```sql
intake_figures
  id                text PK          -- 'AUS_TX-F0001'
  jurisdiction_slug text NOT NULL FK → jurisdictions(slug)
  item_refs         text[] NOT NULL  -- the items that use it, as composite refs 'cc-21:CC-21-07' (D11)
  caption           text NOT NULL    -- one line; what the vision CLI attaches (D8)
  type              text NOT NULL    -- 'reference-design' | 'site-example' | 'table' | 'redline'
  description       text NULL        -- what it shows, and what it does NOT show
  constraints       text NULL        -- the numbers to check against, if any
  sha256            text NOT NULL    CHECK (sha256 ~ '^[0-9a-f]{64}$')
  storage_path      text NOT NULL    -- '<code>/<sha256>.<ext>' in intake-figures
  media_type        text NOT NULL    -- 'image/png' | 'image/jpeg' | 'image/webp'
  px_w, px_h, bytes int NOT NULL
  derived_from      jsonb NULL       -- {snapshot, page, bbox}: where it was cut from
  created_at        timestamptz NOT NULL DEFAULT now()
  created_by        text NULL        -- a person, or a runbook_runs uuid
  retired_at        timestamptz NULL
  CHECK (id ~ '^[A-Z]{2,8}_[A-Z]{2}-F[0-9]{4,}$')
  CHECK (cardinality(item_refs) >= 1)
  INDEX (jurisdiction_slug) WHERE retired_at IS NULL
```

- **The id carries the jurisdiction's code** (db-schema D20) and a number that is never reused. The writer mints it as `max + 1` for the jurisdiction at insert; the PK makes a race fail loudly, and the CLI retries once (Q5). No counter file is needed: rows are retired, never deleted.
- **A changed figure is a new row.** Replacing an image, or rewording a caption so that it changes what the model is told, inserts a new figure and sets `retired_at` on the old one. A review that saw the old one still names it (D7). Fixing a typo in `description` is an UPDATE.
- **RLS and grants** follow `tables/jurisdictions.sql`: RLS on; `authenticated` and `workflow_run` get `SELECT … USING (true)`, with the explicit `GRANT SELECT … TO "workflow_run"`; no `anon` access; only `service_role` writes. The table goes in `supabase/rls-isolation-allowlist.txt` as `intake_figures | reference | city reference images; no tenant data`.
- **Why `item_refs` and not an FK:** there is no item table yet (db-schema P1b is deferred). The refs are checked at hydration against the staged guides (D6), which is where a wrong ref would matter.

**D3. The bucket `intake-figures`.**
- Private. `file_size_limit` 20 MB, `allowed_mime_types` `image/png`, `image/jpeg`, `image/webp`. The row is a hand-written migration in the shape of `20261007200000_cc_source_snapshots_bucket.sql:25-27`.
- Path `<code>/<sha256>.<ext>`. Objects are content-addressed and never overwritten: the CLI uploads with `upsert: false`, and an existing object is a no-op (the same bytes).
- **Read:** two policies in `schemas/storage/tables/objects.sql`, both bucket-wide:
  - `intake-figures: select for authenticated` … `USING (bucket_id = 'intake-figures')`, as `cc-source-snapshots` has (`:1-10`), and the bucket joins `AUTHENTICATED_READ_BUCKETS` in `tests/db/storage-isolation.test.ts:35`;
  - `intake-figures: select for workflow_run` … `USING (bucket_id = 'intake-figures')`. This is the first bucket-wide `workflow_run` storage policy; the role's existing policies are project-scoped (`objects.sql:187-233`). It is the same shape as the role's `USING (true)` read of `jurisdictions`: city reference data, no tenant rows.
- **Write:** `service_role` only. No policy grants `authenticated` or `workflow_run` INSERT.

**D4. `jurisdictions.code` lands here, with Austin's value.** [db-schema D20]
- The column: `code text NULL`, `UNIQUE (code)`, `CHECK (code ~ '^[A-Z]{2,8}_[A-Z]{2}$')`. `UNIQUE (slug, code)` as D20 asks, for the later composite FK.
- A hand-written data migration sets `austin` to `AUS_TX` (and `cedar-park` to `CP_TX`). db-schema P2a later makes `conventions.yaml` the source and `sync-conventions` the writer; until then the sync does not touch the column, because it names the columns it writes.
- The CLI refuses to mint a figure for a jurisdiction whose `code` is NULL.
- `pnpm gen-types` regenerates `src/types/database.types.ts` (`AGENTS.md:131`).

### 2.2 Writing a figure

**D5. A bureau CLI writes figures with the service key; no app upload in step 1.**
- `bun run intake-figure upload <slug> <file> --caption "…" --type reference-design --items cc-21:CC-21-07,cc-21:CC-21-09 [--description "…"] [--constraints "…"] [--derived-from '{"snapshot":"sn_…","page":14,"bbox":[…]}'] [--by will]`, in `tooling/src/cli/intake-figure.ts`, beside `sync-conventions.ts`. It:
  1. reads the file, computes sha256, probes width, height and media type (`jimp`, already a `bin/vision.ts` dependency), and refuses a type outside D3's list or a file over 20 MB;
  2. refuses a jurisdiction with no `code`, and a ref that is not in the jurisdiction's current guides (it reads the checkout it runs in, with `guide-items.ts`'s rules);
  3. uploads `<code>/<sha256>.<ext>` with `upsert: false`; an existing object is fine;
  4. inserts the row with the next id, retrying once on a PK conflict;
  5. prints the id and the row.
- `intake-figure retire <id>` sets `retired_at`. `intake-figure list <slug>` prints the live rows.
- It uses `SUPABASE_SERVICE_ROLE_KEY`, the key `sync-cc-sources.yml` already holds. The caller is a Will-directed session now, and intake-prospecting later (§6).
- **Why not an app page:** no cityhall page or server action uploads to Storage with the service role today (`eslint.config.mjs:124-126` restricts the import; the uploads that exist are machine lanes such as `src/lib/publish/sir.ts:461-463`). An upload UI is a later step (§6).

### 2.3 The CC run

**D6. 1.4-resolve hydrates the jurisdiction's live figures into the run.** After `cc.py:307` copies the version dir, `hydrate_figures(out, jurisdiction, guides)`:
1. **Reads the rows** through the run token: `app_client.pg(creds, "intake_figures?select=…&jurisdiction_slug=eq.<slug>&retired_at=is.null&order=id")`. No rows, or a jurisdiction with none, gives an empty `figures.json` and the step continues; this is the only path until the first figure exists.
2. **Checks each `item_refs` entry** against the staged guides: the stem must be a guide in `checklist/` and the bare id must be in that guide's ID column (`guide-items.ts` rules). A figure with no valid ref is **skipped** with its reason listed in `resolved.json.figuresSkipped`; one with some valid refs keeps those. The run never fails on a dangling ref: a figure is an aid, not an input, and a regroup in bureau should not block reviews.
3. **Fetches the bytes:** the host cache first, `$INTAKE_FIGURES_CACHE`, else `~/.cache/intake-figures/<sha256>`, in the pattern of `runbooks/lib/examples-hydrate.mjs:34, 142, 151-159` (digest verified, atomic rename); on a miss, `app_client.storage_get(creds, "intake-figures", storage_path)`.
4. **Verifies the sha256** of the bytes against the row. A missing object or a mismatch **fails the step** with the figure id and both hashes, the way the stager fails on a digest mismatch (`stage_submission.py:1258-1264`).
5. **Writes** `checklist/figures/<id>.<ext>` and `checklist/figures.json`: the rows as fetched, each with `file: "figures/<id>.<ext>"` and `item_refs` reduced to the valid ones.
6. **Records** `figures: [{id, sha256}]` (sorted by id) and `figuresSkipped: [{id, reason}]` in `resolved.json`.

- Both files sit under `checklist/`, which the step's `outputs` already cover, so `expectSurface` passes; `contract.test.ts` gains the shape checks (S2).
- The guides stay byte-identical to bureau. Nothing is injected into a guide (Q4).
- In the local lane without a run token, `app_client` falls back to the service key as it does for 1.3.

**D7. A review records the figures it saw, and amend compares them.**
- `publish_review_cli.checklist_metadata()` (`:345-348`) adds `figures: [{id, sha256}]` from `resolved.json` to the review's metadata, beside `checklistsTreeHash`.
- `review_amend.checklist_refusals()` (`:69-85`) gains one refusal: the run's figure set differs from the review's. A review recorded before this change has no `figures` key and is treated as the empty set, so amending it from a run that hydrated figures refuses, which is right: the model saw something the review's run did not.
- Together with `checklistsTreeHash` this pins everything a review's agents read: the guides through git, the figures through their hashes.

### 2.4 The vision call

**D8. `bin/vision.ts` gains `--ref <id>`, repeatable, at most 4.** [winston#312 D1, D4, D5, revised]
- The CLI reads `$RUN/1.4-resolve/checklist/figures.json` (the path it already derives `resolved.json` from). An id not in it, or more than 4 refs, exits non-zero with a reason on stderr and in the log. No `figures.json` at all, with a `--ref` given, is the same refusal.
- **The call, in both modes, in this order:** the target image; then for each ref a text part `REFERENCE <id> — <caption>. <description> Constraints: <constraints>.` followed by the image; then `vision-prompt.md`'s instructions; then the agent's question. The agent cannot replace the caption. Anything it wants to add goes in `--prompt`.
- **Resize:** each reference is downscaled so its long edge is at most `VIEW_PX` (2000, `vision.ts:253`), never upscaled, JPEG q90 for photos and PNG kept for line art, with `jimp` as the tiles are. The original stays in the bucket. #312 Q3 (2000 vs 1568) is still open and applies here.
- **Claude mode:** the resized references are copied into `$OUT/scratch/vision/` and listed in the child's prompt with their captions, after the target and its tiles.
- **Log:** `vision-log.jsonl` entries gain `refs: [{id, sha256, sentPx: [w, h]}]`. 2.11-tool-usage reconciles them like the other fields.
- Gateway and claude modes, `--item-ids` and the staged-file rules are unchanged.

**D9. The review prompt tells the agent when and how.** `steps/2.1-review/steps/review/prompt.md` gains a section after the vision section (`:29-44`):
- "`$RUN/1.4-resolve/checklist/figures.json` lists reference figures for this jurisdiction. Before you review, read it and note the figures whose `item_refs` name items in your guide."
- "When you verify such an item on a drawing, pass its figures: `--ref AUS_TX-F0001`. The vision tool shows the model the figure with its caption. Use at most 4 per call, and only figures listed for the item."
- "Do not open `checklist/figures/*` yourself." 2.11's rule for direct image reads (`scripts/tool_usage.py`) counts them as `binary_reads`, as it does the sheet images.
- What an agent is told remains facts about the figure; the prompt never asks it to describe a figure.

### 2.5 The app

**D10. The intake-checklists pages show figures, for debugging.** Any signed-in user who can see the jurisdiction sees them, as for the rest of the pages (`requireUser()`, the `jurisdictions` policy); Q2 covers what that means for site-example figures.
- **`/intake-checklists/[jurisdiction]`** gains a **Figures** section after the documents: a grid of `Thumbnail`s with the id, caption, type and the item refs as chips that link to `intakeItemHref`. It reads `intake_figures` with the user's client (`jurisdiction_slug = slug`, `retired_at is null`, ordered by id), in `[jurisdiction]/read.ts` beside `readChecklistSources`. No rows renders nothing.
- **`/intake-checklists/[jurisdiction]/[checklistKey]`** shows the item's figures above the citation tabs: `item_refs @> ARRAY[key]`, each as the image (`ImageViewer`) with caption, description and constraints.
- **`/intake-checklists/[jurisdiction]/figures/[id]/file`**, a GET: `requireUser()`, read the row with the user's client (so RLS applies), `createSignedUrl(storage_path, 3600, { transform })`, `signedRedirect`; `?thumb` uses the same `THUMB` transform as `sources/[source]/file/route.ts:9`. Bytes never pass through the app.
- The list page (`/intake-checklists`) is unchanged.

### 2.6 Item identity

**D11. `item_refs` hold the composite ref, and move to stable IDs in one update when the sidecar lands.**
- The ref `cc-21:CC-21-07` is what the run can check at 1.4-resolve, what the review agent can see in its guide, what reviews store, and what the app keys on today. Stable IDs (db-schema D3, D4) exist in no file yet.
- This reverses the table audit's recommendation of a thin stable-ID sidecar first (`AUDIT-2026-10-16-tables.md` §3, option A). The new fact is that the composite ref is already the key at every point a figure is used, and that hydration verifies refs against the guides, so a stale ref after a regroup surfaces at the next run rather than silently.
- When db-schema P2a lands `intake-ids.tsv`, a one-time script rewrites every `item_refs` entry through the sidecar, and the CLI and hydration switch to stable ids (Q3). The figure ids themselves never change.

---

## 3. Testing seams

**S1: the table, the bucket and their policies** (existing seam, new file)
- **Proves:** D2, D3, D4. `authenticated` and `workflow_run` read rows and download objects; `anon` reads neither; neither can insert a row or upload; the id CHECK and `cardinality(item_refs) >= 1` reject bad rows; `jurisdictions.code` rejects `austin`; `AUTHENTICATED_READ_BUCKETS` includes the bucket and the bucket is private.
- **Prior art:** `tests/db/child-table-rls.test.ts:104-122` (`writeAs("workflow_run", …)` sets the role and claims inside a transaction); `tests/db/verdict-triage-split.test.ts` (one rolled-back transaction per test, `as(role, fn)` at `:281-290`); `tests/db/storage-isolation.test.ts:132-158` (the allowlisted-bucket cases).
- **Runs:** `pnpm test:db` in cityhall, on the local Supabase stack, in the `check` CI job.

**S2: 1.4-resolve's contract and unit tests** (existing)
- **Proves:** D6. With a stubbed PostgREST and bucket: `figures.json` has one entry per live figure with its valid refs and local file; each file's sha256 matches; `resolved.json.figures` is sorted and complete; a figure with no valid ref is in `figuresSkipped` and not on disk; no rows gives an empty `figures.json`; a hash mismatch fails the step naming the figure. The real Austin tree with no rows is a no-op.
- **Prior art:** `steps/1.4-resolve/contract.test.ts` (shape and surface); `scripts/test_cc.py:41-89` (`resolve()` with stubbed DB readers).
- **Runs:** `node --test` over `examples/` via `npm test` in `runbooks/lib`, and `python3 -m pytest scripts/test_cc.py`, locally and in bureau CI.

**S3: the vision CLI** (existing, `bin/vision.test.ts`)
- **Proves:** D8. `--ref` parsing; an unknown id and a fifth ref refuse with a reason; the part order in gateway mode and the file list in the claude prompt; the resize never upscales and caps the long edge; the log entry's `refs`.
- **Prior art:** `bin/vision.test.ts` (tileGrid, claudeArgs, claudeChildEnv).
- **Runs:** `node --test` in `runbooks/completeness-check/bin`, locally and in bureau CI.

**S4: amend and publish metadata** (existing)
- **Proves:** D7. A review with `figures` amends from a run with the same set; a different set, or a pre-change review against a run with figures, refuses with the figure ids.
- **Prior art:** the tests beside `runbooks/lib/review_amend.py` and `publish_review_cli.py`.
- **Runs:** with bureau's `runbooks/lib` tests.

**Acceptance (not a seam):** after P4, upload the figures for one guide (Q1), run CC on a submission that guide has been run on before, and check that `vision-log.jsonl` carries `refs` on the calls for those items and that the review's metadata lists the figures. Then open `/intake-checklists/austin` and the item page and see them. A compare loop against an answer key (winston#312 S2) is a paid run on Will's go.

---

## 4. PR plan

**P1: the table, the column, the bucket** — `cityhall`
- **Blocked by:** nothing (can start now).
- **Delivers:** `schemas/public/tables/intake_figures.sql`; `jurisdictions.code` with its constraints; the bucket-row migration and the Austin and Cedar Park code migration (both by hand, per `AGENTS.md:124`); the two storage policies; the allowlist entry; the storage test entry; `pnpm gen-types`; `tests/db/intake-figures.test.ts`. Lands D2, D3, D4.
- **Tested at:** S1.
- **Door:** two-way (empty table, empty bucket; a follow-up migration drops them). Jason applies the migration before merge.
- **Blast radius:** none. Nothing reads the table until P3 and P5.

**P2: the `intake-figure` CLI** — `bureau`
- **Blocked by:** P1 applied to prod.
- **Delivers:** `tooling/src/cli/intake-figure.ts` with `upload`, `retire`, `list`, and its tests. Lands D5.
- **Tested at:** a unit test of the probe, the ref check and the id minting against a stub; then one real upload on Will's go.
- **Door:** two-way.
- **Blast radius:** none.

**P3: hydration, provenance and amend** — `bureau`
- **Blocked by:** P1 applied to prod.
- **Delivers:** `hydrate_figures()` in `cc.py`, the contract additions, `figures` in the review metadata, the amend refusal. Lands D6, D7.
- **Tested at:** S2, S4.
- **Door:** two-way.
- **Blast radius:** every CC run's 1.4-resolve, which now makes one PostgREST read per run and no-ops on an empty result. Amend's comparison changes for every CC review.

**P4: `--ref` and the review prompt** — `bureau`
- **Blocked by:** P3.
- **Delivers:** `--ref` in `bin/vision.ts`, the prompt section, the 2.11 rule. Lands D8, D9. Then the acceptance run.
- **Tested at:** S3, then acceptance.
- **Door:** two-way.
- **Blast radius:** opt-in; a run with no figures behaves as today.

**P5: the figures view** — `cityhall`
- **Blocked by:** P1 applied to prod. Independent of P2–P4.
- **Delivers:** the Figures section, the item page's figures, the file route. Lands D10.
- **Tested at:** a logic test of the reader beside `source-viewer.logic.test.ts`; visual check on prod after P2's first upload.
- **Door:** two-way.
- **Blast radius:** the two intake-checklists pages.

**Order:** P1 → {P2, P3, P5} → P4. The whole step is additive: no existing row, file or flag changes meaning.

---

## 5. Open questions

- **Q1. Which guide gets the first figures?** winston#312 Q1's candidates: CC-21 (its text says analysis-point tables and pond sections "are frequently graphical"), title-block and seal checks, legend checks. Default: CC-21, from the city's own drainage criteria figures.
- **Q2. Who may see a figure in the app?** D3 and D10 let any signed-in user who can see the jurisdiction see every figure, as for the source snapshots. A `site-example` cut from a real submission needs that submitter's permission (#312 Q2). Default until answered: only `reference-design` and `table` figures cut from public city documents are uploaded.
- **Q3. When stable item IDs land, rewrite `item_refs` or translate?** Default: rewrite once through `intake-ids.tsv` (D11).
- **Q4. Should hydration inject a `## Figures` section into the staged guide copy?** It would put the figures where the agent already reads, as CRC does. Default: no; the guides stay byte-identical to bureau, and `figures.json` plus the prompt section carry the figures. Revisit if the acceptance run shows the agent ignoring `figures.json`.
- **Q5. Id minting under concurrency.** `max + 1` with a retry is enough for one CLI user. A DB function with an advisory lock is the fix if intake-prospecting and a person ever upload at once.
- **Q6. The size and type limits.** 20 MB and png/jpeg/webp cover CRC's largest redline crop (2 MB, 4000 × 3210). Is webp wanted at all?
- **Q7. What resolution does the model see?** `VIEW_PX = 2000` against `annotate-crop.ts`'s 1568 (#312 Q3). D8 resizes to `VIEW_PX`; measure before tuning.

## 6. Not yet specified

- **An upload page in the app.** When someone who doesn't run a CLI needs to add a figure, cityhall needs a staff route that uploads with a server-side service-role client and mints the id. It would be the first app-side service-role upload.
- **intake-prospecting authoring figures.** The runbook could cut figures from the snapshots it captures and call the CLI's library with `created_by` set to its run id. That belongs with the prospecting-runbook spec.
- **Refresh.** `derived_from` names the snapshot, page and box a figure was cut from. The db-schema refresh sibling decides when a changed snapshot re-cuts a figure.
- **Cost in claude mode.** Each reference is another Read on the seat, and the ledger does not see it (winston#296 F3). The acceptance run should report tokens per call with and without refs.
- **Teaching the agent when a reference is worth it.** CRC's 4-of-57 says the prompt matters as much as the flag. D9's section is a first version.

## 7. Out of scope

- **Figures in bureau's git, or a `figures.yaml` manifest.** Decided against (D1, the table audit).
- **Versioning figures with the checklist semver.** A review pins them by hash (D7); the db-schema replica can list a version's live figures when it exists.
- **`--region`, `--tile` and `--ref-sheet`.** winston#312 P1 and P3.
- **CRC.** `crc_vision_check` and the `crc-guides` bucket stay as they are.
- **Moving checklist text or citations into the DB.** The db-schema spec, on its own triggers.
