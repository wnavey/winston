# Completeness-check vision: how it works today, and reference images

**Status:** Draft v1 (exploratory — a map of the current system and a first sketch of the change, not a build plan)
**Date:** 2026-10-14
**Repos touched:** `bureau` (the CC runbook's vision CLI, the CC guide folder layout, the review prompt)
**Repos NOT touched:** `conductor` (legacy CRC keeps its tool as is), `conductor2`, `substation`, `cityhall`, `claude-plugins`

Code read at bureau `826585eda0` and conductor `1f06414` (2026-10-14). Paths below are relative to
`bureau/runbooks/completeness-check/` unless they say otherwise.

## 1. Problem

1. **Nobody can say what the CC vision call actually looks at.** The review agent asks a
   question about a sheet and gets prose back. Which image, at what resolution, cut how, and
   what the agent can steer is spread across `bin/vision.ts`, the review prompt and the
   substation rasterizer. This spec writes it down (§2–§4).
2. **CC can't show the vision model what "right" looks like.** The legacy CRC workflow's
   `crc_vision_check` takes reference images: a figure from the guide, a crop of the
   reviewer's redline. It asks "does the sheet show this?" with both images in front of the
   model (§5). CC's vision CLI takes one document, one optional sheet number and a prompt, nothing
   else (`bin/vision.ts:65`). The current Austin CC guides (`jurisdictions/austin/completeness-check/v2.7-trimmed`,
   15 guides) contain no images at all.
3. **The agent can't point.** The CLI has no region, crop or zoom argument. In claude mode the
   child decides which tiles to open from the question text alone; in gateway mode Gemini gets
   the whole thumbnail once (§4).

## 2. The completeness-check runbook today

The manifest is `runbook.yaml:1-32` (`sandbox: container` at `:14`, chosen because the host OS
sandbox blocked the vision CLI's network). Runners: review, explain and format on sonnet-5.5;
annotate on opus-5.5 at high effort (`:19-25`).

```diff
 completeness-check (runbook v2)
   1.1-inputs            operator · request.json (visionMode, visionModel live here)
   1.2-stage-submission  script · sheet-NN.pdf + sheet-NN.jpg, block-manifest.json, README
   1.3-facts             script · facts.md
   1.4-resolve           script · resolved.json, roster.txt, plan-set-versions.json, checklist/
   2.1-review            FAN-OUT per guide × run → agent: findings.json, vision-log.jsonl   ← vision is called here
   2.2-consolidate       script
   2.3-forced-outcomes   script · one gateway call per forced item
   2.4-uncertain-inputs  script
   2.5-explain           FAN-OUT per uncertain item → agent
   2.6-uncertain-collect script
   2.7-enrich            script
   2.8-format            agent
   2.9-comments          script · review-comments.json
   2.10-validate         script
   2.11-tool-usage       script · reconciles vision calls against vision-log.jsonl
   2.12-annotate         FAN-OUT per guide × run with a fail/warn → sweep agents (Opus, own 300-DPI crops)
   2.13-annotate-merge   script
   3.1-publish           script
   3.2-ig-postprocess    script
```

The fan-out is per **guide**, not per checklist item: one review agent works every item in its
guide (`steps/2.1-review/step.yaml:4-6`). `cc-compare`'s adjudicate cells call the same CLI
(`../cc-compare/steps/2.1-adjudicate/steps/adjudicate/step.yaml:5,9`).

## 3. The two vision modes

The agent calls vision through **Bash**, not an MCP tool
(`steps/2.1-review/steps/review/prompt.md:29-44`):

```sh
node $RUNBOOK/bin/vision.ts --document-id <id> [--sheet <n>] --item-ids <ID,...> --prompt "<question>"
```

It is told not to open the `.jpg`/PDF files itself (`prompt.md:44`); `2.11` counts direct reads
as `binary_reads`. The mode comes from `visionMode` in the request (`gateway` default,
`contract.test.ts:29-30`), copied into `resolved.json` by `cc.py` (`:48,170-171`), overridable by
`CC_VISION_MODE` / `CC_VISION_MODEL` (`vision.ts:97-106`).

| | `gateway` (default) | `claude` |
|---|---|---|
| Model | `google/gemini-3.1-pro-preview` (`vision.ts:47`) | `claude-opus-5-5` (`vision.ts:48`) |
| How | in-process `generateText` via the Vercel AI Gateway, `disallowPromptTraining: true` (`:87-94, 423-432`) | a one-shot **`claude -p` subprocess** (`runClaude`, `:343-354`), cwd `$OUT/scratch/vision`, 15-min timeout |
| Image in | the whole sheet JPEG as one image part (`:425-430`); documents as a 300 s signed PDF URL (`:184-197`) | the file copied into the scratch dir; the child opens it with its **Read** tool |
| Tools in the child | — | `Read` only, `--safe-mode`, `--no-session-persistence` (`claudeArgs`, `:337-340`) |
| Billing | gateway, tagged `tool:vision` | the review agent's own seat, inherited via `CLAUDE_CONFIG_DIR`; refuses to start if `ANTHROPIC_API_KEY` & co. are set (`:51, 329-335`) |
| Median latency | ~10 s | ~24 s (winston#296 Q6) |

**Correction to the common picture:** claude mode is not a claude-agent-sdk subagent. It is the
Claude Code CLI run headless as a grandchild of the review agent:
`review agent → Bash → node vision.ts → claude -p`. Its spend is invisible to conductor's ledger
(winston#296 F3), which once parked `2.8-format` for ~2 h on a seat over its ceiling.

## 4. How a sheet becomes pixels

### 4.1 Where the image comes from

- **Sheets:** the stored JPEG at `sheet_version.thumbnail_storage_path` in `submission-data`. It is
  read from the staged `sheet-NN.jpg` if its sha256 matches the manifest, otherwise downloaded
  against the pinned plan-set version (`vision.ts:168-183, 213-231, 386-392`). Nothing renders the
  PDF at call time.
- **Resolution:** substation rasterizes plan sets with `pdftoppm -r 150 -jpeg` (`rasterizePdf`,
  `dpi = 150` default). Read from a stale substation worktree; **prod DPI unverified** (Q3). At 150
  DPI a 24×36 in sheet is **5400 × 3600 px**.
- **Documents:** gateway sends the PDF by signed URL; claude mode copies the PDF bytes and the
  child reads it in page ranges of at most 20 pages (`:323`).

### 4.2 Gateway mode: one image, no tiling

Gemini receives the entire JPEG once, then the instructions, then the question. No crop, tile or
downscale happens in our code; any resizing is the provider's.

### 4.3 Claude mode: a downscaled whole plus full-resolution tiles

`VIEW_PX = 2000` (`vision.ts:252-253`) is the code's assumption of the largest long edge Claude
views without downscaling. `tileGrid(w, h, 2000, 0.1)` (`:257-270`):

- no tiles when the long edge ≤ 2000 px;
- otherwise per axis `n = ceil((len − 200) / 1800)` tiles, each `ceil(len / n + 200)` px long, spaced
  evenly from edge to edge, so neighbours overlap by `200 + 200/(n − 1)` px (400 px with two tiles
  on an axis, 300 with three); named row-major `r1c1`, `r1c2`, …;
- tiles are cut with `jimp` at native pixels (no upscaling) and written as JPEG q90 (`:293-301`).

| Sheet (150 DPI) | Pixels | Grid (cols × rows) | Tile size | Overlap (x, y) |
|---|---|---|---|---|
| 11 × 17 | 2550 × 1650 | 2 × 1 | 1475 × 1650 | 400, — |
| 22 × 34 | 5100 × 3300 | 3 × 2 | 1900 × 1850 | 300, 400 |
| 24 × 36 | 5400 × 3600 | 3 × 2 | 2000 × 2000 | 300, 400 |
| 30 × 42 | 6300 × 4500 | 4 × 3 | 1775 × 1700 | 267, 300 |

The child's prompt (`claudePrompt`, `:320-325`) names the whole sheet ("you will see it
downscaled") and the tile files, and says: *"Open the tiles that cover what the question is about
before you answer."* The child chooses how many tiles to Read; nothing caps or logs which ones it
opened beyond its own transcript.

**What the review agent controls:** the document, the sheet number and the question text. Nothing
else — no bbox, no normalized region, no tile name, no zoom factor, no content-block id.

**Not the same path:** `2.12-annotate` renders its own 300-DPI crops clamped to a 1568 px long edge
(`runbooks/lib/annotate/annotate-crop.ts:8, 58-60`; comment: *"Vision models downsample past ~1568px"*)
and its sweep agents read them directly. That number disagrees with `VIEW_PX = 2000` (Q3).

### 4.4 What comes back

Free text on stdout; on failure a canned sentence with exit 0 (`:399-401, 418-420`). Each call
appends to `vision-log.jsonl`: `{ts, itemIds, documentId, sheet, prompt, response, ok, mode, model,
source, image:{bucket, storagePath, kind, sha256?, tiles[]}}`, plus claude-mode session usage and
cost (`:244-249, 310-317, 349`). The agent folds the answer into each finding's `observation` and
`tools_used: ["vision"]`, and cites vision evidence **at sheet level only** — "Omit `blockNumber`
when you only saw it via vision" (`prompt.md:211-226`).

## 5. How CRC's `crc_vision_check` uses reference images

Defined at `conductor/src/tools/crc-vision-check/index.ts:241-519`, registered at
`conductor/src/tools/index.ts:271-275`, exposed to the CRC `review` step
(`bureau/workflows/comment-resolution-check/workflow.yaml:169-177`). Still live in conductor-1;
absent from conductor2 and every bureau runbook.

**Input** (`index.ts:250-287`): `documentId` (required), `prompt` (required), `sheetNum` (optional),
`checklistItemIds` (logging only), and `referenceImages: [{path, description}]` — `path` relative to
`{WORKSPACE}/crc-guides/` (e.g. `figures/TPW-9/1.png`), `description` the agent's own words for what
the image is.

**Where references come from:** the generate-crc-guides skill extracts figures (native-resolution
PyMuPDF; redline crops at 600 DPI with 15% padding) into `figures/{parent_slug}/N.png`, listed in
each guide's `## Figures` section; `fetch-crc-guides` stages the whole folder into the workspace.
The agent picks which to attach; the tool never auto-loads.

**How the call is built** (`index.ts:401-419`): `PRIMARY IMAGE BELOW` → the sheet thumbnail →
for each reference `SUPPLEMENTARY IMAGE i — <description>` + the image → the fixed instructions
(*"Trust those labels — they are your interpretive frame"*) → the agent's prompt. References are sent
raw; path escapes, files over 10 MB and unknown extensions are skipped with a notice, and the call
still runs. One Gemini call via the gateway.

**What went wrong with it** (from the CRC audits):

- **Invented descriptions are trusted.** A DE-30 run attached a figure described as showing a
  manhole; the figure shows none, and the model took the description as its frame.
- **Rarely used:** 62 of 538 run-5 calls attached a reference.
- **Bad ids fail opaquely:** a PDF filename passed as `documentId` hit a uuid cast; the error reason
  is never logged (run-4 and run-6 audits; `VISION-SUPPORTING-DOC-SHEETNUM-ROUTING.md`).
- **Figure recall was ~45%** in gen 6 (winston#162), so the guide often lacked the figure that mattered.

## 6. Reference images in completeness-check (exploration)

### 6.1 What a reference would be in CC

CC asks "is it there and is it right", not "was the reviewer's comment fixed", so its references differ from CRC's:

| Kind | Example | Source |
|---|---|---|
| **Guide figure** | the required title-block layout; a TCM detail; an example analysis-point table for CC-21 | authored once per guide version, stored beside the guide |
| **Same submission, another place** | "does the legend on sheet 9 match the one on sheet 4" | a crop of another sheet, made at call time |
| **Prior version** | U0's drainage area map next to U1's | the previous plan-set version's thumbnail |

### 6.2 Decisions (directional)

**D1. Extend the existing CLI; don't add a tool.** `bin/vision.ts` gains reference and region
flags. Both the review agents and `cc-compare` adjudicators already call it, `vision-log.jsonl` and
`2.11` already account for it, and a Bash CLI avoids the SDK tool-deferral regression that hit
`crc_vision_check` (`crc-workflow/bugs/SDK-VISION-TOOL-DEFERRAL-REGRESSION.md`).

**D2. Guide figures are addressed by id and carry their own caption.** A guide gets a `## Figures`
section and a `figures/` folder in its versioned guide dir:

```diff
 jurisdictions/austin/completeness-check/v2.8/
   cc-21.md                       # + "## Figures" listing F1, F2 with captions
+  figures/cc-21/F1.png
+  figures/cc-21/F1.md            # the caption: what it is, what it shows, what it does NOT show
```

The agent passes `--ref cc-21/F1`. The CLI attaches the image **with the guide's caption**. The
agent may add a note but can't replace the caption. This closes the DE-30 failure mode.
`1.4-resolve` already copies the whole guide dir into the run (`cc.py:293`), so no new staging is
needed.

**D3. The agent can point.** A `--region` flag takes a normalized box `x,y,w,h` (0–1) on the sheet
and crops it at native resolution. A `--tile r2c3` flag names a tile from §4.3. A future
`--block <n>` would crop a content block by its stored bbox (Q5). In claude mode the crop replaces
the "whole + all tiles" bundle. In gateway mode the crop is sent instead of the whole sheet.

**D4. Same call shape in both modes.** Order matches CRC: the target image (or crop) labelled
TARGET, then each reference labelled with its id and caption, then the instructions, then the
question. In claude mode the references are copied into the child's scratch dir and listed in the
prompt with their captions.

**D5. Everything is logged.** `vision-log.jsonl` gains `refs: [{id, sha256, caption}]` and
`region`. Bad ids exit non-zero with a reason, and the reason is logged (fixing the CRC gap).
At most 4 references per call.

```diff
 node $RUNBOOK/bin/vision.ts
   --document-id <id> [--sheet <n>]
   --item-ids <ID,...>
   --prompt "<question>"
+  [--ref <guide>/<figure>]...          # guide figure, caption attached from the guide (D2)
+  [--ref-sheet <documentId>:<n>[@x,y,w,h]]   # another sheet or a prior version, optionally cropped
+  [--region x,y,w,h | --tile r2c3]     # what to look at on the target (D3)
```

### 6.3 Open questions

- **Q1. Which CC guides need a reference?** Candidates: CC-21 (its own text says analysis-point
  tables and pond sections "are frequently graphical"), title block and seal checks, legend checks.
  The way to find out is to look at which `cc-compare` disagreements came from vision misreads.
- **Q2. Who authors guide figures, and from what?** Hand-cropped from code PDFs, from real accepted
  submissions (with permission), or from the generate-crc-guides figure census pointed at CC sources?
- **Q3. What resolution does Claude actually see?** `VIEW_PX = 2000` in `vision.ts` vs 1568 in
  `annotate-crop.ts`. Measure what Read does to a 2000 px tile before tuning tiles or crops. Also
  confirm prod's thumbnail DPI.
- **Q4. What do references cost in claude mode?** Each reference is another Read, and so more
  tokens on the seat. The ledger gap (winston#296 F3) makes this invisible until fixed.
- **Q5. Should regions be addressed by content block?** `block-manifest.json` has block bboxes. A
  `--block` flag would let vision evidence cite a block, which `prompt.md:211-226` forbids today.
- **Q6. Prior-version references for resubmissions:** is that a CC feature, or does it belong to CRC?

## 7. Testing seams (proposed, not yet agreed)

**S1: the vision CLI** (existing — `bin/vision.test.ts`)
- **Proves:** D2–D5 — ref resolution and caption attachment, region and tile cropping, prompt order, log fields, and refusals with reasons.
- **Prior art:** `bin/vision.test.ts` (tileGrid, claudeArgs, claudeChildEnv).
- **Runs:** `node --test` in `runbooks/completeness-check/bin`, locally and in bureau CI.

**S2: a cc-compare loop** (existing — `runbooks/cc-compare`)
- **Proves:** that references change verdicts where the answer key says vision misread, on one guide with figures.
- **Prior art:** the Lamar v4 compare loops (`runbooks/cc-compare/answer-keys/lamar-v4.json`).
- **Runs:** a paid run, only on Will's go.

## 8. PR plan (proposed)

**P1: region and tile targeting** — `bureau`
- **Blocked by:** nothing (can start now).
- **Delivers:** `--region` / `--tile` in both modes, plus the log fields and refusals with reasons (D3, D5).
- **Tested at:** S1.
- **Door:** two-way.
- **Blast radius:** every CC vision call, if the default path is touched; the flags are opt-in.

**P2: guide figures and `--ref`** — `bureau`
- **Blocked by:** P1.
- **Delivers:** the `figures/` and caption convention, `--ref`, the review-prompt section, and one guide (Q1's pick) with figures (D1, D2, D4).
- **Tested at:** S1, then S2.
- **Door:** two-way.
- **Blast radius:** runs that use the new guide version.

**P3: `--ref-sheet`** — `bureau`
- **Blocked by:** P2 and an answer to Q6.
- **Delivers:** references cropped from another sheet or a prior version.
- **Tested at:** S1.
- **Door:** two-way.
- **Blast radius:** opt-in.

## 9. Not yet specified

- How the review prompt teaches the agent when a reference is worth its cost. CRC's 62-of-538 suggests agents under-use them, so the prompt matters as much as the flag.
- Whether the annotate step's own crops (`annotate-crop.ts`) and the vision CLI's crops should share one cropping helper.

## 10. Out of scope

- Porting `crc_vision_check` itself, or touching the CRC workflow. CRC moves to a runbook on its own schedule.
- The conductor ledger gap for claude-mode vision sessions (winston#296 F3).
- Changing the default vision mode (winston#296).
