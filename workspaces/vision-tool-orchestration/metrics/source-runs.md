# Source runs — phase-1 metrics tracker

Human-readable mirror of [`source-runs.json`](./source-runs.json).
Both files describe the **6 runs feeding the phase-1 metrics**
(3 variants × 2 sets), pinning identifiers, submissions, tooling,
and known issues so the per-variant TSV builds and
[`analysis.md`](./analysis.md) stay traceable.

> **Convention:** when a run gets re-fired or replaced, update both
> `source-runs.json` and this file in lockstep. The JSON is the
> structured source of truth; this MD is the readable mirror.
>
> **Canonical artifacts** for each active run live at
> `../source-runs/<set>/<variant>/` (post 2026-05-08 reorg). When a
> run is replaced, the prior artifacts are wiped and replaced — only
> the supersedes block here records what came before. See
> [`../source-runs/README.md`](../source-runs/README.md).

---

## At-a-glance status grid

| Set | Variant | Status | runLabel | runs | Submission |
|---|---|---|---|---:|---|
| **cc** | ctrl-baseline | ✅ current | `VISION_CHECK_CC_BASELINE` | 3 | 1700 S. Lamar v2 |
| **cc** | var1-bifurcated | ✅ current | `VISION_EXP_INSPECT_DRAWING_RUN_1` | 3 | 1700 S. Lamar v2 |
| **cc** | var2-routing | 🔁 needs-rerun | `VISION_CHECK_CC_RUN_4` | **1** | 1700 S. Lamar v2 |
| **el-md-exp** | ctrl-baseline | ✅ current | `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V3` | 3 | Valley View v1 |
| **el-md-exp** | var1-bifurcated | ✅ current | `VISION_CHECK_REVIEW_EL_MD_EXP_VAR1_RUN_2` | 3 | Valley View v1 |
| **el-md-exp** | var2-routing | ⚠️ needs runs=3 re-fire (current run is local runs=1; chain executes end-to-end) | `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_6_BACKUP_LOCAL` | 1 | Valley View v1 |

| Status | Meaning |
|---|---|
| ✅ current | Run done, TSV built, data canonical for this cell. |
| 🟡 in-progress | Run fired, awaiting completion + TSV build. |
| 🛠 needs-tsv-build | Run done; TSV not yet built into `metrics/`. |
| 🔁 needs-rerun | Run done but has a confounder that should be retired before the headline number is final. Current data is usable as a placeholder. |
| ⏳ pending | Run hasn't been fired. |

### Cross-variant confounders — status

1. **cc — var2 ran at runs=1 (vs ctrl & var1 at runs=3).** Strict-majority threshold is more demanding at runs=3 (need ≥2/3) than runs=1 (need ≥1/1). Re-fire var2 cc at runs=3 for clean Goal A. **Still open.**
2. **el-md-exp — submission-version split:** ✅ retired 2026-05-07 — `BASELINE_V3`, `RUN_2`, and `VAR1_RUN_1` all fired on Valley View v1.
3. **el-md-exp — var2 ran pre-bureau#310** (drawing_inspect fallback): ✅ retired 2026-05-07 — `RUN_2` (and now `RUN_3`) fire post bureau#310 + post bureau#316 with `enabledVisionSpecialists="generic-vision,measure-distance"`.
4. **el-md-exp — var1 partial coverage (RUN_1):** ✅ retired 2026-05-08 — `VAR1_RUN_2` fires post bureau#317. All 303 cells now have findings (was 201/303). Goal A var1 lifted from lower-bound 60.8% to definitive **74.5%**.
5. **el-md-exp — var2 classifier saw drawing_inspect despite allow-list:** ✅ retired 2026-05-08 — `RUN_3` fires post conductor#151 + bureau#318. Zero drawing_inspect classifications (was 27 in RUN_2). Goal B var2 lifted from 5.9% to **15.7%**.
6. **el-md-exp — measurement dispatch still falls back to generic** (`measurement_arg_construction_not_implemented`). Routing intent is captured in `classifier.output.problemType` — Goal B is computed against that field, not `dispatch.specialistCalled`. Conductor-side dispatch wiring is separate work; doesn't block phase-1 selection metrics. **Still open** (phase-2 territory — affects execution accuracy, not selection rate).

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
| Artifacts | [`source-runs/cc/ctrl/output/`](../source-runs/cc/ctrl/output/) (canonical) |
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
| Artifacts | [`source-runs/cc/var-1/output/`](../source-runs/cc/var-1/output/) (canonical; original at `inspect-drawing-tool/experiments/run1/output/`) |
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
| Artifacts | [`source-runs/cc/var-2/output/`](../source-runs/cc/var-2/output/) (canonical) |
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

