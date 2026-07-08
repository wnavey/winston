# Agent 2 — `cross-run-consolidate-cc` audit

**Review:** `ae7cb127-6103-48d2-9107-a320155b5436`
**Step wall:** 0.6s (594ms per log)
**Verdict:** `HEALTHY`

---

## Step purpose

Merge 5 runs × 14 groupings = 70 per-run finding files into one `output/consolidated-findings.json` (194 items) via cross-run majority vote. Before voting, apply the Fail Status pre-vote clamp so per-item policy doesn't manufacture dissent, then apply the uncertainty gate (`uncertain` when winner-share ≤ 1 − threshold at runs ≥ 3). Also writes per-grouping post-consolidation files to `output/findings/<grouping>.md.json` for `enrich-findings`.

Script: `workflow/scripts/cross-run-consolidate-cc.ts`. Pure logic: `workflow/scripts/consolidate-logic.ts` + `workflow/scripts/checklist-policy.ts`. Tests: `workflow/scripts/consolidate-logic.test.ts`.

## Algorithm as implemented

1. **Args + validation** (`cross-run-consolidate-cc.ts:128-154`). Requires `runsDir`, `findingsDir`, `runCount`. `checklistsDir` is required when `runCount > 1` (`cross-run-consolidate-cc.ts:176`). `uncertainThreshold` defaults to `DEFAULT_UNCERTAIN_THRESHOLD = 0.35` (`consolidate-logic.ts:62`) and is range-validated.
2. **Single-run passthrough** (`cross-run-consolidate-cc.ts:159-171`): copies `run-1/findings/*.json` verbatim — no clamp, no vote. Not relevant here (runs=5).
3. **Key contract** (`cross-run-consolidate-cc.ts:239-252`):
   - Raw agent-emitted `checklistItemId` first passed through `normalizeChecklistItemId(grouping, rawId)` (`checklist-policy.ts:139-148`) — strips **only the cell's own** `{grouping}:` prefix when present. Foreign-grouping prefixes are left intact and surface as unknown refs.
   - Vote key: `{grouping}:{normalizedId}` (`cross-run-consolidate-cc.ts:252`), where `grouping` comes from the **filename** (authoritative), not the agent output.
4. **Unknown-ref guard** (`cross-run-consolidate-cc.ts:253-297`):
   - Any ref not in the Fail Status lookup is added to `unknownRefs`.
   - Fail-loud: if `unknownRefs / itemMap.size > UNKNOWN_REF_ABORT_SHARE (0.10)`, throw. The comment cites the 2026-07-07 fragmented run (review `50a1a78d`) at 40%.
   - No silent `|| 'fail'` default on the clamp for unknown refs — `checklist-policy.ts:259` explicitly does `knownRef ? failStatusLookup.get(ref)! : null`, and `clampStatus` is only called when `failStatus` is non-null. Emitted status flows through when the ref is unknown (documented at `:257-262`).
5. **Pre-vote clamp** (`checklist-policy.ts:221-232`): `fail → warn` when advisory, `warn → fail` when blocking, `fail-or-warn` and pass/n-a pass through. Clamped statuses are logged and preserved as `emittedStatus` on the per-run finding.
6. **Vote + gate** (`consolidate-logic.ts:64-116`):
   - `maxCount = max(counts)`; ties broken by severity `fail > warn > n/a > pass` (`STATUS_SEVERITY`, `:55-60`).
   - Confidence: `high` iff `maxCount === totalRuns`, else `medium` iff `≥ 2`, else `low`.
   - `voteBreakdown.missing = max(0, totalRuns − statuses.length)`. Missing votes count as dissent (denominator is `totalRuns`).
   - Uncertain fires only when `totalRuns ≥ 3` AND `winnerShare = maxCount/totalRuns ≤ 1 − threshold` (inclusive; `consolidate-logic.ts:98-108`). For threshold=0.35, runs=5 → gate at `≤ 0.65` → 3/5 = 0.6 IS uncertain, 4/5 = 0.8 is decisive.
   - `tentativeStatus` is the severity tie-broken winner, populated ONLY when `status === 'uncertain'`.
