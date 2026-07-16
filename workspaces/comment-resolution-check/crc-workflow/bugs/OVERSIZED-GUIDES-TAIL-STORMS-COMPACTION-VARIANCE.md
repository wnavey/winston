# Oversized CRC guides are one root cause behind four symptoms: the wall-clock tail, both retry storms, both context compactions, and the chronic-variance cluster

> **Status:** Diagnosed 2026-07-16 from the v5 game-day audit, fix NOT implemented. Root cause lives in **guide partitioning** (`generate-crc-guides` output — how many/which atomic items land in one guide file), not in conductor, the schema, or the model — it presents as four apparently-unrelated runtime pathologies; it isn't four bugs. Discovered on review `ed5e7ba9-ba03-4000-abb4-1021ebec0631` (1700 S Lamar v5, 2026-07-14, sonnet-4-6, 5×24 cells). Audit detail: `1700-S-Lamar/crc-run-audits/run-6-audit/crc-audit-agent-1-performance-stability.md` §5–§8 + `crc-audit-agent-2-high-variance-writeup.md`. Related: `STRUCT-OUTPUT-UNPARSED-EMIT-VARIANT.md` (symptom 2 in depth), winston#162/#164/#167 (guide-generation specs), claude-plugins#135 (census-first Phase 6 v2).

## Summary

Four of the game-day run's five material findings trace to the same handful of guide files — `crc-SP-3`, `crc-SP-2`, `crc-DE-1`, `crc-CA-1` (with `crc-SP-1`/`crc-CA-2` borderline). These guides carry 20–22 verbose atomic items each, which makes their review cells simultaneously: the slowest (means 27.6–36.9 min vs. run median 14.7 min), the only emitters of unparseable truncated StructuredOutput payloads at exhaustion level (both storms on SP-3), the only cells to hit the Agent SDK's auto-compaction threshold (SP-2 at 168.6k pre-tokens, DE-1 at 173.2k), and — per the independent vote-variance audit — the core of the chronically unstable item cluster (crc-DE 12 + crc-SP 10 of the 38 items that split in both this run and the v4 baseline).

What is fine: conductor's scheduling (pool saturated 35/35, 71% time-weighted utilization), the model, the schema, and every guide whose mean cell time is under ~20 min — 18 of 24 guide files produced no storms, no compactions, and modest variance. Splitting was also already proven as the remedy once: the original monolithic `crc-sp` (49 items at gen 1) was split into SP-1/-2/-3, `crc-ca` into CA-1/-2/-3, etc. The gen-6 partition just didn't cut deep enough on the heaviest four.

Root cause in one sentence: **a review cell's cost, fragility, and verdict stability all degrade super-linearly with guide payload (items × per-item verbosity), and four gen-6 guides sit past the knee.**

## The bug in one diagram

```
 guide file size (atomic items × verbose observations, sonnet-4-6)
        │
        ▼
 one agent session per (guide × run) must:
   read guide → gather evidence for EVERY item → emit ALL findings in ONE StructuredOutput
        │
        ├──────────────► SYMPTOM 1: wall-clock tail
        │                SP-3 mean 36.9 min, SP-2 29.6, CA-1 27.7, DE-1 27.6
        │                (run median 14.7 min; last 9.8 min of the run = one SP-3 cell)
        │                infinite-worker floor ≈ 62 min, dominated by these guides
        │
        ├──────────────► SYMPTOM 2: emit truncation → retry storms
        │                findings payload 34–45k chars on heavy guides
        │                → __unparsedToolInput; SP-3 failed 5-of-5 twice
        │                → 2 × coercion_failed, ~70 min compute discarded
        │                (see STRUCT-OUTPUT-UNPARSED-EMIT-VARIANT.md)
        │
        ├──────────────► SYMPTOM 3: context compaction
        │                long tool-heavy sessions cross the SDK auto-compact line:
        │                crc-SP-2/run-1 @168,603 pre-tokens, crc-DE-1/run-4 @173,205
        │                (baseline run: 0 compactions; summary step = reasoning-drift risk)
        │
        └──────────────► SYMPTOM 4: vote instability
                         evidence gathering spread thin across 20+ items/session
                         → chronic 3-2/2-1 splits: crc-DE 12 + crc-SP 10 of the
                         38 items unstable in BOTH v4 baseline and v5 game day

 one lever moves all four:  SPLIT THE GUIDE  (proven: crc-sp 49 items → SP-1/2/3 at gen ≤6)
```

