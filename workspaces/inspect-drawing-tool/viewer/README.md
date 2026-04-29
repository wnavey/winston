# inspect-drawing debug viewer

HTML viewer for inspecting `inspect-drawing` tool calls — the cropped image
sent to Gemini, the prompt, the raw response, and the parsed structured
result with bbox overlays.

## Quick start

```bash
./serve.sh           # http://localhost:8402
./serve.sh 9002      # custom port
```

`serve.sh` regenerates `manifest.json` from `runs/` before serving, so new
runs are picked up automatically.

## Layouts it understands

The manifest builder scans `../runs/` and recognizes:

- **Test-fixture layout** — `runs/<id>-test-fixture/{input/<fixture>.json, output/<case-id>/inspect-drawing-calls/<callId>/}`
- **Experiment layout (flat)** — `runs/<id>/inspect-drawing-calls/<callId>/` (or `runs/<id>/output/inspect-drawing-calls/...`)
- **Per-run-index layout** — `runs/<id>/output/runs/<n>/inspect-drawing-calls/<callId>/`

Each call dir is expected to contain (per the bureau-side script):

```
<callId>/
  metadata.json     # inputs, cropResolution, renderResult, result, timing
  prompt.txt        # full Gemini prompt
  cropped.jpg       # the image sent to Gemini
  response.txt      # raw Gemini response
  events.jsonl      # per-step structured log
```

If you change those filenames in the bureau side, update `build-manifest.py`
and `index.html` accordingly.

## What the viewer shows per case

- **Question** at the top
- **Result pills** — `classification`, `count`, `confidence`, or `unanswerable`
- **Inputs** — documentId, sheetNum, expectedAnswerType, cropMode, regionHint
- **Reasoning + evidence list** with bbox coordinates
- **Cropped image** with bbox overlays drawn on top (Gemini's 0–1000 coords mapped to the image)
- **Tabs**: Prompt / Raw response / Metadata JSON

## Limitations (Phase 1)

- Single-pass only — no two-pass call1/call2 view yet (Phase 2 will need it).
- No reference-image rendering yet (Phase 3).
- No diff-against-expected view yet — fixtures carry an `expectedAnswer`
  field but the UI doesn't compare to it. Easy follow-up once we have
  enough hand-labeled fixtures.
