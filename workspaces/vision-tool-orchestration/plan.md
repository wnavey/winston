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

Captured 2026-05-05 from initial design conversation.

### Eval harness
- **A1.** Iteration 1 runs **two parallel eval suites** — one against
  cc `v2.5-trimmed`, one against `el-md-exp`. Routing accuracy reports
  as a per-workflow × per-route confusion matrix; conditional execution
  accuracy reports per-specialist regardless of source workflow.
- **Follow-up (high-value, deferred):** synthetic harness pulling
  curated items from multiple review-guides, including those we haven't
  yet classified. This serves two purposes: (1) more representative
  routing eval, (2) source of signal for identifying additional vision
  problem-types beyond the initial 3. Deferred because it's
  token-expensive to scan all review-guides; do this once iter 1 runs
  validate the routing concept.

### Classifier
- **B1.** Model: **Haiku 4.5**. Cheap and fast for a 1-call text
  classification. If it underfits we escalate.
- **B2.** Prompt + taxonomy + examples live in **bureau per workflow**
  at `jurisdictions/austin/workflows/<workflow>/prompts/vision-router.md`
  (or similar). Allows cc and review to evolve independently.
- **B3.** **3–5 hand-picked canonical examples per type, frozen** for
  iter 1. Sourced from existing classifications (cc-vision-classification
  + el-md-exp/item-classification.json).
- **Few-shot purpose:** examples are pasted into the classifier prompt
  itself so the LLM has concrete labeled patterns to match against,
  not just abstract category definitions.

### Implementation surface
- **C1.** **Hybrid:** `vision_check` dispatch + classifier-call code
  lives in **conductor** as an MCP tool (one TypeScript file, generic
  across workflows). The classifier **prompt, taxonomy, and few-shot
  examples** live in **bureau per workflow**, read by conductor at
  runtime (same pattern `createScriptTool` uses for schemas).
- Why: dispatch logic doesn't need per-workflow customization, but
  taxonomy does. This keeps code DRY while letting domain experts
  iterate on the prompt without touching conductor.
- **Acknowledged tradeoff:** code is split across two repos (conductor
  for dispatch, bureau for prompt). Not ideal. Earmarked to revisit if
  it becomes painful — e.g., consolidating into a single bureau script-
  tool if the conductor side stays trivial after iter 1.
- **C2.** Specialists are reached via the same script-tool path the
  agent uses today; ~1s subprocess overhead per call is acceptable.
- **C3.** `vision_check` args: `(checklist_item, project_id, document_id,
  sheet_num)`. Specialists fetch transcription blocks themselves if
  they need them. Same shape as today's specialist tools.

### Top-level agent prompt change
- **D.** Use the existing **experiment-overlay pattern** (mirroring
  `--experiment=inspect-drawing` and `--experiment=measure-distance`):
  - **Control prompt** = current production prompt, unchanged.
  - **Experimental prompt** = a new bureau experiment overlay
    (`workflows/<workflow>/experiments/vision-check/`) that swaps in
    its own `review.md` and its own tool list:
    - Tool list: `vision_check` (+ `script:semantic-search-blocks` for
      text search) only.
    - `vision`, `script:inspect-drawing`, `script:measure-distance`
      are **not** in the experimental tool list — they remain in the
      codebase, callable only by `vision_check`'s internal dispatch.
  - The experimental `review.md` deletes the "Using the Vision Tool",
    "Using the Inspect-Drawing Tool", and "Using the Measure-Distance
    Tool" sections, replacing them with a single "Using the Vision
    Check Tool" section. Semantic-search-blocks section is preserved.
- Why: matches the existing experiment-overlay convention; lets us run
  control vs experiment side-by-side on the same submission; keeps the
  baseline production path untouched while we validate.

