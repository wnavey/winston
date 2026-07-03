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

## 1. Overview

**End goal (unchanged from block-short-id).** CRC evidence chips deep-link
to a specific content block on a specific sheet:

```
/project/{projectId}/plan-set/sheet/{sheetNumber}?block={blockNumber}
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
  join to `sheet_version` and check `block_numbering_scheme`. If
  `'legacy-category-order'`, strip `blockNumber` from the emitted
  evidenceLocation.
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

### 3.5 Cityhall URL wiring

- Evidence chip click handler resolves `?block={blockNumber}` against
  `content_block` for the sheet_version. If no `blockNumber` present
  (legacy sheet or agent didn't cite one), fall back to the sheet-level
  URL.
- No change needed to gate on scheme here if (b) is used at review-save
  time — legacy sheets simply won't have `blockNumber` in their
  `review_comments` rows.
- **TODO:** locate the current sheet-page loader
  (`/project/[projectId]/plan-set/sheet/[sheetNumber]/+page.ts` — path
  to confirm) and hook `?block=` into the existing highlight state.

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

---

## 4. Rollout order

1. **Column migration** — `ALTER TABLE public.sheet_version ADD COLUMN
   block_numbering_scheme …`. Idempotent, defaults all existing rows to
   `'legacy-category-order'`. Zero behavioral change on its own.
2. **Substation writer amendment (extends PR #127)** — `sheet.ts` +
   `sheet.logic.ts` + `plan-set.logic.ts` edits from §3.2. Once deployed,
   new + modified sheet_versions get `'short-id-ordered'`; copied
   (unchanged) sheets inherit their prior scheme.
3. **Conductor project-downloader** — §3.3 branching. Once deployed, both
   schemes are correctly rendered.
4. **Bureau CRC schema + prompt** — add optional `blockNumber` and the
   citation instruction.
5. **CRC workflow post-processing gate** — §3.4 (option b) in
   `build-crc-review-comments.ts` + `enrich-findings.ts`.
6. **Cityhall URL wiring + sheet-page loader** — §3.5.

Chain is unidirectional. Nothing depends on earlier steps until step 6
actually surfaces the deep-link in the UI.

---

## 5. Open questions & TODOs

- [ ] **CHECK constraint on `block_numbering_scheme`.** Enumerate the two
      values, or leave open for future schemes? See §3.1.
- [x] **Enforcement approach for §3.4.** Decided 2026-07-03: post-processing
      gate (option b). Agent always emits `blockNumber`; downstream
      scripts strip it for legacy sheets before persisting.
- [ ] **Scope for `review` and `completeness-check`.** Do we want
      block-level deep-linking there too, or CRC-only for the first
      slice? See §3.4 / §3.6.
- [ ] **Cityhall sheet-page loader location.** See §3.5.
- [ ] **Beads bookkeeping.** Existing issues `noetic-yrn` (epic),
      `noetic-w01` (Phase 1 writer, folded into PR #127), `noetic-gdp`
      (Phase 2 NOT NULL/UNIQUE) still apply. New issues to file for the
      pieces in this plan: sheet_version column migration, substation
      writer amendment, conductor read-side branching, bureau/workflow
      changes, cityhall URL.
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
