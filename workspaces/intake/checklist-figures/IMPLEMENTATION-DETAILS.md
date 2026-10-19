# Reference figures in a completeness-check run: implementation details

**Status:** Implemented (P1–P4 merged; P5 not built)
**Date:** 2026-10-19
**Parent:** `DESIGN-SPEC.md` in this folder (Draft v1). This file describes what was built, for a session that has to change or debug it. Where the build differs from the design, §7 says so.
**Code read at:** bureau `46df659dbb`, cityhall `907951b`. Paths are relative to each repo.
**Diagram:** `implementation-architecture.html`

## 1. In one paragraph

A reference figure is a row in `public.intake_figures` plus an image in the private `intake-figures` bucket. A CC run touches the database for figures once: step **1.4-resolve** copies the jurisdiction's live figures into the run folder (`checklist/figures.json` and `checklist/figures/<id>.<ext>`), checking each image's sha256. From then on the run reads figures only from that folder. The **2.1-review** agent reads `figures.json` and, when it checks an item a figure is for, adds `--ref <id>` to its vision call. `bin/vision.ts` loads the figure from the run folder, checks its hash again, and sends it to the vision model after the sheet, with the figure's stored caption, description and constraints. The agent never sees the image itself. **3.1-publish** records the set of figures the run had on the review, and an amend refuses a run whose set differs.

## 2. Where a figure lives

| What | Where | Written by |
|---|---|---|
| The row: id, `item_refs`, caption, description, constraints, sha256, size, `storage_path` | `public.intake_figures` (cityhall `supabase/schemas/public/tables/intake_figures.sql`) | `intake-figure upload` (bureau `tooling/src/cli/intake-figure.ts`), service role |
| The image | bucket `intake-figures`, at `<jurisdiction_code>/<sha256>.<png\|jpeg\|webp>` | the same CLI |
| A host copy, by hash | `$INTAKE_FIGURES_CACHE`, else `~/.cache/intake-figures/<sha256>` | 1.4-resolve, on a bucket read |
| The run's copy | `$RUN/1.4-resolve/checklist/figures.json` and `checklist/figures/<id>.<ext>` | 1.4-resolve |
| A vision call's copy (claude mode only) | `<cell>/scratch/vision/ref-<id>-<w>x<h>.<ext>` | `bin/vision.ts` |

- **Ids** are `<jurisdiction code>-F<NNNN>` (`AUS_TX-F0001`), minted max+1 per jurisdiction, and never reused. A changed image or a reworded caption is a new figure: upload it, then `intake-figure retire` the old id.
- **`item_refs`** hold composite checklist refs, `<guide stem>:<item id>` (`cc-15:CC-15-01`). They are not foreign keys; 1.4-resolve checks them against the guides each run (§3).
- **Who reads it:** the `workflow_run` role reads every row and the whole bucket (that is what a run uses). A signed-in user reads the rows of a jurisdiction they can see, and an object only through such a row.

## 3. When the run loads figures: 1.4-resolve

Once per run, after the guide dir is copied into the run (`runbooks/completeness-check/scripts/cc.py:403`), `hydrate_figures()` (`cc.py:336`) runs:

1. **Read the rows:** `db_figures()` (`cc.py:276`) does one PostgREST read through the run's credentials: `intake_figures?jurisdiction_slug=eq.<slug>&retired_at=is.null&order=id`. No rows means an empty `figures.json`; this is still the path for every jurisdiction but Austin.
2. **Check the refs:** `guide_item_ids()` (`cc.py:295`) reads each guide's item ids with `scripts/lib/guide-items.ts` (one `node` call, made only when there are rows). A ref is valid when its stem is a guide in the version dir and its item id is in that guide's ID column. Invalid refs are dropped. A figure with no valid ref, or with a media type the run doesn't read, is **skipped** and listed in `resolved.json.figuresSkipped` with the reason. Skipping never fails the run: a figure is an aid, and a guide regroup must not block reviews.
3. **Fetch the bytes:** `_figure_bytes()` tries the host cache first and keeps the cached copy only if its sha256 matches. Otherwise it reads the bucket (`db_figure_bytes()`, `cc.py:283`), checks the hash, and writes the cache atomically.
4. **Fail loudly on bad bytes:** a missing object, or bytes whose sha256 differs from the row, **fails the step** with the figure id and both hashes.
5. **Write the run's copy:** `checklist/figures/<id>.<ext>` for each kept figure, and `checklist/figures.json`:

   ```json
   { "schema_version": 1, "jurisdiction": "austin",
     "figures": [ { "id": "AUS_TX-F0001", "item_refs": ["cc-15:CC-15-01"],
                    "caption": "Texas Registered Professional Land Surveyor (R.P.L.S.) seal beside the surveyor's signed, dated certificate",
                    "type": "site-example", "description": "…", "constraints": "…",
                    "sha256": "853c8e02…", "media_type": "image/png", "px_w": 546, "px_h": 220,
                    "file": "figures/AUS_TX-F0001.png", "…": "the rest of the row" } ] }
   ```

