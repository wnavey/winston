# 02 — Prompt Landscape

The review workflow has **7 prompts**. Knowing where each sits helps us
avoid mis-scoping improvements ("improve review-runs" vs. "improve
synthesis"). Line counts reflect token-weight roughly.

| Prompt | Step(s) | Lines | Model | Purpose |
|---|---|---:|---|---|
| `review.md` | `review-runs` | 165 | Haiku 4.5 (ensemble) | Per grouping: evaluate each checklist item, return fail/not-verifiable findings with evidence. The only prompt in the ensemble. |
| `eval-per-run.md` | `evaluate-per-run` (opt) | 88 | Opus 4.6 | Score one run's findings against atomic MCR ground truth. Recall/precision judgment. |
| `synthesize-simplified.md` | `synthesize-comments` / `synthesize-new-comments` | 355 | Haiku 4.5 | Turn clusters of per-run findings (from consolidation) into flat, polished comments per grouping. Largest prompt in the pipeline. |
| `synthesize.md` (legacy) | — | — | — | Pre-simplified variant. Not wired into current workflow.yaml. |
| `organize-sections-simplified.md` | `organize-sections-simplified` | 62 | Haiku 4.5 | Assign synthesized comments to report sections with labels/summaries. |
| `organize-sections.md` (legacy) | — | 47 | — | Older section-organizer, superseded. |
| `structure-comments.md` (legacy) | — | 287 | — | Older pre-simplified structuring pass. Not wired. |
| `rewrite-re-review-comments.md` | `rewrite-re-review-comments` (re-review path) | 109 | Haiku 4.5 | Rewrite prior comments based on resolved/outstanding state from comparison. |

## Pipeline topology

```
review-runs (N × M Haiku agents, review.md)
  → cross-run-consolidate (TS script, no LLM)
    → split-by-grouping (TS script)
      → synthesize-comments (M Haiku agents, synthesize-simplified.md)
        → build-simplified-manifest (TS script)
          → organize-sections-simplified (1 Haiku agent)
            → merge-simplified-comments (TS script → review-comments.json)
```

Re-review path forks after `cross-run-consolidate`:
```
cross-run-consolidate
  → compare-prior-review (TS) → split-new-findings (TS)
    → synthesize-new-comments + rewrite-re-review-comments (parallel Haiku agents)
      → assemble-re-review (TS → review-comments.json)
```

Eval path (if `eval: true`):
```
parallel to synthesize path:
  download-atomic-mcr (TS)
    → evaluate-per-run (N Opus 4.6 agents, eval-per-run.md)
      → merge-and-score-evals (TS → scoring.json)
```

## Observations for scoping Brain Tempest

- **`review.md` is the only prompt that does site-plan reasoning**. Every
  downstream prompt operates on structured findings, not the plan itself.
  So "improving review accuracy" ≈ "improving review.md + its context".
- **355-line `synthesize-simplified.md` is the biggest single LLM call**
  in the non-ensemble part of the pipeline. If output quality complaints
  are about comment *wording*, that's where to look, not `review.md`.
- **Two legacy prompts still on disk** (`synthesize.md`-era,
  `structure-comments.md`, `organize-sections.md`). Worth confirming they
  aren't loaded anywhere (grep says no) before proposing deletion.
- **Eval uses Opus 4.6, everything else Haiku 4.5.** Eval cost scales
  linearly with `runs`; already the most expensive step when enabled.
- **No prompt is shared across workflows.** All seven are Austin-scoped,
  under `jurisdictions/austin/`. A "brain tempest" idea about prompt
  reuse across jurisdictions would need to touch the workflow schema.

## Schema shape of `review-runs` output (review.schema.json)

```
{
  grouping: "4",
  findings: [
    {
      deficiencyId: "16-02",
      status: "fail" | "not-verifiable",
      codeCitations: ["DCM 5.2.0"],
      applicableAreas: ["pond plan"],
      sheetReferences: [{documentId, sheetNumber}],
      documentReferences: [{documentId, label}],
      comment: "..."
    }
  ]
}
```

Pass/n-a items are intentionally omitted. That means consolidation has
no way to tell "3 runs all agreed this was pass" from "3 runs all forgot
to look at it" — both show up as empty. Worth keeping in mind for any
confidence-tier proposals.
