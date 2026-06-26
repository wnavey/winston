# CRC Run Audit — Agent 1: Performance & Stability

**Verdict: `HEALTHY WITH NOTES`**

- Run ID: `1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8` (calibration test: submission == guides == `6b9b85ed-…ce836910c`)
- Project: Lamar + Collier (projectId `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`), jurisdiction `austin`, crcGenerationNumber `5`
- Config: `runs=5`, `maxWorkers=39`, `model=claude-sonnet-4-5-20250929`, `uncertainThreshold=0.35`
- Storage prefix: `workflow-runs/comment-resolution-check/23301a8a-…/2026-06-26-121000/`

## Executive summary

- Workflow completed cleanly end-to-end: **all 105 review cells produced** (5 runs × 21 dept files), **229/229 findings per run**, all 6 macro-steps closed successfully. Final upload to Supabase storage succeeded (artifacts retrievable from the prefix above).
- **Total wall-clock: 34.44 min** (1782491733945 → 1782493800605 ms). Dominated by the `review` step at **27.79 min (80.7%)**; `rephrase-titles` is a distant second at **5.80 min (16.8%)**; everything else is sub-second to ~37 s.
- **Retry-storm: explicit `NO`.** Zero `agent.structured_output.coercion_failed`, zero `exhausted structured-output retries`, zero `must have required property 'grouping'` / `/findings: must be array` schema errors. The bug's original closure criterion is **met for this run** (under the lenient emit schema — see retry-storm section for nuance).
- **Errors: 15** — all the same root cause (`crc-vision-check: DB error fetching plan_set_version: TypeError: fetch failed`), all on the same `documentId` 908ffab5-…, all clustered in an 81-second window early in the run. Vision-tool success rate 309/324 = **95.4%**. No level-40 warnings anywhere. No agent-level errors.
- **Concurrency: throughput-bound for the first ~16 min, then tail-bound.** Time-weighted avg in-flight = **27.5 / 39**; peak hit 39 and stayed pinned for ~15 minutes. One straggler (`crc-CA-2.md` run-5, 781.8 s) held the `review` step open for an extra **283 s (~4.7 min, 17% of step wall-clock)** after every other cell finished. More workers would not help — already saturated when work was queued.

## Outcome

| Check | Result |
|---|---|
| Workflow completed? | **Yes** — last log event is `build-crc-review-comments` step completed (+0 s drift), followed by `Uploading workspace files` (no completion msg in captured log, but artifacts present in storage bucket) |
| 5 × 21 = 105 review cells produced? | **Yes** — `Claimed item, launching agent` ×105, `Item completed` ×105, `Wrote structured output` ×105, `agent.completed` ×105 (×106 incl. rephrase-titles) |
| Per-run output complete? | **Yes** — `runs/run-{1..5}/findings/` each contain 21 files / 229 findings (verified via jq) |
| Consolidated findings? | **Yes** — `consolidated-findings.json` is a 229-element array (matches brief) |
| Final downstream artifacts? | **Yes** — `enriched-findings.json` (488 KB), `rephrased-items.json` (11.6 KB), `review-comments.json` (2.8 MB) all present |
| Partial / dropped outputs? | **None** — 0 failed cells, 0 retry exhaustions, no missing files |
| DB save / cloud persist? | Indirectly confirmed — `workflow_runs` record was created (`runId: 2aa95d55-b23e-4ce5-9d77-aad056d0f2cc`), build-crc-review-comments succeeded, upload to Supabase storage was initiated and artifacts are present in the bucket |

## Total wall-clock & per-phase duration

- First event: `Conductor starting` @ t=1782491733945
- Last event: `Uploading workspace files` @ t=1782493800605
- **Total = 2 066 660 ms = 34.44 min**

Setup overhead (workflow load → step 0 start): **12.88 s** (project download, workspace prep, site-plan data write for 57 sheets + 14 supplementary docs).

## Per-step timing table

