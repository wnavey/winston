# CC checklist source UI: where each completeness-check item came from

**Status:** Draft v1
**Date:** 2026-10-07
**Repos touched:** `completion-officer` (new capture + locate tool), `bureau` (source manifest, per-version citations, URL-map fixes, one narrow CI workflow), `cityhall-new` (new private bucket + staff read policy migration, two staff pages)
**Repos NOT touched:** `conductor2`, `inspector-general`, `dsd`, `navalbase`

> **In one paragraph.** The 192 Austin completeness-check (CC) items in `v2.7-trimmed` each
> name one to three "Requirement Sources" (a free-text label such as `CC Submittal Checklist p.2,
> Addressing Review`), and `requirement-source-urls.tsv` maps each label to a URL. Nobody can see
> *where on that source* the item was extracted from, and we kept no copy of the sources. This
> spec captures an immutable snapshot of every source as a PDF, locates each item's passage on
> it with exact word-level boxes, records both in two JSON files in bureau, syncs them to a
> private bucket, and renders them on two staff pages in cityhall-new:
> `/intake-checklists/austin` (every item) and `/intake-checklists/austin/{item}` (the item's
> text plus each source page with its passage boxed). Linking CC review output to these pages
> and a job that detects source-page changes are deliberately deferred (§7).

---

## 1. Problem

### 1.1 The checklist has labels, not locations

- `bureau/jurisdictions/austin/completeness-check/CURRENT_VERSION` = `v2.7-trimmed`: 14 guide
  files (`cc-1.md` … `cc-24.md`), **192 items**, the same 192 ids as the left column of
  `v2.7-trimmed/cc-item-title-mappings.tsv`.
- Each item row carries a `Requirement Source` cell. Across the 192 items: **86** cite one
  source, **89** cite two, **17** cite three, so there are **315 (item, label) pairs** to locate.
  **98 distinct labels** are used.
- `requirement-source-urls.tsv` (version-independent, at the `completeness-check/` root) maps
  87 labels onto **17 distinct URLs** in use. **13 labels used by v2.7 have no row**:
  `CC Application form, Section 12` (×2), `CC Application, Section 6`, eight `DCM 1.2.2.*`
  subsections, `TCM 13.1.0`, `TCM 11.2.2.1(G), 11.2.3.2(B)`, `Code 14-11-41`.
- Source mix, counted per item (an item counts once per kind it cites):
  PDF **108** items · webpage **134** · Municode **24** · Word document **18** · Texas
  Administrative Code **2**. **43** items cite only webpages.

### 1.2 We never kept the sources

The completion-officer v2 Austin run (`completion-officer/research/austin/v2/`) wrote findings,
synthesis and the final checklists, but no copy of any source. (Its Cedar Park run kept PDFs in
`research/cedar-park/v1/tmp/`; Austin's did not.) The v2 run landed on 2026-04-03 (first commit of
`research/austin/v2/final/overview.md`), so any source edited since then no longer matches what
was extracted.

### 1.3 The sources are harder to fetch than their URLs suggest (verified 2026-10-07)

| Source | What a plain `curl` gets |
|---|---|
| widen `…/view/pdf/<id>/<name>.pdf` (7 PDFs) | **`text/html`, ~24 KB**: a pdf.js viewer page. The real PDF is a **signed, expiring** `https://previews.us-east-1.widencdn.net/preview/…?sig.expires=…` URL inside that HTML. Following it yields the PDF (`CC Submittal Checklist`: 6 letter pages, text layer present, 373 words on p.2). |
| widen `…/s/<id>/<name>` (Notes & Templates, Environmental instructions) | an HTML share page, not the file |
| `austintexas.gov/page/site-plan-requirements` | **301 → `/development-services/site-plan-requirements`**. All text is in the static HTML (46 KB of text), but its `ETag` and `Last-Modified` **change on every request** (Drupal render time), so HTTP validators say nothing about content. |
| `library.municode.com/...` | a **6 KB JavaScript shell**; the text only exists after rendering. |

