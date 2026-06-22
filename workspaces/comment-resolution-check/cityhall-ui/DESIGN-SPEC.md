# Cityhall CRC UI — Design Spec

> **Status:** Draft, 2026-06-22 (revised same day after spec review — see §2
> "Spec-review clarifications" C1–C8). Iteration-1 of the
> [CRC spec](../SPEC.md) §11 "Iteration 3 (DB + UI)", pulled forward. Drives
> implementation of the applicant-facing view for CRC review runs: a left-nav
> entry plus a single review page that mirrors the existing Completeness
> Check UI, with the CRC-specific 3-status enum and atomic-item /
> parent-comment hierarchy.

---

## 1. Overview

**Purpose.** Surface the output of a completed [`comment-resolution-check`
Conductor workflow](../crc-workflow/DESIGN-SPEC.md) inside cityhall so an
applicant can:

1. See, at a glance, how many of the city's MCR comments their U1 plans
   resolved (vs. still failed, vs. became moot).
2. Walk the per-comment verdicts with evidence and sheet references.
3. Annotate / triage each verdict (mark as "to fix", "incorrect agent call",
   etc.) in service of writing their BLUE response to the city.

**Position in the CRC pipeline.**
```
generate-crc-guides skill       comment-resolution-check workflow     THIS DOC                 generate-crc-report skill
[ Claude Code, HITL ]      →    [ Conductor YAML, writes DB rows ]  → [ cityhall view ]   ⇢     [ local PDF render ]
MCR PDF → crc-*.md guides       crc-*.md + U1 plans → reviews +        DB rows → UI            DB rows → city-ready PDF
                                review_comments                                                  (local-only MVP)
```

The UI is **view + triage only** for MVP — no trigger, no upload, no PDF
download wiring beyond a disabled button placeholder.

**Mental model.** A clone of the Completeness Check review page (same accordion
shape, same triage interaction) re-skinned for CRC's 3-status enum
(`resolved` / `failed` / `not-applicable`) and grouped by city department.
Routing reuses the existing `/project/[projectId]/review/[reviewId]` tree;
runtime branching on `reviews.review_type === 'crc'` drives the CRC-specific
rendering. No new routes, no new API endpoints, no schema changes.

**Out of scope for this iteration** (live elsewhere or in later iterations):
- Triggering a new CRC run from the UI — runs are kicked off via the
  `local-run` / `inngest-run` CLI per SPEC §11 iter-1.
- Uploading the source MCR PDF from the browser.
- Inline display of the source MCR PDF — applicant cross-references via
  their existing copy.
- Surfacing the MCR figure thumbnails the agent used (`crc-vision-check`'s
  reference images).
- Showing the original verbatim MCR comment body alongside each atomic item —
  applicant cross-references via their MCR PDF (Q10).
- Parent-comment roll-up status badges (e.g., "2/3 resolved") — atomic-only
  for MVP (Q9).
- Manually flipping `review_comments.output_json.status` (the agent's
  verdict) — disagreement is expressed via `comment_triage` (Q14).
- BLUE response capture inside cityhall — applicant authors that in their
  resubmittal package (Q13).
- Real-time updates for an in-progress CRC run — MVP shows completed runs
  only (the workflow is run synchronously via CLI today; revisit if/when
  Substation trigger lands).
- Live download of the CRC PDF report — button is rendered disabled because
  the PDF is local-only until iter-3 ships Supabase storage upload (Q18).
- Section drill-down sub-routes (`[reviewId]/[sectionId]`) — single-page
  accordion only (Q8).

---

## 2. Decisions captured

Twenty-one design questions were resolved in the 2026-06-22 session, plus
eight clarifications during the same-day spec-review pass. Compact ledger:

