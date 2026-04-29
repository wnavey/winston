# 1700 S. Lamar — Completeness-Check Variance Report

**Review ID:** `6ec3acdf-737b-47b2-8191-49b376ea3404`  
**Workflow run:** `8b6a8f2b-e387-4593-9abc-b219adfcdf6c`  
**Project:** `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` — 1700 S. Lamar Blvd.  
**Checklist version:** `v2.5-trimmed`  
**Runs config:** `runs=3` (cross-run majority voting)  
**Run completed:** `2026-04-28 17:29 UTC`

**Companion deep-dives:**
- [`high-variance-items-analysis.md`](./high-variance-items-analysis.md) — top-10 split refs, per-run agent traces, hypotheses
- [`gap-items-analysis.md`](./gap-items-analysis.md) — all 18 detection-variance refs (spoiler: it's run-2 checklist drift)
- [`run-2-drift-root-cause.md`](./run-2-drift-root-cause.md) — log-traced root cause of the run-2 drift: harness-induced post-compaction overwrite of a successful StructuredOutput call

---

## Executive summary

This is a 3-run smoke test of variance analysis on the completeness-check workflow. Of 198 checklist refs evaluated, **155 (78.3%) were unanimous** across all three runs. The remaining 43 refs split into two distinct failure modes:

- **Verdict variance** (25 refs, 12.6%): runs disagreed on the final status (`pass` / `fail` / `not-applicable`).
- **Detection variance** (18 refs, 9.1%): some runs produced **no finding at all** for the ref. The model agrees on the verdict when it does evaluate, but doesn't reliably evaluate every time.

### Headlines

1. **All 18 detection-variance refs are in `cc-13` (Architecture Worksheet).** The merged review reports a verdict for these items, but it's based on a single run's output 13 times and on two of three runs 5 times. With `runs=3` this is already a single-point-of-failure for nearly half the AW sheet.
2. **24 of 25 split-verdict refs are 2-1 splits** — i.e. flipping one run's vote would change the winning verdict. Confidence on these is medium or low. They are the natural targets for the planned `runs=10` experiment.
3. **Two distinct disagreement kinds.** 14 refs are `fail`-vs-`pass` (the model can't decide whether the requirement is *met*); 10 are `n/a`-vs-something (the model can't decide whether the rule *applies*). These have different remediations: the first is checklist-prompt clarity; the second is checklist-applicability scoping.
4. **One three-way split:** `cc-23:CC-23-07` voted `fail` / `not-applicable` / `pass` across the three runs (entropy 1.585 bits — maximum possible). The merged review reports `fail` with low confidence; that result is essentially a coin flip.

### High-variance concentration by grouping

Variance is highly concentrated. Three groupings account for almost all of it:

| Grouping | Description | Refs | Split | Detection | Variance rate |
|---|---|---:|---:|---:|---:|
| `cc-13` | Architecture Worksheet (AW) | 50 | 11 | 18 | 58% |
| `cc-22` | Tree Plan / Protection | 14 | 6 | 0 | 43% |
| `cc-23` | Landscape Plan | 11 | 3 | 0 | 27% |
| `cc-24` | Lighting Plan | 9 | 2 | 0 | 22% |
| `cc-1` | General Submittal | 33 | 1 | 0 | 3% |
| `cc-15` | Drainage / Water Quality | 14 | 1 | 0 | 7% |
| `cc-3` | Site Plan Cover Sheet | 11 | 1 | 0 | 9% |
| `cc-10` | Site Plan Notes | 4 | 0 | 0 | 0% |
| `cc-19` | Utility Plan | 22 | 0 | 0 | 0% |
| `cc-2` | Vicinity / Project Identification | 6 | 0 | 0 | 0% |
| `cc-20` | Erosion & Sedimentation | 7 | 0 | 0 | 0% |
| `cc-5` | Existing Conditions | 14 | 0 | 0 | 0% |
| `cc-6` | Demolition / Tree Survey | 3 | 0 | 0 | 0% |

- **`cc-13`** (Architecture Worksheet) is the dominant source of variance: 11 of 25 split refs *and* 100% of detection variance live here. AW items are check-by-check lookups across a structured form sheet — the model appears to skip them inconsistently.
- **`cc-22`** (Tree Plan) has the highest split *rate* — 6 of 14 refs (43%) had run disagreement. Smaller absolute numbers but proportionally the noisiest grouping.
- **`cc-23`** (Landscape Plan) carries the only 3-way split and 27% split rate. Together with cc-22, the landscape/trees pages look like a real ambiguity hotspot.

### Where to focus

**For the planned `runs=10` experiment:** prioritize cc-13, cc-22, cc-23. With more samples per ref the entropy estimate stabilizes and we can distinguish "genuinely 50/50" refs from "unlucky 2-1" refs. The 18 cc-13 detection-variance refs are particularly useful because they let us measure detection probability directly (e.g. AW-09 was detected 1/3 times — does that hold at 3/10? 7/10?).

**For checklist authoring (independent of N):**

- **Verdict-disagreement refs** (14 fail-vs-pass + 1 3-way) suggest the pass/fail criteria for that item are ambiguous in the prompt or underspecified in the checklist. Manual re-reading of the prompt + a few sample findings is the right next step.
- **Applicability-disagreement refs** (10 n/a-vs-something) suggest the rule's applicability gate is ambiguous. Different remediation: tighten the "this rule applies when…" preamble in the checklist row.
- **Detection-variance refs** (all in cc-13) suggest the workflow is missing a pre-pass that enumerates every AW row before review, or that AW row prompts vary in obviousness. Worth instrumenting whether the run-level pipeline iterates over all rows or relies on the model to discover them.

## Variance class distribution

| Class | Count | % |
|---|---:|---:|
| unanimous | 155 | 78.3% |
| partial-detection | 18 | 9.1% |
| split-verdict | 25 | 12.6% |
| split-and-partial | 0 | 0.0% |
| no-findings | 0 | 0.0% |

## Split-verdict refs by disagreement kind

| Kind | Count | Interpretation |
|---|---:|---|
| `fail+pass` | 14 | model disagrees on whether requirement is met |
| `pass+n/a` | 8 | model disagrees on whether the rule applies |
| `fail+n/a` | 2 | model disagrees on whether the rule applies (and would fail if it did) |
| `3-way` | 1 | all three states — maximum ambiguity |

## Per-run status patterns (all 198 refs)

Multiset of run statuses, sorted; commas separate the per-run votes.

| Pattern | Count |
|---|---:|
| `pass,pass,pass` | 94 |
| `not-applicable,not-applicable,not-applicable` | 53 |
| `fail,pass,pass` | 10 |
| `pass` | 9 |
| `fail,fail,fail` | 8 |
| `not-applicable,not-applicable,pass` | 4 |
| `not-applicable` | 4 |
| `not-applicable,pass,pass` | 4 |
| `fail,fail,pass` | 4 |
| `pass,pass` | 3 |
| `not-applicable,not-applicable` | 2 |
| `fail,fail,not-applicable` | 1 |
| `fail,not-applicable,pass` | 1 |
| `fail,not-applicable,not-applicable` | 1 |

## Notable refs

### The 3-way split

- **`cc-23:CC-23-07`** (Landscape Plan): votes split `fail` / `not-applicable` / `pass` across the three runs. Winning verdict: `fail` (low confidence). Entropy: 1.585 bits. Treat the merged verdict as unreliable.

## Full table — every ref by grouping

Every checklist ref evaluated, grouped by checklist grouping. `Pattern` is the multiset of statuses across the three runs (sorted). `Detect` shows the fraction of runs that produced a finding (3/3 = always detected).

### `cc-1` — General Submittal  
_33 refs · 32 unanimous · 1 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-1:CC-1-02` | 3/3 | `fail,fail,pass` | fail | medium | **split** | 0.9183 |
| `cc-1:CC-1-01` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-03` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-04` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-05` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-06` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-08` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-09` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-10` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-11` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-12` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-13` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-14` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-15` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-16` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-17` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-18` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-19` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-20` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-21` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-22` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-23` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-24` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-25` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-26` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-1:CC-1-27` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-28` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-29` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-30` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-31` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-32` | 3/3 | `fail,fail,fail` | fail | high | unanim | 0.0 |
| `cc-1:CC-1-34` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-1:CC-1-41` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |

### `cc-10` — Site Plan Notes  
_4 refs · 4 unanimous · 0 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-10:AE-01` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-10:AE-02` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-10:AE-03` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-10:AEGB-02` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |

### `cc-13` — Architecture Worksheet (AW)  
_50 refs · 21 unanimous · 11 split-verdict · 18 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-13:AW-05` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-13:AW-14` | 3/3 | `not-applicable,not-applicable,pass` | not-applicable | medium | **split** | 0.9183 |
| `cc-13:AW-18` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-13:AW-23` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-13:AW-30` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-13:AW-31` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-13:AW-32` | 3/3 | `not-applicable,not-applicable,pass` | not-applicable | medium | **split** | 0.9183 |
| `cc-13:AW-33` | 3/3 | `not-applicable,not-applicable,pass` | not-applicable | medium | **split** | 0.9183 |
| `cc-13:AW-36` | 3/3 | `not-applicable,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-13:AW-37` | 3/3 | `not-applicable,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-13:AW-45` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-13:AW-09` | 1/3 | `pass` | pass | low | **detect** | 0.0 |
| `cc-13:AW-15` | 1/3 | `pass` | pass | low | **detect** | 0.0 |
| `cc-13:AW-17` | 1/3 | `pass` | pass | low | **detect** | 0.0 |
| `cc-13:AW-24` | 1/3 | `pass` | pass | low | **detect** | 0.0 |
| `cc-13:AW-26` | 1/3 | `pass` | pass | low | **detect** | 0.0 |
| `cc-13:AW-34` | 1/3 | `not-applicable` | not-applicable | low | **detect** | 0.0 |
| `cc-13:AW-35` | 1/3 | `not-applicable` | not-applicable | low | **detect** | 0.0 |
| `cc-13:AW-42` | 1/3 | `not-applicable` | not-applicable | low | **detect** | 0.0 |
| `cc-13:AW-43` | 1/3 | `not-applicable` | not-applicable | low | **detect** | 0.0 |
| `cc-13:AW-44` | 1/3 | `pass` | pass | low | **detect** | 0.0 |
| `cc-13:AW-50` | 1/3 | `pass` | pass | low | **detect** | 0.0 |
| `cc-13:AW-51` | 1/3 | `pass` | pass | low | **detect** | 0.0 |
| `cc-13:AW-52` | 1/3 | `pass` | pass | low | **detect** | 0.0 |
| `cc-13:AW-19` | 2/3 | `pass,pass` | pass | medium | **detect** | 0.0 |
| `cc-13:AW-38a` | 2/3 | `not-applicable,not-applicable` | not-applicable | medium | **detect** | 0.0 |
| `cc-13:AW-38b` | 2/3 | `pass,pass` | pass | medium | **detect** | 0.0 |
| `cc-13:AW-39` | 2/3 | `not-applicable,not-applicable` | not-applicable | medium | **detect** | 0.0 |
| `cc-13:AW-49` | 2/3 | `pass,pass` | pass | medium | **detect** | 0.0 |
| `cc-13:AW-01` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-02` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-03` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-06` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-07` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-13:AW-08` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-10` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-11` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-12` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-13` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-16` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-20` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-21` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-22` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-25` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-27` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-28` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-29` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-41` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-13:AW-46` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-13:AW-53` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |

### `cc-15` — Drainage / Water Quality  
_14 refs · 13 unanimous · 1 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-15:CC-15-08` | 3/3 | `not-applicable,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-15:CC-15-01` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-15:CC-15-02` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-15:CC-15-04` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-15:CC-15-05` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-15:CC-15-06` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-15:CC-15-07` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-15:CC-15-09` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-15:CC-15-10` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-15:CC-15-11` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-15:CC-15-12` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-15:CC-15-13` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-15:CC-15-14` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-15:CC-15-15` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |

### `cc-19` — Utility Plan  
_22 refs · 22 unanimous · 0 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-19:CC-19-01` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-02` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-19:CC-19-03` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-04` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-05` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-06` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-07` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-08` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-09` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-10` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-11` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-12` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-13` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-14` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-15` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-16` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-17` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-18` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-19` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-20` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-21` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-19:CC-19-22` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |

### `cc-2` — Vicinity / Project Identification  
_6 refs · 6 unanimous · 0 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-2:CC-2-02` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-2:CC-2-14` | 3/3 | `fail,fail,fail` | fail | high | unanim | 0.0 |
| `cc-2:CC-2-16` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-2:CC-2-21` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-2:CC-2-23` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-2:CC-2-24` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |

### `cc-20` — Erosion & Sedimentation  
_7 refs · 7 unanimous · 0 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-20:CC-20-01` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-20:CC-20-02` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-20:CC-20-03` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-20:CC-20-20` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-20:CC-20-21` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-20:CC-20-22` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-20:CC-20-25` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |

### `cc-22` — Tree Plan / Protection  
_14 refs · 8 unanimous · 6 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-22:CC-22-13` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-22:CC-22-14` | 3/3 | `fail,fail,pass` | fail | medium | **split** | 0.9183 |
| `cc-22:CC-22-15` | 3/3 | `fail,fail,not-applicable` | fail | medium | **split** | 0.9183 |
| `cc-22:CC-22-19` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-22:CC-22-20` | 3/3 | `fail,fail,pass` | fail | medium | **split** | 0.9183 |
| `cc-22:CC-22-25` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-22:CC-22-08` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-22:CC-22-12` | 3/3 | `fail,fail,fail` | fail | high | unanim | 0.0 |
| `cc-22:CC-22-17` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-22:CC-22-18` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-22:CC-22-21` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-22:CC-22-27` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-22:OSP-01` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-22:OSP-02` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |

### `cc-23` — Landscape Plan  
_11 refs · 8 unanimous · 3 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-23:CC-23-07` | 3/3 | `fail,not-applicable,pass` | fail | low | **split** | 1.585 |
| `cc-23:CC-23-01` | 3/3 | `fail,fail,pass` | fail | medium | **split** | 0.9183 |
| `cc-23:CC-23-08` | 3/3 | `not-applicable,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-23:CC-23-02` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-23:CC-23-03` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-23:CC-23-04` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-23:CC-23-05` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-23:CC-23-06` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-23:CC-23-09` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-23:CC-23-10` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-23:CC-23-11` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |

### `cc-24` — Lighting Plan  
_9 refs · 7 unanimous · 2 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-24:CC-24-03` | 3/3 | `not-applicable,not-applicable,pass` | not-applicable | medium | **split** | 0.9183 |
| `cc-24:CC-24-16` | 3/3 | `fail,not-applicable,not-applicable` | not-applicable | medium | **split** | 0.9183 |
| `cc-24:CC-24-01` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-24:CC-24-02` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-24:CC-24-04` | 3/3 | `fail,fail,fail` | fail | high | unanim | 0.0 |
| `cc-24:CC-24-05` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-24:CC-24-06` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-24:CC-24-13` | 3/3 | `fail,fail,fail` | fail | high | unanim | 0.0 |
| `cc-24:CC-24-15` | 3/3 | `fail,fail,fail` | fail | high | unanim | 0.0 |

### `cc-3` — Site Plan Cover Sheet  
_11 refs · 10 unanimous · 1 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-3:CC-3-22` | 3/3 | `fail,pass,pass` | pass | medium | **split** | 0.9183 |
| `cc-3:AF-01` | 3/3 | `fail,fail,fail` | fail | high | unanim | 0.0 |
| `cc-3:CC-3-14` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-3:CC-3-17` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-3:CC-3-18` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-3:CC-3-19` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-3:CC-3-21` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-3:CC-3-23` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-3:CC-3-24` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-3:CC-3-26` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-3:CC-3-27` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |

### `cc-5` — Existing Conditions  
_14 refs · 14 unanimous · 0 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-5:ADR-01` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:ADR-04` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:ADR-05` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:ADR-07` | 3/3 | `fail,fail,fail` | fail | high | unanim | 0.0 |
| `cc-5:ADR-08` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-5:DAT-01` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:DAT-02` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:DAT-03` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:DAT-04` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:DAT-05` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:DAT-06` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:DAT-07` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-5:HCR-01` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |
| `cc-5:HCR-02` | 3/3 | `not-applicable,not-applicable,not-applicable` | not-applicable | high | unanim | 0.0 |

### `cc-6` — Demolition / Tree Survey  
_3 refs · 3 unanimous · 0 split-verdict · 0 detection-variance_

| Ref | Detect | Pattern | Winning | Conf | Class | Entropy |
|---|---:|---|---|---|---|---:|
| `cc-6:CMP-01` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-6:CMP-02` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |
| `cc-6:CMP-03` | 3/3 | `pass,pass,pass` | pass | high | unanim | 0.0 |

## Methodology

The completeness-check workflow ran the review three times in parallel and merged the per-run findings via `cross-run-consolidate-cc.ts`. Each run produces a finding object per checklist ref with a `status` ∈ `{pass, fail, not-applicable, unclear}`; the consolidator emits one merged record per ref with `perRunFindings[]` carrying every run's status.

`variance.py` (in this directory's parent) reads the merged `consolidated-findings.json` and computes per-ref:

- `verdict_entropy` — Shannon entropy in bits over the four status buckets, computed only across runs that returned a finding. 0 = unanimous; 0.918 = 2-vs-1; 1.585 = 3-way.
- `detection_rate` — `runCount / totalRuns`. < 1.0 means at least one run produced no finding for that ref.
- `variance_class` ∈ `{unanimous, partial-detection, split-verdict, split-and-partial, no-findings}` — derived from the two metrics above.

### Caveats

- **N=3 is small.** Every metric here is a point estimate with very wide confidence intervals. A 2-1 split could easily be 50/50, 70/30, or 90/10 in expectation. The right next step is `runs=10` (or higher) so entropy estimates are stable enough to act on.
- The merged-verdict reported in the database is the post-vote result, so downstream consumers see no per-run information today. To make this analysis queryable across reviews, a `review_run_findings` table keyed by `(review_id, run_index, ref)` would be the natural shape — see the parent directory's `README.md`.
- This run uses checklist version `v2.5-trimmed`. Variance attribution is to the (model × prompt × checklist-row) tuple, not to any single component.

