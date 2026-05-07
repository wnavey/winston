# Metrics framework — iter 1

**Status:** 2026-05-07 reorientation. Supersedes the looser "headline recall +
routing accuracy" framing in [`plan.md`](./plan.md). Folds the eval
strategy into a clean 3-variant × 4-TSV × 2-set table so future runs +
analyses align without ambiguity.

## What we're proving

Iter 1's only job is to prove the **vision_check routing architecture
(var2) matches or beats the bifurcated-tools architecture (var1) on
invocation hit rate**. Specialist execution accuracy (does the call
return a correct answer) is downstream and explicitly out of scope here.

Two success criteria, both var2 ≥ var1:

- **A — Overall invocation hit rate.** Of checklist items expected to
  need vision, what fraction got at least one vision call?
- **B — Specialist selection rate.** Of items expected to route to a
  specialist, what fraction got the right specialist invocation?

## The three variants

Each variant is defined by the tools the top-level agent has access to.
Specialists themselves are unchanged across variants — what varies is
which the agent can pick.

| Variant | Top-level agent tools | Notes |
|---|---|---|
| **`ctrl-baseline`** | generic `vision` only | Production prompt. No specialists exposed. |
| **`var1-bifurcated-vision-tools`** | generic `vision` + workflow specialist | cc adds `inspect-drawing`; review adds `measure-distance`. Agent picks. |
| **`var2-vision-specialist-routing`** | `vision_check` only | Agent calls vision_check; internal classifier dispatches to generic / specialist. |

> Naming guard: don't call var1 "the baseline." var1 is bifurcated.
> ctrl-baseline is the control. The historical "experiment-run7" /
> "inspect-drawing run1" runs that earlier docs called "baseline" are
> var1 data.

## The two experiment sets

| Set | Workflow | checklistVersion / guideCode | Specialist | Submission |
|---|---|---|---|---|
| **cc** | completeness-check | `v2.5-trimmed` | `inspect-drawing` | 1700 S. Lamar v2 |
| **el-md-exp** | review | `el-md-exp` | `measure-distance` | Valley View Townhomes v2 |

Each set runs all three variants on the same submission so cross-variant
comparison is apples-to-apples.

## The 4 TSVs per set (8 total)

All 4 share the same per-checklist-item key. TSVs 2–4 join 1:1 against
TSV #1 so ctrl / var1 / var2 are directly comparable per item.

### TSV 1 — `expected-vision-selection` (static ground truth)

One row per checklist item. Schema:

| Column | Type | Notes |
|---|---|---|
| `item_id` | string | Stable checklist item key (e.g. `AW-21`, `cc-13-05`). |
| `item_text` | string | Full checklist text. |
| `expected_vision` | yes \| no | Should this item produce any vision call? |
| `expected_specialist` | none \| generic \| inspect-drawing \| measure-distance | If yes: which specialist? `generic` = vision call expected but not specialist-routed. `none` only when `expected_vision=no`. |
| `notes` | string | Free-form (e.g. "compound — has both measurement and drawing-inspect components"). |

Built by lifting + normalizing existing classifications:
- cc → `../cc-vision-classification/cc-classification.tsv`
- el-md-exp → `../measure-distance-tool/analysis/guides/el-md-exp/item-classification.json`

Updated only when the checklist content itself changes.

### TSVs 2–4 — invocation hit rate per variant (long format)

One row per (item × run). Schema:

| Column | Type | Notes |
|---|---|---|
| `item_id` | string | Joins to TSV 1. |
| `run_index` | int | 1-based. Different variants may have different total run counts; long format absorbs that. |
| `run_label` | string | Source run identifier (e.g. `VISION_CHECK_CC_BASELINE`) for traceability. |
| `tool_called` | none \| generic-vision \| inspect-drawing \| measure-distance \| vision-check-generic \| vision-check-inspect-drawing \| vision-check-measure-distance | What the agent actually invoked for this item in this run. `none` = no vision call attributed to this item. |
| `call_count` | int | Number of distinct vision calls attributed to this item in this run. ≥0. |
| `notes` | string | Optional flags ("multi-call", "fallback", etc.). |

The `tool_called` enum collapses 3 cases:
- ctrl: `none` or `generic-vision`.
- var1: `none`, `generic-vision`, or `<specialist>`.
- var2: `none`, `vision-check-generic`, or `vision-check-<specialist>`.

