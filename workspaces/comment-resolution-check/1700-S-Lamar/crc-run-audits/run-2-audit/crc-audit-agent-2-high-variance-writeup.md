# CRC Audit — Agent 2: Majority-Vote Results & Vote Variance

**Review under audit:** `3703349c-ac08-44b8-8c10-2100adb89f5b` (CRC, 3-run medly)
**Submission version (U1 plans):** `6b9b85ed-e992-4906-a222-b24ee836910c`
**Config:** 3 runs (run-1/2/3) × 16 departments, per-item symmetric majority vote.
**Audit scope:** majority-vote results, intra-run vote variance (disagreement across the 3 runs), and a running tally vs. prior CRC runs of the same submission version. (Tool usage / performance are out of scope — owned by other agents.)

---

## 1. Executive summary

- **205 consolidated checklist items** across 16 departments. Majority verdict: **169 `failed`, 36 `resolved`** (no `not-applicable` survived to majority).
- **132 items (64%) were unanimous** (3-0). **50 items (24%) showed genuine status disagreement** across runs (49 are 2-1 splits; 1 is a "1-1 with a missing run"). There were **zero 1-1-1 (three-different-status) splits** — the 3-status enum plus a strongly `failed`-leaning prior keeps disagreement to two-way.
- **A second, structural kind of variance** showed up that is easy to miss: the runs disagreed on *how the guide decomposes into atomic items*. Runs 1 and 3 produced an identical item set; **run-2 used a different decomposition** for `crc-sp` and `crc-tpw`, yielding **23 items that only 1 or 2 runs ever scored** (confidence capped at `low`/`medium` by design). This is run-to-run instability in the item taxonomy itself, not just in the status vote.
- **Historical comparison succeeded.** One prior CRC review of this submission version exists: `7e79e197-…` (2026-06-19), but it was a **single-run** review (`totalRuns=1`), so it has no per-run votes of its own — only a final status per item. Comparing its final status to the current majority, **24 of 183 shared items flipped** verdict between the two reviews.
- **Chronically unstable items** (disagree *within* this run AND flipped *across* the two reviews): **13 items**, concentrated in `crc-de`, `crc-sp`, and `crc-tpw`. These are the items least safe to trust at face value.
- **Noisiest departments:** `crc-sp`, `crc-de`, and `crc-tpw` dominate both intra-run disagreement and cross-review flips. `crc-f` is small but unusually flip-prone (4 of 7 items changed verdict vs. history).

---

## 2. Voting / variance semantics (from DESIGN-SPEC)

- Status enum: `resolved | failed | not-applicable`. Symmetric majority (winner-takes-all).
- Tie-break severity (D3): `failed > not-applicable > resolved` — ambiguous evidence collapses to `failed`.
- Confidence: unanimous → `high`; ≥2 agreeing → `medium`; 1 → `low`. Compared against `totalRuns=3`, so **any missing run prevents `high`** (intentional).
- "High variance" in this audit = **runs disagreed on status**. A clean 3-0 = zero variance; 2-1 = disagreement; 1-1-1 = maximum (none occurred). Items where only 1–2 runs produced a finding are flagged separately as a *coverage* gap rather than a status disagreement.

---

## 3. Current run — high-variance items

### 3.1 Distribution (all 205 items)

| Vote split | Meaning | Count | High variance? |
|---|---|---:|:--:|
| 3-0 | unanimous (all 3 runs agree) | 132 | no |
| 2-1 | one dissenting run | 49 | **yes** |
| 1-1 (1 run missing) | the 2 present runs disagree | 1 | **yes** |
| 2-0 (1 run missing) | 2 present runs agree, 1 run absent | 11 | no (coverage gap) |
| 1-0 (2 runs missing) | only 1 run scored this item | 12 | no (coverage gap) |
| 1-1-1 | three different statuses | 0 | — |

- **Unanimous: 132 (64.4%). Status-disagreement (high variance): 50 (24.4%). Coverage-gap only: 23 (11.2%).**
- All 50 high-variance items carry `medium` confidence except `SP-32.2` (`low`, because one run was also missing). No high-variance item reached `high` confidence — the confidence tier is doing its job as a disagreement signal.

### 3.2 Every status-disagreement item (sorted by department)

Format: `run1/run2/run3 → majority`.

