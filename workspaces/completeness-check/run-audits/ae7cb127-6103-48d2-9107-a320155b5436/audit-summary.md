# CC Run Audit Synthesis — `ae7cb127-6103-48d2-9107-a320155b5436`

**Run label:** `2026_07_07_ROW_fix_take_1` · **Project:** `23301a8a-…` · **Ran:** 2026-07-07T17:57:41Z → 18:17:07Z (~19m 26s wall)
**Config:** runs=5, model=`claude-haiku-4-5-20251001`, checklist `v2.7-trimmed` (14 groupings / 194 items), maxWorkers=35, uncertainThreshold=0.35, explainUncertain=true (`sonnet-4-6`, 10 workers). Baseline path (no experiment).
**Framing:** proactive end-of-run health audit — no user-visible symptom triggered it. Goal: certify data quality and surface latent gaps before they compound.

---

## 1. Overall verdict: **HEALTHY WITH NOTES**

The run's data plane is trustworthy end-to-end. All 194 checklist items were evaluated by all 5 runs with zero missing votes, all IDs bare (no fragmentation), zero structured-output retries, zero clamp-rule drift, and the 194→194 join carries cleanly through consolidate → enrich → format-reports → build-review-comments with correct Pape-Dawson comment numbering (194 unique numbers, zero fallback assignments). The 4-fail / 6-warn / 16-uncertain distribution is real cross-run disagreement, not artifact. The "notes" that keep this off HEALTHY are (a) one applicant-facing uncertain explanation nulled by a false-positive regex on the English word "runs" (1/16 externals lost, internal trace preserved), (b) two isolated vision-tool failures on supplementary PDFs called with `sheetNum=1` (2/173 = 1.2%, findings unaffected), (c) `workflow/status.json` was never re-uploaded at end (still shows `in-progress` while DB shows `completed`), (d) `enriched-findings.json` doesn't carry the uncertain-explanation fields (fields reach the user via later steps, but the intermediate artifact is misleading), (e) `apply-forced-outcomes` command carries an unrendered `{{ input.forceOutcomes }}` literal masked by `existsSync` — benign here, latent hazard. Every one of these is bounded; none silently corrupted the shipped review.

## 2. Executive summary — how the pipeline behaved

The `review` step ran 70 haiku-4-5 agent cells (14 groupings × 5 runs). Every cell emitted exactly the expected number of findings (194 × 5 = 970 total), every `checklistItemId` came back BARE (not `grouping:ID` fragmented), and no cell tripped a structured-output retry (0 `error_max_structured_output_retries`, `StructuredOutput=89` for 70 cells reflects double-emissions after re-thinking, not repair invocations) — attribution goes to prompt discipline (`review.md:133-167` dedicates ~35 lines to the emit envelope + bare-ID examples) combined with conductor-side grouping injection at `structured-output-repair.ts:259`, which together make the ID contract a shape the model reliably meets on the first try. Two of 173 vision calls failed — both on supplementary PDFs (Location Map, Engineering & Drainage Report) called with `sheetNum: 1` when the plan-set loader (`vision-file.ts:51`) only understands `sheetNum` for the primary 57-sheet site plan. Neither degraded findings; the affected cells emitted their full item counts using other evidence and both consolidated to pass. `enabledVisionSpecialists` was set but silently ignored (no experiment overlay), and the specialist-routing dead code was not surfaced to the operator.

