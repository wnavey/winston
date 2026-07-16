# CRC Audit — Agent 2: Majority-Vote Variance (v5 Game Day Run 1)

**Review**: `ed5e7ba9-ba03-4000-abb4-1021ebec0631` (runLabel `2026-07-14-v5-crc-game-day-run-1`, created 2026-07-14 18:38 UTC)
**Submission version**: `4cfe4c36-c14e-4f5f-8b71-27c6fe3ed677` (v5 resubmission — a **real review run**, not calibration)
**Guides**: crcGuidesSubmissionVersionId `6b9b85ed-e992-4906-a222-b24ee836910c` (u0 = v4), generation 6
**Config**: 5 runs × 24 department guide files → 17 consolidated departments · 291 consolidated checklist items

Companion TSVs:
- `crc-audit-agent-2-current-run-votes.tsv` — per-item run-1…run-5 votes, split, majority, high-variance flag (291 rows, high-variance first)
- `crc-audit-agent-2-running-variance-all-runs.tsv` — per-item status for this review plus the v4 run-4 calibration baseline (582 rows; every one of the 291 items mapped to a baseline row)

---

## Executive summary

- **291 items, 5 votes each — a structurally clean run.** Every item received exactly 5/5 votes. **Zero coverage gaps, zero duplicate votes, zero ID-fragmentation phantoms** — a marked contrast to the v4 run-4 baseline, whose crc-CA worker anomaly produced 20 corrupted-vote items.
- **202 items (69.4%) were unanimous 5-0; 89 items (30.6%) split.** Splits: 40 × 4-1 and 49 × 3-2. There were no all-different or three-way splits — the observed per-run vote vocabulary is strictly binary (`failed` / `resolved`; `not-applicable` and `missing` exist in the voteBreakdown schema but received zero votes across all 1,455 votes).
- **The 49 consolidated `uncertain` items are exactly the 49 items that split 3-2** — the uncertainThreshold (0.35) fires on a 2/5 = 0.40 minority and nothing else. All 40 × 4-1 items (minority 0.20 < 0.35) kept their majority verdict at `medium` confidence; all 202 unanimous items got `high` confidence. Consolidated tallies: 166 failed / 76 resolved / 49 uncertain.
- **Dissent is spread evenly across runs — no rogue run.** Minority votes by run: run-1 28, run-2 34, run-3 32, run-4 18, run-5 26. Among 4-1 lone dissents: 6/8/12/7/7.
- **Agreement improved over the v4 baseline despite a harder bar.** Mean pairwise vote agreement: **0.844 (v5, 5 runs)** vs **0.744 (v4 baseline, 3 runs)**; unanimity rate 69.4% (5-0) vs 61.6% (3-0), even though 5-way unanimity is strictly harder to achieve.
- **38 items are chronically unstable** (split in both v5 and the v4 baseline); 22 of them are among today's 49 uncertain items. crc-DE contributes the most chronic items (10).
- Noisiest departments by split rate: **crc-AW (3/5, 60%)**, crc-PB (1/2), **crc-CA (18/42, 43%)**, crc-CM (3/7, 43%), **crc-DE (16/39, 41%)**. Perfectly unanimous: crc-LDE, crc-OWB, crc-PR, crc-RW.

---

## 1. Current-run vote-split census

| Split | Count | Share | Consolidated outcome |
|---|---|---|---|
| 5-0 unanimous | 202 | 69.4% | 143 failed, 59 resolved — all `high` confidence |
| 4-1 | 40 | 13.7% | 23 failed, 17 resolved — all `medium` confidence |
| 3-2 | 49 | 16.8% | all 49 → `uncertain` (`medium` confidence) |
| Coverage gap (<5 votes) | 0 | — | none |
| Duplicate/extra votes | 0 | — | none |

Maximum-disagreement ranking: 3-2 splits (49 items) > 4-1 splits (40 items) > unanimous (202). No item reached a more-fragmented state than 3-2 (impossible under a binary vote vocabulary).

