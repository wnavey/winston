# `comment-resolution-check` Conductor Workflow — Design Spec

> **Status:** Draft, 2026-06-19; §6 revised 2026-06-22 to drop
> `review_sections` writes, set `output_schema = '2026-06-crc'`, and embed
> sections inside `reviews.output_json.sections` (precondition for the
> cityhall UI — see cityhall-ui DESIGN-SPEC §6.3 + §10.2). Smoke-test target
> corrected to 1700 South Lamar in the same pass. Iteration-1 of the
> [CRC spec](../SPEC.md) §4-B. Drives implementation of the second of three
> CRC components: the Conductor workflow that takes a U1 plan set + a
> generated crc-guides set and produces per-comment resolution verdicts in
> `reviews` / `review_comments`.

---

## 1. Overview

**Purpose.** A Conductor workflow that, for every gradeable atomic item in a
generated crc-guides set, verifies whether the updated (U1) site plan resolves
that requirement. Output is one DB row per atomic item with a `resolved` /
`failed` / `not-applicable` verdict, suitable for downstream consumption by
City Hall UI (iteration-3) and the `generate-crc-report` skill (iteration-1).

**Position in the CRC pipeline.**
```
generate-crc-guides skill (Phase 1)  →  comment-resolution-check workflow  →  generate-crc-report skill
[ HITL Claude Code skill ]              [ THIS DOC — Conductor YAML ]        [ Local PDF render ]
   MCR PDF → crc-*.md guides            crc-*.md + U1 plans → DB rows         DB rows → city-ready PDF
```

**Mental model.** Structurally a clone of `completeness-check` with three
narrowings:
1. **2-status core schema** (`resolved` / `failed`, plus `not-applicable` for
   genuinely moot comments) instead of CC's pass/fail/warn/not-applicable.
2. **Single-run only** for MVP. No `runs: N`, no cross-run consolidation.
3. **Guides fetched from Supabase per-run**, not loaded from a bureau-shipped
   checklist directory.

**Workflow name and path.** Shared/jurisdiction-agnostic, per project
convention for non-Austin-specific workflows:

```
bureau/workflows/comment-resolution-check/workflow.yaml
```

CRC itself is jurisdiction-agnostic in shape; the *guides* it consumes carry
the jurisdiction-specific content (Austin codes, Austin dept prefixes). When
Conductor's jurisdiction-fallback runs, it resolves a CRC workflow request to
this shared file.

**Out of scope for this workflow** (lives elsewhere or in later iterations):
- MCR PDF parsing → `generate-crc-guides` skill.
- PDF report rendering → `generate-crc-report` skill.
- AW redlines / AE Bluebeam ingestion → v2 (SPEC §7).
- Multi-run + majority vote → iteration 2 (SPEC §11).
- Accuracy eval against later-cycle MCR ground truth → separate workflow when
  labeled data is in hand (SPEC §10.2).
- Writing `comment_triage` rows → City Hall when humans interact post-run.
- Submission-version anchoring against city cycles → iteration 3, SPEC §9.1.

---

## 2. Inputs

### 2.1 Required

| Input | Type | Description |
|---|---|---|
| `submissionVersionId` | string (uuid) | The **U1 target** submission_version — the plans CRC reviews. Drives `resources.submissionVersion`. |
| `crcGuidesSubmissionVersionId` | string (uuid) | The **U0 baseline** submission_version whose MCR the crc-guides were generated from. Determines the `crc-guides` bucket prefix. **May equal `submissionVersionId`** (smoke-test mode: run U0 guides against U0 plans, expect all-failed). |

### 2.2 Optional

| Input | Type | Default | Description |
|---|---|---|---|
| `crcGenerationNumber` | number | latest in bucket | Specific generation index (0, 1, 2…) under the guides path. Omit to pick the highest integer-named dir under the prefix. |
| `model` | string | `claude-sonnet-4-5-20250929` | Model for the review agent. Sonnet recommended — few items per dept, quality > cost. |
| `effort` | string | (unset) | Agent effort level (low/medium/high) — only applied for 4.6+ models. |
| `maxWorkers` | number | 13 | Maximum concurrent review-agent workers (matches CC default). |
| `departmentCode` | string | `crc` | Department code stamped on review rows for DB storage. Always `crc` for this workflow. |

