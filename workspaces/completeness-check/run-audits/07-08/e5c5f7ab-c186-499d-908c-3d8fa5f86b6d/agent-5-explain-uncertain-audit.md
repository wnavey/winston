# Agent 5 — `explain-uncertain` Step Audit

Review `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d` · runLabel `2026_07_08_run_2_vision_exp` · 2026-07-08
Auditor scope: execution + output quality of the explain-uncertain agent fan-out. Input-prep/join is another agent's lane (pre-scan: joins clean, 0/19 missing-vote-driven).

**Verdict: HEALTHY**

---

## Step purpose

For each checklist item that came out `uncertain` after cross-run consolidation (indecisive vote across runs=5), a tool-light Sonnet cell reads exactly one input JSON (`output/uncertain-explanation-inputs/<grouping>__<item>.json` — vote breakdown + all five per-run findings) and emits two prose fields via StructuredOutput: `uncertainExplanation` (external, applicant-facing, must hide the multi-run machinery) and `agentTraceUncertainExplanation` (internal, run-by-run divergence diagnosis). Config that ran (`cc-run-output/workflow/workflow.yaml:236-247`): model `claude-sonnet-4-6`, `retries: 3`, `maxWorkers: 10`, `continueOnFailure: true`, `allowEmptyChecklist: true`, schema `uncertain-explanation.emit.schema.json`. Prompt: `cc-run-output/workflow/prompts/explain-uncertain.md`.

## Execution stats

Source: `explain-uncertain` step in `cc-run-output/workflow/run-log.json` (items array) + `type:"result"` lines in `cc-run-output/logs/completeness-check.log`.

- **19/19 cells `done`, zero failures, zero retries.** `continueOnFailure: true` had nothing to mask — no cell exhausted retries; every result line is `subtype: "success"`, `is_error: false`, `terminal_reason: "completed"`, `api_error_status: null`.
- **Zero structured-output retries / schema failures / model errors.** No level ≥ 40 log lines exist for this step; no retry/attempt messages. Every cell: exactly 3 turns — one `Read` of its own input file, one `StructuredOutput` call, done. No cell listed the inputs directory or touched another cell's file (the prompt's cross-contamination hazard did not materialize).
- **Wall clock**: 16:19:10.316Z → 16:22:22.759Z = **192.4 s**. Cell durations 56.0–100.3 s (mean ~76.8 s). Sum of cell-seconds 1,460 → **average concurrency 7.6 vs maxWorkers=10** (two waves: 10 launched immediately, 9 as slots freed; the tail of wave 2 caps utilization — expected shape, fine).
- **Cost (measured, not estimated — result lines carry `total_cost_usd`)**: **$2.833 total, mean $0.149/cell** (min $0.096, max $0.228). Token profile per cell: ~62–67k prompt tokens, dominated by a shared cached prefix (cells hit either 59,750 cache-read or ~32k read + ~34–35k cache-creation on first-touch sessions); output 3.0–5.5k tokens. Input files themselves are small (mean 10.7 KB, max 26.7 KB — `cc-21__CC-21-04.json`); the bulk of the context is the sandbox agent environment, ~95% cache-mitigated. For 19 items this is negligible spend.

## Output integrity

- **1:1**: 19 inputs ↔ 19 results, basenames identical (`output/uncertain-explanation-inputs/` vs `output/uncertain-explanation-results/`).
- **All 19 parse and conform to the emit schema**: exactly the four allowed keys (`additionalProperties: false` respected), both explanation fields non-null strings, `failureReason: null` everywhere (no `input-missing` / `lint-failed` / `empty-output` fallbacks used).
- **Ref echo**: all 19 output `ref` values match the input file's `ref` character-for-character (the anti-misattribution invariant per schema `$comment`).
- **Downstream collector**: `collect-uncertain-explanations` ran clean — no ref-mismatch, attribution-keyword, forbidden-terms, or >50%-null tripwire warnings in the log (only Executing/Completed lines). Merged `output/uncertain-explanations.json` holds all 19 refs, 0 nulls.
- **Lint sweep of all 19 external fields**: zero hits for the hard forbidden terms — `run(s)`, `vote`, `majority`, `passes/attempts`, `facts.md`/`blocks.md`, `block <N>`, `vision`, `semantic search`, `checklist item`, file paths, UUIDs, "X of Y", "reviews disagreed". External length 755–1,480 chars (~3–6 sentences), on-spec. Internal fields 3.4–5.6k chars, thorough.

