# CRC Audit — Agent 1: Performance & Stability

**Run:** `3703349c-ac08-44b8-8c10-2100adb89f5b`
**Submission (U1 plans):** `6b9b85ed-e992-4906-a222-b24ee836910c`
**Config:** runs=3 × 16 departments = 48 review cells, maxWorkers=39, jurisdiction=austin, crcGenerationNumber=1
**Executor:** conductor CLI (local, host `Jasons-Mac-mini.local`, pid 96019)
**Run window:** 2026-06-23 15:44:07.097 → 16:46:16.852 (epoch ms 1782247447097 → 1782251176852)

---

## Executive summary

- **The run COMPLETED SUCCESSFULLY.** Final log line is `Conductor completed successfully`; the review row + comments were written to the DB (`Review saved to database successfully`). All **48/48** review cells produced output (16 depts × 3 runs), and consolidation/enrichment/saver all ran clean. **No partial or dropped outputs.**
- **Total wall-clock: 62.2 minutes.** The `review` agent step alone consumed **55.5 min (89.3%)** of that. Everything else (fetch, consolidate, enrich, rephrase-titles, build, save) totals ~6.7 min.
- **The structured-output retry storm IS PRESENT — verdict YES.** 10 `agent.structured_output.coercion_failed` events across **7 distinct cells**, every one showing the documented double-wrap signature (`topLevelKeys:["findings"]`, `must have required property 'grouping'` / `/findings: must be array`). All affected cells eventually succeeded via the outer retry loop, so correctness held, but it cost ~50 wasted Sonnet attempts and is the primary driver of the slow long-tail.
- **The run is tail-bound, not throughput-bound.** Peak concurrency hit the full 39 workers only at launch and for ~12% of the review step; **time-weighted average in-flight was just 9.1 agents**. With 48 cells and 39 slots, everything launches at once and the wall clock is then dominated by a handful of slow stragglers — the last cell finished **3332 s** after launch while the median cell finished in ~447 s.
- **Stability: 23 errors + 20 warnings in the error log; zero fatal.** 13 are `crc-vision-check` failures (12 sheet-load misses + 1 transient gateway `other side closed`) and 10 are the retry-storm exhaustions. None aborted the run.

---

## 1. Overall outcome

| Check | Result |
|---|---|
| Final status | `Conductor completed successfully` (1782251176852) |
| Review cells produced | **48/48** (`Item completed` ×48; `Wrote structured output` ×48 = exactly 3 per dept × 16 depts) |
| `output/runs/run-1/findings/` | 16 files ✓ |
| `output/runs/run-2/findings/` | 16 files ✓ |
| `output/runs/run-3/findings/` | 16 files ✓ |
| `output/findings/` (consolidated) | 16 files ✓ |
| Downstream artifacts | `consolidated-findings.json`, `enriched-findings.json`, `rephrased-items.json`, `review-comments.json` all written |
| DB persistence | `Review row created` → `Review comments created` → `Review saved to database successfully` ✓ |

Every one of the 16 departments emitted exactly 3 findings files (one per run): `crc-aw`, `crc-aw-redlines`, `crc-awrr`, `crc-ca`, `crc-cm`, `crc-de`, `crc-ev`, `crc-f`, `crc-iw`, `crc-lde`, `crc-owb`, `crc-pb`, `crc-pr`, `crc-sp`, `crc-tpw`, `crc-wq`. **No failures, no partial outputs** — even the 7 cells that hit the retry storm recovered through the workflow's outer retry (`retries: 5`).

---

## 2. Total wall-clock & per-phase breakdown

**Total: 3,729,755 ms = 62.16 min.** Phase boundaries taken from `Executing step` / `Step completed` markers (epoch ms):

| Phase | Start → End (ms) | Duration | % wall |
|---|---|---:|---:|
| Setup (Conductor start → first step) | 1782247447097 → …461317 | 14.2 s (0.24 min) | 0.4% |
| **fetch-crc-guides** | …461317 → …494812 | 33.5 s (0.56 min) | 0.9% |
| **review** (48 agent cells) | …494813 → …826523 | **3331.7 s (55.53 min)** | **89.3%** |
| **cross-run-consolidate-crc** | …826523 → …827084 | 0.6 s | 0.0% |
| **enrich-findings** | …827084 → …827445 | 0.4 s | 0.0% |
| **rephrase-titles** (agent) | …827445 → …150817 | 323.4 s (5.39 min) | 8.7% |
| **build-crc-review-comments** | …150817 → …151366 | 0.5 s | 0.0% |
| Post / review-saver (upload + DB write) | …151366 → …176852 | 25.5 s (0.42 min) | 0.7% |

The two agent-driven steps (`review` + `rephrase-titles`) account for **98.0%** of wall clock. The five script steps combined run in under 75 seconds.

---

## 3. Per-workflow-step timing table

Most steps run once; `review` runs 48 cells and `rephrase-titles` runs once over all enriched findings. "Avg per unit" below is per review-cell for the review step, per invocation otherwise.

