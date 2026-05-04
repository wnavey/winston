# cc-bugs/

Captured artifacts from completeness-check workflow runs that surfaced
non-inspect-drawing bugs. The artifacts are pulled from the agent log
(`logs/completeness-check.log`) on Supabase storage; the failing items
themselves never produced a `findings/<item>.json` (StructuredOutput
validation failed every time), so this directory preserves the raw
attempts that would otherwise be lost.

## Contents

| Path | Purpose |
|---|---|
| [`wrapped-structured-output.md`](./wrapped-structured-output.md) | Bug writeup — model wraps cc findings one nesting level too deep, can't recover within retry budget |
| `cases/<datetime>-<item>-<run>/` | Per-failure raw artifacts. See per-case files below. |

### Per-case files

For each `(run datetime, item, runIndex)` triple where the agent
exhausted StructuredOutput retries:

| File | Content |
|---|---|
| `first-attempt.json` | Model's first JSON attempt — usually the closest to schema-correct |
| `last-attempt.json` | Model's final attempt before retries exhausted — usually the most degraded |
| `progression.json` | Compact per-attempt summary (root keys, findings type, "wrapped" flag) so you can see how the shape evolved |
| `errors.txt` | Schema-validator error messages, one per line |

## Cases captured

| Case ID | Source run | Why |
|---|---|---|
| `2026-04-29-201221-cc-3-run-1` | First experiment run | grouping field missing → wrapped pattern |
| `2026-04-29-201221-cc-19-run-4` | First experiment run | same |
| `2026-04-29-232527-cc-24-run-1` | Second experiment run (post bureau#284 fix) | same |
| `2026-04-29-232527-cc-13-run-4` | Second experiment run | same |
