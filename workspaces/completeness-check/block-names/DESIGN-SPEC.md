# Block names: a drafter-style name on every content block

**Status:** Draft v1
**Date:** 2026-09-29
**Companion:** `block-names.html` (same folder): the diagrams for everything below.
**Prompted by:** the CC PDF redesign (Will's mockup, 2026-09-29): evidence chips read `S37 · Site Details (1 of 2) · Block 4`, and the report goes to the City of Austin as a PDF with no link back to the app, so "Block 4" is meaningless to its reader.
**Repos touched:** `substation` (one column, the publish RPC, the carry-forward copy, both search RPCs, generated types), `bureau` (the preprocessing-v4 sheet reader emits `name`; the assemble → normalize → publish chain carries it; a new `name-blocks` backfill runbook; conductor-side and Python-side workspace renderers show it), `conductor` (block select + `blocks.md` rendering + manifest), `cityhall` (lightbox title, sheet page, evidence-chip name; generated types), `inspector-general` (artifact type + one parity check).
**Repos NOT touched:** `claude-plugins`, `radar`, `navalbase`, `quarry`, `dsd` (the RDS chip partial is the PDF-redesign spec's job; this spec only makes the name available to it).

---

## 1. Problem

### 1.1 The chip cites an internal number

Every review comment cites its evidence as `sheetReferences[] = {documentId, sheetNumber, blockNumber?, label}` (bureau `workflows/completeness-check/schemas/completeness.schema.json:69-93`; the CRC twin `crc.schema.json:49-66` is the same shape). `blockNumber` is `content_block.short_id`, a reading-order ordinal `1..N` per sheet version (substation migration `20260701140000_add_content_block_short_id.sql`). In the app that number is a deep-link target: `SheetLightbox.svelte:243-287` walks `submission_plan_set → plan_set_version → sheet_version → content_block(short_id, bounding_box)` and draws the box. It is never meant to be read.

The Completeness Check PDF is the one surface where it has to be read. The report is issued to the City of Austin as a PDF; there is no app to click through to. The redesign mockup wants each sheet chip to say *where on the sheet* the evidence is: `S37 · North & East Overall Elevation · title block`, not `· Block 4`.

### 1.2 What a block carries today

`public.content_block` (substation `supabase/migrations/00000000000000_baseline.sql:555-579`, plus `short_id`) stores, per block: `category`, `description`, `content`, `bounding_box`, `embedding`, `embedding_text`, `short_id`. No name, no location word. Checked against Lamar + Collier v4 (`submission_version 6b9b85ed-…`, project `23301a8a-…`) on 2026-09-29:

| Sheet · block | category | description (verbatim, truncated) | bbox x, y |
|---|---|---|---|
| S1 · 2 | table | "A comprehensive index of all sheets in the plan set, listing sheet titles and their corresponding sheet numbers (from 01 to 52)." | 0.80, 0.07 |
| S1 · 10 | seal | "The seal and signature of the engineer, Shelly Mitchell, certifying the engineering work." | 0.62, 0.74 |
| S1 · 12 | form | "A form for releasing the site plan, including case number, application date, approval status (administratively or by commission), and expira…" | 0.84, 0.80 |
| S14 · 5 | table | "Table defining compatibility setback lines and allowable building heights based on distance from the property line." | 0.69, 0.46 |
| S29 · 5 | diagram | "Cross-section showing the detention vault, sedimentation basin, overflow weir, and concrete bottom with elevations." | 0.04, 0.53 |
| S55 · 9 | notes | "A certificate signed and sealed by a Registered Professional Land Surveyor, certifying the accuracy of the plat and survey." | 0.38, 0.80 |

`description` is one or two sentences of prose (prod averages: `text_block` 91 chars, `table` 149, `diagram` 167, `drawing` 309). It has the right semantics and the wrong shape for a chip. `category` is semi-controlled: the v4 reader enumerates 11 values (`title_block, drawing, diagram, text_block, notes, table, form, legend, doc_embed, seal, other`, `steps/2.2-sheets/steps/read/contract.test.ts:11`), but prod carries about 150 distinct values from older pipelines (`revision_block`, `north_arrow`, `key_map`, `standard-detail`, …). Prod size on 2026-09-29: **17,723 blocks** across 1,655 sheet versions; 3,338 of them (284 sheet versions) come from the 20 registered v2/v4 runs, the rest from the legacy Inngest pipeline.

### 1.3 The name already exists, informally

The v4 sheet reader is already asked for it twice, and throws it away both times:

- Read 3's description rule (`steps/2.2-sheets/steps/read/prompt.md:88`): *"Include labels and callout numbers ("DETAIL 3-A: Valley Gutter", "General Notes", "Site Plan") and any keyword a review agent would search for."* The name is buried in the sentence.
- Read 4's reading guide (`prompt.md:107`): *"Block 3: diagram — Outlet Structure Detail"*. The phrase after the dash is a name. The contract parses only `Block N: <category>` (`contract.test.ts:98`), so the phrase is free text that nothing stores.

Review agents cite it a third way: roughly half of today's evidence labels already carry an element name after the sheet title ("Cover Sheet, Sheet Index block"; "Dimensional Control & Site Plan, Compatibility Setback Table"), written from the same `blocks.md` heading. Nobody asked for it consistently, so it is there about half the time.

### 1.4 How reviewers name a place on a sheet

Drafting practice names the element, not the position: the **title block** (the strip along the right or bottom carrying firm, seal, sheet number and the revision block), the **legend**, the **notes** column, **key map**, **north arrow**, and **details** by number. Austin's own reviewers, in the requirements behind the CRC v5 run (`review ed5e7ba9-…`), write "the Site Plan Approval block on the cover sheet", "in the Legend", "on detail conforming to City standard 430S-1", and reach for position only when the element has no name ("in the lower right-hand corner reserved for the permitting batch stamp"). The National CAD Standard's coordinate grid ("A1") only works when the set draws the grid, which Austin civil sets do not; "NW quadrant" is a site-geography term and would read as a place on the ground. So the chip's third segment is a **name**, and position words are a fallback the renderer can derive from the bounding box, not something to store.

---

## 2. Decisions

**D1. One nullable column.** `public.content_block.name text NULL`. No CHECK, no uniqueness, no index. Nullable because 17,723 existing rows have no name until the backfill runs, and because the legacy Inngest writer (D8) keeps inserting without one.

**D2. The name rule.** A short noun phrase a drafter would use for the element, in Title Case, 2–6 words: the element's **printed heading when it has one** ("Sheet Index", "General Notes", "Legend", "Meter Notice", "Compatibility Setback Table", "Detail 3-A Valley Gutter"), otherwise the **drafter's name for what it is** ("Engineer's Seal", "Site Plan Release Form", "Revision Table", "Vicinity Map", "Curve Table"). Never `Block N`, never the sheet's own title, never a sentence, never this runbook's process vocabulary (`AGENTS.md` rule 16 applies to `name` as it does to `description`). A bare category word ("Notes") is allowed only when the block really has no heading and no better name. The full rule text is §3.1 and is shared by the v4 reader prompt and the backfill prompt (D9).

**D3. Produced in Read 3 of the v4 sheet reader, next to `description`.** Read 2a (discover) only sees the whole sheet at low resolution and records `category` + a rough box; Read 3 (transcribe) reads each block from a 300-DPI crop, which is where the printed heading is legible. `name` is **required, non-null** in the reader's output contract (`contract.test.ts:15-20` `Block` zod object gains `name: z.string().min(1).max(60)` plus a Title Case check modelled on the `label` rule at lines 84-87). In the published artifact schema it is `["string","null"]` and **not required**, so artifacts written before this spec still validate (§4).

**D4. The name flows through the assemble → normalize → publish chain by explicit addition at every whitelist.** Four places silently drop unknown block keys today and each is edited: `assemble.py:34` `BLOCK_KEYS`, `lib/parity.ts` `RawBlock`/`OrderedBlock` + `normalizeAndOrderBlocks`, `normalize.ts:42-50`, `lib/artifact.ts` `ArtifactBlock`; and `artifact-schema.json` `definitions/block` (`additionalProperties:false` at line 59) gains the property. `preprocessing-v3/artifact-schema.json` is byte-identical and v3 runs v4's `scripts/`, so it gets the same edit (§4).

**D5. `embedding_text` does not change.** It is a pinned parity contract with substation and IG (`lib/embeddings.ts:1-14`: `text = content ? \`${description}\n${content}\` : description`), and changing it means re-embedding every block for consistency. The name is returned by the search RPCs (D11) but not embedded. Revisit as Q1.

**D6. The reading guide's block phrase is the name.** Read 4's `"Block 3: diagram — Outlet Structure Detail"` (`prompt.md:107`) becomes `"Block 3: <name> (diagram)"` so the guide, `blocks.md` and the chip all say the same words for the same block.

**D7. Publish inserts it; carry-forward copies it.** `publish_preprocessing_run.sql:185-197` adds `name` to the column list and `NULLIF(b->>'name','')` to the SELECT. `plan-set.logic.ts:168` selects it and `:195-204` copies it onto the new sheet version. Publish stays clear-then-apply; a v4 artifact with names re-publishes with names.

**D8. The legacy Inngest block writer is not taught to name.** `sheet.logic.ts:150-170` keeps inserting `name = NULL`. That path is the pre-runbook pipeline; blocks it creates get names from the backfill (D9), which can be re-run at any time over `name IS NULL`. Q2 asks whether to retire this position later.

**D9. Backfill = a bespoke `name-blocks` runbook, not a partial preprocessing-v4 run.** A scoped v4 run cannot do it (§6.1): v4 has no from-step or re-caption mode, every in-scope sheet gets all four reads from pixels on Opus (2 h budget per sheet, `runbook.yaml:11`), and staging the existing blocks is barred by design (`steps/1.2-stage/step.yaml:6-7`, core rule 19). The backfill reads existing rows, names them with the same rule (§3.1) on a Sonnet-class model, validates, and writes by id. It never touches boxes, descriptions or embeddings.

**D10. The backfill also patches the stored artifact of every registered run it names.** Publish clears and re-inserts blocks (`publish.ts:14-15`, README:72), so a re-publish of a registered run from its stored `artifact.json` (`publish.ts --run <id>`) would wipe DB-only names. The backfill writes `name` into the artifact's `sheets[].content_blocks[]` by `short_id` for the 20 registered runs (3,338 blocks) and re-uploads it; the other 14,385 blocks have no artifact to keep in sync.

**D11. Consumers resolve the name from the database at render time; the agent's `label` does not change.** The block name is canonical data, so chips, the lightbox title and the PDF read it from `content_block` (or from a `blockName` the bureau gate stamps onto `sheetReferences` from the manifest, §7.3) rather than asking the review agent to write it into `label`. `blocks.md` headings render the name so agents see it, which improves the labels they already write, but nothing downstream depends on that.

**D12. Both search RPCs return `name`.** `search_content_blocks_hybrid` / `_keyword` gain a `name text` column in `RETURNS TABLE`. Adding a column changes the return type, which `CREATE OR REPLACE` rejects, so the migration drops and recreates both, then restores the grants, `search_path` and ownership that three later migrations set (§5.4). `name` is **not** added to the tsvector or the GIN index (Q1).

**D13. IG's run-validation suite checks the name.** `inspector-general` `preprocessing-validation.ts` adds: every v4 artifact block has a non-empty `name` that passes the rule's mechanical checks (word count, Title Case, no `Block N`), and artifact `name` equals DB `name` after publish.

---

## 3. The name

### 3.1 The rule (shared prompt fragment)

Lives once, at `bureau/runbooks/lib/block-name-rule.md`, and is included verbatim by the v4 reader prompt (Read 3) and the backfill prompt (§6.2). Text:

```
name — a short noun phrase a plan reviewer would use to point at this element on the sheet.
  · 2–6 words, Title Case, no trailing period.
  · Use the element's PRINTED HEADING when it has one, as printed: "Sheet Index",
    "General Notes", "Legend", "Meter Notice", "Compatibility Setback Table",
    "Detail 3-A Valley Gutter", "Erosion Control Notes".
  · Otherwise use the drafter's name for what it is: "Engineer's Seal", "Surveyor's
    Certificate", "Site Plan Release Form", "Revision Table", "Vicinity Map", "Curve Table",
    "North Elevation", "Sheet Layout Key Map".
  · Never "Block N", never the sheet's own title, never a sentence, never our process
    words (block, crop, read, step, contract). A bare category word ("Notes", "Table") only
    when there is truly no heading and nothing better to call it.
  · Two blocks on one sheet may share a name only when they are genuinely the same kind of
    element ("General Notes" continued in a second column); otherwise qualify them
    ("General Notes 1–11", "General Notes 12–20").
```

### 3.2 What the rule produces on real blocks

Applied by hand to the §1.2 rows, so the reader can judge the target:

| Sheet · block | category | name |
|---|---|---|
| S1 · 2 | table | Sheet Index |
| S1 · 10 | seal | Engineer's Seal |
| S1 · 12 | form | Site Plan Release Form |
| S14 · 5 | table | Compatibility Setback Table |
| S29 · 5 | diagram | Detention Vault Section |
| S55 · 9 | notes | Surveyor's Certificate |

And the chip the PDF redesign wants, composed at render time from data this spec makes available: `S{sheet_number} · {sheet_version.label} · {content_block.name}` → `S14 · Dimensional Control & Site Plan (1 of 2) · Compatibility Setback Table`. When `name` is null (pre-backfill rows, legacy-writer rows) the renderer falls back to the agent's label, then to a position word derived from `bounding_box` ("lower right"); neither fallback is stored.

### 3.3 Mechanical checks (the contract and the backfill validator share them)

- non-empty, ≤ 60 characters, 2–6 whitespace-separated words (a single word passes only if it is a heading-like category word: Legend, Notes, Table, Seal, Schedule);
- Title Case: no word starts lower-case except articles/prepositions inside the phrase (`of`, `and`, `for`, `to`, `the`, `on`, `in`);
- does not match `/\bblock\s*\d/i`, does not equal the sheet's `label` case-insensitively, contains none of `crop|read \d|step|contract|worker`;
- not a sentence: no terminal period, fewer than 7 words.

---

## 4. The preprocessing-v4 path

One agent step produces blocks and four scripts carry them to the database. Nothing else in the runbook changes. Paths are under `bureau/runbooks/preprocessing-v4/`.

| # | Where | Today | Change |
|---|---|---|---|
| 1 | `steps/2.2-sheets/steps/read/prompt.md:84-92` (Read 3) | records `description`, `content` per block | add the `name` bullet = the §3.1 fragment (`@include` or pasted verbatim, matching how `AGENTS-core.md` is prepended) |
| 2 | `prompt.md:136-139` (`content_blocks` JSON example) | `{category, description, content, bounding_box}` | `{category, name, description, content, bounding_box}` |
| 3 | `prompt.md:107` (Read 4 reading guide) | `"Block 3: diagram — Outlet Structure Detail"` | `"Block 3: Outlet Structure Detail (diagram)"` (D6) |
| 4 | `steps/2.2-sheets/steps/read/contract.test.ts:15-20` | `Block = z.object({category, description, content, bounding_box})` | `+ name: z.string().min(1).max(60)`; a Title Case test like `:84-87`; the §3.3 mechanical checks |
| 5 | `scripts/assemble.py:34` | `BLOCK_KEYS = ("category","description","content","bounding_box")` (used at `:80`, drops everything else) | `+ "name"` |
| 6 | `scripts/lib/parity.ts:35-48, 73-97` | `RawBlock`/`OrderedBlock` and `normalizeAndOrderBlocks` rebuild each block from named fields | `+ name: string \| null` on both types; copy it in the map |
| 7 | `scripts/normalize.ts:42-50` | explicit field copy into the artifact block | `+ name: b.name ?? null` |
| 8 | `scripts/lib/artifact.ts:14-22` | `ArtifactBlock` (the comment says "keep the two in sync") | `+ name: string \| null` |
| 9 | `artifact-schema.json:56-79` (`definitions/block`, `additionalProperties:false`) and the byte-identical `preprocessing-v3/artifact-schema.json` | rejects unknown fields | `+ "name": {"type":["string","null"]}`, not added to `required` (D3) |
| 10 | `scripts/lib/embeddings.ts:24-32` `buildBlockEmbeddingText` | `description \n content` | **unchanged** (D5) |
| 11 | `scripts/publish.ts:125-132` / `publish_step.py:61-68` | hand the artifact to `publish_preprocessing_run` | unchanged; the RPC reads the new key (§5.2) |

`validateArtifact` (`scripts/lib/artifact.ts:79-135`, called from normalize/embed/publish) checks known fields only and does not reject `name`; the JSON Schema is enforced by IG's suite, not by bureau (D13). The cloud publish path's zod shape in substation (`src/lib/publish/preprocessing-v4.ts:32-38`) uses `.passthrough()` on sheets and needs no change.

Cost: zero extra tokens of any consequence; Read 3 already has the heading in front of it. Output grows by one short string per block.

---

## 5. Storage

### 5.1 The column

Migration `substation/supabase/migrations/20260930000000_content_block_name.sql`, in the style of `20260701140000_add_content_block_short_id.sql` (header comment naming this spec, idempotent):

```sql
ALTER TABLE public.content_block ADD COLUMN IF NOT EXISTS name TEXT;
COMMENT ON COLUMN public.content_block.name IS
  'Drafter-style name of the element (2–6 words, Title Case): the printed heading when there is one, else what a plan reviewer would call it. Written by preprocessing-v4 Read 3 and the name-blocks backfill; NULL on legacy-writer rows until backfilled. Rule: bureau/runbooks/lib/block-name-rule.md.';
```

No index (nothing filters on it), no CHECK (the rule is enforced upstream in the reader contract and the backfill validator; a CHECK would make a legacy row unpublishable over a spelling).

### 5.2 The publish RPC

`supabase/functions/publish_preprocessing_run.sql:185-197`: `name` joins the column list; `NULLIF(b->>'name','')` joins the SELECT. `schema_version` stays 1 (line 67): the field is additive and nullable. This file ships through `pnpm db:apply-functions`, not a migration, so the prod apply is the same manual step every function edit takes today (and the migration tracking table needs the usual hand repair afterwards, since SQL-editor applies record nothing).

### 5.3 The carry-forward copy and the legacy writer

- `src/inngest/functions/process-file/plan-set.logic.ts:168` `.select('id, category, description, content, bounding_box')` → `+ name`; `:195-204` insert map → `+ name: b.name`. Without this, an unchanged sheet carried onto a new plan-set version silently loses its name.
- `sheet.logic.ts:150-170` (legacy discovery) is left alone (D8).

### 5.4 The search RPCs

`search_content_blocks_hybrid` (`20260802221718_remote_schema.sql:680-736`) and `_keyword` (`:738-770`) gain `name text` after `category` in `RETURNS TABLE`, `cb.name` in the scoped CTE / select, `sb.name` in the final select. Because the return type changes, the migration must `DROP FUNCTION` both signatures and recreate them, then re-apply what later migrations set on them: `GRANT EXECUTE … TO authenticated, service_role`, the `workflow_run` grants (`20260711000000_workflow_run_role_and_rls.sql:153-156`), `SET search_path` (`20260709130003_function_search_path_and_vector.sql:75,161`) and the extensions pinning (`20260716000000_grant_extensions_usage_workflow_run.sql`). `supabase/functions/search_content_blocks.sql` is edited to match so the two definitions don't drift.

### 5.5 Generated types

| Repo | File | Regenerate |
|---|---|---|
| substation | `src/types/database.types.ts` (content_block 618-660, RPCs 3767-3810) | `pnpm gen-types` |
| conductor | `src/shared/database.ts:426` (already missing `embedding`/`embedding_text` and the RPCs, so it is stale anyway) | `npm run gen:types` |
| cityhall | `src/lib/types/database.ts:623` | `bun run db:types` |
| bureau | `tooling/src/types/database.types.ts:420` (hand-copied; missing `short_id`) | hand-edit |

RLS: nothing column-specific on `content_block` (baseline 1556-1564, `20260711…:219-230`); the column is readable everywhere the row is.

---

## 6. Backfill

### 6.1 Why not a partial preprocessing-v4 run

Three facts about v4 rule it out (bureau `runbooks/preprocessing-v4/`):

1. **There is no partial mode.** The request contract (`steps/1.1-inputs/contract.test.ts:11-37`) has `scope.sheets`, `scope.tracks`, `scope.documents`, `publish`, `directives`; no from-step, no "re-caption only". The only re-read path is `revise` at the 3.3 gate (README:61-70), which re-runs a sheet's reader in full over its prior `sheet.json` inside the same run folder.
2. **Every in-scope sheet is read from pixels, four reads, on Opus** (`runbook.yaml:11`, 2 h budget per sheet). Naming 1,655 sheet versions that way is a full re-preprocessing of the corpus to add one field.
3. **Staging existing blocks is barred by design.** `steps/1.2-stage/step.yaml:6-7`: *"The prior reading of this submission (summaries, labels, guides, blocks) is deliberately NOT staged: it is a previous run's answer (core rule 19)"*; `scripts/stage.py:21-24` says the same. A reader that could see the blocks it is supposed to name would be anchored, which is exactly what v4's comparison discipline forbids.

So the organic path (D3) names every block **from now on**, and a separate, cheap, read-the-rows-and-name-them runbook covers **everything before now**. The two share one rule (§3.1) so their output is indistinguishable.

### 6.2 The `name-blocks` runbook

`bureau/runbooks/name-blocks/`, conductor2-shaped like `smoke/` (runner presets in `runbook.yaml`, one `steps/*/step.yaml` per step, fan-out with `foreach`). Zero-token script steps bracket one cheap model step.

| Step | runner | What it does | Output |
|---|---|---|---|
| `1.1-inputs` | none | `request.json`: `{scope: "unnamed" \| {submission_version_ids[]} \| {sheet_version_ids[]}, publish: {allowed}, patch_artifacts: bool}` | `request.json` |
| `1.2-roster` | script | Reads `sheet_version` + `sheet.label` + `content_block(id, short_id, category, description, content, bounding_box)` for every sheet version in scope where any block has `name IS NULL` (`runbooks/lib/submission_db.py:266-282` `content_blocks()` already does the block read). Writes one item file per sheet version with `content` capped at 1,500 chars per block. | `items/<sheet_version_id>.json` |
| `2.1-name/<sheet_version_id>` | `namer` = `{harness: gateway, model: <Sonnet-class>}` | One call per sheet version: the §3.1 fragment + the sheet label + the block list (short_id, category, description, content head, bbox as "upper-left / right margin / …" words). Returns `{ "<block id>": "<name>" }` for every block. Sees the whole sheet's blocks at once so sibling blocks get distinct names (rule's last bullet). | `names.json` |
| `2.2-check` | script | §3.3 mechanical checks per name; a failure rewrites the offender as `null` and lists it in `check.md`; a sheet with > 20 % failures is voided back to `2.1-name` once (`conductor void … --findings`) with the failures as notes. | `checked/<sheet_version_id>.json`, `check.md` |
| `2.3-hitl` | none | A sample: 30 random (sheet, block, name) rows with the block crop path, plus the failure list. `approved \| revise`. Skippable by `directives.decide` for unattended runs after the first few. | `decision.md` |
| `3.1-apply` | script, `control_plane: true` | `PATCH content_block?id=eq.<id> {name}` through PostgREST with the service role, 200 rows per batch, idempotent (`name IS DISTINCT FROM` guard in a preceding read). For every touched `sheet_version.preprocessing_run_id`, download that run's `artifact.json` from `runbook_output_storage_path`, set `sheets[].content_blocks[].name` by `short_id`, re-upload (D10). | `apply-record.json` |

Roster and cost, from prod on 2026-09-29: 1,655 sheet versions, 17,723 blocks, average 10.7 blocks per sheet version, `content` averaging 611 chars. With content capped at 1,500 chars a sheet call is roughly 5 k input tokens and 200 output, so the whole corpus is on the order of **8 M input tokens**: tens of dollars at Sonnet-class pricing, single digits on a Haiku-class model (Q3). Wall-clock is bounded by concurrency, not tokens; 1,655 short calls at 10-wide fan-out is under an hour.

Rule-19 posture: this runbook's input **is** Noetic's prior output, by design; it derives a label from a transcription, it does not answer a review question. Under the per-runbook conventions spec (winston#285) it declares the core fragments it takes and leaves the answer-bar fragment out; until that lands, its `AGENTS.md` says so in one line.

### 6.3 Re-runs and drift

- Re-running with `scope: "unnamed"` is the standing way to name legacy-writer rows (D8) and any sheet version whose publish landed a null name. It is idempotent.
- A v4 re-publish of a registered run restores the artifact's names (D10). A **legacy** carry-forward (`plan-set.logic.ts`) copies names (D7). The only path that reintroduces nulls is the legacy discovery writer, which the standing re-run covers.
- Names are not versioned. A re-run over `scope: {sheet_version_ids}` overwrites; the apply record keeps the previous value for audit.

---

## 7. Consumers

Every reader of `content_block` that shows a block to a person or an agent. Nothing here changes behaviour when `name` is null; each site falls back to what it shows today.

### 7.1 Review-agent workspaces (two builders, same rendering)

| Builder | Select | Rendering | Manifest |
|---|---|---|---|
| conductor `src/shared/project-downloader.ts` | `:371-373` `+ name`; `ContentBlockRow:64-74` | `writeSheet:955-976`: `## Block N: {name} ({category}) — {description}`; large-block file title likewise; `guide.md` footer `:1025-1031` | `BlockManifestSheet:82-104` `+ blockNames?: Record<short_id, name>`; written at `:459-462` |
| bureau `runbooks/lib/` (Python stager) | `submission_db.py:266-282` `+ name` | `workspace.py:226-230, 236-242, 414-415` same heading | `stage_submission.py:912-933` same field |

The heading is what the review prompts tell agents to cite (`blockNumber` "from the `## Block N:` labels", CC `prompts/review.md:193`, CRC `:213`), so the name is in front of the agent when it writes `label`.

### 7.2 Semantic search

`workflows/completeness-check/scripts/semantic-search-blocks.ts` (the CRC twin is byte-identical): `HybridResult:163-176` / `KeywordResult:178-189` `+ name`; the `formatted` object the agent sees (`:265-281`) and the `resultSummary` sidecar (`:297-303`) print it. While there, return `short_id` too, so a search hit is citable as `blockNumber` without re-opening `blocks.md` (today the tool returns a UUID `blockId` the agent cannot cite; noted in the evidence-chips memory as a shared gap). Tool-description text: `comment-resolution-check/schemas/semantic-search-blocks.tool-schema.json:2`, CC `prompts/review.md:28`, CRC `:86`.

### 7.3 The evidence gate stamps `blockName`

`block-number-gate.ts` (CC `scripts/`, CRC twin) already loads `block-manifest.json` and validates `blockNumber` against `validBlockNumbers`. With `blockNames` in the manifest (§7.1), `toSheetRef` (`build-review-comments.ts:214-222`; CRC `build-crc-review-comments.ts:284-295`) stamps `blockName` onto each gated sheet reference. `review_comments.output_json.sheetReferences[]` then carries `{documentId, sheetNumber, blockNumber, blockName, label}` with no DB lookup at read time. Types that carry the ref: `enrich-findings.ts:39-41`, `apply-forced-outcomes.ts:67`, `cross-run-consolidate-cc.ts:71`, `build-review-comments.ts:23,164`, and the CRC equivalents.

### 7.4 cityhall

- `src/lib/plan-set/SheetLightbox.svelte:271-281` `resolveBlockBbox`: select `content_block(short_id, bounding_box, name)`; keep `blockName` in state; header `:314-316` renders `{label} · {blockName}` when present.
- `plan-set/sheet/[sheetNum]/+page.ts:144, 164-185`: select and map `name`; `+page.svelte` block lists (`:574-590, 692-702, 718-734`) show the name above the category chip; the bbox overlay (`:493-520`) gets it as a `title` tooltip.
- `review/EvidenceChips.svelte` (cityhall#714, merged 2026-09-29): sheet chip renders `S{n} {label}` today; with `blockName` on `SheetReference` (`review/types.ts:1-14`, parsers `[reviewId]/+page.ts:968-989` and `[sectionId]/+page.ts:43-56`) it renders `S{n} {label} · {blockName}`. No lookup: the name arrives in `output_json` (§7.3).
- Chat tools that print blocks (`src/lib/tools/project/semantic-search.ts:57,86`, `get-doc-details.ts:63-79`) print the name first.

### 7.5 The CC PDF (substation)

`src/pdf/cc-report-logic.ts:21-25` `CcSheetReference` `+ blockNumber?, blockName?`; `cc-report-data.ts:89-104` `parseSheetRefs` keeps both instead of dropping `blockNumber`; `completeness-check-report.tsx:108-115` composes `S{n} · {label} · {blockName}` per reference (today: `Reference Docs: ` + labels joined). The RDS chip partial that draws it belongs to the PDF-redesign spec; this spec only guarantees the data is on the ref. Because §7.3 stamps `blockName` at write time, the PDF needs no extra query for new reviews; for reviews written before P2, the renderer's fallback is the agent label.

### 7.6 inspector-general

`src/lib/types/preprocessing.ts:18-26` `PreprocessingBlock + name?`; `preprocessing-validation.ts:81-100` (artifact checks) and `:258-291` (DB parity) implement D13; `routes/api/preprocessing/compare/+server.ts:86-89` selects it for the compare UI.

---

## 8. Rollout

| Phase | Repo | Content | Depends on |
|---|---|---|---|
| **P0** | substation | §5.1 migration · §5.2 publish RPC · §5.3 carry-forward · §5.4 search RPCs (drop + recreate + regrant) · `pnpm gen-types`. Apply migration + functions to prod; repair the tracking table if applied by hand. | — |
| **P1** | bureau | §3.1 rule fragment · §4 rows 1–9 (reader prompt, contract, assemble, parity, normalize, artifact type, both schemas) · §7.1 Python stager · §7.2 search script · §7.3 gate + build scripts (CC and CRC twins). One PR; one v4 run on Will's test project (`ed9e7ec4-…`, never the ground-truth Lamar project) to see `name` land in `content_block`. | P0 deployed |
| **P2** | conductor | §7.1 downloader select, rendering, manifest · `gen:types`. | P0 |
| **P3** | bureau | §6.2 `name-blocks` runbook. First run: `scope: {submission_version_ids: [Lamar + Collier v4]}` with the HITL sample; then `scope: "unnamed"` over the corpus with `patch_artifacts: true`. | P0, P1 (shares the rule fragment) |
| **P4** | cityhall · substation PDF · IG | §7.4 · §7.5 · §7.6; `db:types`. Ships behind nothing: every site is null-tolerant. | P0; P3 for names to show on old reviews |

Deploy order that matters: **P0 before P1** (a v4 publish carrying `name` against a database without the column fails the INSERT); **P0 before P2/P4** (selecting a column that does not exist errors). P3 and P4 are independent of each other.

---

## 9. Open questions

**Q1. Should `name` be searchable?** Not embedded (D5) and not in the tsvector (D12) in v1. Adding it to the keyword tsvector and the GIN index (`COALESCE(name,'')`) is cheap and the hybrid RPC's keyword leg would then find "Meter Notice" by its heading. Recommend: yes, as a P0 follow-up once names exist, so the index isn't built over nulls.

**Q2. Retire the legacy Inngest block writer's exemption (D8)?** If the Inngest plan-set path is still creating sheet versions in prod after PPv2 is the default, teach `sheet.logic.ts` to name (its block-details prompt already writes `description`). Recommend: no until preprocessing-v2 cutover is confirmed; the standing backfill re-run covers it.

**Q3. Backfill model.** Sonnet-class on the gateway is the safe default; the task is short-text labelling from a transcription and Haiku-class may be adequate at a fifth the cost. Recommend: run the Lamar + Collier first pass on both, compare in the HITL sample, pick.

**Q4. Title Case vs as-printed.** Sheets print headings in caps ("METER NOTICE"). D2 normalises to Title Case to match `sheet_version.label`'s existing rule. Alternative: store as printed and let renderers case it. Recommend: Title Case; one rule, one contract test.

**Q5. Should the reader emit `name` for the `title_block` block?** It is discovered but dropped from the published blocks (`prompt.md:38`). Recommend: yes for consistency of the contract; it costs nothing and is dropped with the rest.

**Q6. `blockName` stamped at write time (§7.3) versus resolved at read time everywhere (D11 as stated).** Stamping means old reviews never get names unless re-run; resolving means every reader does the sheet-version walk. Recommend: both, as specified: stamp for new reviews (zero read cost), lightbox resolves live (it already walks the chain), PDF falls back to label for pre-P2 reviews.

**Q7. Position fallback words.** §3.2 mentions a bbox-derived "lower right" fallback for null names. That belongs to the renderer (PDF-redesign spec), not to storage. Confirm it is not wanted in `content_block`.

**Q8. Artifact patch scope (D10).** Patching 20 stored artifacts keeps re-publish consistent, but it edits a run's published output after the fact. Alternative: leave artifacts alone and accept that a re-publish of a pre-spec run reintroduces nulls that the standing backfill re-run fixes. Recommend: patch, and record it in the run's `execution_metadata` (`names_backfilled_at`).

---

## 10. Out of scope

- The RDS `EvidenceChip` partial and the PDF layout: the CC PDF redesign spec.
- Block-level evidence on non-plan-set documents: `content_block` is sheet-only (`sheet_version_id NOT NULL`), documents have `document_section` with no geometry; a separate spec (parked 2026-09-29).
- Range chips (`S2–3`), grouping consecutive sheet references: renderer logic, no data change.
- Renaming or re-boxing existing blocks; changing `category` vocabulary across the legacy long tail.