| Step | Type | Invocations | Total | Avg per unit |
|---|---|---:|---:|---:|
| fetch-crc-guides | script | 1 | 33.5 s | 33.5 s |
| review | agent | 48 cells | 3331.7 s (wall) | ~447 s median / ~634 s mean per cell* |
| cross-run-consolidate-crc | script | 1 | 0.6 s | 0.6 s |
| enrich-findings | script | 1 | 0.4 s | 0.4 s |
| rephrase-titles | agent | 1 | 323.4 s | 323.4 s |
| build-crc-review-comments | script | 1 | 0.5 s | 0.5 s |
| review-saver (post-step) | internal | 1 | 25.5 s | 25.5 s |

\* Per-cell durations are approximate: `Item completed` log lines omit `runIndex`, so claim→completion pairing is FIFO-per-department. Aggregate distribution across the 48 cells (claim→completion): **min 244 s, median 447 s, mean 634 s, p90 1167 s**. The relative ranking of slow departments (below) is reliable; exact per-cell maxima are estimates.

---

## 4. Which steps struggled?

**The `review` step is where 100% of the trouble lives.** All errors, warnings, retries, and slow outliers occur inside it. `rephrase-titles` (5.4 min, single agent) ran clean; all script steps were sub-second.

**Slow-cell long tail (by department, claim→completion estimate):**

| Rank | Dept · run | ~Duration | Notes |
|---|---|---:|---|
| 1 | crc-de · run-3 | ~3057 s | largest guide (33 items per bug doc); 2 retry-storm hits on crc-de in run-1 |
| 2 | crc-ca · run-3 | ~2093 s | 21 items; 2 retry-storm hits on crc-ca in run-1 |
| 3 | crc-tpw · run-3 | ~1681 s | 21 items; 1 retry-storm hit (run-2) |
| 4 | crc-wq · run-3 | ~1181 s | 15 items; 1 retry-storm hit (run-1) |
| 5 | crc-sp · run-3 | ~1167 s | 49 items (largest guide) |
| 6 | crc-ev · run-3 | ~1069 s | 15 items; 1 retry-storm hit (run-3) |

The slowest cells are the large/high-item-count departments (de, sp, ca, tpw) and any cell that incurred the structured-output 5-retry penalty plus the workflow's 3–9 s exponential outer backoff. **run-3 cells dominate the tail** because they were claimed last (workers fill in dept order × run order; run-3 cells couldn't start until run-1/run-2 slots freed — see §7).

**Retries observed (outer workflow loop):** 5 `Item failed, retrying after Ns backoff` events (3 s, 5 s, 6 s, 7 s, 8 s, 9 s, 4 s — exponential), each paired with a `Retrying item after Ns backoff`. These map to the 7 cells that exhausted structured-output retries; each cost a full agent re-run on top of the wasted internal attempts.

---

## 5. Structured-output retry storm — VERDICT: **YES, hit.**

**Signature searched for** (from `STRUCT-OUTPUT-RETRY-STORM.md`):
- `event: agent.structured_output.coercion_failed`
- `"Agent exhausted structured-output retries and could not be repaired"`
- per-attempt `topLevelKeys:["findings"]` with `hasFindingsArray:false` (the double-wrap)
- schema errors `root: must have required property 'grouping'` and `/findings: must be array`

**Found — all four markers present.** Counts:

- `"Agent exhausted structured-output retries…"` (level 50): **10 events** (matched by `grep` and `jq`; main log + error log agree).
- Every event carries `event:"agent.structured_output.coercion_failed"`, `category:"structured_output"`, `nAttempts:5`, and `topLevelKeys:["findings"]` on the failing attempts — the exact double-wrap misshape the bug doc describes.
- Every event's `schema_errors` contain `root: must have required property 'grouping', /findings: must be array`.

**Distribution (10 events across 7 distinct cells):**

| runIndex · item | coercion_failed events |
|---|---:|
| run-1 · crc-ca.md | 2 |
| run-1 · crc-de.md | 2 |
| run-1 · crc-iw.md | 2 |
| run-1 · crc-wq.md | 1 |
| run-2 · crc-tpw.md | 1 |
| run-3 · crc-ev.md | 1 |
| run-3 · crc-pr.md | 1 |

Three cells (crc-ca, crc-de, crc-iw — all in run-1) tripped the 5-retry penalty **twice** (first internal exhaustion → outer retry → second internal exhaustion → second outer retry → eventual success).

**Comparison to the prior smoke run** (Lamar+Collier v4, 2026-06-19): that run logged 11 coercion_failed events on a single-run (15-dept) config. This run logged **10**, but on a **3× larger** workload (48 cells vs 15). So per-cell the storm is *milder* here (~21% of cells vs ~73%) but the bug is **clearly not fixed** — the closure criterion in the bug doc ("zero coercion_failed events") is **not met**.

**Cost impact:** 10 events × 5 wasted internal attempts ≈ **50 wasted Sonnet calls** on top of the 48 successful cells, plus 5 outer-retry agent re-runs and cumulative 3–9 s exponential backoff. This is the dominant contributor to the slow long tail in §4. As the workflow.yaml note warns, runs=3 "~3× compounds the struct-output retry storm" — borne out here.

