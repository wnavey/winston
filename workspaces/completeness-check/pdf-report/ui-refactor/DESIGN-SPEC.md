# Design Spec: Migrating the CC "Download Report" PDF to the RDS Renderer

**Date:** 2026-07-08
**Status:** Approved direction — implementation spec

## Decision

The Report Design System (RDS) in `dsd/web/components/report-design-system/` and its
Chromium-based print pipeline are the standard for Noetic PDF output going forward. The
completeness-check "Download Report" PDF — currently rendered with `@react-pdf/renderer`
in substation — migrates to that stack. Feature parity with the existing report is
required; deltas from current behavior are listed explicitly in §7.

**Scope: the CC report only.** Substation renders three other PDFs with React-PDF —
submission report (`src/routes/submission-report-pdf.ts:71`), resolution plan
(`src/routes/resolution-plan-pdf.ts:76`), and SIR (`src/routes/sir-pdf.ts:95`) — and
their documents share `src/pdf/theme.ts`, `noetic-document.tsx`, `LogoHeader`,
`PageFooter`, and `status.ts`. **Those reports stay as-is on React-PDF**, and the shared
React-PDF infrastructure (including the `@react-pdf/renderer` dependency) stays with
them. This migration deletes only CC-exclusive code (§2). If/when the other reports
migrate, that's separate work on the infrastructure this spec builds — but no such
migration is planned or implied here.

## 1. Why Chromium is part of this (context, once)

The RDS is not a skin — it is HTML-emitting React components styled with real CSS
(CSS Modules, `@page` paged-media rules, margin boxes for running headers/footers,
`counter(page)`, `break-inside: avoid`, embedded Albert Sans/Lora). Only a browser
engine can execute that CSS. The dsd renderer's final stage is Playwright loading the
assembled HTML from `file://` and calling `page.pdf()` — Chromium used purely as a
headless print engine (the automated equivalent of Cmd+P). No browser automation,
navigation, or agent interaction is involved.

The CC report is the *easy* case for productionizing this: unlike SIRs (where an agent
authors a bespoke `pages.tsx` per report), the CC report is **one fixed template + JSON
data**. All authoring-time machinery (esbuild bundling, tsx, CSS Module compilation,
font inlining) moves to substation's **build**; the only runtime work is
`renderToStaticMarkup(template(data))` → HTML string → Chromium print.

## 2. Current state (what we're replacing)

| Layer | File | Fate |
|---|---|---|
| UI button + filename | `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte:2050` (`handleDownloadPdf()` at :486) | **Unchanged** |
| Cityhall proxy | `…/completeness-check/pdf/+server.ts` | **Unchanged** |
| Substation endpoint (data fetch) | `substation/src/routes/completeness-check-pdf.ts:125-288` | **Kept** — data fetching, triage merge, cutover gate all stay; only the render call swaps |
| React-PDF document | `substation/src/pdf/completeness-check-document.tsx` | **Replaced** by an RDS template; deleted after cutover |
| CC-only React-PDF components | `src/pdf/components/stacked-bar.tsx`, `src/pdf/components/status-icon.tsx` | **Deleted** after cutover (used only by the CC document) |
| Shared React-PDF infra | `src/pdf/theme.ts`, `src/pdf/noetic-document.tsx`, `src/pdf/components/logo-header.tsx`, `page-footer.tsx`, `status.ts`, `@react-pdf/renderer` dep | **Stays** — used by the submission-report, resolution-plan, and SIR PDFs, which are out of scope |
| Pure-text helpers | `src/pdf/components/uncertain-callout.ts` (+ test), triage annotation strings | **Ported as-is** into the new template's module (see §7.5) |

Preserved behavioral contract:
- **On-demand generation with live data.** Triage state (`verdict_override`,
  disposition, notes) is fetched at request time; the PDF always reflects the latest
  human triage. This does not change.
- **Cutover gate.** `CC_VERDICT_TRIAGE_CUTOVER_AT = '2026-07-07T21:00:00Z'` selects
  legacy five-value vs. two-axis triage rendering and is mirrored byte-identically in
  cityhall (`+page.svelte:106`). Ported exactly.

## 3. Target architecture

```
request → substation PDF function (dedicated entry, §3.1)
        → endpoint logic (auth, fetch review/comments/triage — unchanged)
        → buildCcReportProps(data)                        (unchanged shape, §5)
        → <CompletenessCheckReport {...props} />           (new RDS template)
        → renderToStaticMarkup(...)                        (React, in-process)
        → assembleReportHtml(markup, { pageRules, fonts }) (library extracted from dsd CLI)
        → printPdf(html)                                   (playwright-core + @sparticuz/chromium)
        → stream application/pdf                           (unchanged)
```

