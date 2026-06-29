# CRC Comment Triage Rework — Design Spec

> **Status:** Draft, 2026-06-29.
> Iteration on top of the [CRC SPEC](../../SPEC.md), the
> [crc-workflow DESIGN-SPEC](../DESIGN-SPEC.md), the
> [majority-vote DESIGN-SPEC](../majority-vote/DESIGN-SPEC.md), and the
> [uncertain-status DESIGN-SPEC](../uncertain-status/DESIGN-SPEC.md).
> **Subsumes and supersedes** the
> [uncertain-status-manual-override DESIGN-SPEC](../uncertain-status-manual-override/DESIGN-SPEC.md)
> — the user-adjudication surface for `uncertain` items folds into the same triage UI
> defined here. Drives one bureau PR + one cityhall PR.

---

## 1. Summary

Two coordinated changes to CRC, shipping together:

1. **Drop `not-applicable` from CRC's agent status enum.** Per-run agent verdicts
   become 2-state: `resolved` or `failed`. Truly-moot comments collapse into
   `resolved` ("no longer a concern"). `uncertain` remains a consolidation-time
   computation and is unaffected.

2. **Replace the 5-value generic triage UI with a per-workflow verdict-pick UI for
   CRC.** The user's triage choices become the verdict statuses themselves:
   `Resolved` / `Failed` (and `Uncertain` only when the agent's call is uncertain).
   The user's selection is auto-defaulted to the agent's verdict; picking the
   matching value is a no-op and writes nothing. Items stay in their original tab
   when overridden; an "overridden" badge on the pill + a "Corrected" chip in the
   counts banner signal the override.

**Cutover is date-gated.** New behavior applies to CRC reviews with
`reviews.completed_at > '2026-06-26T00:00:00Z'` AND `review_type = 'crc'`. Older
runs render with today's legacy UI. No backfill, no data migration, no DB schema
change.

**Completeness Check (CC) is out of scope for implementation.** A forward-looking
design section (§10) sketches the CC analog (Pass / Fail / Warn / N/A), but no
code lands here. CC continues to render the existing 5-value triage UI.

---

## 2. Goals

- Simplify the user's mental model: their triage choice IS the verdict, not an
  orthogonal "intent" tag.
- Eliminate the awkward 5-value triage states (`to-fix`, `formal-note`, `incorrect`,
  `na`, `new`) that never mapped cleanly to CRC's actual decisions.
- Subsume the deferred `uncertain` manual-override flow into the same UI surface.
- Don't break CC. The CC UI continues to render exactly as today.
- Avoid migrations and backfills. Old CRC runs render with the old UI; new CRC runs
  render with the new UI. Old data stays interpretable in place.
- Keep the DB surface tiny — no schema changes.

## 3. Non-goals

- **CC UI rework.** Design intent only (§10). No code in this spec.
- **Bulk actions** (e.g., "agree with agent on all of these"). Per Q15.
- **PDF report changes** (`generate-crc-report`). Deferred per Q19.
- **Audit fields** beyond the existing `comment_triage.updated_at`. Per Q7 — no
  `set_by_user_id` column for MVP.
- **Permissions narrowing.** Per Q20, any user with project view-access can
  override.
- **Migration of pre-cutover `comment_triage` rows** belonging to old CRC reviews.
  They render with the legacy UI in place.
- **Generalising the verdict-pick UI to formal-review.** Formal review has its own
  status semantics and its own renderer path; out of scope.

---

## 4. Design decisions (locked)

| #   | Decision | Choice | Source |
|-----|----------|--------|--------|
| D1  | Where the user's verdict pick lives | Existing `comment_triage.triage_status` (plain TEXT, no schema change) | Q5 deep dive |
| D2  | DB schema changes | **None.** Reuse `triage_status` + `triage_note`. | Q5 deep dive |
| D3  | Audit field `set_by_user_id` | Skip for MVP | Q7 |
| D4  | Interpreting `triage_status` | Join to `reviews.review_type`; CRC-typed reviews use the CRC verdict enum, CC-typed reviews use the legacy 5-value set | Q5 |
| D5  | Cutover mechanism | Date gate: `review_type = 'crc' AND completed_at > '2026-06-26T00:00:00Z'` | Q5 follow-up |
| D6  | Agent emit-schema status enum | Tighten to 2-state (`resolved`, `failed`) | Q3 |
| D7  | Where moot comments go | `resolved` ("no longer a concern") | Q1 |
| D8  | Legacy `not-applicable` items on the new side of the gate | Render-layer coercion: display as `resolved`. No DB write. | Q2 + 1 stranded item in `1b2f8fa5...` |
| D9  | Default user-determination | Auto-selected to match the agent's verdict; no DB row written for the no-op state | Q6 + Q9 |
| D10 | Per-agent-verdict button set | Agent = `resolved` → [**Resolved**, Failed]; Agent = `failed` → [Resolved, **Failed**]; Agent = `uncertain` → [**Uncertain**, Resolved, Failed] (defaults in bold) | Q6 |
| D11 | DB row instantiation | Lazy: row written only when user picks a value ≠ agent verdict OR types a triage note | Q9 |
| D12 | Effective-no-override semantics | A row exists with `triage_status == agent verdict` AND empty `triage_note` behaves identically to no row at all (renderer can ignore either way) | Q9 |
| D13 | Counts banner | Agent counts (primary) + effective post-override counts (secondary) + standard "Corrected" chip per Completeness pattern | Q10 + Q11 |
| D14 | Filter-tab counts | Anchored on AGENT verdict (item stays in its original tab when overridden) | Q11 + kickoff |
| D15 | "Notes" filter dropdown | Repurposed to **All / Has override / No override** | Q12 |
| D16 | Triage note textarea | Stays; applicable to any verdict pick (including the default) | Q13 |
| D17 | Visual treatment of an overridden row | The user's verdict pill replaces the agent's; small "overridden" badge attached. The agent's original verdict is visible inside the triage panel. | Q14 |
| D18 | Bulk actions | None for MVP | Q15 |
| D19 | Uncertain manual override | This spec REPLACES `uncertain-status-manual-override/DESIGN-SPEC.md` | Q16 |
| D20 | `tentativeStatus` for uncertain items | Stays persisted (per the uncertain-status DESIGN-SPEC) and is shown as informational context inside the triage panel. User selects fresh among [Uncertain, Resolved, Failed]; no auto-pre-fill to `tentativeStatus`. | Q16 follow-up |
| D21 | Click flow | Unchanged. Row click opens the existing `CommentTriagePanel`; the new verdict-pick UI lives inside the panel. | Q17 |
| D22 | Scope | CRC implementation only; CC gets design section only (§10) | Q18 |
| D23 | PDF rendering of overrides | Deferred | Q19 |
| D24 | Permissions | Anyone with project view-access can override (no narrowing) | Q20 |

---

## 5. Bureau / workflow changes

All edits in `bureau/workflows/comment-resolution-check/`.

### 5.1 `crc.emit.schema.json` — tighten the status enum

Today: `status: 'resolved' | 'failed' | 'not-applicable'`.
New:   `status: 'resolved' | 'failed'`.

The agent SDK validates against this schema on each cell, so this change is a hard
contract: any new run cannot emit `not-applicable`.

### 5.2 `crc.schema.json` — mirror the tightening

Documents the canonical post-normalize per-cell shape (`grouping` injected, otherwise
identical to the emit shape). Same status-enum narrowing.

### 5.3 `prompts/review.md` — update the rubric

Remove the `not-applicable` rubric. Replace with:

> If the comment is moot in U1 (the feature the comment was about has been removed,
> or the comment's conditional doesn't apply to U1's scope), the verdict is
> `resolved` — the comment is no longer a concern. Capture the moot reasoning in
> the `observation` + `reasoning` fields.

### 5.4 `cross-run-consolidate-crc.ts` — narrow per-run input domain

Per-run agent statuses become 2-state (`'resolved' | 'failed'`). The CONSOLIDATED
status remains 4-state (`'resolved' | 'failed' | 'uncertain'` plus historically
`'not-applicable'` on legacy rows — which the consolidate function still tolerates
on legacy vote inputs).

`consolidate()` simplifications:
- Severity tie-break drops to 2-state: `failed > resolved`.
- `voteBreakdown` keeps the `'not-applicable': number` key for backward compat with
  legacy `perRunFindings`, but new runs will always emit `0` for it.

Implementer note: leave the existing handling of legacy `'not-applicable'` per-run
statuses intact — those still need to consolidate correctly when the backfill
script (uncertain-status DESIGN-SPEC §7) re-runs on legacy data.

### 5.5 No new workflow metadata flag

We chose a date gate over a metadata flag (Q5 follow-up). The workflow does NOT
stamp `metadata.commentTriageScheme` or any sibling field. Cityhall reads
`reviews.completed_at` directly.

---

## 6. CityHall UI changes

All edits land in `cityhall/src/routes/(app)/project/[projectId]/review/`.

### 6.1 The cutover gate

One derived value decides which rendering branch fires. Defined once and reused
wherever CRC rendering branches.

```ts
// Top of cityhall review module (or a shared constants file)
export const CRC_VERDICT_TRIAGE_CUTOVER_AT = '2026-06-26T00:00:00Z';

// In [reviewId]/+page.svelte (sibling to existing isCRC derived)
const usesNewCrcTriage = $derived(
  data.review.review_type === 'crc' &&
  data.review.completed_at !== null &&
  new Date(data.review.completed_at) > new Date(CRC_VERDICT_TRIAGE_CUTOVER_AT)
);
```

When `usesNewCrcTriage` is true:
- Filter tabs render the 3-tab set (Failed / Resolved / Uncertain). No N/A tab.
- Row pills render with the 2-value (+ uncertain) enum; legacy `not-applicable`
  items coerce to `resolved` for display.
- The triage panel renders the new `CrcVerdictTriageBar` component (§6.2).
- The counts banner renders agent + effective + Corrected chip.
- The Notes-filter dropdown renders the All / Has override / No override options.

When false: legacy CRC rendering (unchanged from today).

### 6.2 New `CrcVerdictTriageBar` component

A new sibling component `CrcVerdictTriageBar.svelte` living next to the existing
`TriageBar.svelte`. Not a `variant`-prop branch — the button-set shape, the
agent-verdict-driven default, the absence of a sub-status row, and the new
required `agentVerdict` prop diverge from legacy enough that a single component
would be mostly conditionals. Sibling components also give a clean delete path
when CC migrates (§10).

Renders:

- **Button set** depending on the agent's verdict (D10), taking `agentVerdict`
  as a required prop.
- **Auto-selection** of the agent's verdict when no `comment_triage` row exists.
- **Triage-note textarea** with **1-second debounce on keystroke**, reusing the
  exact semantics from `TriageBar.svelte:onNoteInput` (per-keystroke `oninput`
  → 1000ms `setTimeout` → single PATCH; timer cleared on row navigation and on
  component destroy; tiny "Saving…" → "Saved ✓" indicator). Note-debounce
  machinery may be duplicated inline or extracted to a shared helper —
  implementer's choice.
- **No sub-status** controls. `triage_sub_status` stays unused for CRC; the
  PATCH payload always sends `triage_sub_status: null`.

PATCH calls hit the existing `/project/[projectId]/review/triage` endpoint with
`triage_status` set to one of the new values (`'resolved'`, `'failed'`,
`'uncertain'`).

### 6.3 Auto-selection + lazy DB instantiation

The UI default state — no `comment_triage` row exists for an item:
- The button matching the agent's verdict appears selected.
- Empty note textarea.

User actions and their DB effects:
- **User clicks the default button (same as agent) with empty note** → no DB write.
- **User types in the note** → 1s debounce after the last keystroke, then a
  single PATCH writes a row with `triage_status = agent verdict`,
  `triage_note = text`. (Row exists but is "effectively no override" per D12.)
  See §6.2 for the exact note-debounce semantics (reused from legacy
  `TriageBar.svelte`).
- **User clicks a different button** → immediate PATCH; row written with
  `triage_status = user pick`, `triage_note` unchanged.
- **User reverts the button to agent verdict (with note still present)** →
  immediate PATCH updates `triage_status` back to agent verdict; row stays.
- **User clears the note (with verdict still equal to agent)** → 1s debounce
  after the last keystroke, then PATCH updates `triage_note = null`. Row stays
  in the DB as "effectively no override" (D12) — the renderer never
  distinguishes it from no-row, so deleting would be wasted work.

The renderer treats the **no-row case** and the **effectively-no-override case** as
identical for display purposes. No special UI cue distinguishes them.

### 6.4 Status pills

For each item row:
- **No effective override** → pill shows agent's verdict (green Resolved, red
  Failed, amber Uncertain).
- **Effective override** (row exists AND `triage_status ≠ agent verdict`) → pill
  shows the USER's verdict, with a small "overridden" badge (e.g., a corner dot or
  a tiny `↺` glyph). Same color palette.