6. **Record the set:** `resolved.json` gains `figures: [{id, sha256}]` (sorted by id) and `figuresSkipped: [{id, reason}]` (`cc.py:423`).

- The guides themselves stay byte-identical to bureau. Nothing names a figure in `cc-15.md`; the row's `item_refs` is the only link.
- The step's contract (`steps/1.4-resolve/contract.test.ts`) has a blocking check that `figures.json` lists exactly the figures `resolved.json` records, that each file's bytes match its sha256, that every ref names an item of this checklist, and that no figure is both hydrated and skipped. Both files sit under `checklist/`, which the step already declares.
- A re-run of 1.4-resolve deletes and rewrites `checklist/`, so it picks up whatever is live at that moment.

## 4. When the agent reads them: 2.1-review

The review prompt (`steps/2.1-review/steps/review/prompt.md:44-45`) has two lines about figures:

- Line 44, the existing rule on images, now also covers figures: the agent must not open the files in `checklist/figures/` itself. The vision tool is the only way it looks at an image.
- Line 45: `figures.json` "may list reference figures: images that show what an item looks like or must be checked against. When you verify on a drawing an item named in a figure's `item_refs`, add `--ref <figure id>` to the vision call, at most 4, and only that item's figures. A figure is not part of the submission: never cite it as evidence of what the plans show."

So the agent reads `figures.json` as text, usually at the start of its cell, and learns the caption, description and constraints of each figure. What it does with the figure is decide **when** to attach it and write its own question around it. The agent cannot change the text that goes to the vision model with the figure.

2.11-tool-usage counts a direct read of a figure image as a `binary_read` (`.webp` was added to `BINARY_RE` in `scripts/tool_usage.py:77` for this).

## 5. How a figure reaches the vision model: `bin/vision.ts --ref`

The agent's call:

```sh
node $RB/bin/vision.ts --document-id <plan set> --sheet 6 --item-ids CC-15-01 --ref AUS_TX-F0001 --prompt "<question>"
```

1. **Load** (`loadRefs()`, `bin/vision.ts:103`): read `$RUN/1.4-resolve/checklist/figures.json`, find each id, read its file, check its sha256. Each of these **refuses with exit 2**, logged in `vision-log.jsonl` with `error: "ref: …"`, before anything else is loaded: more than 4 refs (`MAX_REFS`, `:65`), a repeated ref, an id not in `figures.json`, no `figures.json`, a missing file, or a hash mismatch.
2. **Size** (`prepareRef()`, `:142`): a figure whose long edge is over `VIEW_PX` (2000, `:335`) is downscaled to fit and never upscaled. PNG stays PNG; JPEG is re-encoded at quality 90; an oversize WebP refuses. `jimp` is loaded only when a resize is needed.
3. **Text** (`refText()`, `:125`): `REFERENCE <id> — <caption>. <description> Constraints: <constraints>.`
4. **Send it after the sheet.** The sheet (target) is loaded as before (staged copy first).
   - **Claude mode** (`visionMode: "claude"`): the figure is copied to `<cell>/scratch/vision/ref-<id>-<w>x<h>.<ext>` beside the sheet and its tiles. `claudePrompt()` (`:403`) adds a "Reference figures" section to the child session's prompt, with each file name and its text, and: "These are for comparison… They are not part of the submission: never report anything you see in them as being on the file you analyze." The child opens the figure with Read like the sheet.
   - **Gateway mode** (Gemini): `gatewayContent()` (`:445`) sends, in order, the sheet, then each figure as a text part followed by its image, then `vision-prompt.md`, then the agent's question.
5. **Log:** the call's `vision-log.jsonl` entry gains `refs: [{id, sha256, sentPx: [w, h]}]` (`refsLog()`, `:159`). 2.11-tool-usage reconciles these entries like the rest.

A call with no `--ref` is unchanged from before figures existed.

## 6. After the review: publish and amend

- **Publish:** `lane_b_argv()` (`cc.py:743`) passes `--figures '<resolved.json figures>'` to `runbooks/lib/publish_review_cli.py`, which writes it to the review's `metadata.figures` beside `checklistsTreeHash` (`checklist_metadata()`, `publish_review_cli.py:356`). A review then pins both halves of what its agents read: the guides by git tree hash, the figures by image hash.
- **Amend:** `runbooks/lib/review_amend.py:93` compares the run's figure set with the review's, by id and sha256, and refuses an amend when they differ. A review from before figures has no key and counts as the empty set.

## 7. Where the build differs from `DESIGN-SPEC.md`

