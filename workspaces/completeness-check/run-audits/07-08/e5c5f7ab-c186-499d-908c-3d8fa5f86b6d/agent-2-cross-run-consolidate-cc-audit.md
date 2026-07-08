# Audit: `cross-run-consolidate-cc` step

**Review**: `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d` (runLabel `2026_07_08_run_2_vision_exp`), 2026-07-08
**Step window**: 2026-07-08T16:19:09.289Z → 16:19:09.849Z (559 ms), status completed
**Invocation** (from log): `npx tsx .../cross-run-consolidate-cc.ts --runsDir=.../output/runs --findingsDir=.../output/findings --runCount=5 --checklistsDir=.../v2.7-trimmed --uncertainThreshold=0.35`

**Verdict: HEALTHY**

---

## 1. Step purpose

Reads per-grouping findings from each of the 5 runs' `findings/` dirs, applies the Fail Status pre-vote clamp to each per-run status, majority-votes the *normalized* statuses per checklist item, applies the uncertainty gate, assigns confidence tiers, and writes:
- `output/consolidated-findings.json` — full multi-run data (tentativeStatus + voteBreakdown for `build-review-comments`)
- `output/findings/cc-*.md.json` — per-grouping winning findings in the format `enrich-findings` expects
- `output/consolidation-summary.json` — observability sidecar

As-ran scripts audited:
- `RUN_DIR/workflow/scripts/cross-run-consolidate-cc.ts` (433 lines)
- `RUN_DIR/workflow/scripts/consolidate-logic.ts` (116 lines, pure vote logic)
- `RUN_DIR/workflow/scripts/checklist-policy.ts` (232 lines, table parser + clamp + ID normalization)
- `RUN_DIR/workflow/scripts/consolidate-logic.test.ts` (fixture tests present, self-contained runner)

## 2. Algorithm as implemented

**Ref keying** (`cross-run-consolidate-cc.ts:247-288`): each emitted finding is keyed as `ref = "{grouping}:{checklistItemId}"` where grouping comes authoritatively from the findings *file* (`data.grouping`), never from the emitted ID. Before keying, `normalizeChecklistItemId()` (`checklist-policy.ts:139-148`) strips a redundant own-grouping prefix (`cc-13:AW-01` → `AW-01`) and counts it as `stripped`; an ID prefixed with a *different* grouping is left intact and surfaces as an unknown ref. This is the fix for the 2026-07-07 fragmentation incident (review 50a1a78d), and the rewrite propagates to perRunFindings, winningFinding, and findingsDir files so downstream sees canonical IDs.

**Unknown-ref validation** (`cross-run-consolidate-cc.ts:58-63, 266-273, 300-313`): the script builds a `grouping:itemId → FailStatus` lookup from `--checklistsDir` (`buildFailStatusLookup`, `checklist-policy.ts:155-165`). Refs not in the lookup are collected into `unknownRefs`, warned with a sample list, and **the step aborts** when unknown refs exceed `UNKNOWN_REF_ABORT_SHARE = 0.10` of unique refs. Critically, there is **no silent `|| 'fail'` default**: lines 269-276 explicitly leave unknown refs *unclamped* (emitted status passes through), with a code comment stating that defaulting to `'fail'` would invert warn policy. The hazard the charge asked about is affirmatively designed out in this version.

**Fail Status pre-vote clamp** (`checklist-policy.ts:221-232`, applied at `cross-run-consolidate-cc.ts:274-283`):
- Advisory item (`Fail Status: warn`) + agent-emitted `fail` → clamped to `warn`
- Blocking item (`fail`, incl. column-absent, which the parser defaults to `'fail'` at `checklist-policy.ts:99-101, 110, 119`) + agent-emitted `warn` → clamped to `fail`
- `fail-or-warn`: both pass through (agent determination authoritative)
- pass / not-applicable always pass through
Each clamp logs a `CLAMP-PRE-VOTE` line, records the raw status as `emittedStatus` on the per-run finding, and is captured in the sidecar's `preVoteClampEvents`. Rationale (header comment, lines 21-27): the gate must evaluate the statuses the product displays, so per-item policy differences can't manufacture dissent (e.g. `[fail, warn, warn]` on an advisory item is a unanimous warn post-clamp).