### Routing edge cases
- **E1.** Classifier picks **one** problem type — the dominant question
  type for the item. Multi-specialist orchestration (where one item
  needs both `measure-distance` AND `inspect-drawing`) is **earmarked
  for a future iteration** as part of the broader vision-agent loop
  exploration ([`../inspect-drawing-tool/ai-loop-exploration.md`](../inspect-drawing-tool/ai-loop-exploration.md)).
- **E2.** **No confidence threshold for routing.** Always dispatch to
  the named specialist. Instrument confidence so we can see whether
  low-confidence cases are systematically wrong. Add fall-through
  later if data warrants.
- **E3.** **No `none` route.** If the agent called `vision_check`, we
  respect that and dispatch to *some* specialist — generic vision is
  the catchall. The router has 3 outputs (measurement, drawing_inspect,
  generic), no fourth "skip" route.

### Cross-workflow consistency
- **Same taxonomy** (`measurement` / `drawing_inspect` / `generic`) across
  cc and review for iter 1.
- **Different few-shot examples** per workflow — cc's seeded set leans
  `drawing_inspect` + `generic` (matches what cc items look like);
  review's seeded set leans `measurement` (matches el-md-exp). Each
  workflow gets its own `vision-router.md` in bureau, sharing the
  same template + taxonomy section but its own examples block.

### Versioning + reproducibility
- Every `vision-check` call records the **classifier model id** and the
  **bureau commit hash for `vision-router.md`** in
  `output/vision-check-calls/<callId>/metadata.json`. So when we change
  the classifier prompt or upgrade the model, runs from different
  points in time stay comparable: any cross-run analysis can filter on
  classifier version.
- Field names: `metadata.classifier.modelId`, `metadata.classifier.promptCommitSha`.
- Conductor already passes `bureauCommitHash` through the workflow run
  context (see `metadata.bureauCommitHash` in the reviews table); reuse
  that pipeline.

### Iteration success criteria
- **F1.** **Headline goal: ≥80% recall on should-call items** across
  both eval suites (cc and el-md-exp). Higher is better.
- **F1.** **Iter 2 trigger split:**
  - If text-only classifier accuracy ≥85% AND specialist execution
    accuracy is the bottleneck → iter 2 focuses on **specialist
    input quality**, not the classifier.
  - If text-only classifier accuracy <70% AND failures cluster on
    items where text alone is genuinely ambiguous → iter 2 adds an
    **outer-grounding low-DPI vision pass** to the classifier.
  - The dominant failure mode at end of iter 1 picks the path.
- **F2.** **Organic signal collection (in scope for iter 1):**
  log items where the classifier routed to `generic` AND any of:
  - generic vision returned unanswerable / low confidence
  - the agent's final finding was `not-verifiable`
  - the agent's reasoning cited "vision tool limitations" or similar.
  Cluster these logs across runs to identify candidate new specialists.

---

## Iteration 1 — concrete spec

Locked-in once the open questions above are resolved. This is the
minimum-viable build.

### File layout

| Where | What | Notes |
|---|---|---|
| `conductor/src/tools/vision-check/index.ts` | Conductor MCP tool: classifier call + dispatch + per-call artifact emission | Reads bureau prompt at tool-init, given `workflowPath`. |
| `conductor/src/tools/vision-check/dispatch.ts` | Maps `problem_type` → specialist call (vision, inspect-drawing, measure-distance) | Reuses existing tool entry points; no new wire formats. |
| `bureau/jurisdictions/austin/workflows/completeness-check/experiments/vision-check/experiment.yaml` | Overlay manifest | New experiment for cc. |
| `bureau/jurisdictions/austin/workflows/completeness-check/experiments/vision-check/review.md` | Experimental review prompt | Deletes 3 vision-tool sections, adds 1 "Using vision_check" section. |
| `bureau/jurisdictions/austin/workflows/completeness-check/prompts/vision-router.md` | Classifier prompt + taxonomy + few-shot examples | Loaded by `vision-check/index.ts` at init. |
| `bureau/jurisdictions/austin/workflows/review/experiments/vision-check/{experiment.yaml,review.md}` | Same shape, for the `review` workflow. | |
| `bureau/jurisdictions/austin/workflows/review/prompts/vision-router.md` | Classifier prompt for the review workflow (different examples — measure-distance heavy). | |