The Requirements page's own headings (h3/h4: *Show the following on the Cover Sheet*,
*Compatibility Standards*, *Hill Country Roadway Corridor Requirements*, …) do **not** match
most of our label suffixes: `Requirements page, Data Table` is a list intro ("Data table with
the following:"), and `Requirements page, Section 10` matches no heading at all. Label suffixes
are search hints, not anchors.

### 1.4 What already exists to build on

- **Item registry in the DB.** Inspector General writes `bureau_checklist_version` +
  `bureau_checklist_item` on workflow completion
  (`inspector-general/src/lib/data/bureau-checklist-store.ts`). Prod has Austin `v2.7-trimmed`
  as `department_code='cc'`, version 11 (`27c8a669-…`, bureau `d0ff75e`, 192 items) with
  `checklist_item_id = 'cc-1:CC-1-01'` and `code_citation` = the Requirement Source string. The
  composite id this spec uses is the same key.
- **Municode section deep links.** Bureau's `codes/{ldc,dcm,tcm,ucm,…}/meta/locators.json` map
  every section file to its Municode `?nodeId=` URL (generator `tooling/src/locators`).
- **Box overlay UI in cityhall-new.** `src/components/ui/image-viewer/index.tsx` is a pan/zoom
  canvas whose `children` are laid over the image in percentage units and whose `focus` prop
  zooms to an `ImageRegion = {x, y, width, height}` normalized 0–1 from the top-left.
  `BlockBox` (`src/lib/reviews/view-model.ts:91`) is the same shape; `Lightbox`
  (`src/components/ui/lightbox/index.tsx:48`) and `MarkerThumbnail` exist.
- **Staff gating.** `requireStaff()` (`cityhall-new/src/lib/auth.ts:37`) 404s non-members via
  the `is_noetic_member` RPC. Page template is enforced by lint (`noetic/page-template`,
  `eslint.config.mjs:161`). Example: `src/app/(app)/runbook-runs/(list)/page.tsx`.
- **Storage read rules.** Screens use the user client (`src/lib/supabase/server.ts`); the
  service-role client is lint-banned outside an allowlist (`eslint.config.mjs:102-131`), and
  broad "authenticated can read" bucket policies were dropped
  (`20260920000000_drop_broad_storage_read_policies.sql`).
- **Bureau → DB sync precedent.** `.github/workflows/sync-bureau.yml` replicates
  `jurisdictions/**` into `bureau_nodes` on merge to main; it only syncs `.md`
  (`tooling/src/lib/sync/sync-bureau.ts:215`) and its `jurisdictions/**` path filter fires on
  nearly every commit.

## 2. Goals

1. Every source a v2.7 item cites has an immutable snapshot we own, rendered as a PDF with page
   images and a word-level text layer.
2. Every (item, label) pair has a citation: the page, the boxes, the quoted text, or an honest
   `not_found`.
3. A staff member can open `/intake-checklists/austin/{item}` and see the item, its group and
   id, and each cited source page with the passage boxed, plus a link to the live source.
4. Snapshots carry enough fingerprinting that a later job can tell whether a source changed
   and which items that affects (§7, deferred, but the data is captured now).
5. No bureau CI cost for commits outside the files this feature publishes.

## 3. Design

### 3.1 Vocabulary

- **Label:** a Requirement Source string from a guide row, e.g. `CC Application, Section 13`.
- **Snapshot:** one captured document, immutable, identified by `snapshot_id`. One URL can
  produce several snapshots (Municode: one per section) and one URL re-captured later produces
  a new snapshot.
- **Citation:** one (item, label) pair resolved to a snapshot page and boxes.
- **Item key:** `<group>:<local id>`, e.g. `cc-5:ADR-05`. Equal to
  `bureau_checklist_item.checklist_item_id`.

### 3.2 Two files, split by what they depend on

**D1. Snapshots are version-independent; citations belong to a checklist version.**

```
bureau/jurisdictions/austin/completeness-check/
├── requirement-source-urls.tsv          exists: label → URL (gains the 13 missing rows, D14)
├── sources/manifest.json                NEW: labels → snapshots, and every snapshot's record
└── v2.7-trimmed/source-citations.json   NEW: item → citations into snapshots
```

A new checklist version (v2.8) gets its own `source-citations.json` and reuses the manifest.
Both files are small, PR-reviewed and versioned with the checklist they describe. Binaries never
enter git (D10).

### 3.3 `sources/manifest.json`

**D2. Shape.**

```jsonc
{
  "jurisdiction": "austin",
  "generated_at": "2026-10-…Z",
  "snapshots": {
    "sn_cc-submittal_20261008": {
      "title": "CC Submittal Checklist",
      "url": "https://austin.widen.net/view/pdf/d7vma1dqla/SP_Consolidated…SubmittalChecklist.pdf",
      "resolved_url": "https://previews.us-east-1.widencdn.net/preview/…/SP_Consolidated…",  // signature stripped
      "format": "pdf",                       // pdf | html | docx | municode-section | tac
      "fetched_at": "2026-10-08T…Z",
      "capture": {
        "method": "widen-viewer",            // direct | widen-viewer | widen-share | chromium-print | municode-render | libreoffice
        "recipe_version": 1,
        "expand": null,                      // html only, see D6
        "hide": null,
        "tool": "completion-officer/tools/source-citations@<sha>",
        "chromium": null
      },
      "fingerprints": {
        "sha256_original": "…",
        "sha256_text": "…",                  // normalized visible text (D8)
        "sections": {},                      // html/municode only (D8)
        "http": { "etag": "…", "last_modified": "…", "content_length": 330669 },
        "source_identity": "widen-asset:c59f9e58-be72-428d-808b-2e4a6d4dd534"
      },
      "page_count": 6,
      "pages": [{ "n": 1, "width_pt": 612, "height_pt": 792 }],
      "has_text_layer": true,
      "storage_prefix": "austin/sn_cc-submittal_20261008/",
      "archive_paths": [],                   // html: page.mhtml, dom.html
      "supersedes": null,
      "last_checked_at": "2026-10-08T…Z",
      "last_changed_at": "2026-10-08T…Z"
    }
  },
  "labels": {
    "CC Submittal Checklist p.2":                    { "snapshot": "sn_cc-submittal_20261008", "page_hint": [2] },
    "CC Submittal Checklist p.2, Addressing Review": { "snapshot": "sn_cc-submittal_20261008", "page_hint": [2], "text_hint": "Addressing Review" },
    "CC Application, Section 13":                    { "snapshot": "sn_cc-application_20261008", "text_hint": "Section 13" },
    "LDC 25-8-121":                                  { "snapshot": "sn_ldc-25-8-121_20261008", "deep_link": "https://library.municode.com/tx/austin/codes/land_development_code?nodeId=…" }
  }
}
```

- `labels` is the only place a label string is parsed. `page_hint` comes from `p.N`;
  `text_hint` from the suffix after the comma. Both narrow the locate search; neither is
  trusted as an anchor (§1.3).
- `labels[*].snapshot` always points at the **current** snapshot for that label. Old snapshots
  stay in `snapshots` and in the bucket so older citations still resolve (D9).
- `source_identity` is the most stable identity the source exposes (widen asset UUID from the
  preview URL; Municode `nodeId`; canonical URL otherwise). A changed identity at the same URL
  is itself a change signal.

### 3.4 `<version>/source-citations.json`

**D3. Shape.**

```jsonc
{
  "jurisdiction": "austin",
  "checklist_version": "v2.7-trimmed",
  "bureau_commit": "<sha of the guide files matched>",
  "manifest_generated_at": "2026-10-…Z",
  "groups": { "cc-5": "Plan Content, Data Tables & Conditional Plan Requirements" },
  "items": {
    "cc-5:ADR-05": {
      "group": "cc-5",
      "local_id": "ADR-05",
      "section": "Addressing Review",
      "title": "Driveway access points, handicap parking, garages, and sidewalk access are identified on plans",
      "item_text": "Driveway access points, handicap parking, garages, and sidewalk access not identified on plans",
      "item_text_sha": "…",
      "citations": [
        {
          "label": "CC Submittal Checklist p.2, Addressing Review",
          "snapshot": "sn_cc-submittal_20261008",
          "status": "found",               // found | not_found | no_snapshot | unresolved_label
          "page": 2,
          "boxes": [{ "x": 0.074, "y": 0.412, "width": 0.84, "height": 0.034 }],
          "quote": "Identify driveway access, handicap parking, garages…",
          "word_ids": ["p2w188", "p2w214"],   // first and last word of the span
          "confidence": "high",              // high | medium | low
          "rationale": "Same four elements listed under Addressing Review.",
          "method": "text-layer",            // text-layer | vision
          "model": "claude-sonnet-5",
          "deep_link": "https://austin.widen.net/view/pdf/d7vma1dqla/…pdf#page=2",
          "located_at": "2026-10-08T…Z"
        }
      ]
    }
  }
}
```

- **Every label an item cites appears** as a citation, whatever its status. `not_found` is a
  result, not an omission.
- `group`, `title` and `item_text` are copied in so the pages read one file and never parse
  guide markdown. `title` comes from `cc-item-title-mappings.tsv`; `item_text` is the guide
  row's deficiency statement.
- `item_text_sha` lets a later version re-locate only items whose text changed.

**D4. Boxes are `{x, y, width, height}` normalized 0–1, origin top-left, in the page space of
the snapshot's `document.pdf`.** This is the exact `ImageRegion`/`BlockBox` shape cityhall-new
already renders (§1.4), so the page passes boxes straight to `ImageViewer` with no conversion.
Several boxes per citation when the passage wraps or spans columns. Word-level geometry in the
per-page text files stays in PDF points; conversion happens once, when citations are written.

### 3.5 Snapshot capture

**D5. Every source becomes one `document.pdf`.** The bucket layout per snapshot:

```
cc-source-snapshots/austin/<snapshot_id>/
  original.<ext>           as fetched (pdf, html, docx)
  document.pdf             what everything downstream uses
  pages/001.png …          rendered at 150 DPI from document.pdf
  text/001.words.json …    [{id:"p1w0", text, x0, top, x1, bottom}] in PDF points
  page.mhtml, dom.html     html/municode only: full archive + post-expansion DOM
```

**D6. Capture recipes, one per format.**

| Format | Recipe |
|---|---|
| widen `/view/pdf/` | fetch the viewer HTML, extract the `previews.*.widencdn.net` URL, download it immediately (it expires), record the asset UUID as `source_identity`. `document.pdf` = original. |
| widen `/s/` share | resolve the share page's download link the same way; a `.docx` then goes through LibreOffice. |
| plain PDF (`TIA_Determination_Worksheet.pdf`) | direct download; `document.pdf` = original. |
| webpage | headless Chromium (Playwright): load, follow redirects, **expand every collapsed region** (`[aria-expanded="false"]`, `<details>`, then re-check), hide `header, nav, footer` and cookie banners, then print to PDF as **one tall page** at the page's full scroll height so page breaks are never invented. A capture **fails** if any collapsed region remains. Archive `page.mhtml` + the post-expansion `dom.html`. |
| Municode section | the label resolves to a section through bureau's `codes/<code>/meta/locators.json` (`LDC 25-8-121` → its `?nodeId=` URL); render that URL like a webpage, print only the section's content container. One snapshot per section. |
| Texas Administrative Code (`texreg`) | render like a webpage. |

Expand-all rather than expand-relevant: it needs no knowledge of which panel matters, and it
also captures panels the city adds later. The verified Requirements page has no collapsed
markup in its static HTML today (§1.3), so this is a guard, not a known need for that page; other
city pages collapse content (per Will), so the guard stays.

**D7. A webpage citation is always `page: 1`** of its tall `document.pdf`, and its box is a
vertical position on that one page. The page image for a tall page is rendered at a width of
1275 px (150 DPI of 8.5 in) and whatever height results; the detail page opens it with
`ImageViewer focus` on the box (§3.8), so the reader never scrolls a 20,000 px image by hand.

**D8. Fingerprints are computed from text, not bytes, for anything rendered.**
`sha256_text` = SHA-256 of the visible text after expansion, NFC-normalized, whitespace
collapsed. For HTML and Municode, `sections` holds one entry per h2–h4 heading of the captured
page (`{ sha256_text, page, y_range }`), taken from the page's own headings. A citation's
section is whichever heading range contains its first box; label suffixes are never mapped to
headings by hand (§1.3). HTTP `etag`/`last_modified` are recorded for every fetch but are only
meaningful for PDFs (the Requirements page changes both per request).

**D9. Snapshots are immutable.** A re-capture writes a new `snapshot_id`
(`sn_<slug>_<yyyymmdd>`), sets `supersedes` to the previous one, and repoints
`labels[*].snapshot`. A re-capture whose `sha256_text` equals the current snapshot's writes
nothing and only bumps `last_checked_at`.

### 3.6 Locating each item's passage

**D10. Words come from the text layer; the model only picks the span.** For each (item, label)
pair:

1. **Narrow.** Candidate pages = `page_hint` if present, else every page. `text_hint`, when
   present, ranks pages that contain it first.
2. **Pick.** One model call per pair gets the item's `item_text` and `title`, the label, and
   the candidate pages' words as `id:text` tokens in reading order. It returns
   `{status, page, first_word_id, last_word_id, quote, confidence, rationale}` against a JSON
   schema. It may return `not_found`.
3. **Box.** Take the words from first to last id, group them by line, and emit one box per line
   run (merged where lines are contiguous). Pixel-exact because it is the PDF's own geometry,
   never a vision estimate.
4. **Verify.** Reject a pick whose `quote` does not appear verbatim (whitespace-normalized) in
   the selected words; retry once, then record `not_found` with the rejection in `rationale`.

`method: "vision"` exists only for a snapshot with `has_text_layer: false`; none of the
sources checked so far lacks a text layer, so the vision path is not built in this spec.

**D11. Model:** Claude Sonnet 5 through the Anthropic API, structured output. 315 pairs, each a
few thousand tokens of page text; a full run is a few dollars and minutes. The locate step is
re-runnable per item (`--items cc-5:ADR-05,...`) and per snapshot.

**D12. Human check before UI.** P2 ends with Will reviewing a sample of 15 citations (mixed
sources, mixed confidence) rendered as a static contact sheet before the pages are built.
`low`-confidence citations are badged on the detail page rather than hidden.

### 3.7 Where the tool lives, and how files get to the app

**D13. The capture + locate tool lives in `completion-officer/tools/source-citations/`**
(Python: Playwright, pdfplumber, the Anthropic SDK). completion-officer is the repo that authored
the checklists; its output files are committed to bureau by PR. The tool uploads binaries
directly to the bucket with an operator's service-role key at capture time (binaries never
transit git or CI).

