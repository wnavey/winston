# Porting `upload-sir` to the new SIR pipeline

**Status:** Draft v1
**Date:** 2026-08-01
**Type:** Implementable spec. A **thin adapter** on top of the publish machinery already fully
specified in `../sir-product-uploading/DESIGN-SPEC.md` (the "SIR Publishing" spec). That spec owns
*everything about the write* — org/project resolution, the `site_intelligence_report` + `sir_artifact`
rows, the `sir-artifacts` bucket, versioning, idempotency, `publish.ts`. **This spec changes exactly
one thing:** where the skill *reads its inputs from*, so it can consume a **new-pipeline run tree**
(`bureau/pipelines/sir/`) in addition to the legacy `diligence-report` skill's tree.
**Repos touched:** `claude-plugins` (edit `plugins/noetic-tools/skills/upload-sir/SKILL.md`).
**Repos NOT touched:** `bureau` (no pipeline change), `substation` (no new migration beyond the one
the publishing spec already owns), `upload-sir/scripts/publish.ts` (unchanged), `cityhall`,
`conductor`, `surveyor`.

> **One-line goal:** Point `upload-sir` at a completed pipeline run
> (`~/noetic/working/sir/<customer>/<project>/<ts>/`) and have it publish exactly as it does for a
> legacy `diligence-report` run — by adding a run-layout resolver that maps ~4 input files to their
> pipeline locations. Nothing downstream of "locate the inputs" changes.

---

## 1. Problem

`upload-sir` was written against the **legacy skill's** on-disk layout — its SKILL.md § "Pipeline"
hardcodes `sir/deliverable/…`, `seed-site-data.md`, `location-resolution/location-resolution.md`,
`hitl/intake-transcript.md`, all relative to `$NOETIC_DILIGENCE_DIR`. The **new SIR pipeline writes a
different tree**: the deliverable lands at `<run>/deliverable/` (no `sir/` segment) and the metadata
files live under per-step `output/<step>/…` folders. Pointed at a pipeline run today, the skill's §0
locate step fails ("neither `sir/deliverable/site-intelligence-report.{pdf,docx}` exists → stop").

**Why it's simple:** the skill's locate/derive logic is agent-executed prose, and `publish.ts` already
takes **absolute** `sourcePath`s in its plan JSON (SKILL.md § "Plan JSON shape"). So making the skill
publish a pipeline run needs no script change, no DB change, no bureau change — only a resolver that
knows the pipeline's paths. It works against the **already-merged** pipeline output as-is.

## 2. Verified path mapping (grounded 2026-08-01)

Legacy paths from `upload-sir/SKILL.md` §0–§2 and `../sir-product-uploading/DESIGN-SPEC.md` §2.
Pipeline paths from `pipeline_runner.py list sir` (step output declarations) on `bureau/main`.

| Input the skill needs | Legacy `diligence-report` (rel. to run dir) | New SIR pipeline (rel. to run dir) |
|---|---|---|
| Report **PDF** | `sir/deliverable/site-intelligence-report.pdf` | `deliverable/site-intelligence-report.pdf` |
| Report **DOCX** | `sir/deliverable/site-intelligence-report.docx` | `deliverable/site-intelligence-report.docx` |
| **Supporting docs** | `sir/deliverable/supporting-documents/*` | `deliverable/supporting-documents/*` |
| Intended-use / **description** seed | `seed-site-data.md` | `output/1.2-site-jurisdiction/seed-site-data.md` |
| **Address / lat / lon / parcel_ids** | `location-resolution/location-resolution.md` | `output/1.2-site-jurisdiction/location-resolution/location-resolution.md` |
| **Org-name** inference (optional) | `hitl/intake-transcript.md` | `output/1.1-input-capture/request.md` (+ `intake.json`) |
| **Publishing record** (idempotency) | `sir-publishing-record.json` (run root) | `sir-publishing-record.json` (run root) — **SAME** |
| Artifact enumeration (authoritative, optional) | glob `sir/deliverable/` | `output/5.7-package/package-manifest.json` → `deliverable_dir`, `documents[]`, `supporting_documents[]` |

Notes:
- **`location-resolution.md` is byte-for-byte the same producer** — the `parcel-geo-location-resolution`
  skill writes it in both engines (canonical address + lat/lon + parcel set). Only the folder moved.
  So all of § step-1's naming/location derivation works unchanged once the path resolves.
- **The deliverable folder is at the run ROOT in both** — legacy `<run>/sir/deliverable/`, pipeline
  `<run>/deliverable/`. The *only* difference is the `sir/` segment.
- **`sir-publishing-record.json` and versioning need no change at all** — same run-root location, same
  semantics. The re-run / version-bump path in the publishing spec is engine-agnostic already.

## 3. The change — a run-layout resolver in `upload-sir/SKILL.md`

Insert a detection + resolution step ahead of §0 "Locate the run". Everything after it reads through
the resolved paths instead of the hardcoded legacy ones.