### Classifier prompt — initial seed

```
Classify this site-plan-review checklist item into ONE of:
  - measurement: requires plan-view distance/clearance measurement
  - drawing_inspect: requires reasoning about lines, symbols, spatial
    relationships, or shapes in a drawing area
  - generic: any other visual question (label readout, table read,
    note presence, title-block check)

Examples (cc + el-md-exp):
"Trees within 10 lateral feet of OHE conductor"          → measurement
"Transformer pads lack 5-foot clearance from buildings"  → measurement
"Drainage easements contain 100-year floodplain"         → measurement
"Wastewater flow direction not indicated on plan views"  → drawing_inspect
"Pipes ≥24 inches not shown as double lines"             → drawing_inspect
"Adjacent driveways within 300 feet shown"               → drawing_inspect
"Standard AE notes missing or incomplete"                → generic
"AW Infrastructure Information table incomplete"         → generic
"Subdivision file number missing from cover sheet"       → generic

Return JSON:
{
  "problem_type": "measurement" | "drawing_inspect" | "generic",
  "reasoning": "<one sentence>",
  "confidence": 0.0-1.0
}

Item to classify: {checklistItemText}
```

### Experimental review.md — replacement section

Replaces the three "Using the X Tool" sections (vision, inspect-drawing,
measure-distance — whichever apply per workflow) with this single
section:

```markdown
## Using the Vision Check Tool

For ANY question requiring visual inspection of a site plan sheet —
measurements, drawing inspection, label reading, presence checks —
call `vision_check`. This is the single entry point for all visual
questions.

Internally `vision_check` classifies the question and dispatches to
the appropriate specialist (measurement, drawing inspection, or
generic vision). You do not need to choose a specialist yourself —
the tool handles it.

**Required parameters:** `checklistItemText`, `documentId`, `sheetNum`.
The projectId is inferred from the workspace.

**Optional parameter:** `regionHint` — short natural-language pointer
("along the east property frontage"). Treated as a hypothesis, not a
constraint.

**Returns:** `{ answer, evidence, confidence, problemType,
specialistCalled, classifierReasoning }`. Branch on `confidence` first;
treat low-confidence answers as unclear rather than guessing.

Per-call artifacts are saved under `output/vision-check-calls/<callId>/`
for offline audit.
```

The `semantic-search-blocks` section is preserved unchanged.

### Per-call artifact layout

```
output/vision-check-calls/<callId>/
  metadata.json     # inputs, classifier output, specialist result, timing
  classifier.txt    # full classifier prompt + raw response
  events.jsonl      # per-step structured log
  → and the dispatched specialist's own per-call artifacts continue
    to land under output/<specialist>-calls/<...>/ as today, with the
    callId cross-referenced in metadata.json
```

### Eval harness

Two parallel suites.

**cc:** run completeness-check with `--experiment=vision-check` against
1700 S. Lamar v2, runs=3. Compare against the run1 baseline (the
inspect-drawing experiment we already have data for). Score:

- **Routing accuracy** (per checklist item, by `cc-vision-classification`
  ground truth): of items the labeled grade is `inspect-drawing-required`,
  what fraction did the classifier route to `drawing_inspect`? Same per
  type. Confusion matrix.
- **Conditional execution accuracy** (per specialist call): of items
  routed to `drawing_inspect`, what fraction of inspect-drawing calls
  produced a non-`unanswerable` answer matching the human-graded
  expected outcome? Same per specialist.
- **Headline recall** (vs the rigorous frame): % of `should_call=yes`
  items that received any vision_check call (≥1 specialist invocation).

