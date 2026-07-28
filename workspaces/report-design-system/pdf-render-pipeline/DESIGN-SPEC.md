# RDS PDF Render Pipeline — How Noetic Generates Branded PDFs (and How to Replicate It)

**Status:** Draft v1 (reference / architecture spec — documents the *existing* implementation)
**Date:** 2026-07-28
**Repos described:** `dsd` (`web/` — the Report Design System + the render pipeline + the two published packages), `substation` (`src/pdf/` — a serverless consumer)
**Repos NOT touched:** none — this spec proposes no changes. It is an onboarding + replication reference.

> **Who this is for.** A new engineer with zero context who needs to understand *how* Noetic turns React components into pixel-consistent, print-native PDFs — and, more importantly, how they would stand up an equivalent pipeline from scratch to produce some *other* similar-feel branded PDF. Product details of the specific reports (Site Intelligence Reports, Completeness-Check reports, etc.) are deliberately out of scope; the mechanics of the rendering engine are the subject.

---

## 0. TL;DR — the one-paragraph version

We author PDFs as **React components** (a small in-house component library called the **Report Design System**, "RDS"). To turn a component tree into a PDF we do **not** run a browser against a live web server. Instead a standalone Node script (1) **esbuild-bundles** the component tree into a single ESM module (compiling CSS Modules to hashed class names and inlining SVG/PNG as data-URIs along the way), (2) runs it through **`react-dom/server`'s `renderToStaticMarkup`** to get static HTML, (3) **assembles one self-contained HTML file** — inlining the theme CSS, the compiled component CSS, and the fonts as base64 `@font-face` data-URIs — and (4) loads that file over `file://` in **headless Chromium (via Playwright)**, emulates print media, waits for fonts, and calls **`page.pdf()`** with `preferCSSPageSize`. Chromium's own print engine does the pagination. The whole thing is packaged as two npm packages so product services can call it serverless with `@sparticuz/chromium`.

---

## 1. Mental model — what this is and is not

**What it is.** A print-native React component library plus a four-stage renderer. "Print-native" means: fixed US-Letter page geometry (816×1056 px @ 96 DPI), typography in `pt`, embedded fonts, real CSS `@page` rules, hand-built SVG charts (no chart library). The output is a PDF that looks *identical* to what Chromium's print preview shows, because Chromium is literally what produces it.

**What it is NOT.** It is not a responsive web UI. Components do not reflow to a viewport. There *is* a web preview surface (a Next.js route), but that exists only for designers to iterate — the actual PDF path never touches a web server.

**Why not `@react-pdf/renderer` / wkhtmltopdf / a paid PDF API?** Those were tried and abandoned (see the historical note in `dsd/web/scripts/render-report/README.md` about "the old frontage flow"). The winning insight: authors want to write normal HTML/CSS/React and get *exactly* what a browser renders. Chromium's print engine is the best HTML-to-PDF renderer in existence and it's free — so the whole design centers on feeding it one perfectly self-contained HTML file and getting out of its way.

**Two consumption surfaces, one foundation:**
- **The dsd CLI** (`scripts/render-report/cli.ts`) — bundles *arbitrary* agent/human-authored `pages.tsx` from anywhere on disk and renders it. This is the iteration/authoring tool.
- **Two published npm packages** (`@noetic-inc/report-design-system` + `@noetic-inc/report-renderer`) — the *precompiled* library + renderer, consumed by product services (e.g. substation) that render PDFs on Vercel serverless.

Both share **one esbuild config** and **one renderer core** so their output can never drift.

---

## 2. Tech stack & external libraries (exact roles)

Everything lives in the **`dsd` monorepo**, under **`web/`** (a Next.js app that also hosts the RDS). Package manager is **pnpm 11**; the render scripts run under **`tsx`** (TypeScript execute).

