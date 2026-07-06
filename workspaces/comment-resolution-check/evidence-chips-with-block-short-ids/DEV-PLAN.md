# `evidence-chips-with-block-short-ids` — Dev Plan

> **Status:** Draft, 2026-07-03. Supersedes the numbering-related sections
> of [`../block-short-id/DEV-PLAN.md`](../block-short-id/DEV-PLAN.md).
> Refines the rollout to avoid regenerating existing `sheet_version.reading_guide`
> narratives by versioning the block-numbering scheme per sheet_version.
>
> The `content_block.short_id` column and backfill from block-short-id Phase 1
> stay as-is (already applied to prod). This plan replaces the "flip everyone
> to short_id numbering" step with a per-sheet flag so old and new sheets
> can coexist.

---

## Summary

We're adding stable, per-sheet numeric IDs to content blocks so CRC evidence
chips in the review UI can deep-link to a specific block on a specific
sheet — not just the sheet as a whole. UUIDs would work in principle, but
Haiku 4.5 running at 30-worker parallelism across dozens of items will
hallucinate them, so we're using short integers (1..N per sheet_version)
that follow the existing pattern of `sheetNumber`. The IDs are computed
deterministically from bounding-box reading order (top-then-left) so they
stay meaningful and reproducible. To avoid regenerating 1,147 existing
`reading_guide` narratives that reference the old category-alphabetical
numbering, we're versioning the numbering scheme per sheet_version —
legacy sheets keep their old rendering, new sheets get short_id numbering
plus deep-linkable chips. Post-processing in the review workflows — driven
by a per-sheet block manifest the project downloader writes into the
workspace — strips `blockNumber` from legacy sheets and validates it
against the sheet's real short_ids before it hits `review_comments`,
keeping the data clean and the UI's fallback behavior automatic.

---

## 1. Overview

**End goal (refined 2026-07-03).** CRC evidence chips resolve to a
specific content block on a specific sheet of the reviewed submission
version. Chip click opens an enhanced modal (block highlighted +
auto-zoomed, pan/zoom controls — see §3.5); from the modal, an "open
sheet" button deep-links to the real sheet page in a new tab:

```
/project/{projectId}/plan-set/sheet/{sheetNumber}?block={blockNumber}&sv={submissionVersionId}
```

**Problem discovered during block-short-id rollout.** `sheet_version.reading_guide`
is an LLM-generated narrative stored per sheet_version that references
blocks by number (e.g. *"Blocks 2, 3, 4, 9, 10, 11, 13 — Boilerplate & Administrative"*).
Existing 1,147 reading_guides were generated with the old category-alphabetical
numbering (`.order('category') → blockNum = i + 1`). If we globally switch
blocks.md to `short_id` numbering, those narratives point at the wrong
blocks. Regenerating all 1,147 is expensive and doesn't buy anything we
can't get by versioning the scheme instead.

**Solution.** Add a per-sheet_version `block_numbering_scheme` flag with
two values:

- `'legacy-category-order'` — the numbering baked into existing
  reading_guides. Blocks in `blocks.md` are ordered by category ASC and
  numbered `i + 1`. No `blockNumber` support in evidenceLocations.
- `'short-id-ordered'` — new sheets processed after the substation fix
  ships. Blocks in `blocks.md` are ordered by `content_block.short_id`
  ASC and labelled with the `short_id` value directly. Evidence chips
  can deep-link via `blockNumber = short_id`.

Existing sheets stay legacy. New sheets get the new scheme. Both work.
No backfill needed.

---

## 2. What's already done (from block-short-id Phase 1)

- `content_block.short_id INT` column exists, nullable, populated for all
  12,712 existing rows (`ROW_NUMBER() OVER (PARTITION BY sheet_version_id
  ORDER BY (bounding_box->>'y')::numeric, (bounding_box->>'x')::numeric, id)`).
- Substation PR #127 (open, not yet merged) has the write-side change so
  new `content_block` inserts populate `short_id`.

Both stay. This plan builds on top.

---

## 3. Proposed changes

### 3.1 New column on `sheet_version`

```sql
ALTER TABLE public.sheet_version
  ADD COLUMN block_numbering_scheme TEXT NOT NULL DEFAULT 'legacy-category-order';
```

`ADD COLUMN … NOT NULL DEFAULT` populates all 1,147 existing rows in a
single statement — no separate backfill.

