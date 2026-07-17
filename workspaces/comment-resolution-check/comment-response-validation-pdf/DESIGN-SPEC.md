# Comment Response Validation PDF ("Comment Response Review")

**Status:** Draft v1
**Date:** 2026-07-17
**Repos touched:** `claude-plugins` (new skill `parse-crc-comment-response-pdf`), `substation` (comparison data assembly + PDF route + RDS template), `cityhall` (download button + proxy route)
**Repos NOT touched:** `dsd` (no new RDS components for MVP), `bureau` (CRC workflow unchanged), `conductor`, `navalbase`

## Problem

The comment-resolution-check (CRC) workflow verifies a resubmitted plan set (U1) against the previous cycle's Master Comment Report (U0 MCR) and emits a per-atomic-item verdict of `resolved | failed | not-applicable` (plus `uncertain` after multi-run consolidation — `bureau/workflows/comment-resolution-check/scripts/consolidate-logic.ts`). Verdicts land as `review_comments` rows with CRC traceability in `output_json.crc` (`atomicItemId`, `parentCommentId`, `severity`, `requirement` — consumed today by cityhall at `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/+page.ts:773-774`).

Separately, the civil engineering firm submits a **Site Plan Application Comment Response PDF** with U1 — a letter answering each MCR comment, implicitly or explicitly claiming which comments they believe they have resolved. Today nothing parses that letter, and nothing cross-references the submitter's claims against our CRC verdicts.

The high-value intersection is: **comments the submitter believes are resolved that our CRC run marked failed** (and, softer, ones we could not confidently confirm). That subset is exactly what a reviewer — and the civil firm itself — should look at first. We want a civil-firm-facing PDF report that surfaces it, generated on demand from cityhall the same way the Completeness Check PDF is (substation-pdf Vercel app + Report Design System + Chromium; see `workspaces/completeness-check/pdf-report/ui-refactor/DESIGN-SPEC.md` §10.8, which anticipated this reuse).

MVP posture (Decision D1): production-first, tech debt accepted, shipped as three PRs.

## Solution overview

```
                         WORKSTREAM A (claude-plugins skill, HITL)
  Comment Response PDF ──► parse-crc-comment-response-pdf
                              │  vision-first parse @ parent MCR comment level
                              │  LLM believed-status classification per comment
                              │  HITL gate: operator reviews TSV preview
                              ▼
              Supabase storage bucket: crc-comment-responses
              projects/{projectId}/submissions/{submissionId}/{u1Version}/{generation}/
                  comment-responses.json  +  source PDF

                         WORKSTREAM B (substation, deterministic — no agent)
  cityhall "Download Comment Response Review" ──► substation-pdf route
      │                                             │ 1. resolve U1 version via
      │  GET /projects/{p}/reviews/{r}/             │    reviews.submission_version_id
      │      comment-response-validation/pdf        │    → submission_version.version_number
      │                                             │ 2. fetch comment-responses.json (max generation)
      │                                             │ 3. fetch review_comments + comment_triage
      │                                             │ 4. join on normalized parentCommentId,
      │                                             │    roll atomic verdicts up to parent,
      │                                             │    filter believed-resolved × {failed, uncertain}
      │                                             ▼
      │                                    RDS template → renderRdsPdfSerialized (Chromium)
      ▼                                             │
  comment-response-review.pdf ◄─────────────────────┘

                         WORKSTREAM C (cityhall)
  CRC review page: button visible, disabled/greyed until a parsed generation exists
```

The comparison is **deterministic code at render time**, not an agent step and not a stored artifact (D2). Rendering at request time means triage overrides applied in cityhall after the CRC run are always reflected.

## Workstream A — `parse-crc-comment-response-pdf` skill

New sibling skill in `claude-plugins/plugins/noetic-tools/skills/parse-crc-comment-response-pdf/`, following the house layout (`SKILL.md`, `prompts/`, `references/`, `scripts/verify-phase.py` gate). Sibling of `generate-crc-guides` — it does **not** extend it and is fully decoupled from CRC guide generations (D4).

### Inputs

- A local path to **one** Comment Response PDF containing **all** departments' responses (D-A3). Multi-PDF submissions (per-department letters) are explicitly out of scope for MVP.
- Project/submission/version anchoring via the same Supabase-lookup HITL flow as `generate-crc-guides` Phase 0 (`references/supabase-lookup.md` is reusable).

### Anchoring and storage (D3, revised per grill Q43)

