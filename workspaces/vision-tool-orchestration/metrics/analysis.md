# Vision-check metrics analysis

**Status:** 2026-05-07. **cc set: populated (partial — see runs disparity below). el-md-exp set: pending.**

This is the cross-variant writeup that joins the per-variant goal-a /
goal-b docs into a single readout against the iter-1 success criteria.
Methodology is in [`../metrics-framework.md`](../metrics-framework.md);
this file just synthesizes the numbers.

---

## TL;DR (cc)

| Goal | ctrl-baseline | var1-bifurcated | var2-routing | var2 vs var1 |
|---|---:|---:|---:|---:|
| **A — overall hit rate** | 43.5% | **44.8%** | 40.9% | -3.9pp ⚠️ |
| **A — inspect-drawing-required bucket** | 37.5% | 37.5% | **50.0%** | +12.5pp ✓ |
| **B — specialist invocation (required only)** | n/a | 0.0% | **25.0%** | +25.0pp ✓ |
| **B — specialist invocation (req + opt)** | n/a | 0.0% | **33.3%** | +33.3pp ✓ |

**Goal B is decisively passed — the vision_check architecture lifts
specialist invocation from 0% to 25–33% on cc.** Goal A overall is
inconclusive: var2 is behind var1 on the headline number, but ahead on
the must-call inspect-drawing-required bucket. The headline gap has a
known confounder (var2 ran at `runs=1` vs var1's `runs=3`) that needs
to be retired with a re-fire before the comparison is final.

---

## Methodology snapshot

Per [`../metrics-framework.md`](../metrics-framework.md):

- **3 variants** by tools available to the agent: `ctrl-baseline`
  (vision only), `var1-bifurcated-vision-tools` (vision + direct
  inspect-drawing), `var2-vision-specialist-routing` (vision_check only,
  internal classifier dispatches).
- **Aggregation rule:** strict majority vote across runs
  (`2 × runs_called > runs_total`). Ties fail.
- **Goal A** = `(items vision-invoked majority of runs) / (items where TSV 1 expects vision)`.
- **Goal B** = `(items routed to right specialist majority of runs) / (items where TSV 1 expects a named specialist)`. Specialist routes via vision_check (var2's `vision-check-inspect-drawing`) count as matching.
- All three cc variants ran on the same submission (1700 S. Lamar v2,
  `v2.5-trimmed`, 185 items).

---

## cc results

### Goal A — overall vision invocation hit rate

Source TSVs:
- [`cc/ctrl-baseline-vision-invocation/per-item.tsv`](cc/ctrl-baseline-vision-invocation/per-item.tsv) (`VISION_CHECK_CC_BASELINE`, runs=3)
- [`cc/var1-bifurcated-vision-tools/per-item.tsv`](cc/var1-bifurcated-vision-tools/per-item.tsv) (`VISION_EXP_INSPECT_DRAWING_RUN_1`, runs=3)
- [`cc/var2-vision-specialist-routing/per-item.tsv`](cc/var2-vision-specialist-routing/per-item.tsv) (`VISION_CHECK_CC_RUN_4`, **runs=1**)

| Bucket | ctrl-baseline | var1 | var2 |
|---|---:|---:|---:|
| `inspect-drawing-required` (8 items) | 37.5% (3/8) | 37.5% (3/8) | **50.0% (4/8)** |
| `inspect-drawing-optional` (46 items) | 54.3% (25/46) | **60.9% (28/46)** | 56.5% (26/46) |
| `generic` / vision-only (100 items) | **39.0% (39/100)** | 38.0% (38/100) | 33.0% (33/100) |
| **Goal A total (154 expected-vision items)** | 43.5% (67/154) | **44.8% (69/154)** | 40.9% (63/154) |
| Misuse (31 no-tool items invoked) | 0.0% | 0.0% | 0.0% |

**Read.** Var1 has a slight edge over ctrl-baseline at the overall
level (+1.3pp), almost entirely from inspect-drawing-optional items.
Var2 trades some of that broader coverage for stronger routing:
**+12.5pp on must-call inspect-drawing-required items vs ctrl-baseline
and var1**, with a -2.6pp drop on overall and a -6pp drop on generic
items. Misuse stays at zero across all three variants — none of the
architectures call vision on items that don't need it.

The headline -3.9pp gap from var1 to var2 lives almost entirely in the
`generic` and `inspect-drawing-optional` buckets, where var2 was more
conservative about even calling vision. This may reflect the "vision_check
adds a quality bar" phenomenon flagged in the run4 analysis.md (`bureau#306`
prompt-trim doubled var2's coverage from var3's 31 items to 63).

### Goal B — inspect-drawing invocation hit rate over expected

Goal B isn't computable for ctrl-baseline (no specialist exposed). For
var1 and var2:

| Denominator | var1 | var2 |
|---|---:|---:|
| `inspect-drawing-required` (8 items, must-call) | **0/8 = 0.0%** | **2/8 = 25.0%** |
| Required + optional (54 items) | 0/54 = 0.0% | **18/54 = 33.3%** |
| Specialist invocations (raw item-run cells) | 2 | 28 |
| Conditional B (correct route given invoked, req only) | 0 / 3 = 0% | **2 / 4 = 50.0%** |

**Read.** Var2 lifts specialist selection from 0% to 25–33%. Var1's
specialist usage was so sparse — 2 cells out of 162 inspect-drawing
eligible (1.2% raw) — that no item cleared the strict-majority
threshold. Even under the lenient ≥1-run rule, var1 would be 2/8 = 25%
on required, exactly tying var2 at strict-majority — meaning **var2's
strict-majority equals or beats var1's most-permissive aggregation**.

The 26x specialist-invocation gap (28 cells vs 2) is the headline
finding. Iter-1 hypothesis confirmed for cc Goal B.

### Per-required-item routing across all 3 variants

The 8 inspect-drawing-required items — every one of these MUST be
investigated with the specialist for full credit. Post-aggregation
`tool_called` per variant:

| Item | ctrl | var1 | var2 |
|---|---|---|---|
| `cc-13:AW-21` | generic-vision | generic-vision | **vision-check-inspect-drawing ✓** |
| `cc-13:AW-23` | generic-vision | generic-vision | **vision-check-inspect-drawing ✓** |
| `cc-13:AW-28` | none | none | none |
| `cc-13:AW-32` | none | none | vision-check-generic ⚠️ (called, wrong route) |
| `cc-13:AW-39` | none | none | none |
| `cc-19:CC-19-05` | none | none | none |
| `cc-19:CC-19-19` | none | none | none |
| `cc-22:CC-22-14` | generic-vision | generic-vision | vision-check-generic ⚠️ (called, wrong route) |

- **Invocation-and-route correct (var2 only):** 2 (AW-21, AW-23)
- **Invocation-only correct (called something):** ctrl 3, var1 3, var2 4
- **Stubborn invocation misses (across all 3 variants):** 4
  (AW-28, AW-39, CC-19-05, CC-19-19) — the same 4 flagged in the
  run4 analysis.md as needing review-guide-level help, not classifier-
  level

Two distinct failure modes for var2 that var1/ctrl can't have:
- **Route miss (2 items, AW-32 + CC-22-14):** agent invoked
  `vision_check`, but the classifier picked `generic` instead of
  `drawing_inspect`. Fixable on the bureau classifier prompt side.
- **Invocation miss (4 items):** agent never invoked `vision_check` at
  all. Same items var1 and ctrl-baseline also skipped. Likely needs
  review-guide-level help.

### Caveats / non-paramount

- **Runs disparity.** Ctrl-baseline + var1 ran at `runs=3`; var2 ran at
  `runs=1`. Strict majority threshold is more demanding at runs=3
  (need ≥2 of 3) than at runs=1 (need ≥1 of 1), which subtly favors
  var1 on Goal A overall. **A re-fire of var2 at runs=3 is the cleanest
  way to retire this confounder** before declaring Goal A's outcome.
  This is in the iter-1 backlog already.
- **`tools_used` doesn't track inspect-drawing in var1.** Workaround
  used (per-call metadata.json directly). Doesn't affect the count
  but is an open repo-level TODO.
- **Var1 had one "agent contradicted the specialist" case** (AW-23 /
  run-1 in var1 — inspect-drawing returned `yes`, agent overrode
  with vision and finalized `fail`). Doesn't move A or B numbers but
  flags that var1's tool integration was fragile even when invoked.
- **`expected_specialist=inspect-drawing` includes 46 "optional" items**
  where TSV 1 notes "generic also acceptable". B's strict reading
  filters to required-only (8 items); the "required + optional"
  reading is a permissive ceiling.

---

## Iter-1 success criteria evaluation (cc only)

> A. var2's overall vision invocation hit rate ≥ var1's on items where
> TSV 1 expects vision.

**Status: not yet met at the overall headline — but met on the
inspect-drawing-required bucket.** 40.9% (var2) vs 44.8% (var1)
overall. Confounded by runs disparity (var2 was runs=1). On the
must-call required bucket, var2 is +12.5pp ahead. Re-fire var2 at
runs=3 to retire the confounder before declaring.

> B. var2's specialist selection rate ≥ var1's on items where TSV 1
> expects a specialist.

**Status: ✓ MET, decisively.** 25% (var2) vs 0% (var1) on required.
33.3% (var2) vs 0% (var1) on req + optional. Var2's strict-majority
matches var1's most-permissive aggregation. Direction is unambiguous.

---

## el-md-exp results

**Pending.** No metrics TSVs built yet for the el-md-exp set
(measure-distance specialist on review workflow). Existing data:

- ctrl-baseline el-md-exp: `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V2`
  (runs=3, agent-trace silently failed — caveats in original kickoff)
- var1 el-md-exp: historical `experiment-run7` / `experiment-run7.2`
  in `winston/workspaces/measure-distance-tool/...` — needs locating +
  schema audit
- var2 el-md-exp: `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_1` is a smoke
  test from before bureau#310 fix landed; likely needs re-fire

Once those three are populated, this section gets the same
treatment as cc above.

---

## Cross-set synthesis

**Pending.** Will live here after el-md-exp populates and we can compare
the routing architecture's effect on specialist invocation across both
sets.