**TODO:** decide whether to add a CHECK constraint enumerating the two
values, or leave it open for future schemes. Small trade-off — CHECK
catches typos at write time; open leaves room for `'short-id-with-anchors'`
etc. without a migration.

### 3.2 Substation write side (amend PR #127)

Two files, three edits.

**(a) `sheet.ts:220-224` — the reading-guide generation step.** Change the
block fetch to order by `short_id` instead of `category`:

```typescript
const { data: blocks } = await supabase
  .from('content_block')
  .select('id, category, description, content, short_id')
  .eq('sheet_version_id', sheetVersionId)
  .order('short_id', { ascending: true, nullsFirst: false });
```

**(b) `sheet.logic.ts:33-48` — `buildBlocksContext`.** Currently numbers
blocks as `Block ${i + 1}`. Change to use `block.short_id` when present,
so the "Block N" labels in the LLM prompt are actual short_id values:

```typescript
export function buildBlocksContext(
  blocks: { category: string; description: string; content: string | null; short_id?: number | null }[]
): string {
  let context = '\n\n## Content Blocks on This Page\n\n';
  if (blocks.length === 0) return context + 'No content blocks have been identified on this page.\n';
  blocks.forEach((block, i) => {
    const num = block.short_id ?? i + 1;
    context += `### Block ${num}: ${block.category}`;
    if (block.description) context += ` — ${block.description}`;
    context += '\n';
    context += block.content ? `\n${block.content}\n\n` : '\n(No transcription available)\n\n';
  });
  return context;
}
```

**(c) After successful `reading_guide` generation, stamp the scheme:**

```typescript
await supabase
  .from('sheet_version')
  .update({ reading_guide: guide, block_numbering_scheme: 'short-id-ordered' })
  .eq('id', sheetVersionId);
```

Do it in the same UPDATE as writing the reading_guide, so the two are
atomic — a sheet_version row is never in a state where the scheme claims
`short-id-ordered` but the guide is still legacy (or vice versa).

**Guard the stamp.** Only stamp `'short-id-ordered'` when *every* block
fetched in (a) has a non-null `short_id`. The `?? i + 1` fallback in (b)
is a safety net, not an expected path — if it ever fires, the guide's
"Block N" labels silently mix short_ids with array indexes (possibly
colliding), and stamping the scheme anyway would falsify the system's
only integrity claim. If any block lacks `short_id`, log loudly and
leave the row at the legacy default (fails safe: sheet-level links,
never wrong deep-links).

**(d) `plan-set.logic.ts:141-142` prior-version copy path.** Currently
copies `summary` and `reading_guide`. Also select + copy
`block_numbering_scheme`:

```typescript
.select('..., summary, reading_guide, block_numbering_scheme')
// then:
summary: priorSheet.summary,
reading_guide: priorSheet.reading_guide,
block_numbering_scheme: priorSheet.block_numbering_scheme,
```

Copying preserves the invariant: an unchanged legacy sheet stays legacy
even after re-processing. A fresh-generation sheet (added/modified path)
runs through (a)–(c) and gets stamped `'short-id-ordered'`.

### 3.3 Conductor read side (project-downloader.ts)

Fetch `block_numbering_scheme` on each sheet_version and branch the
`writeSheet` behavior. Two paths, both preserving existing functionality
for their scheme:

```typescript
// In the sheet_version query:
.select('..., block_numbering_scheme')

// Per-sheet block fetch:
const order = sv.block_numbering_scheme === 'short-id-ordered'
  ? { column: 'short_id', ascending: true, nullsFirst: false as const }
  : { column: 'category', ascending: true, nullsFirst: undefined };

const { data: blocks } = await supabase
  .from('content_block')
  .select('id, category, description, content, bounding_box, short_id')
  .eq('sheet_version_id', sv.id)
  .order(order.column, { ascending: order.ascending, nullsFirst: order.nullsFirst });
```

Inside `writeSheet`, either branch the numbering:

```typescript
const blockNum = sv.block_numbering_scheme === 'short-id-ordered'
  ? (block.short_id ?? i + 1)
  : i + 1;
