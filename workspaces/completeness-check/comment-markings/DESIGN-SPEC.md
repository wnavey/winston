# Comment markings for the completeness-check runbook

**Status:** Draft v3
**Date:** 2026-10-08
**Repos touched (proposed):** `bureau` (shared annotate kit lifted out of `runbooks/review/scripts/`; a new `2.12-annotate` step family in `runbooks/completeness-check/`; the stager writes block boxes; lane B of `publish_review.py` validates and stamps markings), `cityhall` (the CC adapter reads `annotations` / `annotation_disposition` the way the August adapter does; v2: the pdf.js document viewer draws markings on a page)
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

> **Revision note (v3, 2026-10-08, grill with Will): decisions folded one at a time.**
> Grill decisions are numbered G1, G2, … The spec's own Q numbers keep their meaning. G1 is
> Q1. G2 and G3 are new questions; Q2 (roster grain) and Q3 (model) are still open.
>
> - **G1 = Q1 answered: absences get a marker when they have a slot (reverses v2's D2).** A new
>   marking type, `missing` (named `expected-here` before G5), outlines the specific empty place where a required thing
>   should be: a blank form field, a Yes/No pair with neither box checked, an empty table
>   cell. The agent decides when to use it. There is no rule by sheet or document type. The
>   guards are that the slot is visible, the marker is narrower than the citation, and an
>   absence with no slot (a missing report) stays `nothing-to-mark`. D2 is rewritten. D8,
>   D13 and D19 gain the marking type. §3.4, §4 and §5 are updated. The motivating case is CC review
>   `d36b7aad`: a "required fields" fail that cites whole application sections, where the
>   reader needs the 2 blank questions, not every field outlined.
> - **Fact added to §1.4: who supplies what.** The agent supplies every vertex. The scripts
>   derive `converged`, `passes` and the fingerprint, but `annotate-write.ts` takes the final
>   points as retyped `--points` without checking them against `remap-result.json`. New
>   architecture tab, *Agent and scripts*, walks the sweep prompt fragment by fragment.
> - **G2: documents ship with plan sheets.** v2's P5 (document targets in the
>   producer) folds into P2, and P6 (the pdf.js page overlay) folds into P3. One
>   `2.12-annotate` sweep marks sheets and document pages in the same pass, and P4 scores
>   both before the default flips. P5 and P6 no longer exist. §3.3 and §7.4 are rewritten.
> - **G3: share the geometry, not the policy (D5 rewritten).** Shared code is the geometry half
>   plus the annotation object's shape. The loop mechanics are shared as prompt text carried
>   verbatim (the `block-name-rule.md` pattern). What to mark, the roster, the record's field
>   names, the writers' record checks and the merge stay per runbook. Each runbook's writer
>   decides which marking types it allows, and CC's record checks fail closed. Q12 is new.
> - **G4: every fail/warn run is swept, reaffirmed (D3).** `runs = 3` is now every current CC
>   review (7 of 7 since 2026-10-01), so the sweep is about 3× the drawn comments (59–135
>   runs per review). Will keeps it: each failing run's geometry will be viewable later in
>   the app or IG, which this spec does not build. The stale "runs = 1 is the common case"
>   line is corrected.
> - **G5: `role` is renamed `marking_type`, values `incorrect` and `missing`, and colours
>   differ.** In JSON it is `marking_type`, and on the writer it is `--marking-type`. Absent
>   means `incorrect`. The app draws `incorrect` red (as today) and `missing` highlighter
>   yellow, and selection stays blue for both. This amends cityhall's written rule that
>   colour means selection only (`sheet-markers.tsx:47`). The immediate use is the colour;
>   separate P4 scoring is a side benefit. D2 and D8 are updated, and G1's text now uses the
>   new names.
>
> **Revision note (v2, 2026-10-07): markings on non-plan-set documents.** Will asked for
> markings on supplementary documents too (application forms, letters, reports), now that
> cityhall#293 opens a cited document beside the CC item. New **§7** (D13–D21, P5–P6,
> Q8–Q11) brings them into scope. Q4 is answered (yes, in scope) and the non-goal is
> removed. The answer to "do documents need `content_block`s, and therefore a
> preprocessing-v4 change?" is **no** (D14). A marking is located from pixels of a rendered
> page. The section `page_range`s already published, together with each run's own label,
> find the page. Section boxes stay an optional later improvement (Q9).
>
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

