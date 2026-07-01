# `block-short-id` — Dev Plan

> **Status:** Draft, 2026-07-01. Cross-cutting change spanning `substation`
> (write side), `conductor` (materialization for the review sandbox),
> `bureau` (CRC prompt + schema + downstream scripts), `cityhall` (evidence
> chip → sheet URL), and `surveyor` (mirrored downloader).
>
> Read [`../SPEC.md`](../SPEC.md) for the parent CRC architecture and
> [`../cityhall-ui/DESIGN-SPEC.md`](../cityhall-ui/DESIGN-SPEC.md) §6.2 for
> the `review_comments.output_json.evidenceLocations[]` shape this change
> extends.

---

## 1. Overview

**End goal.** Evidence chips on the CRC review page should open a new tab
onto the exact sheet of the exact submission version the review was run
against, with the referenced content block highlighted.

URL shape we're aiming for:

```
/project/{projectId}/plan-set/sheet/{sheetNumber}?block={blockNumber}
```

Block highlighting on that sheet page already exists — this plan is about
threading a **stable, model-friendly block identifier** end-to-end so the
CRC agent can cite `blockNumber: 3` in `evidenceLocations`, and the UI can
resolve it back to a real `content_block` row.

**Why not just use UUIDs.** Two reasons:

1. Haiku 4.5 running at 30-worker CRC parallelism, dozens of items per run,
   for tens of minutes, will hallucinate UUIDs. Structured-output schema
   validation won't catch format-valid but nonexistent IDs. Enum-constraining
   hundreds of UUIDs per sheet in the schema is not viable.
2. `evidenceLocations` already uses `sheetNumber: int` (not
   `sheet_version_id: UUID`) — see
   `bureau/workflows/comment-resolution-check/schemas/crc.schema.json:45-66`.
   Adding `blockNumber: int` matches the existing pattern.

---

## 2. Current state (findings from session, 2026-07-01)

### 2.1 `content_block` rows have no persisted ordinal

Schema at
`substation/supabase/migrations/00000000000000_baseline.sql:558-568`:

```sql
CREATE TABLE public.content_block (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_version_id UUID NOT NULL REFERENCES public.sheet_version(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT,
  bounding_box JSONB,
  embedding vector(1536),
  embedding_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

No `short_id`, no `ordinal`, no `position`. UUID is the only stable
identifier.

### 2.2 Insertion (substation, one-time per plan_set_version)

`substation/src/inngest/functions/process-file/sheet.logic.ts:73-79`:

```typescript
async function saveBlockDiscoveryResults(supabase, sheetVersionId, blocks) {
  await supabase.from('content_block').delete().eq('sheet_version_id', sheetVersionId);
  for (const block of blocks) {
    await supabase.from('content_block').insert({
      sheet_version_id: sheetVersionId,
      category: block.category,
      description: block.description,
      content: block.content,
      bounding_box: block.boundingBox,   // {x, y, width, height} normalized 0–1
    });
  }
}
```

- LLM returns blocks in arbitrary visual-scan order.
- An in-memory `blockNum = i + 1` is computed but never persisted.
- `bounding_box` shape: `{x, y, width, height}`, normalized 0–1, top-left origin. Clean and sortable.
- Unchanged sheets copy blocks wholesale from a prior sheet_version at `plan-set.logic.ts:161-169`.

### 2.3 Materialization for the agent (conductor, every review run)

`conductor/src/shared/project-downloader.ts` runs at the start of every
review inside the sandbox, downloading site-plan data as markdown for the
agent to navigate.

- `:247-251` fetches blocks from Supabase:
  ```typescript
  .from('content_block')
  .select(...)
  .eq('sheet_version_id', sheetVersionId)
  .order('category', { ascending: true });   // ← alphabetical by category
  ```
- `:593-635` writes `blocks.md` / `block-{N}.md`, computing `blockNum = i + 1`
  from that alphabetical fetch order, after a `!isBoilerplateBlock` filter and
  a large-vs-small size split (`LARGE_BLOCK_CHAR_THRESHOLD = 1500`).

Consequences:

- "Block N" in `blocks.md` is **numbered alphabetically by category**, not
  visually and not by any DB identifier.
- Numbering is recomputed at read time, so it drifts if the boilerplate
  filter, threshold, or query order changes.
- Large blocks land in `block-{N}.md`; small blocks stay in `blocks.md`;
  they share the numbering namespace.

Sample tree from an ad-hoc download we ran during this session (project
`23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, submission_version
`6b9b85ed-e992-4906-a222-b24ee836910c` = site_plan v4, "Lamar + Collier"):

```
/Users/wnavey/noetic/tmp/comment-resolution-check/project-downloader/
├── README.md
├── facts.md
├── primary-site-plan/
│   ├── sheet-01/{guide.md, blocks.md, block-10.md}
│   ├── sheet-02/… (57 sheets total)
│   └── …
└── supplementary-docs/ (14 docs)
```