```

or expose scheme to `writeSheet` and let it decide. Either works.

**Boilerplate filter.** Unchanged — still filters from rendering but
preserves the numbering namespace so `Block 6` in blocks.md always
corresponds to the same content_block for that sheet_version. For
short-id sheets this produces sparse numbering (e.g. Block 4, 5, 8 —
matching short_id gaps). For legacy sheets it produces the same
sparse numbering as today.

**Block manifest for downstream scripts.** In the same per-sheet loop,
the downloader writes a machine-readable `block-manifest.json` at the
workspace root:

```json
{
  "sheets": [
    {
      "documentId": "<plan_set_id>",
      "sheetNumber": 3,
      "sheetVersionId": "…",
      "blockNumberingScheme": "short-id-ordered",
      "validBlockNumbers": [1, 2, 4, 7]
    },
    {
      "documentId": "<plan_set_id>",
      "sheetNumber": 4,
      "sheetVersionId": "…",
      "blockNumberingScheme": "legacy-category-order"
    }
  ]
}
```

- `documentId` is the plan_set id — the same value evidenceLocations
  carry (it's what README.md advertises as the vision-tool document ID),
  so gate scripts can match on `(documentId, sheetNumber)` directly.
- `validBlockNumbers` is the full set of `short_id`s on the sheet —
  all blocks, including boilerplate (a boilerplate block is still a
  real, highlightable content_block). Omitted for legacy sheets.
- This exists because the downstream persistence scripts
  (`build-crc-review-comments.ts`, `enrich-findings.ts`,
  completeness-check's `build-review-comments.ts`) are pure JSON→JSON
  transforms with **no Supabase access and no plan_set_version
  context** — they cannot map `(documentId, sheetNumber)` to a
  sheet_version on their own. The downloader already has every row in
  hand; a local file read keeps DB credentials and join logic out of
  bureau scripts entirely.

**Prior prototype (reverted 2026-07-06).** An uncommitted working-tree
diff in `conductor/src/shared/project-downloader.ts` implemented the
superseded unconditional short_id flip (order by `short_id`, number as
`short_id ?? i + 1` — no scheme branching, no manifest). It was reverted
so local conductor runs can't produce workspaces where legacy sheets'
blocks.md numbering mismatches their reading_guide narratives, and so
the working tree matches the baseline this section describes. The diff
is preserved verbatim as
[`project-downloader-unconditional-shortid.patch`](./project-downloader-unconditional-shortid.patch)
alongside this plan — a reference starting point, not to be applied
as-is.

**Surveyor mirror.** `surveyor/src/download.ts` is a declared behavioral
mirror of this file (its header says "Synced with
`conductor/src/shared/project-downloader.ts`") and is still on
`.order('category')` + `i + 1` numbering (`download.ts:250, 549`). Port
the same scheme branching and the block-manifest write so the two files
stay behaviorally identical. Surveyor serves standalone diligence/local
flows, not the review persistence path, so this is off the critical
chain — but skipping it would leave short-id sheets rendering
guide-mismatched numbering in every surveyor-produced workspace.

### 3.4 Review workflows — emit `blockNumber` conditionally

Applies to `review`, `completeness-check`, and `comment-resolution-check`
workflows. The review agent already sees whatever blocks.md contains and
naturally cites `Block N` in its findings. We need the persisted output
in `review_comments.output_json.evidenceLocations[].blockNumber` to
carry a value **only when it's safe to deep-link.**

**Approach: post-processing gate.** Chosen for clean data + robustness,
and to avoid conditional prompting complexity.

- Bureau schemas (CRC + review) have `blockNumber?: integer` as optional.
  Agent emits it whenever it references a specific block — no scheme
  awareness required in the prompt.
- Downstream scripts that transform agent output into `review_comments`
  rows (`build-crc-review-comments.ts`, `build-review-comments.ts`, etc.)
  read `block-manifest.json` from the workspace (§3.3) — a local file
  read, since these scripts have no Supabase access. For each
  evidenceLocation carrying a `blockNumber`, look up
  `(documentId, sheetNumber)` in the manifest and strip the field
  unless the sheet is `'short-id-ordered'` **and** the value is in
  `validBlockNumbers`.
- The validity check is load-bearing, not belt-and-suspenders: the whole
  reason for short ints over UUIDs is hallucination, but a hallucinated
  *integer* usually resolves to a real (wrong) block — a silent bad
  deep-link — where a hallucinated UUID fails loudly. Checking against
  `validBlockNumbers` converts that failure mode into a sheet-level
  fallback.
- Legacy sheets: `blockNumber` is `undefined` in the persisted row →
  cityhall renders a sheet-level link. New sheets: `blockNumber` present
  → cityhall deep-links.

**Alternatives considered and rejected:**

- *(a) Agent-side gate.* Have project-downloader annotate blocks.md and
  rely on the agent to comply. Adds if/else prompting complexity and is
  fragile against model drift.
- *(c) UI-side gate.* Simplest, but pollutes `review_comments` with
  meaningless `blockNumber` values on legacy sheets.

**TODO:** confirm which review workflows need the post-processing edit.
Definitely CRC. Probably also completeness-check. Regular review workflow
may or may not, depending on whether its schema even has `blockNumber`
today.

### 3.5 Cityhall — enhanced evidence-chip modal + URL wiring

**Interaction model (decided 2026-07-03).** Chip click keeps opening a
modal on the review page, as today — it does NOT navigate away. The
sheet-page deep-link moves inside the modal as an "open sheet" button.
The current `SheetLightbox.svelte` (a plain image viewer receiving
`thumbnailStoragePath` + `label` + `onClose`) is replaced/extended with
four capabilities:

1. **Block highlight.** When the chip's evidenceLocation carries a
   `blockNumber` (site-plan sheet, specific block), render the block's
   bounding box over the sheet image — outline plus shaded overlay.
   `content_block.bounding_box` is `{x, y, width, height}` normalized
   0–1, top-left origin; the sheet page already renders these as
   percentage-positioned absolute overlays, so the same technique
   applies directly to the modal image.
2. **Auto-zoom on the block.** Deliberately dumb for v1: ~2x zoom
   centered on the bounding-box center, clamped so the block stays
   fully in the viewport. No smart fit-to-block math.
3. **Pan/zoom controls.** Zoom in / zoom out buttons, a **Fit** button
   that resets to fit-the-sheet, and panning via click-drag plus
   up/down/left/right arrow buttons. These controls are present for ALL
   sheets in the modal, block or no block.
4. **"Open sheet" button.** Opens, in a new tab, the real sheet page
   pinned to the reviewed version with the block selected:
   `/project/{projectId}/plan-set/sheet/{sheetNumber}?block={blockNumber}&sv={submissionVersionId}`.
   Depends on `noetic-aqy` (version-aware sheet URL). The sheet page's
   existing `selectedBlock` highlight state hydrates from `?block=`.

**Fallback matrix:**

| `blockNumber` on chip | `reviews.submission_version_id` | Modal behavior | "Open sheet" URL |
|---|---|---|---|
| present | present | highlight + auto-zoom + controls | `?block={n}&sv={sv}` |
| absent | present | plain sheet + controls | `?sv={sv}` |
| absent | absent (legacy review) | plain sheet + controls (today's behavior + controls) | sheet URL only (active version) |

`blockNumber`-present + `sv`-absent shouldn't occur: `blockNumber` only
survives the §3.4 gate on modern runs, which always carry
`submission_version_id`.

**Data plumbing.** Today's chip click handlers pass only
`{ sheetNumber, label }` to the lightbox and ignore the ref's `documentId`
entirely — the image resolves via a `sheetThumbnailPaths[sheetNumber]` map
built from the project's *first* plan_set only (correct today by the
single-primary-plan-set convention, but unchecked). The version pinning is
already right: that map is built from the `plan_set_version` matching
`reviews.submission_version_id`, falling back to latest for legacy rows.
The enhanced modal makes `documentId` load-bearing: the click handlers
(all three call sites: `[reviewId]/+page.svelte`,
`SimplifiedCommentCard.svelte`, legacy `CommentCard.svelte`) must thread
the full evidenceLocation — `documentId`, `sheetNumber`, `blockNumber` —
plus `submission_version_id`, and the bbox lookup must match on
`(documentId, sheetNumber)`, degrading to the plain modal when the
document isn't the primary plan set.

The modal needs the cited block's bounding box, which
`review_comments` doesn't carry. On modal open, resolve it live:
`submission_plan_set` (by `sv`) → `plan_set_version` → `sheet_version`
(by `sheet_number`) → `content_block` where `short_id = blockNumber`,
select `bounding_box` — the same junction chain the sheet-page loader
already uses. Non-blocking failure: if the lookup misses (block deleted,
scheme drift), degrade to the plain-modal row of the matrix.
*Alternative if the extra queries bother us:* denormalize the bbox into
the evidenceLocation at gate time (§3.4 already has the manifest in
hand) — deferred; keep the persisted shape minimal until the live
lookup proves annoying.

**Resolution caveat.** The modal displays the sheet's thumbnail JPEG; at
2x zoom it may be soft. Acceptable for v1 ("dumb" zoom by design) — a
higher-res render (e.g. rasterizing from `storage_path`) is a follow-up,
and the "open sheet" button is the escape hatch for reading fine detail.

- No change needed to gate on scheme here — legacy sheets simply won't
  have `blockNumber` in their `review_comments` rows (§3.4).

### 3.6 Bureau CRC schema + prompt

- CRC schema (`bureau/workflows/comment-resolution-check/schemas/crc.schema.json:45-66`):
  add optional `blockNumber: integer` on each `evidenceLocations[]` item.
  Field is optional — legacy-sheet findings will simply omit it after the
  post-processing gate strips it.
- CRC prompt (`bureau/workflows/comment-resolution-check/prompts/review.md`):
  instruct the agent to cite `blockNumber` when the evidence is a
  specific block. Reference the "Block N" labels in `blocks.md` /
  `block-N.md` filenames.

Same additions should be considered for the shared review + completeness-check
schemas + prompts, depending on scope decision above.

### 3.7 Pipeline pass-through — verified 2026-07-03

`blockNumber` has to survive every hop between the agent's structured
output and the persisted `review_comments` row. Audited each hop against
the actual code:

| Hop | Verdict | Evidence |
|-----|---------|----------|
| Agent emit vs `crc.emit.schema.json` | ✅ add field | No `additionalProperties: false` on evidenceLocations items; declare `blockNumber` so the model emits it reliably. |
| Conductor ajv validation | ✅ passes | `new Ajv({ allErrors: true, strict: false })` in `structured-output-repair.ts:151` — no `removeAdditional`, unknown props untouched. |
| `normalizeStructuredOutput` (emit → strict recompile) | ✅ passes | Envelope-level only: injects/derives `grouping`, extracts the findings array; finding objects pass through unmodified. |
| Cross-run consolidation (`cross-run-consolidate-crc.ts:258-288`) | ✅ passes | Winning finding = **earliest run whose status matches the effective status**, carried wholesale (`evidenceLocations` by reference, no rebuild). |
| `enrich-findings.ts` | ✅ passes | evidenceLocations passed through unchanged. |
| Enrichment agent (`enriched-final-comment.schema.json`) | ✅ not in path | Its `additionalProperties: false` schema outputs prose + source metadata only; evidenceLocations feed its *input* but don't round-trip through its output. |
| `build-crc-review-comments.ts:273-283` | ⚠️ **must edit** | Rebuilds evidence **field-by-field** (`documentId`/`sheetNumber`/`label`) — would silently drop `blockNumber`. This is also the gate site (§3.4), so the same edit adds the field and the manifest check. |
| Cityhall review-page loader (`cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.ts` ~739-752) | ⚠️ **must edit** | Found 2026-07-06: an **eighth hop past persistence.** The loader maps each persisted sheet ref **field-by-field** into `comment.sheetReferences` (`documentId`/`sheetNumber`/`label`) — so `blockNumber` would die here even after every server-side hop passes it through. The same mapping also back-fills missing `documentId`s with `primaryDocId` via a `Sheet N` label regex. Edit alongside the §3.5 chip work. |

**Consolidation semantics (decided 2026-07-03).** The rendered card takes
the first winning voter's finding — explanation, agentTrace, and
evidenceLocations together. If that voter didn't cite a `blockNumber`
but other majority voters did, the block reference is dropped. Accepted:
keeps consolidation simple, and the failure mode is a sheet-level link,
not a wrong link. No cross-voter evidence merging.

---

## 4. Rollout order

1. **Column migration** — `ALTER TABLE public.sheet_version ADD COLUMN
   block_numbering_scheme …`. Idempotent, defaults all existing rows to
   `'legacy-category-order'`. Zero behavioral change on its own.
2. **Substation writer amendment (extends PR #127)** — `sheet.ts` +
   `sheet.logic.ts` + `plan-set.logic.ts` edits from §3.2. Once deployed,
   new + modified sheet_versions get `'short-id-ordered'`; copied
   (unchanged) sheets inherit their prior scheme.
3. **Conductor project-downloader** — §3.3 branching + `block-manifest.json`.
   Once deployed, both schemes are correctly rendered and the manifest is
   in every review workspace for the gate to read.
4. **Surveyor mirror** — same §3.3 edits ported to
   `surveyor/src/download.ts`. Off the review critical path; can land
   any time after (1)+(2).
5. **CRC workflow post-processing gate** — §3.4 (option b) in
   `build-crc-review-comments.ts` + `enrich-findings.ts`: read
   `block-manifest.json`, strip legacy/invalid `blockNumber`s.
   **Deliberately before the schema/prompt step:** the gate is a no-op
   while agent output has no `blockNumber`, but shipping the schema
   first would open a window where ungated (legacy/hallucinated)
   `blockNumber`s persist to `review_comments` — the exact dirty rows
   the gate exists to prevent.
6. **Bureau CRC schema + prompt** — add optional `blockNumber` and the
   citation instruction.
7. **Cityhall enhanced modal + URL wiring** — §3.5: lightbox gains block
   highlight, auto-zoom, pan/zoom controls, and the "open sheet" button;
   sheet-page loader hydrates `selectedBlock` from `?block=`. Depends on
   `noetic-aqy` (version-aware sheet URL) landing first. The modal
   enhancements (highlight/zoom/controls) don't depend on `noetic-aqy` —
   only the "open sheet" button does — so the modal work can start
   in parallel.

Chain is unidirectional. Nothing depends on earlier steps until step 7
actually surfaces the deep-link in the UI.

---

## 5. Open questions & TODOs

- [ ] **CHECK constraint on `block_numbering_scheme`.** Enumerate the two
      values, or leave open for future schemes? See §3.1.
- [x] **Enforcement approach for §3.4.** Decided 2026-07-03: post-processing
      gate (option b). Agent always emits `blockNumber`; downstream
      scripts strip it for legacy sheets before persisting.
      Refined same day (audit finding): the gate reads a
      `block-manifest.json` written by the project downloader (§3.3)
      instead of joining to `sheet_version` — the build scripts are pure
      JSON→JSON with no Supabase access — and additionally validates
      `blockNumber` against the sheet's real `short_id` set to catch
      hallucinated-but-plausible integers.
- [ ] **Scope for `review` and `completeness-check`.** Do we want
      block-level deep-linking there too, or CRC-only for the first
      slice? See §3.4 / §3.6.
- [x] **Cityhall sheet-page loader location.** Confirmed 2026-07-03:
      `cityhall/src/routes/(app)/project/[projectId]/plan-set/sheet/[sheetNum]/+page.ts`
      (note: `[sheetNum]`, not `[sheetNumber]`). Block highlight state is
      `selectedBlock` in the sibling `+page.svelte`; blocks render as
      percentage-positioned bbox overlays. Loader must also start
      selecting `content_block.short_id` (absent from current query and
      from the generated DB types — regenerate).
- [ ] **Beads bookkeeping.** Existing issues `noetic-yrn` (epic),
      `noetic-w01` (Phase 1 writer, folded into PR #127), `noetic-gdp`
      (Phase 2 NOT NULL/UNIQUE) still apply. New issues to file for the
      pieces in this plan: sheet_version column migration, substation
      writer amendment, conductor read-side branching, bureau/workflow
      changes, cityhall URL.
- [ ] **Version-aware sheet page URL — `noetic-aqy` (prereq for step 6).**
      Filed 2026-07-03 (audit finding). The sheet page always resolves the
      ACTIVE submission version and short_ids are recomputed per
      sheet_version, so block deep-links silently re-point after any
      resubmission. Add a `?sv={submissionVersionId}` param (sourced from
      `reviews.submission_version_id`) that overrides the existing
      junction resolution in the loader; propagate through prev/next nav.
      The §3.5 URL becomes
      `/plan-set/sheet/{sheetNumber}?block={blockNumber}&sv={submissionVersionId}`.
- [ ] **Rename block-short-id/DEV-PLAN.md's §3.4 note.** The "boilerplate
      filter produces sparse numbering; agent may be confused by gaps"
      TODO in the earlier plan applies verbatim here.
- [ ] **Vision tool integration** (deferred, same as earlier plan).

---

## 6. References

- Previous DEV-PLAN this refines: [`../block-short-id/DEV-PLAN.md`](../block-short-id/DEV-PLAN.md)
- Substation Phase 1 writer PR: https://github.com/noetic-inc/substation/pull/127
- Winston earlier DEV-PLAN PR: https://github.com/wnavey/winston/pull/138
- Session artifact: `/Users/wnavey/noetic/tmp/comment-resolution-check/project-downloader-before/`
  vs `/tmp/comment-resolution-check/project-downloader/` — before/after
  numbering comparison from an ad-hoc conductor project-downloader run
  against project `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, submission_version
  `6b9b85ed-e992-4906-a222-b24ee836910c` (site_plan v4, "Lamar + Collier").
