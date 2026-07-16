# CRC Audit — Agent 2: Vote Variance Analysis

**Review ID:** `d1ff47e7-7c77-4a54-9d1c-4d6bae26046e`
**Submission version:** `6b9b85ed-e992-4906-a222-b24ee836910c` (calibration run — `crcGuidesSubmissionVersionId == submissionVersionId`)
**Guide generation:** 6
**Config:** 5 independent runs, majority vote per checklist item
**Run started:** 2026-06-30T20:58:33.097Z

## Executive summary

- Total checklist items voted: **291** (17 groupings across 24 dept files, all with `runCount = 5` — zero coverage gaps).
- Per-run status vocabulary observed: `resolved`, `failed` only. Majority-status vocabulary includes `uncertain` (used when the vote is 3-2 or 2-3 — no clean majority).
- **Unanimous votes: 226 / 291 (77.7%)**
  - `5-0` unanimous resolved: **27**
  - `0-5` unanimous failed: **199**
- **Split votes: 65 / 291 (22.3%)**
  - `4-1` (resolved-majority): **8**
  - `1-4` (failed-majority): **31**
  - `3-2` (uncertain, tentative resolved): **15**
  - `2-3` (uncertain, tentative failed): **11**
- **Highest disagreement (3-2 / 2-3, i.e. one-vote tips): 26 items (8.9%)** — all land in `uncertain` majority.
- **Second-tier disagreement (4-1 / 1-4): 39 items (13.4%)** — one dissenter each, majority survives.
- **Coverage gaps: 0** — every item received all 5 votes.
- All 26 highest-disagreement items have `confidence: medium`; every unanimous item has `confidence: high` (deterministic from `voteBreakdown` in this dataset).

## Current-run high-variance items

### 3-2 / 2-3 splits (26 items — one vote from flipping the majority)

| Dept | Item | Vote (R-F) | Majority | Tentative |
|---|---|---|---|---|
| crc-AW | AW-1.2 | 3-2 | uncertain | resolved |
| crc-AW | AW-1.4 | 2-3 | uncertain | failed |
| crc-CA | CA-16.1 | 2-3 | uncertain | failed |
| crc-CM | CM-8 | 3-2 | uncertain | resolved |
| crc-DE | DE-14.1 | 2-3 | uncertain | failed |
| crc-DE | DE-23 | 2-3 | uncertain | failed |
| crc-DE | DE-27.2 | 2-3 | uncertain | failed |
| crc-DE | DE-31 | 2-3 | uncertain | failed |
| crc-EV | EV-05.2 | 3-2 | uncertain | resolved |
| crc-EV | EV-05.4 | 3-2 | uncertain | resolved |
| crc-F | F-7 | 3-2 | uncertain | resolved |
| crc-SP | SP-23.2 | 3-2 | uncertain | resolved |
| crc-SP | SP-30.1 | 3-2 | uncertain | resolved |
| crc-SP | SP-30.2 | 3-2 | uncertain | resolved |
| crc-SP | SP-30.3 | 3-2 | uncertain | resolved |
| crc-SP | SP-31.2 | 3-2 | uncertain | resolved |
| crc-SP | SP-32.2 | 3-2 | uncertain | resolved |
| crc-SP | SP-36.1 | 3-2 | uncertain | resolved |
| crc-SP | SP-36.4 | 3-2 | uncertain | resolved |
| crc-SP | SP-41 | 2-3 | uncertain | failed |
| crc-SP | SP-43 | 3-2 | uncertain | resolved |
| crc-SP | SP-48 | 2-3 | uncertain | failed |
| crc-TPW | TPW-12.3 | 3-2 | uncertain | resolved |
| crc-TPW | TPW-8 | 2-3 | uncertain | failed |
| crc-WQ | WQ-1 | 2-3 | uncertain | failed |
| crc-WQ | WQ-8.1 | 2-3 | uncertain | failed |

Departments affected by 3-2/2-3 splits: **crc-SP (11), crc-DE (4), crc-AW (2), crc-EV (2), crc-WQ (2), crc-TPW (2), crc-CA (1), crc-CM (1), crc-F (1)** — 9 of 17 groupings.

### 4-1 / 1-4 splits (39 items — one dissenter)

