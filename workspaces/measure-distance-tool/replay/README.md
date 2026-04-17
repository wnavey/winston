# Measure-Distance Replay Fixtures

Captured inputs from the 2026-04-15 `el-md-exp` experiment run, used to exercise
the `measure-distance.ts` script layer without paying the agent-loop cost.

## What's here

- [`fixtures/experiment-run1-all-calls.json`](./fixtures/experiment-run1-all-calls.json)
  — **all 14** `run_measure_distance` tool invocations the agent made during the
  experiment run, captured verbatim from `runs/experiment-run1/logs/review.log`
  `tool_use` events. Includes both:
  - **8 calls that reached the Python script** (all of which produced
    Gemini-localized bboxes but then failed at compute-distance due to the
    Python 3.9 annotation bug — now fixed in noetic-inc/bureau#221).
  - **6 calls that were rejected at MCP input validation** (`sheetNum` /
    `scaleInchesPerFoot` as numbers against a string schema — now fixed in
    noetic-inc/conductor#118). Replaying these is a useful regression check
    that the schema really accepts numeric values.

## Fixture format

```jsonc
{
  "description": "...",
  "source": { /* provenance: project, submission, capture date */ },
  "testCases": [
    {
      "id": "run-1-item-2-1",           // deterministic label; used in output paths
      "projectId": "63cead15-…",         // what the workspace is scoped to
      "documentId": "1144b126-…",        // inputs the agent sent the tool
      "sheetNum": "31",
      "objectA": "trees in the southern landscape buffer area near the OHE line",
      "objectB": "the OHE utility line along the southern property boundary",
      "scaleInchesPerFoot": "0.05",
      "_provenance": {                   // not consumed by the script; for correlation
        "sourceTool_use_id": "toolu_...",
        "sourceRunIndex": "run-1",
        "sourceChecklistItem": "2.md",
        "capturedOutcome": {
          "reachedScript": true,
          "callDir": "20260415T170447468Z-az9z-run-1-2",
          "optionB_success": true,
          "optionB_geminiConfidence": 0.95
        }
      }
    }
    // …13 more
  ]
}
```

Fields consumed by `measure-distance.ts` when invoked as a script step from
the `test-script` workflow: `projectId`, `documentId`, `sheetNum`, `objectA`,
`objectB`, `scaleInchesPerFoot`.

Note: during a real `review` run, `measure-distance.ts` infers `projectId`
from `workspace/projects/` (populated by the `submissionVersion` resource).
The `test-script` workflow (`bureau/jurisdictions/austin/workflows/test-script/`)
deliberately skips that resource — the fixture predetermines all lookups — so
each test case must provide `projectId` explicitly. The fixture here already
includes it for all 14 cases.

## Running the replay

See the **Fixture replay** section of [`../experiment-plan.md`](../experiment-plan.md)
for the full `npm run conduct` invocation. One-liner:

```bash
cd ~/code/controlroom/conductor
npm run conduct -- \
  --workflow=test-script \
  --scriptName=measure-distance \
  --testCasesPath=/Users/winston/workspace/winston/workspaces/measure-distance-tool/replay/fixtures/experiment-run1-all-calls.json \
  --maxParallel=3 \
  --skip-upload
```

## Regenerating the fixture

If a future experiment run produces a new set of captured calls, the fixture
can be regenerated from `runs/experiment-run1/logs/review.log` and
`runs/experiment-run1/measure-distance-calls/`. The extraction script lived inline
in the PR that introduced this directory (noetic-inc/winston#N) — re-use or
reproduce it from `checklist-item-gemini-call-mapping.md`'s methodology
section.

## Expected outcomes (baseline against current main)

The fixture is versioned intentionally — running the replay against current
`measure-distance.ts` should either reproduce the captured outcomes or (more
usefully) show that behavior has improved or changed.

Against `measure-distance.ts` as of the 2026-04-15 capture:
- 6/14 — MCP validation reject (no call-dir created)
- 8/14 — reached Python, Gemini localization succeeded, compute-distance crashed

After noetic-inc/conductor#118 + noetic-inc/bureau#221 land and the venv is on
Python ≥3.10, we expect:
- **0/14** MCP rejects
- **14/14** reach the Python script
- Some subset succeed end-to-end and return a measured distance

Use this delta as the first signal of whether the tool layer is now healthy.
