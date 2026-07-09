# Follow-up plan — CC run e5c5f7ab (2026_07_08_run_2_vision_exp)

Committed fixes agreed during the 2026-07-08 audit session, plus candidates surfaced by the audit that are **not** yet committed. Evidence citations point at the sibling reports in this directory. No code is cut here — other agents are actively modifying the repos; this spec is the handoff.

## Status legend
- ✅ shipped / PR open
- 🔨 committed, spec below, implementation pending
- 💡 candidate — surfaced by the audit, not yet agreed

---

## 1. ✅ Bureau: vision-check overlay rebased onto current stock prompt

**PR: [bureau#530](https://github.com/noetic-inc/bureau/pull/530)** (open, awaiting human review — never merge without it).

The `workflows/completeness-check/experiments/vision-check/review.md` overlay was a full-file fork of the stock CC review prompt taken **before** the v2.6 warn-first-class change and never rebased. Every vision-experiment run evaluated without the warn/Fail Status machinery. Measured cost in this run (agent-1 report, "Overlay drift"): 12 pre-vote clamp rescues, 1 illegal warn (CC-1-34 run-3), and fail/warn vote splits that pushed both cc-21 `fail-or-warn` items to `uncertain` (~2 of the run's 19 uncertains are overlay artifacts).

The PR re-copies stock and re-applies only the `## Using the Vision Check Tool` section, preserving the bare-`checklistItemId` mandate (commit `451226517`) that fixed the 07-07 fragmentation. Post-PR, `diff prompts/review.md experiments/vision-check/review.md` shows the vision section and nothing else.

---

## 2. 🔨 Conductor: timeout + retry-with-backoff in `getFileContent`

**Where:** `conductor/src/shared/vision-file.ts:33-101` (`getFileContent`), shared by the vanilla `vision` tool and the `vision_check` generic path.

**Problem.** Per call, `getFileContent` does 2 Supabase DB queries (`plan_set_version` / `document_version`) + a storage download, with **no timeout, no retry, no cache**. In this run, a ~23-minute degradation of the in-process fetch layer (15:31–15:54 UTC) produced 42 generic-vision failures (34% of that path): calls hung 3–16 minutes, then died in synchronized cohorts (18 at exactly 15:52:07). 33 of 42 were never re-attempted. The comparison report (`vision-comparison-b38e2619-vs-e5c5f7ab.md` §"Failure analysis") shows this is not a design difference vs vanilla vision — run 1 pushed 150 calls through identical plumbing at up to 28/min with zero failures an hour earlier. Bad luck triggered it; missing defenses amplified it.

**Spec:**
1. Wrap each network operation (both DB queries, the storage download, the thumbnail/signed-URL fetch) in an abortable timeout. Suggested default 30s per operation; a call hanging 3–16 minutes is strictly worse than a fast failure.
2. Retry with exponential backoff + jitter, ~3 attempts, on retryable errors only:
   - retryable: `fetch failed`, socket/timeout aborts, gateway 5xx, transient Supabase errors
   - non-retryable: bad `documentId` / no-version-found (agent input errors — this run had 1 of these, cc-20 run-5 passing a plan_set_id as documentId; retrying would just triple its cost)
3. Emit a structured log event per retry (`vision_file.fetch_retry` with attempt, delay, error class) so a future degradation window is visible in the pino log as a retry burst, not silent multi-minute hangs.
4. Optional hardening, cheap while in there: an in-process LRU memo of documentId→resolved version rows, since the same sheet is re-fetched many times per run (279 calls against ~50 sheets).

**What it buys:** with 30s timeouts + 3 retries, most of this run's 36 window-failures would have either succeeded on retry (the bucket was serving inspect-drawing subprocesses fine throughout) or failed fast enough for the agent to re-ask — instead of 42 silent evidence gaps and one outvoted finding (run-4 CC-3-17).

**Effort:** S–M. Pure additive to one shared helper; both vision tools inherit it.

---

## 3. 🔨 Conductor: pre-stage sheet thumbnails into the sandbox at provisioning

**Where:** conductor sandbox provisioning (workspace setup, where site-plan data is already downloaded), plus a local-first branch in `getFileContent` (`conductor/src/shared/vision-file.ts`). Precedent: `conductor/src/tools/vision-local.ts` already implements a filesystem-backed vision path.

**Problem.** Every generic-vision call re-fetches its sheet thumbnail over the network at call time, from inside the long-lived conductor process. A plan set is ~50 sheets; this run made 279 vision calls against them. The per-call network dependency is what turned one degraded fetch window into 30 thumbnail failures — while `inspect-drawing`, which does its own I/O in a fresh subprocess, went 155/155 through the same window.

**Spec:**
1. At provisioning time (alongside existing site-plan data download), fetch all sheet thumbnails for the submission's primary plan set into the workspace, e.g. `{{ WORKSPACE_PATH }}/site-plans/<plan-set>/thumbnails/sheet-<n>.<ext>`. ~50 objects, one-time, at a phase where retries are cheap and a hard failure is loud (provisioning failure fails the run before any agent spend).
2. `getFileContent` resolves local-first for primary-plan `documentId`+`sheetNum` requests; falls back to the current network path for supplementary documents and anything not pre-staged (item 2's timeout/retry covers the fallback).
3. Log which path served each call (`source: local|network`) in the vision call metadata so coverage of the pre-stage is measurable.

**What it buys:** removes the per-call DB+storage round-trip from the hot path entirely for primary-plan calls — this run's 30 thumbnail-fetch failures and 6 DB-fetch failures become impossible for that class of call, independent of fetch-pool health. Also shaves the median generic-vision latency (147–191s includes fetch time).

**Effort:** M. Touches provisioning + one resolution branch; `vision-local.ts` is the template.

**Interaction with item 2:** complementary, do both. Pre-staging removes the common case from the network; timeout/retry protects the residual (supplementary docs, signed URLs, gateway calls).

---

## 4. 💡 Candidates surfaced by the audit — not yet committed

Ranked roughly by leverage; each cites the report with the full argument.

| # | Candidate | Where | Report |
|---|---|---|---|
| 1 | Emit-time checklist-ID validation: `pattern` on `checklistItemId` in `completeness.emit.schema.json` + runner-side check against the grouping's checklist table (the prompt is currently the **only** fragmentation defense) | conductor runner + bureau schema | agent-1 §Observability |
| 2 | Absolute checklist paths in the review prompt (and/or provision only the requested checklist version) — this run's single missing vote was a cwd-relative Read landing on stale `v2-trimmed` (73 wrong-root reads run-wide) | bureau prompts + conductor provisioning | agent-1 §Root-cause 1 |
| 3 | Surface vision `success:false` into findings (`degradedEvidence` flag or required mention in `observation`); include `checklistItemId` in tool-failure error-log lines | conductor vision_check | agent-1 §Remediations 5 |
| 4 | Reverse-coverage check in consolidation: a checklist item never emitted by any run currently vanishes silently | `cross-run-consolidate-cc.ts` | agent-2 §5 |
| 5 | Regenerate grouping summary blockquotes post-consolidation — ~6 groupings ship prose contradicting their own tables (e.g. `reports/cc-19.md:3` vs `:17`) | format-reports prompt / enrich | agent-8 |
| 6 | Provenance: record the actually-checked-out bureau commit at provisioning instead of inheriting the prior review's (`bureauCommit` stamp in this run predates v2.7-trimmed's existence) | conductor bureau setup | agent-1 §Provenance |
| 7 | Overlay call-discipline wording: lead with judicious-first + per-item call budget (the overlay's "For ANY question… call `vision_check`" leads before "be judicious"; depth doubled 2.8→5.4 calls/cell). Deliberately left out of bureau#530 to avoid changing two experiment variables at once | bureau overlay | comparison §Prompt |
| 8 | Check the sibling overlay `workflows/review/experiments/vision-check/` for the same fork-drift disease | bureau | bureau#530 body |
| 9 | Never default `failStatus` to `'fail'` on checklist-join miss (warn-policy inversion; present in `prepare-uncertain-explanation-inputs.ts:139-141` and `enrich-findings.ts`; already fixed in the consolidation script) | conductor/bureau scripts | agents 4, 7 |
| 10 | Update the `audit-cc-run` skill: the "conductor discards script stdout" signature is stale — four agents independently confirmed stdout is captured since conductor#212/#213 | claude-plugins | agents 2, 4, 6, 7 |

## Non-actions, for the record

- **No data repair needed** — the run's output is trustworthy as labeled (audit-summary.md, verdict HEALTHY WITH NOTES).
- **Keep inspect-drawing as-is** — 155/155 success, well-targeted volume (cc-22/cc-23 dimensional items), favorable cost profile (median 67s vs 147–191s generic; cropped-region input vs full sheet).