## Symptom (as observed, run `ed5e7ba9`)

Per-guide numbers from the run (items = findings per cell; times = mean over 5 cells):

| Guide | Items | Mean cell | Storms | Compactions | Truncated emits | Chronic-unstable items |
|---|---:|---:|---:|---:|---:|---|
| crc-SP-3 | 20 | **36.9 min** | **2** | 0 | 11 | SP-36.x family |
| crc-SP-2 | 22 | 29.6 min | 0 | **1** (168.6k) | 1 | — |
| crc-CA-1 | 20 | 27.7 min | 0 | 0 | 1 (44.9k — run's largest) | CA-17 |
| crc-DE-1 | 21 | 27.6 min | 0 | **1** (173.2k) | 1 | DE-16/23/24/26 |
| crc-SP-1 | 21 | >26 min | 0 | 0 | 1 | — |
| crc-CA-2 | 20 | >26 min | 0 | 0 | 1 | — |
| (18 others) | ≤23 | ≤ ~20 min | 0 | 0 | 8 total | scattered |

- The run is **tail-bound, not throughput-bound**: perfect packing of its 32.1 agent-hours on 35 workers = 55.0-min floor, but the longest cell (SP-3/run-1 incl. storm) alone is 62.2 min. Raising maxWorkers cannot fix this; the audit explicitly recommends against it until the guides shrink.
- Note `crc-TPW-1` (23 items — the highest raw count) stayed healthy: **raw item count is not the metric; emitted payload/verbosity is** (SP/DE/CA items require long multi-sheet observations; TPW-1's are short). Target budgets below use observed cell time and emit size, not item count alone.

## Evidence chain

1. **The tail is these guides.** Cell stats: median 884s, p95 2,077s, max 3,730s; every guide with mean >26 min is in the table above; the final 9.8 min of the 77.1-min review step was a single crc-SP-3 cell. (Agent 1 §3/§8, log-derived.)
2. **The storms are these guides.** Both `coercion_failed` events (log lines 71853, 93460) are crc-SP-3; 18 of the run's 26 truncated emits, incl. every one ≥34k chars, are on the table's guides. **Emit size tracks guide payload, and only the biggest guide rolled five failures in a row.** (Sibling doc, evidence #5.)
3. **The compactions are these guides.** The run's only 2 `compact_boundary` events are crc-SP-2/run-1 and crc-DE-1/run-4, both `trigger:"auto"` at ~170k pre-tokens; the 07-13 baseline (smaller model, shorter sessions) had zero. Both compacted cells had also each produced one truncated emit minutes earlier — **the same sessions stress both mechanisms.** (Agent 1 §7.)
4. **The chronic variance is these guide families.** Agent 2's cross-run join (identical gen-6 item set, v4 baseline vs v5): 38 items split non-unanimously in *both* runs; crc-DE (12) and crc-SP (10) own 58% of them; 22 of the game day's 49 `uncertain` verdicts were already unstable in v4 — **the instability travels with the guides, not with the plan revision.** (Agent 2 write-up, baseline section.)
5. **Splitting has already worked once.** Gen-1's monolithic `crc-sp` carried 49 items (see `STRUCT-OUTPUT-RETRY-STORM.md`'s per-dept table) and was subsequently split into SP-1/-2/-3 — the run's 24-file guide set (SP×3, CA×3, DE×2, EV×2, TPW×2) *is* the product of earlier splits. **The mechanism exists and is routine; the gen-6 cut points just left four files too heavy for sonnet-class sessions.**

## Root cause

Guide partitioning happens in the `generate-crc-guides` pipeline (claude-plugins; current implementation = census-first Phase 6 v2, claude-plugins#135) when MCR comments/redlines are grouped into per-department guide files. The partition criterion is thematic (department/topic), with a coarse size cap that was calibrated on haiku-class sessions. Missing invariant, precisely: **no guide file may exceed the payload budget a single review session can reliably carry on the production model — measured as (a) expected emit size and (b) expected session length — and the gen-6 partition enforces neither.** The sonnet-4-6 upgrade (longer observations, 676 vision calls vs 148 baseline) moved the knee; the four heavy guides crossed it.

## Impact

| Surface | Status | Mechanism |
|---|---|---|
| Run wall-clock & cost | **affected** | ~22-min tail beyond the packing floor; ~70 min storm-discarded compute; both scale with runs×heavy guides |
| Findings integrity | unaffected so far, ⚠ latent | storms recovered on outer retry #1; a heavy-guide cell exhausting outer retries would drop 20+ items from consolidation (sibling doc, worst case) |
| Verdict stability / uncertain rate | **affected** | the chronic DE/SP instability cluster feeds ~45% of the 49 uncertains — human-review load that re-appears every run until the guides change |
| Reasoning quality on compacted cells | ⚠ unquantified | auto-compaction summarizes mid-session; drift on critical items is the known risk the audit's compaction check exists for |
| Every future sonnet-class CRC run | affected | all four symptoms are structural; expect recurrence at similar rates |

## Fix directions (not yet implemented — directions, not a mandate)

1. **Re-partition the four heavy guides** in the next guide generation: split crc-SP-3 first (2 storms, worst tail), then crc-SP-2, crc-DE-1, crc-CA-1 (watch SP-1/CA-2). Keep **atomicItemIds stable** — only the item→file mapping changes. Budget per file, on observed data: mean cell ≤ ~15 min and expected emit ≤ ~20k chars (≈ ≤10–12 heavy items, more if items are short — use per-item observed verbosity from this run's findings, not raw counts).
2. **Enforce the budget in the pipeline**: add a post-partition check to `generate-crc-guides` that estimates per-file emit size (Σ historical observation lengths) and refuses/re-splits files over budget — so the invariant survives future generations and model upgrades.
3. **Sequencing hazard:** downstream consumers key on split guide *files* — IG log-item matching resolves via findings files (known: "CRC log items are SPLIT guide files"), and run-over-run audit joins use `checklistItemId` (safe) but tool sidecars carry `guideFile` (changes). Re-split at a generation boundary (gen 7), never mid-generation, and note the new file set in the guides manifest.
4. **Measure the fix** on the next run vs. this one: max per-guide mean cell time, compaction count (expect 0), truncated-emit count (expect ≈0 at ≤20k emits), and 3-2-split rate on the ex-DE-1/SP-3 items.

## Prior art

- The crc-sp 49→3-way split (gen ≤6) — same operation, same pipeline; this run's healthy SP-1 (in-budget cells) vs unhealthy SP-3 shows both the success and the residual.
- `claude-plugins#135` (census-first Phase 6 v2) — the partitioning code the budget check belongs in.
- Run-6 audit Agent 1 recommendation #1 and the sibling storm-variant doc's fix #1 — both independently land on this split as the top lever.

## Reproduction / verification recipe

1. Pull the run's per-cell durations: `logs/comment-resolution-check.log` (storage prefix `comment-resolution-check/23301a8a…/2026-07-14-183605/`), claim/complete event pairs per (item, runIndex) — confirm the guide means in the table.
2. `grep -c compact_boundary` → 2 (SP-2/run-1 line 91817, DE-1/run-4 line 92760); `grep -n coercion_failed` → 2 (SP-3 both).
3. Item counts per guide: `jq '.findings | length' output/runs/run-1/findings/<guide>.md.json` — SP-2 22, DE-1 21, SP-1 21, SP-3 20, CA-1 20, TPW-1 23 (healthy control).
4. Chronic-variance join: `crc-audit-agent-2-running-variance-all-runs.tsv` (this audit dir) — filter items non-unanimous in both `ed5e7ba9` and `bfb4f256` rows → 38 items, count by dept.
5. Acceptance: after re-partition, re-run the audit skill on the next review — Agent 1's table shows no guide mean >~15 min, 0 compactions, ≈0 truncated emits; Agent 2 shows the DE/SP chronic cluster shrinking.
