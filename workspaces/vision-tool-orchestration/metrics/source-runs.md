# Source runs — phase-1 metrics tracker

Human-readable mirror of [`source-runs.json`](./source-runs.json).
Both files describe the **6 runs feeding the phase-1 metrics**
(3 variants × 2 sets), pinning identifiers, submissions, tooling,
and known issues so the per-variant TSV builds and
[`analysis.md`](./analysis.md) stay traceable.

> **Convention:** when a run gets re-fired or replaced, update both
> `source-runs.json` and this file in lockstep. The JSON is the
> structured source of truth; this MD is the readable mirror.

---

## At-a-glance status grid

| Set | Variant | Status | runLabel | runs | Submission |
|---|---|---|---|---:|---|
| **cc** | ctrl-baseline | ✅ current | `VISION_CHECK_CC_BASELINE` | 3 | 1700 S. Lamar v2 |
| **cc** | var1-bifurcated | ✅ current | `VISION_EXP_INSPECT_DRAWING_RUN_1` | 3 | 1700 S. Lamar v2 |
| **cc** | var2-routing | 🔁 needs-rerun | `VISION_CHECK_CC_RUN_4` | **1** | 1700 S. Lamar v2 |
| **el-md-exp** | ctrl-baseline | 🛠 needs-tsv-build | `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V2` | 3 | Valley View v2 |
| **el-md-exp** | var1-bifurcated | 🛠 needs-tsv-build | `experiment-run7.2` | 3 | Valley View **v1** ⚠️ |
| **el-md-exp** | var2-routing | 🔁 needs-rerun | `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_1` | 3 | Valley View v2 |

| Status | Meaning |
|---|---|
| ✅ current | Run done, TSV built, data canonical for this cell. |
| 🛠 needs-tsv-build | Run done; TSV not yet built into `metrics/`. |
| 🔁 needs-rerun | Run done but has a confounder that should be retired before the headline number is final. Current data is usable as a placeholder. |
| ⏳ pending | Run hasn't been fired. |

### Cross-variant confounders to retire

1. **cc — var2 ran at runs=1 (vs ctrl & var1 at runs=3).** Strict-majority threshold is more demanding at runs=3 (need ≥2/3) than runs=1 (need ≥1/1). Re-fire var2 cc at runs=3 for clean Goal A.
2. **el-md-exp — var1 ran on Valley View v1, ctrl & var2 ran on v2.** Different submission-version. Apples-to-apples needs either re-firing var1 on v2 (cleaner) or re-firing ctrl + var2 on v1 (uses existing var1 data as-is).
3. **el-md-exp — var2 ran pre-bureau#310** (no `review/scripts/inspect-drawing.ts`). Every drawing_inspect-routed call fell back to generic. Hit-rate analysis still works, but specialist-execution data is unusable until re-fire.

---

## Detailed entries

### cc (Completeness Check + Inspect Drawing)

