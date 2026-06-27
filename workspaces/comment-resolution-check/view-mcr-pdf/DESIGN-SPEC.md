# `view-mcr-pdf` — Design Spec

> **Status:** Draft, 2026-06-27. Scoped MVP that satisfies the
> [`transcribe-mcr-text`](../transcribe-mcr-text/DESIGN-SPEC.md) §9.3 use
> case (open the source MCR PDF from a CRC review row) with the smallest
> viable surface area: a native-browser PDF tab, no PDF.js, no overlay,
> no autoscroll-to-bbox. Trades pixel-perfect highlighting for an order-
> of-magnitude reduction in scope.

---

## 1. Overview

**Purpose.** Today an applicant triaging a CRC review row can read the
verbatim source comment text (via the inline disclosure shipped with
[`transcribe-mcr-text`](../transcribe-mcr-text/DESIGN-SPEC.md) phase 1)
but cannot easily see that comment in document context. They have to
flip to the MCR PDF in a separate window and locate it themselves.

This spec adds one affordance: a per-row **`Open in MCR ↗`** link that
opens the source MCR PDF in a new browser tab. No in-app viewer, no
overlay, no specific-comment scroll — just the right PDF, in a tab,
rendered by the browser's native PDF viewer.

**Position in the CRC pipeline.**
```
generate-crc-guides skill        cityhall UI                  Substation
[ unchanged ]              ──→   [ Open in MCR ↗ per row ]  ──→ [ NEW: /api/crc/mcr-pdf ]
mcr.pdf uploaded to bucket       link to cityhall route          streams bytes from bucket
```

**Mental model.** The MCR PDF is already in the `crc-guides` Supabase
bucket at a path that's fully determined by the review's
`metadata.crcGuides.prefix`. This spec adds one Substation endpoint
that resolves that path and streams the bytes, plus a cityhall server
proxy + UI link that drives it. Mirrors the existing
`/completeness-check/pdf` pattern exactly — no new infrastructure.

**Out of scope for this iteration:**

