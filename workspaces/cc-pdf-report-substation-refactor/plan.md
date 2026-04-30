# CC PDF Report — Substation Port

Plan for porting the completeness-check PDF report off cityhall's client-side jspdf onto substation's react-pdf foundation. Goal is a unified PDF look + shared rendering code across Noetic apps.

## Today

**Substation PDF foundation** (`substation/src/pdf/`)
- Library: `@react-pdf/renderer` v4.5.1 — server-side, no Chromium.
- `noetic-document.tsx:400` — `NoeticDocument` base. Letter, side-set Noetic SVG header, page-number footer, hand-rolled markdown parser at `:45`. Helvetica only.
- `resolution-plan-document.tsx:53` — first specialization. Flattens `ResolutionPlanContent` to markdown then feeds `NoeticDocument`.
- One HTTP entry: `routes/resolution-plan-pdf.ts:23` — `GET /api/projects/:projectId/reviews/:reviewId/resolution-plan/pdf` streams `application/pdf` from Supabase.
- Maturity: early production. One document type wired up. No PDF tests.

**CC PDF today** (`cityhall/src/routes/(app)/project/[projectId]/review/`)
- `completion-check-pdf.ts:107` — `generateCompletionCheckPdf(input): Blob`. ~610 lines of `jspdf` v4.2.1 + `jspdf-autotable` v5.0.7, all imperative drawing.
- Triggered from a download button in `[reviewId]/+page.svelte:239`. Runs in browser. No server storage.
- Visual elements beyond what `NoeticDocument` can express today:
  - Hero pass-rate stat (36pt %)
  - 5-row colored stats grid + vertical divider
  - Stacked horizontal bar chart with rounded segment caps (`:269–305`)
  - `autoTable` summary with per-row icon callbacks (check / warning triangle / dash, `:53–80`)
  - Internal page links from summary rows to detail pages (`:590–596`)
  - Per-section detail pages with grouped status rails, dot bullets, references, resolution metadata

## Target architecture

```
NoeticDocument (base)
├── ResolutionPlanDocument          (existing — refactor as subclass)
└── CompletenessCheckReportDocument (new)
```

Shared primitives in `substation/src/pdf/`:
- `LogoHeader`, `PageFooter` (already implemented inside NoeticDocument — extract)
- `colors`, `theme`, font registry (already implemented — extract)
- `Markdown` renderer (extract from NoeticDocument's `parseMarkdown` + render)
- New: `StatBox`, `StackedBar`, `Table` (autoTable analog), `StatusIcon`, `Anchor` (internal link)

## Decisions

1. **Unified look.** OK to change cc PDF's look during the port — don't aim for pixel parity with the jspdf version. The cc PDF will dial back its dashboard style toward the editorial NoeticDocument feel.
2. **Server endpoint, browser round-trip.** New endpoint `GET /api/projects/:projectId/reviews/:reviewId/completeness-check/pdf` in substation. Cityhall replaces the client-side generator with `<a href={...} download>`. Removes ~610 lines from cityhall bundle.
3. **Persistence is optional.** Streaming download is the priority. Supabase storage attachment can come later if needed.
4. **Workflow does not emit it.** Bureau's `format-reports` step continues to produce markdown only; it does not emit PDF. Skip the conductor-sandbox-as-library path.
5. **Reuse substation fonts** (Helvetica today). When custom fonts arrive, do them once in substation.
6. **`ResolutionPlanDocument` is a subtype**, not load-bearing infrastructure. Refactor `NoeticDocument` aggressively if it makes the cc port cleaner; reshape `ResolutionPlanDocument` to fit.

## Deferred / out of scope

- Custom font integration.
- Persisting cc PDFs to Supabase storage.
- Bureau workflow emitting PDFs directly.
- Changing the resolution-plan PDF's user-visible look (it just rides along on whatever shape NoeticDocument ends up with).

## Plan of work

| # | Task | Repo | Branch |
|---|---|---|---|
| 1 | Plan + PR | winston | `wn/cc-pdf-report-substation-refactor` |
| 2 | Refactor `NoeticDocument` as superclass; extract shared primitives | substation | `wn/cc-report-pdf` |
| 3 | Build `CompletenessCheckReportDocument` | substation | `wn/cc-report-pdf` |
| 4 | Add `/api/.../completeness-check/pdf` endpoint | substation | `wn/cc-report-pdf` |
| 5 | Switch cityhall download to substation endpoint | cityhall | `wn/cc-pdf-via-substation` |

Tasks 2–4 land in one substation PR. Task 5 lands in cityhall after the substation endpoint is live (or behind a feature toggle if needed).

## Risk / open questions

- **Page-break behavior in react-pdf.** Declarative `wrap`/`break` props instead of "if y > pageHeight". Will require iteration to get tables and per-section pages laying out cleanly.
- **Table column sizing.** No `autoTable` analog — column widths managed manually via `<View>` flexBasis.
- **Internal links.** react-pdf supports anchors (`<Link src="#sec-1">`); need to verify behavior across PDF readers.
- **Visual fidelity expectations.** User has said they're OK changing the look — but worth surfacing the new design before merging cityhall switch, in case it feels worse than the current dashboard.
- **Auth on the new endpoint.** Substation already authenticates the resolution-plan endpoint — same pattern applies. Confirm SSO/cookie story matches when the link is opened from cityhall.

## Estimate

~4–7 engineer-days, low confidence. Real bottleneck is visual iteration on the new design + page-break tuning. Bumps the estimate if persistence / custom fonts get pulled into scope.