### 3.1 Detect the layout (D2)
Given the run dir (from `$NOETIC_DILIGENCE_DIR` or the `--run-dir` arg, per the skill's existing §0):

- **`sir-pipeline`** iff `output/5.7-package/package-manifest.json` exists **or** (`deliverable/` exists
  at the run root **and** `output/1.1-input-capture/` exists).
- **`legacy-skill`** iff `sir/deliverable/` exists.
- **Neither** → the existing "nothing to publish, stop" error.

Detection is by artifact presence, not a flag — an operator can point the skill at either tree without
declaring which. If somehow both match, prefer `sir-pipeline` (a run tree that has been packaged by 5.7
is the current engine) and note it.

### 3.2 Resolve the input paths (D1, D3)
Carry a small table keyed by layout (the § 2 columns). Every subsequent read — deliverable
enumeration, `seed-site-data.md`, `location-resolution.md`, the org-inference source — goes through it.
This is a SKILL.md prose change; the resolved **absolute** paths flow into the plan JSON's `sourcePath`
fields exactly as today, so `publish.ts` is untouched.

### 3.3 Enumerate artifacts (D4)
- **MVP:** glob the resolved `deliverable/` dir exactly as the skill globs `sir/deliverable/` today —
  `*.pdf`/`*.docx` = `report`, everything under `supporting-documents/` = `supporting_document`. Zero
  new logic.
- **Optional hardening:** when `output/5.7-package/package-manifest.json` is present, enumerate from its
  `documents[]` + `supporting_documents[]` (authoritative — it is the packaging step's own record) and
  assert the two report files share `source_sha256` (the manifest's client-visible "PDF and Word are
  the same document" promise). A glob can't make that check; the manifest can. Recommended but not
  required for the first port.

## 4. What deliberately does NOT change (scope fence)

Owned by `../sir-product-uploading/DESIGN-SPEC.md`, untouched here:
- `publish.ts` and all its subcommands (`preflight`/`orgs`/`projects`/`publish`/…).
- Org/project interactive resolution, slug logic, collision/rename handling.
- The `site_intelligence_report` + `sir_artifact` row shapes, `created_by` resolution, storage path
  convention (`sir/<sir_id>/v<version>/<file>`), the all-up confirm gate.
- Versioning, `sir-publishing-record.json`, idempotent re-run/heal.
- The `substation` `..._relax_sir_artifact_format_and_uploads.sql` migration — a **prerequisite this
  port inherits**, not a thing it adds. Same fail-fast behavior if unapplied.

## 5. Invocation model (D5)

**Keep `upload-sir` standalone and operator-invoked** — do **not** make it a pipeline step for the
port. The pipeline is operator-driven and stops at §5.7; the operator then runs:

```
upload-sir  --run-dir ~/noetic/working/sir/<customer>/<project>/<ts>
```

The skill detects `sir-pipeline` layout and proceeds identically to a legacy run. This mirrors the
publishing spec's "opt-in final gate" exactly, adds no `bureau`→`claude-plugins`→prod-DB coupling, and
needs nothing built in the pipeline. (A future *optional* pipeline `5.8 Publish` checkpoint that merely
hands off to this skill is noted in §7 — not part of the port.)

## 6. Decisions

- **D1 — Port = a SKILL.md-only edit to `upload-sir`.** No `publish.ts`, no `bureau`, no schema change.
  Works against already-merged pipeline output.
- **D2 — Auto-detect layout by artifact presence** (`output/5.7-package/package-manifest.json` /
  `deliverable/` + `output/1.1-input-capture/` ⇒ pipeline; `sir/deliverable/` ⇒ legacy). No engine flag.
- **D3 — A per-layout path table** feeds the existing derive/enumerate prose; resolved absolute paths
  flow into the plan JSON unchanged.
- **D4 — Enumerate artifacts by globbing the resolved `deliverable/`** for MVP; optionally prefer the
  pipeline's `package-manifest.json` and assert `source_sha256` parity.
- **D5 — `upload-sir` stays standalone/operator-invoked**, pointed at the pipeline run dir; not a
  pipeline step.
- **D6 — All write mechanics, versioning, and the schema prerequisite remain owned by
  `sir-product-uploading`** — this spec adds only the read-side adapter.

## 7. Open questions

- **Q1 — Org-name inference source in the pipeline.** Legacy reads `hitl/intake-transcript.md`. The
  pipeline's nearest equivalent is 1.1 `request.md` / `intake.json` — confirm it actually carries a
  buyer/requester name. If it doesn't, the skill already falls back to *asking* the operator (SKILL.md
  §2), so this is a nicety, not a blocker. Recommend: read `intake.json` if a requester field exists,
  else `request.md`, else ask.
- **Q2 — Consume `package-manifest.json` now or later?** It's the authoritative artifact list and
  enables the same-source assertion. Recommend shipping the glob-based MVP first (proves the port), then
  the manifest read as a fast follow.
- **Q3 — A declared `5.8 Publish` handoff step in the pipeline?** Optional convenience so a run visibly
  ends at "publish?" like the legacy skill's final gate. Deferred — the standalone invocation is
  sufficient and keeps bureau decoupled from prod writes.

## 8. Acceptance

Pointed at the Circle-K pilot run tree (once copied locally per the test plan), `upload-sir`:
1. detects `sir-pipeline` layout;
2. resolves and reads `seed-site-data.md` + `location-resolution.md` from their `output/1.2-*` paths;
3. enumerates the report PDF/DOCX + every `deliverable/supporting-documents/*`;
4. runs the identical org/project/SIR interactive flow and, on the all-up confirm, publishes to prod
   with the same rows/bucket/paths a legacy run would produce — and writes `sir-publishing-record.json`
   at the pipeline run root, so a re-publish version-bumps.

No pipeline re-run is needed to test this — the port reads a finished tree.
