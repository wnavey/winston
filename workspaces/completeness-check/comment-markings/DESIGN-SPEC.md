# Comment markings for the completeness-check runbook

**Status:** Draft v1.1
**Date:** 2026-10-07
**Repos touched (proposed):** `bureau` (shared annotate kit lifted out of `runbooks/review/scripts/`; a new `2.12-annotate` step family in `runbooks/completeness-check/`; the stager writes block boxes; lane B of `publish_review.py` validates and stamps markings), `cityhall` (the CC adapter reads `annotations` / `annotation_disposition` the way the August adapter does)
**Repos NOT touched:** `substation` (archived; its `supabase/` now lives in `cityhall`), `conductor2`, `inspector-general`, `claude-plugins`

> **In one paragraph.** The review runbook already places "markings" (points and 3–12-vertex
> polygons, normalised 0–1 over a plan sheet) on its comments. A separate step,
> `3.13-annotate`, does it *after* the final comment record exists: one agent worker per
> discipline crops the staged sheet PDF, converges a shape in up to three passes, and writes
> sidecar files that a script merges back into the record. Publish stores the markings
> *inside* `review_comments.output_json`. There is no table and no column for them. The app
> draws them because the review's `output_schema` routes it to the August adapter, which
> reads them on field presence. The completeness check publishes through a different lane
> and schema (`2026-03-completeness-check`), and its app adapter hardcodes
> `annotations: []`. Porting the feature therefore needs work in three places: a new
> annotate step in the CC runbook (reusing the review's scripts), a lane-B publish that
> validates and carries the fields, and a CC adapter in `cityhall` that reads them. The
> companion page `architecture.html` draws all of this.

> **Revision note (v1.1, 2026-10-07, Will's review of v1).**
> - **Every failing run gets geometry, not only the winning one.** D3 is rewritten: the
>   sweep's unit is a *(comment, run)* whose own run status is `fail` or `warn`, whatever the
>   comment's consolidated status. On `b80e5075` (runs = 3) that is 96 run-findings (84 cite
>   a sheet) across 36 comments, against 32 comment-level fail/warns in v1.
> - **New D12** says where per-run markers are stored: on each
>   `sourceFindings[0].perRunFindings[k]`. The comment-level `annotations[]` is a deterministic
>   copy of the *winning* run's markers, meaning the run whose text the comment shows.
> - **D1 is made explicit:** the step never adjudicates. It changes no status, text, vote or
>   reference.
> - **New §3.4** walks through every stored change, and says that `blockBoxes` is a staged
>   run file, not a DB change.
> - D5's CC adapter gains a run key. The roster numbers in §5 Risks and Q2 are updated.
>   Q7 is new.

---

## 1. How markings work in the review runbook today (the five questions)

Facts were verified on 2026-10-07 against bureau `dde80dfc`, cityhall `cea34728` and prod
(review `bbdb82cf-bab8-45c2-b646-1c6193071cbb`, project `1af11b7a-…`, run
`fort-lauderdale-take-5-2026-10-02`).

### 1.1 Are markings only supported for plan-set sheets?

**Yes.** Every marking names a `sheet`, and three layers each restrict that to a sheet of
the primary plan set:

- **Producer.** The sweep reads `1.2-stage-submission/primary-site-plan/sheet-NN/sheet-NN.pdf`
  only (`runbooks/review/steps/3.13-annotate/steps/sweep/prompt.md`, "Which sheet").
  `annotate-write.ts` refuses a sheet that the comment's `sheets[]` does not name.
- **Publish.** `build_bundle` resolves every `annotations[].sheet` and
  `annotation_disposition.sheets[].sheet` against `sheet_map`. That map is built from the
  staged `primary-site-plan/sheet-NN/` folders and is label→ordinal (`{"03": 3}`). If any
  label fails to resolve, the whole publish fails (`runbooks/lib/publish_review.py:660-707`).
- **App.** `cityhall` resolves the label through `reviews.output_json.sheet_map`
  (`src/lib/reviews/adapters/august.ts:281-291`). It draws over the `sheet_version` raster
  of the plan set version behind the review's submission
  (`src/app/project/[projectId]/review/[reviewId]/sheets/read.ts:32-61`). That read takes
  **one** plan set (`.limit(1).maybeSingle()`).

A comment about a supplementary document (a drainage report, an application form) cannot be
marked. The sweep records it as a sheetless `nothing-to-mark` with a reason, which is the
only status a sheetless disposition may take (`lib/annotate-merge.ts`,
`validateDispositionFragment`).

### 1.2 Do markings require pre-processing?

**Not for the geometry itself, but the runbook around it does require a preprocessed submission.**

- The sweep locates the shape against **rendered pixels of the staged sheet PDF**
  (`annotate-crop.ts` renders it). It does not use preprocessing's block boxes or text. The
  prompt forbids text search because "most annotation on these sheets is outlined vector
  text". Every marker carries `sheet_sha256`, the fingerprint of the PDF it was read against.
- Staging (`1.2-stage-submission`) is a preprocessed-submission stager. It lays out each
  sheet's transcription (`guide.md`, `blocks.md`) and binaries, and the review's upstream
  steps depend on those transcriptions. The sweep's seed ladder starts at "a fine content
  block", which is a preprocessing product. The stager fetches each block's `bounding_box`
  (`runbooks/lib/submission_db.py:280`) but **never writes it to disk**, so neither runbook
  can seed from a block box today.
- **Display** needs `sheet_version` rows with a `thumbnail_storage_path`. Those come from
  cityhall's own upload processor (pdftoppm), not from bureau preprocessing. Publish checks
  nothing against preprocessing tables.

### 1.3 Does the UI need a different review-comment output JSON schema?

**Yes. The review is stamped and routed differently, and the comment JSON carries two extra fields.**

| | Review runbook (lane A) | Completeness check (lane B) |
|---|---|---|
| `reviews.output_schema` | `2026-09-annotated`, stamped automatically when any comment carries either field (`publish_review.py:382-412`) | `2026-03-completeness-check`, from `reviewType` |
| Writer | SECURITY DEFINER RPC `import_annotated_review` (cityhall `supabase/schemas/public/functions/import_annotated_review.sql`) in one transaction | PostgREST inserts in `publish_review_cli.py:265-368`: review row, all comments, then flip current |
| `reviews.output_json` | `{sections, sheet_map, …}` | the whole `reviewData` (`{metadata, sections}`); **no `sheet_map`** |
| Comment `output_json` | flat August comment, plus **`annotations[]`** and **`annotation_disposition`** | `{…CC comment, section}`, with `sheetReferences[{documentId, sheetNumber, blockNumber?, blockName?, label}]` |
| Sheet key | staged-ordinal **label** (`"03"`) → `sheet_map` | integer `sheetNumber` (the plan set's own number) |
| Columns `sheet_references` / `source_findings` | filled by the caller | left at `'[]'` |
| Geometry validation | `_resolve_annotations` drops or blunts bad shapes, and caps at 20 per comment and 1,000 per review (`publish_review.py:816-940`, `review_annotation_geometry.py`) | none |
| App adapter | `adaptAugust`, which reads `annotations` on **presence** (`august.ts:393-427`) | `adaptCompletenessCheck`, which **hardcodes `annotations: []`, `planMarkup: []`** (`adapters/checklist.ts:287-288`) and `markerCount: 0, hasAnnotations: false` (`:221-222`) |

These are the stored fields of one annotation, in the order publish stores them
(`_STORED_ANNOTATION_FIELDS`): `sheet, kind (point|polygon), points[{x,y}] (0–1, 1 or
3–12), label, source ("ai"), source_finding_ref, evidence (12–500 chars), sheet_sha256,
converged, passes (1–3)`. A disposition looks like this:
`{status, reason, sheets:[{sheet, status: annotated|nothing-to-mark|not-located, reason}]}`.
The app reads `kind, points, sheet, label, evidence` and the disposition. It never reads
`source` or `converged`.

In prod, the example review has 216 comments. 134 are `annotated`, carrying 290 markers,
and 82 are `nothing-to-mark`. Every marker is inside `output_json`. Nothing about them is
stored anywhere else.

> **No annotation table exists.** A `comment_annotation` table (with a `sheet_version_id`
> FK) and a `review_comments.annotation_disposition` column were designed on substation's
> `feat/comment-annotations` branch. They were abandoned before shipping, in substation
> `2f89f4d5` ("no table, no column... stored inside `output_json`"). No migration creating
> them is reachable on main.

**CC already gets one thing.** For any comment with no markers, the app draws **outlines of
the content blocks the comment cites**, only while that item is open. It takes them from
`sheetReferences[].blockNumber` and `content_block.bounding_box`
(`src/lib/reviews/placed-markers.ts:63-90`, `sheets/read.ts:73-100`). Today a CC item that
cites `Sheet 10 · block 5 (Parking Table)` already shows that box. Once a comment has
markers, `citedBlockMarkersOn` skips it, so markings would replace the outlines rather than
pile on top of them.

### 1.4 Are markings produced in the same step that writes the findings?

**No. They come from a separate step family, `3.13-annotate`, that runs on the *final* record.**

```
… 3.5-comments → 3.6-assemble → … → 3.11-final ─┬─ 3.12-deliver (human gate; revise loops to 3.11)
                                                 └─ 3.13-annotate/sweep  (judgment, foreach discipline)
                                                       → 3.13-annotate/merge (script)
                                                             → 4.1-publish (needs 3.12 + 3.13/merge)
```

- **`sweep`** has one opus-5.5/high worker per discipline slug. Its inputs are `3.11-final`
  (read only), `3.3-plan-set` (`sheet-index.json`, printed label → ordinal) and
  `1.2-stage-submission` (the PDFs). For each comment and each sheet in the comment's
  `sheets[]`, the worker seeds, then runs crop → read → answer → remap (deterministic math)
  for up to 3 passes. It writes one sidecar per marker (`annotate-write.ts`) and one per
  (comment, sheet) swept (`annotate-disposition-write.ts`). The writers use `O_EXCL`, so
  workers that share the output folder never collide.
- **`merge`** is a script. It copies `3.11-final/comments.json` and folds every sidecar in,
  all or nothing (`annotate-merge.ts`). Then it gates on coverage: every comment needs a
  disposition (`annotate-disposition-check.ts`).
- **`4.1-publish`** runs `annotate_stale_check.py`, which refuses a merge older than a
  revised 3.11, then publishes `3.13-annotate/merge/comments.json`.

The step's own comment gives the reason it is separate: 3.11-final rewrites the record
wholesale and is what the 3.12 revise loop closes on, so a marker placed upstream "is a
marker an authoring pass can drop without noticing" (`3.13-annotate/steps/sweep/step.yaml`, header comment).
The sidecars exist because eight workers writing one shared document lost 47 of 240
annotations over 30 trials, while the sidecars lost none.

The sweep's central rule is **"A skip is a correct outcome."** An absence (something not
drawn) is not marked, because a wrongly placed marker is worse than none.

### 1.5 Where the completeness check stands

| | Review runbook | CC runbook |
|---|---|---|
| Finding → comment | agent-authored (3.5 → 3.11) | deterministic (`2.7-enrich` → `2.9-comments`, `build-review-comments.ts`) |
| Location data per comment | `sheets[]` (staged ordinals) | `sheetReferences[]` = the agent's `evidenceLocations`, with `blockNumber` validated by the block-number gate. **For a fail this is "where you expected to find it"** (CC review prompt `:225`) |
| How agents see drawings | natively (Read the PNG crops) | **only through the vision CLI**. Direct image or PDF reads are forbidden for parity (prompt `:44`) and counted as `binary_reads` by `2.11-tool-usage` |
| Revision after the final record | 3.12 revise loop | none. `2.9-comments` is final, and `3.1-publish` has no gate (D9) |
| Model presets | judgment = opus-5.5 high | sonnet-5.5, effort unset (parity) |

In prod, CC review `b80e5075` (2008 San Antonio, 2026-10-06) has 192 comments and 32
fail/warn. **28** of those cite a sheet and **26** cite a block. Most are absences: "no
spacing dimensions", "no TW/BW elevations", "no seal". A minority point at something drawn
but deficient, such as an incomplete Meter Notice table, a title missing its street
number, or an empty registration box.

That review ran **3 times per guide**. At the run level, 96 run-findings are fail/warn, and
84 of them cite a sheet. They spread over 36 comments, and 4 of those comments are not
fail/warn at the comment level: one run failed and was outvoted. Each run-finding carries
its own `run`, `status`, `comment`, `observation`, `reasoning` and `sheetReferences` inside
`sourceFindings[0].perRunFindings[]`. The comment's own text is the *winning* run's. That
run is the earliest whose status matches the displayed verdict
(`cross-run-consolidate-cc.ts:333-338`), and the envelope keeps the run order, so it can be
recomputed.

---

## 2. Goals

1. A CC comment can carry markings that render in the app's sheets view, in the same shape
   and under the same validation rules as the review runbook's.
2. Reuse the review's annotate machinery (scripts, validation constants, prompt rules) and
   do not fork it.
3. Keep the parity port intact. A run with the feature off produces byte-identical output
   to today.
4. Close the generic gaps that both runbooks share (block boxes on disk, one sheet-key
   rule) in shared code.

**Non-goals:** marking supplementary documents (Q4 in §6), multiple plan sets per
submission (Q5), human-authored markings, and a dedicated annotation table.

---

## 3. Proposal

### 3.1 Decisions

**D1. A separate step after the final record, as in the review.** Add a new family,
`2.12-annotate/{sweep, merge}`, after `2.9-comments`. `2.10-validate` and `3.1-publish`
then read `2.12-annotate/merge/review-comments.json` instead of 2.9's. CC has no revise
loop, so the step can sit directly before validate, and no stale check is needed. The
fold-into-a-copy and sidecar rules from §1.4 carry over unchanged. **The step never
adjudicates.** It reads each run's own claim and adds geometry for it. It changes no
status, no vote, no comment text and no `sheetReferences`. The merge's only writes are the
two annotation fields (D12).

**D2. Mark only what is drawn: the review's rule, unchanged.** A CC fail that is an
absence gets `nothing-to-mark`. "Where it should be" is already shown by the app's cited
block outlines (§1.3), and those keep working for every unmarked comment. The marking adds
value where the deficiency *is* a drawn thing: an incomplete table, a wrong title, an empty
seal box, a dimension that is drawn but wrong. Q1 asks Will to confirm, because this means
most CC fails stay unmarked.

**D3. Sweep every failing run, not only the winning one.** The unit of work is a
*(comment, run)*: a `perRunFindings[k]` entry in `2.9-comments/review-comments.json` whose
**own** `status` is `fail` or `warn`, **and** whose own `sheetReferences` cite at least one
plan sheet. The comment's consolidated status does not matter. A comment that passed 2–1
still has its failing run swept, and a fail that one run voted pass has only its two failing
runs swept. Each run is located against **that run's** `comment` / `observation` and
**that run's** cited sheets and blocks, so runs that disagree about where the problem is get
marked independently (Q7). Everything else gets a disposition that the merge writes
deterministically:
- a run that passed or was not applicable: `nothing-to-mark` ("run passed" / "not applicable");
- a fail/warn run that cites no sheet: sheetless `nothing-to-mark` ("cites no sheet");
- a comment with no fail/warn run: a comment-level sheetless `nothing-to-mark`.

That keeps the coverage gate total. Workers run **one per guide** (`grouping`), the CC
equivalent of the review's per-discipline roster, and each worker handles every
(item, run) pair in its guide. A guide with no fail/warn run drops out. On `b80e5075` that
is 84 run-findings citing a sheet, over about 10 workers. At `runs = 1`, the common case,
there is one run per comment, and this reduces to the comment-level sweep.

**D4. Seed from the cited block box, which is a better rung 1 than the review has.** The
stager writes `bounding_box` per block into `block-manifest.json` (`blockBoxes: {"5":
{x,y,width,height}}`). That is one shared change in `stage_submission.py`, and the review
sweep gains the same rung. A CC comment's cited `blockNumber` becomes a `box` seed, and the
loop proceeds as in the review: crop → read → answer → remap, up to 3 passes. Without a
block, the seed falls back to the review's ladder (drawing block → whole sheet in
quadrants).