`cross-run-consolidate-cc` voted 194 items in 0.6s. All 16 uncertains are real 3/5 or 2-2-1 disagreements — 12 at 3-2 splits (winnerShare=0.6, right at the 0.65 gate), 2 at 3-1-1, 2 at 2-2-1 tie-broken by severity — zero missing-vote-driven uncertains, zero clamps needed (per-run findings already respected Fail Status policy), zero unknown refs, zero fragmentation. `apply-forced-outcomes` correctly no-op'd in 0.7s — the `{{ input.forceOutcomes }}` mustache went un-rendered but was caught by `existsSync`, and the stale foreign TSV `1700-s-lamar-forced-outcomes.tsv` colocated in the checklist dir was NOT loaded. `prepare-uncertain-explanation-inputs` produced 16-of-16 fully hydrated input files with real bureau checklist metadata (no degraded stubs, no `failStatus` defaults) and full 5-run `perRunFindings` propagated to each. `explain-uncertain` (sonnet-4-6, 10 workers) produced 16-of-16 well-formed applicant-facing + internal-trace explanations in 2m 59s, held the emit schema on every call, and honored the "don't adjudicate" contract (all 16 uncertains stayed uncertain). `collect-uncertain-explanations` fan-in was 16→16, but its forbidden-terms regex `\bruns?\b` (`collect-uncertain-explanations.ts:75`) matched the literal English "runs" in "the retaining wall runs along the southern portion" for `cc-23:CC-23-08` and null-filled that item's external field (internal trace preserved). Downstream, `enrich-findings` joined all 194 with zero clamp-rule drift and zero degraded lookups; `format-reports` (single sonnet-5 cell, 2m 41s) had to pivot to a self-written Python script when it hit the 256KB Read cap on the 387KB `enriched-findings.json`, but produced all 14 grouping reports + consolidated report + 194-entry `rephrased-items.json` (all composite keys, 0 bare-ID). `build-review-comments` (0.6s) mapped all 194 refs to their canonical Pape-Dawson comment numbers with zero fallback-counter assignments; provenance stamps (checklistVersion, bureauCommitHash, uncertainThreshold) all correct.

**Counterfactuals — safety nets that held:**
- If the regex-based over-broad `\bruns?\b` guard had matched >50% of externals it would have `process.exit(1)` the collector (`:231`) — at 6.25% it silently under-shipped one item.
- If `pape-dawson-comment-num-mapping.tsv` had been sparse, the fallback counter seeded above `max(map)` (`build-review-comments.ts:176-178`) would still have produced collision-free numbers.
- If any per-run findings file had been JSON-corrupt, it would have surfaced as `voteBreakdown.missing > 0` in consolidated — none did.
- If a `grouping:ID`-prefixed checklistItemId had slipped through, enrich's lookup would have degraded silently to `failStatus='fail'` (warn-policy inversion); dormant on this run because prompt discipline held.

## 3. Step-by-step status table

| # | Step | Verdict | Wall | Items | Key metric |
|---|---|---|---|---|---|
| 0 | `review` | 🟡 HEALTHY W/ NOTES | 13m 38s | 70 cells / 970 findings | Bare-ID 100%; 2/173 vision failures, findings unaffected |
| 1 | `cross-run-consolidate-cc` | 🟢 HEALTHY | 0.6s | 194 votes | 0 missing votes; 0 unknown refs; 0 clamps; 16 uncertain all real splits |
| 2 | `apply-forced-outcomes` | 🟢 HEALTHY (no-op) | 0.7s | 0 | Unrendered mustache masked by `existsSync`; stale foreign TSV not loaded |
| 3 | `prepare-uncertain-explanation-inputs` | 🟢 HEALTHY | 0.5s | 16 | 16/16 fully hydrated; 0 degraded stubs; `warn` and `fail-or-warn` policies preserved |
| 4 | `explain-uncertain` | 🟡 HEALTHY W/ NOTES | 2m 59s | 16 | 16/16 schema-clean, 0 retries; 16/16 ref-echo held; enriched-findings.json doesn't carry fields |
| 5 | `collect-uncertain-explanations` | 🟡 HEALTHY W/ NOTES | 0.6s | 16 | 15/16 externals shipped; 1 false-positive lint-reject on English "runs" |
| 6 | `enrich-findings` | 🟢 HEALTHY | 0.5s | 194 | 194/194 join clean; 0 clamp-rule drift; consolidatedStatus stamped on all 194 |
| 7 | `format-reports` | 🟡 HEALTHY W/ NOTES | 2m 41s | 14+1+194 | 14 grouping reports; 194 rephrased entries all composite; per-grouping status counts match enriched exactly |
| 8 | `build-review-comments` | 🟡 HEALTHY W/ NOTES | 0.6s | 194 | 194 canonical Pape-Dawson numbers; 0 fallback assignments; 0 legacy-key hits |

## 4. What went right — with numbers

