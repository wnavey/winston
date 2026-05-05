# Measure-Distance Tool — Validation Plan

A data-science-driven plan for proving the efficacy of the measure-distance
tool and quantifying its impact on review quality.

> **Methodology update — 2026-05-05:** invocation recall is now computed
> using the rigorous **per-(item × run) framing** documented in
> [`rigorous-metrics/README.md`](./rigorous-metrics/README.md). The earlier
> phase-1 metrics (`phase-1-pilot-metrics.md`, `phase-1-cross-run-metrics.md`,
> `phase-1-run7*-metrics.md`) used agent-session-level attribution and a
> baseline-NV-only denominator that inflated the recall number ~5× vs the
> rigorous count. Those legacy docs are kept for historical reference but
> all new analysis should use the rigorous framing.
>

## Goals

1. **Quantify tool adoption**: How often does the agent invoke the tool when
   it would be appropriate?
2. **Quantify tool reliability**: How often does the tool complete and produce
   a measurement?
3. **Quantify tool accuracy**: How often is the measurement correct?
4. **Quantify review impact**: Does the tool improve finding quality (converting
   "not-verifiable" to "pass" or "fail" with evidence)?
5. **Estimate system-wide reach**: What percentage of ALL department checklist
   items could benefit from horizontal distance measurement?

---

## Metric definitions

### MVP metrics (Phase 1–2)

| Metric | Definition | Formula | Data source |
|--------|-----------|---------|-------------|
| **Invocation recall** | Of (item × run) cells where the agent should call MD (`should_call=yes`), how often did at least one pair-call tag that deficiency? | `cells_with_call / cells_should_call_yes` | per-pair `metadata.json` `applicableChecklistItems` × item-classification.json |
| **Misuse rate** | Of cells where the agent should NOT call MD (`should_call=no`), how often did a "no-only" pair-call (applicable list contains only `should_call=no` items) tag the cell? | `real_misuse_cells / cells_should_call_no` | same |
| **Completion rate** | Of MD invocations, how often does the pipeline produce a result? | `successful_results / MD_invocations` | call-dir `metadata.json` + `measure-distance.json` |
| **Measurement accuracy** | Of successful results, how often is the distance within tolerance of ground truth? | `correct_measurements / successful_results` | ground-truth dataset |
| **Finding conversion rate** | Of `not-verifiable` baseline findings on eligible items, how many convert to `pass` or `fail` in the experiment? | `(pass + fail)_experiment / not-verifiable_baseline` (same items) | baseline vs experiment findings |

**Implementation:** see [`scripts/compute-rigorous-metrics.py`](./scripts/compute-rigorous-metrics.py).
Run it from the workspace root or anywhere — it discovers all
`runs/*/<guide-set>/experiment-run*/measure-distance-calls/` directories and
emits per-run + cross-run reports in [`rigorous-metrics/`](./rigorous-metrics/).

#### Why this differs from earlier "invocation recall"

The earlier framing computed `MD_invocations / eligible_items` where:
- **`MD_invocations`** counted at agent-session level — any agent that made
  ≥1 call counted every eligible item in that session as "invoked." This
  inflates the numerator: if an agent made 1 call to measure EL-13.5, the
  legacy numerator credits all distance-only items in that agent session.
- **`eligible_items`** filtered to baseline-`not-verifiable` items only. This
  shrinks the denominator: 26 instead of 108 (36 distance-only items × 3
  runs), since most distance-only items had a `not-verifiable` verdict in
  baseline anyway.

Combined effect: legacy recall was ~5× the rigorous number. See
[`rigorous-metrics/README.md`](./rigorous-metrics/README.md) for the full
side-by-side.

### Extended metrics (Phase 3+)

