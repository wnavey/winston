# CC checklist source UI: where each completeness-check item came from

**Status:** Draft v2
**Date:** 2026-10-07
**Repos touched:** `bureau` (new `cc-source-citations` runbook; per-jurisdiction source manifest, per-version citations and overrides; URL-map fixes; one path-filtered sync workflow), `cityhall-new` (new `cc-source-snapshots` bucket + read policy migration; two pages; a Source link on CC findings)
**Repos NOT touched:** `completion-officer`, `conductor2`, `inspector-general`, `dsd`, `navalbase`

> **In one paragraph.** The 192 Austin completeness-check (CC) items in `v2.7-trimmed` each
> name one to three "Requirement Sources" (a free-text label such as `CC Submittal Checklist p.2,
> Addressing Review`), and `requirement-source-urls.tsv` maps each label to a URL. Nobody can see
> *where on that source* an item came from, and we kept no copy of the sources. A new, repeatable
> bureau runbook, `cc-source-citations`, captures an immutable snapshot of every cited source as a
> PDF, has Opus 5.5 workers locate each item's passage, turns the picks into exact word-level boxes,
> stops for a human review (with durable overrides), and opens a bureau PR. A path-filtered bureau
> workflow publishes the merged JSON to a bucket. cityhall-new renders
> `/intake-checklists/{jurisdiction}` (every item) and `/intake-checklists/{jurisdiction}/{key}`
> (the item plus each source page with its passage boxed) for any signed-in user, and every CC
> finding gets a "Source" link to its item page.

> **Revision note (v2, grill of 2026-10-07; every answer is logged in §8).**
> - **No completion-officer.** The tool is a bureau runbook, `cc-source-citations` (R1), not a
>   script in completion-officer (reverses v1 D13 / Q2). The hand-trimmed list in bureau is the only
>   input (D2); nothing re-runs the completion-officer agent. A future checklist-refresh workflow
>   is separate and out of scope (§7).
> - **Repeatable, incremental, local lane** (D17, R4, R6): re-run by hand after a new checklist
>   version, a guide edit, or a suspected source change; unchanged pairs are skipped.
> - **Locate is an agent step on Opus 5.5 via subscription seats**, one worker per group (D12, Q17,
>   Q22), not a gateway script (reverses the R3 proposal and v1 D11 Sonnet).
> - **Webpage capture rewritten** (D8): the Requirements page hides its content in 17 CKEditor
>   accordions with no `aria-expanded`; v1's click-`[aria-expanded=false]` recipe would have
>   passed while capturing ~5 % of the text. Now: force-open with CSS, verify visible text ≥ 98 %,
>   **one PDF page per accordion panel** (resolves v1 Q5), panels are the sections (D9).
> - **widen uses stable `/content/<id>/pdf/` URLs** (D6, D7); no signed-preview scraping, no
>   LibreOffice (every widen source, including the "DOCX", is served as a PDF).
> - **Municode** captures only the section's chunk of the rendered chapter, with a bureau-text
>   fallback (D7). Whole-code labels (`LDC Title 25`, `DCM`) become `document_level` and are not
>   located (D11).
> - **A citation is a list of regions** (D5); hinted page first, then the whole document with a
>   `page_hint_mismatch` flag (D13); defined confidence levels (D14).
> - **Human overrides** in `citation-overrides.json`, applied without a model call, flagged when
>   stale, carried forward by item-text hash (D15).
> - **Access: anyone signed in** (Q18): `requireUser()`, bucket readable by any authenticated user
>   (reverses v1 D15/D17 staff-only).
> - **Route** `/intake-checklists/[jurisdiction]/[checklistKey]`, slug checked against
>   `jurisdictions.slug` (Q21, resolves v1 Q6); raw `{grouping-id}:{checklistId}` key (Q19, resolves
>   v1 Q1).
> - **Minimal L1 pulled into P4**: a "Source ↗" link on each CC finding to the internal item page
>   (D22), possible because every CC comment already stores `sourceFindings[].ref`.
> - **No bureau document pointer** (Q2 = c) and **no change-detection design** (Q3): bureau's
>   `freshness` checker covers almost none of these sources (§1.4).
> - Fact fixes: §1.3's headings claim corrected (label suffixes match accordion titles, not
>   h3/h4); 13 unresolved labels, not 11; **53 citations use 9 `Requirements page, Section N`
>   labels that match no panel** (Q23, new).

---

## 1. Problem

### 1.1 The checklist has labels, not locations

