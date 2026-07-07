# CC Verdict Override Refactor — Design Spec

> **Status:** Draft, 2026-07-07.
> The Completeness Check follow-on anticipated by
> [CRC comment-triage-rework DESIGN-SPEC §10](../../comment-resolution-check/crc-workflow/comment-triage-rework/DESIGN-SPEC.md).
> Builds on the always-visible triage bar restored in
> [cityhall#571](https://github.com/noetic-inc/cityhall/pull/571) and the CC
> uncertain status work ([uncertain-status DESIGN-SPEC](../uncertain-status/DESIGN-SPEC.md)).
> Drives one substation PR (migration + endpoint + PDF) and one cityhall PR (UI).

---

## 1. Summary

Three coordinated changes, shipping together:

1. **Split user comment triage into two orthogonal axes, each with its own DB
   column.** Today's 5-value `triage_status` conflates two different questions:

   | Axis | Question | Legacy values that answered it |
   |---|---|---|
   | **Determination** (verdict override) | "What is the *correct* status of this item?" | `incorrect` (≈ force Pass), `na` (≈ force N/A) |
   | **Disposition** (acknowledgement) | "What are *we going to do* about this finding?" | `to-fix`, `formal-note` |

   A new nullable `comment_triage.verdict_override` column carries the
   determination axis. `triage_status` narrows to the disposition axis for new
   writes (`new` / `to-fix` / `formal-note`); `incorrect` and `na` are retired.

2. **Replace CC's 5-value triage bar with a two-row panel**, date-gated like
   CRC's rework: a CRC-style verdict-pick row ("Your determination":
   Pass / Fail / Warn / N/A, defaulted to the agent's verdict, lazy DB write),
   plus a disposition row (To Fix / Formal Note + note) shown when the
   effective verdict is Fail or Warn. This is what finally gives users a way to
   adjudicate `uncertain` items — the original motivation for this refactor.

3. **Unify CRC onto the same column.** The 18 production rows where
   post-cutover CRC verdicts live in `triage_status` are backfilled into
   `verdict_override` in the same migration; `CrcVerdictTriageBar` switches to
   writing the new column. After this ships, `triage_status` never means
   "verdict" anywhere in the system.

**Cutover is date-gated, mirroring CRC.** New behavior applies to CC reviews
with `reviews.completed_at > CC_VERDICT_TRIAGE_CUTOVER_AT` (constant picked at
cityhall-PR merge time). Older CC reviews keep the legacy 5-value UI, legacy
counts math, and legacy PDF rendering, entirely frozen. No coalesce layer
between the two worlds: all future CC runs are on new site plans, and existing
version chains with legacy triage are test artifacts, known to be brittle
(see §8.3).

---

## 2. Goals

- Let users adjudicate `uncertain` CC items by picking the actual verdict
  (Pass / Fail / Warn / N/A) — and, symmetrically, correct any agent verdict.
- Preserve the disposition workflow (`to-fix`, `formal-note` + note) that the
  legacy UI carries and the formal PDF report renders. Verdict correction and
  workflow acknowledgement are different user intents; keep both.
- Converge the whole system on one convention: **`verdict_override` = verdict
  axis (CC and CRC); `triage_status` = disposition axis (CC) or frozen legacy
  values (old reviews).** No column whose meaning depends on review type +
  date.
- Reuse the interaction patterns CRC's rework already established and shipped:
  per-agent-verdict button ordering, default-to-agent, lazy DB instantiation,
  effectively-no-override semantics, Corrected chip, R5-style tolerance of
  stale rows.
- Keep the DB delta to one additive column + one value-scoped backfill.

## 3. Non-goals

- **Migrating or reinterpreting legacy CC triage data.** Pre-cutover reviews
  render exactly as today. No backfill of `incorrect`/`na` rows, no read-time
  mapping of them on the new side.
- **Auto-inheritance of verdict overrides across versions.** Explicitly
  deferred (§9). Dispositions keep the existing display-inheritance + confirm
  flow. The door is held open with a one-line loader change, not schema.
- **Bulk verdict overrides.** `BulkTriageLightbox` operates on dispositions
  only on the new side. Overriding a verdict is a per-item judgment against
  that item's evidence.
- **Formal-review (simplified-schema) triage.** The `[sectionId]` page's
  TriageBar usage is untouched; formal review has its own status semantics.
- **Agent emit-schema changes.** Unlike the CRC rework, CC's agent status enum
  (`pass` / `fail` / `warn` / `not-applicable` / `uncertain`) is unchanged. No
  bureau PR.
- **Audit fields** (`set_by_user_id` etc.) — same call as CRC rework Q7.
- **Permissions narrowing** — same call as CRC rework Q20.

---

## 4. Design decisions (locked)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | Where the verdict override lives | New nullable `comment_triage.verdict_override` TEXT column | Disjoint from `triage_status` → rows are self-describing; ends the "same column, four interpretations" problem the CRC cutover papered over |
| D2 | Where the disposition lives | Existing `triage_status`, value set narrowed for new writes to `new` / `to-fix` / `formal-note` | `to-fix`/`formal-note` semantics are unchanged from legacy; only the verdict-ish values (`incorrect`, `na`) retire |
| D3 | CRC verdict storage | Unified onto `verdict_override` via backfill (§7.2) | Only 18 production rows; avoids a permanent two-convention split for every cross-cutting consumer (PDFs, analytics, IG) |
| D4 | CC cutover mechanism | Date gate: `isCompletenessCheck && completed_at > CC_VERDICT_TRIAGE_CUTOVER_AT` | Mirrors CRC exactly — one gate pattern in the codebase; untriaged old reviews have no rows to key a value-based gate off |
| D5 | Legacy values on the new side | Ignored — treated as no override / no disposition | CRC rework R5 precedent. Old CC version chains are test-only and known brittle; no coalesce code protecting untrusted data |
| D6 | Cross-version delta math on the new side | Reads prior versions' `verdict_override` only | Self-healing one version deep; first post-cutover version of a legacy test chain may miscount Cleared — accepted (§8.3) |
| D7 | `uncertain` as a user-pickable verdict | Revert-only: offered only on agent-uncertain rows, as the default | Matches CRC. Users adjudicate *away from* uncertain; forcing an item *to* uncertain isn't a determination |
| D8 | Disposition row visibility | Shown when the **effective** verdict (override ?? agent) is `fail` or `warn` | Dispositions answer "what do we do about this finding"; moot for pass/N/A. Formal Note is plausible on warn, so warn is included |
| D9 | Disposition retention when verdict changes | Retained inert, never deleted | CRC rework D12 philosophy: row+inert beats delete; reappears if verdict flips back to fail/warn |
| D10 | Verdict lazy-write semantics | Identical to CRC D11/D12: agent-matching pick with no row + empty note = no write; row whose override matches agent verdict = effectively no override | Proven pattern, already tested in production CRC |
| D11 | Note field | One shared `triage_note` for both axes | The note explains whichever action the user just took; two note fields is speculative complexity |
| D12 | Verdict-override inheritance | None at launch; disposition keeps existing inherit + confirm flow | Each version's override is an affirmative act against that version's evidence. Deferring is schema-free (§9) |
| D13 | Filter dropdown (new side) | Single dropdown: All / Has verdict override / No verdict override / To Fix / Formal Note | Each option is a predicate; single-pick dropdown keeps the existing UI footprint |
| D14 | Bulk triage | Disposition axis only | D12-adjacent: verdicts are per-item judgments |
| D15 | `triage_sub_status` | Unchanged — `escalate` / `will-fix` under `formal-note` | Load-bearing in the formal PDF report |

---

## 5. Data model

### 5.1 Schema change (substation migration)

```sql
ALTER TABLE public.comment_triage ADD COLUMN verdict_override TEXT;

COMMENT ON COLUMN public.comment_triage.verdict_override IS
  'User-forced verdict for this comment. CC values: pass|fail|warn|not-applicable|uncertain. '
  'CRC values: resolved|failed|uncertain. NULL = no override (agent verdict stands). '
  'Orthogonal to triage_status, which carries the disposition axis (to-fix|formal-note).';

-- CRC unification backfill (§7.2). The value-based WHERE is safe with no
-- date/review-type join: resolved/failed/uncertain are disjoint from every
-- legacy CC triage value, so this can only match post-cutover CRC rows.
UPDATE public.comment_triage
SET verdict_override = triage_status
WHERE triage_status IN ('resolved', 'failed', 'uncertain');
```

No CHECK constraint — consistent with `triage_status` (plain TEXT, values are
a frontend/endpoint concern). No index: reads are already scoped by the
existing `review_id` index.

### 5.2 Column semantics after this ships

| Column | Meaning | Written by |
|---|---|---|
| `verdict_override` | Verdict axis. CC: `pass`/`fail`/`warn`/`not-applicable`/`uncertain`†. CRC: `resolved`/`failed`/`uncertain`. NULL = agent verdict stands | New CC determination row; `CrcVerdictTriageBar` |
| `triage_status` | Disposition axis: `new`/`to-fix`/`formal-note`. Frozen legacy values (`incorrect`, `na`, old CRC verdicts pre-backfill) may exist on old reviews and are ignored by new-side code | New CC disposition row; legacy TriageBar (old reviews only) |
| `triage_sub_status` | `escalate`/`will-fix` under `formal-note` | New CC disposition row; legacy TriageBar |
| `triage_note` | Shared free-text note | Everything |

† `uncertain` is only reachable as an explicit revert on agent-uncertain rows
(D7): pick Fail, change your mind, pick Uncertain again → writes
`verdict_override = 'uncertain'` (the row already exists, so lazy-write no
longer applies — same as CRC today).

### 5.3 Effective status (the one load-bearing definition)

For every new-side consumer (banner, chips, deltas, filters, PDFs):

```
effectiveStatus(comment) = verdict_override ?? agent status (output_json.status)
isOverridden(comment)    = verdict_override != null && verdict_override !== agent status
```

A row whose `verdict_override` equals the agent status is *effectively no
override* (possible via the revert path) — identical to CRC rework §6.3.

---

## 6. Substation changes

### 6.1 Migration

§5.1. Ships first (see §11 rollout).

### 6.2 `src/routes/comment-triage.ts`

The PATCH body gains `verdict_override?: string | null`, passed through to the
upsert. `triage_status` remains required (defaulting to `'new'` from the
client when the user has only set a verdict). No value validation — consistent
with the endpoint today.

One behavioral note: because the upsert writes the full row, the client must
always send *both* axes' current values (not just the changed one), or an
axis-B write would null out axis A. The cityhall client already works this way
for status+note; the new panel keeps both axes in one optimistic state object
(§7.4).

### 6.3 `src/routes/completeness-check-pdf.ts` (react-pdf CC report)

- Select `verdict_override` alongside the existing triage columns.
- Gate on the same cutover date (the endpoint already loads
  `reviews.completed_at`; CC-typed + post-cutover → new semantics).
- New side: counts derive from `effectiveStatus`; per-comment annotations
  render from both axes (§10). Old side: existing rendering, untouched.
- `src/types/database.types.ts` regenerated.

---

## 7. CityHall changes

### 7.1 The cutover gate

In `[reviewId]/+page.svelte`, alongside the CRC gate:

```ts
// CC verdict-override cutover (see winston/workspaces/completeness-check/
// verdict-override-refactor/DESIGN-SPEC.md). CC reviews completed strictly
// after this instant render the two-axis determination/disposition panel.
// Older runs keep the legacy 5-value TriageBar and legacy counts math.
const CC_VERDICT_TRIAGE_CUTOVER_AT = '<picked at merge time>';
const usesNewCcTriage = $derived(
  isCompletenessCheck &&
    data.review.completed_at != null &&
    new Date(data.review.completed_at as string) > new Date(CC_VERDICT_TRIAGE_CUTOVER_AT)
);
```

### 7.2 New `CcTriagePanel` component (sibling, not shared)

Follows the CRC rework's sibling-component precedent (`CrcVerdictTriageBar`
was deliberately not extracted from `TriageBar`): a new component, two rows +
note, keeping `TriageBar` byte-identical for legacy renders.