| Metric | Definition | Formula |
|--------|-----------|---------|
| **Invocation precision** | Of MD invocations, how often was the invocation appropriate? | `appropriate_invocations / total_invocations` |
| **F1 (invocation)** | Harmonic mean of invocation recall and precision | `2 × (precision × recall) / (precision + recall)` |
| **Finding-level precision** | Of items the tool changed to `fail`, how many are true failures? | `true_fails / (true_fails + false_fails)` |
| **Finding-level recall** | Of true failures, how many did the tool catch? | `true_fails / (true_fails + missed_fails)` |
| **Added latency** | Time added per finding by the MD tool | `avg(elapsed_ms)` from call-dir metadata |
| **Added token cost** | Extra Gemini tokens per MD invocation | Gemini usage metadata (if available) or estimated from prompt/response sizes |
| **Horizontal coverage** | % of all department items addressable by horizontal MD | Classification script output |
| **Vertical gap** | % of items that need vertical measurement (future work) | Classification script output |

---

## Experimental design

### Control vs. treatment

| | Control (baseline) | Treatment (experiment) |
|---|---|---|
| **Workflow** | `review` (stock prompt, vision-only tools) | `review` + `--experiment=measure-distance` |
| **Model** | Haiku 4.5 | Haiku 4.5 |
| **Runs** | 3 independent | 3 independent |
| **Guide** | Same discipline, same items | Same discipline, same items |
| **Site plan** | Same submission | Same submission |

### Statistical considerations

- **Sample unit**: one agent = one (run, checklist-item) pair.
- **Minimum runs**: 3 per variant gives 3 independent samples per item. For
  EL discipline with 20 guide files × 3 runs = 60 agents per variant.
- **Paired comparison**: each control agent has a matched treatment agent
  (same run index + same item). Paired t-test or McNemar's test for
  proportions.
- **Stochastic variance**: agent behavior varies between runs. 3 runs captures
  the variance; we report mean ± std for each metric.

### Why Electric first

- **Existing classification**: 101 EL items already classified as Yes/No/Conditional
  for distance measurement (52 Yes, 23 Conditional, 26 No).
- **Existing data**: baseline-2026-04-15 + experiment-run1 + experiment-run2 provide
  pilot data for 3 of the 20 EL guide files (items 1, 2, 13 = 101 items).
- **High tool-relevance**: 51.5% of items require plan-view distance — the
  highest-yield department for the horizontal tool.

---

## Data requirements

### 1. Item classification (which items are distance-measurable?)

**EL discipline**: already done for 3 guides (101 items). Need to extend to
all 20 EL guide files (~770 items total). Classification categories:

| Category | Definition | Tool applicability |
|----------|-----------|-------------------|
| **Yes (horizontal)** | Requires plan-view distance measurement | Tool CAN measure |
| **No** | Non-distance check (documentation, material, methodology) | Tool NOT applicable |
| **Conditional (vertical)** | Requires vertical/3D clearance | Tool CANNOT measure (yet) |
| **Conditional (mixed)** | Both horizontal and vertical components | Tool provides PARTIAL value |

**All departments**: run the same classification across all 10 departments
(~258 guide files). This can be done by an LLM classification pass with
human spot-check, similar to how the EL classification was produced.

### 2. Ground truth dataset

A small curated set of hand-verified distances for accuracy validation.

**Scope**: 10–20 object pairs on the Valley View Townhomes site plan where
a human has:
- Identified objectA and objectB on the sheet
- Measured the distance using the PDF drawing scale or CAD
- Recorded the distance in feet with ±tolerance

**Selection criteria**:
- Mix of easy (well-separated, distinct objects) and hard (overlapping, small features)
- Cover both sheet 21 (electrical plan) and sheet 31 (landscape plan)
- Include at least 2–3 pairs that should measure >10 feet (to validate non-trivial distances)
- Include at least 2–3 pairs that should measure <5 feet (to validate near-zero resolution)

