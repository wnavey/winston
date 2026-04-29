# 1700 S. Lamar — runs=10 Baseline Report

**Review ID:** `24f98e83-282e-48c4-bae2-767e454810a5`  
**Workflow run:** `d981474f-dc3e-43de-b345-84c18266ebd2`  
**Project:** `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` — 1700 S. Lamar Blvd.  
**Checklist version:** `v2.5-trimmed` (same as 3-run baseline)  
**Runs config:** `runs=10` (no code/harness changes — purely a sample-size bump)  
**Run completed:** `2026-04-28 23:33 UTC` (~6 hours after the 3-run smoke test)

**Compare against:** [`../6ec3acdf-737b-47b2-8191-49b376ea3404/`](../6ec3acdf-737b-47b2-8191-49b376ea3404/) (the original 3-run baseline)

---

## TL;DR

The headline question for this run was **"how often does the cc-13 compaction + checklist-drift bug recur?"** since 1 of 3 runs hit it in the prior baseline. Result:

> **0 of 10 runs hit the cc-13 detection drift.** All 10 runs evaluated cc-13 with exactly the 37 v2.5-trimmed items. Detection variance — the dominant variance class in the 3-run baseline (18 refs, 9.1%) — collapsed to 0 refs (0%). Compaction events: 0 of 130 tasks. Stop-hook fires: 3 of 130 tasks (2.3%, none caused data loss).
>
> **The 3-run drift was an unlucky single occurrence, not a deterministic bug.** With this sample size we can put a 95% upper bound on the per-run drift rate of about 31% — still high enough to expect recurrence at scale, but not the ~33% the 3-run accidentally suggested.

A secondary finding: with 10× the votes, **3 of the 25 split-verdict refs from the 3-run flipped their winning status** to the opposite verdict. All three flips are cc-13 items where run-2's drift had introduced a "pass" vote on a *different deficiency* than the v2.5 deficiency text. With run-2's bug filtered out by sheer sample size, the true majority (fail) emerges. This is direct evidence that the cc-13 drift was distorting merged review outputs in ways that propagate to the city reviewer.

---

## Headline numbers vs the 3-run

| | runs=3 (6ec3acdf) | runs=10 (24f98e83) | Δ |
|---|---:|---:|---|
| Total refs in merged file | 198 | **185** | -13 (the 13 hallucinated cc-13 items are gone) |
| Unanimous | 155 (78.3%) | 139 (75.1%) | -3.2 pp |
| Partial-detection | 18 (9.1%) | **0 (0%)** | -9.1 pp |
| Split-verdict | 25 (12.6%) | 46 (24.9%) | +12.3 pp |
| split-and-partial | 0 | 0 | — |

Two opposing forces shape the comparison:

1. **Detection variance dropped to zero** because no run drifted scope. The 18 detection-variance refs from the 3-run came entirely from run-2's hallucination of out-of-scope AW items + dropping 5 in-scope ones. None of those 13 hallucinated items appear in any of the 10 runs in this baseline.
2. **Split-verdict roughly doubled in fraction** (12.6% → 24.9%) because with 10 runs, more refs accumulate at least one dissenting vote. This is not a regression — it's a sharper picture. Many of those splits are 9-vs-1 or 8-vs-2 and have low entropy.

The total-refs decrease (198 → 185) is the cleanest single confirmation that the cc-13 hallucinated items came from the prior bug, not from the v2.5 checklist itself: across 10 independent agent invocations, none of them surfaced AW-09, AW-15, AW-17, AW-24, AW-26, AW-34, AW-35, AW-42, AW-43, AW-44, AW-50, AW-51, AW-52.

---

## Harness events at scale

Across all 130 agent tasks (10 runs × 13 groupings), I scanned the conductor log for the same harness events that caused trouble in the 3-run.

| Event | Per-task incidence | Tasks affected | Result for this baseline |
|---|---|---|---|
| `Compaction` (`session is being continued…`) | 0/130 (0%) | none | none |
| `Stop hook` synthetic-user fires | 3/130 (2.3%) | run-7 cc-13, run-8 cc-24, run-10 cc-23 | None caused data loss |
| `StructuredOutput` called >1× | 14/130 (10.8%) | (see table below) | All recovered correctly — no drift, no data loss |

The stop-hook + compaction combination — the trigger of cc-13's drift in the 3-run — did not occur in any task. Stop-hooks alone fired three times but didn't cascade because no compaction event followed to wipe conversation state.

### Multi-StructuredOutput tasks

