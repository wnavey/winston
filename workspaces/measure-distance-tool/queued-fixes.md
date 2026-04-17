# Queued Fixes — measure-distance tool

Tracks fixes shipped since the last experiment run, so the next run captures all improvements at once.

---

## Last experiment run

| Field | Value |
|---|---|
| **Run** | experiment-run4 |
| **Date** | 2026-04-17 ~20:31–21:13 UTC |
| **Workflow** | `review` v5.1.0 with `--experiment=measure-distance` overlay |
| **Guide set** | `el-md-exp` (items 1.md, 2.md, 13.md) |
| **Runs** | 3 (ensemble) |
| **Model** | `claude-haiku-4-5-20251001` |
| **Project** | Valley View Townhomes (`63cead15-41f8-418c-b0ef-bd5c2b44719a`) |
| **Outputs** | `runs/experiment-run4/` |
| **Results** | 55 call-dirs, 41 results (two-call pipeline, 100% call2 success), 35 non-zero (85%). First run with two-call Gemini (300 DPI). 12 outliers >100 ft need investigation. |

---

## Fixes shipped since experiment-run4

### Bureau (queued for run5)

| PR | Status | Fix | Expected impact |
|---|---|---|---|
| **#241** | merged | **Per-phase latency logging** — downloadMs, contextMs, geminiMs, pythonMs in metadata.json | Latency visibility per pipeline phase |
| **Phase B** | in progress | **Legend symbol images** — vector search for legend blocks matching objectA/objectB, crop at 300 DPI, send as images to both Gemini calls | Better object identification; Gemini sees what symbols look like instead of reading text descriptions |
| TBD | queued | **Distance sanity-check** — flag measurements exceeding sheet physical dimensions as low confidence | Fix the 29% outlier rate (>100 ft) from run4's two-call pipeline |

### Previously shipped (in experiment-run4)

Bureau: #235 (reasoning capture), #236 (Option A short-circuit), #238 (two-call Gemini Phase A)
Conductor: #125 (600s timeout)
Winston: #11 (viewer step toggle)

### Previously shipped (in experiment-run3)

Bureau: #229 (axis swap), #232 (scale formula + disable vector refinement), #233 (bbox format), #234 (objectPairs)
Conductor: #122 (typed tool schema), #123 (array + JSON quoting)

### Previously shipped (in experiment-run2)

Bureau: #221, #223, #224, #225, #226, #228
Conductor: #117, #118, #119, #121

---

## What experiment-run5 will test

With Phase B (legend symbol images) and the distance sanity-check, run5 should show:

1. **Visual legend context** — Gemini sees cropped images of the relevant legend
   symbols instead of a 15 KB text dump. Should improve object identification,
   especially for ambiguous symbols (tree types, transformer vs pull-box, etc.).

2. **Legend images on both calls** — fetched upfront before call 1, attached to
   both call 1 and call 2. Call 1 gets visual help identifying the right features
   for the refined crop.

3. **Distance sanity-check** — measurements exceeding the sheet's physical
   dimensions flagged as low confidence. Should eliminate the 29% outlier rate
   from run4.

4. **Per-phase latency** — downloadMs, contextMs, geminiMs, pythonMs captured
   in metadata.json (bureau#241).

### Still NOT fixed for run5 (known limitations)

- **Call 1 bbox bias on call 2** — if call 1 misidentifies, call 2 looks at the wrong region
- **Option A still disabled** — every call goes through Gemini
- **No Gemini-level timeout** — long-tail 200s+ calls still possible
- **No vertical distance support**
- **Agent tracing schema** — Review 5.0 not yet updated

---

## How to run experiment-run4

```bash
cd ~/code/controlroom/conductor
npm run conduct -- --workflow=review --guide-code=el-md-exp \
  --submission-version-id=55fb6548-814f-4287-bc4a-6018b756d730 \
  --step=review-runs --experiment=measure-distance --runs=3 \
  --max-workers=9 --skip-upload --clean
```

After completion, archive to `runs/experiment-run4/` and run the viewer:

```bash
cd ~/code/controlroom/winston/workspaces/measure-distance-tool/viewer
./serve.sh
```

## How to run the test-script fixture replay (faster, no agent loop)

```bash
cd ~/code/controlroom/winston/workspaces/measure-distance-tool
./scripts/run-test-script.sh
```