### All 89 non-unanimous items

3-2 splits first (maximum variance), then 4-1. Votes listed run-1 → run-5.

| Department | Item | Split | Majority | Votes (r1…r5) |
|---|---|---|---|---|
| crc-AW | AW-1.1 | 3-2 | uncertain | resolved,resolved,failed,resolved,failed |
| crc-AW | AW-1.4 | 3-2 | uncertain | failed,resolved,failed,resolved,failed |
| crc-aw-redlines | AW-RL-4 | 3-2 | uncertain | resolved,failed,failed,resolved,resolved |
| crc-aw-redlines | AW-RL-5 | 3-2 | uncertain | resolved,failed,failed,resolved,resolved |
| crc-CA | CA-06.2 | 3-2 | uncertain | resolved,failed,resolved,resolved,failed |
| crc-CA | CA-07.1 | 3-2 | uncertain | failed,failed,resolved,resolved,resolved |
| crc-CA | CA-13.1 | 3-2 | uncertain | resolved,failed,failed,resolved,resolved |
| crc-CA | CA-17 | 3-2 | uncertain | resolved,failed,failed,resolved,failed |
| crc-CA | CA-18.1 | 3-2 | uncertain | resolved,failed,resolved,resolved,failed |
| crc-CA | CA-18.3 | 3-2 | uncertain | failed,resolved,resolved,resolved,failed |
| crc-CA | CA-19.2 | 3-2 | uncertain | resolved,resolved,failed,resolved,failed |
| crc-CM | CM-8 | 3-2 | uncertain | failed,failed,resolved,resolved,resolved |
| crc-DE | DE-0 | 3-2 | uncertain | failed,resolved,failed,failed,resolved |
| crc-DE | DE-14.1 | 3-2 | uncertain | resolved,resolved,failed,failed,resolved |
| crc-DE | DE-14.2 | 3-2 | uncertain | resolved,resolved,failed,failed,failed |
| crc-DE | DE-16 | 3-2 | uncertain | failed,resolved,failed,failed,resolved |
| crc-DE | DE-23 | 3-2 | uncertain | failed,failed,resolved,resolved,failed |
| crc-DE | DE-24 | 3-2 | uncertain | resolved,failed,resolved,failed,resolved |
| crc-DE | DE-26 | 3-2 | uncertain | resolved,resolved,failed,failed,failed |
| crc-DE | DE-27.2 | 3-2 | uncertain | failed,resolved,resolved,failed,failed |
| crc-DE | DE-31 | 3-2 | uncertain | resolved,failed,failed,resolved,failed |
| crc-EV | EV-05.4 | 3-2 | uncertain | failed,resolved,resolved,resolved,failed |
| crc-EV | EV-08.2 | 3-2 | uncertain | resolved,resolved,failed,resolved,failed |
| crc-F | F-4 | 3-2 | uncertain | failed,failed,resolved,resolved,failed |
| crc-F | F-7 | 3-2 | uncertain | resolved,failed,failed,failed,resolved |
| crc-PB | PB-1 | 3-2 | uncertain | resolved,resolved,failed,failed,failed |
| crc-SP | SP-1 | 3-2 | uncertain | failed,failed,resolved,resolved,resolved |
| crc-SP | SP-11.2 | 3-2 | uncertain | failed,resolved,resolved,resolved,failed |
| crc-SP | SP-26.3 | 3-2 | uncertain | resolved,resolved,failed,resolved,failed |
| crc-SP | SP-30.2 | 3-2 | uncertain | resolved,failed,resolved,resolved,failed |
| crc-SP | SP-30.3 | 3-2 | uncertain | resolved,resolved,failed,resolved,failed |
| crc-SP | SP-31.2 | 3-2 | uncertain | failed,failed,failed,resolved,resolved |
| crc-SP | SP-32.2 | 3-2 | uncertain | resolved,resolved,failed,failed,failed |
| crc-SP | SP-36.1 | 3-2 | uncertain | failed,failed,resolved,failed,resolved |
| crc-SP | SP-36.2 | 3-2 | uncertain | resolved,resolved,failed,resolved,failed |
| crc-SP | SP-36.3 | 3-2 | uncertain | resolved,resolved,failed,failed,failed |
| crc-SP | SP-36.4 | 3-2 | uncertain | resolved,failed,resolved,resolved,failed |
| crc-SP | SP-48 | 3-2 | uncertain | resolved,failed,resolved,failed,failed |
| crc-SP | SP-6 | 3-2 | uncertain | resolved,failed,failed,failed,resolved |
| crc-TPW | TPW-11 | 3-2 | uncertain | resolved,failed,failed,resolved,resolved |
| crc-TPW | TPW-12.4 | 3-2 | uncertain | failed,resolved,failed,resolved,resolved |
| crc-TPW | TPW-15.1 | 3-2 | uncertain | failed,resolved,failed,resolved,resolved |
| crc-TPW | TPW-17.1 | 3-2 | uncertain | failed,resolved,failed,resolved,resolved |
| crc-TPW | TPW-17.2 | 3-2 | uncertain | failed,resolved,failed,resolved,failed |
| crc-TPW | TPW-17.3 | 3-2 | uncertain | failed,resolved,failed,resolved,failed |
| crc-TPW | TPW-20.3 | 3-2 | uncertain | failed,failed,resolved,resolved,resolved |
| crc-TPW | TPW-8 | 3-2 | uncertain | failed,failed,resolved,resolved,resolved |
| crc-WQ | WQ-8.1 | 3-2 | uncertain | failed,resolved,resolved,failed,resolved |
| crc-WQ | WQ-8.2 | 3-2 | uncertain | resolved,failed,failed,resolved,resolved |
| crc-AW | AW-1.2 | 4-1 | resolved | failed,resolved,resolved,resolved,resolved |
| crc-AWRR | AWRR-2.1 | 4-1 | failed | failed,resolved,failed,failed,failed |
| crc-AWRR | AWRR-2.2 | 4-1 | failed | failed,failed,failed,resolved,failed |
| crc-CA | CA-02.1 | 4-1 | failed | failed,failed,resolved,failed,failed |
| crc-CA | CA-02.2 | 4-1 | resolved | resolved,failed,resolved,resolved,resolved |
| crc-CA | CA-04.1 | 4-1 | resolved | resolved,resolved,resolved,failed,resolved |
| crc-CA | CA-05.1 | 4-1 | failed | failed,failed,resolved,failed,failed |
| crc-CA | CA-06.1 | 4-1 | failed | failed,failed,resolved,failed,failed |
| crc-CA | CA-07.2 | 4-1 | failed | failed,failed,resolved,failed,failed |
| crc-CA | CA-08 | 4-1 | failed | failed,failed,resolved,failed,failed |
| crc-CA | CA-11 | 4-1 | failed | failed,failed,failed,resolved,failed |
| crc-CA | CA-13.2 | 4-1 | resolved | resolved,failed,resolved,resolved,resolved |
| crc-CA | CA-18.2 | 4-1 | failed | failed,resolved,failed,failed,failed |
| crc-CA | CA-20.3 | 4-1 | resolved | resolved,resolved,failed,resolved,resolved |
| crc-CM | CM-11 | 4-1 | resolved | resolved,resolved,failed,resolved,resolved |
| crc-CM | CM-13 | 4-1 | resolved | resolved,resolved,resolved,resolved,failed |
| crc-DE | DE-1 | 4-1 | failed | failed,failed,failed,failed,resolved |
| crc-DE | DE-12 | 4-1 | failed | failed,resolved,failed,failed,failed |
| crc-DE | DE-13 | 4-1 | failed | failed,resolved,failed,failed,failed |
| crc-DE | DE-17 | 4-1 | resolved | failed,resolved,resolved,resolved,resolved |
| crc-DE | DE-25 | 4-1 | failed | resolved,failed,failed,failed,failed |
| crc-DE | DE-28.2 | 4-1 | resolved | resolved,resolved,resolved,failed,resolved |
| crc-DE | DE-4 | 4-1 | resolved | failed,resolved,resolved,resolved,resolved |
| crc-EV | EV-05.2 | 4-1 | failed | failed,failed,resolved,failed,failed |
| crc-EV | EV-06.6 | 4-1 | failed | failed,failed,failed,failed,resolved |
| crc-F | F-2.2 | 4-1 | resolved | resolved,failed,resolved,resolved,resolved |
| crc-F | F-2.3 | 4-1 | resolved | resolved,resolved,resolved,failed,resolved |
| crc-IW | IW-1.3 | 4-1 | resolved | failed,resolved,resolved,resolved,resolved |
| crc-SP | SP-23.2 | 4-1 | resolved | resolved,failed,resolved,resolved,resolved |
| crc-SP | SP-34 | 4-1 | failed | resolved,failed,failed,failed,failed |
| crc-SP | SP-41 | 4-1 | failed | failed,failed,resolved,failed,failed |
| crc-SP | SP-9 | 4-1 | failed | failed,failed,resolved,failed,failed |
| crc-TPW | TPW-12.2 | 4-1 | failed | failed,failed,failed,resolved,failed |
| crc-TPW | TPW-13.3 | 4-1 | failed | failed,failed,failed,resolved,failed |
| crc-TPW | TPW-13.4 | 4-1 | resolved | resolved,resolved,failed,resolved,resolved |
| crc-TPW | TPW-16 | 4-1 | resolved | resolved,resolved,resolved,resolved,failed |
| crc-TPW | TPW-9 | 4-1 | failed | failed,failed,failed,failed,resolved |
| crc-WQ | WQ-0 | 4-1 | failed | failed,failed,failed,failed,resolved |
| crc-WQ | WQ-14.1 | 4-1 | resolved | resolved,resolved,resolved,resolved,failed |
| crc-WQ | WQ-7 | 4-1 | failed | failed,failed,resolved,failed,failed |