### 2.3 Explicit non-inputs (intentionally omitted for MVP)

- **`priorReviewId`** — chaining is not an MVP feature; YAGNI. Add when v3
  UI/Substation drives chained re-runs.
- **`runs`** — single-run only. Add in iter-2 with `cross-run-consolidate-crc`.
- **`--use-local-guides` / `localGuidesDir`** — MVP always pulls from
  Supabase. Edit a guide locally → upload to bucket → re-run. No filesystem
  shortcut. Reopen if iteration tempo demands it.
- **`forceOutcomes`** — CC's force-outcome TSV doesn't make sense for CRC's
  per-MCR atomic items.
- **`commentNumberingMap`** — CRC assigns sequential 1..N comment numbers
  internally (see §6.3). No external TSV.

### 2.4 Smoke-test invocation (SPEC §10.1)

For the 1700 South Lamar U0 self-test, both version IDs are the same:
```
submissionVersionId           = <1700 South Lamar U0 submission_version_id>
crcGuidesSubmissionVersionId  = <same id>
crcGenerationNumber           = 0
```
Expected: every gradeable item lands `failed` (city already deemed the same
plans deficient on those points).

---

## 3. Resources

```yaml
resources:
  bureau: true
  submissionVersion: "{{ input.submissionVersionId }}"   # stages U1 site-plan data
  python: true                                            # for semantic-search-blocks
```

**U1 plan-set preprocessing is assumed.** Workflow fails fast if
`projects/{projectId}/README.md` / `facts.md` / per-sheet `guide.md` /
`blocks.md` are missing in the staged workspace. Operator runs the
preprocessing pipeline separately before kicking off CRC (same expectation as
completeness-check today).

**No bureau-shipped checklist dir.** Unlike CC, CRC does not read its guides
from `bureau/jurisdictions/.../{checklistsDir}`. Guides are fetched per-run from
the `crc-guides` Supabase bucket (§4.1).

---

## 4. Pipeline

Six steps. The first is a pre-flight that stages the guide files; the
remaining four mirror the shape of completeness-check but with new prompts
and CRC-specific scripts.

```
1. fetch-crc-guides     (script)  → workspace/crc-guides/*.md, manifest.json
2. review               (agent)   → output/findings/{groupingId}.json  (one agent per dept guide)
3. enrich-findings      (script)  → output/enriched-findings.json
4. rephrase-titles      (agent)   → output/rephrased-items.json
5. build-review-comments(script)  → output/review-comments.json
6. (DB save by Conductor's review-saver)
```

### 4.1 Step 1 — `fetch-crc-guides` (new script)

Resolves the crc-guides bucket prefix and copies all guide files + the
manifest into the workspace.

**Resolution sequence:**
1. Query `submission_version` for `crcGuidesSubmissionVersionId` → get
   `submission_id`, `version_number`.
2. Query `submission` → `project_id`.
3. Compose Supabase bucket prefix:
   ```
   crc-guides/{projectUuid}/{submissionUuid}/{u0VersionNumber}/{crcGenerationNumber}/
   ```
   - If `crcGenerationNumber` was not supplied: list the
     `crc-guides/{projectUuid}/{submissionUuid}/{u0VersionNumber}/` prefix,
     pick the dir with the highest integer name, log the choice.
4. Download every `crc-*.md` file + `manifest.json` from that prefix to
   `{WORKSPACE_PATH}/crc-guides/`. Also download the `figures/` subtree so
   image references in the guides resolve at agent-tool-call time.
   - `ignored-comments.md` and `decisions.md` are skipped — they're skill
     audit artifacts, not workflow input.