**Format**:
```json
{
  "groundTruth": [
    {
      "id": "gt-001",
      "sheetNum": "31",
      "objectA": "southeastern mitigation tree trunk (M symbol)",
      "objectB": "OHE line at southern boundary",
      "expectedDistanceFeet": 3.5,
      "toleranceFeet": 2.0,
      "measuredBy": "human",
      "method": "PDF scale ruler on 1\"=20' sheet"
    }
  ]
}
```

**Level of effort**: ~2–4 hours of human measurement work for 15 pairs.

### 3. Baseline runs (control group)

For each discipline/site-plan combo, run the review workflow WITHOUT the
measure-distance tool enabled. Archive findings.

**Already captured for EL (3 items)**: `runs/v5.0/baseline-el-md-exp/` (3 runs,
items 1.md + 2.md + 13.md).

**Needed for full EL discipline**: baseline on all 20 EL guide files × 3 runs.
Estimated cost: 60 Haiku agents, ~$2–5 in Claude tokens.

### 4. Experiment runs (treatment group)

Same configuration as baseline but with `--experiment=measure-distance`.
Archive findings + measure-distance-calls artifacts.

**Already captured for EL (3 items)**: `runs/v5.0/experiment-run2/` (3 runs,
items 1.md + 2.md + 13.md).

**Needed for full EL discipline**: experiment on all 20 guide files × 3 runs.
Estimated cost: 60 Haiku agents + Gemini calls (~$5–15 total depending on
MD invocation frequency).

### 5. Agent tracing in Review 5.0

To properly attribute WHY an agent chose to invoke (or not invoke) the tool,
Review 5.0 needs to capture the agent's observation and reasoning in the
schema before producing the finding status.

**Required schema additions** (mirroring Review 4.3 + completeness-check):
```jsonc
{
  "deficiencyId": "EL-2.1",
  "observation": "Sheet 31 shows 5 trees along the southern boundary within ~10 ft of the OHE line. No dimension annotations. Trees are labeled 'M' (mitigation).",
  "reasoning": "The trees appear very close to the OHE line but without dimensions. I will use measure-distance to check the actual clearance before concluding not-verifiable.",
  "toolInvocations": [
    {
      "tool": "measure-distance",
      "inputs": { "sheetNum": "31", "objectA": "...", "objectB": "..." },
      "result": { "distanceFeet": 3.5, "confidence": "medium" }
    }
  ],
  "status": "fail",
  "comment": "Trees at southern boundary are 3.5 feet from OHE line (measured). Minimum 15 feet required."
}
```

