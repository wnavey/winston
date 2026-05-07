# Goal B — cc var2-vision-specialist-routing

Specialist selection rate for the **`var2`** variant on the **cc**
experiment set. Joins [`per-item.tsv`](./per-item.tsv) (post
majority-vote aggregation) against
[`../expected-vision-selection/expected.tsv`](../expected-vision-selection/expected.tsv).

## Goal B

> Of checklist items where TSV 1 expects a specialist
> (`expected_specialist=inspect-drawing` for cc), what fraction had
> `tool_called=vision-check-inspect-drawing` post-aggregation?

For cc, the only specialist that's reachable is `inspect-drawing`.
Measure-distance dispatch isn't wired (cc has no measurement items
anyway). So Goal B for cc reduces to: **inspect-drawing invocation hit
rate over inspect-drawing-expected items**.

| Denominator | Numerator | Rate |
|---|---:|---:|
| `inspect-drawing-required` (8 items, must use inspect-drawing) | 2 / 8 | **25.0%** |
| Required + optional (54 items, inspect-drawing preferred — generic also acceptable per TSV 1 notes) | 18 / 54 | **33.3%** |

Source run: [`VISION_CHECK_CC_RUN_4`](./runs.md), `runs=1`.

## Required-item routing detail (8 items)

| Item | `vision_invoked` | `tool_called` | Outcome |
|---|---|---|---|
| `cc-13:AW-21` | yes | `vision-check-inspect-drawing` | ✓ correct |
| `cc-13:AW-23` | yes | `vision-check-inspect-drawing` | ✓ correct |
| `cc-13:AW-28` | no | `none` | ✗ not invoked |
| `cc-13:AW-32` | yes | `vision-check-generic` | ✗ wrong route (called but went generic) |
| `cc-13:AW-39` | no | `none` | ✗ not invoked |
| `cc-19:CC-19-05` | no | `none` | ✗ not invoked |
| `cc-19:CC-19-19` | no | `none` | ✗ not invoked |
| `cc-22:CC-22-14` | yes | `vision-check-generic` | ✗ wrong route (called but went generic) |

**Of 8 inspect-drawing-required items: 4 invoked, 2 routed correctly.**

This decomposes into two failure modes worth tracking separately:

- **Invocation miss (4 items):** agent never called `vision_check`
  at all. AW-28, AW-39, CC-19-05, CC-19-19 are the same 4 stubborn
  misses called out in the run4 analysis.md and the project-memory
  TODO. Likely needs review-guide-level help — phrasing the question
  requires domain knowledge that's not in the deficiency text alone.
- **Route miss (2 items, AW-32 + CC-22-14):** agent called
  vision_check, but the classifier routed to `generic` instead of
  `drawing_inspect`. These are classifier failures, not agent
  failures. Fixable with classifier-prompt iteration on the bureau
  side.

## Conditional B (specialist selection accuracy among invoked items)

A useful secondary lens: **of the items var2 *did* invoke vision_check
on, what fraction got the right specialist?** Strips out the
invocation-miss failure mode and isolates classifier accuracy.

| Bucket | Correct route / Invoked | Rate |
|---|---:|---:|
| Required only | 2 / 4 | 50.0% |
| Required + optional | 18 / 30 | 60.0% |

So when var2 *does* invoke vision_check, the classifier picks the right
specialist for inspect-drawing items 50–60% of the time.

## Comparison vs var1 (pending)

The success criterion for B is **var2 ≥ var1**. Var1 cc data hasn't been
built yet; the comparison will land in `metrics/cc/analysis.md` once
var1 lands.

## Reproducing

```bash
cd metrics/cc/var2-vision-specialist-routing/scripts
python3 build.py
python3 aggregate.py
```

Then join `per-item.tsv` against `../expected-vision-selection/expected.tsv`
on `item_id` and filter the rows above.
