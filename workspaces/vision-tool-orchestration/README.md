# vision-tool-orchestration workspace

Workspace for designing a single vision-tool entry point (`vision_check`)
that classifies the question and dispatches to the right specialist —
replacing the current setup where the top-level review agent picks
among `vision`, `inspect-drawing`, and `measure-distance` directly and
gets it wrong most of the time.

**Current status:** Phase D — eval runs queued (kickoff pending; see `plan.md`).
**Phases A, B, C are complete and merged.**

| Phase | Repo | PR | Status |
|---|---|---|---|
| 0 — design + spec | winston | #37 | ✅ merged |
| A — conductor MCP tool skeleton | conductor | #143 | ✅ merged |
| B — classifier wired in + dispatch | conductor | #144 | ✅ merged |
| C — bureau experiment overlays | bureau | #297 | ✅ merged |
| D — eval runs + writeup | winston | TBD | 🟡 in progress (kickoff queued) |

---

## If you're a fresh session picking this up cold

Read these in order:

1. **[`problem-statement.md`](./problem-statement.md)** — current
   measure-distance and inspect-drawing recall numbers (~11% and ~8%
   respectively, well below acceptable). Why this matters.
2. **[`architecture.md`](./architecture.md)** — how conductor's tool
   registry works, how bureau prompts/schemas/scripts wire in, and
   where `vision_check` sits in the system. Has a high-level diagram
   and a per-call sequence diagram. Read before touching tool code.
3. **[`plan.md`](./plan.md)** — full design.
   - "Goal" + "Architecture" sections at top describe what
     `vision_check` is.
   - "Decisions log" captures every commitment from the design
     conversation (eval shape, classifier model, code location, prompt
     overlay pattern, success criteria, iter-2 trigger split).
   - "Iteration 1 — concrete spec" has the file layout, classifier
     prompt template, replacement review.md section, per-call artifact
     layout, and eval harness.
   - "Phased execution plan" breaks the build into 4 ship-able phases
     (Phase A → D), each a separate PR. **Phase 0 = this design PR.**
   - "Earmarked follow-ups" lists everything explicitly deferred.
3. **Existing related work in this repo** — context for the rigorous
   metrics that ground the problem statement:
   - [`../measure-distance-tool/analysis/rigorous-metrics/`](../measure-distance-tool/analysis/rigorous-metrics/)
     — per-(item × run) recall for measure-distance experiment runs.
   - [`../inspect-drawing-tool/experiments/run1/analytics/analysis.md`](../inspect-drawing-tool/experiments/run1/analytics/analysis.md)
     — same shape for inspect-drawing.
   - [`../cc-vision-classification/`](../cc-vision-classification/) +
     [`../measure-distance-tool/analysis/guides/el-md-exp/item-classification.json`](../measure-distance-tool/analysis/guides/el-md-exp/item-classification.json)
     — the should-call labels used to compute recall.

That's everything you need to know what to build and why.

## What's NOT in this workspace yet

- **No code.** Phase 0 is design-only. Code lives in `conductor/` and
  `bureau/` and ships in Phase A onward.
- **No experiment data.** Phase D will pull `vision-check` run
  artifacts into `experiments/run1/` (mirroring how
  `inspect-drawing-tool/experiments/run1/` is structured).

## Layout

| Path | Purpose |
|---|---|
| [`README.md`](./README.md) | This file — orientation + cold-start guide |
| [`problem-statement.md`](./problem-statement.md) | Current hit rates with citations to rigorous metrics |
| [`architecture.md`](./architecture.md) | Tool scaffolding/dispatching architecture; how conductor + bureau cooperate; where `vision_check` sits. Diagrams + glossary. |
| [`plan.md`](./plan.md) | Full design — decisions log, iter 1 spec, phased execution plan, follow-ups |
| [`metrics-framework.md`](./metrics-framework.md) | **2026-05-07 reorientation.** Iter 1 metrics: 3 variants (V1 baseline / V2 bifurcated / V3 specialist routing) × 4 TSVs × 2 experiment sets. Read this before doing any iter-1 analysis. |

## How to continue from here

Once Phase 0 (this PR) is merged, the next phase is Phase A in
[`plan.md`](./plan.md#phase-a--conductor-mcp-tool-skeleton). It's a
conductor change, not a winston change — the winston workspace just
holds the design + (eventually) the eval data.

If you're picking this up to do Phase A, the spec section in `plan.md`
("Iteration 1 — concrete spec") has the exact file layout, args,
return shape, and acceptance criteria. Phases B/C/D similarly each
have an acceptance section so you know when you're done.

If new questions surface during build that the existing decisions
log doesn't answer, add them to `plan.md` under "Open questions" and
get an answer before assuming. Don't invent a decision and ship it.

## Related

- [`../measure-distance-tool/`](../measure-distance-tool/) — the
  specialist tool the orchestrator will dispatch to for `measurement`
  routing.
- [`../inspect-drawing-tool/`](../inspect-drawing-tool/) — specialist
  for `drawing_inspect` routing.
- [`../inspect-drawing-tool/ai-loop-exploration.md`](../inspect-drawing-tool/ai-loop-exploration.md)
  — sibling exploration into adding an agentic Gemini loop *inside*
  inspect-drawing. Complementary, not overlapping with this workspace
  (this is about routing TO specialists; that's about looping WITHIN
  one specialist).
- [`../cc-vision-classification/`](../cc-vision-classification/) +
  [`../measure-distance-tool/analysis/guides/el-md-exp/`](../measure-distance-tool/analysis/guides/el-md-exp/)
  — labeled item classifications used as ground truth for the eval.
- `bureau/jurisdictions/austin/workflows/{completeness-check,review}/`
  — the two workflows that will adopt the orchestrator (each via its
  own `experiments/vision-check/` overlay).
- `conductor/src/tools/vision/` — the generic vision tool that
  survives as the `generic` fallback specialist.