**Who supplies what (verified v3, bureau `0cb97661`).** Every vertex comes from the agent's
read of a crop: `correction.json`, a point or polygon in crop-local 0–1000. The scripts
render the crop (`annotate-crop.ts`), map the answer back onto the sheet and judge
convergence (`annotate-remap.ts`), and derive `converged`, `passes` and `sheet_sha256` at
write time, so the agent cannot type those. **One value is still retyped.**
`annotate-write.ts` takes the final 0–1 points from the agent as `--points` and never
compares them with the `unit` points that `annotate-remap.ts` already wrote to
`remap-result.json` in the same pass directory (`annotate-remap.ts:125-134`,
`annotate-write.ts:134-150`). A typo, or a copy from the wrong pass, is stored as a valid
marker beside a fingerprint and a `converged` that describe another shape. Separately,
`resolveTarget` (`lib/annotate-validate.ts:302-326`) checks a marker's sheet against the
comment's `sheets[]` and its source against `sources[]` **only when the comment has those
fields**. The architecture page's *Agent and scripts* tab goes through every prompt
fragment, what the agent supplies to each script, and what each script derives.

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

**Non-goals:** marking non-visual documents (drainage models, spreadsheets), multiple plan sets per
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

**D2. Mark what is drawn, and mark an absence when it has a slot (v3; reverses v2's
"mark only what is drawn").** A marker has one of two marking types, stored as
`marking_type`:

- **`incorrect`** (the default, and the only kind the review runbook draws today): the shape
  outlines a drawn thing that is wrong or incomplete, such as an incomplete table, a wrong title, or a dimension
  that is drawn but wrong.
- **`missing`**: the shape outlines **the specific empty place where a required thing
  should be and is not**, such as a blank form field, a Yes/No pair with neither box
  checked, an empty table cell or missing total, or an empty seal or signature box.

**The agent decides which marking type applies. No sheet or document type is excluded.** A plan
sheet's parking table with the total-spaces cell left blank gets an `missing` marker,
the same as a blank field on the application form. The prompt gives the guards, not a list
of places:

1. **The slot must be visible.** The marker outlines something on the page, such as the
   field label and its blank line, the empty checkboxes, or the empty cell under its column
   header. Its `evidence` quotes what is read there, for example `Small Project? ☐ Yes
   ☐ No (neither checked)`.
2. **It must be narrower than the citation.** Draw one marker per missing slot. Never
   outline a whole cited block, section or page. If the honest marker would cover the whole
   cited region, skip it, because the app's cited-block outline already says that.