7. **Winning-finding selection** (`cross-run-consolidate-cc.ts:315-318`): earliest run whose **normalized** status matches the display verdict (tentativeStatus when uncertain, else consolidated status). Winning finding is rewritten with `status = normalizedStatus`, so `output/findings/*.md.json` stays 4-state and policy-clean.
8. **Outputs** (`cross-run-consolidate-cc.ts:344-367`): `output/consolidated-findings.json` (full multi-run data) + `output/findings/<grouping>.md.json` (winning finding per item, matches the shape `enrich-findings` expects).

## What happened (evidence)

### Inputs / step invocation

`logs/completeness-check.log:29042` shows the exact rendered command:
```
npx tsx …/cross-run-consolidate-cc.ts \
  --runsDir='…/output/runs' --findingsDir='…/output/findings' \
  --runCount='5' \
  --checklistsDir='…/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed' \
  --uncertainThreshold='0.35'
```
All five template variables rendered. No unrendered `{{ input.* }}`.

### Coverage / integrity

| Check | Expected | Actual | ✓ |
|---|---|---|---|
| Total items in consolidated | 194 (checklist) | 194 | ✓ |
| Unique refs | 194 | 194 | ✓ |
| Refs with `≥2` colons (fragmentation) | 0 | 0 | ✓ |
| Groupings covered | 14 | 14 | ✓ |
| Per-run findings files | 14 × 5 = 70 | 70 | ✓ |
| Per-grouping post-file counts vs run-1 | equal | equal (all 14) | ✓ |
| Items with `voteBreakdown.missing > 0` | 0 | 0 | ✓ |
| Clamped findings across 970 (194×5) | (unknown; content-dependent) | 0 | ✓* |

*Zero clamps means the review prompt is producing per-run statuses that already respect the Fail Status column — no clamp was needed on this run.

### Status distribution (from `output/consolidated-findings.json`)

| Status | Count |
|---|---|
| pass | 107 |
| not-applicable | 61 |
| uncertain | 16 |
| warn | 6 |
| fail | 4 |
| **Total** | **194** |

Matches DB metadata (`SHARED_CONTEXT.md`) exactly.

### Confidence distribution

| Confidence | Count | Interpretation |
|---|---|---|
| high | 156 | Unanimous 5/5 |
| medium | 38 | 22 decisive at 4/5 + 16 uncertain |
| low | 0 | (would require max count = 1, impossible with 5 runs and 4 statuses) |

Verified: all 156 `high` items have max=5, all 22 non-uncertain `medium` items have max=4. Sharp gate boundary — no decisive item sits at 3/5 (would be uncertain instead).

### Vote spot-check on all 16 uncertain items

| ref | breakdown (p/f/w/na) | winnerShare | tentative | verdict |
|---|---|---|---|---|
| cc-10:AE-01 | 3/2/0/0 | 0.60 | pass | 3/5 ≤ 0.65 → uncertain ✓ |
| cc-13:AW-05 | 3/2/0/0 | 0.60 | pass | ✓ |
| cc-13:AW-14 | 2/0/0/3 | 0.60 | not-applicable | ✓ |
| cc-13:AW-23 | 3/2/0/0 | 0.60 | pass | ✓ |
| cc-13:AW-28 | 3/1/0/1 | 0.60 | pass | ✓ |
| cc-13:AW-30 | 2/0/3/0 | 0.60 | warn | ✓ |
| cc-13:AW-32 | 2/0/0/3 | 0.60 | not-applicable | ✓ |
| cc-15:CC-15-08 | 2/0/0/3 | 0.60 | not-applicable | ✓ |
| cc-2:CC-2-14 | 3/2/0/0 | 0.60 | pass | ✓ |
| cc-21:CC-21-01 | 1/3/1/0 | 0.60 | fail | ✓ |
| cc-22:CC-22-14 | 2/3/0/0 | 0.60 | fail | ✓ |
| cc-22:CC-22-15 | 2/1/0/2 | 0.40 | not-applicable | tie 2-2, severity na(1) > pass(0) → tentative n/a ✓ |
| cc-22:CC-22-20 | 3/2/0/0 | 0.60 | pass | ✓ |
| cc-23:CC-23-07 | 1/1/0/3 | 0.60 | not-applicable | ✓ |
| cc-23:CC-23-08 | 2/1/0/2 | 0.40 | not-applicable | tie 2-2, na > pass ✓ |
| cc-23:CC-23-10 | 2/3/0/0 | 0.60 | fail | ✓ |

