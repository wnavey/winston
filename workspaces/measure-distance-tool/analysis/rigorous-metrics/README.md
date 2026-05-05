# Cross-run rigorous metrics — el-md-exp

Single source of truth comparing every experiment run on the same per-(item × run) framing.

**Source guide set:** `el-md-exp` (EL guides 1, 2, 13 — 101 items: 51 horizontal [36 distance-only + 15 distance-plus], 28 not-applicable, 22 vertical-or-mixed)

**Methodology:** binary should-call grade per item × run-index. Recall = % of should-call cells where the agent made ≥1 measure-distance call. Misuse = % of should-not-call cells where the agent made a call. Per-deficiency-id attribution from `applicableChecklistItems` in pair-level `metadata.json`. Multiple internal pair-calls for the same item count once. See [`scripts/compute-rigorous-metrics.py`](../scripts/compute-rigorous-metrics.py).

**Why this replaces the legacy phase-1 metrics:** the prior `phase-1-*-metrics.md` docs reported recall as high as 46% on distance-only items, but used (a) agent-session-level attribution (any call by an agent counted every eligible item in that session as 'invoked') and (b) a much smaller denominator (≈26 instead of 108). The rigorous framing here counts only the cells where the agent actually tagged the deficiency_id. See the [methodology section](#methodology) below.

## Headline

| Run | Pair dirs | Attr | Recall | Misuse (real) | distance-only | distance-plus |
|---|---:|:---:|---:|---:|---:|---:|
| `experiment-run1` | 0 | ❌ | n/a | n/a | n/a | n/a |
| `experiment-run2` | 0 | ❌ | n/a | n/a | n/a | n/a |
| `experiment-run3` | 10 | ❌ | n/a | n/a | n/a | n/a |
| `experiment-run4` | 43 | ✅ | 13.7% (21/153) | 2.0% (3/150) | 6.5% | 31.1% |
| `experiment-run5` | 50 | ✅ | 13.1% (20/153) | 2.0% (3/150) | 11.1% | 17.8% |
| `experiment-run6` | 41 | ✅ | 11.8% (18/153) | 2.0% (3/150) | 7.4% | 22.2% |
| `experiment-run6.2` | 22 | ✅ | 8.5% (13/153) | 0.0% (0/150) | 4.6% | 17.8% |
| `experiment-run7` | 44 | ✅ | 12.4% (19/153) | 0.0% (0/150) | 9.3% | 20.0% |
| `experiment-run7.2` | 51 | ✅ | 13.1% (20/153) | 2.0% (3/150) | 9.3% | 22.2% |

Runs with `Attr ❌` predate per-call `applicableChecklistItems` attribution; rigorous per-(item × run) recall is unanswerable for them. Agent-session-level numbers for those runs live in the legacy [`../phase-1-cross-run-metrics.md`](../phase-1-cross-run-metrics.md).

## Per-run detail

- [`experiment-run1`](./experiment-run1.md)
- [`experiment-run2`](./experiment-run2.md)
- [`experiment-run3`](./experiment-run3.md)
- [`experiment-run4`](./experiment-run4.md)
- [`experiment-run5`](./experiment-run5.md)
- [`experiment-run6`](./experiment-run6.md)
- [`experiment-run6.2`](./experiment-run6.2.md)
- [`experiment-run7`](./experiment-run7.md)
- [`experiment-run7.2`](./experiment-run7.2.md)

## Methodology

Three reasons the rigorous framing differs from the legacy phase-1 metrics:

1. **Numerator: per-(deficiency × run) cells, not agent-sessions.** Legacy metrics counted any agent that made ≥1 call as having 'invoked' MD on every eligible item in that session. Here we only count the specific deficiency_ids the agent tagged in `applicableChecklistItems`.
2. **Denominator: every horizontal × run cell, not a baseline-NV subset.** Legacy metrics filtered the denominator to items whose baseline verdict was `not-verifiable` (the conversion-eligible subset). The rigorous denominator is every horizontal item × every run-index, regardless of baseline verdict.
3. **Misuse separates real from over-tag.** A pair-call can list multiple deficiencies in `applicableChecklistItems`. If the call legitimately measured a `should_call=yes` item and the agent over-attached a `should_call=no` item to the same call, that's not real misuse. Real misuse only counts cells where at least one pair-call had ONLY `should_call=no` items in its applicable list.

**Pair-call collapse:** if measure-distance produces N internal pair-calls for a single agent-tool invocation (e.g. measuring 5 trees against an OHE for one checklist item), all N count as one hit on that (item × run) cell.