| # | Step | Duration | Min | % of total |
|---|---|---:|---:|---:|
| 0 | fetch-crc-guides (script) | 36 912 ms | 0.62 | **1.8%** |
| 1 | **review** (agent ×105, parallel) | **1 667 489 ms** | **27.79** | **80.7%** |
| 2 | cross-run-consolidate-crc (script) | 578 ms | 0.01 | <0.1% |
| 3 | enrich-findings (script) | 507 ms | 0.01 | <0.1% |
| 4 | rephrase-titles (single agent) | 347 858 ms | 5.80 | **16.8%** |
| 5 | build-crc-review-comments (script) | 437 ms | 0.01 | <0.1% |

**Step that dominates: `review`** (80.7%). Second-largest: `rephrase-titles` (16.8%, single-agent against the 488 KB `enriched-findings.json`). All three scripts are essentially free.

## Per-item cell-duration distribution (review step, n=105)

| stat | seconds |
|---|---:|
| min | 160.0 |
| p25 | 325.5 |
| median | 417.6 |
| mean | 436.3 |
| p75 | 541.4 |
| p95 | 748.6 |
| max | 790.0 |

Sum of all cell durations = **763.6 cell-min** of work parallelized into 27.8 wall-clock min.

### Per-dept (median across 5 runs)

| Item | n | min_s | med_s | max_s | avg_s |
|---|---:|---:|---:|---:|---:|
| crc-AD.md | 5 | 160 | 173 | 319 | 202 |
| crc-ATPW.md | 5 | 172 | 216 | 230 | 207 |
| crc-OWB.md | 5 | 238 | 284 | 349 | 280 |
| crc-IW.md | 5 | 247 | 303 | 417 | 326 |
| crc-PB.md | 5 | 290 | 320 | 382 | 333 |
| crc-CM.md | 5 | 247 | 337 | 456 | 353 |
| crc-WQ.md | 5 | 331 | 383 | 487 | 395 |
| crc-AW.md | 5 | 295 | 395 | 591 | 405 |
| crc-PR.md | 5 | 267 | 445 | 495 | 409 |
| crc-EV.md | 5 | 352 | 426 | 527 | 422 |
| crc-F.md | 5 | 415 | 422 | 527 | 444 |
| crc-AWRR.md | 5 | 257 | 342 | 354 | 319 |
| crc-SP-1.md | 5 | 348 | 512 | 549 | 465 |
| crc-SP-2.md | 5 | 409 | 449 | 582 | 473 |
| crc-aw-redlines.md | 5 | 413 | 540 | 685 | 549 |
| crc-TPW.md | 5 | 477 | 557 | 704 | 575 |
| crc-SP-3.md | 5 | 501 | 604 | 755 | 602 |
| **crc-CA-2.md** | 5 | 543 | 580 | **782** | **613** |
| **crc-CA-1.md** | 5 | 380 | 665 | **790** | **615** |
| **crc-DE-2.md** | 5 | 506 | 634 | **775** | **647** |
| crc-DE-1.md | 5 | 420 | 497 | 667 | 529 |

The slow tail is concentrated in **CA-1 / CA-2 / DE-1 / DE-2 / SP-3 / TPW / aw-redlines** — the deepest checklists. CA-2 in run-5 was the absolute straggler at 781.8 s.

## Which steps struggled?