| Dept | Item | Runs (1/2/3) | Split | Majority |
|---|---|---|---|---|
| crc-aw | AW-1.1 | failed/resolved/failed | 2-1 | failed |
| crc-aw | AW-2.1 | resolved/failed/resolved | 2-1 | resolved |
| crc-aw-redlines | AW-RL-3 | failed/resolved/failed | 2-1 | failed |
| crc-awrr | AWRR-2.2 | failed/failed/resolved | 2-1 | failed |
| crc-ca | CA-02.1 | resolved/failed/failed | 2-1 | failed |
| crc-ca | CA-03.1 | resolved/failed/failed | 2-1 | failed |
| crc-ca | CA-06.1 | resolved/failed/failed | 2-1 | failed |
| crc-ca | CA-14.1 | resolved/failed/failed | 2-1 | failed |
| crc-ca | CA-17.1 | failed/resolved/resolved | 2-1 | resolved |
| crc-ca | CA-21.1 | resolved/failed/resolved | 2-1 | resolved |
| crc-de | DE-1.1 | failed/failed/not-applicable | 2-1 | failed |
| crc-de | DE-2.1 | failed/resolved/resolved | 2-1 | resolved |
| crc-de | DE-4.1 | failed/resolved/failed | 2-1 | failed |
| crc-de | DE-6.1 | resolved/failed/failed | 2-1 | failed |
| crc-de | DE-7.1 | resolved/resolved/failed | 2-1 | resolved |
| crc-de | DE-17.1 | resolved/failed/failed | 2-1 | failed |
| crc-de | DE-25.1 | failed/failed/not-applicable | 2-1 | failed |
| crc-de | DE-26.1 | resolved/resolved/failed | 2-1 | resolved |
| crc-de | DE-30.1 | resolved/failed/failed | 2-1 | failed |
| crc-de | DE-35.1 | resolved/failed/failed | 2-1 | failed |
| crc-ev | EV-03.1 | failed/resolved/resolved | 2-1 | resolved |
| crc-ev | EV-07.1 | resolved/failed/failed | 2-1 | failed |
| crc-f | F-5.1 | resolved/resolved/failed | 2-1 | resolved |
| crc-pr | PR-4.1 | resolved/resolved/failed | 2-1 | resolved |
| crc-sp | SP-4.1 | resolved/failed/resolved | 2-1 | resolved |
| crc-sp | SP-8.1 | failed/resolved/failed | 2-1 | failed |
| crc-sp | SP-9.1 | resolved/failed/resolved | 2-1 | resolved |
| crc-sp | SP-13.1 | failed/failed/resolved | 2-1 | failed |
| crc-sp | SP-21.1 | resolved/failed/failed | 2-1 | failed |
| crc-sp | SP-25.1 | resolved/failed/resolved | 2-1 | resolved |
| crc-sp | SP-30.1 | resolved/failed/failed | 2-1 | failed |
| crc-sp | SP-32.2 | resolved/(missing)/failed | 1-1 (1 missing) | failed |
| crc-sp | SP-35.1 | resolved/failed/failed | 2-1 | failed |
| crc-sp | SP-41.1 | resolved/resolved/failed | 2-1 | resolved |
| crc-sp | SP-43.1 | failed/failed/resolved | 2-1 | failed |
| crc-sp | SP-44.1 | failed/resolved/resolved | 2-1 | resolved |
| crc-sp | SP-46.1 | resolved/resolved/failed | 2-1 | resolved |
| crc-sp | SP-48.1 | resolved/failed/failed | 2-1 | failed |
| crc-sp | SP-51.1 | failed/resolved/failed | 2-1 | failed |
| crc-tpw | TPW-6.1 | failed/failed/not-applicable | 2-1 | failed |
| crc-tpw | TPW-7.1 | failed/failed/not-applicable | 2-1 | failed |
| crc-tpw | TPW-8.1 | failed/failed/not-applicable | 2-1 | failed |
| crc-tpw | TPW-9.1 | failed/failed/not-applicable | 2-1 | failed |
| crc-tpw | TPW-11.1 | failed/failed/not-applicable | 2-1 | failed |
| crc-tpw | TPW-17.1 | failed/resolved/failed | 2-1 | failed |
| crc-tpw | TPW-18.1 | failed/not-applicable/failed | 2-1 | failed |
| crc-tpw | TPW-20.1 | failed/resolved/failed | 2-1 | failed |
| crc-wq | WQ-7.1 | resolved/failed/failed | 2-1 | failed |
| crc-wq | WQ-8.1 | resolved/failed/failed | 2-1 | failed |
| crc-wq | WQ-9.1 | resolved/failed/resolved | 2-1 | resolved |

**Pattern note — `crc-tpw`'s `not-applicable` dissent.** Six TPW items (6.1, 7.1, 8.1, 9.1, 11.1 + 18.1) have a single run voting `not-applicable` while the other two vote `failed`. That looks less like genuine N/A judgment and more like one run treating an un-scoreable item as "skip" — worth a spot-check, because under the severity tie-break `failed` correctly wins anyway, but a run reading an item as N/A is a different failure mode than a `resolved`/`failed` disagreement.

### 3.3 Coverage-gap items (decomposition variance — a separate concern)

23 items were scored by fewer than 3 runs. The cause is **not** missing output for a shared item; it is that **run-2 decomposed two guides differently** from runs 1 & 3:

