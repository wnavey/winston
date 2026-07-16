# Design Spec: Migrating the CC "Download Report" PDF to the RDS Renderer

**Date:** 2026-07-08
**Status:** IMPLEMENTED — v2.0, 2026-07-16. All six workstreams shipped and §9 parity QA
passed on production data. The only remaining step is the cutover itself (setting
`CC_PDF_RENDERER=rds` + `SUBSTATION_PDF_URL=https://substation-pdf.vercel.app` on the
cityhall Vercel project) and, after a bake period, the workstream-6 deletion PR.
See **§10 Implementation record** for every pivot made against this spec — read §10
FIRST if you are reusing this scaffolding for another report (e.g. the CRC PDF; see
§10.6).

> **Revision note (v2.0, 2026-07-16):** Implementation record appended as §10. Material
> pivots vs. the spec as written: the "second function entry in one Vercel project"
> architecture (§3.1) is impossible under the `@vercel/hono` preset and became a second
> Vercel project `substation-pdf` (§10.1); browser reuse across warm invocations —
> assumed safe in §3.1 — is broken on Vercel Fluid and became launch-per-render
> (§10.2); packages are `@noetic-inc/*`, not `@noetic/*` (§10.3); the cutover flag
> moved from a substation render-call switch to a cityhall proxy base-URL switch
> (§10.1); the endpoint's data assembly was extracted into a module shared by both
> renderers rather than left inline (§10.4). §8's three open questions are all
> resolved (§10.5).

Shipped PRs: substation#155 (spike), dsd#333 (renderer library), dsd#334 (status
components), dsd#335+#336 (packages + publish workflow), substation#158 (RDS endpoint +
logic extraction), cityhall#592 (proxy flag + download UX). Packages published:
`@noetic-inc/report-design-system@0.1.0`, `@noetic-inc/report-renderer@0.1.0`.

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
font inlining) happens at **build time** — in dsd's package build (§3.4), not at
request time; the only runtime work is `renderToStaticMarkup(template(data))` → HTML
string → Chromium print.

## 2. Current state (what we're replacing)

| Layer | File | Fate |
|---|---|---|
| UI button + filename | `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte:2050` (`handleDownloadPdf()` at :486) | **Small change** — download gains an in-flight state (§7.1); filename logic unchanged |
| Cityhall proxy | `…/completeness-check/pdf/+server.ts` | **Small change** — add a fetch timeout (§7.1); auth/streaming unchanged |
| Substation endpoint (data fetch) | `substation/src/routes/completeness-check-pdf.ts:125-288` | **Kept** — data fetching, triage merge, cutover gate all stay; only the render call swaps |
| React-PDF document | `substation/src/pdf/completeness-check-document.tsx` | **Replaced** by an RDS template; deleted after cutover |
| CC-only React-PDF components | `src/pdf/components/stacked-bar.tsx`, `src/pdf/components/status-icon.tsx` | **Deleted** after cutover (used only by the CC document) |
| Shared React-PDF infra | `src/pdf/theme.ts`, `src/pdf/noetic-document.tsx`, `src/pdf/components/logo-header.tsx`, `page-footer.tsx`, `status.ts`, `@react-pdf/renderer` dep | **Stays** — used by the submission-report, resolution-plan, and SIR PDFs, which are out of scope |
| Presentation-independent logic + text | `getEffectiveStatus`, `STATUS_GROUP_ORDER`, D9/D11 annotation rules, unclear/uncertain column gating, all-N/A bucketing, `src/pdf/components/uncertain-callout.ts` (+ test), triage annotation strings | **Moved, not rewritten** into a plain-TS module the new template consumes (see §7.5) |

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

### 3.2 Build-time (substation): nearly nothing

Because the packages ship **precompiled** (§3.4), substation's build stays essentially
untouched: no CSS Modules loader, no `@/` alias, no font or SVG asset wiring. The CC
template (§4) is plain TSX that composes packaged RDS components — any CC-specific
styling lives in the new RDS components inside the package, so the template carries no
CSS of its own. tsup compiles it like any other TSX file in the repo. Theme CSS, fonts,
and inlined assets all arrive through the packages.

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

### 3.4 dsd changes: packaging (precompiled — decided)

