# CRC Audit — Agent 1: Performance & Stability

- **reviewId:** `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e`
- **submissionVersionId / crcGuidesSubmissionVersionId:** `6b9b85ed-e992-4906-a222-b24ee836910c` (calibration-test)
- **projectId:** `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` (Lamar + Collier)
- **Config:** 5 runs × 24 dept guides = 120 review cells, maxWorkers=24, enrichmentMaxWorkers=50, model=`claude-sonnet-4-6`, enrichment=`claude-haiku-4-5-20251001`, crcGenerationNumber=6
- **Verdict:** **HEALTHY WITH NOTES**

## Executive summary

- Run completed all 10 workflow steps end-to-end in **90.47 min** (`Conductor starting` t=1782853096767 → last event t=1782858524877). No dropped cells: **all 120 review cells `status="done"`, all 291 enrichment cells `status="done"`, all 5 run dirs contain 24 findings files.**
- **Retry-storm closure criterion is MET for the review step** (**0** `coercion_failed` events across 120 review cells). The lenient emit schema + `Canonicalized lenient structured output` path fired cleanly on every review cell (120/120 normalized).
- Two `coercion_failed` events occurred but in a **different step (`enrich-final-comment`)** and with a **different signature** than the bug-doc describes (`must have required property 'source'`, wrapper key `enrichedFinalComment` — an enrichment schema, not the review `grouping/findings` shape). Both cells recovered on the first outer retry and produced `status="done"` output.
- The **review step dominates wall-clock (5049.7s / 84.16 min — 93% of total)** and is throughput-bound: 24 workers saturated for 57.94 min, followed by a 26.9-min tail draining the last cells. The two guides most responsible for the tail are `crc-CA-2.md` (avg 1658s, max 2174s) and `crc-SP-3.md` (avg 1600s, max 1991s).
- 538 vision tool calls, **100% success**. 460 `run_semantic_search_blocks` script calls. 0 rate-limit events. 2 warnings and 2 errors total across a 121 MB / 103,288-line log — everything else at level 30.

## Outcome

- Workflow reached step 9 (`build-crc-review-comments`) and beyond into `Uploading workspace files` — the log terminates on the upload trailer. `status.json` still reads `"in-progress"` because it was snapshotted before the terminal step overwrote it, but `run-log.json` confirms all 10 steps `"status":"completed"` with valid `endedAt` timestamps.
- Output completeness:
  - `output/runs/run-{1..5}/findings/` — **5 × 24 = 120 JSON files present** (matches expected).
  - `output/consolidated-findings.json` — 291 items (per prompt).
  - `output/enriched-findings.json`, `output/review-comments.json`, `output/rephrased-items.json` all present.
- No partial or dropped outputs. Two review cells with `coercion_failed`-adjacent behavior in the enrich step recovered on outer retry (`retries: 3`, only used `retry=1`).

## Total & per-phase duration

- First event: `2026-06-30T20:58:16.767Z` (`Conductor starting`, ms epoch 1782853096767)
- Last event: `2026-06-30T22:28:44.877Z` (`Uploading workspace files`, ms epoch 1782858524877)
- **Wall clock: 5428.1 s = 90.47 min**

Sum of declared step durations = 5411.8 s = 90.20 min (17-s gap = orchestrator init/upload framing).

## Per-step timing table

| idx | step                            | dur (s) | dur (min) | items | notes                                                     |
|-----|---------------------------------|--------:|----------:|------:|-----------------------------------------------------------|
| 0   | fetch-crc-guides                |   37.0  |   0.62    |     0 | Supabase download                                         |
| 1   | **review**                      | **5049.7** | **84.16** | **120** | **dominates: 93.1% of wall-clock**                    |
| 2   | cross-run-consolidate-crc       |    0.7  |   0.01    |     0 | script                                                    |
| 3   | enrich-findings                 |    0.5  |   0.01    |     0 | script                                                    |
| 4   | prepare-enrichment-inputs       |    0.5  |   0.01    |     0 | script                                                    |
| 5   | enrich-final-comment            |  234.1  |   3.90    |   291 | Haiku 4.5, maxWorkers=50, 2 retries out of 291 cells      |
| 6   | collect-enriched-final-comments |    0.6  |   0.01    |     0 | script                                                    |
| 7   | rephrase-titles                 |   87.1  |   1.45    |     0 | single agent                                              |
| 8   | upload-titles-cache             |    1.0  |   0.02    |     0 | script                                                    |
| 9   | build-crc-review-comments       |    0.5  |   0.01    |     0 | script                                                    |

**Which step dominates?** `review` is 5049.7 s of 5428.1 s = **93.1% of wall-clock**. Everything else is either 4-min (`enrich-final-comment`) or sub-second scripts.

### Review-cell distribution (n=120)

