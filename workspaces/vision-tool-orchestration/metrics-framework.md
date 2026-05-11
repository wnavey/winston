# Metrics framework — iter 1 (extended 2026-05-11 with Goals C + D)

**Status:** 2026-05-07 reorientation. Supersedes the looser "headline recall +
routing accuracy" framing in [`plan.md`](./plan.md). Folds the eval
strategy into a clean 3-variant × 4-TSV × 2-set table so future runs +
analyses align without ambiguity.

**Update 2026-05-11:** Goal C (correct tool execution) and Goal D
(correct post-result verdict) added below. Goal C was implicit in iter-1
(specialist execution was assumed to work); RUN_6/RUN_7 made it concrete
by exposing the pre-existing `measure-distance.ts` `version_number` bug
that crashed every subprocess. After bureau#324 + conductor#153/#154,
Goal C runs at 100% on both runs (every measure-distance subprocess
that was invoked returned distances). Goal D — does the agent's final
verdict reflect the measurement evidence — is **phase-2 / iter-2
territory**; called out explicitly here so future runs surface it
rather than rediscovering.

## What we're proving

Iter 1's job is to prove the **vision_check routing architecture (var2)
matches or beats the bifurcated-tools architecture (var1) on the
selection + execution chain** (Goals A, B, C). Whether the agent then
correctly *interprets* the specialist's output into a pass/fail/n-v
verdict (Goal D) is a separate, downstream question — split out for
iter-2 so iter-1 success is well-scoped.

Goals A and B remain the original iter-1 criteria. Goal C joined as
an explicit metric once we saw it crash. Goal D is the named follow-up.

- **A — Overall invocation hit rate.** Of checklist items expected to
  need vision, what fraction got at least one vision call?
- **B — Specialist selection rate.** Of items expected to route to a
  specialist, what fraction got the right specialist invocation?
- **C — Correct tool execution.** Of items where the right specialist
  was invoked (Goal B met), what fraction had the specialist subprocess
  complete successfully and return useful data?
- **D — Correct post-result verdict.** *(Phase-2.)* Of items where
  Goals A, B, and C are all met, what fraction had the agent's final
  verdict (pass/fail/not-verifiable/n/a) match ground truth?

## The three variants

Each variant is defined by the tools the top-level agent has access to.
Specialists themselves are unchanged across variants — what varies is
which the agent can pick.

| Variant | Top-level agent tools | Notes |
|---|---|---|
| **`ctrl-baseline`** | generic `vision` only | Production prompt. No specialists exposed. |
| **`var1-bifurcated-vision-tools`** | generic `vision` + workflow specialist | cc adds `inspect-drawing`; review adds `measure-distance`. Agent picks. |
| **`var2-vision-specialist-routing`** | `vision_check` only | Agent calls vision_check; internal classifier dispatches to generic / specialist. |

> Naming guard: don't call var1 "the baseline." var1 is bifurcated.
> ctrl-baseline is the control. The historical "experiment-run7" /
> "inspect-drawing run1" runs that earlier docs called "baseline" are
> var1 data.

## The two experiment sets

| Set | Workflow | checklistVersion / guideCode | Specialist | Submission |
|---|---|---|---|---|
| **cc** | completeness-check | `v2.5-trimmed` | `inspect-drawing` | 1700 S. Lamar v2 |
| **el-md-exp** | review | `el-md-exp` | `measure-distance` | Valley View Townhomes v2 |

Each set runs all three variants on the same submission so cross-variant
comparison is apples-to-apples.

## The 4 TSVs per set (8 total)

All 4 share the same per-checklist-item key. TSVs 2–4 join 1:1 against
TSV #1 so ctrl / var1 / var2 are directly comparable per item.

### TSV 1 — `expected-vision-selection` (static ground truth)

One row per checklist item. Schema:

| Column | Type | Notes |
|---|---|---|
| `item_id` | string | Stable checklist item key (e.g. `AW-21`, `cc-13-05`). |
| `item_text` | string | Full checklist text. |
| `expected_vision` | yes \| no | Should this item produce any vision call? |
| `expected_specialist` | none \| generic \| inspect-drawing \| measure-distance | If yes: which specialist? `generic` = vision call expected but not specialist-routed. `none` only when `expected_vision=no`. |
| `notes` | string | Free-form (e.g. "compound — has both measurement and drawing-inspect components"). |