- `bureau/jurisdictions/austin/completeness-check/CURRENT_VERSION` = `v2.7-trimmed`: 14 guide
  files (`cc-1.md` … `cc-24.md`), **192 items**, the same 192 ids as the left column of
  `v2.7-trimmed/cc-item-title-mappings.tsv`.
- Each item row carries a `Requirement Source` cell. Across the 192 items: **86** cite one
  source, **89** cite two, **17** cite three, so there are **315 (item, label) pairs**. **98
  distinct labels** are used.
- `requirement-source-urls.tsv` (version-independent, at the `completeness-check/` root) maps
  87 labels onto **17 distinct URLs** in use. **13 labels used by v2.7 have no row**:
  `CC Application form, Section 12` (×2), `CC Application, Section 6`, eight `DCM 1.2.2.*`
  subsections, `TCM 13.1.0`, `TCM 11.2.2.1(G), 11.2.3.2(B)`, `Code 14-11-41`.
- Source mix, counted per item (an item counts once per kind it cites): widen PDF **108** ·
  webpage **134** · Municode **24** · widen "DOCX" (served as PDF, §1.3) **18** · Texas
  Administrative Code **2**. **43** items cite only webpages.
- **53 citations use 9 labels of the form `Requirements page, Section N`** (N = 7, 8, 9, 10, 11,
  12, 14, 23, 30). The page has no numbered sections, and N reaches 30, so they are not CC
  Application sections (1–15) either (Q23).

### 1.2 We never kept the sources, and the list is hand-made

The completion-officer v2 Austin run (`completion-officer/research/austin/v2/`, first committed
2026-04-03) wrote findings and the final checklists but no copy of any source. Since then the list
was trimmed by hand with the city, and the two copies have drifted: `cc-3`, `cc-10`, `cc-21` and
`cc-22` differ between `completion-officer/final-checklists/v2.7-trimmed/` and bureau, and bureau
has `CC-22-12`, which completion-officer lacks. Bureau's copy is the one CC runs use.

### 1.3 The sources are harder to capture than their URLs suggest (verified 2026-10-07)

