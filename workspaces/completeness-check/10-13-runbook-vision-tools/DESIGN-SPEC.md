# How vision works in completeness-check runbook runs

**Status:** Reference v1 (describes the current state; proposes no change)
**Date:** 2026-10-13
**Repos described:** `bureau` (`runbooks/completeness-check/`, at `29dd3450e1`), `inspector-general` (`src/lib/compute/runbook-transcript-slicer.ts`, at `d7b928e`), `conductor` (legacy `src/tools/vision/`, at `fbfd1c4`), `conductor2` (per-step persistence)
**Repos NOT touched:** all of them. This document changes no code.

Companion page: `architecture.html` (system map, activity flows, sequence diagrams, log shapes).

## 1. Why this document exists

The completeness check (CC) has three ways to answer a review agent's "look at this sheet" question, built over two weeks (bureau #1935 → #1951 → #2000 → #2033 → #2099):

| Path | Where | What answers | Default? |
|---|---|---|---|
| Legacy tool | conductor-1 workflow lane (`workflows/completeness-check`) | Gemini 3.1 Pro through the Vercel AI Gateway, called in-process | the legacy lane only |
| Runbook, `visionMode: "gateway"` | conductor2 runbook (`runbooks/completeness-check`) | the same Gemini model and prompt, from a CLI | **yes**, the runbook default |
| Runbook, `visionMode: "claude"` | conductor2 runbook | a one-shot `claude -p` session (Opus 5.5 by default) reading the file natively | opt-in per request |

The gateway mode is the one that "mirrors the old way": it was built as a feature-parity port. The claude mode is the new way. This document maps, for the `2.1-review` step, how a vision request is made per checklist item, which file the model is shown, and every place the request is logged or traced afterwards.

## 2. The three paths

**D1. Legacy tool (conductor-1).** `conductor/src/tools/vision/index.ts` registers an in-process MCP tool named `vision` with inputs `{checklistItemIds, documentId, sheetNum, prompt}`. It loads the file (`src/shared/vision-file.ts`: a sheet's `sheet_version.thumbnail_storage_path` image, or a document's newest `document_version` as a signed URL), sends it to `google/gemini-3.1-pro-preview` with `prompt.md` and the agent's question, and returns the text. It logs the prompt and the sanitized result to the workflow's pino log, and appends a sidecar line to `<workspace>/output/vision-log.jsonl` that holds only `{event, checklistItemIds, documentId, sheetNum, runIndex, success, timestamp}`: no prompt, no response, no image. That missing prompt is the "prompt-traceability gap" the runbook port set out to close.

**D2. The runbook's vision CLI.** `bureau/runbooks/completeness-check/bin/vision.ts` is the legacy tool rewritten as a command the review agent runs with Bash (spec `runbook-v2-port` D20):

```
node $RUNBOOK/bin/vision.ts --document-id <id> [--sheet <n>] --item-ids <ID[,ID…]> --prompt "<question>"
```