| #  | Decision |
|----|----------|
| Q1 | Editable triage — full parity with Completeness, reusing the existing `TriageBar` / `CommentTriagePanel` / `/project/[projectId]/review/triage` PATCH endpoint. No new triage infrastructure. |
| Q2 | View-only — no in-UI trigger. Runs are kicked off via CLI / Substation. |
| Q3 | No source MCR PDF surfacing in MVP. |
| Q4 | Left nav only — no `/project/[projectId]` page card. |
| Q5 | Nav label is `"MCR {U-version} resolution"` (e.g., `"U0 MCR resolution"`). |
| Q6 | Show nav entry only when a `reviews` row with `review_type='crc'` exists for the active submission version — mirrors Completeness's visibility rule. |
| Q7 | Reuse the existing `/project/[projectId]/review/[reviewId]` route; runtime branching on `reviews.review_type`. |
| Q8 | Single-page accordion — no `[sectionId]` sub-routes. Filter tabs by status + items grouped by section, matching the Completeness layout. |
| Q9 | Flatten to atomic items. When a parent MCR comment produces ≥2 atomic items, each row prints `Parent: TPW 3` (or equivalent) as a label so the applicant can mentally group. |
| Q10 | No parent-comment roll-up status badge. |
| Q11 | No verbatim original MCR comment body inline. Applicant uses their MCR PDF. |
| Q12 | Reuse Completeness's triage status set: `new` / `to-fix` / `formal-note` / `na` / `incorrect`. |
| Q13 | No initial `comment_triage` row writes. Rows are created lazily by the UI when the user touches a comment — DESIGN-SPEC §6.4 wins over SPEC §8.4. |
| Q14 | No BLUE response capture in cityhall MVP. |
| Q15 | No agent-verdict override. `review_comments.output_json.status` is read-only in the UI; disagreement is expressed via `comment_triage.triage_status` (e.g. `incorrect`, which moves the item to the "Corrected" count in the top banner without changing the underlying verdict). |
| Q16 | Status colors: `resolved` = green, `failed` = red, `not-applicable` = gray. Mirrors Completeness's pass/fail/n-a palette. |
| Q17 | U-version label hardcoded as `"U0"` for MVP. TODO follow-up to derive it properly when a U1 cycle lands. |
| Q18 | No MCR figure thumbnails inline on cards. |
| Q19 | "X fixed" / "Y corrected" badges — same component + same semantics as Completeness. |
| Q20 | "Download Report" button — rendered disabled with tooltip ("PDF generation moves to cloud in iter-3"). |
| Q21 | "Inspect Review" button — mirror Completeness; point at the CRC review. |

**Spec-review clarifications (2026-06-22 PM):**

| #   | Decision |
|-----|----------|
| C1  | Comment-row implementation: clone the **inline collapsed/expanded row pattern** from `[reviewId]/+page.svelte`'s flat list (the Completeness flat list does NOT use `CompletenessCommentCard`). No new `CRCCommentCard.svelte` file. (Supersedes the §8 file plan.) |
| C2  | `output_schema` value: **`'2026-06-crc'`** for both `reviews` and `review_comments`. Matches cityhall's date-based convention; closes §10.3. |
| C3  | Workflow does NOT write to `review_sections`. Sections live in `reviews.output_json.sections`. The crc-workflow DESIGN-SPEC §6 has been revised to match. Implementing that revision is a **precondition** for landing this UI. |
| C4  | `isCompletenessCheck` (and its CRC sibling) live in the **render layer** (`+page.svelte:40`), not in `+page.ts`'s parallel-fetch block. The fetch layer is review-type-agnostic. |
| C5  | `ReviewNav.svelte` is used only by the formal-review page. Completeness doesn't use it; CRC doesn't either. (Bullet removed from §8.) |
| C6  | Eagerly load full `review_comments` rows for CRC reviews — mirrors Completeness's existing pattern for the simplified schema. Do NOT extend `review_comment_index_rpc`. Closes §10.5. |
| C7  | Smoke-test target is **1700 South Lamar U0** (7800 was a typo; not a real project). §9 and SPEC.md §10.1 updated. |
| C8  | Page-header title is **"U0 MCR Resolution"** (and nav label **"U0 MCR resolution"**), not "MCR U0 Resolution". The `"U0"` token refers to the **MCR cycle**, not the plan version under review. |

---

## 3. Routing & navigation

### 3.1 Routes (no additions)

CRC reuses the existing review route tree exactly. Effective URL:

```
/project/{projectId}/review/{crcReviewId}?v={u1SubmissionVersionId}
```

- `{crcReviewId}` is `reviews.id` for the row with `review_type = 'crc'`.
- `?v=` is honoured by the existing layout loader logic
  (`+layout.ts:232-248`) and used to scope the nav-visibility check (§3.3).
- No new file paths under `src/routes/`. The runtime `isCRC` branch (§5)
  hangs off the existing files alongside the current `isCompletenessCheck`
  branch.

### 3.2 Left nav entry

Add a third review-section entry alongside Completeness and the formal-review
jurisdiction link. Pattern mirrors `completenessCheckItem`
(`+layout.ts:263-271`):

```ts
// Query, sibling to the existing completeness_check query at line 121.
supabase
  .from('reviews')
  .select('id, submission_version_id, output_json')
  .eq('project_id', params.projectId)
  .eq('is_current', true)
  .eq('review_type', 'crc'),
```

