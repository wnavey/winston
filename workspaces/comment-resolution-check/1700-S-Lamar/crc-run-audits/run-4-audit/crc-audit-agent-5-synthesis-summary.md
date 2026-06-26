# CRC Run Audit — Synthesis Summary

**Review audited:** `1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8`
**Submission version:** `6b9b85ed-e992-4906-a222-b24ee836910c`  ·  **Guides:** `6b9b85ed-e992-4906-a222-b24ee836910c` gen `5`
**Calibration test:** YES (submissionVersionId == crcGuidesSubmissionVersionId)
**Run config:** 5 runs × 21 dept guide files (17 distinct grouping codes) · maxWorkers 39 · jurisdiction austin · project "Lamar + Collier"
**Run location:** cloud (`workflow-runs/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-06-26-121000/`)
**Audit date:** 2026-06-26
**Auditors:** Agent 1 (perf/stability), Agent 2 (vote variance), Agent 3 (tool usage/observability), Agent 4 (output quality — calibration run)

---

## TL;DR

- **Overall health: HEALTHY WITH NOTES.** Run finished cleanly in 34.4 min, produced 105/105 review cells and 229/229 verdicts, retry-storm bug stayed shut, and the only errors were 15 transient vision-tool DB fetches clustered in an 81-second Supabase blip.
- **Single biggest risk: the crc-SP family of guides.** SP is simultaneously the noisiest dept by absolute disagreement (18 non-unanimous items, 8 of them `3-2`) **and** the largest contributor to systematic false-resolves (15 of the 33 candidate failures, 45%). Same guide pack, two independent dimensions both pointing at it — the highest-leverage target.
- **Single biggest win: structural health is solid.** No retry storm (Agent 1: 0 `coercion_failed` events, closure criterion met), no schema corruption, no concurrency bottleneck (39/39 peak, 27.5/39 time-weighted avg), no agent errors, full 5-run coverage on every checklist item. The variance and output-quality issues are *reasoning* issues on a stable substrate — actionable via prompt + atomization, not blocked by a bug.
- **Output-quality verdict: HEALTHY WITH NOTES** (33 of 229 verdicts = 14.4% flagged as candidate agent failures). Caveat: 22 of the 32 `resolved` were high-confidence + unanimous, so the failure is *systematic*, not noisy — the agent is confidently wrong in a recurring way (`scope-misinterpretation`, 67% of cases).

## What went well

- **Complete + deterministic shape.** 5/5 runs × 21 dept files, all 229 items present in every run, no coverage gaps in `consolidated-findings.json` (Agent 2).
- **72% unanimous verdicts.** 165 of 229 items got `5-0` votes (Agent 2). Confidence is mechanical (`high` ⇔ unanimous, `medium` ⇔ any disagreement) so the unanimous block is a real signal.
- **Retry storm stayed closed.** Zero `agent.structured_output.coercion_failed`, zero `coercion_repaired` (the post-fix safety-net hook), all structured outputs landed first-try (Agent 1).
- **Concurrency was good while there was work.** Peak/sustained 39/39 workers for ~15.5 min before the tail (Agent 1). The remaining headroom is *tail-shaped, not concurrency-shaped*.
- **Tool logging exists in both halves.** Vision prompts + checklist IDs land in the main pino log (325/325 invocations), vision responses + usage/model land in the sidecar (309 results + 15 errors) — the data is there even if it's not co-located (Agent 3).

## What needs attention / investigate — prioritized

**P0 — Fix the crc-SP guide family.** crc-SP is the top finding from two independent dimensions:
- **Variance (Agent 2):** 18 non-unanimous items in SP, 8 of them `3-2` splits → mapped to `uncertain` by the consolidator.
- **Output quality (Agent 4):** 15 of 33 candidate failures (45%) live in SP, mostly `scope-misinterpretation`.
- A scope-tightening + atomization-back-check pass on `crc-SP-1.md`, `crc-SP-2.md`, `crc-SP-3.md` would shrink variance AND failure rate simultaneously. See Agent 4 R-02 (prompt rubric) + the per-case files for SP refs.

