# SIR §5 render pipeline — four asset/DOCX/appendix defects surfaced by the grocery-atlanta run

> **Status:** Diagnosed 2026-08-07 on a completed SIR run of **`noetic/grocery-atlanta`**. Four independent §5 render-pipeline defects fired on one run; three have fixes cut as draft PRs (bureau [#982](https://github.com/noetic-inc/bureau/pull/982), dsd [#564](https://github.com/noetic-inc/dsd/pull/564)), and a fourth (visible HTML-comment leakage) was worked around per-report and is flagged OPEN for a systemic fix. None is a `grocery-atlanta`-specific data defect — each is a code defect in the render pipeline that this run happened to exercise because its report carries an object-form figure, an in-content `<img>` plate, and provenance-commented appendix markdown. A fifth issue (the rollup requiring the downstream Publish gate — a lineage cycle) also fired and is **already documented in the sibling `ROLLUP-REQUIRES-DOWNSTREAM-PUBLISH-GATE.md`**; this run confirms it firsthand but does not re-document it here.

## Summary

The §5 render pipeline takes the composed report source (`pages.tsx` + `figures/` + appendix markdown) and produces the two client deliverables — the PDF (5.3) and the Word doc (5.5) — with a layout-scrub gate (5.4) walking the rendered PDF in between and a rollup (5.6) assembling the split. Running it end to end on `grocery-atlanta` lit up four defects that each live at a different seam of that pipeline:

1. **Asset scanner misses object-form `src:`** — the staging regex only saw JSX `src="…"` attributes, so an object-only figure never staged and 5.3 printed a **hole** where the concept-plan plate should be. Fix: bureau [#982](https://github.com/noetic-inc/bureau/pull/982).
2. **Page-map PDF path resolved against the run-dir** — 5.4's `check_layout` looked for the rendered PDF one directory too high, walked **zero pages**, and the run needed a transient symlink to proceed. **Already fixed on `main`** (bureau `3930d8dbb`, #931); confirmed still-correct against this run.
3. **DOCX renderer throws on a bare `<img>` in block context** — 5.5's Word render **hard-failed (exit 1)** on an in-content image plate the PDF renderer accepts without complaint. Fix: dsd [#564](https://github.com/noetic-inc/dsd/pull/564).
4. **`MarkdownBody` renders HTML comments visibly** — the contractually-required `<!-- source: … -->` provenance comments printed as **visible gray text** on every appendix Part page, leaking internal repo paths to the client. Worked around per-report by stripping comments from the appendix feed; **systemic fix OPEN** (no PR yet).

What is **working correctly** across all four: the pipeline's gates made every one of these loud rather than silent. 5.3 recorded `assets: missing`; 5.4's whole reason to exist is to walk what the client opens, and it is where #2 and #4 were caught; 5.5 failed hard rather than shipping a half-rendered Word doc. The defects are in the render/scan/map code, not in the run data, and none corrupted a downstream figure or citation.

## The four bugs in one diagram

```
COMPOSED SOURCE (5.1/5.2)                     §5 RENDER PIPELINE                         DELIVERABLE
─────────────────────────                     ─────────────────                         ───────────
pages.tsx
  FullBleedFigurePage image={{src:'…png'}} ─┐
  FigureGridPage figures={[{src:'…png'}]}  ─┤ (1) report_source._IMAGE_REF_RE
                                            │     matches src="…" only  ──►  asset NOT staged
                                            │                                     │
                                            └───────────────────────────────►  5.3 PDF: HOLE  ✗ assets:missing
figures/*.png ───────────────────────────────► 5.3 render ──► page-map.json {"pdf":"…report.pdf"}  (BARE name)
                                                                     │
                                              (2) 5.4 check_layout resolves BARE name
                                                  against run-dir, not run-dir/5.3-step ──►  0 pages walked  ✗
                                                  [FIXED on main #931 — resolves against render step]
appendix .md
  <!-- source: output/4.1-disciplines/zlu.md -->
  ...prose...  <img src="figures/x.png" />  ─┐
                                            │ (3) DOCX blockFromIntrinsic: <img> not in
                                            │     allowlist ──► throw ──► 5.5 EXIT 1  ✗
                                            │     [FIX dsd #564: case 'img' -> imageParagraph]
                                            │
                                            └ (4) MarkdownBody prints the <!-- source --> comment
                                                  as VISIBLE gray text ──► client sees repo paths  ✗
                                                  [worked around per-report; systemic fix OPEN]
```

The pattern across all four: the render pipeline was written against the JSX-attribute / text-tag / clean-markdown shapes it usually sees, and this report carried the three legal-but-less-common shapes (object-form figure prop, in-content `<img>` plate, provenance-commented markdown) that each seam had never been hardened against.

---

# Bug 1 — Asset scanner misses object-form `src:`, holing the concept-plan page

**Fix: bureau PR [#982](https://github.com/noetic-inc/bureau/pull/982).**

## Symptom (as observed)

- **Run:** `noetic/grocery-atlanta`, step `5.3-render-pdf`.
- **What the run recorded:** the render's asset manifest reported `assets: missing` for the concept-plan figure; the rendered PDF printed that full-bleed page as a **hole** (the caption/kicker chrome present, the image absent).
- **Tempting-but-wrong first guess:** "the figure file is missing from `figures/`." It is not — the PNG is on disk and every other figure on the page staged. The scanner simply never *saw* this figure's `src`, because of how the figure declares it.

## Evidence chain

1. **The staging scanner matched attributes only.** `bureau/pipelines/sir/lib/report_source.py`'s `_IMAGE_REF_RE` required `=` as the separator:
   `(?:src|href|poster)\s*=\s*["'](…\.(?:svg|png|jpe?g|gif|webp))["']`. That matches the JSX **attribute** form `src="figures/x.png"`.
2. **RDS figure components take their image as an object property, not an attribute.** `dsd/web/components/report-design-system/layouts/figure-grid-page.tsx` types the figure as `{ src: string; alt: string }` and is fed `figures={[{ src: 'figures/x.png', … }]}`; `full-bleed-figure-page.tsx` takes `image={{ src: 'figures/x.png', alt }}`. In the source these read as `src: '…'` — an **object property**, with a colon, never an `=`.
3. **So an object-only figure never staged.** A page whose only image reference is object-form (the concept-plan plate, rendered via `FullBleedFigurePage`) contributed **no** match to `_IMAGE_REF_RE`, the asset never copied into the render's staging dir, and 5.3 drew the page with nothing to place.
4. **Only object-only pages were hit.** Pages that also carried an attribute-form `src="…"` somewhere staged that asset and masked the gap; the defect is visible precisely on the page whose sole image is object-form.

## Root cause

`_IMAGE_REF_RE` encoded an assumption — "image references are JSX attributes" — that is false for every RDS figure component, all of which pass the image as a prop **object**. The scanner and the components disagreed about the one syntactic detail (separator `:` vs `=`) that the scanner keys on, and nothing tied them together, so a whole class of figure was invisible to asset staging.

## Impact

- **Deterministic** for any report page whose only image reference is object-form (`FigureGridPage` / `FullBleedFigurePage` with no co-located attribute `src`). On `grocery-atlanta` that was the concept-plan plate.
- **Loud, not silent:** 5.3 recorded `assets: missing`, so the hole was attributable — but it still shipped into the rendered PDF and would have reached 5.4's eyeball pass.
- No downstream corruption: the figure file, its caption, and its citation are all intact; only the copy-into-staging step skipped it.

## Fix direction (implemented in PR #982)

Accept **both** separators: change `\s*=\s*` to `\s*[:=]\s*`. The pattern still requires an image extension and surrounding quotes, so it only **adds** matches (object-form `src:`), never drops a previously-staged attribute asset. Verified: `src="figures/x.png"`, `{ src: 'figures/concept-plan.png' }`, and `image={{ src: "figures/aerial.jpg" }}` all match; `href="notes.txt"` (non-image) does not.

A more principled but larger fix would have the composer emit a machine-readable asset manifest rather than re-scanning the rendered `pages.tsx` with a regex; the regex widening is the contained fix and is what shipped.

## Reproduction / verification

1. Author a `pages.tsx` with a `FullBleedFigurePage image={{ src: 'figures/plate.png', alt: '…' }}` (or a `FigureGridPage` with only object-form `src:`) and no attribute-form `src="…"` for that image.
2. Run 5.3 render on `main` (pre-#982): the render reports `assets: missing` and prints the plate as a hole.
3. With #982 applied: `_IMAGE_REF_RE.findall("image={{ src: 'figures/plate.png' }}")` returns `['figures/plate.png']`, the asset stages, and the plate renders.

---

# Bug 2 — Page-map PDF path resolved against the run-dir (0 pages walked) — ALREADY FIXED on main

**Already fixed on `main` by bureau `3930d8dbb` ("sir pipeline: four defects found running a real SIR end to end", #931). This run confirmed the fix is present and correct; no new PR.**

## Symptom (as observed)

- **Run:** `noetic/grocery-atlanta`, step `5.4-layout-scrub`.
- **What was observed:** `check_layout` reported the rendered PDF **not on disk** and walked **zero pages**, even though 5.3 had produced the PDF at `output/5.3-render-pdf/site-intelligence-report.pdf`. The run was unblocked with a **transient symlink** from the run-dir root to the render-step PDF — an operator workaround, not a fix.

## Evidence chain

1. **5.3 writes a BARE filename into the page map.** `pdf_probe.build_page_map` records `pdf_path.name` — `"site-intelligence-report.pdf"`, no directory part — because the deliverable's name is fixed. `page-map.json` therefore reads `"pdf": "site-intelligence-report.pdf"`.
2. **5.4 resolved that bare name against the wrong base.** The historical `check_layout` did `pdf = run_dir / pdf_rel`, i.e. `<run>/site-intelligence-report.pdf` — but the PDF lives at `<run>/output/5.3-render-pdf/site-intelligence-report.pdf`. The file was one directory too high to find.
3. **`check_layout` already knew the render step's location.** It defines `RENDER_STEP = "output/5.3-render-pdf"` (used to locate `page-map.json` itself), so the correct base was already named in the file; only the PDF resolution failed to use it.
4. **Zero-page walk cascades quietly.** With no PDF read, the page walk covers nothing, and the near-empty / orphan checks have nothing to flag — the gate can pass while having reviewed **none** of what the client opens.

## Root cause

A path-base mismatch: 5.3 writes the PDF field **relative to its own step dir** (as a bare name), but 5.4 resolved it **relative to the run root**. Two steps disagreed about the base a bare filename is relative to.

## Fix (already on main)

`check_layout` now resolves a directory-less value against the render step:
`pdf = run_dir / (Path(RENDER_STEP) / pdf if len(pdf.parts) == 1 else pdf)` — a bare filename (`len(pdf.parts) == 1`) resolves against `run_dir / RENDER_STEP`; a value that already carries a path segment stays run-dir-relative. This is functionally identical to the intended fix (resolve a bare name against `run_dir / RENDER_STEP`). This was the smaller, contained side of the fix (versus having the writer emit a step-relative or absolute path), and it is the side that landed.

## Reproduction / verification

1. On a run where `output/5.3-render-pdf/page-map.json` has `"pdf": "site-intelligence-report.pdf"` (bare), run `check_layout` against the run-dir.
2. Pre-#931: `page_walk: the rendered PDF is not on disk at site-intelligence-report.pdf`, 0 pages.
3. Post-#931 (current `main`): the PDF resolves to `<run>/output/5.3-render-pdf/site-intelligence-report.pdf`, and the walk covers the full page count. Confirmed present in the worktree branched from current `origin/main`.

---

# Bug 3 — DOCX renderer throws on a bare `<img>` in block context, hard-failing 5.5

**Fix: dsd PR [#564](https://github.com/noetic-inc/dsd/pull/564).**

## Symptom (as observed)

- **Run:** `noetic/grocery-atlanta`, step `5.5` (Word render).
- **What was observed:** the DOCX render **hard-failed (exit 1)** with `DOCX renderer: unknown intrinsic tag "<img>" in block context`. The **same** report rendered to PDF (5.3) without complaint — the in-content `<img>` context plates the PDF path accepts are exactly what the DOCX path choked on.

## Evidence chain

1. **`blockFromIntrinsic` allowlists text tags only.** `dsd/web/scripts/render-docx/map-components.ts`'s `blockFromIntrinsic` switch handles `p, ul, ol, li, br, strong/b, em/i, code, a` and then `throw`s on everything else — the throw's own message enumerated the allowlist as `p, strong/b, em/i, a, ul/ol/li, br, code`. No `img`.
2. **The report legitimately places `<img>` in block context.** In-content context plates render as a bare `<img src alt />` at block level (not only inside RDS figure wrappers), so the DOCX walker hit `<img>` at the block seam and threw.
3. **The PDF path handles it, creating a PDF/DOCX asymmetry.** The RDS figure components already funnel their images through a shared `imageParagraph(src, alt, ctx)` helper in the **same** DOCX file (`map-components.ts`, ~line 1264, a function declaration and therefore hoisted), used by `FigureGridPage`, `FullBleedFigurePage`, and the thumbnail/hero layouts. The capability to emit an image existed; block-level `<img>` just was not wired to it.
4. **Fail-hard, by design.** 5.4/5.5 prefer a hard failure with the component named over a silently half-rendered Word doc — so this surfaced immediately rather than shipping a doc with a missing image.

## Root cause

`blockFromIntrinsic`'s allowlist was written for the text tags markdown prose produces and never extended to the one block-level intrinsic the report also emits — `<img>` — even though the renderer already had the helper to handle it. The DOCX and PDF renderers had drifted out of parity on in-content images.

## Impact

- **Deterministic** for any report carrying a bare `<img>` at block level (in-content context plates). On `grocery-atlanta` this stopped 5.5 cold.
- Blocks only the Word deliverable; the PDF is unaffected. But 5.5 is a required deliverable, so the run cannot complete without it.
- No corruption — a hard stop, not a bad render.

## Fix direction (implemented in PR #564)

Add a `case 'img'` before `default:` that reuses the existing `imageParagraph(src, alt, ctx)` helper — the same one the RDS figure components use — so a block-level `<img>` emits the same centered image paragraph with report-relative `src` resolution via `ctx.reportDir`, giving PDF/DOCX parity. A malformed `<img>` with no string `src` degrades to no output rather than throwing. `img` is also added to the `default:` throw's allowlist message so the error text stays accurate.

## Reproduction / verification

1. Author a report with a bare `<img src="figures/x.png" alt="…" />` at block level (outside an RDS figure wrapper).
2. Run 5.5 on `main` (pre-#564): exit 1, `unknown intrinsic tag "<img>" in block context`.
3. With #564 applied: the `<img>` maps to a centered image paragraph via `imageParagraph`, and the Word render completes — matching the PDF.

---

# Bug 4 — `MarkdownBody` renders provenance HTML comments as visible client-facing text

**Worked around per-report on this run; systemic fix OPEN (no PR yet).**

## Symptom (as observed)

- **Run:** `noetic/grocery-atlanta`, caught at **5.4's visual page-walk** (the only step that looks at what the client opens) on the appendix Part pages.
- **What was observed:** the contractually-required provenance comments in the appendix markdown — `<!-- source: output/4.1-disciplines/zlu.md -->` and siblings — printed as **visible gray text** at the top of **every** appendix Part page, exposing **internal repo paths** to the client.

## Evidence chain

1. **The comments are required in the source.** The appendix feed carries `<!-- source: … -->` provenance comments so each reproduced-research Part is traceable back to the step/file that produced it — they are supposed to be invisible machine metadata, present in the markdown but never rendered.
2. **`MarkdownBody` does not strip them.** `dsd/web/components/report-design-system/partials/markdown-body.tsx` renders via `react-markdown` with `remarkGfm`, and `rehype-raw` only when `allowHtml` is set (default `false`). The component has **no** step that removes HTML comment nodes, so the `<!-- … -->` text reaches the DOM as literal content and paints as gray body text.
3. **Every appendix Part carries at least one.** Because each Part is stamped with its source comment, the leak is not a one-off — it recurs on every Part page of the appendix, which is exactly the systemic-markdown-flow class 5.4's per-Part sample is designed to catch.
4. **Caught only at the visual gate.** No mechanical check flags a comment-as-text; it took 5.4's eyeball page-walk to see the gray provenance line on the rendered page.

## Root cause

Two layers each assumed the other would handle HTML comments: the composer emits `<!-- source: … -->` as legitimate provenance metadata, and `MarkdownBody` renders whatever markdown it is handed without a comment-stripping pass. Nothing in between guarantees that machine-only comments never reach the client surface.

## Impact

- **Client-facing information leak:** internal repo paths (e.g. `output/4.1-disciplines/zlu.md`) printed in the deliverable — a confidentiality and polish defect, not just cosmetic.
- **Systemic:** recurs on every appendix Part page of every report that uses provenance comments, in whichever renderer consumes `MarkdownBody`.

## Fix direction (per-report workaround applied; systemic fix OPEN)

- **Applied this run (per-report):** strip HTML comments from the appendix feed in the report's `pages.tsx` (`output/5.1-compose/pages.tsx`) before it reaches `MarkdownBody`. This clears the visible leak for `grocery-atlanta` but does nothing for the next report.
- **Systemic candidates (OPEN — pick one, no PR yet):**
  1. **Durable, at the component (preferred):** have the RDS `MarkdownBody` component strip HTML comment nodes unconditionally (a small rehype pass that drops `comment` nodes), so no report can leak a provenance comment regardless of `allowHtml`. This fixes it once for every consumer.
  2. **At compose:** have 5.1 compose strip HTML comments from the appendix feed **by default** when materializing `pages.tsx`, keeping the provenance comments only in the upstream artifacts. Narrower than (1) — protects the SIR appendix path but not other `MarkdownBody` uses.

## Reproduction / verification

1. Feed `MarkdownBody` markdown containing `<!-- source: output/4.1-disciplines/zlu.md -->\n\n## Part …` and render on `main`: the comment appears as visible gray text above the heading.
2. Acceptance for the systemic fix: the same input renders with the comment absent from the DOM, and 5.4's appendix page-walk shows no provenance text on any Part page — for every report, not just one.

---

# Also seen on this run (already documented elsewhere): rollup requires the downstream Publish gate

A **fifth** issue fired on the `grocery-atlanta` run and is **already documented** in the sibling write-up **`ROLLUP-REQUIRES-DOWNSTREAM-PUBLISH-GATE.md`** — a lineage cycle in which the §5.6 rollup requires a decision from a step downstream of it. This run confirms it firsthand: **5.6 rollup failed `checks.hitl: gates-undecided` on gate 5.8**, was unblocked with a **one-time operator override**, and re-ran clean once the Publish decision was recorded. That is a firsthand confirmation of the already-diagnosed cycle, **not** a new defect; see the sibling write-up for the root cause and fix directions. It is intentionally **not** re-documented here to avoid duplicating that analysis.
