# Plan-Set Storage Pathing — Canonicalize the `source_storage_path` Scheme

**Status:** Draft v2
**Date:** 2026-08-17
**Repos touched:** `substation` only — (1) assign a canonical plan-set storage key at commit-time via `storage.move`; (2) rewrite zip triage into a two-pass classifier that elects a single plan set; (3) auto-replace collision policy when a second plan set lands on the same submission version. No migration.
**Repos verified — NO change required:** `cityhall`, `conductor` (both derive the output prefix from the stored `source_storage_path` at runtime — they are scheme-agnostic; see §5).
**Parent:** `../../DESIGN-SPEC.md` (Pre-Processing v2). Self-contained storage-hygiene fix in the same subsystem; does not depend on the mechanical-strip phases.
**Sibling (spun out of this spec's Q):** `../../new-features/clarifying-questions/DESIGN-SPEC.md` — the HITL upload-clarification framework that will later upgrade this fix's auto-replace default into an "ask the user" prompt.

> **Revision note (v2).** Session on 2026-08-17 traced every cited file:line in `substation` and resolved the v1 open questions. Material changes:
> - **Q1 → resolved: `storage.move`.** Promote the staged object, no re-download; disposes the staging orphan in one call.
> - **Q2 → resolved: a project is never legitimately multi-plan-set** (Will's ruling; matches 22/22 · 30/30 prod). The *only* code path that can still mint a second plan set in one operation is **zip triage** (`zip.ts` loops `registerPdf` per triage group). D4 is rewritten as a **two-pass elect-one-winner** classifier (new §D4).
> - **Q3 → resolved: overwrite (no per-version immutability).** Consistent with reprocess-reuses-latest and with the self-cleaning deterministic key.
> - **D5 (DB uniqueness constraint) → DROPPED.** It is *not necessary for correctness* once app logic elects one plan set; it is only a race backstop, and expressing "fail loud" in Postgres turns the collision into a raw 500. Replaced by an explicit **collision policy = auto-replace** (new §D5).
> - **New insight — the deterministic key itself forces a collision policy.** Two plan sets in one version now resolve to the *same* key (`plan-set/v{n}/source.pdf`) and silently clobber, where the old random-UUID scheme kept them apart. So a policy must be chosen regardless of any constraint; we choose auto-replace (§D5, Q-A).
> - **`/replace` gets the same `move`** (v1 named it in the code map but only spelled the mechanism for `commit-upload`). Now explicit in §D2.
> - **Classification internals documented** (new §Appendix A): the plan-set test is a *first-page short-side > 11″* check — page-count-agnostic, orientation-independent; 11×17 tabloid falls *below* the bar. This grounds the D4 winner metric.

---

## Problem

A plan set's source PDF (and every artifact derived from it) is stored under a key that is **inconsistent across code eras, non-deterministic, and leaks implementation details** (random upload UUIDs, epoch-ms timestamps). Nothing in the storage key tells you which submission version it belongs to; only a DB lookup does. Three schemes coexist in prod:

| Scheme | Example key | Where it comes from |
|---|---|---|
| **A — current code** | `{projectId}/uploads/{uploadId}/{safeName}` | `submissions.ts:528` — the generic `prepare-upload` path, used for **all** uploads (plan sets *and* documents, undifferentiated). Live since commit #7. |
| **B — legacy "pending"** | `{projectId}/plan-sets/{plan_set_id}/pending/{epoch_ms}/{name}` | An older upload flow, now removed. This is what the Lamar v2–v7 rows actually use. |
| **C — legacy "v1"** | `{projectId}/plan-sets/{uuid}/v1/source.pdf` | Still **live** in zip triage (`zip.ts:199`), where `{uuid}` is a fresh random `entityId`, *not* the plan_set_id. Also the Lamar v1 row. |

Consequences, all observed in prod:

1. **The key is not self-describing.** `uploads/{uploadId}/…` (scheme A) is indistinguishable from a supporting document. You cannot tell a plan set from a tax certificate by its path, nor which submission version it is, without joining `plan_set_version → submission_version`.
2. **Non-deterministic keys accumulate orphans.** Because every upload attempt mints a new `uploadId`/timestamp, abandoned attempts are never overwritten and never cleaned up. The Lamar plan-set folder `plan-sets/908ffab5…/pending/` holds **14 timestamp folders of which only 6 are live** (8 orphans); there are also **5 stray `plan-sets/{uuid}/` folders**, two pairs of which are byte-for-byte duplicates. No code deletes any of this (§5, item 7).
3. **`plan_set_id` in the path buys nothing.** Verified across all of prod: **22/22 projects have exactly one `plan_set`; 30/30 submission_versions have exactly one `plan_set_version`** (`select max(c) …` — max is 1, zero exceptions). The `{plan_set_id}` segment is dead weight, and scheme C doesn't even use the real one.

**Target (Will's proposal), refined:**

```
{project_id}/plan-set/v{submission_version_number}/source.pdf
{project_id}/plan-set/v{submission_version_number}/optimized.pdf
{project_id}/plan-set/v{submission_version_number}/sheets/{k}.pdf
{project_id}/plan-set/v{submission_version_number}/sheets/{k}.jpg
```

Deterministic, human-legible, self-cleaning (a re-upload for the same version overwrites its own slot instead of spawning a new orphan), and free of `plan_set_id`. Before/after for Lamar v5:

```
BEFORE  23301a8a…/plan-sets/908ffab5…/pending/1784044505518/1700 S Lamar.pdf   (+ orphans)
AFTER   23301a8a…/plan-set/v5/source.pdf
```

---

## Current code map (verified file:line)

**Where the source key is built and written**
- `submissions.ts:528` — `const storagePath = ` `` `${projectId}/uploads/${uploadId}/${safeName}` `` (generic, pre-classification).
- `submissions.ts:806` — plan-set commit inserts `source_storage_path: body.storage_path` (the generic path, passed straight through).
- `plan-sets.ts:228` — `/replace` endpoint inserts the same way.
- `zip.ts:199` → `zip.ts:215` — zip triage builds `{projectId}/plan-sets/{entityId}/v1/source.pdf` and inserts it (scheme C, live).

**How a PDF is classified** (grounds the D4 winner rule; full detail in Appendix A)
- `classify.ts:15` — `PK` magic bytes ⇒ `zip` (the *only* trigger for zip triage).
- `classify.ts:19-24` — `%PDF` ⇒ load **page 1 only**, `plan_set` iff `min(width,height) > 11″` (`PLAN_SET_THRESHOLD_PTS = 792`), else `document`.

**Where the two-pass rewrite lives**
- `zip.ts:110-125` — `processZip` loops `actionableGroups`; for each `plan_set|document` group calls `registerPdf`.
- `zip.ts:174-239` — `registerPdf` reads the PDF, re-classifies by bytes (`:193` — a `document` group can *promote* to `plan_set`), and unconditionally inserts a fresh `plan_set` + `plan_set_version` for **every** plan-set-classified group. This is the one place a single upload operation can create N plan sets.

**Where derived outputs are written** (all relative to a `basePath` computed by stripping the filename off `source_storage_path`)
- `plan-set.ts:35` — `basePath = storagePath.replace(/\/[^/]+$/, '')`.
- `plan-set.ts:95` — `` `${basePath}/optimized.pdf` ``.
- `plan-set.ts:102-114` — `` `${basePath}/sheets/${i}.pdf` `` and `.jpg`.
- `plan-set.logic.ts:79-80, 139-140, 222` — `sheet_version.storage_path` / `thumbnail_storage_path` set to those sheet keys.

**`version_number` is available at commit time** — set at `submissions.ts:73` (v1 on submission create) and `submissions.ts:218` (`latest.version_number + 1` on new version). `resolveActiveVersion` (`submissions.ts:741`) already queries `submission_version` and just needs to `select` the number and return it. The `/replace` endpoint already has `version_number` in scope (`plan-sets.ts` joins it into `draftLinks`). Zip triage (`processZip`) has only `submissionVersionId` and needs one extra lookup.

---

## Fix

### D1 — Canonical scheme
Adopt `{project_id}/plan-set/v{submission_version_number}/{source.pdf | optimized.pdf | sheets/{k}.(pdf|jpg)}`. Singular `plan-set` (one per project). Drop `{plan_set_id}` (1:1 invariant, verified 22/22). Normalize the source filename to `source.pdf` (matches the existing v1/zip convention; makes the key fully deterministic). Provide a single helper — `planSetSourceKey(projectId, versionNumber)` — used by every write path so the scheme has one source of truth.

### D2 — Assign at commit, not at prepare-upload, via `storage.move`
`prepare-upload` runs **before** classification — `commit-upload` downloads the bytes to decide plan-set vs document (agent-confirmed). So the clean key can only be assigned once we know both "it's a plan set" and the `version_number`. This applies to **both** write endpoints:

- **`commit-upload` → `handlePlanSetUpload` (`submissions.ts:786`)**: (1) read `version_number` (returned from `resolveActiveVersion`); (2) `sb.storage.from('submission-data').move(stagedPath, planSetSourceKey(projectId, n))`; (3) insert `plan_set_version.source_storage_path` = the clean key; (4) fire the `process-file` event with `storagePath` = the clean key (today it passes the staged path at `:825`).
- **`/replace` (`plan-sets.ts:222`)**: identical `move` + clean-key insert + clean-key event. `version_number` is already in scope.

`prepare-upload` keeps writing to the generic `uploads/{uploadId}/…` **staging** slot; the `move` promotes it and removes the staging orphan in one step. Derived outputs need **no code change** — `basePath` (`plan-set.ts:35`) strips the filename off the clean source, so `optimized.pdf` and `sheets/` auto-land under `plan-set/v{n}/`.

### D3 — Deterministic ⇒ self-cleaning
Because the key is `v{n}/source.pdf` (no random component), a repeated upload attempt or a `/replace` for the same submission version **overwrites its own slot** instead of accumulating orphans. Consistent with reprocessing, which already reuses the latest `plan_set_version` (`plan-sets.ts:282, 298-299`). This is also *why* a collision policy is mandatory (§D5): the shared slot means a genuinely-second plan set would clobber the first's bytes.

### D4 — Zip triage: two-pass, elect exactly one plan set
The deterministic singular key (`plan-set/v{n}/source.pdf`) cannot hold two plan sets. Zip triage is the only operation that can produce two, so it is rewritten from a **streaming per-group register** into a **two-pass classifier**:

1. **Pass 1 — measure.** Iterate every `plan_set|document` triage group, read each PDF once, and compute `{ minSidePts, pageCount, fileSize }`. (`fileSize` is already in hand as `buffer.length` at `zip.ts:189`; `pageCount` is a one-line add to the existing `pdf-lib` parse — see Appendix A. `minSidePts` is the same page-1 short-side used by classification.)
2. **Elect the winner** among PDFs whose **short side > 11″** (the objective byte-check — we deliberately ignore the LLM's plan_set-vs-document opinion for this pick, which is noisier). Ranking:
   1. **short side > 11″** — candidacy gate,
   2. **most pages/sheets** — primary,
   3. **largest file size** — tiebreak.
3. **Pass 2 — register.** The single winner registers as the `plan_set` at `plan-set/v{n}/source.pdf`. **Every other PDF** — including other >11″ PDFs that lost — registers as a `document`. Drainage-models and binaries are unchanged. If **zero** PDFs clear the >11″ gate, no plan set is created (all become documents) — the legitimate "one or none per version" outcome.

`registerPdf` splits into `registerWinnerAsPlanSet` (canonical path) + `registerAsDocument`, driven by the pass-1 election rather than per-file classification. `processZip` gains one `version_number` lookup up front.

> Note: today a `document`-typed group can *promote* to plan_set on the byte-check (`zip.ts:193`). Under D4 that promotion still feeds the candidate pool — the byte-check is authoritative for candidacy — but only the elected winner becomes a plan set.

### D5 — Collision policy: auto-replace (no DB constraint)
The v1 plan added a `UNIQUE (plan_set_version.submission_version_id)` guard. **Dropped.** Reasons: (a) it is *not necessary for correctness* — after D4 no path creates a second plan set in one operation; (b) it only guards a concurrent-request race; (c) expressing "fail loud" in Postgres turns the collision into a raw 500. Instead we pick an explicit **collision policy in app logic**:

**A second, different plan-set PDF uploaded to the same draft submission version → replace the existing plan set** (reuse the `/replace` delete-then-insert semantics internally, rather than blindly inserting a second `plan_set_version`). Rationale:
- It is Will's stated perfect-world default.
- It is exactly consistent with D3 ("deterministic ⇒ self-cleaning — a re-upload overwrites its own slot").
- No raw DB error, no user-facing 500.
- **Forward-compatible with HITL** — the clarifying-questions framework (sibling spec) will later intercept *before* the auto-replace and instead ask *"File {new} appears to be a plan set, different from {existing}. Replace or drop?"*. Auto-replace is the safe floor until that ships.

Concretely, `handlePlanSetUpload` checks for an existing `plan_set_version` on this submission version; if present, it cancels+unlinks+deletes the owned prior version (mirroring `plan-sets.ts:200-210`) before inserting the new one and moving bytes into the shared slot.

### D6 — No historical migration (default)
Every consumer derives the output prefix from the **stored** `source_storage_path` at runtime (§5) — no consumer hardcodes the scheme. So existing rows keep resolving against their existing objects untouched. The new scheme applies **going forward only**. A one-time backfill/rewrite of old keys, and a sweep of the pre-existing orphan cruft, are **out of scope** here (Q4/Q5).

---

## Consumers / blast radius (§5)

Every reader derives the prefix from the stored path — **none parse or assume the scheme** — so D1–D5 are transparent to them:

- **cityhall** `…/plan-set/+page.ts` — `:163` builds the optimized-PDF URL as `source_storage_path.replace(/\/[^/]+$/,'')+'/optimized.pdf'` (scheme-agnostic); `:100/:126` batch-sign `thumbnail_storage_path`. **No change.**
- **conductor** `shared/vision-file.ts` — `:155/:162` download `thumbnail_storage_path`; `:187/:210` sign `storage_path` for docs. **No change.**
- **substation** processing (`sheet.ts`, `plan-set.ts`) and reprocess (`plan-sets.ts:298`) all read the stored path. **No change** beyond the commit-time assignment itself.

This is the key reassurance: the fix is a **write-side canonicalization**; the read side already treats the path as opaque.

---

## Resolved questions (were Q1–Q6)

- **Q1 — Promotion mechanism → `storage.move`.** No re-download; removes the staging orphan.
- **Q2 — Multi-plan-set project? → No.** Never legitimately multi-plan-set (22/22 · 30/30). Zip triage was the only violator; D4 elects one winner.
- **Q3 — Overwrite vs. per-version immutability → Overwrite.** No immutability; consistent with reprocess-reuses-latest and the self-cleaning key.
- **Q-A (new) — Collision policy → auto-replace** (§D5). Not a DB constraint. Upgraded to an interactive prompt later by the clarifying-questions sibling spec.
- **Q4 — Backfill historical rows? → No** (D6 default). Safe to leave; migrating is risky and buys only cosmetics.
- **Q5 — One-time orphan sweep → separate janitorial task**, not bundled here.
- **Q6 — Interaction with Pre-Processing v2 Phase 1.** The commit-time `move` lands near the plan-set commit / event-stamping touched by the parent spec's D2/D5. Almost certainly orthogonal (that stamps a flag onto the event; this rewrites a storage key), but **sequence the two PRs** to avoid a merge collision in `submissions.ts`.

---

## Scope boundaries

`substation`-only, **one PR**:
1. Canonical key helper + commit-time `move` in `handlePlanSetUpload` (`submissions.ts`) and `/replace` (`plan-sets.ts`).
2. Zip triage two-pass elect-one-winner rewrite (`zip.ts`) + `measurePdf` page-count helper.
3. Auto-replace collision policy on the single-file path (§D5).
4. Unit tests: winner election (measure→pick→demote), `planSetSourceKey`/`basePath` round-trip.

**No** DB migration (D5 constraint dropped). **No** cityhall/conductor change (§5). **No** historical backfill and **no** orphan sweep (D6, Q4, Q5). **No** HITL prompts — that is the sibling `clarifying-questions` spec; this PR ships auto-replace as the interim default. Merging is Will's call.

---

## Appendix A — How classification actually works (`classify.ts`)

The plan-set test is a **first-page short-side dimension check**, not a page-count or sheet-size match:

```
PLAN_SET_THRESHOLD_PTS = 11 * 72 = 792 pts        // 11 inches
zip       iff  bytes start with PK (0x50 0x4b)     // classify.ts:15 — the ONLY zip-triage trigger
plan_set  iff  %PDF  &&  min(page[0].w, page[0].h) > 11″   // classify.ts:19-24
document  iff  %PDF  &&  not the above
binary    otherwise
```

Properties that shape the D4 winner rule:
- **Page 1 only.** Never samples other pages (`classify.ts:37-38`). **Page count is not consulted anywhere in classification** — which is exactly why D4 must compute it separately (`pdf.getPages().length`) to rank candidates.
- **Orientation-independent.** Uses `min(width, height)`; portrait vs landscape is irrelevant — only the *short* side.
- **Threshold is "short side > 11″," strictly greater.** So: 24×36 / 30×42 / 36×48 → plan_set; 8.5×11 / 8.5×14 → document; **11×17 tabloid → `min = exactly 11″`, not `> 11″` → `document`.** A tabloid-only sheet set is currently misclassified — noted as a known edge, out of scope for this fix.
- **`.docx` is a `PK` container**, so it currently classifies as `zip` and enters triage. Pre-existing quirk, unrelated, noted for completeness.

The D4 winner metric (`pageCount` primary, `fileSize` tiebreak, gated on `minSide > 11″`) is therefore a small extension of this same page-1 parse: one `pdf-lib` load per candidate already happens for the dimension check; expose `getPages().length` alongside it and carry `buffer.length`.
