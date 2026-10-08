# Comment markings for the completeness-check runbook

**Status:** Draft v3
**Date:** 2026-10-08
**Repos touched (proposed):** `bureau` (shared annotate kit lifted out of `runbooks/review/scripts/`; a new `2.12-annotate` step family in `runbooks/completeness-check/`; the stager writes block boxes; lane B of `publish_review.py` validates and stamps markings), `cityhall` (the CC adapter reads `annotations` / `annotation_disposition` the way the August adapter does; v2: the pdf.js document viewer draws markings on a page)
**Repos NOT touched:** `substation` (archived; its `supabase/` now lives in `cityhall`), `conductor2` (D23 needs no best-effort edge; 2.12's contracts always pass), `inspector-general`, `claude-plugins`

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
>   `2.12-annotate` sweep marks sheets and document pages in the same pass, and P4 covers
>   both. P5 and P6 no longer exist. §3.3 and §7.4 are rewritten.
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
> - **Answered by code and prod research, not grilled:** Q5 (every prod submission version
>   has one plan set, so it stays a separate spec), Q10 (6-page cap for long documents, and
>   a document of 10 pages or fewer is read whole, because the 8-page CC Application draws
>   107 of 254 document citations), and Q12 (the kit takes over both hand copies in P1;
>   `remap-result.json` already has the seed's and the writer's shapes). D15 rung 3 is
>   updated.
> - **G6 = Q2 + Q7: one sweep worker per guide × run, with no shape reuse.** This is the
>   roster `2.1-review` uses. A worker sees one run only, so runs' markers are independent
>   observations, which is the point of G4. No new parallelism cap: conductor2's
>   `CONDUCTOR_CONCURRENCY` (default 16) already bounds in-flight nodes, so `runs = 7` queues
>   about 70 workers and runs at most 16 at a time.
> - **G7 = Q6: on by default, with no scored gate.** `annotate` defaults to `true`. Traffic
>   is low, so Will tests the markers in the app and flips the default off if they are bad.
>   Because the step is live from its first release, the land order becomes P1 → P3 → P2,
>   so publish validation and the app renderers exist before any CC review carries markers.
>   `cc-compare` passes `annotate: false`.
> - **G8: markers or cited outlines, per sheet (D8).** Will's rule: on each sheet, a comment
>   shows its markers if it has any there, otherwise its cited-block outlines. cityhall
>   switches per comment today (`placed-markers.ts:70`, `tourOf`), so marking one sheet would
>   hide the outlines on all the others. D8 now changes both to per sheet, and §1.3 records
>   the current behaviour.
> - **G9 = Q11: the verdict step records `pageNumber` on supplementary-document citations
>   (new D22).** It is optional and 1-based. It is read from the section page ranges, using
>   the first page of a multi-page section, and omitted when no range covers the evidence.
>   It is carried through `cc.py` and `build-review-comments.ts`, both of which drop it
>   today. Every cited document opens at its page, and the sweep gets a rung-0 page. It is
>   its own PR (P2b), checked on 2008 San Antonio guide `cc-1` (33 items, about 24 document
>   citations): one CC run, one `cc-compare` loop against reviews `b80e5075` / `76570a10` (a
>   new `2008-san-antonio` baseline), and a hand check of every page.
> - **G10: annotation never blocks publishing, and every failure is logged (new D23).** Any
>   failure, however small (one comment of one run), appends a line to the `tool-bugs.md` of
>   the step that saw it. The failed piece becomes a new `not-swept` disposition, and the
>   review publishes with the rest. If the merge produces nothing, publish falls back to
>   2.9's envelope. CC's merge is drop-and-log, not the review's all-or-nothing.
>   `nothing-to-mark` and `not-located` are outcomes, not failures. conductor2 has no "go on
>   after a failure" edge (Q13). Will's answer is that 2.12's contracts always pass and the
>   merge does the checking. conductor2 measures a contract after every session, timeouts
>   included, so this needs no conductor2 change. A seat park (75) remains, as a delay rather
>   than a failure.
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
cites `Sheet 10 · block 5 (Parking Table)` already shows that box. **Today the switch is per
comment** (verified v3, cityhall-new `origin/main`). `citedBlockMarkersOn` returns nothing
for a comment with any marker anywhere (`placed-markers.ts:70`), and `tourOf` builds the
comment's prev/next tour from markers alone once there is one (`marker-sequence.ts`,
`tourOf`). A comment marked on one sheet would therefore lose its cited-block outlines on
every other sheet. D8 (v3, G8) makes the switch per sheet. Only plan-set sheets have
outlines at all: they come from `content_block`, which hangs off `sheet_version`
(`sheets/read.ts:87`), and the pdf.js document viewer draws none.

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
markers, one on each unchecked Yes/No pair. On the pages that carry those markers, the reader
sees only the two (D8, per-target switch).

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