```ts
// NavItem build, sibling to completenessCheckItem at line 263.
const crcReview =
  (crcReviewsQuery.data ?? []).find(
    (r) => r.submission_version_id === activeSubmissionVersion?.id
  ) ??
  crcReviewsQuery.data?.[0] ??
  null;

const crcItem: NavItem | null = crcReview
  ? {
      icon: 'i-mingcute:file-check-line',   // TODO confirm with design — placeholder
      label: `U0 MCR resolution`,           // TODO §10 — derive U-version dynamically
      href: `${rootURL}/review/${crcReview.id}${vSuffix}`,
      selected: (page) =>
        page.url.pathname.startsWith(`${rootURL}/review/${crcReview.id}`),
    }
  : null;
```

Then append to `reviewItems` (`+layout.ts:306-307`):

```ts
if (completenessCheckItem) reviewItems.push(completenessCheckItem);
if (crcItem) reviewItems.push(crcItem);          // ← new
if (reviewOverviewItem) reviewItems.push(reviewOverviewItem);
```

### 3.3 Visibility rule

The entry appears **only** when a `reviews` row with
`review_type = 'crc'` exists for the active `submission_version_id` (or as a
fallback, any CRC review on the project). This matches Completeness's pattern
exactly (`+layout.ts:255-262`). No "always show, grey out" treatment for MVP.

### 3.4 `selected` highlight

The new nav item highlights when the URL starts with `/project/{projectId}/review/{crcReviewId}` — same shape as Completeness. The formal-review nav item's existing `selected` logic
(`+layout.ts:291-300`) already excludes the Completeness review id; we need to
extend that exclusion to also exclude the CRC review id so the formal-review
link doesn't false-highlight when the user is on a CRC page.

**Required edit at `+layout.ts:291-300`:**

```ts
selected: (page) => {
  const path = page.url.pathname;
  if (completenessCheckId && path.startsWith(`${rootURL}/review/${completenessCheckId}`)) {
    return false;
  }
  if (crcReviewId && path.startsWith(`${rootURL}/review/${crcReviewId}`)) {   // ← new
    return false;
  }
  return path === `${rootURL}/review` || path.startsWith(`${rootURL}/review/`);
},
```

Where `crcReviewId = crcReview?.id` resolved alongside `completenessCheckId`.

---

## 4. Page composition

The CRC review page mirrors the Completeness review page (same overall
layout — see Completeness screenshots from the 2026-06-22 session). Top to
bottom:

### 4.1 Page header

| Slot | Completeness today | CRC |
|---|---|---|
| Title | `"Completeness Check"` | `"U0 MCR Resolution"` *(label hardcoded — §10 TODO)* |
| Status badge | `Complete` / `In Progress` | Same component, same rules |
| Subtitle | Project name (e.g., `"Lamar + Collier"`) | Project name (unchanged) |
| Top-right buttons | `Download Report`, `Inspect Review` | `Download Report` (disabled, tooltipped — Q20), `Inspect Review` (mirror — Q21) |

### 4.2 "Overall Results" card

Mirror the Completeness counts row + horizontal progress bar
(`[reviewId]/+page.svelte` Overall Results block) with the CRC enum:

- `Resolved` (green dot, count)
- `Failed` (red dot, count)
- `N/A` (gray dot, count, for `not-applicable`)

Progress bar segments: resolved (green) / failed (red — diagonal hatch) /
not-applicable (gray) / unstarted (light gray fill).

Beneath the bar: the existing `"X fixed"` / `"Y corrected"` chips (Q19) —
same component, same semantics:
- **`fixed`** = items where `comment_triage.triage_status = 'to-fix'` (or
  whatever the existing Completeness "fixed" derivation reads).
- **`corrected`** = items where the agent verdict was `failed` but the user
  marked it `incorrect` via triage. These don't count against the
  applicant in the headline summary (Q14).

> All "fixed" / "corrected" derivation logic is already in cityhall — the
> CRC branch reuses it verbatim. The agent's research log
> ([Topic 4-5](§13.2)) confirms `corrected` is computed off `triage_status`,
> not off the comment's underlying verdict.

### 4.3 Items section

Mirrors the Completeness "Items" block from the screenshots:

```
Items   [ Failed | Resolved | N/A ]   {count of active filter}                 Notes  [ All ▾ ]
─────────────────────────────────────────────────────────────────────────────────────────────────

TPW (Transportation & Public Works)
  ● TPW-3.1  Verify ROW dedication along S. Lamar meets ASMP        [Failed]  💬
              Plan shows existing ROW only; no dedication line on Sheet C-1.01.
  ● TPW-3.2  Verify hydrant offset ≥15 ft, both sides              [Failed]  💬   Parent: TPW 3
              Striping on Sheet C-3.10 shows 8 ft offset on east side.

DE (Drainage Engineering)
  ● DE-1.1   Verify post-developed peak discharge ≤ pre-developed  [Resolved] 💬
              Drainage report Section 4.2 shows 0.87 cfs vs. 1.04 cfs pre.
  …
```

