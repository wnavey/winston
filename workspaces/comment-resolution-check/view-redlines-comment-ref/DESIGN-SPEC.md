# `view-redlines-comment-ref` — Design Spec

> **Status:** Draft v1, 2026-06-29. Companion to
> [`view-mcr-pdf`](../view-mcr-pdf/DESIGN-SPEC.md) for redline-sourced CRC
> rows. Whereas the MCR viewer is "open the source PDF in the browser's
> native viewer at page N," this spec stands up an **in-app** PDF.js
> viewer that draws a bbox overlay on the comment and shows the parsed
> comment text on a side panel. The patterns are lifted directly from
> navalbase's step-4 debug UI (`src/navalbase/reviewui/`), adapted to
> SvelteKit + UnoCSS + bun.

---

## 1. Overview

**Purpose.** Austin Water U0 redlines (and the other redline review
products that will follow) are graphical annotations on plan sheets:
red boxes, arrows, text callouts. The "what" of each comment is in the
parsed text already rendered in the CRC source-disclosure aside; the
"where" is on the PDF page itself, and is half the meaning.
`view-mcr-pdf`'s native-browser-tab approach can't draw overlays, so
redline-sourced rows get a proper in-app viewer that:

- Renders the source PDF (PDF.js, canvas-based).
- Opens at the clicked comment's page (1-indexed from the source-map).
- Draws a translucent red bbox highlight over the comment's region
  (`pdf_topleft` PDF points from the source-map → PDF.js viewport
  pixels at render time).
- Also renders the bboxes of every **other** redline comment on the
  same page in a lighter style, clickable to swap focus.
- Side panel shows the parsed comment for the currently-focused row:
  department code, ID, page, `verbatim_text`.

Each comment is a bookmarkable URL — shareable within the project,
re-opens to the same page+highlight on revisit.

**Mental model.** Existing `source-map.json` already carries everything
the viewer needs (per `navalbase_passthrough`): `source_pdf` (a
filename key into `source_pdfs[]`), `bbox[0].{page, x0, y0, x1, y1,
coord_space}`, `verbatim_text`, `crop_image[0]`. No new generation-side
work. The viewer is a pure cityhall feature; Substation only needs one
new endpoint to stream the source PDF bytes (mirrors `crc-mcr-pdf`, but
keyed by the source-map's source-PDF filename instead of a fixed
`mcr.pdf`).

**Position in the CRC pipeline.**
```
generate-crc-guides-from-redlines       Conductor / review        cityhall UI                    Substation
[ unchanged ]                          [ unchanged ]              [ NEW: viewer + link ]          [ NEW: /api/crc/redline-pdf ]
source-pdfs/{file}.pdf uploaded         DB rows + source-map      in-app PDF.js viewer            byte-streams source PDFs
+ source-map points at it                                         w/ bbox overlay + side panel    keyed by source-map filename
```

**Out of scope for this iteration:**

- Migrating the existing `view-mcr-pdf` link (native browser tab) over
  to this viewer. The MCR viewer stays; `view-mcr-pdf` and this spec
  coexist (Q2). If we ever want highlight overlays on MCR rows too,
  this viewer trivially extends.
