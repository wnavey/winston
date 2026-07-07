# Agent 1 — `review` step audit

**Review ID:** `ae7cb127-6103-48d2-9107-a320155b5436`
**Project:** `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` (Lamar + Collier, SP-2026-0136C)
**Run label:** `2026_07_07_ROW_fix_take_1`
**Ran:** 2026-07-07T17:57:41Z → 18:11:19Z (13m 38s wall for this step)
**Verdict:** **HEALTHY WITH NOTES**

---

## Step purpose

The `review` step is the agent fan-out that evaluates every checklist item. In this run, one cell per (grouping × runIndex) = 14 groupings × 5 runs = 70 agent cells were launched, each processing all items inside a single `cc-*.md` grouping file and emitting a `findings[]` array validated against `completeness.emit.schema.json`. The grouping ID is injected by conductor from the cell's filename; the agent never emits it. Downstream consolidation (majority vote across the 5 runs) depends on every cell returning an exhaustive `findings[]` under bare, non-fragmented checklist IDs.

## What happened

### Coverage — perfect

Per-cell finding counts across all 70 cells vs the checklist grouping tables (rows under `## Checklist Items` in each `cc-*.md`):

| Grouping | Table items | Emitted per cell (5 cells) | Match |
|---|---|---|---|
| cc-1  | 33 | 33, 33, 33, 33, 33 | ✅ |
| cc-2  | 6  | 6, 6, 6, 6, 6      | ✅ |
| cc-3  | 11 | 11, 11, 11, 11, 11 | ✅ |
| cc-5  | 14 | 14, 14, 14, 14, 14 | ✅ |
| cc-6  | 3  | 3, 3, 3, 3, 3      | ✅ |
| cc-10 | 4  | 4, 4, 4, 4, 4      | ✅ |
| cc-13 | 37 | 37, 37, 37, 37, 37 | ✅ |
| cc-15 | 14 | 14, 14, 14, 14, 14 | ✅ |
| cc-19 | 22 | 22, 22, 22, 22, 22 | ✅ |
| cc-20 | 6  | 6, 6, 6, 6, 6      | ✅ |
| cc-21 | 10 | 10, 10, 10, 10, 10 | ✅ |
| cc-22 | 14 | 14, 14, 14, 14, 14 | ✅ |
| cc-23 | 11 | 11, 11, 11, 11, 11 | ✅ |
| cc-24 | 9  | 9, 9, 9, 9, 9      | ✅ |
| **Total** | **194** | **194 × 5 = 970** | ✅ |

Consolidated file has exactly 194 items (`output/consolidated-findings.json`), matches the total. Zero cells skipped items; zero cells over-emitted; zero missing votes across all 194 consolidated items (`jq '[.[] | .voteBreakdown.missing] | add'` = `0`).

### ID contract — all IDs bare, zero fragmentation

- `workflow/prompts/review.md:170` says: `checklistItemId`: "The ID from the checklist table (e.g., 'FP-01')." Prompt models the bare form; nothing anywhere directs the agent to emit `cc-N:` or grouping-prefixed IDs.
- Prompt lines 133–167 are extremely explicit about the emit envelope, dedicating ~35 lines to the `findings[]`-as-top-level rule, listing wrong shapes verbatim, and telling the agent NOT to emit `grouping` ("(The `grouping` ID is derived from your grouping file's filename and injected for you — you do not emit it.)").
- `workflow/schemas/completeness.emit.schema.json:12-14` — `checklistItemId` is `type: string` with **no `pattern` constraint**. The healthy signal came from prompt discipline + strict `required: ["findings"]` at the emit envelope, NOT from schema regex enforcement.
- Grouping is canonicalized by conductor at `conductor/src/agent/structured-output-repair.ts:181,259` (`normalizeStructuredOutput` → `deriveGroupingFromChecklistItem`), stamping `grouping` onto the persisted per-cell JSON from the checklist item's basename before the write to `output/runs/run-N/findings/cc-M.md.json`. All 70 persisted files carry the expected `grouping: "cc-M"` field.
- Sampled IDs match the checklist verbatim including irregular suffixes (`AW-38a`, `AW-38b` from `cc-13.md`). Consolidated refs contain zero occurrences of 2+ colons (`jq '[.[] | select(.ref | test(":.*:"))] | length'` = `0`).