**Filter tabs** (left of header): `Failed`, `Resolved`, `N/A`, with the
count of items in the active filter. Default tab is `Failed` (matches
Completeness convention — applicants want to fix things first).

**Notes filter** (right of header): existing dropdown, reused unchanged.
Filters by `comment_triage.triage_status` value, same semantics as
Completeness.

**Grouping**: by section (city department). Section header is the full
department label (`"TPW (Transportation & Public Works)"` etc.) sourced from
`reviews.output_json.sections[i].label` — see §6 for the contract the CRC
workflow must honour.

**Row content** per atomic item (Q9):
- Status dot (red/green/gray) + atomic ID (`TPW-3.1`) + comma + the
  `rephrasedTitle` from the workflow's `rephrase-titles` step (a short noun
  phrase — see crc-workflow DESIGN-SPEC §4.4).
- Second line, dimmer: the agent's `explanation` (6-30 word summary).
- Right side: status pill (Resolved / Failed / N/A) + note speech-bubble
  icon (visible badge when a triage note is set).
- **Parent-comment label** (Q9): a small right-aligned chip reading `Parent:
  TPW 3` shown **only when** the parent MCR comment produced ≥2 atomic items.
  Computed client-side by counting atomic items sharing the same
  `output_json.parentCommentId` (or whatever field the workflow emits — see
  §6.2). For 1:1 cases the chip is omitted.

**Row click**: opens the existing comment-detail panel
(`CommentTriagePanel.svelte`), which shows the full `observation` /
`reasoning` / `evidenceLocations`, plus the triage bar. No changes to that
component needed — it already operates on a `review_comment` row.

**Row implementation note.** The Completeness review page's flat list does NOT
use `CompletenessCommentCard.svelte` — that component is only used in the
`[sectionId]` sub-routes (which CRC explicitly skips per Q8). The flat list
in `[reviewId]/+page.svelte` uses an inline collapsed/expanded row pattern.
CRC mirrors that pattern: **clone the inline row markup from the Completeness
flat list** and re-skin it with the CRC status enum, atomic ID, and
parent-comment chip. **No new `CRCCommentCard.svelte` file.** See §8 for the
revised file plan.

---

## 5. Data model & queries

No schema changes. All required fields exist on `reviews`, `review_comments`,
and `comment_triage`.

### 5.1 Reviews row contract (CRC)

| Field | Value |
|---|---|
| `id` | uuid |
| `review_type` | `'crc'` |
| `submission_version_id` | the U1 target version |
| `output_schema` | `'2026-06-crc'` (matches cityhall's date-based schema convention — same family as `'2026-04-simplified'`) |
| `output_json` | `{ metadata, sections }` — see §6 |
| `is_current` | `true` |
| `organization_id` / `project_id` | scoped via RLS — no UI changes |

### 5.2 `review_comments` row contract (CRC)

Per atomic item:

| Field | Value |
|---|---|
| `id` | uuid |
| `review_id` | FK to the CRC `reviews` row |
| `output_schema` | `'2026-06-crc'` *(matches reviews row)* |
| `comment_number` | sequential 1..N, deterministic across run (per crc-workflow DESIGN-SPEC §6.3) |
| `output_json` | see §6.2 below |

### 5.3 Loader changes

**`[reviewId]/+page.ts`** — no structural change needed. The parallel queries
at lines 110-148 are not gated on `review_type` (verified 2026-06-22); they
fetch the review row plus triage, plan-set, and resolution-plan data
generically by `reviewId`. CRC inherits this unchanged.

A few render-time branches in `+page.ts` (around line 606+, in the
legacy-vs-simplified-schema fork) DO check `review_type === 'completeness_check'`
literal. During implementation, walk those and add an `|| 'crc'` arm
wherever the CRC layout matches Completeness.

**`+page.svelte`** is where the bulk of the type-branching lives. Add an
`isCRC` rune sibling to the existing `isCompletenessCheck` derivation
(`+page.svelte:40`):

```ts
const isCRC = $derived(data.review.review_type === 'crc');
```

Then wherever `isCompletenessCheck` gates rendering (or summary computation),
add an `isCRC` branch. Most cases collapse to `isCompletenessCheck || isCRC`
because the layouts are intentionally identical.

**`load-comment-history.ts`** — verified 2026-06-22: branches on `outputSchema`
(not `review_type`). With CRC emitting `output_schema = '2026-06-crc'`, the
helper either (a) needs a new branch alongside `'2026-04-simplified'`, or (b)
the CRC schema's history shape matches simplified closely enough to reuse that
arm. Walk it during implementation.

### 5.4 Realtime

MVP: **no realtime subscriptions** for CRC. Completed runs only.

If a future iteration wires CRC to in-progress display (when Substation
trigger lands), follow Completeness's pattern (subscribe to the `reviews`
table filtered by `project_id`, call `invalidate('app:reviews')`).