3. **No slot, no marker.** Something missing from the submission altogether ("no building
   elevations", "no tax certificate attached", "no TIA compliance memo") has nowhere on the
   page to point. It stays `nothing-to-mark` with the reason "absence with no slot on the
   page".
4. **The precision rule is unchanged.** A wrongly placed marker is worse than none, for
   either marking type.

*Worked example.* CC review `d36b7aad` (submission `38ddbfd8`, 2026-10-06), item "All
required fields in CC Application Sections 1–11 are complete", is a fail: "Section 1 Small
Project question and Section 9 Restrictive Covenant question have neither Yes nor No
checked." The citation is whole sections, so today the viewer outlines every field across
the application's pages (about 50). Under D2 the comment gets exactly two `missing`
markers, one on each unchecked Yes/No pair. Once a comment has markers, the cited outlines
step aside (`citedBlockMarkersOn`, §1.3), so the reader sees only the two.

*Stored shape.* The annotation gains an optional `marking_type`, whose only written value is
`"missing"`. An absent `marking_type` means `incorrect`, so every marker the review runbook has
already stored reads unchanged. The disposition is unchanged: a sheet or page holding only
`missing` markers is `annotated`. Both lanes' field whitelists
(`_STORED_ANNOTATION_FIELDS`) and `annotate-validate.ts` gain `marking_type`, because the kit is
shared (D5). The review runbook's sweep prompt is not changed. Whether the formal review
marks absences is that runbook's own call, as in D21.

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
is 84 run-findings citing a sheet, over about 10 workers. At `runs = 1` there is one run per
comment, and this reduces to the comment-level sweep.

**v3 (grill G4, Will, 2026-10-08): reaffirmed, every fail/warn run, at its full cost.**
`runs = 3` is now the norm, not the exception. All 7 CC reviews in prod since 2026-10-01
that were not legacy comparisons ran 3 times per guide. On those, D3's roster is about 3×
the comments the app draws:

| Review | Comment-level fail/warn (drawn, D12) | Fail/warn runs (swept, D3) |
|---|---|---|
| `d36b7aad` | 45 | 130 |
| `75a6449c` | 46 | 135 |
| `53d79f08` | 42 | 132 |
| `91e224bd` | 30 | 97 |
| `b80e5075` | 32 | 96 |
| `76570a10` | 30 | 93 |
| `581a6549` | 21 | 59 |

These counts are before D3's "cites a sheet or document" filter. The cost is accepted. Every
failing run's geometry is a product requirement: a later view, in the app or in Inspector
General, will show each failing run's markers. That view is out of scope here. D12's per-run
storage is what makes it possible without a schema change. A winning-run-only sweep, with
`all` as an opt-in, was offered and rejected.

**D4. Seed from the cited block box, which is a better rung 1 than the review has.** The
stager writes `bounding_box` per block into `block-manifest.json` (`blockBoxes: {"5":
{x,y,width,height}}`). That is one shared change in `stage_submission.py`, and the review
sweep gains the same rung. A CC comment's cited `blockNumber` becomes a `box` seed, and the
loop proceeds as in the review: crop → read → answer → remap, up to 3 passes. Without a
block, the seed falls back to the review's ladder (drawing block → whole sheet in
quadrants).

**D5. Share the geometry and the loop mechanics; keep policy and record handling per
runbook (v3, grill G3).** The annotate scripts fall into two halves (§1.4, architecture tab
03), and only one of them is shared code:

| Bucket | What | Where it lives |
|---|---|---|
| **Geometry code** | `annotate-crop` (crop window, padding, pixel cap, rotation, `--page`, overlay, sha256), `annotate-remap` (crop → sheet → 0–1, rotation, shape-delta convergence), `annotate-seam-check`, `lib/annotate-refine`, `lib/annotate_draw.py`, the geometry contract (`annotate-validate.ts` geometry checks + its Python twin `review_annotation_geometry.py`), the `O_EXCL` sidecar writer, and **the annotation object's shape** | **Shared**, moved to `runbooks/lib/annotate/`. None of it knows what a comment is. |
| **Loop mechanics** (prompt text) | how to drive those scripts: tile with both pad flags, "an `OK` is not proof", pass a polygon on as a polygon, `pass-<k>` is load-bearing, evidence/label/reason go in files | **Shared as text**: `runbooks/lib/annotate/loop-rules.md`, carried verbatim in both sweep prompts and enforced by a test, the pattern `runbooks/lib/block-name-rule.md` already uses (`block-name.test.ts:78`) |
| **Policy and record** | what to mark (the review skips absences; CC marks `missing`, D2), the roster (per discipline vs per guide run), finding a comment or run by ref, which sheets / documents / sources a marker may name, the envelope's field names, the merge, the winning-run copy (D12), the coverage gate | **Per runbook.** The review keeps its own writers and merge under `runbooks/review/scripts/`. CC gets its own under `runbooks/completeness-check/scripts/`, built on the shared writer and validator. |

The annotation object is in the shared bucket, not the per-runbook one: the comment
envelope differs between the lanes, but the marker inside it keeps one set of field names,
because cityhall has one reader for it and publish has one geometry check (D7, D8).

**Each runbook's writer decides which marking types it allows.** The shared validator
accepts `marking_type`; the review's writer refuses `missing`, so a review worker cannot drift into
marking absences whatever its prompt says. CC's writer accepts both.

