# cc-variance-testing — TODO

Open follow-ups from the 1700 S. Lamar 3-run smoke test analysis.

## Inspector-General: surface stop-hook and compaction events

**Beads:** `workspace-925`
**Status:** open

The 1700 S. Lamar root-cause investigation ([`run-2-drift-root-cause.md`](./1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/run-2-drift-root-cause.md)) identified two synthetic events in the conductor log that drive harness-induced output drift but are invisible to downstream consumers:

- **Stop hooks** — `isSynthetic: true` user messages starting with `"Stop hook feedback: You MUST call the StructuredOutput tool…"`
- **Compaction** — `isSynthetic: true` user messages starting with `"This session is being continued from a previous conversation that ran out of context."`

### What to do

1. **Timeline ingestion.** Extend whatever per-task event timeline inspector-general builds for completed conductor runs to include stop-hook and compaction events. Both are filterable from `logs/<workflow>.log` by the JSONL grep recipes in `run-2-drift-root-cause.md` (Appendix).

2. **Post-processing computation.** Compute per-task:
   - `stopHookCount`
   - `hadCompaction`
   - `stopHookFiredAfterSuccess` — bool, fires when a stop-hook timestamp comes after the first successful `StructuredOutput` tool_result.
   - `multipleStructuredOutputs` — count.
   - `outputDriftSuspected` — true when `multipleStructuredOutputs > 1` and the payloads' `checklistItemId` sets differ. **This is the actionable signal** — the persisted findings file may not match the agent's actual evaluation.

3. **Surface in IG UI.** Show a warning badge on tasks where `outputDriftSuspected=true`. The QA flow and any consumer reading `runs/<runIndex>/findings/<checklistItem>.json` should know that file is suspect when this fires.

### Why

Without this, harness-induced drift looks identical to model variance, polluting any variance experiment we run on top of completeness-check (or any other workflow with the same harness pattern). Once IG flags drift-suspected tasks, the variance experiment can filter them out and measure real model variance cleanly.

### Related

- PR: https://github.com/wnavey/winston/pull/18
- Beads: workspace-925
- Worked example: 1700 S. Lamar review `6ec3acdf-737b-47b2-8191-49b376ea3404`, cc-13.md, run-2 — file at `1700-S-Lamar/6ec3acdf-737b-47b2-8191-49b376ea3404/run-2-drift-root-cause.md`
