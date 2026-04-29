# Phase 1 Experiment 1 — Unrelated Workflow Failures (2026-04-29)

The first dispatcher-side run of the inspect-drawing experiment ended with
`status=failed`. The failure was **not caused by inspect-drawing**, but the
review step exhausted retries on three items, which short-circuited the
workflow before downstream consolidation could run. This document records
those failures so we can address them separately and so future runs aren't
re-discovered cold.

For the inspect-drawing-specific bug surfaced by the same run (and its
fix), see [noetic-inc/bureau#284](https://github.com/noetic-inc/bureau/pull/284).

## Run metadata

| Field | Value |
|---|---|
| Inngest workflow run ID | `01KQD8SEKXKY8X5R5BVCNTTCD1` |
| Postgres `workflow_runs.id` | `b540f383-3af8-4688-9055-3ce2136acd81` |
| Storage path | `workflow-runs/completeness-check/23301a8a-…/2026-04-29-201221/` |
| Project | 1700 S. Lamar (`23301a8a-4cdb-4751-ac0c-93b97f0f5c12`) |
| Submission version | v2 (`eb67ee21-76b1-4065-b20d-c32f674add12`) |
| Checklist version | `v2.5-trimmed` |
| Runs | 5 |
| Experiment overlay | `--experiment=inspect-drawing` |
| Wall time | ~1h 30min (18:42 → 20:12 UTC) |
| Final status | `failed` — *Step 'review' failed: 3 items failed* |

## Where the workflow halted

Conductor short-circuits the workflow when any item exceeds its retry
budget (`retries: 2` per `workflow.yaml`). Even though **62 of 65** (item ×
run) cells produced findings, the 3 missing cells killed the pipeline
before consolidation could run. Confirmed in two ways:

1. `workflow_runs.results` is `null`; only `error` is populated.
2. The `output/` storage tree has only what the `review` step wrote
   (`output/runs/<run-N>/findings/*.json`, `output/inspect-drawing-calls/`,
   `output/vision-log.jsonl`, `output/semantic-search-blocks.json`).
   Files we'd expect from later steps are absent:
   - `output/findings/cc-*.json` (from `cross-run-consolidate-cc`)
   - `output/enriched-findings.json`, `output/consolidated-findings.json` (from `enrich-findings`)
   - `output/rephrased-items.json` (from `format-reports`)
   - `output/review-comments.json` (from `build-review-comments`)

So this isn't a small papercut — even a perfect inspect-drawing run will
not produce a complete review-comments output until those 3 failure modes
are mitigated.

## Findings present per run

| Run | Findings | Missing |
|---|---|---|
| run-1 | 12 / 13 | `cc-3.md` |
| run-2 | 13 / 13 | — |
| run-3 | 13 / 13 | — |
| run-4 | 11 / 13 | `cc-1.md`, `cc-19.md` |
| run-5 | 13 / 13 | — |

## Failure breakdown

### cc-1.md / run-4 — `vision` tool, supplementary-document IDs

Agent invoked `vision` four times in succession, each with a different
ID that turned out to be a **`document.id`** (supplementary doc) rather
than a `plan_set.id`. Vision only handles plan_sets and threw the same
error each time:

```
No plan set version found for plan_set_id: <id>
@ getFileContent (/vercel/sandbox/src/tools/vision/index.ts:100)
```

The four IDs the agent tried (all are real `document` rows for this
submission, none are `plan_set` rows):

| ID | Kind |
|---|---|
| `777f2782-6933-4af3-8010-e26c52311541` | document (supplementary) |
| `dd5b866a-144e-457d-8bc3-fbf523e3d3cb` | document |
| `ca527d05-4b8e-4723-9fb5-d6ad29965e35` | document |
| `584f1bed-eac2-491c-a064-3f7af56c6f32` | document |

Initial attempt + 2 retries = exhausted. Item failed permanently for
run-4.

**This is a pre-existing issue with the `vision` tool**, not anything
introduced by the experiment overlay. `vision` advertises support for
both `plan_set.id` (sheets) and `document.id` (supplementary docs)
internally, but the failure path here threw rather than branching on
which kind of ID was passed.

### cc-3.md / run-1 — `error_max_structured_output_retries`

No tool error. The model produced JSON that failed schema validation:

```
Output does not match required schema:
  root: must have required property 'grouping'
  /findings: must be array
```

Conductor retried StructuredOutput up to its limit, then gave up.
377 log lines, no `level: 50` entries — purely an agent/model
conformance issue.

### cc-19.md / run-4 — same shape as cc-3 / run-1

15 successive `tool_result is_error=True` entries with the same schema
violation, 22 turns, ~$1.00 spent before exhausting retries:

```
Output does not match required schema:
  root: must have required property 'grouping', /findings: must be array
```

Final result: `error_max_structured_output_retries`.

## Why none of these are caused by inspect-drawing

Across 5 runs × 13 grouping files = **65 agent sessions**, the agent
invoked `run_inspect_drawing` exactly **once** (cc-13 / run-4 / sheet
19, asking about wastewater flow arrows). That single call did fail
(see bureau#284), but:

- The script subprocess exited 1.
- `createScriptTool` returns script errors to the agent as a tool
  result rather than throwing, so the agent recovered and continued.
- **cc-13 / run-4 produced its finding successfully** — it's not in the
  missing-findings list above.

So the failed grouping cell where the only inspect-drawing call lived
was *not* one of the 3 that caused the workflow to fail.

## Recommended follow-ups

| Severity | Item | Action |
|---|---|---|
| **High** | Vision rejects `document.id` (cc-1) | Fix in `conductor/src/tools/vision/index.ts:100` — branch on whether the ID resolves to `plan_set` or `document` and route accordingly. Alternatively, sharpen the prompt so agents don't pass `document.id` to vision for sheet questions. Affects every cc run, not just this experiment. |
| **High** | Schema retries exhaust on `grouping` field (cc-3, cc-19) | Investigate why the model omits `grouping`. Hypotheses: (a) Sonnet 4.5 regression on long-context structured output; (b) the schema's required fields aren't reflected in the prompt; (c) deeply-nested findings push the model toward a degraded format. Probably warrants reproducing on a single grouping in isolation. |
| **Medium** | `retries: 2` is fragile under transient AI Gateway flakes | Consider bumping to `retries: 3` for the cc workflow, or scoping the increase to `--experiment=*` runs. The vision-tool gateway flakes (cc-5, cc-24) recovered within 2 retries this time, but we shouldn't count on that. |
| **Low** | Workflow halts with no consolidation when even one item exceeds retries | Long-term, consider whether `cross-run-consolidate-cc` should run on partial input — `runs=5` is meant to absorb single-run failures via majority vote, but it can't if it never runs. Out of scope for the experiment, but worth flagging. |

## Practical implication for the next run

Until the **High**-severity issues are mitigated, even with bureau#284
landed we shouldn't expect a fully-completed run. Two paths forward:

- **A. Tolerate.** Run the experiment, inspect what we got, accept the
  workflow status will say `failed`. The signals we care about — *did
  the agent invoke inspect-drawing more often? what did the cropped
  images look like? did the structured outputs make sense?* — are all
  observable from the per-call artifacts under
  `output/inspect-drawing-calls/`. The downstream `review-comments.json`
  is not the analysis target.
- **B. Mitigate first.** Bump retries, fix vision's document-id
  handling, and investigate the schema-validation failure. Slower; gives
  a clean baseline for future comparisons.

Recommend **A** for the immediate next run after bureau#284 lands. The
"how often does the agent reach for inspect-drawing?" question is
independent of pipeline completion.

## Pointers

- Run artifacts (gitignored, local pull):
  `winston/workspaces/inspect-drawing-tool/runs/2026-04-29-201221/`
- Pull script: `scripts/pull-run.py --datetime=2026-04-29-201221`
- Error log: `runs/2026-04-29-201221/logs/completeness-check-error.log`
- Full agent log (58 MB): `runs/2026-04-29-201221/logs/completeness-check.log`
- Inspect-drawing fix PR: [noetic-inc/bureau#284](https://github.com/noetic-inc/bureau/pull/284)
