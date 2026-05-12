# Vision-check metrics analysis

**Status:** 2026-05-11. **cc set: populated (var2 runs=1 disparity open). el-md-exp set: populated post 2026-05-08 re-fires (var1 partial-coverage retired; var2 classifier-misroute retired) + the chain-execution validation. `RUN_7_BACKUP_LOCAL_3_RUNS` (runs=3) replaces `RUN_6_BACKUP_LOCAL` (runs=1) as the canonical var2 source — retires the runs-disparity confounder. Goal B nearly doubled vs RUN_3 (15.7% → 27.5%). Goals C (correct tool execution) and D (correct post-result verdict) added explicitly to the framework — C runs at 100% on the B-eligible denominator, D is the iter-2 follow-up. See [`var2-uplift.md`](./var2-uplift.md).**

This is the cross-variant writeup that joins the per-variant goal-a /
goal-b docs into a single readout against the iter-1 success criteria.
Methodology is in [`../metrics-framework.md`](../metrics-framework.md);
this file just synthesizes the numbers.

---

## Phase 1 Metric Summary

### TL;DR

| | cc set | el-md-exp set |
|---|---|---|
| **Goal A** (var2 ≥ var1 overall) | NOT met (40.9% vs 44.8%, runs disparity confound open) | NOT met (20.4% vs 74.5%) — but var2 is *much* more selective: 10.6% misuse vs var1's 70% |
| **Goal A** (var2 ≥ var1, must-call bucket) | ✓ MET (50.0% vs 37.5%, +12.5pp) | n/a (no must-call/optional split for el-md-exp) |
| **Goal B raw** (var2 ≥ var1) | ✓ MET (25.0% vs 0.0%, +25.0pp) | ✓ MET (20.4% vs 0.0%, +20.4pp) |
| **Goal B strict-clear** (denom = items where measurement was clearly the right answer) | n/a yet | **✓ MET — 40.7% (11/27) vs 0.0% (var1)** — headline going forward |
| **Goal C** (conditional on B — specialist returned data) | n/a (need data) | ✅ **100%** on B-eligible denominator (every md subprocess returned ≥1 distance) |
| **Verdict-conversion lift** (ctrl `not-verifiable` → real verdict) | n/a (cc has different verdict shape) | **3 of 10** measurement-routed items with ctrl maj `not-verifiable` moved to a real verdict in RUN_10. Most dramatic: EL-13.21 ctrl unanimous nv → maj `pass`. See [`var2-uplift.md`](./var2-uplift.md). |

**Architectural conclusion holds on both sets:** the bifurcated tool
list (var1) reaches for the specialist ~0 times even though it's
exposed; the routing architecture (var2) lifts specialist invocation
to a non-zero rate (25–33% on cc, **40.7% strict-clear on el-md-exp**).
The Goal A trade-off is real — var2 trades broad coverage for
selective coverage — and is governed by classifier accuracy.