#### el-md-exp / var1-bifurcated-vision-tools ✅ current

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_REVIEW_EL_MD_EXP_VAR1_RUN_2` |
| Inngest event id | `01KR3VNN3FPRQ6C3DVB4Y74RA8` |
| `workflow_runs.id` | `c7797eb0-13f7-4dae-8876-b00bcec9ca61` |
| Review id | `e87691b1-9df2-46b2-8bbb-6a776b5c0a82` |
| Started | 2026-05-08 13:16:13 UTC |
| Completed | 2026-05-08 13:34:35 UTC (~18 min) |
| Workflow / overlay | `review` + `--experiment=measure-distance` |
| Submission | Valley View Townhomes v1 (`submissionVersionId=55fb6548-…`) |
| Guide | `el-md-exp` |
| `runs` | 3 |
| Agent tools | `vision`, `measure-distance` |
| Flags | `logAllAgentTrace=true` |
| Bureau commit | post bureau#317 (measure-distance overlay agent-trace placeholder) |
| Conductor PR | post conductor#149 (templated agent.prompt + reviewPromptName seeding) |
| Artifacts | [`source-runs/el-md-exp/var-1/output/`](../source-runs/el-md-exp/var-1/output/) (canonical) |
| Metrics TSV | [`metrics/el-md-exp/var1-bifurcated-vision-tools/per-item.tsv`](el-md-exp/var1-bifurcated-vision-tools/per-item.tsv) |

**Notes**
- Re-fire post bureau#317 — measure-distance overlay's `review.md` now has `{{ agentTraceGuidance }}` placeholder, so `logAllAgentTrace=true` properly appends the emit-all-statuses override. **Coverage closed: 303/303 cells now have findings** (was 201/303 in RUN_1). All four statuses present.
- **Headline lift:** Goal A jumped from lower-bound 60.8% to definitive **74.5%** (+13.7pp). Var1's bifurcated agent invokes vision freely on most items it touches.
- **Goal B unchanged at 0/51** — agent still never invokes `measure-distance` directly. Same sparse-adoption pattern as cc var1's `inspect-drawing` (2/162). The signal isn't going to change without architectural intervention.
- Tools_used distribution: `vision` (208 occurrences), `Read` (12), `mcp__conductor_tools__vision` (4). Zero `measure-distance` entries.

**Supersedes**

`VISION_CHECK_REVIEW_EL_MD_EXP_VAR1_RUN_1` (workflow_runs.id `b877dead-f786-4bf6-9ac4-3cde3f2ec546`, review id `9e6f78e4-7cab-44b1-b23c-d564059c6e81`, fired 2026-05-07 21:15 UTC). RUN_1 in turn superseded the historical `experiment-run7.2`.

**Historical reference (RUN_1 partial-coverage data + the original April-15 era run)**

| Field | Value |
|---|---|
| `runLabel` | `experiment-run7.2` (alternate: `experiment-run7`) |
| Started | ~2026-04-15 |
| Artifacts | [`measure-distance-tool/runs/v5.0/el-md-exp/experiment-run7.2/`](../../measure-distance-tool/runs/v5.0/el-md-exp/experiment-run7.2/) (alternate: [`experiment-run7/`](../../measure-distance-tool/runs/v5.0/el-md-exp/experiment-run7/)) |
| Analysis doc | [`measure-distance-tool/analysis/rigorous-metrics/experiment-run7.2.md`](../../measure-distance-tool/analysis/rigorous-metrics/experiment-run7.2.md) |
| Recall (per (item × run)) | 13.1% (run7.2) / 12.4% (run7) |

#### el-md-exp / var2-vision-specialist-routing ⚠️ needs runs=3 re-fire

| Field | Value |
|---|---|
| `runLabel` | `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_6_BACKUP_LOCAL` |
| Inngest event id | _n/a — local conductor execution_ |
| `workflow_runs.id` | `f9e578b3-94f5-4fa6-8fca-6f49c1f029f4` |
| Review id | `0f477f13-6ee9-4eab-a2b5-17b07c4195f5` |
| Started | 2026-05-08 20:06 UTC |
| Completed | 2026-05-08 20:29 UTC (~23 min) |
| Workflow / overlay | `review` + `--experiment=vision-check` |
| Submission | Valley View Townhomes v1 (`submissionVersionId=55fb6548-…`) |
| Guide | `el-md-exp` |
| `runs` | **1** (local backup; cloud runs=3 re-fire pending) |
| Agent tools | `vision_check`, `semantic-search-blocks` |
| Flags | `logAllAgentTrace=true`, `step=review-runs` |
| `enabledVisionSpecialists` | `"generic-vision,measure-distance"` |
| Bureau commit | post bureau#324 (require submissionVersionId in `lib/sheet-resolution.ts`; migrate measure-distance + inspect-drawing) |
| Conductor PR | post conductor#153 (extract-measurement-pairs → measure-distance) + conductor#154 (submissionVersionId plumbing) |
| Artifacts | [`source-runs/el-md-exp/var-2/output/`](../source-runs/el-md-exp/var-2/output/) (canonical) |
| Metrics TSV | [`metrics/el-md-exp/var2-vision-specialist-routing/per-item.tsv`](el-md-exp/var2-vision-specialist-routing/per-item.tsv) |
| Run analysis | [`source-runs/el-md-exp/var-2/analysis.md`](../source-runs/el-md-exp/var-2/analysis.md) |
| Verdict comparison vs ctrl | [`source-runs/el-md-exp/var-2/compare-vs-ctrl.md`](../source-runs/el-md-exp/var-2/compare-vs-ctrl.md) |

**Notes**
- **First var-2 run on this set where measure-distance actually executes end-to-end.** RUN_3 (and the cloud RUN_4/RUN_5 attempts) had measurement dispatch crashing on a missing `version_number` column in `measure-distance.ts` (latent pre-existing bug, surfaced when conductor#153 wired up the dispatch chain). bureau#324 + conductor#154 fixed both the column and the silent-wrong-submission fallback footgun.
- 29 vision_check calls. Classifier intent: `generic=20, measurement=9, drawing_inspect=0`. 8 measurement-routed calls produced ≥1 pair → measure-distance ran 8 times → **24/24 per-pair distance measurements computed (100% subprocess success).**
- **Headline numbers (runs=1; cloud runs=3 re-fire pending):**
  - Goal A (any vision invoked): 19/51 = **37.3%** (lower than RUN_3's 47.1% only because runs=1 vs runs=3)
  - Goal B (classifier intent = measurement): 7/51 = **13.7%** (RUN_3 was 15.7%/8 — within single-run noise)
  - **Goal B' (classifier picked measurement AND measure-distance produced ≥1 distance): 7/51 = 13.7%.** Identical to Goal B — every measure-distance subprocess succeeded. Pre-fix runs all had B' = 0%.
- **Verdict-conversion lift:** of the 8 items with successful measure-distance, **6 escaped ctrl's `not-verifiable` majority verdict** (4 pass, 2 fail). 3 of those escaped ctrl's *unanimous* not-verifiable. The 2 fail items (EL-1.14, EL-1.37) are real compliance deficiencies the ctrl baseline would have left for human follow-up. See `compare-vs-ctrl.md` for the per-item table.
- **Caveats:**
  - `scaleInchesPerFoot` is hardcoded to `0.05` (1"=20'); per-sheet scale extraction is a follow-up.
  - Distance range was 0.9–387 ft (median 24.6); the 387 ft outlier is suspect and worth spot-checking.
  - EL-13.13 stayed `not-verifiable` despite measure-distance succeeding — worth investigating whether the agent rejected the measurement output.
  - **Substation/Inngest cloud path hanging** — cloud RUN_4 and RUN_5 attempts both hung in Substation's Inngest function with no LLM activity. Root cause not yet identified; this run was executed locally via `npm run conduct --step=review-runs` to bypass the cloud path.

**Supersedes**

`VISION_CHECK_REVIEW_EL_MD_EXP_RUN_3` (workflow_runs.id `f66d1589-616f-4830-ae0d-c02d450a3265`, review id `bb326fd5-6b1d-4fb7-988a-754656dc768c`, fired 2026-05-08 13:16 UTC, runs=3). RUN_3's measurement dispatch fell back to generic on every call due to the `version_number` bug + the not-yet-wired conductor measurement-dispatch. RUN_3 in turn superseded RUN_2 (`465fe4e5-9ce6-4554-9cbc-65cd75755b2b`, classifier-allow-list confounder) and RUN_1.

---

## What "complete" looks like

For phase 1 to declare done, all 6 cells should be ✅ **current** with no outstanding rerun reasons. Today's gap list:

- [ ] cc / var2: re-fire at `runs=3` to retire runs-disparity confounder on cc Goal A
- [x] el-md-exp / ctrl-baseline: phase-1 numbers populated (Goal A 41.2%; Goal B n/a)
- [x] el-md-exp / var1: re-fired as `VAR1_RUN_2` post bureau#317. Coverage closed (303/303 cells). **Goal A 74.5% (was lower-bound 60.8%)**, Goal B 0/51 (specialist still never invoked).
- [ ] el-md-exp / var2: re-fired as `RUN_6_BACKUP_LOCAL` post bureau#324 + conductor#153 + conductor#154. **Full chain executes end-to-end.** Goal A 37.3%, Goal B 13.7%, **Goal B' 13.7% (every measure-distance subprocess succeeded)**, **6 of 8 ctrl-not-verifiable items moved to a real verdict** (4 pass, 2 fail). runs=1 (local backup) — cloud runs=3 re-fire still pending to retire the runs-disparity confounder on Goal A.
- [x] **fix measure-distance overlay's `review.md`** ✅ landed via bureau#317 + validated by VAR1_RUN_2.
- [x] **bureau-side classifier prompt iteration for el-md-exp** ✅ delivered as conductor#151 + bureau#318 + validated by RUN_3.
- [x] **conductor measurement-dispatch wiring** ✅ delivered as conductor#153 (extract-measurement-pairs → measure-distance) + conductor#154 (submissionVersionId plumbing) + bureau#324 (require submissionVersionId, fix `version_number` ordering bug). Validated by RUN_6_BACKUP_LOCAL.
- [ ] **Open follow-up: Substation/Inngest cloud-path hang** — cloud RUN_4 and RUN_5 both hung in Substation's `Substation-workflow-run` Inngest function with no LLM activity. Local execution works fine; root cause unidentified.
- [ ] **Open follow-up: per-sheet scale extraction** — current chain hardcodes `scaleInchesPerFoot=0.05`. Sheets at other scales (1"=10', 1"=40') will mismeasure proportionally. Unblocks measurement *accuracy*; doesn't affect Goal A/B/B' (which measure routing + execution success, not numerical correctness).

The Phase 1 Metric Summary in [`analysis.md`](./analysis.md) reflects the new numbers. Phase-1 status:
- Goal A: NOT met overall on either set — but selectivity (var2's 22% misuse vs var1's 70% on el-md-exp) is the real differentiator.
- Goal B: ✅ MET on both sets (cc 25-33% vs 0%; el-md-exp 15.7% vs 0%). Architectural conclusion holds.