| Source | What we found |
|---|---|
| widen `…/view/pdf/<id>/<name>.pdf` (7 PDFs) | `text/html`, ~24 KB pdf.js viewer; the PDF behind it is a signed, expiring preview URL. **But** `austin.widen.net/content/<id>/pdf/<name>.pdf` (the form bureau's provenance uses) returns `application/pdf` directly: the CC Submittal Checklist via `/content/d7vma1dqla/pdf/…` is 330,669 bytes, SHA-256 `730a9cac…`, identical to bureau's recorded hash of 2026-09-02. |
| widen `…/s/<id>/<name>` (Notes & Templates, Environmental instructions) | an HTML share page whose preview is a **PDF** (8 and 10 pages), byte-identical to bureau's `/content/rqxn48kdkd/…` and `/content/ky4v02zex2/…` URLs. The "Notes and Templates DOCX" label is a PDF to us. Share ids differ from content ids. |
| Requirements page `austintexas.gov/page/site-plan-requirements` | 301 → `/development-services/site-plan-requirements`. Its `ETag`/`Last-Modified` change on every request. **The content lives in 17 CKEditor accordions** (`.ckeditor-accordion-container dl > dt/dd`, each `dd` `display:none`, toggled by clicking its `dt`, no `aria-expanded`). As loaded, `innerText` is ~2,000 characters; forcing the `dd`s visible gives ~43,800. The 19 `[aria-expanded=false]` elements on the page are the site nav and language menu. Fully open, the page is 26,724 px tall; printed as one page it is 20,343 pt, and Chromium appends a blank second page. |
| Municode section URL (`?nodeId=…S25-8-121…`) | renders the **whole chapter** (200,373 characters, 306 chunks, 5.3 s); the section must be isolated. |

The 17 accordion titles are the page's real sections, and they are what most `Requirements page,
X` label suffixes name: *Addressing Review Requirements*, *Floodplain Requirements*,
*Transportation Requirements*, *Engineer's Summary Letter Requirements*, *Land Development
Engineering Requirements*, *Right-of-Way Management Requirements*, …. The `Section N` labels
(§1.1) match no panel.

### 1.4 What already exists to build on

- **Item keys everywhere.** Inspector General writes `bureau_checklist_version` +
  `bureau_checklist_item` on workflow completion
  (`inspector-general/src/lib/data/bureau-checklist-store.ts`); prod has Austin `v2.7-trimmed` as
  cc version 11 (`27c8a669-…`, 192 items) with `checklist_item_id = 'cc-1:CC-1-01'`. **Every CC
  review comment** (`output_schema = '2026-03-completeness-check'`, 12,002 rows) stores the same
  key in `output_json.sourceFindings[].ref`.
- **Municode section links.** `bureau/jurisdictions/austin/codes/{ldc,dcm,tcm,ucm,…}/meta/locators.json`
  map every section file to its `?nodeId=` URL.
- **Bureau's own copies of some sources.** `codes/dsd-site-plan-submittal/` (Requirements page,
  Notes & Templates, CC Submittal Checklist, Intake Checklist, Environmental instructions),
  `environmental-review-requirements/`, `addressing-standards/` hold provenance (URL,
  `urlVerified`, content hash) and per-section markdown. No PDFs.
- **`freshness` does not cover these sources.** `bun run freshness`
  (`bureau/tooling/src/freshness/freshness.ts`) is a manual CLI (CI runs only its tests,
  `ci.yml:608`). It has two rules (Municode whole-code job id; `pdf-binary` top-level hash) and
  reports everything else as "not checkable": of our sources it can check only the Environmental
  PDF, and Municode only at whole-code granularity. Hence Q2 = no pointer and no reuse.
- **Runbook container.** `conductor2/containers/Containerfile` is built on Playwright's image
  (Chromium, `playwright-core` 1.62.1) with `poppler-utils`, `mupdf-tools`, `pypdf`. Capture needs no
  new dependency: Chromium for webpages, `pdftotext -bbox-layout` for word boxes, `pdftoppm` for
  page images.
- **Runbook precedents.** `runbooks/completeness-check/steps/2.1-review/step.yaml` fans an agent
  out with `foreach: roster`; `runbooks/guide-training` is an operator-launched runbook whose
  output an operator lands in bureau.
- **Box overlay UI in cityhall-new.** `src/components/ui/image-viewer/index.tsx` renders an `<img>`
  with percentage-positioned children and a `focus` prop taking `ImageRegion = {x, y, width,
  height}` normalized 0–1 from the top-left; `BlockBox` (`src/lib/reviews/view-model.ts:91`) is the
  same shape. CC comments become view models in `src/lib/reviews/adapters/checklist.ts`
  (`statusComment`, citation read at `:266`).
- **Access helpers.** `requireUser()` / `requireStaff()` in `src/lib/auth.ts`. Broad
  authenticated-read bucket policies were dropped for tenant data
  (`20260920000000_drop_broad_storage_read_policies.sql`).

### 1.5 Pilot: are the passages findable?

A keyword-coverage pilot (no model) over the PDF and Requirements-page pairs, 2026-10-07:

| Source | Pairs | Coverage ≥ 0.7 | 0.4–0.7 | < 0.4 |
|---|---|---|---|---|
| widen PDFs (page-hinted where the label gives `p.N`) | 139 | 80 | 48 | 11 |
| Requirements page (whole page) | 134 | 109 | 25 | 0 |

The weak cases show two patterns this spec now handles: whole-document citations (`CC Application
form` for "fields in Sections 1-11") and wrong page hints (`CC-22-25` cites `p.5`, zero overlap).

## 2. Goals

1. Every source a checklist version cites has an immutable snapshot we own, rendered as a PDF with
   page images and a word-level text layer.
2. Every (item, label) pair has a citation (regions with boxes, a quote, a confidence) or an
   honest status saying why not.
3. Anyone signed in can open `/intake-checklists/austin/{key}` and see the item and each cited
   source page with the passage boxed, and can reach it from any CC finding.
4. The process is a repeatable bureau runbook that starts from the hand-made list in bureau and
   preserves human corrections across re-runs.
5. No bureau CI cost for commits outside the files this feature publishes.

## 3. Design

### 3.1 Vocabulary

- **Label:** a Requirement Source string from a guide row, e.g. `CC Application, Section 13`.
- **Snapshot:** one captured document, immutable, identified by `snapshot_id`. One URL can yield
  several snapshots (Municode: one per section); a re-capture that changed yields a new one.
- **Citation:** one (item, label) pair resolved to a status and zero or more regions.
- **Region:** one page of a snapshot plus the boxes on it.
- **Override:** a human correction to one citation, kept in a file the runbook always applies.
- **Item key:** `{grouping-id}:{checklistId}`, e.g. `cc-5:ADR-05`. Equal to
  `bureau_checklist_item.checklist_item_id` and to `sourceFindings[].ref` on CC comments.

### 3.2 Inputs and outputs

**D1. Bureau holds the small, reviewable files; the bucket holds the binaries.**

```
bureau/jurisdictions/<jurisdiction>/completeness-check/
├── requirement-source-urls.tsv             exists: label → URL (fixed in D6)
├── sources/manifest.json                   NEW: labels → snapshots, every snapshot's record
└── <version>/
    ├── source-citations.json               NEW: item → citations
    └── citation-overrides.json             NEW: human corrections (D15)

cc-source-snapshots/<jurisdiction>/          NEW private bucket (D19)
├── <snapshot_id>/original.<ext> · document.pdf · pages/NNN.png · text/NNN.words.json · page.mhtml
└── manifest.json · citations/<version>.json · CURRENT_VERSION      copied by CI (D18)
```

**D2. Bureau's guide files are the only input.** The runbook reads `cc-*.md`,
`cc-item-title-mappings.tsv`, `requirement-source-urls.tsv` and `CURRENT_VERSION` from bureau.
Nothing reads or re-runs completion-officer; its drifted copy (§1.2) is not this spec's concern.

### 3.3 `sources/manifest.json`

**D3. Shape.**

```jsonc
{
  "jurisdiction": "austin",
  "generated_at": "2026-10-…Z",
  "snapshots": {
    "sn_cc-submittal_20261008": {
      "title": "CC Submittal Checklist",
      "url": "https://austin.widen.net/content/d7vma1dqla/pdf/SP_ConsolidatedSitePlanCompletenessCheckSubmittalChecklist.pdf",
      "final_url": "…",                       // after redirects
      "format": "pdf",                         // pdf | webpage | municode-section
      "fetched_at": "2026-10-08T…Z",
      "capture": { "recipe": "pdf-direct", "recipe_version": 1, "runbook_run": "<run id>" },
      "fingerprints": {
        "sha256_original": "730a9cac…",
        "sha256_text": "…",                    // NFC, whitespace-collapsed visible text
        "sections": {},                        // webpage: one entry per accordion panel (D9)
        "http": { "etag": "…", "last_modified": "…", "content_length": 330669 }
      },
      "pages": [{ "n": 1, "width_pt": 612, "height_pt": 792, "section": null }],
      "has_text_layer": true,
      "storage_prefix": "austin/sn_cc-submittal_20261008/",
      "supersedes": null,
      "last_checked_at": "2026-10-08T…Z"
    }
  },
  "labels": {
    "CC Submittal Checklist p.2, Addressing Review": { "snapshot": "sn_cc-submittal_20261008", "page_hint": [2], "text_hint": "Addressing Review" },
    "Requirements page, Data Table": { "snapshot": "sn_requirements-page_20261008", "section_hint": "Site Plan Requirements", "text_hint": "Data Table" },
    "LDC 25-8-121": { "snapshot": "sn_ldc-25-8-121_20261008", "deep_link": "https://library.municode.com/tx/austin/codes/land_development_code?nodeId=…S25-8-121…" },
    "LDC Title 25": { "snapshot": null, "document_level": true, "deep_link": "https://library.municode.com/tx/austin/codes/land_development_code" }
  }
}
```

- `labels` is the only place a label string is parsed: `p.N` → `page_hint`; the suffix after the
  comma → `text_hint`; for webpages the suffix is fuzzy-matched to a panel title → `section_hint`
  (the match is recorded, so a reviewer can see it); whole-code labels → `document_level` (D11).
- `labels[*].snapshot` always points at the current snapshot; older snapshots stay in `snapshots`
  and in the bucket so older citations still resolve (D10).

### 3.4 `<version>/source-citations.json`

**D4. Shape.**

```jsonc
{
  "jurisdiction": "austin",
  "checklist_version": "v2.7-trimmed",
  "bureau_commit": "<sha of the guide files read>",
  "runbook_run": "<run id>",
  "groups": { "cc-5": "Plan Content, Data Tables & Conditional Plan Requirements" },
  "items": {
    "cc-5:ADR-05": {
      "group": "cc-5", "local_id": "ADR-05", "section": "Addressing Review",
      "title": "Driveway access points, handicap parking, garages, and sidewalk access are identified on plans",
      "item_text": "Driveway access points, handicap parking, garages, and sidewalk access not identified on plans",
      "item_text_sha": "…",
      "citations": [
        {
          "label": "CC Submittal Checklist p.2, Addressing Review",
          "snapshot": "sn_cc-submittal_20261008",
          "status": "found",          // found | not_found | document_level | no_snapshot | unresolved_label
          "flags": [],                // page_hint_mismatch | overridden | override_stale
          "regions": [
            { "page": 2,
              "boxes": [{ "x": 0.074, "y": 0.412, "width": 0.84, "height": 0.034 }],
              "quote": "Identify driveway access, handicap parking, garages…",
              "word_ids": ["p2w188", "p2w214"] }
          ],
          "confidence": "high",       // high | medium | low (D14)
          "rationale": "Same four elements listed under Addressing Review.",
          "located_by": "opus-5.5",   // or "override"
          "deep_link": "https://austin.widen.net/content/d7vma1dqla/pdf/…#page=2",
          "located_at": "2026-10-08T…Z",
          "override": null            // the applied override's note/by/at when overridden
        }
      ]
    }
  }
}
```

**D5. A citation is a list of up to 4 regions.** `CC Application form` for "fields in Sections
1-11" legitimately spans pages 1–6; one region per page, each with its own quote and boxes.
Every label an item cites appears as a citation whatever its status.

**D6. URL-map fixes, in the first runbook PR.** `requirement-source-urls.tsv` switches every widen
URL to its `/content/<id>/pdf/<name>.pdf` form (share ids mapped to content ids once, by hand,
using the identical-bytes check in §1.3), points the Requirements page at its final
`/development-services/` URL, and gains rows for the 13 unresolved labels (DCM/TCM via
`locators.json`; `CC Application form, Section 12` and `CC Application, Section 6` at the CC
Application PDF; `Code 14-11-41` at its Code of Ordinances section). Any label still missing at run
time gets `unresolved_label`.

### 3.5 Boxes

**D7a. Boxes are `{x, y, width, height}` normalized 0–1, origin top-left, in the page space of the
snapshot's `document.pdf`**: the `ImageRegion`/`BlockBox` shape cityhall-new already renders, so
the pages pass them through unconverted. Word geometry in `text/NNN.words.json` stays in PDF points
(from `pdftotext -bbox-layout`); conversion happens once, in `2.2-verify`.

### 3.6 Capture

**D7. One `document.pdf` per snapshot, by recipe:**

| Recipe | Sources | How |
|---|---|---|
| `pdf-direct` | widen `/content/<id>/pdf/` (all 9 widen sources), `TIA_Determination_Worksheet.pdf` | download; `document.pdf` = original; reject a 200 whose body doesn't start `%PDF` |
| `webpage-panels` | Requirements page, Address Management page, TAC (`texreg`) | D8 |
| `municode-section` | every LDC/DCM/TCM/UCM section label | resolve the label through `locators.json`, render the chapter, isolate the chunk whose anchor matches the section's `nodeId`, print that chunk; if isolation fails, render bureau's own markdown for that section as a page and record `capture.recipe = "bureau-text"` (shown as "bureau copy" in the UI) |

**D8. Webpages: force open, verify, one page per panel.** Headless Chromium (the runbook image's
Playwright) loads the URL and follows redirects, then injects CSS that forces hidden content
visible (`.ckeditor-accordion-container dd`, `details > *`, `[hidden]`, `[aria-expanded=false] +
*`, all `display:block !important`) and hides site chrome (`header`, `nav`, `footer`, cookie
banners). **Verify:** the content container's visible `innerText` length must be ≥ 98 % of its
whitespace-collapsed `textContent`; below that the capture fails and names the shortfall. Then
**print each accordion panel (the `dt` title plus its `dd`) as its own PDF page** at 1275 px
width and the panel's own height, with page 1 holding the content above the first panel. Page
numbers then mean sections, and no page approaches the 20,343 pt single-page size of §1.3.
`page.mhtml` and the post-reveal `dom.html` are archived. A page with no accordions prints one page
per top-level heading block.

**D9. Webpage sections are the accordion panels.** `fingerprints.sections` has one entry per
panel (`{title, page, sha256_text}`) and `pages[n].section` names it. Label suffixes route to panels
by fuzzy title match (D3); labels that match no panel (the `Section N` labels, Q23) search the
whole page.

**D10. Snapshots are immutable and incremental.** `snapshot_id = sn_<slug>_<yyyymmdd>`. A
re-capture whose `sha256_text` equals the current snapshot's writes nothing new and only bumps
`last_checked_at`; a changed one creates a new snapshot with `supersedes` set and repoints its
labels. Binaries are uploaded at capture time; an unreferenced snapshot is inert.

**D11. Whole-code labels are `document_level`.** `LDC Title 25`, `DCM`, `TCM Section 10`-style
labels that name a code rather than a section are not captured or located; the citation shows the
code's link with no box.

### 3.7 Locate

**D12. An agent step on Opus 5.5, one worker per group.** `2.1-locate` fans out with `foreach`
over the groups that have pairs to (re-)locate (14 on a full run). Runner preset
`locate: { harness: claude, model: opus-5.5 }`, spending the operator's subscription seat. Each
worker receives, for each of its items: `item_text`, `title`, its labels, and for each label the
candidate pages' words as `id:text` tokens in reading order (from `text/NNN.words.json`). It writes
`citations-<group>.json`; `contract.test.ts` checks the shape (status, ≤ 4 regions each with
`page`, `first_word_id`, `last_word_id`, `quote`, plus `confidence`, `rationale`). Workers never
produce coordinates.

**D13. Candidate pages: hint first, then everything.** Candidates are `page_hint` / the
`section_hint` panel when present. If the worker finds nothing there, it searches every page of the
snapshot; a find outside the hint carries the `page_hint_mismatch` flag (which also surfaces
wrong hints in the guides, e.g. `CC-22-25`).

**D14. Confidence means:** `high` = the source states this requirement; `medium` = only the right
section or topic was found and the region marks the section (shown as "section-level"); `low` =
a guess. `medium` is not a failure: many items consolidate several lines of a source.

### 3.8 Verify, overrides and review

**`2.2-verify` (script)** turns picks into boxes and applies overrides:

1. For each region, take the words from first to last id, group by line, emit one box per line run.
2. Reject a region whose `quote` is not in those words (whitespace-normalized); a citation with no
   surviving region becomes `not_found` with the rejection in `rationale`.
3. Apply overrides (D15).
4. Carry forward: on an `incremental` run, pairs whose `item_text_sha` and snapshot are unchanged
   keep their previous citation untouched and are never sent to `2.1`.

**D15. Human overrides.** `<version>/citation-overrides.json`, keyed `"<item key>|<label>"`:

```jsonc
{
  "cc-1:CC-1-03|CC Application, Section 13": {
    "regions": [{ "page": 7, "quote": "I hereby certify that all information provided" }],
    "note": "Signature block, not the Section 13 heading", "by": "will", "at": "2026-10-09"
  },
  "cc-22:CC-22-25|CC Submittal Checklist p.5": {
    "status": "not_found", "note": "p.5 has no accessible-route language; label is wrong",
    "by": "will", "at": "2026-10-09"
  }
}
```

- An override gives either `regions` (page + a distinctive run of words from the passage) or a
  `status`, plus `note`, `by`, `at`. `2.2-verify` fuzzy-matches each `quote` against that page's
  words to rebuild the boxes. No model call.
- Overrides always win; an overridden pair is never sent to `2.1-locate`.
- An override whose quote no longer matches the current snapshot gets `override_stale` and shows on
  the review sheet; it is never silently dropped or silently re-pointed.
- When a new checklist version is cut, overrides for items whose `item_text_sha` is unchanged are
  copied into the new version's file by `1.1-inputs`.

**`2.3-contact-sheet` (script)** renders one HTML page: every citation that is `low`, `not_found`,
`unresolved_label`, `page_hint_mismatch` or `override_stale`, plus 15 random `found` (Q16), each
with its page image, boxes, quote, rationale and the override key to paste.

**`3.1-review` (gate, `runner: none`)**: approve, or revise. A revise means "I edited
`citation-overrides.json`"; the run loops back to `2.2-verify` (seconds, no model calls) and
re-renders the sheet.

### 3.9 Publish

**D16. `4.1-publish` opens a bureau PR**, never writes the JSON to the bucket. The PR carries
`sources/manifest.json`, `<version>/source-citations.json`, `<version>/citation-overrides.json`
and, on the first run, the D6 URL-map changes. Merging is a human step.

**D17. Repeatable, local lane only (MVP).** The runbook is launched by hand with
`{jurisdiction, version, mode: incremental|full, items?: [...]}` whenever a new checklist version
is cut, a guide edit changes an item's text or labels, or someone suspects a source changed
(manual relaunch, R6). Local lane only: capture uploads binaries with the operator's service-role
key, which the cloud sandbox does not hold (cloud lane deferred, §7).

**D18. A path-filtered bureau workflow publishes merged JSON.**
`bureau/.github/workflows/sync-cc-sources.yml`:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'jurisdictions/*/completeness-check/sources/manifest.json'
      - 'jurisdictions/*/completeness-check/*/source-citations.json'
      - 'jurisdictions/*/completeness-check/CURRENT_VERSION'
  workflow_dispatch:
concurrency: { group: sync-cc-sources, cancel-in-progress: false }
```

It sparse-checks-out `jurisdictions/*/completeness-check`, **validates each file against its JSON
schema and fails without uploading anything if one is invalid** (Q20), then uploads each file whose
hash differs from the object already in the bucket. A push touching none of those paths starts no
job; guide edits (`cc-*.md`, TSVs) do not trigger it. It is not a step of `sync-bureau.yml`, whose
`jurisdictions/**` filter fires on almost every commit. Overrides are not uploaded: the app reads
only the resolved citations.

The runbook and the workflow do different jobs: the runbook *produces* the data and ends at a PR;
the workflow *publishes* what merged, so the app always shows bureau `main`.

### 3.10 The bucket and the pages

**D19. Bucket `cc-source-snapshots`**, private, in the Noetic App project, created by a
cityhall-new migration.

**D20. Any signed-in user can read it.** One `storage.objects` SELECT policy:
`bucket_id = 'cc-source-snapshots' and auth.role() = 'authenticated'`; writes are service-role
only. The migration states why this bucket is exempt from the 2026-09-20 drop of broad read
policies: it holds public city documents and our citations of them, no tenant data.

**D21. Two pages in cityhall-new, `requireUser()`:**

- `src/app/(app)/intake-checklists/[jurisdiction]/page.tsx` (`ListPage`): checks the slug against
  `jurisdictions.slug`, reads `CURRENT_VERSION` and `citations/<version>.json` from the bucket (404
  if absent). Items grouped by group in guide order; per item: key, title, a chip per citation
  status, the lowest confidence. Filters: group; "has an unlocated citation".
- `src/app/(app)/intake-checklists/[jurisdiction]/[checklistKey]/page.tsx` (`DocumentPage`):
  group name, key, title, deficiency text, then one tab per citation (PDFs first). A tab shows the
  label, snapshot title, captured date and confidence ("section-level" for `medium`); one
  `ImageViewer` per region with `src` = signed URL of `pages/<page>.png`, `focus` = the union of the
  region's boxes, each box drawn as a child; the quote; **Open live source** (`deep_link`:
  `#page=N` for PDFs, a `#:~:text=` fragment for webpages, the section `nodeId` for Municode) and
  **Download snapshot** (signed `document.pdf`), noting "live source may differ from this snapshot
  of `<date>`"; `document_level` / `not_found` / `unresolved_label` tabs show the status and
  rationale with no image; a "bureau copy" badge for `bureau-text` snapshots.
