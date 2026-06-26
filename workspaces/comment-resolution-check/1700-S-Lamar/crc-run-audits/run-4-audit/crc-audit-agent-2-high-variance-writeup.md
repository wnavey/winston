# CRC Audit Agent 2 — Majority-Vote & Variance Write-up

- **Review ID**: `1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8`
- **Submission Version ID**: `6b9b85ed-e992-4906-a222-b24ee836910c`
- **Guides**: `crcGuidesSubmissionVersionId=6b9b85ed-e992-4906-a222-b24ee836910c`, `crcGenerationNumber=5`
- **Effective review timestamp**: `2026-06-26T16:36:23.682Z` (from `crc-guides-manifest.json#fetchedAt`; no separate `review_created_at` field is stored in the run artifacts)
- **Runs**: 5 of 5 per item (no coverage gaps — every checklist item received exactly 5 per-run votes)
- **Checklist items**: 229 across 17 distinct department groupings (SP-1/2/3, CA-1/2, DE-1/2 are collapsed in the consolidator)

---

## Executive summary

- **229 items voted, 165 unanimous (72%), 64 non-unanimous (28%)**.
- **Vote-shape distribution**: `5-0` = 165, `4-1` = 35, `3-2` = 27, `3-1-1` = 1, `2-2-1` = 1. **No coverage gaps** (`runCount = totalRuns = 5` for every item).
- **Majority-status distribution**: failed = 167, resolved = 32, uncertain = 29, not-applicable = 1.
- **The consolidator treats any tie as `uncertain`.** Every one of the 27 `3-2` splits and both 3-way splits resolved to `uncertain` (27 + 2 = 29 = the entire `uncertain` bucket). `4-1` splits always resolve to the 4-vote side.
- **Confidence tracks split shape exactly**: all 165 unanimous items are `high`; every non-unanimous item is `medium`. No `low` confidence appeared.
- **Noisiest departments by non-unanimity rate**: crc-AW (66.7%), crc-F (57.1%), crc-PB (50.0%), crc-WQ (43.8%), crc-TPW (42.1%). crc-SP and crc-DE have the largest absolute disagreement counts (18 and 12 non-unanimous items respectively).
- **No historical comparison was performed** (see Limitations) — the running-variance TSV contains only this review's rows.

---

## Current-run high-variance items

**All 64 non-unanimous items**, grouped by split shape. Splits are formatted `shape (NxStatus,...)`.

### 3-way splits (maximum disagreement — 2 items)

| dept | item | per-run statuses | split | majority |
|---|---|---|---|---|
| crc-CM | CM-7 | n/a, failed, failed, resolved, failed | `3-1-1 (3xfailed,1xnot-applicable,1xresolved)` | **uncertain** |
| crc-TPW | TPW-8 | failed, n/a, resolved, failed, resolved | `2-2-1 (2xfailed,2xresolved,1xnot-applicable)` | **uncertain** |

### 3-2 splits (27 items — all resolve to `uncertain`)

| dept | item | split | majority |
|---|---|---|---|
| crc-AW | AW-1 | 3-2 (3xresolved,2xfailed) | uncertain |
| crc-AWRR | AWRR-3 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-DE | DE-0 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-DE | DE-1 | 3-2 (3xnot-applicable,2xfailed) | uncertain |
| crc-DE | DE-2 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-DE | DE-9 | 3-2 (3xresolved,2xfailed) | uncertain |
| crc-DE | DE-14 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-DE | DE-26 | 3-2 (3xresolved,2xfailed) | uncertain |
| crc-DE | DE-32 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-DE | DE-35 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-EV | EV-17 | 3-2 (3xresolved,2xfailed) | uncertain |
| crc-F | F-2 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-F | F-5 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-F | F-6 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-OWB | OWB-9 | 3-2 (3xfailed,2xnot-applicable) | uncertain |
| crc-PB | PB-1 | 3-2 (3xresolved,2xfailed) | uncertain |
| crc-PR | PR-4 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-SP | SP-1 | 3-2 (3xresolved,2xfailed) | uncertain |
| crc-SP | SP-2 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-SP | SP-4 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-SP | SP-25.1 | 3-2 (3xresolved,2xfailed) | uncertain |
| crc-SP | SP-25.2 | 3-2 (3xresolved,2xfailed) | uncertain |
| crc-SP | SP-25.3 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-SP | SP-29 | 3-2 (3xfailed,2xnot-applicable) | uncertain |
| crc-SP | SP-50 | 3-2 (3xfailed,2xresolved) | uncertain |
| crc-WQ | WQ-5 | 3-2 (3xnot-applicable,2xfailed) | uncertain |
| crc-WQ | WQ-6 | 3-2 (3xresolved,2xfailed) | uncertain |

### 4-1 splits (35 items — majority wins)