**Majority vote + uncertainty gate** (`consolidate-logic.ts:64-116`):
- Count post-clamp statuses across the 4-state enum; winner = max count, ties broken by severity `fail(3) > warn(2) > not-applicable(1) > pass(0)` (line 55-60).
- **Missing votes count as dissent**: `winnerShare = maxCount / totalRuns` (line 99) — denominator is `totalRuns` (5), not the number of present votes. `voteBreakdown.missing = max(0, totalRuns − statuses.length)` (line 91).
- **Gate formula** (lines 98-107): fires only when `totalRuns >= 3`; item lands `uncertain` iff `winnerShare <= 1 − uncertainThreshold`, i.e. at 5 runs / threshold 0.35: `maxCount/5 <= 0.65` → **maxCount ≤ 3 → uncertain; maxCount ≥ 4 → decided**. Boundary is inclusive (exact threshold share IS uncertain). Would-be winner is preserved as `tentativeStatus` (never `'uncertain'` itself).
- **Confidence** (line 83-84): `high` iff `maxCount >= totalRuns` (unanimous, no missing), `medium` iff `maxCount >= 2`, else `low`. Independent of the gate.

**Winning finding** (`cross-run-consolidate-cc.ts:329-334`): earliest run whose normalized status matches the *display verdict* (tentativeStatus when uncertain, else status), written with the normalized status — so findingsDir stays 4-state and policy-clean even for uncertain items.

**runCount=1 passthrough** (lines 159-183): copies `run-1/findings/*` untouched; `enrich-findings` clamps on that path. Not exercised this run.

## 3. What happened (evidence)

From the log (`RUN_DIR/logs/completeness-check.log`, `step.script.completed` event) and `output/consolidation-summary.json` — the two agree exactly:

- **5/5 runs loaded**, 969 per-run findings seen (= 5×194 − 1), **194 unique refs, checklist defines 194** — perfect 1:1 with v2.7-trimmed, zero ref inflation.
- **`strippedIdPrefixCount: 0`, `unknownRefCount: 0`** — all 70 agent cells emitted bare, valid IDs. The fragmentation defenses were armed but never triggered.
- **13 pre-vote clamps** (all logged as `CLAMP-PRE-VOTE` and persisted in the sidecar): 12× `fail→warn` on advisory items (`cc-1:CC-1-32`; `cc-24:CC-24-04/13/15/16` — verified `Fail Status: warn` in `/Users/wnavey/noetic/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/cc-24.md` and `cc-1.md`), and 1× `warn→fail` on blocking item `cc-1:CC-1-34` (run-3; verified `Fail Status: fail`).
  - Standout: **`cc-24:CC-24-15` was clamped in all 5 runs** — every run emitted `fail` on an advisory item; the clamp turned it into a unanimous high-confidence `warn`. This is the exact scenario the pre-vote clamp exists for.
- **Status distribution**: pass 99, not-applicable 65, uncertain 19, fail 7, warn 4 (sums to 194; matches `consolidated-findings.json` exactly).
- **Confidence**: 146 high + 48 medium + 0 low. Internal consistency verified: 146 high = the unanimous 5/5 items; 48 medium = 29 decided-at-4 + 19 uncertain. ✓
- **Vote-missing**: 193 items with 0 missing, 1 with 1 missing — `cc-2:CC-2-24`. Verified at source: `output/runs/run-2/findings/cc-2.md.json` has 5 findings (CC-2-24 absent; other runs have 6). Consolidated result: 4× pass + 1 missing → share 4/5 = 0.8 > 0.65 → **pass, confidence medium** (not high, because maxCount 4 < totalRuns 5 — missing runs correctly blocked high confidence). Matches code exactly.
- **findingsDir spot-check** (`output/findings/cc-24.md.json`): uncertain items CC-24-04/13/16 carry their tentativeStatus `not-applicable`; CC-24-15 carries `warn`. winningFinding for CC-24-04 is run-2's n/a finding (earliest run matching the display verdict) — explanation text matches perRunFindings[run-2] verbatim. ✓ 14 grouping files written, one per grouping.
- **Tie-breaks verified**: `cc-21:CC-21-01` (1p/2f/2w) → severity tie-break fail>warn → tentative `fail` ✓; `cc-23:CC-23-07` (2p/2f/1na) → tie pass/fail → tentative `fail` ✓.
- Step stderr was empty; no WARNING lines emitted.

## 4. Disagreement & gate-sensitivity analysis (headline)

No fragmentation, no missing-vote noise — **all 19 uncertains are true cross-run disagreement.** Per-run votes (post-clamp; `(raw:…)` = pre-clamp emission):

