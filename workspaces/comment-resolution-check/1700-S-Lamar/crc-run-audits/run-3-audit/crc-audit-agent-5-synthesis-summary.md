# CRC Run Audit — Synthesis Summary

**Review audited:** `a8d07d22-19e6-4a1f-a12d-a4371c1dbd19`
**Submission version:** `6b9b85ed-e992-4906-a222-b24ee836910c` (Lamar + Collier, v4)  ·  **Guides:** `6b9b85ed-…` gen `2`
**Calibration test:** **YES** (submissionVersionId == crcGuidesSubmissionVersionId)
**Run config:** 5 runs × 16 departments (22 guide files) · maxWorkers 39 · jurisdiction austin
**Run location:** cloud (`workflow-runs/comment-resolution-check/23301a8a-…/2026-06-25-075932`) — artifacts pulled from Supabase storage to local audit scratch
**Audit date:** 2026-06-25
**Auditors:** sub-agents — performance/stability, vote variance, tool usage/observability, output-quality (calibration-test mode, no-triage)

---

## TL;DR — Overall verdict: **DEGRADED**

- Run completed cleanly: 110/110 review cells wrote structured output, 234 consolidated items, DB and storage uploads succeeded. Wall-clock 1h 49m (108.6 min), dominated by the `review` step (91.2%).
- **Top risk: the structured-output retry storm is open and has SHIFTED to new wrap variants.** 36 `agent.structured_output.coercion_failed` events across 25 of 110 cells (23%); the bug-doc's named `["findings"]` double-wrap shape is mostly fixed (5/36), but Sonnet has migrated to `["data"]` × 72 retry attempts, `["output"]` × 59, `["properties"]` × 27, plus `["content"]`/`["results"]`/`["result"]`. **Zero-event closure criterion NOT met — bug should remain open.**
- **Output-quality verdict: DEGRADED.** 44 of 234 verdicts (18.8%) on a calibration run came back `resolved` or `not-applicable` against an implicit ground truth of "every item should be `failed`". Top patterns: `mention-vs-demonstration` (13), `na-under-defended` (12), `label-formatting-missed` (7). No triage rows existed for this review (no-triage mode).
- **Top win:** the 5-run majority-vote consensus held up — 146/234 items (62.4%) were unanimous, and disagreement was always binary (no 3-way splits). The vote layer absorbed the storm's per-run item drift (227/223/224/223/234) without producing junk consensus.

## What went well

- **Completion**: every guide file emitted a per-run findings JSON across all 5 runs (110/110 cells). Final outputs uploaded; review row persisted; 234 items consolidated.
- **Consensus quality**: 62.4% unanimous, 23.5% 4-1, 13.7% 3-2, 0% three-way. The agreement floor is high even with storm-driven per-run drops.
- **Tool prompts ARE logged** (just not in the obvious place): semantic-search `query` lives in the sidecar AND the main pino log; vision prompts live in the main pino log under `msg:"Calling crc-vision-check"`. The infrastructure exists — it just needs better surfacing (see R-O1 in Agent 3 report).
- **Tool errors are transparently retried**: the 56 vision tool errors (54 sidecar + 2 gateway) all clustered in a ~3-min early burst and were handled without cell failures.

## What needs attention — prioritized

### P0 — Retry storm is open and has mutated
- **What**: 36 `agent.structured_output.coercion_failed` events; 25 distinct cells (23%); ~180 wasted Sonnet calls + ~232 s of pure backoff; every top-10 slowest cell was stormed at least once.
- **Why it matters**: connects three other findings — (a) the slow tail (worst cell `crc-de-2.md run-5` at 77.2 min, ~7× median), (b) the per-run item-set drift driving 8 coverage gaps in the vote variance audit (incl. 7 CA-1x.1 sub-items that only run-5 produced and DE-33 missing from run-3), and (c) some fraction of the output-quality failures may be from corrupted reasoning before the verdict was stamped. **`crc-sp-1` was stormed in 4 of 5 runs.**
- **Detail**: `crc-audit-agent-1-performance-stability.md` §Retry-storm verdict; bug doc `/Users/wnavey/noetic/winston/workspaces/comment-resolution-check/crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md` needs reopening with the new wrapper-word inventory.