**Attribution for the healthy outcome:** prompt discipline (bare `FP-01` example, zero examples of prefixed IDs, explicit "you do not emit `grouping`") + conductor-side grouping injection. Schema-side pattern enforcement is absent — so this depends on model behavior, not machinery.

### Reliability — no retry storm

- Log: 30,300 lines, 2 error-level entries. Zero occurrences of `error_max_structured_output_retries`, `coercion`, or `"retry"` — confirms zero structured-output repair invocations.
- All 70 cells reached `status: done` in `workflow/run-log.json`. Zero cell timeouts, zero cell failures.
- Tool-invocation counts across the whole log:

| Tool | Calls |
|---|---|
| Read | 1297 |
| Bash | 212 |
| mcp__conductor_tools__vision | 173 |
| mcp__conductor_tools__run_semantic_search_blocks | 114 |
| StructuredOutput | 89 |
| conductor_tools (bootstrap) | 70 |
| mcp__conductor_tools__semantic_search_blocks | 2 |
| Write | 1 |
| TaskCreate / TaskUpdate | 2 |

`StructuredOutput=89` for 70 cells means ~19 cells emitted a second output (double-emission after re-thinking, not a schema retry). No cell exceeded `retries: 5`.

- Per-cell wall-clock (from `run-log.json`, N=70 cells):
  - p50 = 241 s, p90 = 392 s, max = 455 s (`cc-22.md` run-4 — index 62 in schedule).
  - Step wall = 818 s; sum of per-cell wall = 17,600 s → effective parallelism ≈ 21.5 cells in flight on average against `maxWorkers=35`. Under-utilization is a scheduling artifact of the small cell count (70 cells, batched in waves as workers freed), not a queue-depth issue.
  - Per-grouping avg / max (seconds): cc-13 383/446, cc-22 363/455, cc-23 331/395, cc-15 273/451, cc-5 264/313, cc-1 252/279, cc-3 252/320, cc-24 237/296, cc-2 237/397, cc-21 198/251, cc-19 184/244, cc-6 180/264, cc-20 175/256, cc-10 169/203. The two largest groupings (cc-13 with 37 items, cc-22 with 14 items but heavy floodplain/hydrology content) dominate.

### Vision tooling — 173 dispatches, 2 failures, both graceful

- Every cell's agent used the standard `vision` tool (baseline path) — no `vision_check` dispatcher was invoked (`grep -c vision_check` in log = `0`), and no `runs/run-*/vision-check-calls/` artifact directory exists.
- The `enabledVisionSpecialists=generic-vision,inspect-drawing,measure-distance` input **is a documented no-op on this run**. Baseline `workflow/prompts/review.md` only advertises the plain `vision` tool (line 9: "Using the Vision Tool"). Neither `inspect-drawing` nor `measure-distance` shows up as a tool_use anywhere in the log (only echoed once in workflow inputs at the top). The specialists only route when `experiment=vision-check` sets a `vision_check` overlay tool; `experiment` was unset on this run.
- `output/vision-log.jsonl` accounting (173 events):

  | outcome | count |
  |---|---|
  | success | 171 |
  | error | 2 |

- Failure signatures (both `Vision: failed to load file …` at `src/shared/vision-file.ts:51` inside `getFileContent`, propagated from `src/tools/vision/index.ts:109`):

  | runIndex | grouping | plan_set_id | sheet | Actual doc |
  |---|---|---|---|---|
  | run-3 | cc-20.md | `777f2782-6933-4af3-8010-e26c52311541` | 1 | Engineering & Drainage Report (supplementary PDF) |
  | run-2 | cc-1.md | `dd5b866a-144e-457d-8bc3-fbf523e3d3cb` | 1 | Location Map (supplementary PDF) |