| Library | Version (as of writing) | Role in the pipeline |
|---|---|---|
| **react / react-dom** | 19.2.x | Components are React. `react-dom/server`'s `renderToStaticMarkup` produces the static HTML (stage 2). React is a **peer dependency** of both published packages — the *consumer* provides it. |
| **esbuild** | ^0.28 | Stage 1 bundler. Bundles a generated entry that imports the report, compiles `.module.css` → hashed class maps + a sibling `bundle.css`, inlines `.svg`/`.png` as data-URIs, resolves the `@/*` path alias. Also builds the two npm packages. |
| **playwright** (full) | ^1.61 | Stage 4 in the **CLI** / local dev. Ships its own Chromium (`npx playwright install chromium`). Drives `page.pdf()`. |
| **playwright-core** | 1.61.x | Stage 4 in the **packages** (peer dep). Ships *no* browser — the consumer injects one (a full Playwright locally, or `@sparticuz/chromium` on serverless). |
| **@sparticuz/chromium** | (in substation) | A brotli-compressed Chromium built to fit in a serverless bundle; extracts to `/tmp` on first use. Used only by serverless consumers. |
| **tsx** | ^4.23 | Runs the TypeScript render scripts directly (`node_modules/.bin/tsx …`). |
| **Next.js** | 16.2.x | Hosts the *preview* surface (the design-system gallery at `localhost:3005/design-system`) and the whitepaper preview routes. **Not used by the PDF path at all.** |
| **CSS Modules** | (via esbuild) | Component-scoped styling. RDS is the *one* subsystem in `dsd/web` that uses CSS Modules instead of Tailwind (deliberate exception — see §4.3). |
| **Variable TTF fonts** | Albert Sans + Lora | Embedded (base64) so the PDF is self-contained and reproducible on any machine. |
| **docx** | ^9 | A *separate* sibling renderer (`scripts/render-docx/`) that emits native Word `.docx` from the same Report-mode component tree. Out of scope here but worth knowing it exists and shares the RDS component vocabulary. |
| **react-markdown / remark-gfm / rehype-raw** | latest | Used *inside* one component (`MarkdownBody`) to render connective narrative markdown (incl. GFM tables) in report styling. |

**Runtime facts that bite you:**
- Node local dev has been on v22/25; the render scripts are plain Node + tsx, not part of `next build`.
- Use **`node_modules/.bin/tsx`** directly, **not `pnpm tsx`** — `pnpm` runs a pre-flight install that trips the repo's `minimumReleaseAge` supply-chain gate.
- pnpm's `allowBuilds` in `pnpm-workspace.yaml` deliberately skips postinstall builds for esbuild/sharp/msw/unrs-resolver so `pnpm <script>` doesn't prompt or fail.

---

## 3. Repository layout (the parts that matter)

```
dsd/web/
├── components/report-design-system/     ← THE DESIGN SYSTEM (source of truth)
│   ├── theme.css                        ← tokens, @font-face, @page, cross-cutting print primitives
│   ├── report-theme.css                 ← the `.rds-report` scoped OVERLAY (report mode)
│   ├── report-chrome.ts                 ← REPORT_CHROME: shared header/footer geometry spec
│   ├── fonts/                           ← AlbertSans + Lora variable TTFs
│   ├── index.ts                         ← public barrel export
│   ├── types.ts / section-anchor.ts / partials/{severity,status}.ts  ← shared types/vocab
│   ├── layouts/     *.tsx + *.module.css   ← full pages (cover, divider, standard, flowing-section, …)
│   ├── partials/    *.tsx + *.module.css   ← composable blocks (badges, charts, tables, findings, …)
│   └── gallery/                         ← screen-only preview chrome + the sample catalog
│       └── samples/{layouts,partials}/  ← one sample file per component (drives the gallery)
│
├── scripts/render-report/               ← THE RENDER PIPELINE
│   ├── cli.ts                           ← CLI wrapper: stage 1 (esbuild) + temp-dir + asset copy + PNG mode
│   ├── esbuild-config.ts                ← the ONE shared esbuild base config
│   ├── bundle-report.ts                 ← generates the render-entry + runs esbuild (stage 1)
│   ├── renderer/                        ← stages 2–4 as an importable library
│   │   ├── render-markup.ts             ← stage 2: element(s) → static markup + @page rules
│   │   ├── assemble-html.ts             ← stage 3: markup + CSS layers → one HTML doc (pure strings)
│   │   ├── print-pdf.ts                 ← stage 4: HTML → PDF via injected Chromium + PRE-PRINT GUARDS
│   │   ├── dsd-assets.ts                ← reads theme/fonts from the source tree (dsd-internal only)
│   │   ├── index.ts                     ← dsd-internal barrel (asset defaults from source tree)
│   │   └── package-entry.ts             ← PACKAGE barrel (asset defaults from the compiled package)
│   └── README.md                        ← the canonical pipeline writeup
│
├── scripts/build-packages/build.ts      ← compiles the two npm packages
├── packages/{report-design-system,report-renderer}/  ← generated package output (gitignored)
└── app/(app)/design-system/…            ← Next.js preview routes (design review only)

dsd/.github/workflows/publish-rds-packages.yml   ← manual workflow_dispatch publish (lockstep versions)

substation/src/pdf/rds-chromium.ts       ← a serverless consumer: launch-per-render + serialize
```

Component authoring conventions live in `dsd/web/components/report-design-system/CLAUDE.md` — the most detailed single doc; read it when actually building components.

---

## 4. The design system

### 4.1 Composition hierarchy

Three tiers, bottom-up:

- **Partials** (`partials/*.tsx`) — the smallest reusable blocks: a `SeverityBadge`, a `BarChart`, a `Table`, a `FindingBlock`. ~50 of them. Each is a `.tsx` + (usually) a colocated `.module.css`. Charts are **hand-built SVG** — no chart library — with shared scale/tick helpers in `partials/_chart-utils.ts`.
- **Layouts** (`layouts/*.tsx`) — full pages or flowing regions that compose partials: `CoverPage`, `SectionDivider`, `StandardPage` (the editorial workhorse), `FlowingSection` (the report workhorse), the six "Site Orientation" figure pages, etc.
- **Pages / documents** (`pages.tsx`, authored per-report, *outside* the RDS) — the actual deliverable. Default-exports either an array of layout elements (editorial) or a single `<ReportDocument>` tree (report). **The RDS never imports a report; reports import the RDS.**

Everything is surfaced through one barrel: `components/report-design-system/index.ts`.

### 4.2 Tokens, theme, and fonts

Two CSS files carry all the cross-cutting design:

- **`theme.css`** (~340 lines) — defines the `.rds-root` token scope: font stacks (`--rds-font-sans`/`--rds-font-serif`), the full color palette (`--rds-gray-*`, brand `--rds-ember`/`--rds-bright-marine`/`--rds-charcoal-blue`, etc.), **page geometry** (`--rds-page-w: 816px`, `--rds-page-h: 1056px`, margins), cross-cutting typography (`.rds-page h1/h2/h3/p`, `.rds-eyebrow`, `.rds-caption`…), and the `@page { size: Letter; margin: 0 }` print rule. Also the `@font-face` blocks and the screen-only "binder" chrome for the gallery.
- **`report-theme.css`** (~500 lines) — a **scoped overlay** entirely under `.rds-report`. It *never* affects editorial output. It overrides type/geometry to read denser, and defines the two domain vocabularies: the six-level **severity palette** (`--rds-sev-*`, with `-bg`/`-ink` variants) and the **status palette** (`--rds-status-*` for pass/fail/warn checklist verdicts). It also carries the load-bearing print-pagination CSS (`box-decoration-break: clone` for per-page body clearance, `break-inside/after: avoid` heading-keep rules, orphan/widow controls, and the report-mode table grid treatment).

**Token discipline:** components reference tokens via `var(--rds-*)` and select variants via **data attributes** (`data-sev`, `data-status`), never hard-coded hex. So one token edit re-themes every component. Example — `SeverityBadge` renders `<span data-sev={level}>` and the CSS module keys `[data-sev='significant'] { color: var(--rds-sev-significant-ink); … }`.

**Fonts** are **variable TTFs** (`AlbertSans-VariableFont_wght.ttf`, `Lora-VariableFont_wght.ttf`) in `fonts/`. Critically, at render time they are **inlined as base64 `@font-face` data-URIs** (see §7.3) so the PDF reproduces identically on any machine with no font install and no network.

### 4.3 Why CSS Modules, not Tailwind

The rest of `dsd/web` is Tailwind. RDS is a deliberate, *bounded* exception (documented in the subsystem CLAUDE.md):
- Print typography needs `pt` units, exact `letter-spacing`, exact `line-height`, and `@page` rules — Tailwind utilities don't express these without reinventing dozens of custom utilities.
- Dense page-bounded layouts read faster with colocated CSS than utility walls in JSX.
- Print designers read CSS fluently.

The exception stays contained: all classes are `rds-*` prefixed (theme.css) or CSS-Module-scoped; RDS never imports from the app's `components/ui|features|patterns`; nothing else imports from RDS.

### 4.4 The shared chrome spec (`report-chrome.ts`)

`REPORT_CHROME` is a plain TS object that is the **single source of truth** for the report-mode running header/footer band: page margins, rule color/width, ink/chrome colors, and the exact font-family/size/weight/letter-spacing for the header kicker, footer label, and page number. It's imported by **two** surfaces that must agree:
1. the renderer, which emits `@page` margin-box CSS from these numbers (§7.2), and
2. the gallery preview, which renders the same band as on-screen DOM.

Colors are **raw hex** here (not tokens) because `@page` margin boxes cannot read CSS custom properties — a hard Chromium constraint. Each hex mirrors a named token; change them together.

---

## 5. Two output modes (editorial vs report)

The renderer auto-detects the mode from the **shape of the report's default export** (an explicit `export const mode = 'report' | 'editorial'` overrides):