---

## 2. The 49 `uncertain` items — what produced them

The consolidator's uncertainThreshold is 0.35 on the minority-vote fraction. With 5 binary votes there are only three possible minority fractions — 0 (5-0), 0.20 (4-1), 0.40 (3-2) — so the threshold cleanly bisects the splits: **`uncertain` ⇔ 3-2 split, exactly.** All 49 uncertain items are 3-2; no 4-1 or unanimous item was marked uncertain, and no 3-2 item escaped it. Each uncertain item carries a `tentativeStatus` equal to its 3-vote plurality:

- **29 lean `resolved` (3R-2F)** — a bare majority believes the comment was addressed in v5; two runs still see the deficiency. Example: AW-1.1 — three runs judged the portrait-orientation standard-drawing rule moot (all six v5 utility detail sheets are landscape), two runs instead applied the "utilize the entire sheet" prong to landscape sheets 34/39 and failed it. This is a genuine guide-interpretation ambiguity (does the portrait rule apply to landscape sheets?), not an evidence-retrieval difference — all five runs looked at the same sheets with vision.
- **20 lean `failed` (3F-2R)** — a bare majority still sees the deficiency.

Interpretation note for downstream consumers: uncertain-leaning-resolved items are where a human touch is most valuable — the system is one vote away from clearing the comment.

