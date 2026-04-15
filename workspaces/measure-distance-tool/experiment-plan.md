# Measure-Distance Tool — A/B Experiment Plan

**Goal**: Iterate on the `measure-distance` tool in the conductor review pipeline by running `review-runs` repeatedly in two variants and diffing the outputs:

- **Baseline** — no measure-distance tool, stock review prompt.
- **Experiment** — measure-distance tool wired in, prompt includes usage instructions.

The delta between the two isolates the tool's contribution to finding quality on guide items where it's expected to matter.

---

## Status

### Infrastructure (all merged)

| # | Change | Status | Landed in |
|---|---|---|---|
| 1 | Trimmed guide folder `el-md-exp/` (10 items: 7 invoking + 3 control) | ✅ done | noetic-inc/bureau#218 |
| 2 | Copy measure-distance scripts + python deps into `review/` | ✅ done | noetic-inc/bureau#218 |
| 3 | Experiment overlay `review/experiments/measure-distance/` | ✅ done | noetic-inc/bureau#218 |
| 4 | `python: true` in `review/workflow.yaml` resources | ✅ done | noetic-inc/bureau#218 |
| 5 | Conductor `--experiment=<name>` flag + overlay loader | ✅ done | noetic-inc/conductor#116 |
| 6 | Conductor: `CHECKLIST_ITEM` / `CHECKLIST_INDEX` / `RUN_INDEX` env vars to tool subprocesses | ✅ done | noetic-inc/conductor#117 |
| 7 | Bureau: rich per-call artifact directory for measure-distance | ✅ done | noetic-inc/bureau#219 |
| 8 | `compare-findings.ts` script (baseline vs experiment diff) | ⬜ pending | — |

### Runs

| Run | When | Guide set | Tool enabled? | Outcome |
|---|---|---|---|---|
| **Baseline (10-item)** | 2026-04-15 | `el-md-exp` (10 items) | No | ✅ completed. Archived to `winston/workspaces/measure-distance-tool/baseline-runs/`. |
| **Experiment attempt #1** | 2026-04-15 | `el-md-exp` (10 items) | Yes (v5.1.0 overlay) | ❌ cancelled — logging was insufficient to debug tool behavior. Cancelled mid-flight so we could ship PRs #117 + #219 first. |
| **Experiment #2 (current)** | 2026-04-15 in progress | `el-md-exp` trimmed to `1.md`, `2.md`, `13.md` | Yes + rich logging | 🟡 running |

**Dataset trimmed**: from the original 10 items down to **3 items** for faster iteration:
- `1.md` — control (no prior tool usage, null-effect check)
- `2.md` — tool-invoking (tree clearances from overhead electric)
- `13.md` — tool-invoking (transformer pad clearances)

**Verified IDs for Valley View Townhomes:**
- Project: `63cead15-41f8-418c-b0ef-bd5c2b44719a`
- Submission: `8fea702d-952c-4aa0-ab00-f848d8abf5b6`
- Submission version (v1, only version): `55fb6548-814f-4287-bc4a-6018b756d730`

---

## Design

### Experiment overlay pattern

A conductor CLI flag `--experiment=<name>` loads a self-contained experiment directory that overrides specific step config. The main workflow and its prompts are never touched.

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

Engine applies the overlay per-step in `engine.ts` right before dispatch. Non-targeted steps are unaffected.

### Baseline vs. experiment

| | Prompt | Tools |
|---|---|---|
| **Baseline** (no `--experiment`) | stock `review/prompts/review.md` (no mention of measure-distance) | `vision` only |
| **Experiment** (`--experiment=measure-distance`) | `review/experiments/measure-distance/review.md` (includes measure-distance instructions) | `vision` + `script:measure-distance` |

The baseline agent can't call `run_measure_distance` (not registered) *and* doesn't know it exists (not in the prompt), so it falls back to visual/scale estimates. The experiment run has both the tool and the instructions for when to use it. Same 3 guide items, same model (`claude-haiku-4-5-20251001`), same `runs=3` ensemble — only the tool + prompt differ. Any finding-quality delta is attributable to the tool.

### Why an overlay instead of additive `--extra-tools`

- Tools and prompt stay in sync by construction. Can't accidentally ship tool-enabled with stock prompt (the prompt won't mention the tool, so it'll never fire).
- Baseline is trivial — just omit the flag.
- Adding a second experiment later (different tool / different prompt / different model) is a new folder.
- No edits to shared assets.

### Rich per-call logging (bureau#219 + conductor#117)

Every measure-distance invocation produces a self-contained artifact directory so calls can be replayed or audited offline:

```
workspace/output/measure-distance-calls/<callId>/
  prompt.txt         # full Gemini prompt
  legend.txt         # legend context used
  cropped.jpg        # exact image sent to Gemini
  response.txt       # raw Gemini response text
  localization.json  # parsed bboxes + nearest points
  debug.png          # Python's annotated measurement image
  metadata.json      # structured record with pointers to all siblings
  events.jsonl       # per-call event stream
```

`callId` format: `<iso-timestamp>-<4-char-random>[-<run>-<item>]` — unique across parallel calls and encodes attribution context.

**Attribution**: conductor sets `CHECKLIST_ITEM`, `CHECKLIST_INDEX`, `RUN_INDEX` env vars when spawning each tool subprocess. The tool reads these and bakes them into `callId`, every log event, and `metadata.json`. This closes the attribution gap: before #117/#219, logs could not be joined back to a specific `(run-N, guide-item.md)` pair without timestamp correlation.

**Note on deficiency attribution**: the tool fires during the agent's research phase, before specific deficiency IDs are decided. The rich inputs (objectA/objectB text, measured value) let a post-hoc analysis script cross-reference against the agent's final findings to attribute measurements to deficiencies (Tier A/B/C heuristic from the 2026-04-15 invocation report).

### Option A vs Option B

- **Option A** (PyMuPDF vector path matching) is a v1 stub that always returns `success: false` with reason `"Pattern matching not yet implemented"`. Every successful measurement currently goes through Option B.
- **Option B** is a single Gemini 3.1 Pro call via Vercel AI Gateway that locates both objectA and objectB on the cropped drawing. One tool invocation = one Gemini call. The agent calls the tool multiple times per guide file if multiple object pairs need measuring.

---

## Running an experiment

All commands from `~/code/controlroom/conductor`.

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

### Experiment — with measure-distance tool (rich logging enabled)

```bash
cd ~/code/controlroom/conductor
rm -rf workspace/output/runs workspace/output/measure-distance-calls
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

### Fixture replay — exercise `measure-distance.ts` without the agent loop

For iterating on the tool layer in isolation (no Claude tokens, no review prompt),
replay the exact 14 calls the agent made during the 2026-04-15 run against the
current `measure-distance.ts`. Requires the `test-script` workflow (conductor
checklist-driven script steps, noetic-inc/conductor#119) and the `test-script`
bureau workflow YAML.

Fixture: `winston/workspaces/measure-distance-tool/replay/fixtures/experiment-2026-04-15-all-calls.json`
(14 cases: 8 that reached the Python script + 6 that were rejected at MCP
validation — useful for verifying conductor#118's schema fix).

```bash
cd ~/code/controlroom/conductor
rm -rf workspace/output/measure-distance-calls workspace/output/replay
npm run conduct -- \
  --workflow=test-script \
  --scriptName=measure-distance \
  --testCasesPath=/Users/winston/workspace/winston/workspaces/measure-distance-tool/replay/fixtures/experiment-2026-04-15-all-calls.json \
  --maxParallel=3 \
  --skip-upload
cp -r workspace/output/measure-distance-calls \
      /Users/winston/workspace/winston/workspaces/measure-distance-tool/replay/results-$(date +%Y%m%d-%H%M%S)/
```

One call-dir per test case in `workspace/output/measure-distance-calls/`; compare
`localization.json` + any `measure-distance.json` against the same directories
under `experiment-runs/measure-distance-calls/` for regressions.

After the run, inspect individual calls at `workspace/output/measure-distance-calls/<callId>/`.

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
3. **Timeouts**: the 2026-04-15 historical run had 13/19 measure-distance calls time out at the `createScriptTool` 120s cap. Options: increase the cap, or accept timeouts as useful signal — they already surface in the compare report as "tool unavailable" outcomes.
4. **Control set** — down to just `1.md` after trimming the dataset. Watch for regressions on this one control item.
5. **Cost**: 3 items × 3 runs × 2 variants = 18 agent invocations per full cycle. Cheap on Haiku 4.5. Measure-distance adds Gemini Vision costs per tool call (~20–30 calls/run based on historical pattern).

---

## What's next

1. ⏳ Wait for current experiment run to complete (3 items × 3 runs = 9 parallel agents, multiple measure-distance calls each).
2. 📁 Archive experiment results (`runs/` + `measure-distance-calls/`) into `winston/workspaces/measure-distance-tool/experiment-runs/` for durability.
3. 🛠️ Build `compare-findings.ts` against the real rich-artifact data, then iterate on the tool (prompt wording, crop strategy, timeout handling, etc.) using the A/B diff as feedback signal.
