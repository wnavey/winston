# Plan-Set Storage Pathing — Canonicalize the `source_storage_path` Scheme

**Status:** Draft v1
**Date:** 2026-08-17
**Repos touched:** `substation` (assign a canonical plan-set storage key at commit-time via `storage.move`; adopt the same scheme in zip triage; add a DB uniqueness guard). Optional migration only.
**Repos verified — NO change required:** `cityhall`, `conductor` (both derive the output prefix from the stored `source_storage_path` at runtime — they are scheme-agnostic; see §5).
**Parent:** `../../DESIGN-SPEC.md` (Pre-Processing v2). This is a self-contained storage-hygiene fix in the same subsystem; it does not depend on the mechanical-strip phases.

> **How this was found.** Reconstructing the 7 submission versions of the Lamar + Collier project (project `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, submission `cf1201c2-2e8b-4034-9a5e-a70b6317e39a`) surfaced three divergent storage schemes and a pile of orphaned staging folders. The DB is the only reliable map of which object belongs to which version; the bucket layout is not. This spec makes the bucket layout self-describing.

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

**Where derived outputs are written** (all relative to a `basePath` computed by stripping the filename off `source_storage_path`)
- `plan-set.ts:35` — `basePath = storagePath.replace(/\/[^/]+$/, '')`.
- `plan-set.ts:95` — `` `${basePath}/optimized.pdf` ``.
- `plan-set.ts:102-114` — `` `${basePath}/sheets/${i}.pdf` `` and `.jpg`.
- `plan-set.logic.ts:79-80, 139-140, 222` — `sheet_version.storage_path` / `thumbnail_storage_path` set to those sheet keys.

**`version_number` is available at commit time** — set at `submissions.ts:73` (v1 on submission create) and `submissions.ts:218` (`latest.version_number + 1` on new version). The plan-set commit already has the `submission_version_id`; it just doesn't read the number today.

---

## Fix

### D1 — Canonical scheme
Adopt `{project_id}/plan-set/v{submission_version_number}/{source.pdf | optimized.pdf | sheets/{k}.(pdf|jpg)}`. Singular `plan-set` (one per project). Drop `{plan_set_id}` (1:1 invariant, verified 22/22). Normalize the source filename to `source.pdf` (matches the existing v1/zip convention; makes the key fully deterministic).

### D2 — Assign at commit, not at prepare-upload, via `storage.move`
`prepare-upload` runs **before** classification — `commit-upload` downloads the bytes to decide plan-set vs document (agent-confirmed). So the clean key can only be assigned once we know both "it's a plan set" and the `version_number`. At `commit-upload`, after classifying as a plan set:
1. read `version_number` from `submission_version` (via `svId`),
2. `sb.storage.from('submission-data').move(stagedPath, ` `` `${projectId}/plan-set/v${n}/source.pdf` `` `)`,
3. insert `plan_set_version.source_storage_path` = the clean key.

`prepare-upload` keeps writing to the generic `uploads/{uploadId}/…` **staging** slot; the `move` promotes it and, as a bonus, removes the staging orphan in one step. Derived outputs need **no code change** — `basePath` (`plan-set.ts:35`) strips the filename off the clean source, so `optimized.pdf` and `sheets/` auto-land under `plan-set/v{n}/`.

### D3 — Deterministic ⇒ self-cleaning
Because the key is `v{n}/source.pdf` (no random component), a repeated upload attempt or a `/replace` for the same submission version **overwrites its own slot** instead of accumulating orphans. This is consistent with reprocessing, which already reuses the latest `plan_set_version` (`plan-sets.ts:282, 298-299`).

### D4 — Zip triage adopts the same scheme
`zip.ts:199` stops minting a fresh `entityId` plan_set and instead attaches to the project's single plan set at `plan-set/v{n}/source.pdf`. (Ties into Q2.)

### D5 — Enforce the invariant the path now relies on
Dropping `{plan_set_id}` is only safe if a `(project, submission_version)` can never hold two plan sets. It never does in prod, but nothing enforces it — and zip triage actively creates extra `plan_set` rows. Add a DB uniqueness guard (recommended: **unique `plan_set_version(submission_version_id)`**, optionally also one `plan_set` per project) so a collision fails loudly instead of silently clobbering.

### D6 — No historical migration (default)
Every consumer derives the output prefix from the **stored** `source_storage_path` at runtime (§5) — no consumer hardcodes the scheme. So existing rows keep resolving against their existing objects untouched. The new scheme applies **going forward only**. A one-time backfill/rewrite of old keys, and a sweep of the pre-existing orphan cruft, are **out of scope** here (Q4/Q5).

---

## Consumers / blast radius (§5)

Every reader derives the prefix from the stored path — **none parse or assume the scheme** — so D1–D4 are transparent to them:

- **cityhall** `…/plan-set/+page.ts` — `:163` builds the optimized-PDF URL as `source_storage_path.replace(/\/[^/]+$/,'')+'/optimized.pdf'` (scheme-agnostic); `:100/:126` batch-sign `thumbnail_storage_path`. **No change.**
- **conductor** `shared/vision-file.ts` — `:155/:162` download `thumbnail_storage_path`; `:187/:210` sign `storage_path` for docs. **No change.**
- **substation** processing (`sheet.ts`, `plan-set.ts`) and reprocess (`plan-sets.ts:298`) all read the stored path. **No change** beyond the commit-time assignment itself.

This is the key reassurance: the fix is a **write-side canonicalization**; the read side already treats the path as opaque.

---

## Open questions

- **Q1 — Promotion mechanism.** `storage.move` (recommended, no re-download, removes the staging orphan) vs. copy+delete vs. "Option C" (leave source in `uploads/`, only redirect the *derived* outputs to `plan-set/v{n}/` by decoupling `basePath` from the source). Recommend **move**.
- **Q2 — Is a project ever legitimately multi-plan-set?** If no (all evidence says no), enforce D5 and fix zip triage to attach to the one plan set. If yes, the `{plan_set_id}`-free path is wrong and we need a discriminator segment — this decision gates D1/D4/D5.
- **Q3 — Overwrite vs. immutability per version.** D3 clobbers a prior same-version source on re-upload. Consistent with reprocess-reuses-latest, but confirm we don't want per-version immutability (which would reintroduce a disambiguator and defeat self-cleaning).
- **Q4 — Backfill historical rows?** Rewrite old `source_storage_path`s + move their objects to the clean scheme, or leave as-is (D6 default = leave). Leaving is safe; migrating is risky and buys only cosmetics.
- **Q5 — One-time orphan sweep.** The existing `pending/`, stray `plan-sets/{uuid}/`, and abandoned `uploads/{uploadId}/` cruft (incl. the 8 Lamar orphans) — clean up as a separate janitorial task, or ignore? Recommend a separate, opt-in sweep, not bundled here.
- **Q6 — Interaction with Pre-Processing v2 Phase 1.** The commit-time `move` lands near the plan-set commit / event-stamping touched by the parent spec's D2/D5. Almost certainly orthogonal (that stamps a flag onto the event; this rewrites a storage key), but sequence the two PRs to avoid a merge collision in `submissions.ts`.

---

## Scope boundaries

`substation`-only: (1) commit-time canonical key + `storage.move` in the plan-set branch of `commit-upload`; (2) the same scheme in `zip.ts`; (3) a uniqueness-guard migration (D5). No cityhall/conductor change (§5). No historical backfill and no orphan sweep by default (D6, Q4, Q5). Merging is Will's call.
