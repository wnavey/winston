# Vision-check metrics analysis

**Status:** 2026-05-08 (evening). **cc set: populated (var2 runs=1 disparity open). el-md-exp set: populated post 2026-05-08 re-fires (var1 partial-coverage retired; var2 classifier-misroute retired). RUN_6_BACKUP_LOCAL replaces RUN_3 as the canonical var2 source — first run where measure-distance actually executes end-to-end (post bureau#324 + conductor#153/#154 fixes). Goal B numbers are within single-run noise of RUN_3; the new headline is the verdict-conversion lift — see [`var2-uplift.md`](./var2-uplift.md).**

This is the cross-variant writeup that joins the per-variant goal-a /
goal-b docs into a single readout against the iter-1 success criteria.
Methodology is in [`../metrics-framework.md`](../metrics-framework.md);
this file just synthesizes the numbers.

---

## Phase 1 Metric Summary

### TL;DR

| | cc set | el-md-exp set |
|---|---|---|
| **Goal A** (var2 ≥ var1 overall) | NOT met (40.9% vs 44.8%, runs disparity confound open) | NOT met (37.3% vs 74.5%, var2 runs=1 disparity open) — but var2 is *much* more selective: 20% misuse vs var1's 70% |
| **Goal A** (var2 ≥ var1, must-call bucket) | ✓ MET (50.0% vs 37.5%, +12.5pp) | n/a (no must-call/optional split for el-md-exp) |
| **Goal B** (var2 ≥ var1) | ✓ MET (25.0% vs 0.0%, +25.0pp) | ✓ MET (13.7% vs 0.0%, +13.7pp) |
| **Goal B'** (intent + specialist actually executed) | ✓ MET (specialist execution worked since cc var2's first fire) | ✓ MET — **first run where it works** (13.7% vs 0.0%, +13.7pp). Pre-fix runs all had B' = 0%. |
| **Verdict-conversion lift** (ctrl `not-verifiable` → real verdict) | n/a (cc has different verdict shape) | **6 of 8 items moved** (75%) — 4 pass, 2 fail. See [`var2-uplift.md`](./var2-uplift.md). |

**Architectural conclusion holds on both sets:** the bifurcated tool
list (var1) reaches for the specialist ~0 times even though it's
exposed; the routing architecture (var2) lifts specialist invocation
to a non-zero rate (25–33% on cc, 13.7% on el-md-exp). The Goal A
trade-off is real — var2 trades broad coverage for selective coverage
— and is governed by classifier accuracy.

