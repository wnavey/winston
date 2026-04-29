# Motivating Examples

Concrete completeness-check items where the generic `vision` tool produces
unreliable answers and `inspect-drawing` is expected to do better. These
drive the tool's design: input shape, prompt structure, evaluation fixtures.

---

## Example 1 — Direction-of-flow arrows on wastewater lines

**Question (paraphrased from completeness checklist):**
> "Do the wastewater lines have direction-of-flow arrows?"

**Why generic vision fails:**
A site plan drawing contains many lines and many arrows. The model frequently
either (a) confuses adjacent lines (storm vs. sanitary) and answers about the
wrong feature, or (b) reports an arrow as "on" the wastewater line when it is
actually a leader/callout arrow nearby, not a flow arrow on the line.

**What "correct" looks like:**
1. The model first identifies the wastewater line(s) — typically a styled
   linetype, often labeled e.g. `SS`, `WW`, `8" SAN SEWER`.
2. For each segment, the model determines whether a directional arrow glyph
   sits *on the line itself* (or terminates a manhole-to-manhole run with a
   directional indicator), not nearby callouts.
3. Returns: `answer ∈ {yes, partial, no}`, with a per-segment bbox list of
   evidence (or absence of evidence).

**Failure modes the tool must guard against:**
- Hallucinating an arrow that isn't there because the prompt suggests one is
  expected.
- Following the *wrong* line (storm sewer or water main instead of sanitary).
- Counting a flow direction shown only on the *profile* sheet but not on
  the plan view.

---

## Example 2 — Adjacent driveways depicted

**Question:**
> "Are adjacent driveways depicted on the site plan?"

**Why generic vision fails:**
Adjacent driveways are sometimes shown as obvious paved aprons but more often
as *very subtle* line work along the property frontage:
- A pair of elongated **U shapes** on the neighboring parcel
- Small **J shapes** indicating curb-return curves
- Two short parallel offsets from the curb line

These features are spatially adjacent to a lot of other line work (curbs,
sidewalks, utilities) and easy to miss or confuse.

**What "correct" looks like:**
1. The model focuses on the area *outside* the project property line, along
   street frontages.
2. It distinguishes driveway curb-return curves from lot-line offsets,
   sidewalk transitions, and other curbside details.
3. Returns presence/absence per frontage, with bboxes of evidence.

**Why this is a good test case for reference images later:**
Driveway curb returns have a small set of recognizable visual patterns. A
curated set of positive/negative example crops (Phase 2) should sharply
improve recall here.

---

## Question taxonomy

The two examples above span several question types. The tool must handle all
of them without a different code path per type:

| Type | Example | Expected answer shape |
|---|---|---|
| **Presence (binary)** | "Is a north arrow shown on the survey sheet?" | yes/no + bbox |
| **Spatial-relationship** | "Are flow arrows *on* the wastewater line (not just nearby)?" | yes/partial/no + per-instance evidence bboxes |
| **Count** | "How many fire hydrants are shown within the project boundary?" | integer + bbox per item |
| **Subtle-pattern recognition** | "Are adjacent driveways depicted along the street frontages?" | yes/partial/no + bbox per frontage |
| **Symbol-vs-legend match** | "Does the symbol used for `existing tree` appear anywhere on the drawing?" | yes/no + bbox of first match |

These all reduce to: *"Look at this drawing region, answer this question,
ground every claim in a bbox."*

---

## Building a fixture set

Capture ~10-20 real (question, sheet) pairs from past completeness-check runs
where the model got it wrong. Each fixture entry:

```jsonc
{
  "id": "ww-flow-arrows-pkw-sheet-c4-1",
  "documentId": "...",
  "sheetNum": "C4-1",
  "question": "Do the wastewater lines have direction-of-flow arrows?",
  "expectedAnswer": "no",                  // human-graded
  "expectedEvidence": [],                   // bboxes of true positives, if any
  "_provenance": { "sourceRun": "...", "checklistItem": "cc-7.md#item-3" }
}
```

Same shape as `measure-distance-tool/replay/fixtures/*.json` — replays via
the `test-script` workflow with no agent loop, so we can iterate on the
script layer cheaply.