### 5.5 Triage writes

Reuse the existing `PATCH /project/[projectId]/review/triage` endpoint
unchanged. The payload (see Topic 10 in the research log) is generic on
`review_comment_id` + `review_id` — works for CRC out of the box. The
endpoint forwards to Substation `/projects/{projectId}/comment-triage`.

**Initial row writes (Q12):** none. `comment_triage` rows are created lazily
when the user first interacts with a comment, same as Completeness. The
verdict displayed in the UI is read from
`review_comments.output_json.status` until the user adds a triage state.

---

## 6. Workflow / data contract (CRC ↔ UI)

The cityhall page is a passive renderer; its correctness depends on the CRC
Conductor workflow writing the shapes below. This section defines what the
workflow's `review-saver` step must produce. The crc-workflow DESIGN-SPEC
should be updated to match, if it doesn't already.

### 6.1 `reviews.output_json` (CRC)

```jsonc
{
  "metadata": {
    "cycleLabel": "U0",            // free text label for the MCR cycle this run resolves against — UI uses for header / nav label
    "guidesProvenance": {           // from crc-guides-manifest.json (crc-workflow DESIGN-SPEC §4.1)
      "projectUuid": "…",
      "submissionUuid": "…",
      "u0VersionNumber": 4,
      "crcGenerationNumber": 0
    },
    "model": "claude-sonnet-4-5-20250929",
    "runDate": "2026-06-20T17:42:00Z"
  },
  "sections": [
    {
      "slug": "crc-tpw",
      "label": "TPW (Transportation & Public Works)",
      "summary": "12 atomic items across 8 parent MCR comments."
    },
    {
      "slug": "crc-de",
      "label": "DE (Drainage Engineering)",
      "summary": "…"
    }
    // …one per city department represented in the MCR
  ]
}
```

### 6.2 `review_comments.output_json` (CRC, per atomic item)

```jsonc
{
  "section": "crc-tpw",                  // matches reviews.output_json.sections[i].slug
  "atomicItemId": "TPW-3.1",             // dept-{parentCommentNum}.{subIndex}
  "parentCommentId": "TPW 3",            // city's original comment id — printed as "Parent: …" chip when ≥2 atomic items share this value
  "headline": "Hydrant offset for on-street parking",   // short noun phrase from rephrase-titles step
  "requirement": "On-street parking ≥15 ft from either side of fire hydrants",   // the canonical spec the agent verified
  "codeCitation": "TCM 9.2.3.1.B",
  "severity": "required",                // required | recommendation
  "status": "resolved" | "failed" | "not-applicable",
  "explanation": "6-30 word agent summary",
  "observation": "what I saw on which sheets",
  "reasoning": "how that drives the verdict",
  "resolution": "corrective action if failed, else null",
  "evidenceLocations": [
    { "documentId": "…", "sheetNumber": 12, "label": "Striping Plan C-3.10" }
  ],
  "tools_used": ["crc-vision-check"]
}
```

### 6.3 Section vs `review_sections`

**Do not write to `review_sections`.** Per
`cityhall/docs/review-output-schemas.md:53-67`, that table is deprecated;
cityhall reads sections from `reviews.output_json.sections`. The CRC
workflow's review-saver must emit only the JSON shape above, matching how
the `'2026-04-simplified'` schema works.

This is a **precondition** for this UI: the crc-workflow DESIGN-SPEC §6.3
previously specified `review_sections` writes — it has been revised in
this same change to drop those writes and emit `output_schema = '2026-06-crc'`
+ `output_json.sections` instead. See crc-workflow DESIGN-SPEC §6 for the
authoritative shape.

---

## 7. Visual identity

### 7.1 Status colors (Q15)

Mirror Completeness's pass/fail/n-a palette exactly so the user's visual
muscle memory carries over. Mapping reused from
`CompletenessCommentCard.svelte:66-81`:

| CRC status | UnoCSS / Tailwind classes | Label |
|---|---|---|
| `resolved` | `text-green-700 bg-green-50 border-green-200`, green dot | `Resolved` |
| `failed` | `text-red-700 bg-red-50 border-red-200`, red dot | `Failed` |
| `not-applicable` | `text-gray-500 bg-gray-50 border-gray-200`, gray dot | `N/A` |

A new CRC-specific helper (or extension of the Completeness one) maps the
status string → the existing class set. Trivial code.

### 7.2 Triage status colors (Q11)

