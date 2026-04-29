# Valley View Townhomes — el-md-exp 5-run Variance Report

**Review ID:** `3509b097-764e-4962-b023-8d8ae8fd7a4c`  
**Workflow run:** `04252e6b-cf95-43f2-9705-cca869b2ca80`  
**Project:** `63cead15-41f8-418c-b0ef-bd5c2b44719a` — Valley View Townhomes  
**Workflow:** `review` v5.2.0 · `experiment: measure-distance` · `logAllAgentTrace: true`  
**Guide:** `el-md-exp` (jurisdictions/austin/review-guides/el-md-exp)  
**Model:** `claude-haiku-4-5-20251001`  
**Runs config:** `runs=5`  
**Run completed:** `2026-04-28 22:36 UTC`

**Companion deep-dives:**
- [`detection-variance-analysis.md`](./detection-variance-analysis.md) — the 73% detection-variance refs broken down by grouping
- [`structured-output-data-loss.md`](./structured-output-data-loss.md) — log-traced root cause for the 34 findings run-3 lost on grouping 13 (schema-validation overreaction)

---

## TL;DR

Two parallel headlines, one positive, one structural:

1. **Detection variance dominates this review.** 61 of 84 refs (73%) have `runCount < totalRuns`, and only 2 refs (2.4%) are unanimous across all 5 runs. **This is structurally normal for the review workflow** — each run independently *discovers* issues rather than evaluating a fixed checklist, so divergent issue sets are the expected baseline. The right interpretation is: refs flagged by all 5 runs are very-high-confidence true issues; refs flagged by 1 run are likely-low-confidence singletons; the gradient between them is the actionable signal.

2. **A schema-validation harness bug discarded 34 of run-3's 38 findings on grouping 13.** Run-3 evaluated the EL-13 (Transformer Pad) checklist comprehensively and submitted 38 findings via `StructuredOutput`. The harness rejected the call because *one* of the 38 findings had an `agentTrace` missing the required `tools_used` field. The agent's recovery was to submit only the 4 findings that already had complete `agentTrace` shape — losing the other 34. **The variance numbers in this report are corrupted for grouping 13 as a result.** Bug detail and counterfactual analysis in [`structured-output-data-loss.md`](./structured-output-data-loss.md).

3. **Same last-call-wins persistence behavior as cc-13** (see [`../../cc/1700-S-Lamar/.../run-2-drift-root-cause.md`](../../../cc/1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/run-2-drift-root-cause.md)). Confirms that the persistence bug generalizes across workflows. **Bug 1 from that root-cause analysis (idempotent / first-success-wins StructuredOutput) is the same single-line fix that would have prevented this data loss too.**

---

## Variance class distribution

| Class | Count | % |
|---|---:|---:|
| unanimous | 2 | 2.4% |
| partial-detection | 61 | 72.6% |
| split-verdict | 9 | 10.7% |
| split-and-partial | 12 | 14.3% |
| no-findings | 0 | 0.0% |

This is profoundly different from the cc-13 baseline (78% unanimous). The shape reflects what the review workflow does:
- Each run runs the agent end-to-end against the guide
- The agent emits findings *only for issues it identified* — there's no "I checked everything and it all passed" output
- The consolidator then clusters per-run findings into refs

So a ref at 1/5 detection means *only one of the five runs decided to surface that issue*. That can mean:
- The issue is subtle and the other 4 runs missed it
- The issue isn't real and only one run hallucinated/over-flagged it
- The issue is real but borderline-applicable

There's no way to distinguish those without manual review, but **the gradient is meaningful**: higher detection rate → higher likelihood the issue is real and worth surfacing to a human reviewer.

---

## Detection-rate distribution

| `runCount/totalRuns` | Count | Interpretation |
|---|---:|---|
| 5/5 | 11 | Issue surfaced by every run — high-confidence true positive |
| 4/5 | 16 | Strong consensus |
| 3/5 | 10 | Majority |
| 2/5 | 25 | Weak signal — minority of runs |
| 1/5 | 22 | Single-run flag — likely false positive or borderline issue |

Two operationally useful subsets:

- **The 27 refs with `>= 4/5` detection** are the issues this review should surface to the city reviewer with high confidence. They represent strong inter-run agreement that something is amiss.
- **The 22 refs at `1/5`** are candidates for filtering out of the merged review. Single-run flags in a 5-run majority workflow have weak evidence of being real findings.

A small caveat: the 34 lost findings from run-3 13.md (see structured-output-data-loss.md) would change these numbers. The counterfactual:

