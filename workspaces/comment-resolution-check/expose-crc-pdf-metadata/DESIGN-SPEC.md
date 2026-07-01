# `expose-crc-pdf-metadata` — Design Spec

> **Status:** Draft, 2026-07-01. Cross-cutting design that touches both CRC
> generation skills (`generate-crc-guides`, `generate-crc-guides-from-redlines`),
> the substation API, and cityhall's CRC review page. Adds a per-review widget
> that surfaces every source PDF (MCR + N redline PDFs) that fed the current
> CRC guides generation, with clickable links to open each PDF in a new tab.
>
> Read [`../SPEC.md`](../SPEC.md) for the parent CRC architecture,
> [`../generate-crc-guides/DESIGN-SPEC.md`](../generate-crc-guides/DESIGN-SPEC.md)
> for the MCR-sourced skill, and
> [`../generate-crc-guides-from-redlines/DESIGN-SPEC.md`](../generate-crc-guides-from-redlines/DESIGN-SPEC.md)
> for the redlines-sourced skill. This document specifies what each of those
> skills, plus substation and cityhall, must add or change.

---

## 1. Overview

**Problem.** A CRC review can be driven by more than one source PDF. Today the
MCR is the primary source, but the redlines skill introduces per-department
redline PDFs (`Austin Water Redlines`, `Austin Energy Redlines`, …). A single
review's guides can come from an MCR **plus** one or more redline PDFs, each
processed by a different skill. The cityhall review page currently exposes
only the MCR (via the per-comment "Open in MCR" affordance on MCR-sourced
comment cards). There's no place a user can see "what set of source PDFs
produced this review" or open a redline PDF directly.

**Proposal.** Add a **Source PDFs widget** to the CRC review page, positioned
directly above the existing "Overall Results" section. The widget lists every
source PDF that contributed to the current generation and lets the user open
any of them in a new browser tab. To power that widget:

1. Both CRC generation skills write a small per-skill metadata fragment into
   the run's `source-pdfs/` folder and merge their entries into a shared
   top-level `source-pdfs-metadata.json`.
2. Substation gains a new endpoint `GET /api/crc/source-pdfs?reviewId=…` that
   reads the merged metadata and returns a normalized list of source-PDF
   entries with view URLs.
3. Cityhall renders the widget from that endpoint's payload.

**Non-goals.**

- Changing the per-comment "Open in MCR" behavior on MCR-sourced comment
  cards (that path already works and is out of scope). This widget is a
  parallel, review-level affordance — no page-anchor deep links.
- Surfacing which specific departments a given MCR drives in the widget UI.
  (Explicitly deferred — the info is derivable from `manifest.json` and
  `source-map.json`, but is intentionally not surfaced here.)
- Backfilling metadata for every historical CRC generation. Only new runs
  write the new artifacts, plus one surgical backfill of gen 6 of the
  Lamar + Collier project so the widget has data to demo against.
- AE Bluebeam / other future PDF sources. The metadata schema is designed to
  accept them without a bump, but no producer is defined here.
- A UI redesign. The widget is a small addition; existing content is
  untouched.

**Location.**

- Winston workspace: `winston/workspaces/comment-resolution-check/expose-crc-pdf-metadata/DESIGN-SPEC.md` (this file).
- Skill changes: `~/noetic/claude-plugins/plugins/noetic-tools/skills/generate-crc-guides/` and `.../generate-crc-guides-from-redlines/`.
- Substation route: `substation/src/routes/crc-source-pdfs.ts` + `substation/src/services/crc-source-pdfs.ts`.
- Cityhall widget: new component under `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/`, rendered from `+page.svelte` immediately above the "Overall Results" section (line 1660 today).

---

## 2. Storage layout changes

### 2.1 Uniform `source-pdfs/` folder

Today the two skills disagree on where the source PDF lives inside a
generation directory:

| Skill | Current behavior |
|---|---|
| `generate-crc-guides` | Copies MCR to `{gen}/mcr.pdf` at the generation root. |
| `generate-crc-guides-from-redlines` | Copies each redline PDF to `{gen}/source-pdfs/{original_filename}.pdf`. |

**New rule.** Both skills write into `{gen}/source-pdfs/`. Specifically:

- MCR skill: `{gen}/source-pdfs/mcr.pdf` (the local copy the skill maintains
  for traceability — see `generate-crc-guides/DESIGN-SPEC.md` Phase 1).
- Redlines skill: `{gen}/source-pdfs/{original_filename}.pdf` (unchanged from
  today).

