# runs/

Conductor run outputs land here. Layouts the viewer recognizes:

- **Test-fixture runs** (replays via `test-script` workflow):
  ```
  runs/<id>-test-fixture/
    input/<fixture>.json
    output/<case-id>/inspect-drawing-calls/<callId>/{metadata.json, prompt.txt, cropped.jpg, response.txt, events.jsonl}
  ```
- **Experiment runs** (real cc runs with `--experiment=inspect-drawing`):
  ```
  runs/<id>/
    inspect-drawing-calls/<callId>/...
  ```
  or:
  ```
  runs/<id>/output/runs/<n>/inspect-drawing-calls/<callId>/...
  ```

`viewer/build-manifest.py` walks this directory tree and produces
`viewer/manifest.json` for the debug UI.

This directory is intentionally empty in git — runs are local outputs.
