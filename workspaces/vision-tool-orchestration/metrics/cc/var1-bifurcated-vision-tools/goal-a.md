# Goal A — cc var1-bifurcated-vision-tools

Headline number for the **`var1`** variant on the **cc** experiment set.
Joins [`per-item.tsv`](./per-item.tsv) (post majority-vote aggregation)
against [`../expected-vision-selection/expected.tsv`](../expected-vision-selection/expected.tsv).

Aggregation rule: strict majority vote, `2 × runs_called > runs_total`.
With `runs=3`, threshold ≥2 of 3.

## Goal A

> Of checklist items where TSV 1 expects vision (`expected_vision=yes`),
> what fraction were vision-invoked under the majority vote?

| Bucket | Invoked / Total | Rate |
|---|---:|---:|
| `inspect-drawing-required` | 3 / 8 | 37.5% |
| `inspect-drawing-optional` | 28 / 46 | 60.9% |
| `generic` (TSV 1: `expected_specialist=generic`) | 38 / 100 | 38.0% |
| **All expected-vision (Goal A)** | **69 / 154** | **44.8%** |
| Misuse (`expected_vision=no` items invoked) | 0 / 31 | 0.0% |

Source run: [`VISION_EXP_INSPECT_DRAWING_RUN_1`](./runs.md), `runs=3`,
1700 S. Lamar v2.

## Comparison vs ctrl-baseline (cc)

Both runs are on the same submission, both `runs=3`. Apples-to-apples.

| Bucket | ctrl-baseline | var1 | Δ |
|---|---:|---:|---:|
| inspect-drawing-required | 37.5% (3/8) | 37.5% (3/8) | 0pp |
| inspect-drawing-optional | 54.3% (25/46) | **60.9% (28/46)** | +6.5pp |
| generic (vision-only) | **39.0% (39/100)** | 38.0% (38/100) | -1.0pp |
| **Goal A overall** | 43.5% (67/154) | **44.8% (69/154)** | +1.3pp |
| Misuse | 0.0% (0/31) | 0.0% (0/31) | unchanged |

**Read:** adding the `inspect-drawing` script-tool to the agent's tool
list (with the `--experiment=inspect-drawing` prompt overlay) very
slightly increases overall vision invocation (+1.3pp). The bulk of the
gain is on inspect-drawing-optional items. Required items see no
change. Misuse stays at zero.

## Comparison vs var2 (pending)

Direct head-to-head var2 vs var1 will land in
`metrics/cc/analysis.md` once var1 (this PR) and var2 (PR #48) are both
on main. Quick preview from already-computed numbers:

| | ctrl-baseline | var1 | var2 |
|---|---:|---:|---:|
| Goal A overall | 43.5% | **44.8%** | 40.9% |
| inspect-drawing-required | 37.5% | 37.5% | **50.0%** |
| Goal B (req only) | n/a (no specialist) | **0.0%** | **25.0%** |

Var1 has a slight edge on overall Goal A; var2 dominates on Goal B and
on the must-call inspect-drawing-required bucket. Note var2 ran at
`runs=1` which can shift its A number either direction in a runs=3
re-fire.

## Reproducing

```bash
cd metrics/cc/var1-bifurcated-vision-tools/scripts
python3 build.py        # produces ../per-item-run.tsv (raw per-(item × run))
python3 aggregate.py    # produces ../per-item.tsv (post majority vote)
```
