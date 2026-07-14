# CRC Audit — Agent 2: Majority-Vote Variance (Current Run + Running Tally)

**Review**: `bfb4f256-27a2-4adc-8443-b942e3b4aa79` (created 2026-07-13 23:22 UTC)
**Submission version**: `6b9b85ed-e992-4906-a222-b24ee836910c` · CRC guides gen 6 · calibration-test run
**Config**: 3 runs × 17 consolidated departments (24 split guide files) · 294 consolidated items

Companion TSVs:
- `crc-audit-agent-2-current-run-votes.tsv` — per-item votes, splits, high-variance flags (this run)
- `crc-audit-agent-2-running-variance-all-runs.tsv` — per-item status across the three gen-6 reviews (880 rows)

---

## Executive summary

- **294 items, 3 votes each (nominally).** 181 items (62%) were unanimous 3-0. **95 items (32%) had genuine status disagreement** — 93 clean 2-1 splits plus 2 disagreements corrupted by duplicate votes. 11 items had **coverage gaps** (fewer than 3 votes) and 9 items received **4 votes** instead of 3 — every one of those 20 anomalies is in **crc-CA**, caused by a rogue run-3 `crc-CA-1` worker (details below).
- The status vocabulary observed in per-run votes is binary: `failed` / `resolved`. Consolidated statuses add `uncertain` (3 items — all single-vote ID-fragmentation phantoms, not tie-breaks). `not-applicable` and `missing` exist in the vote-breakdown schema but received zero votes.
- **One item's majority was decided by a duplicated vote**: `CA-19.1` truly voted 2 resolved (run-1, run-2) vs 1 failed (run-3), but run-3's vote was counted twice (2-2), and the consolidator broke the tie to **failed**. The honest majority is *resolved*. This is a consolidation-integrity bug, not model noise.
- **Historical comparison ran successfully** against the two prior gen-6 reviews (`d1ff47e7` 2026-06-30, 5 runs/item; `47eca23e` 2026-07-09, 5 runs/item). **101 of 297 union items (34%) flipped consolidated status across the three reviews**, including **41 hard failed↔resolved flips**. 25 items had internal vote disagreement in *all three* reviews.
- **Item-count drift (291 vs 295 vs 294) is fully explained by checklist-ID fragmentation** — no cells were dropped. 291 canonical items appear in all three reviews; the extras are agent-invented sub-IDs (`CA-17.1`, `CA-21.1`, `CA-22.1`, `SP-20.1`, `SP-25.1`, `TPW-6.1`) that duplicate canonical items (`CA-17`, `CA-21`, `CA-22`, …) which are *also* present.
- Noisiest departments this run: **crc-AW (80% of items split), crc-DE (72%), crc-SP (41% split, 26 items)**. crc-aw-redlines, crc-LDE, crc-RW were perfectly unanimous.

---

## 1. Current-run variance

### Vote-split census (294 items)

| Split | Count | Interpretation |
|---|---|---|
| 3-0 unanimous | 181 | Zero variance |
| 2-1 split | 93 | Status disagreement (high variance) |
| 2-0 (coverage gap) | 8 | Only 2 votes — run-2 never voted (crc-CA) |
| 1-0 (coverage gap) | 3 | Only 1 vote — phantom fragmented IDs, run-3 only (crc-CA) |
| 4-0 (dup votes) | 7 | 4 unanimous votes from 3 runs (crc-CA) |
| 3-1 (dup votes) | 1 | `CA-16.1` — run-3 voted twice, disagreeing with itself |
| 2-2 (dup votes) | 1 | `CA-19.1` — duplicate run-3 vote manufactured a tie |

High-variance (non-unanimous status) total: **95 items** (93 × 2-1, plus CA-16.1 and CA-19.1). Coverage gaps are counted separately per the audit definition — they are missing votes, not disagreements.

### The crc-CA anomaly cluster (all 20 non-clean-vote items)

Verified against raw per-run findings in `RUN_DIR/output/runs/run-{1,2,3}/findings/crc-CA-{1,2,3}.md.json`:

