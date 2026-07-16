# CRC Run Audit — Agent 1: Performance & Stability

**Review:** `ed5e7ba9-ba03-4000-abb4-1021ebec0631` · **Submission version:** `4cfe4c36-c14e-4f5f-8b71-27c6fe3ed677` (v5 resubmission — real review run)
**Run label:** `2026-07-14-v5-crc-game-day-run-1` · gen 6 · model `claude-sonnet-4-6` · **5 runs × 24 guide files = 120 cells** · maxWorkers=35 · enrichComments=false · jurisdiction=austin
**Execution:** CLOUD (Inngest/dispatcher, Vercel Sandbox host `486322bc-395`, pid 118); artifacts uploaded to `workflow-runs/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-07-14-183605`
**Logs analyzed:** `comment-resolution-check.log` (96,460 lines, 112 MB) + `comment-resolution-check-error.log` (9 lines) + `output/vision-log.jsonl` (676 lines)

## Verdict: **HEALTHY WITH NOTES**

## Executive summary

- **Run completed cleanly in ~82 min end-to-end** (log span 78.9 min, 17:17:11 → 18:36:06 UTC + ~2.9 min workspace upload/DB finalization to the DB's 18:38:59 completed timestamp). All **120/120** review cells produced valid findings; consolidated output = **291 items (166 failed / 76 resolved / 49 uncertain), every one with runCount 5/5** — exact match to the DB row.
- **Retry storm: YES — but a NEW variant, small and fully recovered.** 2 `agent.structured_output.coercion_failed` events, both on **crc-SP-3** (run-1 and run-4), both with signature `topLevelKeys:["__unparsedToolInput"]` / `schema_errors:[]` — a JSON **parse** failure of the StructuredOutput tool input, *not* the double-wrap envelope bug. Zero double-wrap signatures anywhere. The bug doc's zero-event closure criterion is **NOT met** on sonnet-4-6; ~70 min of agent compute was wasted and the run-4 storm set the review step's finish line (~7 min of wall-clock added).
- **Context compaction: 2 auto-compactions** (crc-SP-2/run-1 @ 168,603 pre-tokens; crc-DE-1/run-4 @ 173,205), zero `compact_failed`. Neither compacted cell stormed — but both had a failed (unparseable) StructuredOutput emit attempt *before* compacting, i.e. the oversized-emit problem and the oversized-context problem co-travel on the same big guides.
- **Stability is otherwise excellent:** only 5 level-50 and 4 level-40 lines in 96,460. The 3 non-storm errors are one recoverable vision-tool issue (agent passed a nonexistent plan_set_id, `e3412be0…`, 3 times in crc-SP-1); vision tool itself went **673/676 success**. Zero rate-limit events.
- **The run is tail/critical-path-bound, not worker-bound.** Time-weighted average in-flight = **24.9 of 35 (71%)**; the last 19 min ran below 10 in-flight and the final ~10 min was a single cell (the crc-SP-3/run-4 storm retry). Splitting SP-3/SP-2/CA-1/DE-1 and killing the storm buys far more than raising maxWorkers.

---

## 1. Outcome

| Check | Result |
|---|---|
| Completion | Log runs through all steps to `Uploading workspace files` (line 96460, `time=1784054165792` = 18:36:05.8 UTC); DB `workflow_runs` row completed 18:38:59Z. **Complete.** |
| Review cells | **120/120** — `output/runs/run-{1..5}/findings/` each contain exactly 24 `.md.json` files (verified by count per dir) |
| Item accounting | `Claimed item, launching agent` ×120, `Wrote structured output` ×120, `Item completed` ×120; review-step summary (line 96399) reports `total:120, queued:0`. No dropped cells. |
| Consolidated | `output/consolidated-findings.json` = **291 items: 166 failed / 76 resolved / 49 uncertain** — exact match to the DB reference; **all 291 have `runCount: 5`** (full 5/5 votes, no partial-vote items) |
| Retries | 2 outer-loop retries (both crc-SP-3, see §5); both succeeded on retry attempt 1 — no cell exhausted the outer loop |
| Downstream steps | consolidate, enrich-findings, rephrase-titles, upload-titles-cache, build-crc-review-comments, validate-review-output all `Step completed`; 3 enrichment steps correctly `Step skipped (condition not met)` (enrichComments=false) |
| Artifact quirk | `RUN_DIR/workflow/status.json` reads `"status":"in-progress"` — same known snapshot-before-finalize quirk as the 07-13 baseline. Not a defect. |

## 2. Total wall-clock & macro-phases

First event `1784049431065` (`Conductor starting`, line 1) → last event `1784054165792` (`Uploading workspace files`, line 96460) = **4,734,727 ms = 78.91 min**. DB start→complete = 17:17:11 → 18:38:59 = **81.8 min**; the ~2.9 min gap after the last log line is the workspace upload (including this 112 MB log) + DB save, which by construction can't appear in the uploaded log.

| Phase | Start (UTC) | Duration | % of log span |
|---|---|---:|---:|
| Startup (env, workspace prep) | 17:17:11.1 | 24.9 s | 0.5% |
| fetch-crc-guides (script) | 17:17:35.9 | 43.3 s | 0.9% |
| **review (120 parallel agent cells)** | **17:18:19.3** | **4,625.5 s (77.09 min)** | **97.7%** |
| consolidate → … → validate (7 steps) | 18:35:24.8 | 41.0 s | 0.9% |
| Workspace upload + DB finalize (post-log) | 18:36:05.8 | ~173 s | (outside log) |

## 3. Per-step timing

From `Executing step` / `Step completed` pairs (line numbers cited):

| Step | Type | Lines | Duration | Per-cell avg | Notes |
|---|---|---|---:|---:|---|
| fetch-crc-guides | script | 17→20 | 43,319 ms | — | Guide download from `crc-guides` bucket |
| **review** | agent ×120 | 21→96400 | **4,625,532 ms** | mean **962 s**, median 884 s | **Dominates: 97.7% of wall-clock.** 115.5k agent-seconds = **32.1 agent-hours** compressed into 77.1 min |
| cross-run-consolidate-crc | script | 96401→96404 | 576 ms | — | Deterministic vote merge |
| enrich-findings | script | 96405→96408 | 452 ms | — | |
| prepare-enrichment-inputs / enrich-final-comment / collect-enriched-final-comments | — | 96409–96417 | ~1 ms each | — | Skipped (enrichComments=false) |
| rephrase-titles | agent | 96418→96447 | 37,586 ms | — | Single agent call; only non-review agent step |
| upload-titles-cache | script | 96448→96451 | 1,233 ms | — | |
| build-crc-review-comments | script | 96452→96455 | 576 ms | — | |
| validate-review-output | script | 96456→96459 | 571 ms | — | |

**Cell duration distribution (n=120):** min 55 s · p25 448 s · median 884 s · mean 962 s · p90 1,623 s · p95 2,077 s · max 3,730 s. Max/median = **4.2×**; slowest guide (crc-SP-3, mean 36.9 min) is **34×** the fastest (crc-RW, mean 1.1 min).

## 4. Steps that struggled

Everything outside the review step was sub-second-to-44s and error-free. Within review, the pain concentrates on a handful of guides:

**Top slow cells** (all durations include queue-free agent time; storm cells include the outer retry):

| Cell | Duration | Why |
|---|---:|---|
| crc-SP-3 / run-1 | **62.2 min** | Storm: 38.8-min first session → coercion_failed (line 71853) → 7s backoff → 23.2-min retry session |
| crc-SP-2 / run-1 | 55.4 min | 1 unparseable emit attempt + auto-compaction @168.6k tokens; recovered |
| crc-SP-3 / run-4 | **53.1 min** | Storm: 31.6-min first session → coercion_failed (line 93460) → 21.4-min retry. **Last cell to finish; set the review step's end time.** |
| crc-DE-1 / run-3 | 39.5 min | Naturally heavy guide |
| crc-CA-1 / run-3 | 35.6 min | Naturally heavy guide |
| crc-CA-2 / run-2 | 34.6 min | 1 unparseable emit attempt; recovered |

**Per-guide means (5 cells each), the heavy tail:** crc-SP-3 36.9 min · crc-SP-2 29.6 · crc-CA-1 27.7 · crc-DE-1 27.6 · crc-SP-1 26.3 · crc-CA-2 26.2. Bottom of table: crc-RW 1.1 min, crc-IW 4.0, crc-LDE 4.3. The SP family + CA-1/CA-2 + DE-1 are the critical path on every run.

**Recovered emit stumbles (below-storm severity):** 29 assistant-transcript lines show StructuredOutput arriving as `__unparsedToolInput` (unparseable tool-input JSON) across **17 cells**: crc-SP-3/run-4 ×7 and run-1 ×6 (the two storms), crc-WQ/run-3 ×2, and 1 each on crc-SP-3/run-2, crc-SP-2/run-1, crc-SP-1/run-5, crc-PR/run-2, crc-DE-1/run-4, crc-CM runs 1/2/4/5, crc-CA-3 runs 1/3/5, crc-CA-2/run-2, crc-CA-1/run-2. 15 of 17 cells recovered within the SDK's internal retry budget; only the two crc-SP-3 cells exhausted it.

## 5. Retry-storm verdict: **YES** (2 events — new variant; closure criterion **NOT met**)

Searched the full 112 MB log and the error log for every signature in `winston/workspaces/comment-resolution-check/crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md`:

| Signature | Count |
|---|---:|
| `agent.structured_output.coercion_failed` | **2** (lines 71853, 93460) |
| `coercion_repaired` | 0 |
| `topLevelKeys:["findings"]` (classic double-wrap) | 0 |
| `topLevelKeys:["data"]` / `["output"]` / `["properties"]` (gen-2 wrapper drift) | 0 / 0 / 0 |
| `must have required property 'grouping'` | 0 |
| `/findings: must be array` | 0 |
| `exhausted structured-output retries` | 2 |
| `agent.structured_output.normalized`, `strategy:"inject_grouping"` (benign lenient path) | 120 (every cell, exactly once) |

**The 2 events are a different failure mode than the bug doc describes.** All 5 attempts in both events show `topLevelKeys:["__unparsedToolInput"]`, `hasFindingsArray:false`, `schema_errors:[]` — the model's StructuredOutput tool input **failed JSON parsing entirely** (consistent with a very large findings payload being truncated mid-emit), so ajv never even ran and conductor #197's structural repair had nothing parseable to repair. This is *not* the wrap-the-envelope reflex; the envelope fixes (conductor #197 + bureau #459) appear fully effective against their target shapes on sonnet-4-6 (0 wrapper signatures in 120 cells).

- **Cells affected:** 2 — `crc-SP-3/run-1` (index 5) and `crc-SP-3/run-4` (index 77). Both on the single largest-mean-duration guide (20 checklist items, mean cell time 36.9 min).
- **Recovery:** both fully recovered on outer retry #1 after a ~7 s backoff (lines 71855, 93468); both cells' findings files are present and valid; no findings lost.
- **Timeline:** run-1 claimed 17:18:19, stormed 17:57:08 (38.8-min session discarded), retry done 18:20:29. run-4 claimed 17:42:20, stormed 18:13:55 (31.6-min session discarded), retry done 18:35:24 — the very last event of the review step.
- **Wasted-call estimate:** 2 × 5 = **10 wasted StructuredOutput attempts**, plus **~70 min of discarded agent session time** (38.8 + 31.6 min of tool calls/vision/reasoning re-done from scratch). Wall-clock impact ≈ **7.0 min**: without the run-4 storm the review step would have ended at the next-latest completion (crc-CA-1/run-5, 18:28:26) instead of 18:35:24.
- **Closure criterion:** the primary bar (zero `coercion_failed`) is **NOT met** (2 > 0). The finer bars: `coercion_repaired`=0 (nothing repairable-but-wrapped occurred — the wrapper reflex itself looks closed), but "wasted internal attempts" is decidedly non-zero (29 unparsed attempts across 17 cells). Recommend the bug doc gain an addendum: on sonnet-4-6 the residual failure mode is **emit-size/truncation (`__unparsedToolInput`)**, concentrated on the largest guides, not envelope shape.

## 6. Stability / error breakdown

**Error log (9 lines) categorized:**

| Category | Count | Detail |
|---|---:|---|
| Vision file-load errors (level 50) | 3 | `crc-vision-check: failed to load primary file e3412be0-07b0-4378-8a60-a38736dbbf60` — "No plan set version found for plan_set_id". crc-SP-1/run-1 (sheets 1, 2; 17:32:19–17:33:48) and crc-SP-1/run-4 (sheet 1; 17:48:31). The agent invoked vision with a document UUID that has no plan-set version (also visible as 5 `Calling crc-vision-check: e3412be0…` lines incl. `sheet undefined` ×3). Both cells recovered and completed. Tool-usage root-causing is Agent 3's lane; stability impact here: **negligible, recoverable**. |
| Structured-output coercion_failed (level 50) | 2 | §5 |
| Outer-retry warnings (level 40) | 4 | 2× `Item failed, retrying after 7s backoff` + 2× `Retrying item after 7s backoff`, both for the §5 storms |

**Whole-log totals:** level-50 = **5**, level-40 = **4**, out of 96,460 lines — a 0.009% error-line rate. Zero rate-limit hits (`isRateLimit:true` count = 0), zero sandbox/infra errors, zero DB-save errors.

**Vision tool (count only, detail → Agent 3):** 676 calls logged in `vision-log.jsonl`, **673 success / 3 failure** (the same `e3412be0` plan_set misses). 99.6% tool success rate; no stability impact.

## 7. Context compaction: **2 events** (both auto; no failures; no overlap with the storm cells)

`grep compact_boundary` → 2 hits; `compact_failed|compact_error` → 0.

| Cell | Line | Time (UTC) | Trigger | pre_tokens | Cell outcome |
|---|---|---|---|---:|---|
| crc-SP-2 / run-1 (index 6) | 91817 | 18:11:02 | auto | **168,603** | Completed 18:13:42 (55.4-min cell, 2nd slowest of the run) |
| crc-DE-1 / run-4 (index 90) | 92760 | 18:12:30 | auto | **173,205** | Completed 18:16:13 (28.9-min cell) |

- **Storm overlap:** none at the coercion_failed level — the storm set is {crc-SP-3/run-1, crc-SP-3/run-4}, the compaction set is {crc-SP-2/run-1, crc-DE-1/run-4}; disjoint cells *and* disjoint guide files. Neither storm-then-compact nor compact-then-storm occurred, so neither directional pathology applies this run.
- **But a softer overlap exists:** both compacted cells emitted exactly one unparseable StructuredOutput attempt (§4) *before* compacting — crc-SP-2/run-1 at 18:08:49 (compact 18:11:02), crc-DE-1/run-4 at 18:09:33 (compact 18:12:30) — then recovered post-compaction. Sequence: giant-emit parse failure → SDK retry → auto-compact → clean emit. The oversized guides drive both symptoms.
- **Clustering:** compactions (SP-2, DE-1) and storms (SP-3 ×2) all land on guides with mean cell times ≥ 27.6 min. This is exactly the profile the `crc-sp` split pattern exists for — **crc-SP-3 (mean 36.9 min, 20 items, 2 storms), crc-SP-2 (29.6 min, 22 items, 1 compaction), crc-DE-1 (27.6 min, 21 items, 1 compaction), and crc-CA-1 (27.7 min, 20 items)** are the split candidates.
- Baseline contrast: the 07-13 run had **0** compactions across 72 cells. Sonnet-4-6's longer, tool-heavier sessions (676 vision calls here vs 148 there) push the big guides over the auto-compact threshold.

## 8. Concurrency / throughput

- **Peak in-flight: 35/35** — pool saturated immediately at review start (17:18:19).
- **Time-weighted average in-flight: 24.9 of 35 (71%)** — 115,480 agent-seconds over a 4,625-s span. With 120 cells > 35 workers there was genuine queueing: the last of the 120 claims happened at t+44.3 min (e.g. crc-SP-3/run-4 claimed t+24.0 min, run-5 t+34.7 min).
- **Drain profile:** in-flight last touched 35 at t+44.4 min (32.7 min before end); fell below 20 at t+53.6, below 10 at t+57.9, below 5 at t+61.6, and below 2 for the final **9.8 min** — a single cell (crc-SP-3/run-4 storm retry). Completions per 10-min bucket: 14, 18, 23, 21, 20, 17, 5, 2.
- **Tail-bound, with a throughput floor:** perfect packing of 32.1 agent-hours on 35 workers = **55.0 min** minimum; the longest cell (crc-SP-3/run-1 incl. storm, 62.2 min) is the infinite-worker floor; actual = 77.1 min. So ~15 min of the gap is queue+tail interaction, and ~7 min of that is directly the run-4 storm (§5).
- **Would more workers help?** Marginally — unlike the 07-13 baseline (72 cells ≤ 35×2), 120 cells does oversubscribe the pool, so ~45–50 workers would pull heavy run-4/run-5 cells earlier and shave maybe 8–12 min. But the higher-leverage fixes are (a) eliminating the SP-3 storms (−7 min directly, −70 min compute) and (b) splitting the ≥27-min guides (drops the infinite-worker floor from ~62 to ~20 min). **Do not raise maxWorkers before doing those.**

## 9. Baseline comparison (bfb4f256, 2026-07-13, v4 calibration, 3×24 cells, per its audit header model=claude-haiku-4-5)

| Metric | 07-13 baseline (72 cells) | This run (120 cells, sonnet-4-6) |
|---|---|---|
| Wall-clock (log span) | 49.3 min | 78.9 min (~82 min incl. DB finalize) |
| Review step | 47.5 min (96.4%) | 77.1 min (97.7%) |
| Cell median / mean / max | 594 / 914 / 2,851 s | 884 / 962 / 3,730 s |
| Retry storm | **NO** (0 events; closure met) | **YES** (2 events, new `__unparsedToolInput` variant; closure not met) |
| Compactions | 0 | 2 (crc-SP-2, crc-DE-1; 168.6k / 173.2k pre-tokens) |
| Error-log lines | 3 | 9 |
| Avg in-flight | 23.1/35 (66%) | 24.9/35 (71%) |
| Agent-hours | 18.3 | 32.1 |

Scaling from 3→5 runs grew compute 1.75× but wall-clock only 1.6× — parallelism held up. The regressions vs baseline are all cell-level (storms, compactions), all on the same few oversized guides.

## Recommendations

1. **Split crc-SP-3 first, then crc-SP-2 / crc-DE-1 / crc-CA-1** (the `crc-sp` split pattern). SP-3 alone produced both storms, the run's two longest cells, and a 36.9-min mean; SP-2 and DE-1 both auto-compacted at ~170k tokens. Target: no guide with a mean cell above ~15 min. This simultaneously attacks the wall-clock tail, the compactions, and the truncated-emit storms.
2. **File an addendum to STRUCT-OUTPUT-RETRY-STORM.md** for the `__unparsedToolInput` variant: parse-level failure (schema_errors empty), likely emit truncation on large findings payloads; conductor #197's repair is structurally blind to it because there's no parsed object to repair. Candidate mitigations: raise/handle max output tokens on the StructuredOutput turn, or chunk emission for guides >~15 items. Keep the envelope fixes marked effective (0 wrapper signatures in 120 sonnet cells).
3. **Don't raise maxWorkers yet.** 71% utilization with a single-cell 10-min tail means guide splitting + storm fix dominate; revisit 45–50 workers only after those land (120-cell runs do oversubscribe 35).
4. **Investigate the `e3412be0…` plan_set_id** the crc-SP-1 agent keeps feeding to `crc-vision-check` (3 failures, 5 attempts, incl. `sheet undefined`) — likely a stale document reference in the SP-1 guide or site-plan index (Agent 3's lane for the fix, flagged here because it burned ~90 s of agent time per occurrence).
5. **Keep the storm grep in the audit loop** — the closure criterion has now flipped from met (haiku, 07-13) to not-met (sonnet, 07-14); one signature retired, a new one appeared.