The output is keyed by the **U1 submission version — the version the response PDF was submitted with**, which is also the version the CRC review executes against. It is *not* keyed by the responded-to MCR version and *not* coupled to any crc-guides generation number.

```
Bucket: crc-comment-responses  (new)
Path:   projects/{projectId}/submissions/{submissionId}/{u1VersionNumber}/{generation}/
Files:  comment-responses.json
        <source-pdf-filename>.pdf
Local:  $NOETIC_WORKING_DIR/crc-comment-responses/{projectId}/{submissionId}/{u1VersionNumber}/{generation}/
        (plus scratch/ — never uploaded)
```

`{generation}` is a re-parse counter (parse again after a skill fix → generation 1). Consumers always take the max generation (D3).

### Parsing (D4, D6)

- **Parse unit = parent MCR comment** (`AW1`, `TPW6`), because that is what physically exists in the response letter. The skill never attempts to split a response across our atomic decomposition (`AW-1.1`, `AW-1.2`) — that unwinding happens at comparison time in Workstream B.
- **Vision-first** page sweep (pattern: `generate-crc-guides/prompts/extract-comments.md`) with the PDF text layer as an assist. Response letters vary wildly in format (tables, letter prose, inline annotations); text-layer-only parsing is rejected.
- **ID normalization contract:** the parser emits `{PREFIX}{number}` parent IDs (e.g. `AW1`) using `generate-crc-guides/references/dept-prefix-dict.tsv` as the single source of truth for department prefixes. This convention matching `review_comments.output_json.crc.parentCommentId` is **the join contract** between Workstreams A and B (D4). Matching: exact dept-prefix + comment-number first, text-similarity fallback with HITL confirmation for ambiguous rows.
- Entries that don't correspond to anything we ever parsed (comments we ignored as notes during guide generation, cover-letter boilerplate misreads) are **carried, never dropped**, flagged via `matchStatus` (D4).

### Believed-status classification (D5)

One LLM call per parsed comment, structured output: `believedStatus` + `rationale`, alongside the verbatim `responseText`.

Enum: `resolved | pending | contested | deferred | unclear | no-response`

- `resolved` requires the response to claim **complete** resolution. Partial claims ("1a and 1b addressed; 1c next submittal") → `pending` (grill Q46).
- `no-response` (MCR comment absent from the letter) is treated as an implicit acknowledgment of non-resolution — grouped with `pending` for reporting purposes (grill Q9).
- **MVP only acts on `resolved`.** All other statuses are "not worth reporting" — captured in the JSON for later use, ignored by the PDF (D5).
- Model tier: haiku-class default, tunable (grill Q11).

### Output schema — `comment-responses.json` (D6)

```json
{
  "metadata": {
    "projectId": "…",
    "submissionId": "…",
    "submittedWithVersionNumber": 5,
    "respondsToVersionNumber": 4,
    "sourcePdfFilename": "1700 S Lamar - U1 Comment Response.pdf",
    "skillVersion": "1.0",
    "generation": 0,
    "parsedAt": "2026-07-17T…",
    "counts": { "total": 42, "resolved": 30, "pending": 6, "contested": 2, "deferred": 1, "unclear": 1, "no-response": 2 }
  },
  "entries": [
    {
      "commentId": "AW1",
      "dept": "AW",
      "commentNumber": 1,
      "originalCommentText": "…as reprinted in the response letter…",
      "responseText": "…verbatim submitter response…",
      "believedStatus": "resolved",
      "rationale": "Response states detail sheets were revised per UCM 2.5.1(E)(20).",
      "pageNumbers": [3],
      "matchStatus": "parsed"
    }
  ]
}
```

`respondsToVersionNumber` is provenance only — no consumer joins on it (grill Q43 resolution).

### HITL gate (D6)

Single gate, after parse + classification, before upload: operator reviews a TSV preview (commentId → response snippet → inferred status → rationale). On approval, the skill uploads JSON + source PDF to the bucket. No second gate.

## Workstream B — substation: comparison + route + template

All new code in the existing substation-pdf Vercel project (`substation/src/pdf-function.ts` app), mirroring the CC RDS stack:

| Piece | New file | Mirrors |
|---|---|---|
| Route | `src/routes/comment-response-validation-pdf.ts` | `src/routes/completeness-check-pdf-rds.ts` |
| Data assembly + join | `src/pdf/crv-report-data.ts` | `src/pdf/cc-report-data.ts` |
| RDS template | `src/pdf/comment-response-review.tsx` | `src/pdf/completeness-check-report.tsx` |

