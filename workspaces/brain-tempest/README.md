# Brain Tempest

Brainstorming space for improvements to the Austin `review` workflow
(`bureau/jurisdictions/austin/workflows/review/`), focused on the
`review-runs` step — the ensemble pass that spawns N parallel Haiku agents,
one per (run, checklist grouping) pair.

Reports are numbered. Early reports are research / baseline understanding;
later reports will be proposals and experiments.

## Reports

- [`reports/01-review-runs-execution-model.md`](reports/01-review-runs-execution-model.md) —
  How conductor actually executes the `review-runs` step: agent spawn model,
  prompt assembly, termination, schema validation, retries, observability.
  First-pass research, heavy file:line references.
- [`reports/02-prompt-landscape.md`](reports/02-prompt-landscape.md) —
  The seven prompts in the review workflow and how they fit together.
  Helps scope "improve review-runs" vs. "improve a downstream step."
- [`reports/03-open-questions.md`](reports/03-open-questions.md) —
  Things the baseline research surfaced that are worth probing before we
  commit to any intervention. Entry point for the next iteration.

## Context

- Workflow version: 5.2.0 (as of 2026-04-24)
- Default ensemble: 3 runs × N groupings, `claude-haiku-4-5-20251001`
- `maxWorkers: 30` on `review-runs`, `retries: 5`
- Branch: `feat/brain-tempest` in `winston` repo