The agent's original verdict is always visible inside the triage panel.

### 6.5 Counts banner

Three pieces of count info, per D13. Sketch, using `1b2f8fa5...` (229 comments
total: 32 resolved + 1 coerced N/A + 167 failed + 29 uncertain) with a
hypothetical 3 failed→resolved overrides:

```
Resolved: 33   Failed: 167   Uncertain: 29              ← agent counts (primary)
After overrides: 36 / 164 / 29        Corrected: 3      ← effective + chip (secondary)
```

Both rows total 229. **Invariant — no invisible items.** Every comment in
`review_comments` must contribute to exactly one bucket in the agent-counts row
and to exactly one bucket in the after-overrides row. The sums of each row
equal the run's total comment count. The N/A→resolved coercion (§6.8) is what
enforces this on the new side — without it, the 1 stranded N/A in
`1b2f8fa5...` would be unaccounted for and the banner numbers wouldn't match
the tab row counts. Any future status value that escapes the canonical 3-state
set MUST be assigned a display bucket; the banner never silently drops items.

Definitions:
- **Agent counts** = `review_comments.output_json.status` aggregated, with the
  render-layer N/A→resolved coercion applied. The 33 above = 32 native
  resolved + 1 coerced N/A.
- **Effective counts** = agent counts after applying overrides (where a
  `comment_triage` row's `triage_status` differs from the agent's verdict for
  that comment).