---

## 6. Stability / error breakdown

**Error log (`comment-resolution-check-error.log`, 39 KB, 43 lines): 23 errors (level 50) + 20 warnings (level 40). Zero fatal — run completed.**

| Category | Level | Count | Detail |
|---|---|---:|---|
| Structured-output exhaustion | 50 | 10 | The retry storm (§5). Recovered via outer retry. |
| crc-vision-check: failed to load primary file | 50 | 12 | Sheet-load misses: sheet 18 (×4), sheet 1 (×4), sheet 24 (×2), sheets 3/13/25 (×1 each). Targets `primary-site-plan` / `908ffab5-…`. |
| crc-vision-check: error running vision AI call | 50 | 1 | Transient `GatewayResponseError: … other side closed` (TLS socket drop, statusCode 500) on crc-sp run-3, index 35. Single occurrence, self-recovered. |
| Item failed / Retrying after backoff | 40 | 20 | 10 logical retry events (each logged as a failed+retry pair), exponential 3–9 s backoff — the outer-loop response to the 7 storm-affected cells. |

**Vision tool stability (flag only — full detail is Agent 3's lane):** the prompt notes 13 errors / 182 calls in `output/vision-log.jsonl`. That matches the 13 vision-related level-50 entries in the error log exactly (12 sheet-load failures + 1 gateway error). At ~7% error rate the vision tool was the second-largest stability drag after the retry storm, but **no vision failure cascaded into a cell failure** — every cell still produced valid output. The sheet-load failures cluster on a small set of sheet numbers (1, 18, 24), suggesting a few specific sheets in this submission are problematic to render rather than a broad tool fault. **Recommend Agent 3 confirm whether those sheet IDs exist in the U1 package.**

**No DB, no workspace, no consolidation, no saver errors.** The only error surfaces are the LLM/vision agent layer.

---

## 7. Throughput / concurrency

- **maxWorkers=39 was hit but barely sustained.** Peak in-flight agents = **39** (full saturation) — but only at the initial burst and for **~12% of the review step** (≥30 in-flight for ~414 s of 3332 s). **Time-weighted average concurrency over the review step was 9.1 agents** — i.e., for most of the step, ~30 of the 39 worker slots sat idle.
- **Why:** there are only 48 cells for 39 slots. At launch, 39 cells claim slots near-instantly (all `Claimed item` events land within ~3 s, 15:44:54.8–57.8). The remaining 9 cells (run-3 tail) queue behind them. After the first wave clears, the run is **tail-bound**: wall clock is governed by the few slowest cells, not by worker availability. First completion at **+244 s**, last at **+3332 s** — a 13.6× spread. The final five completions landed at +1169, +1182, +1328, +1682, +2375, +3332 s, i.e. the last ~28 min of the step was spent draining a handful of stragglers (large-guide depts + retry-storm cells) while almost all workers idled.
- **No serialization bottleneck in the orchestrator itself** — claims are issued immediately as slots free, and script steps are sub-second. The bottleneck is **per-cell agent latency variance**, amplified by the retry storm.
- **Implication:** raising maxWorkers further would not help (slots already exceed cells). The lever is reducing the slow-cell tail: fix the retry storm (§5) and/or split the largest guides (crc-sp 49 items, crc-de 33 items) into sub-cells so no single agent serializes 30–49 items.

---

## 8. Recommendations

1. **Fix the structured-output double-wrap (highest leverage).** Apply mitigations 1–3 from `STRUCT-OUTPUT-RETRY-STORM.md` (anti-pattern example in `review.md`, sharpen `crc.schema.json` `findings` description, restate the tool-parameter contract). This run still hit 10 coercion_failed events — the bug's closure criterion is unmet. Eliminating it removes ~50 wasted Sonnet calls and the worst of the long tail.
2. **Attack the slow-cell tail to cut wall clock.** The run is tail-bound: ~28 of 62 min were spent draining stragglers while 30+ workers idled. Consider sub-dividing the largest guides (crc-sp 49 items, crc-de 33, crc-ca/crc-tpw 21) into smaller agent cells so item-count no longer serializes inside one agent.
3. **Add retry/backoff to `crc-vision-check` sheet loads.** 12 of 13 vision errors are deterministic sheet-load failures concentrated on sheets 1/18/24. Verify those sheet IDs resolve in the U1 package; if they're spurious lookups, fix the sheet-ID mapping. The 1 transient gateway error is benign (self-recovered) but argues for a wrapped retry on vision calls too. (Detailed tool analysis → Agent 3.)
4. **maxWorkers is already over-provisioned** for 48 cells — do not raise it. If runs or dept count grows, 39 remains fine; the gain is elsewhere (items 1–2).
5. **Re-run the bug-doc reproduction after the prompt/schema fix** and confirm zero `coercion_failed` events, then re-measure wall clock — expect the review step to drop well below 55 min once the storm and its backoffs are gone.