| Default export | Mode | Pagination | Running chrome | Scope class |
|---|---|---|---|---|
| `ReactNode[]` (array) | **Editorial** | Hand-placed — one element = one fixed 816×1056 `.rds-page`; `page-break-after` between them; `@page { margin: 0 }` | Per-page `StandardPage` header/footer *in the DOM* | `.rds-root` |
| single React element (`<ReportDocument>…`) | **Report** | **Native** — Chromium paginates the flowing body across N pages | Named `@page` **margin boxes** emitted by the renderer | `.rds-root .rds-report` |

Editorial = marketing white papers (generous type, hand-laid pages). Report = consulting/diligence documents (denser, flows automatically, per-section running footers). Editorial output is byte-for-byte unaffected by the report overlay.

**The report-mode connection to the renderer is via data attributes.** `<ReportDocument>` renders `<div data-rds-document="report" data-rds-kicker="…" data-rds-brand="…">`. Each `<FlowingSection>` renders `<section class="rds-flow" data-rds-page-name="s1" data-rds-section-label="SITE & ZONING" data-rds-section-number="1" style="page: s1; break-before: page">`. The renderer scans the produced markup for these attributes and *generates the `@page` rules from them* (§7.2). This is the crux of report mode — the running header/footer is not DOM, it's generated CSS keyed off the markup.

---

## 6. Building & previewing the design system locally

This is the **authoring loop** — how you iterate on components before rendering a PDF.

1. **Run the Next.js dev server:** `cd dsd/web && pnpm dev` → `http://localhost:3005`.
2. **The gallery** — `http://localhost:3005/design-system` — renders **every** layout and partial with sample content, on a gray "binder" backdrop, with off-page template labels. This is the primary design-review surface.
3. **Partials catalog** — `http://localhost:3005/design-system/partials`.
4. **A specific paper** — `http://localhost:3005/design-system/whitepapers/<slug>` (editorial), and `…?print=1` to strip the binder/labels and see a print-faithful view.
5. **Hot reload:** edit a `.tsx`/`.module.css`, save, the gallery updates.

**The sample catalog is self-contained.** The gallery reads from `gallery/samples/` — one file per layout and per partial, aggregated by `gallery/samples/index.ts` into `layoutSampleGroups` / `partialSampleGroups`. The RDS does **not** import any real report, so reports can change without breaking previews.

**Adding a partial (the concrete recipe):**
1. Create `partials/<name>.{tsx,module.css}` (use `_chart-utils.ts` if it needs scales).
2. Export it from `index.ts`.
3. Add `gallery/samples/partials/<name>.tsx` exporting a `<name>Samples` array, wrapped in `PartialFrame`.
4. Register the group in `gallery/samples/index.ts`.
5. Document props in the subsystem `CLAUDE.md`.

**Note the preview and the PDF are two different render paths.** The gallery uses Next.js + on-screen media; the PDF path (§7) is server-free and uses print media + Chromium. They share the *components and CSS* but not the *rendering harness*. `REPORT_CHROME` is what keeps the report-mode running band identical between the two.

---

## 7. The four-stage render pipeline (the heart of the system)

Entry point for iteration: the CLI.

```bash
cd dsd/web
node_modules/.bin/tsx scripts/render-report/cli.ts \
  --report <abs path to pages.tsx> \
  --out    <abs out.pdf> \
  [--keep-tmp] [--debug]
# PNG mode (editorial only): --png <outDir> [--basename <name>]  → per-page 2× PNGs
```

`cli.ts` is a **thin wrapper**: it owns stage 1 (bundling arbitrary on-disk `pages.tsx`), temp-dir management, sibling-asset copying for `file://`, and PNG mode. Stages 2–4 live in `renderer/` as an importable library shared with the published packages.

### Stage 1 — esbuild bundle (`bundle-report.ts` + `esbuild-config.ts`)

The renderer must run the report's React code in Node, but that code imports CSS Modules, SVGs, and uses the `@/*` path alias — none of which Node understands. So we bundle first.

`bundle-report.ts` writes a tiny generated **entry file** to the temp dir:
```ts
import pages from "<abs report path>";
export default pages;
export * as RDS from '@/components/report-design-system';
```
(The `export * as RDS` re-export is load-bearing for the *DOCX* walker, which dispatches on component identity — it must compare against the *same* bundled instances. Harmless for PDF.)

Then esbuild bundles it with the shared base config (`rdsEsbuildBase()`):
```ts
{
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'],  // provided by the host process
  alias: { '@': <web root> },
  loader: { '.ttf': 'file', '.svg': 'dataurl', '.png': 'dataurl' },
  logLevel: 'silent',
}
```
Key effects:
- esbuild compiles every `*.module.css` import into a **hashed classname map** and **concatenates all the CSS into a sibling `bundle.css`** automatically (same basename as the JS outfile).
- SVG/PNG imports become **inline data-URIs** → the JS bundle is self-contained for images imported through the module graph.
- `react`/`react-dom` are kept **external** so the CLI process and the bundle share *one* React instance (required — some layouts use hooks like `useMemo`, and mismatched React copies break hooks). This is also why the temp dir lives *inside* `web/` — so the external `react` resolves from `web/node_modules`.