#### cc / ctrl-baseline ✅

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_CC_BASELINE` |
| `workflow_runs.id` | `1cea1a70-5860-4068-bd25-e67ce5529eee` |
| Inngest event id | `01KQYYG6G4JHPRMGK0WK9CAWYZ` |
| Inngest function run | `01KQYYG6VSE0Z648NXXWXS8PM3` |
| Started | 2026-05-06 15:29:23 UTC |
| Workflow / overlay | `completeness-check` (production prompt, no overlay) |
| Submission | 1700 S. Lamar v2 (`projectId=23301a8a-…`, `submissionVersionId=eb67ee21-…`) |
| Checklist | `v2.5-trimmed` |
| `runs` | 3 |
| Agent tools | `vision` |
| Artifacts | [`experiments/baseline/cc/output/`](../experiments/baseline/cc/output/) |
| Metrics TSV | [`metrics/cc/ctrl-baseline-vision-invocation/per-item.tsv`](cc/ctrl-baseline-vision-invocation/per-item.tsv) |
| Kickoff doc | [`experiments/baseline/cc-kickoff.md`](../experiments/baseline/cc-kickoff.md) |

**Notes**
- Production prompt (no experiment overlay).
- Vision tool prompt-traceability gap: `vision-log.jsonl` only records `{event, documentId, sheetNum, success, timestamp}` — no prompt or item attribution. Item attribution comes via per-finding `tools_used`.

#### cc / var1-bifurcated-vision-tools ✅

| Field | Value |
|---|---|
| `runLabel` | `VISION_EXP_INSPECT_DRAWING_RUN_1` |
| `workflow_runs.id` | `386b040b-3f75-47ab-af5c-26e8f6b74e9b` |
| Review id | `51586bce-e7d8-4fce-834d-4437abe0df1a` |
| Started | ~2026-05-04 19:08 UTC |
| Workflow / overlay | `completeness-check` + `--experiment=inspect-drawing` |
| Submission | 1700 S. Lamar v2 (same as ctrl-baseline) |
| Checklist | `v2.5-trimmed` |
| `runs` | 3 |
| Model | `claude-sonnet-4-5-20250929` |
| Agent tools | `vision`, `inspect-drawing` |
| Bureau commit | `c98bcc995` (wrapped-structured-output fix) |
| Artifacts | [`inspect-drawing-tool/experiments/run1/output/`](../../inspect-drawing-tool/experiments/run1/output/) |
| Metrics TSV | [`metrics/cc/var1-bifurcated-vision-tools/per-item.tsv`](cc/var1-bifurcated-vision-tools/per-item.tsv) |
| Kickoff / README | [`inspect-drawing-tool/experiments/run1/README.md`](../../inspect-drawing-tool/experiments/run1/README.md) |

**Notes**
- `tools_used` does **not** track inspect-drawing entries (known agent SDK / build-review-comments bug). Workaround: read `inspect-drawing-calls/<callId>/metadata.json` directly for inspect-drawing attribution.
- Sparse specialist usage: 3 inspect-drawing calls total, all in run-1, on AW-21 + AW-23.
- On AW-23/run-1, inspect-drawing returned `classification=yes` (flow arrows present) but the agent's finding contradicted it using vision and finalized `status=fail`. Tool-integration fragility flagged.

#### cc / var2-vision-specialist-routing 🔁 needs-rerun

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_CC_RUN_4` |
| `workflow_runs.id` | `5d804242-861c-43ab-adfd-00e9af3757e2` |
| Started | 2026-05-07 09:24 UTC (~56 min) |
| Workflow / overlay | `completeness-check` + `--experiment=vision-check` |
| Submission | 1700 S. Lamar v2 (same as ctrl-baseline / var1) |
| Checklist | `v2.5-trimmed` |
| `runs` | **1** ⚠️ |
| Agent tools | `vision_check`, `semantic-search-blocks` |
| Bureau commit | post bureau#306 (prompt-trim merged 2026-05-07) |
| Artifacts | [`experiments/run4/cc/output/`](../experiments/run4/cc/output/) |
| Metrics TSV | [`metrics/cc/var2-vision-specialist-routing/per-item.tsv`](cc/var2-vision-specialist-routing/per-item.tsv) |
| Analysis doc | [`experiments/run4/analytics/analysis.md`](../experiments/run4/analytics/analysis.md) |

**Re-run reason**

`runs=1` while ctrl/var1 ran at `runs=3`. Strict-majority threshold is more demanding at runs=3 — re-fire at runs=3 to retire the confounder before the headline Goal A comparison is final.

**Notes**
- Source of truth for var2 attribution is `vision-check-calls/<callId>/metadata.json` (precise per-call dispatch detail).
- 115 total vision_check calls; 63 unique items invoked; 35 items routed to generic, 28 to inspect-drawing (post-aggregation `tool_called`).
- 1 measurement-routed call fell back to generic via `measurement_arg_construction_not_implemented` (measurement dispatch deferred at conductor level).
- No misuse: 0 calls on no-tool items.

---

### el-md-exp (Review + Measure Distance)

