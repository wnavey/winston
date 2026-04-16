# Queued Fixes — measure-distance tool

Tracks fixes shipped since the last experiment run, so the next run captures all improvements at once.

---

## Last experiment run

| Field | Value |
|---|---|
| **Date** | 2026-04-15 ~12:01–12:14 UTC |
| **Workflow** | `review` v5.1.0 with `--experiment=measure-distance` overlay |
| **Guide set** | `el-md-exp` (items 1.md, 2.md, 13.md) |
| **Runs** | 3 (ensemble) |
| **Model** | `claude-haiku-4-5-20251001` |
| **Project** | Valley View Townhomes (`63cead15-41f8-418c-b0ef-bd5c2b44719a`) |
| **Outputs** | `runs/experiment-2026-04-15/` (findings + measure-distance-calls + logs) |
| **Baseline** | `runs/baseline-2026-04-15/` (same items, no tool) |
| **Test-script replay** | `runs/test-script-2026-04-15/test-1/` (14 fixture cases) |
| **Results** | 14 tool calls attempted, 0 useful distances (wrong scale + infra bugs) |

---

## Fixes shipped since last experiment

### Bureau

| PR | Merged | Fix | Addresses issue |
|---|---|---|---|
| **#221** | 2026-04-15 | Python 3.9 compat: `str \| None` → `Optional[str]` via `from __future__ import annotations` | All 8 calls that reached Python failed at import time |
| **#223** | 2026-04-15 | `test-script` workflow: replay a script over a JSON fixture without agent loop | Infrastructure for faster iteration |
| **#224** | 2026-04-15 | `test-script` workflow: pass `projectId` from fixture through to script args | All 14 replay cases failed with "projectId not provided" |
| **#225** | 2026-04-16 | **Prompt: measure before defaulting to not-verifiable** — explicit instruction to use the tool when plans lack dimensions; systematic coverage guidance; scale parameter must be numeric with examples (`0.05` for 1"=20') | Issues #3 (agent under-usage), #4 (wrong scale values) |

### Conductor

| PR | Merged | Fix | Addresses issue |
|---|---|---|---|
| **#117** | 2026-04-15 | `CHECKLIST_ITEM` / `RUN_INDEX` env vars passed to tool subprocesses | Attribution: per-call artifacts now know which guide item + run they belong to |
| **#118** | 2026-04-15 | MCP input validation: accept numeric and boolean arg values (not just strings) | 6 of 14 original experiment calls were rejected before reaching the script |
| **#119** | 2026-04-15 | Script steps: support checklist-driven parallel iteration | Enables the `test-script` replay workflow |
| **#121** | 2026-04-15 | Shell-quote script-step arg values + add `NODE_PATH` for conductor deps | Replay fixture values with `()` and spaces broke `/bin/sh`; scripts couldn't import `ai` package |

---

## What the next experiment run will test

With all the above merged, the next `--experiment=measure-distance` run should show:

1. **Dramatically more tool invocations** — prompt now says "measure before marking not-verifiable" and "systematically measure every applicable pair." Target: 50+ calls (up from 14).
2. **Correct scale values** — prompt gives explicit numeric examples (`0.05`, `0.025`). Target: zero "1 inch = 20 feet" strings, zero bare `"1"` values.
3. **Meaningful distances** — with correct scale, the Python compute-distance step should produce real-world-plausible measurements (e.g., 5-20 ft for transformer-to-building clearances).
4. **Rich per-call artifacts** — every call produces `prompt.txt`, `cropped.jpg`, `response.txt`, `localization.json`, `metadata.json`, `debug.png`, `events.jsonl` in a unique call directory.
5. **Attribution** — each call's metadata includes `checklistItem` and `runIndex` from conductor env vars.

### Still NOT fixed for next run (known limitations)

- **No drawing-block cropping** (issue #1) — full page still sent to Gemini
- **No legend context** (issue #2) — most sheets return `legendSource: "none"`
- **Option A still a stub** (issue #8) — every call goes through Gemini
- **No Gemini timeout** (issue #9) — pathological 200s+ calls still possible
- **Python 90s timeout unchanged** (issue #7) — Option A still wastes 60-80s before failing
- **No vertical distance support** (issue #10)

---

## How to run the next experiment

```bash
cd ~/code/controlroom/conductor

# Pull latest bureau + conductor (both have fixes merged to main)
# Then:

# Baseline (only needed if guide set or model changed — reuse existing if not)
# runs/baseline-2026-04-15/ is still valid

# Experiment
rm -rf workspace/output/runs workspace/output/measure-distance-calls
npm run conduct -- \
  --workflow=review \
  --guide-code=el-md-exp \
  --submission-version-id=55fb6548-814f-4287-bc4a-6018b756d730 \
  --step=review-runs \
  --experiment=measure-distance \
  --runs=3 \
  --skip-upload

# Archive results to winston
cp -r workspace/output/runs \
  ~/code/controlroom/winston/workspaces/measure-distance-tool/runs/experiment-2026-04-16/
rsync -a --exclude=tmp workspace/output/measure-distance-calls/ \
  ~/code/controlroom/winston/workspaces/measure-distance-tool/runs/experiment-2026-04-16/measure-distance-calls/
```