**The new headline (RUN_6_BACKUP_LOCAL, post bureau#324 + conductor#153/#154):**
the el-md-exp measure-distance chain now executes end-to-end. Goal B'
matches Goal B (every measure-distance subprocess succeeded), and 6 of
the 8 expected-measure-distance items the chain ran on **moved from
ctrl's `not-verifiable` verdict to a real pass/fail determination**.
Two of those were `fail` — concrete compliance deficiencies the ctrl
baseline would have left for human follow-up. See [`var2-uplift.md`](./var2-uplift.md)
for the dedicated story.

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

Source: Valley View Townhomes v1, `el-md-exp` guide (101 items, 51
expected-vision = 51 measure-distance candidates). ctrl + var1 are
runs=3; **var2 is now `RUN_6_BACKUP_LOCAL` at runs=1** (post bureau#324
+ conductor#153 + conductor#154 — first var2 run where measure-distance
actually executes end-to-end, see [`var2-uplift.md`](./var2-uplift.md)
for the dedicated story). The runs=1 disparity is acknowledged below
and on the cloud runs=3 re-fire follow-up; the headline numbers move
within single-run noise vs RUN_3.

#### Goal A: "Overall Vision Invocation Hit Rate"

> Of items where TSV 1 expects vision, what fraction actually had
> vision invoked (any tool)?

| Metric | ctrl-baseline | var1-bifurcated | var2-routing | var2 vs var1 |
|---|---:|---:|---:|---:|
| Overall hit rate (51 measure-distance candidates) | 41.2% (21/51) | **74.5% (38/51)** | 37.3% (19/51) | **-37.2pp** |
| Misuse (50 `shouldCall=no` items invoked) | 40.0% | 70.0% | **20.0%** | -50.0pp |

**Read.** Var1 still wins overall Goal A by a wide margin, but with
the same selectivity trade-off as before — var1 invokes vision on 70%
of items where the labels say it isn't needed. Var2 is more
disciplined (20% misuse). The runs=1 ceiling lowers var2's coverage
vs RUN_3's 47.1% (47/51 → 19/51); a runs=3 cloud re-fire is on the
follow-up list. The selectivity story is unchanged — var2 trades
broad coverage for selective coverage, not raw capability.

#### Goal B: "Correct Tool Selection Rate"

> Of items where TSV 1 expects a specialist (`measure-distance`), what
> fraction had `measure-distance` invoked?

| Metric | ctrl-baseline | var1-bifurcated | var2-routing | var2 vs var1 |
|---|---:|---:|---:|---:|
| Goal B (classifier intent = measurement) | n/a | 0.0% (0/51) | **13.7% (7/51)** | **+13.7pp** ✓ |
| **Goal B' (intent + measure-distance subprocess actually succeeded)** | n/a | **0.0%** (specialist never invoked) | **13.7% (7/51)** | **+13.7pp** ✓ |

**Read.** Goal B confirmed; the new framing is **Goal B'**, which adds
the requirement that the measure-distance subprocess actually ran and
returned ≥1 distance. Pre-fix, every var2 run had Goal B' = 0% because
the dispatch chain crashed before the specialist ever produced output.
RUN_6_BACKUP_LOCAL is the first run where Goal B = Goal B' — every
classifier-intent-measurement that produced extracted pairs ran
measure-distance to completion (8 subprocess invocations, 24/24 pair
measurements computed).

Var1 still invokes `measure-distance` **zero times** across all 51
candidates × 3 runs (153 cells). The bifurcated tool list exposed
`measure-distance` to the agent, but the agent never reached for it —
same sparse-adoption pattern as cc var1's `inspect-drawing` (2/162).

#### Verdict-conversion lift (new in RUN_6_BACKUP_LOCAL)

The phase-1 framework only asked "is the right specialist invoked." With
the chain now executing end-to-end, we can also report what the
specialist did to the *finding verdict* on items where it ran. The
question is: did measure-distance convert ctrl's `not-verifiable`
verdicts into actionable pass/fail?

**6 of 8 items (75%) escaped ctrl's `not-verifiable` majority verdict
in RUN_6_BACKUP_LOCAL** — 4 to `pass`, 2 to `fail`. The 2 `fail` items
(EL-1.14, EL-1.37) are real compliance deficiencies the ctrl baseline
would have left for a human reviewer to follow up on. Full per-item
table and sample distances in [`var2-uplift.md`](./var2-uplift.md) and
[`../source-runs/el-md-exp/var-2/compare-vs-ctrl.md`](../source-runs/el-md-exp/var-2/compare-vs-ctrl.md).

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

### el-md-exp — Per-measure-distance-item routing detail (var2)

The 8 items where var2's classifier picked measurement intent and
cleared the strict-majority threshold post-aggregation:

| Item | Post-vote `tool_called` |
|---|---|
| `EL-1.1` | **vision-check-measure-distance ✓** |
| `EL-1.9` | **vision-check-measure-distance ✓** |
| `EL-2.1` | **vision-check-measure-distance ✓** |
| `EL-2.3` | **vision-check-measure-distance ✓** |
| `EL-13.1` | **vision-check-measure-distance ✓** |
| `EL-13.10` | **vision-check-measure-distance ✓** |
| `EL-13.13` | **vision-check-measure-distance ✓** |
| `EL-13.14` | **vision-check-measure-distance ✓** |

12 unique items had measurement intent in `RUN_3`; 8 cleared majority,
4 had only 1 of 3 runs route to measurement. The classifier's
unique-item recall on measure-distance items is 12/51 = 23.5%
(strict-majority 15.7%).

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

### el-md-exp (post 2026-05-08 re-fires)

> A. var2's overall vision invocation hit rate ≥ var1's on items where
> TSV 1 expects vision.

**Status: NOT met at the headline.** 47.1% (var2) vs 74.5% (var1) →
−27.4pp. Both runs now have full coverage so this is a real gap, not
a measurement artifact. Interpretation: var2's classifier-gated
architecture is much more selective than var1's free-hand vision
usage. Var1 invokes vision on 70% of `shouldCall=no` items vs var2's
22% — selectivity is the actual differentiator, not capability. If
overall coverage is what's prioritized, var1 wins. If precision
within invocations is prioritized, var2 wins.

> B. var2's specialist selection rate ≥ var1's on items where TSV 1
> expects a specialist.

**Status: ✓ MET, lift confirmed.** 15.7% (var2) vs 0.0% (var1) on
measure-distance items. Var1's bifurcated tool list never reached
for the specialist (0 calls in 153 cells). Var2's classifier routed
8 items to measurement on a strict majority of runs (was 3 in RUN_2 —
nearly **3x lift** from the `RUN_2 → RUN_3` re-fire alone). The
measurable effect of the allow-list-aware classifier prompt is the
27 prior drawing_inspect misroutes redistributing into measurement
and generic, recovering routing capacity that the prior run wasted
on impossible specialists.

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
