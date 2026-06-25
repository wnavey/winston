# CRC Audit — Agent 2: Vote Variance & Majority-Vote Analysis

Review: `a8d07d22-19e6-4a1f-a12d-a4371c1dbd19`  
Submission version: `6b9b85ed-e992-4906-a222-b24ee836910c` (Lamar + Collier, v4)  
Guide identity: crcGuidesSubmissionVersionId `6b9b85ed-e992-4906-a222-b24ee836910c`, crcGenerationNumber `2`  
Config: 5 runs × 16 departments (22 guide files). Date: 2026-06-25.

## Executive summary

- **Total consolidated items**: 234 (190 failed / 32 resolved / 12 not-applicable).
- **Unanimous (all participating runs agree)**: 146 items (62.4%).
- **Non-unanimous (any disagreement)**: 88 items (37.6%).
- **Coverage-gap items (runCount < 5)**: 8 items — 7 sub-items only run-5 produced (CA-16.1..CA-22.1) and DE-33 missing from run-3. Linked to the structured-output retry storm Agent 1 is investigating.
- **Split distribution**: 32 items split 3-2 (tightest non-tie, near coin-flip on consolidated answer), 55 items split 4-1 (single dissenting run), 1 item split 3-1 (DE-33, missing in run-3). **No three-way splits** — every disagreement involves only two distinct statuses.

## Vote-split distribution (current run, 234 items)

| Split | Count | Notes |
|---|---:|---|
| 5 | 139 | unanimous (all present runs agree) |
| 4-1 | 55 | split |
| 3-1 | 1 | split |
| 3-2 | 32 | split |
| 1 | 7 | unanimous (all present runs agree) |

## Current-run high-variance items

All 88 non-unanimous items, ordered by split severity (most-equal split first).