**D5. Lift the annotate kit into shared code, parameterised by a record adapter.** Move
`annotate-{crop,remap,seam-check,write,disposition-write,merge,disposition-check}.ts` and
`lib/annotate-*` from `runbooks/review/scripts/` to `runbooks/lib/annotate/`, and add a
`--record review|cc` adapter. The adapter answers three questions:

- how to find a comment by ref (review: `comments[].id`; CC:
  `sections[].comments[].sourceFindings[0].ref` = `grouping:itemId`, plus `--run run-k`
  naming the `perRunFindings` entry; the sidecar name carries both);
- which sheets it may name (review: `sheets[]`; CC: **that run's**
  `sheetReferences[].sheetNumber`, rendered as the zero-padded staged ordinal);
- what `source_finding_ref` must match (review: `sources[]`; CC: the comment's own
  checklist ref).

The review keeps calling the same scripts through the moved paths. Its tests move with the
code.

**D6. The sheet key is the staged ordinal label, the same as the review.** `annotation.sheet
= "07"`. For a single-plan-set submission, the CC `sheetNumber` and the staged folder
`sheet-NN` are the same number (`workspace.sheet_dirname`). Publish adds `sheet_map` to
`reviewData`, built from the staged manifest by the same `read_staged` that lane A uses, so
the app resolves CC markings exactly as it resolves review markings.