- `crc-sp`: runs 1 & 3 split several parent comments into sub-items (e.g. `SP-15.1/.2/.3/.4`, `SP-25.2…5`, `SP-32.2/.3`); run-2 kept `SP-15.1` whole and instead emitted single items `SP-5.1, SP-10.1, SP-12.1, SP-14.1, SP-22.1, SP-28.1, SP-38.1, SP-39.1, SP-49.1`. Net: 9 items present only in runs 1+3 (runCount=2) and 9 present only in run-2 (runCount=1).
- `crc-tpw`: runs 1 & 3 emitted `TPW-13.2, TPW-17.2, TPW-17.3`; run-2 emitted `TPW-2.1, TPW-4.1, TPW-5.1` instead.
- All other 14 departments had **identical item sets across all 3 runs.**

This is genuine run-to-run instability in the atomic-item taxonomy, plausibly linked to the structured-output retry storm (DESIGN-SPEC R1) perturbing run-2's emission. It is honestly represented in the votes TSV with `(missing)` run cells and the `…(N missing)` split labels, and the spec's "missing run prevents `high` confidence" rule means none of these can masquerade as high-confidence.

---

## 4. Running / persistent high-variance (across all CRC runs of this submission version)

### 4.1 The review set

Two CRC reviews exist for submission version `6b9b85ed-…`:

| Review ID | Created | Runs | Items | Role |
|---|---|---|---:|---|
| `7e79e197-8922-4c18-8a94-bc6d43218362` | 2026-06-19 22:58 UTC | **1 (single-run)** | 183 | historical |
| `3703349c-ac08-44b8-8c10-2100adb89f5b` | 2026-06-23 21:46 UTC | **3 (medly)** | 205 | current (this audit) |