- Annotation / write-back features (the user can't draw on the PDF).
- Text selection / copy from within the rendered PDF (PDF.js text
  layer off by default, Q15).
- Non-CRC consumers (diligence report citations, training-corpus
  evidence). The endpoint and viewer are designed CRC-flavored.
- Surfacing navalbase enrichment fields (`final_enriched_comment`,
  `regulatory_citations[]`, etc.) in the side panel. The MVP shows
  only the source-map's `verbatim_text` (Q19). Future work can grow
  the source-map schema to carry enrichment.
- Mobile / narrow-viewport optimization. Layout collapses gracefully
  but isn't tuned.
- Search across PDF text. Navigation is per-comment only.

---

## 2. Decisions captured

Resolved in the 2026-06-29 spec-shaping session:

| # | Decision |
|---|----------|
| D1 | The viewer is a real cityhall surface, not a tab to the browser's native viewer. Native viewers can't draw overlays; the overlay is the whole point. |
| D2 | PDF rendering uses **PDF.js**, mirroring navalbase. Coord conversion goes `pdf_topleft` PDF points (source-map) → PDF.js viewport pixels at render time via `PDFPageProxy.getViewport({scale}).convertToViewportRectangle`. No re-derivation from navalbase's normalized `[0,1]` frame is needed; the source-map already denormalized to points. |
| D3 | Bbox overlay: an absolutely-positioned `<canvas>` stacked over the PDF render canvas, redrawn on zoom / scroll / page-change. Same recipe as navalbase. Multi-rect parents (schema allows N rects per `bbox[]`) draw N highlights ordered with `bbox[]`. |
| D4 | Substation owns one new endpoint that issues a signed URL for the source PDF. Auth + parent-comment validation gate happen there, same model as `crc-mcr-pdf`. **Endpoint name: `/api/crc/redline-pdf`** (Q6) — per-resource naming distinguishes redlines from the existing `/api/crc/mcr-pdf` and leaves room for future per-type endpoints. **Endpoint param: `parentCommentId`** (not `sourcePdfFilename`). The endpoint looks up the source-map, finds the parent, reads `parent.source_pdf`, and signs `{prefix}{source_pdf}`. Symmetric with the viewer URL, never leaks ~200-char filenames into proxy logs, and the path-traversal protection becomes implicit (you can only resolve to PDFs the generation skill actually emitted). |
| D5 | Source-map is the single source of truth for `(page, bbox, verbatim_text, source_pdf_filename, department_code)` — the viewer's `+page.server.ts` `load` fetches it via the existing source-map service and hands the resolved parent comment to the page (Q5: minimal URL). |
| D6 | The link to open the viewer lives in the existing source-disclosure aside (the one that hosts the MCR link), only when `source_type === 'pdf_redlines'` (D6 + Q16). |
| D7 | URL shape (Q5): **minimal** — `?parentCommentId={id}`. The viewer derives everything else from the source-map. |
| D8 | PDF delivery (Q7): **302 → signed Supabase URL**, not byte-proxy through cityhall. Redline PDFs are big (the gen-5 1700 S Lamar AW redline is 122 MB); a 302 lets the browser hit Supabase directly with HTTP range support, which PDF.js exploits for progressive load. The `view-mcr-pdf` byte-proxy pattern is fine for the 3.5 MB MCR PDF; redlines need range. |
| D9 | PDF.js source (Q8): **CDN-loaded**, mirroring navalbase. Pinned version (`4.9.155` initially), `pdfjs-dist`'s CJS bundle from cdnjs. Reasons: zero install in the SvelteKit bundle, the worker loads from the same CDN with no Vite worker-bundling dance, and navalbase has already validated the pattern at the version we'd use. |
| D10 | Surface (Q4): **dedicated full-page route in a new tab**, not a modal. Bookmarkable, isolates the heavy PDF.js bundle from the review-page route, symmetric with `view-mcr-pdf`'s new-tab UX. |
| D11 | Multi-comment navigation (Q10): the viewer opens to the **clicked comment's page**, focuses its bbox in red, and **also renders all other redline-comment bboxes on the same page** in a lighter style (dashed outline). Clicking any rect swaps focus, scrolls the side panel to that comment's verbatim_text, and updates the URL fragment (`#comment={id}`) so the browser back button works. Page-change re-fetches the comment set for the new page. |
| D12 | Bbox toggle (Q11): default **on**, with a small "hide overlay" control in the page header bar. |
| D13 | Zoom / pan / fit controls (Q12): **full controls in MVP**, parity with navalbase's step-4 UI — `Fit width`, `Fit page`, `+`, `−`, free-form scroll-to-pan. Reasonable starting set: 50% / 100% / 150% / 200% presets in addition to fit modes. |
| D14 | Page navigation (Q13): prev / next page buttons + `page N / M` indicator + keyboard arrows (`←` / `→`). No jump-to-page input in MVP — most redline PDFs have ≤50 pages. |
| D15 | Bbox highlight color (Q14): **semi-transparent red** (`rgba(220, 38, 38, 0.18)` fill, `rgba(220, 38, 38, 0.75)` stroke) for the focused comment. Other comments on the same page render with a dashed amber outline (`rgba(217, 119, 6, 0.6)`, no fill). |
| D16 | Text layer (Q15): **off** by default. Text selection happens in the side panel, which is the primary copy-paste affordance. PDF.js text-layer rendering also drifts on PDFs with embedded fonts, which would visually misalign overlays. |
| D17 | Bbox-missing redline row (Q16): **render the link anyway**. Viewer opens to page 1 with no overlay. Same pattern as the post-PR-review `view-mcr-pdf` behavior. |
| D18 | PDF missing in bucket (Q17): **friendly viewer-page error**, not a hard 404. Same DX rationale as `view-mcr-pdf` risk §11.3. |
| D19 | URL bookmarks (Q18): bookmarkable. Auth-gated by the existing project-access check; nothing new to design. |
| D20 | Source-map schema (Q19): **no extension** for MVP. The viewer reads `parent_comments[i].verbatim_text` only. Enrichment passthrough is a future-work item (§12.6). |
| D21 | Multi-PDF / multi-department (Q20): the source-map carries `parent_comments[i].department_code` and `parent_comments[i].source_pdf` already. The viewer derives both from the source-map at load — no new identifier needed in the URL. When a future submission carries multiple redline PDFs (Austin Energy + Austin Water + …), each parent comment names its own source-PDF and the viewer's substation endpoint resolves it via the source-map. |

---

## 3. Glossary

- **Source PDF.** Any PDF referenced in `source-map.json`'s `source_pdfs`
  record. Today: `mcr.pdf` (the MCR text PDF) and zero or more
  `source-pdfs/{filename}.pdf` (redline PDFs). This spec serves only
  the redline kind via the `/api/crc/redline-pdf` endpoint.
- **Parent comment.** A row in `source-map.parent_comments[]`. For
  redlines, IDs look like `AW-RL-1`, …, `AW-RL-N`. Always 1:1 with the
  `items[]` checklist entry (per the redline skill spec — no atomization).
- **Comment bbox.** `parent_comments[i].bbox[]` — an array of rects in
  `pdf_topleft` PDF points (1/72 inch, origin top-left). For redlines:
  always single-rect today, but the schema permits N.
- **Source-map filename key.** `parent_comments[i].source_pdf` —
  matches a key in `source_pdfs[]` (e.g. `"source-pdfs/1700 S Lamar Blvd
  Sp-2026-0136C AWPE U0 Redlines.pdf"`). The canonical identifier the
  endpoint uses to download the PDF bytes from the bucket.
- **Focused comment.** The parent comment the user clicked the link
  for, or the comment they clicked while inside the viewer. Rendered
  with the strong red highlight; its `verbatim_text` is what the side
  panel shows.
- **Sibling comment.** Any other parent comment whose `bbox[0].page`
  matches the currently-displayed page. Rendered in dashed amber.
- **Viewer.** The cityhall full-page route defined by this spec.

---

## 4. Data sources — no schema changes

The viewer consumes data already in the source-map. For each redline
row the source-map holds:

```jsonc
{
  "id": "AW-RL-2",
  "department_code": "AW",
  "source_type": "pdf_redlines",
  "source_pdf": "source-pdfs/1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf",
  "verbatim_text": "Existing water meter callout '…'",
  "bbox": [
    { "page": 8, "x0": 953.86, "y0": 235.01, "x1": 1283.04, "y1": 461.38, "coord_space": "pdf_topleft" }
  ],
  "crop_image": ["figures/AW-RL-2/1.png"],
  "extraction": { "method": "navalbase_passthrough", "verbatim_match": "exact", "confidence": "high" }
}
```

`source_pdfs["source-pdfs/…AWPE U0 Redlines.pdf"]` carries `sha256`,
`original_filename`, `uploaded_to_bucket: true`. The endpoint validates
its requested filename against this record to gate arbitrary-storage-
path lookup.

**Gen-5 1700 S Lamar reality check:**

- 10 redline parents (`AW-RL-1` … `AW-RL-10`), pages 6–36.
- 1 redline source PDF (`source-pdfs/1700 S Lamar Blvd Sp-2026-0136C
  AWPE U0 Redlines.pdf`, 122 MB). Already in the bucket.
- 1 redline figure crop per parent (`figures/AW-RL-{N}/1.png`, 600
  DPI).
- All bboxes single-rect; all `confidence: "high"`; all
  `method: "navalbase_passthrough"`.

---

## 5. Substation — `/api/crc/redline-pdf`

### 5.1 Wire contract

```
GET /api/crc/redline-pdf?reviewId={uuid|rv_uuid}&parentCommentId={id}
Authorization: Bearer {token}

302 Found
  Location: <signed Supabase URL, 15-min TTL>

400  - missing / invalid query params
401  - missing/invalid bearer
403  - authenticated but no project access
404  - review not found / not CRC / parentCommentId not in source-map / not pdf_redlines / source PDF missing in bucket
500  - storage error (signed-URL creation failure)
```

`parentCommentId` is the row ID from `source-map.parent_comments[].id`
(e.g. `"AW-RL-2"`). The endpoint resolves the source-PDF filename
itself via the source-map; no filename ever appears in the URL or
proxy. Validation flow:

1. Resolve the review's `crcGuides.{bucket, prefix}`.
2. Fetch + parse `source-map.json` (reuse `crc-source-map` service's
   cached LRU entry — same bucket/prefix → same key, so this is free
   on warm calls).
3. Find `parent_comments[i]` where `id === parentCommentId`. **Reject
   if missing** — protects against arbitrary lookups; the URL can only
   resolve to a comment the generation-side skill actually emitted.
4. Reject if `parent.source_type !== 'pdf_redlines'` — this endpoint
   serves only redline PDFs. (MCR-sourced parents have their own
   `/api/crc/mcr-pdf` endpoint per `view-mcr-pdf`.)
5. Read `sourcePdfFilename = parent.source_pdf` (e.g. `"source-pdfs/
   …AWPE U0 Redlines.pdf"`).
6. Verify `source_pdfs[sourcePdfFilename].uploaded_to_bucket === true`
   (defense in depth — if false, 404 with `redline_pdf_not_uploaded`
   code).
7. Create a 15-min signed URL via `sb.storage.from(bucket).createSignedUrl(`${prefix}${sourcePdfFilename}`, 900)`.
8. 302 redirect.

### 5.2 Why 302 (not byte-proxy)

The MCR variant is a byte-proxy (per `view-mcr-pdf` D2). For redlines
the calculus flips:

- **Size.** 122 MB redline PDFs vs. ~3.5 MB MCRs. Two-hop proxy adds
  meaningful latency.
- **Range requests.** PDF.js only does progressive load (first paint
  before the whole file lands) when the server supports `Range:`
  headers. Supabase storage's signed-URL endpoint supports range out
  of the box. The Hono / Vercel proxy doesn't, and adding it is the
  same work as `view-mcr-pdf` risk §9.4 we deferred.
- **Auth surface.** Top-level navigations can't attach Authorization
  headers, but `pdfjsLib.getDocument({ url })` is a programmatic
  XHR-style fetch from within the page — it follows redirects
  including 302→signed-URL with no header dance.

Trade-off: the signed URL has a 15-min TTL. PDF.js typically completes
its needed reads inside that window; if the user idles for an hour and
then scrolls to a new page, the range fetch 403s — at which point the
viewer re-issues the load (see §6.10 for the re-issue handler).

### 5.3 Implementation skeleton

`src/services/crc-redline-pdf.ts` parallels `crc-mcr-pdf.ts`. Pipeline:

1. `stripPrefix(reviewId)`
2. `SELECT id, project_id, review_type, metadata FROM reviews WHERE id = ?`
3. `requireProjectAccess(review.project_id, user.id, 'read')` —
   **first**, before branching, same defense-in-depth pattern as the
   sibling endpoints.
4. Gate on `review_type === 'crc'` (else 404).
5. Read `metadata.crcGuides.{bucket, prefix}`; 404 if missing.
6. Fetch + parse `source-map.json` (reuse `getSourceMapForReview` or
   factor a shared helper).
7. Find `parent_comments[i]` where `id === parentCommentId`. 404
   otherwise.
8. Reject if `parent.source_type !== 'pdf_redlines'` (404).
9. Resolve `sourcePdfFilename = parent.source_pdf`.
10. Verify `source_pdfs[sourcePdfFilename].uploaded_to_bucket`.
11. `sb.storage.from(bucket).createSignedUrl(`${prefix}${sourcePdfFilename}`, 900)`.
12. Return a 302 with the signed URL.

Hono route adapter at `src/routes/crc-redline-pdf.ts`, registered as
`api.route('/crc/redline-pdf', crcRedlinePdf)` in `src/index.ts`.

### 5.4 Caching

No in-process cache for the PDF bytes (we don't have them) and no
cache for the signed URL (TTLs are tight enough that re-creating per
request is correct). The source-map fetch reuses the existing LRU.

### 5.5 Auth

Same as `crc-mcr-pdf` / `crc-source-map`: bearer → service-role bypass
or `requireProjectAccess(review.project_id, user.id, 'read')` first.
No new auth machinery.

---

## 6. Cityhall — server proxy + viewer

### 6.1 Server proxy

`src/routes/(app)/project/[projectId]/review/[reviewId]/redline-pdf/+server.ts`
mirrors `mcr-pdf/+server.ts`, with one twist: instead of streaming the
body it forwards the 302 redirect.

```ts
import { error, redirect } from '@sveltejs/kit';
import { getEnvVar } from '$lib/get-env';
import { getAccessToken } from '$lib/server/substation';
import type { RequestHandler } from './$types';

const SUBSTATION_URL = getEnvVar('SUBSTATION_URL') ?? 'http://localhost:3001';

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const parentCommentId = url.searchParams.get('parentCommentId');
  if (!parentCommentId) throw error(400, 'parentCommentId required');

  const token = getAccessToken(locals);
  const substationUrl =
    `${SUBSTATION_URL}/api/crc/redline-pdf` +
    `?reviewId=${encodeURIComponent(params.reviewId)}` +
    `&parentCommentId=${encodeURIComponent(parentCommentId)}`;

  let res: Response;
  try {
    res = await fetch(substationUrl, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual', // we want to forward the 302, not follow it
    });
  } catch {
    throw error(502, 'Redline PDF service unavailable');
  }

  if (res.status === 302) {
    const signed = res.headers.get('Location');
    if (!signed) throw error(502, 'Missing signed URL');
    throw redirect(302, signed);
  }

  const body = await res.json().catch(() => null);
  throw error(res.status, body?.error?.message ?? 'Failed to load redline PDF');
};
```

PDF.js will follow the redirect on its own and start range-fetching
directly from Supabase storage. Cityhall doesn't see the PDF bytes,
matching the auth/perf goals (D8).

### 6.2 Viewer route

`src/routes/(app)/project/[projectId]/review/[reviewId]/source-pdf-viewer/+page.svelte`
with a sibling `+page.server.ts`. URL shape (D7):

```
/project/{projectId}/review/{reviewId}/source-pdf-viewer
  ?parentCommentId=AW-RL-2
```

The server `load` runs synchronously against the source-map endpoint
and resolves the entire context the viewer needs before any client JS
runs:

```ts
export const load: PageServerLoad = async ({ locals, params, url, fetch }) => {
  if (!locals.user) throw error(401);

  const parentCommentId = url.searchParams.get('parentCommentId');
  if (!parentCommentId) throw error(400, 'parentCommentId required');

  const sm = await fetchSourceMapServerSide(fetch, locals, params.reviewId);
  if (!sm.available) {
    throw error(404, 'Source map not available for this review');
  }

  const parent = sm.data.parent_comments.find((p) => p.id === parentCommentId);
  if (!parent || parent.source_type !== 'pdf_redlines') {
    throw error(404, 'Parent comment not found / not a redline');
  }

  // Pre-compute the sibling-comment list — every parent on the same
  // source PDF, keyed by page, so the viewer can render dashed
  // outlines for siblings without a second round trip.
  const siblings = sm.data.parent_comments.filter(
    (p) =>
      p.source_pdf === parent.source_pdf &&
      p.source_type === 'pdf_redlines' &&
      p.id !== parent.id,
  );

  return {
    review: { id: params.reviewId },
    parent,
    siblings,
    initialPage: parent.bbox[0]?.page ?? 1,
    // The PDF URL the viewer hands to PDF.js — a relative URL to the
    // cityhall proxy (which forwards to substation, which 302s to
    // Supabase). The parentCommentId is the only identifier; substation
    // resolves the source-PDF filename from the source-map itself.
    pdfUrl:
      `/project/${params.projectId}/review/${params.reviewId}/redline-pdf` +
      `?parentCommentId=${encodeURIComponent(parent.id)}`,
  };
};
```

The page renders synchronously with this data — no client fetch
round-trip before the PDF starts loading.

### 6.3 Viewer layout

```
┌──────────────────────────────────────────────────────┬──────────────────────┐
│ Top bar                                              │ Side panel           │
│  ← prev | page 8 / 36 | next →   |   - 100% +  fit  │  AW · AW-RL-2 · p.8  │
│                                  |   overlay [on]    │                      │
├──────────────────────────────────────────────────────┤  "Existing water     │
│                                                      │   meter callout      │
│  [PDF.js canvas — page 8 of the redline PDF]         │   'EXISTING 6" WATER │
│  [bbox overlay canvas (transparent layer)]           │   METER (#UNK), TO   │
│      ┌──────┐                                        │   BE REMOVED, SEE    │
│      │ ───  │ ← focused (solid red)                  │   NOTE 7'…"          │
│      └──────┘                                        │                      │
│                                                      │  Source: redline     │
│      ┌╴╴╴╴╴╴╴╴┐                                      │  AW-RL-2             │
│      ╵        ╵ ← sibling on same page (dashed amber)│                      │
│      └╴╴╴╴╴╴╴╴┘                                      │  [Open raw PDF ↗]    │
│                                                      │                      │
└──────────────────────────────────────────────────────┴──────────────────────┘
```

Grid: `grid grid-cols-[1fr_minmax(0,22rem)] gap-x-6` — the precedent
established by the existing source-disclosure aside.

### 6.4 PDF.js integration (CDN-loaded)

PDF.js loads from the same cdnjs URL navalbase uses, with a pinned
version. The script tag goes in a route-local `<script>` block (or a
`+layout.svelte` scoped to the viewer route, since no other cityhall
route needs PDF.js):

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  const PDFJS_VERSION = '4.9.155';
  const PDFJS_CDN = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

  let pdfjsLib: any = null;

  onMount(async () => {
    // Dynamic import from CDN — the module URL has to be absolute because
    // Vite can't statically analyze it; mark it `/* @vite-ignore */` so Vite
    // doesn't try to resolve at build time.
    pdfjsLib = await import(/* @vite-ignore */ `${PDFJS_CDN}/pdf.min.mjs`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.mjs`;
    // ... begin rendering
  });
</script>
```

The CDN load mirrors navalbase exactly (per the navalbase research:
`reviewui/static/index.html` uses `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs`).
We pin the same version to start; bumping is a one-line config change.

**Document load**:

```ts
const doc = await pdfjsLib.getDocument({
  url: pdfUrl,             // /project/.../redline-pdf?parentCommentId=...
  withCredentials: true,   // forward cityhall session cookie via the proxy hop
}).promise;
```

PDF.js follows the 302 from the cityhall proxy → Supabase signed URL
on its own; `withCredentials` makes the proxy hop work (the signed-URL
final hop doesn't need auth).

**Page render**:

```ts
const page = await doc.getPage(currentPage);
const baseViewport = page.getViewport({ scale: 1 });
const containerWidth = container.clientWidth;
const cssScale = computeScale(zoomMode, containerWidth, baseViewport);
const dpr = window.devicePixelRatio || 1;
const viewport = page.getViewport({ scale: cssScale * dpr });

renderCanvas.width = viewport.width;
renderCanvas.height = viewport.height;
renderCanvas.style.width = `${viewport.width / dpr}px`;
renderCanvas.style.height = `${viewport.height / dpr}px`;

overlayCanvas.width = viewport.width;
overlayCanvas.height = viewport.height;
overlayCanvas.style.width = `${viewport.width / dpr}px`;
overlayCanvas.style.height = `${viewport.height / dpr}px`;

await page.render({
  canvasContext: renderCanvas.getContext('2d')!,
  viewport,
}).promise;

drawOverlay(viewport);
```

### 6.5 Bbox overlay

The overlay canvas sits absolutely-positioned over the PDF canvas at
the same CSS dimensions. For each rect on the current page, convert via
`viewport.convertToViewportRectangle([x0, y0, x1, y1])` and draw with
the appropriate style depending on whether it's the focused or sibling
comment.

```ts
function drawOverlay(viewport: any) {
  if (!overlayVisible) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    return;
  }
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  // Hit-test storage for click-to-focus on siblings.
  hitRects = [];

  // Siblings first (so the focused comment paints on top).
  for (const sibling of siblingsOnCurrentPage) {
    for (const bb of sibling.bbox.filter((b) => b.page === currentPage)) {
      const [x0, y0, x1, y1] = viewport.convertToViewportRectangle([
        bb.x0, bb.y0, bb.x1, bb.y1,
      ]);
      const rect = normaliseRect(x0, y0, x1, y1);
      overlayCtx.save();
      overlayCtx.strokeStyle = 'rgba(217, 119, 6, 0.6)';   // amber-600
      overlayCtx.lineWidth = 2;
      overlayCtx.setLineDash([6, 4]);
      overlayCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      overlayCtx.restore();
      hitRects.push({ ...rect, parentId: sibling.id });
    }
  }

  // Focused comment.
  for (const bb of focused.bbox.filter((b) => b.page === currentPage)) {
    const [x0, y0, x1, y1] = viewport.convertToViewportRectangle([
      bb.x0, bb.y0, bb.x1, bb.y1,
    ]);
    const rect = normaliseRect(x0, y0, x1, y1);
    overlayCtx.fillStyle = 'rgba(220, 38, 38, 0.18)';   // red-600
    overlayCtx.strokeStyle = 'rgba(220, 38, 38, 0.75)';
    overlayCtx.lineWidth = 2;
    overlayCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    overlayCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    hitRects.push({ ...rect, parentId: focused.id });
  }
}
```

`normaliseRect` accounts for `convertToViewportRectangle` returning
`(x0, y0, x1, y1)` where the y axis may flip depending on the
viewport's rotation; for unrotated pages (the common case) y0 < y1
holds and the call is a no-op.

**Click-to-focus on siblings.** The overlay canvas listens for clicks
and hit-tests against `hitRects` in CSS-space (divide by `dpr`). On
hit, the focused parent switches, `URL#comment={newId}` updates via
`history.pushState`, the side panel re-renders, and the overlay
redraws. If the hit's parent has its bbox on a different page, also
navigate the page.

**Re-render triggers** (any of these → call `drawOverlay`):
- Zoom change (rescale viewport).
- Page change.
- Container resize (`ResizeObserver`).
- Overlay toggle.

Multi-rect bboxes (the schema permits N per parent) draw each rect.

### 6.6 Side panel content

MVP (per Q9 lean + Q19):

- **Header line**: `{department_code} · {parent_id} · page {page}`
  (e.g. "AW · AW-RL-2 · page 8").
- **Verbatim text**: `parent.verbatim_text`, `whitespace-pre-wrap`,
  full text — no truncation. Selectable for copy-paste.
- **Source byline**: "Source: redline {parent_id}" (reuse
  `sourceByline()` from `crc-source-map.ts`).
- **Open raw PDF ↗**: a secondary link to `pdfUrl` (the cityhall
  proxy that 302s to the signed Supabase URL) with `download` attribute
  so the user can grab the raw PDF if they want their own viewer.

Out of MVP (Q7 lean, Q19):
- Crop image (`figures/{row_id}/1.png`) inline. Easy to add; cheap to
  defer. We may want it once we see the viewer's typical PDF first-paint
  time — if PDF.js stays sluggish, the crop is a useful "thumbnail at
  zoom" while waiting.
- Enrichment fields. Out of MVP; revisit after the redline skill
  passthrough adds them to the source-map (out of scope here).

### 6.7 Zoom / pan / fit controls

Full set in MVP (Q12 / D13), navalbase parity:

- **Zoom presets**: 50% / 100% / 150% / 200% buttons.
- **Zoom in / out**: `+` / `−` buttons step by 25%.
- **Fit width**: scales so the PDF page width = container width minus
  side-panel-and-padding.
- **Fit page**: scales so the entire page fits in the container's
  visible area.
- **Pan**: free scroll inside the overflow container. The PDF canvas
  is rendered inside a `overflow: auto` div, so dragging the scrollbars
  or two-finger scroll pans natively.

The user's selected zoom mode is held in component state; switching
modes triggers a re-render at the new `cssScale`. No URL persistence
of zoom (resetting on bookmark reopen is fine; it's a per-session UI
state).

### 6.8 Page navigation

- **Prev / next** buttons in the top bar. Disabled at boundaries.
- **Page indicator**: `page N / M` plain text. No input field in MVP.
- **Keyboard arrows**: `←` / `→` shortcut prev/next when the viewer
  has focus (and no text input is focused).
- **Page change re-fetches siblings**: when the user navigates to a
  different page, the overlay re-renders with the set of comments on
  the new page. The focused comment stays focused only if its bbox is
  on the new page (rare for redlines — single-page bboxes); otherwise
  the side panel collapses to "no comment focused — click a highlight
  to inspect." The URL drops `#comment` when no comment is focused.

### 6.9 Link affordance in the review page

`src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte`
inside the existing source-disclosure aside, in the
`{#if sourceMapParent.source_type === 'pdf_redlines'}` branch (around
the existing redline-render block — see cityhall research §2):

```svelte
{#if sourceMapParent?.source_type === 'pdf_redlines'}
  <div>
    <a
      href="{page.url.pathname}/source-pdf-viewer?parentCommentId={sourceMapParent.id}"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1 text-xs font-medium
        text-amber-800 hover:text-amber-900 hover:underline"
    >
      View in source PDF
      <span class="i-mingcute:external-link-line text-sm"></span>
    </a>
  </div>
{/if}
```

Always rendered (per D17) — viewer handles the bbox-missing case
internally by opening to page 1 with no overlay.

### 6.10 Signed-URL expiry recovery

Signed URLs have a 15-min TTL. If the user opens the viewer, lets it
idle for an hour, then scrolls to a new page that triggers a range
fetch, PDF.js will hit a 403 from Supabase. Handler:

- Catch `PDFDocumentLoadingTask` rejections and 403 responses inside
  the `getDocument` chain.
- On 403: re-request the proxy URL (which mints a fresh signed URL)
  and re-attempt the load. PDF.js's worker can swap docs, but a
  simpler MVP path is a full page reload (`location.reload()`), since
  the viewer's state (current page, zoom, focused comment) is all in
  the URL hash + query and survives reload.
- If reload fails too (substation down): show the friendly error
  panel (§7.2).

### 6.11 Tab title

The viewer page sets `document.title = `Redline ${parent.id} —
${departmentCode} · page ${page}`` so browser tabs are identifiable.

---

## 7. Edge cases & failure modes

### 7.1 Bbox missing on a redline row (D17)

Per the navalbase skill, all redline rows that survive Phase 1 have
non-null bboxes. But the schema permits empty `bbox: []`. The viewer
renders the link unconditionally; on load, if the focused parent has
empty bbox, open to page 1 of the source PDF with no overlay. The side
panel shows the verbatim_text and a small "no source highlight
available" hint.

### 7.2 Source PDF missing in bucket (D18)

Possible if the redline regeneration failed mid-upload or the upload
manifest is stale. Substation 404s. The cityhall server `load` catches
this and renders a friendly viewer-page error: "We couldn't load the
source PDF for this review. The file may not have been uploaded yet."
with a "Back to review" link. **Never** a raw 404.

### 7.3 Page number out of bounds

If a stale source-map points at a page that exceeds the PDF's
`pageCount`, clamp to the last page on first render, surface a small
"page not found in source PDF; showing last page" banner, and don't
draw any focused-comment overlay (siblings on the displayed page draw
normally if any exist). Don't refuse to render.

### 7.4 Multi-rect bbox spanning pages

Today: never. Schema-wise: possible. Per §6.5 we draw every rect on
whichever page each rect is on. As the user navigates between pages,
each page shows its own subset of rects from the focused parent.

### 7.5 Large PDF (122 MB)

Addressed by D8 (signed-URL 302). PDF.js streams via range requests
directly from Supabase storage; first paint is page-1 prefix load (or
the requested page's resources if PDF linearization allows direct
jump). Memory usage is page-aware: PDF.js drops unused pages from
memory after navigation.

### 7.6 Browser without PDF.js support

PDF.js requires evergreen browsers (last ~3 years). Cityhall already
assumes evergreen; no new constraint.

### 7.7 Slow PDF load

Viewer renders a skeleton (gray placeholder canvas + side panel populated
synchronously from the server `load`) while PDF.js loads. On the slow
path, the user sees the verbatim text immediately and the canvas fills
in as the PDF arrives.

### 7.8 Signed URL TTL exhaustion mid-session (§6.10)

Per §6.10, the viewer detects 403s on range requests and either
re-mints the signed URL via a page reload (simple MVP) or swaps the
underlying URL inside PDF.js (post-MVP optimization).

### 7.9 User opens the viewer for an old review without source-map

The server `load` catches `available: false` from the source-map
endpoint and surfaces the friendly error: "This review predates the
in-app source viewer." Same UX as 7.2.

### 7.10 CDN unavailability

If cdnjs is down, PDF.js fails to load and the viewer renders the
friendly error. We don't need a fallback in MVP — cdnjs uptime SLA is
high enough that this isn't a real risk. If it becomes one, switch to
npm `pdfjs-dist` (the original lean) in a follow-up.

---

## 8. Auth

Identical to `view-mcr-pdf` §6 / `transcribe-mcr-text` §7.1:

1. SvelteKit hooks authenticate via session cookie.
2. Cityhall server proxy reads `locals.user`, attaches bearer.
3. Substation validates bearer, runs
   `requireProjectAccess(review.project_id, user.id, 'read')` BEFORE
   branching on `review_type` / metadata.
4. Service-role callers bypass project access (existing pattern).

The 302→signed-URL pattern has one auth nuance: the signed URL itself
encodes a single-use-ish capability for 15 min, no separate auth. That
matches Supabase storage's standard model.

---

## 9. Telemetry

Worth tracking; not blocking for MVP:

- Viewer-page open rate per CRC review session.
- p50/p95 time from viewer-route open → PDF.js page-1 first paint.
- 404 rate split by cause: `review_not_found` /
  `source_pdf_filename_not_in_source_map` / `storage_missing`.
- Signed-URL 403 mid-session recovery count (if non-trivial, invest
  in §6.10's URL-swap path).

---

## 10. Cross-spec interactions

### 10.1 vs `view-mcr-pdf`

MCR rows keep their native-browser-tab link. Redline rows gain this
viewer. The two specs **coexist permanently** per Q2 / D6.

If a future change wants MCR rows in this viewer too, the migration is
local: add a sibling `/api/crc/mcr-pdf` lookup path or generalize the
endpoint to `/api/crc/source-pdf?type=mcr|redline`, and swap the MCR
link's `href`. Out of scope here.

### 10.2 vs `transcribe-mcr-text`

This spec leans entirely on the source-map schema as defined in
`transcribe-mcr-text/DESIGN-SPEC.md` §4. **No schema changes proposed**
per D20.

### 10.3 vs `generate-crc-guides-from-redlines`

No generation-side changes. The skill already uploads source PDFs and
populates `source-map.json` with `bbox` + `verbatim_text` +
`crop_image` for redline parents. The viewer is a pure consumer.

---

## 11. Rollout plan

### Phase 1 — viewer ships for redlines (~3–5 days of work)

1. **Substation** —
   - `src/services/crc-redline-pdf.ts` (parallels `crc-mcr-pdf.ts`,
     but issues a signed URL instead of streaming bytes).
   - `src/routes/crc-redline-pdf.ts` (Hono route adapter).
   - Register at `/api/crc/redline-pdf` in `src/index.ts`.
   - Shared helper: lift `getSourceMapForReview` from `crc-source-map`
     service so the redline-pdf service can read the source-map
     without duplicating LRU/auth logic.
2. **Cityhall** —
   - `src/routes/(app)/project/[projectId]/review/[reviewId]/redline-pdf/+server.ts`
     (proxy that forwards the 302).
   - `src/routes/(app)/project/[projectId]/review/[reviewId]/source-pdf-viewer/+page.svelte`
     + `+page.server.ts` (the viewer route).
   - CDN load of PDF.js (no new npm dependency).
   - Link affordance in the existing source-disclosure aside.
3. **Smoke test** — open the 1700 S Lamar gen-5 CRC, expand `AW-RL-2`,
   click "View in source PDF". Should open page 8 of the redline PDF
   with a red bbox over the water meter callout in the upper-right,
   and `AW-RL-1` / `AW-RL-3` / etc. siblings on the same page show
   dashed amber outlines.

### Phase 2 — polish (optional)

- Crop-image inline render in the side panel if first-paint latency
  becomes a complaint.
- Signed-URL swap inside PDF.js (replacing the reload fallback in
  §6.10).
- Jump-to-page input if the median redline PDF grows past ~50 pages.

### Phase 3 — MCR migration (only if Q17 ever flips)

Out of scope for this spec.

### Phase 4 — generic source-PDF viewer (only if non-CRC needs arise)

Out of scope for this spec.

---

## 12. Open risks (non-question)

### 12.1 PDF.js CDN risk

cdnjs is high-availability but not 100%. If a request fails the viewer
shows the friendly error and falls back to "no PDF.js, no viewer." A
follow-up that vendors `pdfjs-dist` into the cityhall bundle is the
hedge if this ever bites.

### 12.2 PDF.js text-layer alignment

If we ever enable the text layer (D16 currently off), PDF.js's font
substitutions can drift from the bbox positions encoded in the
source-map. Out of scope today.

### 12.3 Signed-URL TTL & long sessions

Per §6.10 / §7.8 — accepted with a reload-fallback recovery path.

### 12.4 122 MB upload contract

The redline skill currently uploads source PDFs without size validation.
If a future submission has a 500 MB redline PDF, PDF.js memory usage
may spike on very-large-page workloads. Out of scope here; track as
follow-up on the redline skill.

### 12.5 Multi-PDF redlines per review

A single review can in principle reference multiple redline source
PDFs (e.g. Austin Water + Austin Energy redlines). Today only AW is
done; future runs may add others. The endpoint + URL design supports
this from day 1: each parent comment names its own `source_pdf` in
the source-map, the viewer reads it, the redline-pdf endpoint
validates it against the source-map's `source_pdfs[]` map. **No
department-keyed routing is needed in the endpoint or URL** — the
source-map is the index. The viewer's side panel surfaces
`department_code` so the user knows which body the redline came from.

### 12.6 Enrichment passthrough

Q19 closed this out for MVP. If we later want the side panel to show
navalbase enrichment (`final_enriched_comment`,
`regulatory_citations[]`, …), the redline skill needs to extend the
source-map schema and the viewer adds a side-panel section. The wire
contract here doesn't change — the new fields ride inside the existing
`parent_comments[]` object.

---

## 13. Appendix — fully-worked example (AW-RL-2)

User opens the gen-5 1700 S Lamar CRC review. Expands the row whose
checklist ID is `AW-RL-2`. The source-disclosure aside renders:

```
City comment · redline AW-RL-2 · page 8

Existing water meter callout 'EXISTING 6" WATER METER (#UNK), TO BE
REMOVED, SEE NOTE 7' near the northern property line along Collier
Street

[View in source PDF ↗]
```

Clicks the link. New tab opens at:

```
/project/{projectId}/review/{reviewId}/source-pdf-viewer?parentCommentId=AW-RL-2
```

The page's server `load` fetches the source-map, finds the matching
`parent_comments[]` entry, and resolves:

```
initialPage       = 8
focusedParent     = { id: "AW-RL-2", department_code: "AW", verbatim_text: "…", source_pdf: "source-pdfs/…AWPE U0 Redlines.pdf", bbox: [{ page: 8, x0: 953.86, … }] }
siblings          = [ all other AW-RL-* parents whose source_pdf is the same redline PDF ]
pdfUrl            = "/project/{projectId}/review/{reviewId}/redline-pdf?parentCommentId=AW-RL-2"
```

Page hydration:

1. T+0ms: route resolves; side panel renders the focused parent's
   verbatim text from server-load data. Skeleton canvas placeholder
   shown.
2. T+50ms: PDF.js (loaded from cdnjs) starts `getDocument(pdfUrl)`.
3. T+~100ms: cityhall proxy 302s to a signed Supabase URL.
4. T+150ms–2s: PDF.js streams page 8 via HTTP range; first paint when
   the page's resources arrive.
5. T+~2s: page rendered. `drawOverlay()` draws:
   - Red filled + stroked rect over AW-RL-2's bbox (focused).
   - Dashed amber rects over any sibling on page 8 (e.g. if AW-RL-3
     is also on page 8, dashed amber outline).
6. User clicks AW-RL-3's dashed amber rect → focus swaps, URL becomes
   `?parentCommentId=AW-RL-2#comment=AW-RL-3` via pushState, side
   panel re-renders AW-RL-3's verbatim_text. Browser back button
   restores AW-RL-2 focus.
7. User clicks `next →` to page 9 → page change re-fetches sibling
   set for page 9, focused comment "loses focus" (its bbox is on
   page 8, not 9), side panel collapses to "click a highlight to
   inspect."
8. User clicks back to page 8 → focus restores from URL state.

Bookmarking the URL `?parentCommentId=AW-RL-2#comment=AW-RL-3` returns
the user to AW-RL-3 focus on page 8 next time — entire viewer state
survives in the URL.
