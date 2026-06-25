# CRC Audit — Agent 1: Performance & Stability

- **reviewId:** `a8d07d22-19e6-4a1f-a12d-a4371c1dbd19`
- **workflowRunId:** `df330b50-5291-48c8-8d82-2024b6c32103`
- **Project / version:** Lamar + Collier (`23301a8a-…`) / submission v4
- **Config:** 5 runs × 22 dept guide files = 110 cells, maxWorkers=39, model=`claude-sonnet-4-5-20250929`, jurisdiction=austin, crcGenerationNumber=2
- **Host:** Jasons-Mac-mini.local
- **Verdict:** **HEALTHY WITH NOTES**

## Executive summary

- Run completed cleanly end-to-end (all 6 steps emitted `Step completed`; final upload step ran; 110/110 cells produced structured output; consolidated rollup contains all **234** items).
- Total wall-clock **108.6 min** (6515.8 s) — DB-recorded 1h 49m matches. The `review` step dominates at **99.0 min (91.2 %)**; `rephrase-titles` is the only other meaningful slice at **8.2 min (7.5 %)**; everything else < 1 min combined.
- **Retry storm: YES — present and still meaningful.** 36 `agent.structured_output.coercion_failed` events across **25 distinct cells** (5 runs × 22 cells = 110 total cells, so 23 %). The bug doc's closure criterion ("**zero** coercion_failed events on rerun") is **NOT met**. The double-wrap variant (`topLevelKeys=["findings"]`) is largely gone (5 of 36), replaced by *new* wrap shapes — `["data"]` × 72 attempts, `["output"]` × 59, `["properties"]` × 27.
- Review wall-clock is **tail-bound, not throughput-bound**. Peak in-flight reached the maxWorkers ceiling (39) early, but time-weighted average in-flight was **14.2 / 39 (36 % utilization)** because the run drained down to a handful of long-tail cells. The single slowest cell — `crc-de-2.md / run-5` at **77.2 min (4632 s)** — alone defines the lower bound on review wall-clock; bumping workers would not have helped.
- Stability noise was concentrated in a single early ~3-min window: **54 vision-tool errors** (DB `fetch failed` for `plan_set_version` + 2 gateway "socket closed"), all transient — the agent retried via its own loop and all 110 cells eventually wrote output. Three local-scratch JSON files are 80-byte 503 download artifacts (`crc-cm/run-2`, `crc-iw/run-3`, `crc-awrr/run-4`) but the logs confirm those cells **did** write structured output successfully to remote storage; this is an audit-pull artifact, not a run failure.

## Outcome

| Check | Result |
|---|---|
| Run reached final step (`build-crc-review-comments`) | YES (`Step completed` at 13:00:26 UTC) |
| Final `Uploading workspace files` emitted | YES (last log line, `time=1782392372901`) |
| 5 × 22 = 110 review cells claimed | YES (110 `Claimed item, launching agent`) |
| 110 cells wrote structured output | YES (110 `Wrote structured output`) |
| 110 cells emitted `Item completed` | YES |
| Per-run findings dirs intact (22 files each) | YES (run-{1..5}, 22 each) |
| `output/consolidated-findings.json` populated | YES (234 entries, all `runCount=5` on the spot-checked rows) |
| `output/review-comments.json` built | YES (2.7 MB) |
| `enriched-findings.json` built | YES (484 KB) |
| Local `status.json` shows "in-progress" | YES — but this is a **stale snapshot**; last log line is the upload kick-off after step 5 completed, so the workflow finished successfully. DB `completed_at` confirms. |

No cells were dropped or partial. All 25 retry-storm-affected cells recovered via the outer workflow retry loop.

## Total wall-clock and per-phase breakdown

First event: `1782385857128` ms — Last event: `1782392372901` ms → **6515.8 s = 108.60 min** wall-clock (matches DB `completed_at - started_at ≈ 1h 49m`).

| Step | Start (offset) | End (offset) | Duration | Share |
|---|---:|---:|---:|---:|
| (boot → step 1) | 0 s | 20.4 s | 20.4 s | 0.3 % |
| `fetch-crc-guides` (script) | 20.4 s | 82.3 s | **61.9 s** | 1.0 % |
| **`review` (agent step, parallel 110 cells)** | 82.3 s | 6023.4 s | **5941.1 s (99.02 min)** | **91.2 %** |
| `cross-run-consolidate-crc` (script) | 6023.4 s | 6024.0 s | **0.6 s** | <0.1 % |
| `enrich-findings` (script) | 6024.0 s | 6024.5 s | **0.5 s** | <0.1 % |
| `rephrase-titles` (agent) | 6024.5 s | 6515.0 s | **490.5 s (8.17 min)** | 7.5 % |
| `build-crc-review-comments` (script) | 6515.0 s | 6515.8 s | **0.8 s** | <0.1 % |
| **TOTAL** |  |  | **6515.8 s (108.60 min)** | 100 % |