- **Who can read figures (D3):** reads follow the `jurisdictions` policy rather than any signed-in user, and the bucket is readable only through a row the user can see.
- **`jurisdiction_code`:** each row also carries `jurisdiction_code`, with `(jurisdiction_slug, jurisdiction_code)` a composite foreign key to `jurisdictions(slug, code)`. The id prefix and `storage_path` are built from it, so a JPEG is stored as `.jpeg`.
- **The prompt (D9):** one bullet plus a clause on the existing never-open line, instead of a three-bullet section.
- **Editing a figure's text (D2):** the spec allows fixing a typo in `description` in place, with a reworded caption becoming a new figure. The CLI has no edit command (only `upload`, `retire`, `list`), and a review records figures by image hash only, so an in-place text edit would not be caught by amend's figure check. In practice any text change is a new upload plus a retire.

## 8. Worked example: `AUS_TX-F0001` on 2008 San Antonio

Run `~/noetic/working/completeness-check/sa2008-v1-cc15-figures` (runbook run `0e9d8ebb`, draft review `e3d07029`, 2026-10-17), `reviewFiles: ["cc-15"]`, 3 runs, claude vision:

- 1.4-resolve wrote `figures/AUS_TX-F0001.png` (546×220, sha256 `853c8e02…`) with nothing skipped.
- Each of the 3 review cells made one CC-15-01 vision call on Sheet 6 with `--ref AUS_TX-F0001`, logged as `sentPx: [546, 220]`. None of the 9 other vision calls (CC-15-02, CC-15-14) carried a ref.
- No cell opened the figure directly; the review's `metadata.figures` holds `[{id: "AUS_TX-F0001", sha256: "853c8e02…"}]`.
- A call with the figure cost about the same as one without; the image is small.

## 9. Where to change things