5. Write `output/crc-guides-manifest.json` recording the resolved
   `{projectUuid, submissionUuid, u0VersionNumber, crcGenerationNumber}` and
   the full list of fetched files. This becomes the chain-of-custody record
   for which guide generation produced these verdicts.

**Failure modes:**
- Prefix doesn't exist → fail-fast with "no crc-guides found at <prefix>; run
  generate-crc-guides skill first".
- No `crc-*.md` files in the prefix → same fail-fast.
- Bucket access denied → standard Conductor secrets-missing surface.

### 4.2 Step 2 — `review` (agent)

One agent per crc-*.md guide file. The agent processes **all atomic items
within that one dept's guide** in a single session, then stops.

```yaml
- name: review
  agent:
    model: "{{ input.model }}"
    effort: "{{ input.effort }}"
    prompt: review.md
  tools:
    - crc-vision-check          # new wrapper, see §5
    - script:semantic-search-blocks
  checklistItems: "{{ WORKSPACE_PATH }}/crc-guides/crc-*.md"
  schema: crc.schema.json
  output: "{{ WORKSPACE_PATH }}/output/findings/{{ checklistItem }}.json"
  retries: 5
  maxWorkers: "{{ input.maxWorkers }}"
```

**Agent context per item.** The agent sees ONLY the atomic-item row plus the
dept's guide framing:
- `requirement`, `codeCitation`, `severity`, `evidenceExpected`,
  `parentComment` (for traceability — agent reads it but does NOT use it as a
  spec extension)
- `## Description`, `## Regulatory Overview`, `## Key Terms`,
  `## Documents to Review`, `## Validation Methodology` (shared by all items
  in the dept's guide)
- `## Figures` (text descriptions + constraints + local image paths)

The agent does NOT see the original MCR comment body verbatim, nor the source
MCR PDF, nor the city's prior verdict — those are skill-side concerns. The
skill's `requirement` field is treated as the ground-truth spec.

### 4.3 Step 3 — `enrich-findings` (script, port of CC's version)

Joins the agent's findings with their parent-guide metadata (item title,
parent comment id, code citation) so downstream steps don't have to re-open
the guide markdown. Output mirrors CC's `enriched-findings.json` shape with
two CRC-specific fields per item: `parentCommentId` and `atomicItemId`.

This is a near-clone of `completeness-check/scripts/enrich-findings.ts` with
the title source updated to read `requirement` from the crc-guides table
instead of CC's checklist column.

### 4.4 Step 4 — `rephrase-titles` (agent, analog of CC's `format-reports`)

CC has a Sonnet step that rephrases checklist-item titles into short
human-readable comment titles. CRC mirrors this — but uses a CRC-specific
prompt because the source material (atomic MCR-derived requirements) and the
target audience (applicant reading their resubmittal cover sheet) differ.

Output: `output/rephrased-items.json` — a list of
`{atomicItemId, rephrasedTitle}` records.