### 3.1 Runtime: a dedicated PDF function in substation (Chromium isolated from the API)

Substation currently deploys as a **single** Vercel Node function
(`substation/vercel.ts`: `dist/index.js`, maxDuration 800, no memory override) — one
Hono app (`src/index.ts`) serving every route: auth, triage, CRC, Inngest, PDFs. Putting
Chromium into that mono-function is ruled out, because the blast radius is the whole
API, not just PDFs:

1. **Cold-start artifact tax on every route.** One function = one deployment artifact;
   a ~50–70MB Chromium layer inflates cold-start fetch/extract for a triage save that
   never touches Chromium. Lazy-importing the renderer avoids module-eval cost only,
   not artifact cost.
2. **Memory is provisioned per-function.** Guaranteeing render headroom (1.5–3GB) would
   mean provisioning — and paying for — render-class instances across all API traffic.
3. **Contention and failure coupling (the real incident generator).** Under Fluid
   Compute, warm instances serve multiple concurrent invocations: a render pinning
   CPU/RAM for seconds degrades co-located requests, and a Chromium OOM/crash kills
   every in-flight request on that instance. Long-lived browser reuse inside the
   general API process adds zombie/leak risk to everything.
4. **Shared 250MB uncompressed budget.** Chromium permanently eats a large fixed chunk;
   all future dependency growth would compete with it.

**Design: a second function entry point.** Same repo, same deploy:

- New tsup entry `src/pdf-function.ts` → `dist/pdf.js` — a minimal Hono app mounting
  only the render route(s). Added to the `functions` map in `vercel.ts` with its own
  memory (1.5–3GB) and maxDuration; path routing sends
  `…/completeness-check/pdf` to it ahead of the main catch-all.
- The main API function stays at its current size, memory, and cold-start profile —
  unaffected by this migration.
- Inside the PDF function: **`@sparticuz/chromium`** (brotli-compressed Chromium
  engineered for the 250MB limit, extracts to `/tmp` at runtime) +
  **`playwright-core`** (matching the dsd CLI). Local dev falls back to the
  Playwright-installed Chromium via env switch. Browser-instance reuse across warm
  invocations is safe here because only render traffic shares these instances.
- Expected latency: ~2–5s per download (cold Chromium launch + print of a 10–40 page
  document; dsd renders 180-page SIRs in ~3s locally). The PDF function pays its own
  Chromium cold start on the first download after idle — acceptable for a download
  button.
- Data-fetch code (§5) is shared between the two entries as ordinary modules; the
  cityhall proxy is unaffected (path routing is internal to Vercel).

**Spike (workstream 1) must answer:** (a) does the `@vercel/hono` framework-preset
setup cleanly support a second entry + path routing to it (the tsup config keeps `hono`
external specifically for framework detection — verify multi-function coexists with
that), (b) PDF-function cold/warm render latency and memory high-water mark, and
(c) that the main function's artifact size and cold start are **unchanged**. Fallback
if (a) fails: a dedicated render service (small always-on container with dsd + full
Playwright, `POST /render`) — same library code, different host.

### 3.2 Build-time (substation)

- tsup/esbuild compiles the CC template + RDS components. Add CSS Modules handling to
  the build (esbuild `css-modules` support — same approach the dsd CLI uses in stage 1)
  and emit the combined CSS as a build artifact imported as a string.