Route: `GET /projects/{projectId}/reviews/{reviewId}/comment-response-validation/pdf`, same project-access auth check as the CC route, rendered via `renderRdsPdfSerialized` (`src/pdf/rds-chromium.ts`), response filename `comment-response-review.pdf` (D10). No new env vars; cityhall proxies via existing `SUBSTATION_PDF_URL`. No renderer feature flag — there is no legacy renderer to gate.

### Data assembly (`crv-report-data.ts`)

1. **Resolve the U1 version number** (D11, grill Q43): `reviews.id = {reviewId}` → `reviews.submission_version_id` → `submission_version.version_number`. (Columns verified in `substation/src/types/database.types.ts`; `reviews.submission_version_id` is nullable — a CRC review without one is a hard 404-with-message.)
2. **Fetch `comment-responses.json`**: list `crc-comment-responses/projects/{p}/submissions/{s}/{versionNumber}/`, take max generation. Absent → 404 (cityhall button should have been disabled; belt-and-braces).
3. **Fetch CRC verdicts**: `review_comments` rows for the review (status, `enrichedFinalComment`, `output_json.crc.{atomicItemId,parentCommentId,requirement}`, sheet references) + `comment_triage` rows (`verdict_override` — same table/column CC uses, `src/pdf/cc-report-data.ts:158-177`).
4. **Effective status** (D2): `verdict_override ?? status` per comment. (CRC triage writes to the shared `comment_triage` table today — `cityhall .../review/CrcVerdictTriageBar.svelte`; if a given review has no triage rows the fallback is simply the raw status.)
5. **Roll up atomic → parent** (D7): group by normalized `parentCommentId`; parent effective status = max by severity order `failed > uncertain > resolved > not-applicable`. `not-applicable` children are ignored when siblings carry real verdicts. `uncertain` is used as-is — never substituted with `tentativeStatus` (grill Q16).
6. **Join + filter** (D8): join response entries to parents on normalized commentId. Report set = `believedStatus === 'resolved'` ∧ parent-rollup ∈ {`failed`, `uncertain`}, split into two sections. Everything else (agreements, pending/contested/deferred/unclear/no-response, join orphans on either side) is excluded from the PDF — no appendix in MVP.
7. **Coverage guard** (D8): if < 50% of response entries find a CRC parent, refuse to render (HTTP 422 with a clear message) — a mostly-empty join smells like a wrong-version mismatch, and a silently thin report is worse than an error. Threshold is a constant, tunable.

### Report content (D9)

Audience: **the civil firm**. Zero internals — no vote breakdowns, no confidence tiers, no tool traces, no run counts.

- **Cover** (`ReportCover`): "Comment Response Review" / "{site plan name} — Update U{n}".
- **Summary** (`KeyValue`): comments in response letter, claimed resolved, confirmed resolved, flagged, unconfirmed.
- **Section: "These items may not be resolved"** — believed-resolved × rollup-`failed`. Per row: parent MCR comment (original text as reprinted), submitter's verbatim response, then per *failing* atomic item: requirement text, applicant-facing explanation (`enrichedFinalComment ?? explanation`), sheet references. Non-failing siblings are not itemized (grill Q14 — parent flagged, failing children listed).
- **Section: "We could not confirm these items were resolved"** — believed-resolved × rollup-`uncertain`, same row shape, softer framing.
- Empty section → hidden. Both empty → all-clear page ("all items claimed resolved were verified") — a good report for the civil firm, still rendered (D9/grill Q38).
- No figures. Composed entirely from existing RDS partials (`FlowingSection`, `SectionHeading`, `KeyValue`, `ChecklistFinding`/`ChecklistFindingGroup`) + template-local styles; **no dsd package changes** (D10). Barebones is acceptable for MVP.

## Workstream C — cityhall

- **Proxy route**: `.../review/[reviewId]/comment-response-validation/pdf/+server.ts`, forwarding to `SUBSTATION_PDF_URL` — same shape as the CC proxy (`.../completeness-check/pdf/+server.ts`).
- **Button** on the CRC review page, following the CC fetch→blob+spinner pattern (`+page.svelte:509-541` `handleDownloadPdf`). Visibility (D11, grill Q50): shown for completed CRC reviews, **visible but disabled/greyed** until the server load finds ≥1 generation under `crc-comment-responses/projects/{p}/submissions/{s}/{versionNumber}/` (storage list — no DB table, no migration).

## Deploy order (D1)

