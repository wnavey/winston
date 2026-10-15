# Intake jurisdiction pages: follow-ups after the MVP

**Status:** Draft v1
**Date:** 2026-10-15
**Parent:** `workspaces/intake/jurisdiction-pages/DESIGN-SPEC.md` v1.2 (winston#317), implemented 2026-10-15 as cityhall#399 (P1), cityhall#401 (P2) and bureau#2124 (P3).
**Repos touched:** `bureau` (a registry for El Paso, the sync workflow's path filter, a CI stamp check), `cityhall` (tile wording, the document-level grouping, e2e conventions, a `source_key` type), `winston` (the parent spec's D2 text)
**Repos NOT touched:** `conductor2`, `substation`, `inspector-general`, `dsd`, `completion-officer`, the CC runbook

## Problem

The three MVP PRs merged on 2026-10-15 and the pages are live: `/intake-checklists/austin` is a homepage with one tile per source, the list is at `/items`, every source has a page that draws every item's boxes, and the Austin manifest in the `cc-source-snapshots` bucket carries `source_id`, `document_title` and `doc_type` stamped from `sources/sources.yaml` (bureau `0e21e720f6`, sync run `38815250847`: `uploaded austin/manifest.json`).

Implementation and Foreman's reviews surfaced things that did not block the MVP but will bite later. None is a product decision; each is a small fix, a wording choice, or an open question the parent spec already carried. This spec is the one place they are tracked so they are not lost in PR threads.

Verified against cityhall `main` @ `4d7b002` (P1 squash), bureau `main` @ `0e21e720f6` (P3 squash) and the PR threads of cityhall#399, bureau#2124 and cityhall#401.

## 1. What was built, as it differs from the parent spec

Decisions the implementation changed, recorded here so the parent is read with them in mind (a v1.3 of the parent folds them in, F13):

- **D2, slug collision.** The parent said `buildSourceIndex` throws when two snapshots derive one slug. Foreman (cityhall#399) pointed out the S1 test reads the frozen seed copy, so a collision in a later bureau publish would 500 the homepage, `/items` and the file route. As built, the first snapshot keeps the slug and each later one of a different `source_key` is addressed by its own snapshot id, so the page cannot go down (`sourceSlugOf`, `source-index.ts`).
- **D14, the registry merge in `3.1-write`.** The parent said a prospecting-built jurisdiction "gets the same file from `3.1-write`". As built (after Foreman's required change on bureau#2124), the merge is append-only: a row whose key is new is appended; an existing row is left exactly as a person wrote it, and only a `source_key` missing under it is added as one line. A later run cannot correct a row it seeded; that is a person's edit.
- **P3, the stamping run.** The parent said "a capture with every source unchanged does it". As built, `ccs.py stamp --bureau . --jurisdiction <slug> [--check]` stamps a manifest offline from the registry, and the Austin manifest was stamped that way (28 snapshots, 84 added lines, `generated_at` unchanged). `1.2-capture` calls the same `stamp_manifest`.
- **P3, new snapshot ids.** A new snapshot's id slug is now the registry key (`sn_<key>_<date>-<sha8>`), not `slugify(citation label)`, so the D2 fallback derivation stays true after a label is reworded. Existing ids are untouched.
- **P3, no registry file.** The parent said capture fails on a `source_key` with no row. As built, `1.2-capture` also fails before any fetch when `sources/sources.yaml` is missing, naming the path and Austin's file as the template (F1 is the consequence).
- **P3, `1.3-capture` does not stamp.** Only `3.1-write` stamps a prospecting manifest, after `1.4-classify`'s retypes, so there is one writer.
- **D1, the index shape.** `SourceItem` was already the checklist item's type in `source-citations.ts`, so the per-source item is `CitedItem`; the manifest's page list is `pageSizes`; `sourceKey` is `string | null`; `SourceIndex` carries one extra field, `snapshotSources: Map<snapshotId, slug>`, which `filterItems` takes for `?source=`.
- **D3, the local seed.** Austin's `jurisdictions` row comes from migration `20260724000000` with status `prospect`; the seed only adds three departments and moves one project into Austin so the project-gated RLS passes in e2e.

## 2. Follow-ups

Each is one small change. Numbered so a PR can cite it.

### 2.1 Bureau

**F1. El Paso has no `sources/sources.yaml`, so its next `cc-source-citations` capture fails.** El Paso's checklist v1 (bureau#2123) was written by `3.1-write` before P3, so `jurisdictions/el-paso/completeness-check/sources/` holds a manifest and no registry; `1.2-capture` now refuses to run without one (§1). Any other jurisdiction written by intake-prospecting before 2026-10-15 is in the same state (today, only El Paso). **Fix:** one PR that writes El Paso's registry from its run's `sources.json` with the same code `3.1-write` uses (`merge_registry_text` over `None`), stamps the manifest with `ccs.py stamp`, and is reviewed by a person for titles and `doc_type`. The sync validator's cross-check then covers El Paso too.

**F2. `sync-cc-sources.yml` does not trigger on `sources/sources.yaml`.** A registry edit alone (a title fix) is not published until the manifest is re-stamped and committed, and nothing in CI says so unless the PR's dry run notices the copies differ. **Fix:** add the registry path to the workflow's `paths:` filter, and add `ccs.py stamp --check` for every jurisdiction with a registry to the `cc-source-citations runbook tests` CI step, so a registry edit without a re-stamp fails the PR with the command to run.

**F3. `write.test.ts:108` flaked once in Quality Gates.** At bureau#2124 `d4e52bf` the 3.1-write re-run case failed with `1 !== 0` and passed on the next push with no code change. The assertion now carries the script's stdout and stderr (`writeOk`). **Fix:** none yet; when it fails again the message says why, and that becomes the fix.

**F4. Python registry validation is minimal by design.** `registry.py` `validate()` checks only what resolving and stamping need (key, title, doc_type, non-empty unique `source_keys`); the zod `SourceRegistry` in `runbooks/lib/sources/schemas.ts` is the rulebook and runs in the sync dry run and the write gate. A malformed registry (a bad `doc_type`) is caught in CI, not before a capture fetches. Recorded so nobody adds a third copy of the rules.

### 2.2 Cityhall

**F5. A tile's item count and the list's differ by the not-found citations.** The CC Submittal Checklist tile says "61 items" (located, D5) while `/items?source=cc-submittal-checklist` lists 62 (one `not_found` citation). **Fix:** word the tile "61 items located" or show "61 located · 1 not found" when `unlocated` is non-empty.

**F6. "Cited without a snapshot" groups by label; two labels share one deep link.** `LDC Title 25` and `LDC 25-8 Subchapter B` both link to the same Municode root. **Fix:** group `documentLevel` by `deep_link` and list the labels under it, or leave as is and note it in the parent's D5. Trivial either way.

**F7. `source_key` is `string | null` in cityhall; the parent's D1 types it `string`.** Every manifest capture writes from now on carries it, and Austin's does. **Fix:** once every published manifest has been stamped (Austin now, El Paso after F1), tighten the zod field and drop the null branch in `source-index.ts`.

**F8. Thumbnails are unverified by any test.** The CI local stack starts without imgproxy (`supabase start -x … imgproxy`), so `?page=1&thumb` redirects to `object/sign/…` there and the resize is only exercised on the Vercel preview and in prod. **Fix:** either enable imgproxy in the CI stack if its cost is small, or keep the e2e asserting the redirect only and add the thumbnail to the pages a person looks at before merging (F10).

**F9. e2e clicks within about a second of hydration can fail to commit the navigation.** Seen on cityhall#399 (`3e69fe2`): a chip click fetched the RSC payload and never navigated, under `next start` in CI; `playwright.config.ts` documents the timing. The intake spec now opens filtered URLs directly. **Fix:** one sentence in `spec/tests.md` or the e2e README: navigate by URL unless the click itself is what the test proves.

**F10. Both themes of the three new pages have not been looked at by a person.** Winston (this machine) has no Docker, Colima or Supabase CLI, so `pnpm dev:local`, `pnpm e2e` and the screenshots `AGENTS.md` asks for could not run here; e2e ran in CI only. **Fix:** Will (or any session on Powerstation) opens `/intake-checklists/austin`, `/items`, `/sources/cc-submittal-checklist` and an item page in light and dark and files what looks off. Foreman also asked for one manual click of the "Cites" chip and a homepage group chip on the preview.

**F11. The local seed leaves Austin at status `prospect`.** The badge on the local homepage reads "Prospect" while prod reads "Active". Cosmetic; a one-line `UPDATE` in `96-intake-checklists.sql` if it confuses anyone.

**F12. The source page's e2e clicks an overlap by coordinate.** `e2e/intake-checklists.spec.ts` clicks the intersection of items 49 and 50 on page 5 at a normalized point and expects the chooser with two entries. If CI shows it flaky, assert `regionsAt` on the data (already unit-tested in `source-viewer.logic.test.ts`) and drop the mouse click.

**F15. Small kit additions made for the source page, worth a second look.** `PdfViewer` gained `renderPageLabel(index)` (a webpage snapshot's panel title above each page); `MenuContent` gained `anchor` (a Base UI Positioner anchor at the click point) and the chooser is the kit's first trigger-less `Menu` (`modal={false}`). `ClampedText`'s "Show more" is a button inside a card with `role="button"` (clicks on it are excluded from selection); an accessibility pass may want a different card shape. Boxes of items that are not hovered or selected dim to 50 % while something is, which is not in the parent's D8 and is one line to drop.

**F16. The local seed's manifest must track the bucket.** The seed copy of `austin/manifest.json` was taken before P3 stamped it; cityhall#401 refreshes it so S1 and S2 assert the registry titles prod shows. Every later re-stamp or recapture in bureau needs the same copy, by hand, until a script does it (one line in `docs/local-stack.md`, or a `pnpm` script that pulls the three files from bureau `main`).

### 2.3 Parent spec and open questions

**F13. Parent spec v1.3.** Fold §1 of this document into the parent as a revision note (D2 fallback instead of throw; D14 append-only merge; P3 offline stamp, registry-key slugs, missing-file failure; D1 names), and mark P1–P3 shipped with their PR numbers.

**F14. Open questions carried from the parent, unchanged:**
- Q1 Library-DB facts on the homepage: (a) left out in v1, as proposed.
- Q2 who sees the pages and from where: still only the staff sidebar link and the review "Source ↗" link; no `/intake-checklists` index page. Revisit with the customer-facing entry.
- Q3 the `jurisdictions` RLS 404: ruled, stays.
- Q4 the two Austin snapshots with no located item: hidden (D5). A "Captured, nothing located" section is a small addition if the capture should be auditable from the app.
- Q5 item numbers on boxes: the rail's local ①…ⓝ. Comment numbers need `true-comment-num-mapping.tsv` in the bucket or the db-schema items table.

## 3. Testing seams

**S1: `buildSourceIndex` and the index helpers** (existing: `src/lib/intake-checklists/source-index.test.ts`, on the real Austin seed files) — F5, F6, F7.

**S2: the intake e2e spec** (existing: `e2e/intake-checklists.spec.ts`, `pnpm e2e` in CI's `check`) — F8, F9, F11.

**S3: the registry and stamp tests** (existing: `runbooks/lib/sources/test_registry.py`, `runbooks/cc-source-citations/scripts/test_registry.py`, `runbooks/intake-prospecting/tests/write.test.ts`; `ccs.py stamp --check`; `sync.mjs --dry-run`) — F1, F2, F3.

## 4. PR plan

**P1: El Paso's registry and a stamp check in CI** — `bureau`
- **Blocked by:** nothing (can start now).
- **Delivers:** F1, F2. El Paso's `sources/sources.yaml` (person-reviewed), its manifest stamped, the sync workflow triggering on the registry, and `ccs.py stamp --check` in CI.
- **Tested at:** S3.
- **Door:** two-way.
- **Blast radius:** El Paso's next capture run (which fails today without it).

**P2: tile wording, document-level grouping, e2e note** — `cityhall`
- **Blocked by:** nothing.
- **Delivers:** F5, F6, F9, F11 (and F7 once P1 has stamped El Paso).
- **Tested at:** S1, S2.
- **Door:** two-way.
- **Blast radius:** the intake pages only.

**P3: parent spec v1.3** — `winston`
- **Blocked by:** nothing.
- **Delivers:** F13.

F3, F4, F8 and F10 are watch items, not PRs, until something changes.

## 5. Not yet specified

- Whether imgproxy belongs in the CI stack (F8) depends on its start-up cost, which nobody has measured.
- A "Captured, nothing located" section (Q4) and a customer-facing entry (Q2) are product calls for the parent's next revision.

## 6. Out of scope

- The DB-backed `SourceIndex` reader (parent §5): waits on db-schema v2.
- Editing citations in the app, a version picker, reference figures: the parent's §7 and §8 stand.
