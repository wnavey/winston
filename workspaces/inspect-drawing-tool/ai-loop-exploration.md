# AI Loop Exploration

Research into adding an agentic loop to `inspect-drawing` — where instead
of a hardcoded N-pass pipeline, a vision model iteratively reasons, crops,
re-examines, and self-corrects until it reaches a confident answer or gives up.

**Status:** Research / exploration. Not assigned to a phase yet.

---

## Motivation

The Phase 1–2 design is a deterministic pipeline: crop → call Gemini →
(optionally) refine crop → call again. That works for straightforward
questions, but some completeness-check items need *adaptive* reasoning:

- **Ambiguous first pass** — the model isn't sure what it's looking at and
  needs to zoom into a sub-region, then zoom back out to confirm context.
- **Multi-region evidence** — the answer requires checking multiple areas
  of the drawing (e.g., flow arrows on three separate sewer segments).
- **Legend cross-reference** — the model sees a symbol but needs the legend
  to interpret it, then re-examines the drawing with that knowledge.
- **Self-correction** — the model realizes mid-reasoning that it's looking
  at the wrong line type and needs to re-crop.

A hardcoded two-pass pipeline can't express "zoom into segment A, then
segment B, then check the legend, then reconsider segment A." An agentic
loop can.

---

## How things work today

### Current architecture (two layers)

There are two distinct AI loop layers in the system:

| Layer | SDK | Loop mechanism | Where it runs |
|---|---|---|---|
| **Outer agent** (Claude) | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | `query()` async iterator — loops until `end_turn` | Conductor (`runner.ts`) |
| **Inner tool calls** (Gemini) | Vercel AI SDK v5 (`ai@^5.0.116`) | `generateText()` — single-shot, no loop | Inside MCP tools (vision, measure-distance) |

The **outer loop** (Claude agent) already *is* agentic — it calls tools,
gets results, reasons, calls more tools, until it's done. The cc agent
can already call `run_inspect_drawing` multiple times with different
parameters.

The **inner calls** (Gemini vision) are single-shot. `measure-distance`
hardcodes a two-call sequence (coarse → refined). The generic `vision`
tool is a single `generateText()` call.

### measure-distance's two-pass pattern

```
localizeWithGemini(call1, 120 DPI, full drawing crop)
  → coarse bboxes
computeRefinedCropBbox(union + 30% padding)
  → refined region
renderPdfRegion(refined region, 300 DPI)
localizeWithGemini(call2, 300 DPI, refined crop)
  → precise answer
fallback: if call2 fails, use call1
```

This is a **deterministic pipeline**, not an agentic loop. The refinement
logic is hardcoded in TS — Gemini has no say in what gets cropped next.

---

## Three options for adding an agentic loop

### Option A: Loop at the outer agent level (Claude decides)

The cc Claude agent already has an agentic loop. We could keep
`inspect-drawing` as a single-shot tool and let the agent call it
multiple times, adjusting `cropMode`, `regionHint`, and `question`
between calls based on previous results.

**How it works today, no changes needed:**
```
Claude agent:
  → run_inspect_drawing(question="flow arrows on WW lines?", cropMode="drawing")
  ← { unanswerable: true, reasoning: "Multiple line types visible, can't isolate WW" }
  → run_inspect_drawing(question="flow arrows on WW lines?", cropMode="block:cb-12", regionHint="east side SS lines")
  ← { classification: "partial", evidence: [...] }
  → vision(sheetNum="C4-1", question="What does the legend say about SS vs WW line styles?")
  ← "SS is dashed, WW is solid with arrows"
  → run_inspect_drawing(question="flow arrows on solid WW lines?", ...)
  ← { classification: "yes", evidence: [...], confidence: 0.85 }
```

**Pros:**
- Zero new infrastructure — the outer loop already exists
- Claude is good at multi-step reasoning and tool orchestration
- Each tool call is simple, testable, replayable
- Per-call artifacts are clean (one Gemini call = one artifact directory)
- Works today with Phase 1 as designed

**Cons:**
- Each outer-loop iteration is expensive (full Claude API call + context)
- Claude doesn't see the image — it's reasoning about text descriptions of
  what Gemini saw, which is lossy
