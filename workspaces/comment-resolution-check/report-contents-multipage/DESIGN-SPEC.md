# ReportContentsFlowing — a multi-page table of contents for RDS Report mode

**Status:** Draft v1
**Date:** 2026-07-21
**Repos touched:** `dsd` (new RDS layout component + renderer `@page` rule + gallery sample + DOCX dispatch entry + render fixture; RDS package version bump), `substation` (CRV PDF swaps to the new component; RDS dependency + lockfile sync)
**Repos NOT touched:** all SIR deliverables under `diligence/**` (keep `ReportContents`), `cityhall`, `conductor`, `bureau`

## Problem

The Comment Response Review ("CRV") PDF — rendered by substation's
`src/pdf/comment-response-review.tsx` through the dsd server-free Chromium
renderer — silently **clips its table of contents**. On the current Lamar +
Collier U1 deliverable (`comment-response-review (5).pdf`), the TOC lists
Summary + 12 departments and cuts off at item #13 ("One Water Bureau", its
`· N comments` descriptor already gone), and the final `Comments outside our
review scope` row is missing entirely. The summary page's own footer confirms
that section exists ("38 comments fall outside our review scope and are marked
Not analyzed"), so the TOC is dropping ~1.5–2 rows.

This is inherent to the component, not a data bug. `ReportContents` is a
**fixed, single-sheet feature page**:

```css
/* dsd/web/components/report-design-system/layouts/report-contents.module.css:2-11 */
.contents {
  width: 8.5in;
  height: 11in;        /* hard-clamped to exactly one US-Letter page */
  overflow: hidden;    /* anything past 11in is silently clipped */
  break-before: page;
  break-after: page;
}
```

The component (`report-contents.tsx:79-100`) renders **all** items into one
`<ol>` with no pagination, and the article carries `className="rds-report-feature"`
(`report-contents.tsx:58`), so at print time it runs under
`@page rds-feature { size: Letter; margin: 0 }`
(`dsd/web/scripts/render-report/renderer/render-markup.ts:200-203`). Between the
`height: 11in` clamp and `overflow: hidden`, the TOC can never spill onto a
second sheet — rows past ~12–13 are hard-clipped.

`ReportContents` is a widely-shared front-matter primitive. Consumers today:

- **substation** CRV PDF (`comment-response-review.tsx`) — imports from the
  published package `@noetic-inc/report-design-system`.
- Every **SIR deliverable** under `diligence/**` (dozens of `pages.tsx`) —
  imports from source via the `@/components/report-design-system` alias.
- dsd render fixtures (`mini-sir`, `report-mode-sample`, `full-vocab-sir`,
  `scrub-check/fixtures-v1.0`), the gallery sample, and the **DOCX renderer**
  (`scripts/render-docx/map-components.ts:679`, dispatched at :1496).

Because the blast radius is large and SIR TOCs are short (they fit one page and
must not change), we do **not** modify `ReportContents`. We add a sibling.

## Goals / Non-goals

**Goals**
- A Report-mode TOC that flows across as many sheets as its item list needs,
  with correct page margins on every continuation sheet and zero clipping.
- Purely additive: `ReportContents` output stays byte-for-byte identical; every
  existing consumer is untouched.
- The CRV PDF renders its full section list (currently 14+ rows).

**Non-goals**
- Changing `ReportContents` or any SIR front matter.
- The `MAX_META = 6` engagement-fact cap (`report-contents.tsx:44,70`) — that is
  a deliberate design cap, unrelated to TOC-row clipping, and out of scope. (The
  CRV PDF passes only 2 meta items, so it never bites here.)
- Editorial-mode TOC (`TOCPage`) — untouched.

## Decision D1 — new component, not an opt-in prop

Agreed with Will. A `multiPage` prop defaulting to `false` would be equally safe
as *plumbing*, but the two variants are genuinely different **page-geometry
models** (fixed-clip feature page vs. flowing margined page). A separate
component keeps those two contracts from entangling and shields every SIR
consumer completely. Shared presentational markup is factored out (D3) so the
two don't drift.

**Non-load-bearing clarification:** the packaging choice (new component vs.
prop) is *independent* of the continuation-page-geometry choice (Q1 below).
Either packaging would still face Q1. D1 is chosen on blast-radius grounds
alone, not because it resolves anything about paging.

## Design

### New component: `ReportContentsFlowing`

New files, mirroring the existing pair:
- `dsd/web/components/report-design-system/layouts/report-contents-flowing.{tsx,module.css}`
- Exported from `components/report-design-system/index.ts` alongside
  `ReportContents`.

**Props:** identical shape to `ReportContentsProps` (`eyebrow?`, `headline?`,
`meta?`, `items`), reusing the exact `ReportContentsMeta` / `ReportContentsItem`
types. A drop-in swap for the consumer — same call site, same data.

**What differs from `ReportContents`:**
1. The outer container is **not** `.rds-report-feature` and has **no**
   `height` / `overflow: hidden` clamp — content flows.
2. It lands in a page context that supplies **real margins on every sheet**
   (Q1). The current `.contents` inset (`padding: 1.0in 0.85in 0.85in` inside a
   `margin: 0` feature page) is deliberately dropped: CSS box padding applies
   only at the box's start and end, not at intermediate page breaks, so relying
   on it would leave continuation pages flush against the sheet edge. Per-page
   insets must come from the `@page` margin, not box padding.
3. Row-level break hints: `.row { break-inside: avoid }` so a TOC entry never
   splits across a sheet boundary; keep `break-before: page` on the container so
   the TOC opens on a fresh sheet after the cover. (`break-after` is redundant —
   the following `FlowingSection` already forces its own `break-before: page`.)

### Q1 (load-bearing) — continuation-page geometry

Two ways to give the flowing TOC real per-page margins:

- **Option A — reuse the default `@page` (component-only).** Drop
  `rds-report-feature` and assign no `data-rds-page-name`; the element falls to
  the default rule (`render-markup.ts:208-212`): `REPORT_PAGE` margins + a
  bottom-right `counter(page)` page number, no header/footer band. No renderer
  change. **Cost:** stamps a page number on the front-matter TOC, and promotes
  the default `@page` from "stray-content safety net" to a real load-bearing
  path.

- **Option B — bespoke `@page rds-contents-flow` (small renderer edit).**
  *Recommended.* Add to `buildReportPageRules` a rule mirroring `featureRule`
  but with margins and no margin boxes:

  ```
  @page rds-contents-flow {
    size: Letter;
    margin: <REPORT_PAGE.marginTop> <REPORT_PAGE.marginX> <REPORT_PAGE.marginBottom>;
  }
  .rds-report-contents-flow { page: rds-contents-flow; }
  ```

  The component's outer article carries `className="rds-report-contents-flow"`.
  Result: proper margins on every sheet, **no** running page number and **no**
  header/footer band — the TOC stays visually front matter, just multi-page.
  Cost: ~4 lines in `render-markup.ts` plus reading `REPORT_PAGE` from
  `report-chrome.ts` (already imported there).

**Recommendation: Option B.** Front matter shouldn't carry a running page
number, and Option B keeps the multi-page TOC visually consistent with the
single-page one (which has no page number today). It is a bounded, well-scoped
renderer addition.

### D3 — shared presentational innards

Extract the head (eyebrow + headline), the `meta` grid, and the `<li>` row
renderer into small internal, presentational sub-pieces (e.g. `ContentsHead`,
`ContentsMeta`, `ContentsRows`) so both `ReportContents` and
`ReportContentsFlowing` consume identical markup and CSS for everything except
the outer shell. This prevents the two from drifting (e.g. a future row-style
tweak applied to only one). The shared CSS can stay in a common module or be
duplicated verbatim — implementer's call, but the JSX row structure must be
single-sourced.

### Consumer change — substation CRV PDF

In `substation/src/pdf/comment-response-review.tsx`:
- Swap the import and the one call site `<ReportContents … />` →
  `<ReportContentsFlowing … />` (line ~529). Props are unchanged.

**Decision D2 — the CRV PDF always uses the flowing variant.** No item-count
threshold. A flowing TOC with few items renders the same as a fixed one (it just
never clips), so there's no reason to branch on length. Simpler and removes a
class of "13 items looked fine, 14 clipped" surprises.

**Cross-repo release path.** substation depends on the *published* package
`@noetic-inc/report-design-system` (`substation/package.json` pins `0.2.0`),
not dsd source. So shipping requires: (a) land the new component in dsd, (b)
bump + publish the RDS package version, (c) bump substation's dependency and
sync its lockfile — the same move as substation commit `995ecfc` ("Sync lockfile
to report-renderer/report-design-system 0.2.0"). SIR deliverables under
`diligence/**` and all dsd-internal fixtures import RDS from **source**, so they
are unaffected by the package bump and by this change entirely (Q6).

### DOCX renderer — required, or DOCX crashes

The DOCX dispatch **throws** on any unknown component name:

```ts
// dsd/web/scripts/render-docx/map-components.ts:240-246
const handler = BLOCK_DISPATCH[name ?? ''];
if (!handler) throw new Error(`DOCX renderer: unknown component "${name}" — add a mapping …`);
```

So `ReportContentsFlowing` **must** be added to `BLOCK_DISPATCH` (:1494-1518) or
any `.docx` render of a document using it will fail. DOCX flows natively (no
fixed-page notion), so multi-page is moot there — alias it to the existing
builder:

```ts
ReportContentsFlowing: reportContentsBlocks,
```

Identical Word output to `ReportContents`.

### Gallery sample + render fixture

- Add a gallery sample at `gallery/samples/layouts/report-contents-flowing.tsx`
  and register it in `gallery/samples/index.ts`, with a **long** item list
  (≥15 rows) so the multi-page behavior is visible in the design-system gallery.
- Add (or extend) a server-free render fixture proving ≥2-page output — either a
  dedicated `_samples/contents-flowing/` or a long-TOC variant of
  `report-mode-sample`. Acceptance renders through
  `scripts/render-report/cli.ts`.

## Acceptance criteria

1. **CRV PDF full coverage:** re-rendering the Lamar + Collier U1 CRV PDF shows
   every section in the TOC — all reviewed departments *plus* the "Comments
   outside our review scope" row — spanning 2 sheets, with correct top/bottom
   margins on sheet 2 and no clipping.
2. **No regression:** the existing `ReportContents` fixtures (`mini-sir`,
   `report-mode-sample`, `full-vocab-sir`, `scrub-check/fixtures-v1.0`) render
   byte-identical to pre-change output.
3. **DOCX:** a report using `ReportContentsFlowing` renders to `.docx` without
   throwing, with TOC content equivalent to the `ReportContents` path.
4. **Gallery:** the long-TOC sample visibly paginates in `/design-system`.
5. (Option B) no page number or header/footer band appears on any TOC sheet.

## Open questions

- **Q1** — continuation-page geometry: Option A (default `@page`, page number,
  component-only) vs **Option B** (bespoke `@page rds-contents-flow`, no page
  number, ~4-line renderer edit). *Recommend B.*
- **Q2** — component name: `ReportContentsFlowing` (recommended — matches the
  `FlowingSection` vocabulary) vs `ReportContentsMultiPage` vs
  `ReportContentsLong`.
- **Q4** — always-flowing for the CRV PDF (D2, recommended) vs threshold-gated.
  Confirm we don't want to keep single-page for short lists.
- **Q5** — shared innards (D3): extract to internal sub-components (recommended)
  vs. duplicate the row markup. Confirm the extraction is acceptable given it
  edits `report-contents.tsx` (still additive — no output change).
- **Q6** — confirm no packaged-RDS consumer other than substation exists (SIRs
  render from source), so the package bump's only downstream is substation.
- **Q7** — versioning: does the RDS package bump ride an existing release train,
  or does this spec own the version bump + substation lockfile PR as an explicit
  final step?

## Implementation checklist (dsd first, substation second)

1. dsd: extract shared innards from `report-contents.tsx` (D3); no output change.
2. dsd: add `report-contents-flowing.{tsx,module.css}`; export from `index.ts`.
3. dsd: add the `rds-contents-flow` `@page` rule to `render-markup.ts` (Option B).
4. dsd: add `ReportContentsFlowing: reportContentsBlocks` to `BLOCK_DISPATCH`.
5. dsd: gallery sample (long TOC) + render fixture; verify 2-page render.
6. dsd: bump + publish RDS package version.
7. substation: bump RDS dependency + lockfile sync; swap the CRV call site.
8. Re-render the Lamar + Collier CRV PDF; verify acceptance criteria 1–5.
