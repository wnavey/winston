# measure-distance viewer

Visual inspector for the `test-script` workflow's per-case outputs. Loads the
`cropped.jpg` that was sent to Gemini for each test case and overlays the
Gemini-returned object-A / object-B bounding boxes and `nearestPoint` markers
on top, so you can see at a glance where the vision model localized things.

Inspired by the `step-4-review-ui` viewer in the `navalbase` sibling repo —
same two-canvas pattern, adapted for JPEG (not PDF) and Gemini's 0–1000
normalized coordinate space.

## Running

```bash
./serve.sh          # localhost:8401 (default)
./serve.sh 9001     # custom port
```

The script:
1. Runs `build-manifest.py` to scan `../test-script-runs/*/output/` and emit
   `manifest.json` — the viewer consumes this.
2. Launches `python3 -m http.server` rooted at `measure-distance-tool/`, so
   the HTML can reach both `viewer/manifest.json` and the captured JPEGs
   under `../test-script-runs/…/cropped.jpg`.
3. Opens the browser (macOS only — elsewhere, follow the printed URL).

No dependencies beyond Python 3 stdlib. No build step.

## What you see

- **Left nav**: every test case across every `test-script-runs/test-N` run,
  labeled with status pill (`ok` / `compute err` / `gemini fail` / `no call-dir`),
  sheet number, scale value, and final distance (if completed).
- **Center**: the exact JPEG sent to Gemini, with green-shaded bboxes (A and B)
  and nearestPoint dots overlaid. Clicking a bbox selects it and scrolls the
  right panel to its detail card.
- **Right**: structured data panel showing the fixture inputs, Gemini
  localization output (per-object bbox / nearestPoint / description /
  confidence), final `measure-distance.json` result if the pipeline completed,
  the call metadata, and the original-experiment provenance.

## Toggles in the header

- **bboxes** — show/hide the green rectangles
- **nearestPoints** — show/hide the dot markers
- **swap pt axes (y,x→x,y)** — Gemini sometimes returns nearestPoints in `[y, x]`
  order rather than `[x, y]`. If a dot appears outside its bbox, toggling this
  tests the alternate interpretation. A latent bug in `measure-distance-impl.py`
  may sit at exactly this seam.

## Files

| File | Purpose |
|---|---|
| `index.html` | Self-contained UI (HTML + CSS + JS, no build) |
| `build-manifest.py` | Scans `test-script-runs/` and emits `manifest.json` |
| `manifest.json` | Generated — do not hand-edit |
| `serve.sh` | Launch wrapper (rebuilds manifest, starts server, opens browser) |

## Refreshing after a new test-script run

Just re-run `./serve.sh` (or `./build-manifest.py` alone if the server is
still up) — it rescans every `test-script-runs/test-N/` directory every time.