- Latency: Claude roundtrip + Gemini roundtrip per iteration
- Claude may not have good intuition about *spatial* refinement strategies
  (what to zoom into, how to crop)

### Option B: Loop inside the script tool (Gemini agentic loop)

Give Gemini tools (crop, zoom, lookup-legend, re-examine) and let it loop
inside `inspect-drawing.ts` using the Vercel AI SDK's agentic loop.

**Two sub-options:**

#### B1: Vercel AI SDK v5 — manual loop with `generateText`

```typescript
// inspect-drawing.ts (simplified)
const tools = {
  crop_region: tool({
    description: 'Crop to a specific region of the drawing at higher DPI',
    parameters: z.object({
      bbox: z.array(z.number()).length(4),
      dpi: z.number().default(300),
    }),
    execute: async ({ bbox, dpi }) => {
      const img = await renderPdfRegion(pdfPath, bbox, dpi);
      return { type: 'image', data: img };
    },
  }),
  lookup_legend: tool({
    description: 'Get the legend/symbol table from this sheet',
    parameters: z.object({}),
    execute: async () => {
      const legendImg = await renderLegendBlock(pdfPath, sheetNum);
      return { type: 'image', data: legendImg };
    },
  }),
};

let messages = [{ role: 'user', content: [drawingImage, questionPrompt] }];
let step = 0;
const MAX_STEPS = 5;

while (step < MAX_STEPS) {
  const result = await generateText({
    model: gateway('google/gemini-3.1-pro-preview'),
    messages,
    tools,
    ...buildGatewayProviderOptions('inspect-drawing'),
  });

  messages.push(...result.response.messages);

  if (result.finishReason !== 'tool-calls') break; // model is done
  step++;
}

// Parse final structured answer from last text response
```

#### B2: Vercel AI SDK v6 — ToolLoopAgent

```typescript
import { ToolLoopAgent, stepCountIs } from 'ai';

const inspectAgent = new ToolLoopAgent({
  model: gateway('google/gemini-3.1-pro-preview'),
  instructions: inspectDrawingPrompt,
  tools: {
    crop_region: cropRegionTool,
    lookup_legend: lookupLegendTool,
  },
  stopWhen: stepCountIs(5),
  output: Output.object({ schema: inspectDrawingOutputSchema }),
  onStepFinish: async ({ stepNumber, toolCalls }) => {
    // Write per-step artifacts
    saveStepArtifacts(callDir, stepNumber, toolCalls);
  },
  prepareStep: async ({ stepNumber, steps }) => {
    // Could adjust tools available based on what's happened so far
    if (stepNumber > 3) return { activeTools: ['summarize'] };
    return {};
  },
});

const { output } = await inspectAgent.generate({
  prompt: [drawingImage, questionPrompt],
});
```

**Pros:**
- Gemini *sees the image* and can make spatial decisions about where to
  look next — fundamentally better than Claude reasoning from text
  descriptions of images
- Lower latency per iteration (no Claude roundtrip, just Gemini)
- Lower cost per iteration (Gemini calls are cheaper than Claude)
- Natural fit: "look at drawing, decide what to examine closer, examine
  it, answer" is a vision-agent workflow
- `prepareStep` enables dynamic tool/context management between steps

**Cons:**
- New pattern for the codebase — nothing in conductor or bureau currently
  runs a Gemini tool loop (all Gemini calls are single-shot today)
- Artifact logging is more complex (multiple Gemini calls per tool
  invocation, need per-step artifacts)
- Harder to debug than a deterministic pipeline — need to trace multi-step
  reasoning
- Gemini's tool-use quality may be lower than Claude's for complex
  orchestration decisions
- SDK v6 (`ToolLoopAgent`) requires an upgrade from v5; v5 manual loop
  is available now but more boilerplate
- Each "tool" (crop, legend lookup) involves rendering images, which is
  I/O-heavy — Gemini needs to wait for renders mid-loop

### Option C: Hybrid — deterministic pipeline with an escape hatch

Keep the Phase 1–2 deterministic pipeline as the default path, but add
a conditional agentic loop that fires only when the deterministic path
produces low confidence or `unanswerable`.

