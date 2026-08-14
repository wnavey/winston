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
| 1 | Pre-processing v2 — 3-tab arch diagram (today / why-changing / v2 proposal). This rev: added the kickoff **sequence diagram** (cityhall→substation→Inngest→Storage/Postgres swimlanes), a prereqs list, and a per-step entity-modification table. Also added seq-diagram + data-table + prompt components to spec-kit (v4, local). | `workspaces/pre-processing-v2/current-architecture-diagram.html` | 2026-08-14 | 2026-08-14 |
| 2 | `geo` table iteration — `geom_local`/`srid_local` nullable, WGS84 the datum, geodesic area, upload-sir writes parcel geo | `workspaces/diligence/sir-geometry/geom-local/GEOM_LOCAL_ITERATION_SPEC.md` | 2026-08-12 | 2026-08-12 |
| 3 | Ingesting supporting-doc geometry — recorded plats → PostGIS `geo` table | `workspaces/diligence/sir-geometry/ingesting-supporting-docs-3089/SPEC.md` | 2026-08-07 | 2026-08-11 (#219) |
| 4 | SIR chat on the shareable (logged-out) link | `workspaces/diligence/sir-chat-shared/DESIGN-SPEC.md` | 2026-08-10 | 2026-08-10 (#220) |
| 5 | SIR geometry MVP experiment — PostGIS `geo` table + flag-gated parcel map | `workspaces/diligence/sir-geometry/MVP-EXPERIMENT.md` | 2026-08-07 | 2026-08-07 (#218) |
| 6 | SIR geo-spatial-reasoning findings report | `workspaces/diligence/sir-geo-spatial-reasoning-findings/README.md` | 2026-08-05 | 2026-08-07 (#211) |
| 7 | SIR Chat v2 — move DOCX extraction into the upload-sir publish path | `workspaces/diligence/sir-chat/DESIGN-SPEC.md` | 2026-08-06 | 2026-08-07 (#216) |
| 8 | SIR Chat — ask-questions AI chat on the Site Intelligence Report page | `workspaces/diligence/sir-chat/DESIGN-SPEC.md` | 2026-08-06 | 2026-08-06 (#215) |
| 9 | Shareable Site Intelligence Reports — time-bound no-login URL | `workspaces/diligence/sir-shareable-report/DESIGN-SPEC.md` | 2026-08-05 | 2026-08-05 (#212) |
| 10 | SIR artifact versions must be complete snapshots, not deltas | `workspaces/diligence/sir-artifact-version-snapshots/DESIGN-SPEC.md` | 2026-08-04 | 2026-08-04 (#210) |
| 11 | SIR pipeline compose-inputs — §5.0 input-contract card | `workspaces/diligence/sir-pipelines/architecture-overview.html` | 2026-08-05 | 2026-08-04 (#208) |
| 12 | Bug: upload-sir never prompts to version an existing same-site SIR | `workspaces/diligence/sir-pipelines/bugs/UPLOAD-SIR-EXISTING-PROJECT-NO-VERSION-PROMPT.md` | 2026-08-04 | 2026-08-04 (#209) |
| 13 | SIR pipeline step detail | `workspaces/diligence/sir-pipelines/architecture-overview.html` | 2026-08-05 | 2026-08-04 (#207) |
| 14 | upload-sir port v2 | `workspaces/diligence/sir-pipelines/upload-sir-port-spec.md` | 2026-08-01 | 2026-08-01 (#206) |
| 15 | SIR pipelines architecture | `workspaces/diligence/sir-pipelines/architecture-overview.html` | 2026-08-05 | 2026-08-01 (#204) |