This enables:
- Post-hoc analysis of WHEN the agent considered the tool
- Attribution of tool results to specific findings
- Debugging of false negatives (agent could have called tool but didn't)

---

## Phased approach

### Phase 0 — Prerequisites (current state)

| Deliverable | Status |
|-------------|--------|
| Tool pipeline end-to-end (MCP → Gemini → Python → result) | ✅ done |
| nearestPoint axis fix | ✅ done (bureau#229) |
| Prompt nudge (measure before defaulting to not-verifiable) | ✅ done (bureau#225) |
| Test-script fixture replay framework | ✅ done |
| Bbox overlay viewer | ✅ done |
| Item classification for EL guides 1, 2, 13 (101 items) | ✅ done |
| Baseline + experiment runs for EL guides 1, 2, 13 | ✅ done |

### Phase 1 — MVP metrics on the EL 3-item pilot (low cost)

**Goal**: Compute invocation recall, completion rate, and finding conversion
rate on the data we already have.

**Work**:
1. Write a `compare-findings.py` script that:
   - Loads baseline + experiment findings for matched (run, item) pairs
   - Classifies each item as eligible/ineligible using the existing
     classification table
   - Computes invocation recall: of eligible items, how many had ≥1 MD call?
   - Computes completion rate: of MD calls, how many produced a result?
   - Computes finding conversion: baseline `not-verifiable` → experiment
     `pass` or `fail`?
   - Outputs a structured JSON + markdown summary
2. Run the comparison on existing data:
   - Baseline: `runs/v5.0/baseline-el-md-exp/`
   - Experiment: `runs/v5.0/experiment-run2/`

**Estimated effort**: 1–2 days. No new runs needed.

**Deliverable**: `analysis/phase-1-pilot-metrics.md` with tables and
confidence intervals.

### Phase 2 — Ground truth + accuracy (moderate cost)

**Goal**: Establish accuracy of the tool's measurements against human-verified
distances.

**Work**:
1. Human measures 15–20 object pairs on sheets 21 and 31 of Valley View
   Townhomes (2–4 hours).
2. Create `replay/fixtures/ground-truth-valley-view.json` with expected distances.
3. Run the test-script workflow against the ground truth fixture.
4. Compute accuracy: % of measurements within tolerance band.
5. Analyze error distribution: systematic bias? Scale-dependent? Sheet-dependent?

**Estimated effort**: 1 day human + 1 day analysis. One test-script run (~15 min).

**Deliverable**: `analysis/phase-2-accuracy-report.md` with scatter plot
(measured vs expected), tolerance-band chart, and per-sheet breakdown.

### Phase 3 — Full EL discipline + impact analysis (moderate–high cost)

**Goal**: Validate at scale across all 20 EL guide files. Compute finding-level
precision and recall.

**Work**:
1. Extend item classification to all 20 EL guides (~770 items). Use LLM
   classification with human spot-check (~4 hours).
2. Run baseline (no tool) on all 20 guides × 3 runs = 60 agents.
3. Run experiment (with tool) on all 20 guides × 3 runs = 60 agents.
4. Implement Review 5.0 agent tracing (observation/reasoning/toolInvocations
   in the schema) so invocation decisions are attributable.
5. Compare findings pair-wise. Compute all MVP + extended metrics.
6. Generate comparison report with:
   - Per-guide breakdown (which guides benefit most?)
   - Per-item breakdown (which items convert from not-verifiable?)
   - Invocation recall by guide (which guides does the agent under-use?)
   - Measurement accuracy (cross-reference with Phase 2 ground truth)

**Estimated cost**: ~$10–30 in Claude + Gemini tokens across both runs.

**Deliverable**: `analysis/phase-3-el-full-discipline.md` with:
- Summary statistics table
- Per-guide heatmap (invocation rate × conversion rate)
- Precision/recall/F1 for finding outcomes
- Horizontal vs. vertical gap analysis

### Phase 4 — Cross-department scaling (moderate cost)

**Goal**: Estimate system-wide impact of horizontal MD tool across all 10
departments.

**Work**:
1. Run the item-classification script across all 10 departments (~258 guide
   files). Categories: horizontal-yes, no, vertical-conditional.
2. Apply the per-category invocation/conversion rates from Phase 3 to estimate
   expected impact per department.
3. Identify the top 3–5 departments by expected impact (beyond EL) for
   potential follow-up experiments.

**Estimated effort**: 1–2 days. Classification is LLM-driven; no new review
runs needed if we extrapolate from Phase 3 rates.

**Deliverable**: `analysis/phase-4-cross-department-projection.md` with:
- Department × distance-type matrix
- Projected invocation counts and finding conversions
- Priority ranking for which departments to experiment next
- Horizontal vs. vertical split per department

### Phase 5 — Visual report + executive summary (low cost)

**Goal**: Produce a company-wide-consumable visual report summarizing the
tool's validated impact.

**Work**:
1. Generate an HTML report (similar to the bbox viewer pattern) that presents:
   - Tool reliability metrics (completion rate, accuracy)
   - Finding impact metrics (conversion rate, precision, recall, F1)
   - Department coverage analysis (% items addressable by horizontal MD)
   - Before/after examples (specific items that converted from not-verifiable
     to pass/fail with measured evidence)
   - Cost analysis (added latency, added token cost per finding)
   - Roadmap impact (what vertical distance would unlock — the "conditional"
     items)
2. Include executive-friendly charts:
   - Bar chart: findings by status, baseline vs experiment
   - Scatter plot: measured vs expected distance (ground truth)
   - Stacked bar: department × item classification
   - Timeline: tool improvements across runs (run1 → run2 → axis fix)

**Deliverable**: Published HTML report via the `publish-report` skill.

---

## Metric tracking across runs

As we accumulate runs, maintain a tracking table:

| Run | Date | Scope | MD calls | Completion rate | Accuracy | Conversion rate | Notes |
|-----|------|-------|----------|----------------|----------|----------------|-------|
| experiment-run1 | 2026-04-15 | EL 1,2,13 | 14 (8 reached script) | 0% | — | — | Python 3.9 crash; no results |
| experiment-run2 | 2026-04-16 | EL 1,2,13 | 13 (12 reached script) | 58% (7/12) | — | — | 6/7 returned 0 ft (axis bug) |
| run2-test-fixture-1 | 2026-04-17 | EL 1,2,13 (replay) | 13 | 100% (13/13) | TBD | — | Axis fix applied; 2 non-zero |
| Phase 1 analysis | TBD | EL 1,2,13 | — | — | — | TBD | First conversion-rate number |
| Phase 3 full-EL | TBD | All 20 EL guides | — | — | — | — | Full discipline validation |

---

## Dependencies and prerequisites

| Dependency | Needed for | Status |
|------------|-----------|--------|
| Bureau axis fix (bureau#229) | Accurate measurements | ✅ merged |
| Test-script workflow | Fixture replay | ✅ merged |
| `compare-findings.py` script | Phase 1 metrics | ⬜ not started |
| Item classification (all EL guides) | Phase 3 | ⬜ (3/20 guides done) |
| Ground truth dataset | Phase 2 accuracy | ⬜ not started |
| Review 5.0 agent tracing schema | Phase 3 attribution | ⬜ not started |
| Item classification (all departments) | Phase 4 scaling | ⬜ not started |
| HTML report generator | Phase 5 visual report | ⬜ not started |

---

## Suggestions and open questions

### Regarding agent tracing

The observation/reasoning/toolInvocations schema should be designed to also
support the completeness-check workflow's tracing pattern. If Review 5.0 and
completeness-check share a tracing schema, the same analysis scripts work
for both. This also simplifies writing the structured review comment to the
database — one shape fits all.

### Regarding the ground truth dataset

Consider sourcing ground truth from TWO site plans, not just Valley View:
- Valley View Townhomes (current — residential, 1"=20' scale, relatively simple)
- A commercial/mixed-use project with different scale and more complex features

Two site plans protect against overfitting the tool to one drawing style.

### Regarding vertical distance

23% of EL items are classified as "Conditional (vertical)". While we don't
fix this in the current phase, the classification data lets us precisely
quantify the gap:
- "Horizontal MD addresses 51.5% of EL items"
- "Adding vertical MD would address up to 74.3%"
- This framing gives stakeholders a clear roadmap-investment case.

### Regarding cost tracking

Each MD invocation costs:
- ~$0.01–0.03 in Gemini Vision tokens (one image + prompt)
- ~100s of elapsed time (dominated by Gemini latency + asset download)
- ~0.0 in Claude tokens (tool call is free; the agent turn that decides to
  call it is already happening)

At an estimated ~50 invocations per full EL discipline run, the per-discipline
Gemini cost is ~$0.50–1.50. Negligible at review pricing, but worth tracking
for the executive report.

### Regarding statistical power

With 3 runs × 20 guides = 60 agent pairs per variant, and an expected
conversion rate of ~20–30% (estimated from the pilot), a McNemar test
has ~80% power to detect a 15% improvement (from 20% to 35% conversion)
at α=0.05. If the effect is larger (which we expect for the most eligible
items), 3 runs is sufficient. If the effect is smaller, we'd need 5 runs
(100 agent pairs) — a decision we can make after Phase 1 pilot results.