**All 16 uncertains are TRUE cross-run disagreements** with counts summing to 5 (no missing votes). Zero uncertains are missing-driven.

- 12 are 3-2 splits with `winnerShare = 0.6` (right at the gate: 0.6 ≤ 1−0.35 = 0.65).
- 2 are 3-1-1 splits (`cc-13:AW-28`, `cc-23:CC-23-07`) also at 0.6.
- 2 are 2-2-1 splits (`cc-22:CC-22-15`, `cc-23:CC-23-08`) at winnerShare=0.4, tie-broken by severity (n/a wins over pass).

Tie-breaking behavior matches `STATUS_SEVERITY` at `consolidate-logic.ts:55-60`. `perRunFindings[*].emittedStatus` is `null` (i.e., unset) for every uncertain item, confirming the disagreements are on emitted (not clamped) statuses.

### Gate sensitivity

Decisive-item winner-count distribution: **156 at 5/5 unanimous, 22 at 4/5, zero at 3/5** (would be uncertain). The 22 items at 4/5 are one flipped vote away from being uncertain — the gate is functioning as a sharp step at `winnerShare = 2/3` for runs=5. Would-be flippers by status:

```
$ jq -r '.[] | select(.status != "uncertain" and (([.voteBreakdown.pass,.voteBreakdown.fail,.voteBreakdown.warn,.voteBreakdown."not-applicable"] | max) == 4)) | .status' consolidated-findings.json | sort | uniq -c
```
Reported: pass=13, not-applicable=6, fail=2, warn=1 (informational; not investigated further because none reflect data-integrity concerns).

### Per-grouping post-file consistency

For all 14 groupings, `output/findings/<grouping>.md.json` has the SAME finding count as `output/runs/run-1/findings/<grouping>.md.json` (identical counts across all 5 runs — the pre-scan confirmed this). Verified explicitly:

```
cc-1     33/33   cc-10    4/4    cc-13   37/37   cc-15   14/14
cc-19   22/22    cc-2      6/6   cc-20    6/6    cc-21   10/10
cc-22   14/14    cc-23   11/11   cc-24    9/9    cc-3    11/11
cc-5    14/14    cc-6      3/3
```

Sum = 194.