| dept | item | split | majority |
|---|---|---|---|
| crc-aw-redlines | AW-RL-3 | 4-1 (4xfailed,1xresolved) | failed |
| crc-AWRR | AWRR-1 | 4-1 (4xfailed,1xnot-applicable) | failed |
| crc-CA | CA-15 | 4-1 (4xfailed,1xresolved) | failed |
| crc-CA | CA-16 | 4-1 (4xfailed,1xresolved) | failed |
| crc-DE | DE-13 | 4-1 (4xfailed,1xresolved) | failed |
| crc-DE | DE-17 | 4-1 (4xfailed,1xresolved) | failed |
| crc-DE | DE-25 | 4-1 (4xfailed,1xresolved) | failed |
| crc-F | F-1 | 4-1 (4xfailed,1xresolved) | failed |
| crc-SP | SP-21 | 4-1 (4xfailed,1xresolved) | failed |
| crc-SP | SP-23 | 4-1 (4xfailed,1xresolved) | failed |
| crc-SP | SP-24 | 4-1 (4xfailed,1xresolved) | failed |
| crc-SP | SP-30 | 4-1 (4xfailed,1xresolved) | failed |
| crc-SP | SP-36 | 4-1 (4xfailed,1xresolved) | failed |
| crc-SP | SP-43 | 4-1 (4xfailed,1xresolved) | failed |
| crc-SP | SP-48 | 4-1 (4xfailed,1xresolved) | failed |
| crc-TPW | TPW-6 | 4-1 (4xfailed,1xnot-applicable) | failed |
| crc-TPW | TPW-7 | 4-1 (4xfailed,1xnot-applicable) | failed |
| crc-TPW | TPW-9 | 4-1 (4xfailed,1xnot-applicable) | failed |
| crc-TPW | TPW-11 | 4-1 (4xfailed,1xnot-applicable) | failed |
| crc-TPW | TPW-16 | 4-1 (4xfailed,1xresolved) | failed |
| crc-TPW | TPW-20 | 4-1 (4xfailed,1xresolved) | failed |
| crc-WQ | WQ-0 | 4-1 (4xfailed,1xresolved) | failed |
| crc-WQ | WQ-7 | 4-1 (4xfailed,1xresolved) | failed |
| crc-WQ | WQ-8 | 4-1 (4xfailed,1xresolved) | failed |
| crc-TPW | TPW-17 | 4-1 (4xnot-applicable,1xfailed) | not-applicable |
| crc-AW | AW-2 | 4-1 (4xresolved,1xfailed) | resolved |
| crc-DE | DE-34 | 4-1 (4xresolved,1xfailed) | resolved |
| crc-EV | EV-01 | 4-1 (4xresolved,1xfailed) | resolved |
| crc-EV | EV-02 | 4-1 (4xresolved,1xfailed) | resolved |
| crc-EV | EV-13 | 4-1 (4xresolved,1xfailed) | resolved |
| crc-SP | SP-12 | 4-1 (4xresolved,1xfailed) | resolved |
| crc-SP | SP-13 | 4-1 (4xresolved,1xfailed) | resolved |
| crc-SP | SP-41 | 4-1 (4xresolved,1xfailed) | resolved |
| crc-WQ | WQ-2 | 4-1 (4xresolved,1xfailed) | resolved |
| crc-WQ | WQ-9 | 4-1 (4xresolved,1xfailed) | resolved |

### Aggregate counts

| split shape | items | majority outcome |
|---|---|---|
| 5-0 (unanimous) | 165 | matches the unanimous status (high confidence) |
| 4-1 | 35 | 24 failed, 10 resolved, 1 not-applicable |
| 3-2 | 27 | 27 uncertain (consolidator treats 3-2 as a tie) |
| 3-1-1 | 1 | uncertain |
| 2-2-1 | 1 | uncertain |
| **Total** | **229** | failed=167, resolved=32, uncertain=29, n/a=1 |
| coverage gaps (runCount < 5) | 0 | n/a |

**Observations**

- The 29 `uncertain` items map *exactly* to the union of `3-2`, `3-1-1`, and `2-2-1` splits — the consolidation policy is "any non-`4-1`-or-better majority = uncertain", regardless of which status had a plurality. This is worth flagging because in 3-2 splits there *is* a plurality the consolidator could have surfaced (with low confidence). Burying 27 plurality outcomes as `uncertain` may hide tractable signal for reviewers.
- Among `4-1` splits, the dissent flips toward `resolved` 10 times (mostly EV, AW, WQ) and toward `failed` 24 times — i.e., the "failed" majority is much more common, consistent with the overall 73% failed rate.
- All 165 unanimous items are tagged `high` confidence; every disagreement is `medium`. There is no `low` confidence tier emitted by the consolidator on this run.

---

## Running / persistent high-variance items

**Skipped per orchestrator gating.** Three prior CRC reviews exist for this `submission_version_id`:

- `7e79e197-...` (2026-06-19) — `crcGenerationNumber = 1` (15 guides)
- `3703349c-...` (2026-06-23) — `crcGenerationNumber = 1` (16 guides)
- `a8d07d22-...` (2026-06-25) — `crcGenerationNumber = 2` (22 guides)