- **Bare-ID hygiene 100 %.** Agent-1 confirms zero occurrences of 2+ colons across 194 consolidated refs; zero fragmentation-driven vote splits. Prompt discipline (`review.md:133-167`) + conductor grouping injection (`structured-output-repair.ts:259`) is the machinery. (Agent 1 §"ID contract"; Agent 2 §"Coverage / integrity".)
- **194 ↔ 194 coverage.** Checklist manifest = 194 items; per-cell finding counts match checklist tables for all 14 groupings; consolidated = 194; enriched = 194; rephrased-items = 194; review-comments = 194. Every join lossless. (Agents 1, 2, 7, 8, 9.)
- **Zero retry storms.** `error_max_structured_output_retries` count = 0 across 970 review findings + 16 sonnet-4-6 explain-uncertain calls + 1 sonnet-5 format-reports call. `StructuredOutput=89 / 70 cells` is double-emission, not repair. (Agents 1, 5.)
- **Unanimous voter distribution.** 156 items unanimous 5/5, 22 decisive at 4/5, 16 uncertain at 3-2 or 2-2-1, 0 at 3/5 decisive (sharp gate). (Agent 2 §"Confidence distribution".)
- **Uncertain gate correctness.** All 16 uncertains verified against `winnerShare ≤ 0.65` formula including 2-2-1 severity tie-break (`STATUS_SEVERITY` at `consolidate-logic.ts:55-60`). Zero uncertains missing-vote-driven. (Agent 2 §"Vote spot-check", Agent 4 §"Silent fallbacks — audit sweep".)
- **Collector fan-in 16→16.** No `existsSync` fallbacks tripped in `prepare-uncertain-explanation-inputs`; no ref-mismatch or attribution-mismatch guard trips in `collect-uncertain-explanations`; anti-misattribution held on every cell. (Agents 4, 6.)
- **Comment numbering integrity.** 194 unique `commentNumber`s, `diff` empty against `pape-dawson-comment-num-mapping.tsv`, zero fallback-counter assignments. Downstream prior-review triage (`priorReviewId=54d5c002-…`) will join cleanly. (Agent 9 §"Numbering integrity".)
- **Cache locality on explain-uncertain.** The 7 cc-13 items share a grouping-context prefix — cc≈7k / cr≈59.7k per item vs. cc≈35k / cr≈32k for singletons. Design-appropriate; no cost anomaly. (Agent 5 §"Model / cost".)
- **Enrich clamp-rule agreement.** `enrich-findings` re-runs `clampStatus` as backstop; zero disagreements vs `cross-run-consolidate-cc` on all 194. Rule drift between the two implementations is nil. (Agent 7 §"What went right" item 3.)
- **rephrased-items.json 100 % composite keys.** 194 keys, 0 bare — the known collision-hazard join point in `build-review-comments` is safe on this run. (Agents 8, 9.)

## 5. What went wrong — ranked by severity