1. **run-2 `crc-CA-1` under-delivered**: emitted only CA-01.x–CA-05.x (12 items), silently dropping CA-06.1–CA-09.2 (8 items) → the eight 2-0 coverage gaps.
2. **run-3 `crc-CA-1` went out of scope**: emitted 32 items, including 9 items belonging to `crc-CA-2`'s range (CA-10.x, CA-16.1, CA-18.2/3, CA-19.1, CA-20.1/2) → those items got 4 votes (run-3 counted twice, once from each file).
3. **run-3 `crc-CA-1` fragmented IDs**: invented `CA-17.1`, `CA-21.1`, `CA-22.1` (guides define `CA-17`, `CA-21`/`CA-21.x`?, `CA-22`). These landed as *new single-vote items* which the consolidator marked `uncertain` — the entire explanation for the DB's "3 uncertain".

**Integrity consequences:**
- **`CA-19.1` majority is wrong.** True votes: run-1 resolved, run-2 resolved, run-3 failed. Recorded: 2-2 → consolidated **failed**. A duplicate vote from one run overrode the two-run majority (source: `output/consolidated-findings.json`, ref `crc-CA:CA-19.1`).
- **`CA-16.1`** run-3 voted both failed (via crc-CA-1) and resolved (via crc-CA-2); majority failed either way, but one run contributed contradictory votes.
- The 3 `uncertain` phantoms double-report requirements already covered by their canonical items (e.g., `CA-17` consolidated *resolved* 2-1 while phantom `CA-17.1` reports *failed* on one vote).

### All 95 high-variance items (current run)

Full detail in the current-run TSV (high-variance rows sorted first). Split votes by department:

| Dept | Items | Split | Split % |
|---|---|---|---|
| crc-AW | 5 | 4 | 80% |
| crc-DE | 39 | 28 | 72% |
| crc-PB | 2 | 1 | 50% |
| crc-PR | 6 | 3 | 50% |
| crc-SP | 63 | 26 | 41% |
| crc-WQ | 20 | 8 | 40% |
| crc-IW | 3 | 1 | 33% |
| crc-CM | 7 | 2 | 29% |
| crc-EV | 29 | 8 | 28% |
| crc-OWB | 5 | 1 | 20% |
| crc-CA | 45 | 7 | 16% |
| crc-TPW | 37 | 4 | 11% |
| crc-AWRR | 10 | 1 | 10% |
| crc-F | 11 | 1 | 9% |
| crc-LDE / crc-RW / crc-aw-redlines | 1 / 1 / 10 | 0 | 0% |

Notable single items: `AW-1.1` (2 failed / 1 resolved — and the two *failed* votes contradict each other factually: run-1 says the sheets ARE portrait and exceed 8 details; run-2 says they are LANDSCAPE and fail for not being portrait; run-3 says landscape → vacuously resolved. Three mutually exclusive readings of the same three sheets). This item has been unstable in every gen-6 review (see §2).

Since every vote in this calibration run is binary failed/resolved, no `1-1-1` (all-different) splits are possible; maximum observed disagreement is 2-1.

## 2. Running / persistent variance vs prior gen-6 reviews

Compared reviews (same submission version, same gen-6 guides):

| Review | Created | Runs/item | Items | Consolidated: failed / resolved / uncertain | Internally split items |
|---|---|---|---|---|---|
| `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e` | 2026-06-30 22:31 | 5 | 291 | 230 / 35 / 26 | 65 (22%) |
| `47eca23e-a010-4f87-ac3b-1cf6f4c481ae` ("block-ids-run-1") | 2026-07-09 18:10 | 5 | 295 | 190 / 37 / 68 | 134 (45%) |
| `bfb4f256` (current) | 2026-07-13 23:22 | 3 | 294 | 235 / 56 / 3 | 95 (32%) |

Caveats when comparing split rates: priors ran 5 votes/item (more chances to split than 3), and the priors' consolidator used `uncertain` for close votes while the current run resolves 2-1 to the majority — so "uncertain" counts are not comparable across reviews (3 vs 26 vs 68 reflects policy + run-count, not only model behavior).

### Cross-review flips

- **101 of 297 union items flipped consolidated status at least once across the three reviews** (list in `history_analysis` / running TSV).
- **41 items flipped hard between failed and resolved** — the worst kind for a calibration run. Examples: `AW-1.1` (resolved → uncertain → failed), `CM-11` (resolved → resolved → failed), `DE-30` (resolved → uncertain → failed; known junction-box conflation item), `WQ-3.1`/`WQ-3.2` (failed → failed → resolved), `SP-13` (failed → resolved → resolved).
- Flip volume by department: SP 28, DE 26, EV 13, WQ 11, TPW 7, AW 5, CA 3, CM 3, F 3, IW 2.

