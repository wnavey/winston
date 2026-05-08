# source-runs/

Canonical home for the **active** source run feeding each phase-1 metrics
bucket. One bucket = one variant of one experiment set. Six buckets total:

```
source-runs/
  cc/
    ctrl/      # generic vision only (production prompt)
    var-1/     # vision + inspect-drawing exposed directly (bifurcated)
    var-2/     # vision_check only (classifier-routed)
  el-md-exp/
    ctrl/
    var-1/
    var-2/
```

Each variant directory contains:

- `output/` — workflow output exactly as written to Supabase storage
  (findings per run, vision-check-calls / inspect-drawing-calls /
  measure-distance-calls metadata, vision-log, consolidated reports).
- `logs/` — conductor logs from the run.
- `workflow/` — snapshot of the bureau workflow definition that ran
  (workflow.yaml, prompts/, schemas/, scripts/, experiments/ overlays).
  Useful for inspecting which prompt version the agent saw.
- `run-metadata.json` — pinned identifiers for this run: `runLabel`,
  `workflow_runs.id`, `review_id`, Inngest event id, started/completed
  timestamps, submission, runs, agent tools, flags, bureau/conductor
  commit context, link to the metrics TSV.

## Replacement convention

When a source run is replaced (better data, retired confounder, etc.):

1. Wipe the existing `output/` `logs/` `workflow/` and replace with the
   new run's artifacts.
2. Update `run-metadata.json` with the new run's identifiers.
3. Re-run the bucket's `metrics/<set>/<variant>/scripts/build.py` +
   `aggregate.py` to refresh the TSVs.
4. Update `../metrics/source-runs.json` + `../metrics/source-runs.md`
   with the new IDs and `supersedes` block pointing at the prior run.
5. Update `../metrics/analysis.md` if the headline numbers shift.

**Don't keep prior runs alongside.** If you need historical comparison
data, the run-metadata.json `supersedes` block records the prior run's
`workflow_runs.id` and `review_id` — those rows still live in Supabase
and the storage bucket can be re-pulled if needed.

## Mapping to the metrics framework

The metrics build scripts consume these directories. Each variant's
`build.py` reads from its corresponding `source-runs/<set>/<variant>/`
and writes per-item-run.tsv + per-item.tsv into
`../metrics/<set>/<variant-with-descriptive-suffix>/`.

| Source-run dir | Metrics dir |
|---|---|
| `cc/ctrl/` | `metrics/cc/ctrl-baseline-vision-invocation/` |
| `cc/var-1/` | `metrics/cc/var1-bifurcated-vision-tools/` |
| `cc/var-2/` | `metrics/cc/var2-vision-specialist-routing/` |
| `el-md-exp/ctrl/` | `metrics/el-md-exp/ctrl-baseline-vision-invocation/` |
| `el-md-exp/var-1/` | `metrics/el-md-exp/var1-bifurcated-vision-tools/` |
| `el-md-exp/var-2/` | `metrics/el-md-exp/var2-vision-specialist-routing/` |

The descriptive suffix on the metrics side is intentional — those
directory names appear in TSV documentation and analysis prose. The
short `var-N` form on the source-runs side is for terse paths.

## Inspecting a run

For a quick high-level view: read `run-metadata.json`.

For deep inspection of agent ↔ tool interactions:

- **All variants:** `output/runs/run-N/findings/<grouping>.md.json` —
  per-finding `agentTrace.{observation, reasoning, tools_used}` when
  `logAllAgentTrace=true` is set.
- **var-2 (vision_check):** `output/vision-check-calls/<callId>/metadata.json`
  — per-call classifier intent, dispatch outcome, fallback reason.
- **var-1 (cc, inspect-drawing):** `output/inspect-drawing-calls/<callId>/`
  — per-call cropped.jpg, prompt.txt, response.txt, metadata.json.
- **var-1 (review, measure-distance):** would write to
  `output/measure-distance-calls/<callId>/` if the agent invoked the
  specialist. In `el-md-exp/var-1/`, the agent never reached for
  measure-distance, so this directory doesn't exist.
