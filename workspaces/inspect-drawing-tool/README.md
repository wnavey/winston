# inspect-drawing-tool workspace

Workspace for designing and iterating on the **`inspect-drawing`** tool — a
question-answering tool that looks at engineering drawings on site plan sheets,
reasons about shapes, lines, and spatial relationships, and returns a structured
answer with bbox + confidence.

This workspace is **planning-only for now**. Tool code (in `bureau`) and MCP
wrapper changes (in `conductor`) come later, once the design here is settled.

## Goal

Give the completeness-check agent a tool that's purpose-built for *visual
reasoning over the drawing area of a sheet* — distinct from the generic
`vision` tool, which sees the whole sheet and is prompted as a generic OCR /
description helper.

Modeled on **`measure-distance`** (in formal review): same shape — TS
orchestrator + Python helper, Gemini Vision via Vercel AI Gateway, two-pass
crop-then-refine, rich per-call artifact directory, replayable test fixtures,
HTML debug viewer.

## What's here

| Path | Purpose |
|---|---|
| [`design-plan.md`](./design-plan.md) | Living plan: motivating examples → tool surface → phasing → debug UI → open questions |
| [`motivating-examples.md`](./motivating-examples.md) | Concrete completeness-check items the tool needs to handle, with a question taxonomy |
| [`reference/architecture-pointers.md`](./reference/architecture-pointers.md) | Pointers into `bureau` / `conductor` / `measure-distance-tool/` — where to look when implementing |
| [`viewer/`](./viewer/) | HTML debug viewer for inspecting per-call artifacts. `cd viewer && ./serve.sh` |
| [`replay/`](./replay/) | Test-script fixtures for tool-layer iteration without burning agent tokens |
| [`runs/`](./runs/) | Local conductor run outputs (gitignored as data) |

## Status

**Phase 1** — single-pass MVP shipped to bureau (noetic-inc/bureau#282).
Viewer + replay scaffolding shipped here. No real runs yet — fixture
testCases need their `documentId` / `sheetNum` populated by hand from
prior 1700 S. Lamar runs before Phase 1 is replay-ready.

## Quick start

```bash
# 1. Populate replay/fixtures/1700-s-lamar-starter.json with real
#    documentId/sheetNum from a prior cc run.

# 2. Run the script-only replay (no agent loop) once bureau#282 is merged:
cd ~/code/controlroom/conductor
npm run conduct -- \
  --workflow=test-script \
  --scriptName=inspect-drawing \
  --testCasesPath="$(pwd)/../winston/workspaces/inspect-drawing-tool/replay/fixtures/1700-s-lamar-starter.json" \
  --maxParallel=3 --skip-upload

# 3. Inspect outputs in the viewer.
cd ~/workspace/winston/workspaces/inspect-drawing-tool/viewer && ./serve.sh
```

## Related

- [`../measure-distance-tool/`](../measure-distance-tool/) — sibling workspace, the architectural template
- `bureau/jurisdictions/austin/workflows/completeness-check/` — where the script and experiment overlay will land
- `conductor/src/tools/vision/` — the generic vision tool we are *not* replacing