- **Corrected** = count of items where the user has overridden the agent's call
  (items with `comment_triage.triage_status ≠ agent verdict`). Items where the
  user only annotated (row exists, verdict matches agent, note present) do NOT
  count toward Corrected.

If pilot UX feedback says the three count surfaces is too much, fold "After
overrides" into the Corrected chip ("Corrected: 3 (net +3 resolved / -3 failed)").
Captured as a possible follow-up in §14. Note that any such collapse must still
honor the no-invisible-items invariant — every comment remains accounted for.

### 6.6 Filter tabs

Tabs render the 3-tab set anchored on AGENT verdict (D14):

| Tab | Count |
|---|---|
| Failed | agent's failed total |
| Resolved | agent's resolved total (incl. coerced legacy N/A) |
| Uncertain | agent's uncertain total |

Default-tab logic from `uncertain-status` DESIGN-SPEC §8.2 unchanged: land on
Uncertain if any exist, else Failed.

An item stays in its original tab when overridden. A user-overridden item appears
in the tab matching its AGENT verdict, displayed with the user's verdict pill +
"overridden" badge.

### 6.7 "Notes" filter dropdown

Repurposed (D15):

| Option | Predicate |
|---|---|
| All (default) | no filter |
| Has override | `comment_triage` row exists AND `triage_status ≠ agent verdict` |
| No override | item is "effectively no override" (no row OR row with matching verdict + empty note) |

