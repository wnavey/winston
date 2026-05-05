# Vision-tool orchestration — design plan

Living plan. Sections: design (what we're building), open questions
(what needs decisions before MVP), decisions log (what's locked in).

---

## Goal — iteration 1

Build the smallest possible `vision_check` entry point that demonstrably
moves recall on the existing eval sets. Prove the routing concept on the
two tools we already have. **Nothing else.**

Success criteria for iteration 1:
- Routing accuracy ≥ 80% on a labeled eval (measure-distance items route
  to `measurement`, inspect-drawing items route to `drawing_inspect`,
  text-only items route to `generic`).
- Headline recall on should-call items rises measurably above the
  current 8–13% baseline. Target TBD — pending discussion of how
  much lift to expect from routing alone before the specialists' own
  input-quality issues surface as the dominant failure.
- Misuse rate stays at ~0% (no calls on items that shouldn't trigger
  vision specialists at all).

## Architecture (proposed — see open questions)

```
top-level review agent
  │
  └── vision_check(checklist_item, sheet_context)
        │
        ├── classifier(checklist_item) → { problem_type, reasoning, confidence }
        │
        └── dispatch:
              measurement     → measure-distance
              drawing_inspect → inspect-drawing
              generic         → vision (fallback)
```

**Entry point:** `vision_check(checklist_item, sheet_context)` is the
single vision tool exposed to the top-level agent. Other vision-capable
tools remain in the codebase but are no longer in the top-level agent's
tool list.

**Classifier:** text-only LLM call. Input is the checklist item text plus
~3–5 labeled examples per type in the prompt. Output is one of the fixed
problem types plus reasoning. Replaceable.

**Dispatch:** flat function. No plugin layer.

**Return:** `{ answer, evidence, confidence, problem_type, specialist_called, classifier_reasoning }`. Specialists already return their answers; we surface
the routing decision so the eval harness can score routing and execution
separately.

## Initial taxonomy (3 types)

| Type | Specialist | Examples |
|---|---|---|
| `measurement` | `measure-distance` | "Trees within 10 lateral feet of OHE", "Transformer pad clearance from buildings" |
| `drawing_inspect` | `inspect-drawing` | "Wastewater flow direction not indicated", "Pipes ≥24" shown as double lines" |
| `generic` | `vision` (fallback) | Note presence, label readout, table reads, anything not yet specialized |

**Compound items** (5+ atomic checks bundled — e.g., AW-21 with size +
material + double-line + easement-relationship) route to `generic` for
this iteration. Log when classifier detects compound structure.
Decomposition is iteration 2+ scope.

## Out of scope for iter 1 (per the source brief, not yet relitigated)

- New specialists (count, exemplar, classify_object).
- Compound-item decomposition.
- Batching multiple items into a single specialist call.
- Outer-grounding vision call inside `vision_check` (text-only classification).
- Changes to specialist internals.
- Dissolving the generic `vision_tool` — it survives as `generic` fallback.

## Eval strategy (proposed — see open questions)

Two metrics, both at the per-(item × run) level we standardized on for
measure-distance/inspect-drawing analyses:

1. **Routing accuracy.** Of items where the labeled `expected_route` is
   `measurement`, what fraction does the classifier route to `measurement`?
   Same per type. Reported as a confusion matrix.
2. **Conditional execution accuracy.** Of items the classifier routed to
   `measurement`, what fraction of `measure-distance` calls produced a
   correct answer? (Same per specialist.) Lets us separate routing
   failures from specialist failures.

Combined with the existing rigorous **recall** and **misuse** metrics
from the per-tool analyses, we get end-to-end visibility:
`overall recall = routing_accuracy × execution_accuracy`.

---

## Open questions — to decide before MVP

These are the questions whose answers shape the MVP. Grouped by topic.

### A. Eval harness — what do we test against?

A1. **Which workflow's eval set drives iteration 1?**
- Option A: `el-md-exp` only (51 horizontal items, all measure-distance) —
  rich measure-distance signal but zero `drawing_inspect` items.
- Option B: `cc v2.5-trimmed` only (185 items, 8 inspect-drawing-required +
  46 optional) — has inspect-drawing AND many `generic` candidates, but no
  measure-distance.
- Option C: Both — run two parallel eval suites, one per workflow. Joint
  routing-accuracy and per-specialist execution-accuracy.
- Option D: Build a synthetic harness that pulls items from both. Possibly
  most rigorous; most setup cost.

A2. **Do we need a labeled eval set with `generic` items at scale?**
The existing `cc-vision-classification` has 100 vision-only + 31 no-tool
items that should all route to `generic` (or, for no-tool, ideally not
trigger `vision_check` at all). That's a big `generic` reference set
already. Do we trust it?

### B. Classifier — what model, where, with what prompt?

B1. **What model for the classifier?** Haiku 4.5 (cheap, fast, latency
budget concerns) vs Sonnet 4.5 (likely more accurate; consistent with
the top-level agent model so easier to debug). Cost matters at 555 items
per cc run.

B2. **Where does the classifier prompt live?** Bureau alongside the
review prompt? Or in conductor as a config-driven thing? The first lets
domain experts iterate; the second keeps it close to the dispatch code.

B3. **Few-shot examples — what's the seed set?** ~3–5 per type. We
already have 8 inspect-drawing-required + 51 measure-distance-horizontal
items in the reference classifications. Do we hand-pick the 3–5 most
canonical, or rotate?

### C. Implementation surface — where does `vision_check` live?

C1. **Conductor MCP tool vs bureau script-tool?** Both inspect-drawing
and measure-distance live as bureau script-tools today (`createScriptTool`
wrapper). The vision tool lives in conductor MCP. `vision_check` could
go either way:
- Conductor MCP: more privileged, can reach tool registry directly,
  centralized.
- Bureau script: per-workflow, easier to override per-jurisdiction,
  consistent with how we ship specialist tools today.

C2. **How does `vision_check` reach the specialists?** Direct function
calls (if conductor MCP), or by re-invoking the specialists' tool entry
points (if bureau script-tool). Different overhead and different debug
surfaces.

C3. **`sheet_context` — what does it actually contain?** "Sheet PDF
reference and pre-processed transcription blocks." The transcription
blocks already live in `content_block` (via `semantic-search-blocks`).
Does `vision_check` need to fetch them, or does the caller pass them?

### D. Top-level agent prompt change

D1. **Same iteration as adding `vision_check`, or staged?** "Top-level
agent's vision tool list collapses to just `vision_check`" is a prompt
change to the cc / review prompts. We could:
- Stage 1: add `vision_check` alongside the existing vision tools, agent
  can pick. Measure adoption.
- Stage 2: remove the others.
The brief says "collapses" (combined). But running them side-by-side for
one iteration would let us A/B without ripping out the existing path.

D2. **Which workflows adopt it first?** cc only? cc + review? Both?

### E. Routing edge cases

E1. **What if `inspect-drawing` and `measure-distance` could BOTH
plausibly answer?** Some cc items in `cc-vision-classification` would
route to `drawing_inspect` for "are flow arrows shown?" but to
`measurement` for "is the pipe within 10 ft of the easement?". Same
checklist item could need both calls. Compound — but real.

E2. **Confidence threshold for routing?** Below which confidence does
the classifier fall through to `generic` instead of dispatching to the
named specialist?

E3. **What if the item has no visual component at all?** Per
`cc-vision-classification`, ~17% of cc items are `no-tool` (document
existence, file format, etc.). Should `vision_check` have a `none`
output that returns "this item shouldn't trigger vision"? Or do we
trust the top-level agent to not call it on those items?

### F. Iteration 2 trigger

F1. **What's the explicit signal that iter 1 isn't enough and we need
the outer-grounding vision pass?** I'd want a measurable: e.g.,
"classifier accuracy is ≥85% but specialist execution accuracy on
`measurement` is still <40% → grounding is the next bottleneck."

F2. **What's the explicit signal we need new specialists (count,
exemplar)?** "Classifier confidently routes to `generic` on a
recurring sub-pattern that the generic vision tool can't answer
reliably."

---

## Decisions log

(empty — to be filled as we converge)