### Chronically unstable items (ranked)

**Tier 1 — internal vote disagreement in all 3 reviews AND consolidated-status flip (22 items):**
`AW-1.4`, `AW-2`, `CA-16.1`, `CA-17`, `CM-8`, `DE-13`, `DE-17`, `DE-23`, `DE-24`, `DE-25`, `DE-26`, `DE-27.2`, `EV-15`, `F-7`, `SP-23.2`, `SP-36.1`, `SP-36.4`, `SP-48`, `TPW-17.1`, `WQ-1`, `WQ-8.1`, `WQ-9`

**Tier 2 — disagreement in all 3 reviews, majority happened to hold (3 items):** `CA-16.2`, `PB-1`, `SP-17.1`

**Tier 3 — disagreement in ≥2 of 3 reviews: 93 items total** (Tiers 1–2 included). The DE department dominates: `DE-4`, `DE-8.1`, `DE-9`, `DE-20.1`, `DE-21`, `DE-22`, `DE-27.1`, `DE-28.1`, `DE-28.2`, `DE-30`, `DE-31`, `DE-32` etc. all show repeated instability.

These ~25 Tier-1/2 items are coin-flips under the current prompt+guide: 13 votes cast across three reviews frequently land near 50/50 (e.g. `AW-2`: `ffffr` → `rrrfr` → `rfr`). For a calibration test they should be treated as items whose requirement wording or evidence expectation is ambiguous, not as model regressions in any single run.

### Item-count drift explained (291 vs 295 vs 294)

No dropped cells. The union across the three reviews is 297 distinct checklist IDs; **291 canonical items appear in all three**. The drift is entirely **checklist-ID fragmentation** — workers occasionally emitting an invented `.1` sub-ID alongside/instead of the canonical ID:

| Review | Items | Phantom/extra IDs present |
|---|---|---|
| d1ff47e7 (291) | canonical set only | none |
| 47eca23e (295) | +4 | `SP-20.1`, `SP-25.1`, `TPW-6.1`, `CA-22.1` |
| bfb4f256 (294) | +3 | `CA-17.1`, `CA-21.1`, `CA-22.1` (all from the rogue run-3 crc-CA-1 worker) |

In every case the canonical parent (`CA-17`, `CA-22`, …) is also present in the same review, so fragments are duplicate rows, not renames. This matches the known CRC ID-fragmentation failure signature (cf. the CC 07-07 audit).

---

## 3. Data sources & limitations

- **Current-run votes**: `RUN_DIR/output/consolidated-findings.json` (`/private/tmp/claude-501/-Users-wnavey-noetic/3dd9eaba-e797-4c82-9486-85ad204c523c/scratchpad/crc-run-bfb4f256/output/consolidated-findings.json`), cross-checked against raw per-run files `output/runs/run-{1,2,3}/findings/*.md.json` for the crc-CA anomalies.
- **Historical votes**: Supabase `review_comments.output_json` (project `mgxqsrjutswbciyrltwd`) for the two prior reviews. **Better than expected**: `output_json.sourceFindings[0].perRunFindings` preserves full per-run votes for the priors too, so the running TSV carries real historical vote splits (5 votes/item), not just final statuses. Items matched across reviews by bare `atomicItemId` (grouping/file casing varies per generation).
- **Excluded history**: four other CRC reviews of this submission version (`7e79e197…`, `3703349c…`, `a8d07d22…`, `1b2f8fa5…`) used gen-1/2/5 guides and are **not comparable item-for-item**; they are excluded per the orchestrator's guide-compatibility decision and do not appear in the running TSV.
- Run-count asymmetry (5 vs 5 vs 3 runs/item) and the changed uncertain-tie policy limit direct comparison of split *rates* across reviews; flip analysis (consolidated status) is unaffected.
- DB metadata "235 failed / 56 resolved / 3 uncertain" reconciles exactly with `consolidated-findings.json`.
- This report deliberately excludes tool-usage and performance analysis (other audit agents' lanes).