Built by lifting + normalizing existing classifications:
- cc → `../cc-vision-classification/cc-classification.tsv`
- el-md-exp → `../measure-distance-tool/analysis/guides/el-md-exp/item-classification.json`

Updated only when the checklist content itself changes.

### TSVs 2–4 — invocation hit rate per variant

Each variant produces **two TSVs** in its directory:

- **`per-item-run.tsv` (raw, long format).** One row per (item × run).
  Source-of-truth for the variant's measurements.
- **`per-item.tsv` (aggregated).** One row per item. Derived from
  `per-item-run.tsv` by applying the majority-vote rule below.

**All headline metrics (Goal A, Goal B) are computed against the
aggregated TSV.** The raw per-(item × run) TSV is preserved so we can
re-aggregate, debug variance, or change the aggregation rule without
re-pulling artifacts.

#### `per-item-run.tsv` schema (raw)

| Column | Type | Notes |
|---|---|---|
| `item_id` | string | Joins to TSV 1. |
| `run_index` | int | 1-based. Different variants may have different total run counts; long format absorbs that. |
| `run_label` | string | Source run identifier (e.g. `VISION_CHECK_CC_BASELINE`) for traceability. |
| `tool_called` | none \| generic-vision \| inspect-drawing \| measure-distance \| vision-check-generic \| vision-check-inspect-drawing \| vision-check-measure-distance | What the agent actually invoked for this item in this run. `none` = no vision call attributed to this item. |
| `call_count` | int | Number of distinct vision calls attributed to this item in this run. ≥0. |
| `notes` | string | Optional flags ("multi-call", "fallback", etc.). |

The `tool_called` enum collapses 3 cases:
- ctrl: `none` or `generic-vision`.
- var1: `none`, `generic-vision`, or `<specialist>`.
- var2: `none`, `vision-check-generic`, or `vision-check-<specialist>`.

This keeps a single column shape across all 3 variants, with the
`vision-check-*` prefix marking that the call went through the router.

#### `per-item.tsv` schema (aggregated)

| Column | Type | Notes |
|---|---|---|
| `item_id` | string | Joins to TSV 1. |
| `runs_total` | int | How many runs of this variant produced data for this item. |
| `runs_called` | int | How many of those runs had `tool_called != "none"`. |
| `total_calls` | int | Sum of `call_count` across runs. |
| `vision_invoked` | yes \| no | **Strict majority vote:** `2 × runs_called > runs_total`. Ties fail. |
| `tool_called` | none \| generic-vision \| inspect-drawing \| measure-distance \| vision-check-* | If `vision_invoked = yes`, the most-voted tool among calling runs. Otherwise `none`. |

> **TSV 2 prompt-capture deferred.** The baseline `vision` tool currently
> logs only `{event, documentId, sheetNum, success, timestamp}` — no
> prompt, no per-call checklist item attribution. We can still derive
> "did vision get called for this item" from the agent trace +
> `applicableChecklistItems`. Prompt-level analysis stays a TODO; iter-1
> hit-rate proof doesn't need it.

## Aggregation rule (locked-in 2026-05-07)

**Strict majority vote across runs.** An item is "vision invoked" when
`2 × runs_called > runs_total`. Ties (e.g. 1 of 2 runs) fail.

| `runs_total` | Threshold for "invoked" |
|---|---|
| 1 | ≥1 of 1 |
| 2 | ≥2 of 2 (1/2 fails the tie) |
| 3 | ≥2 of 3 |

This rule lets TSVs with different run counts (e.g. var2 cc run-4 was
`runs=1`) plug into the same metrics pipeline without changing the
math. We aspire to `runs=3` everywhere for variance reasons but won't
block headline numbers on it.

## How the TSVs answer A and B

All formulas operate on the **aggregated** `per-item.tsv` (post majority
vote), joined against the static TSV 1 (`expected.tsv`). One row per
item.

