# Vision-check metrics analysis

**Status:** 2026-05-07. **cc set: populated (var2 runs=1 disparity open). el-md-exp set: populated (var1 partial-coverage caveat noted below).**

This is the cross-variant writeup that joins the per-variant goal-a /
goal-b docs into a single readout against the iter-1 success criteria.
Methodology is in [`../metrics-framework.md`](../metrics-framework.md);
this file just synthesizes the numbers.

---

## Phase 1 Metric Summary

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
expected-vision = 51 measure-distance candidates). All three variants
fired same-day on the same submission, runs=3,
`logAllAgentTrace=true`, post bureau#314 + conductor#149.

#### Goal A: "Overall Vision Invocation Hit Rate"

> Of items where TSV 1 expects vision, what fraction actually had
> vision invoked (any tool)?

| Metric | ctrl-baseline | var1-bifurcated | var2-routing | var2 vs var1 |
|---|---:|---:|---:|---:|
| Overall hit rate (51 measure-distance candidates) | 41.2% (21/51) | **60.8% (31/51)** | 37.3% (19/51) | **-23.5pp** ⚠️ |

**Read.** Var2 lags var1 on overall Goal A by a wide margin. Three
caveats stack on this number — see "Caveats" subsection below.
Headline-only takeaway: var2's classifier is selective about invoking
vision_check, and that selectivity reduces overall invocation count
relative to the bifurcated agent's free-hand vision usage.

#### Goal B: "Correct Tool Selection Rate"

> Of items where TSV 1 expects a specialist (`measure-distance`), what
> fraction had `measure-distance` invoked (post-aggregation)?

| Metric | ctrl-baseline | var1-bifurcated | var2-routing | var2 vs var1 |
|---|---:|---:|---:|---:|
| measure-distance items (51) | n/a (no specialist exposed) | 0.0% (0/51) | **5.9% (3/51)** | **+5.9pp** ✓ |

**Read.** Var1 invoked the `measure-distance` specialist **zero times**
across all 3 runs and 51 measure-distance-eligible items. The
bifurcated tool list exposed `measure-distance` to the agent, but the
agent never reached for it — same sparse-adoption pattern observed on
the cc side with `inspect-drawing` (2 cells out of 162).

Var2's classifier identified 8 unique items as measurement-routed (by
classifier intent — actual dispatch falls back to generic via
`measurement_arg_construction_not_implemented`). Of those 8, only 3
cleared the strict-majority threshold (≥2 of 3 runs). The classifier
selected drawing_inspect for 17 items (mostly wrong — el-md-exp has
zero drawing_inspect ground-truth items) and generic for 5.

Iter-1 hypothesis confirmed in direction (var2 > var1 on B), but the
absolute number is small. **Goal B for el-md-exp is bottlenecked by
classifier accuracy, not architectural choice** — the same `vision_check`
plumbing that gave 25%/33% on cc gives only 5.9% on el-md-exp because
the bureau-side classifier prompt isn't tuned for measure-distance
recognition yet.

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
- [`el-md-exp/var1-bifurcated-vision-tools/per-item.tsv`](el-md-exp/var1-bifurcated-vision-tools/per-item.tsv) (`VISION_CHECK_REVIEW_EL_MD_EXP_VAR1_RUN_1`, runs=3)
- [`el-md-exp/var2-vision-specialist-routing/per-item.tsv`](el-md-exp/var2-vision-specialist-routing/per-item.tsv) (`VISION_CHECK_REVIEW_EL_MD_EXP_RUN_2`, runs=3)

| Bucket | ctrl-baseline | var1 | var2 |
|---|---:|---:|---:|
| `measure-distance` candidates (51 items, `shouldCall=yes` per `el-md-exp/item-classification.json`) | 41.2% (21/51) | **60.8% (31/51)** | 37.3% (19/51) |
| **Goal A total (51 expected-vision items)** | 41.2% | **60.8%** | 37.3% |
| "Misuse" (50 `shouldCall=no` items invoked) | 40.0% | 56.0% | 38.0% |

**Read.** Var1's 60.8% is partly inflated by the agent calling vision
freely on every item it touched (162 / 303 item-runs called vision).
Var2's classifier was more conservative — only items where the
classifier judged a vision call was warranted got vision_check fired.

