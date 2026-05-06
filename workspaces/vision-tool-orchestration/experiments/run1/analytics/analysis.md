# Vision-Check Experiment — CC Run 1 Analysis

**Date:** 2026-05-06
**Run:** Local conductor run, 1 run (not 3), completeness-check with `experiment=vision-check`
**Submission:** 1700 S. Lamar v2 (projectId `23301a8a`, submissionVersionId `eb67ee21`)
**Baseline:** inspect-drawing run1 (~8% recall on required items, ~8–13% headline)

---

## Executive Summary

Headline recall improved from **~8–13%** to **34.4%** — a clear lift from
routing through `vision_check`. However, the specialist dispatch path was
**broken in this local run** — all 62 vision-check calls fell back to
generic `vision` regardless of classifier output. This means:

1. **Classifier results are real** — we can evaluate routing accuracy.
2. **Specialist execution accuracy is unmeasurable** — every call hit
   generic vision, so we can't compare inspect-drawing vs generic
   performance.
3. **Headline recall reflects agent selection behavior** (which items the
   agent chose to call `vision_check` on), not specialist effectiveness.

The 34.4% recall is entirely from the agent calling `vision_check` more
broadly than it previously called the individual specialist tools. The
experiment validated that giving the agent a single entry point increases
tool usage, even when the specialist dispatch is inert.

---

## 1. Headline Recall

| Grade                    | Called | Total | Rate  |
|--------------------------|--------|-------|-------|
| inspect-drawing-required | 3      | 8     | 37.5% |
| inspect-drawing-optional | 22     | 46    | 47.8% |
| vision-only              | 28     | 100   | 28.0% |
| no-tool                  | 0      | 31    | 0.0%  |
| **SHOULD-CALL total**    | **53** | **154** | **34.4%** |

**Misuse rate: 0.0%** — no `no-tool` items received a `vision_check` call.

### Required items detail

3/8 required items were called:
- ✅ `cc-13/AW-21` — pipe sizes/material/double-line styling
- ✅ `cc-13/AW-23` — wastewater flow direction arrows
- ✅ `cc-22/CC-22-14` — adjacent driveways within 300 feet

5/8 missed:
- ❌ `cc-13/AW-28` — retaining wall components (geogrid, straps, tie-backs)
- ❌ `cc-13/AW-32` — typical cross sections for private streets/easements
- ❌ `cc-13/AW-39` — drain-field delineation
- ❌ `cc-19/CC-19-05` — drainage easements contain 100-year floodplain
- ❌ `cc-19/CC-19-19` — drainage area maps (flow arrows, contours, spot elevations)

The missed items are all in the `cc-13` (AW) and `cc-19` (drainage)
groupings. Most involve complex spatial/drawing reasoning (cross sections,
containment checks, drainage symbology). The agent didn't attempt
`vision_check` on these at all — this is an **agent selection failure**,
not a routing or specialist failure.

### Comparison to baseline

| Metric                   | Baseline (inspect-drawing run1) | Vision-Check run1 |
|--------------------------|----------------------------------|-------------------|
| Required-item recall     | ~8%                              | 37.5%             |
| Headline recall (should) | ~8–13%                           | 34.4%             |
| Misuse rate              | ~0%                              | 0.0%              |
| Calls per run            | varies                           | 62                |

---

## 2. Classifier Routing Distribution

Of 62 vision-check calls:

| Classifier route   | Count | % of calls |
|--------------------|-------|------------|
| `generic`          | 40    | 64.5%      |
| `drawing_inspect`  | 22    | 35.5%      |
| `measurement`      | 0     | 0.0%       |

No `measurement` classifications — expected, since cc items are
completeness-check (document presence, drawing inspection), not
distance measurement.

### Confidence distribution

| Range   | Count |
|---------|-------|
| 0.9–1.0 | 45    |
| 0.8–0.9 | 17    |
| < 0.8   | 0     |
| **Mean** | **0.919** |

The classifier (Haiku 4.5) is highly confident on all items. No
low-confidence calls at all. This means a confidence threshold
(decision E2) would have no effect — the classifier never hedges.

---

## 3. Routing Accuracy

Fuzzy-matched 51/62 calls to ground-truth item IDs (11 unmatched due
to text-similarity below 0.65 threshold).

### Confusion matrix

| Expected route ↓ \ Actual → | `drawing_inspect` | `generic` | Total |
|------------------------------|-------------------|-----------|-------|
| `drawing_inspect`            | **17**            | 14        | 31    |
| `generic`                    | 2                 | **18**    | 20    |