| ref | dept | split | majority | run-1 | run-2 | run-3 | run-4 | run-5 | coverage gap |
|---|---|---|---|---|---|---|---|---|---|
| `crc-aw:AW-1.2` | crc-aw | 4-1 | failed | failed | failed | failed | not-applicable | failed |  |
| `crc-aw:AW-2` | crc-aw | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-aw-redlines:AW-RL-3` | crc-aw-redlines | 4-1 | failed | resolved | failed | failed | failed | failed |  |
| `crc-awrr:AWRR-2.1` | crc-awrr | 4-1 | resolved | resolved | failed | resolved | resolved | resolved |  |
| `crc-ca:CA-03` | crc-ca | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-ca:CA-06` | crc-ca | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-ca:CA-07.1` | crc-ca | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-de:DE-0` | crc-de | 4-1 | failed | resolved | failed | failed | failed | failed |  |
| `crc-de:DE-13` | crc-de | 4-1 | failed | failed | resolved | failed | failed | failed |  |
| `crc-de:DE-24` | crc-de | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-de:DE-25` | crc-de | 4-1 | failed | failed | failed | failed | failed | not-applicable |  |
| `crc-de:DE-26` | crc-de | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-de:DE-27` | crc-de | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-de:DE-28` | crc-de | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-de:DE-30` | crc-de | 4-1 | failed | failed | failed | failed | resolved | failed |  |
| `crc-de:DE-31` | crc-de | 4-1 | failed | resolved | failed | failed | failed | failed |  |
| `crc-de:DE-4` | crc-de | 4-1 | resolved | resolved | resolved | resolved | failed | resolved |  |
| `crc-de:DE-5` | crc-de | 4-1 | failed | resolved | failed | failed | failed | failed |  |
| `crc-de:DE-7` | crc-de | 4-1 | failed | resolved | failed | failed | failed | failed |  |
| `crc-de:DE-8` | crc-de | 4-1 | failed | resolved | failed | failed | failed | failed |  |
| `crc-ev:EV-01` | crc-ev | 4-1 | resolved | failed | resolved | resolved | resolved | resolved |  |
| `crc-ev:EV-02` | crc-ev | 4-1 | resolved | failed | resolved | resolved | resolved | resolved |  |
| `crc-ev:EV-03` | crc-ev | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-ev:EV-05.1` | crc-ev | 4-1 | resolved | resolved | resolved | failed | resolved | resolved |  |
| `crc-ev:EV-05.2` | crc-ev | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-ev:EV-05.3` | crc-ev | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-ev:EV-05.4` | crc-ev | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-ev:EV-08` | crc-ev | 4-1 | failed | resolved | failed | failed | failed | failed |  |
| `crc-ev:EV-13` | crc-ev | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-ev:EV-15` | crc-ev | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-f:F-1.2` | crc-f | 4-1 | resolved | resolved | resolved | failed | resolved | resolved |  |
| `crc-f:F-3` | crc-f | 4-1 | failed | failed | failed | not-applicable | failed | failed |  |
| `crc-iw:IW-0.2` | crc-iw | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-owb:OWB-5` | crc-owb | 4-1 | failed | failed | resolved | failed | failed | failed |  |
| `crc-pb:PB-1` | crc-pb | 4-1 | resolved | resolved | resolved | resolved | failed | resolved |  |
| `crc-pr:PR-3` | crc-pr | 4-1 | resolved | resolved | resolved | resolved | resolved | failed |  |
| `crc-sp:SP-10` | crc-sp | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-sp:SP-17` | crc-sp | 4-1 | failed | failed | resolved | failed | failed | failed |  |
| `crc-sp:SP-23` | crc-sp | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-sp:SP-33.1` | crc-sp | 4-1 | failed | failed | resolved | failed | failed | failed |  |
| `crc-sp:SP-35` | crc-sp | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-sp:SP-36.1` | crc-sp | 4-1 | resolved | resolved | failed | resolved | resolved | resolved |  |
| `crc-sp:SP-36.2` | crc-sp | 4-1 | resolved | resolved | failed | resolved | resolved | resolved |  |
| `crc-sp:SP-36.4` | crc-sp | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-sp:SP-37` | crc-sp | 4-1 | failed | failed | failed | failed | failed | resolved |  |
| `crc-sp:SP-45.2` | crc-sp | 4-1 | failed | resolved | failed | failed | failed | failed |  |
| `crc-sp:SP-46` | crc-sp | 4-1 | failed | failed | failed | failed | resolved | failed |  |
| `crc-sp:SP-50` | crc-sp | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-tpw:TPW-10` | crc-tpw | 4-1 | failed | failed | failed | not-applicable | failed | failed |  |
| `crc-tpw:TPW-12.2` | crc-tpw | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-tpw:TPW-14` | crc-tpw | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-tpw:TPW-16` | crc-tpw | 4-1 | failed | failed | failed | resolved | failed | failed |  |
| `crc-tpw:TPW-20` | crc-tpw | 4-1 | failed | resolved | failed | failed | failed | failed |  |
| `crc-wq:WQ-1` | crc-wq | 4-1 | resolved | resolved | resolved | resolved | failed | resolved |  |
| `crc-wq:WQ-2` | crc-wq | 4-1 | resolved | resolved | failed | resolved | resolved | resolved |  |
| `crc-de:DE-33` | crc-de | 3-1 | failed | failed | failed | MISSING | resolved | failed | YES |
| `crc-aw-redlines:AW-RL-8` | crc-aw-redlines | 3-2 | failed | failed | failed | resolved | failed | resolved |  |
| `crc-awrr:AWRR-2.2` | crc-awrr | 3-2 | failed | resolved | failed | failed | failed | resolved |  |
| `crc-de:DE-1` | crc-de | 3-2 | failed | failed | failed | not-applicable | failed | not-applicable |  |
| `crc-de:DE-17` | crc-de | 3-2 | failed | failed | resolved | resolved | failed | failed |  |
| `crc-de:DE-22` | crc-de | 3-2 | resolved | failed | failed | resolved | resolved | resolved |  |
| `crc-de:DE-23` | crc-de | 3-2 | failed | resolved | failed | resolved | failed | failed |  |
| `crc-de:DE-32` | crc-de | 3-2 | failed | resolved | resolved | failed | failed | failed |  |
| `crc-de:DE-6` | crc-de | 3-2 | failed | resolved | failed | failed | resolved | failed |  |
| `crc-ev:EV-07` | crc-ev | 3-2 | resolved | resolved | resolved | failed | failed | resolved |  |
| `crc-ev:EV-12` | crc-ev | 3-2 | failed | failed | failed | resolved | failed | resolved |  |
| `crc-ev:EV-14` | crc-ev | 3-2 | failed | failed | failed | resolved | failed | resolved |  |
| `crc-f:F-1.1` | crc-f | 3-2 | not-applicable | failed | not-applicable | not-applicable | failed | not-applicable |  |
| `crc-f:F-4` | crc-f | 3-2 | resolved | failed | resolved | failed | resolved | resolved |  |
| `crc-pr:PR-4` | crc-pr | 3-2 | resolved | resolved | failed | resolved | resolved | failed |  |
| `crc-sp:SP-12` | crc-sp | 3-2 | resolved | resolved | resolved | resolved | failed | failed |  |
| `crc-sp:SP-13` | crc-sp | 3-2 | failed | failed | resolved | failed | resolved | failed |  |
| `crc-sp:SP-21` | crc-sp | 3-2 | failed | failed | failed | resolved | resolved | failed |  |
| `crc-sp:SP-29` | crc-sp | 3-2 | not-applicable | not-applicable | not-applicable | not-applicable | failed | failed |  |
| `crc-sp:SP-36.3` | crc-sp | 3-2 | failed | failed | failed | failed | resolved | resolved |  |
| `crc-sp:SP-4` | crc-sp | 3-2 | failed | failed | failed | failed | resolved | resolved |  |
| `crc-sp:SP-41` | crc-sp | 3-2 | failed | resolved | failed | failed | failed | resolved |  |
| `crc-sp:SP-43` | crc-sp | 3-2 | failed | failed | resolved | failed | resolved | failed |  |
| `crc-sp:SP-45.1` | crc-sp | 3-2 | resolved | resolved | failed | resolved | failed | resolved |  |
| `crc-sp:SP-47` | crc-sp | 3-2 | failed | resolved | resolved | failed | failed | failed |  |
| `crc-sp:SP-48` | crc-sp | 3-2 | failed | resolved | failed | resolved | failed | failed |  |
| `crc-tpw:TPW-11` | crc-tpw | 3-2 | not-applicable | failed | failed | not-applicable | not-applicable | not-applicable |  |
| `crc-tpw:TPW-6` | crc-tpw | 3-2 | not-applicable | failed | failed | not-applicable | not-applicable | not-applicable |  |
| `crc-tpw:TPW-7` | crc-tpw | 3-2 | not-applicable | failed | failed | not-applicable | not-applicable | not-applicable |  |
| `crc-tpw:TPW-8` | crc-tpw | 3-2 | not-applicable | failed | failed | not-applicable | not-applicable | not-applicable |  |
| `crc-tpw:TPW-9` | crc-tpw | 3-2 | not-applicable | failed | failed | not-applicable | not-applicable | not-applicable |  |
| `crc-wq:WQ-8` | crc-wq | 3-2 | resolved | failed | failed | resolved | resolved | resolved |  |
| `crc-wq:WQ-9` | crc-wq | 3-2 | resolved | resolved | failed | resolved | failed | resolved |  |

