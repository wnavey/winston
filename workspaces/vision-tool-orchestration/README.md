# vision-tool-orchestration workspace

Workspace for designing a single entry point for vision-related tool calls
in the agentic site-plan reviewer. Behind the entry point, a classifier
routes the question to the right specialist tool.

**Status:** planning. No implementation yet.

**Driving signal:** measured agent invocation hit rates on the existing
specialist tools are well below acceptable. See
[`problem-statement.md`](./problem-statement.md).

## What's here

| Path | Purpose |
|---|---|
| [`problem-statement.md`](./problem-statement.md) | Why we're doing this — current hit rates for measure-distance and inspect-drawing tools, with citations to the rigorous metrics that grounded the numbers. |
| [`plan.md`](./plan.md) | Iteration 1 design + open questions + decisions log. Living doc. |

## Related

- [`../measure-distance-tool/`](../measure-distance-tool/) — the original specialist tool, rigorous-metrics/ used for problem-statement.
- [`../inspect-drawing-tool/`](../inspect-drawing-tool/) — newer specialist tool, experiments/run1 analysis used for problem-statement.
- [`../cc-vision-classification/`](../cc-vision-classification/) — should-call labels for cc checklist items (185 items, 8 inspect-drawing-required).
- `bureau/jurisdictions/austin/workflows/completeness-check/` and `…/review/` — workflows that would adopt the entry point.
- `conductor/src/tools/vision/` — generic vision tool that survives as the fallback specialist.