**CC's record checks fail closed.** The review's `resolveTarget` checks a sheet against
`sheets[]` and a source against `sources[]` only when the comment carries those fields
(§1.4). A CC comment carries neither, so CC's writer resolves `sourceFindings[0].ref` plus
`--run run-k` and checks the marker against **that run's** `sheetReferences[].sheetNumber`
(as the zero-padded staged ordinal), `documentReferences` and the checklist ref, and
refuses anything it cannot check.

The review's own scripts change only their import paths, and its tests move with the code.
Rejected: **one kit behind a `--record review|cc` switch** (v2's D5). The per-run storage
and winning-run copy exist only for CC, so the switch would mostly add CC branches inside
the review's 450-line all-or-nothing merge. Also rejected: **no move**, with CC calling
`runbooks/review/scripts/` in place, which ties one runbook's step files to another's
folder.

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
**v3 (G5): colour by marking type.** Unselected, an `incorrect` marker draws **red**, as
every marker does today, and a `missing` marker draws **highlighter yellow**. A selected
marker draws **blue** whatever its type, as today. The marker row and tooltip say "missing"
or "incorrect". A marker with no `marking_type` draws as `incorrect`. This amends a written
rule in `src/components/reviews/sheet-markers.tsx:47`: *"COLOR MEANS SELECTION AND NOTHING
ELSE. Markers are never colored by discipline or by severity."* The rule's reason, that
colour should say what the drawing cannot, holds for this change: whether something is wrong
or missing cannot be seen from the shape. The P3 cityhall PR rewrites that comment to say
colour means selection or marking type.
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
| bureau `runbooks/lib/annotate/` | the geometry half moved from `review/scripts/` (crop, remap, seam-check, refine, draw, geometry validator, sidecar writer) and `loop-rules.md` (D5) |
| bureau `runbooks/completeness-check/scripts/` | CC's own annotate writers, merge and coverage gate on the shared kit; record checks fail closed (D5) |
| bureau `runbooks/lib/stage_submission.py` | `blockBoxes` per sheet in `block-manifest.json` (D4) |
| bureau `runbooks/review/` | step yamls and prompt point at the moved scripts; sweep prompt gains the block-box rung (D4) |
| bureau `runbooks/completeness-check/` | `2.12-annotate/{sweep,merge}` (prompt adapted from the review's, plus D2/D3 roster rules); `annotate` preset; `annotate` request flag; 2.10/3.1 read the merge output when present; 2.11 reports 2.12 |
| bureau `runbooks/lib/publish_review.py` | lane B: validate and reconcile markings, write `sheet_map` into `reviewData` (D6, D7); `marking_type` joins `_STORED_ANNOTATION_FIELDS` for both lanes (D2) |
| cityhall `src/lib/reviews/adapters/` | shared `annotations.ts`; `checklist.ts` reads markings and sets counts (D8); `SheetMarkers` colours `missing` yellow and `incorrect` red, selection stays blue (D2, D8) |

### 3.3 Phases

- **P1 Shared kit.** Do D5's move of the geometry half and `loop-rules.md`, and D4, in bureau.
  The review's writers refuse `missing`. The review runbook's examples and tests pass
  unchanged, except for the extra seed rung and the moved imports. This phase has no CC behaviour change.
- **P2 CC step, sheets and documents together (v3).** `2.12-annotate` behind
  `annotate: false` (D1–D3, D9–D11), with document targets in the same sweep (D13, D15–D18):
  the stager's document fields (D17), the page-finding rules (D15), the non-PDF disposition
  (D16) and the document checks in the kit's validators (D18). Contract tests: every roster
  run has a disposition for every sheet **and document** it cites, and markers validate.
- **P3 Publish + app, both renderers (v3).** Lane B validation and `sheet_map` (D6, D7), plus
  the document checks (D18). Then cityhall: the CC adapter (D8) **and** the pdf.js page
  overlay with `&page=` (D19). Land the app change first: until it ships, a published CC
  review stores markings that nothing draws, which is harmless. The overlay edits the
  viewer that cityhall#293 shipped, so P3's cityhall PR waits until #293 is settled on main.
- **P4 Score and default on.** Run `annotate: true` on the two hard-item submissions, audit
  sheet and document markers visually in the app, and flip the default (D9). Score
  `incorrect` and `missing` separately (D2).

---

### 3.4 Database changes, walked through

No table, column, RPC or migration changes. Everything below lives inside two JSONB values
that lane B already writes. The only new key on a review is `sheet_map`, and the only new
keys on a comment are the two annotation fields, at two levels.

| Where | What is added | Why |
|---|---|---|
| `reviews.output_json.sheet_map` | `{"01": 1, "02": 2, …}`, one entry per staged sheet folder, built by `read_staged` exactly as lane A builds it | The app turns a marker's `sheet` label into the sheet it draws on **only** through this map (`august.ts:281-291`). The CC review has no map today, so a CC marker would resolve to `null` and never be drawn. Lane B also uses it to refuse an unresolvable label before anything is written, the same fail-loud rule as lane A |
| `review_comments.output_json.annotations[]` | the **winning run's** markers (0–20), each one `{sheet, kind, points, label, source, source_finding_ref, evidence, sheet_sha256, converged, passes}` plus an optional `marking_type: "missing"` (v3, D2) | what the sheets view draws |
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
  rule. v3's `missing` (D2) is the opposite of this: an agent picks the 2 empty slots
  out of about 50 cited fields, rather than promoting all 50.
- **Have `2.1-review` emit markings alongside findings.** The review cells are sonnet,
  forbidden from reading pixels, and run N times per guide before a vote. A marking from a
  losing run would attach to the winning verdict. It would also break parity.
- **Publish CC under `2026-09-annotated`.** That routes CC into the August renderer and
  loses the checklist landing (D7).
- **A dedicated annotation table.** It was designed once and abandoned (§1.3).
  `output_json` is the shipped contract for both lanes.

---

## 5. Risks

- **Few CC fails are markable (reduced in v3).** On `b80e5075`, roughly 6–10 of the 28
  sheet-citing fails/warns look like drawn-but-deficient items (a manual read). D2's
  `missing` marking type adds the absences that have a slot, such as blank fields and empty
  cells. Absences with no slot still stay unmarked. P4 measures the real rate per marking type.
- **A `missing` marker drifts into guessing.** Without a visible slot the agent could "place"
  a missing note where it thinks one belongs. Guards 1–3 of D2 forbid that. P4 audits
  `missing` markers separately from `incorrect` ones.
- **Seat spend.** The sweep is the most expensive kind of step: opus with pixel reads. Per-run
  sweeping (D3) triples the work at `runs = 3`, which is every current CC review (59–135
  fail/warn runs against 21–46 drawn comments, D3 table), and runs that agree will often be
  marked on the same spot. G1 (`missing`) and G2 (documents) widen the markable
  set further. D3's filter bounds it to fail/warn runs that cite a sheet or document. The
  cost is accepted (G4). Q7's shape reuse is the remaining lever.
- **Constants pinned on one side only.** The geometry limits (`review_annotation_geometry.py`)
  were "pinned with substation". Substation is archived, and cityhall carries none of them,
  so bureau is now the only enforcer. That is fine, but the docstrings should say so.

---

## 6. Open questions

**Q1.** ~~Confirm D2: absences stay unmarked?~~ **Answered in v3 (Will, 2026-10-08):** no.
Absences get an `missing` marker when they have a visible slot, and the agent decides
when, with no rule by sheet or document type (D2). The marker is stored as an optional
`marking_type` (`incorrect` or `missing`; G5 renamed it from `role` / `expected-here`), not a
new `kind`: `kind` stays the geometry (point or polygon).

**Q2.** Roster grain for the sweep: one worker per guide (D3), or one worker for the whole
CC run? At `runs = 3` that is about 84 run-findings (D3, v1.1), which favours per guide for
partial credit when a seat dies.

**Q3.** Model for `annotate`: opus-5.5 high (D11), or try sonnet-5.5 first given CC's cost
profile?

**Q4.** ~~Supplementary documents: out of scope?~~ **Answered in v2:** in scope, see §7.

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


**Q12 (v3).** The agent still moves numbers between files by hand twice. At step 8 (tab 03)
it copies `remap-result.json`'s sheet shape into the next `seed.json`, and the next overlay
at least shows that copy. At step 9 it copies the final 0–1 `unit` points into
`annotate-write --points`, which is never compared and never drawn (§1.4). Should the shared
kit take both over, with `annotate-crop --seed-from <prev pass dir>` and
`annotate-write --from-remap <pass dir>`, so that `correction.json` is the agent's only
numeric output? Proposed: yes, in P1, which fixes the review runbook too.
---

## 7. Markings on non-plan-set documents (v2)

### 7.1 What exists today (verified 2026-10-07, bureau `c911d675`, cityhall `df688dd`)

**About a third of failing runs cite a document.** Across the run-level fail/warns:

| Review | Fail/warn runs | sheets only | documents only | both |
|---|---|---|---|---|
| `b80e5075` (2008 San Antonio, 3 runs) | 96 | 66 | 12 | 18 |
| `581a6549` (2008 San Antonio, Will's example, 3 runs) | 59 | 40 | 9 | 10 |

A CC document citation is `{documentId, label}` and nothing else: no page, no section id
(emit schema, CC review prompt `:225`). The label is free prose that often names the place,
for example `Engineering Summary Letter - page 2 signature block`,
`CC Application Section 1 - Project Name`, or `Driveway Waiver Letter Exhibit 1 (spacing
shown only here)`. On `b80e5075`, a reading of the 30 document-citing fail/warn runs puts
about 21 of them on something **drawn or written on a page**: a blank form field, a
signature block with no seal, a project-name field, dimensions on an exhibit. About 6 are
absences ("no storm drain calculations") or point at a non-visual file (the HEC-HMS model),
and 3 are ambiguous. So documents are *more* markable than plan-sheet fails, where absences
dominate.

**The documents.** Supplementary documents are `document` + `document_version` rows. The
binary is a PDF at `document_version.storage_path` in the `submission-data` bucket (one
cited file on that submission is a `drainage-model`, which is not visual).
preprocessing-v4's document reader (`2.3-documents`) renders every page at 200 DPI to
scratch, reads it, and publishes only `document_section(title, description, content,
page_range text, sort_order)` (`publish_preprocessing_run.sql:230-240`). It publishes **no
boxes, no page count and no page images**. There is no `document_page` table and no
`page_count` column anywhere. On 2008 San Antonio the staged documents run 1–15 pages, with
two outliers: the Engineer's Report (582 pages) and the Phase I ESA (549 pages).

**The stager** writes `supplementary-docs/<slug>/source.pdf` (the submission's linked
version), `overview.md` (every section with its page range, e.g. `Section 4: Engineer
Information (3)`) and one `NN-<title>.md` per section (`stage_submission.py:969-1009`).
`download-manifest.json` records `document_id` and the sha256 for `source.pdf`, but neither
the `document_version_id` nor a page count.

**The producer can already render a page.** `annotate-crop.ts` takes `--page N` (`:60`).
It sizes the page with `pdfinfo -f N -l N` and renders it with `pdftoppm -f N -l N`
(`:97, :116`), with rotation handled. The rest of the loop (remap, write, merge) does not
care what the page belongs to. The preprocessing-v4 sheet tools (`crops.ts`, `zoom.py`,
`measure.py`) are single-page only, but the annotate kit does not use them.

**The app can show it.** cityhall#293 opens a cited document at
`review/{id}/sheets?doc=<ref>&comment=<n>` in the app's own **pdf.js** viewer
(`components/ui/pdf-viewer/`, `pdfjs-dist`). This is not a browser iframe. The viewer reads
every page's size up front (`draw.ts:37-56`) and gives each page a `div[data-page]` with
exact pixel dimensions (`index.tsx:463-476`), and it already takes a 1-based `page` prop and
scrolls to it (`index.tsx:52-54, 123-165`). An SVG with `viewBox="0 0 1 1"` over a page
div maps 0–1 coordinates directly. **One blocker:** the page drawer clears the page div on
every redraw (`for (const old of Array.from(sheet.children)) old.remove()`, `draw.ts:220`;
`replaceChildren()`, `:331`), so an overlay placed inside it is deleted. The upload
processor also stores a 150-DPI raster of every page at `{dir}/pages/{n}.jpg`
(`processing.ts:312-345`), but nothing in the DB points to these. Page 1 is used as the
document's thumbnail.

### 7.2 Decisions

**D13. A marking targets either a plan sheet or a document page.** The annotation object
keeps every field it has, and gains a second kind of target. **Exactly one** of the
following is present:

- `sheet: "07"`, a staged plan-set sheet, as today;
- `document_id: <uuid>` + `page: <int, 1-based>`, a page of a cited document.

`points` are normalised 0–1 over **the page as displayed**: origin top-left, y down,
`/Rotate` applied. pdftoppm and pdf.js both apply the page's rotation, so the producer's
render and the app's viewer share one frame. A document marker carries `file_sha256`, the staged `source.pdf` it was
read against, in place of `sheet_sha256`. Sheet markers are untouched. Every other rule is
unchanged, including the optional `marking_type` (D2: a blank form field is an `missing`
document marker): kinds, 3–12 vertices, evidence 12–500 characters, `converged` / `passes`, 20 per
comment, 1,000 per review.

The disposition gains a **`documents[]`** array beside `sheets[]`, with entries
`{document_id, page?, status, reason}`. A `nothing-to-mark` or `not-located` entry may omit
`page`, meaning "swept this document and placed nothing". The comment-level roll-up reads
both arrays with the unchanged precedence (`annotated` > `not-located` > `nothing-to-mark`).
Everything is **additive**: no existing field is renamed, so the review runbook's stored
markers and the app's current readers keep working.

**D14. No `content_block`s for documents, and no preprocessing-v4 change.** Blocks are
not what makes a plan-sheet marking work. The review runbook's sweep locates from pixels
and treats blocks as a seed only (§1.2). What the document sweep needs is the **page**.
Three things already give it:

- the run's own label, which often names a page or section;
- the section `page_range`s in the staged `overview.md`;
- the PDF itself, rendered page by page.

A letter or form page renders whole at a readable size (612×792 pt at 200 DPI is
1700×2200 px), so the first look is the full page with no tiling. Large-format pages
(the ALTA survey, 1728×2592 pt) use the sheet quadrant rule. Section boxes from
preprocessing-v4 remain an optional improvement, measured before it is built (Q9).

**D15. The sweep locates the page itself; the verdict step is not changed.** For a
fail/warn run citing a document, the worker reads that run's `label`, `observation` and
`comment`, and that document's `overview.md`. From those it picks candidate pages,
narrowest first:

1. a page the label names;
2. the page range of the section the label names;
3. the document's first page, for a 1–3 page document.

It opens **at most 6 pages** per (run, document) (Q10). A 500-page report is never
scanned, and a run whose label names nothing findable ends in `not-located` with a reason.
The page it lands on is recorded in the marker, which is the page number the CC emit
schema lacks. `2.1-review` is untouched, so verdict parity holds (D9). Adding an optional
`pageNumber` to `evidenceLocations` is a separate, later choice (Q11).

**D16. Only PDFs are swept.** A `document_version` whose `mime_type` is not
`application/pdf` (a drainage model, a spreadsheet) gets a document-level `nothing-to-mark`
("not a visual document"), written by the merge without opening it.

**D17. The stager records what the sweep and the publisher check against.** Each
`document-pdf` entry in `download-manifest.json` gains `document_version_id`,
`page_count` (`pdfinfo`) and `mime_type`. Each section `.md` gains its `page_range` in its
header. This is the document counterpart of D4, and it is a staged-file change, not a DB
change.

**D18. Validation mirrors the sheet rules.** `annotate-write.ts` (CC adapter) refuses a
document marker unless all three hold:

- the `document_id` is one **this run** cites in its `documentReferences`;
- the document is staged as a PDF;
- `1 ≤ page ≤ page_count`.

This is the document form of "a sheet the comment does not name". Lane B repeats the
checks against the staged manifest before any row is written, and fails loudly, the same
way an unresolvable sheet label fails lane A. Documents need no `sheet_map`
equivalent: the app already resolves a `document` id against the review's submission
version (`readCitedDocuments`, `sheets/read.ts:128-171`).

**D19. cityhall draws markings on the pdf.js page; no raster path.**

- **`PdfViewer` gains a page-overlay slot** (`renderPageOverlay(index, size)`). It renders
  as a **sibling** layer above each page's canvas and text layer, so the drawer's clear
  (`draw.ts:220, :331`) no longer reaches it. The drawer then draws into an inner content
  div rather than the page div itself.
- **The overlay reuses `SheetMarkers`' geometry**, an SVG with viewBox 0–1, with
  `pointer-events` only on the shapes so text selection still works. It uses the same
  `missing` style as sheets (D2, D8).
- **`?doc=` gains `&page=N`**, which opens the viewer at the marker's page.
- **The document row in the `IssuePanel`** lists that document's markers, each as "page N",
  and its disposition, the same as sheet rows.
- **`AnnotationView` becomes a union of sheet and document targets.** `markersOn` keeps
  serving sheets, and a new `documentMarkersOn(view, documentId)` serves the viewer.

The alternative was the stored `pages/{n}.jpg` rasters in the existing `ImageViewer` +
`SheetMarkers`. It was rejected because the rasters may be cut from `optimized.pdf` while
the viewer shows the original file. No DB row points at them, and they would lose the text
layer and zoom quality that #293's viewer has.

**D20. Per-run storage and the winning-run copy apply unchanged (D12).** Document markers
live on `perRunFindings[k]` beside sheet markers, and the comment shows the winning run's.
No new review-level key is needed.

**D21. The review runbook can adopt document targets later at no cost.** The annotate
kit and the validators are shared (D5). Whether the formal review's sweep marks document
findings is that runbook's own decision, and this spec does not change it.

### 7.3 Stored shape (no schema change)

| Where | v2 adds |
|---|---|
| annotation object (comment level and `perRunFindings[k]`) | `document_id` + `page` + `file_sha256` on a document marker, as the alternative to `sheet` + `sheet_sha256` |
| `annotation_disposition` | a `documents[]` array beside `sheets[]`: `{document_id, page?, status, reason}` |
| `reviews.output_json` | nothing new: the app needs no map for documents |
| DB tables | **none**: no `document_page`, no `page_count` column, no `content_block` rows for documents |

### 7.4 Phases

**v3 (grill G2): no separate document phases.** v2 had P5 (documents in the producer) and P6
(documents in the app) after P4. Both fold into the main sequence (§3.3): the producer half
into P2 and the viewer half into P3, so the first release and the P4 score cover documents.
The reason is that documents are the more markable half: about a third of failing runs cite
one, and blank form fields are the clearest `missing` case (D2).

### 7.5 Open questions (v2)

**Q8.** Does the formal review runbook want document markings too (D21)? Not needed for
the CC.

**Q9.** Should preprocessing-v4's document reader publish per-section page regions
(`document_section.regions jsonb [{page, box}]`)? Today it renders every page at 200 DPI and
discards the renders. Regions would give the sweep a tight seed, and the app could outline a
cited section the way it outlines a cited block. The cost is a box-discovery pass per page,
which is heavy on a 582-page report. Proposed: build it only if P4's `not-located` rate on
documents is high, and Will is fine with the scope.

**Q10.** Is a cap of 6 pages per (run, document) right? It bounds spend on 500-page
reports, at the price of `not-located` when a label is vague.

**Q11.** Should the CC emit schema gain an optional `pageNumber` on document
`evidenceLocations`? That would let every document citation, marked or not, open at its
page (cityhall#293 already has the viewer prop). It touches the verdict step's schema, so
it is a parity decision. Proposed: a separate small change after P2.
