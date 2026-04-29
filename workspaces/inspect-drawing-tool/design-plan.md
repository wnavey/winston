# inspect-drawing Tool — Design Plan

Living plan for the `inspect-drawing` tool. Updated as decisions land.

**Status:** Phase 0 — design.

---

## Goal

Answer drawing-specific questions on a site plan sheet by cropping to the
relevant region, asking Gemini Vision a structured question, and returning
a structured `{answer, evidence_bbox, confidence, reasoning}` payload that
the calling agent can branch on.

The tool is **separate from `vision`**, lives **alongside** it, and is gated
behind an experiment overlay during incubation — same model as
`measure-distance` (see `bureau/jurisdictions/austin/workflows/review/experiments/measure-distance/`).

## Non-goals

- **Replacing `vision`.** The generic vision tool stays. `inspect-drawing` is
  for questions that depend on shape/line/spatial reasoning over a drawing.
  Most calls keep going to `vision`.
- **General-purpose VQA.** The tool is scoped to the drawing block of a sheet.
  Cover-sheet text, schedules, and non-drawing pages should still go to
  `vision`.
- **Cross-sheet reasoning.** A single call answers about a single sheet's
  drawing. Multi-sheet questions are the agent's responsibility.

---

## Tool surface

### MCP tool name
`run_inspect_drawing` (matches `createScriptTool`'s `run_<scriptName>` convention).

### Inputs (typed schema, `inspect-drawing.tool-schema.json`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Plan-set ID (same as `vision` / `measure-distance`). |
| `sheetNum` | string | yes | Sheet number. String to tolerate `C4-1` etc. |
| `question` | string | yes | The question to answer. Should reference visible features/labels — not abstract checklist text. |
| `expectedAnswerType` | enum | no | One of `boolean`, `count`, `description`. Default `boolean`. Tells the model which structured field to populate; the response shape is the same either way. |
| `cropMode` | enum/string | no | One of `drawing` *(default)*, `full-sheet`, or `block:<contentBlockId>`. Controls what region of the sheet gets sent to the model. See "Cropping strategy." |
| `regionHint` | string | no | Optional natural-language hint for *where* on the drawing to look (e.g., "along the east property frontage"). **Treated as a hint, not a constraint** — see "Hallucination guardrails." |
| `reasoning` | string | no | Agent's rationale for invoking the tool (for logs/eval, not used in the prompt). |
| `applicable_checklist_items` | array | no | Same shape as `measure-distance` — for traceability and post-hoc analysis. |

`expectedAnswerType` exists so agents can branch reliably:
- `boolean` (default): "Are flow arrows shown?" → populates `classification`.
- `count`: "How many transformers?" → populates `count`.
- `description`: "What style of fence is shown?" → free-form `answerText` only.

Measurement-style questions ("what is the diameter of the pad?") are
**out of scope for v1** but not architecturally precluded — they currently
belong to `measure-distance`. A future revision could either add a
`measurement` answer type here or have inspect-drawing delegate to
measure-distance internally. Don't design for that now; keep the schema
forward-compatible by leaving room for new `expectedAnswerType` values.

### Output (JSON written to `outputPath`)

Universal shape — same response keys regardless of `expectedAnswerType`.
Type-specific fields are optional and populated based on the question type.

```jsonc
{
  "answerText": "1-3 sentence human-readable answer. Always populated.",
  "classification": "yes" | "no" | "partial",   // populated iff expectedAnswerType=boolean
  "count": 3,                                   // populated iff expectedAnswerType=count
  "unanswerable": false,                        // type-agnostic 'I can't tell'
  "confidence": 0.0,                            // 0.0–1.0 from the model
  "evidence": [
    {
      "bbox": [y0, x0, y1, x1],                 // Gemini 0–1000 normalized, drawing-relative
      "bboxAbsolute": { "x0": 0.31, ... },      // 0–1 page-relative, computed in TS
      "description": "Direction arrow on 8\" SS line near MH-3"
    }
  ],
  "reasoning": "Why the model concluded what it concluded.",
  "regionHintHonored": true | false,            // did the model crop where the hint suggested?
  "_meta": {
    "callId": "...",
    "expectedAnswerType": "boolean",
    "drawingBbox": { ... },
    "passes": [ /* one entry per Gemini call */ ],
    "model": "google/gemini-3.1-pro-preview"
  }
}
```

**Why this shape:**
- `answerText` is the universal fallback — always populated, always
  human-readable. Description-type questions live entirely here.
- `classification` (boolean) and `count` (count) are the typed channels
  agents branch on for structured downstream logic. `partial` covers the
  wastewater case where some segments have arrows and others don't.
- `unanswerable: true` is the **type-agnostic hallucination guardrail** —
  replaces overloading "unclear" into the boolean enum. When `true`, the
  typed fields (`classification` / `count`) are null and `answerText`
  explains what's missing.
- `evidence` is always an array (possibly empty). For count questions,
  `count` and `evidence.length` should agree — disagreement is a tool-side
  validation error, downgrade to `unanswerable`.

**Validation rules enforced in TS before returning:**
- If `expectedAnswerType=boolean` and `classification ∈ {yes, partial}` but
  `evidence` is empty → set `unanswerable=true`, null out `classification`.
- If `expectedAnswerType=count` and `count > 0` but `evidence.length !==
  count` → set `unanswerable=true`, null out `count`.
- If `unanswerable=true` then `classification` and `count` must be null.

---

## Cropping strategy

### Phase 1 (single pass) — start simple

Cropping is driven by `cropMode` (input field):

| `cropMode` | Behavior |
|---|---|
| `drawing` *(default)* | Look up the **largest `category='drawing'` `content_block`** for the target sheet (same query `measure-distance.findDrawingBlockBbox` uses). Render the PDF region to JPEG at ~150 DPI via PyMuPDF. If no drawing block exists, auto-fall back to `full-sheet` and flag it in `_meta.cropFallback`. |
| `full-sheet` | No crop — render the whole sheet at ~150 DPI and send that. Use when the answer might lie outside the drawing block (legends, schedules, title-block context) or when the agent has reason to think `drawing`-cropping would lose information. |
| `block:<contentBlockId>` | Crop to a specific content block by ID — useful when the agent has already done block discovery (via `blocks.md` or `semantic-search-blocks`) and knows exactly which region matters. |

`_meta` records the resolved `cropMode`, the bbox actually used, and any
fallback that fired — so post-hoc analysis can ask "of `unanswerable`
results, what fraction were `drawing`-cropped and might have succeeded
on `full-sheet`?"

#### Prompt-level gating

The tool description, registered with `createScriptTool`, must steer the
agent toward drawing-region questions and away from misuse:

> Use this tool only for questions whose answer requires reasoning about
> the drawing area of a sheet — lines, symbols, spatial relationships,
> shapes. For legend/schedule/title-block lookups or general page text,
> use the `vision` tool instead. Before calling, confirm the target sheet
> has a `category=drawing` block (check `blocks.md` or a prior
> `semantic-search-blocks` result). If the answer might depend on
> non-drawing context (e.g., comparing a drawing symbol to a legend
> entry), set `cropMode=full-sheet` or do a separate `vision` lookup
> first.

This is enough to answer most questions, and lets us measure the
"crop-to-drawing-block" baseline before adding complexity.

#### What we are *not* doing in Phase 1

- **Auto-detecting `cropMode` from the question** (LLM routing): another
  model call, more failure surface, hard to debug. Defer indefinitely.
- **Auto-bundling the legend block with the drawing crop**: measure-distance
  does this for object disambiguation, but for cc the agent can do a
  separate `vision` lookup on the legend if needed. Revisit if fixture
  results show legend context is consistently the bottleneck.

### Phase 2 (two pass) — refined crop

When `confidence < threshold` *or* the model returns `unclear` *or* the
agent passed a `regionHint`:

1. **Pass 1 (coarse)**: Same as Phase 1 — full drawing crop, model returns
   *both* a tentative answer *and* a tighter bbox of "where I looked."
2. **Pass 2 (refined)**: Render the pass-1 bbox at higher DPI (300), pad
   30%, ask the same question again. Final answer = pass 2.

Same two-pass shape as `measure-distance.localizeWithGemini` (call1 → call2).
Reuses the PyMuPDF render machinery — no new infrastructure.

### Phase 3 (reference images) — deferred

For specific questions (e.g., adjacent driveways), attach **per-question
curated example crops** as additional images in the Gemini call:

- Positive examples: 2-3 crops where the feature *is* present
- Negative examples: 2-3 crops where it's *not*

Curated set lives in `bureau/jurisdictions/austin/workflows/completeness-check/scripts/inspect-drawing-examples/<question-key>/{positive,negative}/*.jpg`,
referenced by a `questionKey` field in the tool input. Schema-compatible with
Phase 1/2 — `questionKey` is optional.

---

## Hallucination guardrails

The user flagged this explicitly: a `regionHint` from the agent must not
snowball into a confident wrong answer. Concrete defenses:

1. **Hint is presented as a hypothesis, not a constraint.** Prompt language:
   > "The agent suggests the relevant area is X. Verify this is correct
   > before answering. If the suggested region looks wrong, find the correct
   > region and answer based on what you actually see. Set
   > `regionHintHonored=false` if you had to relocate."

2. **`unanswerable=true` is a valid answer.** The prompt explicitly
   authorizes it ("If you cannot tell with high confidence, set
   `unanswerable=true` and explain what's missing in `answerText`").
   Mirrors the `measure-distance` lesson where the agent was nudged to
   *measure before falling back to `not-verifiable`* — here we want the
   *opposite* nudge: prefer `unanswerable` to a hallucinated `yes` /
   inflated count.

3. **Every positive claim must have a bbox.** Enforced in the TS
   validation rules above (boolean `yes/partial` with empty evidence,
   or `count > 0` with mismatched evidence length, both downgrade to
   `unanswerable`).

4. **Two-pass divergence check (Phase 2).** If pass 1 and pass 2 disagree
   on `classification` / `count` (beyond a small tolerance for counts),
   bubble up `unanswerable=true` with both passes in `_meta.passes`.
   Don't silently take pass 2.

---

## Wiring

### Script location
`bureau/jurisdictions/austin/workflows/completeness-check/scripts/inspect-drawing.ts`
(+ `inspect-drawing-impl.py` for PIL/PyMuPDF rendering, mirroring
`measure-distance-impl.py`).

### Tool schema
`bureau/jurisdictions/austin/workflows/completeness-check/schemas/inspect-drawing.tool-schema.json`.
Loaded by `createScriptTool` via the existing `toolSchema` mechanism — no
conductor changes needed.

### Experiment overlay
```
bureau/jurisdictions/austin/workflows/completeness-check/experiments/
  inspect-drawing/
    experiment.yaml      # overrides review step: tools = [vision, semantic-search-blocks, script:inspect-drawing], prompt = review.md
    review.md            # stock cc prompt + "Using the inspect-drawing tool" section
```

Activated by `--experiment=inspect-drawing` on `completeness-check`.
Baseline (no flag) is unchanged — the tool isn't registered and the prompt
doesn't mention it. This is identical to the measure-distance pattern.

**Open question:** completeness-check has 13 grouping files. We may want to
scope the first experiment to a subset (e.g., the 2-3 groupings that contain
the motivating questions) to keep iteration fast — analogous to
`el-md-exp` for measure-distance. TBD once we have a fixture set.

### Per-call artifact directory

Same convention as measure-distance — every tool invocation produces a
self-contained directory on disk so calls can be replayed, audited, and
visualized offline. **The exact image sent to Gemini is saved as a JPEG**
so we can always inspect what the model actually saw.

```
workspace/output/inspect-drawing-calls/<callId>/
  metadata.json          # inputs (incl. cropMode), resolved bbox, timing, result
  prompt.txt             # full Gemini prompt
  cropped.jpg            # ★ the image sent to Gemini — exactly what it saw
  response.txt           # raw Gemini response (Phase 1 — single pass)
  call1-prompt.txt       # (Phase 2+) per-pass artifacts
  call1-cropped.jpg      # ★ pass-1 image
  call1-response.txt
  call2-cropped.jpg      # ★ pass-2 refined image
  call2-...
  events.jsonl           # per-step structured log
```

That `cropped.jpg` is the same artifact measure-distance writes — it's
what makes the debug viewer ("did Gemini see what we expected?")
possible. The `_meta.cropMode` + `_meta.bbox` recorded in `metadata.json`
let post-hoc analysis correlate crop choices with answer quality.

Conductor already stamps `WORKFLOW_RUN_ID`, `RUN_LABEL`,
`CHECKLIST_ITEM`, etc. into the env (conductor#117) — reuse for cost
attribution and analysis.

---

## Replay & debug UI

### Replay fixtures (same as measure-distance)

Fixtures live at
`winston/workspaces/inspect-drawing-tool/replay/fixtures/*.json`:

```jsonc
{
  "description": "...",
  "source": { /* provenance */ },
  "testCases": [
    { "id": "...", "projectId": "...", "documentId": "...", "sheetNum": "...",
      "question": "...", "expectedAnswer": "...", "_provenance": { ... } }
  ]
}
```

Run via the existing `test-script` workflow — already supports parallel
script-step replay (bureau#224, conductor#119). No new infrastructure.

### Debug viewer

`winston/workspaces/inspect-drawing-tool/viewer/` — direct fork of the
measure-distance viewer (`viewer/index.html` + `build-manifest.py` +
`serve.sh`), adjusted to:

- Show the **question** prominently (the analog of measure-distance's
  object pair)
- Render the **drawing bbox + evidence bboxes** as overlays on the
  cropped image
- Display the **structured answer** (answer enum, confidence, reasoning)
  alongside the model's raw response
- For Phase 2 runs, side-by-side **call1 vs call2** view to spot
  divergence

Same `runs/v*/` layout, same `manifest.json` build step, same `serve.sh`
script. Only the per-step pane needs question/answer rendering instead of
distance rendering.

---

## Phasing

| Phase | What lands | Where |
|---|---|---|
| **0 — design** *(this doc)* | Plan, motivating examples, fixture template | winston repo (this PR) |
| **1 — single-pass MVP** | TS+Py script, tool schema, experiment overlay, ≤10 fixture cases, replay run, viewer | bureau (script + overlay), winston (fixtures + viewer + analysis) |
| **2 — two-pass refinement** | Coarse→refined Gemini pipeline, divergence check | bureau |
| **3 — reference images** | Per-question curated positive/negative crops, `questionKey` field | bureau (curated examples), winston (analysis of lift) |
| **4 — graduate from experiment** | If lift is clear, fold into the main completeness-check workflow | bureau |

Each post-Phase-0 phase is its own PR (or PR pair: bureau + winston).

---

## Open questions

1. **Scope of first experiment** — all 13 cc groupings or a trimmed subset?
   Decide after we capture the fixture set (Phase 1 prep).
2. **DPI for Phase 1** — `measure-distance` learned that 120 DPI for the
   coarse pass is sometimes too low to read fine line work. Inspect-drawing
   has the same risk. Default to 150 DPI for the single-pass MVP and
   re-evaluate from fixture results.
3. **Prompt template versioning** — same `prompts/` directory pattern, with
   a top-level `inspect-drawing.md` system prompt and per-question hints
   merged in? Or one big template with branching?
4. **Concurrent calls** — does the cc agent ever make N parallel
   inspect-drawing calls? If so, do we batch (`questionPairs`-style) like
   measure-distance does for object pairs? Defer until usage data shows it
   matters.
5. **Reference-image retrieval (Phase 3)** — manually curated only, or eventually
   auto-retrieved via embedding search over a labeled corpus? Curated only
   for v1.
6. **Eval ground truth** — for fixtures, do we hand-label all expected
   answers, or seed from prior reviewer comments? Hybrid likely.

---

## References

- `winston/workspaces/measure-distance-tool/` — sibling workspace, the
  template for everything in this plan
- `winston/workspaces/measure-distance-tool/reference/architecture-overview.md`
  — the architecture this tool mirrors
- `bureau/jurisdictions/austin/workflows/review/experiments/measure-distance/experiment.yaml`
  — the overlay shape we'll copy into completeness-check
- `bureau/jurisdictions/austin/workflows/completeness-check/scripts/semantic-search-blocks.ts`
  — the existing precedent for a workflow-local script tool in cc
- `conductor/src/tools/script.ts` — `createScriptTool`, the wrapper that
  registers `run_inspect_drawing` from a typed JSON schema
