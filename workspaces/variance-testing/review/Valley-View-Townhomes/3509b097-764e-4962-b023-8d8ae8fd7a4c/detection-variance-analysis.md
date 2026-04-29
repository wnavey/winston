# Detection Variance Analysis — Valley View 5-run

**Review:** `3509b097-764e-4962-b023-8d8ae8fd7a4c` · 2026-04-28T22:36Z

73 of 84 refs (87%) have detection variance — runs disagree on whether to surface the issue at all. This is the dominant variance signal in the review workflow and warrants its own treatment.

> Important caveat: 8 of the 22 refs at `1/5` detection in grouping 13 (and another 26 EL-13 entries at higher detection) are corrupted by a schema-validation harness bug — see [`structured-output-data-loss.md`](./structured-output-data-loss.md). The numbers below are the *current persisted state*; the counterfactual restoring run-3's lost 34 EL-13 findings would shift many EL-13 refs up by one detection level.

---

## Why detection variance is structurally normal here

Each of the 5 review runs is an independent agent walking the el-md-exp guide and producing findings *only for issues it identifies*. There's no "checked everything, all passed" output — refs only exist in the merged file because at least one run flagged them. So a ref at `1/5` detection means *only one of the five runs decided to surface this issue*; a ref at `5/5` means *every run independently arrived at the same finding*. Detection rate is therefore a direct quality signal:

- **5/5** — strong inter-run consensus that the issue is real
- **4/5** — clear majority
- **3/5** — split with a slight lean
- **2/5** — minority signal
- **1/5** — single-run flag, weak evidence

Unlike completeness-check, where detection variance was 100% harness bug, here detection variance is mostly *the model doing its job differently across runs* — sampling different slices of the issue space. Some of it is bug (see structured-output-data-loss.md), but the bulk is structural.

---

## Per-grouping detection-rate distribution

| Grouping | Refs | 5/5 | 4/5 | 3/5 | 2/5 | 1/5 |
|---|---:|---:|---:|---:|---:|---:|
| `1` | 38 | 5 | 1 | 4 | 14 | 14 |
| `13` | 34 | 4 | 14 | 2 | 6 | 8 |
| `2` | 12 | 2 | 1 | 4 | 5 | 0 |

Grouping 1 has by far the most low-confidence refs — 28 of 38 (74%) are at `1/5` or `2/5`. This is the noisiest section of the guide. Grouping 13 has the most `4/5` refs by far (14, vs 1 for grouping 1) — but again, that count would jump after fixing the data-loss bug.

---

## The 11 unanimous (5/5) refs

These are the strongest-confidence findings in the review — every one of the 5 runs independently arrived at the same status:

| Ref | Status | Pattern | Note |
|---|---|---|---|
| `1:EL-1.1` | not-verifiable | 5× n/v | All runs agree they can't verify (overhead conductor clearance — needs surveyor data) |
| `1:EL-1.7` | fail | 3× fail, 2× n/v | Building elevation data missing (see report.md analysis) |
| `1:EL-1.8` | fail | 4× fail, 1× n/v | |
| `1:EL-1.31` | fail | 4× fail, 1× n/v | |
| `1:EL-1.46` | fail | 5× fail | Strongest possible signal — every run confidently flagged this |
| `13:EL-13.1` | fail | 1× fail, 4× n/v | Transformer pad clearance — only 1 run was confident enough to call fail |
| `13:EL-13.34` | fail | 2× fail, 3× n/v | |
| `13:EL-13.37` | fail | 3× fail, 2× n/v | |
| `13:EL-13.38` | fail | 3× fail, 2× n/v | |
| `2:EL-2.1` | fail | 2× fail, 3× n/v | |
| `2:EL-2.15` | fail | 2× fail, 3× n/v | |

**`1:EL-1.46` is the cleanest case** — 5 fails, no `not-verifiable`. Every run confidently flagged the same issue with the same status. That's the signal a city reviewer can rely on.