**D14. Fix the 13 unresolved labels** by adding rows to `requirement-source-urls.tsv` (the
eight `DCM 1.2.2.*` and two `TCM` labels resolve to Municode sections through `locators.json`;
`CC Application form, Section 12` and `CC Application, Section 6` point at the CC Application
PDF; `Code 14-11-41` at the Code of Ordinances section). Same PR as the first manifest.

**D15. A new private bucket `cc-source-snapshots`** in the Noetic App project, created by a
cityhall-new migration together with one `storage.objects` SELECT policy:
`bucket_id = 'cc-source-snapshots' and is_noetic_member()`. Writes stay service-role only. The
pages read through the normal user client, so no eslint service-role exception is needed (§1.4).
The documents are public city documents; the bucket is private anyway because the citations
are internal work product.

**D16. A dedicated, path-filtered bureau workflow publishes the two JSON files.**
`bureau/.github/workflows/sync-cc-sources.yml`:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'jurisdictions/austin/completeness-check/sources/manifest.json'
      - 'jurisdictions/austin/completeness-check/*/source-citations.json'
      - 'jurisdictions/austin/completeness-check/CURRENT_VERSION'
  workflow_dispatch:
concurrency: { group: sync-cc-sources, cancel-in-progress: false }
```

The job sparse-checks-out `jurisdictions/austin/completeness-check` and runs
`sources/sync.sh`, which uploads each of the three files to
`cc-source-snapshots/austin/{manifest.json, citations/<version>.json, CURRENT_VERSION}` only when
its hash differs from the object already there. A push that touches none of those paths
creates no job and spends no runner minutes; guide edits (`cc-*.md`, TSVs) do not trigger it.
It uses the existing `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` repo secrets. It is not
a step inside `sync-bureau.yml`, whose `jurisdictions/**` filter fires on almost every commit.
(GitHub runs path-filtered workflows unconditionally if a push exceeds 1,000 commits or the diff
times out; the cost there is one no-op run.)

Rejected: the cityhall page fetching bureau through the GitHub API at request time (puts GitHub
availability and App-token minting on every page view, and the binaries need the bucket
anyway); bundling into the cityhall build (every bureau change would need a redeploy).

### 3.8 The pages

**D17. Two staff pages in cityhall-new**, both server components behind `requireStaff()`:

- `src/app/(app)/intake-checklists/austin/page.tsx`: `ListPage`. Reads
  `CURRENT_VERSION` and `citations/<version>.json` from the bucket. Items grouped by group
  (14 groups, in guide order), each row: item key, title, a source-count chip per citation
  status (`found` / `not_found` / unresolved), and the lowest confidence. Filters: group,
  has-unlocated-citation. Links to the detail page.
- `src/app/(app)/intake-checklists/austin/[itemKey]/page.tsx`: `DocumentPage`. Header: group
  name, item key, title, the full deficiency text. Then one tab per citation, primary-document
  PDFs first, webpages after. Each tab shows:
  - the label, snapshot title, captured date, and a confidence badge;
  - `ImageViewer` with `src` = signed URL of `pages/<page>.png`, `focus` = the union of the
    citation's boxes, and each box drawn as a percentage-positioned child;
  - the `quote` beneath the image;
  - **Open live source** (`deep_link`: `#page=N` for PDFs, a `#:~:text=` text fragment for
    webpages, the section `nodeId` for Municode) and **Download snapshot** (signed
    `document.pdf`), with the note "live source may differ from this snapshot of `<date>`";
  - for `not_found` / `unresolved_label`: the label, the snapshot link if any, and the
    `rationale`, with no image.
- A **Intake checklists** link in the staff block of `src/components/app/user-menu.tsx:77`.
- Reads are cached with Next's fetch cache, revalidated hourly; there is no write path.

**D18. The item key in the URL is the raw key**, `cc-5:ADR-05`; `:` is a legal path
character, and Next decodes it into `params.itemKey`. (See Q1.)

**D19. No DB tables in this MVP.** `bureau_checklist_item` already uses the same key (§1.4), so
the deferred review-output linking (§7) can join to it later; this spec adds no columns and no
rows.

## 4. Data sizes

| | Estimate |
|---|---|
| Snapshots | 7 widen PDFs + 1 plain PDF + 2 widen share docs + ~3 webpages + ~30 Municode sections + 2 TAC chapters ≈ 45 |
| Bucket footprint | PDFs ≤ 1 MB each; page PNGs ~150 KB per letter page; a tall webpage PNG may reach several MB. Total well under 200 MB. |
| `manifest.json` | ~45 snapshots + ~100 labels: tens of KB |
| `source-citations.json` (v2.7) | 192 items, 315 citations: ~200 KB |

## 5. Phases

| Phase | Repos | Scope | Exit |
|---|---|---|---|
| **P1 Capture** | completion-officer, cityhall-new | D5–D9, D13, D15 bucket; capture all PDF sources first, then webpages, Municode, Word, TAC | `manifest.json` covering every label; bucket populated |
| **P2 Locate** | completion-officer, bureau | D10–D12, D14; produce `v2.7-trimmed/source-citations.json`; Will's 15-citation review | review passed; bureau PR merged |
| **P3 Publish path** | bureau, cityhall-new | D15 read policy, D16 workflow + `sync.sh` | JSON visible in the bucket after a merge; a non-matching merge starts no job |
| **P4 Pages** | cityhall-new | D17, D18 | both pages live behind `requireStaff()` |

P1 can ship PDF sources before webpages; P2 can start on PDF-backed citations (108 of 192 items
have at least one) while webpage capture continues. P3 needs only the bucket from P1. P4 needs
P3 and at least a partial citations file. P4 can be developed against a local copy of the JSON.

## 6. Risks

- **Signed widen URLs expire.** Capture must download immediately after resolving; the stored
  `resolved_url` has its signature stripped and is not a working link.
- **Tall-page image size.** A long webpage may produce a PNG tens of thousands of pixels tall. If
  `ImageViewer` struggles, render webpage pages as vertical tiles and pick the tile containing the
  box (Q5).
- **City documents changed since v2.** Some passages may no longer exist; they surface as
  `not_found`. That is the correct result and is the first input to §7's change job.
- **Label quality.** Some labels are coarse (`LDC Title 25`, `DCM`). Their citations will mostly
  be `not_found` or `low` confidence until the labels are made specific in the guides.

## 7. Deferred

- **L1. Linking CC review output to its source.** A "Source" chip on each CC finding in the
  review UI that opens the same page-plus-box lightbox. Needs a join from a finding's checklist
  item to `source-citations.json` (or to `bureau_checklist_item`, D19).
- **L2. Source change detection.** A scheduled job that re-captures every current snapshot with
  its stored recipe, compares `sha256_text`, then section hashes, then checks each affected
  citation's `quote` against the new text, and reports per item: quote gone (guide likely needs
  an update), section changed (review), unrelated change (log), URL moved or 404 (flag every
  citing item). It should also re-check the city pages that *link* to each widen PDF, because a
  replaced document usually gets a new asset id rather than new bytes at the old URL. All the
  data it needs is captured by D2/D8/D9.

## 8. Open questions

- **Q1. URL form for an item.** `/intake-checklists/austin/cc-5:ADR-05` (D18, raw key) or a
  slug such as `cc-5-adr-05`? Proposed: raw key, because it is the key every other system uses.
- **Q2. Tool home.** `completion-officer/tools/source-citations/` (D13) or `bureau/tooling`
  (TypeScript/Bun, where the Municode locators generator lives)? Proposed: completion-officer.
- **Q3. Locate model.** Sonnet 5 (D11) or Opus 5.5 for the pairs that come back `low` on the
  first pass? Proposed: Sonnet first, re-run `low` pairs on Opus.
- **Q4. Audience.** Staff only (`requireStaff`, D17) or any signed-in user? Proposed: staff
  only for the MVP.
- **Q5. Tall pages.** One tall PNG (D7) or tiles? Decide after measuring the Requirements page
  in P1.
- **Q6. Multi-jurisdiction.** The paths carry `austin`; Cedar Park and New Braunfels have
  completion-officer runs too. Proposed: keep `austin` in every path and route
  (`/intake-checklists/[jurisdiction]` later), build nothing generic now.
