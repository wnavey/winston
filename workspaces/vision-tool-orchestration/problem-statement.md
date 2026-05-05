# Problem Statement

The top-level review agent is bad at picking the right vision-capable tool.
Two specialist tools (`measure-distance` and `inspect-drawing`) exist but are
invoked at very low rates — even on the items they were built for. The
generic `vision` tool gets called by default and frequently produces
unstructured / unreliable answers on questions the specialists were
purpose-built to handle.

## Hit rates

Both numbers below are **rigorous per-(item × run) recall**: of cells where
the agent SHOULD have called the specialist (per a hand-labeled
classification), what fraction actually got at least one call.

### `measure-distance` (Electric — `el-md-exp` review guide, runs 6.x and 7.x)

Average across the 4 most recent / polished experiment runs:

| Run | Recall | Misuse (real) |
|---|---:|---:|
| `experiment-run6` | 11.8% (18/153) | 2.0% (3/150) |
| `experiment-run6.2` | 8.5% (13/153) | 0.0% (0/150) |
| `experiment-run7` | 12.4% (19/153) | 0.0% (0/150) |
| `experiment-run7.2` | 13.1% (20/153) | 2.0% (3/150) |
| **mean** | **~11.5%** | **~1.0%** |

Source: [`../measure-distance-tool/analysis/rigorous-metrics/`](../measure-distance-tool/analysis/rigorous-metrics/)

Item universe: 51 horizontal items (36 distance-only + 15 distance-plus) ×
3 run-indices = 153 should-call cells per experiment.

> **Note:** earlier docs reported ~46% recall on distance-only items. That
> number was inflated by agent-session-level attribution + a baseline-NV-only
> denominator. The 11–13% above is the rigorous per-(item × run) framing —
> see [`../measure-distance-tool/analysis/rigorous-metrics/README.md`](../measure-distance-tool/analysis/rigorous-metrics/README.md).

### `inspect-drawing` (Completeness Check — `v2.5-trimmed`, run1)

Single experiment run so far (`VISION_EXP_INSPECT_DRAWING_RUN_1`):

| Cell type | Recall |
|---|---:|
| `inspect-drawing-required` (must call) | **8.3%** (2/24) |
| Required + optional (any call acceptable) | **1.2%** (2/162) |
| Misuse (vision-only / no-tool items) | **0%** |

Source: [`../inspect-drawing-tool/experiments/run1/analytics/analysis.md`](../inspect-drawing-tool/experiments/run1/analytics/analysis.md)

Item universe: 8 must-call items (cc-13: 5, cc-19: 2, cc-22: 1) × 3 runs = 24
must-call cells. 54 total should-call items × 3 = 162 acceptable-call cells.

## Two failure modes behind the low recall

Beyond the headline rate, the per-run analyses surface two distinct issues:

1. **Tool selection failure.** Agent doesn't reach for the specialist when
   it should. Most cases — the agent stays in `vision` and produces an
   unstructured answer (or, for `cc`, fails the item with "vision tool
   limitations" while a confident specialist answer was available).
2. **Tool input failure.** When the agent does invoke the specialist, the
   inputs are sometimes wrong: misidentified objects, wrong sheet, wrong
   crop region. Per the prior measure-distance analysis, "less than 20% of
   the time we call measure-distance correctly" — and that's already
   conditioned on having decided to call it.

Both failures should be addressable by routing the question through a
classifier before the specialist sees it: the classifier picks the
specialist (fixes #1), and a thinner classifier-controlled call path makes
the input formation more deterministic (helps with #2).

## What's NOT in this problem statement

- **Tool reliability / measurement accuracy.** When the specialists do get
  called with reasonable inputs, both run at ~100% completion rate per
  the existing analyses. The problem isn't the tools themselves — it's the
  agent's tool-selection layer.
- **Generic vision tool quality.** The fallback path also has known issues
  (bundled multi-question prompts, lossy OCR), but those are out of scope
  for this iteration. The orchestrator addresses them indirectly by moving
  routable questions away from the fallback.

## Why now

- Both specialists are stable, instrumented, and have a clean per-call
  attribution layer (`applicableChecklistItems` in `metadata.json`).
- Reference classifications exist for both tool domains
  (`cc-vision-classification` for inspect-drawing,
  `el-md-exp/item-classification.json` for measure-distance) so we can
  grade routing accuracy from day one without building new ground-truth.
- Adding a third specialist later (count, exemplar match, etc.) without
  an orchestrator means the top-level agent prompt grows another vision
  tool and the selection problem gets worse, not better.