| Dept | Item | Vote (R-F) | Majority |
|---|---|---|---|
| crc-AW | AW-2 | 1-4 | failed |
| crc-CA | CA-11 | 1-4 | failed |
| crc-CA | CA-13.1 | 1-4 | failed |
| crc-CA | CA-13.2 | 1-4 | failed |
| crc-CA | CA-14 | 1-4 | failed |
| crc-CA | CA-16.2 | 4-1 | resolved |
| crc-CA | CA-17 | 1-4 | failed |
| crc-CA | CA-18.2 | 1-4 | failed |
| crc-CA | CA-18.3 | 1-4 | failed |
| crc-CM | CM-11 | 4-1 | resolved |
| crc-DE | DE-13 | 1-4 | failed |
| crc-DE | DE-17 | 1-4 | failed |
| crc-DE | DE-24 | 1-4 | failed |
| crc-DE | DE-25 | 1-4 | failed |
| crc-DE | DE-26 | 1-4 | failed |
| crc-DE | DE-30 | 4-1 | resolved |
| crc-EV | EV-05.1 | 4-1 | resolved |
| crc-EV | EV-15 | 1-4 | failed |
| crc-F | F-2.1 | 1-4 | failed |
| crc-F | F-2.2 | 4-1 | resolved |
| crc-F | F-4 | 1-4 | failed |
| crc-F | F-6 | 1-4 | failed |
| crc-PB | PB-1 | 4-1 | resolved |
| crc-SP | SP-13 | 1-4 | failed |
| crc-SP | SP-16 | 1-4 | failed |
| crc-SP | SP-17.1 | 1-4 | failed |
| crc-SP | SP-24 | 4-1 | resolved |
| crc-SP | SP-36.3 | 1-4 | failed |
| crc-SP | SP-42 | 4-1 | resolved |
| crc-SP | SP-50 | 1-4 | failed |
| crc-TPW | TPW-12.1 | 1-4 | failed |
| crc-TPW | TPW-13.6 | 1-4 | failed |
| crc-TPW | TPW-16 | 1-4 | failed |
| crc-TPW | TPW-17.1 | 1-4 | failed |
| crc-TPW | TPW-17.2 | 1-4 | failed |
| crc-TPW | TPW-17.3 | 1-4 | failed |
| crc-TPW | TPW-6 | 1-4 | failed |
| crc-WQ | WQ-8.2 | 1-4 | failed |
| crc-WQ | WQ-9 | 1-4 | failed |

### Aggregate counts

| Split shape | Count | Share |
|---|---:|---:|
| 5-0 (unanimous resolved) | 27 | 9.3% |
| 0-5 (unanimous failed) | 199 | 68.4% |
| 4-1 (resolved-majority, 1 dissent) | 8 | 2.7% |
| 1-4 (failed-majority, 1 dissent) | 31 | 10.7% |
| 3-2 (tentative resolved, uncertain) | 15 | 5.2% |
| 2-3 (tentative failed, uncertain) | 11 | 3.8% |
| Coverage gap (runCount < 5) | 0 | 0.0% |

## Per-department variance summary

Sorted by absolute count of split items (descending), then by tight-split rate:

| Department | Total items | Unanimous | Any split | 4-1 / 1-4 | 3-2 / 2-3 | Split rate |
|---|---:|---:|---:|---:|---:|---:|
| crc-SP | 63 | 45 | 18 | 7 | 11 | 28.6% |
| crc-DE | 39 | 29 | 10 | 6 | 4 | 25.6% |
| crc-CA | 42 | 33 | 9 | 8 | 1 | 21.4% |
| crc-TPW | 37 | 28 | 9 | 7 | 2 | 24.3% |
| crc-F | 11 | 6 | 5 | 4 | 1 | 45.5% |
| crc-EV | 29 | 25 | 4 | 2 | 2 | 13.8% |
| crc-WQ | 20 | 16 | 4 | 2 | 2 | 20.0% |
| crc-AW | 5 | 2 | 3 | 1 | 2 | 60.0% |
| crc-CM | 7 | 5 | 2 | 1 | 1 | 28.6% |
| crc-PB | 2 | 1 | 1 | 1 | 0 | 50.0% |
| crc-AWRR | 10 | 10 | 0 | 0 | 0 | 0.0% |
| crc-aw-redlines | 10 | 10 | 0 | 0 | 0 | 0.0% |
| crc-IW | 3 | 3 | 0 | 0 | 0 | 0.0% |
| crc-LDE | 1 | 1 | 0 | 0 | 0 | 0.0% |
| crc-OWB | 5 | 5 | 0 | 0 | 0 | 0.0% |
| crc-PR | 6 | 6 | 0 | 0 | 0 | 0.0% |
| crc-RW | 1 | 1 | 0 | 0 | 0 | 0.0% |