**D7. Lane B validates and carries the fields, and keeps the CC label.**
`build_section_shape_rows` passes `annotations` / `annotation_disposition` through. It
already spreads `{**comment}`, so the fields would travel today, unvalidated. Before the
insert, it runs them through the same `_resolve_annotations` / `_reconcile_disposition`
that lane A uses (drop/blunt, caps, reconcile an all-dropped `annotated` sheet to
`not-located`) and fails loudly on an unresolvable sheet label. `output_schema` **stays
`2026-03-completeness-check`**. That label selects the checklist landing and the CC adapter,
and it is pinned in five places (conductor `review-saver.ts`, cityhall
`section-shape-schemas.ts`, IG `audit-scores`, …). Switching CC to `2026-09-annotated` would
route it into the August renderer and lose the checklist view. The new fields are additive
and optional in the CC shape, and the app reads them on presence, as August does. No SQL
change, no new RPC.

**D8. cityhall: the CC adapter reads markings.** Export `readAnnotations` /
`readPlanMarkup` from `adapters/august.ts` into a shared `adapters/annotations.ts`. Call
them from `checklist.ts` `statusComment`, keyed by `reviewJson.sheet_map`, and set
`markerCount` / `hasAnnotations` from the result. CRC shares `statusComment` and
automatically gains the ability to render markings if it ever carries them. Nothing else
in the sheets view changes: `markersOn` already draws any comment's `annotations`, and
`citedBlockMarkersOn` already steps aside once a comment has markers.
The approved [checklist-source-ui spec](../checklist-source-ui/DESIGN-SPEC.md) (D22, winston
#297/#298) edits the same `statusComment` to add a Source link. The two changes are
independent fields on the same view model, so whichever lands second rebases onto the other.

**D9. Opt-in by request flag, off by default until scored.** Add `annotate: boolean`
(default `false`) to the CC `Request`. Off means a `2.12-annotate` folder holding only
`SKIPPED.md`, and 2.10/3.1 read 2.9's envelope, which is byte-identical to today (parity,
goal 3). Default it on after a marking-quality pass on the WhiteWater and 2008 San Antonio
hard-item sets (`cc-hard-items`).

