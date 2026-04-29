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

## Status

Phase 0: planning. No code shipped yet.

## Related

- [`../measure-distance-tool/`](../measure-distance-tool/) — sibling workspace, the architectural template
- `bureau/jurisdictions/austin/workflows/completeness-check/` — where the script and experiment overlay will land
- `conductor/src/tools/vision/` — the generic vision tool we are *not* replacing
