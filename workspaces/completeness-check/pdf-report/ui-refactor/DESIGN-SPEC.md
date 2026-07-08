# Spec: Porting the CC "Download Report" PDF to the RDS (diligence-report) Styling

**Date:** 2026-07-08
**Status:** Feasibility spec — no implementation yet

## TL;DR verdict

A pure **styling** port is feasible, but only if we keep the current rendering stack
(`@react-pdf/renderer` in substation) and port the RDS *design language* (fonts, colors,
type scale, cover/header/footer treatment) into the existing React-PDF components —
**Option A**, ~2–4 days, zero functional change.

Adopting the actual RDS component/renderer stack (**Option B**) is *not* a styling port —
it's a rendering-stack migration. The RDS renderer is a local CLI built on esbuild + tsx +
Playwright headless Chromium, and substation is a Vercel serverless function. Making that
work in production requires real infra changes (serverless Chromium or pre-generation
via sandbox) plus ~5 new RDS components to reach feature parity. Feasible, ~1.5–2.5 weeks,
but it comes with functional changes that need sign-off (listed below).

---

## 1. Current state

### 1.1 The existing CC PDF pipeline (on-demand, serverless)

| Layer | File | Role |
|---|---|---|
| UI button | `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte:2050` | `handleDownloadPdf()` (line 486) navigates to `…/completeness-check/pdf` |
| Cityhall proxy | `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/completeness-check/pdf/+server.ts` | Auth check, forwards to substation, streams PDF back |
| Substation endpoint | `substation/src/routes/completeness-check-pdf.ts:125-288` | Fetches review + comments + **live triage** from Supabase, renders on demand |
| Renderer | `substation/src/pdf/completeness-check-document.tsx` | `@react-pdf/renderer` (pure-JS Yoga layout — **no Chromium**) |
| Theme | `substation/src/pdf/theme.ts` | Helvetica-only, Tailwind-ish gray ramp, status colors |
| Components | `substation/src/pdf/components/` | logo-header, page-footer, status-icon, stacked-bar, uncertain-callout |

Key properties of the current design:

- **On-demand rendering with live data.** Triage state (`verdict_override`, disposition,
  notes) is fetched at download time — the PDF always reflects the latest human triage.
- **Serverless-safe.** React-PDF is pure JS; runs fine in substation's Vercel function
  (`substation/vercel.ts`: `dist/index.js`, maxDuration 800).
- **Cutover gate.** `CC_VERDICT_TRIAGE_CUTOVER_AT = '2026-07-07T21:00:00Z'` is defined
  byte-identically in substation (`completeness-check-pdf.ts:48`) and cityhall
  (`+page.svelte:106`) and selects legacy five-value vs. new two-axis triage rendering.
  Any port must preserve this exactly.

### 1.2 The new RDS PDF pipeline (local CLI, Chromium)

| Piece | Path |
|---|---|
| Renderer CLI | `dsd/web/scripts/render-report/cli.ts` (4 stages: esbuild bundle → `renderToStaticMarkup` → self-contained HTML w/ base64 fonts → Playwright Chromium `page.pdf()`) |
| Components | `dsd/web/components/report-design-system/` (CSS Modules + `theme.css` / `report-theme.css`) |
| Skill wrapper | `claude-plugins/plugins/noetic-tools/skills/generate-report-pdf/render.sh` |
| Reference doc | `dsd/web/components/report-design-system/CLAUDE.md` |

Key properties:

- **REPORT mode** (flowing CSS paged media, `<ReportDocument>` / `<FlowingSection>`) is the
  right mode for a CC report — it gives named `@page` margin boxes (running header/footer,
  `counter(page)` page numbers, per-section footer labels) and native Chromium pagination.
- **Design language:** Albert Sans + Lora (base64-embedded), RDS tokens
  (`--rds-bright-marine: #0071BD`, `--rds-charcoal-blue: #3D4E59`, `--rds-ink-black: #0D1921`,
  9-stop gray ramp), severity token set, restrained consulting-report chrome.
- **Hard runtime requirements:** Node + esbuild + tsx + Playwright Chromium (~200MB),
  temp-dir filesystem, and a checkout of `dsd/web` (RDS is not published as a package and
  explicitly exports nothing outside dsd). **Designed for local/skill use, not deployment.**

---

## 2. The fundamental mismatch

The two systems differ on the axis that matters most:

| | Current (substation) | RDS (dsd) |
|---|---|---|
| Layout engine | React-PDF / Yoga (pure JS) | Chromium print (CSS paged media) |
| Runs in Vercel function | ✅ today | ❌ not without @sparticuz-style tricks |
| Data freshness | Request-time (live triage) | Render-time (whenever you run the CLI) |
| Component source | In-repo (`substation/src/pdf`) | Cross-repo (`dsd/web`, unpublished, CSS Modules) |
| Styling primitives | `StyleSheet.create` objects | CSS Modules + `@page` rules |