## Quality assessment (8-item sample across vote shapes)

Sampled: `cc-10:AE-01` (2p/3f), `cc-21:CC-21-01` (1p/2f/2w three-way), `cc-21:CC-21-04` (3f/2w), `cc-13:AW-07` (3p/2na), `cc-24:CC-24-13` (2w/3na), `cc-3:CC-3-24` (3p/2f), `cc-23:CC-23-07` (2p/2f/1na), `cc-6:CMP-01` (2p/3f).

**Disagreement characterization: accurate and specific.** Internal traces name every run and verdict (19/19 outputs name all 5 runs; automated check), and the diagnoses go beyond restating votes to the *mechanism* of divergence:

- `cc-21:CC-21-04` internal correctly separates two failure modes: "*driven by two distinct mechanisms: a factual misread of the Sheet 24 table in one run, and a protocol-interpretation divergence in another*" — and calls out Run 2's misread explicitly ("*recorded AP-1 as fully compliant across all four storms… This is a direct f[actual error]*"). That is exactly the internal diagnostic value the spec wants.
- `cc-3:CC-3-24` internal: "*There is no divergence in document access… The split (3 pass, 2 fail) is entirely an interpretive disagreement about how literally the label on the approval block must match the Notes and Templates DOCX specification.*"
- `cc-24:CC-24-13` internal even surfaces pre-clamp detail: "*both warn votes had emittedStatus 'fail' before being clamped by the failStatus:'warn' policy*" — implementation detail correctly confined to the internal field.
- Vote arithmetic in internal traces matches the input `voteBreakdown` in all sampled cells; missing-vote arithmetic correctly noted as N/A (0 missing everywhere, consistent with pre-scan). Three cells (`cc-22:CC-22-19`, `cc-22:CC-22-27`, `cc-3:CC-3-23`) skip the summary vote-count header and go straight to run-by-run — a formatting inconsistency, not an accuracy issue.

**External fields: honest, neutral, applicant-appropriate.** The two-sided structure lands consistently, grounded in real sheet references (all sheet cites in the sample trace back to `perRunFindings[].evidenceLocations`):

- `cc-13:AW-07`: "*The case for this item passing is that the table is present and fully filled in… However, the case for the item being not applicable is that the condition… — multiple buildings with dedicated meters — is not triggered by a project with only one building… Please review.*" Neutral, no leaning, no verdict.
- `cc-10:AE-01` gives the applicant an actionable pointer: "*examination of that same sheet also identified what appears to be corrupted or garbled text within Note 2… Please review the completeness and readability of the Austin Energy standard notes on Sheet 5.*"
- Single-pass voicing generally holds: "*Review of the plan set found…*", "*On one reading… However…*".

**Leaks: one borderline case, no hard violations.** `cc-23:CC-23-07` external contains "*these were read by some evaluations as satisfying the completeness requirement*" — "some evaluations" implies plural evaluators and skirts the spec's "some passes" example, though it uses none of the enumerated forbidden terms and the collector's lint passed it. Softer variants ("*conflicting readings of the plan set*" in cc-23-07/cc-21-04, "*these two readings*" in cc-24-16) are defensible as one-reviewer phrasing. 1 borderline / 19 ≈ 5% — cosmetic, worth a prompt tweak (add "evaluations/assessments (plural)" to the forbidden list), not a defect.

**No internal artifacts in external fields**: block numbers, run indices, documentIds, and vision/tool mentions appear only in internal traces (e.g. cc-10 internal cites "Block 21" and quotes the garbled OCR text; cc-13 internal cites documentId and Block 7 — none of it leaks externally).

## Cost/benefit