1. `claude-plugins` PR — skill (no runtime coupling; can land any time).
2. `substation` PR — data assembly + route + template. Deploys **first** of the two web repos.
3. `cityhall` PR — proxy + button. Deploys after substation.

Also required (ops, not code): create the `crc-comment-responses` bucket before the first skill run.

## Decisions (numbered, from grill session 2026-07-17)

- **D1** — One spec, three workstreams, production-first MVP as three PRs (claude-plugins / substation / cityhall); substation before cityhall. Tech debt accepted for speed.
- **D2** — Comparison is deterministic render-time code in substation (no agent, no stored comparison artifact), joining on effective-after-triage status (`comment_triage.verdict_override ?? status`; raw status when no triage rows).
- **D3** — New skill `parse-crc-comment-response-pdf` writes `comment-responses.json` + source PDF to new bucket `crc-comment-responses` at `projects/{p}/submissions/{s}/{u1Version}/{generation}/`; keyed by the **U1 version the response PDF was submitted with** (= version the CRC review runs against); `{generation}` = re-parse counter, consumers take max. Local mirror under `$NOETIC_WORKING_DIR/crc-comment-responses/`, `scratch/` not uploaded.
- **D4** — Parse at parent MCR comment level only; one all-departments PDF per run; fully decoupled from crc-guides generations. Join contract = `{PREFIX}{number}` normalization via shared `dept-prefix-dict.tsv`. Unmatchable entries carried in JSON with `matchStatus`, never dropped.
- **D5** — Believed-status enum `resolved | pending | contested | deferred | unclear | no-response`; MVP acts only on `resolved`; `resolved` requires a complete-resolution claim (partial → `pending`); `no-response` = implicit non-resolution. One LLM classification per comment, haiku-class default.
- **D6** — Phase-0-style Supabase-lookup HITL for anchoring; vision-first parsing with text-layer assist; single HITL TSV gate before upload; per-entry schema as specified above.
- **D7** — Atomic → parent rollup severity order `failed > uncertain > resolved > not-applicable`; n/a children ignored when siblings have real verdicts; `uncertain` used as-is (no `tentativeStatus` substitution).
- **D8** — Report set = believed-`resolved` × parent-rollup-{`failed`, `uncertain`} as two sections; all other cells excluded (no appendix); join orphans excluded from PDF but kept in JSON; <50% join coverage → refuse to render.
- **D9** — Civil-firm audience, zero internals. Title "Comment Response Review — {site plan} — Update U{n}". Cover → summary counts → failed section → uncertain section; rows = parent comment + verbatim response + per-failing-item requirement/applicant-facing explanation/sheet refs. No figures. Empty sections hidden; all-clear page when both empty.
- **D10** — Route `GET /projects/{p}/reviews/{r}/comment-response-validation/pdf` on the existing substation-pdf app; existing `SUBSTATION_PDF_URL`; CC auth check reused; filename `comment-response-review.pdf`; no new dsd/RDS components.
- **D11** — No DB table for parsed responses; gating + lookup via storage list at `projectId + submissionId + version_number (via reviews.submission_version_id → submission_version.version_number) + max generation`. Button visible-but-disabled when absent.

## Open questions

- **Q1** — Classification model tier (haiku vs sonnet) for believed-status: haiku-class assumed sufficient; revisit if the first real letters show nuanced hedging that haiku misclassifies.
- **Q2** — Coverage-guard threshold: 50% is a first guess. Calibrate after the first real response letter is parsed.
- **Q3** — `reviews.submission_version_id` is nullable in the schema. Assumed always populated for CRC reviews; if a legacy CRC review lacks it, the route 404s with a clear message. Verify against prod rows during implementation.

## Deliberately out of scope (and why)

- **Multi-PDF response submissions** (per-department letters) — MVP assumes one consolidated PDF; merge semantics deferred until we see one in the wild.
- **Statuses other than `resolved`** driving report content (contested/deferred sections, "unaddressed failures") — captured in JSON, not rendered; MVP is strictly "they think it's done, we disagree."
- **`crc_comment_responses` DB table / cityhall UI column for believed-status** — bucket JSON is easily promoted to a table later; no UI integration yet (grill Q21).
- **New dsd/RDS components** — avoids a package republish; template-local composition is enough for a barebones MVP.
- **Believed-resolved × uncertain promotion via `tentativeStatus`** — rejected (grill Q16); uncertain is reported as uncertain.
- **Figures/crops in the report** — bloat; sheet references suffice.
