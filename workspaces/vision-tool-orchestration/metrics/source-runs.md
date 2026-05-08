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
| **el-md-exp** | ctrl-baseline | ✅ current | `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V3` | 3 | Valley View v1 |
| **el-md-exp** | var1-bifurcated | 🟡 in-progress (re-fire) | `VISION_CHECK_REVIEW_EL_MD_EXP_VAR1_RUN_2` | 3 | Valley View v1 |
| **el-md-exp** | var2-routing | 🟡 in-progress (re-fire) | `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_3` | 3 | Valley View v1 |

| Status | Meaning |
|---|---|
| ✅ current | Run done, TSV built, data canonical for this cell. |
| 🟡 in-progress | Run fired, awaiting completion + TSV build. |
| 🛠 needs-tsv-build | Run done; TSV not yet built into `metrics/`. |
| 🔁 needs-rerun | Run done but has a confounder that should be retired before the headline number is final. Current data is usable as a placeholder. |
| ⏳ pending | Run hasn't been fired. |

### Cross-variant confounders — status

1. **cc — var2 ran at runs=1 (vs ctrl & var1 at runs=3).** Strict-majority threshold is more demanding at runs=3 (need ≥2/3) than runs=1 (need ≥1/1). Re-fire var2 cc at runs=3 for clean Goal A. **Still open.**
2. **el-md-exp — submission-version split:** ✅ retired 2026-05-07 — `BASELINE_V3` and `RUN_2` both fired on Valley View v1, matching var1's `experiment-run7.2`.
3. **el-md-exp — var2 ran pre-bureau#310** (drawing_inspect fallback): ✅ retired 2026-05-07 — `RUN_2` fired post-bureau#310 + post bureau#316 with `enabledVisionSpecialists="generic-vision,measure-distance"` (drops `inspect-drawing` from the allow-list entirely so the question doesn't even arise).
4. **el-md-exp — var1 partial-coverage (RUN_1 emitted only 201/303 cells):** 🟡 fix in flight 2026-05-08 — bureau#317 added `{{ agentTraceGuidance }}` placeholder to the measure-distance overlay's review.md. `VAR1_RUN_2` (Inngest `01KR3VNN3FPRQ6C3DVB4Y74RA8`) is firing now to retire this caveat.
5. **el-md-exp — var2 classifier saw drawing_inspect listed despite allow-list:** 🟡 fix in flight 2026-05-08 — RUN_2's classifier picked drawing_inspect for 27 of 57 calls, all of which fell back via `specialist_disabled`. conductor#151 + bureau#318 made the vision-router.md allow-list-aware via Mustache sections. `RUN_3` (Inngest `01KR3VNSV2V2PVAKCQ8DGMX39D`) is firing now with the new prompt — drawing_inspect won't appear in problem types or examples.
6. **el-md-exp — measurement dispatch still falls back to generic** (`measurement_arg_construction_not_implemented`). Routing intent is captured in `classifier.output.problemType` — Goal B should be computed against that field, not `dispatch.specialistCalled`. Conductor-side dispatch wiring is separate work; doesn't block phase-1 hit-rate / selection metrics. **Still open.**

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

#### el-md-exp / ctrl-baseline ✅ current

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V3` |
| Inngest event id | `01KR23RHGJB4S6WB3ZK72TFVQW` |
| `workflow_runs.id` | `790d4c46-cd86-49b4-a255-a4397ca7ac09` |
| Review id | `ddcb5d56-c382-4062-a3c4-044a9be64a6e` |
| Started | 2026-05-07 20:58:59 UTC |
| Completed | 2026-05-07 21:15:37 UTC (~17 min) |
| Workflow / overlay | `review` (production workflow, no `experiment` overlay) |
| Submission | Valley View Townhomes **v1** (`submissionVersionId=55fb6548-…`) — matches var1's experiment-run7.2 |
| Guide | `el-md-exp` |
| `runs` | 3 |
| Agent tools | `vision` |
| Flags | `logAllAgentTrace=true` |
| Bureau commit | post bureau#314 (review-extended.md prompt + reviewPromptName input) |
| Conductor PR | post conductor#149 (templated agent.prompt + reviewPromptName seeding) |
| Metrics TSV | _(not built yet)_ |

**Notes**
- First baseline run that uses the new `review-extended.md` prompt path (conductor seeds `reviewPromptName='review-extended'` and `reviewSchemaName='reviewExtended'` from `logAllAgentTrace=true`). Each finding should now carry `agentTrace.{observation, reasoning, tools_used}` for ALL statuses (pass / fail / not-verifiable / n/a) — closes the per-item tool-attribution gap that blocked Goal A on review.
- Submission switched to Valley View v1 to retire the previous v1/v2 mismatch with var1 (`experiment-run7.2`).
- Workflow_runs.id and review id need Supabase lookup once Substation creates the DB record.
- Supersedes:
  - `BASELINE` (`workflow_runs.id 300eb8a1-9bb1-4257-a88a-745bf696b805`, Inngest `01KQZ1X0NMDDZ6E4SA3P1S3Q1E`, fired 2026-05-06 16:28, on Valley View v2)
  - `BASELINE_V2` (review id `224279d8-4827-44cd-a15b-1f034496dac2`, on Valley View v2 — `logAllAgentTrace` silently failed)

#### el-md-exp / var1-bifurcated-vision-tools 🟡 in-progress (re-fire)

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_REVIEW_EL_MD_EXP_VAR1_RUN_2` |
| Inngest event id | `01KR3VNN3FPRQ6C3DVB4Y74RA8` |
| `workflow_runs.id` | _(awaiting Substation pickup)_ |
| Review id | _(awaiting run completion)_ |
| Started | 2026-05-08 (firing) |
| Workflow / overlay | `review` + `--experiment=measure-distance` |
| Submission | Valley View Townhomes v1 (`submissionVersionId=55fb6548-…`) |
| Guide | `el-md-exp` |
| `runs` | 3 |
| Agent tools | `vision`, `measure-distance` |
| Flags | `logAllAgentTrace=true` |
| Bureau commit | post bureau#317 (measure-distance overlay agent-trace placeholder) |
| Conductor PR | post conductor#149 (templated agent.prompt + reviewPromptName seeding) |
| Metrics TSV | _(not built yet)_ |