- **`review` step (long, but no struggle internally):** 0 failed cells, 0 retries exhausted, 0 schema-coercion failures, 0 agent errors. The 15 vision errors are tool-level (DB fetch transient) and the agent kept moving — no item was blocked.
- **`rephrase-titles` step (single mishap, recovered):** the agent's first action was `Read` on the 488 KB `enriched-findings.json` and got a single `"is_error":true` ("File content (488.2KB) exceeds maximum allowed size (256KB)"). It immediately pivoted to a `jq`-via-Bash extraction and produced `rephrased-items.json` (11.6 KB). One soft failure, one clean recovery. Total step still consumed 5.8 min serially against 229 items — this is a real optimization target (see Recommendations).
- **Slow cell outliers:** all the slow cells are large-checklist depts (CA-1: 21 items, DE-1: 33 items, SP-3 49 items, etc., per the retry-storm doc's atomic-count table). Not anomalous — it's checklist-size driven.

## Retry-storm verdict — **NO**

Bug doc: `/Users/wnavey/noetic/winston/workspaces/comment-resolution-check/crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md`.

Searched the main log (`comment-resolution-check.log`, 11992 lines) for the signatures:

| Signature | Count |
|---|---:|
| `agent.structured_output.coercion_failed` | **0** |
| `exhausted structured-output retries` | **0** |
| `must have required property 'grouping'` OR `/findings: must be array` | **0** |
| `"topLevelKeys":["findings"]` (the double-wrap reflex) | **0** |
| level-50 entries containing any agent/structured-output error | **0** |
| `agent.structured_output.normalized` (lenient-schema inject, expected) | 105 |

**Original closure criterion** (bug doc, pre-06-25): *zero `coercion_failed` events in the error log.* → **MET**.

**Updated closure criteria** (bug doc, 2026-06-25 update under "Revised closure criteria"):
- Per conductor #197, wrapped attempts should now appear as `coercion_repaired` instead of `coercion_failed`. **No `coercion_repaired` events** in this log either — meaning the model never even produced a wrapped shape that needed repair. This is consistent with bureau #459 (the prompt alignment) reducing **frequency** of the double-wrap reflex, with conductor #197 in place as the net.
- Wasted internal attempts: 105 cells × 1 `agent.completed` each → no evidence of burned attempts.

Verdict: **No retry storm. Bug appears closed for this run** — both the original "zero coercion_failed" bar and the revised "wrapped attempts get repaired or never happen" bars are satisfied. The 105 `Canonicalized lenient structured output into {grouping, findings} envelope` log lines are the **expected** lenient-schema flow (inject `grouping` from filename), not coercion failures.

## Stability / error breakdown

**Error log: 15 entries, all the same class.**

| Class | Count | Severity | Description |
|---|---:|---|---|
| `crc-vision-check: failed to load primary file` (DB fetch failed) | 15 | level-50 | `getFileContent` → `DB error fetching plan_set_version: TypeError: fetch failed`. All on `documentId=908ffab5-9bf8-4155-b9f7-b3c3be0663ff`. |

Time clustering: all 15 errors fall in **an 81.4-second window** (t=+199 s → +281 s into the review step). After that window the same document/sheet combinations succeed. This is the **classic transient Supabase/network blip** signature — not a steady-state bug.

Sheet/cell breakdown of the 15 fails:

| Sheet | # fails | Affected items |
|---:|---:|---|
| 6 | 3 | AW-RL-1 |
| 19 | 3 | IW-1 |
| 14 | 2 | SP-23/24, PR-5/7 |
| 18 | 2 | PB-1/2, PB-2 |
| 1 | 1 | CM-10/12/13 |
| 3 | 1 | AW-2 |
| 13 | 1 | PR-5/7 |
| 17 | 1 | F-1/2/3/5/6 |
| 43 | 1 | AD-2 |

Vision-log totals (`vision-log.jsonl`): **324 vision calls, 309 success, 15 error → 95.4% success rate**. (Tool-detail belongs to Agent 3; flagged here only as a stability touchpoint — no item was failed downstream, the model continued past the tool error.)

**Other stability notes:** zero level-40 warnings, zero `agent.error`, zero failed cells, zero retries exhausted, zero `permission_denied`, no abnormal session terminations.

## Concurrency / throughput

- Configured: `maxWorkers=39`. Items: 105.
- **Time-weighted average in-flight: 27.5** (across the full review step including drain).
- **Peak in-flight: 39** — concurrency cap was reached and held for ~15.5 min.

30-second buckets, in-flight count:

```
t=  0-960s   avg 38.5 - 39.0     <-- saturated (throughput-bound)
t=960-1380s  avg 7 - 35           <-- draining (mixed-phase)
t=1380-1670s avg 1                 <-- single straggler tail
```

Last cell **started** at t=+960 s and **finished** at t=+1667.5 s — `crc-CA-2.md / run-5`, 781.8 s individual duration. The step couldn't close until that single cell finished, costing **283 s (~4.7 min)** of pure tail beyond the penultimate finish.

Parallelization efficiency:
- Total cell-work: 763.6 cell-min
- Ideal w/ 39 workers, perfectly balanced: 19.58 min
- Actual: 27.79 min
- **Efficiency: 70.4%**
- Decomposition: ~12% lost to natural straggler imbalance (long tail of slow depts), ~17% lost to the single CA-2/run-5 outlier.

**Throughput-bound or tail-bound?** Both, sequentially. First 15.5 min: throughput-bound (workers fully consumed). Last ~12 min: tail-bound (work drains, single straggler closes it out).

**Would more workers help?** **No, not materially.** During saturation the queue was full and 39 workers were always busy — more workers would only help if there were >39 items waiting, which there weren't (only 105 items total, average ~7.3 min each → queue drained naturally). The remaining inefficiency is straggler-shaped, not concurrency-shaped. A 6th worker added to the back wouldn't help the CA-2/run-5 cell run faster.

## Recommendations

1. **Tail-bound finish — biggest single win.** `crc-CA-2.md / run-5` solo-occupied the step for 283 s. Without changing checklist content, two cheap levers exist:
   - **LPT scheduling.** Sort items by historical p95 duration and dispatch slowest-first so big-checklist depts (CA-1, CA-2, DE-2, SP-3) start in the first wave; tail-of-queue work is then the fastest items. With 5×21 items and known per-dept costs from prior runs, this is a one-line workflow-yaml change.
   - **Per-cell timeout / soft-kill.** Any cell exceeding ~2× p75 (~1100 s) probably hit a runaway agent loop. Add a per-cell `maxDurationMs` and force-finalize with a "review incomplete" status; the consolidation step will absorb it via the existing per-run counting logic.
2. **`rephrase-titles` Read-too-large miss (5.8 min single-thread).** The agent always trips the 256 KB Read limit on `enriched-findings.json` (488 KB) and falls back to `jq` via Bash. Cheap fixes:
   - Pre-shrink the input: hand the agent a slim `rephrase-input.json` (only `checklistItemId` + `requirement` + `parentCommentId`, the three fields it actually needs — ~10–20 KB).
   - Or rewrite as a deterministic script with one LLM call per finding batched in parallel.
   - Either should drop this step from ~5.8 min to <1 min.
3. **Transient `crc-vision-check` DB fetch.** 15 fails in 81 s all on the same `documentId` is a Supabase/network blip. Add a small in-tool retry-with-backoff (3 attempts, 250 ms / 500 ms / 1 s) on `TypeError: fetch failed` from `getFileContent` — would have absorbed all 15 of these silently. Currently the agent recovers downstream but it pollutes the error log and degrades the vision-tool success rate by ~5 pp.
4. **Keep an eye on the retry-storm net.** This run shows zero `coercion_failed` and zero `coercion_repaired`, which is the **ideal** post-#459 outcome. Track both counters in CI; if `coercion_repaired` starts climbing again on a future model upgrade, that's the structural-repair net catching wrapped shapes and is the cue to revisit the prompt anti-pattern list.

---

### Return summary (~12 lines for synthesis)

CRC run `1b2f8fa5` is **HEALTHY WITH NOTES**. Workflow completed end-to-end in **34.4 min**, producing all **105/105** review cells (5 runs × 21 dept files, 229 findings each) and all 6 downstream artifacts. The `review` step dominates at **27.8 min (81%)**; `rephrase-titles` second at **5.8 min (17%)** — everything else is sub-second. Median cell duration **418 s**, max **790 s**. Concurrency was excellent for ~15.5 min (peak/sustained 39/39 workers, time-weighted avg 27.5/39), then drained into a **single-straggler tail** (`crc-CA-2.md` run-5, 781.8 s) that solo-occupied the step for an extra **283 s ≈ 17% of step wall-clock**. **Retry-storm verdict: NO** — zero `coercion_failed`, zero exhausted retries, zero schema-error signatures; the bug's original closure criterion is met and the post-2026-06-25 net (conductor #197 + bureau #459) shows zero `coercion_repaired` either, suggesting the bug is closed for this run. Stability: **15 errors total**, all the same class (`crc-vision-check` DB fetch transient), all on documentId `908ffab5-…`, all clustered in an 81-s window — vision success rate **95.4%** (309/324). Zero warnings, zero agent errors. Parallelization efficiency 70.4%; remaining headroom is **tail-shaped, not concurrency-shaped** — more workers wouldn't help. Top recommendations: (1) LPT-order the review queue to push slowest depts first, (2) shrink `rephrase-titles` input to ~10 KB or rewrite as a deterministic script, (3) add 3-attempt backoff inside `crc-vision-check` for transient `fetch failed` errors.