#### el-md-exp / ctrl-baseline 🛠 needs-tsv-build

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V2` |
| Review id | `224279d8-4827-44cd-a15b-1f034496dac2` |
| `workflow_runs.id` | _(needs Supabase lookup)_ |
| Started | _(unknown — V2 was a re-fire of `_BASELINE` with `logAllAgentTrace=true` added)_ |
| Workflow / overlay | `review` (production prompt, no overlay) |
| Submission | Valley View Townhomes v2 (`submissionVersionId=48f705aa-…`) |
| Guide | `el-md-exp` |
| `runs` | 3 |
| Agent tools | `vision` |
| Artifacts | [`experiments/baseline/review/output/`](../experiments/baseline/review/output/) |
| Metrics TSV | _(not built yet)_ |
| Kickoff doc | [`experiments/baseline/review-kickoff.md`](../experiments/baseline/review-kickoff.md) (covers V1; V2 was a re-fire) |

**Notes**
- V1 of this baseline (`VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE`, `workflow_runs.id=300eb8a1-9bb1-4257-a88a-745bf696b805`, Inngest `01KQZ1X0NMDDZ6E4SA3P1S3Q1E`) was fired 2026-05-06 16:28 UTC. V2 was a re-fire with `logAllAgentTrace=true` added; the trace flag silently failed on the production review.md path (project memory `log_all_agent_trace_baseline_path_bug.md`). Hit-rate data is still usable.
- V2 IDs (workflow_runs.id, inngest event) need Supabase lookup — fill in when convenient.
- Vision tool prompt-traceability gap applies here too (same as cc ctrl-baseline).

#### el-md-exp / var1-bifurcated-vision-tools 🛠 needs-tsv-build

| Field | Value |
|---|---|
| `runLabel` | `experiment-run7.2` (alternate: `experiment-run7`) |
| `workflow_runs.id` | _(needs Supabase lookup)_ |
| Started | ~2026-04-15 |
| Workflow / overlay | `review` + `--experiment=measure-distance` |
| Submission | **Valley View Townhomes v1** (`submissionVersionId=55fb6548-…`) ⚠️ different submission-version than ctrl/var2 |
| Guide | `el-md-exp` |
| `runs` | 3 |
| Agent tools | `vision`, `measure-distance` |
| Artifacts | [`measure-distance-tool/runs/v5.0/el-md-exp/experiment-run7.2/`](../../measure-distance-tool/runs/v5.0/el-md-exp/experiment-run7.2/) (alternate: [`experiment-run7/`](../../measure-distance-tool/runs/v5.0/el-md-exp/experiment-run7/)) |
| Metrics TSV | _(not built yet)_ |
| Analysis doc | [`measure-distance-tool/analysis/rigorous-metrics/experiment-run7.2.md`](../../measure-distance-tool/analysis/rigorous-metrics/experiment-run7.2.md) |

**Notes**
- ⚠️ **Submission-version mismatch with ctrl-baseline:** experiment-run7 / 7.2 ran on Valley View Townhomes **v1** (`55fb6548-…`) while ctrl-baseline ran on **v2** (`48f705aa-…`). Apples-to-apples comparison requires either re-firing var1 on v2 or re-firing ctrl on v1.
- Two near-identical runs available (`run7` and `run7.2`). Pick `run7.2` by default — slightly higher recall (13.1% vs 12.4% per-(item × run)) and the canonical reference for plan.md's "aspirational ceiling" quote.
- Existing rigorous-metrics analysis (linked above) computes per-(item × run) recall against `el-md-exp/item-classification.json`. Use the same join when building the var1 TSV.
- Workflow_runs.id, review_id, inngest event IDs need Supabase lookup.

#### el-md-exp / var2-vision-specialist-routing 🔁 needs-rerun

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_1` |
| Review id | `cab91833-f951-45cb-b9a1-ee59591faede` |
| `workflow_runs.id` | `b7015e80-c771-4f9e-a149-2adffc5723df` |
| Started | ~2026-05-07 (~14 min wall-clock) |
| Workflow / overlay | `review` + `--experiment=vision-check` |
| Submission | Valley View Townhomes v2 (same as ctrl-baseline) |
| Guide | `el-md-exp` |
| `runs` | 3 |
| Agent tools | `vision_check`, `semantic-search-blocks` |
| Bureau commit | pre bureau#310 |
| Artifacts | [`experiments/run1-review/el-md-exp/output/`](../experiments/run1-review/el-md-exp/output/) |
| Metrics TSV | _(not built yet)_ |
| Analysis doc | [`experiments/run1-review/el-md-exp/analytics/analysis.md`](../experiments/run1-review/el-md-exp/analytics/analysis.md) |

**Re-run reason**

Pre-bureau#310 (`review/scripts/inspect-drawing.ts` wasn't present in bureau yet); 24/24 drawing_inspect-routed calls fell back to generic via `specialist_script_not_found_in_bureau`. Re-fire post-bureau#310 + post conductor measurement-dispatch wiring for usable specialist-execution data. Hit-rate / invocation analysis still works on the existing data as a placeholder.

**Notes**
- Originally fired `runs=1` as a smoke test, then bumped to `runs=3` for parity with `BASELINE_V2`.
- 59 total vision_check calls; routing breakdown: 24 drawing_inspect + 20 generic + 15 measurement.
- Every drawing_inspect call fell back to generic via `specialist_script_not_found_in_bureau` — bureau#310 fixed this; not yet re-fired.
- Every measurement call fell back to generic via `measurement_arg_construction_not_implemented` — conductor dispatch chain still pending.

---

## What "complete" looks like

For phase 1 to declare done, all 6 cells should be ✅ **current** with no outstanding rerun reasons. Today's gap list:

- [ ] cc / var2: re-fire at `runs=3`
- [ ] el-md-exp / ctrl-baseline: build TSV from existing artifacts; backfill V2 IDs from Supabase
- [ ] el-md-exp / var1: build TSV from existing artifacts (acknowledging Valley View v1/v2 mismatch in caveats); decide on re-fire on v2
- [ ] el-md-exp / var2: re-fire post-bureau#310 + measurement-dispatch wiring; build TSV from new run

Once those clear, the [Phase 1 Metric Summary in `analysis.md`](./analysis.md) gets the el-md-exp half filled in and cross-set synthesis opens up.