**The headline (post `RUN_10_LOCAL`, post bureau#340 prompt tweak):**
the el-md-exp measure-distance chain executes end-to-end with runs=3
majority-vote aggregation. **Goal B strict-clear is 11/27 = 40.7%** —
+11.3pp over RUN_9's 29.4%. The strict-clear denominator excludes the
17 items with valid skip reasons (n/a, no feature, real verdict
reached without measurement) and the 10 items where the 3 runs
disagreed materially — what remains is the cleanest cut of "items
where measurement was clearly the right answer". On that bucket
var-2 routes correctly **40.7% of the time, vs 0% for both ctrl
(specialist unavailable) and var-1 (specialist exposed but agent
never picks it)**.

Of the 11 items var-2 routed to measurement, **10 had ctrl majority
`not-verifiable`** — the exact dead-end cases the architecture was
built to address. 3 of those moved to a real-verdict majority in
RUN_10 (EL-13.1 → fail, EL-13.16 → n/a, EL-13.21 → pass). The
EL-13.21 flip is especially clean: ctrl unanimous `not-verifiable`
(3/3 runs gave up) → RUN_10 majority `pass` (2 runs computed a real
verdict). See [`var2-uplift.md`](./var2-uplift.md) for the per-item
narrative.

**Goal D (iter-2 follow-up).** 5 of the 10 measurement-routed
nv-majority items stayed maj `not-verifiable` in RUN_10 despite the
chain running (EL-13.10, EL-13.13, EL-13.19, EL-13.22, EL-13.23).
The agent has measurements in hand but isn't escalating to a real
verdict. The post-measurement verdict reasoning is the next
bottleneck — see Goal D definition in
[`../metrics-framework.md`](../metrics-framework.md).

### Completeness Check + Inspect Drawing

Source: 1700 S. Lamar v2, `v2.5-trimmed`. All three variants on the
same submission, all numbers post strict-majority-vote aggregation.

#### Goal A: "Overall Vision Invocation Hit Rate"

> Of items where TSV 1 expects vision, what fraction actually had
> vision invoked (any tool)?

| Metric | ctrl-baseline | var1-bifurcated | var2-routing | var2 vs var1 |
|---|---:|---:|---:|---:|
| Overall hit rate (154 expected-vision items) | 43.5% (67/154) | **44.8% (69/154)** | 40.9% (63/154) | **-3.9pp** ⚠️ |
| `inspect-drawing-required` bucket only (8 items) | 37.5% (3/8) | 37.5% (3/8) | **50.0% (4/8)** | **+12.5pp** ✓ |

**Read.** Var1 is slightly ahead overall, but var2 dominates on the
must-call inspect-drawing-required bucket where the specialist matters
most. The overall gap is confounded by a runs disparity (var1 ran at
runs=3, var2 at runs=1) — a runs=3 re-fire of var2 is the cleanest way
to retire it before declaring Goal A's outcome.

#### Goal B: "Correct Tool Selection Rate"

> Of items where TSV 1 expects a specialist, what fraction had the
> correct specialist invoked (post-aggregation)?

| Metric | ctrl-baseline | var1-bifurcated | var2-routing | var2 vs var1 |
|---|---:|---:|---:|---:|
| Required only (8 must-call items) | n/a (no specialist exposed) | 0.0% (0/8) | **25.0% (2/8)** | **+25.0pp** ✓ |
| Required + optional (54 items) | n/a | 0.0% (0/54) | **33.3% (18/54)** | **+33.3pp** ✓ |

**Read.** Var2 lifts specialist invocation from 0% to 25–33% on cc.
The 26x raw-cell gap (28 specialist invocations vs 2) is decisive
regardless of aggregation rule. Iter-1 hypothesis confirmed for
cc Goal B.

### Review + Measure Distance Tool

Source: Valley View Townhomes v1, `el-md-exp` guide (101 items, **54**
expected-vision items, all 54 expecting `measure-distance` —
denominators reflect the 2026-05-12 expected.tsv reclassification of
EL-13.21/22/23). All three variants runs=3 (var2 = `RUN_10_LOCAL`,
local conductor execution post bureau#340 prompt tweak +
conductor#155/#156). See [`var2-uplift.md`](./var2-uplift.md) for the
dedicated story.

#### Goal A: "Overall Vision Invocation Hit Rate"

> Of items where TSV 1 expects vision, what fraction actually had
> vision invoked (any tool)?

| Metric | ctrl-baseline | var1-bifurcated | var2-routing | var2 vs var1 |
|---|---:|---:|---:|---:|
| Overall hit rate (54 measure-distance candidates) | 41.2% (~22/54) | **74.5% (40/54)** | 20.4% (11/54) | **-54.1pp** |
| Misuse (47 `shouldCall=no` items invoked) | ~40% | ~70% | **10.6% (5/47)** | -59.4pp |

**Read.** Var1 wins overall Goal A by a wide margin, with the usual
selectivity trade-off — var1 invokes vision on ~70% of items where
the labels say it isn't needed; var2 is at **10.6%** (the
selectivity story is *stronger* now post-bureau#340 — the agent
calls vision less broadly but more accurately). Var-2's headline
overall rate (20.4%) is lower than RUN_9's 14.8% in absolute terms
on the new 54-item denominator because the prompt tweak didn't
broaden vision coverage so much as it sharpened *which kind* of
vision call the agent makes — and Goal B is where that shows.

_Ctrl / var-1 numbers are carried from their last canonical runs and
not yet rebuilt against the new 54/47 denominator split — the
directional read holds but exact pp deltas are approximate._

#### Goal B: "Correct Tool Selection Rate"

> Of items where TSV 1 expects a specialist (`measure-distance`), what
> fraction had `measure-distance` invoked?

We report Goal B in three nested denominators:

| Variant | denominator | calc | rate |
|---|---|---|---|
| **Goal B raw** | all 54 expected-md items | 11/54 | **20.4%** |
| **Goal B adjusted** (drop 17 valid-skip rows) | items where vision wasn't legitimately skippable | 11/37 | **29.7%** |
| **Goal B strict-clear** (also drop 10 mixed) | items where measurement was clearly the right answer | **11/27** | **40.7% ← headline** |

| Metric | ctrl-baseline | var1-bifurcated | var2-routing | var2 vs var1 |
|---|---:|---:|---:|---:|
| Goal B raw (54 measure-distance items) | n/a | **0.0% (0/54)** | **20.4% (11/54)** | **+20.4pp** ✓ |
| Goal B strict-clear (27 items where md was clearly right) | n/a | **0.0%** (specialist never invoked) | **40.7% (11/27)** | **+40.7pp** ✓ |
| Goal C (conditional on B — specialist returned data) | n/a | n/a | **100%** | n/a |

**Read.** Goal B strict-clear at **40.7%** is the headline going
forward — the denominator most accurately captures the bucket var-2
is built for: items where measurement was clearly the right answer
(not skippable for valid reasons, runs agreed materially). On that
cut, var-2 picks the specialist on 40.7% of items vs 0% for var-1
(specialist exposed but never picked) and 0% for ctrl (specialist
unavailable).

The RUN_9 → RUN_10 lift (29.4% → 40.7% strict-clear) was driven by
bureau#340, a single-line prompt tweak adding "dimensional analysis,
distance computation" to the `vision_check` capability list. No
classifier or specialist code changes — just better hinting to the
agent.

Var1 still invokes `measure-distance` **zero times** across all 54
candidates × 3 runs (162 cells). The bifurcated tool list exposed
`measure-distance` to the agent, but the agent never reached for it —
same sparse-adoption pattern as cc var1's `inspect-drawing` (2/162).

#### Verdict-conversion lift

The phase-1 framework only asked "is the right specialist invoked." With
the chain executing end-to-end, we also report what the specialist
did to the *finding verdict* on items where it ran. The question is:
did measure-distance convert ctrl's `not-verifiable` verdicts into
actionable pass/fail?

**RUN_10 (runs=3, both ctrl and var-2):** 11 items had majority
measurement routing. **10 of those 11** had ctrl majority
`not-verifiable` (5 of those unanimous). In RUN_10:

- **3 moved to a real-verdict majority** (EL-13.1 → maj `fail`,
  EL-13.16 → maj `n/a`, EL-13.21 → maj `pass`).
- **2 broke nv-majority to a 3-way-tie** (EL-13.12, EL-13.7) — partial
  movement; verdict no longer dominated by `not-verifiable`.
- **5 stayed maj `not-verifiable`** despite measurements computed
  (EL-13.10, EL-13.13, EL-13.19, EL-13.22, EL-13.23) — Goal D
  candidates.

**Goal D candidates** (chain ran cleanly but verdict didn't move):
the 5 stuck nv-majority items above. Most stand out: EL-13.22 and
EL-13.23 went from ctrl *unanimous* nv (3/3) to RUN_10 2nv + 1 pass
— measurements landed cleanly in one run but the agent in the other
two still gave up. These are the seed for iter-2's Goal D work — the
agent's post-measurement reasoning is the next lever.

---

## Details

### Methodology snapshot

Per [`../metrics-framework.md`](../metrics-framework.md):

- **3 variants** by tools available to the agent: `ctrl-baseline`
  (vision only), `var1-bifurcated-vision-tools` (vision + direct
  inspect-drawing / measure-distance), `var2-vision-specialist-routing`
  (vision_check only, internal classifier dispatches).
- **Aggregation rule:** strict majority vote across runs
  (`2 × runs_called > runs_total`). Ties fail.
- **Goal A** = `(items vision-invoked majority of runs) / (items where TSV 1 expects vision)`.
- **Goal B** = `(items routed to right specialist majority of runs) / (items where TSV 1 expects a named specialist)`. Specialist routes via vision_check (var2's `vision-check-inspect-drawing`) count as matching.

### cc — Goal A by bucket

Source TSVs:
- [`cc/ctrl-baseline-vision-invocation/per-item.tsv`](cc/ctrl-baseline-vision-invocation/per-item.tsv) (`VISION_CHECK_CC_BASELINE`, runs=3)
- [`cc/var1-bifurcated-vision-tools/per-item.tsv`](cc/var1-bifurcated-vision-tools/per-item.tsv) (`VISION_EXP_INSPECT_DRAWING_RUN_1`, runs=3)
- [`cc/var2-vision-specialist-routing/per-item.tsv`](cc/var2-vision-specialist-routing/per-item.tsv) (`VISION_CHECK_CC_RUN_4`, **runs=1**)

| Bucket | ctrl-baseline | var1 | var2 |
|---|---:|---:|---:|
| `inspect-drawing-required` (8 items) | 37.5% (3/8) | 37.5% (3/8) | **50.0% (4/8)** |
| `inspect-drawing-optional` (46 items) | 54.3% (25/46) | **60.9% (28/46)** | 56.5% (26/46) |
| `generic` / vision-only (100 items) | **39.0% (39/100)** | 38.0% (38/100) | 33.0% (33/100) |
| **Goal A total (154 expected-vision items)** | 43.5% (67/154) | **44.8% (69/154)** | 40.9% (63/154) |
| Misuse (31 no-tool items invoked) | 0.0% | 0.0% | 0.0% |

Var2 trades broader coverage for stronger routing: +12.5pp on
must-call required items, -2.6pp overall, -6pp on generic items.
Misuse stays at zero across all three. The headline -3.9pp gap from
var1 to var2 lives almost entirely in `generic` and
`inspect-drawing-optional`, where var2 was more conservative about
even calling vision — possibly reflecting the "vision_check adds a
quality bar" phenomenon flagged in `experiments/run4/analytics/analysis.md`
(bureau#306 prompt-trim doubled var2 coverage from var3's 31 items
to 63).

### cc — Goal B detail

Goal B isn't computable for ctrl-baseline (no specialist exposed). For
var1 and var2:

| Denominator | var1 | var2 |
|---|---:|---:|
| `inspect-drawing-required` (8 items, must-call) | **0/8 = 0.0%** | **2/8 = 25.0%** |
| Required + optional (54 items) | 0/54 = 0.0% | **18/54 = 33.3%** |
| Specialist invocations (raw item-run cells) | 2 | 28 |
| Conditional B (correct route given invoked, req only) | 0 / 3 = 0% | **2 / 4 = 50.0%** |

**Read.** Var1's specialist usage was so sparse — 2 cells out of 162
inspect-drawing eligible (1.2% raw) — that no item cleared the
strict-majority threshold. Even under the lenient ≥1-run rule, var1
would be 2/8 = 25% on required, exactly tying var2 at strict-majority
— meaning **var2's strict-majority equals or beats var1's most-permissive
aggregation**.

### cc — Per-required-item routing across all 3 variants

The 8 inspect-drawing-required items — every one of these MUST be
investigated with the specialist for full credit. Post-aggregation
`tool_called` per variant:

| Item | ctrl | var1 | var2 |
|---|---|---|---|
| `cc-13:AW-21` | generic-vision | generic-vision | **vision-check-inspect-drawing ✓** |
| `cc-13:AW-23` | generic-vision | generic-vision | **vision-check-inspect-drawing ✓** |
| `cc-13:AW-28` | none | none | none |
| `cc-13:AW-32` | none | none | vision-check-generic ⚠️ (called, wrong route) |
| `cc-13:AW-39` | none | none | none |
| `cc-19:CC-19-05` | none | none | none |
| `cc-19:CC-19-19` | none | none | none |
| `cc-22:CC-22-14` | generic-vision | generic-vision | vision-check-generic ⚠️ (called, wrong route) |

- **Invocation-and-route correct (var2 only):** 2 (AW-21, AW-23)
- **Invocation-only correct (called something):** ctrl 3, var1 3, var2 4
- **Stubborn invocation misses (across all 3 variants):** 4
  (AW-28, AW-39, CC-19-05, CC-19-19) — same 4 flagged in run4
  analysis.md as needing review-guide-level help, not classifier-level

Two distinct failure modes for var2 that var1/ctrl can't have:
- **Route miss (2 items, AW-32 + CC-22-14):** agent invoked
  `vision_check`, but the classifier picked `generic` instead of
  `drawing_inspect`. Fixable on the bureau classifier prompt side.
- **Invocation miss (4 items):** agent never invoked `vision_check` at
  all. Same items var1 and ctrl-baseline also skipped.

### cc — caveats

- **Runs disparity.** Ctrl-baseline + var1 ran at `runs=3`; var2 ran
  at `runs=1`. Strict majority threshold is more demanding at runs=3
  (need ≥2 of 3) than at runs=1 (need ≥1 of 1), which subtly favors
  var1 on Goal A overall. **A re-fire of var2 at runs=3 is the cleanest
  way to retire this confounder** before declaring Goal A's outcome.
- **`tools_used` doesn't track inspect-drawing in var1.** Workaround
  used (per-call metadata.json directly). Doesn't affect the count
  but is an open repo-level TODO.
- **Var1 had one "agent contradicted the specialist" case** (AW-23 /
  run-1 in var1 — inspect-drawing returned `yes`, agent overrode with
  vision and finalized `fail`). Doesn't move A or B numbers but flags
  that var1's tool integration was fragile even when invoked.
- **`expected_specialist=inspect-drawing` includes 46 "optional" items**
  where TSV 1 notes "generic also acceptable". B's strict reading
  filters to required-only (8 items); the "required + optional"
  reading is a permissive ceiling.

### el-md-exp — Goal A by bucket

Source TSVs:
- [`el-md-exp/ctrl-baseline-vision-invocation/per-item.tsv`](el-md-exp/ctrl-baseline-vision-invocation/per-item.tsv) (`VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V3`, runs=3)
- [`el-md-exp/var1-bifurcated-vision-tools/per-item.tsv`](el-md-exp/var1-bifurcated-vision-tools/per-item.tsv) (`VISION_CHECK_REVIEW_EL_MD_EXP_VAR1_RUN_2`, runs=3)
- [`el-md-exp/var2-vision-specialist-routing/per-item.tsv`](el-md-exp/var2-vision-specialist-routing/per-item.tsv) (`VISION_CHECK_REVIEW_EL_MD_EXP_RUN_3`, runs=3)

| Bucket | ctrl-baseline | var1 | var2 |
|---|---:|---:|---:|
| `measure-distance` candidates (51 items, `shouldCall=yes` per `el-md-exp/item-classification.json`) | 41.2% (21/51) | **74.5% (38/51)** | 47.1% (24/51) |
| **Goal A total (51 expected-vision items)** | 41.2% | **74.5%** | 47.1% |
| "Misuse" (50 `shouldCall=no` items invoked) | 40.0% | 70.0% | **22.0%** |

**Read.** With var1 partial-coverage retired (all 303 cells emit
findings now), the gap is real and large: var1 invokes vision on
74.5% of measure-distance items vs var2's 47.1%. But var1 *also*
invokes vision on 70% of `shouldCall=no` items (vs var2's 22%) — the
bifurcated agent calls vision much more freely overall. Var2's
classifier-gated approach is more disciplined: when it does fire, it's
on items that more often warrant it.

The new `RUN_3` lifted var2's overall hit rate by +9.8pp vs RUN_2
(37.3% → 47.1%) because the 27 prior drawing_inspect-misroutes (which
all fell back to generic) are gone — the classifier now picks
measurement or generic, both of which dispatch through and count as
invocations.

**The "misuse" column is NOT directly comparable to the cc misuse number**
and shouldn't be read as failure. The el-md-exp ground-truth
`shouldCall` field labels items by whether `measure-distance` is
applicable, not by whether *any* vision tool is needed. Many
`shouldCall=no` items still reasonably need vision (to read a label,
check a note, etc.). The cc ground truth had a separate `no-tool`
category; el-md-exp doesn't. That said, var2's 22% misuse rate is
markedly lower than var1's 70% on the same denominator — the directional
signal (var2 calls vision more selectively) holds.

### el-md-exp — Goal B detail

| Denominator | var1 | var2 |
|---|---:|---:|
| `measure-distance` items (51) | **0/51 = 0.0%** | **8/51 = 15.7%** |
| Specialist invocations (raw item-run cells) | 0 | 27 |
| Classifier intent = measurement (unique items) | n/a | 12 |

**Read.** Var2 lift to 15.7% (was 5.9% in RUN_2) — **~2.6× absolute
improvement** in one re-fire. Eight items now route to
measure-distance on a strict majority of runs. Var1 still invokes
the specialist zero times across 153 cells (51 items × 3 runs).

The classifier reclamation is clean: `RUN_3` had **zero
drawing_inspect classifications** (vs 27 in RUN_2). The new
allow-list-aware prompt scopes the classifier's options, eliminating
the dominant prior failure mode without any prescriptive prompt
content change.

### el-md-exp — caveats (post 2026-05-08 re-fires)

- ✅ **Var1 partial coverage retired.** `VAR1_RUN_2` (post bureau#317)
  emits findings for 303/303 (item × run) cells, all four statuses
  including pass (7) and n/a (72). Goal A var1 is now a real number
  rather than a lower bound.
- ✅ **Var2 classifier-misroute retired.** `RUN_3` (post conductor#151
  + bureau#318) renders the `vision-router.md` with conditional
  `{{#enabledFoo}}…{{/enabledFoo}}` blocks. With `inspect-drawing`
  excluded from the allow-list, the classifier has zero
  drawing_inspect classifications. The post-rendered prompt's sha256
  changed across runs, confirming the new prompt was loaded.
- **Conductor measurement dispatch still falls back to generic** via
  `measurement_arg_construction_not_implemented`. Goal B is computed
  against `classifier.output.problemType` (intent) rather than
  `dispatch.specialistCalled` (post-fallback). This isolates the
  classifier-accuracy signal from the dispatch-chain wiring gap.
- **Var2 per-(item × run) attribution is a hybrid.** Per-run invocation
  ("did vision_check get called for this item in this run?") comes
  from per-finding `agentTrace.tools_used`. Per-item routing intent
  ("which specialist did the classifier pick?") comes from
  `vision-check-calls/<callId>/metadata.json` aggregated per item
  (the metadata doesn't carry runIndex). The classifier is
  approximately deterministic across runs, so the per-item canonical
  intent is a reasonable proxy.
- **"Misuse" denominator includes vision-needed items.** As noted in
  the Goal A read above, el-md-exp's `shouldCall=no` items aren't
  necessarily vision-free.

### el-md-exp — Per-measure-distance-item routing detail (var2, RUN_10)

The 11 items where var2's classifier picked measurement intent on a
strict majority of runs, with their ctrl and RUN_10 verdict
distributions:

| Item | ctrl statuses | ctrl maj | RUN_10 statuses | RUN_10 maj | movement |
|---|---|---|---|---|---|
| `EL-13.1`  | nv, nv, fail | not-verifiable | fail, pass, fail | **fail** | nv → fail ✓ |
| `EL-13.10` | nv, nv, fail | not-verifiable | nv, nv, fail | not-verifiable | no move |
| `EL-13.12` | nv, nv, nv | not-verifiable (unanimous) | nv, fail, pass | 3-way-tie | broke nv |
| `EL-13.13` | nv, nv, nv | not-verifiable (unanimous) | nv, nv, pass | not-verifiable | partial |
| `EL-13.16` | nv, n/a, nv | not-verifiable | n/a, n/a, n/a | **n/a (unanimous)** | nv → n/a ✓ |
| `EL-13.19` | nv, nv, fail | not-verifiable | nv, nv, fail | not-verifiable | no move |
| `EL-13.2`  | nv, n/a, n/a | n/a | n/a, n/a, pass | n/a | minor |
| `EL-13.21` | nv, nv, nv | not-verifiable (unanimous) | nv, pass, pass | **pass** | nv → pass ✓ |
| `EL-13.22` | nv, nv, nv | not-verifiable (unanimous) | nv, nv, pass | not-verifiable | partial |
| `EL-13.23` | nv, nv, nv | not-verifiable (unanimous) | nv, nv, pass | not-verifiable | partial |
| `EL-13.7`  | nv, nv, fail | not-verifiable | pass, fail, n/a | 3-way-tie | broke nv |

**Movement summary on the 10 ctrl-nv-majority items:**
- 3 moved to a real-verdict majority (EL-13.1 fail, EL-13.16 n/a, EL-13.21 pass).
- 2 moved to 3-way-tie (broke nv-majority but no new majority).
- 3 partial (still maj nv but at least 1 run produced a real verdict).
- 2 stayed nv-majority with no movement (EL-13.10, EL-13.19).

The classifier's unique-item recall on measure-distance items is now
**11/54 = 20.4%** raw; strict-clear **11/27 = 40.7%** on the
denominator that excludes valid skips + 3-way-disagreement rows.

---

## Iter-1 success criteria evaluation

### cc

> A. var2's overall vision invocation hit rate ≥ var1's on items where
> TSV 1 expects vision.

**Status: not yet met at the overall headline — but met on the
inspect-drawing-required bucket.** 40.9% (var2) vs 44.8% (var1)
overall. Confounded by runs disparity (var2 was runs=1). On the
must-call required bucket, var2 is +12.5pp ahead. Re-fire var2 at
runs=3 to retire the confounder before declaring.

> B. var2's specialist selection rate ≥ var1's on items where TSV 1
> expects a specialist.

**Status: ✓ MET, decisively.** 25% (var2) vs 0% (var1) on required.
33.3% (var2) vs 0% (var1) on req + optional. Var2's strict-majority
matches var1's most-permissive aggregation. Direction is unambiguous.

### el-md-exp (post RUN_10_LOCAL, post bureau#340)

> A. var2's overall vision invocation hit rate ≥ var1's on items where
> TSV 1 expects vision.

**Status: NOT met at the headline.** 20.4% (var2) vs 74.5% (var1) →
−54.1pp. Var2's classifier-gated architecture is much more selective
than var1's free-hand vision usage. Var1 invokes vision on ~70% of
`shouldCall=no` items vs var2's **10.6%** — the selectivity story is
now even sharper post bureau#340. If overall coverage is what's
prioritized, var1 wins. If precision within invocations is
prioritized, var2 wins decisively.

> B. var2's specialist selection rate ≥ var1's on items where TSV 1
> expects a specialist.

**Status: ✓ MET, lift confirmed and growing.** Goal B raw: **20.4%
(var2) vs 0.0% (var1)** on measure-distance items. Goal B
strict-clear: **40.7% (var2) vs 0.0% (var1)** — the headline number
for "did the variant route correctly when measurement was clearly
the right answer". Var1's bifurcated tool list never reached for the
specialist (0 calls in 162 cells). Var2's classifier routed 11 items
to measurement on a strict majority of runs (was 5 in RUN_9 — bureau#340
prompt tweak doubled the count).

---

## Cross-set synthesis

**Goal B confirms the iter-1 hypothesis on both sets.** The
bifurcated-tools approach (var1) failed to invoke the workflow's
specialist meaningfully on either side (0 / 162 cells on cc, 0 / 153
cells on el-md-exp). The vision_check routing approach (var2) lifted
specialist invocation from ~0% to a non-zero rate on both sides:
25-33% on cc (where the inspect-drawing classifier is well-tuned and
the dispatch chain works end-to-end), 5.9% on el-md-exp (where the
classifier is the bottleneck). The architectural conclusion holds:
**routing strictly outperforms hoping the agent picks the right
direct tool.**

**Goal A is mixed.** Var2 trades coverage for selectivity — better on
cc must-call items (+12.5pp), worse on overall coverage (-3.9pp on cc,
-23.5pp on el-md-exp before caveats). Whether the trade is worth it
depends on what the workflow prioritizes:
- If sparse-but-precise specialist invocations are the goal (the
  iter-1 hypothesis): var2 is the right architecture, and the open
  questions are about classifier tuning + specialist execution.
- If broad invocation coverage is the priority: var1's looser tool
  exposure invokes vision more freely. But it also wastes that
  coverage on items where the specialist would be much more accurate
  than generic vision.

**Recommended phase-2 priorities** (informed by these numbers, not
in this PR):
1. **Bureau classifier prompt iteration for el-md-exp.** The 17-item
   drawing_inspect misroute on el-md-exp is the single biggest lever.
2. **Conductor measurement dispatch wiring** so Goal B execution-
   accuracy is measurable on review.
3. **Re-fire cc var2 at runs=3** to retire the runs-disparity
   confounder on cc Goal A.
4. **Update measure-distance overlay's review.md** so future var1
   review fires emit findings for all statuses (close the partial-
   coverage caveat).