| metric | value |
|--------|------:|
| min    |  74 s |
| median | 785 s |
| avg    | 798 s |
| p90    | 1348 s |
| p95    | 1584 s |
| p99    | 1991 s |
| max    | 2174 s |
| sum    | 95,815 s |

**Effective parallelism = 95815 / 5049.7 = 18.97** (out of 24 slots — headroom lost to the tail).

### Enrichment-cell distribution (n=291)

| metric | value |
|--------|------:|
| min    |  17 s |
| median |  28 s |
| avg    |  32 s |
| p90    |  51 s |
| p95    |  60 s |
| p99    |  83 s |
| max    | 122 s (`crc-aw-redlines__AW-RL-10.json`) |
| sum    | 9,302 s |

Effective parallelism = 9299 / 234.1 = **39.72** (out of 50 slots).

## Which steps struggled?

**`review` step** — throughput plus a heavy tail.

- Total step wall-clock 5049.7 s; the **last cell started at t=+57 min 15 s and ended at t=+84 min 09 s**, giving a **26.9-min drain tail** where fewer than 24 slots were in use.
- Time spent at each concurrency level:
  - **24 active (saturated):** 3476.6 s (68.9% of step) — throughput-bound region.
  - **1–23 active:** 1573.1 s (31.1% of step) — the ramp-up (~5s) and the drain tail (~26 min).
- Slowest six cells (all >1500 s, i.e. > p95):
  - `crc-CA-2.md` (5 runs, avg 1658 s, max 2174 s, σ=284)
  - `crc-SP-3.md` (5 runs, avg 1600 s, max 1991 s, σ=284)
  - `crc-SP-2.md` (max 1571 s)
  - `crc-DE-2.md` (max 1507 s)
  - `crc-CA-2.md` and `crc-SP-3.md` both show high run-to-run variance (σ ~284 s) — same guide across 5 runs varying by ~15 min.

**`enrich-final-comment` step** — one micro-storm blip.

- 2 of 291 cells hit `agent.structured_output.coercion_failed` (0.69% cell-failure rate).
- Affected cells: `crc-TPW__TPW-20.1.json` (index 40, run-1), `crc-AW__AW-1.2.json` (index 280, run-1). Both fired 5 internal SDK attempts before the outer retry, then completed successfully on the first outer retry.
- Backoffs observed: 5926 ms and 6589 ms.

**All other steps** completed in sub-second (`consolidate`, `enrich-findings`, `prepare-enrichment-inputs`, `collect`, `upload-titles-cache`, `build-crc-review-comments`) or 87 s (`rephrase-titles`). No struggles.

## Retry-storm verdict: **NO — closure criterion MET for the review step**

Reading the bug doc (`winston/workspaces/comment-resolution-check/crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md`), the original bug is a **`review` step** issue driven by the model double-wrapping the envelope under a single key (`findings`, `data`, `output`, `properties`, …) instead of emitting `{grouping, findings, summary}` at the root. The closure bar (as of the 2026-06-25 update) is:

> zero `agent.structured_output.coercion_failed` events in the review step (wrapped attempts should become `coercion_repaired` instead)

### What we searched for and found

| Signature | Result |
|-----------|-------:|
| `agent.structured_output.coercion_failed` in `review` step | **0** (across 120 cells) |
| `agent.structured_output.coercion_repaired` (any step)     | **0** |
| `topLevelKeys:["findings"]` in the review step             | **0** |
| Schema errors `must have required property 'grouping'` / `/findings: must be array` in review step | **0** |
| `agent.structured_output.normalized` in `review` step      | **120** (one per cell) |
| `Canonicalized lenient structured output into {grouping, findings} envelope` | **120** |

The **review step is clean**. Every one of the 120 cells emitted a lenient-schema payload that was canonicalized on the orchestrator side. Zero wasted internal attempts on the double-wrap shape.

### What we did find (adjacent, non-storm)

**2 `coercion_failed` events, both in `enrich-final-comment`, not `review`:**

| item                            | run   | index | attempts (topLevelKeys)                                              | schema_errors                                           |
|---------------------------------|-------|------:|----------------------------------------------------------------------|---------------------------------------------------------|
| `crc-TPW__TPW-20.1.json`        | run-1 |    40 | `__unparsedToolInput` ×4, `enrichedFinalComment` ×1                  | `must have required property 'source'`                  |
| `crc-AW__AW-1.2.json`           | run-1 |   280 | `__unparsedToolInput` ×3, `enrichedFinalComment` ×2                  | `must have required property 'source'` (×2)             |

