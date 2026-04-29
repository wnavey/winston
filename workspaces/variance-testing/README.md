# Variance Testing

Tooling and per-review artifacts for measuring per-ref variance across the N
runs that conductor workflows produce when `runs > 1`. Works for two
workflows today:

- **completeness-check** — see [`cc/`](./cc/) (1700 S. Lamar smoke test, 3 runs)
- **review** — see [`review/`](./review/) (Valley View Townhomes el-md-exp, 5 runs)

Both workflows emit `output/runs/run-N/findings/<grouping>.md.json` per run
plus a merged `output/consolidated-findings.json`. The merged file already
carries everything needed to reason about variance per ref.

## What variance.py measures

Two distinct variance signals fall out of the merged file:

1. **Verdict variance** — runs disagree on `status` (e.g., `pass`/`fail`,
   or `fail`/`not-verifiable`).
2. **Detection variance** — `runCount < totalRuns`, meaning some runs
   didn't produce a finding at all. In the completeness-check workflow this
   is rare and usually a harness symptom; in the review workflow it's the
   *dominant* signal because runs only emit findings for issues they detect.

`variance.py` auto-detects:
- whether per-run findings are under `perRunFindings` (cc) or `findings` (review)
- the status set (e.g. `{pass, fail, not-applicable, unclear}` for cc,
  `{fail, not-verifiable}` for review)
- `grouping` and `checklist_item_id` from `ref` when not present on the entry

It writes:

| File | Contents |
|---|---|
| `variance-per-ref.tsv` | Every ref with its full metric row, sorted by ref |
| `variance-split-refs.tsv` | Only refs where runs disagreed on status |
| `variance-detection.tsv` | Only refs where `runCount < totalRuns` |
| `variance-summary.md` | Auto-generated summary |

Per-ref columns:

| Column | Meaning |
|---|---|
| `ref` / `checklist_item_id` / `grouping` | identity (grouping/item derived from `ref` when not in source) |
| `total_runs` / `run_count` / `missing_runs` / `detection_rate` | how many of the N runs returned a finding |
| `count_<status>` | one column per distinct status seen across the dataset |
| `winning_status` / `winning_confidence` | post-vote |
| `verdict_entropy` | Shannon entropy in bits over the discovered status buckets, only across runs that reported. 0 = unanimous, 0.918 = 2-vs-1, 1.585 = 3-way |
| `variance_class` | `unanimous`, `partial-detection`, `split-verdict`, `split-and-partial`, `no-findings` |
| `per_run_pattern` | sorted multiset of statuses, e.g. `fail,fail,not-verifiable` |

### Usage

```bash
python3 variance.py <consolidated-findings.json> <out-dir> \
  --review-id <uuid> --label "<human label>"
```

Stdlib only.

## Layout

Per-review artifacts live under a workflow-kind directory:

```
variance-testing/
├── README.md                                   (this file)
├── variance.py                                 (the analyzer — shared)
├── cc/
│   └── <project-name>/
│       └── <review-id>/
│           ├── report.md
│           ├── high-variance-items-analysis.md
│           ├── gap-items-analysis.md
│           ├── run-2-drift-root-cause.md
│           ├── variance-summary.md
│           ├── variance-per-ref.tsv
│           ├── variance-split-refs.tsv
│           └── variance-detection.tsv
└── review/
    └── <project-name>/
        └── <review-id>/
            └── (same shape)
```

## Smoke tests in this workspace

### cc — 1700 S. Lamar 3-run (2026-04-28)

[`cc/1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/`](cc/1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/)

3 runs, 198 refs:

| Class | Count |
|---|---:|
| unanimous | 155 |
| partial-detection | 18 |
| split-verdict | 25 |

Headline finding: detection variance was a deterministic harness bug, not
model nondeterminism. See `run-2-drift-root-cause.md`. Tracked in beads
`workspace-925`.

### cc — 1700 S. Lamar runs=10 baseline (2026-04-28)

[`cc/1700-S-Lamar/24f98e83-282e-48c4-bae2-767e454810a5/`](cc/1700-S-Lamar/24f98e83-282e-48c4-bae2-767e454810a5/)

Same project + checklist version as the 3-run; bumped `runs=10` (no code
changes) to estimate the cc-13 drift recurrence rate.

10 runs, 185 refs:

| Class | Count |
|---|---:|
| unanimous | 139 |
| partial-detection | 0 |
| split-verdict | 46 |

**Drift did not recur.** 0 of 10 runs hit the cc-13 detection drift
(vs 1 of 3 in the prior baseline). Compaction events: 0/130 tasks. The
3-run drift was a low-probability event amplified by compaction, not a
deterministic bug. Three of the 25 split-verdict refs from the 3-run
flipped winning verdict at 10 runs, confirming run-2's prior drift had
been distorting merged outputs.

### review — Valley View Townhomes 5-run el-md-exp (2026-04-28)

[`review/Valley-View-Townhomes/3509b097-764e-4962-b023-8d8ae8fd7a4c/`](review/Valley-View-Townhomes/3509b097-764e-4962-b023-8d8ae8fd7a4c/)

5 runs, 84 refs, model `claude-haiku-4-5`, `logAllAgentTrace=true`:

| Class | Count |
|---|---:|
| unanimous | 2 |
| partial-detection | 61 |
| split-verdict | 9 |
| split-and-partial | 12 |

Detection variance dominates (73% of refs). This is structurally different
from cc: the review workflow has each run *discover* issues rather than
evaluate a fixed checklist, so divergent issue sets across runs are
expected. The interesting questions are which refs are 5/5 (real
high-confidence issues) vs 1/5 (likely-false-positive single-run flags).

## On running new variance experiments

For both workflows, the workflow's `inputs.runs` controls N. Bump it,
trigger the workflow, fetch the `consolidated-findings.json`, point
`variance.py` at it. Outputs scale to N transparently.

If variance analysis becomes a recurring need at the team level, the
natural DB shape is a `review_run_findings` table keyed by
`(review_id, run_index, ref)`. Tracked indirectly in `TODO.md` /
`workspace-925` (the inspector-general extension).
