# Audit: the eleven intake tables, for simplicity, and the path to them

**Date:** 2026-10-16
**Against:** `DESIGN-SPEC.md` Draft v2.1 (winston#314), `architecture.html` "The tables" tab
**Code checked:** bureau main @7fc10ab48f (`runbooks/completeness-check/scripts/cc.py:270-335`, `runbooks/lib/review_amend.py:80-85`, `workflows/comment-resolution-check/scripts/fetch-crc-guides.ts`, `workflows/shared/run-scoped-supabase.ts`, `runbooks/cc-source-citations/scripts/sync.mjs`); cityhall main @eb6c584 (`supabase/schemas/public/tables/{jurisdictions,bureau_checklist_version,bureau_checklist_item,review_checklist_comment_map}.sql`, `supabase/schemas/storage/tables/objects.sql`, `src/app/(app)/intake-checklists/**/read.ts`); winston#312 (vision reference images).

Two questions from Will: **do we need the eleven tables as drawn**, and **what is the minimum DB to give intake checklist items reference images first**, given that the images cannot live in bureau.

---

## 1. Verdict

No, not as drawn. Five of the eleven tables carry no information that the other six don't already carry or that nothing yet reads. The north star fits in **five tables**, and the first step (figures) needs **one**.

| Spec table | Verdict | Why (finding) |
|---|---|---|
| `intake_checklists` | keep (can defer until the baseline exists) | T6 |
| `intake_checklist_versions` | keep | T7 |
| `intake_checklist_groups` | keep | — |
| `intake_checklist_items` | keep; absorb `derived_from` and citations | T1, T3 |
| `intake_figures` | keep, as the **only** figure table, unversioned | T4, §3 |
| `intake_items` | **drop** | T1 |
| `intake_groups` | **drop** | T1 |
| `intake_checklist_figures` | **drop** (merged into `intake_figures`) | T4 |
| `intake_checklist_version_commits` | **drop** (stamp the reviews once) | T2 |
| `intake_checklist_citations` | **defer** (jsonb on items until a query needs rows) | T3 |
| `jurisdiction_intake` | **defer** to the baseline sub-spec | T5 |

Plus `jurisdictions.code` (D20), which stays.

---

## 2. Findings

**T1. The three identity tables are shells.** `intake_groups` has no column besides its key. `intake_items` holds `derived_from` (set at the version where the split happened, so it is per-version data), `jurisdiction_slug` (always equal to the checklist's), and `minted_in_version` / `retired_in_version`, which D8 step 4 computes from the version rows and which a view can compute the same way (`min(version)` where the item appears; the first version after its last appearance). `intake_figures` is the same shape. The stated reason for them, "something that must point at the item, whatever version, has a key to point at" (D6 Names), has no pointer anywhere in this spec. The review-linkage sibling would point at a version-specific row anyway, because a review ran against one version. The guarantee that an ID belongs to its checklist already comes from the anchored CHECK on the ID string. **Drop all three.** Put `derived_from` on `intake_checklist_items`. Add the minted/retired view when a reader wants it.

**T2. `intake_checklist_version_commits` exists for 19 reviews.** Its only use is D5: resolving a pre-sidecar review's `bureauCommitHash` to a version. From P2a on, every review records `intakeVersion` directly (D14), so the table never gains a forward-looking reader. The one-time backfill can instead **stamp `intakeVersion` into those 19 reviews' `metadata`** (and the other 40 under Q1 if ever wanted) and the table disappears. If a commit-to-version lookup is still wanted for audit, a `commits text[]` column on `intake_checklist_versions` holds it without a table or a join.

**T3. Citation rows duplicate a live artifact.** The jurisdiction page (cityhall#403, merged 2026-10-16) reads `cc-source-snapshots/<j>/citations/<v>.json` straight from the bucket, published by `sync.mjs`. The query that justifies rows, "every region on snapshot X, page N", is not asked by any page yet. Store `citations jsonb` on `intake_checklist_items` (with `stale` computed into it by the sync) and promote to rows when a cross-item query exists. That also removes `source_id` (Q8) from the schema until the manifest has it.

**T4. Figures don't need a per-version split.** `intake_checklist_figures` re-inserts every figure row for every semver, so a PATCH for a prose typo copies all figure rows. A figure is immutable by sha256 and is already independent of any item (v2.1), so one unversioned table with `retired_at` is enough: a changed figure is a new row and the old one is retired. A version's content hash can still include the `{id, sha256}` list of the figures live at sync time if the replica needs to say which figures a version had. `item_ids text[]` is already not an FK in the spec ("checked by the sync"), so nothing is lost. See §3.

**T5. `jurisdiction_intake` is ahead of its need.** Every jurisdiction with a checklist today is `formal` with its own checklist. `basis` and `GENERIC` only mean something once `intake/baseline/` has a version, and D2 says the folder stays empty until the baseline sub-spec. D1's reason for a standalone `intake.yaml` ("so that one sync owns every intake row and writes them in dependency order") was overtaken by D13, which puts both syncs in one workflow with `needs: conventions`. Defer the table to the baseline sub-spec. If an assignment row is wanted earlier, three columns on `jurisdictions` (`intake_checklist_id`, `intake_basis`, `intake_evidence`) written by the conventions sync are simpler than a table, at the cost of an FK cycle, which is another reason to wait.

**T6. `intake_checklists` collapses onto the jurisdiction until GENERIC exists.** With D20 the checklist id *is* the jurisdiction code, `kind` is derivable from it, and `bureau_path` is derivable from the slug. The table earns its place only when the baseline is a second kind of checklist. Keeping it now costs the composite FK and a hard dependency on P1a being applied before any intake row. Acceptable to keep (north-star D5 is decided), but it can also wait for the baseline with no loss.

**T7. Versions: four denormalised counts.** `item_count`, `group_count`, `figure_count` and `citation_counts` are derivable, and the sync has to keep them right. Fine as a convenience, flagged only so they aren't mistaken for data.

**T8. Factual: Q7 is already answered.** The spec says "No storage policy targets that role today" (D7, Q7). cityhall `supabase/schemas/storage/tables/objects.sql` has five `workflow_run: select <bucket>` policies (`crc-guides` at :187, `research-data`, `site-plan-documents`, `submission-data`, `workflow-runs`), and CRC's `fetch-crc-guides.ts` downloads figures with the run token through `createRunScopedClient`. An `intake-figures` read for `workflow_run` is one policy in the same shape with `USING (bucket_id = 'intake-figures')`. No signed-URL step is needed for cloud runs. Close Q7.

**T9. Design-level: D17 as written needs zero tables.** Hydration reads `figures.yaml` from bureau and the bytes from the bucket; the audit called DB rows "optional" (A19 §10.3). So "figures start in the DB" is not a reordering of D17, it is a change to it: the DB, not bureau, becomes the source for one content type. §3 spells out what that changes. It also removes one reason D4 gives for `next_*` counters: rows in a DB are never deleted (they are retired), so the high-water mark that a file folder needs is just `max + 1` at insert.

---

## 3. Step 1: reference images, DB-first

**The decision implied by Will's framing.** Figures and their item assignment live in the App DB and Storage; bureau holds no figure manifest and no figure markdown. That is the one content type where the DB is the source (an explicit, bounded exception to D19).

**What it removes from the spec:** `figures.yaml`, `next_figure` in `intake.yaml`, lint rule 7 (which needed the service key in CI), the `intake:figure-upload` CLI printing yaml rows, the authored `## Figures` section in guides, and the `intake_figures` + `intake_checklist_figures` pair.

**What it adds:**
- **Hydration at 1.4-resolve** reads the jurisdiction's live figure rows through the run token (as 1.3 reads `project_facts`), downloads each by sha256 from the bucket (host cache first), verifies, and writes `checklist/figures/<id>.<ext>` plus `checklist/figures.json` into the run. It records the `{id, sha256}` list in `resolved.json`. That list is the provenance; `checklistsTreeHash` no longer pins figures, so amend compares it too.
- **The vision CLI's `--ref <id>`** (winston#312 P2) reads `figures.json` instead of `figures.yaml`. Same caption rule: the stored caption, never the agent's.
- **The review prompt** names each item's figures from `figures.json`. That is the staging change Will set aside; noted only so the seam is visible.
- **A writer.** Staff upload in the app, or a CLI with the service key. Either way the writer computes sha256, uploads to `intake-figures/<code>/<sha256>.<ext>`, then inserts the row. Orphan blobs from a failed insert are harmless (content-addressed).

**The one table:**

```sql
intake_figures
  id                text PK          -- 'AUS_TX-F0001'; minted as max+1 per jurisdiction at insert; rows are never deleted
  jurisdiction_slug text NOT NULL FK → jurisdictions(slug)
  item_refs         text[] NOT NULL  -- the items that use it (see the prerequisite below)
  caption           text NOT NULL
  type              text NOT NULL    -- reference-design | site-example | table | redline
  description, constraints  text NULL
  sha256            text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$')
  storage_path      text NOT NULL    -- '<code>/<sha256>.<ext>' in bucket intake-figures
  media_type        text NOT NULL
  px_w, px_h, bytes int NOT NULL
  derived_from      jsonb NULL       -- {snapshot, page, bbox}
  created_at        timestamptz NOT NULL DEFAULT now()
  created_by        text NULL
  retired_at        timestamptz NULL -- a changed figure = new row, old row retired
  CHECK (id ~ ('^' || (SELECT code FROM jurisdictions j WHERE j.slug = jurisdiction_slug) || '-F[0-9]{4,}$'))  -- or enforce in the writer
  INDEX (jurisdiction_slug) WHERE retired_at IS NULL
```

RLS: `authenticated` and `workflow_run` SELECT, service_role write, `reference` in the allowlist. Bucket `intake-figures`: private; `authenticated` and `workflow_run` SELECT (T8); service_role write; in `AUTHENTICATED_READ_BUCKETS`.

**Also in step 1:** `jurisdictions.code` (D20). It is one nullable column, and figure IDs carry it. Minting figures as `F0001` scoped by slug and renaming later is exactly what D20 exists to prevent, so include it.

**The prerequisite question: what does `item_refs` hold?** The run today identifies items only by legacy ref (`cc-21:CC-21-07`), which changes at a regroup. Two options:

| Option | What lands first | Trade |
|---|---|---|
| **A. Stable IDs first (recommended)** | a thin P2a in bureau: `intake-ids.tsv` for v2.7-trimmed, the ref-match lint (D12 rule 2), and amend's content hash (D18). No semver, no groups tsv, no codes in files beyond `conventions.yaml`. | figure links are permanent from day one; one small bureau PR before the first figure |
| **B. Legacy refs now** | nothing in bureau | figures ship a PR sooner; a regroup before the sidecar lands breaks links; a later migration maps refs to IDs through the sidecar |

Either way the D18 amend change is needed the moment any new file enters a version dir, so A costs little more than B.

---

## 4. The phased path

1. **Step 0 (bureau, small).** Thin stable-ID sidecar + amend content hash (option A). Lands D3, D4's format, D18.
2. **Step 1 (cityhall + bureau).** `jurisdictions.code`; `intake_figures`; the bucket and its two read policies; the upload writer; hydration at 1.4-resolve; `--ref` in the vision CLI; one guide's items get real figures (winston#312 Q1's pick). Lands D17 (revised) and D20.
3. **Step 2 (the replica), on a trigger.** `intake_checklists` (or wait for the baseline), `intake_checklist_versions`, `intake_checklist_groups`, `intake_checklist_items` with `derived_from` and `citations jsonb`; `intake_sync_version()`; the `intake` job; semver in `version.yaml` and the bump linter. Triggers: review linkage wants item keys, the jurisdiction page moves off the bucket, or intake-prospecting's output needs a DB reader. Lands D5 (as a metadata stamp), D6, D8–D11, D13, D14, D15.
4. **Step 3, each on its own trigger.** `jurisdiction_intake` with the baseline sub-spec; citation rows when a cross-item query exists; the minted/retired view when a reader wants it.

North star: five tables (`intake_checklists`, `intake_checklist_versions`, `intake_checklist_groups`, `intake_checklist_items`, `intake_figures`) and one column, instead of eleven tables.

---

## 5. What this does not change

- Bureau stays the source for checklist text (D19). The exception is figures only.
- Stable IDs, codes, semver and the sync function are kept; they move later in the order.
- `architecture.html` "The tables" matches the markdown (eleven tables); both need the same edit if these findings are taken.