- **A** (overall hit rate, per variant) = `(# items where vision_invoked=yes) / (# items where TSV 1 says expected_vision=yes)`.
  Computed for ctrl, var1, var2 independently. Need **var2 ≥ var1**.
- **B** (specialist selection rate, per variant) = `(# items where tool_called matches TSV 1's expected_specialist) / (# items where TSV 1 says expected_specialist is a named specialist — i.e. inspect-drawing or measure-distance)`.
  Computed for var1 and var2. Need **var2 ≥ var1**.

For B, the `vision-check-<specialist>` cases count as matching the
specialist (the routing path is irrelevant to the selection question).
The `expected_specialist=generic` items are excluded from B's
denominator — they need vision but not a specialist, so they aren't a
specialist-selection test.

## How Goal C is computed

Goal C uses data outside the `per-item.tsv` aggregation — specifically
the per-call specialist sidecars under
`output/vision-check-calls/<id>/specialist-<name>/<name>-calls/<inner>/metadata.json`.

For each call where the classifier intent matched the expected
specialist (i.e. the per-call contribution to Goal B), check whether
the specialist subprocess actually produced a usable result:

- **measure-distance:** ≥1 pair returned a `result.distanceFeet` value
  (per-pair metadata.json carries this).
- **inspect-drawing:** returned a non-`unanswerable` classification (or
  `count` ≥ 0 when expectedAnswerType=count), with `evidence` populated
  per the schema's validation rules.

**Goal C (per variant)** =
`(# items where Goal B is met AND the specialist subprocess returned a usable result on ≥1 call) / (# items where Goal B is met)`.

In other words, Goal C is conditional on Goal B. The denominator
shrinks to "the specialist was correctly selected" items only; the
numerator counts those that also executed cleanly. **Goal B' as used
in the RUN_6/RUN_7 analyses is equivalent to "Goal C measured against
the Goal-B-eligible denominator", just reported as a fraction of all
expected-specialist items** (a sometimes-clearer absolute view).

