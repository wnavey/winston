# Completeness-Check Variance Testing

Tool + smoke-test artifacts for measuring per-ref variance across the N runs
that the completeness-check workflow already produces when `runs > 1`.

## Why

Completeness-check uses N-run majority voting. The merged comments land in
the database, but the per-run findings (which run voted what) only land in
Supabase Storage at `<run>/output/runs/run-N/findings/cc-*.md.json`, and the
voted aggregate at `<run>/output/consolidated-findings.json`.

The aggregate already carries everything needed to reason about variance
per checklist ref:

```jsonc
{
  "ref": "cc-1:CC-1-01",
  "checklistItemId": "CC-1-01",
  "grouping": "cc-1",
  "status": "pass",          // winning verdict
  "confidence": "high",
  "runCount": 3,             // runs that produced a finding for this ref
  "totalRuns": 3,
  "perRunFindings": [{ "run": 1, "status": "pass", "reasoning": "...", … }, …]
}
```

Two distinct variance signals fall out of this:

1. **Verdict variance** — runs disagree on `pass`/`fail`/`not-applicable`.
   These are the "5-vs-5" refs that the experiment is hunting for.
2. **Detection variance** — `runCount < totalRuns`, meaning some runs didn't
   produce a finding at all. Subtler, but probably more interesting: it's
   the ref the model sometimes forgets to evaluate.

## `variance.py`

Reads a `consolidated-findings.json` and writes:

| File | Contents |
|---|---|
| `variance-per-ref.tsv` | Every ref with its full metric row, sorted by ref |
| `variance-split-refs.tsv` | Only refs where runs disagreed on status, sorted by entropy desc |
| `variance-detection.tsv` | Only refs where `runCount < totalRuns`, sorted by detection rate asc |
| `variance-summary.md` | Human summary: variance-class histogram, per-run pattern histogram, top-25 split refs, detection-variance refs |

Per-ref columns:

| Column | Meaning |
|---|---|
| `ref` / `checklist_item_id` / `grouping` | identity |
| `total_runs` / `run_count` / `missing_runs` / `detection_rate` | how many of the N runs returned a finding |
| `pass` / `fail` / `not_applicable` / `unclear` | counts across runs that reported |
| `winning_status` / `winning_confidence` | post-vote |
| `verdict_entropy` | Shannon entropy in bits over the 4 status buckets (only across runs that reported); 0 = unanimous, 0.918 = 2-vs-1, 1.585 = 3-way split |
| `variance_class` | `unanimous`, `partial-detection`, `split-verdict`, `split-and-partial`, `no-findings` |
| `per_run_pattern` | sorted multiset of statuses, e.g. `fail,pass,pass` |

### Usage

```bash
python3 variance.py <consolidated-findings.json> <out-dir> \
  --review-id <uuid> --label "<human label>"
```

The script depends only on the Python standard library.

## Layout

Per-review artifacts live in `<project>/<review-id>/`:

```
cc-variance-testing/
├── README.md                              (this file)
├── variance.py                            (the analyzer)
└── 1700-S-Lamar/
    └── 6ec3acdf-737b-47b2-8191-49b376ea3404/
        ├── report.md                      (overview analysis — variance classes, focus areas)
        ├── high-variance-items-analysis.md (top-10 split refs, per-run trace deep-dive + hypotheses)
        ├── gap-items-analysis.md          (all 18 detection-variance refs, per-run trace + root cause)
        ├── variance-summary.md            (auto-generated summary)
        ├── variance-per-ref.tsv
        ├── variance-split-refs.tsv
        └── variance-detection.tsv
```

When the runs=10 experiment lands, drop its outputs into a sibling
`<review-id>/` under the same `1700-S-Lamar/` directory (or under a new
project directory if it's run against a different submission).

## Smoke test: 1700 S. Lamar 3-run (2026-04-28)

Three reports cover the smoke run from different angles:
- [`report.md`](1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/report.md) — overview, variance classes, focus areas
- [`high-variance-items-analysis.md`](1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/high-variance-items-analysis.md) — top-10 split refs deep-dived against agent traces
- [`gap-items-analysis.md`](1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/gap-items-analysis.md) — all 18 detection-variance refs and per-item hypotheses
- [`run-2-drift-root-cause.md`](1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/run-2-drift-root-cause.md) — log-traced mechanism: post-compaction StructuredOutput overwrite

Headline numbers (3 runs, 198 refs):

| Class | Count |
|---|---:|
| unanimous | 155 |
| partial-detection | 18 |
| split-verdict | 25 |

The 18 detection-variance refs are **all** in `cc-13` (Architecture
Worksheet). `cc-13` also accounts for 11 of 25 split-verdict refs. That
grouping is the obvious place to look first when running the higher-N
experiment.

## Next: runs=10 experiment

To run the actual variance experiment, trigger completeness-check with
`runs: 10` (configured via `inputs` on the workflow run). Once it
completes, fetch its `consolidated-findings.json` from storage and run
`variance.py` against it. The metric definitions all generalise to N runs.

If this becomes a recurring need, the natural DB shape would be a
`review_run_findings` table keyed by
`(review_id, run_index, checklist_item_id, ref)`, populated from the same
`consolidated-findings.json`. That's strictly Tier-2 work — the script in
this directory covers everything needed for the experiment itself.