### Split-type breakdown (non-unanimous items only)

| Split | Count |
|---|---:|
| 4-1 | 55 |
| 3-1 | 1 |
| 3-2 | 32 |

- **3-2 splits** are the noisiest possible bare-majority outcome — flipping one vote flips the consolidated answer. These 32 items should be considered *low-confidence consolidations* even though many are not flagged as such by the per-item `confidence` field.
- **3-1** is the lone DE-33 coverage-gap case: 3 failed vs 1 resolved among the 4 runs that voted (run-3 dropped the item). If run-3 had voted resolved, this would have flipped to 2-2 and become genuinely tied.
- **No three-way splits** (2-2-1, 3-1-1) observed — when the model disagrees, it's always binary between two statuses, never a three-way `failed` vs `resolved` vs `not-applicable` argument.

## Coverage-gap analysis

**8 of 234 items had `runCount < 5`** (excluding the runCount=6 duplicate item crc-ca:CA-22):

| ref | dept | runs present | missing | notes |
|---|---|---|---|---|
| `crc-de:DE-33` | crc-de | run-1, run-2, run-4, run-5 | run-3 | runCount=4 |
| `crc-ca:CA-16.1` | crc-ca | run-5 | run-1, run-2, run-3, run-4 | runCount=1 |
| `crc-ca:CA-17.1` | crc-ca | run-5 | run-1, run-2, run-3, run-4 | runCount=1 |
| `crc-ca:CA-18.1` | crc-ca | run-5 | run-1, run-2, run-3, run-4 | runCount=1 |
| `crc-ca:CA-19.1` | crc-ca | run-5 | run-1, run-2, run-3, run-4 | runCount=1 |
| `crc-ca:CA-20.1` | crc-ca | run-5 | run-1, run-2, run-3, run-4 | runCount=1 |
| `crc-ca:CA-21.1` | crc-ca | run-5 | run-1, run-2, run-3, run-4 | runCount=1 |
| `crc-ca:CA-22.1` | crc-ca | run-5 | run-1, run-2, run-3, run-4 | runCount=1 |