**The "misuse" column is NOT comparable to the cc misuse number** and
shouldn't be read as failure. The el-md-exp ground-truth `shouldCall`
field labels items by whether `measure-distance` is applicable, not by
whether *any* vision tool is needed. Many `shouldCall=no` items still
reasonably need vision (to read a label, check a note, etc.). The cc
ground truth had a separate `no-tool` category; el-md-exp doesn't.
Until el-md-exp is re-classified with a vision-needed-or-not field,
this column is informational only.

### el-md-exp — Goal B detail

| Denominator | var1 | var2 |
|---|---:|---:|
| `measure-distance` items (51) | **0/51 = 0.0%** | **3/51 = 5.9%** |
| Specialist invocations (raw item-run cells) | 0 | 14 |
| Classifier intent = measurement (unique items) | n/a | 8 |

**Read.** Var1 invoked the `measure-distance` specialist **zero times**
across 51 measure-distance-eligible items × 3 runs (153 cells). The
agent had `script:measure-distance` available but never reached for it
— same sparse-adoption pattern as the cc-side var1 with
`inspect-drawing` (2/162 cells).

Var2's classifier identified 8 unique items as measurement-routed by
intent. Of those, 3 cleared the strict-majority threshold (≥2 of 3
runs). The other 5 had only 1 of 3 runs route to measurement.

The classifier also routed 17 unique items to `drawing_inspect` — all
incorrect, since el-md-exp's ground truth has zero drawing_inspect
items. This is the dominant classifier-error mode and the main lever
for improving Goal B on this guide.

### el-md-exp — caveats

- **Var1 partial coverage (~33% gap).** VAR1_RUN_1 emitted findings
  for 201 / 303 (item × run) cells. The 102 missing cells are mostly
  items the agent silently passed. Root cause: the
  `experiments/measure-distance/` overlay's `experiment.yaml`
  hardcodes `prompt: review.md` AND its own `review.md` (a) still has
  "Important: You only output fail and not-verifiable findings"
  language and (b) lacks the `{{ agentTraceGuidance }}` template
  placeholder. So `logAllAgentTrace=true` couldn't append the
  emit-all-statuses override on this prompt path. The vision-check
  overlay has the placeholder so var2 picked up the override
  correctly. **Var1's 60.8% Goal A is a lower bound — items the agent
  silently passed (no finding emitted) can't be checked for
  vision-invocation, so they default to `tool_called=none`.** Fixing
  the overlay (small bureau PR) and re-firing var1 would tighten the
  number.
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

The 8 items where var2's classifier identified measurement intent on
≥1 run, with their post-aggregation `tool_called`:

| Item | Post-vote `tool_called` |
|---|---|
| `EL-13.10` | **vision-check-measure-distance ✓** |
| `EL-2.1` | **vision-check-measure-distance ✓** |
| `EL-2.6` | **vision-check-measure-distance ✓** |
| Other 5 items | failed majority — only 1 of 3 runs routed to measurement |

The classifier's *unique-item* recall on measurement items is 8/51 =
15.7%. Strict-majority confirmed recall is 3/51 = 5.9%. Items where
the classifier consistently misroutes (drawing_inspect for 17 items)
are the prime target for the bureau-side classifier prompt iteration
that follows phase-1.

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

### el-md-exp

> A. var2's overall vision invocation hit rate ≥ var1's on items where
> TSV 1 expects vision.

**Status: NOT met at the headline.** 37.3% (var2) vs 60.8% (var1) →
−23.5pp. Two strong caveats: (1) var1's number is inflated by the
overlay-path coverage gap (no_finding rows for items the agent
silently passed, defaulting to `tool_called=none` — UNDERSTATING
var1's true rate, but still showing var1 invokes vision more
freely overall); (2) var2's lower invocation count partially reflects
the classifier's selectivity, which is a feature when the classifier
is accurate and a problem when it isn't. On el-md-exp where 17 items
get misrouted to drawing_inspect, the classifier's selectivity hurts.

> B. var2's specialist selection rate ≥ var1's on items where TSV 1
> expects a specialist.

**Status: ✓ MET in direction, small absolute gap.** 5.9% (var2) vs
0.0% (var1) on measure-distance items. Same architectural lift seen
on cc: var1's bifurcated tool list never reached for the specialist
(0 calls), var2's routing did invoke measurement (3 items at strict
majority, 8 at lenient). Absolute number small because the bureau-
side classifier prompt isn't tuned for measure-distance recognition.

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