Unchanged from Completeness. The same `TriageBar` component renders the same
5 statuses with the same colors (research log Topic 5).

### 7.3 Page header label (Q5, Q17)

Title in the page header: `"U0 MCR Resolution"`. Hardcoded for MVP. See §10
for the follow-up to derive `"U0"` dynamically.

### 7.4 Nav icon

Placeholder: `i-mingcute:file-check-line` (visually distinct from
Completeness's `i-mingcute-check-circle-line` and formal review's
`i-mingcute:diary-line`). Confirm with design before merge.

---

## 8. Implementation plan / file-by-file

All paths relative to `/Users/wnavey/noetic/cityhall/`. New files in **bold**,
edits in regular weight.

```
src/routes/(app)/project/[projectId]/
  +layout.ts
    • Add CRC reviews query (sibling to completeness_check query, line 121).
    • Build crcItem NavItem (sibling to completenessCheckItem, line 263).
    • Insert into reviewItems array (line 306).
    • Extend reviewOverviewItem's selected fn to also exclude CRC review id (line 291).

  review/[reviewId]/
    +page.ts
      • No structural change. The parallel data fetches at lines 110-148 are
        already review-type-agnostic and work unchanged for CRC. Review-type
        branching happens in the render layer (+page.svelte), not here.
      • Note: any `review_type === 'completeness_check'` literal in the render
        branches around line 606+ may need an `|| 'crc'` arm; walk those
        during implementation.

    +page.svelte
      • Add `isCRC = $derived(data.review.review_type === 'crc')` sibling to
        the existing `isCompletenessCheck` rune at line 40.
      • In each branch currently gated on isCompletenessCheck, broaden to
        `isCompletenessCheck || isCRC` where layout is identical, OR fork to
        isCRC-specific block where labels / status enums differ.
      • Page title: when isCRC, render "U0 MCR Resolution".
      • Items filter tabs: when isCRC, render [Failed | Resolved | N/A] instead
        of [Fail | Warn | Pass | N/A].
      • Comment list: when isCRC, render the existing inline row pattern with
        the CRC status map (see §4.3 "Row implementation note"). No new card
        component — this is the same inline row Completeness uses in its flat
        list. Skin changes only:
         – status map: resolved/failed/not-applicable (reuse Completeness colors).
         – atomic id (TPW-3.1) shown in row label instead of plain comment_number.
         – Parent chip: render when ≥2 sibling atomic items share parentCommentId
           (compute locally from the section's review_comments).
      • Top-right buttons: Download Report disabled with tooltip; Inspect Review
        passes through.
      • Comments are loaded eagerly with full `output_json` (per §10.5) — do not
        switch to the `review_comment_index_rpc` lazy path; Completeness's
        eager-load pattern is what CRC inherits.
```

**No changes required to:**
- `TriageBar.svelte`, `CommentTriagePanel.svelte` — already generic.
- `triage/+server.ts` — PATCH endpoint is generic.
- `SheetLightbox.svelte` — evidenceLocations shape matches Completeness's
  `sheetReferences` shape.
- `CompletenessCommentCard.svelte` — only used by the formal-review
  `[sectionId]` sub-routes, which CRC doesn't use. Untouched.
- `ReviewNav.svelte` — only used by the formal-review page. Completeness
  doesn't use it; CRC doesn't either.
- Any Supabase migration. No DB schema changes.

**Substation changes:** none for MVP.

---

## 9. Smoke test plan

Mirrors crc-workflow DESIGN-SPEC §9 from the UI side. Target: the 1700 South
Lamar U0 self-test run (U0 guides against U0 plans, expected to produce
all-failed verdicts) — workflow run
`0e674308-f315-4b09-9b11-a1db3d193459`, review
`7e79e197-8922-4c18-8a94-bc6d43218362`.

1. **Pre-req:** the CRC workflow has written a `reviews` row with
   `review_type='crc'` and the `output_json.sections` shape from §6.
2. **Left nav:** load `/project/{projectId}` for the 1700 South Lamar project.
   The "U0 MCR resolution" nav item should appear under Review, between
   Completeness and the formal review link, only when the active submission
   version matches the CRC review's `submission_version_id`.
3. **Review page:** clicking the nav lands on
   `/project/{projectId}/review/{crcReviewId}?v={u1VersionId}`. Verify:
   - Header reads "U0 MCR Resolution".
   - Overall Results shows resolved/failed/n-a counts that match the row
     totals in the DB.
   - Items section defaults to the Failed tab.
   - Sections are labelled with the full department names from
     `output_json.sections[i].label`.
   - Atomic items render with `TPW-3.1`-style IDs.
   - For city comments that decomposed into multiple atomic items, the
     `Parent: TPW 3` chip renders; for 1:1 comments, it does not.