For RUN_7 (runs=3 var-2, el-md-exp):
- Goal B = 14/51 items routed correctly to measurement
- Goal C = 11/14 of those had measure-distance return ≥1 distance (= 78.6%)
- Reported in absolute terms: 11/51 = 21.6% (= Goal B').

The 3 items where Goal B was met but Goal C wasn't are misroutes-of-a-different-kind:
the classifier picked measurement but the extractor returned 0 pairs,
so measure-distance never ran. Those are the next-iteration prompt-tuning
targets.

## Goal D — phase-2 follow-up (not measured today)

Goal D asks: **once we've selected the right specialist (B) and
executed it correctly (C), did the agent take the result and reach
the correct final verdict?**

The agent's per-finding `status` field (`pass | fail | not-verifiable | n/a`)
is what reviewers see. Today we don't have ground-truth labels for
"correct verdict per checklist item," only for `expected_vision` and
`expected_specialist`. To formalize Goal D we'd need:

1. **Ground-truth `expected_verdict_for_submission` labels** for at
   least the expected-measure-distance items on the canonical
   submission(s). For Valley View v1 + el-md-exp, that means hand-
   labeling 51 items with the correct pass/fail/n-v verdict against
   the actual sheets.
2. **A scoring rule for `not-verifiable`.** If ctrl produced
   `not-verifiable` because vision-alone can't measure, and var-2
   ran the measurement, then the *expected* var-2 verdict is whichever
   the measurement supports. We can't just compare to ctrl's verdict —
   that's the regression case we're explicitly trying to escape.

Open observations from RUN_6 + RUN_7 that motivate Goal D:

- **RUN_7 EL-2.1**: ctrl was unanimous `fail` (3/3), var-2 RUN_7 was
  unanimous `not-verifiable` despite 9 measure-distance pairs running
  successfully. The chain produced data; the agent didn't escalate to
  fail. Suspected: the agent's post-measurement verdict prompt
  doesn't aggressively reason from the new measurement evidence.
- **RUN_7 EL-1.37**: ctrl `not-verifiable:2, fail:1`; var-2 RUN_7
  `not-verifiable:2, fail:1` — same distribution despite 13 distance
  measurements computed. No aggregation lift from the measurements.
- **RUN_7 EL-13.10, EL-13.13, EL-13.21–.27**: pattern of
  `not-verifiable:2 + 1 dissent` despite the chain running cleanly.
  Suggests the agent erring on the side of "needs human review" in 2
  of 3 runs.

These cases are the seed for iter-2's Goal D work.

## Storage layout

```
metrics/
  cc/
    expected-vision-selection/
      expected.tsv
      source.md            # which classification got lifted, normalization notes
    ctrl-baseline-vision-invocation/
      runs.md              # source runs (run IDs, labels, dates) feeding this variant
      per-item-run.tsv     # raw long-format TSV (per item × run)
      per-item.tsv         # aggregated TSV (post majority-vote)
      goal-a.md            # variant's headline goal-A breakdown
      scripts/             # build.py (raw) + aggregate.py (post-vote)
    var1-bifurcated-vision-tools/
      runs.md
      per-item-run.tsv
      per-item.tsv
      goal-a.md
      scripts/
    var2-vision-specialist-routing/
      runs.md
      per-item-run.tsv
      per-item.tsv
      goal-a.md
      scripts/
  el-md-exp/
    ...same structure...
  analysis.md              # cross-variant A/B writeup; populated once all 8 TSVs land
```

> Open: `metrics/` at workspace root vs `experiments/metrics/`. Pending
> confirmation.

Raw artifacts (per-call metadata.json, etc.) continue to live under
`experiments/<run-dir>/<set>/output/`. The metrics scripts read from
those raw paths and emit the per-item-run.tsv summaries above.

## Open items

1. **`metrics/` placement** — workspace root or under `experiments/`?
2. **Run sourcing per cell.** Pending data inventory:
   - ctrl cc: `VISION_CHECK_CC_BASELINE` (done) — usable
   - ctrl el-md-exp: `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V2` (done; agent-trace silently failed) — usable for hit-rate but limited
   - var1 cc: historical `inspect-drawing run1` lives in `winston/workspaces/measure-distance-tool/...` and needs locating + sanity-check
   - var1 el-md-exp: historical `experiment-run7` / `7.2` (had measure-distance overlay; same submission)
   - var2 cc: `VISION_CHECK_CC_RUN_4` (latest, runs=1, post-prompt-trim) — newest, likely usable
   - var2 el-md-exp: `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_1` (smoke, pre-bureau#310) — likely needs re-fire
   The run-sourcing inventory + clean/dirty assessment is the next
   conversation. Re-firing for clean conditions is acceptable if the
   existing data has confounds we can't argue past.

## Locked-in decisions (2026-05-07)

- 3 variants named `ctrl-baseline` / `var1-bifurcated-vision-tools` / `var2-vision-specialist-routing`.
- 4 TSVs per set (8 total): `expected-vision-selection` (static, 1 per set) + per-variant hit-rate data (3 per set). Each variant ships **two** TSVs: raw `per-item-run.tsv` (long format, per item × run) + aggregated `per-item.tsv` (post majority-vote).
- TSV 1 lifted + normalized from existing classifications, not re-LLM-built.
- Per-call prompt capture deferred (open TODO; not blocking hit-rate proof).
- **Aggregation rule: strict majority vote across runs** (`2 × runs_called > runs_total`; ties fail). Applies uniformly across variants regardless of `runs_total`. All headline metrics (A, B) are reported post-aggregation, against `per-item.tsv`.
- Goals A (overall hit rate) and B (specialist selection rate). **var2 ≥ var1**.
- ~~Specialist execution accuracy explicitly out of scope for iter 1.~~ **Extended 2026-05-11:** Goal C (correct tool execution) added once it became measurable — now sits at 100% post bureau#324 + conductor#153/#154. Goal D (correct post-result verdict) is the named iter-2 follow-up.

## Related

- [`plan.md`](./plan.md) — original design + decisions log + phase plan.
- [`README.md`](./README.md) — workspace orientation.
- [`problem-statement.md`](./problem-statement.md) — original hit-rate
  motivation (note: numbers there are var1 specialist-recall, not
  cross-variant hit rate; will be re-derived once the TSV pipeline is
  in place).