- **Redline PDFs.** Only `mcr.pdf` is served. Rows whose
  `parent.source_type === 'pdf_redlines'` get no link in MVP. A future
  extension generalizes the endpoint to source-pdfs/* (see §9.1).
- **Autoscroll to bbox.** Native browser PDF viewers don't support
  arbitrary scroll-to-y APIs. The URL fragment `#page=N` is wired in
  (see §4.2) but only the page number is honored; the rect is not.
- **Highlighting.** Native PDF viewers don't expose annotation APIs.
  The user reads the comment text in the cityhall inline disclosure;
  the PDF tab is "show me this in document context."
- **PDF.js-based viewer with overlays.** Deferred — see
  [`transcribe-mcr-text` §9.3](../transcribe-mcr-text/DESIGN-SPEC.md#93-phase-3--pdfjs-viewer-with-autoscroll--bbox-overlay).
  This spec is the lighter-weight alternative to that phase 3 design.

---

## 2. Decisions captured

| # | Decision |
|---|---|
| D1 | One endpoint, MCR-only. Generic `source-pdf` endpoint deferred — name and surface chosen so `mcr-pdf` doesn't paint future redlines work into a corner (cityhall just adds a second link / endpoint if and when needed). |
| D2 | Byte-proxy through cityhall, not 302-to-signed-URL. Matches the proven `/completeness-check/pdf` pattern; avoids introducing signed-URL helpers; consistent observability and auth. ~3.5 MB per click via two hops is acceptable. |
| D3 | Auth reuses the existing cityhall→substation bearer-token forwarding pattern. No cookie-auth in substation, no token-in-URL. |
| D4 | The MCR PDF path is derived from `reviews.metadata.crcGuides.prefix` — same metadata blob the source-map endpoint already uses (per [`transcribe-mcr-text` §7.1](../transcribe-mcr-text/DESIGN-SPEC.md#71-get-apicrcsource-mapreviewiduuid)). No new DB schema. |
| D5 | Link is gated on the row having a known source page (`parent.bbox[0]?.page` populated in the source-map). When the bbox is empty, render disabled affordance with a tooltip. Avoids opening a 3.5 MB PDF to page 1 with no useful navigation. |
| D6 | `#page=N` fragment appended to the cityhall URL when available. Browser PDF viewers (Chrome/PDFium, Firefox/PDF.js) honor it; Safari is unreliable but degrades to page 1, which is the same as having no fragment. |
| D7 | No new caching layer. Substation streams from Supabase storage on each request (no in-process LRU — bytes are too big to cache, and Supabase storage is already CDN-fronted). Cityhall sets `Cache-Control: private, max-age=900` so the browser reuses the PDF within a session. |
| D8 | MVP gracefully degrades when `mcr.pdf` is missing from the bucket: substation returns 404, cityhall surfaces "MCR PDF unavailable." No hard error. |

---

## 3. Architecture

Three components, all small:

```
┌─────────────────────────────┐
│ Cityhall UI                 │  Phase-1 source-map disclosure already
│ (existing CRC review page)  │  renders. Add a single <a> link.
│                             │
│  [Source: SP33 ▾]           │
│  ┌──────────────────────┐   │
│  │ <verbatim parent…>   │   │
│  │ <mark>sub-span</mark>│   │
│  │                      │   │
│  │ Open in MCR ↗        │── │── href to cityhall route below
│  └──────────────────────┘   │
└──────────────┬──────────────┘
               │ target="_blank"
               ▼
┌─────────────────────────────┐
│ Cityhall server route       │  NEW: thin proxy mirroring
│ /project/[projectId]/review │  /completeness-check/pdf
│   /[reviewId]/mcr-pdf       │
│                             │  - validates session
│                             │  - forwards to substation
│                             │  - streams bytes back
└──────────────┬──────────────┘
               │ bearer token
               ▼
┌─────────────────────────────┐
│ Substation endpoint         │  NEW: /api/crc/mcr-pdf?reviewId=
│                             │
│                             │  - DB lookup of reviews.metadata
│                             │  - resolves bucket + prefix
│                             │  - downloads {prefix}mcr.pdf
│                             │  - streams bytes
└──────────────┬──────────────┘
               │
               ▼
        crc-guides bucket
        {prefix}/mcr.pdf
```

---

## 4. Substation endpoint

### 4.1 Wire contract

```
GET /api/crc/mcr-pdf?reviewId={uuid|rv_uuid}
Authorization: Bearer {token}

200 OK
  Content-Type: application/pdf
  Content-Disposition: inline; filename="{filename}"
  Cache-Control: private, max-age=900
  <PDF bytes>

401  - missing/invalid token
403  - authenticated but no project access
404  - review not found, not CRC, or mcr.pdf missing from bucket
500  - storage error
```

Filename is taken from `source_pdfs["mcr.pdf"].original_filename` in the
source-map when available, falling back to `mcr.pdf`. Lets the browser
title the tab usefully (e.g. "1700 S Lamar - U0 MCR.PDF").

### 4.2 Service implementation

New module at `substation/src/services/crc-mcr-pdf.ts`, paralleling
`crc-source-map.ts`. Pipeline:

1. Strip prefix from `reviewId` (`stripPrefix` per
   `docs/api-design.md` "Forgiving input, strict output").
2. `SELECT id, project_id, review_type, metadata FROM reviews WHERE id = ?`.
3. **Authorize first** — `requireProjectAccess(review.project_id, user.id, 'read')`
   before branching on `review_type` or metadata. Same defense-in-depth
   pattern as the source-map service (don't leak review existence or
   type to arbitrary logged-in users).
4. If `review.review_type !== 'crc'` → 404.
5. Read `metadata.crcGuides.{bucket, prefix}`. Either missing → 404.
6. `sb.storage.from(bucket).download(`${prefix}mcr.pdf`)`.
7. On 404 from storage → 404. Other storage errors → 500.
8. Return the Blob as a `Response` with the headers from §4.1.

**Caching.** No in-process LRU. The bytes are too large to cache
per-request (256 entries × 3.5 MB = 900 MB worst case), Supabase
storage is already CDN-fronted, and the `Cache-Control` header keeps
the browser from re-fetching within its 15-min window.

### 4.3 Route adapter

New file `substation/src/routes/crc-mcr-pdf.ts`, mirroring
`crc-source-map.ts`. Mounted alongside the source-map route under
`/api/crc/*`. Returns the Blob via `c.body(stream, status, headers)`.

### 4.4 Fragment handling for `#page=N`

The `#page=N` fragment is **not** added by substation. It is added by
cityhall when constructing the link `href` (§5.2). Fragments are
preserved by the browser end-to-end — they never appear in any HTTP
request, just in `window.location` once the PDF is rendered. Both
Chrome (PDFium) and Firefox (PDF.js) read the fragment and jump to the
target page automatically.

---

## 5. Cityhall

### 5.1 Server-side proxy

New file at
`cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/mcr-pdf/+server.ts`.

Mirrors `completeness-check/pdf/+server.ts` exactly:

```ts
import { error } from '@sveltejs/kit';
import { getEnvVar } from '$lib/get-env';
import { getAccessToken } from '$lib/server/substation';
import type { RequestHandler } from './$types';

const SUBSTATION_URL = getEnvVar('SUBSTATION_URL') ?? 'http://localhost:3001';

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const token = getAccessToken(locals);
  const url = `${SUBSTATION_URL}/api/crc/mcr-pdf?reviewId=${params.reviewId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw error(res.status, 'Failed to load MCR PDF');
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': res.headers.get('Content-Disposition') ?? 'inline; filename="mcr.pdf"',
      'Cache-Control': res.headers.get('Cache-Control') ?? 'private, max-age=900',
    },
  });
};
```

**Why proxy instead of redirect.** Top-level navigations (`<a target="_blank">`)
cannot send custom `Authorization` headers. Cookie-auth in substation
would work but expands substation's auth surface for one new endpoint —
the proxy keeps substation's auth model bearer-only and reuses the
existing pattern. ~3.5 MB through two hops is acceptable for a click
event the user is consciously waiting on.

### 5.2 Per-row link affordance

Inside the existing source-map disclosure panel (rendered when
`sourceMapIndex[checklistId]` resolves — see
[`transcribe-mcr-text` §9.1](../transcribe-mcr-text/DESIGN-SPEC.md#91-phase-1--inline-collapsible-source-mcr-text-mvp)),
add an `Open in MCR ↗` link at the bottom of the panel:

```svelte
{#if sourceMapEntry?.parent.source_type === 'mcr_text'}
  {#if sourceMapEntry.parent.bbox[0]?.page}
    <a
      href={`${page.url.pathname}/mcr-pdf#page=${sourceMapEntry.parent.bbox[0].page}`}
      target="_blank"
      rel="noopener"
      class="..."
    >
      Open in MCR ↗
    </a>
  {:else}
    <span class="text-muted" title="Page locator unavailable for this comment">
      Open in MCR (page unknown)
    </span>
  {/if}
{/if}
```

The link is **only rendered for MCR-sourced rows** (`source_type ===
'mcr_text'`). Redline rows get nothing in MVP. The disabled state
covers MCR rows whose generation-side bbox extraction failed and left
`bbox: []`.

The URL is **relative** to the current review page, so the proxy route
inherits the parent's `[projectId]`/`[reviewId]` params automatically.

### 5.3 No new fetch wiring

The source-map fetch + index already runs on review-page load
(`+page.svelte:286–316`). The link reads from `sourceMapIndex` —
nothing new to wire. The link itself is just markup.

---

## 6. Auth model

Same identity gate as the source-map endpoint, same wire format:

1. Browser navigates to the cityhall route. SvelteKit hooks
   authenticate the user via session cookie (existing machinery).
2. Cityhall server route reads `locals.user`, fetches the substation
   access token, and forwards the request to substation with
   `Authorization: Bearer {token}`.
3. Substation validates the bearer (existing middleware), then runs
   `requireProjectAccess(review.project_id, user.id, 'read')` before
   any branching on review type or metadata.

No new auth code on either side. Service-role callers (workflow
backfills, ops debug) bypass `requireProjectAccess` per the existing
`SourceMapServiceCaller.isServiceRole` pattern.

---

## 7. Edge cases & failure modes

### 7.1 MCR PDF not yet uploaded

The generation skill writes
`source_pdfs["mcr.pdf"].uploaded_to_bucket: true` once the upload
lands. If a generation pre-dates this flag (or the upload failed),
`mcr.pdf` isn't at `{prefix}mcr.pdf` and substation returns 404. The
cityhall route surfaces this as a 404 error page. The UI link should
NOT be gated on `uploaded_to_bucket` — gating on `bbox[0]?.page` is
sufficient because that's already the looser-bound condition, and a
404 fallback is acceptable for the rare race window.

### 7.2 Old reviews (pre-source-map)

Reviews whose `metadata.crcGuides` is missing entirely (predate the
source-map feature) → substation 404. Cityhall side: the source-map
fetch already returns `available: false`, the source disclosure
doesn't render at all, so the link never appears. Consistent with the
phase-1 behavior of the source-map work.

### 7.3 Large PDF latency

The MCR is ~3.5 MB. End-to-end: Supabase → substation (server-to-server,
fast) → cityhall (server-to-server) → browser (single 3.5 MB transfer).
First click takes ~1–3 seconds on a typical broadband connection.
Subsequent clicks within the 15-min cache window are instant. No
streaming required — `res.body` is a `ReadableStream` and the proxy
just pipes it through; browser shows the PDF's first page as soon as
the linearized prefix arrives.

### 7.4 Safari fragment behavior

Safari's built-in PDF viewer (Preview-based) honors `#page=N`
inconsistently across versions. When it doesn't, the user lands on
page 1 of the MCR. Acceptable degradation — the verbatim text is
already visible in the inline disclosure, so the PDF tab is
context-only.

### 7.5 Multiple links open

Nothing stateful — every click is a fresh top-level navigation. Users
can open many MCR tabs without bothering each other. Each tab gets its
own browser-PDF-viewer instance.

### 7.6 Bookmark / share semantics

The cityhall route is auth-gated and stable per `(projectId, reviewId)`.
A bookmarked URL keeps working as long as the user retains access to
the project. Shared URLs require the recipient to be authenticated and
authorized — same as any other cityhall review URL.

---

## 8. Telemetry

Worth tracking once shipped, but not blocking for MVP:

- Click-through rate on `Open in MCR ↗` per CRC review session.
  Indicates whether the link is load-bearing or vestigial.
- p50/p95 substation endpoint latency. Budget hazard if the storage
  download path slows down materially.
- 404 rate from substation, segmented by cause (review-not-found vs.
  mcr-missing). Sustained `mcr-missing` 404s indicate a regression in
  the generation-side upload manifest.

---

## 9. Open questions / future extensions

### 9.1 Generalize to redline PDFs

Today the endpoint hardcodes `mcr.pdf`. Two paths to extend:

- **Add a `source` query param** — `?reviewId=...&source=mcr|redline`,
  with `redline` requiring a `parentCommentId` to disambiguate which
  redline PDF (multiple may exist under `source-pdfs/`). Validate the
  resolved path against the source-map's `source_pdfs` map to prevent
  path traversal.
- **Sibling endpoint** — `/api/crc/redline-pdf?reviewId=...&parentCommentId=...`.
  Cleaner contract per type, slightly more code.

Defer the decision to whenever redline UX requires it. Both paths are
strict supersets of MVP.

### 9.2 In-app PDF.js viewer with overlay

The longer-term design lives in
[`transcribe-mcr-text` §9.3](../transcribe-mcr-text/DESIGN-SPEC.md#93-phase-3--pdfjs-viewer-with-autoscroll--bbox-overlay).
That work assumes per-item bboxes (`source_span.bbox`) are reliably
populated, which is currently held up by Phase 7.5 pdfplumber
anchoring. This spec ships value while that work matures, and is fully
compatible — the PDF.js viewer can replace the `<a>` link with a
clickable thumbnail or modal trigger without changing any of the
plumbing below it.

### 9.3 Pre-flight bbox-availability check

For an even smoother UX, cityhall could omit the link entirely when
no source page is known, instead of rendering the disabled state.
Trade-off: the disabled state advertises that this *would* work if the
data were there, which surfaces a real user complaint upstream
("why is this page-unknown?"). Disabled-with-tooltip preferred for
MVP.

### 9.4 Range requests

If the proxy ever needs to support seeking within a large PDF without
re-streaming, both substation and cityhall would need to honor
`Range:` headers. Not needed for MVP — browsers happily render full
3.5 MB downloads — but worth knowing if PDFs grow into the 50+ MB
range.

---

## 10. Rollout

### Phase 1 — this spec, ~½ day end-to-end

1. **Substation** —
   - `src/services/crc-mcr-pdf.ts` (service module mirroring
     `crc-source-map.ts`).
   - `src/routes/crc-mcr-pdf.ts` (Hono route adapter).
   - Register at `/api/crc/mcr-pdf` in the app router.
2. **Cityhall** —
   - `src/routes/(app)/project/[projectId]/review/[reviewId]/mcr-pdf/+server.ts`
     (proxy mirroring `completeness-check/pdf`).
   - Add the `Open in MCR ↗` link inside the source-map disclosure
     panel in the existing CRC review page component.
3. **Smoke test** — open the 1700 S Lamar CRC review, expand a row
   with a known source page (e.g. an SP-* row), click the link,
   verify the PDF opens in a new tab on the right page.

No generation-side changes. No database changes. No new packages.

### Pre-flight check

Before merging, confirm `mcr.pdf` is being uploaded to the bucket for
new generations. The gen-5 source-map for 1700 S Lamar currently
shows `source_pdfs["mcr.pdf"].uploaded_to_bucket: false`; if that's a
stale flag (file was uploaded but flag wasn't flipped), the smoke
test will pass anyway. If the file is truly missing, the smoke test
404s and we know to fix the upload first.

### Gate to phase-2 (PDF.js viewer per `transcribe-mcr-text` §9.3)

Real usage data on the MVP link informs whether the heavier viewer
work is worth doing. If applicants report "this is fine," phase-2
slides; if they report "I can't find the comment in the PDF,"
that's the signal to invest in autoscroll + highlight.

---

## 11. Risks

### 11.1 Token forwarding edge case

`getAccessToken(locals)` is the existing helper used by every other
cityhall→substation route. If the session is stale, the call returns
an expired token and substation rejects with 401. Cityhall already
handles 401 cascades elsewhere (existing route handlers throw
`error(401, ...)` and the global error boundary re-auths). No new
handling here.

### 11.2 Filename header sanitization

If the original filename contains unusual characters (the 1700 S
Lamar file has spaces and uppercase: `"1700 S Lamar - U0 MCR.PDF"`),
the `Content-Disposition` header needs RFC-5987-style encoding for
non-ASCII. Easy to handle when constructing the header in substation;
worth a unit test.

### 11.3 The 404-when-PDF-missing UX

If a user clicks the link and the MCR isn't in the bucket, they get
SvelteKit's default 404 error page in a new tab — jarring. Worth
adding a friendlier error route in cityhall for `/mcr-pdf` 404s.
Half a day of polish; defer until observed.