4. **Triage interaction:**
   - Click an item → CommentTriagePanel opens.
   - Click a triage status (e.g., `incorrect`).
   - Verify `comment_triage` row is created (PATCH succeeds, returns id).
   - Reload — triage state persists.
   - Top banner "X corrected" count increments.
5. **Edge cases:**
   - Submission version selector dropdown shows all versions for the
     submission; switching versions where no CRC review exists should hide
     the nav entry.
   - "Download Report" button renders disabled with tooltip — no error if
     clicked.
   - "Inspect Review" button works (same admin destination).

---

## 10. Open items / TODOs

Flagged for explicit follow-up beads, in priority order.

### 10.1 U-version label sourcing (Q5 / Q17)

Hardcoded `"U0"` for MVP. The `"U0"` token refers to the **MCR cycle whose
comments are being resolved** — not the plan version under review (in the
U0→U1 case CRC reviews U1 plans against U0 comments). Both label strings
have two failure modes once a U1→U2 cycle lands:
- The nav label `"U0 MCR resolution"` becomes wrong for a U1→U2 run.
- The page-header title `"U0 MCR Resolution"` becomes wrong for the same.

**Proposed v2 fix:** `generate-crc-guides` skill writes `mcrCycleLabel` into
the crc-guides manifest (the user provides it at run time — e.g. `"U0"`,
`"U1"`). The CRC workflow propagates it to
`reviews.output_json.metadata.mcrCycleLabel` (§6.1). The UI reads it from
there for both the nav and the header. Falls back to `"U0"` if absent
(backward compat for runs created before this lands).

> **Naming.** Field is `mcrCycleLabel`, not the more ambiguous `cycleLabel`,
> to make explicit it refers to the MCR cycle and not the plan/submission
> version. §6.1 currently uses `cycleLabel` — update to `mcrCycleLabel` when
> this lands.

### 10.2 Drop `review_sections` writes from CRC workflow — RESOLVED

Settled 2026-06-22: the crc-workflow DESIGN-SPEC §6 has been revised in this
same change to (a) drop `review_sections` writes entirely and (b) emit
`output_schema = '2026-06-crc'` with sections inside
`reviews.output_json.sections`. Implementation of the revised workflow spec
is a **precondition** for landing this UI; a beads issue should be opened
against the bureau/crc-workflow side to track the code change.

### 10.3 `output_schema` value — RESOLVED

Settled 2026-06-22: **`'2026-06-crc'`** for both `reviews.output_schema` and
`review_comments.output_schema`. Matches cityhall's existing date-based
naming convention (`'2026-04-simplified'` is the precedent at
`cityhall/src/lib/.../load-comment-history.ts:40` and
`cityhall/docs/review-output-schemas.md`). The CRC workflow's review-saver
must emit this exact string — see crc-workflow DESIGN-SPEC §6.

### 10.4 Nav icon

`i-mingcute:file-check-line` is a guess. Confirm with the design team /
existing icon library before merge. Not load-bearing — easy swap.

### 10.5 Parent-comment grouping calculation — RESOLVED

The `Parent: TPW 3` chip is computed client-side by grouping the section's
loaded `review_comments` on `parentCommentId` and emitting the chip when the
group size ≥ 2.

Settled 2026-06-22: **eagerly load full `review_comments` rows for CRC
reviews** — same pattern Completeness already uses for the simplified schema
(verified at `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.ts`
where comment rows are fetched directly, not via `review_comment_index_rpc`).
Do NOT extend the index RPC. The expected CRC item count (~200 atomic items
for a 190-comment MCR) is well within the eager-load envelope Completeness
already runs against.

### 10.6 In-progress display

MVP assumes completed CRC runs. If a Substation trigger lands in iter-3,
mirror Completeness's realtime subscription (research log Topic 13) so the
review page reactively updates as the workflow writes rows.

### 10.7 "Download Report" wiring (Q18)

Disabled placeholder for MVP. Iter-2 / iter-3 work: surface a real signed-URL
download once `generate-crc-report` writes the PDF to Supabase storage
(SPEC §3.4 + §11 iter-3).

### 10.8 BLUE response capture (Q13)

Out of scope for MVP. Revisit after the applicant uses the read-only +
triage view for a real cycle — we'll learn whether they want to draft BLUE
text in cityhall or stick with their resubmittal package.

### 10.9 MCR PDF + figure surfacing (Q3, Q18)

Out of scope for MVP. Revisit when the v2 redline-extraction work (SPEC §7)
generates structured MCR figure data that's worth surfacing.

---

## 11. Iteration roadmap