**Per-run findings.length** (sum of `findings[]` across all dept files per run):

| Run | Items returned | Drift vs union (234) |
|---|---:|---:|
| run-1 | 227 | -7 |
| run-2 | 223 | -11 |
| run-3 | 224 | -10 |
| run-4 | 223 | -11 |
| run-5 | 234 | 0 |

Observations:

- 7 of 8 gap items (`CA-16.1`..`CA-22.1`) are sub-numbered items that **only run-5 produced**. These appear to be checklist-item subdivisions (`.1` suffix) that the other 4 runs either did not generate or whose generation was dropped. This is consistent with the structured-output retry storm Agent 1 is investigating — when a run's structured-output retry recovers, it may emit a different (less-subdivided) checklist shape for `crc-ca`.
- The 8th gap item, `crc-de:DE-33`, is missing only in run-3 — a different mode of drop. Run-3 also has the lowest item count after run-2/run-4 — see Agent 1.
- `crc-ca:CA-22` is the only item with `runCount > totalRuns` — run-2 emitted the same item twice (both `failed`). The consolidation treated each emission as an independent vote, which slightly biases the majority but did not change the consolidated outcome (5-0 failed regardless). Worth fixing in the consolidation step.
- **Coverage gaps are NOT counted as variance in the per-item TSV** (per spec). They are tracked separately above.

## Per-department variance summary

| Department | Total items | Non-unanimous | % non-unanimous | Coverage-gap items |
|---|---:|---:|---:|---:|
| crc-owb | 1 | 1 | 100.0% | 0 |
| crc-ev | 19 | 13 | 68.4% | 0 |
| crc-de | 34 | 20 | 58.8% | 1 |
| crc-awrr | 4 | 2 | 50.0% | 0 |
| crc-iw | 2 | 1 | 50.0% | 0 |
| crc-pb | 2 | 1 | 50.0% | 0 |
| crc-tpw | 21 | 10 | 47.6% | 0 |
| crc-f | 9 | 4 | 44.4% | 0 |
| crc-aw | 5 | 2 | 40.0% | 0 |
| crc-sp | 63 | 23 | 36.5% | 0 |
| crc-pr | 7 | 2 | 28.6% | 0 |
| crc-wq | 17 | 4 | 23.5% | 0 |
| crc-aw-redlines | 10 | 2 | 20.0% | 0 |
| crc-ca | 34 | 3 | 8.8% | 7 |
| crc-cm | 5 | 0 | 0.0% | 0 |
| crc-lde | 1 | 0 | 0.0% | 0 |

**Noisiest departments** (highest fraction of non-unanimous items):