### 6.8 Render-layer N/A coercion

When `usesNewCrcTriage` is true AND a comment's `output_json.status` is
`'not-applicable'`, the renderer treats the status as `'resolved'` for **display
purposes only**. The underlying DB row is not mutated. This collapses the 1
stranded item in `1b2f8fa5...` (and protects against any future legacy N/A
straggler) without a backfill.

Coercion sites:
- Pill rendering (color + label)
- Filter-tab bucketing (counted as resolved in the Resolved tab)
- Agent-count totals in the banner (per §6.5 — coerced items roll into the
  Resolved column so the banner totals match the tab row counts)
- Effective-count totals (override comparisons use the coerced value as the
  baseline)

### 6.9 Branch sites to walk

Implementer should walk these and fork on `usesNewCrcTriage`:
- Tab definitions (`ccStatusTabs` and the `CcCrcTab` type)
- Status pill helpers (`crcStatusPillClass`, `crcStatusLabel`, and
  `CompletenessCommentCard`'s `statusStyle` if it ever serves CRC) — though note
  the CRC flat list uses inline rows, not `CompletenessCommentCard` (per cityhall-ui
  DESIGN-SPEC C1)
- Counts banner block
- Triage panel content (`CommentTriagePanel`)
- Notes-filter dropdown options
- Zod schemas that enumerate `triage_status` — widen to accept any string for the
  CRC path, or include the new values explicitly

### 6.10 Zod schema widening

Per uncertain-status DESIGN-SPEC §8.4, parent + section-route zod schemas
enumerate `comment.status`. Those continue to need `'uncertain'` (already added)
and now also can drop `'not-applicable'` from the validated set for CRC-typed
reviews on the new side of the gate. Pragmatic move: accept either
`z.string()` or the 4-state union (`resolved | failed | uncertain | not-applicable`)
on the row, since legacy reviews still carry N/A.

---

## 7. Data behavior

No DB schema change. Same `comment_triage` table, same PATCH endpoint, same
`triage_note` semantics.

### 7.1 What CRC writes (post-cutover)

For a CRC review with `completed_at > cutover`:
- `triage_status` ∈ `{'resolved', 'failed', 'uncertain'}`
- `triage_sub_status` = always NULL
- `triage_note` = optional free text

Substation's PATCH endpoint (`substation/src/routes/comment-triage.ts`) requires no
changes — it accepts any string for `triage_status` and does no enum validation.

### 7.2 Coexistence with legacy CRC triage rows

Legacy CRC reviews (the three pre-cutover runs in §8.1) keep their existing
`comment_triage` rows with values like `'to-fix'` / `'formal-note'` / `'incorrect'`
/ `'na'` / `'new'`. The legacy UI renders them correctly, unchanged.

For new CRC reviews, no such rows exist yet, and the new UI never writes those
values. So there is no value collision.

If a stale legacy-style row somehow exists for a new-side review (e.g., a row
created mid-flight during the cutover, or someone POSTs directly to the endpoint),
the new UI doesn't recognize it as a valid CRC verdict. It treats it as **no
effective override** (the renderer falls through to the agent's verdict). This is
acceptable for MVP. If we ever need to clean it up, a one-off script could delete
or rewrite those rows.

### 7.3 Coexistence with CC triage rows

CC continues to write the 5-value set into the same column. Interpretation is
contextual via `reviews.review_type`. The TEXT column carries both vocabularies
without ambiguity because every read joins to `reviews`.

---

## 8. Behavior at the cutover boundary

### 8.1 CRC reviews in scope (as of 2026-06-29)

| Review ID | `completed_at` | `is_current` | Post-spec rendering |
|---|---|---|---|
| `1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8` | 2026-06-26 17:10 UTC | ✅ | **New UI** |
| `a8d07d22-19e6-4a1f-a12d-a4371c1dbd19` | 2026-06-25 13:00 UTC | — | Legacy UI |
| `3703349c-ac08-44b8-8c10-2100adb89f5b` | 2026-06-23 21:46 UTC | — | Legacy UI |
| `7e79e197-8922-4c18-8a94-bc6d43218362` | 2026-06-19 22:58 UTC | — | Legacy UI |

### 8.2 Quirks on the new side

`1b2f8fa5...` was produced by the **old** workflow (the new emit schema hasn't
shipped yet). Its `review_comments.output_json.status` distribution:

| Status | Count | New-UI treatment |
|---|---|---|
| `failed` | 167 | Standard |
| `resolved` | 32 | Standard |
| `uncertain` | 29 | Amber pill; 3-option triage UI (Uncertain / Resolved / Failed) |
| `not-applicable` | 1 | Render-layer coerced to `resolved` (D8) |

Both quirks are handled by the spec without DB writes. Future runs under the new
workflow will produce zero `not-applicable` items.

### 8.3 Future runs

Any new CRC run after the implementation lands will:
- Have `completed_at` after the cutover ⟹ new UI by default.
- Produce only `'resolved'` / `'failed'` per-run agent verdicts.
- Possibly produce `'uncertain'` consolidated verdicts when `runs >= 3` and the
  uncertain-status gate fires (uncertain-status DESIGN-SPEC §5).

---

## 9. Smoke test plan

Target review: `1b2f8fa5-bd74-47ce-9eaf-5c6f950bede8` (1700 South Lamar U0).

1. **Pre-cutover sanity.** Open `7e79e197...` (or any of the three legacy runs)
   and confirm:
   - 4-tab set (Failed / Resolved / N/A) renders. *(No Uncertain tab — these runs
     are pre-uncertain too.)*
   - Existing `comment_triage` rows with old triage statuses still render in the
     legacy TriageBar.
   - No new-UI controls (verdict pills, Corrected chip, repurposed Notes filter)
     appear.

2. **Post-cutover landing.** Open `1b2f8fa5...`:
   - Tabs render [Failed, Resolved, Uncertain] — no N/A tab.
   - The single legacy N/A item appears in the Resolved tab with a green pill.
   - The 29 uncertain items appear in the Uncertain tab with amber pills.
   - Default tab is Uncertain (per uncertain-status §8.2).

3. **Override flow (non-uncertain item).**
   - On an agent-`failed` item, click `Resolved`.
   - Confirm a `comment_triage` row is created with `triage_status='resolved'`.
   - Row stays in the Failed tab (per D14).
   - The pill on the row swaps to green Resolved with the "overridden" badge.
   - "Corrected" chip count increments by 1.
   - "After overrides" line updates (failed −1, resolved +1).

4. **No-op flow.**
   - On an agent-`resolved` item, the default selection is `Resolved`. Don't
     click anything. Confirm no `comment_triage` row is written.
   - Click `Resolved` explicitly (same as default). Confirm: either no row is
     written, or a row is written but the UI behaves identically (per D12).

5. **Annotation flow.**
   - On an agent-`resolved` item, leave verdict at default and type a note.
   - Confirm a `comment_triage` row is written with `triage_status='resolved'` +
     `triage_note=text`.
   - "Corrected" chip count does NOT increment (annotation alone doesn't count).
   - Notes-filter "Has override" does NOT surface this row.

6. **Reversion flow.**
   - Override an item, then revert the verdict back to the agent's.
   - Confirm the row is UPDATED (`triage_status` flips back), not deleted.
   - Override badge disappears.
   - Counts revert.

7. **Uncertain manual override.**
   - On an uncertain item, confirm 3 buttons render (Uncertain, Resolved, Failed)
     with Uncertain auto-selected.
   - Inside the triage panel, confirm the persisted `tentativeStatus` (e.g.,
     "Tentative: Failed") is visible as informational context.
   - Pick `Resolved`. Confirm `comment_triage.triage_status='resolved'`, row stays
     in Uncertain tab, pill swaps to green Resolved + override badge.

8. **Notes-filter repurposing.**
   - Confirm dropdown options are All / Has override / No override.
   - Filter to Has override: only the overridden item from step 3 (and any from
     step 7) appears.
   - Filter to No override: the rest.

9. **Date-gate boundary** (staging only).
   - Manually nudge a legacy review's `completed_at` to just past the cutover.
     Reload. Confirm it flips to the new UI rendering. Revert in staging.

---

## 10. Completeness Check UI — forward-looking design

This section is **design intent only.** No code lands here. A separate
DESIGN-SPEC drives the CC migration when scheduled.

### 10.1 Same shape, four-value enum

CC's per-agent-verdict button set mirrors the CRC pattern:

| Agent verdict | Button set | Default |
|---|---|---|
| `pass` | [Pass, Fail, Warn, N/A] | Pass |
| `fail` | [Pass, Fail, Warn, N/A] | Fail |
| `warn` | [Pass, Fail, Warn, N/A] | Warn |
| `not-applicable` | [Pass, Fail, Warn, N/A] | N/A |

Same lazy DB instantiation, same effective-no-override semantics, same Corrected
chip, same Notes-filter repurposing. CC stays on its existing 4-state status
enum — no analog of CRC's N/A removal.

### 10.2 Cutover date

A future CC-specific cutover date, picked at the time of the CC migration PR.
Pre-cutover CC reviews keep rendering the 5-value triage UI.

### 10.3 Open question for the CC spec

CC has `unclear` as a 5th agent-side status (per `cityhall/docs/review-v1.md`'s
schema, though it may not appear in current 2026-04-simplified output). The CC
spec needs to decide whether `unclear` is user-selectable, agent-only, or
collapsed into one of the four primary statuses on display. Not this spec's
problem.

---

## 11. File-by-file implementation map

### 11.1 Bureau PR

```
bureau/workflows/comment-resolution-check/
  schemas/
    crc.emit.schema.json    # status enum: drop 'not-applicable'
    crc.schema.json         # mirror
  prompts/
    review.md               # remove N/A rubric; document moot → resolved
  scripts/
    cross-run-consolidate-crc.ts
      # - Narrow per-run Status to 'resolved' | 'failed' in the type
      # - Keep voteBreakdown.not-applicable field (legacy compat) but new runs emit 0
      # - 2-state severity tie-break
      # - Backfill-friendly: legacy 3-state votes still consolidate correctly
```

Optional follow-up: a fixture-based unit test for `consolidate()` on legacy 3-state
inputs. Cheap; useful for ensuring the uncertain-status backfill doesn't regress.

### 11.2 CityHall PR

```
cityhall/src/routes/(app)/project/[projectId]/review/
  [reviewId]/+page.svelte
    • Add CRC_VERDICT_TRIAGE_CUTOVER_AT constant (or import from shared module).
    • Add `usesNewCrcTriage` derived sibling to `isCRC`.
    • Fork tab definitions / pill helpers / counts banner / Notes-filter on
      `usesNewCrcTriage`.
    • Add "overridden" badge to row pill rendering.
    • Wire render-layer N/A→resolved coercion (D8 / §6.8).
    • Widen any local zod schemas enumerating triage_status.

  CrcVerdictTriageBar.svelte  (NEW — sibling to TriageBar.svelte)
    • Per-agent-verdict button set; takes `agentVerdict` as a required prop.
    • Auto-selects the agent verdict on mount; lazy DB writes per §6.3.
    • Note textarea with 1s keystroke debounce — reuses semantics from
      TriageBar.svelte:onNoteInput (oninput → 1000ms setTimeout → PATCH; timer
      cleared on row navigation + destroy; "Saving…/Saved ✓" indicator). Copy
      the debounce machinery inline or extract to a shared helper — caller's
      choice.
    • Always sends `triage_sub_status: null` in the PATCH payload.

  TriageBar.svelte
    • Unchanged. Continues to serve the legacy CC + pre-cutover CRC paths.

  CommentTriagePanel.svelte
    • When `usesNewCrcTriage`, render new variant.
    • Always show agent's original verdict prominently in the panel header
      (so user can see what they're overriding).
    • For uncertain items, show the persisted `tentativeStatus` from
      `output_json.tentativeStatus` (per uncertain-status DESIGN-SPEC §6.2)
      as informational context.

  load-comment-history.ts
    • If it filters by triage_status enum, widen to accept the new values.
```

### 11.3 What does NOT change

- `substation/src/routes/comment-triage.ts` — PATCH endpoint. Already accepts
  arbitrary strings.
- `comment_triage` DB schema. No migrations.
- `reviews` / `review_comments` schema or `output_schema` value.
- CC rendering, CC tabs, CC triage anywhere.
- Formal-review rendering or triage.
- The chat / triage-PATCH endpoint payload shape.

---

## 12. Risk register

### R1 — Cross-repo merge ordering

If the bureau PR ships before the cityhall PR, new CRC runs would produce 2-state
verdicts that the legacy UI still tries to bucket into a 4-tab set (with empty
N/A tab). Mitigation: ship **cityhall first**, then bureau. The cityhall PR is
backward-compatible — old runs render exactly as today; the new code paths only
fire when `usesNewCrcTriage` AND `completed_at > cutover` — i.e., for runs that
don't exist yet. The first post-cutover run lands cleanly.

### R2 — Legacy `not-applicable` items on the new side

`1b2f8fa5...` has 1 stranded N/A item. The render-layer coercion (D8 / §6.8)
handles it. If more legacy N/A items surface from a retroactive workflow rerun,
the rule still holds — they all display as resolved.

### R3 — User confusion: pill ≠ tab

A failed item that the user overrode to resolved sits in the **Failed** tab but
displays a **green Resolved** pill (+ badge). Plausibly confusing on first
encounter. Mitigation: the override badge is prominent; the Corrected chip in the
banner sets expectations. If pilot reports confusion, add a brief first-time
tooltip on the override flow.

### R4 — Counts banner overload

Three count surfaces (agent / effective / corrected) could be too much. Mitigation:
agent counts are PRIMARY (large, top); effective is smaller secondary text;
corrected is a single chip. If pilot says it's noise, collapse effective into the
chip ("Corrected: 3 (net +3 resolved)").

### R5 — Stale legacy-style `comment_triage` rows on the new side

If a row with `triage_status='to-fix'` somehow exists for a post-cutover review
(direct DB edit, racy write during deploy, manual fixup), the new UI treats it as
"no effective override" and renders the agent's verdict. The note (if any) is
still displayed inside the triage panel — but the user's stale verdict choice is
silently ignored.

This is a deliberate trade: simpler renderer, no migration needed. If the situation
occurs in practice and surprises a user, we can write a one-off cleanup script.

### R6 — Hardcoded cutover date

`CRC_VERDICT_TRIAGE_CUTOVER_AT = '2026-06-26T00:00:00Z'` lives in cityhall code.
If we ever need a second cutover (e.g., another major enum reshape later), it's a
code change rather than a per-row flag. Acceptable for MVP. If we end up needing
multiple gates, switch to the metadata-flag pattern from the Q5 follow-up.

### R7 — Uncertain manual override coverage

The `uncertain-status-manual-override` spec is now superseded by this one (D19).
Anything that spec promised (e.g., Path A semantics, `userAdjudicatedStatus`) is
re-housed:
- The "user's choice lives separately from the agent's call" → satisfied by
  `comment_triage.triage_status` (user's pick) vs. `review_comments.output_json.status`
  (agent's call). Never overwritten.
- The `tentativeStatus` pre-fill suggestion → spec keeps `tentativeStatus`
  persisted but does NOT auto-pre-fill it. The user always sees `Uncertain`
  auto-selected and picks fresh. Cleaner; matches the "agent verdict auto-selected"
  rule everywhere else.
- Bulk adjudication "I agree with tentative on all of these" → out of scope per
  D18.

The superseded spec's body should be rewritten (or replaced with a redirect
header) as part of this PR.

---

## 13. Implementation checklist

- [ ] **Bureau PR**
  - [ ] Tighten `crc.emit.schema.json` status enum to 2-state.
  - [ ] Mirror in `crc.schema.json`.
  - [ ] Update `prompts/review.md` rubric (drop N/A; moot → resolved).
  - [ ] Update `cross-run-consolidate-crc.ts` types + tie-break; preserve legacy
        vote compat.
  - [ ] Optional: fixture-based unit test for `consolidate()` with legacy
        3-state votes.

- [ ] **CityHall PR**
  - [ ] Add `CRC_VERDICT_TRIAGE_CUTOVER_AT` + `usesNewCrcTriage` derived.
  - [ ] Branch tab definitions on `usesNewCrcTriage` (3-tab CRC: Failed /
        Resolved / Uncertain).
  - [ ] Branch status-pill helpers (drop N/A from new path; render-layer
        coerce legacy N/A to resolved).
  - [ ] Branch counts banner: agent counts, effective counts, Corrected chip.
  - [ ] Branch Notes-filter dropdown options: All / Has override / No override.
  - [ ] New `CrcVerdictTriageBar.svelte` sibling component (per-agent-verdict
        button set, auto-select, lazy DB writes, 1s keystroke debounce reusing
        legacy TriageBar's note semantics).
  - [ ] Wire `CommentTriagePanel` to surface agent verdict + `tentativeStatus`
        context.
  - [ ] Add "overridden" badge to row pill rendering when user verdict ≠ agent
        verdict.
  - [ ] Widen relevant zod schemas to accept the new `triage_status` values.

- [ ] **Spec hygiene**
  - [ ] Rewrite `uncertain-status-manual-override/DESIGN-SPEC.md` as a
        SUPERSEDED redirect to this spec.
  - [ ] Optionally annotate the parent `crc-workflow/DESIGN-SPEC.md` Open Items
        section to note this rework landed.

- [ ] **Smoke test** per §9.

- [ ] **Beads** — create implementation issue(s) and link both PRs.

---

## 14. Open items / future work

- **CC migration spec.** §10 is the starting design. Pick a cutover date for CC
  and draft as a sibling DESIGN-SPEC when prioritized.
- **PDF report rendering of overrides** (`generate-crc-report`). When the report
  skill next iterates, decide how to surface the user's verdict + agent's verdict
  + override badge in the city-ready PDF.
- **Bulk actions.** Revisit if pilot shows users routinely overriding many items
  in the same direction.
- **Audit fields.** `set_by_user_id` deferred per Q7. Add when a real consumer
  surfaces (multi-user collab, override analytics).
- **Permissions narrowing.** Open per Q20. Tighten if pilot shows misuse.
- **Migration of legacy CRC `comment_triage` rows.** Leave as-is per R5. Optional
  one-off cleanup script later if desired.
- **Counts banner simplification.** Per R4, consider folding effective counts
  into the Corrected chip if it's noise in practice.
- **Metadata-flag cutover.** If date-gating becomes brittle (e.g., multiple
  reshapes needed), switch to a workflow-stamped `metadata.commentTriageScheme`
  flag.

---

## 15. References

| Thing | Path |
|---|---|
| CRC SPEC (parent) | `winston/workspaces/comment-resolution-check/SPEC.md` |
| CRC workflow DESIGN-SPEC | `winston/workspaces/comment-resolution-check/crc-workflow/DESIGN-SPEC.md` |
| CRC majority-vote DESIGN-SPEC | `winston/workspaces/comment-resolution-check/crc-workflow/majority-vote/DESIGN-SPEC.md` |
| CRC uncertain-status DESIGN-SPEC | `winston/workspaces/comment-resolution-check/crc-workflow/uncertain-status/DESIGN-SPEC.md` |
| CRC uncertain-status-manual-override DESIGN-SPEC (**SUPERSEDED** by this spec) | `winston/workspaces/comment-resolution-check/crc-workflow/uncertain-status-manual-override/DESIGN-SPEC.md` |
| CityHall CRC UI DESIGN-SPEC | `winston/workspaces/comment-resolution-check/cityhall-ui/DESIGN-SPEC.md` |
| CRC schemas | `bureau/workflows/comment-resolution-check/schemas/` |
| CRC consolidate script | `bureau/workflows/comment-resolution-check/scripts/cross-run-consolidate-crc.ts` |
| CRC review prompt | `bureau/workflows/comment-resolution-check/prompts/review.md` |
| CityHall review page | `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte` |
| CityHall TriageBar | `cityhall/src/routes/(app)/project/[projectId]/review/TriageBar.svelte` |
| CityHall CommentTriagePanel | `cityhall/src/routes/(app)/project/[projectId]/review/CommentTriagePanel.svelte` |
| Substation triage PATCH | `substation/src/routes/comment-triage.ts` |
| `comment_triage` table definition | `substation/supabase/migrations/00000000000000_baseline.sql:812-829` |
