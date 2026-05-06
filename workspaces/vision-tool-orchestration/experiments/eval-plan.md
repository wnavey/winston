# Vision-Check Eval Plan — Inspect-Drawing Hit Rate

## Metric: inspect-drawing tool invocation hit rate

For each checklist item graded `inspect-drawing-required` or
`inspect-drawing-optional` in `cc-vision-classification/cc-classification.tsv`:

> Was the inspect-drawing specialist actually invoked for this item?

**Denominator:** items where `grade ∈ {inspect-drawing-required, inspect-drawing-optional}`
AND `finding_status ≠ not-applicable` (conditional items where the
condition wasn't triggered are excluded — they're correctly skipped).

**Numerator:** items where inspect-drawing was actually invoked. What
counts as "invoked" differs between the baseline and experiment (see
below).

Data source: `experiments/run1/analytics/vision-call-invocation-metrics.tsv`
— columns `grade`, `actual_vision_tool_call`, `finding_status`.

---

## Two distinct failure modes

When an inspect-drawing item doesn't get inspect-drawing invoked, it
fails for one of two independent reasons. These have different root
causes and different fixes.

### Failure mode 1: Agent doesn't call the tool at all

**Signature in TSV:** `actual_vision_tool_call = "not called"` on an
applicable inspect-drawing item.

**What happened:** The top-level review agent processed the checklist
item and decided it didn't need a visual check. It answered from
semantic search / text alone. Inspect-drawing never had a chance.

**Root cause:** Agent prompt / behavior. The experimental `review.md`
isn't aggressive enough about when to invoke `vision_check`, or the
agent's own judgment doesn't recognize these items as needing visual
inspection.

**Fix surface:** Bureau — the experimental `review.md` prompt in
`workflows/completeness-check/experiments/vision-check/review.md`.
Possibly also the checklist item text itself (if it doesn't signal
that visual inspection is needed).

### Failure mode 2: Agent calls vision_check but classifier misroutes

**Signature in TSV:** `actual_vision_tool_call` contains
`generic -> vision` (or any route other than `drawing_inspect`) on an
applicable inspect-drawing item.

**What happened:** The agent correctly decided the item needed a visual
check and called `vision_check`. The Haiku classifier read the item
text and routed it to `generic` instead of `drawing_inspect`. The item
got a generic vision answer instead of a specialist inspect-drawing
analysis.

**Root cause:** Classifier prompt / few-shot examples. The classifier
treats "check if X is shown/present on the drawing" as a generic
presence check, even when X is a drawing element (boundary lines,
dimension annotations, symbology) that requires spatial reasoning.

**Fix surface:** Bureau — the classifier prompt in
`workflows/completeness-check/prompts/vision-router.md`. Specifically
the few-shot examples and the taxonomy descriptions.

---

## What we need to measure

### Run matrix

| Run | Experiment flag | Purpose | Status |
|-----|-----------------|---------|--------|
| **Baseline** | none (production prompt) | Measure how often the agent calls generic `vision` on inspect-drawing items with the standard 3-tool list | **needed** |
| **Experiment run1** | `--experiment=vision-check` | Measure vision_check invocation + classifier routing accuracy | done (local, 1 run) |
| **Experiment run2** | `--experiment=vision-check` (with workflowPath fix) | Re-run with specialist dispatch working so we can measure execution accuracy | **needed** |

All runs use the same submission: 1700 S. Lamar v2, completeness-check,
`checklistVersion=v2.5-trimmed`.

### Why we need a baseline run

The experiment run1 shows 101/154 should-call items got no `vision_check`
call (failure mode 1). But we don't know if this is:

**(a) Status quo** — the agent also doesn't call generic `vision` on
these items in the production prompt. The single-entry-point experiment
didn't make things worse; the agent was already skipping them. This
means the fix is in the checklist item text or the prompt's guidance
about when to use vision — and it's not a regression from the
experiment.

**(b) Regression** — the agent DOES call generic `vision` more
aggressively on these items in the production prompt, but the
experimental prompt's "Using the Vision Check Tool" section is less
effective at triggering tool use. This means the experiment prompt
needs to be rewritten.

The baseline run lets us compute a **delta**:

```
baseline_vision_hit_rate  = items where agent called `vision` / applicable inspect-drawing items
experiment_vc_hit_rate    = items where agent called `vision_check` / applicable inspect-drawing items
```

If `experiment_vc_hit_rate ≈ baseline_vision_hit_rate`, the experiment
preserved agent behavior and we should focus on failure mode 2
(classifier routing). If `experiment_vc_hit_rate < baseline_vision_hit_rate`,
the experiment prompt is suppressing tool calls and needs rework.

### Baseline run details

Same payload as experiment run1 but without the experiment flag:

```json
{
  "workflowName": "completeness-check",
  "jurisdiction": "austin",
  "inputs": {
    "projectId": "23301a8a-4cdb-4751-ac0c-93b97f0f5c12",
    "submissionVersionId": "eb67ee21-76b1-4065-b20d-c32f674add12",
    "checklistVersion": "v2.5-trimmed",
    "runs": 1,
    "setCurrent": false,
    "runLabel": "VISION_CHECK_CC_BASELINE"
  }
}
```

**Analysis after baseline completes:**

Join baseline findings against the same `cc-classification.tsv` ground
truth. For each applicable inspect-drawing item, record whether the
agent called `vision` (the generic tool name in the production prompt).
Produce a comparable `vision-call-invocation-metrics.tsv` for the baseline.

Then compare side-by-side:

| Item | Baseline (vision called?) | Experiment (vision_check called?) | Experiment classifier route |
|------|---------------------------|-----------------------------------|-----------------------------|
| ... | yes/no | yes/no | drawing_inspect / generic / n/a |

This tells us exactly which items changed behavior between prompts.

---

## Analysis sequence

1. **Run baseline** — local conductor, no experiment flag, 1 run
2. **Pull baseline artifacts** into `experiments/baseline/cc/output/`
3. **Generate baseline comparison TSV** — same shape as
   `vision-call-invocation-metrics.tsv` but with `vision` tool instead of
   `vision_check`
4. **Compute delta** — which items switched from called → not-called
   (or vice versa) between baseline and experiment?
5. **Quantify failure mode split:**
   - FM1 (agent selection): applicable inspect-drawing items where
     vision_check was not called AND baseline also didn't call vision
     → systemic gap, needs checklist/prompt work
   - FM1-regression: items where baseline called vision but experiment
     didn't call vision_check → experiment prompt regression
   - FM2 (classifier routing): items where vision_check was called but
     routed to generic → classifier prompt work
6. **Re-run experiment with workflowPath fix** (conductor PR #145
   merged) to measure execution accuracy — does routing to the actual
   inspect-drawing specialist improve findings vs generic vision?
