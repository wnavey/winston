# SIR artifact versions must be complete snapshots, not deltas

**Status:** Draft v1
**Date:** 2026-08-04
**Type:** Implementable spec. **Amends** the publish-side spec `../sir-product-uploading/DESIGN-SPEC.md` (winston#203) §4.5 + §7 (the version-bump artifact model) and reinforces the read-side `../sir-product-viewing/DESIGN-SPEC.md` D3/§8 (current-version-only, no fallback). The two existing specs are each internally coherent but **jointly** cause silent document loss on any partial version bump; this spec closes that seam.
**Repos touched:** `claude-plugins` (the `upload-sir` skill §4.5/§7 + `scripts/publish.ts` — carry-forward artifacts + a prior-version reader), `substation` (OPTIONAL additive migration: a `sir_artifact.content_sha256` column for reliable change detection — the model works without it, see D6).
**Repos NOT touched:** `cityhall` — **the app read query stays exactly as-is; making it correct is the whole point.** Also `conductor`, `bureau`, `surveyor`, `quarry`, `navalbase`, `radar`, `field-agent`.

Sibling of [[../sir-pipelines/bugs/UPLOAD-SIR-EXISTING-PROJECT-NO-VERSION-PROMPT]] (that one is about *create-vs-version detection*; this one is about *what a version's artifact set contains*). Both trace to `upload-sir` keying behavior on incomplete signals.

---

## Problem

A `sir_artifact` version is currently a **delta** (only the files that changed in that publish), but the app reads it as a **complete manifest** (`version = current_version`, with an explicit no-fallback rule). The result: **every document that isn't re-listed in a version bump vanishes from the app at that version.**

This is not hypothetical — it is live in prod right now:

- **SIR `caac753c-128b-4311-8d10-2480be0268eb`** (Hutton / "Car Wash - Louisville, KY"). v0 published a full deliverable: **19 artifacts** — report `pdf` + report `docx` + 17 supporting documents (11 recorded clerk instruments, 3 KYTC references, the LDC, the IARC agenda, a README index).
- v1 was published to correct one page of the PDF, with an artifact set of **just the PDF** (operator explicitly scoped it "PDF only"). `publish.ts` did exactly what #203 §7 says: it inserted **one** `version=1` row (the PDF) and advanced `current_version` to 1.
- The app detail route (`cityhall/src/routes/(app)/project/[projectId]/sir/[sirId]/+page.ts:19-20`) runs `.from('sir_artifact')…​.eq('version', sir.current_version)` — **and its own comment says `// never fall back to a different version's files (§8)`.** So with `current_version = 1` and one v1 row, **the SIR now shows only the PDF; the DOCX and all 17 supporting documents are invisible in the app** even though their v0 rows and bytes are intact.

Two consequences, both bad:
1. **Silent document loss on any partial re-publish.** The most common re-publish — "I fixed a typo in the report, re-publish" — hides every supporting document unless the operator re-lists all of them.
2. **Deletes are inexpressible.** Because a version is additive-only (`upload the new files … leave prior versions intact`), there is no way to say "this document is removed in v2." The delta model can only ever *add* files to the customer-visible set, never retire one.

### Root cause — two coherent specs, one bad joint

| Layer | What it says | Where |
|---|---|---|
| **Publish (#203 §7)** | version bump = "upload **the new files** under `v<next>`; insert rows at `version = next`; leave prior versions intact." A version's rows are a **delta**. | `sir-product-uploading/DESIGN-SPEC.md:146`; enforced by `publish.ts` (rows + uploads iterate `plan.artifacts` only — `:272/:284/:308/:337`; storage path hardcoded `sir/${sirId}/v${version}/${fileName}` — `:300`). |
| **View (D3/§8)** | detail view shows `version = current_version` **only**; older versions' rows "persist … but are hidden"; **"never fall back to a different version's files."** | `sir-product-viewing/DESIGN-SPEC.md:263, 332`; app `+page.ts:20`. |

Each is reasonable alone. **Together** they require a version's row set to be *complete* (because the reader shows only that version and won't fall back), while the writer only ever produces a *delta*. Nothing reconciles them. The viewing spec even half-saw it — line 77: *"the UI must filter by version (§8), or it will show every version's files at once"* — it fixed the "show everything" failure by filtering to one version, without noticing that made partial versions lossy.

## The bug in one diagram

```
PUBLISH SIDE (#203 §7 — DELTA)                 READ SIDE (view D3/§8 — SNAPSHOT, no fallback)
──────────────────────────────                 ──────────────────────────────────────────────
v0  ├─ report.pdf      (v0/…)                   app: SELECT * FROM sir_artifact
    ├─ report.docx     (v0/…)                        WHERE sir_id = :id
    └─ 17 supporting   (v0/…)   19 rows @ v0          AND version = current_version   ← no fallback
                                                                                    (+page.ts:20)
v1  └─ report.pdf      (v1/…)    1 row  @ v1     current_version = 1
        ↑ only the changed file                 → returns 1 row  → UI shows ONLY report.pdf
        (delta)                                 ✗ report.docx + 17 supporting docs HIDDEN
                                                   (their rows exist, but at version 0)
```

The fix makes v1 a **complete snapshot**: 1 freshly-uploaded changed file + 18 **carry-forward** rows that point back at the v0 bytes.

```
FIX — v1 as a complete snapshot (no re-upload of unchanged bytes)
─────────────────────────────────────────────────────────────────
v1  ├─ report.pdf     storage_path = sir/<id>/v1/report.pdf   ← changed → uploaded under v1
    ├─ report.docx    storage_path = sir/<id>/v0/report.docx  ← unchanged → row only, points at v0
    └─ 17 supporting  storage_path = sir/<id>/v0/<file>        ← unchanged → row only, points at v0
                                                          19 rows @ v1  → UI shows the full set
   (a doc DROPPED in v1 simply has no v1 row → correctly absent — deletes now expressible)
```

## Decisions

- **D1 — A version's `sir_artifact` row set is a COMPLETE manifest of that version's deliverable, not a delta.** Every document that should exist in version *N* has a `version = N` row. This is the invariant the read side (D3/§8) already assumes.
- **D2 — Unchanged documents are carried forward as row-only pointers.** A carried document gets a new `version = N` row whose `storage_path` (and `storage_bucket`, `byte_size`, `mime_type`, `file_name`, `kind`, `format`) **reuse the prior version's values verbatim** — pointing at `sir/<id>/v<N-1>/<file>` (or wherever that file's lineage originally landed). **No bytes are re-uploaded**; the same object is referenced by two versions' rows. Signed-URL minting is unaffected (it signs whatever `storage_path` the row carries).
- **D3 — Changed / new documents upload under `v<N>`** and get a `version = N` row with `storage_path = sir/<id>/v<N>/<file>`, exactly as today.
- **D4 — Deletes are expressed by omission.** A document present in v<N-1> but intentionally dropped in v<N> simply has **no** `version = N` row. Because the reader shows only `version = current_version`, the drop is honored with no tombstone needed. (The v<N-1> row + bytes remain as history.)
- **D5 — No schema change is required for the core model.** `sir_artifact.storage_path` is free-form `TEXT` (migration `20260731000000…:71`), so a v1 row may legally point at a `v0/…` path; the uniqueness key (after the `…_relax_sir_artifact_format_and_uploads` migration) is `(sir, version, kind, format, file_name)`, under which carry-forward rows are unique within their version. The app query is unchanged. **Only the skill + `publish.ts` change.**
- **D6 — Change detection: prefer a stored content hash; fall back to (byte_size, file_name).** To decide "changed vs unchanged," the skill compares each current deliverable file against the prior version's rows. The reliable key is a content SHA-256; today the DB stores none, so either (a) **[recommended]** add an OPTIONAL additive `sir_artifact.content_sha256 TEXT` column (substation migration) and have `publish.ts` stamp it on upload, enabling exact diffs on the next bump; or (b) MVP fallback — diff on `(file_name, byte_size)`, and when ambiguous, **ask the operator** which files changed (the operator usually knows — here, "only the PDF"). Never guess silently: if change-detection is uncertain, list what will be carried vs re-uploaded and confirm.
- **D7 — `versioning_label` still writes identically to every row of the version** (#203 D31), including carry-forward rows — so a version's whole manifest shares one change note.
- **D8 — Report `pdf`/`docx` are independent artifacts for carry-forward purposes.** If only the PDF changed, the DOCX is carried forward (row pointing at its v0 path); they need not be re-rendered in lockstep. (The optional manifest hardening that asserts pdf/docx share a source SHA is a *packaging* check, not a publish-time coupling.)

## Interface changes

### `scripts/publish.ts`
1. **Artifact carry-forward mode.** Extend the `Artifact` type with `carryForward?: boolean` and an explicit `storagePath?: string` (+ `byteSize?`, `mimeType?`). In `publish()`:
   - For a normal artifact (today's behavior): compute `storagePath = sir/<id>/v<version>/<file>`, upload bytes, insert row.
   - For `carryForward: true`: **skip the upload**; insert a row using the provided `storagePath`/`byteSize`/`mimeType` (the prior version's values). Validate that the referenced object exists in Storage before inserting (a carry-forward pointing at a missing object is a hard error, not a silent dangling row).
   - The source-exists precheck (`:272`) applies only to non-carry-forward artifacts (carry-forward has no local `sourcePath`).
2. **Prior-version reader.** Add a read subcommand `artifacts <sirId> <version>` → `[{kind, format, file_name, storage_path, byte_size, mime_type}]`, so the skill can fetch v<N-1>'s manifest to diff against and to source carry-forward values. (Mirrors the `projects`/`sir` readers; also closes a gap noted in the sibling spec — there is currently no way to enumerate a SIR's artifacts.)

### `upload-sir` skill (§4.5 "Assemble the artifact set" + §7 "Re-run & versioning")
On a **version bump** (not a fresh v0), replace "upload the new files" with:
1. Load the prior manifest via `artifacts <sirId> <current_version>`.
2. Enumerate the current deliverable dir (as today).
3. Classify each document: **changed/new** (upload under v<next>), **unchanged** (carry-forward row, prior `storage_path`), **dropped** (present in prior, absent now → no v<next> row — confirm with the operator, since a drop is customer-visible).
4. Present the full v<next> manifest — uploads, carries, and drops each labeled — and require confirmation before writing. "Publish only the PDF" should mean "the PDF re-uploads; everything else carries forward," **not** "the version contains only the PDF."
5. `publish` writes the complete set: N uploads + M carry-forward rows, all at `version = next`, all sharing the `versioning_label`.

Fresh v0 is unchanged (there is no prior version to carry from).

## Impact / repair of already-forked data

- ⚠️ **`caac753c` v1 is live and currently shows only the PDF.** The DOCX + 17 supporting documents are hidden in the app right now. **Repair:** insert 18 carry-forward `version=1` rows (report `docx` + the 17 supporting documents) whose `storage_path` points at their existing `sir/caac753c…/v0/<file>` objects, sharing `versioning_label = "Fixed page 11 aerial image"`. No bytes move. After that, the app's `version = current_version = 1` query returns the full 19-artifact set. This repair is safe to run before the code change lands (it's plain row inserts against the existing schema) and should be done promptly to un-hide the docs.
- **`73329e87` (the other Louisville SIR, v0)** — unaffected (single version, complete by construction).
- **The app read path** — unaffected by design; it becomes *correct* once versions are complete. No cityhall change.
- **Storage cost** — unchanged/better: carry-forward references existing objects instead of duplicating bytes across versions.

## Open questions

- **Q1 — Change detection for MVP:** ship the `content_sha256` column now (D6a) or start with `(file_name, byte_size)` + operator confirm (D6b) and add the hash later? (Recommend D6a — it's a one-column additive migration and removes all ambiguity.)
- **Q2 — Carry-forward provenance:** should a carried row record which version's bytes it points at (e.g. a `source_version` column) for auditing, or is the `storage_path` (`…/v0/…`) self-documenting enough? (Lean self-documenting for MVP.)
- **Q3 — Should the skill ever *offer* a true delta (partial) version, or is complete-snapshot the only mode?** (Recommend: complete-snapshot is the only mode; "partial" is what caused this.)
- **Q4 — Report pdf/docx lockstep:** when only one report format changes, carry the other forward (D8), or require both re-rendered so a version's pdf and docx always match? (Lean carry-forward; note the packaging SHA-parity check becomes advisory across a carried pair.)

## Reproduction / verification

1. **Confirm the delta model in publish:** `grep -n "plan.artifacts\|\.upload(" claude-plugins/plugins/noetic-tools/skills/upload-sir/scripts/publish.ts` → storage path hardcoded to `v${version}` (`:300`); rows + uploads iterate `plan.artifacts` only.
2. **Confirm the no-fallback reader:** `sed -n '15,22p' cityhall/src/routes/(app)/project/[projectId]/sir/[sirId]/+page.ts` → `.eq('version', sir.current_version)` with the `never fall back` comment.
3. **Confirm the live loss:** `select version, kind, format, file_name from sir_artifact where site_intelligence_report_id = 'caac753c-128b-4311-8d10-2480be0268eb' order by version, file_name;` → 19 rows at v0, **1 row at v1** (the PDF). Load the SIR in the app → only the PDF appears.
4. **Acceptance test for the fix:** re-publish a run changing one file → the new version has a row for **every** current document (one uploaded under `v<n>`, the rest carry-forward rows whose `storage_path` is a prior-version path); the app shows the complete set; and dropping a file from the deliverable makes it absent from the new version (and thus the app) while its prior rows/bytes remain.