**P0 — `scope-misinterpretation` is the dominant agent failure mode** (22 of 33, 67%; Agent 4). The agent narrows the rule's applicable set — e.g. "adjacent driveways on this site" when the rule covers neighboring properties along the corridor. Worsened by Agent 4's novel `anchoring-on-positive-evidence` pattern: the agent treats topic-relevance as compliance. Highest-coverage remediation is Agent 4 **R-02** — "do not narrow the rule" prompt rubric (21 cases, medium effort, agent-prompt-change).

**P1 — `self-uncertainty-not-escalated` (7 of 33, 21%; Agent 4).** Reasoning text contains hedge tokens ("appears to", "may be a typo", "though unclear") yet `status: resolved` + `confidence: high`. Agent 4 **R-03** — auto-downgrade `resolved`→`uncertain` when reasoning contains hedge tokens — is low-risk schema change (medium effort, schema-change). Cheap and easy to validate.

**P1 — Vision tool observability is split across two files** (Agent 3). The vision *prompt* (+ checklistItemId) lives in the 12k-line pino log; the *response text* (+ usage + model) lives in `vision-log.jsonl`; nothing co-locates them. Audit-by-checklist-item requires manual stitching. Worse: sidecar error events carry `success:false` only — the real reason (`DB error fetching plan_set_version: TypeError: fetch failed`) is only in `comment-resolution-check-error.log`. Agent 3 recommends a unified `tool-calls.jsonl` ledger keyed by `callId + checklistItemId + runIndex` capturing prompt + response + usage + error reason in one record.

**P1 — Single-straggler tail dominates the end of the review step** (Agent 1). `crc-CA-2.md` run-5 ran 781.8 s — solo-occupying the worker pool for an extra 283 s ≈ 17% of step wall-clock. More workers wouldn't help; LPT-ordering (push slowest depts first) would.

**P2 — `rephrase-titles` is 17% of total wall-clock** (5.8 min; Agent 1). It's a non-agent text-transform step — either shrink its input to ~10 KB or rewrite it as a deterministic script.

**P2 — Semantic-search log has no `checklistItemId`** (Agent 3). 482 searches are attributable only at the dept level. Thread `checklistItemId` through the MCP wrapper so per-item-level traceability becomes possible.

**P2 — Vision tool needs internal retry on transient DB errors** (Agent 1, Agent 3). 15 errors all on documentId `908ffab5-…` in an 81-s window during a Supabase blip. 3-attempt exponential backoff inside `crc-vision-check` would have masked the outage entirely.

## Cross-cutting insight

**The single highest-leverage fix is to refactor the crc-SP guides.** This one change moves the needle on both `Agent 2` (variance) and `Agent 4` (output quality) at once — 18 non-unanimous items resolve to fewer `uncertain` verdicts, and 15 of 33 false-resolves disappear if the `scope-misinterpretation` pattern is tightened in the SP rubric. crc-DE is the runner-up (12 non-unanimous, 8 `3-2`s) but doesn't show up in Agent 4's top depts — it's a variance-only target.

**The second highest-leverage fix is the unified tool-calls.jsonl ledger** (Agent 3 R-1 + R-2 + R-3 combined). Today, debugging *why* the agent narrowed a rule's scope requires stitching two log files together; with a single per-tool-call record we'd be able to filter to `pattern_tag = scope-misinterpretation` cases and audit the actual prompt + response in <60s instead of <30min. This is meta-leverage: it doesn't fix any single bug, but it makes every future audit (and every future Agent 4 run) cheaper and more reliable.

**A third concrete reinforcement: Agent 4's novel `placeholder-as-evidence` pattern** (e.g. `crc-AW-2` accepting a "FOR REFERENCE ONLY" sheet as a plat) suggests the agent has no `watermark-disclaimer-missed` reflex outside the explicit cases that already exist. A small prompt addition — "before treating any artifact as proof, scan its margins for UNOFFICIAL / DRAFT / FOR REFERENCE ONLY / PLACEHOLDER markings" — would catch this class.