The pattern across most 5/5 refs is **3 fail + 2 not-verifiable** or similar — the unanimous part is "every run thinks something is wrong here", but the runs split on whether they had enough evidence to call it `fail` outright. This reinforces the report.md conclusion that `fail` vs `not-verifiable` is mostly a confidence-tier difference rather than a verdict disagreement.

---

## The 22 single-run-flag (1/5) refs

These are the weakest signals — only one run thought the issue was worth surfacing. Splits cleanly by grouping:

### Grouping 1 — 14 refs at 1/5

| Ref | Status | Run that flagged |
|---|---|---|
| `1:EL-1.4` | not-verifiable | (1 run) |
| `1:EL-1.5` | not-verifiable | (1 run) |
| `1:EL-1.13` | not-verifiable | |
| `1:EL-1.16` | not-verifiable | |
| `1:EL-1.24` | not-verifiable | |
| `1:EL-1.26` | not-verifiable | |
| `1:EL-1.29` | not-verifiable | |
| `1:EL-1.30` | not-verifiable | |
| `1:EL-1.34` | not-verifiable | |
| `1:EL-1.36` | **fail** | (1 run — only `fail` in this set) |
| `1:EL-1.39` | not-verifiable | |
| `1:EL-1.43` | not-verifiable | |
| `1:EL-1.44` | not-verifiable | |
| `1:EL-1.47` | not-verifiable | |

Of the 14, only `1:EL-1.36` was flagged as `fail`. The other 13 were single-run `not-verifiable` calls — meaning one run wasn't sure about something the other 4 didn't bother to surface. **These are likely candidates for filtering out of the merged review** — a single run's "I can't verify" without any corroboration from the other 4 runs is weak evidence of a real issue.

### Grouping 13 — 8 refs at 1/5 (all `not-verifiable`)

`13:EL-13.3, 4, 5, 11, 16, 17, 18, 20` — all single-run `not-verifiable`.

**Caveat:** This is the bug-affected grouping. Reconstructing run-3's lost 38-item set, all 8 of these would jump from 1/5 to 2/5 because run-3 produced findings for all 8 (with `not-verifiable` status). So all 8 are actually 2-run not-verifiable findings, not 1-run. Still weak signal, but less weak than the persisted file shows.

### Grouping 2 — 0 refs at 1/5

Grouping 2 is the smallest (12 refs) and didn't produce any single-run flags. Tightest consensus across the three groupings on what's worth surfacing.

---

## Suggested rule for filtering the merged review

Based on this run alone (caveat: small sample), a reasonable cutoff for what to surface to a city reviewer:

- **Always include**: 5/5 detection refs, regardless of status (high inter-run agreement)
- **Include with high confidence**: 4/5 and 3/5 detection refs, especially when ≥1 run says `fail`
- **Include with caveat**: 2/5 detection refs — surface but flag as "minority signal"
- **Default-filter**: 1/5 detection refs (single-run flags), unless the one run says `fail` with strong reasoning. The 13 single-run `not-verifiable` refs in grouping 1 are noise; the one single-run `fail` (`1:EL-1.36`) is worth a manual look.

Operationally, for THIS review:
- 27 refs (5/5 + 4/5) → high-confidence merged comments (32% of total)
- 35 refs (3/5 + 2/5) → include with reviewer judgment
- 22 refs (1/5) → default-filter; flag the 1 `fail` for manual review

After the data-loss-bug fix counterfactual (see report.md), the high-confidence tier grows to 42 refs (50%), and the 1/5 tier shrinks to 14.

---

## Open questions for higher-N experiments

The 5-run sample is too small to distinguish "1/5 = 20% probability of being real" from "1/5 = 5% probability of being real". At `runs=10`:

- Refs that were 1/5 in this run: would they go to 1/10 (lower end) or 3/10 (higher)?
- Refs that were 4/5: would they go to 8/10, 7/10, or 9/10?
- The shape of the detection-rate distribution over many refs would tell us how stable inter-run agreement is, and whether the existing detection rate is a reliable proxy for issue truth.

This is the question the variance experiment was originally set up to answer. Once the persistence bug is fixed (so the data isn't corrupted), `runs=10` would let the curve speak.