**Nothing style-related transfers mechanically.** React-PDF cannot consume CSS Modules or
`@page` rules; RDS components cannot render under React-PDF. So "port the styling" means
one of two very different projects:

---

## 3. Option A — Restyle in place (recommended; the true "styling port")

Keep `@react-pdf/renderer` and the entire request path unchanged. Rewrite
`substation/src/pdf/theme.ts` + the document components to speak the RDS visual language:

1. **Fonts.** Register Albert Sans + Lora TTFs via React-PDF `Font.register`, replacing
   Helvetica. *Gotcha:* React-PDF doesn't handle variable fonts well — use static-weight
   instances (Regular/Medium/SemiBold/Bold + italics), vendored into substation (fonts are
   OFL-licensed; same families dsd embeds).
2. **Color tokens.** Mirror `theme.css` values into `theme.ts`: bright-marine `#0071BD` as
   the accent (rules, links, hero numbers), charcoal-blue `#3D4E59`, ink-black `#0D1921`
   for headings, the `--rds-gray-*` ramp replacing the current Tailwind grays. Map CC
   statuses onto the RDS severity palette (fail → `sev-significant` red, warn →
   `sev-moderate` amber, uncertain → `sev-data-gap` gray-blue, pass → `sev-none` green,
   n/a → gray).
3. **Chrome.** Restyle `logo-header.tsx` / `page-footer.tsx` to match RDS running chrome:
   document kicker top-left, "Noetic" wordmark top-right, footer label bottom-left,
   `counter`-style page number bottom-right, hairline rules in `--rds-gray-300`. The
   existing wordmark SVG paths can be kept.
4. **Optional cover page.** RDS reports open with a full-bleed `ReportCover`. The CC report
   currently opens directly on the summary page. Adding a cover is a (small) *content*
   change — decide explicitly; parity says skip it or gate it.
5. **Type scale & blocks.** Adopt RDS report-mode sizes/letterspacing for h1/h2/kickers,
   restyle the section table, count chips, stacked bar, status rails, and finding blocks
   to the RDS aesthetic (serif Lora for display headings, sans for body, restrained rules
   instead of filled backgrounds where RDS does that).

**Feature parity: 100% by construction** — same components, same data flow, same
on-demand freshness, same internal links (React-PDF `Link`/anchors already work), same
cutover-gate logic, same filename, no infra change.

**Effort:** ~2–4 days including visual QA against a rendered SIR side-by-side.

**Risks / costs:**
- *Design drift:* tokens are manually mirrored from `theme.css`. Mitigate with a
  `substation/src/pdf/rds-tokens.ts` file whose values are commented as a mirror of
  `dsd/web/components/report-design-system/theme.css`, plus a lint-style note in both.
- *Fidelity ceiling:* React-PDF can approximate but not pixel-match Chromium typography
  (no `letter-spacing` in pt-perfect CSS terms, different line-breaking). Expect
  "same family, obviously siblings," not identical.

**Functional changes required: none.** (Cover page, if added, is the only content-visible
delta and is optional.)

---

## 4. Option B — Migrate to the real RDS renderer

Author a CC report template as a REPORT-mode `pages.tsx`-style component tree and render
through the dsd Chromium pipeline. This buys true shared styling (one design system, zero
drift) but is a stack migration with three sub-decisions.

### 4.1 Component parity gaps (new RDS components needed)

The RDS report-mode vocabulary (FindingBlock, ConstraintMatrix, Callout, KeyValue,
SnapshotTable, SectionHeading, MarkdownBody, SectionRef…) covers most of the CC report,
but these CC features have **no RDS equivalent** and need new components in
`dsd/web/components/report-design-system/`:

| CC feature (current impl) | RDS gap → new component |
|---|---|
| Pass-rate hero % + status **count chips** (`countChip`/`countDot` styles) | `StatusSummary` (or reuse editorial `StatHero` pattern re-cut for report mode) |
| **Stacked status bar** (`components/stacked-bar.tsx`) | Report-mode `StackedStatusBar` (editorial `StackedTimelineBar` exists but is editorial-scoped) |
| **Section results table** with per-status colored counts, status icons, alternating rows, "Not applicable for Site Application" divider row, clickable row links | `SectionSummaryTable` — ConstraintMatrix is the closest cousin but has fixed columns/semantics |
| **Status icons** (check/warning/dash SVGs) | `StatusIcon` |
| **Status-grouped finding list** (colored rail group heads, per-item dot + title + annotation + explanation + refs + resolution) | `ChecklistFindingGroup`/`ChecklistFinding` — `FindingBlock` is severity-taxonomy (significant/moderate/note) and has an implication/nextStep shape that doesn't match CC's triage-annotation shape |
| **CC status taxonomy** pass/fail/warn/uncertain/not-applicable | Extend `report-theme.css` severity tokens with a CC status token set (or map onto existing severities — mapping loses "pass=green ✓" vs "opportunity" distinction, so add tokens) |