- The URL segment is the raw key (`cc-5:ADR-05`). Every link to it is an **absolute** path: a
  relative `cc-5:ADR-05` href would parse as a URL scheme.
- Entry points: the Source link (D22) and an **Intake checklists** item in the staff block of
  `src/components/app/user-menu.tsx:77`. No main-nav entry in the MVP.
- Reads use the user client and Next's fetch cache, revalidated hourly. No write path.

**D22. A Source link on every CC finding.** In `src/lib/reviews/adapters/checklist.ts`, the CC
comment adapter also reads `output_json.sourceFindings[].ref` (the item key) and exposes it on the
comment view; the finding renders a small **Source ↗** link to
`/intake-checklists/<project jurisdiction slug>/<ref>`. Always the internal page, never the PDF or
the city site. No lightbox (deferred, §7). The link is omitted when the comment has no `ref`.

**D23. No DB tables.** `bureau_checklist_item` and CC comments already carry the key (§1.4).

## 4. Runbook `cc-source-citations`

**D24. Steps** (`bureau/runbooks/cc-source-citations/`, Python scripts plus one Node capture
script for Playwright):

| Step | Runner | Does |
|---|---|---|
| `0-request` | none | `{jurisdiction, version, mode, items?}` |
| `1.1-inputs` | script | parse bureau guides, title map, URL map; load previous manifest, citations, overrides; compute the work list (changed items, changed or new labels); carry overrides forward to a new version |
| `1.2-capture` | script (container, Chromium) | recipes D7–D9 for every label in the work list; skip unchanged snapshots (D10); upload binaries; write the manifest delta |
| `2.1-locate` | agent `locate` (Opus 5.5), `foreach` group | D12–D14 for un-overridden pairs in the work list |
| `2.2-verify` | script | boxes, quote check, overrides, carry-forward; writes `source-citations.json` |
| `2.3-contact-sheet` | script | the review HTML (§3.8) |
| `3.1-review` | none (gate) | approve, or revise → `2.2` |
| `4.1-publish` | script | open the bureau PR (D16) |