### Per-route accuracy

| Route             | Correct | Total | Accuracy |
|-------------------|---------|-------|----------|
| `drawing_inspect` | 17      | 31    | **54.8%** |
| `generic`         | 18      | 20    | **90.0%** |

The classifier is **good at identifying `generic` items** (90%) but
**misclassifies ~45% of `drawing_inspect` items as `generic`**. This
is the dominant classifier failure mode.

The 14 drawing_inspect items misrouted to `generic` are the main
opportunity. If routing accuracy on `drawing_inspect` improved to ≥80%,
and specialist dispatch worked, we'd expect meaningful execution-accuracy
gains.

---

## 4. Dispatch Failure — `workflowPath_not_provided_specialists_unreachable`

**All 62 calls dispatched to generic `vision`.** The 22 calls classified
as `drawing_inspect` fell back because `workflowPath` was not provided
in the local run configuration, so conductor couldn't locate the
specialist tool entry points (inspect-drawing, measure-distance).

```
specialist dispatched -> vision: 62 (100%)
fallback reason: workflowPath_not_provided_specialists_unreachable (22 calls)
```

**Root cause:** The local conductor run didn't pass `workflowPath` to
the `vision_check` tool, which needs it to resolve the bureau script-tool
paths for inspect-drawing and measure-distance. This is a configuration
issue, not a code bug — the fallback-to-generic path worked correctly.

**Impact:** We cannot measure **conditional execution accuracy** (metric 2
from the eval plan) in this run. All items got generic vision regardless
of classification.

---

## 5. Interpretation & Next Steps

### What this run tells us

1. **Single entry point increases tool usage.** The agent called
   `vision_check` on 53/154 should-call items (34.4%) vs ~8–13% for the
   individual specialist tools. The simpler tool interface is working.

2. **Classifier routing is partially effective.** Generic accuracy is
   high (90%). Drawing-inspect accuracy is 54.8% — room for improvement
   but the classifier is directionally correct on most items.

3. **Zero misuse.** The agent correctly avoids calling `vision_check` on
   items that don't need vision.

4. **Agent selection is the primary bottleneck.** 101/154 should-call
   items didn't get a `vision_check` call at all. The agent decided not
   to use the tool. This is a prompt/agent behavior issue, not a
   classifier or specialist issue.

### What this run doesn't tell us

- Whether specialist dispatch improves execution quality (dispatch was
  broken).
- Whether the 34.4% headline recall holds across 3 runs (this was 1 run).
- Whether measurement routing works (no measurement items in cc).

### Recommended next steps

1. **Fix the `workflowPath` configuration** so specialist dispatch
   actually works. Re-run with working dispatch to measure conditional
   execution accuracy.

2. **Run 3x** per the eval plan to get variance estimates on recall.

3. **Investigate agent selection.** Why does the agent skip 101 should-call
   items? Is the experimental `review.md` prompt not aggressive enough
   about when to call `vision_check`? The missed required items (AW-28,
   AW-32, AW-39, CC-19-05, CC-19-19) suggest the agent doesn't attempt
   visual checks on complex spatial items.

4. **Improve drawing_inspect routing.** The 14 items misrouted from
   `drawing_inspect` → `generic` could benefit from better few-shot
   examples or a refined taxonomy description in `vision-router.md`.

### Iter-2 path assessment (per F1 trigger split)

Cannot fully assess yet because specialist dispatch was inert. However:
- Classifier accuracy on `drawing_inspect` is 54.8% (below the 70%
  threshold), and failures DO cluster on text-ambiguous items.
- This suggests the **outer-grounding vision pass** path may be needed
  — but we need working dispatch first to confirm whether the classifier
  or the specialist is the dominant bottleneck.

**Current dominant failure mode: agent selection (not calling the tool),
not routing or execution.**

---

## Artifacts

| File | Description |
|------|-------------|
| `vision-call-invocation-metrics.tsv` | Canonical eval artifact: 185 items × grade × expected/actual tool call × finding status |
| `vision-check-calls-audit.tsv` | Debug/audit: 62 calls with fuzzy match score, classifier reasoning, dispatch result |
| `analyze.py` | Analysis script (produces both TSVs) |
| `../cc/output/vision-check-calls/` | Raw per-call metadata (62 calls) |
| `../cc/output/runs/run-1/findings/` | Per-grouping finding files |