1. **Applicant-facing external explanation nulled by regex false positive.** `collect-uncertain-explanations.ts:75` uses `{ reason: 'run-reference', re: /\brun\s*\d+\b|\bruns\b|\brun\b/i }`. The `\bruns\b` alternate matched the English verb in "the retaining wall runs along the southern portion of the site" (agent output for `cc-23:CC-23-08`). Result: `uncertainExplanation=null, failureReason='lint-reject'` in `uncertain-explanations.json` and `review-comments.json` comment #168; internal `agentTraceUncertainExplanation` preserved. 1/16 externals silently lost. Invisible in `completeness-check.log` because conductor discards script stdout. (Agent 5 §"Root-cause analysis", Agent 6 §"Root-cause analysis".)
2. **`workflow/status.json` still `in-progress` at end.** DB `completed_at=18:17:44Z`; state file never re-uploaded on step 8 completion. Any consumer trusting the JSON state file over DB will misread this run as still running. (Agent 1 §"What went wrong" item 3.)
3. **Two vision-tool failures.** `vision-file.ts:51` inside `getFileContent` failed for `documentId=777f2782…` (Engineering & Drainage Report, run-3 cc-20) and `documentId=dd5b866a…` (Location Map, run-2 cc-1), both called with `sheetNum: 1`. Root cause: agent applied the plan-set `sheetNum` framing to supplementary PDFs, which don't have per-sheet slicing. Both cells still emitted full findings using other evidence; no downstream degradation. 2/173 = 1.2 % failure rate. (Agent 1 §"Vision tooling".)
4. **`format-reports` per-grouping blockquote passed through un-regenerated.** Enrich copies `groupings[i].summary` verbatim from the review-produced field; after `consolidatedStatus` stamps `uncertain` on some items, the pre-consolidate summary becomes stale. E.g. cc-21 blockquote says "1 item fails" while the display table shows 1 fail + 1 uncertain (tentative fail). Format-reports faithfully passes it through — the fix is either to regenerate summaries after cross-run stamping, or to have format-reports rewrite them. Not user-visible as a bug per se, but inconsistent. (Agent 8 §"What went wrong" item 2.)
5. **`enriched-findings.json` never carries uncertain-explanation fields.** `workflow.yaml:262-269` doesn't pass `uncertainExplanationsFile` to `enrich-findings`; the explanations only reach the user via later steps. 0/16 uncertain findings in `enriched-findings.json` carry `uncertainExplanation` or `agentTraceUncertainExplanation`. Misleading to anyone auditing the run from the enriched artifact. Documentation gap, not a correctness gap. (Agent 5 §"What went wrong" item 2, Agent 7 §"Handoff contract".)
6. **`apply-forced-outcomes` command carries unrendered `{{ input.forceOutcomes }}` literal.** `workflow.yaml:198` renders the arg template unconditionally; conductor doesn't substitute when input absent, and the rendered path `…/v2.7-trimmed/{{ input.forceOutcomes }}` is masked by `existsSync` failing benignly. Latent hazard: the current guard cannot distinguish "operator meant no override" from "operator typo'd filename" from "template render bug". (Agent 3 §"What happened" item 2 + §"Observability gaps" 1–3.)
7. **Stale foreign TSV in shared checklist dir.** `bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/1700-s-lamar-forced-outcomes.tsv` belongs to a different project. Not loaded on this run (input not passed), but nothing prevents a future operator from typo-triggering it. (Agent 3 §"What happened" item 5.)
8. **`enriched-findings.json` at 387 KB exceeds Read tool's 256 KB cap.** `format-reports` recovered by writing/executing a Python generator script, cost 1 extra turn. On future runs with more evidence/turn this will keep tripping. (Agent 8 §"What went wrong" item 1.)
9. **`enabledVisionSpecialists` input silently ignored.** Baseline path doesn't route to `vision_check`; the operator's set value is dead code with zero feedback. (Agent 1 §"What went wrong" item 2.)

## 6. What we don't know / open questions

- **Whether the collector regex false-positive has affected prior CC runs.** The regex has been in place across recent runs. Any historical CC run for this project (or other projects) whose uncertain items included site-plan prose with linear-feature language ("runs along", "runs adjacent", "storm drain runs to", "utility runs east") would have silently lost the applicant-facing explanation. **Candidate runs to sample:** any completeness-check run under `projectId=23301a8a-4cdb-4751-ac0c-93b97f0f5c12` (Lamar + Collier site plan — retaining walls, ROW curbs, drainage runs are all in-vocabulary), plus the prior review `54d5c002-4648-4fb0-b22d-d222cbbd02f9` explicitly linked from this run. A one-shot query would filter `output/uncertain-explanations.json` for `failureReason='lint-reject'` grouped by review_id.
- **Whether the two vision `sheetNum`-on-supplementary-PDF failures occur systematically or were idiosyncratic to this pair of documents.** Confirming would require sampling vision-log across recent runs.
- **Whether `format-reports`'s Python generator path is deterministic across model temperature.** The agent chose that recovery on this run; a different sonnet-5 turn budget could exhaust turns before pivoting.
- **Whether the "stale grouping summary" pattern happens in every run** or only ones with uncertains that flip the display-status count vs. the review agent's pre-consolidate accounting. Sampling required.

## 7. Cross-cutting observability theme

**Every single per-step audit flagged the same root cause: the conductor discards script stdout/stderr, so every step's `console.log`/`console.warn` diagnostics are invisible in the pino log.**