Straightforward mappings (no new components): uncertain callout → `Callout
variant="data-gap"`; one-detail-page-per-section → one `FlowingSection` per section with a
unique `id` (unique id ⇒ its own named `@page` ⇒ forced page break + per-section footer
label — exactly CC's current behavior); summary→section internal links → existing anchor
mechanism (`sectionAnchorId`, preserved as PDF GoTo annotations by Chromium); triage
annotation text (legacy + two-axis) and `buildUncertainCalloutText` → port as-is as pure
text helpers.

### 4.2 The runtime problem (pick one)

**B1 — Serverless Chromium in substation (recommended if B).**
Keep on-demand generation. Key insight making this viable: unlike SIRs (agent-authored
`pages.tsx` per report), the CC report is **one fixed template + JSON data** — so the
esbuild/tsx stages of the dsd CLI can happen **at substation build time** (tsup compiles
the RDS components + CSS Modules into the bundle; fonts inlined as base64 at build).
Runtime then only needs: `renderToStaticMarkup(template(data))` → assemble HTML string →
Chromium print. Chromium via `@sparticuz/chromium` + `playwright-core`/`puppeteer-core`
(the standard Vercel pattern, ~50MB, fits Node functions; a 10–40 page CC report is far
below SIR scale). Requires: refactoring the render pipeline's stages 2–4 into a library
function (dsd change), packaging RDS components for consumption outside dsd (see 4.3),
and a build-time CSS Modules plugin for tsup. Latency ~2–5s per download (cold Chromium
launch) — acceptable for a download button.

**B2 — Pre-generate + store.**
Render at CC-workflow completion (in the Vercel Sandbox conductor already runs in — full
Playwright works there) and store in Supabase storage; the button becomes a signed-URL
download. **Functional change:** the PDF no longer reflects live triage. Triage edits
(`verdict_override`, dispositions, notes) happen *after* the run completes, so this
requires regeneration triggers on `comment_triage` writes (debounced), or the report is
stale — a behavior regression users would notice. More moving parts than B1.

**B3 — Dedicated render service.**
A small always-on container (Fly/Railway/VM) with dsd checked out + Chromium, exposing
`POST /render`. Cleanest technically, but it's new infra to own for one endpoint. Only
worth it if RDS-rendered PDFs are about to be needed by more product surfaces (e.g. the
CRC PDF, whose UI button says "PDF generation moves to cloud in iter-3" — if iter-3 lands
a cloud render path anyway, align with that plan instead of building twice).

### 4.3 Cross-repo packaging

RDS today is "isolated by design — no exports outside dsd." Substation consuming it needs
one of: publish `@noetic/report-design-system` (private npm/GitHub package — right answer,
enables CRC + future reports), a git submodule, or a vendored copy (drift, defeats the
purpose). This is a dsd-team decision and a prerequisite for any B variant.

### 4.4 Effort & functional changes

**Effort:** ~1.5–2.5 weeks (5-ish new RDS components + CC status tokens, renderer
libraryization in dsd, RDS packaging, substation integration with serverless Chromium,
port of triage-annotation/cutover/uncertain logic, visual + data QA on pre- and
post-cutover reviews).

**Functional changes to sign off on (user asked to be told):**
1. **Rendering runtime** changes from pure-JS React-PDF to headless Chromium — new binary
   dependency in production (B1), or a data-freshness model change (B2), or new infra (B3).
2. **RDS repo policy change** — RDS must become consumable outside dsd (package/submodule).
3. **dsd renderer refactor** — CLI stages must be callable as a library with a pre-bundled
   template (skips runtime esbuild).
4. **Latency profile** — download goes from ~instant (React-PDF streams) to ~2–5s (B1
   Chromium launch + print). Same order of magnitude, but measurable.
5. Not a change, but a hard requirement: the **cutover-gate constant and legacy/two-axis
   annotation strings must be ported byte-identically** (they're mirrored in cityhall's UI;
   any drift makes PDF and UI disagree about a review's triage era).

---

## 5. Recommendation

- **If the goal is "make the CC report look like the new RDS reports": do Option A.**
  It is the only version of this that is genuinely a UI-styling port-over — feature parity
  is automatic, no functional changes, ~2–4 days, ships independently of dsd.
- **Treat Option B as a separate, deliberate platform decision**, ideally bundled with the
  already-planned CRC "PDF generation moves to cloud in iter-3" work — that's the natural
  moment to pay for RDS packaging + a production render path once, for both report types.
- A sensible sequence: ship A now for immediate visual coherence; fold CC into B when/if
  the CRC cloud-PDF work lands the shared render infrastructure.

## 6. Open questions

1. Should the RDS-styled CC report gain a **cover page** (RDS convention) or keep opening
   on the summary page (current parity)?
2. Status→color mapping: keep CC's green/red/amber/gray exactly, or adopt RDS severity
   hues (which read slightly more muted/editorial)? Affects UI-vs-PDF color consistency,
   since cityhall's web UI uses the current palette.
3. Is the CRC iter-3 cloud-PDF plan far enough along that Option B should just ride it?