That keeps the coverage gate total. **Workers run one per guide × run (v3, grill G6)**, the
roster `2.1-review` already uses for verdicts (`checklistItems × runs`, written by
`1.4-resolve`). Each worker handles every fail/warn item of **one run** of its guide, and
never sees another run's claims or shapes. A (guide, run) with no fail/warn finding that
cites a sheet or document drops out. On `b80e5075` that is 84 run-findings citing a sheet,
over about 30 workers. v2 had one worker per guide covering every run. That was rejected,
because a worker that has just marked run 1 carries run 1's crops and shape into run 2, and
G4's per-run geometry would no longer be independent observations.

**Parallelism needs no new cap.** conductor2 already limits how many graph nodes one driver
has in flight: `CONDUCTOR_CONCURRENCY`, default 16, sized to the seat pool rather than the
CPU (conductor2 `README.md:587`, `src/verbs/advance.rs:402-410`). A foreach roster is
queued, not launched all at once. So `runs = 7` over 10 guides is about 70 roster items, of
which at most 16 run at a time. That is the same bound `2.1-review` already runs under at
the same width. There is no per-step cap in `step.yaml` today, and this spec adds none.
The one difference from the verdict workers is that each sweep worker renders crops with
`pdftoppm` (300 DPI, CPU-bound), which `2.1-review`'s workers do not do. On a small cloud
sandbox, 16 concurrent renders may be slow rather than wrong. P4 records the step's wall
clock, and an operator can lower `CONDUCTOR_CONCURRENCY` for a run if it is. At `runs = 1` there is one run per
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
automatically gains the ability to render markings if it ever carries them. `markersOn`
already draws any comment's `annotations`.