| Ref | Tentative | r1 | r2 | r3 | r4 | r5 | Pattern |
|---|---|---|---|---|---|---|---|
| cc-10:AE-01 | fail | fail | pass | fail | fail | pass | 3f/2p |
| cc-13:AW-07 | pass | n/a | pass | n/a | pass | pass | 3p/2na |
| cc-21:CC-21-01 | fail | warn | fail | pass | fail | warn | 2f/2w/1p (3-way) |
| cc-21:CC-21-04 | fail | fail | warn | fail | warn | fail | 3f/2w |
| cc-22:CC-22-14 | fail | fail | fail | pass | fail | pass | 3f/2p |
| cc-22:CC-22-15 | fail | fail | n/a | n/a | fail | fail | 3f/2na |
| cc-22:CC-22-19 | fail | fail | fail | pass | fail | pass | 3f/2p |
| cc-22:CC-22-27 | fail | pass | fail | pass | fail | fail | 3f/2p |
| cc-23:CC-23-07 | fail | pass | fail | n/a | fail | pass | 2f/2p/1na (3-way) |
| cc-23:CC-23-08 | pass | n/a | pass | pass | n/a | pass | 3p/2na |
| cc-24:CC-24-04 | n/a | warn(raw:fail) | n/a | n/a | warn(raw:fail) | n/a | 3na/2w |
| cc-24:CC-24-13 | n/a | warn(raw:fail) | n/a | n/a | warn(raw:fail) | n/a | 3na/2w |
| cc-24:CC-24-16 | n/a | warn(raw:fail) | n/a | n/a | warn(raw:fail) | n/a | 3na/2w |
| cc-3:CC-3-21 | fail | fail | pass | fail | pass | fail | 3f/2p |
| cc-3:CC-3-23 | fail | fail | fail | pass | fail | pass | 3f/2p |
| cc-3:CC-3-24 | pass | fail | pass | pass | fail | pass | 3p/2f |
| cc-5:ADR-01 | pass | pass | fail | fail | pass | pass | 3p/2f |
| cc-5:ADR-04 | pass | pass | fail | fail | pass | pass | 3p/2f |
| cc-6:CMP-01 | fail | pass | fail | fail | pass | fail | 3f/2p |

**Character of disagreement**:
- Tentative direction: 11 fail, 5 pass, 3 n/a. Disagreement axes: pass↔fail 10 items (the dominant mode — genuine judgment calls on whether a deficiency exists); pass↔n/a 2; fail↔n/a 1; fail↔warn 1; warn↔n/a 3; three-way 2.
- **Spread, not concentrated**: 9 of 14 groupings contribute — cc-22 (4), cc-3 (3), cc-24 (3), cc-5 (2), cc-21 (2), cc-23 (2), cc-10 (1), cc-13 (1), cc-6 (1). No single-grouping pathology.
- Two thematic clusters worth flagging: (a) **cc-24 ROW/License-Agreement items 04/13/16** are the identical vote pattern — runs 1 & 4 emitted `fail` (clamped to `warn`), runs 2/3/5 said `not-applicable`. This is an *applicability* disagreement (are plantings/agreements in ROW at all?), and note the clamp did not change the outcome here (raw 2f/3na would also be uncertain-tentative-n/a). (b) **cc-21 (the warn-first-class DCM 1.2.2 grouping)**: both uncertains are on `fail-or-warn` items (verified in cc-21.md) where the agents' authoritative fail-vs-warn protocol determinations genuinely diverged — expected behavior for acknowledgeable items, not a clamp bug.
- 17/19 uncertains are 3–2 splits; only 2 (cc-21:CC-21-01, cc-23:CC-23-07) are deeper 2-2-1 splits.

**Gate sensitivity at threshold 0.35, 5 runs** (boundary: maxCount 3 uncertain / 4 decided):
- **17 of 19 uncertain items sit at maxCount=3** — one flipped vote (dissent→winner) would decide them.
- **29 of 175 decided items sit at maxCount=4** — one flipped vote (winner→dissent) would make them uncertain. These include 6 of the 7 fails and 2 of the 4 warns (list below).
- **Total: 46/194 items (23.7%) are within one vote of flipping.** The gate is operating in a genuinely sensitive region of vote space; the 19-uncertain count is a faithful, not inflated, read of run variance.

