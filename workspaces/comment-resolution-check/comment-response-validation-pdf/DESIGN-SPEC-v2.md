# Comment Response Review PDF — v2 (full-comment coverage + facelift)

**Status:** Draft v1 (of v2 feature; supersedes DESIGN-SPEC.md D8/D9)
**Date:** 2026-07-20
**Repos touched:** `substation` (comparison logic + data assembly + RDS template)
**Repos NOT touched:** `claude-plugins` (skill + `comment-responses.json` schema unchanged), `cityhall` (button already shipped), `dsd` (existing RDS components only — no republish), `bureau`, `conductor`, `navalbase`

> **Relationship to v1.** The MVP (DESIGN-SPEC.md, shipped 2026-07-17 — substation#159 / cityhall#593 / claude-plugins#150) rendered exactly one cell of the comparison matrix: firm-`resolved` × CRC-`{failed,uncertain}`, as two flat sections. Everything else (~68% of a real letter) was parsed, stored in `comment-responses.json`, and left invisible. v2 keeps that dispute cell as the headline but renders **every** comment — disputes as detail cards, everything else in per-department status tables — and gives the summary a facelift. This is a **substation-only** change; the skill and its output schema are untouched. v2 reverses v1 decisions **D8** (report set) and **D9** (report content), and drops the v1 render guard.

## Problem

v1 answers one question well — "which comments does the firm claim are done that we say aren't?" — but a reviewer opening the PDF can't see the rest of the picture: what we *confirmed* resolved, what the firm left pending or silent that we also failed, and which comments fall outside our review scope entirely. All of that is already in the parsed artifact.

Grounding, from the one real run on disk (`crc-comment-responses/23301a8a-…/cf1201c2-…/5/0/comment-responses.json`, 1700 S Lamar U5, 236 entries):

- `believedStatus` distribution: `resolved` 76, `pending` 66, `no-response` 84, `contested` 6, `unclear` 4, `deferred` 0.
- `matchStatus`: `parsed` 232, `inferred` 2, `unmatched` 2.
- 18 department prefixes present (`SP` 51, `DE` 37, `AW`/`TPW` 21 each, `CA` 22, …).
- The v1 PDF acts only on the 76 `resolved` entries, and of those only the ones that roll up to `failed`/`uncertain` — a small slice of a 236-comment letter.

Two facts that shape v2:

1. **CRC intentionally does not evaluate every MCR comment.** During CRC guide generation we deliberately drop comments the agent can't or shouldn't check — e.g. "coordinate a meeting with Austin Energy," "submit worksheet X to the portal." Those comments *exist in the response letter* (the firm answers them) but have **no checklist item** on our side. A response entry with no matching CRC verdict is therefore **expected**, not an error, and must be presented as such ("Not analyzed") rather than hidden or flagged.

2. **A wrong-document parse is the main failure mode.** v1 guarded against it with a hard 50%-join tripwire. With v2's "Not analyzed" category, non-joining is normal, so the old guard's denominator is polluted (see D4). We drop the hard gate and replace it with a non-gating "matched N of M" line.

## Solution overview

```
  comment-responses.json (unchanged)     review_comments + comment_triage
        (firm side, all statuses)              (our side, all verdicts)
                     │                                  │
                     └──────────────┬───────────────────┘
                                    ▼
             crv-report-logic.ts — build the FULL universe
             (union keyed by normalized parentCommentId)
                                    │
         ┌──────────────────────────┼───────────────────────────┐
         ▼                          ▼                            ▼
   DISPUTE CARDS            PER-DEPT STATUS TABLES        OUTSIDE-SCOPE TABLE
 firm-resolved ×          everything else, by dept       depts we analyze
 {failed,uncertain}       (confirmed / open / n-a /      nothing in (all rows
 (red / yellow)           not-analyzed rows)             "Not analyzed")
                                    │
                                    ▼
                    comment-response-review.tsx (RDS, facelift)
             cover → contents → SUMMARY (hero + stat cards + dispute
             ranking) → dept sections (strip → cards → table) →
             "Comments outside our review scope"
```

Everything is still deterministic render-time code (v1 D2 holds): triage overrides applied in cityhall after the CRC run are reflected on every render.

## The comparison universe (D1, D3)

Build a single map keyed by **normalized `parentCommentId`** (`normalizeCommentId` in `crv-report-logic.ts` is unchanged). Every key resolves to one of three **provenance classes**:

| Class | Condition | Treatment |
|---|---|---|
| **(a) Analyzed** | ≥1 CRC verdict joins the key | Card if firm-`resolved` × rollup-`{failed,uncertain}`; else a status-table row carrying the real rollup verdict (`failed`/`uncertain`/`resolved`/`not-applicable`). |
| **(b) Not analyzed** | response entry with a **non-empty** normalized `commentId`, **no** CRC verdict, and `matchStatus !== "unmatched"` | Status-table row, OUR REVIEW = grey **"Not analyzed"** chip. Never a card. |
| **(c) Dropped** | empty/absent `commentId` **or** `matchStatus === "unmatched"` | Excluded from the PDF; remains in `comment-responses.json`. |

Notes:
- Class-(b) is **expected** (intentional guide-gen exclusions). Substation can't distinguish "intentionally excluded" from "we somehow have no verdict"; both render as "Not analyzed" for MVP — iterate later if the distinction proves valuable.
- A CRC verdict with **no** response entry → class (a) with FIRM = "No response" (belt-and-braces; the skill usually synthesizes `no-response` entries, but we don't rely on it).
- `matchStatus` of `parsed`/`inferred` both join normally; only `unmatched` forces class (c).
- A firm-`resolved` claim on a class-(b) comment stays a "Not analyzed" row — no verdict means nothing to dispute, so never a card.

### Rollup (unchanged from v1 D7)

Atomic verdicts roll up to the parent by severity `failed > uncertain > resolved > not-applicable`; `not-applicable` children are ignored when a sibling carries a real verdict; an all-`n/a` parent rolls up to `not-applicable`. `uncertain` is used as-is.

## Report structure (D5, D6)

### Cards (D2, D8) — unchanged scope, restyled

Detail cards render **only** for firm-`resolved` × rollup-`{failed,uncertain}`:

- **Failed → red** ("Still unresolved"), **uncertain → yellow** ("Could not confirm") — same tone tokens as v1.
- Card header adds two pills: `FIRM RESOLVED` + `NOETIC FAILED` / `NOETIC UNCERTAIN`.
- Body: parent comment text (as reprinted) → firm's verbatim response → "Our verdict" bar → per failing/uncertain atomic item: **Why it fails / Why it's uncertain**, **Recommended fix**, and **Noetic Reviewer Note** (triage note) when present.
- **Sheet references are dropped** from cards in v2 (v1 listed them; mocks omit them, CRC sheet refs are noisy).

### Per-department sections (D5)

Every department with **≥1 analyzed comment** (class (a)) gets a section, ordered by **dispute count (flagged + unconfirmed) descending**, ties broken by total comment count desc, then name:

1. **Stat strip** — three cells: `N COMMENTS` │ `X DISPUTED — FIRM CLAIMED RESOLVED` │ `Y NO DISPUTE — SEE STATUS TABLE`, where X = cards, Y = table rows (incl. not-analyzed), N = X + Y.
2. **Dispute cards** for that department (failed then uncertain), if any.
3. **Status table** — every comment in the department not promoted to a card.

Department display name resolves from `dept-prefix-dict.tsv` (prefix → full name) as the single source of truth, falling back to CRC `applicableArea`, then the bare prefix. For class-(b) rows (no `applicableArea`), the name comes from the entry's `dept` prefix via the same dict.

### "Comments outside our review scope" (D5, D10)

Departments where we analyzed **nothing** (every row class-(b) — e.g. Austin Energy) do **not** get a reviewed-department section (that would imply we reviewed them). They collapse into a single trailing **"Comments outside our review scope"** section — one status table — always rendered **last**, regardless of size. It appears in the TOC as its own numbered row but **not** in the dispute-ranking chart (zero disputes).

### Status table columns & sort (D6)

`ID │ COMMENT │ FIRM │ OUR REVIEW`

- **COMMENT** = our CRC finding **title** (short), falling back to the reprinted MCR `originalCommentText` when we have no title (e.g. class-(b) rows).
- **FIRM** = display string for `believedStatus` (`Resolved` / `Pending` / `Contested` / `Deferred` / `Unclear` / `No response`); "No response" muted/italic.
- **OUR REVIEW** = `StatusIcon` dot + label: `FAILED` / `UNCERTAIN` / `RESOLVED`; `not-applicable` → grey **"N/A"** (distinct, not folded into Resolved); class-(b) → grey **"Not analyzed"** chip.
- **Sort:** still-open first — `failed` → `uncertain` → `resolved` → `n/a` → `not-analyzed`; within a tier by FIRM status then ID.
- **Emphasis:** `failed`/`uncertain` rows full-weight; `resolved`, `n/a`, and `not-analyzed` rows visually muted, so the eye lands on what's still open.
- **No truncation** — Chromium paginates long tables.

## Summary facelift (D7)

- **Hero** — big number: "{flagged} of {analyzedClaimedResolved} comments the firm marked resolved may not be — plus {unconfirmed} we could not confirm," with singular/plural handling and a zero-disputes ("all verified") variant.
- **Four stat cards** — `May not be resolved` · `Could not confirm` · `Confirmed resolved` · `Claimed resolved`.
- **Reconciliation invariant:** `confirmed + flagged + unconfirmed === analyzedClaimedResolved`, exactly. A firm-`resolved` comment that landed in class-(b) ("Not analyzed") is **excluded** from `analyzedClaimedResolved` and footnoted ("N comments the firm marked resolved fall outside our review scope"). This fixes the v1 latent bug where a resolved join-orphan inflated `claimedResolved` without landing in any bucket.
- **"Where the disputes are concentrated"** — existing RDS `RankedBarList`, ranked by (flagged + unconfirmed) per department. If `RankedBarList` can't render a 2-tone red/brown segment, unconfirmed shows as a trailing annotation ("4 · 1 unconfirmed") rather than a custom bar.
- **Join transparency line (D4)** — a single muted line: "Matched N of M response comments to our review." Non-gating; a human reading "matched 3 of 236" immediately smells a wrong-document parse.
- **Not-analyzed footnote** — "N comments fall outside our review scope and are marked Not analyzed."

## Render guard: dropped (D4)

v1's `joinCoverageTooLow` (hard 422 when < 50% of response entries matched a CRC parent) is **removed**. With class-(b) and synthesized `no-response` rows, low join coverage is now expected, so the guard would mostly false-positive. It is replaced by the non-gating "Matched N of M" summary line above. Accepted risk: a genuinely wrong-document parse renders a plausible-but-wrong report; the transparency line is the only signal, by design (Will's call).

## Components & build (D9)

Built entirely from **existing** `@noetic-inc/report-design-system` exports — no new dsd components, no package republish:

| Need | RDS component |
|---|---|
| Summary hero | `StatHero` |
| Stat cards | `StatRow` |
| Dispute ranking chart | `RankedBarList` (fallback `RankingTable`) |
| Status tables | `Table` / `SectionSummaryTable` |
| OUR REVIEW dots | `StatusIcon` |
| Sections / cover / TOC | `FlowingSection`, `ReportCover`, `ReportContents`, `SectionHeading`, `Callout`, `KeyValue` (as v1) |

> **Open verification (Q4):** confirm the published `@noetic-inc/report-design-system` package (what substation imports) exports `StatHero`, `StatRow`, `RankedBarList`, `Table`/`SectionSummaryTable`, and `StatusIcon`. They are present in the dsd source index (`dsd/web/components/report-design-system/index.ts`); verify they're in the built package substation resolves, and match each component's prop contract during implementation. If any is missing, compose it template-local rather than republishing dsd.

Files (all in the existing substation-pdf app):

| Piece | File | Change |
|---|---|---|
| Comparison logic | `src/pdf/crv-report-logic.ts` | Rewrite `buildCrvComparison` to emit the full universe (cards + per-dept table rows + outside-scope), add class (a/b/c) resolution, drop `joinCoverageTooLow`. |
| Data assembly | `src/pdf/crv-report-data.ts` | Already fetches all `review_comments` + triage; add `dept-prefix-dict` name resolution and the max-generation `comment-responses.json` load (unchanged). Remove the coverage-guard 422. |
| Template | `src/pdf/comment-response-review.tsx` | Restyle per the mocks: hero, stat cards, ranking chart, per-dept strip + table, outside-scope section, card pills. |

Route (`src/routes/comment-response-validation-pdf.ts`), auth, filename (`comment-response-review.pdf`), and the cityhall proxy/button are all unchanged.

## Deploy (D9)

Single **substation** PR. No deploy-order coupling (skill and cityhall untouched). The `dept-prefix-dict.tsv` lookup: decide during implementation whether substation reads a copy vendored into the repo or the values are inlined — it currently lives only in `claude-plugins`; a small vendored copy in substation avoids a cross-repo runtime dependency (Q5).

## Decisions (v2)

- **D1** — Render *all* comments. Three provenance classes: (a) analyzed, (b) not-analyzed (real MCR comment, no checklist item — expected), (c) dropped (unmatched/garbage, JSON-only).
- **D2** — Detail cards stay scoped to firm-`resolved` × rollup-`{failed,uncertain}` (red/yellow); everything else → status table.
- **D3** — Universe = union of CRC verdicts + response entries, keyed by normalized `parentCommentId`. Class-(b) = non-empty ID, no verdict, `matchStatus!=="unmatched"`; class-(c) = empty ID or `matchStatus==="unmatched"`.
- **D4** — Drop the hard render guard; replace with a non-gating "Matched N of M" summary line.
- **D5** — Per-department sections (strip → cards → table), ordered by dispute count desc; departments with zero analyzed comments collapse into a single trailing "Comments outside our review scope" section.
- **D6** — Status table `ID │ Comment │ Firm │ Our review`; sort failed→uncertain→resolved→n/a→not-analyzed; confirmed/n-a/not-analyzed rows muted; no truncation.
- **D7** — Summary facelift: hero, four stat cards, `RankedBarList` dispute ranking; reconciliation invariant `confirmed+flagged+unconfirmed === analyzedClaimedResolved`; not-analyzed excluded + footnoted; fixes the v1 orphan-inflation bug.
- **D8** — Cards gain FIRM/NOETIC pills; keep why-fails + recommended-fix + reviewer-note; drop sheet references.
- **D9** — Existing RDS components only, no dsd republish; substation-only PR; skill, `comment-responses.json` schema, and cityhall untouched.
- **D10** — "Outside our review scope" section always renders last, in the TOC but not the dispute-ranking chart.

## Open questions

- **Q1** — Distinguishing "intentionally excluded" from "no verdict due to an upstream miss" within class-(b): deferred; both render "Not analyzed" for MVP. Revisit if operators want the distinction surfaced.
- **Q2** — Dispute-ranking chart 2-tone rendering: confirm whether `RankedBarList` supports a red/brown split segment or we fall back to the trailing annotation form.
- **Q3** — Hero copy for edge distributions (0 flagged + N unconfirmed; 0 claimed-resolved entirely): enumerate the exact templated variants during implementation.
- **Q4** — Verify the published RDS package exports every component in the table above with compatible prop contracts (see Components note).
- **Q5** — `dept-prefix-dict.tsv` source for substation: vendored copy vs inlined map — pick during implementation to avoid a cross-repo runtime dependency.

## Deliberately out of scope

- **Skill / schema changes** — `comment-responses.json` already carries every status and `matchStatus`; v2 reads it as-is.
- **cityhall UI** — the download button already gates on ≥1 parsed generation; no in-app believed-status column (still deferred from v1).
- **DB table for parsed responses** — bucket JSON remains the store.
- **New dsd/RDS components** — existing exports only.
- **Multi-PDF (per-department) response letters** — still one consolidated PDF (v1 D-A3).
- **Class-(b) intent detection, figures/crops** — deferred.
