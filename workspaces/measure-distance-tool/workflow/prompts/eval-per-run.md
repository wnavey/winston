# Per-Run Review Evaluation

You are evaluating whether a SINGLE independent review run caught each required issue from the city's comments.

## Inputs

* **Flagged findings:** `{{ WORKSPACE_PATH }}/output/runs/{{ checklistItem }}/flagged-findings.json` — findings from a single independent review run
* **Atomic city issues:** `{{ WORKSPACE_PATH }}/atomic-mcr.json`

### Flagged Findings Format

This file contains findings where the review run flagged an issue (status `fail` or `unclear`). Each entry is a single finding from one review pass.

```json
[
  {
    "ref": "de-27:27-01",
    "status": "fail",
    "comment": "The review comment text",
    "evidence": "What the agent found and why it flagged this",
    "sheetReferences": ["Sheet 9", "Sheet 34"],
    "documentReferences": ["Consolidated Site Plan Application"]
  }
]
```

### Atomic MCR Format

```json
{
  "departments": {
    "de": {
      "atomic_issues": [
        {
          "atomic_issue_id": "de-5-1",
          "requirement": "Show drainage easements on plan",
          "severity": "required",
          "match_criteria": {
            "must_identify": "Core concept the agent must identify",
            "must_reference_location": "Where in the plan this applies",
            "acceptable_code_refs": ["Code refs that count"],
            "code_citation_required": false,
            "acceptable_variations": ["Synonyms that count"]
          }
        }
      ]
    }
  }
}
```

## Procedure

### Step 1: Load Both Files

1. Read `{{ WORKSPACE_PATH }}/output/runs/{{ checklistItem }}/flagged-findings.json` — this is a flat array of flagged findings from a single run
2. Read `{{ WORKSPACE_PATH }}/atomic-mcr.json` — filter to discipline `{{ input.guideCode }}`, keep only `severity: "required"` issues. Note: the atomic-mcr.json file uses `departments` as its top-level key (external format unchanged), so look up `departments["{{ input.guideCode }}"]`.

### Step 2: Evaluate Each Required Issue

For each required atomic issue, search the flagged findings for a match.

Use the `match_criteria` from the atomic issue:

**Mark as caught (`true`) if** any finding:
- Identifies the same core problem described in `must_identify` (synonyms and rephrasings are fine — but the finding must address the *specific* deficiency, not merely mention the general topic area)
- References the correct general area per `must_reference_location`
- Has an acceptable code citation per `acceptable_code_refs`, or `code_citation_required` is false

**Mark as not caught (`false`) if:**
- No finding addresses this specific issue
- Findings touch the general topic but miss the specific deficiency

**Confidence:**
- `high`: Clear yes or no, no ambiguity
- `medium`: Judgment call, partial match
- `low`: Could go either way, needs human review

### Step 3: Return Your Evaluations

Return your evaluations as structured output. Include `discipline` (the discipline code, e.g. "de") and `discipline_name` (the full name, e.g. "Drainage Engineering"), plus one entry per required atomic issue with all required fields (`atomic_issue_id`, `caught`, `finding_ref`, `evidence`, `confidence`).

## Guidelines

- This is binary: caught or not caught. No partial credit.
- Use `match_criteria` as the standard — not your own judgment of what "should" count.
- Always quote specific evidence when marking as caught.
- When uncertain, lean toward `false` with `medium` confidence rather than a generous `true`.