The generation-root `{gen}/mcr.pdf` copy is **retained** by the MCR skill in
addition to the new `source-pdfs/mcr.pdf` copy for the transition window
(see §7 for the deprecation path). Both files point at the same bytes; disk
cost is one extra ~3.5MB per generation and is acceptable.

### 2.2 Per-skill metadata fragments

Each skill writes a small metadata fragment describing the PDF(s) it
generated into the same folder. Fragments are namespaced by skill so both
skills can write into the same generation directory without collision.

| Skill | Fragment path | Contains |
|---|---|---|
| `generate-crc-guides` | `{gen}/source-pdfs/metadata-mcr.json` | Single entry describing `mcr.pdf`. |
| `generate-crc-guides-from-redlines` | `{gen}/source-pdfs/metadata-redlines-{dept-code}.json` | One or more entries, one per source PDF that contributed to this dept's guide. |

Fragment shape is identical (one array of entries — the redlines fragment
just carries multiple entries when the skill's `merge` mode has appended
sources over multiple invocations). See §3 for the entry schema.

### 2.3 Merged top-level `source-pdfs-metadata.json`

Each skill is also responsible for **merging its fragment into a shared
top-level file** at `{gen}/source-pdfs-metadata.json`. Merge rules:

- The file is a single JSON object: `{ schema_version, generation_number, updated_at, entries: [...] }`.
- Each entry is keyed by `file_slug` (see §3). A skill that re-runs replaces
  its own entries (matched by `generated_by_skill` + `file_slug`) and leaves
  other entries untouched.
- Merges are read-modify-write. Because the CRC generation directory is
  never accessed by two concurrent skill runs in practice (skills are
  interactive Claude Code sessions, one at a time), no locking is needed.
  If the file is malformed on read, the skill fails loudly rather than
  silently overwriting.

**Why both fragments AND a merged file?**

- Fragments give traceability (which skill wrote which entries — the
  fragment filename encodes the origin).
- Merged file is what substation reads. Substation does not merge on the
  fly — one storage GET per request instead of N.
- If a fragment is ever revised without a merge, `source-pdfs-metadata.json`
  is out of date but present. A `bd doctor`-style skill diagnostic (deferred)
  could cross-check fragments vs. merged file.

### 2.4 Directory layout after this change

```
{gen}/
  source-pdfs/
    mcr.pdf                                       # MCR skill (new location)
    1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf   # redlines skill
    metadata-mcr.json                             # MCR skill fragment
    metadata-redlines-aw.json                     # redlines skill fragment (AW)
    metadata-redlines-ae.json                     # redlines skill fragment (AE, future)
  source-pdfs-metadata.json                       # merged: shared read target
  mcr.pdf                                         # legacy copy, retained during transition (§7)
  manifest.json                                   # unchanged (MCR skill)
  manifest-redlines.json                          # unchanged (redlines skill)
  redlines-source-tracker.json                    # unchanged (redlines skill)
  source-map.json                                 # unchanged
  crc-*.md                                        # unchanged
  figures/                                        # unchanged
```

---

## 3. Metadata schema

### 3.1 Entry shape

Every entry in a fragment file and in `source-pdfs-metadata.json` has this
shape:

```jsonc
{
  "schema_version": "1.0",
  "file_slug": "mcr",                      // §3.2 — API route key
  "filename": "mcr.pdf",                   // filename as stored under source-pdfs/
  "original_filename": "1700 S Lamar U0 MCR.pdf",  // as uploaded by the user; for Content-Disposition
  "kind": "mcr",                           // "mcr" | "redlines"
  "department_code": null,                 // "aw", "ae", ... when kind=redlines; null when kind=mcr
  "department_label": null,                // "Austin Water (Redlines)", ...; null when kind=mcr
  "generated_by_skill": "generate-crc-guides",  // skill name that wrote the entry
  "generated_by_skill_version": "1.1.0",   // skill's own version string
  "generation_number": 6,                  // CRC generation number (matches directory name)
  "sha256": "aae036fc89f296fd943a2f0ad9fe5a89cf0e65f9c81ac482331b48cd89799208",
  "size_bytes": 3548007,
  "uploaded_at": "2026-06-30T20:04:36.206Z"
}
```

**Fields grouped by consumer.**

| Consumer | Fields it uses |
|---|---|
| Substation API (routing) | `file_slug`, `filename` |
| Substation API (response) | `file_slug`, `original_filename`, `kind`, `department_code`, `department_label` |
| Cityhall widget (rendering) | `file_slug`, `original_filename`, `kind`, `department_code`, `department_label` |
| Diagnostic / provenance (not exposed to widget) | `sha256`, `size_bytes`, `uploaded_at`, `generated_by_skill`, `generated_by_skill_version`, `generation_number` |

