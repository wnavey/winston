# Queued Fixes — measure-distance tool

Tracks fixes shipped since the last experiment run, so the next run captures all improvements at once.

---

## Last experiment run

| Field | Value |
|---|---|
| **Run** | experiment-run3 |
| **Date** | 2026-04-17 ~17:00–17:25 UTC |
| **Workflow** | `review` v5.1.0 with `--experiment=measure-distance` overlay |
| **Guide set** | `el-md-exp` (items 1.md, 2.md, 13.md) |
| **Runs** | 3 (ensemble) |
| **Model** | `claude-haiku-4-5-20251001` |
| **Project** | Valley View Townhomes (`63cead15-41f8-418c-b0ef-bd5c2b44719a`) |
| **Outputs** | `runs/experiment-run3/` |
| **Results** | 26 call-dirs, 12 completed, 9 non-zero distances (2.3–31.8 ft). First run with correct scale formula, real image cropping, objectPairs batching. |

---

## Fixes shipped since experiment-run3

### Bureau

| PR | Merged | Fix | Expected impact |
|---|---|---|---|
| **#238** | 2026-04-17 | **Two-call Gemini approach** (Phase A): call 1 at 120 DPI for coarse localization → refined crop rendered from PDF at 300 DPI → call 2 for precise nearestPoints. Includes `computeRefinedCropBbox()` (union + padding + quadrant floor) and `renderPdfRegion()` (PyMuPDF high-DPI render). | 2.5–6× effective DPI in the measurement region. Should improve localization precision for close objects that currently return 0 ft. |

### Winston

| PR | Merged | Fix | Expected impact |
|---|---|---|---|
| **#11** | 2026-04-17 | **Viewer step toggle** for two-call mode. Call 1 and call 2 are independently inspectable in the Detection step. Build-manifest detects `call1-*`/`call2-*` prefixed artifacts. | Debug visibility into each Gemini call — can compare coarse vs refined localization. |

### Previously shipped (in experiment-run3)

Bureau: #229 (axis swap), #232 (scale formula + disable vector refinement), #233 (bbox format), #234 (objectPairs)
Conductor: #122 (typed tool schema), #123 (array + JSON quoting)

### Previously shipped (in experiment-run2)

Bureau: #221, #223, #224, #225, #226, #228
Conductor: #117, #118, #119, #121

---

## What experiment-run4 will test

With bureau#238 merged, the next run introduces the **two-call Gemini pipeline**. Expected improvements:

1. **Higher effective DPI** — call 2 operates on a refined crop rendered at 300 DPI (vs 120 DPI for the full drawing). For a quadrant crop, that's 2.5× the pixel density in the measurement region.

2. **More precise nearestPoints** — with more pixels per inch, Gemini should distinguish features that appear overlapping at 120 DPI. The 3 cases in run3 that returned 0 ft (tree directly on OHE line) may show small but non-zero separations.

3. **Call 1 → call 2 fallback** — if call 2 times out (a risk since it's a second sequential Gemini call), the pipeline falls back to call 1's coarse localization. Existing behavior preserved.

4. **Prefixed artifacts** — each call-dir now has `call1-*` and `call2-*` artifacts, visible in the viewer via the step toggle.

### Still NOT fixed for run4 (known limitations)

- **No legend symbol images** (Phase B — future) — legend context is still text, not visual
- **Option A still a stub** — every call goes through Gemini
- **No Gemini timeout** — pathological 200s+ calls still possible
- **No vertical distance support**
- **Agent tracing schema** — Review 5.0 not yet updated with observation/reasoning fields

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
