# Goal A — cc var2-vision-specialist-routing

Headline number for the **`var2`** variant on the **cc** experiment set.
Joins [`per-item.tsv`](./per-item.tsv) (post majority-vote aggregation)
against [`../expected-vision-selection/expected.tsv`](../expected-vision-selection/expected.tsv).

Aggregation rule: strict majority vote, `2 × runs_called > runs_total`,
ties fail. With `runs=1` (this source run), threshold is ≥1 of 1.

## Goal A

> Of checklist items where TSV 1 expects vision (`expected_vision=yes`),
> what fraction were vision-invoked under the majority vote?

| Bucket | Invoked / Total | Rate |
|---|---:|---:|
| `inspect-drawing-required` | 4 / 8 | 50.0% |
| `inspect-drawing-optional` | 26 / 46 | 56.5% |
| `generic` (TSV 1: `expected_specialist=generic`) | 33 / 100 | 33.0% |
| **All expected-vision (Goal A)** | **63 / 154** | **40.9%** |
| Misuse (`expected_vision=no` items invoked) | 0 / 31 | 0.0% |

Source run: [`VISION_CHECK_CC_RUN_4`](./runs.md), `runs=1`, 1700 S. Lamar v2.

## Comparison vs ctrl-baseline (cc)

Both runs are on the same submission (1700 S. Lamar v2,
`v2.5-trimmed`). Ctrl-baseline ran `runs=3`; var2 ran `runs=1`.

| Bucket | ctrl-baseline | var2 | Δ |
|---|---:|---:|---:|
| inspect-drawing-required | 37.5% (3/8) | **50.0% (4/8)** | +12.5pp |
| inspect-drawing-optional | 54.3% (25/46) | **56.5% (26/46)** | +2.2pp |
| generic (vision-only) | **39.0% (39/100)** | 33.0% (33/100) | -6.0pp |
| **Goal A overall** | **43.5% (67/154)** | 40.9% (63/154) | -2.6pp |
| Misuse | 0.0% (0/31) | 0.0% (0/31) | unchanged |

**Read:** var2 is currently slightly *behind* ctrl-baseline on overall
goal A (-2.6pp), but the breakdown is informative: var2 *gains* on
inspect-drawing items (where the specialist matters) and *loses* on
generic items (where the agent is being more conservative about even
calling vision). Misuse stays at zero.

The comparison var2 ≥ var1 is what actually matters for the iter-1
proof — var1 cc data is still pending, so we can't yet conclude on the
A success criterion. Note also that var2 was a single run vs
ctrl-baseline's 3-run majority; running var2 at `runs=3` may shift the
overall number either direction.

## Reproducing

```bash
cd metrics/cc/var2-vision-specialist-routing/scripts
python3 build.py        # produces ../per-item-run.tsv (raw per-(item × run))
python3 aggregate.py    # produces ../per-item.tsv (post majority vote)
```