- `crc-ev`: 13/19 non-unanimous (68.4%)
- `crc-de`: 20/34 non-unanimous (58.8%)
- `crc-tpw`: 10/21 non-unanimous (47.6%)
- `crc-f`: 4/9 non-unanimous (44.4%)
- `crc-aw`: 2/5 non-unanimous (40.0%)

Small-department callout: `crc-iw` (2 items, 1 non-unanimous = 50%), `crc-pb` (2 items, 1 non-unanimous = 50%), `crc-owb` (1 item, 1 non-unanimous = 100%), `crc-awrr` (4 items, 2 non-unanimous = 50%). These are statistical noise given the tiny denominators, but they indicate the model is genuinely uncertain on a meaningful fraction of these departments' items.

## Historical comparison (EXCLUDED — gen mismatch)

Two prior CRC reviews exist for the same submission version `6b9b85ed-…` (Lamar + Collier v4):

| Review ID | Date | crcGenerationNumber | runs | Status |
|---|---|---:|---:|---|
| `a8d07d22-19e6-4a1f-a12d-a4371c1dbd19` | 2026-06-25 | 2 | 5 | **INCLUDED (current)** |
| `3703349c-ac08-44b8-8c10-2100adb89f5b` | 2026-06-23 | 1 | 3 | EXCLUDED — gen mismatch |
| `7e79e197-8922-4c18-8a94-bc6d43218362` | 2026-06-19 | 1 | ? | EXCLUDED — gen mismatch |

**Decision**: do NOT include the priors in the cross-review tally. Both priors used `crcGenerationNumber = 1` while the current review uses `crcGenerationNumber = 2`. Checklist items may have been regenerated, renumbered, or restructured between generations — comparing item-level statuses across gens risks false-positive 'flip' signals that are really just item-set differences.

**Caveat / future work**:

- Item `ref` strings (e.g. `crc-aw-redlines:AW-RL-1`) may actually be stable across gens for matched comments — the gen number controls the guide generation pass, not necessarily the comment IDs. A future audit could programmatically check `ref` overlap between gen=1 and gen=2 outputs; the set of matched refs would be safe to compare, while the unmatched refs would be the genuine gap.
- The sub-items `CA-16.1`..`CA-22.1` only present in run-5 of the current run suggest that even **within the same gen** the checklist subdivision can drift between runs. Cross-gen comparison would compound this.
- **Recommendation**: re-run one of the priors at `crcGenerationNumber = 2` (or migrate the current consolidation step to produce a stable item-key independent of gen) before doing a true cross-review variance tally.

- The `running-variance-all-runs.tsv` therefore contains **only the 234 current-run rows**, with header-comment lines documenting the two excluded priors.

## Data sources & limitations

**Sources** (read-only, from RUN_DIR):

- `output/consolidated-findings.json` — primary input (234 items, each with `perRunFindings[]`).
- `output/runs/run-{1..5}/findings/*.md.json` — cross-checked via `findings.length` sums (227/223/224/223/234, matches handoff).

**Limitations / caveats**:

- Per-run drift (227..234) means raw vote counts include implicit `MISSING` for ~3-5% of (item × run) cells. We treat those as coverage gaps, not as a third 'I don't know' status. This is a conservative choice — an alternative reading is that a 'silent' run is implicitly a tie-breaker for the rest.
- The 7 run-5-only items (CA-16.1..CA-22.1) are unanimous by definition (single voter), so they are **not** counted as high-variance, but their consolidated status is supported by only **one** run. We tag them with `is_high_variance=FALSE` but `run_count=1`. Recommend manual review.
- `crc-ca:CA-22` had a duplicate emission in run-2 (consolidation treated as 6 votes). Effect on this item is nil (5-0 failed); flag for fixing in the consolidation script.
- No reasoning-level / explanation-level variance analysis was performed — only status-level. Two runs might both say 'failed' but disagree about *why*. Out of scope for this agent.
- Historical comparison was disabled by the gen-mismatch decision; the `running-variance-all-runs.tsv` is functionally a duplicate of the current-run rows.