**el-md-exp:** run review workflow with `--experiment=vision-check`
against Valley View Townhomes, runs=3. Compare against
experiment-run7's rigorous metrics as the baseline. Same three score
families.

### Organic signal collection

In `vision-check/index.ts`, when classifier routes to `generic` AND any of
the following is observed, append to `output/vision-check-calls/_signal.jsonl`:

- generic vision response includes "unable to determine" / low confidence
- final review finding for the item is `not-verifiable`
- agent's reasoning string contains "vision tool limitations" or similar

Cluster across runs after iter 1 to surface candidate new specialists.

---

## Phased execution plan

Iter 1 build broken into 4 ship-able phases. Each phase is a separate
PR; each leaves the system in a working state.

### Phase 0 — design docs (this PR)

- This workspace (`README.md`, `problem-statement.md`, `plan.md`)
- No code changes. Output is reviewable design that a fresh
  Claude session can read and continue from.

**Status:** in progress.

### Phase A — conductor MCP tool skeleton

Files:
- `conductor/src/tools/vision-check/index.ts` — registers an MCP tool.
- `conductor/src/tools/vision-check/dispatch.ts` — routes by problem_type;
  initially every route forwards to the existing `vision` tool (no
  classifier yet).
- Conductor `tools/index.ts` — register the new tool name.

Behavior:
- Agent can call `vision_check(checklistItemText, documentId, sheetNum)`.
- Tool currently always dispatches to generic vision regardless of input.
- Per-call artifact directory created under
  `output/vision-check-calls/<callId>/` with stub `metadata.json`.

Acceptance:
- New tool callable from a test workflow.
- Per-call artifact directory written.
- No new specialist behavior (still always generic vision).

### Phase B — classifier wired in

Files:
- Classifier-call helper in `vision-check/index.ts` — text-only
  Anthropic call, Haiku 4.5, returns `{ problem_type, reasoning, confidence }`.
- Update `dispatch.ts` to actually route based on classifier output.
- `metadata.json` records classifier inputs, outputs, model id, and
  bureau commit hash for the loaded `vision-router.md`.

Behavior:
- Classifier prompt + few-shot examples loaded from
  `bureau/.../prompts/vision-router.md` at tool init.
- `dispatch.ts` calls the right specialist (vision /
  inspect-drawing / measure-distance) per the classifier's output.

Acceptance:
- Classifier output deterministic for a fixed input + same model.
- Dispatch traces specialist calls back to the originating
  vision_check callId via the per-call artifacts.

### Phase C — bureau experiment overlays + prompts

Files:
- `bureau/.../completeness-check/experiments/vision-check/{experiment.yaml,review.md}`
- `bureau/.../completeness-check/prompts/vision-router.md` (cc-tuned examples)
- `bureau/.../review/experiments/vision-check/{experiment.yaml,review.md}`
- `bureau/.../review/prompts/vision-router.md` (review-tuned examples)

Behavior:
- `--experiment=vision-check` on cc and review now activates the new
  prompt and tools list.

Acceptance:
- End-to-end run of `--experiment=vision-check` against 1700 S. Lamar
  (cc) completes and produces `output/vision-check-calls/`.
- Same for `el-md-exp` against Valley View Townhomes (review).

### Phase D — eval + writeup

Files (in this winston workspace, under
`workspaces/vision-tool-orchestration/experiments/run1/`):
- Pulled artifacts from each of the two runs
- `analytics/analysis.md` writeup with:
  - Routing accuracy confusion matrix
  - Conditional execution accuracy per specialist
  - Headline recall vs the inspect-drawing run1 + measure-distance
    run7 baselines (the rigorous numbers from problem-statement.md)
  - Which failure mode dominates (selection vs execution vs
    classifier accuracy)
  - Recommendation for iter 2 path per the F1 trigger split

Acceptance:
- Headline recall ≥80% on should-call items (both eval suites), or
  a documented reason it isn't.
- Iter 2 path picked based on dominant failure mode.