**Key limitation:** the historical review is single-run, so it carries **no per-run votes** — only one final status per item. Cross-review "variance" is therefore a *final-status flip* between two reviews, not a 3-vs-3 vote comparison. Per-run vote disagreement only exists for the current run. (This matches the task's stated expectation that historical reviews store only consolidated status.) The running-tally TSV records this with `per_run_votes = "n/a (single-run review)"` for every historical row.

### 4.2 Cross-review flips

- **183 items present in both reviews; 159 agreed, 24 flipped final status** (13.1% flip rate).
- **22 items are new in the current run** (the 10 `AW-RL-*` redline items — a whole new department/guide source — plus the 12 run-2-decomposition `crc-sp`/`crc-tpw` items). **0 items dropped** vs. history.

### 4.3 Chronically unstable items (rank-ordered worst first)

These **13 items disagreed within the current 3-run AND flipped verdict vs. the 2026-06-19 review** — the least stable items in the whole submission version. Ranked by department concentration (most-affected depts first):

| Rank | Dept | Item | This run (1/2/3) → majority | Hist → Cur |
|---:|---|---|---|---|
| 1 | crc-de | DE-6.1 | resolved/failed/failed → failed | resolved → failed |
| 2 | crc-de | DE-7.1 | resolved/resolved/failed → resolved | failed → resolved |
| 3 | crc-de | DE-25.1 | failed/failed/not-applicable → failed | not-applicable → failed |
| 4 | crc-de | DE-30.1 | resolved/failed/failed → failed | resolved → failed |
| 5 | crc-de | DE-35.1 | resolved/failed/failed → failed | resolved → failed |
| 6 | crc-sp | SP-21.1 | resolved/failed/failed → failed | resolved → failed |
| 7 | crc-sp | SP-25.1 | resolved/failed/resolved → resolved | failed → resolved |
| 8 | crc-sp | SP-35.1 | resolved/failed/failed → failed | resolved → failed |
| 9 | crc-tpw | TPW-8.1 | failed/failed/not-applicable → failed | resolved → failed |
| 10 | crc-tpw | TPW-17.1 | failed/resolved/failed → failed | not-applicable → failed |
| 11 | crc-ca | CA-21.1 | resolved/failed/resolved → resolved | failed → resolved |
| 12 | crc-aw | AW-2.1 | resolved/failed/resolved → resolved | failed → resolved |
| 13 | crc-f | F-5.1 | resolved/resolved/failed → resolved | failed → resolved |

These are the items a human reviewer should re-verify by hand: both the model-internal disagreement and the cross-review flip point to genuinely borderline evidence.

### 4.4 Flipped but unanimous this run (stable now, but disagreed with history)

11 items now have a clean 3-0 vote yet landed on a *different* verdict than the single-run 2026-06-19 review — the medly likely corrected (or at least firmed up) an earlier single-run call:

`AWRR-2.1` (failed→resolved), `EV-08.1` (failed→resolved), `F-1.1` (n/a→failed), `F-4.1` (failed→resolved), `F-6.1` (failed→resolved), `LDE-1.1` (resolved→failed), `SP-25.3` (failed→resolved, 1 run missing), `SP-29.1` (n/a→failed), `SP-33.1` (resolved→failed), `TPW-16.1` (resolved→failed), `TPW-17.2` (resolved→failed, 1 run missing).

`crc-f` stands out here: 4 of its 7 items flipped vs. history (`F-1.1, F-4.1, F-5.1, F-6.1`), though all but `F-5.1` are unanimous this run.

---

## 5. Per-department variance summary

Ranked by combined noise (intra-run high-variance count + cross-review flip count). "% HV" is intra-run high-variance items as a share of the department's items.

| Dept | Items | Intra-run HV | % HV | Cross-review flips |
|---|---:|---:|---:|---:|
| crc-sp | 58 | 15 | 26% | 6 |
| crc-de | 33 | 10 | 30% | 5 |
| crc-tpw | 24 | 8 | 33% | 4 |
| crc-ca | 21 | 6 | 29% | 1 |
| crc-f | 7 | 1 | 14% | 4 |
| crc-aw | 2 | 2 | 100% | 1 |
| crc-ev | 15 | 2 | 13% | 1 |
| crc-wq | 15 | 3 | 20% | 0 |
| crc-awrr | 4 | 1 | 25% | 1 |
| crc-aw-redlines | 10 | 1 | 10% | 0 |
| crc-lde | 1 | 0 | 0% | 1 |
| crc-pr | 6 | 1 | 17% | 0 |
| crc-cm | 5 | 0 | 0% | 0 |
| crc-iw | 1 | 0 | 0% | 0 |
| crc-owb | 1 | 0 | 0% | 0 |
| crc-pb | 2 | 0 | 0% | 0 |

**Takeaways**
- **`crc-sp`, `crc-de`, `crc-tpw` are the noise epicenter** — they hold 33 of the 50 high-variance items (66%) and 15 of 24 cross-review flips. They are also the largest guides, but their HV *rates* (26–33%) are above the corpus average (24%), so it is not purely a volume effect.
- **`crc-tpw` is distinctively N/A-prone:** 6 of its 8 HV items involve one run voting `not-applicable`.
- **`crc-aw` is 100% HV** but only has 2 items — small-sample, not a systemic signal on its own, though both items also flipped/disagreed.
- **`crc-cm`, `crc-iw`, `crc-owb`, `crc-pb`, `crc-pr`, `crc-wq`** are stable: unanimous and (mostly) flip-free. `crc-wq` has 3 intra-run splits but zero cross-review flips — internally noisy, externally consistent.

---

## 6. Data sources & limitations

**Sources used**
- Primary: `conductor/workspace/output/consolidated-findings.json` (205 items, majority + per-run votes for the current run).
- Cross-check: `conductor/workspace/output/runs/run-{1,2,3}/findings/crc-*.md.json` — used to confirm the run-2 decomposition divergence and that "missing" run cells reflect genuine absence (an item ID a run never emitted), not a parsing gap.
- Semantics: `winston/workspaces/comment-resolution-check/crc-workflow/majority-vote/DESIGN-SPEC.md`.
- Historical: Supabase project `mgxqsrjutswbciyrltwd`, tables `reviews` and `review_comments` (via the `supabase-query` skill). The `review_sections` table referenced in the prompt does not gate this data — `review_comments` joins to `reviews` directly via `review_id`, and per-item identity lives in `output_json->'crc'->>'atomicItemId'`, status in `output_json->>'status'`.

**Limitations**
1. **Historical review is single-run.** No 3-run vote variance exists for the 2026-06-19 review; cross-review comparison is final-status-flip only. Per-run vote disagreement is observable for the current run only.
2. **Only two CRC reviews exist** for this submission version, so the "running tally" is a 2-point time series. Items that flip with each new review can be flagged, but a robust "chronically unstable" trend would want ≥3 runs.
3. **Join key is `atomicItemId`.** The DB `section` field uses department *labels* (e.g. `austin-water`), while the local files use `crc-xx` *codes*; this audit normalizes department to the local `crc-xx` grouping where the item appears in the current run, falling back to the DB section label otherwise. Item IDs are stable and unambiguous across both sources.
4. **Decomposition variance vs. status variance are tracked separately.** Coverage-gap items (`runCount<3`) are not counted as "high variance" status disagreements but are called out explicitly (§3.3) because they represent a real and distinct form of run-to-run instability.
5. No fabricated history — every historical data point is pulled live from Supabase.

---

## 7. Output files

- `crc-audit-agent-2-current-run-votes.tsv` — 205 items, per-run votes + split + variance flag (high-variance sorted first).
- `crc-audit-agent-2-running-variance-all-runs.tsv` — 388 rows (one per item × review) across both CRC reviews.
- `crc-audit-agent-2-high-variance-writeup.md` — this document.