Dominant step: `review`. Second-largest: `rephrase-titles`. Everything else is rounding error.

## Per-cell timing inside the `review` step

Cell duration = `Claimed item, launching agent` → final `Wrote structured output` (paired on `(item, runIndex)`). All 110 cells paired cleanly.

| Statistic | Value |
|---|---:|
| n cells | 110 |
| median | **574 s (9.6 min)** |
| mean | 766 s (12.8 min) |
| p75 | 875 s (14.6 min) |
| p90 | **1555 s (25.9 min)** |
| p95 | 1828 s (30.5 min) |
| max | **4632 s (77.2 min)** |
| sum (CPU-equivalent) | 84 223 s (1403.7 min) |

**Top 10 slowest cells:**

| Rank | Item | Run | Duration | Notes |
|---:|---|---|---:|---|
| 1 | `crc-de-2.md` | run-5 | **77.2 min** | 5 coercion_failed events, 27 vision calls, 22 semantic-search calls |
| 2 | `crc-ca-1.md` | run-5 | 51.1 min | 3 coercion_failed events |
| 3 | `crc-ca-1.md` | run-2 | 37.2 min | 2 coercion_failed events |
| 4 | `crc-wq.md`   | run-3 | 37.2 min | 3 coercion_failed events |
| 5 | `crc-de-1.md` | run-4 | 35.2 min | 2 coercion_failed events |
| 6 | `crc-sp-2.md` | run-5 | 30.5 min | 1 coercion_failed event |
| 7 | `crc-de-2.md` | run-3 | 29.1 min | 1 coercion_failed event |
| 8 | `crc-ca-1.md` | run-4 | 28.8 min | 2 coercion_failed events |
| 9 | `crc-de-2.md` | run-2 | 26.2 min | 1 coercion_failed event |
| 10 | `crc-sp-1.md` | run-2 | 26.0 min | 1 coercion_failed event |

**Every single one of the top-10 slowest cells was hit by the structured-output retry storm.** The tail is the storm.

**Per-dept rollups (n=5 each)** — depts ordered by total CPU-equivalent time:

| Dept | avg s | max s | sum s |
|---|---:|---:|---:|
| `crc-de-2` | 1916 | 4632 | 9581 |
| `crc-ca-1` | 1660 | 3067 | 8301 |
| `crc-sp-1` | 1281 | 1559 | 6404 |
| `crc-de-1` | 1206 | 2111 | 6030 |
| `crc-sp-2` | 1143 | 1828 | 5713 |
| `crc-wq`   | 1060 | 2230 | 5302 |
| `crc-aw-redlines` | 847 | 1476 | 4237 |
| `crc-sp-3` | 847 | 1453 | 4235 |
| `crc-tpw-1` | 694 | 999 | 3469 |
| `crc-ca-2` | 666 | 1127 | 3328 |
| … (12 more, all < 660 s avg) |  |  |  |
| `crc-owb`  | 294 | 378 | 1470 (fastest) |

The fast-tier groupings (`crc-owb`, `crc-tpw-2`, `crc-cm`, `crc-pb`, `crc-sp-4`, `crc-lde`) finish in 5–8 min each; the slow tier (`crc-de-2`, `crc-ca-1`, `crc-sp-1/2`, `crc-de-1`, `crc-wq`) all push past 20 min on at least one run, and those exact depts are the storm magnets.

**Per-run aggregates:**

| Run | n | avg s | sum s | max s |
|---|---:|---:|---:|---:|
| run-1 | 22 | 706 | 15 529 | 1 555 |
| run-2 | 22 | 773 | 16 995 | 2 230 |
| run-3 | 22 | 660 | 14 519 | 2 230 |
| run-4 | 22 | 746 | 16 404 | 2 111 |
| run-5 | 22 | **944** | **20 776** | **4 632** |

Run-5 is the heaviest, dragged by `crc-de-2` (77 min).

## Steps that struggled

1. **`review` step** — exclusively. Carrying every slow tail-cell and 100 % of the retry-storm events. Median cell 9.6 min, p90 25.9 min, tail goes to 77.2 min.
2. **`rephrase-titles` (8.17 min)** — runs once over the consolidated finding set (rephrases up to ~234 verification sentences). Not abnormal for that volume, but worth keeping in mind as a fixed-cost rephrasing pass.
3. **All script steps** — sub-second. No struggles.

