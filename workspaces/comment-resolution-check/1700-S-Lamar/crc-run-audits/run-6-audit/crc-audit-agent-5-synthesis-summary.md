# CRC Run Audit — Synthesis Summary

**Review audited:** `ed5e7ba9-ba03-4000-abb4-1021ebec0631` (runLabel `2026-07-14-v5-crc-game-day-run-1`, workflow_run `87370792-9453-4dbd-8141-8b812f29717a`)
**Submission version:** `4cfe4c36-c14e-4f5f-8b71-27c6fe3ed677` (Lamar+Collier v5)  ·  **Guides:** `6b9b85ed-e992-4906-a222-b24ee836910c` (u0 = v4) gen 6
**Calibration test:** NO — first real CRC review of a genuine resubmission (v5 reviewed against v4-derived guides)
**Run config:** 5 runs × 24 department guide files (291 checklist items) · maxWorkers 35 · jurisdiction austin · model claude-sonnet-4-6 · enrichComments false
**Run location:** cloud (`workflow-runs/comment-resolution-check/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/2026-07-14-183605`)
**Audit date:** 2026-07-14
**Auditors:** sub-agents — performance/stability (Agent 1), vote variance (Agent 2), tool usage/observability (Agent 3). Output-quality (Agent 4) skipped per gating rule.

---

## TL;DR

**Overall health: HEALTHY WITH NOTES.**