| Ref count change | Correct count | Adjusted count (with run-3's full data) |
|---|---:|---:|
| 5/5 unanimous | 11 | **24** (+13 EL-13 items would jump from 4/5) |
| 4/5 | 16 | 18 |
| 3/5 | 10 | 13 |
| 2/5 | 25 | 22 |
| 1/5 | 22 | 14 (-8 items would jump to 2/5) |

So in the *correct* run, the high-confidence-issue tier (≥4/5) would be **42 refs (50% of the review)**, not 27 (32%). The data-loss bug halves the apparent quality of inter-run agreement.

---

## Verdict-variance subset (when runs that did surface the issue disagreed on status)

The 21 split-verdict refs (split-verdict + split-and-partial) all have the form "some runs say `fail`, others say `not-verifiable`". The status set is binary in this guide (`{fail, not-verifiable}` — there's no `pass` because the workflow only emits findings for issues, never for "this was fine").

For the top entropy refs (sorted from `variance-split-refs.tsv`):

| Ref | Pattern | Winning | Conf | Entropy |
|---|---|---|---|---:|
| `1:EL-1.14` | `fail,not-verifiable` | fail | medium | 1.000 (max for binary) |
| `1:EL-1.27` | `fail,not-verifiable` | fail | medium | 1.000 |
| `1:EL-1.9` | `fail,not-verifiable` | fail | medium | 1.000 |
| `13:EL-13.35` | `fail,fail,not-verifiable,not-verifiable` | fail | medium | 1.000 |
| `1:EL-1.37` | `fail,fail,not-verifiable,not-verifiable` | fail | medium | 1.000 |
| `13:EL-13.34` | `fail,fail,not-verifiable,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `13:EL-13.37` | `fail,fail,fail,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `13:EL-13.38` | `fail,fail,fail,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `1:EL-1.7` | `fail,fail,fail,not-verifiable,not-verifiable` | fail | high | 0.971 |
| `2:EL-2.1` | `fail,fail,not-verifiable,not-verifiable,not-verifiable` | fail | high | 0.971 |

**These verdict splits are not adversarial disagreements.** Reading the agent traces, the pattern is consistent: runs marked `fail` are saying "I checked and the deficiency is present (e.g., no elevation data on the plans)". Runs marked `not-verifiable` are saying "I cannot determine from the available evidence whether the deficiency exists". These are **degrees of confidence on the same underlying observation**, not contradictory verdicts.

For example, `1:EL-1.7` (Surveyed conductor elevations on building sheets):

- **run-1 (fail):** "Building elevation sheets showing surveyed overhead conductor elevations and clearance dimension annotations are not included in the submitted site plan. Applicant must provide registered surveyor elevation data and sealed building elevation sheets…"
- **run-2 (fail):** "Buildings and elevated retaining walls are proposed within potential clearance distance of overhead facilities. However, no building elevation sheets with surveyed overhead conductor elevations and clearance dimension annotations are provided."
- **run-3 (fail):** "Surveyed elevations and locations of overhead electric conductors are not included on any building elevation sheets in the submitted site plan."
- **run-4 (not-verifiable):** "Cannot verify clearances without building elevation data."
- **run-5 (not-verifiable):** "Required elevation data not present, but cannot rule out that documents exist elsewhere."

All five runs agree the elevation data is missing. The only difference is whether the agent felt confident enough to call it a `fail` outright vs flagging it as `not-verifiable`. **The merged verdict (`fail` with high confidence) is correct.**

This means **verdict variance in the review workflow is mostly noise** — the runs are saying the same thing in different language. The interesting signal is *detection variance*: did the run surface this issue at all?

---

## What `logAllAgentTrace` shows us

This was the first review with `logAllAgentTrace: true`. Every finding now carries an `agentTrace` object on the persisted file:

```json
{
  "deficiencyId": "EL-13.1",
  "status": "fail",
  "agentTrace": {
    "observation": "Sheet 21 (Electrical Design Plan) shows Transformer Pad 3 located 1-3 feet from the western wall of Building 8…",
    "reasoning": "…",
    "tools_used": ["vision", "measure-distance"]
  },
  "comment": "…",
  "sheetReferences": [...],
  ...
}
```

The trace is what the variance analysis depends on — without it we couldn't reason about *why* runs disagreed. Two observations:

1. **The schema requires `tools_used` inside `agentTrace`.** This is the field that triggered the run-3 13.md schema validation failure. When 1 of 38 findings had a stray `agentTrace` lacking `tools_used`, the entire submission was rejected.
2. **Tool usage is uneven across runs.** A pattern visible in the traces: some runs call `vision` and `measure-distance` heavily; others rely on text/blocks.md inspection. Run-3 13.md was the only run that successfully called `measure-distance` for grouping 13 (run-1 and run-5 had `measure-distance` script failures). That's likely why run-3 had the most comprehensive 38-item finding set — and why losing it to schema-validation hurts so much.

---

## Recommended next steps

**For the immediate experiment:**
- Treat the merged review's grouping-13 findings as suspect until [`structured-output-data-loss.md`](./structured-output-data-loss.md) is addressed. The 34 lost run-3 findings would change the variance picture substantially.
- Re-run the same 5-run experiment with bug 1 fixed (idempotent StructuredOutput / first-success-wins) and compare.

**For workflow design:**
- Schema-validation failures shouldn't allow the agent to "fix" by silently dropping rejected items. Either retry with the original payload + clear instructions to populate the missing field, or reject without saving a partial result.
- Consider per-finding validation rather than all-or-nothing on the array: validate each finding independently and persist the valid subset, with a structured warning for invalid ones.

**For the broader variance test program:**
- Detection variance is the right metric for review workflows. Verdict variance (`fail` vs `not-verifiable`) is mostly confidence-tier noise on the same underlying observation.
- 5 runs is a useful baseline but the curve from 1/5 to 5/5 is the actionable signal — `runs=10` would let us discriminate "this is a real issue but only the most-thorough runs find it" from "this is a hallucination by one run".
