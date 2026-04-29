# Architecture Pointers

Quick links into the codebase for whoever picks up Phase 1. All paths
relative to `~/workspace/`.

## What `inspect-drawing` will look like, by analogy

| Concern | `measure-distance` (review) | `inspect-drawing` (completeness-check) |
|---|---|---|
| TS orchestrator | `bureau/jurisdictions/austin/workflows/review/scripts/measure-distance.ts` | `bureau/jurisdictions/austin/workflows/completeness-check/scripts/inspect-drawing.ts` |
| Python helper | `…/review/scripts/measure-distance-impl.py` | `…/completeness-check/scripts/inspect-drawing-impl.py` |
| Tool schema | `…/review/schemas/measure-distance.tool-schema.json` | `…/completeness-check/schemas/inspect-drawing.tool-schema.json` |
| Experiment overlay | `…/review/experiments/measure-distance/{experiment.yaml,review.md}` | `…/completeness-check/experiments/inspect-drawing/{experiment.yaml,review.md}` |
| MCP wrapper | `conductor/src/tools/script.ts` (`createScriptTool` → `run_<name>`) | same — no conductor changes needed if we stick to the typed-schema path |
| Per-call artifacts | `workspace/output/measure-distance-calls/<callId>/` | `workspace/output/inspect-drawing-calls/<callId>/` |
| Workspace iteration | `winston/workspaces/measure-distance-tool/` | `winston/workspaces/inspect-drawing-tool/` |

## Specific functions / patterns to copy

- `findDrawingBlockBbox()` in `measure-distance.ts:271` — looks up the
  largest `category='drawing'` `content_block` for a sheet. Reusable
  almost verbatim.
- `localizeWithGemini(...)` in `measure-distance.ts` (search for the
  function name) — multi-image content array via Vercel AI SDK with the
  Vercel AI Gateway provider. Same pattern; the prompt and the response
  schema differ.
- `buildGatewayProviderOptions()` — inline-copied into the script (don't
  import from conductor; bureau scripts run in their own sandbox).
- Two-call pipeline: `localizeWithGemini` (call 1) → compute refined crop
  → `localizeWithGemini` (call 2) → fall back to call 1 on failure.
- Per-call directory layout (`metadata.json`, `prompt.txt`,
  `cropped.jpg`, `events.jsonl`, plus `call1-*` / `call2-*` per pass) —
  see `measure-distance-tool/reference/architecture-overview.md` "TS
  orchestrator flow" section for the full file list.

## Wiring details that are easy to miss

- **`createScriptTool` typed schema path**: the schema JSON file lives in
  `<workflow>/schemas/<scriptName>.tool-schema.json` and is auto-discovered
  by `tool-schema-loader.ts`. Once the file exists at that path with the
  right name, the agent sees typed parameters with descriptions. Don't
  add a generic args-bag fallback.
- **`projectId` inference**: the agent often omits `projectId`. Both
  `measure-distance.ts` and `semantic-search-blocks.ts` infer it from
  `WORKSPACE_PATH/projects/<single-subdir>` — copy that pattern verbatim.
- **Experiment overlay loader**: handled by conductor#116. The bureau side
  is just two files (`experiment.yaml`, `review.md`). No conductor changes
  required to add a new overlay.
- **Env vars set by conductor for tool subprocesses** (conductor#117):
  `WORKFLOW_RUN_ID`, `RUN_LABEL`, `CHECKLIST_ITEM`, `CHECKLIST_INDEX`,
  `RUN_INDEX`. Use these in `metadata.json` and the gateway tags for
  cost/perf attribution.
- **Replay via `test-script` workflow**: see
  `measure-distance-tool/replay/README.md` for the exact `npm run conduct`
  invocation. Works for any script that accepts the same CLI args from a
  fixture JSON — `inspect-drawing` will plug in by following the same
  fixture shape.

## Things measure-distance got wrong that we can skip

From `measure-distance-tool/README.md` "Key findings":

- **Fragile scale parsing** — agents passed `"1 inch = 20 feet"` strings
  against a number schema. Use a typed `tool-schema.json` from day one
  (we already plan to).
- **Option A vector matching is a stub** — measure-distance's tier 1 always
  fails. inspect-drawing has no equivalent — Gemini Vision is the only
  layer.
- **Coarse pass at 120 DPI was too low** for fine line work. Default to
  150 DPI for the single-pass MVP; bump to 300 for the refined pass in
  Phase 2.
