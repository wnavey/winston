# CRC `uncertain` Status — Design Spec

> **Status:** Draft, 2026-06-25. Iteration on top of the
> [CRC SPEC](../../SPEC.md), the
> [crc-workflow DESIGN-SPEC](../DESIGN-SPEC.md), and the
> [majority-vote DESIGN-SPEC](../majority-vote/DESIGN-SPEC.md).
> Drives a winston PR + bureau PR + cityhall PR.

---

## 1. Summary

Add a fourth value to CRC's consolidated status enum — **`uncertain`** —
that fires when the majority vote across runs is not decisive enough to
trust as a verdict. The rule:

> **A consolidated atomic item is `uncertain` when the winning status's
> share of votes is at or below `1 − uncertainThreshold` (default
> threshold 0.35, i.e. winner ≤ 65% of `totalRuns`).**

When `uncertain`, the workflow still records the would-be winner (under
existing severity tie-break) as `tentativeStatus`, plus a structured
`voteBreakdown`, so downstream consumers (cityhall UI, PDF report) don't
have to recompute from `perRunFindings`.

The agent-verdict ↔ user-adjudicated-verdict override surface is **out
of scope** here. It moves to a sibling spec:
[`../uncertain-status-manual-override/DESIGN-SPEC.md`](../uncertain-status-manual-override/DESIGN-SPEC.md)
(to be written). We commit now to two guardrails that keep both paths
clean for that future spec — see §3.

## 2. Goals

- **Surface disagreement as a first-class verdict** instead of burying
  it in a `confidence: medium/low` badge. Applicant-facing UX changes
  from "the agent says resolved, take it at face value (or read the
  fine print)" to "the agent isn't sure — please adjudicate."
- **Tunable threshold.** Pre-set to 0.35, exposed as a workflow input
  so we can dial without a code change once we have U1 accuracy data.
- **Backward-renderable.** Cityhall and the PDF should display old
  CRC runs cleanly. We do this by backfilling every existing CRC row
  (all currently on `output_schema='legacy'` — see §6.4) as part of
  impl rather than carrying a dual-schema renderer.
- **Lay groundwork for manual override without committing to it.**
  Persist `tentativeStatus` + `voteBreakdown` so the future override UI
  has a sensible default to pre-fill. See §3 guardrails.
- **No agent-prompt changes.** The agent still emits 3-status verdicts
  per run; uncertainty is purely a consolidation-time computation.

## 3. Non-goals (this spec)

- **Manual user adjudication of `uncertain` items.** Sibling spec at
  `../uncertain-status-manual-override/DESIGN-SPEC.md`. Will use Path A
  ("orthogonal `userAdjudicatedStatus` field on `output_json`") per the
  2026-06-25 grilling session.
- **Pre-populating `comment_triage` rows on workflow completion.**
  Triage writes stay lazy-on-touch per cityhall-ui DESIGN-SPEC Q13.
- **Changing the agent prompt or per-run schema.** Each run still
  emits `resolved | failed | not-applicable`; `uncertain` is only ever
  a consolidated value.
- **Asymmetric voting** (e.g. require unanimity for `resolved`).
  Listed in majority-vote DESIGN-SPEC §11 future work; this spec
  preserves the symmetric vote and adds the uncertainty gate on top.
- **Confidence-tier removal.** `confidence` (`high`/`medium`/`low`)
  stays alongside `status='uncertain'`; see D8.
- **Generalising the uncertain rule to other workflows** (completeness
  check, formal review). They have their own status semantics and
  precedents; if we want this there, separate spec.

### 3.1 Guardrails for the future override spec

Two contracts this spec commits to NOW so the override spec stays
clean later:

1. **`review_comments.output_json.status` is — and always will be —
   the agent's consolidated verdict.** User actions never mutate it.
   When the override ships, the user's choice lives in a sibling field
   (`userAdjudicatedStatus`); the agent's verdict stays intact as the
   queryable "original call." (Reverses the cityhall-ui DESIGN-SPEC
   Q15 framing from "read-only because we don't override" to
   "read-only because it's the agent's snapshot.")
2. **`tentativeStatus` is computed and persisted at consolidation time**
   so the override UI can pre-fill its "I think this is actually X"
   dropdown without re-reading `perRunFindings`.