## 5. Data sizes

| | Estimate |
|---|---|
| Snapshots | 9 widen PDFs + 1 plain PDF + ~3 webpages (the Requirements page ≈ 18 panel pages) + ~30 Municode sections + 2 TAC chapters ≈ 45 |
| Bucket | PDFs ≤ 1 MB each; page PNGs ~150 KB per letter page, panel pages vary; total well under 200 MB |
| `manifest.json` | tens of KB |
| `source-citations.json` (v2.7) | 192 items, 315 citations: ~250 KB |
| Locate | 14 Opus 5.5 workers on a full run, subscription seat; an incremental run touches only changed groups |

## 6. Phases

| Phase | Repos | Scope | Exit |
|---|---|---|---|
| **P1 Capture** | bureau, cityhall-new | runbook skeleton, `1.1-inputs`, `1.2-capture` (D7–D11), D6 URL-map fixes; bucket migration (D19) | manifest covers every resolvable label; Requirements page verifies ≥ 98 % |
| **P2 Locate and review** | bureau | `2.1`–`4.1` (D12–D16) | first full v2.7 run reviewed; bureau PR merged |
| **P3 Publish path** | bureau, cityhall-new | read policy (D20), `sync-cc-sources.yml` + schemas (D18) | JSON in the bucket after the merge; a guide-only merge starts no job |
| **P4 Pages and Source link** | cityhall-new | D21, D22 | both pages live for signed-in users; Source link on CC findings |

