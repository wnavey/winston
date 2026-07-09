# Audit Summary — CC run `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d`

**runLabel**: `2026_07_08_run_2_vision_exp` · 2026-07-08 15:20–16:25 UTC · checklist v2.7-trimmed (14 groupings, 194 items) · runs=5 · claude-haiku-4-5 · experiment=vision-check (generic-vision + inspect-drawing) · uncertainThreshold=0.35 · explainUncertain=true (Sonnet 4.6) · priorReviewId=`54d5c002` · setCurrent=false

## Overall health: **HEALTHY WITH NOTES**

---

## 1. Executive summary

This was the follow-up to the 2026-07-07 vision-check run whose overlay prompt induced 189 artifactual uncertains via checklist-ID fragmentation. The one-line overlay fix (bare-ID mandate at `experiments/vision-check/review.md:16`) **verifiably held**: all 279 vision_check calls and all 969 emitted findings used bare IDs; consolidation's fragmentation defenses (`strippedIdPrefixCount: 0`, `unknownRefCount: 0`) were armed and never triggered (Agents 1 §"ID contract", 2 §3). The run completed 70/70 review cells with zero structured-output retries, and every downstream script/agent step ran clean first-attempt.

The causal chains that *did* produce defects are all secondary:

1. **Wrong-checklist-version read → one missing vote.** The prompt injects a bureau-*relative* grouping path; cc-2 run-2's cwd-resolved Read failed (part of 73 wrong-root reads run-wide), the agent ran `find`, and opened the stale sibling `v2-trimmed/cc-2.md` (5 items instead of 6). It faithfully evaluated the wrong table, its "5 of 5 pass" summary honestly misreports coverage, and CC-2-24 got no run-2 vote. Consolidation caught it explicitly (`voteMissingDistribution {"1":1}`) and it consolidated to pass 4/5, medium confidence (Agents 1 §root-cause, 2 §3, 9 §evidence).
2. **Stale overlay fork → warn-machinery gap.** The vision-check overlay is a fork of the *pre-v2.6* stock prompt, missing all warn/Fail Status machinery. Agents defaulted to `fail` on advisory items (12 pre-vote clamp corrections, all correct), emitted 1 illegal warn (also clamped), and split fail/warn votes on the two cc-21 `fail-or-warn` items — pushing CC-21-01 and CC-21-04 to `uncertain` (~2 of the run's 19) (Agents 1 §overlay-drift, 2 §3).
3. **Generic-vision infra flakiness.** 42 of 124 generic-vision calls failed (34%) — mostly thumbnail/DB fetch failures, ~half in one 15:52:07Z network blip; inspect-drawing was 155/155. Five-run redundancy absorbed essentially all of it (net damage: one 4-1-outvoted finding), but zero findings mention the degraded evidence (Agent 1 §vision).
4. **Stale grouping summaries in reports.** `enriched-findings.json` per-grouping `summary` fields predate the cross-run vote; format-reports copies them verbatim per its prompt, so ~6 grouping reports open with blockquotes contradicting their own tables (e.g. `reports/cc-19.md:3` claims CC-19-02 "fails" while line 17 shows Pass) (Agent 8 §4a).

The 19 uncertains are otherwise **genuine cross-run disagreement** (17 at 3–2, 2 at 2-2-1, pass↔fail dominant, spread across 9/14 groupings), and all 19 got clean, leak-free Sonnet explanations for $2.83 total.

**Agent agreement note**: no factual disagreements across reports. One stale prior corrected unanimously — Agents 1, 4, 6, and 7 all independently confirmed that conductor **does** capture script stdout in `step.script.completed` events (the #212/#213 observability remediation is live); the audit skill's "conductor discards stdout" assumption should be retired. Agent 6 also corrected the charge: the collector has 3 guards, not 4 — the forbidden-terms lint was deliberately moved prompt-side after audit ae7cb127's false positive.

One provenance wrinkle: `output/review-comments.json` from build-review-comments stamps `bureauCommitHash=148418db` (correct, contains v2.7-trimmed), but Agent 1 found the *log-level* bureauCommit stamp `c29a96ea` inherited from the prior review — a commit that predates v2.7-trimmed's creation. Content was verified equivalent to bureau HEAD (969/969 ID match), so this is a stamp bug, not a content bug.

---

## 2. Step-by-step status

| Step | Status | Verdict | Key numbers |
|---|---|---|---|
| **review** | 🟡 | Healthy with notes — all cells clean; overlay drift + one wrong-version read + vision infra flakiness | 70/70 done, 0 SO retries; p50 1,057s, max 3,499s (cc-13 r2, 36 vision calls); 969 findings, 0 fragmentation; 279 vision calls, 42 failed (all generic path); 73 wrong-root reads; 1 missing vote (cc-2 r2 CC-2-24, stale v2-trimmed read) |
| **cross-run-consolidate-cc** | 🟢 | Healthy — vote math, gate, clamps, tie-breaks all verified correct | 559ms; 194 refs 1:1 with checklist; 13 pre-vote clamps (12 fail→warn advisory, 1 warn→fail); 19 uncertain all genuine; 46/194 (23.7%) within one vote of gate flip; 6/7 fails at 4-1 |
| **apply-forced-outcomes** | ⚪ | **Skipped in-run** — no forced outcomes configured; 0 `forced:true` findings downstream (confirmed by Agents 4/7/9) | n/a |
| **prepare-uncertain-explanation-inputs** | 🟢 | Healthy — 1:1 selection, joins hit live table data (non-default failStatus values verified) | 465ms; 19/19 inputs, 0 degraded fields, 0 forced-skips; colon→`__` slugs shell-safe |
| **explain-uncertain** | 🟢 | Healthy — first-attempt perfection, high-quality diagnostic prose | 19/19 done, 0 retries; 192s wall, 7.6/10 concurrency; $2.833 total ($0.149/cell, ~95% cached); ref-echo 19/19; 0 hard leaks |
| **collect-uncertain-explanations** | 🟡 | Healthy with notes — all guards passed non-vacuously (replayed); one soft leak, latent guard weaknesses | 467ms; 19/19 collected, 0 nulls; tripwire 0% vs 50%; 1 soft plural-framing leak (cc-22:CC-22-14) |
| **enrich-findings** | 🟢 | Healthy — perfect join, full stamping, the sidecar pattern others should copy | 452ms; 194→194, 0 join misses, 0 backstop clamps, 0 drift warnings; 194/194 stamped with consolidatedStatus+voteBreakdown |
| **format-reports** | 🟡 | Healthy with notes — deterministic scripted render, exact counts; stale summaries + warn omission | Sonnet-5, 20 turns, ~3min, 0 retries; 194 rendered, statuses exact (99/7/4/19/65); rephrased-items 194 composite keys, 0 collisions; ~6 groupings with contradictory summary blockquotes; headline 99+7+19=125 ≠ 129 |
| **build-review-comments** | 🟢 | Healthy — perfect TSV numbering, clean joins, complete provenance; nothing needs repair | 502ms; mode=map, 194 mapped / 0 unmapped / 0 dup numbers; all 4 joins 100% composite-ref clean; prior alignment 180/182, drift localized to numbers 112–113 (checklist evolution) |

---

## 3. What went right

- **The 07-07 fragmentation fix held under fire.** 279/279 vision calls and 70/70 emissions used bare IDs; consolidation's post-mortem hardening (`normalizeChecklistItemId`, checklist-validated refs, 10% unknown-ref abort, explicit refusal to default unknown refs to fail) was armed and stayed quiet (Agents 1, 2).
- **Zero structured-output retries across the entire run** — 70 review cells + 19 explain cells + format-reports, all first-attempt. Contrast with the 37-failure retry storm of the 5-01 debug era (Agent 1).
- **The pre-vote clamp did exactly its job, 13/13 correct** — including cc-24:CC-24-15 where all 5 runs emitted `fail` on an advisory item and the clamp produced a unanimous high-confidence `warn` (Agent 2 §3).
- **The missing vote was contained, labeled, and traceable at every stage**: consolidation recorded `missing:1`, enrich carried the voteBreakdown intact, build-review-comments stamped `runCount=4, confidence=medium` on comment 191. Textbook graceful degradation (Agents 2, 7, 9).
- **inspect-drawing specialist: 155/155 success**, correct `--sheetNum` every call; vision classifier median confidence 0.95, zero fallbacks; per-call forensic artifacts complete (Agent 1).
- **Explain-uncertain quality**: internal traces diagnose divergence *mechanisms* (factual misread vs protocol interpretation vs applicability ambiguity), externals are neutral, sheet-grounded, and actionable — 0 hard machinery leaks in 19 externals, all for $2.83 (Agents 5, 6).
- **Format-reports de-risked itself** by writing a deterministic Python generator instead of free-handing 194 rows, then self-verified counts (194/194 TSV coverage, 0 dupes) before finishing (Agent 8).
- **TSV numbering byte-perfect**: 194/194 mapped, gaps {47,75,80,86,88,97,142,183} proven to be in the TSV itself; script throws on a missing map file rather than silently falling back (Agent 9).
- **Observability remediation (conductor #212/#213) confirmed live** — script stdout/stderr captured in `step.script.completed` for every script step, corroborated independently by four agents.

## 4. What went wrong (ranked)

1. **Stale vision-check overlay fork missing all warn/Fail Status machinery** (Agent 1 §overlay-drift). The overlay predates the v2.6 warn-first-class change: no Fail Status column description, no `warn` in the status enum or Step 4 rules. Cost in this run: 12 fail-on-advisory emissions needing clamps, 1 illegal warn (CC-1-34 r3), and fail/warn vote splits that pushed CC-21-01 + CC-21-04 to uncertain (~2 of 19). The clamp masked most of it, but the experiment's agents are running a materially different status model than stock.
2. **Wrong-checklist-version read (cc-2 run-2)** (Agent 1 §missing-vote). Bureau-relative path injection → 73 wrong-root reads run-wide → one agent `find`-recovered onto stale `v2-trimmed/cc-2.md` and evaluated 5 items instead of 6. The run's only missing vote; the agent's summary self-reported full coverage. Enabling conditions are systemic: relative paths + stale checklist versions discoverable in the sandbox.
3. **Stale grouping-summary blockquotes contradict their own tables in ~6 detailed reports** (Agent 8 §4a). `enriched-findings.json` summaries reflect pre-consolidation counts; every grouping whose fail was demoted to uncertain by the vote now opens its human-facing report with a false claim (cc-19, cc-3, cc-5, cc-10, cc-21, cc-24). The single most misleading element of the deliverable.
4. **34% generic-vision failure rate (42/124)** (Agent 1 §vision). 30 thumbnail fetches, 6 DB fetches, 1 signed-URL, 4 gateway 5xx, 1 agent-error bad documentId; ~half in one 15:52:07Z sandbox network blip. Graceful mechanical fallback, one outvoted degraded finding (run-4 CC-3-17) — but **silent at the finding level**: 0 of 969 findings mention a tool failure.
5. **bureauCommit provenance stamp wrong by construction** (Agent 1 §provenance). Log-level stamp `c29a96ea` inherited from the prior review, predating v2.7-trimmed's creation. Content verified equivalent to bureau HEAD; the mechanism ("Bureau commit from prior review") likely misstamps every run with a priorReviewId.
6. **Headline metrics omit the 4 warns** (Agent 8 §4b). Consolidated report says 99+7+19=125 against "129 evaluated"; no Warn column in per-grouping table. Prompt spec lags the warn-first-class status model.
7. **One soft machinery leak shipped** (Agent 6 §5): cc-22:CC-22-14 external uses "some analysis concluding… some finding…, others…" plural framing — the predictable residual of moving the lint prompt-side. 1/19; Agent 5 flagged a borderline sibling ("read by some evaluations", cc-23:CC-23-07).
8. **Bonus/latent items** (did not fire, worth fixing): silent `failStatus ?? 'fail'` join-miss fallbacks in both prepare-inputs (lines 139–141) and enrich-findings (line 200) — a miss on a warn item would invert advisory into blocking; no reverse-coverage check in consolidate (a never-emitted item vanishes silently); guard-2 comment claims a nonexistent stopword filter; silent duplicate-ref overwrite in the collector; format-reports prompt's question-mark title rules are dead letter vs the declarative TSV; comment-number 113 now denotes a different item than the prior review (CC-15-09b→CC-15-14) — a trap for number-keyed triage carryover.

## 5. What we don't know / open questions

- **Do other runs share the stale overlay?** Any vision-exp run using `experiments/vision-check/review.md` before a rebase (including 07-08 run 1, if it exists, and the 07-07 run) ran without warn machinery. The 07-07 overlay was confirmed to differ only at line 16 — so yes for 07-07; other runs not examined.
- **Does the bureauCommit stamp bug affect all priorReviewId runs?** The mechanism ("Bureau commit from prior review", conductor bureau setup) suggests yes — every chained run inherits a stale stamp. Not verified beyond this run. Note the tension: build-review-comments' own stamp (`148418db`) was correct; the exact scope of which artifact carries the bad stamp needs a conductor-side look.
- **Is the 34% generic-vision failure rate chronic or blip-driven?** ~Half traced to one 15:52:07Z network event; whether other runs see similar thumbnail/DB fetch flakiness in Vercel Sandboxes is unknown. No baseline exists.
- **Vision value signal**: this audit established the vision *mechanics* work, but no agent measured whether vision-derived evidence changed verdicts vs a no-vision control. The experiment comparison (vs prior review `54d5c002` or a stock-prompt run) was out of scope.
- **How stable are the 7 fails?** 6 of 7 sit at 4-1 margins — one flipped vote from uncertain (Agent 2 §4). Rerun stability untested.
- **Whether the 73 wrong-root reads are overlay-specific or affect the stock prompt too** — both inject the same bureau-relative path (`prompts/review.md:6`), so likely both; not confirmed on a stock run.
- **Sandbox-snapshot verification**: Agents 4/7 verified checklist joins against the *local* bureau checkout, not the sandbox snapshot the run actually read; exact matches on all spot-checks make drift unlikely but not disproven.

## 6. Cross-cutting observability theme

The run's defenses are strong where past incidents forced hardening (consolidate's ref validation, build's fail-hard on missing map, the collector's tripwire) and thin everywhere an incident hasn't struck yet. Recurring pattern — **silent degradation with exit 0**:

- `failStatus ?? 'fail'` join-miss defaults in prepare-inputs *and* enrich-findings (same hazard, two scripts) — both would invert warn policy on a miss, and neither logs, counts loudly, or fails.
- No `pattern` on `checklistItemId` in the emit schema and no runner-side coverage/ID validation — the prompt is the only defense against the exact bug class that destroyed the 07-07 run; detection lives one full pipeline stage later.
- No reverse-coverage check in consolidate — a never-emitted checklist item vanishes without a trace.
- Vision failures invisible in findings — degraded evidence detectable only by reading a 43MB pino log.
- Agent self-diagnosis buried: format-reports' substantive self-audit and the cc-2 agent's honest-but-wrong "5 of 5" summary both live only as log lines; nothing promotes agent result-text to step status.
- Uncertain-share has no circuit breaker anywhere (a 189-uncertain run would format into a confident-looking report).

**Single highest-leverage fix**: an emit-time contract check in the runner — validate each cell's emitted `checklistItemId` set against its grouping's checklist table (parser already exists in `checklist-policy.ts`) plus a schema `pattern`. That one seam would have caught the 07-07 fragmentation at emit, caught this run's cc-2 wrong-version read at emit (extra/missing IDs vs the v2.7 table), and structurally closes the class of "agent evaluated something other than what we asked."

## 7. Recommended remediations (ranked, deduplicated)

Nothing in this run needs data repair (Agent 9: output internally consistent, correctly numbered, fully stamped; setCurrent=false).

| # | What | Where | Effort | Would have caught in THIS run |
|---|---|---|---|---|
| 1 | Rebase the vision-check overlay onto current stock prompt (restore warn/Fail Status machinery); longer-term, generate overlays as section patches, not full-file forks | `bureau/workflows/completeness-check/experiments/vision-check/review.md` | S | 12 clamp interventions, 1 illegal warn, ~2 overlay-induced uncertains (CC-21-01/04) |
| 2 | Emit-time coverage/ID validation: diff emitted IDs vs grouping table at envelope canonicalization; add `pattern` to `checklistItemId` | `conductor/src/agent/structured-output-repair.ts` / `runner.ts`; `bureau/workflows/completeness-check/schemas/completeness.emit.schema.json` | M | cc-2 run-2's wrong-version read (5 IDs vs 6 expected), at the source instead of one stage later |
| 3 | Inject absolute sandbox path for the grouping file; ideally provision only the requested checklist version | `bureau/workflows/completeness-check/prompts/review.md:6` + `experiments/vision-check/review.md:6`; conductor provisioning | S–M | 73 wrong-root reads and the stale v2-trimmed pickup |
| 4 | Regenerate (or drop) per-grouping `summary` after consolidated stamping; or prompt format-reports to recompute the counts sentence from display statuses | `enrich-findings.ts`; `workflow/prompts/format-reports.md:136` | S | ~6 contradictory report blockquotes |
| 5 | Never default `failStatus` on join miss — warn + `checklistJoin: 'missing'` flag + fail-loud threshold; belt-and-suspenders `normalizeChecklistItemId` at both joins | `prepare-uncertain-explanation-inputs.ts:139-141`; `enrich-findings.ts:200` | S | Nothing this run (0 misses) — closes the warn-inversion latch |
| 6 | Reverse-coverage check in consolidate: warn + `missingCoverageRefs` sidecar field + synthesize a visible placeholder; add per-run findings counts (`run-2: 193/194`) | `cross-run-consolidate-cc.ts` (~line 296, 405) | S | Per-run counts would have pinpointed cc-2/run-2 instantly |
| 7 | Surface vision failures into findings (`degradedEvidence` flag or required observation mention); add `checklistItemId` to tool_failure log lines | conductor vision_check tool plumbing; review prompt | M | Silent degradation on 42 calls incl. the outvoted CC-3-17 |
| 8 | Stamp actual checked-out bureau commit at provisioning instead of inheriting prior review's | conductor bureau setup ("Bureau commit from prior review" path) | S | The wrong `c29a96ea` provenance stamp |
| 9 | Uncertain-share circuit breaker (>25% of evaluated → warn/fail/banner) in build-review-comments and/or format-reports | `build-review-comments.ts`; format-reports prompt | S | Nothing this run (9.8%) — would have flagged 07-07's 189 |
| 10 | Warn counts in headline metrics + per-grouping Warn column; re-sync title fallback rules to the TSV's declarative style | `workflow/prompts/format-reports.md:108, 28` | S | The 125≠129 arithmetic mismatch |
| 11 | Collector hardening: per-reason tripwire (`ref-mismatch > 0` ⇒ fail), duplicate-ref warning, `degenerate-input` reason, fix guard-2 comment/stopword mismatch; extend prompt lint with plural-evaluator phrasings | `collect-uncertain-explanations.ts`; `prompts/explain-uncertain.md` | S | The cc-22 soft plural-framing leak (prompt lint extension) |
| 12 | Enrich run-log items with `attempts`/`costUsd`/`numTurns`; pass decisiveness threshold + `uncertaintyKind` into explain inputs; persist format-reports result text as a step artifact | conductor run-log; `prepare-uncertain-explanation-inputs.ts`; conductor step handling | M | Log-archaeology cost of this audit; cc-13:AW-07's threshold speculation |
| 13 | Post-format validation script (rephrased-items count/keys/dupes, evaluated-total assertion) + build-step assertions (comment count == checklist size, ref uniqueness, `map-partial` as error) + prior-alignment log line | new script after format-reports; `build-review-comments.ts` | S–M | Would have surfaced the 112/113 prior drift at run time |

## 8. Verdict on the run's intent

This run set out to prove the 07-07 overlay fix and continue the vision-check experiment. What it actually established:

**Confirmed**: the ID-fragmentation fix works. 279/279 vision calls and 969/969 emissions in bare-ID form, zero stripped prefixes, zero unknown refs — against the identical workload that produced 189 artifactual uncertains the day before. The fix is real, but it is *prompt-only*: no schema pattern, no runner validation. One regression in overlay wording away from recurrence (remediation #2 is the structural close-out).

**Vision tooling — mechanics proven, value unproven, reliability split.** Routing, classification (median confidence 0.95, zero fallbacks), per-call artifacts, and the inspect-drawing path (155/155) all work. The generic-vision path failed 34% of the time on infra (storage/DB/gateway), silently, with 5-run redundancy as the only thing standing between that and output damage. The experiment demonstrates the *harness* is production-shaped; it says nothing yet about whether vision evidence improves verdict accuracy — that comparison wasn't in scope and the failure rate means any negative signal on generic-vision items is confounded by infra.

**Read the experiment's results with two contaminations in mind**: (a) the overlay's missing warn machinery means every vision-exp agent ran a pre-v2.6 status model — 12 clamp rescues and ~2 of the 19 uncertains (CC-21-01/04) are overlay artifacts, not model disagreement, and any warn-item comparison against a stock-prompt run is apples-to-oranges until the overlay is rebased; (b) the remaining ~17 uncertains are genuine run variance in a gate operating in a sensitive region (46/194 items within one vote of flipping; 6/7 fails at 4-1) — that is a model-determinism/checklist-wording signal (cc-22, cc-3, cc-24 applicability, cc-5), not a vision or consolidation problem.

**Bottom line**: the run is healthy, its output is trustworthy as labeled (uncertains honestly marked, the one missing vote documented in-band), and nothing needs repair. Before run 3 of the experiment: rebase the overlay (#1), add the emit-time contract (#2), and fix the path injection (#3) — then the experiment's numbers become cleanly interpretable.