### P0 — Calibration false-positive rate of 18.8% (DEGRADED band)
- **What**: 44 candidate agent failures on a run where every item should resolve to `failed`. Pattern concentration:
  - `mention-vs-demonstration` (13): agent stopped at a plan note *stating* a rule and called it `resolved` without checking the artifact that *demonstrates* compliance.
  - `na-under-defended` (12): agent unilaterally overrode city's premise via `not-applicable`. Concentrated in WQ-11..14 (water quality applicability) and TPW-6..11 (5 items unanimously NA'd).
  - `label-formatting-missed` (7): "substantively equivalent" rather than literal verbatim text on verbatim-text items.
- **Detail**: `crc-audit-agent-4-output-quality-report.md`; 44 per-case files at `per-case/001.md`–`044.md`.

### P1 — Vision-tool placeholder-leak bug (real, hidden by the sidecar)
- **What**: 35 vision errors carry `documentId="primary-site-plan"` (literal placeholder string) being passed where a UUID is expected. Affects 14 different guide files. The sidecar `vision-log.jsonl` reports only `success:false` — the actual error (`invalid input syntax for type uuid: "primary-site-plan"`) is only visible by cross-referencing the 95MB main log. Another 27 errors are transient `fetch failed` blips and 2 are gateway socket closures.
- **Why it matters**: this is a doc-resolution / fixture-leak bug masquerading as transient noise — the file/SDK level. Worth a `bd` issue. It may also be contributing to the `na-under-defended` cluster: when vision can't load the relevant sheet, the agent has stronger pressure to declare absence.
- **Detail**: `crc-audit-agent-3-observability-report.md` §Vision-error correlation.

### P1 — Observability: tool calls don't attach a `checklistItemId`
- **What**: no log line (sidecar or main) ties a specific tool call to a specific atomic checklist item. Finest granularity is `(guide_file, runIndex)`. Vision model **response text** lives only in the main pino log's `tool_result` content — not in the sidecar JSONL. Sidecar `msg:"crc-vision-check response received"` is misleadingly named (no payload).
- **Why it matters**: when Agent 4 wants to debug a `vision-dimensional-misread` case, there's no straight path from "this verdict" → "the prompt/response that produced it". Forces grep through a 95MB log.
- **Detail**: `crc-audit-agent-3-observability-report.md` §Top 3 recommendations.

### P2 — Concurrency under-utilized
- **What**: avg time-weighted in-flight = 14.2 of maxWorkers=39 (36% utilization). Run is **tail-bound**, not throughput-bound — bumping maxWorkers won't help. Killing the storm + breaking up the largest guide files (`crc-sp-1.md`, `crc-de-2.md`) will compress the long tail.

### P2 — Tool-name normalization
- **What**: 7 aliases observed (`crc-vision-check`, `mcp__conductor_tools__crc_vision_check`, `crc_vision_check`; plus 4 semantic-search variants). TSVs report normalized counts; production code should canonicalize at the SDK boundary.

### P2 — Cross-review tally not available (gen mismatch)
- **What**: two prior CRC reviews on this submission version exist (`3703349c-…` 2026-06-23, `7e79e197-…` 2026-06-19) but both used `crcGenerationNumber=1` vs current gen=2. Excluded from the running-variance and tool-usage tallies to avoid item-ref drift. Re-run a prior at gen=2 (or stamp a gen-stable item key) before the next audit.

## Cross-cutting insight

**Killing the retry storm is the single highest-leverage fix.** It directly:
1. **Compresses wall-clock** — every slow tail cell is stormed; without the storm, the run finishes well under an hour. (P2-Concurrency disappears automatically.)
2. **Reduces variance** — the 8 coverage-gap items are all from per-run drops; storm-recovery currently emits 1 partial item rather than the full list. Without the storm, the consolidated set is the same across all 5 runs and unanimous-vote share rises.
3. **May reduce output-quality failures** — though the dominant Agent-4 patterns (`mention-vs-demonstration`, `na-under-defended`) are agent-prompt issues that survive even a clean structured-output path, some fraction of low-quality verdicts on stormed cells (e.g. `crc-sp-1` stormed 4/5 runs) likely reflect rushed reasoning under coercion pressure.

