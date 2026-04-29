# inspect-drawing replay fixtures

Captured `(question, sheet)` pairs from prior completeness-check runs, used
to exercise the `inspect-drawing` script layer without paying the agent-loop
cost. Same format as `measure-distance-tool/replay/`, just adapted for
inspect-drawing's input shape.

## Format

```jsonc
{
  "description": "...",
  "source": { /* provenance: project, prior-run id, capture date */ },
  "testCases": [
    {
      "id": "wastewater-flow-arrows-c4-1",   // deterministic label; used in output paths
      "projectId": "23301a8a-...",            // 1700 S. Lamar
      "documentId": "<plan-set UUID>",        // from the project README.md
      "sheetNum": "C4-1",                      // sheet identifier
      "question": "Do the wastewater lines have direction-of-flow arrows on the line itself, not just nearby callouts?",
      "expectedAnswerType": "boolean",         // boolean | count | description
      "cropMode": "drawing",                   // drawing | full-sheet | block:<id>
      "regionHint": null,                      // optional natural-language pointer
      "expectedAnswer": "no",                  // human-graded ground truth (optional)
      "expectedEvidence": [],                   // bboxes for true-positives, if any
      "_provenance": {
        "sourcePriorRun": "review-id-from-prior-cc-run",
        "sourceChecklistItem": "cc-7.md#item-3",
        "captureDate": "2026-04-29",
        "notes": "Why this case was chosen — what the model got wrong before."
      }
    }
  ]
}
```

Fields consumed by `inspect-drawing.ts` when invoked as a script step from
the `test-script` workflow: `projectId`, `documentId`, `sheetNum`,
`question`, `expectedAnswerType`, `cropMode`, `regionHint`.

`expectedAnswer` and `expectedEvidence` are **not** consumed by the tool —
they're hand-graded ground truth used by the debug viewer and any
post-hoc accuracy analysis.

## Running the replay

`test-script` is the existing parallel-replay workflow in bureau (works
for any script that reads CLI args from a fixture JSON). Same
machinery as measure-distance, just point it at this script:

```bash
cd ~/code/controlroom/conductor
npm run conduct -- \
  --workflow=test-script \
  --scriptName=inspect-drawing \
  --testCasesPath=/Users/winston/workspace/winston/workspaces/inspect-drawing-tool/replay/fixtures/1700-s-lamar-starter.json \
  --maxParallel=3 \
  --skip-upload
```

> **TODO** — the `test-script` workflow may need a small tweak to forward
> the inspect-drawing-specific CLI args (`question`, `expectedAnswerType`,
> `cropMode`, `regionHint`). Confirm by reading
> `bureau/jurisdictions/austin/workflows/test-script/workflow.yaml` —
> if it strips unknown args, file a follow-up bureau PR.

## Sourcing test cases

For Phase 1 we manually port failing cases from prior 1700 S. Lamar
completeness-check runs:

1. Find a checklist item from `winston/workspaces/cc-audit/` or
   `winston/workspaces/variance-testing/cc/1700-S-Lamar/` where the
   model's answer was wrong (or where runs disagreed).
2. Identify the underlying drawing-region question — what the model
   *should* have looked for visually. (Many cc items are not
   drawing-region; skip those.)
3. Look up the relevant `documentId` and `sheetNum` from the project
   README.md.
4. Hand-grade `expectedAnswer` and any `expectedEvidence` bboxes.
5. Add an entry to a fixture file in `fixtures/`.

Aim for ~10–20 cases for the Phase 1 fixture set, weighted toward the
question types in `motivating-examples.md` (boolean, count, subtle pattern).

## Files

| File | Purpose |
|---|---|
| `fixtures/1700-s-lamar-starter.json` | **Template** — two motivating examples, project ID populated, document/sheet TBD. Copy and extend. |