**Row 1 — "Your determination"** (verdict pick, CRC-style pills):

| Agent verdict | Button set (default first) |
|---|---|
| `pass` | [Pass, Fail, Warn, N/A] |
| `fail` | [Fail, Pass, Warn, N/A] |
| `warn` | [Warn, Pass, Fail, N/A] |
| `not-applicable` | [N/A, Pass, Fail, Warn] |
| `uncertain` | [Uncertain, Pass, Fail, Warn, N/A] |

Default selection = agent verdict. Lazy DB instantiation per D10. Colors
follow the existing CC status palette (green pass, red fail, amber warn +
uncertain, gray N/A).

**Row 2 — disposition** (`To Fix` / `Formal Note`, with the
escalate/will-fix sub-row under Formal Note), rendered only when
`effectiveStatus ∈ {fail, warn}` (D8). Selecting a disposition writes
`triage_status`; an existing disposition on a row whose verdict later flips to
pass/N/A stays in the DB but doesn't render (D9).

**Note textarea** — one shared note, same 1000ms-debounce machinery as the
sibling components.

**Optimistic state** holds both axes + note in one object so every
`postTriage` call sends the full row (§6.2).

### 7.3 `CommentTriagePanel.svelte`

Gains a `ccVerdictTriage?: { agentVerdict: CcAgentVerdict } | null` prop,
mirroring `crcVerdictTriage`. When set:

- `VersionTimeline` still renders for has-history items (unchanged — it shows
  agent statuses per version).
- `CcTriagePanel` renders in place of `TriageBar`.
- The inherited-triage seed (`inheritedTriage`, restored to prominence by
  cityhall#571) applies to the **disposition axis only**: a prior version's
  `to-fix`/`formal-note` seeds row 2 with the existing confirm-to-persist
  flow. Prior `verdict_override` values do **not** seed row 1 (D12). Prior
  legacy `incorrect`/`na` values are skipped entirely (D5).

### 7.4 Wire types

- `triage/client.ts`: `TriageWriteRequest` gains
  `verdictOverride: string | null`; payload gains `verdict_override`. The
  cityhall `triage/+server.ts` proxy forwards the body verbatim — no change.
- `types-simplified.ts`: `CommentTriage` gains `verdictOverride: string | null`;
  `CommentHistoryEntry` gains `verdictOverride: string | null`.
- `load-comment-history.ts`: the triage select adds `verdict_override`;
  entries thread it through. **This is the one-line change that keeps
  deferred inheritance schema-free** — history data carries overrides from
  day one even though nothing reads them across versions yet.
  `effectiveTriage` (the disposition-inheritance map) considers only
  `to-fix`/`formal-note` on the new side.

### 7.5 Counts banner + Corrected chip

Generalize the `ccNewCrcOverrides` shape to CC's buckets. Per comment:
agent bucket from `output_json.status`; effective bucket from
`effectiveStatus`; `isOverridden` → Corrected chip + hatched
override-out segments in the stacked bar, exactly the CRC §6.5 pattern with
five buckets (pass / fail / warn / not-applicable / uncertain) instead of
three. `ccTriageAdjustments` (the legacy incorrect/na fold) remains and
applies only when `!usesNewCcTriage`.

### 7.6 Version chips: Fixed / Regressed / Cleared

New-side definitions, all in terms of `effectiveStatus` and prior versions'
`verdict_override` (D6). Uncertain endpoints stay excluded from Fixed and
Regressed per uncertain-status DESIGN-SPEC §8.4.

- **Fixed**: prior effective `fail` → current effective `pass`/`warn`/`not-applicable`.
  (Prior fails whose `verdict_override` was pass/warn/N-A weren't genuinely
  failing, so they don't count — the override replaces the legacy
  `incorrect`/`na` exclusion.)
- **Regressed**: prior effective `pass`/`warn`/`not-applicable` → current
  effective `fail`. Overriding the current fail removes it from the count, as
  today.
- **Cleared** (per-item chip): prior raw `fail` whose prior
  `verdict_override ∈ {pass, warn, not-applicable}` — the human dismissed it
  last round. Replaces the `prior.triageStatus === 'incorrect' || 'na'` check.

Legacy `incorrect`/`na` on prior versions is invisible to all three on the new
side (D5/D6).

### 7.7 Tabs, filters, pills

- **Status tabs**: unchanged (they bucket by *agent* status, and items stay in
  their agent tab when overridden — CRC §6.6 precedent, avoids items jumping
  tabs as you click).
- **Triage filter dropdown** (new side): All / Has verdict override /
  No verdict override / To Fix / Formal Note (D13). Legacy dropdown remains
  for old reviews.
- **List-row pills**: overridden items show an "overridden" treatment on
  their status pill (CRC precedent) plus the disposition pill when set.
  `triageLabel`/`triageColor` keep their legacy branches for old reviews'
  pills — display compat, not a gate.

### 7.8 `CrcVerdictTriageBar` + `ccNewCrcOverrides` (CRC unification)

- `CrcVerdictTriageBar` writes the user's pick to `verdictOverride`
  (`triage_status` sent as its current value, defaulting `'new'`); reads
  initial selection from `triage.verdictOverride`.
- `ccNewCrcOverrides` and the CRC Has/No-override filter read
  `verdictOverride` instead of `triage_status` +
  `NEW_CRC_VERDICT_VALUES`-set-membership (the set moves from "which values
  are verdicts" to plain non-null + value validation).
- The CRC date gate is untouched — it still selects which UI renders for
  pre-cutover CRC reviews.

### 7.9 `completion-check-pdf.ts` (client jsPDF export)

Gated like everything else. New side annotations per §10; legacy branches
(`incorrect`/`na`/`to-fix`/`formal-note`) kept for old reviews.

### 7.10 `BulkTriageLightbox`

New side: bulk actions offer dispositions (+ note) only (D14). Legacy
behavior unchanged for old reviews.

---

## 8. Coexistence & cutover boundary

### 8.1 Value-space map

After the backfill, every possible `comment_triage` row is unambiguous:

| Row shape | Meaning | Read by |
|---|---|---|
| `verdict_override` non-null | Verdict override (CC or CRC per review type) | New-side code |
| `triage_status ∈ {to-fix, formal-note}` | Disposition — same meaning both eras | New-side row 2 + legacy TriageBar |
| `triage_status ∈ {incorrect, na}` | Legacy CC/pre-cutover-CRC verdict-ish triage | Legacy code only; inert on the new side (D5) |
| `triage_status = 'new'`, `verdict_override` null | Note-only or untouched row | Both |

### 8.2 Stale-write tolerance (R5 analog)

Any unexpected value on the new side — a legacy value racing in around the
cutover, a direct DB edit — is treated as no-override / no-disposition.
Defensive set-membership checks at every new-side read site, mirroring CRC
rework R5.

### 8.3 Accepted gap: legacy test chains

Existing CC version chains carry `incorrect`/`na` triage from the old UI. If
one of those projects gets a post-cutover version, its first new-side render
may under-count Cleared / over-count Regressed because prior-version legacy
values are ignored (D5/D6). **Accepted**: all future CC runs target new site
plans; the legacy chains are test artifacts, already known to be brittle, and
the gap is self-healing one version deep.

### 8.4 The `unclear` status

The CRC rework's §10.3 open question. `unclear` survives only in
`load-comment-history.ts`'s status mapper for very old review-v1 data; the
2026-04+ CC schema uses `uncertain`. Resolution: `unclear` is **not**
user-selectable and gets no button; if it appears on a history entry it
renders as-is in the timeline. New-side CC reviews cannot produce it.

---

## 9. Deferred: verdict-override inheritance

Not built now (D12), and deferring costs nothing structurally: inheritance in
this system is a read-time computation over per-version rows (nothing about
"inherited" is ever stored — "Confirm vN override" writes a fresh row for the
current version). Because §7.4 threads `verdict_override` through the history
loader from day one, adding inheritance later is a frontend-only diff:

- **Soft display-inheritance** (recommended later shape): extend the
  `inheritedTriage` derived to surface a prior version's override with a
  confirm affordance. Cityhall-only.
- **Materialized copy-forward** (workflow writes rows on new-version
  completion): a substation/conductor change, still no migration.

No backfill trap either way: manual per-version confirms produce exactly the
rows inheritance-plus-confirm would have.

---

## 10. PDF annotation language (new side)

Per comment, up to two annotation lines:

- **Verdict override** (when `isOverridden`):
  *"The Noetic agent marked this {Agent}; a human reviewer determined the
  correct status is {Override}."* + note if present.
- **Disposition** (when effective fail/warn and disposition set):
  `to-fix` → *"Acknowledged by User to Fix."*; `formal-note` →
  *"Formal Note ({Need to Escalate|Will Fix Later}): {note}"* — unchanged
  legacy wording.

Counts in both PDF renderers derive from `effectiveStatus`.

---

## 11. Rollout & sequencing

1. **Substation PR deploys first**: migration (column + backfill) + endpoint +
   PDF changes. The new column is invisible to the current cityhall build —
   zero-risk window.
2. **Cityhall PR deploys second**, with `CC_VERDICT_TRIAGE_CUTOVER_AT` set at
   merge time (a moment safely after the substation deploy, before any CC run
   whose review should get the new UI).
3. **Post-deploy**: re-run the one-line backfill UPDATE once. This closes the
   window where an in-flight CRC verdict pick landed in `triage_status`
   between migration and cityhall deploy (at current CRC usage — 18 total
   verdict rows — this is minutes of exposure; the re-run is idempotent).

Reverse-order deploy fails safely: cityhall writing `verdict_override` before
the column exists would 500 on triage writes — hence the ordering, mirrored
from CRC rework R1.

---

## 12. Risk register

### R1 — Cross-repo deploy ordering
As §11. Substation strictly first; idempotent backfill re-run mops up the race.

### R2 — Axis clobbering on upsert
The endpoint upserts the full row, so a client sending only one axis would
null the other. Mitigation: single optimistic state object in `CcTriagePanel`
sends both axes on every write (§6.2, §7.2); component test pins it.

### R3 — Disposition invisibly retained after verdict flip
A user sets To Fix, then overrides the verdict to Pass; the disposition
persists inert (D9) and reappears if the verdict returns to Fail. Low risk —
matches CRC's effectively-no-override philosophy — but the spec makes it
explicit so it isn't reported as a bug.

### R4 — Legacy chains rendered on the new side
§8.3. Accepted, documented, self-healing.

### R5 — Stale/racy legacy values on the new side
§8.2. Set-membership tolerance at every read site.

### R6 — Hardcoded cutover date(s)
Two constants now (CRC + CC). Same accepted tradeoff as CRC rework R6; both
are candidates for a future workflow-metadata flag if a third workflow ever
needs a triage rework.

### R7 — CRC behavior regression from the column move
`CrcVerdictTriageBar`'s write path and `ccNewCrcOverrides`' read path both
change. Mitigation: the existing CRC component tests move with the column;
add a read-compat assertion that backfilled rows (non-null `verdict_override`,
stale verdict in `triage_status`) render identically to fresh rows.

---

## 13. Implementation checklist

**Substation PR**
- [ ] Migration: `verdict_override` column + CRC backfill (§5.1)
- [ ] `comment-triage.ts`: accept + upsert `verdict_override` (§6.2)
- [ ] `completeness-check-pdf.ts`: gate + effective-status counts + two-axis annotations (§6.3)
- [ ] Regenerate `database.types.ts`

**Cityhall PR**
- [ ] `CC_VERDICT_TRIAGE_CUTOVER_AT` gate (§7.1)
- [ ] `CcTriagePanel.svelte` — verdict row + disposition row + note (§7.2)
- [ ] `CommentTriagePanel.svelte`: `ccVerdictTriage` branch; disposition-only inheritance (§7.3)
- [ ] `triage/client.ts`, `types-simplified.ts`, `load-comment-history.ts` (§7.4)
- [ ] Banner/Corrected generalization; legacy `ccTriageAdjustments` gated legacy-only (§7.5)
- [ ] Fixed/Regressed/Cleared new-side definitions (§7.6)
- [ ] Filter dropdown + pills (§7.7)
- [ ] `CrcVerdictTriageBar` + `ccNewCrcOverrides` → `verdict_override` (§7.8)
- [ ] `completion-check-pdf.ts` gating (§7.9)
- [ ] `BulkTriageLightbox` disposition-only on new side (§7.10)
- [ ] Component tests: browser-mode tests following `CommentTriagePanel.svelte.test.ts`
      (cityhall#571's pattern) — lazy-write, axis-clobber guard (R2), disposition
      visibility on effective-status change, uncertain revert-only
- [ ] Post-deploy: re-run backfill UPDATE (§11.3)

**What does NOT change**
- `TriageBar.svelte` (byte-identical; legacy renders only)
- CC workflow YAML / emit schemas / bureau (no agent-side change)
- Pre-cutover CC + pre-cutover CRC rendering, counts, PDFs
- `[sectionId]` simplified-review triage page
- CRC date gate + `coerceCrcStatusForDisplay` N/A coercion

---

## 14. References

- [CRC comment-triage-rework DESIGN-SPEC](../../comment-resolution-check/crc-workflow/comment-triage-rework/DESIGN-SPEC.md) — the pattern this follows; §10 anticipated this spec
- [CC uncertain-status DESIGN-SPEC](../uncertain-status/DESIGN-SPEC.md) — `uncertain` semantics, §8.4 delta-exclusion rule
- [cityhall#571](https://github.com/noetic-inc/cityhall/pull/571) — always-visible triage bar; the inheritance/confirm flow this builds on
- Production data point (2026-07-07): 18 of 2,493 `comment_triage` rows hold post-cutover CRC verdict values — the entire CRC backfill surface
