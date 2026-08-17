# Winston Scratch-Pad

Running index of Will's most recent **15** specs / winston work — newest at the top.
This is the fast lookup so you don't have to hunt for full paths. When a new spec is
created (or an existing one materially revised), it goes to **row 1** and everything
below bumps down; the 16th-oldest row drops off.

**Columns:** `#` (1 = most recent) · what it was · path to the spec that was
added/modified · the date stamped on that spec · when it was engaged / merged to main.

> Maintenance: this file is kept current by the `winston-spec` skill. Whenever you add
> or revise a winston spec, prepend a row here and trim the list back to 15. Paths are
> relative to the winston repo root.

| # | What | Spec file | Spec updated | Engaged / merged |
|---|------|-----------|--------------|------------------|
| 1 | New feature spec: pre-processing **clarifying questions** — HITL prompts when upload/triage hits an ambiguous call (plan-set-vs-doc, which zip PDF is the plan set, 2nd plan set on a version). Two contexts: sync `commit-upload` = structured `needs_decision` 409 + modal (MVP, no infra); async `processZip` = `preprocessing_question` table + Inngest `waitForEvent` pause/resume. Every question has a safe default+timeout. Spun out of the plan-set-storage-pathing bugfix's auto-replace collision. | `workspaces/pre-processing-v2/new-features/clarifying-questions/DESIGN-SPEC.md` | 2026-08-17 | 2026-08-17 |
| 2 | Bug/spec **v2**: canonicalize plan-set storage pathing → `{project_id}/plan-set/v{submission_version_number}/…` (drop `plan_set_id`, 1:1 verified 22/22 prod). v2 folds session decisions: `storage.move` at commit + `/replace`; zip triage rewritten as **two-pass elect-one-winner** (short-side>11″ → most pages → largest file); **DB constraint dropped**, collision policy = **auto-replace**; classification internals documented (page-1 short-side>11″). cityhall/conductor scheme-agnostic (no change). | `workspaces/pre-processing-v2/bugs/plan-set-storage-pathing/BUGFIX-SPEC.md` | 2026-08-17 | 2026-08-17 |
| 3 | Pre-processing v2 DESIGN SPEC (Draft v2 — grilled, Q1–Q22+O1 folded): Phase 1 = global `pre-processing-v2` Edge Config flag stamped into the process-file event → mechanical-only path (skips all Gemini reading, keeps zip triage, propagates to zip children + drainage fn) + **O1 failure logging to BetterStack** (pipeline is currently error-blind) + fast-follow page-count check; cityhall verified to degrade gracefully. Phases 2-4 = runbook + publisher + gate + cutover. | `workspaces/pre-processing-v2/DESIGN-SPEC.md` | 2026-08-17 | 2026-08-17 |
| 4 | Pre-processing v2 — current-architecture HTML diagram (3 tabs + kickoff sequence diagram, prereqs, entity table, sheet-identity model). | `workspaces/pre-processing-v2/current-architecture-diagram.html` | 2026-08-14 | 2026-08-14 |
| 5 | `geo` table iteration — `geom_local`/`srid_local` nullable, WGS84 the datum, geodesic area, upload-sir writes parcel geo | `workspaces/diligence/sir-geometry/geom-local/GEOM_LOCAL_ITERATION_SPEC.md` | 2026-08-12 | 2026-08-12 |
| 6 | Ingesting supporting-doc geometry — recorded plats → PostGIS `geo` table | `workspaces/diligence/sir-geometry/ingesting-supporting-docs-3089/SPEC.md` | 2026-08-07 | 2026-08-11 (#219) |
| 7 | SIR chat on the shareable (logged-out) link | `workspaces/diligence/sir-chat-shared/DESIGN-SPEC.md` | 2026-08-10 | 2026-08-10 (#220) |
| 8 | SIR geometry MVP experiment — PostGIS `geo` table + flag-gated parcel map | `workspaces/diligence/sir-geometry/MVP-EXPERIMENT.md` | 2026-08-07 | 2026-08-07 (#218) |
| 9 | SIR geo-spatial-reasoning findings report | `workspaces/diligence/sir-geo-spatial-reasoning-findings/README.md` | 2026-08-05 | 2026-08-07 (#211) |
| 10 | SIR Chat v2 — move DOCX extraction into the upload-sir publish path | `workspaces/diligence/sir-chat/DESIGN-SPEC.md` | 2026-08-06 | 2026-08-07 (#216) |
| 11 | SIR Chat — ask-questions AI chat on the Site Intelligence Report page | `workspaces/diligence/sir-chat/DESIGN-SPEC.md` | 2026-08-06 | 2026-08-06 (#215) |
| 12 | Shareable Site Intelligence Reports — time-bound no-login URL | `workspaces/diligence/sir-shareable-report/DESIGN-SPEC.md` | 2026-08-05 | 2026-08-05 (#212) |
| 13 | SIR artifact versions must be complete snapshots, not deltas | `workspaces/diligence/sir-artifact-version-snapshots/DESIGN-SPEC.md` | 2026-08-04 | 2026-08-04 (#210) |
| 14 | SIR pipeline compose-inputs — §5.0 input-contract card | `workspaces/diligence/sir-pipelines/architecture-overview.html` | 2026-08-05 | 2026-08-04 (#208) |
| 15 | Bug: upload-sir never prompts to version an existing same-site SIR | `workspaces/diligence/sir-pipelines/bugs/UPLOAD-SIR-EXISTING-PROJECT-NO-VERSION-PROMPT.md` | 2026-08-04 | 2026-08-04 (#209) |