Explicitly noted in:
- Agent 1 §"Observability gaps & remediations" (baseline vision tool no prompt attribution; overlaps with the memory note `baseline_vision_tool_prompt_traceability_gap.md`).
- Agent 2 §"Observability gaps & remediations" item 1: `CLAMP-PRE-VOTE`, `stripped grouping prefix`, `Loaded … runs`, `Consolidated: … items`, `unique refs match no checklist` — all present in the script at `cross-run-consolidate-cc.ts:280-300,381-385`, all discarded.
- Agent 3 §"Observability gaps" item 1: `apply-forced-outcomes.ts` no-op decision (`console.log` at `:284`) discarded.
- Agent 4 §"Observability gaps" item 1: `SKIP (forced)` / `NOTE: cc-XX has no Validation Methodology…` discarded.
- Agent 5 §"Observability gaps" item 6: lint-reject count `{total: 16, refMismatches: 0, ..., lintRejects: 1}` discarded.
- Agent 6 §"Observability gaps" item 1: `REF-MISMATCH`, `LINT-REJECT`, `TRIPWIRE` warnings at `collect-uncertain-explanations.ts:134,154,163,223,232` all discarded — this is the one that ACTIVELY hid the cc-23:CC-23-08 nulling on this run.
- Agent 7 §"Observability gaps" item 6: `enrich-findings.ts` `CLAMP:` / `WARNING: … clamp-rule drift` / `Loaded consolidated findings: …` discarded.
- Agent 8 §"Observability gaps" item 1: `format-reports` self-report and Python-script telemetry never surfaced.
- Agent 9 §"Observability gaps" G1: `build-review-comments.ts` `Loaded comment numbering map`, `Loaded consolidated findings`, `WARNING: … not found in numbering map`, `WARNING: N titles resolved via legacy bare-ID rephrased keys` all discarded.

**Highest-leverage fix:** conductor either (a) tees each step's stdout/stderr into the pino stream as structured `{step, level, msg}` events, or (b) requires each script to write a `output/<stepname>.summary.json` sidecar with well-defined per-step fields. Option (b) is a couple of lines per script and easier to schema-validate; option (a) covers ad-hoc warnings that don't fit any sidecar. Ideally both.

## 8. Recommended remediations — ranked

| # | What | Where | Effort | Would have caught (this run) |
|---|---|---|---|---|
| 1 | Loosen collector `run-reference` regex: drop bare `\bruns?\b` / `\brun\b` alternates; keep `\brun\s*\d+\b` and add review-pass-scoped forms `\bruns?\s+(?:\d+|that|which|found|concluded|noted|passed|failed|read)\b`. | `workflow/scripts/collect-uncertain-explanations.ts:75` | S | The nulled `cc-23:CC-23-08` external — 1/16 externals recovered. |
| 2 | Pipe every step's stdout/stderr into pino as structured events, and/or emit `output/<stepname>.summary.json` per step. | conductor + each `workflow/scripts/*.ts` | M | The invisible lint-reject warning above; the invisible CLAMP/drift signals; invisible NOTE-no-methodology; invisible legacy-key warnings. |
| 3 | Wire `uncertainExplanationsFile` to `enrich-findings`; stamp `uncertainExplanation` + `agentTraceUncertainExplanation` onto enriched findings whenever `consolidatedStatus=uncertain`. | `workflow.yaml:262-269`, `enrich-findings.ts` | S | Auditors reading `enriched-findings.json` would find the fields where they expect them. |
| 4 | Ensure `workflow/status.json` is re-uploaded on final step completion (step 8). | conductor post-step cadence | S | The stale `in-progress` state on this run. |
| 5 | Fail-fast on unrendered `{{ input.* }}` in rendered commands. | conductor command dispatcher | S | The `apply-forced-outcomes` mustache-literal path masking. |
| 6 | Add `if: "{{ input.forceOutcomes }}"` gate on the `apply-forced-outcomes` step, AND require the file to resolve to a real file (no `existsSync`-hiding). | `workflow.yaml:194`, `apply-forced-outcomes.ts:280-287` | S | Belt-and-braces with #5. |
| 7 | Tool-side fix in vision loader: on "not a plan-set" branch, drop `sheetNum` and retry (`getFileContent`). Or reject `sheetNum` at the tool schema when documentId isn't a plan-set. | `src/shared/vision-file.ts:51`, `src/tools/vision/index.ts:109` | M | Both vision failures on this run. |
| 8 | Regenerate per-grouping `summary` blockquote in `enrich-findings` after `consolidatedStatus` stamping (or in `format-reports`). | `enrich-findings.ts` OR `format-reports.md` prompt | M | The cc-21 "1 item fails" stale summary. |
| 9 | Move forced-outcomes TSVs to a per-project location (or prefix filename with `projectId`). | filesystem convention + workflow.yaml | S | Removes cross-project typo-trigger hazard from stale `1700-s-lamar-forced-outcomes.tsv`. |
| 10 | Add JSON-schema `pattern` on `checklistItemId` in `completeness.emit.schema.json` (e.g. `^[A-Z]+(-[A-Z0-9]+)+$`), and cross-check in `cross-run-consolidate-cc.ts` that each per-run finding's ID appears in its grouping's item list. | `workflow/schemas/completeness.emit.schema.json:12-14`, `cross-run-consolidate-cc.ts` | S | Defense-in-depth against future prompt drift; would not have caught anything on THIS run. |
| 11 | Auto-shard `enriched-findings.json` on 250KB threshold (or teach format-reports to page it) so the 256KB Read cap stops being an implicit dependency. | `enrich-findings.ts` | M | The `format-reports` Read failure + Python-script pivot. |
| 12 | Startup warning in conductor when `enabledVisionSpecialists` is set to a non-default value without `experiment=vision-check`. | conductor workflow-startup | S | The silent no-op input on this run. |
| 13 | Never default `failStatus` on lookup miss in enrich; either fail-loud or gate behind explicit flag. | `enrich-findings.ts:187-249` | S | Latent warn-policy-inversion hazard; not triggered on this run. |
| 14 | Add `--maxLookupMisses` threshold + per-step summary in enrich; assert `totals.total === sum(findings.length) === consolidatedMap.size`. | `enrich-findings.ts` | S | Guards against silent drops; not triggered on this run. |
| 15 | Add assertion in `build-review-comments`: `sum(perSection.comments.length) === enriched.totals.total`; assert `checklistRef ⊆ manifest`; warn on empty `resolution` when `showResolution=true`. | `build-review-comments.ts` | S | The empty resolution on `cc-13:AW-29` #91; defense against future upstream regressions. |