## Retry-storm verdict: **YES**

**Closure criterion (per `STRUCT-OUTPUT-RETRY-STORM.md`) is NOT met.**

### Quantification

| Metric | Value |
|---|---:|
| `agent.structured_output.coercion_failed` events (main log) | **36** |
| Same events in error log | 36 |
| `Agent exhausted structured-output retries…` events | 36 (one per coercion event — they pair) |
| Distinct cells affected `(item, runIndex)` | **25 of 110 = 23 %** |
| Cells affected in run-1 / run-2 / run-3 / run-4 / run-5 | 5 / 6 / 3 / 6 / 5 |
| All 25 affected cells eventually recovered? | **YES** (every cell has a `Wrote structured output` event) |
| `Item failed, retrying after Ns backoff` (outer-retry events) | 37 |
| Backoff seconds total | **232 s** (~3.9 min of pure backoff) |
| Estimated wasted Sonnet attempts | 36 storms × 5 inner attempts ≈ **180 wasted calls** on top of the ~110 successful ones (~**2.6× the inner-call budget the run "should" have used**) |

### Failure-shape evolution since the smoke run

> **⚠️ Correction (added 2026-06-25, post-audit).** The "Recommendations" below credit "the 2026-06-20 mitigations" for narrowing the `["findings"]` shape. Those prompt mitigations were **never shipped** — the actual 06-24 change was the *lenient emit schema* (drops top-level `grouping`). That is what shrank the `findings`-specific wrapper (it removed the model's reason to nest under `findings`); the wrapping reflex itself is unchanged, which is why it migrated to `data`/`output`/`properties`. The lenient schema also silently disabled the failure-path repair (`tryRepairStructuredOutput` guards on the strict predicate), so wrapped shapes got no repair at all — making this run worse, not better, per cell. Fixes: conductor #197 (structure-based repair) + bureau #459 (prompt alignment). See `STRUCT-OUTPUT-RETRY-STORM.md` → "Update — 2026-06-25".

The bug doc's diagnosis was specifically the **double-wrap** `{ findings: { grouping, findings, summary } }`. Top-level keys observed across all 36 storm events in *this* run, summed across the 5 inner attempts each (so ~180 attempt-level samples):

| topLevelKeys (sorted) | Attempts | Notes |
|---|---:|---|
| `("data",)` | 72 | NEW — single-key `data` wrapper |
| `("output",)` | 59 | NEW — single-key `output` wrapper |
| `("properties",)` | 27 | NEW — schema-meta confusion |
| `("findings","summary")` | 10 | Old double-wrap variant + summary |
| `("findings",)` | 5 | Classic double-wrap |
| `("content",)` | 5 | NEW |
| `("results",)` | 1 | NEW |
| `("result",)` | 1 | NEW |

The bug-doc's named anti-pattern (`["findings"]` double-wrap) shrank to 5 of ~180 — the mitigation against that specific shape is *working*. But Sonnet is now picking *other* generic envelope words (`data`, `output`, `properties`, `content`). The fix narrowed the model's misfire to a different word; it didn't kill the misfire.

### Cells stormed (25)

```
run-1: crc-aw-redlines, crc-awrr, crc-ca-2, crc-de-1, crc-sp-1
run-2: crc-ca-1, crc-de-2, crc-pb, crc-sp-1, crc-tpw-2, crc-wq
run-3: crc-de-2, crc-sp-1, crc-wq
run-4: crc-aw, crc-ca-1, crc-de-1, crc-sp-1, crc-sp-2, crc-sp-3
run-5: crc-ca-1, crc-ca-2, crc-de-2, crc-sp-2, crc-wq
```

`crc-sp-1` was stormed in **4 of 5 runs**; `crc-ca-1` and `crc-de-2` in 3 each.

### Storm vs item-count drift

Handoff fact: per-run findings = 227 / 223 / 224 / 223 / 234. The drift hypothesis was: storm-affected cells dropped items. **Confirmed, but the effect is weaker than implied.**

| Cohort | n cell-runs | mean items-lost-vs-max | fraction with any loss | total items lost |
|---|---:|---:|---:|---:|
| Storm-affected | 25 | **0.56** | **12 %** | 14 |
| Non-storm | 82 | 0.17 | 2.4 % | 14 |

Storm cells lose items ~5× more often than clean cells — but most stormed cells still produced the canonical item count, because the outer retry got a fresh, well-formed envelope. The **bigger** chunk of the drift comes from three audit-side download corruptions (see Stability section below) that hit one run each.

### Closure criterion

> *"A subsequent end-to-end run on the same inputs should produce **zero** `agent.structured_output.coercion_failed` events."*

**Not met.** 36 events vs. the target of 0. The bug should remain **open**.

## Stability / error breakdown

Error log: **164 lines, all level 50** (errors). Breakdown by kind:

| Error kind | Count | Severity |
|---|---:|---|
| `Agent exhausted structured-output retries and could not be repaired` | 36 | retry-storm symptom; all recovered |
| `crc-vision-check: failed to load primary file …` (DB `fetch failed` → vision-file loader) | **52** | tool-level; agent retried in-loop, no cell lost |
| `crc-vision-check: error running vision AI call` (Gateway `socket closed` / 500) | 2 | tool-level; agent retried in-loop |
| `Item failed, retrying after Ns backoff` | 37 | outer-retry triggers, pair 1-to-1 with storm events (3 extras = a few transient outer-retries from the early DB blip) |
| Per-minute distribution of vision/DB errors | 24 in min 0, 10 in min 1, 7 in min 2, then very long tail | concentrated burst |

**Vision/DB failures are a single transient blip,** not a persistent issue: 41 of 54 vision errors fired in the first ~3 minutes of the review step, then trickled at <2/min through the rest of the run. Likely an early Supabase warm-up/connection pool issue. No cell failed because of this; the agent's in-loop retry covered it. (Tool-usage analysis is owned by Agent 3 — flagged here only for stability impact.)

**Audit-artifact only:** 3 of 110 local JSON files in `output/runs/{run-2,3,4}/findings/` are 80-byte payloads `{"error":"Service Unavailable","statusCode":503}`:

- `run-2/findings/crc-cm.md.json`
- `run-3/findings/crc-iw.md.json`
- `run-4/findings/crc-awrr.md.json`

These are 503s from the Supabase storage download that built the local scratch dir, **not** from the agent — the main log shows each of those `(item, runIndex)` pairs emitted a `Wrote structured output` event. Other audit agents should treat these three files as missing-from-scratch and pull from storage if needed.

## Concurrency / throughput

| Metric | Value |
|---|---:|
| maxWorkers configured | 39 |
| Peak concurrent cells in flight | **39** (hit early) |
| Time-weighted avg cells in flight (over the 99-min review window) | **14.18** |
| Worker utilization | **36.3 %** of 39 |
| Sum of all cell durations | 84 223 s |
| Theoretical lower bound at 100 % util / 39 workers | 36.0 min |
| Theoretical lower bound at observed 14.18 avg | 99.0 min (matches actual) |
| Actual `review` wall-clock | **99.02 min** |

The step is **tail-bound, not throughput-bound.** The maxWorkers=39 budget was hit instantly but the queue drains to a small number of long-running cells in the back half. The single longest cell — `crc-de-2.md / run-5` at 77.2 min — independently exceeds any wall-clock floor we could hope to drive the run below by adding more workers.

If `crc-de-2 / run-5` had finished in p75 time (~14.6 min), the review step would have ended ~62 min sooner and the whole run would have come in at ~80 min. **Cutting the long tail is the highest-leverage performance fix; raising maxWorkers is not.**

## Recommendations

1. **Reopen / continue work on STRUCT-OUTPUT-RETRY-STORM.md.** The 2026-06-20 mitigations narrowed but did not kill the bug. New anti-pattern wrappers to defend against: `{ "data": {…} }`, `{ "output": {…} }`, `{ "properties": {…} }`, `{ "content": {…} }`, `{ "results": {…} }`, `{ "result": {…} }`, plus a residual `{ "findings": { … "summary": … } }`. Recommend extending the prompt's "WRONG" examples and the schema description as suggested in the bug doc; also consider implementing the **validate-checklist precheck** (the bug doc's #5 lever) — at 36 storms × 5 inner attempts ≈ 180 wasted Sonnet calls per run, the ROI is now bigger than the original 11-event smoke run.
2. **Investigate the slow tail before adding workers.** Five depts (`crc-de-2`, `crc-ca-1`, `crc-sp-1`, `crc-de-1`, `crc-sp-2`, `crc-wq`) account for the entire long tail and all six were storm-stricken at least once. Once the storm is closed, these cells should compress 2–3× automatically. If they don't, look at per-cell vision-tool-call counts (`crc-de-2/run-5` made 27 vision calls + 22 semantic-search calls in one cell — that's the next biggest spend after the storm).
3. **Vision/DB stability is fine.** The early 3-min vision-error burst is transient — no cell lost, no run-level impact. No action needed unless it recurs. Agent 3 can confirm via tool log.

---
*Generated by Audit Agent 1 (performance & stability).*
