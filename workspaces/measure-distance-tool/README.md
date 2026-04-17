# measure-distance-tool workspace

Workspace for iterating on the `measure-distance` tool — a Gemini Vision + PyMuPDF pipeline that measures horizontal distances between objects on site plan sheets for automated compliance review.

**Project under test:** Valley View Townhomes (`63cead15-41f8-418c-b0ef-bd5c2b44719a`)
**Discipline:** Electric (`el-md-exp` — trimmed to guides 1, 2, 13)

## Quick start

```bash
# View Gemini bounding-box overlays for all 14 test cases
cd viewer && ./serve.sh     # opens localhost:8401

# Replay the measure-distance script against captured fixtures
cd ~/code/controlroom/conductor
npm run conduct -- --workflow=test-script --scriptName=measure-distance \
  --testCasesPath="$(pwd)/../winston/workspaces/measure-distance-tool/replay/fixtures/experiment-run1-all-calls.json" \
  --maxParallel=3 --skip-upload

# Run a full experiment (baseline + tool-enabled)
# See experiment-plan.md for the exact commands
```

## Directory layout

```
measure-distance-tool/
├── experiment-plan.md              # living plan: status, design, run commands
├── README.md                       # this file
│
├── analysis/                       # reports and post-hoc analysis
│   ├── items-requiring-distance-measurement.md   # 101-item deep dive (52 need measurement)
│   ├── checklist-item-gemini-call-mapping.md      # mapping tool calls → checklist items
│   ├── invocation-by-checklist-item.md            # which guide items invoked the tool
│   └── usage-nudging-analysis.md                  # why agents under-use the tool
│
├── reference/                      # tool architecture + overview docs
│   ├── architecture-overview.md    # TS/Python split, Option A/B, data flow
│   ├── tool-overview.md            # high-level tool description
│   └── usage-report.md             # usage patterns from the first experiment
│
├── valley-view-townhomes/          # site plan data (conductor project format)
│   └── projects/63cead15-.../      # README.md, facts.md, sheet-NN/{guide,blocks}.md
│
├── runs/                           # all conductor run outputs
│   ├── original-review-4.3-2026-04-15/   # pre-experiment full pipeline run
│   ├── baseline-2026-04-15/               # baseline (no tool, review v5.1.0)
│   ├── experiment-run1/                   # experiment run 1 (pre-fixes)
│   ├── experiment-run2/                   # experiment run 2 (all fixes applied)
│   └── run1-test-fixture-1/              # replay of run 1's 14 fixture cases
│
├── replay/                         # test-script fixtures for tool-layer iteration
│   ├── README.md
│   └── fixtures/{experiment-run1,experiment-run2}-all-calls.json
│
└── viewer/                         # HTML debug viewer (Gemini bbox overlay)
    ├── serve.sh                    # launch: ./serve.sh (localhost:8401)
    ├── build-manifest.py           # scans runs/test-script-*/
    └── index.html                  # self-contained UI
```

## Key findings so far

1. **52 of 101 checklist items** need distance measurement, but only 3 got measured (5.8% coverage)
2. **Agent under-uses the tool** — when plans lack dimensioned clearances, 2 of 3 agents default to "not-verifiable" instead of measuring. Prompt fix landed in bureau#225.
3. **Scale parameter is fragile** — agents pass wrong values ("1" instead of "0.05", or "1 inch = 20 feet" as a string). Prompt now has explicit numeric examples.
4. **Option A (vector matching) is a v1 stub** that always fails. Every successful measurement uses Option B (Gemini Vision).
5. **Python compute-distance works** when it gets good inputs — the 0.5 ft result in `run-3-item-2-1` proves end-to-end viability (wrong scale, correct math).

## Related PRs

| PR | What |
|---|---|
| noetic-inc/bureau#218 | Experiment overlay + trimmed guide set |
| noetic-inc/bureau#219 | Rich per-call artifact logging |
| noetic-inc/bureau#221 | Python 3.9 compat fix |
| noetic-inc/bureau#224 | test-script workflow: pass projectId |
| noetic-inc/bureau#225 | Prompt: measure before not-verifiable |
| noetic-inc/conductor#116 | `--experiment=<name>` overlay mechanism |
| noetic-inc/conductor#117 | CHECKLIST_ITEM/RUN_INDEX env vars |
| noetic-inc/conductor#118 | MCP input validation schema fix |
| noetic-inc/conductor#119 | test-script workflow (parallel script steps) |
| noetic-inc/conductor#121 | Shell quoting + NODE_PATH for script steps |