It keeps the legacy model, the legacy instructions (`bin/vision-prompt.md`, copied verbatim) and the legacy inputs. `--sheet` targets one sheet of a plan set (`--document-id` is then the plan set's id); without it the document is a supplementary PDF analyzed whole. `--item-ids` is the checklist item(s) this call serves; it is never sent to the model and exists only for attribution. The CLI prints the answer on stdout. It never fails the agent's turn: a file that cannot be loaded prints the legacy text `File could not be loaded. Are you using a valid documentId?` and exits 0, and a model failure prints `File data was successfully loaded, but the analysis by the vision LLM agent failed.` and exits 0. Each case appends one line to the log (§4).

The mode comes from the request's `visionMode` (zod default `gateway`, `steps/1.1-inputs/contract.test.ts:29`), copied into `1.4-resolve/resolved.json` `options.visionMode`. The env var `CC_VISION_MODE` overrides it for one call; `CC_VISION_MODEL` overrides `visionModel`.

**D3. Gateway mode (the parity path).** `generateText` from the `ai` package (installed per run by `bin/deps.sh` into `$RUN/.cc-deps`) with one user message: the file part, then `vision-prompt.md`, then the question. Model `google/gemini-3.1-pro-preview`. Gateway provider options tag the call: `user` = the runbook run id, `tags` = `tool:vision`, `runbook:completeness-check`, `node:2.1-review/<guide>--r<k>`, and `disallowPromptTraining: true` (bureau #2099: route only to providers that agreed not to train on the request). A sheet goes as a base64 JPEG data URL. A document goes as a 300-second signed URL to the **newest** `document_version`, exactly as legacy sent it. Metered on the AI Gateway key (`AI_GATEWAY_API_KEY`).

**D4. Claude mode (the new path).** Set `"visionMode": "claude"` (optionally `"visionModel"`, default `claude-opus-5-5`; Sonnet's answers hedged and the review's "undeterminable means applicable" rule turned hedges into fails). For each call the CLI:

1. writes the file's bytes into `$OUT/scratch/vision/<sha256[:16]>.jpg|pdf`;
2. for a sheet whose long edge is over 2000 px (what Claude views without downscaling), cuts an overlapping grid of full-resolution JPEG tiles (`tileGrid`, 10% overlap, `r<row>c<col>` names, jimp at quality 90), e.g. a 5400 px sheet becomes `r1c1…r2c3`;
3. builds the prompt: `vision-prompt.md`, then where the file is and how to read it (open the sheet, then the tiles that cover the question; for a PDF over 10 pages, read in ranges of at most 20 pages), then "You have no other file, no other tool and no other context", then the question;
4. runs `claude -p <prompt> --model <visionModel> --output-format json --tools Read --allowedTools Read --safe-mode --no-session-persistence` with that folder as its working directory, a 15-minute timeout, and the calling agent's environment minus the nesting markers (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT`). The child inherits the cell's `CLAUDE_CONFIG_DIR`, so it spends the same subscription seat. It refuses to start when `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK` or `CLAUDE_CODE_USE_VERTEX` is set (that would bill something other than the seat);
5. prints the child's `result` text and logs its `session_id`, turns, duration, token usage and `total_cost_usd` (a list-price estimate; the seat is what is actually spent).

**D5. Which file the model sees.** Both modes look first in `1.2-stage-submission/download-manifest.json` (`stagedFile`): a `sheet-raster` entry matching plan set + sheet number, or a `document-pdf` entry matching the document id, with `status: ok`, whose bytes on disk still hash to the manifest's `sha256`. The digest matters because the stager files sheets by number alone, so two plan sets with a sheet 2 share one `sheet-02.jpg` and only one manifest entry matches it. A staged sheet is used in both modes; a staged document is used only in claude mode (gateway mode still sends the signed URL, see Q1). When nothing staged matches, the CLI downloads over PostgREST + Storage with the run token (service-role key as the local fallback): the plan-set version pinned in `1.4-resolve/plan-set-versions.json` (else the newest version), its `sheet_version.thumbnail_storage_path`, or the document's newest `document_version.storage_path`. Reading the stage keeps the review cell off the network, which is what fixed the 2026-10-06 WhiteWater run (66 of 152 calls failed `fetch failed` in the host-lane sandbox before bureau #2000 and conductor2 #147).

## 3. Per checklist item, inside the review step

`2.1-review` fans out one fresh review worker (`runner: review`, Sonnet 5.5) per `<guide>--r<k>` on `1.4-resolve/roster.txt`. Each worker owns one guide's checklist items for one run, and its contract requires exactly one finding per item id in the guide's checklist table (spec `runbook-v2-port` D22; a miss resumes the session with the missing ids).

What the prompt (`steps/2.1-review/steps/review/prompt.md`, "Using the Vision Tool") tells the agent:

- Every sheet and document was already run through vision during preprocessing. Read the transcriptions in `1.2-stage-submission/` first (`README.md` → `facts.md` → each candidate sheet's `guide.md` → `blocks.md` only for relevant sheets; `overview.md` per document).
- Call the vision CLI only for a targeted question the transcription cannot answer. It is slow. Give it all the context; it has no conversation history.
- Use a `documentId` from the stage's `README.md`, never the project id.
- Pass `--item-ids` on every call: usually one id, several only when one look genuinely informs several items.
- The vision CLI is the **only** way to look at a drawing. Do not open the staged `.jpg`/`.pdf` files or crop them. (`AGENTS.md` rule 2: two tools, `vision.ts` and `search.sh`, and nothing else.)

The agent then records, per item in `findings.json`: `observation` (what the transcription and any vision call showed, naming sheets), `reasoning`, `tools_used` (e.g. `["vision"]`), `status`, `explanation`, `resolution`, `evidenceLocations` (document id, sheet, and a block number only when the evidence is a specific transcribed block, never when it was seen only via vision).

So the link from a verdict back to the picture runs through two agent-declared facts, `--item-ids` on the call and `tools_used` on the finding, plus the log line the CLI writes itself.

## 4. Logging and tracing

**D6. `vision-log.jsonl`.** Every CLI call, success or failure, appends one JSON line to `$OUT/vision-log.jsonl`, i.e. `2.1-review/<guide>--r<k>/vision-log.jsonl`, a declared optional output of the step.

| Field | When |
|---|---|
| `ts, itemIds, documentId, sheet, prompt, response, ok, error?` | every line (`error` is `load: …` or `model: …`) |
| `mode, model, source` | after the file loaded (`source` = `staged` or `storage`) |
| `image: {bucket, storagePath, kind}` | after the file loaded (bureau #2033, 2026-10-07): the `submission-data` object the model was shown |
| `image.sha256`, `image.tiles: [{file,x,y,w,h}]` | claude mode: the materialized file's digest and each tile's rectangle in sheet pixels |
| `file, fileKind, fileBytes, tiles` | claude mode |
| `session_id, num_turns, duration_ms, usage, total_cost_usd` | claude mode |

A line that failed to load has no `mode` (that is what the 66 failures in the WhiteWater gateway run look like). Gateway mode logs no token usage; its spend is visible only in the AI Gateway, by the run-id `user` and the tags of D3. No pixels are uploaded anywhere: the `image` reference plus the tile rectangles are enough to redraw exactly what the model saw.

**D7. `2.11-tool-usage` (the reconciliation).** A zero-token script step (`scripts/tool_usage.py`) reads each review cell's session stream from `$RUN/.logs/` and classifies every Bash command. A real vision invocation (`node …/vision.ts --document-id …`, not `--help`, not `cat vision.ts`) counts as `vision_cli`. Per cell it writes `tool-usage.json` with `vision: {cli_calls, log_entries, reconciled, claude_sessions?}` and `flags.binary_reads` (any direct image or PDF read, which the prompt forbids). `summary.json` totals the claude-mode child sessions as `vision_claude_sessions` (they spend the seat outside conductor's ledger) and lists cells whose call count does not match their log lines as `vision_unreconciled`. It is evidence, never a gate.

**D8. The verdict trail into the app.** `findings.json` `tools_used` travels unchanged through consolidation (2.2), forced outcomes (2.3) and enrichment (2.7) into 2.9's `review-comments.json`, where each comment carries `agentTrace: {observation, reasoning, tools_used, forced?, organicStatus?}` (`workflows/completeness-check/scripts/build-review-comments.ts:267`), and 3.1 publishes it into `review_comments`. The log line itself does not go into the review rows.

**D9. Persistence and Inspector General's Agent Debug.** conductor2 persists the run (`runbook.yaml` `persist:`) to the private `runbook-runs` bucket: `<runId>/steps/2.1-review/<guide>--r<k>/vision-log.jsonl`, `findings.json`, and the worker's session stream as `<runId>/logs/2.1-review_review--<guide>--r<k>.<attempt>.jsonl.gz`. Step `3.2-ig-postprocess` sends `ig/review.postprocess.requested` with the published review id. IG's `runbook-transcript-slicer.ts` then:

1. reads `<runId>/persisted.json`, downloads the session logs and turns each into the workflow-slicer's record shape;
2. renames each Bash call that ran `bin/vision.ts` to a `vision` tool call and attributes it to the ids in its `--item-ids` flag (`bin/search.sh` calls become `semantic-search`, attributed by `--item-id`);
3. joins each `vision-log.jsonl` line to the call that ran it (`joinRunbookVisionLog`): among calls that started no later than the line's `ts` + 1 s, the one whose command contains the first 80 characters of the line's prompt, else the latest; a line with no candidate is counted as unmatched and warned;
4. enriches the call with `renderedPrompt`, `visionCalls` (each line's sheet, document, ok, error, response, image), `resolvedImages` and `tileCrops`; a line from before bureau #2033 has no `image`, so IG re-derives it the way `vision.ts` resolved it and marks it `derived`;
5. uploads one slice per cell to `inspector-general/ig-derived-review-outputs/<reviewId>/transcripts/<grouping>/<runIndex>.json`, which the Agent Debug page and `/api/transcripts` read.

**D10. cc-compare.** The adjudicator in `runbooks/cc-compare` (step `2.1-adjudicate`) reads the review cells' `vision-log.jsonl` and may itself call the same vision CLI to settle a disputed item.

**D11. Not the vision CLI: comment markings.** `2.12-annotate` (Opus, after the verdicts) locates failing findings on the page by reading rendered crops natively. It is the one exception to `AGENTS.md` rule 2, renders no verdict, and is reported in its own section of `2.11-tool-usage` (`pixel_reads`).

## 5. What real runs look like

| Run (local dir under `~/noetic/working/completeness-check/`) | Mode | Vision log lines | Notes |
|---|---|---|---|
| `whitewater-car-wash-v1-cc27` (review 75a6449c, 2026-10-05) | gateway | 152 | 86 ok; 66 `load:` failures (host-lane sandbox, before bureau #2000) |
| `WWCW_rb2_run2_claude_vision` (review d36b7aad, 2026-10-06) | claude | 76 | all ok and staged; 76 child sessions, $24.06 list, 51 min of child time; 2 cells unreconciled (`cc-10--r3`, `cc-21--r1`) |
| `whitewater-cc-v1-opus55` | claude | 97 | all ok and staged; lines carry `image` with tiles |
| `sa2008-v1-claude-vision-2` | claude | 63 | all ok and staged |

## 6. Legacy versus runbook, side by side

| | Legacy tool (D1) | Runbook gateway (D3) | Runbook claude (D4) |
|---|---|---|---|
| How the agent calls it | MCP tool call `vision` | Bash: `node bin/vision.ts` | same CLI |
| Model | Gemini 3.1 Pro (gateway) | Gemini 3.1 Pro (gateway) | `claude -p`, Opus 5.5 default |
| Instructions | `prompt.md` | `vision-prompt.md` (verbatim copy) | same, plus how to open the file and tiles |
| Sheet input | thumbnail image from Storage | staged JPEG (digest-checked), else Storage | same file, plus full-resolution tiles |
| Document input | signed URL, newest version | signed URL, newest version | staged PDF (the submission's version), else download |
| Who pays | AI Gateway | AI Gateway (no-training providers only) | the cell's subscription seat |
| Prompt + response logged | workflow pino log only | `vision-log.jsonl` | `vision-log.jsonl` + session usage |
| Image the model saw | not logged | `image` storage reference | reference + sha256 + tile rectangles |
| Item attribution | `checklistItemIds` input | `--item-ids` flag | same |
| Call counting | none | 2.11 reconciles calls vs log | same, plus child-session totals |

## 7. Open questions and gaps

**Q1. The two modes can show a different version of a supplementary document.** Gateway mode always sends the newest `document_version` (legacy parity); claude mode uses the staged PDF, which is the version the submission under review links. For a document re-uploaded after the submission, the two modes analyze different files. Should gateway mode also use the staged version?

**Q2. Claude-mode spend sits outside conductor's ledger.** Only `2.11-tool-usage` totals it (`vision_claude_sessions`), as a list-price estimate. Should it feed the run's budget?

**Q3. Attribution is self-reported.** `--item-ids` is whatever the agent typed (a call without it only warns), and IG's line-to-call join is a heuristic (timestamp + prompt prefix). Unreconciled cells exist on real runs (two in `WWCW_rb2_run2_claude_vision`). Is that accurate enough for per-item vision analysis?

**Q4. `tools_used` is not cross-checked.** A finding can say `["vision"]` with no matching log line, or omit it when a call was made. Nothing compares the two today.

**Q5. Gateway mode logs no usage.** Per-call tokens and cost exist only in the AI Gateway dashboard (by run id and node tag), not in the log line.

**Q6. The tile grid is copied.** IG's slicer carries its own copy of `tileGrid` to redraw tiles for older lines; the two must be kept in step by hand.