This is a **different bug shape** than the storm doc describes:
- Different step (enrichment fan-out, Haiku 4.5, `enriched-final-comment.schema.json` — not the CRC review schema).
- Different failure mode: 4 of the 10 attempts total came back as `__unparsedToolInput` (tool-input JSON never parsed) rather than a wrapped envelope; only the `enrichedFinalComment` attempts are wrapper-shaped, and the missing property is `source`, not `grouping`.
- Wasted-attempt cost: 10 internal Haiku calls (2 cells × 5 attempts) plus 2 outer-retry cells that succeeded on retry 1 (~1 extra Haiku call each = ~12 wasted Haiku calls total).
- Recovery: **both cells recovered** — `crc-TPW__TPW-20.1.json` completed 21:34:20 → 21:34:38, `crc-AW__AW-1.2.json` completed 22:26:04 → 22:26:55.

**Verdict:** **NO retry storm.** The review-step closure criterion is met (zero `coercion_failed`). The 2 enrichment-step events are an adjacent, low-volume issue (0.69% of enrichment cells) that recovers automatically via `continueOnFailure: true` + outer retries.

## Stability / error breakdown

- **log level 50 (errors):** 2 (both the enrich `coercion_failed` events above)
- **log level 40 (warnings):** 4 (the two "Item failed, retrying" + two "Retrying item after Xs backoff" companions for the same 2 items)
- **level 30 (info):** ~103,282 lines
- **error log file** (`comment-resolution-check-error.log`): 6 events total (matches: 2 err + 4 warn)
- **Item retries:** 2 across the entire run (both in `enrich-final-comment`, both recovered on `retry=1`)
- **Rate-limit hits (`isRateLimit:true`):** 0
- **Vision tool errors:** 0 / 538 calls (100% success, `success:true` on every line of `vision-log.jsonl`)
- **Script tool errors:** 0

## Concurrency / throughput

- **review step:** maxWorkers=24 vs 120 cells to process. **Peak concurrency reached 24 (saturated).** Time at each concurrency level:
  - 24 active: 3476.6 s (68.9% of step)
  - 21–23 active: 179.2 s (3.5%)
  - 1–20 active: 1393.9 s (27.6%) — mostly the drain tail
  - Effective parallelism 18.97 / 24 = **79% utilization**.
- **The step is throughput-bound during saturation (68.9% of its time) and tail-bound during the drain (26.9 min at declining concurrency).**
- The tail is caused by 4-5 specific slow guides (CA-2, SP-3, SP-2, DE-2) whose per-cell duration is 2-3× the median. Because we run 5 independent runs of each, the tail is dominated by 5 replicas of the slowest guide, not by workload imbalance we can hide with more workers.
- **Would more workers help?** During saturation, yes — a linear win up to the point where the queue empties. But even at unbounded concurrency the wall-clock floor is `max(cell_duration) ≈ 2174 s = 36.2 min`, plus ramp-up. So the *achievable* wall-clock with infinite workers is roughly 36-40 min for review vs the observed 84 min → workers could shave ~44 min. Diminishing returns: at 48 workers the tail's already been eaten; the slowest 5-cell cohort (5× `crc-CA-2.md`) fits in 5 workers.
- **enrich step:** maxWorkers=50 vs 291 cells. Peak concurrency = 50 (saturated 165.3 s of 234.1 s = 70.6% of step). Effective parallelism 39.72 / 50 = **79% utilization**. Fine as-is.

## Recommendations

1. **Ship the enrichment micro-storm fix.** The 2 `coercion_failed` events in `enrich-final-comment` fit the same generic-wrapper reflex the storm doc's 2026-06-25 update calls out (`enrichedFinalComment` wrapping the whole envelope). Applying conductor #197's structural repair path to the enrichment schema — match `source` + `enrichedFinalComment` by structure, not wrapper key — would eliminate the 5 wasted internal Haiku attempts per event and remove the two outer-retry backoffs (~15 s of wall-clock).
2. **Attack the review-step tail, not the width.** The 26.9-min drain tail is where the wall-clock hides. Splitting `crc-CA-2.md` and `crc-SP-3.md` (both ~1600 s avg with σ=284 s) into smaller guides — same treatment already applied to CA (1/2/3), SP (1/2/3), TPW (1/2) — would slash their per-cell cost by ~2× and immediately drop the p95 from ~1584 s to ~800 s. Effective parallelism would rise closer to the 24 ceiling.
3. **Only then consider more workers.** With `maxWorkers` already at 24 and effective parallelism at 19, another 12 workers gets you at most 25% more throughput during the saturated phase (68.9% of step time) — call it ~15% wall-clock savings on the review step (~13 min off 84). Compare with (2), which addresses both the saturated *and* tail regions. Do (2) first.
4. **Fix the terminal `status.json` write.** `status.json` reports `"status":"in-progress"` after the workflow has run through all 10 steps and started the upload trailer. Downstream monitoring can't distinguish "completed" from "abandoned mid-flight" without cross-referencing `run-log.json`. Small polish item.
