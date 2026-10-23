# Winston spec index

Every spec, bug writeup and note in this repo has an ID: `FEAT-N` (feature spec),
`ARCH-N` (architecture spec), `BUG-N` (bug writeup), `NOTE-N` (note). Say the ID to a
session — "look at FEAT-4" — and it resolves here. Allocate with `tools/spec-id.py add`,
never by hand; numbers are per prefix and never reused. Rows sorted by prefix then number.

| ID | Kind | Status | Title | Path | Created |
|---|---|---|---|---|---|
| FEAT-1 | feature | draft | `generate-crc-guides` — Design Spec | `workspaces/comment-resolution-check/generate-crc-guides/DESIGN-SPEC.md` | 2026-06-18 |
| FEAT-2 | feature | draft | `comment-resolution-check` Conductor Workflow — Design Spec | `workspaces/comment-resolution-check/crc-workflow/DESIGN-SPEC.md` | 2026-06-19 |
| FEAT-3 | feature | draft | Cityhall CRC UI — Design Spec | `workspaces/comment-resolution-check/cityhall-ui/DESIGN-SPEC.md` | 2026-06-22 |
| FEAT-4 | feature | draft | `generate-crc-guides-from-redlines` — Design Spec | `workspaces/comment-resolution-check/generate-crc-guides-from-redlines/DESIGN-SPEC.md` | 2026-06-22 |
| FEAT-5 | feature | draft | CRC Majority Vote (medly) — Design Spec | `workspaces/comment-resolution-check/crc-workflow/majority-vote/DESIGN-SPEC.md` | 2026-06-23 |
| FEAT-6 | feature | draft | CRC `uncertain` Manual Override — Design Spec | `workspaces/comment-resolution-check/crc-workflow/uncertain-status-manual-override/DESIGN-SPEC.md` | 2026-06-25 |
| FEAT-7 | feature | draft | CRC `uncertain` Status — Design Spec | `workspaces/comment-resolution-check/crc-workflow/uncertain-status/DESIGN-SPEC.md` | 2026-06-25 |
| FEAT-8 | feature | draft | `transcribe-mcr-text` — Design Spec | `workspaces/comment-resolution-check/transcribe-mcr-text/DESIGN-SPEC.md` | 2026-06-25 |
| FEAT-9 | feature | draft | Tool Architecture Redesign — Standard Contract + Decoupling from Conductor | `workspaces/vision-tool-orchestration/redesign-proposal/DESIGN-SPEC.md` | 2026-06-26 |
| FEAT-10 | feature | draft | `view-mcr-pdf` — Design Spec | `workspaces/comment-resolution-check/view-mcr-pdf/DESIGN-SPEC.md` | 2026-06-27 |
| FEAT-11 | feature | draft | CRC Comment Triage Rework — Design Spec | `workspaces/comment-resolution-check/crc-workflow/comment-triage-rework/DESIGN-SPEC.md` | 2026-06-29 |
| FEAT-12 | feature | draft | `view-redlines-comment-ref` — Design Spec | `workspaces/comment-resolution-check/view-redlines-comment-ref/DESIGN-SPEC.md` | 2026-06-29 |
| FEAT-13 | feature | draft | CRC `enrichedFinalComment` — Design Spec | `workspaces/comment-resolution-check/crc-workflow/enriched-final-comment/DESIGN-SPEC.md` | 2026-06-30 |
| FEAT-14 | feature | draft | `expose-crc-pdf-metadata` — Design Spec | `workspaces/comment-resolution-check/expose-crc-pdf-metadata/DESIGN-SPEC.md` | 2026-07-01 |
| FEAT-15 | feature | draft | Populate MCR Page Numbers (source-map parent bboxes) — Design Spec | `workspaces/comment-resolution-check/generate-crc-guides/populate-mcr-page-numbers/DESIGN-SPEC.md` | 2026-07-01 |
| FEAT-16 | feature | shipped | Design Spec: First-Class `warn` Status via the Fail Status Column | `workspaces/completeness-check/fail-status/DESIGN-SPEC.md` | 2026-07-02 |
| FEAT-17 | feature | draft | Completeness Check — Structured-Output Retry-Storm Bugfix | `workspaces/completeness-check/structured-output-retry-storm-bugfix/DESIGN-SPEC.md` | 2026-07-02 |
| FEAT-18 | feature | draft | Completeness Check `uncertainExplanation` — Design Spec | `workspaces/completeness-check/uncertain-explanation/DESIGN-SPEC.md` | 2026-07-06 |
| FEAT-19 | feature | draft | Completeness Check `uncertain` Status — Report Rendering — Design Spec | `workspaces/completeness-check/uncertain-status-reports/DESIGN-SPEC.md` | 2026-07-06 |
| FEAT-20 | feature | draft | Completeness Check `uncertain` Status — Design Spec | `workspaces/completeness-check/uncertain-status/DESIGN-SPEC.md` | 2026-07-06 |
| FEAT-21 | feature | draft | CC Verdict Override Refactor — Design Spec | `workspaces/completeness-check/verdict-override-refactor/DESIGN-SPEC.md` | 2026-07-07 |
| FEAT-22 | feature | shipped | Design Spec: Migrating the CC "Download Report" PDF to the RDS Renderer | `workspaces/completeness-check/pdf-report/ui-refactor/DESIGN-SPEC.md` | 2026-07-08 |
| FEAT-23 | feature | draft | Ground Truth Evals Revamp for CC and CRC | `workspaces/inspector-general/ground-truth-revamp-for-cc-and-crc/DESIGN-SPEC.md` | 2026-07-08 |
| FEAT-24 | feature | draft | Comment Observability & Debugging Page for CC and CRC in Inspector General | `workspaces/inspector-general/comment-observability-debugging/DESIGN-SPEC.md` | 2026-07-10 |
| FEAT-25 | feature | draft | generate-crc-guides Phase 6 v2 — Census-First Figure Extraction (Implementation Spec) | `workspaces/comment-resolution-check/generate-crc-guides/figure-extraction-v2/DESIGN-SPEC.md` | 2026-07-11 |
| FEAT-26 | feature | draft | Conductor Local-Run Fallback for Sec Wave 9 Scoped Run Tokens | `workspaces/conductor/local-run-scoped-token-fallback/DESIGN-SPEC.md` | 2026-07-13 |
| FEAT-27 | feature | draft | Comment Response Validation PDF ("Comment Response Review") | `workspaces/comment-resolution-check/comment-response-validation-pdf/DESIGN-SPEC.md` | 2026-07-17 |
| FEAT-28 | feature | draft | Jurisdiction Resolution Correction + City Submission Labeling | `workspaces/comment-resolution-check/jurisdiction-correction-and-submission-labeling/DESIGN-SPEC.md` | 2026-07-20 |
| FEAT-29 | feature | draft | ReportContentsFlowing — a multi-page table of contents for RDS Report mode | `workspaces/comment-resolution-check/report-contents-multipage/DESIGN-SPEC.md` | 2026-07-21 |
| FEAT-30 | feature | draft | CRC UI — Filter by Parsed Comment-Response Believed Status | `workspaces/comment-resolution-check/crc-ui-believed-status-filter/DESIGN-SPEC.md` | 2026-07-24 |
| FEAT-31 | feature | draft | Conductor Agent-Saturation Hang + Cloud-Run Observability | `workspaces/conductor/agent-saturation-hang-and-run-observability/DESIGN-SPEC.md` | 2026-07-27 |
| FEAT-32 | feature | draft | Hard Cap on `maxWorkers` for Completeness-Check and Comment-Resolution-Check | `workspaces/conductor/maxworkers-hard-cap/DESIGN-SPEC.md` | 2026-07-27 |
| FEAT-33 | feature | draft | Reviews Derive Jurisdiction + Bulk Registry Population | `workspaces/architecture/jurisdiction-conventions/reviews-derivation-and-bulk-registry/DESIGN-SPEC.md` | 2026-07-30 |
| FEAT-34 | feature | draft | SIR Publishing — `upload-sir` skill + `diligence-report` integration | `workspaces/diligence/sir-product-uploading/DESIGN-SPEC.md` | 2026-07-31 |
| FEAT-35 | feature | draft | SIR Viewing — dashboard SIR widget + file detail view (cityhall) | `workspaces/diligence/sir-product-viewing/DESIGN-SPEC.md` | 2026-07-31 |
| FEAT-36 | feature | draft | SIR artifact versions must be complete snapshots, not deltas | `workspaces/diligence/sir-artifact-version-snapshots/DESIGN-SPEC.md` | 2026-08-04 |
| FEAT-37 | feature | draft | Shareable Site Intelligence Reports — time-bound, no-login public view (cityhall + substation) | `workspaces/diligence/sir-shareable-report/DESIGN-SPEC.md` | 2026-08-05 |
| FEAT-38 | feature | draft | SIR Chat — Ask-Questions AI Chat on the Site Intelligence Report Page | `workspaces/diligence/sir-chat/DESIGN-SPEC.md` | 2026-08-06 |
| FEAT-39 | feature | draft | SIR Chat on the Shareable (Logged-Out) Link | `workspaces/diligence/sir-chat-shared/DESIGN-SPEC.md` | 2026-08-10 |
| FEAT-40 | feature | shipped | Pre-Processing v2 — Flag-Gated Mechanical Strip (Phase 1) + Full Plan | `workspaces/pre-processing-v2/DESIGN-SPEC.md` | 2026-08-14 |
| FEAT-41 | feature | draft | Pre-Processing Clarifying Questions — HITL Prompts During File Upload / Triage | `workspaces/pre-processing-v2/new-features/clarifying-questions/DESIGN-SPEC.md` | 2026-08-17 |
| FEAT-42 | feature | draft | File-Upload Jobs — Streamed Loading UX + HITL "Version / Replace / Separate / Discard" Questions | `workspaces/pre-processing-v2/file-upload-zip-loading-and-hitl-questions/DESIGN-SPEC.md` | 2026-08-24 |
| FEAT-43 | feature | draft | City Response Documents | `workspaces/city-response-docs/DESIGN-SPEC.md` | 2026-09-03 |
| FEAT-44 | feature | draft | Process City Response Documents — Runbook | `workspaces/city-response-docs/preprocessing/DESIGN-SPEC.md` | 2026-09-04 |
| FEAT-45 | feature | draft | Runbook Checkpoints + HITL Questions + cityhall UI | `workspaces/runbook-checkpoints/DESIGN-SPEC.md` | 2026-09-08 |
| FEAT-46 | feature | draft | `conductor init` — one local run-initialization verb | `workspaces/runbook-checkpoints/conductor-init/DESIGN-SPEC.md` | 2026-09-10 |
| FEAT-47 | feature | draft | Sandbox API tokens — a per-run bearer for a subset of substation routes | `workspaces/runbook-checkpoints/sandbox-api-tokens/DESIGN-SPEC.md` | 2026-09-11 |
| FEAT-48 | feature | draft | Cartographer — geometry extraction runbook (`extract-geometry`) | `workspaces/cartographer/geometry-extraction/DESIGN-SPEC.md` | 2026-09-18 |
| FEAT-49 | feature | draft | Agentic HITL — the agent's inputs and outputs at a runbook gate | `workspaces/runbook-checkpoints/agentic-hitl/DESIGN-SPEC.md` | 2026-09-18 |
| FEAT-50 | feature | draft | Cartographer — placing extracted figures relative to each other (`extract-geometry` placement phase) | `workspaces/cartographer/geometry-placement/DESIGN-SPEC.md` | 2026-09-21 |
| FEAT-51 | feature | draft | Cloud Captain — an Agent SDK captain inside the Vercel Sandbox | `workspaces/runbook-checkpoints/cloud-captain/DESIGN-SPEC.md` | 2026-09-21 |
| FEAT-52 | feature | shipped | Seat resolution — spending the right person's subscription account on a cloud run | `workspaces/runbook-checkpoints/seat-resolution/DESIGN-SPEC.md` | 2026-09-21 |
| FEAT-53 | feature | draft | Cartographer — evidence and crops for an extracted geometry | `workspaces/cartographer/geometry-extraction/evidence/DESIGN-SPEC.md` | 2026-09-23 |
| FEAT-54 | feature | draft | Report back is a branch of the decision schema — kill the card's hardcoded "Then:" radio | `workspaces/runbook-checkpoints/next-action-in-schema/DESIGN-SPEC.md` | 2026-09-23 |
| FEAT-55 | feature | draft | Cloud Publish: Substation publishes a runbook's approved deliverable | `workspaces/runbook-checkpoints/cloud-publish/DESIGN-SPEC.md` | 2026-09-24 |
| FEAT-56 | feature | draft | Cartographer — anchoring extracted geometries to the county parcel | `workspaces/cartographer/anchoring-geometries/DESIGN-SPEC.md` | 2026-09-25 |
| FEAT-57 | feature | draft | Browser handoff — a hosted browser a person takes over at a HITL gate, and the agent gets back | `workspaces/runbook-checkpoints/browser-handoff/DESIGN-SPEC.md` | 2026-09-25 |
| FEAT-58 | feature | draft | Per-runbook conventions: runbooks choose the parts of AGENTS-core they get, and the run declares its answer-key posture | `workspaces/runbook-checkpoints/per-runbook-conventions/DESIGN-SPEC.md` | 2026-09-28 |
| FEAT-59 | feature | draft | Block names: a drafter-style name on every content block | `workspaces/completeness-check/block-names/DESIGN-SPEC.md` | 2026-09-29 |
| FEAT-60 | feature | shipped | Completeness Check → Runbook v2 (feature-parity port) | `workspaces/completeness-check/runbook-v2-port/DESIGN-SPEC.md` | 2026-10-02 |
| FEAT-61 | feature | draft | CC Verdict / Triage Split and Appeal | `workspaces/completeness-check/verdict-triage-split/DESIGN-SPEC.md` | 2026-10-05 |
| FEAT-62 | feature | accepted | CC checklist source UI: where each completeness-check item came from | `workspaces/completeness-check/checklist-source-ui/DESIGN-SPEC.md` | 2026-10-07 |
| FEAT-63 | feature | accepted | Comment markings for the completeness-check runbook | `workspaces/completeness-check/comment-markings/DESIGN-SPEC.md` | 2026-10-08 |
| FEAT-64 | feature | draft | CC review amend — re-run part of a completeness-check run and update its published review in place | `workspaces/completeness-check/review-amend/DESIGN-SPEC.md` | 2026-10-12 |
| FEAT-65 | feature | accepted | Anchoring without a SIR — a loose PDF from upload to the map | `workspaces/cartographer/sir-free-anchoring/DESIGN-SPEC.md` | 2026-10-14 |
| FEAT-66 | feature | draft | Intake checklist DB schema and the bureau sync | `workspaces/intake/db-schema/DESIGN-SPEC.md` | 2026-10-14 |
| FEAT-67 | feature | draft | Intake checklist pages per jurisdiction: a homepage and a page per source | `workspaces/intake/jurisdiction-pages/DESIGN-SPEC.md` | 2026-10-15 |
| FEAT-68 | feature | draft | Building footprints from plan sets — the first proposed feature through extract-geometry-v2 and anchor-geometry | `workspaces/cartographer/plan-set-footprints/DESIGN-SPEC.md` | 2026-10-16 |
| FEAT-69 | feature | draft | Reference images for intake checklist items | `workspaces/intake/checklist-figures/DESIGN-SPEC.md` | 2026-10-16 |
| FEAT-70 | feature | draft | Checklist figures, iteration 2: the guide says how a figure is used | `workspaces/intake/checklist-figures/iteration-2/DESIGN-SPEC.md` | 2026-10-19 |
| FEAT-71 | feature | shipped | Driveways and curbs from plan sets — existing and proposed, with widths, lengths and return radii, and the adjacent driveways the sheet leaves off | `workspaces/cartographer/plan-set-driveways-curbs/DESIGN-SPEC.md` | 2026-10-20 |
| FEAT-72 | feature | draft | Intake tiers and the site-plan golden set (exploratory handoff) | `workspaces/intake/tiers-golden-set/DESIGN-SPEC.md` | 2026-10-21 |
| FEAT-73 | feature | draft | Intake summary on the jurisdiction page | `workspaces/intake/jurisdiction-summary/DESIGN-SPEC.md` | 2026-10-22 |
| FEAT-74 | feature | accepted | Frontage by outward search — which street each lot side faces, its right-of-way, and the street's curbs | `workspaces/cartographer/frontage-outward-search/DESIGN-SPEC.md` | 2026-10-23 |
| ARCH-1 | architecture | living | Jurisdiction Conventions — Source of Truth | `workspaces/architecture/jurisdiction-conventions/DESIGN-SPEC.md` | 2026-07-22 |
| ARCH-2 | architecture | living | SIR Product Experience — North Star & Roadmap | `workspaces/diligence/sir-product-experience/DESIGN-SPEC.md` | 2026-07-27 |
| ARCH-3 | architecture | living | RDS PDF Render Pipeline — How Noetic Generates Branded PDFs (and How to Replicate It) | `workspaces/report-design-system/pdf-render-pipeline/DESIGN-SPEC.md` | 2026-07-28 |
| ARCH-4 | architecture | living | Completeness-check vision: how it works today, and reference images | `workspaces/completeness-check/vision-reference-images/DESIGN-SPEC.md` | 2026-10-14 |
| ARCH-5 | architecture | living | The intake-prospecting runbook | `workspaces/intake/prospecting-runbook/DESIGN-SPEC.md` | 2026-10-14 |
| ARCH-6 | architecture | draft | Intake north star: a checklist for every jurisdiction | `workspaces/intake/north-star/NORTH-STAR-SPEC.md` | 2026-10-23 |
| ARCH-7 | architecture | draft | Completeness Check Code Hygiene: how a CC review is produced and shown, and where to clean it up | `workspaces/completeness-check/code-hygiene/DESIGN-SPEC.md` | 2026-10-23 |
| BUG-1 | bug | fixed | Structured-Output Retry Storm in CRC `review` Step | `workspaces/comment-resolution-check/crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md` | 2026-06-20 |
| BUG-2 | bug | open | `generate-crc-guides` — Instability Fix Design Spec | `workspaces/comment-resolution-check/generate-crc-guides/bugs/INSTABILITY-FIX-DESIGN-SPEC.md` | 2026-06-26 |
| BUG-3 | bug | open | `generate-crc-guides` — Instability Problems and Fix Proposal | `workspaces/comment-resolution-check/generate-crc-guides/bugs/INSTABILITY-PROBLEMS-AND-FIX-PROPOSAL-SPEC.md` | 2026-06-26 |
| BUG-4 | bug | fixed | Completeness Check — stop_reason=tool_use Guard Bug (2026-07-06 outage) | `workspaces/completeness-check/bugs/STOP-REASON-BUG-SUMMARY.md` | 2026-07-07 |
| BUG-5 | bug | open | Latent box↔text mispairing in `content_block` (wrong evidence-chip highlights) | `workspaces/comment-resolution-check/evidence-chips-with-block-short-ids/bugs/LATENT-BOX-ID-BUG.md` | 2026-07-09 |
| BUG-6 | bug | open | Oversized CRC guides are one root cause behind four symptoms: the wall-clock tail, both retry storms, both context compactions, and the chronic-variance cluster | `workspaces/comment-resolution-check/bugs/OVERSIZED-GUIDES-TAIL-STORMS-COMPACTION-VARIANCE.md` | 2026-07-16 |
| BUG-7 | bug | open | Semantic-search hybrid mode silently dead on cloud runs: `workflow_run` role lacks USAGE on schema `extensions` | `workspaces/comment-resolution-check/bugs/SEMANTIC-SEARCH-HYBRID-PERMISSION-OUTAGE.md` | 2026-07-16 |
| BUG-8 | bug | open | Structured-output retry storm, variant 2: the model writes unescaped inch-mark quotes (`24"+`) inside JSON strings — large findings emits arrive unparseable and the repair path is blind to them | `workspaces/comment-resolution-check/bugs/STRUCT-OUTPUT-UNPARSED-EMIT-VARIANT.md` | 2026-07-16 |
| BUG-9 | bug | open | Tool attribution is agent-supplied and unvalidated: phantom parent checklist IDs in vision tags, and `tools_used` self-reports that diverge from sidecar ground truth | `workspaces/comment-resolution-check/bugs/TOOL-ATTRIBUTION-PHANTOM-IDS-SELF-REPORT.md` | 2026-07-16 |
| BUG-10 | bug | open | crc-vision-check: a supporting-document UUID passed WITH `sheetNum` is routed down the plan-set lookup and always crashes — the agent is told only "File could not be loaded." | `workspaces/comment-resolution-check/bugs/VISION-SUPPORTING-DOC-SHEETNUM-ROUTING.md` | 2026-07-16 |
| BUG-11 | bug | fixed | `el` feasibility-guide slug holds Environmental content, not Electrical — every SIR `el` discipline runs without its lens | `workspaces/diligence/sir-pipelines/bugs/LOUISVILLE-EL-FEASIBILITY-GUIDE-DISCIPLINE-SWAP.md` | 2026-08-04 |
| BUG-12 | bug | open | `upload-sir` never offers to version an existing SIR — the existing-project branch silently attaches a parallel v0 when the project already holds a near-identical report | `workspaces/diligence/sir-pipelines/bugs/UPLOAD-SIR-EXISTING-PROJECT-NO-VERSION-PROMPT.md` | 2026-08-04 |
| BUG-13 | bug | open | SIR rollup (5.6) requires the downstream Publish gate (5.8) to be `confirmed` — a circular dependency that fails every run's rollup | `workspaces/diligence/sir-pipelines/bugs/ROLLUP-REQUIRES-DOWNSTREAM-PUBLISH-GATE.md` | 2026-08-05 |
| BUG-14 | bug | fixed | Plan-Set Storage Pathing — Canonicalize the `source_storage_path` Scheme | `workspaces/pre-processing-v2/bugs/plan-set-storage-pathing/BUGFIX-SPEC.md` | 2026-08-17 |
| BUG-15 | bug | open | Pre-Processing V2 runbook never publishes the AI sheet label to `sheet.label` — app sheet headings stay stuck on the "Sheet N" seed | `workspaces/pre-processing-v2/bugs/sheet-label-gap/BUGFIX-SPEC.md` | 2026-08-19 |
| BUG-16 | bug | open | `await-answer` crashes with `KeyError: 'choice'` on any gate answered in the cityhall UI | `workspaces/runbook-checkpoints/bugs/AWAIT-ANSWER-UI-DECISION-KEYERROR.md` | 2026-09-11 |
| BUG-17 | bug | fixed | CRC vision tool goes nearly unused after a claude-agent-sdk upgrade — tools get deferred behind "tool search" and the review agent never calls them | `workspaces/comment-resolution-check/crc-workflow/bugs/SDK-VISION-TOOL-DEFERRAL-REGRESSION.md` | 2026-09-17 |
| BUG-18 | bug | fixed | A city-written document filed as an applicant document: AGENTS-core rule 19 bars it, preprocessing reads it anyway (sometimes), and the reading layer already holds it | `workspaces/runbook-checkpoints/bugs/AGENT-RULE-19-BUG.md` | 2026-09-28 |
| BUG-19 | bug | draft | CC never checks that the owner matches across application, tax certificate and cover sheet: CC-1-07 was trimmed, and its cross-reference was left behind | `workspaces/completeness-check/bugs/OWNER-MATCH-ITEM-TRIMMED-BUG.md` | 2026-10-23 |
| NOTE-1 | note | - | Lamar + Collier v5 Game Day — Submission Versioning Walkthrough + CRC Run Plan | `workspaces/comment-resolution-check/lamar-collier-v5-game-day/DESIGN-SPEC.md` | 2026-07-09 |
| NOTE-2 | note | - | Figure Extraction Audit — generate-crc-guides gen 6 (Lamar + Collier v4) + Robustness Redesign | `workspaces/comment-resolution-check/generate-crc-guides/figure-extraction-audit/DESIGN-SPEC.md` | 2026-07-10 |
| NOTE-3 | note | - | West Sacramento Walmart SIR — Paid Document Pulls | `workspaces/diligence/west-sacramento-walmart-paid-pulls/DESIGN-SPEC.md` | 2026-07-25 |
| NOTE-4 | note | - | Reconciling the two Runbook Control Plane workstreams | `workspaces/runbook-checkpoints/reconcile-workstreams/DESIGN-SPEC.md` | 2026-09-09 |
