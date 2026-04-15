# Measure-Distance Tool — A/B Experiment Plan

**Goal**: Iterate on the `measure-distance` tool in the conductor review pipeline by running `review-runs` repeatedly in two variants and diffing the outputs:

- **Baseline** — no measure-distance tool, stock review prompt.
- **Experiment** — measure-distance tool wired in, prompt includes usage instructions.

The delta between the two isolates the tool's contribution to finding quality on guide items where it's expected to matter.

---

## Status

| # | Change | Status | Landed in |
|---|---|---|---|
| 1 | Trimmed guide folder `el-md-exp/` (7 invoking + 3 control items) | ✅ done | noetic-inc/bureau#218 |
| 2 | Copy measure-distance scripts + python deps into `review/` | ✅ done | noetic-inc/bureau#218 |
| 3 | Experiment overlay `review/experiments/measure-distance/` | ✅ done | noetic-inc/bureau#218 |
| 4 | `python: true` in `review/workflow.yaml` resources | ✅ done | noetic-inc/bureau#218 |
| 5 | Conductor `--experiment=<name>` flag + overlay loader | ✅ done | noetic-inc/conductor#116 |
| 6 | `compare-findings.ts` script (baseline vs experiment diff) | ⬜ pending | — |

**Verified IDs for Valley View Townhomes:**
- Project: `63cead15-41f8-418c-b0ef-bd5c2b44719a`
- Submission: `8fea702d-952c-4aa0-ab00-f848d8abf5b6`
- Submission version (v1, only version): `55fb6548-814f-4287-bc4a-6018b756d730`

---

## Design

### Experiment overlay pattern

A new conductor CLI flag `--experiment=<name>` loads a self-contained experiment directory that overrides specific step config. The main workflow and its prompts are never touched.

**Layout**

```
bureau/jurisdictions/austin/workflows/review/experiments/
  measure-distance/
    review.md              # prompt with measure-distance instructions
    experiment.yaml        # declares what this overlay changes
```

**`experiment.yaml` shape**

```yaml
name: measure-distance
overrides:
  review-runs:
    prompt: review.md                 # path relative to this experiment dir
    tools:
      - vision
      - script:measure-distance
```

**Conductor change** — in `step-executor.ts`, when `input.experiment` is set:

1. Read `workflows/review/experiments/<name>/experiment.yaml`
2. For each step named in `overrides`, merge/replace fields on the step config before executing
3. Prompts resolve from the experiment dir instead of `review/prompts/`

### Baseline vs. experiment

| | Prompt | Tools |
|---|---|---|
| **Baseline** (no `--experiment`) | stock `review/prompts/review.md` (no mention of measure-distance) | `vision` only |
| **Experiment** (`--experiment=measure-distance`) | `review/experiments/measure-distance/review.md` (includes measure-distance instructions) | `vision` + `script:measure-distance` |

The baseline agent can't call `run_measure_distance` (not registered) *and* doesn't know it exists (not in the prompt), so it falls back to visual/scale estimates. The experiment run has both the tool and the instructions for when to use it. Same 7 guide items, same model, same runs count — only the tool + prompt differ. Any finding-quality delta is attributable to the tool.

### Why an overlay instead of additive `--extra-tools`

- Tools and prompt stay in sync by construction. Can't accidentally ship tool-enabled with stock prompt (the prompt won't mention the tool, so it'll never fire).
- Baseline is trivial — just omit the flag.
- Adding a second experiment later (different tool / different prompt / different model) is a new folder.
- No edits to shared assets.

---

## Change list (risk-ordered, smallest first)

### 1. Bureau — trimmed guide folder

Create `bureau/jurisdictions/austin/review-guides/el-md-exp/` with 7 guide files copied from `el/`:

- `2.md`, `3.md`, `4.md`, `7.md`, `13.md`, `14.md`, `16.md`

These are the electric discipline guide items that invoked measure-distance in the 2026-04-15 run (see `measure-distance-tool-invocation-by-checklist-item.md`).

**Open question**: should this folder also include 2–3 non-invoking items (e.g. `1.md`, `5.md`, `10.md`) as a null-effect control, to verify the tool doesn't cause regressions on items where it shouldn't fire? Probably yes.

### 2. Bureau — copy measure-distance scripts to `review/`

`measure-distance.ts` and `measure-distance-impl.py` currently only exist under `review-4.3/scripts/`. Copy them to `review/scripts/` and add `pymupdf>=1.25.0` + `Pillow>=10.0` to `review/requirements.txt`.

