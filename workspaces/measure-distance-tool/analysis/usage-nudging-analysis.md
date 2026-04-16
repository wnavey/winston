# Nudging agents to use the measure-distance tool

This is a working-document review of **when agents chose to invoke the
measure-distance (MD) tool** in the 2026-04-15 `el-md-exp` experiment, and
what prompt-level nudges might push them toward using it more often when
the checklist item calls for numeric clearance verification.

Sibling document: [checklist-item-gemini-call-mapping.md](./checklist-item-gemini-call-mapping.md) —
the authoritative per-agent Gemini call inventory this analysis is built on.

---

## TL;DR

- The experiment overlay prompt at `bureau/…/experiments/measure-distance/review.md`
  already tells the agent when and how to call the tool. Despite that, **4 of 9
  agents never invoked MD at all**, and the 5 that did called it sparingly
  (1–6 calls).
- All 9 agents were evaluating clearance-verification checklist items —
  every single item was an MD candidate.
- The 4 skip-agents produced dozens of `not-verifiable: "no dimension
  annotations provided"` findings — exactly the case MD was designed to
  rescue, yet never attempted.
- The current prompt frames MD as **permissive** ("use when a checklist item
  requires verifying…"). Results suggest agents treat it as opt-in rather
  than the first-class response to "no dimensions shown on plan."
- **Major confound**: every MD call in this run returned an error to the
  agent (Python 3.9 incompat + MCP type mismatch). Agents that tried it
  early may have disengaged mid-run. Re-run after conductor#118 + bureau#221
  land before drawing strong conclusions from call counts alone.

---

## Experiment setup (context)

- **Guide:** `el-md-exp` — 3 checklist items (`1.md`, `2.md`, `13.md`) drawn
  from the Austin Electric Review guide. All three are clearance-verification
  groupings:
  - `1.md` — Site Feature Clearances from Overhead Electric Lines (7.5' sky-to-ground, 15' radial)
  - `2.md` — Tree Clearances from Overhead Electric Lines
  - `13.md` — Transformer Pad Clearances and Location Requirements (3', 5', 10', 15', 20' clearances)
- **Runs:** 3 independent runs × 3 items = **9 agents**.
- **Overlay:** `--experiment=measure-distance` — tools list = `[vision, script:measure-distance]`,
  prompt = `experiments/measure-distance/review.md`.
- **Model:** `claude-haiku-4-5-20251001`.
- **Site plan:** SP-2025-0126C (Valley View Townhomes).

---

## Observed MD usage per agent

| Run | Item | MD calls | Outcome |
|-----|------|---------:|---------|
| run-1 | 1.md  | 0 | **Skipped MD** — 32 findings, 28 `not-verifiable` citing "no dimension annotations" |
| run-1 | 2.md  | 2 | Tried MD (1 mcp-error, 1 script-error) |
| run-1 | 13.md | 6 | Tried MD heavily (3 mcp-error, 3 script-error) |
| run-2 | 1.md  | 2 | Tried MD (1 mcp-error, 1 script-error) |
| run-2 | 2.md  | 3 | Tried MD (1 mcp-error, 2 script-error) |
| run-2 | 13.md | 0 | **Skipped MD** — 23 findings, all `not-verifiable` |
| run-3 | 1.md  | 0 | **Skipped MD** — 17 findings, mostly `not-verifiable` citing missing dimensions |
| run-3 | 2.md  | 1 | Tried MD once (script-error) |
| run-3 | 13.md | 0 | **Skipped MD** — 9 findings, all `not-verifiable` or `fail` citing missing dimensions |

**Usage asymmetry:** run-1 invoked MD 8 times; run-3 only 1 time. With 3 runs
of the same 3 items against the same site plan, this variance is entirely
agent-sampling variance — a sign that the prompt's nudge is not deterministic
enough to produce a reliable tool-adoption pattern.

---

## The skip-agents' findings show what got missed

Examples of findings from the 4 skip-agents that were textbook MD candidates
yet fell through to `not-verifiable`:

- **run-2 / 13.md, EL-13.20** — _"Minimum 5-foot clearance between multiple
  transformer pads cannot be verified. Four transformer pads are shown on the
  electrical plan, but distances between them are not dimensioned."_
  The sheet had the exact artifacts MD localizes (transformer pads + pads) and
  a known scale. This is the canonical MD use case.
- **run-3 / 1.md, EL-1.9** — _"Proposed fence exists near overhead electric
  distribution lines. No clearance dimension annotations showing 7.5-foot
  horizontal sky-to-ground clearance from outside conductor to fence post are
  provided."_ Fence and OHE line are both visible on the sheet.
- **run-3 / 13.md, EL-13.4** — _"Plans show transformer pads in proximity to
  buildings but do not provide dimensioned clearance measurements or
  documentation. Cannot verify minimum 5-foot horizontal clearance from
  transformer pad to adjacent building foundation."_
- **run-1 / 1.md, EL-1.2** — _"No dimension annotations indicating the 15-foot
  radial clearance from the outside conductor to proposed buildings are
  provided on the site plan."_

These are **not** cases where the feature is absent; they're cases where the
feature is visible but unannotated. The agent knew exactly what to measure and
chose not to measure it.

---

## What the current prompt says

From `bureau/jurisdictions/austin/workflows/review/experiments/measure-distance/review.md`:

```
## Using the Measure-Distance Tool

* You have access to a measure-distance tool for computing distances between
  objects on a site plan sheet.
* Use this tool when a checklist item requires verifying minimum clearances,
  setbacks, or separations between two physical features (e.g., "transformer
  pad must be at least 5 ft from tree CRZ").
* Required parameters: **documentId**, **sheetNum**, **objectA**, **objectB**,
  **scaleInchesPerFoot**. The projectId is automatically inferred from the
  workspace.
* Before calling the tool, read the sheet's guide.md to get the engineering
  scale (e.g., "1 inch = 20 feet"). Pass the scale as the scaleInchesPerFoot
  parameter.
* Provide descriptive names for objectA and objectB — the tool uses AI vision
  to locate them on the sheet, so be specific (e.g., "transformer pad in the
  northeast portion of the site" rather than just "transformer pad").
* The tool returns a measured distance in feet with a confidence level. At
  HIGH confidence, you can make pass/fail determinations. At MEDIUM, note the
  measurement but flag as "approximate." At LOW or UNABLE, fall back to the
  standard "cannot be verified from available evidence" approach.
* The tool generates a debug image saved to the output directory for audit
  purposes.
```

This is good reference material but it's **descriptive** rather than
**directive**. Nothing tells the agent, "If you are about to write
'not-verifiable — no dimensions shown,' try the ruler first."

---

## Proposed prompt nudges (candidates to A/B next)

Each of these is a small edit to the `Using the Measure-Distance Tool` section
of the overlay prompt. Grouped by aggressiveness.

### Tier 1 — soft anti-fallback nudge (recommended first)

Add a single bullet just after the current "Use this tool when…" bullet:

> * **Before writing `not-verifiable` because dimensions are missing from a
>   sheet, try measure-distance on that sheet first.** The tool exists to
>   rescue exactly this case: both features are visually present but the plan
>   lacks dimension annotations. "No dimensions shown" is a signal to
>   measure, not to stop.

Expected effect: flips the mental model from "MD is optional" to "MD is the
first response to missing-dimension findings."

### Tier 2 — per-finding decision prompt

Insert into the Step (around Step 3/4 where findings are drafted):

> For every checklist item where the clearance cannot be confirmed from plan
> annotations:
> 1. Identify objectA and objectB on the sheet (or mark truly absent).
> 2. If both are visible on the same sheet with a known scale, **call
>    measure-distance before finalizing the finding**.
> 3. Record the returned distance and confidence in the finding `comment`;
>    only fall back to "not-verifiable" after MD returns LOW or UNABLE.

Expected effect: makes MD part of the finding-drafting checklist, not an
optional detour.

### Tier 3 — success signal in the tool description itself

Update the tool's MCP description (in the TS `createScriptTool` call site for
`measure-distance`) from a one-liner to something that sells the use case:

> "Measure the distance in feet between two features on a site plan sheet
> using AI vision + PDF scale. Use this whenever a checklist item requires a
> numeric clearance and the plan does not dimension it."

Agents weight the tool description heavily when deciding whether to pick it
up. The current description (generic `Run the measure-distance script…`
from `createScriptTool`) is practically invisible.

### Tier 4 — explicit example in the prompt

Add a worked example:

> **Example — when to measure:**
> Checklist item EL-13.20 requires 5 ft minimum between transformer pads.
> Sheet 21 shows four pads but no dimensions between them. Call:
> `measure-distance(sheetNum=21, scaleInchesPerFoot=0.05, objectA="transformer
> pad in the northeast area near Building 1", objectB="transformer pad in the
> northwest area near Building 2")`. Record the returned distance; compare to
> 5 ft; write `pass` / `fail` accordingly.

Expected effect: gives the agent a concrete template it can pattern-match on.

---

## What the next experiment run should do

To evaluate whether any of the nudges work, the next run needs:

1. **Fix the plumbing first.** The current run had 0 successful MD responses.
   Agents may have down-weighted the tool mid-run after the first few errors.
   - Land `conductor#118` — accept numeric `sheetNum` / `scaleInchesPerFoot`
     so MCP validation stops rejecting valid calls.
   - Land `bureau#221` — `from __future__ import annotations` so
     Python 3.9 can actually run the script.
   - Ideally also upgrade the workspace venv to Python 3.10+.
2. **Re-baseline with the current prompt.** Expected: MD usage goes up
   modestly (no more error-driven tool abandonment), and the tool actually
   returns distances.
3. **Then A/B each nudge tier.** Use the same 3 items × 3 runs setup so
   deltas are legible against the 9-agent grid. Track per-tier:
   - `md_calls / agent` — average
   - `md_calls / (candidate findings)` — coverage of missing-dimension cases
   - `findings_converted_to_pass_or_fail` — did MD actually produce
     verdicts, or did agents still end at `not-verifiable`?
   - `md_error_rate` — guard against environmental regressions

---

## Tracking

Each nudge A/B should produce its own `experiment-runs/` archive in this
workspace. Keep the `el-md-exp` guide pinned to the same 3 checklist items
(`1.md`, `2.md`, `13.md`) so cross-run comparison stays valid. Update this
document as nudges land and results come in.