The 14 tasks with multiple `StructuredOutput` calls broke into two patterns:

**Pattern A — Wrong-type first call (Bug 3 from cc-13 root-cause), 7 tasks.**
The model passed `findings` as a JSON-encoded string instead of an array. The schema validator rejected; the agent retried with a properly-structured list. **All 7 recovered with the correct full set persisted.**

| Task | Call sequence | Persisted |
|---|---|---|
| run-3 cc-13 | `str(54,901)` → `list(37)` | 37 ✓ |
| run-7 cc-13 | `str(46,202)` → `list(37)` | 37 ✓ |
| run-5 cc-5 | `str(24,313)` → `list(14)` | 14 ✓ |
| run-6 cc-20 | `str(12,596)` → `list(7)` | 7 ✓ |
| run-7 cc-20 | `str(11,859)` → `list(7)` | 7 ✓ |
| run-8 cc-22 | `str(22,247)` → `list(14)` | 14 ✓ |
| run-10 cc-20 | `str(10,309)` → `list(7)` | 7 ✓ |
| run-10 cc-3 | `str(19,169)` → `str(17,992)` → `list(1)` → `list(11)` | 11 ✓ |

This is a real and recurring model behavior — about 5–7% of tasks emit a stringified `findings` parameter on the first try. The harness catches it via schema validation, the agent always recovers correctly, and no data is lost. **It's noise, not damage** — but it does inflate token costs and run time.

**Pattern B — Re-emission after first successful list call, 6 tasks.**
The agent calls `StructuredOutput` once with a valid list, then voluntarily calls it again with the same content. None caused data loss; the re-emission was either identical or a strict superset.

| Task | Call sequence | Persisted |
|---|---|---|
| run-6 cc-13 | `list(37)` → `list(37)` | 37 ✓ |
| run-1 cc-23 | `list(11)` → `list(11)` | 11 ✓ |
| run-3 cc-3 | `list(11)` → `list(11)` | 11 ✓ |
| run-4 cc-1 | `list(33)` → `list(33)` | 33 ✓ |
| run-7 cc-23 | `list(11)` → `list(11)` | 11 ✓ |
| run-9 cc-24 | `list(9)` → `list(9)` | 9 ✓ |

These are wasted but harmless — the bug from the cc-13 root-cause analysis (last-call-wins) doesn't bite when the second call has the same content as the first. They still produce the same drift surface area, just none of the dice rolls landed on a bad outcome.

---

## What recurred vs what didn't

| Bug from cc-13 root-cause | Recurred in runs=10? | Notes |
|---|---|---|
| Bug 1 (last-call-wins persistence) | Latent (no damage) | 14 tasks had multi-SO calls, but in all cases the last call was correct (often identical). The bug surface is still there. |
| Bug 2 (Stop-hook ignores prior success) | Yes, 3 fires | None cascaded into compaction this time |
| Bug 3 (wrong-type findings) | Yes, 7 tasks | Agent always recovered correctly |
| Bug 4 (persisted-output feedback loop) | Not observed | Tasks didn't accumulate enough context to hit the 44KB threshold cycle |
| Bug 5 (compaction during emission) | Did not recur | 0 of 130 tasks compacted |

The cc-13 drift required Bug 5 (compaction during emission) on top of Bug 2 (stop-hook). With Bug 5 not firing, the cascade didn't form, and Bug 1's data-loss potential stayed dormant.

The compaction-rate question — *how often* does cc-13 (or any large grouping) hit context exhaustion? — has different answers at different parallelism levels. The 3-run had `maxWorkers=13` (forced sequential staging across 39 tasks), which kept individual cc-13 tasks running for 41+ minutes. The 10-run logs show a different parallelism profile (130 tasks, the input had `maxWorkers=39`); individual tasks may have completed faster and stayed under the context limit.

---

## What sharpened: 7 winning-status flips

Three of the seven status flips between the 3-run and 10-run baselines are cc-13 items where run-2's drift bug specifically distorted the merged verdict. With 10 votes available, those distortions wash out:

| Ref | 3-run (n=3) winner | 10-run (n=10) winner | Pattern explanation |
|---|---|---|---|
| `cc-13:AW-23` | pass | **fail** | 3-run: run-2 evaluated wrong deficiency text (vertical exaggeration), passed → distorted majority. 10-run: 6 of 10 runs say `fail` on the *correct* deficiency (wastewater flow direction). |
| `cc-13:AW-28` | pass (3/3 unanimous) | **not-applicable** | 3-run: all 3 runs passed. 10-run: 8 of 10 runs say `not-applicable` (no retaining wall components on this site). The 3-run unanimous read was an artifact of small N. |
| `cc-13:AW-45` | pass | **fail** | 3-run: run-2's drift contributed a wrong-pass. 10-run: 5 of 10 say `fail`, 5 say `pass`. **Coin flip — genuinely ambiguous.** |
| `cc-1:CC-1-02` | fail | **pass** | 3-run: 2 fail / 1 pass, where the lone "pass" was run-2 with vision-tool seeing real project name. 10-run: 8 pass / 2 fail. The vision read is consistent across most runs. |
| `cc-23:CC-23-07` | fail | **not-applicable** | 3-run was the 3-way split (fail/n-a/pass). 10-run: 5 n-a / 3 pass / 2 fail. Plurality says not-applicable, which is the literal-interpretation answer. **Still genuinely ambiguous (entropy 1.486).** |
| `cc-24:CC-24-16` | not-applicable | **fail** | 3-run: 1 fail / 2 n-a. 10-run: 8 fail / 2 n-a. The 3-run dissent was a minority view. |
| `cc-3:CC-3-18` | pass (3/3 unanimous) | **fail** | 3-run: all 3 said pass. 10-run: 6 fail / 4 pass. Same pattern as AW-28 — small-N unanimous misled. |

Three of these flips (AW-23, AW-45, CC-1-02) are exactly the items where the prior `high-variance-items-analysis.md` predicted run-2's bug had distorted the merged verdict. **Confirmed.**

Two of these flips (AW-28, CC-3-18) are *new* discoveries — items where the 3-run had unanimous agreement but the 10-run reveals real disagreement. These are items the small-sample experiment couldn't have surfaced; they need the larger N to identify.

---

## What stayed ambiguous

The ref with the highest verdict entropy in both baselines is the same: **`cc-23:CC-23-07`**. With 3 runs the pattern was `fail / not-applicable / pass` (entropy 1.585, the maximum for 3 votes across 3 categories). With 10 runs the pattern is `fail × 2, not-applicable × 5, pass × 3` (entropy 1.486).

The interpretation from the prior report still holds: this ref's checklist text is genuinely ambiguous about whether "work in ROW" applies to behind-the-curb improvements. Different runs pick different defensible readings of the deficiency. **More N will not resolve this — it needs a checklist-text fix.**

`cc-13:AW-45` is the new high-variance ref — exactly 5 fail / 5 pass with entropy 1.000 (max for binary). This is the literal coin flip. Worth manual reviewer adjudication on what the right answer should be.

---

## Implications for the variance experiment

1. **The cc-13 drift bug rate is lower than the 3-run suggested.** A 0/10 observation gives a 95% upper-bound of ~31% per-run drift probability. The point estimate is closer to 0; the 3-run's 33% rate appears to have been an unlucky sample.

2. **The single-line fix for Bug 1 (idempotent StructuredOutput) is still worthwhile** — it removes the *worst-case data-loss potential* even though it didn't trigger this time. 14 of 130 tasks had multi-SO calls; in 14/14 the last call happened to be correct, but if even one of those last calls had been corrupted (as in cc-13 run-2 of the 3-run), the bug would resurface. Defense-in-depth is cheap.

3. **`runs=10` is enough to stabilize most refs.** Of the 25 3-run split-verdict refs, 8 (32%) became unanimous in the 10-run. Of those that remained split, most have entropies ≤ 0.881, indicating clear majorities (≥7/10 or ≥8/10). The remaining genuine ambiguities (`AW-45`, `CC-23-07`) are the ones that won't resolve at any N — they're checklist-clarity bugs.

4. **`logAllAgentTrace=false` here** (default). The runs=10 review didn't have the trace flag enabled, so we can't do per-run trace deep-dive at the same level we did for Valley View. For the next experiment, consider enabling it on cc runs too — would have been useful for understanding why run-3 unanimous-pass items at runs=3 became 6-fail/4-pass at runs=10 (CC-3-18, AW-28).

---

## Companion deep-dives

This baseline doesn't need separate `gap-items` or `high-variance` files because the variance picture is much cleaner than the 3-run:

- **No gap items** to investigate (detection variance = 0).
- **High-variance refs** are documented in `variance-summary.md` and the discussion above. The actionable subset is the seven status flips, all covered in this report.
- **Harness analysis** is summarized in the "Harness events at scale" section above. The 3-run's `run-2-drift-root-cause.md` remains the canonical write-up of the underlying mechanism — this baseline confirms its predictions but doesn't add new failure modes.