P1 can capture PDFs before webpages. P3 needs only the bucket. P4 can be built against a local
copy of the JSON and ships after P3.

## 7. Deferred

- **The full L1 lightbox**: the source page and box inline on a CC finding (MCR-highlight style).
  D22 ships only the link.
- **Source change detection.** Not designed here (Q3). Today a re-run is relaunched by hand.
- **A checklist-refresh workflow** (check the city for new or changed requirements and propose
  checklist edits). Separate from this runbook and independent of completion-officer; this
  runbook's snapshots and citations are useful inputs to it.
- **Cloud lane** for the runbook (D17).
- **A main-nav entry** for intake checklists, and drawing override boxes in a UI.
- **Other jurisdictions**: the paths and route take a jurisdiction; only Austin has a checklist
  with sources today.

## 8. Grill log (2026-10-07)

| # | Question | Answer | Lands in |
|---|---|---|---|
| Q1 | Where does the tool live? | A bureau runbook, independent of completion-officer | D2, D24 |
| Q2 | Pointer to bureau's document records? | No (c) | §1.4 |
| Q3 | Change detection via `freshness`? | Not now; no design | §7 |
| Q4 | Guide source of truth | Bureau | D2 |
| Q5 | Minimal L1 in the MVP? | Yes, internal link only | D22 |
| Q6 | Force-open webpages with CSS + 98 % check | Yes | D8 |
| Q7 | Accordion panels are the sections | Yes | D9 |
| Q8 | One PDF page per panel | Yes | D8 |
| Q9 | widen `/content/` URLs, no scraping, no LibreOffice | Yes | D6, D7 |
| Q10 | Municode chunk, bureau-text fallback | Yes | D7 |
| Q11 | Whole-code labels → `document_level` | Yes | D11 |
| Q12 | Citation = list of regions | Yes | D5 |
| Q13 | Hint first, then whole document + flag | Yes | D13 |
| Q14 | Confidence definitions | Yes | D14 |
| Q15 | Human overrides | Yes | D15 |
| Q16 | Review gate scope | All flagged + 15 random found | §3.8 |
| Q17 | Locate model | Opus 5.5 on subscription | D12 |
| Q18 | Who can view | Anyone signed in | D20, D21 |
| Q19 | URL key | Raw `{grouping-id}:{checklistId}` | D21 |
| Q20 | Schema validation before sync | Yes | D18 |
| Q21 | Route | `/intake-checklists/[jurisdiction]/[checklistKey]` | D21 |
| Q22 | Locate worker unit | One per group | D12 |
| R1 | Runbook name | `cc-source-citations` | D24 |
| R2 | Publish path | Bureau PR + CI sync | D16, D18 |
| R4 | Lanes | Local only | D17 |
| R5 | Chromium in the container? | Yes (fact) | §1.4 |
| R6 | Re-run trigger | Manual | D17 |

## 9. Open questions

- **Q23. `Requirements page, Section N` labels.** 53 citations use 9 such labels (N = 7–30) and no
  panel or CC Application section matches them (§1.1). Proposed: locate searches the whole page
  (D9), the review gate settles each by override, and the labels are fixed in the guides afterwards.
- **Q24. Who launches re-runs.** Manual (R6) needs an owner. Proposed: whoever edits a guide
  item's text or labels launches an incremental run in the same change.