**v3 (grill G8): markers or cited outlines, chosen per sheet, not per comment.** For each
(comment, sheet), the sheets view draws **either** that comment's markers on that sheet,
**or**, when the comment has no drawn marker on that sheet, the outlines of the blocks it
cites there (today's behaviour, open-only). Never both, and never nothing when a cited block
has a box. Example: a fail cites Sheet 5 block 2 and Sheet 6 block 3, and the sweep places
`incorrect` polygons on Sheet 6 only. Sheet 5 keeps its block-2 outline, and Sheet 6 shows
the polygons with no block-3 outline. A sheet whose disposition is `nothing-to-mark` or
`not-located` keeps its outline, because it has no marker. This changes cityhall code that
today switches per comment (§1.3):

- `citedBlockMarkersOn` (`placed-markers.ts:70`): skip a comment's outlines on **this
  sheet** only when it has a drawn marker on this sheet, rather than when it has any marker.
- `tourOf` (`marker-sequence.ts`): a comment's prev/next tour is its markers, in marker
  order, then a cited-block stop for each cited sheet that has no marker, in citation order.
  This is the order `rowSheets` already lists in the issue panel.
- The comment-level markers are the winning run's (D12), and so is the comment's
  `sheetReferences`, so both halves of the switch describe the same run.

Documents have no outline fallback (§1.3). A document page with markers draws them (D19),
and a cited document without markers opens with nothing drawn, as today. The review
runbook's comments are affected only if they cite block numbers. The P3 PR checks the
August fixtures for that, and a comment without cited blocks behaves exactly as today.
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

**D9. A request flag, on by default (v3, grill G7).** Add `annotate: boolean` to the CC
`Request`, **default `true`**. Off means a `2.12-annotate` folder holding only `SKIPPED.md`,
and 2.10/3.1 read 2.9's envelope, which is byte-identical to today (parity, goal 3). There
is no scored gate before it goes on. CC traffic is low, so Will tests the markers on real
reviews in the app. If they are bad, the default goes back to `false` in one line, and any
single run can pass `annotate: false`. The parity and compare loops (`cc-compare`) should
pass `annotate: false`. The step never changes a verdict (D1), so it cannot affect parity
either way, but it would add Opus spend to every compare run.

Because the step is on from its first release, **lane B validation, `sheet_map` and both
app renderers must land before it** (§3.3 land order). Otherwise the first CC review to run
it would publish unvalidated markers that nothing draws.

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

**D23. Annotation never blocks publishing, and every annotation failure is a
`tool-bugs.md` line (v3, grill G10).** Markings are a supplementary, bonus product of the CC.
Whatever happens inside `2.12-annotate`, `2.10-validate` and `3.1-publish` run and the CC
review publishes. The review runbook's shape is deliberately not copied: its `4.1-publish`
depends hard on `3.13-annotate`. Three outcomes, best first:

1. **All markers:** every swept (comment, run, target) has its outcome.
2. **Partial markers:** whatever failed is recorded as a new disposition status,
   **`not-swept`**, with the failure as its reason. Everything else publishes normally, and
   the sheets view falls back to cited-block outlines on a `not-swept` sheet (G8).
3. **No markers:** if the merge itself cannot produce an envelope, 2.10 and 3.1 use
   `2.9-comments`' envelope, exactly the `annotate: false` path (D9).

**What counts as a failure, each one logged however small.** Every failure appends one line
to `tool-bugs.md` in the folder of the step that saw it. That is AGENTS-core rule 14's file,
and contracts already allow it at any depth (`contract-helpers.ts:727`). Each line names the
tool, what happened, the (guide, run, comment ref, sheet or document page) it cost, and
where the evidence is. A separate spec will read these files; this one only guarantees they
are written.

| Failure | Who sees it | Result |
|---|---|---|
| A sweep worker exits non-zero, times out, parks, or never gets a seat | the merge, from the roster against the worker's missing output | `not-swept` for every (comment, run) of that (guide, run), + line |
| An annotate script exits non-zero inside a worker (crop render, remap, writer or disposition-writer refusal), **even when the worker recovered** | the worker | line in the worker's own `tool-bugs.md`. Under CC's prompt this is required, not discretionary |
| A sidecar the merge rejects (invalid, orphan, conflict) | the merge | that sidecar is dropped alone, its (comment, run, target) becomes `not-swept`, + line |
| A (comment, run) left with no disposition after the fold | the merge's coverage check | `not-swept`, + line, where the review runbook's gate would fail the step |
| A comment over the 20-marker cap | the merge | first 20 kept in marker order, + line |
| The merge crashes or writes no envelope | `2.10-validate`, falling back to 2.9's envelope | + line in 2.10's `tool-bugs.md` |
| Lane B drops or blunts a marker, or reconciles a sheet to `not-located` (D7) | `3.1-publish` | + line in 3.1's `tool-bugs.md` |

**Not failures:** `nothing-to-mark` and `not-located`. They are the sweep's correct answers
(D2), so they stay in the disposition and are not logged.

**CC's merge is drop-and-log, not all-or-nothing.** The review's merge refuses the whole fold
on one bad sidecar, because an operator is there to fix it and re-run before the human gate.
The CC has no such gate, and markings must not hold back the review. So CC's own merge (D5,
per runbook) drops the bad piece, records `not-swept`, and logs it. Nothing is lost
silently, because every drop is both a disposition and a `tool-bugs.md` line. The rule 14
lines from scripts (the merge, 2.10's fallback, lane B) are an extension of a rule written
for agents, and these scripts append them themselves.

**`not-swept` in the stored shape.** It is a disposition status beside `annotated`,
`nothing-to-mark` and `not-located`, valid per sheet, per document and comment-level. The
roll-up precedence becomes `annotated` > `not-swept` > `not-located` > `nothing-to-mark`: a
gap the system caused shows ahead of the agent's own. cityhall's disposition reader
(`readPlanMarkup`, D8) shows it as "not swept (marking failed)".

**How "never blocks" holds: the annotate steps always pass, and the merge does the checking
(v3, G10, Will's design).** In conductor2, a step finishing and a step passing are one event.
A node's exit code is its contract's verdict, and readers launch only on 0. A failing
contract sends the agent back into its own session (`--max-retries`, default 2) and then
exits 1, which blocks every reader (conductor2 `README.md`, "Trust the exit code"). So
2.12's contracts are written to pass whenever the step ran, and the step after them checks
the work:

- **Sweep worker contract:** passes whenever the session ended. Every output is optional
  (`annotations/*.json?`, `disposition/*.json?`, `logs/*.md?`). It checks nothing about
  count, coverage or validity. conductor2 measures the contract after every session,
  including one that hit its `timeout_secs` (`src/verbs/agent.rs`, the after-contract
  branch), so a timed-out or crashed worker exits 0 too.
- **Merge** (a script): never exits non-zero. It compares the (guide, run) roster with what
  each worker left, folds what is valid, writes `not-swept` for every gap, and appends a
  `tool-bugs.md` line for each failure in the table above. It always writes an envelope,
  falling back to a copy of 2.9's. Its contract checks only that the envelope exists, and
  it can be kept trivial enough that it cannot fail to run.
- `2.10-validate` and `3.1-publish` read the merge's envelope as a plain input.

No conductor2 change. `tool-bugs.md` is unaffected, because it is written during the session
and by the merge, and contracts already allow it at any depth. Two things change against
today's agent steps:
- **Retries are kept; they move into the session (v3, Will).** There are two retry loops, and
  only one runs through the contract:
  - **The agent's own loop.** An agent never writes a sidecar itself. `annotate-write` and
    `annotate-disposition-write` validate first and exit non-zero, writing nothing, on a
    malformed or invalid input. `annotate-crop` and `annotate-remap` fail loudly on a
    malformed `seed.json` or `correction.json`. The agent sees the error and fixes it, as
    often as it needs, inside its session. **Malformed JSON is retried here, untouched by
    the contract.** Each of those non-zero exits is still a `tool-bugs.md` line, even when
    recovered (table above).
  - **conductor's contract retry.** It sends a failing contract back into the session up to
    `--max-retries` (2) times, then exits 1. The contract is not told which attempt it is on
    (`src/verbs/agent.rs:820-1200`), so a strict contract cannot "fail, then give up
    quietly". The end-of-session check it would run moves into the session instead: before
    it ends, the CC sweep prompt requires the worker to run `annotate-disposition-check`
    scoped to its own (guide, run) and fix every gap it names until the check is clean. A
    worker that still ends with gaps (out of time, seat lost) is caught by the merge:
    `not-swept`, plus a line. Rejected: a conductor2 change that tells the contract its
    attempt number, so that it could be strict until the last attempt. Revisit only if the
    in-session check proves leaky.
- **conductor's ledger shows every sweep worker as done.** The failure record is the
  `tool-bugs.md` line plus the disposition, which is what G10 asks for.

**What a passing contract cannot cover:**
- **A seat park (exit 75).** A worker that never gets a seat never runs, so it has no
  contract to pass. A local pass sleeps and retries for up to six hours. A cloud pass exits
  75 and the run waits for a seat (conductor2 `README.md`, "Which seat a step spends"). That
  delays the publish rather than failing it, and `2.1-review`'s workers already carry the
  same exposure, so it is accepted.
- **Exit 76 (unmeasurable contract) and exit 77 (strays from another process).** The worker
  contract is kept trivial so that it cannot error. Its outputs are declared broadly enough
  that its siblings' shared `annotations/` and `disposition/` files are never strays.

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
- **P2 CC step, sheets and documents together (v3).** `2.12-annotate`, on by default
  (D1–D3, D9–D11), with document targets in the same sweep (D13, D15–D18):
  the stager's document fields (D17), the page-finding rules (D15), the non-PDF disposition
  (D16) and the document checks in the kit's validators (D18). Contract tests: every roster
  run has a disposition for every sheet **and document** it cites, and markers validate.
- **P3 Publish + app, both renderers (v3).** Lane B validation and `sheet_map` (D6, D7), plus
  the document checks (D18). Then cityhall: the CC adapter (D8) **and** the pdf.js page
  overlay with `&page=` (D19). Land the app change first: until it ships, a published CC
  review stores markings that nothing draws, which is harmless. The overlay edits the
  viewer that cityhall#293 shipped, so P3's cityhall PR waits until #293 is settled on main.
- **P4 Try it on real reviews (v3, G7).** No scored gate. Will looks at the markers on the
  next CC reviews in the app, and turns the default off if they are bad (D9). The things to
  watch are `missing` markers that point at nothing (D2 guards), document `not-located` (Q9),
  and the step's wall clock (D3).

- **P2b Document page numbers in 2.1 (v3, G9, D22).** Its own bureau PR, checked on
  **2008 San Antonio St, guide `cc-1` only** (Will, 2026-10-08):
  - **Target.** Project `7746ac2f-9788-40cd-ad68-3efe5d32d399`, submission version
    `624309c1-a216-44ca-9c27-b4dcb11d6d1f`, checklist `v2.7-trimmed`. `cc-1` has 33 items. On
    the two newest reviews, 18–19 of them cite a supplementary document (15–16 passes, 3
    fail/warn), for 23–24 document citations, so it exercises the new field on both passes
    and fails.
  - **Run.** One CC run of the PR branch: `cc-1` only, `runs = 3` (as the comparison
    reviews), `annotate: false`.
  - **Verdicts.** One `cc-compare` loop. cc-compare ships only the `lamar-v4` baseline, so
    this adds `runbooks/cc-compare/baselines/2008-san-antonio.json`:
    - A = `b80e5075-f883-4e63-947c-7bd2a603fb84` and B =
      `76570a10-116d-42a0-9577-761b5ee6776e`, both 2026-10-06, `runs = 3`, `v2.7-trimmed`,
      on this submission version and without `pageNumber`. They are the "before".
    - The `cc-1` guide hash is generated with the README's command, never by hand.
    - An empty answer key, so disagreements go to the blind adjudicator and seed it.

    The pass bar is no `cc-1` verdict moved beyond the A/B disagreement the adjudicator
    rules on. cc-compare compares final statuses only, so it shows whether the new
    instruction moved a verdict, not whether a page is right.
  - **Pages.** By hand: open every `cc-1` document citation (about 24) at its `pageNumber`
    and confirm it lands on the evidence, or on the first page of the evidence's section.

**Land order (v3, G7, G9): P1 and P2b, then P3, then P2.** P2 ships on by default, so the publish
validation and both app renderers (P3) go first. P3's bureau half is inert until a record
carries markers, and its cityhall half draws nothing until then, so landing it early is
safe.

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
  cells. Absences with no slot still stay unmarked. Will's P4 look shows the real rate.
- **A `missing` marker drifts into guessing.** Without a visible slot the agent could "place"
  a missing note where it thinks one belongs. Guards 1–3 of D2 forbid that. There is
  no formal audit before default-on (G7). Will watches `missing` markers first in P4, and
  the off switch is the request flag.
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
**Answered in v3 (grill G6): one worker per guide × run** (D3). It matches `2.1-review`'s
roster, keeps each run's markers independent, and gives the finest partial credit.
In-flight workers are bounded by conductor2's existing `CONDUCTOR_CONCURRENCY` (16).

**Q3.** Model for `annotate`: opus-5.5 high (D11), or try sonnet-5.5 first given CC's cost
profile?

**Q4.** ~~Supplementary documents: out of scope?~~ **Answered in v2:** in scope, see §7.

**Q5.** Multiple plan sets per submission. The stager names folders `sheet-NN` by each
plan set's own sheet number, so two sets collide. The app's sheets view reads only one plan
set. This is shared by both runbooks: fix it here, or leave it for a separate spec?
**Answered by research (v3, 2026-10-08): a separate spec, and not needed now.** In prod,
all 38 submission versions that carry a plan set have exactly one `plan_set_version`. That
includes the 14 with a CC or annotated review. The collision cannot occur on any submission
the feature would run on today.

**Q6.** Default-on criterion for D9: what marker precision on the hard-item sets is good
enough? One proposal: no wrongly placed marker among 20 audited.
**Answered in v3 (grill G7): no criterion; on by default from the first release.** Traffic
is low. Will tests in the app and turns it off if it is bad (D9).

**Q7.** Runs that agree often cite the same block for the same deficiency. Should the sweep
mark each run independently (D3 as written: no cross-run influence, about 3× the passes),
or may a worker reuse a converged shape from a sibling run when that run cites the same
sheet and block and its evidence text still reads true? Reuse is cheaper, but it makes the
runs' markers no longer independent observations.
**Answered in v3 (grill G6): no reuse.** A per guide × run worker never sees a sibling run,
so each run is located independently (G4, D3).


**Q12 (v3).** The agent still moves numbers between files by hand twice. At step 8 (tab 03)
it copies `remap-result.json`'s sheet shape into the next `seed.json`, and the next overlay
at least shows that copy. At step 9 it copies the final 0–1 `unit` points into
`annotate-write --points`, which is never compared and never drawn (§1.4). Should the shared
kit take both over, with `annotate-crop --seed-from <prev pass dir>` and
`annotate-write --from-remap <pass dir>`, so that `correction.json` is the agent's only
numeric output? Proposed: yes, in P1, which fixes the review runbook too.
**Answered by research (v3, 2026-10-08): yes, in P1.** The two hand copies are mechanical,
and the files already line up. `remap-result.json` carries `kind` plus `sheet`, which is
`SheetPoint[]` in sheet 0–1000 (`annotate-remap.ts:125-134`). That is exactly the
`polygon` / `point` form of a `Seed` (`lib/annotate-refine.ts:29-32`). It also carries
`unit`, the 0–1 points `annotate-write` stores. So `annotate-crop --seed-from <prev pass
dir>` builds the next seed from the previous `remap-result.json`, and `annotate-write
--from-remap <pass dir>` reads `kind` and `unit` from the same file it already opens for
`converged`. `--points` and `--kind` are removed from the writer. The sweep prompts' loop
rules (`loop-rules.md`, D5) say so, and both runbooks gain the fix.

**Q13 (v3, G10).** How does `2.10-validate` wait for `2.12-annotate` without being blocked
by its failure (D23)? conductor2 has no such edge today.
**Answered in v3 (Will): 2.12's contracts always pass and the merge checks (D23).** No
conductor2 change is needed. The options considered: Options:
- **(a) A small conductor2 feature:** a best-effort input, for example `- 2.12-annotate!`.
  It orders like a plain input, but the reader launches once that node is terminal in any
  state: done, failed, or parked past a deadline. The reader then finds out from the folder
  what happened.
- **(b) Bureau only:** `2.12-annotate` becomes one `runner: script` step that drives its
  sweep workers itself, as a sub-run, and always exits 0.

First proposed: (a), now superseded by the answer above, which needs neither. (a) kept the sweep a normal foreach with per-worker ledger rows and partial
credit (G6). It is a few lines in conductor2's scheduler, and it moves `conductor2` from
"not touched" to "touched". (b) hides the workers from the run graph. Either way, every
annotate worker gets a `timeout_secs` on its runner preset (D11), so a hung sweep ends as a
failure the merge logs, not as a wait.
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

0. the run's own `pageNumber` on that citation, when 2.1 recorded one (v3, D22);
1. a page the label names;
2. the page range of the section the label names;
3. the whole document, in page order, for a document of **10 pages or fewer** (v3, Q10).

For a longer document it opens **at most 6 pages** per (run, document) (Q10). A 500-page report is never
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
- **`?doc=` gains `&page=N`**, which opens the viewer at the marker's page. A cited document
  with no marker opens at the citation's `pageNumber` (D22) when it has one, else page 1.
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

**D22. The verdict step records a page for every supplementary-document citation (v3,
grill G9; answers Q11).** `2.1-review`'s `evidenceLocations` gain an optional
**`pageNumber`** (integer, 1-based) on a citation of a supplementary document, meaning any
`documentId` that is not the plan set. A sheet citation never carries it, because
`sheetNumber` is already its page. This is a deliberate change to the verdict step, so CC
parity with the legacy runner no longer binds it. The verdicts themselves must not move,
which is what the check below measures.

- **Where the page comes from.** The worker sees documents through the staged transcriptions
  and the vision tool, which analyses a document as a whole (prompt `:37`). So the page is read
  off the section page ranges in `overview.md` (`Section 4: Engineer Information (3)`) and in
  each section file's header (D17). The prompt rule is to cite the page the evidence is on
  when its section covers one page, and the section's **first** page when it covers several.
  Never guess: omit `pageNumber` when no page range covers the evidence. The marker's page
  (D13, D15) is still the exact page, because the sweep reads pixels.
- **Where it travels**, three places that drop unknown keys today:
  - the 2.1 emit schema, prompt (`:225`, `:299`) and contract (`contract.test.ts:23`
    `EvidenceLocation`);
  - `cc.py` `canonicalize`, which coerces `"3"` to `3` as it already does for
    `sheetNumber` / `blockNumber`;
  - `workflows/completeness-check/scripts/build-review-comments.ts`, both the comment-level
    `docRefs` (`:246`) and each `perRunFindings[k].documentReferences` (`:381`), which today
    map a citation to `{documentId, label}` only. They become
    `{documentId, label, pageNumber?}`.
- **Stored:** `documentReferences[].pageNumber` in `review_comments.output_json`, at the
  comment level and per run. It is additive and optional, and there is no DB change. The app
  reads it for `&page=` (D19).
- **Uses:** every cited document opens at its page in cityhall#293's viewer, whether marked
  or not, and the sweep gets a rung-0 page (D15).
- **Ships as its own PR, before P2,** checked as described in P2b (§3.3).

### 7.3 Stored shape (no schema change)

| Where | v2 adds |
|---|---|
| annotation object (comment level and `perRunFindings[k]`) | `document_id` + `page` + `file_sha256` on a document marker, as the alternative to `sheet` + `sheet_sha256` |
| `annotation_disposition` | a `documents[]` array beside `sheets[]`: `{document_id, page?, status, reason}` |
| `documentReferences[]` (comment level and `perRunFindings[k]`) | optional `pageNumber` (v3, D22) |
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
which is heavy on a 582-page report. Proposed: build it only if document `not-located` is high
in Will's P4 testing, and Will is fine with the scope.

**Q10.** Is a cap of 6 pages per (run, document) right? It bounds spend on 500-page
reports, at the price of `not-located` when a label is vague.
**Answered by research (v3, 2026-10-08): 6 pages for long documents; a document of 10
pages or fewer may be read whole.** The 7 `runs = 3` CC reviews since 2026-10-01 carry 254
document citations on fail/warn runs, across 12 documents. The most-cited document is the
**8-page** CC Application, with 107 of the 254 citations. A flat cap of 6 would block a
whole read of the one document that `missing` markers (D2) target most. Long documents
account for 65 of the 254 citations: a 50-page Engineer's Report (55) and a 582-page one
(10). That is where the cap matters. Labels usually name a part of the document: 202 of 254
name a section, exhibit, table, form, field, signature or seal; 10 name a page; and 50 name
neither. The section `page_range`s (D15 rung 2) cover most of the long-document cases. Page
counts are the maximum of each document's `document_section.page_range`.

**Q11.** Should the CC emit schema gain an optional `pageNumber` on document
`evidenceLocations`? That would let every document citation, marked or not, open at its
page (cityhall#293 already has the viewer prop). It touches the verdict step's schema, so
it is a parity decision. Proposed: a separate small change after P2.
**Answered in v3 (grill G9): yes, now, as its own PR before P2 (D22).** Verdict-step parity
no longer binds this change. The check is that verdicts do not move (§3.3 P2b).
