# Porting `upload-sir` to the new SIR pipeline

**Status:** Draft v2
**Date:** 2026-08-01 (v1 2026-08-01; v2 same day)
**Type:** Implementable spec. Two additive changes on top of the publish machinery already fully
specified in `../sir-product-uploading/DESIGN-SPEC.md` (the "SIR Publishing" spec). That spec owns
*everything about the write* — org/project resolution, the `site_intelligence_report` + `sir_artifact`
rows, the `sir-artifacts` bucket, versioning, idempotency, `publish.ts`. **This spec adds exactly two
things:** (1) a **read-side layout resolver** in the skill so it can consume a **new-pipeline run tree**
(`bureau/pipelines/sir/`) as well as the legacy `diligence-report` tree, and (2) a **`5.8 Publish`
checkpoint** in the pipeline that prompts the operator and hands off to that skill. **Neither changes
the skill's write logic or `publish.ts`, and the skill's org/project legwork is preserved intact.**
**Repos touched:** `claude-plugins` (the read-side resolver in `plugins/noetic-tools/skills/upload-sir/SKILL.md`);
`bureau` (add a `5.8 Publish` checkpoint step + prompt to `pipelines/sir/pipeline.yaml`).
**Repos NOT touched:** `substation` (no new migration beyond the one the publishing spec already owns),
`upload-sir/scripts/publish.ts` (unchanged), `cityhall`, `conductor`, `surveyor`.

> **Revision note (v2):** Adopts **Option C** — a prompted, auto-invoked publish gate. **Reverses v1
> D5** (which kept publishing fully manual / standalone-only and explicitly *not* a pipeline step) and
> **resolves v1 Q3** (the deferred "declared 5.8 handoff step?"). A `5.8 Publish` **checkpoint** is now
> part of the port: the runner stops at end of run, the driving session asks "Publish this SIR?", and on
> yes it invokes the unchanged `upload-sir` skill with the run-dir pre-filled — restoring parity with the
> legacy skill's opt-in final gate. The checkpoint only *prompts and hands off*; all matching, prompting,
> and writes stay inside the skill (new D7). This adds `bureau` to Repos touched. The read-side adapter
> (§1–§4, D1–D4/D6) is unchanged from v1.

> **One-line goal:** Point `upload-sir` at a completed pipeline run
> (`~/noetic/working/sir/<customer>/<project>/<ts>/`) and have it publish exactly as it does for a
> legacy `diligence-report` run — via a run-layout resolver that maps ~4 input files to their pipeline
> locations — and end the run at an opt-in **`5.8 Publish` checkpoint** that launches the skill for the
> operator. Nothing downstream of "locate the inputs" changes; the skill's interactive flow is untouched.

---

## 1. Problem

`upload-sir` was written against the **legacy skill's** on-disk layout — its SKILL.md § "Pipeline"
hardcodes `sir/deliverable/…`, `seed-site-data.md`, `location-resolution/location-resolution.md`,
`hitl/intake-transcript.md`, all relative to `$NOETIC_DILIGENCE_DIR`. The **new SIR pipeline writes a
different tree**: the deliverable lands at `<run>/deliverable/` (no `sir/` segment) and the metadata
files live under per-step `output/<step>/…` folders. Pointed at a pipeline run today, the skill's §0
locate step fails ("neither `sir/deliverable/site-intelligence-report.{pdf,docx}` exists → stop").
Separately, the pipeline **ends at 5.7 with no publish prompt at all**, so relative to the legacy skill
(which ends with an opt-in "Publish this SIR?" gate) the new engine is a UX regression on delivery.

**Why the read-side port is simple:** the skill's locate/derive logic is agent-executed prose, and
`publish.ts` already takes **absolute** `sourcePath`s in its plan JSON (SKILL.md § "Plan JSON shape").
So making the skill publish a pipeline run needs no script change, no DB change — only a resolver that
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

## 3. Change A — a run-layout resolver in `upload-sir/SKILL.md`

Insert a detection + resolution step ahead of §0 "Locate the run". Everything after it reads through
the resolved paths instead of the hardcoded legacy ones.

