# Vision-Check Experiment — CC Run 3 Analysis

**Date:** 2026-05-06
**Run:** Dispatcher run (Substation/Inngest), runs=1, completeness-check with `experiment=vision-check`
**Submission:** 1700 S. Lamar v2 (projectId `23301a8a`, submissionVersionId `eb67ee21`)
**`runLabel`:** `VISION_CHECK_CC_RUN_3` · workflow_runs.id `e664a703-59d0-43c2-9aba-2537d1700367`
**Wall-clock duration:** 45 min 59 sec
**Versus run 1:** Both runs=1 stochastic; comparison is directional, not statistical.

---

## Executive summary

This is the **first end-to-end run** of the vision-check experiment with the
new `vision_check` schema (conductor#146 + bureau#305) and the dimension-anchor
classifier prompt (bureau#301) live. Three big things changed since run 1:

1. **Specialist dispatch is no longer faked.** Run 1 had the `workflowPath`
   bug (conductor#145) that fell back to plain vision on every drawing_inspect
   route. Run 3 actually invokes the bureau inspect-drawing script, with full
   cropped-image artifacts in `output/vision-check-calls/<callId>/specialist-inspect-drawing/`.
   46 of 47 drawing_inspect routes dispatched successfully; 1 errored.
2. **Classifier sees both canonical text AND agent question.** No more
   single-input ambiguity.
3. **Gemini receives the agent's phrased question, not the deficiency
   statement.** The previous regression vs the standalone `vision` tool is
   fixed.

### Headline numbers

| Metric | Run 1 (runs=1, old schema) | **Run 3 (runs=1, new schema)** |
|---|---:|---:|
| Vision-check calls total | 62 | **96** |
| Items where vision_check called (≥1 call) | 62/154 = 40.3% | **31/154 = 20.1%** |
| **Cluster A+B routing fix (target of bureau#301)** | 0/6 correct | **6/6 correct ✓** |
| Inspect-drawing routes dispatched (vs. fallback) | 0/14 | **46/47** |
| Misuse (no-tool items called) | 0/31 | **0/31 ✓** |
| Classifier mean confidence | — | **0.951** |
| Routing accuracy: drawing_inspect | — | **66.7%** (36/54) |
| Routing accuracy: generic | — | **73.8%** (31/42) |

---

## Cluster A + B — the headline win

The whole reason for bureau#301 + the schema change was to fix the 12
inspect-drawing items run 1 misrouted to `generic`. Run 3 outcome:

| Cluster | Item | Run 1 route | **Run 3 route** |
|---|---|---|---|
| A | `cc-22:CC-22-12` (Driveway spacing dimensions) | generic → vision | **drawing_inspect → inspect-drawing ✓** |
| A | `cc-22:CC-22-13` (Driveway widths / curb return radii) | generic → vision | **drawing_inspect → inspect-drawing ✓** |
| A | `cc-22:CC-22-20` (Parking aisle widths) | generic → vision | **drawing_inspect → inspect-drawing ✓** |
| A | `cc-23:CC-23-01` (ROW width) | generic → vision | **drawing_inspect → inspect-drawing ✓** |
| A | `cc-23:CC-23-04` (Dimensions for ROW improvements) | generic → vision | **drawing_inspect → inspect-drawing ✓** |
| B | `cc-2:CC-2-16` (Boundary lines + bearings) | generic → vision | **drawing_inspect → inspect-drawing ✓** |

**6/6 items flipped to the correct route.** Several have multiple drawing_inspect
calls (the agent doing progressive verification across sub-features). Pattern 2
items (CMP-01/02, AW-18, CC-23-03/10) — deliberately not addressed by bureau#301 —
were not measured here (the agent didn't choose to call vision_check on most of
them this run).

Worth noting: the analyzer uses **exact `checklistItemId` matching** for run 3
(no fuzzy matching needed — the new schema records the id directly). 96/96 calls
matched exactly. We can finally trust call → item attribution without the
±0.05 fuzzy-match noise from run 1.

---

## Vision-check call rate dropped, but call density per item went up

Two surprising shape differences vs run 1:

- **Total calls went UP** (62 → 96).
- **Unique items where vision_check fired went DOWN** (62 → 31).

So the same agent produced **3.1× more calls per item** in run 3 (96/31) vs
**1.0 calls per item** in run 1 (62/62). That's the progressive-verification
pattern from the new prompt actually showing up in behavior — the agent makes
multiple specific sub-question calls on the items it does decide to investigate.

But the agent invoked vision_check on fewer items overall. Two non-mutually-
exclusive explanations, can't separate at runs=1:

1. **The new "Tips for phrasing" guidance made the agent more selective.**
   Each call requires phrasing a real question; that's more cognitive work,
   so the agent skips items it can answer from text. Possibly fine — those
   items might genuinely not need vision.
2. **Stochastic variance.** runs=1 is one sample of agent behavior; we'd
   expect ±10–15% swing between runs. Baseline (runs=3) showed per-run
   range of 30–38% — run 3's 20% sits below that range.

Per-grade headline recall vs run 1:

| Grade | Run 1 (runs=1) | **Run 3 (runs=1)** |
|---|---:|---:|
| inspect-drawing-required | 3/8 = 38% | **1/8 = 13%** |
| inspect-drawing-optional | — | **20/46 = 44%** |
| vision-only | — | **10/100 = 10%** |
| no-tool (misuse) | 0/31 = 0% | **0/31 = 0% ✓** |
| **SHOULD-CALL** | — | **31/154 = 20%** |

The drop on inspect-drawing-required (3/8 → 1/8) is the biggest concern. All
7 misses are in cc-13 (AW items) and cc-19. Cluster A+B fixed routing for the
items the agent **did** call vision_check on; the new failure mode is the
agent choosing not to call vision_check at all on certain inspect-drawing
items. That's Failure Mode 1, not 2.

Whether this is a real regression vs run 1 or stochastic variance needs runs=3
to disambiguate.

---

## Specialist dispatch — first real measurement

Run 1: 14 drawing_inspect routes, **all fell back** to plain vision because of
the workflowPath bug. We never saw real inspect-drawing execution data.

Run 3: 47 drawing_inspect routes, **46 dispatched successfully**. The single
failure (`dispatch_success=false` with `specialistCalled=inspect-drawing`) is
worth investigating — could be a transient subprocess error, a bbox normalize
failure, or a Gemini-side timeout.

Each successful inspect-drawing call now has full artifacts on disk:
`vision-check-calls/<vc-callId>/specialist-inspect-drawing/inspect-drawing-calls/<id-callId>/{cropped.jpg, prompt.txt, response.txt, metadata.json, events.jsonl}`.
The inspect-drawing debug viewer at `winston/workspaces/inspect-drawing-tool/viewer/`
can render these once they're pulled into `runs/` (existing pull-run.py supports
both flat and per-run-index layouts after PR #43).

Generic route: 49 calls dispatched, 47 success / 2 errors (4% failure rate —
also worth a look but minor).

---

## Routing accuracy (calls × ground truth)

96/96 calls matched exactly to ground-truth items. Confusion matrix:

| Expected → | drawing_inspect | generic | total |
|---|---:|---:|---:|
| **drawing_inspect** (truth) | **36 ✓** | 18 ✗ | 54 |
| **generic** (truth) | 11 ✗ | **31 ✓** | 42 |

- Drawing_inspect precision: 36/47 = 76.6%
- Drawing_inspect recall (per-call): 36/54 = 66.7%
- Generic precision: 31/49 = 63.3%
- Generic recall (per-call): 31/42 = 73.8%

Bidirectional misroutes now: 18 drawing_inspect items routed to generic, 11
generic items routed to drawing_inspect. Run 1 had ~30 inspect-drawing →
generic and 0 generic → drawing_inspect; the new prompt traded one-directional
misclassification (under-predicting drawing_inspect) for some bidirectional
noise. Net: drawing_inspect routes are now ~3× more frequent than run 1, with
much better precision on the items they land on.

Classifier confidence stayed high: mean 0.951, range 0.85–0.99. The classifier
isn't expressing uncertainty on its mistakes — same calibration pattern as run 1.

---

## Open questions for next iteration

1. **Is the inspect-drawing-required drop (3/8 → 1/8) real or noise?** Need
   runs=3 to know. Fire `VISION_CHECK_CC_RUN_4` with `runs=3` and `maxWorkers=39`
   (per-project memory note) — should fit in the 3-hour cap based on run 3's
   46-min single-run time.
2. **Why did the agent skip vision_check on cc-13 AW items in this run?**
   The 7 missed inspect-drawing-required items are heavily concentrated in
   `cc-13` (AW). Worth eyeballing: did the agent answer them from text? Did
   it choose semantic-search-blocks instead? Is there something about AW
   item phrasing that makes vision feel unnecessary?
3. **Pattern 2 misroutes still expected.** Items like CMP-01, AW-18, CC-23-03
   weren't addressed by bureau#301. They didn't show up in run 3 misroutes
   only because the agent didn't call vision_check on them at all. They'll
   surface again on a run where the agent is more aggressive.
4. **Specialist execution accuracy.** First run with real inspect-drawing
   data. Next pass: pull the 46 successful drawing_inspect calls into the
   debug viewer and spot-check whether the answers Gemini returns are
   correct.
5. **The 1 inspect-drawing failure + 2 vision failures.** Small numbers
   but worth root-causing before they grow at runs=3.

---

## Files

- `vision-call-invocation-metrics.tsv` — 185 rows, one per checklist item.
  Same column shape as run 1.
- `vision-check-calls-audit.tsv` — 96 rows, one per vision-check call.
  Adds two columns vs run 1: `match_method` (always `exact` here),
  `agent_question_preview` (first 100 chars of the agent's phrased question).
- `analyze.py` — derived from run 1's analyzer; the matcher prefers exact
  `checklistItemId` matching over fuzzy text matching.