## 4. Design decisions (locked)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Threshold formulation | **Winner-share gate**: `uncertain ⟺ (winnerCount / totalRuns) ≤ (1 − uncertainThreshold)` | Q1 — chose the "winner < 65%" framing over "any loser ≥ 35%" so multi-way splits (e.g. 5-run 3-1-1, winner 60%) trigger uncertain even when no single loser crosses the threshold. |
| D2 | Boundary inclusivity | **Inclusive**: exact 35% dissent IS uncertain (i.e. `≤ 0.65` winner share, not `< 0.65`) | Q3. |
| D3 | Default threshold | `0.35` | Per the kickoff message. |
| D4 | Threshold surface | **`workflow.yaml` input**, default `0.35` | Q4. Tunable per run without code change. |
| D5 | Minimum runs for the rule to apply | **`totalRuns ≥ 3`** | Q11. Two-run splits collapse to 50/50 on any disagreement and would be uniformly uncertain — not useful signal. |
| D6 | Single-run behavior | **Never uncertain** (rule disabled when `totalRuns < 3`) | Q10. |
| D7 | Status enum widening | Add `uncertain` as a 4th value in the consolidated `status` enum | Q5. Existing per-run agent emit schema (`crc.emit.schema.json` / `crc.schema.json`) **unchanged** — agent still emits 3 statuses; `uncertain` is only on `review_comments.output_json.status` after consolidation. |
| D8 | Confidence tier | **Keep alongside `status='uncertain'`** (`high`/`medium`/`low` semantics unchanged from majority-vote DESIGN-SPEC §5 D5) | Q8. Orthogonal: confidence describes "did all expected runs land," uncertainty describes "did they agree." A 3-of-3-present 1-1-1 split is `confidence='high', status='uncertain'`. |
| D9 | `not-applicable` symmetry | **Counts toward winner / dissent identically to `resolved` / `failed`** | Q7. So 5-run 3-resolved + 2-not-applicable → dissent 40% ≥ 35% → uncertain (tentative `resolved`). |
| D10 | Severity tie-break in `tentativeStatus` | **Preserved** (`failed > not-applicable > resolved`) | Q22. A 1-1-1 three-way tie → `status='uncertain'`, `tentativeStatus='failed'`. Matches the cautious-applicant bias from majority-vote DESIGN-SPEC §5 D3. |
| D11 | Naming | **`uncertain`** | Q9. Differentiates from completeness/formal-review `unclear`. |
| D12 | `tentativeStatus` field | New optional field on `review_comments.output_json`, populated **only when `status='uncertain'`** | Q6 + D10. Lets PDF report + override UI know what the would-be winner is. |
| D13 | `voteBreakdown` field | Structured object on `review_comments.output_json` per row: `{ resolved: N, failed: N, "not-applicable": N, "missing": N }` | Q21. Prevents UI/PDF from recomputing from `perRunFindings`. `missing` = `totalRuns − presentRunCount`. |
| D14 | `output_schema` introduction | Add **`review_schema: '2026-06-25-crc'`** to `workflow.yaml`. CRC currently ships **without** a `review_schema` line, so the conductor saver defaults to `'legacy'` (`conductor/src/shared/review-saver.ts:555`) — every persisted CRC row in Supabase today carries `output_schema='legacy'`. We skip the intermediate `'2026-06-crc'` value the cityhall-ui DESIGN-SPEC contemplated (never shipped to workflow.yaml) and go straight to the dated form. | Q12. Provides forward-looking provenance and a hook for future schema-keyed cityhall rendering (today cityhall routes off `review_type='crc'`, not `output_schema`). |
| D15 | Backfill | **One-off migration script** recomputes consolidation for all existing CRC rows (currently on `output_schema='legacy'`) and bumps them to `'2026-06-25-crc'` | Q14. Avoids a dual-schema renderer. Affected-row count is unknown without a query — the spec previously claimed "1700's two medly-3 runs" but the run-3 audit shows at least three 1700 reviews alone (gen-1 runs=3 + gen-1 + gen-2 runs=5), plus any other completed CRC reviews. Backfill MUST log row count so a zero-match scans as failure, not silent success. |
| D16 | Triage interaction | **Untouched.** Uncertain does NOT auto-write `comment_triage` rows; the existing 5-value triage status set is unchanged | Q13 + Q19. The future override spec may add a triage value or a sibling field; this spec stays orthogonal. |
| D17 | CityHall filter tabs | **Add 4th "Uncertain" tab** to the items list. **Default landing tab = `Uncertain` when any exist, else `Failed`** | Q15. |
| D18 | CityHall status pill color | **Amber** (`text-amber-700 bg-amber-50 border-amber-200`) | Q16. Distinguishes from red `failed` and green `resolved`; matches the existing amber fallback in `CompletenessCommentCard.svelte:290`. |
| D19 | Counts banner | Add `uncertainCount` to `reviews.output_json.metadata`; render `Uncertain: N` chip in the CRC banner. **CRC only** — completeness banner unchanged | Q17. |
| D20 | PDF report rendering | **Include the item** with a "Agent could not reach consensus" callout AND the `tentativeStatus` rendered as the would-be verdict with footnote pointing to the dissent | Q20 (b + c). Skipping (option a) hides items the applicant most needs to look at. |

## 5. Workflow changes

All workflow-side changes land in
`bureau/workflows/comment-resolution-check/`.

### 5.1 `workflow.yaml` — new input

Add a sibling to the existing `runs` input:

```yaml
  uncertainThreshold:
    type: number
    required: false
    default: 0.35
    description: |
      Dissent share at or above which a consolidated atomic item gets
      `status='uncertain'`. Equivalent rule: winning status's share of
      votes must EXCEED (1 - threshold) to avoid uncertainty. Only
      applies when `runs >= 3`; below that the consolidate script skips
      the uncertainty gate entirely. See
      winston/workspaces/comment-resolution-check/crc-workflow/uncertain-status/DESIGN-SPEC.md
```

