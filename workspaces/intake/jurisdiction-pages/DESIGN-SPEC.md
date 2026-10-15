# Intake checklist pages per jurisdiction: a homepage and a page per source

**Status:** Draft v1.1
**Date:** 2026-10-15

> **Revision note v1.1 (2026-10-15, reply from the db-schema session on winston#314):**
> - **None of §5 is decided.** Will has not ruled on the db-schema audit. The db-schema session will recommend R1–R4 in the shape now in §5. Its new finding A18 recommends that bureau stays the source of truth and the DB is a read replica shaped for the app; every request here is a read, so they fit either way.
> - **D2:** the source slug is minted in bureau as `source_id` in `sources/manifest.json`, the way item IDs live in `intake-ids.tsv`. Deriving it from the snapshot id is now only the fallback until that field exists. P3 adds the field.
> - **D4:** semver (audit A2) and the generating run (A6) show only when present.
> - **D1:** the citation status vocabulary comes from cc-source-citations' `schemas.ts`. Neither cityhall nor the DB redefines it.
> - **§5 R5:** item URLs once stable IDs exist, as the db-schema session proposes.
**Parent:** `workspaces/intake/north-star/NORTH-STAR-SPEC.md`. The north star lists "customer-facing UI for checklists beyond the existing `/intake-checklists/[jurisdiction]` pages" as out of scope (§7). This spec is that UI, for the pages that exist today.
**Builds on:** `workspaces/completeness-check/checklist-source-ui/DESIGN-SPEC.md` (Approved v2, winston#297/#298), which built today's two pages, the `cc-source-snapshots` bucket and the citation JSON.
**Coordinates with:** `workspaces/intake/db-schema/DESIGN-SPEC.md` v1.2 and its audit (winston#314, `AUDIT-2026-10-14.md`). §5 lists what these pages ask of the db-schema v2 tables.
**Repos touched:**
- `cityhall`: a jurisdiction homepage, a source page, the item list moved to `/items`, a shared source-index library, and cross-links from the item page
- `bureau`: optional manifest fields `document_title` and `doc_type`, written by intake-prospecting and backfilled once for Austin

**Repos NOT touched:** `conductor2`, `substation`, `inspector-general`, `dsd`, `completion-officer`, and the CC runbook

## Problem

`/intake-checklists/austin` is a flat list of 192 items. It does not say what the checklist is, which version is live, or what it was built from. The sources, the documents the checklist cites, can only be seen one item at a time. Verified 2026-10-15 against cityhall `origin/main` @ a14d1ca and bureau `origin/main`.

**What the pages do today** (`src/app/(app)/intake-checklists/`):
- `[jurisdiction]/page.tsx` (`ListPage`) renders a title, the subtitle `name · version · N items`, a group filter (`?group=`), an "unlocated" chip (`?unlocated=1`), and one table per group. There is no index page at `/intake-checklists`, and the only entry point is the staff admin sidebar (`src/components/app/app-shell.tsx:371`).
- `[jurisdiction]/[checklistKey]/page.tsx` (`DocumentPage`) renders one item. It shows one tab per citation, an `ImageViewer` of each cited page PNG with that item's boxes drawn on it, the quote, and links to the live source and the snapshot. This is the only place a snapshot is shown.
- **Data:** the pages make one Postgres read, `jurisdictions (slug, name)` (`[jurisdiction]/read.ts:34`). Everything else is downloaded from the private bucket `cc-source-snapshots`: `<slug>/CURRENT_VERSION`, `<slug>/citations/<version>.json` and `<slug>/manifest.json`, all validated with zod (`src/lib/intake-checklists/source-citations.ts`). The pages use no `intake_*` table, RPC or view, and no such table exists yet.
- **The item key** `cc-1:CC-1-01` is `{group}:{local id}`. The code treats it as an opaque key: `readItemKey` only URI-decodes it, and `intakeItemHref` builds an absolute path because a relative `cc-1:…` would be read as a URL scheme (`source-citations.ts:140-151`).
- **Boxes** are `{x, y, width, height}`, normalized 0–1 from the page's top-left, in the page space of the snapshot's `document.pdf` (checklist-source-ui D7a). Page images are `<storage_prefix>pages/NNN.png`.

**What Austin's data holds** (bureau `jurisdictions/austin/completeness-check/sources/manifest.json` and `v2.7-trimmed/source-citations.json`):
- **28 snapshots, 26 of them cited** by the current version:
  - 9 PDFs, most of them `pdf-direct` from widen;
  - 1 webpage, the Requirements page, captured as 20 panel pages;
  - 18 Municode sections.
- **315 citations:** 300 `found`, 8 `not_found`, 6 `document_level` (a whole code, no snapshot) and 1 `no_snapshot`.
- **The sources are cited very unevenly:**

  | Source | Items citing it | Regions | Most regions on one page |
  |---|---|---|---|
  | Requirements page | 133 | 135 | 27 |
  | CC Submittal Checklist | 61 | 61 | 30 (page 5) |
  | AW Completeness Checklist | 30 | 33 | 18 |
  | AW General Info Sheet | 14 | 15 | 11 |
  | Notes and Templates DOCX | 11 | 14 | 4 |
  | CC Application | 8 | 11 | 3 |
  | 20 others | 1–8 each | | |

  16 of the 18 Municode snapshots are cited by exactly one item each.
- **78 of 316 regions overlap another item's region** on the same page. Of the 316, 300 are `high` confidence and 16 are `medium` ("section-level").
- **Titles in the manifest come from citation labels, not from the documents.** Today a snapshot's title is `CC Submittal Checklist`, while the PDF itself is titled *Consolidated Site Plan Completeness Check Submittal Checklist*. The PDF `Title` metadata can't fill the gap on its own: of the 9 Austin PDFs, 4 carry the right title, 2 carry `02`, and 3 carry none. The intake-prospecting runbook's discovery already records a real `title` and a `doc_type` for every source (prospecting-runbook D5, `sources.json`), but `sources.json` stays in the run dir, and the manifest it publishes carries neither field.

**Jurisdiction metadata is thin in the App DB.** `jurisdictions` has `slug, name, short_name, status, submission_label_convention, conventions, bureau_commit`, plus `jurisdiction_departments`. It has no state, population or portal column. The Library DB's `jurisdictions` table has population, government structure, code platform and permitting-system vendor, but it is keyed by uuid with no slug (north-star §2.6). Nothing joins the two.

**A possible access gap (unverified).** The `authenticated` policy on `jurisdictions` shows a row only when the caller can see a project in that jurisdiction (`tables/jurisdictions.sql:23-28`). A signed-in user with no project in Austin would get a 404 from `read.ts`, even though the bucket is readable by any signed-in user (Q3).

---

## 1. The design at a glance

Three pages per jurisdiction instead of two. The homepage replaces today's list page, which moves to `/items`. One library function inverts the citation JSON into a per-source index that both new pages read.

```diff
 src/app/(app)/intake-checklists/[jurisdiction]/
-├── page.tsx                      # ListPage: every item
+├── page.tsx                      # Homepage: metadata · version summary · source tiles (D2–D5)
+├── items/
+│   └── page.tsx                  # ListPage, moved unchanged (+ ?source= filter, D11)
+├── sources/
+│   └── [source]/
+│       ├── page.tsx              # SourcePage: 70 % snapshot with every box · 30 % item rail (D6–D10)
+│       ├── source-viewer.tsx     # client: PdfViewer + renderPageOverlay + hover/select state
+│       └── loading.tsx
 ├── [checklistKey]/
-│   └── page.tsx                  # DocumentPage
+│   └── page.tsx                  # DocumentPage + "See every item on this source →" per tab (D12)
 ├── read.ts                       # unchanged reads; still the bucket
 └── group-filter.tsx

 src/lib/intake-checklists/
 ├── source-citations.ts           # + optional document_title, doc_type on the manifest schema
+├── source-index.ts               # buildSourceIndex(manifest, citations) → SourceIndex (D1, S1)
+└── source-index.test.ts
```

```text
/intake-checklists/austin                              homepage
├── /items                                             today's list (moved)
├── /sources/cc-submittal-checklist                    one source, every box
└── /cc-1:CC-1-01                                      one item (unchanged URL)
```

---

## 2. Decisions

### 2.1 Data

**D1. One pure function builds the per-source index from the two files the pages already read.** `buildSourceIndex(manifest, citations): SourceIndex` in `src/lib/intake-checklists/source-index.ts`:

```ts
type SourceIndex = {
  sources: SourceEntry[]            // one per source slug that the current version cites, ordered (D4)
  documentLevel: DocRef[]           // citations with status document_level / no_snapshot / unresolved_label: label + deep_link
  stats: { items: number; groups: number; citations: Record<CitationStatus, number> }
}
type SourceEntry = {
  slug: string                      // D2
  snapshotId: string                // the snapshot this version cites (D2)
  title: string                     // document_title ?? title (D5)
  format: "pdf" | "webpage" | "municode-section"
  docType: DocType | null           // from the manifest when present (D5)
  url: string; fetchedAt: string; pageCount: number; storagePrefix: string
  items: SourceItem[]               // in document order: first region's (page, y), then key
  unlocated: SourceItem[]           // cite this source but have no region on it (not_found)
  pages: Map<number, PlacedRegion[]>// page → every region on it, each tagged with its item and marker number
}
```

- It reads nothing and calls nothing, so it can be tested on the real Austin files (S1).
- **The citation status, confidence and flag vocabularies** are the ones cc-source-citations defines in `runbooks/cc-source-citations/scripts/schemas.ts`, which cityhall's zod already mirrors. Neither this function nor the db-schema tables adds a value.
- Both new pages call `readChecklistSources` (unchanged) and then this function. Building the index costs one pass over 192 items and 315 citations per request, on data Next already caches for an hour.
- When the db-schema v2 tables exist, a second reader can return the same `SourceIndex` from Postgres and the pages don't change (§5).

**D2. A source is addressed by a stable slug, not by its snapshot id.**
- A snapshot id is `sn_<slug>_<yyyymmdd>-<hash8>`, for example `sn_cc-submittal-checklist_20261007-158d3960`. The date and hash change on every recapture, so a URL built on them would break on the next run.
- **The slug is minted in bureau** as `snapshots[id].source_id` in `sources/manifest.json` (P3). Every snapshot of the same source carries the same `source_id`, and cc-source-citations and intake-prospecting own it, the way item IDs live in `intake-ids.tsv`. Bureau is the source of truth for checklists, so the DB copies the key and never mints one (db-schema audit A18, recommended).
- **Until P3 lands, the slug is derived:** the snapshot id with `sn_` and the `_<date>-<hash>` suffix removed (`cc-submittal-checklist`), matched by `^sn_(.+)_\d{8}-[0-9a-f]{8}$`. A snapshot id that doesn't match uses the whole id. P3's Austin backfill writes exactly these derived values, so no URL changes when the field arrives.
- **Which snapshot a slug shows:** the newest snapshot of that slug that the current version cites. Citations of an older snapshot of the same slug (an incremental run that recaptured only some sources) are listed in the rail with "cited on the `<date>` capture" and their boxes are not drawn, because the pages may differ. Austin has no `supersedes` today, so this case has no instance yet.
- The route is `/intake-checklists/[jurisdiction]/sources/[source]`. The fixed `sources/` segment never collides with an item key: Next.js matches a static segment before `[checklistKey]`, and it stays unambiguous once item keys become stable IDs such as `austin-0042` (north-star D6), which a bare `/austin/<source-slug>` would not be.

### 2.2 The homepage, `/intake-checklists/[jurisdiction]`

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ Intake checklists › Austin                                                     │
│ City of Austin, TX                                    [active] · 14 departments│
│ Intake: Consolidated Site Plan · formal · decided 2026-10-14       (D3, Q1)    │
├───────────────────────────────────────────────────────────────────────────────┤
│ Checklist v2.7-trimmed · 192 items in 14 groups · bureau 9817d54 · 2026-10-07  │
│ Sources: 300 of 315 citations located · 8 not located · 6 whole-code · 1 none  │
│ Groups: [CC-1 Application Package · 12] [CC-2 … · 24] …       All items →      │
├───────────────────────────────────────────────────────────────────────────────┤
│ Documents and web pages (10)                                                   │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                                    │
│ │ thumb  │ │ thumb  │ │ thumb  │ │ thumb  │   title · PDF · 6 pp               │
│ │        │ │        │ │        │ │        │   61 items · captured 2026-10-07   │
│ └────────┘ └────────┘ └────────┘ └────────┘                                    │
│ Code sections (16)          LDC 25-8-121 · 1 item   LDC 25-5-3 · 1 item  …     │
│ Cited without a snapshot    LDC Title 25 ↗ · DCM ↗ · …                         │
└───────────────────────────────────────────────────────────────────────────────┘
```

**D3. The metadata block shows only facts the App DB or bureau already hold.**
- From `jurisdictions`: `name`, `status`, and the count of `jurisdiction_departments` rows.
- From `jurisdiction_intake`, once db-schema P2b has synced it: `application_type`, `basis`, `decided_at`, and `evidence.summary` as one line under a disclosure. Until that row exists, the block shows `name` and `status` only, and leaves the space empty rather than printing "unknown".
- Library-DB facts (population, permitting system, code platform) are Q1. They need a slug-to-Library-id link that doesn't exist yet.

**D4. The version summary is computed from the citation file.**
- It shows the version label (`CURRENT_VERSION`), item and group counts, `bureau_commit` as a short sha linked to the bureau commit, `generated_at`, and the citation status counts from `SourceIndex.stats`.
- It also shows one chip per group with its item count, each linking to `/items?group=<group>`.
- When the db-schema version row exists, it adds the semver (audit A2) and the generating run (`generated_by`, A6: the `runbook_runs` uuid plus the run name) (§5, R3). Both are optional and shown only when present, because Will has not ruled on A2 or A6. This block changes; nothing else does.
- **No generated prose summary.** A model-written paragraph would be one more artifact to keep in step with the checklist. The evidence summary from `intake.yaml` (D3) is the human-reviewed prose there is.

**D5. One tile per source, in two tiers.**
- **Tier 1, documents and web pages** (`format` `pdf` or `webpage`): a card grid. Each card has:
  - a thumbnail of page 1;
  - the title;
  - a format badge (PDF / Web page);
  - the page count;
  - the number of items citing it;
  - the capture date;
  - a `doc_type` badge when the manifest has one.

  The card links to the source page.
- **Tier 2, code sections** (`municode-section`): a compact list (title · items), each linking to its source page. 16 of Austin's 18 are cited by one item, so cards would bury tier 1.
- **Tier 3, cited without a snapshot:** `SourceIndex.documentLevel`, as labels with their `deep_link` to the live code. There is no page to open.
- **Order:** by items cited, descending, then title. A source that no current item cites is not shown (2 of Austin's 28).
- **Thumbnails:** a signed URL of `<storage_prefix>pages/001.png` with `{ transform: { width: 480, resize: "contain" } }`. cityhall already uses Supabase image transforms (`src/app/project/[projectId]/sheet-image/[sheetVersionId]/route.test.ts:132`, `document/[documentId]/file/route.ts:60`). Signed in one `createSignedUrls` call per page render, as `signSourceObjects` does.
- **Title:** `document_title ?? title`. `document_title` is an optional new manifest field (P3), because neither the label-derived `title` nor the PDF metadata is good enough (§Problem).

### 2.3 The source page, `/intake-checklists/[jurisdiction]/sources/[source]`

```text
┌───────────────────────────────────────────────────────────┬───────────────────────────┐
│ ‹ Austin · Consolidated Site Plan Completeness Check …     │ 61 items cite this source │
│ PDF · 6 pages · captured 2026-10-07 · Open live ↗ · ⤓      │ [sort: document | group]  │
├───────────────────────────────────────────────────────────┼───────────────────────────┤
│  page 5                                                    │ ① cc-1:CC-1-01      ↗     │
│  ┌─────────────────────────────────────────────┐          │   CC Application in pkg   │
│  │ ①▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔             │          │   "Completed application…"│
│  │ ②▔▔▔▔▔▔▔▔▔▔▔                                │          │   high · also: CC App ↗   │
│  │    ③▔▔▔▔▔▔▔▔▔▔▔▔▔▔ ④▔▔▔▔▔▔                    │          │ ② cc-1:CC-1-02      ↗     │
│  │ …                                           │          │   …                       │
│  └─────────────────────────────────────────────┘          │ ─ Not located here (2) ─  │
│  page 6 …                                       (≈70 %)   │   cc-22:CC-22-25 ↗ (≈30 %)│
└───────────────────────────────────────────────────────────┴───────────────────────────┘
```

**D6. Layout: the snapshot on the left at ~70 %, the item rail on the right at ~30 %.**
- At `lg` and up, a two-column grid (`grid-cols-[7fr_3fr]`). The document column scrolls; the rail is `sticky` at the page's full height and scrolls on its own.
- Below `lg`, the rail stacks under the document. That is enough for v1, and is in Not yet specified.
- The header carries the title (D5), format, page count, capture date, **Open live source** (the snapshot `url`), **Download snapshot** (signed `document.pdf`) and the same "live source may differ from this snapshot of `<date>`" note the item page shows.

**D7. The snapshot renders with `PdfViewer` over `document.pdf`, with boxes in `renderPageOverlay`.**
- Every snapshot, webpages and Municode sections included, has a `document.pdf`, and the boxes are already in its page space (checklist-source-ui D7a). So one viewer covers all three formats with no conversion.
- `PdfViewer` (`src/components/ui/pdf-viewer/index.tsx`) already gives continuous scrolling, ranged loading, a text layer, `renderPageOverlay(index0, {width, height})`, and `scrollToPage(page, region)`. The review document pages draw markers the same way (`src/components/reviews/document-pages.tsx:53-67`, `SheetMarkers` per page).
- Today's item page uses an `ImageViewer` per region instead. That fits one region, but not a whole document with every box on it.
- **Every page is rendered**, not only the pages with boxes, because the point of the page is to see the source whole. pdf.js renders lazily as pages scroll in.
- **Webpage snapshots** label each page with its panel title (`pages[n].section`) above the page, since a page there is an accordion panel (checklist-source-ui D8/D9).

**D8. Every region on the page is drawn, numbered by the rail.**
- **Numbering:** the rail lists items in document order, by first region (page, then `y`), and numbers them ①…ⓝ. That number is local to this page. Every region of item ⓝ on this source carries a small ⓝ tag at its top-left, so an item cited in two places shows its number twice.
- **Boxes:** each region's boxes are drawn as they are stored: one box per line run, the same outline the item page draws (`bg-blue-700/10 ring-2 ring-blue-700`).
  - `medium` ("section-level") regions use a dashed ring, so a box that marks a whole section doesn't read as a precise quote.
  - The 78 overlapping regions are drawn as they are. Hover and selection (D9) separate them.
- **Not drawn:** citations with no region on this source (`not_found`, a superseded snapshot, D2). They are listed in the rail's "Not located here" section with their status and rationale.

**D9. The rail and the boxes are linked both ways.**
- **Hovering** a rail card highlights that item's boxes, and hovering a box highlights its card.
- **Clicking a card** selects it and calls `scrollToPage(page, union of the region's boxes)` for its first region. A second click moves to its next region, when it has more than one.
- **Clicking a box** selects its item and scrolls the rail to its card. When several regions lie under the click point, which happens on overlaps, a small popover lists those items and the user picks one.
- **The selection lives in the URL** as `?item=<key>`, so a selected item can be linked to. The item page's cross-link (D12) uses it.
- This state is client-only, in `source-viewer.tsx`. The server component passes it a serializable `SourceEntry`.

**D10. A rail card shows the item as it relates to this source.** Each card shows, in this order:
1. the number;
2. the key, in mono;
3. **an open-in-new-tab link to the item page**: `intakeItemHref(slug, key)` with `target="_blank" rel="noopener"` and an ↗ icon. It is the card's only link; clicking anywhere else on the card selects it (D9).
4. the title, or else `item_text`;
5. the group name;
6. the quote from this source's region, clamped to 3 lines;
7. confidence and flags, when they are not `high` with no flags;
8. **"Also cited in"**: chips for the item's other sources, each linking to that source's page with `?item=<key>`.

A **sort control** switches between document order (the default) and group order.

### 2.4 The pages around it

**D11. Today's list page moves to `/intake-checklists/[jurisdiction]/items`, unchanged.**
- It gains a `?source=<slug>` filter beside `?group=` and `?unlocated=1`, and the homepage links to it ("All items →", the group chips, and an "items" link on each tile).
- **Old links:** nothing links to the list page with a filter except the page itself; the review Source ↗ link targets the item page. The homepage takes the bare URL, so no redirect is needed.

**D12. The item page links to the source pages.**
- Each citation tab on `[checklistKey]/page.tsx` gains **"See every item on this source →"**, linking to `/sources/<slug>?item=<key>`.
- The breadcrumb becomes `Intake checklists › Austin › Items › <key>`.
- The item URL itself doesn't change. The review Source ↗ link (`src/app/project/[projectId]/review/[reviewId]/read.ts:68-69`) keeps working.

**D13. Access is unchanged: `requireUser()` and the bucket's authenticated-read policy** (checklist-source-ui D20). The new pages read only what the existing pages read. The `jurisdictions` policy gap is Q3.

**D14. The manifest gains three optional fields, written at publish time.**
- `snapshots[id].source_id` is the stable source slug (D2). It is carried from the superseded snapshot on a recapture, and minted from the label-derived slug for a new source. Two different sources may never share one; the sync workflow's validator checks that.
- `snapshots[id].document_title` is the document's own title. intake-prospecting's `3.1-write` copies `sources.json` `title` into it, matching on `source_key` = `url`.
- `snapshots[id].doc_type` is one of `intake_instrument | template | regulatory | design_manual | informational`, from `sources.json` (prospecting-runbook D5).
- **Austin backfill:** one bureau PR sets all three fields on its 28 snapshots: `source_id` from D2's derived slug, and `document_title` and `doc_type` by hand. `cc-source-citations` `1.2-capture` must carry all three forward on an unchanged snapshot, and on a recapture of the same source, so the next run doesn't drop them.
- The sync workflow's JSON schema and cityhall's zod `Snapshot` both accept the fields as optional. Old manifests keep parsing, and the UI falls back to `title` and no badge.

---

## 3. Testing seams

**S1: `buildSourceIndex(manifest, citations)`** (new)
- **Proves:**
  - D1, D2: slug derivation, including a non-matching id, and newest-cited-snapshot selection with a superseded fixture.
  - D4: status counts.
  - D5: tier assignment and ordering.
  - D8: document-order numbering, multi-region items, overlaps kept, unlocated split out.
  - D14: `document_title ?? title`.
- **On the real Austin files** (vendored as a fixture): 26 sources, 6 document-level citations, `cc-submittal-checklist` with 61 items and 30 regions on page 5, `requirements-page` with 133 items.
- **Prior art:** `src/lib/intake-checklists/source-citations.test.ts` with `source-citations.fixtures.ts`.
- **Runs:** `pnpm test` (vitest), locally and in the `check` CI job.

**S2: the three pages, rendered against a local bucket** (existing harness, new spec file)
- **Proves:**
  - D3–D5: the homepage renders the summary and 10 tier-1 tiles.
  - D2, D6–D10: a tile opens the source page, page 5 shows 30 numbered regions, and clicking card ① scrolls to its region. The card's ↗ link has `target="_blank"` and the item's absolute href. Clicking an overlapping box opens the chooser.
  - D11: `/items?source=` filters the list.
  - D12: the item page's cross-link lands on the source page with that item selected.
- **Prior art:** `e2e/pages.spec.ts` (signed-in page walks) with `e2e/auth.setup.ts`. The local stack is seeded by uploading the Austin JSON and two snapshots' files to the local `cc-source-snapshots` bucket.
- **Runs:** `pnpm e2e` (Playwright on the local Supabase stack).

**S3: the manifest fields survive a capture** (existing)
- **Proves:** D2, D14. `1.2-capture` keeps `source_id`, `document_title` and `doc_type` on an unchanged snapshot and on a recapture of the same source. A new source gets a `source_id` that is unique in the manifest. intake-prospecting's `3.1-write` copies the title and type from `sources.json`.
- **Prior art:** `runbooks/cc-source-citations/scripts/test_ccs.py`; `runbooks/intake-prospecting/steps/3.1-write/contract.test.ts` (bureau#2112).
- **Runs:** `python3 -m pytest runbooks/cc-source-citations/scripts` plus the step contract tests, in bureau CI.

---

## 4. PR plan

**P1: the homepage and the source index** (`cityhall`)
- **Blocked by:** nothing (can start now).
- **Delivers:**
  - `source-index.ts` and its test;
  - the homepage (D3 without `jurisdiction_intake`, D4, D5 with the title fallback);
  - the list page moved to `/items` with `?source=` (D11).

  Lands D1–D5, D11 and D13.
- **Tested at:** S1, plus S2's homepage and `/items` walks.
- **Door:** two-way (revert the PR; the list returns to the bare URL).
- **Blast radius:** the intake-checklists pages only. The review Source ↗ link targets the item page, which this PR doesn't touch.

**P2: the source page and the cross-links** (`cityhall`)
- **Blocked by:** P1 (it needs `source-index.ts` and the homepage's tiles to link from).
- **Delivers:** `sources/[source]/` (D6–D10) and the item page's cross-link and breadcrumb (D12).
- **Tested at:** S2's source-page and item-page walks.
- **Door:** two-way.
- **Blast radius:** the new route, and one link per tab on the item page.

**P3: source IDs, document titles and source types in the manifest** (`bureau`)
- **Blocked by:** bureau#2112 merging, which moves the capture library to `runbooks/lib/sources/` and adds `3.1-write`. Adding to that PR is the alternative, if it is still open when this is picked up.
- **Delivers:**
  - the optional fields in the manifest schema and in `sync-cc-sources.yml`'s validator;
  - carry-forward in capture;
  - `3.1-write` copying them from `sources.json`;
  - the Austin backfill (D14).

  The cityhall zod change is in P1, as optional fields, and `buildSourceIndex` prefers `source_id` over the derived slug. The tiles show real titles once this merges and syncs.
- **Tested at:** S3.
- **Door:** two-way.
- **Blast radius:** `cc-source-citations` and intake-prospecting runs, until S3 is green.

P1 and P3 can run in parallel. Nothing here waits on db-schema P1. When the db-schema v2 tables land, a follow-up adds a DB-backed reader behind `SourceIndex` (§5).

---

## 5. What these pages ask of the intake DB schema (for db-schema v2, winston#314)

The pages run off the bucket today and don't block on the migration. They read best from tables shaped like the ones below, so these requests went to the db-schema session on 2026-10-15.

**Status: recommended, not decided.** The db-schema session will recommend R1–R4 in the shapes below in db-schema v2. Will has not ruled on that spec's audit. Its finding A18 recommends that bureau stays the source of truth and the DB is a read replica shaped for the app; every request here is a read, so they fit either way. The db-schema tables (its P1) wait for the intake loop to meet the Austin bar (north-star D3), which is why these pages are built on the bucket behind `SourceIndex` (D1). These requests are cited by number here and become db-schema D-numbers once Will rules.

- **R1. A source as a first-class row with a stable slug.**
  - `intake_sources (checklist_id, source_id, title, url, format, doc_type)` holds the source.
  - `intake_version_sources (checklist_id, version, source_id, snapshot_id, storage_prefix, page_count, thumb_path)` links each version to the snapshot it cites.
  - `source_id` is copied from the bureau manifest (D2, D14), never minted in the DB.
- **R2. Citations and regions as rows, replacing v1.2's `intake_checklist_items.citations jsonb`.**
  - `intake_item_citations (checklist_id, version, item_id, source_id, snapshot_id, label, status, confidence, flags)` holds one row per citation.
  - `intake_citation_regions (…, page, boxes jsonb, quote)` holds the regions, indexed on `(snapshot_id, page)`.
  - The source page is then one indexed query instead of D1's scan. At Austin's size the scan is fine, so this is about shape, not speed. The status vocabulary mirrors `schemas.ts` (D1).
- **R3. The version row carries the summary:** `item_count`, `group_count`, citation coverage counts, `generated_by` (A6) and `synced_at`, plus the semver if A2 is adopted. The homepage reads them straight off the row (D4).
- **R4. `jurisdiction_intake` as specified** (`basis`, `application_type`, `evidence`, `decided_at`) feeds D3 directly.
- **R5. Item URLs once stable IDs exist** (proposed by the db-schema session):
  - `/intake-checklists/<slug>/<item_id>` (`austin-0042`) becomes canonical.
  - `?v=<semver>` pins a version (A2), so links from old reviews show the item as that review saw it. That fixes A12: today's pages resolve against `CURRENT_VERSION`.
  - A legacy ref (`cc-1:CC-1-01`) redirects through the sidecar of the version it belongs to.
  - The static `sources/` and `items/` segments keep working under this scheme. Snapshot binaries stay in `cc-source-snapshots`.

---

## 6. Open questions

- **Q1. Library-DB jurisdiction facts on the homepage?** Population, permitting-system vendor and code platform live in the Library DB, keyed by uuid with no slug. Options:
  - (a) leave them out;
  - (b) add a `library_jurisdiction_id` to bureau `conventions.yaml` and copy a few facts at sync time;
  - (c) a `profile:` block in `conventions.yaml`, authored in bureau.

  Proposed: (a) for v1.
- **Q2. Who sees these pages, and from where?** Today the only way in is the staff admin sidebar. Does the homepage get a customer-facing entry (a project's jurisdiction, or the main nav), and an index at `/intake-checklists`?
- **Q3. The `jurisdictions` RLS gap.** Confirm whether a signed-in user with no project in a jurisdiction gets a 404 (§Problem). If they do, read the name with a narrow view or function that exposes `slug, name, status` to every authenticated user. These are city facts, which is how db-schema D7 treats the intake tables.
- **Q4. The 2 uncited Austin snapshots.** Hide them (D5), or list them under "Captured, not cited" so the capture is auditable?
- **Q5. Item numbers on boxes:** the rail's local ①…ⓝ (D8), or the item's comment number? The citation JSON has no comment number, so using it needs `true-comment-num-mapping.tsv` in the bucket or the db-schema items table.

## 7. Not yet specified

- The phone layout of the source page beyond stacking the rail.
- How the source page looks for a `none_found` jurisdiction on the generic baseline. Its sources are the evidence that no intake process exists (`intake.yaml` `evidence.sources`), not snapshots that items cite.
- Showing more than the current version (a version picker, or a diff between versions), once the versions are in the DB.

## 8. Out of scope

- **Editing citations or drawing override boxes in the app.** Overrides stay in `citation-overrides.json` (checklist-source-ui D15); app edits belong to `intake/db-source-of-truth`.
- **The DB migration and sync.** These belong to `intake/db-schema`; this spec only states what it asks of them (§5).
- **A model-written summary of the checklist** (D4).
- **Changing the CC runbook or the review UI's Source ↗ link.** The link keeps targeting the item page.