**D10. The annotate worker sees pixels natively and is exempt from the parity rule.** The
"vision CLI only" rule (CC prompt `:44`) protects the parity of the *verdict*. The sweep
renders no verdicts and changes no comment text, so it reads crops natively, as the
review's sweep does. `2.11-tool-usage` counts `binary_reads` for `2.1`/`2.5`/`2.8` only.
`2.12` is added to the runbook's `persist.logs` and to the tool-usage report as its own
section, so that its spend is visible.

**D11. A new `annotate` runner preset: opus-5.5, effort high.** This matches the review's
proven sweep (`judgment`). The CC sonnet presets are parity choices for the verdict steps
and do not bind a new step. Q3 covers trying sonnet for cost.

**D12. Per-run markers live on the run; the comment shows the winning run's.** The merge
writes `annotations` / `annotation_disposition` onto each swept
`sourceFindings[0].perRunFindings[k]`, the record of that run. It then copies the
**winning run's** two fields up to the comment's own `annotations` /
`annotation_disposition`. The winning run is the earliest run whose status equals the
displayed verdict (`tentativeStatus` when uncertain, else `status`), recomputed exactly as
`cross-run-consolidate-cc.ts:333-338` picks it. If the comment's status is not fail/warn
(the 4 outvoted comments on `b80e5075`), the comment-level fields hold a sheetless
`nothing-to-mark` ("the comment passed; see the runs"), while the failing runs keep their
markers. A forced item shows the markers of the earliest run whose organic status matches
the forced one, or none. The reason for this split: the app draws a comment's
`annotations`, and the reader is reading the winning run's words. Markers from runs whose
text the reader never sees would point at problems the comment does not describe. All runs'
markers stay in the stored record for IG and audit (`sourceFindings` is already the per-run
trace the app shows under Votes). The annotation object's shape is unchanged, with no `run`
field, because the run is implied by where the object sits.

