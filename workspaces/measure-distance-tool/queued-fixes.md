# Queued Fixes — measure-distance tool

Tracks fixes shipped since the last experiment run, so the next run captures all improvements at once.

---

## Last experiment run

| Field | Value |
|---|---|
| **Date** | 2026-04-16 ~14:43–15:15 UTC |
| **Workflow** | `review` v5.1.0 with `--experiment=measure-distance` overlay |
| **Guide set** | `el-md-exp` (items 1.md, 2.md, 13.md) |
| **Runs** | 3 (ensemble) |
| **Model** | `claude-haiku-4-5-20251001` |
| **Project** | Valley View Townhomes (`63cead15-41f8-418c-b0ef-bd5c2b44719a`) |
| **Outputs** | `runs/experiment-run2/` |
| **Test-script replay** | `runs/run2-test-fixture-1/` (13 fixture cases, with bureau#229 axis fix) |
| **Results** | 12 tool calls, all returned 0.0 ft (scale formula inverted + vector refinement overwriting Gemini points + bbox format mismatch) |

---

## Fixes shipped since experiment-run2

### Bureau

| PR | Merged | Fix | Addresses issue |
|---|---|---|---|
| **#229** | 2026-04-17 | Swap nearestPoint axis order to match Gemini [y, x] convention | Python was reading nearestPoint as [x, y] but Gemini returns [y, x] |
| **#232** | 2026-04-17 | **Scale formula inverted** (`*` → `/`), **disable vector refinement** (overwriting Gemini's correct nearestPoints with garbage), **standardize Gemini prompt** to [y, x] for both bbox and nearestPoint | The three root causes of 0.0 ft distances |
| **#233** | 2026-04-17 | **Fix drawing bbox format** — DB stores `{x, y, width, height}`, code expected `{x0, y0, x1, y1}`. All keys missed, defaults produced full-page bbox, no cropping ever happened. | Outstanding issue #1 (drawing block cropping) |

### Conductor

| PR | Merged | Fix | Addresses issue |
|---|---|---|---|
| **#122** | 2026-04-16 | Typed tool schema with per-field types/descriptions | Agent sees named params, Zod validates before script runs |
| **#123** | 2026-04-16 | Array support in tool schema + shell quoting for JSON values | Enables `applicable_checklist_items` array field |

### Previously shipped (in experiment-run2)

Bureau: #221, #223, #224, #225, #226, #228
Conductor: #117, #118, #119, #121

---

## What the next run will test

With all the above merged, the next test-script replay (or experiment run) should show:

1. **Real distances** — scale formula fixed (`/` not `*`), vector refinement disabled. Expect 5-100 ft range for typical clearances instead of 0.0.
2. **Actual image cropping** — drawing bbox parsed correctly from `{x, y, width, height}` format. Sheet 21 crops to 88%×94%, sheet 31 to 65%×60%. Gemini gets focused drawing at higher effective resolution.
3. **Consistent coordinate axes** — Gemini prompt asks for [y, x] everywhere (bbox + nearestPoint). Python reads [y, x] everywhere. No more axis-swap ambiguity.
4. **Typed tool schema** (conductor#122, #123) — agent sees per-field types/descriptions, Zod rejects bad inputs at MCP level.

### Still NOT fixed for next run (known limitations)

- **Option A still a stub** (issue #8) — every call goes through Gemini
- **No Gemini timeout** (issue #9) — pathological 200s+ calls still possible
- **Python 90s timeout unchanged** (issue #7) — but much faster now that vector refinement is disabled
- **No vertical distance support** (issue #10)

---

## How to run the next test-script replay

```bash
cd ~/code/controlroom/winston/workspaces/measure-distance-tool/scripts
./run-test-script.sh  # defaults to experiment-run2 fixture
```

## How to run a full experiment

```bash
cd ~/code/controlroom/conductor
npm run conduct -- --workflow=review --guide-code=el-md-exp \
  --submission-version-id=55fb6548-814f-4287-bc4a-6018b756d730 \
  --step=review-runs --experiment=measure-distance --runs=3 \
  --max-workers=9 --skip-upload --clean
```