Department concentration of uncertain items: crc-SP 13, crc-DE 9, crc-TPW 8, crc-CA 7, crc-AW 2, crc-aw-redlines 2, crc-EV 2, crc-F 2, crc-WQ 2, crc-CM 1, crc-PB 1 (= 49; full per-department split counts in section 4).

---

## 3. Baseline comparison vs v4 run-4 calibration (`bfb4f256`)

**No true history exists**: this is the FIRST CRC review of submission version v5 (`4cfe4c36`) — there are zero prior CRC reviews of the same submission version, so the standard same-version historical comparison has no data. The comparison below uses the **v4 calibration run-4 audit as a baseline only**. Caveats:

- (a) The baseline reviewed **v4** (`6b9b85ed`), where every comment is expected to still be failed (calibration); v5 is a real resubmission where statuses legitimately differ. We compare **variance/agreement rates and chronic instability**, never verdict correctness.
- (b) Run counts differ: **5 runs (v5) vs 3 runs (v4)**. Unanimity is harder with 5 runs; pairwise agreement is the fairer metric.
- (c) Items align by bare checklistItemId (guides are identical gen-6). All 291 current items mapped to a baseline row. The baseline's 3 extra items (`CA-17.1`, `CA-21.1`, `CA-22.1`) were ID-fragmentation phantoms invented by a rogue run-3 crc-CA worker in that run — they do not exist in this run and were correctly not fabricated into the running-variance TSV.