This step exists because CRC's atomic-item `requirement` text is often a
verification sentence ("Verify on-street parking is ≥15 ft from either side
of fire hydrants") that's awkward as a comment title in a DB UI. The
rephrased title is a short noun phrase ("Hydrant offset for on-street
parking").

### 4.5 Step 5 — `build-crc-review-comments` (new script)

Reads `enriched-findings.json` + `rephrased-items.json` → assembles
`output/review-comments.json` for Conductor's standard review-saver to pick
up. One row per atomic CRC item; sequential 1..N comment numbering across the
full run (across all depts, in deterministic order — see §6.3).

This is a CRC-specific script (not a port of CC's `build-review-comments.ts`)
because the output JSON shape differs in two material ways:
- Status enum: `resolved` / `failed` / `not-applicable` (not pass/fail/warn).
- Metadata: includes the `crc-guides-manifest.json` provenance pointer so
  rows can be traced back to which guide generation produced them.

### 4.6 Step 6 — DB save (Conductor's `review-saver`)

Conductor's `review-saver` infrastructure handles the actual INSERT into
`reviews` / `review_comments` when `review:` is set in the workflow YAML:

```yaml
review: "{{ WORKSPACE_PATH }}/output/review-comments.json"
```

It writes:
- `reviews(review_type='crc', submission_version_id=<U1 id>, output_schema='2026-06-crc', output_json=…)`
  — sections live inside `output_json.sections` (see §6.1).
- `review_comments(...)` — one per atomic item, with
  `output_schema='2026-06-crc'`.

**Do NOT write to `review_sections`.** That table is deprecated per
`cityhall/docs/review-output-schemas.md:53-67`; cityhall reads sections from
`reviews.output_json.sections`. The CRC review-saver must mirror the
`'2026-04-simplified'` schema's behavior — sections JSON only, no
`review_sections` rows. (Revised 2026-06-22; see §6.)

See §6 for the exact field mapping.

---

## 5. Tooling — `crc-vision-check` (new tool)

### 5.1 Why a CRC-specific wrapper

The shared `conductor/src/tools/vision/` tool takes only `documentId`,
`sheetNum`, `prompt`. CRC items frequently need to compare a U1 plan sheet
against a *reference figure* the skill extracted from the MCR — e.g., "verify
the U1 striping plan matches TCM Fig. 9-2's min 15 ft hydrant offset, with
the figure attached for visual comparison".

Building a dedicated wrapper (rather than extending the shared vision tool)
keeps the shared tool's surface stable for completeness-check and the formal
review workflow, and lets CRC encapsulate the figure-loading logic without
touching other consumers.

### 5.2 Tool location

```
conductor/src/tools/crc-vision-check/
  index.ts        # tool factory + handler
  prompt.md       # tool description shown to the agent
```

### 5.3 Tool signature (input)

```typescript
{
  documentId: string,            // U1 sheet to analyze (same as shared vision)
  sheetNum?: number,             // optional sheet within doc
  prompt: string,                // what to check / extract / compare
  atomicItemId?: string,         // e.g. "TPW-9.1" — if set, wrapper auto-loads
                                 // the parent comment's figures from
                                 // {WORKSPACE_PATH}/crc-guides/figures/{parent}/*.png
                                 // and includes them as reference images
}
```

When `atomicItemId` is set, the wrapper:
1. Parses the parent comment ID (`TPW-9.1` → `TPW-9`).
2. Reads the dept's `crc-*.md` to find that parent's figure list.
3. Loads each image from `{WORKSPACE_PATH}/crc-guides/figures/{parent_id}/*.png`.
4. Calls the underlying vision model with the U1 sheet image + the reference
   figure(s) + the prompt. The model is told which is the U1 sheet and which
   are MCR reference figures.

When `atomicItemId` is unset (or no figures are attached to that parent), the
wrapper behaves identically to the shared `vision` tool — single U1 sheet
analysis. This is the "fall-through" path mentioned in the question batch.

### 5.4 Why the agent gets only `crc-vision-check`

The review prompt offers one vision tool, not two, to reduce decision load
and keep the choice deterministic ("always use this; pass an `atomicItemId`
when relevant"). Internally the wrapper either includes figures or doesn't.

### 5.5 Sidecar logging

Mirrors the shared vision tool — appends to
`{WORKSPACE_PATH}/output/vision-log.jsonl`. CRC entries are distinguishable
by an `event` of `crc-vision:result` / `crc-vision:error` and a
`figuresIncluded: N` field for analytics.

---

## 6. Schema and DB shape

### 6.1 Output schema — `crc.schema.json`

Located at `bureau/workflows/comment-resolution-check/schemas/crc.schema.json`.
Identical shape to `completeness.schema.json` except:
- `status` enum: `["resolved", "failed", "not-applicable"]` (was
  `["pass", "fail", "not-applicable"]`).
- `resolutionDetails` (the CC standard-note-diff structured field) is removed
  — not applicable to CRC's comment shape.

```jsonc
{
  "grouping": "crc-tpw",
  "findings": [{
    "checklistItemId": "TPW-3.1",
    "observation": "what I saw on which sheets",
    "reasoning": "how that drives the verdict",
    "tools_used": ["crc-vision-check"],
    "status": "resolved" | "failed" | "not-applicable",
    "explanation": "6-30 word summary",
    "resolution": "corrective action if failed, else null",
    "evidenceLocations": [{
      "documentId": "...", "sheetNumber": 2, "label": "Cover Sheet"
    }]
  }],
  "summary": "8 of 12 items resolved, 3 failed, 1 not-applicable"
}
```

### 6.2 Status semantics

- **`resolved`** — positive evidence in U1 that the requirement is satisfied
  (SPEC §2.1).
- **`failed`** — no positive evidence found, or evidence shows the
  requirement is still not met. Ambiguous evidence also collapses to
  `failed` (no explicit bias rule per SPEC §8.2, but the burden of positive
  evidence remains).
- **`not-applicable`** — the comment became moot post-U0 (e.g., U1 removed
  the feature the comment was about; the comment's conditional doesn't
  apply to U1's scope).

### 6.3 DB writes

Conductor's standard `review-saver` writes one `reviews` row per workflow
run, with `review_comments` rows underneath. **No `review_sections` rows**
— that table is deprecated; section metadata lives inside
`reviews.output_json.sections` (the cityhall UI reads from there, per
`cityhall/docs/review-output-schemas.md:53-67`).

| Table | Field | Value |
|---|---|---|
| `reviews` | `review_type` | `'crc'` |
| `reviews` | `submission_version_id` | input `submissionVersionId` (U1) |
| `reviews` | `prior_review_id` | `null` (MVP — see §2.3) |
| `reviews` | `is_current` | `true` |
| `reviews` | `output_schema` | `'2026-06-crc'` |
| `reviews` | `output_json` | `{ metadata, sections, … }` — sections embedded here, one entry per dept (`{slug:'crc-tpw', label:'TPW (Transportation & Public Works)', summary:'…'}`) |
| `review_comments` | `output_schema` | `'2026-06-crc'` |
| `review_comments` | `comment_number` | sequential `1..N` across all sections (see below) |
| `review_comments` | `output_json` | one finding's full record (includes `section` slug for grouping) |
| `review_comments` | `sheet_references` | derived from `evidenceLocations` |

**Sections shape inside `reviews.output_json`.** See cityhall-ui DESIGN-SPEC
§6.1 for the authoritative contract. Summary: an array of
`{slug, label, summary}` objects, one per dept represented in the MCR. The
slug (`crc-tpw`) doubles as the foreign key from `review_comments.output_json.section`.

**Sequential comment numbering.** The atomic checklist ID
(e.g., `TPW-3.1`) stays in `output_json.checklistItemId` for traceability;
`review_comments.comment_number` is a plain integer 1..N.

Ordering is deterministic:
1. Departments in alphabetical order by section code (`crc-ad`, `crc-awrr`,
   `crc-ca`, `crc-cm`, …).
2. Within a dept: by parent comment number ascending, then by atomic sub-index.

So `TPW 3.1` and `TPW 3.2` get adjacent comment numbers in the final list,
in the order the skill emitted them.

### 6.4 What is NOT written by CRC

- **`comment_triage`** — explicitly skipped for MVP. Triage state is owned by
  the City Hall UI when humans interact post-run. The SPEC §8.4 note about
  "CRC writes `resolved` / `failed` to triage_status" is **deferred to
  iteration 3** alongside the rest of the UI work.
- **`resolution_plan`** — unused by CRC.
- **MCR-as-reviews-row** — the original city MCR is not persisted as a
  `reviews` row by this workflow (SPEC §9.4).

---

## 7. Workspace layout

After a successful run, `{WORKSPACE_PATH}/` looks like:

```
{WORKSPACE_PATH}/
  bureau/                                  # staged by Conductor
  projects/{projectId}/                    # staged via resources.submissionVersion
    README.md
    facts.md
    primary-site-plan/sheet-NN/…
    supplementary-docs/…
  crc-guides/                              # fetched by Step 1
    manifest.json                          # skill's manifest (read-only ref)
    crc-tpw.md
    crc-de.md
    …
    figures/
      TPW-9/1.png
      TPW-12/1.png
      …
  output/
    crc-guides-manifest.json               # what we fetched + provenance
    findings/
      crc-tpw.json
      crc-de.json
      …
    enriched-findings.json
    rephrased-items.json
    review-comments.json                   # picked up by review-saver
    vision-log.jsonl                       # crc-vision-check sidecar
```

**Upload** (mirrors CC):

```yaml
upload:
  bucket: workflow-runs
  prefix: "comment-resolution-check/{{ input.projectId }}/{{ datetime }}"
```

---

## 8. File-by-file implementation map

Everything new lives under
`bureau/workflows/comment-resolution-check/` plus one new tool under
`conductor/src/tools/crc-vision-check/`.

```
bureau/workflows/comment-resolution-check/
  workflow.yaml                           # the 6-step pipeline (§4)
  prompts/
    review.md                             # CRC review agent prompt (port + edit of CC review.md)
    rephrase-titles.md                    # title-rephrasing prompt (port + edit of CC format-reports.md)
  schemas/
    crc.schema.json                       # finding schema (§6.1)
  scripts/
    fetch-crc-guides.ts                   # Step 1 — Supabase pull
    enrich-findings.ts                    # Step 3 — port of CC's
    build-crc-review-comments.ts          # Step 5 — new CRC-specific
  README.md                               # caller-facing docs

conductor/src/tools/crc-vision-check/
  index.ts                                # tool factory
  prompt.md                               # tool description (agent-facing)
```

Things explicitly **not** ported from completeness-check (because they don't
apply to CRC's shape):
- `cross-run-consolidate-cc.ts` — single-run MVP.
- `apply-forced-outcomes.ts` — no force-outcomes for CRC.
- `inspect-drawing*` — CC's vision-specialist suite; CRC uses `crc-vision-check`.
- `vision-router.md` — same reason.

---

## 9. Smoke-test plan (SPEC §10.1)

Target: 1700 South Lamar U0 (U0 plans, U0 MCR — no U1 yet).

1. **Pre-req:** run `generate-crc-guides` against 1700's U0 MCR to produce
   `crc-guides/{1700_project_uuid}/{1700_submission_uuid}/{u0_version_number}/0/`.
   Verify the bucket upload succeeded.
2. **Pre-req:** confirm 1700's U0 site-plan data is preprocessed and
   accessible to Conductor.
3. **Run:**
   ```
   conductor run comment-resolution-check \
     --input submissionVersionId=<1700-u0-uuid> \
     --input crcGuidesSubmissionVersionId=<1700-u0-uuid>
   ```
4. **Expected outcome:**
   - `reviews` row written with `review_type='crc'`, `submission_version_id`
     pointing at v4.
   - `review_comments` rows written, one per atomic CRC item, with
     `comment_number = 1..N` and `status` mostly `failed`.
   - Any `resolved` rows are suspicious — investigate (likely a guide-item
     phrasing the agent over-credits).
   - `not-applicable` rows are expected only for items the U1 plan set
     genuinely doesn't address (e.g., the comment is about a feature the
     plans don't have).

**What this validates:**
- End-to-end wiring: guide fetch → agent run → DB writes.
- Schema validity of the CRC JSON.
- `evidence_locations` resolves to real sheets in the staged U1 plan set.
- The `crc-vision-check` wrapper loads figures and routes prompts correctly.

**What this does NOT validate** (deferred to iter-2 eval, SPEC §10.2):
- Whether the agent correctly produces `resolved` on a real U1 plan that
  resolves a comment. That requires a labeled later-cycle MCR (1700 U1).

---

## 10. Open items / small defaults flagged for redirect

These are sub-decisions I'm making at MVP defaults; flag if any deserve
different treatment.

- **Section slug** — `crc-tpw`, `crc-de`, etc. (in `output_json.sections[i].slug`),
  derived from the guide filename. Could instead be the bare dept prefix
  (`tpw`, `de`); keeping the `crc-` prefix so it's distinguishable from
  completeness-check sections and formal-review sections in cross-table
  queries / log greps.
- **Section label** — full department name (e.g., "TPW (Transportation &
  Public Works)") in `output_json.sections[i].label`, sourced from the
  skill's dept-prefix dict.
- **`crc-guides-manifest.json` location** — workspace-local at
  `output/crc-guides-manifest.json` (not uploaded as a top-level artifact).
  If we want it in `reviews.output_json` for queryability, add a field.
- **Comment numbering across runs** — sequential 1..N is *per-run*, not
  global. If two CRC runs of the same submission produce different counts,
  `comment_number=1` in run A and `comment_number=1` in run B may refer to
  different atomic items. UI consumers should key on (review_id, comment_number).
- **Figure loading inside Conductor sandbox** — the `crc-vision-check` tool
  reads images from disk paths inside the sandbox. `fetch-crc-guides` is
  responsible for pulling `figures/` from the bucket. If a guide references a
  figure that didn't get fetched, the tool falls through to the
  no-figures path and logs a warning.
- **Re-runnability** — re-running the workflow with the same inputs writes a
  new `reviews` row (and sets the prior row `is_current=false` via the
  existing review-saver logic). No special CRC handling needed.

---

## 11. Iteration-2+ follow-ons (deferred per SPEC §11)

Listed here so the iter-1 implementation leaves clean seams.

- **Medly + majority vote.** Add `runs: N` input, `runs:` block in the agent
  step, and a new `cross-run-consolidate-crc` script that consolidates with
  CRC's 3-state enum (the CC version assumes pass/fail/warn). Plan to write
  this fresh rather than parameterize CC's.
- **`comment_triage` writes.** Add a 6th step that writes one triage row per
  review_comment with `triage_status` matching the verdict. Gated by an
  input flag if we want both old and new behaviors to coexist briefly.
- **Built-in eval step.** Optional `evaluate` step gated by a
  `groundTruthMCRPath` input — runs after `build-review-comments`, mirrors
  the existing `atomic-accuracy` pattern.
- **`priorReviewId` input.** Five lines of YAML when the v3 UI/Substation
  trigger path needs to chain runs.
- **`--use-local-guides` flavor.** When operator iteration tempo on guides
  demands fast local edits, add a `localGuidesDir` input that
  `fetch-crc-guides` honors instead of going to Supabase.
- **Redline-comment inputs.** When the v2 redline-extraction skill ships
  (SPEC §7), `fetch-crc-guides` learns to merge MCR-derived guides with
  redline-derived guides.

---

## 12. Appendix — diff against completeness-check at-a-glance

| Dimension | completeness-check | comment-resolution-check |
|---|---|---|
| Guide source | bureau-shipped (`bureau/.../v2.5-trimmed/`) | Supabase `crc-guides` bucket, per-run fetch |
| Multi-run | Yes (`runs: N` + `cross-run-consolidate-cc`) | No (single-run MVP) |
| Force-outcomes TSV | Yes | No |
| Comment-numbering TSV | Optional | No (sequential auto-assigned) |
| Schema status enum | `pass` / `fail` / `not-applicable` | `resolved` / `failed` / `not-applicable` |
| Schema `resolutionDetails` | Yes (standard-note diff) | No |
| Vision tools | `vision` + specialists (inspect-drawing, measure-distance) via `vision-router` | `crc-vision-check` only |
| Title rephrasing | `format-reports` agent | `rephrase-titles` agent (CRC-specific prompt) |
| `prior_review_id` chaining | Yes | No (MVP) |
| `comment_triage` writes | (via City Hall) | (via City Hall) |
| Eval hooks | (separate workflow) | (separate workflow) |
| DB `review_type` | `'cc'` | `'crc'` |