### 3.2 What changes, by repo

| Repo | Change |
|---|---|
| bureau `runbooks/lib/annotate/` | annotate scripts + libs moved from `review/scripts/`; `--record review\|cc` adapter (D5) |
| bureau `runbooks/lib/stage_submission.py` | `blockBoxes` per sheet in `block-manifest.json` (D4) |
| bureau `runbooks/review/` | step yamls and prompt point at the moved scripts; sweep prompt gains the block-box rung (D4) |
| bureau `runbooks/completeness-check/` | `2.12-annotate/{sweep,merge}` (prompt adapted from the review's, plus D2/D3 roster rules); `annotate` preset; `annotate` request flag; 2.10/3.1 read the merge output when present; 2.11 reports 2.12 |
| bureau `runbooks/lib/publish_review.py` | lane B: validate and reconcile markings, write `sheet_map` into `reviewData` (D6, D7) |
| cityhall `src/lib/reviews/adapters/` | shared `annotations.ts`; `checklist.ts` reads markings and sets counts (D8) |

### 3.3 Phases

- **P1 Shared kit.** Do D5 and D4 in bureau. The review runbook's examples and tests pass
  unchanged, except for the extra seed rung. This phase has no CC behaviour change.
- **P2 CC step.** `2.12-annotate` behind `annotate: false` (D1–D3, D9–D11). Contract tests:
  every roster comment has a disposition for every sheet it cites; markers validate.
- **P3 Publish + app.** Lane B validation and `sheet_map` (D6, D7), then cityhall D8. Land
  the app change first: until it ships, a published CC review stores markings that nothing
  draws, which is harmless.
- **P4 Score and default on.** Run `annotate: true` on the two hard-item submissions, audit
  the markers visually in the app, and flip the default (D9).

---

### 3.4 Database changes, walked through

No table, column, RPC or migration changes. Everything below lives inside two JSONB values
that lane B already writes. The only new key on a review is `sheet_map`, and the only new
keys on a comment are the two annotation fields, at two levels.

| Where | What is added | Why |
|---|---|---|
| `reviews.output_json.sheet_map` | `{"01": 1, "02": 2, …}`, one entry per staged sheet folder, built by `read_staged` exactly as lane A builds it | The app turns a marker's `sheet` label into the sheet it draws on **only** through this map (`august.ts:281-291`). The CC review has no map today, so a CC marker would resolve to `null` and never be drawn. Lane B also uses it to refuse an unresolvable label before anything is written, the same fail-loud rule as lane A |
| `review_comments.output_json.annotations[]` | the **winning run's** markers (0–20), each one `{sheet, kind, points, label, source, source_finding_ref, evidence, sheet_sha256, converged, passes}` | what the sheets view draws |
| `review_comments.output_json.annotation_disposition` | the winning run's sweep outcome: `{status, reason, sheets:[{sheet, status, reason}]}` | see below |
| `review_comments.output_json.sourceFindings[0].perRunFindings[k].annotations[]` / `.annotation_disposition` | the same two fields for **every** run that was considered (D12) | all runs' geometry is kept, for audit, IG and a later per-run view |
| `reviews.output_json.sections[].comments[]` | the same fields again | lane B stores the whole `reviewData` blob on the review row as well as one row per comment, so every comment field appears twice. That is already true of every CC field today. It costs about 1 KB per marker, and markers are capped at 1,000 per review |

**Why two fields, `annotations` and `annotation_disposition`.** They answer different
questions, and the first cannot answer the second's.

- `annotations[]` holds **what was placed**: geometry, one object per marker, each on one sheet.
- `annotation_disposition` holds **what the sweep concluded for every sheet it opened**,
  including the sheets where nothing was placed and why. Its statuses are `annotated`,
  `nothing-to-mark` with a reason ("the deficiency is an absence: no spacing dimensions are
  drawn") and `not-located` with a reason. It also holds one rolled-up status for the comment.

An empty `annotations` is ambiguous on its own: never swept, swept and correctly nothing
there, or swept and failed to find it. Under D2 the "nothing there" case is the majority for
CC. The disposition is what lets the app say "nothing to mark: absence" or "not found" per
sheet instead of silently drawing nothing (`readPlanMarkup`, `august.ts:442-484`). It is
also what the merge's coverage gate checks, so an unswept comment is a failure, not a
silent blank. Storage is presence-based: a missing disposition means *never swept*. This
is the review's shape, unchanged, so one reader serves both.

**Why `blockBoxes`, and why it is not a DB change.** `block-manifest.json` is a file the
stager writes into the run folder (`1.2-stage-submission/`), not a table. The boxes already
exist in the DB: `content_block.bounding_box`, normalised 0–1, present on all 522 blocks of
2008 San Antonio. The stager already selects them (`submission_db.py:280`) and drops them.
Writing them into the manifest gives the sweep worker a starting crop. A CC run-finding
names the block it read (`blockNumber`, 76 of the 84 sheet-citing run-findings above), so
the worker can crop straight to that block instead of scanning the whole sheet in four
quadrants first. That means fewer passes, less seat spend, and a marker anchored to the
block the run actually cited. Workers read only staged files, never the DB, so the box has
to be on disk to be usable. It is an **optimisation, not a requirement**: without it, the
sweep falls back to the review's seed ladder and still works. It can be dropped from P1 if
we want the smallest change.

## 4. Rejected alternatives

- **Promote cited block boxes to markings deterministically, with no agent.** This would be
  cheap, but the app already draws those boxes as outlines (§1.3). It would also
  mis-assert a defect location for absences, which is the opposite of the review's skip
  rule.
- **Have `2.1-review` emit markings alongside findings.** The review cells are sonnet,
  forbidden from reading pixels, and run N times per guide before a vote. A marking from a
  losing run would attach to the winning verdict. It would also break parity.
- **Publish CC under `2026-09-annotated`.** That routes CC into the August renderer and
  loses the checklist landing (D7).
- **A dedicated annotation table.** It was designed once and abandoned (§1.3).
  `output_json` is the shipped contract for both lanes.

---

## 5. Risks

- **Few CC fails are markable.** If most fails are absences, the feature lands on a
  minority of items. P4 measures the real rate. On `b80e5075`, roughly 6–10 of the 28
  sheet-citing fails/warns look like drawn-but-deficient items, but that is a manual read.
- **Seat spend.** The sweep is the most expensive kind of step: opus with pixel reads. Per-run
  sweeping (D3) triples the work at `runs = 3` (84 run-findings against 28 comments on
  `b80e5075`), and runs that agree will often be marked on the same spot. D3's
  filter bounds it to the fail/warn items that cite a sheet.
- **Constants pinned on one side only.** The geometry limits (`review_annotation_geometry.py`)
  were "pinned with substation". Substation is archived, and cityhall carries none of them,
  so bureau is now the only enforcer. That is fine, but the docstrings should say so.

---

## 6. Open questions

**Q1.** Confirm D2: absences stay unmarked (the existing cited-block outline is the "where
it should be" cue). The alternative is a second marker kind such as `expected-here`, which
would need a new `kind` and app styling.

**Q2.** Roster grain for the sweep: one worker per guide (D3), or one worker for the whole
CC run? At `runs = 3` that is about 84 run-findings (D3, v1.1), which favours per guide for
partial credit when a seat dies.

**Q3.** Model for `annotate`: opus-5.5 high (D11), or try sonnet-5.5 first given CC's cost
profile?

**Q4.** Supplementary documents (application forms, reports) are where many CC fails live.
Out of scope here, because the app has no viewer to draw on. Is a document viewer with
markings wanted later?

**Q5.** Multiple plan sets per submission. The stager names folders `sheet-NN` by each
plan set's own sheet number, so two sets collide. The app's sheets view reads only one plan
set. This is shared by both runbooks: fix it here, or leave it for a separate spec?

**Q6.** Default-on criterion for D9: what marker precision on the hard-item sets is good
enough? One proposal: no wrongly placed marker among 20 audited.

**Q7.** Runs that agree often cite the same block for the same deficiency. Should the sweep
mark each run independently (D3 as written: no cross-run influence, about 3× the passes),
or may a worker reuse a converged shape from a sibling run when that run cites the same
sheet and block and its evidence text still reads true? Reuse is cheaper, but it makes the
runs' markers no longer independent observations.