- **Origin of those IDs — corrects SHARED_CONTEXT:** these are **not** stale IDs inherited from `priorReviewId`. Both IDs are current-submission supplementary documents that appear verbatim in `projects/{projectId}/README.md` (items 6 "Location Map" and 12 "Engineering And Drainage Report" under `## Supplementary Documents`). The failure category is:

  > Agent called `vision(documentId=<supplementary PDF>, sheetNum: 1)`, but `getFileContent` in `src/shared/vision-file.ts:51` looks the ID up in the plan-set-versions table (used for the primary site plan `908ffab5-…`), not the supplementary-docs table. Supplementary PDFs don't have a per-sheet slicing layer, so any `sheetNum` argument routes through the plan-set path and errors.

  Evidence that this is a "correct doc, wrong tool argument" story: `777f2782` was called **4 other times WITHOUT `sheetNum`** on this same run — every one of those 4 calls succeeded (`vision-log.jsonl`). Only the single call that included `sheetNum: 1` failed. The agent found the doc and could read it as a full document; it just picked up the `sheet-N` framing from the primary-site-plan mental model and applied it to a supplementary PDF that isn't sliced that way.

- **Downstream impact — none.** run-3 cc-20 emitted all 6 findings with `tools_used: []` (the vision tool call didn't attach to any finding's citation), all pass, consolidated 5/5 pass; run-2 cc-1 emitted all 33 findings, again complete. No degradation. Two isolated tool failures out of 173 = 1.2 % failure rate, and both times the agent recovered by using other evidence sources (`observation` texts on both affected cells cite primary-site-plan sheet analysis, not the failed calls).

### Overlay drift — N/A

Baseline path. `experiment` unset in inputs (`workflow/status.json`). Overlays at `workflow/experiments/{inspect-drawing,vision-check}/` were dormant. Stock `workflow/prompts/review.md` was the effective prompt.

---

## Root-cause analysis

The two vision failures share one root cause:

**Root cause:** The vision tool's plan-set loader (`src/shared/vision-file.ts:51`) treats every `sheetNum`-bearing call as a plan-set-versions lookup, but the review prompt (`workflow/prompts/review.md:16`) tells the agent *only* to pass a `documentId` — without instructing the agent (a) which document classes accept `sheetNum` and which don't, or (b) that supplementary PDFs must be requested without `sheetNum`. Nothing in the tool schema at request time rejects the malformed pair. Any Sonnet/Haiku call that pattern-matches "site plan sheets are addressed by sheetNum, apply the same to this supplementary PDF" will fail at the loader.

**Contributing:** The primary site plan is described in README as "57 sheets" with each sheet addressed by number (`Sheet 1 [Cover Sheet]` etc., seen in the README dump at line 21). Supplementary docs in the same README are single-file PDFs. The prompt does not warn about this asymmetry.

**Why the healthy outcome elsewhere:** attribution for the perfect coverage / bare-ID / zero-retry outcome is the combined effect of (a) explicit prompt scaffolding for the emit envelope (`review.md:133-167` dedicates ~35 lines to the wrapper problem, listing wrong shapes verbatim), (b) example IDs in bare form only (`review.md:141-144,170`), (c) lenient emit schema that removes the strict-`grouping` requirement (drops the biggest retry-storm trigger — see the emit-schema `$comment` at line 2), (d) conductor-side grouping injection at `normalizeStructuredOutput` (`conductor/src/agent/structured-output-repair.ts:259`). Together these turn the ID contract into a shape the model reliably meets on the first try.

## What went right

- **All 970 findings emitted** (194 items × 5 runs), zero missing votes, zero fragmented IDs, zero retry-storm invocations.
- **Prompt discipline paid off.** The dedicated "CRITICAL — `findings` is a TOP-LEVEL parameter" section (`review.md:133-161`) plus lenient emit schema + `deriveGroupingFromChecklistItem` injection is the machinery that kept this healthy. Zero structured-output failures across 970 findings on a haiku-4-5 model.
- **Semantic-search adoption.** 114 `run_semantic_search_blocks` calls across the 70 cells (~1.6 per cell) means the "don't fail because content is on a non-obvious sheet" guidance in the prompt (lines 26–38) is being followed.
- **Vision tool failures degraded gracefully.** Two out of 173 vision calls (1.2 %) failed and neither compromised the affected cell's findings. Neighbor calls to the same document succeeded, so the agent didn't hemorrhage retries on the failed IDs (no cascading retry, no timeout).
- **Timing stayed within maxWorkers=35 envelope.** p90 = 392 s per cell, wall-clock 818 s. The step could easily absorb 4 more concurrent groupings if we added a 6th run.
- **Effective downstream continuity.** `format-reports` and `build-review-comments` steps both completed; DB `completed_at=2026-07-07T18:17:44Z` even though `workflow/status.json` remained `in-progress` (final state file was never re-uploaded — Agent 7 or 8 territory).