---

## Earmarked follow-ups (after iter 1 lands)

1. **Synthetic / cross-guide test harness** — sample items from
   additional review-guides to validate routing on a more representative
   set and surface candidate new vision problem-types.
2. **Multi-specialist orchestration** — items where multiple specialists
   could contribute (e.g., distance + drawing-inspect for the same
   checklist question). Folds into the
   [`../inspect-drawing-tool/ai-loop-exploration.md`](../inspect-drawing-tool/ai-loop-exploration.md)
   discussion. See also the measurement chain decision below.

   ### Measurement-route arg construction (chain inspect-drawing → measure-distance)

   **Status:** deferred from Phase B. Captured here so future iterations
   start from the right framing.

   **Problem.** Phase B's classifier identifies `measurement` items, but
   `measure-distance` requires `objectPairs: [{objectA, objectB}]` and
   `scaleInchesPerFoot` — args that need visual grounding to construct
   correctly (an object description like *"transformer pad in the
   northwest area near Building 1"* only comes from looking at the
   sheet). Phase B falls back to generic vision for `measurement` and
   logs the route so we still get hit-rate signal.

   **Decision (deferred, not designed).** When we wire up the
   measurement route, **compose existing tools**:

   ```
   measurement route:
     inspect-drawing(question = "locate the relevant object pairs for this measurement")
       → returns evidence bboxes/descriptions
     derive objectPairs and scale
     measure-distance(documentId, sheetNum, objectPairs, scale)
       → returns measurements
   ```

   Don't invent a new specialist (`extract-measurement-args` etc.).
   inspect-drawing is already the visually-grounded tool that returns
   bbox+description evidence — composing it with measure-distance is the
   architectural shape the whole initiative is about.

   **Rationale captured from the design conversation:**

   - The chain is **not** more expensive than today. Today's flow already
     involves the agent calling `vision` for context + `measure-distance`
     (which makes 2 internal Gemini calls). The chain is essentially the
     same call count, with the difference that the object pairs come from
     a *grounded* call instead of the agent's *ungrounded* guess.
   - Identifying wrong objects is already a failure mode today. The chain
     doesn't add a new failure surface; it replaces an ungrounded guess
     with a grounded one. Net better.
   - State propagation between specialists is the *whole point* of this
     initiative — vision_check is supposed to compose specialists. Chain
     orchestration is what we're building toward.
   - **Principle:** compose existing tools rather than inventing new
     specialists. Inventing specialists is the failure mode to avoid.
     If a problem looks like it needs a new tool, first ask whether
     existing tools (especially inspect-drawing's evidence array) can
     express it.

   **Open implementation questions to resolve when this comes off the
   shelf:**

   - inspect-drawing's current contract is single-question, not
     "enumerate object pairs." Likely needs a new mode (e.g.,
     `expectedAnswerType: "object-pairs"`) or a question-shaping
     convention that nudges the model to populate `evidence[]` with the
     pair candidates.
   - `scaleInchesPerFoot` from the title block. Two options: (a) extend
     measure-distance to read scale from the title block itself when
     not provided, (b) read it once per sheet at submission ingest time
     and cache it. Either way, NOT a new specialist.
   - Phase B's metadata.json has `dispatch.fallback_reason:
     "measurement_arg_construction_not_implemented"` for items that hit
     this gap. When the chain lands, those items start producing real
     measure-distance calls — Phase D's eval will tell us if the chain
     produces the recall lift we expect.
3. **Confidence-thresholded fallback** — if low-confidence classifier
   decisions are systematically wrong in iter 1 data, add a confidence
   threshold below which we route to `generic`.
4. **`tools_used` tracking bug** — fixing the agent SDK / build-review-
   comments path so per-finding tool-call attribution captures
   `inspect-drawing` and `vision_check` (currently misses inspect-drawing).
   Required before the routing-accuracy metric is reliable per-finding.