This keeps a single column shape across all 3 variants, with the
`vision-check-*` prefix marking that the call went through the router.

> **TSV 2 prompt-capture deferred.** The baseline `vision` tool currently
> logs only `{event, documentId, sheetNum, success, timestamp}` — no
> prompt, no per-call checklist item attribution. We can still derive
> "did vision get called for this item" from the agent trace +
> `applicableChecklistItems`. Prompt-level analysis stays a TODO; iter-1
> hit-rate proof doesn't need it.

## How the TSVs answer A and B

- **A** (overall hit rate, per variant) = `(# (item × run) cells where tool_called != "none") / (# (item × run) cells where TSV 1 says expected_vision = yes)`.
  Computed for ctrl, var1, var2 independently. Need var2 ≥ var1.
- **B** (specialist selection rate, per variant) = `(# (item × run) cells where tool_called matches TSV 1's expected_specialist) / (# (item × run) cells where TSV 1 says expected_specialist != none and != generic)`.
  Computed for var1 and var2. Need var2 ≥ var1.

For B, the `vision-check-<specialist>` cases count as matching the
specialist (the routing path is irrelevant to the selection question).

## Storage layout

```
metrics/
  cc/
    expected-vision-selection/
      expected.tsv
      source.md            # which classification got lifted, normalization notes
    ctrl-baseline-vision-invocation/
      runs.md              # source runs (run IDs, labels, dates) feeding this variant
      per-item-run.tsv     # the long-format TSV described above
      scripts/             # analysis scripts that produced per-item-run.tsv
    var1-bifurcated-vision-tools/
      runs.md
      per-item-run.tsv
      scripts/
    var2-vision-specialist-routing/
      runs.md
      per-item-run.tsv
      scripts/
  el-md-exp/
    ...same structure...
  analysis.md              # cross-variant A/B writeup; populated once all 8 TSVs land
```

> Open: `metrics/` at workspace root vs `experiments/metrics/`. Pending
> confirmation.

Raw artifacts (per-call metadata.json, etc.) continue to live under
`experiments/<run-dir>/<set>/output/`. The metrics scripts read from
those raw paths and emit the per-item-run.tsv summaries above.

## Open items

1. **`metrics/` placement** — workspace root or under `experiments/`?
2. **Run sourcing per cell.** Pending data inventory:
   - ctrl cc: `VISION_CHECK_CC_BASELINE` (done) — usable
   - ctrl el-md-exp: `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V2` (done; agent-trace silently failed) — usable for hit-rate but limited
   - var1 cc: historical `inspect-drawing run1` lives in `winston/workspaces/measure-distance-tool/...` and needs locating + sanity-check
   - var1 el-md-exp: historical `experiment-run7` / `7.2` (had measure-distance overlay; same submission)
   - var2 cc: `VISION_CHECK_CC_RUN_4` (latest, runs=1, post-prompt-trim) — newest, likely usable
   - var2 el-md-exp: `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_1` (smoke, pre-bureau#310) — likely needs re-fire
   The run-sourcing inventory + clean/dirty assessment is the next
   conversation. Re-firing for clean conditions is acceptable if the
   existing data has confounds we can't argue past.

## Locked-in decisions (2026-05-07)

- 3 variants named `ctrl-baseline` / `var1-bifurcated-vision-tools` / `var2-vision-specialist-routing`.
- 4 TSVs per set: `expected-vision-selection` (static, 1 per set) + per-(item × run) hit rate TSV per variant (3 per set). 8 TSVs total.
- Long format for variant TSVs (item × run rows, single file per variant).
- TSV 1 lifted + normalized from existing classifications, not re-LLM-built.
- TSV 2 ships without per-call prompts; prompt capture stays an open TODO.
- Goals A (overall hit rate) and B (specialist selection rate). var2 ≥ var1.
- Specialist execution accuracy explicitly out of scope for iter 1.

## Related

- [`plan.md`](./plan.md) — original design + decisions log + phase plan.
- [`README.md`](./README.md) — workspace orientation.
- [`problem-statement.md`](./problem-statement.md) — original hit-rate
  motivation (note: numbers there are var1 specialist-recall, not
  cross-variant hit rate; will be re-derived once the TSV pipeline is
  in place).