- Albert Sans + Lora TTFs inlined as base64 `@font-face` blocks at build time (reuse the
  dsd renderer's font-embedding code).
- The wordmark SVG and status icon SVGs inline via esbuild's `dataurl` loader (as in dsd).

### 3.3 dsd changes: renderer libraryization

Extract stages 2–4 of `dsd/web/scripts/render-report/cli.ts` into an importable module
(new package, see §3.4), keeping the CLI as a thin wrapper:

- `renderReportMarkup(element)` — `renderToStaticMarkup` + report-mode wrapper handling.
- `assembleReportHtml(markup, opts)` — theme.css + report-theme.css + bundled CSS +
  embedded fonts + generated named-`@page` margin-box rules (parsed from
  `data-rds-page` attributes). Accept pre-inlined assets (no filesystem copying needed
  for the CC case — all assets are build-time data URIs).
- `printPdf(html, { browser })` — takes an injected browser/launch config so the same
  code runs against full Playwright locally and `@sparticuz/chromium` on Vercel.

The CLI's stage 1 (esbuild of an arbitrary `pages.tsx`) stays CLI-only; substation
doesn't need it.

### 3.4 dsd changes: packaging

RDS is currently isolated by design ("no exports outside dsd"). That policy changes:
publish **`@noetic/report-design-system`** (components + theme CSS + fonts) and
**`@noetic/report-renderer`** (the extracted library) as private packages (GitHub
Packages or the org's registry). This is a prerequisite and the first PR in the
sequence; it also unblocks the CRC PDF ("moves to cloud in iter-3") and any future
product-surface PDFs on the same stack. A git submodule is the fallback if package
publishing is contentious, but packages are the recommendation — vendored copies are
ruled out (drift defeats the point of standardizing).

## 4. The CC report template in RDS vocabulary

New file: `substation/src/pdf/completeness-check-report.tsx` — a report-mode component
tree (`<ReportDocument>` root). Document structure, mirroring today's report:

1. **Running chrome** (`ReportDocument`): `documentKicker` = site plan name (+ SP number
   if available), `brand="Noetic"`. Page numbers and per-section footer labels come free
   from the named-`@page` margin boxes.
2. **Summary section** (`FlowingSection id="summary"`): pass-rate hero + status count
   chips + stacked status bar, then the section results table with internal links to
   each detail section.
3. **One `FlowingSection` per CC section**, each with a **unique `id`** — a unique id
   creates its own named `@page`, which forces a page break and gives a per-section
   footer label. This reproduces today's one-detail-page-per-section behavior exactly
   (note: this is the opposite of the SIR Part-grouping convention, deliberately).
4. Within each section: findings grouped by status (fail → warn → uncertain → pass →
   n/a), each group with a colored rail head, each finding with dot/title/triage
   annotation/explanation/refs/resolution.

### 4.1 Component mapping (existing RDS components)

| CC feature | RDS component |
|---|---|
| Per-section detail flow + footer labels + page numbers | `FlowingSection` + generated `@page` margin boxes |
| Uncertain consensus callout | `Callout variant="data-gap"` with `buildUncertainCalloutText()` output |
| Summary→section internal links | existing anchor mechanism (`sectionAnchorId`); Chromium preserves them as PDF GoTo annotations |
| Site metadata block | `KeyValue layout="inline"` |
| In-section hierarchy | `SectionHeading` / `SubHeading` |

### 4.2 New RDS components required (built in dsd, generic where sensible)

| CC feature (current impl) | New component |
|---|---|
| Pass-rate hero % + status count chips (`countChip`/`countDot`) | `StatusSummary` |
| Stacked status bar (`substation/src/pdf/components/stacked-bar.tsx`) | `StackedStatusBar` (report-mode; editorial `StackedTimelineBar` stays editorial-scoped) |
| Section results table: per-status colored counts, status icons, alternating rows, "Not applicable for Site Application" divider row, clickable row links | `SectionSummaryTable` |
| Check/warning/dash icons (`components/status-icon.tsx`) | `StatusIcon` |
| Status-grouped finding list (colored rail group head; per-item dot, title, annotation, explanation, reference docs, resolution) | `ChecklistFindingGroup` / `ChecklistFinding` — deliberately distinct from `FindingBlock`, whose severity taxonomy and implication/nextStep shape don't fit checklist verdicts |
| Status taxonomy pass/fail/warn/uncertain/not-applicable | New `--rds-status-*` token set in `report-theme.css` (§8, open question on hues), alongside — not replacing — the `--rds-sev-*` severity tokens |

These live in `dsd/web/components/report-design-system/` with CSS Modules, following
existing conventions (print-unit typography, `break-inside: avoid` on finding blocks and
table rows, SVG text with explicit `fontFamily`), and get sample coverage in
`dsd/web/scripts/render-report/_samples/` so they render in the dsd preview like every
other component.

## 5. Data model (unchanged)

The template consumes the exact props shape the React-PDF document takes today
(`CompletenessCheckReportProps`: `sitePlanName`, `siteAddress`, `completedAt`,
`sections: CcSection[]`, `triageMap`, `usesNewCcTriage`). All fetching, bucketing,
triage merging, and the cutover computation in `completeness-check-pdf.ts` stay as-is —
the endpoint swaps only its final render call. This keeps the diff reviewable and makes
the parity QA (§9) a pure rendering comparison.

## 6. Workstreams & sequencing

| # | Workstream | Repo | Depends on |
|---|---|---|---|
| 1 | Spike: second function entry (`dist/pdf.js`) with `@sparticuz/chromium` + `playwright-core` hello-world PDF, deployed; verify multi-function routing under the `@vercel/hono` preset, measure PDF-function cold/warm latency + memory, and confirm the main function's artifact/cold start are unchanged | substation | — |
| 2 | Renderer libraryization (`renderReportMarkup` / `assembleReportHtml` / `printPdf`) + CLI refactored onto it | dsd | — |
| 3 | Publish `@noetic/report-design-system` + `@noetic/report-renderer` | dsd | 2 |
| 4 | New RDS components + status tokens (§4.2), with samples | dsd | — (parallel with 2/3) |
| 5 | CC template in substation + build wiring (CSS Modules, fonts) + endpoint swap behind `CC_PDF_RENDERER=rds\|react-pdf` env flag | substation | 1, 3, 4 |
| 6 | Parity QA (§9), flip flag default, remove flag + delete CC-only React-PDF code (`completeness-check-document.tsx`, `stacked-bar.tsx`, `status-icon.tsx`); shared React-PDF infra and dep stay for the other reports | substation | 5 |

Estimated total: ~1.5–2.5 weeks. Workstream 1 is the risk-retirement step — do it first;
if it fails substation's function budget, swap the host to a render service (§3.1
fallback) without changing any library code.

**CRC alignment:** the CRC download button is currently disabled with "PDF generation
moves to cloud in iter-3" (`+page.svelte:2061`). Workstreams 2–4 are exactly the shared
infrastructure that work needs; the CRC PDF should be built directly on this stack as a
second template, never on React-PDF.

## 7. Deltas from current behavior (explicit)

1. **Latency:** download goes from near-instant (React-PDF streams) to ~2–5s (Chromium
   launch + print). Same order of magnitude; acceptable for a download button. Mitigate
   with warm browser reuse.
2. **Typography/layout will not be pixel-identical** — it will be *better* (real
   paged-media layout, RDS type system), but any downstream consumer expecting exact
   page counts or coordinates (none known) would notice.
3. **New production dependency and a second Vercel function:** a Chromium binary lives
   in a dedicated PDF function (`dist/pdf.js`), isolated from the main API function,
   which keeps its current size, memory, and cold-start profile. Ownership: substation.
   Pin `@sparticuz/chromium` to the playwright-core-compatible version.
4. **RDS repo policy:** RDS becomes an externally consumable package (was: isolated).
5. **Not a delta — a hard invariant:** the cutover constant and every triage-annotation
   string (legacy five-value and two-axis wording, D11 note-sharing rule) and
   `buildUncertainCalloutText` port **byte-identically**. They are mirrored in
   cityhall's UI; drift makes PDF and UI disagree about a review's triage era or
   wording. Port the pure-text helpers by moving the files, not rewriting them.
6. **Internal links, filename, auth path, on-demand freshness:** unchanged.

## 8. Open questions

1. **Cover page.** RDS convention opens with a full-bleed `ReportCover`; the CC report
   currently opens on the summary page. Recommendation: **add the cover** (site plan
   name as subject, review date, "Completeness Check Report" as title) — it's the RDS
   standard and costs one page — but it is additive to parity, so flagging for sign-off.
2. **Status colors.** Keep CC's exact green/red/amber/gray (matches cityhall's web UI)
   or restate them in RDS's more muted editorial hues? Recommendation: define the new
   `--rds-status-*` tokens with the **current UI-matching hues** so PDF and web UI agree,
   and let RDS-wide palette harmonization happen later as a dsd design decision.
3. **Package registry** for the private packages (GitHub Packages vs. existing org
   registry) — whoever owns dsd CI decides in workstream 3.

## 9. Parity QA checklist (workstream 6 gate)

Render old vs. new for: (a) a post-cutover review with verdict overrides + dispositions
+ notes, (b) a pre-cutover review exercising all five legacy triage values, (c) a
multi-run review with uncertain items (vote breakdowns, tentative verdicts, missing-run
counts), (d) a review with all-N/A sections (divider row), (e) a review with unclear
items (legacy status column). Verify: every status count, every annotation string
byte-for-byte, section table links jump correctly, page footer labels/numbers, stacked
bar proportions, reference docs + resolution lines, filename, and that both eras render
correctly through the same endpoint.
