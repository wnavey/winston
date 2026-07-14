# CRC Run Audit — Agent 1: Performance & Stability

**Review:** `bfb4f256-27a2-4adc-8443-b942e3b4aa79` · **Submission version:** `6b9b85ed-e992-4906-a222-b24ee836910c`
**Run label:** `2026-07-13-run-2-local-winston-test` · gen 6 · model `claude-haiku-4-5-20251001` · 3 runs × 24 review cells · maxWorkers=35
**Executed on:** `Wills-Mac-mini.local`, pid 15947, cwd `/Users/winston/noetic/conductor` (local conductor process, artifacts uploaded to `workflow-runs/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-07-13-182144`)
**Log analyzed:** `RUN_DIR/logs/comment-resolution-check.log` (37,503 lines) + `comment-resolution-check-error.log` (3 lines) + `output/vision-log.jsonl` (148 lines)

## Verdict: **HEALTHY WITH NOTES**

## Executive summary

- **Run completed cleanly in 49.3 min** (2026-07-13 22:32:27 → 23:21:44 UTC). All 72/72 review cells (3 runs × 24 guide files) produced valid findings JSON; consolidated output = 294 items (235 failed / 56 resolved / 3 uncertain), exactly matching the DB row.
- **Retry storm: NO.** Zero `agent.structured_output.coercion_failed`, zero exhausted-retry events, zero double-wrap signatures. The bug's zero-event closure criterion is **MET** on this run. All 72 cells went through the benign lenient-schema path (`inject_grouping`, 78 events).
- **Context compaction: NONE.** 0 `compact_boundary` events, 0 `compact_failed`/`compact_error`. No cell approached the SDK auto-compaction threshold.
- **Only 3 error events all run** (level-50), all in one cell (run-1/crc-AW), all the same recoverable tool bug: the agent passed a PDF *filename* where `crc-vision-check` expects a document UUID. The cell recovered and produced valid output.
- **The run is tail-bound, not throughput-bound.** The review step's wall-clock (47.5 min) literally equals its single longest cell (run-2/crc-SP-3, 2,851 s, claimed at t=0 and last to finish). More workers would buy **zero** wall-clock improvement; only making the slowest guides faster would.

---

## 1. Outcome