RDS is currently isolated by design ("no exports outside dsd"). That policy changes:
publish two private packages (GitHub Packages or the org's registry). This is a
prerequisite and the first PR in the sequence; it also unblocks the CRC PDF ("moves to
cloud in iter-3") and any future product-surface PDFs on the same stack. A git
submodule is the fallback if package publishing is contentious, but packages are the
recommendation — vendored copies are ruled out (drift defeats the point of
standardizing).

**The packages ship precompiled, not raw source.** Raw TSX + `.module.css` would force
every consumer to replicate dsd's build (CSS Modules loader, `@/` alias resolution, JSX
config, `dataurl` asset loaders) — a per-consumer build burden and a config-drift
surface that defeats the standardization goal. The consumer contract is instead:
*import components, call the renderer* — React as the only peer dependency.

**`@noetic/report-design-system`:**
- `dist/index.js` — ESM, JSX pre-transformed, CSS Modules compiled to hashed-classname
  maps, wordmark/status SVGs and small PNGs inlined as data URIs. React 19 peer dep.
- `dist/styles.css` — the compiled component CSS bundle (what the dsd CLI's stage 1
  emits as `bundle.css`).
- `theme.css`, `report-theme.css` — token/`@page`/print-primitive layers, shipped as-is
  (the renderer strips and regenerates `@font-face` at assemble time, unchanged from
  the CLI's behavior).
- `fonts/` — Albert Sans + Lora TTFs plus a generated `fonts.js` exporting the base64
  `@font-face` block, so no consumer touches font files.
- Built in dsd CI **with the same esbuild config module the render CLI's stage 1 uses**
  (extract it as a shared module) — the CLI must keep compiling raw source because it
  bundles arbitrary agent-authored `pages.tsx`, and a shared config is what prevents
  package output and CLI output from drifting.

**`@noetic/report-renderer`:**
- Exports `renderReportMarkup` / `assembleReportHtml` / `printPdf` (§3.3) plus a
  one-call convenience `renderReportPdf(element, { browser })`.
- Depends on `@noetic/report-design-system` for theme CSS + fonts, so `assembleReportHtml`
  needs zero asset wiring from the consumer.
- Browser injection: accepts a `playwright-core` browser/launch config —
  `@sparticuz/chromium` on Vercel, locally-installed Playwright Chromium in dev and in
  the dsd CLI.

Versioning: the two packages version in lockstep (renderer pins its exact
design-system version); consumers pin both.

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
4. Within each section: findings grouped by effective status in `STATUS_GROUP_ORDER`
   (fail → warn → uncertain → unclear → pass → n/a — ported, not re-derived; §7.5),
   each group with a colored rail head, each finding with dot/title/triage
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
| 3 | Publish `@noetic/report-design-system` + `@noetic/report-renderer` — **precompiled** per §3.4, package build sharing the CLI's esbuild config | dsd | 2 |
| 4 | New RDS components + status tokens (§4.2), with samples | dsd | — (parallel with 2/3) |
| 5 | CC template in substation (plain TSX composing packaged components — no build changes per §3.2) + endpoint swap behind `CC_PDF_RENDERER=rds\|react-pdf` env flag + per-instance render serialization; cityhall download loading state + proxy timeout (§7.1) | substation, cityhall | 1, 3, 4 |
| 6 | Parity QA (§9), flip flag default, remove flag + delete CC-only React-PDF code (`completeness-check-document.tsx`, `stacked-bar.tsx`, `status-icon.tsx`); shared React-PDF infra and dep stay for the other reports | substation | 5 |

Estimated total: ~1.5–2.5 weeks. Workstream 1 is the risk-retirement step — do it first;
if it fails substation's function budget, swap the host to a render service (§3.1
fallback) without changing any library code.

**CRC alignment:** the CRC download button is currently disabled with "PDF generation
moves to cloud in iter-3" (`+page.svelte:2061`). Workstreams 2–4 are exactly the shared
infrastructure that work needs; the CRC PDF should be built directly on this stack as a
second template, never on React-PDF.

## 7. Deltas from current behavior (explicit)

1. **Latency — and it must be owned in the UX.** Download goes from near-instant
   (React-PDF streams) to ~2–5s warm, realistically **5–15s on a cold start** of the
   PDF function. Today's `handleDownloadPdf()` is a bare anchor click — no spinner, no
   disable-on-click — and the cityhall proxy `fetch` has no timeout. At these latencies
   users will multi-click and fire concurrent renders. In scope for workstream 5:
   - **Cityhall handler:** switch from anchor click to a fetch → blob → object-URL
     download (an anchor click gives the page no completion signal, so this is what
     makes a loading state possible). Disable the button + show a spinner while
     in-flight; re-enable on completion; surface a toast on error. Filename logic
     unchanged.
   - **Cityhall proxy:** add an abort timeout (e.g. `AbortSignal.timeout(60_000)`) so a
     hung render doesn't hold the connection open indefinitely; map abort to a 504.
   - **PDF function:** serialize renders per warm instance (a simple in-process
     queue/mutex around the browser). The UI fix stops one user's multi-clicks, but two
     users can still land on the same instance; serialization bounds Chromium memory to
     one render at a time, and the dedicated function (§3.1) already confines any
     queuing delay to PDF traffic.
2. **Typography/layout will not be pixel-identical** — it will be *better* (real
   paged-media layout, RDS type system), but any downstream consumer expecting exact
   page counts or coordinates (none known) would notice.
3. **New production dependency and a second Vercel function:** a Chromium binary lives
   in a dedicated PDF function (`dist/pdf.js`), isolated from the main API function,
   which keeps its current size, memory, and cold-start profile. Ownership: substation.
   Pin `@sparticuz/chromium` to the playwright-core-compatible version.
4. **RDS repo policy:** RDS becomes an externally consumable package (was: isolated).
5. **Not a delta — a hard invariant:** the drift-prone core of the CC document ports
   **by moving code, not rewriting it** — and that core is logic as much as strings.
   All of it is mirrored (in wording or behavior) by cityhall's UI; drift makes PDF and
   UI disagree about a review's triage era, wording, or effective verdicts. The
   move-don't-rewrite list, explicitly (all in
   `substation/src/pdf/completeness-check-document.tsx` unless noted):
   - the cutover constant `CC_VERDICT_TRIAGE_CUTOVER_AT`
     (`src/routes/completeness-check-pdf.ts:48`);
   - every triage-annotation string — legacy five-value and two-axis wording, including
     the D9 rule (a disposition annotation renders only when the *effective* status is
     fail/warn; a disposition retained inert after a verdict flip stays invisible,
     `:170`) and the D11 note-sharing rule (the shared note renders once — on the
     verdict line if overridden, else on the disposition line, `:173`);
   - `getEffectiveStatus(...)` (`:120`) — triage-aware status resolution
     (`verdict_override` ?? agent status, era-gated);
   - `STATUS_GROUP_ORDER` (`:610`) — `fail → warn → uncertain → unclear → pass →
     not-applicable`, driving both group ordering and severity precedence;
   - the conditional Unclear/Uncertain column/chip logic (`showUnclear`/`showUncertain`
     — hidden when their count is zero);
   - the all-N/A section bucketing (`allNa`, `:569`) — dash icon, dimmed row, and the
     "Not applicable for Site Application" divider;
   - `buildUncertainCalloutText` (`src/pdf/components/uncertain-callout.ts`, with its
     test).
   Extract these into a plain-TS module (e.g. `src/pdf/cc-report-logic.ts`) consumed by
   the new template; the extraction diff must be move-only, and the existing
   uncertain-callout test moves with it. Only presentation (React-PDF `StyleSheet`
   trees, layout JSX) is rewritten.
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