```
Phase 1 single pass (deterministic)
  → confidence >= threshold? → return result
  → confidence < threshold?
    → enter Gemini agentic loop (Option B) with the Phase 1 result
      as initial context, up to 3 additional steps
    → return refined result (or unanswerable if loop exhausted)
```

**Pros:**
- Most calls (simple questions) stay fast and cheap — single pass
- Complex questions get the benefit of iterative reasoning
- Artifact story is clean: deterministic calls have simple artifacts,
  loop calls have richer multi-step artifacts
- Can be gated behind a flag/experiment — easy to A/B against Phase 2's
  hardcoded two-pass

**Cons:**
- Two code paths to maintain
- Need to define the confidence threshold that triggers the loop
- The "initial context" handoff from deterministic to loop needs design

---

## Vercel AI SDK capabilities (current + upcoming)

### SDK v5 (what we have: `ai@^5.0.116`)

- `generateText()` with `tools` — supports tool calling but **no built-in
  loop**. To loop, you write a `while` loop manually around `generateText`,
  appending `result.response.messages` back to the conversation.
- No `maxSteps` on `generateText` in v5 (that's a v4 legacy; v5 replaced
  it with `stopWhen` on the Agent class which is v6).
- Single-shot `generateText` with tool definitions is what vision +
  measure-distance use today.

### SDK v6 (available, not yet adopted)

- **`ToolLoopAgent`** class — encapsulates model + tools + loop:
  - `stopWhen`: array of stop conditions (`stepCountIs(N)`,
    `hasToolCall(name)`, custom functions)
  - `prepareStep`: callback before each step — can swap models, adjust
    active tools, modify messages (e.g., summarize long tool results)
  - `onStepFinish`: callback after each step — for logging/artifacts
  - `output`: structured output enforced after loop completion (Zod schema)
  - Default: 20 steps max
- `generate()` and `stream()` methods on agent instances
- Loop terminates when: model returns text (no tool calls), step limit
  reached, `hasToolCall` condition met, or custom stop condition fires

### Upgrade path: v5 → v6

The v6 blog post claims "minimal code changes" for upgrading. Key changes:
- `generateText/streamText` still exist (backward compatible)
- `ToolLoopAgent` is additive — doesn't replace the functional API
- `generateObject` is unified into `generateText` with `output` param

**Risk:** Conductor imports from `ai` in multiple places (vision, gateway
metadata, measure-distance). An upgrade would need testing across all of
these. Not a blocker, but not free.

---

## Architectural considerations

### Where should the loop live?

The Claude Agent SDK's `query()` loop and the Vercel AI SDK's
`ToolLoopAgent` are the same pattern at different layers. The question is
which model should drive the iterative reasoning for visual questions:

| Criterion | Claude outer loop (Option A) | Gemini inner loop (Option B) |
|---|---|---|
| **Sees the image** | No — reasons from text descriptions | Yes — sees crops directly |
| **Orchestration quality** | Excellent — Claude is great at tool use | Unknown — Gemini tool-use less battle-tested |
| **Cost per iteration** | High (Claude context + Gemini call) | Lower (Gemini call only) |
| **Latency per iteration** | ~10-15s (Claude + Gemini) | ~3-5s (Gemini only) |
| **Artifact simplicity** | Simple (1 Gemini call per tool invocation) | Complex (N Gemini calls per tool invocation) |
| **Testability** | Good (replay individual tool calls) | Needs new replay infra for multi-step |
| **Existing precedent** | Yes (this is how cc works today) | No (new pattern for the codebase) |

### Tool design for the inner loop

If we go with Option B, Gemini needs tools that return *images* (not text
descriptions of images). This is a different tool shape from what Claude
uses today. Candidate tools for the Gemini inner agent:

| Tool | Input | Output | Notes |
|---|---|---|---|
| `crop_region` | `bbox: [y0,x0,y1,x1], dpi: number` | JPEG image of that region | Core navigation tool |
| `crop_block` | `contentBlockId: string, dpi: number` | JPEG image of that content block | Shortcut when block ID is known |
| `lookup_legend` | (none or sheet hint) | JPEG of legend block | For symbol disambiguation |
| `full_sheet` | `dpi: number` | JPEG of entire sheet | Zoom out to re-orient |
| `answer` | structured answer payload | (terminates loop) | `hasToolCall('answer')` as stop condition |