### 3.1 Detect the layout (D2)
Given the run dir (from `$NOETIC_DILIGENCE_DIR` or the `--run-dir` arg, per the skill's existing §0):

- **`sir-pipeline`** iff `output/5.7-package/package-manifest.json` exists **or** (`deliverable/` exists
  at the run root **and** `output/1.1-input-capture/` exists).
- **`legacy-skill`** iff `sir/deliverable/` exists.
- **Neither** → the existing "nothing to publish, stop" error.

Detection is by artifact presence, not a flag — an operator can point the skill at either tree without
declaring which. If somehow both match, prefer `sir-pipeline` (a run tree packaged by 5.7 is the current
engine) and note it.

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
- Org/project interactive resolution, slug logic, collision/rename handling — **the legwork the port
  must preserve; it stays entirely in the skill (see §5, D7).**
- The `site_intelligence_report` + `sir_artifact` row shapes, `created_by` resolution, storage path
  convention (`sir/<sir_id>/v<version>/<file>`), the all-up confirm gate.
- Versioning, `sir-publishing-record.json`, idempotent re-run/heal.
- The `substation` `..._relax_sir_artifact_format_and_uploads.sql` migration — a **prerequisite this
  port inherits**, not a thing it adds. Same fail-fast behavior if unapplied.

## 5. Change B — the `5.8 Publish` checkpoint (invocation model, D5 · REVISED v2 = Option C)

The port adds a final **`5.8 Publish` checkpoint** to `bureau/pipelines/sir/pipeline.yaml` (section 5,
`requires: 5.7`, kind `checkpoint`) — restoring the opt-in publish gate the legacy `diligence-report`
skill already ends with, so the new engine is not a delivery regression.

**What the checkpoint does:**
- The runner **stops** at 5.8 (as it does at 3.2 / 4.4). Control returns to the **driving Claude Code
  session** that is running the pipeline.
- Per the step's prompt, the session asks the operator ONE question — *"Publish this SIR to the app?"*
- **On yes**, the session invokes the **`upload-sir` skill** (Skill tool) with `--run-dir <this run>`.
  The run-dir is already known, so **the operator never types a command or a path.** The skill then runs
  its **entire unchanged interactive flow** — org fuzzy-match → confirm, project match/create → confirm,
  the all-up write confirm, the prod writes, and `sir-publishing-record.json` at the run root.
- **On no / skip**, the run completes unpublished; the packaged deliverable is on disk and can be
  published later via the standalone path (below).
- The session records the outcome with `pipeline_runner.py checkpoint --step 5.8 --decision <published-vN | skipped>`.

**The boundary that keeps engine and product decoupled (D7):** the 5.8 checkpoint contains **no publish
logic, no database access, and no credentials.** It only *prompts and hands off.* **Every org/project
decision and every write happens inside the `upload-sir` skill** (claude-plugins), exactly as today —
so the skill's org-likelihood check, project match, and their operator prompts survive the port
completely. `bureau` never touches prod. This is the same shape the legacy skill already uses — one
skill (`diligence-report`) hands off to another (`upload-sir`); here a checkpoint hands off to the skill.

**Standalone invocation still works** — the skill keeps honoring `$NOETIC_DILIGENCE_DIR` / `--run-dir`.
That is the path for a **re-publish** (a later version bump), e.g. after a `6.1 Revision` produces an
updated deliverable, or if the operator skipped at 5.8 and returns later. **5.8 is the first-publish
entry point; standalone `--run-dir` is the re-entry point.**

## 6. Decisions

- **D1 — Read-side port = a SKILL.md-only edit to `upload-sir`.** No `publish.ts`, no DB, no schema
  change. Works against already-merged pipeline output.
- **D2 — Auto-detect layout by artifact presence** (`output/5.7-package/package-manifest.json` /
  `deliverable/` + `output/1.1-input-capture/` ⇒ pipeline; `sir/deliverable/` ⇒ legacy). No engine flag.
- **D3 — A per-layout path table** feeds the existing derive/enumerate prose; resolved absolute paths
  flow into the plan JSON unchanged.
- **D4 — Enumerate artifacts by globbing the resolved `deliverable/`** for MVP; optionally prefer the
  pipeline's `package-manifest.json` and assert `source_sha256` parity.
- **D5 (REVISED v2) — a `5.8 Publish` checkpoint offers prompted, auto-invoked publishing at end of run
  (Option C).** The runner stops, the driving session asks "Publish?", and on yes invokes the unchanged
  `upload-sir` skill with the run-dir pre-filled. Standalone `--run-dir` invocation remains the
  re-publish path. *(Reverses v1 D5, which kept publishing manual / standalone-only and not a step;
  resolves v1 Q3.)*
- **D6 — All write mechanics, versioning, and the schema prerequisite remain owned by
  `sir-product-uploading`** — this spec adds only the read-side adapter (Change A) and the handoff
  checkpoint (Change B).
- **D7 (new v2) — the `5.8` checkpoint is prompt-and-handoff ONLY.** No DB access, credentials, or
  publish logic in `bureau`; the `upload-sir` skill owns all org/project matching, all prompting, and
  all writes. This is what preserves the skill's legwork through the port and keeps the engine decoupled
  from prod.

## 7. Open questions

- **Q1 — Org-name inference source in the pipeline.** Legacy reads `hitl/intake-transcript.md`. The
  pipeline's nearest equivalent is 1.1 `request.md` / `intake.json` — confirm it actually carries a
  buyer/requester name. If it doesn't, the skill already falls back to *asking* the operator (SKILL.md
  §2), so this is a nicety, not a blocker. Recommend: read `intake.json` if a requester field exists,
  else `request.md`, else ask.
- **Q2 — Consume `package-manifest.json` now or later?** It's the authoritative artifact list and
  enables the same-source assertion. Recommend shipping the glob-based MVP first (proves the port), then
  the manifest read as a fast follow.

*(v1 Q3 — "a declared 5.8 handoff step?" — is now RESOLVED as Change B / D5 above.)*

## 8. Acceptance

Pointed at the Circle-K pilot run tree (once copied locally per the test plan), `upload-sir`:
1. detects `sir-pipeline` layout;
2. resolves and reads `seed-site-data.md` + `location-resolution.md` from their `output/1.2-*` paths;
3. enumerates the report PDF/DOCX + every `deliverable/supporting-documents/*`;
4. runs the identical org/project/SIR interactive flow and, on the all-up confirm, publishes to prod
   with the same rows/bucket/paths a legacy run would produce — and writes `sir-publishing-record.json`
   at the pipeline run root, so a re-publish version-bumps.

For **Change B**, on a live pipeline run:
5. the run stops at the `5.8 Publish` checkpoint; the driving session prompts *"Publish this SIR?"*; on
   **yes** it invokes the skill (run-dir pre-filled) and steps 1–4 above execute with no command typed;
   on **no** the run completes unpublished and the standalone `--run-dir` path still publishes later.

The read-side port (Change A) needs no pipeline re-run to test — it reads a finished tree. Change B is
exercised on the next live run (or by driving the `5.8` step against the pilot tree).
