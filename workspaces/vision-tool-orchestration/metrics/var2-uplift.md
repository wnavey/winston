# var-2 uplift — el-md-exp + measure-distance

The dedicated story of what var-2 (vision_check classifier-routing) does
on the review + measure-distance set, written against ctrl and var-1 as
baselines.

The cross-variant analysis at [`analysis.md`](./analysis.md) covers
both sets and the full Goal A / B framework. This doc is narrower:
**how much did var-2 actually move the needle on real review work?**

## The setup

Three architectures, same submission (Valley View Townhomes v1), same
guide (`el-md-exp`, 51 items expecting `measure-distance`):

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
never reached for it.** Across 51 candidates × 3 runs = 153
opportunities, var-1 invoked `measure-distance` **zero times**. Same
sparse-adoption pattern as cc/var-1's `inspect-drawing` (2/162). The
bifurcated-tool-list strategy fails by sparse adoption: too many tools,
agent defaults to the cheapest-to-reason-about one (generic vision).
Result: var-1 produces the same `not-verifiable` verdicts as ctrl on
the items where measurement actually matters.

| Variant | measure-distance invocations | Goal B (correct specialist invoked) | Goal C (specialist returned data \| B) |
|---|---:|---:|---:|
| ctrl | n/a (no specialist exposed) | n/a | n/a |
| **var-1** | **0 / 153 (item × run) cells** | **0.0%** (0/51 items) | n/a |
| var-2 (RUN_7_BACKUP_LOCAL_3_RUNS) | 22 invocations, 99/99 pair measurements computed | **27.5%** (14/51 items) | **100%** (11/14 — 3 had 0-pair extractor output) |

The architectural lift is decisive: var-2 takes specialist invocation
from *literally never* to a non-zero rate. The classifier-routing
architecture forces the routing decision based on the agent's question
shape — any well-formed distance question reaches `measure-distance`.

## What var-2 actually did to the verdicts

For the items where `measure-distance` ran in `RUN_7_BACKUP_LOCAL_3_RUNS`,
did the verdict change vs ctrl? Did `not-verifiable` become an
actionable pass/fail? Both runs are runs=3 with strict-majority
aggregation — apples-to-apples comparison.

**Headline:** 15 items had successful measure-distance on RUN_7. **4
items (27%)** moved from ctrl's `not-verifiable` majority verdict to
a real determination (3 pass, 0 fail). **1 of those 4** escaped ctrl's
*unanimous* `not-verifiable` (EL-13.33: `not-verifiable:3` → `pass:3`).

| Item | ctrl (runs=3 majority) | RUN_7 (runs=3 majority) | RUN_7 distribution | Pairs |
|---|---|---|---|---:|
| **EL-13.33** | not-verifiable (unanimous) | **pass** (unanimous) | pass:3 | 5 |
| EL-13.7 | not-verifiable | **pass** | pass:3 | 6 |
| EL-13.1 | not-verifiable | **pass** | pass:2, fail:1 | 15 |
| EL-13.19 | not-verifiable | **n/a** | n/a:2, fail:1 | 1 |
| EL-2.1 | **fail** | not-verifiable | nv:3 | 9 |
| EL-1.37 | not-verifiable | not-verifiable | nv:2, fail:1 | 13 |
| EL-13.10 | not-verifiable | not-verifiable | nv:2, pass:1 | 16 |
| EL-13.12 | not-verifiable | not-verifiable | nv:1, n/a:1, fail:1 | 1 |
| EL-13.14 | not-verifiable | not-verifiable | nv:2, fail:1 | 2 |
| EL-13.21 | not-verifiable (unanimous) | not-verifiable | nv:2, pass:1 | 5 |
| EL-13.22 | not-verifiable (unanimous) | not-verifiable | nv:2, pass:1 | 5 |
| EL-13.23 | not-verifiable (unanimous) | not-verifiable | nv:2, pass:1 | 5 |
| EL-13.27 | n/a | not-verifiable | nv:2, pass:1 | 6 |
| EL-13.2 | n/a | pass | pass:2, n/a:1 | 5 |
| EL-2.7 | n/a | fail | fail:1, n/a:1, nv:1 | 5 |

The lower per-item move rate vs RUN_6 (4/15 vs 6/8 = 75%) reflects
RUN_7's broader coverage — runs=3 catches more items where ctrl
already had varied verdicts.

**EL-13.33** is the clean win. Ctrl unanimous `not-verifiable` (vision
alone couldn't measure), RUN_7 unanimous `pass` (the measurement
chain disambiguated it).

**EL-2.1 is the new Goal D candidate.** Ctrl was unanimous `fail` —
vision-only saw enough to flag it. RUN_7 ran 9 measurements but came
back unanimous `not-verifiable`. The chain produced data; the agent's
verdict logic didn't connect the dots to escalate to `fail`. This is
exactly the kind of regression Goal D is meant to surface.

### Sample measurements (EL-13.33, RUN_7, where verdict flipped clean to pass)

The measurements are in [`../source-runs/el-md-exp/var-2/compare-vs-ctrl.md`](../source-runs/el-md-exp/var-2/compare-vs-ctrl.md).
Pattern is consistent with measure-distance's design: each pair gets
two Gemini Vision passes (coarse + refined), distances in feet with
medium confidence.

## The chain end-to-end (what runs=3 + the fix did)