**Second-highest leverage: per-tool-call JSONL keyed by `(checklistItemId, run, tool_use_id)` capturing prompt + response + tokens + latency + error.** A single new log file lets Agent 4 audit verdicts root-to-tip without grepping a 95MB pino log, and surfaces the placeholder-leak bug automatically. Agent 3's R-O1.

## Per-agent verdicts

| Agent | Verdict | Headline | Report |
|---|---|---|---|
| 1 — Performance/Stability | **HEALTHY WITH NOTES** | 1h 49m, completed; retry storm OPEN with new wrap variants; 36% concurrency utilization (tail-bound) | `crc-audit-agent-1-performance-stability.md` |
| 2 — Vote variance | **HEALTHY WITH NOTES** | 62.4% unanimous, no 3-way splits; noisiest: `crc-ev` 68%, `crc-de` 59%, `crc-tpw` 48%; 8 coverage gaps from storm | `crc-audit-agent-2-high-variance-writeup.md` + 2 TSVs |
| 3 — Tool usage / observability | **HEALTHY WITH NOTES** | Prompts ARE logged (just not where you'd look); `checklistItemId` traceability gap; placeholder-leak vision bug found | `crc-audit-agent-3-observability-report.md` + 2 TSVs |
| 4 — Output quality | **DEGRADED** | 18.8% candidate false-positive rate; 13 mention-vs-demonstration + 12 na-under-defended + 7 label-formatting-missed | `crc-audit-agent-4-output-quality-report.md` + 3 TSVs + 44 per-case files |

## Open questions / data limitations

- **History depth**: two prior CRC reviews exist on this SV but at gen=1 vs current gen=2 — current-run-only TSVs. Re-running a prior at gen=2 (or adding a gen-stable item key) unlocks the running tally next time.
- **No triage rows** for this review — Agent 4 in no-triage mode. All 44 candidates are bucket `un-triaged-resolved-or-na`. A human triage pass would convert some to `agent-correct-city-wrong` (lower the failure rate) and would sharpen pattern tags via `triage_note`.
- **Tool-call ↔ item linkage**: cannot attribute a specific tool call to a specific atomic checklistItemId from logs alone. Agent 3 worked around it via `(guide_file, runIndex)` aggregation, but Agent 4 case-level vision-error attribution required the main-log grep.
- **`output_json.agentTrace` not present**: `winningFinding` carried `observation`/`reasoning`/`explanation`/`resolution` directly (not under `.agentTrace`). Agent 4 adapted. The audit-crc-run SKILL.md template should be updated to reflect the actual schema.

## Audit artifacts

All under `/Users/wnavey/noetic/crc-audits/a8d07d22-19e6-4a1f-a12d-a4371c1dbd19/`:

- `crc-audit-agent-1-performance-stability.md`
- `crc-audit-agent-2-high-variance-writeup.md`
- `crc-audit-agent-2-current-run-votes.tsv` · `crc-audit-agent-2-running-variance-all-runs.tsv`
- `crc-audit-agent-3-observability-report.md`
- `crc-audit-agent-3-tool-usage-current.tsv` · `crc-audit-agent-3-tool-usage-running-tally.tsv`
- `crc-audit-agent-4-output-quality-report.md`
- `crc-audit-agent-4-failure-cases.tsv` · `crc-audit-agent-4-remediations.tsv` · `crc-audit-agent-4-agent-traces.jsonl`
- `per-case/001.md` – `per-case/044.md` (Agent 4 per-case detail files)
- `crc-audit-agent-5-synthesis-summary.md` (this file)

Run scratch (artifacts pulled from storage): `scratch/output/`, `scratch/logs/`.