Plumb through to `cross-run-consolidate-crc` and
`build-crc-review-comments` (`args` blocks under each step).

### 5.2 `cross-run-consolidate-crc.ts` — three changes

In `bureau/workflows/comment-resolution-check/scripts/cross-run-consolidate-crc.ts`:

**(a) Widen `Status` type:**

```ts
type Status = 'resolved' | 'failed' | 'not-applicable' | 'uncertain';

// Severity for tie-break (used when computing tentativeStatus).
// uncertain is NOT a candidate for tentativeStatus — it's the OUTCOME.
const STATUS_SEVERITY: Record<'resolved' | 'failed' | 'not-applicable', number> = {
  'failed': 2,
  'not-applicable': 1,
  'resolved': 0,
};
```

**(b) Replace `majorityVote()` with `consolidate()`** that:
- Takes the per-run statuses, `totalRuns`, and `uncertainThreshold`.
- Computes `winnerCount`, `winnerStatus` (severity tie-broken), and the
  existing `confidence` tier exactly as today.
- Computes `dissentShare = 1 - (winnerCount / totalRuns)`.
- If `totalRuns >= 3` AND `dissentShare >= uncertainThreshold`:
  - Returns `{ status: 'uncertain', tentativeStatus: winnerStatus, confidence, voteBreakdown }`.
- Else:
  - Returns `{ status: winnerStatus, tentativeStatus: null, confidence, voteBreakdown }`.

```ts
function consolidate(
  statuses: Array<'resolved' | 'failed' | 'not-applicable'>,
  totalRuns: number,
  uncertainThreshold: number,
): {
  status: Status;
  tentativeStatus: 'resolved' | 'failed' | 'not-applicable' | null;
  confidence: 'high' | 'medium' | 'low';
  voteBreakdown: { resolved: number; failed: number; 'not-applicable': number; missing: number };
} {
  const counts = { resolved: 0, failed: 0, 'not-applicable': 0 };
  for (const s of statuses) counts[s]++;

  const maxCount = Math.max(counts.resolved, counts.failed, counts['not-applicable']);
  const tied = (Object.keys(counts) as Array<'resolved' | 'failed' | 'not-applicable'>)
    .filter(k => counts[k] === maxCount);
  tied.sort((a, b) => STATUS_SEVERITY[b] - STATUS_SEVERITY[a]);
  const winnerStatus = tied[0];

  const confidence: 'high' | 'medium' | 'low' =
    maxCount >= totalRuns ? 'high' :
    maxCount >= 2 ? 'medium' :
    'low';

  const voteBreakdown = {
    resolved: counts.resolved,
    failed: counts.failed,
    'not-applicable': counts['not-applicable'],
    missing: Math.max(0, totalRuns - statuses.length),
  };

  // Uncertain gate: only applies for runs >= 3.
  if (totalRuns >= 3) {
    const winnerShare = maxCount / totalRuns;
    if (winnerShare <= 1 - uncertainThreshold) {
      return { status: 'uncertain', tentativeStatus: winnerStatus, confidence, voteBreakdown };
    }
  }

  return { status: winnerStatus, tentativeStatus: null, confidence, voteBreakdown };
}
```

**(c) Propagate new fields through `ConsolidatedItem`:**

```ts
interface ConsolidatedItem {
  ref: string;
  grouping: string;
  checklistItemId: string;
  status: Status;                                                    // widened to 4-state
  tentativeStatus: 'resolved' | 'failed' | 'not-applicable' | null;  // NEW — populated when status='uncertain'; never carries 'uncertain' itself
  voteBreakdown: VoteBreakdown;                                      // NEW
  confidence: 'high' | 'medium' | 'low';                             // unchanged
  runCount: number;
  totalRuns: number;
  perRunFindings: PerRunFinding[];                                   // unchanged
  winningFinding: AgentFinding;                                      // earliest run matching `tentativeStatus` (when uncertain) or `status` (else)
}
```

Note that `AgentFinding` is **not** widened — it carries the per-run agent emit and stays 3-state. `winningFinding.status` is therefore always one of `resolved | failed | not-applicable`, even when the consolidated `status` is `'uncertain'`. This matters because `enrich-findings.ts` (next step) reads from `findingsDir/{grouping}.md.json` which contains `winningFinding` only, so the enriched totals it computes are necessarily 3-state — see §5.3's counts-derivation note.

`winningFinding` selection rule: pick the earliest run whose status
matches the **effective verdict for display** (i.e. `tentativeStatus`
when `status='uncertain'`, else `status`). This keeps the
single-finding `findings/{grouping}.md.json` that downstream
`enrich-findings` reads from looking like a normal verdict and lets the
PDF surface a sensible "as if the agent had reached consensus" answer
alongside the dissent callout.

**(d) Update the closing log line** to print uncertain counts:

```
Consolidated: ${N} items
  Confidence: ${high} high (${totalRuns}/${totalRuns}), ${med} medium (2+/${totalRuns}), ${low} low (1/${totalRuns})
  Status: ${resolved} resolved, ${failed} failed, ${na} n/a, ${uncertain} uncertain (threshold ${threshold})
  Grouping files written to: ${findingsDir}
  Consolidated JSON: ${consolidatedPath}
```