**Noisiest by absolute split count:** crc-SP (18 splits over 63 items) contributes ~28% of all splits by itself, followed by crc-DE (10), crc-CA (9), crc-TPW (9), crc-F (5).

**Noisiest by rate (excluding groupings with <5 items):**
1. `crc-AW` — 60.0% split rate (3 of 5 items non-unanimous, 2 of which are 3-2/2-3 tight splits)
2. `crc-F` — 45.5% (5 of 11 items non-unanimous)
3. `crc-SP` — 28.6% (also has the highest raw count of tight 3-2/2-3 splits: 11)
4. `crc-CM` — 28.6% (2 of 7)
5. `crc-DE` — 25.6% (10 of 39)

**Silent departments (100% unanimous):** crc-AWRR, crc-aw-redlines, crc-IW, crc-LDE, crc-OWB, crc-PR, crc-RW — 7 groupings, 36 items total, zero disagreement.

**Notable pattern:** all 11 crc-SP tight splits favor `resolved` (3-2), whereas most crc-TPW/crc-CA/crc-DE splits favor `failed` (1-4 or 2-3). Site-plan review appears to have the strongest pull toward calling something "resolved" from a minority position; TPW/CA/DE reviewers on the majority side flag noise from a single "resolved" dissenter.

## Running-tally section

**Historical comparison was intentionally skipped for this audit.** Prior CRC reviews of submission version `6b9b85ed-e992-4906-a222-b24ee836910c` used `crcGenerationNumber` values of **1, 1, 2, and 5**, while the current review uses **generation 6**. Because guide generations restructure checklist item IDs, split items, add/remove/rename criteria, and rewrite regulatory grounding, a per-`checklist_item_id` comparison across generations would be neither semantically equivalent nor statistically meaningful — a "same ID" match may cover a different requirement, and many current-generation IDs may not have existed in prior generations at all.

The `crc-audit-agent-2-running-variance-all-runs.tsv` file therefore contains rows for **only the current review** (`is_current_run = true` for every row), and carries a top-line `#` comment stating this omission. A future longitudinal variance study will require either (a) a subset of items whose IDs and text are provably stable across generations 1→6, or (b) an item-level semantic alignment pass across guide generations before rows can be joined.

## Data sources

- Primary: `/Users/wnavey/noetic/crc-audits/d1ff47e7-7c77-4a54-9d1c-4d6bae26046e/_run_artifacts/output/consolidated-findings.json` (291 items, each with `voteBreakdown` and full `perRunFindings[]`).
- Cross-check: 24 per-department JSON files under `_run_artifacts/output/runs/run-{1..5}/findings/` — not needed for TSV construction because `consolidated-findings.json` already carries every per-run status in `perRunFindings[]`.
- Run metadata: `_run_artifacts/workflow/status.json` → `startedAt = 2026-06-30T20:58:33.097Z` (used as `review_created_at`).

## Limitations

- Historical variance is deliberately excluded (guide-generation incompatibility, see above).
- Only two per-run status values (`resolved`, `failed`) appear in this dataset; the schema also permits `not-applicable` and `missing`, but neither was cast by any agent on any item in any of the 5 runs. `uncertain` only appears at the majority-status level, produced deterministically by the consolidator when the vote is 3-2 or 2-3.
- 5 runs is a small sample: the difference between a 3-2 and a 2-3 outcome is a single agent draw; treating "3-2 resolved" and "3-2 failed" as separate populations is statistically weak. The `tentativeStatus` field surfaces this same weakness.
- Confidence appears to be a deterministic function of the vote breakdown (unanimous → high, split → medium) rather than an independent signal — not useful as a second axis of variance.
- No LLM-side analysis of *why* items disagree was performed by this agent (out of lane); that belongs to Agent 4 / correctness review. But cursory read of the two crc-AW tight splits (AW-1.2, AW-1.4) shows the disagreement is grounded in different vision-tool interpretations of Sheet 35/36, not stochastic sampling — a real ambiguity in the underlying evidence.