```
Agent question
  ↓
vision_check (classifier picks intent)
  ↓
problemType=measurement
  ↓
extract-measurement-pairs  (new bureau script — looks at the cropped
   ↓                        drawing, returns instance-level object
   ↓                        pairs to measure)
[{objectA, objectB}, ...]
  ↓
measure-distance  (existing bureau script — for each pair, two-call
                   Gemini Vision flow returns the real-world distance)
  ↓
{ distanceFeet, confidence } per pair
```

Pre-RUN_6, this chain didn't execute end-to-end. Two latent bugs
surfaced when conductor#153 wired up the dispatch:

1. **`measure-distance.ts:200` ordered `plan_set_version` by a
   non-existent `version_number` column.** Latent because
   `measure-distance` had never been invoked in production prior to
   conductor#153 — the agent in var-1 ignored the tool, and var-2's
   measurement dispatch wasn't wired. Fixed in bureau#324 by migrating
   the script to use the shared `lib/sheet-resolution.ts` helper.

2. **`getPlanSetVersionId` fell back to "latest plan_set_version by
   created_at" when no submission was scoped.** That fallback could
   silently pick a *different* submission's plan_set_version when the
   same plan_set had versions across multiple submissions. Concrete
   example: Valley View's plan_set has two versions in the DB, one for
   our submission and one for a newer unrelated submission — the
   fallback would silently grab the newer one and review against the
   wrong sheets. Fixed in bureau#324 (require submissionVersionId, no
   fallback) + conductor#154 (thread submissionVersionId from workflow
   input through every layer to the bureau script subprocess).

After both PRs landed, the chain runs cleanly. RUN_7_BACKUP_LOCAL_3_RUNS
had **22 measure-distance subprocess invocations** producing **99/99
per-pair distance measurements** (100% subprocess success rate; Goal C
= 100% on the B-eligible denominator).

## Caveats + the iter-2 Goal D follow-up

- **Goal D (iter-2): correct post-result verdict.** Goal C runs at
  100% but the agent's *interpretation* of the measurement results
  into a final verdict is the next bottleneck. Examples from RUN_7:
  - **EL-2.1**: ctrl unanimous `fail`, RUN_7 unanimous `not-verifiable`
    despite 9 measure-distance pairs returned. The agent didn't
    escalate.
  - **EL-1.37**: 13 measurements, RUN_7 verdict distribution
    (`nv:2, fail:1`) identical to ctrl. No aggregation lift from the
    new data.
  - **EL-13.10, EL-13.21, EL-13.22, EL-13.23, EL-13.27**: pattern of
    `not-verifiable:2 + 1 dissent` despite the chain running. The
    agent keeps erring on the side of "needs human review" in 2 of 3
    runs.

  Goal D is formally defined in [`../metrics-framework.md`](../metrics-framework.md).
  Requires ground-truth verdict labels for the expected-measure-distance
  items; not yet built.

- **Hardcoded scale (`scaleInchesPerFoot=0.05`, i.e. 1"=20').** Sheets
  at other scales (1"=10', 1"=40', floor plans at 1/8"=1') will
  mismeasure proportionally. The 395 ft max and 0.0 ft min in RUN_7's
  distance range are suspect for this reason. Doesn't affect
  Goal A/B/B'/C (routing + execution success) but does affect
  *measurement accuracy*.

- **EL-13.13 stayed `not-verifiable`** despite measure-distance
  succeeding on RUN_6 and again on RUN_7. Specific Goal-D candidate
  worth single-item triage.

- **Goal B remains at ~27% — the classifier still picks `generic`
  instead of `measurement` for ~73% of the expected-measure-distance
  items.** Better than RUN_3's 15.7% but still the major lever.
  Classifier prompt tuning is the iter-2 routing question; the chain
  mechanism is sound.

## Open follow-ups (in rough priority order)

1. **Goal D — correct post-result verdict (iter-2).** Define ground-
   truth verdicts for the 51 expected-measure-distance items and
   measure how often var-2's verdict matches them. Examples above are
   the seed cases.
2. **Substation/Inngest cloud-path hang** — cloud RUN_4 and RUN_5
   both hung in Substation's `Substation-workflow-run` Inngest function
   with no LLM activity. Local execution works fine; root cause
   unidentified. Pre-existing platform issue, not specific to this
   experiment.
3. **Per-sheet scale extraction** — replace the hardcoded
   `scaleInchesPerFoot=0.05` with a real lookup (title block extraction
   via small LLM call, or sheet metadata). Unblocks measurement
   *accuracy*; doesn't affect Goal A/B/B'/C.
4. **EL-13.13 not-verifiable despite measurement** — single-item
   triage. Goal D candidate.
5. **395 ft / 0.0 ft distance outliers** — spot-check against actual
   sheets to confirm the measurements (or expose scale issues, or
   pair-extraction misidentifications).
6. **Classifier prompt tuning to lift Goal B** — currently
   `generic` is chosen for ~73% of expected-measure-distance items
   (down from RUN_3's ~85%, but still the major lever). The chain
   mechanism is sound; what remains is teaching the classifier to
   recognize more of the measurement question shapes.
7. **Migrate `measure-distance.ts` and `inspect-drawing.ts` fully
   to `lib/sheet-resolution.ts`** — currently the lib only owns the
   plan_set_version lookup; the inline `findDrawingBlockBbox`,
   `findLegendContext`, `downloadAsset`, etc. could be extracted in a
   follow-up to consolidate the duplicate Supabase plumbing across
   the three review scripts.