### 5.3 `build-crc-review-comments.ts` — propagate new fields

- Read `uncertainThreshold` (passed through as a new `--uncertainThreshold` arg) — only needed for metadata; the consolidate script has already applied the gate.
- **Widen the local `ConsolidatedItem` interface** (currently at `build-crc-review-comments.ts:125-131`, which only carries `ref / confidence / runCount / totalRuns / perRunFindings`). Add:
  - `status: 'resolved' | 'failed' | 'not-applicable' | 'uncertain'`
  - `tentativeStatus: 'resolved' | 'failed' | 'not-applicable' | null`
  - `voteBreakdown: { resolved: number; failed: number; 'not-applicable': number; missing: number }`
- For each comment built from the consolidated row:
  - **Switch the comment's `status:` assignment** from `finding.status` (per-run agent 3-state from the enriched finding) to `consolidated?.status ?? finding.status` — when a consolidated entry exists, its 4-state status is authoritative; the fallback only fires on the runs===1 passthrough path where no `consolidated-findings.json` was written.
  - When `consolidated?.status === 'uncertain'`:
    - Set `output_json.tentativeStatus = consolidated.tentativeStatus`.
    - Set `output_json.voteBreakdown = consolidated.voteBreakdown`.
  - When `status !== 'uncertain'`: still write `voteBreakdown` when a consolidated entry exists (cheap and useful); `tentativeStatus` is omitted.
- Roll up to `reviews.output_json.metadata`:
  - **Derive the four status counts from the consolidated map, not from `enriched.totals`.** `enriched.totals.resolved` / `.failed` / `.notApplicable` come from `enrich-findings.ts`, which buckets by `winningFinding.status` — that's the per-run agent 3-state, so an item with consolidated `status='uncertain'` is still counted in `resolved`/`failed`/`notApplicable` there and would double-count the headline banner.
  - Iterate the per-comment loop you're already in (or `consolidatedMap` directly) and, for each item, pick `consolidated?.status ?? finding.status` and increment exactly one of `resolvedCount` / `failedCount` / `notApplicableCount` / `uncertainCount`. Replaces today's pass-through from `enriched.totals.resolved` etc. (`build-crc-review-comments.ts:342-344`).
  - When `consolidatedMap` is empty (runs===1 passthrough — see §5.4), fall back to `enriched.totals` for the three legacy counts (`uncertainCount` is necessarily 0).
  - Add `uncertainCount: number` and `uncertainThreshold: number` (the value used for this run — for provenance / debugging).
- The schema string on both rows lands as `'2026-06-25-crc'` automatically once `review_schema:` is added to `workflow.yaml` (§6.4) — this script doesn't set `output_schema` itself; the conductor saver reads from workflow config.

### 5.4 Behavior when `runs < 3`

Two conditions, often conflated; the implementer must handle them
distinctly — they live at different layers.

**`runs === 1` — full passthrough (unchanged).** `cross-run-consolidate-crc.ts`
hits its early-return at line ~153 (`if (totalRuns === 1)`), merges
`runs/run-1/findings/*` straight into `findingsDir/`, and does **NOT**
write `consolidated-findings.json`. `build-crc-review-comments` therefore
falls through its `fs.existsSync(consolidatedFile)` check and synthesizes
a single-entry `sourceFindings` from the enriched finding directly.
`output_json.status` is the agent's 3-state verdict, `tentativeStatus`
is omitted, `voteBreakdown` is omitted (no vote occurred).

**`runs === 2` — multi-run path runs but the uncertainty gate is
disabled.** runs=2 does **not** hit the early-return; it takes the full
multi-run path and writes `consolidated-findings.json` with
`voteBreakdown` and full `perRunFindings`. What's bypassed is
specifically the `if (totalRuns >= 3)` uncertainty gate per D5 inside
`consolidate()` — every item lands with `status = winnerStatus`,
`tentativeStatus = null`. `build-crc-review-comments` reads the
consolidated map normally and just never sees `'uncertain'` as a
consolidated status.

In both cases the consolidated `status` is 3-state, so `output_json.status`
on `review_comments` is 3-state and `tentativeStatus` is omitted.

## 6. Schema changes

### 6.1 `crc.schema.json` (consolidated / DB-bound) — widen `status`

```jsonc
{
  "grouping": "crc-tpw",
  "findings": [{
    "checklistItemId": "TPW-3.1",
    "observation": "…",
    "reasoning": "…",
    "tools_used": ["crc-vision-check"],
    "status": "resolved | failed | not-applicable | uncertain",   // ← widened
    "explanation": "6–30 words",
    "resolution": "…",
    "evidenceLocations": [{ "documentId": "…", "sheetNumber": 12, "label": "…" }]
  }],
  "summary": "…"
}
```

`crc.emit.schema.json` — **unchanged.** The agent never emits
`uncertain`; the value is only ever produced by consolidation.

### 6.2 `review_comments.output_json` (CRC, per atomic item)

Adds two fields:

```jsonc
{
  "section": "crc-tpw",
  "atomicItemId": "TPW-3.1",
  "parentCommentId": "TPW 3",
  "headline": "…",
  "requirement": "…",
  "codeCitation": "TCM 9.2.3.1.B",
  "severity": "required",
  "status": "resolved | failed | not-applicable | uncertain",
  "tentativeStatus": "resolved | failed | not-applicable | null",   // NEW — set ONLY when status='uncertain'
  "voteBreakdown": {                                                 // NEW — always present when runs >= 3; optional otherwise
    "resolved": 1,
    "failed": 2,
    "not-applicable": 0,
    "missing": 0
  },
  "explanation": "…",
  "observation": "…",
  "reasoning": "…",
  "resolution": "…",
  "evidenceLocations": [ … ],
  "tools_used": ["crc-vision-check"]
}
```

### 6.3 `reviews.output_json.metadata`

Add two fields (CRC only):

```jsonc
{
  "metadata": {
    "cycleLabel": "U0",
    "guidesProvenance": { … },
    "model": "claude-sonnet-4-5-20250929",
    "runDate": "2026-06-20T17:42:00Z",
    "uncertainThreshold": 0.35,                       // NEW — provenance
    "uncertainCount": 7                                // NEW — banner roll-up
  },
  "sections": [ … ]
}
```

`resolvedCount` / `failedCount` / `notApplicableCount` (existing) count
the corresponding **consolidated 4-state** statuses strictly —
`uncertain` items count only toward `uncertainCount`, not toward
`tentativeStatus`'s bucket. This is intentional: the headline banner
shows what the agent committed to. **Important:** in
`build-crc-review-comments.ts`, derive these four counts from
`consolidatedMap` (4-state) rather than `enriched.totals` (3-state,
built by `enrich-findings.ts` from the per-run `winningFinding`) — the
latter buckets every uncertain item into `tentativeStatus`'s slot and
will double-count the banner. See §5.3 for the explicit fix.

### 6.4 `output_schema` — first time on a non-`'legacy'` value

CRC has shipped without a `review_schema:` field in `workflow.yaml`, so
the conductor saver defaults to `output_schema='legacy'` on both
`reviews` and `review_comments` (`conductor/src/shared/review-saver.ts:555`).
The cityhall-ui DESIGN-SPEC's `'2026-06-crc'` value was decided
2026-06-22 but never landed in the workflow.

This spec lands the schema string for the first time:

- **Add** `review_schema: "2026-06-25-crc"` to `workflow.yaml` as a
  top-level key (mirrors `workflows/review/workflow.yaml:110` and
  `workflows/review-anchored/workflow.yaml:51`).
- All future CRC rows persist with `output_schema='2026-06-25-crc'`.
- Existing rows (currently `'legacy'`) are migrated by the backfill in
  §7.

CityHall today routes CRC reviews by `review_type='crc'`, **not by
`output_schema`** (no schema-keyed dispatch is wired up). The schema
string is therefore forward-looking provenance + a hook for future
schema-keyed rendering. If a row on `'legacy'` leaks through after the
backfill runs, the existing cityhall code path renders it normally
without uncertain awareness (no amber pill, no `tentativeStatus`,
`voteBreakdown` absent — same behavior CRC has had since iteration-1).

## 7. Backfill (one-off migration)

Lives at `bureau/workflows/comment-resolution-check/scripts/backfill-uncertain-status.ts`
(or a similar conductor-aware path — TBD during impl). Runs once
post-merge.

**Behavior:**

1. Find all `reviews` rows with `review_type='crc'` AND
   `output_schema='legacy'`. (Every persisted CRC row to date is on
   `'legacy'` because `workflow.yaml` never set `review_schema:` —
   see §6.4.)
2. **Log the match count up front and abort with a clear error if it's
   zero.** Silent zero-match passes have masked targeting bugs in
   adjacent migrations; we want this one loud.
