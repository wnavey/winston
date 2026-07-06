# Completeness Check `uncertain` Status — Design Spec

> **Status:** Draft, 2026-07-06. Ports the CRC uncertain-status concept
> ([../../comment-resolution-check/crc-workflow/uncertain-status/DESIGN-SPEC.md](../../comment-resolution-check/crc-workflow/uncertain-status/DESIGN-SPEC.md))
> to the completeness-check workflow. Decisions locked in the 2026-07-06
> grilling session (20 questions). Drives a bureau PR + a cityhall PR.

---

## 1. Summary

Add a fifth value to completeness-check's **consolidated** status enum —
**`uncertain`** — that fires when the majority vote across runs is not
decisive enough to trust as a verdict. Same rule as CRC:

> **A consolidated checklist item is `uncertain` when the winning status's
> share of votes is at or below `1 − uncertainThreshold` (default
> threshold 0.35, i.e. winner ≤ 65% of `totalRuns`).**

When `uncertain`, the workflow still records the would-be winner (under
the existing severity tie-break) as `tentativeStatus`, plus a structured
`voteBreakdown`, so downstream consumers (cityhall UI, reports) don't
have to recompute from `perRunFindings`.

**The one place this is NOT a straight port of CRC:** completeness-check
mutates statuses *after* consolidation — the Fail Status policy clamp
lives in `enrich-findings.ts` (fail-status DESIGN-SPEC, bureau #496), and
`apply-forced-outcomes.ts` overrides findings between the consolidate and
enrich steps. CRC's "consolidated status is authoritative" pattern would
bypass both. This spec therefore **moves policy normalization ahead of
the vote** (§5.2) and makes the forced-outcome override take precedence
over the consolidated status (§5.3). Votes are counted on
**policy-normalized (post-clamp) statuses**, so an advisory
(`Fail Status: warn`) item where runs emit `[fail, warn, warn]` is a
unanimous `warn`, not a 33%-dissent uncertain.

## 2. Goals

- **Surface ensemble disagreement as a first-class verdict** instead of
  burying it in a `confidence: medium/low` badge — same motivation as CRC.
- **Tunable threshold**, exposed as a workflow input (`uncertainThreshold`,
  default 0.35), no code change needed to dial it.
- **No false uncertainty from policy noise.** The gate evaluates the same
  statuses the product would have displayed — post-clamp — so per-item
  Fail Status policy differences between runs can't manufacture dissent.
- **No agent-prompt or emit-schema changes.** The agent still emits the
  4-state enum (`pass | fail | warn | not-applicable`); `uncertain` is
  purely a consolidation-time computation.
- **Reuse the cityhall surface CRC already built.** The `CcCrcTab` type,
  the amber `uncertain` pill in `CompletenessCommentCard.svelte`, and the
  tab-filtering machinery all exist; CC needs them wired to its branch.

## 3. Non-goals (this spec)

- **Manual user adjudication of `uncertain` items.** Same posture as CRC:
  `status` is and remains the agent's consolidated verdict; a future
  override lives in a sibling field. The two CRC guardrails (§3.1 of the
  CRC spec) apply here identically.
- **Backfill.** No existing CC reviews are backfilled (Q16). Uncertain
  appears on fresh runs only. Old multi-run CC reviews keep their current
  4-state statuses.
- **`completeness-check-anchored`.** Out of scope (Q15b). The anchored
  re-review workflow (`finalize-cc-re-review.ts`) keeps its current
  semantics; if it ever gains multi-run support, port the gate then.
- **completion-officer.** Untouched (Q17) — uncertain is consolidation-time
  logic; there are no guide changes to mirror.
- **Asymmetric voting / status blocs.** Strict per-status voting (Q5).
  `[pass, pass, not-applicable]` is 33% dissent even though both statuses
  mean "nothing to fix" — pass-vs-n/a disagreement often signals a real
  applicability question worth a human look. Bloc grouping is future work.
- **Confidence-tier removal.** `confidence` (`high`/`medium`/`low`) stays
  alongside, orthogonal: confidence = "did all expected runs land,"
  uncertainty = "did they agree."

## 4. Pre-requisite — remove vestigial `unclear` plumbing

**Bead: `noetic-4ji`.** The fail-status work (bureau #496) removed
`unclear` from the agent contract — `completeness.emit.schema.json`'s
enum is now `["pass", "fail", "warn", "not-applicable"]` and
`prompts/review.md` no longer mentions it. Verified against review
`3ae1ee78-437b-4da3-9d52-1f19c380b791` (2026-07-02, v2.6-trimmed,
runs=3): zero `unclear` in both top-level statuses and all 582 raw
per-run votes; `metadata.unclearCount` is 0.

But dead `unclear` handling remains in the scripts and MUST be deleted
**before or with** this feature (it sits in exactly the code paths this
spec modifies):

| File | Vestige |
|---|---|
| `cross-run-consolidate-cc.ts` | `'unclear'` in the `Status` type + severity map (`fail > unclear > warn > n/a > pass`) |
| `build-review-comments.ts` | unclear→warn coercion at the DB boundary (~line 177), `unclearCoercedCount`, `metadata.unclearCount` |
| `enrich-findings.ts` | `'unclear'` in `RawFinding.status`, per-grouping/total unclear counts |
| `generate-reports.ts` | unclear icon + counts |
| `apply-forced-outcomes.ts` | `'unclear'` in the status type union |

Post-cleanup the CC status vocabulary is 4-state everywhere, the
severity order is **`fail > warn > not-applicable > pass`**, and
`metadata.unclearCount` is no longer written (cityhall reads it with
`?? 0` at `+page.svelte:553`, so absence is safe).

This also retires the CRC spec's naming concern (its D11 chose
`uncertain` specifically to avoid CC's `unclear`): `unclear` no longer
exists in live CC output, so `uncertain` is unambiguous.

## 5. Design decisions (locked, from the 2026-07-06 Q&A)

| # | Decision | Choice | Source |
|---|---|---|---|
| D1 | Name | **`uncertain`** — same value as CRC | Q1 (collision with `unclear` mooted by §4) |
| D2 | Threshold rule | **Winner-share gate, ported exactly**: `uncertain ⟺ (winnerCount / totalRuns) ≤ (1 − uncertainThreshold)`, boundary inclusive, default `0.35`, input named `uncertainThreshold` | Q2 |
| D3 | Minimum runs | Gate applies only when **`totalRuns ≥ 3`**; runs=2 takes the multi-run path but never yields uncertain; runs=1 passthrough unchanged | Q3 |
| D4 | Vote domain | **Post-clamp (policy-normalized) statuses.** Per-run statuses are normalized by the Fail Status policy BEFORE voting, even though that necessitates a refactor (clamp moves ahead of the vote — §5.2) | Q4 |
| D5 | Vote semantics | **Strict per-status** — no semantic blocs. Missing runs count as dissent (denominator is `totalRuns`) | Q5, Q10 |
| D6 | Severity tie-break | **`fail > warn > not-applicable > pass`** (4-state; post-§4 cleanup). Used for winner selection among tied counts and therefore for `tentativeStatus` | Q5/Q8 |
| D7 | Forced outcomes | **Forced beats uncertain.** A forced item's status is the forced status, never `uncertain`, regardless of vote spread. The real `voteBreakdown` is still persisted, and the agent trace flags the force (existing `agentTrace.forced` / `forcedReason` / `organicStatus` fields) | Q7 |
| D8 | Architecture | Mirror CRC: gate computed in `cross-run-consolidate-cc.ts`; `build-review-comments.ts` treats the consolidated status as authoritative (behind the forced-outcome guard); `tentativeStatus` + `voteBreakdown` persisted on `review_comments.output_json` | Q9 |
| D9 | `voteBreakdown` shape | `{ pass, fail, warn, "not-applicable", missing }` — **post-clamp counts** (the same votes the gate evaluated, so the breakdown always explains the verdict arithmetic). `missing = totalRuns − presentVoteCount`; sums to `totalRuns`. UI can surface "uncertain — 2 of 5 runs produced no finding" | Q10 |
| D10 | `tentativeStatus` | New optional field on `output_json`, populated **only when `status='uncertain'`**; value is the would-be winner (majority + D6 tie-break); never `'uncertain'` itself | Q8 |
| D11 | Metadata | Add `uncertainCount` + `uncertainThreshold` to `reviews.output_json.metadata`. All five status counts derived from the **final per-comment statuses** (consolidated + forced overlays), not `enriched.totals` — no double-counting (CRC §5.3 fix, adapted) | Q11 |
| D12 | `resolution` on uncertain | **Carry the tentative winner's resolution text** when `tentativeStatus` is `fail`/`warn`, so the applicant still sees a suggested fix behind the callout | Q12 |
| D13 | Cityhall tabs | Add `Uncertain` tab to the CC branch of `ccStatusTabs`. **Default tab stays `'all'`** (CC convention; no CRC-style land-on-uncertain) | Q13 |
| D14 | Pill color | **Amber** (`text-amber-700 bg-amber-50 border-amber-200`) — same as CRC. Sits next to CC's yellow `warn`; acceptable, revisit later if confusing | Q14 |
| D15 | Prior-review deltas | Version history renders `uncertain` as a first-class status ("v1: Uncertain → v2: Pass" visible in the history strip). Transitions with an uncertain endpoint are **excluded from the fixed/regressed counters** (§8.4) | Q15a |
| D16 | Backfill | **None** | Q16 |
| D17 | Reports | Uncertain items render with an "agent could not reach consensus — tentative verdict: X (breakdown)" callout, CRC D20 treatment | Q18 |
| D18 | `output_schema` | **Stays `'legacy'`** — no `review_schema:` line, new fields ride inside `output_json` (same rationale as CRC D14: cityhall renders an "Unsupported review format" error for unknown schema strings) | Q19 |
| D19 | Deliverables | This winston spec PR now; implementation = one bureau PR + one cityhall PR. No impl beads created from this spec (only the §4 pre-req bead exists) | Q20 |
| D20 | Emit schema | `completeness.emit.schema.json` / `completeness.schema.json` **unchanged** — the agent never emits `uncertain` | Q9 |

## 6. Workflow changes

All in `bureau/workflows/completeness-check/`.

### 6.1 `workflow.yaml`

Add the input (sibling to `runs`):

```yaml
  uncertainThreshold:
    type: number
    required: false
    default: 0.35
    description: |
      Dissent share at or above which a consolidated checklist item gets
      status='uncertain'. Equivalent rule: winning status's share of
      votes must EXCEED (1 - threshold) to avoid uncertainty. Votes are
      counted on policy-normalized (Fail Status clamped) statuses. Only
      applies when runs >= 3; below that the consolidate script skips
      the uncertainty gate entirely. See
      winston/workspaces/completeness-check/uncertain-status/DESIGN-SPEC.md
```

Plumb through to the two consuming steps:

- `cross-run-consolidate-cc` gains `uncertainThreshold` **and**
  `checklistsDir: "{{ WORKSPACE_PATH }}/bureau/{{ input.checklistsDir }}"`
  (needed to resolve each item's Fail Status for the pre-vote clamp).
- `build-review-comments` gains `uncertainThreshold` (metadata provenance
  only — the gate has already been applied upstream).

Step order is unchanged:
`review → cross-run-consolidate-cc → apply-forced-outcomes → enrich-findings → format-reports → build-review-comments`.

### 6.2 `cross-run-consolidate-cc.ts` — the main change

Five edits (on top of the §4 `unclear` removal):

**(a) Shared Fail Status parsing.** Extract the checklist-table parsing
that resolves each item's `failStatus` (`fail | warn | fail-or-warn`,
currently `enrich-findings.ts:89-169` `extractChecklistItems` + the
column-defaulting rules) into a shared module, e.g.
`scripts/lib/checklist-policy.ts`, imported by both `enrich-findings.ts`
and `cross-run-consolidate-cc.ts`. Do NOT copy-paste a second parser —
the 8/7/5/4-column format handling must stay single-sourced.

**(b) Pre-vote clamp.** For each per-run finding, compute the
policy-normalized status using exactly the clamp rules from
`enrich-findings.ts:245-254` (fail-status DESIGN-SPEC):

- `failStatus === 'warn'` and run emitted `fail` → normalize to `warn`.
- `failStatus === 'fail'` (or column absent) and run emitted `warn` →
  normalize to `fail`.
- `failStatus === 'fail-or-warn'` → pass through untouched.
- Log every normalization (`CLAMP-PRE-VOTE: cc-N:ID fail -> warn (run-2)`).

The **vote, the uncertainty gate, `voteBreakdown`, and
`perRunFindings[].status` all use the normalized status.** This keeps
cityhall's `votedForWinner` check (`run.status === comment.status`)
coherent — otherwise an advisory item whose runs all emitted `fail`
(displayed `warn`) would render every run as dissenting. When
normalization changed a run's status, record the raw value in a new
optional per-run field `emittedStatus` so nothing is lost.

**(c) Gate + widened types.** Same shape as CRC §5.2:

```ts
type Status = 'pass' | 'fail' | 'warn' | 'not-applicable' | 'uncertain';
type AgentStatus = 'pass' | 'fail' | 'warn' | 'not-applicable';

const STATUS_SEVERITY: Record<AgentStatus, number> = {
  'fail': 3,
  'warn': 2,
  'not-applicable': 1,
  'pass': 0,
};

function consolidate(
  statuses: AgentStatus[],          // POST-CLAMP per-run statuses
  totalRuns: number,
  uncertainThreshold: number,
): {
  status: Status;
  tentativeStatus: AgentStatus | null;
  confidence: 'high' | 'medium' | 'low';
  voteBreakdown: { pass: number; fail: number; warn: number; 'not-applicable': number; missing: number };
}
```

Logic is identical to CRC's `consolidate()`: count → max → severity
tie-break → confidence (unchanged tiers: unanimous-vs-totalRuns = high,
≥2 = medium, 1 = low) → `voteBreakdown` with
`missing = max(0, totalRuns − statuses.length)` → gate:

```ts
if (totalRuns >= 3 && (maxCount / totalRuns) <= 1 - uncertainThreshold) {
  return { status: 'uncertain', tentativeStatus: winnerStatus, confidence, voteBreakdown };
}
return { status: winnerStatus, tentativeStatus: null, confidence, voteBreakdown };
```

Missing runs dilute the winner's share by design — 2-of-5 `fail` with 3
dead runs is 40% winner share → uncertain. Heavy run attrition should
read as "don't trust this verdict," and the UI can say so from
`voteBreakdown.missing`.

**(d) `ConsolidatedItem` widening:**

```ts
interface ConsolidatedItem {
  ref: string;
  grouping: string;
  checklistItemId: string;
  status: Status;                          // 5-state
  tentativeStatus: AgentStatus | null;     // NEW — only when status='uncertain'
  voteBreakdown: VoteBreakdown;            // NEW — post-clamp counts
  confidence: 'high' | 'medium' | 'low';
  runCount: number;
  totalRuns: number;
  perRunFindings: PerRunFinding[];         // status = normalized; emittedStatus = raw when clamped
  winningFinding: AgentFinding;            // see below
}
```

`winningFinding` selection: earliest run whose **normalized** status
matches the effective verdict for display (`tentativeStatus` when
`status='uncertain'`, else `status`). Write the winning finding into the
per-grouping `findingsDir/{grouping}.md.json` with its **normalized**
status, so the downstream file is always policy-clean. `AgentFinding`
stays 4-state — `uncertain` never appears in `findingsDir` files.

**(e) Closing log line** gains the uncertain count and threshold:

```
  Status: ${pass} pass, ${fail} fail, ${warn} warn, ${na} n/a, ${uncertain} uncertain (threshold ${threshold})
```

**Interaction with the `enrich-findings` clamp:** the enrich clamp
(`enrich-findings.ts:245-254`) **stays in place unchanged**. On multi-run
paths it becomes a no-op (winning findings arrive already normalized);
on the runs=1 passthrough it remains the sole policy-enforcement point,
exactly as the fail-status spec designed. Add a code comment in both
files cross-referencing the duplication and the shared `lib` module.

### 6.3 `build-review-comments.ts`

- New `--uncertainThreshold` arg (metadata provenance only).
- Widen the local `ConsolidatedItem` interface (currently ~lines
  105-118, carrying only `ref/confidence/runCount/totalRuns/perRunFindings`)
  with `status` (5-state), `tentativeStatus`, `voteBreakdown`.
- **Status assignment precedence** (replaces today's
  `finding.forcedStatus || finding.status` at ~line 174):

  ```ts
  const effectiveStatus = finding.forced
    ? (finding.forcedStatus || finding.status)   // D7: forced beats uncertain
    : (consolidated?.status ?? finding.status);  // consolidated 5-state authoritative;
                                                 // fallback = runs===1 passthrough
  ```

  Note the enrich clamp has already normalized `finding.status`, and the
  consolidated status was voted on normalized statuses, so the
  non-forced branches agree on policy for decisive votes; they diverge
  only when the gate fired (`'uncertain'`).
- When `effectiveStatus === 'uncertain'`:
  - `output_json.tentativeStatus = consolidated.tentativeStatus`.
  - `resolution` / `resolutionDetails`: apply the existing fail/warn
    gate to **`tentativeStatus`** instead of `finding.status` (D12) —
    an uncertain item leaning fail keeps its suggested fix.
- Always persist `voteBreakdown` when a consolidated entry exists —
  including on forced items (D7), where it documents the overridden
  organic vote. On forced items, additionally set
  `agentTrace.organicStatus = consolidated?.status ?? finding.organicStatus`
  so a force that overrode an *uncertain* vote is visible in the trace.
- **Metadata counts**: derive `passCount / failCount / warnCount /
  notApplicableCount / uncertainCount` by incrementing per comment from
  `effectiveStatus` inside the loop — do NOT pass through
  `enriched.totals` (which buckets uncertain items into their
  `winningFinding` status and would double-count). On the runs===1
  passthrough (`consolidatedMap` empty), the loop derivation is
  equivalent to `enriched.totals` anyway (`uncertainCount` necessarily 0).
- Add `metadata.uncertainThreshold` (value used for this run) and
  `metadata.uncertainCount`.
- Per §4, the unclear→warn coercion block and `metadata.unclearCount`
  are deleted.

### 6.4 Behavior when `runs < 3`

Identical structure to CRC §5.4:

- **runs === 1** — full passthrough. Consolidate copies
  `runs/run-1/findings/*` verbatim (raw agent statuses; the enrich clamp
  is the policy point). No `consolidated-findings.json`. `status` is
  4-state, no `tentativeStatus`, no `voteBreakdown`.
- **runs === 2** — full multi-run path (pre-vote clamp, vote,
  `voteBreakdown`, `perRunFindings`), but the `totalRuns >= 3` gate never
  fires: every item lands on `winnerStatus`, `tentativeStatus = null`.

## 7. Schema & DB shape

### 7.1 JSON-schema files — unchanged

`completeness.emit.schema.json` and `completeness.schema.json` keep the
4-state enum. Same reasoning as CRC §6.1: the emit schema is the
agent-SDK contract (the agent must never emit `uncertain`), and the
canonical per-cell shape documents `findingsDir` files, which carry
`winningFinding` (always 4-state, per §6.2d).

`uncertain` lives only in `output/consolidated-findings.json` (TS shape,
§6.2d) and `review_comments.output_json` (below).

### 7.2 `review_comments.output_json` (per checklist item)

New/changed fields on the existing `'legacy'` shape:

```jsonc
{
  "status": "pass | fail | warn | not-applicable | uncertain",
  "tentativeStatus": "pass | fail | warn | not-applicable",   // NEW — ONLY when status='uncertain'
  "voteBreakdown": {                                           // NEW — present when runs >= 2
    "pass": 1, "fail": 3, "warn": 0, "not-applicable": 0, "missing": 1
  },
  "resolution": "…",             // for uncertain: gated on tentativeStatus ∈ {fail, warn}
  "sourceFindings": [{
    "perRunFindings": [{
      "run": "run-2",
      "status": "warn",          // policy-normalized (voted) status
      "emittedStatus": "fail",   // NEW, optional — raw agent status when the pre-vote clamp rewrote it
      /* … existing fields … */
    }]
  }]
}
```

### 7.3 `reviews.output_json.metadata`

```jsonc
{
  "passCount": 98, "failCount": 15, "warnCount": 6,
  "notApplicableCount": 67,
  "uncertainCount": 8,           // NEW — strict: uncertain items count here ONLY
  "uncertainThreshold": 0.35     // NEW — provenance
  // unclearCount: DELETED (§4)
}
```

The five counts partition `totalItems` — an uncertain item does not also
count toward its `tentativeStatus` bucket.

### 7.4 `output_schema`

Stays `'legacy'` (D18). No `review_schema:` line in workflow.yaml; the
conductor saver default is untouched. Readers detect uncertain-aware CC
rows by the presence of `metadata.uncertainThreshold`.

## 8. CityHall UI changes

Much of the CRC uncertain UI is status-keyed rather than
review-type-keyed and already handles this. Confirmed present today:
the `CcCrcTab` union already includes `'uncertain'`
(`[reviewId]/+page.svelte:~696`), and `CompletenessCommentCard.svelte`'s
`statusStyle` already has an amber `case 'uncertain'`. What remains:

### 8.1 Tabs

In `ccStatusTabs` (`+page.svelte:~738`), add to the **CC (non-CRC)
branch**:

```ts
: [
    { key: 'all', label: 'All' },
    { key: 'fail', label: 'Fail' },
    { key: 'warn', label: 'Warn' },
    { key: 'uncertain', label: 'Uncertain' },   // ← NEW
    { key: 'pass', label: 'Pass' },
    { key: 'not-applicable', label: 'N/A' },
  ]
```

Default tab stays `'all'` (D13) — no landing-tab logic change. The
existing tab filter (`displayStatus === ccStatusTab`) works as-is once
`'uncertain'` arrives in `c.status`. Consider rendering the Uncertain
tab only when the review has any uncertain items (or `uncertainCount`
in metadata) to avoid a permanently-empty tab on runs=1 reviews —
implementer's choice; CRC shows it unconditionally.

### 8.2 Counts banner

The uncertain-count derivation (`ccUncertainCount`,
`+page.svelte:~561-566`) is currently gated to CRC. Widen it so CC
reviews read `metadata.uncertainCount ?? 0`, and render an amber
`Uncertain: N` chip in the CC banner alongside Pass/Fail/Warn/N-A. If
the CC banner bar has status segments, add an uncertain segment (amber).

### 8.3 Status pill

Likely zero change: `statusStyle` in `CompletenessCommentCard.svelte`
switches on `comment.status` regardless of review type and already has
the amber `uncertain` case. Audit during impl that the CC render path
reaches it and that any other CC-only pill helpers get an `uncertain`
arm.

Add a small callout in the comment detail for uncertain items (mirroring
CRC): "Agent could not reach consensus. Tentative: **{tentativeStatus}**
· {voteBreakdown.fail}F / {voteBreakdown.warn}W / {voteBreakdown.pass}P /
{voteBreakdown['not-applicable']}N/A{missing > 0 ? ` · ${missing} run(s) missing` : ''}".
When `voteBreakdown.missing > 0`, say so explicitly — "uncertain because
2 of 5 runs produced no finding" is materially different from "runs
disagreed 3-2."

### 8.4 Prior-review version deltas (D15)

`ccVersionDeltas` (`+page.svelte:~630-675`) computes `fixed`
(prior `fail` → current `pass`/`not-applicable`/`warn`) and `regressed`
(prior `pass`/`n-a`/`warn` → current `fail`). Rules with uncertain in
play:

- **Exclude uncertain endpoints from both counters.** Prior `fail` →
  current `uncertain` is NOT fixed (we don't know it's fixed). Prior
  `uncertain` → current `pass` is NOT counted as fixed (prior wasn't a
  confirmed fail). Prior `pass` → current `uncertain` is NOT regressed.
  The existing conditionals already do this implicitly (neither arm
  matches `'uncertain'`) — verify, don't assume.
- **Version-history strip renders uncertain first-class** so the
  "v1: Uncertain → v2: Pass" progression is visible: wherever the
  history entries' statuses are mapped to colors/labels, add the amber
  `uncertain` arm. `commentHistory` entries carry
  `output_json.status` verbatim, so the value flows automatically once
  the workflow writes it.

### 8.5 Zod / type widening

- Any zod enum validating **top-level CC comment `status`** must accept
  `'uncertain'` — audit `[reviewId]/+page.ts` and
  `[sectionId]/+page.ts` (the CRC uncertain work already widened some of
  these; grep for enum sites listing `'pass', 'fail', 'warn'`).
- `perRunFindingSchema` needs **no status widening** (per-run statuses
  are always 4-state), but must tolerate the new optional
  `emittedStatus` field — check for `.strict()` schemas.
- The CC section-route status filter (if any mirrors the formal-review
  fail/unclear filter) must not drop uncertain items.

## 9. Reports (D17)

`format-reports` (agent) and `generate-reports.ts` render uncertain
items with the CRC D20 treatment:

- The item appears in its grouping section (never filtered out).
- Status marker renders `Uncertain` (amber where color exists).
- Callout: "**Agent could not reach consensus.** Tentative verdict:
  **{tentativeStatus}** ({voteBreakdown.fail} fail, {voteBreakdown.warn}
  warn, {voteBreakdown.pass} pass, {voteBreakdown['not-applicable']}
  n/a{, N missing}). Please review."
- Counts lines include the uncertain bucket.

Implementation note: the enriched findings carry 4-state
`winningFinding` statuses, so report generators need the consolidated
statuses — the format-reports agent can read
`output/consolidated-findings.json` from the workspace (add a paragraph
to `prompts/format-reports.md`); `generate-reports.ts` (if still in
use — audit; it is not wired into workflow.yaml today) would need a
`--consolidatedFile` arg.

## 10. Smoke test plan

Fresh runs only (no backfill).

1. **Baseline sanity, runs=1** — behavior byte-identical to today:
   no `consolidated-findings.json`, 4-state statuses, no
   `tentativeStatus`/`voteBreakdown`, metadata has `uncertainCount: 0`
   (or field present with 0 — implementer picks; be consistent) and
   `uncertainThreshold` recorded.
2. **runs=3** on a known site plan (e.g. 1700 S Lamar v4,
   v2.6-trimmed, mirroring review `3ae1ee78…`):
   - Expect a small uncertain count (at runs=3 only 1-1-1 ties trigger;
     2-1 splits are 67% winner > 65% → decisive).
   - Verify a `failStatus: warn` item (cc-5/13/24) where runs emitted
     raw `fail` shows `perRunFindings[].status='warn'` +
     `emittedStatus='fail'`, votes unanimous, NOT uncertain.
   - Verify `metadata` counts partition `totalItems` with no
     double-counting.
   - Verify a forced-outcome item (if `forceOutcomes` TSV in play)
     carries the forced status + real `voteBreakdown` +
     `agentTrace.forced`.
3. **runs=5** — expect more uncertain items (3-2 and 3-1-1 splits now
   trigger). Spot-check `voteBreakdown` sums to 5 including `missing`.
4. **Threshold tuning** — rerun with `uncertainThreshold=0.5`; expect
   fewer uncertain items; `metadata.uncertainThreshold=0.5` recorded.
5. **CityHall** — open the runs=5 review: Uncertain tab present with
   correct count, default tab `'all'`, amber pills, banner chip,
   uncertain callout with tentative verdict + breakdown. With a prior
   review linked: history strip shows uncertain transitions;
   fixed/regressed counters unchanged by uncertain endpoints.
6. **Unit test** (encouraged): fixture test for `consolidate()`
   covering 5-run 3-2 / 3-1-1 / 4-1, 3-run 2-1 / 1-1-1, runs=1/2
   disabled-gate, missing-run dilution (2-of-5 present), threshold=0.5
   exclusion of 3-2, and pre-vote clamp normalization (advisory
   `[fail, warn, warn]` → unanimous warn; blocking `[warn, fail, fail]`
   → unanimous fail; `fail-or-warn` mixed emissions pass through and CAN
   be uncertain).

## 11. Risk register

- **R1 — Clamp divergence.** The pre-vote clamp (consolidate) and the
  enrich clamp now coexist. If their rules drift, multi-run and
  single-run pipelines enforce different policy. Mitigation: single
  shared `lib/checklist-policy.ts` module (§6.2a) + cross-referencing
  comments; the enrich clamp logs would show unexpected activity on
  multi-run paths (it should be a no-op there).
- **R2 — Forced-outcome guard regression.** The
  `consolidated?.status ?? finding.status` pattern, ported naively from
  CRC, silently overrides forced outcomes (CRC has no forced-outcomes
  step). The precedence in §6.3 is load-bearing; the smoke test's
  forced-item check (§10.2) exists to catch this.
- **R3 — Uncertain volume at 4 statuses.** CC has one more status than
  CRC and ~194 items per review; the same threshold may fire more often.
  `uncertainThreshold` is tunable per run without code change; record
  observed uncertain rates from the first runs=5 review and revisit the
  default if the Uncertain tab is noisy.
- **R4 — `tentativeStatus` consumed as the verdict.** Same as CRC R4:
  naive consumers reading `tentativeStatus ?? status` defeat the point.
  UI renders `status` first; tentative appears only inside the callout.
  The D12 resolution-text carry is deliberate and bounded (fail/warn
  tentative only).

## 12. Out of scope / future work

- Manual adjudication of uncertain items (CRC sibling spec pattern).
- Status blocs / asymmetric voting.
- `completeness-check-anchored` support.
- Landing-tab logic for CC (kept `'all'`).
- Backfill of historical CC reviews.
- Refactoring the four `cross-run-consolidate*` forks into a shared
  library (noted in CRC majority-vote spec §14; still not chosen).

## 13. Implementation checklist

- [ ] **Pre-req (bead `noetic-4ji`)** — delete vestigial `unclear`
  plumbing per §4 (may ship inside the bureau PR as its first commit).
- [ ] **Bureau PR**
  - [ ] `workflow.yaml`: add `uncertainThreshold` input; add
    `uncertainThreshold` + `checklistsDir` to `cross-run-consolidate-cc`
    args; add `uncertainThreshold` to `build-review-comments` args. No
    `review_schema:` line.
  - [ ] Extract Fail Status parsing to `scripts/lib/checklist-policy.ts`;
    consume from `enrich-findings.ts` (no behavior change) and
    `cross-run-consolidate-cc.ts`.
  - [ ] `cross-run-consolidate-cc.ts`: pre-vote clamp (+ `emittedStatus`
    + clamp logging), `consolidate()` with gate, widened
    `ConsolidatedItem`, winning-finding-by-effective-verdict, log line.
  - [ ] `build-review-comments.ts`: forced-first status precedence,
    `tentativeStatus` + `voteBreakdown` persistence,
    resolution-gate on `tentativeStatus` for uncertain items,
    loop-derived 5-way metadata counts, `metadata.uncertainThreshold`.
  - [ ] Schemas untouched; `prompts/format-reports.md` paragraph for
    uncertain rendering (§9).
  - [ ] Unit test for `consolidate()` incl. clamp-normalization cases.
- [ ] **CityHall PR**
  - [ ] Add `uncertain` tab to CC branch of `ccStatusTabs`.
  - [ ] Widen `ccUncertainCount` derivation to CC; banner chip/segment.
  - [ ] Audit `statusStyle` reach + any CC-only pill helpers.
  - [ ] Uncertain callout (tentative + breakdown + missing-runs note).
  - [ ] Version-history strip: amber uncertain arm; verify
    fixed/regressed counters exclude uncertain endpoints.
  - [ ] Zod audit: top-level CC `status` enums + `emittedStatus`
    tolerance on per-run schemas.
- [ ] **Smoke test** per §10; record observed uncertain rates → append
  to this spec.

## 14. References

| Thing | Path |
|---|---|
| CRC uncertain-status DESIGN-SPEC (source of the port) | `winston/workspaces/comment-resolution-check/crc-workflow/uncertain-status/DESIGN-SPEC.md` |
| CRC majority-vote DESIGN-SPEC | `winston/workspaces/comment-resolution-check/crc-workflow/majority-vote/DESIGN-SPEC.md` |
| CC fail-status DESIGN-SPEC (clamp + Fail Status column) | `winston/workspaces/completeness-check/fail-status/DESIGN-SPEC.md` |
| CC workflow.yaml | `bureau/workflows/completeness-check/workflow.yaml` |
| CC consolidate script | `bureau/workflows/completeness-check/scripts/cross-run-consolidate-cc.ts` |
| CC enrich script (clamp origin) | `bureau/workflows/completeness-check/scripts/enrich-findings.ts` |
| CC build-review-comments | `bureau/workflows/completeness-check/scripts/build-review-comments.ts` |
| CC forced outcomes | `bureau/workflows/completeness-check/scripts/apply-forced-outcomes.ts` |
| CC emit schema (4-state enum) | `bureau/workflows/completeness-check/schemas/completeness.emit.schema.json` |
| CityHall review page (tabs, banner, deltas) | `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte` |
| CityHall comment card (statusStyle, per-run UI) | `cityhall/src/routes/(app)/project/[projectId]/review/CompletenessCommentCard.svelte` |
| Vestigial-unclear cleanup bead | `noetic-4ji` |
| Reference CC review (runs=3, zero unclear) | reviews `3ae1ee78-437b-4da3-9d52-1f19c380b791` (2026-07-02) |
