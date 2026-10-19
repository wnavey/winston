# Checklist figures, iteration 2: the guide says how a figure is used

**Status:** Draft v1
**Date:** 2026-10-19
**Parent:** `../DESIGN-SPEC.md` (Draft v1, built as P1–P4) and `../IMPLEMENTATION-DETAILS.md` (what was built). This spec replaces that file's §13 proposal (one `guidance` field). It changes parent decisions D2, D6, D8, D9 and D11; those are named per decision below.
**Repos touched:**
- `bureau`: the `intake-figure` CLI, 1.4-resolve hydration and its contract, `bin/vision.ts`, the 2.1-review prompt, the CC-15 guide
- `cityhall`: one migration on `intake_figures`

**Repos NOT touched:** `conductor`, `conductor2`, `substation`, `inspector-general`, `claude-plugins`

Code read on 2026-10-19 at bureau `46df659dbb`, cityhall `c2af538`; prod (`mgxqsrjutswbciyrltwd`) queried the same day. Paths are relative to each repo.

## Problem

A reference figure today carries its own instructions, and the instructions are framed as "compare against this". That is wrong for some figures, and the split of its text into three columns means nothing.

- **The prompt frames every figure as a positive example.** The 2.1-review bullet says `figures.json` lists "images that show what an item looks like or must be checked against" (`runbooks/completeness-check/steps/2.1-review/steps/review/prompt.md:45`). Claude mode tells the vision model the references "are for comparison" and to answer "using the references only to compare" (`bin/vision.ts:412`). A figure that shows what does NOT count (an engineer's seal for a surveyor-seal item, storm arrows for a wastewater-arrow item) has no honest place in either sentence.
- **How a figure is used lives in a DB row nobody reviews.** The row holds `caption`, `description` and `constraints` (cityhall `supabase/schemas/public/tables/intake_figures.sql:6-9`). For `AUS_TX-F0001`, `constraints` holds checking rules ("only an R.P.L.S. seal counts", "within 5 years", "the name and date are illustrative"), which duplicate the CC-15-01 methodology bullet (bureau `jurisdictions/austin/completeness-check/v2.7-trimmed/cc-15.md:69`). A rule change in the row has no PR, no diff and no version; the guide's history shows nothing.
- **The three columns are one string to every consumer.** `refText()` joins them as `REFERENCE <id> — <caption>. <description> Constraints: <constraints>.` (`bin/vision.ts:125-128`); the agent gets them as three plain fields in `figures.json`. `type` (`intake_figures.sql:7, 30`) is read by nothing but `intake-figure list` (`tooling/src/cli/intake-figure.ts:129`).
- **The run's link from figure to item is the row's `item_refs`, and hydration polices it.** `hydrate_figures()` checks every ref against the guides with a `node` call (`scripts/cc.py:295, 342-346`), drops unknown refs, and skips a figure with none, listing it in `resolved.json.figuresSkipped` (`cc.py:349-357, 424`). The contract checks the same things again (`steps/1.4-resolve/contract.test.ts:44, 133-139`). `figuresSkipped` has no reader outside the step and its tests. The media-type skip (`cc.py:352-354`) cannot fire: the column's CHECK allows only the three types the run reads (`intake_figures.sql:25`).
- **The agent does not reliably frame a figure for the vision model.** In the acceptance run (`~/noetic/working/completeness-check/sa2008-v1-cc15-figures`, 2026-10-17), each of the three CC-15-01 calls attached `AUS_TX-F0001`; only `cc-15--r1`'s `--prompt` mentions the reference ("for format only"); `r2` and `r3` never do. That prompt never asked the agent to frame a figure, because the stored text did it, so this is weak evidence either way. It is why D6 is checked by the acceptance run.
- **Prod holds one figure.** `intake_figures` has one row, `AUS_TX-F0001` (`item_refs` `{cc-15:CC-15-01}`, `site-example`, live). Changing the columns now costs one backfilled row.

---

## 1. The design at a glance

**The row says what a figure is; the guide says how to use it.** The DB keeps the image, its id, one neutral `description`, and `item_refs` for people to read (D2). A guide's Validation Methodology cites a figure by id in the item's bullet and says what it is for (D1). The review agent reads that, attaches the figure with `--ref`, and tells the vision model in `--prompt` what the figure is for (D5, D6). The vision tool sends each figure with its id and description only (D4). Hydration loads the jurisdiction's live figures as it does now, without checking refs (D3).

```diff
 cityhall/supabase/
~└── schemas/public/tables/intake_figures.sql   # - caption, constraints, type; description NOT NULL (D2)
+    migrations/<ts>_intake_figures_one_text_column.sql

 bureau/
 ├── tooling/src/cli/intake-figure.ts            # upload: --description required; - --caption --constraints --type (D2)
~├── tooling/src/lib/intake-figures/store.ts
~├── tooling/src/types/database.types.ts
 ├── jurisdictions/austin/completeness-check/v2.7-trimmed/
~│   └── cc-15.md                                # CC-15-01 bullet cites AUS_TX-F0001 (D7)
 └── runbooks/completeness-check/
~    ├── scripts/cc.py                           # hydrate_figures: - guide_item_ids, - skips (D3)
~    ├── steps/1.4-resolve/contract.test.ts      # - figuresSkipped, - dangling-ref check (D3)
~    ├── bin/vision.ts                           # refText, claudePrompt wording (D4)
~    └── steps/2.1-review/steps/review/prompt.md # the figures bullet (D5)
```

```diff
 1.4-resolve  hydrate_figures(rows)
   read live rows for the jurisdiction          # unchanged
-  guide_item_ids()  →  drop unknown refs, skip figures with none
-  skip a media type the run doesn't read
   fetch bytes (cache, else bucket), verify sha256, fail on mismatch   # unchanged
   write figures.json + figures/<id>.<ext>
-  resolved.json: figures, figuresSkipped
+  resolved.json: figures
```

**Unchanged:** the bucket and its policies, the host cache, both hash checks, the resize to `VIEW_PX`, `MAX_REFS = 4`, the `vision-log.jsonl` `refs` field, the 2.11 `binary_read` rule, `metadata.figures` on publish, amend's figure-set check, `intake-figure retire` and `list`, and the id scheme.

---

## 2. Decisions

**D1. A guide cites a figure by id in the item's Validation Methodology bullet, and says there how to use it.** [Will, 2026-10-19]
- The citation is the bare id (`AUS_TX-F0001`) in the item's bullet, with the figure's role in plain words: an example of what counts, an example of what does NOT count, a form the drawing must match, or anything else. There is no required syntax; nothing parses it.
- Rules for judging the item (which seal counts, the 5-year window, "the name and date in the example are illustrative") are written there, with the rest of the item's methodology. They do not go in the row.
- A figure is jurisdiction-scoped and may be cited by several items and several checklist versions.
- Changes parent D9 (the prompt no longer routes by `item_refs`) and D11 (`item_refs` is no longer the run's link).

**D2. The row has one text column, `description`, which says only what the image shows.** Changes parent D2.
- `description text NOT NULL`: what is in the image, true for every item that cites it ("A Texas R.P.L.S. seal beside a surveyor's signed, dated certificate block, cut from a plat"). No verdict words ("counts", "does not count").
- Dropped: `caption`, `constraints`, `type`. Provenance stays in `derived_from` and `created_by`.
- **`item_refs` stays,** as the items the uploader meant the figure for, so a person can see from the DB where a figure is used. The CLI still checks it against the guides at upload (`intake-figure.ts`, D5 of the parent). Nothing in a run reads it, and nothing keeps it in step with the guides: the DB and the guides will be synced later, and this is an experimental feature.
- Changing a figure's image or description is still a new upload plus a retire (`../IMPLEMENTATION-DETAILS.md` §7).

**D3. Hydration loads the jurisdiction's live figures, with no ref checks and no skips.** Changes parent D6 steps 2 and 6.
- `hydrate_figures()` keeps steps 1, 3, 4 and 5 of the parent D6 (read the live rows, fetch through the cache, fail on a missing object or a hash mismatch, write the run's copy).
- Removed: `guide_item_ids()` and its `node` call, the ref filter, both skip reasons, and `resolved.json.figuresSkipped`. `figures.json` lists each row as fetched, plus `file`.
- The contract (`contract.test.ts`) drops `figuresSkipped` from the `Resolved` schema and the dangling-ref and hydrated-and-skipped assertions; the check that `figures.json` matches `resolved.json.figures` and each file matches its hash stays. This is the contract change Will signs off by approving this spec.
- A guide that cites an id the run did not load (a typo, a retired figure, another jurisdiction's figure) is caught at the call: `loadRefs()` refuses with exit 2 and logs `error: "ref: …"` (`bin/vision.ts:103-122`). The agent carries on without the figure. 1.4-resolve does not scan guides for ids.

**D4. The vision tool sends each figure with its id and description, framed as a reference whose use the question states.** Changes parent D8's text part.
- `refText()` becomes `REFERENCE <id> (not part of the file to analyze; the question says how to use it): <description>`. One string, sent in both modes, in the same position as today.
- Claude mode's "Reference figures" section (`bin/vision.ts:412`) says each figure comes with a description of what it shows and that the question says how to use it, and keeps "They are not part of the submission: never report anything you see in them as being on the file you analyze." The closing sentence's "using the references only to compare" becomes "using the references only as the question says".

**D5. The review prompt's figures bullet is rewritten.** Changes parent D9. Replaces `prompt.md:45`; the never-open clause on `:44` stays. Draft wording, final wording on Will's sign-off:

> * A guide's Validation Methodology may cite a reference figure by id (for example `AUS_TX-F0001`) for an item, and says how to use it: an example of what counts, an example of what does not count, a form the drawing must match, or something else. When you check that item on a drawing, attach the figure with `--ref <id>` (at most 4 per call) unless you can settle the item without it; if you do not attach it, say why in your observation. In `--prompt`, tell the vision model what each attached figure is for, in the guide's terms ("REFERENCE AUS_TX-F0001 is an example of a seal that does not count"), and ask what is on the sheet, not for a verdict. A figure is not part of the submission: never cite it as evidence of what the plans show.

- The agent no longer needs `figures.json`; the guide is where it learns a figure exists. `figures.json` stays as the vision tool's input.

**D6. The agent, not code, carries a figure's role to the vision model.**
- The role ("counts" / "does not count" / "must match") reaches the vision model only through `--prompt` (D5). The DB description (D4) is fixed text; the role is not.
- Checking rules stay with the agent: the vision model reports what is on the sheet (which seals, which professions, which dates); the agent applies the methodology.
- **Revisit when:** the acceptance run (§4) has a `--ref` call whose `--prompt` does not state the figure's role. The fix then is code that copies the guide's sentence about the figure into the call, which needs a findable form for that sentence. It is not built now.

**D7. CC-15-01 cites `AUS_TX-F0001`, and the row is backfilled.**
- The CC-15-01 bullet in `v2.7-trimmed/cc-15.md:69` gains one sentence, in place (bureau edits a version dir in place, as #2162 did): "Figure AUS_TX-F0001 shows a Texas R.P.L.S. seal beside a surveyor's signed, dated certificate: an example of a seal that counts. Its name, registration number and date are illustrative; never compare them to the submission." The rest of the old `constraints` text is already in the bullet.
- The migration sets `AUS_TX-F0001`'s `description` to the neutral text of D2 (it is the only row, and its one draft review, `e3d07029`, pins it by image hash, not text).

**D8. We apply the migration.** The implementing session applies it to prod (Supabase MCP `apply_migration`), not Jason, and regenerates cityhall's types (Supabase MCP `generate_typescript_types`, since this box has no `SUPABASE_ACCESS_TOKEN` for `pnpm gen-types`).

---

## 3. Testing seams

**S1: 1.4-resolve's unit tests and contract** (existing)
- **Proves:** D3. Live rows are written to `figures.json` and `figures/` whatever their `item_refs`; a hash mismatch and a missing object still fail naming the figure; `resolved.json` has no `figuresSkipped`; no rows gives an empty set.
- **Prior art:** `runbooks/completeness-check/scripts/test_cc.py:118-201`; `steps/1.4-resolve/contract.test.ts:120-139`.
- **Runs:** `python3 -m pytest scripts/test_cc.py`, and `npm test` in `runbooks/lib` for the contract, locally and in bureau CI.

**S2: the vision CLI** (existing, `bin/vision.test.ts`)
- **Proves:** D4. `refText` is `REFERENCE <id> (…): <description>`; the claude prompt carries the new framing and still says never to report a reference as on the file; gateway part order is unchanged; an id not in `figures.json` still refuses.
- **Prior art:** the existing `refText`, `claudePrompt` and `gatewayContent` cases in `bin/vision.test.ts`.
- **Runs:** `test:bin` in `runbooks/lib`, locally and in bureau CI.

**S3: the table** (existing, cityhall `tests/db/intake-figures.test.ts`)
- **Proves:** D2. An insert without `description` fails; inserts no longer name `caption` or `type` (`:70, 154, 223`; the `type: "photo"` case at `:250` goes).
- **Runs:** `pnpm test:db` in cityhall CI (no local Supabase stack on this box).

**Acceptance (not a seam):** §4 A1.

---

## 4. PR plan

**P1: the guide says how a figure is used** — `bureau`
- **Blocked by:** nothing (can start now). Every column it reads (`description`, `item_refs`) exists today.
- **Delivers:** D1, D3, D4, D5, D7's guide edit. The CLI: `upload <slug> <file> --description "…" --items …`, with `--caption`, `--constraints` and `--type` removed; `list` prints `item_refs` and the description's first line. `store.ts`, `tooling/src/types/database.types.ts` (hand-edited to the post-migration row), `cc.py` (`FIGURE_COLUMNS` and `hydrate_figures`), the contract, `vision.ts`, `prompt.md`, `cc-15.md`, and their tests.
- **Tested at:** S1, S2.
- **Door:** two-way (revert the PR).
- **Blast radius:** every CC run's 1.4-resolve and every `--ref` call. Between P1's merge and P2's apply, `intake-figure upload` fails on the still-required `caption`; nobody uploads in that window.

**P2: one text column** — `cityhall`
- **Blocked by:** P1 merged (bureau main must stop selecting `caption`, `constraints` and `type` first, or every CC run's 1.4-resolve fails on a PostgREST 400).
- **Delivers:** D2, D7's backfill, D8. A migration: `UPDATE` `AUS_TX-F0001`'s description; `ALTER COLUMN description SET NOT NULL`; drop `caption`, `constraints`, `type` and `intake_figures_type_check`. The schema file and its column comments (`intake_figures.sql:65-67`: `item_refs` "for people to read; the run does not read it", `description` "what the image shows"); the test inserts; regenerated `src/types/database.types.ts`. The session applies the migration to prod, then merges.
- **Tested at:** S3.
- **Door:** one-way: it drops three columns. Their only data is `AUS_TX-F0001`'s caption (107 chars), constraints (318) and type (`site-example`); the PR description records all three verbatim before the apply, and that is the rollback (re-add the columns, restore the values).
- **Blast radius:** the one row; the unbuilt P5 pages read none of the dropped columns once updated.

**A1: acceptance run** (not a PR; a paid run on Will's go)
- **Blocked by:** P1 and P2.
- Upload one negative-example figure for CC-15-01 (Q1), cite it in the CC-15-01 bullet as "does not count", and re-run the parent's §8 acceptance: 2008 San Antonio, `reviewFiles: ["cc-15"]`, 3 runs, claude vision.
- **Pass:** `figures.json` has both figures with `description`; each CC-15-01 call attaches them or the observation says why not; every `--prompt` with a `--ref` states each figure's role (D6's trigger); the vision answers do not report either figure's seal as on Sheet 6; the CC-15-01 verdict is unchanged from the §8 run (fail).

**Order:** P1 → P2 → A1.

---

## 5. Open questions

- **Q1. Which image is the negative example?** A Texas P.E. or landscape-architect seal cut from a public city document, or from a different submission than 2008 San Antonio (never the one under test). Default: a P.E. seal from a public City of Austin document; Will picks.
- **Q2. Is a `site-example` showing a real professional's name, registration number and email fine to show in the app?** `AUS_TX-F0001` is one, readable by staff and by users who can see an Austin project (parent Q2, still open). This spec does not change who can read it.
- **Q3. A guide version citing a retired figure.** Hydration loads live rows only, so an older version citing a retired id gets the vision refusal (D3). Default: acceptable while figures are few; revisit when a figure is first retired.

## 6. Not yet specified

- **Syncing the guides and the DB.** Will expects the text guides and the DB to be synced later; then `item_refs` can be derived from guide citations rather than typed at upload. Until then nothing checks that the two agree.
- **Code that carries a figure's role** to the vision model, if A1 trips D6's trigger.
- **The P5 pages** (parent D10, unbuilt) under the new columns: the grid label becomes the description's first line; the chips still come from `item_refs`.

## 7. Out of scope

- **Checks that `item_refs` matches the guides' citations.** Will, 2026-10-19: don't build drift prevention for an experimental feature.
- **Scanning guides for cited ids at 1.4-resolve, or failing the run on a missing one.** The vision tool's refusal (D3) is enough for now.
- **Making a row's image or text immutable in the DB.** The CLI has no edit path.
- **CRC's figures** (`crc-guides`), as in the parent.
