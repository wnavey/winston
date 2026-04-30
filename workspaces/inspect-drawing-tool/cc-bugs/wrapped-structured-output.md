# Wrapped Structured Output Bug

The completeness-check `review` step exhausts StructuredOutput retries on
specific items because the agent commits to a **wrapped output shape** and
can't recover from it. This is not an inspect-drawing tool bug — the tool
is never invoked in some of the affected items — but it surfaces only
under the inspect-drawing experiment overlay so far.

## TL;DR

The cc schema requires:

```jsonc
{
  "grouping": "cc-13",      // string
  "findings": [...],        // array
  "summary": "..."          // string
}
```

The agent's first attempt produces:

```jsonc
{
  "findings": [...]         // findings array, but no `grouping` at root
}
```

Schema validator: *root: must have required property 'grouping'.*

The agent then "fixes" by wrapping the entire thing in another `findings`
object instead of adding `grouping` at the root:

```jsonc
{
  "findings": {             // ← outer findings, schema rejects (must be array)
    "grouping": "cc-13",
    "findings": [...],
    "summary": "..."
  }
}
```

Schema validator: *root: must have required property 'grouping'; /findings:
must be array.*

The agent stays in this wrapped pattern for the remaining 14 retries.
Conductor gives up with `error_max_structured_output_retries`, the item
fails, the workflow halts at the `review` step before downstream
consolidation can run.

## Evidence

Captured from two consecutive `--experiment=inspect-drawing` runs against
1700 S. Lamar submission v2, runs=5, checklist v2.5-trimmed:

| Case | Attempt 1 root keys | Attempt 1 findings type | Attempts 2-15 |
|---|---|---|---|
| `2026-04-29-201221 / cc-3 / run-1`  | `['findings']` | list (correct shape, missing `grouping`) | wrapped — `findings` becomes object |
| `2026-04-29-201221 / cc-19 / run-4` | `['findings']` | list | wrapped |
| `2026-04-29-232527 / cc-24 / run-1` | `['findings']` | list | wrapped |
| `2026-04-29-232527 / cc-13 / run-4` | `['findings']` | list | wrapped |

All 4 cases: 15 StructuredOutput attempts, 15 schema rejections, final
result `error_max_structured_output_retries`. Cost per failed item:
$1.48-$2.17. Wall time 36-40 turns.

Per-attempt progressions: see `cases/<id>/progression.json`.
First + last full JSON outputs: see `cases/<id>/first-attempt.json`,
`cases/<id>/last-attempt.json`.

## Why isn't this seen in baseline runs?

8 prior completeness-check runs against this submission and checklist
(some with `runs=10`) all completed cleanly. Two settings differ in the
experiment runs:

1. **Prompt is longer** — `experiments/inspect-drawing/review.md` adds a
   ~13-bullet "Using the Inspect-Drawing Tool" section to the baseline
   `prompts/review.md`. That section describes structured output shapes
   for inspect-drawing (`answerText`, `classification`, `count`,
   `evidence: [...]`, etc.) — patterns the model could be confusing with
   cc's own shape when it tries to recover from the missing-`grouping`
   error.
2. **Tool registry is larger** — `script:inspect-drawing` joins `vision`
   and `script:semantic-search-blocks` in the agent's MCP tool list. Each
   tool announces its own structured-output shapes through the MCP
   handshake.

Either or both could be reducing the model's "attention budget" for the
cc schema. Critically: the model **doesn't have to actually invoke
inspect-drawing** for this to manifest — in the second experiment run
(`2026-04-29-232527`) the tool wasn't invoked at all, yet the same
failure pattern fired on cc-24/run-1 and cc-13/run-4.

We've gone from "very rare" (0/130 schema fails in the runs=10 baseline
per the variance-testing report) to "consistent" (4 fails across 5+5
agent×run cells in two experiment runs). Either:

- **Hypothesis A — context pressure** is the operative variable: the
  longer experiment prompt + extra tool in the registry pushes the model
  past a recovery threshold. Adding any other tool/section would do the
  same.
- **Hypothesis B — the inspect-drawing prompt section specifically**
  primes the wrapped pattern. The phrase "structured output" plus the
  `evidence: [{...}]` shape may bias the model toward wrapping cc's
  output once it sees a schema error.

The two are testable but need additional runs.

## Why the model gets stuck once it wraps

The schema validator's feedback message is *"must have required property
'grouping'"*. To a model under context pressure, this can read as "the
`grouping` field is missing" rather than "the `grouping` field is missing
at the root level." Once the model has chosen to add `grouping` inside
the outer `findings` key, every subsequent retry returns the same error
*"must have required property 'grouping'"* (because root still doesn't
have it), and the model interprets that as confirmation that grouping
isn't being provided at all — but the issue is location, not presence.

In other words: the schema feedback loop is locally optimal but globally
stuck. The model can't tell from the error alone that the issue is
nesting level.

## Mitigation paths

Ranked by cost, lowest first:

| # | Where | Fix | Risk |
|---|---|---|---|
| 1 | **Prompt** | Add an explicit anti-wrap line to the cc baseline `review.md` (or just the experiment overlay): "Return `grouping`, `findings`, `summary` at the **root** of the StructuredOutput response. Do NOT wrap them inside another `findings` key." | Brittle — may not transfer to other failure modes — but cheap and immediately testable. |
| 2 | **Schema** | Make the cc schema accept either flat or wrapped via `oneOf`, then unwrap downstream in `cross-run-consolidate-cc`. | Tolerates the model's mistake systemically. Adds a small amount of complexity to the consolidation script. |
| 3 | **Conductor retry layer** | When StructuredOutput validation fails, detect "model wrapped the answer one level too deep" (root has exactly one key, that key matches the schema's required shape) and auto-unwrap before retry. | Generic, helps every workflow. Bigger change; needs design. |
| 4 | **Sharper validator feedback** | When validator says "must have required property X" *and* root has a single key whose contents include X, customize the message to say "`X` was found inside `<wrapper key>` — return it at the root level instead." Same reasoning at the validator layer rather than retry layer. | Smallest API change. Helps any model misinterpreting the standard JSON-Schema message. |

I'd start with **#1 (prompt)** since it's the cheapest test of whether
prompt-level guidance can break the loop. If it doesn't help — i.e., the
model wraps anyway — that suggests the problem is structural, not
attentional, and we should escalate to **#4 (validator feedback)** which
addresses the global-stuck mechanism directly.

## Practical impact on the experiment

Until at least one of the mitigations lands, every `--experiment=inspect-drawing`
run is likely to halt at the `review` step. We can still inspect what
inspect-drawing was doing per call, but we won't get a clean
`review-comments.json` end-to-end. Recommend treating these runs as
"observe per-call artifacts only, ignore workflow status" until one of
the mitigations is in place.

## Pointers

- Per-case raw artifacts: `cc-bugs/cases/<id>/`
- Schema definition: `bureau/jurisdictions/austin/workflows/completeness-check/schemas/completeness.schema.json`
- Baseline cc prompt: `bureau/jurisdictions/austin/workflows/completeness-check/prompts/review.md`
- Experiment overlay prompt: `bureau/jurisdictions/austin/workflows/completeness-check/experiments/inspect-drawing/review.md`
- StructuredOutput retry behavior: `conductor/src/agent/runner.ts` (search for `structured_output`)
- The first-experiment unrelated-failures writeup:
  [`../analysis/2026-04-29-experiment-1-unrelated-failures.md`](../analysis/2026-04-29-experiment-1-unrelated-failures.md)