The current run uses `crcGenerationNumber = 5` (21 guides). Across generations the checklist atomization, item IDs, and guide-splits all change (SP-1/2/3 only get collapsed in later generations; DE got re-split between gens 1 and 2; the redlines guide doesn't exist in early generations). Joining items by `(grouping, checklistItemId)` across generations would produce false matches and miss real renames, so the audit skill's gating logic correctly suppresses cross-review comparison.

As a result, the `crc-audit-agent-2-running-variance-all-runs.tsv` contains 229 rows, all with `is_current_run = TRUE` and `review_id = 1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8`. To enable persistent-variance analysis going forward, the consolidator output would need a stable cross-generation item identifier (e.g., a content hash or a SKILL-level rephrased-item ID) — `rephrased-items.json` is present in the output dir and may be a starting point for a future audit pass.

---

## Per-department variance summary

Ranked by non-unanimity rate (high → low):

| department | items | non-unanimous | 4-1 | 3-2 | 3-way | hv rate |
|---|---:|---:|---:|---:|---:|---:|
| crc-AW | 3 | 2 | 1 | 1 | 0 | 66.7% |
| crc-F | 7 | 4 | 1 | 3 | 0 | 57.1% |
| crc-PB | 2 | 1 | 0 | 1 | 0 | 50.0% |
| crc-WQ | 16 | 7 | 5 | 2 | 0 | 43.8% |
| crc-TPW | 19 | 8 | 7 | 0 | 1 | 42.1% |
| crc-SP | 54 | 18 | 10 | 8 | 0 | 33.3% |
| crc-DE | 37 | 12 | 4 | 8 | 0 | 32.4% |
| crc-AWRR | 7 | 2 | 1 | 1 | 0 | 28.6% |
| crc-EV | 18 | 4 | 3 | 1 | 0 | 22.2% |
| crc-PR | 7 | 1 | 0 | 1 | 0 | 14.3% |
| crc-CM | 8 | 1 | 0 | 0 | 1 | 12.5% |
| crc-OWB | 9 | 1 | 0 | 1 | 0 | 11.1% |
| crc-aw-redlines | 10 | 1 | 1 | 0 | 0 | 10.0% |
| crc-CA | 29 | 2 | 2 | 0 | 0 | 6.9% |
| crc-AD | 1 | 0 | 0 | 0 | 0 | 0.0% |
| crc-ATPW | 1 | 0 | 0 | 0 | 0 | 0.0% |
| crc-IW | 1 | 0 | 0 | 0 | 0 | 0.0% |

Notes:
- **crc-AW, crc-F, crc-PB** have the highest disagreement *rates* but small N (≤7 items each) — small-sample effect. Worth a qualitative spot-check of those guides; not yet a generalizable signal.
- **crc-SP and crc-DE** are the largest sources of *absolute* disagreement (18 and 12 items, 30 of the 64 non-unanimous items combined). Both also produce 8 `3-2` splits — these are the two departments where the consolidator most often falls back to `uncertain`. They are the highest-value targets for guide refinement / additional reviewer guidance.
- **crc-TPW** is the only department with a 3-way split (TPW-8) and has 4 separate `4-1 (4xfailed,1xnot-applicable)` items, which suggests a recurring applicability ambiguity (single dissenter consistently votes n/a while peers vote failed) — likely a guide-level scope-of-application issue rather than a per-item evidence problem.
- **crc-CA** is the cleanest of the large departments: 29 items with only 2 disagreements (6.9%).

---

## Data sources

- Primary: `RUN_DIR/output/consolidated-findings.json` (229 items, JSON array, includes `perRunFindings[]` and majority `status` / `confidence`).
- Cross-check: `RUN_DIR/output/runs/run-{1..5}/findings/<dept>.md.json` (per-run raw, 21 files × 5 runs = 105 files; not loaded for this audit because consolidated-findings already encodes all 5 per-run statuses and the run counts reconcile to 5/5 everywhere).
- Run metadata: `RUN_DIR/output/crc-guides-manifest.json` — used `fetchedAt = 2026-06-26T16:36:23.682Z` as the `review_created_at`. `crcGenerationNumber = 5` confirmed via `resolved.crcGenerationNumber`.

## Limitations

- **Historical comparison skipped** by orchestrator gating because guide generations are incompatible across the three prior CRC reviews (`gen=1, 1, 2`) vs. the current run (`gen=5`). All variance findings here are within-run only.
- **Tie semantics are inferred from the data, not from a tie-breaking config**: every observed 3-2, 3-1-1, and 2-2-1 split mapped to `uncertain`. I did not verify the tie-breaking rules against the consolidator source code; it's possible there are split shapes the consolidator handles differently that just didn't appear in this run.
- **Per-run status alphabet** in this run is `{failed, resolved, not-applicable}`; `uncertain` only appears as a *majority* (tie) status, never as a per-run vote. `missing` did not appear at all (every item got 5/5 runs).
- **Confidence labelling is mechanical, not Bayesian**: `high` ⇔ unanimous, `medium` ⇔ any disagreement. There is no `low` tier in this run, even for 3-way splits where one might expect it.