**Why re-fire**

`VAR1_RUN_1` had partial coverage — only 201/303 (item × run) cells had findings — because the measure-distance overlay's `review.md` lacked the `{{ agentTraceGuidance }}` placeholder. With `logAllAgentTrace=true` set, conductor seeded the override block but the prompt had nowhere to render it, so the agent followed the earlier "only emit fail/not-verifiable" instruction and dropped pass items.

bureau#317 added the placeholder. This re-fire should produce 303/303 (item × run) cells with findings, all four statuses present, closing the partial-coverage caveat. Goal A var1 becomes a clean number rather than a lower bound.

**Supersedes**

`VISION_CHECK_REVIEW_EL_MD_EXP_VAR1_RUN_1` (workflow_runs.id `b877dead-f786-4bf6-9ac4-3cde3f2ec546`, review id `9e6f78e4-7cab-44b1-b23c-d564059c6e81`, fired 2026-05-07 21:15 UTC). RUN_1 in turn superseded the historical `experiment-run7.2`.

#### el-md-exp / var2-vision-specialist-routing 🟡 in-progress (re-fire)

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_3` |
| Inngest event id | `01KR3VNSV2V2PVAKCQ8DGMX39D` |
| `workflow_runs.id` | _(awaiting Substation pickup)_ |
| Review id | _(awaiting run completion)_ |
| Started | 2026-05-08 (firing) |
| Workflow / overlay | `review` + `--experiment=vision-check` |
| Submission | Valley View Townhomes v1 (`submissionVersionId=55fb6548-…`) |
| Guide | `el-md-exp` |
| `runs` | 3 |
| Agent tools | `vision_check`, `semantic-search-blocks` |
| Flags | `logAllAgentTrace=true` |
| `enabledVisionSpecialists` | `"generic-vision,measure-distance"` (inspect-drawing dropped) |
| Bureau commit | post bureau#318 (vision-router.md conditional sections) |
| Conductor PR | post conductor#151 (template-engine sections + allow-list-aware router prompt) |
| Metrics TSV | _(not built yet)_ |

**Why re-fire**

`RUN_2`'s classifier picked `drawing_inspect` for **27 of 57 calls** on el-md-exp items, all of which then fell back via `specialist_disabled` (because `inspect-drawing` isn't in the allow-list). The allow-list gated *dispatch* but not *classification* — the classifier still saw `drawing_inspect` listed in the prompt and picked it for items that should have routed to `measurement`.

conductor#151 added Mustache `{{#enabledFoo}}…{{/enabledFoo}}` section support to the template engine and made the router-prompt loader allow-list-aware. bureau#318 restructured `vision-router.md` to use those blocks. With `enabledVisionSpecialists="generic-vision,measure-distance"`, the classifier now sees only `measurement` and `generic` as options — no `drawing_inspect` listed in problem types or few-shot examples.

**Expected:** the 27 prior misroutes redistribute to `measurement` (the right answer for most el-md-exp items) or `generic` (acceptable fallback). Goal B should lift materially from the phase-1 RUN_2 number of 5.9% (3/51).

**Supersedes**

`VISION_CHECK_REVIEW_EL_MD_EXP_RUN_2` (workflow_runs.id `465fe4e5-9ce6-4554-9cbc-65cd75755b2b`, review id `694e2e1c-f160-407a-94c6-b5fd8aa5a919`, fired 2026-05-07 21:11 UTC). RUN_2 in turn superseded the pre-bureau#310 RUN_1.

---

## What "complete" looks like

For phase 1 to declare done, all 6 cells should be ✅ **current** with no outstanding rerun reasons. Today's gap list:

- [ ] cc / var2: re-fire at `runs=3` to retire runs-disparity confounder on cc Goal A
- [x] el-md-exp / ctrl-baseline: phase-1 numbers populated (Goal A 41.2%; Goal B n/a)
- [🟡] el-md-exp / var1: re-fire `VAR1_RUN_2` in flight to retire partial-coverage caveat (Inngest `01KR3VNN3FPRQ6C3DVB4Y74RA8`). Pull artifacts + rebuild TSV + recompute Goal A once complete.
- [🟡] el-md-exp / var2: re-fire `RUN_3` in flight with allow-list-aware classifier prompt (Inngest `01KR3VNSV2V2PVAKCQ8DGMX39D`). Pull artifacts + rebuild TSV + recompute Goal B once complete.
- [x] **fix measure-distance overlay's `review.md`** ✅ landed via bureau#317.
- [x] **bureau-side classifier prompt iteration for el-md-exp** ✅ delivered as conductor#151 (Mustache sections) + bureau#318 (allow-list-aware vision-router.md). Iteration is now data-driven (turn specialists on/off via the input) rather than prescriptive.
- [ ] **Open follow-up: conductor measurement-dispatch wiring** (`measurement_arg_construction_not_implemented` fallback). Unblocks specialist execution measurement on review.

The Phase 1 Metric Summary in [`analysis.md`](./analysis.md) is populated for both sets but will need a recompute pass once `VAR1_RUN_2` and `RUN_3` complete — both numbers will tighten.