All 19 explanations address genuine 5-run vote disagreement (0 missing-vote artifacts), so there is no artifactual-uncertainty waste to charge against the step. On decision value: these are **not** checklist-item restatements. Externals tell the applicant/reviewer *what specifically is contested and where to look* (garbled Note 2 on Sheet 5; the unacknowledged AP-1 2-yr increase vs the acknowledged AP-3 increases; whether plantings on Sheet 53 sit inside the ROW — "*Please review the planting plan relative to the property line and back of curb*"). Internals tell engineers *why the ensemble split* (factual misread vs threshold interpretation vs applicability-condition reading), which is directly actionable for guide-file tightening — e.g., cc-13:AW-07 and the three cc-24 warn/na splits are pure applicability-condition ambiguity, a checklist-wording fix, and the traces say so. $2.83 for 19 of these is clearly worth it.

## What went right

- 19/19 first-attempt success; zero retries, schema failures, or model errors; retries=3 + continueOnFailure never exercised.
- Perfect tool discipline: every cell read exactly its own input file — the wrong-file misattribution hazard the prompt/schema guard against did not occur, and ref-echo passed 19/19.
- Forbidden-terms lint: 0 hard violations across all 19 external fields; collector guards all silent-pass.
- Internal traces are genuinely diagnostic (divergence mechanism, pre-clamp emittedStatus, protocol-matching analysis), not vote-count boilerplate.
- Throughput fine: 3.2 min wall for 19 cells at avg concurrency 7.6/10.

## What went wrong

Nothing material. Minor items:

1. One borderline external leak ("*read by some evaluations*", `cc-23:CC-23-07`) — plural-evaluator phrasing the current lint doesn't catch.
2. Internal-trace format drift: 3/19 omit the leading vote-breakdown summary line (content still complete).
3. `cc-13:AW-07` internal speculates about the decisiveness threshold ("*appears to have fallen below the decisiveness threshold*") rather than knowing it — the input doesn't carry the threshold, so the agent guessed (correctly-hedged, but a data-gap symptom).

## Observability gaps & remediations

1. **run-log items are thin** (`run-log.json` explain-uncertain items: only `index`/`value`/`startedAt`/`endedAt`/`status`). Attempt count, cost, and turns exist in the pino result lines but require log archaeology. Add `attempts`, `costUsd`, `numTurns` to per-item run-log entries — especially since `continueOnFailure: true` means a retry-exhausted cell would today show only as a missing output file plus a null-filled merge.
2. **`uncertaintyKind` input flag**: have prepare-uncertain-explanation-inputs classify each item (`vote-disagreement` | `missing-vote-dilution` | `warn-vs-na-applicability`) so (a) the agent doesn't infer the shape, (b) audits can bucket waste without reading 19 files. This run: 19/19 genuine disagreement, but the flag makes that a one-liner next time.
3. **Pass the decisiveness threshold in the input** so internal traces state it instead of speculating (gap #3 above).
4. **Extend the external-field lint** (prompt line 40 + collector) with plural-evaluator phrasings: "evaluations", "assessments", "reviews" (plural, as actors), "some/other readings by".
5. **Collector guard outcomes aren't logged on success** — only Executing/Completed. Log per-guard counters (refs checked, lint hits=0, nulls=0/19) so a silent pass is distinguishable from a guard that didn't run.

## Key paths

- Step config: `cc-run-output/workflow/workflow.yaml` lines 236–247 (step), 91–108 (input params)
- Prompt: `cc-run-output/workflow/prompts/explain-uncertain.md`; schema: `cc-run-output/workflow/schemas/uncertain-explanation.emit.schema.json`
- Per-cell status: `cc-run-output/workflow/run-log.json` → steps[4].items (19 × `done`)
- Inputs/outputs: `cc-run-output/output/uncertain-explanation-inputs/`, `.../uncertain-explanation-results/`, merged `.../uncertain-explanations.json`
- Cost/usage: `cc-run-output/logs/completeness-check.log`, `"type":"result"` + `"step":"explain-uncertain"` lines (fields `total_cost_usd`, `usage`, `num_turns`)