### Agreement rates

| Metric | v5 game day (this run, 5 runs) | v4 run-4 baseline (3 runs) |
|---|---|---|
| Items | 291 | 294 (291 canonical + 3 phantoms) |
| Unanimous | 202 (69.4%) | 181 (61.6%) |
| Split (status disagreement) | 89 (30.6%) | 95 (32.3%) |
| Coverage gaps / duplicate votes | **0** | 20 (all crc-CA) |
| Mean pairwise vote agreement | **0.844** | 0.744 |

Headline: **vote agreement improved materially** — +10 points of pairwise agreement, and a higher unanimity rate despite unanimity being a stricter test at 5 runs. The v4 run's structural anomalies (missing votes, duplicated votes, phantom IDs) are entirely absent here.

### Chronically unstable items (split in BOTH runs) — 38 items

These items disagree across runs regardless of submission version, i.e., the instability is a property of the checklist item/guide, not of the plan revision:

`AW-1.1, AW-1.4, AWRR-2.2, CA-17, CA-18.1, CM-8, DE-1, DE-4, DE-12, DE-13, DE-16, DE-17, DE-23, DE-24, DE-25, DE-26, DE-27.2, DE-28.2, EV-05.2, EV-06.6, F-7, IW-1.3, PB-1, SP-1, SP-9, SP-23.2, SP-26.3, SP-31.2, SP-34, SP-36.1, SP-36.3, SP-36.4, SP-48, TPW-17.1, TPW-20.3, WQ-7, WQ-8.1, WQ-14.1`

- **crc-DE dominates with 12 chronic items** (DE-1, 4, 12, 13, 16, 17, 23, 24, 25, 26, 27.2, 28.2), followed by crc-SP with 10 (SP-1, 9, 23.2, 26.3, 31.2, 34, 36.1, 36.3, 36.4, 48). These are the strongest candidates for guide-clarity remediation (cf. the DE-30 junction-box conflation audit — DE items are known to be conflation-prone).
- 22 of the 38 chronic items are 3-2 in v5 and therefore among today's 49 uncertain — i.e., **45% of today's uncertain verdicts were predictable from the v4 baseline**.
- **Newly unstable in v5: 51 items** (unanimous in the v4 baseline, split now). Some of this is legitimate — v5 changed the plan set, moving items from clear-fail to genuinely borderline (e.g., partially-addressed comments). 27 of the 49 uncertain items fall in this bucket.
- **Stabilized: 57 items** were split in v4 but unanimous now — consistent with v5 fixes converting borderline items into clear resolved/failed verdicts, plus 5-run voting damping noise.

### Dissent distribution across runs (rogue-run check)

Minority-side votes per run: run-1 28, run-2 34, run-3 32, run-4 18, run-5 26 (lone dissents in 4-1 items: 6/8/12/7/7). No single run drives disagreement — unlike the v4 baseline, where one run's crc-CA worker misbehaved structurally.

---

## 4. Per-department variance summary

Sorted by split rate (non-unanimous items / total items):