- **The run completed cleanly**: 120/120 review cells produced findings; 291/291 items consolidated with a full 5/5 votes each (zero coverage gaps, zero ID fragmentation — the v4 baseline's crc-CA phantom-item cluster did not recur). Wall-clock 81.8 min; review step = 97.7% of it. DB save exact-matches the artifacts (166 failed / 76 resolved / 49 uncertain).
- **Top risk: semantic search was silently dead for the ENTIRE run.** All 482 calls hit `permission denied for schema extensions`, fell back to keyword mode, and 95.4% returned zero results. Agents compensated with 2.8× more vision calls (2.89 M vision tokens, 5× baseline) — which likely explains most of the 1.75× compute growth vs baseline.
- **Retry storm: YES, but a NEW variant** — 2 events, both on crc-SP-3 (runs 1 and 4), signature `__unparsedToolInput` (StructuredOutput input failed JSON parsing, likely emit truncation), NOT the classic double-wrap. Both recovered on the first outer retry; ~70 min of agent compute wasted; the run-4 event set the wall-clock finish line. The bug doc's zero-event closure criterion is **not met**, and the conductor#197 repair path cannot touch this variant.
- **Top win: consensus quality improved on a harder bar.** Unanimity 69.4% (202/291) with 5 runs vs 61.6% with only 3 runs on the v4 baseline; pairwise vote agreement 0.844 vs 0.744. No rogue run (minority votes spread 18–34 across the 5 runs).
- **Output-quality audit skipped:** this is a real review (submissionVersionId v5 ≠ crcGuidesSubmissionVersionId v4), not a calibration test — no ground truth to validate verdicts against.

## What went well

- **Structural integrity, end to end.** Every one of the 1,455 item-run votes present; binary failed/resolved vocabulary throughout; confidence maps exactly to vote splits (5-0 → high, splits → medium). The 49 consolidated `uncertain` items are exactly the 49 3-2 splits — the 0.35 uncertainty threshold behaved precisely as designed.
- **winston#163 observability shipped and is visibly live in this run**: vision logs full prompt AND response in the sidecar plus a new per-call `tool-calls/*.json` store; semantic search logs `checklistItemId` + `runIndex` on 482/482 calls (baseline: 51/112, no run index). This new logging is what made the semantic-search outage diagnosable at all.
- **Tool self-report fidelity improved**: 6 over- / 3 under-reporting items vs 19/8 in the baseline.
- **Stability floor is high**: 5 error + 4 warn lines in 96,460 log lines; vision 673/676 success; zero rate-limit events; concurrency pool saturated (peak 35/35, avg in-flight 24.9) until the tail.

## What needs attention / investigate — prioritized

- **P0 — Semantic-search hybrid mode down all run** (`permission denied for schema extensions` on 482/482 calls → keyword fallback → 95.4% zero results). The tool was dead weight; agents routed around it with vision at ~5× token cost. Fix the schema grant, and add alerting on hybrid-fallback rate / zero-result rate so a full-run outage can never be silent again. Detail: Agent 3 report §Errors.
- **P1 — Retry-storm NEW variant (`__unparsedToolInput`)** on crc-SP-3 ×2, plus the milder signal of 29 unparsed emit attempts across 17 cells. This is a *parse/truncation* failure, not the double-wrap the bug doc describes — needs a bug-doc addendum and its own remediation (the schema-repair path can't fix unparseable input). Closure criterion not met. Detail: Agent 1 report §Retry-storm.
- **P1 — Oversized guides are the shared root of the tail, the storms, and the compactions.** crc-SP-3 (36.9 min mean cell, both storm events), crc-SP-2 and crc-DE-1 (the run's only 2 auto-compactions, at ~169k/173k pre-tokens — baseline had 0), crc-CA-1 all sit in the >26-min tail. Agent 2 independently finds chronic vote instability concentrated in the same families (crc-DE 12 and crc-SP 10 of the 38 chronically unstable items). Splitting these guides (the crc-sp split pattern) is the one fix that hits latency, storm exposure, compaction risk, AND variance. Detail: Agent 1 §Compaction/Concurrency, Agent 2 §Baseline comparison.
- **P2 — Vision supporting-doc + sheetNum bug**: all 3 vision errors were a valid supporting-document UUID (`e3412be0…`, Property Profile Maps) passed WITH a `sheetNum` → "No plan set version found"; the same doc without sheetNum succeeds; the agent only saw "File could not be loaded." Validate the combo and return an actionable hint. Detail: Agent 3 §Errors.
- **P2 — Human-review queue for the 49 uncertains**: 29 lean resolved / 20 lean failed; the 29 resolved-leaning are the best triage targets. 22 of the 49 were already unstable in the v4 baseline — ~45% of today's uncertainty was predictable from guide ambiguity alone, not plan changes. Detail: Agent 2 write-up.
- **P2 — Phantom parent-ID tags in `tools_used` attribution** (TPW-7/10/13, WQ-14 match no consolidated sub-item) — derive `tools_used` server-side from the new tool-call manifests and validate IDs against the guide's atomic list. Detail: Agent 3 §Traceability.

## Cross-cutting insight

1. **Split the oversized guides (SP-3, SP-2, DE-1, CA-1).** Four independent symptoms — the 55-min packing tail, both storm events, both compactions, and the chronic-variance cluster — trace to the same few guide files. One structural change improves speed, cost, stability, and consensus quality at once. Don't raise maxWorkers; the run is tail-bound, not throughput-bound.
2. **The new observability is already paying for itself — finish it.** winston#163's logging surfaced a full-run infrastructure outage (semantic search) and a doc-resolution bug (vision sheetNum) that previous runs would have hidden inside "agents used more vision this time." Remaining gaps: error *reasons* in vision error records, block text in search results, and server-side tool attribution.

## Per-agent verdicts

- **Agent 1 — Performance & stability: HEALTHY WITH NOTES.** Complete, 81.8 min, tail-bound on crc-SP-3; storm YES (new variant, 2 events, recovered); 2 compactions (first ever). → `crc-audit-agent-1-performance-stability.md`
- **Agent 2 — Vote variance: clean and improved.** 202×5-0 / 40×4-1 / 49×3-2; uncertains = exactly the 3-2s; agreement up vs baseline; 38 chronically unstable items flagged. → `crc-audit-agent-2-high-variance-writeup.md` + 2 TSVs
- **Agent 3 — Tool usage & observability: much-improved logging, two real bugs found.** Vision on 75.5% of item-runs, semantic search 18.4% (but functionally dead), neither 17.7%. → `crc-audit-agent-3-observability-report.md` + 2 TSVs
- **Agent 4 — Output quality: SKIPPED** (real review run, no calibration ground truth; force with `--include-output-quality` if desired).

## Open questions / data limitations

- **No true history**: this is the first CRC review of submission version v5, so the "running variance across reviews" dimension uses the v4 gen-6 calibration run (`bfb4f256`, 2026-07-13, 3 runs) as a clearly-labeled baseline — same 291 items, different submission and objective. Verdict-level correctness is NOT comparable; only agreement rates and per-item stability were compared.
- **Historical tool attribution**: `historical_reviews_counted=0` in the running tally (no same-version priors); baseline comparison used the run-4 audit TSVs.
- **Was the resolved/failed mix affected by the semantic-search outage?** Unknowable from this run alone — the 2.8× vision compensation may have fully covered, but text-heavy items (notes, legal descriptions) are where keyword-fallback zero-results would bite. Worth a re-run spot check after the schema grant is fixed.

## Audit artifacts

All in `/Users/wnavey/noetic/crc-audits/ed5e7ba9-ba03-4000-abb4-1021ebec0631/`:

- `crc-audit-agent-1-performance-stability.md`
- `crc-audit-agent-2-current-run-votes.tsv`
- `crc-audit-agent-2-running-variance-all-runs.tsv`
- `crc-audit-agent-2-high-variance-writeup.md`
- `crc-audit-agent-3-tool-usage-current.tsv`
- `crc-audit-agent-3-tool-usage-running-tally.tsv`
- `crc-audit-agent-3-observability-report.md`
- `crc-audit-agent-5-synthesis-summary.md` (this file)

No `per-case/` directory — Agent 4 did not run.