## 10. Implementation record (v2.0, 2026-07-16)

Everything below is what actually shipped, where it deviated from the spec, and why.
The spec's sections are left as written (they document the reasoning at decision time);
this section is the delta log.

### 10.1 Runtime pivot: a second Vercel PROJECT, not a second function

§3.1's design — a second tsup entry (`dist/pdf.js`) declared in the `functions` map of
the same Vercel project — is **impossible under the `@vercel/hono` framework preset**.
Empirically (substation PR #155, four deploy experiments):

- Extra `functions`-map entries are silently collapsed into the single app lambda
  (`lambdaRuntimeStats {"nodejs":1}`); path rewrites land in the main app's auth
  middleware.
- ANY `api/` directory (the classic file-system-functions escape hatch, tried in three
  shapes) crashes the preset's builder outright: `Cannot read properties of undefined
  (reading 'readFile')` at buildStep.

**What shipped instead:** a second Vercel project, **`substation-pdf`**, on the same
substation repo. Its env sets `PDF_FUNCTION=1`, which flips tsup's app entry to
`src/pdf-function.ts` (still emitted as `dist/index.js`, so the shared `vercel.ts`
functions config applies unchanged). The main project builds `src/index.ts` exactly as
before. `src/pdf-function.ts` mounts the render route at the IDENTICAL path + auth
middleware as the main API, which makes the cutover a pure base-URL swap.

Consequences:
- The `CC_PDF_RENDERER=rds|react-pdf` flag (§6 workstream 5) moved from "substation
  endpoint swaps its render call" to **cityhall's proxy picks the base URL**
  (`SUBSTATION_PDF_URL` when `CC_PDF_RENDERER=rds`, else `SUBSTATION_URL`). Rollback =
  unset the flag; the legacy renderer keeps running underneath.
- §3.1's memory-provisioning argument is moot: the build warns `memory` config is
  **ignored on Active CPU (Fluid) billing**. The isolation rationale (artifact size,
  cold start, crash blast radius) fully stands.
- Production URL: `https://substation-pdf.vercel.app`. Env needed there: `PDF_FUNCTION`,
  `NPM_TOKEN`, `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  (`SUBSTATION_SERVICE_API_KEY` is NOT needed — it only gates the diligence
  service-route allowlist.)

### 10.2 Chromium lifecycle: launch-per-render, never reuse

§3.1 said "browser-instance reuse across warm invocations is safe here." **It is not.**
On Vercel Fluid, Chromium's subprocesses are reaped/frozen between invocations while
the JS-side `Browser.isConnected()` stays stale — producing a strict 200/500
alternation on sequential requests. The shipped design (`substation
src/pdf/rds-chromium.ts`): **launch per render, close in a finally**, plus the §7.1
per-instance render serialization. This is cheap: `@sparticuz/chromium`'s extraction to
`/tmp` persists per instance, so only the first launch pays ~3s; relaunches are
~40–50ms. Measured on production: 194-comment review ≈ 14s cold end-to-end; warm
renders sub-second server-side for small docs.

Pinning: `playwright-core@1.61.1` ↔ `@sparticuz/chromium@149.0.0` (both Chromium 149).
Keep these in lockstep when bumping.

### 10.3 Packages: `@noetic-inc/*`, publish needs no PAT

- GitHub Packages requires the npm scope to match the org login, so the packages are
  **`@noetic-inc/report-design-system`** and **`@noetic-inc/report-renderer`** (the
  spec's `@noetic/*` names would be rejected at publish).
- Publishing (dsd `Publish RDS Packages` workflow, `workflow_dispatch` with one version
  input stamping both packages in lockstep) uses the workflow's own `GITHUB_TOKEN` with
  `permissions: packages: write` — **no PAT/secret needed to publish**. Consumers need
  `read:packages` auth: substation carries a scoped `.npmrc` reading `NPM_TOKEN`
  (repo Actions secret + env var on BOTH substation Vercel projects; locally
  `gh auth refresh -s read:packages` then `NPM_TOKEN=$(gh auth token)`).
- The design-system package ships a generated **`/assets` submodule** exporting every
  CSS/font layer as strings (`themeCss`, `reportThemeCss`, `stylesCss`, `fontFaceCss`);
  the renderer package's `renderReportPdf` defaults ALL assets (including `modulesCss`)
  from it, so the consumer contract is literally `renderReportPdf(element, { browser })`.
- Packaged-ESM gotcha: the bundle must stay free of CJS globals — the renderer's
  fs-reading asset defaults live in a dsd-only module (`dsd-assets.ts`) precisely so
  `__dirname` never reaches the package (it crashed the first consumer test).
- Both package builds and the render CLI's stage-1 share ONE esbuild config module
  (`dsd web/scripts/render-report/esbuild-config.ts`) per §3.4's anti-drift requirement.

### 10.4 Substation shape: data assembly extracted, not inline

The spec kept the endpoint's fetch logic in place and swapped only the render call
(§5). Because two routes now exist (legacy React-PDF on the main project, RDS on
substation-pdf), the data assembly was extracted move-only into
`src/pdf/cc-report-data.ts`, shared by both — the two renderers cannot disagree about
content by construction. The §7.5 move-only logic module landed as
`src/pdf/cc-report-logic.ts`; the legacy React-PDF document imports from it, so there
is one source of truth during the flag period. The RDS template is
`src/pdf/completeness-check-report.tsx` (author in JSX, not `createElement` — several
RDS components declare required `children`, which `createElement`'s typings reject as
props-only).

### 10.5 §8 open questions — resolved

1. **Cover page: ADDED** (Will sign-off). `ReportCover` with title "Completeness Check
   Report", subject = site plan name, issue date.
2. **Status colors: UI-matching hues**, as new `--rds-status-*` tokens (color/`-bg`/
   `-ink` per level) in `report-theme.css`, selected via `data-status` — a sibling of
   `--rds-sev-*`, not a replacement. New RDS components (dsd#334): `StatusSummary`,
   `StackedStatusBar`, `SectionSummaryTable`, `StatusIcon`,
   `ChecklistFindingGroup`/`ChecklistFinding`, each with gallery samples.
3. **Registry: GitHub Packages** under noetic-inc.

Also resolved: the pass-rate hero computes over APPLICABLE items (N/A excluded from the
denominator).

### 10.6 §9 parity QA — executed and PASSED (2026-07-16)

Method: render the same review through both production endpoints
(`substation.noeticbuild.com` = legacy, `substation-pdf.vercel.app` = RDS) with
`x-service-role-key` auth, then pypdf text-extraction diff of counts and annotation
strings. Results:

- **(a) post-cutover + overrides/notes** — `b38e2619` (9 overrides, 2 notes): all 4
  effective override-annotation sentences byte-identical.
- **(b) pre-cutover legacy 5-value** — `8b34b120` (11 incorrect/na triages): all 10
  legacy annotation sentences byte-identical; fail→N/A fold buckets identically.
- **(c) multi-run uncertain** — Lamar+Collier `e5c5f7ab` (194 comments, 19 uncertain):
  both renders exactly 28 pages, counts 99/7/4/19/65 and every per-section row
  identical, all 19 consensus callouts byte-identical.
- **(e) legacy unclear** — `fc1a16b4`: Unclear chip/column/counts identical.
- **(d) all-N/A sections** and the D9/D11 disposition wordings have no real production
  data yet; covered by the template fixture smoke test (verdict-override bucketing +
  annotation, D11 note placement, all-N/A divider + dimming all verified on synthetic
  props).

### 10.7 Remaining steps + follow-up ideas

1. **Cutover** (Will): set `CC_PDF_RENDERER=rds` + `SUBSTATION_PDF_URL` on cityhall
   prod, redeploy.
2. **Deletion PR** after bake: `completeness-check-document.tsx`,
   `components/stacked-bar.tsx`, `components/status-icon.tsx`, the legacy route + its
   `index.ts` mount, and the flag branch in cityhall's proxy. Shared React-PDF infra
   stays (submission report, resolution plan, SIR).
3. Optional: a cron warmer against the pdf function to shave the 5–15s cold start;
   deterministic seed for the ReportCover contour (currently `Math.random()` — breaks
   byte-level golden testing).

### 10.8 Reuse guide for the CRC PDF (next consumer)

The CRC report ("PDF generation moves to cloud in iter-3", cityhall
`+page.svelte` disabled button) should reuse ALL of this scaffolding — the work is one
template + one route + one proxy path:

1. **New RDS template** in substation (`src/pdf/comment-resolution-report.tsx` or
   similar) composing the SAME packaged components — the `--rds-status-*` vocabulary
   and `ChecklistFindingGroup`/`SectionSummaryTable` were deliberately built
   checklist-generic. If CRC needs new components, add them to dsd's RDS with gallery
   samples and cut a lockstep package version bump (build via `Publish RDS Packages`).
2. **New route** mounted in the EXISTING `src/pdf-function.ts` app (same substation-pdf
   project — no new Vercel project needed), rendering through the existing
   `rds-chromium.ts` (launch-per-render + serialization come free).
3. **Data assembly** as its own `cc-report-data.ts`-style module. If CRC ever needs a
   legacy/flag period, mirror the shared-module pattern; if not, the single RDS route
   suffices.
4. **Cityhall**: enable the disabled CRC download button with the same fetch→blob +
   spinner pattern, proxying to `SUBSTATION_PDF_URL` (the env var already exists after
   CC cutover).
5. Local dev renders: `PDF_CHROMIUM_PATH=<playwright chromium binary>` + fixture props
   through `renderRdsPdfSerialized` — see substation#158's smoke-test approach.