Output: `bundle.mjs` + `bundle.css` in the temp dir.

### Stage 2 — render to static markup (`render-markup.ts`)

The CLI dynamically `import()`s `bundle.mjs`, reads `mod.default` (or `mod.pages`) and optional `mod.mode`, and calls `renderReportMarkup(exported, { explicitMode })`.

- **Editorial:** each array item is wrapped and run through `renderToStaticMarkup`, the outer `<div>` stripped, and the pages joined. `pageRules = '@page { size: Letter; margin: 0; }'`.
- **Report:** the single `<ReportDocument>` tree is rendered once. Then `buildReportPageRules(markup)` (§7.2) derives the `@page` CSS from the data attributes in the produced HTML. Root class becomes `rds-root rds-report`. `documentKicker` is extracted from `data-rds-kicker` for the pre-print fit guard.

Returns a `RenderedReport`: `{ mode, body, rootClass, pageRules, needsReportTheme, documentKicker }`.

### Stage 2.5 (report mode) — generating the `@page` rules (`buildReportPageRules`)

This is the trick that makes report-mode running headers/footers work. Empirically in Chromium print:
- `position: fixed` repeats per page but **does not reserve space** (body overlaps it) and **can't carry a per-section label** → unusable for the running band.
- **Named `@page` margin boxes are the only reliable mechanism**: they reserve their own space (body never overlaps), repeat on every page, support a static per-section label, and `counter(page)` increments correctly inside them.

So for each `[data-rds-page-name]` (one per `FlowingSection`) the renderer emits, using `REPORT_CHROME` geometry/type:
```css
@page <name> {
  size: Letter;
  margin: <marginTop> <marginX> <marginBottom>;
  @top-left     { content: "<document kicker>"; …type…; border-bottom: <rule>; }
  @top-center   { content: ""; border-bottom: <rule>; }   /* keeps the rule spanning */
  @top-right    { content: ""; border-bottom: <rule>; }
  @bottom-left  { content: "<n>  ·  <section label>"; …; border-top: <rule>; }
  @bottom-center{ content: ""; border-top: <rule>; }
  @bottom-right { content: counter(page); …; border-top: <rule>; }
}
```
Plus a full-bleed `@page rds-feature { margin: 0 }` (cover/divider pages carry `.rds-report-feature { page: rds-feature }`), a bespoke `@page rds-contents-flow` for the multi-sheet TOC (mirrors margins but suppresses the band + page number), and a sane default `@page` fallback.

Hard constraints baked into these rules and worth remembering:
- The hairline rule that spans the band is **each margin box's own `border-top`/`border-bottom`** (left+center+right each carry it) — there is no single element to draw across.
- The SVG logo **cannot render in a margin box**, so the header uses the *text* wordmark ("Noetic"); feature pages (which use full layout) still use the SVG.
- Margin boxes **can't read CSS variables** (hence raw hex in `REPORT_CHROME`), and have **no wrap/clip/ellipsis** (hence the kicker fit guard in §8).

### Stage 3 — assemble one self-contained HTML file (`assemble-html.ts`)

