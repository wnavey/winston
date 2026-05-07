# Goal A — cc ctrl-baseline

Headline number for the **`ctrl-baseline`** variant on the **cc**
experiment set. Joins [`per-item.tsv`](./per-item.tsv) (post-aggregation)
against [`../expected-vision-selection/expected.tsv`](../expected-vision-selection/expected.tsv).

## Aggregation rule

**Strict majority vote across runs.** An item is counted as "vision
invoked" when `2 × runs_called > runs_total`. Ties (e.g. 1 of 2 runs)
fail. With `runs=3` the threshold is ≥2 of 3.

This rule applies uniformly across variants and run-counts so TSVs
with different `runs` values stay directly comparable post-aggregation.

## Goal A

> Of checklist items where TSV 1 expects vision (`expected_vision=yes`),
> what fraction were vision-invoked under the majority vote?

| Bucket | Invoked / Total | Rate |
|---|---:|---:|
| `inspect-drawing-required` | 3 / 8 | 37.5% |
| `inspect-drawing-optional` | 25 / 46 | 54.3% |
| `generic` (TSV 1: `expected_specialist=generic`) | 39 / 100 | 39.0% |
| **All expected-vision (Goal A)** | **67 / 154** | **43.5%** |
| Misuse (`expected_vision=no` items invoked) | 0 / 31 | 0.0% |

Source run: [`VISION_CHECK_CC_BASELINE`](./runs.md), `runs=3`, 1700 S.
Lamar v2.

## What this floor means

Ctrl-baseline gives the agent only the generic `vision` tool. The 43.5%
goal-A number says: with no specialist exposed, the agent decides on
its own to invoke vision on a strict majority of runs for 43.5% of the
items the labels say need it. Misuse on the 31 no-tool items is 0%.

The bifurcated (`var1`) and routing (`var2`) variants will be measured
against this floor. Goals A and B are passed when:

- **A:** `var2` Goal A ≥ `var1` Goal A (and ideally ≥ this 43.5% floor).
- **B:** `var2` correctly routes to `inspect-drawing` ≥ `var1` does.
  Computable once both variant TSVs land.

## Reproducing

```bash
cd metrics/cc/ctrl-baseline-vision-invocation/scripts
python3 build.py        # produces ../per-item-run.tsv (long, raw)
python3 aggregate.py    # produces ../per-item.tsv (post majority vote)
```

Then the breakdown table above is one join away
(`expected-vision-selection/expected.tsv` ⨝ `per-item.tsv` on `item_id`).