Note the `block-10.md` alongside `blocks.md` in `sheet-01` — that's the
large-block split.

### 2.4 Surveyor is a mirror, not primary

`surveyor/src/download.ts` has the same read logic (`.order('category')` +
`blockNum = i + 1`). Its header comment says "Synced with
`conductor/src/shared/project-downloader.ts`". Surveyor is invoked for
standalone diligence / local dev flows; the review pipeline (including CRC)
uses conductor's copy. Any change we make must be applied to both to keep
them in sync, but the review-side fix is the conductor edit.

### 2.5 CRC schema does not reference blocks today

`bureau/workflows/comment-resolution-check/schemas/crc.schema.json:45-66`
defines `evidenceLocations[]` as `{ documentId, sheetNumber?, label }`.
There is no `blockNumber` field, and the review prompt at
`bureau/workflows/comment-resolution-check/prompts/review.md` doesn't
instruct the agent to cite blocks. So even if the agent knows "Block 3", it
has nowhere to put that in the output.

---

## 3. Proposed change

Add a stable, per-sheet_version integer ID to `content_block`, computed
deterministically from bounding-box position, threaded through every
downstream reader and writer.

### 3.1 New column: `content_block.short_id`

```sql
ALTER TABLE public.content_block
  ADD COLUMN short_id INT;   -- NULLABLE during backfill, then NOT NULL
CREATE UNIQUE INDEX content_block_short_id_per_sheet_uniq
  ON public.content_block (sheet_version_id, short_id);
```

- `short_id` is `1..N` within each `sheet_version_id`.
- Ordering function: sort by `(bounding_box.y ASC, bounding_box.x ASC, id ASC)`
  — reading order, top-then-left, with `id` as a stable tiebreaker for the
  (rare) case of coincident top-left coordinates.
- Applies to **all** blocks, not just non-boilerplate. Skipped-in-render
  ≠ skipped-in-numbering. The DB row is the ground truth.

### 3.2 Backfill

Deterministic single-shot update, safe to re-run:

```sql
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY sheet_version_id
           ORDER BY
             (bounding_box->>'y')::numeric ASC,
             (bounding_box->>'x')::numeric ASC,
             id ASC
         ) AS rn
  FROM public.content_block
)
UPDATE public.content_block cb
SET    short_id = ordered.rn
FROM   ordered
WHERE  cb.id = ordered.id;
```

**TODO:** verify empirically that `bounding_box->>'y'` and `->>'x'` cast
cleanly to numeric across the whole table. If any rows have a different
shape (legacy formats, nulls), the migration needs a fallback branch.

Once backfilled, add `NOT NULL`:

```sql
ALTER TABLE public.content_block ALTER COLUMN short_id SET NOT NULL;
```

### 3.3 Substation write side

`substation/src/inngest/functions/process-file/sheet.logic.ts:73-79`:

- After receiving blocks from the LLM, sort them using the same
  `(y, x, id-placeholder)` function before writing.
- Assign `short_id = 1..N` in that sorted order.
- Insert with the new column populated.
- Same for `plan-set.logic.ts:161-169` (prior-version copy path): recompute
  `short_id` from the new sheet_version's blocks rather than copying the
  prior row's value, so the invariant "short_id derives from bbox" holds
  even if block extraction changes between versions.

**TODO:** confirm whether the LLM ever returns blocks with identical bounding
boxes. If yes, the tiebreaker needs to be deterministic pre-insert (we don't
have `id` before insert). Options: fall back to insertion order, or hash of
description.

### 3.4 Conductor read side

`conductor/src/shared/project-downloader.ts:248-251, 593-635`:

- Change `.order('category', …)` → `.order('short_id', { ascending: true })`.
- Select `short_id` in the query.
- Delete the `blocks.map((_, i) => i + 1)` re-numbering. Use `block.short_id`
  in every place `blockNum` is used today, including:
  - `blocks.md` headings (`## Block ${short_id}: …`)
  - `block-{short_id}.md` filenames
  - Any references in `guide.md`
- Boilerplate filter still applies to *rendering* (whether to include in
  `blocks.md`) but not to *numbering*. Numbers may be sparse
  (e.g. `Block 1`, `Block 3`, `Block 4` if block 2 was boilerplate). That's
  correct — it matches the DB and lets the agent + UI look up any block by
  short_id without ambiguity.

### 3.5 Surveyor mirror

`surveyor/src/download.ts:247-250, 549-583`: same edit as §3.4. Keep the
two files behaviorally identical.

### 3.6 Bureau CRC prompt + schema

- Schema
  `bureau/workflows/comment-resolution-check/schemas/crc.schema.json:45-66`:
  add optional `blockNumber: integer` to each `evidenceLocations[]` item.
  Optional because full-sheet evidence has no single block.