## Per-agent verdicts

| Agent | Verdict | Headline | Report |
|---|---|---|---|
| 1 — Performance & Stability | **HEALTHY WITH NOTES** | 34.4 min wall-clock, 105/105 cells, retry-storm closed, 15 transient vision DB errors | `crc-audit-agent-1-performance-stability.md` |
| 2 — Vote Variance | (current-run only) | 72% unanimous (165/229), 27 `3-2`s + 2 three-way splits → all 29 `uncertain` verdicts. crc-SP / crc-DE noisiest by absolute count. | `crc-audit-agent-2-high-variance-writeup.md` + 2 TSVs |
| 3 — Tool Usage & Observability | (informational + 3 recs) | 35.3% items used vision, 37.6% used semantic; vision prompt and response live in separate files; semantic-search lacks `checklistItemId` | `crc-audit-agent-3-observability-report.md` + 2 TSVs |
| 4 — Output Quality | **HEALTHY WITH NOTES** | 14.4% candidate failure rate (33/229), but 22 are high-confidence unanimous = systematic. `scope-misinterpretation` 67% of cases. crc-SP / crc-EV concentrate 67%. | `crc-audit-agent-4-output-quality-report.md` + 2 TSVs + traces + 33 per-case files |

## Open questions / data limitations

- **No historical comparison.** Three prior CRC reviews exist for this submission_version_id (2026-06-19, 06-23, 06-25) but they used CRC guide generations 1, 1, 2 respectively — incompatible with current gen 5. Atomization, item IDs, and guide splits all differ; cross-generation comparison would create false matches. Both Agent 2 and Agent 3 ran current-run-only as a result. To enable history, the audit needs a stable item-identity layer across generations (e.g. canonical-comment IDs) or a gen-to-gen mapping.
- **No human triage.** 0 rows in `comment_triage` for this reviewId, so Agent 4 ran in no-triage mode. Triage rows would have *distinguished* `clear-agent-failure` from `city-comment-vague` and `agent-correct-city-wrong` — those distinctions are currently absent. The 14.4% rate is therefore an upper bound on real agent failures.
- **Parent MCR comment not in per-case detail.** Each per-case file shows the agent's reasoning + the checklist row, but the raw MCR comment is not in `consolidated-findings.json` so the question "is the checklist item even faithful to the MCR comment?" (the `atomization-incomplete` pattern) is hard to assess. Linking back to the source MCR text would close this.
- **Tool attribution is self-reported by the agent.** `tools_used[]` on each per-run finding is what the agent declared, not what was definitively observed in the sidecars. The vision and semantic-search sidecar counts (324 + 482) line up with the main-log `tool_use` blocks (325 + 482, with one vision call rejected by MCP input-validation), but per-item attribution still leans on the agent's self-report.

## Audit artifacts

All in `/Users/wnavey/noetic/crc-audits/1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8/`:

- `crc-audit-agent-1-performance-stability.md`
- `crc-audit-agent-2-current-run-votes.tsv`
- `crc-audit-agent-2-high-variance-writeup.md`
- `crc-audit-agent-2-running-variance-all-runs.tsv`
- `crc-audit-agent-3-observability-report.md`
- `crc-audit-agent-3-tool-usage-current.tsv`
- `crc-audit-agent-3-tool-usage-running-tally.tsv`
- `crc-audit-agent-4-output-quality-report.md`
- `crc-audit-agent-4-failure-cases.tsv`
- `crc-audit-agent-4-remediations.tsv`
- `crc-audit-agent-4-agent-traces.jsonl`
- `per-case/001.md` … `per-case/033.md` (33 per-case detail files for Agent 4)
- `crc-audit-agent-5-synthesis-summary.md` (this file)

Run artifacts cached under `_run/` (cloud run downloaded from `workflow-runs/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-06-26-121000/`).