The `answer` tool pattern (no `execute` function — just a schema that
captures the structured output) is a clean way to force structured output
at the end of a tool loop. When the model calls `answer(...)`, the loop
stops and we extract the payload. This avoids the fragile "parse JSON from
the last text response" pattern that measure-distance uses today.

### Artifact logging for multi-step

Each tool invocation in the inner loop generates an image. For debuggability:

```
workspace/output/inspect-drawing-calls/<callId>/
  metadata.json           # top-level: inputs, final result, total steps
  step-0/
    prompt.txt            # full Gemini prompt for this step
    response.txt          # raw Gemini response
    tool-calls.json       # tool name + args
  step-1/
    cropped.jpg           # image generated by crop_region tool
    prompt.txt
    response.txt
    tool-calls.json
  step-2/
    legend.jpg            # image from lookup_legend
    ...
  final-answer.json       # structured output extracted from answer tool call
```

The debug viewer would show a **timeline** of steps, each with the image
the model saw and the reasoning it produced — similar to the measure-distance
call1/call2 view but generalized to N steps.

---

## Recommendation

**Phase 1–2: Stay deterministic.** The single-pass and two-pass pipelines
are the right starting point. They're simple, testable, and will generate
the fixture data and intuition we need to know whether an agentic loop
actually helps.

**Phase 2.5 or 3: Experiment with Option C (hybrid).** Once we have
Phase 2 running and can see which questions still fail at two passes:

1. Implement a manual Gemini tool loop (SDK v5, Option B1) as a fallback
   path that fires when `confidence < threshold` or `unanswerable=true`.
2. Give Gemini 2–3 tools: `crop_region`, `lookup_legend`, `answer`.
3. Cap at 3–5 additional steps.
4. Gate behind an experiment flag.
5. Compare artifact quality (via the viewer) against the deterministic
   baseline.

**Later: Evaluate SDK v6 upgrade.** If the inner-loop pattern proves
valuable, `ToolLoopAgent` is a cleaner abstraction than a manual while
loop. But don't upgrade the SDK just for this — wait until there's a
broader conductor reason to move to v6.

**Option A (Claude outer loop) is always available as a fallback.** If
Gemini's tool-use quality turns out to be poor, we can lean on Claude
to orchestrate multiple inspect-drawing calls instead. The Phase 1 tool
surface already supports this — the cc agent can call the tool multiple
times with different parameters.

---

## Open questions

1. **Gemini tool-use quality** — How well does Gemini 3.1 Pro handle
   multi-step tool loops? We have no data on this yet. A small standalone
   experiment (outside the full cc pipeline) could answer this cheaply.
2. **Image-returning tools in Vercel AI SDK** — Does `generateText` with
   tools support tool results that include images (not just text)? This is
   critical for Option B. Need to verify with SDK docs or a spike.
3. **Cost model** — A 5-step Gemini loop is ~5x the Gemini cost of a
   single pass but still cheaper than one additional Claude outer-loop
   iteration. Need to quantify the actual cost difference.
4. **SDK v6 timeline** — When does the team plan to evaluate an AI SDK
   upgrade? This exploration shouldn't drive that decision, but it should
   be aware of it.
5. **Scope overlap with measure-distance** — If inspect-drawing gets an
   agentic loop, does measure-distance want one too? Or does
   inspect-drawing eventually *subsume* measure-distance (measurement
   becomes an `expectedAnswerType`)? This affects how much infra we
   invest in the loop pattern.

---

## References

- [Vercel AI SDK — Agents (Foundations)](https://ai-sdk.dev/docs/foundations/agents)
- [Vercel AI SDK — Building Agents](https://ai-sdk.dev/docs/agents/building-agents)
- [Vercel AI SDK — Loop Control](https://ai-sdk.dev/docs/agents/loop-control)
- [AI SDK 6 announcement](https://vercel.com/blog/ai-sdk-6)
- `conductor/src/agent/runner.ts` — current Claude Agent SDK loop
- `conductor/src/tools/vision/index.ts` — current single-shot Gemini pattern
- `bureau/jurisdictions/austin/workflows/review/scripts/measure-distance.ts` — two-pass Gemini pipeline