| To change | Edit |
|---|---|
| Which rows a run loads, ref checking, caching, failure rules | `runbooks/completeness-check/scripts/cc.py` (`hydrate_figures`, `_figure_bytes`, `guide_item_ids`) |
| The shape 1.4-resolve must produce | `runbooks/completeness-check/steps/1.4-resolve/contract.test.ts` (a contract change needs Will's sign-off) |
| When the agent attaches a figure | `runbooks/completeness-check/steps/2.1-review/steps/review/prompt.md:45` |
| What the model is told about a figure, order, size, refusals | `runbooks/completeness-check/bin/vision.ts` (`loadRefs`, `prepareRef`, `refText`, `claudePrompt`, `gatewayContent`) |
| A figure's own words | not code: upload a new figure and retire the old one |
| What a review records, amend's check | `runbooks/lib/publish_review_cli.py`, `runbooks/lib/review_amend.py` |

## 10. Tests

- **1.4-resolve:** `runbooks/completeness-check/scripts/test_cc.py:146-201` (no figures, a hydrated figure, a skipped one, a hash mismatch, a missing object, a corrupt cache entry) and the step's `contract.test.ts`.
- **The vision call:** `runbooks/completeness-check/bin/vision.test.ts` (refusals, resize, the text, both modes' content), run by `runbooks/lib` `test:bin`.
- **Tool usage:** `runbooks/completeness-check/scripts/test_tool_usage.py:329`.
- **Publish and amend:** `runbooks/lib/test_publish_review_cli.py:652-687`, `runbooks/lib/test_review_amend.py:206`.
- **The CLI:** `tooling/src/lib/intake-figures/figure.test.ts`.

## 11. Not built yet

- **P5, the cityhall figures view** (D10): a Figures section on `/intake-checklists/[jurisdiction]`, figures on each item page, and a signed-URL file route. It waits on regenerated cityhall types (`pnpm gen-types`).
- **How the agent should frame a question around a figure.** The prompt says when to attach one, not how to ask about it; agents wrote good questions in the §8 run without it. §13 proposes the fix.
- **One `guidance` field and agent judgement on attaching:** proposed in §13, not started.

## 12. Who sees a figure, and the three text columns

**1.4-resolve runs no model.** It is a script: it reads rows, checks refs, downloads and hashes the images, and writes the run's copy. Nothing looks at an image there.

| | Reads the text (caption, description, constraints) | Sees the image |
|---|---|---|
| 1.4-resolve (script) | copies it into `figures.json`, does not interpret it | no; hashes the bytes only |
| 2.1-review agent | yes: it reads `figures.json` (id, `item_refs`, all three text fields) | no: the prompt forbids it, and 2.11 counts a direct read as a `binary_read` |
| Vision model | yes, with the image | yes, but only on a call where the agent passed `--ref` |

So the review agent knows *about* the figures from their text and decides when to attach one; only the vision model looks at the picture.

**The three columns** (DESIGN-SPEC D2): `caption` is required, one line naming the figure; `description` (optional) says what the image shows and what it does not; `constraints` (optional) was meant for "the numbers to check against, if any". `AUS_TX-F0001` uses `constraints` for rules instead (only an R.P.L.S. seal counts; within 5 years; the example's name and date are illustrative).

**The code treats them the same.** `refText()` (`bin/vision.ts:125`) joins them into one string, `REFERENCE <id> — <caption>. <description> Constraints: <constraints>.`, which is all the vision model gets with the image in both modes; the agent gets all three as plain fields in `figures.json`. The only differences: `caption` cannot be empty, the constraints get a `Constraints:` label in the joined text, and the planned P5 pages would show only the caption in the figures grid.

## 13. Proposed next change: one `guidance` field, and the agent decides when to attach

**Status:** proposed by Will on 2026-10-19, not started. A new session implements it.

### 13.1 What Will wants

1. **The point of a figure varies per checklist item, and the figure says which.** Examples: "look for this kind of icon"; "this does NOT count as a {thing you're checking for}"; "the drawing has to match this shape exactly". Today's prompt frames every figure as something to compare against ("images that show what an item looks like or must be checked against"), and claude mode tells the vision model the references "are for comparison" (`bin/vision.ts:411`). Both are wrong for a "this does not count" figure.
2. **The agent uses judgement about attaching.** It may settle an item without the figure, though usually it should attach it. Today's bullet reads as mandatory: every CC-15-01 call in the §8 run attached the figure.
3. **`caption`, `description` and `constraints` collapse into one field.** The split carries no meaning the code uses (§12): `refText()` joins them into one string.

### 13.2 Proposed changes

- **G1. One required free-text field, `guidance`,** replaces `caption`, `description` and `constraints`. It says what the figure is and how to use it, in whatever form fits the item. `type` stays: it records what the image is (reference-design, site-example, table, redline), not what it is for. The P5 figures grid would show the first line of `guidance` as the label. *Open (Q-G1): keep a short `caption` beside `guidance` as a label for that grid? Will's lean is one field.*
- **G2. The vision model is told to follow each figure's guidance,** not to compare. `refText()` becomes `REFERENCE <id>: <guidance>`, and the claude-mode "Reference figures" section says each comes "with guidance on how to use it", keeping "never report anything you see in them as being on the file you analyze".
- **G3. The review prompt bullet** (`steps/2.1-review/steps/review/prompt.md:45`) becomes, in draft:

  > `$RUN/1.4-resolve/checklist/figures.json` lists reference figures for some items. Each has `guidance` saying what it is for: an example to look for, an example of what does not count, a form the drawing must match, or something else. Read the guidance for your guide's items before you start. When you check one of those items on a drawing, attach its figures with `--ref <id>` (at most 4, only that item's figures) unless you can settle the item without them, and in `--prompt` say how the figure should be used. If you skip a figure, say why in your observation. A figure is never evidence of what the plans show.

  A prompt change needs Will's sign-off on the final wording.
- **G4. Fill `guidance` for `AUS_TX-F0001`** from its current three fields, in the migration. There is one row today, so this is the cheapest moment to change the schema.

### 13.3 Where it lands

| Repo | Change |
|---|---|
| cityhall | Migration: add `guidance text NOT NULL` (backfilled for the existing row), drop `caption`, `description`, `constraints`; schema file `supabase/schemas/public/tables/intake_figures.sql` and its column comments; `tests/db/intake-figures.test.ts` (inserts name `caption`); `pnpm gen-types`. Jason applies the migration before the bureau PR merges, as for P1. |
| bureau | `tooling/src/cli/intake-figure.ts` and `tooling/src/lib/intake-figures/store.ts` (`--guidance` replaces the three flags), `tooling/src/types/database.types.ts`; `runbooks/completeness-check/scripts/cc.py` (`FIGURE_COLUMNS`) and `test_cc.py`; `steps/1.4-resolve/contract.test.ts` (the `Figures` schema); `bin/vision.ts` (`refText`, `claudePrompt` wording) and `vision.test.ts`; the prompt bullet (G3). |
| winston | A revision note on `DESIGN-SPEC.md` D2, D8 and D9 pointing here. |

Order: the cityhall migration is applied first; until the bureau PR merges, every run's 1.4-resolve would fail on the missing columns, so the two should land together (migration applied, then the bureau PR merged at once), or the bureau PR should read `guidance` with a fallback to the old columns for one release.

### 13.4 How to check it

Re-run the §8 acceptance (`reviewFiles: ["cc-15"]`, 3 runs, claude vision, 2008 San Antonio) and check: `figures.json` carries `guidance`; the vision log's `refs` as before; each CC-15-01 observation either attaches the figure or says why it didn't; the `--prompt` text says how the figure is used; the CC-15-01 verdict stays fail.
