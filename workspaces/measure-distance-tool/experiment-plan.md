# Measure-Distance Tool — A/B Experiment Plan

**Goal**: Iterate on the `measure-distance` tool in the conductor review pipeline by running `review-runs` repeatedly in two variants and diffing the outputs:

- **Baseline** — no measure-distance tool, stock review prompt.
- **Experiment** — measure-distance tool wired in, prompt includes usage instructions.

The delta between the two isolates the tool's contribution to finding quality on guide items where it's expected to matter.

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

```bash
cd conductor

# ---- BASELINE (no measure-distance) ----
rm -rf workspace/output/runs
npm run conduct -- --workflow=review --guide-code=el-md-exp \
  --submission-version-id=<SVD_ID> --step=review-runs --runs=3 --skip-upload
cp -r workspace/output/runs workspace/output/baseline-runs

# ---- EXPERIMENT (with measure-distance) ----
rm -rf workspace/output/runs
npm run conduct -- --workflow=review --guide-code=el-md-exp \
  --submission-version-id=<SVD_ID> --step=review-runs \
  --experiment=measure-distance --runs=3 --skip-upload

# ---- COMPARE ----
npx tsx scripts/compare-findings.ts \
  --baseline=workspace/output/baseline-runs \
  --experiment=workspace/output/runs
```

Iterating on the tool → change `measure-distance.ts` or the experiment's `review.md` → rerun just the experiment half → rerun compare. Baseline only needs to be regenerated if the guide set or model changes.

---

## Blockers / unknowns

1. **Submission version ID**: the Valley View Townhomes SVD_ID is needed. Project ID `63cead15-41f8-418c-b0ef-bd5c2b44719a` is already present in `conductor/workspace/projects/`.
2. **Vercel AI Gateway key**: `measure-distance.ts` calls `gateway('google/gemini-3.1-pro-preview')`. Confirm `VERCEL_AI_GATEWAY_SECRET` (or equivalent) is in `conductor/.env`.
3. **Timeouts**: the 2026-04-15 run had 13/19 measure-distance calls time out at the `createScriptTool` 120s cap. Options: increase the cap, or accept timeouts as useful signal — they already surface in the compare report as "tool unavailable" outcomes.
4. **Control-group guide items**: see open question under change #1.
5. **Cost**: 7 items × 3 runs × 2 variants = 42 agent invocations. Cheap on Haiku 4.5. Measure-distance adds Gemini Vision costs per tool call.