| Department | Items | 5-0 | 4-1 | 3-2 (uncertain) | Split % | Minority votes |
|---|---|---|---|---|---|---|
| crc-AW | 5 | 2 | 1 | 2 | 60% | 5 |
| crc-PB | 2 | 1 | 0 | 1 | 50% | 2 |
| crc-CA | 42 | 24 | 11 | 7 | 43% | 25 |
| crc-CM | 7 | 4 | 2 | 1 | 43% | 4 |
| crc-DE | 39 | 23 | 7 | 9 | 41% | 25 |
| crc-F | 11 | 7 | 2 | 2 | 36% | 6 |
| crc-TPW | 37 | 24 | 5 | 8 | 35% | 21 |
| crc-IW | 3 | 2 | 1 | 0 | 33% | 1 |
| crc-SP | 63 | 46 | 4 | 13 | 27% | 30 |
| crc-WQ | 20 | 15 | 3 | 2 | 25% | 7 |
| crc-aw-redlines | 10 | 8 | 0 | 2 | 20% | 4 |
| crc-AWRR | 10 | 8 | 2 | 0 | 20% | 2 |
| crc-EV | 29 | 25 | 2 | 2 | 14% | 6 |
| crc-LDE | 1 | 1 | 0 | 0 | 0% | 0 |
| crc-OWB | 5 | 5 | 0 | 0 | 0% | 0 |
| crc-PR | 6 | 6 | 0 | 0 | 0% | 0 |
| crc-RW | 1 | 1 | 0 | 0 | 0% | 0 |

Noisiest by volume of disagreement (minority votes): crc-SP (30), crc-CA (25), crc-DE (25), crc-TPW (21). Noisiest by rate: crc-AW (60%, small n), crc-CA/crc-CM (43%), crc-DE (41%). crc-SP has the most 3-2/uncertain items in absolute terms (13) but a below-average split rate. crc-CA's disagreements skew toward recoverable 4-1s (11 of 18); crc-SP's skew toward maximal 3-2s (13 of 17).

Consistency vs baseline: crc-AW, crc-DE, crc-CA were the noisiest departments in the v4 baseline too (80% / 72% / anomaly-heavy); all three improved in rate but remain at the top — chronic, department-level guide-ambiguity signal.

---

## 5. Data sources & limitations

**Sources**
- Primary: `RUN_DIR/output/consolidated-findings.json` (291 items, per-run votes + voteBreakdown + majority + confidence), RUN_DIR = `/private/tmp/claude-501/-Users-wnavey-noetic/e4e35185-fafe-46a2-a324-6e4d0b91d03c/scratchpad/crc-run-ed5e7ba9`. Vote counts cross-checked against `voteBreakdown` and per-item `perRunFindings` (all 291 items have exactly 5 findings, one per run-1…run-5).
- Baseline: `/Users/wnavey/noetic/crc-audits/bfb4f256-27a2-4adc-8443-b942e3b4aa79/crc-audit-agent-2-current-run-votes.tsv` and its write-up (v4 calibration, 2026-07-13, 3 runs).

**Limitations**
1. **First CRC review of v5** — no true same-version history; the "running variance" TSV therefore contains this review plus a clearly-labeled cross-version baseline, not a same-version tally.
2. The baseline is a **different submission version (v4) under a calibration objective** — only agreement/variance rates and item-level instability are comparable; status flips between the runs are expected and not evidence of error.
3. **Run counts differ (5 vs 3)** — unanimity rates are not directly comparable (5-0 is harder); pairwise agreement (0.844 vs 0.744) is the fair comparison and shows the same direction.
4. Baseline items `CA-17.1`, `CA-21.1`, `CA-22.1` have no v5 counterpart (they were v4 fragmentation phantoms); they appear only in the baseline TSV, not in the running-variance TSV.
5. Grouping-name case normalization (a known CRC join hazard) was checked and not needed — this run's grouping names are internally consistent, and all joins were by bare checklistItemId.
6. This report deliberately excludes tool-usage and performance analysis (other agents' lanes).