- **Iteration 1 (this spec / MVP):** read-only view + triage parity with
  Completeness. Single-page accordion. No trigger, no upload, no PDF
  download.
- **Iteration 2:**
  - Derive U-version label from `output_json.metadata.cycleLabel` (§10.1).
  - Real PDF download (signed URL from Supabase storage) once
    `generate-crc-report` ships its cloud-upload path.
  - Maybe: parent-comment roll-up status chip (Q10 deferred).
  - Maybe: surface verbatim MCR comment body (Q11 deferred) — likely needs a
    new `parentCommentBody` field on `review_comments.output_json`.
- **Iteration 3:**
  - Trigger CRC run from cityhall (replaces the 501 re-review endpoint).
  - Upload MCR PDF from browser as part of the trigger flow.
  - In-progress real-time updates.
  - BLUE response capture (Q13 deferred).
  - Surface MCR figure thumbnails inline (Q18 deferred).

---

## 12. Appendix — diff against Completeness UI at-a-glance

| Dimension | Completeness today | CRC (this spec) |
|---|---|---|
| Route | `/project/{p}/review/{r}` + `/[sectionId]` sub-routes | `/project/{p}/review/{r}` only — no sub-routes |
| Left nav label | `Completeness` | `U0 MCR resolution` (hardcoded MVP) |
| Page title | `Completeness Check` | `U0 MCR Resolution` |
| Filter tabs | `Fail | Warn | Pass | N/A` | `Failed | Resolved | N/A` |
| Default filter | `Fail` | `Failed` |
| Section grouping | by completeness check guide section (e.g. "Base Sheet Requirements") | by city department (TPW, DE, …) — slug `crc-{dept}` |
| Status enum | `pass / fail / unclear / not-applicable / warn` | `resolved / failed / not-applicable` |
| Status colors | green / red / amber / gray / yellow | green / red / gray (mirror) |
| Comment id format | `{section}-{seq}` (e.g. `36`, `114`) | `{DEPT}-{parentNum}.{subIndex}` (e.g. `TPW-3.1`) |
| Parent-comment chip | n/a | `Parent: TPW 3` shown when ≥2 atomic items share parentCommentId |
| Headline source | `output_json.headline` | `output_json.headline` (from `rephrase-titles` step) |
| Triage status set | 5 statuses (new/to-fix/formal-note/na/incorrect) | identical — reused |
| Triage PATCH endpoint | `/project/{p}/review/triage` | identical — reused |
| Realtime | yes for in-progress runs (resolution_plan + reviews) | no for MVP |
| `Download Report` | live | disabled with tooltip (MVP) |
| `Inspect Review` | live | live (mirror) |
| In-progress display | yes | no (MVP) |
| Trigger UI | no (re-review endpoint is 501) | no |

---

## 13. References

- [`../SPEC.md`](../SPEC.md) — top-level CRC architecture and iteration roadmap.
- [`../crc-workflow/DESIGN-SPEC.md`](../crc-workflow/DESIGN-SPEC.md) — Conductor
  workflow that produces the `reviews` + `review_comments` rows this UI reads.
- [`../generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md)
  — the skill that produces the crc-guides this whole pipeline starts from.
- `cityhall/docs/review-output-schemas.md` — the `output_schema` /
  `output_json` rendering pattern.
- `cityhall/src/routes/(app)/project/[projectId]/+layout.ts:111-310` — review
  nav assembly (Completeness pattern to mirror).
- `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte`
  — Completeness review page (CRC branch lands here).
- `cityhall/src/routes/(app)/project/[projectId]/review/CompletenessCommentCard.svelte`
  — only used by formal-review `[sectionId]` sub-routes. **Not** the pattern
  CRC clones (see §4.3 "Row implementation note"). CRC clones the inline row
  pattern from `[reviewId]/+page.svelte`'s flat list instead.
- `cityhall/src/routes/(app)/project/[projectId]/review/TriageBar.svelte` +
  `CommentTriagePanel.svelte` — triage UI (reused unchanged).
- `cityhall/src/routes/(app)/project/[projectId]/review/triage/+server.ts` —
  PATCH endpoint that proxies to Substation's `/comment-triage` (reused
  unchanged).
- Live Completeness example we mirror visually:
  `app.noeticbuild.com/project/23301a8a-4cdb-4751-ac0c-93b97f0f5c12/review/54d5c002-4648-4fb0-b22d-d222cbbd02f9?v=5d05e3e0-2513-4bf3-a761-e2396d80efef`.
- CRC run targeted for first smoke test:
  workflow `0e674308-f315-4b09-9b11-a1db3d193459`, review
  `7e79e197-8922-4c18-8a94-bc6d43218362` (1700 South Lamar U0).