Per Q12 the widget itself renders only `filename`, `file_slug`, `kind`, and
(when `kind=redlines`) `department_code` + `department_label`. Everything
else is retained in the payload for future needs / debugging.

### 3.2 `file_slug` convention

`file_slug` is the stable key the substation API uses to route requests to
the correct PDF. It is **not** the original filename — original filenames
contain spaces, punctuation, and encoding hazards. Rules:

| Skill | Slug |
|---|---|
| MCR skill | Always `mcr`. Exactly one entry with this slug per generation. |
| Redlines skill | `{department_code_lower}_redlines`. Example: `aw_redlines`, `ae_redlines`. Exactly one entry with this slug per generation (the redlines skill's `merge` mode appends **rows** to a single dept guide from multiple PDFs — but per §3.3 we no longer collapse those into one metadata entry). |

**Uniqueness enforced within a generation.** The merged file cannot contain
two entries with the same `file_slug`. Enforced by the skill on write; if a
collision is detected the run fails loudly with a message pointing at both
entries.

**Slug hazard when a department contributes ≥2 redline PDFs.** See §3.3.

### 3.3 Multiple redline PDFs per department (per Q4)

Per the redlines skill's `merge` versioning mode, a single dept's guide file
can be extended with rows from a second (or third, …) PDF. The
`redlines-source-tracker.json` already tracks this as a `sources[]` array
under the dept file.

**Widget requirement (per Q4):** show these as **separate entries** in the
widget, so a user can click either PDF individually.

**Slug scheme when ≥2 PDFs per department:**

- First PDF: `{dept}_redlines` (unchanged).
- Subsequent PDFs: `{dept}_redlines_{n}` where `n = 2, 3, …` matches the
  index in the dept's `sources[]` array.

Example — Austin Water contributed 2 PDFs (water + wastewater):

```
aw_redlines      → 1700-aw-redlines-water.pdf
aw_redlines_2    → 1700-aw-redlines-wastewater.pdf
```

The redlines skill assigns slugs at merge time, so the second and later
entries can't be mistaken for reruns of the first. The fragment file
(`metadata-redlines-aw.json`) accumulates all entries for that dept.

### 3.4 `source-pdfs-metadata.json` envelope

```jsonc
{
  "schema_version": "1.0",
  "generation_number": 6,
  "updated_at": "2026-06-30T20:04:36.206Z",
  "entries": [
    { /* one entry per §3.1 */ },
    ...
  ]
}
```

Envelope fields:

- `schema_version` — matches the entries. Bumped in lockstep. Major bump ==
  breaking; substation refuses `2.x`+ per the pattern in `crc-source-map`.
- `generation_number` — matches the directory. Redundant with the directory
  path but useful in error messages and for diagnostic tooling.
- `updated_at` — updated by whichever skill wrote the merged file last.
- `entries` — flat array, no grouping. Order: MCR first (if present), then
  redlines sorted by `department_code` ASC then slug ASC.

### 3.5 Filtering: dropped-PDF policy (per Q6)

An entry MUST NOT appear in a fragment or in `source-pdfs-metadata.json` if
its source PDF produced **zero surviving atomic items** in the emitted guide.

- MCR skill: emit the `mcr` entry only when `manifest.json.counts.emitted_items > 0`.
  (In practice this is essentially always true — the MCR skill fails
  earlier if there are no comments.)
- Redlines skill: emit an entry for a given source PDF only when at least one
  row in the dept guide traces back to that PDF via
  `redlines-source-tracker.json`'s `sources[].row_id_range`.

If every PDF is filtered out for a given dept, that dept has no fragment
file at all (and no widget row).

---

## 4. Substation API

### 4.1 New endpoint: `GET /api/crc/source-pdfs`

**Request.**

```
GET /api/crc/source-pdfs?reviewId={uuid|rv_uuid}
```

**Response — success (200).**

```jsonc
{
  "available": true,
  "generation_number": 6,
  "entries": [
    {
      "file_slug": "mcr",
      "kind": "mcr",
      "original_filename": "1700 S Lamar U0 MCR.pdf",
      "department_code": null,
      "department_label": null,
      "view_url": "/api/crc/source-pdf?reviewId=rv_.../fileSlug=mcr"
    },
    {
      "file_slug": "aw_redlines",
      "kind": "redlines",
      "original_filename": "1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf",
      "department_code": "aw",
      "department_label": "Austin Water (Redlines)",
      "view_url": "/api/crc/source-pdf?reviewId=rv_.../fileSlug=aw_redlines"
    }
  ]
}
```

**Response — unavailable (200).**

```jsonc
{ "available": false }
```

Returned when the review is not CRC, when `reviews.metadata.crcGuides` is
missing, or when `source-pdfs-metadata.json` cannot be fetched from storage.
The widget renders nothing in this case. Matches the shape used by
`/api/crc/source-map` for cityhall's degradation branch.

**Response — errors.**

- `401` — unauthenticated.
- `403` — authenticated but no `read` access to the review's project.
- `500` — storage or DB failure that isn't "not found". Body follows the
  standard `ApiError` shape.

### 4.2 View URL generation

`view_url` is generated by substation using a slug-keyed sibling endpoint
(§4.3). Substation formats the URL relative to itself; cityhall proxies
through its existing substation client. No filenames appear in the URL.

Why slug-keyed and not filename-keyed (per Q8):

- Original filenames contain spaces and other characters that survive URL
  encoding but complicate proxying / logging / caching. The slug is
  guaranteed to be a URL-safe short identifier.
- The slug decouples the API contract from filename churn — a redlines
  skill re-run that renames a source PDF (e.g. after the user renames the
  input on disk) doesn't invalidate deep links to the CRC review page.

### 4.3 Sibling endpoint: `GET /api/crc/source-pdf`

**Request.**

```
GET /api/crc/source-pdf?reviewId={id}&fileSlug={slug}
```

Where `{slug}` is one of `mcr`, `{dept}_redlines`, `{dept}_redlines_{n}`.

**Behavior by kind.**

| Slug pattern | Behavior | Rationale |
|---|---|---|
| `mcr` | Byte-stream through substation. `Content-Type: application/pdf`, `Content-Disposition: inline` with `original_filename`, `Cache-Control: private, max-age=900`. | Mirrors existing `/api/crc/mcr-pdf`. MCR is small (~3.5MB) so streaming is fine. |
| `{dept}_redlines[_N]` | 302 redirect to a signed Supabase URL, 60-minute TTL (per Q9). No `Cache-Control` on the 302 response. | Redline PDFs are ~127MB. Streaming through Vercel is expensive and slow. Matches the existing `/api/crc/redline-pdf` pattern. |

The 60-minute TTL differs from the 15-minute TTL used by
`/api/crc/redline-pdf` (which is called at click-time from every comment
card and can afford a shorter window). The widget's use case is "user opens
a PDF and reads for a while," so 60 minutes is a better fit.

### 4.4 Resolution pipeline

Both endpoints follow the same DB / storage resolution pattern used by
existing CRC endpoints:

1. Strip prefix from `reviewId` (accept `rv_<uuid>` or raw uuid).
2. Look up the review: `id, project_id, review_type, metadata`.
3. Authorize FIRST via `requireProjectAccess(project_id, user.id, 'read')`.
   Service-role callers bypass. This ordering matches the security pattern
   in `crc-mcr-pdf.ts` — do not leak review existence/type before auth.
4. 404 with code `crc_source_pdfs_not_available` if `review_type !== 'crc'`.
5. Parse `metadata.crcGuides` for `{ bucket, prefix }`. Missing → 404.

**For `/api/crc/source-pdfs`:**

6. Download `{prefix}source-pdfs-metadata.json`. Storage 404 →
   `{ available: false }`. Other errors → 500.
7. Validate schema (Zod). Version mismatch (≥ 2.x) → `{ available: false }`.
8. Fan out to compute `view_url` for each entry (pure function; no I/O).
9. Sort per §3.4.
10. Return the payload.

**For `/api/crc/source-pdf`:**

6. Download `{prefix}source-pdfs-metadata.json` (cached; see §4.5).
7. Look up the entry by `file_slug`. Not found → 404 with code `pdf_slug_not_found`.
8. Compute the storage path — `{prefix}source-pdfs/{entry.filename}` — and
   either fetch the bytes (mcr) or generate a signed URL (redlines).
9. Set headers per the table in §4.3 and respond.

### 4.5 Caching

`source-pdfs-metadata.json` is small (~1-4 KB) and effectively immutable per
generation prefix. Reuse the LRU pattern from `crc-source-map`:

- In-process `Map`-based LRU.
- TTL 1 hour, max 256 entries.
- Key: `{bucket}:{prefix}`.
- Values: the parsed JSON. NOT the derived response — `view_url` is trivial
  to recompute and doesn't need caching.

The PDF bytes themselves are not cached in-process (per the same reasoning
as `crc-mcr-pdf`: too much memory, storage is CDN-fronted, browser
`Cache-Control` handles repeat clicks).

### 4.6 Route file layout

```
substation/src/
  routes/
    crc-source-pdfs.ts      # list endpoint (thin adapter)
    crc-source-pdf.ts       # single-PDF resolver (thin adapter)
  services/
    crc-source-pdfs.ts      # list logic + LRU cache
    crc-source-pdf.ts       # single-PDF logic (reuses the list service's cache for metadata reads)
```

Both routes register in `src/index.ts` alongside the existing CRC routes at
lines 107-125.

---

## 5. Skill changes

### 5.1 `generate-crc-guides` (MCR skill)

**Phase 1 addition.** After copying the MCR PDF to `{gen}/mcr.pdf`, also
copy it (or hard-link, or symlink — implementation choice) to
`{gen}/source-pdfs/mcr.pdf`. Both copies persist for now; §7 covers the
deprecation of the root copy.

**Phase 8 addition.** After emitting `manifest.json`, write a metadata
fragment and merge it into `source-pdfs-metadata.json`.

Fragment (single entry — MCR is one file per generation):

```jsonc
// {gen}/source-pdfs/metadata-mcr.json
{
  "schema_version": "1.0",
  "generation_number": <int>,
  "updated_at": "<ISO-8601>",
  "entries": [
    {
      "schema_version": "1.0",
      "file_slug": "mcr",
      "filename": "mcr.pdf",
      "original_filename": "<from manifest.json.inputs.mcr_pdf_original_path>",
      "kind": "mcr",
      "department_code": null,
      "department_label": null,
      "generated_by_skill": "generate-crc-guides",
      "generated_by_skill_version": "<manifest.skill_version>",
      "generation_number": <int>,
      "sha256": "<from manifest.json.inputs.mcr_pdf_sha256>",
      "size_bytes": <bytes>,
      "uploaded_at": "<ISO-8601>"
    }
  ]
}
```

**Merge rule.** Load `{gen}/source-pdfs-metadata.json` if it exists; create
otherwise. Replace any existing entry with `file_slug: "mcr"` (matches
this skill's exclusive slug). Preserve other entries verbatim. Sort per
§3.4. Write back.

**Phase 10 (Supabase upload) addition.** The upload set gains:

- `source-pdfs/mcr.pdf` (new location; the existing root `mcr.pdf` upload
  remains until §7 rollout completes).
- `source-pdfs/metadata-mcr.json`.
- `source-pdfs-metadata.json`.

**`skill_version` bump.** `1.0.0` → `1.1.0` per Q14.

### 5.2 `generate-crc-guides-from-redlines` (redlines skill)

**Phase 2 (crop) — no change.**

**Phase 7 (emit) addition.** After writing `crc-{dept-code}-redlines.md`,
`redlines-source-tracker.json`, `ignored-comments-redlines.md`, and
`manifest-redlines.json`, write the fragment and merge into
`source-pdfs-metadata.json`.

Fragment (one entry per source PDF that contributed rows to this dept — see
§3.3 for the multi-PDF-per-dept case):

```jsonc
// {gen}/source-pdfs/metadata-redlines-aw.json
{
  "schema_version": "1.0",
  "generation_number": <int>,
  "updated_at": "<ISO-8601>",
  "entries": [
    {
      "schema_version": "1.0",
      "file_slug": "aw_redlines",
      "filename": "1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf",
      "original_filename": "1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf",
      "kind": "redlines",
      "department_code": "aw",
      "department_label": "Austin Water (Redlines)",
      "generated_by_skill": "generate-crc-guides-from-redlines",
      "generated_by_skill_version": "1.1.0",
      "generation_number": <int>,
      "sha256": "<from manifest-redlines.json.inputs.source_pdf_sha256>",
      "size_bytes": <bytes>,
      "uploaded_at": "<ISO-8601>"
    }
  ]
}
```

**Filtering (per §3.5 / Q6).** Skip fragment entries whose source PDF
contributed zero rows to the dept file after all filters. In practice this
means: if `redlines-source-tracker.json` has no `sources[]` entry for a
source PDF (or the entry's `row_id_range` is empty), skip the metadata
entry.

**Merge rule.** Same read-merge-write pattern. Replace any existing entries
with a `file_slug` starting with `{dept_code}_redlines` (i.e. this skill's
exclusive slug prefix for this dept). Preserve other entries verbatim.

**Multi-PDF per dept.** When the skill runs in `merge` mode and appends a
second source PDF to an existing dept, the second entry gets slug
`{dept}_redlines_2` (per §3.3). The fragment file accumulates both entries.
The merge into `source-pdfs-metadata.json` replaces both.

**Phase 9 (Supabase upload) addition.** The upload set gains:

- `source-pdfs/metadata-redlines-{dept-code}.json`.
- `source-pdfs-metadata.json`.

`source-pdfs/{filename}.pdf` is already uploaded today — unchanged.

**`skill_version` bump.** `1.0.0` → `1.1.0` per Q14.

### 5.3 New shared reference file

Both skills load and use the same merge logic. Ship a shared reference
under the MCR skill:

```
generate-crc-guides/references/source-pdfs-metadata.md
```

Contents: schema definition (§3), slug convention (§3.2), fragment vs
merged-file rules (§2.2 – §2.3), and the merge-write algorithm (read →
strip own entries → append new entries → sort → write).

The redlines skill references it via relative path
(`../generate-crc-guides/references/source-pdfs-metadata.md`), matching the
existing pattern for shared reference files across the two skills (see
`generate-crc-guides-from-redlines/DESIGN-SPEC.md` §7).

---

## 6. Cityhall widget

### 6.1 Placement

The widget renders **directly above** the existing "Overall Results"
section in the CRC review page:

- File: `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.svelte`
- Insert location: immediately before line 1660 (`<!-- Overall Results -->`).

It renders only when the review is a CRC review (existing `isCrc` guard
already gates the Overall Results block; the widget is inside the same
`if (isCrc)` branch).

### 6.2 Component

New Svelte component:

```
cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/CrcSourcePdfsWidget.svelte
```

**Data loading.** Fetched at page load via `+page.ts`'s existing loader,
alongside the source-map fetch:

```ts
// +page.ts (existing pattern for source-map fetch)
const sourcePdfsResp = await fetch(`${SUBSTATION_URL}/api/crc/source-pdfs?reviewId=${reviewId}`);
const sourcePdfs = await sourcePdfsResp.json();
```

The endpoint returns `{ available: false }` for non-CRC reviews and reviews
without a metadata file (per §4.1). The component renders nothing in that
case.

### 6.3 Rendering

Widget structure:

```
┌─────────────────────────────────────────────────────────────┐
│ Source PDFs                                                 │
├─────────────────────────────────────────────────────────────┤
│ 📄 Master Comment Report                                    │
│    1700 S Lamar U0 MCR.pdf                    [Open in new] │
│                                                             │
│ 📕 Austin Water (Redlines)                                  │
│    1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf     │
│                                                             │
│    [Open in new tab]                                        │
└─────────────────────────────────────────────────────────────┘
```

Rendering rules by kind:

- **`kind: "mcr"`.** Title row shows "Master Comment Report" (styling
  reused from existing MCR affordances — see `CommentCard.svelte`'s
  "Open in MCR" button for the visual language). Below it, the
  `original_filename`. One "Open in new tab" affordance targeting
  `view_url`.
- **`kind: "redlines"`.** Title row shows `department_label`. Below it, the
  `original_filename`. One "Open in new tab" affordance. When multiple
  redline entries exist for the same `department_code`, they render as
  separate top-level rows (per Q4) — no grouping/collapsing.

Sort order matches the API response (MCR first, then redlines by dept code
then slug).

### 6.4 What the widget explicitly does NOT show (per Q12)

- File size (`size_bytes`).
- Skill name / skill version / generation number (`generated_by_skill*`).
- Upload timestamp.
- SHA256.

These fields are in the payload for future needs but the MVP UI is
deliberately minimal.

### 6.5 Interaction

Clicking any "Open in new tab" affordance:

1. Opens `view_url` in a new browser tab (`target="_blank" rel="noopener"`).
2. For MCR: substation byte-streams the PDF with `Content-Disposition:
   inline` — browser renders the PDF in the tab.
3. For redlines: substation 302-redirects to a signed Supabase URL —
   browser follows the redirect and PDF.js range-fetches directly from
   Supabase storage (matches the existing pattern in
   `/api/crc/redline-pdf`).

No page-anchor deep links — the widget opens each PDF at page 1 regardless
of what comments cited it. Per the user's brief: "just like how that's
supported inline for CRC command cards of source = mcr … but without the
specific page."

### 6.6 Empty / error states

- `{ available: false }` from the endpoint → widget does not render (no
  placeholder, no error). The rest of the page renders unchanged. This
  covers non-CRC reviews AND CRC reviews from before this spec ships
  (except the surgically-backfilled gen 6 — see §8).
- API 500 → widget renders a small inline error: "Source PDFs could not
  be loaded." Non-blocking; rest of page unaffected.

---

## 7. Transition: MCR PDF path

The existing `/api/crc/mcr-pdf` endpoint reads `{prefix}mcr.pdf`. After this
spec ships, that file lives at `{prefix}source-pdfs/mcr.pdf`. Two options
considered:

- **A. Breaking rename.** Change `/api/crc/mcr-pdf` to read only
  `{prefix}source-pdfs/mcr.pdf`. Breaks every historical CRC generation
  that didn't write to the new location.
- **B. Fallback ladder.** `/api/crc/mcr-pdf` tries
  `{prefix}source-pdfs/mcr.pdf` first, falls back to `{prefix}mcr.pdf` on a
  storage 404 (per Q1). Adds one extra storage HEAD/GET on the fallback
  path but keeps all historical runs working.

**Chosen: B (per Q1).**

**Implementation.** In `src/services/crc-mcr-pdf.ts`, replace the single
`sb.storage.from(bucket).download(\`${prefix}mcr.pdf\`)` call with an
inline `tryDownloadWithFallback` helper that tries
`${prefix}source-pdfs/mcr.pdf` first, then `${prefix}mcr.pdf`, returning
the first non-error response. Log which path was taken (structured log for
metrics — no user-visible change).

**MCR skill parallel write.** During the transition window, the MCR skill
writes to **both** `{gen}/mcr.pdf` (root, legacy) and
`{gen}/source-pdfs/mcr.pdf`. After ~1 month of new runs — and a one-off
backfill sweep for any historical generations that are still active in
production — the skill can be simplified to write only the new location,
and the fallback in `/api/crc/mcr-pdf` can be removed.

The retirement of the root-level copy is out of scope for this spec but
recorded in §11 as a follow-up.

---

## 8. Backfill: gen 6 of Lamar + Collier

Per Q13, no bulk backfill; but surgically fix
`{projectId=23301a8a}/{submissionId=cf1201c2}/{versionNumber=4}/{gen=6}` so
the widget has a real dataset to demo against.

**Scope.** Add the following files (locally and re-upload to Supabase
storage bucket `crc-guides` at the same relative path):

1. `source-pdfs/mcr.pdf` — a copy of the existing `{gen}/mcr.pdf`.
2. `source-pdfs/metadata-mcr.json` — one MCR entry (§5.1).
3. `source-pdfs/metadata-redlines-aw.json` — one AW-redlines entry (§5.2).
4. `source-pdfs-metadata.json` — merged from the two fragments.

**Data sources for the backfill.**

| Field | Source |
|---|---|
| MCR `original_filename` | `manifest.json.inputs.mcr_pdf_original_path` — basename. |
| MCR `sha256` | `manifest.json.inputs.mcr_pdf_sha256`. |
| MCR `size_bytes` | `stat` on the local file (3,548,007 bytes today). |
| MCR `uploaded_at` | `manifest.json.uploaded_files[].uploaded_at` for the row where `path == "mcr.pdf"`. |
| Redlines `original_filename` | `manifest-redlines.json.inputs.source_pdf_filename`. |
| Redlines `sha256` | `manifest-redlines.json.inputs.source_pdf_sha256`. |
| Redlines `size_bytes` | `stat` on the local file (127,487,999 bytes today). |
| Redlines `uploaded_at` | `manifest-redlines.json.supabase_upload.uploaded_at`. |
| `generated_by_skill_version` | Hardcoded to `"1.1.0"` for the backfill (schema-conformant even though the skill wasn't at that version when gen 6 was originally run — this metadata reflects the schema, not the historical skill state). |

**Backfill mechanism.** Ad-hoc — a Claude Code session running a small
one-off script, or manual `mcp__claude_ai_Supabase__storage_upload` calls.
Not a permanent tool.

The existing gen-6 files are NOT modified — only new files are added.

---

## 9. Testing

### 9.1 Substation

Integration tests in `substation/src/routes/crc-source-pdfs.integration.test.ts`:

- 200 happy path with both MCR and redlines entries.
- 200 with only MCR entry.
- 200 with only redlines entries (no MCR — supports the case where the
  redlines skill runs against a submission where the MCR skill hasn't been
  invoked yet in this generation).
- 200 `{ available: false }` when review is not CRC.
- 200 `{ available: false }` when `source-pdfs-metadata.json` missing from
  storage.
- 200 `{ available: false }` when schema version ≥ 2.x.
- 401 unauthenticated.
- 403 authenticated without project read access.
- 500 on storage errors that aren't "not found".

Integration tests in `substation/src/routes/crc-source-pdf.integration.test.ts`:

- 200 byte-stream for `fileSlug=mcr` — verify `Content-Type`,
  `Content-Disposition` (uses `original_filename`), `Cache-Control`.
- 302 redirect for `fileSlug=aw_redlines` — verify signed URL includes
  `token` query param, TTL ~60 min.
- 404 when `fileSlug` not in metadata.
- Auth error paths identical to the list endpoint.

### 9.2 Skills

Skill smoke tests (dry-run mode) verify:

- MCR skill writes both `source-pdfs/mcr.pdf` and `source-pdfs/metadata-mcr.json`.
- MCR skill's merge into `source-pdfs-metadata.json` replaces the MCR
  entry and preserves any pre-existing redlines entries.
- Redlines skill writes `source-pdfs/{filename}.pdf` and
  `source-pdfs/metadata-redlines-{dept}.json`.
- Redlines skill's `merge` mode assigns `{dept}_redlines_2` to a second
  PDF and both entries survive the merge into `source-pdfs-metadata.json`.
- Filtering per §3.5: a source PDF with zero surviving rows produces no
  metadata entry.

### 9.3 Cityhall

E2E test in the existing cityhall test rig:

- Widget renders above the "Overall Results" heading.
- Clicking the MCR "Open in new tab" link hits `/api/crc/source-pdf?fileSlug=mcr`.
- Clicking a redlines link hits `/api/crc/source-pdf?fileSlug=aw_redlines`.
- Widget does not render when `available: false`.

Manual verification against the backfilled gen 6 of Lamar + Collier.

---

## 10. Rollout order

1. **Ship the spec** (this PR).
2. **Substation endpoints land** with the fallback ladder in
   `/api/crc/mcr-pdf` (§7) so existing MCR PDF links continue to work.
   Endpoints handle the `{ available: false }` case for reviews without
   metadata, so shipping them is safe before any producer writes the file.
3. **Skills bump** (`generate-crc-guides`, `generate-crc-guides-from-redlines`)
   to write the new artifacts. Skill `1.0.0` → `1.1.0`.
4. **Cityhall widget** ships. Behind an `isCrc` guard, so non-CRC reviews
   are unaffected. Renders empty when `available: false`, so CRC reviews
   from before step 3 also render unchanged.
5. **Surgical backfill of Lamar + Collier gen 6** so there's at least one
   real review to demo against.

Steps 2, 3, and 4 can proceed in parallel — none depends on the others
being deployed first.

---

## 11. Deferred / follow-ups

- **Retirement of the root-level `mcr.pdf`.** After ~1 month, drop the
  double-write from the MCR skill and drop the fallback ladder from
  `/api/crc/mcr-pdf`.
- **Bulk backfill for all historical CRC generations.** Not needed for MVP
  — old reviews simply don't get the widget. If it becomes valuable later,
  a script iterates every `{project}/{submission}/{version}/{gen}` prefix
  in the `crc-guides` bucket and constructs `source-pdfs-metadata.json` on
  the fly from `manifest.json` + `manifest-redlines.json` +
  `source-map.json`.
- **Department mapping in the MCR entry.** Q5 explicitly deferred surfacing
  which departments the MCR drives. If a future UI decision wants that, the
  data is already in `manifest.json.counts.by_dept` — we'd extend the entry
  schema (minor bump `1.1`) with a `departments[]` array and update the
  MCR skill to populate it.
- **AE Bluebeam and other future PDF sources.** Schema accommodates
  additional `kind` values without a bump. No producer defined yet.
- **`bd doctor`-style diagnostic** to cross-check fragments against the
  merged file. Not needed until fragment/merged drift is observed.
- **Widget grouping affordance** for departments with ≥2 redlines PDFs.
  Current design shows them as separate top-level rows. If lists get long,
  a "AW Redlines (2 files)" collapsible group is a small follow-up.
- **Storage HEAD to populate `size_bytes` when metadata is missing.** Not
  needed today — skills know the size at write time — but useful if a
  future producer skips the write.

---

## 12. Open items (small defaults, flag for redirect)

- **`file_slug` case.** All lowercase (`mcr`, `aw_redlines`). Not `MCR` or
  `AW_REDLINES` — URL-safety and consistency with `crc-{dept-code}` guide
  filenames in existing skills.
- **`generation_number` in the entry AND the envelope.** Redundant with
  the directory path but useful in log messages. Keep.
- **Merge-write conflict detection.** If two entries with the same
  `file_slug` from different skills ever appear, fail the run rather than
  silently pick one. In practice `mcr` is exclusive to the MCR skill and
  `{dept}_redlines[_N]` is exclusive to the redlines skill, so this
  shouldn't happen — but detect it loudly if it does.
- **Backfill script location.** Not a permanent skill. Author it inside a
  scratch dir (`aw-analysis/` or a fresh workspace) and delete after use.