- Prompt `bureau/workflows/comment-resolution-check/prompts/review.md`:
  instruct the agent to cite `blockNumber` when the evidence is a specific
  block (as opposed to whole-sheet observation). Reference the `## Block N:`
  headings in `blocks.md` and the `block-N.md` filenames.

### 3.7 Bureau downstream persistence

`bureau/workflows/comment-resolution-check/scripts/build-crc-review-comments.ts:52-73, 273-323`
and `scripts/enrich-findings.ts`: pass `blockNumber` through consolidation
into `review_comments.output_json.evidenceLocations[].blockNumber`. Should
be a pass-through — no logic needed if the field is defined in the type.

### 3.8 Cityhall UI

- Evidence chip click handler (currently opens `SheetLightbox.svelte` per
  cityhall-ui DESIGN-SPEC §5.2). New behavior: build URL
  `/project/{projectId}/plan-set/sheet/{sheetNumber}?block={blockNumber}`
  and open in a new tab.
- Sheet page loader
  (`/project/[projectId]/plan-set/sheet/[sheetNumber]/+page.ts` — path
  **TODO: confirm**) reads `?block=` query param, resolves
  `(sheet_version_id, short_id) → content_block.id` server-side, hydrates
  the highlight state.
- Block-highlighting UI already exists on that page — this is a URL param
  wiring change, not a rendering change.

**TODO:** find the current sheet-page component, verify the highlight API,
and confirm how it consumes a `content_block.id` (state store? URL param
already? component prop?).

---

## 4. Migration & rollout order

Because the `short_id` has to be consistent between the DB and every
producer/consumer, order matters:

1. **DB migration + backfill** (substation Supabase). Column is nullable
   until backfill lands, then `NOT NULL`.
2. **Substation write side** — deploy so new inserts carry `short_id`.
3. **Conductor read side** — once (1) and (2) are live, switch the
   downloader to `ORDER BY short_id`. Old cached workspaces are fine to
   discard.
4. **Surveyor mirror** — same edit; not on the review critical path.
5. **Bureau schema + prompt + scripts** — safe to ship any time after (3);
   `blockNumber` is optional, so old runs stay valid.
6. **Cityhall URL wiring** — safe to ship any time after (5). Chips without
   `blockNumber` fall back to the current sheet-level link.

The chain is unidirectional: producers before consumers, DB before both.

---

## 5. Open questions & TODOs

- [ ] **bounding_box empirical check.** Confirm every row's JSONB has
      `{x, y, width, height}` with numeric values. Any exceptions require a
      migration fallback.
- [ ] **Identical-bbox tiebreaker at insert time.** Substation doesn't have
      `id` before insert. Pick a deterministic pre-insert tiebreaker
      (insertion order in the LLM response? content hash?).
- [ ] **Backfill scope.** Almost certainly "all rows" — the old numbering
      was already unstable, nothing durable depends on it. Confirm before
      running.
- [ ] **Large-vs-small block file naming.** Files become `block-{short_id}.md`.
      If two sheets both have a `Block 7`, that's fine (different dirs).
      Numbers may skip (e.g. Block 7 is large → own file, Block 8 is small
      → back in `blocks.md`). Verify this reads sensibly to the agent.
- [ ] **Boilerplate filter interaction.** Sparse numbering (§3.4). Confirm
      the agent isn't confused by gaps. If it is, consider a per-sheet
      "block N was omitted (boilerplate)" line, though that seems like
      overkill.
- [ ] **Vision tool.** The CRC vision tool takes `documentId` +
      `sheetNumber` today. Should it accept `blockNumber` and pre-crop to
      the block's bounding box? Nice-to-have, not blocking.
- [ ] **Cityhall sheet-page loader.** Locate the current file, confirm the
      highlight state API. See §3.8.
- [ ] **Backwards compat for existing CRC runs.** Old `review_comments`
      rows have no `blockNumber`. Chips render as today (sheet-level link,
      no `?block=` param). Confirm no code path assumes the field exists.
- [ ] **Non-CRC review pipelines.** The same fragility (unstable block
      numbers in `blocks.md`) affects every other review workflow that
      uses `project-downloader.ts`. This change fixes them for free —
      worth calling out in the shipping notes so other teams know.

---

## 6. References

- Session artifact: ad-hoc downloader
  `conductor/scripts/download-site-plan-ad-hoc.ts` (written 2026-07-01 to
  verify the current downloader output shape).
- Sample output tree:
  `/Users/wnavey/noetic/tmp/comment-resolution-check/project-downloader/`
  (project `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, submission_version
  `6b9b85ed-e992-4906-a222-b24ee836910c`, site_plan v4).
- Parent architecture: [`../SPEC.md`](../SPEC.md).
- Adjacent design: [`../cityhall-ui/DESIGN-SPEC.md`](../cityhall-ui/DESIGN-SPEC.md)
  §5.2, §6.2 (evidenceLocations shape).