3. For each, fetch its `review_comments` rows.
4. For each comment, read `output_json.perRunFindings[]`.
5. Re-run `consolidate(...)` with `uncertainThreshold = 0.35` (the
   default; we don't try to retroactively choose a different value).
6. Update `output_json.status` (may flip to `'uncertain'`),
   `tentativeStatus`, `voteBreakdown`.
7. Recompute the parent `reviews.output_json.metadata` counts — using
   the same consolidated-map derivation as §5.3 (do **not** trust the
   row's existing `resolvedCount` etc., which are 3-state from
   `enriched.totals` and would double-count uncertain items).
8. Bump both `output_schema` strings to `'2026-06-25-crc'`.
9. Write `output_json.metadata.uncertainThreshold = 0.35` and
   `metadata.backfilledAt = <ISO timestamp>` (provenance — also makes
   the migration idempotent: skip rows that already have
   `backfilledAt`).

**Idempotency:** rows on `'2026-06-25-crc'` are skipped. Rows on
`'legacy'` get rewritten once and stamped.

**Affected-row scope (as of 2026-06-25):** every CRC review ever
persisted, since they all carry `'legacy'`. The 1700 South Lamar
run-3 audit alone references three CRC reviews (`3703349c…`
2026-06-23 runs=3, `7e79e197…` 2026-06-19, `a8d07d22…` 2026-06-25
runs=5); other projects with completed CRC runs add more. Confirm
during impl via
`SELECT id, submission_version_id, output_schema, created_at FROM reviews WHERE review_type='crc' ORDER BY created_at DESC;`.

**Single-run rows** (no medly): the script still bumps the schema and
writes a `voteBreakdown` (`{ status: 1 } + zeros + missing: 0`), but
never flips status to `uncertain` because the gate requires
`totalRuns >= 3`.

## 8. CityHall UI changes

Three small touches on top of the cityhall-ui DESIGN-SPEC.

### 8.1 Status pill & color helper

**File:** `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte`
(or wherever `crcStatusPillClass` / `crcStatusLabel` live — confirmed at
lines ~597-603 by grep).

Add `uncertain` branch to both:

```ts
function crcStatusPillClass(status: string) {
  switch (status) {
    case 'resolved': return 'text-green-700 bg-green-50 border-green-200';
    case 'failed': return 'text-red-700 bg-red-50 border-red-200';
    case 'not-applicable': return 'text-gray-500 bg-gray-50 border-gray-200';
    case 'uncertain': return 'text-amber-700 bg-amber-50 border-amber-200';   // ← NEW
    default: return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}

function crcStatusLabel(status: string) {
  switch (status) {
    case 'resolved': return 'Resolved';
    case 'failed': return 'Failed';
    case 'not-applicable': return 'N/A';
    case 'uncertain': return 'Uncertain';   // ← NEW
    default: return status;
  }
}
```

Same widening on `CompletenessCommentCard.svelte`'s `statusStyle`
derived (lines ~66-81). The card already has CRC-aware branches for
`resolved` / `failed`; add `case 'uncertain'`:

```ts
case 'uncertain':
  return { color: 'text-amber-700 bg-amber-50 border-amber-200', label: 'Uncertain' };
```

### 8.2 Filter tabs

**File:** `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte`

In the existing `ccStatusTabs` array (line ~460), add an `Uncertain`
entry for CRC reviews:

```ts
const ccStatusTabs: { key: CcCrcTab; label: string }[] = isCRC
  ? [
      { key: 'failed', label: 'Failed' },
      { key: 'resolved', label: 'Resolved' },
      { key: 'not-applicable', label: 'N/A' },
      { key: 'uncertain', label: 'Uncertain' },   // ← NEW
    ]
  : [ /* completeness — unchanged */ ];
```

Widen the `CcCrcTab` type to include `'uncertain'`.

Default tab logic (line ~443) changes from:

```ts
let ccStatusTab = $state<CcCrcTab>(isCRC ? 'failed' : 'fail');
```

to:

```ts
const initialCrcTab: CcCrcTab = (metadata.uncertainCount ?? 0) > 0 ? 'uncertain' : 'failed';
let ccStatusTab = $state<CcCrcTab>(isCRC ? initialCrcTab : 'fail');
```

So when uncertain items exist, the page lands on the Uncertain tab;
otherwise lands on Failed.

### 8.3 Counts banner

**File:** `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte`

In the CRC banner block (around line 348 where `resolvedCount` /
`failedCount` are derived), add an `uncertainCount` derivation off
`metadata.uncertainCount`, and render an amber `Uncertain: N` chip
alongside the existing Resolved / Failed / N/A chips.

**Completeness banner is untouched.** Per Q17 the uncertain count only
shows on CRC reviews.

### 8.4 Zod schema widening

**File:** `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/[sectionId]/+page.ts`

Per majority-vote DESIGN-SPEC §9.3 the section-route zod
`perRunFindingSchema` was widened to accept CRC's existing 3 statuses.
Since the per-run schema is on `runs` (which always emit one of the 3
agent statuses), **no widening needed for `perRunFinding.status`** —
`uncertain` is only ever the consolidated value, never a per-run value.

However, the schema that validates the top-level comment status (i.e.
`status` on the `review_comment.output_json`) needs the new value.
Audit during impl:
- Parent `[reviewId]/+page.ts` zod schemas (~line 600 already widened
  for CRC's 3 statuses) — add `'uncertain'`.
- Section route `[sectionId]/+page.ts` — same.
- Anywhere else a `comment.status` zod enum is enumerated.

### 8.5 What does NOT change

- Backend chat-API / triage-PATCH endpoint payloads.
- `review_sections` (still not written — per crc-workflow DESIGN-SPEC §6).
- `comment_triage` enum / write semantics.
- Schemas for completeness or formal review reviews.

## 9. PDF report (`generate-crc-report`)

Skill lives in `claude-plugins`; iteration-1 spec is at
`winston/workspaces/comment-resolution-check/generate-crc-guides/DESIGN-SPEC.md`
(sibling) and the generate-crc-report skill DESIGN-SPEC (if it exists)
or the SPEC §4 component C.

**Rendering rule for `status='uncertain'`** (Q20 b+c):

- The item appears in its department's section (NOT filtered out).
- Status pill renders amber `Uncertain` (matches cityhall §8.1).
- Beneath the pill, a small callout:
  > **Agent could not reach consensus.** Tentative verdict:
  > **{tentativeStatus}** ({voteBreakdown.failed} failed,
  > {voteBreakdown.resolved} resolved, …). Please review and respond
  > accordingly.
- The "draft BLUE response" paragraph the PDF includes per comment
  (SPEC §4 component C) is generated **as if** the verdict were
  `tentativeStatus`, with a leading sentence flagging the uncertainty.

This is dependent on the `generate-crc-report` skill being built; if
that's still in-flight, file a follow-up bead noting the uncertain
rendering rule.

## 10. Smoke test plan

Reuse 1700 South Lamar U0.

1. **Backfill** all existing `output_schema='legacy'` CRC reviews
   (every persisted CRC row to date). Confirm:
   - **Backfill log printed a non-zero match count.** Zero-match
     should have aborted (§7 step 2); if the log says e.g.
     "matched 0 rows" the targeting query is wrong and nothing
     downstream is valid.
   - Spot-check the 1700 South Lamar reviews specifically
     (`3703349c…` runs=3, `7e79e197…`, `a8d07d22…` runs=5 — see §7).
     All three now carry `output_schema='2026-06-25-crc'`.
   - Each backfilled row has `metadata.uncertainThreshold = 0.35`,
     `metadata.backfilledAt = <ISO>`, and a derived `uncertainCount`.
     For the runs=3 row we expect a small count (only 1-1-1 ties
     trigger at runs=3 under the locked rule; 2-1 does not). For the
     runs=5 row we expect more (3-2 splits and 3-1-1 splits both
     trigger).
   - Spot-check 3-5 individual `review_comments` rows. Confirm
     `output_json.voteBreakdown` matches what `perRunFindings` shows
     and that `metadata.resolvedCount + failedCount +
     notApplicableCount + uncertainCount = totalItems` (no
     double-counting from the §5.3 / §6.3 fix).
2. **CityHall** — open the backfilled run:
   - Land on the Uncertain tab if `uncertainCount > 0`; else Failed.
   - Amber pill renders on uncertain items.
   - Counts banner shows `Uncertain: N` chip.
   - `crcStatusPillClass('uncertain')` returns the amber classes.
3. **Fresh run** — re-run the workflow on 1700 U0 with `runs=5` and
   default threshold:
   - Expect more uncertain items than the 3-run backfill (5-run
     thresholds catch 3-2 splits and 3-1-1 splits, runs=3 only
     catches 1-1-1).
   - `metadata.uncertainThreshold = 0.35` recorded.
4. **Threshold tuning sanity** — re-run with
   `uncertainThreshold=0.5`:
   - Expect fewer uncertain items (only ≥50% dissent triggers).
   - `metadata.uncertainThreshold = 0.5` recorded.

**Unit test** (encouraged): fixture-based test for the new
`consolidate()` function covering the 5-run 3-2 / 3-1-1 / 4-1 cases,
the 3-run 2-1 / 1-1-1 cases, runs=1 / runs=2 (rule disabled), and the
threshold-tuning case where `0.5` excludes 5-run 3-2 splits.

## 11. Risk register

### R1 — Backfill changes verdicts mid-flight

If anyone is actively triaging 1700 in cityhall while the migration
runs, an item could flip from `failed`/`resolved` to `uncertain` while
they're looking at it. Mitigation: ship the migration during a quiet
window, and `comment_triage` rows are decoupled from `status` so prior
triage actions survive the flip.

### R2 — Single-run + medly mixed runs in the same project

A project could have a single-run CRC review AND a medly-3 review for
different submission versions. The backfill handles them
heterogeneously (single-run rows get the schema bump but never flip to
uncertain). CityHall's renderer treats both schemas identically post-
bump, so no UI bifurcation.

### R3 — Threshold drift across reruns

If we tune `uncertainThreshold` between runs, old runs' counts may
look inconsistent with new runs' counts. Mitigation: every run's
`metadata.uncertainThreshold` is persisted, so the UI can show the
threshold in the banner (e.g. "Uncertain: 7 — threshold 0.35"). Out of
scope for MVP (it's a debug crutch); add if it causes confusion.

### R4 — `tentativeStatus` consumed as if it were the verdict

A naive downstream consumer that reads `tentativeStatus ?? status`
would treat uncertain items as resolved/failed/n-a, defeating the
point. Mitigation: the cityhall renderer reads `status` first and
shows the amber pill; `tentativeStatus` is rendered only inside the
detail panel / banner callout. PDF likewise renders the uncertainty
callout AROUND the tentative answer, not in place of it.

## 12. Open items / future work (out of scope here)

- **Manual override of `uncertain` items** — sibling spec at
  `../uncertain-status-manual-override/DESIGN-SPEC.md`. Path A
  (`output_json.userAdjudicatedStatus`) locked in via this session's
  Q13 follow-up. Spec to be drafted next.
- **Asymmetric vote** (require ≥ 2/3 to reach a non-`uncertain`
  verdict — i.e. tighter than the symmetric threshold gate). Listed
  as future work in majority-vote DESIGN-SPEC §11.
- **Confidence-aware triage default** (uncertain items auto-flag as
  needing review). Q19's "lazy on touch" answer punts this; revisit
  if applicant pilots show users miss the amber tab.
- **Uncertainty in completeness-check / formal review.** Not in scope.
  Each has its own status semantics and tolerance for ambiguity.

## 13. Implementation checklist

- [ ] **Bureau PR**
  - [ ] Add `uncertainThreshold` input to `workflow.yaml`; plumb to
    `cross-run-consolidate-crc` and `build-crc-review-comments` args.
  - [ ] Add a top-level `review_schema: "2026-06-25-crc"` line to
    `workflow.yaml` (CRC ships without one today, so existing rows
    persist as `'legacy'` — see §6.4).
  - [ ] Widen `Status` type + add `consolidate()` + new fields to
    `ConsolidatedItem` in `cross-run-consolidate-crc.ts`. Narrow the
    `tentativeStatus` field type to exclude `'uncertain'` per §5.2(c).
    Update final log line.
  - [ ] Widen `crc.schema.json` `status` enum to include `uncertain`.
    Leave `crc.emit.schema.json` unchanged.
  - [ ] Update `build-crc-review-comments.ts`:
    - Widen the local `ConsolidatedItem` interface (currently at
      lines ~125-131) to add `status` (4-state), `tentativeStatus`,
      `voteBreakdown`.
    - Switch the comment's `status:` assignment from `finding.status`
      to `consolidated?.status ?? finding.status`.
    - Derive `resolvedCount` / `failedCount` / `notApplicableCount` /
      `uncertainCount` strictly from `consolidatedMap` (per §5.3) —
      do NOT pass through `enriched.totals` for these four metadata
      fields. Fall back to `enriched.totals` only on the runs===1
      passthrough where `consolidatedMap` is empty.
    - Persist `tentativeStatus`, `voteBreakdown` on each comment.
    - Persist `metadata.uncertainCount` + `metadata.uncertainThreshold`.
  - [ ] Add `backfill-uncertain-status.ts` one-off script targeting
    `output_schema='legacy'` (NOT `'2026-06-crc'`, which never
    existed). Log the match count up front; abort on zero. Idempotency
    guard via `metadata.backfilledAt`.
  - [ ] Optional: fixture-based unit test for `consolidate()`.
- [ ] **CityHall PR**
  - [ ] Add `uncertain` arm to `crcStatusPillClass`, `crcStatusLabel`,
    `CompletenessCommentCard.svelte`'s `statusStyle`.
  - [ ] Widen `CcCrcTab` type; add `Uncertain` tab to `ccStatusTabs`
    for CRC; compute `initialCrcTab` based on `metadata.uncertainCount`.
  - [ ] Render `Uncertain: N` chip in the CRC counts banner.
  - [ ] Widen zod schemas that enumerate `comment.status` to accept
    `'uncertain'`. (Grep for `'resolved', 'failed', 'not-applicable'`
    enum sites.)
  - [ ] Render `tentativeStatus` + `voteBreakdown` in the comment-detail
    panel for uncertain items (small callout near the status pill,
    showing "Tentative: {tentativeStatus} • {voteBreakdown.resolved}R /
    {voteBreakdown.failed}F / {voteBreakdown.notApplicable}N").
- [ ] **Migration**
  - [ ] Run backfill against staging Supabase first; spot-check 1700.
  - [ ] Run against production.
- [ ] **Smoke test** per §10.
- [ ] **Beads** — create `noetic-???` for this spec (bureau impl bead) and
  link the impl PRs back.
- [ ] **Sibling spec stub** — create
  `../uncertain-status-manual-override/DESIGN-SPEC.md` with the Path A
  framing as a starting point.

## 14. References

| Thing | Path |
|---|---|
| CRC SPEC (parent) | `winston/workspaces/comment-resolution-check/SPEC.md` |
| CRC workflow DESIGN-SPEC | `winston/workspaces/comment-resolution-check/crc-workflow/DESIGN-SPEC.md` |
| CRC majority-vote DESIGN-SPEC | `winston/workspaces/comment-resolution-check/crc-workflow/majority-vote/DESIGN-SPEC.md` |
| CityHall UI DESIGN-SPEC | `winston/workspaces/comment-resolution-check/cityhall-ui/DESIGN-SPEC.md` |
| Sibling spec (future) | `winston/workspaces/comment-resolution-check/crc-workflow/uncertain-status-manual-override/DESIGN-SPEC.md` |
| CRC workflow.yaml | `bureau/workflows/comment-resolution-check/workflow.yaml` |
| CRC schemas | `bureau/workflows/comment-resolution-check/schemas/` |
| CRC consolidate script (fork target) | `bureau/workflows/comment-resolution-check/scripts/cross-run-consolidate-crc.ts` |
| CRC build-review-comments script | `bureau/workflows/comment-resolution-check/scripts/build-crc-review-comments.ts` |
| CityHall CRC routing | `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte` |
| CityHall CRC card | `cityhall/src/routes/(app)/project/[projectId]/review/CompletenessCommentCard.svelte` |