## What went wrong

- **Two vision failures** on supplementary-PDF documentIds paired with `sheetNum: 1`. Category: agent calling convention mismatch, not tool infrastructure failure. Documented above.
- **`enabledVisionSpecialists` input silently ignored.** The workflow accepts and echoes `generic-vision,inspect-drawing,measure-distance`, but the baseline review prompt does not route to `vision_check`, so specialist selection is dead code on this path. This is a documented experiment gating (workflow.yaml:130-140 notes "Only applies when `experiment=vision-check`") but it means an operator setting the input on a baseline run gets zero feedback that their preference has no effect.
- **`workflow/status.json` remained `in-progress`.** Not a review-step defect per se, but the review step's output continues to be consumed downstream while the workflow-run state file lags. Any consumer trusting `status.json` for run completeness will misread this run.

## Observability gaps & remediations

- **Baseline `vision` tool has no prompt-traceability** — `output/vision-log.jsonl` writes `{event, documentId, [sheetNum], success, timestamp}` only. There's no prompt, no checklist-item attribution, no cell-level linkage. This is the same known-gap flagged in memory (`baseline_vision_tool_prompt_traceability_gap.md`) — a fix would let us attribute the 2 failing calls to specific `run-3 cc-20 CC-20-2X` findings and the 4 successful `777f…` calls to whichever cells used them. Remediation: conductor patch to add `runIndex`, `checklistItem`, `checklistItemId`, and `prompt` to each vision-log event.
- **No schema-side ID enforcement.** `completeness.emit.schema.json:12-14` has no `pattern`. If prompt discipline slips (e.g., a future rewrite drops the bare-ID example), fragmentation like `cc-3:CC-3-14` could re-emerge silently. Remediation: add a `pattern` on `checklistItemId` at the emit schema level (e.g., `^[A-Z]+(-[A-Z0-9]+)+$`), and a cross-check in `cross-run-consolidate-cc.ts` that fails loudly if a per-run finding's `checklistItemId` isn't in the grouping's item list.
- **Silent no-op inputs.** `enabledVisionSpecialists` is accepted and echoed on baseline runs but does nothing. Remediation: conductor should either (a) warn at workflow-startup when a non-default value of `enabledVisionSpecialists` is set without `experiment=vision-check`, or (b) return the same warning in `workflow/status.json`'s `runtime` block so audits catch dead-code inputs.
- **Vision-tool document-class awareness.** The `sheetNum`-on-supplementary-PDF class of failure is diagnosable at the tool layer: `getFileContent` can distinguish "not a plan-set" from "plan-set but no version" and return a structured error message that the agent (or the tool wrapper) can convert into a retry-without-sheetNum. Remediation: in `src/shared/vision-file.ts:51`, differentiate the two miss modes; in `src/tools/vision/index.ts:109`, on the "not a plan-set" branch, drop `sheetNum` and re-call `getFileContent` before returning failure to the agent. Would eliminate the 2 / 173 failure rate outright.
- **`workflow/status.json` stale end-state.** Whichever final step should have re-uploaded the state file didn't. Cross-reference with the format-reports / build-review-comments audits (Agents 7 & 8). Remediation: conductor's post-step upload cadence should include a final status-file re-upload on step 8 completion.

---

## Verdict: **HEALTHY WITH NOTES**

Coverage, ID discipline, and reliability are all clean on the primary review-agent path. The two vision-tool failures are isolated, well-understood, and did not degrade findings. The main "notes" are observability gaps (vision-log traceability, silent no-op inputs, absent ID-format schema pattern) and one narrow tool-side fix (supplementary-PDF `sheetNum` handling) that would eliminate the last two error-level log lines.

