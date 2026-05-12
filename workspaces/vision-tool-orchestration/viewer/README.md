# vision-tool-orchestration viewer

Visual inspector for var-2 (`vision_check` classifier-routing) runs. Shows
each `vision_check` invocation alongside its classifier reasoning,
dispatch outcome, and the full specialist chain
(`extract-measurement-pairs` → `measure-distance` per pair) with
cropped images, Gemini bbox overlays, and distance results.

Modeled after the var-1 viewer at `winston/workspaces/measure-distance-tool/viewer/`,
but built around the per-run vision-check-calls layout (conductor#155+)
that lives under

    source-runs/<set>/var-2/output/runs/run-N/vision-check-calls/<callId>/

rather than the var-1 test-script tree.

## Running

```bash
./serve.sh          # http://localhost:8402
./serve.sh 9002     # custom port
```

The script:
1. Runs `build-manifest.py` to walk every set's `var-2/output/runs/`
   tree and emit `manifest.json`.
2. Launches `python3 -m http.server` rooted at
   `vision-tool-orchestration/`, so the HTML can fetch
   `viewer/manifest.json` and per-call assets under `source-runs/…`.
3. Opens the browser (macOS only — elsewhere, follow the printed URL).

No build step, no JS dependencies beyond what's in `index.html`.

## What you see

Three panes left → right:

1. **Call list** (left). Every `vision_check` call across all 3 runs,
   grouped by `run-N`. Each entry shows the checklist item id, the
   classifier intent pill (`measurement` / `generic`), and the agent
   question. Filters at the top scope by intent + run; the text
   filter narrows by item id / question text.

2. **Call detail** (center). For the selected call:
   - Checklist item context (id, doc, sheet, full text).
   - The agent's vision question.
   - Classifier output: `problemType`, `reasoning`, `confidence`,
     `fallbackUsed`, prompt sha, model id.
   - Dispatch outcome: `specialistCalled`, `success`, `fallbackReason`.
   - `extract-measurement-pairs` summary (agent's pair list +
     extractor explanation; raw JSON expandable).
   - `measure-distance` per-pair list — each entry shows object A,
     object B, and the final distance (or "no result"). Click one to
     drill in.

3. **Sub-call detail** (right). For a selected `measure-distance`
   pair:
   - Final measurement (`distanceFeet`, `confidence`, scale).
   - The agent's reasoning for picking this pair.
   - Gemini localization canvas: the cropped JPEG sent to Gemini with
     green `bbox` overlays for object A and B, plus purple
     `nearestPoint` markers and the distance line connecting them.
     Toggle `call1` ↔ `call2` to compare Gemini's coarse + refined
     passes. Toggles for bboxes / nearestPoint / swap y-x.
   - Per-object cards (A and B): description, bbox, nearestPoint,
     confidence.
   - Collapsible sections: raw `localization.json`, Gemini response
     text, the prompt sent, shared legend text, debug.png.

## Manifest schema (sketch)

```jsonc
{
  "generatedAt": "...",
  "totalCalls": 86,
  "sources": [
    {
      "set": "el-md-exp",
      "variant": "var-2",
      "runLabel": "VISION_CHECK_REVIEW_EL_MD_EXP_RUN_10_LOCAL",
      "submission": { name, projectId, submissionVersionId },
      "model": "claude-haiku-4-5-20251001",
      "bureauCommit": "...",
      "conductorPr": "...",
      "runs": ["run-1", "run-2", "run-3"],
      "calls": [
        {
          "callId": "20260511T220202779Z-i7aw",
          "runIndex": "run-1",
          "inputs": { checklistItemId, checklistItemText, question, documentId, sheetNum },
          "classifier": { modelId, output: { problemType, reasoning, confidence, fallbackUsed } },
          "dispatch": { specialistCalled, success, fallbackReason },
          "itemIdShort": "EL-13.1",
          "specialistExtract": { callDir, pairs, explanation, subCalls },
          "specialistMeasureDistance": {
            "callDir": "...",
            "measurements": [...],
            "subCalls": [
              {
                "id": "...-p0",
                "objectA": "...", "objectB": "...",
                "scaleInchesPerFoot": "0.05",
                "reasoning": "...",
                "call1": { cropped, prompt, response, legendImage, localization },
                "call2": { ... },
                "finalResult": { distanceFeet, confidence, ... },
                "debugImage": "...",
                "legendText": "..."
              }
            ]
          }
        }
      ]
    }
  ]
}
```

Prompts + Gemini responses are referenced by relative path and fetched
on-demand when a sub-call detail is expanded — keeps `manifest.json`
small even for big runs.

## Adding more runs

`build-manifest.py` scans every `source-runs/<set>/var-2/` it finds.
When a new set lands under `source-runs/` (e.g. `cc/var-2/`), it'll be
picked up automatically next run. Pass `--source-set <name>` to scope
to one set.

## Limitations / TODO

- Read-only. No annotations / scoring overlays yet.
- One source-run per variant cell at a time (whatever is canonical
  under `source-runs/<set>/var-2/`). Tmp dirs under `source-runs/`
  aren't scanned — promote to canonical first.
- The `extract-measurement-pairs` sub-call has its own cropped image
  but the viewer doesn't render it yet (only the `measure-distance`
  pairs get the canvas treatment). Add later if useful.
- No per-call comparison against ctrl / var-1 verdicts yet.
