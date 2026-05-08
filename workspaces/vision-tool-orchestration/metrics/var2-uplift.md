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

| Variant | measure-distance invocations | Goal B (correct specialist invoked) |
|---|---:|---:|
| ctrl | n/a (no specialist exposed) | n/a |
| **var-1** | **0 / 153 (item × run) cells** | **0.0%** (0/51 items) |
| var-2 (RUN_6_BACKUP_LOCAL) | 8 invocations, 24/24 pair measurements computed | **13.7%** (7/51 items) |

The architectural lift is decisive: var-2 takes specialist invocation
from *literally never* to a non-zero rate. The classifier-routing
architecture forces the routing decision based on the agent's question
shape — any well-formed distance question reaches `measure-distance`.

## What var-2 actually did to the verdicts

For the items where `measure-distance` ran in RUN_6_BACKUP_LOCAL, did
the verdict change vs ctrl? Did `not-verifiable` become an actionable
pass/fail?

| Item | ctrl (runs=3 majority) | var-2 (RUN_6 runs=1) | Pairs measured |
|---|---|---|---:|
| EL-1.1 | not-verifiable | **pass** | 2 |
| EL-1.14 | not-verifiable | **fail** ⚠ | 1 |
| EL-1.37 | not-verifiable | **fail** ⚠ | 4 |
| EL-1.8 | fail | fail | 6 |
| EL-1.9 | not-verifiable | **pass** | 2 |
| EL-13.10 | not-verifiable | **pass** | 5 |
| EL-13.12 | not-verifiable | **pass** | 2 |
| EL-13.13 | not-verifiable | not-verifiable | 2 |

**6 of 8 items (75%)** escaped ctrl's `not-verifiable` majority
verdict — 4 to `pass`, 2 to `fail`. **3 of those 6** escaped ctrl's
*unanimous* `not-verifiable` (3/3 ctrl runs all said unverifiable).

The two `fail` items (EL-1.14, EL-1.37) are real compliance
deficiencies the ctrl baseline would have left for a human reviewer to
catch. These are the use case for `measure-distance`: the agent now
says *"the actual measured horizontal distance is X ft, threshold is Y
ft, here's why it fails"* instead of *"I'd need elevation drawings to
tell you."*

### Sample measurements (EL-13.10 — transformer-pad-to-building clearance, 10 ft minimum)

| objectA | objectB | Distance (ft) | Confidence |
|---|---|---:|---|
| Transformer Pad west of Bldg. 1 | West exterior wall of Bldg. 1 | 34.6 | medium |
| Transformer Pad west of Bldg. 2 | West exterior wall of Bldg. 2 | 14.3 | medium |
| Transformer Pad west of Bldg. 8 | West exterior wall of Bldg. 8 | 13.3 | medium |
| Transformer Pad between Bldg. 4 & 5 | West exterior wall of Bldg. 5 | **5.1** | medium |
| Transformer Pad east of Bldg. 7 | East exterior wall of Bldg. 7 | 46.0 | medium |

Three pass cleanly, one is borderline (13.3 ft above the 10-ft min),
and **one flags as deficient at 5.1 ft** — exactly the kind of finding
this chain is meant to surface.

## The chain end-to-end (what makes RUN_6 different from RUN_3)

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

After both PRs landed, the chain runs cleanly. RUN_6_BACKUP_LOCAL had
**8 measure-distance subprocess invocations** producing **24/24
per-pair distance measurements** (100% subprocess success rate).

## Caveats + follow-ups

- **runs=1.** RUN_6_BACKUP_LOCAL is a single-shot local backup
  because the Substation/Inngest cloud path was hanging on this
  experiment. The runs=3 cloud re-fire is on the open-follow-ups list
  below; it'll retire the runs-disparity confounder on Goal A. Goal B,
  Goal B', and the verdict-conversion numbers are not expected to
  shift much (the lift is architectural, not statistical).

- **Hardcoded scale (`scaleInchesPerFoot=0.05`, i.e. 1"=20').** Sheets
  at other scales (1"=10', 1"=40', floor plans at 1/8"=1') will
  mismeasure proportionally. The 387 ft outlier in the RUN_6 distance
  range is suspect for this reason. Doesn't affect Goal A/B/B'
  (routing + execution success) but does affect *measurement accuracy*.

- **EL-13.13 stayed `not-verifiable` despite measure-distance returning
  distances.** Worth investigating whether the agent rejected the
  measurement output or whether the question shape doesn't quite map
  to a clean pass/fail threshold.

- **Goal B remains at ~14% — the classifier still picks `generic`
  instead of `measurement` for ~85% of the expected-measure-distance
  items.** The classifier prompt is the next lever; this is the
  iter-2 question, not phase-1. The chain mechanism is sound; what
  remains is teaching the classifier to recognize more of the
  measurement question shapes.

## Open follow-ups (in rough priority order)

1. **Cloud runs=3 re-fire of var-2** — retires the runs-disparity
   confounder on Goal A. Blocked on the Substation/Inngest hang
   investigation (item 2).
2. **Substation/Inngest cloud-path hang** — cloud RUN_4 and RUN_5
   both hung in Substation's `Substation-workflow-run` Inngest function
   with no LLM activity. Local execution works fine; root cause
   unidentified. Pre-existing platform issue, not specific to this
   experiment.
3. **Per-sheet scale extraction** — replace the hardcoded
   `scaleInchesPerFoot=0.05` with a real lookup (title block extraction
   via small LLM call, or sheet metadata). Unblocks measurement
   *accuracy*; doesn't affect Goal A/B/B'.
4. **EL-13.13 not-verifiable despite measurement** — single-item
   triage. Either the agent rejected a valid measurement, or the
   question shape doesn't map to a clean threshold; either way it's a
   diagnostic case for tightening the post-measurement verdict path.
5. **387 ft distance outlier** — spot-check against the actual sheet
   to confirm the measurement (or expose a scale issue, or expose a
   pair-extraction issue where the model picked the wrong objectA/B).
6. **Classifier prompt tuning to lift Goal B** — currently
   `generic` is chosen for ~85% of expected-measure-distance items.
   This is the lever for the next phase-2 iteration once the chain is
   end-to-end stable.
7. **Migrate `measure-distance.ts` and `inspect-drawing.ts` fully
   to `lib/sheet-resolution.ts`** — currently the lib only owns the
   plan_set_version lookup; the inline `findDrawingBlockBbox`,
   `findLegendContext`, `downloadAsset`, etc. could be extracted in a
   follow-up to consolidate the duplicate Supabase plumbing across
   the three review scripts.