### 3. Bureau — create experiment overlay

Create `review/experiments/measure-distance/`:

- `review.md` — copy of stock `review/prompts/review.md` + a new "Using the Measure-Distance Tool" section. Prompt language starts with *"If you have access to a `run_measure_distance` tool…"* so the model degrades gracefully if the tool isn't registered.
- `experiment.yaml` — per the shape above.

### 4. Bureau — add `python: true` to `review/workflow.yaml` resources

So fresh workspaces bootstrap the Python venv needed by `measure-distance-impl.py`. No-op for the existing workspace (`conductor/workspace/venv/` is already built).

### 5. Conductor — add `--experiment` CLI flag + overlay loader

**Files:**

- `conductor/src/index.ts` — add `experiment` to the CLI arg list; pipe to `input.experiment`.
- `conductor/src/orchestrator/step-executor.ts` — when `input.experiment` is set, resolve `workflows/<workflow>/experiments/<name>/experiment.yaml`, apply `overrides[stepName]` onto the step config before execution. Prompt paths in an overlay resolve from the experiment dir, not the default prompts dir.

The overlay logic is the only conductor-code change. It's localized to step config resolution.

### 6. Conductor — comparison script

Create `conductor/scripts/compare-findings.ts`:

- Inputs: `--baseline=<runs-dir>` and `--experiment=<runs-dir>`, each pointing to an `output/runs/` directory.
- For each `runIndex` / guide item, load `findings/<item>.json` on both sides and compute:
    - Finding count delta
    - Added/removed deficiency IDs
    - Status changes (e.g. `not-verifiable` → `fail`)
    - Whether text cites the measure-distance tool (Tier A evidence)
- Output: markdown table.

Standalone — not a conductor step. Easier to iterate on.

---

## Running an experiment

All commands run from `~/code/controlroom/conductor`.

### Baseline — no measure-distance tool

```bash
cd ~/code/controlroom/conductor
rm -rf workspace/output/runs
npm run conduct -- \
  --workflow=review \
  --guide-code=el-md-exp \
  --submission-version-id=55fb6548-814f-4287-bc4a-6018b756d730 \
  --step=review-runs \
  --runs=3 \
  --skip-upload
cp -r workspace/output/runs workspace/output/baseline-runs
```

### Experiment — with measure-distance tool

```bash
cd ~/code/controlroom/conductor
rm -rf workspace/output/runs
npm run conduct -- \
  --workflow=review \
  --guide-code=el-md-exp \
  --submission-version-id=55fb6548-814f-4287-bc4a-6018b756d730 \
  --step=review-runs \
  --experiment=measure-distance \
  --runs=3 \
  --skip-upload
cp -r workspace/output/runs workspace/output/experiment-runs
```

### Compare (once `compare-findings.ts` exists)

```bash
cd ~/code/controlroom/conductor
npx tsx scripts/compare-findings.ts \
  --baseline=workspace/output/baseline-runs \
  --experiment=workspace/output/experiment-runs
```

### Iteration loop

Changing `measure-distance.ts` or the experiment's `review.md` → rerun just the experiment block → rerun compare. Baseline only needs to be regenerated if the guide set or model changes.

### Resuming a partial run

If a run fails partway (e.g. rate limits or auth failure on a few checklist items):

```bash
cd ~/code/controlroom/conductor
npm run conduct -- --resume --reset-failed
```

`--resume` reads the saved step from `workspace/workflow/status.json`; `--reset-failed` puts failed checklist items back in the queue.

---

## Blockers / unknowns

1. ~~**Submission version ID**~~ ✅ resolved: `55fb6548-814f-4287-bc4a-6018b756d730`.
2. **Vercel AI Gateway key**: `measure-distance.ts` calls `gateway('google/gemini-3.1-pro-preview')`. Confirm `VERCEL_AI_GATEWAY_SECRET` (or equivalent) is in `conductor/.env`.
3. **Timeouts**: the 2026-04-15 run had 13/19 measure-distance calls time out at the `createScriptTool` 120s cap. Options: increase the cap, or accept timeouts as useful signal — they already surface in the compare report as "tool unavailable" outcomes.
4. **Control-group guide items**: landed with 3 controls (`1.md`, `5.md`, `10.md`) alongside the 7 invoking items. Easy to drop if noisy.
5. **Cost**: 10 items × 3 runs × 2 variants = 60 agent invocations. Cheap on Haiku 4.5. Measure-distance adds Gemini Vision costs per tool call.