## 9. Verdict on the run's intent (`2026_07_07_ROW_fix_take_1`)

The run label suggests a targeted right-of-way iteration ("ROW fix take 1"). Given what the audit establishes about data health:

- **The run is downstream-consumable.** The 194-comment `review-comments.json` payload is fully populated with canonical Pape-Dawson numbering, provenance stamps, and correct per-status metadata. DB persistence has already fired (`completed_at=18:17:44Z`). Any operator or reviewer working from `priorReviewId=54d5c002-…` triage can trust the `comment_number` join.
- **The 4-fail / 6-warn / 16-uncertain distribution is trustworthy.** Zero fragmentation-driven splits, zero missing-vote-driven splits, zero clamp-rule drift, zero unknown refs, zero coercion retries. The 4 fails and 6 warns reflect genuine per-run agreement (each with 5/5 or 4/5 unanimity per Agent 2's confidence distribution), and each was voted through the same pre-vote Fail-Status clamp used across the codebase.
- **The 16 uncertains are all legitimate.** 0/16 missing-vote-driven; every one is a real cross-run interpretive split (12 at 3-2, 2 at 3-1-1, 2 at 2-2-1). Sonnet-4-6 produced substantive diagnostic traces on every one (sampled 4/16). If the intent of the "ROW fix" iteration was to see whether prior ROW issues resolved, the uncertain slate is genuinely where the model can't decide — not where the machinery failed.
- **One caveat for downstream reviewers.** `cc-23:CC-23-08` (uncertain, comment #168) will surface to the applicant without a plain-English `uncertainExplanation` — the internal `agentTraceUncertainExplanation` is still there, so a reviewer looking at the trace will see the reasoning, but the applicant-facing prose is blank. This is a collector bug, not an agent failing.

Bottom line: this run establishes what it set out to establish. The ROW-oriented findings can be trusted; the audit-visible defects are all in the observability/plumbing layer or in the collector regex, not in the evaluation itself.

---
*Sources: `SHARED_CONTEXT.md`, `agent-{1..9}-*-audit.md` — all in `/Users/winston/noetic/cc-audit/ae7cb127-6103-48d2-9107-a320155b5436/`.*