`assembleReportHtml(rendered, { modulesCss, assets, body? })` is **pure string assembly** (no filesystem — it's bundled into the pure-ESM package). It emits:

```html
<!doctype html><html><head><meta charset="utf-8"><style>
  <fontFaceCss>            ← @font-face with TTFs as base64 data-URIs
  <themeCss minus @font-face>   ← theme.css, original @font-face blocks stripped (they point at ./fonts/*.ttf)
  <reportThemeCss>         ← only when needsReportTheme (report mode)
  <modulesCss>            ← the esbuild bundle.css (compiled CSS Modules)
  <rendered.pageRules>    ← the @page rules from stage 2/2.5
  html,body{margin:0;padding:0}
  body{-webkit-print-color-adjust:exact; print-color-adjust:exact}
</style></head>
<body><div class="<rootClass>"><body markup></div></body></html>
```

The **asset inputs are injected**, not read here — that's what lets the *same* assemble code run in the dsd CLI (assets from the source tree via `dsd-assets.ts`) and in the published package (assets precompiled). `dsd-assets.ts` provides the dsd defaults: it reads `theme.css`/`report-theme.css` and builds the `@font-face` CSS by base64-encoding the two TTFs (`buildFontFace()` — `font-display: block`, weight ranges `100 900` / `400 700`).

### Stage 3.5 (CLI only) — sibling assets for `file://`

A report may reference **root-relative public assets** (`/report-design-system/logo.svg`, divider topo backgrounds) or **report-relative** ones (`figures/x.jpg`). Over `file://`, a leading `/` resolves to the *filesystem* root, not the temp dir. So `cli.ts`:
1. scans the markup for `src|href|url(...)` refs ending in an image extension (skipping `http(s):`/`//`/`data:`),
2. resolves each against the public roots (`web/public`, then `frontage/public`) or next to the report file,
3. **copies** matches into the temp dir (flattening any `..`), and
4. **rewrites** the URL to a relative `./…` path.

Missing assets warn but don't fail. (Images imported through the JS module graph are already data-URIs from esbuild and never hit this path.)

The assembled `report.html` is written into the temp dir alongside the copied assets.

### Stage 4 — print to PDF (`print-pdf.ts`)

`printPdf(source, { browser, documentKicker?, assertFit?, scale? })` — **the browser is injected** (caller owns its lifecycle). Steps:
1. `browser.newPage()`.
2. Load: `{ htmlFile }` → `page.goto(file://…, { waitUntil: 'networkidle' })` (CLI, has sibling assets); or `{ html }` → `page.setContent(html, { waitUntil: 'networkidle' })` (packages, fully inlined).
3. `page.emulateMedia({ media: 'print' })`.
4. `await page.evaluate(() => document.fonts?.ready)` then `page.waitForTimeout(400)` — fonts must be loaded or text metrics (and the fit guard) are wrong.
5. **Pre-print guards** (§8): `assertKickerFits` if a kicker exists; `assertNoOverwideContent` if `assertFit`.
6. `page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true, margin: {0,0,0,0}, …scale? })` → returns PDF bytes.
7. `page.close()` in `finally`.

`preferCSSPageSize: true` tells Chromium to honor the document's own `@page { size }` rather than the `format`. Zero margins because all real margins come from the `@page` rules (report) or are baked into fixed pages (editorial).

`index.ts` also exposes a one-call convenience `renderReportPdf(exported, { browser, modulesCss, assets? })` chaining stages 2→3→4 for fully-inlined documents (the package path).

---

## 8. Chromium print gotchas & the pre-print guards (hard-won)

Two failure modes are silent — Chromium ships a broken-looking PDF with no error — so the renderer detects them in the *same* Chromium instance, *before* printing, and **throws**:

**(a) Whole-document shrink-to-fit (`assertNoOverwideContent`).** Chromium's print pipeline scales the **entire** document down uniformly the instant **any single element** is wider than its page box (a 10pt body has been observed collapsing to ~6pt) — no error, no flag. Trigger classic: a dense table cell holding a long unbreakable string (URL, parcel/permit ID). The guard: force the body to the print content-box width, walk every element, and throw (naming the offender + overflow px) if any element's right edge exceeds the flow budget (~653px) / feature budget (816px), or pokes past the left edge. It skips inner-SVG geometry and content clipped by an ancestor, plus a `body.scrollWidth` catch-all for bare overflowing text nodes. Escape hatch: `data-rds-allow-overwide` exempts an element **only for false positives** — it does *not* make a real overflow safe.
  - The CSS defenses that keep this from firing in the first place live in `report-theme.css`: `.rds-report { overflow-wrap: anywhere }` and `img,svg { max-width:100%; height:auto }`. **Fix overflow at the scope level, never with per-element patches.**

**(b) Kicker bleed (`assertKickerFits`).** The `@top-left` margin box carrying the document kicker is `white-space: nowrap` and print margin boxes have **no** wrap/clip/ellipsis — an overlong kicker silently bleeds off the right edge of *every* page. The guard measures the kicker with the *exact* embedded font/weight/tracking in the *same* Chromium, against the real available width (page width minus side margins, measured via CSS `in` units), and throws with a suggested max length. Rule of thumb: ~90 chars.

Other baked-in facts (from the subsystem CLAUDE.md / README):
- **SVG `<text>` needs explicit `fontFamily`/`fontSize`/`fontWeight`** attributes — Chromium's print path doesn't reliably cascade CSS font-family into SVG text.
- Internal section links (`sectionAnchorId()` → `#sec-8.1`, `<SectionRef>`, markdown `[§8.1](#sec-8.1)`) **do** survive as clickable GoTo annotations in the PDF — verified, not assumed.
- The Playwright-serialized `page.evaluate` callback must avoid named function expressions — tsx/esbuild wraps them in a `__name(...)` helper that isn't defined in the browser, throwing `ReferenceError: __name is not defined`. Hence the inline/labeled-loop style in `print-pdf.ts`.

---

## 9. Packaging & publishing (the two npm packages)

To let product services render without vendoring the source, `scripts/build-packages/build.ts` compiles two packages (output under `web/packages/`, gitignored, generated fresh each build):

**`@noetic-inc/report-design-system`** — the compiled component library:
1. esbuild the barrel `index.ts` → `dist/index.js` + a sibling CSS bundle renamed to `dist/styles.css`.
2. `tsc` emits `.d.ts` type declarations.
3. Copy `theme.css`, `report-theme.css`, and `fonts/` verbatim.
4. Generate `dist/assets.js` — every CSS/font layer as **importable strings** (`themeCss`, `reportThemeCss`, `stylesCss`, `fontFaceCss`) so a consumer does zero asset wiring. (`fontFaceCss` is the base64 `@font-face`.)
5. Emit `package.json` (exports `.`, `./assets`, `./styles.css`, `./theme.css`, `./fonts/*`; **react/react-dom are peer deps**).

**`@noetic-inc/report-renderer`** — stages 2–4 behind `package-entry.ts`:
1. esbuild `package-entry.ts` → `dist/index.js`, with `playwright-core` and `@noetic-inc/report-design-system` kept **external** (real deps at the consumer). `REPORT_CHROME` is bundled in (safe — the renderer pins its exact design-system version, so geometry can't drift from the shipped CSS).
2. `tsc` types.
3. `package.json`: `dependencies` pins the design-system to the **exact** version; peer deps `react`, `react-dom`, `playwright-core`.

The `package-entry.ts` barrel is why consumers do zero wiring: it defaults all CSS/font assets to `@noetic-inc/report-design-system/assets`, so the contract is literally *import components, call `renderReportPdf(element, { browser })`*.

**Publishing:** manual GitHub Actions `workflow_dispatch` (`publish-rds-packages.yml`) with one `version` input that stamps **both** packages (they move in **lockstep**). Publishes to **GitHub Packages** (`npm.pkg.github.com`, scope `@noetic-inc`) using the workflow's own `GITHUB_TOKEN` (`packages: write`). No git tags — the registry version is the source of truth. (The `release-rds` personal skill recommends the semver bump; consumers need a `read:packages` token to install.)

---

## 10. Serverless deployment (how a product service renders on Vercel)

Reference implementation: `substation/src/pdf/rds-chromium.ts`. The consumer imports `renderReportPdf` from `@noetic-inc/report-renderer`, provides a `playwright-core` browser, and passes a React element. Two hard-won rules:

1. **Launch a fresh browser per render.** A browser reused across Vercel **Fluid** invocations has its subprocesses reaped between requests while `isConnected()` stays stale → strict 200/500 alternation. Launching fresh is cheap: `@sparticuz/chromium` extracts to `/tmp` once per instance (~3s first launch, ~40–50ms after).
2. **Serialize renders per warm instance** so concurrent invocations on the same instance can't stack Chromium processes.

```ts
// on Vercel:
const sparticuz = (await import('@sparticuz/chromium')).default;
const browser = await chromium.launch({           // chromium from 'playwright-core'
  executablePath: await sparticuz.executablePath(),
  args: sparticuz.args,
  headless: true,
});
try { return await renderReportPdf(element, { browser, scale }); }
finally { await browser.close(); }
// locally: chromium.launch({ executablePath: process.env.PDF_CHROMIUM_PATH, headless: true })
```

The optional `scale` (0.1–2) is an opt-in per-call knob to correct an environment-specific print-scale difference (`@sparticuz/chromium` can render slightly smaller than a full Chromium); omit for 1:1, which is every report by default. Note `playwright-core` ships **no** browser — locally you point `PDF_CHROMIUM_PATH` at a Chromium from a full Playwright install.

---

## 11. How to replicate this from scratch (a different look & feel)

This is the payoff. To stand up an equivalent pipeline for some *other* branded PDF:

**A. Component library (the design layer)**
1. Create a React component package. Pick your unit system: fixed full-bleed pages (editorial) and/or a single flowing document (report). Decide page size (`@page { size }`) and DPI mapping (we use US-Letter = 816×1056 px @ 96 DPI).
2. Write **one theme CSS** with: `@font-face` for your fonts, a `.root` token scope (font stacks, palette, page geometry as CSS vars), cross-cutting typography, and a base `@page` rule. If you want a second denser "mode," add a scoped overlay (`.report {…}`) so it can't touch the first.
3. Author components with **colocated CSS Modules**, selecting theme variants via `data-*` attributes + `var(--token)` (never hard-coded color). Build charts as hand-rolled SVG if you want zero chart-lib weight; **put explicit font attributes on every SVG `<text>`**.
4. If you need per-page running headers/footers on a *flowing* document, do **not** use `position: fixed`. Emit **named `@page` margin boxes** from a small shared geometry spec (our `REPORT_CHROME`), keyed off `data-*` attributes your section component renders. Remember margin boxes can't read CSS vars (use raw hex) and can't wrap text (guard length).

**B. Render pipeline (the four stages)**
1. **Bundle** the report entry with **esbuild**: `platform:'node'`, `format:'esm'`, `jsx:'automatic'`, `react`/`react-dom` **external**, a path alias for your imports, and loaders `{ '.module.css': (built-in) , '.svg':'dataurl', '.png':'dataurl' }`. esbuild emits a sibling `.css` with your compiled CSS Modules — capture it.
2. **Render** the bundle's default export through `renderToStaticMarkup`. If you support a flowing mode, scan the markup and generate your `@page` rules here.
3. **Assemble one self-contained HTML file**: inline the `@font-face` (fonts as **base64 data-URIs** — this is what makes output reproducible), the theme CSS (strip its file-referencing `@font-face`), the compiled module CSS, and the `@page` rules, wrapped in your root scope div.
4. **Print** with **Playwright Chromium**: load the HTML (`setContent` for fully-inlined, or `goto(file://)` if you have sibling assets), `emulateMedia({media:'print'})`, `await document.fonts.ready`, then `page.pdf({ format, printBackground:true, preferCSSPageSize:true, margin:0 })`.

**C. Guardrails (don't skip these)**
- Add an **over-wide element guard** before printing (§8a) — Chromium's silent shrink-to-fit will otherwise ship subtly-broken PDFs. Set `overflow-wrap: anywhere` + `img/svg { max-width:100%; height:auto }` at the scope level as the first line of defense.
- If you use nowrap margin-box text, add a **fit guard** (§8b).

**D. Distribution**
- For serverless, inject the browser and use **`@sparticuz/chromium` + `playwright-core`**; **launch per render** and **serialize** (§10).
- Package the library + renderer separately, keep React a **peer dependency**, ship CSS/fonts as importable strings so consumers do zero wiring, and version them in lockstep.

**Minimum viable clone** (no packages, no serverless, one mode): steps A1–A3 + B1–B4 in a single `tsx` script is ~200 lines and renders a PDF. Everything else (report mode, margin boxes, packages, guards, serverless) is additive.

---

## 12. Key file reference

| Concern | File |
|---|---|
| Pipeline overview (canonical) | `dsd/web/scripts/render-report/README.md` |
| Component authoring (canonical) | `dsd/web/components/report-design-system/CLAUDE.md` |
| CLI entry / stage 1 wrapper / asset copy / PNG | `scripts/render-report/cli.ts` |
| Shared esbuild config | `scripts/render-report/esbuild-config.ts` |
| Bundle step | `scripts/render-report/bundle-report.ts` |
| Stage 2 + `@page` generation | `scripts/render-report/renderer/render-markup.ts` |
| Stage 3 HTML assembly | `scripts/render-report/renderer/assemble-html.ts` |
| dsd asset loading (theme/fonts) | `scripts/render-report/renderer/dsd-assets.ts` |
| Stage 4 print + guards | `scripts/render-report/renderer/print-pdf.ts` |
| dsd-internal barrel / one-call | `scripts/render-report/renderer/index.ts` |
| Package barrel (zero-wiring) | `scripts/render-report/renderer/package-entry.ts` |
| Package build | `scripts/build-packages/build.ts` |
| Publish workflow | `dsd/.github/workflows/publish-rds-packages.yml` |
| Tokens / geometry / fonts | `components/report-design-system/theme.css`, `report-theme.css`, `report-chrome.ts`, `fonts/` |
| Report-mode roots | `components/report-design-system/layouts/{report-document,flowing-section}.tsx` |
| Example partial (token+data-attr pattern) | `components/report-design-system/partials/severity-badge.{tsx,module.css}` |
| Serverless consumer | `substation/src/pdf/rds-chromium.ts` |

---

## Open questions / notes for the reader

1. **Q1 — Editorial deprecation?** Editorial mode (`ReactNode[]`) predates report mode and several of its whitepapers still live in a separate `frontage/` repo. This spec documents both, but new work is almost entirely report mode. Not a blocker for replication.
2. **Q2 — DOCX sibling.** `scripts/render-docx/` renders the *same* report-mode component tree to native `.docx` (via the `docx` lib, no Chromium). Documented separately; it's why `bundle-report.ts` re-exports the `RDS` namespace (component-identity dispatch).
3. **Q3 — Fonts are variable TTFs inlined as `truetype` (not `woff2`).** Base64 TTF inlining is heavier than woff2 but maximally compatible with Chromium's print engine; a from-scratch clone could try woff2 to shrink the HTML.