| Check | Result |
|---|---|
| Completion | Log runs to `Uploading workspace files` (last line, `time=1783984904326` = 23:21:44 UTC); DB review row = `status=completed`. **Complete.** |
| Review cells | 72/72 — `output/runs/run-{1,2,3}/findings/` each contain exactly 24 `.json` files, all valid JSON with a `findings` array (0 invalid) |
| Findings per run | run-1: 291, run-2: 283, run-3: 303 (variance analysis is Agent 2's lane) |
| Consolidated | `output/consolidated-findings.json` = 294 items: **235 failed / 56 resolved / 3 uncertain** — exact match to the DB reference numbers |
| Item accounting | `Claimed item, launching agent` ×72, `Wrote structured output` ×72, `Item completed` ×72 — no outer-retry re-entries, no dropped cells |
| Artifact quirk | `RUN_DIR/workflow/status.json` reads `"status":"in-progress"` — expected: the workspace snapshot uploads *before* the DB row is finalized. Not a defect, but confusing for anyone auditing from storage alone. |

## 2. Total wall-clock & macro-phases

First event `1783981947791` (Conductor starting) → last event `1783984904326` (workspace upload begins) = **2,956,535 ms = 49.28 min**. (Post-upload finalization is not in the log — the log file itself is part of the upload.)

| Phase | Start (UTC) | Duration | % of wall-clock |
|---|---|---:|---:|
| Startup (env validation, workspace, project-file download) | 22:32:27 | 12.1 s | 0.4% |
| fetch-crc-guides | 22:32:39 | 37.4 s | 1.3% |
| **review (72 parallel agent cells)** | **22:33:17** | **2,851.4 s (47.52 min)** | **96.4%** |
| consolidate → enrich → rephrase → build → validate | 23:20:48 | 55.5 s | 1.9% |

## 3. Per-step timing

From `Executing step`/`Step completed` pairs (`duration` field, ms):

| Step | Type | Duration | Avg per unit | Notes |
|---|---|---:|---:|---|
| fetch-crc-guides | script | 37,436 ms | — | Downloads 24 gen-6 guides from `crc-guides` bucket |
| **review** | agent ×72 | **2,851,426 ms** | **914 s/cell** (median 594 s) | **Dominates: 96.4% of wall-clock.** 65,823 total agent-seconds (18.3 agent-hours) compressed into 47.5 min |
| cross-run-consolidate-crc | script | 507 ms | — | |
| enrich-findings | script | 359 ms | — | |
| prepare-enrichment-inputs | — | skipped | — | `enrichComments=false` |
| enrich-final-comment | — | skipped | — | condition not met |
| collect-enriched-final-comments | — | skipped | — | condition not met |
| rephrase-titles | agent ×1 | 53,003 ms | — | Only non-review agent step |
| upload-titles-cache | script | 855 ms | — | |
| build-crc-review-comments | script | 399 ms | — | |
| validate-review-output | script | 403 ms | — | Passed (no level-40/50 output) |

## 4. Steps that struggled / slow outliers

Nothing *failed*. The pain is all duration spread inside the review step.

**Cell duration distribution (n=72):** min 52 s · median 594 s · mean 914 s · p90 2,214 s · max 2,851 s. The max/median ratio is **4.8×**; the slowest guide (crc-SP-3, mean 2,459 s) is **31×** the fastest (crc-RW, mean 78 s).

Per-guide mean duration across the 3 runs (top of the tail):

| Guide | mean (s) | min | max |
|---|---:|---:|---:|
| crc-SP-3 | 2,459 | 2,235 | 2,851 |
| crc-aw-redlines | 1,651 | 1,175 | 2,278 |
| crc-SP-2 | 1,636 | 376 | 2,319 |
| crc-CA-1 | 1,587 | 173 | 2,590 |
| crc-DE-2 | 1,475 | 292 | 2,126 |
| crc-CM | 1,415 | 1,385 | 1,462 |
| crc-AW | 1,360 | 845 | 1,749 |
| crc-TPW-2 | 1,057 | 141 | 2,791 |
| … | | | |
| crc-OWB | 177 | 155 | 198 |
| crc-RW | 78 | 52 | 107 |

Slowest individual cells: run-2/crc-SP-3 **2,851 s** (= the entire review step), run-1/crc-TPW-2 2,791 s, run-1/crc-CA-1 2,590 s, run-3/crc-SP-2 2,319 s, run-3/crc-SP-3 2,293 s. The slow tail correlates with heavy vision-tool use (run-2/crc-SP-3 made 12 `crc-vision-check` calls; run-1/crc-TPW-2 made 10 — tool detail is Agent 3's lane). Note also huge same-guide variance (crc-TPW-2: 141 s → 2,791 s; crc-CA-1: 173 s → 2,590 s) — run-to-run strategy divergence on identical inputs.

## 5. Retry-storm verdict: **NO** (closure criterion **MET**)

Searched `RUN_DIR/logs/comment-resolution-check.log` (37,503 lines) and the error log for every signature in `winston/workspaces/comment-resolution-check/crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md`:

| Signature | Count |
|---|---:|
| `agent.structured_output.coercion_failed` | **0** |
| `coercion_repaired` | **0** |
| `exhausted structured-output retries` | **0** |
| `topLevelKeys` (per-attempt failure summaries) | **0** |
| `must have required property 'grouping'` | **0** |
| `/findings: must be array` | **0** |
| repair-path markers (`tryRepairStructuredOutput`/`Repaired structured output`) | **0** |

What fired instead: **78** level-30 `agent.structured_output.normalized` events, all `strategy:"inject_grouping"` — the expected lenient-emit path (conductor #194/#197: agent emits findings-only, conductor injects `grouping` from the cell filename). All 72 cells took it; 68 exactly once, 4 cells more than once (run-1/crc-AW ×4 — the same cell that hit the vision-tool errors — plus run-3/crc-SP-1, run-2/crc-RW, run-1/crc-EV-2 ×2 each), i.e. a handful of cells emitted StructuredOutput more than once in-session, none escalating to coercion.

- **Cells affected by storm:** none. **Recovered:** n/a. **Wasted-call estimate: 0** (vs. ~55 on the 06-19 smoke and 36 events on the 06-25 gen-2 run).
- **Closure criteria:** primary bar (zero `coercion_failed`) — **met**. Finer bars from the 2026-06-25 update: `coercion_repaired` = 0 (the net never even had to fire) and no evidence of wasted internal attempt loops — **met**. On this run, conductor #197 + bureau #459 look fully effective on haiku-4-5.

## 6. Stability / error breakdown

- **Level-50 errors: 3** (100% of the error log; log lines at `time` 1783982115604 / 1783982117897 / 1783982120201 = 22:35:15–22:35:20 UTC, ~2.8 min into the run). All in **one cell: run-1/crc-AW (index 24)**, all identical: `crc-vision-check: failed to load primary file "1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf" (sheets 34/35/36)` → `DB error fetching plan_set_version: invalid input syntax for type uuid` at `conductor/src/shared/vision-file.ts:49` via `conductor/src/tools/crc-vision-check/index.ts:323`. Root cause: the agent passed the redlines PDF **filename** where the tool expects a **document UUID** (note this is the crc-aw-redlines source file, invoked from the crc-AW cell). **Recovered:** the cell completed with a valid 5-finding output (`output/runs/run-1/findings/crc-AW.md.json`); the raw Postgres error leaked to the agent as the tool result, which is ugly but non-fatal.
- **Level-40 warnings: 0.**
- **Vision tool (count only — detail is Agent 3's):** `vision-log.jsonl` = 148 events: **145 `crc-vision:result` / 3 `crc-vision:error`** (2.0% call failure; the 3 errors are the same events as above). Stability impact: negligible.
- No agent crashes, no worker deaths, no dropped items, no DB save errors in the log.

## 7. Context compaction: **NONE**

- `"subtype":"compact_boundary"` → **0 matches** in the main log. `compact_failed` / `compact_error` → **0 matches**.
- No cell hit the Claude Agent SDK auto-compaction threshold — even run-2/crc-SP-3 at 47.5 min and 12 vision calls stayed under budget (haiku-4-5's context + lean guide inputs).
- Storm overlap analysis: vacuous — both the compaction set and the storm set are empty. No storm-then-compact or compact-then-storm sequences exist in this run.
- No compaction clustering on large guides → no compaction-driven case for further guide splitting on this run (the *latency*-driven case in §8 stands on its own).

## 8. Concurrency / throughput

- **Peak in-flight: 35** — the pool saturated instantly (first 35 claims within 226 ms of `Starting parallel execution`).
- **Time-weighted average in-flight: 23.1 of 35 (66%)** — 65,823 agent-seconds / 2,851 s span.
- All 72 cells were claimed by t+7.6 min (last claim `1783982407732`); the queue was empty for the final ~40 min.
- Drain profile: in-flight fell **below 10 at t+37.5 min** and **below 5 at t+45.0 min**; completions per 5-min bucket: 14, 13, 10, 8, 3, 4, 4, 9, 2, 5.
- **Tail-bound, definitively:** review wall-clock (2,851,426 ms) equals the duration of run-2/crc-SP-3 (2,851 s), which was claimed in the first batch and finished last (`end=1783984848793`, 1 ms before `Parallel execution complete`). Theoretical floor with infinite workers = the same 2,851 s. **More workers help 0%.** Conversely, ~24 workers would have delivered essentially the same wall-clock (65,823 / 2,851 ≈ 23.1), so maxWorkers=35 already has ~11 workers of headroom sitting idle on average.

## 9. Recommendations

1. **Rebalance the SP split.** crc-SP-3 is the critical path on all 3 runs (2,235–2,851 s) and single-handedly sets the review step's wall-clock. The SP guide is already split 3 ways but unevenly by cost — move items from SP-3 into SP-1 (mean 250 s) or split SP-3 again. Same logic applies to crc-aw-redlines, SP-2, CA-1, DE-2 (all >1,400 s mean). Target: no guide cell above ~1,500 s and the run drops from ~49 to ~30 min at zero cost increase.
2. **Fix the `crc-vision-check` filename-vs-UUID trap** (`conductor/src/tools/crc-vision-check/index.ts:323` / `vision-file.ts:49`): either resolve filenames to document UUIDs server-side or return an agent-legible error ("pass the documentId UUID, not the filename") instead of the raw Postgres error. It cost 3 wasted tool calls this run and will recur.
3. **Don't raise maxWorkers.** The run is tail-bound; 35 is already over-provisioned (avg 23.1 in-flight). If anything, 24–30 workers is equivalent.
4. **Investigate same-guide run variance** (crc-TPW-2 141 s vs 2,791 s on identical inputs) — bounding vision-call budgets per cell would clip both the latency tail and the cost tail. (Coordinate with Agent 3's tool-usage findings.)
5. **Mark the retry-storm bug doc closed for haiku-4-5/gen-6** citing this run: 0 coercion events across 72 cells; keep the grep in the audit loop for one more sonnet run before archiving.
6. Minor: consider stamping `status.json` with a terminal status before the workspace upload, so storage-only auditors don't see `in-progress` on completed runs.