Spot-check: uncertain item `cc-21:CC-21-01` has `tentativeStatus = fail`, and `output/findings/cc-21.md.json` records `CC-21-01 → fail` (the winning-finding's normalized status), which is the tentativeStatus. This is by design (`cross-run-consolidate-cc.ts:315-318,339,362`) — findingsDir stays 4-state; the `uncertain` label lives on `consolidated-findings.json` only, to be picked up by `apply-forced-outcomes` / `explain-uncertain` / `enrich-findings`.

## What went right

- **Key contract is deterministic and grounded in the filename**, not the agent output. `normalizeChecklistItemId` strips only the cell's own grouping prefix — foreign prefixes fall into the unknown-ref bucket instead of silently colliding.
- **No silent fallback on unknown refs**: `cross-run-consolidate-cc.ts:259` guards `clampStatus` behind `knownRef`, so a missing checklist entry doesn't invert warn/fail policy. The abort at 10% unknown-ref share is loud and cites the 2026-07-07 fragmented run as prior art.
- **Gate math verified against every uncertain** — 16/16 items follow the formula exactly, including tie-breaking.
- **No missing votes anywhere** on this run (194/194 items covered by all 5 runs).
- **Zero clamps** — `emittedStatus` unset on all 970 per-run entries — indicates the baseline review prompt is producing statuses that already respect Fail Status policy on this checklist. Independent from the consolidate step but worth noting for Agent 1.
- **Per-grouping post-files stay 4-state and policy-clean** — the winning finding is rewritten with its normalized status (`cross-run-consolidate-cc.ts:339`), so `enrich-findings` never sees `uncertain` on the per-grouping path.
- **Fixture tests** (`consolidate-logic.test.ts`) cover: unanimous, 2-1 above threshold, 1-1-1 tie with severity tie-break, warn/n-a tie, 3-2 at boundary, 3-1-1 partial dissent, 4-1 decisive, missing-run dilution (3-missing forces uncertain, 1-missing preserves winner), gate-disabled below runs=3, threshold sensitivity (0.5 boundary), the two clamp rewrite rules, `fail-or-warn` passthrough, and — new since the 2026-07-07 fragmentation post-mortem — 7 `normalizeChecklistItemId` cases including foreign-grouping non-stripping and prefix-partial-match traps (cc-1 vs cc-13). Tests DO cover the fragmentation, missing-vote, and tied-majority failure modes from prior CC incidents.
- **Wall time 0.6s** for 970 findings + 194 votes + 14 file writes. No hot-loop issues.

## What went wrong

Nothing on this run. The step ran clean:

- No warnings emitted (no stripped prefixes, no unknown refs — pre-scan already confirmed `unknownRefs = 0`).
- No clamps (Fail Status column not exercised on this content).
- No missing votes.

## Observability gaps & remediations

1. **Conductor discards script stdout, and the step logs *nothing* to `completeness-check.log` beyond `Executing step` and `Step completed`** (verified via grep: 0 matches for `CLAMP-PRE-VOTE`, `stripped grouping prefix`, `Loaded … runs`, `Consolidated: … items`, `unique refs match no checklist`). The script's carefully-authored summary at `cross-run-consolidate-cc.ts:280-300, 381-385` — clamp count, stripped-prefix count, unknown-ref count, per-status counts, per-confidence counts, uncertainThreshold — all went to a bit-bucket.

   **Remediation:** emit a machine-readable summary sidecar (`output/consolidation-summary.json`) with `{runsFound, itemsTotal, checklistTotal, strippedCount, unknownRefs: [], clampCount, statusCounts, confidenceCounts, uncertainThreshold}`. Two lines of code at `cross-run-consolidate-cc.ts:385`. Downstream audit + monitoring stops depending on stdout that never arrives.

2. **No per-item post-condition on unique-ref count vs checklist size.** The step logs `itemMap.size` vs `failStatusLookup.size` (`:280`) but does not compare `consolidated.length` to `failStatusLookup.size`. If a run's `findings/*.json` were partially truncated (JSON parse error → skip, `:222-224`), we'd silently lose items. The single "abort on high unknown-ref share" is the only integrity gate.

   **Remediation:** after consolidation, if `consolidated.length !== failStatusLookup.size`, warn (or abort behind a flag). Cheap invariant.

3. **JSON parse error is silently swallowed** (`cross-run-consolidate-cc.ts:222-224`): a corrupt per-run findings file produces a `console.warn` (invisible per point 1) and drops that entire grouping's findings for that run. On a 5-run job this manifests as `voteBreakdown.missing = 1` across all items in the grouping — visible in the output but not attributed.

   **Remediation:** track skipped-file count in the sidecar summary; abort if any run drops a full grouping.

4. **`groupingSummaries` picks the first run's summary arbitrarily** (`cross-run-consolidate-cc.ts:363`). Non-critical (grouping summaries are advisory), but worth noting: cross-run summary variance is invisible.

5. **Runs=1 passthrough uses `existsSync` fallback** (`cross-run-consolidate-cc.ts:161`) — but it throws when missing, so this is a fail-loud check, not a silent fallback. Fine.

## Verdict

`HEALTHY`. Algorithm implementation matches the design spec and tests, all 194 items are covered with zero missing votes, all 16 uncertains are true 3/5 or 2-2-1 cross-run disagreements matching the recorded voteBreakdown and gate formula, per-grouping post-files match run-1 counts exactly, no silent fallbacks tripped, no unknown refs, no fragmentation, no clamps needed. Only real gaps are observability (stdout discarded, no summary sidecar) — remediable in a couple lines. This step is not implicated in any downstream findings this synthesis will surface.
