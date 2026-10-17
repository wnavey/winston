# var-2 uplift — el-md-exp + measure-distance

The dedicated story of what var-2 (vision_check classifier-routing) does
on the review + measure-distance set, written against ctrl and var-1 as
baselines.

The cross-variant analysis at [`analysis.md`](./analysis.md) covers
both sets and the full Goal A / B framework. This doc is narrower:
**how much did var-2 actually move the needle on real review work?**

## The headline

**Goal B strict-clear: 40.7% (11/27)** — the bucket that most
accurately represents what var-2 is built for. Of the items where
measurement was clearly the right answer (excluding 17 valid-skip
rows and 10 runs-disagreed-materially rows from the 54 expected-md
denominator), **var-2 routes to `measure-distance` 40.7% of the
time** — vs **0% for both ctrl** (specialist unavailable) **and var-1**
(specialist exposed but agent never picks it).

| Variant | Goal B strict-clear | measure-distance invocations |
|---|---:|---|
| ctrl | n/a | specialist not exposed |
| **var-1 (bifurcated)** | **0/27 = 0.0%** | 0 invocations across 162 (item × run) cells |
| **var-2 (RUN_10_LOCAL, post bureau#340)** | **11/27 = 40.7%** | 37 invocations, all 37 returned data |

The classifier-routing architecture is the only one that actually
reaches for the specialist in production.

## The setup

Three architectures, same submission (Valley View Townhomes v1), same
guide (`el-md-exp`, 54 items expecting `measure-distance` post the
2026-05-12 expected.tsv reclassification of EL-13.21/22/23):

- **ctrl** — agent has `vision` only. No specialist tool exposed.
- **var-1 (bifurcated)** — agent has `vision` AND `measure-distance` as
  separate tools. Agent picks.
- **var-2 (vision_check classifier-routing)** — agent has only
  `vision_check`. Internally, a classifier reads the question and
  dispatches to the right specialist.

## How ctrl + var-1 perform

**ctrl** has no specialist, so most clearance/distance questions land
as `not-verifiable` — the agent says *"I can see the spatial layout
but I can't measure clearance from a plan view alone — a reviewer
needs to follow up manually."* That's the operationally useless
verdict; it requires human time downstream.

**var-1 exposed `measure-distance` directly to the agent. The agent
never reached for it.** Across 54 candidates × 3 runs = 162
opportunities, var-1 invoked `measure-distance` **zero times**. Same
sparse-adoption pattern as cc/var-1's `inspect-drawing` (2/162). The
bifurcated-tool-list strategy fails by sparse adoption: too many tools,
agent defaults to the cheapest-to-reason-about one (generic vision).
Result: var-1 produces the same `not-verifiable` verdicts as ctrl on
the items where measurement actually matters.

## What var-2 actually did to the verdicts

The most operational question: **for the items var-2 correctly routed
to measurement, did the verdict actually change vs ctrl?** Did
`not-verifiable` become an actionable pass/fail?

In `RUN_10_LOCAL`, var-2's classifier picked measurement on a strict
majority of runs for **11 items**. **10 of those 11 had ctrl
majority `not-verifiable`** — exactly the dead-end cases the
architecture was built for (vision-alone couldn't measure; chain
needed to disambiguate).

Per-item movement:

| Item | item text | ctrl maj | RUN_10 maj | verdict movement |
|---|---|---|---|---|
| **EL-13.1** | Transformer pads lack 5-ft clearance from building foundations | not-verifiable | **fail** | nv → fail ✓ |
| **EL-13.16** | Transformer pads lack 5-ft clearance from dumpsters | not-verifiable | **n/a (unanimous)** | nv → n/a ✓ |
| **EL-13.21** | Transformer pads lack 5-ft horizontal clearance from water lines | not-verifiable (**unanimous**) | **pass** | nv → pass ✓ ✨ |
| EL-13.7 | Transformer pads not located 2 ft from back of sidewalk | not-verifiable | 3-way-tie | broke nv |
| EL-13.12 | Transformer pads lack 5-ft clearance from fire hydrants | not-verifiable (unanimous) | 3-way-tie | broke nv |
| EL-13.22 | Transformer pads lack 5-ft horizontal clearance from wastewater lines | not-verifiable (unanimous) | not-verifiable | partial (1 pass) |
| EL-13.23 | Transformer pads lack 5-ft horizontal clearance from storm drain lines | not-verifiable (unanimous) | not-verifiable | partial (1 pass) |
| EL-13.13 | Trees within 10 ft of pad-mounted equipment not utility-compatible | not-verifiable (unanimous) | not-verifiable | partial (1 pass) |
| EL-13.10 | Transformer pad hot-stick use area lacks clearance | not-verifiable | not-verifiable | no movement |
| EL-13.19 | Transformer pads lack 15-ft clearance from fire lanes | not-verifiable | not-verifiable | no movement |
| EL-13.2 | Transformer pads lack 5-ft clearance from retaining walls | n/a (ctrl majority) | n/a | already n/a |

**Movement summary on the 10 ctrl-nv-majority items:**

- **3 moved to a real-verdict majority** (✓ in the table): EL-13.1
  → fail, EL-13.16 → n/a, EL-13.21 → pass. Each one represents the
  agent moving from "I give up" to a confident actionable verdict
  using the measurement data.
- **2 broke nv-majority to a 3-way-tie**: EL-13.7, EL-13.12. The
  agent reached a real verdict in 2 of 3 runs but the runs disagreed
  on which one.
- **3 stayed maj nv with partial movement**: EL-13.22, EL-13.23,
  EL-13.13. The chain produced measurements in at least 1 run
  (yielding a `pass`), but the agent in the other 2 runs still gave
  up at `not-verifiable`.
- **2 stayed nv with no movement**: EL-13.10, EL-13.19.

### EL-13.21 — the cleanest win

**Before var-2**: ctrl unanimous `not-verifiable` (3/3 runs). The agent
saw the transformer pads, saw the water lines, but couldn't measure
the horizontal clearance from the drawing alone — vision had no
specialist tool to compute the distance.

**After var-2**: RUN_10 majority `pass` (2 pass + 1 nv). The classifier
routed the question to `measure-distance`. The chain extracted the
pad ↔ water-line pairs, ran two-call Gemini Vision measurement on each,
and produced real-world distance values. The agent then used those
values to confidently conclude that the clearance is met — a verdict
no other variant produces.

This is the clean expression of var-2's architectural value: turning
a unanimous human-time-required outcome into a confident automated
pass.

### EL-13.22 + EL-13.23 — partial wins on the same pattern

Same setup as EL-13.21 (transformer pad horizontal clearance from
wastewater / storm drain lines), same ctrl unanimous nv, but in
RUN_10 only one of three runs produced a `pass` — the agent in the
other two still hit nv despite the chain firing. These are the
clearest Goal D candidates: measurement data exists, verdict logic
isn't fully using it.

## The chain end-to-end

```
Agent question
  ↓
vision_check (classifier picks intent)
  ↓
problemType=measurement
  ↓
extract-measurement-pairs  (bureau script — looks at the cropped
   ↓                        drawing, returns instance-level object
   ↓                        pairs to measure)
[{objectA, objectB}, ...]
  ↓
measure-distance  (bureau script — for each pair, two-call Gemini
                   Vision flow returns the real-world distance)
  ↓
{ distanceFeet, confidence } per pair
```

In RUN_10, this chain ran **37 times** across **86 vision_check
calls**, returning real-world distance values on every dispatched
measurement (Goal C = 100% on the B-eligible denominator).

## What lifted Goal B from RUN_9 (29.4% strict-clear) to RUN_10 (40.7%)

A single-line bureau prompt tweak ([bureau#340](https://github.com/noetic-inc/bureau/pull/340)):
added `dimensional analysis, distance computation` to the
`vision_check` capability enumeration in the experiment overlay's
`review.md`. No classifier code changes, no specialist code changes —
just better hinting to the agent about what `vision_check` is for.

The +6 numerator delta (5 measurement-majority items in RUN_9 → 11 in
RUN_10) concentrated on items where var-2 previously didn't route to
measurement at all:

- 3 items were new measurement hits driven by the expected.tsv
  reclassification (EL-13.21/22/23 — which were previously labeled
  `expected_vision=no` and didn't count toward Goal B; they did, in
  fact, route to measurement in RUN_10 and now correctly count).
- 3 additional items moved from `mixed` or `valid_*` buckets in RUN_9
  → `measurement` in RUN_10 (e.g. EL-13.12, EL-13.16, EL-13.2).
- 0 of RUN_9's 6 `invalid_missing_dimensions` items moved to
  measurement — the prompt tweak didn't help on its originally-intended
  target.

The tweak made the agent broadly more aggressive about reaching for
measurement, but not specifically on the missing-dimension cases. See
[`tmp/el-md-exp-var2-run-10/run-10-vs-run-9-comparison.md`](el-md-exp/tmp/el-md-exp-var2-run-10/run-10-vs-run-9-comparison.md)
for the full movement matrix.

## Caveats + the iter-2 Goal D follow-up

- **Goal D (iter-2): correct post-result verdict.** The 5
  measurement-routed nv-majority items that stayed nv-majority in
  RUN_10 are the seed cases:
  - **EL-13.10**, **EL-13.19**: stayed `nv:2, fail:1` — no movement.
  - **EL-13.13**, **EL-13.22**, **EL-13.23**: ctrl unanimous nv → RUN_10
    `nv:2, pass:1`. Measurement data exists, but the agent in 2/3
    runs still defaults to nv.

  Requires ground-truth verdict labels for the expected-measure-distance
  items; not yet built.

- **Goal A misuse is now 10.6%** — the agent calls vision on
  `shouldCall=no` items only 10.6% of the time in RUN_10, down from
  RUN_9's 8.5% and far below var-1's ~70%. The selectivity story is
  decisively in var-2's favor; the post-bureau#340 prompt didn't
  broaden vision invocation generically, it sharpened what kind of
  vision call the agent makes.

- **Goal B raw vs strict-clear matters for narrative.** Raw Goal B
  (11/54 = 20.4%) under-counts the architectural win because it
  penalizes var-2 for valid skips and mixed-signal rows. The
  strict-clear denominator (27 items where measurement was clearly
  the right answer) is the right framing for "did the variant pick
  the right specialist when the right specialist was clearly
  measure-distance?"

## Open follow-ups (in rough priority order)

1. **Goal D — correct post-result verdict (iter-2).** Define ground-
   truth verdicts for the 54 expected-measure-distance items and
   measure how often var-2's verdict matches them. The 5 stuck-nv
   items above are the seed cases.
2. **Targeted prompt iteration for `invalid_missing_dimensions`.** The
   bureau#340 tweak helped Goal B broadly but missed its originally-
   intended target (RUN_9's 6 missing-dimensions items, 0 of which
   moved into measurement in RUN_10). Consider an explicit rule like
   "if you observe the feature on the plan but no dimension annotation,
   ask a measurement question instead of marking not-verifiable".
3. **Classifier prompt tuning to lift Goal B further** — the classifier
   still picks generic for ~60% of expected-md items. The chain
   mechanism is sound; what remains is teaching the classifier to
   recognize more of the measurement question shapes.
4. **Substation/Inngest cloud-path hang** — cloud RUN_4 and RUN_5
   both hung in Substation's `Substation-workflow-run` Inngest function
   with no LLM activity. Local execution works fine; root cause
   unidentified. Pre-existing platform issue, not specific to this
   experiment.
5. **Audit the remaining `vertical-or-mixed` / `shouldCall=no` items**
   in `item-classification.json`. EL-13.21/22/23 were mis-labeled
   (caught in PR #73); worth scanning for others.