**Fail/warn margins** (the product-visible verdicts):
- fail (7): `cc-23:CC-23-01` unanimous 5-0; `cc-1:CC-1-34` 4f/1na (incl. run-3's warn→fail clamp); `cc-22:CC-22-12/13/20/25` and `cc-23:CC-23-10` all 4f/1p. So **6 of 7 fails are 4-1** — solid majorities but each one vote from uncertain.
- warn (4): `cc-1:CC-1-32` 5-0 (unanimity partly clamp-made: run-1 raw fail); `cc-24:CC-24-15` 5-0 (all 5 raw fails clamped); `cc-13:AW-29`, `cc-13:AW-30` 4w/1p.

## 5. Design assessment

The specific defensive-coding asks in the audit charge are **already implemented in this as-ran version**: ID normalization with warn counter (`checklist-policy.ts:139-148`), checklist validation of every emitted ref, loud abort above a 10% unknown-ref share (`cross-run-consolidate-cc.ts:63, 306-312`), and explicit refusal to default unknown refs' failStatus to `'fail'` (lines 269-276). This is clearly the post-mortem hardening from the 50a1a78d fragmentation incident, and it worked (armed, untriggered, evidenced in the sidecar).

**One real remaining gap — reverse-coverage check**: the script validates *emitted refs against the checklist* but not *the checklist against emitted refs*. `itemMap` is keyed only by refs the agents emitted (`cross-run-consolidate-cc.ts:207, 285-287`); a checklist item that no run ever emitted would silently vanish from `consolidated-findings.json` and findingsDir with no warning — the only signal is the eyeball-diff in the `Loaded … 194 unique checklist items (checklist defines 194)` line. This run happened to be exactly 1:1, but a cell that consistently drops an item (e.g. schema truncation) would produce an undetected coverage hole. **Concrete fix** (after line 296): compute `missingCoverage = [...failStatusLookup.keys()].filter(r => !itemMap.has(r))`, `console.warn` when non-empty, add `missingCoverageRefs` to the sidecar (line 412 block), and consider synthesizing an `uncertain`/`missing` consolidated item so downstream sees the hole rather than nothing.

Minor: the per-run missing-vote signal exists per item (`voteBreakdown.missing`) and in aggregate (`perRunFindingsSeen`), but a per-run findings-count line (`run-2: 193/194`) would have pinpointed the cc-2 run-2 drop instantly instead of requiring a jq sweep.

## 6. What went right

- 194/194 refs matched the checklist exactly; zero stripped prefixes, zero unknown refs — the ID contract held and the defenses stayed quiet.
- Pre-vote clamp fired 13 times, all consistent with the checklist's Fail Status cells (verified against `v2.7-trimmed/cc-1.md`, `cc-24.md`); raw statuses preserved as `emittedStatus`; `cc-24:CC-24-15`'s 5× fail→warn is the clamp doing precisely its designed job.
- Vote math, gate boundary, tie-breaks, confidence tiers, missing-vote handling, and winningFinding selection all verified correct against the code on real items (incl. the single 1-missing item `cc-2:CC-2-24` → pass/medium, and both 2-2-1 severity tie-breaks).
- Output artifacts are mutually consistent (log stdout ↔ sidecar ↔ consolidated-findings.json ↔ findingsDir files).
- Fixture test file (`consolidate-logic.test.ts`) ships alongside the pure logic module.

## 7. What went wrong

Nothing functional. Notes:
- The 19-uncertain count (9.8% of items) is entirely genuine run-to-run disagreement, 89% of it in 3–2 splits — a model-variance/prompt-determinism issue, not a consolidation issue. If the uncertain volume is unwanted, the levers are more runs, better methodology text in the noisy groupings (cc-22, cc-3, cc-24 applicability rules, cc-5), or a threshold change — not this script.
- 6 of 7 product-visible fails sit at 4-1 margins (one vote from uncertain) — worth knowing when interpreting fail stability across reruns.
- Reverse-coverage gap described in §5 (latent, not triggered here).

## 8. Observability gaps & remediations

**What it logged** (and where): the full stdout made it into the pino log this run — the `step.script.completed` event for `cross-run-consolidate-cc` carries `stdout` with all 13 CLAMP-PRE-VOTE lines, `Loaded 5/5 runs, 194 unique checklist items (checklist defines 194)`, the clamp count, per-status/confidence totals, and output paths; `stderr` empty; `duration_ms: 559`. So the header comment at `cross-run-consolidate-cc.ts:404` ("conductor discards script stdout (pre-#213)") is now stale for this conductor build — the #212/#213 observability remediation is evidently live, and the sidecar (`consolidation-summary.json`) provides belt-and-suspenders persistence anyway. The charge's asked-for one-liners (vote-missing distribution, per-status counts, unknown-ref count, "N unique refs vs M checklist items") are **all present** across stdout + sidecar.

**Remaining gaps → remediations**:
1. **Missing-coverage refs** (checklist items never emitted) — add to warning + sidecar as in §5. Highest value.
2. **Per-run findings counts** (`run-i: n/194`) in stdout + sidecar — would localize attrition like cc-2/run-2 without post-hoc jq.
3. **Gate-margin summary** — one sidecar field like `itemsWithinOneVoteOfGate: {decided: 29, uncertain: 17}` and the list of uncertain refs with vote strings; cheap to compute at line 405's block and exactly what a run-health dashboard wants.
4. Housekeeping: update the stale "conductor discards stdout" comment (line 403-404) to note stdout is now captured, keeping the sidecar as the durable artifact.

---

**Verdict: HEALTHY** — algorithm correct and verified against outputs at every seam; incident-hardening defenses present and quiet; the 19 uncertains are honest disagreement, 46/194 items sit within one vote of the 0.35 gate boundary; only latent (untriggered) gap is the missing reverse-coverage check.
