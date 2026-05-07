# Goal B — cc var1-bifurcated-vision-tools

Specialist selection rate for the **`var1`** variant on the **cc**
experiment set. Joins [`per-item.tsv`](./per-item.tsv) (post
majority-vote aggregation) against
[`../expected-vision-selection/expected.tsv`](../expected-vision-selection/expected.tsv).

## Goal B

> Of checklist items where TSV 1 expects a specialist
> (`expected_specialist=inspect-drawing` for cc), what fraction had
> `tool_called=inspect-drawing` post-aggregation?

| Denominator | Numerator | Rate |
|---|---:|---:|
| `inspect-drawing-required` (8 items, must use inspect-drawing) | 0 / 8 | **0.0%** |
| Required + optional (54 items) | 0 / 54 | **0.0%** |

Goal B for var1 cc is **zero**.

Source run: [`VISION_EXP_INSPECT_DRAWING_RUN_1`](./runs.md), `runs=3`.

## Why zero

The inspect-drawing script-tool was exposed to the agent in this run,
but the agent invoked it on only **2 (item × run) cells** out of 162
inspect-drawing-eligible cells (54 items × 3 runs):

- `cc-13:AW-21` in run-1 (1 call)
- `cc-13:AW-23` in run-1 (2 calls — sheets 18 and 19)

In runs 2 and 3 the agent called inspect-drawing zero times. Under the
strict majority-vote rule (≥2/3 runs needed), neither item clears the
threshold, so `tool_called` post-aggregation reverts to whichever
non-specialist tool was the per-run majority — `generic-vision` in
both cases.

## Required-item routing detail (8 items)

| Item | runs called any vision tool | runs called inspect-drawing | post-vote `tool_called` |
|---|---:|---:|---|
| `cc-13:AW-21` | 3/3 | 1/3 | `generic-vision` (vision majority; ID didn't clear) |
| `cc-13:AW-23` | 3/3 | 1/3 | `generic-vision` (same) |
| `cc-13:AW-28` | 0/3 | 0/3 | `none` |
| `cc-13:AW-32` | 0/3 | 0/3 | `none` |
| `cc-13:AW-39` | 0/3 | 0/3 | `none` |
| `cc-19:CC-19-05` | 0/3 | 0/3 | `none` |
| `cc-19:CC-19-19` | 0/3 | 0/3 | `none` |
| `cc-22:CC-22-14` | 3/3 | 0/3 | `generic-vision` |

**3 of 8 items the agent invoked vision on at all; 0 of 8 routed to
the specialist majority-of-runs.** Compare to ctrl-baseline (no
specialist exposed) where 3 of 8 also invoked vision on a majority of
runs — adding inspect-drawing to the tool list did not change the
agent's invocation pattern on must-call items.

## Conditional B (specialist selection accuracy among invoked items)

Useful secondary lens — would only matter if the specialist had been
the per-run majority for some items. For var1 cc it isn't. So:

| Bucket | Correct route / Invoked majority | Rate |
|---|---:|---:|
| Required only | 0 / 3 | 0.0% |
| Required + optional | 0 / 31 | 0.0% |

Conditional B is also zero — even when the agent decided vision was
needed, it did not pick the specialist as the majority tool.

## Comparison vs var2

| | var1 | var2 |
|---|---:|---:|
| Goal B (required only) | 0/8 = **0.0%** | 2/8 = **25.0%** |
| Goal B (req + optional) | 0/54 = **0.0%** | 18/54 = **33.3%** |
| Specialist invocations (raw cells) | 2 cells | 28 cells (item-runs at runs=1) |

Var2 substantially outperforms var1 on specialist routing. The
direction is unambiguous even with var2 at `runs=1` and var1 at
`runs=3` — var2 wired specialists into 28 distinct items vs var1's 2.

This is the iter-1 hypothesis confirmed for cc Goal B: the
`vision_check` routing architecture does meaningfully lift specialist
selection over the bifurcated tool list.

## Reproducing

```bash
cd metrics/cc/var1-bifurcated-vision-tools/scripts
python3 build.py
python3 aggregate.py
```
